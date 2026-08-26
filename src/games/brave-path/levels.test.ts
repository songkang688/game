import { describe, expect, it } from "vitest";
import {
  BOSSES,
  CHAPTERS,
  CHAPTER_ELEMENTS,
  TOTAL_LEVELS,
  bossLevels,
  buildLevel,
  chapterHint,
  chapterOfLevel,
  chapterStart,
  expectedHero,
  foeStats,
  isBossLevel,
  makeBossSpec,
  makeFoeSpec,
  rateByHp,
  stepCount,
  totalChapterSize
} from "./levels";
import { ELEMENTS, elementMultiplier, makeFighter, simulateBattle, type Element } from "./combat";
import { assertTotal } from "../level99";

describe("章节切分", () => {
  it("正好 188 关，且能通过 level99 框架的章节校验", () => {
    expect(totalChapterSize()).toBe(TOTAL_LEVELS);
    expect(TOTAL_LEVELS).toBe(188);
    expect(assertTotal(CHAPTERS, 188, "brave-path")).toBe(true);
  });

  it("至少 8 个主题章节，每章都有名字、表情、颜色和一句话说明", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(c.desc.length).toBeGreaterThan(6);
      expect(c.size).toBeGreaterThan(0);
    }
  });

  it("章节名字与主题各不相同", () => {
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(CHAPTERS.length);
    expect(new Set(CHAPTERS.map((c) => c.emoji)).size).toBe(CHAPTERS.length);
  });

  it("每一关都能算出所属章节，章节起点连续不断", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const ci = chapterOfLevel(lv);
      expect(ci).toBeGreaterThanOrEqual(0);
      expect(ci).toBeLessThan(CHAPTERS.length);
      expect(lv).toBeGreaterThanOrEqual(chapterStart(ci));
      expect(lv).toBeLessThan(chapterStart(ci) + CHAPTERS[ci].size);
    }
  });

  it("每章配了一位 Boss，Boss 关正好是每章最后一关，一共 8 位", () => {
    expect(BOSSES.length).toBe(CHAPTERS.length);
    const bosses = bossLevels();
    expect(bosses.length).toBe(CHAPTERS.length);
    expect(bosses[bosses.length - 1]).toBe(TOTAL_LEVELS - 1);
    for (const lv of bosses) expect(isBossLevel(lv)).toBe(true);
    expect(new Set(BOSSES.map((b) => b.name)).size).toBe(BOSSES.length);
  });

  it("Boss 的弱点系永远不是自己的属性，五系都在合法范围内", () => {
    for (const b of BOSSES) {
      expect(ELEMENTS).toContain(b.element);
      expect(ELEMENTS).toContain(b.weakness);
      expect(b.weakness).not.toBe(b.element);
      expect(b.tip.length).toBeGreaterThan(8);
    }
  });

  it("每章的小怪属性表都不为空，属性都合法", () => {
    expect(CHAPTER_ELEMENTS.length).toBe(CHAPTERS.length);
    for (const list of CHAPTER_ELEMENTS) {
      expect(list.length).toBeGreaterThan(0);
      for (const e of list) expect(ELEMENTS).toContain(e);
    }
  });

  it("章节小抄不会越界", () => {
    expect(chapterHint(0)).toContain(CHAPTERS[0].name);
    expect(chapterHint(-5)).toContain(CHAPTERS[0].name);
    expect(chapterHint(999)).toContain(CHAPTERS[CHAPTERS.length - 1].name);
  });
});

describe("难度曲线", () => {
  it("推荐勇者数值随关号单调上升", () => {
    for (let lv = 1; lv < TOTAL_LEVELS; lv++) {
      const a = expectedHero(lv - 1);
      const b = expectedHero(lv);
      expect(b.maxHp).toBeGreaterThanOrEqual(a.maxHp);
      expect(b.atk).toBeGreaterThanOrEqual(a.atk);
      expect(b.def).toBeGreaterThanOrEqual(a.def);
    }
  });

  it("精英比普通结实，Boss 比精英更结实", () => {
    for (const lv of [0, 40, 90, 140, 187]) {
      const n = foeStats(lv, "normal");
      const e = foeStats(lv, "elite");
      const b = foeStats(lv, "boss");
      expect(e.maxHp).toBeGreaterThan(n.maxHp);
      expect(b.maxHp).toBeGreaterThan(e.maxHp);
      expect(b.def).toBeGreaterThanOrEqual(e.def);
    }
  });

  it("关号越界也能拿到合法数值", () => {
    expect(expectedHero(-10).maxHp).toBe(expectedHero(0).maxHp);
    expect(expectedHero(9999).maxHp).toBe(expectedHero(TOTAL_LEVELS - 1).maxHp);
    expect(foeStats(0, "normal").maxHp).toBeGreaterThan(0);
  });
});

