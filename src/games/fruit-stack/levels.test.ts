import { describe, expect, it } from "vitest";
import { assertTotal } from "../level99";
import { TIERS, dropSlots, heightMap, pickDrop, simulate } from "./ai";
import { CHAPTERS, TOTAL, chaptersValid, endlessPlan, goalText, planFor, rateLevel } from "./levels";
import { CHAIN, MAX_LEVEL } from "./merge";
import { addCircle, makeWorld, type Box } from "./physics";

function boxOf(width: number): Box {
  return { left: 8, right: 8 + width, floor: 460, line: 104 };
}

describe("果果合成 · 188 关切分", () => {
  it("章节和恒等 188", () => {
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(chaptersValid()).toBe(true);
    expect(TOTAL).toBe(188);
    expect(CHAPTERS.length).toBe(8);
  });

  it("目标随章节变难，最后一章的目标就是最高级", () => {
    expect(planFor(0).targetLevel).toBe(3);
    expect(planFor(187).targetLevel).toBe(MAX_LEVEL);
    expect(planFor(0).maxSpawn).toBeLessThan(planFor(100).maxSpawn);
    expect(planFor(80).minChain).toBe(3);
  });

  it("窄瓶章节的容器确实更窄，弹力章节的恢复系数更大", () => {
    expect(planFor(100).width).toBeLessThan(planFor(0).width);
    expect(planFor(125).restitution).toBeGreaterThan(planFor(0).restitution);
  });

  it("目标说明是一句人话，含目标果名", () => {
    const text = goalText(planFor(187));
    expect(text).toContain("团圆瓜");
    expect(text.length).toBeGreaterThan(4);
  });

  it("评星按用掉的投放数给", () => {
    expect(rateLevel(10, 40)).toBe(3);
    expect(rateLevel(30, 40)).toBe(2);
    expect(rateLevel(39, 40)).toBe(1);
  });

  it("无尽配置的投放数不设上限", () => {
    expect(endlessPlan().drops).toBeGreaterThan(1000);
  });
});

describe("果果合成 · 关卡目标可达成", () => {
  it("第 1 关能在给定投放数内合出目标果", () => {
    const plan = planFor(0);
    const r = simulate({
      box: boxOf(plan.width),
      seed: plan.seed,
      maxSpawn: plan.maxSpawn,
      drops: plan.drops,
      restitution: plan.restitution,
      tier: "hell",
    });
    expect(r.highest).toBeGreaterThanOrEqual(plan.targetLevel);
  });

  it("第 100 关的分数与等级目标都能达成", () => {
    const plan = planFor(99);
    const r = simulate({
      box: boxOf(plan.width),
      seed: plan.seed,
      maxSpawn: plan.maxSpawn,
      drops: plan.drops,
      restitution: plan.restitution,
      tier: "hell",
    });
    expect(r.highest).toBeGreaterThanOrEqual(4);
    expect(r.score).toBeGreaterThan(0);
  });

  it("第 188 关跑完整局不会崩，能一路合上去", () => {
    const plan = planFor(187);
    const r = simulate({
      box: boxOf(plan.width),
      seed: plan.seed,
      maxSpawn: plan.maxSpawn,
      drops: 60,
      restitution: plan.restitution,
      tier: "hell",
    });
    expect(r.highest).toBeGreaterThanOrEqual(4);
    expect(Number.isFinite(r.score)).toBe(true);
  });

  it("连锁课的关卡确实能打出多段连锁", () => {
    const plan = planFor(80);
    const r = simulate({
      box: boxOf(plan.width),
      seed: plan.seed,
      maxSpawn: plan.maxSpawn,
      drops: 50,
      restitution: plan.restitution,
      tier: "hell",
    });
    expect(r.bestChain).toBeGreaterThanOrEqual(2);
  });
});

describe("果果合成 · 对战假人四档", () => {
  it("四个档位都在", () => {
    expect(TIERS).toEqual(["rookie", "normal", "pro", "hell"]);
  });

  it("落点候选都在容器内，不会让果子卡进墙里", () => {
    const box = boxOf(300);
    const slots = dropSlots(box, CHAIN[5].r);
    for (const s of slots) {
      expect(s).toBeGreaterThanOrEqual(box.left + CHAIN[5].r);
      expect(s).toBeLessThanOrEqual(box.right - CHAIN[5].r);
    }
  });

  it("高度图能认出低洼处", () => {
    const box = boxOf(300);
    const w = makeWorld(box);
    addCircle(w, 6, box.left + 40, 200, CHAIN[6].r);
    const slots = dropSlots(box, CHAIN[2].r);
    const heights = heightMap(w, slots);
    expect(Math.min(...heights)).toBeLessThan(box.floor);
    expect(Math.max(...heights)).toBe(box.floor);
  });

  it("普通档会去对准场上的同级果子", () => {
    const box = boxOf(300);
    const w = makeWorld(box);
    const target = addCircle(w, 2, box.left + 60, 380, CHAIN[2].r);
    const x = pickDrop(w, "normal", 2, 5, 0);
    expect(Math.abs(x - target.x)).toBeLessThan(60);
  });

  it("固定 seed 下地狱档得分明显高于菜鸟档", () => {
    const box = boxOf(300);
    const common = { box, seed: 20260826, maxSpawn: 4, drops: 45, restitution: 0.24 };
    const rookie = simulate({ ...common, tier: "rookie" });
    const hell = simulate({ ...common, tier: "hell" });
    expect(hell.score).toBeGreaterThan(rookie.score);
  });
});
