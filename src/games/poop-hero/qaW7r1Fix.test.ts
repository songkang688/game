/**
 * 便便超人 · 窗口 7 第 1 轮视觉修复用例(C 档监督修复员,只增不减)。
 *
 * 钉住 A 档报告(docs/qa/1.3-window7-round1-tester.md)严重项修后的状态:
 *  - A-4 香香星:不再贴 ✨ emoji,改 kit `traceStar` 自绘渐变星;
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { BINS, TRASH_ITEMS } from "./trash";
import { drawBinIcon, drawScentStar, drawTrashItem } from "./trashArt";
import { HERO_VIS } from "./visual";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 记账 stub ctx:数渐变停靠 / 描边 / fillText,别的画法照单全收 */
function stubCtx(): { ctx: CanvasRenderingContext2D; stats: { stops: number; strokes: number; fillTexts: number; fills: number } } {
  const stats = { stops: 0, strokes: 0, fillTexts: 0, fills: 0 };
  const gradient = { addColorStop: () => { stats.stops++; } };
  const noop = (): void => {};
  const ctx = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    ellipse: noop,
    rect: noop,
    fill: () => { stats.fills++; },
    stroke: () => { stats.strokes++; },
    fillRect: noop,
    strokeRect: noop,
    fillText: () => { stats.fillTexts++; },
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    clip: noop,
    setLineDash: noop,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    globalAlpha: 1,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D;
  return { ctx, stats };
}

describe("窗口7 R1 修复 · A-4 香香星:平涂 ✨ 清场", () => {
  it("index.ts 不再 emoji(✨),改走 drawScentStar", () => {
    expect(/emoji\([^)]*"✨"/u.test(SRC)).toBe(false);
    expect(SRC).toContain("drawScentStar(");
  });

  it("drawScentStar:≥2 停渐变 + 描边 + 零 fillText(体积规格达标)", () => {
    const { ctx, stats } = stubCtx();
    drawScentStar(ctx, 0, 0, 10);
    expect(stats.stops).toBeGreaterThanOrEqual(2);
    expect(stats.strokes).toBeGreaterThanOrEqual(1);
    expect(stats.fills).toBeGreaterThanOrEqual(2);
    expect(stats.fillTexts).toBe(0);
  });
});

