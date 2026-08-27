import { describe, expect, it } from "vitest";
import {
  BLESSING_EVERY,
  COMPANIONS,
  GEARS,
  HERO_NAME,
  LOADOUT_SLOTS,
  MAX_HERO_LEVEL,
  SAVE_KEY,
  SKILL_UNLOCKS,
  STARTER_GEAR,
  addToStash,
  applyArena,
  applyBlessing,
  arenaScale,
  bagUsedSlots,
  baseHeroStats,
  buildCompanion,
  buildHero,
  buildMyTeam,
  buildRivalTeam,
  buyGear,
  carryItem,
  companionById,
  defaultSave,
  endlessCoins,
  endlessEndText,
  endlessExp,
  endlessFoeSpec,
  endlessStarReward,
  endlessTier,
  equipGear,
  expToNext,
  GEAR_MATCH_EXPONENT,
  MATE_GEAR_SHARE,
  gainCoins,
  gearFactor,
  gainExp,
  gearById,
  gearsOfSlot,
  heroStats,
  isBlessingFloor,
  isEndlessGuardian,
  learnSkill,
  loadSave,
  migrateSave,
  powerScore,
  rollBlessings,
  runArena,
  setPartyMember,
  stashCount,
  syncBagAfterRun,
  toggleLoadout,
  unpackItem,
  writeSave,
  type HeroSave,
  type StorageLike
} from "./logic";
import { BAG_SLOTS, ELEMENTS, ITEMS, MAX_SKILL_RANK, SKILLS, makeFighter, simulateBattle } from "./combat";
import { expectedHero } from "./levels";

function memStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k)
  };
}

/** 直接给一份练到指定等级的存档，省得测试里一点点刷经验 */
function saveAtLevel(level: number, over: Partial<HeroSave> = {}): HeroSave {
  return { ...defaultSave(), level, skillPoints: 60, coins: 99999, ...over };
}

