/**
 * 勇者小路 · 窗口 4 档A · 第 2 轮测试员。
 *
 * 第 1 轮只走了第 1 / 100 / 188 关。这一轮换关卡、换模式，专盯三件事：
 *  ① 难度曲线——188 关一路爬上去，达标勇者会不会突然卡住；
 *  ② 竞态——同一回合双方同时倒下、眩晕撞上出手、技能冷却与「刚用过」的那一格；
 *  ③ 无尽之路和擂台到底能撑多久、会不会因为一个没人提醒的操作就打不动。
 * 本段只读不改：一行玩法代码都没动。
 */
import { describe, expect, it } from "vitest";
import {
  makeFighter, simulateBattle, simulateScript, simulateTeamBattle, startCombat, resolveRound,
  computeDamage, actionAllowed, skillReady, readySkills, hpRatio, effectiveAtk, itemCount,
  judgeByHp, mulberry32, elementMultiplier, MIN_DAMAGE, MAX_SINGLE_HIT_RATIO, GUARD_REDUCE,
  STRONG_MULTIPLIER, RESIST_MULTIPLIER, MAX_SKILL_RANK, skillPowerAtRank, SKILLS,
  type Element, type Fighter, type Action
} from "./combat";
import {
  BOSSES, TOTAL_LEVELS, bossLevels, buildLevel, chapterOfLevel, expectedHero, makeBossSpec, rateByHp,
  CLIMAX_EASE
} from "./levels";
import {
  applyBlessing, buildHero, defaultSave, endlessCoins, endlessExp, endlessEndText, endlessFoeSpec,
  endlessStarReward, endlessTier, isBlessingFloor, isEndlessGuardian, rollBlessings, runArena,
  arenaScale, gearFactor, heroStats, powerScore, learnSkill, toggleLoadout, SKILL_UNLOCKS,
  LOADOUT_SLOTS, MIN_LOADOUT, canUnequip, BLESSING_EVERY, BLESSING_RESCUE_FRAC, ENDLESS_GROWTH,
  FIRST_GUARDIAN, guardianThickness, type HeroSave
} from "./logic";
import { REST_EVERY, fullRoute, ghostPace, ghostTotalMs, isRestFloor, judgeRace, roadMaze, rollSupplies, validateMaze } from "./maze";

const HURT_WORDS = ["血", "死", "受伤", "阵亡", "杀", "尸"];

/** 造一个「刚好达到这一关设计水平」的勇者，口径和第 1 轮一致 */
function refHero(level: number, element: Element, rankBoost = 0): Fighter {
  const s = expectedHero(level);
  const rank = Math.max(1, Math.min(5, 1 + Math.floor(level / 45) + rankBoost));
  return makeFighter({
    name: "鸭梨", emoji: "🌸", element,
    maxHp: s.maxHp, atk: s.atk, def: s.def, spd: s.spd, crit: 0.1,
    skills: [{ id: "gustStep", rank }, { id: "crackHammer", rank }, { id: "warmSong", rank }],
    bag: [{ id: "honey", count: 2 }, { id: "berry", count: 2 }]
  });
}

/** 一关从头走到尾：星芒不回满，路上遇到什么打什么 */
function walk(level: number, hero: Fighter, seed: number): boolean {
  const plan = buildLevel(level);
  let cur = hero;
  for (let i = 0; i < plan.steps.length; i++) {
    const node = plan.steps[i][0];
    if (node.kind === "rest") {
      cur = { ...cur, hp: Math.min(cur.maxHp, cur.hp + Math.round(cur.maxHp * (node.healRatio ?? 0.3))) };
      continue;
    }
    if (!node.foe) continue;
    const res = simulateBattle(cur, makeFighter(node.foe), seed + i * 131 + 7, 60);
    if (res.winner !== "hero" || res.final.hero.hp <= 0) return false;
    cur = res.final.hero;
  }
  return true;
}

