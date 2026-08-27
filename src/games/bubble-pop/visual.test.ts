// 泡泡噗噗 · 1.3 视觉升级用例(只增不减):
// 平涂机器化断言 / 三层体积规格 / 特殊泡本体差异与去 emoji / 圈保留 /
// 波次只改展示延迟 / 补位果冻只改过渡 / token 落表 / bp-tiny 降级 / reduced / 热区。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BUBBLE_INNER_ARC,
  bubbleCrescentVisible,
} from "../../art/kit/bubbleSkin";
import { shade } from "../../art/kit/palette";
import {
  CHAIN,
  FALL_MS_PER_CELL,
  FALL_STAGGER_MS,
  POP_MS,
  REDUCED_FRAME_MS,
  SHIFT_MS,
  planCollapse,
} from "./collapse";
import { BOLT, CHAMELEON_BASE, FROZEN_OFFSET, HIDDEN_OFFSET, RAINBOW, STONE } from "./logic";
import {
  BP_BASE,
  BP_CHAMELEON_RING,
  BP_DECOR,
  BP_FROZEN_RING,
  BP_MARKS,
  BP_RAINBOW_CONIC,
  BP_TIMINGS,
  BP_TINY_PX,
  BP_TOKENS,
  bpBurstDelayMs,
  bpBurstLifeMs,
  bpCellSkin,
  bpIsTiny,
  bpVisualCss,
  bpWaveOf,
  bpWeedsSvg,
} from "./visual";

const CSS = bpVisualCss();
const INDEX_SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

/** 盘面上会出现的全部非空格子值 */
const ALL_VALUES = [
  0, 1, 2, 3, 4,
  FROZEN_OFFSET, FROZEN_OFFSET + 2, FROZEN_OFFSET + 4,
  HIDDEN_OFFSET, HIDDEN_OFFSET + 3,
  CHAMELEON_BASE, CHAMELEON_BASE + 1, CHAMELEON_BASE + 4,
  CHAIN, BOLT, STONE, RAINBOW,
];

