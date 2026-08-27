/**
 * 朵星地产 · 经济系统与回合状态机。
 *
 * 这一层负责所有会改状态的动作：买地、平均建屋、抵押赎回、清偿、破产、
 * 小黑屋、卡牌结算、拍卖落槌，以及把它们串起来的一个完整回合。
 *
 * AI 只通过 `Policy` 这一组回调参与，所以这个文件不 import `ai.ts`，
 * 单测可以拿手写的假策略把任何分支逼出来。
 */
import {
  BOARD_LEN,
  GO_SALARY,
  GROUP_TILES,
  JAIL_FINE,
  JAIL_TILE,
  MAX_HOUSES,
  START_CASH,
  STATION_TILES,
  houseCostOf,
  houseSellValue,
  isBuyable,
  mortgageValue,
  tileAt,
  transferFee,
  unmortgageCost,
  type ColorGroup
} from "./board";
import {
  BANK,
  alivePlayers,
  deedsOf,
  lastOneStanding,
  fullSetActive,
  moveBy,
  netWorth,
  ownsColorSet,
  passedGo,
  rankByNetWorth,
  rentOf,
  type EstateState,
  type PlayerState,
  type TileState
} from "./rent";
import { auctionOnce, type AuctionResult, type Bidder } from "./auction";
import { drawCard, makeDeck, type CardDeck, type DeckName, type EstateCard } from "./cards";

export { BANK } from "./rent";

/** 对战默认的强制结算回合数：到点就比净资产，不许无限拖 */
export const FORCE_SETTLE_ROUNDS = 80;

// ---------------------------------------------------------------------------
// 事件
// ---------------------------------------------------------------------------

export type EstateEvent =
  | { kind: "roll"; player: number; dice: [number, number]; doubles: boolean }
  | { kind: "move"; player: number; from: number; to: number; viaGo: boolean }
  | { kind: "salary"; player: number; amount: number }
  | { kind: "buy"; player: number; pos: number; price: number }
  | { kind: "rent"; payer: number; owner: number; pos: number; amount: number }
  | { kind: "tax"; player: number; pos: number; amount: number }
  | { kind: "card"; player: number; deck: DeckName; text: string }
  | { kind: "jail"; player: number; why: string }
  | { kind: "free"; player: number; how: "pay" | "card" | "roll" | "forced" }
  | { kind: "build"; player: number; pos: number; houses: number }
  | { kind: "sellHouse"; player: number; pos: number; houses: number; refund: number }
  | { kind: "mortgage"; player: number; pos: number; amount: number }
  | { kind: "unmortgage"; player: number; pos: number; amount: number }
  | { kind: "trade"; from: number; to: number; pos: number; price: number }
  | { kind: "auction"; pos: number; winner: number; price: number }
  | { kind: "fee"; player: number; pos: number; amount: number }
  | { kind: "bankrupt"; player: number; creditor: number }
  | { kind: "over"; winner: number; why: string }
  | { kind: "note"; text: string };

// ---------------------------------------------------------------------------
// 建局
// ---------------------------------------------------------------------------

export interface SeatSpec {
  name: string;
  emoji: string;
  /** 不给就是本机 AI 控制 */
  human?: boolean;
  cash?: number;
}

export interface MatchRules {
  /** 允许盖房 */
  build: boolean;
  /** 机会 / 命运生效 */
  cards: boolean;
  /** 小黑屋生效（关掉时反思角只是坐一下） */
  jail: boolean;
  /** 允许抵押 */
  mortgage: boolean;
  /** 不买就拍卖 */
  auction: boolean;
  /** 垄断空地租金 ×2 */
  fullSetDouble: boolean;
  /** 到点强制结算 */
  maxRounds: number;
}

export const FULL_RULES: MatchRules = {
  build: true,
  cards: true,
  jail: true,
  mortgage: true,
  auction: true,
  fullSetDouble: true,
  maxRounds: FORCE_SETTLE_ROUNDS
};

export function emptyTiles(): TileState[] {
  return Array.from({ length: BOARD_LEN }, () => ({ owner: BANK, houses: 0, mortgaged: false }));
}

export function createState(seats: readonly SeatSpec[], startCash: number = START_CASH): EstateState {
  const players: PlayerState[] = seats.map((s, i) => ({
    id: i,
    name: s.name,
    emoji: s.emoji,
    cash: Math.max(0, Math.round(s.cash ?? startCash)),
    pos: 0,
    inJail: false,
    jailTurns: 0,
    outCards: 0,
    bankrupt: false,
    doublesRun: 0
  }));
  return { players, tiles: emptyTiles(), turn: 0, round: 1, over: false };
}

