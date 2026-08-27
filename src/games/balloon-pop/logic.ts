/**
 * 气球砰砰 · 纯逻辑层（1.2 抽出）
 *
 * 1.1 的上升、横摆、风、命中、连锁全写在 `index.ts` 的 rAF 里，
 * 「30fps 的手机和 60fps 的平板是不是同一个难度」只能靠感觉。
 * 1.2 把这些规则搬到这里，做成不碰 DOM 的纯函数：
 *
 *  - 飘动按绝对时间解析求值，30fps / 60fps 逐帧积分都落在同一个位置
 *  - 相邻同色在 250ms 内连爆成一条波及链，链长给递增分数并封顶
 *  - 五种气球（普通 / 彩虹 / 护盾铁气球 / 礼物 / 双子）各自的行为
 *  - 四类关卡目标（数量 / 指定颜色 / 按顺序 / 保护）的判定
 *  - 无尽「气球节」的密度、速度与掉落，seeded 可复现
 *
 * 关卡数值仍然只在 `levels.ts`，前 99 关一个字都没动。
 */

import { mulberry32 } from "../level99";
import type { BalloonLevel } from "./levels";

// ---------------------------------------------------------------------------
// 一、天空尺寸与命中
// ---------------------------------------------------------------------------

export const SKY_H = 420;
export const BALLOON_W = 56;
export const BALLOON_H = 68;
/** 360px 上最小的气球直径，再小手指就点不准了 */
export const MIN_BALLOON_D = 40;
/** 命中容错：手指落在气球外圈 8px 也算点中 */
export const HIT_PAD = 8;
/** 气球飘出这条线就算跑掉了 */
export const ESCAPE_Y = -80;

/** 点到 (px,py)，气球中心在 (bx,by)，宽高 w/h：算不算命中 */
export function isHit(px: number, py: number, bx: number, by: number, w = BALLOON_W, h = BALLOON_H): boolean {
  const rx = w / 2 + HIT_PAD;
  const ry = h / 2 + HIT_PAD;
  const dx = (px - bx) / rx;
  const dy = (py - by) / ry;
  return dx * dx + dy * dy <= 1;
}

// ---------------------------------------------------------------------------
// 二、飘动物理：上升 + 正弦横摆 + 会翻面的风，全部与帧率无关
// ---------------------------------------------------------------------------

export const SWAY_SPEED = 2;
export const SWAY_AMP_PX = 8;

export interface AirCfg {
  /** 上升速度（像素/秒） */
  riseSpeed: number;
  /** 风力（每秒横向漂移的百分比） */
  wind?: number;
  /** 风向翻面周期（毫秒） */
  windFlipMs?: number;
  swaySpeed?: number;
  swayAmp?: number;
  /** 气球左右能飘到的范围（百分比） */
  minX?: number;
  maxX?: number;
}

/** t 秒时风往哪边吹（1 = 往右） */
export function windSign(t: number, flipMs?: number): number {
  if (!flipMs || flipMs <= 0) return 1;
  return Math.floor((t * 1000) / flipMs) % 2 === 0 ? 1 : -1;
}

/**
 * t0→t1 这段时间里风带来的横向位移（百分比）。
 * 风是方波，直接把方波积分算准，就不会出现「掉帧时正好错过一次翻面」。
 */
export function windShift(t0: number, t1: number, wind?: number, flipMs?: number): number {
  if (!wind || t1 <= t0) return 0;
  if (!flipMs || flipMs <= 0) return wind * (t1 - t0);
  const period = flipMs / 1000;
  let acc = 0;
  let t = t0;
  let guard = 0;
  while (t < t1 && guard++ < 100000) {
    const edge = Math.min(t1, (Math.floor(t / period) + 1) * period);
    acc += windSign(t, flipMs) * (edge - t);
    t = edge;
  }
  return wind * acc;
}

export interface Floater {
  /** 出生时的横向百分比 */
  x0: number;
  /** 出生时的高度（像素，越小越靠上） */
  y0: number;
  /** 出生时刻（秒） */
  born: number;
  /** 横摆初相位 */
  phase: number;
}

export interface FloatPos {
  x: number;
  y: number;
  /** 横摆造成的像素偏移（画的时候加在 left 上） */
  swayPx: number;
}

