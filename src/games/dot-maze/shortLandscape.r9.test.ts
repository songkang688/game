/**
 * 豆豆迷宫 · 三人组第 9 轮 测试修复员 B · N-27（四模式方向键折叠线下），一次修四态。
 *
 * 修前实测（915×412，`.game-stage` clientHeight = 322）：
 * 闯关裁 167（⏸▲◀▼▶ 五键线下）/ 无尽裁 121（◀▼▶ 三键线下、另两键出屏 43）/
 * 抢豆对战裁 143（两套键 9 控件线下）/ 双人追逃裁 143（同上）——四个模式共用同一套键排。
 *
 * 修法（r6 配方 G「横屏双栏」）：
 * - 单人局（闯关 / 无尽）`.dmz-lay-solo`：迷宫一栏，方向键另起一栏；
 * - 双人局（抢豆 / 追逃）`.dmz-lay-duo`：两套键分列迷宫左右，谁坐哪边键就在哪边；
 * - 矮横屏把画布钳高的下限从 160 让到 128（那一族净高只有 150 上下）、留边 4→12；
 * - 余量按「舞台滚回顶部」算，并在 320ms 再补量一次（挂载那一瞬壳层还没回流完）。
 *
 * 修后实测（915×412）：闯关 4 / 无尽 0 / 抢豆 0 / 追逃 0，折叠线下与出屏全 0；
 * 竖屏三档 0、1024×768 与 1280×800 与修前同数（追逃两档 5 是修前就有的老底）。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  MIN_CANVAS_DISPLAY_PX,
  MIN_CANVAS_DISPLAY_SHORT_PX,
  PAD_HIT_PX,
  canvasDisplayCapPx,
  isShortLandscape,
} from "./layout";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 取一段媒体查询里的声明（到该查询的收尾大括号为止） */
function mediaBlock(head: string): string {
  const at = src.indexOf(head);
  expect(at, `找不到媒体查询 ${head}`).toBeGreaterThan(0);
  let depth = 0;
  for (let i = at; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(at, i + 1);
    }
  }
  throw new Error(`媒体查询 ${head} 没有配对的大括号`);
}

const SHORT = "@media (min-width:700px) and (max-height:560px)";

describe("N-27 · 矮横屏键排分栏（配方 G），四个模式共用一套布局", () => {
  it("媒体查询与 JS 口径同一条线：只咬 915×412 一族", () => {
    expect(src).toContain(SHORT);
    expect(isShortLandscape(915, 412)).toBe(true);
    expect(isShortLandscape(700, 560)).toBe(true);
    expect(isShortLandscape(360, 640)).toBe(false);
    expect(isShortLandscape(390, 844)).toBe(false);
    expect(isShortLandscape(412, 915)).toBe(false);
    expect(isShortLandscape(1024, 768)).toBe(false);
    expect(isShortLandscape(1280, 800)).toBe(false);
  });

  it("一局挂哪个布局类由「有没有第二套键」决定：单人 solo，双人 duo", () => {
    expect(src).toContain(
      'wrap.className = `dmz-wrap ${opts.starRole === "none" ? "dmz-lay-solo" : "dmz-lay-duo"}`;'
    );
  });

  it("单人局：迷宫一栏、方向键另起一栏", () => {
    const block = mediaBlock(SHORT);
    expect(block).toContain('grid-template-areas:"hud hud" "canvas pad" "canvas note"');
    expect(block).toContain(".dmz-wrap.dmz-lay-solo>.dmz-pad{grid-area:pad;");
  });

  it("双人局：两套键分列迷宫左右，各占一栏", () => {
    const block = mediaBlock(SHORT);
    expect(block).toContain('grid-template-areas:"padA hud padB" "padA canvas padB" "padA note padB"');
    expect(block).toContain(".dmz-wrap.dmz-lay-duo>.dmz-pads{display:contents;}");
    expect(block).toContain(".dmz-wrap.dmz-lay-duo>.dmz-pads>.dmz-pad-col:first-child{grid-area:padA;");
    expect(block).toContain(".dmz-wrap.dmz-lay-duo>.dmz-pads>.dmz-pad-col:last-child{grid-area:padB;");
  });

  it("侧栏放得下一套 3×2 的键盘：3×48 + 2×6 = 156 装得进 168 的下限", () => {
    const block = mediaBlock(SHORT);
    const cols = block.match(/grid-template-columns:minmax\((\d+)px,\d+px\) minmax\(0,1fr\) minmax\((\d+)px,\d+px\)/);
    expect(cols, "双人局三栏宽度没写成 minmax").not.toBeNull();
    const narrow = Math.min(Number(cols?.[1]), Number(cols?.[2]));
    expect(3 * PAD_HIT_PX + 2 * 6).toBeLessThanOrEqual(narrow);
  });

  it("热区一格不让：矮横屏没有改写 .dmz-key 的 min-height", () => {
    const block = mediaBlock(SHORT);
    expect(block).not.toContain(".dmz-key{");
    expect(src).toContain(`.dmz-key{border:none;border-radius:14px;min-height:${PAD_HIT_PX}px;`);
  });

  it("常规档一个像素都不动：分栏声明只出现在矮横屏媒体查询里", () => {
    const block = mediaBlock(SHORT);
    const outside = src.replace(block, "");
    expect(outside).not.toContain("display:contents");
    expect(outside).not.toContain("grid-area:canvas");
    expect(outside).not.toContain(".dmz-wrap.dmz-lay-");
  });
});

describe("N-27 · 画布钳高：矮横屏放低下限、按滚回顶部算余量", () => {
  it("矮横屏下限 128 < 常规下限 160：净高 150 的档不再被下限顶得压过裁切线", () => {
    expect(MIN_CANVAS_DISPLAY_SHORT_PX).toBeLessThan(MIN_CANVAS_DISPLAY_PX);
    expect(canvasDisplayCapPx(390, 150)).toBe(MIN_CANVAS_DISPLAY_PX);
    expect(canvasDisplayCapPx(390, 150, MIN_CANVAS_DISPLAY_SHORT_PX)).toBe(150);
  });

  it("再矮也不无限缩：余量小于下限时停在下限，剩下的交给舞台滚动", () => {
    expect(canvasDisplayCapPx(390, 60, MIN_CANVAS_DISPLAY_SHORT_PX)).toBe(MIN_CANVAS_DISPLAY_SHORT_PX);
  });

  it("常规档仍旧按 160 钳，只有矮横屏才让下限、才多留 12px 边", () => {
    expect(src).toContain("short ? MIN_CANVAS_DISPLAY_SHORT_PX : MIN_CANVAS_DISPLAY_PX");
    expect(src).toContain("const slack = short ? 12 : 4;");
  });

  it("余量按「滚回顶部」算：舞台自己的 scrollTop 要加回去，不然钳松", () => {
    expect(src).toContain("clip - (canvasRect.top + scrolled) - below - slack");
    const fn = src.slice(src.indexOf("function stageBox()"));
    expect(fn.slice(0, 700)).toContain('scrolled += typeof node.scrollTop === "number" ? node.scrollTop : 0;');
  });

  it("挂载那一瞬间量不准：320ms 再补一次，且退出时两个定时器都摘掉", () => {
    expect(src).toContain("const fitTimerLate = setTimeout(fitCanvasDisplay, 320);");
    expect(src).toContain("clearTimeout(fitTimerLate);");
  });
});
