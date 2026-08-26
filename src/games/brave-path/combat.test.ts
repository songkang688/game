import { describe, expect, it } from "vitest";
import {
  BAG_SLOTS,
  BREAKER_SHIELD_MULTIPLIER,
  DEFAULT_CRIT_MULTIPLIER,
  ELEMENTS,
  GUARD_REDUCE,
  MAX_SINGLE_HIT_RATIO,
  MIN_DAMAGE,
  NEUTRAL_MULTIPLIER,
  RESIST_MULTIPLIER,
  SKILLS,
  STRONG_MULTIPLIER,
  WEAKNESS_BONUS,
  type Action,
  type Fighter,
  type FighterSpec,
  actionAllowed,
  affinityHint,
  clampChance,
  cloneState,
  computeDamage,
  effectiveAtk,
  elementMultiplier,
  hpRatio,
  itemCount,
  judgeByHp,
  makeFighter,
  mulberry32,
  planFoeAction,
  planHeroAction,
  readySkills,
  resolveRound,
  rollCrit,
  simulateBattle,
  simulateScript,
  simulateTeamBattle,
  skillPowerAtRank,
  skillReady,
  startCombat
} from "./combat";

/* ------------------------------------------------------------------ */
/* 测试小工具                                                          */
/* ------------------------------------------------------------------ */

/** 永远不暴击的随机数（rollCrit 用 roll < chance，0.999 大于任何合理暴击率） */
const noCrit = (): number => 0.999;
/** 永远暴击 */
const alwaysCrit = (): number => 0;
/** 不暴击、也不让小怪去摆防御姿态（planFoeAction 的分界点在 0.5 与 0.88） */
const plainAttack = (): number => 0.6;

function hero(over: Partial<FighterSpec> = {}): Fighter {
  return makeFighter({
    name: "朵朵",
    emoji: "🌸",
    element: "grass",
    maxHp: 120,
    atk: 30,
    def: 10,
    spd: 12,
    crit: 0,
    ...over
  });
}

function dummy(over: Partial<FighterSpec> = {}): Fighter {
  return makeFighter({
    name: "蹦蹦草团",
    emoji: "🌱",
    element: "grass",
    maxHp: 100,
    atk: 12,
    def: 5,
    spd: 5,
    crit: 0,
    ...over
  });
}

/* ------------------------------------------------------------------ */
/* 1. 属性克制                                                          */
/* ------------------------------------------------------------------ */

describe("属性克制", () => {
  it("火→草、草→水、水→火 是三角克制，倍率 1.5", () => {
    expect(elementMultiplier("fire", "grass")).toBe(STRONG_MULTIPLIER);
    expect(elementMultiplier("grass", "water")).toBe(STRONG_MULTIPLIER);
    expect(elementMultiplier("water", "fire")).toBe(STRONG_MULTIPLIER);
  });

  it("反过来打就被克制，倍率 0.75", () => {
    expect(elementMultiplier("grass", "fire")).toBe(RESIST_MULTIPLIER);
    expect(elementMultiplier("water", "grass")).toBe(RESIST_MULTIPLIER);
    expect(elementMultiplier("fire", "water")).toBe(RESIST_MULTIPLIER);
  });

  it("光和暗互相克制，两个方向都是 1.5", () => {
    expect(elementMultiplier("light", "dark")).toBe(STRONG_MULTIPLIER);
    expect(elementMultiplier("dark", "light")).toBe(STRONG_MULTIPLIER);
  });

  it("同系互打与光暗对三角系都是 1 倍", () => {
    for (const e of ELEMENTS) expect(elementMultiplier(e, e)).toBe(NEUTRAL_MULTIPLIER);
    expect(elementMultiplier("light", "fire")).toBe(NEUTRAL_MULTIPLIER);
    expect(elementMultiplier("dark", "water")).toBe(NEUTRAL_MULTIPLIER);
    expect(elementMultiplier("grass", "light")).toBe(NEUTRAL_MULTIPLIER);
  });

  it("克制倍率直接作用在伤害上：克制比中性高、被克制比中性低", () => {
    const common = { atk: 40, def: 0, power: 1, defendElement: "grass" as const };
    const strong = computeDamage({ ...common, attackElement: "fire" }).hpDamage;
    const neutral = computeDamage({ ...common, attackElement: "light" }).hpDamage;
    const weak = computeDamage({ ...common, attackElement: "water" }).hpDamage;
    expect(strong).toBe(60);
    expect(neutral).toBe(40);
    expect(weak).toBe(30);
    expect(strong).toBeGreaterThan(neutral);
    expect(neutral).toBeGreaterThan(weak);
  });

  it("界面提示语跟着倍率走", () => {
    expect(affinityHint("fire", "grass")).toContain("克制");
    expect(affinityHint("grass", "fire")).toContain("被克制");
    expect(affinityHint("fire", "light")).toContain("不吃亏");
  });
});

