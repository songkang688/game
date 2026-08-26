// 1.1:海底大胃王 99 → 188 的三片新海域、四种新机制与前 99 关回归。
import { describe, expect, it } from "vitest";
import { LEGACY_TOTAL_LEVELS, TOTAL_LEVELS, mulberry32 } from "../level99";
import {
  BOSS_INFO,
  BUDDY_MAX,
  BUDDY_REACH,
  DEX,
  DRIFT_PERIOD,
  DRIFT_SPEED,
  FREE_GROW_SLACK,
  LEGACY_LEVELS,
  LEGACY_ZONES,
  LEVELS,
  LevelDef,
  NEW_ZONE_SIZES,
  START_RADIUS,
  THEME_SIZES,
  TOXIN_NUMB,
  ZONE_ORDER,
  ZONE_STYLE,
  ZoneId,
  bossBiteReady,
  buddyCanEat,
  buddyRadius,
  buddyStep,
  canEat,
  crushedCap,
  driftDir,
  driftVector,
  eelActive,
  eelPlan,
  eelReach,
  grow,
  isLevelUnlocked,
  isThemeUnlocked,
  levelIndicesOfTheme,
  numbFollowMult,
  parseProgress,
  sizeCapFor,
  spawnRadius,
  themeIndexOf,
  themeSize,
  themeStart,
  toxinShrink,
} from "./logic";

/** 前 99 关的「指纹」:任何一处参数被改动都会对不上 */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const NEW_ZONES: ZoneId[] = ["strait", "bloom", "trench"];
const NEW_LEVELS = Array.from({ length: TOTAL_LEVELS - LEGACY_LEVELS }, (_, i) => LEGACY_LEVELS + i);

/* ---------------- 前 99 关回归 ---------------- */

describe("海底大胃王 · 1.0 前 99 关回归", () => {
  it("章节切分前九章仍是 11 关一章,总关数 188", () => {
    expect(LEGACY_LEVELS).toBe(LEGACY_TOTAL_LEVELS);
    expect(THEME_SIZES.slice(0, LEGACY_ZONES)).toEqual(new Array(9).fill(11));
    expect(THEME_SIZES.slice(LEGACY_ZONES)).toEqual([...NEW_ZONE_SIZES]);
    expect(THEME_SIZES.reduce((a, b) => a + b, 0)).toBe(188);
    expect(LEVELS.length).toBe(TOTAL_LEVELS);
    expect(LEVELS.length).toBe(188);
  });

  it("前 99 关每关参数一笔未改(生成指纹回归)", () => {
    expect(fnv(JSON.stringify(LEVELS.slice(0, LEGACY_LEVELS)))).toBe("e913306c");
  });

  it("前 99 关一律没有任何 1.1 新机制字段与新障碍", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.buddy).toBeUndefined();
      expect(lv.pressureSlack).toBeUndefined();
      expect(lv.hazards).not.toContain("drift");
      expect(lv.hazards).not.toContain("toxin");
      expect(lv.hazards).not.toContain("pressure");
      // 老关卡的体型上限还是 1.0 的「目标 + 10」
      expect(sizeCapFor(lv)).toBe(lv.targetR + FREE_GROW_SLACK);
    }
  });

  it("前 99 关的章节归属与逐关解锁语义原封不动", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      expect(themeIndexOf(i)).toBe(Math.floor(i / 11));
      expect(LEVELS[i].zone).toBe(ZONE_ORDER[Math.floor(i / 11)]);
    }
    for (let ci = 0; ci < LEGACY_ZONES; ci++) {
      expect(themeStart(ci)).toBe(ci * 11);
      expect(themeSize(ci)).toBe(11);
      expect(levelIndicesOfTheme(ci)[0]).toBe(ci * 11);
    }
    const stars = new Array(188).fill(0);
    expect(isThemeUnlocked(stars, 0)).toBe(true);
    expect(isThemeUnlocked(stars, 1)).toBe(false);
    for (let i = 0; i < 11; i++) stars[i] = 3;
    expect(isThemeUnlocked(stars, 1)).toBe(true);
  });

  it("1.0 老存档(长度 99 的数组)读出来前 99 位一位不差,后面补零", () => {
    const legacy = Array.from({ length: 99 }, (_, i) => (i % 3) + 1);
    const restored = parseProgress(JSON.stringify(legacy), LEVELS.length);
    expect(restored.length).toBe(188);
    expect(restored.slice(0, 99)).toEqual(legacy);
    expect(restored.slice(99).every((v) => v === 0)).toBe(true);
    // 第 100 关正好跟着 1.0 的最后一关自然解锁
    expect(isLevelUnlocked(restored, 99)).toBe(true);
    expect(isLevelUnlocked(restored, 100)).toBe(false);
  });
});

