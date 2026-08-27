import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  AI_TIER_LABELS,
  TIER_PROFILES,
  chooseClaim,
  chooseDiscard,
  chooseSelf,
  dangerOf,
  fanRoute,
  floorPlan,
  playHandToEnd,
  simulateTierAverage,
  threatOf,
  tierOrder
} from "./ai";
import { claimOptions, createTable, fullHand, selfOptions, type TableOptions } from "./table";
import { makePon } from "./melds";
import { parseTiles } from "./tiles";

const T = (s: string): number => parseTiles(s)[0];

const SEATS: TableOptions["seats"] = [
  { name: "朵朵", tier: "pro" },
  { name: "糯糯", tier: "normal" },
  { name: "星星", tier: "hell" },
  { name: "云云", tier: "rookie" }
];

describe("四档棋友", () => {
  it("四档的中文名都在", () => {
    expect(tierOrder()).toEqual(["rookie", "normal", "pro", "hell"]);
    expect(AI_TIER_LABELS.hell).toBe("地狱");
  });

  it("菜鸟不吃不碰不杠，地狱三样都会", () => {
    expect(TIER_PROFILES.rookie.canChi).toBe(false);
    expect(TIER_PROFILES.rookie.canPon).toBe(false);
    expect(TIER_PROFILES.hell.canChi).toBe(true);
    expect(TIER_PROFILES.hell.folds).toBe(true);
    expect(TIER_PROFILES.pro.folds).toBe(false);
  });

  it("防守权重一档比一档高", () => {
    expect(TIER_PROFILES.rookie.dangerWeight).toBe(0);
    expect(TIER_PROFILES.normal.dangerWeight).toBe(0);
    expect(TIER_PROFILES.pro.dangerWeight).toBeGreaterThan(0);
    expect(TIER_PROFILES.hell.dangerWeight).toBeGreaterThan(TIER_PROFILES.pro.dangerWeight);
  });
});

describe("打牌判断", () => {
  it("打出来的一定是手里有的牌", () => {
    const st = createTable({ seed: 31, seats: SEATS });
    for (let s = 0; s < 4; s++) {
      if (st.seats[s].drawn < 0) st.seats[s].drawn = st.seats[s].hand[0];
      const t = chooseDiscard(st, s, mulberry32(s + 1));
      expect(fullHand(st.seats[s])).toContain(t);
    }
  });

  it("普通档会把明显没用的孤张先扔掉", () => {
    const st = createTable({ seed: 31, seats: SEATS });
    st.seats[1].hand = parseTiles("123456789m123p");
    st.seats[1].drawn = T("5z");
    expect(chooseDiscard(st, 1, mulberry32(3))).toBe(T("5z"));
  });

  it("能自摸就自摸，不会继续摸下去", () => {
    const st = createTable({ seed: 4, floor: 1, seats: SEATS });
    st.seats[0].hand = parseTiles("123456789m123p5s");
    st.seats[0].drawn = T("5s");
    const pick = chooseSelf(st, 0, selfOptions(st, 0));
    expect(pick?.kind).toBe("tsumo");
  });

  it("现物比生牌安全", () => {
    const st = createTable({ seed: 12, seats: SEATS });
    st.seats[1].discards = parseTiles("5m");
    st.seats[2].discards = parseTiles("5m");
    st.seats[3].discards = parseTiles("5m");
    expect(dangerOf(st, 0, T("5m"))).toBe(0);
    expect(dangerOf(st, 0, T("4m"))).toBeGreaterThan(0);
  });

  it("副露越多的对手越危险", () => {
    const st = createTable({ seed: 12, seats: SEATS });
    const quiet = threatOf(st.seats[1]);
    st.seats[1].melds = [makePon(T("1z"), 0), makePon(T("2z"), 0)];
    expect(threatOf(st.seats[1])).toBeGreaterThan(quiet);
  });

  it("番路分认得出一色路线", () => {
    expect(fanRoute(parseTiles("123456789m1234m"), 0)).toBeGreaterThan(
      fanRoute(parseTiles("123m456p789s12z34z"), 0)
    );
  });

  it("八番路线规划能数出「够门槛的听牌张」", () => {
    const st = createTable({ seed: 4, floor: 8, seats: SEATS });
    st.seats[0].melds = [];
    const plan = floorPlan(st, 0, parseTiles("111234567899m1m".slice(0, 0) + "1112345678999m"));
    expect(plan.tiles).toBeGreaterThan(0);
    expect(plan.best).toBeGreaterThanOrEqual(8);
  });
});

describe("鸣牌判断", () => {
  it("菜鸟基本不碰", () => {
    const st = createTable({ seed: 12, floor: 1, seats: SEATS });
    st.seats[3].hand = parseTiles("55m123456789p11s");
    st.seats[3].drawn = -1;
    st.lastDiscard = T("5m");
    st.lastDiscardSeat = 0;
    st.phase = "claim";
    let pon = 0;
    for (let i = 0; i < 40; i++) {
      const pick = chooseClaim(st, 3, claimOptions(st, 3), mulberry32(i + 1));
      if (pick?.kind === "pon") pon++;
    }
    expect(pon).toBeLessThan(12);
  });

  it("高手会碰能降向听的牌", () => {
    const st = createTable({ seed: 12, floor: 1, seats: SEATS });
    st.seats[0].hand = parseTiles("55m123789p1146s1z");
    st.seats[0].drawn = -1;
    st.lastDiscard = T("5m");
    st.lastDiscardSeat = 1;
    st.phase = "claim";
    const pick = chooseClaim(st, 0, claimOptions(st, 0), mulberry32(5));
    expect(pick?.kind).toBe("pon");
  });

  it("能和就一定和，不会放过", () => {
    const st = createTable({ seed: 12, floor: 1, seats: SEATS });
    st.seats[0].hand = parseTiles("123456789m123p5s");
    st.seats[0].drawn = -1;
    st.lastDiscard = T("5s");
    st.lastDiscardSeat = 1;
    st.phase = "claim";
    const pick = chooseClaim(st, 0, claimOptions(st, 0), mulberry32(5));
    expect(pick?.kind).toBe("ron");
  });
});

describe("四档强度单调（固定 seed 跑 100 局）", () => {
  const games = 100;
  const rookie = simulateTierAverage("rookie", games);
  const normal = simulateTierAverage("normal", games);
  const pro = simulateTierAverage("pro", games);
  const hell = simulateTierAverage("hell", games);

  it("地狱 > 高手 > 普通 > 菜鸟", () => {
    expect(hell).toBeGreaterThan(pro);
    expect(pro).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(rookie);
  });

  it("菜鸟明显吃亏，地狱明显占便宜", () => {
    expect(rookie).toBeLessThan(0);
    expect(hell).toBeGreaterThan(0);
  });

  it("同一个 seed 跑两遍结果一模一样", () => {
    expect(simulateTierAverage("pro", 20)).toBe(simulateTierAverage("pro", 20));
  });
});

describe("整盘不会卡死", () => {
  it("四档混坐 20 盘都能正常收场", () => {
    for (let g = 0; g < 20; g++) {
      const seed = 800 + g * 13;
      const st = createTable({
        seed,
        dealer: g % 4,
        floor: g % 2 === 0 ? 8 : 1,
        seats: [
          { name: "朵朵", tier: "rookie" },
          { name: "糯糯", tier: "normal" },
          { name: "星星", tier: "pro" },
          { name: "云云", tier: "hell" }
        ]
      });
      playHandToEnd(st, mulberry32(seed));
      expect(st.phase).toBe("over");
      expect(["hu", "draw", "falseHu"]).toContain(st.result?.kind);
    }
  });
});
