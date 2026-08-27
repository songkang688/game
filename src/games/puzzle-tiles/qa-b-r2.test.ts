/**
 * 窗口4 · 档B · 第 2 轮验收 —— 拼图乐园(puzzle-tiles)。
 *
 * 换样本(第 44 / 96 / 152 / 177 关)+ 难度曲线 + 竞态(拖放 / 撤销 / 续拼存档)+ 无尽持续。
 * 只增用例,不改既有用例。
 */
import { describe, expect, it } from "vitest";
import { CHAPTERS, LEVELS, buildFillPuzzle, buildRotations, endlessBoard, minRotateClicks, type PuzzleLevel } from "./levels";
import { chapterStart, mulberry32 } from "../level99";
import { boardKind, isSolvedSlide, shuffleBoard, slideClick, starsFor, type ShuffledBoard } from "./logic";
import {
  RESUME_MIN_PIECES,
  SNAP_MIN,
  TileBag,
  applyRotate,
  cellCenter,
  dropCostsMove,
  galleryPieces,
  nearestCell,
  needsResume,
  parseResume,
  parseRotations,
  resolveDrop,
  rotateOnce,
  serializeResume,
  serializeRotations,
  resumeMatches,
  snapThreshold,
  undoRotate,
  type GridGeom,
  type ResumeState,
} from "./snap";

const R2_SPOTS = [44, 96, 152, 177];

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

describe("档B R2 · 拼图乐园 · 换样本", () => {
  for (const level of R2_SPOTS) {
    it(`第 ${level} 关:三种玩法各按自己的路子都拼得完`, () => {
      const cfg = LEVELS[level - 1];
      const kind = boardKind(cfg);
      if (kind === "slide") {
        const run = solveSlide(cfg, level * 977 + 13);
        expect(run.solved, `第 ${level} 关还原不了`).toBe(true);
        expect(run.moves, `第 ${level} 关还原用了 ${run.moves} 步,上限 ${cfg.moveLimit}`).toBeLessThanOrEqual(
          cfg.moveLimit
        );
      } else if (kind === "rotate") {
        const rot = buildRotations(cfg.rows, cfg.cols, cfg.wrong ?? 4, level * 31 + 5);
        const clicks = minRotateClicks(rot);
        expect(clicks, `第 ${level} 关一块歪的都没有`).toBeGreaterThan(0);
        expect(clicks, `第 ${level} 关转正要 ${clicks} 步,上限 ${cfg.moveLimit}`).toBeLessThanOrEqual(cfg.moveLimit);
      } else {
        const puzzle = buildFillPuzzle(cfg.rows, cfg.cols, cfg.missing ?? 4, cfg.extra ?? 2, level * 17 + 3);
        expect(puzzle.holes.length, `第 ${level} 关一个缺口都没有`).toBeGreaterThan(0);
        expect(puzzle.tray.length, `第 ${level} 关托盘里的块不够补缺口`).toBeGreaterThanOrEqual(puzzle.holes.length);
        for (const hole of puzzle.holes) {
          expect(puzzle.tray, `第 ${level} 关第 ${hole} 号缺口在托盘里找不到对应的块`).toContain(hole);
        }
      }
    });
  }

  it("四个新样本换 5 个种子照样成立", () => {
    for (const level of R2_SPOTS) {
      const cfg = LEVELS[level - 1];
      if (boardKind(cfg) !== "slide") continue;
      for (const seed of [2, 22, 222, 2222, 22222]) {
        expect(solveSlide(cfg, seed).solved, `第 ${level} 关 seed=${seed} 还原不了`).toBe(true);
      }
    }
  });

  it("四个新样本的评星线说得通:压着上限过是 1 星,三星线内是 3 星", () => {
    for (const level of R2_SPOTS) {
      const cfg = LEVELS[level - 1];
      expect(starsFor(cfg.three, cfg)).toBe(3);
      expect(starsFor(cfg.moveLimit, cfg)).toBeLessThanOrEqual(2);
      expect(cfg.three).toBeLessThanOrEqual(cfg.moveLimit);
    }
  });
});

