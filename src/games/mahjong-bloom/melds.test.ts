import { describe, expect, it } from "vitest";
import {
  chiOptions,
  isConcealedMeld,
  isKan,
  isOpenKan,
  isUpperOf,
  kanOptions,
  lowerSeat,
  makeChi,
  makeKan,
  makePon,
  meldLabel,
  meldTileCount,
  meldTriple,
  ponOk,
  upperSeat
} from "./melds";
import { parseTiles } from "./tiles";

const T = (s: string): number => parseTiles(s)[0];

describe("座次", () => {
  it("逆时针：上家是 seat-1，下家是 seat+1", () => {
    expect(upperSeat(0)).toBe(3);
    expect(lowerSeat(3)).toBe(0);
    expect(isUpperOf(1, 0)).toBe(true);
    expect(isUpperOf(1, 2)).toBe(false);
  });
});

describe("吃", () => {
  it("三种搭法都能找出来", () => {
    const opts = chiOptions(parseTiles("12456m"), T("3m"));
    expect(opts.length).toBe(3);
    expect(opts).toContainEqual(parseTiles("12m"));
    expect(opts).toContainEqual(parseTiles("24m"));
    expect(opts).toContainEqual(parseTiles("45m"));
  });

  it("只能吃上家打的牌", () => {
    const hand = parseTiles("45m");
    expect(chiOptions(hand, T("3m"), 0, 3).length).toBe(1);
    expect(chiOptions(hand, T("3m"), 0, 1).length).toBe(0);
    expect(chiOptions(hand, T("3m"), 0, 2).length).toBe(0);
  });

  it("字牌不能吃", () => {
    expect(chiOptions(parseTiles("1122z"), T("1z")).length).toBe(0);
  });

  it("顺子不能跨花色", () => {
    expect(chiOptions(parseTiles("4m5p"), T("3m")).length).toBe(0);
  });

  it("手里没搭子就吃不了", () => {
    expect(chiOptions(parseTiles("99m"), T("3m")).length).toBe(0);
  });
});

describe("碰", () => {
  it("手里两张一样就能碰，任何一家打的都行", () => {
    const hand = parseTiles("55m");
    expect(ponOk(hand, T("5m"), 0, 1)).toBe(true);
    expect(ponOk(hand, T("5m"), 0, 2)).toBe(true);
    expect(ponOk(hand, T("5m"), 0, 3)).toBe(true);
  });

  it("自己打的牌不能自己碰", () => {
    expect(ponOk(parseTiles("55m"), T("5m"), 0, 0)).toBe(false);
  });

  it("只有一张碰不了", () => {
    expect(ponOk(parseTiles("5m"), T("5m"), 0, 1)).toBe(false);
  });
});

describe("杠", () => {
  it("别人打出第 4 张可以明杠", () => {
    const opts = kanOptions(parseTiles("555m"), [], T("5m"), 0, 1);
    expect(opts).toEqual([{ kind: "minkan", tile: T("5m") }]);
  });

  it("手里四张一样是暗杠", () => {
    const opts = kanOptions(parseTiles("5555m"), []);
    expect(opts).toEqual([{ kind: "ankan", tile: T("5m") }]);
  });

  it("碰过之后摸到第 4 张是加杠", () => {
    const melds = [makePon(T("5m"), 1)];
    const opts = kanOptions(parseTiles("5m123p"), melds);
    expect(opts).toEqual([{ kind: "kakan", tile: T("5m") }]);
  });

  it("只有三张时不能暗杠", () => {
    expect(kanOptions(parseTiles("555m"), []).length).toBe(0);
  });

  it("自己打出去的牌不能自己明杠", () => {
    expect(kanOptions(parseTiles("555m"), [], T("5m"), 0, 0).length).toBe(0);
  });
});

describe("副露结构", () => {
  it("吃出来的顺子按升序摆", () => {
    const m = makeChi(T("3m"), parseTiles("45m"), 3);
    expect(m.tiles).toEqual(parseTiles("345m"));
    expect(m.claimed).toBe(T("3m"));
    expect(meldLabel(m)).toBe("吃");
  });

  it("三种杠都算杠，只有暗杠算暗", () => {
    const ankan = makeKan(T("1m"), "ankan", 0);
    const minkan = makeKan(T("1m"), "minkan", 2);
    const kakan = makeKan(T("1m"), "kakan", 0);
    expect(isKan(ankan) && isKan(minkan) && isKan(kakan)).toBe(true);
    expect(isConcealedMeld(ankan)).toBe(true);
    expect(isConcealedMeld(minkan)).toBe(false);
    expect(isOpenKan(kakan)).toBe(true);
    expect(isOpenKan(ankan)).toBe(false);
    expect(meldLabel(ankan)).toBe("暗杠");
    expect(meldLabel(kakan)).toBe("加杠");
  });

  it("算番时杠折成三张的刻子", () => {
    expect(meldTriple(makeKan(T("1m"), "minkan", 1))).toEqual([1, 1, 1]);
    expect(meldTriple(makePon(T("1m"), 1))).toEqual([1, 1, 1]);
  });

  it("每副占三张手牌位", () => {
    expect(meldTileCount([makePon(T("1m"), 1), makeChi(T("3m"), parseTiles("45m"), 3)])).toBe(6);
  });
});
