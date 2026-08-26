// 五子棋纯逻辑：棋盘、胜负判定、禁手、六档 AI。不依赖 DOM，可单元测试。

/** 1 = 黑棋，2 = 白棋 */
export type Player = 1 | 2;

export interface Board {
  size: number;
  /** 0 空 1 黑 2 白，按 y*size+x 存 */
  cells: Uint8Array;
}

/**
 * 六个难度档（1.2 起）。中间四档是 1.0/1.1 就有的，中文名与行为都不动；
 * 首尾两档是 1.2 补的：novice「菜鸟」把梯度接到零起点，hell「地狱」封顶。
 */
export type Difficulty = "novice" | "easy" | "normal" | "smart" | "master" | "hell";

/** 从弱到强，连胜挑战与档位选择器都按这个顺序 */
export const DIFFICULTIES: readonly Difficulty[] = [
  "novice",
  "easy",
  "normal",
  "smart",
  "master",
  "hell",
];

const DIRS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

export function makeBoard(size: number): Board {
  return { size, cells: new Uint8Array(size * size) };
}

export function inBoard(b: Board, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < b.size && y < b.size;
}

export function getCell(b: Board, x: number, y: number): number {
  if (!inBoard(b, x, y)) return -1;
  return b.cells[y * b.size + x];
}

export function setCell(b: Board, x: number, y: number, v: number): void {
  b.cells[y * b.size + x] = v;
}

export function other(p: Player): Player {
  return p === 1 ? 2 : 1;
}

export function boardFull(b: Board): boolean {
  return !b.cells.includes(0);
}

/**
 * 以 (x,y) 为中心检查刚落的子有没有连成 ≥5，
 * 返回整条连线的格子坐标（长连也全部返回），没有则 null。
 */
export function findWinLine(
  b: Board,
  x: number,
  y: number
): Array<[number, number]> | null {
  const p = getCell(b, x, y);
  if (p !== 1 && p !== 2) return null;
  for (const [dx, dy] of DIRS) {
    const line: Array<[number, number]> = [[x, y]];
    for (let i = 1; i < b.size; i++) {
      if (getCell(b, x + dx * i, y + dy * i) !== p) break;
      line.push([x + dx * i, y + dy * i]);
    }
    for (let i = 1; i < b.size; i++) {
      if (getCell(b, x - dx * i, y - dy * i) !== p) break;
      line.unshift([x - dx * i, y - dy * i]);
    }
    if (line.length >= 5) return line;
  }
  return null;
}

/** 假设 p 落在 (x,y)，是否立刻连成 ≥5。 */
export function makesFive(b: Board, x: number, y: number, p: Player): boolean {
  if (getCell(b, x, y) !== 0) return false;
  for (const [dx, dy] of DIRS) {
    let count = 1;
    for (let i = 1; i < 5; i++) {
      if (getCell(b, x + dx * i, y + dy * i) !== p) break;
      count++;
    }
    for (let i = 1; i < 5; i++) {
      if (getCell(b, x - dx * i, y - dy * i) !== p) break;
      count++;
    }
    if (count >= 5) return true;
  }
  return false;
}

/**
 * 取以 (x,y) 为中心、方向 (dx,dy) 的 9 格窗口字符串。
 * 'x' = 我方（(x,y) 处假设已落子），'o' = 对方或墙，'.' = 空。
 */
export function lineWindow(
  b: Board,
  x: number,
  y: number,
  dx: number,
  dy: number,
  p: Player
): string {
  let s = "";
  for (let i = -4; i <= 4; i++) {
    if (i === 0) {
      s += "x";
      continue;
    }
    const c = getCell(b, x + dx * i, y + dy * i);
    if (c === 0) s += ".";
    else if (c === p) s += "x";
    else s += "o";
  }
  return s;
}

interface DirPatterns {
  five: boolean;
  /** 有几个空点填上就能成五（≥2 相当于活四强度） */
  fourDots: number;
  liveFour: boolean;
  liveThree: boolean;
  sleepThree: boolean;
  liveTwo: boolean;
}

/** 分析一个方向窗口里的棋型。 */
export function analyzeWindow(s: string): DirPatterns {
  const res: DirPatterns = {
    five: s.includes("xxxxx"),
    fourDots: 0,
    liveFour: s.includes(".xxxx."),
    liveThree: false,
    sleepThree: false,
    liveTwo: false,
  };
  // 数一数：哪些空点填上 x 后出现五连
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== ".") continue;
    const t = s.slice(0, i) + "x" + s.slice(i + 1);
    if (t.includes("xxxxx")) res.fourDots++;
  }
  // 活三：还能长成活四的三
  res.liveThree =
    s.includes("..xxx.") ||
    s.includes(".xxx..") ||
    s.includes(".x.xx.") ||
    s.includes(".xx.x.");
  if (!res.liveThree && res.fourDots === 0) {
    // 眠三：五格窗口里有 3 个 x、2 个空（被挡住一头的三）
    for (let i = 0; i + 5 <= s.length; i++) {
      const w = s.slice(i, i + 5);
      let xs = 0;
      let dots = 0;
      for (const ch of w) {
        if (ch === "x") xs++;
        else if (ch === ".") dots++;
      }
      if (xs === 3 && dots === 2) {
        res.sleepThree = true;
        break;
      }
    }
  }
  res.liveTwo = s.includes("..xx..") || s.includes(".x.x.") || s.includes(".xx.");
  return res;
}

interface PointShapes {
  fives: number;
  liveFours: number;
  rushFours: number;
  liveThrees: number;
  sleepThrees: number;
  liveTwos: number;
}

