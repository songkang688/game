/**
 * 英杰令 · 四档 AI 与身份推理。
 *
 * | 档 | 行为 |
 * | --- | --- |
 * | 菜鸟 | 有牌就打,不看身份 |
 * | 普通 | 按已经亮明的身份打花主 / 护花主 |
 * | 高手 | 会留星星盾、会对关键锦囊用春风无懈,会按出牌记录猜身份 |
 * | 地狱 | 再加上装护花、数手牌与距离、藏花两边卖好 |
 *
 * 身份推理只看 `state.acts`(桌面上看得见的动作),不偷看别人的手牌与身份牌。
 */
import { GEARS, type Card } from "./cards";
import {
  advanceTurn,
  aliveIds,
  borrowVictims,
  campOf,
  canPlay,
  createGame,
  distanceBetween,
  endTurn,
  exposedCards,
  giftCard,
  giftLeft,
  isGroupTrick,
  legalTargets,
  playCard,
  rangeOf,
  runFlow,
  startTurn,
  type Camp,
  type Flow,
  type GameState,
  type Reply,
  type Request,
  type Role,
  type SeatSpec
} from "./engine";
import { hasSkill, HEROES } from "./heroes";

export type AiTier = "rookie" | "normal" | "pro" | "hell";

export const AI_TIERS: readonly AiTier[] = ["rookie", "normal", "pro", "hell"];

export const AI_TIER_LABELS: Record<AiTier, string> = {
  rookie: "🐣 菜鸟",
  normal: "🙂 普通",
  pro: "😎 高手",
  hell: "🔥 地狱"
};

export const AI_TIER_TIPS: Record<AiTier, string> = {
  rookie: "有牌就打,不看身份,新手先拿他练手。",
  normal: "认已经亮出来的身份:该打花主的打花主,该护的护。",
  pro: "会留着星星盾,会对关键锦囊甩春风无懈,还会按出牌顺序猜你的身份。",
  hell: "会装成护花的样子,数你的手牌和距离;藏花更是两边卖好。"
};

function isSmart(tier: AiTier): boolean {
  return tier === "pro" || tier === "hell";
}

// ---------------------------------------------------------------------------
// 身份推理
// ---------------------------------------------------------------------------

export interface Observation {
  /** 对花主不客气过几次 */
  attackedLord: number;
  /** 帮过花主几次 */
  helpedLord: number;
  /** 对已经亮明的夺花不客气过几次 */
  attackedRebel: number;
  /** 帮过已经亮明的夺花几次 */
  helpedRebel: number;
  /** 身份牌已经翻开就直接给出来 */
  revealed?: Role;
}

export interface RoleGuess {
  guess: Role;
  /** −3(像自己人)…+3(像敌人) */
  hostility: number;
  /** 有多确定,0..1 */
  confidence: number;
}

/**
 * 规格签名:`roleHeuristic(observations)`。
 * 只看「对花主友不友好」这一条主线,越敌视花主越像夺花,越护花主越像护花。
 */
export function roleHeuristic(obs: Observation): RoleGuess {
  if (obs.revealed) {
    const map: Record<Role, number> = { lord: -3, loyal: -2, rebel: 3, spy: 1 };
    return { guess: obs.revealed, hostility: map[obs.revealed], confidence: 1 };
  }
  const score = obs.attackedLord * 2 + obs.helpedRebel - obs.helpedLord * 2 - obs.attackedRebel;
  const hostility = Math.max(-3, Math.min(3, score));
  const confidence = Math.min(1, Math.abs(score) / 3);
  if (score >= 2) return { guess: "rebel", hostility, confidence };
  if (score <= -2) return { guess: "loyal", hostility, confidence };
  return { guess: "spy", hostility, confidence };
}

/** 从桌面动作流水里数出对某个座位的观察 */
export function observe(state: GameState, who: number): Observation {
  const lordId = state.players.findIndex((p) => p.role === "lord");
  const knownRebels = new Set(state.players.filter((p) => p.revealed && p.role === "rebel").map((p) => p.id));
  const obs: Observation = { attackedLord: 0, helpedLord: 0, attackedRebel: 0, helpedRebel: 0 };
  const self = state.players[who];
  if (self?.revealed) obs.revealed = self.role;
  for (const act of state.acts) {
    if (act.actor !== who) continue;
    if (act.target === lordId) {
      if (act.kind === "hostile") obs.attackedLord++;
      else obs.helpedLord++;
    } else if (knownRebels.has(act.target)) {
      if (act.kind === "hostile") obs.attackedRebel++;
      else obs.helpedRebel++;
    }
  }
  return obs;
}

