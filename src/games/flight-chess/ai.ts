/**
 * 飞行棋乐园 · 四档电脑对手 + 整局模拟器（纯函数，可复现）。
 *
 * | 档 | 行为 |
 * | 菜鸟 | 有能起飞的点就起飞，否则推最靠前的那架 |
 * | 普通 | 能撞就撞，撞不到就照菜鸟走 |
 * | 高手 | 会叠子挡路、会算「正好到终点」、会躲开明显要挨撞的落点 |
 * | 地狱 | 再加上守你的航线落点、算清跳格链，必要时用一架换掉你一整座叠机堡垒 |
 */
import {
  AIRLINE_TO,
  BASE,
  GOAL,
  JUMP_STEP,
  PLANES_PER_COLOR,
  RING_LEN,
  canJumpFrom,
  isAirline,
  ringAt,
  type Color
} from "./board";
import { CLASSIC_RULES, canTakeOff, extraRoll, roll, takeOffGrantsExtra, type Rules } from "./dice";
import {
  applyMove,
  cloneState,
  createState,
  currentColor,
  legalMoves,
  nextTurn,
  occupantsOfRing,
  progressOf,
  rankOf,
  resolveLanding,
  resolveTakeOff,
  stackCount,
  winnerOf,
  type FlightState,
  type Landing,
  type Move
} from "./rules";

export type AiTier = "rookie" | "normal" | "pro" | "hell";

export const AI_TIERS: readonly AiTier[] = ["rookie", "normal", "pro", "hell"];

export const AI_TIER_LABELS: Record<AiTier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  pro: "高手",
  hell: "地狱"
};

export const AI_TIER_NOTES: Record<AiTier, string> = {
  rookie: "看到能起飞就起飞，其余时候只顾着推最前面那一架。",
  normal: "撞得到就一定撞，撞不到才老老实实往前走。",
  pro: "会叠子挡路，会算正好到终点，也会躲开明显要挨撞的落点。",
  hell: "会守住你的航线落点，会算跳格链，必要时用一架换掉你一整座堡垒。"
};

/** 预演一步棋，但不改动原局面 */
export function previewMove(s: FlightState, move: Move, dice: number): Landing {
  return move.kind === "takeOff" ? resolveTakeOff(s, move.plane) : resolveLanding(s, move.plane, dice);
}

/**
 * 威胁表:环线每一格「下一手会被几种点数撞到」。
 * 只按前进 1..6 加上跳格与航线的落点估，不做深搜——够用，而且一局算几千次也不卡。
 */
export function threatMapBy(s: FlightState, attacker: Color, into?: number[]): number[] {
  const t = into ?? new Array<number>(RING_LEN).fill(0);
  let hasBase = false;
  for (let i = 0; i < PLANES_PER_COLOR; i++) {
    const p = s.planes[attacker][i];
    if (p === BASE) {
      hasBase = true;
      continue;
    }
    if (p < 0 || p >= RING_LEN) continue;
    for (let d = 1; d <= 6; d++) {
      const q = p + d;
      if (q >= RING_LEN) break;
      t[ringAt(attacker, q)] += 1;
      if (s.rules.allowAirline && isAirline(q)) {
        t[ringAt(attacker, AIRLINE_TO)] += 1;
      } else if (s.rules.allowJump && canJumpFrom(q)) {
        const j = q + JUMP_STEP;
        t[ringAt(attacker, s.rules.allowAirline && isAirline(j) ? AIRLINE_TO : j)] += 1;
      }
    }
  }
  if (hasBase && s.rules.takeOff.length > 0) t[ringAt(attacker, 0)] += s.rules.takeOff.length;
  return t;
}

/** 所有对手加起来对我的威胁 */
export function threatMap(s: FlightState, me: Color): number[] {
  const t = new Array<number>(RING_LEN).fill(0);
  for (const foe of s.seats) {
    if (foe === me) continue;
    threatMapBy(s, foe, t);
  }
  return t;
}

/** 落到 `to` 之后，下一手会被多少种点数撞掉（0..6，越大越危险） */
function riskAt(threat: number[], me: Color, to: number): number {
  if (to < 0 || to >= RING_LEN) return 0;
  return Math.min(6, threat[ringAt(me, to)]);
}

/**
 * 地狱档的权重。抽出来是为了能在测试里扫一遍参数，
 * 确认这一组不是碰巧调出来的（改动请连着 ai.test.ts 的强度断言一起跑）。
 */
export const HELL_WEIGHTS = {
  /** 被盯上的飞机按这个比例折价 */
  threat: 0.45,
  /** 下一手就能撞掉的对手飞机按这个比例先记一笔 */
  pressure: 0.4,
  /** 局面分的放大倍数 */
  eval: 2,
  takeOff: 45,
  arrive: 40,
  stack: 10,
  guard: 8,
  bounce: -6
};

