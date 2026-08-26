import { describe, expect, it } from "vitest";
import { CHAPTERS, CHAPTER_STARTS, LEVELS, TOTAL } from "./levels";
import { simulateEndless, simulateLevel } from "./sim";

/**
 * 「可守住性」回归:用一套写死的固定策略(先摆颜料罐攒钱 → 每条道一炮一墙 →
 * 升科技 → 哪条道厚补哪条)把 188 关全打一遍。
 * 这套策略不看未来、不作弊,任何一关守不住都会在这里当场炸出来。
 */
describe("188 关都守得住", () => {
  const results = LEVELS.map((_, i) => simulateLevel(i));

  it("每一关合理操作都能过", () => {
    const lost = results
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => !r.win)
      .map(({ r, i }) => `第 ${i + 1} 关(第 ${r.waveReached}/${r.waveTotal} 波破防)`);
    expect(lost).toEqual([]);
  });

  it("每一关都真的打完了全部波次,不是靠超时蒙混过关", () => {
    for (let i = 0; i < TOTAL; i++) {
      expect(results[i].waveReached).toBe(results[i].waveTotal);
      expect(results[i].popped).toBeGreaterThan(0);
      expect(results[i].time).toBeLessThan(600);
    }
  });

  it("绝大多数关卡还能守出三星", () => {
    const three = results.filter((r) => r.stars === 3).length;
    expect(three).toBeGreaterThanOrEqual(Math.round(TOTAL * 0.9));
  });

  it("节奏不拖沓:第一章两分钟以内,再长的关也不超过三分半", () => {
    expect(results[0].time).toBeLessThan(120);
    for (const start of CHAPTER_STARTS) {
      expect(results[start].time).toBeLessThan(150);
    }
    expect(Math.max(...results.map((r) => r.time))).toBeLessThan(210);
  });

  it("关卡越往后越费劲:后面的关要摆更多东西、花更多颜料", () => {
    const first = results[CHAPTER_STARTS[0]];
    const last = results[TOTAL - 2];
    expect(last.paintSpent).toBeGreaterThan(first.paintSpent * 2);
    expect(last.popped).toBeGreaterThan(first.popped * 2);
  });

  it("八只章节大怪全都糊得动", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const last = CHAPTER_STARTS[ci] + CHAPTERS[ci].size - 1;
      expect(results[last].win).toBe(true);
    }
  });

  it("模拟是确定性的:同一关跑两次结果一模一样", () => {
    for (const i of [0, 47, 120, TOTAL - 1]) {
      const a = simulateLevel(i);
      const b = simulateLevel(i);
      expect({ win: a.win, hearts: a.hearts, popped: a.popped, time: a.time.toFixed(3) }).toEqual({
        win: b.win,
        hearts: b.hearts,
        popped: b.popped,
        time: b.time.toFixed(3),
      });
    }
  });
});

describe("关卡不是白送的", () => {
  it("什么都不做,188 关一关都守不住", () => {
    const freebies: number[] = [];
    for (let i = 0; i < TOTAL; i++) {
      if (simulateLevel(i, { build: false, shoot: false, tech: false }).win) freebies.push(i + 1);
    }
    expect(freebies).toEqual([]);
  });

  // 抽样跑(每 6 关一关),够说明问题又不会把整套测试拖慢
  const sample = Array.from({ length: Math.ceil(TOTAL / 6) }, (_, k) => k * 6);

  it("只摆建筑不亲自动手,后面的关会守不住(主角是有用的)", () => {
    const lost = sample.filter((i) => !simulateLevel(i, { shoot: false }).win).length;
    expect(lost).toBeGreaterThan(5);
  }, 30000);

  it("只靠主角不摆建筑,后面的关也会守不住(建筑是有用的)", () => {
    const lost = sample.filter((i) => !simulateLevel(i, { build: false }).win).length;
    expect(lost).toBeGreaterThan(5);
  }, 30000);
});

describe("无尽与合作的曲线", () => {
  it("无尽前 12 波守得住,说明前中期不是死局", () => {
    const r = simulateEndless(12);
    expect(r.win).toBe(true);
    expect(r.waveReached).toBe(12);
  });

  it("双人合作的 10 波目标是打得完的", () => {
    const r = simulateEndless(10, { coop: true });
    expect(r.win).toBe(true);
  });

  it("无尽波次越往后越难:第 12 波要糊的怪比第 4 波多得多", () => {
    const early = simulateEndless(4);
    const later = simulateEndless(12);
    expect(later.popped).toBeGreaterThan(early.popped * 2);
  });
});
