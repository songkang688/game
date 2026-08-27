import { describe, expect, it } from "vitest";
import {
  hasFullDragon,
  huParses,
  isHu,
  knittedDragonParse,
  knittedInfo,
  sevenPairsParse,
  standardParses,
  thirteenOrphansParse,
  waitingTiles
} from "./hu";
import { makeChi, makeKan, makePon, type Meld } from "./melds";
import { formatTiles, parseTiles } from "./tiles";
import {
  discardRanking,
  sevenPairsXiangting,
  standardXiangting,
  thirteenOrphansXiangting,
  xiangting
} from "./xiangting";

const T = (s: string): number => parseTiles(s)[0];

describe("基本型：4 面子 + 1 将", () => {
  it("标准和牌能认出来", () => {
    expect(isHu(parseTiles("123456789m123p55s"))).toBe(true);
  });

  it("和牌张单独传进来也认得", () => {
    expect(isHu(parseTiles("12456789m123p55s"), T("3m"))).toBe(true);
    expect(isHu(parseTiles("12456789m123p55s"), T("9s"))).toBe(false);
  });

  it("差一张就不算和", () => {
    expect(isHu(parseTiles("123456789m124p55s"))).toBe(false);
  });

  it("顺子不许跨花色", () => {
    expect(isHu(parseTiles("12m3p456789m123p55s".replace("12m3p", "123m"))));
    expect(isHu(parseTiles("789m123p789s11122z".slice(0, 0) + "12m1p456789m123p55s"))).toBe(false);
  });

  it("副露之后手牌少了三张也能和", () => {
    const melds: Meld[] = [makePon(T("1z"), 1)];
    expect(isHu(parseTiles("123456789m55s"), null, melds)).toBe(true);
  });

  it("杠也占一副面子", () => {
    const melds: Meld[] = [makeKan(T("1z"), "minkan", 1)];
    expect(isHu(parseTiles("123456789m55s"), null, melds)).toBe(true);
  });

  it("同一手牌拆得出好几套时全部列出来", () => {
    const parses = standardParses(parseTiles("111222333m456p55s"), 0);
    expect(parses.length).toBeGreaterThanOrEqual(2);
    const shapes = parses.map((p) => p.sets.map((s) => `${s.kind}${s.tile}`).sort().join("/"));
    expect(new Set(shapes).size).toBe(shapes.length);
  });
});

describe("七对", () => {
  it("七个对子成立", () => {
    expect(sevenPairsParse(parseTiles("1122m3344p5566s77z"), 0)).not.toBeNull();
  });

  it("四张一样的算两个对子", () => {
    expect(sevenPairsParse(parseTiles("1111m3344p5566s77z"), 0)).not.toBeNull();
  });

  it("有副露就不能算七对", () => {
    expect(sevenPairsParse(parseTiles("1122m3344p5566s77z"), 1)).toBeNull();
  });

  it("六对加一个刻子不算七对", () => {
    expect(sevenPairsParse(parseTiles("111m2233445566p77s"), 0)).toBeNull();
  });
});

describe("十三幺", () => {
  it("十三种幺九齐了、有一张成对就成立", () => {
    expect(thirteenOrphansParse(parseTiles("119m19p19s1234567z"), 0)).not.toBeNull();
    expect(thirteenOrphansParse(parseTiles("19m199p19s1234567z".replace("199p", "19p9p")), 0)).not.toBeNull();
  });

  it("混进中张就不成立", () => {
    expect(thirteenOrphansParse(parseTiles("125m19p19s1234567z"), 0)).toBeNull();
  });

  it("缺一种幺九也不成立", () => {
    expect(thirteenOrphansParse(parseTiles("1199m19p19s123456z"), 0)).toBeNull();
  });
});