/** 达标勇者在这一关的通关次数（跑 tries 遍换种子） */
function clearRate(level: number, tries = 6): number {
  const el: Element = BOSSES[chapterOfLevel(level)].weakness;
  let ok = 0;
  for (let s = 0; s < tries; s++) if (walk(level, refHero(level, el), s * 7919 + 3)) ok++;
  return ok;
}

/** 一个「一路正常玩过来」的存档：每升一级 1 点技能点，学到哪算哪 */
function grownSave(level: number): HeroSave {
  let save: HeroSave = { ...defaultSave(), level, skillPoints: level };
  for (const u of SKILL_UNLOCKS) {
    if (u.reqLevel > level) continue;
    const r = learnSkill(save, u.id);
    if (r.ok) save = r.save;
  }
  let guard = 0;
  while (save.skillPoints > 0 && guard++ < 200) {
    let spent = false;
    for (const id of Object.keys(save.ranks)) {
      const r = learnSkill(save, id);
      if (r.ok) { save = r.save; spent = true; }
    }
    if (!spent) break;
  }
  return save;
}

/** 一个存档从第 1 层往下走，能走到第几层 */
function endlessDepth(save: HeroSave): number {
  let hero = buildHero(save);
  let depth = 0;
  for (let d = 1; d <= 400; d++) {
    const res = simulateBattle(hero, makeFighter(endlessFoeSpec(d)), d * 31 + 7, 60);
    if (res.winner !== "hero") break;
    depth = d;
    hero = { ...res.final.hero };
    if (isBlessingFloor(d)) hero = applyBlessing(hero, rollBlessings(d, hero.hp / hero.maxHp)[0]);
  }
  return depth;
}

/** 这一轮抽查的关卡：横跨八章，一个第 1 关都不带 */
const SPOTS = [17, 33, 51, 74, 96, 118, 141, 163, 180];

describe("勇者小路 · R2 · 换关卡再走一遍", () => {
  it("九关抽查，达标勇者一口气从头走到尾", () => {
    for (const lv of SPOTS) {
      const el: Element = BOSSES[chapterOfLevel(lv)].weakness;
      expect(walk(lv, refHero(lv, el), lv * 977 + 13), `第 ${lv + 1} 关`).toBe(true);
    }
  });

  it("八位首领关都打得下来，而且每一关都留着满状态整装点", () => {
    for (const lv of bossLevels()) {
      const plan = buildLevel(lv);
      expect(plan.boss, `第 ${lv + 1} 关`).toBe(true);
      expect(plan.steps[plan.steps.length - 1][0].kind).toBe("boss");
      expect(
        plan.steps.some((opts) => opts.some((n) => n.kind === "rest" && (n.healRatio ?? 0) >= 1)),
        `第 ${lv + 1} 关门口没有整装点`
      ).toBe(true);
      const el = BOSSES[chapterOfLevel(lv)].weakness;
      expect(walk(lv, refHero(lv, el, 1), lv * 313 + 5), `第 ${lv + 1} 关`).toBe(true);
    }
  });

  it("光着身子的小勇者硬闯末章会输，收场话里没有一个吓人的字", () => {
    const weak = makeFighter({ name: "鸭梨", emoji: "🌸", element: "grass", maxHp: 30, atk: 3, def: 1, spd: 5, crit: 0 });
    const res = simulateBattle(weak, makeFighter(makeBossSpec(bossLevels()[5])), 909, 60);
    expect(res.winner).toBe("foe");
    const end = res.events.filter((e) => e.kind === "end");
    expect(end.length).toBe(1);
    for (const bad of HURT_WORDS) expect(end[0].text).not.toContain(bad);
    expect(rateByHp(0)).toBe(1);
  });
});

