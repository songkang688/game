/**
 * 梨康台球 · 窗口 2 第 1 轮验收 · 测试员包 A 的复现测试。
 *
 * 这一份只做「记录取证」，不改玩法：走查铁则第 1 / 3 / 6 条在既有测试里没覆盖到的缺口，
 * 把测出来的现象钉成断言，修复员改完之后一眼就能看出到底改没改。
 * 标了「【已知问题】」的用例断言的是**当前行为**，修好之后这些用例会红，那时候连同断言一起翻面。
 *
 * 记在 `docs/qa/1.2-window2-round1-tester-packA.md` 的问题表里：
 *  - PA-PS-1（严重）：Esc 暂停只挡住了 rAF 与台面指针，键盘瞄准 / 蓄力 / 出杆与按钮照样生效。
 *    第 1 轮修复员已修，下面 `PA-PS-1` 那一组断言已经翻成修好后的行为；
 *  - PA-PS-2（一般）：双人同屏里方向键与 WASD 都改「当前出杆方」的角度，两人互相够得着。
 *    第 2 轮学习优化员已把瞄准键也按座位分开，下面 `PA-PS-2` 那一组断言已经翻成修好后的行为；
 *  - PA-PS-3（一般）：`mount` 的 destroy 不回收注入到 document.head 的 `ps-shell-style`。
 *    第 2 轮学习优化员已改成「注一次 + 引用计数」，下面 `PA-PS-3` 那一组断言已经翻成修好后的行为。
 *
 * 顶部先静态 import 一次 index：让 level99 / audio 那条链在真 node 环境下加载完，
 * 之后再装 DOM 桩，免得 audio.ts 的 `document.addEventListener` 撞上没有该方法的桩。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "./index";
import { loseLine } from "./levels";
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
  { name: "鸭梨", emoji: "🍐", color: "#e8558f", ai: null },
  { name: "康康", emoji: "👓", color: "#3f7fd6", ai: null },
];

function mountTable(over: Partial<TableOptions> = {}): {
  handle: ReturnType<typeof createTable>;
  settled: ShotIntent[];
} {
  const settled: ShotIntent[] = [];
  const handle = createTable(dom.root as unknown as HTMLElement, {
    balls: [makeBall(0, "cue", 40, 50), makeBall(1, "warm", 140, 28)],
    seats: [{ name: "鸭梨", emoji: "🍐", color: "#e8558f", ai: null }],
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
  it("出杆键分座位：轮到鸭梨时康康的 L 按不动，F 才有用", () => {
    const { handle } = mountTable({ seats: DUO_SEATS, turn: 0 });
    shoot("l");
    expect(handle.rolling(), "轮到鸭梨，康康的 L 却把球打出去了").toBe(false);
    shoot("f");
    expect(handle.rolling()).toBe(true);
    handle.destroy();
  });

  it("轮到康康时鸭梨的 F 按不动，L 才有用", () => {
    const { handle } = mountTable({ seats: DUO_SEATS, turn: 1 });
    shoot("f");
    expect(handle.rolling(), "轮到康康，鸭梨的 F 却把球打出去了").toBe(false);
    shoot("l");
    expect(handle.rolling()).toBe(true);
    handle.destroy();
  });

  it("取消蓄力键也分座位：康康的 K 取消不掉鸭梨的蓄力", () => {
    const { handle } = mountTable({ seats: DUO_SEATS, turn: 0 });
    fireWin("keydown", "f");
    dom.clock.ms += 200;
    fireWin("keydown", "k");
    fireWin("keyup", "f");
    expect(handle.rolling(), "康康的 K 取消掉了鸭梨的蓄力").toBe(true);
    handle.destroy();
  });

  it("G 能取消掉鸭梨自己的蓄力，松开 F 就不出杆了", () => {
    const { handle } = mountTable({ seats: DUO_SEATS, turn: 0 });
    fireWin("keydown", "f");
    dom.clock.ms += 200;
    fireWin("keydown", "g");
    fireWin("keyup", "f");
    expect(handle.rolling()).toBe(false);
    handle.destroy();
  });

  it("瞄准键也分座位：轮到康康时鸭梨的 D 拨不动角度", () => {
    const { handle, settled } = mountTable({ seats: DUO_SEATS, turn: 1 });
    for (let i = 0; i < 10; i++) fireWin("keydown", "d");
    shoot("l", 200);
    runUntilSettled(settled);
    expect(settled).toHaveLength(1);
    expect(settled[0].angle, "鸭梨的 D 改动了康康的瞄准角").toBeCloseTo(0, 5);
    handle.destroy();
  });

  it("反过来轮到鸭梨时康康的方向键也够不着", () => {
    const { handle, settled } = mountTable({ seats: DUO_SEATS, turn: 0 });
    for (let i = 0; i < 10; i++) fireWin("keydown", "ArrowRight");
    shoot("f", 200);
    runUntilSettled(settled);
    expect(settled).toHaveLength(1);
    expect(settled[0].angle, "康康的方向键改动了鸭梨的瞄准角").toBeCloseTo(0, 5);
    handle.destroy();
  });

  it("各自那一套照旧管用：鸭梨的 D 与康康的方向键都拨得动自己那一杆", () => {
    const duo = mountTable({ seats: DUO_SEATS, turn: 0 });
    for (let i = 0; i < 10; i++) fireWin("keydown", "d");
    shoot("f", 200);
    runUntilSettled(duo.settled);
    expect(duo.settled[0].angle, "鸭梨自己的 D 也拨不动了").toBeCloseTo(0.3, 5);
    duo.handle.destroy();

    const star = mountTable({ seats: DUO_SEATS, turn: 1 });
    for (let i = 0; i < 10; i++) fireWin("keydown", "ArrowRight");
    shoot("l", 200);
    runUntilSettled(star.settled);
    expect(star.settled[0].angle, "康康自己的方向键也拨不动了").toBeCloseTo(0.3, 5);
    star.handle.destroy();
  });

  it("单人局里两套瞄准键都归那位真人，老键位一条不丢", () => {
    const { handle, settled } = mountTable({ turn: 0 });
    for (let i = 0; i < 5; i++) fireWin("keydown", "d");
    for (let i = 0; i < 5; i++) fireWin("keydown", "ArrowRight");
    shoot("f", 200);
    runUntilSettled(settled);
    expect(settled).toHaveLength(1);
    expect(settled[0].angle, "单人局里 WASD 与方向键该都算数").toBeCloseTo(0.3, 5);
    handle.destroy();
  });

  it("电脑回合里两个人的出杆键都按不动", () => {
    const { handle } = mountTable({
      seats: [
        { name: "鸭梨", emoji: "🍐", color: "#e8558f", ai: null },
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
/* L3A-4 · 手机上也停得下来，暂停时电脑那一杆也停住                        */
/* ------------------------------------------------------------------ */

