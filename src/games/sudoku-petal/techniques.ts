/**
 * 数独花田 · 技巧分级与方法级提示。
 *
 * 本作的难度不是「空了几格」,而是「解这一题最少要用到哪一档技巧」。四档从易到难:
 *
 * | 档 | 名字 | 一句话 |
 * | --- | --- | --- |
 * | 1 | 唯余 | 这一格只剩一种数字能放 |
 * | 2 | 隐性唯一 | 这一组里某个数字只剩一个格子放得下 |
 * | 3 | 显性数对 | 两格候选一模一样且只剩两种,这一组别的格子可以把这两个划掉 |
 * | 4 | 区块摒除 | 一朵花里某个数字只能落在一条线上,线上花外的格子可以把它划掉 |
 *
 * `solveByTechniques` 是**纯逻辑**推理机:只会用被允许的那几档,一步都不猜。
 * 生成器靠它保证「每一题都推得完」,提示按钮靠它给方法。
 *
 * 铁律:`nextTechnique` 返回的结构里**没有任何答案数字** —— 正文用中文数字写序号,
 * 一个阿拉伯数字都不出现;字段只有「看哪一组、盯哪几格、用哪一招」,绝不说填什么。
 */
import {
  EMPTY,
  candidateMask,
  colOf,
  fullMask,
  groupMasks,
  maskToDigits,
  popCount,
  rowOf,
  type SudokuBoard
} from "./solver";

export type TechniqueKind = "nakedSingle" | "hiddenSingle" | "nakedPair" | "pointingPair";

/** 由易到难。索引就是难度档位 */
export const TECHNIQUE_ORDER: readonly TechniqueKind[] = [
  "nakedSingle",
  "hiddenSingle",
  "nakedPair",
  "pointingPair"
];

export const TECHNIQUE_LABELS: Record<TechniqueKind, string> = {
  nakedSingle: "唯余",
  hiddenSingle: "隐性唯一",
  nakedPair: "显性数对",
  pointingPair: "区块摒除"
};

/** 每一档技巧的一句话说明(攻略与提示面板用,不含任何题目答案) */
export const TECHNIQUE_BLURBS: Record<TechniqueKind, string> = {
  nakedSingle: "把一格的同行、同列、同花都看一遍,剩下唯一还能放的那个数字就是它。",
  hiddenSingle: "换个角度:盯住一整组,看看某个数字是不是只剩一个格子容得下它。",
  nakedPair: "两格候选一模一样又只剩两种,这两个数字就被它们俩包圆了,同组别的格子可以划掉。",
  pointingPair: "一朵花里某个数字只可能落在同一条线上,那条线出了这朵花的部分就都可以划掉。"
};

/** 允许用到 tier 为止的全部技巧 */
export function allowedUpTo(tier: TechniqueKind): TechniqueKind[] {
  const at = TECHNIQUE_ORDER.indexOf(tier);
  return TECHNIQUE_ORDER.slice(0, at + 1);
}

/** 两档技巧谁更难 */
export function tierRank(kind: TechniqueKind): number {
  return TECHNIQUE_ORDER.indexOf(kind);
}

// ---------------------------------------------------------------------------
// 候选表(铅笔视角)
// ---------------------------------------------------------------------------

/** 每格还能放哪些数字的位掩码;已填格是 0 */
export type CandidateGrid = number[];

/** 按当前落子算一遍候选表 */
export function candidateGrid(board: SudokuBoard): CandidateGrid {
  const masks = groupMasks(board);
  const out = new Array<number>(board.cells.length).fill(0);
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] > 0) continue;
    out[i] = candidateMask(board, i, masks);
  }
  return out;
}

