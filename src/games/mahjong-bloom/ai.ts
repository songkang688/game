/**
 * 花开麻将 · 四档棋友（纯逻辑，不碰 DOM）。
 *
 * | 档 | 打牌 | 鸣牌 | 防守 |
 * | --- | --- | --- | --- |
 * | 菜鸟 | 基本随机 | 几乎不吃不碰 | 无 |
 * | 普通 | 按向听数下降选 | 只碰，而且不会拆掉已经成型的顺子 | 无 |
 * | 高手 | 向听 + 进张数 | 吃碰杠都会，但要真能降向听 | 现物 / 字牌 / 幺九优先，危险牌押后 |
 * | 地狱 | 向听 + 进张 + 番路规划 | 只鸣对番路有用的牌，会抢杠 | 全套防守，还会算点炮风险 |
 *
 * 四档的强度靠 `simulateTierAverage` 用固定 seed 跑批来验证，写成了单测断言。
 */
import { mulberry32 } from "../level99";
import { canHuWithFloor, scoreFans } from "./fan";
import { isHu } from "./hu";
import {
  AI_TIERS,
  applyClaim,
  applyHu,
  applySelfKan,
  claimOptions,
  createTable,
  discard,
  finishDraw,
  fullHand,
  huContext,
  nextTurn,
  resolveClaims,
  resolveRobbing,
  selfOptions,
  type AiTier,
  type ClaimOption,
  type SelfOption,
  type TableState
} from "./table";
import { isHonor, isTerminalOrHonor, rankOf, suitOf, toCounts, type Suit } from "./tiles";
import { xiangting } from "./xiangting";

export { AI_TIER_LABELS, AI_TIERS, type AiTier } from "./table";

/** 一档棋友的性格参数，全在这张表里，调难度就改这里 */
export interface TierProfile {
  /** 完全随机打牌的概率 */
  chaos: number;
  /** 进张数在打牌评分里的权重 */
  ukeireWeight: number;
  /** 危险度的扣分权重（越大越怂，也越不容易点炮） */
  dangerWeight: number;
  /** 番路规划的权重 */
  fanWeight: number;
  /** 会不会吃 */
  canChi: boolean;
  /** 会不会碰 */
  canPon: boolean;
  /** 会不会杠 */
  canKan: boolean;
  /** 局势不妙时会不会「弃和」改打安全牌（只有地狱档会） */
  folds: boolean;
  /** 危险度算得细不细：粗算只看现物，细算连筋牌和露面张数一起看 */
  deepDanger: boolean;
}

export const TIER_PROFILES: Record<AiTier, TierProfile> = {
  rookie: {
    chaos: 1, ukeireWeight: 0, dangerWeight: 0, fanWeight: 0,
    canChi: false, canPon: false, canKan: false, folds: false, deepDanger: false
  },
  normal: {
    chaos: 0.08, ukeireWeight: 0, dangerWeight: 0, fanWeight: 0,
    canChi: false, canPon: true, canKan: true, folds: false, deepDanger: false
  },
  pro: {
    chaos: 0, ukeireWeight: 6, dangerWeight: 6, fanWeight: 0,
    canChi: true, canPon: true, canKan: true, folds: false, deepDanger: false
  },
  hell: {
    chaos: 0, ukeireWeight: 8, dangerWeight: 9, fanWeight: 10,
    canChi: true, canPon: true, canKan: true, folds: true, deepDanger: true
  }
};

/** 场上这张牌还剩几张没露面（估进张数用） */
function unseenCopies(state: TableState, seat: number, tile: number): number {
  let seen = 0;
  const me = state.seats[seat];
  for (const t of fullHand(me)) if (t === tile) seen++;
  for (const s of state.seats) {
    for (const d of s.discards) if (d === tile) seen++;
    for (const m of s.melds) for (const t of m.tiles) if (t === tile) seen++;
  }
  return Math.max(0, 4 - seen);
}

/** 这一手还差几张能听：进张数（能让向听数下降的牌一共还剩几张） */
function ukeire(state: TableState, seat: number, hand: readonly number[], meldCount: number): number {
  const base = xiangting(hand, meldCount);
  let total = 0;
  const cand = candidateDraws(hand);
  for (const t of cand) {
    const left = unseenCopies(state, seat, t);
    if (left <= 0) continue;
    if (xiangting([...hand, t], meldCount) < base) total += left;
  }
  return total;
}

