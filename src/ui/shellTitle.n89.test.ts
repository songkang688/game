/**
 * N-89：短横屏关内顶栏收高，把 ~28px 还给舞台。
 * 禁止改 OA_SHORT_PANE_H / SR_SHORT_PANE_H；首页 S-1 芯片 44 不回退。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const STYLES = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");

function shortGameBlock(): string {
  const at = STYLES.indexOf("@media (max-height: 500px)");
  expect(at, "应有 max-height:500px").toBeGreaterThanOrEqual(0);
  const next = STYLES.indexOf("@media", at + 1);
  return STYLES.slice(at, next > 0 ? next : undefined);
}

describe("N-89 短横屏关内标题条", () => {
  it("500px 档收 .game-screen 顶栏，藏标题 emoji，标题热区仍 44", () => {
    const block = shortGameBlock();
    expect(block).toContain(".game-screen .game-topbar");
    expect(block).toContain("padding: 0");
    expect(block).toContain(".game-screen .game-title");
    expect(block).toContain("min-height: 44px");
    expect(block).toContain(".game-screen .game-title-emoji");
    expect(block).toContain("display: none");
  });

  it("S-1 首页芯片 44 不回退", () => {
    const block = shortGameBlock();
    expect(block).toMatch(/\.home-screen \.tab \{[\s\S]*min-height: 44px/);
    expect(block).toContain(".home-screen .home-search");
    expect(block).toMatch(/\.home-screen \.home-search \{[\s\S]*min-height: 44px/);
  });
});
