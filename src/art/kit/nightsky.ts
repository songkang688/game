// 共享美术套件 · 夜空底(nightsky):星云渐变、亮星闪烁、流星调度、丘陵剪影。
//
// 约定:纯逻辑(可 seed 复现,node 单测直接咬)与薄薄一层 canvas 绘制分开;
// 需要夜空的游戏只 import,不改这里——要新能力就在 kit 里另起自己的文件。

/** 本套件自带的确定性随机(mulberry32):同一个 seed 永远吐同一串数 */
export function skyRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 亮星:两级大小、缓慢闪烁(reduced 恒亮)
// ---------------------------------------------------------------------------

export const STAR_COUNT = 12;
/** 两级闪烁周期:小星快闪、大星慢闪 */
export const TWINKLE_FAST_MS = 1800;
export const TWINKLE_SLOW_MS = 2600;

export interface NightStar {
  x: number;
  y: number;
  r: number;
  periodMs: number;
  phaseMs: number;
}

/** 撒 count 颗亮星,只落在画面上部(skyTop..skyBottom 比例带),同 seed 同一批 */
export function makeStars(
  seed: number,
  w: number,
  h: number,
  count = STAR_COUNT,
  skyTop = 0.04,
  skyBottom = 0.5
): NightStar[] {
  const rng = skyRng(seed);
  const out: NightStar[] = [];
  for (let i = 0; i < count; i++) {
    const big = i % 2 === 0;
    out.push({
      x: Math.round(rng() * w),
      y: Math.round(h * (skyTop + rng() * (skyBottom - skyTop))),
      r: big ? 2.6 : 1.5,
      periodMs: big ? TWINKLE_SLOW_MS : TWINKLE_FAST_MS,
      phaseMs: Math.round(rng() * 2000),
    });
  }
  return out;
}

/** 这一刻这颗星多亮(0.45..1,sin 缓动);reduced 恒亮 */
export function starAlpha(star: NightStar, tMs: number, reduced: boolean): number {
  if (reduced) return 1;
  const ph = ((tMs + star.phaseMs) % star.periodMs) / star.periodMs;
  return 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(ph * Math.PI * 2));
}

// ---------------------------------------------------------------------------
// 流星:8~14 秒随机一条,700ms 尾迹渐隐(easeIn);reduced 不生成
// ---------------------------------------------------------------------------

export const METEOR_MIN_GAP_MS = 8000;
export const METEOR_MAX_GAP_MS = 14000;
export const METEOR_LIFE_MS = 700;

