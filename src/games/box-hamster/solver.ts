/**
 * 推箱小仓鼠 · 求解器。
 *
 * 这一层只有一个用途:证明「这一关真的推得完」。188 关每一关都要过它这一关,
 * levels.test.ts 会逐关跑一遍,并且把求出来的解回放到规则层里检查真的赢了。
 *
 * 三段式:
 *  1. 连通块拆分:墙把棋盘分成互不相通的几块时,箱子和仓鼠都跨不过去,
 *     于是可以一块一块单独解再拼起来 —— 双仓鼠关就是靠这个从「两块的乘积」降回「两块之和」;
 *  2. 纯推箱关(没有冰面、没有传送门)走宏搜索:一层只算一次推箱,
 *     走路的部分交给可达性 BFS 补齐,再配上死角剪枝;
 *  3. 带冰面 / 传送门的关走 A*:这类玩法里「走一步」可能滑出去很远,
 *     没法把走路折叠掉,就老老实实按单步搜,用「每个箱子到最近目标的曼哈顿距离之和」当启发。
 *
 * 两条路都返回**逐步可回放的动作序列**,不是抽象的推箱清单,
 * 所以测试可以拿它直接喂给 tryMove 验收。
 */
import {
  ALL_DIRS,
  boxIndexAt,
  cloneState,
  hasDeadBox,
  hasPortal,
  initialState,
  isPlainRules,
  isSolved,
  pathTo,
  reachable,
  stateKey,
  stepCell,
  tryMove,
  xOf,
  yOf,
  type Board,
  type Dir,
  type Move,
  type Puzzle,
  type State,
} from "./logic";

export interface SolveOptions {
  /** 搜索节点上限,超了就当「这次没解出来」 */
  nodeCap?: number;
}

export interface SolveResult {
  solved: boolean;
  moves: Move[];
  /** 解法里推箱子的次数 */
  pushes: number;
  nodes: number;
  /** 是不是撞上了节点上限 */
  capped: boolean;
  method: "macro" | "astar" | "split" | "trivial";
}

const DEFAULT_CAP = 260_000;

function emptyResult(method: SolveResult["method"]): SolveResult {
  return { solved: false, moves: [], pushes: 0, nodes: 0, capped: false, method };
}

function opposite(dir: Dir): Dir {
  return ((dir + 2) % 4) as Dir;
}

// ---------------------------------------------------------------------------
// 连通块
// ---------------------------------------------------------------------------

/** 只被墙分隔的连通块编号;墙格是 -1 */
export function components(b: Board): { id: number[]; count: number } {
  const n = b.w * b.h;
  const id = new Array<number>(n).fill(-1);
  let count = 0;
  for (let start = 0; start < n; start++) {
    if (b.wall[start] || id[start] >= 0) continue;
    const queue = [start];
    id[start] = count;
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      for (const dir of ALL_DIRS) {
        const nxt = stepCell(b, cur, dir);
        if (nxt < 0 || b.wall[nxt] || id[nxt] >= 0) continue;
        id[nxt] = count;
        queue.push(nxt);
      }
    }
    count++;
  }
  return { id, count };
}

