/**
 * 1.3 窗口 1 · 第 3 轮(收官)视觉测试员新增的机器化回归钉子。
 *
 * 收官轮重点不是重钉 r1/r2 已固化的契约(那些由 window1-visual-r1.test.ts /
 * window1-visual-r1-fix.test.ts / window1-visual-r2.test.ts / window1-visual-r2-fix.test.ts
 * 继续看守),而是把三类"跨款一致性"钉成契约,防后续轮次无审查漂移:
 *   A. 织物语言跨款一致 —— .mj-board 与 .hc-table 两处桌面织纹同 45°/6px/12px 节距、
 *      alpha ≤4% 红线、层序(织纹在底渐变之前)与静态性;且 6px/12px 桌面织纹全窗恰 2 处
 *      (4B 围棋等密度上限最低的款不许再被复制进去)。
 *   B. 装饰/粒子预算上限 —— orb 贴片 240 / snake 色岛 48 + 贴片 360 / combo 彩带 20,
 *      防未来"加料"轮次悄悄抬预算伤低端机。
 *   C. kit 光照左上约定抽查 —— kit drawCoin 高光斑与 star-estate coinSVG 高光锚均落左上象限。
 *
 * 只读源码与纯函数,不改绘制实现;报告见 docs/qa/1.3-window1-round3-tester.md。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFETTI_COUNT } from "./combo-clash/art";
import { coinSVG } from "./star-estate/art";

const ROOT = join(__dirname, "..", "..");

function src(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const WINDOW1_GAMES = [
  "orb-arena",
  "snake-royale",
  "block-drop",
  "combo-clash",
  "mahjong-bloom",
  "star-estate",
  "hero-cards",
  "weiqi-garden",
  "flight-chess",
] as const;

/** 桌面织纹(6px/12px 节距)的统一正则;抵押纹等 4px/8px 状态语义层不在此列 */
const WEAVE_RE = /repeating-linear-gradient\(45deg,rgba\(([\d ,.]+)\) 0 6px,transparent 6px 12px\)/g;

describe("R3-A · 织物语言跨款一致(.mj-board ↔ .hc-table)", () => {
  const mj = src("src/games/mahjong-bloom/index.ts");
  const hc = src("src/games/hero-cards/index.ts");
  const mjRule = /\.mj-board\{[^}]*\}/s.exec(mj)?.[0] ?? "";
  const hcRule = /\.hc-table\{[^}]*\}/s.exec(hc)?.[0] ?? "";

  it("两处桌面织纹都在,且 45° 角与 0 6px / transparent 6px 12px 节距逐字一致", () => {
    expect(mjRule).toMatch(/repeating-linear-gradient\(45deg,rgba\([\d ,.]+\) 0 6px,transparent 6px 12px\)/);
    expect(hcRule).toMatch(/repeating-linear-gradient\(45deg,rgba\([\d ,.]+\) 0 6px,transparent 6px 12px\)/);
  });

  it("两处织纹 alpha 均 ≤ 0.04(宪法织物暗纹红线)", () => {
    for (const rule of [mjRule, hcRule]) {
      const m = /repeating-linear-gradient\(45deg,rgba\([\d ]+,[\d ]+,[\d ]+,(\.\d+|0\.\d+)\)/.exec(rule);
      expect(m, "织纹缺失或颜色不是 rgba 形式").toBeTruthy();
      expect(parseFloat(m![1]), "织纹 alpha 超过 4% 红线").toBeLessThanOrEqual(0.04);
    }
  });

  it("织纹均为多重背景第一层:mj 在毛毡 radial 之前、hc 在纸色 linear 之前", () => {
    expect(mjRule.indexOf("repeating-linear-gradient")).toBeGreaterThan(-1);
    expect(mjRule.indexOf("radial-gradient")).toBeGreaterThan(mjRule.indexOf("repeating-linear-gradient"));
    expect(hcRule.indexOf("repeating-linear-gradient")).toBeGreaterThan(-1);
    expect(hcRule.indexOf("linear-gradient(180deg")).toBeGreaterThan(hcRule.indexOf("repeating-linear-gradient"));
  });

  it("织纹所在规则纯静态(不含 animation/transition 声明)", () => {
    expect(mjRule).not.toMatch(/animation|transition/);
    expect(hcRule).not.toMatch(/animation|transition/);
  });

  it("6px/12px 桌面织纹全窗恰 2 处——不许被复制进围棋等密度上限最低的款", () => {
    let count = 0;
    const perGame: string[] = [];
    for (const g of WINDOW1_GAMES) {
      const text = src(`src/games/${g}/index.ts`);
      const hits = text.match(WEAVE_RE)?.length ?? 0;
      count += hits;
      if (hits > 0) perGame.push(`${g}:${hits}`);
    }
    expect(perGame.sort()).toEqual(["hero-cards:1", "mahjong-bloom:1"]);
    expect(count).toBe(2);
  });
});

describe("R3-B · 装饰/粒子预算上限(防后续轮次悄悄抬预算)", () => {
  it("orb-arena 贴片层预算恰 240 件/帧", () => {
    expect(src("src/games/orb-arena/art.ts")).toMatch(/let budget = 240;/);
  });

  it("snake-royale 色岛预算恰 48 枚/帧、贴片预算恰 360 件/帧", () => {
    const text = src("src/games/snake-royale/art.ts");
    expect(text).toMatch(/let islandBudget = 48;/);
    expect(text).toMatch(/let budget = 360;/);
  });

  it("combo-clash 彩带封顶 CONFETTI_COUNT ≤ 20", () => {
    expect(CONFETTI_COUNT).toBeLessThanOrEqual(20);
    expect(CONFETTI_COUNT).toBeGreaterThan(0);
  });
});

describe("R3-C · kit 光照左上约定抽查", () => {
  it("kit drawCoin 高光斑落左上象限(x/y 偏移均为负)", () => {
    expect(src("src/art/kit/props.ts")).toMatch(/ellipse\(-r \* 0\.32 \* squash, -r \* 0\.42/);
  });

  it("star-estate coinSVG 径向渐变高光锚 cx/cy 均 <50%(左上)", () => {
    const svg = coinSVG();
    const m = /radialGradient id="[^"]+" cx="(\d+)%" cy="(\d+)%"/.exec(svg);
    expect(m, "coinSVG 高光渐变锚缺失").toBeTruthy();
    expect(parseInt(m![1], 10)).toBeLessThan(50);
    expect(parseInt(m![2], 10)).toBeLessThan(50);
  });
});

describe("R3-D · 收官回归猎手钉子", () => {
  it("hc-table 木沿 box-shadow(#EBD2B4)未被织纹改动破坏——织纹暖褐色的派生锚仍在", () => {
    const rule = /\.hc-table\{[^}]*\}/s.exec(src("src/games/hero-cards/index.ts"))?.[0] ?? "";
    expect(rule).toMatch(/box-shadow:inset 0 0 0 2px #EBD2B4/);
  });

  it("star-estate 抵押纹 .se-tile-mort 保持状态语义层(absolute 覆盖层、4px/8px 节距),不与桌面织纹混同", () => {
    const rule = /\.se-tile-mort\{[^}]*\}/s.exec(src("src/games/star-estate/index.ts"))?.[0] ?? "";
    expect(rule).toMatch(/position:absolute;inset:0/);
    expect(rule).toMatch(/repeating-linear-gradient\(45deg,rgba\([\d ,.]+\) 0 4px,transparent 4px 8px\)/);
  });
});
