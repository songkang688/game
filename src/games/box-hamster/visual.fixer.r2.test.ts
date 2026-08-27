/**
 * 推箱小仓鼠 · 窗口 6 第 2 轮监督修复员(C 档)· W6R2-01 钉子。
 *
 * A 档实测:双鼠 16px 灰度正面 3.5% 可分,但侧/背朝向只有 1.2–2.0%
 * (facing0 2.7 / facing1 2.0 / facing3 1.2),低于 3% 线。
 * 修法按 moleAccents 先例:hamsterSvg.ts 冻结不动,新增 kit
 * `src/art/kit/hamsterAccents.ts` 做叠加层,由 bhHamsterSvg 组合:
 *  - A 鼠:花冠放大 + 每瓣墨描边(侧脸往鼻尖侧偏 1.5);
 *  - B 鼠:呆毛加粗成「墨底+色芯」双笔道(facing3 数值镜像往背拱甩)
 *    + 仓鼠经典深色背纹(背影整条 / 侧脸背拱一小段 / 正脸不可见不画)。
 * 修后实测:idle 四朝向 7.03 / 5.08 / 4.69 / 5.08,push 侧向 5.86 / 5.08,
 * 全部 ≥3% 线。本文件把这条线与组合结构一起钉死。
 */
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  COWLICK_CREST_CORE_W,
  COWLICK_CREST_INK_W,
  CREST_DROP,
  FLOWER_CREST_ORBIT,
  FLOWER_CREST_PETAL_R,
  cowlickCrestGroup,
  dorsalStripeGroup,
  flowerCrestGroup,
  injectFigureAccents,
} from "../../art/kit/hamsterAccents";
import { hamsterSvg, type HamsterFacing } from "../../art/kit/hamsterSvg";
import { BH_HAMSTER_STYLES, bhHamsterSvg } from "./visual";

/** A 档同款量尺:白底合成 → 16×16 → 灰度(hamster svg 无 width,先补上) */
async function gray16(svg: string): Promise<Uint8Array> {
  const withSize = svg.replace("<svg ", `<svg width="64" height="64" `);
  const { data, info } = await sharp(Buffer.from(withSize))
    .flatten({ background: "#FFFFFF" })
    .resize(16, 16, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i++) out[i] = data[i * info.channels];
  return out;
}

/** 灰阶差 >24 的像素占比(%),与 A 档 / window6.r2.qa 同一口径 */
function diffPct(a: Uint8Array, b: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 24) n++;
  return (n / a.length) * 100;
}

