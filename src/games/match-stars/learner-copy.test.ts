/**
 * 窗口3 · 1.3 第 1 轮学习优化员 · 文案快照。
 * 把「六形轮廓 = 第二辨色通道」与「火箭腰带箭头指方向」讲进了攻略,
 * 钉住这句不被回退,同时钉住攻略结构没有被文案改动碰坏。
 */
import { describe, expect, it } from "vitest";
import guide from "./guide";

describe("星星消消乐 · 学习优化员文案快照", () => {
  it("攻略把 1.3 的星星轮廓与火箭腰带讲给玩家(逐字快照)", () => {
    expect(guide.general.join("")).toContain(
      "星星除了颜色还有轮廓:尖角星、心形、花形、圆角星、胖星、六芒星各不相同,靠形状认比靠颜色快;火箭星腰带上的箭头指哪个方向,就往哪个方向清一整排。"
    );
  });

  it("文案改动没有碰坏攻略结构:十一段首尾相接铺满 188 关", () => {
    expect(guide.entries).toHaveLength(11);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
  });

  // 第 2 轮:把 visual-r1 加的三主题剪影饰(云影/树影/星点)讲进攻略
  it("攻略把主题剪影饰当进度里程碑讲给玩家(第 2 轮逐字快照)", () => {
    expect(guide.general.join("")).toContain(
      "背景还记着你的进度:晨光章飘着两朵云影,森林章底下立着几座圆树影,星夜章亮起点点星光——背景换了一幅,就说明你又往前推进了一大段。"
    );
    expect(guide.general.length).toBeLessThanOrEqual(6);
  });
});
