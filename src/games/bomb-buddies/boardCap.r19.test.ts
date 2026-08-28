/** N-96:bomb-buddies 矮横屏棋盘画布底出屏(915 实测 178~439,出 27px)——显示高钳制 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-96 bomb-buddies 矮横屏棋盘显示高钳制", () => {
  it("500 高档给 .bmb-board canvas 钳 max-height(带 160px 下限),盖掉内联宽高等比收", () => {
    const block = SRC.split("@media (max-height:500px) and (min-width:700px)")[1] ?? "";
    expect(block).toContain(".bmb-board canvas{width:auto!important;height:auto!important;");
    expect(block).toContain("max-height:max(160px,calc(100dvh - 182px));");
  });

  it("摇杆/动作键的三列网格布局原样保留(padl board padr)", () => {
    expect(SRC).toContain('grid-template-areas:"hud hud hud" "padl board padr" "tip tip tip";');
    expect(SRC).toContain(".bmb-padwrap:first-child{grid-area:padl;}");
    expect(SRC).toContain(".bmb-padwrap:last-child{grid-area:padr;}");
  });
});
