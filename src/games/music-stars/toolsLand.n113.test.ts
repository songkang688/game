import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MST_CSS } from "./ui";

describe("N-113 music-stars 听音壳工具排钉底", () => {
  it("500×640 档给非视奏壳 .mst-tools fixed,N-73 视奏原文仍在且不含 .mst-chip", () => {
    expect(MST_CSS).toContain(".mst-wrap.mst-scoreplay .mst-keys{position:sticky;bottom:0");
    expect(MST_CSS).toContain(
      ".mst-wrap:not(.mst-scoreplay) .mst-tools{position:fixed;left:10px;right:10px;bottom:4px;z-index:25;",
    );
    const at = MST_CSS.indexOf("@media (max-height:500px) and (min-width:640px)");
    const block = MST_CSS.slice(at, MST_CSS.indexOf("@media", at + 10));
    expect(block).toContain(".mst-wrap:not(.mst-scoreplay) .mst-tools{position:fixed;");
    expect(block).not.toContain(".mst-chip");
  });
});