/* ------------------------------------------------------------------ */
/* 2. 暴击边界                                                          */
/* ------------------------------------------------------------------ */

describe("暴击边界", () => {
  it("roll 严格小于暴击率才暴击，正好相等不算", () => {
    expect(rollCrit(0.3, 0.2999)).toBe(true);
    expect(rollCrit(0.3, 0.3)).toBe(false);
    expect(rollCrit(0.3, 0.3001)).toBe(false);
  });

  it("暴击率 0 永远不暴击，暴击率 1 永远暴击", () => {
    expect(rollCrit(0, 0)).toBe(false);
    expect(rollCrit(0, -1)).toBe(false);
    expect(rollCrit(1, 0.999999)).toBe(true);
  });

  it("暴击率被夹在 0..1，脏数据当 0", () => {
    expect(clampChance(-0.5)).toBe(0);
    expect(clampChance(3)).toBe(1);
    expect(clampChance(Number.NaN)).toBe(0);
    expect(rollCrit(2, 0.99)).toBe(true);
    expect(rollCrit(Number.NaN, 0)).toBe(false);
  });

  it("暴击按倍率放大伤害，默认 1.8 倍", () => {
    const base = computeDamage({ atk: 40, def: 0, power: 1, attackElement: "light", defendElement: "fire" });
    const crit = computeDamage({
      atk: 40,
      def: 0,
      power: 1,
      attackElement: "light",
      defendElement: "fire",
      crit: true
    });
    expect(base.hpDamage).toBe(40);
    expect(crit.hpDamage).toBe(Math.round(40 * DEFAULT_CRIT_MULTIPLIER));
    expect(crit.crit).toBe(true);
  });

  it("暴击是先乘倍率再减防御，不是减完再乘", () => {
    // 先乘：round(50 * 2) - 20 = 80；先减再乘会是 (50-20)*2 = 60
    const r = computeDamage({
      atk: 50,
      def: 20,
      power: 1,
      attackElement: "light",
      defendElement: "fire",
      crit: true,
      critMultiplier: 2
    });
    expect(r.hpDamage).toBe(80);
  });
});

/* ------------------------------------------------------------------ */
/* 3. 防御减伤                                                          */
/* ------------------------------------------------------------------ */

