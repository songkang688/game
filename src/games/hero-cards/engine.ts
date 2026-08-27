/**
 * 英杰令 · 规则引擎。
 *
 * 为什么用生成器:出一张「花瓣击」要等对方决定挡不挡,出一张锦囊要挨个问无懈,
 * 而无懈还能反制无懈。回调式写法在这种递归里会炸开,所以规则一律写成
 * `Generator<Request, T, Reply>`:需要谁做决定就 `yield` 一个请求,
 * 驱动方(界面按钮 / 单测脚本 / AI)把回答 `next` 回来。规则只写一遍,三边共用。
 *
 * 分级:元气归零叫「退场休息」,受创是掉花瓣,全程没有死亡与流血的说法。
 */
import {
  cardLabel,
  cardName,
  createPile,
  discardTo,
  draw as drawFromPile,
  flipTop,
  isRed,
  type Card,
  type CardKind,
  type DeckEntry,
  type GearSlot,
  type Pile,
  GEARS
} from "./cards";
import { attackRange, distance, inSlashRange, type Horses, type Seat } from "./distance";
import { hasSkill, heroOf, queryFlag, queryNumber, trigger, type Effect } from "./heroes";

// ---------------------------------------------------------------------------
// 身份与局面
// ---------------------------------------------------------------------------

/** 主公 / 忠臣 / 反贼 / 内奸 */
export type Role = "lord" | "loyal" | "rebel" | "spy";

/** 阵营:忠(主公+忠臣) / 反 / 内 */
export type Camp = "lord" | "rebel" | "spy";

export const ROLE_LABELS: Record<Role, string> = {
  lord: "花主",
  loyal: "护花",
  rebel: "夺花",
  spy: "藏花"
};

export const ROLE_EMOJI: Record<Role, string> = {
  lord: "👑",
  loyal: "🛡️",
  rebel: "🔥",
  spy: "🎭"
};

export const ROLE_DESC: Record<Role, string> = {
  lord: "开局就亮明身份,元气上限 +1。把夺花与藏花都请下桌就算赢。",
  loyal: "藏在人群里护着花主。夺花与藏花全部退场就算赢。",
  rebel: "两个人一伙。只要花主退场,而且不是只剩藏花一个人,就算赢。",
  spy: "先帮花主清场,最后一个人留下才算赢。花主退早了反而输。"
};

/** 阵营归属 */
export function campOf(role: Role): Camp {
  return role === "lord" || role === "loyal" ? "lord" : role === "rebel" ? "rebel" : "spy";
}

export const CAMP_LABELS: Record<Camp, string> = {
  lord: "护花阵营",
  rebel: "夺花阵营",
  spy: "藏花"
};

export interface Player {
  id: number;
  name: string;
  heroId: string;
  role: Role;
  /** 身份牌翻开了没有(主公开局就是 true) */
  revealed: boolean;
  vigor: number;
  maxVigor: number;
  hand: Card[];
  /** 装备区:每个位置最多一件 */
  gear: Partial<Record<GearSlot, Card>>;
  /** 判定区:延时锦囊 */
  delayed: Card[];
  /** 退场休息中 */
  out: boolean;
  /** 一次性技能计数(每回合 / 每局) */
  flags: Record<string, number>;
  /** 本回合出过几张「花瓣击」 */
  slashUsed: number;
  /** 本回合送出去几张手牌(花主的赠花) */
  giftUsed: number;
  /** 这一回合被贪玩令跳过出牌阶段 */
  skipPlay: boolean;
}

export interface GameState {
  players: Player[];
  pile: Pile;
  /** 当前回合的座位 */
  turn: number;
  /** 绕了几圈 */
  round: number;
  over: boolean;
  winner: Camp | null;
  log: string[];
  rand: () => number;
  /** 双势力合作小关:同阵营之间不能互相出击牌 */
  factionLock: boolean;
  /** 桌面上看得见的动作流水:谁对谁不客气、谁帮了谁。AI 的身份推理只能看这个 */
  acts: Act[];
}

/** 一条看得见的动作:身份推理的唯一信息来源 */
export interface Act {
  actor: number;
  target: number;
  kind: "hostile" | "help";
  round: number;
}

