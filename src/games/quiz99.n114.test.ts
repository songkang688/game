import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./quiz99.ts", import.meta.url), "utf8");

describe("N-114 quiz99 500 档也钉选项行", () => {
  it("max-height:500px 档 .qz-choices sticky,501–840 原文仍在", () => {
    const start = SRC.indexOf("@media (max-height: 500px)");
    const mid = SRC.indexOf("@media (max-height: 840px) and (min-height: 501px)");
    const short = SRC.slice(start, mid);
    expect(short).toContain(".qz-choices { gap: 8px; position: sticky; bottom: 0; z-index: 3;");
    expect(SRC).toContain("@media (max-height: 840px) and (min-height: 501px)");
    expect(SRC).toContain(".qz-choice { min-height: 46px; font-size: 22px; padding: 4px 12px; }");
  });
});
