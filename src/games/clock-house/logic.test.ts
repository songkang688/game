import { test } from "node:test";
import assert from "node:assert/strict";
import { formatClock, hourHandAngle, makeClockQuestion, minuteHandAngle, type Quarter } from "./logic";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("formatClock: 整点/1 刻/半点/3 刻", () => {
  assert.equal(formatClock(3, 0), "3 点");
  assert.equal(formatClock(3, 1), "3 点 1 刻");
  assert.equal(formatClock(3, 2), "3 点半");
  assert.equal(formatClock(3, 3), "3 点 3 刻");
  assert.equal(formatClock(12, 0), "12 点");
});

test("指针角度", () => {
  assert.equal(hourHandAngle(12, 0), 0);
  assert.equal(hourHandAngle(3, 0), 90);
  assert.equal(hourHandAngle(6, 0), 180);
  assert.equal(hourHandAngle(3, 2), 105);
  // 1 刻时时针走过 1/4 格
  assert.equal(hourHandAngle(3, 1), 97.5);
  assert.equal(hourHandAngle(3, 3), 112.5);
  assert.equal(minuteHandAngle(0), 0);
  assert.equal(minuteHandAngle(1), 90);
  assert.equal(minuteHandAngle(2), 180);
  assert.equal(minuteHandAngle(3), 270);
});

test("makeClockQuestion: 默认只出整点半点（第 1 关）", () => {
  const rand = seeded(2024);
  let sawHalf = false;
  let sawFull = false;
  for (let i = 0; i < 400; i++) {
    const q = makeClockQuestion(rand);
    assert.ok(q.hour >= 1 && q.hour <= 12);
    assert.ok(q.quarter === 0 || q.quarter === 2, `第 1 关不应出现刻: ${q.quarter}`);
    if (q.quarter === 2) sawHalf = true;
    else sawFull = true;
    assert.equal(q.label, formatClock(q.hour, q.quarter));
    assert.equal(q.choices.length, 3);
    assert.equal(new Set(q.choices).size, 3, "选项必须互不相同");
    assert.equal(q.choices[q.answerIndex], q.label);
    for (const c of q.choices) {
      assert.match(c, /^([1-9]|1[0-2]) 点(半)?$/, `选项格式不对: ${c}`);
    }
  }
  assert.ok(sawHalf && sawFull, "整点和半点都应出现");
});

test("makeClockQuestion: 全部刻度时四种时间都会出现", () => {
  const rand = seeded(7);
  const all: Quarter[] = [0, 1, 2, 3];
  const seen = new Set<Quarter>();
  for (let i = 0; i < 400; i++) {
    const q = makeClockQuestion(rand, all);
    seen.add(q.quarter);
    assert.equal(q.label, formatClock(q.hour, q.quarter));
    assert.equal(new Set(q.choices).size, 3);
    assert.equal(q.choices[q.answerIndex], q.label);
    for (const c of q.choices) {
      assert.match(c, /^([1-9]|1[0-2]) 点( 1 刻| 3 刻|半)?$/, `选项格式不对: ${c}`);
    }
  }
  assert.equal(seen.size, 4, "整点/1 刻/半点/3 刻都应出现过");
});

test("makeClockQuestion: 干扰项只用本关学过的说法", () => {
  const rand = seeded(31);
  for (let i = 0; i < 300; i++) {
    const q = makeClockQuestion(rand, [0, 1, 2]);
    for (const c of q.choices) {
      assert.doesNotMatch(c, / 3 刻$/, `第 2 关不应出现 3 刻: ${c}`);
    }
  }
});
