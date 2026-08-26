import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS, THEME_SETS, goalSpeechLine } from "./levels";

describe("接住小水果 99 关", () => {
  it("恰好 99 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(99);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("每关参数合法", () => {
    for (const lv of LEVELS) {
      expect(lv.target).toBeGreaterThanOrEqual(8);
      expect(lv.target).toBeLessThanOrEqual(40);
      expect(lv.spawnMs).toBeGreaterThanOrEqual(450);
      expect(lv.badChance).toBeLessThanOrEqual(0.3);
      expect(lv.badChance + lv.goldChance).toBeLessThan(0.5);
      expect(lv.theme).toBeGreaterThanOrEqual(0);
      expect(lv.theme).toBeLessThan(THEME_SETS.length);
    }
  });

  it("六章天气机关各不相同（并非同一模板）", () => {
    // 第一章无炸弹，第二章有炸弹
    expect(LEVELS[0].badChance).toBe(0);
    expect(LEVELS[20].badChance).toBeGreaterThan(0);
    // 大风天有风，其他早期章节无风
    expect(LEVELS[55].wind).toBeGreaterThan(0);
    expect(LEVELS[0].wind).toBe(0);
    // 金色午后金星概率更高
    expect(LEVELS[40].goldChance).toBeGreaterThan(LEVELS[0].goldChance);
    // 六个主题都有覆盖
    expect(new Set(LEVELS.map((l) => l.theme)).size).toBe(6);
  });

  it("章节内目标与速度递增", () => {
    expect(LEVELS[0].target).toBeLessThan(LEVELS[16].target);
    expect(LEVELS[0].speed).toBeLessThan(LEVELS[16].speed);
    expect(LEVELS[83].target).toBeLessThan(LEVELS[98].target);
  });

  it("进关朗读句与画面提示同逻辑：目标必念，机关按关卡配置追加", () => {
    // 第一章第 1 关：无炸弹无风，只念目标
    const first = goalSpeechLine(LEVELS[0]);
    expect(first).toContain(`接住 ${LEVELS[0].target} 个水果`);
    expect(first).not.toContain("小心");
    // 乌鸦章有炸弹：要念出"不能接"的是什么
    expect(goalSpeechLine(LEVELS[20])).toContain("不能接");
    // 大风天要提醒会飘
    expect(goalSpeechLine(LEVELS[55])).toContain("飘");
    // 金色午后金星概率高：要念加倍规则
    expect(goalSpeechLine(LEVELS[40])).toContain("一颗顶两颗");
  });

  it("进关朗读句不依赖表情符号也能听懂（机关都有中文名字）", () => {
    for (const th of THEME_SETS) {
      expect(th.badName.length).toBeGreaterThan(0);
      expect(th.goldName.length).toBeGreaterThan(0);
    }
    // 夜晚章：萤火虫一只顶三颗、小点心
    const night = goalSpeechLine(LEVELS[98]);
    expect(night).toContain("小点心");
    expect(night).toContain("萤火虫");
    expect(night).toContain("顶三");
  });
});
