/**
 * 朵朵大战星星 · 三人组第 9 轮 测试修复员 B · N-26（闯关七键线下）+ r4 C-9（`.dvs-back` 32px）。
 *
 * 修前实测（915×412，`.game-stage` clientHeight = 322）：
 * - 闯关第 1 关裁 314、canvas 出屏 111，◀▲▼▶✋💥🤝 整排折叠线下（截图只露天空）；
 * - 双人对战裁 117，两块摇杆共 14 键全线下；无尽车轮战裁 140；
 * - `.dvs-back`（◀ 返回 / ⏸ 暂停）实测 32px 高，低于 40px 触区底线（r4 C-9 / 窗口4 W4R3-01）。
 *
 * 修法：
 * - 单人局（闯关 / 人机 / 无尽）挂 `.dvs-solo`，矮横屏改双栏：画布独占左栏，
 *   七键排 / 名牌 / 提示进右栏。右栏 372px，七颗 46px 键正好一排排完。
 * - 双人同屏（对战 / 团队 / 合作）不改结构，只把键距 6→4，让一排七键别折行。
 * - 画布钳高在矮横屏把下限从 150 让到 120：那一族净高只有 130 上下，
 *   守着 150 就等于让画布压着裁切线，而线以下正是唯一的输入方式。
 * - 余量按「舞台滚回顶部」算：舞台自己滚下去一截时 rect.top 会跟着跑，
 *   直接减会凭空多出一个 scrollTop，那一刀就钳松了。
 * - 钳高每 20 帧补量一次：挂载那一瞬间壳层还没回流完，一次量不准。
 *
 * 修后实测（915×412）：闯关 2 / 双人 0 / 人机 0 / 团队 0 / 合作 0 / 无尽 0，
 * 折叠线下与出屏全 0；1280×800 双人对战顺带从裁 8 回到 0。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  MIN_CANVAS_DISPLAY_PX,
  MIN_CANVAS_DISPLAY_SHORT_PX,
  canvasDisplayCapPx,
  isShortLandscape,
} from "./index";

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

describe("N-26 · 矮横屏单人局双栏（配方 G）", () => {
  it("媒体查询与 JS 口径同一条线：只咬 915×412 一族，竖屏三档与 1024×768 / 1280×800 都不进", () => {
    expect(src).toContain(SHORT);
    expect(isShortLandscape(915, 412)).toBe(true);
    expect(isShortLandscape(700, 560)).toBe(true);
    expect(isShortLandscape(360, 640)).toBe(false);
    expect(isShortLandscape(390, 844)).toBe(false);
    expect(isShortLandscape(412, 915)).toBe(false);
    expect(isShortLandscape(1024, 768)).toBe(false);
    expect(isShortLandscape(1280, 800)).toBe(false);
  });

  it("只有单人局挂 .dvs-solo：双人同屏的两块摇杆各占半边，不进双栏分支", () => {
    expect(src).toContain("const solo = opts.human.p2 === undefined;");
    expect(src).toContain('el("div", solo ? "dvs-arena dvs-solo" : "dvs-arena")');
  });

  it("双栏：画布独占左栏，七键排 / 名牌 / 提示搬进右栏", () => {
    const block = mediaBlock(SHORT);
    expect(block).toContain('grid-template-areas:"bar bar" "canvas pad" "canvas cards" "canvas hint"');
    expect(block).toContain(".dvs-arena.dvs-solo>.dvs-pads{display:contents;}");
    expect(block).toContain(".dvs-arena.dvs-solo>.dvs-pads>.dvs-pad{grid-area:pad;");
    expect(block).toContain(".dvs-arena.dvs-solo>.dvs-canvas{grid-area:canvas;");
  });

  it("右栏宽度够一排七键：7×46 + 6×5 = 352 装得进 372", () => {
    const block = mediaBlock(SHORT);
    const col = block.match(/grid-template-columns:minmax\(0,1fr\) minmax\(\d+px,(\d+)px\)/);
    expect(col, "右栏宽度没写成 minmax").not.toBeNull();
    const wide = Number(col?.[1]);
    // .dvs-pad button 的 min-width 是 46px，矮横屏这条分支把键距收到 5px
    expect(7 * 46 + 6 * 5).toBeLessThanOrEqual(wide - 8);
  });

  it("双人同屏只收键距不改结构：7×46 + 6×4 = 346 一排排得下（720 的壳每人 348）", () => {
    const block = mediaBlock(SHORT);
    expect(block).toContain(".dvs-arena:not(.dvs-solo)>.dvs-pads>.dvs-pad{justify-content:center;gap:4px;}");
    expect(7 * 46 + 6 * 4).toBeLessThanOrEqual((720 - 12 - 6) / 2);
  });

  it("热区一格不让：矮横屏没有改写 .dvs-pad button 的 min-width / min-height", () => {
    const block = mediaBlock(SHORT);
    expect(block).not.toContain(".dvs-pad button{");
    expect(src).toContain(".dvs-pad button{border:none;border-radius:14px;min-width:46px;min-height:46px;");
  });

  it("常规档一个像素都不动：双栏声明只出现在矮横屏媒体查询里", () => {
    const block = mediaBlock(SHORT);
    const outside = src.replace(block, "");
    expect(outside).not.toContain("display:contents");
    expect(outside).not.toContain("grid-area:canvas");
    // .dvs-solo 这个类常规档也挂在 DOM 上（JS 里那一行），但没有任何常规档样式认它
    expect(outside).not.toContain(".dvs-arena.dvs-solo");
    expect(outside).not.toContain(".dvs-arena:not(.dvs-solo)");
  });
});

describe("N-26 · 画布钳高：矮横屏放低下限、按滚回顶部算余量", () => {
  it("矮横屏下限 120 < 常规下限 150：净高 130 的档不再被下限顶得压过裁切线", () => {
    expect(MIN_CANVAS_DISPLAY_SHORT_PX).toBeLessThan(MIN_CANVAS_DISPLAY_PX);
    // 净余量 130：常规下限会返回 150（超出 20px，触屏键跟着掉线下），矮横屏返回 130
    expect(canvasDisplayCapPx(405, 130)).toBe(MIN_CANVAS_DISPLAY_PX);
    expect(canvasDisplayCapPx(405, 130, MIN_CANVAS_DISPLAY_SHORT_PX)).toBe(130);
  });

  it("再矮也不无限缩：余量小于下限时停在下限，剩下的交给舞台滚动", () => {
    expect(canvasDisplayCapPx(405, 40, MIN_CANVAS_DISPLAY_SHORT_PX)).toBe(MIN_CANVAS_DISPLAY_SHORT_PX);
  });

  it("装得下就一个样式都不写（null），亚像素抖动不算超", () => {
    expect(canvasDisplayCapPx(200, 400, MIN_CANVAS_DISPLAY_SHORT_PX)).toBeNull();
    expect(canvasDisplayCapPx(200.5, 200, MIN_CANVAS_DISPLAY_SHORT_PX)).toBeNull();
  });

  it("矮横屏才让下限：常规档仍旧按 150 钳", () => {
    expect(src).toContain(
      "short ? MIN_CANVAS_DISPLAY_SHORT_PX : MIN_CANVAS_DISPLAY_PX"
    );
  });

  it("余量按「滚回顶部」算：舞台自己的 scrollTop 要加回去，不然钳松", () => {
    expect(src).toContain("clip - (canvasRect.top + scrolled) - below - 4");
    const fn = src.slice(src.indexOf("function stageBox()"));
    expect(fn.slice(0, 600)).toContain("scrolled += typeof node.scrollTop === \"number\" ? node.scrollTop : 0;");
  });

  it("挂载那一瞬间量不准：每 20 帧补量一次，显示宽没变就不动 backing", () => {
    expect(src).toContain("const REFIT_EVERY = 20;");
    expect(src).toContain("if (++refitTick % REFIT_EVERY === 0) refit();");
    const fn = src.slice(src.indexOf("function refit()"));
    expect(fn.slice(0, 300)).toContain("if (Math.abs(w - cssW) < 0.5) return;");
  });
});

describe("r4 C-9 / 窗口4 W4R3-01 · .dvs-back 触区回到 40px", () => {
  it("返回 / 暂停键补上 min-height:40px，字号内边距一个没动", () => {
    const rule = src.slice(src.indexOf(".dvs-back{"), src.indexOf(".dvs-back:active"));
    expect(rule).toContain("min-height:40px");
    expect(rule).toContain("padding:7px 13px");
    expect(rule).toContain("font-size:13.5px");
    // 40px 是靠 min-height 撑的，文字得居中，不然按钮里的字贴着上沿
    expect(rule).toContain("display:inline-flex");
    expect(rule).toContain("align-items:center");
  });
});
