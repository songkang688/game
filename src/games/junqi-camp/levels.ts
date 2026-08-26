/**
 * 军旗对决 · 188 关战役（8 章）。
 *
 * 第 1–7 章是**布阵残局**：对面是守备队，按兵不动（`garrison`），
 * 你要在限定手数里把旗子扛回来。每一关都是照着一条现成的路线摆出来的，
 * 可解性由 `solveLevel` 真的搜一遍来保证（测试里 188 关逐关回放到胜利）。
 *
 * 第 8 章「军旗杯」是全规则实战：地狱档真的会走棋，赢法要在它反应过来之前拿下。
 */
import { assertTotal, type Chapter } from "../level99";
import { TIER_SETUP, chooseMove, type Tier } from "./ai";
import { CELLS, HQ, idx, type Pos } from "./board";
import { mulberry32 } from "./rng";
import { newGame } from "./setup";
import {
  KINDS,
  LABEL,
  applyMove,
  cloneState,
  legalMoves,
  makeState,
  status,
  type Cell,
  type GameState,
  type Kind,
  type Move,
  type Side,
} from "./rules";

export const CHAPTERS: Chapter[] = [
  { name: "明棋入门", emoji: "🎖️", color: "#E6F0D8", desc: "两边都摊开摆，先认清谁比谁大。", size: 24 },
  { name: "铁路飞驰", emoji: "🚄", color: "#DDEAF7", desc: "铁路直线上没人挡，想推多远推多远。", size: 24 },
  { name: "工兵排雷", emoji: "🛠️", color: "#FBEEDA", desc: "工兵能在铁路上拐弯，也只有它挖得掉地雷。", size: 24 },
  { name: "炸弹同尽", emoji: "🧨", color: "#FBE1E4", desc: "炸弹碰上谁都一起回营，用在刀刃上。", size: 24 },
  { name: "行营免战", emoji: "⛺", color: "#E7F2EC", desc: "行营里的子撞不着，绕一条路过去。", size: 22 },
  { name: "暗棋登场", emoji: "🔍", color: "#EFE7F7", desc: "对面全是背面，靠推理找出那面旗。", size: 22 },
  { name: "布局残局", emoji: "🗺️", color: "#FFF0CE", desc: "给好一整套布阵，找出扛旗的那条路。", size: 24 },
  { name: "军旗杯", emoji: "🏆", color: "#DCEFE2", desc: "地狱档全规则，抢在它反应过来之前。", size: 24 },
];

export const TOTAL = 188;

export function chaptersValid(): boolean {
  return assertTotal(CHAPTERS, TOTAL, "junqi-camp");
}

export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

export function indexInChapterOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    if (level < acc + CHAPTERS[i].size) return level - acc;
    acc += CHAPTERS[i].size;
  }
  return 0;
}

export interface LevelPlan {
  level: number;
  chapter: number;
  index: number;
  /** 朵朵最多走几手 */
  budget: number;
  /** 守备队关：星星按兵不动 */
  garrison: boolean;
  /** 电子暗棋：对面全是背面 */
  hidden: boolean;
  tier: Tier;
  seed: number;
  hint: string;
}

// ---------------------------------------------------------------------------
// 摆棋子的小工具
// ---------------------------------------------------------------------------

interface Build {
  cells: Cell[];
  next: number;
}

function build(): Build {
  return { cells: new Array<Cell>(CELLS).fill(null), next: 1 };
}

function put(b: Build, at: Pos, side: Side, kind: Kind): Pos {
  b.cells[at] = { id: b.next++, side, kind };
  return at;
}

/** 每一关都给朵朵留一面自己的旗，摆在自己大本营里（它本来也不能动） */
function ownFlag(b: Build): void {
  put(b, idx(11, 1), "duo", "junqi");
  put(b, idx(11, 3), "duo", "dilei");
}

interface Made {
  cells: Cell[];
  budget: number;
  hint: string;
}

/** 星星那面旗摆哪个大本营 */
function flagCol(k: number): number {
  return k % 2 === 0 ? 1 : 3;
}

// ---------------------------------------------------------------------------
// 八章的摆法
// ---------------------------------------------------------------------------

