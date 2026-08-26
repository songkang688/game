// 1.1：地鼠嘭嘭 99 → 188 的新地洞、新机制与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, mulberry32, totalSize, TOTAL_LEVELS } from "../level99";
import {
  buildQuizCard,
  CHAPTERS,
  endlessFieldName,
  endlessLine,
  endlessWave,
  evalQuizExpr,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  LEVELS,
  quizExprFor,
  quizTarget,
} from "./levels";
import { levelTips, loseLine, roundStars, torchHoles, usesHearts, winLine } from "./logic";

/** 前 99 关的「指纹」：任何一处生成参数被改动都会对不上 */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const NEW_LEVELS = Array.from({ length: TOTAL_LEVELS - LEGACY_LEVELS }, (_, i) => LEGACY_LEVELS + i);
/** 四片新地洞的关号区间（0 基，左闭右开） */
const QUIZ = [99, 122] as const;
const COMBO = [122, 144] as const;
const SHIELD = [144, 166] as const;
const NIGHT = [166, 188] as const;

describe("地鼠嘭嘭 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "草地新手", "瞌睡午后", "闪电竞技", "金矿乐园", "小兔保护区", "地鼠嘉年华",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("前 99 关每关参数一笔未改（生成指纹回归）", () => {
    expect(fnv(JSON.stringify(LEVELS.slice(0, 99)))).toBe("9ba7d2ff");
  });

  it("前 99 关一律没有任何 1.1 新机制字段", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.quizChance).toBeUndefined();
      expect(lv.comboTarget).toBeUndefined();
      expect(lv.comboMs).toBeUndefined();
      expect(lv.shieldChance).toBeUndefined();
      expect(lv.night).toBeUndefined();
      expect(lv.torchMs).toBeUndefined();
    }
  });
});

describe("地鼠嘭嘭 · 1.1 新地洞", () => {
  it("总关数 188，末尾追加了 4 片全新地洞共 89 关", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual(["算术地洞", "连击训练场", "铁盔地鼠营", "月夜手电筒"]);
  });

  it("新地洞文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
  });

  it("四片新地洞的机制各不相同：出题 / 连击 / 护盾 / 夜视", () => {
    for (let lv = QUIZ[0]; lv < QUIZ[1]; lv++) expect(LEVELS[lv].quizChance).toBe(1);
    for (let lv = COMBO[0]; lv < COMBO[1]; lv++) {
      expect(LEVELS[lv].comboTarget ?? 0).toBeGreaterThanOrEqual(4);
      expect(LEVELS[lv].comboMs ?? 0).toBeGreaterThanOrEqual(5000);
    }
    for (let lv = SHIELD[0]; lv < SHIELD[1]; lv++) expect(LEVELS[lv].shieldChance ?? 0).toBeGreaterThan(0);
    for (let lv = NIGHT[0]; lv < NIGHT[1]; lv++) {
      expect(LEVELS[lv].night).toBe(true);
      expect(LEVELS[lv].torchMs ?? 0).toBeGreaterThanOrEqual(1500);
    }
  });

  it("新机制互不越界：出题只在第 7 章，漆黑只在第 10 章", () => {
    for (const lv of NEW_LEVELS) {
      const ci = chapterOf(CHAPTERS, lv);
      if (ci !== 6) expect(LEVELS[lv].quizChance).toBeUndefined();
      if (ci !== 9) expect(LEVELS[lv].night).toBeUndefined();
      if (ci !== 9) expect(LEVELS[lv].torchMs).toBeUndefined();
    }
  });

  it("第 100–188 关逐关参数可玩：停留、间隔、并发都有上下界", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      expect(cfg.duration).toBeGreaterThanOrEqual(30);
      expect(cfg.target).toBeGreaterThanOrEqual(8);
      expect(cfg.target).toBeLessThanOrEqual(30);
      expect(cfg.upMsMin).toBeGreaterThanOrEqual(500);
      expect(cfg.upMsMax).toBeGreaterThan(cfg.upMsMin);
      expect(cfg.gapMs).toBeGreaterThanOrEqual(450);
      expect(cfg.maxConcurrent).toBeGreaterThanOrEqual(2);
      expect(cfg.maxConcurrent).toBeLessThanOrEqual(3);
      expect(cfg.bunnyChance).toBeLessThanOrEqual(0.25);
      expect(cfg.shieldChance ?? 0).toBeLessThanOrEqual(0.5);
    }
  });

  it("第 100–188 关逐关可通关：冒头总数明显多于目标分", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      const spawns = ((cfg.duration * 1000) / (cfg.gapMs + cfg.upMsMin)) * cfg.maxConcurrent;
      // 兔子不能拍、护盾鼠要两下、出题鼠还得算对得数，这里全按最悲观折算
      const useful = spawns * (1 - cfg.bunnyChance) * (cfg.quizChance ? 0.45 : 1) * (1 - (cfg.shieldChance ?? 0) / 2);
      expect(useful).toBeGreaterThan(cfg.target);
    }
  });

  it("新地洞内部难度递进：目标更多、出洞更密", () => {
    for (const [from, to] of [QUIZ, COMBO, SHIELD, NIGHT]) {
      const s = LEVELS[from];
      const e = LEVELS[to - 1];
      expect(s.target).toBeLessThan(e.target);
      expect(s.gapMs).toBeGreaterThan(e.gapMs);
      expect(s.upMsMin).toBeGreaterThan(e.upMsMin);
    }
  });
});

