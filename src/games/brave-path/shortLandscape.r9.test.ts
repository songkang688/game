/**
 * 勇者小路 · 三人组第 9 轮 测试修复员 B · N-32（无尽地牢战斗三钮折叠线下）。
 *
 * 修前实测（915×412，`.game-stage` clientHeight = 322）：无尽深渊第 1 层战斗裁 268，
 * 👊 攻击 / 🛡️ 防御 / 🍓 莓果 三个**每回合必点钮**整排折叠线下——滚一次点一次，
 * 一个回合的时长直接翻倍。
 *
 * 修法（r5 配方 E + r6 配方 G 合用）：战斗壳 `.bvp-battle` 在矮横屏改三栏——
 * 对手牌与自己牌左右对望（敌我状态一眼看全），战报和两行提示夹在中间限高自滚，
 * 三个必点钮独占底下一整行并 `position:sticky;bottom:0`（不透明底 + 上缘阴影）。
 * 战斗数值、莓果计数、层数生成、`combat.ts` 判定零触碰。
 *
 * 修后实测（915×412）：无尽战斗裁 0（原 268）、闯关战斗裁 12（原 38，同族顺带收干净），
 * 两处三钮均在首屏可点；412×915 / 1024×768 / 1280×800 裁 0。
 * 竖屏 390×844 的 11（🍓 出屏 7）是矮横屏分支够不着的老底，本轮未动、记在报告里。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 取一段媒体查询里的声明（到该查询的收尾大括号为止） */
function mediaBlock(head: string): string {
  const at = src.indexOf(head);
  expect(at, `找不到媒体查询 ${head}`).toBeGreaterThan(0);
  let depth = 0;
  for (let i = at; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(at, i + 1);
    }
  }
  throw new Error(`媒体查询 ${head} 没有配对的大括号`);
}

const SHORT = "@media (min-width:700px) and (max-height:560px)";

describe("N-32 · 矮横屏战斗壳三栏 + 必点钮 sticky", () => {
  it("媒体查询只咬 915×412 一族：竖屏三档与 1024×768 / 1280×800 都不进这条分支", () => {
    const hits = (w: number, h: number): boolean => w >= 700 && h <= 560;
    expect(src).toContain(SHORT);
    expect(hits(915, 412)).toBe(true);
    expect(hits(360, 640)).toBe(false);
    expect(hits(390, 844)).toBe(false);
    expect(hits(412, 915)).toBe(false);
    expect(hits(1024, 768)).toBe(false);
    expect(hits(1280, 800)).toBe(false);
  });

  it("战斗壳每块家当都有名字，CSS 才认得出谁去哪一栏", () => {
    expect(src).toContain('const wrap = el("div", "bvp-battle");');
    expect(src).toContain('el("div", "bvp-bar bvp-hud bvp-b-bar")');
    expect(src).toContain('foeCard.root.classList.add("bvp-b-foe");');
    expect(src).toContain('heroCard.root.classList.add("bvp-b-hero");');
    expect(src).toContain('el("div", "bvp-note bvp-b-fore", FORECAST_HINTS[guess])');
    expect(src).toContain('el("div", "bvp-log bvp-b-log")');
    expect(src).toContain('el("div", "bvp-note bvp-b-hint")');
    expect(src).toContain('el("div", "bvp-acts bvp-b-acts")');
  });

  it("三栏：敌我两张牌左右对望，战报在中间，必点钮独占底下一整行", () => {
    const block = mediaBlock(SHORT);
    expect(block).toContain(
      'grid-template-areas:"bar bar bar" "foe log hero" "foe fore hero" "foe hint hero" "acts acts acts"'
    );
    expect(block).toContain(".bvp-battle>.bvp-b-foe{grid-area:foe;}");
    expect(block).toContain(".bvp-battle>.bvp-b-hero{grid-area:hero;}");
  });

  it("必点钮 sticky 置底：不透明底 + 上缘阴影，战报滚起来它也不走（配方 E）", () => {
    const block = mediaBlock(SHORT);
    const rule = block.slice(block.indexOf(".bvp-battle>.bvp-b-acts{"));
    expect(rule).toContain("position:sticky;bottom:0;");
    expect(rule).toContain("background:linear-gradient(");
    expect(rule).toContain("box-shadow:0 -6px 10px -6px");
  });

  it("战报限矮自滚，不许再把必点钮顶下去", () => {
    const block = mediaBlock(SHORT);
    expect(block).toContain(".bvp-battle>.bvp-b-log{grid-area:log;margin:0;min-height:40px;");
    // 自滚是 .bvp-log 本体就有的，分支里只改高度不动 overflow
    expect(src).toContain("max-height:150px;overflow-y:auto;");
  });

  it("只收内边距和头像尺寸，字号一个不动（brave-path 字号红线在别的用例里钉着）", () => {
    const block = mediaBlock(SHORT);
    expect(block).not.toContain("font-size");
    expect(block).toContain(".bvp-battle>.bvp-fighter{padding:6px 9px;margin-bottom:0;}");
    expect(block).toContain(".bvp-battle>.bvp-fighter .bvp-face{width:34px;height:34px;}");
  });

  it("常规档一个像素都不动：三栏声明只出现在矮横屏媒体查询里", () => {
    const block = mediaBlock(SHORT);
    const outside = src.replace(block, "");
    expect(outside).not.toContain("grid-area:foe");
    expect(outside).not.toContain("position:sticky");
    expect(outside).not.toContain(".bvp-battle>");
  });
});
