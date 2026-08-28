/**
 * 共享美术套件 · 参数化矢量鱼（1.3 第 22 步 B 档 `fishing-star` 首建，归 B 档所有；
 * 其他游戏只 import 不修改；签名 ctx/x/y/size/spec 定了就不改）。
 *
 * 每条鱼五道工序（见 plan-1.3 第 22 步 四·补二）：
 *  1. 纺锤身路径（宽高比按 spec 0.9–1.6 变化）+ 三停线性渐变（背深腹浅）；
 *  2. 尾鳍（叉尾 / 圆尾 / 扇尾三型）+ 背鳍小三角；
 *  3. 花纹层：条纹 / 圆点 / 无纹 / 金鳞四选一（尺寸 < 15px 省略本层，只留体型差）；
 *  4. 圆眼 + 高光点 + 微笑嘴（鱼全程开心）；
 *  5. 摆尾两帧：尾鳍 ±14° 摆动（相位由调用方按 x×0.05+speed×2 给）；
 *     朝向 = 速度符号翻转（scaleX ±1）；深水鱼饱和度 −30%、轮廓 alpha 0.7。
 *
 * 全部程序化矢量绘制：零位图、零运行时依赖；光源统一左上 45°。
 */

export type FishTail = "fork" | "round" | "fan";
export type FishSkin = "stripes" | "dots" | "plain" | "gold";

export interface FishSpec {
  key: string;
  /** 纺锤身宽高比（0.9 圆胖 .. 1.6 细长） */
  aspect: number;
  tail: FishTail;
  skin: FishSkin;
  /** 身体主色（HSL 色相 0..360） */
  hue: number;
  /** 基准饱和度（%） */
  sat: number;
  /** 基准亮度（%） */
  light: number;
}

/** 七个鱼种原型：体型胖瘦 × 尾形 × 花纹两两组合各不相同；末位是稀有金鳞 */
export const FISH_SPECS: readonly FishSpec[] = [
  { key: "minnow", aspect: 1.0, tail: "fork", skin: "stripes", hue: 205, sat: 62, light: 62 },
  { key: "pudge", aspect: 0.9, tail: "round", skin: "plain", hue: 152, sat: 48, light: 58 },
  { key: "darter", aspect: 1.6, tail: "fork", skin: "plain", hue: 262, sat: 46, light: 66 },
  { key: "blossom", aspect: 1.1, tail: "fan", skin: "dots", hue: 336, sat: 64, light: 70 },
  { key: "amber", aspect: 1.3, tail: "round", skin: "stripes", hue: 28, sat: 78, light: 60 },
  { key: "moonray", aspect: 1.45, tail: "fan", skin: "dots", hue: 214, sat: 42, light: 72 },
  { key: "king", aspect: 1.2, tail: "fan", skin: "gold", hue: 42, sat: 80, light: 62 },
];

/** 渲染尺寸低于这个像素数就省略花纹层（体型 / 尾形差保留） */
export const FISH_PATTERN_MIN_PX = 15;
/** 摆尾摆幅：尾鳍 ±14° */
export const TAIL_WAG_RAD = (14 * Math.PI) / 180;
/** 稀有金鳞 / 金光描边用色（与 fishing-star 的 fshRare token 同值） */
export const FISH_GOLD = "#F0C25A";

/** 摆尾相位：x×0.05 + speed×2（调用方喂进 drawKitFish 的 wagPhase） */
export function tailWagPhase(x: number, speed: number): number {
  const px = Number.isFinite(x) ? x : 0;
  const sp = Number.isFinite(speed) ? speed : 0;
  return px * 0.05 + sp * 2;
}

/** 朝向 = 速度符号：speed<0 朝左（scaleX −1），否则朝右 */
export function facingOf(speed: number): 1 | -1 {
  return Number.isFinite(speed) && speed < 0 ? -1 : 1;
}

/** 深水映射：最深处饱和度 −30%、轮廓 alpha 0.7（只读 depth 做映射，不碰演算） */
export function depthFade(depth: number, maxDepth: number): { sat: number; alpha: number } {
  const total = Number.isFinite(maxDepth) && maxDepth > 0 ? maxDepth : 1;
  const d = Number.isFinite(depth) ? Math.min(Math.max(depth, 0), total) : 0;
  const t = d / total;
  return { sat: 1 - 0.3 * t, alpha: 1 - 0.3 * t };
}

/** id 的稳定哈希（FNV-1a）：同一条鱼永远配同一副皮 */
function fishHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 鱼 id + 稀有度 → 鱼种原型；传说（rarity ≥ 5）固定拿金鳞 spec */
export function specForFish(id: string, rarity = 1): FishSpec {
  if (Number.isFinite(rarity) && rarity >= 5) return FISH_SPECS[FISH_SPECS.length - 1];
  return FISH_SPECS[fishHash(String(id)) % (FISH_SPECS.length - 1)];
}

