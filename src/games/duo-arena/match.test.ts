import { describe, expect, it } from "vitest";
import {
  MAX_HANDICAP,
  applyHandicap,
  createMatch,
  handicapLabel,
  handicapRate,
  isMatchPointRound,
  keepSetup,
  keepStreak,
  levelToSetup,
  matchPoints,
  parseLevelParam,
  pushRound,
  scoreLine,
} from "./match";
import { AI_LEVELS } from "./ai";
import { STAGE_COUNT, STAGES } from "./stages";

describe("三局两胜赛制", () => {
  it("开局比分是 0 : 0,没打完也没有赛点", () => {
    const m = createMatch();
    expect(m.wins).toEqual([0, 0]);
    expect(m.done).toBe(false);
    expect(scoreLine(m)).toBe("0 : 0");
    expect(matchPoints(m)).toEqual({ p1: false, p2: false });
    expect(isMatchPointRound(m)).toBe(false);
  });

  it("先拿两个回合就赢下整场", () => {
    let m = createMatch();
    m = pushRound(m, 0);
    expect(m.done).toBe(false);
    expect(m.wins).toEqual([1, 0]);
    m = pushRound(m, 0);
    expect(m.done).toBe(true);
    expect(m.winner).toBe(0);
    expect(m.played).toBe(2);
  });

  it("赢一个回合就站上赛点,赛点局要有氛围", () => {
    let m = createMatch();
    m = pushRound(m, 1);
    expect(matchPoints(m)).toEqual({ p1: false, p2: true });
    expect(isMatchPointRound(m)).toBe(true);
    expect(scoreLine(m)).toBe("0 : 1");
  });

  it("平局回合不算谁赢,但会把比赛推向赛点局", () => {
    let m = createMatch();
    m = pushRound(m, -1);
    expect(m.wins).toEqual([0, 0]);
    expect(m.done).toBe(false);
    m = pushRound(m, -1);
    expect(isMatchPointRound(m)).toBe(true); // 第三回合是最后一个正式回合
  });

  it("三回合全平进决胜回合,决胜回合本身就是赛点局", () => {
    let m = createMatch();
    m = pushRound(m, -1);
    m = pushRound(m, -1);
    m = pushRound(m, -1);
    expect(m.done).toBe(false);
    expect(m.sudden).toBe(true);
    expect(isMatchPointRound(m)).toBe(true);
    m = pushRound(m, 1);
    expect(m.done).toBe(true);
    expect(m.winner).toBe(1);
  });

  it("赛制状态是不可变的,记完一回合不会改坏上一份", () => {
    const m0 = createMatch();
    const m1 = pushRound(m0, 0);
    expect(m0.results).toEqual([]);
    expect(m1.results).toEqual([0]);
    expect(m0.wins).toEqual([0, 0]);
  });

  it("比赛结束之后不再报赛点", () => {
    let m = createMatch();
    m = pushRound(m, 0);
    m = pushRound(m, 0);
    expect(matchPoints(m)).toEqual({ p1: false, p2: false });
    expect(isMatchPointRound(m)).toBe(false);
  });
});

describe("让分开关", () => {
  it("默认关:关着的时候一分都不让", () => {
    expect(handicapRate(false, 0, 2)).toBe(0);
    expect(handicapLabel(false)).toContain("关");
  });

  it("只帮落后的一方,领先与打平都不给", () => {
    expect(handicapRate(true, 1, 1)).toBe(0);
    expect(handicapRate(true, 2, 0)).toBe(0);
    expect(handicapRate(true, 0, 1)).toBeGreaterThan(0);
  });

  it("助推封顶 8%,落后再多也不会更多", () => {
    for (let behind = 1; behind <= 6; behind++) {
      const rate = handicapRate(true, 0, behind);
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(MAX_HANDICAP);
    }
    expect(handicapRate(true, 0, 5)).toBe(MAX_HANDICAP);
    expect(applyHandicap(100, 0.5)).toBeCloseTo(108, 6);
    expect(applyHandicap(100, -1)).toBe(100);
    expect(applyHandicap(2, 0)).toBe(2);
  });

  it("HUD 文案把开关状态写清楚", () => {
    expect(handicapLabel(true)).toContain("8%");
  });
});

describe("无尽守擂", () => {
  it("第一场是菜鸟,越守对手越强", () => {
    expect(keepSetup(1).ai).toBe("rookie");
    expect(keepSetup(2).ai).toBe("normal");
    expect(keepSetup(3).ai).toBe("pro");
    expect(keepSetup(4).ai).toBe("master");
    expect(keepSetup(12).ai).toBe("master");
  });

  it("每一场都换场地,场地表用满一圈再从头来", () => {
    const ids = [1, 2, 3, 4].map((n) => keepSetup(n).stage.id);
    expect(new Set(ids).size).toBe(Math.min(4, STAGE_COUNT));
    expect(keepSetup(1 + STAGE_COUNT).stage.id).toBe(keepSetup(1).stage.id);
    expect(keepSetup(0).bout).toBe(1);
  });

  it("守住了连胜 +1,输了就停在原地", () => {
    expect(keepStreak(0, true)).toBe(1);
    expect(keepStreak(3, true)).toBe(4);
    expect(keepStreak(3, false)).toBe(3);
    expect(keepStreak(-2, false)).toBe(0);
  });
});

describe("?level=N 映射到人机档 + 场地", () => {
  it("四关一循环走完四档,再往后换一张场地", () => {
    expect(levelToSetup(1).ai).toBe("rookie");
    expect(levelToSetup(2).ai).toBe("normal");
    expect(levelToSetup(3).ai).toBe("pro");
    expect(levelToSetup(4).ai).toBe("master");
    expect(levelToSetup(5).ai).toBe("rookie");
    expect(levelToSetup(1).stage.id).toBe(STAGES[0].id);
    expect(levelToSetup(5).stage.id).toBe(STAGES[1 % STAGE_COUNT].id);
  });

  it("任何数都落得到一个合法组合,不会越界", () => {
    for (const n of [-5, 0, 1, 7, 188, 4096]) {
      const s = levelToSetup(n);
      expect(AI_LEVELS).toContain(s.ai);
      expect(STAGES).toContain(s.stage);
      expect(s.level).toBeGreaterThanOrEqual(1);
      expect(s.label).toContain(s.stage.name);
    }
  });

  it("读得懂 ?level=,读不懂就老老实实返回 null", () => {
    expect(parseLevelParam("?level=7")).toBe(7);
    expect(parseLevelParam("?a=1&level=12&b=2")).toBe(12);
    expect(parseLevelParam("?level=0")).toBeNull();
    expect(parseLevelParam("?level=abc")).toBeNull();
    expect(parseLevelParam("")).toBeNull();
    expect(parseLevelParam("?levels=3")).toBeNull();
  });
});
