/** N-107:fruit-stack 双人六键矮横屏掉在 .l99-host 折线下(915 实测 522~566 OUT) */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-107 fruit-stack 矮横屏触屏键排", () => {
  it("500 高档把每座位键组 fixed 到视口两侧(sticky 在 l99-host 链失效,禁回退)", () => {
    const block = SRC.split("@media (max-height:500px)")[1] ?? "";
    expect(block).toContain(".fs-pad > .fs-pad{position:fixed;");
    expect(block).toContain(".fs-pad > .fs-pad:first-child{left:10px;right:auto;}");
    expect(block).toContain(".fs-pad > .fs-pad:last-child{left:auto;right:10px;}");
  });

  it("键组 z-index 压在 .fs-veil(z6)之下,暂停遮罩必须盖得住键", () => {
    const block = SRC.split("@media (max-height:500px)")[1] ?? "";
    const m = /\.fs-pad > \.fs-pad\{[^}]*z-index:(\d+)/.exec(block);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThan(6);
  });

  it(".fs-key 44px 触区底线不回退", () => {
    expect(SRC).toContain(".fs-key{border:none;border-radius:14px;min-width:56px;height:44px;");
  });
});