describe("小路生成", () => {
  it("188 关每一关都能生成，同一关每次生成完全一样", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const a = buildLevel(lv);
      const b = buildLevel(lv);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.level).toBe(lv);
      expect(a.steps.length).toBe(stepCount(lv));
    }
  });

  it("每一步都有 1 或 2 个选项，2 个就是岔路", () => {
    let forks = 0;
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      for (const opts of buildLevel(lv).steps) {
        expect(opts.length).toBeGreaterThanOrEqual(1);
        expect(opts.length).toBeLessThanOrEqual(2);
        if (opts.length === 2) forks++;
      }
    }
    // 岔路是这游戏的招牌，不能一条都没有
    expect(forks).toBeGreaterThan(60);
  });

  it("每一关都至少能打到一场架，不存在纯捡宝箱的关", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const plan = buildLevel(lv);
      const hasFight = plan.steps.some((opts) => opts.some((o) => o.kind === "foe" || o.kind === "elite" || o.kind === "boss"));
      expect(hasFight).toBe(true);
    }
  });

  it("Boss 关的最后一步就是 Boss，而且只有一条路可走", () => {
    for (const lv of bossLevels()) {
      const plan = buildLevel(lv);
      expect(plan.boss).toBe(true);
      const last = plan.steps[plan.steps.length - 1];
      expect(last.length).toBe(1);
      expect(last[0].kind).toBe("boss");
      expect(last[0].foe?.isBoss).toBe(true);
      expect(last[0].foe?.name).toBe(BOSSES[plan.chapterIndex].name);
    }
  });

  it("非 Boss 关里不会混进 Boss 节点", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      if (isBossLevel(lv)) continue;
      for (const opts of buildLevel(lv).steps) {
        for (const o of opts) expect(o.kind).not.toBe("boss");
      }
    }
  });

  it("宝箱有金币、小店有货、休息点有回复比例", () => {
    let chests = 0;
    let shops = 0;
    let rests = 0;
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      for (const opts of buildLevel(lv).steps) {
        for (const o of opts) {
          if (o.kind === "chest") {
            chests++;
            expect(o.coins).toBeGreaterThan(0);
          }
          if (o.kind === "shop") {
            shops++;
            expect((o.stock ?? []).length).toBeGreaterThan(0);
          }
          if (o.kind === "rest") {
            rests++;
            expect(o.healRatio).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(chests).toBeGreaterThan(50);
    expect(shops).toBeGreaterThan(5);
    expect(rests).toBeGreaterThan(5);
  });

  it("一关里最多一个小店、最多一个休息点", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const all = buildLevel(lv).steps.flat();
      expect(all.filter((o) => o.kind === "shop").length).toBeLessThanOrEqual(1);
      expect(all.filter((o) => o.kind === "rest").length).toBeLessThanOrEqual(1);
    }
  });

  it("过关奖励随关号变多，Boss 关给得更多", () => {
    expect(buildLevel(100).reward.coins).toBeGreaterThan(buildLevel(10).reward.coins);
    expect(buildLevel(100).reward.exp).toBeGreaterThan(buildLevel(10).reward.exp);
    const bossLv = bossLevels()[2];
    expect(buildLevel(bossLv).reward.coins).toBeGreaterThan(buildLevel(bossLv - 1).reward.coins);
  });

  it("每章 Boss 的机制会越来越密：后面的章节读条更勤或护盾更厚", () => {
    const first = makeBossSpec(bossLevels()[0]);
    const last = makeBossSpec(bossLevels()[BOSSES.length - 1]);
    expect(first.boss?.shieldEvery).toBe(0);
    expect(last.boss?.shieldEvery).toBeGreaterThan(0);
    expect(last.boss?.shieldAmount ?? 0).toBeGreaterThan(0);
    expect(last.boss?.chargePower ?? 0).toBeGreaterThan(first.boss?.chargePower ?? 0);
  });

  it("小怪配置的属性来自本章主题表", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv += 7) {
      const spec = makeFoeSpec(lv, "normal", lv * 31 + 1);
      expect(CHAPTER_ELEMENTS[chapterOfLevel(lv)]).toContain(spec.element);
      expect(spec.isBoss).toBe(false);
      expect(spec.maxHp).toBeGreaterThan(0);
    }
  });
});

