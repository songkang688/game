/**
 * 窗口4 · 档B · 第 3 轮验收 —— 拼图乐园(puzzle-tiles)。
 *
 * 「五款不漏」这一轮不再抽样:188 关一关不落地按各自玩法真拼一遍,
 * 无尽画廊连拼 300 幅,360px 的吸附地板与存档往返也全量扫一遍。
 */
import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  LEVELS,
  buildFillPuzzle,
  buildRotations,
  endlessBoard,
  minRotateClicks,
  type PuzzleLevel,
} from "./levels";
import { mulberry32 } from "../level99";
import { boardKind, isSolvedSlide, shuffleBoard, slideClick, starsFor, type ShuffledBoard } from "./logic";
import {
  SNAP_MIN,
  applyRotate,
  cellCenter,
  nearestCell,
  parseResume,
  parseRotations,
  rotateOnce,
  serializeResume,
  serializeRotations,
  snapThreshold,
  type GridGeom,
} from "./snap";

function shuffleOf(cfg: PuzzleLevel, seed: number): ShuffledBoard {
  return shuffleBoard(cfg.rows, cfg.cols, cfg.shuffleSteps, mulberry32(seed));
}

/** 照着洗牌记下的逆序路线还原一盘推格子 */
function solveSlide(cfg: PuzzleLevel, seed: number): { moves: number; solved: boolean } {
  const plan = shuffleOf(cfg, seed);
  const board = plan.board.slice();
  let moves = 0;
  for (const pos of plan.undo) {
    if (!slideClick(board, pos, cfg.rows, cfg.cols)) return { moves, solved: false };
    moves++;
  }
  return { moves, solved: isSolvedSlide(board) };
}

/** 一盘旋转拼图按最少点击转回正 */
function solveRotate(cfg: PuzzleLevel): { clicks: number; solved: boolean } {
  const rot = buildRotations(cfg.rows, cfg.cols, cfg.rotateWrong ?? 0, cfg.seed ?? 1);
  const need = minRotateClicks(rot);
  const board = rot.slice();
  let clicks = 0;
  for (let i = 0; i < board.length; i++) {
    while (board[i] !== 0) {
      board[i] = rotateOnce(board[i]);
      clicks++;
    }
  }
  return { clicks, solved: board.every((v) => v === 0) && clicks === need };
}