describe("等级与经验", () => {
  it("升级所需经验随等级变多，满级后不再需要", () => {
    expect(expToNext(2)).toBeGreaterThan(expToNext(1));
    expect(expToNext(MAX_HERO_LEVEL)).toBe(Number.POSITIVE_INFINITY);
  });

  it("吃经验会升级，每升一级送 1 点技能点", () => {
    const start = defaultSave();
    const { save, levelsGained } = gainExp(start, expToNext(1) + expToNext(2));
    expect(levelsGained).toBe(2);
    expect(save.level).toBe(3);
    expect(save.skillPoints).toBe(start.skillPoints + 2);
  });

  it("经验不够就只攒着，等级不动", () => {
    const { save, levelsGained } = gainExp(defaultSave(), 10);
    expect(levelsGained).toBe(0);
    expect(save.level).toBe(1);
    expect(save.exp).toBe(10);
  });

  it("等级封顶在 60 级，再喂经验也不会溢出", () => {
    const { save } = gainExp(saveAtLevel(MAX_HERO_LEVEL - 1), 9_000_000);
    expect(save.level).toBe(MAX_HERO_LEVEL);
    expect(save.exp).toBe(0);
  });

  it("gainExp 不会改动传进去的存档（纯函数）", () => {
    const before = defaultSave();
    const snapshot = JSON.stringify(before);
    gainExp(before, 5000);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("基础数值随等级单调上升", () => {
    for (let lv = 2; lv <= MAX_HERO_LEVEL; lv++) {
      const a = baseHeroStats(lv - 1);
      const b = baseHeroStats(lv);
      expect(b.maxHp).toBeGreaterThan(a.maxHp);
      expect(b.atk).toBeGreaterThan(a.atk);
      expect(b.def).toBeGreaterThan(a.def);
    }
  });

  it("金币不会变成负数", () => {
    expect(gainCoins(defaultSave(), -99999).coins).toBe(0);
    expect(gainCoins(defaultSave(), 100).coins).toBe(140);
  });
});

describe("装备", () => {
  it("四个槽各有一整条成长线，起手装备都是免费的", () => {
    for (const slot of ["weapon", "armor", "charm", "badge"] as const) {
      expect(gearsOfSlot(slot).length).toBeGreaterThanOrEqual(5);
      expect(gearById(STARTER_GEAR[slot])?.slot).toBe(slot);
      expect(gearById(STARTER_GEAR[slot])?.price).toBe(0);
    }
  });

  it("每件装备 id 唯一、都有说明文字", () => {
    expect(new Set(GEARS.map((g) => g.id)).size).toBe(GEARS.length);
    for (const g of GEARS) expect(g.desc.length).toBeGreaterThan(4);
  });

  it("等级不够或钱不够就买不了，理由说得清清楚楚", () => {
    const poor = { ...defaultSave(), coins: 0 };
    const r1 = buyGear(poor, "w6");
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toContain("级");
    const rich = saveAtLevel(50, { coins: 5 });
    const r2 = buyGear(rich, "w6");
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toContain("金币");
  });

  it("买得起就扣钱进包，重复买会被挡住", () => {
    const rich = saveAtLevel(50);
    const r = buyGear(rich, "w6");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.coins).toBe(rich.coins - (gearById("w6")?.price ?? 0));
    expect(r.save.owned).toContain("w6");
    expect(buyGear(r.save, "w6").ok).toBe(false);
  });

  it("只能穿自己有的装备，穿上之后数值真的变强", () => {
    const rich = saveAtLevel(50);
    const before = heroStats(rich);
    const bought = buyGear(rich, "w6");
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const worn = equipGear(bought.save, "w6");
    expect(heroStats(worn).atk).toBeGreaterThan(before.atk);
    // 没买的护甲穿不上
    expect(equipGear(rich, "a6").gear.armor).toBe(STARTER_GEAR.armor);
  });

  it("属性徽章决定勇者出招的属性，五系都能配", () => {
    const rich = saveAtLevel(10, { owned: GEARS.map((g) => g.id) });
    const seen = new Set<string>();
    for (const badge of gearsOfSlot("badge")) {
      const s = heroStats(equipGear(rich, badge.id));
      expect(s.element).toBe(badge.element);
      seen.add(s.element);
    }
    expect(seen.size).toBe(ELEMENTS.length);
  });

  it("满配的 60 级勇者，数值大致跟得上第 188 关的设计水平", () => {
    const full = saveAtLevel(MAX_HERO_LEVEL, {
      owned: GEARS.map((g) => g.id),
      gear: { weapon: "w6", armor: "a6", charm: "c6", badge: "b-dark" }
    });
    const s = heroStats(full);
    const need = expectedHero(187);
    expect(s.maxHp).toBeGreaterThanOrEqual(need.maxHp * 0.9);
    expect(s.atk).toBeGreaterThanOrEqual(need.atk * 0.9);
    expect(s.def).toBeGreaterThanOrEqual(need.def * 0.9);
  });

  it("战力分数会跟着装备一起涨", () => {
    const base = saveAtLevel(50);
    const geared = equipGear(
      { ...base, owned: [...base.owned, "w6", "a6"] },
      "w6"
    );
    expect(powerScore(heroStats(geared))).toBeGreaterThan(powerScore(heroStats(base)));
  });
});

describe("技能点与上阵技能", () => {
  it("解锁表里的技能都真实存在，等级要求逐个抬高", () => {
    for (const u of SKILL_UNLOCKS) expect(SKILLS[u.id]).toBeTruthy();
    for (let i = 1; i < SKILL_UNLOCKS.length; i++) {
      expect(SKILL_UNLOCKS[i].reqLevel).toBeGreaterThanOrEqual(SKILL_UNLOCKS[i - 1].reqLevel);
    }
  });

  it("等级不够或技能点不够都学不了", () => {
    const low = { ...defaultSave(), skillPoints: 99 };
    const r1 = learnSkill(low, "sunBloom");
    expect(r1.ok).toBe(false);
    const broke = saveAtLevel(60, { skillPoints: 0 });
    const r2 = learnSkill(broke, "gustStep");
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toContain("技能点");
  });

  it("学会技能会扣点数，并自动上阵（阵上还有空位时）", () => {
    const s = defaultSave();
    const r = learnSkill(s, "gustStep");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.ranks.gustStep).toBe(1);
    expect(r.save.skillPoints).toBe(s.skillPoints - 1);
    expect(r.save.loadout).toContain("gustStep");
  });

  it("技能能一路升到 5 级，到顶就升不动了", () => {
    let s = saveAtLevel(60, { skillPoints: 200 });
    for (let i = 0; i < MAX_SKILL_RANK; i++) {
      const r = learnSkill(s, "gustStep");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.save;
    }
    expect(s.ranks.gustStep).toBe(MAX_SKILL_RANK);
    const over = learnSkill(s, "gustStep");
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toContain("顶");
  });

  it("上阵技能最多 4 个，第 5 个上不去", () => {
    let s = saveAtLevel(60, { skillPoints: 200, loadout: [] });
    const ids = ["gustStep", "petalSlash", "emberDance", "dewSplash", "crackHammer"];
    for (const id of ids) {
      const r = learnSkill(s, id);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.save;
    }
    expect(s.loadout.length).toBe(LOADOUT_SLOTS);
    s = toggleLoadout(s, ids[4]);
    expect(s.loadout.length).toBe(LOADOUT_SLOTS);
    // 先下一个再上另一个就可以
    s = toggleLoadout(s, s.loadout[0]);
    s = toggleLoadout(s, ids[4]);
    expect(s.loadout).toContain(ids[4]);
  });

  it("没学过的技能上不了阵", () => {
    const s = defaultSave();
    expect(toggleLoadout(s, "sunBloom").loadout).not.toContain("sunBloom");
  });

  it("上场的勇者只会带上阵且学过的技能", () => {
    const s = saveAtLevel(60, { ranks: { gustStep: 3 }, loadout: ["gustStep", "sunBloom"] });
    const f = buildHero(s);
    expect(f.skills.map((x) => x.id)).toEqual(["gustStep"]);
    expect(f.skills[0].rank).toBe(3);
    expect(f.name).toBe(HERO_NAME);
  });
});

