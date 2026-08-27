// 档C · 第 3 轮测试员 · alien-seek:不抽样了,188 关一关不漏地过一遍。
//
// 前两轮打的是样本(R1 打 1/100/188,R2 换了 10 关)。第 3 轮的口径改成**全量**:
// 每一关都要满足「摆得开 + 找得完 + 时间够 + 360px 上点得动 + 文案干净」,
// 四种模式的入口逐个走到结算,存档往返连老档一起验。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, loadStars, saveStar, type StorageLike } from "../level99";
import { meta } from "./meta";
import {
  ALIEN_NAMES,
  CHAPTERS,
  CLUE_ITEMS,
  DEDUCE_FROM_CHAPTER,
  LEVELS,
  buildEndlessRound,
  buildLevel,
  buildVersusRound,
  spotsOverlap,
} from "./levels";
import {
  SCENE_H,
  SCENE_W,
  deduceStars,
  endlessLine,
  findStars,
  formatClock,
  solveDeduction,
  spotName,
  versusLine,
  versusWinner,
  zoneOf,
  type Spot,
} from "./logic";
import { levelIsBeatable, solveLevel } from "./sim";

const PHONE = 360;
const MIN_TAP_PX = 24;

function diameterAt(s: Spot, width: number): number {
  const scale = Math.min(width / SCENE_W, (width * 0.75) / SCENE_H);
  return s.r * 2 * scale;
}

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

describe("档C R3 · alien-seek · 188 关一关不漏", () => {
  it("关数、章节切分、下标都对得上", () => {
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    expect(TOTAL_LEVELS).toBe(188);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL_LEVELS);
    LEVELS.forEach((lv, i) => {
      expect(lv.index, `第 ${i + 1} 关的 index`).toBe(i);
      expect(lv.chapter).toBeGreaterThanOrEqual(0);
      expect(lv.chapter).toBeLessThan(CHAPTERS.length);
    });
  });

  it("每一关都摆得开:藏身点不重叠、不出画、颜色+种类不重名", () => {
    LEVELS.forEach((lv, i) => {
      expect(spotsOverlap(lv.spots), `第 ${i + 1} 关有藏身点叠在一起`).toBe(false);
      const names = new Set(lv.spots.map(spotName));
      expect(names.size, `第 ${i + 1} 关有两个藏身点重名(线索会指歪)`).toBe(lv.spots.length);
      for (const s of lv.spots) {
        expect(s.x - s.r, `第 ${i + 1} 关有点出了左边`).toBeGreaterThanOrEqual(0);
        expect(s.x + s.r, `第 ${i + 1} 关有点出了右边`).toBeLessThanOrEqual(SCENE_W);
        expect(s.y - s.r, `第 ${i + 1} 关有点出了上边`).toBeGreaterThanOrEqual(0);
        expect(s.y + s.r, `第 ${i + 1} 关有点出了下边`).toBeLessThanOrEqual(SCENE_H);
        expect(["左", "中", "右"]).toContain(zoneOf(s.x));
      }
    });
  });

  it("每一关都找得完:目标指得到人,推理题解唯一", () => {
    let find = 0;
    let deduce = 0;
    LEVELS.forEach((lv, i) => {
      if (lv.mode === "find") {
        find++;
        expect(lv.targets.length, `第 ${i + 1} 关没有目标`).toBeGreaterThan(0);
        const seen = new Set<number>();
        for (const t of lv.targets) {
          expect(lv.spots[t.spot], `第 ${i + 1} 关的目标指向了不存在的藏身点`).toBeDefined();
          expect(seen.has(t.spot), `第 ${i + 1} 关同一个藏身点被安排了两个目标`).toBe(false);
          seen.add(t.spot);
          expect([...ALIEN_NAMES, ...CLUE_ITEMS], `第 ${i + 1} 关冒出了没登记的名字`).toContain(t.name);
        }
      } else {
        deduce++;
        expect(solveDeduction(lv.spots, lv.clues), `第 ${i + 1} 关解不唯一`).toEqual([lv.answer]);
        expect(lv.clues.length).toBeGreaterThanOrEqual(3);
        expect(lv.clues.length).toBeLessThanOrEqual(5);
        expect(ALIEN_NAMES).toContain(lv.alien as (typeof ALIEN_NAMES)[number]);
      }
    });
    expect(find + deduce).toBe(TOTAL_LEVELS);
    expect(deduce).toBeGreaterThan(0);
    // 推理关只在第 6 章之后出现
    for (const lv of LEVELS) {
      if (lv.mode === "deduce") expect(lv.chapter).toBeGreaterThanOrEqual(DEDUCE_FROM_CHAPTER);
    }
  });

  it("每一关的限时都够用(按键盘挪光标这种最慢的玩法算,还要留 6 秒富余)", () => {
    const tight: string[] = [];
    LEVELS.forEach((lv, i) => {
      if (!levelIsBeatable(lv, 6)) tight.push(`第 ${i + 1} 关(余 ${solveLevel(lv).spare} 秒)`);
    });
    expect(tight).toEqual([]);
  });

  it("每一关在 360px 上都点得动:目标直径不小于 24px", () => {
    LEVELS.forEach((lv, i) => {
      for (const s of lv.spots) {
        expect(diameterAt(s, PHONE), `第 ${i + 1} 关有目标太小`).toBeGreaterThanOrEqual(MIN_TAP_PX);
      }
    });
  });

  it("每一关的文案都干净:没有洋文、没有丧气话、提示不为空", () => {
    const harsh = ["你输了", "失败", "笨", "蠢", "血", "死亡", "干掉", "杀"];
    LEVELS.forEach((lv, i) => {
      expect(lv.hint.length, `第 ${i + 1} 关没有提示`).toBeGreaterThan(0);
      expect(lv.hint, `第 ${i + 1} 关的提示里有洋文`).not.toMatch(/[A-Za-z]/);
      for (const w of harsh) {
        expect(lv.hint.includes(w), `第 ${i + 1} 关的提示里有「${w}」`).toBe(false);
      }
    });
    for (const c of CHAPTERS) {
      expect(c.name).not.toMatch(/[A-Za-z]/);
      expect(c.desc.length).toBeGreaterThan(4);
    }
  });

  it("同一关反复取一模一样(188 关逐关比对)", () => {
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      expect(JSON.stringify(buildLevel(i)), `第 ${i + 1} 关不是确定性的`).toBe(
        JSON.stringify(LEVELS[i])
      );
    }
  });
});

