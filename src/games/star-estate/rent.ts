/**
 * 梨康地产 · 局面基础类型 + 走棋 / 垄断 / 租金 / 净资产（全是纯函数）。
 *
 * 这一层只回答「现在是什么情况」，不改任何状态。
 * 会改状态的动作（买地、建屋、抵押、清偿、破产）全在 `economy.ts`。
 */
import {
  BOARD_LEN,
  GROUP_TILES,
  MAX_HOUSES,
  STATION_RENT,
  STATION_TILES,
  UTIL_MULTIPLIER,
  UTIL_TILES,
  houseSellValue,
  mortgageValue,
  tileAt,
  type ColorGroup
} from "./board";

/** 银行（没有主人）用 -1 表示 */
export const BANK = -1;

export interface TileState {
  /** 主人的玩家下标，-1 表示还在银行手里 */
  owner: number;
  /** 0 是空地，1–4 是小屋，5 是大屋 */
  houses: number;
  mortgaged: boolean;
}

export interface PlayerState {
  id: number;
  name: string;
  emoji: string;
  cash: number;
  pos: number;
  /** 在小黑屋里 */
  inJail: boolean;
  /** 已经在小黑屋里待了几个回合 */
  jailTurns: number;
  /** 手上的「出门卡」张数 */
  outCards: number;
  bankrupt: boolean;
  /** 这一回合已经连着掷出几次双数 */
  doublesRun: number;
  /**
   * 本局自己**掏钱拿下**的产业处数（停在空地买、拍卖拍到、从别人手里接盘都算）。
   * 开局赠地和对手收摊后转过来的地都不算 —— 战役的过关门槛按这个数看，
   * 免得「一直点掷骰、什么都不买」也能过关。
   */
  deedsBought: number;
}

export interface EstateState {
  players: PlayerState[];
  /** 与 BOARD 一一对应的 40 项 */
  tiles: TileState[];
  /** 轮到谁（players 下标） */
  turn: number;
  /** 已经打完几圈 */
  round: number;
  over: boolean;
}

/** 走 dice 格之后停在哪（环线绕回） */
export function moveBy(pos: number, dice: number, boardLen: number = BOARD_LEN): number {
  const len = Math.max(1, Math.round(boardLen));
  const from = ((Math.round(pos) % len) + len) % len;
  const step = Math.round(dice);
  return ((from + step) % len + len) % len;
}

/**
 * 这一步有没有经过（或正好停在）出发花园。
 * 原地不动不算；正好停在 0 号格算经过，一样发 200。
 */
export function passedGo(from: number, to: number, boardLen: number = BOARD_LEN): boolean {
  const len = Math.max(1, Math.round(boardLen));
  const a = ((Math.round(from) % len) + len) % len;
  const b = ((Math.round(to) % len) + len) % len;
  if (a === b) return false;
  return b < a || b === 0;
}

/** 这一格现在的主人（不能买的格子永远是银行） */
export function ownerOf(state: EstateState, pos: number): number {
  const st = state.tiles[((Math.round(pos) % BOARD_LEN) + BOARD_LEN) % BOARD_LEN];
  return st ? st.owner : BANK;
}

/** 某人手上这个色组的全部地块（含抵押中的） */
export function tilesOwnedInGroup(state: EstateState, playerId: number, group: ColorGroup): number[] {
  return GROUP_TILES[group].filter((p) => state.tiles[p]?.owner === playerId);
}

/** 垄断：整个色组都在同一个人手里 */
export function ownsColorSet(state: EstateState, playerId: number, group: ColorGroup): boolean {
  const all = GROUP_TILES[group];
  if (all.length === 0) return false;
  return all.every((p) => state.tiles[p]?.owner === playerId);
}

/** 垄断而且整组都没抵押 —— 只有这样空地租金才 ×2、才能盖房 */
export function fullSetActive(state: EstateState, playerId: number, group: ColorGroup): boolean {
  if (!ownsColorSet(state, playerId, group)) return false;
  return GROUP_TILES[group].every((p) => !state.tiles[p]?.mortgaged);
}

/** 某人手上有几个车站 */
export function stationCount(state: EstateState, playerId: number): number {
  return STATION_TILES.filter((p) => state.tiles[p]?.owner === playerId).length;
}

