import { describe, expect, it } from "vitest";
import {
  BIG_JOKER,
  DECK_SIZE,
  SMALL_JOKER,
  beats,
  cardLabel,
  cardRank,
  cardSuit,
  dealCards,
  describePlay,
  gentleHint,
  handStrength,
  isBombLike,
  isJoker,
  makeDeck,
  multiplierLine,
  parsePlay,
  rankEntries,
  rankLabel,
  settleScore,
  sortAsc,
  sortDesc,
  springState,
  suggestBid,
  type Play,
} from "./logic";

// ---------------------------------------------------------------------------
// 测试用的小工具:用 "3 3 3 4" 这样的写法拼出具体的牌
// ---------------------------------------------------------------------------

const RANK_OF: Record<string, number> = {
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  "2": 15,
  w: 16, // 小王
  W: 17, // 大王
};

/** "3 3 4" → 具体的 card id;同点数依次换花色,所以不会撞 id */
function cards(spec: string): number[] {
  const used = new Map<number, number>();
  return spec
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const r = RANK_OF[tok];
      if (r === undefined) throw new Error(`看不懂的牌:${tok}`);
      const n = used.get(r) ?? 0;
      used.set(r, n + 1);
      if (r === 16) return SMALL_JOKER;
      if (r === 17) return BIG_JOKER;
      return (r - 3) * 4 + n;
    });
}

/** 直接拿到解析结果,解析不出来就报错(用在「这一定是合法牌型」的用例里) */
function play(spec: string): Play {
  const p = parsePlay(cards(spec));
  if (!p) throw new Error(`应该是合法牌型:${spec}`);
  return p;
}

