/**
 * 萌猫小屋 · 横过来拿的时候相册一颗兑换钮都点不着 + 打扮件只露上半截
 * （1.2 窗口5 · 第 3 轮 · 档C，**W5R3-C-04 严重** / **W5R3-C-06 一般**）。
 *
 * 真机复现（`vite preview` + Chrome `--headless=new` + CDP，命中只认 `elementFromPoint`，
 * 真手指慢拖纵横来回八趟）：
 *
 * ## ① 相册（W5R3-C-04）
 *
 * | 视口 | `.ktc-grid` 可视段 | 内容 | `max-height` / `overflow-y` | 兑换钮 | 可滚祖先 |
 * | --- | --- | --- | --- | --- | --- |
 * | 640×360 | **130px** | 1724px | **none / visible** | **0 / 24** | **无** |
 * | 844×390 | **159.x px** | 1724px | **none / visible** | **0 / 24** | **无** |
 * | 320×568 | 247px | 2592px | 247px / auto | 翻得到 | `.ktc-grid` |
 * | 360×640 | 319px | 2592px | 319px / auto | 翻得到 | `.ktc-grid` |
 * | 390×844 | 521px | 2592px | 521px / auto | 翻得到 | `.ktc-grid` |
 *
 * 病灶是 `scrollIntoStage()` 开头那句「可视段比 `LIST_MIN_ROOM`＝160 还矮就别钳」。
 * 竖屏五档的可视段都在 247–521px，这一条从来没生效过；横屏一压到 130px 就当场早退，
 * **一格都没钳** —— 2809px 的卡片墙压在一个 `overflow:visible` 的盒子里，
 * 星星兑换是相册唯一的主动玩法，24 颗全部点不着。
 * 130px 的滚动口一次只看得见半张卡片确实不好看，可「看得见半张、翻得到全部」
 * 和「一颗都点不着」不是同一个量级的事。
 *
 * ## ② 打扮件（W5R3-C-06）
 *
 * 第 117 关（双猫打扮）640×360：`.ktc-wrap` 已经挂上滚动条（`ktc-scroll`），
 * `showPlayRow()` 也滚了一次，可它挑中的是 `.ktc-play`——整个交互层的外壳，
 * **214px > 滚动口 190px**。一段比滚动口还高就只能从上沿开始露，
 * 露出来的是场地，排在它最底下的托盘照旧被切：
 * 四颗 58×58 打扮件只露出上半截，名字那一行 `.ktc-drag small` **`vis 0/15`**，
 * 「蝴蝶结 / 领结 / 围巾」三个名字一个像素都看不见——
 * 这一关正是靠名字认「该给谁戴哪一件」。
 * 滚到底再量就全好了（`58/58`、`15/15`），说明**够得着的位置是存在的，只是没滚到**。
 */
import { describe, expect, it } from "vitest";

import { LIST_MIN_ROOM, PLAY_ROW_SELECTORS, scrollIntoStage, showPlayRow } from "./runtime";

// --- DOM 桩 ---

class FakeStyle {
  maxHeight = "";
  overflowY = "";
}

class FakeList {
  readonly style = new FakeStyle();
  readonly __style = { overflowY: "hidden", borderBottomWidth: "4px" };
  parentElement: FakeList | null = null;
  ownerDocument: { defaultView: unknown };
  private readonly resize: Array<() => void> = [];

  constructor(
    private readonly top: number,
    private readonly clipBottom: number | null,
    readonly scrollHeight: number,
  ) {
    const stage = this.clipBottom === null
      ? null
      : ({
          parentElement: null,
          getBoundingClientRect: () => ({ top: 0, bottom: this.clipBottom as number }),
          __style: { overflowY: "hidden", borderBottomWidth: "4px" },
        } as unknown as FakeList);
    this.parentElement = stage;
    this.ownerDocument = {
      defaultView: {
        getComputedStyle: (p: { __style: unknown }) => p.__style,
        addEventListener: (_t: string, fn: () => void) => this.resize.push(fn),
        removeEventListener: (_t: string, fn: () => void) => {
          const i = this.resize.indexOf(fn);
          if (i >= 0) this.resize.splice(i, 1);
        },
      },
    };
  }