/** mulberry32:同一个种子永远给出同一局 */
export function makeRand(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 请求与回答:界面 / AI / 单测共用的一层
// ---------------------------------------------------------------------------

export type Need = "dodge" | "slash" | "heal" | "nullify";

export type Request =
  /** 请 who 打出一张牌来响应 */
  | {
      kind: "respond";
      who: number;
      need: Need;
      prompt: string;
      from: number | null;
      /** 这张牌冲着谁去的;全场生效的锦囊不填 */
      target?: number;
      card?: Card;
    }
  /** 请 who 从 target 那里挑一张牌(顺手 / 拆解) */
  | { kind: "pick"; who: number; target: number; prompt: string }
  /** 请 who 弃 count 张手牌 */
  | { kind: "discard"; who: number; count: number; prompt: string };

export interface Reply {
  /** 打出 / 挑中的那张牌;不做就给 null */
  card?: Card | null;
  /** 弃牌请求的答复 */
  cards?: Card[];
}

export type Flow<T = void> = Generator<Request, T, Reply>;

/** 一路把生成器跑完,请求交给 respond 回答(单测与纯 AI 模拟用) */
export function runFlow<T>(flow: Flow<T>, respond: (req: Request) => Reply): T {
  let step = flow.next({} as Reply);
  let guard = 0;
  while (!step.done) {
    if (++guard > 20000) throw new Error("hero-cards: 结算步数异常,可能有环");
    step = flow.next(respond(step.value) ?? {});
  }
  return step.value;
}

// ---------------------------------------------------------------------------
// 建局
// ---------------------------------------------------------------------------

export interface SeatSpec {
  name: string;
  heroId: string;
  role: Role;
  /** 起手牌;不给就按规则摸 4 张 */
  hand?: Card[];
  /**
   * 起始元气;不给就用英杰上限(主公 +1)。
   * 残局里写了几点就是几点,上限也跟着压到这个数 —— 不然「1 点元气的残兵」
   * 吃一颗蜜桃愈就能补回英杰的满元气,残局就没法算了。
   */
  vigor?: number;
  /** 想让上限和起始元气不一样时单独写 */
  maxVigor?: number;
  gear?: Card[];
  /** 判定区里预先贴好的延时锦囊(残局用) */
  delayed?: Card[];
  revealed?: boolean;
}

export interface GameOptions {
  seats: SeatSpec[];
  seed: number;
  recipe?: readonly DeckEntry[];
  factionLock?: boolean;
  /** 起手摸几张 */
  openHand?: number;
}

export function createGame(opts: GameOptions): GameState {
  const rand = makeRand(opts.seed);
  const pile = createPile(rand, opts.recipe);
  const state: GameState = {
    players: [],
    pile,
    turn: 0,
    round: 1,
    over: false,
    winner: null,
    log: [],
    rand,
    factionLock: Boolean(opts.factionLock),
    acts: []
  };

  opts.seats.forEach((spec, id) => {
    const hero = heroOf(spec.heroId);
    const maxVigor = spec.maxVigor ?? spec.vigor ?? hero.vigor + (spec.role === "lord" ? 1 : 0);
    const p: Player = {
      id,
      name: spec.name,
      heroId: spec.heroId,
      role: spec.role,
      revealed: spec.revealed ?? spec.role === "lord",
      vigor: spec.vigor ?? maxVigor,
      maxVigor,
      hand: spec.hand ? [...spec.hand] : [],
      gear: {},
      delayed: spec.delayed ? [...spec.delayed] : [],
      out: false,
      flags: {},
      slashUsed: 0,
      giftUsed: 0,
      skipPlay: false
    };
    for (const g of spec.gear ?? []) {
      const slot = gearSlotOf(g);
      if (slot) p.gear[slot] = g;
    }
    state.players.push(p);
  });

  const open = opts.openHand ?? 4;
  for (const p of state.players) {
    if (!opts.seats[p.id].hand) p.hand.push(...drawFromPile(pile, open));
  }
  return state;
}

/** 一张装备牌该挂在哪个位置 */
export function gearSlotOf(card: Card): GearSlot | null {
  if (card.kind === "weapon" || card.kind === "armor" || card.kind === "horsePlus" || card.kind === "horseMinus") {
    return card.kind;
  }
  return null;
}

export function say(state: GameState, line: string): void {
  state.log.push(line);
  if (state.log.length > 200) state.log.shift();
}

/** 记一笔看得见的动作(不记手牌内容,身份推理只能靠这些) */
export function recordAct(state: GameState, actor: number, target: number, kind: Act["kind"]): void {
  if (actor === target || actor < 0 || target < 0) return;
  state.acts.push({ actor, target, kind, round: state.round });
  if (state.acts.length > 400) state.acts.shift();
}

// ---------------------------------------------------------------------------
// 座位 / 距离 / 合法目标
// ---------------------------------------------------------------------------

export function aliveIds(state: GameState): number[] {
  return state.players.filter((p) => !p.out).map((p) => p.id);
}

export function seatsOf(state: GameState): Seat[] {
  return state.players.map((p) => ({ id: p.id, out: p.out }));
}

/** 坐骑与技能带来的距离修正 */
export function horsesOf(state: GameState): Horses {
  const plus: number[] = [];
  const minus: number[] = [];
  const extraPlus: Record<number, number> = {};
  for (const p of state.players) {
    if (p.out) continue;
    if (p.gear.horsePlus) plus.push(p.id);
    if (p.gear.horseMinus) minus.push(p.id);
    const bonus = queryNumber(state, { kind: "distanceTo", who: p.id, base: 0 });
    if (bonus !== 0) extraPlus[p.id] = bonus;
  }
  return { plus, minus, extraPlus };
}

/** 环上距离(算好坐骑与技能) */
export function distanceBetween(state: GameState, from: number, to: number): number {
  return distance(from, to, seatsOf(state), horsesOf(state));
}

/** 攻击范围:武器说了算,没武器就是 1 */
export function rangeOf(state: GameState, who: number): number {
  const weapon = state.players[who]?.gear.weapon;
  return attackRange(weapon?.gear ? GEARS[weapon.gear].range : undefined);
}

/** 「花瓣击」够不够得着 */
export function canSlash(state: GameState, from: number, to: number): boolean {
  return inSlashRange(from, to, { seats: seatsOf(state), horses: horsesOf(state), weaponRange: rangeOf(state, from) });
}

/** 本回合还能不能再出「花瓣击」 */
export function slashLeft(state: GameState, who: number): boolean {
  const p = state.players[who];
  if (!p) return false;
  const weapon = p.gear.weapon;
  if (weapon?.gear && GEARS[weapon.gear].unlimitedSlash) return true;
  return p.slashUsed < 1;
}

/** 双势力合作小关:同阵营之间不能互相出击牌 */
function factionBlocked(state: GameState, from: number, to: number): boolean {
  if (!state.factionLock) return false;
  const a = state.players[from];
  const b = state.players[to];
  return Boolean(a && b && campOf(a.role) === campOf(b.role));
}

/** 这张牌现在能指向谁(空数组表示当下打不出去,或者这张牌不需要选目标) */
export function legalTargets(card: Card, state: GameState, actor: number): number[] {
  const me = state.players[actor];
  if (!me || me.out) return [];
  const others = aliveIds(state).filter((id) => id !== actor);
  switch (card.kind) {
    case "slash":
      if (!slashLeft(state, actor)) return [];
      return others.filter((id) => canSlash(state, actor, id) && !factionBlocked(state, actor, id));
    case "heal":
      return me.vigor < me.maxVigor ? [actor] : [];
    case "snatch": {
      const need = queryNumber(state, { kind: "snatchRange", who: actor, base: 1 });
      return others.filter(
        (id) => distanceBetween(state, actor, id) <= need && countCards(state.players[id]) > 0
      );
    }
    case "dismantle":
      return others.filter((id) => countCards(state.players[id]) > 0);
    case "duel":
      return others.filter((id) => !factionBlocked(state, actor, id));
    case "playful":
      return others.filter((id) => !state.players[id].delayed.some((c) => c.kind === "playful"));
    case "borrow":
      return others.filter((id) => Boolean(state.players[id].gear.weapon) && borrowVictims(state, id, actor).length > 0);
    case "weapon":
    case "armor":
    case "horsePlus":
    case "horseMinus":
      return [actor];
    case "petalStorm":
    case "starShower":
      return others.length > 0 ? [] : [];
    default:
      return [];
  }
}

/** 群体锦囊不用选目标,但要有人可以吃 */
export function isGroupTrick(kind: CardKind): boolean {
  return kind === "petalStorm" || kind === "starShower";
}

/** 这张牌不选目标也能打出去吗 */
export function needsNoTarget(card: Card): boolean {
  return isGroupTrick(card.kind);
}

/** 「春风借力」里,持刀人能打谁 */
export function borrowVictims(state: GameState, holder: number, actor: number): number[] {
  return aliveIds(state).filter(
    (id) => id !== holder && canSlash(state, holder, id) && !factionBlocked(state, holder, id)
  );
}

/** 手牌 + 装备 + 判定区一共几张(顺手 / 拆解看这个) */
export function countCards(p: Player): number {
  return p.hand.length + Object.values(p.gear).filter(Boolean).length + p.delayed.length;
}

/** 一名角色身上能被顺 / 被拆的所有牌 */
export function exposedCards(p: Player): Card[] {
  return [...p.hand, ...Object.values(p.gear).filter((c): c is Card => Boolean(c)), ...p.delayed];
}

// ---------------------------------------------------------------------------
// 牌的进出
// ---------------------------------------------------------------------------

export function drawCards(state: GameState, who: number, n: number): Card[] {
  const p = state.players[who];
  if (!p || p.out || n <= 0) return [];
  const got = drawFromPile(state.pile, n);
  p.hand.push(...got);
  return got;
}

/** 从某人身上拿走一张牌(手牌 / 装备 / 判定区都行),返回是不是真的拿到了 */
export function removeCard(state: GameState, who: number, card: Card): boolean {
  const p = state.players[who];
  if (!p) return false;
  const hi = p.hand.findIndex((c) => c.id === card.id);
  if (hi >= 0) {
    p.hand.splice(hi, 1);
    return true;
  }
  for (const slot of Object.keys(p.gear) as GearSlot[]) {
    if (p.gear[slot]?.id === card.id) {
      delete p.gear[slot];
      onGearLost(state);
      return true;
    }
  }
  const di = p.delayed.findIndex((c) => c.id === card.id);
  if (di >= 0) {
    p.delayed.splice(di, 1);
    return true;
  }
  return false;
}

/** 装备离场:风铃这类技能靠这个响 */
function onGearLost(state: GameState): void {
  applyEffects(state, trigger(state, { kind: "gearLost", who: -1 }));
}

export function toDiscard(state: GameState, cards: readonly Card[]): void {
  discardTo(state.pile, cards);
}

/** 把技能吐出来的效果落地(不含要问人的那几种) */
export function applyEffects(state: GameState, effects: readonly Effect[]): void {
  for (const eff of effects) {
    switch (eff.kind) {
      case "draw":
        drawCards(state, eff.who, eff.n);
        break;
      case "heal": {
        const p = state.players[eff.who];
        if (p && !p.out) p.vigor = Math.min(p.maxVigor, p.vigor + eff.n);
        break;
      }
      case "steal": {
        const from = state.players[eff.from];
        const to = state.players[eff.who];
        if (!from || !to || from.out || to.out) break;
        for (let i = 0; i < eff.n; i++) {
          const pool = exposedCards(from);
          if (pool.length === 0) break;
          const card = pool[Math.floor(state.rand() * pool.length)];
          if (removeCard(state, from.id, card)) to.hand.push(card);
        }
        say(state, `${to.name} 从 ${from.name} 那儿顺走一张牌。`);
        break;
      }
      case "bloom": {
        const p = state.players[eff.who];
        if (!p || p.hand.length < 2) break;
        const paid = p.hand.splice(0, 2);
        toDiscard(state, paid);
        p.flags.bloomAgain = (p.flags.bloomAgain ?? 0) + 1;
        p.vigor = Math.max(p.vigor, 1);
        say(state, `${p.name} 又开了一朵花,回到 1 点元气。`);
        break;
      }
      case "note":
        say(state, eff.text);
        break;
      case "delta":
      case "flag":
      default:
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// 判定
// ---------------------------------------------------------------------------

export interface JudgeResult {
  card: Card | null;
  /** 翻出来的是不是红门 */
  red: boolean;
  /** 被露白换过 */
  swapped: boolean;
}

/**
 * 判定:翻牌堆顶一张。
 * 露白的「凝露」只在明显有利时才自动换牌(手上有红门牌、而翻出来的是黑门)。
 */
export function judge(state: GameState, who: number, wantRed = true): JudgeResult {
  const card = flipTop(state.pile);
  if (!card) return { card: null, red: false, swapped: false };
  let now = card;
  let swapped = false;
  const good = wantRed ? isRed(now) : !isRed(now);
  if (!good && hasSkill(state, who, "dewTurn") && queryFlag(state, { kind: "judgeSwap", who })) {
    const p = state.players[who];
    const better = p?.hand.find((c) => (wantRed ? isRed(c) : !isRed(c)));
    if (better && p) {
      p.hand.splice(p.hand.indexOf(better), 1);
      toDiscard(state, [better]);
      now = better;
      swapped = true;
      say(state, `${p.name} 用「凝露」把判定换成了 ${cardLabel(better)}。`);
    }
  }
  return { card: now, red: isRed(now), swapped };
}

// ---------------------------------------------------------------------------
// 掉元气 / 退场 / 胜负
// ---------------------------------------------------------------------------

/**
 * 身份胜负。规格签名:`winnerOf(alive, roles)`。
 * 还没分出来返回 null。
 */
export function winnerOf(alive: readonly number[], roles: readonly Role[]): Camp | null {
  const lordId = roles.indexOf("lord");
  const list = [...new Set(alive)].filter((id) => id >= 0 && id < roles.length);
  if (lordId < 0) {
    // 没有主公的小关(双势力合作):一边全退场,另一边就赢
    const camps = new Set(list.map((id) => campOf(roles[id])));
    if (camps.size <= 1 && list.length > 0) return [...camps][0] ?? null;
    return null;
  }
  if (!list.includes(lordId)) {
    if (list.length === 1 && roles[list[0]] === "spy") return "spy";
    return "rebel";
  }
  const enemyAlive = list.some((id) => roles[id] === "rebel" || roles[id] === "spy");
  return enemyAlive ? null : "lord";
}

/** 奖惩。规格签名:`onEliminated(killer, victim)` */
export interface ElimReward {
  /** 让别人退场的那个人摸几张 */
  draw: number;
  /** 主公误让忠臣退场:弃光手牌与装备 */
  discardAll: boolean;
}

export function onEliminated(
  killer: { id: number; role: Role } | null,
  victim: { id: number; role: Role }
): ElimReward {
  const out: ElimReward = { draw: 0, discardAll: false };
  if (victim.role === "rebel" && killer) out.draw = 3;
  if (victim.role === "loyal" && killer && killer.role === "lord" && killer.id !== victim.id) out.discardAll = true;
  return out;
}

/** 结算胜负,顺手把 state.over / winner 写上 */
export function checkOver(state: GameState): Camp | null {
  const camp = winnerOf(
    aliveIds(state),
    state.players.map((p) => p.role)
  );
  if (camp && !state.over) {
    state.over = true;
    state.winner = camp;
    for (const p of state.players) p.revealed = true;
    say(state, `一局结束:${CAMP_LABELS[camp]}赢了。`);
  }
  return camp;
}

/** 退场休息:牌全部进弃牌堆,身份翻开,再结算奖惩 */
export function eliminate(state: GameState, victimId: number, killerId: number | null): void {
  const victim = state.players[victimId];
  if (!victim || victim.out) return;
  victim.out = true;
  victim.revealed = true;
  victim.vigor = 0;
  toDiscard(state, [...victim.hand, ...Object.values(victim.gear).filter((c): c is Card => Boolean(c)), ...victim.delayed]);
  victim.hand = [];
  victim.gear = {};
  victim.delayed = [];
  say(state, `${victim.name}(${ROLE_LABELS[victim.role]})先回后台休息啦,下一局再来。`);

  const killer = killerId !== null && state.players[killerId] ? state.players[killerId] : null;
  const reward = onEliminated(killer ? { id: killer.id, role: killer.role } : null, {
    id: victim.id,
    role: victim.role
  });
  if (reward.draw > 0 && killer && !killer.out) {
    drawCards(state, killer.id, reward.draw);
    say(state, `${killer.name} 请走了一位夺花,摸 ${reward.draw} 张。`);
  }
  if (reward.discardAll && killer) {
    toDiscard(state, [...killer.hand, ...Object.values(killer.gear).filter((c): c is Card => Boolean(c))]);
    killer.hand = [];
    killer.gear = {};
    say(state, `${killer.name} 认错了人,把手牌和装备全放下了。`);
  }
  checkOver(state);
}

/** 掉元气(受创是掉花瓣)。元气归零就进「有没有人救」的流程 */
export function* damage(state: GameState, whoId: number, amount: number, fromId: number | null): Flow<void> {
  const p = state.players[whoId];
  if (!p || p.out || state.over) return;
  p.vigor -= amount;
  say(state, `${p.name} 掉了 ${amount} 片花瓣,还剩 ${Math.max(0, p.vigor)} 点元气。`);
  applyEffects(state, trigger(state, { kind: "damaged", who: whoId, from: fromId, amount }));
  if (p.vigor > 0) return;
  yield* dying(state, whoId, fromId);
}

/** 元气归零:先看自己的技能能不能撑住,再挨个问谁愿意递一张「蜜桃愈」 */
export function* dying(state: GameState, whoId: number, fromId: number | null): Flow<void> {
  const p = state.players[whoId];
  if (!p || p.out) return;
  applyEffects(state, trigger(state, { kind: "dying", who: whoId }));
  if (p.vigor > 0) return;

  const order = [whoId, ...aliveIds(state).filter((id) => id !== whoId)];
  for (const helper of order) {
    while (p.vigor <= 0) {
      const hp = state.players[helper];
      if (!hp || hp.out) break;
      if (!hp.hand.some((c) => c.kind === "heal")) break;
      const reply: Reply = yield {
        kind: "respond",
        who: helper,
        need: "heal",
        from: whoId,
        prompt: helper === whoId ? "元气见底了,吃一颗蜜桃愈吗?" : `${p.name} 快撑不住了,递一颗蜜桃愈吗?`
      };
      const card = reply?.card;
      if (!card || card.kind !== "heal") break;
      if (!removeCard(state, helper, card)) break;
      toDiscard(state, [card]);
      p.vigor += 1;
      recordAct(state, helper, whoId, "help");
      say(state, `${hp.name} 递了一颗蜜桃愈,${p.name} 回到 ${p.vigor} 点元气。`);
    }
    if (p.vigor > 0) break;
  }
  if (p.vigor <= 0) eliminate(state, whoId, fromId);
}

// ---------------------------------------------------------------------------
// 响应:挡 / 击 / 无懈
// ---------------------------------------------------------------------------

/** 这张牌能不能当「星星盾」用 */
export function usableAsDodge(state: GameState, who: number, card: Card): boolean {
  if (card.kind === "dodge") return true;
  return queryFlag(state, { kind: "anyAsDodge", who });
}

/** 这张牌能不能当「花瓣击」用 */
export function usableAsSlash(state: GameState, who: number, card: Card): boolean {
  if (card.kind === "slash") return true;
  if (card.kind === "dodge") return queryFlag(state, { kind: "dodgeAsSlash", who });
  return false;
}

/** 手上有没有能当挡的牌 */
export function hasDodge(state: GameState, who: number): boolean {
  const p = state.players[who];
  if (!p) return false;
  return p.hand.some((c) => usableAsDodge(state, who, c));
}

export function hasSlashCard(state: GameState, who: number): boolean {
  const p = state.players[who];
  if (!p) return false;
  return p.hand.some((c) => usableAsSlash(state, who, c));
}

/** 打出一张响应牌:牌离手、进弃牌堆、该响的技能响一下 */
function playResponse(state: GameState, who: number, card: Card, as: Need): void {
  if (!removeCard(state, who, card)) return;
  toDiscard(state, [card]);
  const p = state.players[who];
  if (as === "dodge") {
    if (card.kind !== "dodge") p.flags.chirp = (p.flags.chirp ?? 0) + 1;
    say(state, `${p.name} 打出 ${cardLabel(card)} 挡下了。`);
    applyEffects(state, trigger(state, { kind: "afterDodge", who }));
  } else {
    say(state, `${p.name} 打出 ${cardLabel(card)}。`);
  }
}

/**
 * 无懈链:谁手上有「春风无懈」就问一遍,有人打出来就翻转一次「这张锦囊生不生效」,
 * 然后再问一圈 —— 无懈可以反制无懈。返回 true 表示这张锦囊最终被抵消。
 */
export function* askNullify(state: GameState, trickName: string, sourceId: number, targetId: number): Flow<boolean> {
  let cancelled = false;
  let rounds = 0;
  while (rounds++ < 12) {
    let played = false;
    const order = aliveIds(state);
    for (const who of order) {
      const p = state.players[who];
      if (!p || p.out) continue;
      if (!p.hand.some((c) => c.kind === "nullify")) continue;
      const reply: Reply = yield {
        kind: "respond",
        who,
        need: "nullify",
        from: sourceId,
        target: targetId,
        prompt: cancelled
          ? `${trickName} 已经被抵消了,要用春风无懈把它救回来吗?`
          : `${state.players[sourceId]?.name ?? "对手"} 的${trickName}指向 ${
              state.players[targetId]?.name ?? "全场"
            },要抵消吗?`
      };
      const card = reply?.card;
      if (card && card.kind === "nullify" && removeCard(state, who, card)) {
        toDiscard(state, [card]);
        cancelled = !cancelled;
        played = true;
        say(state, `${p.name} 打出春风无懈,${trickName}${cancelled ? "被抵消了" : "又生效了"}。`);
        break;
      }
    }
    if (!played) break;
  }
  return cancelled;
}

// ---------------------------------------------------------------------------
// 各种牌的结算
// ---------------------------------------------------------------------------

/** 一击的结算:算好要几张盾、能不能挡、挡不住就掉元气 */
export function* resolveSlash(state: GameState, fromId: number, toId: number, card: Card): Flow<boolean> {
  const target = state.players[toId];
  const from = state.players[fromId];
  if (!target || target.out || !from || state.over) return false;

  const base = 1;
  const need = Math.max(1, queryNumber(state, { kind: "dodgeNeeded", who: fromId, target: toId, base }));
  if (need > base) from.flags.frostEdge = (from.flags.frostEdge ?? 0) + 1;

  if (queryFlag(state, { kind: "unblockable", who: fromId, card })) {
    say(state, `${from.name} 的红花来得太快,${target.name} 挡不住。`);
    yield* damage(state, toId, 1, fromId);
    return true;
  }

  let blocked = 0;
  for (let i = 0; i < need; i++) {
    // 星纱披风 / 星辉:先翻一张判定,红门就当挡下了。
    // 披风是装备,想翻几次翻几次;星辉是技能,一个回合只给一次。
    const skillJudge = queryFlag(state, { kind: "judgeDodge", who: toId });
    const canJudge = Boolean(target.gear.armor) || skillJudge;
    if (canJudge) {
      if (skillJudge && !target.gear.armor) target.flags.starlight = (target.flags.starlight ?? 0) + 1;
      const res = judge(state, toId, true);
      if (res.card) {
        say(state, `${target.name} 翻出 ${cardLabel(res.card)}${res.red ? ",红门,算挡下了。" : ",黑门,没挡住。"}`);
        if (res.red) {
          blocked++;
          continue;
        }
      }
    }
    if (!hasDodge(state, toId)) break;
    const reply: Reply = yield {
      kind: "respond",
      who: toId,
      need: "dodge",
      from: fromId,
      card,
      prompt: `${from.name} 的花瓣击过来了${need > 1 ? `(要 ${need} 张盾)` : ""},挡吗?`
    };
    const chosen = reply?.card;
    if (!chosen || !usableAsDodge(state, toId, chosen)) break;
    playResponse(state, toId, chosen, "dodge");
    blocked++;
  }

  if (blocked >= need) return false;
  yield* damage(state, toId, 1, fromId);
  return true;
}

/** 对花令:轮流出击,先接不上的那个掉元气 */
export function* resolveDuel(state: GameState, fromId: number, toId: number): Flow<void> {
  let attacker = toId;
  let defender = fromId;
  let guard = 0;
  while (guard++ < 20) {
    const p = state.players[attacker];
    if (!p || p.out) break;
    if (!hasSlashCard(state, attacker)) {
      yield* damage(state, attacker, 1, defender);
      return;
    }
    const reply: Reply = yield {
      kind: "respond",
      who: attacker,
      need: "slash",
      from: defender,
      prompt: `对花令:接一张花瓣击,不然要掉一片花瓣。`
    };
    const card = reply?.card;
    if (!card || !usableAsSlash(state, attacker, card)) {
      yield* damage(state, attacker, 1, defender);
      return;
    }
    playResponse(state, attacker, card, "slash");
    const swap = attacker;
    attacker = defender;
    defender = swap;
  }
}

/** 群体锦囊:每个人各响应一张,响应不了就掉一片花瓣。铁墩这类技能直接免疫 */
export function* resolveGroup(state: GameState, fromId: number, kind: "petalStorm" | "starShower"): Flow<void> {
  const need: Need = kind === "petalStorm" ? "slash" : "dodge";
  const label = kind === "petalStorm" ? "落英缤纷" : "流星阵雨";
  const order = aliveIds(state).filter((id) => id !== fromId);
  for (const who of order) {
    if (state.over) return;
    const p = state.players[who];
    if (!p || p.out) continue;
    if (queryFlag(state, { kind: "groupTrick", who, card: kind })) {
      say(state, `${p.name} 稳稳站着,${label}对他没用。`);
      continue;
    }
    // 一个人一份:替某一位挡下来的春风无懈不管别人
    if (yield* askNullify(state, label, fromId, who)) continue;
    if (state.players[who]?.out) continue;
    const has = need === "slash" ? hasSlashCard(state, who) : hasDodge(state, who);
    if (has) {
      const reply: Reply = yield {
        kind: "respond",
        who,
        need,
        from: fromId,
        prompt: `${label}来了,打一张${need === "slash" ? "花瓣击" : "星星盾"}吗?`
      };
      const card = reply?.card;
      const ok = card ? (need === "slash" ? usableAsSlash(state, who, card) : usableAsDodge(state, who, card)) : false;
      if (card && ok) {
        playResponse(state, who, card, need);
        continue;
      }
    }
    yield* damage(state, who, 1, fromId);
  }
}

/** 顺手摘花 / 拆花篮:挑一张牌拿走或弃掉 */
export function* resolveTake(state: GameState, fromId: number, toId: number, mode: "snatch" | "dismantle"): Flow<void> {
  const target = state.players[toId];
  const actor = state.players[fromId];
  if (!target || target.out || !actor) return;
  if (countCards(target) === 0) return;
  const reply: Reply = yield {
    kind: "pick",
    who: fromId,
    target: toId,
    prompt: mode === "snatch" ? `从 ${target.name} 那儿挑一张拿走` : `挑一张 ${target.name} 的牌放下`
  };
  const pool = exposedCards(target);
  const card = reply?.card && pool.some((c) => c.id === reply.card!.id) ? reply.card : pool[0];
  if (!card) return;
  if (!removeCard(state, toId, card)) return;
  if (mode === "snatch") {
    actor.hand.push(card);
    say(state, `${actor.name} 顺走了 ${target.name} 的一张牌。`);
  } else {
    toDiscard(state, [card]);
    say(state, `${actor.name} 把 ${target.name} 的 ${cardName(card)} 放下了。`);
  }
}

/** 春风借力:请持刀的人去打另一个人,不肯就把武器交出来 */
export function* resolveBorrow(state: GameState, fromId: number, holderId: number, victimId: number): Flow<void> {
  const holder = state.players[holderId];
  const actor = state.players[fromId];
  if (!holder || holder.out || !actor) return;
  if (hasSlashCard(state, holderId)) {
    const reply: Reply = yield {
      kind: "respond",
      who: holderId,
      need: "slash",
      from: fromId,
      prompt: `春风借力:朝 ${state.players[victimId]?.name ?? "对面"} 出一张花瓣击,不然要把武器让出去。`
    };
    const card = reply?.card;
    if (card && usableAsSlash(state, holderId, card)) {
      playResponse(state, holderId, card, "slash");
      yield* resolveSlash(state, holderId, victimId, card);
      return;
    }
  }
  const weapon = holder.gear.weapon;
  if (weapon && removeCard(state, holderId, weapon)) {
    actor.hand.push(weapon);
    say(state, `${holder.name} 不出手,把 ${cardName(weapon)} 让给了 ${actor.name}。`);
  }
}

/** 挂装备:同一个位置上原来那件先放下 */
export function equip(state: GameState, who: number, card: Card): void {
  const p = state.players[who];
  const slot = gearSlotOf(card);
  if (!p || !slot) return;
  const old = p.gear[slot];
  p.gear[slot] = card;
  if (old) {
    toDiscard(state, [old]);
    onGearLost(state);
  }
  say(state, `${p.name} 换上了 ${cardName(card)}。`);
}

// ---------------------------------------------------------------------------
// 出牌
// ---------------------------------------------------------------------------

/** 指向别人、明显不友好的牌:打出来就会被记一笔 */
export const HOSTILE_KINDS: ReadonlySet<CardKind> = new Set<CardKind>([
  "slash",
  "snatch",
  "dismantle",
  "duel",
  "playful",
  "borrow"
]);

/** 这张牌现在能不能打出去 */
export function canPlay(state: GameState, actor: number, card: Card, targets: number[] = []): boolean {
  const p = state.players[actor];
  if (!p || p.out || state.over) return false;
  if (!p.hand.some((c) => c.id === card.id)) return false;
  if (card.kind === "dodge" || card.kind === "nullify") return false;
  if (isGroupTrick(card.kind)) return aliveIds(state).length > 1;
  const legal = legalTargets(card, state, actor);
  if (legal.length === 0) return false;
  if (targets.length === 0) return true;
  if (!legal.includes(targets[0])) return false;
  if (card.kind === "borrow") {
    const victims = borrowVictims(state, targets[0], actor);
    return targets.length < 2 ? victims.length > 0 : victims.includes(targets[1]);
  }
  return true;
}

/**
 * 出一张牌。`targets[0]` 是主目标,「春风借力」还要一个 `targets[1]`。
 * 牌先离手,再走无懈链,最后落地。
 */
export function* playCard(state: GameState, actor: number, card: Card, targets: number[] = []): Flow<boolean> {
  const me = state.players[actor];
  if (!me || !canPlay(state, actor, card, targets)) return false;
  const target = targets[0] ?? actor;

  if (!removeCard(state, actor, card)) return false;

  // 装备牌直接挂上,不进弃牌堆
  if (gearSlotOf(card)) {
    equip(state, actor, card);
    return true;
  }

  say(state, `${me.name} 打出 ${cardLabel(card)}${targets.length ? ` → ${state.players[target]?.name ?? ""}` : ""}。`);

  if (HOSTILE_KINDS.has(card.kind) && targets.length > 0) recordAct(state, actor, target, "hostile");
  if (isGroupTrick(card.kind)) {
    for (const id of aliveIds(state)) recordAct(state, actor, id, "hostile");
  }

  if (card.kind === "slash") {
    me.slashUsed++;
    toDiscard(state, [card]);
    yield* resolveSlash(state, actor, target, card);
    return true;
  }

  if (card.kind === "heal") {
    toDiscard(state, [card]);
    me.vigor = Math.min(me.maxVigor, me.vigor + 1);
    say(state, `${me.name} 回到 ${me.vigor} 点元气。`);
    return true;
  }

  // 延时锦囊贴到判定区,别的锦囊先过一遍无懈
  if (card.kind === "playful") {
    const cancelled = yield* askNullify(state, cardName(card), actor, target);
    if (cancelled) {
      toDiscard(state, [card]);
      return true;
    }
    state.players[target]?.delayed.push(card);
    say(state, `${state.players[target]?.name} 面前多了一张贪玩令。`);
    return true;
  }

  // 群体锦囊是一个人一个人分开抵消的,所以整张牌不过统一的无懈,放进 resolveGroup 里逐个问
  if (card.kind === "petalStorm" || card.kind === "starShower") {
    toDiscard(state, [card]);
    yield* resolveGroup(state, actor, card.kind);
    return true;
  }

  const cancelled = yield* askNullify(state, cardName(card), actor, target);
  toDiscard(state, [card]);
  if (cancelled) return true;

  switch (card.kind) {
    case "snatch":
      yield* resolveTake(state, actor, target, "snatch");
      break;
    case "dismantle":
      yield* resolveTake(state, actor, target, "dismantle");
      break;
    case "duel":
      yield* resolveDuel(state, actor, target);
      break;
    case "borrow": {
      const victim = targets[1] ?? borrowVictims(state, target, actor)[0];
      if (typeof victim === "number") yield* resolveBorrow(state, actor, target, victim);
      break;
    }
    default:
      break;
  }
  return true;
}

/** 送满几张才回 1 点元气(送一张就回一口太强,连着送才有回报) */
export const GIFT_PER_HEAL = 2;

/** 花主的赠花:每回合最多送两张,送满两张回 1 点元气 */
export function giftCard(state: GameState, actor: number, toId: number, card: Card): boolean {
  const me = state.players[actor];
  const other = state.players[toId];
  if (!me || !other || other.out || me.out) return false;
  const limit = queryNumber(state, { kind: "giftLimit", who: actor, base: 0 });
  if (me.giftUsed >= limit) return false;
  if (!removeCard(state, actor, card)) return false;
  other.hand.push(card);
  me.giftUsed++;
  recordAct(state, actor, toId, "help");
  if (me.giftUsed % GIFT_PER_HEAL === 0) {
    me.vigor = Math.min(me.maxVigor, me.vigor + 1);
    say(state, `${me.name} 一连送出两张,自己回到 ${me.vigor} 点元气。`);
  } else {
    say(state, `${me.name} 把一张牌送给 ${other.name}。`);
  }
  return true;
}

/** 花主这一回合还能送几张 */
export function giftLeft(state: GameState, who: number): number {
  const p = state.players[who];
  if (!p) return 0;
  return Math.max(0, queryNumber(state, { kind: "giftLimit", who, base: 0 }) - p.giftUsed);
}

// ---------------------------------------------------------------------------
// 回合
// ---------------------------------------------------------------------------

/**
 * 判定阶段 + 摸牌阶段。
 * 这两个阶段没有要问人的地方(露白的凝露只在明显有利时自动触发),所以是普通函数。
 */
export function startTurn(state: GameState, who: number): void {
  const p = state.players[who];
  if (!p || p.out || state.over) return;
  state.turn = who;
  p.slashUsed = 0;
  p.giftUsed = 0;
  p.skipPlay = false;
  p.flags.chirp = 0;
  p.flags.frostEdge = 0;
  p.flags.starlight = 0;
  say(state, `—— ${p.name} 的回合 ——`);

  // 判定阶段:延时锦囊从最后贴上的那张开始
  for (let i = p.delayed.length - 1; i >= 0; i--) {
    const card = p.delayed[i];
    p.delayed.splice(i, 1);
    toDiscard(state, [card]);
    const res = judge(state, who, true);
    if (!res.card) continue;
    if (res.red) {
      say(state, `${p.name} 判定 ${cardLabel(res.card)},红门,贪玩令飘走了。`);
    } else {
      p.skipPlay = true;
      say(state, `${p.name} 判定 ${cardLabel(res.card)},黑门,这回合光顾着玩,不出牌了。`);
    }
  }

  const n = queryNumber(state, { kind: "drawPhase", who, base: 2 });
  const got = drawCards(state, who, n);
  say(state, `${p.name} 摸了 ${got.length} 张。`);
}

/** 弃牌阶段:手牌多过上限就要放下几张 */
export function* endTurn(state: GameState, who: number): Flow<void> {
  const p = state.players[who];
  if (!p || p.out || state.over) return;
  const limit = Math.max(0, queryNumber(state, { kind: "handLimit", who, base: p.vigor }));
  const over = p.hand.length - limit;
  if (over <= 0) return;
  const reply: Reply = yield {
    kind: "discard",
    who,
    count: over,
    prompt: `手牌上限是 ${limit} 张,放下 ${over} 张吧。`
  };
  const picked = (reply?.cards ?? []).filter((c) => p.hand.some((h) => h.id === c.id)).slice(0, over);
  const need = over - picked.length;
  const rest = need > 0 ? p.hand.filter((c) => !picked.some((x) => x.id === c.id)).slice(0, need) : [];
  for (const c of [...picked, ...rest]) removeCard(state, who, c);
  toDiscard(state, [...picked, ...rest]);
  say(state, `${p.name} 放下了 ${picked.length + rest.length} 张。`);
}

/** 下一个还在场的座位 */
export function nextSeat(state: GameState, from: number): number {
  const n = state.players.length;
  for (let k = 1; k <= n; k++) {
    const id = (from + k) % n;
    if (!state.players[id].out) return id;
  }
  return from;
}

/** 交给下一个人,绕回起点就算一圈 */
export function advanceTurn(state: GameState): void {
  const next = nextSeat(state, state.turn);
  if (next <= state.turn) state.round++;
  state.turn = next;
}

/** 局面速览,播报与 AI 都用得到 */
export function describeSeat(state: GameState, id: number): string {
  const p = state.players[id];
  if (!p) return "";
  const hero = heroOf(p.heroId);
  const role = p.revealed ? `${ROLE_EMOJI[p.role]}${ROLE_LABELS[p.role]}` : "❓身份未明";
  return `${hero.emoji} ${p.name}·${hero.name} ${role} 元气 ${Math.max(0, p.vigor)}/${p.maxVigor} 手牌 ${p.hand.length}`;
}
