/**
 * 推箱小仓鼠 · 规则层(纯函数,不碰 DOM)。
 *
 * 棋盘是一张 w×h 的方格纸,格子用一维下标 `y * w + x` 表示。
 * 四条规则,后三条是后段章节才解锁的:
 *  1. 仓鼠只能推、不能拉;箱子后面必须留出空位。
 *  2. 冰面(❄️):自由走上冰面会一直滑到滑不动为止;被推上冰面的箱子同样会滑,
 *     但滑到目标点会「咔」一下停住 —— 这条是刻意放宽的,不然冰面关对一年级小朋友太狠。
 *  3. 传送门(🌀):成对出现,走到其中一个上面会被送到另一个;箱子被推上去也会传送。
 *     传送只发生一次,不会连环触发。
 *  4. 推箱子的那一下仓鼠会抓住箱子,自己既不打滑也不传送,稳稳停在箱子后面。
 *
 * 两只仓鼠互不阻挡(它们是好朋友,侧身就过去了),但箱子挡谁都算数。
 */

export type Dir = 0 | 1 | 2 | 3;

/** 上右下左 */
export const ALL_DIRS: Dir[] = [0, 1, 2, 3];
export const DIR_DX = [0, 1, 0, -1];
export const DIR_DY = [-1, 0, 1, 0];
export const DIR_LABELS = ["上", "右", "下", "左"];

export interface Board {
  w: number;
  h: number;
  /** 墙 */
  wall: boolean[];
  /** 冰面 */
  ice: boolean[];
  /** 目标点(箱子要推到的地方) */
  target: boolean[];
  /** portal[cell] = 配对格子的下标;没有传送门就是 -1 */
  portal: number[];
}

export interface Puzzle extends Board {
  /** 箱子初始位置 */
  boxes: number[];
  /** 仓鼠初始位置(1 或 2 只) */
  hamsters: number[];
}

export interface State {
  boxes: number[];
  hamsters: number[];
}

export interface Move {
  /** 第几只仓鼠 */
  who: number;
  dir: Dir;
}

export function cellCount(b: Pick<Board, "w" | "h">): number {
  return b.w * b.h;
}

export function xOf(b: Pick<Board, "w">, cell: number): number {
  return cell % b.w;
}

export function yOf(b: Pick<Board, "w">, cell: number): number {
  return Math.floor(cell / b.w);
}

export function cellAt(b: Pick<Board, "w">, x: number, y: number): number {
  return y * b.w + x;
}

/** 创建一张四周是墙、里面全空的棋盘 */
export function emptyBoard(w: number, h: number): Board {
  const n = w * h;
  const wall = new Array<boolean>(n).fill(false);
  for (let x = 0; x < w; x++) {
    wall[cellAt({ w }, x, 0)] = true;
    wall[cellAt({ w }, x, h - 1)] = true;
  }
  for (let y = 0; y < h; y++) {
    wall[cellAt({ w }, 0, y)] = true;
    wall[cellAt({ w }, w - 1, y)] = true;
  }
  return {
    w,
    h,
    wall,
    ice: new Array<boolean>(n).fill(false),
    target: new Array<boolean>(n).fill(false),
    portal: new Array<number>(n).fill(-1),
  };
}

/** 往 dir 方向挪一格;越界返回 -1 */
export function stepCell(b: Pick<Board, "w" | "h">, cell: number, dir: Dir): number {
  const x = xOf(b, cell) + DIR_DX[dir];
  const y = yOf(b, cell) + DIR_DY[dir];
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return -1;
  return cellAt(b, x, y);
}

export function hasIce(b: Board): boolean {
  return b.ice.some(Boolean);
}

export function hasPortal(b: Board): boolean {
  return b.portal.some((p) => p >= 0);
}

/** 这一关有没有用到「滑 / 传」这类需要逐步模拟的机关 */
export function isPlainRules(b: Board): boolean {
  return !hasIce(b) && !hasPortal(b);
}

export function cloneState(s: State): State {
  return { boxes: s.boxes.slice(), hamsters: s.hamsters.slice() };
}

export function initialState(p: Puzzle): State {
  return { boxes: p.boxes.slice(), hamsters: p.hamsters.slice() };
}

/** 某格上的箱子下标;没有返回 -1 */
export function boxIndexAt(s: State, cell: number): number {
  for (let i = 0; i < s.boxes.length; i++) if (s.boxes[i] === cell) return i;
  return -1;
}

/** 某格上有没有仓鼠 */
export function hamsterAt(s: State, cell: number): boolean {
  return s.hamsters.includes(cell);
}

/** 归一化的状态指纹:箱子无序、仓鼠有序(两只仓鼠是不同角色) */
export function stateKey(s: State): string {
  const boxes = s.boxes.slice().sort((a, b) => a - b);
  return `${s.hamsters.join(",")}|${boxes.join(",")}`;
}

/** 所有目标点都压着箱子 */
export function isSolved(b: Board, s: State): boolean {
  for (const box of s.boxes) if (!b.target[box]) return false;
  return true;
}

