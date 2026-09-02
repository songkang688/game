/**
 * 围子花园 · 1.3 视觉资产层（`src/games/weiqi-garden/art.ts`）
 *
 * 全部是「只吃传入 ctx」的纯绘制函数与纯数据：不碰玩法数值、不挂监听、
 * 不 import rules/life/score/ai。调色与明暗推导复用共享素材包 `src/art/kit/`
 * （视觉宪法：凡 kit 有的不许重抄）。
 *
 * 资产清单（对应 docs/plan-1.3-step4-B-weiqi-garden.md 的改进方案）：
 * - 木盘：三层底（木色渐变 + 确定性木纹 + 深木边框），四角小花藤点缀；
 * - 玉石子：径向渐变 + 左上柔高光 + 投影，白子加蛤碁石弧纹；
 *   `stoneSprite` 按尺寸缓存 offscreen 画布，19 路满盘 361 子走 `drawImage`；
 * - 提子花瓣：对象池 ≤ 16，黑子化紫瓣、白子化白瓣，飘起淡出（reduced 不喷）；
 * - 标记系统：最后一手小枫叶、提示发芽点、劫点小红花、圆角光标框、死子叉纹
 *   （全部形状通道区分，色弱友好）；
 * - 数目铺色：`washAlpha` 波纹扩散的纯函数；
 * - 结算：奖杯 SVG + 「花园收成」小花行（≤ 20 朵）。
 */

import { KIT_PALETTE, shade, tint } from "../../art/kit";

export type StoneKind = "black" | "white";

const TAU = Math.PI * 2;

