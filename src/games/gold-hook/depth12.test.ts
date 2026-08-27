import { describe, expect, it } from "vitest";
import {
  EXTEND_RAMP,
  GRAB_HITCH_MAX,
  GRAB_HITCH_MIN,
  LIGHT_MIN,
  MUDDY_SLIP_PER_SEC,
  NEW_ORES,
  PARALLAX,
  PRICE_CHAPTER_CAP,
  SUPPLY_EVERY,
  applySupply,
  chapterPriceMult,
  createTwin,
  emptyRetractSpeed,
  extendRamp,
  fullKitCost,
  grabHitch,
  haulIsSlowerThanEmpty,
  isSupplyDepth,
  lightRadius,
  makeHookRng,
  muddySlipChance,
  muddySlips,
  parallaxOffset,
  parallaxOrderedByDepth,
  powerRetract,
  priceAt,
  rareWeightMult,
  supplyChoices,
  twinGrab,
  twinValue,
  useBombOn,
} from "./depth12";
import {
  MAX_BOMBS,
  MAX_LUCK,
  MAX_STRENGTH,
  ORES,
  emptyWallet,
  retractSpeed,
  shopPrice,
  simulateRun,
} from "./logic";
import { allLevels, endlessLayer, levelAt } from "./levels";

/* ---------------- 钩索手感 ---------------- */

describe("1.2 钩索手感", () => {
  it("下钩是加速起步的，到 EXTEND_RAMP 秒才满速", () => {
    expect(extendRamp(0)).toBe(0);
    expect(extendRamp(EXTEND_RAMP / 2)).toBeCloseTo(0.5);
    expect(extendRamp(EXTEND_RAMP)).toBe(1);
    expect(extendRamp(99)).toBe(1);
  });

  it("抓到时的顿感落在 60–90 毫秒之间，越重顿得越久", () => {
    const light = grabHitch(2);
    const heavy = grabHitch(23);
    expect(light).toBeGreaterThanOrEqual(GRAB_HITCH_MIN);
    expect(heavy).toBeLessThanOrEqual(GRAB_HITCH_MAX);
    expect(heavy).toBeGreaterThan(light);
  });

  it("回收速度对重量单调递减，力量水只会更快", () => {
    let prev = Infinity;
    for (let w = 0; w <= 30; w += 3) {
      const v = retractSpeed(w, 0);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
      expect(retractSpeed(w, 2)).toBeGreaterThanOrEqual(v);
    }
  });

  it("抓着任何一种矿都比空钩慢（这条取舍不许被优化掉）", () => {
    for (const kind of Object.keys(ORES) as Array<keyof typeof ORES>) {
      expect(haulIsSlowerThanEmpty(ORES[kind].weight, MAX_STRENGTH), kind).toBe(true);
    }
    expect(emptyRetractSpeed()).toBeGreaterThan(retractSpeed(1, MAX_STRENGTH));
  });
});

/* ---------------- 矿洞纵深 ---------------- */

describe("1.2 矿洞纵深视差", () => {
  it("三层背景越远越暗、越远越不动", () => {
    expect(PARALLAX.length).toBe(3);
    expect(parallaxOrderedByDepth()).toBe(true);
  });

  it("钩子放得越长，背景挪得越多；近层挪得比远层多", () => {
    expect(parallaxOffset("wall", 0)).toBe(0);
    expect(parallaxOffset("wall", 200)).toBeGreaterThan(parallaxOffset("wall", 60));
    expect(parallaxOffset("wall", 300)).toBeGreaterThan(parallaxOffset("cavern", 300));
  });

  it("放到底之后视差不会再涨（不会把背景推出画面）", () => {
    expect(parallaxOffset("seam", 9999)).toBeCloseTo(parallaxOffset("seam", 290), 0);
  });
});

/* ---------------- 道具 ---------------- */

