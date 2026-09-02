/**
 * 共享美术套件 · 星屑 / 丝带 / 花瓣粒子（1.3 视觉升级）。
 *
 * 「命中爆彩纸」的升级版弹药库：
 * - 星屑 sparkle：8–12 颗小星片，300ms 抛物线散开（easeOutQuad 淡出）；
 * - 丝带 ribbon：3 条细纸带，420ms 螺旋飘落（easeOutCubic 淡出）；
 * - 花瓣 petal：误击花朵时的温柔反馈，480ms 左右摇着落（easeOutSine 淡出）。
 *
 * 数量、寿命、重力全部参数化，随机源可注入（运行时 Math.random、用例定序随机），
 * 状态推进（`stepParticles`）与绘制（`drawParticles`）分离，纯函数无 DOM。
 * `prefers-reduced-motion` 的降级由调用方决定「不生成」，本模块不查媒体特性。
 */

// ---------------------------------------------------------------------------
// 缓动（毫秒时序表统一引用这几条曲线）
// ---------------------------------------------------------------------------

export function easeOutQuad(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return 1 - (1 - t) * (1 - t);
}

export function easeOutCubic(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return 1 - (1 - t) ** 3;
}

export function easeOutSine(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return Math.sin((t * Math.PI) / 2);
}

/** easeOutBack：轻微过冲再落定，给「金环扩散」这类强调动效用 */
export function easeOutBack(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

// ---------------------------------------------------------------------------
// 粒子形状
// ---------------------------------------------------------------------------

export type ParticleKind = "sparkle" | "ribbon" | "petal";

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 每秒往下坠多少（抛物线的那个 g） */
  g: number;
  /** 还能活几秒 */
  life: number;
  /** 总寿命（秒） */
  max: number;
  color: string;
  size: number;
  /** 自转 / 螺旋角速度（弧度每秒） */
  spin: number;
  /** 初始相位 */
  phase: number;
}

export interface BurstOpts {
  count?: number;
  lifeMs?: number;
  gravity?: number;
  speed?: number;
  colors?: string[];
  size?: number;
  rand?: () => number;
}

/** 星屑一炮几颗（下限） */
export const SPARKLE_COUNT_MIN = 8;
/** 星屑一炮几颗（上限） */
export const SPARKLE_COUNT_MAX = 12;
/** 星屑寿命（毫秒） */
export const SPARKLE_LIFE_MS = 300;
/** 星屑抛物线重力（逻辑单位 / 秒²） */
export const SPARKLE_GRAVITY = 620;

/** 丝带一炮几条 */
export const RIBBON_COUNT = 3;
/** 丝带寿命（毫秒） */
export const RIBBON_LIFE_MS = 420;
/** 丝带下落重力（比星屑轻，飘着落） */
export const RIBBON_GRAVITY = 240;

/** 花瓣一炮几片 */
export const PETAL_COUNT = 6;
/** 花瓣寿命（毫秒） */
export const PETAL_LIFE_MS = 480;
/** 花瓣下落重力（最轻，摇着落） */
export const PETAL_GRAVITY = 150;

const FALLBACK_COLORS = ["#FFD678", "#FF9FBE", "#9BD9F5"];

function pick(colors: string[], i: number): string {
  return colors.length > 0 ? colors[i % colors.length] : FALLBACK_COLORS[i % FALLBACK_COLORS.length];
}

/** 星屑：抛物线四散的小星片 */
export function spawnSparkles(x: number, y: number, opts: BurstOpts = {}): Particle[] {
  const rand = opts.rand ?? Math.random;
  const colors = opts.colors ?? FALLBACK_COLORS;
  const span = SPARKLE_COUNT_MAX - SPARKLE_COUNT_MIN;
  const count = Math.max(0, Math.round(opts.count ?? SPARKLE_COUNT_MIN + rand() * span));
  const life = Math.max(0.01, (opts.lifeMs ?? SPARKLE_LIFE_MS) / 1000);
  const g = opts.gravity ?? SPARKLE_GRAVITY;
  const speed = opts.speed ?? 260;
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / Math.max(1, count)) * Math.PI * 2 + rand() * 0.8;
    const v = speed * (0.6 + rand() * 0.5);
    out.push({
      kind: "sparkle",
      x,
      y,
      vx: Math.cos(ang) * v,
      // 往上抛一点再落下来,抛物线才立得住
      vy: Math.sin(ang) * v * 0.7 - speed * 0.35,
      g,
      life,
      max: life,
      color: pick(colors, i),
      size: (opts.size ?? 5) * (0.75 + rand() * 0.5),
      spin: (rand() - 0.5) * 12,
      phase: rand() * Math.PI * 2,
    });
  }
  return out;
}

