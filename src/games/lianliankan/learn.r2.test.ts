/**
 * 连连看 · 窗口 4 档A · 第 2 轮学习优化员：A-L08。
 *
 * 无尽模式的第 7 / 10 / 13 盘是一次拧三四个旋钮的大台阶
 * （图案又多一种、收拢方向又换、线还只准拐一次、表还收紧了），
 * 而 `endlessStepWord` 原来只报其中一条。孩子照着上一盘的打法下手，
 * 要撞好几次墙才慢慢发现规矩变的不止一条。
 *
 * 改法：拆出 `endlessStepChanges` 把这一盘拧动的旋钮全列出来，
 * `endlessStepWord` 变了几样就说几样。
 */
import { describe, expect, it } from "vitest";
import {
  ENDLESS_FREE_ROUNDS, endlessKinds, endlessSeconds, endlessSpec, endlessStepChanges, endlessStepWord
} from "./logic";

/** 第 round 盘相对上一盘真正拧动了几个旋钮 */
function knobs(round: number): number {
  if (round <= 1) return 0;
  const a = endlessSpec(round - 1);
  const b = endlessSpec(round);
  let n = 0;
  if (b.kinds !== a.kinds) n++;
  if (b.maxTurns !== a.maxTurns) n++;
  if (b.gravity !== a.gravity) n++;
  if (endlessSeconds(round) !== endlessSeconds(round - 1)) n++;
  return n;
}

describe("连连看 · A-L08 · 变了几样就说几样", () => {
  it("每一盘报出来的条数，和真正拧动的旋钮数一样多", () => {
    for (let r = 2; r <= 80; r++) {
      expect(endlessStepChanges(r).length, `第 ${r} 盘`).toBe(knobs(r));
    }
  });

  it("第 13 盘四样一起变，四样都在提示语里", () => {
    expect(knobs(13)).toBe(4);
    const word = endlessStepWord(13);
    for (const key of ["拐一次弯", "秒", "收拢", "图案"]) {
      expect(word, `第 13 盘的提示语「${word}」`).toContain(key);
    }
  });

  it("第 7 / 10 盘也是大台阶，同样一条不落", () => {
    for (const r of [7, 10]) {
      expect(knobs(r)).toBeGreaterThanOrEqual(3);
      expect(endlessStepChanges(r).length).toBe(knobs(r));
    }
  });

  it("只变一样的盘还是只说一句，没变的盘就说「接着连」", () => {
    for (let r = 2; r <= 80; r++) {
      if (knobs(r) === 0) expect(endlessStepWord(r)).toContain("接着连");
      if (knobs(r) === 1) expect(endlessStepChanges(r)).toHaveLength(1);
    }
  });

  it("第 1 盘还是那句热身，第 4 盘还是那句「要看表」", () => {
    expect(endlessStepWord(1)).toContain("热热身");
    expect(endlessStepChanges(1)).toEqual([]);
    expect(endlessStepWord(ENDLESS_FREE_ROUNDS + 1)).toContain("秒");
    expect(endlessStepWord(13)).toContain("拐一次");
  });

  it("时间一档一档收紧的那些盘也报得出来，不再是悄悄变紧", () => {
    const shrinking: number[] = [];
    for (let r = 2; r <= 20; r++) {
      if (endlessSeconds(r) > 0 && endlessSeconds(r) < endlessSeconds(r - 1)) shrinking.push(r);
    }
    expect(shrinking.length).toBeGreaterThan(0);
    for (const r of shrinking) {
      expect(endlessStepWord(r), `第 ${r} 盘`).toContain(`${endlessSeconds(r)} 秒`);
    }
  });

  it("提示语只描述、不催不批评，而且始终带得上盘号", () => {
    for (let r = 1; r <= 40; r++) {
      const word = endlessStepWord(r);
      expect(word).toContain(`第 ${r} 盘`);
      expect(word).not.toMatch(/快点|笨|不行|失败|输/);
    }
  });

  it("图案种类封顶之后就不再报「图案多了一种」了", () => {
    expect(endlessKinds(26)).toBe(endlessKinds(999));
    for (let r = 26; r <= 60; r++) {
      expect(endlessStepChanges(r).some((c) => c.includes("图案")), `第 ${r} 盘`).toBe(false);
    }
  });
});
