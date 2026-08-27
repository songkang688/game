/**
 * 涂色小屋 · 自由画室的键盘可达（窗口5 第1轮学习优化员补）。
 *
 * 测试员在档A 记了 W5-A-05：画室是 `position:absolute; z-index:9` 的一层纸，
 * 视觉上盖住了选关地图，可底下十来个控件仍然 Tab 得到——键盘 / 读屏的孩子
 * 要先走 20 站才轮到「✖ 关上画室」，中途还可能误触「开始冒险」直接跳出画室。
 *
 * 仓库的 vitest 跑在 node 环境、不引 jsdom，所以这一份分两路验：
 *  1. `muteBehind` / `isSandboxDismissKey` 是纯函数，拿极简桩逐条验行为；
 *  2. `openSandbox` 里怎么用它们，用源码巡检钉住（和本款既有的巡检用例一个路数）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isSandboxDismissKey, muteBehind, type MuteTarget } from "./sandboxUi";

const SRC = readFileSync(fileURLToPath(new URL("./sandboxUi.ts", import.meta.url)), "utf8");

/** 极简元素桩：只记着属性表 */
function stub(init: Record<string, string> = {}): MuteTarget & { attrs: Map<string, string> } {
  const attrs = new Map(Object.entries(init));
  return {
    attrs,
    getAttribute: (n) => attrs.get(n) ?? null,
    setAttribute: (n, v) => void attrs.set(n, v),
    removeAttribute: (n) => void attrs.delete(n),
  };
}

describe("涂色小屋 · 画室浮层背后的东西要让位", () => {
  it("开画室时背后每一层都挂上 inert 与 aria-hidden", () => {
    const bar = stub();
    const map = stub();
    muteBehind([bar, map]);
    for (const el of [bar, map]) {
      expect(el.getAttribute("inert")).toBe("");
      expect(el.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("关画室时原样还原：本来没有的摘掉，本来就有的按原值放回去", () => {
    const fresh = stub();
    const already = stub({ "aria-hidden": "false", inert: "" });
    const restore = muteBehind([fresh, already]);
    restore();
    expect(fresh.getAttribute("inert")).toBeNull();
    expect(fresh.getAttribute("aria-hidden")).toBeNull();
    expect(already.getAttribute("inert")).toBe("");
    expect(already.getAttribute("aria-hidden")).toBe("false");
  });

  it("一层都没有也不会炸（画室是 host 里唯一一个孩子的极端情况）", () => {
    expect(() => muteBehind([])()).not.toThrow();
  });

  it("Esc 与老浏览器的 Esc 旧名字都算关上画室，别的键一律不算", () => {
    expect(isSandboxDismissKey("Escape")).toBe(true);
    expect(isSandboxDismissKey("Esc")).toBe(true);
    for (const k of ["Enter", " ", "Tab", "escape", "a"]) {
      expect(isSandboxDismissKey(k)).toBe(false);
    }
  });
});

describe("涂色小屋 · 画室的焦点交接（源码巡检）", () => {
  it("开画室：把 host 里除画室以外的孩子交给 muteBehind", () => {
    expect(SRC).toContain("muteBehind(");
    expect(SRC).toMatch(/Array\.from\(host\.children\)\.filter\(\(el\) => el !== sheet\)/);
  });

  it("开画室：焦点直接落到「✖ 关上画室」", () => {
    expect(SRC).toContain("closeBtn.focus?.()");
  });

  it("关画室：先还原背后那几层，再把焦点还给开画室的人", () => {
    const destroy = SRC.slice(SRC.indexOf("destroy() {"));
    expect(destroy).toContain("restoreBehind()");
    expect(destroy).toContain("opener?.focus?.()");
    expect(destroy.indexOf("restoreBehind()")).toBeLessThan(destroy.indexOf("opener?.focus?.()"));
  });

  it("Esc 走的是 onClose，不是自己偷偷把 DOM 拆了", () => {
    const key = SRC.slice(SRC.indexOf('sheet.addEventListener("keydown"'));
    expect(key.slice(0, 400)).toContain("opts.onClose?.()");
    expect(key.slice(0, 400)).toContain("stopPropagation()");
  });
});