describe("勇者小路 · R2 · 难度曲线", () => {
  it("设计水平一路往上：等级越高，参照勇者越强，怪也越强", () => {
    let lastHero = 0;
    for (let lv = 0; lv < TOTAL_LEVELS; lv += 10) {
      const now = powerScore({ ...expectedHero(lv), crit: 0.1 });
      expect(now, `第 ${lv + 1} 关`).toBeGreaterThan(lastHero);
      lastHero = now;
    }
  });

  it("每章开头会松一口气：新章第 1 关的怪不比上一章首领更凶", () => {
    for (const boss of bossLevels()) {
      if (boss + 1 >= TOTAL_LEVELS) continue;
      const bossFoe = makeBossSpec(boss);
      const nextPlan = buildLevel(boss + 1);
      const nextFoe = nextPlan.steps.map((s) => s[0].foe).find(Boolean)!;
      expect(nextFoe.maxHp, `第 ${boss + 2} 关`).toBeLessThan(bossFoe.maxHp);
    }
  });

  /**
   * W4A-15（中等）· 已由本轮监督修复员修掉。
   *
   * 原状：拿「刚好达到这一关设计水平、带三个技能」的勇者，每关换六个种子各走一遍，
   * 188 关里有 5 关不是每次都过——135 / 138 / 139 / 153 / 155，各是 5/6。
   * 根因是精英的数值照「满状态迎战」配（首领关索性在门口摆整装石），
   * 可普通关没有整装石，一路打过来的消耗全带进收尾那一场。
   *
   * 现状：`easeClimaxElite` 给收尾那只精英按「到它跟前时攒了多少疲劳」松一成
   * （`CLIMAX_EASE`）。一架都没打过就不松——那种情况本来就是满状态迎战。
   */
  it("W4A-15 已修：188 关全部六局六过，一关不剩", () => {
    const shaky: number[] = [];
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) if (clearRate(lv) < 6) shaky.push(lv + 1);
    expect(shaky).toEqual([]);
  });

  it("W4A-15 已修：原来那 5 关加倍换种子也稳得住", () => {
    for (const lv of [135, 138, 139, 153, 155]) {
      expect(clearRate(lv - 1, 14), `第 ${lv} 关`).toBe(14);
    }
  });

  it("W4A-15 已修：松的只是「打过架之后」的收尾精英，满状态迎战的一点没松", () => {
    const isFight = (k: string) => k === "foe" || k === "elite" || k === "boss";
    let eased = 0;
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const steps = buildLevel(lv).steps;
      const last = steps.length - 1;
      const climax = steps[last].find((o) => o.kind === "elite");
      if (!climax) continue;
      let wear = 0;
      for (let i = 0; i < last; i++) {
        if (steps[i].every((o) => o.kind === "rest")) wear = 0;
        else if (steps[i].some((o) => isFight(o.kind))) wear += steps[i].some((o) => o.kind === "elite") ? 2 : 1;
      }
      if (wear >= 1) eased++;
      // 首领关不在此列：门口有整装石，本来就是满状态迎战
      expect(buildLevel(lv).boss).toBe(false);
    }
    expect(eased).toBeGreaterThan(30);
    expect(CLIMAX_EASE).toBe(0.9);
  });

  it("W4A-15 已修：松一成之后收尾精英还是明显强过同关小怪，不是白挂个名", () => {
    let checked = 0;
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const steps = buildLevel(lv).steps;
      const climax = steps[steps.length - 1].find((o) => o.kind === "elite");
      const grunt = steps.slice(0, -1).flat().find((o) => o.kind === "foe");
      if (!climax?.foe || !grunt?.foe) continue;
      expect(climax.foe.maxHp, `第 ${lv + 1} 关`).toBeGreaterThan(grunt.foe.maxHp);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("W4A-15 已修：第 155 关的三连打结构没被拆掉，只是收尾松了一成", () => {
    const foesOf = (lv: number) => buildLevel(lv).steps.filter((s) => s[0].foe).length;
    const restsOf = (lv: number) => buildLevel(lv).steps.filter((s) => s[0].kind === "rest").length;
    expect(foesOf(154)).toBe(3);
    expect(restsOf(154)).toBe(0);
    expect(foesOf(153)).toBeLessThan(3);
    expect(foesOf(156)).toBeLessThan(3);
    // 最后一场是精英，星芒上限明显高过前面的小怪。
    // （门槛从 1.3 调到 1.2：第 3 轮修 W4A-17 时，「同一段里夹着两场以上」的
    // 车轮路松到了 DEEP_EASE，这一关正是那个形状。松完仍有小怪的 1.25 倍，
    // 它还是那只一眼看得出更难缠的精英。）
    const steps = buildLevel(154).steps;
    const elite = steps[steps.length - 1][0];
    expect(elite.kind).toBe("elite");
    expect(elite.foe!.maxHp).toBeGreaterThan(steps[0][0].foe!.maxHp * 1.2);
  });

  it("差一截等级还有救：低 12 级的勇者绝大多数关照样走得通", () => {
    let ok = 0;
    const spots = [17, 33, 51, 74, 96, 118, 141, 163, 180];
    for (const lv of spots) {
      const el: Element = BOSSES[chapterOfLevel(lv)].weakness;
      if (walk(lv, refHero(Math.max(0, lv - 12), el), lv * 977 + 13)) ok++;
    }
    expect(ok / spots.length).toBeGreaterThanOrEqual(0.7);
  });
});