/** 我(me)眼里 other 大概是什么身份;菜鸟与普通只认已经翻开的 */
export function guessRoleOf(state: GameState, me: number, other: number, tier: AiTier): Role | null {
  const p = state.players[other];
  if (!p) return null;
  if (p.revealed) return p.role;
  if (!isSmart(tier)) return null;
  const g = roleHeuristic(observe(state, other));
  return g.confidence >= 0.6 ? g.guess : null;
}

/**
 * 敌意分:+1 是「非打不可」,−1 是「自己人,别碰」。
 * 藏花(内奸)另有一套:夺花还在就护着花主,清干净了再单挑。
 */
export function attitude(state: GameState, me: number, other: number, tier: AiTier): number {
  if (me === other) return -1;
  const mine = state.players[me];
  if (!mine) return 0;
  if (tier === "rookie") return 0.5;

  const role = guessRoleOf(state, me, other, tier);
  // 地狱档头两圈对看不出身份的人手下留情:信息比一张花瓣击值钱,先看别人怎么打
  const unknown = tier === "hell" && state.round <= 2 ? 0.18 : 0.35;
  if (mine.role === "spy") return spyAttitude(state, me, other, role);

  const table: Record<Role, Record<Role, number>> = {
    lord: { lord: -1, loyal: -1, rebel: 1, spy: 0.6 },
    loyal: { lord: -1, loyal: -0.6, rebel: 1, spy: 0.6 },
    rebel: { lord: 1, loyal: 0.7, rebel: -1, spy: 0.2 },
    spy: { lord: 0, loyal: 0, rebel: 0, spy: 0 }
  };
  let value = role ? table[mine.role][role] : unknown;

  // 地狱档的夺花会装护花:开局第一圈先不碰元气还满的花主,免得被合力针对。
  // 只有手边确实还有够得着的别人可打时才装,不然就是白白浪费一回合。
  if (tier === "hell" && mine.role === "rebel" && role === "lord" && state.round <= 1) {
    const lord = state.players[other];
    const reach = rangeOf(state, me);
    const hasAlt = aliveIds(state).some(
      (id) =>
        id !== me &&
        id !== other &&
        guessRoleOf(state, me, id, tier) !== "rebel" &&
        distanceBetween(state, me, id) <= reach
    );
    if (hasAlt && lord.vigor >= lord.maxVigor) value *= 0.5;
  }
  return value;
}

/** 藏花:夺花没清完就护着花主,清完了才回头单挑 */
function spyAttitude(state: GameState, me: number, other: number, role: Role | null): number {
  const rebelsLeft = state.players.filter((p) => !p.out && p.role === "rebel").length;
  const aliveCount = aliveIds(state).length;
  if (role === "lord") {
    if (rebelsLeft > 0) return -0.8;
    return aliveCount <= 2 ? 1 : 0.1;
  }
  if (role === "rebel") return 1;
  if (role === "loyal") return 0.8;
  return 0.5;
}

// ---------------------------------------------------------------------------
// 响应决策
// ---------------------------------------------------------------------------

/** 一张牌留在手里值多少(数字越大越舍不得弃) */
export function cardValue(card: Card, tier: AiTier): number {
  switch (card.kind) {
    case "dodge":
      return isSmart(tier) ? 9 : 4;
    case "heal":
      return 10;
    case "nullify":
      return isSmart(tier) ? 8 : 3;
    case "slash":
      return 6;
    case "weapon":
    case "armor":
      return 5;
    case "horsePlus":
    case "horseMinus":
      return 4;
    default:
      return 5;
  }
}

