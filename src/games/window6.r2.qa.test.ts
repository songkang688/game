/**
 * 1.3 窗口 6 · A 档 · 第 2 轮视觉测试员 · 复验钉子(9 款范围)。
 *
 * 第 2 轮对账实测后,把第 1 轮修复(W6R1-01~06 / 12)的「修好状态」用
 * 与 A 档同一把 16px 灰度尺钉死到具体阈值,防后续轮回退:
 *  - brave-path 四件拾取物(徽章族 SVG)两两剪影可分,且 emoji 不回潮;
 *  - adventure-king 古堡主角 / 箱子参数化 SVG 两两可分,且 emoji 不回潮;
 *  - mole-pop 三种强化鼠不只是「都 ≥3%」,彼此之间也要拉得开(防同质化回退);
 *  - balloon-pop 特殊球几何徽记两两可分;
 *  - box-hamster 双鼠正面 16px 灰度保持 ≥3%(侧/背朝向偏弱已另行登记交 C 档);
 *  - 三款代表性反馈链(冒头预告→敲击→装备飞脱 / 鼓胀→白闪→裂片 / 鼓胀→圆环→水珠)
 *    的三段时序都是正数,reduced 一把闸的退化口径不悄悄变形。
 */
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { moleSvg } from "../art/kit/moleSvg";
import {
  drowseBoldGroup,
  flashCrestGroup,
  injectAccents,
  shieldSteelGroup,
} from "../art/kit/moleAccents";
import { mazeItemSvg, fxClassPlan } from "./brave-path/visual";
import { castleBoxSvg, castleHeroSvg } from "./adventure-king/visual";
import { kindBadgeSvg, BLP_TIMINGS } from "./balloon-pop/visual";
import { bhHamsterSvg } from "./box-hamster/visual";
import { BP_TIMINGS } from "./bubble-pop/visual";
import { MP_TIMING } from "./mole-pop/visual";

/** emoji 码点(与 qa1 系列同一口径) */
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

/** 把 width/height=100% 的 svg 撑到固定像素,sharp 才能栅格化 */
function sized(svg: string, px = 64): string {
  return svg.replace(/width="100%"/, `width="${px}"`).replace(/height="100%"/, `height="${px}"`);
}

/** A 档同款量尺:白底合成 → 16×16 → 灰度 */
async function gray16(svg: string): Promise<Uint8Array> {
  const { data, info } = await sharp(Buffer.from(sized(svg)))
    .flatten({ background: "#FFFFFF" })
    .resize(16, 16, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i++) out[i] = data[i * info.channels];
  return out;
}

/** 灰阶差 >24 的像素占比(%) */
function diffPct(a: Uint8Array, b: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 24) n++;
  return (n / a.length) * 100;
}

describe("窗口6 r2 tester · W6R1-03 复验钉子:brave-path 拾取物剪影", () => {
  const KINDS = ["key", "door", "lock", "exit"] as const;

  it("四件拾取物 SVG 都不含 emoji(修复不回潮)", () => {
    for (const k of KINDS) {
      const svg = mazeItemSvg(k);
      expect(EMOJI_RE.test(svg), k).toBe(false);
      expect(svg).toContain("<svg");
      expect(svg).toContain("stroke");
    }
  });

  it("四件拾取物两两 16px 灰度 diffPct ≥12%(实测 21.1–30.1%)", async () => {
    const grays = await Promise.all(KINDS.map((k) => gray16(mazeItemSvg(k))));
    for (let i = 0; i < KINDS.length; i++) {
      for (let j = i + 1; j < KINDS.length; j++) {
        expect(diffPct(grays[i], grays[j]), `${KINDS[i]} vs ${KINDS[j]}`).toBeGreaterThanOrEqual(12);
      }
    }
  });
});

describe("窗口6 r2 tester · W6R1-01 复验钉子:古堡主角/箱子", () => {
  it("castleHeroSvg / castleBoxSvg 均为参数化 SVG,无 emoji", () => {
    for (const svg of [castleHeroSvg(), castleBoxSvg()]) {
      expect(EMOJI_RE.test(svg)).toBe(false);
      expect(svg).toContain("<svg");
    }
  });

  it("主角 vs 箱子 16px 灰度 diffPct ≥20%(实测 31.6%)", async () => {
    const hero = await gray16(castleHeroSvg());
    const box = await gray16(castleBoxSvg());
    expect(diffPct(hero, box)).toBeGreaterThanOrEqual(20);
  });
});

