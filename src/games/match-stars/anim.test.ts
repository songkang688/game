/**
 * 1.2：下落时间线的纯函数与状态机。
 *
 * 这一组守着本步的第一优先级——「消除 → 重力下落 → 顶部补块」必须是一段有时长的过程。
 * `planGravity` / `planRefill` 是那份「谁从哪儿掉到哪儿」的移动清单，
 * `Runner` 是按毫秒把各段依次播出去的骨架。两者都不碰 DOM、不吃随机数。
 */
import { describe, expect, it } from "vitest";
import {
  CALM_TIMINGS,
  FULL_TIMINGS,
  asSlide,
  fallEase,
  planBelt,
  planEndMs,
  planGravity,
  planRefill,
  planSwap,
  timings,
  tweenPos,
  tweenRow,
  Runner,
  type Phase,
} from "./anim";
import { EMPTY, refillOn, settleOn } from "./board";

const COLS = 4;
const ROWS = 4;

/** 摆一块 4×4 的小盘面：只写出非空的格子 */
function board(fill: Record<number, number>): number[] {
  const g = new Array<number>(COLS * ROWS).fill(EMPTY);
  for (const [k, v] of Object.entries(fill)) g[Number(k)] = v;
  return g;
}

describe("planGravity · 每列落点", () => {
  it("幸存块自下而上配对，落到本列最下面的空位", () => {
    // 第 0 列：第 0 行一颗、第 3 行一颗，中间空两格
    const before = board({ 0: 1, 12: 2 });
    const after = before.slice();
    settleOn(after, COLS, ROWS);
    const tweens = planGravity(before, after, COLS);
    // 贴地那颗没动，只有上面那颗要掉
    expect(tweens).toHaveLength(1);
    expect(tweens[0]).toMatchObject({ cell: 1, fromRow: 0, toRow: 2, col: 0 });
  });

  it("下落时长按「每格 60–80 毫秒」算，同列自下而上错开 20 毫秒", () => {
    // 第 1 列上面三颗、底下空一格：三颗一起往下挪一行
    const before = board({ 1: 5, 5: 6, 9: 7 });
    const after = before.slice();
    settleOn(after, COLS, ROWS);
    const tweens = planGravity(before, after, COLS).sort((a, b) => a.delayMs - b.delayMs);
    expect(tweens).toHaveLength(3);
    for (const tw of tweens) {
      const perCell = tw.durMs / (tw.toRow - tw.fromRow);
      expect(perCell).toBeGreaterThanOrEqual(60);
      expect(perCell).toBeLessThanOrEqual(80);
    }
    expect(tweens.map((t) => t.delayMs)).toEqual([0, 20, 40]);
    // 最下面那颗先动，瀑布感就是这么来的
    expect(tweens[0].fromRow).toBe(2);
  });

  it("一格没动的块不进清单（没有位移就没有 tween）", () => {
    const before = board({ 12: 1, 13: 2, 14: 3, 15: 4 });
    const after = before.slice();
    settleOn(after, COLS, ROWS);
    expect(planGravity(before, after, COLS)).toHaveLength(0);
  });

  it("补满之后的盘面拿来配对，结果和只压实时一模一样", () => {
    const before = board({ 0: 1, 12: 2, 3: 3 });
    const settled = before.slice();
    settleOn(settled, COLS, ROWS);
    const filled = settled.slice();
    refillOn(filled, COLS, ROWS, () => 9);
    expect(planGravity(before, filled, COLS)).toEqual(planGravity(before, settled, COLS));
  });

  it("冰块 / 藤蔓这类固定格自己不动，下落从它旁边穿过去", () => {
    const fixed = new Array<boolean>(COLS * ROWS).fill(false);
    fixed[COLS] = true; // 第 1 行第 0 列冻住
    const before = board({ 0: 1, 4: 8, 12: 2 });
    const after = before.slice();
    settleOn(after, COLS, ROWS, { fixed });
    const tweens = planGravity(before, after, COLS, { fixed });
    // 冻住的那颗一步没挪，上面那颗照样掉到第 2 行
    expect(tweens).toHaveLength(1);
    expect(tweens[0]).toMatchObject({ fromRow: 0, toRow: 2, col: 0 });
    expect(after[4]).toBe(8);
  });

  it("挡板把一列切成两段，上下两段各自落各自的", () => {
    const solid = new Array<boolean>(COLS * ROWS).fill(false);
    solid[2 * COLS] = true; // 第 2 行第 0 列是挡板
    const before = board({ 0: 1, 12: EMPTY });
    const after = before.slice();
    settleOn(after, COLS, ROWS, { solid });
    const tweens = planGravity(before, after, COLS, { solid });
    // 上半段只有第 0、1 行，那颗只能掉到第 1 行，掉不过挡板
    expect(tweens).toHaveLength(1);
    expect(tweens[0]).toMatchObject({ fromRow: 0, toRow: 1 });
    expect(after[12]).toBe(EMPTY);
  });

  it("不吃随机数：同样的入参永远给出同样的清单", () => {
    const before = board({ 0: 1, 1: 2, 12: 3 });
    const after = before.slice();
    settleOn(after, COLS, ROWS);
    expect(planGravity(before, after, COLS)).toEqual(planGravity(before, after, COLS));
  });
});

