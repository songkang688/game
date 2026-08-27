/**
 * 找不同 · 提示键与放大滑杆得留在裁切线以内（窗口5 第2轮 档C · W5R2-C-04 阻断）。
 *
 * 测试员播种解锁后进第 40 关，逐档量下来：
 *
 * | 视口 | `.game-stage` 看得见 | 整块玩法 | 裁掉 | 提示键 | 放大滑杆 |
 * | --- | --- | --- | --- | --- | --- |
 * | 390×844 | 730 | 640 | 0 | 点得着 | 点得着 |
 * | 360×720 | 610 | 640 | 30 | 点得着 | 点得着 |
 * | 360×640 | 530 | 640 | 110 | **点不着** | **点不着** |
 * | 320×640 | 530 | 640 | 110 | **点不着** | **点不着** |
 *
 * 这 110px 省不出来，`panelCellForRoom()` 早把格子摊到 26px 的下限了：
 * 平台的 `.l99-stagebar` 自己就占 116px；工具条那颗「🔎 圈出大致区域（3 次）」202px 宽，
 * 和 149px 的滑杆并排放不进 303px，只好换行，一行变两行又多吃 52px。
 *
 * 所以只剩一条路：把**两张图那一块**钳矮，让它自己挂滚动条，
 * 底下的提示行与工具条就顶回屏幕里。1× 时 `clampPan()` 行程本来就是 0，
 * 那一档把 `touch-action` 让给 `pan-y`，手指才推得动这条新滚动条。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { VIEWPORT_MIN_ROOM, viewportRoomPx } from "./runtime";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const CSS = SRC.slice(SRC.indexOf("const CSS = `"), SRC.indexOf("\n`;", SRC.indexOf("const CSS = `")));

describe("找不同 · 钳两张图那一块（W5R2-C-04）", () => {
  it("装得下就别管——高屏上不许凭空多出一个滚动容器", () => {
    // 390×844：整块 640，舞台看得见 730
    expect(viewportRoomPx(640, 315, 730)).toBeNull();
    // 差 1px 以内算装得下（浏览器的小数高度）
    expect(viewportRoomPx(640.5, 315, 640)).toBeNull();
  });

  it("360×640 上超出的 100px 从两张图身上扣，工具条就顶回屏幕里", () => {
    // 实测：整块玩法 504 / 两张图那一块 315 / 舞台只给 404（530 减掉平台顶栏 116）
    expect(viewportRoomPx(504, 315, 404)).toBe(215);
    // 扣完之后整块正好落回舞台看得见的那一段以内
    const next = viewportRoomPx(504, 315, 404) as number;
    expect(504 - (315 - next)).toBeLessThanOrEqual(404);
  });

  it("360×720 上只差 30px，也照扣不误", () => {
    expect(viewportRoomPx(504, 315, 474)).toBe(285);
    const next = viewportRoomPx(504, 315, 474) as number;
    expect(504 - (315 - next)).toBeLessThanOrEqual(474);
  });

  it("再挤也给两张图留 96px，不然钳成一条缝比掉出屏幕还难用", () => {
    expect(viewportRoomPx(640, 315, 120)).toBe(VIEWPORT_MIN_ROOM);
    expect(VIEWPORT_MIN_ROOM).toBeGreaterThanOrEqual(26 * 2 + 4);
  });

  it("量不到裁切线（jsdom / 高屏）就按兵不动", () => {
    expect(viewportRoomPx(640, 315, Number.POSITIVE_INFINITY)).toBeNull();
    expect(viewportRoomPx(640, 315, Number.NaN)).toBeNull();
    expect(viewportRoomPx(640, 315, 0)).toBeNull();
    expect(viewportRoomPx(Number.NaN, 315, 404)).toBeNull();
    expect(viewportRoomPx(640, 0, 404)).toBeNull();
  });

  it("钳之前先还原，不然量到的是上一次收完的高度，越量越小", () => {
    const fit = SRC.slice(SRC.indexOf("function fitViewport()"), SRC.indexOf("// --- 命中判定"));
    expect(fit.indexOf('viewport.style.maxHeight = ""')).toBeLessThan(fit.indexOf("viewportRoomPx("));
    expect(fit).toContain('viewport.style.overflowY = "auto"');
  });

  it("1× 让给滚动、放大了收回来——不然 touch-action:none 把新滚动条按死", () => {
    expect(SRC).toContain('viewport.style.touchAction = zoom <= ZOOM_MIN + 1e-9 ? "pan-y" : "none"');
    // setZoom 是唯一的收口，滑杆、滚轮、双指捏合都走它
    const setZoom = SRC.slice(SRC.indexOf("function setZoom("), SRC.indexOf("function syncTouchAction("));
    expect(setZoom).toContain("syncTouchAction()");
    // 起手那一次也得对齐，别等玩家先动滑杆才生效
    expect(SRC.slice(SRC.indexOf("  paintAll(false);"))).toContain("syncTouchAction();");
  });

  it("滚动不许甩到外层地图上去", () => {
    const viewportRule = CSS.slice(CSS.indexOf("\n.fdf-viewport{"), CSS.indexOf("}", CSS.indexOf("\n.fdf-viewport{")));
    expect(viewportRule.replace(/\s+/g, "")).toContain("overscroll-behavior:contain");
  });

  it("转屏得重钳，离关得把监听摘干净", () => {
    expect(SRC).toContain('win?.addEventListener("resize", fitViewport)');
    expect(SRC).toContain('win?.removeEventListener("resize", fitViewport)');
  });

  it("格子下限一个字没动：26px 配 22px 命中半径，热区仍是 44px", () => {
    expect(SRC).toContain("export const PLAY_CELL_PX = 44;");
  });
});