/** 丝带：螺旋着飘落的细纸带 */
export function spawnRibbons(x: number, y: number, opts: BurstOpts = {}): Particle[] {
  const rand = opts.rand ?? Math.random;
  const colors = opts.colors ?? FALLBACK_COLORS;
  const count = Math.max(0, Math.round(opts.count ?? RIBBON_COUNT));
  const life = Math.max(0.01, (opts.lifeMs ?? RIBBON_LIFE_MS) / 1000);
  const g = opts.gravity ?? RIBBON_GRAVITY;
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      kind: "ribbon",
      x,
      y,
      vx: (rand() - 0.5) * 90,
      vy: -40 - rand() * 50,
      g,
      life,
      max: life,
      color: pick(colors, i),
      size: (opts.size ?? 9) * (0.85 + rand() * 0.3),
      spin: 7 + rand() * 5,
      phase: rand() * Math.PI * 2,
    });
  }
  return out;
}

/** 花瓣：左右摇着慢慢落（误击花朵靶的温柔反馈,不批评） */
export function spawnPetals(x: number, y: number, opts: BurstOpts = {}): Particle[] {
  const rand = opts.rand ?? Math.random;
  const colors = opts.colors ?? ["#FFC2DA", "#FFD1E4", "#F7A9C9"];
  const count = Math.max(0, Math.round(opts.count ?? PETAL_COUNT));
  const life = Math.max(0.01, (opts.lifeMs ?? PETAL_LIFE_MS) / 1000);
  const g = opts.gravity ?? PETAL_GRAVITY;
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      kind: "petal",
      x: x + (rand() - 0.5) * 18,
      y,
      vx: (rand() - 0.5) * 46,
      vy: 8 + rand() * 26,
      g,
      life,
      max: life,
      color: pick(colors, i),
      size: (opts.size ?? 7) * (0.85 + rand() * 0.35),
      spin: 2.2 + rand() * 2.4,
      phase: rand() * Math.PI * 2,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 推进与绘制
// ---------------------------------------------------------------------------

/** 走一步：位置按速度 + 重力积分，寿命递减；活着的留下（返回新数组，不改旧的） */
export function stepParticles(list: Particle[], dt: number): Particle[] {
  const d = Math.max(0, dt);
  const out: Particle[] = [];
  for (const p of list) {
    const life = p.life - d;
    if (life <= 0) continue;
    out.push({
      ...p,
      x: p.x + p.vx * d,
      y: p.y + p.vy * d,
      vy: p.vy + p.g * d,
      phase: p.phase + p.spin * d,
      life,
    });
  }
  return out;
}

/** 0..1 的年龄进度（0 = 刚出生） */
export function particleAge(p: Particle): number {
  return Math.max(0, Math.min(1, 1 - p.life / p.max));
}

function drawSparkle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const k = particleAge(p);
  ctx.globalAlpha = Math.max(0, 1 - easeOutQuad(k));
  ctx.translate(p.x, p.y);
  ctx.rotate(p.phase);
  ctx.fillStyle = p.color;
  // 四角小星片:两个交叠的细菱形
  const s = p.size;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.3, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.3, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.lineTo(0, s * 0.3);
  ctx.lineTo(s, 0);
  ctx.lineTo(0, -s * 0.3);
  ctx.closePath();
  ctx.fill();
}

