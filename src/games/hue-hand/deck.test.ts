import { describe, expect, it } from "vitest";
import {
  COLORS,
  buildDeck,
  cardFace,
  cardLabel,
  cardScore,
  cardsByIds,
  deckCensus,
  isDrawCard,
  isWild,
  shuffle,
  shuffledDeck,
} from "./deck";

describe("牌堆结构", () => {
  const deck = buildDeck();
  const census = deckCensus(deck);

  it("一副牌正好 108 张", () => {
    expect(deck.length).toBe(108);
    expect(census.total).toBe(108);
  });

  it("数字牌 76 张:0 每色 1 张、1–9 每色 2 张", () => {
    expect(census.num).toBe(76);
    expect(census.num0).toBe(4);
    for (let n = 1; n <= 9; n++) expect(census[`num${n}`], `数字 ${n}`).toBe(8);
  });

  it("跳过 / 反转 / 加二 每色 2 张,一共 24 张", () => {
    expect(census.skip).toBe(8);
    expect(census.reverse).toBe(8);
    expect(census.draw2).toBe(8);
    for (const color of COLORS) {
      const own = deck.filter((c) => c.color === color);
      expect(own.filter((c) => c.kind === "skip").length, color).toBe(2);
      expect(own.filter((c) => c.kind === "reverse").length, color).toBe(2);
      expect(own.filter((c) => c.kind === "draw2").length, color).toBe(2);
    }
  });

  it("万能换色 4 张 + 万能加四 4 张,而且不带颜色", () => {
    expect(census.wild).toBe(4);
    expect(census.wild4).toBe(4);
    for (const card of deck) {
      if (isWild(card)) expect(card.color).toBeNull();
    }
  });

  it("每种颜色各 25 张,四色加起来 100 张", () => {
    let colored = 0;
    for (const color of COLORS) {
      expect(census[color], color).toBe(25);
      colored += census[color];
    }
    expect(colored).toBe(100);
  });

  it("牌的编号不重复", () => {
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
  });
});

describe("洗牌与取牌", () => {
  it("同一个种子洗出同一副牌,不同种子洗出不一样的", () => {
    const a = shuffledDeck(2024);
    const b = shuffledDeck(2024);
    const c = shuffledDeck(2025);
    expect(a.cards.map((x) => x.id)).toEqual(b.cards.map((x) => x.id));
    expect(a.cards.map((x) => x.id)).not.toEqual(c.cards.map((x) => x.id));
  });

  it("洗牌只换顺序,一张不多一张不少", () => {
    const shuffled = shuffle(buildDeck(), 77).cards;
    expect(shuffled.length).toBe(108);
    expect(new Set(shuffled.map((c) => c.id)).size).toBe(108);
  });

  it("按编号能把关卡表里写的手牌还原出来", () => {
    const hand = cardsByIds([0, 1, 100]);
    expect(hand.length).toBe(3);
    expect(hand[0].kind).toBe("num");
    expect(hand[0].num).toBe(0);
  });
});

describe("牌面与计分权重", () => {
  const deck = buildDeck();
  const find = (kind: string, num?: number) =>
    deck.find((c) => c.kind === kind && (num === undefined || c.num === num))!;

  it("数字牌按面值,功能牌 20,万能牌 50", () => {
    expect(cardScore(find("num", 7))).toBe(7);
    expect(cardScore(find("num", 0))).toBe(0);
    expect(cardScore(find("skip"))).toBe(20);
    expect(cardScore(find("reverse"))).toBe(20);
    expect(cardScore(find("draw2"))).toBe(20);
    expect(cardScore(find("wild"))).toBe(50);
    expect(cardScore(find("wild4"))).toBe(50);
  });

  it("加二和加四才算加牌链的牌", () => {
    expect(isDrawCard(find("draw2"))).toBe(true);
    expect(isDrawCard(find("wild4"))).toBe(true);
    expect(isDrawCard(find("skip"))).toBe(false);
    expect(isDrawCard(find("num", 3))).toBe(false);
  });

  it("牌面文字读得懂,而且带颜色名(色盲也认得出)", () => {
    expect(cardLabel(find("num", 5))).toContain("5");
    expect(cardLabel(find("num", 5))).toContain("色");
    expect(cardLabel(find("skip"))).toContain("跳过");
    expect(cardLabel(find("wild4"))).toBe("万能加四");
    expect(cardFace(find("num", 8))).toBe("8");
    expect(cardFace(find("draw2"))).toBe("+2");
  });
});