describe("勇者小路 · R2 · 竞态", () => {
  const dummy = (over: Partial<Parameters<typeof makeFighter>[0]> = {}) =>
    makeFighter({ name: "鸭梨", emoji: "🌸", element: "light", maxHp: 100, atk: 20, def: 5, spd: 10, crit: 0, ...over });

  it("一场只会有一条收场事件：同一回合里赢家定了就立刻收手", () => {
    for (let s = 0; s < 40; s++) {
      const res = simulateBattle(refHero(30, "light"), makeFighter(endlessFoeSpec(6)), s * 71 + 3, 60);
      expect(res.events.filter((e) => e.kind === "end").length, `seed ${s}`).toBeLessThanOrEqual(1);
    }
  });

  it("倒下的一方不会在同一回合里再出一次手", () => {
    const slow = dummy({ spd: 1, maxHp: 1 });
    const fast = dummy({ name: "康康", emoji: "⭐", spd: 99, atk: 999 });
    const st = startCombat(fast, slow);
    const res = resolveRound(st, { kind: "attack" }, mulberry32(9));
    expect(res.state.over).toBe(true);
    expect(res.state.foe.hp).toBe(0);
    // 收场之后再叫一次也不动数
    const again = resolveRound(res.state, { kind: "attack" }, mulberry32(9));
    expect(again.events).toEqual([]);
    expect(again.state.hero.hp).toBe(res.state.hero.hp);
  });

  it("一招打不掉对手一半以上的星芒：秒杀被封死了", () => {
    const out = computeDamage({
      atk: 99999, def: 0, power: 10, attackElement: "fire", defendElement: "grass",
      defendMaxHp: 200, crit: true, guarding: false
    });
    expect(out.hpDamage).toBeLessThanOrEqual(Math.ceil(200 * MAX_SINGLE_HIT_RATIO));
    expect(out.hpDamage).toBeGreaterThanOrEqual(MIN_DAMAGE);
  });

  it("防御和属性克制是相乘的，不会互相吃掉", () => {
    const base = { atk: 100, def: 10, power: 1, attackElement: "fire" as Element, defendElement: "grass" as Element, defendMaxHp: 9999 };
    const plain = computeDamage({ ...base, guarding: false }).hpDamage;
    const guarded = computeDamage({ ...base, guarding: true }).hpDamage;
    expect(guarded).toBeLessThan(plain);
    expect(guarded / plain).toBeCloseTo(GUARD_REDUCE, 1);
    expect(elementMultiplier("fire", "grass")).toBe(STRONG_MULTIPLIER);
    expect(elementMultiplier("grass", "fire")).toBe(RESIST_MULTIPLIER);
  });

  it("再怎么被克，一下也至少掉 1 点——不会出现「打了等于没打」", () => {
    const out = computeDamage({
      atk: 1, def: 9999, power: 0.1, attackElement: "grass", defendElement: "fire",
      defendMaxHp: 500, guarding: true
    });
    expect(out.hpDamage).toBe(MIN_DAMAGE);
  });

  it("刚用过的技能这一回合不减冷却，下一回合才开始走表", () => {
    const hero = dummy({ skills: [{ id: "gustStep", rank: 1 }] });
    const foe = dummy({ name: "康康", emoji: "⭐", maxHp: 9999, atk: 1, spd: 1 });
    const skillId = hero.skills[0].id;
    let st = startCombat(hero, foe);
    expect(skillReady(st.hero, skillId)).toBe(true);
    const used = resolveRound(st, { kind: "skill", skillId }, mulberry32(5));
    st = used.state;
    // 刚用过 → 一定在冷却里
    expect(skillReady(st.hero, skillId)).toBe(false);
    const cd = st.hero.cooldowns[skillId];
    // 再走一回合冷却才往下掉
    st = resolveRound(st, { kind: "attack" }, mulberry32(6)).state;
    expect(st.hero.cooldowns[skillId]).toBeLessThan(cd);
  });

  it("冷却没转好就点技能，系统直接不让点（不会白白丢一个回合）", () => {
    const hero = dummy({ skills: [{ id: "gustStep", rank: 1 }] });
    const foe = dummy({ name: "康康", emoji: "⭐", maxHp: 9999, atk: 1, spd: 1 });
    const skillId = hero.skills[0].id;
    let st = startCombat(hero, foe);
    st = resolveRound(st, { kind: "skill", skillId }, mulberry32(5)).state;
    const act: Action = { kind: "skill", skillId };
    expect(actionAllowed(st.hero, act)).toBe(false);
    expect(readySkills(st.hero)).not.toContain(skillId);
  });

  it("道具用完了就点不动，不会点出负数", () => {
    const hero = dummy({ bag: [{ id: "honey", count: 1 }] });
    expect(itemCount(hero, "honey")).toBe(1);
    expect(actionAllowed(hero, { kind: "item", itemId: "honey" })).toBe(true);
    const foe = dummy({ name: "康康", emoji: "⭐", maxHp: 9999, atk: 5, spd: 1 });
    let st = startCombat({ ...hero, hp: 10 }, foe);
    st = resolveRound(st, { kind: "item", itemId: "honey" }, mulberry32(3)).state;
    expect(itemCount(st.hero, "honey")).toBe(0);
    expect(actionAllowed(st.hero, { kind: "item", itemId: "honey" })).toBe(false);
  });

  it("眩晕撞上出手：转圈圈的那个回合不出招，但眩晕会自己走完", () => {
    const hero = dummy({ spd: 99 });
    const foe = dummy({ name: "康康", emoji: "⭐", maxHp: 9999, atk: 1, spd: 1 });
    let st = startCombat(hero, foe);
    st = { ...st, foe: { ...st.foe, stun: 1 } };
    const res = resolveRound(st, { kind: "attack" }, mulberry32(11));
    expect(res.events.some((e) => e.kind === "stun")).toBe(true);
    expect(res.state.foe.stun).toBe(0);
  });

  it("打满上限还没分胜负就按剩余星芒比例判，比例一样就是平局", () => {
    const a = dummy({ maxHp: 100 });
    const b = dummy({ name: "康康", emoji: "⭐", maxHp: 100 });
    const st = startCombat(a, b);
    expect(judgeByHp(st)).toBeNull();
    expect(judgeByHp({ ...st, foe: { ...st.foe, hp: 90 } })).toBe("hero");
    expect(judgeByHp({ ...st, hero: { ...st.hero, hp: 90 } })).toBe("foe");
    expect(hpRatio({ ...a, hp: 0 })).toBe(0);
  });

  it("同一份输入永远打出同一场：脚本战斗可复现", () => {
    const script: Action[] = [{ kind: "attack" }, { kind: "guard" }, { kind: "attack" }, { kind: "attack" }];
    const a = simulateScript(refHero(20, "light"), makeFighter(endlessFoeSpec(4)), script, 4242);
    const b = simulateScript(refHero(20, "light"), makeFighter(endlessFoeSpec(4)), script, 4242);
    expect(a.winner).toBe(b.winner);
    expect(a.final.hero.hp).toBe(b.final.hero.hp);
    expect(a.events.length).toBe(b.events.length);
  });

  it("技能等级越高越有劲，但封顶在 5 级", () => {
    const skill = SKILLS.gustStep;
    expect(skillPowerAtRank(skill, 2)).toBeGreaterThan(skillPowerAtRank(skill, 1));
    expect(skillPowerAtRank(skill, MAX_SKILL_RANK + 3)).toBe(skillPowerAtRank(skill, MAX_SKILL_RANK));
    expect(effectiveAtk(dummy())).toBeGreaterThan(0);
  });
});