function fin(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * 绘制上下文的结构化子集：真浏览器的 CanvasRenderingContext2D 与
 * testkit 的记账替身都满足。渐变类方法留成可选,探测不到就退平涂。
 */
export interface ArtCtx {
  beginPath: () => void;
  closePath?: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => void;
  arc: (x: number, y: number, r: number, a: number, b: number) => void;
  fill: () => void;
  stroke: () => void;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeRect?: (x: number, y: number, w: number, h: number) => void;
  save: () => void;
  restore: () => void;
  translate: (x: number, y: number) => void;
  rotate: (a: number) => void;
  scale: (x: number, y: number) => void;
  createLinearGradient?: (a: number, b: number, c: number, d: number) => CanvasGradient;
  createRadialGradient?: (a: number, b: number, c: number, d: number, e: number, f: number) => CanvasGradient;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  lineCap?: string;
  lineJoin?: string;
}

// ---------------------------------------------------------------------------
// 调色:全部落成常量,方便素材契约测试逐个校验
// ---------------------------------------------------------------------------

/** 木盘配色(渐变两端、网格、边框皆由此推) */
export const WQ_WOOD = {
  /** 渐变亮端(左上) */
  top: "#e8c98f",
  /** 渐变暗端(右下) */
  bottom: "#d9b26e",
  /** 网格深棕 */
  grid: "#8a6a3b",
  /** 深木边框(取共享 kit 的深木色) */
  border: KIT_PALETTE.woodDark,
  /** 木纹线 */
  grain: shade("#d9b26e", 0.35)
} as const;

/** 玉石子配色:黑白各一组径向渐变端点 */
export const WQ_STONE = {
  blackHi: "#5a554c",
  blackLo: "#22201b",
  whiteHi: "#ffffff",
  whiteLo: "#e9e2d0",
  /** 白子那一圈极细的暖描边(浅盘面上分清边界) */
  whiteRim: "#b4a88c",
  /** 白子蛤碁石弧纹的米色 */
  shellLine: "#d8c9a3"
} as const;

/** 键盘光标框:圆角方框,与提示点形状区分;对木盘对比度 ≥ 3:1(有契约测试) */
export const CURSOR_COLOR = "#2f5fa8";

/** 提子花瓣配色:黑子 → 紫瓣,白子 → 白瓣(形状同、颜色随子) */
export const PETAL_COLORS: Readonly<Record<StoneKind, string>> = {
  black: KIT_PALETTE.lilac,
  white: "#ffffff"
};

/** 数目阶段的领地铺色:黑territory 淡紫、白 territory 淡米 */
export const TERRITORY_COLORS: Readonly<Record<StoneKind, string>> = {
  black: "#b493e6",
  white: "#fff3da"
};

// ---------------------------------------------------------------------------
// 木盘:渐变底 + 确定性木纹 + 深木边框 + 四角花藤
// ---------------------------------------------------------------------------

/** 极简确定性伪随机(LCG):同一尺寸的棋盘,木纹永远长一个样 */
function lcg(seed: number): () => number {
  let s = (Math.max(1, Math.round(seed)) * 48271) % 2147483647;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

/** 一枝小花藤:一条茎 + 两片叶 + 一朵五瓣小花,笔数 ≤ 12,画在边框角上 */
export function paintCornerVine(ctx: ArtCtx, s: number): void {
  const stemCol = "#6f8f4a";
  ctx.save();
  // 茎:一条弧线
  ctx.strokeStyle = stemCol;
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.5);
  ctx.quadraticCurveTo(0, -s * 0.05, s * 0.55, -s * 0.35);
  ctx.stroke();
  // 两片叶:变换 + 单位圆(替身环境没有 ellipse 也能画)
  for (const [lx, ly, rot] of [
    [-s * 0.18, s * 0.16, -0.9],
    [s * 0.14, -s * 0.12, 0.6]
  ] as const) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rot);
    ctx.scale(s * 0.22, s * 0.11);
    ctx.fillStyle = "#7cbf68";
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // 一朵五瓣小花 + 花芯
  const fr = s * 0.16;
  ctx.fillStyle = KIT_PALETTE.candy;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * TAU) / 5;
    ctx.beginPath();
    ctx.arc(s * 0.55 + Math.cos(a) * fr, -s * 0.35 + Math.sin(a) * fr, fr * 0.72, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = KIT_PALETTE.lemon;
  ctx.beginPath();
  ctx.arc(s * 0.55, -s * 0.35, fr * 0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export interface WoodBoardOpts {
  /** 画布边长 */
  extent: number;
  /** 棋盘边缘到第一条线的留白(花藤只准落在这一圈里) */
  pad: number;
}

/**
 * 温润木盘三层底:
 * 1. 木色线性渐变(左上亮 → 右下暗);
 * 2. 6–8 条极淡波浪木纹(以 extent 为确定性种子);
 * 3. 四周深木边框 + 内侧 1px 高光线;
 * 4. 四角边框上各一枝小花藤(不进棋盘内部,不干扰落点)。
 */
export function paintWoodBoard(ctx: ArtCtx, opts: WoodBoardOpts): void {
  const { extent, pad } = opts;
  if (!fin(extent) || extent <= 0) return;
  // 1) 渐变底(替身探测:createLinearGradient 不在就平涂亮端)
  if (typeof ctx.createLinearGradient === "function") {
    const g = ctx.createLinearGradient(0, 0, extent, extent);
    g.addColorStop(0, WQ_WOOD.top);
    g.addColorStop(1, WQ_WOOD.bottom);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = WQ_WOOD.top;
  }
  ctx.fillRect(0, 0, extent, extent);

  // 2) 波浪木纹:7 条,透明度 5–8%,同一尺寸永远同一组曲线
  const rand = lcg(extent);
  ctx.save();
  ctx.strokeStyle = WQ_WOOD.grain;
  ctx.lineCap = "round";
  const grains = 7;
  for (let i = 0; i < grains; i++) {
    const y = ((i + 0.6) / grains) * extent + (rand() - 0.5) * extent * 0.06;
    const amp = extent * (0.008 + rand() * 0.02);
    ctx.globalAlpha = 0.05 + rand() * 0.03;
    ctx.lineWidth = 1 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(-2, y);
    const segs = 4;
    for (let k = 0; k < segs; k++) {
      const x0 = (k / segs) * extent;
      const x1 = ((k + 1) / segs) * extent;
      const my = y + (k % 2 === 0 ? -amp : amp) * (0.6 + rand() * 0.8);
      ctx.quadraticCurveTo((x0 + x1) / 2, my, x1, y + (rand() - 0.5) * amp);
    }
    ctx.stroke();
  }
  ctx.restore();

  // 3) 深木边框 + 内侧高光线
  const bw = Math.max(4, Math.min(10, pad * 0.45));
  ctx.save();
  ctx.fillStyle = WQ_WOOD.border;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(0, 0, extent, bw);
  ctx.fillRect(0, extent - bw, extent, bw);
  ctx.fillRect(0, bw, bw, extent - bw * 2);
  ctx.fillRect(extent - bw, bw, bw, extent - bw * 2);
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = tint(WQ_WOOD.top, 0.45);
  ctx.lineWidth = 1;
  if (typeof ctx.strokeRect === "function") {
    ctx.strokeRect(bw + 0.5, bw + 0.5, extent - bw * 2 - 1, extent - bw * 2 - 1);
  }
  ctx.restore();

  // 4) 四角花藤:落在边框区,尺寸随留白缩放
  const vs = Math.max(6, Math.min(pad * 0.5, 14));
  const c = bw * 0.62 + vs * 0.4;
  const corners: readonly [number, number, number][] = [
    [c, c, 0],
    [extent - c, c, Math.PI / 2],
    [extent - c, extent - c, Math.PI],
    [c, extent - c, -Math.PI / 2]
  ];
  for (const [vx, vy, rot] of corners) {
    ctx.save();
    ctx.translate(vx, vy);
    ctx.rotate(rot);
    paintCornerVine(ctx, vs);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 玉石子:径向渐变 + 高光 + 投影;白子加蛤碁石弧纹
// ---------------------------------------------------------------------------

/**
 * 在 (x, y) 画一颗半径 r 的玉石质感棋子(直接矢量路径,offscreen 与兜底共用)。
 * `alpha` 是整体透明度(死子 0.35、ghost 0.4 都从这里进,不依赖外部 globalAlpha)。
 */
export function paintStone(ctx: ArtCtx, x: number, y: number, r: number, kind: StoneKind, alpha = 1): void {
  if (!fin(x) || !fin(y) || !fin(r) || r <= 0) return;
  const a = Math.max(0, Math.min(1, alpha));
  if (a <= 0) return;
  ctx.save();
  // 1) 底部投影:偏移 y+1.5 的半透明圆
  ctx.globalAlpha = a * 0.25;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(x, y + 1.5, r * 1.02, 0, TAU);
  ctx.fill();
  // 2) 子身:径向渐变,高光点在左上 30% 处
  ctx.globalAlpha = a;
  if (typeof ctx.createRadialGradient === "function") {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    if (kind === "black") {
      g.addColorStop(0, WQ_STONE.blackHi);
      g.addColorStop(1, WQ_STONE.blackLo);
    } else {
      g.addColorStop(0, WQ_STONE.whiteHi);
      g.addColorStop(1, WQ_STONE.whiteLo);
    }
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = kind === "black" ? "#2e2a24" : "#fbf8f0";
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  // 3) 白子:蛤碁石弧纹(2–3 道极淡米色弧线) + 一圈暖描边
  if (kind === "white") {
    ctx.strokeStyle = WQ_STONE.shellLine;
    ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = a * 0.15;
      ctx.lineWidth = Math.max(0.6, r * 0.07);
      ctx.beginPath();
      ctx.arc(x, y + r * (0.55 + k * 0.5), r * (0.82 + k * 0.42), -Math.PI * 0.78, -Math.PI * 0.24);
      ctx.stroke();
    }
    ctx.globalAlpha = a * 0.8;
    ctx.strokeStyle = WQ_STONE.whiteRim;
    ctx.lineWidth = Math.max(0.8, r * 0.05);
    ctx.beginPath();
    ctx.arc(x, y, r - Math.max(0.4, r * 0.025), 0, TAU);
    ctx.stroke();
  }
  // 4) 左上 20% 半径柔高光斑(压扁圆:变换 + 单位圆,替身没有 ellipse 也能画)
  ctx.globalAlpha = a * (kind === "black" ? 0.4 : 0.7);
  ctx.fillStyle = "#ffffff";
  ctx.save();
  ctx.translate(x - r * 0.38, y - r * 0.42);
  ctx.rotate(-0.6);
  ctx.scale(r * 0.28, r * 0.16);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** sprite 画布的逻辑边长:子径 + 投影与高光的出血边 */
export function stoneSpriteSize(r: number): number {
  return Math.ceil(r * 2 + Math.max(4, r * 0.4));
}

/** offscreen 画布的最小结构:index.ts 直接 drawImage 它 */
export interface SpriteCanvas {
  width: number;
  height: number;
}

type CanvasMaker = { createElement?: (tag: string) => unknown };

const spriteCache = new Map<string, SpriteCanvas>();

/** 测试与 resize 用:清空 sprite 缓存 */
export function resetStoneSprites(): void {
  spriteCache.clear();
}

/**
 * 黑白棋子的 offscreen sprite:按 `metrics.stone` 尺寸 + dpr 缓存,
 * resize(尺寸变了)自然换 key 重建。19 路满盘 361 子必须走 `drawImage`,
 * 不许逐子画渐变 —— 逐子渐变的兜底路径只留给拿不到 offscreen 画布的环境。
 */
export function stoneSprite(kind: StoneKind, r: number, ratio = 1): SpriteCanvas | null {
  if (!fin(r) || r <= 0) return null;
  const rr = fin(ratio) && ratio > 0 ? Math.min(4, ratio) : 1;
  const key = `${kind}:${Math.round(r * 4)}:${Math.round(rr * 4)}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const doc = (globalThis as { document?: CanvasMaker }).document;
  if (typeof doc?.createElement !== "function") return null;
  const canvas = doc.createElement("canvas") as (SpriteCanvas & { getContext?: (t: string) => ArtCtx | null }) | null;
  if (!canvas || typeof canvas.getContext !== "function") return null;
  const s = stoneSpriteSize(r);
  canvas.width = Math.ceil(s * rr);
  canvas.height = Math.ceil(s * rr);
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.save();
  g.scale(rr, rr);
  // 中心略上移,给 +1.5 的投影留出血
  paintStone(g, s / 2, s / 2 - 0.75, r, kind);
  g.restore();
  if (spriteCache.size >= 12) spriteCache.clear();
  spriteCache.set(key, canvas);
  return canvas;
}

// ---------------------------------------------------------------------------
// 提子花瓣:对象池 ≤ 16,黑子紫瓣、白子白瓣,飘起淡出
// ---------------------------------------------------------------------------

export const PETAL_POOL_MAX = 16;

/** 单颗花瓣寿命(秒),规格:0.35s */
export const PETAL_LIFE = 0.35;

export interface Petal {
  active: boolean;
  kind: StoneKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  /** 花朵基准半径(约等于被提那颗子的半径) */
  r: number;
  life: number;
  maxLife: number;
}

export interface PetalPool {
  readonly petals: readonly Petal[];
  /** 提一颗子喷一朵;reduced 或池满时不喷(返回 false) */
  spawn(x: number, y: number, kind: StoneKind, opts?: { reduced?: boolean; r?: number }): boolean;
  /** 推进 dt 秒;非法 / 非正 dt 不动 */
  step(dt: number): void;
  draw(ctx: ArtCtx): void;
  active(): number;
  idle(): boolean;
}

/** 一朵五瓣小花的纯路径(花瓣粒子与劫点标记共用) */
function paintBloom(ctx: ArtCtx, r: number, petalColor: string, coreColor: string): void {
  ctx.fillStyle = petalColor;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * TAU) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, r * 0.74, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.5, 0, TAU);
  ctx.fill();
}

/**
 * 花瓣对象池:固定 16 个槽位,提子时借一个、播完(0.35s)自动归还。
 * 速度用槽位序号推,完全确定,单测可复现。
 */
export function makePetalPool(): PetalPool {
  const petals: Petal[] = [];
  for (let i = 0; i < PETAL_POOL_MAX; i++) {
    petals.push({ active: false, kind: "black", x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, r: 8, life: 0, maxLife: PETAL_LIFE });
  }
  let seq = 0;
  const pool: PetalPool = {
    petals,
    spawn(x, y, kind, opts = {}) {
      if (opts.reduced === true) return false;
      if (!fin(x) || !fin(y)) return false;
      const slot = petals.find((p) => !p.active);
      if (!slot) return false;
      seq++;
      slot.active = true;
      slot.kind = kind;
      slot.x = x;
      slot.y = y;
      slot.vx = ((seq % 5) - 2) * 9;
      slot.vy = -(30 + (seq % 3) * 10);
      slot.rot = (seq % 7) * 0.4;
      slot.vr = seq % 2 === 0 ? 2.2 : -2.2;
      slot.r = fin(opts.r) && opts.r > 0 ? opts.r : 8;
      slot.maxLife = PETAL_LIFE;
      slot.life = PETAL_LIFE;
      return true;
    },
    step(dt) {
      if (!fin(dt) || dt <= 0) return;
      const d = Math.min(dt, 0.25);
      for (const p of petals) {
        if (!p.active) continue;
        p.life -= d;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        p.x += p.vx * d;
        p.y += p.vy * d;
        p.rot += p.vr * d;
      }
    },
    draw(ctx) {
      for (const p of petals) {
        if (!p.active) continue;
        const t = 1 - p.life / p.maxLife;
        const a = p.life / p.maxLife;
        ctx.save();
        // 前 45%:被提的子缩小(化瓣的「化」)
        if (t < 0.45) {
          ctx.globalAlpha = a * 0.9;
          ctx.fillStyle = p.kind === "black" ? WQ_STONE.blackLo : "#fbf8f0";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 - t / 0.45), 0, TAU);
          ctx.fill();
        }
        // 同步绽放的小花:飘起、旋转、淡出
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const bloom = p.r * 0.4 * (0.5 + 0.9 * t);
        paintBloom(ctx, bloom, PETAL_COLORS[p.kind], KIT_PALETTE.lemon);
        ctx.restore();
      }
    },
    active() {
      let n = 0;
      for (const p of petals) if (p.active) n++;
      return n;
    },
    idle() {
      return petals.every((p) => !p.active);
    }
  };
  return pool;
}

/** 便捷入口:直接把「t ∈ [0,1] 时刻的花瓣爆放」画在 (x, y)(给静态帧 / 演示用) */
export function drawPetalBurst(ctx: ArtCtx, x: number, y: number, t: number, kind: StoneKind = "black", r = 8): void {
  if (!fin(x) || !fin(y) || !fin(t)) return;
  const k = Math.max(0, Math.min(1, t));
  if (k >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - k;
  ctx.translate(x, y - k * r * 2.2);
  ctx.rotate(k * 1.6);
  paintBloom(ctx, r * 0.4 * (0.5 + 0.9 * k), PETAL_COLORS[kind], KIT_PALETTE.lemon);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 标记系统:形状通道区分(枫叶 / 发芽 / 小红花 / 圆角方框 / 叉纹)
// ---------------------------------------------------------------------------

/** 最后一手:小枫叶,贴在子的右上缘,不遮子中心 */
export function drawLeafMark(ctx: ArtCtx, x: number, y: number, r: number): void {
  if (!fin(x) || !fin(y) || !fin(r) || r <= 0) return;
  const s = r * 0.52;
  ctx.save();
  ctx.translate(x + r * 0.6, y - r * 0.6);
  ctx.rotate(0.35);
  ctx.fillStyle = "#d4574e";
  ctx.beginPath();
  ctx.moveTo(0, s * 0.6);
  ctx.lineTo(-s * 0.5, s * 0.16);
  ctx.lineTo(-s * 0.64, -s * 0.3);
  ctx.lineTo(-s * 0.2, -s * 0.18);
  ctx.lineTo(0, -s * 0.68);
  ctx.lineTo(s * 0.2, -s * 0.18);
  ctx.lineTo(s * 0.64, -s * 0.3);
  ctx.lineTo(s * 0.5, s * 0.16);
  if (typeof ctx.closePath === "function") ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade("#d4574e", 0.3);
  ctx.lineWidth = Math.max(0.8, s * 0.14);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, s * 0.55);
  ctx.lineTo(0, s * 0.95);
  ctx.stroke();
  ctx.restore();
}

/** 提示点:发芽小点(土点 + 茎 + 两片子叶),替代绿描边圆 */
export function drawSproutHint(ctx: ArtCtx, x: number, y: number, r: number): void {
  if (!fin(x) || !fin(y) || !fin(r) || r <= 0) return;
  const leaf = "#5fa35a";
  ctx.save();
  // 土点
  ctx.fillStyle = WQ_WOOD.grid;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.42, r * 0.16, 0, TAU);
  ctx.fill();
  // 茎
  ctx.strokeStyle = shade(leaf, 0.2);
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.4);
  ctx.quadraticCurveTo(x + r * 0.06, y, x, y - r * 0.28);
  ctx.stroke();
  // 两片子叶
  for (const [dx, rot] of [
    [-r * 0.26, -1.0],
    [r * 0.26, 1.0]
  ] as const) {
    ctx.save();
    ctx.translate(x + dx, y - r * 0.3);
    ctx.rotate(rot);
    ctx.scale(r * 0.3, r * 0.17);
    ctx.fillStyle = leaf;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** 劫争点:一朵小红花标记(替代纯圆圈) */
export function drawKoFlower(ctx: ArtCtx, x: number, y: number, r: number): void {
  if (!fin(x) || !fin(y) || !fin(r) || r <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.9;
  paintBloom(ctx, r * 0.34, KIT_PALETTE.coral, KIT_PALETTE.lemon);
  ctx.restore();
}

/** 键盘光标:圆角方框(与圆形提示区分,色弱友好),对比度契约见测试 */
export function drawCursorBox(ctx: ArtCtx, x: number, y: number, half: number): void {
  if (!fin(x) || !fin(y) || !fin(half) || half <= 0) return;
  const h = half;
  const c = Math.min(h * 0.4, 6);
  ctx.save();
  ctx.strokeStyle = CURSOR_COLOR;
  ctx.lineWidth = Math.max(2, h * 0.14);
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - h + c, y - h);
  ctx.lineTo(x + h - c, y - h);
  ctx.quadraticCurveTo(x + h, y - h, x + h, y - h + c);
  ctx.lineTo(x + h, y + h - c);
  ctx.quadraticCurveTo(x + h, y + h, x + h - c, y + h);
  ctx.lineTo(x - h + c, y + h);
  ctx.quadraticCurveTo(x - h, y + h, x - h, y + h - c);
  ctx.lineTo(x - h, y - h + c);
  ctx.quadraticCurveTo(x - h, y - h, x - h + c, y - h);
  ctx.stroke();
  ctx.restore();
}

/** 死子确认:在 0.35 透明之外再叠一道斜向叉纹(黑子白叉、白子墨叉) */
export function drawDeadCross(ctx: ArtCtx, x: number, y: number, r: number, kind: StoneKind): void {
  if (!fin(x) || !fin(y) || !fin(r) || r <= 0) return;
  const d = r * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = kind === "black" ? "#f5efe0" : KIT_PALETTE.ink;
  ctx.lineWidth = Math.max(1.2, r * 0.14);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - d, y - d);
  ctx.lineTo(x + d, y + d);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + d, y - d);
  ctx.lineTo(x - d, y + d);
  ctx.stroke();
  ctx.restore();
}

/** 落子落定的 4 根极短振纹线(soft / reducedMotion 关闭);k ∈ [0,1] 是振纹进度 */
export function drawPlaceRipple(ctx: ArtCtx, x: number, y: number, r: number, k: number): void {
  if (!fin(x) || !fin(y) || !fin(r) || r <= 0 || !fin(k)) return;
  const t = Math.max(0, Math.min(1, k));
  if (t >= 1) return;
  ctx.save();
  ctx.globalAlpha = (1 - t) * 0.5;
  ctx.strokeStyle = WQ_WOOD.grid;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.lineCap = "round";
  const inner = r * (1.05 + t * 0.25);
  const outer = inner + r * 0.22;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 数目铺色:0.6s 波纹从盘心扩散
// ---------------------------------------------------------------------------

/** 铺色总时长(ms) */
export const WASH_MS = 600;

/**
 * 领地铺色的波纹透明度:t ∈ [0,1] 是整体进度,dist 是该点离盘心的距离。
 * 波前扫过之后淡入到 1;t ≥ 1 时全盘铺满(reduced / 无动画环境直接传 1)。
 */
export function washAlpha(dist: number, maxDist: number, t: number): number {
  if (!fin(dist) || !fin(maxDist) || !fin(t)) return 0;
  if (t >= 1) return 1;
  if (t <= 0) return 0;
  const front = t * (maxDist + 1e-6) * 1.3;
  const k = (front - dist) / (maxDist * 0.3 + 1e-6);
  return Math.max(0, Math.min(1, k));
}

// ---------------------------------------------------------------------------
// 结算:奖杯 + 花园收成(纯字符串 SVG,DOM 层直接 innerHTML)
// ---------------------------------------------------------------------------

/** 目数差 → 收成小花数(≤ 20 朵;和棋 0 朵) */
export function harvestCount(diff: number): number {
  if (!fin(diff)) return 0;
  return Math.max(0, Math.min(20, Math.round(Math.abs(diff))));
}

/** 一只 Q 版奖杯:杯身渐层 + 双耳 + 底座 + 星星压印 */
export function trophySVG(size = 44): string {
  const s = fin(size) && size > 0 ? size : 44;
  const gold = KIT_PALETTE.starGold;
  const dark = shade(gold, 0.35);
  const lite = tint(gold, 0.55);
  return (
    `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">` +
    `<path d="M5 4 h14 v5 a7 7 0 0 1 -14 0 z" fill="${gold}" stroke="${dark}" stroke-width=".8"/>` +
    `<path d="M5 4 a3.4 3.4 0 1 0 1.4 8" fill="none" stroke="${dark}" stroke-width="1.6"/>` +
    `<path d="M19 4 a3.4 3.4 0 1 1 -1.4 8" fill="none" stroke="${dark}" stroke-width="1.6"/>` +
    `<ellipse cx="9" cy="6.4" rx="1.7" ry=".9" fill="${lite}" transform="rotate(-24 9 6.4)"/>` +
    `<polygon points="12,7.2 12.9,9 14.9,9.2 13.4,10.5 13.9,12.4 12,11.4 10.1,12.4 10.6,10.5 9.1,9.2 11.1,9" fill="${dark}"/>` +
    `<rect x="10.6" y="15.6" width="2.8" height="3" rx=".8" fill="${dark}"/>` +
    `<rect x="7.4" y="18.4" width="9.2" height="2.6" rx="1.2" fill="${KIT_PALETTE.woodDark}"/>` +
    `</svg>`
  );
}

/** 「花园收成」:目数差可视化成一排小花(≤ 20 朵),赢家什么色就开什么花 */
export function harvestFlowersSVG(diff: number, kind: StoneKind): string {
  const n = harvestCount(diff);
  if (n <= 0) return "";
  const petal = PETAL_COLORS[kind];
  const edge = kind === "white" ? WQ_STONE.whiteRim : shade(petal, 0.3);
  const cell = 14;
  const perRow = 10;
  const rows = Math.ceil(n / perRow);
  let body = "";
  for (let i = 0; i < n; i++) {
    const cx = (i % perRow) * cell + cell / 2;
    const cy = Math.floor(i / perRow) * cell + cell / 2;
    let petals = "";
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * TAU) / 5;
      petals += `<circle cx="${(cx + Math.cos(a) * 3.1).toFixed(1)}" cy="${(cy + Math.sin(a) * 3.1).toFixed(1)}" r="2.4" fill="${petal}" stroke="${edge}" stroke-width=".4"/>`;
    }
    body += `${petals}<circle cx="${cx}" cy="${cy}" r="1.7" fill="${KIT_PALETTE.lemon}"/>`;
  }
  const w = Math.min(n, perRow) * cell;
  const h = rows * cell;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${body}</svg>`;
}

/** 目数对比双色条:黑白各占多少 %(两边都是 0 时对半分) */
export function scoreBarParts(black: number, white: number): { black: number; white: number } {
  const b = fin(black) && black > 0 ? black : 0;
  const w = fin(white) && white > 0 ? white : 0;
  const sum = b + w;
  if (sum <= 0) return { black: 50, white: 50 };
  const bp = Math.round((b / sum) * 100);
  return { black: bp, white: 100 - bp };
}
