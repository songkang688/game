/**
 * 气球砰砰 · 窗口 4 档A · 第 1 轮学习优化员
 *
 * 落地项 **A-L02**：连锁链的总时长压回「250ms 内连完」的规格窗口。
 *   原来一律 50ms 一颗，七颗以上就要响到 300–950ms。手指按下去半天还在噼里啪啦，
 *   孩子会以为没打中，回头又补一下——补到的多半是旁边的乌云球。
 *   改成「短链保持 50ms 的节奏，长到排不下才按比例压紧」，长短链都在 250ms 内收尾。
 *
 * 落地项 **A-L03**：`festPlan` 自己守住「同一时间只挂一个礼物气球」。
 *   原来纯函数层完全不管，全靠 `index.ts` 在 spawn 那一行兜底；
 *   兜底那行一旦被谁改没了，天上就会同时挂三四个要护的礼物，
 *   而单测层面一点动静都没有（W4A-03）。现在出场表按礼物的飞行时间自己隔开。
 */
import { describe, expect, it } from "vitest";
import {
  CHAIN_STEP_MS,
  CHAIN_WINDOW_MS,
  ESCAPE_Y,
  GIFT_MAX_ON_SCREEN,
  GIFT_RISE_MUL,
  SKY_H,
  SPEC_KINDS,
  chainDelays,
  chainDurationMs,
  chainStepMs,
  festGiftFlightS,
  festPlan,
  festRiseSpeed
} from "./logic";

describe("气球砰砰 · R1 学习优化 · A-L02 连锁链收在 250ms 里", () => {
  it("多长的链都在 250ms 内连完（原来 7 颗就超窗，20 颗要响将近一秒）", () => {
    for (let n = 0; n <= 40; n++) {
      expect(chainDurationMs(n), `${n} 颗的链`).toBeLessThanOrEqual(CHAIN_WINDOW_MS);
    }
  });

  it("短链的节奏一点没变：还是 50ms 一颗，听着就是原来那串「砰砰砰」", () => {
    expect(chainDelays(1)).toEqual([0]);
    expect(chainDelays(3)).toEqual([0, 50, 100]);
    expect(chainDelays(5)).toEqual([0, 50, 100, 150, 200]);
    expect(chainDelays(6)).toEqual([0, 50, 100, 150, 200, 250]);
    expect(chainStepMs(6)).toBe(CHAIN_STEP_MS);
  });

  it("排不下才压紧，而且是按比例压，不会有哪两颗挤在同一毫秒", () => {
    expect(chainStepMs(12)).toBeLessThan(CHAIN_STEP_MS);
    for (const n of [7, 9, 12, 20, 33]) {
      const d = chainDelays(n);
      expect(d, `${n} 颗`).toHaveLength(n);
      expect(d[0]).toBe(0);
      expect(d[n - 1]).toBe(CHAIN_WINDOW_MS);
      for (let i = 1; i < d.length; i++) {
        expect(d[i], `${n} 颗第 ${i} 个`).toBeGreaterThan(d[i - 1]);
      }
    }
  });

  it("空链和单颗链不会算出负数、NaN 或者一串 0", () => {
    expect(chainDelays(0)).toEqual([]);
    expect(chainDurationMs(0)).toBe(0);
    expect(chainDurationMs(1)).toBe(0);
    expect(chainStepMs(0)).toBe(CHAIN_STEP_MS);
    expect(chainStepMs(1)).toBe(CHAIN_STEP_MS);
  });

  it("链越长总时长只增不减，压紧不会把长链演得比短链还快", () => {
    let prev = -1;
    for (let n = 1; n <= 30; n++) {
      const d = chainDurationMs(n);
      expect(d, `${n} 颗`).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });
});

describe("气球砰砰 · R1 学习优化 · A-L03 出场表自己守礼物上限", () => {
  it("礼物的飞行时间是算出来的，不是拍脑袋填的：越到后面飘得越快、占位越短", () => {
    expect(festGiftFlightS(0)).toBeCloseTo((SKY_H + 40 - ESCAPE_Y) / (festRiseSpeed(0) * GIFT_RISE_MUL), 6);
    expect(festGiftFlightS(200)).toBeLessThan(festGiftFlightS(0));
    for (const w of [0, 10, 100, 5000]) expect(festGiftFlightS(w)).toBeGreaterThan(0);
  });

  it("出场表里任何两个礼物都不会在天上撞面（纯函数层就把上限守住了）", () => {
    expect(GIFT_MAX_ON_SCREEN).toBe(1);
    for (const seed of [1, 7, 99, 12345, 20250519]) {
      const plan = festPlan(seed, 600);
      let freeAt = -Infinity;
      let gifts = 0;
      plan.forEach((p, i) => {
        if (p.kind !== "gift") return;
        gifts++;
        expect(p.at, `种子 ${seed} 第 ${i} 个礼物`).toBeGreaterThanOrEqual(freeAt);
        freeAt = p.at + festGiftFlightS(i);
      });
      expect(gifts, `种子 ${seed}`).toBeGreaterThan(0);
    }
  });

  it("守上限只是把多出来的礼物降成普通球，出场表的长度和时刻表一点没动", () => {
    const plan = festPlan(12345, 400);
    expect(plan).toHaveLength(400);
    for (let i = 1; i < plan.length; i++) expect(plan[i].at).toBeGreaterThan(plan[i - 1].at);
    // 降级只在 gift 这一支上发生，其他四种照旧出场
    const kinds = new Set(festPlan(99, 600).map((p) => p.kind));
    for (const k of SPEC_KINDS) expect(kinds.has(k), `${k} 没出场`).toBe(true);
  });

  it("礼物变少了但没绝迹：长场次里还是稳定会遇到要护的礼物", () => {
    const gifts = festPlan(4242, 900).filter((p) => p.kind === "gift").length;
    expect(gifts).toBeGreaterThanOrEqual(5);
    // 一场 900 个球里礼物只占很小一撮，护礼物才是「偶尔来一次的小任务」
    expect(gifts).toBeLessThan(120);
  });

  it("同一个种子还是同一场：加了节流也没把可复现性弄丢", () => {
    expect(festPlan(20250519, 200)).toEqual(festPlan(20250519, 200));
    expect(festPlan(20250520, 200)).not.toEqual(festPlan(20250519, 200));
  });
});
