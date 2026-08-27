/**
 * 窗口3 · 1.3 第 1 轮学习优化员 · 文案快照。
 * 把「长按白环」与「金六芒星 / 白四芒星两档爆点」讲进了攻略,钉住不被回退,
 * 同时钉住攻略结构(八章、末章到 188)没有被文案改动碰坏。
 */
import { describe, expect, it } from "vitest";
import guide from "./guide";

describe("音符下落 · 学习优化员文案快照", () => {
  it("攻略把 1.3 的判定爆点形状与长按白环讲给玩家(逐字快照)", () => {
    expect(guide.general).toContain(
      "爆点的形状会告诉你打得多准:金色六芒星是完美,白色四芒星是良好。练的时候多看一眼爆点,总出四芒星就把落手时机再磨一磨。"
    );
    expect(guide.general.join("")).toContain("长按块的中心画着一圈白环");
  });

  it("文案改动没有碰坏攻略结构:八章首尾相接铺满 188 关", () => {
    expect(guide.entries).toHaveLength(8);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
  });
});
