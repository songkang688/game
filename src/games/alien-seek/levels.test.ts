import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, chapterOf, totalSize } from "../level99";
import {
  NEIGHBOR_N,
  SCENE_H,
  SCENE_W,
  clueHolds,
  clueText,
  solveDeduction,
  type Clue,
  type Spot,
} from "./logic";
import {
  ALIEN_NAMES,
  BIG_R,
  CHAPTERS,
  CLUE_ITEMS,
  DEDUCE_FROM_CHAPTER,
  DEDUCE_LEVELS,
  LEVELS,
  MARGIN,
  MAX_CLUES,
  MIN_CLUES,
  buildEndlessRound,
  buildLevel,
  buildVersusRound,
  isDeduceLevel,
  layoutSpots,
  spotsOverlap,
  type SeekLevel,
} from "./levels";

/** 每一关都该满足的基本形状 */
function checkShape(lv: SeekLevel): void {
  expect(lv.spots.length).toBeGreaterThanOrEqual(4);
  expect(lv.spots.length).toBeLessThanOrEqual(16);
  expect(lv.seconds).toBeGreaterThan(0);
  expect(lv.hint.length).toBeGreaterThan(4);
  expect(spotsOverlap(lv.spots)).toBe(false);
  for (const s of lv.spots) {
    expect(s.x).toBeGreaterThanOrEqual(MARGIN - BIG_R);
    expect(s.x).toBeLessThanOrEqual(SCENE_W - MARGIN + BIG_R);
    expect(s.y).toBeGreaterThanOrEqual(MARGIN - BIG_R);
    expect(s.y).toBeLessThanOrEqual(SCENE_H - MARGIN + BIG_R);
    expect(s.r).toBeGreaterThanOrEqual(20);
    expect(s.r).toBeLessThanOrEqual(BIG_R);
  }
  // 同一张场景里,「大」的藏身点画得确实比「小」的大,推理线索才立得住
  const bigR = lv.spots.filter((s) => s.big).map((s) => s.r);
  const smallR = lv.spots.filter((s) => !s.big).map((s) => s.r);
  if (bigR.length && smallR.length) expect(Math.min(...bigR)).toBeGreaterThan(Math.max(...smallR));
  // 「颜色 + 种类」在同一张场景里不能重复,否则线索里那句「粉色的木箱」就指歪了
  const combos = new Set(lv.spots.map((s) => `${s.color}/${s.kind}`));
  expect(combos.size).toBe(lv.spots.length);

  if (lv.mode === "find") {
    expect(lv.targets.length).toBeGreaterThanOrEqual(1);
    expect(lv.targets.length).toBeLessThan(lv.spots.length);
    const seen = new Set<number>();
    for (const t of lv.targets) {
      expect(t.spot).toBeGreaterThanOrEqual(0);
      expect(t.spot).toBeLessThan(lv.spots.length);
      expect(seen.has(t.spot)).toBe(false);
      seen.add(t.spot);
      expect(t.name.length).toBeGreaterThan(0);
    }
    expect(lv.targets[0].role).toBe("alien");
  } else {
    expect(lv.answer).toBeGreaterThanOrEqual(0);
    expect(lv.answer).toBeLessThan(lv.spots.length);
    expect(lv.clues.length).toBeGreaterThanOrEqual(MIN_CLUES);
    expect(lv.clues.length).toBeLessThanOrEqual(MAX_CLUES);
  }
}

describe("寻找外星朋友 · 章节切分", () => {
  it("八个章节,总数正好 188", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "alien-seek")).toBe(true);
  });

  it("章节名与角色名都是本作原创的纯中文,不掺任何外来名号", () => {
    // 商标和官方角色名基本都带拉丁字母或数字;这里直接卡死「只许出现汉字」,
    // 比列黑名单稳妥,也省得把那些名字写进仓库里。
    for (const ch of CHAPTERS) expect(ch.name).toMatch(/^[\u4e00-\u9fa5]+$/);
    for (const n of ALIEN_NAMES) {
      expect(n).toMatch(/^[\u4e00-\u9fa5]+$/);
      expect(n.length).toBeGreaterThanOrEqual(2);
    }
    for (const it of CLUE_ITEMS) expect(it).toMatch(/^[\u4e00-\u9fa5]+$/);
    expect(new Set(ALIEN_NAMES).size).toBe(ALIEN_NAMES.length);
    expect(new Set(CLUE_ITEMS).size).toBe(CLUE_ITEMS.length);
    // 外星小朋友必须来自本作既有的原创角色
    const CAST = ["鸭梨", "康康", "糯糯", "云云", "墩墩", "闪闪", "绿绿豆", "啾啾"];
    for (const n of ALIEN_NAMES) expect(CAST).toContain(n);
  });

  it("每章都有名字、图标、颜色和一句介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThan(5);
      expect(ch.size).toBeGreaterThan(0);
    }
  });
});