// ---------------------------------------------------------------------------
// 现金
// ---------------------------------------------------------------------------

/** 给银行发钱 / 收钱，只动现金，不判断够不够（清偿由 payDebt 负责） */
export function addCash(state: EstateState, playerId: number, amount: number): void {
  const p = state.players[playerId];
  if (!p) return;
  p.cash += Math.round(amount);
}

// ---------------------------------------------------------------------------
// 买地 / 建屋 / 抵押
// ---------------------------------------------------------------------------

/** 直接把某块地判给某人（预置局面、拍卖成交、破产转手都走它） */
export function grantTile(state: EstateState, pos: number, ownerId: number): void {
  const st = state.tiles[pos];
  if (!st) return;
  st.owner = ownerId;
}

/** 停在无主地时买下来；钱不够或不是无主地返回 false */
export function buyTile(state: EstateState, playerId: number, pos: number): boolean {
  if (!isBuyable(pos)) return false;
  const st = state.tiles[pos];
  const p = state.players[playerId];
  const price = tileAt(pos).price ?? 0;
  if (!st || !p || st.owner !== BANK || p.cash < price) return false;
  p.cash -= price;
  st.owner = playerId;
  return true;
}

/**
 * 平均建约束：只能在自己垄断、整组都没抵押的色组里盖，
 * 而且只能盖在「当前房屋数最少」的那一块上 —— 这样任意两块永远差不超过 1 栋。
 */
export function canBuildEven(state: EstateState, pos: number): boolean {
  const tile = tileAt(pos);
  if (tile.kind !== "prop" || !tile.group) return false;
  const st = state.tiles[pos];
  if (!st || st.owner === BANK || st.mortgaged) return false;
  if (st.houses >= MAX_HOUSES) return false;
  if (!fullSetActive(state, st.owner, tile.group)) return false;
  const group = GROUP_TILES[tile.group];
  const min = Math.min(...group.map((p) => state.tiles[p].houses));
  return st.houses === min;
}

/** 盖一栋（小屋满 4 栋后第 5 栋就是大屋）；钱不够或违反平均建返回 false */
export function buildHouse(state: EstateState, pos: number): boolean {
  if (!canBuildEven(state, pos)) return false;
  const st = state.tiles[pos];
  const owner = state.players[st.owner];
  const cost = houseCostOf(pos);
  if (!owner || owner.cash < cost) return false;
  owner.cash -= cost;
  st.houses++;
  return true;
}

/** 拆房也要平均：只能从「当前房屋数最多」的那一块拆 */
export function canSellEven(state: EstateState, pos: number): boolean {
  const tile = tileAt(pos);
  if (tile.kind !== "prop" || !tile.group) return false;
  const st = state.tiles[pos];
  if (!st || st.owner === BANK || st.houses <= 0) return false;
  const group = GROUP_TILES[tile.group];
  const max = Math.max(...group.map((p) => state.tiles[p].houses));
  return st.houses === max;
}

/** 拆一栋，退回一半房价 */
export function sellHouse(state: EstateState, pos: number): number {
  if (!canSellEven(state, pos)) return 0;
  const st = state.tiles[pos];
  const owner = state.players[st.owner];
  if (!owner) return 0;
  st.houses--;
  const refund = houseSellValue(pos);
  owner.cash += refund;
  return refund;
}

/** 这个色组上还有没有建筑 —— 有建筑就一栋都不许抵押 */
export function groupHasBuildings(state: EstateState, group: ColorGroup): boolean {
  return GROUP_TILES[group].some((p) => state.tiles[p].houses > 0);
}

/** 能不能抵押：地要有主、没抵押过，而且整个色组的建筑都已经拆光 */
export function canMortgage(state: EstateState, pos: number): boolean {
  if (!isBuyable(pos)) return false;
  const st = state.tiles[pos];
  if (!st || st.owner === BANK || st.mortgaged) return false;
  const tile = tileAt(pos);
  if (tile.group && groupHasBuildings(state, tile.group)) return false;
  return true;
}

/** 抵押拿半价现金；抵押中的地不收租 */
export function mortgage(state: EstateState, pos: number): number {
  if (!canMortgage(state, pos)) return 0;
  const st = state.tiles[pos];
  const owner = state.players[st.owner];
  if (!owner) return 0;
  st.mortgaged = true;
  const got = mortgageValue(pos);
  owner.cash += got;
  return got;
}

