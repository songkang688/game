import { test } from "vitest";
import assert from "node:assert/strict";
import {
  CLOCK_MINUTES,
  DAY_MINUTES,
  MONTH_DAYS,
  NOON_MINUTES,
  WEEKDAYS,
  angleToMinute,
  clockHour,
  clockMinute,
  clockMinutes,
  crossesNoon,
  daysInMonth,
  dragHourTo,
  dragMinuteTo,
  elapsedMinutes,
  formatClock,
  formatClockMinute,
  formatDuration,
  formatHM,
  formatHM24,
  formatMinSec,
  formatPeriodHM,
  hmToMinutes,
  hmToTotalMinutes,
  hourHandAngle,
  hourHandAngleAt,
  hourHandDriftDegrees,
  makeClockQuestion,
  minuteHandAngle,
  minuteHandAngleAt,
  msToTotalSeconds,
  normClockMinutes,
  nthWeekdayDate,
  secondHandAngleAt,
  shiftHours,
  snapMinute,
  to12Hour,
  to24Hour,
  weekdayAfter,
  wrapClockMinutes,
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
  assert.equal(to24Hour(12, "夜里"), 0);
  assert.equal(to24Hour(12, "中午"), 12);
  assert.equal(to24Hour(3, "下午"), 15);
  assert.equal(to24Hour(3, "上午"), 3);
  assert.equal(to24Hour(8, "晚上"), 20);
  assert.equal(to24Hour(4, "凌晨"), 4);
  assert.deepEqual(to12Hour(0), { hour: 12, period: "夜里" });
  assert.deepEqual(to12Hour(12), { hour: 12, period: "中午" });
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

// --- 1.2 新增：分钟级钟面、时针联动、拨针吸附、时分秒换算 ---

test("钟面分钟数模型：几点几分与 0..719 互转，越界自动回绕", () => {
  assert.equal(CLOCK_MINUTES, 720);
  assert.equal(clockMinutes(3, 25), 205);
  assert.equal(clockMinutes(12, 0), 0);
  assert.equal(clockMinutes(12, 30), 30);
  assert.equal(clockMinutes(13, 5), 65, "13 点在钟面上就是 1 点");
  assert.equal(normClockMinutes(-1), 719);
  assert.equal(normClockMinutes(720), 0);
  assert.equal(wrapClockMinutes(-0.5), 719.5, "精确模式下小数不许被抹掉");
  // 全部 720 个位置都能原样反解回去
  for (let t = 0; t < CLOCK_MINUTES; t++) {
    assert.equal(clockMinutes(clockHour(t), clockMinute(t)), t);
  }
});

test("formatClockMinute：整点说「几点」，其余说「几点几分」", () => {
  assert.equal(formatClockMinute(clockMinutes(3, 0)), "3 点");
  assert.equal(formatClockMinute(clockMinutes(3, 5)), "3 点 5 分");
  assert.equal(formatClockMinute(clockMinutes(12, 45)), "12 点 45 分");
  assert.equal(formatClockMinute(clockMinutes(12, 0)), "12 点");
});

test("时针联动：分针走一分钟，时针跟着走半度（教学正确性红线）", () => {
  assert.equal(hourHandAngleAt(clockMinutes(12, 0)), 0);
  assert.equal(hourHandAngleAt(clockMinutes(3, 0)), 90);
  assert.equal(hourHandAngleAt(clockMinutes(3, 30)), 105, "半点时针必须走到两数正中间");
  assert.equal(hourHandAngleAt(clockMinutes(3, 15)), 97.5);
  assert.equal(hourHandAngleAt(clockMinutes(6, 0)), 180);
  assert.equal(hourHandAngleAt(clockMinutes(11, 59)), 359.5, "差一分到整点时针几乎贴着 12");
  assert.equal(minuteHandAngleAt(clockMinutes(3, 0)), 0);
  assert.equal(minuteHandAngleAt(clockMinutes(3, 15)), 90);
  assert.equal(minuteHandAngleAt(clockMinutes(3, 45)), 270);
  assert.equal(secondHandAngleAt(0), 0);
  assert.equal(secondHandAngleAt(15), 90);
  // 比例恒定：不管从哪儿开始，分针转多少，时针就转它的十二分之一
  assert.equal(hourHandDriftDegrees(60), 30);
  assert.equal(hourHandDriftDegrees(5), 2.5);
  for (let t = 0; t < CLOCK_MINUTES; t++) {
    const drift = hourHandAngleAt(t) - (Math.floor(t / 60) % 12) * 30;
    assert.ok(Math.abs(drift - hourHandDriftDegrees(t % 60)) < 1e-9, `第 ${t} 分的时针偏移不对`);
  }
});

test("时针角度在一圈里严格单调递增，任何时刻两针都自洽", () => {
  let prev = -1;
  for (let t = 0; t < CLOCK_MINUTES; t++) {
    const a = hourHandAngleAt(t);
    assert.ok(a > prev, `第 ${t} 分时针角度没有前进`);
    prev = a;
    assert.ok(a >= 0 && a < 360);
    assert.equal(minuteHandAngleAt(t), (t % 60) * 6);
  }
});

test("angleToMinute / snapMinute：默认磁性吸附到最近整分，精确模式保留小数", () => {
  assert.equal(angleToMinute(0), 0);
  assert.equal(angleToMinute(90), 15);
  assert.equal(angleToMinute(180), 30);
  assert.equal(angleToMinute(-90), 45, "角度为负也要回绕");
  assert.equal(snapMinute(angleToMinute(92)), 15, "偏一点点要吸回最近的整分");
  assert.equal(snapMinute(angleToMinute(86)), 14);
  assert.ok(Math.abs(snapMinute(angleToMinute(92), true) - 15.3333) < 0.001, "精确模式不吸附");
  assert.equal(snapMinute(59.7), 0, "吸到 60 分要回绕成 0 分");
  assert.equal(snapMinute(-1), 59);
});

test("dragMinuteTo：拨分针走最短路径，跨 12 自动进位/退位，时针跟着走", () => {
  const three = clockMinutes(3, 0);
  assert.equal(dragMinuteTo(three, 30), clockMinutes(3, 30));
  assert.equal(hourHandAngleAt(dragMinuteTo(three, 30)), 105);
  // 3:55 把分针拨到 5 分 → 4:05（不是倒退回 3:05）
  assert.equal(dragMinuteTo(clockMinutes(3, 55), 5), clockMinutes(4, 5));
  // 4:05 把分针拨回 55 分 → 3:55（不是前进到 4:55）
  assert.equal(dragMinuteTo(clockMinutes(4, 5), 55), clockMinutes(3, 55));
  // 12 点前后的回绕
  assert.equal(dragMinuteTo(clockMinutes(11, 58), 2), clockMinutes(12, 2));
  assert.equal(dragMinuteTo(clockMinutes(12, 2), 58), clockMinutes(11, 58));
  // 每一步都不会跳超过半圈
  for (let t = 0; t < CLOCK_MINUTES; t += 7) {
    for (let m = 0; m < 60; m += 3) {
      const next = dragMinuteTo(t, m);
      const step = Math.abs(((next - t + CLOCK_MINUTES + 360) % CLOCK_MINUTES) - 360);
      assert.equal(next % 60, m, `从 ${t} 拨到 ${m} 分没落准`);
      assert.ok(step <= 30, `从 ${t} 拨到 ${m} 分跳得太远`);
    }
  }
});

test("dragHourTo：直接拨时针，分针落到对应的分钟上", () => {
  assert.equal(dragHourTo(0, 90), clockMinutes(3, 0));
  assert.equal(dragHourTo(0, 105), clockMinutes(3, 30));
  assert.equal(dragHourTo(0, 0), 0);
  for (let t = 0; t < CLOCK_MINUTES; t += 11) {
    assert.equal(dragHourTo(0, hourHandAngleAt(t)), t, `${t} 分的时针角度反解不回来`);
  }
});

test("时分秒换算：进率一处都不能错", () => {
  assert.equal(hmToTotalMinutes(2, 15), 135);
  assert.equal(hmToTotalMinutes(0, 45), 45);
  assert.equal(formatDuration(135), "2 小时 15 分");
  assert.equal(msToTotalSeconds(3, 20), 200);
  assert.equal(formatMinSec(200), "3 分 20 秒");
  assert.equal(formatMinSec(45), "45 秒");
  assert.equal(formatMinSec(120), "2 分");
  assert.equal(formatMinSec(0), "0 秒");
  assert.equal(formatMinSec(-5), "0 秒");
  // 1 小时 = 3600 秒、1 天 = 24 小时这两条常识用换算链验一遍
  assert.equal(msToTotalSeconds(hmToTotalMinutes(1, 0), 0), 3600);
  assert.equal(hmToTotalMinutes(24, 0), DAY_MINUTES);
  for (let s = 0; s < 4000; s += 37) {
    assert.equal(msToTotalSeconds(Math.floor(s / 60), s % 60), s);
  }
});

test("crossesNoon / formatPeriodHM：跨中午那一段要认得出来、说得清楚", () => {
  assert.equal(NOON_MINUTES, 720);
  assert.equal(crossesNoon(hmToMinutes(10, 40), 160), true);
  assert.equal(crossesNoon(hmToMinutes(10, 40), 60), false, "没到 12 点就不算跨中午");
  assert.equal(crossesNoon(hmToMinutes(13, 0), 60), false, "本来就在下午也不算");
  assert.equal(crossesNoon(hmToMinutes(11, 0), 60), false, "正好停在 12 点整不算跨过去");
  assert.equal(formatPeriodHM(hmToMinutes(10, 40)), "上午 10:40");
  assert.equal(formatPeriodHM(hmToMinutes(13, 20)), "下午 1:20");
  // 12 点是「中午」不是「下午 12 点」、0 点是「夜里」不是「上午 12 点」（W5R2-A-03）
  assert.equal(formatPeriodHM(hmToMinutes(12, 0)), "中午 12:00");
  assert.equal(formatPeriodHM(hmToMinutes(0, 5)), "夜里 12:05");
  // 跨中午的经过时间就是普通减法，中午那道坎不许多算也不许少算
  assert.equal(elapsedMinutes(hmToMinutes(10, 40), hmToMinutes(13, 20)), 160);
});
