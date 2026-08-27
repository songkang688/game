import { describe, expect, it } from "vitest";
import { AI_PARAMS, AI_TIERS, AI_TIER_LABELS, aiSteer, duelWins, simulateDuel, type AiView } from "./ai";
import { dist, type Cell } from "./logic";

function view(over: Partial<AiView> = {}): AiView {
  const self: Cell = { id: "s", owner: "me", mass: 50, x: 500, y: 500, vx: 0, vy: 0, bornAt: 0 };
  return { self, pellets: [], others: [], viruses: [], mapW: 1000, mapH: 1000, ...over };
}

const noRand = (): number => 0.5;

describe("四档对手", () => {
  it("四档齐全,中文名对得上", () => {
    expect(AI_TIERS).toEqual(["rookie", "normal", "pro", "hell"]);
    expect(AI_TIER_LABELS.rookie).toBe("菜鸟");
    expect(AI_TIER_LABELS.hell).toBe("地狱");
  });

  it("越高档看得越远、走位越稳", () => {
    expect(AI_PARAMS.rookie.sight).toBeLessThan(AI_PARAMS.hell.sight);
    expect(AI_PARAMS.hell.jitter).toBeLessThan(AI_PARAMS.rookie.jitter);
    expect(AI_PARAMS.rookie.splitSkill).toBe(0);
  });

  it("被大圆盯上时会往反方向跑", () => {
    const big: Cell = { id: "b", owner: "big", mass: 400, x: 560, y: 500, vx: 0, vy: 0, bornAt: 0 };
    const move = aiSteer(view({ others: [big] }), "pro", noRand);
    expect(move.aim.x).toBeLessThan(500);
  });

  it("会去追吃得下的小圆", () => {
    const small: Cell = { id: "s2", owner: "other", mass: 15, x: 620, y: 500, vx: 0, vy: 0, bornAt: 0 };
    const move = aiSteer(view({ others: [small] }), "pro", noRand);
    expect(move.aim.x).toBeGreaterThan(560);
  });

  it("高手档会在够得着的时候拍分身,菜鸟不会", () => {
    const small: Cell = { id: "s2", owner: "other", mass: 12, x: 540, y: 500, vx: 0, vy: 0, bornAt: 0 };
    const v = view({ self: { id: "s", owner: "me", mass: 120, x: 500, y: 500, vx: 0, vy: 0, bornAt: 0 }, others: [small] });
    expect(aiSteer(v, "hell", noRand).split).toBe(true);
    expect(aiSteer(v, "rookie", noRand).split).toBe(false);
  });

  it("比刺球小的时候会绕开刺球", () => {
    const move = aiSteer(
      view({ viruses: [{ id: "v", x: 520, y: 500, mass: 200, fed: 0 }] }),
      "pro",
      noRand
    );
    expect(move.aim.x).toBeLessThan(500);
  });

  it("没人可追时会去捡彩豆", () => {
    const move = aiSteer(view({ pellets: [{ id: "p", x: 560, y: 520 }] }), "normal", noRand);
    expect(dist(move.aim, { x: 560, y: 520 })).toBeLessThan(120);
  });

  it("准星永远在地图里,而且不是 NaN", () => {
    for (const tier of AI_TIERS) {
      const move = aiSteer(view({ pellets: [{ id: "p", x: -900, y: 9999 }] }), tier, () => 0.99);
      expect(move.aim.x).toBeGreaterThanOrEqual(0);
      expect(move.aim.x).toBeLessThanOrEqual(1000);
      expect(Number.isFinite(move.aim.y)).toBe(true);
    }
  });

  it("视野里什么都没有也不会抛异常", () => {
    for (const tier of AI_TIERS) {
      expect(() => aiSteer(view(), tier, noRand)).not.toThrow();
    }
  });
});

describe("档位强度单调", () => {
  it("同一个 seed 跑两次结果一模一样", () => {
    const a = simulateDuel("hell", "rookie", 42);
    const b = simulateDuel("hell", "rookie", 42);
    expect(a).toEqual(b);
  });

  it("地狱档对菜鸟档 20 局明显更强", () => {
    const wins = duelWins("hell", "rookie", 20);
    expect(wins).toBeGreaterThanOrEqual(15);
  });

  it("高手档对菜鸟档也占上风", () => {
    expect(duelWins("pro", "rookie", 20)).toBeGreaterThanOrEqual(13);
  });

  it("同档对同档不会一边倒", () => {
    const wins = duelWins("normal", "normal", 20);
    expect(wins).toBeGreaterThan(3);
    expect(wins).toBeLessThan(17);
  });
});
