/**
 * 勇者之路 · 窗口 4 档A · 第 1 轮学习优化员
 *
 * 落地项 **A-L06**：深渊祝福在星芒见底时，两个选项里保证留一个「能补回来」的。
 *
 * 原来 `rollBlessings(depth)` 只看层数：六个祝福里洗两个出来，跟现在还剩多少血无关。
 * 于是常常出现「带着 18% 的星芒走到祝福层，摆在面前的是锋利磨石和幸运铃铛」——
 * 两个都是往前冲的选项，孩子只能挑一个然后在下一层被送回城。
 * 这不是难度，是没得选。低于 35% 就把第二个位置换成温泉小憩，
 * 「稳一手」从此永远是个能选的选择；血够的时候一切照旧，抽卡的乐趣一点没少。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BLESSING_EVERY,
  BLESSING_RESCUE_FRAC,
  applyBlessing,
  buildHero,
  defaultSave,
  isBlessingFloor,
  rollBlessings,
  type Blessing
} from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

const heals = (b: Blessing): boolean => b.kind === "heal" || b.kind === "maxhp";
const floors = (upTo = 150): number[] => {
  const out: number[] = [];
  for (let d = 1; d <= upTo; d++) if (isBlessingFloor(d)) out.push(d);
  return out;
};

describe("勇者之路 · R1 学习优化 · A-L06 见底时一定留一个回复位", () => {
  it("血够的时候一个字都没变：默认调用与满血调用完全一致", () => {
    for (const d of floors()) {
      expect(JSON.stringify(rollBlessings(d, 1)), `第 ${d} 层`).toBe(JSON.stringify(rollBlessings(d)));
    }
  });

  it("星芒低于 35% 时，两个选项里一定有一个能立刻补回来", () => {
    expect(BLESSING_RESCUE_FRAC).toBeGreaterThan(0);
    expect(BLESSING_RESCUE_FRAC).toBeLessThan(0.5);
    for (const d of floors(240)) {
      for (const frac of [0, 0.05, 0.2, BLESSING_RESCUE_FRAC]) {
        const pick = rollBlessings(d, frac);
        expect(pick.some(heals), `第 ${d} 层 · 星芒 ${frac}`).toBe(true);
      }
    }
  });

  it("这条保底真的会触发：确实存在「原本两个都不回血」的祝福层", () => {
    const rescued = floors(240).filter((d) => !rollBlessings(d).some(heals));
    expect(rescued.length).toBeGreaterThan(0);
    for (const d of rescued) {
      expect(JSON.stringify(rollBlessings(d, 0.1))).not.toBe(JSON.stringify(rollBlessings(d)));
    }
  });

  it("刚好卡在 35% 线上算「要救」，高一点点就照旧抽卡", () => {
    const rescued = floors(240).filter((d) => !rollBlessings(d).some(heals));
    const d = rescued[0];
    expect(rollBlessings(d, BLESSING_RESCUE_FRAC).some(heals)).toBe(true);
    expect(rollBlessings(d, BLESSING_RESCUE_FRAC + 0.01).some(heals)).toBe(false);
  });

  it("永远是「二选一」，而且两个选项不会撞成同一个", () => {
    for (const d of floors(240)) {
      for (const frac of [0, 0.2, 0.6, 1]) {
        const pick = rollBlessings(d, frac);
        expect(pick, `第 ${d} 层 · 星芒 ${frac}`).toHaveLength(2);
        expect(pick[0].id).not.toBe(pick[1].id);
      }
    }
  });

  it("同一层 + 同一个血量，抽到的永远是同一对（可复现）", () => {
    for (const d of [3, 6, 24, 96]) {
      expect(JSON.stringify(rollBlessings(d, 0.2))).toBe(JSON.stringify(rollBlessings(d, 0.2)));
    }
  });

  it("保底给出来的祝福是能真正用的：套在残血勇者身上血会涨", () => {
    const hero = buildHero(defaultSave());
    hero.hp = Math.max(1, Math.round(hero.maxHp * 0.2));
    const rescued = floors(240).filter((d) => !rollBlessings(d).some(heals));
    const pick = rollBlessings(rescued[0], 0.2).find(heals) as Blessing;
    const after = applyBlessing(hero, pick);
    expect(after.hp).toBeGreaterThan(hero.hp);
    expect(after.hp).toBeLessThanOrEqual(after.maxHp);
    // 文案照旧只描述好处，不数落人
    expect(pick.desc).not.toMatch(/血|死|输|笨|失败/);
  });

  it("真机把现在的星芒比例传了进去，不是白改一个参数", () => {
    expect(SRC).toContain("rollBlessings(depth, hero.maxHp > 0 ? hero.hp / hero.maxHp : 1)");
    expect(BLESSING_EVERY).toBeGreaterThan(0);
  });
});
