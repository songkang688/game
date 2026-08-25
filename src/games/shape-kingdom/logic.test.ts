import { test } from "node:test";
import assert from "node:assert/strict";
import { makeShapeRound, SHAPE_COLORS, SHAPE_KINDS } from "./logic";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("makeShapeRound: 400 轮都合法", () => {
  const rand = seeded(66);
  const modes = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const r = makeShapeRound(rand);
    modes.add(r.mode);
    assert.ok(SHAPE_KINDS.includes(r.shape));
    assert.ok(SHAPE_COLORS.includes(r.color));
    assert.equal(r.bins.length, 3);
    assert.equal(new Set(r.bins).size, 3, "三扇门必须互不相同");
    if (r.mode === "shape") {
      assert.deepEqual(r.bins.slice().sort(), SHAPE_KINDS.slice().sort());
      assert.equal(r.bins[r.answerIndex], r.shape);
    } else {
      assert.deepEqual(r.bins.slice().sort(), SHAPE_COLORS.slice().sort());
      assert.equal(r.bins[r.answerIndex], r.color);
    }
  }
  assert.deepEqual([...modes].sort(), ["color", "shape"], "两种分类模式都应出现");
});

test("makeShapeRound: 可以强制指定模式", () => {
  const rand = seeded(3);
  for (let i = 0; i < 50; i++) {
    assert.equal(makeShapeRound(rand, "shape").mode, "shape");
    assert.equal(makeShapeRound(rand, "color").mode, "color");
  }
});
