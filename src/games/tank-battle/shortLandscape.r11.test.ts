import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOUCH_MIN, TOUCH_MIN_TWO } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-53 tank-battle 双人对战矮横屏", () => {
  it("暂停/回选关/芯片热区 ≥44,双垫矮屏并排钉底", () => {
    expect(TOUCH_MIN).toBeGreaterThanOrEqual(44);
    expect(TOUCH_MIN_TWO).toBeGreaterThanOrEqual(44);
    expect(SRC).toContain(".tkb-act{");
    expect(SRC).toMatch(/\.tkb-act\{[^}]*min-height:44px/);
    expect(SRC).toMatch(/\.tkb-back\{[^}]*min-height:44px/);
    expect(SRC).toMatch(/\.tkb-chip\{[^}]*min-height:44px/);
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".tkb-pads-two{flex-wrap:nowrap;position:sticky;bottom:0");
  });

  it("boardRoom 为摇杆预留 chrome,不把整段舞台余量交给画布", () => {
    expect(SRC).toContain("measured - chrome");
    expect(SRC).toContain("opts.players === 2 ? TOUCH_MIN_TWO : TOUCH_MIN");
  });
});
