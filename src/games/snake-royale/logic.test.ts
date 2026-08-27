import { describe, expect, it } from "vitest";
import { MIN_LEN, lenToRadius, type Pt } from "./body";
import {
  BOOST_COST,
  BOOST_MUL,
  BOOST_TICK,
  DROP_MAX,
  DROP_RATE,
  FOOD_GAIN,
  GROW_RATE,
  HEAD_ON_HEAD_RULE,
  MULTI_KILL_BONUS,
  MULTI_KILL_MIN,
  ZONE_DRAIN,
  ZONE_PERIOD,
  boostMul,
  boostStep,
  canBoost,
  dropOrbs,
  headHitsBody,
  headOnHead,
  headOnHeadOut,
  insideZone,
  isSpent,
  leaderboard,
  multiKillBonus,
  orbTotal,
  rankOf,
  runLine,
  selfLine,
  shrinkZone,
  tweenLength,
  zoneDrain,
  type BodyView,
  type HeadView
} from "./logic";

function line(id: string, from: Pt, to: Pt, count: number, radius = 8): BodyView {
  const nodes: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    nodes.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }
  return { id, alive: true, nodes, radius };
}

describe("snake-royale · 加速与长度", () => {
  it("长度到下限就加不动了", () => {
    expect(canBoost(MIN_LEN + 1)).toBe(true);
    expect(canBoost(MIN_LEN)).toBe(false);
    expect(canBoost(MIN_LEN - 5)).toBe(false);
  });

  it("加速一个 tick 掉一点长度,并且要在尾巴掉光点", () => {
    const out = boostStep(50, 0, BOOST_TICK, true);
    expect(out.boosting).toBe(true);
    expect(out.drop).toBe(true);
    expect(out.length).toBeCloseTo(50 - BOOST_COST, 10);
  });

  it("不到一个 tick 只攒进度,不掉长度", () => {
    const out = boostStep(50, 0, BOOST_TICK / 3, true);
    expect(out.length).toBe(50);
    expect(out.drop).toBe(false);
    expect(out.acc).toBeCloseTo(BOOST_TICK / 3, 10);
  });

  it("一帧攒够好几个 tick 就一次扣够", () => {
    const out = boostStep(50, 0, BOOST_TICK * 3.5, true);
    expect(out.length).toBeCloseTo(50 - BOOST_COST * 3, 10);
    expect(out.acc).toBeCloseTo(BOOST_TICK * 0.5, 6);
  });

  it("掉到下限就停住,不会掉成负数", () => {
    const out = boostStep(MIN_LEN + 1, 0, BOOST_TICK * 40, true);
    expect(out.length).toBe(MIN_LEN);
    expect(out.acc).toBe(0);
  });

  it("松开加速键就完全不掉长度", () => {
    const out = boostStep(50, 90, 200, false);
    expect(out.length).toBe(50);
    expect(out.boosting).toBe(false);
    expect(out.drop).toBe(false);
    expect(out.acc).toBe(0);
  });

  it("长度已经到底的时候按加速也不生效", () => {
    const out = boostStep(MIN_LEN, 0, BOOST_TICK * 5, true);
    expect(out.boosting).toBe(false);
    expect(out.length).toBe(MIN_LEN);
  });

  it("加速倍率就是 BOOST_MUL,不加速是 1", () => {
    expect(boostMul(true)).toBe(BOOST_MUL);
    expect(boostMul(false)).toBe(1);
    expect(BOOST_MUL).toBeGreaterThan(1);
  });

  it("长度是慢慢跟过去的,不会一帧跳到位", () => {
    const mid = tweenLength(20, 200, 1 / 60);
    expect(mid).toBeGreaterThan(20);
    expect(mid).toBeLessThan(200);
    expect(mid - 20).toBeCloseTo(GROW_RATE / 60, 10);
  });

  it("差距很小的时候一次补到位,不会永远抖", () => {
    expect(tweenLength(20, 20.001, 1 / 60)).toBe(20.001);
    expect(tweenLength(200, 20, 1)).toBeLessThan(200);
  });
});

