/**
 * 雪球大作战 1.2 · 「反应慢」在防守这一侧以前是反着的。
 *
 * `aiInput` 里判断「要不要蹲下躲这一发」的阈值原本写成 `eta < 0.15 + tune.react`:
 * `react` 是反应时间,越大代表这个档次越迟钝,可它在这里是**加**在阈值上的,
 * 于是初学者(react 1.1)在球还有 1.25 秒才到的时候就蹲下,
 * 风向大师(react 0.36)要等到 0.51 秒才动。
 *
 * 而 `incomingIn` 最多只往前看 `DUCK_LOOKAHEAD` = 1 秒 ——
 * 1.25 秒的阈值等于「只要视野里有球飞过来就一定蹲」。
 * 也就是说三档里最迟钝的那一档躲得最干净,
 * `brains.ts` 开头写的「档次差的是看得多晚」在防守上从来没成立过。
 *
 * 现在按人的常识算:反应时间是从看见到动起来的延迟,余量就少这么多。
 * 越迟钝的档次越要等球快到脸上才蹲,也就越容易蹲晚。
 */
import { describe, expect, it } from "vitest";
import { AI_12, DUCK_LOOKAHEAD, duckWhenUnder } from "./brains";
import type { AiLevel } from "./physics";

const TIERS: AiLevel[] = ["easy", "normal", "hard"];

describe("1.2 · 什么时候蹲下躲球", () => {
  it("反应越慢,留给自己的余量越少 —— 方向掰回来了", () => {
    const easy = duckWhenUnder(AI_12.easy.react);
    const normal = duckWhenUnder(AI_12.normal.react);
    const hard = duckWhenUnder(AI_12.hard.react);
    expect(hard).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(easy);
  });

  it("以前那条公式是反的:老算法给初学者的余量比大师还大", () => {
    const old = (react: number): number => 0.15 + react;
    expect(old(AI_12.easy.react)).toBeGreaterThan(old(AI_12.hard.react));
    // 而且初学者那条老阈值比「看得见的最远」还远,等于无条件蹲
    expect(old(AI_12.easy.react)).toBeGreaterThan(DUCK_LOOKAHEAD);
    // 新算法一档都不会超过视野
    for (const t of TIERS) {
      expect(duckWhenUnder(AI_12[t].react)).toBeLessThanOrEqual(DUCK_LOOKAHEAD);
    }
  });

  it("再菜也留一点本能:最低 0.12 秒,不会站着挨完一整局", () => {
    expect(duckWhenUnder(99)).toBeCloseTo(0.12, 9);
    expect(duckWhenUnder(AI_12.easy.react)).toBeCloseTo(0.12, 9);
    for (const t of TIERS) expect(duckWhenUnder(AI_12[t].react)).toBeGreaterThan(0);
  });

  it("反应时间为 0 的话就是整个视野都来得及躲", () => {
    expect(duckWhenUnder(0)).toBeCloseTo(DUCK_LOOKAHEAD, 9);
    // 负数当 0 处理,不会算出比视野还长的余量
    expect(duckWhenUnder(-5)).toBeCloseTo(DUCK_LOOKAHEAD, 9);
  });

  it("风向大师留得出半秒以上的余量:该躲的都躲得掉", () => {
    expect(duckWhenUnder(AI_12.hard.react)).toBeGreaterThan(0.5);
  });
});
