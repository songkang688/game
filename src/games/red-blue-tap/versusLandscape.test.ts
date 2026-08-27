/**
 * 红蓝点点 · 横过来拿，双人对战与「点到手软」有一半的键在屏幕外
 * （1.2 窗口5 · 第 3 轮 · 档B 学习优化员，本轮自查新记）。
 *
 * `W5-B-02` 判过一次阻断：320×640 上一侧竖排四颗 72px 的键，第 4 颗掉出屏外，
 * 而这一条链上**没有任何可滚容器**，够不着就是真的够不着。当时的修法是
 * `padLayout()` 在「又窄又矮」那一档收回 2×2 并把边长降到 `KEY_TIGHT_PX`。
 *
 * **横过来拿是同一件事的第三种形状，而那次没盖到**：`vw > 420` 这一条先命中，
 * 直接返回 2 列 72px，两行就是 152px。我自己在真机上量到的（CDP，`elementFromPoint` 定案）：
 *
 * ```
 * 640×360 / 740×360 / 844×390 × 双人对战 / 点到手软   六格全中，每格 8 颗键坏 4 颗
 *   .rbt-vs 面板高 405，舞台看得见的那一段只有 264（84…348）
 *   第 1 行键 268–340 够得着；第 2 行键 348–420，整行在裁切线以下，命中 null
 *   .rbt-vs / .game-stage 都不滚 → 真手指也划不出来
 * ```
 *
 * 修法照搬 `W5-B-02` 自己那一手，只是换个方向：横过来拿的时候屏幕**宽得很**
 * （640…844）而矮得要命（360…390），所以把一侧的键从 2×2 摊成**一排 4 列**
 * 并降到 `KEY_TIGHT_PX` —— 键排从 152px 变成 56px，一次让出 96px，
 * 比缺的那 72px 还宽裕，不用去抠标题栏和脚注那几像素。
 *
 * 边长仍然 56px，高出 44px 的触屏底线；中间那条 `SIDE_GUTTER_PX` 隔离带一分不动
 * （一只手不许误触另一边，`W5-B-02` 定的规矩）。
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
  SHORT_LANDSCAPE_PX,
  SIDE_GUTTER_PX,
  TOUCH_MIN_PX,
  padHeightPx,
  padLayout,
  padWidthPx,
} from "./arena";
import { SLOT_COUNT } from "./rounds";

const dir = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(`${dir}arena.ts`, "utf8");

/** 真机量到的那一组：面板顶 84、舞台裁切线 348、键排上面那一截 184 */
const REAL = { vsTop: 84, clip: 348, aboveKeys: 268 - 84 };

/** 一侧最宽能有多少：整屏减掉隔离带与两侧内边距，再对半分 */
function sideWidthPx(vw: number, pad = 6): number {
  return Math.floor((vw - SIDE_GUTTER_PX - pad * 4) / 2);
}

describe("红蓝点点 · 横屏侧模式：8 颗键得整整齐齐都在屏幕里", () => {
  it("**先摆事实**：2×2 那一档在 640×360 上第 2 行整行掉在裁切线以下", () => {
    const twoByTwo = { columns: 2, keyPx: KEY_MIN_PX, gap: PAD_GAP_PX };
    expect(padHeightPx(twoByTwo, SLOT_COUNT), "两行 72px 的键").toBe(152);
    const bottom = REAL.vsTop + REAL.aboveKeys + padHeightPx(twoByTwo, SLOT_COUNT);
    expect(bottom, "真机量到第 2 行键的下沿").toBe(420);
    expect(bottom - REAL.clip, "掉在裁切线以下这么多").toBe(72);
  });

  it("横过来拿改成一排 4 列：键排一次矮 96px，整排落回裁切线里面", () => {
    for (const [vw, vh] of [[640, 360], [740, 360], [844, 390]] as const) {
      const layout = padLayout(vw, vh);
      expect(layout.columns, `${vw}×${vh} 还是竖着摞`).toBe(SLOT_COUNT);
      expect(layout.keyPx).toBe(KEY_TIGHT_PX);
      expect(padHeightPx(layout, SLOT_COUNT), "一排就是一行").toBe(KEY_TIGHT_PX);
      const bottom = REAL.vsTop + REAL.aboveKeys + padHeightPx(layout, SLOT_COUNT);
      expect(bottom, `${vw}×${vh} 键排下沿`).toBeLessThanOrEqual(REAL.clip);
    }
  });

  it("一排 4 列在最窄的那档横屏上也排得下（隔离带一分不动）", () => {
    // 568×320 是把 320×568 那台老机器横过来拿，本档见得到的最窄的一档横屏
    for (const vw of [568, 640, 740, 844]) {
      expect(padWidthPx(padLayout(vw, 360)), `${vw} 宽上一排 4 列摆不下`).toBeLessThanOrEqual(
        sideWidthPx(vw)
      );
    }
    const layout = padLayout(640, 360);
    expect(padWidthPx(layout)).toBeLessThanOrEqual(sideWidthPx(640));
    // 中间那条隔离带是 W5-B-02 定的规矩：一只手不许误触另一边
    expect(SIDE_GUTTER_PX).toBe(24);
    expect(ARENA_CSS).toContain(`min-width: ${SIDE_GUTTER_PX}px`);
  });

  it("热区没破线：横屏那一档的边长仍然高出 44px", () => {
    expect(padLayout(640, 360).keyPx).toBeGreaterThanOrEqual(TOUCH_MIN_PX);
    expect(KEY_TIGHT_PX).toBeGreaterThanOrEqual(TOUCH_MIN_PX);
  });

  it("竖屏那几档一个字节都没动（W5-B-02 那一手原样在）", () => {
    // 又窄又矮：仍旧 2×2 + 收一档
    expect(padLayout(320, 640)).toEqual({ columns: 2, keyPx: KEY_TIGHT_PX, gap: PAD_TIGHT_GAP_PX });
    // 窄而高：仍旧一竖排、键不缩水
    expect(padLayout(360, 740)).toEqual({ columns: 1, keyPx: KEY_MIN_PX, gap: PAD_GAP_PX });
    // 宽而高（平板 / 桌面）：仍旧 2×2、键不缩水
    expect(padLayout(1280, 900)).toEqual({ columns: 2, keyPx: KEY_MIN_PX, gap: PAD_GAP_PX });
  });

  it("样式里那条媒体查询按常量走，而且只在矮屏生效", () => {
    const at = source.indexOf("@media (max-height: ${SHORT_LANDSCAPE_PX}px)");
    expect(at, "样式上没人把键排摊成一排，CSS 和 padLayout() 就走散了").toBeGreaterThan(0);
    const block = source.slice(at, source.indexOf("\n}", at));
    expect(block).toContain("grid-template-columns: repeat(${SLOT_COUNT}, 1fr)");
    expect(block).toContain("${KEY_TIGHT_PX}px");
    expect(SHORT_LANDSCAPE_PX).toBeGreaterThanOrEqual(390);
    expect(SHORT_LANDSCAPE_PX).toBeLessThan(568);
  });
});
