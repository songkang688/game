// 1.1：拼图乐园 99 → 188 的新画册、新板式与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, mulberry32, totalSize, TOTAL_LEVELS } from "../level99";
import {
  buildFillPuzzle,
  buildRotations,
  CHAPTERS,
  endlessBoard,
  endlessHallName,
  endlessLine,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  LEVELS,
  minRotateClicks,
  NEW_POOL_SIZE,
  THEME_TILES,
} from "./levels";
import {
  bestSlideMove,
  boardKind,
  isSolvedSlide,
  loseLine,
  openingLine,
  shuffleBoard,
  slideClick,
  starsFor,
  winLine,
} from "./logic";

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
/** 四本新画册的关号区间（0 基，左闭右开） */
const SCROLL = [99, 122] as const;
const ROTATE = [122, 144] as const;
const FILL = [144, 166] as const;
const TIMED = [166, 188] as const;

describe("拼图乐园 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "花园画册", "动物画册", "交通画册", "水果派对", "星空画册", "彩虹大画展",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("前 99 关每关参数一笔未改（生成指纹回归）", () => {
    expect(fnv(JSON.stringify(LEVELS.slice(0, 99)))).toBe("61ee1ed2");
  });

  it("前 99 关一律没有任何 1.1 新字段，六套老素材一块没动", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.mode).toBeUndefined();
      expect(lv.timeLimit).toBeUndefined();
      expect(lv.missing).toBeUndefined();
      expect(lv.extraPieces).toBeUndefined();
      expect(lv.rotateWrong).toBeUndefined();
      expect(lv.seed).toBeUndefined();
      expect(lv.theme).toBeLessThanOrEqual(5);
    }
    for (const pool of THEME_TILES.slice(0, 6)) expect(pool).toHaveLength(15);
  });
});

describe("拼图乐园 · 1.1 新画册", () => {
  it("总关数 188，末尾追加了 4 本全新画册共 89 关", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual(["巨幅长卷", "旋转风车园", "缺块补齐", "限时大画展"]);
  });

  it("新画册文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
  });

  it("四套新素材各 36 块、块块不重样，够 6×6 用", () => {
    expect(THEME_TILES).toHaveLength(10);
    for (const pool of THEME_TILES.slice(6)) {
      expect(pool).toHaveLength(NEW_POOL_SIZE);
      expect(new Set(pool.map((p) => p.emoji)).size).toBe(pool.length);
      for (const tile of pool) expect(tile.bg).toMatch(/^#[0-9A-F]{6}$/i);
    }
    expect(NEW_POOL_SIZE).toBeGreaterThanOrEqual(6 * 6 - 1);
  });

  it("四本新画册的板式各不相同：大画板 / 旋转 / 缺块 / 限时", () => {
    for (let lv = SCROLL[0]; lv < SCROLL[1]; lv++) {
      expect(boardKind(LEVELS[lv])).toBe("slide");
      expect(LEVELS[lv].rows * LEVELS[lv].cols).toBe(25);
    }
    for (let lv = ROTATE[0]; lv < ROTATE[1]; lv++) {
      expect(LEVELS[lv].mode).toBe("rotate");
      expect(LEVELS[lv].rotateWrong ?? 0).toBeGreaterThanOrEqual(4);
    }
    for (let lv = FILL[0]; lv < FILL[1]; lv++) {
      expect(LEVELS[lv].mode).toBe("fill");
      expect(LEVELS[lv].missing ?? 0).toBeGreaterThanOrEqual(3);
    }
    for (let lv = TIMED[0]; lv < TIMED[1]; lv++) {
      expect(boardKind(LEVELS[lv])).toBe("slide");
      expect(LEVELS[lv].timeLimit ?? 0).toBeGreaterThanOrEqual(200);
    }
    // 限时只在最后一本画册出现；6×6 的巨幅也只在那里
    for (const lv of NEW_LEVELS) {
      const ci = chapterOf(CHAPTERS, lv);
      if (ci !== 9) expect(LEVELS[lv].timeLimit).toBeUndefined();
      if (ci !== 9) expect(LEVELS[lv].cols).toBeLessThanOrEqual(5);
    }
    expect(LEVELS.slice(TIMED[0], TIMED[1]).some((l) => l.cols === 6)).toBe(true);
  });

  it("第 100–188 关逐关参数可玩：素材够、评星门槛递增、提示不少于 3 次", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      const need = boardKind(cfg) === "slide" ? cfg.rows * cfg.cols - 1 : cfg.rows * cfg.cols;
      expect(need).toBeLessThanOrEqual(THEME_TILES[cfg.theme].length);
      expect(cfg.theme).toBeGreaterThanOrEqual(6);
      expect(cfg.three).toBeGreaterThan(0);
      expect(cfg.two).toBeGreaterThan(cfg.three);
      expect(cfg.moveLimit).toBeGreaterThan(cfg.two);
      expect(cfg.hints).toBeGreaterThanOrEqual(3);
      expect(cfg.rows).toBeGreaterThanOrEqual(3);
      expect(cfg.rows).toBeLessThanOrEqual(6);
    }
  });

  it("新画册内部难度递进：格子更多或打乱更狠", () => {
    expect(LEVELS[SCROLL[0]].shuffleSteps).toBeLessThan(LEVELS[SCROLL[1] - 1].shuffleSteps);
    expect(LEVELS[ROTATE[0]].rotateWrong!).toBeLessThan(LEVELS[ROTATE[1] - 1].rotateWrong!);
    expect(LEVELS[FILL[0]].missing!).toBeLessThan(LEVELS[FILL[1] - 1].missing!);
    expect(LEVELS[TIMED[0]].timeLimit!).toBeGreaterThan(LEVELS[TIMED[1] - 1].timeLimit!);
    expect(LEVELS[TIMED[0]].shuffleSteps).toBeLessThan(LEVELS[TIMED[1] - 1].shuffleSteps);
  });
});