describe("窗口6 r2 tester · W6R1-05/06 复验加钉:三种强化鼠彼此可分", () => {
  it("flash / shield / sleepy 两两 16px 灰度 diffPct ≥6%(实测 10.2–10.9%,防同质化回退)", async () => {
    const flash = await gray16(injectAccents(moleSvg({ sparkle: true, size: 64 }), [flashCrestGroup()]));
    const shield = await gray16(injectAccents(moleSvg({ gear: "shield", size: 64 }), [shieldSteelGroup()]));
    const sleepy = await gray16(injectAccents(moleSvg({ sleepy: true, size: 64 }), [drowseBoldGroup()]));
    expect(diffPct(flash, shield)).toBeGreaterThanOrEqual(6);
    expect(diffPct(flash, sleepy)).toBeGreaterThanOrEqual(6);
    expect(diffPct(shield, sleepy)).toBeGreaterThanOrEqual(6);
  });
});

describe("窗口6 r2 tester · W6R1-12 复验钉子:balloon-pop 几何徽记", () => {
  it("六种特殊球徽记两两 16px 灰度 diffPct ≥18%(实测 29.3–67.2%)", async () => {
    const kinds = ["iron", "gift", "twin", "chain", "cloud", "rainbow"] as const;
    const grays = await Promise.all(kinds.map((k) => gray16(kindBadgeSvg(k, 0))));
    for (let i = 0; i < kinds.length; i++) {
      for (let j = i + 1; j < kinds.length; j++) {
        expect(diffPct(grays[i], grays[j]), `${kinds[i]} vs ${kinds[j]}`).toBeGreaterThanOrEqual(18);
      }
    }
  });

  it("徽记本体不含 emoji(修复不回潮)", () => {
    for (const k of ["iron", "gift", "twin", "chain", "cloud", "rainbow"] as const) {
      expect(EMOJI_RE.test(kindBadgeSvg(k, 0)), k).toBe(false);
    }
  });
});

describe("窗口6 r2 tester · 双鼠可分保持线(box-hamster)", () => {
  it("A/B 鼠正面(facing 2)16px 灰度 diffPct ≥3%(实测 3.5%;侧/背 1.2–2.0% 已登记 W6R2-01 交 C 档)", async () => {
    const a = await gray16(bhHamsterSvg(0, 2));
    const b = await gray16(bhHamsterSvg(1, 2));
    expect(diffPct(a, b)).toBeGreaterThanOrEqual(3);
  });
});

describe("窗口6 r2 tester · 动效三段链时序表钉子", () => {
  it("mole-pop:冒头预告 → 敲击 → 装备飞脱/连击飘分 三段皆正数", () => {
    expect(MP_TIMING.peekMs).toBeGreaterThan(0);
    expect(MP_TIMING.bonkMs).toBeGreaterThan(0);
    expect(MP_TIMING.gearFlyMs).toBeGreaterThan(0);
    expect(MP_TIMING.comboPopMs).toBeGreaterThan(0);
  });

  it("balloon-pop:鼓胀 → 白闪 → 裂片 三段皆正数且总长 ≤400ms(不拖连点节奏)", () => {
    expect(BLP_TIMINGS.swellMs).toBeGreaterThan(0);
    expect(BLP_TIMINGS.flashMs).toBeGreaterThan(0);
    expect(BLP_TIMINGS.shardMs).toBeGreaterThan(0);
    expect(BLP_TIMINGS.swellMs + BLP_TIMINGS.flashMs + BLP_TIMINGS.shardMs).toBeLessThanOrEqual(400);
  });

  it("bubble-pop:鼓胀 → 圆环 → 水珠 三段皆正数", () => {
    expect(BP_TIMINGS.swellMs).toBeGreaterThan(0);
    expect(BP_TIMINGS.ringMs).toBeGreaterThan(0);
    expect(BP_TIMINGS.dropMs).toBeGreaterThan(0);
  });

  it("brave-path reduced 一把闸:抖动/点亮/彩纸关,飘字换原地静置(功能反馈不消失)", () => {
    const plan = fxClassPlan(true);
    expect(plan.shake).toBe("");
    expect(plan.dotLit).toBe("");
    expect(plan.confetti).toBe(false);
    expect(plan.float).toContain("bvp-float-still");
  });
});