describe("平涂整改:盘面上不许存在纯色平涂泡", () => {
  it("遍历全部格子值:每颗泡泡 background 都不是单一纯色", () => {
    for (const v of ALL_VALUES) {
      const s = bpCellSkin(v);
      expect(s.background, `v=${v} 没有渐变`).toContain("gradient(");
      expect(s.background).not.toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(s.background).not.toMatch(/^rgba?\([^)]*\)$/);
      expect(s.boxShadow, `v=${v} 没有立体阴影`).not.toBe("");
    }
  });

  it("普通五色:两层 radial 皮肤 + 底部内缘反光弧 + 双通道图案保留", () => {
    for (let v = 0; v < 5; v++) {
      const s = bpCellSkin(v);
      expect((s.background.match(/radial-gradient\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
      expect(s.boxShadow).toContain(BUBBLE_INNER_ARC);
      expect(s.mark).toBe(BP_MARKS[v]);
    }
  });

  it("明暗换算(+10/-12)与主高光位置(30%,24%)进了皮肤", () => {
    for (let v = 0; v < 5; v++) {
      const base = BP_BASE[v];
      const s = bpCellSkin(v);
      expect(s.background).toContain("circle at 30% 24%");
      expect(s.background).toContain(shade(base, 10));
      expect(s.background).toContain(`${shade(base, -12)} 94%`);
    }
  });

  it("空格子清空皮肤(bp-empty 兜底,不留残影)", () => {
    const s = bpCellSkin(-1);
    expect(s.background).toBe("");
    expect(s.boxShadow).toBe("");
    expect(s.pattern).toBe("");
    expect(s.mark).toBe("");
  });
});

describe("特殊泡:本体差异层,不再 emoji 直出", () => {
  it("彩虹泡:conic 保留 + 中心白星 SVG 替换 🌈 + 3000ms/圈旋转", () => {
    const s = bpCellSkin(RAINBOW);
    expect(s.rainbow).toBe(true);
    expect(s.background).toBe(BP_RAINBOW_CONIC);
    expect(s.pattern).toContain("<svg");
    expect(s.pattern).toContain("bp-star");
    expect(s.mark).toBe("");
    expect(INDEX_SRC).not.toMatch(/textContent = "🌈"/);
    expect(CSS).toContain("bpSpinRot");
    expect(CSS).toContain(`--bp-spin-ms:${BP_TIMINGS.rainbowSpinMs}ms`);
    expect(BP_TIMINGS.rainbowSpinMs).toBe(3000);
  });

  it("七种特殊件本体差异层齐活且两两不同(白星/闪电纹/铆钉/实心闪电/冰晶/灯笼/循环箭头)", () => {
    const patterns = [RAINBOW, CHAIN, STONE, BOLT, FROZEN_OFFSET, HIDDEN_OFFSET, CHAMELEON_BASE].map(
      (v) => bpCellSkin(v).pattern
    );
    for (const p of patterns) expect(p).toContain("<svg");
    expect(new Set(patterns).size).toBe(patterns.length);
    // 逐个验明正身
    expect(bpCellSkin(CHAIN).pattern).toContain("bp-zigzag");
    expect(bpCellSkin(STONE).pattern).toContain("bp-rivet");
    expect(bpCellSkin(BOLT).pattern).toContain("bp-boltfill");
    expect(bpCellSkin(FROZEN_OFFSET).pattern).toContain("bp-frost");
    expect(bpCellSkin(HIDDEN_OFFSET).pattern).toContain("bp-lantern");
    expect(bpCellSkin(CHAMELEON_BASE).pattern).toContain("bp-cycle");
  });

  it("连锁泡闪电纹:两段折线、白 65%、宽 2(规格四·补三)", () => {
    const p = bpCellSkin(CHAIN).pattern;
    expect(p).toContain("<polyline");
    expect(p).toContain('stroke="rgba(255,255,255,.65)"');
    expect(p).toContain('stroke-width="2"');
  });

  it("铁泡:金属纵纹 3px 条 + 铆钉两点,圈保留", () => {
    const s = bpCellSkin(STONE);
    expect(s.background).toContain("repeating-linear-gradient");
    expect(s.background).toContain("0 3px");
    expect((s.pattern.match(/bp-rivet/g) ?? []).length).toBe(2);
    expect(s.boxShadow).toContain("inset 0 0 0 2px");
  });

  it("冰冻圈 / 变色圈 box-shadow 原样保留(色觉双通道回归)", () => {
    expect(BP_FROZEN_RING).toBe("inset 0 0 0 3px #9FD6FF");
    expect(BP_CHAMELEON_RING).toBe("inset 0 0 0 3px #7FCF95");
    for (let i = 0; i < 5; i++) {
      expect(bpCellSkin(FROZEN_OFFSET + i).boxShadow).toContain(BP_FROZEN_RING);
      expect(bpCellSkin(CHAMELEON_BASE + i).boxShadow).toContain(BP_CHAMELEON_RING);
    }
  });
});

describe("波次破裂:只改展示延迟,结算不变", () => {
  it("波次上限 6:曼哈顿距离再远也只到第 5 波(200ms + 抖动)", () => {
    expect(BP_TIMINGS.waveMax).toBe(6);
    expect(bpWaveOf(0)).toBe(0);
    expect(bpWaveOf(3)).toBe(3);
    expect(bpWaveOf(5)).toBe(5);
    expect(bpWaveOf(99)).toBe(5);
    expect(bpBurstDelayMs(0, 0)).toBe(0);
    expect(bpBurstDelayMs(3, 0)).toBe(3 * BP_TIMINGS.waveStepMs);
    expect(bpBurstDelayMs(99, 1)).toBe(5 * BP_TIMINGS.waveStepMs + BP_TIMINGS.waveJitterMs);
  });

  it("抖动只在 0–12ms 之间,幽灵寿命覆盖三阶段", () => {
    expect(BP_TIMINGS.waveJitterMs).toBe(12);
    for (const r of [0, 0.25, 0.5, 0.999, 1, NaN]) {
      const d = bpBurstDelayMs(2, r) - 2 * BP_TIMINGS.waveStepMs;
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(BP_TIMINGS.waveJitterMs);
    }
    expect(bpBurstLifeMs(200)).toBeGreaterThanOrEqual(200 + BP_TIMINGS.swellMs + BP_TIMINGS.dropMs);
  });

  it("塌陷时间线常量原封不动(消除集合与结算时机沿用既有逻辑)", () => {
    expect(POP_MS).toBe(180);
    expect(FALL_MS_PER_CELL).toBe(70);
    expect(FALL_STAGGER_MS).toBe(20);
    expect(SHIFT_MS).toBe(120);
    expect(REDUCED_FRAME_MS).toBe(16);
    // runCollapse 仍旧先算 planCollapse、终态仍整片 copyInto,幽灵层只是旁挂装饰
    expect(INDEX_SRC).toContain("planCollapse(host.grid, COLS, host.gravityUp");
    expect(INDEX_SRC).toContain("copyInto(host.grid, plan.next)");
    expect(INDEX_SRC).toContain("spawnBursts(host, popped, origin)");
  });

  it("逻辑回归:同一盘面 planCollapse 的终态与波次无关", () => {
    const grid = [
      [0, -1, 1, -1, -1, -1, -1, -1],
      [-1, -1, 2, -1, -1, -1, -1, -1],
    ];
    const a = planCollapse(grid, 8, false);
    const b = planCollapse(grid, 8, false);
    expect(a.next).toEqual(b.next);
    expect(a.next[1][0]).toBe(0);
    expect(a.next[0][1]).toBe(1);
    expect(a.next[1][1]).toBe(2);
  });
});

describe("补位果冻与破裂三阶段时序表(四·补二)", () => {
  it("时序常量与规格一字不差,CSS 全部写成自定义属性", () => {
    expect(BP_TIMINGS.swellMs).toBe(50);
    expect(BP_TIMINGS.ringMs).toBe(120);
    expect(BP_TIMINGS.dropMs).toBe(240);
    expect(BP_TIMINGS.waveStepMs).toBe(40);
    expect(BP_TIMINGS.jellyMs).toBe(90);
    expect(BP_TIMINGS.decorFloatMs).toBe(8000);
    expect(BP_TIMINGS.comboMs).toBe(120);
    for (const prop of ["--bp-swell-ms:50ms", "--bp-ring-ms:120ms", "--bp-drop-ms:240ms", "--bp-jelly-ms:90ms", "--bp-float-ms:8000ms", "--bp-combo-ms:120ms"]) {
      expect(CSS).toContain(prop);
    }
  });

  it("果冻只改过渡样式:scaleY(.92)→1,塌陷终态渲染之后才加类", () => {
    expect(CSS).toContain("scaleY(.92)");
    expect(INDEX_SRC).toMatch(/host\.render\(\);\s*\n\s*jellyLand\(host, plan\);\s*\n\s*done\(\);/);
  });

  it("破裂三阶段:鼓 1.12 倍 / 薄膜白环 / 水珠用 --bp-splash", () => {
    expect(CSS).toContain("scale(1.12)");
    expect(CSS).toContain("bpBurstRing");
    expect(CSS).toContain("var(--bp-splash");
  });
});

describe("token 落表 / bp-tiny 降级 / reduced / 热区 / HUD", () => {
  it("六枚 --bp- 氛围 token 与规格表一字不差,并全部进样式表", () => {
    expect(BP_TOKENS["--bp-water-top"]).toBe("#DFF4FF");
    expect(BP_TOKENS["--bp-water-bottom"]).toBe("#C9E8F8");
    expect(BP_TOKENS["--bp-lightbeam"]).toBe("rgba(255,255,255,.08)");
    expect(BP_TOKENS["--bp-weed"]).toBe("#9FD9B8");
    expect(BP_TOKENS["--bp-pool"]).toBe("rgba(255,255,255,.5)");
    expect(BP_TOKENS["--bp-splash"]).toBe("rgba(190,230,255,.9)");
    for (const [k, v] of Object.entries(BP_TOKENS)) {
      expect(CSS, `${k} 不在样式表里`).toContain(`${k}:${v};`);
    }
  });

  it("泡径 < 32px:副高光与铆钉省略、纹样保留(降级分支)", () => {
    expect(BP_TINY_PX).toBe(32);
    expect(bpIsTiny(31.5)).toBe(true);
    expect(bpIsTiny(32)).toBe(false);
    expect(bpIsTiny(0)).toBe(false);
    expect(bubbleCrescentVisible(31)).toBe(false);
    expect(CSS).toContain(".bp-tiny .bp-cell::before");
    expect(CSS).toContain(".bp-tiny .bp-rivet { display: none; }");
    // 闪电纹这类纹样没有任何 bp-tiny 隐藏规则(纹样保留)
    expect(CSS).not.toContain(".bp-tiny .bp-zigzag");
  });

  it("reduced:旋转/波次/果冻/装饰气泡全停,静态体积保留", () => {
    const media = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(media).toContain(".bp-rainbow::after { animation: none; }");
    expect(media).toContain(".bp-burst-skin, .bp-burst-ring, .bp-burst-drop { animation: none; opacity: 0; }");
    expect(media).toContain(".bp-decor, .bp-jelly, .bp-combo { animation: none; }");
    // 运行期守卫:reduced 下这些类根本不加、装饰气泡根本不生成
    expect(INDEX_SRC).toMatch(/if \(prefersReduced\(\)\) return false;/);
    expect(INDEX_SRC).toMatch(/if \(prefersReduced\(\)\) return;\s*\n\s*for \(const d of BP_DECOR\)/);
    expect(INDEX_SRC).toMatch(/if \(!prefersReduced\(\)\) \{\s*\n\s*scoreEl\.classList\.add\("bp-combo"\)/);
  });

  it("热区一个像素不动:.bp-cell 布局规则沿用 1.2,装饰层全部 pointer-events:none", () => {
    expect(INDEX_SRC).toContain(
      ".bp-cell { aspect-ratio: 1; border: none; border-radius: 50%; cursor: pointer; transition: opacity .2s; padding: 0; font-size: clamp(12px, 3.6vw, 20px); display: flex; align-items: center; justify-content: center; min-width: 36px; }"
    );
    for (const cls of [".bp-pat", ".bp-burst", ".bp-beam", ".bp-weeds", ".bp-decor", ".bp-cell::before"]) {
      const rule = CSS.slice(CSS.indexOf(`\n${cls} `));
      expect(rule.slice(0, rule.indexOf("}")), `${cls} 缺 pointer-events`).toContain("pointer-events: none");
    }
  });

  it("HUD:徽章字号 ≥14px 保留,连消数字彩色描边跳动", () => {
    expect(INDEX_SRC).toContain(".bp-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #4FA3C7; box-shadow: 0 2px 6px rgba(100,170,210,.25); font-size: 14px; }");
    expect(INDEX_SRC).toContain("@media (max-width: 380px) { .bp-badge { font-size: 14px; }");
    expect(CSS).toContain(".bp-combo { animation: bpCombo var(--bp-combo-ms) ease-out; text-shadow:");
  });

  it("装饰气泡 3–5 颗且贴左右两边(避开盘面主体);水草/光柱程序化绘制", () => {
    expect(BP_DECOR.length).toBeGreaterThanOrEqual(3);
    expect(BP_DECOR.length).toBeLessThanOrEqual(5);
    for (const d of BP_DECOR) {
      const pct = parseFloat(d.left);
      expect(pct <= 12 || pct >= 86, `装饰气泡 ${d.left} 压到盘面主体了`).toBe(true);
    }
    expect(bpWeedsSvg()).toContain("<svg");
    expect(bpWeedsSvg()).toContain("currentColor");
    expect(CSS).toContain("var(--bp-lightbeam)");
    expect(CSS).toContain("var(--bp-weed)");
  });
});
