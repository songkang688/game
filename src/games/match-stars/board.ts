/**
 * 星星消消乐 · 尺寸无关的棋盘核心（纯函数，不碰 DOM，不吃随机数）。
 *
 * 1.2 把「匹配 / 压实 / 补块」从 8×8 的闯关引擎里抽了出来，
 * 好让对战的 6×6 小棋盘和闯关的 8×8 大棋盘共用同一套规则和同一条下落时间线。
 *
 * 这里最要紧的一件事：**压实（settle）和补块（refill）是分开的两步**。
 * 分开之后中间会出现一个「幸存块已经落到位、顶上还空着」的中间盘面，
 * `anim.ts` 就是拿这个中间盘面算出「谁从哪一行掉到哪一行」的。
 * 合在一起写的话，永远只有「消除前」和「补满后」两张快照，动画就无从谈起。
 *
 * 拆分不改随机数的取用顺序：`refillOn` 仍旧是「列 0→末列、每列自下而上」，
 * 和 1.1 那个单层循环一字不差，所以老关卡的 seed 一位都没变。
 */

/** 空格：压实之后、补块之前的那一小会儿，顶上就是这个 */
export const EMPTY = -1;
/** 彩虹星：和谁交换就清掉全场那种图案 */
export const RAINBOW = -2;

/** 特殊块种类（闯关不用，只在对战 / 无尽里出现） */
export const PLAIN = 0;
/** 横 4 连留下的横向火箭：引爆清掉整行 */
export const ROCKET_H = 1;
/** 竖 4 连留下的纵向火箭：引爆清掉整列 */
export const ROCKET_V = 2;
/** L / T 形留下的炸弹：引爆清掉周围 3×3 */
export const BOMB = 3;

export type Special = 0 | 1 | 2 | 3;

/** 特殊块的名字与图标（面板与提示共用） */
export const SPECIAL_ICON: Record<number, string> = { 1: "➡️", 2: "⬇️", 3: "💥" };
export const SPECIAL_NAME: Record<number, string> = { 1: "横向火箭", 2: "纵向火箭", 3: "小炸弹" };

/**
 * 一块棋盘。闯关的 `MatchState` 也满足这个形状（结构化子集），
 * 所以视图层只认 `Cellset`，闯关和对战都能塞进同一个渲染器。
 */
export interface Cellset {
  cols: number;
  rows: number;
  /** 每格的图案：0..colors-1 是普通图案，`EMPTY` 是空，`RAINBOW` 是彩虹星 */
  grid: number[];
  /** 每格叠的特殊块（`PLAIN` 表示没有）；闯关全 0 */
  special: number[];
  /** 不参与下落、但下落可以「穿过去」的格子：冰块 / 藤蔓 */
  fixed: boolean[];
  /** 挡住下落的挡板：上面的星星落不下来，底下也补不进新块 */
  solid: boolean[];
}

/** 一轮消除要清掉哪些格、清完之后在哪儿留下什么 */
export interface RoundPlan {
  cells: number[];
  /** 清完之后在这些位置留下彩虹星 / 火箭 / 炸弹（闯关不产出，恒为空） */
  rewards?: Array<{ at: number; grid: number; special: number }>;
}

/** 下落时哪些格子要特殊对待 */
export interface ColumnMask {
  fixed?: boolean[];
  solid?: boolean[];
}

/** 一列被挡板切出来的一段连续可落区间 */
export interface Segment {
  /** 段内的行号，自下而上 */
  rows: number[];
  /** 这一段的头顶有没有挡板：没有挡板才接得住从棋盘外掉进来的新块 */
  open: boolean;
}

export function makeCellset(cols: number, rows: number, fill = EMPTY): Cellset {
  const n = cols * rows;
  return {
    cols,
    rows,
    grid: new Array<number>(n).fill(fill),
    special: new Array<number>(n).fill(PLAIN),
    fixed: new Array<boolean>(n).fill(false),
    solid: new Array<boolean>(n).fill(false),
  };
}

export function cloneCellset(s: Cellset): Cellset {
  return {
    cols: s.cols,
    rows: s.rows,
    grid: s.grid.slice(),
    special: s.special.slice(),
    fixed: s.fixed.slice(),
    solid: s.solid.slice(),
  };
}

