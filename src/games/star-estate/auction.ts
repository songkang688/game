/**
 * 梨康地产 · 无底价拍卖（纯函数，不改棋盘状态）。
 *
 * 规则：从 0 星币起，按给定顺序一轮一轮加价。
 * 轮到谁，谁要么加一档（当前价 + step），要么退出。
 * 全场只剩一个还愿意加价的人就成交；一个人都不出价就流拍。
 *
 * 出价顺序是会影响结果的：两个人心理价位一样时，先把价钱顶到上限的那个人赢。
 */
import { tileAt } from "./board";

/** 每次加价的档位 */
export const BID_STEP = 10;

export interface Bidder {
  /** 玩家下标 */
  id: number;
  /** 心理价位：最多愿意出到这个数 */
  limit: number;
  /** 手上能立刻掏出来的现金 */
  cash: number;
}

export interface AuctionResult {
  /** 成交者；流拍是 -1 */
  winner: number;
  /** 成交价；流拍是 0 */
  price: number;
  /** 每一次有效出价，界面滚动播报和测试都看它 */
  history: Array<{ id: number; bid: number }>;
  /** 转了几圈 */
  rounds: number;
  /** 谁一次都没出价 */
  passed: number[];
}

/**
 * 跑一次拍卖。
 * `bidders` 的顺序就是叫价顺序，通常从「不买那块地的人」的下家开始。
 */
export function auctionOnce(pos: number, bidders: readonly Bidder[], step: number = BID_STEP): AuctionResult {
  const inc = Math.max(1, Math.round(step));
  const live = bidders.map((b) => ({
    id: b.id,
    ceiling: Math.max(0, Math.min(Math.round(b.limit), Math.round(b.cash))),
    out: false,
    bid: false
  }));
  const history: AuctionResult["history"] = [];
  let price = 0;
  let winner = -1;
  let rounds = 0;

  if (live.length === 0) return { winner: -1, price: 0, history, rounds: 0, passed: [] };

  // 最多转够所有人把上限喊完的圈数，防止任何情况下的死循环
  const maxRounds = Math.ceil((Math.max(...live.map((b) => b.ceiling)) + inc) / inc) + live.length + 2;

  while (rounds < maxRounds) {
    rounds++;
    let bidThisRound = false;
    for (const b of live) {
      if (b.out || b.id === winner) continue;
      const next = price + inc;
      if (b.ceiling >= next) {
        price = next;
        winner = b.id;
        b.bid = true;
        bidThisRound = true;
        history.push({ id: b.id, bid: next });
      } else {
        b.out = true;
      }
    }
    const stillIn = live.filter((b) => !b.out).length;
    if (!bidThisRound || stillIn <= 1) break;
  }

  if (winner === -1) return { winner: -1, price: 0, history, rounds, passed: live.map((b) => b.id) };
  return { winner, price, history, rounds, passed: live.filter((b) => !b.bid).map((b) => b.id) };
}

/** 拍卖播报的一句话（界面与日志共用） */
export function auctionLine(pos: number, r: AuctionResult, nameOf: (id: number) => string): string {
  const tile = tileAt(pos).name;
  if (r.winner < 0) return `${tile} 没人出价，先留在银行手里。`;
  return `${tile} 由${nameOf(r.winner)}以 ${r.price} 星币拍下。`;
}
