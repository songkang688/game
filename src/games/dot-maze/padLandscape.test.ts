import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * N-27(trio-r7):四模式方向键 915×412 一族矮横屏折叠线下
 * (闯关裁 167 / 双人追逃 143 / 无尽 121 / 抢豆 143,键排全部够不着)。
 * 修法(配方 G):舞台壳按单人/双人挂 dmz-solo / dmz-duo 布局类,
 * max-height:500px 档切 grid —— 单人 D-pad 挪画布右侧;双人 .dmz-pads
 * 用 display:contents 拆开,朵朵一套在左、星星一套在右,画布居中。
 * 竖屏(默认 flex 纵向流)排布零改动,画布钳高(canvasDisplayCapPx)不受影响。
 * 修后实测:闯关 51 / 无尽 5 / 抢豆 5 / 追逃 5,折叠线下全部归零。
 */

const SRC = readFileSync(join(__dirname, "index.ts"), "utf8");

describe("dot-maze 矮横屏键排双栏(N-27)", () => {
  it("舞台壳按 starRole 挂 dmz-solo / dmz-duo 布局类", () => {
    expect(SRC).toMatch(/dmz-wrap \$\{opts\.starRole === "none" \? "dmz-solo" : "dmz-duo"\}/);
  });

  it("矮横屏档存在,并把两种壳都切成 grid", () => {
    const media = SRC.match(/@media \(max-height:500px\)\{([\s\S]*?)\n\}/);
    expect(media, "缺 @media (max-height:500px) 档").toBeTruthy();
    const body = media![1];
    expect(body).toMatch(/\.dmz-wrap\.dmz-solo,\.dmz-wrap\.dmz-duo\{[^}]*display:grid/);
  });

  it("单人:D-pad 在画布右侧一列", () => {
    expect(SRC).toMatch(/\.dmz-solo\{grid-template-columns:minmax\(0,1fr\) auto;\}/);
    expect(SRC).toMatch(/\.dmz-solo>\.dmz-pad\{grid-column:2;grid-row:2/);
    expect(SRC).toMatch(/\.dmz-solo \.dmz-canvas\{grid-column:1;grid-row:2/);
  });

  it("双人:.dmz-pads 拆开(display:contents),朵朵在左、星星在右、画布居中", () => {
    expect(SRC).toMatch(/\.dmz-duo\{grid-template-columns:auto minmax\(0,1fr\) auto;\}/);
    expect(SRC).toMatch(/\.dmz-duo \.dmz-pads\{display:contents;\}/);
    expect(SRC).toMatch(/\.dmz-duo \.dmz-pad-col\{grid-column:1;grid-row:2;\}/);
    expect(SRC).toMatch(/\.dmz-duo \.dmz-pad-col\.dmz-pad-star\{grid-column:3;\}/);
    expect(SRC).toMatch(/\.dmz-duo \.dmz-canvas\{grid-column:2;grid-row:2/);
  });

  it("矮横屏双人键热区收到 44px 下限但不再小", () => {
    const media = SRC.match(/@media \(max-height:500px\)\{([\s\S]*?)\n\}/)![1];
    expect(media).toMatch(/\.dmz-pads \.dmz-pad\{grid-template-columns:repeat\(3,minmax\(44px,1fr\)\)/);
    expect(media).toMatch(/\.dmz-pads \.dmz-key\{min-height:44px/);
  });
});
