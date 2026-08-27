/**
 * 「甩到底之后调锅那五颗还点不点得着」（窗口5 第 2 轮档A 监督修复员，W5R2-F-A-06）。
 *
 * `pinCanvas()` 把画布按滚动量往下钉，让它恒占滚动视口的上半张，这样滑下去
 * 选颜色时画还在眼前。屏幕高的时候这是白赚的：390×844 上滚动视口 556px、
 * 画布 180px，钉住之后底下还剩 376px，调锅那一排整整齐齐露在外面。
 *
 * 可 320×568 上滚动视口只剩 284px。画布收到下限 180px 之后，钉住就吃掉其中 180px，
 * 底下只剩 104px——而调锅那一排本身就有 105px 高。孩子照最自然的那一下「一甩到底」，
 * 落点是 `scrollTop` 的最大值，此时调锅整排正好躺在画布底下：
 * CDP 实测 `elementFromPoint(键心)` 拿回来的是线稿里的 `<rect>`，
 * 倒入红 / 黄 / 蓝 / 白 / 黑 五颗**一颗都点不着**，而这一款的调色关就是靠这五颗兑色。
 *
 * 修法不是不让钉，是**钉之前先看底下还剩不剩得下后面最高的那一排**：
 * 剩得下照旧钉（高屏一个像素不变），剩不下就这一档不钉——画布跟着滚出去，
 * 反正在矮屏上「看得见画」和「够得着调锅」二选一时，够得着才是能不能过关。
 */
import { describe, expect, it } from "vitest";
import { canPinCanvas, pinCanvas } from "./ui";

describe("色号调锅在矮屏上甩到底也点得着", () => {
  describe("canPinCanvas：滚动视口在画布底下还剩不剩得下后面最高的那一排", () => {
    it("390×844 的实测尺寸：视口 556 / 画布 180 / 最高一排 105 —— 照旧钉", () => {
      expect(canPinCanvas(556, 180, 105)).toBe(true);
    });

    it("360×720 的实测尺寸：视口 436 / 画布 180 / 最高一排 105 —— 照旧钉", () => {
      expect(canPinCanvas(436, 180, 105)).toBe(true);
    });

    it("320×568 的实测尺寸：视口 284 / 画布 180 / 最高一排 105 —— 差 1px，这一档不钉", () => {
      expect(canPinCanvas(284, 180, 105)).toBe(false);
    });

    it("正好剩得下算剩得下，不多要一个像素", () => {
      expect(canPinCanvas(285, 180, 105)).toBe(true);
      expect(canPinCanvas(284.5, 180, 105)).toBe(false);
    });

    it("量不到（后面一排都没有 / 视口是 0）就照旧钉，不平白改高屏上的老行为", () => {
      expect(canPinCanvas(556, 180, 0)).toBe(true);
      expect(canPinCanvas(0, 180, 105)).toBe(true);
      expect(canPinCanvas(Number.NaN, 180, 105)).toBe(true);
    });
  });

  describe("pinCanvas：照 320×568 的实测层次搭一遍", () => {
    /** 照壳层真实层次搭的桩：`.game-stage` 只裁不滚，`.clf-wrap` 才是真滚的那一层 */
    type Box = { top: number; height: number };
    type Node = {
      overflowY: string;
      parentElement: Node | null;
      ownerDocument?: Document;
      style: { transform?: string };
      children?: Node[];
      getBoundingClientRect: () => { top: number; height: number; bottom: number };
      addEventListener: (t: string, fn: () => void) => void;
      removeEventListener: (t: string, fn: () => void) => void;
    };
    const bound: Array<() => void> = [];
    const node = (overflowY: string, box: () => Box): Node => ({
      overflowY,
      parentElement: null,
      style: {},
      getBoundingClientRect: () => {
        const b = box();
        return { ...b, bottom: b.top + b.height };
      },
      addEventListener: (_t, fn) => void bound.push(fn),
      removeEventListener: (_t, fn) => void bound.splice(bound.indexOf(fn), 1),
    });
    const shiftOf = (el: Node): number =>
      Number(/translateY\(([-\d.]+)px\)/.exec(el.style.transform ?? "")?.[1] ?? 0);

    /**
     * 320×568 实测：壳层裁在 y=554，这一屏从 y=270 起，滚动视口 284px；
     * 画布收到下限 180px（`canvasBoxPx` 的地板），调锅那一排 105px 是后面最高的。
     * 整屏内容 695px，所以最多能滚 411px。
     */
    function build(portBottom: number) {
      const clip = node("hidden", () => ({ top: 88, height: portBottom - 88 }));
      const wrap = node("auto", () => ({ top: 270, height: portBottom - 270 }));
      const stage = node("visible", () => ({ top: 342 - scrolled + shiftOf(stage), height: 180 }));
      const legend = node("visible", () => ({ top: 528 - scrolled, height: 87 }));
      const chips = node("auto", () => ({ top: 621 - scrolled, height: 56 }));
      const tools = node("visible", () => ({ top: 683 - scrolled, height: 44 }));
      const mixer = node("visible", () => ({ top: 733 - scrolled, height: 105 }));
      const palette = node("auto", () => ({ top: 844 - scrolled, height: 74 }));
      wrap.parentElement = clip;
      wrap.children = [stage, legend, chips, tools, mixer, palette];
      for (const c of wrap.children) c.parentElement = wrap;
      const view = {
        getComputedStyle: (el: Node) => ({ overflowY: el.overflowY }),
        addEventListener: (_t: string, fn: () => void) => void bound.push(fn),
        removeEventListener: (_t: string, fn: () => void) => void bound.splice(bound.indexOf(fn), 1),
      };
      wrap.ownerDocument = { defaultView: view } as unknown as Document;
      stage.ownerDocument = wrap.ownerDocument;
      return { wrap, stage, mixer };
    }
    let scrolled = 0;
    const fire = (): void => bound.slice().forEach((fn) => fn());

    it("320×568 甩到底：画布不许压在调锅那一排上（就是 CDP 上那五颗点不着）", () => {
      bound.length = 0;
      scrolled = 0;
      const { wrap, stage, mixer } = build(554);
      const unpin = pinCanvas(wrap as unknown as HTMLElement, stage as unknown as HTMLElement);
      scrolled = 411;
      fire();
      const s = stage.getBoundingClientRect();
      const m = mixer.getBoundingClientRect();
      // 调锅整排此刻确实在滚动视口里露着
      expect(m.top).toBeGreaterThanOrEqual(270);
      expect(m.bottom).toBeLessThanOrEqual(554);
      // 画布不许盖到它头上
      expect(s.bottom).toBeLessThanOrEqual(m.top + 0.5);
      unpin();
    });

    it("390×844 那一档一个像素不变：照旧钉在滚动视口上沿", () => {
      bound.length = 0;
      scrolled = 0;
      const { wrap, stage } = build(826);
      const unpin = pinCanvas(wrap as unknown as HTMLElement, stage as unknown as HTMLElement);
      scrolled = 122;
      fire();
      expect(shiftOf(stage)).toBeGreaterThan(0);
      expect(stage.getBoundingClientRect().top).toBeCloseTo(270, 1);
      unpin();
    });

    it("拆监听之后位移归零，摘干净", () => {
      bound.length = 0;
      scrolled = 0;
      const { wrap, stage } = build(826);
      const unpin = pinCanvas(wrap as unknown as HTMLElement, stage as unknown as HTMLElement);
      scrolled = 122;
      fire();
      unpin();
      expect(bound).toHaveLength(0);
      expect(stage.style.transform).toBe("");
    });
  });
});
