import { describe, expect, it } from "vitest";
import { START_CASH, tileAt } from "./board";
import { BANK, type EstateState } from "./rent";
import {
  FULL_RULES,
  createState,
  grantTile,
  runAuction,
  type EstateEvent,
  type Policy,
  type TurnContext
} from "./economy";
import { makeDeck } from "./cards";
import { mulberry32 } from "../level99";
import { eventLine, tileSummary, ESTATE_CONSTS } from "./index";

function table(n = 3, cash = START_CASH): EstateState {
  const names = ["鸭梨", "康康", "糯糯", "云云"];
  const emoji = ["🍐", "👓", "🍡", "☁️"];
  return createState(
    Array.from({ length: n }, (_, i) => ({ name: names[i], emoji: emoji[i], cash })),
    cash
  );
}

function ctxWith(limit: number, humans?: Set<number>): TurnContext {
  const rand = mulberry32(5);
  const policy: Policy = {
    wantBuy: () => false,
    bidLimit: () => limit,
    buildPlan: () => [],
    jailChoice: () => "roll",
    rescueOffer: () => 0,
    redeemOnTake: () => false,
    redeemPlan: () => [],
    financePlan: () => []
  };
  return {
    rand,
    policyOf: () => policy,
    decks: { chance: makeDeck("chance", rand), fate: makeDeck("fate", rand) },
    rules: FULL_RULES,
    diceCursor: { i: 0 },
    humans
  };
}

describe("拍卖不背着玩家掏钱", () => {
  it("人类座位默认心理价位是 0，AI 之间自己拍", () => {
    const s = table(3);
    const events: EstateEvent[] = [];
    const r = runAuction(s, 39, -1, ctxWith(400, new Set([0])), events);
    expect(r.winner).not.toBe(0);
    expect(r.history.every((h) => h.id !== 0)).toBe(true);
    expect(s.players[0].cash).toBe(START_CASH);
    expect(s.tiles[39].owner).toBe(r.winner);
  });

  it("界面问过玩家之后，用他自己定的上限参拍", () => {
    const s = table(3);
    const events: EstateEvent[] = [];
    const r = runAuction(s, 39, -1, ctxWith(100, new Set([0])), events, new Map([[0, 500]]));
    // 两个 AI 的上限都是 100，鸭梨刚好把价钱顶到 100 就没人跟得上了
    expect(r.winner).toBe(0);
    expect(r.price).toBe(100);
    expect(s.players[0].cash).toBe(START_CASH - 100);
    expect(events.at(-1)).toEqual({ kind: "auction", pos: 39, winner: 0, price: 100 });
  });

  it("流拍时地留在银行手里，谁的钱都不动", () => {
    const s = table(2);
    const events: EstateEvent[] = [];
    const r = runAuction(s, 1, -1, ctxWith(0), events);
    expect(r.winner).toBe(-1);
    expect(s.tiles[1].owner).toBe(BANK);
    expect(s.players.every((p) => p.cash === START_CASH)).toBe(true);
  });
});

describe("播报文案", () => {
  it("每一类事件都能翻成一句中文，没有 undefined", () => {
    const s = table(2);
    const samples: EstateEvent[] = [
      { kind: "roll", player: 0, dice: [3, 3], doubles: true },
      { kind: "move", player: 0, from: 0, to: 6, viaGo: false },
      { kind: "salary", player: 0, amount: 200 },
      { kind: "buy", player: 0, pos: 6, price: 100 },
      { kind: "rent", payer: 1, owner: 0, pos: 6, amount: 6 },
      { kind: "tax", player: 0, pos: 4, amount: 100 },
      { kind: "card", player: 0, deck: "chance", text: "天上掉下 50 星币" },
      { kind: "jail", player: 0, why: "连着三次同点" },
      { kind: "free", player: 0, how: "card" },
      { kind: "build", player: 0, pos: 6, houses: 2 },
      { kind: "sellHouse", player: 0, pos: 6, houses: 1, refund: 25 },
      { kind: "mortgage", player: 0, pos: 6, amount: 50 },
      { kind: "unmortgage", player: 0, pos: 6, amount: 55 },
      { kind: "trade", from: 0, to: 1, pos: 6, price: 120 },
      { kind: "auction", pos: 6, winner: 1, price: 90 },
      { kind: "fee", player: 1, pos: 6, amount: 5 },
      { kind: "bankrupt", player: 1, creditor: 0 },
      { kind: "over", winner: 0, why: "只剩一个人" },
      { kind: "note", text: "随便一句提示" }
    ];
    for (const ev of samples) {
      const line = eventLine(s, ev);
      expect(line.length, JSON.stringify(ev)).toBeGreaterThan(2);
      expect(line).not.toContain("undefined");
    }
  });

  it("破产播报只鼓励，不嘲讽", () => {
    const s = table(2);
    const line = eventLine(s, { kind: "bankrupt", player: 1, creditor: 0 });
    expect(line).toContain("钱包空啦");
    expect(line).toContain("下一局再来");
  });

  it("地块小结把售价、主人、房屋和租金都写清楚", () => {
    const s = table(2);
    expect(tileSummary(s, 39)).toContain(String(tileAt(39).price));
    grantTile(s, 39, 1);
    const line = tileSummary(s, 39);
    expect(line).toContain("康康");
    expect(line).toContain("空地");
    expect(line).toContain("租金");
  });

  it("关键节奏常量都在合理范围，走子绝不瞬移", () => {
    expect(ESTATE_CONSTS.HOP_MS).toBeGreaterThanOrEqual(80);
    expect(ESTATE_CONSTS.BEAT_MS).toBeGreaterThan(ESTATE_CONSTS.HOP_MS);
    expect(ESTATE_CONSTS.BOARD_LEN).toBe(40);
    expect(ESTATE_CONSTS.MAX_HOUSES).toBe(5);
  });
});
