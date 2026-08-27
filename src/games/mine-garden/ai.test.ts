import { describe, expect, it } from "vitest";
import { OPEN, indexOf } from "./board";
import { generateNoGuess } from "./solver";
import {
  AI_HIT_PENALTY_MS,
  AI_MOVE_MS,
  AI_TIERS,
  AI_TIER_HINTS,
  AI_TIER_LABELS,
  aiFirstOpen,
  aiPlan,
  aiProgress,
  aiStep,
  createAi,
  simulateAi,
  type AiTier
} from "./ai";

const W = 9;
const H = 9;
const FIRST = indexOf(W, 4, 4);
const MINE = generateNoGuess(W, H, 10, FIRST, 4242).mine;

function rand(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("mine-garden · 四档假人", () => {
  it("四档齐全，每档都有名字和一句说明", () => {
    expect([...AI_TIERS]).toEqual(["rookie", "normal", "expert", "master"]);
    expect(AI_TIER_LABELS.rookie).toBe("菜鸟");
    expect(AI_TIER_LABELS.master).toBe("地狱");
    for (const t of AI_TIERS) {
      expect(AI_TIER_LABELS[t].length).toBeGreaterThan(0);
      expect(AI_TIER_HINTS[t].length).toBeGreaterThan(8);
    }
  });

  it("档位越高手越快（每步耗时递减）", () => {
    for (let i = 1; i < AI_TIERS.length; i++) {
      expect(AI_MOVE_MS[AI_TIERS[i]]).toBeLessThan(AI_MOVE_MS[AI_TIERS[i - 1]]);
    }
  });

  it("固定 seed：地狱档用时明显少于菜鸟档", () => {
    const rookie = simulateAi(W, H, MINE, FIRST, "rookie", 99);
    const master = simulateAi(W, H, MINE, FIRST, "master", 99);
    expect(master.cleared).toBe(true);
    expect(rookie.cleared).toBe(true);
    expect(master.ms).toBeLessThan(rookie.ms);
    // 「明显」写成硬指标：地狱档不到菜鸟档的一半
    expect(master.ms * 2).toBeLessThan(rookie.ms);
  });

  it("固定 seed：四档用时从菜鸟到地狱一路变短", () => {
    const times = AI_TIERS.map((t) => simulateAi(W, H, MINE, FIRST, t, 7).ms);
    for (let i = 1; i < times.length; i++) {
      expect(times[i], `${AI_TIERS[i]} 应该比 ${AI_TIERS[i - 1]} 快`).toBeLessThan(times[i - 1]);
    }
  });

  it("中级图上差距更大，而且四档都能把地扫完", () => {
    const first = indexOf(16, 8, 8);
    const mine = generateNoGuess(16, 16, 40, first, 1234).mine;
    const res = AI_TIERS.map((t) => simulateAi(16, 16, mine, first, t, 55));
    for (const r of res) expect(r.cleared, `${r.tier} 没扫完`).toBe(true);
    const rookie = res[0];
    const master = res[3];
    expect(master.ms * 3).toBeLessThan(rookie.ms);
  });

  it("越会推理越少踩刺种：地狱档在这张图上一次都没碰到", () => {
    const rookie = simulateAi(W, H, MINE, FIRST, "rookie", 21);
    const normal = simulateAi(W, H, MINE, FIRST, "normal", 21);
    const expert = simulateAi(W, H, MINE, FIRST, "expert", 21);
    const master = simulateAi(W, H, MINE, FIRST, "master", 21);
    expect(rookie.hits).toBeGreaterThan(0);
    // 高手只会三级便宜规则，偶尔还是得碰运气；地狱档带完整约束求解，无猜图上一次不踩
    expect(expert.hits).toBeLessThan(normal.hits + 1);
    expect(expert.hits).toBeLessThan(rookie.hits);
    expect(master.hits).toBe(0);
  });

  it("在无猜图上地狱档一次都不用蒙", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const first = indexOf(W, 4, 4);
      const mine = generateNoGuess(W, H, 10, first, seed).mine;
      const r = simulateAi(W, H, mine, first, "master", seed * 3);
      expect(r.cleared).toBe(true);
      expect(r.hits, `seed=${seed} 地狱档在无猜图上不该踩到刺种`).toBe(0);
    }
  });

  it("同一个 seed 跑出同一份成绩（可复现）", () => {
    const a = simulateAi(W, H, MINE, FIRST, "normal", 12);
    const b = simulateAi(W, H, MINE, FIRST, "normal", 12);
    expect(a).toEqual(b);
  });

  it("踩到刺种不出局：插上旗、歇一会儿接着扫", () => {
    const ai = createAi(W, H, MINE, "rookie");
    aiFirstOpen(ai, FIRST);
    const r = rand(3);
    let sawHit = false;
    for (let i = 0; i < 400 && !ai.done; i++) {
      const step = aiStep(ai, r);
      if (step.hit) {
        sawHit = true;
        expect(step.ms).toBeGreaterThanOrEqual(AI_HIT_PENALTY_MS);
        expect(ai.mem[step.move?.index ?? -1] === 1 || ai.hits > 0).toBe(true);
      }
    }
    expect(sawHit).toBe(true);
    expect(ai.done).toBe(true);
  });

  it("地狱档会用和弦：一步翻开好几格", () => {
    const ai = createAi(W, H, MINE, "master");
    aiFirstOpen(ai, FIRST);
    const r = rand(9);
    let chords = 0;
    while (!ai.done) {
      const step = aiStep(ai, r);
      if (step.move?.kind === "chord") chords++;
    }
    expect(chords).toBeGreaterThan(0);
  });

  it("高手档会插旗，普通档只把结论记在心里", () => {
    const kinds = (tier: AiTier): Set<string> => {
      const ai = createAi(W, H, MINE, tier);
      aiFirstOpen(ai, FIRST);
      const r = rand(4);
      const out = new Set<string>();
      while (!ai.done) {
        const step = aiStep(ai, r);
        if (step.move) out.add(step.move.kind);
      }
      return out;
    };
    expect(kinds("expert").has("flag")).toBe(true);
    expect(kinds("normal").has("flag")).toBe(false);
  });

  it("进度条从 0 走到 1，扫完就没有下一步可想了", () => {
    const ai = createAi(W, H, MINE, "master");
    expect(aiProgress(ai)).toBe(0);
    aiFirstOpen(ai, FIRST);
    expect(aiProgress(ai)).toBeGreaterThan(0);
    const r = rand(1);
    while (!ai.done) aiStep(ai, r);
    expect(aiProgress(ai)).toBe(1);
    expect(aiPlan(ai, r)).toBeNull();
  });

  it("假人的第一下和玩家点在同一格", () => {
    const ai = createAi(W, H, MINE, "expert");
    const ms = aiFirstOpen(ai, FIRST);
    expect(ms).toBe(AI_MOVE_MS.expert);
    expect(ai.board.state[FIRST]).toBe(OPEN);
    expect(ai.moves).toBe(1);
  });
});
