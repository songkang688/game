/**
 * 共享美术套件 · 星屑（1.3 视觉升级 · 窗口8 B 档新增）。
 *
 * 「得分方按垫放星屑 5 颗」的 CSS 等价物：这里只算轨迹参数与生成 keyframes 文本，
 * 不碰 DOM、不开计时器。落地方用 animationend 收尸，reduced-motion 下不生成。
 */

/** 一次爆几颗星屑 */
export const SPARK_COUNT = 5;
/** 星屑动画时长 ms */
export const SPARK_MS = 320;

export interface SparkSpec {
  /** 相对爆点的横向落点（px） */
  dx: number;
  /** 相对爆点的纵向落点（px，负数往上飘） */
  dy: number;
  /** 每颗错开一点起飞（ms） */
  delayMs: number;
  /** 字号（px） */
  sizePx: number;
}

/**
 * 生成一撮星屑的轨迹参数。`rand` 由调用方注入（测试喂定数就能复现），
 * 轨迹呈扇形往上抛，永远不会全部叠在一个点上。
 */
export function sparkleSpecs(rand: () => number, count = SPARK_COUNT): SparkSpec[] {
  const n = Math.max(1, Math.floor(count));
  const out: SparkSpec[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.min(1, Math.max(0, rand()));
    // 扇形均分 140°，再加一点随机抖动，颗颗方向不同
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

/**
 * 星屑的通用 CSS（keyframes + 粒子类）。`prefix` 用调用方自己的样式前缀，
 * 免得两款游戏的星屑打起来。粒子层永远 pointer-events: none。
 */
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
