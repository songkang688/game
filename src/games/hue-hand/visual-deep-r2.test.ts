/**
 * 花色接龙 · 1.3 窗口3 第 2 轮视觉验收 · 测试员深挖用例。
 *
 * 本轮深挖三条（与 round1 的 visual-scan / fix-r1 / art.test 不重复）：
 *  1. 16px 微缩健壮性：三张对手头像是 viewBox 矢量 SVG（圆片里缩放安全）、零 emoji、两两互异；
 *  2. 牌背四层制式：花背卡渐变 + 双框描边 + 四色花瓣（数量钉死 ≥4 色）；
 *  3. 商标加严扫描：正式源码零「UNO」独立词（第 1 轮黑名单未含，本轮补钉）。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { botFaceSVG, cardBackSVG, type BotFace } from "./art";

const here = (f: string): string => fileURLToPath(new URL(f, import.meta.url));
const read = (f: string): string => readFileSync(here(f), "utf8");
const EMOJI_RE = /[\u2600-\u27bf\u2b00-\u2bff]|[\ud83c-\ud83e][\udc00-\udfff]/;

describe("1.3 视觉深挖（窗口3 · round2 tester）", () => {
  it("16px 微缩：三张对手头像 viewBox 矢量、零 emoji、两两互异", () => {
    const faces: BotFace[] = ["tuantuan", "yuanyuan", "diandian"];
    const svgs = faces.map((f) => botFaceSVG(f));
    for (const [i, svg] of svgs.entries()) {
      expect(svg, `${faces[i]} 不是 SVG`).toContain("<svg");
      expect(svg, `${faces[i]} 缺 viewBox`).toContain("viewBox");
      expect(EMOJI_RE.test(svg), `${faces[i]} 混入 emoji`).toBe(false);
    }
    expect(svgs[0]).not.toBe(svgs[1]);
    expect(svgs[1]).not.toBe(svgs[2]);
    expect(svgs[0]).not.toBe(svgs[2]);
  });

  it("牌背四层制式：渐变 + 描边框 + 四色花瓣", () => {
    const svg = cardBackSVG();
    expect(/linearGradient|radialGradient/.test(svg), "牌背渐变底要在").toBe(true);
    expect(/stroke=/.test(svg), "细白框描边要在").toBe(true);
    const fills = new Set([...svg.matchAll(/fill="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1].toLowerCase()));
    expect(fills.size, `牌背只有 ${fills.size} 种花瓣色`).toBeGreaterThanOrEqual(4);
  });

  it("商标加严：正式源码零「UNO」独立词", () => {
    const files = readdirSync(here(".")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    for (const f of files) {
      expect(/\bUNO\b/i.test(read(`./${f}`)), `${f} 出现「UNO」`).toBe(false);
    }
  });
});
