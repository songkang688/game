// 贪吃毛毛虫 · 1.2 手感层:转向输入队列、速度曲线与稳定档、四种机关、两种无尽档、
// 打结歇会儿的温柔收场,以及滑动转向与格间插值。
//
// 全是纯函数,不碰 DOM。1.1 的 logic.ts 管墙 / 星门 / 小刺猬 / 窄门的规则,
// 这一层管「按了就该算数、跑得稳、撞了不吓人」。
// 本款是**格子蛇**:一拍走一格,离散网格,和自由角度的长蛇是两回事,别互相靠拢。
import { GRID, type SnakeLevel } from "./levels";
import { DIRS, cellKey, cellXY, gateSet, portalMap, wallSet } from "./logic";

export type Dir = [number, number];

// ---------------------------------------------------------------------------
// 一、转向输入队列
// ---------------------------------------------------------------------------

/** 最多缓存两个转向:再多就是乱按了,存下来只会让虫子走得莫名其妙 */
export const TURN_QUEUE_CAP = 2;

export function sameDir(a: Dir, b: Dir): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** 掉头:180° 直接反向,任何时候都不许 */
export function isReverse(a: Dir, b: Dir): boolean {
  return a[0] === -b[0] && a[1] === -b[1];
}

/** 这一按要跟谁比:队列里有货就跟队尾比,空队列才跟当前朝向比 */
export function queueTail(queue: readonly Dir[], current: Dir): Dir {
  return queue.length > 0 ? queue[queue.length - 1] : current;
}

/**
 * 记一个转向。
 * - 和队尾同向:白按,不占坑（连点也不会把队列塞满）
 * - 和队尾反向:同一拍里的掉头,**直接丢弃**（这条挡掉了绝大多数「我明明按了却自己撞上」）
 * - 队列满了:丢掉最新的这一个,先把前面两个走完
 */
export function pushTurn(
  queue: readonly Dir[],
  current: Dir,
  want: Dir,
  cap: number = TURN_QUEUE_CAP
): Dir[] {
  const out = queue.map((d) => [d[0], d[1]] as Dir);
  const tail = queueTail(out, current);
  if (sameDir(want, tail)) return out;
  if (isReverse(want, tail)) return out;
  if (out.length >= Math.max(0, cap)) return out;
  out.push([want[0], want[1]]);
  return out;
}

/** 走一拍:从队头取一个方向;队列空了就照着原方向继续爬 */
export function takeTurn(queue: readonly Dir[], current: Dir): { dir: Dir; queue: Dir[] } {
  const rest = queue.map((d) => [d[0], d[1]] as Dir);
  while (rest.length > 0) {
    const next = rest.shift()!;
    if (isReverse(next, current)) continue; // 兜底:反向的一律不生效
    return { dir: next, queue: rest };
  }
  return { dir: [current[0], current[1]], queue: rest };
}

// ---------------------------------------------------------------------------
// 二、速度曲线与稳定速度辅助档
// ---------------------------------------------------------------------------

export interface SpeedCurve {
  /** 开局每走一格多少毫秒 */
  startMs: number;
  /** 再快也不快过这里 */
  minMs: number;
  /** 每吃满 every 口,快 stepMs 毫秒 */
  stepMs: number;
  every: number;
}

/** 最快也要给孩子留出反应时间 */
export const FLOOR_MS = 150;

/** 把每一关的速度节奏摊成数据:关卡表里的 tickMs 就是初速 */
export function speedCurveFor(lv: SnakeLevel): SpeedCurve {
  const startMs = Math.max(FLOOR_MS, Math.round(lv.tickMs));
  return {
    startMs,
    minMs: Math.max(FLOOR_MS, startMs - 40),
    stepMs: 5,
    every: 4,
  };
}

/** 关外可以选的两档节奏 */
export const PACE_MODES = ["curve", "steady"] as const;
export type PaceMode = (typeof PACE_MODES)[number];

export function paceLabel(mode: PaceMode): string {
  return mode === "steady" ? "🐢 稳稳走(速度不变)" : "🐇 越吃越快";
}

export function paceTip(mode: PaceMode): string {
  return mode === "steady"
    ? "整关一个速度,不会越吃越急,先把路线练熟。"
    : "每吃几口就快一点点,手熟了会越玩越带劲。";
}

