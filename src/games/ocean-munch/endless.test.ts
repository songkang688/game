import { describe, expect, it } from "vitest";
import { START_RADIUS } from "./logic";
import {
  BASE_SPEED,
  DASH_MULT,
  ELITE_BREAK,
  ELITE_SLACK,
  ENDLESS_START_RADIUS,
  ENDLESS_TIERS,
  GROWTH_K_MIN,
  MAX_RADIUS,
  PRESSURE_FROM_TIER,
  STARVE_HURRY,
  STARVE_SECONDS,
  STARVE_WARN,
  SWALLOW_MS,
  SWALLOW_RATIO,
  SpatialGrid,
  TIER_DEPTH,
  TIER_MAX,
  TIER_SECONDS,
  biteLoss,
  canSwallow,
  dashReady,
  dashSpeed,
  depthForTier,
  depthGain,
  easeRadius,
  endlessFailAt,
  endlessFailCopy,
  endlessSpeed,
  growEndless,
  growthK,
  isNibbledOut,
  isPredator,
  isStarved,
  makeRng,
  pressureDrain,
  radiusCapAt,
  simulateEndless,
  spawnEndlessFish,
  startTierForLevel,
  starveLeft,
  starveWarnLevel,
  starveWarnLine,
  swallowStretch,
  tierAt,
  tierSpec,
} from "./endless";

describe("无尽成长曲线", () => {
  it("吃一只只会变大,不会缩水(单调)", () => {
    let r = ENDLESS_START_RADIUS;
    for (let i = 0; i < 400; i++) {
      const next = growEndless(r, r * 0.6, 1);
      expect(next).toBeGreaterThanOrEqual(r);
      r = next;
    }
    expect(r).toBeGreaterThan(ENDLESS_START_RADIUS);
  });

  it("再怎么吃也顶到上限为止(有界)", () => {
    let r = ENDLESS_START_RADIUS;
    for (let i = 0; i < 5000; i++) r = growEndless(r, r * 0.85, 1);
    expect(r).toBeLessThanOrEqual(MAX_RADIUS);
    // 猛吃几千口确实吃到了顶,不是曲线自己先停下来的
    expect(r).toBeCloseTo(MAX_RADIUS, 6);
  });

  it("同一口鱼:身子越大长得越少(质量守恒式)", () => {
    const small = growEndless(24, 12, 1) - 24;
    const big = growEndless(60, 12, 1) - 60;
    expect(small).toBeGreaterThan(big);
    expect(big).toBeGreaterThan(0);
  });

  it("成长系数随层数递减,但摊薄到底还留一点", () => {
    for (let t = 1; t < TIER_MAX; t++) {
      expect(growthK(t)).toBeGreaterThanOrEqual(growthK(t + 1));
    }
    expect(growthK(TIER_MAX)).toBeGreaterThanOrEqual(GROWTH_K_MIN);
    expect(growthK(1)).toBeGreaterThan(growthK(TIER_MAX));
  });

  it("同一口鱼在深层不如浅层值钱", () => {
    const shallow = growEndless(30, 20, 1) - 30;
    const deep = growEndless(30, 20, 9) - 30;
    expect(shallow).toBeGreaterThan(deep);
  });

  it("喂进坏数字也不会算出 NaN", () => {
    expect(Number.isFinite(growEndless(Number.NaN, 10, 1))).toBe(true);
    expect(growEndless(30, Number.NaN, 1)).toBe(30);
    expect(growEndless(30, -5, 1)).toBe(30);
  });
});

