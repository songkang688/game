import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAP_H, MAP_W } from "./levels";
import { TOUCH_MIN, TOUCH_MIN_TWO } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-53 tank-battle 双人对战矮横屏双垫", () => {
  it("只对 .tkb-pads-two 走右栏，暂停/回选关热区 44，单人选择器不扩大", () => {
    expect(TOUCH_MIN).toBeGreaterThanOrEqual(44);
    expect(TOUCH_MIN_TWO).toBeGreaterThanOrEqual(44);
    expect(SRC).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(SRC).toContain(".tkb-choose");
    expect(SRC).toContain(".tkb-mode:has(.tkb-pads-two) > .tkb-choose");
    expect(SRC).toMatch(/\.tkb-act\{[^}]*min-height:44px/);
    expect(SRC).toMatch(/\.tkb-back\{[^}]*min-height:44px/);
  });

  it("关卡表宽高零触碰", () => {
    expect(MAP_W).toBeGreaterThan(8);
    expect(MAP_H).toBeGreaterThan(8);
  });
});
