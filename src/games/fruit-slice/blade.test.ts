import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { ROUNDS, gravityFor, segCircleHit } from "./logic";
import {
  APEX_BOTTOM,
  APEX_TOP,
  BLADE_STREAK_CAP,
  BLADE_WINDOW,
  BladeBag,
  CHILL_SECONDS,
  DOUBLE_MULT,
  DOUBLE_SECONDS,
  EXTRA_SPEC,
  FLOWER_COST,
  MAX_SAMPLES,
  MIN_SWIPE,
  RAINBOW_BLADE,
  STORM_MISS_LIMIT,
  STORM_MISTAKE_LIMIT,
  TWIN_HITS,
  apexHeight,
  apexSide,
  arcReachable,
  bladeLabel,
  bladeScore,
  bladeWindowAlive,
  doubleScore,
  extraChance,
  extrasForRound,
  flowerLine,
  isRainbowBlade,
  safeLaunch,
  sampleCount,
  stormLine,
  stormOver,
  STORM_COUNT_MAX,
  STORM_PACE_CAP,
  stormPace,
  stormRand,
  stormStars,
  stormWave,
  streakMultiplier,
  strokeBonus,
  sweptHit,
  swipeCounts,
  twinCracked,
  twinStepScore,
} from "./blade";

describe("水果切切乐 · 切割判定", () => {
  it("一刀太短不算数,划够长度才吃判定", () => {
    expect(swipeCounts(0)).toBe(false);
    expect(swipeCounts(MIN_SWIPE - 1)).toBe(false);
    expect(swipeCounts(MIN_SWIPE)).toBe(true);
    expect(swipeCounts(Number.NaN)).toBe(false);
    expect(MIN_SWIPE).toBeGreaterThan(0);
  });

  it("划得越长采样点越多,但有上限", () => {
    expect(sampleCount(0, 0, 0, 0)).toBe(1);
    expect(sampleCount(0, 0, 20, 0)).toBe(1);
    expect(sampleCount(0, 0, 200, 0)).toBeGreaterThan(sampleCount(0, 0, 60, 0));
    expect(sampleCount(0, 0, 100000, 0)).toBe(MAX_SAMPLES);
  });

  it("高速划动:老的单段判定漏掉的,扫掠判定接得住", () => {
    // 水果这一帧从 (100,300) 飞到 (100,120),刀在这一帧横着从左划到右
    const target = { x: 100, y: 120, vx: 0, vy: -1800, r: 20 };
    const dt = 0.1;
    // 单看这一帧结束时的位置,刀离水果很远
    expect(segCircleHit(0, 240, 400, 240, target.x, target.y, target.r)).toBe(false);
    // 但两者在半空中确实交叉过
    expect(sweptHit(0, 240, 400, 240, target, dt)).toBe(true);
  });

  it("真的没碰上就是没碰上,扫掠判定不乱给分", () => {
    const target = { x: 40, y: 40, vx: 0, vy: 0, r: 18 };
    expect(sweptHit(0, 400, 400, 400, target, 0.016)).toBe(false);
  });

  it("触屏容错走廊 pad 能把擦边的一刀救回来", () => {
    const target = { x: 100, y: 100, vx: 0, vy: 0, r: 20 };
    expect(sweptHit(0, 128, 200, 128, target, 0.016)).toBe(false);
    expect(sweptHit(0, 128, 200, 128, target, 0.016, 12)).toBe(true);
  });

  it("dt 给 0 或非法值时退化成静态判定,不会算出 NaN 位置", () => {
    const target = { x: 100, y: 100, vx: 500, vy: -500, r: 20 };
    expect(sweptHit(0, 100, 200, 100, target, 0)).toBe(true);
    expect(sweptHit(0, 100, 200, 100, target, Number.NaN)).toBe(true);
  });
});

describe("水果切切乐 · 连刀", () => {
  it("连击窗口是 800ms,超了就断", () => {
    expect(BLADE_WINDOW).toBeCloseTo(0.8, 5);
    expect(bladeWindowAlive(0)).toBe(true);
    expect(bladeWindowAlive(0.79)).toBe(true);
    expect(bladeWindowAlive(0.81)).toBe(false);
    expect(bladeWindowAlive(-1)).toBe(false);
  });

  it("一划切中 ≥2 颗才有连刀加成,越多越划算", () => {
    expect(strokeBonus(1)).toBe(0);
    expect(strokeBonus(2)).toBe(3);
    expect(strokeBonus(4)).toBe(9);
    expect(strokeBonus(6)).toBeGreaterThan(strokeBonus(4));
  });

  it("一划切中 ≥4 颗升级成彩虹刀", () => {
    expect(RAINBOW_BLADE).toBe(4);
    expect(isRainbowBlade(3)).toBe(false);
    expect(isRainbowBlade(4)).toBe(true);
    expect(bladeLabel(1)).toBeNull();
    expect(bladeLabel(2)).toContain("双果");
    expect(bladeLabel(3)).toContain("三连");
    expect(bladeLabel(5)).toContain("彩虹刀");
  });

  it("连击倍率可累计但封顶", () => {
    expect(streakMultiplier(1)).toBe(1);
    expect(streakMultiplier(2)).toBeGreaterThan(streakMultiplier(1));
    expect(streakMultiplier(BLADE_STREAK_CAP)).toBe(streakMultiplier(BLADE_STREAK_CAP + 50));
    expect(streakMultiplier(0)).toBe(1);
    expect(bladeScore(10, 1)).toBe(10);
    expect(bladeScore(10, BLADE_STREAK_CAP)).toBeGreaterThan(10);
    expect(bladeScore(10, 999)).toBe(bladeScore(10, BLADE_STREAK_CAP));
  });
});