export function maskOf(s: Cellset): ColumnMask {
  return { fixed: s.fixed, solid: s.solid };
}

/**
 * 把第 c 列切成若干可落区间：挡板把一列切断，冰块 / 藤蔓只是被跳过。
 * 返回顺序自下而上（`segs[0]` 贴着地板），最后一段才可能是 `open`。
 */
export function columnSegments(cols: number, rows: number, c: number, mask: ColumnMask = {}): Segment[] {
  const segs: Segment[] = [];
  let cur: number[] = [];
  for (let r = rows - 1; r >= 0; r--) {
    const i = r * cols + c;
    if (mask.solid?.[i]) {
      if (cur.length) segs.push({ rows: cur, open: false });
      cur = [];
      continue;
    }
    // 冰块 / 藤蔓：它自己不动，但不切断这一列
    if (mask.fixed?.[i]) continue;
    cur.push(r);
  }
  // 走到列顶还没碰上挡板，这一段才接得住新块
  if (cur.length) segs.push({ rows: cur, open: true });
  return segs;
}

/** 找出盘面上所有三连及以上的格子 */
export function findMatchesOn(g: number[], cols: number, rows: number): Set<number> {
  const out = new Set<number>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const v = g[i];
      if (v < 0) continue;
      if (c <= cols - 3 && g[i + 1] === v && g[i + 2] === v) {
        out.add(i); out.add(i + 1); out.add(i + 2);
      }
      if (r <= rows - 3 && g[i + cols] === v && g[i + 2 * cols] === v) {
        out.add(i); out.add(i + cols); out.add(i + 2 * cols);
      }
    }
  }
  return out;
}

/** 单点快查：格子 i 现在是不是某个三连的一员 */
export function matchesAtOn(g: number[], cols: number, rows: number, i: number): boolean {
  const v = g[i];
  if (v < 0) return false;
  const r = Math.floor(i / cols);
  const c = i % cols;
  let run = 1;
  for (let x = c - 1; x >= 0 && g[r * cols + x] === v; x--) run++;
  for (let x = c + 1; x < cols && g[r * cols + x] === v; x++) run++;
  if (run >= 3) return true;
  run = 1;
  for (let y = r - 1; y >= 0 && g[y * cols + c] === v; y--) run++;
  for (let y = r + 1; y < rows && g[y * cols + c] === v; y++) run++;
  return run >= 3;
}

/**
 * 压实：每列（每段）里活着的图案自下而上落到底，空出来的位置写成 `EMPTY`。
 * **只挪不补**——补块是 `refillOn` 的事，中间这张有洞的盘面正是动画的依据。
 */
export function settleOn(grid: number[], cols: number, rows: number, mask: ColumnMask = {}): void {
  for (let c = 0; c < cols; c++) {
    for (const seg of columnSegments(cols, rows, c, mask)) {
      const vals: number[] = [];
      for (const r of seg.rows) {
        const i = r * cols + c;
        if (grid[i] >= 0) vals.push(grid[i]);
      }
      seg.rows.forEach((r, k) => {
        grid[r * cols + c] = k < vals.length ? vals[k] : EMPTY;
      });
    }
  }
}

/**
 * 补块：只有「头顶没挡板」的那一段才接得住新块（挡板底下就得空着，先去消挡板）。
 * 取数顺序是列 0→末列、每列自下而上，和 1.1 合写时完全一致。
 */
export function refillOn(
  grid: number[],
  cols: number,
  rows: number,
  gen: () => number,
  mask: ColumnMask = {}
): number {
  let made = 0;
  for (let c = 0; c < cols; c++) {
    const segs = columnSegments(cols, rows, c, mask);
    const top = segs[segs.length - 1];
    if (!top || !top.open) continue;
    for (const r of top.rows) {
      const i = r * cols + c;
      if (grid[i] === EMPTY) {
        grid[i] = gen();
        made++;
      }
    }
  }
  return made;
}

