/**
 * N-109:root 密码门 915×412 初见「打开/不打开」在 413~459 折线下(盒内滚得到,观感账)。
 * 修法:矮横屏档只收几何(放宽列宽、收 gap、去空 tip 行),字号一个不动(16px 红线)。
 * 修后实测:915×412 CTA 行 340~384 进屏;390×844(589~635)/1024×768(551~597) 零变化。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./rootGate.ts", import.meta.url)), "utf8");

describe("N-109 密码门矮横屏收档", () => {
  it("矮横屏档在场且只动几何", () => {
    const start = SRC.indexOf("@media (max-height:500px)");
    expect(start).toBeGreaterThan(-1);
    const block = SRC.slice(start, SRC.indexOf("}", SRC.indexOf(".rootgate-btn{min-height:44px}", start)) + 1);
    expect(block).toContain(".rootgate{max-width:520px;gap:6px}");
    expect(block).not.toContain("font-size");
  });

  it("基础档字号红线未动:说明文字 16px、热区 44px 起", () => {
    expect(SRC).toContain(".rootgate-desc{margin:0;font-size:16px;");
    expect(SRC).toContain(".rootgate-dur{min-height:44px;");
  });
});