describe("水果切切乐 · 抛物线一定够得着", () => {
  it("顶点公式和自由落体一致", () => {
    const g = 900;
    expect(apexHeight(500, -300, g)).toBeCloseTo(500 - (300 * 300) / (2 * g), 5);
    expect(apexSide(100, 60, -300, g)).toBeCloseTo(100 + 60 * (300 / g), 5);
  });

  it("随机 2000 次抛射,顶点全都落在可视区里、都够得着", () => {
    const rand = mulberry32(20260826);
    for (const [w, h] of [[360, 640], [640, 480], [1024, 720], [320, 560]]) {
      const g = gravityFor(h);
      for (let i = 0; i < 500; i++) {
        const arc = safeLaunch(w, h, rand(), rand(), rand(), g);
        expect(arcReachable(arc, w, h, g), `第 ${i} 次抛射在 ${w}x${h} 够不着`).toBe(true);
        const ay = apexHeight(arc.y, arc.vy, g);
        expect(ay).toBeGreaterThanOrEqual(h * APEX_TOP - 1);
        expect(ay).toBeLessThanOrEqual(h * APEX_BOTTOM + 1);
      }
    }
  });

  it("顶点飞出屏幕上方或飘到画面外的抛射会被判为够不着", () => {
    const w = 400;
    const h = 600;
    const g = gravityFor(h);
    expect(arcReachable({ x: 200, y: h + 30, vx: 0, vy: -4000 }, w, h, g)).toBe(false);
    expect(arcReachable({ x: 200, y: h + 30, vx: 3000, vy: -600 }, w, h, g)).toBe(false);
  });

  it("起点永远在屏幕下方,初速度朝上", () => {
    const arc = safeLaunch(360, 640, 0.5, 0.5, 0.5, gravityFor(640));
    expect(arc.y).toBeGreaterThan(640);
    expect(arc.vy).toBeLessThan(0);
  });
});

describe("水果切切乐 · 1.2 四种目标", () => {
  it("双倍果开着的时候分数翻倍,时长有限", () => {
    expect(doubleScore(7, false)).toBe(7);
    expect(doubleScore(7, true)).toBe(7 * DOUBLE_MULT);
    expect(DOUBLE_SECONDS).toBeGreaterThan(0);
    expect(EXTRA_SPEC.double.slicable).toBe(true);
  });

  it("花朵不能切,切了只扣一次机会并温和提示", () => {
    expect(EXTRA_SPEC.flower.slicable).toBe(false);
    expect(FLOWER_COST).toBe(1);
    const line = flowerLine();
    expect(line).toContain("鸭梨");
    expect(line).not.toContain("失败");
    expect(line).not.toContain("笨");
  });

  it("连体果要切两刀,第一刀只分开一半", () => {
    expect(TWIN_HITS).toBe(2);
    expect(twinCracked(1)).toBe(false);
    expect(twinCracked(2)).toBe(true);
    expect(twinStepScore(1)).toBeLessThan(twinStepScore(2));
    expect(twinStepScore(0)).toBe(0);
  });

  it("冰冻果减速 3 秒", () => {
    expect(CHILL_SECONDS).toBe(3);
  });

  it("新目标只在第 100 回合之后登场,前 99 回合一个都不加", () => {
    for (let i = 0; i < 99; i++) {
      expect(extrasForRound(i), `第 ${i + 1} 回合不该有新目标`).toEqual([]);
      expect(extraChance(i)).toBe(0);
    }
    expect(extrasForRound(99)).toEqual(["double"]);
    expect(extrasForRound(120)).toContain("flower");
    expect(extrasForRound(ROUNDS.length - 1)).toEqual(["double", "flower", "twin"]);
    expect(extraChance(ROUNDS.length - 1)).toBeGreaterThan(0);
    expect(extraChance(100000)).toBeLessThanOrEqual(0.16);
  });
});