/** 某人手上有几家公共设施 */
export function utilCount(state: EstateState, playerId: number): number {
  return UTIL_TILES.filter((p) => state.tiles[p]?.owner === playerId).length;
}

/** 某人手上的全部地契（含车站、设施、抵押中的） */
export function deedsOf(state: EstateState, playerId: number): number[] {
  const out: number[] = [];
  for (let p = 0; p < state.tiles.length; p++) {
    if (state.tiles[p].owner === playerId) out.push(p);
  }
  return out;
}

/**
 * 停在这一格要付多少租。
 * - 没主人 / 主人是自己 / 已抵押 / 主人破产了：0
 * - 地块：空地按表第 0 项，整组垄断且都没抵押时 ×2；有房子按房屋数查表
 * - 车站：按主人手上的车站数查 25/50/100/200
 * - 设施：骰子点数 ×4（持 1 家）或 ×10（持 2 家）
 */
export function rentOf(state: EstateState, pos: number, dice = 7): number {
  const tile = tileAt(pos);
  const st = state.tiles[tile.pos];
  if (!st || st.owner === BANK || st.mortgaged) return 0;
  const owner = state.players[st.owner];
  if (!owner || owner.bankrupt) return 0;

  if (tile.kind === "station") {
    return STATION_RENT[Math.min(STATION_RENT.length - 1, stationCount(state, st.owner))];
  }
  if (tile.kind === "util") {
    const mult = UTIL_MULTIPLIER[Math.min(UTIL_MULTIPLIER.length - 1, utilCount(state, st.owner))];
    return Math.max(0, Math.round(dice)) * mult;
  }
  if (tile.kind !== "prop" || !tile.rent || !tile.group) return 0;

  const houses = Math.max(0, Math.min(MAX_HOUSES, st.houses));
  if (houses > 0) return tile.rent[houses];
  return fullSetActive(state, st.owner, tile.group) ? tile.rent[0] * 2 : tile.rent[0];
}

/** 某人名下全部建筑值多少钱（按半价算，跟拆房拿到的钱一致） */
export function buildingsValue(state: EstateState, playerId: number): number {
  let sum = 0;
  for (const p of deedsOf(state, playerId)) {
    sum += state.tiles[p].houses * houseSellValue(p);
  }
  return sum;
}

/**
 * 净资产 = 现金 + 没抵押地皮的全价 + 抵押地皮的半价 + 建筑的半价。
 * 抵押地按半价算：抵押时已经把另一半换成现金了，不能重复计。
 */
export function netWorth(state: EstateState, playerId: number): number {
  const p = state.players[playerId];
  if (!p) return 0;
  let sum = p.cash;
  for (const pos of deedsOf(state, playerId)) {
    const st = state.tiles[pos];
    const price = tileAt(pos).price ?? 0;
    sum += st.mortgaged ? mortgageValue(pos) : price;
    sum += st.houses * houseSellValue(pos);
  }
  return sum;
}

/** 立刻能变出来的现金上限：现金 + 拆完全部建筑 + 抵押全部地皮 */
export function liquidCeiling(state: EstateState, playerId: number): number {
  const p = state.players[playerId];
  if (!p) return 0;
  let sum = p.cash;
  for (const pos of deedsOf(state, playerId)) {
    const st = state.tiles[pos];
    sum += st.houses * houseSellValue(pos);
    if (!st.mortgaged) sum += mortgageValue(pos);
  }
  return sum;
}

/** 还没破产的玩家下标 */
export function alivePlayers(state: EstateState): number[] {
  return state.players.filter((p) => !p.bankrupt).map((p) => p.id);
}

/** 只剩一个人没破产就该收摊了 */
export function lastOneStanding(state: EstateState): number {
  const alive = alivePlayers(state);
  return alive.length === 1 ? alive[0] : -1;
}

/** 80 回合到点的强制结算：按净资产排名，并列时按下标 */
export function rankByNetWorth(state: EstateState): number[] {
  return state.players
    .filter((p) => !p.bankrupt)
    .map((p) => p.id)
    .sort((a, b) => netWorth(state, b) - netWorth(state, a) || a - b);
}
