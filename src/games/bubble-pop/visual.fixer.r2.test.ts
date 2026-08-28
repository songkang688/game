/**
 * 泡泡噗噗 · 窗口 6 第 2 轮监督修复员(C 档)· B 档建议级清偿钉子。
 *
 * B 档第 1 轮登记(建议级,两轮未动):水下场景的光柱 .08 在 360px 上
 * 近不可见、池壁单层白圈偏平。本轮清偿:
 *  1) 光柱 --bp-lightbeam .08 → .12,并给两道柱一支 2° 慢摆
 *     (skewX -17° ↔ -15°,B 柱负半周期延迟 = 反相),reduced 静止回 -16°;
 *  2) 池壁改双层描边:外 3px 白 .5(原样)+ 内 1px #9FD6FF .35;
 *  3) 宽屏 .bp-cell min-width:36px 一个像素不动(热区红线复查)。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BP_TIMINGS, BP_TOKENS, bpVisualCss } from "./visual";

const CSS = bpVisualCss();

describe("光柱:亮度 .12 + 双柱 2° 反相慢摆,reduced 静止", () => {
  it("token 抬到 .12 并落进样式表", () => {
    expect(BP_TOKENS["--bp-lightbeam"]).toBe("rgba(255,255,255,.12)");
    expect(CSS).toContain("--bp-lightbeam:rgba(255,255,255,.12);");
  });

  it("慢摆 5200ms:振幅 2°(-17° ↔ -15°),B 柱负半周期延迟(反相)", () => {
    expect(BP_TIMINGS.beamSwayMs).toBe(5200);
    expect(CSS).toContain(`--bp-beam-ms:${BP_TIMINGS.beamSwayMs}ms;`);
    expect(CSS).toContain("animation: bpBeamSway var(--bp-beam-ms) ease-in-out infinite alternate;");
    expect(CSS).toContain("@keyframes bpBeamSway { from { transform: skewX(-17deg); } to { transform: skewX(-15deg); } }");
    expect(CSS).toContain(".bp-beam-b { left: 58%; width: 11%; animation-delay: calc(var(--bp-beam-ms) * -.5); }");
  });

  it("reduced:光柱摆动停,静态角回基线 -16°", () => {
    const media = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(media).toContain(".bp-beam { animation: none; }");
    // 基线角仍在 .bp-beam 本体规则里,animation:none 后由它接管
    expect(CSS).toMatch(/\.bp-beam \{[^}]*transform: skewX\(-16deg\);/);
  });
});

describe("池壁双层描边", () => {
  it("外 3px 白 .5(原样)+ 内 1px #9FD6FF .35(叠在白圈内侧)", () => {
    expect(BP_TOKENS["--bp-pool"]).toBe("rgba(255,255,255,.5)");
    expect(CSS).toContain(
      "box-shadow: inset 0 0 0 3px var(--bp-pool), inset 0 0 0 4px rgba(159,214,255,.35);"
    );
  });
});

describe("热区红线复查(修复不彻底防线)", () => {
  it("宽屏 .bp-cell min-width:36px 一个像素不动", () => {
    const src = readFileSync(join(__dirname, "index.ts"), "utf8");
    expect(src).toContain("min-width: 36px;");
  });
});
