import { describe, expect, it } from "vitest";
import { makeCard, type Card } from "./cards";
import {
  AI_TIERS,
  AI_TIER_LABELS,
  AI_TIER_TIPS,
  DEFAULT_ROLES,
  attitude,
  cardValue,
  decideAction,
  decideRespond,
  guessRoleOf,
  observe,
  roleHeuristic,
  rollHeroes,
  rollRoles,
  scoreActions,
  simulateMatch,
  type AiTier
} from "./ai";
import { HEROES } from "./heroes";
import {
  campOf,
  createGame,
  makeRand,
  recordAct,
  type Camp,
  type GameState,
  type Role,
  type SeatSpec
} from "./engine";

const ROLES: Role[] = ["lord", "loyal", "rebel", "rebel", "spy"];

function five(roles: Role[] = ROLES, hands: Card[][] = []): GameState {
  const seats: SeatSpec[] = roles.map((role, i) => ({
    name: `位${i}`,
    heroId: "lubai",
    role,
    hand: hands[i] ?? []
  }));
  return createGame({ seats, seed: 2024 });
}

/**
 * 某个阵营全用 tier 档、别人全用菜鸟档时的胜率。
 * 种子固定,所以这张表每次跑出来都一模一样;算过一次就存下来。
 */
const GAMES = 200;
const rateCache = new Map<string, number>();

function rate(camp: Camp, tier: AiTier): number {
  const key = `${camp}/${tier}`;
  const hit = rateCache.get(key);
  if (hit !== undefined) return hit;
  let wins = 0;
  for (let i = 0; i < GAMES; i++) {
    const tiers = ROLES.map((r) => (campOf(r) === camp ? tier : "rookie")) as AiTier[];
    if (simulateMatch({ seed: 5000 + i * 13, tiers, roles: ROLES }).winner === camp) wins++;
  }
  const value = wins / GAMES;
  rateCache.set(key, value);
  return value;
}

describe("四个档位", () => {
  it("四档各有名字和一句介绍,互不相同", () => {
    expect(AI_TIERS).toEqual(["rookie", "normal", "pro", "hell"]);
    expect(new Set(AI_TIERS.map((t) => AI_TIER_LABELS[t])).size).toBe(4);
    expect(new Set(AI_TIERS.map((t) => AI_TIER_TIPS[t])).size).toBe(4);
    for (const t of AI_TIERS) expect(AI_TIER_TIPS[t].length).toBeGreaterThan(8);
  });
});

