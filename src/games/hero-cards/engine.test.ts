import { describe, expect, it } from "vitest";
import { makeCard, type Card, type DeckEntry } from "./cards";
import {
  aliveIds,
  campOf,
  canPlay,
  canSlash,
  countCards,
  createGame,
  distanceBetween,
  drawCards,
  endTurn,
  eliminate,
  exposedCards,
  giftCard,
  giftLeft,
  isGroupTrick,
  judge,
  legalTargets,
  onEliminated,
  playCard,
  rangeOf,
  runFlow,
  slashLeft,
  startTurn,
  usableAsDodge,
  usableAsSlash,
  winnerOf,
  ROLE_DESC,
  ROLE_LABELS,
  type GameState,
  type Reply,
  type Request,
  type Role,
  type SeatSpec
} from "./engine";

const BASIC: DeckEntry[] = [
  { kind: "slash", count: 20 },
  { kind: "dodge", count: 6 },
  { kind: "heal", count: 4 }
];

interface Spec {
  hero?: string;
  role: Role;
  hand?: Card[];
  gear?: Card[];
  delayed?: Card[];
  vigor?: number;
  maxVigor?: number;
}

/** 摆一桌:手牌全部写死,没写的一张都不发 */
function build(specs: Spec[], opts: { seed?: number; recipe?: DeckEntry[]; factionLock?: boolean } = {}): GameState {
  const seats: SeatSpec[] = specs.map((s, i) => ({
    name: `位${i}`,
    heroId: s.hero ?? "lubai",
    role: s.role,
    hand: s.hand ?? [],
    gear: s.gear,
    delayed: s.delayed,
    vigor: s.vigor,
    maxVigor: s.maxVigor
  }));
  return createGame({ seats, seed: opts.seed ?? 555, recipe: opts.recipe ?? BASIC, factionLock: opts.factionLock });
}

/** 把生成器跑完:按 answers 逐条回答,答完就一律「不出」 */
function run<T>(flow: Generator<Request, T, Reply>, answers: Array<Reply | ((r: Request) => Reply)> = []): {
  value: T;
  seen: Request[];
} {
  const seen: Request[] = [];
  let i = 0;
  const value = runFlow(flow, (req) => {
    seen.push(req);
    // 答案用完之后,最后一条如果是函数就一直用它,否则一律「不出」
    const a = answers[i] ?? (typeof answers[answers.length - 1] === "function" ? answers[answers.length - 1] : undefined);
    i++;
    if (typeof a === "function") return a(req);
    return a ?? { card: null };
  });
  return { value, seen };
}

/** 有什么打什么:请求要哪一种牌就从手上找哪一种 */
function eager(state: GameState): (r: Request) => Reply {
  return (req) => {
    if (req.kind === "discard") return { cards: state.players[req.who].hand.slice(0, req.count) };
    if (req.kind === "pick") return { card: exposedCards(state.players[req.target])[0] ?? null };
    const hand = state.players[req.who].hand;
    if (req.need === "dodge") return { card: hand.find((c) => usableAsDodge(state, req.who, c)) ?? null };
    if (req.need === "slash") return { card: hand.find((c) => usableAsSlash(state, req.who, c)) ?? null };
    return { card: hand.find((c) => c.kind === req.need) ?? null };
  };
}

const slash = (suit: "flower" | "leaf" = "flower"): Card => makeCard("slash", suit, 7);
const dodge = (): Card => makeCard("dodge", "leaf", 5);
const heal = (): Card => makeCard("heal", "flower", 9);
const nullify = (): Card => makeCard("nullify", "leaf", 3);

// ---------------------------------------------------------------------------

