/**
 * 收藏册孩子面热区(trio-r9):关闭钮 40→44、卡片按钮 min-height 36→44。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./collection.ts", import.meta.url), "utf8");

describe("收藏册热区 ≥44px", () => {
  it(".collection-close 宽高 ≥44", () => {
    const m = /\.collection-close\{[^}]*width:(\d+)px;height:(\d+)px/.exec(SRC);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
    expect(Number(m![2])).toBeGreaterThanOrEqual(44);
  });

  it(".card-btn min-height ≥44", () => {
    const m = /\.card-btn\{[^}]*min-height:(\d+)px/.exec(SRC);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
  });
});