/** 某一时刻气球在哪：直接按绝对时间算，不累积误差、也不看帧率 */
export function floatAt(f: Floater, cfg: AirCfg, t: number): FloatPos {
  const dt = Math.max(0, t - f.born);
  const minX = cfg.minX ?? 4;
  const maxX = cfg.maxX ?? 88;
  const x = Math.max(minX, Math.min(maxX, f.x0 + windShift(f.born, t, cfg.wind, cfg.windFlipMs)));
  return {
    x,
    y: f.y0 - cfg.riseSpeed * dt,
    swayPx: Math.sin(f.phase + dt * (cfg.swaySpeed ?? SWAY_SPEED)) * (cfg.swayAmp ?? SWAY_AMP_PX)
  };
}

export interface DriftState {
  x: number;
  y: number;
  sway: number;
  /** 已经飘了多久（秒） */
  age: number;
}

/** 逐帧积分版本（给需要一帧一帧推的地方用）；与 floatAt 在任何帧率下都对得上 */
export function driftStep(s: DriftState, dt: number, cfg: AirCfg, born = 0): DriftState {
  const minX = cfg.minX ?? 4;
  const maxX = cfg.maxX ?? 88;
  const t0 = born + s.age;
  const t1 = t0 + dt;
  return {
    x: Math.max(minX, Math.min(maxX, s.x + windShift(t0, t1, cfg.wind, cfg.windFlipMs))),
    y: s.y - cfg.riseSpeed * dt,
    sway: s.sway + dt * (cfg.swaySpeed ?? SWAY_SPEED),
    age: s.age + dt
  };
}

export function swayPx(sway: number, amp = SWAY_AMP_PX): number {
  return Math.sin(sway) * amp;
}

// ---------------------------------------------------------------------------
// 三、五种气球
// ---------------------------------------------------------------------------

export type BalloonKind = "normal" | "cloud" | "rainbow" | "chain" | "iron" | "gift" | "twin";

export interface KindInfo {
  key: BalloonKind;
  name: string;
  emoji: string;
  /** 能不能戳破 */
  popable: boolean;
  /** 要戳几下才破 */
  taps: number;
  /** 戳错要扣多少分（礼物气球专用，扣分不扣爱心） */
  penalty: number;
  hint: string;
}

export const KINDS: Readonly<Record<BalloonKind, KindInfo>> = {
  normal: { key: "normal", name: "普通气球", emoji: "🎈", popable: true, taps: 1, penalty: 0, hint: "一戳就砰！" },
  cloud: { key: "cloud", name: "乌云球", emoji: "☁️", popable: false, taps: 0, penalty: 0, hint: "乌云球是陷阱，手指绕开它！" },
  rainbow: { key: "rainbow", name: "彩虹气球", emoji: "🌈", popable: true, taps: 1, penalty: 0, hint: "戳它，同一个颜色的气球全都跟着砰！" },
  chain: { key: "chain", name: "连锁气球", emoji: "🧨", popable: true, taps: 1, penalty: 0, hint: "一响就波及身边一片！" },
  iron: { key: "iron", name: "护盾铁气球", emoji: "🛡️", popable: true, taps: 2, penalty: 0, hint: "铁皮的，要敲两下：先碎盾，再砰！" },
  gift: { key: "gift", name: "礼物气球", emoji: "🎁", popable: false, taps: 0, penalty: 5, hint: "这是送给朋友的礼物，别戳，也别让它飞走～" },
  twin: { key: "twin", name: "双子气球", emoji: "👯", popable: true, taps: 1, penalty: 0, hint: "它俩绑在一起，戳一个两个一起砰！" }
};

/** 1.2 规定的五种气球（乌云与连锁是 1.0/1.1 留下来的老伙计） */
export const SPEC_KINDS: readonly BalloonKind[] = ["normal", "rainbow", "iron", "gift", "twin"];

/** 礼物气球飘得慢（它是「保护关」的沙漏，不是靶子） */
export const GIFT_RISE_MUL = 0.45;
/** 轻轻摇一摇，礼物气球会往下沉这么多像素——扣点分，但护得住 */
export const GIFT_PUSH_PX = 70;
/** 同一时间天上最多只有一个礼物气球：要护的东西只有一个，孩子才顾得过来 */
export const GIFT_MAX_ON_SCREEN = 1;