describe("身份胜负 winnerOf", () => {
  const ROLES: Role[] = ["lord", "loyal", "rebel", "rebel", "spy"];

  it("四种身份各有一句说明,阵营分得清", () => {
    for (const r of ["lord", "loyal", "rebel", "spy"] as Role[]) {
      expect(ROLE_LABELS[r].length).toBeGreaterThan(1);
      expect(ROLE_DESC[r].length).toBeGreaterThan(10);
    }
    expect(campOf("lord")).toBe("lord");
    expect(campOf("loyal")).toBe("lord");
    expect(campOf("rebel")).toBe("rebel");
    expect(campOf("spy")).toBe("spy");
  });

  it("大家都还在,谁也没赢", () => {
    expect(winnerOf([0, 1, 2, 3, 4], ROLES)).toBeNull();
  });

  it("夺花与藏花都退场了,护花阵营赢", () => {
    expect(winnerOf([0, 1], ROLES)).toBe("lord");
    expect(winnerOf([0], ROLES)).toBe("lord");
  });

  it("花主退场而场上还有别人,夺花赢", () => {
    expect(winnerOf([1, 2, 3, 4], ROLES)).toBe("rebel");
    expect(winnerOf([2, 4], ROLES)).toBe("rebel");
  });

  it("藏花边界一:最后只剩藏花一个人,藏花赢", () => {
    expect(winnerOf([4], ROLES)).toBe("spy");
  });

  it("藏花边界二:花主早早退场、护花还在,轮不到藏花,算夺花赢", () => {
    expect(winnerOf([1, 4], ROLES)).toBe("rebel");
  });

  it("藏花边界三:花主早早退场、夺花还在,也是夺花赢", () => {
    expect(winnerOf([3, 4], ROLES)).toBe("rebel");
  });

  it("藏花边界四:花主还在、藏花还在,局面没完", () => {
    expect(winnerOf([0, 4], ROLES)).toBeNull();
  });

  it("没有花主的合作小关:一边全退场,另一边就赢", () => {
    const pair: Role[] = ["loyal", "loyal", "rebel", "rebel"];
    expect(winnerOf([0, 1, 2], pair)).toBeNull();
    expect(winnerOf([0, 1], pair)).toBe("lord");
    expect(winnerOf([2, 3], pair)).toBe("rebel");
  });
});

describe("退场奖惩 onEliminated", () => {
  it("任何人请走一位夺花都摸 3 张", () => {
    expect(onEliminated({ id: 1, role: "loyal" }, { id: 2, role: "rebel" })).toEqual({ draw: 3, discardAll: false });
    expect(onEliminated({ id: 4, role: "spy" }, { id: 2, role: "rebel" }).draw).toBe(3);
  });

  it("自己撑不住退场的没人摸牌", () => {
    expect(onEliminated(null, { id: 2, role: "rebel" })).toEqual({ draw: 0, discardAll: false });
  });

  it("花主误让护花退场,要把手牌和装备全放下", () => {
    expect(onEliminated({ id: 0, role: "lord" }, { id: 1, role: "loyal" })).toEqual({ draw: 0, discardAll: true });
  });

  it("护花之间的误伤不罚,只有花主认错人才罚", () => {
    expect(onEliminated({ id: 1, role: "loyal" }, { id: 3, role: "loyal" }).discardAll).toBe(false);
    expect(onEliminated({ id: 0, role: "lord" }, { id: 0, role: "lord" }).discardAll).toBe(false);
  });

  it("落到局面上:请走夺花真的摸到 3 张", () => {
    const state = build([{ role: "lord" }, { role: "loyal" }, { role: "rebel" }, { role: "rebel" }, { role: "spy" }]);
    expect(state.players[1].hand.length).toBe(0);
    eliminate(state, 2, 1);
    expect(state.players[2].out).toBe(true);
    expect(state.players[1].hand.length).toBe(3);
  });

  it("落到局面上:花主认错人,手牌与装备一并放下", () => {
    const state = build([
      { role: "lord", hand: [slash(), slash(), heal()], gear: [makeCard("weapon", "berry", 6, "kite")] },
      { role: "loyal" },
      { role: "rebel" },
      { role: "rebel" },
      { role: "spy" }
    ]);
    expect(state.players[0].gear.weapon).toBeTruthy();
    eliminate(state, 1, 0);
    expect(state.players[0].hand.length).toBe(0);
    expect(state.players[0].gear.weapon).toBeUndefined();
  });

  it("退场休息的人牌全进弃牌堆,身份翻开,措辞是回后台休息", () => {
    const state = build([{ role: "lord" }, { role: "loyal", hand: [slash(), dodge()] }, { role: "rebel" }]);
    const before = state.pile.discard.length;
    eliminate(state, 1, null);
    expect(state.players[1].revealed).toBe(true);
    expect(state.players[1].hand).toEqual([]);
    expect(state.pile.discard.length).toBe(before + 2);
    expect(state.log.join("\n")).toContain("回后台休息");
  });
});