/** 赎回：抵押价 × 110%，钱不够就赎不了 */
export function unmortgage(state: EstateState, pos: number): boolean {
  const st = state.tiles[pos];
  if (!st || !st.mortgaged || st.owner === BANK) return false;
  const owner = state.players[st.owner];
  const cost = unmortgageCost(pos);
  if (!owner || owner.cash < cost) return false;
  owner.cash -= cost;
  st.mortgaged = false;
  return true;
}

// ---------------------------------------------------------------------------
// 清偿：卖建筑 → 抵押 → 求救交易
// ---------------------------------------------------------------------------

/** 按「先卖便宜色组的房子」的顺序，找下一栋可以拆的房 */
function nextHouseToSell(state: EstateState, playerId: number): number {
  const candidates = deedsOf(state, playerId)
    .filter((p) => canSellEven(state, p))
    .sort((a, b) => houseCostOf(a) - houseCostOf(b) || a - b);
  return candidates.length > 0 ? candidates[0] : -1;
}

/** 按「先抵押便宜地」的顺序，找下一块可以抵押的地 */
function nextTileToMortgage(state: EstateState, playerId: number): number {
  const candidates = deedsOf(state, playerId)
    .filter((p) => canMortgage(state, p))
    .sort((a, b) => mortgageValue(a) - mortgageValue(b) || a - b);
  return candidates.length > 0 ? candidates[0] : -1;
}

export interface RaiseReport {
  ok: boolean;
  sold: number[];
  mortgaged: number[];
  traded: Array<{ pos: number; to: number; price: number }>;
}

/**
 * 欠债时依次尝试：拆建筑（半价）→ 抵押地皮（半价）→ 找人买地换现金。
 * `rescue` 不给就不走交易这一步。凑够 debt 就立刻停手，不多卖一块。
 */
export function tryRaise(
  state: EstateState,
  playerId: number,
  debt: number,
  rescue?: (pos: number) => { buyer: number; price: number } | null
): RaiseReport {
  const p = state.players[playerId];
  const report: RaiseReport = { ok: false, sold: [], mortgaged: [], traded: [] };
  if (!p) return report;
  const need = Math.max(0, Math.round(debt));

  while (p.cash < need) {
    const pos = nextHouseToSell(state, playerId);
    if (pos < 0) break;
    sellHouse(state, pos);
    report.sold.push(pos);
  }
  while (p.cash < need) {
    const pos = nextTileToMortgage(state, playerId);
    if (pos < 0) break;
    mortgage(state, pos);
    report.mortgaged.push(pos);
  }
  if (p.cash < need && rescue) {
    // 手上还剩什么就卖什么，贵的先问，问一块少一块
    const offerable = deedsOf(state, playerId).sort((a, b) => mortgageValue(b) - mortgageValue(a));
    for (const pos of offerable) {
      if (p.cash >= need) break;
      const deal = rescue(pos);
      if (!deal || deal.price <= 0) continue;
      const buyer = state.players[deal.buyer];
      if (!buyer || buyer.bankrupt || buyer.cash < deal.price) continue;
      buyer.cash -= deal.price;
      p.cash += deal.price;
      grantTile(state, pos, deal.buyer);
      report.traded.push({ pos, to: deal.buyer, price: deal.price });
    }
  }

  report.ok = p.cash >= need;
  return report;
}

// ---------------------------------------------------------------------------
// 破产
// ---------------------------------------------------------------------------

export interface BankruptReport {
  debtor: number;
  creditor: number;
  /** 债主是银行时，这些地要逐块无底价拍卖 */
  toAuction: number[];
  /** 债主是玩家时，接手抵押地一共交了多少手续费 */
  fees: number;
  /** 债主拿到多少现金 */
  cashMoved: number;
}

/**
 * 宣告破产并清偿。
 *
 * - **债主是玩家**：先把建筑按半价拆光（这笔钱一并给债主），
 *   现金、出门卡、全部地契整体转给债主；每接手一块抵押地，
 *   债主立刻付抵押价 10% 的手续费，并决定是当场赎回还是继续挂着。
 * - **债主是银行**：建筑拆光归银行，地契收回银行，逐块无底价拍卖（调用方接着跑）。
 */
