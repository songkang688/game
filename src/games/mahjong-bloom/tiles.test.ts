import { describe, expect, it } from "vitest";
import {
  DECK_SIZE,
  countOf,
  formatTiles,
  fromCounts,
  fullDeck,
  idIndex,
  indexId,
  isDragon,
  isFlower,
  isHonor,
  isNumber,
  isTerminal,
  isTerminalOrHonor,
  isWind,
  maxCopies,
  parseTiles,
  rankOf,
  removeTile,
  sortTiles,
  suitOf,
  suitsUsed,
  tileFace,
  tileId,
  tileName,
  tileOf,
  toCounts,
  windId
} from "./tiles";
import { deal, isCompleteDeck, shuffleWall, wallLeft } from "./wall";

describe("牌的编码", () => {
  it("一副牌 144 张：数牌 108 + 风 16 + 箭 12 + 花 8", () => {
    const deck = fullDeck();
    expect(deck.length).toBe(DECK_SIZE);
    expect(deck.filter(isNumber).length).toBe(108);
    expect(deck.filter(isWind).length).toBe(16);
    expect(deck.filter(isDragon).length).toBe(12);
    expect(deck.filter(isFlower).length).toBe(8);
  });

  it("tileId 稳定可排序：万 < 筒 < 条 < 字 < 花", () => {
    expect(tileId({ suit: "m", rank: 1 })).toBe(1);
    expect(tileId({ suit: "p", rank: 1 })).toBe(11);
    expect(tileId({ suit: "s", rank: 9 })).toBe(29);
    expect(tileId({ suit: "z", rank: 7 })).toBe(37);
    expect(tileId({ suit: "f", rank: 8 })).toBe(48);
    const sorted = [37, 1, 21, 11].sort((a, b) => a - b);
    expect(sorted).toEqual([1, 11, 21, 37]);
  });

  it("tileId 和 tileOf 是一对互逆的函数", () => {
    for (const id of fullDeck()) {
      expect(tileId(tileOf(id))).toBe(id);
      expect(suitOf(id)).toBe(tileOf(id).suit);
      expect(rankOf(id)).toBe(tileOf(id).rank);
    }
  });

  it("幺九牌 = 数牌一九 + 全部字牌", () => {
    expect(isTerminalOrHonor(1)).toBe(true);
    expect(isTerminalOrHonor(9)).toBe(true);
    expect(isTerminalOrHonor(5)).toBe(false);
    expect(isTerminalOrHonor(35)).toBe(true);
    expect(isTerminal(35)).toBe(false);
    expect(isHonor(35)).toBe(true);
  });

  it("花牌一副只有一张，别的牌各四张", () => {
    expect(maxCopies(41)).toBe(1);
    expect(maxCopies(5)).toBe(4);
  });

  it("风位 1..4 对应东南西北，越界会绕回来", () => {
    expect(windId(1)).toBe(31);
    expect(windId(4)).toBe(34);
    expect(windId(5)).toBe(31);
  });

  it("简写能来回转换", () => {
    expect(parseTiles("123m")).toEqual([1, 2, 3]);
    expect(parseTiles("19m19p19s1234567z").length).toBe(13);
    expect(formatTiles(parseTiles("321m55p"))).toBe("123m55p");
    expect(parseTiles("哈哈")).toEqual([]);
  });

  it("牌面画出来是「数字 + 花色」或者一个字", () => {
    expect(tileFace(parseTiles("3s")[0])).toEqual({ top: "3", bottom: "条" });
    expect(tileFace(parseTiles("5z")[0]).top).toBe("中");
    expect(tileName(parseTiles("3m")[0])).toBe("三万");
    expect(tileName(parseTiles("1z")[0])).toBe("东");
  });

  it("计数数组和 id 数组能互转", () => {
    const hand = parseTiles("11123m456p");
    const c = toCounts(hand);
    expect(c[idIndex(1)]).toBe(3);
    expect(fromCounts(c)).toEqual(sortTiles(hand));
    for (let i = 0; i < 34; i++) expect(idIndex(indexId(i))).toBe(i);
  });

  it("拿牌拿不到就返回 null，不抛异常", () => {
    const hand = parseTiles("123m");
    expect(removeTile(hand, 2)).toEqual([1, 3]);
    expect(removeTile(hand, 9)).toBeNull();
    expect(countOf(hand, 2)).toBe(1);
  });

  it("只按万筒条字算门，花牌不算一门", () => {
    expect(suitsUsed(parseTiles("123m5z1f"))).toEqual(["m", "z"]);
  });
});

describe("洗牌与发牌", () => {
  it("同一个 seed 洗出同一副牌，不同 seed 不一样", () => {
    expect(shuffleWall(7)).toEqual(shuffleWall(7));
    expect(shuffleWall(7)).not.toEqual(shuffleWall(8));
  });

  it("洗完还是完整的 144 张", () => {
    for (const seed of [1, 42, 999]) {
      expect(isCompleteDeck(shuffleWall(seed))).toBe(true);
    }
  });

  it("发牌后庄家 14 张、其余三家各 13 张，且没有花牌留在手里", () => {
    const r = deal(shuffleWall(123), 0);
    expect(r.hands[0].length).toBe(14);
    expect(r.hands[1].length).toBe(13);
    expect(r.hands[2].length).toBe(13);
    expect(r.hands[3].length).toBe(13);
    for (const h of r.hands) expect(h.some(isFlower)).toBe(false);
  });

  it("发出去的牌加牌墙剩下的还是 144 张", () => {
    const r = deal(shuffleWall(2024), 1);
    const used = r.hands.flat().length + r.flowers.flat().length;
    expect(used + wallLeft(r.wall)).toBe(DECK_SIZE);
    expect(r.dealer).toBe(1);
  });

  it("牌墙不完整时也不会死循环", () => {
    const tiny = shuffleWall(5).slice(0, 20);
    const r = deal(tiny, 0);
    expect(r.hands.length).toBe(4);
  });
});
