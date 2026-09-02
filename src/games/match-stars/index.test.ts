/**
 * 1.2：四个入口的接线回归。
 * 188 关闯关走 `mountLevelGame`，另外三个入口（人机对战 / 双人同屏 / 无尽订单）
 * 各自能开、能退、能玩；`initialLevel` / `?level=` 给了就直接开打那一关。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { save } from "../../engine/save";
import { markSkipped, saveStar, type GameApi } from "../level99";
import { El, flushFrames, installDom, restoreDom, runUntil, type Dom } from "./domStub";
import { DUEL_COLS, DUEL_ROWS } from "./duel";
import { initialLevelOf, meta, mount, moveCursor, SEAT_KEYS } from "./index";
import { LEVELS } from "./levels";

let dom: Dom;

interface Recorder {
  api: GameApi;
  sounds: string[];
  stars: number;
}

function fakeApi(root: El): Recorder {
  const rec: Recorder = { api: null as unknown as GameApi, sounds: [], stars: 0 };
  rec.api = {
    root: root as unknown as HTMLElement,
    play: (name: string) => rec.sounds.push(name),
    addStars: (n: number) => (rec.stars += n),
    getStars: () => rec.stars,
    onWin: () => undefined,
    onLose: () => undefined,
  } as unknown as GameApi;
  return rec;
}

function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

function boards(): El[] {
  return dom.root.findAll((e) => e.className.split(/\s+/).includes("mst-board"));
}

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

describe("模块契约", () => {
  it("meta 与实现对齐：四种玩法都声明了，blurb 写上对战和无尽", () => {
    expect(meta.id).toBe("match-stars");
    expect(meta.title).toBe("星星消消乐");
    expect(meta.category).toBe("casual");
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    expect(meta.blurb).toMatch(/比赛清订单|对战/);
    expect(meta.blurb).toContain("无尽");
    expect(meta.blurb).not.toMatch(/[A-Za-z]/);
  });
});

describe("直开第 N 关", () => {
  it("壳层给的是 1 基关号，转成 0 基下标；没给就返回 -1", () => {
    expect(initialLevelOf(1, "")).toBe(0);
    expect(initialLevelOf(50, "")).toBe(49);
    expect(initialLevelOf(undefined, "")).toBe(-1);
    expect(initialLevelOf(null, "?x=1")).toBe(-1);
  });

  it("地址栏 ?level=N 也认，越界一律 clamp 到 1..188", () => {
    expect(initialLevelOf(undefined, "?level=7")).toBe(6);
    expect(initialLevelOf(undefined, "?a=1&level=188")).toBe(187);
    expect(initialLevelOf(9999, "")).toBe(187);
    expect(initialLevelOf(-5, "")).toBe(0);
    // 壳层给的优先于地址栏
    expect(initialLevelOf(3, "?level=99")).toBe(2);
  });

  it("给了 initialLevel 就不卡在章节封面，直接进关（锁着的关退回能玩的最远那一关）", () => {
    const rec = fakeApi(dom.root);
    (rec.api as unknown as { initialLevel: number }).initialLevel = 5;
    const handle = mount(rec.api);
    // 全新存档只解锁到第 1 关，所以退回第 1 关开打——而不是停在地图上
    expect(boards()).toHaveLength(1);
    expect(dom.root.textContent).toContain("步");
    handle.destroy();
  });

  it("进度推到哪儿就开得到哪儿：打过的关 + 跳过的关都算解锁", () => {
    // 前 4 关拿了星，第 5 关按了跳过 —— 能玩的最远就是第 6 关
    for (let lv = 0; lv < 4; lv++) saveStar(meta.id, lv, 3);
    markSkipped(meta.id, 4);
    const rec = fakeApi(dom.root);
    (rec.api as unknown as { initialLevel: number }).initialLevel = 6;
    const handle = mount(rec.api);
    expect(boards()).toHaveLength(1);
    expect(dom.root.textContent).toContain(`👣 ${LEVELS[5].moves} 步`);
    handle.destroy();
  });

  it("跳关标记只写自己那把钥匙，不碰星级存档", () => {
    markSkipped(meta.id, 3);
    expect(dom.store.has(`yiduo-yixing.l99skip.${meta.id}`)).toBe(true);
    expect(dom.store.has(`yiduo-yixing.l99.${meta.id}`)).toBe(false);
  });
});

describe("首页四个入口", () => {
  it("挂起来就有 188 关地图 + 三个模式按钮", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    expect(dom.root.find((e) => e.className.includes("l99-map"))).toBeTruthy();
    expect(dom.root.textContent).toContain("/188 关");
    expect(byText("无尽订单")).toBeTruthy();
    expect(byText("人机对战")).toBeTruthy();
    expect(byText("双人同屏")).toBeTruthy();
    handle.destroy();
    expect(dom.root.children.length).toBe(0);
  });

  it("闯关第 1 关进得去：8×8 棋盘、步数与目标条都在", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("开始冒险")!.dispatch("click");
    const board = boards()[0];
    expect(board).toBeTruthy();
    expect(board.children).toHaveLength(64);
    expect(dom.root.textContent).toContain("步");
    flushFrames(dom, 4);
    handle.destroy();
  });

  it("闯关点两颗相邻的星星会真的走一遍时间线（不是原地变脸）", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("开始冒险")!.dispatch("click");
    const board = boards()[0];
    let moved = false;
    // 找一个换了能消的位置：挨个试，试到有一次真的进了「下落」
    for (let i = 0; i < 56 && !moved; i++) {
      board.children[i].dispatch("click");
      board.children[i + 8].dispatch("click");
      if (runUntil(dom, () => board.children.some((c) => (c.style.transform ?? "").includes("translate")), 12) >= 0) {
        moved = true;
      }
      runUntil(dom, () => !dom.root.textContent.includes("__never__"), 1);
      flushFrames(dom, 40);
    }
    expect(moved).toBe(true);
    handle.destroy();
  });

  it("无尽订单开得起来、退得回去，面板写着剩余步数", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("无尽订单")!.dispatch("click");
    expect(boards()).toHaveLength(1);
    expect(boards()[0].children).toHaveLength(DUEL_COLS * DUEL_ROWS);
    expect(dom.root.textContent).toContain("剩");
    expect(dom.root.textContent).toContain("订单");
    flushFrames(dom, 4);
    byText("返回")!.dispatch("click");
    expect(boards()).toHaveLength(0);
    handle.destroy();
  });

  it("无尽的最高分接在 save 上：进门就写着历史最好几张", () => {
    save.recordEndlessBest(meta.id, 7);
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("无尽订单")!.dispatch("click");
    expect(dom.root.textContent).toContain("最好 7 张");
    handle.destroy();
  });

  it("人机对战先挑对手，挑完才开两块 6×6", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("人机对战")!.dispatch("click");
    expect(dom.root.textContent).toContain("新手小云");
    expect(dom.root.textContent).toContain("高手小雷");
    expect(boards()).toHaveLength(0);
    byText("开消")!.dispatch("click");
    expect(boards()).toHaveLength(2);
    for (const b of boards()) expect(b.children).toHaveLength(DUEL_COLS * DUEL_ROWS);
    expect(dom.root.textContent).toContain("订单");
    flushFrames(dom, 6);
    handle.destroy();
  });

  it("双人同屏直接开两块盘，两边各有各的键位说明", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")!.dispatch("click");
    expect(boards()).toHaveLength(2);
    expect(dom.root.textContent).toContain("朵朵");
    expect(dom.root.textContent).toContain("星星");
    flushFrames(dom, 4);
    handle.destroy();
  });

  it("人机对战里对手会自己出手（挑完档跑一会儿，盘面动过）", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("人机对战")!.dispatch("click");
    byText("开消")!.dispatch("click");
    const foe = boards()[1];
    // 1.3 起棋子是 SVG 不是文本,盘面指纹改读每格的读屏说明(内容一样跟着盘面变)
    const snap = (): string => foe.children.map((c) => c.getAttribute("aria-label")).join("|");
    const before = snap();
    // 虚拟时钟推进两秒多，够对手想一步了
    flushFrames(dom, 160, 20);
    expect(snap()).not.toBe(before);
    handle.destroy();
  });
});

describe("双人同屏的键位", () => {
  it("朵朵 WASD + F，星星 方向键 + L", () => {
    expect(SEAT_KEYS[0]).toEqual({ up: "w", down: "s", left: "a", right: "d", go: "f" });
    expect(SEAT_KEYS[1]).toEqual({
      up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", go: "l",
    });
  });

  it("光标一格一格走，走到边就停住不越界", () => {
    const bottomLeft = DUEL_COLS * (DUEL_ROWS - 1);
    expect(moveCursor(bottomLeft, "down", DUEL_COLS, DUEL_ROWS)).toBe(bottomLeft);
    expect(moveCursor(bottomLeft, "left", DUEL_COLS, DUEL_ROWS)).toBe(bottomLeft);
    expect(moveCursor(bottomLeft, "up", DUEL_COLS, DUEL_ROWS)).toBe(bottomLeft - DUEL_COLS);
    expect(moveCursor(bottomLeft, "right", DUEL_COLS, DUEL_ROWS)).toBe(bottomLeft + 1);
    expect(moveCursor(0, "up", DUEL_COLS, DUEL_ROWS)).toBe(0);
  });
});