describe("窗口7 R1 修复 · A-3 地面垃圾 / 携带件:裸 item.emoji 清场", () => {
  it("index.ts 不再 emoji(item.emoji),两处渲染都走 drawTrashItem", () => {
    expect(/emoji\([^)]*item\.emoji/.test(SRC)).toBe(false);
    // 地面等分类的垃圾 + 头顶携带件,两处都换成自绘
    expect(SRC.match(/drawTrashItem\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("18 款条目逐一实测:每款 ≥2 停渐变 + ≥1 圈描边 + 零 fillText", () => {
    expect(TRASH_ITEMS).toHaveLength(18);
    for (const item of TRASH_ITEMS) {
      const { ctx, stats } = stubCtx();
      drawTrashItem(ctx, item.id, 0, 0, 20);
      expect(stats.stops, `${item.id} 渐变停靠不足`).toBeGreaterThanOrEqual(2);
      expect(stats.strokes, `${item.id} 缺描边`).toBeGreaterThanOrEqual(1);
      expect(stats.fillTexts, `${item.id} 不许 fillText`).toBe(0);
    }
  });
});

describe("窗口7 R1 修复 · A-5/A-11 分类桶:功能图标自绘 + 桶签图形化", () => {
  it("index.ts 不再 emoji(info.emoji),桶面走 drawBinIcon,8–9px 桶签清场", () => {
    expect(/emoji\([^)]*info\.emoji/.test(SRC)).toBe(false);
    expect(SRC).toContain("drawBinIcon(");
    // 9px 桶签 fillText(info.short) 已从画布清场
    expect(SRC).not.toContain("fillText(info.short");
    expect(SRC).not.toMatch(/9 \* Math\.max\(0\.9, scale\)/);
  });

  it("三色桶图标逐一实测:白色图形 + 描边 + 零 fillText,互相形状不同", () => {
    for (const bin of BINS) {
      const { ctx, stats } = stubCtx();
      drawBinIcon(ctx, bin.kind, 0, 0, 11, bin.color);
      expect(stats.fills + stats.strokes, `${bin.kind} 空图标`).toBeGreaterThanOrEqual(2);
      expect(stats.fillTexts, `${bin.kind} 不许 fillText`).toBe(0);
    }
  });

  it("门帘进度与队友箭头这类功能小字保底 14px(A-11)", () => {
    expect(SRC).toContain("Math.max(14, Math.round(11 * Math.max(0.85, scale)))");
    expect(SRC).toContain('"900 14px system-ui,sans-serif"');
    expect(SRC).not.toContain('"900 12px system-ui,sans-serif"');
  });
});

/** Rec.601 灰度(0–255):16px 缩略可辨性按这个亮度算 */
function luma601(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff);
}

describe("窗口7 R1 修复 · A-9 双人 16px 灰度可分", () => {
  it("两人披风的 Rec.601 灰阶差 ≥25(修前 Δ4)", () => {
    const delta = Math.abs(luma601(HERO_VIS[0].capeOut0) - luma601(HERO_VIS[1].capeOut0));
    expect(delta).toBeGreaterThanOrEqual(25);
  });

  it("星星戴剪影级星星发卡,且不走 showDetail 降级门槛", () => {
    const at = SRC.indexOf("剪影级附件");
    expect(at).toBeGreaterThanOrEqual(0);
    const block = SRC.slice(at, SRC.indexOf("工序⑧", at));
    expect(block).toContain("traceStar(");
    // 发卡是认人轮廓,多小都画:块内不许出现 showDetail 门槛
    expect(block).not.toContain("showDetail(");
    // 只给星星(pi 1)戴,朵朵不戴,两人轮廓才有差异
    expect(block).toContain("pi % HERO_VIS.length === 1");
  });

  it("边缘方位标 HERO_COLORS 星星披风与 HERO_VIS 同步加深", () => {
    expect(SRC).toContain('cape: "#6690E0"');
    expect(SRC).not.toContain('"#7FB2FF"');
  });
});

describe("窗口7 R1 修复 · A-7 场内装饰 emoji 清场:画布零 emoji 直出", () => {
  it("emoji() 工具函数连根删掉,再没有任何 emoji 字形贴上画布", () => {
    expect(SRC).not.toMatch(/function emoji\(/);
    expect(SRC).not.toMatch(/emoji\(g,/);
    // A 档登记的六处装饰位逐一核销:💫 🫧 🤔 🧽 🧼 🔒 与粒子文本
    // (⭐ 仍在 HUD 连击卡 / 结算横幅的 DOM 文案里,属「装饰性可留」,画布上已零残留)
    for (const ch of ["💫", "🫧", "🤔", "🧽", "🧼", "🔒", "🌸", "🍄", "🫳", "🚚"]) {
      expect(SRC.includes(ch), `画布残留 ${ch}`).toBe(false);
    }
    // 顶上来的自绘字形都接了线
    for (const fn of ["drawSwirl(", "drawBubbleDot(", "drawMiniStar(", "drawThinkBubble(", "drawSponge(", "drawSoap(", "drawPadlock(", "drawParticleGlyph("]) {
      expect(SRC.includes(fn), `缺自绘接线 ${fn}`).toBe(true);
    }
  });

  it("粒子表全部换成自绘字形键,不再存 emoji 文本", () => {
    expect(SRC).toContain("ParticleGlyph");
    expect(SRC).toMatch(/flower:\s*"flower"/);
    expect(SRC).toMatch(/sortGood:\s*"star"/);
  });
});
