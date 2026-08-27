/**
 * 1.2 第 12 步 A 档新增:世界步进(固定步长 / 连锁倒塌 / 技能窗口)。
 * 这里跑的就是 index.ts 线上用的那套物理。
 */
import { describe, expect, it } from "vitest";
import { SKILL_ARM_TIME, SKILL_WINDOW_END, canTriggerSkill } from "./birds";
import { LEVELS, type BlockDef } from "./levels";
import { MAT } from "./materials";
import { GROUND_Y, SLING_X, SLING_Y } from "./physics";
import {
  FIXED_STEP,
  advance,
  beansAlive,
  cloneWorld,
  createWorld,
  launchBird,
  makeBird,
  stepWorld,
  triggerSkill,
  worldCalm,
  type World
} from "./world";

function shoot(w: World, kind: Parameters<typeof makeBird>[0], vx: number, vy: number) {
  const bird = makeBird(kind);
  bird.x = SLING_X;
  bird.y = SLING_Y;
  launchBird(w, bird, vx, vy);
  return bird;
}

function runFrames(w: World, fps: number, seconds: number): void {
  const dt = 1 / fps;
  for (let i = 0; i < Math.round(fps * seconds); i++) advance(w, dt);
}

describe("sling-birds 1.2 固定步长:不同帧率同一条弹道", () => {
  it("60fps 与 30fps 飞 1 秒,落点完全一致", () => {
    const a = createWorld({ blocks: [], beans: [] });
    const birdA = shoot(a, "straight", 320, -280);
    runFrames(a, 60, 1);
    const b = createWorld({ blocks: [], beans: [] });
    const birdB = shoot(b, "straight", 320, -280);
    runFrames(b, 30, 1);
    expect(birdA.x).toBeCloseTo(birdB.x, 9);
    expect(birdA.y).toBeCloseTo(birdB.y, 9);
    expect(a.steps).toBe(b.steps);
  });

  it("120fps 与 60fps 打同一关,方块最终位置也一致", () => {
    const level = LEVELS.find((l) => l.id === 2)!;
    const fast = createWorld(level);
    shoot(fast, "straight", 420, -190);
    runFrames(fast, 120, 2.5);
    const slow = createWorld(level);
    shoot(slow, "straight", 420, -190);
    runFrames(slow, 60, 2.5);
    fast.blocks.forEach((bl, i) => {
      expect(bl.x).toBeCloseTo(slow.blocks[i].x, 6);
      expect(bl.y).toBeCloseTo(slow.blocks[i].y, 6);
      expect(bl.dead).toBe(slow.blocks[i].dead);
    });
  });

  it("一帧走过的子步数就是 dt / (1/180)", () => {
    const w = createWorld({ blocks: [], beans: [] });
    advance(w, 1 / 60);
    expect(w.steps).toBe(3);
    advance(w, 1 / 60);
    expect(w.steps).toBe(6);
    expect(w.simT).toBeCloseTo(6 * FIXED_STEP, 9);
  });

  it("dt 非法(0 / 负数)时世界不动", () => {
    const w = createWorld({ blocks: [], beans: [] });
    advance(w, 0);
    advance(w, -1);
    expect(w.steps).toBe(0);
    expect(w.simT).toBe(0);
  });

  it("同一份关卡跑两遍结果一模一样(确定性,世界里没有 Math.random)", () => {
    const level = LEVELS.find((l) => l.id === 30)!;
    const run = () => {
      const w = createWorld(level);
      shoot(w, "straight", 400, -240);
      runFrames(w, 60, 3);
      return w.blocks.map((b) => `${b.x.toFixed(6)},${b.y.toFixed(6)},${b.dead}`).join("|");
    };
    expect(run()).toBe(run());
  });
});

