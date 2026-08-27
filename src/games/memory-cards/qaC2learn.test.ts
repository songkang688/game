// 档C · 第 2 轮学习优化员 · L2-05:五款的无尽曲线收敛到同一个口径。
//
// 第 1 轮在 memory-cards 上先立了 endlessDifficulty 这个写法(L1-03 / L1-04),
// 第 2 轮把 alien-seek / box-hamster / snake-snack 也补齐,四款都能用同一句话验:
// 「难度分只增不减 + 到顶之前不会连着走平 + 到顶之后老老实实是同一个分数」。
//
// bubble-aim 的无尽是另一种结构(每 5 发压一行,压到顶就收工),
// 难度天然随压行数无上限地涨,没有「到顶」这回事,所以不进这张表——
// 它单独由「压行数越多越难」那条断言盯着。
import { describe, expect, it } from "vitest";
import {
  ENDLESS_MAX_PAIRS,
  ENDLESS_ROTATE_FROM,
  ENDLESS_SWAP_FROM,
  endlessDifficulty as memoryDifficulty,
  endlessPairs,
  endlessTwist,
} from "./logic";
import {
  ENDLESS_PEAK_ROUND as SEEK_PEAK,
  endlessDifficulty as seekDifficulty,
} from "../alien-seek/logic";
import {
  ENDLESS_PEAK_ROUND as BOX_PEAK,
  endlessDifficulty as boxDifficulty,
} from "../box-hamster/levels";
import {
  ENDLESS_PEAK_GARDEN as SNAKE_PEAK,
  endlessDifficulty as snakeDifficulty,
} from "../snake-snack/levels";
import { ENDLESS_PUSH_EVERY, endlessShouldPush } from "../bubble-aim/aim12";

/** memory-cards 的难度分第几轮到顶:组数第 8 轮封顶,两样机关分别到第 32 / 34 轮 */
const MEMORY_PEAK = 34;

interface Curve {
  game: string;
  /** 第一轮的编号:box-hamster 是 0 基,另外三款是 1 基 */
  first: number;
  peak: number;
  at: (n: number) => number;
}

const CURVES: Curve[] = [
  { game: "alien-seek", first: 1, peak: SEEK_PEAK, at: seekDifficulty },
  { game: "box-hamster", first: 0, peak: BOX_PEAK, at: boxDifficulty },
  { game: "snake-snack", first: 1, peak: SNAKE_PEAK, at: snakeDifficulty },
  { game: "memory-cards", first: 1, peak: MEMORY_PEAK, at: memoryDifficulty },
];

describe("档C R2 学习优化 · L2-05 四款无尽曲线同一口径", () => {
  it("四款都有 endlessDifficulty,而且四款都真的接进了各自的无尽", () => {
    expect(CURVES).toHaveLength(4);
    for (const c of CURVES) {
      expect(typeof c.at, c.game).toBe("function");
      expect(Number.isFinite(c.at(c.first)), c.game).toBe(true);
    }
  });

  it("难度分只增不减,一款都不许掉头", () => {
    for (const c of CURVES) {
      for (let n = c.first + 1; n <= 200; n++) {
        expect(c.at(n), `${c.game} 第 ${n} 轮比上一轮还容易`).toBeGreaterThanOrEqual(c.at(n - 1));
      }
    }
  });

  it("到顶之前不会连着 10 轮一动不动", () => {
    for (const c of CURVES) {
      for (let n = c.first; n + 10 <= c.peak; n++) {
        expect(c.at(n + 10), `${c.game} 第 ${n} 轮到第 ${n + 10} 轮完全没变`).toBeGreaterThan(c.at(n));
      }
    }
  });

  it("到顶之后老老实实是同一个分数(是天花板,不是忘了继续加)", () => {
    for (const c of CURVES) {
      const peak = c.at(c.peak);
      for (const n of [c.peak, c.peak + 1, c.peak + 20, 200, 999]) {
        expect(c.at(n), `${c.game} 第 ${n} 轮`).toBe(peak);
      }
    }
  });

  it("四款到顶的位置都在第 30 轮以后,不会玩几局就摸到天花板", () => {
    for (const c of CURVES) {
      expect(c.peak, `${c.game} 太早到顶`).toBeGreaterThanOrEqual(30);
    }
  });

  it("轮号越界一律按第一轮算,不会算出 NaN 或负分", () => {
    for (const c of CURVES) {
      for (const n of [-99, -1, 0, 0.4]) {
        const v = c.at(n);
        expect(Number.isFinite(v), `${c.game} 第 ${n} 轮`).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        if (n < c.first) expect(v, `${c.game} 第 ${n} 轮`).toBe(c.at(c.first));
      }
    }
  });

  it("memory-cards 那一条的分段和第 1 轮落地的那批常数还对得上", () => {
    expect(endlessPairs(8)).toBe(ENDLESS_MAX_PAIRS);
    expect(endlessTwist(ENDLESS_SWAP_FROM - 1).swapEvery).toBe(0);
    expect(endlessTwist(ENDLESS_SWAP_FROM).swapEvery).toBeGreaterThan(0);
    expect(endlessTwist(ENDLESS_ROTATE_FROM - 1).rotateEvery).toBe(0);
    expect(endlessTwist(ENDLESS_ROTATE_FROM).rotateEvery).toBeGreaterThan(0);
    // 组数封顶之后靠机关继续往上垫
    expect(memoryDifficulty(30)).toBeGreaterThan(memoryDifficulty(8));
  });

  it("bubble-aim 的无尽不进这张表:它按压行数一直涨,没有到顶这回事", () => {
    expect(ENDLESS_PUSH_EVERY).toBeGreaterThan(0);
    for (let shots = 1; shots <= 200; shots++) {
      expect(endlessShouldPush(shots)).toBe(shots % ENDLESS_PUSH_EVERY === 0);
    }
    // 打得越久压得越多,没有上限
    const pushesBy = (shots: number): number => Math.floor(shots / ENDLESS_PUSH_EVERY);
    expect(pushesBy(1000)).toBeGreaterThan(pushesBy(500));
  });
});
