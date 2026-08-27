// 军旗对决 · 四档电脑对手：走的棋要合法、要可复现，档位之间要真的拉得开差距。
import { describe, expect, it } from "vitest";
import { TIERS, TIER_LABELS, TIER_SETUP, TIER_TIPS, chooseMove, shufflePenalty, type Tier } from "./ai";
import { HQ, idx, type Side } from "./board";
import { newGame } from "./setup";
import {
  applyMove,
  legalMoves,
  makeState,
  movesFrom,
  status,
  type Cell,
  type GameEvent,
  type Kind,
} from "./rules";

interface MatchResult {
  winner: Side | null;
  plies: number;
}

/** 让两档电脑对着下一盘，返回谁赢（null 表示和局或者手数用完） */
export function playMatch(seed: number, duo: Tier, star: Tier, maxPlies = 300): MatchResult {
  const state = newGame(seed, { duoSkill: TIER_SETUP[duo], starSkill: TIER_SETUP[star] });
  while (!state.outcome && state.plies < maxPlies) {
    const tier = state.turn === "duo" ? duo : star;
    const move = chooseMove(state, state.turn, tier, seed + state.plies);
    if (!move) break;
    const r = applyMove(state, move);
    if (!r.ok) throw new Error(`第 ${state.plies} 手走了非法的一步：${r.message}`);
  }
  return { winner: state.outcome?.winner ?? null, plies: state.plies };
}

