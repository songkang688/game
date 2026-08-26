import { describe, expect, it } from "vitest";
import {
  AI_HINTS,
  AI_LABELS,
  AI_LEVELS,
  AI_MISTAKE_CHANCE,
  AI_REACTION_SECONDS,
  type AiLevel,
  type AiView,
  createBrain,
  decide,
  planFor,
} from "./ai";
import { type Entity, createTrackGen, speedAt } from "./logic";
import { createMatch, stepMatch } from "./match";

const at = (kind: Entity["kind"], lane: 0 | 1 | 2, m: number): Entity => ({ kind, lane, at: m });

function view(partial: Partial<AiView> & { entities: Entity[] }): AiView {
  return {
    lane: 1,
    dist: 0,
    speed: 50,
    jumping: false,
    sliding: false,
    from: 0,
    ...partial,
  };
}

describe("人机三档的档位设定", () => {
  it("三档都配了名字和说明", () => {
    for (const level of AI_LEVELS) {
      expect(AI_LABELS[level].length).toBeGreaterThan(0);
      expect(AI_HINTS[level].length).toBeGreaterThan(0);
    }
    expect(AI_LEVELS.length).toBe(3);
  });

  it("档位越高反应越快、失误越少", () => {
    expect(AI_REACTION_SECONDS[0]).toBeGreaterThan(AI_REACTION_SECONDS[1]);
    expect(AI_REACTION_SECONDS[1]).toBeGreaterThan(AI_REACTION_SECONDS[2]);
    expect(AI_MISTAKE_CHANCE[0]).toBeGreaterThan(AI_MISTAKE_CHANCE[1]);
    expect(AI_MISTAKE_CHANCE[1]).toBeGreaterThan(AI_MISTAKE_CHANCE[2]);
  });

  it("高手档也有反应延迟,不是每帧都在重算", () => {
    expect(AI_REACTION_SECONDS[2]).toBeGreaterThan(0);
  });
});

describe("电脑的标准解法", () => {
  it("能换到空道就换道,不去冒险跳", () => {
    const v = view({ entities: [at("hurdle", 1, 100)], lane: 1, dist: 90, speed: 50 });
    expect(planFor(v, false)).toBe("left");
  });

  it("障碍还远的时候按兵不动", () => {
    const v = view({ entities: [at("rock", 1, 100)], lane: 1, dist: 30, speed: 50 });
    expect(planFor(v, false)).toBeNull();
  });

  it("三条道都是木栏时,贴近了才起跳", () => {
    const walls = [at("hurdle", 0, 100), at("hurdle", 1, 100), at("hurdle", 2, 100)];
    expect(planFor(view({ entities: walls, lane: 1, dist: 80, speed: 50 }), false)).toBeNull();
    expect(planFor(view({ entities: walls, lane: 1, dist: 97, speed: 50 }), false)).toBe("jump");
  });

  it("三条道都是横杆时改成下滑", () => {
    const bars = [at("gate", 0, 100), at("gate", 1, 100), at("gate", 2, 100)];
    expect(planFor(view({ entities: bars, lane: 1, dist: 97, speed: 50 }), false)).toBe("slide");
  });

  it("已经在跳/在滑就不会再按一次", () => {
    const walls = [at("hurdle", 0, 100), at("hurdle", 1, 100), at("hurdle", 2, 100)];
    const v = view({ entities: walls, lane: 1, dist: 97, speed: 50, jumping: true });
    expect(planFor(v, false)).toBeNull();
  });

  it("自己这条道被石头堵死,就挪到跳得过或滑得过的那条", () => {
    const wall = [at("rock", 0, 100), at("gate", 1, 100), at("rock", 2, 100)];
    expect(planFor(view({ entities: wall, lane: 0, dist: 90, speed: 50 }), false)).toBe("right");
  });

  it("前面干净时才顺手拐去吃金币,不贪的档次就直着跑", () => {
    const v = view({ entities: [at("coin", 2, 60)], lane: 1, dist: 30, speed: 50 });
    expect(planFor(v, true)).toBe("right");
    expect(planFor(v, false)).toBeNull();
  });

  it("金币藏在障碍后面就不去了", () => {
    const v = view({
      entities: [at("rock", 2, 58), at("coin", 2, 60)],
      lane: 1,
      dist: 30,
      speed: 50,
    });
    expect(planFor(v, true)).toBeNull();
  });
});

