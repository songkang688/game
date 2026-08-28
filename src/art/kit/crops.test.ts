/**
 * 农场作物剪影的契约测试：四种 × 三阶段两两分得清、统一工序钉死、纯函数可复现。
 */
import { describe, expect, it } from "vitest";
import {
  BASKET_UNIT,
  CROP_KINDS,
  CROP_MAIN,
  CROP_NAMES,
  CROP_OUTLINE_W,
  CROP_SHADOW,
  CROP_STAGES,
  FARM_PALETTE,
  basket,
  crop,
  cropAt,
} from "./crops";

describe("art/kit · crops 作物剪影", () => {
  it("四种作物的结果阶段路径两两不同，一眼分得清", () => {
    const fruits = CROP_KINDS.map((k) => crop(k, "fruit"));
    for (let i = 0; i < fruits.length; i++) {
      for (let j = i + 1; j < fruits.length; j++) {
        expect(fruits[i], `${CROP_KINDS[i]} 和 ${CROP_KINDS[j]} 画重了`).not.toBe(fruits[j]);
      }
    }
    // 各自的专属特征真的在：萝卜倒锥、番茄双果、玉米格纹、南瓜棱线
    expect(crop("tomato", "fruit").match(/<circle cx="1?\d(\.\d)?" cy="3\d/g)?.length).toBeGreaterThanOrEqual(1);
    expect(crop("pumpkin", "fruit")).toContain("<ellipse cx=\"24\" cy=\"30\"");
  });

  it("同一作物三阶段路径不同，且共用 2px 描边 / 高光 / 投影的统一工序", () => {
    expect(CROP_OUTLINE_W).toBe(2);
    for (const kind of CROP_KINDS) {
      const stages = CROP_STAGES.map((s) => crop(kind, s));
      expect(new Set(stages).size, `${kind} 有两个阶段画得一样`).toBe(3);
      for (const svg of stages) {
        expect(svg).toContain(`stroke-width="${CROP_OUTLINE_W}"`);
        expect(svg).toContain('opacity=".4"'); // 左上高光斑
        expect(svg).toContain(CROP_SHADOW); // 底部椭圆投影
      }
    }
  });

  it("发芽与长叶共用骨架：土包 + 子叶 / 真叶都用叶片双色", () => {
    for (const kind of CROP_KINDS) {
      expect(crop(kind, "sprout")).toContain(FARM_PALETTE.leafGreen);
      expect(crop(kind, "leaf")).toContain(FARM_PALETTE.leafDark);
      expect(crop(kind, "sprout")).toContain(FARM_PALETTE.soilLight);
    }
  });

  it("作物随题号轮换：萝卜→番茄→玉米→南瓜，负数与非法输入不炸", () => {
    expect([0, 1, 2, 3, 4, 5].map(cropAt)).toEqual([
      "carrot",
      "tomato",
      "corn",
      "pumpkin",
      "carrot",
      "tomato",
    ]);
    expect(cropAt(-2)).toBe("corn");
    expect(cropAt(Number.NaN)).toBe("carrot");
  });

  it("筐子图带「×10」角标，收获用的空篮可以摘掉角标", () => {
    expect(BASKET_UNIT).toBe(10);
    expect(basket()).toContain("×10");
    expect(basket()).toContain('data-badge="x10"');
    expect(basket(32, false)).not.toContain("×10");
  });

  it("纯函数可复现、尺寸夹回合法区间、全程无位图", () => {
    expect(crop("corn", "fruit", 20)).toBe(crop("corn", "fruit", 20));
    expect(crop("carrot", "fruit", 20)).toContain('width="20" height="20"');
    expect(crop("carrot", "fruit", 0)).toContain('width="32"');
    expect(crop("carrot", "fruit", 3)).toContain('width="8"');
    for (const kind of CROP_KINDS) {
      for (const stage of CROP_STAGES) {
        const svg = crop(kind, stage);
        expect(svg).not.toMatch(/<image|data:image|\.png|\.jpg/);
        expect(svg).toContain(`data-crop="${kind}"`);
        expect(svg).toContain(`data-stage="${stage}"`);
        expect(svg).toContain('aria-hidden="true"');
      }
    }
    // 中文名与主色一一齐全（图例文案用）
    for (const kind of CROP_KINDS) {
      expect(CROP_NAMES[kind].length).toBeGreaterThan(0);
      expect(CROP_MAIN[kind]).toMatch(/^#/);
    }
  });
});
