import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIN_CELL } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-71 mine-garden 双人同屏末行", () => {
  it("矮横屏按余高钳格且不低于 MIN_CELL,设置页开始钮类名未改", () => {
    expect(MIN_CELL).toBe(28);
    expect(SRC).toContain("vh - 168");
    expect(SRC).toContain("@media (min-width:640px) and (max-height:500px)");
    expect(SRC).toContain(".mn-duo{flex-wrap:nowrap");
    expect(SRC).toContain("👫 双人同屏");
  });
});
