/**
 * 铁皮坦克大战 · 188 关关卡体检。
 *
 * 关卡是程序生成的,所以这份测试要盯死三件事:
 *  1. 章节切分正好 188 关、至少 8 章;
 *  2. 每一关的地图都解析得动、护墙齐全、出生点干净、四面都走得通;
 *  3. 敌人配比按章节推进,同一关每次生成完全一样。
 */
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal } from "../level99";
import {
  BASE,
  CHAPTERS,
  CHAPTER_NEW,
  ENEMY_SPAWNS,
  LEVEL_TOTAL,
  MAP_H,
  MAP_W,
  PLAYER_SPAWNS,
  buildLevel,
  buildWaves,
  chapterIndexOf,
  chapterStartOf,
  countKinds,
  endlessRows,
  scaleForPlayers,
  versusRows,
  waveSize,
} from "./levels";
import { isFortBrick, parseMap, reachable, scanFort, tileAt } from "./logic";

const ALL = Array.from({ length: LEVEL_TOTAL }, (_, i) => i);

describe("章节切分", () => {
  it("八章合计正好 188 关", () => {
    expect(LEVEL_TOTAL).toBe(TOTAL_LEVELS);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "tank-battle")).toBe(true);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(188);
  });

  it("至少 8 章,每章都有名字、表情、颜色和一句介绍", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThan(6);
      expect(ch.size).toBeGreaterThan(10);
    }
  });

  it("每章都写清楚了这一章新加了什么", () => {
    expect(CHAPTER_NEW).toHaveLength(CHAPTERS.length);
    for (const line of CHAPTER_NEW) expect(line.length).toBeGreaterThan(6);
  });

  it("关号能算回它所属的章节", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(21)).toBe(0);
    expect(chapterIndexOf(22)).toBe(1);
    expect(chapterIndexOf(187)).toBe(CHAPTERS.length - 1);
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      expect(chapterIndexOf(chapterStartOf(ci))).toBe(ci);
    }
  });
});

