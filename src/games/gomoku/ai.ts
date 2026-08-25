// 五子棋纯逻辑：棋盘、胜负判定、禁手、两档 AI。不依赖 DOM，可单元测试。

/** 1 = 黑棋，2 = 白棋 */
export type Player = 1 | 2;

export interface Board {
  size: number;
  /** 0 空 1 黑 2 白，按 y*size+x 存 */
  cells: Uint8Array;
}

export type Difficulty = "easy" | "normal" | "smart";

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

/** 评估 p 落在 (x,y) 的价值（进攻分）。分越高越想下。 */
export function evaluatePoint(b: Board, x: number, y: number, p: Player): number {
  if (getCell(b, x, y) !== 0) return -1;
  let fives = 0;
  let liveFours = 0;
  let rushFours = 0;
  let liveThrees = 0;
  let sleepThrees = 0;
  let liveTwos = 0;
  for (const [dx, dy] of DIRS) {
    const pat = analyzeWindow(lineWindow(b, x, y, dx, dy, p));
    if (pat.five) fives++;
    if (pat.liveFour) liveFours++;
    else if (pat.fourDots > 0) rushFours++;
    if (pat.liveThree) liveThrees++;
    else if (pat.sleepThree) sleepThrees++;
    if (pat.liveTwo) liveTwos++;
  }
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

/**
 * AI 选点。
 * - smart：两层搜索（见 smartMove），最强。
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