/** 现在还能不能再放一个礼物气球 */
export function canSpawnGift(liveGifts: number): boolean {
  return liveGifts < GIFT_MAX_ON_SCREEN;
}

export function kindInfo(kind: BalloonKind): KindInfo {
  return KINDS[kind];
}

/** 戳一下某种气球会怎样 */
export interface TapResult {
  /** 破了没有 */
  popped: boolean;
  /** 还剩几下 */
  tapsLeft: number;
  /** 要不要扣分（礼物气球） */
  penalty: number;
  /** 要不要算一次「戳错」（乌云球） */
  mistake: boolean;
  /** 礼物气球被点是摇一摇，不爆 */
  shake: boolean;
  /** 摇一摇之后往下沉多少像素 */
  pushDown: number;
  hint: string;
}

export function tapBalloon(kind: BalloonKind, tapsDone = 0): TapResult {
  const info = KINDS[kind];
  if (kind === "gift") {
    return {
      popped: false,
      tapsLeft: 0,
      penalty: info.penalty,
      mistake: false,
      shake: true,
      pushDown: GIFT_PUSH_PX,
      hint: "🎁 轻轻摇一摇，它慢慢往下沉啦～礼物不能戳破哦。"
    };
  }
  if (!info.popable) {
    return { popped: false, tapsLeft: 0, penalty: 0, mistake: true, shake: false, pushDown: 0, hint: info.hint };
  }
  const left = Math.max(0, info.taps - tapsDone - 1);
  return {
    popped: left === 0,
    tapsLeft: left,
    penalty: 0,
    mistake: false,
    shake: false,
    pushDown: 0,
    hint: left > 0 ? "🛡️ 护盾破了，再补一下就算数！" : info.hint
  };
}

// ---------------------------------------------------------------------------
// 四、连锁：相邻同色在 250ms 内连爆
// ---------------------------------------------------------------------------

/** 连锁气球（🧨）的波及半径 */
export const CHAIN_RADIUS = 110;
/** 同色连爆的判定半径：挨得这么近才算「相邻」 */
export const SAME_COLOR_RADIUS = 96;
/** 一条链最多在这个时间里连完（毫秒） */
export const CHAIN_WINDOW_MS = 250;
/** 链上每一颗之间隔多久爆（毫秒），依次爆开才有节奏 */
export const CHAIN_STEP_MS = 50;
/** 至少这么多颗同色挨在一起才会连爆（避免误伤单个） */
export const CHAIN_MIN = 3;
/** 一条链的分数上限 */
export const CHAIN_SCORE_CAP = 120;

export interface ChainNode {
  id: number;
  /** 像素坐标 */
  x: number;
  y: number;
  color: number;
  kind: BalloonKind;
}

/** 从某一颗出发，顺着「挨着的同色气球」摸出整条波及链（含自己） */
export function chainGroup(list: readonly ChainNode[], startId: number, radius = SAME_COLOR_RADIUS): number[] {
  const start = list.find((n) => n.id === startId);
  if (!start) return [];
  const linkable = (n: ChainNode) => n.kind === "normal" || n.kind === "twin" || n.kind === "iron";
  if (!linkable(start)) return [startId];
  const out: number[] = [startId];
  const seen = new Set<number>([startId]);
  const queue: ChainNode[] = [start];
  while (queue.length) {
    const cur = queue.shift() as ChainNode;
    for (const n of list) {
      if (seen.has(n.id) || n.color !== start.color || !linkable(n)) continue;
      if (Math.hypot(n.x - cur.x, n.y - cur.y) > radius) continue;
      seen.add(n.id);
      out.push(n.id);
      queue.push(n);
    }
  }
  return out;
}

/** 半径内的一片（连锁气球 🧨 用，不看颜色） */
export function blastGroup(list: readonly ChainNode[], startId: number, radius = CHAIN_RADIUS): number[] {
  const start = list.find((n) => n.id === startId);
  if (!start) return [];
  return list
    .filter((n) => n.id !== startId && n.kind !== "cloud" && n.kind !== "gift" && Math.hypot(n.x - start.x, n.y - start.y) <= radius)
    .map((n) => n.id);
}

