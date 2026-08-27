import { describe, expect, it } from "vitest";
import {
  ABILITY_WINDOW_FROM,
  ABILITY_WINDOW_TO,
  BIRD_ABILITIES,
  BREAK_THRESHOLD,
  LAUNCH_CEILING,
  MATERIALS,
  PREDICT_POINTS,
  PREDICT_SHARP_RATIO,
  TOWER_BASE_FLOORS,
  TOWER_BIRDS,
  TOWER_MAX_FLOORS,
  type CollapseBlock,
  bestTowerScore,
  buildTower,
  buildTowerLevel,
  canTriggerAbility,
  collapseDamage,
  levelHasReachableTarget,
  mainMaterialsOrdered,
  materialVuln,
  maxLaunchSpeed,
  predictCoversRatio,
  predictDots,
  resolveCollapse,
  restsOn,
  solvabilitySample,
  solveProbes,
  towerFloors,
  towerScore,
  triggerableBirds,
} from "./depth12";
import { LEVELS, type BlockKind } from "./levels";
import { MAX_DRAG, launchVelocity, simulateTrajectory, SLING_X, SLING_Y } from "./physics";

/* ---------------- 弹道预测 ---------------- */

describe("1.2 弹道预测", () => {
  it("点数在 8–12 之间，前段实、后段淡", () => {
    const dots = predictDots(-MAX_DRAG * 0.8, MAX_DRAG * 0.5);
    expect(dots.length).toBeGreaterThanOrEqual(8);
    expect(dots.length).toBeLessThanOrEqual(12);
    const sharp = Math.round(PREDICT_POINTS * PREDICT_SHARP_RATIO);
    expect(dots[0].alpha).toBe(1);
    expect(dots[sharp].alpha).toBeLessThan(1);
    expect(dots[dots.length - 1].alpha).toBeLessThan(dots[sharp].alpha);
  });

  it("后段的点越来越小，视觉上就是淡出", () => {
    const dots = predictDots(-MAX_DRAG, MAX_DRAG * 0.6);
    for (let i = 1; i < dots.length; i++) {
      expect(dots[i].radius).toBeLessThanOrEqual(dots[i - 1].radius + 1e-9);
    }
  });

  it("没拉弓就不画预测点", () => {
    expect(predictDots(0, 0)).toEqual([]);
  });

  it("预测点只覆盖弹道的一段，不给完整落点圈", () => {
    const ratio = predictCoversRatio(-MAX_DRAG, MAX_DRAG * 0.7);
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);
  });

  it("预测点和真实弹道用同一套积分，前段完全重合", () => {
    const dragX = -MAX_DRAG * 0.7;
    const dragY = MAX_DRAG * 0.4;
    const { vx, vy } = launchVelocity(dragX, dragY);
    const truth = simulateTrajectory(SLING_X, SLING_Y, vx, vy, 1, [], PREDICT_POINTS, 0.07);
    const dots = predictDots(dragX, dragY);
    for (let i = 0; i < 3; i++) {
      expect(dots[i].x).toBeCloseTo(truth[i].x, 6);
      expect(dots[i].y).toBeCloseTo(truth[i].y, 6);
    }
  });

  it("拉满弓的初速不超过封顶值", () => {
    expect(maxLaunchSpeed()).toBeLessThanOrEqual(LAUNCH_CEILING + 1e-6);
  });
});

/* ---------------- 材质 ---------------- */