/** 盘面上还有没有空洞（挡板底下的空洞不算，那是设计好的） */
export function holesOn(grid: number[], cols: number, rows: number, mask: ColumnMask = {}): number {
  let n = 0;
  for (let c = 0; c < cols; c++) {
    const segs = columnSegments(cols, rows, c, mask);
    const top = segs[segs.length - 1];
    if (!top || !top.open) continue;
    for (const r of top.rows) if (grid[r * cols + c] === EMPTY) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// 特殊块：4 连火箭、5 连彩虹、L/T 炸弹
// ---------------------------------------------------------------------------

export interface Run {
  cells: number[];
  horizontal: boolean;
}

/** 找出所有长度 ≥ 3 的极大连段（横的竖的都要） */
export function runsOn(g: number[], cols: number, rows: number): Run[] {
  const out: Run[] = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const v = g[r * cols + c];
      let end = c;
      while (end + 1 < cols && g[r * cols + end + 1] === v) end++;
      if (v >= 0 && end - c + 1 >= 3) {
        const cells: number[] = [];
        for (let x = c; x <= end; x++) cells.push(r * cols + x);
        out.push({ cells, horizontal: true });
      }
      c = end + 1;
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const v = g[r * cols + c];
      let end = r;
      while (end + 1 < rows && g[(end + 1) * cols + c] === v) end++;
      if (v >= 0 && end - r + 1 >= 3) {
        const cells: number[] = [];
        for (let y = r; y <= end; y++) cells.push(y * cols + c);
        out.push({ cells, horizontal: false });
      }
      r = end + 1;
    }
  }
  return out;
}

export type Reward = "none" | "rainbow" | "rocketH" | "rocketV" | "bomb";

/** 这一格该留下什么奖励：5 连彩虹 > L/T 炸弹 > 4 连火箭 */
export function rewardAt(runs: Run[], at: number): Reward {
  let hl = 0;
  let vl = 0;
  for (const run of runs) {
    if (!run.cells.includes(at)) continue;
    if (run.horizontal) hl = Math.max(hl, run.cells.length);
    else vl = Math.max(vl, run.cells.length);
  }
  if (hl >= 5 || vl >= 5) return "rainbow";
  if (hl >= 3 && vl >= 3) return "bomb";
  if (hl >= 4) return "rocketH";
  if (vl >= 4) return "rocketV";
  return "none";
}

/** 奖励对应的特殊块编号（彩虹不是特殊块，它是一种图案） */
export function specialOf(reward: Reward): Special {
  if (reward === "rocketH") return ROCKET_H;
  if (reward === "rocketV") return ROCKET_V;
  if (reward === "bomb") return BOMB;
  return PLAIN;
}

/** 一个特殊块引爆会波及哪些格子 */
export function blastCells(cols: number, rows: number, i: number, sp: number): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  if (sp === ROCKET_H) {
    for (let x = 0; x < cols; x++) out.push(r * cols + x);
  } else if (sp === ROCKET_V) {
    for (let y = 0; y < rows; y++) out.push(y * cols + c);
  } else if (sp === BOMB) {
    for (let y = Math.max(0, r - 1); y <= Math.min(rows - 1, r + 1); y++) {
      for (let x = Math.max(0, c - 1); x <= Math.min(cols - 1, c + 1); x++) out.push(y * cols + x);
    }
  }
  return out;
}

/**
 * 这一轮被清掉的格子里如果压着特殊块，就要再炸一圈——**返回的是下一波**，
 * 由调用方排进时间线的下一段，绝不在一次 render 里连炸到底。
 */
export function nextBlastWave(s: Cellset, cleared: Iterable<number>, done: Set<number>): Set<number> {
  const wave = new Set<number>();
  for (const i of cleared) {
    const sp = s.special[i];
    if (!sp) continue;
    for (const j of blastCells(s.cols, s.rows, i, sp)) {
      if (done.has(j) || wave.has(j)) continue;
      if (s.grid[j] === EMPTY && !s.special[j]) continue;
      wave.add(j);
    }
  }
  return wave;
}

/**
 * 传送带：把一串格子里的图案循环平移一格（`dir` 为 1 往右 / 往后）。
 * 只挪内容不挪机关，卡住的格子本来就没进 `slots`。
 */
