/**
 * 音乐小星星 · 矮屏上手指落在键上也得划得动（1.2 窗口5 · 第 2 轮 · 档B 学习优化员）。
 *
 * 第 1 轮把「壳自己能滚」这件事做出来了（`fitIntoStage` 量舞台裁切线写 `max-height`，
 * 矮屏那一档给 `.mst-wrap` 配上 `overflow-y:auto` + `touch-action:pan-y`），
 * 本轮真机复量确认它是真的在起作用：320×640 第 188 关 `.mst-wrap` 被钳到 356px、
 * 还能往下滚 159px，**滚到底之后每一颗按钮都够得着**。
 *
 * 可「滚得到」和「滚得动」是两件事。键自己还挂着 `touch-action:none`，
 * 手指落在键上就一步都划不动——这正是第 1 轮在**横**向上抓到过的那个坑
 * （`.mst-keys-scroll .mst-star` 那条注释写得很清楚：键 44px、缝 4px，
 * 手指落哪儿都在键上），只是这一次换成了竖向，而且键排几乎铺满这一屏：
 * 320×640 第 188 关能起手划的只剩星空那 104px。
 *
 * 所以矮屏那一档里让键把**竖**这一个方向让出来；七声八键那条横向滚动的键排两个
 * 方向都要，写成 `pan-x pan-y`。让的是手势，不是尺寸——热区一个都没动。
 */
import { describe, expect, it } from "vitest";
import { MST_CSS, SHORT_SCREEN_PX, SHORT_SIZES } from "./ui";

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

describe("音乐星星 · 矮屏上键让出竖向手势（本轮新发现）", () => {
  it("壳能滚：第 1 轮那两样还在", () => {
    const wrap = rule(".mst-wrap", shortBlock());
    expect(wrap).toContain("overflow-y:auto");
    expect(wrap).toContain("touch-action:pan-y");
  });

  it("键也让路：矮屏那一档里 .mst-star 从 none 变成 pan-y", () => {
    const star = rule(".mst-star", shortBlock());
    expect(star, "矮屏那一档里键还锁着手势，手指落在键上就划不动").toContain("touch-action:pan-y");
    expect(star).not.toContain("touch-action:none");
  });

  it("不矮的屏上键仍然是 touch-action:none——按下去就出声，不会一划就滚走", () => {
    expect(rule("\n.mst-star")).toContain("touch-action:none");
  });

  it("七声八键那条横滚的键排两个方向都要（只给 pan-x 会把竖向又锁回去）", () => {
    // 基准那一条管的是横向本身，第 1 轮定的，原样不动
    expect(rule(".mst-keys-scroll .mst-star")).toContain("touch-action:pan-x");
    // 矮屏那一档里它套在能竖滚的壳里，两个方向都得放
    const scrolled = rule(".mst-keys-scroll .mst-star", shortBlock());
    expect(scrolled, "横滚键排在矮屏上把竖向锁死了").toContain("pan-x");
    expect(scrolled).toContain("pan-y");
  });

  it("让的是手势不是尺寸：这一档没有把任何热区收小", () => {
    const block = shortBlock();
    // 键的边长是按 keyLayout 内联算的，本来就不在 CSS 里；这一档也不许冒出 min-height/width 来收它
    expect(rule(".mst-star", block)).not.toMatch(/min-(height|width)/);
    // 第 1 轮定的这几条护栏原样保留
    for (const sel of [".mst-btn", ".mst-chip", ".mst-choice", ".mst-drum"]) {
      expect(block, `${sel} 不该进这一档`).not.toContain(sel);
    }
    expect(MST_CSS).toContain(".mst-btn{min-height:44px");
  });

  it("能起手划的那一片有多大：星空这一档收完还有 ≥64px", () => {
    // 真机 320×640 第 188 关量到 104px。这条盯的是「就算键那条修法哪天被回滚，
    // 星空也还留着一块划得动的地方」——两道保险，不是二选一。
    expect(SHORT_SIZES.sky).toBeGreaterThanOrEqual(64);
  });
});
