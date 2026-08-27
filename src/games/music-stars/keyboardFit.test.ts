/**
 * 音乐星星 · 星星键盘摆得下（1.2 窗口5 第 1 轮 · 档B）。
 *
 * 测试员 W5-B-03（严重）：360px 上开「🎹 自由弹奏」→「🎼 七声音阶」，
 * 八个键排开 428px 宽，「哆」在 [-68, -13]、「高哆」在 [373, 428]，
 * **两个键整个在屏幕外**，中间也没有横向滚动容器——主音和高八度的哆，
 * 最该让孩子按到的两个音，在手机上按不到。
 * 同一个根因还带出 W5-B-07：双声部关的键排比屏幕宽 11px，两端各切掉约 5px。
 *
 * 根因两条：`createStarBoard` 把 360 写死、从不量真实屏宽；
 * `keyLayout` 为了保 56px 热区，算出来的总宽允许超过传进去的 available。
 * 仓库里其实早有 `layoutFits()`，但**一个调用点都没有**。
 *
 * 这一份就钉这三件事：宽度按真实屏宽算、放不下时收到 44px 触屏底线为止、
 * 收到底线还放不下就挂上横向滚动。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installDom, type InstalledDom } from "./domStub";
import {
  KEY_MIN_GAP_PX,
  KEY_MIN_PX,
  KEY_TIGHT_GAP_PX,
  KEY_TOUCH_MIN_PX,
  keyLayout,
  layoutFits,
} from "./runtime";
import { DUET_MIN_GAP_PX } from "./touch";
import {
  BASE_SIZES,
  MST_CSS,
  SCORE_LEVEL_CONTENT_PX,
  SHORT_SCREEN_PX,
  SHORT_SIZES,
  SKY_MAX_PX,
  STAGE_VISIBLE_AT_720_PX,
  WRAP_PADDING_X,
  boardWidth,
  createStarBoard,
  shortScreenSavingPx,
} from "./ui";

/** 五声 / 七声两套音阶实际用的键数 */
const PENTATONIC = [60, 62, 64, 67, 69];
const HEPTATONIC = [60, 62, 64, 65, 67, 69, 71, 72];

function notesFor(midis: readonly number[]): Array<{ name: string; color: string }> {
  return midis.map((_, i) => ({ name: `${i}`, color: "#fff" }));
}

describe("音乐星星 · 键排的可用宽度按真实屏宽算", () => {
  it("boardWidth 减掉 .mst-wrap 的内边距，再按 .mst-sky 的上限夹住", () => {
    expect(boardWidth(360)).toBe(360 - WRAP_PADDING_X);
    expect(boardWidth(320)).toBe(320 - WRAP_PADDING_X);
    // 平板 / 桌面上不许把星星摊得比 .mst-sky 还宽
    expect(boardWidth(1280)).toBe(SKY_MAX_PX);
    expect(boardWidth(768)).toBe(SKY_MAX_PX);
    // 读不到屏宽就退回原来那套 360，行为不变
    expect(boardWidth(0)).toBe(SKY_MAX_PX);
    expect(boardWidth(Number.NaN)).toBe(SKY_MAX_PX);
  });
});

describe("音乐星星 · keyLayout 摆不下时逐级让步，但不破 44px", () => {
  it("宽松时的老行为一个字没变：56px 起步、有余量就铺宽", () => {
    const five = keyLayout(360, 5);
    expect(five.width).toBeGreaterThanOrEqual(KEY_MIN_PX);
    expect(five.gap).toBeGreaterThanOrEqual(KEY_MIN_GAP_PX);
    expect(layoutFits(five, 5, 360)).toBe(true);
    // 宽屏上封顶 84px，不会把星星摊成一块块大板砖
    expect(keyLayout(1200, 5).width).toBe(84);
  });

  it("双声部关（5 键 + 24px 间距）在 360px 上现在真的摆得下了", () => {
    for (const vw of [360, 390, 412]) {
      const available = boardWidth(vw);
      const duet = keyLayout(available, 5, DUET_MIN_GAP_PX);
      expect(duet.width, `${vw}px 的键破了触屏底线`).toBeGreaterThanOrEqual(KEY_TOUCH_MIN_PX);
      expect(duet.gap, `${vw}px 的间距被挤没了`).toBeGreaterThanOrEqual(DUET_MIN_GAP_PX);
      expect(layoutFits(duet, 5, available), `${vw}px 上双声部的键排还是超宽`).toBe(true);
    }
    // 反例：死守 56px 的老算法在 360px 上确实超宽（5×56 + 4×24 = 376），这才有测试员量到的两端各切 5px
    expect(5 * KEY_MIN_PX + 4 * DUET_MIN_GAP_PX).toBeGreaterThan(360);
  });

  it("320px 上双声部摆不下也不许挤掉那 24px 隔离——一根手指盖住两颗键就判不出和弦", () => {
    const available = boardWidth(320);
    const duet = keyLayout(available, 5, DUET_MIN_GAP_PX);
    expect(duet.gap).toBe(DUET_MIN_GAP_PX);
    expect(duet.width).toBe(KEY_TOUCH_MIN_PX);
    // 摆不下就摆不下，交给横向滚动，不拿间距去换
    expect(layoutFits(duet, 5, available)).toBe(false);
  });

  it("任何键数 × 任何屏宽：热区都不许掉到 44px 以下，间隙不许掉到 4px 以下", () => {
    for (const available of [240, 280, 300, 320, 340, 360, 390, 412, 768]) {
      for (let count = 1; count <= 8; count++) {
        for (const minGap of [KEY_MIN_GAP_PX, DUET_MIN_GAP_PX]) {
          const l = keyLayout(available, count, minGap);
          const at = `${available}px × ${count} 键 × ${minGap}px 间距`;
          expect(l.width, at).toBeGreaterThanOrEqual(KEY_TOUCH_MIN_PX);
          expect(l.gap, at).toBeGreaterThanOrEqual(KEY_TIGHT_GAP_PX);
          // 让步是有序的：只有 56px 真摆不下时才允许收到 56px 以下
          if (l.width < KEY_MIN_PX) {
            expect(layoutFits({ width: KEY_MIN_PX, gap: minGap }, count, available), `${at} 白收了`)
              .toBe(false);
          }
        }
      }
    }
  });

  it("七声音阶 8 个键在手机上怎么排都塞不进，收到底线为止", () => {
    const available = boardWidth(360);
    const eight = keyLayout(available, 8);
    expect(eight.width).toBe(KEY_TOUCH_MIN_PX);
    expect(layoutFits(eight, 8, available)).toBe(false);
    // 桌面上放得下，就不该退到底线
    const wide = keyLayout(SKY_MAX_PX * 2, 8);
    expect(wide.width).toBeGreaterThanOrEqual(KEY_MIN_PX);
    expect(layoutFits(wide, 8, SKY_MAX_PX * 2)).toBe(true);
  });
});

