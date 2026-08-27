/**
 * 勇者小路 1.2 · 战斗透明化与成长三线的单测。
 *
 * 盯三件事：
 *  1. `resolveFight` 是纯函数，没有随机数，同样的输入永远同样的结论；
 *  2. 三档预判（打得过 / 有点悬 / 打不过）的阈值真的分得开，而且**一个数字都不报**；
 *  3. 收藏册这条线，哪怕全套满级，也顶多再多 +35%——和 `engine/collection.ts` 的上限一模一样。
 */
import { describe, expect, it } from "vitest";
import {
  BONUS_CAP_PERMILLE,
  effectsFrom,
  emptyBonus,
  emptyPerks,
  maxBonus,
  type CollectionEffects
} from "../../engine/collection";
import { STRONG_MULTIPLIER, type Element } from "./combat";
import {
  COLLECTION_CAP_PERMILLE,
  FORECAST_EASY_ABOVE,
  FORECAST_HARD_BELOW,
  FORECAST_HINTS,
  FORECAST_LABELS,
  collectionCombatBonus,
  collectionMultipliers,
  describeCollectionLine,
  expectedHit,
  forecastFight,
  forecastOf,
  resolveFight,
  type FightSide
} from "./power";

function side(over: Partial<FightSide> = {}): FightSide {
  return {
    name: "试验对象",
    element: "light",
    hp: 100,
    maxHp: 100,
    atk: 20,
    def: 5,
    spd: 10,
    crit: 0,
    critMultiplier: 1.8,
    shield: 0,
    ...over
  };
}

describe("resolveFight：没有随机数的对拼", () => {
  it("一下的力道 = 攻击 × 克制 − 防御", () => {
    const fire = side({ element: "fire", atk: 40, crit: 0 });
    const grass = side({ element: "grass", def: 10 });
    expect(expectedHit(fire, grass)).toBe(Math.round(40 * STRONG_MULTIPLIER) - 10);
  });

  it("防御再高，一下也至少打掉 1 点（不会出现 0 或负数）", () => {
    const weak = side({ atk: 1, crit: 0 });
    const wall = side({ def: 9999 });
    expect(expectedHit(weak, wall)).toBe(1);
  });

  it("暴击按期望值折进力道，不掷骰子", () => {
    const plain = side({ atk: 100, crit: 0, def: 0 });
    const lucky = side({ atk: 100, crit: 0.5, critMultiplier: 2, def: 0 });
    const target = side({ def: 0 });
    expect(expectedHit(plain, target)).toBe(100);
    // 五成暴击、两倍伤害 → 期望值正好是一倍半
    expect(expectedHit(lucky, target)).toBe(150);
  });

  it("数值全面碾压的一方获胜", () => {
    const strong = side({ atk: 90, maxHp: 300, hp: 300, def: 20, spd: 20 });
    const weak = side({ atk: 8, maxHp: 40, hp: 40, def: 0, spd: 4 });
    const out = resolveFight(strong, weak);
    expect(out.winner).toBe("attacker");
    expect(out.margin).toBeGreaterThan(0);
  });

  it("打不过的时候 winner 是防守方，margin 为负", () => {
    const weak = side({ atk: 8, maxHp: 40, hp: 40, def: 0, spd: 4 });
    const strong = side({ atk: 90, maxHp: 300, hp: 300, def: 20, spd: 20 });
    const out = resolveFight(weak, strong);
    expect(out.winner).toBe("defender");
    expect(out.margin).toBeLessThan(0);
  });

  it("回合数打平时，速度快的那边先出手也就先赢", () => {
    const quick = side({ spd: 12 });
    const slow = side({ spd: 3 });
    expect(resolveFight(quick, slow).winner).toBe("attacker");
    expect(resolveFight(slow, quick).winner).toBe("defender");
  });

  it("是纯函数：不改传进来的对象，同样的输入给同样的结果", () => {
    const a = side({ atk: 33, hp: 88 });
    const b = side({ element: "dark", atk: 27, hp: 96 });
    const snapshotA = JSON.stringify(a);
    const snapshotB = JSON.stringify(b);
    const first = resolveFight(a, b);
    const second = resolveFight(a, b);
    expect(second).toEqual(first);
    expect(JSON.stringify(a)).toBe(snapshotA);
    expect(JSON.stringify(b)).toBe(snapshotB);
  });

  it("护盾也算进「还能挨几下」里", () => {
    const hitter = side({ atk: 30 });
    const bare = side({ hp: 100, shield: 0 });
    const shielded = side({ hp: 100, shield: 200 });
    expect(resolveFight(hitter, shielded).attackerHits).toBeGreaterThan(
      resolveFight(hitter, bare).attackerHits
    );
  });
});

