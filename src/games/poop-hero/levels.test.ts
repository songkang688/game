import { describe, expect, it } from "vitest";
import { assertTotal, totalSize, TOTAL_LEVELS } from "../level99";
import {
  BEAM_CLEARANCE,
  CHAPTERS,
  GOAL_INSET,
  MAX_GAP,
  MAX_PLATFORM_RISE,
  MIN_GAP,
  START_PAD,
  TOTAL,
  allLevels,
  buildCoop,
  buildEndless,
  buildLevel,
  chapterIndexOf,
  dirtCount,
  groundSolidAt,
  inAnyGap,
  indexInChapterOf,
} from "./levels";

const LEVELS = allLevels();

/** 面向孩子的文案红线:低俗、恶心、生理细节的词一个都不许出现 */
const BANNED_WORDS = [
  "屎",
  "尿",
  "屁股",
  "恶心",
  "呕",
  "吐了",
  "肮脏",
  "恶臭",
  "笨",
  "蠢",
  "傻",
  "垃圾人",
];

describe("poop-hero 章节切分", () => {
  it("正好 8 个主题章节", () => {
    expect(CHAPTERS.length).toBe(8);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
  });

  it("章节大小之和正好 188,能通过 level99 框架的校验", () => {
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    expect(TOTAL).toBe(188);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "poop-hero")).toBe(true);
  });

  it("每章都有原创中文名、emoji、粉彩色和一句话介绍", () => {
    const names = new Set<string>();
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThanOrEqual(3);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThanOrEqual(10);
      expect(ch.size).toBeGreaterThan(0);
      names.add(ch.name);
    }
    expect(names.size).toBe(CHAPTERS.length);
  });

  it("chapterIndexOf / indexInChapterOf 在章节边界上对得上", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(indexInChapterOf(0)).toBe(0);
    expect(chapterIndexOf(23)).toBe(0);
    expect(chapterIndexOf(24)).toBe(1);
    expect(indexInChapterOf(24)).toBe(0);
    expect(chapterIndexOf(187)).toBe(CHAPTERS.length - 1);
    expect(indexInChapterOf(187)).toBe(CHAPTERS[CHAPTERS.length - 1].size - 1);
  });
});

