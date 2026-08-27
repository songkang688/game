/**
 * 梨康双人冲刺 · 一局对战的确定性状态机。
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
  type TrackDifficulty,
  type TrackGen,
  createTrackGen,
  endlessWinner,
  ghostDistAt,
  isObstacle,
  rushWinner,
  speedAt,
  survivesMove,
} from "./logic";
import {
  FORK_LENGTH,
  FORK_MIN_SPACING,
  POWERUP_KINDS,
  type ForkSection,
  type GhostSource,
  type PowerupKind,
  type PowerupState,
  absorbCrash,
  applyPowerup,
  createPowerupState,
  handicapMult,
  magnetRadius,
  pickPowerup,
  planForks,
  powerupSpeedMult,
  tickPowerups,
} from "./rush12";
import { laneLerpRate } from "./view25d";

export type MatchEvent =
  | "coin"
  | "boost"
  | "jump"
  | "slide"
  | "lane"
  | "crash"
  | "out"
  | "over"
  /* 1.2 第 11 步 A 新增 */
  | "power" // 捡到一件道具
  | "use" // 把道具用出去
  | "shield" // 护盾泡替你挡了一下
  | "confetti" // 被对手撒了一把彩纸
  | "cheer" // 给对手加油
  | "fork" // 进了分岔口
  | "merge"; // 两条支路合流

/** 撞一下之后踉跄多久（抢金币赛不掉心，改成绊倒） */
export const STUMBLE_SECONDS = 1;
/** 换道动画的跟随速度：按 `view25d.LANE_TWEEN_SECONDS`（100ms）换算 */
export const LANE_LERP = laneLerpRate();
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
  /* ---- 1.2 第 11 步 A 新增 ---- */
  /** 身上挂着的道具效果（加速云 / 彩纸 / 磁力星的剩余秒数与护盾层数） */
  powers: PowerupState;
  /** 手上还没用出去的那一件（最多一件，按 F / L 才用） */
  held: PowerupKind | null;
  /** 正走在分岔的哪条支路上（null = 在主赛道） */
  branch: 0 | 1 | null;
  /** 走的是哪个分岔口（按分岔口的米数记） */
  branchAt: number;
  /** 支路实体表读到哪儿了 */
  branchResolved: number;
  /** 加油动作的余韵到什么时候（纯表现，不动成绩） */
  cheerUntil: number;
}

/** 加油那一下在画面上留多久 */
export const CHEER_SECONDS = 1.1;

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
  /* ---- 1.2 第 11 步 A 新增，不传就是 1.1 的老赛道 ---- */
  /** 赛道难度档（默认 1 = 1.1 原参数） */
  difficulty?: TrackDifficulty;
  /** 中途分岔（`items` 赛制默认开，其余默认关） */
  forks?: boolean;
  /** 赛道上撒道具（`items` 赛制默认开，其余默认关） */
  powerups?: boolean;
  /** 幽灵是「自己上次」还是「对手上一局」 */
  ghostSource?: GhostSource;
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
  /* ---- 1.2 第 11 步 A 新增 ---- */
  difficulty: TrackDifficulty;
  /** 中途分岔开着吗 */
  useForks: boolean;
  /** 赛道上撒道具吗 */
  usePowerups: boolean;
  /** 已经排好的分岔口（两个人共用同一份，位置只看种子） */
  forks: ForkSection[];
  /** 幽灵录像来自谁 */
  ghostSource: GhostSource;
  over: boolean;
  /** 0 = 鸭梨赢，1 = 康康（或电脑 / 幽灵）赢，-1 = 平局，null = 还没打完 */
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
    powers: createPowerupState(),
    held: null,
    branch: null,
    branchAt: -1,
    branchResolved: 0,
    cheerUntil: -1,
  };
}

/**
 * 分岔段占住的主赛道区间：排布规则和 `rush12.planForks` 完全一致
 * （每 `FORK_MIN_SPACING` 米一个，长 `FORK_LENGTH` 米），
 * 主赛道在这一段留白，改由支路铺。
 */
export function forkSpanBetween(
  from: number,
  to: number,
): { start: number; end: number } | null {
  const firstK = Math.max(1, Math.floor(from / FORK_MIN_SPACING));
  for (let k = firstK; k * FORK_MIN_SPACING <= to; k++) {
    const start = k * FORK_MIN_SPACING;
    const end = start + FORK_LENGTH;
    if (from < end && to > start) return { start, end };
  }
  return null;
}

