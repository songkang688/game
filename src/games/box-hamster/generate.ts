/**
 * 推箱小仓鼠 · 关卡生成器。
 *
 * 核心是「倒着拉」:先把箱子摆在目标点上(也就是通关那一刻的样子),
 * 然后让仓鼠一步步把箱子往回拉,拉到哪儿就是这一关的起手式。
 * 每一次回拉都是一次合法推箱的逆操作,所以这样长出来的关**天生就有解** —— 
 * 把回拉序列倒过来念就是一条通关路线,求解器只是去把它(或更短的)找出来而已。
 *
 * 冰面和传送门没法倒着拉。这两样是等纯推箱的底子长好、并且求出一条参考解之后
 * 再撒上去的,分两档:
 *  - 大胆档:撒在任意空地上,撒完必须重新求解通过才算数;
 *  - 保底档:只撒在「参考解一路都没踩到」的格子上 —— 参考解一步不改照样能走通,
 *    所以这一档是数学上稳过的兜底。
 */
import {
  ALL_DIRS,
  boxIndexAt,
  cellAt,
  emptyBoard,
  reachable,
  stateKey,
  stepCell,
  type Board,
  type Dir,
  type Puzzle,
  type State,
} from "./logic";
import { components } from "./solver";

function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pickOne<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 棋盘上所有不是墙的格子 */
export function freeCells(b: Board): number[] {
  const out: number[] = [];
  for (let c = 0; c < b.wall.length; c++) if (!b.wall[c]) out.push(c);
  return out;
}

/** 某个连通块里的格子 */
function cellsOfComponent(id: number[], comp: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < id.length; c++) if (id[c] === comp) out.push(c);
  return out;
}

// ---------------------------------------------------------------------------
// 房间
// ---------------------------------------------------------------------------

export interface RoomSpec {
  w: number;
  h: number;
  /** 内部墙占内部格子的比例 */
  wallDensity: number;
  /** 竖着劈一道墙,把房间分成左右两间(双仓鼠关用) */
  divided: boolean;
  rand: () => number;
}

/**
 * 造一间房:四周是墙,里面随机长几块石头。
 * 每加一块石头都要检查剩下的空地还连不连得上,连不上就把它撤掉。
 */
export function buildRoom(spec: RoomSpec): Board | null {
  const b = emptyBoard(spec.w, spec.h);
  const wantRegions = spec.divided ? 2 : 1;

  if (spec.divided) {
    const mid = Math.floor(spec.w / 2);
    for (let y = 0; y < spec.h; y++) b.wall[cellAt(b, mid, y)] = true;
  }

  const interior: number[] = [];
  for (let y = 1; y < spec.h - 1; y++) {
    for (let x = 1; x < spec.w - 1; x++) {
      const c = cellAt(b, x, y);
      if (!b.wall[c]) interior.push(c);
    }
  }
  const minFree = Math.max(8, Math.floor(interior.length * 0.55));
  const budget = Math.round(interior.length * spec.wallDensity);
  const order = shuffle(interior.slice(), spec.rand);

  let placed = 0;
  for (const cell of order) {
    if (placed >= budget) break;
    b.wall[cell] = true;
    const { count } = components(b);
    const stillFree = b.wall.filter((x) => !x).length;
    if (count !== wantRegions || stillFree < minFree) {
      b.wall[cell] = false;
      continue;
    }
    placed++;
  }

  const { id, count } = components(b);
  if (count !== wantRegions) return null;
  for (let comp = 0; comp < count; comp++) {
    if (cellsOfComponent(id, comp).length < 9) return null;
  }
  return b;
}

// ---------------------------------------------------------------------------
// 回拉
// ---------------------------------------------------------------------------

/** 当前这一步能往回拉哪些箱子 */
function legalPulls(b: Board, s: State): Array<{ bi: number; p1: number; p2: number }> {
  const reach = reachable(b, s, s.hamsters[0]);
  const out: Array<{ bi: number; p1: number; p2: number }> = [];
  for (let bi = 0; bi < s.boxes.length; bi++) {
    const box = s.boxes[bi];
    for (const u of ALL_DIRS) {
      const p1 = stepCell(b, box, u);
      if (p1 < 0 || b.wall[p1] || boxIndexAt(s, p1) >= 0) continue;
      const p2 = stepCell(b, p1, u);
      if (p2 < 0 || b.wall[p2] || boxIndexAt(s, p2) >= 0) continue;
      if (!reach.seen[p1]) continue;
      out.push({ bi, p1, p2 });
    }
  }
  return out;
}

/**
 * 从「已经通关」的摆法出发,把箱子一路往回拉,返回一个够乱的起手式。
 *
 * 用的是「随机深走 + 多次重开」而不是逐层 BFS:BFS 在几千个状态的预算里只能铺开两三层,
 * 拉出来的关一眼就看得到头;随机深走能一口气走出二十来步,再靠打分挑最乱的那一张。
 */