describe("寻找外星朋友 · 188 关", () => {
  it("正好 188 关,每关形状都合法", () => {
    expect(LEVELS.length).toBe(TOTAL_LEVELS);
    for (const lv of LEVELS) checkShape(lv);
  });

  it("关号与章节对得上,同一关重开布局不变", () => {
    LEVELS.forEach((lv, i) => {
      expect(lv.index).toBe(i);
      expect(lv.chapter).toBe(chapterOf(CHAPTERS, i));
    });
    expect(JSON.stringify(buildLevel(42))).toBe(JSON.stringify(buildLevel(42)));
    expect(JSON.stringify(buildLevel(42))).not.toBe(JSON.stringify(buildLevel(43)));
  });

  it("越往后藏身点越多、限时越紧", () => {
    expect(LEVELS[187].spots.length).toBeGreaterThan(LEVELS[0].spots.length);
    const early = LEVELS.slice(0, 24).filter((l) => l.mode === "find");
    const late = LEVELS.slice(72, 96).filter((l) => l.mode === "find");
    const avg = (a: SeekLevel[]): number => a.reduce((s, l) => s + l.seconds, 0) / a.length;
    expect(avg(late)).toBeLessThan(avg(early));
  });

  it("前五章全是找物关,推理关只出现在后三章", () => {
    for (const lv of LEVELS) {
      if (lv.chapter < DEDUCE_FROM_CHAPTER) expect(lv.mode).toBe("find");
    }
    expect(DEDUCE_LEVELS.length).toBeGreaterThanOrEqual(30);
    for (const lv of DEDUCE_LEVELS) expect(lv.chapter).toBeGreaterThanOrEqual(DEDUCE_FROM_CHAPTER);
    expect(isDeduceLevel(0)).toBe(false);
    expect(isDeduceLevel(187)).toBe(isDeduceLevel(187));
  });

  it("后三章里找物关和推理关是混着来的,不会整章只有一种", () => {
    for (let ci = DEDUCE_FROM_CHAPTER; ci < CHAPTERS.length; ci++) {
      const inCh = LEVELS.filter((l) => l.chapter === ci);
      expect(inCh.some((l) => l.mode === "deduce")).toBe(true);
      expect(inCh.some((l) => l.mode === "find")).toBe(true);
    }
  });

  it("找物关的目标数随章节变多,而且外星朋友只有一个", () => {
    for (const lv of LEVELS) {
      if (lv.mode !== "find") continue;
      expect(lv.targets.filter((t) => t.role === "alien").length).toBe(1);
    }
    const ch0 = LEVELS.filter((l) => l.mode === "find" && l.chapter === 0) as Array<
      Extract<SeekLevel, { mode: "find" }>
    >;
    const ch7 = LEVELS.filter((l) => l.mode === "find" && l.chapter === 7) as Array<
      Extract<SeekLevel, { mode: "find" }>
    >;
    const maxT = (a: typeof ch0): number => Math.max(...a.map((l) => l.targets.length));
    expect(maxT(ch7)).toBeGreaterThan(maxT(ch0));
  });
});

describe("寻找外星朋友 · 推理题解唯一", () => {
  it("全部推理关都只有一个答案,而且就是生成时定下的那个", () => {
    expect(DEDUCE_LEVELS.length).toBeGreaterThan(0);
    const bad: Array<{ level: number; solutions: number[] }> = [];
    for (const lv of DEDUCE_LEVELS) {
      const sol = solveDeduction(lv.spots, lv.clues);
      if (sol.length !== 1 || sol[0] !== lv.answer) bad.push({ level: lv.index + 1, solutions: sol });
    }
    expect(bad).toEqual([]);
  });

  it("每条线索对答案都成立(不会有自相矛盾的题面)", () => {
    for (const lv of DEDUCE_LEVELS) {
      for (const c of lv.clues) {
        expect({ level: lv.index + 1, ok: clueHolds(c, lv.spots, lv.answer) }).toEqual({
          level: lv.index + 1,
          ok: true,
        });
      }
    }
  });

  it("线索条数都在 3~5 条之间,而且每条都读得通", () => {
    for (const lv of DEDUCE_LEVELS) {
      expect(lv.clues.length).toBeGreaterThanOrEqual(MIN_CLUES);
      expect(lv.clues.length).toBeLessThanOrEqual(MAX_CLUES);
      for (const c of lv.clues) {
        const text = clueText(c, lv.spots);
        expect(text.length).toBeGreaterThan(5);
        expect(text.endsWith("。")).toBe(true);
        expect(text.includes("undefined")).toBe(false);
      }
    }
  });

  it("同一道题里不会出现两条一模一样的线索", () => {
    for (const lv of DEDUCE_LEVELS) {
      const set = new Set(lv.clues.map((c) => JSON.stringify(c)));
      expect(set.size).toBe(lv.clues.length);
    }
  });

  it("少任何一条线索,答案都不再唯一(题面没有废话)", () => {
    let tight = 0;
    for (const lv of DEDUCE_LEVELS) {
      const everyClueMatters = lv.clues.every((_, k) => {
        const without = lv.clues.filter((__, j) => j !== k);
        return solveDeduction(lv.spots, without).length > 1;
      });
      if (everyClueMatters) tight++;
    }
    expect(tight).toBe(DEDUCE_LEVELS.length);
  });

  it("线索里提到的参照物都存在,而且不会拿答案自己当参照", () => {
    for (const lv of DEDUCE_LEVELS) {
      for (const c of lv.clues) {
        if (c.kind === "leftOf" || c.kind === "rightOf" || c.kind === "neighbor") {
          expect(c.ref).toBeGreaterThanOrEqual(0);
          expect(c.ref).toBeLessThan(lv.spots.length);
          expect(c.ref).not.toBe(lv.answer);
        }
      }
    }
  });

  it("答案里的外星朋友用的是本作原创名字", () => {
    for (const lv of DEDUCE_LEVELS) expect(ALIEN_NAMES).toContain(lv.alien);
  });
});

