/**
 * 围子花园 · 死活粗判
 *
 * 本文件采用的约定(是本作自己定的一套,写清楚免得和别处的规则书混淆):
 *
 * 1. **真眼**:一个空点,四周正交方向全是本方子(界外当本方);
 *    再看四个斜角 —— 斜角在界内的,对方子最多只能占 1 个;
 *    只要这个点靠边或靠角(有正交方向出界),斜角就一个对方子都不许有。
 *    这一套是常见的「假眼排除」判据,能挡住绝大多数假眼,但不做深搜。
 *
 * 2. **两眼判活**:一块棋的气里有 ≥ 2 个真眼就判活。
 *    大眼(如直四、曲四)不在此列 —— 本作把它们当「还没做成两眼」,
 *    需要玩家真的点成两只眼,教学上更直白。
 *
 * 3. **双活(seki)**:两块对立的棋都没有真眼,它们共享全部剩余的气,
 *    且公气数 ≤ 2 —— 谁先紧气谁先没气,所以两块都判活。
 *    公气在数子法里两边都不算,在数目法里两边都不得目。
 *
 * 4. **死子粗判**:一块棋没有两眼、不在双活里,而且它周围的空区
 *    全都只挨着对方的子 —— 也就是它被整个包在对方的地里 —— 就判死。
 *    这只用在终局标死子的「自动标」上,玩家随时可以手动改。
 */
import {
  EMPTY,
  diagonalTable,
  groupAt,
  groups,
  inBounds,
  neighborTable,
  other,
  xy,
  type Board,
  type Color,
  type Group
} from "./board";

/** 这个空点是不是 color 的真眼 */
export function isTrueEye(board: Board, pt: number, color: Color): boolean {
  if (board.cells[pt] !== EMPTY) return false;
  const size = board.size;
  const nbr = neighborTable(size)[pt];
  for (const n of nbr) {
    if (board.cells[n] !== color) return false;
  }
  const { x, y } = xy(size, pt);
  // 靠边或靠角:正交方向有出界的,斜角要求更严
  const onRim = !inBounds(size, x - 1, y) || !inBounds(size, x + 1, y) || !inBounds(size, x, y - 1) || !inBounds(size, x, y + 1);
  const foe = other(color);
  let foeDiag = 0;
  for (const d of diagonalTable(size)[pt]) {
    if (board.cells[d] === foe) foeDiag++;
  }
  return onRim ? foeDiag === 0 : foeDiag <= 1;
}

/** 一块棋的真眼(按点升序) */
export function eyesOf(board: Board, group: Group): number[] {
  return group.liberties.filter((pt) => isTrueEye(board, pt, group.color));
}

/** 两只真眼就判活 */
export function twoEyes(board: Board, group: Group): boolean {
  return eyesOf(board, group).length >= 2;
}

/** 传一个点进来,判它所在那块棋活没活 */
export function aliveAt(board: Board, pt: number): boolean {
  const g = groupAt(board, pt);
  return g ? twoEyes(board, g) : false;
}

/** 和这块棋贴着的对方连通块 */
export function contactGroups(board: Board, group: Group): Group[] {
  const foe = other(group.color);
  const table = neighborTable(board.size);
  const seen = new Set<number>();
  const out: Group[] = [];
  for (const s of group.stones) {
    for (const n of table[s]) {
      if (board.cells[n] !== foe || seen.has(n)) continue;
      const g = groupAt(board, n);
      if (!g) continue;
      for (const p of g.stones) seen.add(p);
      out.push(g);
    }
  }
  return out;
}

/**
 * 双活判定:自己没真眼,剩下的气全是和某一块没真眼的对方棋共有的公气,
 * 而且公气数 ≤ 2。这时谁先去紧气谁自己先没气,两块就都活着。
 */
export function isSeki(board: Board, group: Group): boolean {
  if (group.liberties.length === 0 || group.liberties.length > 2) return false;
  if (eyesOf(board, group).length > 0) return false;
  const mine = new Set(group.liberties);
  for (const foeGroup of contactGroups(board, group)) {
    if (eyesOf(board, foeGroup).length > 0) continue;
    if (foeGroup.liberties.length > 2) continue;
    const shared = foeGroup.liberties.filter((p) => mine.has(p));
    // 双方剩下的气必须完全是同一批公气,少一个都不算双活
    if (shared.length === mine.size && shared.length === foeGroup.liberties.length) return true;
  }
  return false;
}

/** 双活里的公气(数子法两边都不算、数目法两边都不得目) */
export function sekiPoints(board: Board): number[] {
  const out = new Set<number>();
  for (const g of groups(board)) {
    if (!isSeki(board, g)) continue;
    for (const lib of g.liberties) out.add(lib);
  }
  return Array.from(out).sort((a, b) => a - b);
}

