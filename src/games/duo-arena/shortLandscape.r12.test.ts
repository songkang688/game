import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const MATCH = readFileSync(fileURLToPath(new URL("./match.ts", import.meta.url)), "utf8");

describe("N-52 duo-arena 矮横屏菜单开擂 + 对局分屏", () => {
  it("菜单把开擂/怎么玩收进 sticky 底栏，对局两半场并排、暂停钉底", () => {
    expect(INDEX).toContain('class="dua-setup-foot"');
    expect(INDEX).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(INDEX).toContain("position:sticky;bottom:0");
    expect(INDEX).toContain("grid-template-columns:1fr 1fr");
    expect(INDEX).toContain(".dua-btns{");
    expect(INDEX).toMatch(/dua-setup-foot[\s\S]*dua-rulesbtn[\s\S]*dua-start/);
  });

  it("match.ts 赛制零触碰", () => {
    expect(MATCH).toContain("export function createMatch");
    expect(MATCH).not.toContain("sticky");
    expect(MATCH).not.toContain("dua-setup-foot");
    expect(MATCH).not.toContain("grid-template-columns");
  });
});
