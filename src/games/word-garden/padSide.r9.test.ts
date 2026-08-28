import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIN_PAD_PX, SHORT_PAD_MIN_PX, padSidePx } from "./tracing";

const SRC = readFileSync(fileURLToPath(new URL("./tracing.ts", import.meta.url)), "utf8");

describe("N-36 描红米字格高度尺", () => {
  it("915×412 量真实余量后边长短于 300，整格可进屏", () => {
    // r9-A 复测改口径：chrome 只算「必须与格子同框」的那几行（格子上方 + 木桌内边距），
    // 花园与提示在格子下面、往下滚一屏就是，不该从边长里扣。
    // 可视段 300 装得下规格底线 240，就把 240 留住、其余交给宿主滚 ——
    // 扣成 132 是拿底线去换「少滚一屏」，把描红本身做小了。
    const { side, allowScroll } = padSidePx(915, 300, 168);
    expect(side).toBeLessThanOrEqual(300);
    expect(side).toBeGreaterThanOrEqual(SHORT_PAD_MIN_PX);
    expect(side).toBe(MIN_PAD_PX);
    expect(side).toBeLessThanOrEqual(300);
    expect(allowScroll).toBe(true);
  });

  it("屏幕不矮、只是格子底下压着花园和提示时，守住 240 底线（360×640 量到过 191px）", () => {
    // 真机 360×640 第 102 关：修前 191×191（低于规格底线），修后 259×259，两档都是整格可见。
    const { side, allowScroll } = padSidePx(360, 426, 235);
    expect(side).toBeGreaterThanOrEqual(MIN_PAD_PX);
    expect(allowScroll).toBe(true);
  });

  it("竖屏 390 宽仍守 240 底线，不比修前更小", () => {
    const { side, allowScroll } = padSidePx(390, 700, 180);
    expect(side).toBe(Math.floor(Math.min(390 * 0.72, 300)));
    expect(side).toBeGreaterThanOrEqual(MIN_PAD_PX);
    expect(allowScroll).toBe(false);
  });

  it("没有裁切祖先时不把格子收到 240 以下", () => {
    const { side, allowScroll } = padSidePx(360, Number.POSITIVE_INFINITY, 200);
    expect(side).toBeGreaterThanOrEqual(MIN_PAD_PX);
    expect(allowScroll).toBe(false);
  });

  it("可视段自己都装不下 240：收到装得下为止，不留着 240 挨切", () => {
    // r9-A 复测改口径：这一档留 240 等于让格子探出可视段（844×390 真机切掉 12px），
    // 而格子是 touch-action:none 的手势面，切掉就是描不了。宁可小也要整格在屏上。
    const { side, allowScroll } = padSidePx(915, 200, 160);
    expect(side).toBe(200);
    expect(side).toBeLessThanOrEqual(200);
    expect(side).toBeGreaterThanOrEqual(SHORT_PAD_MIN_PX);
    expect(allowScroll).toBe(true);
  });

  it("木桌内边距滚不掉，矮横屏那档要从边长里让出来", () => {
    // 上面那几行能被 fitQuizHost 滚出去，箍在格子四周的木桌边不能
    const { side } = padSidePx(915, 200, 160, 24);
    expect(side).toBe(176);
  });

  it("可视段连 120 都不到，才退回下限让宿主滚", () => {
    const { side, allowScroll } = padSidePx(915, 90, 60);
    expect(side).toBe(SHORT_PAD_MIN_PX);
    expect(allowScroll).toBe(true);
  });

  it("运行时真的调用 padSidePx，笔顺判定文件零触碰", () => {
    expect(SRC).toContain("padSidePx(vw, room, chrome, deskPad)");
    expect(SRC).toContain("touch-action:none");
    const strokes = readFileSync(fileURLToPath(new URL("./strokes.ts", import.meta.url)), "utf8");
    expect(strokes).toContain("export function judgeTrace");
  });
});
