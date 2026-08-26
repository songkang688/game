/**
 * 1.2 验收铁则：**消除后、重力完成前，方块的视觉坐标与逻辑坐标不同。**
 *
 * 这一组拿 `domStub.ts` 的虚拟时钟一帧一帧地走整条时间线，
 * 逐段断言「换过去 → 爆开 → 下落 → 落地 → 连锁 → 结算」一段都没被跳过。
 * 只要存在「一次 render 直达终态」的路径，`不落地就不结算` 这几条就会红。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { EMPTY, ROCKET_H, makeCellset, shuffleOn, type Cellset } from "./board";
import { applyPlan, detonatePlan, planRound } from "./duel";
import { El, flushFrames, installDom, restoreDom, runUntil, type Dom } from "./domStub";
import { boardBleed, boardWidthAt, cellPitch, createStage, type Stage, type TokenSkin } from "./view";
import type { Phase } from "./anim";

const COLS = 4;
const ROWS = 4;
const TOKENS: TokenSkin[] = [
  { emoji: "⭐", bg: "#a" },
  { emoji: "💖", bg: "#b" },
  { emoji: "🍀", bg: "#c" },
  { emoji: "🌙", bg: "#d" },
  { emoji: "🍊", bg: "#e" },
];

/**
 * 一块摆好的 4×4：换第 3 行的头两格就会在第 0 列凑出一个竖三连，
 * 消完之后第 0 行那颗要一路掉到第 3 行——落差三格，够看清楚了。
 */
const START = [
  2, 3, 4, 3,
  1, 4, 3, 4,
  1, 3, 4, 3,
  0, 1, 3, 4,
];

let dom: Dom;

interface Harness {
  cell: Cellset;
  stage: Stage;
  moves: number;
  rounds: number;
  reverts: number;
  settled: number;
}

/** `spawnList` 按顺序发给补块用，发完循环；`reshuffle` 给死局洗牌那一段用 */
function mk(spawnList: number[], reduced = false, reshuffle?: (cell: Cellset) => boolean): Harness {
  const cell = makeCellset(COLS, ROWS, 0);
  cell.grid = START.slice();
  const h: Harness = { cell, stage: null as unknown as Stage, moves: 0, rounds: 0, reverts: 0, settled: 0 };
  let feed = 0;
  const done = new Set<number>();
  let blastWave = new Set<number>();
  h.stage = createStage(dom.root as unknown as HTMLElement, {
    cell,
    tokens: TOKENS,
    reduced,
    afterSwap: (a, b) => {
      const boom = detonatePlan(cell, a, b);
      if (boom) return boom;
      return planRound(cell, b) ?? "revert";
    },
    round: () => planRound(cell, -1),
    applyRound: (plan) => {
      const res = applyPlan(cell, plan, done);
      blastWave = res.blast;
      h.rounds++;
    },
    blast: () => {
      if (blastWave.size === 0) return null;
      const cells = Array.from(blastWave);
      blastWave = new Set();
      return { cells };
    },
    spawn: () => spawnList[feed++ % spawnList.length],
    onMove: () => {
      h.moves++;
      done.clear();
    },
    onRevert: () => {
      h.reverts++;
    },
    onSettled: () => {
      h.settled++;
    },
    reshuffle: reshuffle ? () => reshuffle(cell) : undefined,
  });
  return h;
}

/** 一路跑到时间线停下来（最多 400 帧） */
function settle(h: Harness): void {
  runUntil(dom, () => !h.stage.busy(), 400);
}

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

describe("验收铁则 · 重力完成前视觉坐标 ≠ 逻辑坐标", () => {
  it("消除后棋子还飘在半空：视觉行是浮点、和逻辑行对不上", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    // 一路走到「下落」这一段
    expect(runUntil(dom, () => h.stage.phase() === "fall", 60)).toBeGreaterThan(0);
    expect(h.stage.movingCount()).toBeGreaterThan(0);
    // 第 0 列最底下那格,逻辑上已经是那颗幸存的星星了,视觉上它还在上面
    expect(h.stage.rowOf(12)).toBe(3);
    const seen = h.stage.visualRowOf(12);
    expect(seen).toBeLessThan(3);
    expect(seen).not.toBe(h.stage.rowOf(12));
    // 新块此刻还在棋盘顶外面（负数行）
    const spawnRow = h.stage.visualRowOf(0);
    expect(spawnRow).toBeLessThan(0);
  });

  it("下落那一段真的横跨很多帧，不是一帧到位", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    runUntil(dom, () => h.stage.phase() === "fall", 60);
    let frames = 0;
    while (h.stage.phase() === "fall" && frames < 100) {
      flushFrames(dom, 1);
      frames++;
    }
    // 三格落差 + 错峰,250 毫秒上下,16 毫秒一帧至少十来帧
    expect(frames).toBeGreaterThanOrEqual(10);
  });

  it("下落途中视觉行是单调往下走的，落地那一刻才和逻辑行对齐", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    runUntil(dom, () => h.stage.phase() === "fall", 60);
    let last = -99;
    let samples = 0;
    while (h.stage.phase() === "fall" && samples < 100) {
      const v = h.stage.visualRowOf(12);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v).toBeLessThanOrEqual(3);
      last = v;
      samples++;
      flushFrames(dom, 1);
    }
    expect(samples).toBeGreaterThan(5);
    settle(h);
    expect(h.stage.visualRowOf(12)).toBe(3);
    expect(h.stage.movingCount()).toBe(0);
  });

  it("DOM 上看得见：下落中格子带着位移，稳定之后位移清零", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    runUntil(dom, () => h.stage.phase() === "fall", 60);
    const btn = (h.stage.board as unknown as El).children[12];
    expect(btn.style.transform).toMatch(/translate\(/);
    expect(btn.style.transform).not.toBe("translate(0.00px, 0.00px)");
    settle(h);
    expect(btn.style.transform).toBe("");
  });
});

