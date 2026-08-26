// 解局求解器：判断「黑棋先行、N 手之内强制取胜」，并把**首手解集**完整枚举出来。
//
// 强制胜的定义与 1.1 的残局验证测试完全一致，一个字都没放宽：
//  · 黑棋每一手都必须造出「下一手就成五」的威胁（冲四 / 活四 / 双杀），
//    随便下一手安静棋不算数；
//  · 白棋可以挑任意一个威胁点去挡，黑棋必须**对白棋的每一种挡法**都赢；
//  · 白棋自己能成五的分支一律判黑棋失败。
// 这套定义只会低估、不会高估黑棋（真的算出 true 就一定赢得了），
// 所以拿它验证棋谜是安全的。
//
// 这里比测试里那份朴素实现多了三样东西：置换表、着法排序、禁手开关，
// 于是 89 道新残局的「解集断言」跑得起来。

import {
  type Board,
  type Player,
  candidateMoves,
  findWinLine,
  forcingMoves,
  getCell,
  hashBoard,
  inBoard,
  isForbidden,
  makesFive,
  setCell,
} from "./ai";

export interface SolveOptions {
  /** 打开后黑棋不许走三三 / 四四 / 长连（成五那一手除外，五连优先） */
  forbidden?: boolean;
}

const DIRS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** p 方「再下一手就成五」的所有点 */
export function fiveSpots(b: Board, p: Player): Array<[number, number]> {
  return candidateMoves(b).filter(([x, y]) => makesFive(b, x, y, p));
}

/** 黑棋这一手在当前规则下能不能走 */
function blackCanPlay(b: Board, x: number, y: number, forbidden: boolean): boolean {
  if (!forbidden) return true;
  return !isForbidden(b, x, y).forbidden;
}

