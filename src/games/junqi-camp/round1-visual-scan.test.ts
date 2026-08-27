/**
 * 军旗对决 · 1.3 第 1 轮视觉验收（窗口 2 · 测试员）补充契约。
 *
 *  ① 牌背红线：backSVG 无参数、每次调用逐字节相同——红蓝双方构造上不可能泄密；
 *  ② 军衔条 12 种互异且每条都有描边（体积口径），emoji 零直出；
 *  ③ 双方 HUD 徽标/大本营确实只差旗色——这正是本轮专项③记「严重」的量化证据：
 *     去掉双方主色后其余字节完全相同（形状通道缺位，交 C 档补）。
 */
import { describe, expect, it } from "vitest";
import { SIDE_COLOR, SIDE_DARK, allRankBadges, backSVG, crestSVG, hqSVG, rankBadgeSVG } from "./art";
import { KINDS } from "./rules";

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

describe("牌背红线", () => {
  it("backSVG 连续两次调用逐字节相同,且不含任何一方主色", () => {
    const a = backSVG();
    expect(a).toBe(backSVG());
    for (const c of [...Object.values(SIDE_COLOR), ...Object.values(SIDE_DARK)]) {
      expect(a.includes(c), `牌背混进阵营色 ${c}`).toBe(false);
    }
  });
});

describe("军衔条 12 种", () => {
  it("两两不同、每条都有描边或实心钢件、零 emoji", () => {
    const all = allRankBadges();
    const seen = new Set(Object.values(all));
    expect(seen.size).toBe(KINDS.length);
    for (const kind of KINDS) {
      const svg = rankBadgeSVG(kind);
      expect(EMOJI_RE.test(svg), `${kind} 混进 emoji`).toBe(false);
      expect(/stroke=|fill="#55677A"/.test(svg), `${kind} 军衔条既无描边也无钢件`).toBe(true);
    }
  });
});

describe("专项③的量化证据:双方图形只差颜色", () => {
  const stripSideColors = (svg: string): string => {
    let out = svg;
    for (const c of [...Object.values(SIDE_COLOR), ...Object.values(SIDE_DARK)]) out = out.split(c).join("#SIDE");
    return out;
  };

  it("crestSVG 与 hqSVG 双方版本去色后逐字节相同(形状通道缺位,已记「严重」交 C 档)", () => {
    expect(crestSVG("duo")).not.toBe(crestSVG("star"));
    expect(stripSideColors(crestSVG("duo"))).toBe(stripSideColors(crestSVG("star")));
    expect(hqSVG("duo")).not.toBe(hqSVG("star"));
    expect(stripSideColors(hqSVG("duo"))).toBe(stripSideColors(hqSVG("star")));
  });
});