describe("防御减伤", () => {
  it("防御力是实打实减掉的固定值", () => {
    expect(computeDamage({ atk: 50, def: 0, power: 1, attackElement: "light", defendElement: "fire" }).hpDamage).toBe(50);
    expect(computeDamage({ atk: 50, def: 18, power: 1, attackElement: "light", defendElement: "fire" }).hpDamage).toBe(32);
  });

  it("摆出防御姿态再砍一半", () => {
    const normal = computeDamage({ atk: 50, def: 10, power: 1, attackElement: "light", defendElement: "fire" });
    const guarded = computeDamage({
      atk: 50,
      def: 10,
      power: 1,
      attackElement: "light",
      defendElement: "fire",
      guarding: true
    });
    expect(normal.hpDamage).toBe(40);
    expect(guarded.hpDamage).toBe(Math.floor(40 * GUARD_REDUCE));
    expect(guarded.guarded).toBe(true);
  });

  it("防御再厚也至少掉 1 点星芒，战斗不会卡死", () => {
    const r = computeDamage({ atk: 5, def: 999, power: 1, attackElement: "light", defendElement: "fire" });
    expect(r.hpDamage).toBe(MIN_DAMAGE);
    const g = computeDamage({
      atk: 5,
      def: 999,
      power: 1,
      attackElement: "light",
      defendElement: "fire",
      guarding: true
    });
    expect(g.hpDamage).toBe(MIN_DAMAGE);
  });

  it("一下打不空：给了勇者的星芒上限，单次命中就削不过 45%", () => {
    const wild = computeDamage({
      atk: 400,
      def: 0,
      power: 3,
      attackElement: "fire",
      defendElement: "grass",
      crit: true
    });
    const held = computeDamage({
      atk: 400,
      def: 0,
      power: 3,
      attackElement: "fire",
      defendElement: "grass",
      crit: true,
      defendMaxHp: 500
    });
    expect(wild.hpDamage).toBeGreaterThan(500 * MAX_SINGLE_HIT_RATIO);
    expect(held.hpDamage).toBe(Math.floor(500 * MAX_SINGLE_HIT_RATIO));
  });

  it("保险不会把小打小闹也削掉：本来就没到上限的一下原样通过", () => {
    const small = computeDamage({
      atk: 30,
      def: 5,
      power: 1,
      attackElement: "light",
      defendElement: "fire",
      defendMaxHp: 500
    });
    expect(small.hpDamage).toBe(25);
  });

  it("保险之后再算防御，所以顶着上限的一下，防御照样能砍一半", () => {
    const cap = Math.floor(400 * MAX_SINGLE_HIT_RATIO);
    const bare = computeDamage({
      atk: 400,
      def: 0,
      power: 3,
      attackElement: "fire",
      defendElement: "grass",
      crit: true,
      defendMaxHp: 400
    });
    const guarded = computeDamage({
      atk: 400,
      def: 0,
      power: 3,
      attackElement: "fire",
      defendElement: "grass",
      crit: true,
      defendMaxHp: 400,
      guarding: true
    });
    expect(bare.hpDamage).toBe(cap);
    expect(guarded.hpDamage).toBe(Math.floor(cap * GUARD_REDUCE));
    expect(guarded.hpDamage).toBeLessThan(bare.hpDamage);
  });

  it("满状态的勇者绝不会被一回合打空，怎么倒霉都还剩一口气", () => {
    const glass = hero({ maxHp: 200, def: 0, spd: 1, skills: [], bag: [] });
    const bully = dummy({
      element: "fire",
      maxHp: 4000,
      atk: 500,
      spd: 99,
      crit: 1,
      skills: [{ id: "emberDance", rank: 5 }]
    });
    const r = resolveRound(startCombat(glass, bully), { kind: "attack" }, alwaysCrit);
    expect(r.state.hero.hp).toBeGreaterThan(0);
    expect(r.state.over).toBe(false);
  });

  it("保险只护勇者：小怪该被一口气打退还是被打退", () => {
    const strong = hero({ atk: 400, spd: 99, element: "fire", skills: [], bag: [] });
    const twig = dummy({ element: "grass", maxHp: 120, def: 0, spd: 1, skills: [] });
    const r = resolveRound(startCombat(strong, twig), { kind: "attack" }, alwaysCrit);
    expect(r.state.foe.hp).toBe(0);
    expect(r.state.winner).toBe("hero");
  });

  it("防御能挡下 Boss 大招的一大半", () => {
    const raw = computeDamage({ atk: 60, def: 12, power: 2.2, attackElement: "light", defendElement: "fire" });
    const held = computeDamage({
      atk: 60,
      def: 12,
      power: 2.2,
      attackElement: "light",
      defendElement: "fire",
      guarding: true
    });
    expect(held.hpDamage).toBeLessThan(raw.hpDamage);
    expect(held.hpDamage).toBe(Math.floor(raw.hpDamage * GUARD_REDUCE));
  });

  it("在回合里按下防御，不管谁先手都能减伤", () => {
    // 对手速度更快，先动手；防御依然生效
    const fast = dummy({ spd: 99, atk: 40, def: 0, skills: [] });
    const me = hero({ spd: 1, def: 0, crit: 0 });
    const open = resolveRound(startCombat(me, fast), { kind: "attack" }, plainAttack);
    const held = resolveRound(startCombat(me, fast), { kind: "guard" }, plainAttack);
    expect(held.state.hero.hp).toBeGreaterThan(open.state.hero.hp);
  });
});

/* ------------------------------------------------------------------ */
/* 4. 护盾与破盾                                                        */
/* ------------------------------------------------------------------ */

