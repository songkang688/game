/**
 * 找不同 · 横过来拿的时候提示键与放大滑杆一颗都点不着
 * （1.2 窗口5 · 第 3 轮 · 档C，**W5R3-C-04，严重**）。
 *
 * 真机复现（`vite preview` + Chrome `--headless=new` + CDP，命中只认 `elementFromPoint`，
 * 真手指慢拖纵横来回八趟）：
 *
 * | 视口 | `.fdf-wrap` | 可视段 | `.fdf-viewport` | 工具条静止 / 慢拖八趟后 | 可滚祖先 |
 * | --- | --- | --- | --- | --- | --- |
 * | 640×360 L63 | 237px | **190px** | 已钳到 96px 底线 | **0 / 3** → **0 / 3** | **无** |
 * | 844×390 L63 | 237px | 220px | 96px | 3 / 3 | — |
 * | 320×568 L63 | 356px | 330px | 96px | 3 / 3 | — |
 *
 * 走到 640×360 这一档时两张图那一块已经钳到 `VIEWPORT_MIN_ROOM`＝96px 的底线
 * （格子 26px 是 `panelCellForRoom()` 的下限，再矮就看不清哪儿不一样），
 * 再没有可让的像素，`.fdf-wrap` 自己又没有任何可滚祖先——
 * **提示键 202×44、放大滑杆 110×44、朗读键 115×44 三颗全部停在裁切线以下**。
 * 提示是这一款唯一的救济：找不出来又按不着提示，这一关就卡死在那儿。
 *
 * 兜底：让整屏自己滚，并顺手把工具条送进眼里。两张图那一格有自己的滚动条与
 * `touch-action`，手指落在图上仍旧是拖图 / 捏合，不会误滚外层。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  TOOL_MIN_H,
  VIEWPORT_MIN_ROOM,
  WRAP_MIN_ROOM,
  scrollToShowPx,
  viewportRoomPx,
  wrapNeedsScroll
} from "./runtime";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("两张图收到底线还是装不下（wrapNeedsScroll）", () => {
  it("640×360 那一幕：这一屏 237、可视段 190 —— 得兜底", () => {
    // 先确认两张图那一块确实已经趴在底线上了，让不出第二个像素
    expect(viewportRoomPx(237, 96, 190)).toBe(VIEWPORT_MIN_ROOM);
    expect(wrapNeedsScroll(237, 190)).toBe(true);
  });

  it("844×390 / 320×568 也各超出十几二十像素——那一截正是被裁掉的一角，照样兜底", () => {
    // 这两档静止时三颗工具键本来就够得着（被裁的是它们下面那一角），
    // 兜底之后只多滚十几像素，反而把裁掉的那一截还了回来
    expect(wrapNeedsScroll(237, 220)).toBe(true);
    expect(wrapNeedsScroll(356, 330)).toBe(true);
  });

  it("真装得下的一律不兜底，高屏上绝不凭空多出一个滚动容器", () => {
    expect(wrapNeedsScroll(237, 237)).toBe(false);
    expect(wrapNeedsScroll(237, 400)).toBe(false);
    // 差 1px 以内当装得下，免得子像素误差抖出一个滚动条
    expect(wrapNeedsScroll(238, 237)).toBe(false);
  });

  it("矮到连一颗工具键的中心点都塞不进去才真的不值得钳", () => {
    expect(wrapNeedsScroll(237, WRAP_MIN_ROOM - 1)).toBe(false);
    expect(wrapNeedsScroll(237, WRAP_MIN_ROOM)).toBe(true);
    expect(WRAP_MIN_ROOM).toBe(TOOL_MIN_H);
    expect(TOOL_MIN_H).toBeGreaterThanOrEqual(44);
  });

  it("量不出来的一律不兜底", () => {
    expect(wrapNeedsScroll(237, Number.NaN)).toBe(false);
    expect(wrapNeedsScroll(237, 0)).toBe(false);
    expect(wrapNeedsScroll(237, -10)).toBe(false);
    expect(wrapNeedsScroll(Number.NaN, 190)).toBe(false);
    expect(wrapNeedsScroll(0, 190)).toBe(false);
  });

  it("两张图那一块的底线一分没动：26px 的格子仍旧摊得出两行", () => {
    expect(VIEWPORT_MIN_ROOM).toBeGreaterThanOrEqual(26 * 2 + 4);
  });
});

describe("兜底之后把工具条送进眼里 · scrollToShowPx", () => {
  it("滚最小的那一段：工具条下沿一进来就收手，两张图尽量留在眼里", () => {
    // 工具条在内容里 183..227，滚动口 190 高、能滚 47
    expect(scrollToShowPx(183, 227, 190, 47)).toBe(37);
  });

  it("这一段自己比滚动口还高就从上沿开始露", () => {
    expect(scrollToShowPx(100, 400, 190, 300)).toBe(100);
  });

  it("本来就在眼里就一格都不滚；不许滚过头，也不许滚成负的", () => {
    expect(scrollToShowPx(0, 120, 190, 47)).toBe(0);
    expect(scrollToShowPx(183, 227, 190, 10)).toBe(10);
    expect(scrollToShowPx(Number.NaN, 227, 190, 47)).toBe(0);
    expect(scrollToShowPx(183, 227, 190, 0)).toBe(0);
    expect(scrollToShowPx(183, 227, 0, 47)).toBe(0);
  });
});

describe("接线与样式", () => {
  const fit = SRC.slice(SRC.indexOf("function fitViewport()"), SRC.indexOf("  // --- 手指", SRC.indexOf("function fitViewport()")));

  it("先钳两张图、再兜底整屏——顺序反了就白白浪费掉能让的那一截", () => {
    expect(fit).toContain("viewportRoomPx(");
    expect(fit).toContain("wrapNeedsScroll(");
    expect(fit.indexOf("viewportRoomPx(")).toBeLessThan(fit.indexOf("wrapNeedsScroll("));
  });

  it("兜底那一档真的挂了滚动条，而且顺手滚了一次", () => {
    expect(fit).toContain('root.style.overflowY = "auto"');
    expect(fit).toContain("scrollToShowPx(");
    expect(fit).toContain("toolsEl.getBoundingClientRect()");
  });

  it("每次重量之前先还原，不然量到的是钳完的高度，越量越小", () => {
    expect(fit.indexOf('root.style.maxHeight = ""')).toBeLessThan(fit.indexOf("stageRoomPx(root)"));
    expect(fit.indexOf('viewport.style.maxHeight = ""')).toBeLessThan(fit.indexOf("viewportRoomPx("));
    expect(fit).toContain('root.classList.remove("fdf-scroll")');
  });

  it("翻到底不许把外面那层也带着走", () => {
    const at = SRC.indexOf(".fdf-wrap.fdf-scroll");
    expect(at, "兜底那一档的样式没写").toBeGreaterThan(-1);
    expect(SRC.slice(at, SRC.indexOf("}", at))).toContain("overscroll-behavior:contain");
  });

  it("转屏 / 换窗口大小还会重量一次", () => {
    expect(SRC).toContain('win?.addEventListener("resize", fitViewport)');
  });

  it("下一帧还得再量一次——顶栏折行之前量到的是「装得下」，兜底就整个不触发", () => {
    const at = SRC.indexOf("  fitViewport();\n  const win");
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, SRC.indexOf("  return {", at));
    expect(body).toContain("requestAnimationFrame");
    expect(body).toContain("if (liveFit) fitViewport()");
    // 拆掉舞台之后那一帧不许再回来动 DOM
    expect(SRC.slice(SRC.indexOf("destroy() {", at))).toContain("liveFit = false");
  });

  it("一个像素都没往热区上要：滑杆仍旧 44px 高，提示键仍旧 44px", () => {
    expect(SRC).toContain(".fdf-zoomrow input{width:110px;height:${TOOL_MIN_H}px;}");
    expect(SRC).toContain("min-height:44px");
    expect(TOOL_MIN_H).toBe(44);
  });
});