describe("三档预判：只给结论，不给数字", () => {
  it("碾压局判「打得过」", () => {
    const hero = side({ atk: 120, maxHp: 400, hp: 400, def: 30, spd: 18 });
    const foe = side({ atk: 9, maxHp: 40, hp: 40, def: 0, spd: 5 });
    expect(forecastFight(hero, foe)).toBe("easy");
  });

  it("势均力敌判「有点悬」", () => {
    const hero = side();
    const foe = side();
    expect(forecastFight(hero, foe)).toBe("risky");
  });

  it("被碾压判「打不过」", () => {
    const hero = side({ atk: 9, maxHp: 40, hp: 40, def: 0, spd: 5 });
    const foe = side({ atk: 120, maxHp: 400, hp: 400, def: 30, spd: 18 });
    expect(forecastFight(hero, foe)).toBe("hard");
  });

  it("阈值是连续的：三档正好覆盖整条 margin 轴，没有缝也不重叠", () => {
    const at = (margin: number) =>
      forecastOf({
        winner: "attacker",
        attackerHits: 1,
        defenderHits: 1,
        attackerHit: 1,
        defenderHit: 1,
        margin
      });
    expect(at(FORECAST_HARD_BELOW)).toBe("hard");
    expect(at(FORECAST_HARD_BELOW + 0.001)).toBe("risky");
    expect(at(FORECAST_EASY_ABOVE - 0.001)).toBe("risky");
    expect(at(FORECAST_EASY_ABOVE)).toBe("easy");
  });

  it("三档文案是中文短句，一个数字都不许有", () => {
    for (const text of [...Object.values(FORECAST_LABELS), ...Object.values(FORECAST_HINTS)]) {
      expect(text.length).toBeGreaterThan(0);
      expect(/[0-9%]/.test(text)).toBe(false);
    }
  });
});