/**
 * 一条 n 颗的链，每两颗之间隔多久爆。
 * 短链保持 50ms 的节奏；长到 50ms 排不下时按比例压紧，
 * 这样「整条链在 250ms 内连完」对多长的链都成立——
 * 不然七八颗的大链要响将近一秒，孩子早就以为没打中又补了一下。
 */
export function chainStepMs(n: number, step = CHAIN_STEP_MS): number {
  const gaps = Math.max(1, Math.max(0, n) - 1);
  return Math.min(step, CHAIN_WINDOW_MS / gaps);
}

/** 依次爆开的时刻表（毫秒）：不同帧全炸完，而是一颗接一颗 */
export function chainDelays(n: number, step = CHAIN_STEP_MS): number[] {
  const s = chainStepMs(n, step);
  const out: number[] = [];
  for (let i = 0; i < Math.max(0, n); i++) out.push(Math.round(i * s));
  return out;
}

/** 整条链在这么多毫秒内连完 */
export function chainDurationMs(n: number, step = CHAIN_STEP_MS): number {
  const delays = chainDelays(n, step);
  return delays.length ? delays[delays.length - 1] : 0;
}

/** 链长换分：越长每颗越值钱，但整条封顶，不会一条链就打完一关 */
export function chainScore(len: number): number {
  let sum = 0;
  for (let i = 1; i <= Math.max(0, len); i++) sum += 5 + Math.min(10, (i - 1) * 2);
  return Math.min(CHAIN_SCORE_CAP, sum);
}

/** 彩虹气球：清掉场上「数量最多的那个颜色」的全部气球 */
export function rainbowTargets(list: readonly ChainNode[]): { color: number; ids: number[] } {
  const count = new Map<number, number>();
  for (const n of list) {
    if (n.kind === "cloud" || n.kind === "gift" || n.kind === "rainbow") continue;
    count.set(n.color, (count.get(n.color) ?? 0) + 1);
  }
  let best = -1;
  let bestN = 0;
  for (const [color, n] of count) {
    if (n > bestN) {
      bestN = n;
      best = color;
    }
  }
  if (best < 0) return { color: -1, ids: [] };
  return {
    color: best,
    ids: list.filter((n) => n.color === best && n.kind !== "cloud" && n.kind !== "gift" && n.kind !== "rainbow").map((n) => n.id)
  };
}

/** 双子气球：找出和它绑在一起的那一颗 */
export function twinPartner(list: readonly ChainNode[], id: number, twinOf: ReadonlyMap<number, number>): number | null {
  const other = twinOf.get(id);
  if (other === undefined) return null;
  return list.some((n) => n.id === other) ? other : null;
}

// ---------------------------------------------------------------------------
// 五、四类关卡目标
// ---------------------------------------------------------------------------

export type GoalKind = "count" | "color" | "order" | "protect";

export const GOAL_LABELS: Readonly<Record<GoalKind, string>> = {
  count: "戳够数量",
  color: "只戳指定颜色",
  order: "按顺序戳",
  protect: "护住礼物气球"
};

export function levelGoal(cfg: BalloonLevel): GoalKind {
  if (cfg.protect) return "protect";
  if (cfg.mode === "color") return "color";
  if (cfg.mode === "number" || cfg.mode === "math") return "order";
  return "count";
}

export interface GoalState {
  popped: number;
  target: number;
  escaped: number;
  escapes: number;
  mistakes: number;
  /**
   * 「该护住却没护住」的礼物气球数。
   * 只有护礼物那类关卡才往上加——别的关卡里礼物是个不能戳的路人，
   * HUD 一个字都没提过它，飘走了就不该在结算时算账。
   */
  giftLost: number;
}

/** 这一关会不会因为礼物飘走而扣星：只有「护住礼物气球」那类关卡会 */
export function giftGuarded(kind: GoalKind): boolean {
  return kind === "protect";
}

export function goalReached(kind: GoalKind, st: GoalState): boolean {
  if (kind === "protect") return st.popped >= st.target && st.giftLost === 0;
  return st.popped >= st.target;
}