/** 还差几个箱子没归位 */
export function remainingBoxes(b: Board, s: State): number {
  let n = 0;
  for (const box of s.boxes) if (!b.target[box]) n++;
  return n;
}

// ---------------------------------------------------------------------------
// 滑行 / 传送的落点计算
// ---------------------------------------------------------------------------

export interface Landing {
  cell: number;
  /** 一路经过的格子(含落点),给动画用 */
  path: number[];
  teleported: boolean;
  slid: boolean;
}

/**
 * 从 from 往 dir 迈一步,并把冰面滑行与传送门都结算掉。
 * blocked(cell) 返回 true 表示这格进不去。迈不动返回 null。
 */
export function land(
  b: Board,
  from: number,
  dir: Dir,
  blocked: (cell: number) => boolean,
  isBox: boolean
): Landing | null {
  let cur = stepCell(b, from, dir);
  if (cur < 0 || b.wall[cur] || blocked(cur)) return null;
  const path = [cur];
  let slid = false;

  if (b.ice[cur]) {
    for (let guard = 0; guard < b.w * b.h; guard++) {
      // 箱子滑到目标点就停,冰面关才不至于全是「差一格」
      if (isBox && b.target[cur]) break;
      const nxt = stepCell(b, cur, dir);
      if (nxt < 0 || b.wall[nxt] || blocked(nxt)) break;
      cur = nxt;
      path.push(cur);
      slid = true;
      if (!b.ice[cur]) break;
    }
  }

  let teleported = false;
  const pair = b.portal[cur];
  if (pair >= 0 && pair !== cur && !b.wall[pair] && !blocked(pair)) {
    cur = pair;
    path.push(cur);
    teleported = true;
  }

  return { cell: cur, path, teleported, slid };
}

// ---------------------------------------------------------------------------
// 走一步
// ---------------------------------------------------------------------------

export interface MoveOutcome {
  state: State;
  pushed: boolean;
  /** 被推的箱子下标;没推就是 -1 */
  boxIndex: number;
  boxFrom: number;
  boxTo: number;
  boxPath: number[];
  from: number;
  to: number;
  path: number[];
  teleported: boolean;
}

/**
 * 让第 who 只仓鼠往 dir 走一步。走不动(撞墙 / 箱子后面没空位)返回 null。
 * 不修改传入的 state。
 */
export function tryMove(b: Board, s: State, who: number, dir: Dir): MoveOutcome | null {
  const from = s.hamsters[who];
  if (from === undefined) return null;
  const next = stepCell(b, from, dir);
  if (next < 0 || b.wall[next]) return null;

  const bi = boxIndexAt(s, next);
  if (bi >= 0) {
    // 推:箱子先走(会滑会传),仓鼠稳稳跟到箱子原来的格子
    const spot = land(b, next, dir, (c) => boxIndexAt(s, c) >= 0 || hamsterAt(s, c), true);
    if (!spot) return null;
    const state = cloneState(s);
    state.boxes[bi] = spot.cell;
    state.hamsters[who] = next;
    return {
      state,
      pushed: true,
      boxIndex: bi,
      boxFrom: next,
      boxTo: spot.cell,
      boxPath: spot.path,
      from,
      to: next,
      path: [next],
      teleported: false,
    };
  }

  const spot = land(b, from, dir, (c) => boxIndexAt(s, c) >= 0, false);
  if (!spot) return null;
  const state = cloneState(s);
  state.hamsters[who] = spot.cell;
  return {
    state,
    pushed: false,
    boxIndex: -1,
    boxFrom: -1,
    boxTo: -1,
    boxPath: [],
    from,
    to: spot.cell,
    path: spot.path,
    teleported: spot.teleported,
  };
}

/** 依次走一串步子;中途走不动就在那里停下,返回真正走成了几步 */
export function applyMoves(b: Board, s: State, moves: readonly Move[]): { state: State; done: number } {
  let cur = s;
  let done = 0;
  for (const mv of moves) {
    const out = tryMove(b, cur, mv.who, mv.dir);
    if (!out) break;
    cur = out.state;
    done++;
  }
  return { state: cur, done };
}

// ---------------------------------------------------------------------------
// 死局判定(只判「铁定救不回来」的那种,免得冤枉小朋友)
// ---------------------------------------------------------------------------

/**
 * 箱子卡在两面垂直的墙夹成的角落里、脚下又不是目标点 —— 这种箱子永远推不动了。
 * 冰面和传送门都救不了它(已经站在传送门上的箱子不会再被传走),所以这条判定对所有玩法都成立。
 */
export function isDeadCorner(b: Board, cell: number): boolean {
  if (b.target[cell]) return false;
  const up = stepCell(b, cell, 0);
  const right = stepCell(b, cell, 1);
  const down = stepCell(b, cell, 2);
  const left = stepCell(b, cell, 3);
  const blockedUp = up < 0 || b.wall[up];
  const blockedRight = right < 0 || b.wall[right];
  const blockedDown = down < 0 || b.wall[down];
  const blockedLeft = left < 0 || b.wall[left];
  return (blockedUp || blockedDown) && (blockedLeft || blockedRight);
}

