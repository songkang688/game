import { describe, expect, it } from "vitest";
import {
  FIRST_TAP_GAP_MS,
  HUMAN_TAP_CAP_HZ,
  MIN_EFFECTIVE_GAP_MS,
  SAME_KEY_DECAY,
  SAME_KEY_FLOOR,
  STEADY_BONUS,
  STEADY_FULL_TAPS,
  STEADY_TOLERANCE_MS,
  alternating,
  cadenceFactor,
  initRhythm,
  isSteadyTap,
  pacePerSec,
  sameFoot,
  sameKeyFactor,
  steadyFactor,
  tapRhythm,
  tapSeriesDistance,
  type StepKey
} from "./rhythm";

/** 一串按键按固定间隔敲下来，平均每秒推进多少（把「快」和「远」分开看） */
function perSecond(keys: readonly StepKey[], gapMs: number): number {
  const seconds = (keys.length * gapMs) / 1000;
  return tapSeriesDistance(keys, gapMs) / seconds;
}

describe("红蓝赛跑 · 交替节奏模型", () => {
  it("交替按满收益，连续同键一次比一次少，跌到地板为止", () => {
    expect(sameKeyFactor(0)).toBe(1);
    expect(sameKeyFactor(1)).toBeCloseTo(SAME_KEY_DECAY, 10);
    expect(sameKeyFactor(2)).toBeCloseTo(SAME_KEY_DECAY ** 2, 10);
    expect(sameKeyFactor(3)).toBeLessThan(sameKeyFactor(2));
    expect(sameKeyFactor(20)).toBe(SAME_KEY_FLOOR);
    // 脏值不许把倍率算飞
    expect(sameKeyFactor(-3)).toBe(1);
    expect(sameKeyFactor(Number.NaN)).toBe(1);
  });

  it("同样按 20 下，左右交替比一直砸同一个键跑得远得多", () => {
    const alt = tapSeriesDistance(alternating(20), 170);
    const same = tapSeriesDistance(sameFoot(20), 170);
    expect(alt).toBeGreaterThan(same);
    // 差距不是聊胜于无：交替至少多跑一半
    expect(alt).toBeGreaterThan(same * 1.5);
  });

  it("砸键不会更快：超过人手上限的频率按比例打折，每秒推进封顶", () => {
    expect(cadenceFactor(MIN_EFFECTIVE_GAP_MS)).toBe(1);
    expect(cadenceFactor(MIN_EFFECTIVE_GAP_MS * 2)).toBe(1);
    expect(cadenceFactor(MIN_EFFECTIVE_GAP_MS / 2)).toBeCloseTo(0.5, 10);
    expect(cadenceFactor(0)).toBe(0);
    expect(cadenceFactor(Number.NaN)).toBe(0);
    // 40ms 一下地乱砸，每秒推进反而不如踩在上限上稳稳交替
    expect(perSecond(alternating(30), 40)).toBeLessThan(perSecond(alternating(30), MIN_EFFECTIVE_GAP_MS));
  });

  it("节奏稳定才有加成：攒满有上限，抖一下就清零", () => {
    expect(steadyFactor(0)).toBe(1);
    expect(steadyFactor(STEADY_FULL_TAPS)).toBeCloseTo(1 + STEADY_BONUS, 10);
    expect(steadyFactor(99)).toBeCloseTo(1 + STEADY_BONUS, 10);
    expect(steadyFactor(-1)).toBe(1);
    expect(isSteadyTap(180, 180)).toBe(true);
    expect(isSteadyTap(180 + STEADY_TOLERANCE_MS, 180)).toBe(true);
    expect(isSteadyTap(180 + STEADY_TOLERANCE_MS + 1, 180)).toBe(false);
    // 砸键攒不出稳定加成
    expect(isSteadyTap(40, 40)).toBe(false);
    // 没有上一拍就谈不上稳
    expect(isSteadyTap(180, 0)).toBe(false);
  });

  it("状态机：第一拍不吃同键惩罚，之后换脚清零、同脚累计", () => {
    const s0 = initRhythm();
    const t1 = tapRhythm(s0, "left", FIRST_TAP_GAP_MS);
    expect(t1.alternated).toBe(false);
    expect(t1.state.sameStreak).toBe(0);
    expect(t1.multiplier).toBeCloseTo(1, 10);

    const t2 = tapRhythm(t1.state, "right", 170);
    expect(t2.alternated).toBe(true);
    expect(t2.state.sameStreak).toBe(0);

    const t3 = tapRhythm(t2.state, "right", 170);
    expect(t3.alternated).toBe(false);
    expect(t3.state.sameStreak).toBe(1);
    expect(t3.multiplier).toBeLessThan(t2.multiplier);

    const t4 = tapRhythm(t3.state, "right", 170);
    expect(t4.state.sameStreak).toBe(2);
    expect(t4.multiplier).toBeLessThan(t3.multiplier);
  });

  it("稳定层数会随着抖动清零，重新攒", () => {
    let state = initRhythm();
    for (let i = 0; i < 8; i++) state = tapRhythm(state, i % 2 === 0 ? "left" : "right", 180).state;
    expect(state.steadyTaps).toBe(STEADY_FULL_TAPS);
    const jitter = tapRhythm(state, "left", 400);
    expect(jitter.state.steadyTaps).toBe(0);
  });

  it("纯函数：传进来的状态不会被就地改写", () => {
    const s0 = initRhythm();
    const snapshot = { ...s0 };
    tapRhythm(s0, "left", 170);
    expect(s0).toEqual(snapshot);
  });

  it("交替 + 还没攒稳 = ×1.0，正好是 188 关可通关模拟用的基线", () => {
    // 会交替的真人只会比模拟更快，不会更慢，所以前 99 关的难度没被这套模型改掉
    const one = tapRhythm(initRhythm(), "left", FIRST_TAP_GAP_MS);
    expect(one.multiplier).toBeCloseTo(1, 10);
    const twenty = tapSeriesDistance(alternating(20), 1000 / 6);
    expect(twenty).toBeGreaterThanOrEqual(20);
  });

  it("人手上限是常量，不是拍脑袋的魔数", () => {
    expect(HUMAN_TAP_CAP_HZ).toBeGreaterThanOrEqual(7);
    expect(HUMAN_TAP_CAP_HZ).toBeLessThanOrEqual(9);
    expect(MIN_EFFECTIVE_GAP_MS).toBeCloseTo(1000 / HUMAN_TAP_CAP_HZ, 10);
    // 六年级的稳定手速 6 次/秒，按这套公式每秒能推进 11 格以上
    expect(pacePerSec(6, 1.6)).toBeGreaterThan(11);
    expect(pacePerSec(0, 1.6)).toBe(0);
  });

  it("生成器：交替序列真的左右交替，同脚序列真的只有一只脚", () => {
    expect(alternating(4)).toEqual(["left", "right", "left", "right"]);
    expect(alternating(0)).toEqual([]);
    expect(alternating(-2)).toEqual([]);
    expect(new Set(sameFoot(5))).toEqual(new Set(["left"]));
    expect(sameFoot(3, "right")).toEqual(["right", "right", "right"]);
  });
});
