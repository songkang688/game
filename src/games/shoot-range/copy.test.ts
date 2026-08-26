import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { meta } from "./meta";
import { CHAPTERS, buildLevel } from "./levels";
import { TARGET_INFO, accuracyGrade, gradeWord, roundMessage } from "./logic";

/**
 * 分级红线的自动自审:凡是小朋友看得见的文字,都不许出现流血 / 受伤 / 死亡描写,
 * 也不许出现写实武器名词。这份清单是硬门槛,以后改文案先过这一关。
 */
const FORBIDDEN = [
  "血",
  "受伤",
  "伤口",
  "死",
  "杀",
  "尸",
  "爆炸",
  "炸死",
  "枪",
  "弹匣",
  "扳机",
  "手雷",
  "步枪",
  "狙击",
  "子弹壳",
];

/** 不许训孩子的词 */
const MEAN_WORDS = ["笨", "蠢", "真差", "没用", "废物"];

function visibleStrings(): string[] {
  const out: string[] = [meta.title, meta.blurb];
  for (const ch of CHAPTERS) out.push(ch.name, ch.desc);
  for (const info of Object.values(TARGET_INFO)) out.push(info.name, info.desc);
  for (const g of ["S", "A", "B", "C"] as const) out.push(gradeWord(g));
  for (let lv = 0; lv < TOTAL_LEVELS; lv++) out.push(buildLevel(lv).hint);
  for (const shots of [10, 12, 20]) {
    for (const hits of [10, 7, 3]) {
      for (const friendHits of [0, 2]) {
        for (const orderMistakes of [0, 1]) {
          out.push(roundMessage({ shots, hits, remaining: 0, friendHits, orderMistakes }));
        }
      }
    }
  }
  return out;
}

describe("shoot-range 分级与文案红线", () => {
  it("所有看得见的文字都没有流血 / 受伤 / 死亡描写,也没有写实武器名词", () => {
    for (const line of visibleStrings()) {
      for (const bad of FORBIDDEN) {
        expect(line.includes(bad), `「${line}」里出现了不该出现的「${bad}」`).toBe(false);
      }
    }
  });

  it("鼓励语只夸不骂,四档评级都有一句正经建议", () => {
    for (const line of visibleStrings()) {
      for (const mean of MEAN_WORDS) {
        expect(line.includes(mean), `「${line}」在训孩子`).toBe(false);
      }
    }
    for (const g of ["S", "A", "B", "C"] as const) {
      expect(gradeWord(g).length).toBeGreaterThan(6);
    }
    expect(accuracyGrade(0.2)).toBe("C");
    expect(gradeWord("C")).not.toContain("差");
  });

  it("靶子清一色是非人形或卡通对象,好人靶特别说明了不能打", () => {
    const kinds = Object.keys(TARGET_INFO);
    expect(kinds).toEqual(["bull", "balloon", "ufo", "robot", "number", "friend"]);
    expect(TARGET_INFO.friend.desc).toContain("别打");
    expect(TARGET_INFO.robot.desc).toContain("坐下");
    expect(TARGET_INFO.balloon.desc).toContain("彩纸");
  });

  it("章节名与介绍都是原创的粉彩靶场主题,没有商标或官方角色名", () => {
    expect(CHAPTERS.length).toBe(10);
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThanOrEqual(3);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
