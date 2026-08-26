import { describe, expect, it } from "vitest";
import { CURSOR_SPEED, SCENE_H, SCENE_W } from "./logic";
import { CHAPTERS, LEVELS, buildEndlessRound, buildVersusRound } from "./levels";
import { READ_CLUE_SEC, REACT_SEC, START_X, START_Y, levelIsBeatable, solveLevel } from "./sim";

describe("寻找外星朋友 · 限时够不够用", () => {
  it("光标出生点在场景里", () => {
    expect(START_X).toBeGreaterThan(0);
    expect(START_X).toBeLessThan(SCENE_W);
    expect(START_Y).toBeGreaterThan(0);
    expect(START_Y).toBeLessThan(SCENE_H);
    expect(CURSOR_SPEED).toBeGreaterThan(0);
  });

  it("188 关全部能在限时里用最慢的键盘玩法找完(逐关校验)", () => {
    const tight: Array<{ level: number; report: ReturnType<typeof solveLevel> }> = [];
    for (const lv of LEVELS) {
      if (!levelIsBeatable(lv)) tight.push({ level: lv.index + 1, report: solveLevel(lv) });
    }
    expect(tight).toEqual([]);
  });

  it("每一关都还留着够小朋友慢慢看的富余时间", () => {
    for (const lv of LEVELS) {
      const r = solveLevel(lv);
      expect({ level: lv.index + 1, ok: r.spare >= 6 }).toEqual({ level: lv.index + 1, ok: true });
    }
  });

  it("推理关的限时把读线索的时间也算进去了", () => {
    const deduce = LEVELS.filter((l) => l.mode === "deduce");
    expect(deduce.length).toBeGreaterThan(0);
    for (const lv of deduce) {
      if (lv.mode !== "deduce") continue;
      expect(lv.seconds).toBeGreaterThan(READ_CLUE_SEC * lv.clues.length);
    }
  });

  it("无尽前 40 轮的限时也都够用", () => {
    const tight: number[] = [];
    for (let r = 1; r <= 40; r++) {
      if (!levelIsBeatable(buildEndlessRound(r), 3)) tight.push(r);
    }
    expect(tight).toEqual([]);
  });

  it("对战场 45 秒里两个人合起来能把目标全找完", () => {
    for (let r = 1; r <= 12; r++) {
      const lv = buildVersusRound(r);
      // 对战是两个人分头找,单人跑完全程都够,两个人当然更够
      expect({ round: r, ok: levelIsBeatable(lv, 3) }).toEqual({ round: r, ok: true });
    }
  });

  it("耗时随目标数变多而变长,而且反应时间被算进去了", () => {
    const one = LEVELS.find((l) => l.mode === "find" && l.targets.length === 1);
    expect(one).toBeTruthy();
    if (one) expect(solveLevel(one).seconds).toBeGreaterThanOrEqual(REACT_SEC);
    const byTargets = LEVELS.filter((l) => l.mode === "find");
    const few = byTargets.filter((l) => l.mode === "find" && l.targets.length <= 2);
    const many = byTargets.filter((l) => l.mode === "find" && l.targets.length >= 4);
    const avg = (a: typeof few): number => a.reduce((s, l) => s + solveLevel(l).seconds, 0) / a.length;
    expect(avg(many)).toBeGreaterThan(avg(few));
  });

  it("同一关算两次结果一样(纯函数,没有藏状态)", () => {
    expect(solveLevel(LEVELS[100])).toEqual(solveLevel(LEVELS[100]));
    expect(solveLevel(LEVELS[100])).not.toEqual(solveLevel(LEVELS[101]));
  });

  it("每一章都至少抽一关跑通,报告里的数字都说得通", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const lv = LEVELS.find((l) => l.chapter === ci);
      expect(lv).toBeTruthy();
      if (!lv) continue;
      const r = solveLevel(lv);
      expect(r.seconds).toBeGreaterThan(0);
      expect(r.limit).toBe(lv.seconds);
      expect(r.spare).toBeCloseTo(r.limit - r.seconds, 1);
      expect(r.distance).toBeGreaterThanOrEqual(0);
    }
  });
});