describe("planRefill · 补块数量与落入位置", () => {
  it("补几块就配几条 tween，一列里自下而上从 -1、-2… 行落进来", () => {
    const settled = board({ 12: 2, 8: 1 });
    const spawns = planRefill(settled, COLS).filter((s) => s.col === 0);
    expect(spawns).toHaveLength(2);
    expect(spawns.map((s) => s.toRow)).toEqual([1, 0]);
    expect(spawns.map((s) => s.fromRow)).toEqual([-1, -2]);
    for (const s of spawns) expect(s.fromRow).toBeLessThan(0);
  });

  it("补块总数正好等于盘面上的空洞数", () => {
    const settled = board({ 12: 2, 13: 3 });
    const holes = settled.filter((v) => v === EMPTY).length;
    expect(planRefill(settled, COLS)).toHaveLength(holes);
  });

  it("满盘不补块", () => {
    const full = new Array<number>(COLS * ROWS).fill(1);
    expect(planRefill(full, COLS)).toHaveLength(0);
  });

  it("挡板底下的空洞不补：那是设计好的，得先去把挡板敲了", () => {
    const solid = new Array<boolean>(COLS * ROWS).fill(false);
    solid[2 * COLS] = true;
    const settled = new Array<number>(COLS * ROWS).fill(EMPTY);
    for (let c = 1; c < COLS; c++) for (let r = 0; r < ROWS; r++) settled[r * COLS + c] = 1;
    const spawns = planRefill(settled, COLS, { solid }).filter((s) => s.col === 0);
    // 第 0 列只有挡板上方的第 0、1 行补得进
    expect(spawns.map((s) => s.toRow).sort()).toEqual([0, 1]);
  });
});

