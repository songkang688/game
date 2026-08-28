import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-82 bubble-pop 无尽泡泡海 · 915×412", () => {
  it("矮横屏「盘左、抬头右」:12 行×44px 装不下,改盘内滚动(线钉顶、消息钉底、开局停海面)", () => {
    expect(SRC).toContain("@media (min-width:640px) and (max-height:500px)");
    expect(SRC).toContain(".bbp-mode{max-width:none;display:grid;grid-template-columns:412px 212px;");
    expect(SRC).toContain(".bbp-mode .bp-wrap{max-height:calc(100dvh - 100px);overflow-y:auto;overscroll-behavior:contain;padding:8px;}");
    expect(SRC).toContain(".bbp-mode .bbp-line{position:sticky;top:0;z-index:3;}");
    expect(SRC).toContain("panel.scrollTop = panel.scrollHeight;");
  });

  it("涨潮判定与泡径热区零触碰:pushUpRow 溢出收摊、.bp-cell 36px 下限原句都在", () => {
    expect(SRC).toContain("const result = pushUpRow(next, COLS, seaColors(pushes), Math.random, seaFrozen(pushes));");
    expect(SRC).toContain("if (result.overflow) {");
    expect(SRC).toMatch(/\.bp-cell \{[^}]*min-width: 36px/);
  });
});
