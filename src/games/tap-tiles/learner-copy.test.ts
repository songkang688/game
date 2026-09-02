/**
 * 窗口3 · 1.3 第 1 轮学习优化员 · 文案快照。
 * 把「长按白环」与「金六芒星 / 白四芒星两档爆点」讲进了攻略,钉住不被回退,
 * 同时钉住攻略结构(八章、末章到 188)没有被文案改动碰坏。
 */
import { describe, expect, it } from "vitest";
import guide from "./guide";

describe("音符下落 · 学习优化员文案快照", () => {
  it("攻略把 1.3 的判定爆点形状与长按白环讲给玩家(逐字快照)", () => {
    expect(guide.general.join("")).toContain(
      "爆点的形状会告诉你打得多准:金色六芒星是完美,白色四芒星是良好。练的时候多看一眼爆点,总出四芒星就把落手时机再磨一磨。"
    );
    expect(guide.general.join("")).toContain("长按块的中心画着一圈白环");
  });

  it("文案改动没有碰坏攻略结构:八章首尾相接铺满 188 关", () => {
    expect(guide.entries).toHaveLength(8);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
  });

  // 第 2 轮:把 visual-r1 加的上半屏漂浮符号饰层「是布景不是音符」讲清楚
  // 第 3 轮终查:饰层符号枚举补上「三角」——drawDriftSymbols 循环画的是
  // LANE_SYMBOLS 全部四种(圆/菱[方块]/三角/星),文案枚举与终态画面对齐
  it("攻略教玩家分清漂浮饰层与真音符(第 2 轮逐字快照,第 3 轮补全四种符号)", () => {
    expect(guide.general.join("")).toContain(
      "上半屏那些若隐若现、慢慢往上飘的圆点、方块、三角、星星是布景,颜色淡得几乎透明;真正要接的音符块颜色结实、带亮边和厚底,别被布景晃了眼。"
    );
    expect(guide.general.length).toBeLessThanOrEqual(6);
  });

  // 第 3 轮终查钉子:四种饰层符号(对应 LANE_SYMBOLS 四列符号)一个不少地写进了攻略
  it("饰层符号枚举覆盖全部四列符号(第 3 轮终查钉子)", () => {
    const all = guide.general.join("");
    for (const name of ["圆点", "方块", "三角", "星星"]) {
      expect(all, `饰层枚举缺了「${name}」`).toContain(name);
    }
  });
});