export function declareBankrupt(
  state: EstateState,
  debtorId: number,
  creditorId: number,
  redeem?: (pos: number) => boolean
): BankruptReport {
  const debtor = state.players[debtorId];
  const report: BankruptReport = { debtor: debtorId, creditor: creditorId, toAuction: [], fees: 0, cashMoved: 0 };
  if (!debtor || debtor.bankrupt) return report;

  const deeds = deedsOf(state, debtorId);
  // 建筑一律先拆掉换成现金，谁也不能连着房子一起继承
  for (const pos of deeds) {
    const st = state.tiles[pos];
    while (st.houses > 0) {
      st.houses--;
      debtor.cash += houseSellValue(pos);
    }
  }

  const creditor = creditorId >= 0 ? state.players[creditorId] : undefined;
  if (creditor && !creditor.bankrupt) {
    report.cashMoved = Math.max(0, debtor.cash);
    creditor.cash += report.cashMoved;
    creditor.outCards += debtor.outCards;
    for (const pos of deeds) {
      grantTile(state, pos, creditorId);
      const st = state.tiles[pos];
      if (st.mortgaged) {
        const fee = transferFee(pos);
        creditor.cash -= fee;
        report.fees += fee;
        if (redeem?.(pos) && creditor.cash >= unmortgageCost(pos)) unmortgage(state, pos);
      }
    }
  } else {
    // 债主是银行：地皮收回，逐块拍卖
    for (const pos of deeds) {
      const st = state.tiles[pos];
      st.owner = BANK;
      st.mortgaged = false;
      st.houses = 0;
      report.toAuction.push(pos);
    }
  }

  debtor.cash = 0;
  debtor.outCards = 0;
  debtor.bankrupt = true;
  debtor.inJail = false;
  return report;
}

// ---------------------------------------------------------------------------
// 付账：一条龙（够就付，不够就清偿，还不够就破产）
// ---------------------------------------------------------------------------

export interface PayContext {
  /** 求救交易：问某个 AI 愿不愿意花钱买下这块地 */
  rescue?: (debtorId: number, pos: number) => { buyer: number; price: number } | null;
  /** 债主接手抵押地时要不要立刻赎回 */
  redeem?: (creditorId: number, pos: number) => boolean;
  /** 银行收回的地要拍卖，交给调用方跑一轮 */
  auction?: (pos: number) => void;
  events?: EstateEvent[];
}

/** 付一笔钱给某人或银行。付得起返回 true；破产了返回 false。 */
export function payDebt(
  state: EstateState,
  debtorId: number,
  creditorId: number,
  amount: number,
  ctx: PayContext = {}
): boolean {
  const debtor = state.players[debtorId];
  const owed = Math.max(0, Math.round(amount));
  if (!debtor || debtor.bankrupt || owed === 0) return true;

  if (debtor.cash < owed) {
    tryRaise(state, debtorId, owed, ctx.rescue ? (pos) => ctx.rescue!(debtorId, pos) : undefined);
  }
  if (debtor.cash >= owed) {
    debtor.cash -= owed;
    if (creditorId >= 0) {
      const creditor = state.players[creditorId];
      if (creditor && !creditor.bankrupt) creditor.cash += owed;
    }
    return true;
  }

  // 还是付不清：整份家当归债主，剩下的走破产流程
  const report = declareBankrupt(state, debtorId, creditorId, ctx.redeem ? (pos) => ctx.redeem!(creditorId, pos) : undefined);
  ctx.events?.push({ kind: "bankrupt", player: debtorId, creditor: creditorId });
  for (const pos of report.toAuction) ctx.auction?.(pos);
  return false;
}

// ---------------------------------------------------------------------------
// 小黑屋
// ---------------------------------------------------------------------------

export type JailChoice = "pay" | "card" | "roll";

export interface JailResult {
  freed: boolean;
  how: "pay" | "card" | "roll" | "forced" | "stay";
  paid: number;
  /** 出来之后按这个点数走（掷骰出来 / 第三回合强制付钱都要走） */
  steps: number;
  note: string;
}

/** 把人送进小黑屋（不算经过出发花园） */
export function sendToJail(state: EstateState, playerId: number): void {
  const p = state.players[playerId];
  if (!p) return;
  p.pos = JAIL_TILE;
  p.inJail = true;
  p.jailTurns = 0;
  p.doublesRun = 0;
}

/**
 * 在小黑屋里的一个回合。三种出来的方式：付 50、用出门卡、掷出双数。
 * 熬到第三个回合还没出来，就必须付 50 并按点数走。
 */
