import { describe, expect, it } from "vitest";
import { GROUP_TILES, START_CASH } from "./board";
import { deedsOf, fullSetActive } from "./rent";
import { createState, grantTile, type SeatSpec } from "./economy";
import {
  AI_TIERS,
  AI_TIER_LABELS,
  bidLimit,
  buildPlan,
  financePlan,
  headlessMatch,
  jailChoice,
  makePolicy,
  rescueOffer,
  tierReserve,
  tierSeries,
  tierTradeCap,
  valueOf,
  wantBuy,
  type AiTier
} from "./ai";

function table(n: number, cash = START_CASH) {
  const seats: SeatSpec[] = [
    { name: "朵朵", emoji: "🌸", cash },
    { name: "星星", emoji: "⭐", cash },
    { name: "糯糯", emoji: "🍡", cash },
    { name: "云云", emoji: "☁️", cash }
  ].slice(0, n);
  return createState(seats, cash);
}

/** 一档打一档，两个座位都试一遍，返回前一档的总胜场（满分 2×games） */
function duel(a: AiTier, b: AiTier, games = 20): number {
  const first = tierSeries([a, b], games)[0];
  const second = tierSeries([b, a], games)[1];
  return first + second;
}

describe("四档 AI", () => {
  it("四档齐全，每一档都有中文名", () => {
    expect(AI_TIERS).toEqual(["rookie", "normal", "pro", "hell"]);
    for (const t of AI_TIERS) expect(AI_TIER_LABELS[t].length).toBeGreaterThan(1);
    expect(tierReserve("rookie")).toBe(0);
    expect(tierReserve("hell")).toBeGreaterThan(tierReserve("normal"));
  });

  it("菜鸟见地就买，钱够就点头；高手会先留周转金", () => {
    const s = table(2, 200);
    expect(wantBuy(s, 0, 1, "rookie")).toBe(true);
    expect(wantBuy(s, 0, 39, "rookie")).toBe(false);
    const tight = table(2, 210);
    expect(wantBuy(tight, 0, 5, "pro")).toBe(false);
    const rich = table(2, 900);
    expect(wantBuy(rich, 0, 5, "pro")).toBe(true);
  });

  it("普通及以上会给「能补齐色组」的地加价，菜鸟只认标价", () => {
    const s = table(2);
    const tiles = GROUP_TILES.soda;
    grantTile(s, tiles[0], 0);
    grantTile(s, tiles[1], 0);
    expect(valueOf(s, 0, tiles[2], "rookie")).toBe(120);
    expect(valueOf(s, 0, tiles[2], "normal")).toBeGreaterThan(120 * 2);
    expect(valueOf(s, 0, tiles[2], "hell")).toBeGreaterThan(valueOf(s, 0, tiles[2], "normal"));
  });

  it("高手 / 地狱会给「拦住对手垄断」的地额外加价", () => {
    const s = table(2);
    const tiles = GROUP_TILES.sugar;
    grantTile(s, tiles[0], 1);
    grantTile(s, tiles[1], 1);
    expect(valueOf(s, 0, tiles[2], "hell")).toBeGreaterThan(valueOf(s, 0, tiles[2], "normal"));
    expect(bidLimit(s, 0, tiles[2], "hell")).toBeGreaterThan(bidLimit(s, 0, tiles[2], "normal"));
  });

  it("菜鸟不盖房；普通以上垄断后会一栋一栋平均地盖", () => {
    const s = table(2, 3000);
    const tiles = GROUP_TILES.cotton;
    for (const t of tiles) grantTile(s, t, 0);
    expect(fullSetActive(s, 0, "cotton")).toBe(true);
    expect(buildPlan(s, 0, "rookie")).toEqual([]);
    const plan = buildPlan(s, 0, "normal");
    expect(plan.length).toBeGreaterThan(1);
    expect(plan[0]).toBe(tiles[0]);
    expect(plan[1]).toBe(tiles[1]);
  });

  it("高手 / 地狱会抵押零散地皮换钱去盖房，菜鸟和普通不会", () => {
    const s = table(2, 60);
    for (const t of GROUP_TILES.cotton) grantTile(s, t, 0);
    grantTile(s, 5, 0);
    grantTile(s, 15, 0);
    expect(financePlan(s, 0, "normal")).toEqual([]);
    const plan = financePlan(s, 0, "pro");
    expect(plan.length).toBeGreaterThan(0);
    // 只抵押不在垄断组里的零散地
    for (const pos of plan) expect(GROUP_TILES.cotton).not.toContain(pos);
  });

  it("小黑屋里手上有出门卡就先用卡", () => {
    const s = table(2);
    s.players[0].outCards = 1;
    for (const t of AI_TIERS) expect(jailChoice(s, 0, t)).toBe("card");
  });

  it("换地有让步上限，地狱最多加到估值的 1.5 倍，绝不无限抬价", () => {
    expect(tierTradeCap("hell")).toBe(1.5);
    expect(tierTradeCap("pro")).toBeLessThan(tierTradeCap("hell"));
    const s = table(2, 5000);
    const offer = rescueOffer(s, 0, 39, "hell");
    expect(offer).toBeGreaterThan(0);
    expect(offer).toBeLessThanOrEqual(Math.round(valueOf(s, 0, 39, "hell") * 1.5));
    expect(rescueOffer(s, 0, 39, "normal")).toBe(0);
  });

  it("策略对象七件事一件不少", () => {
    const p = makePolicy("pro");
    for (const key of [
      "wantBuy",
      "bidLimit",
      "buildPlan",
      "jailChoice",
      "rescueOffer",
      "redeemOnTake",
      "redeemPlan",
      "financePlan"
    ]) {
      expect(typeof (p as unknown as Record<string, unknown>)[key]).toBe("function");
    }
  });
});

