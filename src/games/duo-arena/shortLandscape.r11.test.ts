import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-52 duo-arena 矮横屏菜单开擂 + 对局并排", () => {
  it("500px 高档放开 max-width,两块半场并排,开擂与暂停钉底", () => {
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".dua-wrap{max-width:min(920px,100%);}");
    expect(SRC).toContain(".dua-game{display:grid;grid-template-columns:1fr 1fr");
    expect(SRC).toContain(".dua-start{position:sticky;bottom:0;z-index:5");
    expect(SRC).toContain(".dua-btns{position:sticky;bottom:0;z-index:4");
  });

  it("不改 match.ts 胜负与默认半场高度常量路径", () => {
    expect(SRC).toContain(".dua-court{position:relative");
    expect(SRC).toContain("height:186px");
  });
});
