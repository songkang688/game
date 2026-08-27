/**
 * 数独花田 · 位运算内核。
 *
 * 这一份不认识「9×9」这三个字,它只认识**约束组**:
 * 一组格子里 1..n 各出现一次。行是一组、列是一组、宫是一组,对角花多两组斜线,
 * 异形宫只是把「宫」换成歪歪扭扭的九块。于是标准盘 / 对角花 / 异形宫 / 4×4 / 6×6
 * 共用同一个求解器,不用为每种变体各写一遍。
 *
 * 每组维护一张位掩码 `used`:第 d 位为 1 表示数字 d 已经被这一组占掉了。
 * 判合法就是一次移位与运算,回溯时用 MRV(候选最少的格子先填)剪枝,
 * 解计数数到 limit 就立刻收手 —— 判「唯一解」只要知道有没有第二个解,不必把整棵树跑完。
 */

/** 变体种类:入门 4×4 / 6×6 / 标准九宫 / 对角花 / 异形宫 */
export type VariantKind = "mini4" | "mini6" | "classic" | "diagonal" | "jigsaw";

/** 全部变体种类(遍历与校验用) */
export const VARIANT_KINDS: readonly VariantKind[] = ["mini4", "mini6", "classic", "diagonal", "jigsaw"];

/** 变体的中文名,给盘面头部与攻略用 */
export const VARIANT_LABELS: Record<VariantKind, string> = {
  mini4: "四宫小花田",
  mini6: "六宫花田",
  classic: "九宫花田",
  diagonal: "对角花田",
  jigsaw: "异形宫花田"
};

export interface Variant {
  kind: VariantKind;
  /** 边长,也是数字上限:4 / 6 / 9 */
  n: number;
  /** 宫的行高与列宽(异形宫为 0,因为宫不是矩形) */
  boxRows: number;
  boxCols: number;
  /** 格子下标 → 宫号(0..n-1) */
  regions: number[];
  /** 两条对角线也要不重复 */
  diagonal: boolean;
  /** 全部约束组:行、列、宫,对角花再加两条斜线 */
  groups: number[][];
  /** 格子下标 → 它所属的组号列表 */
  cellGroups: number[][];
}

export interface SudokuBoard {
  variant: Variant;
  /** 长度 n*n,0 表示空格 */
  cells: number[];
}

/** 空格记号 */
export const EMPTY = 0;

// ---------------------------------------------------------------------------
// 确定性随机(和 level99 的同一套算法,本文件自带一份免得多一层依赖)
// ---------------------------------------------------------------------------

