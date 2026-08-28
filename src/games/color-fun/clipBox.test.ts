/**
 * 守门：涂色小屋自己那把尺子也得按 **padding box** 算（窗口5 第 3 轮档A，`W5R3-AF-01`）。
 *
 * `W5R3-TA-05` 把本档**四份** `fit.ts`（`clock-house` / `word-garden` /
 * `landlord-cards` / `red-blue-race`）的裁切线统一改成了 `clientHeight` 口径，
 * 可这一档五款里的**第五份收紧器**是 `color-fun/ui.ts` 的 `fitColoringStage`，
 * 它没跟上，照旧读父级的 `getBoundingClientRect().bottom`（border box 下沿）。
 *
 * 监督修复员真机复量（Chrome headless + CDP，第 181 关）：
 *
 * | 视口 | `.game-stage` border box 下沿 | padding box 下沿 | `.clf-wrap` 上沿 | 真可视段 | 它钳出来的 `max-height` |
 * | --- | --- | --- | --- | --- | --- |
 * | 320×568 | 554 | 550 | 272 | **278** | **282**（多 4） |
 * | 640×360 | 352 | 348 | 206 | **142** | **146**（多 4） |
 * | 844×390 | 382 | 378 | 206 | **172** | **176**（多 4） |
 * | 568×320 | 312 | 308 | 264 | **44** | **48**（多 4） |
 *
 * 后果和 `TA-05` 是同一件事：滚动口的最下面那 4px 压在 `.game-stage` 的白边底下，
 * 照不进内容。矮横屏上尤其难看——可视段总共才 44px，白白多算了将近一成。
 *
 * 那圈 `border:4px` 本身在 `src/styles.css`（跨窗口平台文件，**禁改**），原样交窗口1；
 * 这里改的只是**本款自己量的那把尺子**，一个像素的样式都没动。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canPinCanvas, clipBottomPx, visibleRoomPx } from "./ui";

const UI = readFileSync(fileURLToPath(new URL("./ui.ts", import.meta.url)), "utf8");

describe("涂色小屋 · 裁切线按 padding box 算", () => {
  it("量得出 clientHeight 就用它（横向滚动条也一并算掉）", () => {
    // 320×568：`.game-stage` 从 y=90 起、border box 下沿 y=554，上下各 4px 边框、内容区 456px
    expect(clipBottomPx({ top: 90, bottom: 554 }, 4, 456, "4px")).toBe(550);
  });

  it("四档真机实测：border box 那把尺子恒定多算 4px", () => {
    const rows: Array<[number, number, number, number]> = [
      // [`.clf-wrap` 上沿, 裁切祖先上沿, 它的内容区高, 期望的可视段]
      [272, 90, 456, 278], // 320×568：border box 会算成 282
      [206, 100, 244, 142], // 640×360：会算成 146
      [206, 100, 274, 172], // 844×390：会算成 176
      [264, 134, 170, 44], // 568×320 矮横屏：会算成 48
    ];
    for (const [wrapTop, clipTop, clientH, want] of rows) {
      const bottom = clipBottomPx({ top: clipTop, bottom: clipTop + clientH + 8 }, 4, clientH, "4px");
      expect(visibleRoomPx(wrapTop, [bottom])).toBe(want);
      // 同一组数字，用 border box 那把尺子会多算 4px
      expect(visibleRoomPx(wrapTop, [clipTop + clientH + 8]) - want).toBe(4);
    }
  });

  it("量不出 clientHeight（桩节点 / SSR）就退回减掉下边框宽度", () => {
    expect(clipBottomPx({ top: 90, bottom: 554 }, Number.NaN, Number.NaN, "4px")).toBe(550);
    expect(clipBottomPx({ top: 90, bottom: 554 }, 0, 0, "4px")).toBe(550);
  });

  it("连边框宽度都读不到就照原样返回，绝不算成 NaN", () => {
    expect(clipBottomPx({ top: 90, bottom: 554 }, 0, 0, "")).toBe(554);
    expect(clipBottomPx({ top: 90, bottom: 554 }, 0, 0, "auto")).toBe(554);
    expect(clipBottomPx({ top: 90, bottom: 554 }, 0, 0, "0px")).toBe(554);
  });

  it("没有边框的那一层（`.l99-stage-wrap`）一分不减，高屏上的行为一个字节没变", () => {
    expect(clipBottomPx({ top: 100, bottom: 700 }, 0, 600, "0px")).toBe(700);
  });

  it("`fitColoringStage` 量裁切祖先时真的按 padding box 走", () => {
    expect(UI).toContain("clipBottomPx(p.getBoundingClientRect(), p.clientTop, p.clientHeight,");
    expect(UI).not.toMatch(/bottoms\.push\(p\.getBoundingClientRect\(\)\.bottom\)/);
  });

  it("尺子改准之后，320×568 上画布照旧钉得住 —— 不许把 TA-02 那一修顶回去", () => {
    // 真机复量：收完 `clf-tighter` 之后最高那一排 91px，画布 180px
    expect(canPinCanvas(278, 180, 91)).toBe(true);
    // 少算的这 4px 不足以翻盘（278−180=98 ≥ 91），高屏两档更是绰绰有余
    expect(canPinCanvas(350, 180, 105)).toBe(true);
    expect(canPinCanvas(552, 180, 105)).toBe(true);
  });

  it("横屏那两档仍旧钉不住 —— 尺子改准不许把「已知余量」粉饰成已解决", () => {
    expect(canPinCanvas(142, 180, 91)).toBe(false);
    expect(canPinCanvas(172, 180, 91)).toBe(false);
    expect(canPinCanvas(44, 180, 91)).toBe(false);
  });
});