describe("音乐星星 · 摆不下就挂横向滚动，键一颗都不许被切在屏外", () => {
  let dom: InstalledDom;

  beforeEach(() => {
    dom = installDom();
  });

  afterEach(() => {
    dom.restore();
  });

  function make(midis: readonly number[], width: number, wideGap = false) {
    return createStarBoard({
      midis,
      notes: notesFor(midis),
      width,
      wideGap,
      onDown: () => {},
    });
  }

  it("五声 / 双声部在 360px 上都放得下，不挂滚动条", () => {
    for (const wideGap of [false, true]) {
      const b = make(PENTATONIC, boardWidth(360), wideGap);
      expect(b.fits, `wideGap=${wideGap}`).toBe(true);
      expect(b.buttons).toHaveLength(5);
      const keys = b.el.querySelector(".mst-keys") as { className: string } | null;
      expect(keys?.className).toBe("mst-keys");
      b.destroy();
    }
  });

  it("七声音阶放不下，键盘那一行改成横向可滚（原来是直接切掉两端的键）", () => {
    const b = make(HEPTATONIC, boardWidth(360));
    expect(b.fits).toBe(false);
    expect(b.buttons).toHaveLength(8);
    const keys = b.el.querySelector(".mst-keys") as { className: string } | null;
    expect(keys?.className).toContain("mst-keys-scroll");
    // 每一颗键的热区仍然不小于触屏底线
    for (const btn of b.buttons) {
      expect(Number.parseFloat(btn.style.width)).toBeGreaterThanOrEqual(KEY_TOUCH_MIN_PX);
    }
    b.destroy();
  });

  it("矮屏上竖向逐项收一档，省下的高度盖得住 360×720 上被裁掉的那一截", () => {
    // 测试员在 360×720 上量到：内容 741px、可视 618px，多出来的 123px 被硬裁
    const cut = SCORE_LEVEL_CONTENT_PX - STAGE_VISIBLE_AT_720_PX;
    expect(cut).toBe(123);
    expect(shortScreenSavingPx(), "压完还是盖不住被裁掉的那一截").toBeGreaterThanOrEqual(cut);
    // 每一项都必须真的变小，不许拿一个没动的数来凑
    for (const key of Object.keys(BASE_SIZES) as Array<keyof typeof BASE_SIZES>) {
      expect(SHORT_SIZES[key], `${key} 没有真的收一档`).toBeLessThan(BASE_SIZES[key]);
    }
  });

  it("矮屏那一档只收尺寸，热区一个都没动，而且压完还高就自己滚", () => {
    const at = MST_CSS.indexOf(`@media (max-height:${SHORT_SCREEN_PX}px)`);
    expect(at, "没有矮屏分支").toBeGreaterThan(-1);
    // 注释里会点名 .mst-btn 说明「热区不进这一档」，先剥掉注释再看真规则
    const block = MST_CSS.slice(at, MST_CSS.indexOf("@media", at + 10)).replace(/\/\*[\s\S]*?\*\//g, "");
    // 平台那一半（.game-stage 的 overflow:hidden）交给窗口1，本款先在自己壳里兜底
    expect(block).toContain("overflow-y:auto");
    expect(block).toContain("touch-action:pan-y");
    expect(block).toContain(`min-height:${SHORT_SIZES.sky}px`);
    // 按钮热区不许进这一档
    expect(block).not.toContain(".mst-btn");
    expect(block).not.toContain(".mst-chip");
    expect(block).not.toContain(".mst-choice");
    expect(block).not.toContain(".mst-drum");
    // 基准样式里 44px 的按钮热区原样还在
    expect(MST_CSS).toContain(".mst-btn{min-height:44px");
  });

  it("滚动那条样式真的能滚、而且不会顺手把按键的手势也抢走", () => {
    const at = MST_CSS.indexOf(".mst-keys-scroll{");
    expect(at, "没有横向滚动的样式").toBeGreaterThan(-1);
    const rule = MST_CSS.slice(at, MST_CSS.indexOf("}", at));
    expect(rule).toContain("overflow-x:auto");
    expect(rule).toContain("touch-action:pan-x");
    // 键自己仍然是 touch-action:none：按下去出声，不会变成一划就滚走
    const starAt = MST_CSS.indexOf("\n.mst-star{");
    const star = MST_CSS.slice(starAt, MST_CSS.indexOf("}", starAt));
    expect(star).toContain("touch-action:none");
  });
});