describe("188 张地图逐张体检", () => {
  const levels = ALL.map((i) => buildLevel(i));

  it("每一关都解析得动,尺寸统一", () => {
    for (const lv of levels) {
      const map = parseMap(lv.rows);
      expect(map.w, `第 ${lv.index + 1} 关`).toBe(MAP_W);
      expect(map.h, `第 ${lv.index + 1} 关`).toBe(MAP_H);
    }
  });

  it("堡垒、两个玩家出生点、三个敌人出生点一个都不少", () => {
    for (const lv of levels) {
      const map = parseMap(lv.rows);
      expect(map.base, `第 ${lv.index + 1} 关`).toEqual(BASE);
      expect(map.playerSpawns).toEqual([...PLAYER_SPAWNS]);
      expect(map.enemySpawns).toEqual([...ENEMY_SPAWNS]);
    }
  });

  it("护墙每一关都是齐的:顶上两层、左右各两块", () => {
    for (const lv of levels) {
      const map = parseMap(lv.rows);
      expect(tileAt(map, BASE.cx, BASE.cy - 1), `第 ${lv.index + 1} 关`).toBe("#");
      expect(tileAt(map, BASE.cx, BASE.cy - 2), `第 ${lv.index + 1} 关`).toBe("#");
      for (const dx of [-2, -1, 1, 2]) {
        expect(tileAt(map, BASE.cx + dx, BASE.cy), `第 ${lv.index + 1} 关`).toBe("#");
      }
      expect(scanFort(map).length, `第 ${lv.index + 1} 关`).toBeGreaterThanOrEqual(10);
    }
  });

  it("出生点和它的门口都是空地,一出场不会顶着墙", () => {
    for (const lv of levels) {
      const map = parseMap(lv.rows);
      for (const s of ENEMY_SPAWNS) {
        expect(tileAt(map, s.cx, s.cy), `第 ${lv.index + 1} 关`).toBe(".");
        expect(tileAt(map, s.cx, s.cy + 1), `第 ${lv.index + 1} 关`).toBe(".");
      }
      for (const p of PLAYER_SPAWNS) {
        expect(tileAt(map, p.cx, p.cy), `第 ${lv.index + 1} 关`).toBe(".");
        expect(tileAt(map, p.cx, p.cy - 1), `第 ${lv.index + 1} 关`).toBe(".");
      }
    }
  });

  it("每个出生点都走得到堡垒(砖墙算能打穿),没有死关", () => {
    for (const lv of levels) {
      const map = parseMap(lv.rows);
      for (const s of [...ENEMY_SPAWNS, ...PLAYER_SPAWNS]) {
        expect(reachable(map, s, BASE), `第 ${lv.index + 1} 关 从 ${s.cx},${s.cy}`).toBe(true);
      }
    }
  });

  it("两位玩家彼此也走得到,双人不会被地形拆散", () => {
    for (const lv of levels) {
      const map = parseMap(lv.rows);
      expect(reachable(map, PLAYER_SPAWNS[0], PLAYER_SPAWNS[1]), `第 ${lv.index + 1} 关`).toBe(true);
    }
  });

  it("地图里只有约定好的那几个字符", () => {
    for (const lv of levels) {
      expect(lv.rows.join("")).toMatch(/^[.#S~*B12e]+$/);
    }
  });

  it("同一关生成两次结果一模一样", () => {
    for (const index of [0, 37, 96, 187]) {
      expect(buildLevel(index)).toEqual(buildLevel(index));
    }
  });

  it("关号越界会被夹回 0..187", () => {
    expect(buildLevel(-5).index).toBe(0);
    expect(buildLevel(999).index).toBe(187);
    expect(buildLevel(3.4).index).toBe(3);
  });
});

describe("地形按章节一样一样地加", () => {
  function tilesOf(index: number): Set<string> {
    return new Set(buildLevel(index).rows.join("").split(""));
  }

  it("第一章只有砖墙,没有钢墙、水面和草丛", () => {
    for (const index of [0, 5, 12, 21]) {
      const set = tilesOf(index);
      expect(set.has("#"), `第 ${index + 1} 关`).toBe(true);
      expect(set.has("S"), `第 ${index + 1} 关`).toBe(false);
      expect(set.has("~"), `第 ${index + 1} 关`).toBe(false);
      expect(set.has("*"), `第 ${index + 1} 关`).toBe(false);
    }
  });

  it("钢墙从第二章开始出现", () => {
    const later = ALL.slice(22, 45).filter((i) => tilesOf(i).has("S"));
    expect(later.length).toBeGreaterThan(15);
  });

  it("水面从第三章开始出现,草丛从第四章开始出现", () => {
    expect(ALL.slice(45, 68).filter((i) => tilesOf(i).has("~")).length).toBeGreaterThan(10);
    expect(ALL.slice(0, 45).filter((i) => tilesOf(i).has("*")).length).toBe(0);
    expect(ALL.slice(68, 90).filter((i) => tilesOf(i).has("*")).length).toBeGreaterThan(10);
  });
});

describe("敌人配比", () => {
  it("车队规模随关号往上走,但有上限", () => {
    expect(waveSize(0)).toBeLessThan(waveSize(100));
    expect(waveSize(0)).toBeGreaterThanOrEqual(5);
    for (const i of ALL) expect(waveSize(i)).toBeLessThanOrEqual(16);
  });

  it("第一章只派快速兵", () => {
    for (const index of [0, 9, 21]) {
      const kinds = countKinds(buildWaves(index));
      expect(kinds.swift).toBeGreaterThan(0);
      expect(kinds.armor + kinds.power + kinds.smart, `第 ${index + 1} 关`).toBe(0);
    }
  });

  it("装甲车在第二章登场,火力车在第三章登场", () => {
    const ch2 = ALL.slice(22, 45).reduce((n, i) => n + countKinds(buildWaves(i)).armor, 0);
    const ch3 = ALL.slice(45, 68).reduce((n, i) => n + countKinds(buildWaves(i)).power, 0);
    expect(ch2).toBeGreaterThan(10);
    expect(ch3).toBeGreaterThan(10);
    expect(ALL.slice(0, 22).reduce((n, i) => n + countKinds(buildWaves(i)).armor, 0)).toBe(0);
    expect(ALL.slice(0, 45).reduce((n, i) => n + countKinds(buildWaves(i)).power, 0)).toBe(0);
  });

  it("机灵车要到第七章才出现", () => {
    expect(ALL.slice(0, 134).reduce((n, i) => n + countKinds(buildWaves(i)).smart, 0)).toBe(0);
    expect(ALL.slice(134, 160).reduce((n, i) => n + countKinds(buildWaves(i)).smart, 0)).toBeGreaterThan(20);
  });

  it("最后一章四种车都会出现", () => {
    const total = ALL.slice(160).reduce(
      (acc, i) => {
        const k = countKinds(buildWaves(i));
        return {
          swift: acc.swift + k.swift,
          armor: acc.armor + k.armor,
          power: acc.power + k.power,
          smart: acc.smart + k.smart,
        };
      },
      { swift: 0, armor: 0, power: 0, smart: 0 }
    );
    for (const n of Object.values(total)) expect(n).toBeGreaterThan(10);
  });

  it("每一关的时限都够宽裕,同屏敌人数有上限", () => {
    for (const lv of ALL.map(buildLevel)) {
      expect(lv.limit).toBeGreaterThanOrEqual(60);
      expect(lv.maxAlive).toBeGreaterThanOrEqual(3);
      expect(lv.maxAlive).toBeLessThanOrEqual(6);
      expect(lv.bricks).toBeGreaterThanOrEqual(3);
      expect(lv.spawnGap).toBeGreaterThanOrEqual(1.1);
    }
  });
});

describe("按人数调强度", () => {
  it("一个人玩的时候同屏少一点、出场慢一点、多给一块砖", () => {
    const lv = buildLevel(180);
    const solo = scaleForPlayers(lv, 1);
    const duo = scaleForPlayers(lv, 2);
    expect(solo.maxAlive).toBeLessThan(duo.maxAlive);
    expect(solo.spawnGap).toBeGreaterThan(duo.spawnGap);
    expect(solo.bricks).toBeGreaterThan(duo.bricks);
  });

  it("两个人玩就是原设定,一点不打折", () => {
    const lv = buildLevel(42);
    expect(scaleForPlayers(lv, 2)).toEqual({
      maxAlive: lv.maxAlive,
      spawnGap: lv.spawnGap,
      bricks: lv.bricks,
    });
  });
});

describe("无尽与对战地图", () => {
  it("无尽战场有堡垒、有三个出生点,而且四通八达", () => {
    const map = parseMap(endlessRows());
    expect(map.base).toEqual(BASE);
    expect(map.enemySpawns).toHaveLength(3);
    for (const s of map.enemySpawns) expect(reachable(map, s, BASE)).toBe(true);
    expect(scanFort(map).length).toBeGreaterThanOrEqual(10);
  });

  it("对战战场没有堡垒也没有敌人,两个人隔得够远", () => {
    const map = parseMap(versusRows());
    expect(map.base).toBeNull();
    expect(map.enemySpawns).toEqual([]);
    const [a, b] = map.playerSpawns;
    expect(Math.abs(a.cx - b.cx)).toBeGreaterThanOrEqual(10);
    expect(isFortBrick(map, 5, 6)).toBe(false);
  });

  it("对战战场两人都走得到对方那边", () => {
    const map = parseMap(versusRows());
    expect(reachable(map, map.playerSpawns[0], map.playerSpawns[1])).toBe(true);
  });
});
