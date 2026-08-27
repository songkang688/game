import { describe, expect, it } from "vitest";
import { makeRng } from "./endless";
import {
  DRAW_SLACK,
  RIVAL_LEVELS,
  RIVAL_PROFILES,
  VERSUS_SECONDS,
  rivalSteer,
  versusCopy,
  versusOutcome,
} from "./versus";
import type { RivalView } from "./versus";

function view(patch: Partial<RivalView> = {}): RivalView {
  return {
    self: { x: 300, y: 240, r: 30 },
    player: { x: 320, y: 240, r: 30 },
    prey: null,
    threat: null,
    width: 640,
    height: 480,
    ...patch,
  };
}

describe("三档对手", () => {
  it("乱游 / 会躲 / 会反杀,一档比一档难", () => {
    expect(RIVAL_LEVELS).toEqual(["wander", "dodge", "hunter"]);
    for (const id of RIVAL_LEVELS) expect(RIVAL_PROFILES[id].id).toBe(id);
    const [a, b, c] = RIVAL_LEVELS.map((id) => RIVAL_PROFILES[id]);
    expect(a.speedMul).toBeLessThan(b.speedMul);
    expect(b.speedMul).toBeLessThan(c.speedMul);
    expect(a.sight).toBeLessThan(b.sight);
    expect(b.sight).toBeLessThan(c.sight);
    // 抖动一档比一档小:越强越不像在乱游
    expect(a.jitter).toBeGreaterThan(b.jitter);
    expect(b.jitter).toBeGreaterThan(c.jitter);
    expect([a.dodges, b.dodges, c.dodges]).toEqual([false, true, true]);
    expect([a.hunts, b.hunts, c.hunts]).toEqual([false, false, true]);
    expect(VERSUS_SECONDS).toBe(60);
  });

  it("每一帧都给出一个单位向量(或者原地不动)", () => {
    const rng = makeRng(3);
    for (const id of RIVAL_LEVELS) {
      for (let i = 0; i < 200; i++) {
        const m = rivalSteer(RIVAL_PROFILES[id], view({ prey: { x: 100, y: 100, r: 10 } }), rng);
        const len = Math.hypot(m.dx, m.dy);
        expect(Number.isFinite(len)).toBe(true);
        expect(len).toBeLessThanOrEqual(1.0001);
        expect(typeof m.dash).toBe("boolean");
      }
    }
  });

  it("同一个种子给出同一串动作", () => {
    const run = (): Array<[number, number, boolean]> => {
      const rng = makeRng(777);
      return Array.from({ length: 50 }, () => {
        const m = rivalSteer(RIVAL_PROFILES.wander, view(), rng);
        return [m.dx, m.dy, m.dash] as [number, number, boolean];
      });
    };
    expect(run()).toEqual(run());
  });
});

describe("对手怎么走位", () => {
  it("会躲的档:身边有大个子就往反方向闪", () => {
    const m = rivalSteer(
      RIVAL_PROFILES.dodge,
      view({ self: { x: 300, y: 240, r: 20 }, threat: { x: 340, y: 240, r: 60 } }),
      makeRng(1),
    );
    expect(m.dx).toBeLessThan(0);
    expect(m.dash).toBe(true);
  });

  it("会躲的档:玩家长得比它大也算大个子", () => {
    const m = rivalSteer(
      RIVAL_PROFILES.dodge,
      view({ self: { x: 300, y: 240, r: 20 }, player: { x: 300, y: 300, r: 60 } }),
      makeRng(1),
    );
    expect(m.dy).toBeLessThan(0);
  });

  it("乱游的档:再大的东西贴脸也不躲", () => {
    const m = rivalSteer(
      RIVAL_PROFILES.wander,
      view({ self: { x: 300, y: 240, r: 20 }, threat: { x: 310, y: 240, r: 90 } }),
      makeRng(1),
    );
    expect(m.dash).toBe(false);
  });

  it("会反杀的档:自己胖了一圈就掉头追玩家", () => {
    const m = rivalSteer(
      RIVAL_PROFILES.hunter,
      view({ self: { x: 100, y: 240, r: 50 }, player: { x: 500, y: 240, r: 20 } }),
      makeRng(1),
    );
    expect(m.dx).toBeGreaterThan(0.9);
    expect(m.dash).toBe(true);
  });

  it("视野里有吃得下的小鱼就去抢", () => {
    const m = rivalSteer(
      RIVAL_PROFILES.dodge,
      view({ self: { x: 300, y: 240, r: 30 }, prey: { x: 300, y: 340, r: 10 } }),
      makeRng(1),
    );
    expect(m.dy).toBeGreaterThan(0);
  });

  it("什么都没有就顺着抖动乱游,顺便往池心带一点", () => {
    const m = rivalSteer(
      RIVAL_PROFILES.wander,
      view({ self: { x: 20, y: 20, r: 30 }, player: { x: 600, y: 460, r: 30 } }),
      makeRng(1),
    );
    expect(Math.hypot(m.dx, m.dy)).toBeCloseTo(1, 6);
  });

  it("小鱼在视野外就不追", () => {
    const m = rivalSteer(
      RIVAL_PROFILES.wander,
      view({ self: { x: 320, y: 240, r: 30 }, prey: { x: 320, y: 2400, r: 8 } }),
      makeRng(1),
    );
    expect(m.dash).toBe(false);
  });
});

describe("胜负与结算文案", () => {
  it("差不到 1 像素算平局", () => {
    expect(versusOutcome(40, 30)).toBe("win");
    expect(versusOutcome(30, 40)).toBe("lose");
    expect(versusOutcome(40, 40)).toBe("draw");
    expect(versusOutcome(40, 40 - DRAW_SLACK)).toBe("draw");
    expect(versusOutcome(40, 40 - DRAW_SLACK - 0.01)).toBe("win");
    expect(versusOutcome(40, 40 + DRAW_SLACK + 0.01)).toBe("lose");
  });

  it("三种结果都有话说,输了也只鼓励", () => {
    for (const outcome of ["win", "lose", "draw"] as const) {
      const copy = versusCopy(outcome, RIVAL_PROFILES.hunter, 42.4, 30.6);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.line).toContain("42");
      expect(copy.line).toContain("31");
      expect(copy.lines).toHaveLength(2);
      for (const bad of ["血", "伤", "死", "杀死", "笨", "菜"]) {
        expect(copy.title + copy.line).not.toContain(bad);
      }
    }
    expect(versusCopy("lose", RIVAL_PROFILES.wander, 20, 40).line).toContain("下次");
  });
});