/** AI 怎么回答一个请求 */
export function decideRespond(state: GameState, req: Request, tier: AiTier): Reply {
  const me = state.players[req.who];
  if (!me) return { card: null };

  if (req.kind === "discard") {
    // 高手与地狱先弃闲牌,星星盾和蜜桃愈能留就留
    const sorted = [...me.hand].sort((a, b) => cardValue(a, tier) - cardValue(b, tier));
    return { cards: sorted.slice(0, req.count) };
  }

  if (req.kind === "pick") {
    const pool = exposedCards(state.players[req.target]);
    if (pool.length === 0) return { card: null };
    if (!isSmart(tier)) return { card: pool[0] };
    const rank = (c: Card): number => {
      if (c.kind === "weapon") return 0;
      if (c.kind === "armor") return 1;
      if (c.kind === "horsePlus" || c.kind === "horseMinus") return 2;
      return 3;
    };
    return { card: [...pool].sort((a, b) => rank(a) - rank(b))[0] };
  }

  switch (req.need) {
    case "dodge": {
      const dodge = me.hand.find((c) => c.kind === "dodge");
      if (dodge) return { card: dodge };
      // 啾啾的啾鸣:随便一张也能挡,但只在元气吃紧时才舍得
      if (hasSkill(state, req.who, "chirp") && me.hand.length > 0 && (me.vigor <= 2 || !isSmart(tier))) {
        const cheapest = [...me.hand].sort((a, b) => cardValue(a, tier) - cardValue(b, tier))[0];
        return { card: cheapest };
      }
      return { card: null };
    }
    case "slash": {
      const slash = me.hand.find((c) => c.kind === "slash");
      if (slash) return { card: slash };
      if (hasSkill(state, req.who, "flashStep")) {
        const dodge = me.hand.find((c) => c.kind === "dodge");
        if (dodge) return { card: dodge };
      }
      return { card: null };
    }
    case "heal": {
      const heal = me.hand.find((c) => c.kind === "heal");
      if (!heal) return { card: null };
      const dying = req.from;
      if (dying === null || dying === req.who) return { card: heal };
      if (tier === "rookie") return { card: null };
      // 救不救人看阵营:藏花在夺花清干净之前一定救花主
      const want = attitude(state, req.who, dying, tier);
      return want <= -0.5 ? { card: heal } : { card: null };
    }
    case "nullify": {
      if (!isSmart(tier)) return { card: null };
      const card = me.hand.find((c) => c.kind === "nullify");
      if (!card) return { card: null };
      const from = req.from;
      if (from === null) return { card: null };
      // 冲着自己人(或自己)来的锦囊才值得挡
      const hostileToMe = attitude(state, req.who, from, tier) > 0.5;
      if (tier !== "hell") return hostileToMe ? { card } : { card: null };
      // 地狱档还看这一张是冲着谁去的:打到自己人身上就挡,打到敌人身上就让它过
      const at = req.target;
      if (typeof at !== "number" || at === req.who) return hostileToMe ? { card } : { card: null };
      const towards = attitude(state, req.who, at, tier);
      if (towards >= 0.5) return { card: null };
      return hostileToMe || towards <= -0.5 ? { card } : { card: null };
    }
    default:
      return { card: null };
  }
}

// ---------------------------------------------------------------------------
// 出牌决策
// ---------------------------------------------------------------------------

export type AiAction =
  | { kind: "play"; card: Card; targets: number[] }
  | { kind: "gift"; card: Card; to: number }
  | { kind: "end" };

interface Scored {
  action: AiAction;
  score: number;
}

/**
 * 挂上这件装备能不能把「本来够不着的人」变成够得着。
 * `newRange` 是换装之后的攻击范围,`shrink` 是坐骑带来的距离减免。
 */
function unlockBonus(state: GameState, who: number, tier: AiTier, newRange: number, shrink: number): number {
  const me = state.players[who];
  if (!me || !me.hand.some((c) => c.kind === "slash")) return 0;
  const now = rangeOf(state, who);
  for (const id of aliveIds(state)) {
    if (id === who) continue;
    if (attitude(state, who, id, tier) <= 0.4) continue;
    const d = distanceBetween(state, who, id);
    if (d > now && d - shrink <= newRange) return 40;
  }
  return 0;
}

/** 这一枪打过去有多值:元气越低、手牌越少越该打 */
function finishBonus(state: GameState, target: number, tier: AiTier): number {
  const p = state.players[target];
  if (!p) return 0;
  let bonus = (5 - Math.min(5, p.vigor)) * 6;
  if (tier === "hell") {
    bonus += Math.max(0, 4 - p.hand.length) * 4;
    bonus += p.vigor <= 1 ? 25 : 0;
  }
  return bonus;
}