export function rotateSlots(grid: number[], special: number[], slots: number[], dir: 1 | -1): void {
  if (slots.length < 2) return;
  const vals = slots.map((i) => grid[i]);
  const sps = slots.map((i) => special[i]);
  const n = slots.length;
  const step = dir >= 0 ? 1 : -1;
  slots.forEach((i, k) => {
    const from = ((k - step) % n + n) % n;
    grid[i] = vals[from];
    special[i] = sps[from];
  });
}

/** 彩虹星和谁换，就把全场那种图案一起点名 */
export function rainbowTargetsOn(s: Cellset, a: number, b: number, fallback: number): Set<number> {
  const other = s.grid[a] === RAINBOW ? s.grid[b] : s.grid[a];
  const target = other === RAINBOW ? fallback : other;
  const set = new Set<number>([a, b]);
  for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === target) set.add(i);
  return set;
}

export function adjacentOn(cols: number, a: number, b: number): boolean {
  const ra = Math.floor(a / cols), ca = a % cols;
  const rb = Math.floor(b / cols), cb = b % cols;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

/** 列出所有「换了就能消」的相邻交换（特殊块与彩虹星一律算合法） */
export function legalSwapsOn(s: Cellset): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const locked = (i: number): boolean => s.fixed[i] || s.solid[i] || s.grid[i] === EMPTY;
  for (let i = 0; i < s.grid.length; i++) {
    if (locked(i)) continue;
    const c = i % s.cols;
    const cands = [c < s.cols - 1 ? i + 1 : -1, i + s.cols < s.grid.length ? i + s.cols : -1];
    for (const j of cands) {
      if (j < 0 || locked(j)) continue;
      if (s.grid[i] === RAINBOW || s.grid[j] === RAINBOW || s.special[i] || s.special[j]) {
        out.push([i, j]);
        continue;
      }
      [s.grid[i], s.grid[j]] = [s.grid[j], s.grid[i]];
      const ok = matchesAtOn(s.grid, s.cols, s.rows, i) || matchesAtOn(s.grid, s.cols, s.rows, j);
      [s.grid[i], s.grid[j]] = [s.grid[j], s.grid[i]];
      if (ok) out.push([i, j]);
    }
  }
  return out;
}

/**
 * 死局救场：一步都消不动的时候，把还能动的格子重洗一遍，
 * 洗到「盘上没有现成的三连、又至少有一步能消」为止。
 *
 * 洗成功返回 true；洗不出来（能动的格子太少之类）就原样放回去、返回 false。
 * 洗牌不改任何规则，只是重排既有图案——图案的种类和数量一颗都没变。
 */
export function shuffleOn(s: Cellset, rand: () => number, tries = 80): boolean {
  const spots: number[] = [];
  for (let i = 0; i < s.grid.length; i++) {
    if (!s.fixed[i] && !s.solid[i] && s.grid[i] !== EMPTY) spots.push(i);
  }
  if (spots.length < 3) return false;
  const grid0 = spots.map((i) => s.grid[i]);
  const sp0 = spots.map((i) => s.special[i]);
  for (let t = 0; t < tries; t++) {
    const g = grid0.slice();
    const sp = sp0.slice();
    for (let k = g.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [g[k], g[j]] = [g[j], g[k]];
      [sp[k], sp[j]] = [sp[j], sp[k]];
    }
    spots.forEach((at, k) => {
      s.grid[at] = g[k];
      s.special[at] = sp[k];
    });
    if (findMatchesOn(s.grid, s.cols, s.rows).size === 0 && legalSwapsOn(s).length > 0) return true;
  }
  spots.forEach((at, k) => {
    s.grid[at] = grid0[k];
    s.special[at] = sp0[k];
  });
  return false;
}

/**
 * 洗牌之后说的话。洗成功了要说一声（不然孩子会以为盘面自己乱跳），
 * **洗不出来更要说** —— 以前这一条是静默的：一步都消不动、盘面也没变、
 * 屏幕上一个字都没有，孩子只能一直点到步数耗光。
 */
export function shuffleLine(ok: boolean): string {
  return ok
    ? "一步都消不动啦～重新洗了一次牌，接着来！"
    : "这一盘实在挪不开了～按「重来」换一盘新的吧，不算你的错！";
}