describe("评星", () => {
  it("剩下的星芒越多星星越多", () => {
    expect(rateByHp(1)).toBe(3);
    expect(rateByHp(0.7)).toBe(3);
    expect(rateByHp(0.69)).toBe(2);
    expect(rateByHp(0.35)).toBe(2);
    expect(rateByHp(0.34)).toBe(1);
    expect(rateByHp(0)).toBe(1);
  });

  it("脏数据一律给 1 星，不会崩", () => {
    expect(rateByHp(Number.NaN)).toBe(1);
    expect(rateByHp(-3)).toBe(1);
  });
});

describe("平衡性抽查（推荐水平的勇者跑一遍 188 关）", () => {
  /** 造一个「刚好达到这一关设计水平」的勇者 */
  function refHero(level: number, element: "fire" | "water" | "grass" | "light" | "dark") {
    const s = expectedHero(level);
    const rank = Math.max(1, Math.min(5, 1 + Math.floor(level / 45)));
    return makeFighter({
      name: "朵朵",
      emoji: "🌸",
      element,
      maxHp: s.maxHp,
      atk: s.atk,
      def: s.def,
      spd: s.spd,
      crit: 0.1,
      skills: [
        { id: "gustStep", rank },
        { id: "crackHammer", rank },
        { id: "warmSong", rank }
      ],
      bag: [
        { id: "honey", count: 2 },
        { id: "berry", count: 2 }
      ]
    });
  }

  it("普通小怪：达标勇者一路顺风，回合数不拖沓", () => {
    let worst = 0;
    for (let lv = 0; lv < TOTAL_LEVELS; lv += 11) {
      const foe = makeFighter(makeFoeSpec(lv, "normal", lv * 97 + 3));
      const res = simulateBattle(refHero(lv, "light"), foe, lv * 13 + 1, 30);
      expect(res.winner).toBe("hero");
      worst = Math.max(worst, res.rounds);
    }
    expect(worst).toBeLessThanOrEqual(6);
  });

  it("精英小怪：能赢，但要多打几个回合", () => {
    for (let lv = 6; lv < TOTAL_LEVELS; lv += 23) {
      const foe = makeFighter(makeFoeSpec(lv, "elite", lv * 61 + 5));
      const res = simulateBattle(refHero(lv, "light"), foe, lv * 7 + 2, 30);
      expect(res.winner).toBe("hero");
      expect(res.rounds).toBeLessThanOrEqual(12);
    }
  });

  it("章节 Boss：满状态迎战打得赢，而且是场硬仗", () => {
    for (const lv of bossLevels()) {
      const info = BOSSES[chapterOfLevel(lv)];
      const boss = makeFighter(makeBossSpec(lv));
      const res = simulateBattle(refHero(lv, info.weakness), boss, lv * 17 + 9, 60);
      expect(res.winner).toBe("hero");
      // 打满 5 个回合以上，Boss 的读条与护盾机制才来得及出场
      expect(res.rounds).toBeGreaterThanOrEqual(5);
      expect(res.rounds).toBeLessThanOrEqual(40);
    }
  });

  it("Boss 战里读条大招与护盾机制真的会触发", () => {
    for (const lv of bossLevels().slice(1)) {
      const info = BOSSES[chapterOfLevel(lv)];
      const res = simulateBattle(refHero(lv, info.weakness), makeFighter(makeBossSpec(lv)), lv * 29 + 3, 60);
      expect(res.events.some((e) => e.kind === "charge")).toBe(true);
      expect(res.events.some((e) => e.kind === "shield")).toBe(true);
    }
  });

  it("带错徽章会明显更难打：Boss 战剩余星芒少一截", () => {
    const lv = bossLevels()[3];
    const info = BOSSES[chapterOfLevel(lv)];
    const good = simulateBattle(refHero(lv, info.weakness), makeFighter(makeBossSpec(lv)), 4242, 60);
    const bad = simulateBattle(refHero(lv, info.element), makeFighter(makeBossSpec(lv)), 4242, 60);
    expect(good.final.hero.hp).toBeGreaterThan(bad.final.hero.hp);
  });
});