describe("拼图乐园 · 第 100–188 关逐关可解", () => {
  it("每一关推格子拼图都能按记录的逆序一步步还原，而且步数在上限内", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      if (boardKind(cfg) !== "slide") continue;
      const plan = shuffleBoard(cfg.rows, cfg.cols, cfg.shuffleSteps, mulberry32(lv * 977 + 5));
      expect(isSolvedSlide(plan.board)).toBe(false);
      const board = plan.board.slice();
      for (const pos of plan.undo) {
        expect(slideClick(board, pos, cfg.rows, cfg.cols)).toBe(true);
      }
      expect(isSolvedSlide(board)).toBe(true);
      expect(plan.undo.length).toBeLessThan(cfg.moveLimit);
    }
  });

  it("每一关旋转拼图都能在点击上限内全部转正", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      if (cfg.mode !== "rotate") continue;
      const rot = buildRotations(cfg.rows, cfg.cols, cfg.rotateWrong!, cfg.seed!);
      expect(rot).toHaveLength(cfg.rows * cfg.cols);
      const need = minRotateClicks(rot);
      expect(need).toBe(cfg.three);
      expect(need).toBeLessThan(cfg.moveLimit);
      // 照着点：每块点到 0 为止
      let clicks = 0;
      const now = rot.slice();
      for (let i = 0; i < now.length; i++) {
        while (now[i] !== 0) {
          now[i] = (now[i] + 1) % 4;
          clicks++;
        }
      }
      expect(now.every((r) => r === 0)).toBe(true);
      expect(clicks).toBe(need);
    }
  });

  it("每一关缺块拼图的缺口和托盘都对得上，干扰块绝不在画面里", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      if (cfg.mode !== "fill") continue;
      const total = cfg.rows * cfg.cols;
      const pool = THEME_TILES[cfg.theme];
      const puzzle = buildFillPuzzle(cfg.rows, cfg.cols, cfg.missing!, cfg.extraPieces!, cfg.seed!, pool.length);
      expect(puzzle.holes).toHaveLength(cfg.missing!);
      expect(new Set(puzzle.holes).size).toBe(puzzle.holes.length);
      for (const h of puzzle.holes) {
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(total);
        expect(puzzle.tray).toContain(h);
      }
      // 干扰块的块号一律在画面之外，不会和画上摆着的块撞脸
      for (const v of puzzle.tray) {
        if (!puzzle.holes.includes(v)) expect(v).toBeGreaterThanOrEqual(total);
        expect(v).toBeLessThan(pool.length);
      }
      expect(puzzle.tray).toHaveLength(cfg.missing! + cfg.extraPieces!);
      expect(cfg.missing! + cfg.extraPieces!).toBeLessThan(cfg.moveLimit);
    }
  });

  it("同一关每次生成完全一样（确定性），换个种子会变", () => {
    const cfg = LEVELS[ROTATE[0] + 5];
    expect(buildRotations(cfg.rows, cfg.cols, cfg.rotateWrong!, cfg.seed!))
      .toEqual(buildRotations(cfg.rows, cfg.cols, cfg.rotateWrong!, cfg.seed!));
    expect(buildRotations(4, 4, 6, 1)).not.toEqual(buildRotations(4, 4, 6, 2));
    const f = LEVELS[FILL[0] + 5];
    expect(buildFillPuzzle(f.rows, f.cols, f.missing!, f.extraPieces!, f.seed!))
      .toEqual(buildFillPuzzle(f.rows, f.cols, f.missing!, f.extraPieces!, f.seed!));
  });

  it("旋转朝向表：歪的块数正好、朝向只在 0..3", () => {
    for (let wrong = 1; wrong <= 16; wrong++) {
      const rot = buildRotations(4, 4, wrong, wrong * 31);
      expect(rot.filter((r) => r !== 0)).toHaveLength(wrong);
      for (const r of rot) {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(3);
      }
    }
    expect(minRotateClicks([0, 1, 2, 3])).toBe(3 + 2 + 1);
    expect(minRotateClicks([0, 0, 0])).toBe(0);
  });
});

