/**
 * 数独花田 · 出题机。
 *
 * 两步走,和纸上出数独一个道理:
 *
 * 1. **先有完整解**:空盘回溯,每一格的数字按 `mulberry32(seed)` 洗过的顺序试。
 *    同一个 seed 每次得到一模一样的完整解,可复现、可测试。
 * 2. **再挖洞**:把全部格子按随机顺序过一遍,每次尝试挖掉一个,挖完必须同时满足
 *    - `countSolutions(board, 2) === 1`(还是唯一解,数到 2 就停,不跑满搜索树);
 *    - 允许的那几档技巧还能把它**纯逻辑推完**(不用猜);
 *    两条有一条不满足就把数字原样填回去,继续试下一格。
 *
 * 第二条是本作和「随便挖到几十格」的做法最大的区别:它保证提示按钮永远给得出方法,
 * 也保证难度真的按技巧分级 —— 空格多少只是副产品。
 */
import {
  EMPTY,
  cloneBoard,
  countSolutions,
  fullMask,
  jigsawRegions,
  popCount,
  regionMapFor,
  rng,
  shuffle,
  solveFirst,
  variantFromRegions,
  type SudokuBoard,
  type Variant,
  type VariantKind
} from "./solver";
import {
  TECHNIQUE_ORDER,
  allowedUpTo,
  isSolvableWith,
  minTechniqueTier,
  solveByTechniques,
  tierRank,
  type TechniqueKind
} from "./techniques";

export interface GenSpec {
  kind: VariantKind;
  /** 允许用到的最高技巧档;挖洞时超出这一档就填回去 */
  tier: TechniqueKind;
  /** 想挖出多少个空格(尽力而为,挖不动就停) */
  holes: number;
  /** 要不要求这一题**真的**用得上 tier 这一档(分级章节用) */
  requireTier?: boolean;
}

export interface GeneratedPuzzle {
  kind: VariantKind;
  n: number;
  /** 格子 → 宫号(异形宫靠它复原盘面骨架) */
  regions: number[];
  diagonal: boolean;
  puzzle: number[];
  solution: number[];
  /** 纯逻辑推完这题用到过的技巧 */
  techniques: TechniqueKind[];
  /** 推完这题最低要用到的那一档 */
  tier: TechniqueKind;
  /** 空格数 */
  holes: number;
  seed: number;
}

/**
 * 空盘随机回溯出一个完整解。
 * 每一格按洗过的数字顺序试,同一 seed 结果固定。宫图本身无解时返回 null。
 */
export function randomSolution(variant: Variant, rand: () => number): number[] | null {
  const size = variant.n * variant.n;
  const cells = new Array<number>(size).fill(EMPTY);
  const masks = new Array<number>(variant.groups.length).fill(0);
  const full = fullMask(variant.n);
  const digits: number[] = [];
  for (let d = 1; d <= variant.n; d++) digits.push(d);
  let budget = 400_000;

  const step = (): boolean => {
    if (budget-- <= 0) return false;
    // MRV:候选最少的空格先填,回溯次数少一大截
    let idx = -1;
    let bestCount = 99;
    for (let i = 0; i < size; i++) {
      if (cells[i] > 0) continue;
      let used = 0;
      for (const g of variant.cellGroups[i]) used |= masks[g];
      const cand = full & ~used;
      if (cand === 0) return false;
      const c = popCount(cand);
      if (c < bestCount) {
        bestCount = c;
        idx = i;
        if (c === 1) break;
      }
    }
    if (idx < 0) return true;

    let used = 0;
    for (const g of variant.cellGroups[idx]) used |= masks[g];
    for (const d of shuffle(digits, rand)) {
      const bit = 1 << d;
      if (used & bit) continue;
      cells[idx] = d;
      for (const g of variant.cellGroups[idx]) masks[g] |= bit;
      if (step()) return true;
      cells[idx] = EMPTY;
      for (const g of variant.cellGroups[idx]) masks[g] &= ~bit;
    }
    return false;
  };

  if (step()) return cells;

  // 个别歪得厉害的异形宫上,随机顺序会陷进很深的回溯里。这时改走稳的那条路:
  // 顺序求解出一个解,再把九个数字标签随机换一遍 —— 换标签不影响任何一条约束。
  const base = solveFirst({ variant, cells: new Array<number>(size).fill(EMPTY) });
  if (!base) return null;
  const perm = shuffle(digits, rand);
  return base.map((d) => (d > 0 ? perm[d - 1] : d));
}