/** 数一数 p 落在 (x,y) 后四个方向上各出现了什么棋型。 */
function countShapes(b: Board, x: number, y: number, p: Player): PointShapes {
  const s: PointShapes = {
    fives: 0,
    liveFours: 0,
    rushFours: 0,
    liveThrees: 0,
    sleepThrees: 0,
    liveTwos: 0,
  };
  for (const [dx, dy] of DIRS) {
    const pat = analyzeWindow(lineWindow(b, x, y, dx, dy, p));
    if (pat.five) s.fives++;
    if (pat.liveFour) s.liveFours++;
    else if (pat.fourDots > 0) s.rushFours++;
    if (pat.liveThree) s.liveThrees++;
    else if (pat.sleepThree) s.sleepThrees++;
    if (pat.liveTwo) s.liveTwos++;
  }
  return s;
}

/** 评估 p 落在 (x,y) 的价值（进攻分）。分越高越想下。 */
export function evaluatePoint(b: Board, x: number, y: number, p: Player): number {
  if (getCell(b, x, y) !== 0) return -1;
  const { fives, liveFours, rushFours, liveThrees, sleepThrees, liveTwos } =
    countShapes(b, x, y, p);
  if (fives > 0) return 10_000_000;
  if (liveFours > 0) return 1_000_000;
  let tier = 0;
  if (rushFours >= 2) tier = 500_000; // 双冲四
  else if (rushFours >= 1 && liveThrees >= 1) tier = 400_000; // 冲四活三
  else if (liveThrees >= 2) tier = 200_000; // 双活三
  const base =
    rushFours * 30_000 +
    liveThrees * 20_000 +
    sleepThrees * 1_200 +
    liveTwos * 500;
  // 靠中间一点点加分，让开局别下到边上
  const mid = (b.size - 1) / 2;
  const centrality = (b.size - Math.abs(x - mid) - Math.abs(y - mid)) * 3;
  return tier + base + centrality;
}

/**
 * 大师档专用的落点评估。棋型分档跟 evaluatePoint 一样，
 * 但单纯的冲四几乎不加分——冲四只逼对手挡一手，挡完这条线就废了，
 * 白白浪费一步棋。真正值钱的是活三、双三这种留得住的威胁；
 * 而「冲四能连成杀」是算杀（VCF / VCT）负责的事，轮不到这里凑分。
 */
export function evaluateMaster(b: Board, x: number, y: number, p: Player): number {
  if (getCell(b, x, y) !== 0) return -1;
  const { fives, liveFours, rushFours, liveThrees, sleepThrees, liveTwos } =
    countShapes(b, x, y, p);
  if (fives > 0) return 10_000_000;
  if (liveFours > 0) return 1_000_000;
  let tier = 0;
  if (rushFours >= 2) tier = 500_000;
  else if (rushFours >= 1 && liveThrees >= 1) tier = 400_000;
  else if (liveThrees >= 2) tier = 200_000;
  const base =
    rushFours * 2_000 +
    liveThrees * 20_000 +
    sleepThrees * 1_500 +
    liveTwos * 900;
  const mid = (b.size - 1) / 2;
  const centrality = (b.size - Math.abs(x - mid) - Math.abs(y - mid)) * 3;
  return tier + base + centrality;
}

/** 黑棋禁手判定（长连 / 双四 / 双三）。白棋永远不禁。 */
export function isForbidden(
  b: Board,
  x: number,
  y: number
): { forbidden: boolean; reason: string } {
  if (getCell(b, x, y) !== 0) return { forbidden: false, reason: "" };
  setCell(b, x, y, 1);
  try {
    // 成五优先：正好五连就是赢，不算禁手
    let exactFive = false;
    let overline = false;
    for (const [dx, dy] of DIRS) {
      let count = 1;
      for (let i = 1; i < 7; i++) {
        if (getCell(b, x + dx * i, y + dy * i) !== 1) break;
        count++;
      }
      for (let i = 1; i < 7; i++) {
        if (getCell(b, x - dx * i, y - dy * i) !== 1) break;
        count++;
      }
      if (count === 5) exactFive = true;
      if (count >= 6) overline = true;
    }
    if (exactFive) return { forbidden: false, reason: "" };
    if (overline) return { forbidden: true, reason: "长连禁手" };

    let fours = 0;
    let liveThrees = 0;
    for (const [dx, dy] of DIRS) {
      const pat = analyzeWindow(lineWindow(b, x, y, dx, dy, 1));
      if (pat.liveFour || pat.fourDots > 0) fours++;
      else if (pat.liveThree) liveThrees++;
    }
    if (fours >= 2) return { forbidden: true, reason: "双四禁手" };
    if (liveThrees >= 2) return { forbidden: true, reason: "双三禁手" };
    return { forbidden: false, reason: "" };
  } finally {
    setCell(b, x, y, 0);
  }
}

/** 候选点：已有棋子周围 2 格内的空位；空棋盘给天元。 */
export function candidateMoves(b: Board): Array<[number, number]> {
  return candidateMovesR(b, 2);
}

/** 候选点（可指定半径）：深层搜索用半径 1 收窄分支，浅层用 2 看得全。 */
export function candidateMovesR(b: Board, radius: number): Array<[number, number]> {
  const marks = new Set<number>();
  let hasStone = false;
  for (let y = 0; y < b.size; y++) {
    for (let x = 0; x < b.size; x++) {
      if (b.cells[y * b.size + x] === 0) continue;
      hasStone = true;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (!inBoard(b, nx, ny)) continue;
          if (b.cells[ny * b.size + nx] !== 0) continue;
          marks.add(ny * b.size + nx);
        }
      }
    }
  }
  if (!hasStone) {
    const mid = Math.floor(b.size / 2);
    return [[mid, mid]];
  }
  return Array.from(marks, (i) => [i % b.size, Math.floor(i / b.size)]);
}

/**
 * 聪明档：两层搜索。
 * 先按"进攻分+防守分"初筛前 12 个点，然后对每个点假设落子，
 * 计算对手的最佳回应分值（含对手成五检查），
 * 总分 = 自身点分 + 0.95×防守分 − 0.6×对手最佳回应。
 * 这样活二/眠三/冲四的权重（见 evaluatePoint）在两层里都会生效，
 * 能提前一步看到"对手活三将变活四"之类的威胁。
 */