describe("军旗对决 · 电脑对手", () => {
  it("四档都在，标签和说明都写了", () => {
    expect(TIERS).toHaveLength(4);
    for (const t of TIERS) {
      expect(TIER_LABELS[t].length).toBeGreaterThan(0);
      expect(TIER_TIPS[t].length).toBeGreaterThan(0);
      expect(TIER_SETUP[t]).toBeGreaterThanOrEqual(0);
    }
  });

  it("每一档走的都是合法的一步", () => {
    for (const tier of TIERS) {
      const state = newGame(31415, { duoSkill: 1, starSkill: 1 });
      for (let i = 0; i < 12 && !state.outcome; i++) {
        const move = chooseMove(state, state.turn, tier, 77 + i);
        expect(move, tier).not.toBeNull();
        expect(movesFrom(state.cells, move!.from)).toContain(move!.to);
        expect(applyMove(state, move!).ok).toBe(true);
      }
    }
  });

  it("同一个 seed 走出来的一模一样", () => {
    const a = playMatch(2024, "hell", "normal");
    const b = playMatch(2024, "hell", "normal");
    expect(a).toEqual(b);
  });

  it("没子可动的时候老老实实返回 null", () => {
    const cells = new Array<Cell>(60).fill(null);
    cells[idx(0, 1)] = { id: 1, side: "star", kind: "junqi" as Kind };
    cells[idx(1, 0)] = { id: 2, side: "star", kind: "dilei" as Kind };
    cells[idx(6, 0)] = { id: 3, side: "duo", kind: "siling" as Kind };
    const s = makeState(cells, { turn: "star" });
    expect(legalMoves(cells, "star")).toHaveLength(0);
    expect(chooseMove(s, "star", "hell", 1)).toBeNull();
    expect(status(s).side).toBe("duo");
  });

  it("地狱档看见亮出来的军旗会去扛", () => {
    const cells = new Array<Cell>(60).fill(null);
    cells[idx(0, 1)] = { id: 1, side: "star", kind: "junqi" as Kind };
    cells[idx(2, 0)] = { id: 2, side: "star", kind: "lianzhang" as Kind };
    cells[idx(1, 1)] = { id: 3, side: "duo", kind: "paizhang" as Kind };
    cells[idx(9, 1)] = { id: 4, side: "duo", kind: "junqi" as Kind };
    cells[idx(11, 1)] = { id: 5, side: "duo", kind: "dilei" as Kind };
    const s = makeState(cells, { turn: "duo" });
    const move = chooseMove(s, "duo", "hell", 5);
    expect(move).toEqual({ from: idx(1, 1), to: HQ.star[0] });
  });

  it("拉锯罚分只认「原样退回上一手起点」，来回过一轮就翻倍", () => {
    const trail: GameEvent[] = [
      { t: "move", side: "duo", piece: { id: 7, side: "duo", kind: "tuanzhang" }, from: 20, to: 25, rail: false, turned: false },
    ];
    // 上一手 20→25，这一手要 25→20：正是拉锯
    expect(shufflePenalty(trail, "duo", { from: 25, to: 20 }, 7)).toBe(22);
    // 换一枚子走同一条线不算拉锯
    expect(shufflePenalty(trail, "duo", { from: 25, to: 20 }, 9)).toBe(0);
    // 往前挪、不是退回去的也不算
    expect(shufflePenalty(trail, "duo", { from: 25, to: 31 }, 7)).toBe(0);
    // 空历史与对手的历史都不该扣分
    expect(shufflePenalty([], "duo", { from: 25, to: 20 }, 7)).toBe(0);
    expect(shufflePenalty(trail, "star", { from: 25, to: 20 }, 7)).toBe(0);

    const twice: GameEvent[] = [
      { t: "move", side: "duo", piece: { id: 7, side: "duo", kind: "tuanzhang" }, from: 20, to: 25, rail: false, turned: false },
      { t: "move", side: "duo", piece: { id: 7, side: "duo", kind: "tuanzhang" }, from: 25, to: 20, rail: false, turned: false },
      { t: "move", side: "duo", piece: { id: 7, side: "duo", kind: "tuanzhang" }, from: 20, to: 25, rail: false, turned: false },
    ];
    expect(shufflePenalty(twice, "duo", { from: 25, to: 20 }, 7)).toBeGreaterThan(22);
  });

  it("高手 / 地狱档不会拿同一枚子在两个格子之间来回蹭", () => {
    /** 60 手之内，同一方的同一枚子在同一对格子上最多来回了几趟 */
    function worstShuffle(seed: number, tier: Tier): number {
      const state = newGame(seed, { duoSkill: TIER_SETUP[tier], starSkill: TIER_SETUP[tier] });
      const seen = new Map<string, number>();
      let worst = 0;
      for (let i = 0; i < 60 && !state.outcome; i++) {
        const move = chooseMove(state, state.turn, tier, 4242 + i);
        if (!move) break;
        const piece = state.cells[move.from];
        const key = `${state.turn}:${piece?.id}:${Math.min(move.from, move.to)}-${Math.max(move.from, move.to)}`;
        const n = (seen.get(key) ?? 0) + 1;
        seen.set(key, n);
        worst = Math.max(worst, n);
        expect(applyMove(state, move).ok).toBe(true);
      }
      return worst;
    }

    // 这三个 seed 是加罚分之前真的会蹭的局：地狱档 1337 号局蹭到 6 趟，
    // 高手档 5044 / 8077 两局各蹭 3 趟。加了罚分之后都压到 2 趟以内。
    for (const [seed, tier] of [[1337, "hell"], [5044, "pro"], [8077, "pro"]] as [number, Tier][]) {
      const worst = worstShuffle(seed, tier);
      expect(worst, `${tier} 档 ${seed} 号局在同一对格子上蹭了 ${worst} 趟`).toBeLessThanOrEqual(2);
    }
  });

  it("固定 seed 下地狱档对菜鸟档，胜率明显更高", () => {
    let hellWins = 0;
    let rookieWins = 0;
    for (let i = 0; i < 20; i++) {
      // 一半盘让地狱档坐朵朵这边，一半盘换边，省得先手占便宜
      const seed = 5000 + i * 131;
      const hellIsDuo = i % 2 === 0;
      const r = hellIsDuo ? playMatch(seed, "hell", "rookie") : playMatch(seed, "rookie", "hell");
      const hellSide: Side = hellIsDuo ? "duo" : "star";
      if (r.winner === hellSide) hellWins += 1;
      else if (r.winner) rookieWins += 1;
    }
    expect(hellWins).toBeGreaterThanOrEqual(15);
    expect(hellWins).toBeGreaterThan(rookieWins * 3);
  });

  it("地狱档对高手档也不落下风", () => {
    let hellWins = 0;
    let proWins = 0;
    for (let i = 0; i < 12; i++) {
      const seed = 8100 + i * 97;
      const hellIsDuo = i % 2 === 0;
      const r = hellIsDuo ? playMatch(seed, "hell", "pro") : playMatch(seed, "pro", "hell");
      const hellSide: Side = hellIsDuo ? "duo" : "star";
      if (r.winner === hellSide) hellWins += 1;
      else if (r.winner) proWins += 1;
    }
    expect(hellWins).toBeGreaterThanOrEqual(proWins);
  });
});