/** 稳定速度只是让节奏不变,**三星标准一个字都没动** */
export function paceChangesStars(): boolean {
  return false;
}

/** 吃到第 eaten 口时,一格该走多少毫秒 */
export function tickMsAt(curve: SpeedCurve, eaten: number, mode: PaceMode = "curve"): number {
  if (mode === "steady") return curve.startMs;
  const steps = Math.floor(Math.max(0, eaten) / Math.max(1, curve.every));
  return Math.max(curve.minMs, curve.startMs - steps * curve.stepMs);
}

// ---------------------------------------------------------------------------
// 三、机关（每种一个纯函数）
// ---------------------------------------------------------------------------

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID && y >= 0 && y < GRID;
}

/* --- 机关 1:成对星门 --- */

/** 踩进 (x,y) 会从哪儿钻出来;这格不是星门就返回 null */
export function portalExit(lv: SnakeLevel, x: number, y: number): [number, number] | null {
  const hop = portalMap(lv).get(cellKey(x, y));
  return hop === undefined ? null : cellXY(hop);
}

/* --- 机关 2:可推的小石头 --- */

export interface PushCtx {
  walls: ReadonlySet<number>;
  /** 推不进去的其他东西:虫身、小刺猬、窄门、点心 */
  blocked?: ReadonlySet<number>;
}

export function stoneSet(lv: SnakeLevel): Set<number> {
  return new Set((lv.stones ?? []).map(([x, y]) => cellKey(x, y)));
}

/**
 * 顶一下 (x,y) 上的小石头,它往 dir 滑一格。
 * 出界 / 撞墙 / 撞上别的石头或虫身都推不动 —— 这时候返回 null,
 * 游戏里就是「顶住了,原地不动」,**不算撞车**。
 */
export function pushStone(
  stones: ReadonlySet<number>,
  x: number,
  y: number,
  dir: Dir,
  ctx: PushCtx
): Set<number> | null {
  const from = cellKey(x, y);
  if (!stones.has(from)) return null;
  const nx = x + dir[0];
  const ny = y + dir[1];
  if (!inBounds(nx, ny)) return null;
  const to = cellKey(nx, ny);
  if (ctx.walls.has(to) || stones.has(to) || ctx.blocked?.has(to)) return null;
  const out = new Set(stones);
  out.delete(from);
  out.add(to);
  return out;
}

/** 这块石头这会儿推得动吗（画面上把推不动的画暗一点） */
export function stonePushable(
  stones: ReadonlySet<number>,
  x: number,
  y: number,
  dir: Dir,
  ctx: PushCtx
): boolean {
  return pushStone(stones, x, y, dir, ctx) !== null;
}

/* --- 机关 3:限时星星果 --- */

/** 星星果能撑几拍:按当前速度折算成大约这么多秒 */
export function starTicksFor(tickMs: number, seconds = 7): number {
  return Math.max(8, Math.round((seconds * 1000) / Math.max(1, tickMs)));
}

export function starLeft(ticks: number, limit: number): number {
  return Math.max(0, limit - Math.max(0, ticks));
}

export function starExpired(ticks: number, limit: number): boolean {
  return starLeft(ticks, limit) <= 0;
}

/** 快没时间了就在画面上闪一下 */
export function starHurry(ticks: number, limit: number): boolean {
  const left = starLeft(ticks, limit);
  return left > 0 && left <= Math.max(3, Math.round(limit * 0.3));
}

/* --- 机关 4:绕圈才能开的门 --- */

/** 花坛四周那一圈格子(顺着走就是绕一圈);出界的自动去掉 */
export function ringAround(cx: number, cy: number): number[] {
  const order: Array<[number, number]> = [
    [cx - 1, cy - 1], [cx, cy - 1], [cx + 1, cy - 1],
    [cx + 1, cy], [cx + 1, cy + 1], [cx, cy + 1],
    [cx - 1, cy + 1], [cx - 1, cy],
  ];
  return order.filter(([x, y]) => inBounds(x, y)).map(([x, y]) => cellKey(x, y));
}

export function ringCells(lv: SnakeLevel): number[] {
  return (lv.ring ?? []).map(([x, y]) => cellKey(x, y));
}

