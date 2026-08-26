import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, totalSize } from "../level99";
import {
  ALL_LEVELS,
  CHAPTERS,
  buildArena,
  buildCoopLevel,
  buildEndlessRound,
  buildLevel,
  chapterOfLevel,
  cornerSpawns,
  goalText,
  oddSize,
  pillarBoard,
  reachable,
  recipeFor,
  withinChapter,
} from "./levels";
import GUIDE from "./guide";
import { meta } from "./meta";
import { CRITTER_INFO, TILE_FLOOR, TILE_HARD, TILE_SOFT, idx, xOf, yOf } from "./logic";

describe("章节切分", () => {
  it("八个章节合计正好 188 关", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, meta.id)).toBe(true);
  });

  it("每一章都有名字、图标、主题色和一句介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(ch.desc.length).toBeGreaterThan(6);
      expect(ch.size).toBeGreaterThan(0);
    }
  });

  it("关号能正确落回章节与章内序号", () => {
    expect(chapterOfLevel(0)).toBe(0);
    expect(withinChapter(0)).toBe(0);
    expect(chapterOfLevel(TOTAL_LEVELS - 1)).toBe(CHAPTERS.length - 1);
    let acc = 0;
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      expect(chapterOfLevel(acc)).toBe(ci);
      expect(withinChapter(acc)).toBe(0);
      acc += CHAPTERS[ci].size;
    }
  });

  it("meta 的关数和模式与实现对得上", () => {
    expect(meta.id).toBe("bomb-buddies");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect([...meta.modes].sort()).toEqual(["campaign", "coop", "endless", "twoPlayer", "versus"]);
  });
});