const CH1_PAIRS: Array<[Kind, Kind]> = [
  ["yingzhang", "lianzhang"],
  ["tuanzhang", "yingzhang"],
  ["lvzhang", "tuanzhang"],
  ["shizhang", "lvzhang"],
  ["junzhang", "shizhang"],
  ["siling", "junzhang"],
];

/** 第一章：两边明着摆，一步吃掉守门的，一步把旗扛走 */
function chapter1(k: number): Made {
  const b = build();
  const fc = flagCol(k);
  const oc = fc === 1 ? 3 : 1;
  const [big, small] = CH1_PAIRS[k % CH1_PAIRS.length];
  const variant = k % 4;

  put(b, idx(0, fc), "star", "junqi");
  put(b, idx(0, oc), "star", "dilei");
  put(b, idx(1, fc), "star", small);
  put(b, idx(1, oc), "star", "paizhang");
  ownFlag(b);

  if (variant === 3) {
    put(b, idx(3, 2), "duo", big);
    return { cells: b.cells, budget: 4, hint: `${LABEL[big]}比${LABEL[small]}大，直接顶上去。` };
  }
  if (variant === 1) {
    put(b, idx(1, fc === 1 ? 0 : 4), "duo", big);
    return { cells: b.cells, budget: 3, hint: "先把守门的请回营，再进大本营取旗。" };
  }
  put(b, idx(2, fc), "duo", big);
  if (variant === 2) put(b, idx(2, oc), "duo", "paizhang");
  return { cells: b.cells, budget: 3, hint: "行营里的这枚子先出来，两步就能拿下。" };
}

/** 第二章：顺着铁路一路推上去 */
function chapter2(k: number): Made {
  const b = build();
  const fc = flagCol(k);
  const oc = fc === 1 ? 3 : 1;
  const c0 = k % 4 < 2 ? 0 : 4;
  const startRow = k % 3 === 0 ? 10 : k % 3 === 1 ? 8 : 6;
  const blocked = k % 4 === 1 || k % 4 === 3;

  put(b, idx(0, fc), "star", "junqi");
  put(b, idx(0, oc), "star", "dilei");
  put(b, idx(4, oc), "star", "lianzhang");
  ownFlag(b);

  const carrier: Kind = blocked ? "shizhang" : "tuanzhang";
  put(b, idx(startRow, c0), "duo", carrier);
  if (blocked) {
    put(b, idx(1, 2), "star", "yingzhang");
    return { cells: b.cells, budget: 5, hint: "铁路被挡住就先把挡路的请回营，再接着推。" };
  }
  return { cells: b.cells, budget: 4, hint: "先沿着竖铁路冲到第 2 行，再横着推到旗子门口。" };
}

/** 第三章：工兵在铁路上拐弯，顺手把雷挖了 */
function chapter3(k: number): Made {
  const b = build();
  const fc = flagCol(k);
  const oc = fc === 1 ? 3 : 1;
  const c0 = k % 4 < 2 ? 0 : 4;
  const twoMines = k % 3 === 2;

  put(b, idx(0, fc), "star", "junqi");
  put(b, idx(0, oc), "star", "dilei");
  put(b, idx(1, fc), "star", "dilei");
  if (twoMines) put(b, idx(1, 2), "star", "dilei");
  put(b, idx(4, oc), "star", "paizhang");
  ownFlag(b);

  put(b, idx(k % 2 === 0 ? 10 : 6, c0), "duo", "gongbing");
  if (k % 5 === 0) put(b, idx(3, 2), "duo", "lianzhang");
  return {
    cells: b.cells,
    budget: twoMines ? 4 : 3,
    hint: "工兵沿着铁路拐个弯，先把地雷挖掉。",
  };
}

