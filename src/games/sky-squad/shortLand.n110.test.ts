import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-110 sky-squad 矮横屏键排钉底", () => {
  it("500×640 档把 .sks-pads fixed 钉视口底,U-19 501–840 sticky 原文仍在", () => {
    expect(SRC).toContain("@media (max-height:840px) and (min-height:501px)");
    expect(SRC).toContain("@media (max-height:500px) and (min-width:640px)");
    const short = SRC.slice(
      SRC.indexOf("@media (max-height:500px) and (min-width:640px)"),
      SRC.indexOf("@media (prefers-reduced-motion:reduce)"),
    );
    expect(short).toContain(".sks-pads{position:fixed;left:10px;right:10px;bottom:4px;z-index:25;");
    expect(short).toContain(".sks-wrap{padding-bottom:56px;}");
  });

  it("不回退热区 44 与 canvasBoxHeight", () => {
    expect(SRC).toContain(".sks-key{width:var(--k);height:var(--k);flex:none;min-width:44px;min-height:44px;}");
    expect(SRC).toContain("canvasBoxHeight");
  });
});