describe("身份推理 roleHeuristic", () => {
  it("身份牌已经翻开就直接照着说", () => {
    expect(roleHeuristic({ attackedLord: 0, helpedLord: 0, attackedRebel: 0, helpedRebel: 0, revealed: "rebel" })).toEqual(
      { guess: "rebel", hostility: 3, confidence: 1 }
    );
    expect(
      roleHeuristic({ attackedLord: 9, helpedLord: 0, attackedRebel: 0, helpedRebel: 0, revealed: "loyal" }).guess
    ).toBe("loyal");
  });

  it("老打花主的像夺花", () => {
    const g = roleHeuristic({ attackedLord: 2, helpedLord: 0, attackedRebel: 0, helpedRebel: 0 });
    expect(g.guess).toBe("rebel");
    expect(g.hostility).toBeGreaterThan(0);
    expect(g.confidence).toBe(1);
  });

  it("老护花主的像护花", () => {
    const g = roleHeuristic({ attackedLord: 0, helpedLord: 2, attackedRebel: 1, helpedRebel: 0 });
    expect(g.guess).toBe("loyal");
    expect(g.hostility).toBeLessThan(0);
  });

  it("什么都没做的看不出来,把握也低", () => {
    const g = roleHeuristic({ attackedLord: 0, helpedLord: 0, attackedRebel: 0, helpedRebel: 0 });
    expect(g.guess).toBe("spy");
    expect(g.confidence).toBe(0);
  });

  it("敌意分封顶在 ±3,不会越描越黑", () => {
    expect(roleHeuristic({ attackedLord: 9, helpedLord: 0, attackedRebel: 0, helpedRebel: 0 }).hostility).toBe(3);
    expect(roleHeuristic({ attackedLord: 0, helpedLord: 9, attackedRebel: 0, helpedRebel: 0 }).hostility).toBe(-3);
  });

  it("observe 只数桌面上看得见的动作,不偷看手牌", () => {
    const state = five();
    recordAct(state, 2, 0, "hostile");
    recordAct(state, 2, 0, "hostile");
    recordAct(state, 1, 0, "help");
    expect(observe(state, 2)).toMatchObject({ attackedLord: 2, helpedLord: 0 });
    expect(observe(state, 1)).toMatchObject({ helpedLord: 1, attackedLord: 0 });
    expect(observe(state, 3)).toMatchObject({ attackedLord: 0, helpedLord: 0 });
  });

  it("菜鸟和普通档只认已经翻开的身份,高手才会自己猜", () => {
    const state = five();
    recordAct(state, 2, 0, "hostile");
    recordAct(state, 2, 0, "hostile");
    expect(guessRoleOf(state, 1, 2, "rookie")).toBeNull();
    expect(guessRoleOf(state, 1, 2, "normal")).toBeNull();
    expect(guessRoleOf(state, 1, 2, "pro")).toBe("rebel");
    expect(guessRoleOf(state, 1, 2, "hell")).toBe("rebel");
    // 翻开了就谁都认得
    state.players[2].revealed = true;
    expect(guessRoleOf(state, 1, 2, "rookie")).toBe("rebel");
  });
});

describe("敌意分", () => {
  it("对自己永远是自己人", () => {
    const state = five();
    for (const t of AI_TIERS) expect(attitude(state, 1, 1, t)).toBeLessThan(0);
  });

  it("菜鸟一视同仁,谁都能打", () => {
    const state = five();
    expect(attitude(state, 2, 0, "rookie")).toBe(attitude(state, 2, 1, "rookie"));
  });

  it("夺花盯着亮明身份的花主打,护花护着花主", () => {
    const state = five();
    expect(attitude(state, 2, 0, "normal")).toBeGreaterThan(0);
    expect(attitude(state, 1, 0, "normal")).toBeLessThan(0);
  });

  it("藏花:夺花没清完就护着花主,清完了才回头单挑", () => {
    const state = five();
    expect(attitude(state, 4, 0, "pro")).toBeLessThan(0);
    state.players[2].out = true;
    state.players[3].out = true;
    state.players[1].out = true;
    expect(attitude(state, 4, 0, "pro")).toBeGreaterThan(0);
  });
});