describe("1.2 材质与硬度表", () => {
  it("每一种方块材质都配了硬度、质量、颜色与音效", () => {
    const kinds: BlockKind[] = ["wood", "stone", "ice", "glass", "tnt", "shell", "core"];
    for (const k of kinds) {
      const m = MATERIALS[k];
      expect(m.kind).toBe(k);
      expect(m.hardness).toBeGreaterThan(0);
      expect(m.mass).toBeGreaterThan(0);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.hint.length).toBeGreaterThan(0);
    }
  });

  it("三种主材质硬度严格分层：冰 < 木 < 石", () => {
    expect(mainMaterialsOrdered()).toBe(true);
  });

  it("越结实越不容易掉（易损系数是硬度的倒数）", () => {
    expect(materialVuln("ice")).toBeGreaterThan(materialVuln("wood"));
    expect(materialVuln("wood")).toBeGreaterThan(materialVuln("stone"));
  });

  it("关卡表里出现过的每一种方块都在材质表里有条目", () => {
    const used = new Set<BlockKind>();
    for (const lv of LEVELS) for (const b of lv.blocks) used.add(b.kind);
    for (const k of used) expect(MATERIALS[k]).toBeDefined();
  });
});

/* ---------------- 连锁倒塌 ---------------- */

describe("1.2 连锁倒塌", () => {
  /** 一座三层小塔：0 在最上、2 在最下，垂直叠在一起 */
  function tower(): CollapseBlock[] {
    return [
      { id: 0, kind: "stone", x: 100, y: 100, w: 40, h: 20, damage: 0 },
      { id: 1, kind: "wood", x: 100, y: 120, w: 40, h: 20, damage: 0 },
      { id: 2, kind: "ice", x: 100, y: 140, w: 40, h: 20, damage: 0 },
    ];
  }

  it("能认出「谁压在谁上面」", () => {
    const [a, b, c] = tower();
    expect(restsOn(a, b)).toBe(true);
    expect(restsOn(b, c)).toBe(true);
    expect(restsOn(a, c)).toBe(false);
    expect(restsOn(c, a)).toBe(false);
  });

  it("水平错开就压不到", () => {
    const a: CollapseBlock = { id: 0, kind: "wood", x: 300, y: 100, w: 20, h: 20, damage: 0 };
    const b: CollapseBlock = { id: 1, kind: "wood", x: 100, y: 120, w: 20, h: 20, damage: 0 };
    expect(restsOn(a, b)).toBe(false);
  });

  it("重的砸下来伤害更大，砸到脆的伤害也更大", () => {
    const heavy: CollapseBlock = { id: 0, kind: "stone", x: 0, y: 0, w: 20, h: 20, damage: 0 };
    const light: CollapseBlock = { id: 1, kind: "ice", x: 0, y: 0, w: 20, h: 20, damage: 0 };
    const tough: CollapseBlock = { id: 2, kind: "stone", x: 0, y: 40, w: 20, h: 20, damage: 0 };
    const frail: CollapseBlock = { id: 3, kind: "ice", x: 0, y: 40, w: 20, h: 20, damage: 0 };
    expect(collapseDamage(heavy, tough)).toBeGreaterThan(collapseDamage(light, tough));
    expect(collapseDamage(heavy, frail)).toBeGreaterThan(collapseDamage(heavy, tough));
  });

  it("上面那块塌下来会砸到下面那块（真的会传递）", () => {
    const blocks = tower();
    const steps = resolveCollapse(blocks, [1]);
    expect(steps.length).toBeGreaterThan(0);
    const touched = steps.flatMap((s) => [...s.broken, ...s.hit]);
    expect(touched).toContain(2);
  });

  it("同一个局面永远得到同一串连锁结果（可复现）", () => {
    expect(resolveCollapse(tower(), [1])).toEqual(resolveCollapse(tower(), [1]));
  });

  it("没有东西压在上面时不会凭空连锁", () => {
    const lone: CollapseBlock[] = [{ id: 9, kind: "wood", x: 0, y: 0, w: 20, h: 20, damage: 0 }];
    expect(resolveCollapse(lone, [9])).toEqual([]);
  });

  it("损伤累到阈值才算碎，没到就只是被砸到", () => {
    const blocks: CollapseBlock[] = [
      { id: 0, kind: "ice", x: 0, y: 0, w: 20, h: 20, damage: 0 },
      { id: 1, kind: "wood", x: 0, y: 20, w: 20, h: 20, damage: 0 },
      { id: 2, kind: "stone", x: 0, y: 40, w: 20, h: 20, damage: BREAK_THRESHOLD - 1 },
    ];
    const steps = resolveCollapse(blocks, [1]);
    expect(steps.flatMap((s) => s.broken)).toContain(2);
  });
});

