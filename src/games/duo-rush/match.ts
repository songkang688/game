/**
 * 朵星双人冲刺 · 一局对战的确定性状态机。
 *
 * 这里不碰 canvas、不碰 DOM，只管「输入进来、时间往前推、谁赢了」，
 * 所以整局比赛可以在单测里原样重放。
 *
 * 公平性是靠**结构**保证的，不是靠巧合：两个人共用同一个 `TrackGen`，
 * 看到的是同一个实体数组的同一批元素，各自只保留一个读到哪儿的下标。
 * 想让两人赛道不一样，除非把这个共享对象拆掉——`match.test.ts` 会当场发现。
 */
import { createBrain, decide, type AiBrain, type AiLevel } from "./ai";
import type { Action, Seat } from "./keys";
import {
  BOOST_MULT,
  BOOST_SECONDS,
  COIN_RACE_TARGET,
  CRASH_LIMIT,
  HIT_SAFE_SECONDS,
  JUMP_SECONDS,
  MAX_HEARTS,
  SLIDE_SECONDS,
  type Entity,
  type GhostRecord,
  type RaceMode,
  type TrackGen,
  createTrackGen,
  endlessWinner,
  ghostDistAt,
  isObstacle,
  rushWinner,
  speedAt,
  survivesMove,
} from "./logic";
import { handicapMult } from "./rush12";

export type MatchEvent = "coin" | "boost" | "jump" | "slide" | "lane" | "crash" | "out" | "over";

/** 撞一下之后踉跄多久（抢金币赛不掉心，改成绊倒） */
export const STUMBLE_SECONDS = 1;
/** 换道动画的跟随速度 */
export const LANE_LERP = 14;
/** 模拟切片上限：再大的 dt 也切成这么小一片一片推，保证手感与结果稳定 */
export const FIXED_STEP = 1 / 120;
/** 每帧最多推进多少秒（切后台回来不要一口气冲出去） */
export const MAX_FRAME_SECONDS = 0.1;
/** 往前预生成多少米的赛道 */
export const LOOKAHEAD_METERS = 220;

export interface Runner {
  seat: Seat;
  name: string;
  emoji: string;
  lane: 0 | 1 | 2;
  /** 换道动画用的连续车道位置 */
  laneFloat: number;
  dist: number;
  coins: number;
  crashes: number;
  hearts: number;
  jumpUntil: number;
  slideUntil: number;
  safeUntil: number;
  boostUntil: number;
  stunUntil: number;
  /** 共享实体表里已经处理到的下标 */
  resolved: number;
  /** 跑不动了（心用完 / 撞满三次 / 幽灵跑完自己的成绩） */
  out: boolean;
  /** 撞击晃动，1 → 0 */
  bump: number;
  /** 这是一条录像回放出来的幽灵，不参与碰撞 */
  ghost: boolean;
}

export interface MatchOptions {
  mode: RaceMode;
  seed: number;
  /** 2 号座位交给电脑；null 表示两个真人 */
  aiLevel?: AiLevel | null;
  /** 幽灵对战用的上一次成绩 */
  ghost?: GhostRecord | null;
  names?: [string, string];
  emojis?: [string, string];
  /** 让分：给落后一方最多 8% 的温和追赶助推，默认关闭 */
  handicap?: boolean;
}

export interface MatchState {
  mode: RaceMode;
  seed: number;
  time: number;
  gen: TrackGen;
  runners: [Runner, Runner];
  ai: AiBrain | null;
  aiLevel: AiLevel | null;
  ghost: GhostRecord | null;
  /** 让分开关（HUD 要显示） */
  handicap: boolean;
  over: boolean;
  /** 0 = 朵朵赢，1 = 星星（或电脑 / 幽灵）赢，-1 = 平局，null = 还没打完 */
  winner: 0 | 1 | -1 | null;
  events: MatchEvent[];
}

function makeRunner(seat: Seat, name: string, emoji: string, ghost: boolean): Runner {
  return {
    seat,
    name,
    emoji,
    lane: 1,
    laneFloat: 1,
    dist: 0,
    coins: 0,
    crashes: 0,
    hearts: MAX_HEARTS,
    jumpUntil: -1,
    slideUntil: -1,
    safeUntil: -1,
    boostUntil: -1,
    stunUntil: -1,
    resolved: 0,
    out: false,
    bump: 0,
    ghost,
  };
}