describe("四档强度（固定 seed，可复现）", () => {
  it("地狱对菜鸟 20 局，胜率显著高于五五开", () => {
    const wins = tierSeries(["hell", "rookie"], 20)[0];
    expect(wins).toBeGreaterThanOrEqual(13);
    // 换座位再打 20 局，结论不变
    expect(tierSeries(["rookie", "hell"], 20)[1]).toBeGreaterThanOrEqual(13);
  });

  it("相邻档位两两对打，强的那一档都占上风", () => {
    expect(duel("normal", "rookie")).toBeGreaterThan(20);
    expect(duel("pro", "normal")).toBeGreaterThan(20);
    expect(duel("hell", "pro")).toBeGreaterThan(20);
  });

  it("跨档更悬殊：地狱对菜鸟赢得比普通对菜鸟多", () => {
    expect(duel("hell", "rookie")).toBeGreaterThan(duel("normal", "rookie"));
  });

  it("同一个 seed 跑两次，结果一模一样", () => {
    const a = headlessMatch({ seed: 12345, tiers: ["pro", "normal", "rookie"] });
    const b = headlessMatch({ seed: 12345, tiers: ["pro", "normal", "rookie"] });
    expect(a.winner).toBe(b.winner);
    expect(a.rounds).toBe(b.rounds);
    expect(a.netWorths).toEqual(b.netWorths);
  });

  it("一整局打完总有结论，而且不会拖过 80 回合", () => {
    for (let i = 0; i < 8; i++) {
      const r = headlessMatch({ seed: 900 + i * 13, tiers: ["hell", "pro", "normal", "rookie"] });
      expect(r.winner).toBeGreaterThanOrEqual(0);
      expect(r.rounds).toBeLessThanOrEqual(81);
      expect(["settle", "bankrupt"]).toContain(r.reason);
    }
  });

  it("AI 真的会去买地、去盖房，不是站着不动", () => {
    let houses = 0;
    for (let i = 0; i < 6; i++) {
      const r = headlessMatch({ seed: 500 + i * 71, tiers: ["hell", "normal"] });
      const owned = r.state.tiles.filter((t) => t.owner >= 0).length;
      expect(owned).toBeGreaterThan(10);
      expect(deedsOf(r.state, 0).length + deedsOf(r.state, 1).length).toBe(owned);
      houses += r.state.tiles.reduce((s, t) => s + t.houses, 0);
    }
    // 破产收场的那几局房子会被拆光归银行，所以按多局合计来看
    expect(houses).toBeGreaterThan(0);
  });
});
