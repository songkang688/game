/**
 * 窗口3 · 1.3 第 1 轮学习优化员 · 文案快照。
 * 把「罗盘印记 = 对方刚落的子」并进了第一条心得,钉住不被回退,
 * 同时钉住攻略结构(8 章 + 1 条双人自由对战)没有被文案改动碰坏。
 */
import { describe, expect, it } from "vitest";
import guide from "./guide";

describe("朵朵星星象棋 · 学习优化员文案快照", () => {
  it("攻略把 1.3 的罗盘印记讲给玩家(逐字快照)", () => {
    expect(guide.general[0]).toBe(
      "落子前先看对方上一步做了什么。大多数失误都是因为没注意到对手刚刚打开了一条线。盘上那圈淡橙色的罗盘印记就是对方刚落的子,回看局面先找它。"
    );
  });

  it("文案改动没有碰坏攻略结构:8 章残局 + 1 条双人条目", () => {
    expect(guide.entries).toHaveLength(9);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[7].to).toBe(188);
  });
});
