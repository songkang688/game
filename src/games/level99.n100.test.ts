/**
 * N-100(R-1) 守门:l99 进场锚定不许把「继续 ▶/工具行」卷出 .l99-view 顶。
 * 17 款 tab 折行款 915×412 实测(r19 笔记第四节):继续键 top -154~-31。
 * 修法三件套(缺一即回退):
 *  1. 聚焦后最小滚动钳制——当前关能与头部同屏就回 0,同屏不了才保留最小滚动;
 *  2. .l99-node-cur 加 scroll-margin-block 呼吸边距;
 *  3. 矮横屏(max-height:500px)把 .l99-head 钉 .l99-view 顶,CTA 全程可见。
 * N-39/N-63 的 scrollIntoView({block:"center"}) 原文保持,只增不减。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

describe("N-100(R-1) level99 进场锚定", () => {
  it("聚焦后有最小滚动钳制(当前关贴可视底,滚不回负值)", () => {
    expect(SRC).toContain("const minTop = view.scrollTop + (curBox.bottom - visibleBottom) + 12;");
    expect(SRC).toContain("if (minTop < view.scrollTop) view.scrollTop = Math.max(0, minTop);");
  });

  it(".l99-node-cur 带 scroll-margin-block 呼吸边距", () => {
    expect(SRC).toMatch(/\.l99-node-cur\{[^}]*scroll-margin-block:12px/);
  });

  it("矮横屏 .l99-head 钉 .l99-view 顶(sticky 的滚动主正是 .l99-view,合法)", () => {
    const short = SRC.slice(SRC.indexOf("@media (max-height:500px)"));
    expect(short).toMatch(/\.l99-head\{position:sticky;top:0;z-index:3/);
  });

  it("N-39/N-63 的 center 聚焦与舞台归零原文不动(测试只增不减)", () => {
    expect(SRC).toContain('cur.scrollIntoView?.({ block: "center" })');
    expect(SRC).toContain("if (stageEl) stageEl.scrollTop = 0;");
  });
});