/** 第四章：炸弹换掉挡路的大子，或者直接把旗炸下来 */
function chapter4(k: number): Made {
  const b = build();
  const fc = flagCol(k);
  const oc = fc === 1 ? 3 : 1;
  const variant = k % 3;

  put(b, idx(0, fc), "star", "junqi");
  put(b, idx(0, oc), "star", "dilei");
  ownFlag(b);

  if (variant === 0) {
    // 炸弹撞旗：本款算扛旗成功
    put(b, idx(1, fc), "duo", "zhadan");
    put(b, idx(1, oc), "star", "siling");
    return { cells: b.cells, budget: 2, hint: "炸弹撞上军旗，这一款算你把旗扛回来了。" };
  }
  if (variant === 1) {
    put(b, idx(1, fc), "star", "siling");
    put(b, idx(2, fc), "duo", "zhadan");
    put(b, idx(1, fc === 1 ? 0 : 4), "duo", "paizhang");
    return { cells: b.cells, budget: 4, hint: "先用炸弹换掉守门的大子，再让小子进去取旗。" };
  }
  put(b, idx(1, fc), "star", "dilei");
  put(b, idx(2, fc), "duo", "zhadan");
  put(b, idx(2, oc), "duo", "lianzhang");
  put(b, idx(1, oc), "star", "junzhang");
  return { cells: b.cells, budget: 5, hint: "炸弹和地雷也是一起回营，清完路再走。" };
}

/** 第五章：行营里的子撞不着，绕过去 */
function chapter5(k: number): Made {
  const b = build();
  const fc = flagCol(k);
  const oc = fc === 1 ? 3 : 1;
  const side = fc === 1 ? 0 : 4;

  put(b, idx(0, fc), "star", "junqi");
  put(b, idx(0, oc), "star", "dilei");
  put(b, idx(2, fc), "star", "siling"); // 缩在行营里，谁也撞不着
  ownFlag(b);

  if (k % 3 === 2) {
    put(b, idx(4, fc), "star", "junzhang"); // 又一个行营
    put(b, idx(3, side), "duo", "shizhang");
    return { cells: b.cells, budget: 5, hint: "两个行营都撞不得，贴着边上的铁路绕过去。" };
  }
  put(b, idx(3, fc), "duo", "shizhang");
  if (k % 3 === 1) put(b, idx(4, 2), "duo", "paizhang");
  return { cells: b.cells, budget: 5, hint: "行营里的子只能等它自己出来，先横一步再上铁路。" };
}

/** 第六章：一样的活，只是对面全盖着 */
function chapter6(k: number): Made {
  const made = k % 2 === 0 ? chapter3(k) : chapter4(k + 1);
  return {
    cells: made.cells,
    budget: made.budget + 1,
    hint: "最后两行才可能有地雷，大本营里不是旗就是雷——先想清楚再动手。",
  };
}

/**
 * 第七章：一整套布阵，自己找路。
 *
 * 第 2 行被守备队堵死，工兵没法一口气顺着铁路摸到雷跟前：
 * 要么绕行营（四手），要么先用炸弹把铁路口换开（三手）。
 */
function chapter7(k: number): Made {
  const b = build();
  const fc = flagCol(k);
  const oc = fc === 1 ? 3 : 1;
  const c0 = fc === 1 ? 0 : 4; // 和大本营同一侧的那条竖铁路
  const gate = idx(1, c0); // 铁路进第 2 行的路口
  const detour = k % 2 === 0;

  put(b, idx(0, fc), "star", "junqi");
  put(b, idx(0, oc), "star", "dilei");
  put(b, idx(1, fc), "star", "dilei"); // 旗子门口压着一枚雷，只有工兵挖得掉
  put(b, gate, "star", k % 4 === 0 ? "tuanzhang" : "lvzhang");
  put(b, idx(1, 2), "star", "yingzhang"); // 中路也堵上，铁路绕不过来
  put(b, idx(1, oc), "star", "lianzhang");
  put(b, idx(4, oc), "star", "paizhang");
  ownFlag(b);

  put(b, idx(6, c0), "duo", "gongbing");
  if (detour) {
    // 行营空着：工兵上铁路 → 拐进行营 → 挖雷 → 取旗
    if (k % 4 === 2) put(b, idx(4, fc), "star", "shizhang");
    return {
      cells: b.cells,
      budget: 5,
      hint: "第 2 行被堵死了，工兵改走行营那条斜线。",
    };
  }
  // 行营被占着（撞不得），只能先让炸弹把铁路口换开
  put(b, idx(2, fc), "star", "shizhang");
  put(b, idx(3, c0), "duo", "zhadan");
  return {
    cells: b.cells,
    budget: 5,
    hint: "行营里的子撞不着，先用炸弹把铁路口换开，工兵再进去。",
  };
}

