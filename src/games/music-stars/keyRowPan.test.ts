/**
 * 音乐小星星 · 双声部那一章，键排自己把竖向手势锁死了
 * （1.2 窗口5 · 第 3 轮 · 档B 学习优化员，`LB-13` 剩下那一半）。
 *
 * 第 2 轮 `LB-13` 让键把竖向让出来：`.mst-star{touch-action:pan-y}`、
 * 横滚那一档写成 `.mst-keys-scroll .mst-star{touch-action:pan-x pan-y}`。
 * 单排键盘那几关（L188）确实让干净了。**双声部那一章（L155）没有。**
 *
 * `touch-action` 是**沿祖先链取交集**的：键身上写着 `pan-x pan-y` 不算数，
 * 只要它头上那个 `.mst-keys-scroll` 还写着 `touch-action:pan-x`，
 * 竖向就在容器这一层被砍掉了——键说「随便划」，容器说「只许横着」，取交集是「只许横着」。
 *
 * 我自己在真机上量到的（CDP 真手指，从键身正中起手往上推 150px，连推两趟）：
 *
 * ```
 * L155  320×640  .mst-keys-scroll touch-action:pan-x  壳还能滚 51px   scrollTop 0 → 0 → 0
 *       360×640  同上                                 壳还能滚 51px   scrollTop 0 → 0 → 0
 *       320×568  同上                                 壳还能滚 123px  scrollTop 0 → 0 → 0
 * 只把容器那一条换成 pan-x pan-y（其余一个字节不动）之后，同一批手势：
 *       320×640  0 → 51 → 51      360×640  0 → 51 → 51      320×568  0 → 123 → 123
 * ```
 *
 * 键排在这一章里几乎铺满一屏，孩子的手指十有八九落在键上。
 * 让出来的只有**手势**，不是尺寸也不是发声：按下去照旧走 `pointerdown` 出声，
 * 手指真的划走时浏览器补一个 `pointercancel`，音会正常停——
 * 和第 1 轮给横向、第 2 轮给键身让路时是同一套说法。
 *
 * 只在**壳真的能竖着滚**的那一档（矮屏）让。屏够高的时候壳压根没有竖向余量，
 * 那一档里 `pan-x` 原样留着：横着划就是横着划，不会一抖就把整页带走。
 */
import { describe, expect, it } from "vitest";
import { MST_CSS, SHORT_SCREEN_PX } from "./ui";

/** 取一条 CSS 规则的声明体（可以限定在某一段里找） */
function rule(selector: string, within = MST_CSS): string {
  const at = within.indexOf(selector + "{");
  if (at < 0) return "";
  return within.slice(at + selector.length + 1, within.indexOf("}", at));
}

/** 矮屏那一档 media 块的正文（剥掉注释，免得注释里点到的选择器算数） */
function shortBlock(): string {
  const at = MST_CSS.indexOf(`@media (max-height:${SHORT_SCREEN_PX}px)`);
  expect(at, "没有矮屏分支").toBeGreaterThan(-1);
  return MST_CSS.slice(at, MST_CSS.indexOf("@media", at + 10)).replace(/\/\*[\s\S]*?\*\//g, "");
}

/** `touch-action` 沿祖先链取交集：一层不放，底下写什么都不算数 */
function allowsVerticalPan(...chain: string[]): boolean {
  return chain.every((v) => {
    const t = v.trim();
    return t === "" || t === "auto" || t === "manipulation" || t.includes("pan-y");
  });
}

describe("音乐星星 · 双声部那一章的键排也得让出竖向（LB-13 剩下那一半）", () => {
  it("**先说清判据**：touch-action 沿祖先链取交集，容器不放键就白写", () => {
    expect(allowsVerticalPan("pan-y", "pan-x pan-y"), "壳放行、键放行 → 划得动").toBe(true);
    expect(allowsVerticalPan("pan-y", "pan-x", "pan-x pan-y"), "中间那层只许横着 → 划不动").toBe(false);
    expect(allowsVerticalPan("pan-y", "auto", "pan-y")).toBe(true);
  });

  it("矮屏那一档里，从键身到壳这一条链整条放行竖向", () => {
    const block = shortBlock();
    const chain = [
      rule(".mst-wrap", block),
      // 这一条今天还写在基准里（不分屏高），是链上唯一卡住的那一层
      rule(".mst-keys-scroll", block) || rule(".mst-keys-scroll"),
      rule(".mst-keys-scroll .mst-star", block),
    ].map((decl) => /touch-action:([^;]+)/.exec(decl)?.[1] ?? "");
    expect(
      allowsVerticalPan(...chain),
      `这条链是 ${JSON.stringify(chain)}——键说「随便划」，容器说「只许横着」，取交集就是划不动`
    ).toBe(true);
  });

  it("横向那一件事一分没丢：这一行照旧横着滚得动", () => {
    // 基准那条（第 1 轮定的）原样不动
    expect(rule(".mst-keys-scroll")).toContain("overflow-x:auto");
    expect(rule(".mst-keys-scroll")).toContain("touch-action:pan-x");
    // 矮屏那一档补的那条也必须带着 pan-x，不然七声八键两端的「哆 / 高哆」又滚不回来
    expect(rule(".mst-keys-scroll", shortBlock())).toContain("pan-x");
  });

  it("屏够高的那一档原样不动：壳没有竖向余量，不该把整页手势也放出去", () => {
    const base = MST_CSS.slice(0, MST_CSS.indexOf("@media"));
    const decl = /touch-action:([^;]+)/.exec(rule(".mst-keys-scroll", base))?.[1] ?? "";
    expect(decl.trim(), "基准那一档只许横着，这是对的").toBe("pan-x");
  });

  it("让的是手势不是尺寸：热区与发声那条路一个字节没碰", () => {
    const block = shortBlock();
    expect(rule(".mst-keys-scroll", block)).not.toMatch(/min-(height|width)|font-size|display/);
    expect(MST_CSS).toContain(".mst-btn{min-height:44px");
    expect(MST_CSS).toContain(".mst-chip{min-height:");
  });
});