/** 先冲四、再其它：命中率高的着法排前面，置换表才有得剪 */
function orderedBlackMoves(b: Board, forbidden: boolean): Array<[number, number]> {
  const forcing = forcingMoves(b, 1);
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (const m of forcing) {
    const key = `${m.x},${m.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!blackCanPlay(b, m.x, m.y, forbidden)) continue;
    out.push([m.x, m.y]);
  }
  return out;
}

function memoKey(b: Board, movesLeft: number, forbidden: boolean): number {
  const { hi, lo } = hashBoard(b);
  return (hi * 67108864 + lo) * 16 + movesLeft * 2 + (forbidden ? 1 : 0);
}

function solve(b: Board, movesLeft: number, forbidden: boolean, memo: Map<number, boolean>): boolean {
  if (candidateMoves(b).some(([x, y]) => makesFive(b, x, y, 1))) return true;
  if (movesLeft <= 1) return false;
  const key = memoKey(b, movesLeft, forbidden);
  const hit = memo.get(key);
  if (hit !== undefined) return hit;

  let win = false;
  for (const [x, y] of orderedBlackMoves(b, forbidden)) {
    setCell(b, x, y, 1);
    let ok = false;
    const threats = fiveSpots(b, 1);
    if (threats.length > 0 && fiveSpots(b, 2).length === 0) {
      ok = true;
      for (const [wx, wy] of threats) {
        setCell(b, wx, wy, 2);
        const r = solve(b, movesLeft - 1, forbidden, memo);
        setCell(b, wx, wy, 0);
        if (!r) {
          ok = false;
          break;
        }
      }
    }
    setCell(b, x, y, 0);
    if (ok) {
      win = true;
      break;
    }
  }
  memo.set(key, win);
  return win;
}

/** 黑棋能不能在 movesLeft 手之内强制取胜 */
export function isForcedWin(b: Board, movesLeft: number, opts: SolveOptions = {}): boolean {
  return solve(b, movesLeft, opts.forbidden ?? false, new Map());
}

/** 最少要几手才能强制取胜；maxDepth 之内解不开返回 0 */
export function minWinDepth(b: Board, maxDepth: number, opts: SolveOptions = {}): number {
  for (let d = 1; d <= maxDepth; d++) {
    if (isForcedWin(b, d, opts)) return d;
  }
  return 0;
}

/**
 * 首手解集：所有「下这一手仍然保持 movesLeft 手内必胜」的点，按坐标排序。
 * 解集长度 1 就是「唯一胜点」，长度 >1 也必须是明确的一小撮，
 * 绝不能出现「随便下一手也能过」。
 */
export function winningFirstMoves(
  b: Board,
  movesLeft: number,
  opts: SolveOptions = {}
): Array<[number, number]> {
  const forbidden = opts.forbidden ?? false;
  const memo = new Map<number, boolean>();
  const out: Array<[number, number]> = [];
  for (const [x, y] of candidateMoves(b)) {
    if (!blackCanPlay(b, x, y, forbidden)) continue;
    if (makesFive(b, x, y, 1)) {
      out.push([x, y]);
      continue;
    }
    if (movesLeft <= 1) continue;
    setCell(b, x, y, 1);
    let ok = false;
    const threats = fiveSpots(b, 1);
    if (threats.length > 0 && fiveSpots(b, 2).length === 0) {
      ok = true;
      for (const [wx, wy] of threats) {
        setCell(b, wx, wy, 2);
        const r = solve(b, movesLeft - 1, forbidden, memo);
        setCell(b, wx, wy, 0);
        if (!r) {
          ok = false;
          break;
        }
      }
    }
    setCell(b, x, y, 0);
    if (ok) out.push([x, y]);
  }
  return out.sort((a, c) => a[0] - c[0] || a[1] - c[1]);
}

/**
 * 主变（黑棋的着法序列）：白棋每次挡自己排第一的那个威胁点。
 * 只用来给「弃子」判定和攻略提示找线索，不作为唯一解。
 */
export function solutionLine(
  b: Board,
  movesLeft: number,
  opts: SolveOptions = {}
): Array<[number, number]> | null {
  const forbidden = opts.forbidden ?? false;
  const first = winningFirstMoves(b, movesLeft, opts)[0];
  if (!first) return null;
  const line: Array<[number, number]> = [first];
  setCell(b, first[0], first[1], 1);
  try {
    if (candidateMoves(b).some(([x, y]) => makesFive(b, x, y, 1)) && movesLeft === 1) return line;
    const threats = fiveSpots(b, 1);
    if (threats.length === 0 || movesLeft <= 1) return line;
    const [wx, wy] = threats[0];
    setCell(b, wx, wy, 2);
    try {
      const rest = solutionLine(b, movesLeft - 1, opts);
      if (rest) line.push(...rest);
    } finally {
      setCell(b, wx, wy, 0);
    }
  } finally {
    setCell(b, first[0], first[1], 0);
  }
  void forbidden;
  return line;
}

/** 这颗子还有没有用：包含它的每条 5 格窗口都被对方占了一格，就是废子 */
export function deadStone(b: Board, x: number, y: number): boolean {
  const p = getCell(b, x, y);
  if (p !== 1 && p !== 2) return true;
  const opp = p === 1 ? 2 : 1;
  for (const [dx, dy] of DIRS) {
    for (let off = -4; off <= 0; off++) {
      let alive = true;
      for (let i = 0; i < 5; i++) {
        const cx = x + dx * (off + i);
        const cy = y + dy * (off + i);
        if (!inBoard(b, cx, cy) || getCell(b, cx, cy) === opp) {
          alive = false;
          break;
        }
      }
      if (alive) return false;
    }
  }
  return true;
}

/**
 * 弃子引杀：沿主变走完整条杀法，首手那颗子**没有出现在最后的五连里**。
 * 也就是说它只负责逼白棋挡在某个位置，自己一分不占——这就是「弃子」。
 * 主变里白棋每次都挡排第一的那个威胁点，所以结论是确定的、可复现的。
 */
export function isDecoyFirstMove(
  b: Board,
  movesLeft: number,
  first: [number, number],
  opts: SolveOptions = {}
): boolean {
  const [fx, fy] = first;
  if (getCell(b, fx, fy) !== 0) return false;
  if (makesFive(b, fx, fy, 1)) return false;
  const placed: Array<[number, number]> = [];
  let cur = first;
  let left = movesLeft;
  let decoy = false;
  try {
    while (left > 0) {
      setCell(b, cur[0], cur[1], 1);
      placed.push(cur);
      const line = findWinLine(b, cur[0], cur[1]);
      if (line) {
        decoy = !line.some(([x, y]) => x === fx && y === fy);
        break;
      }
      const threats = fiveSpots(b, 1);
      if (threats.length === 0) break;
      const [wx, wy] = threats[0];
      setCell(b, wx, wy, 2);
      placed.push([wx, wy]);
      left--;
      const next = winningFirstMoves(b, left, opts)[0];
      if (!next) break;
      cur = next;
    }
  } finally {
    for (const [x, y] of placed) setCell(b, x, y, 0);
  }
  return decoy;
}