/** 局面分:我方总行程减去对手总行程，再把「站在人家枪口上」的那部分折掉 */
function evalFor(s: FlightState, me: Color): number {
  const threat = threatMap(s, me);
  const stacked = new Set<number>();
  const seen = new Map<number, number>();
  for (let i = 0; i < PLANES_PER_COLOR; i++) {
    const p = s.planes[me][i];
    if (p < 0 || p >= RING_LEN) continue;
    const ring = ringAt(me, p);
    const n = (seen.get(ring) ?? 0) + 1;
    seen.set(ring, n);
    if (n >= 2) stacked.add(ring);
  }
  const pressure = threatMapBy(s, me);
  let v = 0;
  for (const c of s.seats) {
    const sign = c === me ? 1 : -1;
    for (let i = 0; i < PLANES_PER_COLOR; i++) {
      const p = s.planes[c][i];
      let val = p === BASE ? 0 : p + 1;
      if (p === GOAL) val += 30;
      if (p >= 0 && p < RING_LEN) {
        const ring = ringAt(c, p);
        if (c === me) {
          // 叠在一起的两架谁也撞不动，不折价
          if (!stacked.has(ring)) val -= (Math.min(6, threat[ring]) / 6) * (p + 1) * HELL_WEIGHTS.threat;
        } else {
          // 下一手就能撞掉的对手飞机，等于已经赚了一半
          val -= (Math.min(6, pressure[ring]) / 6) * (p + 1) * HELL_WEIGHTS.pressure;
        }
      }
      v += sign * val;
    }
  }
  return v;
}

/** 敌方航线落点对应的环线格（地狱档会想办法占住） */
function guardRings(s: FlightState, me: Color): number[] {
  const out: number[] = [];
  for (const foe of s.seats) {
    if (foe === me) continue;
    out.push(ringAt(foe, AIRLINE_TO));
  }
  return out;
}

/** 预演这一步之后的局面（不改原局面） */
function afterState(s: FlightState, move: Move, res: Landing): FlightState {
  const next = cloneState(s);
  if (!res.legal) return next;
  next.planes[move.plane.color][move.plane.idx] = res.to;
  for (const foe of res.captured) next.planes[foe.color][foe.idx] = BASE;
  return next;
}

export interface ScoredMove {
  move: Move;
  res: Landing;
  score: number;
}

/** 给一步棋打分（不同档次看重的东西不一样） */
export function scoreMove(s: FlightState, move: Move, dice: number, tier: AiTier): ScoredMove {
  const res = previewMove(s, move, dice);
  const me = move.plane.color;
  let score = 0;

  if (!res.legal) return { move, res, score: -1e6 };

  // 撞子:被撞的越靠前越值
  let takenValue = 0;
  for (const foe of res.captured) takenValue += s.planes[foe.color][foe.idx] + 12;

  // 菜鸟只认两件事:能起飞就起飞，否则谁在最前面就推谁
  const rookieScore = move.kind === "takeOff" ? 1000 : res.from;
  if (tier === "rookie") return { move, res, score: rookieScore };

  // 普通:能撞就一定撞（撞进叠子把自己也搭进去的除外），撞不到就挑走得最远的那一架
  if (tier === "normal") {
    if (res.selfBack) return { move, res, score: -500 };
    if (res.captured.length > 0) return { move, res, score: 5000 + takenValue };
    return { move, res, score: move.kind === "takeOff" ? 900 : res.to };
  }

  const gain = res.to === BASE ? -(res.from + 1) : res.to - res.from;
  score += gain * 2;

  if (move.kind === "takeOff") score += 70;
  if (res.arrived) score += 140;

  if (res.selfBack) {
    // 撞进敌方叠子:自己也得回基地。高手 / 地狱档要算这笔账值不值
    score += takenValue - (res.from + 1) * (tier === "hell" ? 1.4 : 2.2) - 30;
  } else {
    score += takenValue * 3;
  }

  const next = afterState(s, move, res);

  if (tier === "pro") {
    // 高手:在贪心之上会叠子挡路、会躲开明显要挨撞的落点
    const threat = threatMap(s, me);
    score += (stackCount(next, me) - stackCount(s, me)) * 16;
    score += (riskAt(threat, me, res.from) - riskAt(threat, me, res.to)) * 3;
    if (res.bounced && !res.blocked) score -= 10;
    if (res.to >= RING_LEN) score += 6;
    return { move, res, score };
  }

  // 地狱:直接算走完之后的整盘局面分（含对手被送回基地的损失与自己被盯上的风险）
  let hellScore = evalFor(next, me) * HELL_WEIGHTS.eval;
  if (move.kind === "takeOff") hellScore += HELL_WEIGHTS.takeOff;
  if (res.arrived) hellScore += HELL_WEIGHTS.arrive;
  hellScore += (stackCount(next, me) - stackCount(s, me)) * HELL_WEIGHTS.stack;
  // 守住对手的航线落点:他飞过来正好撞在你脸上
  if (res.to >= 0 && res.to < RING_LEN && guardRings(s, me).includes(ringAt(me, res.to))) {
    hellScore += HELL_WEIGHTS.guard;
  }
  if (res.bounced && !res.blocked) hellScore += HELL_WEIGHTS.bounce;
  return { move, res, score: hellScore };
}