/** HSL 拼色：satScale 缩放饱和度（深水 0.7），dLight 抬 / 压亮度 */
export function fishColor(spec: FishSpec, satScale = 1, dLight = 0): string {
  const s = Math.round(Math.min(100, Math.max(0, spec.sat * satScale)));
  const l = Math.round(Math.min(96, Math.max(8, spec.light + dLight)));
  return `hsl(${spec.hue},${s}%,${l}%)`;
}

/** 纺锤剖面：u=0 鱼头 → u=1 尾根，中段最宽、尾根收细 */
function spindleAt(u: number): number {
  const t = Math.min(Math.max(u, 0), 1);
  return Math.sin(Math.PI * (0.16 + 0.84 * t));
}

function halfLen(size: number): number {
  return size / 2;
}

function halfHeight(spec: FishSpec, size: number): number {
  return (size * 0.36) / spec.aspect;
}

export interface FishPoint {
  x: number;
  y: number;
}

/**
 * 鱼种剪影采样（鱼头朝 +x、中心 0,0）：身体上缘 → 尾鳍特征点 → 身体下缘。
 * 「鱼种两两不同」的单一事实来源：绘制与测试都吃它。
 */
export function fishSilhouette(spec: FishSpec, size: number, steps = 20): FishPoint[] {
  if (!Number.isFinite(size) || size <= 0) return [];
  const hl = halfLen(size);
  const hh = halfHeight(spec, size);
  const jointX = -hl * 0.92;
  const pts: FishPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    pts.push({ x: hl - 2 * hl * u, y: -hh * spindleAt(u) });
  }
  if (spec.tail === "fork") {
    pts.push(
      { x: jointX - hl * 0.5, y: -hh * 0.95 },
      { x: jointX - hl * 0.28, y: 0 },
      { x: jointX - hl * 0.5, y: hh * 0.95 }
    );
  } else if (spec.tail === "round") {
    pts.push(
      { x: jointX - hl * 0.26, y: -hh * 0.72 },
      { x: jointX - hl * 0.56, y: 0 },
      { x: jointX - hl * 0.26, y: hh * 0.72 }
    );
  } else {
    pts.push(
      { x: jointX - hl * 0.55, y: -hh * 1.05 },
      { x: jointX - hl * 0.75, y: 0 },
      { x: jointX - hl * 0.55, y: hh * 1.05 }
    );
  }
  for (let i = steps; i >= 0; i--) {
    const u = i / steps;
    pts.push({ x: hl - 2 * hl * u, y: hh * spindleAt(u) });
  }
  return pts;
}

export interface FishGradient2D {
  addColorStop(offset: number, color: string): void;
}

/** 画鱼要用到的 2D 上下文子集（真 CanvasRenderingContext2D 天然满足，测试可用桩） */
export interface Fish2D {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: string;
  globalAlpha: number;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(rad: number): void;
  scale(x: number, y: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  fill(): void;
  stroke(): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): FishGradient2D;
}

export interface KitFishOpts {
  /** 摆尾相位（喂给正弦；reduced-motion 时调用方传 0 = 摆尾停） */
  wagPhase?: number;
  /** 朝向：1 朝右、-1 朝左（速度符号） */
  facing?: 1 | -1;
  /** 饱和度缩放（深水 0.7；见 depthFade） */
  satScale?: number;
  /** 整体透明度（深水轮廓虚化也从这里走） */
  alpha?: number;
  /** 强制开 / 关花纹层；不传按 size >= FISH_PATTERN_MIN_PX 自动判断 */
  skinDetail?: boolean;
  /** 稀有金光描边强度 0..1（收获一闪；0 不画） */
  goldEdge?: number;
}

