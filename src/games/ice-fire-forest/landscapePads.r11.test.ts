import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOUCH_HIT_PX } from "./solo";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("C-8 ice-fire-forest r11 矮横屏双垫并排", () => {
  it("右栏双垫改横排，避免竖叠超出 412 高", () => {
    expect(TOUCH_HIT_PX).toBeGreaterThanOrEqual(44);
    expect(SRC).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(SRC).toContain(".iff-pads{grid-column:2;grid-row:3;flex-direction:row");
    expect(SRC).toContain("width:var(--iff-hit);height:var(--iff-hit)");
  });
});
