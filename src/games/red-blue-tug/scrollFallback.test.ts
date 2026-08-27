/**
 * 红蓝拔河 · 四档收紧全用尽之后的那一档兜底
 * （1.2 窗口5 · 第 3 轮 · 档C，**W5R3-C-04 严重** / **W5R3-C-05 一般**）。
 *
 * 真机复现（`vite preview` + Chrome `--headless=new` + CDP，命中只认 `elementFromPoint`，
 * 真手指 `touchStart → 18 段 touchMove → 停 220ms → touchEnd`，纵横来回八趟）：
 *
 * | 视口 | 第 181 关这一屏 | 可视段 | `.rbg-pull` 静止 / 慢拖八趟后 | `.rbg-msg` |
 * | --- | --- | --- | --- | --- |
 * | 640×360 | 311px | **190px** | 0 / 2 → **0 / 2**，可滚祖先 **无** | `vis 0/16` |
 * | 844×390 | 288px | **220px** | 0 / 2 → **0 / 2**，可滚祖先 **无** | `vis 0/16` |
 * | 320×568 | 358px | 330px | 2 / 2 | **`vis 0/16`** |
 *
 * 四档（扣场地 → 减空隙 → 收字号 → 扣按钮）已经全部上身：场地退到 `MIN_FIELD_H`、
 * 按钮退到 `MIN_PULL_H`，再没有一个可让的像素。以前走到这儿就直接收手，
 * 于是横屏上**两颗大按钮 2/2 全在裁切线以下且一个可滚祖先都没有**——
 * 拔河只有「按住那颗键」一种玩法，够不着就是一步都走不动（W5R3-C-04）；
 * 320×568 第 181 关则是「💧 补给被对面拿走了…」整句 0 像素可见（W5R3-C-05）。
 *
 * 兜底那一档为什么不会把「按住蓄力」弄丢：`.rbg-pull` 自己写着 `touch-action:none`，
 * 手指落在按钮上时浏览器根本不把这一下当成滚动手势，按住多久就是多久。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  MIN_FIELD_H,
  MIN_PULL_H,
  SCROLL_MIN_ROOM,
  needsScroll,
  needsTight,
  needsTighter,
  scrollToShowPx,
  showPull
} from "./fit";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const FIT = readFileSync(new URL("./fit.ts", import.meta.url), "utf8");

describe("四档用尽还装不下就得兜底（needsScroll）", () => {
  it("640×360 第 181 关：这一屏 311、可视段 190 —— 得兜底", () => {
    expect(needsScroll(311, 190)).toBe(true);
  });

  it("844×390 第 181 关：288 / 220 —— 得兜底", () => {
    expect(needsScroll(288, 220)).toBe(true);
  });

  it("320×568 第 181 关：358 / 330，差的正是那 16px 提示行 —— 也得兜底", () => {
    expect(needsScroll(358, 330)).toBe(true);
  });

  it("装得下的一律不兜底：竖屏高档一个像素都不许变", () => {
    expect(needsScroll(330, 330)).toBe(false);
    expect(needsScroll(300, 530)).toBe(false);
    // 差 1px 以内当装得下，免得子像素误差抖出一个滚动条
    expect(needsScroll(331, 330)).toBe(false);
  });

  it("矮到连一颗大按钮的中心点都塞不进去才真的不值得钳", () => {
    expect(needsScroll(311, SCROLL_MIN_ROOM - 1)).toBe(false);
    expect(needsScroll(311, SCROLL_MIN_ROOM)).toBe(true);
    expect(SCROLL_MIN_ROOM).toBe(MIN_PULL_H);
    // 热区底线一分没让
    expect(MIN_PULL_H).toBeGreaterThanOrEqual(44);
  });

  it("量不出来的一律不兜底", () => {
    expect(needsScroll(311, Number.NaN)).toBe(false);
    expect(needsScroll(311, 0)).toBe(false);
    expect(needsScroll(311, -10)).toBe(false);
    expect(needsScroll(Number.NaN, 190)).toBe(false);
    expect(needsScroll(0, 190)).toBe(false);
  });

  it("顺序不许换：滚动永远排在四档收紧后面", () => {
    const body = FIT.slice(FIT.indexOf("const relayout = ("), FIT.indexOf("relayout();\n  //"));
    const order = ["fieldRoomPx(", "needsTight(", "needsTighter(", "pullRoomPx(", "needsScroll("];
    let at = -1;
    for (const step of order) {
      const next = body.indexOf(step);
      expect(next, `${step} 这一档不见了`).toBeGreaterThan(-1);
      expect(next, `${step} 排到前一档前面去了`).toBeGreaterThan(at);
      at = next;
    }
    // 场地那两条底线仍是它们自己
    expect(needsTight(400, MIN_FIELD_H, 300)).toBe(true);
    expect(needsTighter(400, 300)).toBe(true);
  });
});

describe("兜底之后把两颗大按钮送进眼里 · scrollToShowPx", () => {
  it("滚最小的那一段：按钮下沿一进来就收手，拔河场尽量留在眼里", () => {
    // 按钮在内容里 219..275，滚动口 190 高、能滚 121
    expect(scrollToShowPx(219, 275, 190, 121)).toBe(85);
  });

  it("这一段自己比滚动口还高就从上沿开始露", () => {
    expect(scrollToShowPx(100, 400, 190, 300)).toBe(100);
  });

  it("本来就在眼里就一格都不滚；不许滚过头，也不许滚成负的", () => {
    expect(scrollToShowPx(0, 120, 190, 121)).toBe(0);
    expect(scrollToShowPx(219, 275, 190, 40)).toBe(40);
    expect(scrollToShowPx(Number.NaN, 275, 190, 121)).toBe(0);
    expect(scrollToShowPx(219, 275, 190, 0)).toBe(0);
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
  clientHeight = 190;
  scrollHeight = 311;
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

const as = (w: FakeWrap): HTMLElement => w as unknown as HTMLElement;

describe("showPull", () => {
  it("640×360 那一幕：两颗大按钮排在最底下，滚一次就进眼里", () => {
    const wrap = new FakeWrap();
    // 屏上 y=377..433 = 内容里 219..275
    wrap.put(".rbg-ctrl", new FakeRow(377, 56));
    const moved = showPull(as(wrap));
    expect(moved).toBeGreaterThan(0);
    expect(275 - wrap.scrollTop, "滚完按钮下沿还在口子外面").toBeLessThanOrEqual(wrap.clientHeight);
  });

  it("提示行跟按钮一起装得下就连它一块儿送进来（W5R3-C-05）", () => {
    const wrap = new FakeWrap();
    wrap.put(".rbg-ctrl", new FakeRow(377, 56));
    // 提示行紧跟在按钮下面：内容 279..295，和按钮一共 76px ≤ 口子 190
    wrap.put(".rbg-msg", new FakeRow(437, 16));
    const moved = showPull(as(wrap));
    expect(295 - moved, "提示行还在口子外面——「这一关要干什么」就是看不见").toBeLessThanOrEqual(
      wrap.clientHeight,
    );
    // 按钮当然也还在眼里
    expect(275 - moved).toBeLessThanOrEqual(wrap.clientHeight);
  });

  it("提示行跟按钮一起装不下就只保按钮——按不着这一关就没法玩", () => {
    const wrap = new FakeWrap();
    wrap.put(".rbg-ctrl", new FakeRow(377, 56));
    // 提示行离按钮很远（折了好几行），两者跨度 200 > 口子 190
    wrap.put(".rbg-msg", new FakeRow(521, 100));
    const moved = showPull(as(wrap));
    expect(275 - moved).toBeLessThanOrEqual(wrap.clientHeight);
    expect(moved).toBe(85);
  });

  it("没有 .rbg-ctrl 就退到 .rbg-pull 自己身上", () => {
    const wrap = new FakeWrap();
    wrap.put(".rbg-pull", new FakeRow(377, 56));
    expect(showPull(as(wrap))).toBeGreaterThan(0);
  });

  it("按钮本来就在眼里就一格都不滚——手指正按着的东西不许挪", () => {
    const wrap = new FakeWrap();
    wrap.put(".rbg-ctrl", new FakeRow(200, 56));
    expect(showPull(as(wrap))).toBe(0);
    expect(wrap.scrollTop).toBe(0);
  });

  it("没得滚 / 找不到按钮 / 裸节点都不抛", () => {
    const flat = new FakeWrap();
    flat.scrollHeight = flat.clientHeight;
    flat.put(".rbg-ctrl", new FakeRow(377, 56));
    expect(showPull(as(flat))).toBe(0);
    expect(showPull(as(new FakeWrap()))).toBe(0);
    expect(showPull({} as HTMLElement)).toBe(0);
  });
});

describe("样式这一头也得配合", () => {
  it("按住蓄力那一下不许被当成滚动手势：按钮自己写着 touch-action:none", () => {
    const at = SRC.indexOf(".rbg-pull {");
    expect(at).toBeGreaterThan(-1);
    expect(SRC.slice(at, SRC.indexOf("}", at))).toContain("touch-action: none");
  });

  it("翻到底不许把外面那层也带着走", () => {
    const at = SRC.indexOf(".rbg-wrap.rbg-scroll");
    expect(at, "兜底那一档的样式没写").toBeGreaterThan(-1);
    expect(SRC.slice(at, SRC.indexOf("}", at))).toContain("overscroll-behavior: contain");
  });

  it("兜底留下的东西每次重量之前都要还原，否则越量越小", () => {
    const body = FIT.slice(FIT.indexOf("const resetScroll"), FIT.indexOf("const relayout = ("));
    expect(body).toContain('wrap.classList?.remove("rbg-scroll")');
    expect(body).toContain('wrap.style.maxHeight = ""');
    expect(body).toContain('wrap.style.overflowY = ""');
    // 还原必须排在量之前，不然量到的是上一次钳完的高度
    const relayout = FIT.slice(FIT.indexOf("const relayout = ("), FIT.indexOf("  relayout();\n  //"));
    expect(relayout.indexOf("resetScroll()")).toBeGreaterThan(-1);
    expect(relayout.indexOf("resetScroll()")).toBeLessThan(relayout.indexOf("stageRoomPx(wrap)"));
    // dispose 也得还原，不然拆完舞台样式还留在身上
    expect(FIT.slice(FIT.indexOf("dispose(): void"))).toContain("resetScroll()");
  });
});