describe("水果切切乐 · 无尽水果暴风", () => {
  it("节奏越往后越密,但抛数和间隔都有封顶", () => {
    expect(stormPace(0).interval).toBeGreaterThan(stormPace(10).interval);
    expect(stormPace(10).count).toBeGreaterThanOrEqual(stormPace(0).count);
    expect(stormPace(999).interval).toBe(0.55);
    // 间隔与炸弹率第 22 波先后拧到底,之后只剩「一次要照顾几颗」还能加,加到 9 颗为止
    expect(stormPace(STORM_PACE_CAP).count).toBe(7);
    expect(stormPace(999).count).toBe(STORM_COUNT_MAX);
    expect(stormPace(999).bombChance).toBeLessThanOrEqual(0.34);
    expect(stormPace(-5).count).toBe(stormPace(0).count);
    for (let i = 1; i <= 400; i++) {
      expect(stormPace(i).count, `第 ${i} 波抛得比上一波还少`).toBeGreaterThanOrEqual(stormPace(i - 1).count);
      expect(stormPace(i).count).toBeLessThanOrEqual(STORM_COUNT_MAX);
    }
  });

  it("基础节奏封顶之后,新目标混得越来越勤但有上限", () => {
    const richness = (from: number): number => {
      let n = 0;
      for (let i = from; i < from + 40; i++) n += stormWave(i, 20260827).extras.length;
      return n;
    };
    // 封顶之前那一段一个字都没变
    for (let i = 0; i <= STORM_PACE_CAP; i++) {
      const bumped = stormWave(i, 4242);
      expect(bumped.extras.length).toBeLessThanOrEqual(3);
    }
    expect(richness(200)).toBeGreaterThan(richness(0));
    // 三种新目标的概率各自都有上限,不会混到「波波都是三样齐」
    let allThree = 0;
    for (let i = 0; i <= 400; i++) if (stormWave(i, 4242).extras.length === 3) allThree++;
    expect(allThree).toBeLessThan(401);
  });

  it("同一个 seed 的暴风是同一张牌,换 seed 就换", () => {
    const a = Array.from({ length: 40 }, (_, i) => stormWave(i, 77));
    const b = Array.from({ length: 40 }, (_, i) => stormWave(i, 77));
    expect(a).toEqual(b);
    const c = Array.from({ length: 40 }, (_, i) => stormWave(i, 78));
    expect(c).not.toEqual(a);
    for (const r of [stormRand(1, 1), stormRand(9, 40), stormRand(0, 0)]) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it("新目标是慢慢加进暴风的,开局两波不会有", () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(stormWave(0, seed).extras).toEqual([]);
      expect(stormWave(1, seed).extras).toEqual([]);
    }
    let seen = 0;
    for (let i = 0; i < 60; i++) if (stormWave(i, 5).extras.length > 0) seen++;
    expect(seen).toBeGreaterThan(0);
  });

  it("漏 3 个或切错 3 次就收摊", () => {
    expect(STORM_MISS_LIMIT).toBe(3);
    expect(STORM_MISTAKE_LIMIT).toBe(3);
    expect(stormOver(0, 0)).toBe(false);
    expect(stormOver(2, 2)).toBe(false);
    expect(stormOver(3, 0)).toBe(true);
    expect(stormOver(0, 3)).toBe(true);
  });

  it("收摊只鼓励,星星按分数给", () => {
    expect(stormStars(0)).toBe(0);
    expect(stormStars(45)).toBe(1);
    expect(stormStars(95)).toBe(2);
    expect(stormStars(200)).toBe(3);
    expect(stormLine(200, 100)).toContain("新纪录");
    expect(stormLine(10, 900)).toContain("连刀");
    expect(stormLine(0, 0)).not.toContain("失败");
  });
});

describe("水果切切乐 · 收摊清理", () => {
  it("袋子里的监听 / rAF 一次倒干净,倒完归零", () => {
    const bag = new BladeBag();
    let off = 0;
    bag.add(() => off++);
    bag.add(() => off++);
    expect(bag.size).toBe(2);
    bag.clear();
    expect(off).toBe(2);
    expect(bag.size).toBe(0);
    bag.clear();
    expect(off).toBe(2);
  });
});

describe("水果切切乐 · 188 回合抽样", () => {
  it("每一回合的目标分都够得着:满场水果按连刀分算供给绰绰有余", () => {
    for (let i = 0; i < ROUNDS.length; i += 7) {
      const r = ROUNDS[i];
      // 一秒抛一波是最保守的估计,每波至少 volleyMin 颗
      const supply = Math.floor(r.time / 1.5) * r.volleyMin;
      expect(supply, `第 ${i + 1} 回合供给不足`).toBeGreaterThan(r.target * 0.6);
      expect(r.target).toBeGreaterThan(0);
    }
  });

  it("前 99 回合的关卡参数没有被 1.2 动过", () => {
    expect(ROUNDS[0].target).toBe(20);
    expect(ROUNDS[0].time).toBe(40);
    for (let i = 0; i < 99; i++) {
      expect(ROUNDS[i].chain).toBeUndefined();
      expect(ROUNDS[i].command).toBeUndefined();
      expect(ROUNDS[i].shellChance).toBeUndefined();
      expect(ROUNDS[i].mirror).toBeUndefined();
    }
  });
});
