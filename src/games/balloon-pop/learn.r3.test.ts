/**
 * 戳戳小气球 · 窗口 4 档A · 第 3 轮学习优化员（A-L16）。
 *
 * 「先处理最靠上的那几个」这条道理原来只写在失败话术里——
 * 等孩子读到它，气球已经飘走了。可上升速度是一路在变的，
 * 同一个高度开场还剩三秒、后面只剩一秒，孩子光看高度判断不出来。
 * 这一轮把它标出来：快飘出画面的气球加一圈虚线和一个上挑的箭头。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHAPTERS, LEVELS } from "./levels";
import {
  ESCAPE_WARN_S, ESCAPE_Y, GIFT_RISE_MUL, SKY_H,
  aboutToEscape, escapeIn, festRiseSpeed, goalFailure, type GoalState
} from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("戳戳小气球 · A-L16 · 快飘走的标出来", () => {
  it("剩几秒就是「还差多少距离 ÷ 上升速度」，不是拍脑袋的估计", () => {
    for (const [y, v] of [[300, 60], [100, 90], [0, 52], [ESCAPE_Y, 70]] as const) {
      expect(escapeIn(y, v)).toBeCloseTo((y - ESCAPE_Y) / v, 6);
    }
    // 已经飘出去了就是 0，不会是负数
    expect(escapeIn(ESCAPE_Y - 50, 60)).toBe(0);
    // 一动不动的气球永远不算快走
    expect(escapeIn(300, 0)).toBe(Infinity);
    expect(aboutToEscape(300, 0)).toBe(false);
  });

  it("越飘越高就越早进入预警，同一个高度上升越快也越早进入预警", () => {
    const v = 70;
    let last = true;
    for (const y of [ESCAPE_Y, 0, 60, 120, 300]) {
      const warn = aboutToEscape(y, v);
      // 越往下（y 越大）越不该报警
      if (!last) expect(warn, `y=${y}`).toBe(false);
      last = warn;
    }
    const y = 100;
    expect(aboutToEscape(y, 40)).toBe(false);
    expect(aboutToEscape(y, 400)).toBe(true);
  });

  it("预警窗口给足一次点击的时间，但不会满屏都在闪", () => {
    // 1.4 秒够孩子看见 + 抬手点一下
    expect(ESCAPE_WARN_S).toBeGreaterThanOrEqual(1);
    expect(ESCAPE_WARN_S).toBeLessThanOrEqual(2);
    // 最快的那一档上升速度下，预警区也只占天空的一小截
    const fastest = festRiseSpeed(9999);
    const band = fastest * ESCAPE_WARN_S;
    expect(band).toBeLessThan(SKY_H * 0.6);
    // 最慢的那一档下，预警区也不至于窄到看不见
    expect(festRiseSpeed(0) * ESCAPE_WARN_S).toBeGreaterThan(40);
  });

  it("量的是时间不是高度：飘得慢的礼物球也照样提前 1.4 秒亮起来", () => {
    // 礼物球飘得比普通球慢，所以同一个高度它还早着呢
    expect(GIFT_RISE_MUL).toBeLessThan(1);
    const v = festRiseSpeed(30);
    const y = v * ESCAPE_WARN_S * 1.3;
    expect(aboutToEscape(y, v)).toBe(false);
    expect(aboutToEscape(y, v * GIFT_RISE_MUL)).toBe(false);
    expect(escapeIn(y, v * GIFT_RISE_MUL)).toBeGreaterThan(escapeIn(y, v));

    // 但真到了「还剩一秒多」那一刻，快的慢的一视同仁——
    // 这正是按时间量而不是按高度量的好处：孩子拿到的反应时间是恒定的
    for (const mul of [GIFT_RISE_MUL, 1, 2]) {
      const rise = v * mul;
      const brink = ESCAPE_Y + rise * (ESCAPE_WARN_S - 0.1);
      expect(aboutToEscape(brink, rise), `mul=${mul}`).toBe(true);
      const safe = ESCAPE_Y + rise * (ESCAPE_WARN_S + 0.1);
      expect(aboutToEscape(safe, rise), `mul=${mul}`).toBe(false);
    }
  });

  it("战役里每一关的上升速度都落在「看得见预警」的区间里", () => {
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const v = LEVELS[lv].riseSpeed;
      expect(v, `第 ${lv + 1} 关`).toBeGreaterThan(0);
      // 预警区至少有一个气球那么高，也不会盖住大半个天空
      const band = v * ESCAPE_WARN_S;
      expect(band, `第 ${lv + 1} 关的预警区太窄`).toBeGreaterThan(56);
      expect(band, `第 ${lv + 1} 关的预警区盖住半个天空了`).toBeLessThan(SKY_H * 0.75);
    }
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(188);
  });

  it("失败话术里那句「先打最靠上的」现在有对应的画面了", () => {
    const st: GoalState = { popped: 0, target: 10, escaped: 9, escapes: 3, mistakes: 0, giftLost: 0 };
    expect(goalFailure("count", st)).toContain("最靠上");
    expect(SRC).toContain("aboutToEscape");
    expect(SRC).toContain("blp-leaving");
  });

  it("标记靠虚线圈 + 上挑箭头，不是只靠颜色；乌云球不标（本来就不该戳）", () => {
    expect(SRC).toContain("outline: 3px dashed");
    expect(SRC).toContain('content: "⬆"');
    // 两处（战役 / 气球节）都排除了乌云球
    const hits = [...SRC.matchAll(/b\.kind !== "cloud" && aboutToEscape\(/g)];
    expect(hits.length).toBe(2);
  });

  it("标记是每帧跟着位置一起刷的，不会留下摘不掉的旧标记", () => {
    // classList.toggle 的第二个参数每帧都重算，飘回安全区就自动摘掉
    const toggles = [...SRC.matchAll(/classList\.toggle\("blp-leaving"/g)];
    expect(toggles.length).toBe(2);
    expect(SRC).not.toContain('classList.add("blp-leaving")');
  });
});