describe("吃得下 / 咬得动的阈值", () => {
  it("0.85 这条线上的三个点:差一点、正好、超一点", () => {
    const me = 40;
    expect(canSwallow(me, me * SWALLOW_RATIO - 0.01)).toBe(true);
    expect(canSwallow(me, me * SWALLOW_RATIO)).toBe(true);
    expect(canSwallow(me, me * SWALLOW_RATIO + 0.01)).toBe(false);
  });

  it("擦边一样大的谁也吃不了谁", () => {
    const me = 40;
    expect(canSwallow(me, me * 0.99)).toBe(false);
    expect(isPredator(me, me * 0.99)).toBe(false);
  });

  it("明显更大的才咬得动你", () => {
    const me = 40;
    expect(isPredator(me, me * 1.11)).toBe(false);
    expect(isPredator(me, me * 1.12)).toBe(true);
    expect(isPredator(me, me * 2)).toBe(true);
  });

  it("被咬掉一块:掉的是一截体型,不会掉成负数", () => {
    expect(biteLoss(40)).toBeLessThan(40);
    expect(biteLoss(40)).toBeGreaterThan(0);
    expect(biteLoss(0)).toBe(0);
    // 起始体型留了三口的缓冲,第一口咬不死
    expect(isNibbledOut(biteLoss(ENDLESS_START_RADIUS))).toBe(false);
    expect(isNibbledOut(biteLoss(biteLoss(biteLoss(ENDLESS_START_RADIUS))))).toBe(true);
  });
});

describe("速度与冲刺", () => {
  it("越大越慢,但永远慢不到不能动", () => {
    expect(endlessSpeed(START_RADIUS)).toBeCloseTo(BASE_SPEED, 6);
    let last = Infinity;
    for (let r = START_RADIUS; r <= MAX_RADIUS; r += 4) {
      const v = endlessSpeed(r);
      expect(v).toBeLessThanOrEqual(last);
      expect(v).toBeGreaterThan(0);
      last = v;
    }
    // 从起始体型长到顶,速度掉得动但没掉到一半以下
    expect(endlessSpeed(MAX_RADIUS)).toBeGreaterThan(BASE_SPEED * 0.4);
  });

  it("冲刺是 1.8 倍,冷却没走完就冲不动", () => {
    expect(dashSpeed(40)).toBeCloseTo(endlessSpeed(40) * DASH_MULT, 6);
    expect(dashReady(0)).toBe(true);
    expect(dashReady(0.01)).toBe(false);
  });

  it("冲刺时下潜也更快", () => {
    expect(depthGain(1, true)).toBeGreaterThan(depthGain(1, false));
    expect(depthGain(-1, false)).toBe(0);
  });
});

describe("层数:每 400 米或 45 秒进一层", () => {
  it("深度和时间各算各的,快的那条说了算", () => {
    expect(tierAt(0, 0)).toBe(1);
    expect(tierAt(TIER_DEPTH - 1, 0)).toBe(1);
    expect(tierAt(TIER_DEPTH, 0)).toBe(2);
    expect(tierAt(0, TIER_SECONDS)).toBe(2);
    expect(tierAt(TIER_DEPTH, TIER_SECONDS * 3)).toBe(4);
  });

  it("到第 9 层就封顶,再深也不会越界", () => {
    expect(tierAt(TIER_DEPTH * 99, TIER_SECONDS * 99)).toBe(TIER_MAX);
    expect(tierSpec(0).level).toBe(1);
    expect(tierSpec(99).level).toBe(TIER_MAX);
    expect(ENDLESS_TIERS.length).toBe(TIER_MAX);
  });

  it("一层比一层挤、一层比一层深:洋流、毒藻、体型上限都单调不减", () => {
    for (let i = 1; i < ENDLESS_TIERS.length; i++) {
      const a = ENDLESS_TIERS[i - 1];
      const b = ENDLESS_TIERS[i];
      expect(b.level).toBe(a.level + 1);
      expect(b.driftSpeed).toBeGreaterThanOrEqual(a.driftSpeed);
      expect(b.toxinRate).toBeGreaterThanOrEqual(a.toxinRate);
      expect(b.eliteRate).toBeGreaterThanOrEqual(a.eliteRate);
      expect(b.sizeCap).toBeGreaterThan(a.sizeCap);
      expect(b.crowd).toBeGreaterThanOrEqual(a.crowd);
    }
    // 最深那层的上限也不许超过全局上限
    expect(ENDLESS_TIERS[ENDLESS_TIERS.length - 1].sizeCap).toBeLessThanOrEqual(MAX_RADIUS);
  });

  it("战役关号 → 起始层的映射表(注释里那张表逐个换层点都要对上)", () => {
    const table: Array<[number, number]> = [
      [1, 1], [21, 1],
      [22, 2], [42, 2],
      [43, 3], [63, 3],
      [64, 4], [84, 4],
      [85, 5], [105, 5],
      [106, 6], [126, 6],
      [127, 7], [147, 7],
      [148, 8], [168, 8],
      [169, 9], [188, 9],
    ];
    for (const [level, tier] of table) expect(startTierForLevel(level)).toBe(tier);
  });

  it("关号越界一律夹到两端,单调不减", () => {
    expect(startTierForLevel(0)).toBe(1);
    expect(startTierForLevel(-99)).toBe(1);
    expect(startTierForLevel(9999)).toBe(TIER_MAX);
    expect(startTierForLevel(Number.NaN)).toBe(1);
    let last = 0;
    for (let n = 1; n <= 188; n++) {
      const t = startTierForLevel(n);
      expect(t).toBeGreaterThanOrEqual(last);
      last = t;
    }
  });

  it("从第 N 层起步时深度起点和 tierAt 对得上", () => {
    for (let t = 1; t <= TIER_MAX; t++) {
      expect(tierAt(depthForTier(t), 0)).toBe(t);
    }
    expect(depthForTier(1)).toBe(0);
  });
});

