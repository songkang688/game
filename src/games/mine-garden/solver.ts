/**
 * 扫雷花园 · 约束求解器与无猜生成（纯函数，不碰 DOM）。
 *
 * 求解器只吃玩家看得见的信息：哪些格翻开了、翻开的格上写着几、哪些格已经确认是刺种、
 * 一共埋了多少颗。它**从不猜**——推不出来就老老实实说「卡住了」。
 *
 * 四级推理，从便宜到贵：
 *  1. 平凡规则：数字减掉已知刺种，剩 0 就全安全，剩几就正好等于未知格数时全是刺种；
 *  2. 子集规则：A ⊆ B 时 B\A 的刺种数 = nB − nA，再套平凡规则；
 *  3. 全局剩余数：剩 0 颗 → 场上全安全；剩的颗数正好等于未知格数 → 全是刺种；
 *  4. 完整枚举：把前沿按约束连通性切成分量，逐个分量回溯枚举全部合法布种，
 *     再用一次子集和 DP 把「各分量刺种数 + 分量外刺种数 = 剩余总数」这层全局约束也算进去。
 *
 * 第 4 级是完整的：只要在预算内枚举完了，「这一格所有解里都不是刺种」就等价于
 * 「这一格可以放心翻开」。所以**生成器认可的图，一定能被这套推理一路推到底**。
 */
import { hintMap, neighborTable, placeMines, safeZone, makeRand } from "./board";

/** 未知 */
export const UNKNOWN = 0;
/** 已翻开（一定不是刺种） */
export const KNOWN_OPEN = 1;
/** 已确认是刺种 */
export const KNOWN_MINE = 2;

export interface SolveOptions {
  /** 单个连通分量最多枚举多少格；再大就放弃这一分量（宁可判卡住，也不瞎猜） */
  maxComponent?: number;
  /** 单个分量一次枚举的节点上限 */
  nodeBudget?: number;
  /** 整局推理的枚举节点总预算 */
  totalBudget?: number;
}

export const DEFAULT_MAX_COMPONENT = 26;
export const DEFAULT_NODE_BUDGET = 120_000;
export const DEFAULT_TOTAL_BUDGET = 3_000_000;

function opt(o: SolveOptions | undefined): Required<SolveOptions> {
  return {
    maxComponent: Math.min(31, o?.maxComponent ?? DEFAULT_MAX_COMPONENT),
    nodeBudget: o?.nodeBudget ?? DEFAULT_NODE_BUDGET,
    totalBudget: o?.totalBudget ?? DEFAULT_TOTAL_BUDGET
  };
}

export interface Deduction {
  /** 一定安全、可以放心翻开的格 */
  safe: number[];
  /** 一定是刺种、可以放心插旗的格 */
  mines: number[];
  /** 这一轮用掉的枚举节点数 */
  nodes: number;
  /** 结论是靠完整枚举拿到的（前三级推不动） */
  usedSearch: boolean;
}

function emptyDeduction(): Deduction {
  return { safe: [], mines: [], nodes: 0, usedSearch: false };
}

interface Constraint {
  cells: number[];
  need: number;
}

/** 从「已翻开的数字格」抽出约束：每条约束是「这几个未知格里正好有 need 颗刺种」 */
export function buildConstraints(
  w: number,
  h: number,
  hint: Uint8Array,
  known: Uint8Array
): Constraint[] {
  const table = neighborTable(w, h);
  const out: Constraint[] = [];
  for (let i = 0; i < known.length; i++) {
    if (known[i] !== KNOWN_OPEN) continue;
    const n = hint[i];
    if (n === 0) continue;
    let need = n;
    const cells: number[] = [];
    for (const nb of table[i]) {
      if (known[nb] === KNOWN_MINE) need--;
      else if (known[nb] === UNKNOWN) cells.push(nb);
    }
    if (cells.length > 0) out.push({ cells, need });
  }
  return out;
}

/** 场上还没定论的格子 */
function unknownCells(known: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < known.length; i++) {
    if (known[i] === UNKNOWN) out.push(i);
  }
  return out;
}