describe("反应延迟与失误", () => {
  it("没到重新思考的时刻,一律不动", () => {
    const brain = createBrain(2, 12345);
    const v = view({ entities: [at("hurdle", 1, 100)], lane: 1, dist: 90, speed: 50 });
    expect(decide(brain, v, 0)).toBe("left");
    expect(decide(brain, v, 0.05)).toBeNull();
    expect(brain.nextThinkAt).toBeCloseTo(AI_REACTION_SECONDS[2], 6);
  });

  it("同一个种子跑出同一串行为(可复现)", () => {
    const v = view({ entities: [at("hurdle", 1, 100)], lane: 1, dist: 90, speed: 50 });
    const a = createBrain(0, 4242);
    const b = createBrain(0, 4242);
    const seqA: Array<string | null> = [];
    const seqB: Array<string | null> = [];
    for (let t = 0; t < 12; t += 0.5) {
      seqA.push(decide(a, v, t));
      seqB.push(decide(b, v, t));
    }
    expect(seqA).toEqual(seqB);
    expect(seqA.some((x) => x !== null)).toBe(true);
  });

  it("新手档真的会愣神,高手档基本不愣", () => {
    const v = view({ entities: [at("hurdle", 1, 100)], lane: 1, dist: 90, speed: 50 });
    const count = (level: AiLevel): number => {
      const brain = createBrain(level, 99);
      let misses = 0;
      for (let i = 0; i < 300; i++) {
        if (decide(brain, v, i) === null) misses++;
      }
      return misses;
    };
    const easy = count(0);
    const hard = count(2);
    expect(easy).toBeGreaterThan(40);
    expect(hard).toBeLessThan(easy / 3);
  });
});

describe("三档实战差距", () => {
  /** 让电脑在无尽赛里跑到三颗心用完,回报它跑了多远、撞了几次 */
  function soloRun(level: AiLevel, seed: number): { dist: number; crashes: number } {
    const state = createMatch({ mode: "endless", seed, aiLevel: level });
    for (let i = 0; i < 60 * 180 && !state.runners[1].out; i++) {
      stepMatch(state, 1 / 60);
    }
    return { dist: state.runners[1].dist, crashes: state.runners[1].crashes };
  }

  it("赛道本身是能跑的:高手档轻松跑过热身段", () => {
    const track = createTrackGen(7).ensure(1000);
    expect(track.length).toBeGreaterThan(0);
    expect(speedAt(0)).toBeGreaterThan(0);
    expect(soloRun(2, 7).dist).toBeGreaterThan(300);
  });

  it("高手档比新手档跑得明显更远", () => {
    const seeds = [3, 11, 58, 404, 2026];
    const easy = seeds.map((s) => soloRun(0, s).dist);
    const hard = seeds.map((s) => soloRun(2, s).dist);
    const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(hard)).toBeGreaterThan(avg(easy) * 1.5);
  });

  it("中档夹在新手和高手中间", () => {
    const seeds = [3, 11, 58, 404, 2026];
    const avg = (level: AiLevel): number =>
      seeds.reduce((sum, s) => sum + soloRun(level, s).dist, 0) / seeds.length;
    const easy = avg(0);
    const mid = avg(1);
    const hard = avg(2);
    expect(mid).toBeGreaterThan(easy);
    expect(hard).toBeGreaterThan(mid);
  });

  it("新手档会真的撞上东西(不是无敌陪跑)", () => {
    expect(soloRun(0, 11).crashes).toBeGreaterThan(0);
  });
});