describe("snake-royale · 头撞身体是唯一的淘汰方式", () => {
  const rival = line("bot", { x: 100, y: -50 }, { x: 100, y: 50 }, 21, 8);

  it("头贴上别人的身体就算撞到", () => {
    const head: HeadView = { id: "me", x: 100, y: 0, radius: 6 };
    expect(headHitsBody(head, [rival])).toBe("bot");
  });

  it("差一点点没碰到就不算", () => {
    const head: HeadView = { id: "me", x: 100 + 8 + 6 + 0.5, y: 0, radius: 6 };
    expect(headHitsBody(head, [rival])).toBeNull();
  });

  it("刚好等于两半径之和算「没碰到」,边界写死", () => {
    const head: HeadView = { id: "me", x: 100 + 14, y: 0, radius: 6 };
    expect(headHitsBody(head, [rival])).toBeNull();
    const inside: HeadView = { id: "me", x: 100 + 13.9, y: 0, radius: 6 };
    expect(headHitsBody(inside, [rival])).toBe("bot");
  });

  it("自己的身体永远不判定 —— 这条是本款和格子贪吃蛇最大的区别", () => {
    const mine = line("me", { x: 0, y: -60 }, { x: 0, y: 60 }, 25, 8);
    const head: HeadView = { id: "me", x: 0, y: 0, radius: 6 };
    expect(headHitsBody(head, [mine])).toBeNull();
    // 同一帧里别人的身体照样判
    expect(headHitsBody({ ...head, x: 100 }, [mine, rival])).toBe("bot");
  });

  it("已经先去休息的蛇,身体不再拦人", () => {
    const resting: BodyView = { ...rival, alive: false };
    expect(headHitsBody({ id: "me", x: 100, y: 0, radius: 6 }, [resting])).toBeNull();
  });

  it("身体互相穿过不判定,只看头", () => {
    const a = line("a", { x: -50, y: 0 }, { x: 50, y: 0 }, 21, 8);
    const b = line("b", { x: 0, y: -50 }, { x: 0, y: 50 }, 21, 8);
    // b 的头在很远的地方,虽然两条身体交叉,谁都不出局
    expect(headHitsBody({ id: "b", x: 0, y: 300, radius: 6 }, [a])).toBeNull();
    expect(headHitsBody({ id: "a", x: -300, y: 0, radius: 6 }, [b])).toBeNull();
  });
});

describe("snake-royale · 头对头", () => {
  it("规则写死成「两条一起先去休息」", () => {
    expect(HEAD_ON_HEAD_RULE).toBe("both");
  });

  it("两个头贴上就都要休息", () => {
    const a: HeadView = { id: "a", x: 0, y: 0, radius: 7 };
    const b: HeadView = { id: "b", x: 10, y: 0, radius: 7 };
    expect(headOnHead(a, b)).toBe(true);
    expect(headOnHeadOut(a, b).sort()).toEqual(["a", "b"]);
  });

  it("离得够远就什么都不发生", () => {
    const a: HeadView = { id: "a", x: 0, y: 0, radius: 7 };
    const b: HeadView = { id: "b", x: 40, y: 0, radius: 7 };
    expect(headOnHead(a, b)).toBe(false);
    expect(headOnHeadOut(a, b)).toEqual([]);
  });

  it("同一条蛇不会和自己头对头", () => {
    const a: HeadView = { id: "a", x: 0, y: 0, radius: 7 };
    expect(headOnHead(a, { ...a })).toBe(false);
  });
});

describe("snake-royale · 掉落光点", () => {
  const nodes = line("x", { x: 0, y: 0 }, { x: 200, y: 0 }, 40).nodes;

  it("掉落总量跟长度成比例", () => {
    for (const len of [20, 60, 150]) {
      const orbs = dropOrbs(nodes, len);
      expect(orbTotal(orbs)).toBeCloseTo(len * DROP_RATE, 6);
    }
  });

  it("长度翻倍掉落也翻倍", () => {
    expect(orbTotal(dropOrbs(nodes, 100))).toBeCloseTo(orbTotal(dropOrbs(nodes, 50)) * 2, 6);
  });

  it("光点摆在身体轨迹上,数量有上限", () => {
    const many = line("x", { x: 0, y: 0 }, { x: 900, y: 0 }, 200).nodes;
    const orbs = dropOrbs(many, 300);
    expect(orbs.length).toBeLessThanOrEqual(DROP_MAX);
    expect(orbs.length).toBeGreaterThan(1);
    for (const o of orbs) expect(o.y).toBeCloseTo(0, 6);
  });

  it("没有身体或者长度为 0 就不掉东西", () => {
    expect(dropOrbs([], 100)).toEqual([]);
    expect(dropOrbs(nodes, 0)).toEqual([]);
  });

  it("每颗光点都比一颗普通星光豆值钱", () => {
    const orbs = dropOrbs(nodes, 120);
    for (const o of orbs) expect(o.value).toBeGreaterThan(FOOD_GAIN);
  });
});

