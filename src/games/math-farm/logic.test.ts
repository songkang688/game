import { test } from "vitest";
import assert from "node:assert/strict";
import {
  compareFractions,
  divideWithRemainder,
  formatFraction,
  formatTenths,
  gcd,
  makeCarryQuestion,
  makeMathQuestion,
  makeNoCarryQuestion,
  makeQuestionForLevel,
  parseTenths,
  randInt,
  shuffle,
  simplifyFraction,
} from "./logic";

// 简单可复现的伪随机数（LCG）
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("makeMathQuestion: 500 道题都符合一年级规则", () => {
  const rand = seeded(42);
  for (let i = 0; i < 500; i++) {
    const q = makeMathQuestion(rand);
    assert.ok(q.a >= 0 && q.a <= 10, `a 超范围: ${q.a}`);
    assert.ok(q.b >= 0 && q.b <= 10, `b 超范围: ${q.b}`);
    assert.ok(!(q.a === 0 && q.b === 0), "不应出现 0 和 0");
    if (q.op === "+") {
      assert.equal(q.answer, q.a + q.b);
      assert.ok(q.answer <= 10, `加法结果超过 10: ${q.a}+${q.b}`);
    } else {
      assert.equal(q.answer, q.a - q.b);
      assert.ok(q.answer >= 0, `减法结果为负: ${q.a}-${q.b}`);
    }
    assert.equal(q.choices.length, 3);
    assert.ok(q.choices.includes(q.answer), "候选里必须有正确答案");
    assert.equal(new Set(q.choices).size, 3, "候选答案必须互不相同");
    for (const c of q.choices) {
      assert.ok(c >= 0 && c <= 10, `候选超范围: ${c}`);
    }
  }
});

test("makeNoCarryQuestion: 500 道题 20 以内且不进位不退位", () => {
  const rand = seeded(7);
  for (let i = 0; i < 500; i++) {
    const q = makeNoCarryQuestion(rand);
    if (q.op === "+") {
      assert.equal(q.answer, q.a + q.b);
      assert.ok(q.answer <= 20, `和超过 20: ${q.a}+${q.b}`);
      assert.ok((q.a % 10) + (q.b % 10) < 10, `不应进位: ${q.a}+${q.b}`);
    } else {
      assert.equal(q.answer, q.a - q.b);
      assert.ok(q.a <= 20 && q.answer >= 0);
      assert.ok(q.a % 10 >= q.b % 10, `不应退位: ${q.a}-${q.b}`);
    }
    assert.equal(new Set(q.choices).size, 3);
    assert.ok(q.choices.includes(q.answer));
    for (const c of q.choices) assert.ok(c >= 0 && c <= 20);
  }
});

test("makeCarryQuestion: 500 道题必须真正进位/退位", () => {
  const rand = seeded(99);
  for (let i = 0; i < 500; i++) {
    const q = makeCarryQuestion(rand);
    if (q.op === "+") {
      assert.equal(q.answer, q.a + q.b);
      assert.ok(q.answer >= 11 && q.answer <= 20, `进位和应在 11..20: ${q.a}+${q.b}`);
      assert.ok((q.a % 10) + (q.b % 10) >= 10, `必须进位: ${q.a}+${q.b}`);
    } else {
      assert.equal(q.answer, q.a - q.b);
      assert.ok(q.a >= 11 && q.a <= 18);
      assert.ok(q.a % 10 < q.b, `必须退位: ${q.a}-${q.b}`);
      assert.ok(q.answer >= 1);
    }
    assert.equal(new Set(q.choices).size, 3);
    assert.ok(q.choices.includes(q.answer));
  }
});

test("makeQuestionForLevel: 开关关闭时第 3 关退回不进退位", () => {
  const rand = seeded(5);
  for (let i = 0; i < 200; i++) {
    const q = makeQuestionForLevel(3, false, rand);
    if (q.op === "+") assert.ok((q.a % 10) + (q.b % 10) < 10);
    else assert.ok(q.a % 10 >= q.b % 10);
  }
});

test("randInt 覆盖闭区间两端", () => {
  const rand = seeded(7);
  const seen = new Set<number>();
  for (let i = 0; i < 1000; i++) seen.add(randInt(rand, 2, 5));
  assert.deepEqual([...seen].sort(), [2, 3, 4, 5]);
});

test("shuffle 不改变元素集合、不改动原数组", () => {
  const rand = seeded(9);
  const src = [1, 2, 3, 4, 5];
  const out = shuffle(src, rand);
  assert.deepEqual(src, [1, 2, 3, 4, 5]);
  assert.deepEqual(out.slice().sort(), [1, 2, 3, 4, 5]);
});

// --- 1.1 新增：第 100–188 关用到的纯逻辑 ---

test("gcd：最大公约数", () => {
  assert.equal(gcd(12, 18), 6);
  assert.equal(gcd(7, 13), 1);
  assert.equal(gcd(0, 5), 5);
  assert.equal(gcd(0, 0), 1);
  assert.equal(gcd(-12, 18), 6);
});

test("simplifyFraction：约分到最简且分母为正", () => {
  assert.deepEqual(simplifyFraction(6, 8), { n: 3, d: 4 });
  assert.deepEqual(simplifyFraction(10, 5), { n: 2, d: 1 });
  assert.deepEqual(simplifyFraction(3, 7), { n: 3, d: 7 });
  assert.deepEqual(simplifyFraction(4, 0), { n: 0, d: 1 });
  for (let n = 1; n <= 20; n++) {
    for (let d = 1; d <= 20; d++) {
      const s = simplifyFraction(n, d);
      assert.equal(gcd(s.n, s.d), 1, `${n}/${d} 应该约到最简`);
      assert.equal(s.n * d, n * s.d, `${n}/${d} 约分后大小要不变`);
    }
  }
});

test("formatFraction / compareFractions：分数写法与比大小", () => {
  assert.equal(formatFraction(3, 4), "3/4");
  assert.equal(compareFractions(3, 4, 2, 3), 1);
  assert.equal(compareFractions(2, 3, 3, 4), -1);
  assert.equal(compareFractions(1, 2, 2, 4), 0);
  assert.equal(compareFractions(1, 8, 1, 3), -1);
});

test("divideWithRemainder：带余除法的商与余数", () => {
  assert.deepEqual(divideWithRemainder(17, 5), { quotient: 3, remainder: 2 });
  assert.deepEqual(divideWithRemainder(20, 5), { quotient: 4, remainder: 0 });
  for (let a = 0; a < 200; a++) {
    for (const b of [2, 3, 7, 9]) {
      const { quotient, remainder } = divideWithRemainder(a, b);
      assert.equal(quotient * b + remainder, a);
      assert.ok(remainder >= 0 && remainder < b, `${a}÷${b} 余数越界`);
    }
  }
});

test("formatTenths / parseTenths：一位小数不会有浮点毛刺", () => {
  assert.equal(formatTenths(35), "3.5");
  assert.equal(formatTenths(30), "3");
  assert.equal(formatTenths(5), "0.5");
  assert.equal(formatTenths(-25), "-2.5");
  assert.equal(parseTenths("3.5"), 35);
  assert.equal(parseTenths("3"), 30);
  assert.equal(parseTenths("-2.5"), -25);
  for (let v = 0; v <= 500; v++) {
    assert.equal(parseTenths(formatTenths(v)), v, `${v} 来回转换要一致`);
  }
  // 经典浮点陷阱：0.1 + 0.2 走整数通道恰好是 0.3
  assert.equal(formatTenths(parseTenths("0.1") + parseTenths("0.2")), "0.3");
});
