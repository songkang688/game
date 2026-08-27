/**
 * 冰冰火火森林 · 手感常量与帧率无关的位移(纯函数,不碰 DOM)。
 *
 * 这一款是**俯视格子**解谜,不是侧视平台跳跃,所以「重力 / 跳跃初速」在这里
 * 不管走路,只管两件带弧线的事:
 *  1. **顶举**:一个人把同伴举过一格障碍,同伴沿抛物线落到两格外;
 *  2. **小云朵**:踩进水火池的人变成一朵小云,飘回最近的检查点。
 *
 * 「土狼时间」与「跳跃缓冲」这两条在格子游戏里同样说得通,而且是这一款最容易
 * 让孩子按到手酸的两个地方:
 *  - **土狼时间**:同伴刚从托举点上走开,你这一步已经按下去了 —— 再给 90ms 宽限,
 *    这一步照样算数,不然两个人永远差半拍;
 *  - **跳跃缓冲**:上一步还没走完就按下的方向,记住 120ms,一到点立刻兑现,
 *    不用玩家自己数节奏。
 *
 * 位移用**定步长累加器**推进:每帧把 `dt` 切成 `FIXED_STEP_MS` 的小块,
 * 不满一块的余数留到下一帧。这样 30fps 和 60fps 走同样的墙上时间,
 * 位移只差一个不到一块的余数(< 2%),不会出现「帧率高就走得快」。
 */

/** 全部手感常量。改这里的任何一个数,`feel.test.ts` 都会跟着说话。 */
export const FEEL = {
  /** 重力(像素/秒²):顶举抛物线与小云朵的落势 */
  GRAVITY: 2000,
  /** 起跳初速(像素/秒):顶举把同伴抛出去的力道 */
  JUMP_VELOCITY: 600,
  /** 土狼时间(毫秒):支撑刚消失后还认账多久 */
  COYOTE_MS: 90,
  /** 跳跃缓冲(毫秒):提前按下的指令记多久 */
  JUMP_BUFFER_MS: 120,
  /** 边缘吸附(格):离目标格差这么点就直接贴上去,不留亚像素残差 */
  EDGE_SNAP_CELLS: 0.22,
  /** 按住方向键时每走一格的间隔(毫秒) */
  STEP_MS: 145,
  /** 撞上挡路的东西之后锁一下,免得按住不放疯狂撞(毫秒) */
  BUMP_MS: 220,
  /** 小云朵从池子飘回检查点要多久(毫秒) */
  CLOUD_MS: 620,
  /** 定步长积分的一小块有多长(毫秒);1000/240 = 4.1667 */
  FIXED_STEP_MS: 1000 / 240,
  /** 单帧最多认多少毫秒:切后台回来那一下不能让人一口气冲出去 */
  MAX_FRAME_MS: 100,
} as const;

// ---------------------------------------------------------------------------
// 抛物线(顶举与小云朵)
// ---------------------------------------------------------------------------

/** 一次顶举飞多久(毫秒):`2v/g` */
export function hopDurationMs(): number {
  return (2 * FEEL.JUMP_VELOCITY * 1000) / FEEL.GRAVITY;
}

/** 一次顶举最高抬多少像素:`v²/2g` */
export function hopHeightPx(): number {
  return (FEEL.JUMP_VELOCITY * FEEL.JUMP_VELOCITY) / (2 * FEEL.GRAVITY);
}

/**
 * 顶举飞了 `tMs` 毫秒之后离地多高(像素,向上为正)。
 * 起飞与落地都正好是 0,中间是一条对称的抛物线。
 */
export function hopOffsetPx(tMs: number): number {
  const total = hopDurationMs();
  if (!Number.isFinite(tMs) || tMs <= 0 || tMs >= total) return 0;
  const t = tMs / 1000;
  return FEEL.JUMP_VELOCITY * t - 0.5 * FEEL.GRAVITY * t * t;
}

/** 顶举 / 小云朵的进度(0..1),给渲染插值用 */
export function hopProgress(tMs: number, totalMs: number): number {
  if (!Number.isFinite(tMs) || totalMs <= 0) return 1;
  return Math.max(0, Math.min(1, tMs / totalMs));
}

// ---------------------------------------------------------------------------
// 土狼时间
// ---------------------------------------------------------------------------

/**
 * 支撑(同伴踩着的托举点)最后一次成立是在 `lastSupportedMs`,
 * 现在是 `nowMs` —— 这一步还算不算数?
 *
 * `lastSupportedMs < 0` 表示这一局里同伴压根没站上去过。
 */
export function coyoteOpen(nowMs: number, lastSupportedMs: number): boolean {
  if (lastSupportedMs < 0) return false;
  const gap = nowMs - lastSupportedMs;
  return gap >= 0 && gap <= FEEL.COYOTE_MS;
}

// ---------------------------------------------------------------------------
// 跳跃缓冲
// ---------------------------------------------------------------------------

export interface Buffered {
  /** 记着的那个动作;没有就是 null */
  action: string | null;
  /** 按下的时刻(毫秒) */
  at: number;
}

/** 空的缓冲 */
export function emptyBuffer(): Buffered {
  return { action: null, at: -1 };
}

/** 记下一个提前按下的动作(后按的盖掉先按的) */
export function bufferPress(buf: Buffered, action: string, nowMs: number): Buffered {
  return { action, at: nowMs };
}

