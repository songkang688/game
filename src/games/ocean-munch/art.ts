/**
 * 海底大胃王 · 1.3 视觉模块(纯函数,不碰任何玩法数值)。
 *
 * 仓库还没有共享 `src/art/kit/`,按 visual-bible 第四节的兜底约定,
 * 这一款的水下三件套(光柱 / 气泡 / 景深)与鱼身材质都收在这里:
 * 全部是「给一个 ctx 就画」或「给个时间就算」的纯函数,
 * `art.test.ts` 用记录型 ctx 桩逐条断言绘制序列与动画公式。
 *
 * 红线备忘:
 * - 判定与成长数值一律不在这里——这里只有像素;
 * - `reduced`(prefers-reduced-motion)贯穿所有会动的东西:光柱静止、
 *   摆尾减半、粒子砍半、弹性缩放退化为不缩放;
 * - 所有脉动频率 ≤ 3Hz;
 * - 毒藻鱼除颜色外必须有形状通道(绿色气泡光环),色弱也认得出。
 */

/* ------------------------------------------------------------------ */
/* 色彩工具                                                            */
/* ------------------------------------------------------------------ */

/** `#rrggbb` 合法性(素材契约测试用)。 */
export function isHexColor(c: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(c);
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = isHexColor(hex) ? hex : "#8fc8e8";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const p = (v: number) => clamp255(v).toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`;
}

/** 加深 / 提亮:amt ∈ [-1, 1],负数往黑走、正数往白走,始终返回合法 `#rrggbb`。 */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const k = Math.max(-1, Math.min(1, amt));
  const mix = (v: number) => (k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return rgbToHex(mix(r), mix(g), mix(b));
}

/** 两个 `#rrggbb` 之间线性插值(跨区背景色 1s 过渡用)。 */
export function lerpColor(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
}

/* ------------------------------------------------------------------ */
/* 画质分档与粒子上限                                                  */
/* ------------------------------------------------------------------ */

export type Quality = "high" | "low";

/** 窄屏 / 低端机先砍装饰层:最短边不足 480 就走低档。 */
export function qualityFor(w: number, h: number): Quality {
  return Math.min(w, h) >= 480 ? "high" : "low";
}

/** 低画质档:前景层与远景层都不画(光柱与深水罩保留,便宜)。 */
export function layerToggles(q: Quality): { far: boolean; fore: boolean } {
  const on = q === "high";
  return { far: on, fore: on };
}

/** 上浮气泡对象池上限 ≤ 24;低档减半,`reduced` 再减半。 */
export function bubbleCap(q: Quality, reduced: boolean): number {
  const base = q === "high" ? 24 : 12;
  return reduced ? Math.floor(base / 2) : base;
}

/** 吞吃瞬间冒几颗气泡:常规 3 颗,`reduced` 砍半。 */
export function eatBubbleCount(reduced: boolean): number {
  return reduced ? 1 : 3;
}

/* ------------------------------------------------------------------ */
/* 运动公式(全部纯函数,便于契约测试)                                */
/* ------------------------------------------------------------------ */

const DEG = Math.PI / 180;

/** 尾鳍摆动角:±12°,`reduced` 幅度减半。频率约 1.1Hz。 */
export function tailWag(t: number, reduced: boolean): number {
  const amp = (reduced ? 6 : 12) * DEG;
  return Math.sin(t * Math.PI * 2 * 1.1) * amp;
}

/** 胸鳍每 0.4s 摆一帧(0.8s 一个来回),`reduced` 减半。 */
export function finWag(t: number, reduced: boolean): number {
  const amp = (reduced ? 9 : 18) * DEG;
  return Math.sin((t * Math.PI * 2) / 0.8) * amp;
}

/** 光柱缓慢摆动 ±3°;`reduced` 一律静止(返回 0)。 */
export function shaftSway(t: number, i: number, reduced: boolean): number {
  if (reduced) return 0;
  return Math.sin(t * 0.4 + i * 1.7) * 3 * DEG;
}

/** 水母伞缘发光点的呼吸(0.3Hz);`reduced` 静态常亮。 */
export function jellyGlowPulse(t: number, i: number, reduced: boolean): number {
  if (reduced) return 0.6;
  return 0.45 + 0.3 * Math.sin(t * 1.9 + i * 0.8);
}

/** 毒藻鱼光环的缓慢脉动(约 0.25Hz);`reduced` 静态。 */
export function toxinAuraPulse(t: number, reduced: boolean): number {
  if (reduced) return 0.62;
  return 0.5 + 0.3 * Math.sin(t * 1.6);
}

/**
 * 河豚鼓起的弹性过冲:0→0.15s 冲到 1.65 倍,0.3s 回落停在 1.5 倍。
 * `reduced` 不过冲,直接 1.5。传入「鼓起后过了几秒」,没鼓起(负数)返回 1。
 */
export function pufferInflateScale(sinceInflate: number, reduced: boolean): number {
  if (sinceInflate < 0) return 1;
  if (reduced) return 1.5;
  if (sinceInflate < 0.15) return 1 + (0.65 * sinceInflate) / 0.15;
  if (sinceInflate < 0.3) return 1.65 - (0.15 * (sinceInflate - 0.15)) / 0.15;
  return 1.5;
}

/** 成长升档演出总时长(秒)。 */
export const GROW_FX_S = 0.55;

/**
 * 吃大变强的那一下:一圈金光扩散 + 1.15 倍弹性缩放。
 * `reduced` 只留金光淡出,不缩放。
 */
export function growFx(
  t: number,
  reduced: boolean,
): { ring01: number; ringAlpha: number; scale: number; done: boolean } {
  const p = Math.max(0, Math.min(1, t / GROW_FX_S));
  const scale = reduced ? 1 : 1 + 0.15 * Math.sin(Math.min(1, p * 1.25) * Math.PI);
  return { ring01: p, ringAlpha: (1 - p) * 0.85, scale, done: t >= GROW_FX_S };
}

/** 吞吃瞬间嘴巴张大一帧:咬下去后 120ms 内张开、随即闭上。 */
export const MOUTH_OPEN_MS = 120;

export function mouthOpen01(sinceBiteMs: number): number {
  if (sinceBiteMs < 0 || sinceBiteMs >= MOUTH_OPEN_MS) return 0;
  return 1 - sinceBiteMs / MOUTH_OPEN_MS;
}

/** 实体深水罩:y 超过屏高 70% 才有,alpha 0.08。 */
export function depthTintAlpha(y: number, h: number): number {
  if (h <= 0 || y < h * 0.7) return 0;
  return 0.08;
}

/* ------------------------------------------------------------------ */
/* BOSS 演出节点                                                       */
/* ------------------------------------------------------------------ */

/** BOSS 从阴影里游出来要多久(剪影→实体渐变)。 */
export const BOSS_INTRO_S = 0.8;
/** 进场暗角持续多久。 */
export const BOSS_VIGNETTE_S = 0.5;

/**
 * BOSS 进场:前 0.5s 屏幕边缘暗角,0.8s 内从剪影渐变成实体。
 * 结束后所有量归零 / 归一,`done` 为 true,演出状态可以清理。
 */
export function bossEntrance(
  t: number,
  reduced: boolean,
): { alpha: number; silhouette: number; vignette: number; done: boolean } {
  const p = Math.max(0, Math.min(1, t / BOSS_INTRO_S));
  const vig =
    t >= BOSS_VIGNETTE_S ? 0 : (reduced ? 0.18 : 0.3) * (1 - t / BOSS_VIGNETTE_S);
  return { alpha: 0.2 + 0.8 * p, silhouette: 1 - p, vignette: vig, done: t >= BOSS_INTRO_S };
}

/** BOSS 战败演出总时长:翻白肚缓沉。 */
export const BOSS_DEFEAT_S = 1.6;

/** 击败:身体翻转(最终肚皮朝上)、往下缓沉、慢慢淡出。卡通,无任何受伤描写。 */
export function bossDefeat(t: number): { rot: number; sink01: number; alpha: number; done: boolean } {
  const p = Math.max(0, Math.min(1, t / BOSS_DEFEAT_S));
  return { rot: Math.PI * Math.min(1, p * 1.6), sink01: p * p, alpha: 1 - p * 0.55, done: t >= BOSS_DEFEAT_S };
}

/* ------------------------------------------------------------------ */
/* 吞吃「旋入嘴」粒子池                                                */
/* ------------------------------------------------------------------ */

/** 被吞的那条鱼缩小旋入嘴要多久(秒)。 */
export const SWIRL_LIFE = 0.2;
/** 旋入粒子池上限:同屏最多这么多条「正被吞」的残影。 */
export const SWIRL_CAP = 8;

export interface Swirl {
  x: number;
  y: number;
  /** 吞它的那张嘴当时在哪 */
  tx: number;
  ty: number;
  r: number;
  color: string;
  t: number;
}

/** 池满了就回收最老的一条——不无限增长。 */
export function spawnSwirl(
  pool: Swirl[],
  x: number,
  y: number,
  r: number,
  color: string,
  tx: number,
  ty: number,
): void {
  if (pool.length >= SWIRL_CAP) pool.shift();
  pool.push({ x, y, tx, ty, r, color, t: 0 });
}

/** 每帧推进,寿命到了的原地回收。 */
export function stepSwirls(pool: Swirl[], dt: number): void {
  for (let i = pool.length - 1; i >= 0; i--) {
    pool[i].t += dt;
    if (pool[i].t >= SWIRL_LIFE) pool.splice(i, 1);
  }
}

/** 这一帧残影画在哪、多大、转了多少:`reduced` 不旋转只缩小淡出。 */
export function swirlPose(
  s: Swirl,
  reduced: boolean,
): { x: number; y: number; scale: number; rot: number; alpha: number } {
  const p = Math.max(0, Math.min(1, s.t / SWIRL_LIFE));
  return {
    x: s.x + (s.tx - s.x) * p,
    y: s.y + (s.ty - s.y) * p,
    scale: 1 - p * 0.85,
    rot: reduced ? 0 : p * Math.PI * 2,
    alpha: 1 - p * 0.7,
  };
}

/* ------------------------------------------------------------------ */
/* 头饰(玩家标识:形状 + 颜色双通道)                                  */
/* ------------------------------------------------------------------ */

export type Headdress = "crown" | "star" | "none";

/** P1 金冠。 */
export const CROWN_GOLD = "#ffd868";
export const CROWN_GOLD_DARK = "#d9a832";
/** P2 / 对手银星。 */
export const STAR_SILVER = "#e8eef8";
export const STAR_SILVER_DARK = "#9fb0c8";

type Ctx = CanvasRenderingContext2D;

/** 金冠:三个尖 + 底边描一道暗金,戴在头顶。 */
export function drawCrown(ctx: Ctx, r: number): void {
  ctx.fillStyle = CROWN_GOLD;
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.62);
  ctx.lineTo(-r * 0.15, -r * 1.02);
  ctx.lineTo(r * 0.05, -r * 0.68);
  ctx.lineTo(r * 0.25, -r * 1.02);
  ctx.lineTo(r * 0.45, -r * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = CROWN_GOLD_DARK;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.62);
  ctx.lineTo(r * 0.45, -r * 0.62);
  ctx.stroke();
}

