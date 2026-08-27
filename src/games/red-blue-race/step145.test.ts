/**
 * 守门：章节交界处不许有「一步登天」的台阶（第 2 轮测试员 W5R2-A-07，建议）。
 *
 * 测试员把 188 关逐关按熟练档（每秒 6 下、会跳、会踩点、会换气）跑了一遍，
 * 算出每一关「熟练档赢下来还剩多少秒」。整条曲线是单调收紧的，没问题；
 * 但**第 145 关（节拍风廊首关）只剩 0.98 秒**，是全 188 关最小值，
 * 比上一关（5.23 秒）一口气掉了 4.25 秒——孩子第一次撞上鼓点机制就被压到 1 秒以内。
 *
 * 收法不是「把这一章调水」：章末（第 166 关）的电脑速度 9.65 与步长 1.5 一个数没动，
 * 只把开头那一段的电脑速度放缓，并给头三关一小段步长缓坡（1.6 → 1.57 → 1.53 → 1.5）。
 * 熟练档余量 0.98 → 2.20 秒，乱点档仍旧整章一关都赢不了。
 */
import { describe, expect, it } from "vitest";
import { CHAPTERS, LEVELS } from "./levels";
import { CASUAL_PLAY, SKILLED_PLAY, simulateRace } from "./logic";

/** 熟练档赢下这一关还剩几秒；负数表示熟练档也输 */
function marginOf(index: number): number {
  const r = simulateRace(LEVELS[index], SKILLED_PLAY);
  return r.aiTime - r.meTime;
}

/** 节拍风廊在 LEVELS 里的起止（第 145 关 = 下标 144） */
const CH8_FROM = CHAPTERS.slice(0, 8).reduce((n, c) => n + c.size, 0);
const CH8_SIZE = CHAPTERS[8].size;

describe("红蓝赛跑 · 节拍风廊那一级台阶", () => {
  it("首关就是第 145 关，也确实是鼓点这套东西第一次出场", () => {
    expect(CH8_FROM).toBe(144);
    expect(CHAPTERS[8].name).toBe("节拍风廊");
    expect(LEVELS[CH8_FROM].beatMs).toBeGreaterThan(0);
    expect(LEVELS[CH8_FROM - 1].beatMs ?? 0).toBe(0);
  });

  it("第 145 关熟练档余量回到 2 秒以上（测试员实测 0.98 秒）", () => {
    expect(marginOf(CH8_FROM)).toBeGreaterThanOrEqual(2);
  });

  it("它不再是全 188 关余量最小的那一关", () => {
    const all = LEVELS.map((_, i) => marginOf(i));
    expect(marginOf(CH8_FROM)).toBeGreaterThan(Math.min(...all));
  });

  it("进这一章不再是断崖：跟上一关比掉幅收在 3.5 秒以内", () => {
    expect(marginOf(CH8_FROM - 1) - marginOf(CH8_FROM)).toBeLessThan(3.5);
  });

  it("章内也没有被推出新台阶来:单关最大掉幅不超过原来的 0.35 秒", () => {
    let worst = 0;
    for (let i = CH8_FROM + 1; i < CH8_FROM + CH8_SIZE; i++) worst = Math.max(worst, marginOf(i - 1) - marginOf(i));
    expect(worst).toBeLessThanOrEqual(0.35);
  });

  it("整章余量都在 1 秒以上", () => {
    for (let i = CH8_FROM; i < CH8_FROM + CH8_SIZE; i++) {
      expect(marginOf(i), `第 ${i + 1} 关余量太薄`).toBeGreaterThan(1);
    }
  });
});

describe("红蓝赛跑 · 放缓开头不等于放水", () => {
  it("章末（第 166 关）的电脑速度与步长一个数都没动", () => {
    const last = LEVELS[CH8_FROM + CH8_SIZE - 1];
    expect(last.aiSpeed).toBeCloseTo(9.65, 6);
    expect(last.tapStep).toBe(1.5);
  });

  it("步长缓坡只铺前三关，第 148 关起就是本章原来的 1.5", () => {
    expect(LEVELS[CH8_FROM].tapStep).toBe(1.6);
    expect(LEVELS[CH8_FROM + 1].tapStep).toBe(1.57);
    expect(LEVELS[CH8_FROM + 2].tapStep).toBe(1.53);
    for (let i = CH8_FROM + 3; i < CH8_FROM + CH8_SIZE; i++) expect(LEVELS[i].tapStep).toBe(1.5);
  });

  it("电脑速度整章仍旧单调变快", () => {
    for (let i = CH8_FROM + 1; i < CH8_FROM + CH8_SIZE; i++) {
      expect(LEVELS[i].aiSpeed).toBeGreaterThan(LEVELS[i - 1].aiSpeed);
    }
  });

  it("乱点档（手慢、不跳、不看节拍、不换气）整章还是一关都赢不了", () => {
    for (let i = CH8_FROM; i < CH8_FROM + CH8_SIZE; i++) {
      const r = simulateRace(LEVELS[i], CASUAL_PLAY);
      expect(r.aiTime - r.meTime, `第 ${i + 1} 关被乱点档白捡了`).toBeLessThan(0);
    }
  });

  it("鼓点与连击上限一个字没改——难点还是「踩不踩得准」", () => {
    expect(LEVELS[CH8_FROM].beatMs).toBe(250);
    expect(LEVELS[CH8_FROM + CH8_SIZE - 1].beatMs).toBe(250 - 21 * 2);
    expect(LEVELS[CH8_FROM].comboMax).toBe(10);
  });

  it("前 99 关一个数都没碰（这一章整个在第 100 关之后）", () => {
    expect(CH8_FROM).toBeGreaterThanOrEqual(99);
    expect(LEVELS[98].tapStep).toBe(1.6);
    expect(LEVELS[98].beatMs ?? 0).toBe(0);
  });
});