/**
 * 自动标死子:返回应当判死的那些**棋子位置**(升序)。
 *
 * 判据(见文件头第 4 条,外加一条很重要的护栏):
 *  - 自己没有两只真眼、也不在双活里;
 *  - 被整个包在对方的地里;
 *  - **而且**围住它的那一方至少有一块是活棋。
 *
 * 最后这条护栏不能少。终局前的盘面上,两堵还没做眼的墙会互相「包住」对方,
 * 少了这条就会把整堵墙都判死。只有被一块真正活着的棋围住,才算走不掉。
 */
export function autoDeadStones(board: Board): number[] {
  const all = groups(board);
  const alive = new Set<number>();
  for (const g of all) {
    if (twoEyes(board, g) || isSeki(board, g)) {
      for (const s of g.stones) alive.add(s);
    }
  }
  const dead: number[] = [];
  for (const g of all) {
    if (alive.has(g.stones[0])) continue;
    const foe = other(g.color);
    if (!surroundedBy(board, g, foe)) continue;
    const jailers = enclosingGroups(board, g);
    if (!jailers.some((j) => alive.has(j.stones[0]))) continue;
    dead.push(...g.stones);
  }
  return dead.sort((a, b) => a - b);
}

/** 围着这块棋的对方连通块:贴着它的,加上和它共用同一片空区的 */
export function enclosingGroups(board: Board, group: Group): Group[] {
  const foe = other(group.color);
  const table = neighborTable(board.size);
  const found = new Map<number, Group>();
  const push = (pt: number): void => {
    if (board.cells[pt] !== foe) return;
    const g = groupAt(board, pt);
    if (!g || found.has(g.stones[0])) return;
    found.set(g.stones[0], g);
  };
  for (const s of group.stones) for (const n of table[s]) push(n);
  const visited = new Uint8Array(board.cells.length);
  for (const start of group.liberties) {
    if (visited[start]) continue;
    const stack = [start];
    visited[start] = 1;
    while (stack.length) {
      const cur = stack.pop() as number;
      for (const n of table[cur]) {
        if (board.cells[n] === EMPTY) {
          if (!visited[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        } else push(n);
      }
    }
  }
  return Array.from(found.values());
}

/**
 * 这块棋周围的空区是不是全都被 by 一方包着。
 * 做法:从这块棋的每口气出发洪水填充空区,看这片空区还挨着谁的子。
 * 只要有一片空区挨到了同色的其它棋(说明能连出去),就不算被包住。
 */
export function surroundedBy(board: Board, group: Group, by: Color): boolean {
  if (group.liberties.length === 0) return true;
  const table = neighborTable(board.size);
  const mineStones = new Set(group.stones);
  const visited = new Uint8Array(board.cells.length);
  for (const start of group.liberties) {
    if (visited[start]) continue;
    const stack = [start];
    visited[start] = 1;
    while (stack.length) {
      const cur = stack.pop() as number;
      for (const n of table[cur]) {
        const c = board.cells[n];
        if (c === EMPTY) {
          if (!visited[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        } else if (c === by) {
          // 挨到围它的一方,继续看别的方向
        } else if (!mineStones.has(n)) {
          // 挨到了自己家别的棋:能连出去,不算被包住
          return false;
        }
      }
    }
  }
  return true;
}

/** 把「点了哪几颗子」变成「这几块棋的全部子」,标死子时点一颗就整块标上 */
export function expandDead(board: Board, picks: readonly number[]): number[] {
  const out = new Set<number>();
  for (const pt of picks) {
    const g = groupAt(board, pt);
    if (!g) continue;
    for (const s of g.stones) out.add(s);
  }
  return Array.from(out).sort((a, b) => a - b);
}

/** 一块棋的状态标签,HUD 与关卡提示用 */
export function groupStatus(board: Board, pt: number): "alive" | "seki" | "fighting" | "dead" | "empty" {
  const g = groupAt(board, pt);
  if (!g) return "empty";
  if (twoEyes(board, g)) return "alive";
  if (isSeki(board, g)) return "seki";
  if (surroundedBy(board, g, other(g.color))) return "dead";
  return "fighting";
}

export const STATUS_TEXT: Record<"alive" | "seki" | "fighting" | "dead" | "empty", string> = {
  alive: "两只真眼,这块棋活啦",
  seki: "双活,谁先紧气谁吃亏,两边都留着",
  fighting: "还在长气,继续经营",
  dead: "被围住啦,终局时会请它们回篮子",
  empty: "这里还是空点"
};
