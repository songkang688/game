/**
 * 朵星台球 · 窗口 2 第 1 轮验收 · 测试员包 A 的复现测试。
 *
 * 这一份只做「记录取证」，不改玩法：走查铁则第 1 / 3 / 6 条在既有测试里没覆盖到的缺口，
 * 把测出来的现象钉成断言，修复员改完之后一眼就能看出到底改没改。
 * 标了「【已知问题】」的用例断言的是**当前行为**，修好之后这些用例会红，那时候连同断言一起翻面。
 *
 * 记在 `docs/qa/1.2-window2-round1-tester-packA.md` 的问题表里：
 *  - PA-PS-1（严重）：Esc 暂停只挡住了 rAF 与台面指针，键盘瞄准 / 蓄力 / 出杆与按钮照样生效。
 *    第 1 轮修复员已修，下面 `PA-PS-1` 那一组断言已经翻成修好后的行为；
 *  - PA-PS-2（一般）：双人同屏里方向键与 WASD 都改「当前出杆方」的角度，两人互相够得着（仍留后面几轮）；
 *  - PA-PS-3（一般）：`mount` 的 destroy 不回收注入到 document.head 的 `ps-shell-style`。
 *    第 2 轮学习优化员已改成「注一次 + 引用计数」，下面 `PA-PS-3` 那一组断言已经翻成修好后的行为。
 *
 * 顶部先静态 import 一次 index：让 level99 / audio 那条链在真 node 环境下加载完，
 * 之后再装 DOM 桩，免得 audio.ts 的 `document.addEventListener` 撞上没有该方法的桩。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount } from "./index";
import { El, fireWindow, flushFrames, installDom, restoreDom, windowListenerCount, type Dom } from "./domStub";
import { makeBall } from "./physics";
import { createTable, type SeatPlan, type ShotIntent, type TableOptions } from "./view";

let dom: Dom;

beforeEach(() => {
  dom = installDom(800);
});

afterEach(() => {
  restoreDom();
});

const DUO_SEATS: SeatPlan[] = [
  { name: "朵朵", emoji: "🌸", color: "#e8558f", ai: null },
  { name: "星星", emoji: "⭐", color: "#3f7fd6", ai: null },
];

function mountTable(over: Partial<TableOptions> = {}): {
  handle: ReturnType<typeof createTable>;
  settled: ShotIntent[];
} {
  const settled: ShotIntent[] = [];
  const handle = createTable(dom.root as unknown as HTMLElement, {
    balls: [makeBall(0, "cue", 40, 50), makeBall(1, "warm", 140, 28)],
    seats: [{ name: "朵朵", emoji: "🌸", color: "#e8558f", ai: null }],
    turn: 0,
    banner: "练习台",
    tip: "先找线再出杆。",
    showAim: true,
    allowSpin: true,
    requireCall: false,
    freeBall: false,
    target: "warm",
    sfx: () => undefined,
    onSettled: (_res, shot) => settled.push(shot),
    ...over,
  });
  return { handle, settled };
}

/** 桩的 fireWindow 不自带 preventDefault，视图里每条分支都会调它，得补上 */
function fireWin(type: string, key: string): void {
  fireWindow(dom, type, { key, preventDefault: () => undefined });
}

function esc(): void {
  fireWin("keydown", "Escape");
}

/** 蓄力 ms 毫秒之后松手 */
function shoot(key: string, ms = 300): void {
  fireWin("keydown", key);
  dom.clock.ms += ms;
  fireWin("keyup", key);
}

function findText(part: string): El | null {
  return dom.root.find((e) => e.textContent.includes(part));
}

function runUntilSettled(settled: ShotIntent[]): void {
  for (let i = 0; i < 500 && settled.length === 0; i++) flushFrames(dom, 1);
}

function fakeApi() {
  return {
    root: dom.root as unknown as HTMLElement,
    play: () => undefined,
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => undefined,
    onLose: () => undefined,
  };
}

/* ------------------------------------------------------------------ */
/* PA-PS-1 Esc 暂停到底封住了什么                                       */
/* ------------------------------------------------------------------ */