/** 没过关的原因；返回 null 表示还能接着玩。文案只鼓励，不批评 */
export function goalFailure(kind: GoalKind, st: GoalState): string | null {
  if (st.mistakes >= 3) return "看岔了三次啦～换指令时先停半秒确认，命中率马上就回来！";
  if (st.escaped > st.escapes) return "这一轮飘走得多了些～优先处理最靠上的那几个，再来一次就稳了！";
  if (kind === "protect" && st.giftLost > 0) return "礼物气球飘走啦～下次先把它下面的气球清开，让它慢慢降下来再看着它！";
  return null;
}

/** 这一颗是不是「现在该戳」的气球 */
export function isTargetBalloon(
  cfg: BalloonLevel,
  b: { kind: BalloonKind; color: number; num: number },
  targetColor: number,
  targetNum: number
): boolean {
  if (b.kind !== "normal" && b.kind !== "iron" && b.kind !== "twin") return false;
  if (cfg.mode === "color") return b.color === targetColor;
  if (cfg.mode === "number" || cfg.mode === "math") return b.num === targetNum;
  return true;
}

/**
 * 三星：一次不错、一个不漏。
 * `giftLost` 只该填「该护住却没护住」的数量——见 `giftGuarded`。
 */
export function starsFor(mistakes: number, escaped: number, giftLost = 0): 1 | 2 | 3 {
  const bad = mistakes + Math.max(0, escaped - 1) + giftLost * 2;
  return bad === 0 ? 3 : bad <= 2 ? 2 : 1;
}

// ---------------------------------------------------------------------------
// 六、无尽「气球节」
// ---------------------------------------------------------------------------

/** 漏掉这么多个就收工 */
export const FEST_MISS_LIMIT = 3;

export interface FestSpawn {
  /** 出现时刻（秒） */
  at: number;
  kind: BalloonKind;
  color: number;
  num: number;
  /** 横向百分比 */
  x: number;
  /** 远层气球：小一点、慢一点、分高一点（伪纵深） */
  far: boolean;
}

/** 第 wave 个气球的出现间隔（毫秒）：越往后越密，但有下限 */
export function festSpawnMs(wave: number): number {
  return Math.max(360, 900 - wave * 9);
}

/** 第 wave 个气球的上升速度（像素/秒）：越往后越快，但有上限 */
export function festRiseSpeed(wave: number): number {
  return Math.min(140, 52 + wave * 1.1);
}

/** 远层气球的缩放与加分倍率 */
export const FAR_SCALE = 0.72;
export const FAR_BONUS = 2;

/**
 * 第 wave 个礼物气球从出场飘到顶大概要几秒。
 * 「同一时间只挂一个礼物」这条规矩要在出场表里就守住，
 * 靠的就是让两个礼物至少隔开这么久。
 */
export function festGiftFlightS(wave: number): number {
  return (SKY_H + 40 - ESCAPE_Y) / (festRiseSpeed(wave) * GIFT_RISE_MUL);
}

/** 气球节一次排这么多个，出完再续一段——所以天空不会空掉 */
export const FEST_CHUNK = 900;

/** 出场表只剩这么多个没出场时就提前续段，别等真的见底 */
export const FEST_LOOKAHEAD = 60;

/**
 * 气球节的一段出场表：同一个种子永远是同一段（可复现）。
 *
 * `fromWave` 是这一段的第一个在整场里排第几，`startAt` 是它的出场时刻。
 * 间隔与上升速度都按绝对波次算，所以续出来的那一段接着变密变快。
 */
export function festPlan(seed: number, count: number, colors = 5, fromWave = 0, startAt = 0.6): FestSpawn[] {
  const rand = mulberry32(seed >>> 0);
  const out: FestSpawn[] = [];
  let at = startAt;
  // 上一个礼物气球飘到顶的时刻：在这之前再排一个礼物就会撞上限，降级成普通球
  let giftFreeAt = 0;
  for (let i = 0; i < count; i++) {
    const wave = fromWave + i;
    const r = rand();
    let kind: BalloonKind = "normal";
    if (r < 0.06) kind = "cloud";
    else if (r < 0.1) kind = "rainbow";
    else if (r < 0.16) kind = "chain";
    else if (r < 0.26) kind = "iron";
    else if (r < 0.33) kind = "gift";
    else if (r < 0.43) kind = "twin";
    if (kind === "gift") {
      if (at < giftFreeAt) kind = "normal";
      else giftFreeAt = at + festGiftFlightS(wave);
    }
    out.push({
      at,
      kind,
      color: Math.floor(rand() * colors),
      num: 1 + Math.floor(rand() * 5),
      x: 8 + rand() * 76,
      far: rand() < 0.22
    });
    at += festSpawnMs(wave) / 1000;
  }
  return out;
}