/** 第八章：地狱档真的会走，抢在它前面拿下 */
function chapter8(k: number): Made {
  const b = build();
  const fc = flagCol(k);
  const oc = fc === 1 ? 3 : 1;
  const variant = k % 3;

  put(b, idx(0, fc), "star", "junqi");
  put(b, idx(0, oc), "star", "dilei");
  // 星星的机动力量都放在够不着旗子门口的地方（行营与中路，一手到不了第 2 行）
  put(b, idx(3, 2), "star", "shizhang");
  put(b, idx(4, oc), "star", "lianzhang");
  if (k % 2 === 0) put(b, idx(4, fc), "star", "paizhang");
  ownFlag(b);
  put(b, idx(9, 1), "duo", "siling"); // 守着自己这半边，免得被抄家

  if (variant === 0) {
    put(b, idx(1, fc), "star", "dilei");
    put(b, idx(2, fc), "duo", "gongbing");
    return { cells: b.cells, budget: 3, hint: "工兵先挖雷，再一步进大本营。" };
  }
  if (variant === 1) {
    put(b, idx(1, fc), "star", "paizhang");
    put(b, idx(2, fc), "duo", "yingzhang");
    return { cells: b.cells, budget: 3, hint: "守门的比你小，顶掉它再进去。" };
  }
  put(b, idx(1, fc), "star", "siling");
  put(b, idx(2, fc), "duo", "zhadan");
  put(b, idx(2, oc), "duo", "lianzhang");
  return { cells: b.cells, budget: 4, hint: "炸弹换掉司令，连长补上一刀。" };
}

const MAKERS: Array<(k: number) => Made> = [
  chapter1,
  chapter2,
  chapter3,
  chapter4,
  chapter5,
  chapter6,
  chapter7,
  chapter8,
];

// ---------------------------------------------------------------------------
// 关卡计划与局面
// ---------------------------------------------------------------------------

export function planFor(level: number): LevelPlan {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.round(level)));
  const chapter = chapterIndexOf(lv);
  const index = indexInChapterOf(lv);
  const made = MAKERS[chapter](index);
  const garrison = chapter < 7;
  const tier: Tier = chapter < 5 ? "rookie" : chapter === 5 ? "normal" : chapter === 6 ? "pro" : "hell";
  return {
    level: lv,
    chapter,
    index,
    budget: made.budget,
    garrison,
    hidden: chapter === 5 || chapter === 7,
    tier,
    seed: 6100 + lv * 53,
    hint: made.hint,
  };
}

/** 某一关的起始局面 */
export function positionFor(level: number): GameState {
  const plan = planFor(level);
  const made = MAKERS[plan.chapter](plan.index);
  return makeState(made.cells, { turn: "duo", garrison: plan.garrison });
}

/** 朵朵这一关最多能走几手（守备队关一手就是一步，实战关要算上对面） */
export function maxPliesOf(plan: LevelPlan): number {
  return plan.garrison ? plan.budget : plan.budget * 2;
}

/** 三星门槛：步数省得越多星越多 */
export function rateLevel(usedMoves: number, budget: number): 1 | 2 | 3 {
  if (usedMoves <= Math.max(1, Math.floor(budget * 0.55))) return 3;
  if (usedMoves <= Math.max(2, budget - 1)) return 2;
  return 1;
}

/** 无尽模式：连胜越多对手越强 */
export function endlessPlan(streak: number): { tier: Tier; seed: number } {
  const tier: Tier = streak >= 9 ? "hell" : streak >= 5 ? "pro" : streak >= 2 ? "normal" : "rookie";
  return { tier, seed: 9200 + streak * 137 };
}

/** 无尽模式的一盘新棋（对手布阵也跟着变讲究） */
export function endlessGame(streak: number): GameState {
  const p = endlessPlan(streak);
  return newGame(p.seed, { starSkill: TIER_SETUP[p.tier], duoSkill: 1 });
}

// ---------------------------------------------------------------------------
// 参考解题器：188 关可解全靠它盯着
// ---------------------------------------------------------------------------

function keyOf(state: GameState): string {
  let s = "";
  for (const c of state.cells) {
    s += c ? (c.side === "duo" ? "d" : "s") + KINDS.indexOf(c.kind) + "," : ".,";
  }
  return s;
}

