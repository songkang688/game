/**
 * 窗口3 · 1.3 第 1 轮学习优化员 · 文案快照。
 * 把「卡面角标形状 = 第二辨色通道」讲进了攻略,这里钉住这句话不被回退,
 * 同时钉住攻略结构(八章首尾相接铺满 188 关)没有被文案改动碰坏。
 */
import { describe, expect, it } from "vitest";
import guide from "./guide";

describe("花色接龙 · 学习优化员文案快照", () => {
  it("攻略把 1.3 的角标形状通道讲给玩家(逐字快照)", () => {
    expect(guide.general.join("")).toContain(
      "分不清颜色也不怕:卡面角标除了颜色还配了形状 —— 粉色是圆、黄色是方、绿色是三角、蓝色是星星,顶上的颜色条也画着同一个小符号,跟着形状找就不会出错。"
    );
  });

  it("文案改动没有碰坏攻略结构:八章首尾相接铺满 188 关", () => {
    expect(guide.entries).toHaveLength(8);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
  });

  // 第 2 轮:把 visual-r1 画制的三张对手头像(兔/熊猫/狐)讲进攻略
  it("攻略教玩家按耳形认对手席头像并盯剩牌数(第 2 轮逐字快照)", () => {
    expect(guide.general.join("")).toContain(
      "对手席一眼认人:长耳朵的是团团、圆耳黑眼斑的是圆圆、尖耳朵的是点点,头像旁写着各自还剩几张——把跳过和加二招呼给剩牌最少的那位。"
    );
    expect(guide.general.length).toBeLessThanOrEqual(6);
  });
});