/** 正好落在哪个分岔段里（不在任何分岔里就是 null）。 */
export function forkAt(forks: readonly ForkSection[], dist: number): ForkSection | null {
  for (const f of forks) {
    if (dist >= f.at && dist < f.mergeAt) return f;
  }
  return null;
}

/**
 * 进分岔口那一刻在第几道，就走哪条支路：右道（2）走右边那条，左道与中道走左边那条。
 * 哪一条更难由 `buildFork` 按种子决定（不固定在某一边），所以孩子不会养成盲选的习惯。
 */
export function branchForLane(lane: number): 0 | 1 {
  return lane >= 2 ? 1 : 0;
}

export function createMatch(opts: MatchOptions): MatchState {
  const names = opts.names ?? ["鸭梨", "康康"];
  const emojis = opts.emojis ?? ["🍐", "👓"];
  const isGhostRace = opts.mode === "ghost";
  const aiLevel = isGhostRace ? null : (opts.aiLevel ?? null);
  const ghostSource: GhostSource = opts.ghostSource ?? "self";
  const rival = isGhostRace ? (ghostSource === "rival" ? "上一局的对手" : "上次的自己") : names[1];
  const rivalEmoji = isGhostRace ? (ghostSource === "rival" ? "🫥" : "👻") : emojis[1];
  const seed = opts.seed >>> 0;
  const difficulty = opts.difficulty ?? 1;
  // 道具竞速这一档默认就把道具与分岔打开，其余赛制不传就是 1.1 的老赛道
  const isItemRace = opts.mode === "items";
  const useForks = opts.forks ?? isItemRace;
  const usePowerups = opts.powerups ?? isItemRace;
  return {
    mode: opts.mode,
    seed,
    time: 0,
    // 一个生成器，两个人读同一份 —— 对称性从这里来
    gen: createTrackGen(seed, {
      difficulty,
      powerups: usePowerups ? POWERUP_KINDS : [],
      holeAt: useForks ? forkSpanBetween : undefined,
    }),
    runners: [
      makeRunner(0, names[0], emojis[0], false),
      makeRunner(1, rival, rivalEmoji, isGhostRace),
    ],
    ai: aiLevel === null ? null : createBrain(aiLevel, seed ^ 0x5bd1e995),
    aiLevel,
    ghost: isGhostRace ? (opts.ghost ?? null) : null,
    handicap: opts.handicap === true,
    difficulty,
    useForks,
    usePowerups,
    forks: useForks ? planForks(0, FORK_PLAN_AHEAD, seed) : [],
    ghostSource,
    over: false,
    winner: null,
    events: [],
  };
}

/** 一上来先把这么远的分岔口排出来，不够了再往后续（纯算术，很便宜） */
export const FORK_PLAN_AHEAD = 4000;