describe("成长第三线：收藏册加成封顶 +35%", () => {
  const fullEffects: CollectionEffects = effectsFrom(maxBonus(), emptyPerks());
  const bareEffects: CollectionEffects = effectsFrom(emptyBonus(), emptyPerks());

  it("封顶常量和 collection.ts 完全一致", () => {
    expect(COLLECTION_CAP_PERMILLE).toBe(BONUS_CAP_PERMILLE);
    expect(COLLECTION_CAP_PERMILLE).toBe(350);
  });

  it("全套满级：五项加成没有一项越过 +35%", () => {
    const bonus = collectionCombatBonus(fullEffects);
    for (const key of ["atk", "def", "maxHp", "crit", "coins"] as const) {
      expect(bonus[key]).toBeLessThanOrEqual(COLLECTION_CAP_PERMILLE);
    }
    expect(bonus.peak).toBeLessThanOrEqual(COLLECTION_CAP_PERMILLE);
  });

  it("全套满级折成乘数也不超过 1.35", () => {
    const mul = collectionMultipliers(fullEffects);
    expect(mul.atkMul).toBeLessThanOrEqual(1.35);
    expect(mul.defMul).toBeLessThanOrEqual(1.35);
    expect(mul.hpMul).toBeLessThanOrEqual(1.35);
    expect(mul.coinMul).toBeLessThanOrEqual(1.35);
    expect(mul.critAdd).toBeLessThanOrEqual(0.35);
  });

  it("就算有人把收藏册的乘数改到离谱，本作这边也照样夹在 +35%", () => {
    const cheat: CollectionEffects = {
      speedMul: 9,
      jumpMul: 9,
      magnetMul: 9,
      coinMul: 9,
      luckMul: 9,
      reviveOnce: false,
      startShieldMs: 0
    };
    const bonus = collectionCombatBonus(cheat);
    expect(bonus.peak).toBe(COLLECTION_CAP_PERMILLE);
    expect(collectionMultipliers(cheat).atkMul).toBeCloseTo(1.35, 6);
  });

  it("什么都没穿：加成是 0，乘数是 1，文案明说这条线还空着", () => {
    const bonus = collectionCombatBonus(bareEffects);
    expect(bonus.peak).toBe(0);
    expect(collectionMultipliers(bareEffects).atkMul).toBe(1);
    expect(describeCollectionLine(bareEffects)).toContain("暂时是 0");
  });

  it("脏数据（NaN / 负数）一律当没有加成，不炸也不倒扣", () => {
    const dirty = {
      speedMul: Number.NaN,
      jumpMul: -3,
      magnetMul: Number.POSITIVE_INFINITY,
      coinMul: 0,
      luckMul: 1,
      reviveOnce: false,
      startShieldMs: 0
    } as CollectionEffects;
    const bonus = collectionCombatBonus(dirty);
    for (const key of ["atk", "def", "maxHp", "crit", "coins"] as const) {
      expect(bonus[key]).toBeGreaterThanOrEqual(0);
      expect(bonus[key]).toBeLessThanOrEqual(COLLECTION_CAP_PERMILLE);
    }
  });

  it("穿了东西就说得出穿了什么（文案里有百分比但没有商标）", () => {
    const text = describeCollectionLine(fullEffects);
    expect(text).toContain("%");
    expect(text).not.toContain("暂时是 0");
  });
});

describe("五系克制在预判里也说得通", () => {
  const pairs: Array<[Element, Element]> = [
    ["fire", "grass"],
    ["grass", "water"],
    ["water", "fire"],
    ["light", "dark"],
    ["dark", "light"]
  ];

  it("五对克制关系，挑对属性的那一下都更重", () => {
    for (const [strong, weak] of pairs) {
      const foe = side({ element: weak, atk: 24, maxHp: 120, hp: 120, def: 4 });
      // 基准：拿和对手同系的招去打，谁也不克谁
      const sameElement = side({ element: weak, atk: 26, maxHp: 120, hp: 120 });
      const matched = side({ element: strong, atk: 26, maxHp: 120, hp: 120 });
      expect(resolveFight(matched, foe).attackerHit).toBeGreaterThan(
        resolveFight(sameElement, foe).attackerHit
      );
    }
  });

  it("火草水这条单向三角里，挑对属性能把余裕拉宽", () => {
    // 光和暗是**互相**克的：挑光去打暗，对面回敬的也是 1.5 倍，
    // 所以只有单向克制的三角才谈得上「挑对属性更划算」。
    const oneWay: Array<[Element, Element]> = [
      ["fire", "grass"],
      ["grass", "water"],
      ["water", "fire"]
    ];
    for (const [strong, weak] of oneWay) {
      const foe = side({ element: weak, atk: 24, maxHp: 120, hp: 120, def: 4 });
      const sameElement = side({ element: weak, atk: 26, maxHp: 120, hp: 120 });
      const matched = side({ element: strong, atk: 26, maxHp: 120, hp: 120 });
      expect(resolveFight(matched, foe).margin).toBeGreaterThan(resolveFight(sameElement, foe).margin);
    }
  });

  it("光暗互相克：换成光去打暗，占的便宜和吃的亏一样多", () => {
    const dark = side({ element: "dark", atk: 24, maxHp: 120, hp: 120, def: 4 });
    const light = side({ element: "light", atk: 26, maxHp: 120, hp: 120 });
    const out = resolveFight(light, dark);
    expect(out.attackerHit).toBeGreaterThan(26 - 4);
    expect(out.defenderHit).toBeGreaterThan(24 - 5);
  });
});