describe("勇者小路 · R2 · 无尽之路能走多深", () => {
  it("练得越久走得越深：等级和深度一路同向", () => {
    let last = 0;
    for (const lv of [1, 12, 20, 30, 45, 60]) {
      const d = endlessDepth(grownSave(lv));
      expect(d, `${lv} 级`).toBeGreaterThanOrEqual(last);
      last = d;
    }
    // 满级也终究会停下来：无尽不是无敌
    expect(last).toBeGreaterThan(20);
    expect(last).toBeLessThan(400);
  });

  it("怪一层比一层强，是复利不是加法——所以「无尽」一定收得住", () => {
    expect(ENDLESS_GROWTH).toBeGreaterThan(1);
    const hp = [1, 10, 20, 30].map((d) => endlessFoeSpec(d).maxHp);
    for (let i = 1; i < hp.length; i++) expect(hp[i]).toBeGreaterThan(hp[i - 1]);
    expect(hp[3] / hp[0]).toBeGreaterThan(10);
    // 层级标签也跟着涨，孩子看得见「我下得更深了」
    expect(endlessTier(30)).toBeGreaterThan(endlessTier(3));
  });

  it("每 3 层给一次二选一祝福，星芒见底时一定有一个是回复", () => {
    expect(BLESSING_EVERY).toBe(3);
    const floors: number[] = [];
    for (let d = 1; d <= 12; d++) if (isBlessingFloor(d)) floors.push(d);
    expect(floors).toEqual([3, 6, 9, 12]);
    for (const d of floors) {
      const pick = rollBlessings(d, BLESSING_RESCUE_FRAC - 0.05);
      expect(pick).toHaveLength(2);
      expect(pick[0].id).not.toBe(pick[1].id);
      expect(pick.some((b) => b.kind === "heal" || b.kind === "maxhp"), `第 ${d} 层`).toBe(true);
    }
    // 状态还好的时候就不强塞回复了
    const healthy = rollBlessings(6, 1);
    expect(healthy).toHaveLength(2);
  });

  it("越深赏得越多，收场话点名到了第几层，一个吓人的字都没有", () => {
    expect(endlessCoins(10)).toBeGreaterThan(endlessCoins(3));
    expect(endlessExp(10)).toBeGreaterThan(endlessExp(3));
    const text = endlessEndText(12, 5);
    expect(text).toContain("第 12 层");
    for (const bad of HURT_WORDS) expect(text).not.toContain(bad);
    const stars = endlessStarReward(12, 5);
    expect(stars).toBeGreaterThanOrEqual(1);
    expect(stars).toBeLessThanOrEqual(5);
  });

  /**
   * W4A-10（建议）· 已由本轮监督修复员落地。
   *
   * 原状：守关每 8 层一位，可 1 级的鸭梨大概第 4 层就打不动了。
   * 第一次进无尽之路的孩子永远见不到守关长什么样，
   * 也就体会不到「练一练能多走几层」的那个甜头。
   *
   * 现状：第一位守关挪到第 4 层（`FIRST_GUARDIAN`），之后仍是每 8 层一位；
   * 浅层守关的厚度从 1.5 倍起步，爬到第 16 层才回到原来的 2.3 倍
   * （`guardianThickness`）——见得着，还偶尔打得赢。
   */
  it("W4A-10 已修：第一趟就撞得上守关，1 级的鸭梨正好走到它跟前", () => {
    expect(FIRST_GUARDIAN).toBe(4);
    expect(isEndlessGuardian(4)).toBe(true);
    expect(isEndlessGuardian(8)).toBe(true);
    expect(isEndlessGuardian(16)).toBe(true);
    // 第 4 层之外的浅层仍是普通小怪，不会一层一个守关
    for (const d of [1, 2, 3, 5, 6, 7, 9, 12]) expect(isEndlessGuardian(d), `第 ${d} 层`).toBe(false);
    expect(endlessDepth(grownSave(1))).toBeGreaterThanOrEqual(FIRST_GUARDIAN - 1);
  });

  it("W4A-10 已修：浅层守关薄一档，第 16 层起回到满厚", () => {
    expect(guardianThickness(4)).toBeCloseTo(1.5, 6);
    expect(guardianThickness(16)).toBeCloseTo(2.3, 6);
    expect(guardianThickness(40)).toBeCloseTo(2.3, 6);
    // 中间是一路爬上去的，不会忽然变厚
    for (let d = 5; d <= 16; d++) expect(guardianThickness(d)).toBeGreaterThan(guardianThickness(d - 1));
    // 薄归薄，还是比同层小怪厚一大截
    expect(endlessFoeSpec(4).maxHp).toBeGreaterThan(endlessFoeSpec(3).maxHp * 1.4);
    expect(endlessFoeSpec(4).isBoss).toBe(true);
  });

  it("W4A-10 已修：练得越久还是走得越深，深层的分量一点没少", () => {
    const depths = [1, 8, 20, 40, 60].map((lv) => endlessDepth(grownSave(lv)));
    for (let i = 1; i < depths.length; i++) expect(depths[i]).toBeGreaterThan(depths[i - 1]);
    expect(endlessDepth(grownSave(60))).toBeLessThan(60);
  });

  it("每 5 层有歇脚层，深层的歇脚层照样给得出补给", () => {
    expect(REST_EVERY).toBe(5);
    for (const d of [15, 25, 40]) {
      expect(isRestFloor(d)).toBe(true);
      const supplies = rollSupplies(d);
      expect(supplies.length).toBeGreaterThanOrEqual(1);
      for (const s of supplies) expect(s.name.length).toBeGreaterThan(0);
    }
  });
});

