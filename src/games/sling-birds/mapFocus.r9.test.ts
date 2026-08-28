/** 三人组 r9 · N-23 sling-birds 地图 focusCurrent */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-23 sling-birds 当前关定位", () => {
  it("渲染后 .slb-next 做 scrollIntoView center", () => {
    expect(src).toContain('gridEl.querySelector(".slb-next")');
    expect(src).toContain("scrollIntoView({ block: \"center\" })");
  });
});
