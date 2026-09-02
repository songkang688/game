/**
 * 欢乐斗牌 · 窗口 7 第 1 轮视觉验收补充用例(测试员,只增不减)。
 *
 * 钉住本轮扫描确认过的视觉保证:
 * ① 牌面角标 + 花色 SVG + 大小王立绘(专项②:不是平涂圆贴字);
 * ② 身份徽章(皇冠 / 草帽)全自绘 SVG,零 emoji;
 * ③ 炸弹星屑环预算 8 颗封顶 + reduced 不震屏(性能 + reduced 抽查)。
 */
import { describe, expect, it } from "vitest";
import {
  EMBOSS_MIN_W,
  RING_STARS,
  bombFxPlan,
  cardFaceArtHTML,
  roleBadgeSvg,
  starRingHtml
} from "./visual";

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("窗口7 R1 · landlord-cards 专项②:牌面不是平涂贴字", () => {
  it("普通牌面带双角标 + 花色 SVG(id=0 即方块3)", () => {
    const html = cardFaceArtHTML(0, 64);
    expect(html).toContain("<svg");
    expect(html).toContain("ld-c-r");
    expect(html).toContain("ldv-ci-br");
  });

  it("宽牌 10–A 有中心浮雕,窄于 48px 自动省略", () => {
    expect(EMBOSS_MIN_W).toBe(48);
    const wide = cardFaceArtHTML(4 * 11, 64);
    const slim = cardFaceArtHTML(4 * 11, 40);
    expect(wide).toContain("ldv-emboss");
    expect(slim).not.toContain("ldv-emboss");
  });

  it("大小王换立绘 + 缎带,不是 emoji", () => {
    const joker = cardFaceArtHTML(53, 64);
    expect(joker).toContain("ldv-joker");
    expect(EMOJI_RE.test(joker)).toBe(false);
  });
});

describe("窗口7 R1 · landlord-cards 徽章自绘与粒子预算", () => {
  it("地主皇冠 / 农民草帽是 SVG,零 emoji", () => {
    for (const role of ["landlord", "farmer"] as const) {
      const svg = roleBadgeSvg(role);
      expect(svg).toContain("<svg");
      expect(EMOJI_RE.test(svg)).toBe(false);
    }
  });

  it("星屑环 8 颗封顶,reduced 不震屏但保留星屑环", () => {
    expect(RING_STARS).toBeLessThanOrEqual(8);
    expect((starRingHtml().match(/ldv-fx-star/g) ?? []).length).toBe(RING_STARS);
    expect(bombFxPlan(true)).toEqual({ shake: false, ring: true });
    expect(bombFxPlan(false)).toEqual({ shake: true, ring: true });
  });
});