/** 一组里某个数字还能落在哪些格子上 */
function slotsFor(cells: readonly number[], grid: CandidateGrid, digit: number): number[] {
  const bit = 1 << digit;
  const out: number[] = [];
  for (const cell of cells) {
    if (grid[cell] & bit) out.push(cell);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 提示:只讲方法,一个答案数字都不给
// ---------------------------------------------------------------------------

export type HintScope = "cell" | "row" | "col" | "region" | "diagonal";

export interface TechniqueHint {
  kind: TechniqueKind;
  scope: HintScope;
  /** 行号 / 列号 / 宫号(0 基);scope 为 cell 时是 -1 */
  scopeIndex: number;
  /** 先盯住这几个格子的下标 —— 只说看哪儿,不说填什么 */
  focus: number[];
  /** 方法级说明。正文里一个阿拉伯数字都没有,自然也就带不出答案 */
  text: string;
}

/** 提示结构允许出现的字段,多一个都不行(单测按这份清单卡) */
export const HINT_FIELDS: readonly string[] = ["focus", "kind", "scope", "scopeIndex", "text"];

const CN_NUM = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 0 基序号 → 中文序数,例如 0 → 「一」。提示正文里绝不出现阿拉伯数字 */
export function cnOrdinal(zeroBased: number): string {
  const n = zeroBased + 1;
  if (n >= 1 && n <= 9) return CN_NUM[n];
  if (n >= 10 && n <= 19) return n === 10 ? "十" : `十${CN_NUM[n - 10]}`;
  return "某";
}

/** 一组的中文名字,例如「第三行」「第七朵花」 */
export function scopeName(scope: HintScope, index: number): string {
  switch (scope) {
    case "row":
      return `第${cnOrdinal(index)}行`;
    case "col":
      return `第${cnOrdinal(index)}列`;
    case "region":
      return `第${cnOrdinal(index)}朵花`;
    case "diagonal":
      return index === 0 ? "左上到右下那条斜线" : "右上到左下那条斜线";
    default:
      return "高亮的那一格";
  }
}

/** 组号 → 它是行 / 列 / 宫 / 斜线里的第几个 */
export function scopeOfGroup(board: SudokuBoard, groupIndex: number): { scope: HintScope; index: number } {
  const n = board.variant.n;
  if (groupIndex < n) return { scope: "row", index: groupIndex };
  if (groupIndex < n * 2) return { scope: "col", index: groupIndex - n };
  if (groupIndex < n * 3) return { scope: "region", index: groupIndex - n * 2 };
  return { scope: "diagonal", index: groupIndex - n * 3 };
}

// ---------------------------------------------------------------------------
// 四档技巧各自的检测(纯函数,给推理机和提示共用)
// ---------------------------------------------------------------------------

export interface PlaceStep {
  kind: "nakedSingle" | "hiddenSingle";
  idx: number;
  digit: number;
  /** 隐性唯一是在哪一组里发现的 */
  groupIndex: number;
}

export interface EliminateStep {
  kind: "nakedPair" | "pointingPair";
  /** 这一招要划掉的候选:格子 → 划掉哪些数字的位掩码 */
  strikes: Array<{ idx: number; mask: number }>;
  /** 支撑这一招的那两三格 */
  base: number[];
  groupIndex: number;
}

/** 唯余:找一个只剩一种候选的空格 */
export function findNakedSingle(board: SudokuBoard, grid: CandidateGrid): PlaceStep | null {
  for (let i = 0; i < grid.length; i++) {
    if (board.cells[i] > 0) continue;
    if (popCount(grid[i]) === 1) {
      return { kind: "nakedSingle", idx: i, digit: maskToDigits(grid[i])[0], groupIndex: -1 };
    }
  }
  return null;
}

/** 隐性唯一:某一组里某个数字只剩一个格子放得下 */
export function findHiddenSingle(board: SudokuBoard, grid: CandidateGrid): PlaceStep | null {
  const { variant } = board;
  for (let g = 0; g < variant.groups.length; g++) {
    const cells = variant.groups[g];
    for (let d = 1; d <= variant.n; d++) {
      if (cells.some((cell) => board.cells[cell] === d)) continue;
      const slots = slotsFor(cells, grid, d);
      if (slots.length === 1 && popCount(grid[slots[0]]) > 1) {
        return { kind: "hiddenSingle", idx: slots[0], digit: d, groupIndex: g };
      }
    }
  }
  return null;
}

/** 显性数对:同一组里两格候选一模一样且只剩两种 → 同组别的格子划掉这两个 */
export function findNakedPair(board: SudokuBoard, grid: CandidateGrid): EliminateStep | null {
  const { variant } = board;
  for (let g = 0; g < variant.groups.length; g++) {
    const cells = variant.groups[g].filter((cell) => board.cells[cell] === EMPTY);
    for (let a = 0; a < cells.length; a++) {
      const ma = grid[cells[a]];
      if (popCount(ma) !== 2) continue;
      for (let b = a + 1; b < cells.length; b++) {
        if (grid[cells[b]] !== ma) continue;
        const strikes: Array<{ idx: number; mask: number }> = [];
        for (const cell of cells) {
          if (cell === cells[a] || cell === cells[b]) continue;
          const hit = grid[cell] & ma;
          if (hit) strikes.push({ idx: cell, mask: hit });
        }
        if (strikes.length > 0) {
          return { kind: "nakedPair", strikes, base: [cells[a], cells[b]], groupIndex: g };
        }
      }
    }
  }
  return null;
}

/** 区块摒除 / 指向对:一朵花里某个数字只落在一行(或一列)上 → 这一行花外的格子划掉它 */
export function findPointingPair(board: SudokuBoard, grid: CandidateGrid): EliminateStep | null {
  const { variant } = board;
  const n = variant.n;
  for (let r = 0; r < n; r++) {
    const region = variant.groups[n * 2 + r];
    for (let d = 1; d <= n; d++) {
      if (region.some((cell) => board.cells[cell] === d)) continue;
      const slots = slotsFor(region, grid, d);
      if (slots.length < 2) continue;
      const bit = 1 << d;
      const inRegion = new Set(slots);
      const rows = new Set(slots.map((c) => rowOf(c, n)));
      const cols = new Set(slots.map((c) => colOf(c, n)));
      if (rows.size === 1) {
        const line = variant.groups[[...rows][0]];
        const strikes = line
          .filter((cell) => !inRegion.has(cell) && variant.regions[cell] !== r && grid[cell] & bit)
          .map((idx) => ({ idx, mask: bit }));
        if (strikes.length > 0) return { kind: "pointingPair", strikes, base: slots, groupIndex: n * 2 + r };
      }
      if (cols.size === 1) {
        const line = variant.groups[n + [...cols][0]];
        const strikes = line
          .filter((cell) => !inRegion.has(cell) && variant.regions[cell] !== r && grid[cell] & bit)
          .map((idx) => ({ idx, mask: bit }));
        if (strikes.length > 0) return { kind: "pointingPair", strikes, base: slots, groupIndex: n * 2 + r };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 纯逻辑推理机
// ---------------------------------------------------------------------------

export interface LogicResult {
  /** 一路推到底,全盘填满 */
  solved: boolean;
  /** 推理停下来时的盘面 */
  cells: number[];
  /** 实际用到过的技巧(按难度排序) */
  used: TechniqueKind[];
  /** 推出矛盾(某个空格一个候选都不剩) */
  contradiction: boolean;
}

/**
 * 只用允许的那几档技巧往下推,一步都不猜。
 * 推不动就停,把当时的盘面和用过的招数一起交出来。
 */
export function solveByTechniques(
  board: SudokuBoard,
  allowed: readonly TechniqueKind[] = TECHNIQUE_ORDER,
  maxSteps = 4000
): LogicResult {
  const work: SudokuBoard = { variant: board.variant, cells: board.cells.slice() };
  const grid = candidateGrid(work);
  const used = new Set<TechniqueKind>();
  const can = new Set(allowed);
  let contradiction = false;

  const place = (idx: number, digit: number): void => {
    work.cells[idx] = digit;
    grid[idx] = 0;
    const bit = 1 << digit;
    for (const g of work.variant.cellGroups[idx]) {
      for (const cell of work.variant.groups[g]) grid[cell] &= ~bit;
    }
  };

  for (let step = 0; step < maxSteps; step++) {
    // 先看有没有走进死胡同:空格一个候选都不剩就说明前面填错了
    for (let i = 0; i < work.cells.length; i++) {
      if (work.cells[i] === EMPTY && grid[i] === 0) {
        contradiction = true;
        break;
      }
    }
    if (contradiction) break;
    if (work.cells.every((v) => v > 0)) break;

    let moved = false;
    if (can.has("nakedSingle")) {
      const hit = findNakedSingle(work, grid);
      if (hit) {
        used.add("nakedSingle");
        place(hit.idx, hit.digit);
        moved = true;
      }
    }
    if (!moved && can.has("hiddenSingle")) {
      const hit = findHiddenSingle(work, grid);
      if (hit) {
        used.add("hiddenSingle");
        place(hit.idx, hit.digit);
        moved = true;
      }
    }
    if (!moved && can.has("nakedPair")) {
      const hit = findNakedPair(work, grid);
      if (hit) {
        used.add("nakedPair");
        for (const s of hit.strikes) grid[s.idx] &= ~s.mask;
        moved = true;
      }
    }
    if (!moved && can.has("pointingPair")) {
      const hit = findPointingPair(work, grid);
      if (hit) {
        used.add("pointingPair");
        for (const s of hit.strikes) grid[s.idx] &= ~s.mask;
        moved = true;
      }
    }
    if (!moved) break;
  }

  return {
    solved: !contradiction && work.cells.every((v) => v > 0),
    cells: work.cells,
    used: TECHNIQUE_ORDER.filter((k) => used.has(k)),
    contradiction
  };
}

/**
 * 推完这一题最低要用到哪一档技巧。
 * 从最容易的一档开始加,第一个能推完的档位就是它的难度。四档都推不完返回 null。
 */
export function minTechniqueTier(board: SudokuBoard): TechniqueKind | null {
  for (const tier of TECHNIQUE_ORDER) {
    if (solveByTechniques(board, allowedUpTo(tier)).solved) return tier;
  }
  return null;
}

/** 只用允许的几档能不能推完(生成器挖洞时的闸门) */
export function isSolvableWith(board: SudokuBoard, allowed: readonly TechniqueKind[]): boolean {
  return solveByTechniques(board, allowed).solved;
}

// ---------------------------------------------------------------------------
// 提示按钮:下一步该用哪一招
// ---------------------------------------------------------------------------

/**
 * 看看当前盘面下一步能用哪一招,返回**方法级**提示。
 *
 * 返回值里没有任何答案:正文用中文数字写序号(一个阿拉伯数字都没有),
 * 字段只有「用哪一招 / 看哪一组 / 盯哪几格」。盘面已经满了或者四招都使不上就返回 null。
 */
export function nextTechnique(board: SudokuBoard, allowed: readonly TechniqueKind[] = TECHNIQUE_ORDER): TechniqueHint | null {
  if (board.cells.every((v) => v > 0)) return null;
  const grid = candidateGrid(board);
  const can = new Set(allowed);

  if (can.has("nakedSingle")) {
    const hit = findNakedSingle(board, grid);
    if (hit) {
      return {
        kind: "nakedSingle",
        scope: "cell",
        scopeIndex: -1,
        focus: [hit.idx],
        text: "盯住高亮的那一格:它同一行、同一列、同一朵花里已经把别的数字都占掉了,只剩一种还放得下。"
      };
    }
  }
  if (can.has("hiddenSingle")) {
    const hit = findHiddenSingle(board, grid);
    if (hit) {
      const { scope, index } = scopeOfGroup(board, hit.groupIndex);
      return {
        kind: "hiddenSingle",
        scope,
        scopeIndex: index,
        focus: board.variant.groups[hit.groupIndex].filter((c) => board.cells[c] === EMPTY),
        text: `${scopeName(scope, index)}里,有一个数字只剩一个格子容得下它。把这一组还缺的数字挨个找位置,就能把它揪出来。`
      };
    }
  }
  if (can.has("nakedPair")) {
    const hit = findNakedPair(board, grid);
    if (hit) {
      const { scope, index } = scopeOfGroup(board, hit.groupIndex);
      return {
        kind: "nakedPair",
        scope,
        scopeIndex: index,
        focus: hit.base,
        text: `${scopeName(scope, index)}里高亮的这两格候选一模一样,而且都只剩两种。那两个数字被它们俩包圆了,同一组别的格子可以把它们从笔记里划掉。`
      };
    }
  }
  if (can.has("pointingPair")) {
    const hit = findPointingPair(board, grid);
    if (hit) {
      const { scope, index } = scopeOfGroup(board, hit.groupIndex);
      return {
        kind: "pointingPair",
        scope,
        scopeIndex: index,
        focus: hit.base,
        text: `${scopeName(scope, index)}里,有个数字只可能落在高亮的这一条线上。既然它一定在这条线的花内部,这条线出了这朵花的那几格就都可以把它划掉。`
      };
    }
  }
  return null;
}

/** 提示正文里有没有混进阿拉伯数字(混进去就可能带出答案) */
export function hintLeaksDigit(hint: TechniqueHint): boolean {
  return /[0-9]/.test(hint.text);
}