export function smartMove(
  b: Board,
  me: Player,
  rng: () => number = Math.random
): { x: number; y: number } | null {
  const cands = candidateMoves(b);
  if (cands.length === 0) return null;
  const opp = other(me);

  const myWin = cands.find(([x, y]) => makesFive(b, x, y, me));
  if (myWin) return { x: myWin[0], y: myWin[1] };
  const oppWin = cands.find(([x, y]) => makesFive(b, x, y, opp));
  if (oppWin) return { x: oppWin[0], y: oppWin[1] };

  const scored = cands.map(([x, y]) => ({
    x,
    y,
    base: evaluatePoint(b, x, y, me) + 0.95 * evaluatePoint(b, x, y, opp),
  }));
  scored.sort((a, c) => c.base - a.base);
  const top = scored.slice(0, 12);

  let best = top[0];
  let bestVal = -Infinity;
  for (const m of top) {
    setCell(b, m.x, m.y, me);
    // 对手的最佳回应分（对手成五 = 天文数字，等价于必输警告）
    let reply = 0;
    for (const [ox, oy] of candidateMoves(b)) {
      const v = evaluatePoint(b, ox, oy, opp);
      if (v > reply) reply = v;
      if (reply >= 10_000_000) break;
    }
    setCell(b, m.x, m.y, 0);
    const val = m.base - 0.6 * reply + rng() * 4;
    if (val > bestVal) {
      bestVal = val;
      best = m;
    }
  }
  return { x: best.x, y: best.y };
}

/* ---------------- 1.1 新增：大师档 ---------------- */
// 大师档比聪明档多两件武器：
// ① 连续冲四算杀（算到自己五步之内的强制胜，也算得到对手的）；
// ② 三层前瞻的评估（我落子 → 对手最佳应手 → 我的后续），
//    而不是聪明档的两层。

/** 一个落点在 p 眼里的威胁：能补成五的空点有几个 */
export interface ThreatInfo {
  x: number;
  y: number;
  /** 落子后 p 方多出几个「再下一手就成五」的点 */
  fiveSpots: number;
}

/**
 * p 方所有「落下去就形成四」的强迫手（对手不挡就成五）。
 * 按威胁点多少排序，双四 / 活四排在最前面。
 */
export function forcingMoves(b: Board, p: Player): ThreatInfo[] {
  const out: ThreatInfo[] = [];
  for (const [x, y] of candidateMoves(b)) {
    let dots = 0;
    let five = false;
    for (const [dx, dy] of DIRS) {
      const pat = analyzeWindow(lineWindow(b, x, y, dx, dy, p));
      if (pat.five) five = true;
      if (pat.liveFour) dots += 2;
      else dots += pat.fourDots;
    }
    if (five) out.push({ x, y, fiveSpots: 99 });
    else if (dots > 0) out.push({ x, y, fiveSpots: dots });
  }
  out.sort((a, c) => c.fiveSpots - a.fiveSpots);
  return out;
}

/** p 方「再下一手就成五」的所有点 */
function fiveSpotsOf(b: Board, p: Player): Array<[number, number]> {
  return candidateMoves(b).filter(([x, y]) => makesFive(b, x, y, p));
}

/**
 * 连续冲四算杀（VCF）：p 方只走冲四这种强迫手，
 * 对手每次都被迫去堵唯一的成五点，看能不能在 depth 手之内连成五。
 * 找到就返回杀棋的第一手，找不到返回 null。
 * 只走强迫手，所以分支很窄，深搜也很快。
 */
export function findVcf(
  b: Board,
  p: Player,
  depth: number
): { x: number; y: number } | null {
  const opp = other(p);
  const win = fiveSpotsOf(b, p)[0];
  if (win) return { x: win[0], y: win[1] };
  if (depth <= 1) return null;
  // 对手已经有成五点：我们又没法立刻成五，冲四来不及
  if (fiveSpotsOf(b, opp).length > 0) return null;

  let tried = 0;
  for (const m of forcingMoves(b, p)) {
    if (tried++ >= 10) break;
    setCell(b, m.x, m.y, p);
    const threats = fiveSpotsOf(b, p);
    let hit = false;
    if (threats.length >= 2) {
      // 活四 / 双四：对手只能堵一个，下一手必成五
      hit = true;
    } else if (threats.length === 1) {
      const [wx, wy] = threats[0];
      setCell(b, wx, wy, opp);
      hit = findVcf(b, p, depth - 1) !== null;
      setCell(b, wx, wy, 0);
    }
    setCell(b, m.x, m.y, 0);
    if (hit) return { x: m.x, y: m.y };
  }
  return null;
}

/**
 * p 方所有「威胁手」：冲四，或者能长成活四的活三。
 * 比 forcingMoves 多了活三，用来做连续威胁算杀（VCT）。
 */
export function threatMoves(b: Board, p: Player): ThreatInfo[] {
  const out: ThreatInfo[] = [];
  for (const [x, y] of candidateMoves(b)) {
    let dots = 0;
    let five = false;
    let threes = 0;
    for (const [dx, dy] of DIRS) {
      const pat = analyzeWindow(lineWindow(b, x, y, dx, dy, p));
      if (pat.five) five = true;
      if (pat.liveFour) dots += 2;
      else dots += pat.fourDots;
      if (pat.liveThree) threes++;
    }
    if (five) out.push({ x, y, fiveSpots: 99 });
    else if (dots > 0 || threes > 0) out.push({ x, y, fiveSpots: dots * 2 + threes });
  }
  out.sort((a, c) => c.fiveSpots - a.fiveSpots);
  return out;
}

/**
 * 连续威胁算杀（VCT）：比 VCF 多算活三这种威胁。
 * 对手的应手取「所有能拆掉我方威胁的点 + 对手自己的要害点」，
 * 全部挡法都挡不住才算杀成立。分支开得窄，够快也够准。
 */