describe("档B R2 · 拼图乐园 · 难度曲线", () => {
  it("章内曲线:后半章的画不比前半章小(允许「大小画交替」的章节编排)", () => {
    // 「彩虹大画展」是 3×4 / 4×4 交替上阵的编排,逐关比会把交替误判成回落;
    // 所以按前后半章的最大片数比,既盯得住走势,又不冤枉编排。
    const pieces = (lv: PuzzleLevel): number => lv.rows * lv.cols;
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const from = chapterStart(CHAPTERS, ci);
      const to = ci + 1 < CHAPTERS.length ? chapterStart(CHAPTERS, ci + 1) : LEVELS.length;
      const seg = LEVELS.slice(from, to);
      const mid = Math.floor(seg.length / 2);
      const head = Math.max(...seg.slice(0, mid).map(pieces));
      const tail = Math.max(...seg.slice(mid).map(pieces));
      expect(tail, `${CHAPTERS[ci].name} 的后半章比前半章还小`).toBeGreaterThanOrEqual(head);
    }
  });

  it("换新玩法的那几章可以从小画重开,但整体走势一路向上", () => {
    const pieces = (lv: PuzzleLevel): number => lv.rows * lv.cols;
    const avgOf = (fromCi: number, toCi: number): number => {
      const from = chapterStart(CHAPTERS, fromCi);
      const to = toCi < CHAPTERS.length ? chapterStart(CHAPTERS, toCi) : LEVELS.length;
      const seg = LEVELS.slice(from, to);
      return seg.reduce((n, lv) => n + pieces(lv), 0) / seg.length;
    };
    expect(avgOf(CHAPTERS.length - 3, CHAPTERS.length)).toBeGreaterThan(avgOf(0, 3) * 1.5);
    // 压轴那一章里有全场最大的画
    const globalPeak = Math.max(...LEVELS.map(pieces));
    const lastFrom = chapterStart(CHAPTERS, CHAPTERS.length - 1);
    expect(Math.max(...LEVELS.slice(lastFrom).map(pieces))).toBe(globalPeak);
  });

  it("画板有封顶:最大不超过 6×6,360px 上还点得准", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(LEVELS[i].cols, `第 ${i + 1} 关的列数超过 6`).toBeLessThanOrEqual(6);
      expect(LEVELS[i].rows, `第 ${i + 1} 关的行数超过 6`).toBeLessThanOrEqual(6);
    }
  });

  it("三星线一律留在步数上限之内,而且提示次数不会越给越多", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(LEVELS[i].three, `第 ${i + 1} 关的三星线比步数上限还宽`).toBeLessThanOrEqual(LEVELS[i].moveLimit);
      expect(LEVELS[i].hints).toBeLessThanOrEqual(6);
    }
  });

  it("前 50 关与后 50 关比:后半程的画明显更大", () => {
    const pieces = (lv: PuzzleLevel): number => lv.rows * lv.cols;
    const avg = (arr: PuzzleLevel[]): number => arr.reduce((n, lv) => n + pieces(lv), 0) / arr.length;
    expect(avg(LEVELS.slice(LEVELS.length - 50))).toBeGreaterThan(avg(LEVELS.slice(0, 50)) * 2);
  });

  it("推格子这一路上:画越大,给的步数也越多(不同玩法之间不横向比)", () => {
    const slides = LEVELS.filter((lv) => boardKind(lv) === "slide");
    const small = slides.filter((lv) => lv.rows * lv.cols <= 12);
    const big = slides.filter((lv) => lv.rows * lv.cols >= 25);
    const avg = (arr: PuzzleLevel[]): number => arr.reduce((n, lv) => n + lv.moveLimit, 0) / arr.length;
    expect(small.length).toBeGreaterThan(0);
    expect(big.length).toBeGreaterThan(0);
    expect(avg(big), "大画给的步数反而更少").toBeGreaterThan(avg(small));
  });
});

