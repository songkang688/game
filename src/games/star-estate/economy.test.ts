import { describe, expect, it } from "vitest";
import { GO_SALARY, GROUP_TILES, JAIL_TILE, START_CASH, mortgageValue, transferFee, unmortgageCost } from "./board";
import {
  BANK,
  liquidCeiling,
  fullSetActive,
  moveBy,
  netWorth,
  ownsColorSet,
  passedGo,
  rankByNetWorth,
  rentOf,
  type EstateState
} from "./rent";
import {
  FULL_RULES,
  advanceTurn,
  applyCard,
  buildHouse,
  buyTile,
  canBuildEven,
  canMortgage,
  canSellEven,
  counterClockwiseOrder,
  createState,
  declareBankrupt,
  forceSettle,
  grantTile,
  jailStep,
  mortgage,
  passedGoSalary,
  payDebt,
  playTurn,
  runMatch,
  sellHouse,
  sendToJail,
  tryRaise,
  unmortgage,
  type Policy,
  type TurnContext
} from "./economy";
import { makeDeck, type EstateCard } from "./cards";
import { mulberry32 } from "../level99";

function seats(n: number, cash = START_CASH): EstateState {
  const names = ["鸭梨", "康康", "糯糯", "云云"];
  const emoji = ["🍐", "👓", "🍡", "☁️"];
  return createState(
    Array.from({ length: n }, (_, i) => ({ name: names[i], emoji: emoji[i], cash })),
    cash
  );
}

/** 一个什么都不做的假策略，测试里想要哪一支分支就覆盖哪一支 */
function dummyPolicy(over: Partial<Policy> = {}): Policy {
  return {
    wantBuy: () => false,
    bidLimit: () => 0,
    buildPlan: () => [],
    jailChoice: () => "roll",
    rescueOffer: () => 0,
    redeemOnTake: () => false,
    redeemPlan: () => [],
    financePlan: () => [],
    ...over
  };
}

function ctxFor(policy: Policy, seed = 7, rules = FULL_RULES, scripted?: Array<[number, number]>): TurnContext {
  const rand = mulberry32(seed);
  return {
    rand,
    policyOf: () => policy,
    decks: { chance: makeDeck("chance", rand), fate: makeDeck("fate", rand) },
    rules,
    scriptedDice: scripted,
    diceCursor: { i: 0 }
  };
}

// ---------------------------------------------------------------------------

describe("走棋与过出发", () => {
  it("moveBy 绕环线，负数也不出错", () => {
    expect(moveBy(38, 4)).toBe(2);
    expect(moveBy(0, 0)).toBe(0);
    expect(moveBy(3, -5)).toBe(38);
  });

  it("经过出发花园要发 200，正好停在出发花园一样发", () => {
    expect(passedGo(36, 2)).toBe(true);
    expect(passedGo(36, 0)).toBe(true);
    expect(passedGo(3, 9)).toBe(false);
    expect(passedGo(7, 7)).toBe(false);

    const s = seats(2, 100);
    expect(passedGoSalary(s, 0, 36, 0, 4)).toBe(GO_SALARY);
    expect(s.players[0].cash).toBe(100 + GO_SALARY);
    // 后退卡不算经过出发
    expect(passedGoSalary(s, 0, 2, 38, -4)).toBe(0);
    expect(s.players[0].cash).toBe(100 + GO_SALARY);
  });
});