export function findVct(
  b: Board,
  p: Player,
  depth: number
): { x: number; y: number } | null {
  const opp = other(p);
  const five = fiveSpotsOf(b, p)[0];
  if (five) return { x: five[0], y: five[1] };
  if (fiveSpotsOf(b, opp).length > 0) return null;
  const kp = killerPoints(b, p);
  if (kp.length > 0) return kp[0];
  if (depth <= 1) return null;
  // 对手手里已经有活四这种更快的招，活三级别的威胁逼不动他
  if (killerPoints(b, opp).length > 0) return null;

  let tried = 0;
  for (const m of threatMoves(b, p)) {
    if (tried++ >= 6) break;
    setCell(b, m.x, m.y, p);
    const defs = new Map<string, { x: number; y: number }>();
    for (const [dx, dy] of fiveSpotsOf(b, p)) defs.set(`${dx},${dy}`, { x: dx, y: dy });
    for (const d of killerPoints(b, p)) defs.set(`${d.x},${d.y}`, d);
    for (const d of hotPoints(b, opp).slice(0, 2)) defs.set(`${d.x},${d.y}`, d);
    let ok = defs.size > 0 && defs.size <= 6;
    if (ok) {
      for (const d of defs.values()) {
        if (getCell(b, d.x, d.y) !== 0) continue;
        setCell(b, d.x, d.y, opp);
        ok =
          fiveSpotsOf(b, opp).length === 0 && findVct(b, p, depth - 1) !== null;
        setCell(b, d.x, d.y, 0);
        if (!ok) break;
      }
    }
    setCell(b, m.x, m.y, 0);
    if (ok) return { x: m.x, y: m.y };
  }
  return null;
}

/** 三层前瞻打分：我落子 → 对手最佳应手 → 我的后续最佳手 */
function lookahead3(b: Board, me: Player, x: number, y: number): number {
  const opp = other(me);
  setCell(b, x, y, me);
  let worst = Infinity;
  const replies = candidateMoves(b)
    .map(([ox, oy]) => ({ ox, oy, v: evaluateMaster(b, ox, oy, opp) + 0.6 * evaluateMaster(b, ox, oy, me) }))
    .sort((a, c) => c.v - a.v)
    .slice(0, 5);
  for (const r of replies) {
    setCell(b, r.ox, r.oy, opp);
    let mine = 0;
    for (const [fx, fy] of candidateMoves(b)) {
      const v = evaluateMaster(b, fx, fy, me);
      if (v > mine) mine = v;
      if (mine >= 10_000_000) break;
    }
    setCell(b, r.ox, r.oy, 0);
    const val = mine - 1.05 * evaluateMaster(b, r.ox, r.oy, opp);
    if (val < worst) worst = val;
  }
  setCell(b, x, y, 0);
  return worst === Infinity ? 0 : worst;
}

/**
 * p 方的「必杀点」：落下去就同时有两个以上成五点（活四或双四），
 * 对手只能堵一个，下一手必成五。活三长成活四的那一点也在里面。
 */
export function killerPoints(b: Board, p: Player): Array<{ x: number; y: number }> {
  return forcingMoves(b, p)
    .filter((f) => f.fiveSpots >= 2)
    .map((f) => ({ x: f.x, y: f.y }));
}

/**
 * p 方的「要害点」：落下去就是双活三 / 冲四活三 / 双冲四 / 活四 / 成五。
 * evaluatePoint 里这些棋型的分数都在 200000 以上，扫一遍就够。
 */
export function hotPoints(b: Board, p: Player): Array<{ x: number; y: number }> {
  return candidateMoves(b)
    .map(([x, y]) => ({ x, y, v: evaluatePoint(b, x, y, p) }))
    .filter((m) => m.v >= 200_000)
    .sort((a, c) => c.v - a.v)
    .map(({ x, y }) => ({ x, y }));
}

/** p 方是否已经握着赢定了的招（成五 / 活四 / 双三双四 / 连续冲四） */
function unstoppable(b: Board, p: Player): boolean {
  if (fiveSpotsOf(b, p).length > 0) return true;
  if (hotPoints(b, p).length > 0) return true;
  return findVcf(b, p, 4) !== null;
}

/**
 * 大师档：先算杀，再算被杀，都没有才用三层前瞻挑点。
 * ① 自己能成五 / 必须挡对手成五；
 * ② 自己有连续冲四的杀棋（最多 5 手）→ 直接走；
 * ③ 对手有必杀点或杀棋 → 在几个要害点里挑一个真能破掉的；
 * ④ 都没有 → 三层前瞻，兼顾进攻分与对手的最佳反击。
 */
