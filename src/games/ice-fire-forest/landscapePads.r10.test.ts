import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOUCH_HIT_PX } from "./solo";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("C-8 ice-fire-forest 矮横屏双垫", () => {
  it("宽且矮时双垫脱离舞台裁切(N-103 起 fixed 钉视口右下),热区仍走 44", () => {
    expect(TOUCH_HIT_PX).toBeGreaterThanOrEqual(44);
    expect(SRC).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(SRC).toContain(".iff-pads{position:fixed;right:10px;bottom:10px;");
    expect(SRC).toContain("width:var(--iff-hit);height:var(--iff-hit)");
  });
});
