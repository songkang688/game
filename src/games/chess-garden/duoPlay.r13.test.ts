import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DUO_SHORT_CSS } from "./view";

const IDX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const SHEET = readFileSync(fileURLToPath(new URL("../../styles.css", import.meta.url)), "utf8");

describe("N-66 chess-garden 双人末行", () => {
  it("双人矮屏收方盘并解开格 min-width,不进 styles.css", () => {
    expect(DUO_SHORT_CSS).toContain(".cg-wrap.cg-duoplay .cg-frame{width:min(240px,52dvh)");
    expect(DUO_SHORT_CSS).toContain(".cg-wrap.cg-duoplay .cg-sq{min-width:0;min-height:0;}");
    expect(DUO_SHORT_CSS).toContain("@media (max-height:500px)");
    expect(IDX).toContain("DUO_SHORT_CSS");
    expect(IDX).toContain('cfg.tier === null) return [DUO, XING]');
    expect(SHEET).not.toContain("cg-duoplay");
  });
});