function won(state: GameState): boolean {
  const st = status(state);
  return st.kind === "win" && st.side === "duo";
}

/** 守备队关：对面不动，广度优先搜最短的一条扛旗路线 */
function solveGarrison(start: GameState, budget: number, nodeCap: number): Move[] | null {
  interface Node {
    state: GameState;
    path: Move[];
  }
  let frontier: Node[] = [{ state: start, path: [] }];
  const seen = new Set<string>([keyOf(start)]);
  let nodes = 0;
  for (let depth = 0; depth < budget; depth++) {
    const next: Node[] = [];
    for (const node of frontier) {
      for (const move of legalMoves(node.state.cells, "duo")) {
        if (++nodes > nodeCap) return null;
        const child = cloneState(node.state);
        const r = applyMove(child, move);
        if (!r.ok) continue;
        const path = [...node.path, move];
        if (won(child)) return path;
        if (child.outcome) continue;
        const key = keyOf(child);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ state: child, path });
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return null;
}

/** 实战关：对手用真 AI 回应，按「离旗子越近越先试」的顺序做有限深度搜索 */
function solveVersus(
  start: GameState,
  budget: number,
  tier: Tier,
  seed: number,
  nodeCap: number
): Move[] | null {
  const flagAt = start.cells.findIndex((c) => c?.side === "star" && c.kind === "junqi");
  let nodes = 0;

  const order = (state: GameState): Move[] => {
    const moves = legalMoves(state.cells, "duo");
    const rank = (m: Move): number => {
      if (m.to === flagAt) return -1000;
      const target = state.cells[m.to];
      const dist = Math.abs(Math.floor(m.to / 5) - Math.floor(flagAt / 5)) + Math.abs((m.to % 5) - (flagAt % 5));
      return dist - (target ? 3 : 0);
    };
    return moves.sort((a, b) => rank(a) - rank(b));
  };

  const dfs = (state: GameState, depth: number, path: Move[]): Move[] | null => {
    if (depth === 0) return null;
    for (const move of order(state)) {
      if (++nodes > nodeCap) return null;
      const child = cloneState(state);
      if (!applyMove(child, move).ok) continue;
      const next = [...path, move];
      if (won(child)) return next;
      if (child.outcome) continue;
      // 对手回应（地狱档是确定性的，同一个局面永远走同一步）
      const reply = chooseMove(child, "star", tier, seed + child.plies);
      if (reply) {
        if (!applyMove(child, reply).ok) continue;
        if (child.outcome) continue;
      } else if (!child.outcome) {
        continue;
      }
      const deeper = dfs(child, depth - 1, next);
      if (deeper) return deeper;
    }
    return null;
  };

  return dfs(start, budget, []);
}

/** 这一关的参考解：一串朵朵的走子，回放到胜利。搜不出来返回 null（测试会红） */
export function solveLevel(level: number, nodeCap = 40000): Move[] | null {
  const plan = planFor(level);
  const start = positionFor(level);
  return plan.garrison
    ? solveGarrison(start, plan.budget, nodeCap)
    : solveVersus(start, plan.budget, plan.tier, plan.seed, nodeCap);
}

/** 把参考解真的走一遍，看看是不是真赢了（测试与「看一遍答案」都用它） */
export function replaySolution(level: number, moves: readonly Move[]): boolean {
  const plan = planFor(level);
  const state = positionFor(level);
  for (const move of moves) {
    if (state.outcome) break;
    if (!applyMove(state, move).ok) return false;
    if (state.outcome) break;
    if (!plan.garrison && !state.outcome) {
      const reply = chooseMove(state, "star", plan.tier, plan.seed + state.plies);
      if (reply) applyMove(state, reply);
    }
  }
  return won(state);
}

/** 关卡地图上那一行小字 */
export function levelHint(level: number): string {
  return planFor(level).hint;
}

/** 给视图用的随机数（同一关每次抖动一样） */
export function levelRand(level: number): () => number {
  return mulberry32(planFor(level).seed);
}

/** 星星的大本营位置（视图画目标用） */
export const STAR_HQ: readonly Pos[] = HQ.star;