/** 保证分岔计划表覆盖到 upTo 米。 */
export function ensureForks(state: MatchState, upTo: number): ForkSection[] {
  if (!state.useForks) return state.forks;
  const last = state.forks[state.forks.length - 1];
  if (!last || last.mergeAt < upTo) {
    state.forks = planForks(0, upTo + FORK_PLAN_AHEAD, state.seed);
  }
  return state.forks;
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

/** 差距小于这么多就算持平，免得小皇冠一路来回跳 */
export const CROWN_MIN_GAP = 4;

/**
 * 此刻谁领先（-1 = 不分上下）。抢金币赛比金币，其余赛制比距离。
 * 只用来在领先者头上画一顶小皇冠——落后的一方界面上不会出现任何评价文字。
 */
export function leaderSeat(state: MatchState): 0 | 1 | -1 {
  const [a, b] = state.runners;
  if (state.mode === "coins") {
    if (a.coins === b.coins) return -1;
    return a.coins > b.coins ? 0 : 1;
  }
  if (Math.abs(a.dist - b.dist) < CROWN_MIN_GAP) return -1;
  return a.dist > b.dist ? 0 : 1;
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
  if (action === "cheer") {
    // 纯打气：只在画面上冒一个小爱心，成绩一个数都不动
    r.cheerUntil = state.time + CHEER_SECONDS;
    state.events.push("cheer");
    return true;
  }
  if (action === "use") {
    if (!r.held) return false; // 空手按，什么都不发生
    const used = pickPowerup(r.powers, r.held);
    r.held = null;
    r.powers = used.self;
    state.events.push("use");
    if (used.toOpponent) {
      const rival = state.runners[seat === 0 ? 1 : 0];
      // 幽灵是一段录像，撒它没用；撒到人身上也只是慢一点点，不掉心、不打断动作
      if (!rival.ghost) rival.powers = applyPowerup(rival.powers, used.toOpponent);
      state.events.push("confetti");
    }
    return true;
  }
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

/** 磁力星开着的时候，隔壁一条道、`MAGNET_RADIUS` 米以内的金币会自己飘过来。 */
export function magnetPulls(r: Runner, laneGap: number): boolean {
  return magnetRadius(r.powers) > 0 && Math.abs(laneGap) <= 1;
}

function resolveEntity(state: MatchState, r: Runner, e: Entity): void {
  const laneGap = e.lane - r.lane;
  if (e.kind === "coin") {
    if (laneGap !== 0 && !magnetPulls(r, laneGap)) return;
    r.coins++;
    state.events.push("coin");
    return;
  }
  if (laneGap !== 0) return;
  if (e.kind === "power") {
    // 捡起来先揣着，按 F / L 才用出去
    r.held = e.power ?? "speedCloud";
    state.events.push("power");
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
  const guard = absorbCrash(r.powers);
  if (guard.blocked) {
    // 护盾泡替你挡了一下：泡泡破掉，人一点事没有，也不算撞车
    r.powers = guard.state;
    r.safeUntil = state.time + HIT_SAFE_SECONDS;
    state.events.push("shield");
    return;
  }
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

/**
 * 走到分岔口就按当前车道选一条支路，走到合流点再回主赛道。
 * 两条支路等长，所以不管选哪条，**回到主赛道的那一米完全一样**。
 */
function updateFork(state: MatchState, r: Runner): void {
  if (!state.useForks || r.ghost) return;
  const here = forkAt(ensureForks(state, r.dist + LOOKAHEAD_METERS), r.dist);
  if (here) {
    if (r.branch === null || r.branchAt !== here.at) {
      r.branch = branchForLane(r.lane);
      r.branchAt = here.at;
      r.branchResolved = 0;
      state.events.push("fork");
    }
    const list = here.branches[r.branch].entities;
    while (r.branchResolved < list.length && list[r.branchResolved].at <= r.dist) {
      const e = list[r.branchResolved];
      r.branchResolved++;
      resolveEntity(state, r, e);
    }
    return;
  }
  if (r.branch !== null) {
    r.branch = null;
    r.branchResolved = 0;
    state.events.push("merge");
  }
}

function advance(state: MatchState, r: Runner, h: number): void {
  if (r.out) return;
  r.bump = Math.max(0, r.bump - h * 3);
  r.powers = tickPowerups(r.powers, h);
  if (state.time < r.stunUntil) return;
  let speed = speedAt(r.dist);
  if (state.time < r.boostUntil) speed *= BOOST_MULT;
  // 道具：加速云推一把、彩纸慢一点点，两个同时挂着就互相抵一部分
  speed *= powerupSpeedMult(r.powers);
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
  updateFork(state, r);
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

/**
 * 这个座位此刻该看哪一份实体表：在分岔支路上就看支路的，否则看共用的主赛道。
 * 电脑与画面都用它，所以电脑看到的和玩家看到的是同一份东西。
 */
export function entitiesFor(state: MatchState, seat: Seat): { entities: Entity[]; from: number } {
  const r = state.runners[seat];
  if (r.branch !== null) {
    const fork = state.forks.find((f) => f.at === r.branchAt);
    if (fork) return { entities: fork.branches[r.branch].entities, from: r.branchResolved };
  }
  return { entities: state.gen.ensure(r.dist + LOOKAHEAD_METERS), from: r.resolved };
}

function runAi(state: MatchState): void {
  const brain = state.ai;
  if (!brain) return;
  const r = state.runners[1];
  if (r.out || r.ghost) return;
  if (state.time < r.stunUntil) return;
  const thinking = state.time >= brain.nextThinkAt;
  const view = entitiesFor(state, 1);
  const action = decide(
    brain,
    {
      lane: r.lane,
      dist: r.dist,
      speed: speedAt(r.dist),
      jumping: isJumping(state, r),
      sliding: isSliding(state, r),
      entities: view.entities,
      from: view.from,
      rivalLane: state.runners[0].lane,
    },
    state.time,
  );
  if (action) applyAction(state, 1, action);
  // 手上有道具就用掉：新手档想不起来用，其余档一想到就用。
  // 这里不摇随机数，免得动到老对局的随机序列。
  if (thinking && brain.level >= 1 && r.held) applyAction(state, 1, "use");
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