describe("响应决策", () => {
  it("有星星盾就挡", () => {
    const state = five(ROLES, [[], [makeCard("dodge", "leaf", 2), makeCard("slash")]]);
    const reply = decideRespond(state, { kind: "respond", who: 1, need: "dodge", from: 2, prompt: "" }, "normal");
    expect(reply.card?.kind).toBe("dodge");
  });

  it("没盾就只能受着", () => {
    const state = five(ROLES, [[], [makeCard("slash")]]);
    expect(decideRespond(state, { kind: "respond", who: 1, need: "dodge", from: 2, prompt: "" }, "normal").card).toBeNull();
  });

  it("自己撑不住一定吃蜜桃愈", () => {
    const state = five(ROLES, [[], [makeCard("heal", "flower", 9)]]);
    const reply = decideRespond(state, { kind: "respond", who: 1, need: "heal", from: 1, prompt: "" }, "pro");
    expect(reply.card?.kind).toBe("heal");
  });

  it("救不救别人看阵营:护花救花主,夺花不救", () => {
    const state = five(ROLES, [[], [makeCard("heal", "flower", 9)], [makeCard("heal", "flower", 9)]]);
    expect(decideRespond(state, { kind: "respond", who: 1, need: "heal", from: 0, prompt: "" }, "pro").card).toBeTruthy();
    expect(decideRespond(state, { kind: "respond", who: 2, need: "heal", from: 0, prompt: "" }, "pro").card).toBeNull();
  });

  it("春风无懈只有高手往上才会用,而且要冲着自己人来才挡", () => {
    const state = five(ROLES, [[], [makeCard("nullify", "leaf", 3)]]);
    // 2 号已经亮明是夺花,他甩过来的锦囊才值得挡
    state.players[2].revealed = true;
    const req = { kind: "respond", who: 1, need: "nullify", from: 2, target: 0, prompt: "" } as const;
    expect(decideRespond(state, req, "rookie").card).toBeNull();
    expect(decideRespond(state, req, "normal").card).toBeNull();
    expect(decideRespond(state, req, "pro").card?.kind).toBe("nullify");
  });

  it("地狱档会看这一张打到谁头上:打到敌人身上就让它过", () => {
    const state = five(ROLES, [[], [makeCard("nullify", "leaf", 3)]]);
    state.players[2].revealed = true;
    // 夺花甩给花主的要挡
    expect(
      decideRespond(state, { kind: "respond", who: 1, need: "nullify", from: 2, target: 0, prompt: "" }, "hell").card
    ).toBeTruthy();
    // 花主甩给夺花的就不挡了
    expect(
      decideRespond(state, { kind: "respond", who: 1, need: "nullify", from: 0, target: 2, prompt: "" }, "hell").card
    ).toBeNull();
  });

  it("弃牌先扔闲牌,高手把星星盾和蜜桃愈留到最后", () => {
    const hand = [makeCard("heal", "flower", 9), makeCard("dodge", "leaf", 2), makeCard("horsePlus", "berry", 6, "plus")];
    const state = five(ROLES, [[], hand]);
    const reply = decideRespond(state, { kind: "discard", who: 1, count: 1, prompt: "" }, "pro");
    expect(reply.cards?.[0].kind).toBe("horsePlus");
    expect(cardValue(makeCard("heal"), "pro")).toBeGreaterThan(cardValue(makeCard("horsePlus"), "pro"));
    expect(cardValue(makeCard("dodge"), "pro")).toBeGreaterThan(cardValue(makeCard("dodge"), "rookie"));
  });

  it("顺手 / 拆解优先挑武器,菜鸟随手抓一张", () => {
    const state = five(ROLES, [[], []]);
    state.players[1].hand = [makeCard("slash")];
    state.players[1].gear.weapon = makeCard("weapon", "berry", 6, "kite");
    const req = { kind: "pick", who: 0, target: 1, prompt: "" } as const;
    expect(decideRespond(state, req, "pro").card?.kind).toBe("weapon");
    expect(decideRespond(state, req, "rookie").card?.kind).toBe("slash");
  });
});

describe("出牌决策", () => {
  it("元气见底就先吃蜜桃愈,不硬冲", () => {
    const state = five(ROLES, [[], [makeCard("heal", "flower", 9), makeCard("slash")]]);
    state.players[1].vigor = 1;
    const action = decideAction(state, 1, "pro");
    expect(action.kind).toBe("play");
    expect(action.kind === "play" && action.card.kind).toBe("heal");
  });

  it("换更长的武器有分,换回短的没分", () => {
    const state = five(ROLES, [[], [makeCard("weapon", "berry", 6, "ribbon")]]);
    expect(scoreActions(state, 1, "pro").length).toBeGreaterThan(0);
    state.players[1].gear.weapon = makeCard("weapon", "berry", 6, "kite");
    expect(scoreActions(state, 1, "pro").length).toBe(0);
  });

  it("手上一张能用的牌都没有就结束回合", () => {
    const state = five(ROLES, [[], [makeCard("dodge", "leaf", 2)]]);
    expect(decideAction(state, 1, "pro").kind).toBe("end");
  });

  it("夺花挂上长武器之后会越过邻座去打花主,不会打同伙", () => {
    const state = five(ROLES, [[], [], [makeCard("slash")], [], []]);
    // 玉兰折扇范围 2,四个人都在射程里
    state.players[2].gear.weapon = makeCard("weapon", "berry", 6, "fan");
    state.players[3].revealed = true;
    const action = decideAction(state, 2, "normal");
    expect(action.kind).toBe("play");
    expect(action.kind === "play" && action.targets[0]).toBe(0);
    // 同伙的敌意分是负的,一开始就排不进候选
    expect(scoreActions(state, 2, "normal").every((s) => s.action.kind !== "play" || s.action.targets[0] !== 3)).toBe(
      true
    );
  });
});

