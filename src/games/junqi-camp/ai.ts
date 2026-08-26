/**
 * 军旗对决 · 四档电脑对手（纯函数，同一个 seed 每次走一样的棋）。
 *
 * 菜鸟：能动的子里随便挑一枚；
 * 普通：用大子往前顶，见到能吃的就吃；
 * 高手：会派工兵去探最后两行的雷，也会留人守着自己的旗；
 * 地狱：布阵更讲究，还会拿信息集做推理——对面暴露过的子它全记着。
 */
import {
  BACK_TWO_ROWS,
  HQ,
  ROAD_ADJ,
  CELLS,
  inCamp,
  inHQ,
  other,
  rowOf,
  type Pos,
  type Side,
} from "./board";
import { mulberry32 } from "./rng";
import type { SetupSkill } from "./setup";
import {
  RANK,
  combat,
  knownInfo,
  legalMoves,
  movesFrom,
  type Cell,
  type GameState,
  type Kind,
  type Knowledge,
  type Move,
} from "./rules";

export type Tier = "rookie" | "normal" | "pro" | "hell";

export const TIERS: readonly Tier[] = ["rookie", "normal", "pro", "hell"];

export const TIER_LABELS: Record<Tier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  pro: "高手",
  hell: "地狱",
};

export const TIER_TIPS: Record<Tier, string> = {
  rookie: "随便走走，陪你熟悉铁路。",
  normal: "喜欢用大子往前顶。",
  pro: "会派工兵探雷，也会留人守旗。",
  hell: "记得住你亮过的每一枚子。",
};

/** 各档布阵的讲究程度 */
export const TIER_SETUP: Record<Tier, SetupSkill> = {
  rookie: 0,
  normal: 1,
  pro: 1,
  hell: 2,
};

/** 一枚子值多少（比大小之外的分量：工兵能挖雷、炸弹能换大子，所以都不便宜） */
export const VALUE: Record<Kind, number> = {
  siling: 100,
  junzhang: 78,
  shizhang: 58,
  lvzhang: 44,
  tuanzhang: 34,
  yingzhang: 26,
  lianzhang: 19,
  paizhang: 13,
  gongbing: 22,
  zhadan: 46,
  dilei: 24,
  junqi: 1000,
};

/** 到对方两个大本营的公路步数（只看地图，不看谁站在哪儿） */
const HQ_DIST: Record<Side, number[]> = {
  duo: hqDistance("duo"),
  star: hqDistance("star"),
};

function hqDistance(target: Side): number[] {
  const dist = new Array<number>(CELLS).fill(99);
  const queue: Pos[] = [];
  for (const p of HQ[target]) {
    dist[p] = 0;
    queue.push(p);
  }
  while (queue.length) {
    const cur = queue.shift() as Pos;
    for (const n of ROAD_ADJ[cur]) {
      if (dist[n] <= dist[cur] + 1) continue;
      dist[n] = dist[cur] + 1;
      queue.push(n);
    }
  }
  return dist;
}

/** 站在 side 这一边看，对方这枚子是什么（不知道就返回 null） */
function seenKind(know: Knowledge, piece: { id: number }): Kind | null {
  return know.facts.get(piece.id)?.kind ?? null;
}

/** 对方那些已经露过面的大子这一手能打到哪些格子 */
function dangerCells(board: readonly Cell[], foe: Side, know: Knowledge): Set<Pos> {
  const out = new Set<Pos>();
  for (let p = 0; p < board.length; p++) {
    const c = board[p];
    if (!c || c.side !== foe) continue;
    const kind = seenKind(know, c);
    if (!kind || RANK[kind] < 5) continue;
    for (const to of movesFrom(board, p)) out.add(to);
  }
  return out;
}