describe("poop-hero 188 关生成器", () => {
  it("正好生成 188 关,关号连续", () => {
    expect(LEVELS).toHaveLength(188);
    LEVELS.forEach((def, i) => {
      expect(def.index).toBe(i);
      expect(def.kind).toBe("campaign");
      expect(def.chapterIndex).toBe(chapterIndexOf(i));
    });
  });

  it("同一关生成两次结果完全一样(确定性)", () => {
    for (const i of [0, 47, 99, 143, 187]) {
      expect(JSON.stringify(buildLevel(i))).toBe(JSON.stringify(buildLevel(i)));
    }
  });

  it("关号越界会被夹回 0..187,不会崩", () => {
    expect(buildLevel(-5).index).toBe(0);
    expect(buildLevel(999).index).toBe(187);
    expect(buildLevel(3.4).index).toBe(3);
  });

  it("每关的路长、净化门位置都在合理范围", () => {
    for (const def of LEVELS) {
      expect(def.len).toBeGreaterThanOrEqual(1700);
      expect(def.len).toBeLessThanOrEqual(4200);
      expect(def.goalX).toBe(def.len - GOAL_INSET);
      expect(def.goalX).toBeGreaterThan(START_PAD * 2);
    }
  });

  it("路越往后越长(每章的第一关比上一章第一关长)", () => {
    let prev = 0;
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const first = LEVELS.find((d) => d.chapterIndex === ci);
      expect(first).toBeDefined();
      expect(first!.len).toBeGreaterThan(prev);
      prev = first!.len;
    }
  });

  it("断口宽度都在可跳范围内,互不重叠,也不挡住起点和净化门", () => {
    for (const def of LEVELS) {
      let last = 0;
      for (const g of def.gaps) {
        const w = g.x1 - g.x0;
        expect(w, `第 ${def.index + 1} 关断口宽度`).toBeGreaterThanOrEqual(MIN_GAP);
        expect(w, `第 ${def.index + 1} 关断口宽度`).toBeLessThanOrEqual(MAX_GAP);
        expect(g.x0).toBeGreaterThanOrEqual(START_PAD - 1);
        expect(g.x1).toBeLessThan(def.goalX - 60);
        expect(g.x0).toBeGreaterThan(last);
        last = g.x1;
      }
    }
  });

  it("要清理的脏东西全部落在实心地面上(不会掉在断口里够不着)", () => {
    for (const def of LEVELS) {
      for (const m of def.monsters) {
        expect(groundSolidAt(def, m.minX), `第 ${def.index + 1} 关臭臭怪左端`).toBe(true);
        expect(groundSolidAt(def, m.maxX), `第 ${def.index + 1} 关臭臭怪右端`).toBe(true);
        expect(inAnyGap(def.gaps, m.x)).toBe(false);
      }
      for (const s of def.stains) expect(groundSolidAt(def, s.x)).toBe(true);
      for (const s of def.sludges) {
        expect(groundSolidAt(def, s.x)).toBe(true);
        expect(groundSolidAt(def, s.x + s.w)).toBe(true);
      }
    }
  });

  it("地面上的香香星都踩得到,空中的都在一次起跳够得着的高度里", () => {
    for (const def of LEVELS) {
      for (const s of def.sparkles) {
        if (s.ground) expect(groundSolidAt(def, s.x)).toBe(true);
        // 空中香香星最高也就是平台再往上一点点
        expect(s.y).toBeGreaterThan(-(MAX_PLATFORM_RISE + 140));
        expect(s.y).toBeLessThanOrEqual(0);
      }
    }
  });

  it("空中平台不会高过一次起跳的上限", () => {
    for (const def of LEVELS) {
      for (const p of def.platforms) {
        expect(-p.y, `第 ${def.index + 1} 关平台高度`).toBeLessThanOrEqual(MAX_PLATFORM_RISE + 40);
        expect(p.w).toBeGreaterThanOrEqual(100);
        expect(p.x).toBeGreaterThan(0);
      }
    }
  });

  it("每关至少 3 处脏东西、3 颗香香星,不会空跑一趟", () => {
    for (const def of LEVELS) {
      expect(dirtCount(def), `第 ${def.index + 1} 关脏东西数`).toBeGreaterThanOrEqual(3);
      expect(def.sparkles.length, `第 ${def.index + 1} 关香香星数`).toBeGreaterThanOrEqual(3);
    }
  });

  it("开门要求从五成半慢慢升到九成,一路不倒退", () => {
    expect(LEVELS[0].requiredRatio).toBeCloseTo(0.55, 5);
    expect(LEVELS[187].requiredRatio).toBeCloseTo(0.9, 5);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].requiredRatio).toBeGreaterThanOrEqual(LEVELS[i - 1].requiredRatio - 1e-9);
      expect(LEVELS[i].requiredRatio).toBeLessThanOrEqual(0.9 + 1e-9);
    }
  });

  it("三星标准的香香星数不会超过地面上捡得到的数量", () => {
    for (const def of LEVELS) {
      const ground = def.sparkles.filter((s) => s.ground).length;
      expect(def.sparkleGoal, `第 ${def.index + 1} 关香香星目标`).toBeLessThanOrEqual(ground);
      expect(def.sparkleGoal).toBeGreaterThanOrEqual(1);
    }
  });

  it("标准用时和时间上限都留足余量", () => {
    for (const def of LEVELS) {
      expect(def.parSeconds).toBeGreaterThanOrEqual(10);
      expect(def.timeLimit).toBeGreaterThan(def.parSeconds * 2);
      expect(def.hearts).toBe(3);
      expect(def.goalNeedsAll).toBe(false);
    }
  });

  it("新机关是一章一章解锁的,不会在教之前先冒出来", () => {
    for (const def of LEVELS) {
      const ci = def.chapterIndex;
      if (def.beams.length) expect(ci === 2 || ci === 7, `第 ${def.index + 1} 关管道`).toBe(true);
      if (def.junks.length) expect(ci === 3 || ci === 7, `第 ${def.index + 1} 关废纸团`).toBe(true);
      if (def.sludges.length) expect(ci >= 2, `第 ${def.index + 1} 关泥洼`).toBe(true);
      if (def.chaserSpeed !== null) expect(ci === 4 || ci === 7).toBe(true);
      expect(def.slippery).toBe(ci === 5);
      if (ci === 0) {
        expect(def.gaps.length).toBe(0);
        expect(def.platforms.length).toBe(0);
      }
    }
  });

  it("追逐段的臭味潮速度明显慢于跑步速度(追得上但不至于追死)", () => {
    for (const def of LEVELS) {
      if (def.chaserSpeed === null) continue;
      expect(def.chaserSpeed).toBeGreaterThan(30);
      expect(def.chaserSpeed).toBeLessThan(150);
    }
  });

  it("低矮管道留出的高度刚好只够蹲着钻", () => {
    expect(BEAM_CLEARANCE).toBe(32);
    for (const def of LEVELS) {
      for (const b of def.beams) {
        expect(b.w).toBeGreaterThanOrEqual(90);
        expect(b.w).toBeLessThanOrEqual(150);
      }
    }
  });

  it("关卡名与提示语都是原创中文,不出现任何低俗或恶心的字眼", () => {
    for (const def of LEVELS) {
      const text = `${def.name}${def.hint}${def.feature}`;
      for (const bad of BANNED_WORDS) {
        expect(text.includes(bad), `第 ${def.index + 1} 关文案出现「${bad}」`).toBe(false);
      }
      expect(def.name.length).toBeGreaterThanOrEqual(4);
      expect(def.name.startsWith(CHAPTERS[def.chapterIndex].name)).toBe(true);
    }
    for (const ch of CHAPTERS) {
      for (const bad of BANNED_WORDS) {
        expect(`${ch.name}${ch.desc}`.includes(bad)).toBe(false);
      }
    }
  });
});