describe("距离与合法目标", () => {
  function five(gear: Record<number, Card[]> = {}): GameState {
    return build(
      [0, 1, 2, 3, 4].map((i) => ({
        role: (i === 0 ? "lord" : i === 1 ? "loyal" : i === 4 ? "spy" : "rebel") as Role,
        hand: [slash(), makeCard("snatch", "flower", 3), makeCard("dismantle", "leaf", 4)],
        gear: gear[i]
      }))
    );
  }

  it("空着手只够得着邻座", () => {
    const state = five();
    expect(rangeOf(state, 0)).toBe(1);
    expect(canSlash(state, 0, 1)).toBe(true);
    expect(canSlash(state, 0, 2)).toBe(false);
  });

  it("挂上范围 2 的武器就能击距离 2,但顺手摘花还是够不着", () => {
    const state = five({ 0: [makeCard("weapon", "berry", 6, "fan")] });
    expect(rangeOf(state, 0)).toBe(2);
    const me = state.players[0];
    expect(legalTargets(me.hand[0], state, 0)).toContain(2);
    // 顺手摘花看纯距离,武器不算数
    expect(legalTargets(me.hand[1], state, 0)).not.toContain(2);
    expect(legalTargets(me.hand[1], state, 0)).toContain(1);
    // 拆花篮不看距离,谁都能拆
    expect(legalTargets(me.hand[2], state, 0).sort()).toEqual([1, 2, 3, 4]);
  });

  it("穿了踏云软靴,顺手摘花也能够到距离 2 的人", () => {
    const state = five({ 0: [makeCard("horseMinus", "berry", 6, "minus")] });
    expect(legalTargets(state.players[0].hand[1], state, 0)).toContain(2);
  });

  it("有人退场之后距离重算,原本够不着的现在够得着", () => {
    const state = five();
    expect(distanceBetween(state, 0, 2)).toBe(2);
    eliminate(state, 1, null);
    expect(distanceBetween(state, 0, 2)).toBe(1);
    expect(canSlash(state, 0, 2)).toBe(true);
    expect(aliveIds(state)).toEqual([0, 2, 3, 4]);
  });

  it("每回合只出一张击,挂连珠花轮就不限", () => {
    const state = five();
    expect(slashLeft(state, 0)).toBe(true);
    state.players[0].slashUsed = 1;
    expect(slashLeft(state, 0)).toBe(false);
    expect(legalTargets(state.players[0].hand[0], state, 0)).toEqual([]);
    state.players[0].gear.weapon = makeCard("weapon", "berry", 6, "wheel");
    expect(slashLeft(state, 0)).toBe(true);
  });

  it("合作小关里同阵营互相打不了", () => {
    const state = build(
      [
        { role: "loyal", hand: [slash()] },
        { role: "loyal", hand: [slash()] },
        { role: "rebel", hand: [slash()] },
        { role: "rebel", hand: [slash()] }
      ],
      { factionLock: true }
    );
    // 0 的两个邻座里,1 是自己人指不了,3 是对面才行
    expect(legalTargets(state.players[0].hand[0], state, 0)).toEqual([3]);
    expect(legalTargets(state.players[1].hand[0], state, 1)).toEqual([2]);
    // 关掉合作锁,自己人就又能指了
    state.factionLock = false;
    expect(legalTargets(state.players[0].hand[0], state, 0)).toContain(1);
  });

  it("星星盾和春风无懈是响应牌,主动出不了", () => {
    const state = build([{ role: "lord", hand: [dodge(), nullify()] }, { role: "rebel" }]);
    expect(canPlay(state, 0, state.players[0].hand[0])).toBe(false);
    expect(canPlay(state, 0, state.players[0].hand[1])).toBe(false);
  });

  it("蜜桃愈只在元气没满时才打得出去", () => {
    const state = build([{ role: "lord", hand: [heal()] }, { role: "rebel" }]);
    expect(legalTargets(state.players[0].hand[0], state, 0)).toEqual([]);
    state.players[0].vigor -= 1;
    expect(legalTargets(state.players[0].hand[0], state, 0)).toEqual([0]);
  });

  it("群体锦囊不选人,但桌上得有别人", () => {
    expect(isGroupTrick("petalStorm")).toBe(true);
    expect(isGroupTrick("slash")).toBe(false);
    const state = build([{ role: "lord", hand: [makeCard("petalStorm", "flower", 2)] }, { role: "rebel" }]);
    expect(canPlay(state, 0, state.players[0].hand[0])).toBe(true);
  });
});

