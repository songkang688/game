/**
 * 拼图乐园 · 窗口 7 第 1 轮视觉修复用例(C 档监督修复员,只增不减)。
 *
 * 钉住 A 档报告(docs/qa/1.3-window7-round1-tester.md)问题 1 修后的状态:
 * 牌面内容不再是裸 emoji 字形,而是主题场景画的图案切片(kit pattern):
 *  - 五处渲染路径(推格子 / 旋转块 / 缺块补齐 ×2 / 拖块)统一走 skinFor 的切片嵌入;
 *  - 预览小样与底图虚影与牌面同源(patternSliceSvg);
 *  - emoji 降级为关卡数据里的主题钥匙(THEME_TILES 原数据一个不动),不再上屏;
 *  - 记忆关藏图时切片一并藏(pz-hidden 不漏画)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { patternSceneId } from "../../art/kit/pattern";
import { PT_CSS, pieceSkinSvg } from "./visual";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R1 修复 · A-1 牌面 emoji 直出清场", () => {
  it("五处 `pzv-face emoji` 模板全部拆除,只剩缺块洞的功能问号", () => {
    expect(SRC.includes("${pic[v].emoji}")).toBe(false);
    expect(SRC.includes("${tile.emoji}")).toBe(false);
    // 缺块的洞保留「？」功能提示(不是装饰 emoji)
    expect(SRC).toContain('<span class="pzv-face">？</span>');
  });

  it("场景库随画板注入,skinFor 给正常块嵌切片、虚影不嵌", () => {
    expect(SRC).toContain("patternDefsSvg(themeIdx, cfg.rows, cfg.cols)");
    expect(SRC).toContain("slice: ghost ? undefined : { theme: themeIdx, home }");
  });

  it("预览小样与底图虚影同源裁画(不再 textContent = emoji)", () => {
    expect(SRC.match(/patternSliceSvg\(themeIdx, cfg\.rows, cfg\.cols, /g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(SRC.includes("cell.textContent = pic[v].emoji")).toBe(false);
    expect(SRC.includes("cell.textContent = tile.emoji")).toBe(false);
  });
});

describe("窗口7 R1 修复 · 齿边皮肤的切片嵌入规格", () => {
  it("带 slice 时:齿形 clipPath 裁剪 + <use> 引用场景;纸纹渐变仍盖在画上", () => {
    const svg = pieceSkinSvg({ rows: 3, cols: 3, r: 1, c: 1, bg: "#FFD9E8", cellPx: 64, seed: 5, slice: { theme: 0, home: 4 } });
    expect(svg).toContain("<clipPath");
    expect(svg).toContain('clip-path="url(#');
    expect(svg).toContain(`href="#${patternSceneId(0, 3, 3)}"`);
    // 切片(clip-path 的 <g>)在齿形底色之后、纸纹渐变之前
    const sliceAt = svg.indexOf("clip-path=\"url(");
    const grainAt = svg.lastIndexOf('fill="url(#ptg');
    expect(sliceAt).toBeGreaterThan(svg.indexOf('stroke="var(--pt-piece-edge)"'));
    expect(grainAt).toBeGreaterThan(sliceAt);
  });

  it("不带 slice 时输出与 1.3 首发同构(既有 21-B 用例不惊动);虚影仍无描边无纸纹", () => {
    const plain = pieceSkinSvg({ rows: 3, cols: 3, r: 1, c: 1, bg: "#FFD9E8", cellPx: 64, seed: 5 });
    expect(plain).not.toContain("clipPath");
    expect(plain).not.toContain("pzv-slice");
    const ghost = pieceSkinSvg({ rows: 3, cols: 3, r: 1, c: 1, bg: "", cellPx: 64, seed: 5, ghost: true });
    expect(ghost).not.toContain("stroke");
    expect(ghost).not.toContain("pzv-slice");
  });

  it("托盘干扰块(块号 ≥ 行×列)嵌的是 alt 场景切片,与真图对不上", () => {
    const svg = pieceSkinSvg({ rows: 3, cols: 3, r: 3, c: 1, bg: "#FDF3C7", cellPx: 64, seed: 5, slice: { theme: 0, home: 10 } });
    expect(svg).toContain(`href="#${patternSceneId(0, 3, 3, true)}"`);
  });
});

describe("窗口7 R1 修复 · 记忆关不漏画 + 切片样式", () => {
  it("pz-hidden 档把预览切片一并藏起来(SVG 不吃 color:transparent 的老招)", () => {
    expect(PT_CSS).toContain(".pz-preview.pz-hidden i .pzv-slice { visibility: hidden; }");
  });

  it("预览/虚影格切片撑满 + 溢出裁剪;场景库 0×0 不占布局", () => {
    expect(PT_CSS).toContain(".pz-preview i, .pzt-ghost i { overflow: hidden; }");
    expect(PT_CSS).toContain(".pz-preview i .pzv-slice, .pzt-ghost i .pzv-slice { display: block; width: 100%; height: 100%; }");
    expect(PT_CSS).toContain(".pzv-scenedefs { position: absolute; width: 0; height: 0; overflow: hidden; }");
  });
});
