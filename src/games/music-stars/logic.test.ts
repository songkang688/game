import { test } from "vitest";
import assert from "node:assert/strict";
import { makeSequence, TWINKLE_FINALE } from "./logic";

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

test("makeSequence: maxJump 限制相邻音跨度", () => {
  const rand = seeded(7);
  for (let i = 0; i < 300; i++) {
    const seq = makeSequence(7, 5, rand, 2);
    assert.equal(seq.length, 7);
    for (let k = 1; k < seq.length; k++) {
      assert.ok(Math.abs(seq[k] - seq[k - 1]) <= 2, `跨度超过 2: ${seq[k - 1]} -> ${seq[k]}`);
      assert.notEqual(seq[k], seq[k - 1]);
    }
  }
});

test("终曲《小星星》：哆哆索索拉拉索", () => {
  assert.deepEqual(TWINKLE_FINALE, [0, 0, 3, 3, 4, 4, 3]);
  for (const n of TWINKLE_FINALE) assert.ok(n >= 0 && n < 5);
});