/** 把这一回合所有能打的牌都摆出来打分 */
export function scoreActions(state: GameState, who: number, tier: AiTier): Scored[] {
  const me = state.players[who];
  const out: Scored[] = [];
  if (!me || me.out) return out;
  const myRange = rangeOf(state, who);

  for (const card of me.hand) {
    const targets = legalTargets(card, state, who);

    if (card.kind === "weapon") {
      const cur = me.gear.weapon;
      const curRange = cur?.gear ? GEARS[cur.gear].range ?? 1 : 0;
      const next = card.gear ? GEARS[card.gear] : undefined;
      const gain = (next?.range ?? 1) - curRange + (next?.unlimitedSlash ? 2 : 0);
      if (gain > 0) {
        const unlock = tier === "hell" ? unlockBonus(state, who, tier, next?.range ?? 1, 0) : 0;
        out.push({ action: { kind: "play", card, targets: [who] }, score: 30 + gain * 6 + unlock });
      }
      continue;
    }
    if (card.kind === "armor" && !me.gear.armor) {
      out.push({ action: { kind: "play", card, targets: [who] }, score: 26 });
      continue;
    }
    if (card.kind === "horsePlus" && !me.gear.horsePlus) {
      out.push({ action: { kind: "play", card, targets: [who] }, score: 22 });
      continue;
    }
    if (card.kind === "horseMinus" && !me.gear.horseMinus) {
      const unlock = tier === "hell" ? unlockBonus(state, who, tier, myRange, 1) : 0;
      out.push({ action: { kind: "play", card, targets: [who] }, score: 22 + unlock });
      continue;
    }
    if (card.kind === "heal") {
      if (me.vigor < me.maxVigor) {
        out.push({ action: { kind: "play", card, targets: [who] }, score: me.vigor <= 1 ? 90 : 24 });
      }
      continue;
    }
    if (isGroupTrick(card.kind)) {
      let sum = 0;
      for (const id of aliveIds(state)) {
        if (id === who) continue;
        sum += attitude(state, who, id, tier) * 12;
      }
      if (sum > 0) out.push({ action: { kind: "play", card, targets: [] }, score: sum });
      continue;
    }

    for (const t of targets) {
      const hate = attitude(state, who, t, tier);
      if (hate <= 0) continue;
      let score = 0;
      switch (card.kind) {
        case "slash":
          score = 50 * hate + finishBonus(state, t, tier);
          // 地狱档还会数距离:同样该打的人,先打不用绕远的那个
          if (tier === "hell") score -= (distanceBetween(state, who, t) - 1) * 1.5;
          break;
        case "duel":
          score = me.hand.filter((c) => c.kind === "slash").length >= 2 ? 34 * hate : 8 * hate;
          break;
        case "snatch":
          score = 28 * hate + (state.players[t].gear.weapon ? 10 : 0);
          break;
        case "dismantle":
          score = 26 * hate + (state.players[t].gear.armor ? 12 : 0) + (state.players[t].gear.weapon ? 8 : 0);
          break;
        case "playful":
          score = 20 * hate;
          break;
        case "borrow": {
          const victims = borrowVictims(state, t, who).filter((v) => attitude(state, who, v, tier) > 0.4);
          if (victims.length === 0) continue;
          out.push({ action: { kind: "play", card, targets: [t, victims[0]] }, score: 24 });
          continue;
        }
        default:
          continue;
      }
      if (score > 0) out.push({ action: { kind: "play", card, targets: [t] }, score });
    }
  }

  // 花主的赠花:元气没满时送一张给自己人,换 1 点元气
  if (giftLeft(state, who) > 0 && me.vigor < me.maxVigor && me.hand.length > 1) {
    const friend = aliveIds(state)
      .filter((id) => id !== who)
      .sort((a, b) => attitude(state, who, a, tier) - attitude(state, who, b, tier))[0];
    if (typeof friend === "number" && attitude(state, who, friend, tier) < 0) {
      const cheapest = [...me.hand].sort((a, b) => cardValue(a, tier) - cardValue(b, tier))[0];
      out.push({ action: { kind: "gift", card: cheapest, to: friend }, score: 28 });
    }
  }

  void myRange;
  return out.sort((a, b) => b.score - a.score);
}

/** 这一步打什么 */
export function decideAction(state: GameState, who: number, tier: AiTier): AiAction {
  const list = scoreActions(state, who, tier);
  if (list.length === 0) return { kind: "end" };
  if (tier === "rookie") {
    // 菜鸟不看身份,能打就打,顺序随手
    const idx = Math.floor(state.rand() * list.length);
    return list[Math.min(idx, list.length - 1)].action;
  }
  return list[0].score > 0 ? list[0].action : { kind: "end" };
}