describe("花瓣击的结算", () => {
  it("挡下来就不掉元气,弃牌堆里多两张", () => {
    const state = build([{ role: "lord", hand: [slash()] }, { role: "rebel", hand: [dodge()] }]);
    const card = state.players[0].hand[0];
    const target = state.players[1];
    const before = target.vigor;
    run(playCard(state, 0, card, [1]), [(req) => ({ card: state.players[req.who].hand[0] })]);
    expect(target.vigor).toBe(before);
    expect(target.hand.length).toBe(0);
    expect(state.pile.discard.length).toBe(2);
  });

  it("不挡就掉一片花瓣,元气少 1", () => {
    const state = build([{ role: "lord", hand: [slash()] }, { role: "rebel", hand: [dodge()] }]);
    const before = state.players[1].vigor;
    run(playCard(state, 0, state.players[0].hand[0], [1]));
    expect(state.players[1].vigor).toBe(before - 1);
    expect(state.log.join("\n")).toContain("掉了 1 片花瓣");
  });

  it("霜锋:一张盾不够,要两张才挡得住", () => {
    const state = build([
      { hero: "shuangye", role: "lord", hand: [slash()] },
      { role: "rebel", hand: [dodge(), dodge()] }
    ]);
    const before = state.players[1].vigor;
    const { seen } = run(playCard(state, 0, state.players[0].hand[0], [1]), [
      (req) => ({ card: state.players[req.who].hand[0] }),
      (req) => ({ card: state.players[req.who].hand[0] })
    ]);
    expect(seen.filter((r) => r.kind === "respond" && r.need === "dodge").length).toBe(2);
    expect(state.players[1].vigor).toBe(before);
  });

  it("豪掷:红门的击根本不问挡不挡", () => {
    const state = build([
      { hero: "doujiang", role: "lord", hand: [slash("flower")] },
      { role: "rebel", hand: [dodge(), dodge()] }
    ]);
    const before = state.players[1].vigor;
    const { seen } = run(playCard(state, 0, state.players[0].hand[0], [1]));
    expect(seen.filter((r) => r.kind === "respond" && r.need === "dodge").length).toBe(0);
    expect(state.players[1].vigor).toBe(before - 1);
  });

  it("星纱披风翻到红门就当挡下了", () => {
    // 牌堆里全是红门,判定必红
    const state = build([{ role: "lord", hand: [slash()] }, { role: "rebel", gear: [makeCard("armor", "berry", 2, "cloak")] }], {
      recipe: [{ kind: "slash", count: 12 }]
    });
    for (const c of state.pile.deck) c.suit = "flower";
    const before = state.players[1].vigor;
    run(playCard(state, 0, state.players[0].hand[0], [1]));
    expect(state.players[1].vigor).toBe(before);
    expect(state.log.join("\n")).toContain("红门");
  });

  it("元气归零先问自己吃不吃蜜桃愈,吃了就留在桌上", () => {
    const state = build([
      { role: "lord", hand: [slash()] },
      { role: "rebel", vigor: 1, hand: [heal()] }
    ]);
    run(playCard(state, 0, state.players[0].hand[0], [1]), [eager(state)]);
    expect(state.players[1].out).toBe(false);
    expect(state.players[1].vigor).toBe(1);
  });

  it("没人递蜜桃愈就退场休息,顺手结算胜负", () => {
    const state = build([
      { role: "lord", hand: [slash()] },
      { role: "rebel", vigor: 1 }
    ]);
    run(playCard(state, 0, state.players[0].hand[0], [1]));
    expect(state.players[1].out).toBe(true);
    expect(state.over).toBe(true);
    expect(state.winner).toBe("lord");
  });

  it("云牧掉元气就顺攻击方一张牌", () => {
    const state = build([
      { role: "lord", hand: [slash(), slash(), heal()] },
      { hero: "yunmu", role: "rebel" }
    ]);
    run(playCard(state, 0, state.players[0].hand[0], [1]));
    expect(state.players[1].hand.length).toBe(1);
    expect(state.players[0].hand.length).toBe(1);
  });
});

