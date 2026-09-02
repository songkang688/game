import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-10 weiqi-garden 矮横屏再收棋盘", () => {
  it("矮屏棋盘滚动口有上限，工具行钉底", () => {
    expect(SRC).toContain("@media (min-width:700px) and (max-height:500px)");
    expect(SRC).toContain(".wq-scroll{max-height:min(260px, calc(100dvh - 168px));}");
    expect(SRC).toContain(".wq-tools{position:sticky;bottom:0");
    expect(SRC).toContain("const chrome = short ? 168 : 220");
  });
});