export interface MeteorState {
  rng: () => number;
  /** 距下一条流星还有多少毫秒;0 且 lifeMs=0 表示已被 reset(destroy 后) */
  waitMs: number;
  /** 这一条还能活多少毫秒(0 = 天上现在没有流星) */
  lifeMs: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/** 下一条流星隔多久:落在 [METEOR_MIN_GAP_MS, METEOR_MAX_GAP_MS] 里 */
export function nextMeteorGap(rng: () => number): number {
  return METEOR_MIN_GAP_MS + rng() * (METEOR_MAX_GAP_MS - METEOR_MIN_GAP_MS);
}

export function createMeteor(seed: number): MeteorState {
  const rng = skyRng(seed);
  return { rng, waitMs: nextMeteorGap(rng), lifeMs: 0, x: 0, y: 0, dx: 0, dy: 0 };
}

/** 推进流星调度;reduced 时永远不生成 */
export function stepMeteor(st: MeteorState, dtMs: number, w: number, h: number, reduced: boolean): void {
  if (reduced) return;
  if (st.lifeMs > 0) {
    st.lifeMs = Math.max(0, st.lifeMs - dtMs);
    if (st.lifeMs === 0) st.waitMs = nextMeteorGap(st.rng);
    return;
  }
  if (st.waitMs <= 0) return; // 已 reset,不再排下一条
  st.waitMs -= dtMs;
  if (st.waitMs <= 0) {
    st.x = w * (0.15 + 0.6 * st.rng());
    st.y = h * (0.06 + 0.18 * st.rng());
    const len = w * 0.22;
    st.dx = len; // 斜向右下 45° 左右
    st.dy = len * (0.5 + 0.3 * st.rng());
    st.lifeMs = METEOR_LIFE_MS;
    st.waitMs = 0;
  }
}

export interface MeteorFrame {
  x: number;
  y: number;
  tailX: number;
  tailY: number;
  alpha: number;
}

/** 天上这一刻的流星(没有就 null):头部位置 + 渐隐尾迹 */
export function meteorFrame(st: MeteorState): MeteorFrame | null {
  if (st.lifeMs <= 0) return null;
  const k = 1 - st.lifeMs / METEOR_LIFE_MS;
  const ease = k * k; // easeIn:越到后面滑得越快
  const hx = st.x + st.dx * ease;
  const hy = st.y + st.dy * ease;
  return {
    x: hx,
    y: hy,
    tailX: hx - st.dx * 0.28,
    tailY: hy - st.dy * 0.28,
    alpha: 1 - ease,
  };
}

/** destroy 清场:流星计时与在天上的那一条全部归零 */
export function resetMeteor(st: MeteorState): void {
  st.waitMs = 0;
  st.lifeMs = 0;
  st.x = 0;
  st.y = 0;
  st.dx = 0;
  st.dy = 0;
}

// ---------------------------------------------------------------------------
// 丘陵剪影:两层视差用两份不同 seed 的点列
// ---------------------------------------------------------------------------

export interface HillPoint {
  x: number;
  y: number;
}

/** 一条丘陵天际线的采样点(同 seed 同一条线);baseY 是丘顶均线,amp 是起伏幅度 */
export function hillPoints(seed: number, w: number, baseY: number, amp: number, humps = 5): HillPoint[] {
  const rng = skyRng(seed);
  const offsets = Array.from({ length: humps + 1 }, () => (rng() - 0.5) * 2);
  const out: HillPoint[] = [];
  const steps = humps * 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const seg = Math.min(humps - 1, Math.floor(t * humps));
    const local = t * humps - seg;
    const y0 = offsets[seg];
    const y1 = offsets[seg + 1];
    // 半余弦插值:圆滚滚的丘,不出尖角
    const mix = y0 + (y1 - y0) * (0.5 - 0.5 * Math.cos(local * Math.PI));
    out.push({ x: Math.round(t * w), y: Math.round(baseY + mix * amp) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 薄绘制层(不进单测,只是让接入方少写样板)
// ---------------------------------------------------------------------------

/** 星云双色径向渐变铺满 w×h */
export function paintNebula(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colorInner: string,
  colorOuter: string
): void {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.32, Math.min(w, h) * 0.1, w * 0.5, h * 0.45, Math.max(w, h) * 0.75);
  g.addColorStop(0, colorInner);
  g.addColorStop(1, colorOuter);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** 画一层丘陵剪影(点列 + 底边闭合) */
export function paintHills(
  ctx: CanvasRenderingContext2D,
  pts: HillPoint[],
  bottomY: number,
  color: string,
  offsetX = 0
): void {
  if (pts.length === 0) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x + offsetX, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x + offsetX, pts[i].y);
  ctx.lineTo(pts[pts.length - 1].x + offsetX, bottomY);
  ctx.lineTo(pts[0].x + offsetX, bottomY);
  ctx.closePath();
  ctx.fill();
}

/** 画一颗四角小十字星 */
export function paintStar(ctx: CanvasRenderingContext2D, star: NightStar, alpha: number, color: string): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
  ctx.fill();
  if (star.r > 2) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(star.x - star.r * 2.1, star.y);
    ctx.lineTo(star.x + star.r * 2.1, star.y);
    ctx.moveTo(star.x, star.y - star.r * 2.1);
    ctx.lineTo(star.x, star.y + star.r * 2.1);
    ctx.stroke();
  }
  ctx.restore();
}

/** 画这一刻的流星(头亮尾淡的一条斜线) */
export function paintMeteor(ctx: CanvasRenderingContext2D, frame: MeteorFrame, color: string): void {
  ctx.save();
  ctx.globalAlpha = frame.alpha;
  const g = ctx.createLinearGradient(frame.tailX, frame.tailY, frame.x, frame.y);
  g.addColorStop(0, "rgba(255,243,201,0)");
  g.addColorStop(1, color);
  ctx.strokeStyle = g;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(frame.tailX, frame.tailY);
  ctx.lineTo(frame.x, frame.y);
  ctx.stroke();
  ctx.restore();
}