/* ------------------------------------------------------------------ */
/* 整关走通：一关里好几场架是连着打的，星芒不回满                        */
/* ------------------------------------------------------------------ */

describe("整关走通（星芒在一关里连续消耗）", () => {
  /**
   * 一个会看提示的孩子出门前会挑徽章：既要打得动这一章的小怪，又不想被人家反过来克。
   * 光和暗互相克制，拿光系闯暗系章节是「打得疼、挨得也疼」的赌博打法，
   * 所以这里按「我打出去的倍率 － 我挨到的倍率」挑一枚最稳的徽章。
   */
  function smartBadge(level: number): Element {
    const foes = CHAPTER_ELEMENTS[chapterOfLevel(level)];
    let best: Element = "grass";
    let bestScore = -Infinity;
    for (const mine of ELEMENTS) {
      let score = 0;
      for (const theirs of foes) {
        score += elementMultiplier(mine, theirs) - elementMultiplier(theirs, mine);
      }
      if (score > bestScore) {
        bestScore = score;
        best = mine;
      }
    }
    return best;
  }

  /** 造一个「刚好达到这一关设计水平」的勇者 */
  function refHero(level: number, element: "fire" | "water" | "grass" | "light" | "dark") {
    const s = expectedHero(level);
    const rank = Math.max(1, Math.min(5, 1 + Math.floor(level / 45)));
    return makeFighter({
      name: "朵朵",
      emoji: "🌸",
      element,
      maxHp: s.maxHp,
      atk: s.atk,
      def: s.def,
      spd: s.spd,
      crit: 0.1,
      skills: [
        { id: "gustStep", rank },
        { id: "crackHammer", rank },
        { id: "warmSong", rank }
      ],
      bag: [
        { id: "honey", count: 2 },
        { id: "berry", count: 2 }
      ]
    });
  }

  /**
   * 照界面里的走法把一整关跑一遍：
   * 星芒**不会**在两场架之间自动回满，只有歇脚石能回一点，
   * 中途任何一场没打过就是这一关没走通。
   *
   * pickHardest = true 时，岔路一律挑「有架打」的那条，
   * 也就是这一关能遇到的最吃紧的走法。
   */
  function walkLevel(
    level: number,
    hero: ReturnType<typeof makeFighter>,
    seed: number,
    pickHardest: boolean
  ): { cleared: boolean; fights: number; hpLeft: number; atStep: number } {
    const plan = buildLevel(level);
    let cur = hero;
    let fights = 0;

    for (let i = 0; i < plan.steps.length; i++) {
      const options = plan.steps[i];
      const node = pickHardest ? (options.find((o) => o.foe) ?? options[0]) : options[0];

      if (node.kind === "rest") {
        const back = Math.round(cur.maxHp * (node.healRatio ?? 0.3));
        cur = { ...cur, hp: Math.min(cur.maxHp, cur.hp + back) };
        continue;
      }
      if (!node.foe) continue; // 宝箱 / 小摊：不掉星芒

      fights += 1;
      const res = simulateBattle(cur, makeFighter(node.foe), seed + i * 131 + 7, 60);
      if (res.winner !== "hero") return { cleared: false, fights, hpLeft: 0, atStep: i };
      cur = res.final.hero;
      if (cur.hp <= 0) return { cleared: false, fights, hpLeft: 0, atStep: i };
    }
    return { cleared: true, fights, hpLeft: cur.hp, atStep: plan.steps.length };
  }

  it("188 关每一关，达标勇者都能一口气从头走到尾", () => {
    const failed: string[] = [];
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const element = isBossLevel(lv) ? BOSSES[chapterOfLevel(lv)].weakness : smartBadge(lv);
      const out = walkLevel(lv, refHero(lv, element), lv * 977 + 13, false);
      if (!out.cleared) failed.push(`第 ${lv + 1} 关在第 ${out.atStep + 1} 步卡住`);
    }
    expect(failed).toEqual([]);
  });

  it("岔路专挑有架打的那条走，188 关照样能走通", () => {
    const failed: string[] = [];
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const element = isBossLevel(lv) ? BOSSES[chapterOfLevel(lv)].weakness : smartBadge(lv);
      const out = walkLevel(lv, refHero(lv, element), lv * 461 + 29, true);
      if (!out.cleared) failed.push(`第 ${lv + 1} 关在第 ${out.atStep + 1} 步卡住`);
    }
    expect(failed).toEqual([]);
  });

  it("一关里真的要连打好几场，不是走两步就完事", () => {
    let total = 0;
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const element = isBossLevel(lv) ? BOSSES[chapterOfLevel(lv)].weakness : smartBadge(lv);
      const out = walkLevel(lv, refHero(lv, element), lv * 313 + 5, true);
      expect(out.fights).toBeGreaterThanOrEqual(1);
      total += out.fights;
    }
    expect(total / TOTAL_LEVELS).toBeGreaterThan(1.5);
  });

  it("不会连着安排两只精英：中间一定隔着人人必经的歇脚石", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const steps = buildLevel(lv).steps;
      let sinceBreather = 0;
      for (const opts of steps) {
        if (opts.length > 0 && opts.every((o) => o.kind === "rest")) {
          sinceBreather = 0;
          continue;
        }
        if (opts.some((o) => o.kind === "elite")) {
          sinceBreather += 1;
          expect(sinceBreather, `第 ${lv + 1} 关连着排了两只精英`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("普通遭遇战真的很快：达标勇者 2–4 个回合就能收工", () => {
    const rounds: number[] = [];
    for (let lv = 0; lv < TOTAL_LEVELS; lv += 3) {
      for (let s = 0; s < 3; s++) {
        const r = simulateBattle(
          refHero(lv, smartBadge(lv)),
          makeFighter(makeFoeSpec(lv, "normal", lv * 7919 + s * 131)),
          lv * 31 + s,
          40
        );
        expect(r.winner).toBe("hero");
        rounds.push(r.rounds);
      }
    }
    expect(Math.max(...rounds)).toBeLessThanOrEqual(4);
  });

  it("Boss 关门口固定有一块能补满星芒的整装石，硬仗从满状态开打", () => {
    for (const lv of bossLevels()) {
      const steps = buildLevel(lv).steps;
      const gate = steps[steps.length - 2];
      expect(gate).toHaveLength(1);
      expect(gate[0].kind).toBe("rest");
      expect(gate[0].healRatio).toBe(1);
      // 整装石只此一块，别处不再安排歇脚
      const rests = steps.flat().filter((o) => o.kind === "rest");
      expect(rests).toHaveLength(1);
    }
  });

  it("裸装勇者硬闯后面的关会走不通——说明装备成长真的有用", () => {
    const lateLevels = [90, 130, 187];
    let stuck = 0;
    for (const lv of lateLevels) {
      const naked = refHero(0, "light"); // 停留在第 1 关水平
      if (!walkLevel(lv, naked, lv * 71 + 3, false).cleared) stuck += 1;
    }
    expect(stuck).toBe(lateLevels.length);
  });

  it("走通之后剩下的星芒够撑出三星，也不至于关关都只剩一星", () => {
    let three = 0;
    let one = 0;
    for (let lv = 0; lv < TOTAL_LEVELS; lv += 9) {
      const element = isBossLevel(lv) ? BOSSES[chapterOfLevel(lv)].weakness : smartBadge(lv);
      const hero = refHero(lv, element);
      const out = walkLevel(lv, hero, lv * 199 + 11, true);
      expect(out.cleared).toBe(true);
      const stars = rateByHp(out.hpLeft / hero.maxHp);
      if (stars === 3) three += 1;
      if (stars === 1) one += 1;
    }
    expect(three).toBeGreaterThan(0); // 打得好能拿三星
    expect(one).toBeLessThan(8); // 但也不至于关关狼狈
  });
});