describe("地鼠嘭嘭 · 出题地鼠逐题可解", () => {
  it("得数 2..20 的算式牌算出来恰好是它自己（150 组随机种子）", () => {
    for (let value = 2; value <= 20; value++) {
      for (let seed = 0; seed < 150; seed++) {
        const expr = quizExprFor(value, mulberry32(seed * 37 + value));
        expect(expr).toMatch(/^\d+[+\-×÷]\d+$/);
        expect(evalQuizExpr(expr)).toBe(value);
      }
    }
  });

  it("算式牌的操作数都在两位数以内（口算量级）", () => {
    for (let value = 2; value <= 20; value++) {
      for (let seed = 0; seed < 80; seed++) {
        const m = /^(\d+)[+\-×÷](\d+)$/.exec(quizExprFor(value, mulberry32(seed * 13 + value)));
        expect(m).not.toBeNull();
        expect(Number(m![1])).toBeLessThanOrEqual(99);
        expect(Number(m![2])).toBeLessThanOrEqual(99);
      }
    }
  });

  it("干扰牌的得数一定不等于目标数，题面依然自洽", () => {
    for (let target = 2; target <= 20; target++) {
      for (let seed = 0; seed < 60; seed++) {
        const card = buildQuizCard(target, false, mulberry32(seed * 101 + target));
        expect(card.correct).toBe(false);
        expect(card.value).not.toBe(target);
        expect(card.value).toBeGreaterThanOrEqual(2);
        expect(evalQuizExpr(card.expr)).toBe(card.value);
      }
    }
  });

  it("正确牌的得数一定等于目标数", () => {
    for (let target = 2; target <= 20; target++) {
      const card = buildQuizCard(target, true, mulberry32(target * 7 + 3));
      expect(card.correct).toBe(true);
      expect(card.value).toBe(target);
      expect(evalQuizExpr(card.expr)).toBe(target);
    }
  });

  it("四种运算都出得来，求值器拒绝乱码", () => {
    const ops = new Set<string>();
    for (let seed = 0; seed < 400; seed++) ops.add(quizExprFor(6, mulberry32(seed)).replace(/\d+/g, ""));
    expect(ops).toEqual(new Set(["+", "-", "×", "÷"]));
    expect(evalQuizExpr("苹果+香蕉")).toBeNaN();
    expect(evalQuizExpr("5?2")).toBeNaN();
  });

  it("目标得数始终落在 2..20 的口算区间", () => {
    for (let t = 0; t < 23; t++) {
      for (let seed = 0; seed < 60; seed++) {
        const v = quizTarget(t, mulberry32(seed * 5 + t));
        expect(v).toBeGreaterThanOrEqual(2);
        expect(v).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe("地鼠嘭嘭 · 无尽地鼠场", () => {
  it("每一波都能打：速度、并发、目标分都有封顶", () => {
    for (let wave = 1; wave <= 60; wave++) {
      const cfg = endlessWave(wave);
      expect(cfg.duration).toBe(20);
      expect(cfg.target).toBeGreaterThanOrEqual(6);
      expect(cfg.target).toBeLessThanOrEqual(18);
      expect(cfg.upMsMin).toBeGreaterThanOrEqual(430);
      expect(cfg.upMsMax).toBeGreaterThan(cfg.upMsMin);
      expect(cfg.gapMs).toBeGreaterThanOrEqual(330);
      expect(cfg.maxConcurrent).toBeLessThanOrEqual(3);
      const spawns = ((cfg.duration * 1000) / (cfg.gapMs + cfg.upMsMin)) * cfg.maxConcurrent;
      expect(spawns * (1 - cfg.bunnyChance)).toBeGreaterThan(cfg.target);
    }
  });

  it("波次越靠后越难，但第 25 波之后停在封顶不再加码", () => {
    expect(endlessWave(1).gapMs).toBeGreaterThan(endlessWave(10).gapMs);
    expect(endlessWave(1).target).toBeLessThan(endlessWave(20).target);
    expect(endlessWave(25)).toEqual(endlessWave(60));
    expect(endlessWave(0)).toEqual(endlessWave(1));
  });

  it("场地名每 5 波换一片，且全是中文", () => {
    expect(endlessFieldName(1)).toBe("草坡地洞");
    expect(endlessFieldName(5)).toBe("草坡地洞");
    expect(endlessFieldName(6)).toBe("石板地洞");
    expect(endlessFieldName(999)).toBe("熔岩地洞");
    for (let wave = 1; wave <= 40; wave++) expect(endlessFieldName(wave)).not.toMatch(/[A-Za-z]/);
  });

  it("收摊文案只鼓励不批评", () => {
    expect(endlessLine(7, 5)).toContain("新纪录");
    expect(endlessLine(3, 9)).toContain("最好成绩");
    expect(endlessLine(0, 0)).toContain("热热身");
    for (const line of [endlessLine(0, 0), endlessLine(3, 9), endlessLine(7, 5)]) {
      expect(line).not.toMatch(/[A-Za-z]/);
      expect(line).not.toMatch(/太差|笨|失败了|不行/);
    }
  });
});

describe("地鼠嘭嘭 · 关内文案与评星", () => {
  it("提示语按机关拼装，新地洞每一关都有提示", () => {
    expect(levelTips(LEVELS[0])).toBe("地鼠冒头就拍它！");
    expect(levelTips(LEVELS[QUIZ[0]])).toContain("得数");
    expect(levelTips(LEVELS[COMBO[0]])).toContain("嘭嘭时间");
    expect(levelTips(LEVELS[SHIELD[0]])).toContain("铁盔鼠");
    expect(levelTips(LEVELS[NIGHT[0]])).toContain("月光圈");
    for (const lv of NEW_LEVELS) {
      expect(levelTips(LEVELS[lv]).length).toBeGreaterThan(6);
      expect(levelTips(LEVELS[lv])).not.toMatch(/[A-Za-z]/);
    }
  });

  it("只有会扣心的关才显示爱心", () => {
    expect(usesHearts(LEVELS[0])).toBe(false);
    expect(usesHearts(LEVELS[QUIZ[0]])).toBe(true);
    expect(usesHearts(LEVELS[SHIELD[0]])).toBe(true);
    expect(usesHearts(LEVELS[70])).toBe(true);
  });

  it("月光圈照亮 3~5 个洞，且全在 3×3 棋盘里", () => {
    for (let c = 0; c < 9; c++) {
      const lit = torchHoles(c);
      expect(lit.length).toBeGreaterThanOrEqual(3);
      expect(lit.length).toBeLessThanOrEqual(5);
      expect(lit).toContain(c);
      expect(new Set(lit).size).toBe(lit.length);
      for (const i of lit) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThanOrEqual(8);
      }
    }
    // 角上的洞只照亮 3 个，正中间照亮 5 个
    expect(torchHoles(0)).toEqual([0, 1, 3]);
    expect(torchHoles(4)).toEqual([1, 3, 4, 5, 7]);
    expect(torchHoles(-5)).toEqual(torchHoles(4));
  });

  it("评星：零失误且有余裕才三星，失误多也至少给一星", () => {
    const base = { won: true, score: 20, bestCombo: 5 };
    expect(roundStars({ ...base, mistakes: 0, timeLeft: 10 }, 30)).toBe(3);
    expect(roundStars({ ...base, mistakes: 0, timeLeft: 2 }, 30)).toBe(2);
    expect(roundStars({ ...base, mistakes: 1, timeLeft: 10 }, 30)).toBe(2);
    expect(roundStars({ ...base, mistakes: 2, timeLeft: 10 }, 30)).toBe(1);
    expect(roundStars({ ...base, mistakes: 0, timeLeft: 5 }, 0)).toBe(2);
  });

  it("胜负文案按机关分流，失败话术不批评小朋友", () => {
    const r = { won: true, score: 20, mistakes: 0, timeLeft: 9, bestCombo: 6 };
    expect(winLine(LEVELS[QUIZ[0]], r)).toContain("算式");
    expect(winLine(LEVELS[SHIELD[0]], r)).toContain("铁盔鼠");
    expect(winLine(LEVELS[NIGHT[0]], r)).toContain("摸黑");
    expect(winLine(LEVELS[COMBO[0]], r)).toContain("连拍");
    expect(winLine(LEVELS[0], r)).toContain("好快的手");
    const fail = { won: false, score: 6, mistakes: 3, timeLeft: 4, bestCombo: 2 };
    expect(loseLine(LEVELS[QUIZ[0]], fail)).toContain("慢半拍");
    expect(loseLine(LEVELS[0], { ...fail, mistakes: 0 })).toContain("再快一点点");
    for (const cfg of [LEVELS[0], LEVELS[QUIZ[0]], LEVELS[NIGHT[0]]]) {
      const line = loseLine(cfg, fail);
      expect(line).not.toMatch(/[A-Za-z]/);
      expect(line).not.toMatch(/笨|太差|没用|不行/);
    }
  });
});