/** 选一步棋:同分时按飞机编号取靠前的，保证同一局面永远选同一手 */
export function chooseMove(s: FlightState, dice: number, tier: AiTier): Move | null {
  const moves = legalMoves(s, dice);
  if (moves.length === 0) return null;
  let best: ScoredMove | null = null;
  for (const m of moves) {
    const sc = scoreMove(s, m, dice, tier);
    if (!best || sc.score > best.score) best = sc;
  }
  return best ? best.move : moves[0];
}

export interface TurnLog {
  color: Color;
  dice: number;
  move: Move | null;
  res: Landing | null;
  cancelled: boolean;
}

export interface TurnOptions {
  /** 取下一个骰子点数 */
  nextDice: () => number;
  /** 这一位由谁来选棋（不给就用档位打分器） */
  pick?: (s: FlightState, dice: number) => Move | null;
  tier: AiTier;
  /** 一个回合里最多掷几次，兜底防死循环 */
  maxRolls?: number;
}

/**
 * 走完一位的一整个回合（含连掷与连续三个 6 的处罚），返回这回合的逐手记录。
 * 回合结束会自动轮到下一位。
 */
export function playTurn(s: FlightState, opts: TurnOptions): TurnLog[] {
  const logs: TurnLog[] = [];
  const maxRolls = opts.maxRolls ?? 6;
  for (let r = 0; r < maxRolls; r++) {
    const color = currentColor(s);
    const dice = opts.nextDice();
    s.diceIndex++;
    const streak = extraRoll(dice, s.streak, s.rules);
    if (streak.cancel) {
      s.streak = 0;
      logs.push({ color, dice, move: null, res: null, cancelled: true });
      break;
    }
    const move = opts.pick ? opts.pick(s, dice) : chooseMove(s, dice, opts.tier);
    let res: Landing | null = null;
    if (move) res = applyMove(s, move, dice);
    logs.push({ color, dice, move, res, cancelled: false });
    s.streak = streak.streak;
    const extra = move && move.kind === "takeOff" ? takeOffGrantsExtra(dice, s.rules) : streak.again;
    if (!extra) break;
    if (winnerOf(s) !== null) break;
  }
  s.streak = 0;
  nextTurn(s);
  return logs;
}

export interface MatchOptions {
  seed: number;
  seats: Color[];
  tiers: Record<number, AiTier>;
  rules: Rules;
  /** 最多打几个回合，到点按名次判 */
  maxRounds?: number;
}

export interface MatchResult {
  winner: Color | null;
  ranks: Color[];
  rounds: number;
  state: FlightState;
}

/** 把可种子化骰子包成一条流，游标封在闭包里，模拟器不用自己数 */
export function diceStream(seed: number, from = 0): () => number {
  let i = from;
  return () => roll(seed, i++);
}

/** 打满一整局（全部由电脑操作），同一个 seed 永远打出同一局 */
export function simulateMatch(opts: MatchOptions): MatchResult {
  const s = createState(opts.seats, opts.rules);
  const nextDice = diceStream(opts.seed);
  const maxRounds = opts.maxRounds ?? 260;
  while (s.round < maxRounds && winnerOf(s) === null) {
    const color = currentColor(s);
    playTurn(s, { nextDice, tier: opts.tiers[color] ?? "normal" });
  }
  return { winner: winnerOf(s), ranks: rankOf(s), rounds: s.round, state: s };
}

/** 两档对打 n 局（先后手轮流），返回各自赢了几局 */
export function tierDuel(
  a: AiTier,
  b: AiTier,
  games: number,
  seed = 20240611,
  rules?: Rules
): { a: number; b: number; draw: number } {
  let aw = 0;
  let bw = 0;
  let draw = 0;
  for (let i = 0; i < games; i++) {
    // 一半局面让 A 先手，一半让 B 先手，先手优势不会偏袒任何一档
    const first = i % 2 === 0;
    const seats: Color[] = first ? [0, 2] : [2, 0];
    const tiers: Record<number, AiTier> = first ? { 0: a, 2: b } : { 0: b, 2: a };
    const res = simulateMatch({
      seed: seed + i * 7919,
      seats,
      tiers,
      rules: rules ?? CLASSIC_RULES
    });
    const champ = res.winner ?? res.ranks[0];
    const tierOfChamp = tiers[champ];
    if (res.winner === null && progressOf(res.state, res.ranks[0]) === progressOf(res.state, res.ranks[1])) {
      draw++;
    } else if (tierOfChamp === a) aw++;
    else bw++;
  }
  return { a: aw, b: bw, draw };
}

/** 界面上「这一格现在有谁」的小工具，AI 与渲染共用 */
export function planesOnRing(s: FlightState, ring: number): number {
  return occupantsOfRing(s, ring).length;
}
