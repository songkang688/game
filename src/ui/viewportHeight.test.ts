import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { syncVisualViewportHeight } from "./viewportHeight";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const MAIN = readFileSync(new URL("../main.ts", import.meta.url), "utf8");
const L99 = readFileSync(new URL("../games/level99.ts", import.meta.url), "utf8");

describe("壳层 visualViewport / 安全区", () => {
  it("游戏页仍声明 100dvh，并用 --vv-h / 100svh 封顶", () => {
    expect(CSS).toMatch(/\.game-screen \{[^}]*height: 100dvh/);
    expect(CSS).toContain("height: var(--vv-h, 100dvh)");
    expect(CSS).toContain("max-height: var(--vv-h, 100svh)");
    expect(L99).not.toMatch(/\.l99-wrap\{max-height:calc\(100dvh - 136px\)\}/);
    expect(L99).toContain("scrollAdjustToRevealCta");
  });

  it("继续/返回躲开刘海与底部手势条", () => {
    expect(CSS).toContain("padding-bottom: max(14px, env(safe-area-inset-bottom, 0px))");
    expect(CSS).toContain("padding-left: max(clamp(14px, 4vw, 32px), env(safe-area-inset-left, 0px))");
    expect(CSS).toContain("padding-right: max(clamp(14px, 4vw, 32px), env(safe-area-inset-right, 0px))");
    expect(CSS).toMatch(/@media \(max-height: 560px\)[\s\S]*?padding-bottom: max\(8px, env\(safe-area-inset-bottom, 0px\)\)/);
    expect(L99).toMatch(/\.l99-continue\{[^}]*min-height:44px/);
    expect(L99).toMatch(/\.l99-back\{[^}]*min-height:44px/);
  });

  it("syncVisualViewportHeight 写入 --vv-h", () => {
    const styles: Record<string, string> = {};
    const el = { style: { setProperty: (k: string, v: string) => { styles[k] = v; } } };
    const g = globalThis as { visualViewport?: { height?: number } };
    const prev = g.visualViewport;
    g.visualViewport = { height: 701 };
    syncVisualViewportHeight(el as unknown as HTMLElement);
    expect(styles["--vv-h"]).toBe("701px");
    g.visualViewport = prev;
  });

  it("main 绑定 visualViewport", () => {
    expect(MAIN).toContain("bindVisualViewportHeight");
  });
});
