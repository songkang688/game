/**
 * 窗口4 · 档B · 第 1 轮验收 —— 拼图乐园(puzzle-tiles)。
 *
 * 剧本:首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 关 →
 * 无尽画廊玩到结算 → 360px 窄屏 → 硬约束自查。
 * 只增用例,不改既有用例。
 */
import { describe, expect, it } from "vitest";
import {
  globalListenerBalance,
  inlineCss,
  mountFunctionsReturnDestroy,
  narrowBreakpoints,
  overflowingRules,
  rafBalanced,
  readGameSources,
  respectsReducedMotion,
  saveKeysIn,
  scanAudioMisuse,
  scanExternalDeps,
  scanRatingWords,
  scanTrademarks,
} from "../adventure-king/qaAudit";
import { loadGames } from "../../engine/loader";
import { TOTAL_LEVELS, mulberry32, totalSize } from "../level99";
import {
  CHAPTERS,
  LEVELS,
  THEME_TILES,
  buildFillPuzzle,
  buildRotations,
  endlessBoard,
  endlessHallName,
  endlessLine,
  minRotateClicks,
  type PuzzleLevel,
} from "./levels";
import {
  bestSlideMove,
  boardKind,
  isSolvedSlide,
  loseLine,
  shuffleBoard,
  slideClick,
  starsFor,
  winLine,
  type ShuffledBoard,
} from "./logic";
import { meta } from "./meta";
import {
  PREVIEW_KEY,
  RESUME_KEY,
  SNAP_RATIO,
  TileBag,
  bounceLine,
  cellCenter,
  dropCostsMove,
  galleryPeak,
  galleryPieces,
  nearestCell,
  resolveDrop,
  snapThreshold,
  type GridGeom,
} from "./snap";

const SOURCES = readGameSources("puzzle-tiles");
const INDEX = SOURCES.find((s) => s.name === "index.ts")!;
const CSS = inlineCss(INDEX);

/** 按关卡参数洗一盘(可复现) */
function shuffleOf(cfg: PuzzleLevel, seed: number): ShuffledBoard {
  return shuffleBoard(cfg.rows, cfg.cols, cfg.shuffleSteps, mulberry32(seed));
}

/** 照着洗牌时记下的逆序路线把一盘推格子拼图还原,顺带数一数用了几步 */
function solveSlide(cfg: PuzzleLevel, seed: number): { moves: number; solved: boolean } {
  const plan = shuffleOf(cfg, seed);
  const board = plan.board.slice();
  let moves = 0;
  for (const pos of plan.undo) {
    expect(slideClick(board, pos, cfg.rows, cfg.cols)).toBe(true);
    moves++;
  }
  return { moves, solved: isSolvedSlide(board) };
}

