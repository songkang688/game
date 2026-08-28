/**
 * N-100：进图聚焦的滚动钳位。
 * 章节 tab 折多行的款（word-garden / ice-fire-forest / xiangqi / landlord-cards / bumper-cars、
 * root×pinyin-train）在 915×412 进场时，block:center 会把 .l99-view 卷到 300+，
 * 「开始冒险 ▶」与 root 直达行整段飞出视口顶。scrollIntoView 照旧（N-39/N-63 字面量不动），
 * 卷过最小需要量时钳回「格子贴滚动盒底边再留 8px」。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapEntryScrollCap } from "./level99";

const SRC = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

describe("N-100 进图聚焦滚动钳位", () => {
  it("word-garden 尺子:格子 396~472、盒高 340,center 卷 230,钳回贴底的 140", () => {
    expect(mapEntryScrollCap(472, 340)).toBe(140);
    expect(mapEntryScrollCap(472, 340)).toBeLessThan(230);
  });

  it("格子本来就在首屏(bottom ≤ 盒高)时 cap=0,一个像素都不滚", () => {
    expect(mapEntryScrollCap(242, 340)).toBe(0);
    expect(mapEntryScrollCap(332, 340)).toBe(0);
  });

  it("量不出数(单测桩)返回 0,绝不把 NaN 写进 scrollTop", () => {
    expect(mapEntryScrollCap(Number.NaN, 340)).toBe(0);
    expect(mapEntryScrollCap(472, Number.NaN)).toBe(0);
    expect(mapEntryScrollCap(472, 0)).toBe(0);
  });

  it("源码:scrollIntoView(center) 保留,钳位跟在它后面", () => {
    expect(SRC).toContain('cur.scrollIntoView?.({ block: "center" })');
    expect(SRC).toContain("mapEntryScrollCap(nr.bottom - vr.top + scroll0, vr.height)");
    expect(SRC).toContain('if (typeof view.scrollTop === "number" && view.scrollTop > cap) view.scrollTop = cap;');
  });

  it("头两行包进 .l99-mapbar,矮横屏钉在滚动盒顶(CTA/直达行怎么滚都在)", () => {
    expect(SRC).toContain('bar.className = "l99-mapbar"');
    expect(SRC).toContain("bar.appendChild(head)");
    expect(SRC).toContain("bar.appendChild(tools)");
    const start = SRC.indexOf("@media (max-height:500px){");
    const block = SRC.slice(start, SRC.indexOf("@media", start + 10));
    expect(block).toContain(".l99-mapbar{position:sticky;top:0;");
    expect(block).toContain(".l99-mapbar .l99-tools{flex-wrap:nowrap;");
    // 基础档 .l99-mapbar 不写任何规则:竖屏/平板布局一个像素不变
    expect(SRC).not.toMatch(/\n\.l99-mapbar\{/);
  });
});
