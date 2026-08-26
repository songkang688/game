// 五子棋纯逻辑：棋盘、胜负判定、禁手、四档 AI。不依赖 DOM，可单元测试。

/** 1 = 黑棋，2 = 白棋 */
export type Player = 1 | 2;

export interface Board {
  size: number;
  /** 0 空 1 黑 2 白，按 y*size+x 存 */
  cells: Uint8Array;
}

export type Difficulty = "easy" | "normal" | "smart" | "master";

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
  const marks = new Set<number>();
  let hasStone = false;
  for (let y = 0; y < b.size; y++) {
    for (let x = 0; x < b.size; x++) {
      if (b.cells[y * b.size + x] === 0) continue;
      hasStone = true;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
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

/**
 * AI 选点。
 * - master：算杀 + 三层前瞻（见 masterMove），最强。
 * - smart：两层搜索（见 smartMove）。
 * - normal：永远抓住成五机会、必挡对方成五，评分带 0.9 防守权重
 *   （活三/冲四威胁都会被看见并处理）。
 * - easy：会漏——60% 概率才挡对方的成五，防守权重也低，
 *   且从前三名里随机挑一个。
 * rng 传入便于测试（默认 Math.random）。
 */
export function bestMove(
  b: Board,
  me: Player,
  difficulty: Difficulty,
  rng: () => number = Math.random
): { x: number; y: number } | null {
  if (difficulty === "master") return masterMove(b, me, rng);
  if (difficulty === "smart") return smartMove(b, me, rng);
  const cands = candidateMoves(b);
  if (cands.length === 0) return null;
  const opp = other(me);

  const myWin = cands.find(([x, y]) => makesFive(b, x, y, me));
  const oppWin = cands.find(([x, y]) => makesFive(b, x, y, opp));
  if (difficulty === "normal") {
    if (myWin) return { x: myWin[0], y: myWin[1] };
    if (oppWin) return { x: oppWin[0], y: oppWin[1] };
  } else {
    if (myWin && rng() < 0.85) return { x: myWin[0], y: myWin[1] };
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