describe("有限背包", () => {
  it("背包只有 4 格，第 5 样带不走", () => {
    let s = defaultSave();
    for (const id of ["berry", "honey", "bell", "pepper", "hammer"]) s = addToStash(s, id, 2);
    s = { ...s, bag: [] };
    const ok: string[] = [];
    for (const id of ["berry", "honey", "bell", "pepper", "hammer"]) {
      const r = carryItem(s, id);
      if (r.ok) {
        s = r.save;
        ok.push(id);
      } else {
        expect(r.reason).toContain("格");
      }
    }
    expect(ok.length).toBe(BAG_SLOTS);
    expect(bagUsedSlots(s)).toBe(BAG_SLOTS);
  });

  it("已经带了的道具可以继续加数量，不占新格子", () => {
    let s = addToStash({ ...defaultSave(), bag: [] }, "berry", 5);
    const r1 = carryItem(s, "berry");
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = carryItem(r1.save, "berry");
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(bagUsedSlots(r2.save)).toBe(1);
    expect(r2.save.bag[0].count).toBe(2);
  });

  it("仓库里没有就拿不了，放回去数量会还回仓库", () => {
    const empty = { ...defaultSave(), bag: [], stash: {} };
    const r = carryItem(empty, "honey");
    expect(r.ok).toBe(false);
    const packed = carryItem(addToStash(empty, "honey", 1), "honey");
    expect(packed.ok).toBe(true);
    if (!packed.ok) return;
    const back = unpackItem(packed.save, "honey");
    expect(stashCount(back, "honey")).toBe(1);
    expect(bagUsedSlots(back)).toBe(0);
  });

  it("不存在的道具既进不了仓库也进不了背包", () => {
    const s = defaultSave();
    expect(addToStash(s, "不存在的东西", 3)).toBe(s);
    expect(carryItem(s, "不存在的东西").ok).toBe(false);
  });

  it("一趟冒险回来会把剩下的道具数写回存档", () => {
    const s = defaultSave();
    const after = syncBagAfterRun(s, [
      { id: "berry", count: 0 },
      { id: "honey", count: 2 },
      { id: "不存在", count: 5 }
    ]);
    expect(after.bag).toEqual([{ id: "honey", count: 2 }]);
  });

  it("道具表里的每样东西都有名字、价格和说明", () => {
    for (const [id, def] of Object.entries(ITEMS)) {
      expect(def.id).toBe(id);
      expect(def.name.length).toBeGreaterThan(1);
      expect(def.price).toBeGreaterThan(0);
      expect(def.desc.length).toBeGreaterThan(6);
    }
  });
});

