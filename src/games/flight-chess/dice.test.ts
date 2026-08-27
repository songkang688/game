import { describe, expect, it } from "vitest";
import {
  CLASSIC_RULES,
  DICE_FACES,
  IMPROVED_RULES,
  SIX_STREAK_LIMIT,
  canTakeOff,
  extraRoll,
  roll,
  rollSeq,
  spinFrames,
  takeOffGrantsExtra,
  withRules
} from "./dice";

describe("可种子化骰子", () => {
  it("同一个 (seed, index) 永远给同一个点数，范围是 1..6", () => {
    for (let i = 0; i < 300; i++) {
      const a = roll(2024, i);
      expect(a).toBe(roll(2024, i));
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(6);
      expect(Number.isInteger(a)).toBe(true);
    }
  });

  it("换种子就换一整串点数，六个面都出得来", () => {
    const a = rollSeq(11, 60);
    const b = rollSeq(12, 60);
    expect(a).not.toEqual(b);
    expect(new Set(rollSeq(7, 400)).size).toBe(6);
  });

  it("骰子转几圈再停:最后一帧就是真正的点数", () => {
    const frames = spinFrames(31, 5, false);
    const short = spinFrames(31, 5, true);
    expect(frames.length).toBeGreaterThan(short.length);
    expect(frames.at(-1)).toBe(roll(31, 5));
    expect(short.at(-1)).toBe(roll(31, 5));
    expect(short.length).toBeGreaterThan(1);
    expect(DICE_FACES[roll(31, 5)]).toBeTruthy();
  });
});

describe("起飞与连掷", () => {
  it("传统规则只有 6 能起飞，起飞之后还能再掷一次", () => {
    expect(canTakeOff(6, CLASSIC_RULES)).toBe(true);
    expect(canTakeOff(5, CLASSIC_RULES)).toBe(false);
    expect(canTakeOff(1, CLASSIC_RULES)).toBe(false);
    expect(takeOffGrantsExtra(6, CLASSIC_RULES)).toBe(true);
  });

  it("改进规则 5 或 6 都能起飞，但掷 5 起飞之后不再掷", () => {
    expect(canTakeOff(5, IMPROVED_RULES)).toBe(true);
    expect(canTakeOff(6, IMPROVED_RULES)).toBe(true);
    expect(takeOffGrantsExtra(5, IMPROVED_RULES)).toBe(false);
    expect(takeOffGrantsExtra(6, IMPROVED_RULES)).toBe(true);
  });

  it("连续三个 6 取消这一次移动并跳过，计数清零", () => {
    expect(SIX_STREAK_LIMIT).toBe(3);
    const first = extraRoll(6, 0);
    expect(first).toEqual({ again: true, cancel: false, streak: 1 });
    const second = extraRoll(6, first.streak);
    expect(second).toEqual({ again: true, cancel: false, streak: 2 });
    const third = extraRoll(6, second.streak);
    expect(third).toEqual({ again: false, cancel: true, streak: 0 });
  });

  it("中间掷出别的点数，连 6 计数就断了", () => {
    const a = extraRoll(6, 0);
    const b = extraRoll(3, a.streak);
    expect(b).toEqual({ again: false, cancel: false, streak: 0 });
    expect(extraRoll(6, b.streak).cancel).toBe(false);
  });

  it("关掉处罚的规则下，连几个 6 都不会作废", () => {
    const loose = withRules(CLASSIC_RULES, { punishThreeSixes: false });
    expect(extraRoll(6, 2, loose)).toEqual({ again: true, cancel: false, streak: 3 });
    expect(CLASSIC_RULES.punishThreeSixes).toBe(true);
  });

  it("withRules 只改副本，常量本身一个字都不动", () => {
    const patched = withRules(CLASSIC_RULES, { takeOff: [1, 2] });
    expect(patched.takeOff).toEqual([1, 2]);
    expect(CLASSIC_RULES.takeOff).toEqual([6]);
    expect(IMPROVED_RULES.takeOff).toEqual([5, 6]);
  });
});