describe("小黑屋", () => {
  it("连着三次同点直接进小黑屋，不算经过出发", () => {
    const s = seats(2);
    const ctx = ctxFor(dummyPolicy(), 3, FULL_RULES, [
      [3, 3],
      [4, 4],
      [5, 5],
      [1, 2]
    ]);
    playTurn(s, 0, ctx);
    expect(s.players[0].inJail).toBe(true);
    expect(s.players[0].pos).toBe(JAIL_TILE);
    expect(s.players[0].cash).toBe(START_CASH);
  });

  it("三种出来的方式：交罚款、用出门卡、掷出同点", () => {
    const a = seats(1);
    sendToJail(a, 0);
    const paid = jailStep(a, 0, "pay", [2, 5]);
    expect(paid.freed).toBe(true);
    expect(paid.how).toBe("pay");
    expect(a.players[0].cash).toBe(START_CASH - 50);
    expect(paid.steps).toBe(7);

    const b = seats(1);
    sendToJail(b, 0);
    b.players[0].outCards = 1;
    const card = jailStep(b, 0, "card", [2, 5]);
    expect(card.freed).toBe(true);
    expect(card.how).toBe("card");
    expect(b.players[0].outCards).toBe(0);
    expect(b.players[0].cash).toBe(START_CASH);

    const c = seats(1);
    sendToJail(c, 0);
    const rolled = jailStep(c, 0, "roll", [4, 4]);
    expect(rolled.freed).toBe(true);
    expect(rolled.how).toBe("roll");
    expect(rolled.steps).toBe(8);
  });

  it("熬到第三个回合必须交 50 并按点数走", () => {
    const s = seats(1);
    sendToJail(s, 0);
    expect(jailStep(s, 0, "roll", [1, 2]).freed).toBe(false);
    expect(jailStep(s, 0, "roll", [2, 3]).freed).toBe(false);
    const forced = jailStep(s, 0, "roll", [1, 5]);
    expect(forced.freed).toBe(true);
    expect(forced.how).toBe("forced");
    expect(forced.paid).toBe(50);
    expect(forced.steps).toBe(6);
    expect(s.players[0].cash).toBe(START_CASH - 50);
  });
});

describe("租金与垄断", () => {
  it("垄断整组且都没抵押时，空地租金翻倍", () => {
    const s = seats(2);
    const tiles = GROUP_TILES.cotton;
    grantTile(s, tiles[0], 0);
    expect(rentOf(s, tiles[0])).toBe(2);
    grantTile(s, tiles[1], 0);
    expect(ownsColorSet(s, 0, "cotton")).toBe(true);
    expect(fullSetActive(s, 0, "cotton")).toBe(true);
    expect(rentOf(s, tiles[0])).toBe(4);
  });

  it("整组里只要有一块抵押了，翻倍就没了；抵押的那一块一分不收", () => {
    const s = seats(2);
    const tiles = GROUP_TILES.cotton;
    for (const t of tiles) grantTile(s, t, 0);
    mortgage(s, tiles[1]);
    expect(fullSetActive(s, 0, "cotton")).toBe(false);
    expect(rentOf(s, tiles[0])).toBe(2);
    expect(rentOf(s, tiles[1])).toBe(0);
  });

  it("车站按数量收租，设施按点数收租", () => {
    const s = seats(2);
    grantTile(s, 5, 0);
    expect(rentOf(s, 5)).toBe(25);
    grantTile(s, 15, 0);
    grantTile(s, 25, 0);
    expect(rentOf(s, 5)).toBe(100);
    grantTile(s, 12, 0);
    expect(rentOf(s, 12, 8)).toBe(32);
    grantTile(s, 28, 0);
    expect(rentOf(s, 12, 8)).toBe(80);
  });

  it("自己的地不收自己的租，破产的人也收不到租", () => {
    const s = seats(2);
    grantTile(s, 1, 0);
    expect(rentOf(s, 1)).toBe(2);
    s.players[0].bankrupt = true;
    expect(rentOf(s, 1)).toBe(0);
  });
});

describe("平均建屋", () => {
  it("必须垄断才能开工，而且只能盖在房子最少的那一块", () => {
    const s = seats(2);
    const tiles = GROUP_TILES.soda;
    grantTile(s, tiles[0], 0);
    expect(canBuildEven(s, tiles[0])).toBe(false);
    for (const t of tiles) grantTile(s, t, 0);
    expect(canBuildEven(s, tiles[0])).toBe(true);
    expect(buildHouse(s, tiles[0])).toBe(true);
    // 第一块已经 1 栋，再盖它就会差到 2 栋
    expect(canBuildEven(s, tiles[0])).toBe(false);
    expect(buildHouse(s, tiles[0])).toBe(false);
    expect(canBuildEven(s, tiles[1])).toBe(true);
  });

  it("任意两块永远差不超过 1 栋，能一路盖到大屋", () => {
    const s = seats(2, 9000);
    const tiles = GROUP_TILES.cotton;
    for (const t of tiles) grantTile(s, t, 0);
    for (let i = 0; i < 10; i++) {
      const target = tiles.find((t) => canBuildEven(s, t));
      if (target === undefined) break;
      buildHouse(s, target);
      const hs = tiles.map((t) => s.tiles[t].houses);
      expect(Math.max(...hs) - Math.min(...hs)).toBeLessThanOrEqual(1);
    }
    expect(tiles.every((t) => s.tiles[t].houses === 5)).toBe(true);
  });

  it("拆房也要平均：只能从房子最多的那一块拆，退回一半", () => {
    const s = seats(2, 9000);
    const tiles = GROUP_TILES.cotton;
    for (const t of tiles) grantTile(s, t, 0);
    buildHouse(s, tiles[0]);
    expect(canSellEven(s, tiles[1])).toBe(false);
    expect(canSellEven(s, tiles[0])).toBe(true);
    const before = s.players[0].cash;
    expect(sellHouse(s, tiles[0])).toBe(25);
    expect(s.players[0].cash).toBe(before + 25);
  });
});