function countKnownMines(known: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < known.length; i++) {
    if (known[i] === KNOWN_MINE) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// 第 1–3 级：平凡规则 + 子集规则 + 全局剩余数
// ---------------------------------------------------------------------------

/**
 * 只用便宜的三级规则推一轮。这也是「普通 / 高手」两档假人的全部本事。
 * `totalMines` 传 -1 表示玩家还不知道总数（那就跳过全局剩余数规则）。
 */
export function deduceSimple(
  w: number,
  h: number,
  hint: Uint8Array,
  known: Uint8Array,
  totalMines: number
): Deduction {
  const out = emptyDeduction();
  const cons = buildConstraints(w, h, hint, known);
  const safe = new Set<number>();
  const mines = new Set<number>();

  // 1. 平凡规则
  for (const c of cons) {
    if (c.need <= 0) {
      for (const cell of c.cells) safe.add(cell);
    } else if (c.need === c.cells.length) {
      for (const cell of c.cells) mines.add(cell);
    }
  }

  // 2. 子集规则：只比较共享格子的两条约束，别做全对全
  if (safe.size === 0 && mines.size === 0) {
    const byCell = new Map<number, number[]>();
    cons.forEach((c, ci) => {
      for (const cell of c.cells) {
        const list = byCell.get(cell);
        if (list) list.push(ci);
        else byCell.set(cell, [ci]);
      }
    });
    for (let ai = 0; ai < cons.length; ai++) {
      const a = cons[ai];
      const seen = new Set<number>();
      for (const cell of a.cells) {
        for (const bi of byCell.get(cell) ?? []) {
          if (bi === ai || seen.has(bi)) continue;
          seen.add(bi);
          const b = cons[bi];
          if (b.cells.length <= a.cells.length) continue;
          const bset = new Set(b.cells);
          let subset = true;
          for (const x of a.cells) {
            if (!bset.has(x)) {
              subset = false;
              break;
            }
          }
          if (!subset) continue;
          const diff = b.cells.filter((x) => !a.cells.includes(x));
          const need = b.need - a.need;
          if (need <= 0) {
            for (const x of diff) safe.add(x);
          } else if (need === diff.length) {
            for (const x of diff) mines.add(x);
          }
        }
      }
    }
  }

  // 3. 全局剩余数
  if (safe.size === 0 && mines.size === 0 && totalMines >= 0) {
    const rest = unknownCells(known);
    const left = totalMines - countKnownMines(known);
    if (rest.length > 0) {
      if (left <= 0) for (const x of rest) safe.add(x);
      else if (left === rest.length) for (const x of rest) mines.add(x);
    }
  }

  out.safe = [...safe].sort((a, b) => a - b);
  out.mines = [...mines].sort((a, b) => a - b);
  return out;
}

// ---------------------------------------------------------------------------
// 第 4 级：连通分量枚举 + 全局子集和 DP
// ---------------------------------------------------------------------------

interface Component {
  /** 分量里的格子（全局下标） */
  cells: number[];
  /** 约束（格子用分量内的局部下标） */
  cons: Constraint[];
  /** 分量内刺种总数的可行值 */
  possible: boolean[];
  /** 每个局部格「在某个刺种总数 k 下能是刺种」的位掩码；没枚举成功就是 null */
  mineMask: Uint32Array | null;
  safeMask: Uint32Array | null;
}

function splitComponents(cons: Constraint[]): { cells: number[]; cons: Constraint[] }[] {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r) as number;
    let cur = x;
    while (parent.get(cur) !== r) {
      const next = parent.get(cur) as number;
      parent.set(cur, r);
      cur = next;
    }
    return r;
  };
  for (const c of cons) {
    for (const cell of c.cells) if (!parent.has(cell)) parent.set(cell, cell);
  }
  for (const c of cons) {
    const root = find(c.cells[0]);
    for (const cell of c.cells) parent.set(find(cell), root);
  }
  const groups = new Map<number, { cells: number[]; cons: Constraint[] }>();
  for (const c of cons) {
    const root = find(c.cells[0]);
    let g = groups.get(root);
    if (!g) {
      g = { cells: [], cons: [] };
      groups.set(root, g);
    }
    g.cons.push(c);
  }
  const seen = new Set<number>();
  for (const c of cons) {
    const root = find(c.cells[0]);
    const g = groups.get(root) as { cells: number[]; cons: Constraint[] };
    for (const cell of c.cells) {
      if (seen.has(cell)) continue;
      seen.add(cell);
      g.cells.push(cell);
    }
  }
  return [...groups.values()];
}

