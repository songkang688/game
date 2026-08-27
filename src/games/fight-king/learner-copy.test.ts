/**
 * 窗口3 · 1.3 第 1 轮学习优化员 · 文案快照。
 * 把「火花三档 = 命中反馈语言」讲进了第一章攻略,钉住不被回退,
 * 同时钉住 general 条数(≤ 6 的水位)与攻略结构没有被文案改动碰坏。
 */
import { describe, expect, it } from "vitest";
import guide from "./guide";

describe("朵星格斗王 · 学习优化员文案快照", () => {
  it("第一章攻略把 1.3 的火花三档讲给玩家(逐字快照)", () => {
    expect(guide.entries[0].tips).toContain(
      "火花会告诉你这一下打没打实:轻击命中是四根短线,重击命中是八根线加一颗金星爆点;要是溅开六片蓝色小盾片,那是把对方打到破防了 —— 练连段时多看一眼火花。"
    );
  });

  it("文案改动没有碰坏结构:general 仍是 6 条,八章铺满 188 关", () => {
    expect(guide.general).toHaveLength(6);
    expect(guide.entries).toHaveLength(8);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
  });
});