export function ringDoorSet(lv: SnakeLevel): Set<number> {
  return new Set((lv.ringDoor ?? []).map(([x, y]) => cellKey(x, y)));
}

/** 这一圈踩了几格 */
export function ringProgress(ring: readonly number[], visited: ReadonlySet<number>): number {
  return ring.filter((k) => visited.has(k)).length;
}

/** 整圈踩满了门才开;这一关本来就没有圈,那门当作一直开着 */
export function ringDoorOpen(ring: readonly number[], visited: ReadonlySet<number>): boolean {
  if (ring.length === 0) return true;
  return ringProgress(ring, visited) >= ring.length;
}

export function ringHint(ring: readonly number[], visited: ReadonlySet<number>): string {
  if (ring.length === 0) return "";
  const got = ringProgress(ring, visited);
  if (got >= ring.length) return "🌼 花坛绕完啦,小门开了,去兜里看看!";
  return `🌼 绕着花坛走一圈就能开门,还差 ${ring.length - got} 格`;
}

/* --- 运行时可达:把关着的绕圈门也算进去 --- */

export interface ReachOpts {
  gateOpen: boolean;
  ringOpen: boolean;
  /** 挡路的小石头 */
  stones?: ReadonlySet<number>;
}

/**
 * 这会儿真的走得到哪些格子。
 * logic.ts 的 reachableCells 是「关卡设计层」的连通性(1.1 的关卡校验在用,不能动);
 * 这一份是「运行时」的,门关着、石头挡着都算数,放点心时用它才不会放到够不着的地方。
 */
export function reachableNow(lv: SnakeLevel, from: number, opts: ReachOpts): Set<number> {
  const walls = wallSet(lv);
  const gates = gateSet(lv);
  const doors = ringDoorSet(lv);
  const portals = portalMap(lv);
  const stones = opts.stones ?? new Set<number>();
  const seen = new Set<number>();
  if (walls.has(from)) return seen;
  seen.add(from);
  const queue: number[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const [x, y] = cellXY(cur);
    const next: number[] = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const k = cellKey(nx, ny);
      if (walls.has(k) || stones.has(k)) continue;
      if (gates.has(k) && !opts.gateOpen) continue;
      if (doors.has(k) && !opts.ringOpen) continue;
      next.push(k);
    }
    const hop = portals.get(cur);
    if (hop !== undefined && !walls.has(hop) && !stones.has(hop)) next.push(hop);
    for (const k of next) {
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push(k);
    }
  }
  return seen;
}

// ---------------------------------------------------------------------------
// 四、放点心:避开虫身,满盘也有台阶下
// ---------------------------------------------------------------------------

/** 这会儿可以放点心的格子:够得着、没占人、不压门也不压石头 */
export function snackPool(
  reach: ReadonlySet<number>,
  taken: ReadonlySet<number>
): number[] {
  const out: number[] = [];
  reach.forEach((k) => {
    if (!taken.has(k)) out.push(k);
  });
  return out.sort((a, b) => a - b);
}

/** 从候选里挑一格;一格都不剩就返回 null,交给上面说句软话 */
export function pickSnack(pool: readonly number[], rand: () => number): number | null {
  if (pool.length === 0) return null;
  const i = Math.min(pool.length - 1, Math.floor(rand() * pool.length));
  return pool[i];
}

/** 普通点心的样子(星星果 ⭐ 和剪刀果 ✂️ 是另外两种，不在这一串里) */
export const SNACK_EMOJI = ["🍓", "🍎", "🍇", "🍪", "🧁"] as const;

/**
 * 下一颗普通点心长什么样：随机挑一个，但**不许和上一颗重样**。
 *
 * 原来是直接 `SNACKS[floor(rand()*5)]`，五选一有 1/5 的概率连着两颗一模一样。
 * 对小孩子来说「吃掉一颗、原地又冒出一颗同样的」看着像没刷新，
 * 会去戳已经吃过的那个位置。避开上一颗之后每一颗都看得出换了。
 */
export function nextSnackEmoji(prev: string, rand: () => number): string {
  const pool = SNACK_EMOJI.filter((e) => e !== prev);
  const list = pool.length > 0 ? pool : SNACK_EMOJI;
  return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
}

/** 满盘了:这是了不起的事,不是失败 */
export function boardFullLine(): string {
  return "整座花园都被你的身子铺满啦!这一关到此为止,厉害得不得了!";
}

