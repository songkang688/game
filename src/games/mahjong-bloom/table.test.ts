import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  applyClaim,
  applyFalseHu,
  applyHu,
  applySelfKan,
  claimOptions,
  createTable,
  discard,
  finishDraw,
  fullHand,
  nextTurn,
  ranking,
  resolveClaims,
  selfOptions,
  wallCount,
  windName,
  type TableOptions
} from "./table";
import { playHandToEnd } from "./ai";
import { makePon } from "./melds";
import { parseTiles } from "./tiles";
import { shuffleWall } from "./wall";

const T = (s: string): number => parseTiles(s)[0];

const SEATS: TableOptions["seats"] = [
  { name: "鸭梨", human: "duo" },
  { name: "糯糯", tier: "normal" },
  { name: "康康", tier: "normal" },
  { name: "云云", tier: "normal" }
];

describe("开桌", () => {
  it("庄家 13 张手牌 + 1 张刚摸的，其余三家 13 张", () => {
    const st = createTable({ seed: 11, seats: SEATS });
    expect(st.seats[0].hand.length).toBe(13);
    expect(st.seats[0].drawn).toBeGreaterThan(0);
    expect(fullHand(st.seats[0]).length).toBe(14);
    for (const s of st.seats.slice(1)) {
      expect(s.hand.length).toBe(13);
      expect(s.drawn).toBe(-1);
    }
  });

  it("门风按庄家算：庄家是东，下家是南", () => {
    const st = createTable({ seed: 11, dealer: 2, seats: SEATS });
    expect(st.seats[2].wind).toBe(1);
    expect(st.seats[3].wind).toBe(2);
    expect(windName(st.seats[3].wind)).toBe("南");
  });

  it("同一个 seed 开出同一桌", () => {
    const a = createTable({ seed: 77, seats: SEATS });
    const b = createTable({ seed: 77, seats: SEATS });
    expect(a.seats.map((s) => s.hand)).toEqual(b.seats.map((s) => s.hand));
  });

  it("可以直接指定牌墙与手牌（关卡残局用）", () => {
    const hands = [parseTiles("123456789m123p5s"), parseTiles("19m19p19s1234z"), parseTiles("19m19p19s1234z"), parseTiles("19m19p19s1234z")];
    const st = createTable({ seed: 1, seats: SEATS, wall: parseTiles("5s"), hands });
    expect(st.seats[0].hand.length).toBe(13);
    expect(wallCount(st)).toBe(1);
  });
});

describe("摸打", () => {
  it("打出去的牌进牌河，轮次加一", () => {
    const st = createTable({ seed: 5, seats: SEATS });
    const tile = st.seats[0].drawn;
    expect(discard(st, 0, tile)).toBe(true);
    expect(st.seats[0].discards).toEqual([tile]);
    expect(st.lastDiscard).toBe(tile);
    expect(st.phase).toBe("claim");
    expect(st.turnCount).toBe(1);
  });

  it("打手里的牌时刚摸的那张会顺位进手", () => {
    const st = createTable({ seed: 6, seats: SEATS });
    const drawn = st.seats[0].drawn;
    const inHand = st.seats[0].hand[0];
    discard(st, 0, inHand);
    expect(st.seats[0].drawn).toBe(-1);
    expect(st.seats[0].hand).toContain(drawn);
    expect(st.seats[0].hand.length).toBe(13);
  });

  it("手里没有的牌打不出去", () => {
    const st = createTable({ seed: 6, seats: SEATS });
    const missing = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((t) => !fullHand(st.seats[0]).includes(t));
    expect(discard(st, 0, missing ?? 1)).toBe(false);
  });

  it("轮到下家会自动摸牌", () => {
    const st = createTable({ seed: 6, seats: SEATS });
    discard(st, 0, st.seats[0].drawn);
    nextTurn(st);
    expect(st.turn).toBe(1);
    expect(st.seats[1].drawn).toBeGreaterThan(0);
    expect(st.phase).toBe("discard");
  });

  it("牌墙摸空就荒庄，谁都不丢分", () => {
    const st = createTable({ seed: 6, seats: SEATS });
    st.wall = [];
    nextTurn(st);
    expect(st.phase).toBe("over");
    expect(st.result?.kind).toBe("draw");
    expect(st.result?.delta).toEqual([0, 0, 0, 0]);
  });
});