describe("深渊压力", () => {
  it("第 5 层之前怎么胖都不掉", () => {
    for (let t = 1; t < PRESSURE_FROM_TIER; t++) {
      expect(pressureDrain(MAX_RADIUS, t, 1)).toBe(MAX_RADIUS);
    }
  });

  it("第 5 层起超过上限才慢慢缩,一帧最多缩到上限", () => {
    const cap = tierSpec(PRESSURE_FROM_TIER).sizeCap;
    expect(pressureDrain(cap, PRESSURE_FROM_TIER, 1)).toBe(cap);
    expect(pressureDrain(cap - 3, PRESSURE_FROM_TIER, 1)).toBe(cap - 3);
    const drained = pressureDrain(cap + 5, PRESSURE_FROM_TIER, 1);
    expect(drained).toBeLessThan(cap + 5);
    expect(drained).toBeGreaterThanOrEqual(cap);
    // 一整秒也不会被一路压回起始体型
    expect(pressureDrain(cap + 40, PRESSURE_FROM_TIER, 1)).toBeGreaterThan(cap);
  });

  it("吃到精英鱼能多顶一截上限", () => {
    const cap = tierSpec(6).sizeCap;
    expect(radiusCapAt(6, 0)).toBe(cap);
    expect(radiusCapAt(6, ELITE_BREAK)).toBe(cap + ELITE_SLACK);
    expect(pressureDrain(cap + 5, 6, 1, ELITE_BREAK)).toBe(cap + 5);
  });
});

