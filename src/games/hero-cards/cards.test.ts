import { describe, expect, it } from "vitest";
import {
  CARD_HINTS,
  CARD_NAMES,
  DECK_RECIPE,
  GEARS,
  buildPile,
  cardClass,
  cardLabel,
  cardName,
  createPile,
  discardTo,
  draw,
  flipTop,
  isBlack,
  isDelayed,
  isRed,
  makeCard,
  pointLabel,
  recipeTotal,
  recycle,
  shuffle,
  type CardKind
} from "./cards";
import { makeRand } from "./engine";

describe("花色与分类", () => {
  it("花和果是红门,叶和石是黑门", () => {
    expect(isRed(makeCard("slash", "flower"))).toBe(true);
    expect(isRed(makeCard("slash", "berry"))).toBe(true);
    expect(isBlack(makeCard("slash", "leaf"))).toBe(true);
    expect(isBlack(makeCard("slash", "stone"))).toBe(true);
  });

  it("三层分类分得清:基本牌 / 锦囊 / 装备", () => {
    expect(cardClass("slash")).toBe("basic");
    expect(cardClass("dodge")).toBe("basic");
    expect(cardClass("heal")).toBe("basic");
    expect(cardClass("snatch")).toBe("trick");
    expect(cardClass("nullify")).toBe("trick");
    expect(cardClass("weapon")).toBe("gear");
    expect(cardClass("horseMinus")).toBe("gear");
  });

  it("只有贪玩令是延时锦囊", () => {
    expect(isDelayed("playful")).toBe(true);
    expect(isDelayed("snatch")).toBe(false);
    expect(isDelayed("slash")).toBe(false);
  });

  it("每一种牌都有原创名字和一句说明,一个都不漏", () => {
    const kinds = Object.keys(CARD_NAMES) as CardKind[];
    expect(kinds.length).toBe(15);
    for (const k of kinds) {
      expect(CARD_NAMES[k].length).toBeGreaterThan(0);
      expect(CARD_HINTS[k].length).toBeGreaterThan(6);
    }
  });

  it("装备牌报型号,别的牌报牌名", () => {
    expect(cardName(makeCard("slash", "flower", 7))).toBe("花瓣击");
    expect(cardName(makeCard("weapon", "leaf", 7, "kite"))).toBe("纸鸢长弓");
    expect(cardLabel(makeCard("dodge", "berry", 13))).toBe("🍒K 星星盾");
    expect(pointLabel(1)).toBe("A");
    expect(pointLabel(11)).toBe("J");
    expect(pointLabel(7)).toBe("7");
  });

  it("五件武器的范围分别是 1..4,连珠花轮换的是出牌次数", () => {
    expect(GEARS.flute.range).toBe(1);
    expect(GEARS.fan.range).toBe(2);
    expect(GEARS.ribbon.range).toBe(3);
    expect(GEARS.kite.range).toBe(4);
    expect(GEARS.wheel.unlimitedSlash).toBe(true);
  });
});

describe("牌堆", () => {
  it("整套牌张数与配方对得上,红黑两门都有", () => {
    const pile = buildPile();
    expect(pile.length).toBe(recipeTotal(DECK_RECIPE));
    expect(pile.length).toBeGreaterThan(90);
    expect(pile.some(isRed)).toBe(true);
    expect(pile.some(isBlack)).toBe(true);
    expect(new Set(pile.map((c) => c.id)).size).toBe(pile.length);
  });

  it("同一个种子洗出来的牌序一模一样", () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], makeRand(99));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], makeRand(99));
    const c = shuffle([1, 2, 3, 4, 5, 6, 7, 8], makeRand(100));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("摸牌是从顶上一张张来的", () => {
    const pile = createPile(makeRand(7), [{ kind: "slash", count: 5 }]);
    const top3 = pile.deck.slice(0, 3).map((c) => c.id);
    expect(draw(pile, 3).map((c) => c.id)).toEqual(top3);
    expect(pile.deck.length).toBe(2);
  });

  it("牌堆抽空就把弃牌堆洗回来接着用", () => {
    const pile = createPile(makeRand(3), [{ kind: "slash", count: 4 }]);
    const all = draw(pile, 4);
    expect(pile.deck.length).toBe(0);
    discardTo(pile, all);
    expect(pile.discard.length).toBe(4);
    // 抽空之后再摸,弃牌堆整叠洗回牌堆
    const more = draw(pile, 2);
    expect(more.length).toBe(2);
    expect(pile.recycles).toBe(1);
    expect(pile.discard.length).toBe(0);
  });

  it("牌堆和弃牌堆都空了,摸牌只能摸个空,但不报错", () => {
    const pile = createPile(makeRand(3), [{ kind: "slash", count: 2 }]);
    draw(pile, 2);
    expect(recycle(pile)).toBe(false);
    expect(draw(pile, 3)).toEqual([]);
    expect(flipTop(pile)).toBeNull();
  });

  it("判定翻出来的那张直接进弃牌堆", () => {
    const pile = createPile(makeRand(11), [{ kind: "slash", count: 6 }]);
    const card = flipTop(pile);
    expect(card).not.toBeNull();
    expect(pile.discard.map((c) => c.id)).toContain(card!.id);
    expect(pile.deck.length).toBe(5);
  });
});