/** AI 的一整个回合:判定 → 摸牌 → 出牌 → 弃牌 */
export function* runAiTurn(state: GameState, who: number, tier: AiTier): Flow<void> {
  startTurn(state, who);
  const me = state.players[who];
  if (!me || me.out || state.over) return;
  if (!me.skipPlay) {
    let guard = 0;
    while (guard++ < 24 && !state.over && !me.out) {
      const action = decideAction(state, who, tier);
      if (action.kind === "end") break;
      if (action.kind === "gift") {
        if (!giftCard(state, who, action.to, action.card)) break;
        continue;
      }
      if (!canPlay(state, who, action.card, action.targets)) break;
      const ok = yield* playCard(state, who, action.card, action.targets);
      if (!ok) break;
    }
  }
  if (!state.over && !me.out) yield* endTurn(state, who);
}

// ---------------------------------------------------------------------------
// 全自动模拟(强度对比与关卡体检用)
// ---------------------------------------------------------------------------

export interface MatchOptions {
  seed: number;
  /** 五个座位各自的档位 */
  tiers: AiTier[];
  /** 指定身份;不给就按种子随机 */
  roles?: Role[];
  /** 指定英杰;不给就按种子随机 */
  heroIds?: string[];
  /** 最多打几圈,到点算和局 */
  maxRounds?: number;
}

export interface MatchResult {
  winner: Camp | null;
  rounds: number;
  /** 还站在桌上的座位 */
  alive: number[];
  roles: Role[];
}

export const DEFAULT_ROLES: readonly Role[] = ["lord", "loyal", "rebel", "rebel", "spy"];

export const SEAT_NAMES: readonly string[] = ["朵朵", "星星", "糯糯", "云云", "闪闪"];

/** 洗一副身份:座位 0 固定当花主,其余四个随机 */
export function rollRoles(rand: () => number): Role[] {
  const rest: Role[] = ["loyal", "rebel", "rebel", "spy"];
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return ["lord", ...rest];
}

/** 抽五名不重样的英杰,主公从主公候选里挑 */
export function rollHeroes(rand: () => number, roles: readonly Role[]): string[] {
  const pool = HEROES.map((h) => h.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out: string[] = [];
  for (let i = 0; i < roles.length; i++) {
    if (roles[i] === "lord") {
      const lordHero = pool.find((id) => HEROES.find((h) => h.id === id)?.lordCandidate) ?? pool[0];
      out.push(lordHero);
      pool.splice(pool.indexOf(lordHero), 1);
    } else {
      out.push(pool.shift() ?? HEROES[i % HEROES.length].id);
    }
  }
  return out;
}

/** 五个 AI 自己打一局,谁都不作弊,用来比档位强度 */
export function simulateMatch(opts: MatchOptions): MatchResult {
  const seedRand = (() => {
    let a = (opts.seed >>> 0) || 1;
    return () => {
      a = (a + 0x9e3779b9) | 0;
      let t = Math.imul(a ^ (a >>> 16), 2246822507);
      t = Math.imul(t ^ (t >>> 13), 3266489909);
      return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
    };
  })();
  const roles = opts.roles ? [...opts.roles] : rollRoles(seedRand);
  const heroIds = opts.heroIds ? [...opts.heroIds] : rollHeroes(seedRand, roles);
  const seats: SeatSpec[] = roles.map((role, i) => ({
    name: SEAT_NAMES[i] ?? `伙伴${i + 1}`,
    heroId: heroIds[i],
    role
  }));
  const state = createGame({ seats, seed: opts.seed });
  const maxRounds = opts.maxRounds ?? 40;

  const respond = (req: Request): Reply => decideRespond(state, req, opts.tiers[req.who] ?? "normal");

  let guard = 0;
  while (!state.over && state.round <= maxRounds && guard++ < 400) {
    const who = state.turn;
    if (!state.players[who].out) {
      runFlow(runAiTurn(state, who, opts.tiers[who] ?? "normal"), respond);
    }
    if (state.over) break;
    advanceTurn(state);
  }

  return {
    winner: state.winner,
    rounds: state.round,
    alive: aliveIds(state),
    roles
  };
}

/** 固定种子跑 n 局,统计某个座位的阵营赢了几次 */
export function winRate(seatId: number, tiers: AiTier[], games: number, baseSeed = 1000, roles?: Role[]): number {
  let wins = 0;
  for (let i = 0; i < games; i++) {
    const res = simulateMatch({ seed: baseSeed + i * 7, tiers, roles });
    if (res.winner && res.winner === campOf(res.roles[seatId])) wins++;
  }
  return wins / games;
}