describe("sling-birds 1.2 材质与连锁倒塌", () => {
  const stack = (kinds: BlockDef["kind"][], x: number, gapAbove: number): BlockDef[] =>
    kinds.map((kind, i) => ({ kind, x, y: GROUND_Y - 26 * (i + 1) - (i === kinds.length - 1 ? gapAbove : 0), w: 26, h: 26 }));

  it("上面塌下来砸到下面:下层掉血,脆的先碎", () => {
    // 玻璃贴地,石板悬在 90px 高空,松手就砸下来
    const w = createWorld({
      blocks: [
        { kind: "glass", x: 300, y: GROUND_Y - 26, w: 26, h: 26 },
        { kind: "stone", x: 298, y: GROUND_Y - 26 - 90, w: 30, h: 20 }
      ],
      beans: []
    });
    runFrames(w, 60, 1.2);
    expect(w.blocks[0].dead).toBe(true);
    expect(w.destroyed).toBeGreaterThanOrEqual(1);
  });

  it("同样一砸,石头比木头扛得住", () => {
    const drop = (kind: BlockDef["kind"]) => {
      const w = createWorld({
        blocks: [
          { kind, x: 300, y: GROUND_Y - 26, w: 26, h: 26 },
          { kind: "stone", x: 298, y: GROUND_Y - 26 - 70, w: 30, h: 20 }
        ],
        beans: []
      });
      runFrames(w, 60, 1.2);
      const bl = w.blocks[0];
      return bl.dead ? 0 : bl.hp / bl.maxHp;
    };
    expect(drop("stone")).toBeGreaterThan(drop("wood"));
  });

  it("抽掉承重柱,上层整片塌下来(塔顶方块最终落到地面附近)", () => {
    const blocks: BlockDef[] = [
      { kind: "wood", x: 300, y: GROUND_Y - 60, w: 12, h: 60 },
      { kind: "wood", x: 360, y: GROUND_Y - 60, w: 12, h: 60 },
      { kind: "wood", x: 296, y: GROUND_Y - 72, w: 80, h: 12 },
      { kind: "ice", x: 320, y: GROUND_Y - 98, w: 26, h: 26 }
    ];
    const w = createWorld({ blocks, beans: [] });
    // 让两根柱子直接碎掉,模拟被小鸟打断
    w.blocks[0].dead = true;
    w.blocks[1].dead = true;
    const topBefore = w.blocks[3].y;
    runFrames(w, 60, 2);
    expect(w.blocks[3].y).toBeGreaterThan(topBefore + 40);
  });

  it("静止的塔不会自己散架(低于传伤门槛不掉血)", () => {
    const w = createWorld({ blocks: stack(["wood", "wood", "wood"], 300, 0), beans: [] });
    runFrames(w, 60, 2);
    for (const bl of w.blocks) {
      expect(bl.dead).toBe(false);
      expect(bl.hp).toBe(MAT[bl.kind].hp);
    }
  });

  it("岩壳块要连敲两次:第一次只露出晶核", () => {
    const w = createWorld({ blocks: [{ kind: "shell", x: 300, y: GROUND_Y - 26, w: 26, h: 26 }], beans: [] });
    const bl = w.blocks[0];
    bl.hp = 1;
    stepWorld(w, FIXED_STEP);
    shoot(w, "straight", 500, 55);
    runFrames(w, 60, 1.2);
    expect(w.blocks[0].kind === "core" || w.blocks[0].dead).toBe(true);
  });

  it("冲天炮被打碎会炸开,顺手带走旁边的豆", () => {
    const w = createWorld({
      blocks: [{ kind: "tnt", x: 300, y: GROUND_Y - 26, w: 26, h: 26 }],
      beans: [{ x: 350, y: GROUND_Y - 10 }]
    });
    shoot(w, "straight", 500, 55);
    runFrames(w, 60, 2);
    expect(w.blocks[0].dead).toBe(true);
    expect(beansAlive(w)).toBe(0);
  });
});