describe("1.2 道具重做", () => {
  it("价钱随章节递增但有封顶", () => {
    expect(chapterPriceMult(0)).toBe(1);
    expect(chapterPriceMult(3)).toBeGreaterThan(chapterPriceMult(1));
    expect(chapterPriceMult(99)).toBe(PRICE_CHAPTER_CAP);
  });

  it("第一章的价钱和 1.1 的 shopPrice 完全一样（老关卡手感不变）", () => {
    for (const kind of ["bomb", "power", "luck"] as const) {
      for (let owned = 0; owned < 3; owned++) {
        expect(priceAt(kind, owned, 0)).toBe(shopPrice(kind, owned));
      }
    }
  });

  it("炸药炸掉钩住的东西之后空钩飞快收回，且真扣一包", () => {
    const w = { ...emptyWallet(0), bombs: 2 };
    const r = useBombOn(w, 23);
    expect(r.dropped).toBe(true);
    expect(r.wallet.bombs).toBe(1);
    expect(r.retract).toBe(emptyRetractSpeed());
  });

  it("没有炸药时按普通速度往回拉，不会凭空扣", () => {
    const w = emptyWallet(0);
    const r = useBombOn(w, 23);
    expect(r.dropped).toBe(false);
    expect(r.wallet.bombs).toBe(0);
    expect(r.retract).toBeLessThan(emptyRetractSpeed());
  });

  it("力量水档数越高越快，超过上限也不会再快", () => {
    expect(powerRetract(20, 1)).toBeGreaterThan(powerRetract(20, 0));
    expect(powerRetract(20, 99)).toBe(powerRetract(20, MAX_STRENGTH));
  });

  it("幸运石提高稀有矿刷新权重，也有上限", () => {
    expect(rareWeightMult(0)).toBe(1);
    expect(rareWeightMult(2)).toBeGreaterThan(rareWeightMult(1));
    expect(rareWeightMult(99)).toBe(rareWeightMult(MAX_LUCK));
  });

  it("买满一整套的钱越往后越贵，但不会贵到离谱（不超过第一章的两倍）", () => {
    const first = fullKitCost(0);
    const last = fullKitCost(9);
    expect(last).toBeGreaterThan(first);
    expect(last).toBeLessThanOrEqual(first * PRICE_CHAPTER_CAP + 1);
  });
});

/* ---------------- 新矿物 ---------------- */

describe("1.2 泥泥矿与双层晶", () => {
  it("两种新矿都有中文名、说明和正的价钱", () => {
    for (const spec of Object.values(NEW_ORES)) {
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.hint.length).toBeGreaterThan(6);
      expect(spec.value).toBeGreaterThan(0);
      expect(spec.hint).not.toMatch(/死|血|杀/);
    }
  });

  it("泥泥矿打滑是可复现的（同 seed 同结果）", () => {
    const a = makeHookRng(99);
    const b = makeHookRng(99);
    const seqA = Array.from({ length: 20 }, () => muddySlips(a, 1 / 60, false));
    const seqB = Array.from({ length: 20 }, () => muddySlips(b, 1 / 60, false));
    expect(seqA).toEqual(seqB);
  });

  it("炸药固定过的泥泥矿永远不滑", () => {
    const rng = makeHookRng(1);
    for (let i = 0; i < 200; i++) expect(muddySlips(rng, 1, true)).toBe(false);
    expect(muddySlipChance(10, true)).toBe(0);
  });

  it("拉得越久越容易滑，但概率永远在 0–1 之间", () => {
    expect(muddySlipChance(0)).toBe(0);
    expect(muddySlipChance(3)).toBeGreaterThan(muddySlipChance(1));
    expect(muddySlipChance(999)).toBeLessThanOrEqual(1);
    expect(MUDDY_SLIP_PER_SEC).toBeGreaterThan(0);
    expect(MUDDY_SLIP_PER_SEC).toBeLessThan(1);
  });

  it("双层晶要连钩两次才拿得走", () => {
    const first = twinGrab(createTwin());
    expect(first.taken).toBe(false);
    const second = twinGrab(first.state);
    expect(second.taken).toBe(true);
    expect(second.state.layers).toBe(0);
  });

  it("只剥了壳也有一部分价钱，不会白忙一趟", () => {
    const full = createTwin();
    expect(twinValue(full)).toBe(0);
    const cracked = twinGrab(full).state;
    expect(twinValue(cracked)).toBeGreaterThan(0);
    expect(twinValue(cracked)).toBeLessThan(NEW_ORES.twinCrystal.value);
    expect(twinValue({ layers: 0 })).toBe(NEW_ORES.twinCrystal.value);
  });
});