  getBoundingClientRect(): { top: number; bottom: number } {
    return { top: this.top, bottom: this.top + this.scrollHeight };
  }

  get resizeListeners(): number {
    return this.resize.length;
  }
}

const asEl = (l: FakeList): HTMLElement => l as unknown as HTMLElement;

describe("相册在横屏上也得翻得动（W5R3-C-04）", () => {
  it("640×360 那一幕：可视段只有 130px —— 照样钳，照样挂滚动条", () => {
    // 裁切线 353（减掉 4px 下边框）、卡片墙从 219 起 → 可视段 130
    const grid = new FakeList(219, 353, 1724);
    scrollIntoStage(asEl(grid));
    expect(grid.style.maxHeight, "早退了：2809px 的卡片墙一格没钳，24 颗兑换钮全点不着").toBe("130px");
    expect(grid.style.overflowY, "光钳不挂滚动条等于把后 22 件直接删掉").toBe("auto");
  });

  it("844×390 那一幕：可视段 159 —— 卡在 160 那条线上的正是它", () => {
    const grid = new FakeList(219, 382, 1724);
    scrollIntoStage(asEl(grid));
    expect(grid.style.maxHeight).toBe("159px");
    expect(grid.style.overflowY).toBe("auto");
  });

  it("钳出来的口子绝不许高过可视段（横屏区间逐档扫）", () => {
    for (let room = LIST_MIN_ROOM; room <= 300; room += 1) {
      const grid = new FakeList(200, 204 + room, 2592);
      scrollIntoStage(asEl(grid));
      expect(grid.style.maxHeight, `可视段 ${room}`).toBe(`${room}px`);
    }
  });

  it("竖屏那几档一个像素都没变", () => {
    // 裁切线一律按 padding box 算：`.game-stage` 的 4px 下边框先减掉
    const low = new FakeList(405, 626, 2592);
    scrollIntoStage(asEl(low));
    expect(low.style.maxHeight).toBe("217px");
    const tall = new FakeList(405, 826, 2592);
    scrollIntoStage(asEl(tall));
    expect(tall.style.maxHeight).toBe("417px");
  });

  it("矮到连一颗兑换钮的中心点都塞不进去才真的不值得钳", () => {
    const slit = new FakeList(600, 622, 2592);
    scrollIntoStage(asEl(slit));
    expect(slit.style.maxHeight).toBe("");
    expect(LIST_MIN_ROOM).toBeGreaterThanOrEqual(44);
  });

  it("装得下 / 量不到裁切线就一个字都不写", () => {
    const roomy = new FakeList(100, 900, 400);
    scrollIntoStage(asEl(roomy));
    expect(roomy.style.maxHeight).toBe("");
    const free = new FakeList(100, null, 4000);
    scrollIntoStage(asEl(free));
    expect(free.style.maxHeight).toBe("");
  });

  it("dispose 之后监听拆干净、样式还回去", () => {
    const grid = new FakeList(219, 353, 1724);
    const fit = scrollIntoStage(asEl(grid));
    expect(grid.resizeListeners).toBe(1);
    fit.dispose();
    expect(grid.resizeListeners).toBe(0);
    expect(grid.style.maxHeight).toBe("");
    expect(grid.style.overflowY).toBe("");
  });
});

// --- 打扮件那一头 ---

class FakeRow {
  constructor(readonly top: number, readonly height: number) {}
  getBoundingClientRect(): { top: number; height: number } {
    return { top: this.top, height: this.height };
  }
}