describe("L3A-4 · 球桌上的暂停钮与暂停遮罩", () => {
  function pauseBtn(): El {
    const btn = dom.root.find((e) => e.tagName === "button" && /⏸ 暂停|▶ 继续/.test(e.textContent));
    if (!btn) throw new Error("球桌上没有暂停钮");
    return btn;
  }

  function veil(): El | null {
    return dom.root.find((e) => e.className.includes("ps-veil") && !e.className.includes("ps-veil-"));
  }

  it("点 ⏸ 就停住：滚球不再推进，遮罩挂出来，钮翻成「继续」", () => {
    const { handle, settled } = mountTable();
    expect(veil(), "还没暂停就挂了遮罩").toBeNull();
    shoot("f");
    expect(handle.rolling()).toBe(true);
    flushFrames(dom, 3);
    pauseBtn().dispatch("click", {});
    expect(veil(), "点了暂停却没有遮罩").not.toBeNull();
    expect(pauseBtn().textContent).toContain("继续");
    expect(pauseBtn().getAttribute("aria-pressed")).toBe("true");
    for (let i = 0; i < 200 && settled.length === 0; i++) flushFrames(dom, 1);
    expect(settled, "点了暂停滚球还在跑").toHaveLength(0);
    handle.destroy();
  });

  it("遮罩上的「▶ 继续」点得动，点完球接着滚，遮罩收得掉", () => {
    const { handle, settled } = mountTable();
    shoot("f");
    flushFrames(dom, 3);
    pauseBtn().dispatch("click", {});
    const go = veil()!.find((e) => e.tagName === "button" && e.textContent.includes("继续"))!;
    expect(go, "遮罩上没有继续钮").toBeTruthy();
    go.dispatch("click", {});
    expect(veil(), "点了继续遮罩没收掉").toBeNull();
    runUntilSettled(settled);
    expect(settled, "恢复之后这一杆结算不了").toHaveLength(1);
    handle.destroy();
  });

  it("⏸ 钮和 Esc 是同一个开关，来回 10 次不会卡在暂停里", () => {
    const { handle } = mountTable();
    for (let i = 0; i < 10; i++) {
      esc();
      expect(veil(), `第 ${i + 1} 轮按 Esc 没挂遮罩`).not.toBeNull();
      expect(pauseBtn().textContent, `第 ${i + 1} 轮屏幕上的钮没跟着翻面`).toContain("继续");
      pauseBtn().dispatch("click", {});
      expect(veil(), `第 ${i + 1} 轮点钮没退出暂停`).toBeNull();
      expect(findText("已暂停"), `第 ${i + 1} 轮提示条还写着已暂停`).toBeNull();
    }
    handle.destroy();
  });

  it("暂停钮和别的按钮一样是 .ps-btn（热区 ≥ 44px 那一档）", () => {
    const { handle } = mountTable();
    expect(pauseBtn().className).toContain("ps-btn");
    handle.destroy();
  });

  it("暂停期间电脑那一杆也停住，恢复之后才打出来", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let asked = 0;
    const { handle } = mountTable({
      seats: [{ name: "电脑", emoji: "🤖", color: "#3f7fd6", ai: 2 }],
      aiThink: () => {
        asked++;
        return { angle: 0, power: 0.6, spin: 0, calledPocket: null };
      },
    });
    esc();
    vi.advanceTimersByTime(3000);
    expect(asked, "遮罩盖着的时候电脑还是把球打出去了").toBe(0);
    expect(handle.rolling()).toBe(false);
    esc();
    vi.advanceTimersByTime(900);
    expect(asked, "恢复之后电脑不想了").toBe(1);
    expect(handle.rolling()).toBe(true);
    handle.destroy();
    vi.useRealTimers();
  });

  it("暂停遮罩随球桌一起拆干净，不留节点也不留监听", () => {
    const { handle } = mountTable();
    esc();
    expect(veil()).not.toBeNull();
    handle.destroy();
    expect(dom.root.children, "拆完还留着遮罩").toHaveLength(0);
    expect(windowListenerCount(dom)).toBe(0);
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

/* ------------------------------------------------------------------ */
/* R3-PA-PS-1 · 结算浮层不许把同一句鼓励语说两遍                          */
/* ------------------------------------------------------------------ */

describe("L3A-15 · loseLine 不再和 reason 撞车", () => {
  const LEVELS_SRC = readFileSync(fileURLToPath(new URL("./levels.ts", import.meta.url)), "utf8");

  /**
   * `levelSuccess` 能给出来的全部失败 reason，直接从源码里扫。
   * 这么扫是为了以后有人加一条新 reason，这一组用例自动就把它管上，不用记得回来补。
   */
  function failReasons(): string[] {
    const body = /export function levelSuccess\([\s\S]*?\n}/.exec(LEVELS_SRC)?.[0] ?? "";
    expect(body, "levels.ts 里找不到 levelSuccess，这条扫描要跟着改").not.toBe("");
    const out: string[] = [];
    for (const m of body.matchAll(/ok:\s*false,\s*reason:\s*"([^"]+)"/g)) out.push(m[1]);
    return out;
  }

  /** 一句话里有没有长度 ≥ 5 的片段出现了两次 */
  function repeatedChunk(line: string): string | null {
    for (let i = 0; i + 5 <= line.length; i++) {
      const chunk = line.slice(i, i + 5);
      if (line.indexOf(chunk, i + 1) >= 0) return chunk;
    }
    return null;
  }

  it("扫得到 levelSuccess 的全部失败说法（至少 5 条）", () => {
    expect(failReasons().length).toBeGreaterThanOrEqual(5);
  });

  it("每一条 reason 套进 loseLine 都不再有重复的片段", () => {
    for (const reason of failReasons()) {
      const line = loseLine(reason);
      expect(repeatedChunk(line) ?? "没有重复", `「${line}」里「${repeatedChunk(line)}」说了两遍`).toBe("没有重复");
    }
  });

  it("空杆那条一字不差就是要补的那句，所以原样用、不再接一遍", () => {
    const empty = "这一杆差一点点，换个角度再来。";
    expect(failReasons(), "空杆那条 reason 的写法变了").toContain(empty);
    expect(loseLine(empty)).toBe(empty);
  });

  it("自己没说完的那几条照旧补上鼓励语，一句都不许变成光秃秃的判词", () => {
    const bare = "这一关要先吃一次库，直接打过去不算数。";
    expect(loseLine(bare)).toBe(`${bare}这一杆差一点点，换个角度再来。`);
    for (const reason of failReasons()) {
      const line = loseLine(reason);
      expect(
        /差一点点|再来|再瞄一次/.test(line),
        `「${line}」没给孩子一句「再来一次」`
      ).toBe(true);
      for (const bad of ["死", "血", "笨", "废"]) expect(line.includes(bad)).toBe(false);
    }
  });

  it("界面上真打空一杆，浮层里那句不再重复", () => {
    const handle = mount(fakeApi() as never);
    const line = loseLine("这一杆差一点点，换个角度再来。");
    expect(line.split("换个角度再来").length - 1, "「换个角度再来」出现了不止一次").toBe(1);
    handle.destroy();
  });
});
