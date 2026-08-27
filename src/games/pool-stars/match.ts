/**
 * 梨康台球 · 无头对局循环。
 *
 * 界面上的人机对战和单测里的「地狱档打菜鸟档 20 局」跑的是同一份代码：
 * 摆球 → 开球 → 每一杆 `chooseShot` → `simulateShot` → `resolveShot`，
 * 直到分出胜负或者到达步数上限。
 */
import { mulberry32 } from "../level99";
import {
  type Ball,
  type ShotResult,
  type Vec,
  angleTo,
  cloneBalls,
  simulateShot,
  strike,
} from "./physics";
import { type AiShot, type AiTier, aiCuePlacement, chooseShot } from "./ai";
import {
  type MatchState,
  breakSpot,
  createMatch,
  placeCueBall,
  remainingOf,
  resolveShot,
} from "./rules";

/** 把母球放回台面（自由球 / 母球落袋之后） */
export function restoreCue(balls: readonly Ball[], pos: Vec): Ball[] {
  const out = cloneBalls(balls);
  const cue = out.find((b) => b.kind === "cue");
  if (!cue) return out;
  const safe = placeCueBall(out, pos).pos;
  cue.x = safe.x;
  cue.y = safe.y;
  cue.vx = 0;
  cue.vy = 0;
  cue.spin = 0;
  cue.potted = false;
  cue.pocket = -1;
  return out;
}

/** 出杆方这一杆的处境（喂给电脑球手） */
export function shotContext(m: MatchState): {
  group: MatchState["groups"][0];
  ownCleared: boolean;
} {
  const group = m.groups[m.turn];
  return { group, ownCleared: group !== null && remainingOf(m.balls, group) === 0 };
}

/** 开球那一杆：对着球堆最前面那颗全力打过去 */
export function breakShot(balls: readonly Ball[], rand: () => number): AiShot {
  const cue = balls.find((b) => b.kind === "cue");
  const rack = balls.filter((b) => b.kind !== "cue" && !b.potted);
  if (!cue || rack.length === 0) return { angle: 0, power: 1, spin: 0, calledPocket: null, safety: false };
  let apex = rack[0];
  for (const b of rack) if (b.x < apex.x) apex = b;
  return {
    angle: angleTo(cue, apex) + (rand() - 0.5) * 0.05,
    power: 0.9 + rand() * 0.1,
    spin: 0,
    calledPocket: null,
    safety: false,
  };
}

/** 把一杆真的打出去：返回推演结果 */
export function fireShot(balls: readonly Ball[], shot: AiShot, maxSeconds = 12): ShotResult {
  const work = cloneBalls(balls);
  const idx = work.findIndex((b) => b.kind === "cue");
  if (idx >= 0) work[idx] = strike(work[idx], shot.angle, shot.power, shot.spin);
  return simulateShot({ balls: work }, { maxSeconds });
}

export interface MatchSimResult {
  winner: -1 | 0 | 1;
  shots: number;
  fouls: [number, number];
  /** 到上限还没分胜负 */
  timeout: boolean;
}

export interface MatchSimOptions {
  requireCall?: boolean;
  threeFoulLoss?: boolean;
  maxShots?: number;
  first?: 0 | 1;
}

/** 两台电脑对打一整局，返回胜负 */
export function playAiMatch(
  tiers: [AiTier, AiTier],
  seed: number,
  opts: MatchSimOptions = {}
): MatchSimResult {
  const rand = mulberry32(seed * 7919 + 13);
  let m = createMatch({
    seed: (seed % 61) + 1,
    requireCall: opts.requireCall ?? true,
    threeFoulLoss: opts.threeFoulLoss ?? true,
    first: opts.first ?? 0,
  });
  const maxShots = opts.maxShots ?? 160;
  let shots = 0;

  while (m.phase !== "over" && shots < maxShots) {
    shots++;
    const shooter = m.turn;
    const { group, ownCleared } = shotContext(m);
    let balls = m.balls;
    if (m.freeBall || balls.some((b) => b.kind === "cue" && b.potted)) {
      const spot = m.phase === "break" ? breakSpot() : aiCuePlacement({ balls, group, ownCleared, requireCall: m.requireCall });
      balls = restoreCue(balls, spot);
    }
    const shot =
      m.phase === "break"
        ? breakShot(balls, rand)
        : chooseShot({ balls, group, ownCleared, requireCall: m.requireCall }, tiers[shooter], rand);
    const res = fireShot(balls, shot);
    m = resolveShot({ ...m, balls: cloneBalls(balls), calledPocket: shot.calledPocket }, res);
  }

  return {
    winner: m.winner,
    shots,
    fouls: [m.fouls[0], m.fouls[1]],
    timeout: m.phase !== "over",
  };
}

/** 一串 seed 下 tierA 对 tierB 的胜率（单测断言地狱档明显强过菜鸟档） */
export function aiWinRate(tiers: [AiTier, AiTier], games: number, seed0 = 1, opts: MatchSimOptions = {}): number {
  let win = 0;
  for (let i = 0; i < games; i++) {
    const r = playAiMatch(tiers, seed0 + i, opts);
    if (r.winner === 0) win++;
  }
  return win / games;
}