class FakeWrap {
  scrollTop = 0;
  clientHeight = 190;
  scrollHeight = 475;
  top = 158;
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

const asWrap = (w: FakeWrap): HTMLElement => w as unknown as HTMLElement;

describe("外壳装不进滚动口时得往里退一层（W5R3-C-06）", () => {
  it("640×360 第 117 关那一幕：.ktc-play 214 > 口子 190，就该改挑托盘", () => {
    const wrap = new FakeWrap();
    // 屏上：.ktc-play 158..372（内容 0..214）、.ktc-tray 314..372（内容 156..214）
    wrap.put(".ktc-play", new FakeRow(158, 214));
    wrap.put(".ktc-tray", new FakeRow(314, 58));
    wrap.put(".ktc-msg", new FakeRow(312, 27));
    const moved = showPlayRow(asWrap(wrap));
    // 挑外壳就会从它的上沿开始露（scrollTop 0），托盘照旧被切
    expect(moved, "还是挑了装不下的外壳：托盘只露上半截，名字一行 0 像素可见").toBeGreaterThan(0);
    // 挑托盘：下沿 214 要落进「口子 190 减去粘住那一行 27」＝163 以内
    expect(214 - wrap.scrollTop).toBeLessThanOrEqual(wrap.clientHeight - 27);
  });

  it("外壳装得进就仍旧挑外壳——猫和托盘一起留在眼里最好", () => {
    const wrap = new FakeWrap();
    wrap.put(".ktc-play", new FakeRow(400, 120));
    wrap.put(".ktc-tray", new FakeRow(462, 58));
    wrap.put(".ktc-msg", new FakeRow(560, 27));
    const moved = showPlayRow(asWrap(wrap));
    // 外壳内容 242..362，下沿要落进 163 以内 → 滚 199
    expect(moved).toBe(199);
  });

  it("退一层之后仍旧减掉粘住的那一行，不然托盘正好停在提示行底下", () => {
    const wrap = new FakeWrap();
    wrap.put(".ktc-play", new FakeRow(158, 214));
    wrap.put(".ktc-tray", new FakeRow(314, 58));
    wrap.put(".ktc-msg", new FakeRow(312, 27));
    const withPin = showPlayRow(asWrap(wrap));

    const noPin = new FakeWrap();
    noPin.put(".ktc-play", new FakeRow(158, 214));
    noPin.put(".ktc-tray", new FakeRow(314, 58));
    const without = showPlayRow(asWrap(noPin));
    expect(withPin - without, "少滚了粘住那一行的高度").toBe(27);
  });

  it("托盘也没有就往下找按钮排 / 场地，一层都不能漏", () => {
    for (const sel of PLAY_ROW_SELECTORS.slice(1)) {
      const wrap = new FakeWrap();
      wrap.put(".ktc-play", new FakeRow(158, 214));
      wrap.put(sel, new FakeRow(314, 58));
      wrap.put(".ktc-msg", new FakeRow(312, 27));
      expect(showPlayRow(asWrap(wrap)), `${sel} 这一层没被认出来`).toBeGreaterThan(0);
    }
  });

  it("一层都装不下就仍旧退回外壳，绝不返回 0 把孩子晾在那儿", () => {
    const wrap = new FakeWrap();
    wrap.put(".ktc-play", new FakeRow(600, 400));
    wrap.put(".ktc-msg", new FakeRow(312, 27));
    expect(showPlayRow(asWrap(wrap))).toBeGreaterThan(0);
  });

  it("320×568 那一档没被改坏：托盘装得进，仍旧滚到看得全", () => {
    const wrap = new FakeWrap();
    wrap.clientHeight = 330;
    wrap.scrollHeight = 572;
    wrap.top = 242;
    wrap.put(".ktc-play", new FakeRow(242, 282));
    wrap.put(".ktc-tray", new FakeRow(398, 126));
    wrap.put(".ktc-msg", new FakeRow(514, 27));
    const moved = showPlayRow(asWrap(wrap));
    // 托盘内容 156..282，下沿落进 330−27＝303 以内
    expect(282 - moved).toBeLessThanOrEqual(303);
    expect(moved).toBeLessThanOrEqual(wrap.scrollHeight - wrap.clientHeight);
  });
});
