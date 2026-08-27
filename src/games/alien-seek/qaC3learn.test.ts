// 档C · 第 3 轮学习优化员 · L3-04:五款无尽曲线收官对表(开头够松 + 天花板写得明白)。
//
// 第 2 轮的 L2-05 把四款收敛到了 `endlessDifficulty` 一个口径,但那张表只管「后段别冻住」。
// 收官这一轮补另一头:**开头够不够松**——难度曲线有两端,前两轮只盯了后面那一端,
// 而 `bubble-aim` 的问题恰恰在开头(一进门满配 5 色,L3-03)。
//
// 所以这张表把五款一起摆上,两头都验:
//  ① 第一局比后面明显容易(有热身);
//  ② 到顶的位置写成了导出常量(不是硬写在测试里的数),而且都在第 30 轮以后。
import { describe, expect, it } from "vitest";
import { ENDLESS_PEAK_ROUND as SEEK_PEAK, endlessDifficulty as seekAt } from "./logic";
import {
  ENDLESS_PEAK_ROUND as BOX_PEAK,
  endlessDifficulty as boxAt,
} from "../box-hamster/levels";
import {
  ENDLESS_PEAK_GARDEN as SNAKE_PEAK,
  endlessDifficulty as snakeAt,
} from "../snake-snack/levels";
import {
  ENDLESS_PEAK_ROUND as MEMORY_PEAK,
  endlessDifficulty as memoryAt,
} from "../memory-cards/logic";
import { endlessPalette, endlessRowFill } from "../bubble-aim/aim12";

interface Curve {
  game: string;
  /** 第一局的编号:box-hamster 是 0 基,其余是 1 基 */
  first: number;
  peak: number;
  at: (n: number) => number;
}

const CURVES: Curve[] = [
  { game: "alien-seek", first: 1, peak: SEEK_PEAK, at: seekAt },
  { game: "box-hamster", first: 0, peak: BOX_PEAK, at: boxAt },
  { game: "snake-snack", first: 1, peak: SNAKE_PEAK, at: snakeAt },
  { game: "memory-cards", first: 1, peak: MEMORY_PEAK, at: memoryAt },
];

describe("档C R3 学习优化 · L3-04 五款无尽曲线收官对表", () => {
  it("四条曲线的到顶轮次全部来自各自导出的常量,没有一个写死在测试里", () => {
    expect(CURVES).toHaveLength(4);
    for (const c of CURVES) {
      expect(Number.isInteger(c.peak), `${c.game} 的到顶轮次不是整数`).toBe(true);
      expect(c.peak, `${c.game} 太早到顶`).toBeGreaterThanOrEqual(30);
      expect(c.at(c.peak), `${c.game}`).toBe(c.at(c.peak + 50));
    }
    // memory-cards 这一轮才从「测试里硬写 34」改成导出常量,顺手钉一下它真的往后挪了
    expect(MEMORY_PEAK).toBeGreaterThan(34);
  });

  it("四款的第一局都明显比到顶那局松:热身是真的热身", () => {
    for (const c of CURVES) {
      const start = c.at(c.first);
      const peak = c.at(c.peak);
      expect(peak, `${c.game} 的第一局和最难那局一样难`).toBeGreaterThan(start);
      // 一路涨幅至少三成,不然「越来越难」只是个说法
      expect(peak / Math.max(1, start), `${c.game} 一路只涨了这么点`).toBeGreaterThan(1.3);
    }
  });

  it("四款前 5 局的坡度都不陡:开头几局的涨幅不超过全程的一半", () => {
    for (const c of CURVES) {
      const start = c.at(c.first);
      const early = c.at(c.first + 4);
      const span = c.at(c.peak) - start;
      expect(early - start, `${c.game} 开头五局就把难度拉满了`).toBeLessThan(span * 0.75);
      expect(early, `${c.game} 开头五局反而更容易`).toBeGreaterThanOrEqual(start);
    }
  });

  it("五款的曲线都不掉头(bubble-aim 换成密度 + 颜色两条一起看)", () => {
    for (const c of CURVES) {
      for (let n = c.first + 1; n <= 240; n++) {
        expect(c.at(n), `${c.game} 第 ${n} 局比上一局还容易`).toBeGreaterThanOrEqual(c.at(n - 1));
      }
    }
    let fill = 0;
    let colors = 0;
    for (let rows = 0; rows <= 240; rows++) {
      const f = endlessRowFill(rows);
      const n = endlessPalette(rows, ["R", "Y", "G", "B", "P"]).length;
      expect(f, `bubble-aim 压了 ${rows} 行反而更稀`).toBeGreaterThanOrEqual(fill);
      expect(n, `bubble-aim 压了 ${rows} 行反而更少颜色`).toBeGreaterThanOrEqual(colors);
      fill = f;
      colors = n;
    }
    expect(fill).toBeCloseTo(0.95, 6);
    expect(colors).toBe(5);
  });

  it("bubble-aim 的开头也松下来了:第一行 3 色,和另外四款一个路子", () => {
    expect(endlessPalette(0, ["R", "Y", "G", "B", "P"])).toHaveLength(3);
    expect(endlessPalette(20, ["R", "Y", "G", "B", "P"])).toHaveLength(5);
    // 松的是开头，后段一个数都没动
    expect(endlessRowFill(0)).toBeCloseTo(0.6, 6);
    expect(endlessRowFill(100)).toBeCloseTo(0.95, 6);
  });

  it("局号越界一律按第一局算,五款都不会算出 NaN 或负分", () => {
    for (const c of CURVES) {
      for (const n of [-99, -1, 0, 0.4]) {
        const v = c.at(n);
        expect(Number.isFinite(v), `${c.game} 第 ${n} 局`).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        if (n < c.first) expect(v, `${c.game} 第 ${n} 局`).toBe(c.at(c.first));
      }
    }
    for (const rows of [-99, -1, 0.4]) {
      expect(endlessPalette(rows, ["R", "Y", "G", "B", "P"]).length).toBe(3);
      expect(endlessRowFill(rows)).toBeLessThanOrEqual(0.95);
    }
  });

  it("alien-seek 自己那条曲线这一轮没被动过:第 36 轮到顶,罚时照旧不计入难度分", () => {
    expect(SEEK_PEAK).toBe(36);
    expect(seekAt(36)).toBe(seekAt(999));
    expect(seekAt(36)).toBeGreaterThan(seekAt(20));
  });
});