/** 传送门有没有把两个连通块连起来(有的话就不能拆开单独解) */
export function portalsCrossComponents(b: Board, id: number[]): boolean {
  for (let cell = 0; cell < b.portal.length; cell++) {
    const pair = b.portal[cell];
    if (pair < 0) continue;
    if (id[cell] !== id[pair]) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 宏搜索(纯推箱)
// ---------------------------------------------------------------------------

interface MacroNode {
  state: State;
  /** 走到这个状态的完整动作串 */
  moves: Move[];
  pushes: number;
}

/** 归一化:每只仓鼠都退到自己可达范围里下标最小的那格,避免「只是站位不同」的状态重复展开 */
function macroKey(b: Board, s: State): string {
  const canon = s.hamsters.map((cell) => {
    const reach = reachable(b, s, cell);
    let best = cell;
    for (const c of reach.order) if (c < best) best = c;
    return best;
  });
  return stateKey({ boxes: s.boxes, hamsters: canon });
}

function solveMacro(p: Puzzle, cap: number): SolveResult {
  const start = initialState(p);
  if (isSolved(p, start)) return { solved: true, moves: [], pushes: 0, nodes: 1, capped: false, method: "macro" };

  const seen = new Set<string>([macroKey(p, start)]);
  let frontier: MacroNode[] = [{ state: start, moves: [], pushes: 0 }];
  let nodes = 1;

  while (frontier.length > 0) {
    const next: MacroNode[] = [];
    for (const node of frontier) {
      for (let hi = 0; hi < node.state.hamsters.length; hi++) {
        const home = node.state.hamsters[hi];
        const reach = reachable(p, node.state, home);
        for (let bi = 0; bi < node.state.boxes.length; bi++) {
          const box = node.state.boxes[bi];
          for (const dir of ALL_DIRS) {
            const stand = stepCell(p, box, opposite(dir));
            if (stand < 0 || p.wall[stand] || boxIndexAt(node.state, stand) >= 0) continue;
            if (!reach.seen[stand]) continue;

            const staged = cloneState(node.state);
            staged.hamsters[hi] = stand;
            const out = tryMove(p, staged, hi, dir);
            if (!out || !out.pushed) continue;
            if (hasDeadBox(p, out.state)) continue;

            const key = macroKey(p, out.state);
            if (seen.has(key)) continue;
            seen.add(key);
            nodes++;

            const walk = pathTo(reach, home, stand);
            if (!walk) continue;
            const moves = node.moves.concat(
              walk.map((d) => ({ who: hi, dir: d })),
              [{ who: hi, dir }]
            );
            const child: MacroNode = { state: out.state, moves, pushes: node.pushes + 1 };
            if (isSolved(p, out.state)) {
              return { solved: true, moves, pushes: child.pushes, nodes, capped: false, method: "macro" };
            }
            if (nodes >= cap) {
              return { solved: false, moves: [], pushes: 0, nodes, capped: true, method: "macro" };
            }
            next.push(child);
          }
        }
      }
    }
    frontier = next;
  }
  return { ...emptyResult("macro"), nodes };
}

// ---------------------------------------------------------------------------
// A*(冰面 / 传送门)
// ---------------------------------------------------------------------------

/** 每个箱子到最近目标点的曼哈顿距离之和 */
function heuristic(b: Board, s: State, targets: number[]): number {
  let total = 0;
  for (const box of s.boxes) {
    if (b.target[box]) continue;
    let best = Infinity;
    const bx = xOf(b, box);
    const by = yOf(b, box);
    for (const t of targets) {
      const d = Math.abs(bx - xOf(b, t)) + Math.abs(by - yOf(b, t));
      if (d < best) best = d;
    }
    total += best === Infinity ? 0 : best;
  }
  return total;
}

interface AStarNode {
  state: State;
  g: number;
  pushes: number;
  parent: number;
  move: Move | null;
}

function solveAStar(p: Puzzle, cap: number): SolveResult {
  const start = initialState(p);
  if (isSolved(p, start)) return { solved: true, moves: [], pushes: 0, nodes: 1, capped: false, method: "astar" };

  const targets: number[] = [];
  for (let c = 0; c < p.target.length; c++) if (p.target[c]) targets.push(c);

  const nodes: AStarNode[] = [{ state: start, g: 0, pushes: 0, parent: -1, move: null }];
  const seen = new Map<string, number>([[stateKey(start), 0]]);
  /**
   * f 值分桶代替二叉堆。冰面和传送门会让一步之内箱子挪出很远,
   * 启发值可能骤降、算出比当前扫描位置还小的 f,所以入桶时要把扫描指针拉回去,
   * 否则那些节点就永远轮不到 —— 这会让求解器把有解的关误判成无解。
   */
  const buckets: number[][] = [];
  let scan = 0;
  let expanded = 0;
  const push = (f: number, node: number): void => {
    const slot = Math.max(0, f);
    while (buckets.length <= slot) buckets.push([]);
    buckets[slot].push(node);
    if (slot < scan) scan = slot;
  };
  push(heuristic(p, start, targets), 0);
  while (scan < buckets.length) {
    const bucket = buckets[scan];
    if (!bucket || bucket.length === 0) {
      scan++;
      continue;
    }
    const cur = bucket.pop() as number;
    const node = nodes[cur];
    // 桶里可能留着已经被更短路径取代的旧条目,跳过
    if (seen.get(stateKey(node.state)) !== cur) continue;
    expanded++;
    if (expanded >= cap) {
      return { solved: false, moves: [], pushes: 0, nodes: expanded, capped: true, method: "astar" };
    }

    for (let hi = 0; hi < node.state.hamsters.length; hi++) {
      for (const dir of ALL_DIRS) {
        const out = tryMove(p, node.state, hi, dir);
        if (!out) continue;
        if (hasDeadBox(p, out.state)) continue;
        const key = stateKey(out.state);
        const g = node.g + 1;
        const old = seen.get(key);
        if (old !== undefined && nodes[old].g <= g) continue;

        const id = nodes.length;
        nodes.push({
          state: out.state,
          g,
          pushes: node.pushes + (out.pushed ? 1 : 0),
          parent: cur,
          move: { who: hi, dir },
        });
        seen.set(key, id);

        if (isSolved(p, out.state)) {
          const moves: Move[] = [];
          let walk = id;
          while (walk > 0) {
            const step = nodes[walk];
            if (!step.move) break;
            moves.push(step.move);
            walk = step.parent;
          }
          moves.reverse();
          return {
            solved: true,
            moves,
            pushes: nodes[id].pushes,
            nodes: expanded,
            capped: false,
            method: "astar",
          };
        }
        push(g + heuristic(p, out.state, targets), id);
      }
    }
  }
  return { ...emptyResult("astar"), nodes: expanded };
}

// ---------------------------------------------------------------------------
// 对外入口
// ---------------------------------------------------------------------------

function solveWhole(p: Puzzle, cap: number): SolveResult {
  return isPlainRules(p) ? solveMacro(p, cap) : solveAStar(p, cap);
}

/** 把某个连通块单独抠出来变成一道小题:块外全部当墙 */
function carve(p: Puzzle, id: number[], comp: number): { sub: Puzzle; hamsterMap: number[] } {
  const wall = p.wall.slice();
  for (let c = 0; c < wall.length; c++) if (id[c] !== comp) wall[c] = true;
  const hamsterMap: number[] = [];
  const hamsters: number[] = [];
  for (let i = 0; i < p.hamsters.length; i++) {
    if (id[p.hamsters[i]] === comp) {
      hamsterMap.push(i);
      hamsters.push(p.hamsters[i]);
    }
  }
  const boxes = p.boxes.filter((c) => id[c] === comp);
  return {
    sub: { ...p, wall, boxes, hamsters },
    hamsterMap,
  };
}

/**
 * 解一关。返回的 moves 可以直接一步步喂给 `tryMove` 回放。
 */
export function solve(p: Puzzle, opts: SolveOptions = {}): SolveResult {
  const cap = opts.nodeCap ?? DEFAULT_CAP;
  if (p.boxes.length === 0) {
    return { solved: true, moves: [], pushes: 0, nodes: 0, capped: false, method: "trivial" };
  }

  const { id, count } = components(p);
  const splittable = count > 1 && !(hasPortal(p) && portalsCrossComponents(p, id));
  if (!splittable) return solveWhole(p, cap);

  const moves: Move[] = [];
  let pushes = 0;
  let nodes = 0;
  for (let comp = 0; comp < count; comp++) {
    const boxesHere = p.boxes.filter((c) => id[c] === comp).length;
    let targetsHere = 0;
    for (let c = 0; c < p.target.length; c++) if (p.target[c] && id[c] === comp) targetsHere++;
    if (boxesHere === 0 && targetsHere === 0) continue;
    if (boxesHere !== targetsHere) return { ...emptyResult("split"), nodes };

    const { sub, hamsterMap } = carve(p, id, comp);
    const res = solveWhole(sub, cap);
    nodes += res.nodes;
    if (!res.solved) return { solved: false, moves: [], pushes: 0, nodes, capped: res.capped, method: "split" };
    pushes += res.pushes;
    for (const mv of res.moves) moves.push({ who: hamsterMap[mv.who], dir: mv.dir });
  }
  return { solved: true, moves, pushes, nodes, capped: false, method: "split" };
}

/** 把一串动作真的走一遍,确认最后是赢的(测试与生成器的最终验收) */
export function verifySolution(p: Puzzle, moves: readonly Move[]): boolean {
  let state = initialState(p);
  for (const mv of moves) {
    const out = tryMove(p, state, mv.who, mv.dir);
    if (!out) return false;
    state = out.state;
  }
  return isSolved(p, state);
}

/** 一条解法一路踩过的所有格子(仓鼠站过的 + 箱子经过的),给「机关只放在解法碰不到的地方」用 */
export function solutionFootprint(p: Puzzle, moves: readonly Move[]): Set<number> {
  const used = new Set<number>();
  let state = initialState(p);
  for (const cell of state.hamsters) used.add(cell);
  for (const cell of state.boxes) used.add(cell);
  for (const mv of moves) {
    const out = tryMove(p, state, mv.who, mv.dir);
    if (!out) break;
    for (const cell of out.path) used.add(cell);
    for (const cell of out.boxPath) used.add(cell);
    used.add(out.to);
    if (out.boxTo >= 0) used.add(out.boxTo);
    state = out.state;
  }
  for (let c = 0; c < p.target.length; c++) if (p.target[c]) used.add(c);
  return used;
}
