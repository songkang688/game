import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CORRIDOR_MIN_DISPLAY_PX, corridorRoomPx } from "./corridorFit";

/**
 * N-16(trio-r7):走廊引擎(闯关 / 无尽遗迹 / 计时速通共用 createRunner)
 * 915×412 一族矮横屏画布独吞视口、六个实时触控键 + 提示行折叠线下的修复守门。
 * 修法:mount / resize 量 `.game-stage` 可视余量 → syncSize 给 cssH 封顶,
 * scale = cssH / VIEW_H 跟着缩(拉远镜头),世界坐标与跑跳判定零触碰。
 */

const SRC = readFileSync(join(__dirname, "index.ts"), "utf8");

describe("corridorRoomPx · 钳的是画布显示高", () => {
  it("余量充裕:clip 1000 − 画布顶 100 − 家当 120 − 呼吸 4 = 776", () => {
    expect(corridorRoomPx(1000, 100, 120)).toBe(776);
  });

  it("矮横屏典型账:412 视口里 clip≈404、画布顶≈64、家当≈124 → 封顶 212(<430)", () => {
    const px = corridorRoomPx(404, 64, 124);
    expect(px).toBe(212);
    expect(px!).toBeLessThan(430);
  });

  it("挤到只剩几个像素也不跌破下限(宁可留一点滚动)", () => {
    expect(corridorRoomPx(300, 200, 90)).toBe(CORRIDOR_MIN_DISPLAY_PX);
  });

  it("量不到(NaN / 非正 / 余量倒挂)一律返回 null = 不钳", () => {
    expect(corridorRoomPx(Number.NaN, 100, 120)).toBeNull();
    expect(corridorRoomPx(0, 100, 120)).toBeNull();
    expect(corridorRoomPx(-5, 100, 120)).toBeNull();
    expect(corridorRoomPx(400, Number.NaN, 120)).toBeNull();
    expect(corridorRoomPx(100, 200, 0)).toBeNull();
  });

  it("belowPx 为负按 0 记(测量抖动不放大余量)", () => {
    expect(corridorRoomPx(500, 100, -50)).toBe(396);
  });
});

describe("走廊引擎接线(源码守门)", () => {
  it("syncSize 里 roomCap 给 cssH 封顶,scale 跟着走", () => {
    expect(SRC).toMatch(/if \(roomCap !== null && roomCap < cssH\) cssH = roomCap;/);
    expect(SRC).toMatch(/scale = cssH \/ VIEW_H;/);
  });

  it("mount 时先量再排,并抽空补量一次 + 跟着窗口 resize 重量", () => {
    expect(SRC).toMatch(/measureRoom\(\);\s*\n\s*syncSize\(\);/);
    expect(SRC).toMatch(/setTimeout\(measureRoom, 0\)/);
    expect(SRC).toMatch(/window\.addEventListener\("resize", measureRoom\)/);
    expect(SRC).toMatch(/window\.removeEventListener\("resize", measureRoom\)/);
  });

  it("余量按 .game-stage 可视下沿量(定高会裁内容的那层)", () => {
    expect(SRC).toMatch(/node\.className\.includes\("game-stage"\)/);
    expect(SRC).toMatch(/roomCap = corridorRoomPx\(clip, canvasRect\.top, below\);/);
  });

  it("CSS:矮横屏走廊切双栏(画布左 / 键排 + 提示行右),键排热区不跌破 44px", () => {
    const blocks = [...SRC.matchAll(/@media \(max-height:500px\)\{([\s\S]*?)\n\}/g)].map((m) => m[1]);
    const body = blocks.find((b) => b.includes(".ak-wrap"));
    expect(body, "缺含 .ak-wrap 的 @media (max-height:500px) 档").toBeTruthy();
    expect(body!).toMatch(/\.ak-wrap\{[^}]*display:grid/);
    expect(body!).toMatch(/\.ak-canvas\{grid-column:1;grid-row:1\/span 2;\}/);
    expect(body!).toMatch(/\.ak-pad\{grid-column:2;grid-row:1/);
    expect(body!).toMatch(/\.ak-tip\{grid-column:2;grid-row:2;\}/);
    const btn = body!.match(/\.ak-btn\{([^}]*)\}/);
    expect(btn, "缺键排紧凑档").toBeTruthy();
    expect(btn![1]).toContain("min-height:44px");
    expect(btn![1]).toContain("min-width:48px");
  });

  it("提示行键盘段拆成 .ak-tip-keys,矮横屏右栏里藏掉(触屏用不上还撑高)", () => {
    expect(SRC).toMatch(/tipKeys\.className = "ak-tip-keys";/);
    expect(SRC).toMatch(/\.ak-tip-keys\{display:none;\}/);
  });

  it("双栏时画布逻辑宽量画布自己的显示宽(免得逻辑宽 ≠ 显示宽拉扁画面)", () => {
    expect(SRC).toMatch(/cssW = Math\.max\(240, Math\.round\(canvas\.clientWidth \|\| host\.clientWidth/);
  });
});