/* ---------------- 鸟的能力 ---------------- */

describe("1.2 鸟的能力与触发窗口", () => {
  it("至少三种鸟有空中触发的能力", () => {
    expect(triggerableBirds().length).toBeGreaterThanOrEqual(3);
  });

  it("直飞豆没有能力，点了也不触发", () => {
    expect(BIRD_ABILITIES.straight.triggerable).toBe(false);
    expect(canTriggerAbility("straight", 1)).toBe(false);
  });

  it("触发窗口是常量：太早太晚都不行", () => {
    expect(canTriggerAbility("split", ABILITY_WINDOW_FROM - 0.01)).toBe(false);
    expect(canTriggerAbility("split", ABILITY_WINDOW_FROM)).toBe(true);
    expect(canTriggerAbility("split", ABILITY_WINDOW_TO)).toBe(true);
    expect(canTriggerAbility("split", ABILITY_WINDOW_TO + 0.01)).toBe(false);
  });

  it("每一种能力鸟都有一句孩子看得懂的说明", () => {
    for (const kind of triggerableBirds()) {
      expect(BIRD_ABILITIES[kind].hint.length).toBeGreaterThan(0);
      expect(BIRD_ABILITIES[kind].windowTo).toBeGreaterThan(BIRD_ABILITIES[kind].windowFrom);
    }
  });
});

/* ---------------- 无尽打靶塔 ---------------- */

describe("1.2 无尽打靶塔", () => {
  it("塔越往后越高，但有上限", () => {
    expect(towerFloors(1)).toBe(TOWER_BASE_FLOORS);
    let prev = 0;
    for (let n = 1; n <= 30; n++) {
      const f = towerFloors(n);
      expect(f).toBeGreaterThanOrEqual(prev);
      expect(f).toBeLessThanOrEqual(TOWER_MAX_FLOORS);
      prev = f;
    }
    expect(towerFloors(999)).toBe(TOWER_MAX_FLOORS);
  });

  it("固定 seed 生成同一座塔", () => {
    expect(buildTower(5, 1234)).toEqual(buildTower(5, 1234));
    expect(buildTower(5, 1234)).not.toEqual(buildTower(5, 4321));
  });

  it("塔是「上脆下硬」，先打底下才聪明", () => {
    const t = buildTower(8, 2024);
    expect(t.floors[0].kind === "stone" || t.floors[0].kind === "wood").toBe(true);
    const top = t.floors[t.floors.length - 1].kind;
    expect(top === "ice" || top === "glass").toBe(true);
  });

  it("弹数固定，不会因为塔高就多给鸟", () => {
    expect(TOWER_BIRDS).toBeGreaterThan(0);
    expect(Number.isInteger(TOWER_BIRDS)).toBe(true);
  });

  it("打倒得越多分越高，全清有额外奖励", () => {
    const t = buildTower(3, 77);
    expect(towerScore(t, 0)).toBe(0);
    expect(towerScore(t, 1)).toBeGreaterThan(towerScore(t, 0));
    expect(towerScore(t, t.blocks)).toBeGreaterThan(t.blocks * 10);
    expect(towerScore(t, t.blocks + 99)).toBe(towerScore(t, t.blocks));
  });

  it("无尽纪录只增不减", () => {
    expect(bestTowerScore(300, 120)).toBe(300);
    expect(bestTowerScore(300, 480)).toBe(480);
    expect(bestTowerScore(300, Number.NaN)).toBe(300);
  });
});

/* ---------------- 关卡可解性 ---------------- */

