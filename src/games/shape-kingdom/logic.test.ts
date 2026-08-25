import { test } from "vitest";
import assert from "node:assert/strict";
import {
  makeRoundForLevel,
  makeShapeRound,
  makeSidesRound,
  makeSizeRound,
  SHAPE_COLORS,
  SHAPE_KINDS,
  SHAPE_SIDES,
  SIDED_SHAPES,
} from "./logic";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("题库扩容：形状 8 种、颜色 6 种", () => {
  assert.equal(SHAPE_KINDS.length, 8);
  assert.equal(SHAPE_COLORS.length, 6);
  assert.equal(new Set(SHAPE_KINDS).size, 8);
  assert.equal(new Set(SHAPE_COLORS).size, 6);
});

test("makeShapeRound: 400 轮门与答案一致", () => {
  const rand = seeded(42);
  for (let i = 0; i < 400; i++) {
    const r = makeShapeRound(rand);
    assert.equal(r.bins.length, 3);
    assert.equal(new Set(r.bins).size, 3, "三扇门必须互不相同");
    const answer = r.bins[r.answerIndex];
    if (r.mode === "shape") {
      assert.equal(answer, r.shape);
      for (const b of r.bins) assert.ok((SHAPE_KINDS as string[]).includes(b));
    } else {
      assert.equal(answer, r.color);
      for (const b of r.bins) assert.ok((SHAPE_COLORS as string[]).includes(b));
    }
  }
});

test("makeSizeRound: 300 轮目标正确", () => {
  const rand = seeded(7);
  for (let i = 0; i < 300; i++) {
    const r = makeSizeRound(rand);
    assert.equal(r.mode, "size");
    const sizes = r.bins.map(Number);
    assert.equal(new Set(sizes).size, 3);
    const answer = sizes[r.answerIndex];
    if (r.goal === "big") assert.equal(answer, Math.max(...sizes));
    else assert.equal(answer, Math.min(...sizes));
  }
});

test("makeSidesRound: 300 轮边数正确", () => {
  const rand = seeded(99);
  for (let i = 0; i < 300; i++) {
    const r = makeSidesRound(rand);
    assert.equal(r.mode, "sides");
    assert.ok(SIDED_SHAPES.includes(r.shape), `数边题形状: ${r.shape}`);
    const answer = Number(r.bins[r.answerIndex]);
    assert.equal(answer, SHAPE_SIDES[r.shape]);
    assert.equal(new Set(r.bins).size, 3);
  }
});

test("makeRoundForLevel: 各关题型符合设计", () => {
  const rand = seeded(5);
  for (let i = 0; i < 200; i++) {
    assert.equal(makeRoundForLevel(1, rand).mode, "shape");
    assert.equal(makeRoundForLevel(2, rand).mode, "color");
    assert.equal(makeRoundForLevel(3, rand).mode, "size");
    assert.equal(makeRoundForLevel(4, rand).mode, "sides");
    const mix = makeRoundForLevel(5, rand);
    assert.ok(["shape", "color", "size", "sides"].includes(mix.mode));
  }
});
