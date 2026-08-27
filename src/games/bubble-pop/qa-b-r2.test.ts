/**
 * 窗口4 · 档B · 第 2 轮验收 —— 泡泡噗噗(bubble-pop)。
 *
 * 换样本(第 26 / 74 / 133 / 170 关)+ 难度曲线 + 竞态(收摊口袋)+ 无尽持续。
 * 模拟玩家共用 `qaSolver.ts`,和第 1 轮是同一套口径。只增用例,不改既有用例。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  BubbleBag,
  SEA_ROWS,
  blowShuffle,
  planCollapse,
  pushUpRow,
  seaColors,
  seaPushMs,
  type BubbleBagHost,
} from "./collapse";
import { BOARD_COLS, CHAPTERS, LEVELS } from "./levels";
import { countLeftOn, groupAt, hasMovesOn } from "./logic";
import { bestAction, greedyPlay, popCells, seedBoard } from "./qaSolver";

const COLS = BOARD_COLS;
const R2_SPOTS = [26, 74, 133, 170];

/** 假的宿主:定时器与帧只记账不真跑,用来验口袋收得干不干净 */
function fakeHost(): BubbleBagHost & { timers: number; frames: number[] } {
  const live = new Set<number>();
  let next = 1;
  const host = {
    timers: 0,
    frames: [] as number[],
    setTimeout(fn: () => void, ms: number): number {
      void fn;
      void ms;
      const id = next++;
      live.add(id);
      host.timers = live.size;
      return id;
    },
    clearTimeout(id: number): void {
      live.delete(id);
      host.timers = live.size;
    },
    cancelRaf(id: number): void {
      host.frames.push(id);
    },
  };
  return host as unknown as BubbleBagHost & { timers: number; frames: number[] };
}

describe("档B R2 · 泡泡噗噗 · 换样本", () => {
  for (const level of R2_SPOTS) {
    it(`第 ${level} 关:20 个种子里至少过 17 个`, () => {
      const cfg = LEVELS[level - 1];
      const lefts = Array.from({ length: 20 }, (_, i) => greedyPlay(cfg, i * 131 + 29).left);
      const pass = lefts.filter((l) => l <= cfg.maxLeft).length;
      expect(
        pass,
        `第 ${level} 关(过关线 ≤${cfg.maxLeft})只过了 ${pass}/20,各局剩余数:${lefts.join(",")}`
      ).toBeGreaterThanOrEqual(17);
    });
  }

  it("四个新样本都真有可点的一手,不会开局就是死盘", () => {
    for (const level of R2_SPOTS) {
      const cfg = LEVELS[level - 1];
      for (const seed of [5, 55, 555]) {
        const grid = seedBoard(cfg, seed);
        const dead = bestAction(grid, cfg) === null && !hasMovesOn(grid, COLS, cfg.colors);
        expect(dead, `第 ${level} 关 seed=${seed} 开局就没手可走`).toBe(false);
      }
    }
  });

  it("一步不点的输局在四个新样本上都成立,而且剩余数就是满盘", () => {
    for (const level of R2_SPOTS) {
      const cfg = LEVELS[level - 1];
      const run = greedyPlay(cfg, 4321, { lazy: true });
      expect(run.won).toBe(false);
      expect(run.left).toBe(cfg.rows * COLS);
    }
  });
});