export function rng(seed: number): () => number {
  let a = (Math.floor(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 洗牌(不改原数组) */
export function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// 宫的划分
// ---------------------------------------------------------------------------

/** 矩形宫:第 idx 格属于第几宫 */
function boxRegions(n: number, boxRows: number, boxCols: number): number[] {
  const out = new Array<number>(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      out[r * n + c] = Math.floor(r / boxRows) * Math.floor(n / boxCols) + Math.floor(c / boxCols);
    }
  }
  return out;
}

/** 一个格子的上下左右邻居(棋盘内) */
export function neighborsOf(idx: number, n: number): number[] {
  const r = Math.floor(idx / n);
  const c = idx % n;
  const out: number[] = [];
  if (r > 0) out.push(idx - n);
  if (r < n - 1) out.push(idx + n);
  if (c > 0) out.push(idx - 1);
  if (c < n - 1) out.push(idx + 1);
  return out;
}

/**
 * 异形宫:把 9×9 切成九块连通的、每块九格的「花瓣」。
 *
 * 做法是逐块生长:从扫描顺序里第一个还没归属的格子起步,每次从边界里随机挑一个
 * 邻格并进来,长到九格为止。长不动、或者长出来的宫图**一个解都没有**(歪得太狠时真会发生)
 * 就换个种子重来,最多 `tries` 次;兜底返回标准的九宫格。
 * 所以这个函数交出来的宫图一定合法、一定填得满,任何 seed 都不会空手而归。
 */
export function jigsawRegions(seed: number, tries = 60): number[] {
  const n = 9;
  for (let t = 0; t < tries; t++) {
    const rand = rng(seed + t * 7919);
    const owner = new Array<number>(n * n).fill(-1);
    let ok = true;
    for (let region = 0; region < n && ok; region++) {
      const start = owner.indexOf(-1);
      if (start < 0) {
        ok = false;
        break;
      }
      owner[start] = region;
      const taken = [start];
      while (taken.length < n) {
        // 边界:本块已占格子的空邻居。挑「自身空邻居最少」的那一批优先并进来,
        // 免得长成一条细蛇,把别的块围成填不满的死角。
        const frontier: number[] = [];
        for (const cell of taken) {
          for (const nb of neighborsOf(cell, n)) {
            if (owner[nb] === -1 && !frontier.includes(nb)) frontier.push(nb);
          }
        }
        if (frontier.length === 0) {
          ok = false;
          break;
        }
        let best = Infinity;
        for (const cell of frontier) {
          const free = neighborsOf(cell, n).filter((nb) => owner[nb] === -1).length;
          if (free < best) best = free;
        }
        const pool = frontier.filter((cell) => neighborsOf(cell, n).filter((nb) => owner[nb] === -1).length === best);
        const pickCell = pool[Math.floor(rand() * pool.length)];
        owner[pickCell] = region;
        taken.push(pickCell);
      }
    }
    if (!ok || owner.some((v) => v < 0)) continue;
    // 形状再好看,填不满也没用:空盘上先解一次,解不出来就换个种子重来
    const probe = buildVariant("jigsaw", 9, 0, 0, owner, false);
    if (solveFirst({ variant: probe, cells: new Array<number>(81).fill(EMPTY) })) return owner;
  }
  return boxRegions(9, 3, 3);
}

/** 一张宫图合不合法:九个宫各九格,而且每个宫都是连通的 */
export function isRegionMapValid(regions: readonly number[], n: number): boolean {
  if (regions.length !== n * n) return false;
  const buckets: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    if (!Number.isInteger(r) || r < 0 || r >= n) return false;
    buckets[r].push(i);
  }
  for (const cells of buckets) {
    if (cells.length !== n) return false;
    // 洪水填充看看这一宫是不是连成一片
    const inRegion = new Set(cells);
    const seen = new Set<number>([cells[0]]);
    const stack = [cells[0]];
    while (stack.length) {
      const cur = stack.pop() as number;
      for (const nb of neighborsOf(cur, n)) {
        if (inRegion.has(nb) && !seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    if (seen.size !== cells.length) return false;
  }
  return true;
}

/**
 * 按变体拿一张盘面骨架(规格里的 `regionMapFor`)。
 * 异形宫要给 seed,同一个 seed 每次拿到的宫图一模一样。
 */
export function regionMapFor(kind: VariantKind, seed = 1): Variant {
  let n = 9;
  let boxRows = 3;
  let boxCols = 3;
  let regions: number[];
  let diagonal = false;

  switch (kind) {
    case "mini4":
      n = 4;
      boxRows = 2;
      boxCols = 2;
      regions = boxRegions(n, boxRows, boxCols);
      break;
    case "mini6":
      // 六宫:每宫两行三列,横着排两个、竖着排三个
      n = 6;
      boxRows = 2;
      boxCols = 3;
      regions = boxRegions(n, boxRows, boxCols);
      break;
    case "diagonal":
      regions = boxRegions(9, 3, 3);
      diagonal = true;
      break;
    case "jigsaw":
      boxRows = 0;
      boxCols = 0;
      regions = jigsawRegions(seed);
      break;
    default:
      regions = boxRegions(9, 3, 3);
      break;
  }
  return buildVariant(kind, n, boxRows, boxCols, regions, diagonal);
}

/** 用一张现成的宫图拼出变体(题库里存的异形宫直接走这条路,不用重跑生长算法) */
export function variantFromRegions(kind: VariantKind, n: number, regions: number[], diagonal = false): Variant {
  const boxRows = kind === "mini4" ? 2 : kind === "mini6" ? 2 : kind === "jigsaw" ? 0 : 3;
  const boxCols = kind === "mini4" ? 2 : kind === "mini6" ? 3 : kind === "jigsaw" ? 0 : 3;
  return buildVariant(kind, n, boxRows, boxCols, regions, diagonal);
}

function buildVariant(
  kind: VariantKind,
  n: number,
  boxRows: number,
  boxCols: number,
  regions: number[],
  diagonal: boolean
): Variant {
  const groups: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) row.push(r * n + c);
    groups.push(row);
  }
  for (let c = 0; c < n; c++) {
    const col: number[] = [];
    for (let r = 0; r < n; r++) col.push(r * n + c);
    groups.push(col);
  }
  for (let g = 0; g < n; g++) {
    const cells: number[] = [];
    for (let i = 0; i < n * n; i++) {
      if (regions[i] === g) cells.push(i);
    }
    groups.push(cells);
  }
  if (diagonal) {
    const main: number[] = [];
    const anti: number[] = [];
    for (let i = 0; i < n; i++) {
      main.push(i * n + i);
      anti.push(i * n + (n - 1 - i));
    }
    groups.push(main, anti);
  }

  const cellGroups: number[][] = Array.from({ length: n * n }, () => []);
  groups.forEach((cells, gi) => {
    for (const cell of cells) cellGroups[cell].push(gi);
  });

  return { kind, n, boxRows, boxCols, regions, diagonal, groups, cellGroups };
}

// ---------------------------------------------------------------------------
// 盘面工具
// ---------------------------------------------------------------------------

/** 空盘 */
export function emptyBoard(variant: Variant): SudokuBoard {
  return { variant, cells: new Array<number>(variant.n * variant.n).fill(EMPTY) };
}

/** 深拷贝一份盘面(变体是只读结构,共用即可) */
export function cloneBoard(board: SudokuBoard): SudokuBoard {
  return { variant: board.variant, cells: board.cells.slice() };
}

/** 盘面 → 紧凑字符串:数字原样,空格写 `.`(题库固化用) */
export function cellsToString(cells: readonly number[]): string {
  return cells.map((v) => (v > 0 ? String(v) : ".")).join("");
}

/** 紧凑字符串 → 盘面数组 */
export function cellsFromString(text: string): number[] {
  return Array.from(text, (ch) => {
    const d = Number.parseInt(ch, 10);
    return Number.isFinite(d) && d > 0 ? d : EMPTY;
  });
}

/** 第 idx 格所在的行 / 列(0 基) */
export function rowOf(idx: number, n: number): number {
  return Math.floor(idx / n);
}
export function colOf(idx: number, n: number): number {
  return idx % n;
}

/** 全部格子的组掩码:第 g 项 = 这一组已经用掉了哪些数字 */
export function groupMasks(board: SudokuBoard): number[] {
  const masks = new Array<number>(board.variant.groups.length).fill(0);
  for (let i = 0; i < board.cells.length; i++) {
    const d = board.cells[i];
    if (d <= 0) continue;
    for (const g of board.variant.cellGroups[i]) masks[g] |= 1 << d;
  }
  return masks;
}

/**
 * 往第 idx 格填 digit 合不合规矩:同行 / 同列 / 同宫(对角花再看斜线)里不能已经有它。
 * 空格本身永远合法;digit 超出 1..n 一律不合法。
 */
export function isValidPlacement(board: SudokuBoard, idx: number, digit: number): boolean {
  const { variant, cells } = board;
  if (idx < 0 || idx >= cells.length) return false;
  if (digit === EMPTY) return true;
  if (!Number.isInteger(digit) || digit < 1 || digit > variant.n) return false;
  for (const g of variant.cellGroups[idx]) {
    for (const cell of variant.groups[g]) {
      if (cell !== idx && cells[cell] === digit) return false;
    }
  }
  return true;
}

/** 整块盘面有没有内部冲突(空格不算冲突) */
export function isBoardConsistent(board: SudokuBoard): boolean {
  const { variant, cells } = board;
  for (const cells0 of variant.groups) {
    let seen = 0;
    for (const cell of cells0) {
      const d = cells[cell];
      if (d <= 0) continue;
      const bit = 1 << d;
      if (seen & bit) return false;
      seen |= bit;
    }
  }
  return true;
}

/** 和第 idx 格冲突的所有格子下标(填错时高亮用,不含 idx 自己) */
export function conflictsAt(board: SudokuBoard, idx: number): number[] {
  const digit = board.cells[idx];
  if (digit <= 0) return [];
  const out = new Set<number>();
  for (const g of board.variant.cellGroups[idx]) {
    for (const cell of board.variant.groups[g]) {
      if (cell !== idx && board.cells[cell] === digit) out.add(cell);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/** 全盘填满且没有冲突 */
export function isSolved(board: SudokuBoard): boolean {
  return board.cells.every((v) => v > 0) && isBoardConsistent(board);
}

/** 第 idx 格现在还放得下哪些数字(位掩码,第 d 位) */
export function candidateMask(board: SudokuBoard, idx: number, masks?: readonly number[]): number {
  const { variant } = board;
  if (board.cells[idx] > 0) return 0;
  const m = masks ?? groupMasks(board);
  let used = 0;
  for (const g of variant.cellGroups[idx]) used |= m[g];
  return fullMask(variant.n) & ~used;
}

/** 1..n 全部数字的位掩码 */
export function fullMask(n: number): number {
  return ((1 << (n + 1)) - 1) & ~1;
}

/** 位掩码 → 数字数组 */
export function maskToDigits(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) {
    if (mask & (1 << d)) out.push(d);
  }
  return out;
}

/** 位掩码里有几个 1 */
export function popCount(mask: number): number {
  let m = mask;
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// 回溯求解 / 解计数
// ---------------------------------------------------------------------------

interface SearchState {
  cells: number[];
  masks: number[];
  cellGroups: number[][];
  full: number;
  limit: number;
  count: number;
  /** 记下第一个解,给 solveFirst 用 */
  first: number[] | null;
  /** 搜索步数上限,防止病态盘面把浏览器卡死 */
  budget: number;
}

/** MRV:候选最少的空格。返回 -1 表示填满了,返回 -2 表示有空格已经无路可走 */
function pickCell(st: SearchState): number {
  let best = -1;
  let bestCount = 99;
  for (let i = 0; i < st.cells.length; i++) {
    if (st.cells[i] > 0) continue;
    let used = 0;
    for (const g of st.cellGroups[i]) used |= st.masks[g];
    const cand = st.full & ~used;
    if (cand === 0) return -2;
    const c = popCount(cand);
    if (c < bestCount) {
      bestCount = c;
      best = i;
      if (c === 1) break;
    }
  }
  return best;
}

function search(st: SearchState): void {
  if (st.count >= st.limit) return;
  if (st.budget-- <= 0) return;
  const idx = pickCell(st);
  if (idx === -2) return;
  if (idx === -1) {
    st.count += 1;
    if (!st.first) st.first = st.cells.slice();
    return;
  }
  let used = 0;
  for (const g of st.cellGroups[idx]) used |= st.masks[g];
  let cand = st.full & ~used;
  while (cand) {
    const bit = cand & -cand;
    cand ^= bit;
    const d = Math.log2(bit) | 0;
    st.cells[idx] = d;
    for (const g of st.cellGroups[idx]) st.masks[g] |= bit;
    search(st);
    st.cells[idx] = EMPTY;
    for (const g of st.cellGroups[idx]) st.masks[g] &= ~bit;
    if (st.count >= st.limit) return;
  }
}

function makeState(board: SudokuBoard, limit: number, budget: number): SearchState | null {
  const { variant } = board;
  const masks = new Array<number>(variant.groups.length).fill(0);
  const cells = board.cells.slice();
  for (let i = 0; i < cells.length; i++) {
    const d = cells[i];
    if (d <= 0) continue;
    const bit = 1 << d;
    for (const g of variant.cellGroups[i]) {
      // 已经放着的数字自己就冲突了 → 这盘一个解也没有
      if (masks[g] & bit) return null;
      masks[g] |= bit;
    }
  }
  return {
    cells,
    masks,
    cellGroups: variant.cellGroups,
    full: fullMask(variant.n),
    limit,
    count: 0,
    first: null,
    budget
  };
}

/**
 * 这盘有几个解 —— **数到 limit 就停**。
 * 判唯一解只要 `countSolutions(board, 2) === 1`,不必把整棵搜索树跑完。
 */
export function countSolutions(board: SudokuBoard, limit = 2, budget = 2_000_000): number {
  const st = makeState(board, Math.max(1, Math.floor(limit)), budget);
  if (!st) return 0;
  search(st);
  return st.count;
}

/** 唯一解就返回那个解,多解或无解返回 null */
export function solveUnique(board: SudokuBoard): number[] | null {
  const st = makeState(board, 2, 2_000_000);
  if (!st) return null;
  search(st);
  return st.count === 1 && st.first ? st.first : null;
}

/** 随便找一个解(生成完整解时用),找不到返回 null */
export function solveFirst(board: SudokuBoard): number[] | null {
  const st = makeState(board, 1, 2_000_000);
  if (!st) return null;
  search(st);
  return st.first;
}

/** 有没有唯一解 */
export function hasUniqueSolution(board: SudokuBoard): boolean {
  return countSolutions(board, 2) === 1;
}