describe("档B R1 · 拼图乐园 · 首页进入", () => {
  it("首页收得到这一款,卡片信息完整", () => {
    const card = loadGames().find((g) => g.meta.id === "puzzle-tiles");
    expect(card, "首页 loadGames() 里找不到 puzzle-tiles").toBeTruthy();
    expect(card!.meta.title).toBe("拼图乐园");
    expect(card!.meta.category).toBe("casual");
    expect(card!.meta.blurb.length).toBeGreaterThan(10);
    expect(typeof card!.load).toBe("function");
  });

  it("meta.levels 与真实关卡表一致(188)", () => {
    expect(meta.levels).toBe(188);
    expect(LEVELS).toHaveLength(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
  });

  it("meta.modes 声明的玩法在实现里都真的有", () => {
    expect([...meta.modes]).toEqual(["campaign", "endless"]);
    expect(INDEX.text).toContain("function mountEndless");
    expect(INDEX.text).toContain("mountLevelGame");
  });

  it("从首页点进来能拿到 mount(动态 chunk 可加载)", async () => {
    const mod = await import("./index");
    expect(typeof mod.mount).toBe("function");
    expect(mod.meta.id).toBe("puzzle-tiles");
  });
});

describe("档B R1 · 拼图乐园 · 赢一次 + 输一次", () => {
  it("赢:第 1 关照着还原路线走能拼好,而且步数够拿 3 星", () => {
    const cfg = LEVELS[0];
    expect(boardKind(cfg)).toBe("slide");
    const run = solveSlide(cfg, 20260101);
    expect(run.solved).toBe(true);
    expect(run.moves).toBeLessThanOrEqual(cfg.moveLimit);
    expect(starsFor(cfg.three, cfg)).toBe(3);
    expect(winLine(cfg, cfg.three, 30)).toMatch(/./);
  });

  it("输:步数用光就结算,鼓励语只讲方法不讲重话", () => {
    const cfg = LEVELS[0];
    const line = loseLine(cfg, "moves");
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toMatch(/失败|你输了|太差|笨/);
    expect(starsFor(cfg.moveLimit + 50, cfg)).toBe(1);
  });

  it("输:限时关时间到也会结算,同样只鼓励", () => {
    const timed = LEVELS.find((lv) => (lv.timeLimit ?? 0) > 0)!;
    expect(timed).toBeTruthy();
    const line = loseLine(timed, "time");
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toMatch(/失败|你输了|太差|笨/);
  });

  it("放错块只是弹回来 + 解释,不扣心不责怪", () => {
    const g: GridGeom = { left: 0, top: 0, cell: 60, gap: 4, cols: 4, rows: 4 };
    const center = cellCenter(g, 5);
    const far = resolveDrop(g, center.x + 200, center.y + 200, { holes: [5], filled: [], value: 5 });
    expect(far.kind).toBe("bounce");
    expect(dropCostsMove(far)).toBe(false);
    const wrong = resolveDrop(g, center.x, center.y, { holes: [5], filled: [], value: 9 });
    expect(wrong).toEqual({ kind: "bounce", pos: 5, reason: "wrong" });
    expect(dropCostsMove(wrong)).toBe(true);
    for (const reason of ["far", "taken", "wrong"] as const) {
      expect(bounceLine(reason)).not.toMatch(/错了|不对啊|笨/);
    }
  });
});

describe("档B R1 · 拼图乐园 · 战役第 1 / 100 / 188 关", () => {
  for (const level of [1, 100, 188]) {
    it(`第 ${level} 关有解且步数上限给得下`, () => {
      const cfg = LEVELS[level - 1];
      const kind = boardKind(cfg);
      if (kind === "slide") {
        const run = solveSlide(cfg, level * 977 + 5);
        expect(run.solved).toBe(true);
        expect(run.moves).toBeLessThan(cfg.moveLimit);
      } else if (kind === "rotate") {
        const rot = buildRotations(cfg.rows, cfg.cols, cfg.rotateWrong!, cfg.seed!);
        expect(minRotateClicks(rot)).toBeLessThan(cfg.moveLimit);
      } else {
        const pool = THEME_TILES[cfg.theme];
        const puzzle = buildFillPuzzle(cfg.rows, cfg.cols, cfg.missing!, cfg.extraPieces!, cfg.seed!, pool.length);
        expect(puzzle.holes).toHaveLength(cfg.missing!);
        // 托盘里每一块缺口都找得到,一步一块拼完还有余量
        for (const h of puzzle.holes) expect(puzzle.tray).toContain(h);
        expect(puzzle.tray.length).toBeLessThan(cfg.moveLimit);
      }
    });
  }

  it("第 1 / 100 / 188 关一关比一关大,3 星线一关比一关紧", () => {
    const sizes = [0, 99, 187].map((i) => LEVELS[i].rows * LEVELS[i].cols);
    expect(sizes[1]).toBeGreaterThanOrEqual(sizes[0]);
    expect(sizes[2]).toBeGreaterThanOrEqual(sizes[1]);
    expect(LEVELS[187].rows * LEVELS[187].cols).toBeGreaterThan(LEVELS[0].rows * LEVELS[0].cols);
  });

  it("贪心提示按钮真的能把推格子拼图往前推(不会推空)", () => {
    const cfg = LEVELS[0];
    const plan = shuffleOf(cfg, 4242);
    const board = plan.board.slice();
    let guard = 0;
    while (!isSolvedSlide(board) && guard++ < 4000) {
      const pos = bestSlideMove(board, cfg.rows, cfg.cols);
      expect(pos, "提示按钮给不出下一步了").not.toBeUndefined();
      expect(slideClick(board, pos as number, cfg.rows, cfg.cols)).toBe(true);
    }
    expect(isSolvedSlide(board)).toBe(true);
  });
});

describe("档B R1 · 拼图乐园 · 无尽画廊玩到结算", () => {
  it("连拼 30 幅都排得出来,同一种玩法的块数只增不减", () => {
    // 画廊三种玩法轮着来(推格子 / 旋转 / 补缺),所以要按玩法各看各的曲线
    const prev = new Map<string, number>();
    for (let round = 1; round <= 30; round++) {
      const board = endlessBoard(round);
      const kind = boardKind(board);
      const size = board.rows * board.cols;
      expect(size, `第 ${round} 幅的${kind}块数倒退了`).toBeGreaterThanOrEqual(prev.get(kind) ?? 0);
      prev.set(kind, size);
      expect(endlessHallName(round).length).toBeGreaterThan(0);
      expect(board.moveLimit).toBeGreaterThan(board.three);
    }
    expect(prev.size).toBe(3);
  });

  it("画廊的块数上限只增不减,而且封顶在 6×6", () => {
    for (let round = 2; round <= 200; round++) {
      expect(galleryPeak(round)).toBeGreaterThanOrEqual(galleryPeak(round - 1));
      expect(galleryPieces(round)).toBeLessThanOrEqual(galleryPeak(round));
    }
    expect(galleryPeak(500)).toBe(36);
  });

  it("无尽画廊的每一幅都真的拼得完(照还原路线走)", () => {
    for (const round of [1, 5, 12, 25]) {
      const cfg = endlessBoard(round);
      if (boardKind(cfg) !== "slide") continue;
      const run = solveSlide(cfg, round * 31 + 9);
      expect(run.solved, `第 ${round} 幅拼不完`).toBe(true);
    }
  });

  it("收摊结算只鼓励,破纪录会点名", () => {
    expect(endlessLine(0, 0)).not.toMatch(/失败|太差|笨/);
    expect(endlessLine(9, 3)).toContain("新纪录");
    expect(endlessLine(3, 9)).toContain("3");
  });
});

describe("档B R1 · 拼图乐园 · 360px 窄屏", () => {
  it("内联样式里没有会在 360px 撑破容器的固定宽度", () => {
    expect(overflowingRules(CSS)).toEqual([]);
  });

  it("有窄屏断点,也照顾了 prefers-reduced-motion", () => {
    expect(narrowBreakpoints(CSS).length).toBeGreaterThan(0);
    expect(respectsReducedMotion(CSS)).toBe(true);
  });

  it("C-5 同族:500 预算 220 原文保留,840 平板与窄竖屏另钳", () => {
    expect(CSS).toContain("max-width: min(100%, calc(100dvh - 220px))");
    expect(CSS).toContain("@media (min-width: 700px) and (max-height: 840px)");
    expect(CSS).toContain("max-width: min(100%, calc(100dvh - 380px))");
    expect(CSS).toContain("@media (max-width: 699px) and (max-height: 840px) and (min-height: 501px)");
  });

  it("360px 上最大的一关也吸得住:吸附半径不小于 12px", () => {
    const widest = LEVELS.reduce((a, b) => (b.cols > a.cols ? b : a));
    const cell = Math.floor((360 - 16) / widest.cols);
    expect(cell, `${widest.cols} 列在 360px 上每格只剩 ${cell}px`).toBeGreaterThanOrEqual(36);
    expect(snapThreshold(cell)).toBeGreaterThanOrEqual(12);
    expect(SNAP_RATIO).toBeGreaterThan(0);
  });

  it("360px 上按格心换算回格号不会串格", () => {
    const cols = LEVELS.reduce((a, b) => (b.cols > a.cols ? b : a)).cols;
    const gap = 4;
    const cell = Math.floor((360 - 16 - gap * (cols - 1)) / cols);
    const g: GridGeom = { left: 8, top: 8, cell, gap, cols, rows: cols };
    for (let pos = 0; pos < cols * cols; pos++) {
      const c = cellCenter(g, pos);
      expect(nearestCell(g, c.x, c.y)).toBe(pos);
    }
  });
});

describe("档B R1 · 拼图乐园 · 硬约束自查", () => {
  it("商标黑名单 0 命中", () => {
    expect(scanTrademarks(SOURCES)).toEqual([]);
  });

  it("分级红线:没有伤亡描写", () => {
    expect(scanRatingWords(SOURCES)).toEqual([]);
  });

  it("不引入 three.js / CDN / Socket / 联网", () => {
    expect(scanExternalDeps(SOURCES)).toEqual([]);
  });

  it("音效只走 api.play(...) / ctx.sfx(...)", () => {
    expect(scanAudioMisuse(SOURCES)).toEqual([]);
    expect(INDEX.text).toMatch(/api\.play\(|ctx\.sfx\(/);
  });

  it("存档 key 冻结:只有预览档位与中途续拼两把", () => {
    expect(saveKeysIn(SOURCES)).toEqual([
      "yiduo-yixing.puzzle-tiles.preview.v1",
      "yiduo-yixing.puzzle-tiles.resume.v1",
    ]);
    expect(PREVIEW_KEY).toBe("yiduo-yixing.puzzle-tiles.preview.v1");
    expect(RESUME_KEY).toBe("yiduo-yixing.puzzle-tiles.resume.v1");
  });

  it("destroy 巡检:全局监听加了都摘、rAF 有取消、每个 mountXxx 都还 destroy", () => {
    const balance = globalListenerBalance(INDEX);
    expect(balance.leaked, `这些全局监听没摘:${balance.leaked.join("/")}`).toEqual([]);
    expect(rafBalanced(INDEX)).toBe(true);
    expect(mountFunctionsReturnDestroy(INDEX)).toEqual([]);
  });

  it("TileBag:进→玩→退跑 5 遍,袋子每次都归零", () => {
    const bag = new TileBag();
    for (let round = 0; round < 5; round++) {
      let live = 0;
      for (let i = 0; i < 9; i++) {
        live++;
        bag.add(() => live--);
      }
      expect(bag.size).toBe(9);
      bag.clear();
      expect(bag.size).toBe(0);
      expect(live).toBe(0);
    }
  });
});