export function jailStep(state: EstateState, playerId: number, choice: JailChoice, dice: [number, number]): JailResult {
  const p = state.players[playerId];
  if (!p || !p.inJail) return { freed: true, how: "stay", paid: 0, steps: 0, note: "本来就不在小黑屋里。" };
  const sum = dice[0] + dice[1];
  const doubles = dice[0] === dice[1];

  if (choice === "card" && p.outCards > 0) {
    p.outCards--;
    p.inJail = false;
    p.jailTurns = 0;
    return { freed: true, how: "card", paid: 0, steps: 0, note: "用掉一张出门卡，直接走出来。" };
  }
  if (choice === "pay" && p.cash >= JAIL_FINE) {
    p.cash -= JAIL_FINE;
    p.inJail = false;
    p.jailTurns = 0;
    return { freed: true, how: "pay", paid: JAIL_FINE, steps: sum, note: `交了 ${JAIL_FINE} 星币，出来继续走。` };
  }
  if (doubles) {
    p.inJail = false;
    p.jailTurns = 0;
    return { freed: true, how: "roll", paid: 0, steps: sum, note: "掷出一对同点，门自己开了。" };
  }

  p.jailTurns++;
  if (p.jailTurns >= 3) {
    const paid = Math.min(JAIL_FINE, p.cash);
    p.cash -= paid;
    p.inJail = false;
    p.jailTurns = 0;
    return { freed: true, how: "forced", paid, steps: sum, note: `第三个回合到了，交 ${paid} 星币出来。` };
  }
  return {
    freed: false,
    how: "stay",
    paid: 0,
    steps: 0,
    note: `在小黑屋里第 ${p.jailTurns} 个回合，还能收租、能盖屋。`
  };
}

// ---------------------------------------------------------------------------
// 卡牌结算
// ---------------------------------------------------------------------------

/** 从某个格子往前找最近的车站 */
export function nearestStationFrom(pos: number): number {
  for (let i = 1; i <= BOARD_LEN; i++) {
    const p = moveBy(pos, i);
    if (STATION_TILES.includes(p)) return p;
  }
  return STATION_TILES[0];
}

/** 某人名下的小屋数与大屋数 */
export function buildingCounts(state: EstateState, playerId: number): { houses: number; hotels: number } {
  let houses = 0;
  let hotels = 0;
  for (const pos of deedsOf(state, playerId)) {
    const n = state.tiles[pos].houses;
    if (n >= MAX_HOUSES) hotels++;
    else houses += n;
  }
  return { houses, hotels };
}

/**
 * 「场上每个人都交 amount」的结算顺序：从当前行动者起**逆时针**（下标递减）依次结算。
 * 先破产的人先把地交出去拍卖，后面的人可能因为买到拍卖地而改变结果，
 * 所以顺序必须写死、可测。
 */
export function counterClockwiseOrder(state: EstateState, actorId: number): number[] {
  const n = state.players.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const id = ((actorId - i) % n + n) % n;
    if (!state.players[id].bankrupt) out.push(id);
  }
  return out;
}

export interface CardApplyResult {
  /** 卡片让人挪了位置，落地格要接着结算 */
  landedOn: number | null;
  events: EstateEvent[];
}

/**
 * 应用一张卡。挪位置的卡返回落地格，调用方接着跑 `resolveLanding`。
 * 破产在这里就地处理（付不起的人当场清偿）。
 */