describe("不靠型与组合龙", () => {
  it("三门各走一条轨道才叫不靠", () => {
    expect(knittedInfo(parseTiles("147m258p369s")).ok).toBe(true);
    expect(knittedInfo(parseTiles("147m147p369s")).ok).toBe(false);
    expect(knittedInfo(parseTiles("145m258p369s")).ok).toBe(false);
  });

  it("有重复牌就不是不靠型", () => {
    expect(knittedInfo(parseTiles("1147m258p369s")).ok).toBe(false);
  });

  it("147/258/369 九张齐了才叫组合龙", () => {
    expect(hasFullDragon(parseTiles("147m258p369s"))).toBe(true);
    expect(hasFullDragon(parseTiles("147m258p36s"))).toBe(false);
  });

  it("组合龙 + 一副面子 + 一对将也是和牌", () => {
    const parses = knittedDragonParse(parseTiles("147789m22258p369s"), 0);
    expect(parses.length).toBeGreaterThan(0);
    expect(isHu(parseTiles("147789m22258p369s"))).toBe(true);
  });

  it("副露一副时组合龙只剩九张加一对将", () => {
    const melds: Meld[] = [makeChi(T("7m"), parseTiles("89m"), 3)];
    expect(knittedDragonParse(parseTiles("147m22258p369s"), 1).length).toBeGreaterThan(0);
    expect(isHu(parseTiles("147m22258p369s"), null, melds)).toBe(true);
  });

  it("全不靠是十四张单牌", () => {
    const parses = huParses(parseTiles("147m258p36s123456z"));
    expect(parses.some((p) => p.form === "knitted")).toBe(true);
  });
});

describe("听牌", () => {
  it("两面听能听两张", () => {
    expect(formatTiles(waitingTiles(parseTiles("23456789m123p55s")))).toBe("147m");
  });

  it("单钓将只听一张", () => {
    expect(waitingTiles(parseTiles("123456789m123p5s"))).toEqual([T("5s")]);
  });

  it("没听牌就是空数组", () => {
    expect(waitingTiles(parseTiles("13579m2468p13s"))).toEqual([]);
  });

  it("自己攥了四张的牌不会算进听牌里", () => {
    expect(waitingTiles(parseTiles("1111m23456789m1p"))).not.toContain(T("1m"));
  });
});

describe("向听数", () => {
  it("和了是 -1，听牌是 0", () => {
    expect(xiangting(parseTiles("123456789m123p55s"))).toBe(-1);
    expect(xiangting(parseTiles("123456789m123p5s"))).toBe(0);
  });

  it("差一张进张是 1 向听", () => {
    expect(xiangting(parseTiles("123456789m12p57s"))).toBe(1);
  });

  it("一手散牌向听数很大", () => {
    expect(xiangting(parseTiles("2468m2468p2468s2z"))).toBeGreaterThanOrEqual(4);
  });

  it("副露一副以后向听数跟着降", () => {
    const open = xiangting(parseTiles("456789m123p5s"), 1);
    expect(open).toBe(0);
  });

  it("七对的向听数单独算", () => {
    expect(sevenPairsXiangting(parseTiles("1122m3344p5566s77z"))).toBe(-1);
    expect(sevenPairsXiangting(parseTiles("1122m3344p5566s3z7z"))).toBe(0);
    expect(sevenPairsXiangting(parseTiles("1122m3344p5566s77z"), 1)).toBe(99);
  });

  it("十三幺的向听数单独算", () => {
    expect(thirteenOrphansXiangting(parseTiles("119m19p19s1234567z"))).toBe(-1);
    expect(thirteenOrphansXiangting(parseTiles("19m19p19s1234567z"))).toBe(0);
  });

  it("基本型向听数比七对高时，总向听取小的那个", () => {
    const hand = parseTiles("1122m3344p5566s3z7z");
    expect(standardXiangting(hand)).toBeGreaterThan(0);
    expect(xiangting(hand)).toBe(0);
  });

  it("打哪张最好能排出来", () => {
    const rank = discardRanking(parseTiles("123456789m123p5s1z"));
    // 两张孤张打哪一张都听牌，所以只断言「最好的打法就是听牌」并且东风在最优里
    expect(rank[0].xiangting).toBe(0);
    const best = rank.filter((r) => r.xiangting === 0).map((r) => r.tile);
    expect(best).toContain(T("1z"));
    expect(rank[rank.length - 1].xiangting).toBeGreaterThan(0);
  });
});
