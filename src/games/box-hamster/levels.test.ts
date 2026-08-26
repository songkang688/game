import { describe, expect, it } from "vitest";
import { assertTotal, TOTAL_LEVELS } from "../level99";
import {
  CHAPTERS,
  TOTAL,
  buildEndless,
  buildLevel,
  chapterIndexOf,
  featureTags,
  getLevel,
  indexInChapterOf,
  minPushesFor,
  recipeFor,
  starsForMoves,
  winMessage,
} from "./levels";
import { budgetFor, roomScore } from "./index";
import {
  hasIce,
  hasPortal,
  initialState,
  isDeadCorner,
  isSolved,
  remainingBoxes,
  toAscii,
} from "./logic";
import { solve, verifySolution } from "./solver";

/** 188 关只生成一次,后面每个用例复用同一批数据 */
const ALL = (() => {
  const out = [];
  for (let i = 0; i < TOTAL; i++) out.push(buildLevel(i));
  return out;
})();

describe("章节切分", () => {
  it("七章合计正好 188 关", () => {
    expect(TOTAL).toBe(188);
    expect(TOTAL).toBe(TOTAL_LEVELS);
    expect(assertTotal(CHAPTERS, 188, "box-hamster")).toBe(true);
  });

  it("章节数不少于 6 章,每章都有名字、颜色和一句介绍", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThan(8);
      expect(ch.size).toBeGreaterThan(0);
    }
  });

  it("关号能对上章节与章内序号", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(indexInChapterOf(0)).toBe(0);
    expect(chapterIndexOf(187)).toBe(CHAPTERS.length - 1);
    let acc = 0;
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      expect(chapterIndexOf(acc)).toBe(ci);
      expect(indexInChapterOf(acc)).toBe(0);
      acc += CHAPTERS[ci].size;
    }
  });

  it("越界的关号被夹回合法区间", () => {
    expect(buildLevel(-5).index).toBe(0);
    expect(buildLevel(9999).index).toBe(TOTAL - 1);
    expect(chapterIndexOf(9999)).toBe(CHAPTERS.length - 1);
  });
});

describe("188 关可解性(硬性红线)", () => {
  it("每一关求解器都能推完,而且解法回放到规则层真的赢了", () => {
    const failures: string[] = [];
    for (const def of ALL) {
      const res = solve(def, { nodeCap: 260_000 });
      if (!res.solved) {
        failures.push(`第 ${def.index + 1} 关解不出来(capped=${res.capped}, 走法=${res.method})\n${toAscii(def, initialState(def))}`);
        continue;
      }
      if (!verifySolution(def, res.moves)) {
        failures.push(`第 ${def.index + 1} 关的解回放不通\n${toAscii(def, initialState(def))}`);
      }
    }
    expect(failures.join("\n\n")).toBe("");
  }, 240_000);

  it("每一关随关卡一起存下来的参考解也走得通", () => {
    for (const def of ALL) {
      expect(def.reference.length, `第 ${def.index + 1} 关应该有参考解`).toBeGreaterThan(0);
      expect(verifySolution(def, def.reference), `第 ${def.index + 1} 关参考解走不通`).toBe(true);
      expect(def.reference.length).toBe(def.bestMoves);
    }
  }, 120_000);

  it("开局既没有赢、也没有箱子一上来就卡死在墙角", () => {
    for (const def of ALL) {
      const start = initialState(def);
      expect(isSolved(def, start), `第 ${def.index + 1} 关一开局就赢了`).toBe(false);
      for (const box of def.boxes) {
        expect(isDeadCorner(def, box), `第 ${def.index + 1} 关有箱子开局就死在墙角`).toBe(false);
      }
    }
  });

  it("箱子数和脚印数一样多,而且都摆在空地上", () => {
    for (const def of ALL) {
      const targets = def.target.filter(Boolean).length;
      expect(def.boxes.length, `第 ${def.index + 1} 关箱子与脚印对不上`).toBe(targets);
      expect(def.boxes.length).toBeGreaterThan(0);
      for (const c of def.boxes) expect(def.wall[c]).toBe(false);
      for (const c of def.hamsters) expect(def.wall[c]).toBe(false);
      // 仓鼠不许和箱子叠在一起
      for (const c of def.hamsters) expect(def.boxes).not.toContain(c);
      expect(new Set(def.boxes).size).toBe(def.boxes.length);
      expect(new Set(def.hamsters).size).toBe(def.hamsters.length);
    }
  });

  it("传送门永远成对,而且不落在墙上", () => {
    for (const def of ALL) {
      for (let c = 0; c < def.portal.length; c++) {
        const pair = def.portal[c];
        if (pair < 0) continue;
        expect(def.wall[c]).toBe(false);
        expect(def.wall[pair]).toBe(false);
        expect(pair).not.toBe(c);
        expect(def.portal[pair], `第 ${def.index + 1} 关的传送门没配上对`).toBe(c);
      }
    }
  });
});