export function applyCard(
  state: EstateState,
  playerId: number,
  card: EstateCard,
  ctx: PayContext = {}
): CardApplyResult {
  const p = state.players[playerId];
  const events: EstateEvent[] = [];
  const out: CardApplyResult = { landedOn: null, events };
  if (!p || p.bankrupt) return out;
  const eff = card.effect;

  const jump = (to: number, passGo: boolean): void => {
    const from = p.pos;
    p.pos = to;
    const via = passGo && passedGo(from, to);
    events.push({ kind: "move", player: playerId, from, to, viaGo: via });
    if (via) {
      p.cash += GO_SALARY;
      events.push({ kind: "salary", player: playerId, amount: GO_SALARY });
    }
    out.landedOn = to;
  };

  switch (eff.kind) {
    case "cash": {
      if (eff.amount >= 0) {
        p.cash += eff.amount;
      } else {
        payDebt(state, playerId, BANK, -eff.amount, { ...ctx, events });
      }
      break;
    }
    case "moveTo":
      jump(eff.pos, eff.passGo);
      break;
    case "moveBy":
      jump(moveBy(p.pos, eff.steps), eff.steps > 0);
      break;
    case "nearestStation":
      jump(nearestStationFrom(p.pos), true);
      break;
    case "goJail":
      sendToJail(state, playerId);
      events.push({ kind: "jail", player: playerId, why: card.text });
      break;
    case "outCard":
      p.outCards++;
      break;
    case "repairs": {
      const { houses, hotels } = buildingCounts(state, playerId);
      const bill = houses * eff.perHouse + hotels * eff.perHotel;
      if (bill > 0) payDebt(state, playerId, BANK, bill, { ...ctx, events });
      break;
    }
    case "collectEach": {
      for (const id of counterClockwiseOrder(state, playerId)) {
        if (id === playerId) continue;
        payDebt(state, id, playerId, eff.amount, { ...ctx, events });
      }
      break;
    }
    case "payEach": {
      for (const id of counterClockwiseOrder(state, playerId)) {
        if (id === playerId) continue;
        payDebt(state, playerId, id, eff.amount, { ...ctx, events });
        if (p.bankrupt) break;
      }
      break;
    }
    case "allPay": {
      for (const id of counterClockwiseOrder(state, playerId)) {
        payDebt(state, id, BANK, eff.amount, { ...ctx, events });
      }
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 一个完整回合
// ---------------------------------------------------------------------------

export interface Policy {
  /** 停在无主地，买不买 */
  wantBuy: (state: EstateState, playerId: number, pos: number) => boolean;
  /** 拍卖里最多出到多少 */
  bidLimit: (state: EstateState, playerId: number, pos: number) => number;
  /** 掷骰前想盖哪几栋（按顺序尝试，不合规就跳过） */
  buildPlan: (state: EstateState, playerId: number) => number[];
  /** 在小黑屋里走哪条路 */
  jailChoice: (state: EstateState, playerId: number) => JailChoice;
  /** 别人求救卖地，愿意出多少（0 表示拒绝） */
  rescueOffer: (state: EstateState, playerId: number, pos: number) => number;
  /** 接手抵押地时要不要立刻赎回 */
  redeemOnTake: (state: EstateState, playerId: number, pos: number) => boolean;
  /** 手头宽裕时想赎回哪几块自己的抵押地 */
  redeemPlan: (state: EstateState, playerId: number) => number[];
  /** 为了盖房，愿意先抵押掉哪几块零散地皮换现金 */
  financePlan: (state: EstateState, playerId: number) => number[];
}

export interface TurnContext {
  rand: () => number;
  policyOf: (playerId: number) => Policy;
  decks: { chance: CardDeck; fate: CardDeck };
  rules: MatchRules;
  /** 固定骰序（教学关用）：给了就按它发点数，用完再回到随机 */
  scriptedDice?: Array<[number, number]>;
  diceCursor?: { i: number };
  /** 人类玩家的决定由界面提供，AI 走 policyOf */
  humans?: Set<number>;
}

export function rollDice(rand: () => number): [number, number] {
  return [1 + Math.floor(rand() * 6), 1 + Math.floor(rand() * 6)];
}

function nextDice(ctx: TurnContext): [number, number] {
  const script = ctx.scriptedDice;
  const cur = ctx.diceCursor;
  if (script && script.length > 0 && cur && cur.i < script.length) {
    const d = script[cur.i];
    cur.i++;
    return [d[0], d[1]];
  }
  return rollDice(ctx.rand);
}

function payCtxFor(state: EstateState, ctx: TurnContext, events: EstateEvent[]): PayContext {
  return {
    events,
    rescue: (debtorId, pos) => {
      let best: { buyer: number; price: number } | null = null;
      for (const id of alivePlayers(state)) {
        if (id === debtorId) continue;
        const offer = Math.round(ctx.policyOf(id).rescueOffer(state, id, pos));
        if (offer > 0 && offer <= state.players[id].cash && (!best || offer > best.price)) {
          best = { buyer: id, price: offer };
        }
      }
      if (best) events.push({ kind: "trade", from: debtorId, to: best.buyer, pos, price: best.price });
      return best;
    },
    redeem: (creditorId, pos) => (creditorId >= 0 ? ctx.policyOf(creditorId).redeemOnTake(state, creditorId, pos) : false),
    auction: (pos) => runAuction(state, pos, -1, ctx, events)
  };
}

/** 跑一轮拍卖并落槌。`skipId` 是刚刚放弃购买的人，从他的下家开始叫价。 */
export function runAuction(
  state: EstateState,
  pos: number,
  skipId: number,
  ctx: TurnContext,
  events: EstateEvent[]
): AuctionResult {
  const alive = alivePlayers(state);
  const start = skipId >= 0 ? (alive.indexOf(skipId) + 1) % Math.max(1, alive.length) : 0;
  const ordered = alive.slice(start).concat(alive.slice(0, start));
  const bidders: Bidder[] = ordered.map((id) => ({
    id,
    limit: Math.max(0, Math.round(ctx.policyOf(id).bidLimit(state, id, pos))),
    cash: state.players[id].cash
  }));
  const result = auctionOnce(pos, bidders);
  if (result.winner >= 0) {
    state.players[result.winner].cash -= result.price;
    grantTile(state, pos, result.winner);
  }
  events.push({ kind: "auction", pos, winner: result.winner, price: result.price });
  return result;
}

/** 停在某一格之后要结算什么 */
export function resolveLanding(
  state: EstateState,
  playerId: number,
  dice: number,
  ctx: TurnContext,
  events: EstateEvent[],
  depth = 0
): void {
  const p = state.players[playerId];
  if (!p || p.bankrupt) return;
  const tile = tileAt(p.pos);
  const pay = payCtxFor(state, ctx, events);

  if (tile.kind === "jail" && ctx.rules.jail) {
    sendToJail(state, playerId);
    events.push({ kind: "jail", player: playerId, why: "停在反思角，去小黑屋坐一坐。" });
    return;
  }
  if (tile.kind === "tax") {
    const amount = tile.tax ?? 0;
    events.push({ kind: "tax", player: playerId, pos: p.pos, amount });
    payDebt(state, playerId, BANK, amount, pay);
    return;
  }
  if ((tile.kind === "chance" || tile.kind === "fate") && ctx.rules.cards && depth < 3) {
    const deck = tile.kind === "chance" ? ctx.decks.chance : ctx.decks.fate;
    const card = drawCard(deck, ctx.rand);
    events.push({ kind: "card", player: playerId, deck: tile.kind, text: card.text });
    const res = applyCard(state, playerId, card, pay);
    events.push(...res.events);
    if (res.landedOn !== null && !p.bankrupt && !p.inJail) {
      resolveLanding(state, playerId, dice, ctx, events, depth + 1);
    }
    return;
  }
  if (!isBuyable(p.pos)) return;

  const st = state.tiles[p.pos];
  if (st.owner === BANK) {
    const price = tile.price ?? 0;
    const wants = ctx.humans?.has(playerId) ? false : ctx.policyOf(playerId).wantBuy(state, playerId, p.pos);
    if (wants && p.cash >= price) {
      buyTile(state, playerId, p.pos);
      events.push({ kind: "buy", player: playerId, pos: p.pos, price });
    } else if (ctx.rules.auction) {
      runAuction(state, p.pos, playerId, ctx, events);
    }
    return;
  }
  if (st.owner === playerId) return;

  let rent = rentOf(state, p.pos, dice);
  if (!ctx.rules.fullSetDouble && tile.kind === "prop" && st.houses === 0) {
    rent = tile.rent?.[0] ?? 0;
  }
  if (rent <= 0) return;
  events.push({ kind: "rent", payer: playerId, owner: st.owner, pos: p.pos, amount: rent });
  payDebt(state, playerId, st.owner, rent, pay);
}

/** 掷骰前的例行公事：赎回 + 盖房（AI 用；人类走界面按钮） */
export function autoManage(state: EstateState, playerId: number, ctx: TurnContext, events: EstateEvent[]): void {
  const policy = ctx.policyOf(playerId);
  if (ctx.rules.mortgage) {
    for (const pos of policy.redeemPlan(state, playerId).slice(0, 4)) {
      if (unmortgage(state, pos)) events.push({ kind: "unmortgage", player: playerId, pos, amount: unmortgageCost(pos) });
    }
  }
  if (!ctx.rules.build) return;
  if (ctx.rules.mortgage) {
    // 零散地皮换现金去堆房子：租金翻好几倍，比抱着一堆空地强
    for (const pos of policy.financePlan(state, playerId).slice(0, 4)) {
      const got = mortgage(state, pos);
      if (got > 0) events.push({ kind: "mortgage", player: playerId, pos, amount: got });
    }
  }
  for (const pos of policy.buildPlan(state, playerId).slice(0, 8)) {
    if (buildHouse(state, pos)) events.push({ kind: "build", player: playerId, pos, houses: state.tiles[pos].houses });
  }
}

/**
 * 走一个完整回合（AI 全自动）。
 * 掷出双数可以再掷；连着三次双数直接进小黑屋，不算经过出发。
 */
export function playTurn(state: EstateState, playerId: number, ctx: TurnContext): EstateEvent[] {
  const events: EstateEvent[] = [];
  const p = state.players[playerId];
  if (!p || p.bankrupt || state.over) return events;

  autoManage(state, playerId, ctx, events);
  p.doublesRun = 0;

  for (let leg = 0; leg < 4; leg++) {
    if (p.bankrupt || state.over) break;
    const dice = nextDice(ctx);
    const sum = dice[0] + dice[1];
    const doubles = dice[0] === dice[1];

    if (p.inJail && ctx.rules.jail) {
      const choice = ctx.policyOf(playerId).jailChoice(state, playerId);
      const res = jailStep(state, playerId, choice, dice);
      events.push({ kind: "roll", player: playerId, dice, doubles });
      if (!res.freed) {
        events.push({ kind: "note", text: res.note });
        break;
      }
      events.push({ kind: "free", player: playerId, how: res.how === "stay" ? "roll" : res.how });
      if (res.steps <= 0) break;
      step(state, playerId, res.steps, ctx, events);
      break;
    }

    events.push({ kind: "roll", player: playerId, dice, doubles });
    if (doubles) {
      p.doublesRun++;
      if (p.doublesRun >= 3) {
        sendToJail(state, playerId);
        events.push({ kind: "jail", player: playerId, why: "连着三次同点，直接去小黑屋。" });
        break;
      }
    }
    step(state, playerId, sum, ctx, events);
    if (!doubles || p.inJail || p.bankrupt) break;
  }

  const last = lastOneStanding(state);
  if (last >= 0) {
    state.over = true;
    events.push({ kind: "over", winner: last, why: "只剩一个人还在牌桌上。" });
  }
  return events;
}

/** 挪 steps 格并结算落地 */
export function step(
  state: EstateState,
  playerId: number,
  steps: number,
  ctx: TurnContext,
  events: EstateEvent[]
): void {
  const p = state.players[playerId];
  if (!p || p.bankrupt) return;
  const from = p.pos;
  const to = moveBy(from, steps);
  p.pos = to;
  const via = steps > 0 && passedGo(from, to);
  events.push({ kind: "move", player: playerId, from, to, viaGo: via });
  if (via) {
    p.cash += GO_SALARY;
    events.push({ kind: "salary", player: playerId, amount: GO_SALARY });
  }
  resolveLanding(state, playerId, steps, ctx, events);
}

/** 轮到下一个还没破产的人；转回起点就算过了一圈 */
export function advanceTurn(state: EstateState): void {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const next = (state.turn + i) % n;
    if (state.players[next].bankrupt) continue;
    // 座位号绕回去了就说明又走完一圈
    if (next <= state.turn) state.round++;
    state.turn = next;
    return;
  }
  state.over = true;
}

export interface MatchResult {
  winner: number;
  reason: "bankrupt" | "settle";
  rounds: number;
  standings: number[];
  netWorths: number[];
}

/** 到点强制结算：比净资产 */
export function forceSettle(state: EstateState): MatchResult {
  const standings = rankByNetWorth(state);
  return {
    winner: standings[0] ?? -1,
    reason: "settle",
    rounds: state.round,
    standings,
    netWorths: state.players.map((p) => netWorth(state, p.id))
  };
}

/** 一整局无头对战，四档 AI 强度对比与 188 关可解性验证都靠它 */
export function runMatch(state: EstateState, ctx: TurnContext): MatchResult {
  while (!state.over && state.round <= ctx.rules.maxRounds) {
    playTurn(state, state.turn, ctx);
    if (state.over) break;
    advanceTurn(state);
  }
  const last = lastOneStanding(state);
  if (last >= 0) {
    return {
      winner: last,
      reason: "bankrupt",
      rounds: state.round,
      standings: [last],
      netWorths: state.players.map((p) => netWorth(state, p.id))
    };
  }
  return forceSettle(state);
}

/** 只剩一个人没破产就返回他，否则 -1（界面收摊判定用） */
export function lastOneStandingOrNone(state: EstateState): number {
  return lastOneStanding(state);
}

/**
 * 界面自己走子时的过路费结算：经过（或正好停在）出发花园就发 200，返回实发金额。
 * 规则层的 `step()` 已经含了这一步，这里给「一格一格跳」的动画分开用。
 */
export function passedGoSalary(
  state: EstateState,
  playerId: number,
  from: number,
  to: number,
  steps: number
): number {
  const p = state.players[playerId];
  if (!p || steps <= 0 || !passedGo(from, to)) return 0;
  p.cash += GO_SALARY;
  return GO_SALARY;
}

/** 这块地在垄断意义上有多重要（AI 与界面共用的小工具） */
export function groupProgress(state: EstateState, playerId: number, group: ColorGroup): { own: number; total: number } {
  const all = GROUP_TILES[group];
  return { own: all.filter((p) => state.tiles[p].owner === playerId).length, total: all.length };
}

/** 某人是不是垄断了这个色组（对外的简写） */
export function hasFullSet(state: EstateState, playerId: number, group: ColorGroup): boolean {
  return ownsColorSet(state, playerId, group);
}
