import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { buildBoard, CHAPTERS, LEVELS, THEME_POOLS } from "./levels";

describe("找不同 99 关", () => {
  it("恰好 99 关", () => {
    expect(LEVELS).toHaveLength(99);
  });

  it("至少 6 个主题章节，章节大小之和为 99", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("每关双图合法：不同点数量正确且只在标记处不同", () => {
    for (let i = 0; i < 99; i++) {
      const cfg = LEVELS[i];
      const { base, changed, diffIdx } = buildBoard(i);
      const n = cfg.rows * cfg.cols;
      expect(base).toHaveLength(n);
      expect(changed).toHaveLength(n);
      expect(diffIdx).toHaveLength(cfg.diffs);
      expect(cfg.diffs).toBeLessThan(n / 2);
      const diffSet = new Set(diffIdx);
      for (let k = 0; k < n; k++) {
        if (diffSet.has(k)) expect(changed[k]).not.toBe(base[k]);
        else expect(changed[k]).toBe(base[k]);
      }
    }
  });

  it("图案都来自本章主题池（或双胞胎替换）", () => {
    const all = new Set(THEME_POOLS.flat().concat(["🎂", "🍬", "🍪", "🌟", "🌠"]));
    for (const i of [0, 20, 40, 55, 70, 98]) {
      const { base, changed } = buildBoard(i);
      for (const e of base.concat(changed)) expect(all.has(e)).toBe(true);
    }
  });

  it("同一关重试布局一致（确定性生成）", () => {
    for (const i of [0, 20, 45, 70, 98]) {
      expect(JSON.stringify(buildBoard(i))).toBe(JSON.stringify(buildBoard(i)));
    }
  });

  it("六章玩法各不相同（并非同一模板）", () => {
    const sig = (i: number) => {
      const lv = LEVELS[i];
      return `${lv.theme}|${lv.rows}x${lv.cols}|${lv.lookalike ? "像" : ""}|${lv.timeSec > 0 ? "限时" : ""}`;
    };
    const sigs = new Set([sig(2), sig(19), sig(36), sig(55), sig(70), sig(95)]);
    expect(sigs.size).toBe(6);
    // 后期章节有双胞胎替换和时间限制
    expect(LEVELS[55].lookalike).toBe(true);
    expect(LEVELS[70].timeSec).toBeGreaterThan(0);
  });

  it("难度递进：棋盘变大、不同点变多、时间变紧", () => {
    expect(LEVELS[0].rows * LEVELS[0].cols).toBeLessThan(LEVELS[98].rows * LEVELS[98].cols);
    expect(LEVELS[0].diffs).toBeLessThan(LEVELS[98].diffs);
    expect(LEVELS[98].timeSec).toBeLessThan(LEVELS[83].timeSec);
    expect(LEVELS[0].maxMiss).toBeGreaterThan(LEVELS[98].maxMiss);
  });
});
