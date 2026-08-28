/**
 * C-6 残留(trio-r8 合并终态)· 推理关矮横屏专属档。
 *
 * r13/r14 的先合版把 D-pad+暂停用 sticky 钉进了屏,但右栏在 overflow:hidden 的
 * wrap 里还欠 327px:工具行(缩放/望远镜)402..498、提示 672 线下,用户滚也滚不到
 * (望远镜是玩法道具,丢了算功能缺失)。修法只动 as-deduce 标记档:右栏放宽 300px 起、
 * D-pad 压成一行、工具行横滑、线索盒收矮内滚、画布显式跨满右栏四行;
 * find 关/竖屏/平板零变化,先合版的 sticky/钳高断言一行不删。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("C-6 残留 · as-deduce 矮横屏专属档", () => {
  it("推理关右栏放宽到 300px 起(五键一行 246px 得装下)", () => {
    expect(SRC).toContain(".as-wrap.as-deduce{grid-template-columns:minmax(0,1fr) minmax(300px,48%);}");
  });

  it("画布显式跨满右栏四行(1/-1 在隐式网格里只占第 1 行,会把工具顶到线下)", () => {
    expect(SRC).toContain(".as-wrap.as-deduce>.as-canvas{grid-row:1/span 4;}");
  });

  it("工具行不换行可横滑、线索盒收矮、D-pad 压成一行", () => {
    expect(SRC).toContain(".as-wrap.as-deduce>.als-tools{flex-wrap:nowrap;overflow-x:auto");
    expect(SRC).toContain(".as-wrap.as-deduce>.as-clues{max-height:52px;}");
    expect(SRC).toContain(".as-wrap.as-deduce .as-pad{display:flex;flex-wrap:wrap");
  });

  it("先合版的底座没被动:overflow hidden + pads sticky + as-deduce 标记还在", () => {
    expect(SRC).toContain("height:100%;max-height:100%;min-height:0;overflow:hidden;");
    expect(SRC).toContain(".as-wrap>.as-pads{grid-column:2;position:sticky;bottom:0");
    expect(SRC).toContain('wrap.classList.add("as-deduce")');
  });
});