describe("寻找外星朋友 · 无尽与双人对战", () => {
  it("无尽前 40 轮形状都合法,推理轮同样解唯一", () => {
    for (let r = 1; r <= 40; r++) {
      const lv = buildEndlessRound(r);
      checkShape(lv);
      if (lv.mode === "deduce") {
        expect({ round: r, sol: solveDeduction(lv.spots, lv.clues) }).toEqual({ round: r, sol: [lv.answer] });
      }
    }
  });

  it("无尽越往后越难,同一轮重开布局不变", () => {
    expect(buildEndlessRound(22).spots.length).toBeGreaterThan(buildEndlessRound(2).spots.length);
    // 找物轮之间比限时(推理轮本来就给得宽,不能混在一起比)
    expect(buildEndlessRound(22).seconds).toBeLessThan(buildEndlessRound(2).seconds);
    expect(JSON.stringify(buildEndlessRound(9))).toBe(JSON.stringify(buildEndlessRound(9)));
    expect(JSON.stringify(buildEndlessRound(9))).not.toBe(JSON.stringify(buildEndlessRound(10)));
  });

  it("对战场目标数是单数,不会打成必然平局", () => {
    for (let r = 1; r <= 12; r++) {
      const lv = buildVersusRound(r);
      checkShape(lv);
      expect(lv.mode).toBe("find");
      expect(lv.targets.length % 2).toBe(1);
      expect(lv.spots.length).toBeGreaterThan(lv.targets.length);
    }
  });
});

describe("寻找外星朋友 · 布局生成器", () => {
  it("4~16 个藏身点都摆得下,而且两两不重叠", () => {
    for (let n = 4; n <= 16; n++) {
      for (let seed = 1; seed <= 12; seed++) {
        const spots = layoutSpots(mul(seed * 977 + n), n);
        expect(spots.length).toBe(n);
        expect(spotsOverlap(spots)).toBe(false);
      }
    }
  });

  it("同一个种子摆出来的场景完全一样", () => {
    expect(JSON.stringify(layoutSpots(mul(7), 9))).toBe(JSON.stringify(layoutSpots(mul(7), 9)));
  });

  it("藏身点数量会被夹在 4~16 之间", () => {
    expect(layoutSpots(mul(3), 1).length).toBe(4);
    expect(layoutSpots(mul(3), 99).length).toBe(16);
  });
});

describe("寻找外星朋友 · 线索判定的边界", () => {
  const spots: Spot[] = [
    { x: 100, y: 100, r: 46, kind: "树洞", color: "粉", big: false },
    { x: 500, y: 100, r: 62, kind: "木箱", color: "蓝", big: true },
    { x: 900, y: 500, r: 46, kind: "花丛", color: "黄", big: false },
  ];

  it("leftOf / rightOf 不会把参照物自己算进去", () => {
    expect(clueHolds({ kind: "leftOf", ref: 1 }, spots, 1)).toBe(false);
    expect(clueHolds({ kind: "rightOf", ref: 1 }, spots, 1)).toBe(false);
    expect(clueHolds({ kind: "leftOf", ref: 1 }, spots, 0)).toBe(true);
    expect(clueHolds({ kind: "rightOf", ref: 1 }, spots, 2)).toBe(true);
  });

  it("neighbor 只认最近的两个位置", () => {
    expect(NEIGHBOR_N).toBe(2);
    expect(clueHolds({ kind: "neighbor", ref: 0 }, spots, 1)).toBe(true);
    expect(clueHolds({ kind: "neighbor", ref: 0 }, spots, 0)).toBe(false);
  });

  it("没有线索时所有点都是候选", () => {
    expect(solveDeduction(spots, [])).toEqual([0, 1, 2]);
  });

  it("互相矛盾的线索会得到空解", () => {
    const clues: Clue[] = [
      { kind: "isColor", color: "粉" },
      { kind: "isColor", color: "蓝" },
    ];
    expect(solveDeduction(spots, clues)).toEqual([]);
  });
});

/** 测试里要造随机源时用它,免得把 mulberry32 到处 import */
function mul(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
