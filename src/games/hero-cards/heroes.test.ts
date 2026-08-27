import { describe, expect, it } from "vitest";
import { makeCard, type Card } from "./cards";
import {
  HEROES,
  HERO_IDS,
  heroOf,
  hasSkill,
  lordCandidates,
  queryFlag,
  queryNumber,
  trigger,
  twoSkillHeroes,
  useCount,
  type HeroEvent
} from "./heroes";
import { createGame, type GameState, type SeatSpec } from "./engine";

/** 摆一桌指定英杰的局面,座位 0 是主公 */
function table(heroIds: string[], hands: Card[][] = []): GameState {
  const seats: SeatSpec[] = heroIds.map((heroId, i) => ({
    name: `位${i}`,
    heroId,
    role: i === 0 ? "lord" : i === 1 ? "loyal" : "rebel",
    hand: hands[i] ?? []
  }));
  return createGame({ seats, seed: 1234 });
}

/** 只问某一名英杰的技能,不掺别人 */
function ask(heroId: string, event: HeroEvent, self = 0): ReturnType<typeof trigger> {
  const state = table([heroId, "lubai", "lubai"]);
  const out: ReturnType<typeof trigger> = [];
  for (const skill of heroOf(heroId).skills) out.push(...skill.onEvent(state, event, self));
  return out;
}