describe("sling-birds 1.2 能力鸟的触发窗口", () => {
  const base = { kind: "split" as const, flying: true, dead: false, skillUsed: false, age: 1 };

  it("窗口常量:起手 0.08s 保护,5.5s 后作废", () => {
    expect(SKILL_ARM_TIME).toBeGreaterThan(0);
    expect(SKILL_WINDOW_END).toBeGreaterThan(SKILL_ARM_TIME);
    expect(canTriggerSkill({ ...base, age: SKILL_ARM_TIME - 0.001 })).toBe(false);
    expect(canTriggerSkill({ ...base, age: SKILL_ARM_TIME })).toBe(true);
    expect(canTriggerSkill({ ...base, age: SKILL_WINDOW_END })).toBe(true);
    expect(canTriggerSkill({ ...base, age: SKILL_WINDOW_END + 0.001 })).toBe(false);
  });

  it("直球糯糯没有空中技能,放过技能 / 已退场的也不能再放", () => {
    expect(canTriggerSkill({ ...base, kind: "straight" })).toBe(false);
    expect(canTriggerSkill({ ...base, skillUsed: true })).toBe(false);
    expect(canTriggerSkill({ ...base, dead: true })).toBe(false);
    expect(canTriggerSkill({ ...base, flying: false })).toBe(false);
  });

  it("刚出弓那一瞬间点屏幕不算数(松手时手指还压着)", () => {
    const w = createWorld({ blocks: [], beans: [] });
    shoot(w, "split", 300, -260);
    expect(triggerSkill(w)).toBeNull();
    advance(w, 0.1);
    expect(triggerSkill(w)).not.toBeNull();
  });

  it("云云分裂成三朵小云,墩墩下砸会掉头往下、闪闪加速钻会变快", () => {
    const split = createWorld({ blocks: [], beans: [] });
    shoot(split, "split", 300, -200);
    advance(split, 0.2);
    triggerSkill(split);
    expect(split.birds.length).toBe(3);

    const slam = createWorld({ blocks: [], beans: [] });
    const s = shoot(slam, "slam", 300, -200);
    advance(slam, 0.2);
    triggerSkill(slam);
    expect(s.vy).toBeGreaterThan(300);

    const drill = createWorld({ blocks: [], beans: [] });
    const d = shoot(drill, "drill", 300, -60);
    const before = Math.hypot(d.vx, d.vy);
    advance(drill, 0.2);
    triggerSkill(drill);
    expect(Math.hypot(d.vx, d.vy)).toBeGreaterThan(before);
    expect(d.pierce).toBe(true);
  });

  it("一只小鸟只能放一次技能", () => {
    const w = createWorld({ blocks: [], beans: [] });
    shoot(w, "boomerang", 320, -220);
    advance(w, 0.2);
    expect(triggerSkill(w)).not.toBeNull();
    expect(triggerSkill(w)).toBeNull();
  });
});

describe("sling-birds 1.2 世界工具", () => {
  it("克隆出来的世界互不影响(解算器要在克隆体上试弹道)", () => {
    const level = LEVELS.find((l) => l.id === 3)!;
    const w = createWorld(level);
    const copy = cloneWorld(w);
    shoot(copy, "straight", 500, -120);
    runFrames(copy, 60, 2);
    expect(w.blocks.every((b) => !b.dead)).toBe(true);
    expect(beansAlive(w)).toBe(level.beans.length);
    expect(copy.blocks.some((b) => b.dead) || beansAlive(copy) < beansAlive(w)).toBe(true);
  });

  it("气球关克隆后,吊着的豆还是挂在自己那只气球上", () => {
    const w = createWorld({ blocks: [], beans: [], balloons: [{ x: 300, y: 100 }] });
    const copy = cloneWorld(w);
    expect(copy.balloons[0].bean.held).toBe(copy.balloons[0]);
    expect(copy.beans).toContain(copy.balloons[0].bean);
    expect(copy.balloons[0].bean).not.toBe(w.balloons[0].bean);
  });

  it("场上都停下来了才算静止", () => {
    const w = createWorld({ blocks: [{ kind: "wood", x: 300, y: 60, w: 26, h: 26 }], beans: [] });
    advance(w, 0.4);
    expect(worldCalm(w)).toBe(false);
    runFrames(w, 60, 3);
    expect(worldCalm(w)).toBe(true);
  });

  it("总目标数 = 方块 + 气球,拆一个记一个", () => {
    const w = createWorld({
      blocks: [{ kind: "glass", x: 300, y: GROUND_Y - 26, w: 26, h: 26 }],
      beans: [],
      balloons: [{ x: 420, y: 120 }]
    });
    expect(w.totalDestructible).toBe(2);
    shoot(w, "straight", 500, 55);
    runFrames(w, 60, 2);
    expect(w.destroyed).toBeGreaterThanOrEqual(1);
  });
});