describe("档B R3 · 拼图乐园 · 188 关一关不落", () => {
  it("188 关按各自的玩法都拼得完,而且都在步数上限之内", () => {
    const bad: string[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const cfg = LEVELS[i];
      const kind = boardKind(cfg);
      if (kind === "slide") {
        const r = solveSlide(cfg, i * 977 + 13);
        if (!r.solved) bad.push(`第 ${i + 1} 关推不回去`);
        else if (r.moves > cfg.moveLimit) bad.push(`第 ${i + 1} 关还原要 ${r.moves} 步,超了 ${cfg.moveLimit}`);
      } else if (kind === "rotate") {
        const r = solveRotate(cfg);
        if (!r.solved) bad.push(`第 ${i + 1} 关转不回正`);
        else if (r.clicks > cfg.moveLimit) bad.push(`第 ${i + 1} 关要转 ${r.clicks} 下,超了 ${cfg.moveLimit}`);
      } else {
        const puzzle = buildFillPuzzle(cfg.rows, cfg.cols, cfg.missing ?? 0, cfg.extraPieces ?? 0, cfg.seed ?? 1);
        if (puzzle.holes.length !== (cfg.missing ?? 0)) bad.push(`第 ${i + 1} 关的缺口数对不上`);
        if (puzzle.tray.length < puzzle.holes.length) bad.push(`第 ${i + 1} 关的托盘凑不齐缺口`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("188 关的评星线都留在步数上限之内", () => {
    const bad: string[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const cfg = LEVELS[i];
      if (!(cfg.two > cfg.three)) bad.push(`第 ${i + 1} 关的二星线不比三星线松`);
      if (!(cfg.moveLimit > cfg.two)) bad.push(`第 ${i + 1} 关的步数上限没留出二星的余地`);
      if (starsFor(cfg.three, cfg) !== 3) bad.push(`第 ${i + 1} 关压着三星线过却不给 3 星`);
      if (starsFor(cfg.moveLimit, cfg) < 1) bad.push(`第 ${i + 1} 关压着上限过却不给星`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("188 关的板子都不超 6×6,360px 上的吸附地板都不大过半格", () => {
    const bad: string[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const cfg = LEVELS[i];
      if (cfg.rows > 6 || cfg.cols > 6) bad.push(`第 ${i + 1} 关超过 6×6`);
      // 360px 上留给棋盘的净宽（与 R1 学习优化员那条用例同一口径）
      const cell = Math.floor((360 - 8 - 20) / cfg.cols);
      const snap = snapThreshold(cell);
      if (snap > cell / 2) bad.push(`第 ${i + 1} 关的吸附半径 ${snap} 大过半格 ${cell / 2}`);
      if (snap < SNAP_MIN) bad.push(`第 ${i + 1} 关的吸附半径小于下限`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("12 章一章不落:各章关数加起来正好 188", () => {
    expect(CHAPTERS.reduce((n, c) => n + c.size, 0)).toBe(LEVELS.length);
    expect(LEVELS.length).toBe(188);
  });
});

describe("档B R3 · 拼图乐园 · 无尽画廊全量复扫", () => {
  it("无尽画廊连拼 300 幅:幅幅排得出、幅幅在 6×6 以内、幅幅拼得完", () => {
    const bad: string[] = [];
    for (let round = 1; round <= 300; round++) {
      const cfg = endlessBoard(round);
      if (cfg.rows > 6 || cfg.cols > 6) bad.push(`第 ${round} 幅超过 6×6`);
      if (!(cfg.moveLimit > cfg.two)) bad.push(`第 ${round} 幅的步数上限没留出二星的余地`);
      if (boardKind(cfg) === "slide") {
        const r = solveSlide(cfg, round * 31 + 5);
        if (!r.solved) bad.push(`第 ${round} 幅推不回去`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("无尽画廊 300 幅都是 seeded 可复现的", () => {
    for (const round of [1, 26, 77, 150, 300]) {
      expect(endlessBoard(round), `第 ${round} 幅两次生成不一样`).toEqual(endlessBoard(round));
    }
  });
});

describe("档B R3 · 拼图乐园 · 存档往返与脏档", () => {
  it("续拼存档:188 关各写一次再读回来,一关都不会走样", () => {
    for (let i = 0; i < LEVELS.length; i += 1) {
      const cfg = LEVELS[i];
      if (boardKind(cfg) !== "slide") continue;
      const plan = shuffleOf(cfg, i * 13 + 7);
      const text = serializeResume({
        level: i,
        kind: "slide",
        total: cfg.rows * cfg.cols,
        moves: 3,
        board: plan.board,
      });
      const back = parseResume(text);
      expect(back, `第 ${i + 1} 关的续拼存档读不回来`).not.toBeNull();
      expect(back!.board, `第 ${i + 1} 关的续拼存档走样了`).toEqual(plan.board);
      expect(back!.level, `第 ${i + 1} 关的关号走样了`).toBe(i);
    }
  });

  it("脏档一律当没存过,绝不崩", () => {
    for (const junk of ["", "  ", "{", "[]", "not-json", '{"level":1}', "0,1,2", '{"board":"abc"}']) {
      expect(() => parseResume(junk)).not.toThrow();
      expect(parseResume(junk), `「${junk}」居然被当成了有效存档`).toBeNull();
    }
    expect(parseResume(null)).toBeNull();
    for (const junk of ["", "xyz", "1,2,3,9", "----"]) {
      expect(() => parseRotations(junk, 9)).not.toThrow();
    }
  });

  it("朝向表往返:转过的朝向存下去再读回来一模一样", () => {
    const rot = buildRotations(4, 4, 8, 4242);
    const turned = applyRotate(rot, 5).rot;
    const back = parseRotations(serializeRotations(turned), turned.length);
    expect(back).toEqual(turned);
    // 长度对不上或有脏字符就当没存过
    expect(parseRotations(serializeRotations(turned), turned.length + 1)).toBeNull();
    expect(parseRotations("9".repeat(turned.length), turned.length)).toBeNull();
  });

  it("吸附落点:360px 上每一格的中心都吸得回它自己", () => {
    const geom: GridGeom = { rows: 6, cols: 6, cell: 52, gap: 2, left: 4, top: 4 };
    for (let pos = 0; pos < geom.rows * geom.cols; pos++) {
      const center = cellCenter(geom, pos);
      expect(nearestCell(geom, center.x, center.y), `第 ${pos} 格吸偏了`).toBe(pos);
    }
  });
});