describe("抵押与赎回", () => {
  it("整条街上还有房子就一块都不许抵押", () => {
    const s = seats(2, 5000);
    const tiles = GROUP_TILES.cotton;
    for (const t of tiles) grantTile(s, t, 0);
    buildHouse(s, tiles[0]);
    expect(canMortgage(s, tiles[1])).toBe(false);
    expect(mortgage(s, tiles[1])).toBe(0);
    sellHouse(s, tiles[0]);
    expect(canMortgage(s, tiles[1])).toBe(true);
    expect(mortgage(s, tiles[1])).toBe(30);
  });

  it("赎回价是抵押价的 110%，钱不够就赎不了", () => {
    const s = seats(2, 0);
    grantTile(s, 39, 0);
    expect(mortgage(s, 39)).toBe(200);
    expect(s.players[0].cash).toBe(200);
    expect(unmortgageCost(39)).toBe(220);
    expect(unmortgage(s, 39)).toBe(false);
    s.players[0].cash = 220;
    expect(unmortgage(s, 39)).toBe(true);
    expect(s.players[0].cash).toBe(0);
    expect(s.tiles[39].mortgaged).toBe(false);
  });
});

describe("净资产", () => {
  it("现金 + 没抵押地全价 + 抵押地半价 + 建筑半价", () => {
    const s = seats(2, 1000);
    grantTile(s, 1, 0); // 60
    grantTile(s, 3, 0); // 60
    expect(netWorth(s, 0)).toBe(1000 + 120);
    buildHouse(s, 1); // 花 50，盖一栋
    expect(s.players[0].cash).toBe(950);
    expect(netWorth(s, 0)).toBe(950 + 120 + 25);
    sellHouse(s, 1);
    mortgage(s, 1);
    // 拆房退 25（现金 975）→ 抵押第 1 格再 +30（现金 1005）；净资产 = 1005 + 抵押地半价 30 + 全价 60
    expect(s.players[0].cash).toBe(1005);
    expect(netWorth(s, 0)).toBe(1095);
  });

  it("可变现上限 = 现金 + 拆光建筑 + 抵押全部地皮", () => {
    const s = seats(2, 100);
    grantTile(s, 39, 0);
    grantTile(s, 37, 0);
    expect(liquidCeiling(s, 0)).toBe(100 + 200 + 175);
  });
});

describe("清偿 tryRaise", () => {
  it("先拆建筑再抵押，凑够就立刻停手", () => {
    const s = seats(2, 0);
    const tiles = GROUP_TILES.cotton;
    for (const t of tiles) grantTile(s, t, 0);
    s.players[0].cash = 100;
    buildHouse(s, tiles[0]);
    buildHouse(s, tiles[1]);
    expect(s.players[0].cash).toBe(0);
    const r = tryRaise(s, 0, 40);
    expect(r.ok).toBe(true);
    expect(r.sold.length).toBe(2);
    expect(r.mortgaged.length).toBe(0);
    expect(s.players[0].cash).toBe(50);
  });

  it("建筑拆完还不够就抵押地皮，便宜的先抵押", () => {
    const s = seats(2, 0);
    grantTile(s, 1, 0);
    grantTile(s, 39, 0);
    const r = tryRaise(s, 0, 30);
    expect(r.ok).toBe(true);
    expect(r.mortgaged).toEqual([1]);
    expect(s.tiles[39].mortgaged).toBe(false);
  });

  it("最后一步是找人买地；对方开的价不合理就当没这回事", () => {
    const s = seats(2, 0);
    grantTile(s, 1, 0);
    s.players[1].cash = 500;
    const refused = tryRaise(s, 0, 400, () => null);
    expect(refused.ok).toBe(false);
    const s2 = seats(2, 0);
    grantTile(s2, 1, 0);
    s2.players[1].cash = 500;
    const dealt = tryRaise(s2, 0, 400, (pos) => ({ buyer: 1, price: pos === 1 ? 400 : 0 }));
    expect(dealt.ok).toBe(true);
    expect(dealt.traded).toEqual([{ pos: 1, to: 1, price: 400 }]);
    expect(s2.tiles[1].owner).toBe(1);
  });
});