/** 回溯枚举一个分量的全部合法布种；节点烧超预算就放弃（返回 null） */
function enumerateComponent(
  cells: number[],
  cons: Constraint[],
  budget: number
): { possible: boolean[]; mineMask: Uint32Array; safeMask: Uint32Array; nodes: number } | null {
  const m = cells.length;
  const local = new Map<number, number>();
  cells.forEach((c, i) => local.set(c, i));
  const consCells: number[][] = cons.map((c) => c.cells.map((x) => local.get(x) as number));
  const need = cons.map((c) => c.need);
  const consOfCell: number[][] = Array.from({ length: m }, () => [] as number[]);
  consCells.forEach((list, ci) => {
    for (const k of list) consOfCell[k].push(ci);
  });

  const mineCount = new Int32Array(cons.length);
  const undecided = Int32Array.from(consCells.map((l) => l.length));
  const assign = new Uint8Array(m);
  const possible = new Array<boolean>(m + 1).fill(false);
  const mineMask = new Uint32Array(m);
  const safeMask = new Uint32Array(m);
  let nodes = 0;
  let overflow = false;

  const record = (total: number): void => {
    possible[total] = true;
    const bit = 1 << total;
    for (let i = 0; i < m; i++) {
      if (assign[i]) mineMask[i] |= bit;
      else safeMask[i] |= bit;
    }
  };

  const rec = (k: number, total: number): void => {
    if (overflow) return;
    if (++nodes > budget) {
      overflow = true;
      return;
    }
    if (k === m) {
      record(total);
      return;
    }
    for (let v = 0; v <= 1; v++) {
      let ok = true;
      for (const ci of consOfCell[k]) {
        mineCount[ci] += v;
        undecided[ci] -= 1;
        if (mineCount[ci] > need[ci] || mineCount[ci] + undecided[ci] < need[ci]) ok = false;
      }
      if (ok) {
        assign[k] = v as 0 | 1;
        rec(k + 1, total + v);
      }
      for (const ci of consOfCell[k]) {
        mineCount[ci] -= v;
        undecided[ci] += 1;
      }
      if (overflow) return;
    }
  };

  rec(0, 0);
  if (overflow) return null;
  return { possible, mineMask, safeMask, nodes };
}

/** 布尔可达集合的卷积：a 里的和 与 b 里的和 两两相加，超过 cap 的丢掉 */
function convolve(a: boolean[], b: boolean[], cap: number): boolean[] {
  const out = new Array<boolean>(cap + 1).fill(false);
  for (let i = 0; i <= cap; i++) {
    if (!a[i]) continue;
    for (let j = 0; i + j <= cap && j < b.length; j++) {
      if (b[j]) out[i + j] = true;
    }
  }
  return out;
}

function zeroSum(cap: number): boolean[] {
  const out = new Array<boolean>(cap + 1).fill(false);
  out[0] = true;
  return out;
}

/**
 * 完整枚举一轮。前三级推不动时才值得调它。
 * `totalMines` 传 -1 就跳过全局那一层（各分量只能各算各的）。
 */