describe("snake-royale · 绕圈奖励", () => {
  it("一次只拦下一条没有额外奖励", () => {
    expect(multiKillBonus(1).bonus).toBe(0);
    expect(multiKillBonus(1).text).toBe("");
  });

  it("一次拦下两条才触发,文案是原创的", () => {
    const out = multiKillBonus(MULTI_KILL_MIN);
    expect(out.bonus).toBe(MULTI_KILL_BONUS);
    expect(out.text).toContain("绕出一个圈啦");
  });

  it("拦得越多奖励越多", () => {
    expect(multiKillBonus(3).bonus).toBeGreaterThan(multiKillBonus(2).bonus);
    expect(multiKillBonus(4).text).toContain("4");
  });

  it("0 条或者坏数据都不给奖励", () => {
    expect(multiKillBonus(0).bonus).toBe(0);
    expect(multiKillBonus(Number.NaN).bonus).toBe(0);
    expect(multiKillBonus(-3).bonus).toBe(0);
  });
});

describe("snake-royale · 缩圈", () => {
  it("安全区一直在收,但不会收成负数", () => {
    let z = { cx: 0, cy: 0, radius: 500 };
    z = shrinkZone(z, 1, 40, 180);
    expect(z.radius).toBe(460);
    for (let i = 0; i < 100; i++) z = shrinkZone(z, 1, 40, 180);
    expect(z.radius).toBe(180);
  });

  it("圈内不掉长度,圈外每秒掉 ZONE_DRAIN", () => {
    const zone = { cx: 0, cy: 0, radius: 100 };
    expect(zoneDrain(60, { x: 0, y: 0 }, zone, 1)).toBe(60);
    expect(zoneDrain(60, { x: 300, y: 0 }, zone, 1)).toBeCloseTo(60 - ZONE_DRAIN, 10);
  });

  it("没有安全区就永远算在圈里", () => {
    expect(insideZone({ x: 9999, y: 9999 }, null)).toBe(true);
    expect(zoneDrain(60, { x: 9999, y: 0 }, null, 5)).toBe(60);
  });

  it("圈外一直掉,掉到下限就判先去休息", () => {
    const zone = { cx: 0, cy: 0, radius: 50 };
    let len = 40;
    for (let i = 0; i < 60; i++) len = zoneDrain(len, { x: 500, y: 0 }, zone, 0.5);
    expect(len).toBe(MIN_LEN);
    expect(isSpent(len, { x: 500, y: 0 }, zone)).toBe(true);
  });

  it("在圈里就算长度到下限也不算结束", () => {
    const zone = { cx: 0, cy: 0, radius: 500 };
    expect(isSpent(MIN_LEN, { x: 0, y: 0 }, zone)).toBe(false);
  });

  it("缩圈周期常量是正数", () => {
    expect(ZONE_PERIOD).toBeGreaterThan(0);
  });
});

describe("snake-royale · 排行榜", () => {
  const rows = [
    { id: "bot1", name: "云云", length: 70, alive: true },
    { id: "me", name: "朵朵", length: 90, alive: true },
    { id: "bot2", name: "糯糯", length: 120, alive: true },
    { id: "bot3", name: "闪闪", length: 40, alive: false }
  ];

  it("按长度从高到低排,休息的不上榜", () => {
    const board = leaderboard(rows, 10);
    expect(board.map((r) => r.id)).toEqual(["bot2", "me", "bot1"]);
  });

  it("长度一样时按 id 稳定排,顺序不会跳", () => {
    const tie = [
      { id: "zz", name: "啾啾", length: 50, alive: true },
      { id: "aa", name: "团团", length: 50, alive: true }
    ];
    expect(leaderboard(tie, 10).map((r) => r.id)).toEqual(["aa", "zz"]);
    expect(leaderboard([...tie].reverse(), 10).map((r) => r.id)).toEqual(["aa", "zz"]);
  });

  it("只取前 N 名", () => {
    expect(leaderboard(rows, 2)).toHaveLength(2);
    expect(leaderboard(rows, 0)).toHaveLength(0);
  });

  it("rankOf 给出 1 基名次,休息的返回 0", () => {
    expect(rankOf(rows, "bot2")).toBe(1);
    expect(rankOf(rows, "me")).toBe(2);
    expect(rankOf(rows, "bot3")).toBe(0);
    expect(rankOf(rows, "nobody")).toBe(0);
  });
});

describe("snake-royale · 文案分级", () => {
  it("赢了夸人,输了只鼓励,不写吓人的词", () => {
    const win = runLine(true, 1, 120);
    const lose = runLine(false, 5, 44);
    expect(win).toContain("第 1 名");
    expect(lose).toContain("长蛇打了个盹");
    for (const text of [win, lose, selfLine(3, 50)]) {
      for (const bad of ["死", "杀", "血", "尸", "干掉", "击败对手出局"]) {
        expect(text.includes(bad)).toBe(false);
      }
    }
  });

  it("HUD 自己那一行写清名次和长度", () => {
    expect(selfLine(12, 87.4)).toBe("第 12 名 · 长度 87");
  });

  it("半径换算从 body 透出来,玩法层只 import 一处", () => {
    expect(lenToRadius(100)).toBeGreaterThan(0);
  });
});