export function createMatch(opts: MatchOptions): MatchState {
  const names = opts.names ?? ["朵朵", "星星"];
  const emojis = opts.emojis ?? ["🌸", "⭐"];
  const isGhostRace = opts.mode === "ghost";
  const aiLevel = isGhostRace ? null : (opts.aiLevel ?? null);
  const rival = isGhostRace ? "上次的自己" : names[1];
  const rivalEmoji = isGhostRace ? "👻" : emojis[1];
  return {
    mode: opts.mode,
    seed: opts.seed >>> 0,
    time: 0,
    // 一个生成器，两个人读同一份 —— 对称性从这里来
    gen: createTrackGen(opts.seed >>> 0),
    runners: [
      makeRunner(0, names[0], emojis[0], false),
      makeRunner(1, rival, rivalEmoji, isGhostRace),
    ],
    ai: aiLevel === null ? null : createBrain(aiLevel, (opts.seed >>> 0) ^ 0x5bd1e995),
    aiLevel,
    ghost: isGhostRace ? (opts.ghost ?? null) : null,
    handicap: opts.handicap === true,
    over: false,
    winner: null,
    events: [],
  };
}

/** 两个人看到的赛道（同一个数组，所以永远一模一样）。 */
export function trackFor(state: MatchState, _seat: Seat): Entity[] {
  return state.gen.ensure(farthestDist(state) + LOOKAHEAD_METERS);
}

function farthestDist(state: MatchState): number {
  return Math.max(state.runners[0].dist, state.runners[1].dist);
}

/** 这一档赛制里，撞车会不会扣掉一条命 */
function crashCostsLife(mode: RaceMode): boolean {
  return mode !== "coins";
}

/** 无尽对战按心算，竞速与幽灵按撞车次数算，都是 3 条 */
export function livesLeft(state: MatchState, seat: Seat): number {
  const r = state.runners[seat];
  if (state.mode === "coins") return MAX_HEARTS;
  if (state.mode === "endless") return Math.max(0, r.hearts);
  return Math.max(0, CRASH_LIMIT - r.crashes);
}

/* ---------------- 输入 ---------------- */

export function isJumping(state: MatchState, r: Runner): boolean {
  return state.time < r.jumpUntil;
}

export function isSliding(state: MatchState, r: Runner): boolean {
  return state.time < r.slideUntil;
}

/** 把一次操作交给某个座位。轮不到它动（出局 / 踉跄 / 已结束）就直接吞掉。 */
export function applyAction(state: MatchState, seat: Seat, action: Action): boolean {
  if (state.over) return false;
  const r = state.runners[seat];
  if (r.out || r.ghost) return false;
  if (state.time < r.stunUntil) return false;
  if (action === "left" || action === "right") {
    const next = Math.max(0, Math.min(2, r.lane + (action === "left" ? -1 : 1))) as 0 | 1 | 2;
    if (next === r.lane) return false;
    r.lane = next;
    state.events.push("lane");
    return true;
  }
  if (action === "jump") {
    if (isJumping(state, r) || isSliding(state, r)) return false;
    r.jumpUntil = state.time + JUMP_SECONDS;
    state.events.push("jump");
    return true;
  }
  if (isJumping(state, r) || isSliding(state, r)) return false;
  r.slideUntil = state.time + SLIDE_SECONDS;
  state.events.push("slide");
  return true;
}

/* ---------------- 推进 ---------------- */

function resolveEntity(state: MatchState, r: Runner, e: Entity): void {
  if (e.lane !== r.lane) return;
  if (e.kind === "coin") {
    r.coins++;
    state.events.push("coin");
    return;
  }
  if (e.kind === "boost") {
    if (isJumping(state, r)) return;
    r.boostUntil = state.time + BOOST_SECONDS;
    state.events.push("boost");
    return;
  }
  if (!isObstacle(e.kind)) return;
  if (survivesMove(e.kind, { jumping: isJumping(state, r), sliding: isSliding(state, r) })) return;
  if (state.time < r.safeUntil) return;
  r.crashes++;
  r.bump = 1;
  r.safeUntil = state.time + HIT_SAFE_SECONDS;
  state.events.push("crash");
  if (!crashCostsLife(state.mode)) {
    r.stunUntil = state.time + STUMBLE_SECONDS;
    return;
  }
  if (state.mode === "endless") {
    r.hearts--;
    if (r.hearts <= 0) {
      r.out = true;
      state.events.push("out");
    }
    return;
  }
  if (r.crashes >= CRASH_LIMIT) {
    r.out = true;
    state.events.push("out");
  }
}

