/**
 * W5R3-C-01：画布收到底线之后，整块玩法还是装不下的那一档。
 *
 * 真机复现（第 3 轮收官轮，320×568，第 117 关分类章）：
 *   舞台看得见 332px，`.ph-wrap` 整块 392px，画布早已趴在 `MIN_CANVAS_H` 上，
 *   多出来的 60px 全砸在最后两行 ——
 *     `.pph-bins` 557–589、`.ph-tip` 593–610，裁切线在 550。
 *   两行**整块**在裁切线以下，而且这条祖先链上一个可滚的都没有，
 *   任何滚动位置都露不出来。分类关恰恰靠那三只桶认「哪样投哪只」。
 *
 * 修法不再跟画布较劲：画布让不动了就让 `.ph-wrap` 自己滚。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MIN_CANVAS_H, WRAP_MIN_ROOM, canvasRoomPx, wrapRoomPx } from "./runtime";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("整块玩法装不下时 .ph-wrap 自己滚（W5R3-C-01）", () => {
  it("装得下就一个字都不改：高屏上绝不凭空多出一个滚动容器", () => {
    expect(wrapRoomPx(392, 392)).toBeNull();
    expect(wrapRoomPx(392, 500)).toBeNull();
    // 差 1px 以内当装得下，免得四舍五入抖出一个滚动条
    expect(wrapRoomPx(393, 392)).toBeNull();
  });

  it("320×568 那一幕：整块 392、看得见 332，钳到 332 才收得住那 60px", () => {
    expect(wrapRoomPx(392, 332)).toBe(332);
  });

  it("钳完之后原来掉在裁切线以下的两行都进了可滚范围", () => {
    const room = 332;
    const clamp = wrapRoomPx(392, room)!;
    // 可滚距离 = 内容高 − 视口高；两行一共 610 − 550 = 60px，滚得到
    expect(392 - clamp).toBeGreaterThanOrEqual(60);
  });

  it("再矮也不许压成一条缝：底线守住画布 + 一盘手柄", () => {
    expect(wrapRoomPx(392, 40)).toBe(WRAP_MIN_ROOM);
    expect(WRAP_MIN_ROOM).toBeGreaterThanOrEqual(MIN_CANVAS_H);
  });

  it("量不出来的一律不钳，绝不写出 NaN / 负数", () => {
    expect(wrapRoomPx(392, Number.NaN)).toBeNull();
    expect(wrapRoomPx(392, 0)).toBeNull();
    expect(wrapRoomPx(392, -10)).toBeNull();
    expect(wrapRoomPx(Number.NaN, 332)).toBeNull();
    expect(wrapRoomPx(0, 332)).toBeNull();
  });

  it("先扣画布、再钳外壳：顺序反了就会把能让的那一截白白浪费掉", () => {
    // 画布还有余量时，扣画布就够了，外壳不该被钳
    const canvasFirst = canvasRoomPx(392, 260, 332);
    expect(canvasFirst).toBe(200);
    // 画布已经在底线上（130）时，扣不动，只能钳外壳
    expect(canvasRoomPx(392, MIN_CANVAS_H, 332)).toBe(MIN_CANVAS_H);
    expect(wrapRoomPx(392, 332)).toBe(332);
  });

  it("index.ts 真的把两步都接上了，而且每次量之前先还原", () => {
    const fit = SRC.slice(SRC.indexOf("function fitCanvas()"), SRC.indexOf("fitCanvas();\n"));
    expect(fit).toContain('canvas.style.height = ""');
    expect(fit).toContain('wrap.style.maxHeight = ""');
    expect(fit).toContain('wrap.style.overflowY = ""');
    expect(fit).toContain("canvasRoomPx(");
    expect(fit).toContain("wrapRoomPx(");
    // 还原必须排在两次量之前，否则量到的是上一次钳完的高度，越量越小
    expect(fit.indexOf('wrap.style.maxHeight = ""')).toBeLessThan(fit.indexOf("wrapRoomPx("));
    expect(fit.indexOf('canvas.style.height = ""')).toBeLessThan(fit.indexOf("canvasRoomPx("));
  });

  it("窗口变形还会重量一次（横过来拿 / 软键盘收起都算）", () => {
    expect(SRC).toContain('bag.listen(window, "resize", fitCanvas)');
  });
});