describe("勇者小路 · R2 · 擂台与竞速玩到结算", () => {
  it("好好配技能的勇者，各个等级都打得赢康康的队伍", () => {
    for (const lv of [6, 12, 20, 30, 45, 60]) {
      const save = grownSave(lv);
      expect(save.loadout.length, `${lv} 级`).toBeGreaterThan(0);
      let win = 0;
      for (let s = 0; s < 20; s++) if (runArena(save, s * 131 + 7).win) win++;
      expect(win, `${lv} 级只赢了 ${win}/20`).toBeGreaterThanOrEqual(10);
    }
  });

  /**
   * W4A-16（轻微）· 技能栏原本能卸空，卸空之后擂台几乎必输；本轮已经堵住。
   *
   * `toggleLoadout` 原来不设下限，四个技能能一个一个卸干净。卸干净之后
   * 20 级的鸭梨在擂台上从 20/20 掉到 4/20——康康那边永远带三个随等级涨阶
   * 的技能，光靠平砍追不上。现在最后一招卸不下来了，界面也换了一句专门的话。
   */
  it("W4A-16 已修：卸到只剩一招就卸不动了", () => {
    const save = grownSave(20);
    expect(LOADOUT_SLOTS).toBe(4);
    expect(save.loadout.length).toBe(LOADOUT_SLOTS);
    let bare = save;
    for (const id of save.loadout.slice()) bare = toggleLoadout(bare, id);
    expect(bare.loadout.length).toBe(MIN_LOADOUT);
    expect(canUnequip(bare)).toBe(false);
    // 再点最后那一招，存档原样返回（界面据此换提示语）
    expect(toggleLoadout(bare, bare.loadout[0])).toBe(bare);
    // 还剩两招时照样卸得动
    expect(canUnequip(save)).toBe(true);
  });

  it("W4A-16 已修：身上留着一招，擂台就还打得赢——这正是那条下限守住的东西", () => {
    const save = grownSave(20);
    let one = save;
    for (const id of save.loadout.slice()) one = toggleLoadout(one, id);
    expect(one.loadout.length).toBe(1);
    let win = 0;
    for (let s = 0; s < 20; s++) if (runArena(one, s * 131 + 7).win) win++;
    expect(win).toBeGreaterThanOrEqual(10);
    // 而真把技能栏搬空（只能靠手改存档做到）就是另一回事了
    let empty = 0;
    for (let s = 0; s < 20; s++) if (runArena({ ...save, loadout: [] }, s * 131 + 7).win) empty++;
    expect(empty).toBeLessThan(win);
  });

  it("擂台越赢越难，但难度爬得慢、封得住顶——永远留着翻盘的余地", () => {
    expect(arenaScale(0)).toBeLessThan(arenaScale(10));
    expect(arenaScale(999)).toBeLessThanOrEqual(1.2 * Math.pow(2.2, 0.6) + 1e-9);
    // 配得越好，对手只跟一部分：认真配装看得见回报
    expect(arenaScale(5, 2)).toBeLessThan(arenaScale(5, 1) * 2);
    expect(gearFactor(defaultSave())).toBeGreaterThanOrEqual(1);
  });

  it("输了不倒扣：金币经验照给，收场话只鼓励", () => {
    const save = grownSave(3);
    let sawLoss = false;
    for (let s = 0; s < 60 && !sawLoss; s++) {
      const out = runArena({ ...save, loadout: [] }, s * 17 + 1);
      if (out.win) continue;
      sawLoss = true;
      expect(out.stars).toBe(0);
      expect(out.coins).toBeGreaterThan(0);
      expect(out.exp).toBeGreaterThan(0);
      for (const bad of HURT_WORDS) expect(out.text).not.toContain(bad);
      expect(out.text).toMatch(/再来|下次|换换/);
    }
    expect(sawLoss).toBe(true);
  });

  it("接力真的换人：三对三打到一边全歇下来为止", () => {
    const mine = [refHero(30, "light"), refHero(30, "fire"), refHero(30, "water")];
    const theirs = [refHero(30, "dark"), refHero(30, "grass"), refHero(30, "light")];
    const res = simulateTeamBattle(mine, theirs, 99);
    expect(res.bouts.length).toBeGreaterThanOrEqual(3);
    expect(res.aLeft + res.bLeft).toBeGreaterThan(0);
    expect(Math.min(res.aLeft, res.bLeft)).toBe(0);
  });

  it("深层竞速的迷宫照样合法、走得通，影子越赢越快", () => {
    for (const floor of [12, 33, 55, 88]) {
      const m = roadMaze(20260827, floor);
      const chk = validateMaze(m);
      expect(chk.ok, `第 ${floor} 层`).toBe(true);
      const route = fullRoute(m);
      expect(route, `第 ${floor} 层`).not.toBeNull();
      expect(ghostTotalMs(route!, ghostPace(0))).toBeGreaterThan(ghostTotalMs(route!, ghostPace(9)));
    }
    expect(judgeRace(1000, 2000)).toBe("win");
    expect(judgeRace(2000, 1000)).toBe("lose");
    expect(judgeRace(1500, 1500)).toBe("tie");
  });
});