/** 接着 `prev` 这一段往下续一段：波次与时刻都接得上，礼物上限也接着守 */
export function festExtend(prev: readonly FestSpawn[], seed: number, count = FEST_CHUNK, colors = 5): FestSpawn[] {
  const fromWave = prev.length;
  if (fromWave === 0) return festPlan(seed, count, colors);
  const last = prev[fromWave - 1];
  return festPlan(seed, count, colors, fromWave, last.at + festSpawnMs(fromWave - 1) / 1000);
}

/** 戳破一颗气球在气球节里值多少分 */
export function festScoreFor(kind: BalloonKind, chainLen = 1, far = false): number {
  const base = kind === "iron" ? 15 : kind === "twin" ? 12 : kind === "rainbow" ? 20 : kind === "chain" ? 18 : 10;
  const chain = chainLen > 1 ? chainScore(chainLen) : 0;
  return Math.round((base + chain) * (far ? FAR_BONUS : 1));
}

export interface FestState {
  score: number;
  popped: number;
  missed: number;
  combo: number;
  bestCombo: number;
  over: boolean;
}

export function festInit(): FestState {
  return { score: 0, popped: 0, missed: 0, combo: 0, bestCombo: 0, over: false };
}

export function festPop(st: FestState, kind: BalloonKind, chainLen = 1, far = false): FestState {
  if (st.over) return st;
  const combo = st.combo + 1;
  const gained = festScoreFor(kind, chainLen, far) + Math.min(20, (combo - 1) * 2);
  return {
    ...st,
    score: st.score + gained,
    popped: st.popped + Math.max(1, chainLen),
    combo,
    bestCombo: Math.max(st.bestCombo, combo)
  };
}

/** 放跑一颗该戳的气球 */
export function festMiss(st: FestState): FestState {
  if (st.over) return st;
  const missed = st.missed + 1;
  return { ...st, missed, combo: 0, over: missed >= FEST_MISS_LIMIT };
}

/** 戳到礼物气球：扣分但绝不结束，也不扣「漏掉」的次数 */
export function festGift(st: FestState): FestState {
  if (st.over) return st;
  return { ...st, score: Math.max(0, st.score - KINDS.gift.penalty), combo: 0 };
}

// ---------------------------------------------------------------------------
// 七、188 关模拟：不开画面也能验证「这一关够得着」
// ---------------------------------------------------------------------------

export interface SimOptions {
  seed?: number;
  dt?: number;
  /** 假玩家两次点击之间的最短间隔（秒） */
  tapGap?: number;
  /** 假玩家看到气球到出手的反应时间（秒） */
  reaction?: number;
  maxSeconds?: number;
}

export interface SimResult {
  won: boolean;
  popped: number;
  target: number;
  escaped: number;
  mistakes: number;
  giftLost: number;
  seconds: number;
}

interface SimBalloon {
  id: number;
  kind: BalloonKind;
  color: number;
  num: number;
  x: number;
  y: number;
  born: number;
  taps: number;
}

/**
 * 让一个「反应有延迟、手速有上限」的假玩家把一关打一遍。
 * 目标：188 关每一关都够得着（不是靠神级手速）。
 */
