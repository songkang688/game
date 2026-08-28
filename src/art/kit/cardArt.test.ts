/**
 * 共享美术套件 · 纸牌牌面素材单测(1.3 第 22 步 A 档)。
 *
 * 钉死四件事:四枚花色两两不同且暖冷映射正确;每枚都有左上小高光;
 * 王牌立绘是朵朵 / 星星原创(花冠 vs 星冠、金框金 / 银框银的色票齐全)且不含 emoji;
 * 同样的入参永远得到同样的字符串。
 */
import { describe, expect, it } from "vitest";
import {
  JOKER_GOLD,
  JOKER_SILVER,
  SUIT_COOL,
  SUIT_IDS,
  SUIT_WARM,
  jokerArtSvg,
  starPathD,
  starSvg,
  suitColor,
  suitPathD,
  suitSvg,
  type SuitId,
} from "./cardArt";

const ALL: SuitId[] = ["heart", "diamond", "spade", "club"];

describe("花色 SVG", () => {
  it("四枚剪影两两不同", () => {
    for (let i = 0; i < ALL.length; i++) {
      for (let j = i + 1; j < ALL.length; j++) {
        expect(suitPathD(ALL[i])).not.toBe(suitPathD(ALL[j]));
      }
    }
  });

  it("红桃方块是暖色,黑桃梅花是冷色,色值按规格表", () => {
    expect(SUIT_WARM).toBe("#E85D75");
    expect(SUIT_COOL).toBe("#4A5A8F");
    expect(suitColor("heart")).toBe(SUIT_WARM);
    expect(suitColor("diamond")).toBe(SUIT_WARM);
    expect(suitColor("spade")).toBe(SUIT_COOL);
    expect(suitColor("club")).toBe(SUIT_COOL);
  });

  it("每枚花色都带左上小高光点,并按尺寸出图", () => {
    for (const s of ALL) {
      const svg = suitSvg(s, 12);
      expect(svg).toContain('width="12"');
      expect(svg).toContain("<circle");
      expect(svg).toContain('opacity=".5"');
      expect(svg).toContain(`ca-suit-${s}`);
    }
  });

  it("花色字符映射表齐全", () => {
    expect(SUIT_IDS["♥"]).toBe("heart");
    expect(SUIT_IDS["♦"]).toBe("diamond");
    expect(SUIT_IDS["♠"]).toBe("spade");
    expect(SUIT_IDS["♣"]).toBe("club");
  });

  it("浮雕淡纹可以换色:传什么色就用什么色", () => {
    const svg = suitSvg("spade", 40, "#123456");
    expect(svg).toContain('fill="#123456"');
    expect(svg).not.toContain(SUIT_COOL);
  });
});

describe("王牌立绘", () => {
  it("大王是朵朵(花冠),小王是星星(星冠),两张两样", () => {
    const big = jokerArtSvg("big");
    const small = jokerArtSvg("small");
    expect(big).toContain('data-part="flower-crown"');
    expect(small).toContain('data-part="star-crown"');
    expect(small).toContain("<polygon");
    expect(big).not.toBe(small);
  });

  it("金银色票按规格表,立绘里没有任何 emoji", () => {
    expect(JOKER_GOLD).toBe("#F0C25A");
    expect(JOKER_SILVER).toBe("#C9D3DE");
    // 立绘全是 SVG 基本图元,不许混一个 emoji 字符进来
    for (const kind of ["big", "small"] as const) {
      expect(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(jokerArtSvg(kind))).toBe(false);
    }
  });

  it("同样的入参永远得到同样的字符串(确定性)", () => {
    expect(jokerArtSvg("big", 34)).toBe(jokerArtSvg("big", 34));
    expect(suitSvg("heart", 12)).toBe(suitSvg("heart", 12));
  });
});

describe("四角星星屑", () => {
  it("剪影口径与 canvas 版对齐:腰身内收 28%", () => {
    const d = starPathD(10);
    // 中心 (10,10)、半径 10、腰 2.8:第一段控制点应是 (12.8, 7.2)
    expect(d).toContain("M10 0");
    expect(d).toContain("Q12.8 7.2 20 10");
    expect(d.endsWith("Z")).toBe(true);
  });

  it("星屑 SVG 按尺寸与颜色出图", () => {
    const svg = starSvg(16, "#FFD980");
    expect(svg).toContain('width="16"');
    expect(svg).toContain('fill="#FFD980"');
    expect(svg).toContain("ca-star");
  });
});