/** 这一步之后有没有箱子彻底卡死 */
export function hasDeadBox(b: Board, s: State): boolean {
  for (const box of s.boxes) if (isDeadCorner(b, box)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// 自由行走的可达范围(推箱宏搜索与提示都要用)
// ---------------------------------------------------------------------------

/**
 * 只走空地(墙和箱子挡路,仓鼠之间不挡)能走到哪些格子。
 * 冰面 / 传送门会让「走一步」不止一格,这里照样用 land 结算,所以三种玩法通用。
 * 返回 prev 数组用于回溯路径:prev[cell] = { from, dir }。
 */
export interface Reach {
  seen: boolean[];
  prev: Array<{ from: number; dir: Dir } | null>;
  order: number[];
}

export function reachable(b: Board, s: State, from: number): Reach {
  const n = b.w * b.h;
  const seen = new Array<boolean>(n).fill(false);
  const prev = new Array<{ from: number; dir: Dir } | null>(n).fill(null);
  const order: number[] = [];
  const queue = [from];
  seen[from] = true;
  order.push(from);
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    for (const dir of ALL_DIRS) {
      const spot = land(b, cur, dir, (c) => boxIndexAt(s, c) >= 0, false);
      if (!spot || seen[spot.cell]) continue;
      seen[spot.cell] = true;
      prev[spot.cell] = { from: cur, dir };
      order.push(spot.cell);
      queue.push(spot.cell);
    }
  }
  return { seen, prev, order };
}

// ---------------------------------------------------------------------------
// 字符画(测试与调试用)
// ---------------------------------------------------------------------------

/**
 * 从字符画读一关:
 * `#` 墙 · ` ` 空地 · `.` 脚印 · `$` 箱子 · `*` 已归位的箱子 ·
 * `@` 大仓鼠 · `+` 大仓鼠站在脚印上 · `&` 小仓鼠 · `%` 小仓鼠站在脚印上 ·
 * `~` 冰面 · `a`/`A` 一对传送门 · `b`/`B` 另一对。
 * 行长度不齐时右边补墙。
 */
export function parsePuzzle(rows: readonly string[]): Puzzle {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const n = w * h;
  const board: Board = {
    w,
    h,
    wall: new Array<boolean>(n).fill(false),
    ice: new Array<boolean>(n).fill(false),
    target: new Array<boolean>(n).fill(false),
    portal: new Array<number>(n).fill(-1),
  };
  const boxes: number[] = [];
  const slots: Array<number | undefined> = [];
  const portalSlots = new Map<string, number[]>();

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const cell = y * w + x;
      const ch = x < row.length ? row[x] : "#";
      switch (ch) {
        case "#":
          board.wall[cell] = true;
          break;
        case ".":
          board.target[cell] = true;
          break;
        case "$":
          boxes.push(cell);
          break;
        case "*":
          board.target[cell] = true;
          boxes.push(cell);
          break;
        case "@":
          slots[0] = cell;
          break;
        case "+":
          board.target[cell] = true;
          slots[0] = cell;
          break;
        case "&":
          slots[1] = cell;
          break;
        case "%":
          board.target[cell] = true;
          slots[1] = cell;
          break;
        case "~":
          board.ice[cell] = true;
          break;
        case "a":
        case "A":
        case "b":
        case "B": {
          const key = ch.toLowerCase();
          const list = portalSlots.get(key) ?? [];
          list.push(cell);
          portalSlots.set(key, list);
          break;
        }
        default:
          break;
      }
    }
  }

  for (const list of portalSlots.values()) {
    if (list.length !== 2) continue;
    board.portal[list[0]] = list[1];
    board.portal[list[1]] = list[0];
  }

  const hamsters = slots.filter((c): c is number => typeof c === "number");
  return { ...board, boxes, hamsters };
}

/** 把当前局面画回字符画(测试失败时看得懂发生了什么) */
export function toAscii(b: Board, s: State): string {
  const rows: string[] = [];
  for (let y = 0; y < b.h; y++) {
    let row = "";
    for (let x = 0; x < b.w; x++) {
      const cell = y * b.w + x;
      const onTarget = b.target[cell];
      if (b.wall[cell]) row += "#";
      else if (boxIndexAt(s, cell) >= 0) row += onTarget ? "*" : "$";
      else if (s.hamsters[0] === cell) row += onTarget ? "+" : "@";
      else if (s.hamsters[1] === cell) row += onTarget ? "%" : "&";
      else if (b.portal[cell] >= 0) row += "a";
      else if (onTarget) row += ".";
      else if (b.ice[cell]) row += "~";
      else row += " ";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

/** 把 reachable 的结果回溯成一串方向;走不到返回 null */
export function pathTo(reach: Reach, from: number, to: number): Dir[] | null {
  if (!reach.seen[to]) return null;
  const dirs: Dir[] = [];
  let cur = to;
  let guard = 0;
  while (cur !== from && guard++ < 4096) {
    const step = reach.prev[cur];
    if (!step) return null;
    dirs.push(step.dir);
    cur = step.from;
  }
  return cur === from ? dirs.reverse() : null;
}
