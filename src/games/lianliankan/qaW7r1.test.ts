/**
 * 心心连连看 · 窗口 7 第 1 轮视觉验收补充用例(测试员,只增不减)。
 *
 * QA 点名:1.3 对 logic.ts 的改动只允许 LINK_HOLD/CLEAR 两个动画时长。
 * 这里把「只改了这两个」的边界钉死:两个新值 + 其余时序原值 + 判定常量原值。
 * 另钉牌面 SVG 化(专项①)与流星星尘预算(性能抽查)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLEAR_MS, LINK_HOLD_CALM_MS, LINK_HOLD_MS, SHAKE_MS } from "./logic";
import { DUST_COUNT, METEOR_MS, tileFaceSvg, maskFaceSvg } from "./art";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R1 · lianliankan QA 点名:logic.ts 只改两个动画时长", () => {
  it("LINK_HOLD_MS 调到 240(与流星光带同长,仍在规格 180–260ms 内)", () => {
    expect(LINK_HOLD_MS).toBe(240);
    expect(LINK_HOLD_MS).toBe(METEOR_MS);
    expect(LINK_HOLD_MS).toBeGreaterThanOrEqual(180);
    expect(LINK_HOLD_MS).toBeLessThanOrEqual(260);
  });

  it("CLEAR_MS 调到 200(翻转消散),其余时序原值未动", () => {
    expect(CLEAR_MS).toBe(200);
    expect(SHAKE_MS).toBe(120);
    expect(LINK_HOLD_CALM_MS).toBe(16);
  });
});

describe("窗口7 R1 · lianliankan 专项①:牌面 SVG 化", () => {
  it("index.ts 用 tileFaceSvg / maskFaceSvg 铺牌面(不再 emoji 直出)", () => {
    expect(SRC).toContain("tileFaceSvg(");
    expect(SRC).toContain("maskFaceSvg()");
  });

  it("牌面与面具 SVG 都带渐变与描边(体积三件套)", () => {
    const face = tileFaceSvg("🍎", 0);
    expect(face).toContain("<svg");
    expect(face).toContain("linearGradient");
    expect(face).toContain("stroke");
    const mask = maskFaceSvg();
    expect(mask).toContain("<svg");
    expect(mask).toContain("linearGradient");
  });
});

describe("窗口7 R1 · lianliankan 性能抽查:流星星尘预算", () => {
  it("星尘 ≤ 3 颗、光带 ≤ 240ms 自灭", () => {
    expect(DUST_COUNT).toBeLessThanOrEqual(3);
    expect(METEOR_MS).toBeLessThanOrEqual(240);
  });
});