/** 只看手牌周围那些真有可能有用的牌，别把 34 种全试一遍（太慢） */
function candidateDraws(hand: readonly number[]): number[] {
  const set = new Set<number>();
  for (const t of hand) {
    set.add(t);
    if (!isHonor(t)) {
      const r = rankOf(t);
      const base = t - r;
      for (const d of [-2, -1, 1, 2]) {
        const nr = r + d;
        if (nr >= 1 && nr <= 9) set.add(base + nr);
      }
    }
  }
  return [...set];
}

/** 某一家现在有多可能听牌：副露多、牌河长就更危险 */
export function threatOf(o: TableState["seats"][number]): number {
  const byMeld = o.melds.length >= 3 ? 2.4 : o.melds.length >= 2 ? 1.6 : o.melds.length >= 1 ? 1.1 : 0.6;
  const byRiver = Math.min(1.4, 0.7 + o.discards.length * 0.045);
  return byMeld * byRiver;
}

/**
 * 打这张牌有多危险。
 * - 粗算（高手档）：别人牌河里出现过就是现物，字牌与幺九相对安全。
 * - 细算（地狱档）：再看筋牌（他打过 1 万，4 万就没那么险）和这张已经露了几张。
 */
export function dangerOf(state: TableState, seat: number, tile: number, deep = false): number {
  let d = 0;
  const r = rankOf(tile);
  for (const o of state.seats) {
    if (o.seat === seat) continue;
    if (o.discards.includes(tile)) continue;
    const threat = threatOf(o);
    let base = isHonor(tile) ? 0.5 : r === 1 || r === 9 ? 0.7 : r === 2 || r === 8 ? 1 : 1.4;
    if (deep && !isHonor(tile)) {
      // 筋：他打过 r-3 或 r+3，这张的两面听就少了一半
      const suitBase = tile - r;
      const hasSuji =
        (r - 3 >= 1 && o.discards.includes(suitBase + r - 3)) ||
        (r + 3 <= 9 && o.discards.includes(suitBase + r + 3));
      if (hasSuji) base *= 0.62;
    }
    d += base * threat;
  }
  if (deep) {
    // 场上露得越多，别人手里剩得越少，越不容易点炮
    const left = unseenCopies(state, seat, tile);
    d *= 0.6 + left * 0.14;
  }
  return d;
}

/**
 * 番路分：这手牌离「一色 / 碰碰」这种大番有多近。
 * 地狱档靠它规划八番路线，不至于凑一手一番都不到的散牌。
 */
export function fanRoute(hand: readonly number[], melds: number): number {
  if (hand.length === 0) return 0;
  const counts = new Map<Suit, number>();
  let honors = 0;
  for (const t of hand) {
    if (isHonor(t)) honors++;
    else counts.set(suitOf(t), (counts.get(suitOf(t)) ?? 0) + 1);
  }
  const top = Math.max(0, ...counts.values());
  const flush = (top + honors) / hand.length;
  const c = toCounts(hand);
  let sets = 0;
  for (const n of c) if (n >= 2) sets++;
  const pung = sets / 7;
  const pure = top / hand.length;
  return Math.max(flush * 0.9, pure, pung) + melds * 0.02;
}

/**
 * 八番路线规划：这手 13 张听的牌里，有几张真能达到起和门槛。
 * 起和门槛开着的时候，「听得到但和不了」是最亏的，地狱档专门躲这个坑。
 */
export function floorPlan(
  state: TableState,
  seat: number,
  hand: readonly number[]
): { tiles: number; best: number } {
  const me = state.seats[seat];
  let tiles = 0;
  let best = 0;
  for (const t of candidateDraws(hand)) {
    if (!isHu(hand, t, me.melds)) continue;
    const left = unseenCopies(state, seat, t);
    if (left <= 0) continue;
    const r = scoreFans({
      hand: [...hand, t],
      melds: me.melds,
      winTile: t,
      selfDraw: true,
      seatWind: me.wind,
      roundWind: state.roundWind,
      flowers: me.flowers.length
    });
    if (canHuWithFloor(r.points, state.floor)) {
      tiles += left;
      if (r.points > best) best = r.points;
    }
  }
  return { tiles, best };
}