describe("档B R2 · 拼图乐园 · 竞态", () => {
  it("同一个缺口连放两次:第二次只会弹回来,不会把缺口填两遍", () => {
    const g: GridGeom = { left: 0, top: 0, cell: 60, gap: 4, cols: 4, rows: 4 };
    const center = cellCenter(g, 6);
    const first = resolveDrop(g, center.x, center.y, { holes: [6], filled: [], value: 6 });
    expect(first).toEqual({ kind: "snap", pos: 6 });
    const second = resolveDrop(g, center.x, center.y, { holes: [6], filled: [6], value: 6 });
    expect(second).toEqual({ kind: "bounce", pos: 6, reason: "taken" });
    expect(dropCostsMove(second), "放到已经填好的格子不该扣步").toBe(false);
  });

  it("拖到两格正中间松手:只会吸进其中一格,不会两格都亮", () => {
    const g: GridGeom = { left: 0, top: 0, cell: 60, gap: 4, cols: 4, rows: 4 };
    const a = cellCenter(g, 5);
    const b = cellCenter(g, 6);
    const mid = { x: (a.x + b.x) / 2, y: a.y };
    const pos = nearestCell(g, mid.x, mid.y);
    expect(pos === 5 || pos === 6).toBe(true);
    // 正中间离两边格心都是 32px,超过阈值(60×0.35=21),所以两边都吸不住
    expect(snapThreshold(g.cell)).toBeLessThan(Math.abs(mid.x - a.x));
    expect(resolveDrop(g, mid.x, mid.y, { holes: [5, 6], filled: [], value: pos }).kind).toBe("bounce");
  });

  it("撤销栈:连转三下再撤三下,朝向回到出发点", () => {
    let rot = [0, 0, 0, 0];
    const steps = [];
    for (const pos of [1, 1, 2]) {
      const res = applyRotate(rot, pos);
      rot = res.rot;
      steps.push(res.step);
    }
    expect(rot).not.toEqual([0, 0, 0, 0]);
    for (const step of [...steps].reverse()) rot = undoRotate(rot, step);
    expect(rot).toEqual([0, 0, 0, 0]);
  });

  it("转到第四下自己回正:rotateOnce 是四进制,不会越转越大", () => {
    let v = 0;
    for (let i = 0; i < 4; i++) v = rotateOnce(v);
    expect(v).toBe(0);
    expect(rotateOnce(-1)).toBe(0);
    expect(rotateOnce(Number.NaN)).toBe(1);
  });

  it("续拼存档:半路退出再进来,接得上;存档对不上就当新档,绝不崩", () => {
    const cfg = LEVELS.find((lv) => lv.rows * lv.cols >= RESUME_MIN_PIECES)!;
    expect(needsResume(cfg.rows, cfg.cols)).toBe(true);
    const total = cfg.rows * cfg.cols;
    const state: ResumeState = {
      level: 7,
      kind: "rotate",
      total,
      moves: 12,
      rot: new Array<number>(total).fill(1),
    };
    const back = parseResume(serializeResume(state));
    expect(back).toEqual(state);
    expect(resumeMatches(back, 7, "rotate", total)).toBe(true);
    // 关号 / 板式 / 片数任意一处对不上都当新档
    expect(resumeMatches(back, 8, "rotate", total)).toBe(false);
    expect(resumeMatches(back, 7, "slide", total)).toBe(false);
    expect(resumeMatches(back, 7, "rotate", total + 1)).toBe(false);
    // 脏数据一律降级
    expect(parseResume("{坏掉的 JSON")).toBeNull();
    expect(parseResume(null)).toBeNull();
    expect(parseResume('{"level":-1,"kind":"rotate","total":9,"moves":0}')).toBeNull();
  });

  it("朝向表存档:长度不对或有脏字符就当没存过", () => {
    expect(parseRotations(serializeRotations([0, 1, 2, 3]), 4)).toEqual([0, 1, 2, 3]);
    expect(parseRotations("0123", 5)).toBeNull();
    expect(parseRotations("01a3", 4)).toBeNull();
    expect(parseRotations(null, 4)).toBeNull();
  });

  it("TileBag 连开连关 20 轮:一件活儿都不剩", () => {
    for (let round = 0; round < 20; round++) {
      const bag = new TileBag();
      let live = 0;
      for (let i = 0; i < 7; i++) {
        live++;
        bag.add(() => live--);
      }
      expect(bag.size).toBe(7);
      bag.clear();
      expect(bag.size).toBe(0);
      expect(live, `第 ${round + 1} 轮有活儿没收`).toBe(0);
    }
  });

  it("窄屏吸附地板在真实关卡上都不会大过半格", () => {
    for (const cols of [3, 4, 5, 6]) {
      const gap = cols >= 5 ? 5 : 8;
      const cell = Math.floor((360 - 2 * 14.4 - 2 * 12 - gap * (cols - 1)) / cols);
      expect(snapThreshold(cell)).toBeLessThanOrEqual(cell / 2);
      expect(snapThreshold(cell)).toBeGreaterThanOrEqual(Math.min(cell / 2, SNAP_MIN));
    }
  });
});

describe("档B R2 · 拼图乐园 · 无尽持续", () => {
  it("无尽画廊连拼 120 幅:每一幅都排得出、都在 6×6 以内", () => {
    for (let round = 1; round <= 120; round++) {
      const cfg = endlessBoard(round);
      expect(cfg.rows * cfg.cols, `第 ${round} 幅没有画`).toBeGreaterThan(0);
      expect(cfg.cols, `第 ${round} 幅超出 6 列`).toBeLessThanOrEqual(6);
      expect(cfg.rows).toBeLessThanOrEqual(6);
      expect(cfg.moveLimit, `第 ${round} 幅的步数上限不够拼完`).toBeGreaterThan(0);
    }
  });

  it("无尽画廊的片数一路走高,到顶之后稳住不回落", () => {
    let peak = 0;
    for (let round = 1; round <= 120; round++) {
      peak = Math.max(peak, galleryPieces(round));
    }
    expect(peak).toBeLessThanOrEqual(36);
    // 后 20 幅的平均片数不低于前 20 幅
    const avg = (from: number): number => {
      let n = 0;
      for (let r = from; r < from + 20; r++) n += galleryPieces(r);
      return n / 20;
    };
    expect(avg(101)).toBeGreaterThanOrEqual(avg(1));
  });

  it("无尽画廊里的推格子幅也真的还原得了", () => {
    let checked = 0;
    for (let round = 1; round <= 40 && checked < 8; round++) {
      const cfg = endlessBoard(round);
      if (boardKind(cfg) !== "slide") continue;
      checked++;
      expect(solveSlide(cfg, round * 101 + 7).solved, `第 ${round} 幅还原不了`).toBe(true);
    }
    expect(checked, "40 幅里一幅推格子都没抽到").toBeGreaterThan(0);
  });

  it("无尽画廊 seeded 可复现:同一幅两次生成完全一样", () => {
    for (const round of [3, 30, 90]) {
      expect(endlessBoard(round)).toEqual(endlessBoard(round));
    }
  });
});