describe("春风无懈", () => {
  it("一张无懈把锦囊抵消掉", () => {
    const state = build([
      { role: "lord", hand: [makeCard("dismantle", "leaf", 4)] },
      { role: "rebel", hand: [nullify(), slash()] }
    ]);
    run(playCard(state, 0, state.players[0].hand[0], [1]), [
      (req) => ({ card: state.players[req.who].hand.find((c) => c.kind === "nullify") ?? null })
    ]);
    // 拆花篮被抵消,对手的花瓣击还在手上
    expect(state.players[1].hand.length).toBe(1);
    expect(state.players[1].hand[0].kind).toBe("slash");
    expect(state.log.join("\n")).toContain("被抵消了");
  });

  it("无懈可以反制无懈:第二张一压,锦囊又生效了", () => {
    const state = build([
      { role: "lord", hand: [makeCard("dismantle", "leaf", 4)] },
      { role: "rebel", hand: [nullify(), slash()] },
      { role: "loyal", hand: [nullify()] }
    ]);
    const { seen } = run(playCard(state, 0, state.players[0].hand[0], [1]), [
      (req) => ({ card: state.players[req.who].hand.find((c) => c.kind === "nullify") ?? null }),
      (req) => ({ card: state.players[req.who].hand.find((c) => c.kind === "nullify") ?? null }),
      (req) => ({ card: null })
    ]);
    expect(seen.filter((r) => r.kind === "respond" && r.need === "nullify").length).toBeGreaterThanOrEqual(2);
    const line = state.log.join("\n");
    expect(line).toContain("被抵消了");
    expect(line).toContain("又生效了");
    // 最终拆花篮生效:对手手上那张击被拆掉
    expect(state.players[1].hand.length).toBe(0);
  });

  it("无懈请求写明这一张是冲着谁去的", () => {
    const state = build([
      { role: "lord", hand: [makeCard("dismantle", "leaf", 4)] },
      { role: "rebel", hand: [nullify(), slash()] }
    ]);
    const { seen } = run(playCard(state, 0, state.players[0].hand[0], [1]));
    const req = seen.find((r) => r.kind === "respond" && r.need === "nullify");
    expect(req && req.kind === "respond" ? req.target : -1).toBe(1);
    expect(req && req.kind === "respond" ? req.from : -1).toBe(0);
  });

  it("群体锦囊是一个人一份地抵消的,替自己挡下的救不了别人", () => {
    const state = build([
      { role: "lord", hand: [makeCard("starShower", "flower", 2)] },
      { role: "rebel", hand: [nullify()] },
      { role: "rebel" }
    ]);
    const v1 = state.players[1].vigor;
    const v2 = state.players[2].vigor;
    run(playCard(state, 0, state.players[0].hand[0], []), [
      // 1 号替自己抵消
      (req) => ({ card: state.players[req.who].hand.find((c) => c.kind === "nullify") ?? null })
    ]);
    expect(state.players[1].vigor).toBe(v1);
    expect(state.players[2].vigor).toBe(v2 - 1);
  });
});