export function simulateLevel(cfg: BalloonLevel, opts: SimOptions = {}): SimResult {
  const dt = opts.dt ?? 1 / 30;
  const tapGap = opts.tapGap ?? 0.24;
  const reaction = opts.reaction ?? 0.3;
  const maxSeconds = opts.maxSeconds ?? 240;
  const rand = mulberry32((opts.seed ?? 20250519) >>> 0);
  const colors = 5;
  const goal = levelGoal(cfg);

  let t = 0;
  let nextSpawn = 0;
  let nextTap = 0;
  let id = 1;
  let popped = 0;
  let escaped = 0;
  let mistakes = 0;
  let giftLost = 0;
  let sincePops = 0;
  let targetColor = Math.floor(rand() * colors);
  let targetNum = 1;
  const live: SimBalloon[] = [];

  const air: AirCfg = { riseSpeed: cfg.riseSpeed, wind: cfg.wind, windFlipMs: cfg.windFlipMs };

  const isTarget = (b: SimBalloon) =>
    isTargetBalloon(cfg, b, targetColor, targetNum);

  while (t < maxSeconds) {
    t += dt;

    if (t >= nextSpawn) {
      nextSpawn = t + cfg.spawnMs / 1000;
      const r = rand();
      const chainChance = cfg.chainChance ?? 0;
      const giftChance = cfg.giftChance ?? 0;
      const twinChance = cfg.twinChance ?? 0;
      let kind: BalloonKind = "normal";
      if (r < cfg.cloudChance) kind = "cloud";
      else if (r < cfg.cloudChance + cfg.rainbowChance) kind = "rainbow";
      else if (r < cfg.cloudChance + cfg.rainbowChance + chainChance) kind = "chain";
      else if (r < cfg.cloudChance + cfg.rainbowChance + chainChance + giftChance) {
        kind = canSpawnGift(live.filter((b) => b.kind === "gift").length) ? "gift" : "normal";
      }
      else if (r < cfg.cloudChance + cfg.rainbowChance + chainChance + giftChance + twinChance) kind = "twin";
      else if (rand() < (cfg.shieldChance ?? 0)) kind = "iron";
      live.push({
        id: id++,
        kind,
        color: Math.floor(rand() * colors),
        num: 1 + Math.floor(rand() * 5),
        x: 8 + rand() * 76,
        y: SKY_H + 40,
        born: t,
        taps: 0
      });
    }

    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i];
      b.y -= (b.kind === "gift" ? air.riseSpeed * GIFT_RISE_MUL : air.riseSpeed) * dt;
      if (b.y >= ESCAPE_Y) continue;
      live.splice(i, 1);
      if (b.kind === "gift") {
        if (giftGuarded(goal)) giftLost++;
      } else if (isTarget(b)) {
        escaped++;
      }
    }

    // 假玩家：够得着就戳最靠上的那一颗，绝不碰乌云；
    // 礼物气球快飘到顶了就轻轻摇一下把它按回去（宁可扣分也不能让它跑掉）
    if (t >= nextTap) {
      const urgentGift = live.find((b) => b.kind === "gift" && b.y < 150 && t - b.born >= reaction);
      if (goal === "protect" && urgentGift) {
        nextTap = t + tapGap;
        urgentGift.y = Math.min(SKY_H + 40, urgentGift.y + tapBalloon("gift").pushDown);
      }
      const pickable = live
        .filter((b) => t - b.born >= reaction && (b.kind === "rainbow" || b.kind === "chain" || isTarget(b)))
        .sort((a, b) => a.y - b.y);
      const pick = t >= nextTap ? pickable[0] : undefined;
      if (pick) {
        nextTap = t + tapGap;
        const res = tapBalloon(pick.kind, pick.taps);
        if (!res.popped) {
          pick.taps++;
        } else {
          live.splice(live.indexOf(pick), 1);
          if (pick.kind === "rainbow") {
            const ids = rainbowTargets(live.map((b) => ({ id: b.id, x: b.x, y: b.y, color: b.color, kind: b.kind }))).ids;
            for (const rid of ids) {
              const idx = live.findIndex((b) => b.id === rid);
              if (idx < 0) continue;
              if (isTarget(live[idx])) popped++;
              live.splice(idx, 1);
            }
          } else if (pick.kind === "chain") {
            const nodes = live.map((b) => ({ id: b.id, x: (b.x / 100) * 360, y: b.y, color: b.color, kind: b.kind }));
            for (const bid of blastGroup([{ id: pick.id, x: (pick.x / 100) * 360, y: pick.y, color: pick.color, kind: pick.kind }, ...nodes], pick.id)) {
              const idx = live.findIndex((b) => b.id === bid);
              if (idx < 0) continue;
              if (isTarget(live[idx])) popped++;
              live.splice(idx, 1);
            }
          } else {
            popped++;
            sincePops++;
            if (cfg.mode === "number" || cfg.mode === "math") targetNum = targetNum >= 5 ? 1 : targetNum + 1;
            else if (cfg.mode === "color" && sincePops >= 4) {
              sincePops = 0;
              targetColor = (targetColor + 1) % colors;
            }
          }
        }
      }
    }

    const st: GoalState = { popped, target: cfg.target, escaped, escapes: cfg.escapes, mistakes, giftLost };
    if (goalReached(goal, st)) {
      return { won: true, popped, target: cfg.target, escaped, mistakes, giftLost, seconds: t };
    }
    if (goalFailure(goal, st)) break;
  }

  return { won: false, popped, target: cfg.target, escaped, mistakes, giftLost, seconds: t };
}