/** 缓冲里那个动作现在还算不算数 */
export function bufferAlive(buf: Buffered, nowMs: number): boolean {
  if (buf.action === null || buf.at < 0) return false;
  const gap = nowMs - buf.at;
  return gap >= 0 && gap <= FEEL.JUMP_BUFFER_MS;
}

/** 取出缓冲里的动作(过期就当没有),同时把缓冲清空 */
export function bufferTake(buf: Buffered, nowMs: number): { action: string | null; next: Buffered } {
  const ok = bufferAlive(buf, nowMs);
  return { action: ok ? buf.action : null, next: emptyBuffer() };
}

// ---------------------------------------------------------------------------
// 边缘吸附
// ---------------------------------------------------------------------------

/** 离目标格差得够近就直接贴上去 */
export function snapAxis(cur: number, target: number): number {
  return Math.abs(target - cur) <= FEEL.EDGE_SNAP_CELLS ? target : cur;
}

/** 两个坐标是不是已经近到可以当成同一格 */
export function withinSnap(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.abs(ax - bx) + Math.abs(ay - by) <= FEEL.EDGE_SNAP_CELLS;
}

// ---------------------------------------------------------------------------
// 定步长位移
// ---------------------------------------------------------------------------

/** 一个角色在画面上的滑行状态(格坐标,可以是小数) */
export interface Glide {
  x: number;
  y: number;
  /** 还要依次滑到哪几格(格号) */
  queue: number[];
  /** 上一帧没凑满一小块的余数(毫秒) */
  acc: number;
}

export function makeGlide(x: number, y: number): Glide {
  return { x, y, queue: [], acc: 0 };
}

/** 队列里还剩几格就走多快:排得越长走得越快,免得传送带一送就拖一长串 */
export function glideSpeed(queueLength: number): number {
  return (1000 / FEEL.STEP_MS) * Math.max(1, queueLength);
}

/**
 * 把 `dtMs` 这段时间走掉。
 *
 * 关键是**定步长**:只按 `FIXED_STEP_MS` 的整数倍推进,余数存回 `acc`。
 * 所以同样的墙上时间,30fps 与 60fps 推进的总时长最多差一小块(4.17ms),
 * 折成位移远小于 2%。
 *
 * 直接改传进来的那个 `Glide`(每帧都新建对象的话,一局下来垃圾太多)。
 */
export function stepGlide(g: Glide, dtMs: number, gridW: number): void {
  const dt = Math.max(0, Math.min(FEEL.MAX_FRAME_MS, Number.isFinite(dtMs) ? dtMs : 0));
  g.acc += dt;
  const chunks = Math.floor(g.acc / FEEL.FIXED_STEP_MS);
  if (chunks <= 0) return;
  g.acc -= chunks * FEEL.FIXED_STEP_MS;
  if (g.queue.length === 0) return;

  let budget = (glideSpeed(g.queue.length) * chunks * FEEL.FIXED_STEP_MS) / 1000;
  while (budget > 0 && g.queue.length > 0) {
    const target = g.queue[0];
    const tx = target % gridW;
    const ty = (target / gridW) | 0;
    const dx = tx - g.x;
    const dy = ty - g.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist <= budget || dist <= FEEL.EDGE_SNAP_CELLS) {
      g.x = tx;
      g.y = ty;
      budget -= dist;
      g.queue.shift();
      continue;
    }
    g.x += (dx / dist) * budget;
    g.y += (dy / dist) * budget;
    budget = 0;
  }
  if (g.queue.length === 0) g.acc = 0;
}

/**
 * 把一整段时间按固定帧长喂给 `stepGlide`,返回一共走了多少格。
 * 用例靠它比 30fps 与 60fps 的位移。
 */
export function simulateGlide(
  start: { x: number; y: number },
  queue: readonly number[],
  gridW: number,
  totalMs: number,
  frameMs: number
): { x: number; y: number; travelled: number } {
  const g: Glide = { x: start.x, y: start.y, queue: [...queue], acc: 0 };
  let travelled = 0;
  let left = totalMs;
  while (left > 1e-9) {
    const dt = Math.min(frameMs, left);
    const px = g.x;
    const py = g.y;
    stepGlide(g, dt, gridW);
    travelled += Math.abs(g.x - px) + Math.abs(g.y - py);
    left -= dt;
  }
  return { x: g.x, y: g.y, travelled };
}

// ---------------------------------------------------------------------------
// 走格节奏
// ---------------------------------------------------------------------------

/** 现在能不能再走一格 */
export function stepReady(nowMs: number, nextAllowedMs: number): boolean {
  return nowMs >= nextAllowedMs;
}

/** 走成一格之后,下一格最早什么时候 */
export function nextStepAt(nowMs: number): number {
  return nowMs + FEEL.STEP_MS;
}

/** 撞上挡路的东西之后,下一次尝试最早什么时候 */
export function nextBumpAt(nowMs: number): number {
  return nowMs + FEEL.BUMP_MS;
}

// ---------------------------------------------------------------------------
// 减少动态效果
// ---------------------------------------------------------------------------

/**
 * 系统有没有勾上「减少动态效果」。
 * 勾了就把抖动与闪烁全关掉(位置照样更新,只是不晃、不闪)。
 */
export function prefersReducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches?: boolean } }).matchMedia;
  if (typeof mm !== "function") return false;
  try {
    return mm("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}