export function pullBack(
  b: Board,
  targets: number[],
  hamsterStart: number,
  opts: { rand: () => number; restarts?: number; walkLen?: number; minDepth?: number }
): { boxes: number[]; hamster: number; depth: number } | null {
  const restarts = opts.restarts ?? 7;
  const walkLen = opts.walkLen ?? 26;
  const minDepth = opts.minDepth ?? 2;

  const targetCells = targets.slice();
  const distToTarget = (cell: number): number => {
    let best = Infinity;
    const cx = cell % b.w;
    const cy = Math.floor(cell / b.w);
    for (const t of targetCells) {
      const d = Math.abs(cx - (t % b.w)) + Math.abs(cy - Math.floor(t / b.w));
      if (d < best) best = d;
    }
    return best === Infinity ? 0 : best;
  };
  const scoreOf = (s: State, depth: number): number => {
    let offTarget = 0;
    let spread = 0;
    for (const box of s.boxes) {
      if (!b.target[box]) offTarget++;
      spread += distToTarget(box);
    }
    return offTarget * 40 + spread * 5 + Math.min(depth, 30) * 2;
  };

  let best: { state: State; depth: number } | null = null;
  let bestScore = -1;

  for (let r = 0; r < restarts; r++) {
    let state: State = { boxes: targets.slice(), hamsters: [hamsterStart] };
    const seen = new Set<string>([stateKey(state)]);
    for (let step = 1; step <= walkLen; step++) {
      const options = shuffle(legalPulls(b, state), opts.rand);
      let advanced = false;
      for (const opt of options) {
        const boxes = state.boxes.slice();
        boxes[opt.bi] = opt.p1;
        const child: State = { boxes, hamsters: [opt.p2] };
        const key = stateKey(child);
        if (seen.has(key)) continue;
        seen.add(key);
        state = child;
        advanced = true;
        break;
      }
      if (!advanced) break;
      const score = scoreOf(state, step);
      if (score > bestScore) {
        bestScore = score;
        best = { state, depth: step };
      }
    }
  }

  if (!best || best.depth < minDepth) return null;
  return { boxes: best.state.boxes.slice(), hamster: best.state.hamsters[0], depth: best.depth };
}

// ---------------------------------------------------------------------------
// 一整关的骨架
// ---------------------------------------------------------------------------

export interface SkeletonSpec extends RoomSpec {
  /** 单间房里放几个箱子;双仓鼠关是每间房各放这么多 */
  boxesPerRoom: number;
  minDepth?: number;
}

/**
 * 造一关纯推箱(还没有冰面 / 传送门)。造不出来返回 null,交给调用方换个种子重来。
 */
export function buildSkeleton(spec: SkeletonSpec): Puzzle | null {
  const board = buildRoom(spec);
  if (!board) return null;
  const { id, count } = components(board);

  const boxes: number[] = [];
  const hamsters: number[] = [];

  for (let comp = 0; comp < count; comp++) {
    const cells = cellsOfComponent(id, comp);
    if (cells.length < spec.boxesPerRoom * 3 + 2) return null;

    const shuffled = shuffle(cells.slice(), spec.rand);
    const targets = shuffled.slice(0, spec.boxesPerRoom);
    for (const t of targets) board.target[t] = true;

    const free = shuffled.filter((c) => !targets.includes(c));
    if (free.length === 0) return null;
    const home = pickOne(spec.rand, free);

    const pulled = pullBack(board, targets, home, {
      rand: spec.rand,
      minDepth: spec.minDepth ?? Math.max(2, spec.boxesPerRoom),
    });
    if (!pulled) return null;
    boxes.push(...pulled.boxes);
    hamsters.push(pulled.hamster);
  }

  // 一个箱子都没挪动的「关」不算关
  const moved = boxes.some((c) => !board.target[c]);
  if (!moved) return null;

  return { ...board, boxes, hamsters };
}

// ---------------------------------------------------------------------------
// 撒机关
// ---------------------------------------------------------------------------

export interface DecorSpec {
  iceRuns: number;
  portalPairs: number;
  rand: () => number;
  /** 只许撒在这些格子上(保底档传参考解的补集);不传就是整张图随便撒 */
  allowed?: Set<number>;
}

/** 撒机关能用的候选格:空地,且不是目标点 / 箱子起点 / 仓鼠起点 */
function decorCandidates(p: Puzzle, allowed?: Set<number>): number[] {
  const out: number[] = [];
  for (let c = 0; c < p.wall.length; c++) {
    if (p.wall[c] || p.target[c]) continue;
    if (p.boxes.includes(c) || p.hamsters.includes(c)) continue;
    if (allowed && !allowed.has(c)) continue;
    out.push(c);
  }
  return out;
}

/** 在已经成型的关上撒冰面与传送门。返回新的一份,不改原来的 */
export function decorate(p: Puzzle, spec: DecorSpec): Puzzle {
  const next: Puzzle = {
    ...p,
    ice: p.ice.slice(),
    portal: p.portal.slice(),
    boxes: p.boxes.slice(),
    hamsters: p.hamsters.slice(),
  };
  const pool = shuffle(decorCandidates(p, spec.allowed), spec.rand);
  let cursor = 0;

  for (let run = 0; run < spec.iceRuns && cursor < pool.length; run++) {
    const head = pool[cursor++];
    if (next.ice[head]) continue;
    next.ice[head] = true;
    // 顺着一个方向连成一小段,单个孤零零的冰格看不出是冰面
    const dir = pickOne(spec.rand, ALL_DIRS) as Dir;
    let cur = head;
    const len = randInt(spec.rand, 1, 2);
    for (let i = 0; i < len; i++) {
      const nxt = stepCell(next, cur, dir);
      if (nxt < 0 || next.wall[nxt] || next.target[nxt]) break;
      if (next.boxes.includes(nxt) || next.hamsters.includes(nxt)) break;
      if (spec.allowed && !spec.allowed.has(nxt)) break;
      next.ice[nxt] = true;
      cur = nxt;
    }
  }

  for (let pair = 0; pair < spec.portalPairs; pair++) {
    const a = pool.find((c, i) => i >= cursor && next.portal[c] < 0 && !next.ice[c]);
    if (a === undefined) break;
    cursor = pool.indexOf(a) + 1;
    const b = pool.find((c, i) => i >= cursor && next.portal[c] < 0 && !next.ice[c] && c !== a);
    if (b === undefined) break;
    cursor = pool.indexOf(b) + 1;
    next.portal[a] = b;
    next.portal[b] = a;
  }

  return next;
}