// ---------------------------------------------------------------------------
// 八、资源看管：destroy 之后必须一件不剩
// ---------------------------------------------------------------------------

export interface TimerHost {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  setInterval?(fn: () => void, ms: number): number;
  clearInterval?(id: number): void;
  requestAnimationFrame?(fn: (t: number) => void): number;
  cancelAnimationFrame?(id: number): void;
}

export interface ListenerTarget {
  addEventListener(type: string, fn: (ev: Event) => void): void;
  removeEventListener(type: string, fn: (ev: Event) => void): void;
}

function defaultHost(): TimerHost {
  const g = globalThis as unknown as TimerHost;
  return {
    setTimeout: (fn, ms) => g.setTimeout(fn, ms),
    clearTimeout: (id) => g.clearTimeout(id),
    setInterval: g.setInterval ? (fn, ms) => (g.setInterval as (f: () => void, m: number) => number)(fn, ms) : undefined,
    clearInterval: g.clearInterval ? (id) => (g.clearInterval as (i: number) => void)(id) : undefined,
    requestAnimationFrame: g.requestAnimationFrame
      ? (fn) => (g.requestAnimationFrame as (f: (t: number) => void) => number)(fn)
      : undefined,
    cancelAnimationFrame: g.cancelAnimationFrame
      ? (id) => (g.cancelAnimationFrame as (i: number) => void)(id)
      : undefined
  };
}

/** 定时器 / 循环 / rAF / 监听的总管：`pending()` 在 destroy 之后必须是 0 */
export class Janitor {
  private timers = new Set<number>();
  private loops = new Set<number>();
  private frames = new Set<number>();
  private offs: Array<() => void> = [];
  private readonly host: TimerHost;
  dead = false;

  constructor(host?: TimerHost) {
    this.host = host ?? defaultHost();
  }

  pending(): number {
    return this.timers.size + this.loops.size + this.frames.size + this.offs.length;
  }

  after(ms: number, fn: () => void): number {
    const id = this.host.setTimeout(() => {
      this.timers.delete(id);
      if (!this.dead) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  every(ms: number, fn: () => void): number {
    if (!this.host.setInterval) return 0;
    const id = this.host.setInterval(() => {
      if (!this.dead) fn();
    }, ms);
    this.loops.add(id);
    return id;
  }

  stopLoop(id: number): void {
    if (!this.loops.has(id)) return;
    this.loops.delete(id);
    this.host.clearInterval?.(id);
  }

  frame(fn: (t: number) => void): number {
    if (!this.host.requestAnimationFrame) return 0;
    const id = this.host.requestAnimationFrame((t) => {
      this.frames.delete(id);
      if (!this.dead) fn(t);
    });
    this.frames.add(id);
    return id;
  }

  on<T extends ListenerTarget>(target: T, type: string, fn: (ev: Event) => void): void {
    target.addEventListener(type, fn);
    this.own(() => target.removeEventListener(type, fn));
  }

  own(off: () => void): void {
    this.offs.push(off);
  }

  destroy(): void {
    this.dead = true;
    for (const id of this.timers) this.host.clearTimeout(id);
    this.timers.clear();
    for (const id of this.loops) this.host.clearInterval?.(id);
    this.loops.clear();
    for (const id of this.frames) this.host.cancelAnimationFrame?.(id);
    this.frames.clear();
    while (this.offs.length) {
      try {
        this.offs.pop()?.();
      } catch (err) {
        console.warn("[一朵一星] 气球砰砰清理时出错:", err);
      }
    }
  }
}