export function masterMove(
  b: Board,
  me: Player,
  rng: () => number = Math.random
): { x: number; y: number } | null {
  const cands = candidateMoves(b);
  if (cands.length === 0) return null;
  const opp = other(me);

  const myWin = cands.find(([x, y]) => makesFive(b, x, y, me));
  if (myWin) return { x: myWin[0], y: myWin[1] };
  const oppWin = cands.find(([x, y]) => makesFive(b, x, y, opp));
  if (oppWin) return { x: oppWin[0], y: oppWin[1] };

  const kill = findVcf(b, me, 5);
  if (kill) return kill;

  const oppHot = hotPoints(b, opp).slice(0, 4);
  const oppVcf = findVcf(b, opp, 4);
  const oppVct = oppHot.length === 0 && !oppVcf ? findVct(b, opp, 2) : null;
  // 自己这边太平无事的时候才去找连续威胁的杀棋，免得只顾进攻被对手先杀
  if (oppHot.length === 0 && !oppVcf && !oppVct) {
    const vct = findVct(b, me, 3);
    if (vct) return vct;
  }
  if (oppHot.length > 0 || oppVcf || oppVct) {
    // 对手的要害点、我方自己的冲四，谁能真的把杀棋破掉就走谁
    const tries: Array<{ x: number; y: number }> = [];
    if (oppVcf) tries.push(oppVcf);
    if (oppVct) tries.push(oppVct);
    tries.push(...oppHot);
    // 除了直接占掉要害点，拆掉组成双三的某一条活三同样是解法
    const breakers = cands
      .map(([x, y]) => ({ x, y, v: evaluateMaster(b, x, y, opp) }))
      .sort((a, c) => c.v - a.v)
      .slice(0, 6);
    for (const d of breakers) tries.push({ x: d.x, y: d.y });
    for (const f of forcingMoves(b, me).slice(0, 4)) tries.push({ x: f.x, y: f.y });
    for (const t of tries) {
      if (getCell(b, t.x, t.y) !== 0) continue;
      setCell(b, t.x, t.y, me);
      const safe = !unstoppable(b, opp);
      setCell(b, t.x, t.y, 0);
      if (safe) return t;
    }
    return tries[0];
  }

  const scored = cands
    .map(([x, y]) => ({
      x,
      y,
      base: evaluateMaster(b, x, y, me) + 0.95 * evaluateMaster(b, x, y, opp),
    }))
    .sort((a, c) => c.base - a.base)
    .slice(0, 8);

  const ranked = scored
    .map((m) => ({ ...m, val: m.base + 0.75 * lookahead3(b, me, m.x, m.y) + rng() * 2 }))
    .sort((a, c) => c.val - a.val);

  // 最后一道保险：绝不主动把双三、活四或连续冲四的机会送到对手手里
  for (const m of ranked) {
    setCell(b, m.x, m.y, me);
    const safe = !unstoppable(b, opp);
    setCell(b, m.x, m.y, 0);
    if (safe) return { x: m.x, y: m.y };
  }
  return { x: ranked[0].x, y: ranked[0].y };
}

/* ---------------- 1.2 新增：菜鸟档 ---------------- */

/**
 * 菜鸟档（0 层，完全不搜索）：
 * 在已有棋子附近随便挑一个空点，只有 30% 的时候会想起来去挡对手的冲四，
 * **连自己能成五都常常看不见**——刚学会规则的小朋友就是这么下的。
 * 它存在的意义是让梯度从零开始：谁都能赢它一盘。
 */
export function noviceMove(
  b: Board,
  me: Player,
  rng: () => number = Math.random
): { x: number; y: number } | null {
  const cands = candidateMoves(b);
  if (cands.length === 0) return null;
  const opp = other(me);
  // 30%：会去堵对手「下一手就成五」的点（冲四），其余七成压根没看
  if (rng() < 0.3) {
    const block = cands.find(([x, y]) => makesFive(b, x, y, opp));
    if (block) return { x: block[0], y: block[1] };
  }
  const idx = Math.min(cands.length - 1, Math.max(0, Math.floor(rng() * cands.length)));
  return { x: cands[idx][0], y: cands[idx][1] };
}

/* ---------------- 1.2 新增：地狱档 ---------------- */
// 地狱档比大师档多三件东西：
// ① Zobrist 置换表：同一个局面在不同着法顺序下只算一次；
// ② 迭代加深 + 限时：算到时间用完为止，保证「想得越久越准」但绝不卡住 UI；
// ③ 禁手抓杀：禁手规则打开时，把黑棋的三三 / 四四 / 长连点当成非法着法，
//    于是「白棋冲四、黑棋唯一的挡点正好是禁手」这种杀法会被自动找出来。

/** 每格两个玩家各一把随机数（拆成高低两半，凑成 52 位内的整数 key） */
interface Zobrist {
  hi: Int32Array;
  lo: Int32Array;
}

function buildZobrist(cells: number): Zobrist {
  const hi = new Int32Array(cells * 2);
  const lo = new Int32Array(cells * 2);
  let s = 0x9e3779b9;
  const next = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
  for (let i = 0; i < cells * 2; i++) {
    hi[i] = next() & 0x3ffffff;
    lo[i] = next() & 0x3ffffff;
  }
  return { hi, lo };
}

const ZOBRIST_CACHE = new Map<number, Zobrist>();

function zobristOf(size: number): Zobrist {
  let z = ZOBRIST_CACHE.get(size);
  if (!z) {
    z = buildZobrist(size * size);
    ZOBRIST_CACHE.set(size, z);
  }
  return z;
}

/** 局面哈希（拆成两半的 26 位，合起来当 Map 的数字 key，不会丢精度） */
export function hashBoard(b: Board): { hi: number; lo: number } {
  const z = zobristOf(b.size);
  let hi = 0;
  let lo = 0;
  for (let i = 0; i < b.cells.length; i++) {
    const c = b.cells[i];
    if (c === 0) continue;
    const k = i * 2 + (c === 1 ? 0 : 1);
    hi ^= z.hi[k];
    lo ^= z.lo[k];
  }
  return { hi, lo };
}

function ttKey(hi: number, lo: number, depth: number, turn: Player): number {
  // hi/lo 各 26 位 → 52 位；再乘进层数与行棋方会超 2^53，所以拆成两级 Map 的复合 key
  return (hi * 67108864 + lo) * 16 + depth * 2 + (turn - 1);
}

/** 五连的分值上限；再减去层数，保证「早一步杀」优于「晚一步杀」 */
const WIN_SCORE = 1_000_000;

/** 深搜要推翻大师档给的那一手，至少得多出这么多分（约等于一个活二的价值） */
const SEARCH_OVERRIDE_MARGIN = 4000;

/** 一个 5 格窗口里 n 颗己方子（其余是空）值多少分 */
const WINDOW_SCORE = [0, 1, 14, 160, 1_800, 200_000];

/**
 * 整盘静态评分（只给搜索的叶子节点用，必须便宜）：
 * 四个方向扫所有长度 5 的窗口，窗口里只有一种颜色才算数，
 * 两头还空着的（活形）再翻 2.4 倍。
 */
