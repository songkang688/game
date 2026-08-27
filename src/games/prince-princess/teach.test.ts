/**
 * 教学关的用例。
 *
 * 最要紧的一条是「站着不动不会失败」—— 用例真的把七章第 1 关各挂起来跑一分钟,
 * 两位主角一个键都不按,跑完必须还在玩(既没被打倒,也没超时)。
 */
import { describe, expect, it } from "vitest";

import {
  TEACH_CUE_SECONDS,
  TEACH_LINE_MAX,
  cueLegend,
  cueVisible,
  isTeachLevel,
  teachBadge,
  teachCue,
  teachLevels,
} from "./teach";
import { CHAPTERS, allLevels, buildLevel, chapterIndexOf, indexInChapterOf } from "./levels";
import { createWorld, emptyInput, stepWorld } from "./logic";
import { ELEMENT_ROLES } from "./elements";

const LEVELS = allLevels();

describe("教学关 · 排在哪儿", () => {
  it("每章第 1 关都是教学关,一共七关", () => {
    const teach = teachLevels();
    expect(teach).toHaveLength(CHAPTERS.length);
    expect(teach[0]).toBe(0);
    for (const lv of teach) {
      expect(indexInChapterOf(lv)).toBe(0);
      expect(isTeachLevel(lv)).toBe(true);
      expect(LEVELS[lv].teach, `#${lv + 1}`).toBe(true);
      expect(LEVELS[lv].noRisk, `#${lv + 1}`).toBe(true);
      expect(LEVELS[lv].timeLimit, `#${lv + 1}`).toBe(0);
    }
  });

  it("别的关都不是教学关,也都还有风险", () => {
    const teach = new Set(teachLevels());
    for (const def of LEVELS) {
      if (teach.has(def.index)) continue;
      expect(def.teach, `#${def.index + 1}`).toBe(false);
      expect(def.noRisk, `#${def.index + 1}`).toBe(false);
    }
  });

  it("教学关不是首领关 —— 第一关不该一上来就打首领", () => {
    for (const lv of teachLevels()) expect(LEVELS[lv].boss).toBeNull();
  });
});

describe("教学关 · 3 秒图形提示", () => {
  it("每章都有一条图形提示,先给图标再给一行短句", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const cue = teachCue(ci);
      expect(cue.chapterIndex).toBe(ci);
      expect(cue.icons.length).toBeGreaterThanOrEqual(2);
      for (const icon of cue.icons) expect(icon.length).toBeGreaterThan(0);
      expect(cue.line.length).toBeGreaterThan(3);
      expect(cue.line.length, `第 ${ci + 1} 章`).toBeLessThanOrEqual(TEACH_LINE_MAX);
      expect(cue.roles.length).toBeGreaterThan(0);
      for (const role of cue.roles) expect(ELEMENT_ROLES).toContain(role);
    }
  });

  it("提示只在开场 3 秒内亮着", () => {
    expect(TEACH_CUE_SECONDS).toBe(3);
    expect(cueVisible(0)).toBe(true);
    expect(cueVisible(2.9)).toBe(true);
    expect(cueVisible(3)).toBe(false);
    expect(cueVisible(9)).toBe(false);
  });

  it("提示配套的图例照的是规范表,一行一个短词", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const legend = cueLegend(teachCue(ci));
      expect(legend.length).toBe(teachCue(ci).roles.length);
      for (const line of legend) expect(line.length).toBeLessThanOrEqual(TEACH_LINE_MAX);
    }
    expect(teachBadge()).toContain("不掉心");
  });

  it("七章的提示各不相同 —— 每章只教本章的新东西", () => {
    const lines = CHAPTERS.map((_, ci) => teachCue(ci).line);
    expect(new Set(lines).size).toBe(lines.length);
  });
});

describe("教学关 · 无风险", () => {
  it("站着不动一分钟也不会失败(七章第 1 关全试一遍)", () => {
    for (const lv of teachLevels()) {
      const w = createWorld(buildLevel(lv), 2);
      const idle = [emptyInput(), emptyInput()];
      for (let i = 0; i < 60 * 60; i++) stepWorld(w, 1 / 60, idle);
      expect(w.status, `#${lv + 1} ${w.def.name}`).toBe("playing");
      expect(w.hearts, `#${lv + 1}`).toBe(w.def.hearts);
      expect(w.time).toBeGreaterThan(59);
    }
  });

  it("教学关里挨一下只闪护盾,不掉心", () => {
    const def = { ...buildLevel(0), enemies: [{ kind: "slime" as const, x: 120, minX: 120, maxX: 120, speed: 0, y: 0 }] };
    const w = createWorld(def, 2);
    w.heroes[0].x = 120;
    for (let i = 0; i < 60; i++) stepWorld(w, 1 / 60, [emptyInput(), emptyInput()]);
    expect(w.hearts).toBe(def.hearts);
    expect(w.status).toBe("playing");
  });

  it("普通关照旧会掉心 —— 无风险只给教学关", () => {
    const normal = LEVELS.find((d) => !d.teach && !d.boss)!;
    const def = { ...normal, enemies: [{ kind: "slime" as const, x: 120, minX: 120, maxX: 120, speed: 0, y: 0 }] };
    const w = createWorld(def, 2);
    w.heroes[0].x = 120;
    for (let i = 0; i < 30; i++) stepWorld(w, 1 / 60, [emptyInput(), emptyInput()]);
    expect(w.hearts).toBe(def.hearts - 1);
  });

  it("教学关也照样在自己那一章里,提示对得上章节", () => {
    for (const lv of teachLevels()) {
      expect(teachCue(chapterIndexOf(lv)).chapterIndex).toBe(chapterIndexOf(lv));
    }
  });
});
