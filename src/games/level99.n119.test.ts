/**
 * N-119：选关地图观感（章节高光 / 三星金边 / 页签加厚），纯 CSS，不改 DOM 语义。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./level99.ts", import.meta.url), "utf8");

describe("N-119 地图观感 CSS", () => {
  it("N-117 徽章收纳与 lockmark 不回退", () => {
    expect(SRC).toContain("l99-tab-lockmark");
    expect(SRC).toMatch(/\.l99-tab:not\(\.l99-tab-on\)\{width:36px/);
    expect(SRC).not.toMatch(/\.l99-tabs\{[^}]*overflow-x:\s*auto/);
  });

  it("当前页签加厚投影", () => {
    expect(SRC).toMatch(/\.l99-tab\.l99-tab-on\{[^}]*box-shadow:0 4px 0/);
  });

  it("可玩节点叠高光；三星 :has 金边", () => {
    expect(SRC).toContain(".l99-node:not(.l99-node-lock):not(.l99-node-skip){");
    expect(SRC).toContain("inset 0 10px 14px");
    expect(SRC).toContain(":has(.l99-star:nth-child(3).l99-star-on)");
    expect(SRC).toContain("0 0 0 3px #F2C14A");
  });

  it("不改星行 HTML 与 aria", () => {
    expect(SRC).toMatch(/function nodeAriaLabel/);
    expect(SRC).toMatch(/class="l99-star\$\{i < stars \? " l99-star-on" : ""\}"/);
  });
});