describe("英杰名册", () => {
  it("至少 12 名原创英杰,id 与名字都不重样", () => {
    expect(HEROES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(HERO_IDS).size).toBe(HEROES.length);
    expect(new Set(HEROES.map((h) => h.name)).size).toBe(HEROES.length);
  });

  it("每名英杰都有 1–2 个技能、一句人设和合理的元气上限", () => {
    for (const h of HEROES) {
      expect(h.skills.length).toBeGreaterThanOrEqual(1);
      expect(h.skills.length).toBeLessThanOrEqual(2);
      expect(h.vigor).toBeGreaterThanOrEqual(3);
      expect(h.vigor).toBeLessThanOrEqual(4);
      expect(h.blurb.length).toBeGreaterThan(4);
      for (const s of h.skills) expect(s.desc.length).toBeGreaterThan(6);
    }
  });

  it("技能名与技能 id 全局不重样", () => {
    const ids = HEROES.flatMap((h) => h.skills.map((s) => s.id));
    const names = HEROES.flatMap((h) => h.skills.map((s) => s.name));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("有主公候选,也有两个技能的英杰给第五章用", () => {
    expect(lordCandidates().length).toBeGreaterThanOrEqual(1);
    expect(twoSkillHeroes().length).toBeGreaterThanOrEqual(2);
  });

  it("技能文案只说元气花瓣,不写死亡流血", () => {
    const all = HEROES.map((h) => `${h.name}${h.blurb}${h.skills.map((s) => s.name + s.desc).join("")}`).join("");
    for (const bad of ["死", "血", "杀", "斩", "命"]) expect(all).not.toContain(bad);
  });

  it("查不到的 id 退回第一名英杰,不会炸", () => {
    expect(heroOf("没有这个人").id).toBe(HEROES[0].id);
  });
});

describe("十四名英杰各来一条", () => {
  it("花主·赠花:出牌阶段能送两张手牌", () => {
    expect(ask("huazhu", { kind: "giftLimit", who: 0, base: 0 })).toEqual([{ kind: "delta", n: 2 }]);
    expect(ask("huazhu", { kind: "giftLimit", who: 1, base: 0 })).toEqual([]);
  });

  it("星督·星辉:每回合一次靠判定当挡,用过就不给了", () => {
    const state = table(["xingdu", "lubai", "lubai"]);
    expect(queryFlag(state, { kind: "judgeDodge", who: 0 })).toBe(true);
    state.players[0].flags.starlight = 1;
    expect(queryFlag(state, { kind: "judgeDodge", who: 0 })).toBe(false);
    expect(useCount(state, 0, "starlight")).toBe(1);
  });

  it("豆将·豪掷:红门的花瓣击挡不下来,黑门的照挡", () => {
    const red = makeCard("slash", "flower");
    const black = makeCard("slash", "leaf");
    expect(ask("doujiang", { kind: "unblockable", who: 0, card: red })).toEqual([{ kind: "flag" }]);
    expect(ask("doujiang", { kind: "unblockable", who: 0, card: black })).toEqual([]);
  });

  it("云牧·牧云:谁让他掉元气就顺谁一张牌,自己弄掉的不算", () => {
    expect(ask("yunmu", { kind: "damaged", who: 0, from: 2, amount: 1 })).toEqual([
      { kind: "steal", who: 0, from: 2, n: 1 }
    ]);
    expect(ask("yunmu", { kind: "damaged", who: 0, from: null, amount: 1 })).toEqual([]);
    expect(ask("yunmu", { kind: "damaged", who: 0, from: 0, amount: 1 })).toEqual([]);
  });

  it("糯糯·软糯:打出一张星星盾就摸一张", () => {
    expect(ask("nuonuo", { kind: "afterDodge", who: 0 })).toEqual([{ kind: "draw", who: 0, n: 1 }]);
    expect(ask("nuonuo", { kind: "afterDodge", who: 1 })).toEqual([]);
  });

  it("墩墩·铁墩 + 厚积:群体锦囊对他没用,手牌上限还 +1", () => {
    expect(ask("dundun", { kind: "groupTrick", who: 0, card: "petalStorm" })).toEqual([{ kind: "flag" }]);
    expect(ask("dundun", { kind: "handLimit", who: 0, base: 3 })).toEqual([{ kind: "delta", n: 1 }]);
    const state = table(["dundun", "lubai", "lubai"]);
    expect(queryNumber(state, { kind: "handLimit", who: 0, base: 3 })).toBe(4);
  });

  it("闪闪·疾闪 + 轻身:盾能当击用,别人算她的距离 +1", () => {
    expect(ask("shanshan", { kind: "dodgeAsSlash", who: 0 })).toEqual([{ kind: "flag" }]);
    expect(ask("shanshan", { kind: "distanceTo", who: 0, base: 0 })).toEqual([{ kind: "delta", n: 1 }]);
  });

  it("绿绿豆·藤蔓:顺手摘花的距离要求放宽到 2", () => {
    const state = table(["lvdou", "lubai", "lubai"]);
    expect(queryNumber(state, { kind: "snatchRange", who: 0, base: 1 })).toBe(2);
    expect(queryNumber(state, { kind: "snatchRange", who: 1, base: 1 })).toBe(1);
  });

  it("啾啾·啾鸣:每回合一次任意牌当盾,用过就没了", () => {
    const state = table(["jiujiu", "lubai", "lubai"]);
    expect(queryFlag(state, { kind: "anyAsDodge", who: 0 })).toBe(true);
    state.players[0].flags.chirp = 1;
    expect(queryFlag(state, { kind: "anyAsDodge", who: 0 })).toBe(false);
  });

  it("星星·星愿:多摸一张,手牌上限却少一张", () => {
    const state = table(["xingxing", "lubai", "lubai"]);
    expect(queryNumber(state, { kind: "drawPhase", who: 0, base: 2 })).toBe(3);
    expect(queryNumber(state, { kind: "handLimit", who: 0, base: 4 })).toBe(3);
  });

  it("朵朵·花开:元气归零时弃两张回 1 点,每局只有一次,手牌不够也开不了", () => {
    const two = [makeCard("slash"), makeCard("dodge")];
    const state = table(["duoduo", "lubai", "lubai"], [two]);
    expect(trigger(state, { kind: "dying", who: 0 })).toEqual([{ kind: "bloom", who: 0 }]);
    state.players[0].flags.bloomAgain = 1;
    expect(trigger(state, { kind: "dying", who: 0 })).toEqual([]);
    state.players[0].flags.bloomAgain = 0;
    state.players[0].hand = [makeCard("slash")];
    expect(trigger(state, { kind: "dying", who: 0 })).toEqual([]);
  });

  it("霜叶·霜锋:每回合一次让自己的击要两张盾", () => {
    const state = table(["shuangye", "lubai", "lubai"]);
    expect(queryNumber(state, { kind: "dodgeNeeded", who: 0, target: 1, base: 1 })).toBe(2);
    state.players[0].flags.frostEdge = 1;
    expect(queryNumber(state, { kind: "dodgeNeeded", who: 0, target: 1, base: 1 })).toBe(1);
  });

  it("露白·凝露:能改判定", () => {
    expect(ask("lubai", { kind: "judgeSwap", who: 0 })).toEqual([{ kind: "flag" }]);
    expect(ask("lubai", { kind: "judgeSwap", who: 1 })).toEqual([]);
  });

  it("风铃·铃响:桌上任何一件装备离场她都摸一张", () => {
    const state = table(["lubai", "fengling", "lubai"]);
    expect(trigger(state, { kind: "gearLost", who: -1 })).toEqual([{ kind: "draw", who: 1, n: 1 }]);
  });
});

describe("事件分发", () => {
  it("退场休息的人不再响应任何事件", () => {
    const state = table(["dundun", "dundun", "lubai"]);
    expect(queryNumber(state, { kind: "handLimit", who: 0, base: 3 })).toBe(4);
    state.players[0].out = true;
    expect(queryNumber(state, { kind: "handLimit", who: 0, base: 3 })).toBe(3);
  });

  it("数值询问是各家修正累加,布尔询问是有人举手就算", () => {
    const state = table(["xingxing", "dundun", "lubai"]);
    // 星星 -1、墩墩 +1,只有星星那条对得上 who=0
    expect(queryNumber(state, { kind: "handLimit", who: 0, base: 5 })).toBe(4);
    expect(queryFlag(state, { kind: "groupTrick", who: 1, card: "starShower" })).toBe(true);
    expect(queryFlag(state, { kind: "groupTrick", who: 0, card: "starShower" })).toBe(false);
  });

  it("hasSkill 认得出谁带着哪个技能", () => {
    const state = table(["huazhu", "jiujiu", "lubai"]);
    expect(hasSkill(state, 0, "gift")).toBe(true);
    expect(hasSkill(state, 0, "chirp")).toBe(false);
    expect(hasSkill(state, 1, "chirp")).toBe(true);
    expect(hasSkill(state, 9, "chirp")).toBe(false);
  });

  it("技能是纯函数:问一百遍局面一个字都不变", () => {
    const state = table(["huazhu", "yunmu", "shuangye"]);
    const before = JSON.stringify(state.players.map((p) => ({ v: p.vigor, h: p.hand.length, f: p.flags })));
    for (let i = 0; i < 100; i++) {
      queryNumber(state, { kind: "handLimit", who: i % 3, base: 3 });
      queryFlag(state, { kind: "anyAsDodge", who: i % 3 });
      trigger(state, { kind: "damaged", who: 1, from: 0, amount: 1 });
    }
    expect(JSON.stringify(state.players.map((p) => ({ v: p.vigor, h: p.hand.length, f: p.flags })))).toBe(before);
  });
});