describe("棋盘骨架", () => {
  it("尺寸一律取奇数", () => {
    expect(oddSize(9)).toBe(9);
    expect(oddSize(10)).toBe(11);
    expect(oddSize(2)).toBe(7);
  });

  it("外圈是墙、内部是柱子,四个角一定是空地", () => {
    const board = pillarBoard(11, 11);
    for (let x = 0; x < board.w; x++) {
      expect(board.cells[idx(board, x, 0)]).toBe(TILE_HARD);
      expect(board.cells[idx(board, x, board.h - 1)]).toBe(TILE_HARD);
    }
    expect(board.cells[idx(board, 2, 2)]).toBe(TILE_HARD);
    for (const spawn of cornerSpawns(board)) {
      expect(board.cells[spawn]).toBe(TILE_FLOOR);
    }
  });

  it("出生点旁边一定有能走的格子,不会一开局就被封死", () => {
    const board = pillarBoard(9, 9);
    for (const spawn of cornerSpawns(board)) {
      const x = xOf(board, spawn);
      const y = yOf(board, spawn);
      const free = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].filter(([nx, ny]) => nx > 0 && ny > 0 && nx < board.w - 1 && ny < board.h - 1 && board.cells[idx(board, nx, ny)] === TILE_FLOOR);
      expect(free.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("188 关全量体检", () => {
  const levels = ALL_LEVELS.map((i) => buildLevel(i));

  it("188 关一关不少,而且关号连得上", () => {
    expect(levels).toHaveLength(TOTAL_LEVELS);
    levels.forEach((lv, i) => {
      expect(lv.index).toBe(i);
      expect(lv.chapter).toBe(chapterOfLevel(i));
    });
  });

  it("每一关的出生点都是空地", () => {
    for (const lv of levels) {
      expect(lv.board.cells[lv.spawns[0]]).toBe(TILE_FLOOR);
    }
  });

  it("每一关都有小怪,而且小怪站的都是空地", () => {
    for (const lv of levels) {
      expect(lv.critters.length).toBeGreaterThan(0);
      for (const c of lv.critters) {
        expect(lv.board.cells[c.pos]).toBe(TILE_FLOOR);
        expect(c.layers).toBe(CRITTER_INFO[c.kind].layers);
      }
    }
  });

  it("每一关的小怪都走得到:不存在「怎么也打不完」的死图", () => {
    for (const lv of levels) {
      const open = reachable(lv.board, lv.spawns[0], false);
      for (const c of lv.critters) {
        expect(open.has(c.pos), `第 ${lv.index + 1} 关的小怪够不着`).toBe(true);
      }
    }
  });

  it("出口关的出口藏在砖底下,而且旁边够得着", () => {
    const exits = levels.filter((lv) => lv.goal === "exit");
    expect(exits.length).toBeGreaterThan(10);
    for (const lv of exits) {
      expect(lv.exit).toBeGreaterThanOrEqual(0);
      expect(lv.board.cells[lv.exit]).toBe(TILE_SOFT);
      const open = reachable(lv.board, lv.spawns[0], false);
      const near = [lv.exit - 1, lv.exit + 1, lv.exit - lv.board.w, lv.exit + lv.board.w].some((c) => open.has(c));
      expect(near, `第 ${lv.index + 1} 关的出口够不着`).toBe(true);
    }
  });

  it("最后一章有泡泡王关,而且泡泡王要包三层", () => {
    const bosses = levels.filter((lv) => lv.goal === "boss");
    expect(bosses.length).toBeGreaterThanOrEqual(4);
    for (const lv of bosses) {
      const boss = lv.critters.find((c) => c.kind === "boss");
      expect(boss).toBeTruthy();
      expect(boss!.layers).toBe(3);
      expect(lv.chapter).toBe(CHAPTERS.length - 1);
    }
  });

  it("藏在砖里的道具只会藏在软砖底下,而且不会占着出口", () => {
    for (const lv of levels) {
      for (const [cell] of lv.hidden) {
        expect(lv.board.cells[cell]).toBe(TILE_SOFT);
        expect(cell).not.toBe(lv.exit);
      }
    }
  });

  it("同一关生成两次的结果完全一样,可以背板", () => {
    for (const i of [0, 37, 96, 150, 187]) {
      const a = buildLevel(i);
      const b = buildLevel(i);
      expect(a.board.cells).toEqual(b.board.cells);
      expect(a.critters.map((c) => `${c.kind}@${c.pos}`)).toEqual(b.critters.map((c) => `${c.kind}@${c.pos}`));
      expect([...a.hidden.entries()]).toEqual([...b.hidden.entries()]);
      expect(a.exit).toBe(b.exit);
    }
  });

  it("越往后场地越大、小怪越多、时间给得越足", () => {
    const first = buildLevel(0);
    const last = buildLevel(TOTAL_LEVELS - 1);
    expect(last.board.cells.length).toBeGreaterThan(first.board.cells.length);
    expect(last.critters.length).toBeGreaterThan(first.critters.length);
    expect(last.seconds).toBeGreaterThan(first.seconds);
  });

  it("每一关都有一句提示,而且目标说得明明白白", () => {
    for (const lv of levels) {
      expect(lv.hint.length).toBeGreaterThan(8);
      expect(goalText(lv.goal).length).toBeGreaterThan(6);
    }
  });

  it("砖不会把整张图铺满:每一关都留着足够的空地", () => {
    for (const lv of levels) {
      const floors = lv.board.cells.filter((c) => c === TILE_FLOOR).length;
      const total = lv.board.cells.length;
      expect(floors / total, `第 ${lv.index + 1} 关太挤了`).toBeGreaterThan(0.15);
    }
  });

  it("配方随章节稳步加码,火力道具从第 2 章起送", () => {
    const r0 = recipeFor(0, 0, CHAPTERS[0].size);
    const r7 = recipeFor(7, 22, CHAPTERS[7].size);
    expect(r0.starters).toEqual([]);
    expect(r7.starters).toContain("fire");
    expect(r7.density).toBeGreaterThan(r0.density);
    expect(r7.critters.length).toBeGreaterThan(r0.critters.length);
  });
});

describe("对战擂台", () => {
  it("两个人分踞对角,出生点都是空地", () => {
    const lv = buildArena(1, 2);
    expect(lv.spawns).toHaveLength(2);
    for (const spawn of lv.spawns) expect(lv.board.cells[spawn]).toBe(TILE_FLOOR);
    expect(lv.critters).toHaveLength(0);
  });

  it("砖块中心对称,谁都不吃亏", () => {
    for (const round of [1, 2, 7]) {
      const lv = buildArena(round, 2);
      const b = lv.board;
      for (let i = 0; i < b.cells.length; i++) {
        const mirror = idx(b, b.w - 1 - xOf(b, i), b.h - 1 - yOf(b, i));
        expect(b.cells[i], `第 ${round} 局的擂台不对称`).toBe(b.cells[mirror]);
      }
    }
  });

  it("两个人互相走得到,不会被砖墙隔成两个世界", () => {
    for (const round of [1, 3, 6]) {
      const lv = buildArena(round, 2);
      // 砖是能炸开的,所以「把砖当路」连通就够了
      const open = reachable(lv.board, lv.spawns[0], true);
      expect(open.has(lv.spawns[1])).toBe(true);
    }
  });
});

describe("无尽与合作", () => {
  it("无尽的图越往后越大,小怪也越多", () => {
    const a = buildEndlessRound(1);
    const b = buildEndlessRound(12);
    expect(b.board.cells.length).toBeGreaterThan(a.board.cells.length);
    expect(b.critters.length).toBeGreaterThan(a.critters.length);
    expect(a.seconds).toBe(0);
  });

  it("无尽的小怪都够得着", () => {
    for (const round of [1, 3, 7, 12]) {
      const lv = buildEndlessRound(round);
      const open = reachable(lv.board, lv.spawns[0], false);
      for (const c of lv.critters) expect(open.has(c.pos)).toBe(true);
    }
  });

  it("合作关有两个出生点,而且时间比单人宽裕", () => {
    for (const i of [0, 50, 120, 187]) {
      const solo = buildLevel(i);
      const coop = buildCoopLevel(i);
      expect(coop.spawns).toHaveLength(2);
      expect(coop.spawns[0]).not.toBe(coop.spawns[1]);
      expect(coop.seconds).toBeGreaterThan(solo.seconds);
      for (const spawn of coop.spawns) expect(coop.board.cells[spawn]).toBe(TILE_FLOOR);
    }
  });
});

describe("攻略", () => {
  it("攻略认领的是自己这款游戏,而且写满 8 条章节", () => {
    expect(GUIDE.gameId).toBe(meta.id);
    expect(GUIDE.entries.length).toBeGreaterThanOrEqual(8);
    expect(GUIDE.general.length).toBeGreaterThanOrEqual(3);
    expect(GUIDE.general.length).toBeLessThanOrEqual(6);
  });

  it("188 关每一关都能翻到对应的攻略", () => {
    for (let level = 1; level <= TOTAL_LEVELS; level++) {
      const hit = GUIDE.entries.some((e) => e.from <= level && level <= e.to);
      expect(hit, `第 ${level} 关没有攻略`).toBe(true);
    }
  });

  it("攻略只讲方法,不出现「答案」这类字眼", () => {
    const all = [GUIDE.title, ...GUIDE.general, ...GUIDE.entries.flatMap((e) => [e.title, ...e.tips])];
    for (const line of all) {
      expect(line).not.toContain("答案");
      expect(line.trim().length).toBeGreaterThan(0);
    }
  });
});
