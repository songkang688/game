/**
 * 1.3 手机端修复 · 「量舞台剩余高度」的接线钉(只增不减)。
 *
 * `src/engine/stageRoom.ts` 的算法有自己的单测;这里钉的是**接没接上**:
 * 四款按高度铺玩法区的游戏,布局时必须先真量 `.game-stage` 的剩余高度
 * (measureStageRoom),量不到再退回各自 `innerHeight - 常数` 的老估算——
 * 老估算是给没有布局引擎的测试桩兜底的,不许被顺手删掉,也不许量都不量就瞎猜。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string): string => readFileSync(join(__dirname, rel), "utf8");

describe("量舞台剩余高度 · 四款游戏的接线与兜底", () => {
  it("星星台球:resize 真量球桌区,tableLayout 拿到第二参", () => {
    const src = read("pool-stars/view.ts");
    expect(src).toContain('import { measureStageRoom } from "../../engine/stageRoom"');
    expect(src).toMatch(/measureStageRoom\(tableBox/);
    expect(src).toMatch(/tableLayout\(viewportWidth\(\), room \?\? undefined\)/);
  });

  it("果果合成:果盆区先真量,量不到退回 innerHeight-300 老估算", () => {
    const src = read("fruit-stack/index.ts");
    expect(src).toMatch(/measureStageRoom\(bowlRow/);
    expect(src).toMatch(/\?\?\s*Math\.max\(220,\s*\(window\.innerHeight \|\| 720\) - 300\)/);
  });

  it("碰碰车:场地先真量,量不到退回 innerHeight-320 老估算", () => {
    const src = read("bumper-cars/index.ts");
    expect(src).toMatch(/measureStageRoom\(arena/);
    expect(src).toMatch(/\?\?\s*Math\.max\(200,\s*\(window\.innerHeight \|\| 700\) - 320\)/);
  });

  it("保龄球:球道先真量,量不到退回 innerHeight-386 老估算", () => {
    const src = read("bowling-lane/index.ts");
    expect(src).toMatch(/measureStageRoom\(laneBox/);
    expect(src).toMatch(/\?\?\s*\(window\.innerHeight \|\| 700\) - 386/);
  });
});