describe("存档读写", () => {
  it("写进去能原样读回来", () => {
    const store = memStorage();
    const s = saveAtLevel(21, { coins: 777, endlessBest: 13 });
    writeSave(s, store);
    const back = loadSave(store);
    expect(back.level).toBe(21);
    expect(back.coins).toBe(777);
    expect(back.endlessBest).toBe(13);
    expect(store.map.has(SAVE_KEY)).toBe(true);
  });

  it("没有存档就是一份干净的新档", () => {
    expect(loadSave(memStorage()).level).toBe(1);
    expect(loadSave(null).level).toBe(1);
  });

  it("坏掉的 JSON 不会让游戏崩，直接当新档", () => {
    const store = memStorage();
    store.setItem(SAVE_KEY, "{这不是 JSON");
    expect(loadSave(store).level).toBe(1);
  });

  it("脏数据会被整理干净：等级夹范围、假技能假装备一律丢掉", () => {
    const s = migrateSave({
      level: 9999,
      exp: -5,
      coins: "很多",
      ranks: { gustStep: 99, 假招式: 3 },
      loadout: ["gustStep", "假招式", "sunBloom"],
      gear: { weapon: "不存在", armor: "a6", charm: "c1", badge: "b-fire" },
      owned: ["w1", "假装备"],
      bag: [{ id: "berry", count: 999 }, { id: "假道具", count: 1 }, null],
      party: ["nuonuo", "假同伴"]
    });
    expect(s.level).toBe(MAX_HERO_LEVEL);
    expect(s.exp).toBe(0);
    expect(s.coins).toBe(defaultSave().coins);
    expect(s.ranks.gustStep).toBe(MAX_SKILL_RANK);
    expect(s.ranks["假招式"]).toBeUndefined();
    expect(s.loadout).toEqual(["gustStep"]);
    // a6 没在 owned 里，穿不上，回落到起手护甲
    expect(s.gear.armor).toBe(STARTER_GEAR.armor);
    expect(s.owned).not.toContain("假装备");
    expect(s.bag).toEqual([{ id: "berry", count: 9 }]);
    expect(s.party.length).toBe(2);
    expect(s.party).toContain("nuonuo");
  });

  it("完全不是对象的存档也能兜住", () => {
    expect(migrateSave(null).level).toBe(1);
    expect(migrateSave("字符串").level).toBe(1);
    expect(migrateSave(42).level).toBe(1);
  });
});