describe("鸣牌", () => {
  const puzzle = (): ReturnType<typeof createTable> =>
    createTable({
      seed: 1,
      floor: 1,
      seats: SEATS,
      wall: shuffleWall(3).filter((t) => t < 40).slice(0, 40),
      hands: [
        parseTiles("11223344556677m"),
        parseTiles("1112345678999p"),
        parseTiles("11223344556s123z"),
        parseTiles("1234567899m11z")
      ]
    });

  it("只有上家打的牌能吃", () => {
    const st = puzzle();
    st.seats[0].hand = parseTiles("456789m123p55s");
    st.seats[0].drawn = -1;
    st.lastDiscard = T("3m");
    st.lastDiscardSeat = 3;
    st.phase = "claim";
    expect(claimOptions(st, 0).some((o) => o.kind === "chi")).toBe(true);
    st.lastDiscardSeat = 1;
    expect(claimOptions(st, 0).some((o) => o.kind === "chi")).toBe(false);
  });

  it("碰完手牌少两张、副露多一副", () => {
    const st = puzzle();
    st.seats[0].hand = parseTiles("55m123456789p11s");
    st.seats[0].drawn = -1;
    st.lastDiscard = T("5m");
    st.lastDiscardSeat = 2;
    st.phase = "claim";
    const pon = claimOptions(st, 0).find((o) => o.kind === "pon");
    expect(pon).toBeTruthy();
    expect(applyClaim(st, 0, pon!)).toBe(true);
    expect(st.seats[0].melds.length).toBe(1);
    expect(st.seats[0].hand.length).toBe(11);
    expect(st.turn).toBe(0);
    expect(st.phase).toBe("discard");
  });

  it("被鸣走的牌从牌河里拿掉", () => {
    const st = puzzle();
    st.seats[0].hand = parseTiles("55m123456789p11s");
    st.seats[0].drawn = -1;
    st.seats[2].discards.push(T("5m"));
    st.lastDiscard = T("5m");
    st.lastDiscardSeat = 2;
    st.phase = "claim";
    applyClaim(st, 0, { kind: "pon", tile: T("5m") });
    expect(st.seats[2].discards).not.toContain(T("5m"));
  });

  it("明杠之后从牌尾补一张，进入杠上开花状态", () => {
    const st = puzzle();
    st.seats[0].hand = parseTiles("555m12345678p11s");
    st.seats[0].drawn = -1;
    st.lastDiscard = T("5m");
    st.lastDiscardSeat = 2;
    st.phase = "claim";
    const kan = claimOptions(st, 0).find((o) => o.kind === "kan");
    expect(kan).toBeTruthy();
    applyClaim(st, 0, kan!);
    expect(st.afterKan).toBe(true);
    expect(st.seats[0].drawn).toBeGreaterThan(0);
  });

  it("加杠会开一个抢杠窗口", () => {
    const st = puzzle();
    st.seats[0].melds = [makePon(T("5m"), 1)];
    st.seats[0].hand = parseTiles("123456789p11s");
    st.seats[0].drawn = T("5m");
    const opt = selfOptions(st, 0).find((o) => o.kind === "kakan");
    expect(opt).toBeTruthy();
    applySelfKan(st, 0, opt!);
    expect(st.robbing).toEqual({ seat: 0, tile: T("5m") });
    expect(st.phase).toBe("claim");
  });

  it("四张一样能暗杠", () => {
    const st = puzzle();
    st.seats[0].hand = parseTiles("5555m123456789p");
    st.seats[0].drawn = T("1s");
    const opt = selfOptions(st, 0).find((o) => o.kind === "ankan");
    expect(opt).toBeTruthy();
    applySelfKan(st, 0, opt!);
    expect(st.seats[0].melds[0].kind).toBe("ankan");
  });
});