describe("交易与小黑屋里的经营", () => {
  it("只能交易地皮、出门卡和现金：建筑一定先拆掉，绝不会连房子一起卖出去", () => {
    const s = seats(2, 0);
    const tiles = GROUP_TILES.cotton;
    for (const t of tiles) grantTile(s, t, 0);
    s.players[0].cash = 200;
    buildHouse(s, tiles[0]);
    buildHouse(s, tiles[1]);
    buildHouse(s, tiles[0]);
    s.players[0].cash = 0;
    s.players[1].cash = 2000;

    const offers: number[] = [];
    tryRaise(s, 0, 900, (pos) => {
      offers.push(pos);
      // 走到交易这一步时，手上一定一栋房子都不剩了
      expect(s.tiles[pos].houses).toBe(0);
      return { buyer: 1, price: 900 };
    });
    expect(offers.length).toBeGreaterThan(0);
    expect(tiles.every((t) => s.tiles[t].houses === 0)).toBe(true);
  });

  it("在小黑屋里照样能收租、能盖屋、能抵押", () => {
    const s = seats(2, 3000);
    const tiles = GROUP_TILES.cotton;
    for (const t of tiles) grantTile(s, t, 0);
    sendToJail(s, 0);
    expect(s.players[0].inJail).toBe(true);

    // 盖屋
    expect(buildHouse(s, tiles[0])).toBe(true);
    // 收租：对手停在他的地上照样要付
    s.players[1].pos = tiles[0];
    const before = s.players[0].cash;
    expect(payDebt(s, 1, 0, rentOf(s, tiles[0]))).toBe(true);
    expect(s.players[0].cash).toBeGreaterThan(before);
    // 抵押（先拆房）
    sellHouse(s, tiles[0]);
    expect(mortgage(s, tiles[0])).toBe(30);
    expect(s.players[0].inJail).toBe(true);
  });
});

describe("破产两条路径", () => {
  it("债主是玩家：现金、出门卡、地契整体转过去，抵押地要交 10% 手续费", () => {
    const s = seats(2, 0);
    s.players[0].cash = 40;
    s.players[0].outCards = 1;
    s.players[1].cash = 1000;
    grantTile(s, 39, 0);
    mortgage(s, 39); // 拿 200，现在共 240，抵押中
    grantTile(s, 1, 0);

    const report = declareBankrupt(s, 0, 1, () => false);
    expect(report.creditor).toBe(1);
    expect(report.toAuction).toEqual([]);
    expect(report.cashMoved).toBe(240);
    expect(report.fees).toBe(transferFee(39));
    expect(report.fees).toBe(20);
    expect(s.tiles[39].owner).toBe(1);
    expect(s.tiles[39].mortgaged).toBe(true);
    expect(s.tiles[1].owner).toBe(1);
    expect(s.players[1].cash).toBe(1000 + 240 - 20);
    expect(s.players[1].outCards).toBe(1);
    expect(s.players[0].bankrupt).toBe(true);
    expect(s.players[0].cash).toBe(0);
  });

  it("债主是玩家且选择立刻赎回：多付赎回价，地就活过来了", () => {
    const s = seats(2, 0);
    s.players[1].cash = 1000;
    grantTile(s, 39, 0);
    mortgage(s, 39);
    s.players[0].cash = 0;
    declareBankrupt(s, 0, 1, () => true);
    expect(s.tiles[39].mortgaged).toBe(false);
    expect(s.players[1].cash).toBe(1000 - 20 - unmortgageCost(39));
  });

  it("债主是银行：建筑拆光、地皮收回，逐块列进待拍清单", () => {
    const s = seats(2, 500);
    const tiles = GROUP_TILES.cotton;
    for (const t of tiles) grantTile(s, t, 0);
    buildHouse(s, tiles[0]);
    grantTile(s, 39, 0);
    mortgage(s, 39);

    const report = declareBankrupt(s, 0, BANK);
    expect(report.fees).toBe(0);
    expect(report.toAuction.sort((a, b) => a - b)).toEqual([...tiles, 39].sort((a, b) => a - b));
    for (const t of report.toAuction) {
      expect(s.tiles[t].owner).toBe(BANK);
      expect(s.tiles[t].houses).toBe(0);
      expect(s.tiles[t].mortgaged).toBe(false);
    }
    expect(s.players[0].bankrupt).toBe(true);
  });

  it("payDebt 付得出就付，付不出就走破产", () => {
    const s = seats(2, 100);
    expect(payDebt(s, 0, 1, 60)).toBe(true);
    expect(s.players[0].cash).toBe(40);
    expect(s.players[1].cash).toBe(160);
    expect(payDebt(s, 0, 1, 500)).toBe(false);
    expect(s.players[0].bankrupt).toBe(true);
    expect(s.players[1].cash).toBe(200);
  });
});

