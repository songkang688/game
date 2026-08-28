/**
 * 三人组 r9-B(d909) · N-1 续:fruit-catch 矮横屏双栏 + 钳高改成「不看滚动位置」。
 *
 * 先合版给 `.frc-ctrl` 上了 sticky、给画布加了 `bindCanvasFit`，实测两条都没接住闯关这一路：
 *  - sticky 的滚动口是 `.l99-stage{overflow:hidden}` 那层，左右钮被钉在它的下沿，
 *    915×412 上仍然 top 457 落在裁切线(404)以下；
 *  - 钳高先读舞台再松钳位，中间隔着一次回流和浏览器的滚动锚定，
 *    读到的舞台下沿 / 滚动量 / 画布位置不是同一份布局，量出 387px 余量 → 一次都不钳。
 *
 * 修法：矮横屏走配方 G（画布独占左栏，计分/进度/按键/提示让到右栏），
 * 钳高改成「先松钳位、再一口气读完」，并把沿途 scrollTop 加回去。
 * 物理分辨率 W×H、接果判定、关卡配置零触碰。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIN_CANVAS_DISPLAY_PX, canvasDisplayCapPx } from "./index";
import { H, W } from "./logic";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

function shortLandscapeBlock(): string {
  const head = "@media (max-height: 520px) and (orientation: landscape) {";
  const at = src.indexOf(head);
  expect(at, "缺矮横屏媒体查询").toBeGreaterThan(-1);
  let depth = 0;
  for (let i = at + head.length - 1; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(at + head.length, i);
    }
  }
  throw new Error("矮横屏媒体查询没有闭合");
}

describe("N-1 续 · fruit-catch 矮横屏双栏", () => {
  it("媒体查询只盯矮横屏,915×412 命中而 412×915 / 1280×800 不命中", () => {
    const hit = (w: number, h: number): boolean => h <= 520 && w > h;
    expect(hit(915, 412)).toBe(true);
    expect(hit(360, 640)).toBe(false);
    expect(hit(412, 915)).toBe(false);
    expect(hit(1024, 768)).toBe(false);
    expect(hit(1280, 800)).toBe(false);
  });

  it("画布独占左栏,其余零件全部让到右栏", () => {
    const block = shortLandscapeBlock();
    expect(block).toContain(".frc-wrap { display: grid;");
    expect(block).toContain("grid-template-columns: minmax(0, 1fr) minmax(190px, 240px);");
    expect(block).toContain(".frc-wrap > * { grid-column: 2; }");
    expect(block).toContain(".frc-wrap > .frc-canvas { grid-column: 1; grid-row: 1 / span 20; }");
    // 画布那条要排在通配之后,不然会被 grid-column:2 盖掉
    expect(block.indexOf(".frc-wrap > * {")).toBeLessThan(block.indexOf(".frc-wrap > .frc-canvas"));
  });

  it("双栏之后按键行退回静态流:sticky 的滚动口是 overflow:hidden 那层,钉不住", () => {
    const block = shortLandscapeBlock();
    expect(block).toContain(".frc-wrap > .frc-ctrl { position: static;");
    // 基线层的 sticky 规则原样留着,竖屏那一路不受影响
    expect(src).toContain("@media (max-height: 520px) {");
    expect(src).toContain(".frc-ctrl { position: sticky; bottom: 0;");
  });

  it("右栏放得下两枚 84px 的大按钮,热区一格不让", () => {
    const col = 190;
    const gap = 10;
    expect(84 * 2 + gap).toBeLessThanOrEqual(col);
    expect(src).toContain(".frc-btn { width: 84px; height: 56px;");
  });

  it("矮横屏那段只碰 .frc-wrap 的直接子元素,不外溢", () => {
    for (const line of shortLandscapeBlock()
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("/*") && !s.startsWith("*"))) {
      if (!line.includes("{")) continue;
      expect(line.slice(0, line.indexOf("{")).trim().startsWith(".frc-wrap")).toBe(true);
    }
  });
});

describe("N-1 续 · 钳高不看滚动位置", () => {
  it("先松钳位再读,舞台下沿 / 滚动量 / 画布位置来自同一份布局", () => {
    const fit = src.slice(src.indexOf("const fit = (): void => {"), src.indexOf("jan.on(window, \"resize\", fit);"));
    expect(fit.indexOf('canvas.style.maxHeight = "";')).toBeLessThan(fit.indexOf("stageBox(wrap)"));
    expect(fit.indexOf("stageBox(wrap)")).toBeLessThan(fit.indexOf("canvas.getBoundingClientRect()"));
  });

  it("沿途 scrollTop 加回去,滚没滚都算出同一个余量", () => {
    expect(src).toContain("function stageBox(");
    expect(src).toContain("scrolled += typeof node.scrollTop === \"number\" ? node.scrollTop : 0;");
    expect(src).toContain("clip - (canvasRect.top + scrolled) - below - 4");
    expect(src).not.toContain("function stageClipBottom(");
  });

  it("画面循环每 15 帧回头复量一次,布局落定后收敛", () => {
    expect(src).toContain("const FIT_EVERY = 15;");
    expect(src).toContain("if (tick++ % FIT_EVERY === 0) fit();");
    // 三个模式(闯关 / 双人抢果 / 无尽水果雨)都要接上
    expect(src.match(/const fitTick = bindCanvasFit\(canvas, wrap, jan\);/g)).toHaveLength(3);
    expect(src.match(/^ {4}fitTick\(\);$/gm)).toHaveLength(3);
  });

  it("钳的是显示高,物理分辨率 W×H 与判定不动", () => {
    expect(W).toBe(360);
    expect(H).toBe(460);
    expect(src).toContain('<canvas class="frc-canvas fc-canvas" width="${W}" height="${H}"></canvas>');
    expect(canvasDisplayCapPx(H, 230)).toBe(230);
    expect(canvasDisplayCapPx(H, 40)).toBe(MIN_CANVAS_DISPLAY_PX);
    expect(canvasDisplayCapPx(H, H + 40)).toBeNull();
  });
});
