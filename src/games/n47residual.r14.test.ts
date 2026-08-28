/**
 * N-47 残留(trio-r14 A):mine 地块芯片 40、古堡工具 35、回选关 33。
 * 只抬芯片/工具;N-16 只许 .ak-back 33→44,禁重写 corridorFit。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function minHeightOf(css: string, selector: string): number {
  const re = new RegExp(`${selector.replace(".", "\\.")}\\{[^}]*min-height:(\\d+)px`);
  const m = re.exec(css);
  expect(m, `${selector} 应写 min-height`).not.toBeNull();
  return Number(m![1]);
}

describe("N-47 残留芯片 ≥44", () => {
  it("mine-garden .mn-btn 40→44", () => {
    const css = readFileSync(new URL("./mine-garden/index.ts", import.meta.url), "utf8");
    expect(minHeightOf(css, ".mn-btn")).toBeGreaterThanOrEqual(44);
  });

  it("adventure-king .advk-tool / .ak-back 44,corridorFit 公式未重写", () => {
    const src = readFileSync(new URL("./adventure-king/index.ts", import.meta.url), "utf8");
    const fit = readFileSync(new URL("./adventure-king/corridorFit.ts", import.meta.url), "utf8");
    expect(minHeightOf(src, ".advk-tool")).toBeGreaterThanOrEqual(44);
    expect(minHeightOf(src, ".ak-back")).toBeGreaterThanOrEqual(44);
    expect(fit).toContain("export function corridorWantH");
    expect(fit).toContain("export function corridorCanvasCssH");
  });
});
