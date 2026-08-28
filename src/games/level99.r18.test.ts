/**
 * trio-r18(N-92):root 开着时关内管理员行(跳过 + 🎫 直达)曾在矮横屏独占
 * stagebar 第二行,把 .l99-stage 压掉 44px —— music-stars 视奏键在 915×412 被
 * overflow:hidden 裁到只剩 16px 可见(实测 .l99-stagebar h=100 vs root 关 h=56)。
 * 修法:宽横屏(≥640px)把整条 stagebar 收成一行。这里钉住三件事:
 *  1. 单行规则只挂在 :has(.l99-jump) 下 —— root 关着布局零改动;
 *  2. 只进宽横屏分支 —— 窄竖屏仍走 N-37 的两行压缩,互不覆盖;
 *  3. N-37 的既有压缩规则原样保留(勿回退)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

describe("N-92 root 开着时关内管理员行不再独占一行(宽横屏)", () => {
  const at = SRC.indexOf("@media (max-height:500px) and (min-width:640px)");

  it("有宽横屏专属分支,且规则全部挂在 :has(.l99-jump) 下", () => {
    expect(at).toBeGreaterThan(-1);
    const block = SRC.slice(at, SRC.indexOf("}", SRC.indexOf(".l99-admin-row", at)) + 1);
    expect(block).toContain(".l99-stagebar:has(.l99-jump){flex-wrap:nowrap;}");
    expect(block).toContain(".l99-stagebar:has(.l99-jump) .l99-tools{width:auto");
    expect(block).toContain(".l99-stagebar:has(.l99-jump) .l99-admin-row{flex-wrap:nowrap;width:auto;}");
    // 每一条选择器都带 :has(.l99-jump):root 关着(无直达控件)时一个字都不生效
    const selectors = [...block.matchAll(/\.l99-stagebar[^{]*\{/g)];
    expect(selectors.length).toBeGreaterThanOrEqual(3);
    for (const s of selectors) expect(s[0]).toContain(":has(.l99-jump)");
  });

  it("标题在单行里让位:可收缩可省略,不把工具行挤出屏", () => {
    const block = SRC.slice(at);
    expect(block).toContain(".l99-stagebar:has(.l99-jump) .l99-stagetitle{min-width:0;");
    expect(block).toContain("text-overflow:ellipsis");
  });

  it("N-37 的窄横屏两行压缩没被回退", () => {
    expect(SRC).toContain(".l99-stagebar:has(.l99-jump) .l99-jump-note{display:none;}");
    expect(SRC).toContain(".l99-stage-wrap:has(.l99-jump) .pyt-scene{height:44px;}");
  });
});