export function deduceSearch(
  w: number,
  h: number,
  hint: Uint8Array,
  known: Uint8Array,
  totalMines: number,
  options?: SolveOptions
): Deduction {
  const cfg = opt(options);
  const out = emptyDeduction();
  out.usedSearch = true;
  const cons = buildConstraints(w, h, hint, known);
  if (cons.length === 0) return out;

  const raw = splitComponents(cons);
  const comps: Component[] = [];
  for (const g of raw) {
    if (g.cells.length > cfg.maxComponent) {
      // 太大就不枚举了：它的刺种数当成 0..size 全都可能，不给任何逐格结论
      comps.push({
        cells: g.cells,
        cons: g.cons,
        possible: new Array<boolean>(g.cells.length + 1).fill(true),
        mineMask: null,
        safeMask: null
      });
      continue;
    }
    const res = enumerateComponent(g.cells, g.cons, cfg.nodeBudget);
    out.nodes += res?.nodes ?? cfg.nodeBudget;
    if (!res) {
      comps.push({
        cells: g.cells,
        cons: g.cons,
        possible: new Array<boolean>(g.cells.length + 1).fill(true),
        mineMask: null,
        safeMask: null
      });
      continue;
    }
    comps.push({
      cells: g.cells,
      cons: g.cons,
      possible: res.possible,
      mineMask: res.mineMask,
      safeMask: res.safeMask
    });
  }

  // 分量外的未知格（前沿够不着的地方）
  const inComp = new Set<number>();
  for (const c of comps) for (const cell of c.cells) inComp.add(cell);
  const outsideCells = unknownCells(known).filter((c) => !inComp.has(c));

  const knownMines = countKnownMines(known);
  const remaining = totalMines >= 0 ? totalMines - knownMines : -1;

  const safe = new Set<number>();
  const mines = new Set<number>();

  if (remaining < 0) {
    // 不知道总数：每个分量各判各的
    for (const c of comps) {
      if (!c.mineMask || !c.safeMask) continue;
      for (let i = 0; i < c.cells.length; i++) {
        if (c.mineMask[i] === 0) safe.add(c.cells[i]);
        else if (c.safeMask[i] === 0) mines.add(c.cells[i]);
      }
    }
  } else {
    const cap = remaining;
    const n = comps.length;
    const prefix: boolean[][] = new Array(n + 1);
    prefix[0] = zeroSum(cap);
    for (let i = 0; i < n; i++) prefix[i + 1] = convolve(prefix[i], comps[i].possible, cap);
    const suffix: boolean[][] = new Array(n + 1);
    suffix[n] = zeroSum(cap);
    for (let i = n - 1; i >= 0; i--) suffix[i] = convolve(suffix[i + 1], comps[i].possible, cap);

    for (let i = 0; i < n; i++) {
      const c = comps[i];
      const others = convolve(prefix[i], suffix[i + 1], cap);
      // 这个分量里刺种总数 k 到底可不可能：别的分量凑得出 s，剩下的塞进分量外还塞得下
      let okMask = 0;
      for (let k = 0; k < c.possible.length && k <= cap && k < 32; k++) {
        if (!c.possible[k]) continue;
        for (let s = 0; s + k <= cap; s++) {
          if (!others[s]) continue;
          const left = remaining - k - s;
          if (left >= 0 && left <= outsideCells.length) {
            okMask |= 1 << k;
            break;
          }
        }
      }
      if (!c.mineMask || !c.safeMask || okMask === 0) continue;
      for (let j = 0; j < c.cells.length; j++) {
        if ((c.mineMask[j] & okMask) === 0) safe.add(c.cells[j]);
        else if ((c.safeMask[j] & okMask) === 0) mines.add(c.cells[j]);
      }
    }

    // 分量外：全局只允许「一颗都不在外面」就全安全，只允许「全在外面」就全是刺种
    if (outsideCells.length > 0) {
      let minOut = Number.POSITIVE_INFINITY;
      let maxOut = Number.NEGATIVE_INFINITY;
      for (let s = 0; s <= cap; s++) {
        if (!prefix[n][s]) continue;
        const left = remaining - s;
        if (left < 0 || left > outsideCells.length) continue;
        minOut = Math.min(minOut, left);
        maxOut = Math.max(maxOut, left);
      }
      if (Number.isFinite(minOut)) {
        if (maxOut === 0) for (const cell of outsideCells) safe.add(cell);
        else if (minOut === outsideCells.length) for (const cell of outsideCells) mines.add(cell);
      }
    }
  }

  out.safe = [...safe].sort((a, b) => a - b);
  out.mines = [...mines].sort((a, b) => a - b);
  return out;
}

