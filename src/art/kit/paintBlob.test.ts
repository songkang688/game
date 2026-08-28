/**
 * 颜料坨与画室木件的单测（1.3 第 26 步 A 档 · color-fun 独占）。
 * 全部纯函数，node 直接验；色值对照规格 4.1 的 token 表逐个钉死。
 */
import { describe, expect, it } from "vitest";
import { parseHex, shade } from "./palette";
import {
  BLOB_HIGHLIGHT_RATIO,
  BLOB_LIGHTEN_PCT,
  BLOB_MIN_PX,
  BLOB_SINK_PX,
  RIPPLE_MS,
  STUDIO_TOKENS,
  blobLayers,
  brushDipSVG,
  dropBadgePath,
  paletteBoardCss,
  rippleRadius,
  rippleReach,
} from "./paintBlob";

describe("paintBlob · 规格 4.1 的 token 一字不差", () => {
  it("木板 / 高光 / 阴影 / 画架 / 墙地 / 斜带 / 射灯 / 亮环全部对表", () => {
    expect(STUDIO_TOKENS.paletteWood).toBe("#d9a066");
    expect(STUDIO_TOKENS.paletteWoodDark).toBe("#a06b3a");
    expect(STUDIO_TOKENS.blobHighlight).toBe("rgba(255,255,255,.55)");
    expect(STUDIO_TOKENS.blobShadow).toBe("rgba(0,0,0,.14)");
    expect(STUDIO_TOKENS.easelWood).toBe("#c98d54");
    expect(STUDIO_TOKENS.studioWall).toBe("#f8f1e7");
    expect(STUDIO_TOKENS.studioFloor).toBe("#e6d8c4");
    expect(STUDIO_TOKENS.sunBeam).toBe("rgba(255,233,168,.35)");
    expect(STUDIO_TOKENS.galleryLight).toBe("rgba(255,246,214,.5)");
    expect(STUDIO_TOKENS.pickRing).toBe("#ff8c42");
  });

  it("规格里的几个数字：坨径 ≥36、下沉 2px、高光 30%、提亮 20%、涟漪 180ms", () => {
    expect(BLOB_MIN_PX).toBeGreaterThanOrEqual(36);
    expect(BLOB_SINK_PX).toBe(2);
    expect(BLOB_HIGHLIGHT_RATIO).toBe(0.3);
    expect(BLOB_LIGHTEN_PCT).toBe(20);
    expect(RIPPLE_MS).toBe(180);
  });
});

describe("paintBlob · 颜料坨叠层背景", () => {
  it("三层齐全：高光点 + 挤压阴影 + 径向渐变主体（不是平涂）", () => {
    const layers = blobLayers("#ff6b6b");
    expect(layers.split("),").length).toBeGreaterThanOrEqual(3);
    expect(layers).toContain(STUDIO_TOKENS.blobHighlight);
    expect(layers).toContain(STUDIO_TOKENS.blobShadow);
    expect([...layers.matchAll(/radial-gradient\(/g)]).toHaveLength(3);
  });

  it("主体渐变中心提亮 20%、边缘回到本色", () => {
    const hex = "#74c0fc";
    const layers = blobLayers(hex);
    expect(layers).toContain(`${shade(hex, BLOB_LIGHTEN_PCT)} 0%`);
    expect(layers).toContain(`${hex} 72%`);
    const lit = parseHex(shade(hex, BLOB_LIGHTEN_PCT))!;
    const base = parseHex(hex)!;
    // 提亮是真的往白走：三个通道都不小于本色
    for (let i = 0; i < 3; i++) expect(lit[i]).toBeGreaterThanOrEqual(base[i]);
  });

  it("高光点直径 = 坨径 30%（渐变里写成 15% 的半径停点）", () => {
    expect(blobLayers("#ffe066")).toContain(" 0 15%");
  });

  it("解析不了的颜色也给得出叠层，视觉层不许抛错", () => {
    expect(() => blobLayers("洋红")).not.toThrow();
    expect(blobLayers("洋红")).toContain("radial-gradient");
  });
});

describe("paintBlob · 木板 / 画笔 / 颜料滴", () => {
  it("木板 CSS：前缀清洗、木色底 + 木纹 + 拇指孔 + 2px 深描边，不写任何盒子尺寸", () => {
    const css = paletteBoardCss("clf");
    expect(css).toContain(".clf-board{");
    expect(css).toContain(`border:2px solid ${STUDIO_TOKENS.paletteWoodDark}`);
    expect(css).toContain("repeating-radial-gradient");
    expect(css).toContain(`radial-gradient(circle at 9% 34%,${STUDIO_TOKENS.paletteWoodDark}`);
    for (const banned of ["width:", "height:", "min-width", "min-height"]) {
      expect(css.includes(banned), `木板皮肤不许写 ${banned}`).toBe(false);
    }
    expect(paletteBoardCss("x1!@#")).toContain(".x-board{");
    expect(paletteBoardCss("")).toContain(".kit-board{");
  });

  it("画笔：笔尖类名 kit-brush-tip、fill 就是蘸的那个色，杆是画架木色", () => {
    const svg = brushDipSVG("#e03131");
    expect(svg).toContain('class="kit-brush-tip"');
    expect(svg).toContain('fill="#e03131"');
    expect(svg).toContain(STUDIO_TOKENS.easelWood);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain("<image");
  });

  it("颜料滴路径：尖尾在圆心上方 1.8r，闭合，坐标全是有限数", () => {
    const d = dropBadgePath(100, 60, 10);
    expect(d.startsWith("M100 42")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).toContain("A10 10 0 1 1 90 60");
    expect(d).not.toContain("NaN");
    expect(d).not.toContain("Infinity");
  });
});

describe("paintBlob · 涟漪半径", () => {
  it("铺满整个包围盒 = 对角线长；400×300 的画布对角线是 500", () => {
    expect(rippleRadius(400, 300)).toBe(500);
    expect(rippleRadius(3, 4)).toBe(5);
    expect(rippleRadius(Number.NaN, 4)).toBe(4);
  });

  it("从点击点铺到最远角：角上点是全对角线，中心点是半条", () => {
    const box = { x: 0, y: 0, width: 400, height: 300 };
    expect(rippleReach(0, 0, box)).toBe(500);
    expect(rippleReach(200, 150, box)).toBe(250);
    // 退化盒也至少给 4，涟漪不至于看不见
    expect(rippleReach(10, 10, { x: 10, y: 10, width: 0, height: 0 })).toBe(4);
  });
});