describe("一副牌", () => {
  it("整副牌 54 张,id 连续", () => {
    const deck = makeDeck();
    expect(deck).toHaveLength(DECK_SIZE);
    expect(new Set(deck).size).toBe(DECK_SIZE);
  });

  it("点数:3 最小、2 比 A 大、大王最大", () => {
    expect(cardRank(cards("3")[0])).toBe(3);
    expect(cardRank(cards("A")[0])).toBeLessThan(cardRank(cards("2")[0]));
    expect(cardRank(cards("2")[0])).toBeLessThan(cardRank(SMALL_JOKER));
    expect(cardRank(SMALL_JOKER)).toBeLessThan(cardRank(BIG_JOKER));
  });

  it("花色与写法", () => {
    expect(cardSuit(0)).toBe("♠");
    expect(cardSuit(SMALL_JOKER)).toBeNull();
    expect(isJoker(BIG_JOKER)).toBe(true);
    expect(isJoker(0)).toBe(false);
    expect(cardLabel(cards("A")[0])).toBe("♠A");
    expect(cardLabel(BIG_JOKER)).toBe("大王");
    expect(rankLabel(11)).toBe("J");
    expect(rankLabel(15)).toBe("2");
  });

  it("发牌:三家各 17 张 + 3 张底牌,同一个种子结果一样", () => {
    const a = dealCards(20260826);
    const b = dealCards(20260826);
    expect(a.hands.map((h) => h.length)).toEqual([17, 17, 17]);
    expect(a.bottom).toHaveLength(3);
    expect(a).toEqual(b);
    const all = [...a.hands.flat(), ...a.bottom];
    expect(new Set(all).size).toBe(DECK_SIZE);
  });

  it("排序:扇形手牌从大到小,理牌从小到大", () => {
    const raw = cards("3 A 7 W");
    expect(sortDesc(raw).map(cardRank)).toEqual([17, 14, 7, 3]);
    expect(sortAsc(raw).map(cardRank)).toEqual([3, 7, 14, 17]);
  });

  it("按点数统计张数", () => {
    expect(rankEntries(cards("3 3 4"))).toEqual([
      { rank: 3, count: 2 },
      { rank: 4, count: 1 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 牌型识别
// ---------------------------------------------------------------------------

describe("牌型识别", () => {
  it("单张", () => {
    expect(play("7")).toMatchObject({ type: "single", main: 7, len: 1 });
  });

  it("单个小王也是单张,不是王炸", () => {
    expect(play("w")).toMatchObject({ type: "single", main: 16 });
  });

  it("对子", () => {
    expect(play("9 9")).toMatchObject({ type: "pair", main: 9 });
  });

  it("两张点数不同不是对子", () => {
    expect(parsePlay(cards("9 10"))).toBeNull();
  });

  it("三张", () => {
    expect(play("Q Q Q")).toMatchObject({ type: "triple", main: 12 });
  });

  it("三带一", () => {
    expect(play("5 5 5 9")).toMatchObject({ type: "triple_single", main: 5 });
  });

  it("三带一对", () => {
    expect(play("5 5 5 9 9")).toMatchObject({ type: "triple_pair", main: 5 });
  });

  it("三带两张不同点的散牌不成立", () => {
    expect(parsePlay(cards("5 5 5 9 10"))).toBeNull();
  });

  it("两对不是牌型", () => {
    expect(parsePlay(cards("3 3 4 4"))).toBeNull();
  });

  it("顺子 5 张", () => {
    expect(play("3 4 5 6 7")).toMatchObject({ type: "straight", main: 7, len: 5 });
  });

  it("顺子最长 12 张(3 到 A)", () => {
    expect(play("3 4 5 6 7 8 9 10 J Q K A")).toMatchObject({ type: "straight", main: 14, len: 12 });
  });

  it("顺子里不能有 2", () => {
    expect(parsePlay(cards("10 J Q K A 2"))).toBeNull();
  });

  it("顺子里不能有王", () => {
    expect(parsePlay(cards("10 J Q K A w"))).toBeNull();
  });

  it("只有 4 张连着还不算顺子", () => {
    expect(parsePlay(cards("3 4 5 6"))).toBeNull();
  });

  it("断了一张就不是顺子", () => {
    expect(parsePlay(cards("3 4 5 6 8"))).toBeNull();
  });

  it("顺子乱序传进来也认得出", () => {
    expect(play("7 3 5 4 6")).toMatchObject({ type: "straight", main: 7, len: 5 });
  });

  it("连对 3 对", () => {
    expect(play("3 3 4 4 5 5")).toMatchObject({ type: "double_straight", main: 5, len: 3 });
  });

  it("连对 5 对", () => {
    expect(play("9 9 10 10 J J Q Q K K")).toMatchObject({ type: "double_straight", main: 13, len: 5 });
  });

  it("只有 2 对不算连对", () => {
    expect(parsePlay(cards("3 3 4 4"))).toBeNull();
  });

  it("连对里不能有 2", () => {
    expect(parsePlay(cards("K K A A 2 2"))).toBeNull();
  });

  it("不连着的三对不算连对", () => {
    expect(parsePlay(cards("3 3 4 4 6 6"))).toBeNull();
  });

  it("飞机:两组连着的三张", () => {
    expect(play("3 3 3 4 4 4")).toMatchObject({ type: "plane", main: 4, len: 2 });
  });

  it("飞机:三组连着的三张", () => {
    expect(play("K K K Q Q Q J J J")).toMatchObject({ type: "plane", main: 13, len: 3 });
  });

  it("飞机带单:两组三张 + 两张散牌", () => {
    expect(play("3 3 3 4 4 4 8 9")).toMatchObject({ type: "plane_single", main: 4, len: 2 });
  });

  it("飞机带单:翅膀是一对也算两张单牌", () => {
    expect(play("3 3 3 4 4 4 8 8")).toMatchObject({ type: "plane_single", main: 4, len: 2 });
  });

  it("飞机带对:两组三张 + 两对", () => {
    expect(play("3 3 3 4 4 4 8 8 9 9")).toMatchObject({ type: "plane_pair", main: 4, len: 2 });
  });

  it("飞机带对:三组三张 + 三对", () => {
    expect(play("5 5 5 6 6 6 7 7 7 9 9 10 10 J J")).toMatchObject({ type: "plane_pair", main: 7, len: 3 });
  });

  it("两组三张不连着就不是飞机", () => {
    expect(parsePlay(cards("3 3 3 5 5 5"))).toBeNull();
  });

  it("222 333 不是飞机:2 不能进连牌", () => {
    expect(parsePlay(cards("2 2 2 3 3 3"))).toBeNull();
  });

  it("AAA 222 也不是飞机", () => {
    expect(parsePlay(cards("A A A 2 2 2"))).toBeNull();
  });

  it("飞机翅膀数量不对就不成立", () => {
    expect(parsePlay(cards("3 3 3 4 4 4 8"))).toBeNull();
  });

  it("四组连着的三张认成 4 组纯飞机,不会误判成带翅膀", () => {
    expect(play("3 3 3 4 4 4 5 5 5 6 6 6")).toMatchObject({ type: "plane", len: 4 });
  });

  it("炸弹", () => {
    expect(play("8 8 8 8")).toMatchObject({ type: "bomb", main: 8 });
  });

  it("王炸", () => {
    expect(play("w W")).toMatchObject({ type: "rocket", main: 17 });
  });

  it("四带二(两张单牌)", () => {
    expect(play("7 7 7 7 3 9")).toMatchObject({ type: "four_two_single", main: 7 });
  });

  it("四带二可以带走一对", () => {
    expect(play("7 7 7 7 3 3")).toMatchObject({ type: "four_two_single", main: 7 });
  });

  it("四带二不许拿王炸来当那两张", () => {
    expect(parsePlay(cards("7 7 7 7 w W"))).toBeNull();
  });

  it("四带两对", () => {
    expect(play("7 7 7 7 3 3 9 9")).toMatchObject({ type: "four_two_pair", main: 7 });
  });

  it("四带三张散牌不成立", () => {
    expect(parsePlay(cards("7 7 7 7 3 4 5"))).toBeNull();
  });

  it("四张 + 一张不成立", () => {
    expect(parsePlay(cards("7 7 7 7 3"))).toBeNull();
  });

  it("空手不是牌型", () => {
    expect(parsePlay([])).toBeNull();
  });

  it("同一张牌算两次不算数", () => {
    expect(parsePlay([5, 5])).toBeNull();
  });

  it("超出牌堆的 id 不算数", () => {
    expect(parsePlay([99])).toBeNull();
  });

  it("八张连对优先认成连对,不会当成四带两对", () => {
    expect(play("3 3 4 4 5 5 6 6")).toMatchObject({ type: "double_straight", len: 4 });
  });

  it("炸弹与王炸都算「炸」,其他牌型不算", () => {
    expect(isBombLike(play("8 8 8 8"))).toBe(true);
    expect(isBombLike(play("w W"))).toBe(true);
    expect(isBombLike(play("8 8 8"))).toBe(false);
  });

  it("牌型中文说法", () => {
    expect(describePlay(play("3 4 5 6 7"))).toBe("顺子 3-7");
    expect(describePlay(play("8 8 8 8"))).toBe("炸弹 8");
    expect(describePlay(play("w W"))).toBe("王炸");
    expect(describePlay(play("3 3 4 4 5 5"))).toBe("连对 3-5");
  });
});

// ---------------------------------------------------------------------------
// 牌型比较
// ---------------------------------------------------------------------------

describe("牌型比较", () => {
  it("先手时什么牌都能出", () => {
    expect(beats(play("3"), null)).toBe(true);
    expect(beats(play("3 4 5 6 7"), null)).toBe(true);
  });

  it("大单张压小单张", () => {
    expect(beats(play("A"), play("K"))).toBe(true);
    expect(beats(play("K"), play("A"))).toBe(false);
  });

  it("一样大的单张压不住", () => {
    const a = parsePlay([cards("9")[0]])!;
    const b = parsePlay([cards("9")[0] + 1])!;
    expect(beats(a, b)).toBe(false);
  });

  it("2 比 A 大,小王比 2 大,大王最大", () => {
    expect(beats(play("2"), play("A"))).toBe(true);
    expect(beats(play("w"), play("2"))).toBe(true);
    expect(beats(play("W"), play("w"))).toBe(true);
  });

  it("单张压不住对子", () => {
    expect(beats(play("A"), play("3 3"))).toBe(false);
  });

  it("对子只跟对子比", () => {
    expect(beats(play("9 9"), play("8 8"))).toBe(true);
    expect(beats(play("8 8"), play("9 9"))).toBe(false);
  });

  it("三张只跟三张比", () => {
    expect(beats(play("9 9 9"), play("8 8 8"))).toBe(true);
    expect(beats(play("9 9 9"), play("8 8 8 3"))).toBe(false);
  });

  it("三带一只看三张那部分的点数", () => {
    expect(beats(play("9 9 9 3"), play("8 8 8 A"))).toBe(true);
  });

  it("三带一对压不住三带一(带的东西不一样)", () => {
    expect(beats(play("9 9 9 3 3"), play("8 8 8 A"))).toBe(false);
  });

  it("顺子必须一样长", () => {
    expect(beats(play("4 5 6 7 8 9"), play("3 4 5 6 7"))).toBe(false);
    expect(beats(play("4 5 6 7 8"), play("3 4 5 6 7"))).toBe(true);
  });

  it("顺子比最大的那张", () => {
    expect(beats(play("3 4 5 6 7"), play("4 5 6 7 8"))).toBe(false);
  });

  it("连对必须一样长", () => {
    expect(beats(play("4 4 5 5 6 6 7 7"), play("3 3 4 4 5 5"))).toBe(false);
    expect(beats(play("4 4 5 5 6 6"), play("3 3 4 4 5 5"))).toBe(true);
  });

  it("飞机必须一样长", () => {
    expect(beats(play("4 4 4 5 5 5 6 6 6"), play("3 3 3 4 4 4"))).toBe(false);
    expect(beats(play("5 5 5 6 6 6"), play("3 3 3 4 4 4"))).toBe(true);
  });

  it("飞机带单只跟飞机带单比", () => {
    expect(beats(play("5 5 5 6 6 6 3 4"), play("3 3 3 4 4 4 9 10"))).toBe(true);
    expect(beats(play("5 5 5 6 6 6"), play("3 3 3 4 4 4 9 10"))).toBe(false);
  });

  it("四带二比四张那部分的点数", () => {
    expect(beats(play("9 9 9 9 3 4"), play("8 8 8 8 A 2"))).toBe(true);
  });

  it("炸弹压得住任何普通牌型", () => {
    expect(beats(play("3 3 3 3"), play("A A A 2 2"))).toBe(true);
    expect(beats(play("3 3 3 3"), play("3 4 5 6 7 8 9"))).toBe(true);
  });

  it("大炸弹压小炸弹,小的压不住大的", () => {
    expect(beats(play("K K K K"), play("8 8 8 8"))).toBe(true);
    expect(beats(play("8 8 8 8"), play("K K K K"))).toBe(false);
  });

  it("普通牌型压不住炸弹", () => {
    expect(beats(play("2 2 2 2 3 4"), play("3 3 3 3"))).toBe(false);
    expect(beats(play("2"), play("3 3 3 3"))).toBe(false);
  });

  it("王炸压得住炸弹", () => {
    expect(beats(play("w W"), play("2 2 2 2"))).toBe(true);
  });

  it("炸弹压不住王炸,王炸也压不住王炸", () => {
    expect(beats(play("2 2 2 2"), play("w W"))).toBe(false);
    expect(beats(play("w W"), play("w W"))).toBe(false);
  });

  it("四带二不是炸弹,压不住炸弹", () => {
    expect(beats(play("A A A A 3 4"), play("3 3 3 3"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 温和提示
// ---------------------------------------------------------------------------

describe("温和的非法提示", () => {
  const scold = /错|不行|不对|笨|失败/;

  it("一张没选时提醒先挑牌", () => {
    expect(gentleHint([], null)).toContain("挑几张");
  });

  it("凑不成牌型时给方向,不批评", () => {
    const msg = gentleHint(cards("3 4"), null);
    expect(msg).toContain("牌型");
    expect(msg).not.toMatch(scold);
  });

  it("同牌型小了一点会点出来", () => {
    expect(gentleHint(cards("8"), play("K"))).toContain("小了一点点");
  });

  it("上家是炸弹会说清楚要更大的炸弹", () => {
    expect(gentleHint(cards("A"), play("3 3 3 3"))).toContain("炸弹");
  });

  it("上家是王炸就劝一句先过", () => {
    expect(gentleHint(cards("2 2 2 2"), play("w W"))).toContain("王炸");
  });

  it("牌型对不上会告诉你上家出的是什么", () => {
    expect(gentleHint(cards("A"), play("3 3"))).toContain("对子");
  });

  it("每一句都不带责备的字眼", () => {
    const all = [
      gentleHint([], null),
      gentleHint(cards("3 4"), null),
      gentleHint(cards("8"), play("K")),
      gentleHint(cards("A"), play("3 3 3 3")),
      gentleHint(cards("2 2 2 2"), play("w W")),
      gentleHint(cards("A"), play("3 3")),
    ];
    for (const msg of all) expect(msg).not.toMatch(scold);
  });
});

// ---------------------------------------------------------------------------
// 叫分与算分
// ---------------------------------------------------------------------------

describe("叫分", () => {
  it("一手大牌值得叫 3 分", () => {
    expect(handStrength(cards("w W 2 2 2 2 A A A"))).toBeGreaterThan(40);
    expect(suggestBid(cards("w W 2 2 2 2 A A A"), 0)).toBe(3);
  });

  it("一手小散牌就不叫", () => {
    expect(suggestBid(cards("3 4 5 6 7 8 9 10 J"), 0)).toBe(0);
  });

  it("叫不过场上已有的分就不叫", () => {
    expect(suggestBid(cards("w W 2 2 2 2 A A A"), 3)).toBe(0);
  });
});

describe("春天与算分", () => {
  it("地主赢且农民一张没出 = 春天", () => {
    expect(springState(true, 0, 5)).toEqual({ spring: true, antiSpring: false });
  });

  it("农民出过牌就不算春天", () => {
    expect(springState(true, 2, 5).spring).toBe(false);
  });

  it("农民赢且地主只出过第一手 = 反春天", () => {
    expect(springState(false, 6, 1)).toEqual({ spring: false, antiSpring: true });
  });

  it("地主出过两手就不算反春天", () => {
    expect(springState(false, 6, 2).antiSpring).toBe(false);
  });

  it("底分乘炸弹倍数", () => {
    const r = settleScore({ landlordWon: true, base: 2, bombs: 2, spring: false, antiSpring: false });
    expect(r.multiplier).toBe(4);
    expect(r.score).toBe(8);
  });

  it("春天再翻一倍", () => {
    const r = settleScore({ landlordWon: true, base: 1, bombs: 1, spring: true, antiSpring: false });
    expect(r.multiplier).toBe(4);
    expect(r.score).toBe(4);
  });

  it("地主输了记负分", () => {
    const r = settleScore({ landlordWon: false, base: 3, bombs: 0, spring: false, antiSpring: true });
    expect(r.score).toBe(-6);
  });

  it("倍数那行把每一项都写清楚", () => {
    const r = settleScore({ landlordWon: true, base: 2, bombs: 1, spring: true, antiSpring: false });
    expect(multiplierLine(r)).toBe("底分 2 · 1 个炸 ×2 · 春天 ×2 = 8 分");
  });
});
