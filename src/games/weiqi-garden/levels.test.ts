import { describe, expect, it } from "vitest";
import { assertTotal, TOTAL_LEVELS } from "../level99";
import { BLACK, formatRows, groupAt, parseRows } from "./board";
import { autoDeadStones } from "./life";
import { play, playMove, createGame } from "./rules";
import { damePoints } from "./score";
import guide from "./guide";
import {
  CHAPTERS,
  KIND_LABELS,
  aliveSolutions,
  captureSolutions,
  chapterIndexOf,
  chapterStartOf,
  cloneLevelBoard,
  koSolutions,
  levelAt,
  levelBoard,
  levelCleared,
  levelSolutions,
  levelSummary,
  mirrorStamp,
  rotateStamp,
  rotateTimes,
  starsFor,
  targetAlive,
  type WeiqiLevel
} from "./levels";

const ALL: WeiqiLevel[] = Array.from({ length: 188 }, (_, i) => levelAt(i));

describe("weiqi-garden · 章节切分", () => {
  it("八章之和恒等于 188", () => {
    expect(assertTotal(CHAPTERS, 188, "weiqi-garden")).toBe(true);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS)).toBe(true);
    expect(CHAPTERS).toHaveLength(8);
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(188);
  });

  it("章节名、emoji、颜色、说明一个都不缺", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThan(6);
    }
  });

  it("关号能算回章节,章节起点也对得上", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(23)).toBe(0);
    expect(chapterIndexOf(24)).toBe(1);
    expect(chapterIndexOf(187)).toBe(7);
    expect(chapterStartOf(0)).toBe(0);
    expect(chapterStartOf(4)).toBe(96);
    expect(chapterStartOf(8)).toBe(188);
  });
});

describe("weiqi-garden · 188 关每题都有解", () => {
  it("逐关算出至少一个正确答案", () => {
    const empty = ALL.filter((lv) => levelSolutions(lv).length === 0).map((lv) => lv.index + 1);
    expect(empty).toEqual([]);
  });

  it("同一关每次生成的盘面一模一样", () => {
    for (const idx of [0, 37, 96, 130, 187]) {
      expect(formatRows(levelBoard(levelAt(idx)))).toEqual(levelAt(idx).rows);
      expect(levelAt(idx)).toBe(levelAt(idx));
      expect(formatRows(cloneLevelBoard(levelAt(idx)))).toEqual(levelAt(idx).rows);
    }
  });

  it("路数按章走:前六章九路、第七章十三路、第八章十九路", () => {
    for (const lv of ALL) {
      const want = lv.chapterIndex <= 5 ? 9 : lv.chapterIndex === 6 ? 13 : 19;
      expect(lv.size).toBe(want);
      expect(lv.rows).toHaveLength(want);
      expect(lv.rows[0]).toHaveLength(want);
    }
  });

  it("题型按章走,第六章用数目法、其余用数子法", () => {
    const byChapter = new Map<number, Set<string>>();
    for (const lv of ALL) {
      if (!byChapter.has(lv.chapterIndex)) byChapter.set(lv.chapterIndex, new Set());
      byChapter.get(lv.chapterIndex)?.add(lv.kind);
      expect(lv.rule).toBe(lv.chapterIndex === 5 ? "japanese" : "chinese");
      expect(lv.turn).toBe(BLACK);
    }
    expect([...(byChapter.get(0) ?? [])]).toEqual(["capture"]);
    expect([...(byChapter.get(1) ?? [])]).toEqual(["eye"]);
    expect([...(byChapter.get(2) ?? [])]).toEqual(["ko"]);
    expect([...(byChapter.get(3) ?? [])]).toEqual(["lifeDeath"]);
    expect([...(byChapter.get(4) ?? [])]).toEqual(["dame"]);
    expect([...(byChapter.get(5) ?? [])]).toEqual(["markDead"]);
    expect(byChapter.get(6)?.has("battle")).toBe(true);
    expect(byChapter.get(7)?.has("battle")).toBe(true);
  });

  it("手数上限与三星门槛都是正数,而且门槛不比上限还松", () => {
    for (const lv of ALL) {
      expect(lv.moveBudget).toBeGreaterThan(0);
      expect(lv.parMoves).toBeGreaterThan(0);
      expect(lv.parMoves).toBeLessThanOrEqual(lv.moveBudget);
    }
  });
});

