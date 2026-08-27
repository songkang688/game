// 四档假人:从随手一丢到先在脑子里落一遍,固定 seed 下地狱档明显强过菜鸟档。
import { describe, expect, it } from "vitest";
import {
  AI_LABEL,
  bestMatchX,
  chooseDropX,
  cloneWorld,
  columnCrowded,
  evaluateBowl,
  lowestColumnX,
  runHeadless,
  scoreCandidate,
  settleWorld,
  type AiLevel,
} from "./ai";
import { buildLevel, type StackLevel } from "./levels";
import { TOP_LEVEL, radiusOf } from "./merge";
import { DEFAULT_TUNING, addFruit, createWorld, type World } from "./physics";

const SKILLS: AiLevel[] = [1, 2, 3, 4];

function bowl(w = 300, h = 430): World {
  return createWorld({ box: { w, h }, lineY: 96, seed: 33 });
}

function pile(world: World, xs: number[], level = 3): void {
  for (const x of xs) {
    addFruit(world, { level, x, y: world.box.h - radiusOf(level), r: radiusOf(level), graceMs: 0 });
  }
}

/** 又小又深的盆:放哪儿真的会影响结果,四档的差距才看得出来 */
function tightBowl(seed: number): StackLevel {
  return {
    index: -1,
    chapter: 6,
    box: { w: 220, h: 340 },
    lineY: 84,
    minDrop: 3,
    maxDrop: 5,
    goal: { kind: "level", value: TOP_LEVEL + 1 },
    drops: 200,
    tuning: { ...DEFAULT_TUNING },
    seed,
    hint: "",
    split: false,
  };
}

describe("四档假人", () => {
  it("四档都有中文档位名", () => {
    expect(Object.keys(AI_LABEL).length).toBe(4);
    expect(AI_LABEL[1]).toBe("菜鸟");
    expect(AI_LABEL[4]).toBe("地狱");
  });

  it("四档给出的落点都在盆里", () => {
    for (const skill of SKILLS) {
      const w = bowl();
      pile(w, [40, 90, 140]);
      for (let tick = 0; tick < 6; tick++) {
        const x = chooseDropX(w, 3, skill, tick);
        expect(x).toBeGreaterThanOrEqual(radiusOf(3) - 1e-6);
        expect(x).toBeLessThanOrEqual(w.box.w - radiusOf(3) + 1e-6);
      }
    }
  });

  it("菜鸟档是真的随手丢:换一颗就换个地方", () => {
    const w = bowl();
    const xs = new Set<number>();
    for (let tick = 0; tick < 12; tick++) xs.add(Math.round(chooseDropX(w, 1, 1, tick)));
    expect(xs.size).toBeGreaterThan(6);
  });

  it("普通档会对准同级的那颗", () => {
    const w = bowl();
    addFruit(w, { level: 4, x: 210, y: 400, r: radiusOf(4), graceMs: 0 });
    addFruit(w, { level: 1, x: 60, y: 410, r: radiusOf(1), graceMs: 0 });
    expect(bestMatchX(w, 4)).toBe(210);
    expect(chooseDropX(w, 4, 2, 0)).toBeCloseTo(210, 3);
  });

  it("普通档不往已经顶到警戒线的那一摞上压", () => {
    const w = bowl();
    // 左边那一摞已经顶到警戒线跟前,顶上正好是一颗四级果子;右下角还躺着一颗同级的
    addFruit(w, { level: 6, x: 40, y: 380, r: radiusOf(6), graceMs: 0 });
    addFruit(w, { level: 5, x: 40, y: 260, r: radiusOf(5), graceMs: 0 });
    addFruit(w, { level: 4, x: 40, y: 130, r: radiusOf(4), graceMs: 0 });
    addFruit(w, { level: 4, x: 250, y: 400, r: radiusOf(4), graceMs: 0 });
    const match = bestMatchX(w, 4)!;
    expect(match).toBe(40);
    expect(columnCrowded(w, match, 4)).toBe(true);
    // 认出来这一摞压不得,就改往低洼处放
    const x = chooseDropX(w, 4, 2, 0);
    expect(Math.abs(x - match)).toBeGreaterThan(radiusOf(4));
    expect(columnCrowded(w, x, 4)).toBe(false);
  });

  it("那一摞还没到警戒线的时候，普通档照旧对准同级的那颗", () => {
    const w = bowl();
    addFruit(w, { level: 4, x: 210, y: 400, r: radiusOf(4), graceMs: 0 });
    expect(columnCrowded(w, 210, 4)).toBe(false);
    expect(chooseDropX(w, 4, 2, 0)).toBeCloseTo(210, 3);
  });

  it("高手档往低洼处放,不往已经堆高的那边补", () => {
    const w = bowl();
    for (let i = 0; i < 4; i++) {
      addFruit(w, { level: 5, x: 40, y: w.box.h - 32 - i * 62, r: radiusOf(5), graceMs: 0 });
    }
    expect(lowestColumnX(w, 9)).toBeGreaterThan(100);
    expect(chooseDropX(w, 0, 3, 0)).toBeGreaterThan(100);
  });

  it("地狱档会挑一个真的能合上的落点", () => {
    const w = bowl();
    addFruit(w, { level: 4, x: 210, y: w.box.h - radiusOf(4), r: radiusOf(4), graceMs: 0 });
    settleWorld(w, 80);
    const x = chooseDropX(w, 4, 4, 0);
    expect(Math.abs(x - 210)).toBeLessThan(60);
  });
});