export interface DigOptions {
  /** 目标空格数 */
  holes: number;
  /** 允许的技巧档 */
  allowed: readonly TechniqueKind[];
  rand: () => number;
}

/**
 * 挖洞:每挖一个都要过两道闸门(唯一解 + 纯逻辑推得完),过不了就原样填回去。
 * 返回挖好的盘面(不改入参)。
 */
export function digHoles(solved: SudokuBoard, opts: DigOptions): SudokuBoard {
  const board = cloneBoard(solved);
  const order = shuffle(
    board.cells.map((_, i) => i),
    opts.rand
  );
  let dug = 0;
  for (const idx of order) {
    if (dug >= opts.holes) break;
    const keep = board.cells[idx];
    if (keep === EMPTY) continue;
    board.cells[idx] = EMPTY;
    if (countSolutions(board, 2) === 1 && isSolvableWith(board, opts.allowed)) {
      dug += 1;
    } else {
      board.cells[idx] = keep;
    }
  }
  return board;
}

/** 一个变体加一张宫图 → 盘面骨架 */
function variantFor(kind: VariantKind, seed: number): Variant {
  return regionMapFor(kind, seed);
}

/**
 * 出一道题(规格里的 `generate(seed, difficulty)`)。
 *
 * 同一个 `seed` + 同一份 `spec` 每次产出一字不差的同一题 —— 题库固化之后,
 * 单测可以拿 seed 重跑一遍,核对固化下来的题面确实是这套生成器产出的。
 */
export function generate(seed: number, spec: GenSpec): GeneratedPuzzle {
  const allowed = allowedUpTo(spec.tier);

  // 异形宫偶尔会生长出一张「无解」的宫图,换个 seed 再来,最多试 24 次
  let variant = variantFor(spec.kind, seed);
  let solution = randomSolution(variant, rng(seed * 2654435761 + 12345));
  for (let t = 1; t < 24 && !solution; t++) {
    variant = spec.kind === "jigsaw" ? variantFromRegions("jigsaw", 9, jigsawRegions(seed + t * 101)) : variant;
    solution = randomSolution(variant, rng(seed * 2654435761 + 12345 + t * 7717));
  }
  if (!solution) {
    // 兜底:退回标准九宫,永远出得了题,绝不抛异常
    variant = regionMapFor("classic");
    solution = randomSolution(variant, rng(seed || 1)) ?? new Array<number>(81).fill(1);
  }

  const solvedBoard: SudokuBoard = { variant, cells: solution };
  const puzzle = digHoles(solvedBoard, {
    holes: spec.holes,
    allowed,
    rand: rng(seed * 40503 + 977)
  });

  const logic = solveByTechniques(puzzle, allowed);
  const tier = minTechniqueTier(puzzle) ?? spec.tier;

  return {
    kind: spec.kind,
    n: variant.n,
    regions: variant.regions.slice(),
    diagonal: variant.diagonal,
    puzzle: puzzle.cells.slice(),
    solution: solution.slice(),
    techniques: logic.used,
    tier,
    holes: puzzle.cells.filter((v) => v === EMPTY).length,
    seed
  };
}

/**
 * 出一道**指定难度档**的题:从 seed 起往后换种子,直到最低技巧档正好是 `spec.tier`。
 * 试满 `tries` 次还没撞上就把最接近的那一题交出来(绝不空手而归)。
 */
export function generateAtTier(seed: number, spec: GenSpec, tries = 40): GeneratedPuzzle {
  let best: GeneratedPuzzle | null = null;
  let bestGap = Infinity;
  for (let t = 0; t < tries; t++) {
    const got = generate(seed + t * 613, spec);
    if (got.tier === spec.tier) return got;
    const gap = Math.abs(tierRank(got.tier) - tierRank(spec.tier));
    if (gap < bestGap || (gap === bestGap && best && got.holes > best.holes)) {
      best = got;
      bestGap = gap;
    }
  }
  return best as GeneratedPuzzle;
}

/** 一题的难度档在全部四档里排第几(0 基),给章节排序用 */
export function difficultyRank(p: GeneratedPuzzle): number {
  return TECHNIQUE_ORDER.indexOf(p.tier);
}