describe("weiqi-garden · 走出正确解就能过关", () => {
  it("提子题:下在那口气上就提到了", () => {
    for (const lv of ALL.filter((l) => l.kind === "capture").slice(0, 12)) {
      const board = levelBoard(lv);
      const pt = levelSolutions(lv)[0];
      const res = play(board, pt, BLACK);
      expect(res).not.toBeNull();
      expect(res!.captured.length).toBeGreaterThanOrEqual(lv.need);
      expect(levelCleared(lv, res!.board, res!.captured.length)).toBe(true);
      expect(captureSolutions(board, lv.need)).toContain(pt);
    }
  });

  it("做眼题 / 死活题:下完那一手,目标块就有两只真眼", () => {
    for (const lv of ALL.filter((l) => l.kind === "eye" || l.kind === "lifeDeath").slice(0, 16)) {
      expect(lv.target).not.toBeNull();
      const board = levelBoard(lv);
      expect(groupAt(board, lv.target as number)?.color).toBe(BLACK);
      expect(targetAlive(board, lv.target)).toBe(false);
      const pt = levelSolutions(lv)[0];
      const res = play(board, pt, BLACK);
      expect(targetAlive(res!.board, lv.target)).toBe(true);
      expect(levelCleared(lv, res!.board, 0)).toBe(true);
      expect(aliveSolutions(board, lv.target)).toContain(pt);
    }
  });

  it("打劫题:那一手既提到子又成了劫", () => {
    for (const lv of ALL.filter((l) => l.kind === "ko").slice(0, 12)) {
      const board = levelBoard(lv);
      const pt = levelSolutions(lv)[0];
      const state = createGame({ size: lv.size, board, turn: BLACK });
      const res = playMove(state, pt);
      expect(res.ok).toBe(true);
      expect(res.ok && res.captured).toHaveLength(1);
      expect(res.ok && res.ko).not.toBeNull();
      expect(koSolutions(board)).toContain(pt);
    }
  });

  it("官子题:把单官一个个填完就过关", () => {
    for (const lv of ALL.filter((l) => l.kind === "dame").slice(0, 8)) {
      let board = levelBoard(lv);
      expect(damePoints(board).length).toBe(lv.need);
      expect(levelCleared(lv, board, 0)).toBe(false);
      let guard = 0;
      while (damePoints(board).length > 0 && guard++ < 12) {
        const res = play(board, damePoints(board)[0], BLACK);
        expect(res).not.toBeNull();
        board = res!.board;
      }
      expect(levelCleared(lv, board, 0)).toBe(true);
    }
  });

  it("标死子题:标对了才算过,少标一颗都不行", () => {
    for (const lv of ALL.filter((l) => l.kind === "markDead").slice(0, 8)) {
      const board = levelBoard(lv);
      const want = autoDeadStones(board);
      expect(want.length).toBe(lv.need);
      expect(want.length).toBeGreaterThan(0);
      expect(levelCleared(lv, board, 0, want)).toBe(true);
      expect(levelCleared(lv, board, 0, want.slice(1))).toBe(false);
      expect(levelCleared(lv, board, 0, [])).toBe(false);
    }
  });

  it("对局任务:开局就有一手能提到目标那么多颗", () => {
    for (const lv of ALL.filter((l) => l.kind === "battle")) {
      const board = levelBoard(lv);
      const sols = levelSolutions(lv);
      expect(sols.length).toBeGreaterThan(0);
      const res = play(board, sols[0], BLACK);
      expect(res!.captured.length).toBeGreaterThanOrEqual(lv.need);
      expect(lv.moveBudget).toBeGreaterThanOrEqual(4);
    }
  });

  it("星级按手数给:一手过关是三星,拖久了降到一星", () => {
    const lv = levelAt(0);
    expect(starsFor(lv, lv.parMoves)).toBe(3);
    expect(starsFor(lv, lv.parMoves + 1)).toBe(2);
    expect(starsFor(lv, lv.parMoves + 5)).toBe(1);
  });
});

describe("weiqi-garden · 模板工具", () => {
  it("模板转 90 度、镜像都对", () => {
    expect(rotateStamp(["AB", "CD"])).toEqual(["CA", "DB"]);
    expect(mirrorStamp(["AB", "CD"])).toEqual(["BA", "DC"]);
    expect(rotateTimes(["AB", "CD"], 4)).toEqual(["AB", "CD"]);
    expect(rotateTimes(["AB", "CD"], 0)).toEqual(["AB", "CD"]);
  });
});

describe("weiqi-garden · 文案红线", () => {
  const BANNED = [
    "愤怒的小鸟",
    "植物大战僵尸",
    "水果忍者",
    "地铁跑酷",
    "森林冰火人",
    "拳皇",
    "街霸",
    "超级玛丽",
    "马里奥",
    "俄罗斯方块",
    "Tetris",
    "我的世界",
    "Minecraft",
    "三国杀",
    "大富翁",
    "斗地主",
    "吃豆人",
    "宝可梦",
    "皮卡丘",
    "奥特曼",
    "喜羊羊",
    "原神",
    "王者荣耀"
  ];

  const text = [
    ...CHAPTERS.map((c) => `${c.name}${c.desc}`),
    ...ALL.map((lv) => `${lv.title}${lv.task}${lv.hint}${levelSummary(lv)}`),
    guide.title,
    ...guide.general,
    ...guide.entries.flatMap((e) => [e.title, ...e.tips]),
    ...Object.values(KIND_LABELS)
  ].join("\n");

  it("章节、题目、攻略里一个商标都没有", () => {
    for (const word of BANNED) expect(text).not.toContain(word);
  });

  it("没有打打杀杀的说法,提子说的是请回篮子", () => {
    expect(text).not.toMatch(/血|杀死|死掉|尸/);
    expect(text).toContain("篮子");
  });

  it("攻略只讲方法,不写具体某一关的答案", () => {
    expect(guide.gameId).toBe("weiqi-garden");
    expect(guide.entries).toHaveLength(8);
    for (const entry of guide.entries) {
      expect(entry.tips.length).toBeGreaterThanOrEqual(2);
      // 不许出现「第 N 关下在 XX」这种直接给答案的写法
      expect(entry.tips.join("")).not.toMatch(/第\s*\d+\s*关.{0,6}下在/);
    }
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[7].to).toBe(188);
  });

  it("每关的一句话总结带路数与题型", () => {
    const lv = levelAt(0);
    expect(levelSummary(lv)).toContain("9 路");
    expect(levelSummary(lv)).toContain(KIND_LABELS[lv.kind]);
    expect(parseRows(lv.rows).size).toBe(9);
  });
});
