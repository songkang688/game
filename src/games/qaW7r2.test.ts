/**
 * 窗口 7 · 第 2 轮视觉验收(A 档测试员)守门用例。
 * 四组增量断言,与第 1 轮 qaW7r1* / qaW7r1Fix* 不重复:
 *  1. 回归防线②:危险 / 功能提示在 reduced 下必须保留
 *     (fruit-catch 警告红圈、fishing-star 浮标点头 / 涟漪加密);
 *  2. shade 同名三实现量纲互不相同(kit 0–1 小数混白黑 / poop-hero 百分比 /
 *     memory-cards 小数乘法调暗),各自语义钉死,防跨模块照抄踩坑;
 *  3. 16px / 小尺寸降级门槛对表(memory 48px 角标、caterpillar 12px 触角 +
 *     蝴蝶结豁免、jigsaw 40px 齿径降档、毛毛虫头身比);
 *  4. landlord 大小王身份多通道:金银框 + 立绘 + 角标恒在,窄牌砍掉 9px 缎带后
 *     身份通道不塌缩(缎带只是 wide 卡的补充通道)。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { shade as kitShade } from "../art/kit/fruit";
import {
  CAT_ANTENNA_MIN_HEAD_PX,
  CAT_HEAD_R_RATIO,
  showAntenna,
} from "../art/kit/caterpillar";
import {
  JIGSAW_RADIUS_PCT,
  JIGSAW_RADIUS_SMALL_PCT,
  JIGSAW_SMALL_PX,
  jigsawRadiusPct,
} from "../art/kit/jigsaw";
import { FSH_TIMING, bobberDipPx, rippleGapMs } from "./fishing-star/visual";
import { isJoker } from "./landlord-cards/logic";
import { cardFaceArtHTML } from "./landlord-cards/visual";
import { MC_CORNER_MIN_PX, shade as mcShade } from "./memory-cards/visual";
import { shade as phShade } from "./poop-hero/visual";

const FC_SRC = readFileSync(new URL("./fruit-catch/index.ts", import.meta.url), "utf8");

/** Rec.601 灰度(0–255) */
function luma(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

describe("W7R2 · 回归防线② 危险/功能提示 reduced 下保留", () => {
  it("fruit-catch 警告红圈:calm 只停脉动,圈本体照画(源码级钉死)", () => {
    const fn = FC_SRC.slice(FC_SRC.indexOf("function drawWarnRing"), FC_SRC.indexOf("interface BasketFx"));
    // calm 分支只把脉动系数钉回 1,不 return、不跳过描边
    expect(fn).toContain("calm ? 1");
    expect(fn).toContain(".arc(");
    expect(fn).toContain(".stroke()");
    expect(fn).not.toMatch(/if\s*\(\s*calm\s*\)\s*return/);
  });

  it("fishing-star 浮标点头:reduced 直接沉到位(功能提示不丢,不归零)", () => {
    expect(bobberDipPx(0, true, true)).toBe(FSH_TIMING.bobberNodPx);
    expect(FSH_TIMING.bobberNodPx).toBeGreaterThan(0);
    // 窗口外恒 0:提示只在该出现时出现
    expect(bobberDipPx(999, false, true)).toBe(0);
  });

  it("fishing-star 涟漪加密:上钩窗口内间隔缩短(与 reduced 无关的功能映射)", () => {
    expect(rippleGapMs(true)).toBeLessThan(rippleGapMs(false));
    expect(rippleGapMs(false) / rippleGapMs(true)).toBeCloseTo(FSH_TIMING.rippleDense, 5);
  });
});

describe("W7R2 · shade 同名三实现量纲钉死(跨模块照抄防线)", () => {
  it("kit shade:amount 是 0–1 小数,|amount|≥1 直接打到纯白/纯黑(照抄百分比必翻车)", () => {
    // 正确用法:小数部分混合
    const darker = kitShade("#808080", -0.16);
    expect(luma(darker)).toBeLessThan(luma("#808080"));
    expect(luma(darker)).toBeGreaterThan(0);
    // 踩坑演示:把百分比 -16 当参数传,直接变纯黑
    expect(kitShade("#808080", -16).toLowerCase()).toBe("#000000");
    expect(kitShade("#808080", 25).toLowerCase()).toBe("#ffffff");
  });

  it("poop-hero shade:pct 是百分比,-18 只加深 18%(与 kit 量纲不同)", () => {
    const darker = phShade("#808080", -18);
    expect(luma(darker)).toBeLessThan(luma("#808080"));
    expect(luma(darker)).toBeGreaterThan(luma("#808080") * 0.7);
  });

  it("memory-cards shade:amt 是小数乘法调暗(-0.2 → ×0.8),第三种量纲", () => {
    const darker = mcShade("#808080", -0.2);
    expect(luma(darker)).toBeCloseTo(luma("#808080") * 0.8, 0);
  });

  it("pattern.ts / icons.ts 只按 kit 小数量纲调用(不混用百分比)", () => {
    const patternSrc = readFileSync(new URL("../art/kit/pattern.ts", import.meta.url), "utf8");
    const iconsSrc = readFileSync(new URL("../art/kit/icons.ts", import.meta.url), "utf8");
    for (const src of [patternSrc, iconsSrc]) {
      for (const m of src.matchAll(/shade\([^,]+,\s*(-?\d+(?:\.\d+)?)\s*\)/g)) {
        expect(Math.abs(Number(m[1]))).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("W7R2 · 小尺寸降级门槛对表(角色特写 16px 走查的机器化)", () => {
  it("memory-cards 角标降级门槛 48px", () => {
    expect(MC_CORNER_MIN_PX).toBe(48);
  });

  it("caterpillar:触角 12px 门槛,头身比 0.42(头比身节宽,16px 剪影认头)", () => {
    expect(CAT_ANTENNA_MIN_HEAD_PX).toBe(12);
    expect(showAntenna(5.9)).toBe(false);
    expect(showAntenna(6)).toBe(true);
    expect(CAT_HEAD_R_RATIO).toBeGreaterThan(0.34);
  });

  it("jigsaw:<40px 齿径 18%→14% 降档(小块不糊齿)", () => {
    expect(jigsawRadiusPct(JIGSAW_SMALL_PX)).toBe(JIGSAW_RADIUS_PCT);
    expect(jigsawRadiusPct(JIGSAW_SMALL_PX - 1)).toBe(JIGSAW_RADIUS_SMALL_PCT);
    expect(JIGSAW_RADIUS_SMALL_PCT).toBeLessThan(JIGSAW_RADIUS_PCT);
  });
});

describe("W7R2 · landlord 大小王身份多通道(9px 缎带不是唯一通道)", () => {
  const jokerIds: number[] = [];
  for (let id = 0; id < 56 && jokerIds.length < 2; id++) if (isJoker(id)) jokerIds.push(id);

  it("牌堆里能找到大小王两张", () => {
    expect(jokerIds.length).toBe(2);
  });

  it("宽牌:金银框 + 立绘 + 角标 + 缎带四通道齐活", () => {
    for (const id of jokerIds) {
      const html = cardFaceArtHTML(id, 80);
      expect(html).toMatch(/ldv-frame-(big|small)/);
      expect(html).toContain("ldv-joker");
      expect(html).toContain("ld-c-i");
      expect(html).toContain("ldv-kribbon");
    }
  });

  it("窄牌砍掉缎带后,金银框 + 立绘 + 角标三通道仍在(身份不靠 9px 小字)", () => {
    for (const id of jokerIds) {
      const html = cardFaceArtHTML(id, 24);
      expect(html).not.toContain("ldv-kribbon");
      expect(html).toMatch(/ldv-frame-(big|small)/);
      expect(html).toContain("ldv-joker");
      expect(html).toContain("ld-c-i");
    }
  });
});
