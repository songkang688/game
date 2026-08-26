import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_TTL_MS,
  LOCK_MS,
  QUESTION_TIME_MS,
  SKIP_KEY_PREFIX,
  authRemainMs,
  checkAnswer,
  clearSkipRecords,
  createAuthSession,
  formatSkipSummary,
  grantAuth,
  isAuthorized,
  makeBasicQuestion,
  makeDivModQuestion,
  makeHighQuestion,
  makeMixed3Question,
  makeMul2Question,
  makeQuestion,
  parseDivModInput,
  parseSkippedLevels,
  readSkipRecords,
  requestParentAuth,
  resetParentAuth,
  type AuthQuestion,
  type SkipStorageLike
} from "./parentAuth";

// --- 假随机:自带一个小 PRNG,不依赖别人的文件 ---
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 依次吐出给定值再循环,用来精确点名题型 / 数值 */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

// --- 假时钟:手动推进,不真 sleep ---
function fakeClock(start = 1_700_000_000_000): { now: () => number; advance: (ms: number) => void } {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    }
  };
}

/** 题面求值器(先乘除后加减),用来独立验证混合运算题的标准答案 */
function evalExpr(text: string): number {
  const tokens = text.replace(/\s*=\s*\?$/, "").trim().split(/\s+/);
  const nums: number[] = [Number(tokens[0])];
  const ops: string[] = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const n = Number(tokens[i + 1]);
    if (op === "×") nums[nums.length - 1] *= n;
    else if (op === "÷") nums[nums.length - 1] /= n;
    else {
      ops.push(op);
      nums.push(n);
    }
  }
  let out = nums[0];
  for (let i = 0; i < ops.length; i++) out = ops[i] === "+" ? out + nums[i + 1] : out - nums[i + 1];
  return out;
}

/** 带 spy 的假 localStorage,用来证明授权流程一个字都不落盘 */
function spyStorage(): SkipStorageLike & {
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  map: Map<string, string>;
} {
  const map = new Map<string, string>();
  return {
    map,
    getItem: vi.fn((k: string) => map.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      map.set(k, v);
    }),
    removeItem: vi.fn((k: string) => {
      map.delete(k);
    }),
    keys: () => [...map.keys()]
  };
}

function memStorage(entries: Record<string, string> = {}): SkipStorageLike {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k) => map.get(k) ?? null,
    removeItem: (k) => {
      map.delete(k);
    },
    keys: () => [...map.keys()]
  };
}

