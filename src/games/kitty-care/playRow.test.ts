/**
 * 萌猫小屋 · 挂上滚动条之后要把动手层送到孩子眼前
 * （1.2 窗口5 · 第 3 轮 · 档C，W5R3-C-02，阻断）。
 *
 * 第 2 轮 W5R2-FC-06 把提示行粘在了滚动口下沿，「这一关要干什么」于是滚到哪儿都看得见。
 * 那一修本身没问题，但它给提示行加了 `z-index:6`——比所有交互层的 `3` 都高，
 * 而孩子落地时 `scrollTop` 是 0，动手层排在小屋最底下，正好被它盖着。
 *
 * 真机实测（Chrome headless + CDP，命中一律 `document.elementFromPoint(键心)`）：
 *   360×640 第 188 关（三只猫 + 喂饭）：滚到 0% 处 0/5 颗食物够得着，50% 处 4/5，滚到底才 5/5；
 *     五颗食物键心命中的都是 `.ktc-msg`，`elementsFromPoint` 的栈是
 *     `[ktc-msg, ktc-drag, ktc-tray, ktc-play]`——提示行实实在在压在最上面。
 *   360×640 第 117 关（两只猫）：0% 与 50% 处都是 0/4，只有滚到底才够得着。
 * 喂饭是这一关唯一的主动玩法，落地就点不着 = 这一关不知道怎么开始，按阻断记。
 *
 * 两道保险一起上：
 *   ① 提示行 `pointer-events:none`——它从头到尾只是一句话，不该吃掉任何一次点击；
 *   ② 钳完顺手滚一次，把动手层送进眼里，并且**减掉粘住那一行的高**，
 *      免得正好把托盘停在提示行底下（看得见摸不着换成看不见）。
 */
import { describe, expect, it } from "vitest";

import { fitIntoStage, PLAY_ROW_SELECTORS, scrollToShowPx, showPlayRow } from "./runtime";
import { KTC_CSS } from "./styles";

describe("萌猫小屋 · scrollToShowPx", () => {
  it("滚最小的那一段：下沿进来就收手，上面的猫尽量留在眼里", () => {
    // 动手层在内容里 480..560，滚动口 404 高、粘住的提示行 26 高 → 可用窗口 378
    expect(scrollToShowPx(480, 560, 404, 200, 26)).toBe(182);
  });

  it("不减掉粘住那一行就会把托盘正好停在提示行底下——这条钉的是缺陷本身", () => {
    const withPin = scrollToShowPx(480, 560, 404, 200, 26);
    const without = scrollToShowPx(480, 560, 404, 200, 0);
    expect(withPin - without, "少滚了粘住那一行的高度，托盘就藏在提示行后面").toBe(26);
  });

  it("这一段自己比窗口还高就从上沿开始露，先看得见头", () => {
    expect(scrollToShowPx(300, 900, 404, 800, 26)).toBe(300);
  });

  it("不许滚过头，也不许滚成负的", () => {
    expect(scrollToShowPx(480, 560, 404, 60, 26)).toBe(60);
    expect(scrollToShowPx(0, 40, 404, 200, 26)).toBe(0);
  });

  it("没得滚 / 量不出数就返回 0，不平白往 DOM 上写一个 scrollTop", () => {
    expect(scrollToShowPx(480, 560, 404, 0, 26)).toBe(0);
    expect(scrollToShowPx(480, 560, 0, 200, 26)).toBe(0);
    expect(scrollToShowPx(Number.NaN, 560, 404, 200, 26)).toBe(0);
    // 提示行比整个滚动口还高（只可能是量错了）：宁可不动
    expect(scrollToShowPx(480, 560, 404, 200, 500)).toBe(0);
  });
});

// --- DOM 桩 ---

class FakeRow {
  constructor(readonly top: number, readonly height: number) {}
  getBoundingClientRect(): { top: number; height: number } {
    return { top: this.top, height: this.height };
  }
}

class FakeWrap {
  scrollTop = 0;
  clientHeight = 404;
  scrollHeight = 604;
  top = 218;
  private readonly kids = new Map<string, FakeRow>();
  put(sel: string, row: FakeRow): void {
    this.kids.set(sel, row);
  }
  querySelector(sel: string): FakeRow | null {
    return this.kids.get(sel) ?? null;
  }
  getBoundingClientRect(): { top: number } {
    return { top: this.top };
  }
}

const as = (w: FakeWrap): HTMLElement => w as unknown as HTMLElement;

