import { test } from "node:test";
import assert from "node:assert/strict";
import { formatClock, hourHandAngle, makeClockQuestion, minuteHandAngle } from "./logic";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("formatClock", () => {
  assert.equal(formatClock(3, false), "3 点");
  assert.equal(formatClock(3, true), "3 点半");
  assert.equal(formatClock(12, false), "12 点");
});

test("指针角度", () => {
  assert.equal(hourHandAngle(12, false), 0);
  assert.equal(hourHandAngle(3, false), 90);
  assert.equal(hourHandAngle(6, false), 180);
  assert.equal(hourHandAngle(3, true), 105);
  assert.equal(minuteHandAngle(false), 0);
  assert.equal(minuteHandAngle(true), 180);
});

test("makeClockQuestion: 400 道题合法", () => {
  const rand = seeded(2024);
  let sawHalf = false;
  let sawFull = false;
  for (let i = 0; i < 400; i++) {
    const q = makeClockQuestion(rand);
    assert.ok(q.hour >= 1 && q.hour <= 12);
    if (q.half) sawHalf = true;
    else sawFull = true;
    assert.equal(q.label, formatClock(q.hour, q.half));
    assert.equal(q.choices.length, 3);
    assert.equal(new Set(q.choices).size, 3, "选项必须互不相同");
    assert.equal(q.choices[q.answerIndex], q.label);
    for (const c of q.choices) {
      assert.match(c, /^([1-9]|1[0-2]) 点(半)?$/, `选项格式不对: ${c}`);
    }
  }
  assert.ok(sawHalf && sawFull, "整点和半点都应出现");
});
