/**
 * N-47 残留：开关态模式菜单芯片（bowling / 王子公主 / 坦克）min-height 34/37/38 → 44。
 * 只钉菜单层选择器，不碰关内判定。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

function minHeightOf(css: string, selector: string): number {
  const re = new RegExp(`${selector.replace(".", "\\.")}\\{[^}]*min-height:(\\d+)px`);
  const m = re.exec(css);
  expect(m, `${selector} 应写 min-height`).not.toBeNull();
  return Number(m![1]);
}

describe("N-47 模式菜单芯片 ≥44", () => {
  it("bowling-lane .bl-open / .bl-pick", () => {
    const css = src("./bowling-lane/index.ts");
    expect(minHeightOf(css, ".bl-open")).toBeGreaterThanOrEqual(44);
    expect(minHeightOf(css, ".bl-pick")).toBeGreaterThanOrEqual(44);
  });

  it("prince-princess .pcp-mode", () => {
    expect(minHeightOf(src("./prince-princess/index.ts"), ".pcp-mode")).toBeGreaterThanOrEqual(44);
  });

  it("tank-battle .tkb-open", () => {
    expect(minHeightOf(src("./tank-battle/index.ts"), ".tkb-open")).toBeGreaterThanOrEqual(44);
  });
});