/** 先便宜后贵：三级规则推不动才启动完整枚举 */
export function deduce(
  w: number,
  h: number,
  hint: Uint8Array,
  known: Uint8Array,
  totalMines: number,
  options?: SolveOptions
): Deduction {
  const cheap = deduceSimple(w, h, hint, known, totalMines);
  if (cheap.safe.length > 0 || cheap.mines.length > 0) return cheap;
  return deduceSearch(w, h, hint, known, totalMines, options);
}

// ---------------------------------------------------------------------------
// 整局推演
// ---------------------------------------------------------------------------

export interface SolveResult {
  /** 所有非刺种格都被推着翻开了 */
  solved: boolean;
  /** 翻开的格数 */
  opened: number;
  /** 非刺种格总数 */
  safeTotal: number;
  /** 卡住时挨着已翻开区域的那些未知格（修补生成器盯着它们下手） */
  stuck: number[];
  /** 推理轮数 */
  rounds: number;
  /** 用掉的枚举节点数 */
  nodes: number;
  /** 中途启动过完整枚举 */
  usedSearch: boolean;
}

export interface BoardLike {
  w: number;
  h: number;
  mine: Uint8Array;
}

/**
 * 从 `firstClick` 开始，完全按玩家视角把这张图推一遍。
 * 只翻「推出来一定安全」的格，一次都不猜。
 */
export function solveLogically(
  w: number,
  h: number,
  mine: Uint8Array,
  firstClick: number,
  options?: SolveOptions
): SolveResult {
  const cfg = opt(options);
  const hint = hintMap(w, h, mine);
  const table = neighborTable(w, h);
  const known = new Uint8Array(w * h);
  let totalMines = 0;
  for (let i = 0; i < mine.length; i++) totalMines += mine[i] ? 1 : 0;
  let safeTotal = w * h - totalMines;
  let opened = 0;

  const openCell = (start: number): void => {
    if (known[start] !== UNKNOWN || mine[start]) return;
    const queue = [start];
    known[start] = KNOWN_OPEN;
    opened++;
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      if (hint[cur] !== 0) continue;
      for (const nb of table[cur]) {
        if (known[nb] !== UNKNOWN || mine[nb]) continue;
        known[nb] = KNOWN_OPEN;
        opened++;
        if (hint[nb] === 0) queue.push(nb);
      }
    }
  };

  if (firstClick >= 0 && firstClick < w * h) openCell(firstClick);

  let rounds = 0;
  let nodes = 0;
  let usedSearch = false;
  while (opened < safeTotal) {
    rounds++;
    const step = deduce(w, h, hint, known, totalMines, {
      maxComponent: cfg.maxComponent,
      nodeBudget: cfg.nodeBudget,
      totalBudget: cfg.totalBudget
    });
    nodes += step.nodes;
    if (step.usedSearch) usedSearch = true;
    if (step.safe.length === 0 && step.mines.length === 0) break;
    if (nodes > cfg.totalBudget) break;
    for (const cell of step.mines) {
      if (known[cell] === UNKNOWN) known[cell] = KNOWN_MINE;
    }
    for (const cell of step.safe) openCell(cell);
  }

  const stuck: number[] = [];
  if (opened < safeTotal) {
    for (const c of buildConstraints(w, h, hint, known)) {
      for (const cell of c.cells) if (!stuck.includes(cell)) stuck.push(cell);
    }
  }

  safeTotal = w * h - totalMines;
  return { solved: opened >= safeTotal, opened, safeTotal, stuck, rounds, nodes, usedSearch };
}

/** 「这张图从这一下点起，全程都能靠逻辑推出来」——生成器与测试都用它拍板 */
export function isLogicallySolvable(board: BoardLike, firstClick: number, options?: SolveOptions): boolean {
  return solveLogically(board.w, board.h, board.mine, firstClick, options).solved;
}