describe("难度曲线", () => {
  it("每一关都达到了本章配方要求的最少推箱次数", () => {
    for (const def of ALL) {
      const floor = minPushesFor(recipeFor(def.index));
      expect(def.bestPushes, `第 ${def.index + 1} 关只要推 ${def.bestPushes} 下,太白送了`).toBeGreaterThanOrEqual(
        floor
      );
    }
  });

  it("没有「一步就推完」的白送关", () => {
    for (const def of ALL) {
      expect(def.bestPushes).toBeGreaterThanOrEqual(3);
      expect(def.bestMoves).toBeGreaterThanOrEqual(3);
    }
  });

  it("后面几章平均比开头几章难", () => {
    const avg = (from: number, to: number): number => {
      const slice = ALL.slice(from, to);
      return slice.reduce((s, d) => s + d.bestPushes, 0) / slice.length;
    };
    expect(avg(58, 84)).toBeGreaterThan(avg(0, 30));
    expect(avg(136, 162)).toBeGreaterThan(avg(0, 30));
  });

  it("棋盘尺寸和箱子数都在能一屏放下的范围内", () => {
    for (const def of ALL) {
      expect(def.w).toBeGreaterThanOrEqual(5);
      expect(def.w).toBeLessThanOrEqual(13);
      expect(def.h).toBeGreaterThanOrEqual(5);
      expect(def.h).toBeLessThanOrEqual(8);
      expect(def.boxes.length).toBeLessThanOrEqual(6);
      expect(def.hamsters.length).toBeGreaterThanOrEqual(1);
      expect(def.hamsters.length).toBeLessThanOrEqual(2);
    }
  });
});

describe("机关按章上场", () => {
  const range = (ci: number): typeof ALL => {
    let from = 0;
    for (let i = 0; i < ci; i++) from += CHAPTERS[i].size;
    return ALL.slice(from, from + CHAPTERS[ci].size);
  };

  it("前三章是干干净净的纯推箱,一个机关都不出现", () => {
    for (const ci of [0, 1, 2]) {
      for (const def of range(ci)) {
        expect(hasIce(def), `第 ${def.index + 1} 关不该有冰面`).toBe(false);
        expect(hasPortal(def), `第 ${def.index + 1} 关不该有传送门`).toBe(false);
        expect(def.hamsters).toHaveLength(1);
      }
    }
  });

  it("冰湖章每一关都真的有冰面", () => {
    for (const def of range(3)) {
      expect(hasIce(def), `第 ${def.index + 1} 关没有冰面`).toBe(true);
      expect(hasPortal(def)).toBe(false);
    }
  });

  it("传送站章每一关都真的有成对的传送门", () => {
    for (const def of range(4)) {
      expect(hasPortal(def), `第 ${def.index + 1} 关没有传送门`).toBe(true);
      expect(def.portal.filter((v) => v >= 0).length % 2).toBe(0);
    }
  });

  it("双鼠章每一关都是两只仓鼠、各守一间互不相通的屋子", () => {
    for (const def of range(5)) {
      expect(def.hamsters, `第 ${def.index + 1} 关应该有两只仓鼠`).toHaveLength(2);
      // 两只仓鼠都得干活:任何一只单独出场都解不完
      const solo = solve({ ...def, hamsters: [def.hamsters[0]] }, { nodeCap: 60_000 });
      expect(solo.solved, `第 ${def.index + 1} 关一只仓鼠就能包办,失去了搭档的意义`).toBe(false);
    }
  }, 120_000);

  it("终极章三种机关都轮到过", () => {
    const finale = range(6);
    expect(finale.filter((d) => hasIce(d)).length).toBeGreaterThanOrEqual(5);
    expect(finale.filter((d) => hasPortal(d)).length).toBeGreaterThanOrEqual(5);
    expect(finale.filter((d) => d.hamsters.length > 1).length).toBeGreaterThanOrEqual(5);
  });

  it("小标签如实反映这一关有什么机关", () => {
    for (const def of ALL) {
      const tags = featureTags(def).join(" ");
      expect(tags.includes("冰面")).toBe(hasIce(def));
      expect(tags.includes("传送门")).toBe(hasPortal(def));
      expect(tags.includes("双搭档")).toBe(def.hamsters.length > 1);
      expect(tags.length).toBeGreaterThan(0);
    }
  });
});