describe("群体锦囊与对花令", () => {
  it("流星阵雨:出不起星星盾的人各掉一片花瓣", () => {
    const state = build([
      { role: "lord", hand: [makeCard("starShower", "flower", 2)] },
      { role: "rebel", hand: [dodge()] },
      { role: "rebel" }
    ]);
    const v1 = state.players[1].vigor;
    const v2 = state.players[2].vigor;
    run(playCard(state, 0, state.players[0].hand[0], []), [
      (req) => ({ card: state.players[req.who].hand[0] })
    ]);
    expect(state.players[1].vigor).toBe(v1);
    expect(state.players[2].vigor).toBe(v2 - 1);
  });

  it("铁墩对群体锦囊免疫,连问都不问", () => {
    const state = build([
      { role: "lord", hand: [makeCard("petalStorm", "flower", 2)] },
      { hero: "dundun", role: "rebel" }
    ]);
    const before = state.players[1].vigor;
    const { seen } = run(playCard(state, 0, state.players[0].hand[0], []));
    expect(state.players[1].vigor).toBe(before);
    expect(seen.filter((r) => r.who === 1).length).toBe(0);
    expect(state.log.join("\n")).toContain("稳稳站着");
  });

  it("对花令:先接不上花瓣击的那个掉元气", () => {
    const state = build([
      { role: "lord", hand: [makeCard("duel", "leaf", 1), slash()] },
      { role: "rebel", hand: [] }
    ]);
    const before = state.players[1].vigor;
    run(playCard(state, 0, state.players[0].hand[0], [1]));
    expect(state.players[1].vigor).toBe(before - 1);
  });

  it("对花令接得上就轮回去,出牌方反倒掉元气", () => {
    const state = build([
      { role: "lord", hand: [makeCard("duel", "leaf", 1)] },
      { role: "rebel", hand: [slash()] }
    ]);
    const before = state.players[0].vigor;
    run(playCard(state, 0, state.players[0].hand[0], [1]), [
      (req) => ({ card: state.players[req.who].hand[0] })
    ]);
    expect(state.players[0].vigor).toBe(before - 1);
  });
});

describe("顺手 / 拆解 / 借力", () => {
  it("顺手摘花把牌拿到自己手里", () => {
    const state = build([
      { role: "lord", hand: [makeCard("snatch", "flower", 3)] },
      { role: "rebel", hand: [slash(), dodge()] }
    ]);
    run(playCard(state, 0, state.players[0].hand[0], [1]), [(req) => ({ card: exposedCards(state.players[req.kind === "pick" ? req.target : 1])[0] })]);
    expect(state.players[0].hand.length).toBe(1);
    expect(state.players[1].hand.length).toBe(1);
  });

  it("拆花篮把装备拆下来丢进弃牌堆,风铃跟着摸一张", () => {
    const state = build([
      { role: "lord", hand: [makeCard("dismantle", "leaf", 4)] },
      { role: "rebel", gear: [makeCard("horsePlus", "berry", 6, "plus")] },
      { hero: "fengling", role: "loyal" }
    ]);
    run(playCard(state, 0, state.players[0].hand[0], [1]));
    expect(state.players[1].gear.horsePlus).toBeUndefined();
    expect(state.players[2].hand.length).toBe(1);
  });

  it("春风借力:持刀的人不肯出手就把武器让出来", () => {
    const state = build([
      { role: "lord", hand: [makeCard("borrow", "flower", 8)] },
      { role: "rebel", gear: [makeCard("weapon", "berry", 6, "ribbon")] },
      { role: "rebel" }
    ]);
    run(playCard(state, 0, state.players[0].hand[0], [1, 2]));
    expect(state.players[1].gear.weapon).toBeUndefined();
    expect(state.players[0].hand.some((c) => c.kind === "weapon")).toBe(true);
  });

  it("春风借力:肯出手就真的朝第三个人打一击", () => {
    const state = build([
      { role: "lord", hand: [makeCard("borrow", "flower", 8)] },
      { role: "rebel", gear: [makeCard("weapon", "berry", 6, "ribbon")], hand: [slash()] },
      { role: "rebel" }
    ]);
    const before = state.players[2].vigor;
    run(playCard(state, 0, state.players[0].hand[0], [1, 2]), [
      (req) => ({ card: state.players[req.who].hand[0] })
    ]);
    expect(state.players[1].gear.weapon).toBeTruthy();
    expect(state.players[2].vigor).toBe(before - 1);
  });

  it("身上一张牌都没有的人顺不了也拆不了", () => {
    const state = build([
      { role: "lord", hand: [makeCard("snatch", "flower", 3), makeCard("dismantle", "leaf", 4)] },
      { role: "rebel" }
    ]);
    expect(countCards(state.players[1])).toBe(0);
    expect(legalTargets(state.players[0].hand[0], state, 0)).toEqual([]);
    expect(legalTargets(state.players[0].hand[1], state, 0)).toEqual([]);
  });
});