describe("poop-hero 无尽与双人的关卡", () => {
  it("无尽街区一段比一段长,臭味潮一段比一段快", () => {
    const a = buildEndless(0);
    const b = buildEndless(5);
    const c = buildEndless(30);
    expect(a.kind).toBe("endless");
    expect(b.len).toBeGreaterThan(a.len);
    expect(c.len).toBeGreaterThanOrEqual(b.len);
    expect((b.chaserSpeed ?? 0) > (a.chaserSpeed ?? 0)).toBe(true);
    expect(a.timeLimit).toBe(0);
    expect(a.requiredRatio).toBeCloseTo(0.7, 5);
  });

  it("无尽街区同样保证脏东西都在实心地面上", () => {
    for (let r = 0; r < 12; r++) {
      const def = buildEndless(r);
      expect(dirtCount(def)).toBeGreaterThanOrEqual(3);
      for (const m of def.monsters) expect(groundSolidAt(def, m.x)).toBe(true);
      for (const s of def.stains) expect(groundSolidAt(def, s.x)).toBe(true);
    }
  });

  it("双人合作图要求清到 100%,两个人一起到门口,心多一点", () => {
    const def = buildCoop(0);
    expect(def.kind).toBe("coop");
    expect(def.requiredRatio).toBe(1);
    expect(def.goalNeedsAll).toBe(true);
    expect(def.hearts).toBe(5);
    expect(def.chaserSpeed).toBeNull();
    expect(def.timeLimit).toBeGreaterThan(def.parSeconds);
    expect(buildCoop(4).len).toBeGreaterThan(def.len);
  });

  it("双人与无尽的关卡名同样守文案红线", () => {
    for (let r = 0; r < 8; r++) {
      for (const def of [buildEndless(r), buildCoop(r)]) {
        for (const bad of BANNED_WORDS) {
          expect(`${def.name}${def.hint}`.includes(bad)).toBe(false);
        }
      }
    }
  });
});
