// 档C · 第 3 轮测试员 · box-hamster:188 关一关不漏地推一遍。
//
// 前两轮打的是样本。第 3 轮改成全量:每一关都要「摆得开 + 推得完 + 步数标得住 +
// 360px 上摆得下 + 文案干净」,两种模式的入口都走到结算,存档往返连坏档一起验。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, loadStars, saveStar, type StorageLike } from "../level99";
import { meta } from "./meta";
import {
  CHAPTERS,
  TOTAL,
  buildEndless,
  chapterIndexOf,
  featureTags,
  getLevel,
  indexInChapterOf,
  starsForMoves,
  winMessage,
} from "./levels";
import { CELL_MIN, boardWidth, fitCell } from "./assist";
import {
  applyMoves,
  cellCount,
  hasDeadBox,
  initialState,
  isSolved,
  remainingBoxes,
  xOf,
  yOf,
} from "./logic";

const ALL = Array.from({ length: TOTAL }, (_, i) => getLevel(i));

function memStore(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

/* ------------------------------------------------------------------ */
/* 一、188 关全量                                                       */
/* ------------------------------------------------------------------ */

describe("档C R3 · box-hamster · 188 关一关不漏", () => {
  it("关数、章节切分、下标都对得上", () => {
    expect(TOTAL).toBe(TOTAL_LEVELS);
    expect(TOTAL).toBe(188);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL);
    ALL.forEach((def, i) => {
      expect(def.index, `第 ${i + 1} 关的 index`).toBe(i);
      expect(def.kind).toBe("campaign");
      expect(def.chapterIndex).toBe(chapterIndexOf(i));
      expect(indexInChapterOf(i)).toBeGreaterThanOrEqual(0);
      expect(indexInChapterOf(i)).toBeLessThan(CHAPTERS[def.chapterIndex].size);
    });
  });

  it("每一关都摆得开:箱子数 = 脚印数,谁也不压在墙上,谁也不叠在一起", () => {
    ALL.forEach((def, i) => {
      const n = cellCount(def);
      expect(def.wall).toHaveLength(n);
      expect(def.ice).toHaveLength(n);
      expect(def.target).toHaveLength(n);
      expect(def.portal).toHaveLength(n);
      const goals = def.target.filter(Boolean).length;
      expect(def.boxes.length, `第 ${i + 1} 关箱子数和脚印数对不上`).toBe(goals);
      expect(def.hamsters.length, `第 ${i + 1} 关没有仓鼠`).toBeGreaterThan(0);
      const occupied = new Set<number>();
      for (const cell of [...def.boxes, ...def.hamsters]) {
        expect(cell, `第 ${i + 1} 关有东西放到了格子外`).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(n);
        expect(def.wall[cell], `第 ${i + 1} 关有东西压在墙上`).toBe(false);
        expect(occupied.has(cell), `第 ${i + 1} 关有两样东西叠在一格`).toBe(false);
        occupied.add(cell);
        expect(xOf(def, cell)).toBeLessThan(def.w);
        expect(yOf(def, cell)).toBeLessThan(def.h);
      }
    });
  });

  it("每一关都推得完:照参考解走完箱子全归位,而且开局不是死局", () => {
    ALL.forEach((def, i) => {
      expect(def.reference.length, `第 ${i + 1} 关没有参考解`).toBeGreaterThan(0);
      expect(hasDeadBox(def, initialState(def)), `第 ${i + 1} 关开局就是死局`).toBe(false);
      const { state } = applyMoves(def, initialState(def), def.reference);
      expect(isSolved(def, state), `第 ${i + 1} 关的参考解走完还没归位`).toBe(true);
      expect(remainingBoxes(def, state)).toBe(0);
      expect(def.reference.length).toBe(def.bestMoves);
    });
  });

  it("每一关都真的要动脑:至少推 3 下,没有白送关", () => {
    ALL.forEach((def, i) => {
      expect(def.bestPushes, `第 ${i + 1} 关推的次数太少`).toBeGreaterThanOrEqual(3);
      expect(def.bestMoves).toBeGreaterThanOrEqual(def.bestPushes);
    });
  });

  it("每一关的步数门槛都标得住:三星够得着,二星比三星松", () => {
    ALL.forEach((def, i) => {
      expect(def.parMoves, `第 ${i + 1} 关的三星门槛比最优解还紧`).toBeGreaterThanOrEqual(def.bestMoves);
      expect(def.twoStarMoves, `第 ${i + 1} 关的二星门槛比三星还紧`).toBeGreaterThan(def.parMoves);
      expect(starsForMoves(def, def.bestMoves)).toBe(3);
      expect(starsForMoves(def, def.parMoves)).toBe(3);
      expect(starsForMoves(def, def.parMoves + 1)).toBe(2);
      expect(starsForMoves(def, def.twoStarMoves + 1)).toBe(1);
    });
  });

  it("每一关在 360px 上都摆得下,格子也不会小到戳不准", () => {
    for (const width of [320, 360, 390]) {
      ALL.forEach((def, i) => {
        const cell = fitCell(def.w, width);
        expect(boardWidth(def.w, cell), `${width}px 上第 ${i + 1} 关溢出了`).toBeLessThanOrEqual(width);
        expect(cell, `${width}px 上第 ${i + 1} 关的格子太小`).toBeGreaterThanOrEqual(CELL_MIN);
      });
    }
  });

  it("每一关的文案都干净:关名、提示、结算语没有洋文也没有丧气话", () => {
    const harsh = ["你输了", "失败", "笨", "蠢", "血", "死亡", "干掉", "杀"];
    ALL.forEach((def, i) => {
      for (const text of [def.name, def.hint, def.feature, winMessage(def, def.bestMoves, 0)]) {
        expect(text.length, `第 ${i + 1} 关有空文案`).toBeGreaterThan(0);
        for (const w of harsh) expect(text.includes(w), `第 ${i + 1} 关的文案里有「${w}」`).toBe(false);
      }
      expect(def.name, `第 ${i + 1} 关的关名里有洋文`).not.toMatch(/[A-Za-z]/);
      expect(featureTags(def).length, `第 ${i + 1} 关没有任何标签`).toBeGreaterThan(0);
    });
  });

  it("三种结算语都只鼓励:三星、二星、一星各说各的,都不骂人", () => {
    const def = ALL[100];
    const three = winMessage(def, def.bestMoves, 0);
    const two = winMessage(def, def.parMoves + 1, 0);
    const one = winMessage(def, def.twoStarMoves + 5, 3);
    expect(new Set([three, two, one]).size).toBe(3);
    for (const line of [three, two, one]) {
      expect(line).toContain("步");
      for (const w of ["输", "笨", "差", "失败"]) expect(line).not.toContain(w);
    }
    // 用过撤销也不数落
    expect(one).toContain("撤销");
  });

  it("同一关反复取一模一样(188 关逐关比对)", () => {
    for (let i = 0; i < TOTAL; i++) {
      expect(JSON.stringify(getLevel(i)), `第 ${i + 1} 关不是确定性的`).toBe(JSON.stringify(ALL[i]));
    }
  });

  it("关号越界一律夹回去,不会造出空关", () => {
    for (const i of [-99, -1, TOTAL, TOTAL + 50]) {
      const def = getLevel(i);
      expect(def.boxes.length).toBeGreaterThan(0);
      expect(def.index).toBeGreaterThanOrEqual(0);
      expect(def.index).toBeLessThan(TOTAL);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 二、两种模式                                                         */
/* ------------------------------------------------------------------ */

describe("档C R3 · box-hamster · 两种模式一个不漏", () => {
  it("meta 只声明战役和无尽,而且两个都有真实入口", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless"]);
    expect(getLevel(0).boxes.length).toBeGreaterThan(0);
    expect(buildEndless(0).boxes.length).toBeGreaterThan(0);
  });

  it("双鼠搭档的关真的给了两只仓鼠,而且两边都有活干", () => {
    const duo = ALL.filter((d) => d.hamsters.length > 1);
    expect(duo.length, "一关双鼠都没有?").toBeGreaterThan(0);
    for (const def of duo) {
      expect(featureTags(def)).toContain("🐹🐹 双搭档");
      // 参考解里两只仓鼠都得动过,不然「双人」是摆设
      const movers = new Set(def.reference.map((m) => m.who));
      expect(movers.size, `${def.name} 的参考解只用了一只仓鼠`).toBeGreaterThan(1);
    }
  });

  it("无尽:连开 60 仓每仓都造得出、都推得完", () => {
    for (let r = 0; r < 60; r++) {
      const def = buildEndless(r);
      expect(def.kind).toBe("endless");
      expect(def.boxes.length, `第 ${r + 1} 仓没有箱子`).toBeGreaterThan(0);
      expect(hasDeadBox(def, initialState(def)), `第 ${r + 1} 仓开局就是死局`).toBe(false);
      const { state } = applyMoves(def, initialState(def), def.reference);
      expect(isSolved(def, state), `第 ${r + 1} 仓推不完`).toBe(true);
    }
  });

  it("无尽仓的名字带仓号和章节名,不会两仓重名到分不清", () => {
    const names = new Set<string>();
    for (let r = 0; r < 40; r++) {
      const name = buildEndless(r).name;
      expect(name, `第 ${r + 1} 仓的名字里没有仓号`).toContain(`第 ${r + 1} 仓`);
      expect(names.has(name), `第 ${r + 1} 仓和前面某一仓重名`).toBe(false);
      names.add(name);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 三、存档往返                                                         */
/* ------------------------------------------------------------------ */

describe("档C R3 · box-hamster · 存档往返", () => {
  it("188 关逐关存进去再读出来,一颗星都不丢", () => {
    const store = memStore();
    for (let i = 0; i < TOTAL; i++) saveStar(meta.id, i, (((i % 3) + 1) as 1 | 2 | 3), store);
    const back = loadStars(meta.id, store);
    for (let i = 0; i < TOTAL; i++) expect(back[i], `第 ${i + 1} 关的星丢了`).toBe((i % 3) + 1);
  });

  it("星只增不减,坏档也读得回来", () => {
    const store = memStore();
    saveStar(meta.id, 7, 3, store);
    saveStar(meta.id, 7, 2, store);
    expect(loadStars(meta.id, store)[7]).toBe(3);
    for (const junk of ["", "{", "null", '{"stars":[7,-2]}']) {
      const bad = memStore();
      bad.setItem(`yiduo.game.${meta.id}`, junk);
      const arr = loadStars(meta.id, bad);
      expect(arr).toHaveLength(TOTAL_LEVELS);
      for (const v of arr) expect(v >= 0 && v <= 3).toBe(true);
    }
  });
});