describe("推演工具", () => {
  it("复制出来的世界怎么折腾都不影响原来的那盆", () => {
    const w = bowl();
    pile(w, [60, 150, 240]);
    const copy = cloneWorld(w);
    copy.fruits[0].x = 999;
    copy.fruits.pop();
    copy.score = 500;
    expect(w.fruits.length).toBe(3);
    expect(w.fruits[0].x).toBe(60);
    expect(w.score).toBe(0);
    expect(copy.pullMs).toBe(0);
  });

  it("堆得越低的盆评价越高", () => {
    const low = bowl();
    pile(low, [60, 150, 240]);
    const high = bowl();
    pile(high, [60, 150, 240]);
    for (const f of high.fruits) f.y = 120;
    expect(evaluateBowl(low)).toBeGreaterThan(evaluateBowl(high));
  });

  it("会把自己撑爆的落点直接判死刑", () => {
    const w = bowl(220, 340);
    // 六颗等级各不相同,谁也合不了谁,叠起来必定顶出警戒线
    let y = w.box.h;
    for (const level of [7, 6, 5, 4, 3, 2]) {
      y -= radiusOf(level);
      addFruit(w, { level, x: 110, y, r: radiusOf(level), graceMs: 0 });
      y -= radiusOf(level);
    }
    settleWorld(w, 200);
    expect(scoreCandidate(w, 0, 110)).toBeLessThan(-1000);
  });

  it("settleWorld 会让整盆停下来", () => {
    const w = bowl();
    addFruit(w, { level: 3, x: 150, y: 60, r: radiusOf(3) });
    const steps = settleWorld(w, 400);
    expect(steps).toBeLessThan(400);
    expect(w.fruits[0].y).toBeGreaterThan(300);
  });
});

describe("无头对局", () => {
  it("同一关同一档跑两遍结果一模一样", () => {
    const lv = buildLevel(30);
    const a = runHeadless(lv, 3);
    const b = runHeadless(lv, 3);
    expect(a.score).toBe(b.score);
    expect(a.drops).toBe(b.drops);
    expect(a.won).toBe(b.won);
  });

  it("投放数量上限会被遵守", () => {
    const lv = { ...buildLevel(0), goal: { kind: "level" as const, value: TOP_LEVEL + 1 } };
    const res = runHeadless(lv, 1, { maxDrops: 7 });
    expect(res.drops).toBeLessThanOrEqual(7);
    expect(res.world.drops).toBeLessThanOrEqual(7);
  });

  it("固定 seed 下地狱档得分明显高过菜鸟档", () => {
    const seeds = [11, 202, 3003, 40004, 555];
    let rookie = 0;
    let hell = 0;
    let hellWins = 0;
    for (const seed of seeds) {
      const a = runHeadless(tightBowl(seed), 1, { maxDrops: 90 });
      const d = runHeadless(tightBowl(seed), 4, { maxDrops: 90 });
      rookie += a.score;
      hell += d.score;
      if (d.score > a.score) hellWins++;
    }
    expect(rookie).toBeGreaterThan(0);
    expect(hell / rookie, `地狱档 ${hell} 分 vs 菜鸟档 ${rookie} 分,差距太小`).toBeGreaterThan(1.5);
    expect(hellWins, "地狱档至少要在五个种子里赢下四个").toBeGreaterThanOrEqual(4);
  }, 60000);
});