export function boardScore(b: Board, p: Player): number {
  const n = b.size;
  const cells = b.cells;
  let total = 0;
  for (const [dx, dy] of DIRS) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const ex = x + dx * 4;
        const ey = y + dy * 4;
        if (ex < 0 || ey < 0 || ex >= n || ey >= n) continue;
        let mine = 0;
        let theirs = 0;
        for (let i = 0; i < 5; i++) {
          const c = cells[(y + dy * i) * n + (x + dx * i)];
          if (c === p) mine++;
          else if (c !== 0) theirs++;
        }
        if (theirs > 0 || mine === 0) continue;
        let sc = WINDOW_SCORE[mine];
        if (mine >= 2) {
          const before = getCell(b, x - dx, y - dy);
          const after = getCell(b, ex + dx, ey + dy);
          if (before === 0 && after === 0) sc = Math.round(sc * 2.4);
        }
        total += sc;
      }
    }
  }
  return total;
}

/** 从 p 的角度看这个局面值多少（自己的形 − 对手的形） */
export function evaluateBoard(b: Board, p: Player): number {
  return boardScore(b, p) - boardScore(b, other(p));
}

export interface HellOptions {
  /** 思考时间上限（毫秒），默认 350 */
  timeMs?: number;
  /** 最多算几层，默认 8（一般时间先用完） */
  maxDepth?: number;
  /** 禁手规则是否打开：打开后黑棋的三三 / 四四 / 长连点在搜索里就是非法着法 */
  forbidden?: boolean;
  /** 计时器（测试可注入） */
  now?: () => number;
  /** 优先搜索的一手（放在根节点第一个：剪枝更狠，而且它的分数一定是精确值） */
  prefer?: { x: number; y: number } | null;
}

export interface SearchResult {
  x: number;
  y: number;
  /** 真正算完的层数（迭代加深最后一次完整跑完的深度） */
  depth: number;
  /** 走到的节点数 */
  nodes: number;
  score: number;
  /** 最后一层里 prefer 那一手的分数（没传 prefer 就是 null） */
  preferScore: number | null;
}

interface TTEntry {
  value: number;
  /** 0 精确 1 下界 2 上界 */
  flag: number;
}

interface SearchCtx {
  deadline: number;
  now: () => number;
  tt: Map<number, TTEntry>;
  nodes: number;
  stopped: boolean;
  forbidden: boolean;
  root: Player;
}

/** 黑棋在禁手规则下不能走的点（白棋永远不受限） */
function illegalFor(b: Board, x: number, y: number, p: Player, forbidden: boolean): boolean {
  if (!forbidden || p !== 1) return false;
  return isForbidden(b, x, y).forbidden;
}

/**
 * 搜索用的着法生成：
 * ① 自己能成五 → 只留这一个；
 * ② 对手有成五点 → 只留挡点（顺带留下自己的冲四，四比挡快）；
 * ③ 否则按「进攻分 + 0.85×破坏分」排序取前 width 个。
 * 禁手规则下黑棋的禁手点在这里被直接筛掉，于是「唯一挡点是禁手」= 无路可走。
 */
function genMoves(
  b: Board,
  turn: Player,
  width: number,
  forbidden: boolean,
  radius = 2
): Array<[number, number]> {
  const opp = other(turn);
  const cands = candidateMovesR(b, radius);
  const legal = cands.filter(([x, y]) => !illegalFor(b, x, y, turn, forbidden));
  const win = legal.find(([x, y]) => makesFive(b, x, y, turn));
  if (win) return [win];
  const blocks = legal.filter(([x, y]) => makesFive(b, x, y, opp));
  if (blocks.length > 0) {
    const fours = forcingMoves(b, turn)
      .filter((m) => !illegalFor(b, m.x, m.y, turn, forbidden))
      .slice(0, 2)
      .map((m) => [m.x, m.y] as [number, number]);
    const seen = new Set(blocks.map(([x, y]) => `${x},${y}`));
    for (const f of fours) if (!seen.has(`${f[0]},${f[1]}`)) blocks.push(f);
    return blocks;
  }
  // 排序用大师档那套权重：单纯的冲四不值钱，活三、双三才留得住
  return legal
    .map(([x, y]) => ({
      x,
      y,
      v: evaluateMaster(b, x, y, turn) + 0.85 * evaluateMaster(b, x, y, opp),
    }))
    .sort((a, c) => c.v - a.v)
    .slice(0, width)
    .map((m) => [m.x, m.y] as [number, number]);
}

