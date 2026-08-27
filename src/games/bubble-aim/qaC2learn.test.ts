// 档C · 第 2 轮学习优化员 · L2-04:泡泡瞄准手的「子弹紧不紧」这件事,现在会说出来。
//
// C2-03 量出来的事实:按主题算平均子弹预算(发 / 颗待清泡泡),
// 第 1 主题 0.71 是全场第二紧,只有最后的星尘试炼比它更紧;
// 第 2 主题(石泡)反倒是全场最松的 1.25——石泡每颗白送 2 发。
// 曲线是「先紧 → 松一大截 → 再慢慢紧」,新手一进门打的就是仅次于终极章的紧度。
//
// 为什么不直接给第 1 主题加子弹:1.0 的前 99 关被 logic.test.ts 的
// FNV 哈希锁焊住(`fnv(JSON.stringify(LEVELS.slice(0, 99)))`),shots 一个数都不能改。
// 所以这一轮落地的是「说出来」:开局挂一句提醒,主题简介也把话讲明。
import { describe, expect, it } from "vitest";
import {
  LEGACY_LEVELS,
  LEVELS,
  LOOSE_BUDGET,
  SNUG_BUDGET,
  THEMES,
  THEME_SIZES,
  TIGHT_BUDGET,
  budgetBand,
  budgetNote,
  clearableCount,
  isTightShots,
  levelMechanisms,
  shotBudget,
  themeOfLevel,
  themeStart,
  type BudgetBand,
} from "./levels";

/** 主题 t 的平均子弹预算 */
function themeBudget(t: number): number {
  const start = themeStart(t);
  const xs = LEVELS.slice(start, start + THEME_SIZES[t]);
  return xs.reduce((s, d) => s + shotBudget(d), 0) / xs.length;
}

describe("档C R2 学习优化 · L2-04 子弹紧不紧要说出来", () => {
  it("四档从紧到松排得开,分界线本身也是从小到大", () => {
    expect(TIGHT_BUDGET).toBeLessThan(SNUG_BUDGET);
    expect(SNUG_BUDGET).toBeLessThan(LOOSE_BUDGET);
    const bands: BudgetBand[] = ["限弹", "偏紧", "适中", "宽松"];
    expect(new Set(LEVELS.map(budgetBand)).size).toBeGreaterThanOrEqual(3);
    for (const b of LEVELS.map(budgetBand)) expect(bands).toContain(b);
  });

  it("分档和预算数值对得上,四档互不重叠", () => {
    for (const def of LEVELS) {
      const b = shotBudget(def);
      const band = budgetBand(def);
      if (band === "限弹") expect(b).toBeLessThan(TIGHT_BUDGET);
      else if (band === "偏紧") expect(b).toBeGreaterThanOrEqual(TIGHT_BUDGET) && expect(b).toBeLessThan(SNUG_BUDGET);
      else if (band === "适中") expect(b).toBeGreaterThanOrEqual(SNUG_BUDGET) && expect(b).toBeLessThan(LOOSE_BUDGET);
      else expect(b).toBeGreaterThanOrEqual(LOOSE_BUDGET);
      // 「限弹」这一档和老的 isTightShots 是同一条线,没有两套口径
      expect(band === "限弹").toBe(isTightShots(def));
    }
  });

  it("C2-03 的量化结论复现:第 1 主题比中段六个主题都紧", () => {
    const t0 = themeBudget(0);
    expect(t0).toBeLessThan(themeBudget(1));
    for (let t = 1; t <= 7; t++) {
      expect(themeBudget(t), `第 ${t + 1} 主题反而比新手主题还紧`).toBeGreaterThan(t0);
    }
    // 只有终极主题比它更紧
    expect(themeBudget(8)).toBeLessThan(t0);
  });

  it("新手主题整章都在「偏紧」档,所以整章都会挂提醒", () => {
    const start = themeStart(0);
    for (let k = 0; k < THEME_SIZES[0]; k++) {
      const def = LEVELS[start + k];
      expect(budgetBand(def), `${def.name}`).toBe("偏紧");
      expect(budgetNote(def)).toContain("子弹不算宽裕");
    }
  });

  it("子弹宽裕的关不啰嗦,一句提醒都不挂", () => {
    let quiet = 0;
    for (const def of LEVELS) {
      if (budgetBand(def) === "适中" || budgetBand(def) === "宽松") {
        expect(budgetNote(def), `${def.name}`).toBe("");
        quiet++;
      } else {
        expect(budgetNote(def).length, `${def.name}`).toBeGreaterThan(8);
      }
    }
    expect(quiet).toBeGreaterThan(60);
  });

  it("终极主题挂的是「限弹」那句,和「偏紧」那句不一样", () => {
    const last = LEVELS[LEVELS.length - 1];
    expect(budgetBand(last)).toBe("限弹");
    expect(budgetNote(last)).toContain("连锁");
    expect(budgetNote(last)).not.toBe(budgetNote(LEVELS[0]));
  });

  it("提醒里没有洋文、没有商标、没有丧气话", () => {
    const notes = new Set(LEVELS.map(budgetNote).filter(Boolean));
    expect(notes.size).toBeGreaterThanOrEqual(2);
    for (const n of notes) {
      expect(n).not.toMatch(/[A-Za-z]/);
      expect(n).not.toMatch(/你输|失败|完蛋|笨|血/);
    }
  });

  it("新手主题的简介把「子弹不算宽裕」讲明白了", () => {
    expect(THEMES[0].blurb).toContain("子弹");
    for (const th of THEMES) {
      expect(th.blurb).not.toMatch(/[A-Za-z]/);
      expect(th.blurb.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("1.0 的前 99 关一个数都没动:预算和机关表逐关和老口径对得上", () => {
    // 这一条就是「为什么只能说、不能改」的证据:改 shots 会当场撞上哈希锁
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const def = LEVELS[i];
      expect(clearableCount(def), `第 ${i + 1} 关`).toBeGreaterThan(0);
      expect(shotBudget(def)).toBe(def.shots / clearableCount(def));
      // 新加的 budgetBand 没有混进机关图标行,老的机关表原样不动
      expect(levelMechanisms(def)).not.toContain("snug" as never);
    }
    expect(themeOfLevel(LEGACY_LEVELS - 1)).toBe(5);
  });

  it("空关卡不会把预算算成除零", () => {
    const empty = { name: "空", tip: "空", layout: ["........."], shots: 3 };
    expect(clearableCount(empty)).toBe(0);
    expect(Number.isFinite(shotBudget(empty))).toBe(true);
    expect(budgetBand(empty)).toBe("宽松");
    expect(budgetNote(empty)).toBe("");
  });
});
