import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-10 weiqi-garden 矮横屏再收棋盘", () => {
  it("矮屏棋盘滚动口有上限，工具行钉底", () => {
    expect(SRC).toContain("@media (min-width:700px) and (max-height:500px)");
    // r18 收口:168px 低估了壳+抬头,915×412 实测滚动盒底伸到 468,盒底几路够不着;
    // 按 r17 playbook「再收 .wq-scroll」重钳(见 scrollFit.r18.test.ts),上限断言同步跟上
    expect(SRC).toContain(".wq-scroll{max-height:max(96px, calc(100dvh - 240px));}");
    expect(SRC).toContain(".wq-tools{position:sticky;bottom:0");
    expect(SRC).toContain("const chrome = short ? 168 : 220");
  });
});