describe("生成是确定性的", () => {
  it("同一个关号造两次,结果一模一样", () => {
    for (const lv of [0, 37, 91, 118, 149, 187]) {
      const a = buildLevel(lv);
      const b = buildLevel(lv);
      expect(toAscii(b, initialState(b))).toBe(toAscii(a, initialState(a)));
      expect(b.bestPushes).toBe(a.bestPushes);
      expect(b.name).toBe(a.name);
    }
  });

  it("getLevel 走缓存,同一关拿到的是同一份", () => {
    expect(getLevel(12)).toBe(getLevel(12));
    expect(toAscii(getLevel(12), initialState(getLevel(12)))).toBe(
      toAscii(buildLevel(12), initialState(buildLevel(12)))
    );
  });

  it("相邻两关不会长得一模一样", () => {
    let same = 0;
    for (let lv = 1; lv < TOTAL; lv++) {
      const a = ALL[lv - 1];
      const b = ALL[lv];
      if (toAscii(a, initialState(a)) === toAscii(b, initialState(b))) same++;
    }
    expect(same).toBe(0);
  });
});

describe("评分与文案", () => {
  it("步数越省星星越多", () => {
    const def = ALL[40];
    expect(starsForMoves(def, def.parMoves)).toBe(3);
    expect(starsForMoves(def, def.parMoves - 1)).toBe(3);
    expect(starsForMoves(def, def.parMoves + 1)).toBe(2);
    expect(starsForMoves(def, def.twoStarMoves)).toBe(2);
    expect(starsForMoves(def, def.twoStarMoves + 1)).toBe(1);
  });

  it("三星线永远够得着:照着参考解走一定拿三星", () => {
    for (const def of ALL) {
      expect(def.parMoves).toBeGreaterThanOrEqual(def.bestMoves);
      expect(def.twoStarMoves).toBeGreaterThan(def.parMoves);
      expect(starsForMoves(def, def.bestMoves)).toBe(3);
    }
  });

  it("过关文案里有步数,而且不批评小朋友", () => {
    const def = ALL[10];
    for (const [moves, undos] of [
      [def.bestMoves, 0],
      [def.parMoves + 1, 3],
      [def.twoStarMoves + 20, 9],
    ]) {
      const msg = winMessage(def, moves, undos);
      expect(msg).toContain(String(moves));
      expect(msg).not.toMatch(/笨|差劲|真慢|不行/);
      expect(msg.length).toBeGreaterThan(8);
    }
  });

  it("每一关都有名字、玩法标题和一句提示", () => {
    for (const def of ALL) {
      expect(def.name).toContain("·");
      expect(def.feature.length).toBeGreaterThan(1);
      expect(def.hint.length).toBeGreaterThan(8);
      expect(def.kind).toBe("campaign");
    }
  });
});

describe("无尽模式", () => {
  it("前 14 仓都推得完,而且一仓比一仓不轻松", () => {
    for (let r = 0; r < 14; r++) {
      const def = buildEndless(r);
      expect(def.kind).toBe("endless");
      const res = solve(def, { nodeCap: 200_000 });
      expect(res.solved, `第 ${r + 1} 仓推不完`).toBe(true);
      expect(verifySolution(def, res.moves)).toBe(true);
      expect(remainingBoxes(def, initialState(def))).toBeGreaterThan(0);
    }
  }, 120_000);

  it("步数预算永远比参考解宽裕", () => {
    for (let r = 0; r < 14; r++) {
      const def = buildEndless(r);
      expect(budgetFor(def)).toBeGreaterThan(def.bestMoves);
    }
  }, 60_000);

  it("同一仓的分数只跟难度和省下的步数有关", () => {
    const def = buildEndless(3);
    const budget = budgetFor(def);
    expect(roomScore(def, def.bestMoves, budget)).toBeGreaterThan(roomScore(def, budget, budget));
    expect(roomScore(def, budget, budget)).toBeGreaterThan(0);
  });

  it("越往后的仓机关越多", () => {
    expect(hasIce(buildEndless(0))).toBe(false);
    expect(hasIce(buildEndless(8))).toBe(true);
    expect(hasPortal(buildEndless(12))).toBe(true);
  }, 60_000);

  it("负数轮次被夹回第一仓", () => {
    expect(buildEndless(-3).index).toBe(0);
  });
});
