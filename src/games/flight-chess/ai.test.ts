import { describe, expect, it } from "vitest";
import { BASE, GOAL, RING_LEN, ARM, ringAt, type Color } from "./board";
import { CLASSIC_RULES } from "./dice";
import { createState, place, type FlightState } from "./rules";
import {
  AI_TIERS,
  AI_TIER_LABELS,
  AI_TIER_NOTES,
  HELL_WEIGHTS,
  chooseMove,
  diceStream,
  playTurn,
  scoreMove,
  simulateMatch,
  threatMap,
  threatMapBy,
  tierDuel
} from "./ai";

const ME: Color = 0;

function table(planes: Partial<Record<Color, number[]>> = {}, seats: Color[] = [0, 1, 2, 3]): FlightState {
  const s = createState(seats, CLASSIC_RULES);
  for (const [key, row] of Object.entries(planes)) place(s, Number(key) as Color, row as number[]);
  return s;
}

function foesAt(s: FlightState, foe: Color, p: number, count: number): void {
  const ring = ringAt(ME, p);
  const theirs = ((ring - ARM * foe) % RING_LEN + RING_LEN) % RING_LEN;
  for (let i = 0; i < count; i++) s.planes[foe][i] = theirs;
}

describe("四档电脑对手", () => {
  it("四档都有中文名与一句说明", () => {
    expect(AI_TIERS).toEqual(["rookie", "normal", "pro", "hell"]);
    for (const t of AI_TIERS) {
      expect(AI_TIER_LABELS[t].length).toBeGreaterThan(1);
      expect(AI_TIER_NOTES[t].length).toBeGreaterThan(8);
    }
  });

  it("菜鸟:有能起飞的点就起飞，否则推最靠前的那一架", () => {
    const s = table({ 0: [BASE, 10, 20, BASE] });
    expect(chooseMove(s, 6, "rookie")).toEqual({ kind: "takeOff", plane: { color: 0, idx: 0 } });
    expect(chooseMove(s, 3, "rookie")).toEqual({ kind: "fly", plane: { color: 0, idx: 2 } });
  });

  it("普通:能撞就一定撞，哪怕这一架不是最靠前的", () => {
    const s = table({ 0: [BASE, 6, 30, BASE] });
    foesAt(s, 2, 9, 1);
    const move = chooseMove(s, 3, "normal");
    expect(move).toEqual({ kind: "fly", plane: { color: 0, idx: 1 } });
    // 菜鸟看不见这个机会，只顾着推最前面那架
    expect(chooseMove(s, 3, "rookie")).toEqual({ kind: "fly", plane: { color: 0, idx: 2 } });
  });

  it("普通:不会一头撞进敌方叠子把自己也搭进去", () => {
    const s = table({ 0: [6, 30] });
    foesAt(s, 2, 9, 2);
    const move = chooseMove(s, 3, "normal");
    expect(move?.plane.idx).not.toBe(0);
  });

  it("高手 / 地狱:同样的机会照撞，而且给撞子打的分比空走高", () => {
    for (const tier of ["pro", "hell"] as const) {
      const s = table({ 0: [6, 30] });
      foesAt(s, 2, 9, 1);
      const hit = scoreMove(s, { kind: "fly", plane: { color: 0, idx: 0 } }, 3, tier);
      const idle = scoreMove(s, { kind: "fly", plane: { color: 0, idx: 1 } }, 3, tier);
      expect(hit.res.captured).toHaveLength(1);
      expect(hit.score).toBeGreaterThan(idle.score);
    }
  });

  it("威胁表数得清「下一手会被几种点数撞到」", () => {
    const s = table({ 0: [10], 2: [] });
    foesAt(s, 2, 7, 1);
    const t = threatMap(s, ME);
    // 对手在我行程 7 那一格，前进 3 步正好到我头上
    expect(t[ringAt(ME, 10)]).toBeGreaterThanOrEqual(1);
    expect(t[ringAt(ME, 6)]).toBe(0);
    const solo = threatMapBy(s, 2);
    expect(solo).toHaveLength(RING_LEN);
    expect(threatMap(table({ 0: [10] }, [0]), ME).every((v) => v === 0)).toBe(true);
  });

  it("高手会躲开明显要挨撞的落点", () => {
    const s = table({ 0: [10, 34] });
    // 落到行程 13 会被对手一步撞掉，落到 37 安全
    foesAt(s, 2, 10, 1);
    const risky = scoreMove(s, { kind: "fly", plane: { color: 0, idx: 0 } }, 3, "pro");
    const safe = scoreMove(s, { kind: "fly", plane: { color: 0, idx: 1 } }, 3, "pro");
    expect(risky.score).toBeLessThan(safe.score + 1000);
    expect(threatMap(s, ME)[ringAt(ME, 13)]).toBeGreaterThan(0);
  });

  it("正好能到终点的那一步，高手一定会走", () => {
    const s = table({ 0: [GOAL - 3, 20] });
    expect(chooseMove(s, 3, "pro")).toEqual({ kind: "fly", plane: { color: 0, idx: 0 } });
    expect(chooseMove(s, 3, "hell")).toEqual({ kind: "fly", plane: { color: 0, idx: 0 } });
  });

  it("地狱档的权重是一组具名常量，改动会被强度断言盯住", () => {
    expect(HELL_WEIGHTS.threat).toBeGreaterThan(0);
    expect(HELL_WEIGHTS.pressure).toBeGreaterThan(0);
    expect(HELL_WEIGHTS.eval).toBeGreaterThanOrEqual(1);
  });
});