describe("萌猫小屋 · showPlayRow", () => {
  it("真机第 188 关那一档：托盘在小屋最底下，滚一次就进眼里", () => {
    const wrap = new FakeWrap();
    // 屏上 y=698..756 = 内容里 480..538（宿主顶 218、scrollTop 0）
    wrap.put(".ktc-play", new FakeRow(698, 58));
    wrap.put(".ktc-msg", new FakeRow(596, 26));
    const moved = showPlayRow(as(wrap));
    expect(moved).toBeGreaterThan(0);
    expect(wrap.scrollTop).toBe(moved);
    // 滚完之后托盘下沿落在「滚动口下沿减去粘住那一行」以内
    const visibleBottom = wrap.clientHeight - 26;
    expect(538 - wrap.scrollTop).toBeLessThanOrEqual(visibleBottom);
  });

  it("找不到 .ktc-play 就退到托盘 / 按钮排 / 场地上，一层都不能漏", () => {
    for (const sel of PLAY_ROW_SELECTORS.slice(1)) {
      const wrap = new FakeWrap();
      wrap.put(sel, new FakeRow(698, 58));
      wrap.put(".ktc-msg", new FakeRow(596, 26));
      expect(showPlayRow(as(wrap)), `${sel} 这一层没被认出来`).toBeGreaterThan(0);
    }
  });

  it("动手层本来就在眼里就一格都不滚——别把手指底下的东西挪走", () => {
    const wrap = new FakeWrap();
    wrap.put(".ktc-play", new FakeRow(280, 58));
    wrap.put(".ktc-msg", new FakeRow(596, 26));
    expect(showPlayRow(as(wrap))).toBe(0);
    expect(wrap.scrollTop).toBe(0);
  });

  it("没得滚（高屏、没挂滚动条）就返回 0", () => {
    const wrap = new FakeWrap();
    wrap.scrollHeight = wrap.clientHeight;
    wrap.put(".ktc-play", new FakeRow(698, 58));
    expect(showPlayRow(as(wrap))).toBe(0);
  });

  it("一层动手层都没有 / 裸节点都不抛", () => {
    expect(showPlayRow(as(new FakeWrap()))).toBe(0);
    expect(showPlayRow({} as HTMLElement)).toBe(0);
  });
});

describe("萌猫小屋 · 提示行不许吃掉点击", () => {
  it("粘住的那一档写了 pointer-events:none", () => {
    const at = KTC_CSS.indexOf(".ktc-wrap.ktc-scroll .ktc-msg");
    expect(at).toBeGreaterThan(-1);
    const body = KTC_CSS.slice(at, KTC_CSS.indexOf("}", at) + 1);
    expect(body, "提示行 z-index:6 压在所有交互层之上，不穿透就会吃掉托盘的点击").toContain(
      "pointer-events:none",
    );
    // 第 2 轮那一修（粘在下沿 + 不透明底）一条都不许退回去
    expect(body).toContain("position:sticky");
    expect(body).toContain("bottom:0");
    expect(body).toMatch(/background:/);
  });
});

describe("萌猫小屋 · 接线", () => {
  it("挂上滚动条的那一次顺手滚一下；装得下的那一路一格都不动", () => {
    const calls: string[] = [];
    const stage = {
      parentElement: null as unknown,
      getBoundingClientRect: () => ({ top: 92, bottom: 626 }),
      __style: { overflowY: "hidden", borderBottomWidth: "4px" },
    };
    const view = {
      getComputedStyle: (p: { __style: unknown }) => p.__style,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    const classes = new Set<string>();
    const make = (scrollHeight: number) => ({
      parentElement: stage,
      ownerDocument: { defaultView: view },
      getBoundingClientRect: () => ({ top: 218, bottom: 218 + scrollHeight }),
      scrollHeight,
      clientHeight: 404,
      scrollTop: 0,
      querySelector(sel: string) {
        calls.push(sel);
        return null;
      },
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        contains: (c: string) => classes.has(c),
      },
      style: {
        maxHeight: "",
        overflowY: "",
        minHeight: "",
        setProperty: () => {},
        removeProperty: () => {},
      },
    });

    fitIntoStage(make(589) as unknown as HTMLElement);
    expect(classes.has("ktc-scroll")).toBe(true);
    expect(calls, "挂了滚动条却没去找动手层").toContain(".ktc-play");

    calls.length = 0;
    classes.clear();
    fitIntoStage(make(300) as unknown as HTMLElement);
    expect(classes.has("ktc-scroll")).toBe(false);
    expect(calls, "装得下的高屏上不该去动 scrollTop").toEqual([]);
  });
});
