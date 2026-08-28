import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOUCH_HIT_PX } from "./solo";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("C-8 ice-fire-forest r11 矮横屏双垫并排", () => {
  it("双垫横排且 fixed 钉底,避免竖叠/舞台裁切吃掉第 2、3 排键(root×188 同验)", () => {
    expect(TOUCH_HIT_PX).toBeGreaterThanOrEqual(44);
    expect(SRC).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(SRC).toContain("flex-direction:row;align-items:flex-end;");
    expect(SRC).toContain("width:var(--iff-hit);height:var(--iff-hit)");
  });
});
