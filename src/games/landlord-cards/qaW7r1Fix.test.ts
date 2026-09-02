/**
 * 朵朵抢地主 · 窗口 7 第 1 轮视觉修复用例(C 档监督修复员,只增不减)。
 *
 * 钉住 A 档报告(docs/qa/1.3-window7-round1-tester.md)问题 2 修后的状态:
 *  - A-2 AI 头像:不再用裸 emoji 🐰🐼,改 visual.ts `botFaceSvg` 自绘 SVG 头像;
 *    与朵朵 / 星星立绘同工序(2 停渐变左上亮 + 1.5px 描边 + 左上高光),
 *    16px 灰度可分靠耳形几何差(团团长耳 / 圆圆圆耳 + 眼周深色块)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { BOT_FACE_STROKE, botFaceSvg } from "./visual";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R1 修复 · A-2 AI 头像:裸 emoji 清场", () => {
  it("index.ts 里 🐰🐼 连根删掉,座位表改存自绘头像键", () => {
    expect(SRC.includes("🐰")).toBe(false);
    expect(SRC.includes("🐼")).toBe(false);
    expect(SRC).toContain('face: "tuantuan"');
    expect(SRC).toContain('face: "yuanyuan"');
  });

  it("faceHTML 的 AI 分支走 botFaceSvg,不再把字符串当字形塞进 .ld-face", () => {
    expect(SRC).toContain("botFaceSvg(s.avatar as BotFaceKind)");
    expect(SRC).not.toContain('`<span class="ld-face">${s.avatar}</span>`');
  });
});

describe("窗口7 R1 修复 · A-2 自绘头像规格(与立绘同工序)", () => {
  const tt = botFaceSvg("tuantuan");
  const yy = botFaceSvg("yuanyuan");

  it("两枚都是 24×24 视窗 SVG:2 停线性渐变 + 1.5px 统一描边 + 左上高光", () => {
    for (const svg of [tt, yy]) {
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg.match(/<stop /g)?.length).toBe(2);
      expect(svg).toContain('stroke-width="1.5"');
      expect(svg).toContain(BOT_FACE_STROKE);
      // 左上高光小椭圆(白色半透明)
      expect(svg).toMatch(/<ellipse[^>]*fill="#FFFFFF" opacity="\.5?5?"/);
    }
  });

  it("耳形几何差保证 16px 灰度可分:团团长耳椭圆 / 圆圆圆耳 + 眼周深色块", () => {
    // 团团:两只长耳(ry=5.6 的竖椭圆)+ 粉内耳,没有深色眼周块
    expect(tt.match(/ry="5\.6"/g)?.length).toBe(2);
    expect(tt).toContain("#F7C6D4");
    expect(tt.includes("#4A4A55")).toBe(false);
    // 圆圆:两只圆耳(r=3 圆)+ 眼周深色椭圆两块
    expect(yy.match(/<circle[^>]*r="3"[^>]*fill="#4A4A55"/g)?.length).toBe(2);
    expect(yy.match(/rotate\((-?)18 /g)?.length).toBe(2);
    // 两枚剪影不共享任何耳形元素
    expect(yy.includes('ry="5.6"')).toBe(false);
  });

  it("头像本体零 emoji 码位(U+1F300–U+1FAFF)", () => {
    for (const svg of [tt, yy]) {
      expect(/[\u{1F300}-\u{1FAFF}]/u.test(svg)).toBe(false);
    }
  });
});