describe("卡牌结算顺序", () => {
  const allPay: EstateCard = { id: "t1", text: "每人交 200", effect: { kind: "allPay", amount: 200 } };

  it("逆时针顺序：从行动者起下标递减", () => {
    const s = seats(4);
    expect(counterClockwiseOrder(s, 2)).toEqual([2, 1, 0, 3]);
    s.players[1].bankrupt = true;
    expect(counterClockwiseOrder(s, 2)).toEqual([2, 0, 3]);
  });

  it("多人同时付不起时按逆时针依次结算，先破产的先把地交出去拍卖", () => {
    const s = seats(4, 0);
    s.players[0].cash = 500; // 行动者付得起
    s.players[1].cash = 10;
    s.players[2].cash = 10;
    s.players[3].cash = 10;
    grantTile(s, 1, 1);
    grantTile(s, 3, 2);
    grantTile(s, 6, 3);

    const auctioned: number[] = [];
    applyCard(s, 0, allPay, { auction: (pos) => auctioned.push(pos) });

    // 逆时针：0 → 3 → 2 → 1，前三个人破产的顺序就是拍卖的顺序
    expect(s.players[0].bankrupt).toBe(false);
    expect(s.players[0].cash).toBe(300);
    expect(auctioned).toEqual([6, 3, 1]);
    expect(s.players[1].bankrupt).toBe(true);
    expect(s.players[2].bankrupt).toBe(true);
    expect(s.players[3].bankrupt).toBe(true);
  });

  it("先破产的那块地已经被人买走，后面的拍卖看到的是变过的局面", () => {
    const s = seats(4, 0);
    s.players[0].cash = 900;
    s.players[1].cash = 10;
    s.players[2].cash = 10;
    s.players[3].cash = 10;
    grantTile(s, 1, 1);
    grantTile(s, 3, 2);
    grantTile(s, 6, 3);

    // 每一块被银行收回的地都当场被行动者买走，后一次拍卖时局面已经不一样了
    const owned: number[] = [];
    applyCard(s, 0, allPay, {
      auction: (pos) => {
        owned.push(s.tiles.filter((t) => t.owner === 0).length);
        grantTile(s, pos, 0);
      }
    });
    expect(owned).toEqual([0, 1, 2]);
    expect(ownsColorSet(s, 0, "cotton")).toBe(true);
  });

  it("生日卡：向每个人各收 10", () => {
    const s = seats(3, 100);
    const birthday: EstateCard = { id: "t2", text: "生日", effect: { kind: "collectEach", amount: 10 } };
    applyCard(s, 0, birthday);
    expect(s.players[0].cash).toBe(120);
    expect(s.players[1].cash).toBe(90);
    expect(s.players[2].cash).toBe(90);
  });

  it("修缮卡按房屋数收钱：小屋 40、大屋 115", () => {
    const s = seats(2, 5000);
    const tiles = GROUP_TILES.cotton;
    for (const t of tiles) grantTile(s, t, 0);
    for (let i = 0; i < 6; i++) {
      const target = tiles.find((t) => canBuildEven(s, t));
      if (target !== undefined) buildHouse(s, target);
    }
    // 两块地各 3 栋
    expect(tiles.map((t) => s.tiles[t].houses)).toEqual([3, 3]);
    const before = s.players[0].cash;
    applyCard(s, 0, { id: "t3", text: "修缮", effect: { kind: "repairs", perHouse: 40, perHotel: 115 } });
    expect(s.players[0].cash).toBe(before - 6 * 40);
  });

  it("「前进到出发花园」的卡会顺带发 200", () => {
    const s = seats(2, 0);
    s.players[0].pos = 36;
    applyCard(s, 0, { id: "t4", text: "回出发", effect: { kind: "moveTo", pos: 0, passGo: true } });
    expect(s.players[0].pos).toBe(0);
    expect(s.players[0].cash).toBe(GO_SALARY);
  });

  it("「进小黑屋」的卡不发过路费", () => {
    const s = seats(2, 0);
    s.players[0].pos = 36;
    applyCard(s, 0, { id: "t5", text: "去反思角", effect: { kind: "goJail" } });
    expect(s.players[0].inJail).toBe(true);
    expect(s.players[0].pos).toBe(JAIL_TILE);
    expect(s.players[0].cash).toBe(0);
  });
});