/** 该打哪张（返回牌 id） */
export function chooseDiscard(state: TableState, seat: number, rand: () => number): number {
  const me = state.seats[seat];
  const hand = fullHand(me);
  if (hand.length === 0) return -1;
  const p = TIER_PROFILES[me.tier];

  if (p.chaos >= 1 || rand() < p.chaos) {
    // 菜鸟先扔字牌和幺九，再随便扔一张 —— 不算完全乱来，但也谈不上算牌
    const junk = hand.filter(isTerminalOrHonor);
    const pool = junk.length > 0 && rand() < 0.6 ? junk : hand;
    return pool[Math.floor(rand() * pool.length)];
  }

  const meldCount = me.melds.length;
  const seen = new Set<number>();
  let best = hand[0];
  let bestScore = -Infinity;
  let bestX = 99;

  // 先算出每张的向听数，只有并列最优的才值得再花力气算进张与危险度
  const rows: Array<{ tile: number; x: number; rest: number[] }> = [];
  for (const t of hand) {
    if (seen.has(t)) continue;
    seen.add(t);
    const rest = hand.slice();
    rest.splice(rest.indexOf(t), 1);
    const x = xiangting(rest, meldCount);
    rows.push({ tile: t, x, rest });
    if (x < bestX) bestX = x;
  }

  // 弃和：手离听牌还远、别人却明显在听，就别硬冲了，先把安全牌打出去
  const maxThreat = Math.max(
    0,
    ...state.seats.filter((o) => o.seat !== seat).map((o) => threatOf(o))
  );
  const folding = p.folds && bestX >= 3 && maxThreat >= 1.5;

  for (const row of rows) {
    let score = folding ? -(row.x - bestX) * 40 : -(row.x - bestX) * 1000;
    if (folding) {
      score -= dangerOf(state, seat, row.tile, p.deepDanger) * 100;
    } else if (row.x === bestX) {
      if (p.ukeireWeight > 0) score += ukeire(state, seat, row.rest, meldCount) * p.ukeireWeight;
      if (p.dangerWeight > 0) score -= dangerOf(state, seat, row.tile, p.deepDanger) * p.dangerWeight;
      // 番路只在快听牌的时候才规划，太早规划反而把手牌打散
      if (p.fanWeight > 0 && bestX <= 4) score += fanRoute(row.rest, meldCount) * p.fanWeight;
      // 听牌了就直接按「能不能真的和」来挑：听得到却不够番是最亏的
      if (p.fanWeight > 0 && bestX === 0) {
        const plan = floorPlan(state, seat, row.rest);
        score += plan.tiles * 26 + plan.best * 1.6;
      }
      // 同分时优先丢孤张：留着搭子总没坏处
      score += isTerminalOrHonor(row.tile) ? 0.6 : 0;
    }
    if (score > bestScore) {
      bestScore = score;
      best = row.tile;
    }
  }
  return best;
}

/** 摸完之后要不要杠 / 要不要自摸和 */
export function chooseSelf(state: TableState, seat: number, opts: SelfOption[]): SelfOption | null {
  if (opts.length === 0) return null;
  const me = state.seats[seat];
  const tsumo = opts.find((o) => o.kind === "tsumo");
  if (tsumo) return tsumo;
  const p = TIER_PROFILES[me.tier];
  if (!p.canKan) return null;
  const hand = fullHand(me);
  const before = xiangting(hand, me.melds.length);
  for (const o of opts) {
    // 杠完等于少了一张可用牌，向听数不能因此变差
    const rest = hand.filter((t) => t !== o.tile);
    if (xiangting(rest, me.melds.length + 1) <= before) return o;
  }
  return null;
}