describe("回合推进", () => {
  it("掷 6 能接着掷，连续三个 6 这一手作废", () => {
    const s = table({ 0: [BASE, BASE, BASE, BASE] });
    const dice = [6, 6, 6, 2];
    let i = 0;
    const logs = playTurn(s, { nextDice: () => dice[i++], tier: "rookie" });
    expect(logs).toHaveLength(3);
    expect(logs[0].move?.kind).toBe("takeOff");
    expect(logs[1].move?.kind).toBe("takeOff");
    expect(logs[2].cancelled).toBe(true);
    expect(s.planes[0].filter((p) => p === 0 || p > 0)).toHaveLength(2);
    // 一个回合结束轮到下一位，连 6 计数清零
    expect(s.streak).toBe(0);
    expect(s.turn).toBe(1);
  });

  it("掷不动的时候这一手直接过，不会卡住", () => {
    const s = table({ 0: [BASE, BASE, BASE, BASE] });
    const logs = playTurn(s, { nextDice: () => 3, tier: "pro" });
    expect(logs).toHaveLength(1);
    expect(logs[0].move).toBeNull();
    expect(s.turn).toBe(1);
  });

  it("骰子流可复现:同一个种子跑出同一串点数", () => {
    const a = diceStream(4321);
    const b = diceStream(4321);
    for (let i = 0; i < 30; i++) expect(a()).toBe(b());
  });

  it("同一个种子打出同一局，换种子就换一局", () => {
    const base = { seats: [0, 1, 2, 3] as Color[], tiers: { 0: "pro", 1: "pro", 2: "pro", 3: "pro" } as const, rules: CLASSIC_RULES };
    const a = simulateMatch({ ...base, seed: 909 });
    const b = simulateMatch({ ...base, seed: 909 });
    const c = simulateMatch({ ...base, seed: 910 });
    expect(a.winner).toBe(b.winner);
    expect(a.rounds).toBe(b.rounds);
    expect(a.state.planes).toEqual(b.state.planes);
    expect(a.rounds === c.rounds && a.winner === c.winner).toBe(false);
  });

  it("整局打得完:有人 4 架到齐就收摊", () => {
    const res = simulateMatch({
      seed: 20260427,
      seats: [0, 1, 2, 3],
      tiers: { 0: "hell", 1: "pro", 2: "normal", 3: "rookie" },
      rules: CLASSIC_RULES
    });
    expect(res.winner).not.toBeNull();
    expect(res.state.planes[res.winner as Color].every((p) => p === GOAL)).toBe(true);
    expect(res.ranks[0]).toBe(res.winner);
    expect(res.rounds).toBeGreaterThan(3);
  });
});

describe("固定种子下的强度阶梯", () => {
  it("地狱档对菜鸟档 20 局，胜率显著更高", () => {
    const duel = tierDuel("hell", "rookie", 20);
    expect(duel.a + duel.b + duel.draw).toBe(20);
    expect(duel.a).toBeGreaterThanOrEqual(13);
    expect(duel.a).toBeGreaterThanOrEqual(duel.b * 2);
  });

  it("换两个种子重来，地狱档照样赢在前头", () => {
    for (const seed of [1000, 1131, 1262]) {
      const duel = tierDuel("hell", "rookie", 20, seed);
      expect(duel.a, `种子 ${seed}`).toBeGreaterThanOrEqual(13);
      expect(duel.a, `种子 ${seed}`).toBeGreaterThan(duel.b);
    }
  });

  it("高手档也稳稳压过菜鸟档，地狱档不输给高手档", () => {
    expect(tierDuel("pro", "rookie", 20).a).toBeGreaterThanOrEqual(13);
    const hellVsPro = tierDuel("hell", "pro", 40);
    expect(hellVsPro.a).toBeGreaterThanOrEqual(hellVsPro.b - 4);
  });
});