describe("护盾与破盾", () => {
  it("护盾先吃伤害，没打穿就一点星芒都不掉", () => {
    const r = computeDamage({ atk: 30, def: 0, power: 1, attackElement: "light", defendElement: "fire", shield: 100 });
    expect(r.shieldDamage).toBe(30);
    expect(r.shieldLeft).toBe(70);
    expect(r.hpDamage).toBe(0);
    expect(r.shieldBroken).toBe(false);
  });

  it("打碎护盾后溢出的部分才落到星芒上", () => {
    const r = computeDamage({ atk: 50, def: 0, power: 1, attackElement: "light", defendElement: "fire", shield: 20 });
    expect(r.shieldBroken).toBe(true);
    expect(r.shieldLeft).toBe(0);
    expect(r.hpDamage).toBe(30);
  });

  it("破盾招打在护盾上是双倍", () => {
    const r = computeDamage({
      atk: 30,
      def: 0,
      power: 1,
      attackElement: "light",
      defendElement: "fire",
      shield: 100,
      shieldMultiplier: BREAKER_SHIELD_MULTIPLIER
    });
    expect(r.shieldDamage).toBe(60);
    expect(r.shieldLeft).toBe(40);
  });

  it("穿透招无视护盾直接打星芒，护盾一点不少", () => {
    const r = computeDamage({
      atk: 30,
      def: 0,
      power: 1,
      attackElement: "light",
      defendElement: "fire",
      shield: 100,
      pierce: true
    });
    expect(r.hpDamage).toBe(30);
    expect(r.shieldLeft).toBe(100);
    expect(r.shieldDamage).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 5. 弱点                                                              */
/* ------------------------------------------------------------------ */

describe("Boss 弱点系", () => {
  it("打中弱点额外加成 1.4 倍，并标记 weakHit", () => {
    const plain = computeDamage({ atk: 40, def: 0, power: 1, attackElement: "fire", defendElement: "light" });
    const weak = computeDamage({
      atk: 40,
      def: 0,
      power: 1,
      attackElement: "fire",
      defendElement: "light",
      weakness: "fire"
    });
    expect(plain.weakHit).toBe(false);
    expect(weak.weakHit).toBe(true);
    expect(weak.hpDamage).toBe(Math.round(40 * WEAKNESS_BONUS));
  });

  it("弱点加成会和克制倍率叠乘", () => {
    const r = computeDamage({
      atk: 40,
      def: 0,
      power: 1,
      attackElement: "fire",
      defendElement: "grass",
      weakness: "fire"
    });
    expect(r.hpDamage).toBe(Math.round(40 * STRONG_MULTIPLIER * WEAKNESS_BONUS));
  });

  it("打的不是弱点系就没有加成", () => {
    const r = computeDamage({
      atk: 40,
      def: 0,
      power: 1,
      attackElement: "water",
      defendElement: "light",
      weakness: "fire"
    });
    expect(r.weakHit).toBe(false);
    expect(r.hpDamage).toBe(40);
  });
});

/* ------------------------------------------------------------------ */
/* 6. 技能与冷却                                                        */
/* ------------------------------------------------------------------ */

describe("技能与冷却", () => {
  it("技能等级每级提升 8% 倍率，最高 5 级", () => {
    const s = SKILLS.petalSlash;
    expect(skillPowerAtRank(s, 1)).toBeCloseTo(s.power, 5);
    expect(skillPowerAtRank(s, 3)).toBeCloseTo(s.power * 1.16, 5);
    expect(skillPowerAtRank(s, 99)).toBeCloseTo(skillPowerAtRank(s, 5), 5);
  });

  it("放完技能立刻进冷却，凉够回合数才能再放", () => {
    const me = hero({ skills: [{ id: "petalSlash", rank: 1 }] }); // 冷却 2
    let st = startCombat(me, dummy({ maxHp: 9999, atk: 1, skills: [] }));
    expect(skillReady(st.hero, "petalSlash")).toBe(true);
    st = resolveRound(st, { kind: "skill", skillId: "petalSlash" }, noCrit).state;
    expect(skillReady(st.hero, "petalSlash")).toBe(false);
    st = resolveRound(st, { kind: "attack" }, noCrit).state;
    expect(skillReady(st.hero, "petalSlash")).toBe(false);
    st = resolveRound(st, { kind: "attack" }, noCrit).state;
    expect(skillReady(st.hero, "petalSlash")).toBe(true);
  });

  it("冷却中硬按技能会自动改成普通攻击，不会白白浪费一回合", () => {
    const me = hero({ skills: [{ id: "petalSlash", rank: 1 }] });
    let st = startCombat(me, dummy({ maxHp: 9999, atk: 1, skills: [] }));
    st = resolveRound(st, { kind: "skill", skillId: "petalSlash" }, noCrit).state;
    const before = st.foe.hp;
    const res = resolveRound(st, { kind: "skill", skillId: "petalSlash" }, noCrit);
    expect(res.events.some((e) => e.kind === "cooling")).toBe(true);
    expect(res.state.foe.hp).toBeLessThan(before);
  });

  it("没学过的技能不算准备好，readySkills 只列上阵学过的", () => {
    const me = hero({ skills: [{ id: "petalSlash", rank: 1 }, { id: "warmSong", rank: 1 }] });
    expect(readySkills(me).sort()).toEqual(["petalSlash", "warmSong"]);
    expect(skillReady(me, "sunBloom")).toBe(false);
    expect(actionAllowed(me, { kind: "skill", skillId: "sunBloom" })).toBe(false);
    expect(actionAllowed(me, { kind: "attack" })).toBe(true);
  });

  it("治疗技能回星芒但不会超过上限", () => {
    const me = hero({ maxHp: 120, hp: 20, skills: [{ id: "warmSong", rank: 1 }] });
    const res = resolveRound(startCombat(me, dummy({ atk: 1, skills: [] })), { kind: "skill", skillId: "warmSong" }, noCrit);
    expect(res.state.hero.hp).toBeGreaterThan(20);
    expect(res.state.hero.hp).toBeLessThanOrEqual(120);
    const full = hero({ maxHp: 120, hp: 120, skills: [{ id: "warmSong", rank: 1 }] });
    const res2 = resolveRound(startCombat(full, dummy({ atk: 1, skills: [] })), { kind: "skill", skillId: "warmSong" }, noCrit);
    expect(res2.state.hero.hp).toBeLessThanOrEqual(120);
  });

  it("激励技能在持续回合内提升攻击力，到点就恢复", () => {
    const me = hero({ skills: [{ id: "braveHorn", rank: 1 }] });
    let st = startCombat(me, dummy({ maxHp: 9999, atk: 1, skills: [] }));
    st = resolveRound(st, { kind: "skill", skillId: "braveHorn" }, noCrit).state;
    expect(st.hero.powerTurns).toBeGreaterThan(0);
    expect(effectiveAtk(st.hero)).toBeGreaterThan(st.hero.atk);
    for (let i = 0; i < 4; i++) st = resolveRound(st, { kind: "attack" }, noCrit).state;
    expect(st.hero.powerTurns).toBe(0);
    expect(effectiveAtk(st.hero)).toBe(st.hero.atk);
  });
});

/* ------------------------------------------------------------------ */
/* 7. 道具与背包                                                        */
/* ------------------------------------------------------------------ */

describe("道具与有限背包", () => {
  it("背包最多 4 格，多的会被砍掉", () => {
    const f = makeFighter({
      name: "朵朵",
      emoji: "🌸",
      element: "grass",
      maxHp: 100,
      atk: 10,
      def: 1,
      spd: 5,
      bag: [
        { id: "berry", count: 1 },
        { id: "honey", count: 1 },
        { id: "bell", count: 1 },
        { id: "pepper", count: 1 },
        { id: "hammer", count: 1 }
      ]
    });
    expect(f.bag.length).toBe(BAG_SLOTS);
  });

  it("用一次道具就少一个，用完再按会提示已用完", () => {
    const me = hero({ hp: 40, bag: [{ id: "berry", count: 1 }] });
    let st = startCombat(me, dummy({ atk: 1, skills: [] }));
    st = resolveRound(st, { kind: "item", itemId: "berry" }, noCrit).state;
    expect(itemCount(st.hero, "berry")).toBe(0);
    const again = resolveRound(st, { kind: "item", itemId: "berry" }, noCrit);
    expect(again.events.some((e) => e.text.includes("用完"))).toBe(true);
  });

  it("小木槌直接削护盾，对面没盾时挥空但不报错", () => {
    const me = hero({ bag: [{ id: "hammer", count: 2 }] });
    const shielded = dummy({ shield: 100, atk: 1, skills: [] });
    const res = resolveRound(startCombat(me, shielded), { kind: "item", itemId: "hammer" }, noCrit);
    expect(res.state.foe.shield).toBe(40);
    const res2 = resolveRound(startCombat(me, dummy({ atk: 1, skills: [] })), { kind: "item", itemId: "hammer" }, noCrit);
    expect(res2.events.some((e) => e.text.includes("挥了个空"))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 8. Boss 机制触发                                                     */
/* ------------------------------------------------------------------ */

const bossSpec: FighterSpec = {
  name: "卷卷藤王",
  emoji: "🌿",
  element: "grass",
  maxHp: 400,
  atk: 30,
  def: 8,
  spd: 4,
  crit: 0,
  weakness: "fire",
  isBoss: true,
  boss: { chargeEvery: 2, chargePower: 2, chargeName: "缠缠藤网", shieldEvery: 3, shieldAmount: 60 }
};

/** 造一位 Boss，可以单独覆盖机制表里的某几项（读条 / 护盾） */
function makeBoss(over: Partial<FighterSpec> = {}, plan: Partial<NonNullable<FighterSpec["boss"]>> = {}): Fighter {
  return makeFighter({
    ...bossSpec,
    ...over,
    boss: { ...(bossSpec.boss as NonNullable<FighterSpec["boss"]>), ...plan }
  });
}

describe("Boss 机制", () => {
  it("到点就张护盾，护盾没破之前普通招式打不到本体", () => {
    // shieldEvery = 3：第 3 回合张盾
    const me = hero({ spd: 99, atk: 20, skills: [] });
    let st = startCombat(me, makeBoss({}, { chargeEvery: 0 }));
    st = resolveRound(st, { kind: "attack" }, noCrit).state;
    st = resolveRound(st, { kind: "attack" }, noCrit).state;
    expect(st.round).toBe(3);
    const r3 = resolveRound(st, { kind: "attack" }, noCrit);
    expect(r3.events.some((e) => e.kind === "shield")).toBe(true);
    expect(r3.state.foe.shield).toBeGreaterThan(0);
    const hpAfterShield = r3.state.foe.hp;
    const r4 = resolveRound(r3.state, { kind: "attack" }, noCrit);
    expect(r4.state.foe.hp).toBe(hpAfterShield);
    expect(r4.state.foe.shield).toBeLessThan(r3.state.foe.shield);
  });

  it("读条会先给一回合警告，下一回合才真的放大招", () => {
    const me = hero({ spd: 99, maxHp: 400, def: 0, skills: [] });
    const boss = makeBoss({ spd: 1 }, { shieldEvery: 0 });
    let st = startCombat(me, boss);
    // chargeEvery = 2：第 2 回合开始读条
    const r1 = resolveRound(st, { kind: "attack" }, noCrit);
    expect(r1.events.some((e) => e.kind === "charge")).toBe(false);
    const r2 = resolveRound(r1.state, { kind: "attack" }, noCrit);
    expect(r2.events.some((e) => e.kind === "charge")).toBe(true);
    expect(r2.state.foe.charge).not.toBeNull();
    const hpBefore = r2.state.hero.hp;
    const r3 = resolveRound(r2.state, { kind: "attack" }, noCrit);
    expect(r3.events.some((e) => e.text.includes("缠缠藤网"))).toBe(true);
    expect(r3.state.hero.hp).toBeLessThan(hpBefore);
  });

  it("读条大招不防御会掉很多星芒，防御能把它挡下一半", () => {
    const base = hero({ spd: 1, maxHp: 900, def: 0, skills: [] });
    const boss = makeBoss({ spd: 99 }, { shieldEvery: 0 });
    let st = startCombat(base, boss);
    st = resolveRound(st, { kind: "attack" }, noCrit).state; // 回合 1
    st = resolveRound(st, { kind: "attack" }, noCrit).state; // 回合 2：读条
    expect(st.foe.charge).not.toBeNull();
    const naked = resolveRound(st, { kind: "attack" }, noCrit).state.hero.hp;
    const held = resolveRound(st, { kind: "guard" }, noCrit).state.hero.hp;
    expect(held).toBeGreaterThan(naked);
  });

  it("放完大招 Boss 自己会转一回合圈圈，这是反打窗口", () => {
    const me = hero({ spd: 1, maxHp: 900, def: 0, skills: [] });
    const boss = makeBoss({ spd: 99 }, { shieldEvery: 0 });
    let st = startCombat(me, boss);
    st = resolveRound(st, { kind: "attack" }, noCrit).state;
    st = resolveRound(st, { kind: "attack" }, noCrit).state;
    const after = resolveRound(st, { kind: "guard" }, noCrit);
    expect(after.state.foe.stun).toBeGreaterThan(0);
    const hpBefore = after.state.hero.hp;
    const next = resolveRound(after.state, { kind: "attack" }, noCrit);
    expect(next.events.some((e) => e.kind === "stun")).toBe(true);
    expect(next.state.hero.hp).toBe(hpBefore);
  });

  it("破盾招拆盾比普通攻击快一倍", () => {
    const plain = hero({ spd: 99, atk: 24, skills: [] });
    const breaker = hero({ spd: 99, atk: 24, skills: [{ id: "crackHammer", rank: 1 }] });
    const shielded = makeBoss({ shield: 500, spd: 1 }, { chargeEvery: 0, shieldEvery: 0 });
    const a = resolveRound(startCombat(plain, shielded), { kind: "attack" }, noCrit).state.foe.shield;
    const b = resolveRound(startCombat(breaker, shielded), { kind: "skill", skillId: "crackHammer" }, noCrit).state.foe
      .shield;
    expect(b).toBeLessThan(a);
  });

  it("打 Boss 弱点系比不打弱点管用得多", () => {
    const fireHero = hero({ spd: 99, element: "fire", atk: 40, skills: [] });
    const waterHero = hero({ spd: 99, element: "water", atk: 40, skills: [] });
    const boss = makeBoss({ spd: 1 }, { chargeEvery: 0, shieldEvery: 0 });
    const withWeak = resolveRound(startCombat(fireHero, boss), { kind: "attack" }, noCrit).state.foe.hp;
    const without = resolveRound(startCombat(waterHero, boss), { kind: "attack" }, noCrit).state.foe.hp;
    expect(withWeak).toBeLessThan(without);
  });

  it("Boss 的行动是纯函数：同样局面 + 同样随机序列 = 同样选择", () => {
    const st = startCombat(hero(), makeFighter(bossSpec));
    const a = planFoeAction(st, mulberry32(7));
    const b = planFoeAction(cloneState(st), mulberry32(7));
    expect(a).toEqual(b);
  });
});

/* ------------------------------------------------------------------ */
/* 9. 回合流程                                                          */
/* ------------------------------------------------------------------ */

describe("回合流程", () => {
  it("resolveRound 不改传进来的状态（纯函数）", () => {
    const st = startCombat(hero(), dummy());
    const snapshot = JSON.stringify(st);
    resolveRound(st, { kind: "attack" }, alwaysCrit);
    expect(JSON.stringify(st)).toBe(snapshot);
  });

  it("速度高的先动手，速度一样勇者先动", () => {
    const slowFoe = dummy({ spd: 1, maxHp: 8, def: 0, atk: 50, skills: [] });
    const fastHero = hero({ spd: 20, atk: 50, def: 0, skills: [] });
    const res = resolveRound(startCombat(fastHero, slowFoe), { kind: "attack" }, noCrit);
    // 勇者先手直接结束战斗，对手来不及还手
    expect(res.state.winner).toBe("hero");
    expect(res.state.hero.hp).toBe(fastHero.maxHp);
  });

  it("星芒见底就结束，胜负写进 state，事件里是「歇口气」不是任何受伤字眼", () => {
    const res = resolveRound(
      startCombat(hero({ atk: 999, spd: 99, skills: [] }), dummy({ maxHp: 5, def: 0, skills: [] })),
      { kind: "attack" },
      noCrit
    );
    expect(res.state.over).toBe(true);
    expect(res.state.winner).toBe("hero");
    const endText = res.events.filter((e) => e.kind === "end").map((e) => e.text).join("");
    expect(endText.length).toBeGreaterThan(0);
    for (const bad of ["血", "受伤", "死", "杀", "疼死"]) expect(endText).not.toContain(bad);
  });

  it("战斗结束后再调用 resolveRound 不会出错也不会继续掉星芒", () => {
    const done = resolveRound(
      startCombat(hero({ atk: 999, spd: 99, skills: [] }), dummy({ maxHp: 5, def: 0, skills: [] })),
      { kind: "attack" },
      noCrit
    ).state;
    const again = resolveRound(done, { kind: "attack" }, noCrit);
    expect(again.events).toEqual([]);
    expect(again.state.hero.hp).toBe(done.hero.hp);
    expect(again.state.foe.hp).toBe(done.foe.hp);
  });

  it("hpRatio 永远落在 0..1", () => {
    expect(hpRatio(hero({ maxHp: 100, hp: 50 }))).toBeCloseTo(0.5, 5);
    expect(hpRatio(hero({ maxHp: 100, hp: 0 }))).toBe(0);
    expect(hpRatio(makeFighter({ name: "x", emoji: "x", element: "fire", maxHp: 1, atk: 1, def: 0, spd: 1 }))).toBe(1);
  });

  it("平局判定看剩余星芒比例，一样就是平", () => {
    const even = startCombat(hero({ maxHp: 100, hp: 50 }), dummy({ maxHp: 200, hp: 100 }));
    expect(judgeByHp(even)).toBeNull();
    const ahead = startCombat(hero({ maxHp: 100, hp: 90 }), dummy({ maxHp: 100, hp: 10 }));
    expect(judgeByHp(ahead)).toBe("hero");
  });
});

/* ------------------------------------------------------------------ */
/* 10. 自动战斗与策略 AI                                                */
/* ------------------------------------------------------------------ */

describe("自动战斗与策略 AI", () => {
  it("同一个种子跑出来的战斗完全一样（可复现）", () => {
    const a = simulateBattle(hero({ skills: [{ id: "petalSlash", rank: 2 }] }), dummy(), 12345);
    const b = simulateBattle(hero({ skills: [{ id: "petalSlash", rank: 2 }] }), dummy(), 12345);
    expect(a.winner).toBe(b.winner);
    expect(a.rounds).toBe(b.rounds);
    expect(a.events.map((e) => e.text)).toEqual(b.events.map((e) => e.text));
  });

  it("AI 看到对手读条会先防御", () => {
    const me = hero({ spd: 1, skills: [{ id: "petalSlash", rank: 1 }] });
    const boss = makeBoss({ spd: 99 }, { shieldEvery: 0 });
    let st = startCombat(me, boss);
    st = resolveRound(st, { kind: "attack" }, noCrit).state;
    st = resolveRound(st, { kind: "attack" }, noCrit).state;
    expect(st.foe.charge).not.toBeNull();
    expect(planHeroAction(st, mulberry32(1))).toEqual({ kind: "guard" });
  });

  it("AI 看到护盾会优先掏破盾 / 穿透招", () => {
    const me = hero({ skills: [{ id: "crackHammer", rank: 1 }, { id: "petalSlash", rank: 1 }] });
    const shielded = makeBoss({ shield: 200 }, { chargeEvery: 0, shieldEvery: 0 });
    const action = planHeroAction(startCombat(me, shielded), mulberry32(3)) as Action;
    expect(action.kind).toBe("skill");
    expect(["crackHammer", "chimeBreak", "starPoke"]).toContain(
      (action as { kind: "skill"; skillId: string }).skillId
    );
  });

  it("AI 星芒见底会先补一口再说", () => {
    const me = hero({ maxHp: 200, hp: 30, skills: [{ id: "warmSong", rank: 1 }] });
    const action = planHeroAction(startCombat(me, dummy()), mulberry32(5));
    expect(action).toEqual({ kind: "skill", skillId: "warmSong" });
  });

  it("普通遭遇战不拖沓：推荐配装下几个回合就能结束", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const res = simulateBattle(
        hero({ maxHp: 160, atk: 34, def: 12, spd: 12, crit: 0.1, skills: [{ id: "gustStep", rank: 2 }] }),
        dummy({ maxHp: 70, atk: 16, def: 5, spd: 9, element: "water", skills: [] }),
        seed
      );
      expect(res.winner).toBe("hero");
      expect(res.rounds).toBeLessThanOrEqual(5);
    }
  });

  it("Boss 战更长但也会在合理回合内收尾", () => {
    const res = simulateBattle(
      hero({
        maxHp: 260,
        atk: 40,
        def: 16,
        spd: 12,
        crit: 0.12,
        element: "fire",
        skills: [
          { id: "emberDance", rank: 3 },
          { id: "crackHammer", rank: 2 },
          { id: "warmSong", rank: 2 }
        ],
        bag: [{ id: "honey", count: 2 }]
      }),
      makeFighter(bossSpec),
      99,
      40
    );
    expect(res.rounds).toBeLessThanOrEqual(30);
    expect(res.rounds).toBeGreaterThan(3);
  });

  it("配装带克制属性明显比被克制好打", () => {
    const foeSpec: Partial<FighterSpec> = { element: "grass", maxHp: 220, atk: 18, def: 8, spd: 8, skills: [] };
    const fire = simulateBattle(hero({ element: "fire", skills: [] }), dummy(foeSpec), 77);
    const water = simulateBattle(hero({ element: "water", skills: [] }), dummy(foeSpec), 77);
    expect(fire.final.foe.hp).toBeLessThan(water.final.foe.hp);
  });

  it("三对三接力：一方全部歇下才算输，总有一方胜出", () => {
    const mine = [hero({ name: "朵朵" }), hero({ name: "糯糯", element: "grass" }), hero({ name: "云云", element: "light" })];
    const theirs = [
      dummy({ name: "星星", element: "light", maxHp: 90 }),
      dummy({ name: "闪闪", element: "light", maxHp: 80 }),
      dummy({ name: "啾啾", element: "water", maxHp: 80 })
    ];
    const res = simulateTeamBattle(mine, theirs, 2024);
    expect(["a", "b"]).toContain(res.winner);
    expect(res.bouts.length).toBeGreaterThan(0);
    expect(res.aLeft + res.bLeft).toBeGreaterThan(0);
  });

  it("脚本化战斗：按顺序执行给定的行动列表", () => {
    const me = hero({ spd: 99, atk: 30, skills: [{ id: "petalSlash", rank: 1 }] });
    const res = simulateScript(me, dummy({ maxHp: 400, atk: 2, def: 0, skills: [] }), [
      { kind: "skill", skillId: "petalSlash" },
      { kind: "guard" },
      { kind: "attack" }
    ], 4);
    expect(res.rounds).toBe(3);
    expect(res.events.some((e) => e.kind === "guard")).toBe(true);
    expect(res.final.foe.hp).toBeLessThan(400);
  });
});