/** 纺锤身闭合路径（本地坐标，鱼头朝 +x） */
function traceBody(ctx: Fish2D, spec: FishSpec, size: number): void {
  const pts = fishSilhouette(spec, size, 16);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** 尾鳍路径（本地坐标原点 = 尾根，鱼头朝 +x，尾巴伸向 −x） */
function traceTail(ctx: Fish2D, spec: FishSpec, size: number): void {
  const hl = halfLen(size);
  const hh = halfHeight(spec, size);
  ctx.beginPath();
  if (spec.tail === "fork") {
    ctx.moveTo(0, 0);
    ctx.lineTo(-hl * 0.5, -hh * 0.95);
    ctx.quadraticCurveTo(-hl * 0.28, 0, -hl * 0.5, hh * 0.95);
    ctx.closePath();
  } else if (spec.tail === "round") {
    ctx.ellipse(-hl * 0.28, 0, hl * 0.3, hh * 0.72, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(0, 0);
    ctx.lineTo(-hl * 0.55, -hh * 1.05);
    ctx.quadraticCurveTo(-hl * 0.78, 0, -hl * 0.55, hh * 1.05);
    ctx.closePath();
  }
}

/** 花纹层：条纹 / 圆点 / 金鳞（plain 不画）；调用方已判过尺寸门槛 */
function skinLayer(ctx: Fish2D, spec: FishSpec, size: number, satScale: number): void {
  const hl = halfLen(size);
  const hh = halfHeight(spec, size);
  if (spec.skin === "stripes") {
    ctx.strokeStyle = fishColor(spec, satScale, -24);
    ctx.lineWidth = Math.max(1, size * 0.05);
    for (const k of [0.32, 0.02, -0.28]) {
      ctx.beginPath();
      ctx.moveTo(hl * k, -hh * 0.55);
      ctx.quadraticCurveTo(hl * k - hl * 0.08, 0, hl * k, hh * 0.55);
      ctx.stroke();
    }
  } else if (spec.skin === "dots") {
    ctx.fillStyle = fishColor(spec, satScale, -22);
    for (const [dx, dy] of [
      [0.28, -0.18],
      [0, 0.16],
      [-0.3, -0.12],
    ] as const) {
      ctx.beginPath();
      ctx.arc(hl * dx, hh * dy, Math.max(0.8, size * 0.045), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (spec.skin === "gold") {
    ctx.fillStyle = FISH_GOLD;
    for (const [dx, dy] of [
      [0.34, -0.12],
      [0.06, 0.14],
      [-0.2, -0.18],
      [0.14, -0.32],
    ] as const) {
      ctx.beginPath();
      ctx.arc(hl * dx, hh * dy, Math.max(0.8, size * 0.04), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.beginPath();
    ctx.arc(hl * 0.22, -hh * 0.28, Math.max(0.6, size * 0.03), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 画一条参数化矢量鱼（中心 x,y、全长 size 像素）。
 * 摆尾只转尾鳍、朝向只翻 scaleX：坐标演算一概不碰，是纯粹的皮。
 */
export function drawKitFish(
  ctx: Fish2D,
  x: number,
  y: number,
  size: number,
  spec: FishSpec,
  opts: KitFishOpts = {}
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || size <= 0) return;
  const hl = halfLen(size);
  const hh = halfHeight(spec, size);
  const satScale = opts.satScale ?? 1;
  const facing = opts.facing ?? 1;
  const skinOn = opts.skinDetail ?? size >= FISH_PATTERN_MIN_PX;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  if (opts.alpha !== undefined) ctx.globalAlpha = Math.max(0, Math.min(1, opts.alpha));

  // 2. 尾鳍（先画，压在身体后面）：±14° 摆动
  ctx.save();
  ctx.translate(-hl * 0.92, 0);
  ctx.rotate(Math.sin(opts.wagPhase ?? 0) * TAIL_WAG_RAD);
  traceTail(ctx, spec, size);
  ctx.fillStyle = fishColor(spec, satScale, -10);
  ctx.fill();
  ctx.restore();

  // 2. 背鳍小三角
  ctx.beginPath();
  ctx.moveTo(hl * 0.08, -hh * 0.7);
  ctx.quadraticCurveTo(-hl * 0.16, -hh * 1.5, -hl * 0.4, -hh * 0.58);
  ctx.closePath();
  ctx.fillStyle = fishColor(spec, satScale, -14);
  ctx.fill();

  // 1. 纺锤身 + 三停渐变（背深腹浅，光源左上）
  traceBody(ctx, spec, size);
  const grad = ctx.createLinearGradient(0, -hh, 0, hh);
  grad.addColorStop(0, fishColor(spec, satScale, -16));
  grad.addColorStop(0.5, fishColor(spec, satScale, 0));
  grad.addColorStop(1, fishColor(spec, satScale, 16));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = fishColor(spec, satScale, -30);
  ctx.lineWidth = Math.max(0.8, size * 0.035);
  ctx.stroke();

  // 3. 花纹层（< 15px 省略，只留体型 / 尾形差）
  if (skinOn) skinLayer(ctx, spec, size, satScale);

  // 4. 圆眼 + 高光点 + 微笑嘴（全程开心）
  const er = Math.max(0.9, size * 0.055);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(hl * 0.55, -hh * 0.2, er, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#33424f";
  ctx.beginPath();
  ctx.arc(hl * 0.58, -hh * 0.2, er * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.beginPath();
  ctx.arc(hl * 0.53, -hh * 0.28, er * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#33424f";
  ctx.lineWidth = Math.max(0.7, size * 0.03);
  ctx.beginPath();
  ctx.arc(hl * 0.72, hh * 0.12, Math.max(1, size * 0.08), Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  // 稀有金光描边（收获一闪；reduced 静态金边也走这里）
  if (opts.goldEdge && opts.goldEdge > 0) {
    traceBody(ctx, spec, size);
    ctx.strokeStyle = FISH_GOLD;
    ctx.lineWidth = Math.max(1.2, size * 0.07);
    const keep = ctx.globalAlpha;
    ctx.globalAlpha = keep * Math.min(1, opts.goldEdge);
    ctx.stroke();
    ctx.globalAlpha = keep;
  }

  ctx.restore();
}