beforeEach(() => {
  resetParentAuth();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("出题范围", () => {
  it("basic 档永远是 3–9 × 3–9 的乘法", () => {
    for (let s = 1; s <= 200; s++) {
      const q = makeBasicQuestion(prng(s));
      const m = /^(\d+) × (\d+) = \?$/.exec(q.text);
      expect(m, q.text).not.toBeNull();
      const a = Number(m![1]);
      const b = Number(m![2]);
      expect(a).toBeGreaterThanOrEqual(3);
      expect(a).toBeLessThanOrEqual(9);
      expect(b).toBeGreaterThanOrEqual(3);
      expect(b).toBeLessThanOrEqual(9);
      expect(q.answer).toBe(a * b);
      expect(q.kind).toBe("basic-mul");
    }
  });

  it("两位数乘法在 12–39 × 11–29 之间,答案与题面一致", () => {
    for (let s = 1; s <= 200; s++) {
      const q = makeMul2Question(prng(s));
      const m = /^(\d+) × (\d+) = \?$/.exec(q.text);
      expect(m, q.text).not.toBeNull();
      const a = Number(m![1]);
      const b = Number(m![2]);
      expect(a).toBeGreaterThanOrEqual(12);
      expect(a).toBeLessThanOrEqual(39);
      expect(b).toBeGreaterThanOrEqual(11);
      expect(b).toBeLessThanOrEqual(29);
      expect(q.answer).toBe(a * b);
      expect(q.kind).toBe("mul2");
    }
  });

  it("混合运算是三步,答案与题面按「先乘除后加减」一致", () => {
    for (let s = 1; s <= 200; s++) {
      const q = makeMixed3Question(prng(s));
      const ops = q.text.match(/[+\-×÷]/g) ?? [];
      expect(ops.length, q.text).toBe(3);
      expect(q.answer, q.text).toBe(evalExpr(q.text));
      expect(q.kind).toBe("mixed3");
    }
  });

  it("混合运算结果恒为正整数(不给大人负数和小数)", () => {
    for (let s = 1; s <= 200; s++) {
      const q = makeMixed3Question(prng(s));
      expect(q.answer, q.text).toBeGreaterThan(0);
      expect(Number.isInteger(q.answer), q.text).toBe(true);
    }
  });

  it("带余除法是三位数 ÷ 两位数,余数在 1 到除数减一之间", () => {
    for (let s = 1; s <= 200; s++) {
      const q = makeDivModQuestion(prng(s));
      const m = /^(\d+) ÷ (\d+) = \?$/.exec(q.text);
      expect(m, q.text).not.toBeNull();
      const dividend = Number(m![1]);
      const divisor = Number(m![2]);
      expect(dividend).toBeGreaterThanOrEqual(100);
      expect(dividend).toBeLessThanOrEqual(999);
      expect(divisor).toBeGreaterThanOrEqual(10);
      expect(divisor).toBeLessThanOrEqual(99);
      expect(q.remainder).toBeGreaterThanOrEqual(1);
      expect(q.remainder!).toBeLessThan(divisor);
      expect(divisor * q.answer + q.remainder!).toBe(dividend);
    }
  });

  it("high 档三种题型都会被抽到", () => {
    const kinds = new Set<string>();
    for (let s = 1; s <= 200; s++) kinds.add(makeHighQuestion(prng(s)).kind);
    expect(kinds).toEqual(new Set(["mul2", "mixed3", "divmod"]));
  });

  it("makeQuestion 按档位选题:basic 出乘法,high 出难题", () => {
    expect(makeQuestion("basic", prng(7)).kind).toBe("basic-mul");
    expect(["mul2", "mixed3", "divmod"]).toContain(makeQuestion("high", prng(7)).kind);
    // rand 恒为 0 时点名第一种题型
    expect(makeQuestion("high", seq([0])).kind).toBe("mul2");
  });
});

describe("判题", () => {
  const q: AuthQuestion = { kind: "mul2", text: "27 × 18 = ?", answer: 486, placeholder: "答案" };

  it("答对就是对,答错就是错", () => {
    expect(checkAnswer(q, "486")).toBe(true);
    expect(checkAnswer(q, "485")).toBe(false);
  });

  it("容忍空格与全角数字", () => {
    expect(checkAnswer(q, " 486 ")).toBe(true);
    expect(checkAnswer(q, "４８６")).toBe(true);
  });

  it("空串与非数字一律算错", () => {
    expect(checkAnswer(q, "")).toBe(false);
    expect(checkAnswer(q, "四百八十六")).toBe(false);
    expect(checkAnswer(q, "48a6")).toBe(false);
  });

  it("带余除法认「商...余...」的多种写法", () => {
    expect(parseDivModInput("12...5")).toEqual({ quotient: 12, remainder: 5 });
    expect(parseDivModInput("12…5")).toEqual({ quotient: 12, remainder: 5 });
    expect(parseDivModInput("商 12 余 5")).toEqual({ quotient: 12, remainder: 5 });
    expect(parseDivModInput("12,5")).toEqual({ quotient: 12, remainder: 5 });
  });

  it("带余除法的非法输入返回 null", () => {
    expect(parseDivModInput("12")).toBeNull();
    expect(parseDivModInput("")).toBeNull();
    expect(parseDivModInput("十二余五")).toBeNull();
  });

  it("带余除法商对余错也算错", () => {
    const dm: AuthQuestion = {
      kind: "divmod",
      text: "437 ÷ 21 = ?",
      answer: 20,
      remainder: 17,
      placeholder: "例如 12...5"
    };
    expect(checkAnswer(dm, "20...17")).toBe(true);
    expect(checkAnswer(dm, "20...16")).toBe(false);
    expect(checkAnswer(dm, "20")).toBe(false);
  });
});

describe("basic 档会话", () => {
  it("答对一道就通过并拿到授权", () => {
    const clock = fakeClock();
    const s = createAuthSession("basic", { now: clock.now, rand: prng(3) });
    expect(s.policy.needCorrect).toBe(1);
    expect(s.submit(String(s.question().answer))).toBe("passed");
    expect(s.passed()).toBe(true);
    expect(isAuthorized("basic", clock.now())).toBe(true);
  });

  it("basic 档不限时,题目剩余时间是无限", () => {
    const clock = fakeClock();
    const s = createAuthSession("basic", { now: clock.now, rand: prng(3) });
    clock.advance(10 * 60_000);
    expect(s.questionRemainMs()).toBe(Number.POSITIVE_INFINITY);
    expect(s.isTimedOut()).toBe(false);
    expect(s.submit(String(s.question().answer))).toBe("passed");
  });
});

describe("high 档:连续答对两道才通过", () => {
  it("第一道答对只是「correct」,还没授权", () => {
    const clock = fakeClock();
    const s = createAuthSession("high", { now: clock.now, rand: prng(11) });
    expect(s.policy.needCorrect).toBe(2);
    expect(s.submit(answerOf(s.question()))).toBe("correct");
    expect(s.correctCount()).toBe(1);
    expect(s.passed()).toBe(false);
    expect(isAuthorized("high", clock.now())).toBe(false);
  });

  it("连过两道才 passed 并拿到 high 授权", () => {
    const clock = fakeClock();
    const s = createAuthSession("high", { now: clock.now, rand: prng(11) });
    expect(s.submit(answerOf(s.question()))).toBe("correct");
    expect(s.submit(answerOf(s.question()))).toBe("passed");
    expect(s.passed()).toBe(true);
    expect(isAuthorized("high", clock.now())).toBe(true);
  });

  it("中间答错一道,连对计数清零重新来", () => {
    const clock = fakeClock();
    const s = createAuthSession("high", { now: clock.now, rand: prng(11) });
    expect(s.submit(answerOf(s.question()))).toBe("correct");
    expect(s.submit("这是瞎写的")).toBe("wrong");
    expect(s.correctCount()).toBe(0);
    expect(s.submit(answerOf(s.question()))).toBe("correct");
    expect(s.passed()).toBe(false);
  });

  it("已经通过的会话再提交仍然是 passed(幂等)", () => {
    const clock = fakeClock();
    const s = createAuthSession("high", { now: clock.now, rand: prng(11) });
    s.submit(answerOf(s.question()));
    s.submit(answerOf(s.question()));
    expect(s.submit("随便写")).toBe("passed");
  });
});

describe("每题限时 45 秒", () => {
  it("到点没答就算超时,并换一道新题", () => {
    const clock = fakeClock();
    const s = createAuthSession("high", { now: clock.now, rand: prng(5) });
    expect(s.questionRemainMs()).toBe(QUESTION_TIME_MS);
    const before = s.question().text;
    clock.advance(QUESTION_TIME_MS);
    expect(s.isTimedOut()).toBe(true);
    expect(s.expireIfTimedOut()).toBe(true);
    expect(s.wrongCount()).toBe(1);
    expect(s.question().text).not.toBe(before);
    expect(s.questionRemainMs()).toBe(QUESTION_TIME_MS);
  });

  it("差 1 毫秒不算超时", () => {
    const clock = fakeClock();
    const s = createAuthSession("high", { now: clock.now, rand: prng(5) });
    clock.advance(QUESTION_TIME_MS - 1);
    expect(s.isTimedOut()).toBe(false);
    expect(s.expireIfTimedOut()).toBe(false);
    expect(s.submit(answerOf(s.question()))).toBe("correct");
  });

  it("超时后再提交(哪怕答案是对的)也判超时", () => {
    const clock = fakeClock();
    const s = createAuthSession("high", { now: clock.now, rand: prng(5) });
    const right = answerOf(s.question());
    clock.advance(QUESTION_TIME_MS + 10);
    expect(s.submit(right)).toBe("timeout");
    expect(s.passed()).toBe(false);
  });
});

describe("防暴力:答错 2 次锁 90 秒", () => {
  it("第二次答错就锁定,期间提交一律 locked", () => {
    const clock = fakeClock();
    const s = createAuthSession("high", { now: clock.now, rand: prng(9) });
    expect(s.submit("1")).toBe("wrong");
    expect(s.isLocked()).toBe(false);
    expect(s.submit("1")).toBe("wrong");
    expect(s.isLocked()).toBe(true);
    expect(s.lockRemainMs()).toBe(LOCK_MS);
    expect(s.submit(answerOf(s.question()))).toBe("locked");
  });

  it("锁定倒计时随时间递减,锁定期间不再判题目超时", () => {
    const clock = fakeClock();
    const s = createAuthSession("high", { now: clock.now, rand: prng(9) });
    s.submit("1");
    s.submit("1");
    clock.advance(30_000);
    expect(s.lockRemainMs()).toBe(LOCK_MS - 30_000);
    expect(s.isTimedOut()).toBe(false);
    expect(s.questionRemainMs()).toBe(Number.POSITIVE_INFINITY);
  });

  it("90 秒后自动解锁,换新题重新计时,还能继续通过", () => {
    const clock = fakeClock();
    const s = createAuthSession("high", { now: clock.now, rand: prng(9) });
    s.submit("1");
    s.submit("1");
    clock.advance(LOCK_MS);
    expect(s.isLocked()).toBe(false);
    expect(s.resumeAfterUnlock()).toBe(true);
    expect(s.resumeAfterUnlock()).toBe(false);
    expect(s.questionRemainMs()).toBe(QUESTION_TIME_MS);
    expect(s.submit(answerOf(s.question()))).toBe("correct");
    expect(s.submit(answerOf(s.question()))).toBe("passed");
  });

  it("超时同样计入答错次数,两次超时也会锁", () => {
    const clock = fakeClock();
    const s = createAuthSession("high", { now: clock.now, rand: prng(4) });
    clock.advance(QUESTION_TIME_MS);
    expect(s.expireIfTimedOut()).toBe(true);
    clock.advance(QUESTION_TIME_MS);
    expect(s.expireIfTimedOut()).toBe(true);
    expect(s.isLocked()).toBe(true);
    expect(s.lockRemainMs()).toBe(LOCK_MS);
  });

  it("锁定不是永久的:解锁后答错计数从零开始", () => {
    const clock = fakeClock();
    const s = createAuthSession("high", { now: clock.now, rand: prng(9) });
    s.submit("1");
    s.submit("1");
    expect(s.wrongCount()).toBe(0);
    clock.advance(LOCK_MS + 1);
    s.resumeAfterUnlock();
    expect(s.submit("1")).toBe("wrong");
    expect(s.isLocked()).toBe(false);
    expect(s.wrongCount()).toBe(1);
  });
});

describe("授权有效期 5 分钟", () => {
  it("刚通过时有效,5 分钟内一直有效", () => {
    const t0 = 1_000_000;
    grantAuth("high", t0);
    expect(isAuthorized("high", t0)).toBe(true);
    expect(isAuthorized("high", t0 + AUTH_TTL_MS - 1)).toBe(true);
  });

  it("满 5 分钟就过期", () => {
    const t0 = 1_000_000;
    grantAuth("high", t0);
    expect(isAuthorized("high", t0 + AUTH_TTL_MS)).toBe(false);
    expect(isAuthorized("high", t0 + AUTH_TTL_MS + 1)).toBe(false);
  });

  it("high 授权同时满足 basic,反过来不行", () => {
    const t0 = 1_000_000;
    grantAuth("high", t0);
    expect(isAuthorized("basic", t0 + 1000)).toBe(true);
    resetParentAuth();
    grantAuth("basic", t0);
    expect(isAuthorized("basic", t0 + 1000)).toBe(true);
    expect(isAuthorized("high", t0 + 1000)).toBe(false);
  });

  it("authRemainMs 报剩余时间,过期后是 0", () => {
    const t0 = 1_000_000;
    grantAuth("basic", t0);
    expect(authRemainMs("basic", t0 + 60_000)).toBe(AUTH_TTL_MS - 60_000);
    expect(authRemainMs("basic", t0 + AUTH_TTL_MS)).toBe(0);
    expect(authRemainMs("high", t0)).toBe(0);
  });

  it("resetParentAuth 立刻清空两档授权", () => {
    const t0 = 1_000_000;
    grantAuth("high", t0);
    grantAuth("basic", t0);
    resetParentAuth();
    expect(isAuthorized("high", t0)).toBe(false);
    expect(isAuthorized("basic", t0)).toBe(false);
  });

  it("默认用系统时钟:假时钟推过 5 分钟后失效", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T09:00:00Z"));
    grantAuth("high");
    expect(isAuthorized("high")).toBe(true);
    vi.advanceTimersByTime(AUTH_TTL_MS - 1000);
    expect(isAuthorized("high")).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(isAuthorized("high")).toBe(false);
  });
});

describe("授权只存内存,绝不落盘", () => {
  it("整个答题到通过的过程一次都没写存储", () => {
    const store = spyStorage();
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });
    try {
      const clock = fakeClock();
      const s = createAuthSession("high", { now: clock.now, rand: prng(11) });
      s.submit("1");
      s.submit(answerOf(s.question()));
      s.submit(answerOf(s.question()));
      expect(s.passed()).toBe(true);
      expect(isAuthorized("high", clock.now())).toBe(true);
      expect(store.setItem).not.toHaveBeenCalled();
      expect(store.removeItem).not.toHaveBeenCalled();
      expect(store.map.size).toBe(0);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else Reflect.deleteProperty(globalThis as Record<string, unknown>, "localStorage");
    }
  });

  it("重新载入模块状态即清零(用 resetParentAuth 模拟刷新)", () => {
    grantAuth("high", 1000);
    resetParentAuth();
    expect(isAuthorized("high", 1000)).toBe(false);
    expect(authRemainMs("high", 1000)).toBe(0);
  });
});