describe("W6R2-01 · 双鼠全朝向 16px 灰度 ≥3% 线", () => {
  it("idle 四朝向全部 ≥3%(修后实测 7.03 / 5.08 / 4.69 / 5.08)", async () => {
    for (const f of [0, 1, 2, 3] as const) {
      const a = await gray16(bhHamsterSvg(0, f, "idle"));
      const b = await gray16(bhHamsterSvg(1, f, "idle"));
      expect(diffPct(a, b), `facing${f}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("推箱姿态的侧向(游戏里最常见的画面)也 ≥3%(实测 5.86 / 5.08)", async () => {
    for (const f of [1, 3] as const) {
      const a = await gray16(bhHamsterSvg(0, f, "push"));
      const b = await gray16(bhHamsterSvg(1, f, "push"));
      expect(diffPct(a, b), `facing${f} push`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("hamsterAccents kit · 叠加层本体规格", () => {
  it("花冠:五瓣全带墨描边 + 描边花芯,瓣径 3 / 轨道 5(比原 1.9/3.4 大一号)", () => {
    expect(FLOWER_CREST_PETAL_R).toBeGreaterThan(1.9);
    expect(FLOWER_CREST_ORBIT).toBeGreaterThan(3.4);
    const g = flowerCrestGroup(2, "#F4859F");
    expect(g).toContain('data-part="flower-crest"');
    expect((g.match(/stroke=/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect((g.match(/<circle /g) ?? []).length).toBe(6);
  });

  it("呆毛:墨底 + 色芯双笔道(墨底比原单笔 1.7 粗一倍以上),三根卷须各画两遍", () => {
    expect(COWLICK_CREST_INK_W).toBeGreaterThanOrEqual(1.7 * 2);
    expect(COWLICK_CREST_CORE_W).toBeGreaterThan(1.7);
    const g = cowlickCrestGroup(1, "#8FA0D6");
    expect(g).toContain('data-part="cowlick-crest"');
    expect((g.match(/<path /g) ?? []).length).toBe(6);
    expect(g).toContain(`stroke-width="${COWLICK_CREST_INK_W}"`);
    expect(g).toContain(`stroke-width="${COWLICK_CREST_CORE_W}"`);
  });

  it("呆毛 facing3 是数值镜像(不是 transform 翻转),与 facing1 产出不同", () => {
    const g1 = cowlickCrestGroup(1, "#8FA0D6");
    const g3 = cowlickCrestGroup(3, "#8FA0D6");
    expect(g1).not.toBe(g3);
    expect(g3).not.toContain("transform");
    expect(g3).not.toContain("scale(");
  });

  it("背纹:背影整条 / 侧脸一小段 / 正脸不可见不画", () => {
    expect(dorsalStripeGroup(0, "#C9CFEA")).toContain('data-part="dorsal-stripe"');
    expect(dorsalStripeGroup(1, "#C9CFEA")).toContain('data-part="dorsal-stripe"');
    expect(dorsalStripeGroup(3, "#C9CFEA")).toContain('data-part="dorsal-stripe"');
    expect(dorsalStripeGroup(2, "#C9CFEA")).toBe("");
  });

  it("背影(facing0)头冠下潜贴头,其余朝向不动", () => {
    expect(CREST_DROP[0]).toBeGreaterThan(0);
    expect(CREST_DROP[1]).toBe(0);
    expect(CREST_DROP[2]).toBe(0);
    expect(CREST_DROP[3]).toBe(0);
  });

  it("注入进 bhh-figure 组内(推箱前倾跟着转);没组 / 没闭标签则原样返回", () => {
    const svg = `<svg><g class="bhh-figure"><path/></g></svg>`;
    const out = injectFigureAccents(svg, [`<g data-part="x"/>`]);
    expect(out).toBe(`<svg><g class="bhh-figure"><path/><g data-part="x"/></g></svg>`);
    expect(injectFigureAccents(svg, [])).toBe(svg);
    expect(injectFigureAccents("<div>nope</div>", [`<g/>`])).toBe("<div>nope</div>");
  });
});

describe("bhHamsterSvg · 组合接线与冻结件不动", () => {
  it("A 鼠带花冠不带背纹;B 鼠带呆毛强化 + 背纹(背影);原头饰仍在底下", () => {
    const a = bhHamsterSvg(0, 0, "idle");
    expect(a).toContain('data-part="flower-crest"');
    expect(a).not.toContain('data-part="dorsal-stripe"');
    expect(a).toContain("bhh-topper-flower");
    const b = bhHamsterSvg(1, 0, "idle");
    expect(b).toContain('data-part="cowlick-crest"');
    expect(b).toContain('data-part="dorsal-stripe"');
    expect(b).toContain("bhh-topper-cowlick");
  });

  it("叠加层在 </g></svg> 之前(figure 组内),爪子之后(画在最上)", () => {
    const b = bhHamsterSvg(1, 1, "push");
    const crestAt = b.indexOf('data-part="cowlick-crest"');
    expect(crestAt).toBeGreaterThan(b.indexOf("bhh-paws"));
    expect(crestAt).toBeLessThan(b.lastIndexOf("</g></svg>"));
  });

  it("冻结 kit hamsterSvg 本体不含任何叠加层(证明是组合注入,不是改老文件)", () => {
    const raw = hamsterSvg({ style: BH_HAMSTER_STYLES[1], facing: 0 as HamsterFacing });
    expect(raw).not.toContain("data-part=");
  });
});