describe("PA-PS-1 · Esc 暂停的封锁范围", () => {
  it("暂停确实停下了画面推进：滚球中途按 Esc，这一杆就结算不了", () => {
    const { handle, settled } = mountTable();
    shoot("f");
    expect(handle.rolling()).toBe(true);
    flushFrames(dom, 3);
    esc();
    for (let i = 0; i < 200 && settled.length === 0; i++) flushFrames(dom, 1);
    expect(settled, "暂停之后滚球还在往下跑").toHaveLength(0);
    handle.destroy();
  });

  it("暂停会写进提示条，再按一次恢复", () => {
    const { handle } = mountTable();
    esc();
    expect(findText("已暂停")).not.toBeNull();
    esc();
    expect(findText("已暂停")).toBeNull();
    handle.destroy();
  });

  it("暂停期间方向键改不动瞄准角，恢复之后还是原来那条线", () => {
    const { handle, settled } = mountTable();
    esc();
    for (let i = 0; i < 10; i++) fireWin("keydown", "ArrowRight");
    esc();
    shoot("f", 200);
    runUntilSettled(settled);
    expect(settled).toHaveLength(1);
    expect(settled[0].angle, "暂停期间的方向键又被算进了瞄准角").toBeCloseTo(0, 5);
    handle.destroy();
  });

  it("恢复之后方向键照旧管用（别把人一起锁死了）", () => {
    const { handle, settled } = mountTable();
    esc();
    for (let i = 0; i < 4; i++) fireWin("keydown", "ArrowRight");
    esc();
    for (let i = 0; i < 10; i++) fireWin("keydown", "ArrowRight");
    shoot("f", 200);
    runUntilSettled(settled);
    expect(settled).toHaveLength(1);
    expect(settled[0].angle, "恢复之后方向键失灵了").toBeCloseTo(0.3, 5);
    handle.destroy();
  });

  it("暂停期间按 F 蓄力、松手也打不出去", () => {
    const { handle } = mountTable();
    esc();
    expect(handle.rolling()).toBe(false);
    shoot("f");
    expect(handle.rolling(), "暂停期间键盘还能出杆").toBe(false);
    // 恢复之后照样打得出去
    esc();
    shoot("f");
    expect(handle.rolling(), "恢复之后反而打不出去了").toBe(true);
    handle.destroy();
  });

  it("蓄力蓄到一半按 Esc，这一杆就作废，松手不出杆", () => {
    const { handle } = mountTable();
    fireWin("keydown", "f");
    dom.clock.ms += 200;
    esc();
    fireWin("keyup", "f");
    expect(handle.rolling(), "暂停把蓄到一半的杆放出去了").toBe(false);
    handle.destroy();
  });

  it("暂停期间点屏幕上的击球钮也出不了杆", () => {
    const { handle } = mountTable();
    esc();
    const shootBtn = dom.root.find((e) => e.className.includes("ps-shoot"))!;
    shootBtn.dispatch("pointerdown", {});
    dom.clock.ms += 250;
    shootBtn.dispatch("pointerup", {});
    expect(handle.rolling(), "暂停期间击球钮还能出杆").toBe(false);
    handle.destroy();
  });

  it("暂停期间左右微调钮也拨不动瞄准角", () => {
    const { handle, settled } = mountTable();
    esc();
    const rightBtn = dom.root.find((e) => e.textContent.includes("右 ▶"))!;
    expect(rightBtn, "找不到微调钮").toBeTruthy();
    for (let i = 0; i < 10; i++) rightBtn.dispatch("click", {});
    esc();
    shoot("f", 200);
    runUntilSettled(settled);
    expect(settled).toHaveLength(1);
    expect(settled[0].angle, "暂停期间微调钮改动了瞄准角").toBeCloseTo(0, 5);
    handle.destroy();
  });

  it("反过来说，在台面上拖动指针确实被暂停挡住了", () => {
    const { handle } = mountTable();
    esc();
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    canvas.dispatch("pointerdown", { clientX: 200, clientY: 200 });
    canvas.dispatch("pointermove", { clientX: 260, clientY: 200 });
    canvas.dispatch("pointerup", {});
    expect(handle.rolling(), "暂停期间拖台面竟然也能出杆").toBe(false);
    handle.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* PA-PS-2 双人同屏的键位归属                                           */
/* ------------------------------------------------------------------ */

describe("PA-PS-2 · 双人同屏键位互不抢占", () => {
  it("出杆键分座位：轮到朵朵时星星的 L 按不动，F 才有用", () => {
    const { handle } = mountTable({ seats: DUO_SEATS, turn: 0 });
    shoot("l");
    expect(handle.rolling(), "轮到朵朵，星星的 L 却把球打出去了").toBe(false);
    shoot("f");
    expect(handle.rolling()).toBe(true);
    handle.destroy();
  });

  it("轮到星星时朵朵的 F 按不动，L 才有用", () => {
    const { handle } = mountTable({ seats: DUO_SEATS, turn: 1 });
    shoot("f");
    expect(handle.rolling(), "轮到星星，朵朵的 F 却把球打出去了").toBe(false);
    shoot("l");
    expect(handle.rolling()).toBe(true);
    handle.destroy();
  });

  it("取消蓄力键也分座位：星星的 K 取消不掉朵朵的蓄力", () => {
    const { handle } = mountTable({ seats: DUO_SEATS, turn: 0 });
    fireWin("keydown", "f");
    dom.clock.ms += 200;
    fireWin("keydown", "k");
    fireWin("keyup", "f");
    expect(handle.rolling(), "星星的 K 取消掉了朵朵的蓄力").toBe(true);
    handle.destroy();
  });

  it("G 能取消掉朵朵自己的蓄力，松开 F 就不出杆了", () => {
    const { handle } = mountTable({ seats: DUO_SEATS, turn: 0 });
    fireWin("keydown", "f");
    dom.clock.ms += 200;
    fireWin("keydown", "g");
    fireWin("keyup", "f");
    expect(handle.rolling()).toBe(false);
    handle.destroy();
  });

  it("【已知问题】瞄准键不分座位：轮到星星时朵朵的 D 照样拨得动角度", () => {
    const { handle, settled } = mountTable({ seats: DUO_SEATS, turn: 1 });
    for (let i = 0; i < 10; i++) fireWin("keydown", "d");
    shoot("l", 200);
    runUntilSettled(settled);
    expect(settled).toHaveLength(1);
    // 应有行为：轮到星星时朵朵的 D 被忽略，角度还是 0。现状：被拨到了 0.3。
    expect(settled[0].angle, "朵朵的 D 改动了星星的瞄准角").toBeCloseTo(0.3, 5);
    handle.destroy();
  });

  it("【已知问题】反过来轮到朵朵时星星的方向键也够得着", () => {
    const { handle, settled } = mountTable({ seats: DUO_SEATS, turn: 0 });
    for (let i = 0; i < 10; i++) fireWin("keydown", "ArrowRight");
    shoot("f", 200);
    runUntilSettled(settled);
    expect(settled).toHaveLength(1);
    expect(settled[0].angle, "星星的方向键改动了朵朵的瞄准角").toBeCloseTo(0.3, 5);
    handle.destroy();
  });

  it("电脑回合里两个人的出杆键都按不动", () => {
    const { handle } = mountTable({
      seats: [
        { name: "朵朵", emoji: "🌸", color: "#e8558f", ai: null },
        { name: "电脑", emoji: "🤖", color: "#3f7fd6", ai: 2 },
      ],
      turn: 1,
    });
    shoot("f");
    shoot("l");
    expect(handle.rolling(), "电脑回合被真人抢了杆").toBe(false);
    handle.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* PA-PS-3 退出再进                                                     */
/* ------------------------------------------------------------------ */

describe("PA-PS-3 · 退出再进", () => {
  it("反复挂球桌再拆掉，window 监听不会越攒越多", () => {
    for (let i = 0; i < 3; i++) {
      const { handle } = mountTable();
      flushFrames(dom, 4);
      handle.destroy();
      expect(windowListenerCount(dom), `第 ${i + 1} 次拆完还留着 window 监听`).toBe(0);
      expect(dom.root.children).toHaveLength(0);
    }
  });

  it("从首页进来能开出模式条与 188 关地图，退出再进也一样", () => {
    for (let i = 0; i < 2; i++) {
      const handle = mount(fakeApi() as never);
      expect(dom.root.find((e) => e.className.includes("ps-bar")), `第 ${i + 1} 次进来没有模式条`).not.toBeNull();
      expect(dom.root.find((e) => e.className.includes("l99-map")), `第 ${i + 1} 次进来没有选关地图`).not.toBeNull();
      for (const label of ["人机对战", "双人同屏", "无尽残局"]) {
        expect(
          dom.root.find((e) => e.tagName === "button" && e.textContent.includes(label)),
          `第 ${i + 1} 次进来少了「${label}」入口`
        ).not.toBeNull();
      }
      handle.destroy();
      expect(dom.root.children, `第 ${i + 1} 次退出没拆干净`).toHaveLength(0);
      expect(windowListenerCount(dom), `第 ${i + 1} 次退出还留着 window 监听`).toBe(0);
    }
  });

  it("destroy 会把注入 document.head 的 ps-shell-style 一起带走", () => {
    const handle = mount(fakeApi() as never);
    expect(dom.head.children.some((c) => c.id === "ps-shell-style")).toBe(true);
    handle.destroy();
    expect(
      dom.head.children.some((c) => c.id === "ps-shell-style"),
      "destroy 之后样式标签仍留在 document.head"
    ).toBe(false);
  });

  it("来回进出 5 次，head 里始终最多一份样式，最后一次拆完归零", () => {
    for (let i = 0; i < 5; i++) {
      const handle = mount(fakeApi() as never);
      expect(
        dom.head.children.filter((c) => c.id === "ps-shell-style"),
        `第 ${i + 1} 次进来 head 里的样式不是一份`
      ).toHaveLength(1);
      handle.destroy();
      expect(
        dom.head.children.filter((c) => c.id === "ps-shell-style"),
        `第 ${i + 1} 次退出没把样式带走`
      ).toHaveLength(0);
    }
  });

  it("两处同时用着样式时不许提前回收，最后一个走的人才带走", () => {
    const outer = mount(fakeApi() as never);
    const { handle: table } = mountTable();
    expect(dom.head.children.some((c) => c.id === "ps-style"), "球桌样式没注入").toBe(true);
    table.destroy();
    // 球桌自己的 ps-style 是另一份，外壳那份不受影响
    expect(dom.head.children.some((c) => c.id === "ps-shell-style"), "球桌拆掉就把外壳样式带走了").toBe(true);
    outer.destroy();
    expect(dom.head.children.some((c) => c.id === "ps-shell-style")).toBe(false);
    expect(dom.head.children.some((c) => c.id === "ps-style"), "球桌样式也该带走").toBe(false);
  });
});
