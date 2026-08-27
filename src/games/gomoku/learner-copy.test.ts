/**
 * 窗口3 · 1.3 第 1 轮学习优化员 · 文案快照。
 * 把「小红漆印 = 最后一手」讲进了攻略,钉住这句不被回退,
 * 同时钉住攻略结构(九段、末段到 188)没有被文案改动碰坏。
 */
import { describe, expect, it } from "vitest";
import guide from "./guide";

describe("五子棋 · 学习优化员文案快照", () => {
  it("攻略把 1.3 的漆印红点讲给玩家(逐字快照)", () => {
    expect(guide.general).toContain(
      "棋盘上带小红漆印的那颗就是刚下的最后一手。轮到你先找红点,从那颗子出发把横、竖、两条斜线都数一遍,再决定应手。"
    );
  });

  it("文案改动没有碰坏攻略结构:九段首尾相接铺满 188 关", () => {
    expect(guide.entries).toHaveLength(9);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
  });
});