describe("时间线的段落顺序", () => {
  it("换过去 → 爆开 → 下落 → 落地 → 结算，一段都不跳", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    settle(h);
    expect(h.stage.trace()).toEqual(["swap", "boom", "fall", "land", "settle"]);
    expect(h.moves).toBe(1);
    expect(h.settled).toBe(1);
  });

  it("换不出三连就原路弹回来，不计步、盘面还原", () => {
    const h = mk([0, 1, 2]);
    const before = h.cell.grid.slice();
    h.stage.tap(0);
    h.stage.tap(1);
    settle(h);
    expect(h.stage.trace()).toEqual(["swap", "revert"]);
    expect(h.moves).toBe(0);
    expect(h.reverts).toBe(1);
    expect(h.cell.grid).toEqual(before);
  });

  it("回弹也是滑回去的：revert 那一段里两格都在动", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(0);
    h.stage.tap(1);
    runUntil(dom, () => h.stage.phase() === "revert", 40);
    expect(h.stage.movingCount()).toBe(2);
    expect(h.stage.visualColOf(0)).toBeGreaterThan(0);
  });

  it("连锁不耗步：落地之后接着消，步数只记一次", () => {
    // 补块先发三颗 4:第 0 列会再凑出一个竖三连,连锁一轮
    const h = mk([4, 4, 4, 0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    settle(h);
    const trace = h.stage.trace();
    expect(trace.filter((p) => p === "boom").length).toBeGreaterThanOrEqual(2);
    expect(trace.filter((p) => p === "fall").length).toBeGreaterThanOrEqual(2);
    expect(h.rounds).toBeGreaterThanOrEqual(2);
    // 连锁那几轮一次都没再计步
    expect(h.moves).toBe(1);
    expect(h.settled).toBe(1);
  });

  it("连锁全停之前不结算：settle 段永远排在最后一次落地之后", () => {
    const h = mk([4, 4, 4, 0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    settle(h);
    const trace = h.stage.trace();
    expect(trace[trace.length - 1]).toBe("settle");
    expect(trace.indexOf("settle")).toBe(trace.length - 1);
    expect(trace.lastIndexOf("land")).toBeLessThan(trace.indexOf("settle"));
  });

  it("死局洗牌接在结算后面：整盘从顶上重新落一次，不是原地换脸", () => {
    let asked = 0;
    const h = mk([0, 1, 2], false, (cell) => {
      // 只在第一次结算之后洗，洗完这局就算走完了
      if (++asked > 1) return false;
      return shuffleOn(cell, mulberry32(4));
    });
    h.stage.tap(12);
    h.stage.tap(13);
    settle(h);
    expect(asked).toBeGreaterThan(0);
    // 结算之后又补了一段下落 + 落地,洗牌照样占着时间线
    expect(h.stage.trace().slice(-3)).toEqual(["settle", "fall", "land"]);
  });

  it("洗牌落下来的半途中，棋子还在棋盘顶外面", () => {
    let asked = 0;
    const h = mk([0, 1, 2], false, (cell) => {
      if (++asked > 1) return false;
      return shuffleOn(cell, mulberry32(4));
    });
    h.stage.tap(12);
    h.stage.tap(13);
    // 先跑到结算,洗牌那一段紧跟在后面
    runUntil(dom, () => h.stage.phase() === "settle", 200);
    runUntil(dom, () => h.stage.phase() === "fall", 40);
    expect(h.stage.movingCount()).toBeGreaterThan(0);
    expect(h.stage.visualRowOf(0)).toBeLessThan(0);
    settle(h);
    expect(h.stage.visualRowOf(0)).toBe(0);
    expect(h.stage.movingCount()).toBe(0);
  });

  it("时间线跑着的时候不接受输入，点了也不算", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    flushFrames(dom, 2);
    expect(h.stage.busy()).toBe(true);
    h.stage.tap(0);
    h.stage.tap(1);
    settle(h);
    expect(h.moves).toBe(1);
  });
});

describe("reduced-motion 走的是同一个状态机", () => {
  it("段落顺序与终态都和正常模式一模一样，只是每段压到 1 帧", () => {
    const a = mk([0, 1, 2], false);
    a.stage.tap(12);
    a.stage.tap(13);
    settle(a);
    const fullTrace = a.stage.trace().slice();
    const fullGrid = a.cell.grid.slice();
    a.stage.destroy();

    restoreDom();
    dom = installDom(360, true);
    const b = mk([0, 1, 2], true);
    b.stage.tap(12);
    b.stage.tap(13);
    settle(b);

    expect(b.stage.trace()).toEqual(fullTrace);
    expect(b.cell.grid).toEqual(fullGrid);
    expect(b.moves).toBe(1);
    expect(b.settled).toBe(1);
    expect(b.stage.timings.boomMs).toBeLessThanOrEqual(32);
  });

  it("压到 1 帧也照样有「飘在半空」的那一帧——没有另开一条瞬变分支", () => {
    restoreDom();
    dom = installDom(360, true);
    const h = mk([0, 1, 2], true);
    h.stage.tap(12);
    h.stage.tap(13);
    const seen: Phase[] = [];
    let midAir = false;
    for (let i = 0; i < 40 && h.stage.busy(); i++) {
      flushFrames(dom, 1);
      seen.push(h.stage.phase());
      if (h.stage.phase() === "fall" && h.stage.visualRowOf(12) < 3) midAir = true;
    }
    expect(seen).toContain("fall");
    expect(midAir).toBe(true);
  });

  it("整局跑完的帧数明显更少（时长真的压下去了）", () => {
    const a = mk([0, 1, 2], false);
    a.stage.tap(12);
    a.stage.tap(13);
    const fullFrames = runUntil(dom, () => !a.stage.busy(), 400);
    a.stage.destroy();

    restoreDom();
    dom = installDom(360, true);
    const b = mk([0, 1, 2], true);
    b.stage.tap(12);
    b.stage.tap(13);
    const calmFrames = runUntil(dom, () => !b.stage.busy(), 400);
    expect(calmFrames).toBeGreaterThan(0);
    expect(calmFrames).toBeLessThan(fullFrames);
  });
});

describe("特殊块引爆也走同一条时间线", () => {
  it("火箭是一波一波炸开的，多出来的那一波是独立的 boom 段", () => {
    const h = mk([0, 1, 2]);
    h.cell.special[13] = ROCKET_H;
    h.stage.swap(12, 13);
    settle(h);
    const trace = h.stage.trace();
    expect(trace[0]).toBe("swap");
    // 引爆自己一段 boom,被点着的那一行再一段 boom
    expect(trace.filter((p) => p === "boom").length).toBeGreaterThanOrEqual(1);
    expect(trace).toContain("fall");
    expect(trace).toContain("land");
    expect(h.cell.grid.filter((v) => v === EMPTY)).toHaveLength(0);
  });
});

describe("360px 布局", () => {
  it("gap 为 0，8 列在 360px 上每格还有 44 像素以上的热区", () => {
    const w = boardWidthAt(360);
    expect(w).toBeGreaterThanOrEqual(360);
    expect(cellPitch(w, 8)).toBeGreaterThanOrEqual(44);
    expect(cellPitch(w, 6)).toBeGreaterThanOrEqual(44);
  });

  it("窄屏才往两边撑，宽屏不撑", () => {
    expect(boardBleed(360)).toBeGreaterThan(0);
    expect(boardBleed(420)).toBeGreaterThan(0);
    expect(boardBleed(768)).toBe(0);
    expect(cellPitch(0, 8)).toBe(44);
  });

  it("每一格都是一个按钮，带读屏用的行列说明", () => {
    const h = mk([0, 1, 2]);
    const board = h.stage.board as unknown as El;
    expect(board.children).toHaveLength(COLS * ROWS);
    expect(board.children[0].getAttribute("aria-label")).toContain("第 1 行第 1 列");
    expect(board.children[15].getAttribute("aria-label")).toContain("第 4 行第 4 列");
  });

  it("destroy 之后节点摘干净、rAF 也停了", () => {
    const h = mk([0, 1, 2]);
    const before = dom.root.children.length;
    h.stage.destroy();
    expect(dom.root.children.length).toBe(before - 1);
    expect(dom.cancelled.length).toBeGreaterThan(0);
    flushFrames(dom, 5);
    expect(h.stage.busy()).toBe(false);
  });
});
