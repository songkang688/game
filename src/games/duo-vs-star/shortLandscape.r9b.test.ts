/**
 * 三人组 r9-B(d909) · N-26 续:矮横屏擂台真的排成双栏 / 三栏。
 *
 * 先合版那一版没接住 —— 915×412 六个模式实测:
 * 闯关裁 500 七键线下、双人对战裁 389 十四键线下、人机混战裁 389 七键线下、
 * 团队赛裁 526、合作特训裁 504,只有无尽车轮战干净。两个原因:
 *  1. `.dvs-pad{flex-direction:column}` 把七枚键竖着摞成 365px 一条;
 *  2. `.dvs-arena` 一变 grid,作为 `.game-stage`(flex 容器)子项的 `.dvs-wrap`
 *     按 max-content 塌到 332px,整个擂台缩到屏幕中间一条。
 *
 * 修法:单人局「画布左 + 键排右」,双人局「键排 A 左 + 画布中 + 键排 B 右」;
 * 键排照旧是会折行的横排;`.dvs-wrap` 在矮横屏补 `width:100%`;
 * 钳高改成不看滚动位置,主循环每 20 帧复量一次。
 * 判定 / 存档 key / 关卡表 / 46px 热区零触碰。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIN_CANVAS_DISPLAY_PX, canvasDisplayCapPx } from "./index";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

const HEAD = "@media (max-height:520px) and (orientation:landscape){";

function block(): string {
  const at = src.indexOf(HEAD);
  expect(at, "缺矮横屏媒体查询").toBeGreaterThan(-1);
  let depth = 0;
  for (let i = at + HEAD.length - 1; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(at + HEAD.length, i);
    }
  }
  throw new Error("矮横屏媒体查询没有闭合");
}

describe("N-26 续 · 矮横屏擂台分栏", () => {
  it("媒体查询只盯矮横屏", () => {
    const hit = (w: number, h: number): boolean => h <= 520 && w > h;
    expect(hit(915, 412)).toBe(true);
    expect(hit(390, 844)).toBe(false);
    expect(hit(412, 915)).toBe(false);
    expect(hit(1024, 768)).toBe(false);
    expect(hit(1280, 800)).toBe(false);
  });

  it("擂台一变 grid 就得给 .dvs-wrap 补 width:100%,不然按 max-content 塌成一条", () => {
    expect(block()).toContain(".dvs-wrap{width:100%;}");
    // 基线层仍是 max-width:720px 居中,竖屏与大屏不受影响
    expect(src).toContain(".dvs-wrap{max-width:720px;margin:0 auto;");
  });

  it("单人局:画布左、键排右,四块分区各就各位", () => {
    const b = block();
    expect(b).toContain('grid-template-areas:"bar bar" "canvas pads" "canvas cards" "canvas hint";');
    expect(b).toContain(".dvs-arena>.dvs-bar{grid-area:bar;");
    expect(b).toContain(".dvs-arena>.dvs-canvas{grid-area:canvas;");
    expect(b).toContain(".dvs-arena>.dvs-pads{grid-area:pads;");
    expect(b).toContain(".dvs-arena>.dvs-cards{grid-area:cards;");
    expect(b).toContain(".dvs-arena>.dvs-hint{grid-area:hint;");
  });

  it("双人局:两块键排分居画布两侧", () => {
    const b = block();
    expect(b).toContain('grid-template-areas:"bar bar bar" "padA canvas padB" "padA cards padB" "padA hint padB";');
    expect(b).toContain(".dvs-arena:has(.dvs-pad + .dvs-pad)>.dvs-pads{display:contents;}");
    expect(b).toContain(".dvs-arena:has(.dvs-pad + .dvs-pad) .dvs-pad:first-child{grid-area:padA;");
    expect(b).toContain(".dvs-arena:has(.dvs-pad + .dvs-pad) .dvs-pad:last-child{grid-area:padB;");
  });

  it("键排照旧是会折行的横排,不再竖着摞成一条", () => {
    expect(block()).not.toContain("flex-direction:column");
    expect(block()).toContain(".dvs-arena .dvs-pad{justify-content:center;gap:5px;}");
    // 折行来自基线层的 .dvs-pad{flex-wrap:wrap}
    expect(src).toContain(".dvs-pad{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}");
  });

  it("侧栏放得下键:单人栏 190 装 3 枚一行,双人栏 107 装 2 枚一行", () => {
    const key = 46;
    const gap = 5;
    expect(key * 3 + gap * 2).toBeLessThanOrEqual(190);
    expect(key * 2 + gap).toBeLessThanOrEqual(107);
    // 46px 热区是基线层写死的,矮横屏一格不改
    expect(src).toContain(".dvs-pad button{border:none;border-radius:14px;min-width:46px;min-height:46px;");
    expect(block()).not.toContain("min-width:4");
    expect(block()).not.toContain("min-height:4");
  });

  it("元气双通道保住:颜色条旁边的数字矮屏也不砍,只收行距", () => {
    expect(block()).not.toContain(".dvs-card-foot{display:none");
    expect(block()).toContain(".dvs-arena .dvs-meter{margin:3px 0 2px;}");
    expect(src).toContain(".dvs-card-foot .vg b{font-variant-numeric:tabular-nums;}");
  });

  it("矮横屏那段只碰擂台自己的类,不外溢到菜单 / 选人 / 结算浮层", () => {
    for (const line of block()
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("/*") && !s.startsWith("*"))) {
      if (!line.includes("{") || line.startsWith("grid-")) continue;
      const sel = line.slice(0, line.indexOf("{")).trim();
      if (!sel.startsWith(".")) continue;
      expect(sel.startsWith(".dvs-arena") || sel.startsWith(".dvs-wrap")).toBe(true);
    }
    expect(block()).not.toContain(".dvs-menu");
    expect(block()).not.toContain(".dvs-over");
    expect(block()).not.toContain(".dvs-mode");
  });
});

describe("N-26 续 · 钳高不看滚动位置", () => {
  it("先松钳位再读舞台,余量跟滚没滚无关", () => {
    const fit = src.slice(src.indexOf("function fitDisplay(): void {"), src.indexOf("function resize(): void {"));
    expect(fit.indexOf('canvas.style.maxWidth = "";')).toBeLessThan(fit.indexOf("stageBox()"));
    expect(fit.indexOf("stageBox()")).toBeLessThan(fit.indexOf("canvas.getBoundingClientRect()"));
    expect(src).toContain("function stageBox(): { clip: number; scrolled: number } {");
    expect(src).toContain("clip - (canvasRect.top + scrolled) - below - 4");
    expect(src).not.toContain("function stageClipBottom(");
  });

  it("主循环每 20 帧回头复量一次,布局落定后收敛", () => {
    expect(src).toContain("if (refitTick++ % 20 === 0) resize();");
  });

  it("钳的是显示高,等比连宽一起钳,判定用的世界坐标不动", () => {
    expect(src).toContain("canvas.style.maxWidth = `${Math.round((px * WORLD_W) / WORLD_H)}px`;");
    expect(canvasDisplayCapPx(360, 200)).toBe(200);
    expect(canvasDisplayCapPx(360, 40)).toBe(MIN_CANVAS_DISPLAY_PX);
    expect(canvasDisplayCapPx(360, 400)).toBeNull();
  });
});
