import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-75 mahjong-bloom 对局手牌 · 915×412", () => {
  it("矮横屏紧凑桌:双人手牌 514/616 → 270/324,对战一桌 514 → 311,牌河限高可滚", () => {
    expect(SRC).toContain(".mj-board{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);");
    expect(SRC).toContain(".mj-board>div:not([class])>.mj-hand{flex:1 1 auto;min-width:0;flex-wrap:nowrap;overflow-x:auto;}");
    expect(SRC).toContain(".mj-river{min-height:36px;max-height:64px;overflow-y:auto;padding:4px;}");
  });

  it("N-41 牌宽零触碰(仍 44 min),发牌/番种不动", () => {
    expect(SRC).toContain(".mj-tile{flex:0 0 auto;min-width:44px;min-height:44px;width:44px;height:46px;");
    expect(SRC).toContain(".mj-tile{height:44px;}");
  });
});
