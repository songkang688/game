/**
 * 朵星格斗王 —— 格斗塔 188 关配表与无尽曲线的回归测试。
 */
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, chapterOf } from "../level99";
import { AI_LABELS } from "./ai";
import { CHARACTERS, characterById } from "./frames";
import {
  CHAPTERS,
  STAGE_SKY,
  aiLevelOf,
  bossIdOf,
  chapterIndexOf,
  chapterStartLevel,
  difficultyScore,
  endlessAiLevel,
  endlessBuff,
  endlessEndText,
  endlessFoeId,
  endlessStarReward,
  foeBuffOf,
  foeIdOf,
  isBossLevel,
  progressOf,
  towerStage
} from "./levels";

describe("章节切分", () => {
  it("八个章节，大小之和正好 188", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "fight-king")).toBe(true);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(188);
  });

  it("每章都有名字、图标、颜色和一句介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThan(5);
      expect(ch.size).toBeGreaterThan(0);
    }
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(CHAPTERS.length);
  });

  it("每章都配了一块场地底色", () => {
    expect(STAGE_SKY.length).toBeGreaterThanOrEqual(CHAPTERS.length);
    for (const c of STAGE_SKY) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("自家的章节换算和框架的一致", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      expect(chapterIndexOf(lv), `第 ${lv + 1} 关`).toBe(chapterOf(CHAPTERS, lv));
    }
    expect(chapterStartLevel(0)).toBe(0);
    expect(chapterStartLevel(1)).toBe(CHAPTERS[0].size);
  });
});

describe("守擂者", () => {
  it("每章正好一个守擂者，位置在本章最后一关", () => {
    let count = 0;
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) if (isBossLevel(lv)) count++;
    expect(count).toBe(CHAPTERS.length);
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const last = chapterStartLevel(ci) + CHAPTERS[ci].size - 1;
      expect(isBossLevel(last)).toBe(true);
      if (last > 0) expect(isBossLevel(last - 1)).toBe(false);
    }
  });

  it("八位守擂者刚好是八位小伙伴，一人一层", () => {
    const ids = CHAPTERS.map((_, ci) => bossIdOf(ci));
    expect(new Set(ids).size).toBe(CHAPTERS.length);
    for (const id of ids) expect(CHARACTERS.some((c) => c.id === id)).toBe(true);
  });

  it("最后一关是最后一层的守擂者", () => {
    const last = towerStage(TOTAL_LEVELS - 1);
    expect(last.boss).toBe(true);
    expect(last.chapterIndex).toBe(CHAPTERS.length - 1);
    expect(last.aiLevel).toBe(2);
  });
});

describe("每关配置", () => {
  it("188 关的对手都是真的存在的角色", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const id = foeIdOf(lv);
      expect(CHARACTERS.some((c) => c.id === id), `第 ${lv + 1} 关`).toBe(true);
      expect(characterById(id).id).toBe(id);
    }
  });

  it("同一章里不会连着三关都是同一个对手", () => {
    for (let lv = 2; lv < TOTAL_LEVELS; lv++) {
      if (chapterIndexOf(lv) !== chapterIndexOf(lv - 2)) continue;
      const three = [foeIdOf(lv - 2), foeIdOf(lv - 1), foeIdOf(lv)];
      expect(new Set(three).size, `第 ${lv - 1}~${lv + 1} 关`).toBeGreaterThan(1);
    }
  });

  it("每关都有 AI 档、增益、回合数、时限和一句提示", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const s = towerStage(lv);
      expect(s.level).toBe(lv);
      expect([0, 1, 2]).toContain(s.aiLevel);
      expect(AI_LABELS[s.aiLevel].length).toBeGreaterThan(0);
      expect(s.roundsToWin).toBeGreaterThanOrEqual(1);
      expect(s.timeLimitSec).toBeGreaterThanOrEqual(60);
      expect(s.hint.length).toBeGreaterThan(4);
      expect(s.foeBuff.vigorMul).toBeGreaterThan(0.5);
      expect(s.foeBuff.powerMul).toBeGreaterThan(0.5);
      expect(s.foeBuff.speedMul).toBeGreaterThan(0.5);
    }
  });

  it("关号越界会被夹回来，不会崩", () => {
    expect(towerStage(-10).level).toBe(0);
    expect(towerStage(9999).level).toBe(TOTAL_LEVELS - 1);
    expect(progressOf(-5)).toBe(0);
    expect(progressOf(9999)).toBe(1);
  });
});