/* ---------------- 无尽矿井 ---------------- */

describe("1.2 无尽矿井加深", () => {
  it("越深照明圈越小，但有下限（再深也看得清顶部文字）", () => {
    expect(lightRadius(1)).toBeGreaterThan(lightRadius(10));
    expect(lightRadius(999)).toBe(LIGHT_MIN);
    for (let d = 1; d <= 200; d++) expect(lightRadius(d)).toBeGreaterThanOrEqual(LIGHT_MIN);
  });

  it("每 5 层一次补给点", () => {
    expect(isSupplyDepth(SUPPLY_EVERY)).toBe(true);
    expect(isSupplyDepth(SUPPLY_EVERY * 2)).toBe(true);
    expect(isSupplyDepth(SUPPLY_EVERY + 1)).toBe(false);
    expect(isSupplyDepth(0)).toBe(false);
  });

  it("补给永远是三选一，同 seed 同层结果一样", () => {
    const a = supplyChoices(10, 7);
    const b = supplyChoices(10, 7);
    expect(a.length).toBe(3);
    expect(a).toEqual(b);
    expect(new Set(a.map((o) => o.label)).size).toBe(3);
  });

  it("大袋金币只在深层出现", () => {
    const shallow = supplyChoices(SUPPLY_EVERY, 3);
    expect(shallow.every((o) => o.amount !== 240)).toBe(true);
  });

  it("领补给会真的进钱包，且不会超上限", () => {
    const w = emptyWallet(0);
    expect(applySupply(w, { kind: "coins", label: "", emoji: "", amount: 120, hint: "" }).coins).toBe(120);
    const full = { ...w, bombs: MAX_BOMBS, strength: MAX_STRENGTH, luck: MAX_LUCK };
    expect(applySupply(full, { kind: "bomb", label: "", emoji: "", amount: 2, hint: "" }).bombs).toBe(MAX_BOMBS);
    expect(applySupply(full, { kind: "power", label: "", emoji: "", amount: 1, hint: "" }).strength).toBe(MAX_STRENGTH);
    expect(applySupply(full, { kind: "luck", label: "", emoji: "", amount: 1, hint: "" }).luck).toBe(MAX_LUCK);
  });

  it("无尽每一层都是固定 seed 可复现的", () => {
    for (const d of [1, 5, 12, 30]) {
      expect(endlessLayer(d)).toEqual(endlessLayer(d));
    }
  });
});

/* ---------------- 188 关目标金额可达 ---------------- */

describe("1.2 188 关目标金额抽样可达", () => {
  it("抽样 20 关（含 1 / 100 / 145 / 188）模拟都能挖够目标", () => {
    const ids = [1, 2, 10, 25, 40, 55, 70, 85, 99, 100, 110, 120, 130, 140, 145, 155, 165, 175, 185, 188];
    const bad: number[] = [];
    for (const id of ids) {
      const lv = levelAt(id - 1);
      const best = Math.max(
        simulateRun(lv.field, { strategy: "value" }).coins,
        simulateRun(lv.field, { strategy: "greedy" }).coins,
        simulateRun(lv.field, { strategy: "near" }).coins,
      );
      if (best < lv.target) bad.push(id);
    }
    expect(bad).toEqual([]);
  });

  it("188 关一关不落都排得出来（关表没有空洞）", () => {
    const all = allLevels();
    expect(all.length).toBe(188);
    expect(all.every((l) => l.target > 0 && l.field.time > 0)).toBe(true);
  });
});