function scoreMove(
  state: GameState,
  side: Side,
  move: Move,
  know: Knowledge,
  danger: Set<Pos>,
  tier: Tier
): number {
  const board = state.cells;
  const me = board[move.from];
  if (!me) return -Infinity;
  const foe = other(side);
  const smart = tier === "pro" || tier === "hell";
  const dist = HQ_DIST[foe];
  let score = 0;

  // 往对方大本营方向挪，越靠近越好；大子多走两步没关系，小子别乱跑
  const advance = dist[move.from] - dist[move.to];
  score += advance * (2 + RANK[me.kind] * 0.35);

  // 待在自己家门口不动没什么意思
  if (BACK_TWO_ROWS[side].includes(rowOf(move.from)) && advance > 0) score += 3;

  const target = board[move.to];
  const intoEnemyHQ = HQ[foe].includes(move.to);
  const intoOwnHQ = HQ[side].includes(move.to);

  if (intoOwnHQ) score -= 60; // 自己钻进大本营就再也动不了了
  if (inHQ(move.from)) score -= 100;

  if (target) {
    const known = seenKind(know, target);
    if (known) {
      const r = combat(me.kind, known);
      if (r.flagTaken) score += 5000;
      else if (r.outcome === "attacker") score += VALUE[known] + 6;
      else if (r.outcome === "both") score += VALUE[known] - VALUE[me.kind];
      else score -= VALUE[me.kind] * 0.9;
    } else {
      const backRow = BACK_TWO_ROWS[foe].includes(rowOf(move.to));
      const mineRisk = backRow && me.kind !== "gongbing" && me.kind !== "zhadan";
      if (intoEnemyHQ) {
        // 大本营里不是旗就是雷：工兵挖得掉，炸弹换得起，别的子也值得试一把
        if (me.kind === "gongbing") score += 140;
        else if (me.kind === "zhadan") score += 110;
        else if (me.kind === "siling" && smart) score += 45;
        else score += smart ? 78 : 60;
      } else if (me.kind === "gongbing" && backRow) {
        score += smart ? 34 : 12; // 探雷是工兵的活
      } else if (mineRisk) {
        score -= smart ? 34 : 8;
      } else {
        score += 14 - VALUE[me.kind] * (smart ? 0.1 : 0.08);
      }
      if (me.kind === "siling" && smart && !intoEnemyHQ) score -= 12; // 司令别轻易去撞不认识的子
    }
  } else if (intoEnemyHQ) {
    score -= 55; // 空的大本营进去就等于把这枚子挂起来
  }

  if (smart) {
    if (danger.has(move.to) && !inCamp(move.to)) score -= VALUE[me.kind] * 0.35;
    if (inCamp(move.to)) score += 6; // 行营里没人撞得着
    // 留一枚子守着自己的旗
    const guardZone = BACK_TWO_ROWS[side].includes(rowOf(move.from));
    if (guardZone && guards(board, side) <= 1) score -= 12;
  }

  if (tier === "hell") {
    // 记住对面暴露过的子：知道是小子就上，知道是大子就绕
    const fact = target ? know.facts.get(target.id) : undefined;
    if (fact?.moved && !fact.kind) score += 4;
    if (me.kind === "gongbing" && know.flagAt !== null) {
      score += (dist[move.from] - dist[move.to]) * 4;
    }
    if (know.flagAt !== null && move.to === know.flagAt) score += 4000;
  }

  return score;
}

/** 自己最后两行还剩几枚能动的子 */
function guards(board: readonly Cell[], side: Side): number {
  let n = 0;
  for (let p = 0; p < board.length; p++) {
    const c = board[p];
    if (!c || c.side !== side) continue;
    if (!BACK_TWO_ROWS[side].includes(rowOf(p))) continue;
    if (c.kind === "dilei" || c.kind === "junqi" || inHQ(p)) continue;
    n += 1;
  }
  return n;
}

/** 这一手电脑走哪儿；一枚能动的子都没有就返回 null */
export function chooseMove(state: GameState, side: Side, tier: Tier, seed: number): Move | null {
  const moves = legalMoves(state.cells, side);
  if (moves.length === 0) return null;
  const rand = mulberry32((seed + state.plies * 7919) >>> 0);

  if (tier === "rookie") return moves[Math.floor(rand() * moves.length)];

  const know = knownInfo(side, state.history);
  const danger = tier === "normal" ? new Set<Pos>() : dangerCells(state.cells, other(side), know);

  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const jitter = tier === "hell" ? rand() * 1.5 : rand() * 6;
    const s = scoreMove(state, side, m, know, danger, tier) + jitter;
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}