/* ---------------- 三片新海域 ---------------- */

describe("海底大胃王 · 1.1 三片新海域", () => {
  it("末尾追加洋流海峡 / 荧光藻湾 / 万丈压渊共 89 关", () => {
    expect(ZONE_ORDER.slice(LEGACY_ZONES)).toEqual(NEW_ZONES);
    expect(NEW_ZONE_SIZES.reduce((a, b) => a + b, 0)).toBe(89);
    expect(NEW_ZONES.map((z) => ZONE_STYLE[z].name)).toEqual([
      "洋流海峡",
      "荧光藻湾",
      "万丈压渊",
    ]);
    for (let ci = LEGACY_ZONES; ci < ZONE_ORDER.length; ci++) {
      for (const li of levelIndicesOfTheme(ci)) {
        expect(LEVELS[li].zone).toBe(ZONE_ORDER[ci]);
      }
    }
  });

  it("新海域文案齐全,名字与简介里没有一个英文字母", () => {
    for (const z of NEW_ZONES) {
      const st = ZONE_STYLE[z];
      expect(st.emoji.length).toBeGreaterThan(0);
      expect(st.top).toMatch(/^#[0-9a-f]{6}$/i);
      expect(st.bottom).toMatch(/^#[0-9a-f]{6}$/i);
      expect(st.blurb.length).toBeGreaterThanOrEqual(8);
      expect(st.name).not.toMatch(/[A-Za-z]/);
      expect(st.blurb).not.toMatch(/[A-Za-z]/);
      expect(st.speedMult).toBeGreaterThan(1);
    }
    for (const lv of NEW_LEVELS.map((i) => LEVELS[i])) {
      expect(lv.name).not.toMatch(/[A-Za-z]/);
      expect(lv.hint).not.toMatch(/[A-Za-z]/);
      expect(lv.hint.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("三章的招牌机制各管一段,互不越界", () => {
    const strait = levelIndicesOfTheme(9);
    const bloom = levelIndicesOfTheme(10);
    const trench = levelIndicesOfTheme(11);
    // 洋流海峡:全章都有洋流
    for (const i of strait) expect(LEVELS[i].hazards).toContain("drift");
    // 荧光藻湾:全章都有毒藻鱼,且一条洋流都没有
    for (const i of bloom) {
      expect(LEVELS[i].hazards).toContain("toxin");
      expect(LEVELS[i].hazards).not.toContain("drift");
    }
    // 万丈压渊:全章都有深渊压力
    for (const i of trench) expect(LEVELS[i].hazards).toContain("pressure");
    // 深渊压力只属于第 12 章
    for (let i = 0; i < 188; i++) {
      if (themeIndexOf(i) !== 11) expect(LEVELS[i].hazards).not.toContain("pressure");
    }
    // 共生小鱼只在新三章出现
    for (const lv of LEVELS) {
      if (lv.buddy) expect(NEW_ZONES).toContain(lv.zone);
    }
    expect(NEW_LEVELS.filter((i) => LEVELS[i].buddy).length).toBeGreaterThanOrEqual(9);
  });

  it("每章至少 12 关手写,生成关的障碍组合同章不重复、也不撞手写关", () => {
    for (let ci = LEGACY_ZONES; ci < ZONE_ORDER.length; ci++) {
      const chapter = levelIndicesOfTheme(ci).map((i) => LEVELS[i]);
      const hand = chapter.filter((l) => !l.gen);
      const gens = chapter.filter((l) => l.gen);
      expect(hand.length).toBeGreaterThanOrEqual(12);
      const handSigs = new Set(hand.map((l) => [...l.hazards].sort().join(",")));
      const genSigs = new Set(gens.map((l) => [...l.hazards].sort().join(",")));
      expect(genSigs.size).toBe(gens.length);
      for (const g of genSigs) expect(handSigs.has(g)).toBe(false);
      // 手写关布局签名(障碍 + 目标 + BOSS)也两两不同
      const layout = new Set(
        hand.map((l) => `${[...l.hazards].sort().join(",")}|${l.targetR}|${l.boss ?? "-"}`),
      );
      expect(layout.size).toBe(hand.length);
    }
  });

  it("新章内部难度递进,且整体比 1.0 终章更深", () => {
    const avg = (ci: number) =>
      levelIndicesOfTheme(ci).reduce((s, i) => s + LEVELS[i].targetR, 0) / themeSize(ci);
    expect(avg(9)).toBeGreaterThan(avg(8));
    expect(avg(10)).toBeGreaterThan(avg(9));
    expect(avg(11)).toBeGreaterThan(avg(10));
    for (let ci = LEGACY_ZONES; ci < ZONE_ORDER.length; ci++) {
      const idxs = levelIndicesOfTheme(ci);
      expect(LEVELS[idxs[0]].targetR).toBeLessThan(LEVELS[idxs[idxs.length - 2]].targetR);
    }
  });

  it("第 100–188 关逐关参数都在可玩范围", () => {
    for (const i of NEW_LEVELS) {
      const lv = LEVELS[i];
      expect(lv.targetR).toBeGreaterThan(START_RADIUS);
      expect(lv.targetR).toBeGreaterThanOrEqual(56);
      expect(lv.targetR).toBeLessThanOrEqual(78);
      expect(lv.bigFishBias).toBeGreaterThan(0);
      expect(lv.bigFishBias).toBeLessThanOrEqual(0.2);
      expect(lv.hazards.length).toBeGreaterThanOrEqual(1);
      expect(lv.hazards.length).toBeLessThanOrEqual(6);
      expect(new Set(lv.hazards).size).toBe(lv.hazards.length);
      // 本章的障碍只能从本海域的 palette 里挑
      for (const hz of lv.hazards) expect(ZONE_STYLE[lv.zone].palette).toContain(hz);
    }
  });
});

/* ---------------- 三位新海域大王 ---------------- */

describe("海底大胃王 · 1.1 三位新大王", () => {
  it("旋旋鳐 / 荧荧海葵王 / 咔咔巨蚌 各守一章,血量一路往上", () => {
    const bosses = NEW_ZONES.map((z) => ZONE_STYLE[z].boss);
    expect(bosses).toEqual(["ray", "anemone", "clam"]);
    expect(BOSS_INFO.ray.name).toBe("旋旋鳐");
    expect(BOSS_INFO.anemone.name).toBe("荧荧海葵王");
    expect(BOSS_INFO.clam.name).toBe("咔咔巨蚌");
    const hps = bosses.map((b) => BOSS_INFO[b].hp);
    expect(hps).toEqual([9, 10, 11]);
    expect(BOSS_INFO.clam.hp).toBe(Math.max(...ZONE_ORDER.map((z) => BOSS_INFO[ZONE_STYLE[z].boss].hp)));
    for (let ci = LEGACY_ZONES; ci < ZONE_ORDER.length; ci++) {
      const idxs = levelIndicesOfTheme(ci);
      expect(LEVELS[idxs[idxs.length - 1]].boss).toBe(ZONE_STYLE[ZONE_ORDER[ci]].boss);
    }
  });

  it("三位新大王各带一手 1.0 没有的招:掀洋流 / 吐毒雾 / 合壳加压", () => {
    expect(BOSS_INFO.ray.drifts).toBe(true);
    expect(BOSS_INFO.anemone.poisons).toBe(true);
    expect(BOSS_INFO.clam.crushes).toBe(true);
    // 1.0 的九位大王一个新招都没沾
    for (let ci = 0; ci < LEGACY_ZONES; ci++) {
      const spec = BOSS_INFO[ZONE_STYLE[ZONE_ORDER[ci]].boss];
      expect(spec.drifts).toBeUndefined();
      expect(spec.poisons).toBeUndefined();
      expect(spec.crushes).toBeUndefined();
    }
    // 三位新大王的技能组合互不相同,也和 1.0 的九位都不一样
    const sig = (b: keyof typeof BOSS_INFO) => {
      const s = BOSS_INFO[b];
      return [s.inks, s.summons ?? "-", !!s.pulls, !!s.enrages, !!s.drifts, !!s.poisons, !!s.crushes].join("|");
    };
    const legacySigs = new Set(
      ZONE_ORDER.slice(0, LEGACY_ZONES).map((z) => sig(ZONE_STYLE[z].boss)),
    );
    const newSigs = new Set(NEW_ZONES.map((z) => sig(ZONE_STYLE[z].boss)));
    expect(newSigs.size).toBe(3);
    for (const s of newSigs) expect(legacySigs.has(s)).toBe(false);
  });

  it("每个 BOSS 关的体型上限都够长到「能咬」的大小", () => {
    for (const lv of LEVELS) {
      if (!lv.boss) continue;
      const cap = sizeCapFor(lv);
      expect(bossBiteReady(cap, BOSS_INFO[lv.boss].r)).toBe(true);
      // 咔咔巨蚌一直加压也压不到咬不动
      const crushed = crushedCap(cap, 99, lv.targetR);
      expect(crushed).toBeGreaterThan(lv.targetR);
      expect(bossBiteReady(crushed, BOSS_INFO[lv.boss].r)).toBe(true);
    }
  });
});

/* ---------------- 四种新机制的纯函数 ---------------- */

describe("海底大胃王 · 1.1 新机制", () => {
  it("洋流:整片海按周期换向,推力有上下界", () => {
    expect(DRIFT_PERIOD).toBeGreaterThan(4);
    const right = driftVector(0);
    const left = driftVector(DRIFT_PERIOD / 2);
    expect(right.fx).toBeGreaterThan(0);
    expect(left.fx).toBeLessThan(0);
    expect(driftDir(0)).toBe(1);
    expect(driftDir(DRIFT_PERIOD / 2)).toBe(-1);
    // 换向的那一刻推力接近零,不会突然把小鱼甩飞
    expect(Math.abs(driftVector(DRIFT_PERIOD / 4).fx)).toBeLessThan(1e-6);
    for (let t = 0; t < 40; t += 0.13) {
      const d = driftVector(t);
      expect(Math.hypot(d.fx, d.fy)).toBeLessThanOrEqual(DRIFT_SPEED * 1.1);
    }
    // 一个周期后回到原样
    expect(driftVector(3.3).fx).toBeCloseTo(driftVector(3.3 + DRIFT_PERIOD).fx, 6);
  });

  it("电电草:前九片海的插法和 1.0 一模一样", () => {
    for (const zone of ZONE_ORDER.slice(0, LEGACY_ZONES)) {
      expect(eelPlan(zone, 1)).toEqual([
        { fx: 0.28, offset: 0 },
        { fx: 0.55, offset: 1.3 },
        { fx: 0.82, offset: 2.5 },
      ]);
      expect(eelPlan(zone, 2).map((e) => e.fx)).toEqual([0.28, 0.55, 0.82, 0.12]);
      expect(eelPlan(zone, 3).map((e) => e.fx)).toEqual([0.28, 0.55, 0.82, 0.12, 0.68]);
    }
    expect(eelReach(20)).toBe(33);
    expect(eelReach(70)).toBe(83);
  });

  it("电电草:新三章只种两棵,而且永远不会同时通电", () => {
    for (const zone of NEW_ZONES) {
      for (const tier of [1, 2, 3]) {
        const plan = eelPlan(zone, tier);
        expect(plan).toHaveLength(2);
        // 一左一右靠边站,中间空出整整一大片
        expect(plan[1].fx - plan[0].fx).toBeGreaterThan(0.6);
        for (let t = 0; t < 40; t += 0.02) {
          const live = plan.filter((e) => eelActive(t, e.offset)).length;
          expect(live).toBeLessThanOrEqual(1);
        }
        // 也不能两棵都常年不通电,那这机制就白写了
        expect(plan.some((e) => eelActive(0.1, e.offset))).toBe(true);
        expect(plan.some((e) => eelActive(2.0, e.offset))).toBe(true);
      }
    }
  });

  it("电电草:新三章长到体型上限,375 窄屏上也总留得出一条水道", () => {
    const W = 375;
    for (let i = LEGACY_LEVELS; i < TOTAL_LEVELS; i++) {
      const lv = LEVELS[i];
      if (!lv.hazards.includes("eel")) continue;
      const plan = eelPlan(lv.zone, 3);
      const reach = eelReach(sizeCapFor(lv));
      // 就算两棵一起通电(实际不会),中间也得站得下一条满级的鱼
      const lane = plan[1].fx * W - reach - (plan[0].fx * W + reach);
      expect(lane).toBeGreaterThan(0);
      // 通电时也不能把人逼到贴着屏幕边缘
      for (const e of plan) {
        const gap = Math.min(e.fx * W, W - e.fx * W);
        expect(gap).toBeLessThan(reach);
      }
    }
  });

  it("毒藻鱼:只缩一圈不掉心,永远缩不到比出生还小,麻酥酥会自己好", () => {
    expect(toxinShrink(50)).toBeLessThan(50);
    expect(toxinShrink(50)).toBeGreaterThan(40);
    expect(toxinShrink(START_RADIUS)).toBe(START_RADIUS);
    expect(toxinShrink(1)).toBe(START_RADIUS);
    // 连吃十条也缩不穿底
    let r = 60;
    for (let i = 0; i < 10; i++) r = toxinShrink(r);
    expect(r).toBeGreaterThanOrEqual(START_RADIUS);
    expect(numbFollowMult(0)).toBe(1);
    expect(numbFollowMult(TOXIN_NUMB)).toBeCloseTo(0.45, 6);
    expect(numbFollowMult(TOXIN_NUMB / 2)).toBeGreaterThan(numbFollowMult(TOXIN_NUMB));
    expect(numbFollowMult(TOXIN_NUMB / 2)).toBeLessThan(1);
  });

  it("共生小鱼:体型是你的四成,只帮你吃小鱼,跟随会收敛,最多两条", () => {
    expect(BUDDY_MAX).toBe(2);
    expect(buddyRadius(50)).toBeCloseTo(20, 6);
    expect(buddyRadius(2)).toBe(7);
    const br = buddyRadius(50);
    expect(buddyCanEat(br, br * 0.9)).toBe(true);
    expect(buddyCanEat(br, br * 1.4)).toBe(false);
    expect(BUDDY_REACH).toBeGreaterThan(40);
    let p = { x: 0, y: 0 };
    for (let i = 0; i < 120; i++) p = buddyStep(p.x, p.y, 200, 120, 1 / 60);
    expect(Math.hypot(200 - p.x, 120 - p.y)).toBeLessThan(1);
  });

  it("深渊压力:上限收紧但一定够得着目标,加压也压不到目标以下", () => {
    for (const i of levelIndicesOfTheme(11)) {
      const lv = LEVELS[i];
      const cap = sizeCapFor(lv);
      expect(cap).toBeGreaterThan(lv.targetR);
      // 比 1.0 的「目标 + 10」紧得多,这才叫压力
      expect(cap).toBeLessThan(lv.targetR + FREE_GROW_SLACK);
      expect(cap - lv.targetR).toBeGreaterThanOrEqual(3);
      for (let n = 0; n < 20; n++) {
        expect(crushedCap(cap, n, lv.targetR)).toBeGreaterThan(lv.targetR);
      }
      expect(crushedCap(cap, 1, lv.targetR)).toBeLessThan(cap);
    }
  });

  it("生物图鉴收录了三种新生物和三位新大王", () => {
    const ids = new Set(DEX.map((d) => d.id));
    for (const id of ["drift", "toxin", "buddy", "ray", "anemone", "clam"]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(ids.size).toBe(DEX.length);
    expect(DEX.length).toBe(22);
    for (const z of ZONE_ORDER) expect(ids.has(ZONE_STYLE[z].boss)).toBe(true);
    for (const d of DEX) {
      expect(d.name).not.toMatch(/[A-Za-z]/);
      expect(d.desc).not.toMatch(/[A-Za-z]/);
    }
  });
});

/* ---------------- 第 100–188 关模拟通关 ---------------- */

interface SimResult {
  cleared: boolean;
  seconds: number;
  heartsLost: number;
  bites: number;
}

/**
 * 「合理操作」模型:每 0.75 秒尝试咬一口,命中率 skill;
 * 场上按 index.ts 的节奏 0.8 秒放一条鱼、同屏最多 9 条;
 * 毒藻鱼有 8% 概率看走眼吃下去;共生小鱼开局 12 秒后加入、每 1.1 秒帮吃一条;
 * 环境障碍按章节密度定时蹭掉一颗心;BOSS 每 2.5 秒才咬得进一口。
 * 用它来验证第 100–188 关的达标线在人类操作下真的够得着。
 */
function simulate(def: LevelDef, seed: number, skill = 0.7): SimResult {
  const rng = mulberry32(seed);
  const cap = sizeCapFor(def);
  const hasToxin = def.hazards.includes("toxin");
  const dt = 0.05;
  let r = START_RADIUS;
  let t = 0;
  let bites = 0;
  let heartsLost = 0;
  let biteTimer = 0.75;
  let spawnTimer = 0.4;
  let buddyTimer = def.buddy ? 12 : Infinity;
  let buddyEatTimer = 1.1;
  let hasBuddy = false;
  // 越深的海域环境障碍越密,蹭一下就掉一颗心
  const hurtEvery = def.hazards.length >= 5 ? 26 : 34;
  let hurtTimer = hurtEvery;
  /** 场上的鱼:半径 + 还能在屏幕里待多久(横穿一屏大约 8 秒) */
  const pool: Array<{ r: number; life: number }> = [];
  let bossHp = def.boss ? BOSS_INFO[def.boss].hp : 0;
  let bossBiteTimer = 2.5;

  /** 咬一口:挑场上最大的一条能吃的,咬不到就白挥一次 */
  function biteBest(): number {
    let best = -1;
    let bestI = -1;
    for (let i = 0; i < pool.length; i++) {
      if (canEat(r, pool[i].r) && pool[i].r > best) {
        best = pool[i].r;
        bestI = i;
      }
    }
    if (bestI < 0) return 0;
    pool.splice(bestI, 1);
    r = grow(r, best, cap);
    return 1;
  }

  while (t < 180 && heartsLost < 3) {
    t += dt;
    spawnTimer -= dt;
    if (spawnTimer <= 0 && pool.length < 9) {
      spawnTimer = 0.8;
      pool.push({ r: spawnRadius(r, rng(), def.bigFishBias), life: 7 + rng() * 3 });
    }
    // 鱼横穿一屏就游走了,场面一直在换血
    for (let i = pool.length - 1; i >= 0; i--) {
      pool[i].life -= dt;
      if (pool[i].life <= 0) pool.splice(i, 1);
    }

    hurtTimer -= dt;
    if (hurtTimer <= 0) {
      hurtTimer = hurtEvery;
      heartsLost++;
    }

    if (def.buddy) {
      buddyTimer -= dt;
      if (buddyTimer <= 0) hasBuddy = true;
    }
    if (hasBuddy && r < def.targetR) {
      buddyEatTimer -= dt;
      if (buddyEatTimer <= 0) {
        buddyEatTimer = 1.1;
        const small = buddyRadius(r) * 0.8;
        r = grow(r, small * 0.5, cap);
      }
    }

    if (r < def.targetR) {
      biteTimer -= dt;
      if (biteTimer <= 0) {
        biteTimer = 0.75;
        if (hasToxin && rng() < 0.08) {
          // 看走眼,咬到毒藻鱼
          r = toxinShrink(r);
        } else if (rng() < skill) {
          bites += biteBest();
        }
      }
      continue;
    }

    // 长够了:没有 BOSS 就直接过关,有 BOSS 就开打
    if (!def.boss) return { cleared: true, seconds: t, heartsLost, bites };
    if (!bossBiteReady(r, BOSS_INFO[def.boss].r)) {
      // 还咬不动,继续长(上限之内)
      biteTimer -= dt;
      if (biteTimer <= 0) {
        biteTimer = 0.75;
        biteBest();
      }
      continue;
    }
    bossBiteTimer -= dt;
    if (bossBiteTimer <= 0) {
      bossBiteTimer = 2.5;
      bossHp--;
      if (bossHp <= 0) return { cleared: true, seconds: t, heartsLost, bites };
    }
  }
  return { cleared: false, seconds: t, heartsLost, bites };
}

describe("海底大胃王 · 第 100–188 关模拟可通关", () => {
  it("每一关在「七成命中」的合理操作下都能在 3 分钟内长到目标并打完 BOSS", () => {
    for (const i of NEW_LEVELS) {
      const def = LEVELS[i];
      const res = simulate(def, i * 7919 + 13);
      expect(res.cleared, `第 ${i + 1} 关 ${def.name}:${res.seconds.toFixed(1)}s 掉心 ${res.heartsLost}`).toBe(true);
      expect(res.seconds, `第 ${i + 1} 关 ${def.name} 耗时`).toBeLessThan(150);
    }
  });

  it("换十个随机种子重跑,第 100 / 145 / 188 关照样每次都能通", () => {
    for (const lv of [99, 144, 187]) {
      for (let seed = 0; seed < 10; seed++) {
        const res = simulate(LEVELS[lv], seed * 104729 + 7);
        expect(res.cleared, `第 ${lv + 1} 关 种子 ${seed}`).toBe(true);
      }
    }
  });

  it("手一直抖(命中率只剩五成)也还是过得去,只是慢一点", () => {
    for (const i of [99, 120, 144, 165, 187]) {
      const res = simulate(LEVELS[i], i * 31 + 5, 0.5);
      expect(res.cleared, `第 ${i + 1} 关 低命中率`).toBe(true);
    }
  });

  it("1.0 的前 99 关拿同一个模型跑也全都过得去(模型本身站得住)", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const res = simulate(LEVELS[i], i * 6151 + 3);
      expect(res.cleared, `第 ${i + 1} 关 ${LEVELS[i].name}`).toBe(true);
    }
  });
});