describe("难度曲线", () => {
  it("AI 档位从轻松一路走到高手", () => {
    expect(aiLevelOf(0)).toBe(0);
    expect(aiLevelOf(TOTAL_LEVELS - 1)).toBe(2);
    const levels = [0, 40, 90, 140, 187].map(aiLevelOf);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
  });

  it("守擂者比同章的普通关更难", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const last = chapterStartLevel(ci) + CHAPTERS[ci].size - 1;
      expect(difficultyScore(last)).toBeGreaterThan(difficultyScore(last - 1));
    }
  });

  it("增益一路不减，越往上越厚", () => {
    let prevV = 0;
    let prevP = 0;
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      if (isBossLevel(lv)) continue;
      const b = foeBuffOf(lv);
      expect(b.vigorMul, `第 ${lv + 1} 关元气增益`).toBeGreaterThanOrEqual(prevV);
      expect(b.powerMul, `第 ${lv + 1} 关威力增益`).toBeGreaterThanOrEqual(prevP);
      prevV = b.vigorMul;
      prevP = b.powerMul;
    }
  });

  it("第一关很友好，最后一关很硬", () => {
    const first = towerStage(0);
    const last = towerStage(TOTAL_LEVELS - 1);
    expect(first.foeBuff.vigorMul).toBeLessThan(1);
    expect(first.foeBuff.powerMul).toBeLessThan(1);
    expect(last.foeBuff.vigorMul).toBeGreaterThan(1.2);
    expect(last.foeBuff.powerMul).toBeGreaterThan(1.1);
    expect(difficultyScore(TOTAL_LEVELS - 1)).toBeGreaterThan(difficultyScore(0) * 1.8);
  });

  it("后期章节要打两个回合", () => {
    expect(towerStage(0).roundsToWin).toBe(1);
    expect(towerStage(TOTAL_LEVELS - 1).roundsToWin).toBe(2);
  });

  it("同一关每次读出来都一模一样（确定性）", () => {
    for (const lv of [0, 17, 88, 143, 187]) {
      expect(JSON.stringify(towerStage(lv))).toBe(JSON.stringify(towerStage(lv)));
    }
  });
});

describe("无尽连胜", () => {
  it("对手一直是真的角色，档位随连胜上升", () => {
    for (let i = 0; i < 40; i++) {
      expect(CHARACTERS.some((c) => c.id === endlessFoeId(i))).toBe(true);
    }
    expect(endlessAiLevel(0)).toBe(0);
    expect(endlessAiLevel(5)).toBe(1);
    expect(endlessAiLevel(20)).toBe(2);
  });

  it("增益一路涨但有封顶，不会变成打不过", () => {
    let prev = 0;
    for (let i = 0; i < 60; i++) {
      const b = endlessBuff(i);
      expect(b.vigorMul).toBeGreaterThanOrEqual(prev);
      prev = b.vigorMul;
    }
    expect(endlessBuff(999).vigorMul).toBeLessThanOrEqual(1.6);
    expect(endlessBuff(999).powerMul).toBeLessThanOrEqual(1.45);
    expect(endlessBuff(999).speedMul).toBeLessThanOrEqual(1.25);
  });

  it("结束语一直是鼓励的，连胜越多说得越热闹", () => {
    for (const n of [0, 1, 4, 8, 30]) {
      expect(endlessEndText(n).length).toBeGreaterThan(6);
    }
    expect(endlessEndText(0)).not.toBe(endlessEndText(30));
  });

  it("连胜奖励星星少而克制", () => {
    expect(endlessStarReward(0)).toBe(0);
    expect(endlessStarReward(1)).toBe(1);
    expect(endlessStarReward(4)).toBe(2);
    expect(endlessStarReward(50)).toBe(3);
  });
});
