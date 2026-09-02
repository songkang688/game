import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-124 merge-2048 平板粗指针中间档", () => {
  it("820 粗指针抬触区并钉四向,500 档原文不动", () => {
    expect(SRC).toContain("@media (max-height:820px) and (pointer:coarse)");
    expect(SRC).toContain(".mg-open,.mg-back,.mg-btn{min-height:44px;}");
    const fiveStart = SRC.indexOf("@media (max-height:500px){");
    const fiveEnd = SRC.indexOf("@media (max-height:820px) and (pointer:coarse){");
    const five = SRC.slice(fiveStart, fiveEnd);
    expect(five).toContain(".mg-pad{position:sticky;bottom:0");
    expect(five).toContain(".mg-msg{min-height:0;max-height:1.4em");
    expect(five).not.toContain("pointer:coarse");
  });
});