/** 银星头饰:一颗五角星 + 发带,和金冠形状颜色都不同。 */
export function drawStarBand(ctx: Ctx, r: number): void {
  ctx.strokeStyle = STAR_SILVER_DARK;
  ctx.lineWidth = Math.max(1.2, r * 0.09);
  ctx.beginPath();
  ctx.arc(0, -r * 0.1, r * 0.72, -Math.PI * 0.78, -Math.PI * 0.22);
  ctx.stroke();
  const cx = r * 0.05;
  const cy = -r * 0.92;
  const outer = r * 0.3;
  const inner = outer * 0.45;
  ctx.fillStyle = STAR_SILVER;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = STAR_SILVER_DARK;
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.stroke();
}

/* ------------------------------------------------------------------ */
/* 鱼身(双色渐变 + 鳞纹 + 背鳍胸鳍 + 两叉尾 + 表情)                    */
/* ------------------------------------------------------------------ */

export interface FishLook {
  r: number;
  /** 基准色,背腹两档由它生成 */
  color: string;
  /** 动画时间(秒),游动摆尾 / 胸鳍 / 眨眼都从这走 */
  t: number;
  reduced: boolean;
  head: Headdress;
  /** 0..1:吞吃瞬间嘴张多大 */
  mouth?: number;
}