describe("1.2 188 关可解性模拟", () => {
  it("采样网格是固定的，所以结论可复现", () => {
    const a = solveProbes();
    const b = solveProbes();
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(100);
  });

  it("抽样 20 关（含 100 / 145 / 188）都存在够得着目标的弹道", () => {
    const sample = solvabilitySample();
    expect(sample.length).toBeGreaterThanOrEqual(20);
    expect(sample).toContain(100);
    expect(sample).toContain(145);
    expect(sample).toContain(188);
    const bad: number[] = [];
    for (const id of sample) {
      const lv = LEVELS[id - 1];
      if (!levelHasReachableTarget(lv)) bad.push(id);
    }
    expect(bad).toEqual([]);
  });

  it("每一关都至少有一颗绿绿豆当目标", () => {
    for (const id of solvabilitySample()) {
      expect(LEVELS[id - 1].beans.length).toBeGreaterThan(0);
    }
  });

  it("目标被挪到够不着的地方时，模拟能当场发现", () => {
    const lv = LEVELS[0];
    const broken = { ...lv, beans: [{ x: 5000, y: -5000 }] };
    expect(levelHasReachableTarget(broken)).toBe(false);
  });
});

/* ---------------- 打靶塔关卡化：无尽复用闯关那块画布 ---------------- */

describe("1.2 打靶塔生成关卡", () => {
  it("同 seed 同座塔生成完全一样的关卡（重来一次是同一座）", () => {
    expect(buildTowerLevel(3, 77)).toEqual(buildTowerLevel(3, 77));
  });

  it("关卡 id 不与 188 关任何一关撞车", () => {
    for (let i = 1; i <= 12; i++) {
      const lv = buildTowerLevel(i, 5);
      expect(LEVELS.some((l) => l.id === lv.id)).toBe(false);
    }
  });

  it("每座塔的小鸟数固定，第一只永远是直球（起手不用猜技能）", () => {
    for (let i = 1; i <= 8; i++) {
      const lv = buildTowerLevel(i, 11);
      expect(lv.birds.length).toBe(TOWER_BIRDS);
      expect(lv.birds[0]).toBe("straight");
    }
  });

  it("方块数与 buildTower 的账对得上，且塔越靠后越高", () => {
    const a = buildTowerLevel(1, 9);
    const b = buildTowerLevel(6, 9);
    expect(a.blocks.length).toBe(buildTower(1, 9).blocks);
    expect(b.blocks.length).toBe(buildTower(6, 9).blocks);
    expect(b.blocks.length).toBeGreaterThan(a.blocks.length);
  });

  it("绿绿豆蹲在塔顶，且塔是从地面往上叠的", () => {
    const lv = buildTowerLevel(4, 21);
    const topBlockY = Math.min(...lv.blocks.map((b) => b.y));
    expect(lv.beans.length).toBe(1);
    expect(lv.beans[0].y).toBeLessThan(topBlockY);
    const bottom = Math.max(...lv.blocks.map((b) => b.y + b.h));
    expect(bottom).toBeGreaterThan(topBlockY);
  });

  it("生成出来的塔，弹弓够得着（无尽不会出不可能的塔）", () => {
    for (let i = 1; i <= 10; i++) {
      expect(levelHasReachableTarget(buildTowerLevel(i, 33), 40)).toBe(true);
    }
  });
});

/* ---------------- 预测点跟着小鸟的重力系数走 ---------------- */

describe("1.2 预测点与实弹一致", () => {
  it("重力系数不同，预测出来的弧线也不同（预览即实弹）", () => {
    const light = predictDots(-MAX_DRAG * 0.7, MAX_DRAG * 0.6, [], 0.6);
    const heavy = predictDots(-MAX_DRAG * 0.7, MAX_DRAG * 0.6, [], 1.6);
    expect(light.length).toBe(heavy.length);
    // 同一时刻，重的那只掉得更低（y 更大）
    expect(heavy[heavy.length - 1].y).toBeGreaterThan(light[light.length - 1].y);
  });

  it("缺省重力系数就是 1，老调用点行为不变", () => {
    expect(predictDots(-MAX_DRAG * 0.5, MAX_DRAG * 0.4)).toEqual(
      predictDots(-MAX_DRAG * 0.5, MAX_DRAG * 0.4, [], 1),
    );
  });
});
