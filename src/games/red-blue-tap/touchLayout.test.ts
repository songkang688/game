/**
 * 红蓝点点 · 对战键盘在矮屏上的排布守门（1.2 窗口5 第 1 轮 · 档B）。
 *
 * 测试员 W5-B-02（阻断）：320×640 进双人对战，一侧第 4 颗键盒子是
 * top 607 / bottom 677——屏幕只有 640 高，键心已经在屏幕外，
 * 往上找了一路祖先也没有任何可滚容器，那一侧玩家等于少一颗键。
 * 边界是实测出来的：360×740 ✅ / 360×667 ✅ / 360×640 切 3px 勉强可点 / 320×640 ✗。
 *
 * 修法是只对「又窄又矮」的机器把每侧收回 2×2 并把键降一档到 56px。
 * 这一份钉住：宽屏与窄高屏的手感一个字不变、矮屏四颗键全在屏内、
 * 键永远不小于 44px、两侧那条隔离带一分不少。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ARENA_CSS,
  KEY_MIN_PX,
  KEY_TIGHT_PX,
  PAD_GAP_PX,
  PAD_TIGHT_GAP_PX,
  SHORT_SCREEN_PX,
  SIDE_GUTTER_PX,
  TOUCH_MIN_PX,
  VERSUS_CHROME_PX,
  padHeightPx,
  padLayout,
  padWidthPx,
} from "./arena";
import { SLOT_COUNT } from "./rounds";

const dir = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(`${dir}arena.ts`, "utf8");

/** 触屏热区底线 */
const TAP_MIN = 44;

/** 一侧键盘分得到多宽（`.rbt-vs` 与 `.rbt-vs-side` 在窄屏上各留 6px 内边距） */
function sideRoomPx(vw: number): number {
  return (vw - 6 * 2 - SIDE_GUTTER_PX) / 2 - 6 * 2;
}

describe("红蓝点点 · 双人对战的四颗键在矮屏上也按得到", () => {
  it("宽屏与窄高屏的排布一个字没变", () => {
    // 桌面：两列 72px，和 1.2 原样一致
    expect(padLayout(1280, 900)).toEqual({ columns: 2, keyPx: KEY_MIN_PX, gap: PAD_GAP_PX });
    // 360×740 / 360×667 测试员实测本来就够得着，维持一竖排、键不缩水
    expect(padLayout(360, 740)).toEqual({ columns: 1, keyPx: KEY_MIN_PX, gap: PAD_GAP_PX });
    expect(padLayout(360, SHORT_SCREEN_PX + 1).columns).toBe(1);
  });

  it("又窄又矮的机器收回 2×2，键降到 56px 但不破 44px 底线", () => {
    for (const [vw, vh] of [[320, 640], [360, 640], [360, 667], [320, 568]]) {
      const layout = padLayout(vw, vh);
      expect(layout.columns, `${vw}×${vh}`).toBe(2);
      expect(layout.keyPx, `${vw}×${vh}`).toBe(KEY_TIGHT_PX);
      expect(layout.keyPx, `${vw}×${vh} 的热区破了触屏底线`).toBeGreaterThanOrEqual(TAP_MIN);
    }
  });

  it("320×640 上四颗键全部落在屏幕里（这正是原来点不着的那一台）", () => {
    for (const [vw, vh] of [[320, 640], [360, 640], [320, 568]]) {
      const bottom = VERSUS_CHROME_PX + padHeightPx(padLayout(vw, vh), SLOT_COUNT);
      expect(bottom, `${vw}×${vh}：第 4 颗键还在屏幕外`).toBeLessThanOrEqual(vh);
    }
    // 反例：老排布（一竖排 4×72）在同一台机器上确实伸出屏外，这条用例不是空转的
    const old = padHeightPx({ columns: 1, keyPx: KEY_MIN_PX, gap: PAD_GAP_PX }, SLOT_COUNT);
    expect(VERSUS_CHROME_PX + old).toBeGreaterThan(640);
  });

  it("收成两列之后横着也塞得下，中间的隔离带一分没少", () => {
    for (const vw of [320, 360, 412]) {
      const layout = padLayout(vw, 640);
      expect(padWidthPx(layout), `${vw}px 一侧键盘放不下`).toBeLessThanOrEqual(sideRoomPx(vw));
    }
    expect(SIDE_GUTTER_PX).toBe(24);
    expect(ARENA_CSS).toContain(`min-width: ${SIDE_GUTTER_PX}px`);
  });

  it("CSS 里的矮屏分支和这份纯函数用的是同一批数字", () => {
    const at = ARENA_CSS.indexOf(`@media (max-width: 420px) and (max-height: ${SHORT_SCREEN_PX}px)`);
    expect(at, "矮屏分支不见了").toBeGreaterThan(-1);
    const block = ARENA_CSS.slice(at, ARENA_CSS.indexOf("@media", at + 10));
    expect(block).toContain(`grid-template-columns: repeat(2, 1fr); gap: ${PAD_TIGHT_GAP_PX}px`);
    expect(block).toContain(`min-width: ${KEY_TIGHT_PX}px; min-height: ${KEY_TIGHT_PX}px`);
    // 矮屏分支必须排在窄屏分支后面，否则被后者覆盖回一竖排
    expect(ARENA_CSS.indexOf("@media (max-width: 420px) {")).toBeLessThan(at);
    // 隔离带不许在矮屏分支里被顺手改小
    expect(block).not.toContain("rbt-vs-gap");
    // 常量本身也钉住，免得哪天被调到 44px 以下
    expect(source).toContain(`export const KEY_TIGHT_PX = ${KEY_TIGHT_PX}`);
    expect(KEY_TIGHT_PX).toBeGreaterThanOrEqual(TAP_MIN);
    expect(KEY_TIGHT_PX).toBeLessThan(KEY_MIN_PX);
  });

  it("对战屏顶上那两颗（返回、换模式）也得够 44px", () => {
    // 复审时用 elementFromPoint 逐个量热区，这两颗实测只有 34px 高，
    // 是这一款仅有的两处破底线的热区
    expect(TOUCH_MIN_PX).toBe(TAP_MIN);
    const at = ARENA_CSS.indexOf(".rbt-vs-back, .rbt-vs-mode {");
    const decl = ARENA_CSS.slice(at, ARENA_CSS.indexOf("\n", at));
    expect(decl).toContain(`min-height: ${TOUCH_MIN_PX}px`);
    expect(decl).toContain("box-sizing: border-box");
    // 抬高之后文字得居中，不然贴着上边更难按
    expect(decl).toContain("align-items: center");
    // 矮屏那一档不许把它又收回去
    const short = ARENA_CSS.slice(ARENA_CSS.indexOf(`@media (max-width: 420px) and (max-height: ${SHORT_SCREEN_PX}px)`));
    expect(short).not.toMatch(/\.rbt-vs-(back|mode)[^{]*\{[^}]*min-height/);
  });
});
