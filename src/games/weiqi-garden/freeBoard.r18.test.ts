/**
 * r18 · N-10:915×412 实测工具行已进屏(354–398,随 r17 N-89 壳收高),但九路盘
 * 263px 装不进 244px 的滚动盒(盘顶距 170)。修法:模式屏「回闯关」行悬浮左上,
 * 棋盘行上移,滚动盒预算 168→128。700 断点与 minHitSize 一律不放宽。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("r18 weiqi-garden 矮横屏整盘进屏", () => {
  it("700 断点保留,回闯关行悬浮,滚动盒预算按实测收", () => {
    expect(SRC).toContain("@media (min-width:700px) and (max-height:500px)");
    // 旧规则原样(测试只增不减)
    expect(SRC).toContain(".wq-scroll{max-height:min(260px, calc(100dvh - 168px));}");
    expect(SRC).toContain(".wq-tools{position:sticky;bottom:0");
    // 新增覆盖
    expect(SRC).toContain(".wq-wrap>.wq-hud{position:absolute;top:0;left:0;width:auto;z-index:6;margin:0;}");
    expect(SRC).toContain(".wq-scroll{max-height:min(280px, calc(100dvh - 128px));}");
  });
});
