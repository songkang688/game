import { describe, expect, it } from "vitest";
import { CHANCE_CARDS, FATE_CARDS, cardsOf, drawChance, drawFate, makeDeck } from "./cards";
import { STATION_TILES } from "./board";
import { nearestStationFrom } from "./economy";
import { mulberry32 } from "../level99";

describe("机会 / 命运卡", () => {
  it("两副牌各 ≥16 张，id 不重复，文案不为空", () => {
    expect(CHANCE_CARDS.length).toBeGreaterThanOrEqual(16);
    expect(FATE_CARDS.length).toBeGreaterThanOrEqual(16);
    const ids = [...CHANCE_CARDS, ...FATE_CARDS].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of [...CHANCE_CARDS, ...FATE_CARDS]) {
      expect(c.text.trim().length).toBeGreaterThan(4);
    }
  });

  it("规格点名的几类卡都有：进小黑屋、回出发、修缮、生日收钱、天上掉钱、缴税", () => {
    const all = [...CHANCE_CARDS, ...FATE_CARDS];
    const kinds = all.map((c) => c.effect.kind);
    expect(kinds).toContain("goJail");
    expect(kinds).toContain("outCard");
    expect(kinds).toContain("repairs");
    expect(kinds).toContain("collectEach");
    expect(kinds).toContain("payEach");
    expect(kinds).toContain("allPay");
    expect(kinds).toContain("nearestStation");
    expect(all.some((c) => c.effect.kind === "moveTo" && c.effect.pos === 0)).toBe(true);
    expect(all.some((c) => c.effect.kind === "cash" && c.effect.amount === 50)).toBe(true);
    expect(all.some((c) => c.effect.kind === "cash" && c.effect.amount < 0)).toBe(true);
    expect(all.some((c) => c.effect.kind === "repairs" && c.effect.perHouse === 40 && c.effect.perHotel === 115)).toBe(true);
    expect(all.some((c) => c.effect.kind === "collectEach" && c.effect.amount === 10)).toBe(true);
  });

  it("挪位置的卡都指向真实存在的格子", () => {
    for (const c of [...CHANCE_CARDS, ...FATE_CARDS]) {
      if (c.effect.kind === "moveTo") {
        expect(c.effect.pos).toBeGreaterThanOrEqual(0);
        expect(c.effect.pos).toBeLessThan(40);
      }
      if (c.effect.kind === "moveBy") {
        expect(Math.abs(c.effect.steps)).toBeLessThanOrEqual(6);
      }
    }
  });

  it("一副牌抽完会自动洗回，永远抽得出下一张", () => {
    const rand = mulberry32(42);
    const deck = makeDeck("chance", rand);
    expect(deck.shuffles).toBe(1);
    const n = cardsOf("chance").length;
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) seen.add(drawChance(deck, rand).id);
    expect(seen.size).toBe(n);
    expect(deck.shuffles).toBe(1);
    expect(drawChance(deck, rand)).toBeTruthy();
    expect(deck.shuffles).toBe(2);
  });

  it("同一个种子洗出来的顺序完全一样", () => {
    const a = makeDeck("fate", mulberry32(7));
    const b = makeDeck("fate", mulberry32(7));
    expect(a.order).toEqual(b.order);
    const ra = mulberry32(7);
    const rb = mulberry32(7);
    const da = makeDeck("fate", ra);
    const db = makeDeck("fate", rb);
    expect(drawFate(da, ra).id).toBe(drawFate(db, rb).id);
  });

  it("往前找最近的车站，绕过一圈也找得到", () => {
    expect(nearestStationFrom(0)).toBe(5);
    expect(nearestStationFrom(5)).toBe(15);
    expect(nearestStationFrom(36)).toBe(5);
    for (let p = 0; p < 40; p++) expect(STATION_TILES).toContain(nearestStationFrom(p));
  });
});
