import { describe, expect, it } from "vitest";
import {
  DAY_CYCLE_METERS,
  PHASE_ANCHORS,
  RAIN_FADE,
  RAIN_PERIOD,
  RAIN_SPAN,
  STATIC_DAY,
  cycleT,
  lightingAt,
  lightingLabel,
  phaseAt,
  rainFraction,
  rainSheen,
  shade,
  weatherAt,
} from "./daynight";
import type { DayPhase } from "./daynight";

describe("彩虹跑跑 · 日夜循环是距离的纯函数", () => {
  it("四档天色按顺序排在一圈里,不重不漏", () => {
    expect(PHASE_ANCHORS.length).toBe(4);
    const order: DayPhase[] = ["dawn", "day", "dusk", "night"];
    for (let i = 0; i < PHASE_ANCHORS.length; i++) {
      expect(PHASE_ANCHORS[i].phase).toBe(order[i]);
      if (i > 0) expect(PHASE_ANCHORS[i].at).toBeGreaterThan(PHASE_ANCHORS[i - 1].at);
    }
    expect(PHASE_ANCHORS[0].at).toBe(0);
    expect(PHASE_ANCHORS[PHASE_ANCHORS.length - 1].at).toBeLessThan(1);
  });

  it("一圈的位置永远落在 [0, 1),负数与坏数据也不例外", () => {
    for (const m of [0, 1, 999, DAY_CYCLE_METERS, DAY_CYCLE_METERS * 7.3, -500, -DAY_CYCLE_METERS]) {
      const t = cycleT(m);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(1);
    }
    expect(cycleT(Number.NaN)).toBe(0);
    expect(cycleT(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("跑满整整一圈回到原点:同一个位置永远是同一个颜色", () => {
    for (const m of [0, 137, 600, 1234, 2399]) {
      expect(cycleT(m)).toBeCloseTo(cycleT(m + DAY_CYCLE_METERS), 10);
      expect(phaseAt(m)).toBe(phaseAt(m + DAY_CYCLE_METERS));
      expect(lightingAt(m)).toEqual(lightingAt(m + DAY_CYCLE_METERS * 3));
    }
  });

  it("开跑是晨光,一圈里四档各占四分之一", () => {
    expect(phaseAt(0)).toBe("dawn");
    expect(phaseAt(DAY_CYCLE_METERS * 0.3)).toBe("day");
    expect(phaseAt(DAY_CYCLE_METERS * 0.6)).toBe("dusk");
    expect(phaseAt(DAY_CYCLE_METERS * 0.9)).toBe("night");
  });

  it("同一个函数调两次给同一个答案:天色不掺随机数", () => {
    for (const m of [0, 321, 1500, 5000]) {
      expect(lightingAt(m)).toEqual(lightingAt(m));
    }
  });

  it("天色是慢慢变的:每 5 米只挪一点点,不会「啪」地换一张皮", () => {
    let prev = lightingAt(0);
    for (let m = 5; m <= DAY_CYCLE_METERS * 2; m += 5) {
      const cur = lightingAt(m);
      // 雾浓度是连续量,相邻两次采样的跳变要小
      expect(Math.abs(cur.fogScale - prev.fogScale)).toBeLessThan(0.05);
      expect(Math.abs(cur.gridAlpha - prev.gridAlpha)).toBeLessThan(0.05);
      prev = cur;
    }
  });

  it("每一档的亮度都在能看清的范围里,夜里也没黑到看不见路", () => {
    for (let m = 0; m < DAY_CYCLE_METERS * 2; m += 37) {
      const light = lightingAt(m);
      expect(light.gridAlpha).toBeGreaterThan(0.2);
      expect(light.gridAlpha).toBeLessThanOrEqual(1);
      expect(light.mix).toBeGreaterThanOrEqual(0);
      expect(light.mix).toBeLessThanOrEqual(1);
      expect(light.fogScale).toBeGreaterThan(0.5);
      expect(light.fogScale).toBeLessThan(2);
      expect(light.tint).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("一档天色的长度配得上实际跑得动的距离,不会在一趟里闪好几遍", () => {
    const perPhase = DAY_CYCLE_METERS / PHASE_ANCHORS.length;
    // 无尽模式速度在 250–500 之间,一档天色至少要撑住四秒才看得出是在「变天」
    expect(perPhase / 500).toBeGreaterThan(4);
    // 也不能长到一辈子见不着夜色:六档难度 4000 米封顶,一圈别超过它的三倍
    expect(DAY_CYCLE_METERS).toBeLessThanOrEqual(4000 * 3);
  });

  it("换天色和换世界永远错不到同一米上", () => {
    const perPhase = DAY_CYCLE_METERS / PHASE_ANCHORS.length;
    const STAGE = 1600; // index.ts 的 ENDLESS_STAGE_LEN:每 1600 米换一个世界
    // 两条线要在同一米上撞,最早也得跑到它们的最小公倍数;那已经远得没人跑得到了
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const lcm = (perPhase * STAGE) / gcd(perPhase, STAGE);
    expect(lcm).toBeGreaterThan(50_000);
  });

  it("雨和天色各走各的周期,不会每场雨都撞上同一个天色", () => {
    expect(DAY_CYCLE_METERS % RAIN_PERIOD).not.toBe(0);
    expect(RAIN_PERIOD % DAY_CYCLE_METERS).not.toBe(0);
    // 一趟三四千米大概率能碰上一场雨
    expect(RAIN_PERIOD).toBeLessThan(6000);
    // 进退场的坡各留得下,反光条能涨到满
    expect(RAIN_FADE * 2).toBeLessThanOrEqual(RAIN_SPAN);
    // 同一场雨里天色是走动的,不是从头到尾一个色
    const phases = new Set<string>();
    for (let m = 0; m < DAY_CYCLE_METERS * 4; m += 60) {
      if (weatherAt(m) === "rain") phases.add(phaseAt(m));
    }
    expect(phases.size).toBeGreaterThanOrEqual(3);
  });

  it("白昼比夜里亮、雾比夜里薄", () => {
    const day = lightingAt(DAY_CYCLE_METERS * 0.3);
    const night = lightingAt(DAY_CYCLE_METERS * 0.85);
    expect(day.gridAlpha).toBeGreaterThan(night.gridAlpha);
    expect(day.fogScale).toBeLessThan(night.fogScale);
  });
});

describe("彩虹跑跑 · 天气", () => {
  it("雨是周期性的,一整圈里只占一小段", () => {
    expect(rainFraction()).toBeCloseTo(RAIN_SPAN / RAIN_PERIOD, 10);
    expect(rainFraction()).toBeGreaterThan(0.05);
    expect(rainFraction()).toBeLessThan(0.35);
  });

  it("实测跑一大段路,下雨的比例和公式说的一样", () => {
    let rainy = 0;
    const total = 4000;
    for (let i = 0; i < total; i++) {
      if (weatherAt((i * RAIN_PERIOD * 3) / total) === "rain") rainy++;
    }
    expect(rainy / total).toBeGreaterThan(rainFraction() - 0.02);
    expect(rainy / total).toBeLessThan(rainFraction() + 0.02);
  });

  it("晴天一点反光都没有,雨最大的时候是满的", () => {
    expect(rainSheen(0)).toBe(0);
    expect(weatherAt(0)).toBe("clear");
    const mid = RAIN_PERIOD - RAIN_SPAN / 2;
    expect(weatherAt(mid)).toBe("rain");
    expect(rainSheen(mid)).toBeCloseTo(1, 6);
  });

  it("雨的进退场是渐变的,反光条不会突然冒出来", () => {
    const start = RAIN_PERIOD - RAIN_SPAN;
    expect(rainSheen(start)).toBeCloseTo(0, 6);
    expect(rainSheen(start + 60)).toBeGreaterThan(0);
    expect(rainSheen(start + 60)).toBeLessThan(1);
    // 反光强度永远在 [0, 1] 里
    for (let m = 0; m < RAIN_PERIOD * 2; m += 53) {
      expect(rainSheen(m)).toBeGreaterThanOrEqual(0);
      expect(rainSheen(m)).toBeLessThanOrEqual(1);
    }
  });

  it("下雨天地面更亮、雾更厚——湿路面反光", () => {
    const dry = lightingAt(100);
    const wet = lightingAt(RAIN_PERIOD - RAIN_SPAN / 2);
    expect(wet.weather).toBe("rain");
    expect(dry.weather).toBe("clear");
    expect(wet.sheen).toBeGreaterThan(0);
    expect(dry.sheen).toBe(0);
  });
});

describe("彩虹跑跑 · 天色只调色不换皮", () => {
  it("战役固定白昼:188 关的看头是关卡本身", () => {
    expect(STATIC_DAY.phase).toBe("day");
    expect(STATIC_DAY.weather).toBe("clear");
    expect(STATIC_DAY.sheen).toBe(0);
  });

  it("调色之后仍旧是一个合法颜色,而且认得出原来那个世界", () => {
    const night = lightingAt(DAY_CYCLE_METERS * 0.85);
    const tinted = shade("#7ac86a", night);
    expect(tinted).toMatch(/^#[0-9a-f]{6}$/i);
    // 夜色只混进去不到一半,底色仍是主导
    expect(night.mix).toBeLessThan(0.6);
    // 白昼几乎不动底色
    expect(shade("#7ac86a", STATIC_DAY)).not.toBe("#000000");
  });

  it("HUD 那一行小字把档位和天气都说清楚", () => {
    expect(lightingLabel(lightingAt(0))).toContain("晨光");
    expect(lightingLabel(lightingAt(DAY_CYCLE_METERS * 0.85))).toContain("夜色");
    expect(lightingLabel(lightingAt(RAIN_PERIOD - RAIN_SPAN / 2))).toContain("小雨");
    expect(lightingLabel(lightingAt(100))).not.toContain("小雨");
  });
});