describe("回合:判定 / 摸牌 / 弃牌", () => {
  it("贪玩令判定翻到黑门就跳过出牌阶段", () => {
    const state = build([{ role: "lord", delayed: [makeCard("playful", "leaf", 3)] }, { role: "rebel" }], {
      recipe: [{ kind: "slash", count: 20 }]
    });
    for (const c of state.pile.deck) c.suit = "leaf";
    startTurn(state, 0);
    expect(state.players[0].skipPlay).toBe(true);
    expect(state.players[0].delayed.length).toBe(0);
    expect(state.log.join("\n")).toContain("光顾着玩");
  });

  it("贪玩令判定翻到红门就飘走了,照常出牌", () => {
    const state = build([{ role: "lord", delayed: [makeCard("playful", "leaf", 3)] }, { role: "rebel" }], {
      recipe: [{ kind: "slash", count: 20 }]
    });
    for (const c of state.pile.deck) c.suit = "berry";
    startTurn(state, 0);
    expect(state.players[0].skipPlay).toBe(false);
    expect(state.log.join("\n")).toContain("飘走");
  });

  it("露白的凝露把不利的判定换成手上的红门牌", () => {
    const state = build(
      [{ hero: "lubai", role: "lord", hand: [makeCard("heal", "berry", 9)], delayed: [makeCard("playful", "leaf", 3)] }, { role: "rebel" }],
      { recipe: [{ kind: "slash", count: 20 }] }
    );
    for (const c of state.pile.deck) c.suit = "stone";
    startTurn(state, 0);
    expect(state.players[0].skipPlay).toBe(false);
    expect(state.log.join("\n")).toContain("凝露");
  });

  it("判定是从牌堆顶翻的,翻完进弃牌堆", () => {
    const state = build([{ role: "lord" }, { role: "rebel" }], { recipe: [{ kind: "slash", count: 8 }] });
    const top = state.pile.deck[0];
    const res = judge(state, 0, true);
    expect(res.card?.id).toBe(top.id);
    expect(state.pile.discard.some((c) => c.id === top.id)).toBe(true);
  });

  it("摸牌阶段摸 2 张,星愿多摸一张", () => {
    const plain = build([{ role: "lord" }, { role: "rebel" }]);
    startTurn(plain, 0);
    expect(plain.players[0].hand.length).toBe(2);

    const star = build([{ hero: "xingxing", role: "lord" }, { role: "rebel" }]);
    startTurn(star, 0);
    expect(star.players[0].hand.length).toBe(3);
  });

  it("回合开始把每回合一次的技能计数清零", () => {
    const state = build([{ hero: "jiujiu", role: "lord" }, { role: "rebel" }]);
    state.players[0].flags.chirp = 1;
    state.players[0].flags.starlight = 1;
    state.players[0].flags.frostEdge = 1;
    state.players[0].slashUsed = 1;
    startTurn(state, 0);
    expect(state.players[0].flags.chirp).toBe(0);
    expect(state.players[0].flags.starlight).toBe(0);
    expect(state.players[0].flags.frostEdge).toBe(0);
    expect(state.players[0].slashUsed).toBe(0);
  });

  it("弃牌阶段把手牌压到当前元气,玩家自己挑弃哪几张", () => {
    const state = build([{ role: "lord", vigor: 2, hand: [slash(), slash(), dodge(), heal()] }, { role: "rebel" }]);
    const keep = state.players[0].hand[3];
    const { seen } = run(endTurn(state, 0), [
      (req) => ({ cards: req.kind === "discard" ? state.players[0].hand.slice(0, req.count) : [] })
    ]);
    expect(seen[0].kind).toBe("discard");
    expect(state.players[0].hand.length).toBe(2);
    expect(state.players[0].hand.some((c) => c.id === keep.id)).toBe(true);
  });

  it("不挑就替你从前面拿,数目一样对得上", () => {
    const state = build([{ role: "lord", vigor: 1, hand: [slash(), slash(), dodge()] }, { role: "rebel" }]);
    run(endTurn(state, 0));
    expect(state.players[0].hand.length).toBe(1);
  });

  it("手牌不超上限就不用弃,一个请求都不发", () => {
    const state = build([{ role: "lord", hand: [slash()] }, { role: "rebel" }]);
    const { seen } = run(endTurn(state, 0));
    expect(seen.length).toBe(0);
  });

  it("厚积让墩墩多留一张", () => {
    const state = build([{ hero: "dundun", role: "lord", vigor: 2, hand: [slash(), slash(), dodge()] }, { role: "rebel" }]);
    run(endTurn(state, 0));
    expect(state.players[0].hand.length).toBe(3);
  });
});

