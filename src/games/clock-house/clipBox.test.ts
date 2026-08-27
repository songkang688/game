/**
 * 守门：钳位量的是**真裁切线**，不是父级的 border box（窗口5 第 3 轮档A，`W5R3-TA-05`）。
 *
 * 第 3 轮测试员 A7 在 81 / 112 格宿主上逐格量到一个**恒定 4px** 的差：
 * 钳出来的天花板比真裁切线低 4px，最底下那颗选项的盒子因此少露 4px
 * （字整、中心点够得着、按下去有效，所以判建议不判缺陷）。
 *
 * 根因：滚动口是 **padding box**，下边框那几像素照不进内容；
 * `getBoundingClientRect().bottom` 给的却是 **border box** 的下沿，
 * 而 `.game-stage` 写着 `border:4px solid #fff`。
 *
 * 本轮五档视口复量，两款宿主逐档都是同一个 4：
 *   320×568  334 / 330 · 360×640  406 / 402 · 640×360  194 / 190 · 844×390  224 / 220
 *   390×844  裁切祖先换成 `.l99-stage-wrap`（没有边框），差 0——这一款那一档本来就不钳。
 *
 * 那圈 4px 边框本身在 `src/styles.css`（跨窗口平台文件，禁改），原样交窗口1；
 * 这里改的只是**本档自己量的那把尺子**。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { clipBottomPx, visibleRoomPx } from "./fit";

const FIT = readFileSync(fileURLToPath(new URL("./fit.ts", import.meta.url)), "utf8");

describe("时钟小屋 · 裁切线按 padding box 算", () => {
  it("量得出 clientHeight 就用它（连横向滚动条也一并算掉）", () => {
    // 320×568：`.game-stage` 从 y=108 起、border box 下沿 y=554（上下各 4px 边框，内容区 438px）
    expect(clipBottomPx({ top: 108, bottom: 554 }, 4, 438, "4px")).toBe(550);
  });

  it("四档实测的可视段：border box 那把尺子恒定多算 4px", () => {
    const rows: Array<[number, number, number, number]> = [
      // [宿主上沿, 裁切祖先上沿, 它的内容区高, 期望的可视段]
      [220, 108, 438, 330], // 320×568：border box 会算成 334
      [220, 108, 510, 402], // 360×640：会算成 406
      [158, 100, 244, 190], // 640×360：会算成 194
      [158, 100, 274, 220], // 844×390：会算成 224
    ];
    for (const [hostTop, clipTop, clientH, want] of rows) {
      const bottom = clipBottomPx({ top: clipTop, bottom: clipTop + clientH + 8 }, 4, clientH, "4px");
      expect(visibleRoomPx(hostTop, [bottom])).toBe(want);
      // 同一组数字，用 border box 那把尺子会多算 4px
      expect(visibleRoomPx(hostTop, [clipTop + clientH + 8]) - want).toBe(4);
    }
  });

  it("量不出 clientHeight（桩节点 / SSR）就退回减掉下边框宽度", () => {
    expect(clipBottomPx({ top: 108, bottom: 554 }, Number.NaN, Number.NaN, "4px")).toBe(550);
    expect(clipBottomPx({ top: 108, bottom: 554 }, 0, 0, "4px")).toBe(550);
  });

  it("连边框宽度都读不到就照原样返回，绝不算成 NaN", () => {
    expect(clipBottomPx({ top: 108, bottom: 554 }, 0, 0, "")).toBe(554);
    expect(clipBottomPx({ top: 108, bottom: 554 }, 0, 0, "auto")).toBe(554);
    expect(clipBottomPx({ top: 108, bottom: 554 }, 0, 0, "0px")).toBe(554);
  });

  it("没有边框的那一层（`.l99-stage-wrap`）一分不减，高屏上的行为一个字节没变", () => {
    expect(clipBottomPx({ top: 100, bottom: 700 }, 0, 600, "0px")).toBe(700);
  });

  it("钳位那一路真的按 padding box 量", () => {
    expect(FIT).toContain("clipBottomPx(p.getBoundingClientRect(), p.clientTop, p.clientHeight, cs.borderBottomWidth)");
    expect(FIT).not.toMatch(/bottoms\.push\(p\.getBoundingClientRect\(\)\.bottom\)/);
  });
});
