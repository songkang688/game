/**
 * 窗口 4 · 1.3 第 3 轮终验 · 测试员新增的机器化扫描。
 *
 * 报告见 docs/qa/1.3-window4-round3-tester.md。
 * 第 1 轮 window4-visual-scan.test.ts(31 例)与第 2 轮 window4-visual-scan-r2.test.ts(9 例)
 * 全部保留照跑;本文件只钉终验对账时新发现的残余:
 *
 *  W4R3-01(=W4R2-05 残余 · 一般):duo-vs-star 玩法态顶栏「◀ 返回 / ⏸ 暂停」按钮
 *  (.dvs-back)高度实测 32px(<40px 触区底线)。r2 修复 0c2c6da 只覆盖了 .dvs-pad
 *  七颗触控键(360/320 双档实测已回 40×40),.dvs-back 的 1.2 存量 padding:7px + 13.5px
 *  字号没动。
 *  → 三人组 r9(并入 N-26)补 min-height:40px + inline-flex 居中,本条断言已取反为修复态。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const GAMES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("窗口4 r3 · W4R3-01 duo-vs-star 返回/暂停键触区(W4R2-05 残余)", () => {
  it("已修:.dvs-back 补上 min-height:40px,触区回到底线(三人组 r9 · 并入 N-26 清账)", () => {
    const source = readFileSync(join(GAMES_DIR, "duo-vs-star", "index.ts"), "utf8");
    const rule = source.slice(source.indexOf(".dvs-back{"), source.indexOf(".dvs-back:active"));
    // 原文钉的是「32px 待修」态。r9 补 min-height:40px + inline-flex 居中后断言取反:
    // 360×640 / 915×412 / 1280×800 实测 .dvs-back 全部 40px,padding 与字号一个没动。
    expect(rule).toContain("padding:7px 13px");
    expect(rule).toContain("min-height:40px");
  });

  it("回归守护:r2 修复的 .dvs-pad 七键 40px 底线与 gap:4 不回退(0c2c6da)", () => {
    const source = readFileSync(join(GAMES_DIR, "duo-vs-star", "index.ts"), "utf8");
    const media = source.slice(source.indexOf("@media (max-width:380px)"));
    expect(media).toMatch(/\.dvs-pad button\{min-width:40px;min-height:40px/);
  });
});
