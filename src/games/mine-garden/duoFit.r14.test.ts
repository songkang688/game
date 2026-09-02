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

  it("U-21 中高视口也按余高钳格", () => {
    expect(SRC).toContain("vh > 500 && vh <= 840");
  });

  it("840 档钉工具行,不盲拷 500 档收消息高", () => {
    expect(SRC).toContain("@media (max-height:840px) and (min-height:501px)");
    const at = SRC.indexOf("@media (max-height:840px) and (min-height:501px){");
    const block = SRC.slice(at, SRC.indexOf("@media (prefers-reduced-motion", at));
    expect(block).toContain(".mn-tools{position:sticky;bottom:0");
    expect(block).not.toContain(".mn-msg{min-height:0");
  });
});
