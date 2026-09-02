/**
 * 花园国际象棋 · 1.3 第 1 轮视觉验收（窗口 2 · 测试员）补充契约。
 *
 *  ① 专项③量化锚：白黑双方主体灰度差 ≥ 80/255——缩到 16px 灰度也分得开；
 *  ② 专项②体积三件套：12 张棋子每张都有底座投影 + 描边 + 高光（本轮登记的缺口是
 *     「无渐变」，记「一般」交后续；这三样是已达标底线，不许回退）；
 *  ③ 提示图形双通道：可走小绿芽与可吃四角三角是两种不同形状（不是换色贴皮）。
 */
import { describe, expect, it } from "vitest";
import { TONE_BLACK, TONE_WHITE, captureMarkSVG, pieceSVG, sproutSVG } from "./art";
import type { PieceType } from "./board";

function lum(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

const TYPES: readonly PieceType[] = [1, 2, 3, 4, 5, 6];

describe("专项③:16px 灰度可分", () => {
  it("白黑主体灰度差 ≥ 80/255,描边也分了深浅", () => {
    expect(Math.abs(lum(TONE_WHITE.body) - lum(TONE_BLACK.body))).toBeGreaterThanOrEqual(80);
    expect(Math.abs(lum(TONE_WHITE.line) - lum(TONE_BLACK.line))).toBeGreaterThan(20);
  });
});

describe("专项②:12 张棋子的体积三件套", () => {
  it("每张都有统一底座投影 rgba(70,45,20,0.20)、描边 stroke-width 与本方高光色", () => {
    for (const type of TYPES) {
      for (const white of [true, false]) {
        const svg = pieceSVG(type, white);
        const tone = white ? TONE_WHITE : TONE_BLACK;
        expect(svg, `type${type} ${white ? "白" : "黑"} 缺投影`).toContain("rgba(70,45,20,0.20)");
        expect(svg, `type${type} ${white ? "白" : "黑"} 缺描边`).toContain("stroke-width");
        expect(svg, `type${type} ${white ? "白" : "黑"} 缺高光`).toContain(tone.hi);
      }
    }
  });
});

describe("提示图形双通道", () => {
  it("小绿芽是 path 叶片、可吃标记是四角三角,两者形状语汇不同", () => {
    const sprout = sproutSVG();
    const capture = captureMarkSVG();
    expect(sprout).not.toBe(capture);
    expect(sprout).toContain("Q");
    expect(capture).toContain("M0 0 L11 0 L0 11 Z");
    expect(capture).toContain('preserveAspectRatio="none"');
  });
});
