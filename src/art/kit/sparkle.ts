// 共享美术套件 · 星屑彩纸(sparkle):找到 / 过关时撒的一小把星屑。
//
// 纯逻辑(seed 可复现)与薄绘制层分开;粒子 500ms easeOutCubic 散开渐隐。

/** 星屑寿命(毫秒):撒出去半秒钟就散干净,不抢下一次点击的注意力 */
export const SPARKLE_LIFE_MS = 500;

/** 粉彩星屑配色(和全库粉彩一家人) */
export const SPARKLE_COLORS = ["#ffd75e", "#8fe0c4", "#a9d8ff", "#ffb6c9", "#d9bcff"] as const;

export interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  /** 还能活多少毫秒(0 = 已散尽) */
  lifeMs: number;
}

function sparkleRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 在 (x, y) 撒一把星屑;同 seed 同一把 */
export function spawnSparkles(seed: number, x: number, y: number, count = 14): SparkleParticle[] {
  const rng = sparkleRng(seed);
  const out: SparkleParticle[] = [];
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const speed = 60 + rng() * 120;
    out.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 40,
      r: 1.8 + rng() * 2.4,
      color: SPARKLE_COLORS[Math.floor(rng() * SPARKLE_COLORS.length)],
      lifeMs: SPARKLE_LIFE_MS,
    });
  }
  return out;
}

/** 推进一帧并丢掉散尽的粒子(返回还活着的那些) */
export function stepSparkles(ps: SparkleParticle[], dtMs: number): SparkleParticle[] {
  const dt = dtMs / 1000;
  const alive: SparkleParticle[] = [];
  for (const p of ps) {
    p.lifeMs = Math.max(0, p.lifeMs - dtMs);
    if (p.lifeMs <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 160 * dt; // 一点点下坠,像纸屑
    alive.push(p);
  }
  return alive;
}

/** destroy 清场:粒子当场归零 */
export function clearSparkles(ps: SparkleParticle[]): void {
  ps.length = 0;
}

/** 薄绘制层:easeOutCubic 渐隐的小圆片 */
export function paintSparkles(ctx: CanvasRenderingContext2D, ps: SparkleParticle[]): void {
  for (const p of ps) {
    const k = 1 - p.lifeMs / SPARKLE_LIFE_MS;
    const alpha = 1 - (1 - Math.pow(1 - k, 3)) * 0.9; // easeOutCubic 渐隐:开头亮,收尾快
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1 - k * 0.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
