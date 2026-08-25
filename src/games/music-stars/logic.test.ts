import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSequence } from "./logic";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("makeSequence: 长度正确、下标在范围内、相邻不重复", () => {
  const rand = seeded(99);
  for (let i = 0; i < 300; i++) {
    const len = 1 + (i % 6);
    const stars = 2 + (i % 4);
    const seq = makeSequence(len, stars, rand);
    assert.equal(seq.length, len);
    for (let k = 0; k < seq.length; k++) {
      assert.ok(seq[k] >= 0 && seq[k] < stars, `下标超范围: ${seq[k]}`);
      if (k > 0) assert.notEqual(seq[k], seq[k - 1], "相邻两个音不应重复");
    }
  }
});

test("makeSequence: 边界情况", () => {
  const rand = seeded(1);
  assert.deepEqual(makeSequence(0, 5, rand), []);
  assert.deepEqual(makeSequence(3, 0, rand), []);
  // 只有一颗星时允许重复（否则无法生成）
  assert.deepEqual(makeSequence(3, 1, rand), [0, 0, 0]);
});