describe("拼图乐园 · 推格子规则", () => {
  it("只有挨着空格的方块推得动", () => {
    const board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    expect(slideClick(board, 0, 3, 3)).toBe(false);
    expect(slideClick(board, 7, 3, 3)).toBe(true);
    expect(board[7]).toBe(8);
    expect(board[8]).toBe(7);
    expect(isSolvedSlide(board)).toBe(false);
    // 空格自己点不动，得点原来那块（现在躺在 8 号位）才推得回来
    expect(slideClick(board, 7, 3, 3)).toBe(false);
    expect(slideClick(board, 8, 3, 3)).toBe(true);
    expect(isSolvedSlide(board)).toBe(true);
  });

  it("提示总能指出一块推得动的方块", () => {
    for (let seed = 0; seed < 40; seed++) {
      const plan = shuffleBoard(4, 4, 30, mulberry32(seed));
      const best = bestSlideMove(plan.board, 4, 4);
      expect(best).not.toBeUndefined();
      expect(slideClick(plan.board.slice(), best!, 4, 4)).toBe(true);
    }
  });

  it("打乱一定不会原地不动，逆序步数就是打乱步数", () => {
    for (const steps of [8, 20, 45, 90]) {
      const plan = shuffleBoard(5, 5, steps, mulberry32(steps));
      expect(isSolvedSlide(plan.board)).toBe(false);
      expect(plan.undo.length).toBeGreaterThanOrEqual(steps);
    }
  });
});