describe("requestParentAuth", () => {
  it("没有 DOM 时默认不授权(单测 / 无头环境安全)", async () => {
    expect(typeof document).toBe("undefined");
    await expect(requestParentAuth("high", "孩子想跳过第 128 关")).resolves.toBe(false);
  });

  it("还在授权有效期内就直接放行,不再打扰家长", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T09:00:00Z"));
    grantAuth("high");
    await expect(requestParentAuth("high", "孩子想跳过第 128 关")).resolves.toBe(true);
    await expect(requestParentAuth("basic", "打开家长面板")).resolves.toBe(true);
  });
});

describe("跳关记录", () => {
  it("认 0/1 标记数组:下标就是关号", () => {
    expect(parseSkippedLevels(JSON.stringify([0, 1, 0, 1]))).toEqual([1, 3]);
    expect(parseSkippedLevels(JSON.stringify([false, true, false]))).toEqual([1]);
  });

  it("也认关号列表,并去重排序", () => {
    expect(parseSkippedLevels(JSON.stringify([128, 12, 128]))).toEqual([12, 128]);
  });

  it("坏数据一律当作没有记录,不抛异常", () => {
    expect(parseSkippedLevels(null)).toEqual([]);
    expect(parseSkippedLevels("")).toEqual([]);
    expect(parseSkippedLevels("{坏掉的")).toEqual([]);
    expect(parseSkippedLevels(JSON.stringify({ a: 1 }))).toEqual([]);
    expect(parseSkippedLevels(JSON.stringify([]))).toEqual([]);
  });

  it("只读 l99skip 前缀的 key,空记录不出现在结果里", () => {
    const store = memStorage({
      [`${SKIP_KEY_PREFIX}math-farm`]: JSON.stringify([127, 130]),
      [`${SKIP_KEY_PREFIX}clock-house`]: JSON.stringify([]),
      "yiduo-yixing.l99.math-farm": JSON.stringify([3, 3, 2]),
      "yiduo-yixing.save.v1": "{}"
    });
    expect(readSkipRecords(store)).toEqual([{ gameId: "math-farm", levels: [127, 130] }]);
  });

  it("清空跳关记录只删自己的 key,不碰关卡星级与钱包存档", () => {
    const store = memStorage({
      [`${SKIP_KEY_PREFIX}math-farm`]: JSON.stringify([127]),
      [`${SKIP_KEY_PREFIX}word-garden`]: JSON.stringify([5]),
      "yiduo-yixing.l99.math-farm": JSON.stringify([3]),
      "yiduo-yixing.save.v1": "{}"
    });
    expect(clearSkipRecords(store)).toBe(2);
    expect(readSkipRecords(store)).toEqual([]);
    expect(store.getItem("yiduo-yixing.l99.math-farm")).toBe(JSON.stringify([3]));
    expect(store.getItem("yiduo-yixing.save.v1")).toBe("{}");
  });

  it("没有存储时读写都安全", () => {
    expect(readSkipRecords(null)).toEqual([]);
    expect(clearSkipRecords(null)).toBe(0);
  });

  it("跳关记录写成人话,关号是 1 基", () => {
    expect(formatSkipSummary([])).toBe("暂无");
    expect(formatSkipSummary([11, 127])).toBe("2 关(第 12、128 关)");
    expect(formatSkipSummary([0, 1, 2], 2)).toBe("3 关(第 1、2 关 等)");
  });
});

/** 把一道题的标准答案写成家长会输入的字符串 */
function answerOf(q: AuthQuestion): string {
  return q.kind === "divmod" ? `${q.answer}...${q.remainder}` : String(q.answer);
}