describe("鱼群抽样:同种子同一局", () => {
  it("同一个种子抽出同一串鱼", () => {
    const a = makeRng(20260826);
    const b = makeRng(20260826);
    for (let i = 0; i < 200; i++) {
      expect(spawnEndlessFish(4, 30, a)).toEqual(spawnEndlessFish(4, 30, b));
    }
  });

  it("换种子就换一局", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const listA = Array.from({ length: 60 }, () => spawnEndlessFish(4, 30, a));
    const listB = Array.from({ length: 60 }, () => spawnEndlessFish(4, 30, b));
    expect(listA).not.toEqual(listB);
  });

  it("层数越深,毒藻鱼和大鱼越多", () => {
    const count = (tier: number): { toxin: number; danger: number } => {
      const rng = makeRng(7);
      let toxin = 0;
      let danger = 0;
      for (let i = 0; i < 3000; i++) {
        const f = spawnEndlessFish(tier, 30, rng);
        if (f.kind === "toxin") toxin++;
        if (f.danger) danger++;
      }
      return { toxin, danger };
    };
    const shallow = count(1);
    const deep = count(9);
    expect(shallow.toxin).toBe(0);
    expect(deep.toxin).toBeGreaterThan(shallow.toxin);
    expect(deep.danger).toBeGreaterThan(shallow.danger);
  });

  it("深层才掉得到的新鱼种确实只在深层出现", () => {
    const seen = (tier: number): Set<string> => {
      const rng = makeRng(11);
      const out = new Set<string>();
      for (let i = 0; i < 3000; i++) out.add(spawnEndlessFish(tier, 30, rng).dexId);
      return out;
    };
    const t1 = seen(1);
    expect(t1.has("lantern")).toBe(false);
    expect(t1.has("ribbon")).toBe(false);
    expect(seen(3).has("lantern")).toBe(true);
    expect(seen(6).has("ribbon")).toBe(true);
    // 精英鱼从第一层就有,不然破上限那条路一开始就断了
    expect(t1.has("elite")).toBe(true);
  });

  it("每一层都还长得出中号的条纹鱼,深层不会只剩最小的一档", () => {
    // 回归:小鱼段的归一化分母曾经拿的是整个 smallShare,
    // 毒藻鱼 + 精英鱼吃掉前一段之后,第 7 层起 t 再也到不了「条纹鱼」的门槛。
    for (let tier = 1; tier <= TIER_MAX; tier++) {
      const rng = makeRng(2026 + tier);
      const kinds = new Set<string>();
      let maxSmall = 0;
      for (let i = 0; i < 4000; i++) {
        const f = spawnEndlessFish(tier, 30, rng);
        if (f.kind === "minnow" || f.kind === "stripey") {
          kinds.add(f.kind);
          maxSmall = Math.max(maxSmall, f.r);
        }
      }
      expect(kinds.has("minnow")).toBe(true);
      expect(kinds.has("stripey")).toBe(true);
      // 最大的那条小鱼要摸得到这一段的上界(0.74 × 体型),各层口径一致
      expect(maxSmall).toBeGreaterThan(30 * 0.7);
    }
  });

  it("四段出现概率一个都没动:毒藻 / 精英 / 小鱼 / 大鱼的占比仍按档位表走", () => {
    for (const tier of [1, 5, 9]) {
      const spec = tierSpec(tier);
      const rng = makeRng(4242);
      const n = 20000;
      let toxin = 0;
      let elite = 0;
      let small = 0;
      let big = 0;
      for (let i = 0; i < n; i++) {
        const f = spawnEndlessFish(tier, 30, rng);
        if (f.kind === "toxin") toxin++;
        else if (f.kind === "elite") elite++;
        else if (f.kind === "bigblue") big++;
        else small++;
      }
      const smallShare = Math.max(0.42, 0.7 - spec.bigFishBias);
      expect(toxin / n).toBeCloseTo(spec.toxinRate, 1);
      expect(elite / n).toBeCloseTo(spec.eliteRate, 1);
      expect(small / n).toBeCloseTo(smallShare - spec.toxinRate - spec.eliteRate, 1);
      expect(big / n).toBeCloseTo(1 - smallShare, 1);
    }
  });
});

describe("吞咽手感", () => {
  it("180ms 拉伸一个来回,末了完全回正", () => {
    expect(swallowStretch(0).along).toBeCloseTo(1, 6);
    const peak = swallowStretch(SWALLOW_MS / 3);
    expect(peak.along).toBeGreaterThan(1);
    expect(peak.across).toBeLessThan(1);
    expect(swallowStretch(SWALLOW_MS)).toEqual({ along: 1, across: 1 });
    expect(swallowStretch(SWALLOW_MS * 5)).toEqual({ along: 1, across: 1 });
  });

  it("关掉系统动效就一路不拉伸", () => {
    for (const t of [0, 30, 60, 90, 180]) {
      expect(swallowStretch(t, true)).toEqual({ along: 1, across: 1 });
    }
  });

  it("半径插值:一帧只走一小段,几帧之内追平", () => {
    let shown = 22;
    const target = 40;
    const first = easeRadius(shown, target, 1 / 60);
    expect(first).toBeGreaterThan(shown);
    expect(first).toBeLessThan(target);
    for (let i = 0; i < 30; i++) shown = easeRadius(shown, target, 1 / 60);
    expect(shown).toBeCloseTo(target, 1);
    // 一帧特别长时直接追平,不会冲过头
    expect(easeRadius(22, 40, 5)).toBe(40);
  });
});

