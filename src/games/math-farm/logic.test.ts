import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMathQuestion, randInt, shuffle } from "./logic";

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
