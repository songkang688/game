import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { TIERS, chooseAction, playDuel, type Tier } from "./ai";
import { CHAPTERS, TOTAL, chapterIndexOf, chaptersValid, endlessPlan, planFor, rateLevel, setupFor } from "./levels";
import { applyAction, legalActions, newGame, status, type GameState, type Side } from "./rules";

/** 参考解题器：用最强档把这一关下完，看看朵朵能不能赢 */
function solve(state: GameState, rivalTier: Tier, seed: number, maxPlies: number): "win" | "lose" | "draw" {
  for (let i = 0; i < maxPlies; i++) {
    const st = status(state);
    if (st.kind === "win") return st.side === "duo" ? "win" : "lose";
    if (st.kind === "draw") return "draw";
    const side: Side = state.turn;
    const tier: Tier = side === "duo" ? "hell" : rivalTier;
    const a = chooseAction(state, side, tier, seed + i * 29);
    if (!a) break;
    applyAction(state, a);
  }
  const st = status(state);
  if (st.kind === "win") return st.side === "duo" ? "win" : "lose";
  return "draw";
}

describe("翻翻暗棋 · 188 关章节", () => {
  it("八章之和恒等 188，和平台的总关数一致", () => {
    expect(chaptersValid()).toBe(true);
    expect(CHAPTERS.reduce((a, c) => a + c.size, 0)).toBe(188);
    expect(TOTAL).toBe(TOTAL_LEVELS);
  });

  it("每一章都有名字、表情和一句说明", () => {
    expect(CHAPTERS.length).toBe(8);
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.desc.length).toBeGreaterThan(4);
      expect(c.size).toBeGreaterThan(0);
    }
  });

  it("关号能正确落到章节里，越界也不会崩", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(23)).toBe(0);
    expect(chapterIndexOf(24)).toBe(1);
    expect(chapterIndexOf(187)).toBe(7);
    expect(planFor(-5).level).toBe(0);
    expect(planFor(9999).level).toBe(187);
  });

  it("难度是往上走的：越后面的章节对手越强", () => {
    const rank = (t: Tier): number => TIERS.indexOf(t);
    expect(rank(planFor(0).tier)).toBeLessThanOrEqual(rank(planFor(100).tier));
    expect(rank(planFor(100).tier)).toBeLessThanOrEqual(rank(planFor(187).tier));
    expect(planFor(187).tier).toBe("hell");
  });

  it("记牌面板从第 5 章起默认打开", () => {
    expect(planFor(95).showCounter).toBe(false);
    expect(planFor(96).showCounter).toBe(true);
    expect(planFor(187).showCounter).toBe(true);
  });

  it("第 6、7 章是摆好的残局，其余是整盘洗子", () => {
    expect(planFor(120).endgame).toBe(true);
    expect(planFor(150).endgame).toBe(true);
    expect(planFor(10).endgame).toBe(false);
    expect(planFor(187).endgame).toBe(false);
  });

  it("三星门槛：手数越少星越多", () => {
    expect(rateLevel(3, 60)).toBe(3);
    expect(rateLevel(30, 60)).toBe(2);
    expect(rateLevel(59, 60)).toBe(1);
  });
});

describe("翻翻暗棋 · 关卡局面", () => {
  it("每一关开局都至少有一手能走", () => {
    for (let lv = 0; lv < 188; lv += 7) {
      const state = setupFor(lv);
      expect(legalActions(state, state.turn).length, `第 ${lv + 1} 关`).toBeGreaterThan(0);
    }
  });

  it("整盘关卡的子力清点没错：红蓝各 16 枚", () => {
    for (const lv of [0, 30, 70, 187]) {
      const state = setupFor(lv);
      expect(state.cells.filter((c) => c?.color === "red").length).toBe(16);
      expect(state.cells.filter((c) => c?.color === "blue").length).toBe(16);
    }
  });

  it("第 1 关全部盖着，第 2 章会先替孩子翻开几枚", () => {
    expect(setupFor(0).cells.every((c) => c?.covered)).toBe(true);
    expect(setupFor(30).cells.some((c) => c && !c.covered)).toBe(true);
  });

  it("残局关是直接定好阵营的明棋，朵朵先走", () => {
    const state = setupFor(120);
    expect(state.colors.duo).toBe("red");
    expect(state.colors.star).toBe("blue");
    expect(state.turn).toBe("duo");
    expect(state.cells.every((c) => c === null || !c.covered)).toBe(true);
  });

  it("抽样残局都能被参考解题器下赢（可解）", () => {
    for (const lv of [118, 124, 130, 136, 142, 150, 158, 163]) {
      const plan = planFor(lv);
      const out = solve(setupFor(lv), plan.tier, plan.seed, plan.maxPlies);
      expect(out, `第 ${lv + 1} 关`).toBe("win");
    }
  });

  it("同一关每次摆出来都一样（固定 seed）", () => {
    const a = setupFor(77).cells.map((c) => `${c?.color ?? "-"}${c?.kind ?? ""}${c?.covered ? "*" : ""}`).join(",");
    const b = setupFor(77).cells.map((c) => `${c?.color ?? "-"}${c?.kind ?? ""}${c?.covered ? "*" : ""}`).join(",");
    expect(a).toBe(b);
  });
});

describe("翻翻暗棋 · 电脑对手", () => {
  it("四档都能给出合法的一手", () => {
    for (const t of TIERS) {
      const state = newGame(41);
      const a = chooseAction(state, "duo", t, 5);
      expect(a).not.toBe(null);
      expect(legalActions(state, "duo")).toContainEqual(a);
    }
  });

  it("没得走的时候返回 null", () => {
    const state = newGame(3);
    state.winner = "duo";
    expect(chooseAction(state, "star", "hell", 1)).toBe(null);
  });

  it("固定 seed 下大师档对新手档，胜场明显更多", () => {
    let hellWins = 0;
    let rookieWins = 0;
    for (let i = 0; i < 20; i++) {
      const r = playDuel(newGame(600 + i * 13), "hell", "rookie", 1000 + i * 7);
      if (r.winner === "duo") hellWins += 1;
      else if (r.winner === "star") rookieWins += 1;
    }
    expect(hellWins).toBeGreaterThan(rookieWins);
    expect(hellWins).toBeGreaterThanOrEqual(11);
  }, 30000);

  it("同一 seed 的对局可以完整复现", () => {
    const a = playDuel(newGame(999), "pro", "normal", 12);
    const b = playDuel(newGame(999), "pro", "normal", 12);
    expect(a.winner).toBe(b.winner);
    expect(a.plies).toBe(b.plies);
  });

  it("无尽模式越连胜对手越强", () => {
    const rank = (t: Tier): number => TIERS.indexOf(t);
    expect(rank(endlessPlan(0).tier)).toBeLessThan(rank(endlessPlan(6).tier));
    expect(endlessPlan(12).tier).toBe("hell");
    expect(endlessPlan(3).seed).not.toBe(endlessPlan(4).seed);
  });
});
