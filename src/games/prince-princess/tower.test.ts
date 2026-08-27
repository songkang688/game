/**
 * 无尽「城堡塔」的用例。
 *
 * 招牌那一条:**随机 2000 段全部可过**。
 * 这里不是跑 2000 局机器人赌运气,而是把 2000 段随机拼出来的层挨个交给 `validateFloor`
 * 静态核对一遍(起跑台、落脚点、断口宽度、尖刺跨度、平台抬升、巡逻踩空、必过窗口连不连得上),
 * 一条问题都不许有。再抽一小撮真的让机器人跑通,证明校验器没在自说自话。
 */
import { describe, expect, it } from "vitest";

import {
  SKY_GEM_RISE,
  TEMPLATE_NAMES,
  buildTowerFloor,
  buildTowerFloorSeeded,
  floorPassable,
  kindsForFloor,
  minFoesFor,
  validateFloor,
  type TowerFloor,
} from "./tower";
import { MAX_GAP, MAX_PLATFORM_RISE, MAX_SPIKE_RUN, START_PAD } from "./geometry";
import { buildEndless } from "./levels";
import { autoPlay, createWorld, doubleJumpApex, jumpApex } from "./logic";

describe("城堡塔 · 模板", () => {
  it("七张模板都在,名字不重样", () => {
    expect(TEMPLATE_NAMES.length).toBe(7);
    expect(new Set(TEMPLATE_NAMES).size).toBe(7);
  });

  it("越高层认识的怪越多,怪的下限也一层比一层高", () => {
    expect(kindsForFloor(0)).toEqual(["slime"]);
    expect(kindsForFloor(9)).toContain("turret");
    for (let f = 1; f < 20; f++) {
      expect(kindsForFloor(f).length).toBeGreaterThanOrEqual(kindsForFloor(f - 1).length);
      expect(minFoesFor(f)).toBeGreaterThanOrEqual(minFoesFor(f - 1));
    }
  });

  it("同一层拼两遍结果一模一样(没有藏起来的随机)", () => {
    for (const f of [0, 3, 7, 12, 40]) {
      expect(JSON.stringify(buildTowerFloor(f))).toBe(JSON.stringify(buildTowerFloor(f)));
    }
  });

  it("一层里模板不会只剩一种,越往上花样越多", () => {
    const low = buildTowerFloor(1).pieces;
    const high = buildTowerFloor(12).pieces;
    expect(low.length).toBeGreaterThanOrEqual(3);
    expect(new Set(high).size).toBeGreaterThanOrEqual(2);
  });

  it("高空宝石:王子够不着,公主二段跳够得着", () => {
    // 拾取判定能往头顶上再够 70,所以两边都得把这 70 算进去
    const princeReach = jumpApex("prince") + 70;
    const princessReach = doubleJumpApex() + 70;
    expect(SKY_GEM_RISE).toBeGreaterThan(princeReach);
    expect(SKY_GEM_RISE).toBeLessThan(princessReach);
  });
});

describe("城堡塔 · 必过窗口", () => {
  it("随机 2000 段全部可过", () => {
    const bad: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const floor = buildTowerFloorSeeded(i % 60, 0x9e3779b9 + i * 2654435761);
      const problems = validateFloor(floor);
      if (problems.length > 0) bad.push(`第 ${i} 段(第 ${floor.floor + 1} 层):${problems.slice(0, 3).join(" / ")}`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(bad).toHaveLength(0);
  });

  it("正式的前 60 层也一层不落地全过", () => {
    for (let f = 0; f < 60; f++) {
      expect(validateFloor(buildTowerFloor(f)), `第 ${f + 1} 层`).toEqual([]);
      expect(floorPassable(buildTowerFloor(f))).toBe(true);
    }
  });

  it("校验器不是摆设:断口拉宽、尖刺加长、窗口挖断都会被抓出来", () => {
    const broken = (mut: (f: TowerFloor) => void): string[] => {
      const f = buildTowerFloor(6);
      const copy: TowerFloor = JSON.parse(JSON.stringify(f));
      mut(copy);
      return validateFloor(copy);
    };
    expect(broken((f) => f.gaps.push({ x0: 600, x1: 600 + MAX_GAP + 60 })).length).toBeGreaterThan(0);
    expect(broken((f) => f.spikes.push({ x: 700, w: MAX_SPIKE_RUN + 40 })).length).toBeGreaterThan(0);
    expect(broken((f) => f.platforms.push({ x: 700, y: -MAX_PLATFORM_RISE - 30, w: 120, kind: "solid" })).length).toBeGreaterThan(0);
    expect(broken((f) => void f.windows.splice(2, 2)).length).toBeGreaterThan(0);
    expect(broken((f) => void (f.windows = [])).length).toBeGreaterThan(0);
  });

  it("起跑台永远是一段干净平地", () => {
    for (let f = 0; f < 30; f++) {
      const floor = buildTowerFloor(f);
      expect(floor.gaps.every((g) => g.x0 >= START_PAD)).toBe(true);
      expect(floor.spikes.every((s) => s.x >= START_PAD)).toBe(true);
    }
  });
});

describe("城堡塔 · 接进无尽模式", () => {
  it("一层一层往上越长越挤,而且始终不限时", () => {
    const a = buildEndless(0);
    const b = buildEndless(8);
    expect(b.len).toBeGreaterThan(a.len);
    expect(b.enemies.length).toBeGreaterThanOrEqual(a.enemies.length);
    for (let r = 0; r < 12; r++) expect(buildEndless(r).timeLimit).toBe(0);
  });

  it("每第 5 层守着一位首领", () => {
    for (let r = 0; r < 20; r++) {
      expect(Boolean(buildEndless(r).boss)).toBe(r > 0 && r % 5 === 4);
    }
  });

  it("机器人真的能一层一层爬上去(前 12 层,含两位守门首领)", () => {
    for (let r = 0; r < 12; r++) {
      const def = buildEndless(r);
      const res = autoPlay(createWorld(def, 2), { maxSeconds: 300 });
      expect(res.win, `第 ${r + 1} 层 ${def.name}`).toBe(true);
    }
  });

  it("高层抽样也爬得动", () => {
    for (const r of [17, 23, 31, 42]) {
      const def = buildEndless(r);
      const res = autoPlay(createWorld(def, 2), { maxSeconds: 400 });
      expect(res.win, `第 ${r + 1} 层 ${def.name}`).toBe(true);
    }
  });
});
