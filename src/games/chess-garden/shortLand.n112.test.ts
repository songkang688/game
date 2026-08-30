import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DUO_SHORT_CSS, SHORT_LAND_CSS } from "./view";

const IDX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const SHEET = readFileSync(fileURLToPath(new URL("../../styles.css", import.meta.url)), "utf8");

describe("N-112 chess-garden 闯关矮横屏 wrap 自滚", () => {
  it("500×640 档 wrap 可滚,不砍格宽,N-66 双人原文仍在,不进 styles.css", () => {
    expect(SHORT_LAND_CSS).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(SHORT_LAND_CSS).toContain(".cg-wrap:not(.cg-duoplay){max-height:calc(100dvh - 88px);overflow-y:auto;}");
    expect(SHORT_LAND_CSS).not.toContain("100dvh - 260px");
    expect(DUO_SHORT_CSS).toContain(".cg-wrap.cg-duoplay .cg-frame{width:min(240px,52dvh)");
    expect(IDX).toContain("SHORT_LAND_CSS");
    expect(SHEET).not.toContain("cg-wrap:not(.cg-duoplay)");
  });
});