describe("无尽深渊", () => {
  it("层数越深，对手越强", () => {
    let prevHp = 0;
    for (let d = 1; d <= 40; d++) {
      const spec = endlessFoeSpec(d);
      if (!isEndlessGuardian(d) && d > 1 && !isEndlessGuardian(d - 1)) {
        expect(spec.maxHp).toBeGreaterThan(prevHp);
      }
      prevHp = isEndlessGuardian(d) ? prevHp : spec.maxHp;
      expect(spec.name.length).toBeGreaterThan(1);
    }
    expect(endlessTier(1)).toBe(0);
    expect(endlessTier(100)).toBeLessThanOrEqual(187);
  });

  it("每 8 层来一个守门的大家伙，带弱点和读条大招", () => {
    expect(isEndlessGuardian(8)).toBe(true);
    expect(isEndlessGuardian(16)).toBe(true);
    expect(isEndlessGuardian(7)).toBe(false);
    const g = endlessFoeSpec(8);
    expect(g.isBoss).toBe(true);
    expect(g.weakness).not.toBeNull();
    expect(g.boss?.chargeEvery).toBeGreaterThan(0);
  });

  it("同一层每次生成完全一样（可复现）", () => {
    expect(JSON.stringify(endlessFoeSpec(17))).toBe(JSON.stringify(endlessFoeSpec(17)));
  });

  it("越深金币和经验越多，守门层给得更多", () => {
    expect(endlessCoins(20)).toBeGreaterThan(endlessCoins(5));
    expect(endlessCoins(8)).toBeGreaterThan(endlessCoins(7) * 2);
    expect(endlessExp(20)).toBeGreaterThan(endlessExp(5));
    expect(endlessExp(0)).toBe(0);
  });

  it("平台小星星最多给 5 颗，破纪录多给一颗", () => {
    expect(endlessStarReward(0, 0)).toBe(0);
    expect(endlessStarReward(3, 10)).toBe(1);
    expect(endlessStarReward(3, 1)).toBe(2);
    expect(endlessStarReward(99, 0)).toBe(5);
    for (let d = 0; d <= 60; d++) expect(endlessStarReward(d, 0)).toBeLessThanOrEqual(5);
  });

  it("探险结束的说法是「回城休息」，不出现任何受伤或死亡字眼", () => {
    for (const [d, best] of [[0, 0], [5, 2], [5, 20]] as Array<[number, number]>) {
      const text = endlessEndText(d, best);
      expect(text.length).toBeGreaterThan(6);
      for (const bad of ["血", "死", "受伤", "阵亡", "杀"]) expect(text).not.toContain(bad);
    }
    expect(endlessEndText(9, 3)).toContain("新纪录");
    expect(endlessEndText(9, 30)).toContain("回城");
  });

  it("每 3 层给一次祝福，每次两个不一样的选项", () => {
    expect(BLESSING_EVERY).toBe(3);
    expect(isBlessingFloor(3)).toBe(true);
    expect(isBlessingFloor(4)).toBe(false);
    for (const d of [3, 6, 9, 12]) {
      const opts = rollBlessings(d);
      expect(opts.length).toBe(2);
      expect(opts[0].id).not.toBe(opts[1].id);
      for (const b of opts) expect(b.desc.length).toBeGreaterThan(4);
    }
    expect(JSON.stringify(rollBlessings(6))).toBe(JSON.stringify(rollBlessings(6)));
  });

  it("祝福真的会改数值，而且不改传进来的角色", () => {
    const base = makeFighter({
      name: "鸭梨", emoji: "🌸", element: "grass",
      maxHp: 200, atk: 40, def: 10, spd: 10, crit: 0.1, hp: 100
    });
    const snapshot = JSON.stringify(base);
    const heal = applyBlessing(base, { id: "x", kind: "heal", name: "泉", emoji: "♨️", amount: 0.4, desc: "回复" });
    expect(heal.hp).toBe(180);
    const hp = applyBlessing(base, { id: "x", kind: "maxhp", name: "果", emoji: "🍎", amount: 0.5, desc: "上限" });
    expect(hp.maxHp).toBe(300);
    const atk = applyBlessing(base, { id: "x", kind: "atk", name: "石", emoji: "🪨", amount: 0.5, desc: "攻击" });
    expect(atk.atk).toBe(60);
    const def = applyBlessing(base, { id: "x", kind: "def", name: "垫", emoji: "🍂", amount: 1, desc: "防御" });
    expect(def.def).toBe(20);
    const crit = applyBlessing(base, { id: "x", kind: "crit", name: "铃", emoji: "🔔", amount: 0.1, desc: "暴击" });
    expect(crit.crit).toBeCloseTo(0.2, 5);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("回复类祝福不会超过星芒上限", () => {
    const full = makeFighter({
      name: "鸭梨", emoji: "🌸", element: "grass", maxHp: 100, atk: 10, def: 1, spd: 5
    });
    const healed = applyBlessing(full, { id: "x", kind: "heal", name: "泉", emoji: "♨️", amount: 1, desc: "回复" });
    expect(healed.hp).toBe(100);
  });

  it("配装到位的勇者能在深渊里走出一段距离", () => {
    const s = saveAtLevel(30, {
      owned: GEARS.map((g) => g.id),
      gear: { weapon: "w4", armor: "a4", charm: "c4", badge: "b-light" },
      ranks: { gustStep: 3, crackHammer: 3, warmSong: 3 },
      loadout: ["gustStep", "crackHammer", "warmSong"]
    });
    let hero = buildHero(s);
    let depth = 0;
    for (let d = 1; d <= 60; d++) {
      const res = simulateBattle(hero, makeFighter(endlessFoeSpec(d)), d * 31 + 7, 40);
      if (res.winner !== "hero") break;
      hero = { ...res.final.hero, guarding: false, stun: 0, charge: null };
      depth = d;
      if (isBlessingFloor(d)) hero = applyBlessing(hero, rollBlessings(d)[0]);
    }
    // 走得动、也终究会走不动——深渊就该是这个手感
    expect(depth).toBeGreaterThanOrEqual(15);
    expect(depth).toBeLessThan(60);
  });

  it("越会养成走得越深：新号几层就得回城，毕业号能下到三十几层", () => {
    const dive = (s: HeroSave, seed: number): number => {
      let hero = buildHero(s);
      let depth = 0;
      for (let d = 1; d <= 120; d++) {
        const res = simulateBattle(hero, makeFighter(endlessFoeSpec(d)), d * 31 + seed, 40);
        if (res.winner !== "hero") break;
        hero = { ...res.final.hero, guarding: false, stun: 0, charge: null };
        depth = d;
        if (isBlessingFloor(d)) hero = applyBlessing(hero, rollBlessings(d)[0]);
      }
      return depth;
    };
    const median = (s: HeroSave): number => {
      const ds: number[] = [];
      for (let seed = 0; seed < 9; seed++) ds.push(dive(s, seed * 101 + 7));
      ds.sort((a, b) => a - b);
      return ds[4];
    };

    const rookie = median(defaultSave());
    const midGame = median(
      saveAtLevel(30, {
        owned: GEARS.map((g) => g.id),
        gear: { weapon: "w3", armor: "a3", charm: "c3", badge: "b-light" },
        ranks: { gustStep: 2, crackHammer: 2, warmSong: 2 },
        loadout: ["gustStep", "crackHammer", "warmSong"]
      })
    );
    const graduate = median(
      saveAtLevel(60, {
        owned: GEARS.map((g) => g.id),
        gear: { weapon: "w5", armor: "a5", charm: "c5", badge: "b-light" },
        ranks: { gustStep: 5, crackHammer: 5, warmSong: 5, petalSlash: 5 },
        loadout: ["gustStep", "crackHammer", "warmSong", "petalSlash"]
      })
    );

    expect(rookie).toBeGreaterThanOrEqual(2); // 新号也不至于第一层就回城
    expect(rookie).toBeLessThan(8);
    expect(midGame).toBeGreaterThan(rookie * 3);
    expect(graduate).toBeGreaterThan(midGame);
    expect(graduate).toBeGreaterThanOrEqual(25);
  });
});

describe("对战：康康的队伍", () => {
  it("六位同伴都是本作原创角色，属性配置各不相同", () => {
    const names = COMPANIONS.map((c) => c.name);
    expect(names).toEqual(["糯糯", "云云", "墩墩", "闪闪", "绿绿豆", "啾啾"]);
    expect(new Set(COMPANIONS.map((c) => c.id)).size).toBe(COMPANIONS.length);
    for (const c of COMPANIONS) {
      expect(ELEMENTS).toContain(c.element);
      expect(c.skills.length).toBeGreaterThan(0);
      for (const sid of c.skills) expect(SKILLS[sid]).toBeTruthy();
      expect(c.desc.length).toBeGreaterThan(8);
    }
  });

  it("同伴的定位真的不一样：墩墩最耐打、闪闪最快", () => {
    const tank = companionById("dundun");
    const speedy = companionById("shanshan");
    expect(tank && speedy).toBeTruthy();
    if (!tank || !speedy) return;
    expect(tank.def).toBeGreaterThan(speedy.def);
    expect(speedy.spd).toBeGreaterThan(tank.spd);
    const t = buildCompanion("dundun", 30);
    const s = buildCompanion("shanshan", 30);
    expect(t.def).toBeGreaterThan(s.def);
    expect(s.spd).toBeGreaterThan(t.spd);
  });

  it("双方都是三个人，我方队首是鸭梨，对方队首是康康", () => {
    const s = saveAtLevel(20);
    const mine = buildMyTeam(s);
    const theirs = buildRivalTeam(s.level, s.arenaWins);
    expect(mine.length).toBe(3);
    expect(theirs.length).toBe(3);
    expect(mine[0].name).toBe("鸭梨");
    expect(theirs[0].name).toBe("康康");
  });

  it("赢得越多对手越强，但强度封顶", () => {
    expect(arenaScale(0)).toBeLessThan(arenaScale(5));
    expect(arenaScale(999)).toBeLessThanOrEqual(1.2);
    const easy = buildRivalTeam(30, 0)[0];
    const hard = buildRivalTeam(30, 20)[0];
    expect(hard.maxHp).toBeGreaterThan(easy.maxHp);
  });

  it("擂台是一段缓坡，不是一道坎：胜率随胜场一点点往下走", () => {
    const s = saveAtLevel(30, {
      owned: GEARS.map((g) => g.id),
      gear: { weapon: "w3", armor: "a3", charm: "c3", badge: "b-light" },
      ranks: { gustStep: 2, crackHammer: 2, warmSong: 2 },
      loadout: ["gustStep", "crackHammer", "warmSong"]
    });
    const rate = (wins: number): number => {
      let w = 0;
      const n = 30;
      for (let i = 0; i < n; i++) if (runArena({ ...s, arenaWins: wins }, i * 7919 + 11).win) w += 1;
      return w / n;
    };
    const start = rate(0);
    const middle = rate(12);
    const late = rate(30);
    expect(start).toBeGreaterThan(0.7); // 刚上擂台是能赢的，不至于一开始就劝退
    expect(middle).toBeLessThan(start); // 赢着赢着就吃力了
    expect(late).toBeLessThan(middle); // 总有打不动的那一场，那就是这套配装的上限
  });

  it("配装越好，擂台上的连胜能走得越远", () => {
    const mk = (over: Partial<HeroSave>): HeroSave => saveAtLevel(45, { owned: GEARS.map((g) => g.id), ...over });
    /** 这套配装大概能连赢到第几场：从 0 胜往上试，直到赢不动为止 */
    const wall = (s: HeroSave): number => {
      for (const wins of [0, 8, 16, 24, 32, 40, 48]) {
        let w = 0;
        const n = 20;
        for (let i = 0; i < n; i++) if (runArena({ ...s, arenaWins: wins }, i * 5171 + 3).win) w += 1;
        if (w / n < 0.5) return wins;
      }
      return 56;
    };

    const plain = wall(mk({ gear: { weapon: "w2", armor: "a2", charm: "c2", badge: "b-light" } }));
    const decent = wall(
      mk({
        gear: { weapon: "w4", armor: "a4", charm: "c4", badge: "b-light" },
        ranks: { gustStep: 3, crackHammer: 3, warmSong: 3 },
        loadout: ["gustStep", "crackHammer", "warmSong"]
      })
    );
    const best = wall(
      mk({
        gear: { weapon: "w5", armor: "a5", charm: "c5", badge: "b-light" },
        ranks: { gustStep: 5, crackHammer: 5, warmSong: 5, petalSlash: 5 },
        loadout: ["gustStep", "crackHammer", "warmSong", "petalSlash"]
      })
    );
    expect(decent).toBeGreaterThan(plain);
    expect(best).toBeGreaterThanOrEqual(decent);
    expect(best).toBeGreaterThan(plain);
  });

  it("装备倍数：光着身子是 1，配好装备明显大于 1，而且封顶", () => {
    const bare = saveAtLevel(40);
    expect(gearFactor(bare)).toBeCloseTo(1, 1);
    const full = saveAtLevel(40, {
      owned: GEARS.map((g) => g.id),
      gear: { weapon: "w5", armor: "a5", charm: "c5", badge: "b-dark" }
    });
    expect(gearFactor(full)).toBeGreaterThan(1.2);
    expect(gearFactor(full)).toBeLessThanOrEqual(2.2);
  });

  it("对手只跟一部分装备差距，配得越好赢面越大", () => {
    expect(GEAR_MATCH_EXPONENT).toBeLessThan(1);
    // 装备涨 1.44 倍，对手只涨 1.44^0.6 ≈ 1.24 倍
    expect(arenaScale(0, 1.44)).toBeLessThan(arenaScale(0, 1) * 1.44);
    expect(arenaScale(0, 1.44)).toBeGreaterThan(arenaScale(0, 1));
  });

  it("同伴能分到一部分装备红利，但分不满", () => {
    expect(MATE_GEAR_SHARE).toBeGreaterThan(0);
    expect(MATE_GEAR_SHARE).toBeLessThan(1);
    const full = saveAtLevel(40, {
      owned: GEARS.map((g) => g.id),
      gear: { weapon: "w5", armor: "a5", charm: "c5", badge: "b-dark" }
    });
    const mate = buildMyTeam(full)[1];
    const bareMate = buildCompanion(full.party[0], full.level);
    expect(mate.maxHp).toBeGreaterThan(bareMate.maxHp);
    expect(mate.maxHp).toBeLessThan(Math.round(bareMate.maxHp * gearFactor(full)));
  });

  it("同一份存档 + 同一个种子，对战结果完全一样（纯函数）", () => {
    const s = saveAtLevel(25, { ranks: { gustStep: 3 }, loadout: ["gustStep"] });
    const a = runArena(s, 8899);
    const b = runArena(s, 8899);
    expect(a.win).toBe(b.win);
    expect(a.result.bouts.length).toBe(b.result.bouts.length);
    expect(a.text).toBe(b.text);
  });

  it("改配装会改变对战结果，说明配装真的有用", () => {
    const weak = saveAtLevel(30, {
      owned: GEARS.map((g) => g.id),
      gear: { weapon: "w1", armor: "a1", charm: "c1", badge: "b-light" },
      ranks: {},
      loadout: []
    });
    const strong: HeroSave = {
      ...weak,
      gear: { weapon: "w4", armor: "a4", charm: "c4", badge: "b-dark" },
      ranks: { gustStep: 4, crackHammer: 4, warmSong: 4 },
      loadout: ["gustStep", "crackHammer", "warmSong"]
    };
    let weakWins = 0;
    let strongWins = 0;
    for (let seed = 1; seed <= 12; seed++) {
      if (runArena(weak, seed).win) weakWins++;
      if (runArena(strong, seed).win) strongWins++;
    }
    expect(strongWins).toBeGreaterThan(weakWins);
  });

  it("赢了才加胜场，输赢都算一次挑战，奖励也不同", () => {
    const s = saveAtLevel(30);
    const won = applyArena(s, { ...runArena(s, 1), win: true, coins: 100, exp: 100, stars: 3 });
    expect(won.arenaWins).toBe(1);
    expect(won.arenaPlays).toBe(1);
    expect(won.coins).toBeGreaterThan(s.coins);
    const lost = applyArena(s, { ...runArena(s, 1), win: false, coins: 20, exp: 10, stars: 0 });
    expect(lost.arenaWins).toBe(0);
    expect(lost.arenaPlays).toBe(1);
  });

  it("换同伴不会让同一个人站两个位置", () => {
    let s = saveAtLevel(10, { party: ["nuonuo", "yunyun"] });
    s = setPartyMember(s, 0, "yunyun");
    expect(new Set(s.party).size).toBe(2);
    expect(s.party[0]).toBe("yunyun");
    // 不存在的同伴不会被换上去
    const before = s.party.slice();
    expect(setPartyMember(s, 1, "不存在").party).toEqual(before);
  });

  it("对战结算里没有任何受伤或死亡的说法", () => {
    const s = saveAtLevel(30, { ranks: { gustStep: 3 }, loadout: ["gustStep"] });
    for (const seed of [1, 2, 3]) {
      const out = runArena(s, seed);
      const all = out.text + out.result.events.map((e) => e.text).join("");
      for (const bad of ["血", "死", "受伤", "阵亡", "杀"]) expect(all).not.toContain(bad);
    }
  });
});