function advance(state: MatchState, r: Runner, h: number): void {
  if (r.out) return;
  r.bump = Math.max(0, r.bump - h * 3);
  if (state.time < r.stunUntil) return;
  let speed = speedAt(r.dist);
  if (state.time < r.boostUntil) speed *= BOOST_MULT;
  // 让分：默认关，开了也只给落后的一方最多 8%
  speed *= handicapMult(state.handicap, r.dist, state.runners[r.seat === 0 ? 1 : 0].dist);
  r.dist += speed * h;
  r.laneFloat += (r.lane - r.laneFloat) * Math.min(1, h * LANE_LERP);
  const entities = state.gen.ensure(r.dist + LOOKAHEAD_METERS);
  while (r.resolved < entities.length && entities[r.resolved].at <= r.dist) {
    const e = entities[r.resolved];
    r.resolved++;
    resolveEntity(state, r, e);
  }
}

function advanceGhost(state: MatchState, r: Runner): void {
  if (!state.ghost) {
    r.out = true; // 还没有上一次的成绩，幽灵就站在起点不动
    return;
  }
  r.dist = ghostDistAt(state.ghost, state.time);
  if (r.dist >= state.ghost.dist) r.out = true;
}

function settle(state: MatchState): void {
  if (state.over) return;
  const [a, b] = state.runners;
  if (state.mode === "coins") {
    if (a.coins >= COIN_RACE_TARGET || b.coins >= COIN_RACE_TARGET) {
      finish(state, a.coins >= COIN_RACE_TARGET ? 0 : 1);
    }
    return;
  }
  if (state.mode === "endless") {
    if (a.out && b.out) {
      finish(
        state,
        endlessWinner(
          { dist: a.dist, coins: a.coins, crashed: a.out },
          { dist: b.dist, coins: b.coins, crashed: b.out },
        ),
      );
    }
    return;
  }
  if (state.mode === "ghost") {
    // 比的是「这一次跑得比上一次远吗」，所以拿的是幽灵那次的**最终**成绩，
    // 不是它此刻跑到哪儿——画面上的幽灵只负责把配速演出来。
    const best = state.ghost?.dist ?? 0;
    if (a.dist >= best && state.ghost) {
      finish(state, 0); // 追过纪录，当场获胜
    } else if (a.out) {
      finish(state, a.dist >= best ? 0 : 1);
    }
    return;
  }
  // rush：先撞满三次的人输，不用等对手
  if (a.out || b.out) {
    finish(
      state,
      rushWinner(
        { dist: a.dist, coins: a.coins, crashes: a.crashes },
        { dist: b.dist, coins: b.coins, crashes: b.crashes },
      ),
    );
  }
}

function finish(state: MatchState, winner: 0 | 1 | -1): void {
  state.over = true;
  state.winner = winner;
  state.events.push("over");
}

function runAi(state: MatchState): void {
  const brain = state.ai;
  if (!brain) return;
  const r = state.runners[1];
  if (r.out || r.ghost) return;
  if (state.time < r.stunUntil) return;
  const action = decide(
    brain,
    {
      lane: r.lane,
      dist: r.dist,
      speed: speedAt(r.dist),
      jumping: isJumping(state, r),
      sliding: isSliding(state, r),
      entities: state.gen.ensure(r.dist + LOOKAHEAD_METERS),
      from: r.resolved,
      rivalLane: state.runners[0].lane,
    },
    state.time,
  );
  if (action) applyAction(state, 1, action);
}

/**
 * 往前推 dt 秒。内部切成固定小片，所以 60fps 和 30fps 跑出来的结果几乎一样，
 * 也不会因为掉一帧就把人直接送进石头里。
 */
export function stepMatch(state: MatchState, dt: number): void {
  if (state.over) return;
  let left = Math.min(MAX_FRAME_SECONDS, Math.max(0, dt));
  while (left > 1e-9 && !state.over) {
    const h = Math.min(FIXED_STEP, left);
    left -= h;
    state.time += h;
    runAi(state);
    advance(state, state.runners[0], h);
    if (state.runners[1].ghost) advanceGhost(state, state.runners[1]);
    else advance(state, state.runners[1], h);
    settle(state);
  }
}

/** 取出并清空这一帧攒下的事件（外面拿去放音效）。 */
export function drainEvents(state: MatchState): MatchEvent[] {
  const out = state.events;
  state.events = [];
  return out;
}

/** 中途结束（换玩法 / 返回）时按当前成绩判一次，供收尾文案用。 */
export function forceSettle(state: MatchState): 0 | 1 | -1 {
  const [a, b] = state.runners;
  if (state.winner !== null) return state.winner;
  return rushWinner(
    { dist: a.dist, coins: a.coins, crashes: a.crashes },
    { dist: b.dist, coins: b.coins, crashes: b.crashes },
  );
}