describe("失败判定与文案", () => {
  it("90 秒没进食就该回岸上歇着", () => {
    expect(isStarved(STARVE_SECONDS - 0.01)).toBe(false);
    expect(isStarved(STARVE_SECONDS)).toBe(true);
    expect(endlessFailAt(40, STARVE_SECONDS)).toBe("starved");
    expect(endlessFailAt(40, 10)).toBe(null);
  });

  it("被啃到起始体型也结束,且这一条优先报", () => {
    expect(isNibbledOut(START_RADIUS)).toBe(true);
    expect(isNibbledOut(START_RADIUS + 0.01)).toBe(false);
    expect(endlessFailAt(START_RADIUS, 0)).toBe("nibbled");
    expect(endlessFailAt(START_RADIUS, STARVE_SECONDS)).toBe("nibbled");
  });

  it("失败文案只鼓励,不许出现血伤死那一类字眼", () => {
    for (const kind of ["nibbled", "starved"] as const) {
      const copy = endlessFailCopy(kind, 1234);
      expect(copy.line).toContain("1234");
      expect(copy.lines).toHaveLength(2);
      expect(copy.lines.join("")).toBe(copy.line);
      for (const bad of ["血", "伤", "死", "杀", "输了", "失败"]) {
        expect(copy.title + copy.line).not.toContain(bad);
      }
    }
    expect(endlessFailCopy("nibbled", 0).title).toContain("回岸上休息");
  });
});

describe("饥饿预警", () => {
  it("还剩多少秒算得准,饿倒之后就是 0", () => {
    expect(starveLeft(0)).toBe(STARVE_SECONDS);
    expect(starveLeft(STARVE_SECONDS - 5)).toBe(5);
    expect(starveLeft(STARVE_SECONDS)).toBe(0);
    expect(starveLeft(STARVE_SECONDS + 30)).toBe(0);
    expect(starveLeft(Number.NaN)).toBe(STARVE_SECONDS);
  });

  it("三档预警按 STARVE_WARN / STARVE_HURRY 切,边界不含糊", () => {
    expect(starveWarnLevel(0)).toBe("none");
    expect(starveWarnLevel(STARVE_SECONDS - STARVE_WARN - 0.01)).toBe("none");
    expect(starveWarnLevel(STARVE_SECONDS - STARVE_WARN)).toBe("soft");
    expect(starveWarnLevel(STARVE_SECONDS - STARVE_HURRY - 0.01)).toBe("soft");
    expect(starveWarnLevel(STARVE_SECONDS - STARVE_HURRY)).toBe("hard");
    expect(starveWarnLevel(STARVE_SECONDS)).toBe("hard");
  });

  it("不到预警线一个字都不说,催起来只说去吃东西", () => {
    expect(starveWarnLine(0)).toBe("");
    const soft = starveWarnLine(STARVE_SECONDS - STARVE_WARN);
    const hard = starveWarnLine(STARVE_SECONDS - STARVE_HURRY);
    expect(soft).toContain(`${STARVE_WARN}`);
    expect(hard).toContain(`${STARVE_HURRY}`);
    expect(hard).not.toBe(soft);
    // 分级红线:预警文案也不许出现血伤死那一类字眼
    for (const bad of ["血", "伤", "死", "杀", "输了", "失败"]) {
      expect(soft + hard).not.toContain(bad);
    }
  });
});