// ---------------------------------------------------------------------------
// 五、无尽两档
// ---------------------------------------------------------------------------

export const ENDLESS_PACES = ["classic", "calm"] as const;
export type EndlessPace = (typeof ENDLESS_PACES)[number];

export function endlessPaceLabel(pace: EndlessPace): string {
  return pace === "calm" ? "🍃 休闲无尽(不加速)" : "🔥 经典无尽(越吃越快)";
}

export function endlessPaceTip(pace: EndlessPace): string {
  return pace === "calm"
    ? "速度一直不变,想爬多久爬多久,慢慢逛花园。"
    : "身子越长爬得越快,看看这一趟能吃到第几口。";
}

/** 经典档越吃越快,休闲档一直是开局那个速度 */
export function endlessTickMs(pace: EndlessPace, baseMs: number, eaten: number): number {
  const base = Math.max(FLOOR_MS, Math.round(baseMs));
  if (pace === "calm") return base;
  return Math.max(FLOOR_MS, base - Math.floor(Math.max(0, eaten) / 3) * 6);
}

// ---------------------------------------------------------------------------
// 六、失败温柔化:撞了是「打了个结」,顺手把这一趟的好事说一遍
// ---------------------------------------------------------------------------

export type KnotReason = "fence" | "wall" | "self" | "twin" | "mover" | "stone";

/** 撞了不叫失败,叫打了个结 */
export function knotLine(reason: KnotReason): string {
  switch (reason) {
    case "fence": return "毛毛虫在围栏边打了个结,歇一会儿~ 沿边走的时候提前一格转弯就顺啦!";
    case "wall": return "毛毛虫在树篱前打了个结,歇一会儿~ 进通道之前先看清出口在哪边!";
    case "self": return "毛毛虫把自己缠了个结,歇一会儿~ 吃之前先想好「吃完从哪儿出来」!";
    case "twin": return "两条毛毛虫缠成一个结,歇一会儿~ 它俩左右是反着走的,窄通道先让一条过!";
    case "stone": return "小石头顶住啦,毛毛虫打了个结歇一会儿~ 换个方向推,石头就滑走了!";
    default: return "和小刺猬撞了个满怀,打了个结歇一会儿~ 数着它来回的节奏再穿过去!";
  }
}

/** 这一趟的正向总结:活了多久、吃了多少 */
export function runSummary(eaten: number, seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const n = Math.max(0, Math.round(eaten));
  return `你爬了 ${s} 秒,吃到 ${n} 口点心。`;
}

/** 收场那一整段话:先说好事,再说下次怎么更顺 */
export function knotReport(reason: KnotReason, eaten: number, seconds: number): string {
  return `${runSummary(eaten, seconds)}${knotLine(reason)}`;
}

// ---------------------------------------------------------------------------
// 七、滑动转向与格间插值
// ---------------------------------------------------------------------------

/** 手指划这么远才算一次转向,免得点一下也被当成滑动 */
export const SWIPE_MIN = 22;

/** 手指划的方向:横竖各看一遍,取幅度大的那一边 */
export function swipeDir(dx: number, dy: number, min: number = SWIPE_MIN): Dir | null {
  if (Math.hypot(dx, dy) < Math.max(1, min)) return null;
  return Math.abs(dx) >= Math.abs(dy)
    ? [dx > 0 ? 1 : -1, 0]
    : [0, dy > 0 ? 1 : -1];
}

/**
 * 这一拍走到哪儿了(0 刚起步,1 正好落格)。
 * 关掉动效时直接给 1:状态机一模一样,只是不再画中间那几帧。
 */
export function moveT(elapsedMs: number, tickMs: number, reducedMotion = false): number {
  if (reducedMotion) return 1;
  const t = elapsedMs / Math.max(1, tickMs);
  return Math.max(0, Math.min(1, t));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 吞咽波:吃下去的那一口顺着身子往后传,经过第 index 节时鼓一下。
 * 返回半径倍率,1 就是平常粗细。
 */
export function swallowScale(index: number, wavePos: number, width = 1.4): number {
  const d = Math.abs(index - wavePos);
  if (d > width) return 1;
  return 1 + 0.28 * Math.cos((d / width) * (Math.PI / 2));
}