describe("回合推进与强制结算", () => {
  it("轮次绕回第一个座位就算过了一圈，破产的人直接跳过", () => {
    const s = seats(3);
    expect(s.round).toBe(1);
    advanceTurn(s);
    expect(s.turn).toBe(1);
    s.players[2].bankrupt = true;
    advanceTurn(s);
    expect(s.turn).toBe(0);
    expect(s.round).toBe(2);
  });

  it("80 回合到点强制结算，按净资产排名", () => {
    const s = seats(3, 100);
    grantTile(s, 39, 1);
    grantTile(s, 1, 2);
    const r = forceSettle(s);
    expect(r.reason).toBe("settle");
    expect(r.winner).toBe(1);
    expect(rankByNetWorth(s)).toEqual([1, 2, 0]);
  });

  it("runMatch 到点会收在 80 回合，不会无限打下去", () => {
    const s = seats(2);
    const ctx = ctxFor(dummyPolicy(), 11, { ...FULL_RULES, maxRounds: 6 });
    const r = runMatch(s, ctx);
    expect(r.rounds).toBeLessThanOrEqual(7);
    expect(["settle", "bankrupt"]).toContain(r.reason);
  });

  it("只剩一个人没破产就立刻收摊，不再掷骰", () => {
    const s = seats(2, 40);
    grantTile(s, 39, 1);
    s.tiles[39].houses = 5;
    s.players[0].pos = 38;
    const ctx = ctxFor(dummyPolicy(), 5, FULL_RULES, [[1, 0]]);
    const events = playTurn(s, 0, ctx);
    expect(s.players[0].bankrupt).toBe(true);
    expect(s.over).toBe(true);
    expect(events.some((e) => e.kind === "over")).toBe(true);
  });
});

describe("买地与落地结算", () => {
  it("买地扣钱、改主人；钱不够买不了", () => {
    const s = seats(2, 100);
    expect(buyTile(s, 0, 39)).toBe(false);
    expect(buyTile(s, 0, 1)).toBe(true);
    expect(s.players[0].cash).toBe(40);
    expect(s.tiles[1].owner).toBe(0);
    expect(buyTile(s, 1, 1)).toBe(false);
  });

  it("AI 不买就无底价拍卖，成交后钱货两清", () => {
    const s = seats(2, 1000);
    s.players[0].pos = 0;
    const ctx = ctxFor(dummyPolicy({ bidLimit: (_st, id) => (id === 1 ? 120 : 0) }), 9, FULL_RULES, [[1, 0]]);
    playTurn(s, 0, ctx);
    expect(s.players[0].pos).toBe(1);
    expect(s.tiles[1].owner).toBe(1);
    expect(s.players[1].cash).toBeLessThan(1000);
  });
});