describe("邻域网格", () => {
  it("身边的一个不漏,远处的不掺进来", () => {
    const grid = new SpatialGrid<{ x: number; y: number; id: number }>(96);
    const all = [
      { x: 10, y: 10, id: 0 },
      { x: 40, y: 40, id: 1 },
      { x: 900, y: 900, id: 2 },
      { x: -120, y: -80, id: 3 },
    ];
    for (const it of all) grid.insert(it);
    expect(grid.size).toBe(4);
    const near = grid.near(20, 20, 60).map((o) => o.id).sort();
    expect(near).toContain(0);
    expect(near).toContain(1);
    expect(near).not.toContain(2);
    // 暴力比一遍:网格给的结果不许漏掉任何真正在范围里的
    const brute = all.filter((o) => Math.hypot(o.x - 20, o.y - 20) <= 60).map((o) => o.id);
    for (const id of brute) expect(near).toContain(id);
  });

  it("负坐标也能装能查", () => {
    const grid = new SpatialGrid<{ x: number; y: number }>(50);
    grid.insert({ x: -400, y: -300 });
    expect(grid.near(-400, -300, 10)).toHaveLength(1);
    expect(grid.near(400, 300, 10)).toHaveLength(0);
  });

  it("鱼再多也只和邻近格子比,不是 O(n²)", () => {
    const grid = new SpatialGrid<{ x: number; y: number }>(96);
    for (let i = 0; i < 2000; i++) grid.insert({ x: (i % 50) * 40, y: Math.floor(i / 50) * 40 });
    expect(grid.size).toBe(2000);
    // 一次查询摸到的候选远少于总数,鱼一多也不会掉帧
    expect(grid.near(400, 400, 60).length).toBeLessThan(60);
    grid.clear();
    expect(grid.size).toBe(0);
    expect(grid.near(400, 400, 60)).toHaveLength(0);
  });
});

describe("模拟一局:曲线到底能不能玩", () => {
  it("会躲会吃的打法活得过 60 秒,而且真的在往下潜", () => {
    for (const seed of [1, 2, 3, 42, 20260826]) {
      const run = simulateEndless({ seed, seconds: 75 });
      expect(run.fail).toBe(null);
      expect(run.alive).toBeGreaterThan(60);
      expect(run.depth).toBeGreaterThan(400);
      expect(run.eaten).toBeGreaterThan(0);
      expect(run.radius).toBeGreaterThan(START_RADIUS);
      expect(run.radius).toBeLessThanOrEqual(MAX_RADIUS);
    }
  });

  it("同一个种子跑出同一局(层数生成可复现)", () => {
    expect(simulateEndless({ seed: 99, seconds: 90 })).toEqual(
      simulateEndless({ seed: 99, seconds: 90 }),
    );
    expect(simulateEndless({ seed: 99, seconds: 90 })).not.toEqual(
      simulateEndless({ seed: 100, seconds: 90 }),
    );
  });

  it("越潜越深,层数跟着往上走", () => {
    const run = simulateEndless({ seed: 5, seconds: 200 });
    expect(run.tier).toBeGreaterThan(1);
    expect(run.tier).toBeLessThanOrEqual(TIER_MAX);
    expect(run.depth).toBeGreaterThan(depthForTier(run.tier));
  });

  it("从深层起步的话深度就从那一层算起", () => {
    const run = simulateEndless({ seed: 8, seconds: 5, startTier: 6 });
    expect(run.depth).toBeGreaterThanOrEqual(depthForTier(6));
    expect(run.tier).toBeGreaterThanOrEqual(6);
  });

  it("只躲不吃真的会饿到游不动(90 秒那条线)", () => {
    const run = simulateEndless({ seed: 3, seconds: 200, policy: "timid" });
    expect(run.fail).toBe("starved");
    expect(run.eaten).toBe(0);
    expect(run.alive).toBeGreaterThanOrEqual(STARVE_SECONDS);
    expect(run.alive).toBeLessThan(STARVE_SECONDS + 2);
  });

  it("见谁咬谁真的会被啃到回岸上休息", () => {
    const run = simulateEndless({ seed: 4, seconds: 200, policy: "reckless" });
    expect(run.fail).toBe("nibbled");
    expect(run.bitten).toBeGreaterThan(0);
    expect(run.radius).toBeLessThanOrEqual(START_RADIUS);
  });

  it("一局下来能收到好几种图鉴条目", () => {
    const run = simulateEndless({ seed: 12, seconds: 120 });
    expect(run.dex.length).toBeGreaterThanOrEqual(2);
    for (const id of run.dex) expect(typeof id).toBe("string");
  });
});