describe("花主的赠花", () => {
  it("送满两张才回 1 点元气,一张不给回", () => {
    const state = build([
      { hero: "huazhu", role: "lord", vigor: 2, maxVigor: 5, hand: [slash(), slash(), dodge()] },
      { role: "loyal" }
    ]);
    expect(giftLeft(state, 0)).toBe(2);
    expect(giftCard(state, 0, 1, state.players[0].hand[0])).toBe(true);
    expect(state.players[0].vigor).toBe(2);
    expect(giftCard(state, 0, 1, state.players[0].hand[0])).toBe(true);
    expect(state.players[0].vigor).toBe(3);
    // 每回合上限两张,第三张就送不动了
    expect(giftLeft(state, 0)).toBe(0);
    expect(giftCard(state, 0, 1, state.players[0].hand[0])).toBe(false);
    expect(state.players[1].hand.length).toBe(2);
  });

  it("不是花主就一张也送不了", () => {
    const state = build([{ role: "lord", hand: [slash()] }, { role: "loyal" }]);
    expect(giftLeft(state, 0)).toBe(0);
    expect(giftCard(state, 0, 1, state.players[0].hand[0])).toBe(false);
  });

  it("赠花会在动作流水里记一笔「帮忙」", () => {
    const state = build([{ hero: "huazhu", role: "lord", hand: [slash()] }, { role: "loyal" }]);
    giftCard(state, 0, 1, state.players[0].hand[0]);
    expect(state.acts.some((a) => a.actor === 0 && a.target === 1 && a.kind === "help")).toBe(true);
  });
});

describe("动作流水", () => {
  it("打出去的攻击牌会被记成「不客气」,身份推理只看这个", () => {
    const state = build([
      { role: "lord", hand: [slash()] },
      { role: "rebel", hand: [dodge()] }
    ]);
    run(playCard(state, 0, state.players[0].hand[0], [1]), [(req) => ({ card: state.players[req.who].hand[0] })]);
    expect(state.acts).toContainEqual({ actor: 0, target: 1, kind: "hostile", round: 1 });
  });

  it("递蜜桃愈救人会被记成「帮忙」", () => {
    const state = build([
      { role: "rebel", hand: [slash()] },
      { role: "lord", vigor: 1 },
      { role: "loyal", hand: [heal()] }
    ]);
    run(playCard(state, 0, state.players[0].hand[0], [1]), [eager(state)]);
    expect(state.acts.some((a) => a.actor === 2 && a.target === 1 && a.kind === "help")).toBe(true);
  });
});

describe("响应牌的判断", () => {
  it("啾鸣让任意一张牌当盾,用过一次就不行了", () => {
    const state = build([{ role: "lord" }, { hero: "jiujiu", role: "rebel", hand: [slash()] }]);
    expect(usableAsDodge(state, 1, state.players[1].hand[0])).toBe(true);
    state.players[1].flags.chirp = 1;
    expect(usableAsDodge(state, 1, state.players[1].hand[0])).toBe(false);
  });

  it("疾闪让星星盾当花瓣击,普通人不行", () => {
    const state = build([{ hero: "shanshan", role: "lord", hand: [dodge()] }, { role: "rebel", hand: [dodge()] }]);
    expect(usableAsSlash(state, 0, state.players[0].hand[0])).toBe(true);
    expect(usableAsSlash(state, 1, state.players[1].hand[0])).toBe(false);
    expect(usableAsSlash(state, 1, slash())).toBe(true);
  });
});

describe("牌堆在局中抽空", () => {
  it("摸空了就把弃牌堆洗回来,摸牌不会摸出空手", () => {
    const state = build([{ role: "lord" }, { role: "rebel" }], { recipe: [{ kind: "slash", count: 6 }] });
    const all = drawCards(state, 0, 6);
    expect(all.length).toBe(6);
    expect(state.pile.deck.length).toBe(0);
    // 把手牌全丢进弃牌堆再摸,应该能洗回来
    state.players[0].hand = [];
    state.pile.discard.push(...all);
    expect(drawCards(state, 0, 3).length).toBe(3);
    expect(state.pile.recycles).toBe(1);
  });
});