describe("tween 求值 · 视觉坐标是浮点、终点才等于逻辑坐标", () => {
  it("下落中途的视觉行既不是起点也不是终点", () => {
    const tw = { cell: 1, fromRow: 0, toRow: 3, col: 0, delayMs: 0, durMs: 210 };
    const mid = tweenRow(tw, 105);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(3);
    expect(tweenRow(tw, 0)).toBe(0);
    expect(tweenRow(tw, 210)).toBe(3);
    expect(tweenRow(tw, 9999)).toBe(3);
  });

  it("还没轮到自己出发时（delay 没过）稳稳停在起点", () => {
    const tw = { cell: 1, fromRow: 0, toRow: 2, col: 0, delayMs: 40, durMs: 140 };
    expect(tweenRow(tw, 20)).toBe(0);
    expect(tweenRow(tw, 60)).toBeGreaterThan(0);
  });

  it("下落是加速的：前半程走的路比后半程短", () => {
    expect(fallEase(0.5)).toBeLessThan(0.5);
    expect(fallEase(0)).toBe(0);
    expect(fallEase(1)).toBe(1);
  });

  it("planEndMs 取最晚一条 tween 的结束时刻", () => {
    expect(planEndMs([{ delayMs: 0, durMs: 100 }, { delayMs: 40, durMs: 210 }])).toBe(250);
    expect(planEndMs([])).toBe(0);
  });

  it("asSlide 把下落转成通用滑移，key 换成落点格子", () => {
    const s = asSlide({ cell: 7, fromRow: 0, toRow: 3, col: 2, delayMs: 0, durMs: 210 }, COLS);
    expect(s.cell).toBe(3 * COLS + 2);
    expect(s.fromCol).toBe(2);
    expect(s.toCol).toBe(2);
  });

  it("交换是两块互相滑过去，不是原地换图案", () => {
    const [ta, tb] = planSwap(0, 1, COLS, 140);
    expect(tweenPos(ta, 0)).toEqual({ row: 0, col: 1 });
    expect(tweenPos(ta, 140)).toEqual({ row: 0, col: 0 });
    expect(tweenPos(tb, 0)).toEqual({ row: 0, col: 0 });
    const mid = tweenPos(ta, 70).col;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("传送带整行滑移一格，每一格都是从邻居那儿滑过来的", () => {
    const slots = [0, 1, 2, 3];
    const tweens = planBelt(slots, 1, COLS, 200);
    expect(tweens).toHaveLength(4);
    // 往右转：落到第 1 格的那块是从第 0 格滑过来的
    expect(tweens[1]).toMatchObject({ cell: 1, fromCol: 0, toCol: 1 });
    // 绕回来的那块从最右边过来
    expect(tweens[0]).toMatchObject({ cell: 0, fromCol: 3, toCol: 0 });
    for (const tw of tweens) expect(tw.durMs).toBeGreaterThan(0);
  });
});

describe("Runner · 段落播放器", () => {
  function collect(steps: Array<{ phase: Phase; durMs: number }>): { r: Runner; log: string[] } {
    const r = new Runner();
    const log: string[] = [];
    for (const s of steps) {
      r.push({
        phase: s.phase,
        durMs: s.durMs,
        enter: () => log.push(`in:${s.phase}`),
        done: () => log.push(`out:${s.phase}`),
      });
    }
    return { r, log };
  }

  it("按顺序一段一段走，中途不会跳段", () => {
    const { r, log } = collect([
      { phase: "swap", durMs: 140 },
      { phase: "boom", durMs: 200 },
    ]);
    r.tick(0);
    expect(r.phase).toBe("swap");
    r.tick(100);
    expect(r.phase).toBe("swap");
    r.tick(140);
    expect(r.phase).toBe("boom");
    r.tick(340);
    expect(r.phase).toBe("idle");
    expect(r.busy).toBe(false);
    expect(log).toEqual(["in:swap", "out:swap", "in:boom", "out:boom"]);
    expect(r.trace).toEqual(["swap", "boom"]);
  });

  it("段落走完可以往队尾续新段——连锁就是这么接上的", () => {
    const r = new Runner();
    let chains = 0;
    const boom = (): void => {
      r.push({
        phase: "boom",
        durMs: 10,
        done: () => {
          chains++;
          if (chains < 3) boom();
        },
      });
    };
    boom();
    for (let t = 0; t <= 200; t += 10) r.tick(t);
    expect(chains).toBe(3);
    expect(r.trace.filter((p) => p === "boom")).toHaveLength(3);
  });

  it("哪怕一帧就能走完，每一段也至少被画到一帧（reduced-motion 靠这条）", () => {
    const { r, log } = collect([
      { phase: "swap", durMs: 16 },
      { phase: "boom", durMs: 16 },
      { phase: "fall", durMs: 6 },
    ]);
    const seen: Phase[] = [];
    for (let t = 0; t <= 200; t += 16) {
      r.tick(t);
      seen.push(r.phase);
    }
    expect(seen).toContain("swap");
    expect(seen).toContain("boom");
    expect(seen).toContain("fall");
    expect(log.filter((s) => s.startsWith("in:"))).toHaveLength(3);
  });

  it("progress 从 0 走到 1，读得出当前这一段走了多少", () => {
    const { r } = collect([{ phase: "boom", durMs: 200 }]);
    r.tick(0);
    expect(r.progress).toBe(0);
    r.tick(100);
    expect(r.progress).toBeCloseTo(0.5, 5);
    r.tick(190);
    expect(r.progress).toBeCloseTo(0.95, 5);
  });
});

describe("时长表 · reduced-motion 只换数字，不换状态机", () => {
  it("正常时长落在规格给的区间里", () => {
    expect(FULL_TIMINGS.swapMs).toBeGreaterThanOrEqual(120);
    expect(FULL_TIMINGS.swapMs).toBeLessThanOrEqual(160);
    expect(FULL_TIMINGS.boomMs).toBeGreaterThanOrEqual(180);
    expect(FULL_TIMINGS.boomMs).toBeLessThanOrEqual(220);
    expect(FULL_TIMINGS.perCellMs).toBeGreaterThanOrEqual(60);
    expect(FULL_TIMINGS.perCellMs).toBeLessThanOrEqual(80);
    expect(FULL_TIMINGS.staggerMs).toBe(20);
  });

  it("减少动态效果时每一段都压到 1 帧，但字段一个不少", () => {
    expect(Object.keys(CALM_TIMINGS).sort()).toEqual(Object.keys(FULL_TIMINGS).sort());
    for (const k of ["swapMs", "boomMs", "landMs", "beltMs", "settleMs"] as const) {
      expect(CALM_TIMINGS[k]).toBeLessThanOrEqual(32);
      expect(CALM_TIMINGS[k]).toBeGreaterThan(0);
    }
    // 整段下落也要在一帧内跑完，但依然是一段「有时长的下落」
    const settled = board({ 12: 1 });
    const spawns = planRefill(settled, COLS, {
      perCellMs: CALM_TIMINGS.perCellMs,
      staggerMs: CALM_TIMINGS.staggerMs,
    });
    expect(planEndMs(spawns)).toBeLessThanOrEqual(32);
    expect(planEndMs(spawns)).toBeGreaterThan(0);
  });

  it("timings(reduced) 只是在两张表之间选一张", () => {
    expect(timings(false)).toBe(FULL_TIMINGS);
    expect(timings(true)).toBe(CALM_TIMINGS);
  });
});