/* ------------------------------------------------------------------ */
/* 二、四种模式的入口逐个走到结算                                        */
/* ------------------------------------------------------------------ */

describe("档C R3 · alien-seek · 四种模式一个不漏", () => {
  it("meta 声明的四种模式都有真实入口,而且都造得出第一局", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    expect(buildLevel(0).spots.length).toBeGreaterThan(0);
    expect(buildEndlessRound(1).spots.length).toBeGreaterThan(0);
    expect(buildVersusRound(1).targets.length).toBeGreaterThan(0);
    // 双人同屏:两套键位都写在提示里
    expect(buildVersusRound(1).hint).toContain("W A S D");
    expect(buildVersusRound(1).hint).toContain("方向键");
  });

  it("战役:每一关都能一路评到 3 星,也能只评到 1 星(赢和「赢得难看」两条路都在)", () => {
    LEVELS.forEach((lv, i) => {
      expect(findStars(lv.seconds, lv.seconds, 0), `第 ${i + 1} 关满分评不到 3 星`).toBe(3);
      expect(findStars(0, lv.seconds, 9)).toBe(1);
      expect(deduceStars(0, 1)).toBe(3);
      expect(deduceStars(3, 1)).toBe(1);
    });
  });

  it("无尽:连打 60 轮每轮都造得出、都打得完", () => {
    for (let r = 1; r <= 60; r++) {
      const lv = buildEndlessRound(r);
      expect(spotsOverlap(lv.spots), `第 ${r} 轮有点叠在一起`).toBe(false);
      expect(levelIsBeatable(lv, 3), `第 ${r} 轮时间不够`).toBe(true);
      if (lv.mode === "deduce") expect(solveDeduction(lv.spots, lv.clues)).toEqual([lv.answer]);
    }
    expect(endlessLine(9, 5)).toContain("新纪录");
    expect(endlessLine(3, 8)).toContain("第 8 轮");
  });

  it("对战 / 双人:20 局都摆得开,目标数是单数,不会打成必然平局", () => {
    for (let r = 1; r <= 20; r++) {
      const lv = buildVersusRound(r);
      expect(spotsOverlap(lv.spots), `第 ${r} 局有点叠在一起`).toBe(false);
      expect(lv.targets.length % 2, `第 ${r} 局目标数是双数`).toBe(1);
      expect(levelIsBeatable(lv, 3), `第 ${r} 局时间不够`).toBe(true);
    }
    expect(versusWinner(3, 1)).toBe("朵朵");
    expect(versusWinner(1, 3)).toBe("星星");
    expect(versusWinner(2, 2)).toBe("平局");
    expect(versusLine(2, 2)).toContain("平手");
  });

  it("结算时钟不会写出负数或者怪数", () => {
    for (const s of [-5, 0, 0.4, 7, 59, 60, 61, 599]) {
      expect(formatClock(s)).toMatch(/^\d+:[0-5]\d$/);
    }
    expect(formatClock(-5)).toBe("0:00");
    expect(formatClock(61)).toBe("1:01");
  });
});

/* ------------------------------------------------------------------ */
/* 三、存档往返                                                         */
/* ------------------------------------------------------------------ */

describe("档C R3 · alien-seek · 存档往返", () => {
  it("188 关逐关存进去再读出来,一颗星都不丢", () => {
    const store = memStore();
    const want = new Array<number>(TOTAL_LEVELS);
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      want[i] = ((i % 3) + 1) as 1 | 2 | 3;
      saveStar(meta.id, i, want[i] as 1 | 2 | 3, store);
    }
    const back = loadStars(meta.id, store);
    for (let i = 0; i < TOTAL_LEVELS; i++) expect(back[i], `第 ${i + 1} 关的星丢了`).toBe(want[i]);
  });

  it("星只增不减:低分再打一次不会把高分覆盖掉", () => {
    const store = memStore();
    saveStar(meta.id, 5, 3, store);
    saveStar(meta.id, 5, 1, store);
    expect(loadStars(meta.id, store)[5]).toBe(3);
  });

  it("存档被写坏了也读得回来,不会白屏", () => {
    for (const junk of ["", "{", "null", "[1,2,3]", '{"stars":"哈"}', '{"stars":[9,-1,"x"]}']) {
      const store = memStore();
      store.setItem(`yiduo.game.${meta.id}`, junk);
      const back = loadStars(meta.id, store);
      expect(back).toHaveLength(TOTAL_LEVELS);
      for (const v of back) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of back) expect(v).toBeLessThanOrEqual(3);
    }
  });
});
