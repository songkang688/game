/**
 * 拼图乐园的纯逻辑：三种板式的规则、打乱与还原、评星和结算文案。
 * 全是纯函数，不碰 DOM，方便单测直接把整关跑通。
 */
import type { PuzzleLevel } from "./levels";

export type BoardKind = "slide" | "rotate" | "fill";

/** 本关是哪种板式：不填 mode 就是 1.0 的推格子 */
export function boardKind(cfg: PuzzleLevel): BoardKind {
  return cfg.mode ?? "slide";
}

/** pos 的上下左右邻居（推格子用） */
export function neighborsOf(pos: number, rows: number, cols: number): number[] {
  const r = Math.floor(pos / cols);
  const c = pos % cols;
  const out: number[] = [];
  if (r > 0) out.push(pos - cols);
  if (r < rows - 1) out.push(pos + cols);
  if (c > 0) out.push(pos - 1);
  if (c < cols - 1) out.push(pos + 1);
  return out;
}

/** 推格子拼好了没有：每一格都摆着自己的号 */
export function isSolvedSlide(board: readonly number[]): boolean {
  return board.every((v, i) => v === i);
}

/**
 * 点一下 pos：挨着空格就换过去，返回是否真的动了。
 * 直接改传进来的 board（调用方自己决定要不要先复制一份）。
 */
export function slideClick(board: number[], pos: number, rows: number, cols: number): boolean {
  const empty = board.indexOf(board.length - 1);
  if (!neighborsOf(empty, rows, cols).includes(pos)) return false;
  [board[empty], board[pos]] = [board[pos], board[empty]];
  return true;
}

export interface ShuffledBoard {
  /** 打乱后的摆法 */
  board: number[];
  /** 照这个顺序一格一格点回去，一定能还原（打乱过程的逆序） */
  undo: number[];
}

/**
 * 从拼好的状态出发，随机走 steps 步合法移动来打乱（不走回头路）。
 * 顺手记下逆着走的点击顺序，所以这一关永远有解、而且解法是已知的。
 */
export function shuffleBoard(rows: number, cols: number, steps: number, rand: () => number): ShuffledBoard {
  const total = rows * cols;
  const board = Array.from({ length: total }, (_, i) => i);
  const emptyBefore: number[] = [];
  let prev = -1;
  for (let k = 0; k < steps || isSolvedSlide(board); k++) {
    const e = board.indexOf(total - 1);
    const opts = neighborsOf(e, rows, cols).filter((p) => p !== prev);
    const chosen = opts[Math.floor(rand() * opts.length)];
    [board[e], board[chosen]] = [board[chosen], board[e]];
    emptyBefore.push(e);
    prev = e;
    if (k > 500) break;
  }
  return { board, undo: emptyBefore.slice().reverse() };
}

/** 推格子的提示：挑一块推过去离家更近的（没有更好的就挑刚好归位的那块） */
export function bestSlideMove(board: readonly number[], rows: number, cols: number): number | undefined {
  const empty = board.indexOf(board.length - 1);
  const movable = neighborsOf(empty, rows, cols);
  const home = movable.find((p) => board[p] === empty);
  if (home !== undefined) return home;
  let best: number | undefined;
  let bestGain = -Infinity;
  for (const p of movable) {
    const v = board[p];
    const tr = Math.floor(v / cols);
    const tc = v % cols;
    const now = Math.abs(Math.floor(p / cols) - tr) + Math.abs((p % cols) - tc);
    const after = Math.abs(Math.floor(empty / cols) - tr) + Math.abs((empty % cols) - tc);
    if (now - after > bestGain) {
      bestGain = now - after;
      best = p;
    }
  }
  return best;
}

/** 步数评星：越省步星越多 */
export function starsFor(moves: number, cfg: PuzzleLevel): 1 | 2 | 3 {
  if (moves <= cfg.three) return 3;
  if (moves <= cfg.two) return 2;
  return 1;
}

/** 开局那句玩法说明 */
export function openingLine(cfg: PuzzleLevel): string {
  switch (boardKind(cfg)) {
    case "rotate":
      return "点一下转九十度，先挑朝向一眼看得出错的那几块转正！";
    case "fill":
      return "先点托盘里的一块，再点画上的缺口，比对缺口四周的花纹再放！";
    default:
      return cfg.hidePreview
        ? "记住完整图案，五秒后藏起来，先记几块特征明显的！"
        : "真正在动的是空格：从上往下、从左往右一行一行复原，拼好的那行就别再动～";
  }
}

/** 过关那句夸奖 */
export function winLine(cfg: PuzzleLevel, moves: number, timeLeft: number): string {
  switch (boardKind(cfg)) {
    case "rotate":
      return `只点了 ${moves} 下就把整园风车都转正，朝向判断得很准！`;
    case "fill":
      return `${cfg.missing ?? moves} 块缺口全补齐，花纹比对的眼力满分！`;
    default:
      return cfg.timeLimit
        ? `只用了 ${moves} 步，沙漏还剩 ${timeLeft} 秒，快而不乱！`
        : `只用了 ${moves} 步就复原，路线规划得很省！`;
  }
}

/** 没拼完那句话（只鼓励，不批评） */
export function loseLine(cfg: PuzzleLevel, reason: "moves" | "time"): string {
  if (reason === "time") return "沙漏走完啦～这幅画大，先扫一眼定好从哪一行起手，节奏就跟得上了！";
  switch (boardKind(cfg)) {
    case "rotate":
      return "点数用完啦～先把一眼看得出歪的那几块转正，剩下的再慢慢对，一定行！";
    case "fill":
      return "机会用完啦～把托盘里的块和缺口四周的花纹比一比，接得上的那块就是它！";
    default:
      return "步数用完啦～下一次先拼好第一行并锁住它，再一行行往下推，会省很多步！";
  }
}