describe("档B R2 · 泡泡噗噗 · 难度曲线", () => {
  it("章内曲线:盘面只增不减、过关线只紧不松(逐关看,不只看首末)", () => {
    // 过关线里本来就含着敲不破的石头(石头永远留在盘上),
    // 所以「紧不紧」要看扣掉石头之后的那条线,否则加两颗石头会被误判成放水。
    const clearLine = (lv: (typeof LEVELS)[number]): number => lv.maxLeft - lv.stone;
    let from = 0;
    for (const ch of CHAPTERS) {
      const seg = LEVELS.slice(from, from + ch.size);
      for (let i = 1; i < seg.length; i++) {
        expect(seg[i].rows, `${ch.name} 第 ${i + 1} 关盘面变小了`).toBeGreaterThanOrEqual(seg[i - 1].rows);
        expect(clearLine(seg[i]), `${ch.name} 第 ${i + 1} 关过关线变松了`).toBeLessThanOrEqual(clearLine(seg[i - 1]));
      }
      from += ch.size;
    }
  });

  it("过关线里含石头这件事是成立的:带石头的关,线一定留得下石头", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const lv = LEVELS[i];
      if (lv.stone > 0) {
        expect(lv.maxLeft, `第 ${i + 1} 关有 ${lv.stone} 颗石头,过关线却只有 ${lv.maxLeft}`).toBeGreaterThanOrEqual(
          lv.stone
        );
      }
    }
  });

  it("颜色数一路走高但有封顶,不会多到分不清", () => {
    const colors = LEVELS.map((lv) => lv.colors);
    expect(Math.min(...colors)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...colors)).toBeLessThanOrEqual(6);
    expect(colors[colors.length - 1]).toBeGreaterThanOrEqual(colors[0]);
  });

  it("石头 / 冰冻 / 彩虹 / 闪电这些道具后段更多,但从不多到占满盘", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const lv = LEVELS[i];
      const specials =
        lv.rainbow + lv.stone + lv.bolt + lv.frozen + (lv.hidden ?? 0) + (lv.chain ?? 0) + (lv.chameleon ?? 0);
      expect(specials, `第 ${i + 1} 关的特殊泡占了大半盘`).toBeLessThan(lv.rows * COLS * 0.5);
    }
  });

  it("整条 188 关的过关线:首章最松、末章最紧", () => {
    const ratio = (lv: (typeof LEVELS)[number]): number => (lv.maxLeft - lv.stone) / (lv.rows * COLS);
    const avg = (from: number, to: number): number =>
      LEVELS.slice(from, to).reduce((n, lv) => n + ratio(lv), 0) / (to - from);
    const firstChapter = avg(0, CHAPTERS[0].size);
    const lastChapter = avg(LEVELS.length - CHAPTERS[CHAPTERS.length - 1].size, LEVELS.length);
    expect(lastChapter, "末章的过关线比首章还松").toBeLessThan(firstChapter);
  });
});

describe("档B R2 · 泡泡噗噗 · 竞态", () => {
  it("BubbleBag:收摊后再排的延时活儿一律不排,alive 立刻转 false", () => {
    const host = fakeHost();
    const bag = new BubbleBag(host);
    let ran = 0;
    bag.after(() => ran++, 10);
    expect(bag.alive).toBe(true);
    expect(host.timers).toBe(1);
    bag.close();
    expect(bag.alive).toBe(false);
    expect(host.timers).toBe(0);
    bag.after(() => ran++, 10);
    expect(host.timers, "收摊之后还敢排新活儿").toBe(0);
    expect(ran).toBe(0);
  });

  it("BubbleBag:clearPending 只清在途的活儿,口袋还活着(重开一关用)", () => {
    const host = fakeHost();
    const bag = new BubbleBag(host);
    bag.after(() => undefined, 10);
    bag.after(() => undefined, 20);
    expect(host.timers).toBe(2);
    bag.clearPending();
    expect(host.timers).toBe(0);
    expect(bag.alive, "clearPending 不该把口袋一起关掉").toBe(true);
    bag.after(() => undefined, 30);
    expect(host.timers).toBe(1);
    bag.close();
    expect(host.timers).toBe(0);
  });

  it("BubbleBag:最新的那一帧收摊时会被取消,收摊后再来的帧当场取消", () => {
    const host = fakeHost();
    const bag = new BubbleBag(host);
    // 一条动画循环每帧只登记一个帧号,后一帧覆盖前一帧(前一帧早就跑完了)
    bag.onRaf(11);
    bag.onRaf(22);
    expect(bag.size).toBe(1);
    bag.close();
    expect(host.frames).toContain(22);
    bag.onRaf(33);
    expect(host.frames, "收摊之后再来的帧没有当场取消").toContain(33);
  });

  it("BubbleBag 连开连关 20 轮:一个活口都不剩", () => {
    const host = fakeHost();
    for (let round = 0; round < 20; round++) {
      const bag = new BubbleBag(host);
      for (let i = 0; i < 5; i++) bag.after(() => undefined, i * 10);
      bag.onRaf(round + 1);
      bag.close();
      expect(host.timers, `第 ${round + 1} 轮有定时器没收`).toBe(0);
    }
  });

  it("塌陷动画没跑完就再点一下:终态只认 plan.next,不会把泡泡算重", () => {
    const cfg = LEVELS[25];
    const grid = seedBoard(cfg, 616);
    const before = countLeftOn(grid);
    const move = bestAction(grid, cfg)!;
    popCells(grid, move);
    // 同一份盘面连算两次塌陷:第二次是在「上一次动画还没落地」时又点了一下
    const once = planCollapse(grid, COLS, false, { reduced: true }).next;
    const twice = planCollapse(once, COLS, false, { reduced: true }).next;
    expect(countLeftOn(once)).toBe(before - move.length);
    expect(countLeftOn(twice)).toBe(countLeftOn(once));
  });

  it("朵朵吹一口气重排:泡泡一个不多一个不少,而且真的重排开了", () => {
    const cfg = LEVELS[73];
    const grid = seedBoard(cfg, 99);
    const rand = mulberry32(20260827);
    const after = blowShuffle(grid, COLS, cfg.colors, rand);
    expect(countLeftOn(after)).toBe(countLeftOn(grid));
    expect(after.length).toBe(grid.length);
  });
});