// ---------------------------------------------------------------------------
// 无猜生成
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  /** 要不要保证无猜；false 就是随便布一张（前两章用） */
  noGuess?: boolean;
  /** 整盘重洗的次数上限 */
  attempts?: number;
  /** 每次重洗之后最多修补几回 */
  repairs?: number;
  solve?: SolveOptions;
}

export const DEFAULT_ATTEMPTS = 24;
export const DEFAULT_REPAIRS = 60;

export interface GenerateResult {
  mine: Uint8Array;
  /** 真的通过了无猜校验（预算烧完还没成就是 false，这一盘可能要蒙一下） */
  noGuess: boolean;
  /** 用掉的整盘重洗次数 */
  attempts: number;
  /** 用掉的局部修补次数 */
  repairs: number;
  /** 最后一次推演的结果，便于测试与调参 */
  last: SolveResult;
}

function derive(seed: number, salt: number): number {
  return (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(salt + 1, 0xc2b2ae35)) >>> 0;
}

/**
 * 布出一张（尽量）无猜的花园。
 *
 * 刺种一律在首次翻开之后才埋，所以首点及其 8 邻格是按构造干净的。
 * 卡住时先做**局部修补**（把卡住前沿附近的一颗刺种挪到远处），修补比整盘重洗收敛快得多；
 * 修补够多次还不行才换 seed 整盘重洗。**预算永远有限**，烧完就降级返回，绝不卡住界面。
 */
export function generateNoGuess(
  w: number,
  h: number,
  mines: number,
  safeIndex: number,
  seed: number,
  options: GenerateOptions = {}
): GenerateResult {
  const wantNoGuess = options.noGuess !== false;
  const maxAttempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
  const maxRepairs = Math.max(0, options.repairs ?? DEFAULT_REPAIRS);
  const solveOpts = options.solve;
  const total = w * h;
  const blocked = new Uint8Array(total);
  for (const i of safeZone(w, h, safeIndex)) blocked[i] = 1;

  let mine = placeMines(w, h, mines, safeIndex, seed);
  let last = solveLogically(w, h, mine, safeIndex, solveOpts);
  if (!wantNoGuess || last.solved) {
    return { mine, noGuess: last.solved, attempts: 0, repairs: 0, last };
  }

  const rand = makeRand(derive(seed, 0x5eed));
  let attempts = 0;
  let repairs = 0;
  let best = { mine, last };

  for (let a = 0; a < maxAttempts; a++) {
    for (let r = 0; r < maxRepairs; r++) {
      // 卡住的前沿附近哪几颗刺种最碍事：优先挪它们
      const near = new Set<number>();
      const table = neighborTable(w, h);
      for (const cell of last.stuck) {
        if (mine[cell]) near.add(cell);
        for (const nb of table[cell]) if (mine[nb]) near.add(nb);
      }
      if (near.size === 0) break;
      const picks = [...near];
      const from = picks[Math.floor(rand() * picks.length)];
      // 挪到一块「不在安全区、现在没刺种、也不挨着卡住前沿」的空地上
      const spots: number[] = [];
      for (let i = 0; i < total; i++) {
        if (blocked[i] || mine[i] || near.has(i)) continue;
        spots.push(i);
      }
      if (spots.length === 0) break;
      const to = spots[Math.floor(rand() * spots.length)];
      mine = Uint8Array.from(mine);
      mine[from] = 0;
      mine[to] = 1;
      repairs++;
      last = solveLogically(w, h, mine, safeIndex, solveOpts);
      if (last.solved) return { mine, noGuess: true, attempts, repairs, last };
      if (last.opened > best.last.opened) best = { mine, last };
    }
    attempts++;
    if (attempts >= maxAttempts) break;
    mine = placeMines(w, h, mines, safeIndex, derive(seed, attempts));
    last = solveLogically(w, h, mine, safeIndex, solveOpts);
    if (last.solved) return { mine, noGuess: true, attempts, repairs, last };
    if (last.opened > best.last.opened) best = { mine, last };
  }

  return { mine: best.mine, noGuess: false, attempts, repairs, last: best.last };
}
