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

import {
  PANEL_CHROME_ROW_PX,
  VIEWPORT_MIN_ROOM,
  panelCellForRoomRow,
  panelCellPxRow,
  panelsSideBySide,
  regrowCellPx,
  viewportRoomPx
} from "./runtime";

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

// ---------------------------------------------------------------------------
// 三办 R4 · 测试员 A:格子被空骨架量出来的假余量钳到 26px,首帧后要能回涨
//
// 挂载那一刻 `.fdf-panels` 还是空的,`.l99-stage` 这类随内容长高的裁切祖先
// 几乎没有高度,`stageRoomPx()` 量出的余量小得离谱 —— 390×844 手机和
// 1024×768 平板上棋盘四周一大片空,格子却停在 26px 下限。
// ---------------------------------------------------------------------------

describe("找不同 · 首帧后格子按真实余量回涨(三办 R4-A)", () => {
  it("手机 390×844:真实余量 525px,3 行格子从 26 回涨到 44 上限", () => {
    expect(regrowCellPx(26, 3, 844, 525)).toBe(44);
  });

  it("已经是公式给的尺寸就不折腾(返回 null,不重画)", () => {
    expect(regrowCellPx(44, 3, 844, 525)).toBeNull();
  });

  it("真挤的矮屏(360×640 舞台只给 404px)按余量长到 39,不越界", () => {
    expect(regrowCellPx(26, 3, 640, 404)).toBe(39);
  });

  it("只放大不缩小:公式算出更小值时按兵不动,缩小归 fitViewport 管", () => {
    expect(regrowCellPx(44, 3, 640, 300)).toBeNull();
  });

  it("脏值不炸:量不到余量 / 当前值不合法都返回 null", () => {
    expect(regrowCellPx(Number.NaN, 3, 844, 525)).toBeNull();
    expect(regrowCellPx(0, 3, 844, 525)).toBeNull();
    // roomPx 是 Infinity(没有裁切祖先)时按屏高那条公式回涨
    expect(regrowCellPx(26, 3, 844, Number.POSITIVE_INFINITY)).toBe(44);
  });

  it("挂载代码真的接了这条:首帧 rAF 里复算并重画", () => {
    expect(SRC).toContain("regrowCellPx(");
    const rafBlock = SRC.slice(SRC.indexOf("raf.call(win"), SRC.indexOf("win?.addEventListener"));
    expect(rafBlock).toContain("playPx,");
    expect(rafBlock).toContain("scene.rows");
    expect(rafBlock).toContain("paintAll(false)");
    expect(rafBlock).toContain("fitViewport()");
  });
});

// ---------------------------------------------------------------------------
// 三办 R5 · 测试员 A(L-1):真横屏两图并排
//
// 竖着摞的数学账:两张 3 行图各 ~116px(26px 底线格 + 标题 + 边框)加中缝与
// 165px 家当,至少 560px;915×412 的舞台可视段只有 ~260px,怎么钳都装不下,
// 内滚 200px+、一半格子永远在折叠线下。并排后一张图独享整段可视高,全部进屏
// (修后实测:915×412 crop=0、折叠线下 0、viewport 内滚 0)。
// ---------------------------------------------------------------------------

describe("找不同 · 真横屏两图并排(三办 R5-A L-1)", () => {
  it("只认真横屏:宽 ≥600 且宽大于高;竖屏、方屏、平板竖用一律竖排", () => {
    expect(panelsSideBySide(915, 412)).toBe(true);
    expect(panelsSideBySide(1024, 768)).toBe(true);
    expect(panelsSideBySide(640, 360)).toBe(true);
    expect(panelsSideBySide(390, 844)).toBe(false);
    expect(panelsSideBySide(412, 915)).toBe(false);
    expect(panelsSideBySide(500, 400)).toBe(false); // 宽不够 600 的方屏
    expect(panelsSideBySide(Number.NaN, 412)).toBe(false);
  });

  it("并排按单图摊格:915×412 舞台余量 260px 时 3 行格是 27px,不再卡 26 下限", () => {
    expect(panelCellForRoomRow(3, 260)).toBe(27);
    // 竖排口径下同样余量只能给 (260-165)/2/3 = 15 → 被钳到 26 下限然后内滚
    expect(panelCellForRoomRow(3, 260)).toBeGreaterThanOrEqual(26);
  });

  it("并排的固定家当比竖排多一行独享标题", () => {
    expect(PANEL_CHROME_ROW_PX).toBe(165 + 14);
  });

  it("并排按屏高摊格:单图能吃 62% 高,412 高的横屏 3 行直接到 44 上限", () => {
    expect(panelCellPxRow(3, 412)).toBe(44);
    expect(panelCellPxRow(6, 412)).toBe(37);
    // 脏值回退老规矩
    expect(panelCellPxRow(3, Number.NaN)).toBeGreaterThanOrEqual(26);
  });

  it("回涨也认并排口径(第 6 个参数)", () => {
    // 并排:260px 余量下 26 → 27
    expect(regrowCellPx(26, 3, 412, 260, 44, true)).toBe(27);
    // 竖排同余量不回涨(公式给 26,不比当前大)
    expect(regrowCellPx(26, 3, 412, 260, 44, false)).toBeNull();
  });

  it("挂载代码接了并排:布局类、标题方位词、回涨口径都在", () => {
    expect(SRC).toContain("panelsSideBySide(view.innerWidth ?? 360, view.innerHeight ?? 640)");
    expect(SRC).toContain('panelsEl.classList.add("fdf-panels-row")');
    expect(SRC).toContain('opts.playLabel.replace(/下图/g, "右图")');
    expect(SRC).toContain("PLAY_CELL_PX,");
    expect(SRC).toContain("rowLayout || tripleRow");
    // 中缝皮肤的 96% 宽必须被三层选择器压回,否则两图被挤到屏幕两端
    expect(SRC).toContain(".fdf-panels-row .fdf-split.fdf-seam");
  });

  it("提示文案里的方位词只在显示层换向,MODE_HINTS 数据零触碰", () => {
    expect(SRC).toContain("function orientText(text: string): string");
    expect(SRC).toContain('replace(/上下对照/g, "左右对照")');
    // MODE_HINTS 原文还是「上下对照」的写法(数据没被改)
    expect(SRC).toContain("定一条路线一行一行扫，上下对照着找！");
  });
});