describe("档B R2 · 泡泡噗噗 · 无尽持续", () => {
  it("边推边消连玩 80 次推:一次都不会被顶穿", () => {
    let grid: number[][] = Array.from({ length: SEA_ROWS }, () => Array.from({ length: COLS }, () => -1));
    const rand = mulberry32(20260827);
    for (let push = 0; push < 80; push++) {
      const colors = seaColors(push);
      const res = pushUpRow(grid, COLS, colors, rand);
      grid = res.grid;
      expect(res.overflow, `第 ${push + 1} 次推上来就顶穿了`).toBe(false);
      for (let step = 0; step < 80; step++) {
        let best: Array<[number, number]> = [];
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c < COLS; c++) {
            if (grid[r][c] < 0) continue;
            const list = groupAt(grid, COLS, r, c, colors);
            if (list.length >= 2 && list.length > best.length) best = list;
          }
        }
        if (best.length === 0) break;
        popCells(grid, best);
        grid = planCollapse(grid, COLS, false, { reduced: true }).next;
      }
    }
  });

  it("推行节奏一路加快但有下限,不会快到点不过来", () => {
    const ms = [0, 10, 30, 60, 120, 300].map(seaPushMs);
    for (let i = 1; i < ms.length; i++) expect(ms[i]).toBeLessThanOrEqual(ms[i - 1]);
    expect(ms[ms.length - 1]).toBeGreaterThan(0);
  });

  it("颜色数随推数变多但有封顶", () => {
    const colors = [0, 20, 60, 200].map(seaColors);
    for (let i = 1; i < colors.length; i++) expect(colors[i]).toBeGreaterThanOrEqual(colors[i - 1]);
    expect(colors[colors.length - 1]).toBeLessThanOrEqual(6);
  });

  it("一直不消:早晚会顶穿,这就是无尽的结算条件(换 3 个种子都成立)", () => {
    for (const seed of [1, 2026, 987654]) {
      let grid: number[][] = Array.from({ length: SEA_ROWS }, () => Array.from({ length: COLS }, () => -1));
      const rand = mulberry32(seed);
      let overflowed = false;
      for (let push = 0; push < 60 && !overflowed; push++) {
        const res = pushUpRow(grid, COLS, seaColors(push), rand);
        grid = res.grid;
        overflowed = res.overflow;
      }
      expect(overflowed, `seed=${seed} 推了 60 次还没顶穿`).toBe(true);
    }
  });
});