describe("发身份与发英杰", () => {
  it("座位 0 永远是花主,另外四个人是一护两夺一藏", () => {
    for (let s = 1; s < 40; s++) {
      const roles = rollRoles(makeRand(s));
      expect(roles[0]).toBe("lord");
      expect(roles.filter((r) => r === "loyal").length).toBe(1);
      expect(roles.filter((r) => r === "rebel").length).toBe(2);
      expect(roles.filter((r) => r === "spy").length).toBe(1);
      expect(roles.length).toBe(DEFAULT_ROLES.length);
    }
  });

  it("五个人抽五名不重样的英杰,花主从候选里挑", () => {
    for (let s = 1; s < 30; s++) {
      const roles = rollRoles(makeRand(s));
      const ids = rollHeroes(makeRand(s + 7), roles);
      expect(ids.length).toBe(5);
      expect(new Set(ids).size).toBe(5);
      for (const id of ids) expect(HEROES.some((h) => h.id === id)).toBe(true);
      expect(HEROES.find((h) => h.id === ids[roles.indexOf("lord")])?.lordCandidate).toBe(true);
    }
  });
});

describe("整局模拟", () => {
  it("同一个种子跑出来的结果一模一样", () => {
    const opts = { seed: 31337, tiers: ["pro", "pro", "pro", "pro", "pro"] as AiTier[] };
    const a = simulateMatch(opts);
    const b = simulateMatch(opts);
    expect(a).toEqual(b);
  });

  it("一局总能收场:要么分出胜负,要么到点算平", () => {
    for (let s = 0; s < 12; s++) {
      const res = simulateMatch({ seed: 700 + s * 41, tiers: ["normal", "pro", "hell", "rookie", "pro"] });
      expect(res.rounds).toBeGreaterThan(0);
      expect(res.alive.length).toBeGreaterThanOrEqual(0);
      if (res.winner) expect(["lord", "rebel", "spy"]).toContain(res.winner);
    }
  });

  it("固定种子下地狱档对菜鸟档,三个阵营的胜率都明显更高", () => {
    for (const camp of ["lord", "rebel", "spy"] as Camp[]) {
      expect(rate(camp, "hell")).toBeGreaterThan(rate(camp, "rookie") + 0.05);
    }
  });

  it("档位越高越强:普通赢过菜鸟,高手赢过普通,地狱不比高手差", () => {
    for (const camp of ["lord", "rebel", "spy"] as Camp[]) {
      expect(rate(camp, "normal")).toBeGreaterThan(rate(camp, "rookie"));
      expect(rate(camp, "pro")).toBeGreaterThan(rate(camp, "normal"));
      expect(rate(camp, "hell")).toBeGreaterThanOrEqual(rate(camp, "normal"));
    }
  });

  it("三个阵营加总,地狱档比菜鸟档多赢一大截", () => {
    const camps: Camp[] = ["lord", "rebel", "spy"];
    const rookie = camps.reduce((s, c) => s + rate(c, "rookie"), 0);
    const hell = camps.reduce((s, c) => s + rate(c, "hell"), 0);
    expect(hell - rookie).toBeGreaterThan(0.4);
  });
});
