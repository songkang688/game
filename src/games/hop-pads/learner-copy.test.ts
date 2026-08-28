/**
 * 窗口3 · 1.3 第 1 轮学习优化员 · 文案快照。
 * 把「台面图案说明书」与「深度雾 = 距离尺」讲进了攻略,钉住这两句不被回退,
 * 同时钉住攻略结构(八章、末章到 188)没有被文案改动碰坏。
 */
import { describe, expect, it } from "vitest";
import guide from "./guide";

describe("跳跳台 · 学习优化员文案快照", () => {
  it("攻略把 1.3 的台面图案与深度雾讲给玩家(逐字快照)", () => {
    expect(guide.general.join("")).toContain(
      "台面的图案就是说明书:内圈素净的是稳台,画双向箭头的会左右滑,带旋纹的会越缩越小,绕弹圈的是弹簧台,布着裂纹的踩一次就塌。抬头先认图案,再决定按多久。"
    );
    expect(guide.general.join("")).toContain(
      "远处的台子罩着一层淡淡的薄雾,颜色越清楚离你越近 —— 拿不准距离时,看台子有多「清楚」也是一把尺子。"
    );
  });

  it("文案改动没有碰坏攻略结构:八章首尾相接铺满 188 关", () => {
    expect(guide.entries).toHaveLength(8);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
  });

  // 第 2 轮:把 visual-r1 补的高低错开云层(视差远景)讲进攻略
  it("攻略把远景云的视差读法讲给玩家(第 2 轮逐字快照)", () => {
    expect(guide.general.join("")).toContain(
      "天上那几团高低错开的云是一层远景,飘得比脚下的台子慢:看云一点点被甩到身后,就知道自己真的又跳远了一截。"
    );
    expect(guide.general.length).toBeLessThanOrEqual(6);
  });
});