/** 每 3.4s 眨一次眼,每次 0.14s(约 0.3Hz,远低于 3Hz 红线)。 */
export function eyeOpen01(t: number): number {
  const cycle = t % 3.4;
  if (cycle < 0.14) return Math.abs(cycle / 0.07 - 1);
  return 1;
}

/**
 * 画一条朝 +x 的鱼(调用方负责 translate / scale(facing) )。
 * 结构:两叉摆动尾鳍 → 渐变身体 → 白肚 → 鳞纹三道 → 背鳍 → 胸鳍 →
 * 眼(会眨)→ 嘴(吃到东西那一帧张大)→ 腮红 → 头饰。
 */
export function drawFishBody(ctx: Ctx, o: FishLook): void {
  const { r, color, t, reduced } = o;
  const back = shade(color, -0.24);
  const belly = shade(color, 0.38);
  const dark = shade(color, -0.4);

  // 两叉弧形尾鳍,绕尾根摆 ±12°(reduced 减半)
  const wag = tailWag(t, reduced);
  ctx.save();
  ctx.translate(-r * 0.78, 0);
  ctx.rotate(wag);
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-r * 0.55, -r * 0.28, -r * 0.82, -r * 0.62);
  ctx.quadraticCurveTo(-r * 0.5, -r * 0.08, -r * 0.42, 0);
  ctx.quadraticCurveTo(-r * 0.5, r * 0.08, -r * 0.82, r * 0.62);
  ctx.quadraticCurveTo(-r * 0.55, r * 0.28, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 身体:背深腹浅的双色渐变
  const g = ctx.createLinearGradient(0, -r * 0.72, 0, r * 0.72);
  g.addColorStop(0, back);
  g.addColorStop(0.55, color);
  g.addColorStop(1, belly);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  // 白肚高光
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.28, r * 0.68, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // 三片弧形鳞纹(极淡)
  ctx.strokeStyle = dark;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = Math.max(1, r * 0.06);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-r * 0.5 + i * r * 0.34, -r * 0.05, r * 0.34, -Math.PI * 0.35, Math.PI * 0.35);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 背鳍
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, -r * 0.58);
  ctx.quadraticCurveTo(-r * 0.1, -r * 1.02, r * 0.26, -r * 0.6);
  ctx.quadraticCurveTo(-r * 0.08, -r * 0.7, -r * 0.42, -r * 0.58);
  ctx.closePath();
  ctx.fill();

  // 胸鳍:0.4s 摆一帧
  ctx.save();
  ctx.translate(r * 0.02, r * 0.22);
  ctx.rotate(finWag(t, reduced) + 0.5);
  ctx.fillStyle = shade(color, -0.12);
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.2, r * 0.18, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // 眼睛(带高光,会眨)
  const open = eyeOpen01(t);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(r * 0.45, -r * 0.18, r * 0.2, r * 0.2 * Math.max(0.12, open), 0, 0, Math.PI * 2);
  ctx.fill();
  if (open > 0.3) {
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(r * 0.5, -r * 0.18, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(r * 0.54, -r * 0.22, r * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }

  // 嘴:平时一道微笑弧,吞吃那一帧张成小圆
  const mouth = o.mouth ?? 0;
  if (mouth > 0.05) {
    ctx.fillStyle = "#5a3a4a";
    ctx.beginPath();
    ctx.ellipse(r * 0.78, r * 0.08, r * 0.16 * (0.5 + mouth * 0.7), r * 0.2 * (0.4 + mouth), 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(1.2, r * 0.07);
    ctx.beginPath();
    ctx.arc(r * 0.45, r * 0.15, r * 0.18, 0.1 * Math.PI, 0.7 * Math.PI);
    ctx.stroke();
  }

  // 腮红(Q 版脸)
  ctx.fillStyle = "rgba(255,150,160,0.25)";
  ctx.beginPath();
  ctx.ellipse(r * 0.3, r * 0.12, r * 0.13, r * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  if (o.head === "crown") drawCrown(ctx, r);
  else if (o.head === "star") drawStarBand(ctx, r);
}

/* ------------------------------------------------------------------ */
/* 毒藻鱼光环 / 精英鱼星辉(形状通道,不只靠颜色)                        */
/* ------------------------------------------------------------------ */

/** 危险绿:毒藻鱼光环专用。 */
export const TOXIN_AURA = "#6ee68c";

/** 一圈危险绿气泡光环,缓慢脉动;`reduced` 静态。这就是「不能吃」的形状语言。 */
export function drawToxinAura(ctx: Ctx, x: number, y: number, r: number, t: number, reduced: boolean): void {
  const pulse = toxinAuraPulse(t, reduced);
  const ringR = r * (1.32 + (reduced ? 0 : Math.sin(t * 1.6) * 0.06));
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = TOXIN_AURA;
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.beginPath();
  ctx.arc(x, y, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = TOXIN_AURA;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 + (reduced ? 0 : t * 0.5);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * ringR, y + Math.sin(a) * ringR, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** 精英鱼头顶的四芒星辉(替代字符占位)。 */
export function drawSparkle(ctx: Ctx, x: number, y: number, r: number, t: number, reduced: boolean): void {
  const rot = reduced ? 0 : t * 0.9;
  const glow = reduced ? 0.7 : 0.55 + 0.3 * Math.sin(t * 2.4);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = glow;
  ctx.fillStyle = "#fff3c2";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.32;
    const a = (Math.PI * i) / 4;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 水体三件套:渐变水、光柱、气泡                                       */
/* ------------------------------------------------------------------ */

/** 深度着色的水体:顶浅底深,底部再压一档(越深越暗)。 */
export function drawUnderwaterBackdrop(ctx: Ctx, w: number, h: number, top: string, bottom: string): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(0.6, bottom);
  g.addColorStop(1, shade(bottom, -0.22));
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, w + 40, h + 40);
}

/** 单道斜光柱:白 8% → 透明的线性渐变梯形,sway 是这一帧的摆角(弧度)。 */
export function drawLightShaft(ctx: Ctx, x: number, topW: number, h: number, sway: number, alpha: number): void {
  const slant = Math.tan(0.22 + sway) * h;
  const g = ctx.createLinearGradient(x, 0, x + slant * 0.4, h);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - topW / 2, 0);
  ctx.lineTo(x + topW / 2, 0);
  ctx.lineTo(x + topW * 1.4 + slant, h);
  ctx.lineTo(x - topW * 1.4 + slant, h);
  ctx.closePath();
  ctx.fill();
}

/** 水面向下的 4 道斜光柱;`reduced` 时全部静止。 */
export function drawLightShafts(ctx: Ctx, w: number, h: number, t: number, reduced: boolean): void {
  for (let i = 0; i < 4; i++) {
    const x = w * (0.12 + i * 0.24);
    drawLightShaft(ctx, x, w * 0.05 + 18, h, shaftSway(t, i, reduced), 0.08);
  }
}

/** 一颗有体积的气泡:淡填充 + 描边 + 左上高光弧。 */
export function drawBubble(ctx: Ctx, x: number, y: number, r: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(220,240,255,0.25)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, Math.PI * 0.8, Math.PI * 1.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 远景 / 前景视差层                                                    */
/* ------------------------------------------------------------------ */

/** 一株剪影水草:底部锚定,随时间轻摆。 */
export function drawSeaweed(
  ctx: Ctx,
  x: number,
  baseY: number,
  height: number,
  width: number,
  t: number,
  color: string,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  const steps = 5;
  for (let s = 0; s <= steps; s++) {
    const yy = baseY - (height * s) / steps;
    const sway = Math.sin(t + s * 0.9) * width * 0.55 * (s / steps);
    if (s === 0) ctx.moveTo(x, yy);
    else ctx.quadraticCurveTo(x + sway, yy + height / steps / 2, x + sway, yy);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** 远景小鱼剪影(纯装饰,非实体)。 */
function drawFarFish(ctx: Ctx, x: number, y: number, r: number, dir: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(20,40,70,0.7)";
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - dir * r * 0.9, y);
  ctx.lineTo(x - dir * r * 1.5, y - r * 0.4);
  ctx.lineTo(x - dir * r * 1.5, y + r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * 远景层:深色剪影水草 / 礁石 + 2–3 条远景小鱼剪影。
 * `off` 是视差偏移(跟镜头 0.3);`reduced` 时水草静止。
 */
export function drawFarLayer(ctx: Ctx, w: number, h: number, t: number, off: number, reduced: boolean): void {
  const sway = reduced ? 0 : t * 0.9;
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#12324e";
  ctx.beginPath();
  ctx.ellipse(w * 0.18 + off, h + 26, w * 0.2, h * 0.16, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.82 + off, h + 30, w * 0.24, h * 0.2, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  for (let i = 0; i < 4; i++) {
    drawSeaweed(ctx, w * (0.08 + i * 0.27) + off, h + 6, h * (0.14 + (i % 2) * 0.07), 10, sway + i, "#173a58", 0.18);
  }
  for (let i = 0; i < 3; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const fx = ((t * 9 * dir + i * 190) % (w + 120) + w + 120) % (w + 120) - 60;
    drawFarFish(ctx, fx + off * 0.6, h * (0.16 + i * 0.14), 9 + i * 3, dir, 0.35);
  }
}

/**
 * 前景层:3 株近景大剪影水草(半透明 35%,视差 1.3)+ 2 颗大而虚的前景泡。
 * 只贴屏幕左右下角,360 宽也不会挡住画面中央的鱼与触控。
 */
export function drawForeLayer(ctx: Ctx, w: number, h: number, t: number, off: number, reduced: boolean): void {
  const sway = reduced ? 0 : t * 1.1;
  drawSeaweed(ctx, w * 0.04 + off, h + 12, h * 0.34, 26, sway, "#0e2c46", 0.35);
  drawSeaweed(ctx, w * 0.1 + off, h + 18, h * 0.24, 20, sway + 2.1, "#123a56", 0.35);
  drawSeaweed(ctx, w * 0.95 + off, h + 12, h * 0.3, 24, sway + 4.2, "#0e2c46", 0.35);
  const bobY = reduced ? 0 : Math.sin(t * 0.7) * 8;
  drawBubble(ctx, w * 0.08 + off, h * 0.3 + bobY, 16, 0.16);
  drawBubble(ctx, w * 0.93 + off, h * 0.62 - bobY, 20, 0.14);
}

/** 深水罩:屏高 70% 以下叠一层极淡蓝,低成本的深度感。 */
export function drawDepthTint(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, h * 0.7, 0, h);
  g.addColorStop(0, "rgba(20,40,90,0)");
  g.addColorStop(1, "rgba(20,40,90,0.12)");
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
}

/* ------------------------------------------------------------------ */
/* 收集物(星星 / 护盾):边缘厚度 + 高光 + 内圈细节                     */
/* ------------------------------------------------------------------ */

/** 收集星:底层厚边(暗金错位)+ 亮金星面 + 内圈小星 + 高光点。 */
export function drawCollectStar(ctx: Ctx, x: number, y: number, r: number, t: number, reduced: boolean): void {
  const bob = reduced ? 0 : Math.sin(t * 2.4) * r * 0.12;
  const star = (cx: number, cy: number, outer: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? outer : outer * 0.46;
      const a = -Math.PI / 2 + (Math.PI * i) / 5;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };
  star(x, y + bob + r * 0.12, r, "#d9a832");
  star(x, y + bob, r, "#ffd868");
  star(x, y + bob, r * 0.5, "#fff3c2");
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(x - r * 0.28, y + bob - r * 0.32, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

/** 护盾泡泡:大气泡里一面小盾(顶宽底尖,两阶蓝 + 高光)。 */
export function drawShieldBadge(ctx: Ctx, x: number, y: number, r: number, alpha: number): void {
  drawBubble(ctx, x, y, r, alpha);
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(0, -r * 0.55, 0, r * 0.6);
  g.addColorStop(0, "#9fc6ff");
  g.addColorStop(1, "#4a7ac9");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, -r * 0.4);
  ctx.lineTo(r * 0.42, -r * 0.4);
  ctx.lineTo(r * 0.42, r * 0.05);
  ctx.quadraticCurveTo(r * 0.42, r * 0.42, 0, r * 0.58);
  ctx.quadraticCurveTo(-r * 0.42, r * 0.42, -r * 0.42, r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#2f5a9e";
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.14, -r * 0.14, r * 0.12, r * 0.22, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 顶部大标题的自适应字号(visual-r1 修 A 档 P-01):
 * 从 basePx 逐级往下试,直到 measure(px) 宽度塞得进 avail 或到 minPx 兜底。
 * 纯函数,measure 由调用方给(实机是 ctx.measureText,测试给线性桩)。
 */
export function titleFitPx(
  measure: (px: number) => number,
  basePx: number,
  minPx: number,
  avail: number,
): number {
  let px = basePx;
  while (px > minPx && measure(px) > avail) px -= 1;
  return px;
}

/** BOSS 进场暗角:四边压暗一圈,力度由 `bossEntrance().vignette` 给。 */
export function drawVignette(ctx: Ctx, w: number, h: number, strength: number): void {
  if (strength <= 0) return;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, "rgba(8,12,30,0)");
  g.addColorStop(1, `rgba(8,12,30,${Math.min(0.6, strength)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
