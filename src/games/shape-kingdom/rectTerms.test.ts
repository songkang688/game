/**
 * 形状王国 · 长方形术语守门（1.2 窗口5 第 1 轮 · 档B）。
 *
 * 测试员 W5-B-04：188 关里有 12 道长方形题把短边叫「长」、长边叫「宽」。
 * 算术没错（周长 =（长 + 宽）× 2 不看谁长谁短），但这是一款数学游戏，
 * 「长」「宽」正是它在教的术语，教反了比算错更难改回来。
 *
 * 这里钉两件事：
 *  1. `rectSides()` 永远把大的那个当长、小的那个当宽；
 *  2. 遍历 188 关，凡是说出「长 x 厘米、宽 y 厘米」的地方（题面 SVG 的
 *     读屏标签、第三档提示），x 一律不小于 y，且和图形自己的 data-w/data-h 对得上。
 */
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { buildQuestions, rectFigSVG, rectSides } from "./levels";

/** 从任意文本里抓出所有「长 x 厘米、宽 y 厘米」 */
function saidSides(text: string): Array<{ long: number; short: number }> {
  const out: Array<{ long: number; short: number }> = [];
  const re = /长(?:是)? (\d+) 厘米、宽(?:是)? (\d+) 厘米/g;
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(text)) !== null) out.push({ long: Number(hit[1]), short: Number(hit[2]) });
  return out;
}

/** 从长方形题面 SVG 上读出它真正画了多宽多高 */
function drawnRect(html: string): { w: number; h: number } | null {
  const hit = /data-fig="rect" data-w="(\d+)" data-h="(\d+)"/.exec(html);
  return hit ? { w: Number(hit[1]), h: Number(hit[2]) } : null;
}

describe("形状王国 · 长方形的「长」不许比「宽」短", () => {
  it("rectSides 永远大的当长、小的当宽，正方形两个一样", () => {
    expect(rectSides(5, 6)).toEqual({ long: 6, short: 5 });
    expect(rectSides(6, 5)).toEqual({ long: 6, short: 5 });
    expect(rectSides(4, 4)).toEqual({ long: 4, short: 4 });
  });

  it("竖着画的长方形，读屏标签也把高的那条叫长", () => {
    // 测试员点名的第 100 关那一道：画出来是宽 5 × 高 6
    const svg = rectFigSVG(5, 6);
    expect(svg).toContain('data-w="5" data-h="6"');
    expect(svg).toContain('aria-label="长 6 厘米、宽 5 厘米的长方形"');
    // 图形本身一个坐标都没动：底边仍然标 5 厘米、左边仍然标 6 厘米
    expect(svg).toContain(">5 厘米</text>");
    expect(svg).toContain(">6 厘米</text>");
  });

  it("188 关全量：说出口的长宽一处都没反过来", () => {
    let checked = 0;
    let tall = 0;
    for (let level = 0; level < TOTAL_LEVELS; level++) {
      for (const q of buildQuestions(level)) {
        const rect = drawnRect(q.promptHTML ?? "");
        const text = [q.promptHTML ?? "", q.ask, ...(q.hints ?? [])].join("\n");
        for (const said of saidSides(text)) {
          checked++;
          expect(said.long, `第 ${level + 1} 关：长 ${said.long} < 宽 ${said.short}`)
            .toBeGreaterThanOrEqual(said.short);
          if (rect) {
            // 说出口的两个数就是图上那两条边，不许顺手换成别的数
            expect([said.long, said.short].sort((a, b) => a - b))
              .toEqual([rect.w, rect.h].sort((a, b) => a - b));
            if (rect.h > rect.w) tall++;
          }
        }
      }
    }
    // 自检：确实扫到了东西，而且里头真有「竖着画」的长方形（否则这条用例是空转的）
    expect(checked).toBeGreaterThan(100);
    expect(tall).toBeGreaterThan(0);
  });
});
