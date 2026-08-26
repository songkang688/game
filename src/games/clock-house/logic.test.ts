import { test } from "vitest";
import assert from "node:assert/strict";
import {
  DAY_MINUTES,
  MONTH_DAYS,
  WEEKDAYS,
  daysInMonth,
  elapsedMinutes,
  formatClock,
  formatDuration,
  formatHM,
  formatHM24,
  hmToMinutes,
  hourHandAngle,
  makeClockQuestion,
  minuteHandAngle,
  nthWeekdayDate,
  shiftHours,
  to12Hour,
  to24Hour,
  weekdayAfter,
  type Quarter,
} from "./logic";

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

// --- 1.1 新增：第 100–188 关用到的纯逻辑 ---

test("hmToMinutes / formatHM / formatHM24：分钟级时刻互转与回绕", () => {
  assert.equal(hmToMinutes(7, 5), 425);
  assert.equal(hmToMinutes(0, 0), 0);
  assert.equal(hmToMinutes(24, 0), 0);
  assert.equal(hmToMinutes(25, 30), 90);
  assert.equal(hmToMinutes(-1, 0), 23 * 60);
  assert.equal(formatHM(425), "7:05");
  assert.equal(formatHM(0), "0:00");
  assert.equal(formatHM(23 * 60 + 59), "23:59");
  assert.equal(formatHM24(425), "07:05");
  assert.equal(formatHM24(DAY_MINUTES), "00:00");
  for (let m = 0; m < DAY_MINUTES; m += 7) {
    assert.equal(hmToMinutes(Math.floor(m / 60), m % 60), m);
  }
});

test("elapsedMinutes：跨午夜也算得出正确时长", () => {
  assert.equal(elapsedMinutes(hmToMinutes(7, 20), hmToMinutes(9, 5)), 105);
  assert.equal(elapsedMinutes(hmToMinutes(9, 5), hmToMinutes(9, 5)), 0);
  assert.equal(elapsedMinutes(hmToMinutes(23, 40), hmToMinutes(0, 20)), 40);
  for (let a = 0; a < DAY_MINUTES; a += 53) {
    for (const d of [5, 65, 200, 719]) {
      assert.equal(elapsedMinutes(a, hmToMinutes(0, a + d)), d);
    }
  }
});

test("formatDuration：小时 / 分钟的说法都自然", () => {
  assert.equal(formatDuration(105), "1 小时 45 分");
  assert.equal(formatDuration(45), "45 分");
  assert.equal(formatDuration(120), "2 小时");
  assert.equal(formatDuration(0), "0 分");
  assert.equal(formatDuration(-10), "0 分");
});

test("to24Hour / to12Hour：12 与 24 小时制来回都不丢", () => {
  assert.equal(to24Hour(12, "上午"), 0);
  assert.equal(to24Hour(12, "下午"), 12);
  assert.equal(to24Hour(3, "下午"), 15);
  assert.equal(to24Hour(3, "上午"), 3);
  assert.deepEqual(to12Hour(0), { hour: 12, period: "上午" });
  assert.deepEqual(to12Hour(12), { hour: 12, period: "下午" });
  assert.deepEqual(to12Hour(15), { hour: 3, period: "下午" });
  for (let h = 0; h < 24; h++) {
    const { hour, period } = to12Hour(h);
    assert.equal(to24Hour(hour, period), h, `${h} 点来回转换应该回到原值`);
  }
});

test("shiftHours：跨城对表加减小时会回绕到同一天内", () => {
  assert.equal(shiftHours(hmToMinutes(14, 30), 3), hmToMinutes(17, 30));
  assert.equal(shiftHours(hmToMinutes(1, 30), -3), hmToMinutes(22, 30));
  assert.equal(shiftHours(hmToMinutes(22, 0), 5), hmToMinutes(3, 0));
  for (let h = 0; h < 24; h++) {
    for (const d of [-9, -2, 2, 9]) {
      const v = shiftHours(hmToMinutes(h, 15), d);
      assert.ok(v >= 0 && v < DAY_MINUTES);
      assert.equal(shiftHours(v, -d), hmToMinutes(h, 15));
    }
  }
});

test("weekdayAfter：往后数几天是星期几", () => {
  assert.equal(WEEKDAYS.length, 7);
  assert.equal(WEEKDAYS[0], "星期一");
  assert.equal(weekdayAfter(2, 7), 2);
  assert.equal(weekdayAfter(2, 10), 5);
  assert.equal(weekdayAfter(6, 1), 0);
  assert.equal(weekdayAfter(0, -1), 6);
  for (let i = 0; i < 7; i++) {
    for (let d = 0; d < 120; d++) {
      const v = weekdayAfter(i, d);
      assert.ok(v >= 0 && v < 7);
      assert.equal(v, (i + d) % 7);
    }
  }
});

test("daysInMonth：平年 12 个月的天数", () => {
  assert.equal(MONTH_DAYS.reduce((a, b) => a + b, 0), 365);
  assert.equal(daysInMonth(1), 31);
  assert.equal(daysInMonth(2), 28);
  assert.equal(daysInMonth(4), 30);
  assert.equal(daysInMonth(12), 31);
});

test("nthWeekdayDate：这个月第 n 个星期几是几号", () => {
  // 5 月 1 号是星期四(下标 3)，第 1 个星期六(下标 5)就是 3 号
  assert.equal(nthWeekdayDate(3, 5, 1, 5), 3);
  assert.equal(nthWeekdayDate(3, 5, 2, 5), 10);
  assert.equal(nthWeekdayDate(3, 3, 1, 5), 1);
  // 排不下就返回 0
  assert.equal(nthWeekdayDate(0, 6, 5, 2), 0);
  for (let first = 0; first < 7; first++) {
    for (let w = 0; w < 7; w++) {
      for (let nth = 1; nth <= 4; nth++) {
        const d = nthWeekdayDate(first, w, nth, 3);
        assert.ok(d >= 1 && d <= 31, `3 月第 ${nth} 个${WEEKDAYS[w]}应该排得下`);
        assert.equal(weekdayAfter(first, d - 1), w);
      }
    }
  }
});
