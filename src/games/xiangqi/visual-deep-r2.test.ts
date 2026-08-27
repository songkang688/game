/**
 * 朵朵星星象棋 · 1.3 窗口3 第 2 轮视觉验收 · 测试员深挖用例。
 *
 * 本轮深挖三条（与 round1 的 visual-scan / fix-r1 / view.test 不重复）：
 *  1. 16px 微缩健壮性：座位条将/帅小图标是 viewBox 矢量 SVG，红黑互异、零 emoji；
 *  2. 描边一致性：棋灵象头像同为矢量 SVG，含描边层、不引位图；
 *  3. 宪法左上 45° 光照 + 将军提示钉死：渐变高光左上偏移不许挪；reduced 下将军警告转静态描边而非消失。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pieceIconSVG, robotAvatarSVG } from "./art";

const read = (f: string): string => readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
const EMOJI_RE = /[\u2600-\u27bf\u2b00-\u2bff]|[\ud83c-\ud83e][\udc00-\udfff]/;

describe("1.3 视觉深挖（窗口3 · round2 tester）", () => {
  it("座位条将/帅小图标：viewBox 矢量、红黑互异、零 emoji", () => {
    const red = pieceIconSVG("red", "K", 18);
    const black = pieceIconSVG("black", "K", 18);
    for (const svg of [red, black]) {
      expect(svg).toContain("<svg");
      expect(svg).toContain("viewBox");
      expect(EMOJI_RE.test(svg)).toBe(false);
    }
    expect(red).not.toBe(black);
  });

  it("棋灵象头像：矢量 SVG、含描边层、不引位图", () => {
    const svg = robotAvatarSVG(30);
    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox");
    expect(/stroke=/.test(svg), "头像要有描边层").toBe(true);
    expect(/<image|href=|url\(/.test(svg), "禁止位图引用").toBe(false);
    expect(EMOJI_RE.test(svg)).toBe(false);
  });

  it("光照左上钉死 + 将军警告 reduced 静态不消失（源码哨兵）", () => {
    const art = read("./art.ts");
    expect(art).toContain("cx - r * 0.35");
    expect(art).toContain("cy - r * 0.4");
    const view = read("./view.ts");
    // 将军演出的 reduced 口径：红光呼吸→静态描边，徽章文字仍在（提示不靠动画）
    expect(view).toContain("静态描边");
    expect(view.includes("将军！") || view.includes("将军!")).toBe(true);
  });
});