function negamax(
  b: Board,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
  turn: Player,
  hi: number,
  lo: number,
  ctx: SearchCtx
): number {
  if ((ctx.nodes++ & 31) === 0 && ctx.now() >= ctx.deadline) {
    ctx.stopped = true;
    return 0;
  }
  const key = ttKey(hi, lo, depth, turn);
  const hit = ctx.tt.get(key);
  if (hit) {
    if (hit.flag === 0) return hit.value;
    if (hit.flag === 1 && hit.value >= beta) return hit.value;
    if (hit.flag === 2 && hit.value <= alpha) return hit.value;
  }
  if (depth <= 0) {
    const v = evaluateBoard(b, turn);
    ctx.tt.set(key, { value: v, flag: 0 });
    return v;
  }

  const moves = genMoves(b, turn, depth >= 3 ? 8 : 6, ctx.forbidden, depth >= 3 ? 2 : 1);
  // 一个能走的点都没有：禁手规则下的黑棋被抓死了（唯一的挡点是禁手）
  if (moves.length === 0) return -(WIN_SCORE - ply);

  const z = zobristOf(b.size);
  let best = -Infinity;
  const a0 = alpha;
  for (const [x, y] of moves) {
    setCell(b, x, y, turn);
    const k = (y * b.size + x) * 2 + (turn === 1 ? 0 : 1);
    const nhi = hi ^ z.hi[k];
    const nlo = lo ^ z.lo[k];
    let value: number;
    if (findWinLine(b, x, y)) {
      value = WIN_SCORE - ply;
    } else if (boardFull(b)) {
      value = 0;
    } else {
      value = -negamax(b, depth - 1, ply + 1, -beta, -alpha, other(turn), nhi, nlo, ctx);
    }
    setCell(b, x, y, 0);
    if (ctx.stopped) return best === -Infinity ? 0 : best;
    if (value > best) best = value;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  ctx.tt.set(key, { value: best, flag: best <= a0 ? 2 : best >= beta ? 1 : 0 });
  return best;
}

/**
 * 地狱档的迭代加深搜索：从 2 层往上一层层加，时间一到就用上一层的结果。
 * 返回真正跑完的层数，测试靠它确认「至少 4 层」。
 */
export function hellSearch(b: Board, me: Player, opts: HellOptions = {}): SearchResult | null {
  const now = opts.now ?? (() => performance.now());
  const timeMs = opts.timeMs ?? 350;
  const maxDepth = opts.maxDepth ?? 8;
  const forbidden = opts.forbidden ?? false;
  const cands = candidateMoves(b);
  if (cands.length === 0) return null;

  const ctx: SearchCtx = {
    deadline: now() + timeMs,
    now,
    tt: new Map(),
    nodes: 0,
    stopped: false,
    forbidden,
    root: me,
  };
  const { hi, lo } = hashBoard(b);
  const z = zobristOf(b.size);
  let rootMoves = genMoves(b, me, 12, forbidden);
  if (rootMoves.length === 0) rootMoves = [[cands[0][0], cands[0][1]]];
  const prefer = opts.prefer ?? null;
  if (prefer && getCell(b, prefer.x, prefer.y) === 0) {
    rootMoves = [
      [prefer.x, prefer.y],
      ...rootMoves.filter(([x, y]) => x !== prefer.x || y !== prefer.y),
    ];
  }

  let best: SearchResult = {
    x: rootMoves[0][0],
    y: rootMoves[0][1],
    depth: 0,
    nodes: 0,
    score: 0,
    preferScore: null,
  };
  for (let depth = 2; depth <= maxDepth; depth++) {
    let localBest = -Infinity;
    let localMove = rootMoves[0];
    let alpha = -Infinity;
    let preferScore: number | null = null;
    for (const [x, y] of rootMoves) {
      setCell(b, x, y, me);
      const k = (y * b.size + x) * 2 + (me === 1 ? 0 : 1);
      let value: number;
      if (findWinLine(b, x, y)) {
        value = WIN_SCORE;
      } else if (boardFull(b)) {
        value = 0;
      } else {
        value = -negamax(
          b,
          depth - 1,
          1,
          -Infinity,
          -alpha,
          other(me),
          hi ^ z.hi[k],
          lo ^ z.lo[k],
          ctx
        );
      }
      setCell(b, x, y, 0);
      if (ctx.stopped) break;
      if (prefer && x === prefer.x && y === prefer.y) preferScore = value;
      if (value > localBest) {
        localBest = value;
        localMove = [x, y];
      }
      if (value > alpha) alpha = value;
    }
    if (ctx.stopped) break;
    best = {
      x: localMove[0],
      y: localMove[1],
      depth,
      nodes: ctx.nodes,
      score: localBest,
      preferScore,
    };
    // 把这一层的最佳着法提到最前面，下一层剪枝更狠
    rootMoves = [localMove, ...rootMoves.filter(([x, y]) => x !== localMove[0] || y !== localMove[1])];
    if (localBest >= WIN_SCORE - 32 || localBest <= -(WIN_SCORE - 32)) break;
    if (now() >= ctx.deadline) break;
  }
  best.nodes = ctx.nodes;
  return best;
}

/**
 * 禁手抓杀：白棋走一手冲四，黑棋唯一的挡点却是三三 / 四四 / 长连 —— 黑棋挡也不是、不挡也不是。
 * 只在禁手规则打开、且对手是黑棋时才有意义。找不到就返回 null。
 */
export function findForbiddenTrap(b: Board, me: Player): { x: number; y: number } | null {
  if (me !== 2) return null;
  if (fiveSpotsOf(b, 1).length > 0) return null;
  for (const m of forcingMoves(b, me)) {
    if (getCell(b, m.x, m.y) !== 0) continue;
    setCell(b, m.x, m.y, me);
    const threats = fiveSpotsOf(b, me);
    const trapped =
      threats.length > 0 &&
      threats.every(([x, y]) => isForbidden(b, x, y).forbidden) &&
      fiveSpotsOf(b, 1).length === 0;
    setCell(b, m.x, m.y, 0);
    if (trapped) return { x: m.x, y: m.y };
  }
  return null;
}

/**
 * 地狱档 = 大师档的全部战术判断 + 三件加料：
 * ① 算杀更深（VCF 7 手 / VCT 4 手，大师是 5 手 / 3 手）；
 * ② 禁手规则打开时会主动抓杀（对手唯一的挡点是禁手）；
 * ③ 局面平静、没有现成杀招时，用限时迭代加深搜索选点，而不是大师档的三层启发式。
 * 防守局面仍然交给大师档那套已经验证过的解法，所以地狱档不可能比大师档弱。
 */
export function hellMove(
  b: Board,
  me: Player,
  rng: () => number = Math.random,
  opts: HellOptions = {}
): { x: number; y: number } | null {
  const cands = candidateMoves(b);
  if (cands.length === 0) return null;
  const opp = other(me);

  const myWin = cands.find(([x, y]) => makesFive(b, x, y, me));
  if (myWin) return { x: myWin[0], y: myWin[1] };
  const oppWin = cands.find(([x, y]) => makesFive(b, x, y, opp));
  if (oppWin) return { x: oppWin[0], y: oppWin[1] };

  const kill = findVcf(b, me, 7);
  if (kill) return kill;
  if (opts.forbidden) {
    const trap = findForbiddenTrap(b, me);
    if (trap) return trap;
  }

  const oppHot = hotPoints(b, opp).slice(0, 4);
  const oppVcf = findVcf(b, opp, 5);
  const oppVct = oppHot.length === 0 && !oppVcf ? findVct(b, opp, 2) : null;
  if (oppHot.length > 0 || oppVcf || oppVct) {
    // 对手手里有活四 / 双三 / 连续冲四：先解掉，交给大师档的破杀逻辑
    return masterMove(b, me, rng);
  }
  const vct = findVct(b, me, 4);
  if (vct) return vct;

  // 平静局面：大师档先给一手，深搜只有「明显更好」时才敢改（否则搜索的粗评估会把好棋换成软棋）
  const fallback = masterMove(b, me, rng);
  const found = hellSearch(b, me, { ...opts, prefer: fallback });
  if (found && found.depth > 0 && (found.x !== fallback?.x || found.y !== fallback?.y)) {
    const beats =
      found.preferScore === null || found.score >= found.preferScore + SEARCH_OVERRIDE_MARGIN;
    if (beats) {
      setCell(b, found.x, found.y, me);
      const safe = !unstoppable(b, opp);
      setCell(b, found.x, found.y, 0);
      if (safe || found.score >= WIN_SCORE - 64) return { x: found.x, y: found.y };
    }
  }
  return fallback;
}

/* ---------------- 六档的展示信息 ---------------- */

/** 六档中文名：中间四档沿用 1.0/1.1 的叫法，一个字都没改 */
export const DIFFICULTY_NAME: Record<Difficulty, string> = {
  novice: "🐣 棋灵苗·菜鸟",
  easy: "🐱 棋灵喵·简单",
  normal: "🦊 棋灵狐·普通",
  smart: "🐲 棋灵龙·聪明",
  master: "🐘 棋灵象·大师",
  hell: "🌌 棋灵渊·地狱",
};

/** 一句话说明这档会干什么，选档时给孩子看 */
export const DIFFICULTY_BLURB: Record<Difficulty, string> = {
  novice: "刚学会规则，会乱下，也常常看不见自己能连成五",
  easy: "自己能成五一定会下，但十次里有四次忘了拦你",
  normal: "该成五就成五、该挡就挡，还会自己走活三",
  smart: "会算两层：你活四、双三的苗头它提前拆",
  master: "开局有套路，还会算五步的连续冲四杀招",
  hell: "算到时间用完为止，禁手规则一开就专门抓你的三三四四",
};

/** 各档大致搜索深度（层）。菜鸟真的是 0 层：不搜索 */
export const DIFFICULTY_DEPTH: Record<Difficulty, number> = {
  novice: 0,
  easy: 1,
  normal: 1,
  smart: 2,
  master: 3,
  hell: 4,
};

/**
 * 落子前的「思考」延时（毫秒）。地狱档硬性 ≥ 200ms：
 * 秒回的无敌对手会把孩子劝退，让它看起来在想。
 */
export const THINK_DELAY_MS: Record<Difficulty, number> = {
  novice: 300,
  easy: 420,
  normal: 480,
  smart: 520,
  master: 560,
  hell: 320,
};

/**
 * AI 选点。
 * - hell：迭代加深 + 置换表 + 禁手抓杀（见 hellMove），最强。
 * - master：算杀 + 三层前瞻（见 masterMove）。
 * - smart：两层搜索（见 smartMove）。
 * - normal：永远抓住成五机会、必挡对方成五，评分带 0.9 防守权重
 *   （活三/冲四威胁都会被看见并处理）。
 * - easy：必成五，但只有 60% 概率去挡对方的成五，防守权重也低，
 *   且从前三名里随机挑一个。
 * - novice：随机点，30% 才想起挡冲四（见 noviceMove）。
 * rng 传入便于测试（默认 Math.random）。
 */
export function bestMove(
  b: Board,
  me: Player,
  difficulty: Difficulty,
  rng: () => number = Math.random,
  opts: HellOptions = {}
): { x: number; y: number } | null {
  if (difficulty === "hell") return hellMove(b, me, rng, opts);
  if (difficulty === "master") return masterMove(b, me, rng);
  if (difficulty === "smart") return smartMove(b, me, rng);
  if (difficulty === "novice") return noviceMove(b, me, rng);
  const cands = candidateMoves(b);
  if (cands.length === 0) return null;
  const opp = other(me);

  const myWin = cands.find(([x, y]) => makesFive(b, x, y, me));
  const oppWin = cands.find(([x, y]) => makesFive(b, x, y, opp));
  if (difficulty === "normal") {
    if (myWin) return { x: myWin[0], y: myWin[1] };
    if (oppWin) return { x: oppWin[0], y: oppWin[1] };
  } else {
    // 简单档：自己能成五一定会下，但挡不挡看运气
    if (myWin) return { x: myWin[0], y: myWin[1] };
    if (oppWin && rng() < 0.6) return { x: oppWin[0], y: oppWin[1] };
  }

  const defenseW = difficulty === "normal" ? 0.9 : 0.35;
  const scored = cands.map(([x, y]) => ({
    x,
    y,
    score:
      evaluatePoint(b, x, y, me) +
      defenseW * evaluatePoint(b, x, y, opp) +
      rng() * 8,
  }));
  scored.sort((a, c) => c.score - a.score);

  if (difficulty === "easy" && scored.length > 1) {
    const r = rng();
    const idx = r < 0.55 ? 0 : r < 0.83 ? 1 : 2;
    const pick = scored[Math.min(idx, scored.length - 1)];
    return { x: pick.x, y: pick.y };
  }
  return { x: scored[0].x, y: scored[0].y };
}

/** 提示 = 用普通档 AI 帮当前玩家算一步。 */
export function hintMove(b: Board, p: Player): { x: number; y: number } | null {
  return bestMove(b, p, "normal", () => 0);
}