describe("截和与结算", () => {
  it("多家同时报和，按下家 > 对家 > 上家只判一家", () => {
    const st = createTable({ seed: 9, seats: SEATS });
    st.lastDiscardSeat = 0;
    const pick = resolveClaims(st, [
      { seat: 2, opt: { kind: "ron", tile: 1 } },
      { seat: 1, opt: { kind: "ron", tile: 1 } }
    ]);
    expect(pick?.seat).toBe(1);
  });

  it("和牌优先于碰，碰优先于吃", () => {
    const st = createTable({ seed: 9, seats: SEATS });
    st.lastDiscardSeat = 0;
    expect(
      resolveClaims(st, [
        { seat: 1, opt: { kind: "chi", tile: 1, pair: [2, 3] } },
        { seat: 2, opt: { kind: "pon", tile: 1 } }
      ])?.seat
    ).toBe(2);
    expect(
      resolveClaims(st, [
        { seat: 2, opt: { kind: "pon", tile: 1 } },
        { seat: 3, opt: { kind: "ron", tile: 1 } }
      ])?.seat
    ).toBe(3);
  });

  it("自摸和牌四家分数加起来还是 0", () => {
    const st = createTable({
      seed: 4,
      floor: 1,
      seats: SEATS,
      wall: parseTiles("1234s"),
      hands: [
        parseTiles("123456789m123p5s"),
        parseTiles("19m19p19s1234z"),
        parseTiles("19m19p19s1234z"),
        parseTiles("19m19p19s1234z")
      ]
    });
    st.seats[0].hand = parseTiles("123456789m123p5s");
    st.seats[0].drawn = T("5s");
    const r = applyHu(st, 0, true);
    expect(r.kind).toBe("hu");
    expect(r.points).toBeGreaterThan(0);
    expect(r.delta.reduce((a, b) => a + b, 0)).toBe(r.flowerPoints);
    expect(st.phase).toBe("over");
  });

  it("番数不够就是错和，赔每家 10 花分，文案只鼓励", () => {
    const st = createTable({ seed: 4, seats: SEATS });
    const r = applyFalseHu(st, 1);
    expect(r.kind).toBe("falseHu");
    expect(st.seats[1].score).toBe(-30);
    expect(r.line).toContain("下一局");
    expect(r.line).not.toContain("笨");
  });

  it("八番门槛没到就报不了和", () => {
    const st = createTable({
      seed: 4,
      floor: 88,
      seats: SEATS,
      wall: parseTiles("1234s"),
      hands: [
        parseTiles("123456789m123p5s"),
        parseTiles("19m19p19s1234z"),
        parseTiles("19m19p19s1234z"),
        parseTiles("19m19p19s1234z")
      ]
    });
    st.seats[0].hand = parseTiles("123456789m123p5s");
    st.seats[0].drawn = T("5s");
    expect(selfOptions(st, 0).some((o) => o.kind === "tsumo")).toBe(false);
    st.floor = 1;
    expect(selfOptions(st, 0).some((o) => o.kind === "tsumo")).toBe(true);
  });

  it("名次按花分从高到低排", () => {
    const st = createTable({ seed: 4, seats: SEATS });
    st.seats[0].score = 5;
    st.seats[2].score = 30;
    expect(ranking(st)[0]).toBe(2);
  });

  it("荒庄结果只说平局，不批评谁", () => {
    const st = createTable({ seed: 4, seats: SEATS });
    const r = finishDraw(st);
    expect(r.line).toContain("平局");
  });
});

describe("整盘能跑到底", () => {
  it("固定 seed 连跑 12 盘都能收场，分数守恒", () => {
    for (let g = 0; g < 12; g++) {
      const seed = 500 + g * 31;
      const st = createTable({
        seed,
        dealer: g % 4,
        floor: 8,
        seats: [
          { name: "鸭梨", tier: "pro" },
          { name: "糯糯", tier: "normal" },
          { name: "康康", tier: "hell" },
          { name: "云云", tier: "rookie" }
        ]
      });
      const scores = playHandToEnd(st, mulberry32(seed));
      expect(st.phase).toBe("over");
      expect(st.result).not.toBeNull();
      // 花分也是从别家收上来的，所以一桌永远加起来是 0
      expect(scores.reduce((a, b) => a + b, 0)).toBe(0);
    }
  });
});
