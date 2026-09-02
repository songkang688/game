import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const EXPLORE = readFileSync(fileURLToPath(new URL("./explore.ts", import.meta.url)), "utf8");

describe("N-30 无尽古堡矮横屏双栏（配方 G）", () => {
  it("古堡壳挂 advk-shell，横屏 D-pad 在网格右侧", () => {
    expect(SRC).toContain('wrap.className = "ak-mode advk-shell"');
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".ak-mode.advk-shell > .advk-pad2{grid-column:2;grid-row:4");
    expect(SRC).toContain(".ak-mode.advk-shell > .advk-room{grid-column:1;grid-row:4");
    expect(SRC).toContain(".ak-mode.advk-shell > .advk-tools{grid-column:1/-1;grid-row:3;}");
  });

  it("只改古堡 mountCastle，走廊引擎三态类名未混用 advk-shell", () => {
    const mounts = [...SRC.matchAll(/wrap\.className = "ak-mode[^"]*"/g)].map((m) => m[0]);
    const shells = mounts.filter((s) => s.includes("advk-shell"));
    expect(shells).toHaveLength(1);
    expect(mounts.length).toBeGreaterThan(1);
  });

  it("房间生成与钥匙判定零触碰", () => {
    expect(SRC).toContain("buildCastleRoom");
    expect(EXPLORE).toContain("export function stepMove");
    expect(EXPLORE).toContain("export function buildCastleRoom");
  });
});