describe("拼图乐园 · 无尽画廊", () => {
  it("每一幅都能拼：三种板式轮着来，参数都在合法范围里", () => {
    const kinds = new Set<string>();
    for (let round = 1; round <= 60; round++) {
      const cfg = endlessBoard(round);
      kinds.add(boardKind(cfg));
      expect(cfg.rows).toBeGreaterThanOrEqual(3);
      expect(cfg.rows).toBeLessThanOrEqual(6);
      expect(cfg.theme).toBeGreaterThanOrEqual(6);
      expect(cfg.theme).toBeLessThanOrEqual(9);
      expect(cfg.two).toBeGreaterThan(cfg.three);
      expect(cfg.moveLimit).toBeGreaterThan(cfg.two);
      expect(cfg.hints).toBeGreaterThanOrEqual(3);
      const need = boardKind(cfg) === "slide" ? cfg.rows * cfg.cols - 1 : cfg.rows * cfg.cols;
      expect(need).toBeLessThanOrEqual(THEME_TILES[cfg.theme].length);
    }
    expect(kinds).toEqual(new Set(["slide", "rotate", "fill"]));
  });

  it("幅数越靠后越难，但第 19 幅之后停在封顶", () => {
    expect(endlessBoard(1).rows).toBeLessThanOrEqual(endlessBoard(40).rows);
    expect(endlessBoard(19)).toEqual(endlessBoard(19));
    expect(endlessBoard(0)).toEqual(endlessBoard(1));
    expect(endlessBoard(22).rows).toBe(endlessBoard(40).rows);
  });

  it("展厅名每 4 幅换一间，且全是中文", () => {
    expect(endlessHallName(1)).toBe("晨光厅");
    expect(endlessHallName(4)).toBe("晨光厅");
    expect(endlessHallName(5)).toBe("森林厅");
    expect(endlessHallName(999)).toBe("焰火厅");
    for (let r = 1; r <= 40; r++) expect(endlessHallName(r)).not.toMatch(/[A-Za-z]/);
  });

  it("收工文案只鼓励不批评", () => {
    expect(endlessLine(9, 4)).toContain("新纪录");
    expect(endlessLine(2, 8)).toContain("最好成绩");
    expect(endlessLine(0, 0)).toContain("别急");
    for (const line of [endlessLine(0, 0), endlessLine(2, 8), endlessLine(9, 4)]) {
      expect(line).not.toMatch(/[A-Za-z]/);
      expect(line).not.toMatch(/笨|太差|没用|不行/);
    }
  });
});

describe("拼图乐园 · 评星与文案", () => {
  it("步数越省星越多", () => {
    const cfg = LEVELS[SCROLL[0]];
    expect(starsFor(cfg.three, cfg)).toBe(3);
    expect(starsFor(cfg.three + 1, cfg)).toBe(2);
    expect(starsFor(cfg.two, cfg)).toBe(2);
    expect(starsFor(cfg.two + 1, cfg)).toBe(1);
  });

  it("开局说明按板式分流，全是中文", () => {
    expect(openingLine(LEVELS[ROTATE[0]])).toContain("转正");
    expect(openingLine(LEVELS[FILL[0]])).toContain("托盘");
    expect(openingLine(LEVELS[SCROLL[0]])).toContain("空格");
    expect(openingLine(LEVELS[55])).toContain("记住");
    for (const lv of NEW_LEVELS) expect(openingLine(LEVELS[lv])).not.toMatch(/[A-Za-z]/);
  });

  it("胜负文案按板式分流，失败话术不批评小朋友", () => {
    expect(winLine(LEVELS[ROTATE[0]], 12, 0)).toContain("风车");
    expect(winLine(LEVELS[FILL[0]], 5, 0)).toContain("缺口");
    expect(winLine(LEVELS[TIMED[0]], 40, 30)).toContain("沙漏");
    expect(winLine(LEVELS[SCROLL[0]], 40, 0)).toContain("步");
    expect(loseLine(LEVELS[TIMED[0]], "time")).toContain("沙漏");
    expect(loseLine(LEVELS[ROTATE[0]], "moves")).toContain("一定行");
    expect(loseLine(LEVELS[FILL[0]], "moves")).toContain("花纹比一比");
    for (const cfg of [LEVELS[0], LEVELS[ROTATE[0]], LEVELS[FILL[0]], LEVELS[TIMED[0]]]) {
      for (const reason of ["moves", "time"] as const) {
        const line = loseLine(cfg, reason);
        expect(line).not.toMatch(/[A-Za-z]/);
        expect(line).not.toMatch(/笨|太差|没用|不行/);
      }
    }
  });
});
