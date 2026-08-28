/**
 * QA #2(ux99 wave1):iOS Safari 无视 viewport 的 user-scalable=no,
 * 连点型玩法(地鼠/点点/结算「下一关」)双击会触发页面缩放、打断操作。
 * 全局 button 补 touch-action:manipulation:保留滚动与捏合,只禁双击缩放。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("QA2 · 双击缩放防护", () => {
  it("全局 button 规则带 touch-action:manipulation", () => {
    const at = CSS.indexOf("button {");
    expect(at).toBeGreaterThanOrEqual(0);
    const rule = CSS.slice(at, CSS.indexOf("}", at));
    expect(rule).toContain("touch-action: manipulation");
  });
});
