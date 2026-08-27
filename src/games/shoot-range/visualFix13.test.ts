/**
 * shoot-range · 1.3 窗口 5 第 1 轮监督修复员 · 修复配套用例。
 *
 * 低优装饰件(learner 第二节建议):天幕与中景横梁之间的空档补一条
 * 奖品架剪影(搁板 + 小熊 / 长耳兔 / 大星星 / 圆鸭四件玩偶轮廓),
 * 单色 2 阶(底色 + 暗 15%)压灰不抢靶;纯静态件,reduced 无关;
 * 靶、判定、图层序其余各层一个数不动。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeCtx } from "./domStub";
import { drawPrizeRack } from "./paint13";
import { BEAM_Y, BUNTING_Y, PRIZE_SHELF_Y, SHR_PRIZE } from "./visual13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");
const ctx2d = (): CanvasRenderingContext2D => new FakeCtx() as unknown as CanvasRenderingContext2D;

describe("shoot-range · 修复员装饰件 · 中景奖品架剪影", () => {
  it("奖品架画得动不抛:360 窄屏与常规宽都不炸", () => {
    for (const w of [320, 360, 520, 900]) {
      expect(() => drawPrizeRack(ctx2d(), w), `w=${w}`).not.toThrow();
    }
  });

  it("搁板顶边落在彩旗串与中景横梁之间(填空档,不压任何一层)", () => {
    expect(PRIZE_SHELF_Y).toBeGreaterThan(BUNTING_Y);
    expect(PRIZE_SHELF_Y).toBeLessThan(BEAM_Y);
  });

  it("剪影单色合法(2 阶由 shade(-15) 派生,不引入第三色)", () => {
    expect(SHR_PRIZE).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("index.ts 图层序:奖品架插在彩旗串之后、横梁之前", () => {
    const src = read("index.ts");
    const bunting = src.indexOf("drawBunting(ctx");
    const rack = src.indexOf("drawPrizeRack(ctx");
    const beam = src.indexOf("drawBeam(ctx");
    expect(rack).toBeGreaterThan(bunting);
    expect(rack).toBeLessThan(beam);
  });
});