function drawRibbon(ctx: CanvasRenderingContext2D, p: Particle): void {
  const k = particleAge(p);
  // 螺旋:绕着自己的下落轴打圈,半径随年龄慢慢张开
  const swirl = 6 + easeOutCubic(k) * 14;
  ctx.globalAlpha = Math.max(0, 1 - easeOutCubic(k));
  ctx.translate(p.x + Math.cos(p.phase) * swirl, p.y + Math.sin(p.phase) * swirl * 0.5);
  ctx.rotate(p.phase);
  ctx.fillStyle = p.color;
  ctx.fillRect(-p.size, -p.size * 0.22, p.size * 2, p.size * 0.44);
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Particle): void {
  const k = particleAge(p);
  // 左右摇着落,摆幅走 easeOutSine
  const sway = Math.sin(p.phase) * 10 * easeOutSine(k);
  ctx.globalAlpha = Math.max(0, 1 - easeOutSine(k));
  ctx.translate(p.x + sway, p.y);
  ctx.rotate(Math.sin(p.phase) * 0.6);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.size, p.size * 0.62, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

/** 把一批粒子画出来（调用方管图层序,这里只管一颗一颗画） */
export function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]): void {
  for (const p of list) {
    ctx.save();
    if (p.kind === "sparkle") drawSparkle(ctx, p);
    else if (p.kind === "ribbon") drawRibbon(ctx, p);
    else drawPetal(ctx, p);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** 窗口 8：CSS 星屑（不碰 DOM，只算轨迹和 keyframes） */
export const SPARK_COUNT = 5;
export const SPARK_MS = 320;

export interface SparkSpec {
  dx: number;
  dy: number;
  delayMs: number;
  sizePx: number;
}

export function sparkleSpecs(rand: () => number, count = SPARK_COUNT): SparkSpec[] {
  const n = Math.max(1, Math.floor(count));
  const out: SparkSpec[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.min(1, Math.max(0, rand()));
    const angle = (-160 + (140 / Math.max(1, n - 1)) * i + (r * 2 - 1) * 10) * (Math.PI / 180);
    const dist = 26 + r * 22;
    out.push({
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist) - 8,
      delayMs: Math.round(i * 24),
      sizePx: 10 + Math.round(r * 6)
    });
  }
  return out;
}

export function sparkleCss(prefix: string): string {
  const p = prefix.replace(/[^a-z-]/gi, "");
  return `
.${p}-spark { position: absolute; left: 50%; top: 40%; pointer-events: none; z-index: 6; animation: ${p}SparkFly ${SPARK_MS}ms ease-out forwards; will-change: transform, opacity; }
@keyframes ${p}SparkFly {
  0% { transform: translate(-50%, -50%) scale(.4); opacity: 0; }
  25% { opacity: 1; }
  100% { transform: translate(calc(-50% + var(--${p}-spark-dx, 0px)), calc(-50% + var(--${p}-spark-dy, -30px))) scale(1); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .${p}-spark { display: none; }
}
`;
}

/** 白闪星花保留几帧（fruit-slice / poop-hero / fishing-star 共用） */
export const SPARK_FRAMES = 2;
/** 减弱动效时保留几帧（切中反馈不能整个删掉） */
export const SPARK_FRAMES_REDUCED = 1;

export interface Spark {
  x: number;
  y: number;
  r: number;
  framesLeft: number;
}

/** 四角星路径:两头尖、腰身内收。fill 由调用方定。 */
export function traceStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const waist = r * 0.28;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + waist, y - waist, x + r, y);
  ctx.quadraticCurveTo(x + waist, y + waist, x, y + r);
  ctx.quadraticCurveTo(x - waist, y + waist, x - r, y);
  ctx.quadraticCurveTo(x - waist, y - waist, x, y - r);
  ctx.closePath();
}

export class SparklePool {
  private sparks: Spark[] = [];

  spawn(x: number, y: number, reduced: boolean, r = 14): void {
    this.sparks.push({ x, y, r, framesLeft: reduced ? SPARK_FRAMES_REDUCED : SPARK_FRAMES });
  }

  /** 画一帧并消耗一帧寿命。 */
  draw(ctx: CanvasRenderingContext2D): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      traceStar(ctx, s.x, s.y, s.r);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      traceStar(ctx, s.x, s.y, s.r * 0.45);
      ctx.fill();
      s.framesLeft--;
      if (s.framesLeft <= 0) this.sparks.splice(i, 1);
    }
  }

  count(): number {
    return this.sparks.length;
  }

  clear(): void {
    this.sparks.length = 0;
  }
}