/** 别人打出一张之后要不要吃碰杠胡 */
export function chooseClaim(
  state: TableState,
  seat: number,
  opts: ClaimOption[],
  rand: () => number
): ClaimOption | null {
  if (opts.length === 0) return null;
  const ron = opts.find((o) => o.kind === "ron");
  if (ron) return ron;

  const me = state.seats[seat];
  const p = TIER_PROFILES[me.tier];
  const before = xiangting(me.hand, me.melds.length);

  const usable = opts.filter((o) => {
    if (o.kind === "chi" && !p.canChi) return false;
    if (o.kind === "pon" && !p.canPon) return false;
    if (o.kind === "kan" && !p.canKan) return false;
    return true;
  });
  if (usable.length === 0) {
    // 菜鸟偶尔也会心血来潮碰一下，不然像块木头
    if (me.tier === "rookie" && rand() < 0.08) return opts.find((o) => o.kind === "pon") ?? null;
    return null;
  }

  let best: ClaimOption | null = null;
  let bestScore = 0;
  for (const o of usable) {
    const rest = removeUsed(me.hand, o);
    if (!rest) continue;
    const after = xiangting(rest, me.melds.length + 1);
    let score = (before - after) * 10;
    if (score <= 0) continue;
    // 普通档不拆顺子：吃只在有明确收益时才做，这一档干脆不吃
    if (p.fanWeight > 0) score += fanRoute(rest, me.melds.length + 1) * p.fanWeight * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

function removeUsed(hand: readonly number[], o: ClaimOption): number[] | null {
  const rest = hand.slice();
  const need = o.kind === "chi" ? o.pair ?? [] : o.kind === "pon" ? [o.tile, o.tile] : [o.tile, o.tile, o.tile];
  for (const t of need) {
    const i = rest.indexOf(t);
    if (i < 0) return null;
    rest.splice(i, 1);
  }
  return rest;
}

/** 听牌提示：现在听哪些牌、够不够门槛 */
export function huHint(state: TableState, seat: number): { tiles: number[]; enough: boolean } {
  const me = state.seats[seat];
  const hand = me.drawn >= 0 ? me.hand : me.hand;
  const tiles: number[] = [];
  let enough = false;
  for (let i = 1; i <= 37; i++) {
    if (i % 10 === 0 || i % 10 > 9) continue;
    if (i > 29 && i < 31) continue;
    if (!isHu(hand, i, me.melds)) continue;
    tiles.push(i);
    const r = scoreFans(huContext(state, seat, i, false, -1));
    if (canHuWithFloor(r.points, state.floor)) enough = true;
  }
  return { tiles, enough };
}

// ---------------------------------------------------------------------------
// 模拟：固定 seed 跑批，用来验证四档强度单调
// ---------------------------------------------------------------------------

/** 把一盘从头跑到尾（全 AI），返回四家花分 */
export function playHandToEnd(state: TableState, rand: () => number): number[] {
  let guard = 0;
  while (state.phase !== "over" && guard++ < 400) {
    if (state.phase === "discard") {
      const seat = state.turn;
      const self = chooseSelf(state, seat, selfOptions(state, seat));
      if (self?.kind === "tsumo") {
        applyHu(state, seat, true);
        break;
      }
      if (self) {
        applySelfKan(state, seat, self);
        continue;
      }
      const tile = chooseDiscard(state, seat, rand);
      if (tile < 0 || !discard(state, seat, tile)) {
        finishDraw(state);
        break;
      }
      continue;
    }
    if (state.phase === "claim") {
      const from = state.robbing ? state.robbing.seat : state.lastDiscardSeat;
      const wants: Array<{ seat: number; opt: ClaimOption } | null> = [];
      for (let s = 0; s < 4; s++) {
        if (s === from) continue;
        const opt = chooseClaim(state, s, claimOptions(state, s), rand);
        wants.push(opt ? { seat: s, opt } : null);
      }
      const win = resolveClaims(state, wants);
      if (!win) {
        if (state.robbing) resolveRobbing(state);
        else nextTurn(state);
        continue;
      }
      if (win.opt.kind === "ron") {
        applyHu(state, win.seat, false, from);
        break;
      }
      applyClaim(state, win.seat, win.opt);
      continue;
    }
    break;
  }
  if (state.phase !== "over") finishDraw(state);
  return state.seats.map((s) => s.score);
}

/**
 * 让 `tier` 坐 0 号位，另外三家都用 `baseline`，固定 seed 连打 `games` 盘，
 * 返回 0 号位的平均花分。四档强度单调就靠它断言。
 */
export function simulateTierAverage(
  tier: AiTier,
  games = 40,
  baseline: AiTier = "normal",
  seed0 = 20240,
  floor = 8
): number {
  let total = 0;
  for (let g = 0; g < games; g++) {
    const seed = seed0 + g * 97;
    const state = createTable({
      seed,
      dealer: g % 4,
      roundWind: 1,
      floor,
      seats: [
        { name: "选手", tier },
        { name: "对手甲", tier: baseline },
        { name: "对手乙", tier: baseline },
        { name: "对手丙", tier: baseline }
      ]
    });
    const rand = mulberry32(seed ^ 0x5bf0);
    total += playHandToEnd(state, rand)[0];
  }
  return total / Math.max(1, games);
}

/** 四档从弱到强的顺序（测试与界面都用它遍历） */
export function tierOrder(): AiTier[] {
  return AI_TIERS.slice();
}
