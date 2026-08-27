// 时钟小屋：188 关 · 十层小屋章节题库生成（认时间 → 时长/24 小时制/日历/时刻表，确定性可测试）
//
// 1.1 起总关数 99 → 188：前 99 关（前 6 章）的章节切分、seed、生成参数逐字未动，
// 新的 4 章共 89 关只在末尾追加，面向约小学六年级，允许多步推理。
//
// 1.2 又补了三件事，**依旧一个字没动前 99 关**（`levels.test.ts` 用摘要哈希钉死）：
//  1. 题型补齐到 8 类：分钟级读钟面 / 拨指针、跨中午的经过时间、时分秒换算、作息表；
//  2. 第 100 关往后的题型由 `kinds.ts` 那张「关号 → 题型权重」表驱动，不再是 if-else 阶梯；
//  3. 错题回顾：`makeReviewQuestions` 用新种子出一批同类题，换数字不换套路。
import { TOTAL_LEVELS, mulberry32, pick, randInt, shuffled, chapterOf, indexInChapter, type Chapter } from "../level99";
import type { QuizQuestion, QuizTheme } from "../quiz99";
import { FACE_LABEL, faceSVG } from "./clockface";
import { tableKinds, type ClockKind, type ClockType, typeOfKind } from "./kinds";
import {
  DAY_MINUTES,
  NOON_MINUTES,
  WEEKDAYS,
  clockMinutes,
  daysInMonth,
  elapsedMinutes,
  formatClock,
  formatClockMinute,
  formatDuration,
  formatHM,
  formatHM24,
  formatMinSec,
  formatPeriodHM,
  hmToMinutes,
  hourHandAngle,
  minuteHandAngle,
  msToTotalSeconds,
  nthWeekdayDate,
  shiftHours,
  to12Hour,
  weekdayAfter,
  type Quarter,
} from "./logic";

export type { ClockKind, ClockType } from "./kinds";
export { typeOfKind } from "./kinds";

/** 1.0 时代的章节数：下标 < 这个数的章节一律保持原样 */
export const LEGACY_CHAPTER_COUNT = 6;

export const CHAPTERS: Chapter[] = [
  { name: "整点钟楼", emoji: "🕐", color: "#ffe8cc", desc: "分针指 12，就是整点", size: 17 },
  { name: "半点小屋", emoji: "🕜", color: "#d3f9d8", desc: "分针指 6，就是几点半", size: 17 },
  { name: "一刻花园", emoji: "🌷", color: "#ffdeeb", desc: "分针指 3，就是 1 刻", size: 17 },
  { name: "三刻广场", emoji: "⛲", color: "#d0f0fd", desc: "分针指 9，三刻登场", size: 16 },
  { name: "拨针工坊", emoji: "🔧", color: "#fff3bf", desc: "反过来：听时间找钟面", size: 16 },
  { name: "时间冒险家", emoji: "🧭", color: "#e5dbff", desc: "混合挑战 + 再过几小时", size: 16 },
  // ↓ 1.1 新增：第 100–188 关
  { name: "出发到达站", emoji: "🚉", color: "#ffe3e3", desc: "出发、到达、路上多久，还有跨过中午那一段", size: 23 },
  { name: "廿四时钟塔", emoji: "🗼", color: "#dbe4ff", desc: "两种计时法互换、时分秒换算，还要跟北京对表", size: 22 },
  { name: "星期日历屋", emoji: "📅", color: "#d8f5e3", desc: "往后数几天是星期几，再读一读一天的作息表", size: 22 },
  { name: "时刻表车站", emoji: "🚏", color: "#fff0d6", desc: "看懂班次表：谁最早到、谁最快，最后什么都考", size: 22 },
];

export const CHAPTER_THEMES: QuizTheme[] = [
  { bg: "linear-gradient(#fff4e6,#ffe8cc)", accent: "#d9480f" },
  { bg: "linear-gradient(#e3fafc,#d3f9d8)", accent: "#2b8a3e" },
  { bg: "linear-gradient(#fff0f6,#ffdeeb)", accent: "#c2255c" },
  { bg: "linear-gradient(#e7f5ff,#d0f0fd)", accent: "#1971c2" },
  { bg: "linear-gradient(#fff9db,#fff3bf)", accent: "#e8590c" },
  { bg: "linear-gradient(#f3f0ff,#e5dbff)", accent: "#6741d9" },
  { bg: "linear-gradient(#fff5f5,#ffe3e3)", accent: "#c92a2a" },
  { bg: "linear-gradient(#edf2ff,#dbe4ff)", accent: "#3b5bdb" },
  { bg: "linear-gradient(#ebfbee,#d8f5e3)", accent: "#2f9e44" },
  { bg: "linear-gradient(#fff8e1,#fff0d6)", accent: "#b8860b" },
];

/**
 * 画一个钟面 SVG（data-h / data-q 供测试与判定）。
 *
 * `label` 是读屏标签，默认那句不含时刻的 `FACE_LABEL`：钟面就是题目本身，
 * 标签写成「4 点」等于把答案摆在读屏用户面前。
 */
export function clockSVG(hour: number, quarter: Quarter, size: number, label: string = FACE_LABEL): string {
  const cx = 50, cy = 50;
  const hA = ((hourHandAngle(hour, quarter) - 90) * Math.PI) / 180;
  const mA = ((minuteHandAngle(quarter) - 90) * Math.PI) / 180;
  let ticks = "";
  for (let i = 0; i < 12; i++) {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    const nx = cx + Math.cos(a) * 36;
    const ny = cy + Math.sin(a) * 36;
    ticks += `<text x="${nx.toFixed(1)}" y="${(ny + 3.4).toFixed(1)}" font-size="9" font-weight="800" text-anchor="middle" fill="#5c4a7d">${i === 0 ? 12 : i}</text>`;
  }
  return `<svg data-h="${hour}" data-q="${quarter}" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${label}">
    <circle cx="${cx}" cy="${cy}" r="46" fill="#fff" stroke="#845ef7" stroke-width="5"/>
    ${ticks}
    <line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(hA) * 20).toFixed(1)}" y2="${(cy + Math.sin(hA) * 20).toFixed(1)}" stroke="#e8590c" stroke-width="6" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(mA) * 30).toFixed(1)}" y2="${(cy + Math.sin(mA) * 30).toFixed(1)}" stroke="#1971c2" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="3.4" fill="#5c4a7d"/>
  </svg>`;
}

export interface ClockQ extends QuizQuestion {
  kind: ClockKind;
  /** 正确选项的原文（选钟面的题里就是那张 SVG） */
  answer: string;
  /**
   * 答案的人话说法。选钟面的题 `answer` 是一大段 SVG，
   * 提示扫描与错题回顾要的是「3 点 25 分」这种能读出来的写法；
   * 不填就说明 `answer` 本身已经是人话（前 99 关的老题型一律不填，输出与 1.1 逐字一致）。
   */
  answerText?: string;
}

/** 这道题的答案念出来是什么（提示扫描、错题回顾、无障碍标签共用） */
export function answerTextOf(q: ClockQ): string {
  return q.answerText ?? q.answer;
}

/** 认钟面：看钟选时间 */
function qRead(rand: () => number, quarters: Quarter[]): ClockQ {
  const hour = randInt(rand, 1, 12);
  const quarter = pick(rand, quarters);
  const label = formatClock(hour, quarter);
  const set = new Set<string>([label]);
  let guard = 0;
  while (set.size < 3 && guard++ < 200) {
    let h = hour + randInt(rand, -2, 2);
    if (h < 1) h += 12;
    if (h > 12) h -= 12;
    set.add(formatClock(h, pick(rand, quarters)));
  }
  const choices = shuffled([...set], rand);
  return {
    kind: "read", answer: label,
    promptHTML: clockSVG(hour, quarter, 120),
    ask: "钟面上是几点？",
    choices, correct: choices.indexOf(label),
  };
}

/** 拨针：听时间找钟面 */
function qSet(rand: () => number, quarters: Quarter[]): ClockQ {
  const hour = randInt(rand, 1, 12);
  const quarter = pick(rand, quarters);
  const seen = new Set<string>([`${hour}:${quarter}`]);
  const faces: Array<{ h: number; q: Quarter }> = [{ h: hour, q: quarter }];
  let guard = 0;
  while (faces.length < 3 && guard++ < 200) {
    let h = hour + randInt(rand, -2, 2);
    if (h < 1) h += 12;
    if (h > 12) h -= 12;
    const q = pick(rand, quarters);
    if (!seen.has(`${h}:${q}`)) {
      seen.add(`${h}:${q}`);
      faces.push({ h, q });
    }
  }
  const order = shuffled(faces, rand);
  return {
    kind: "set", answer: `data-h="${hour}" data-q="${quarter}"`,
    promptHTML: `<span style="font-size:30px">🔧</span> ${formatClock(hour, quarter)}`,
    ask: `哪个钟面是「${formatClock(hour, quarter)}」？`,
    choices: order.map((f) => clockSVG(f.h, f.q, 82, "钟面")),
    correct: order.findIndex((f) => f.h === hour && f.q === quarter),
  };
}

/** 再过几小时：整点推理 */
function qNext(rand: () => number): ClockQ {
  const hour = randInt(rand, 1, 12);
  const delta = randInt(rand, 1, 2);
  let after = hour + delta;
  if (after > 12) after -= 12;
  const label = `${after} 点`;
  const set = new Set<string>([label]);
  let guard = 0;
  while (set.size < 3 && guard++ < 60) {
    let h = after + randInt(rand, -2, 2);
    if (h < 1) h += 12;
    if (h > 12) h -= 12;
    set.add(`${h} 点`);
  }
  const choices = shuffled([...set], rand);
  return {
    kind: "next", answer: label,
    promptHTML: clockSVG(hour, 0, 110),
    ask: `现在是 ${hour} 点，再过 ${delta} 小时是几点？`,
    choices, correct: choices.indexOf(label),
  };
}

// ---------------------------------------------------------------------------
// 1.1 新机制一：分钟级时长计算（出发 / 到达 / 路上花了多久，缺哪个求哪个）
// ---------------------------------------------------------------------------

const BIG = `font-size:20px;font-weight:900;letter-spacing:.5px;line-height:1.6`;

/** 随机一个 5 分钟对齐的时刻 */
function randTime(rand: () => number, minHour: number, maxHour: number): number {
  return hmToMinutes(randInt(rand, minHour, maxHour), randInt(rand, 0, 11) * 5);
}

/** 从一组候选里凑够 3 个互不相同的选项文字 */
function threeChoices(rand: () => number, answer: string, more: () => string | null): { choices: string[]; correct: number } {
  const set = new Set<string>([answer]);
  let guard = 0;
  while (set.size < 3 && guard++ < 200) {
    const v = more();
    if (v) set.add(v);
  }
  // 极端情况下兜底，绝不返回少于 3 个选项
  let filler = 1;
  while (set.size < 3) set.add(`${answer}·${filler++}`);
  const arr = shuffled([...set], rand);
  return { choices: arr, correct: arr.indexOf(answer) };
}

const DURATION_DELTAS = [-60, -45, -30, -20, -15, -10, -5, 5, 10, 15, 20, 30, 45, 60];

/** 出发 ➜ 到达，路上花了多久 */
function qSpan(rand: () => number, t: number): ClockQ {
  const start = randTime(rand, 6, t < 0.5 ? 16 : 20);
  const dur = randInt(rand, 5, t < 0.5 ? 24 : 38) * 5;
  const end = hmToMinutes(0, start + dur);
  const answer = formatDuration(dur);
  const { choices, correct } = threeChoices(rand, answer, () => {
    const v = dur + pick(rand, DURATION_DELTAS);
    return v > 0 && v < DAY_MINUTES ? formatDuration(v) : null;
  });
  return {
    kind: "span", answer,
    promptHTML: `<span style="${BIG}">🚉 ${formatHM(start)} ➜ 🏁 ${formatHM(end)}</span>`,
    ask: "路上一共花了多久？",
    choices, correct,
  };
}

/** 出发时刻 + 路上时长 = 几点到 */
function qArrive(rand: () => number, t: number): ClockQ {
  const start = randTime(rand, 6, t < 0.5 ? 16 : 20);
  const dur = randInt(rand, 5, t < 0.5 ? 24 : 38) * 5;
  const answer = formatHM(hmToMinutes(0, start + dur));
  const { choices, correct } = threeChoices(rand, answer, () =>
    formatHM(hmToMinutes(0, start + dur + pick(rand, DURATION_DELTAS)))
  );
  return {
    kind: "arrive", answer,
    promptHTML: `<span style="${BIG}">🚉 ${formatHM(start)} 出发 · 走 ${formatDuration(dur)}</span>`,
    ask: "几点到站？",
    choices, correct,
  };
}

/** 到达时刻 − 路上时长 = 几点出发 */
function qDepart(rand: () => number, t: number): ClockQ {
  const start = randTime(rand, 6, t < 0.5 ? 16 : 20);
  const dur = randInt(rand, 5, t < 0.5 ? 24 : 38) * 5;
  const end = hmToMinutes(0, start + dur);
  const answer = formatHM(start);
  const { choices, correct } = threeChoices(rand, answer, () =>
    formatHM(hmToMinutes(0, start + pick(rand, DURATION_DELTAS)))
  );
  return {
    kind: "depart", answer,
    promptHTML: `<span style="${BIG}">🏁 ${formatHM(end)} 到站 · 走 ${formatDuration(dur)}</span>`,
    ask: "几点出发的？",
    choices, correct,
  };
}

// ---------------------------------------------------------------------------
// 1.1 新机制二：24 小时制 ↔ 12 小时制，以及跨城对表
// ---------------------------------------------------------------------------

/**
 * 干扰项的偏移量（小时）。
 * `±12` 是这一类最经典的错法：该加半天的时候没加、不该加的时候加了；
 * `±1` 打的是时段词的分界（早上和上午在 8 点换、下午和晚上在 17 点换），也是常错的地方。
 */
const PERIOD_DELTAS = [12, -12, 1, -1, 11, 13];

/** 普通计时法说法 → 24 小时制写法 */
function qH24(rand: () => number): ClockQ {
  // 先摇 24 小时制的整点，再倒推出时段词。反过来「先挑词、再摇 1..12 点」会凑出
  // 「中午 3 点」「凌晨 9 点」这种说不通的题面——时段词管的钟点区间是固定的。
  const hour24 = randInt(rand, 0, 23);
  const minute = randInt(rand, 0, 11) * 5;
  const { hour, period } = to12Hour(hour24);
  const answer = formatHM24(hmToMinutes(hour24, minute));
  const { choices, correct } = threeChoices(rand, answer, () => {
    const roll = randInt(rand, 0, 2);
    // ① 把 12 时制的钟点原样抄成 24 时制；② 半天加反了；③ 分钟抄错
    if (roll === 0) return formatHM24(hmToMinutes(hour, minute));
    if (roll === 1) return formatHM24(hmToMinutes(hour24 + pick(rand, PERIOD_DELTAS), minute));
    return formatHM24(hmToMinutes(hour24, minute + randInt(rand, 1, 11) * 5));
  });
  return {
    kind: "h24", answer,
    promptHTML: `<span style="${BIG}">🗼 ${period} ${hour}:${String(minute).padStart(2, "0")}</span>`,
    ask: "写成 24 小时制是几点？",
    choices, correct,
  };
}

/** 24 小时制写法 → 普通计时法说法（夜里 / 凌晨 / 早上 / 上午 / 中午 / 下午 / 晚上） */
function qH12(rand: () => number): ClockQ {
  const hour24 = randInt(rand, 0, 23);
  const minute = randInt(rand, 0, 11) * 5;
  const { hour, period } = to12Hour(hour24);
  const mm = String(minute).padStart(2, "0");
  const answer = `${period} ${hour}:${mm}`;
  // 干扰项一律由 to12Hour 生成：**每一个都得是中文里真说得出口的说法**，
  // 只是配错了时刻。拿「上午 12 点」这种压根不存在的话去当干扰项，孩子学到的是错的。
  const { choices, correct } = threeChoices(rand, answer, () => {
    const alt = to12Hour(hour24 + pick(rand, PERIOD_DELTAS));
    return `${alt.period} ${alt.hour}:${mm}`;
  });
  return {
    kind: "h12", answer,
    promptHTML: `<span style="${BIG}">🗼 ${formatHM24(hmToMinutes(hour24, minute))}</span>`,
    ask: "换成平时说话的说法，是几点？",
    choices, correct,
  };
}

/** 原创城市名（不使用任何真实商标或官方角色名） */
const CITIES = ["花城", "云城", "雪城", "海城", "星城", "月城", "枫城", "橘城"];
const ZONE_DELTAS = [-9, -7, -6, -5, -3, -2, 2, 3, 5, 6, 7, 9];

/**
 * 跨城对表：另一座城市现在几点。
 * 1.2 起基准城固定成北京，题面永远是「北京时间几点 + 那边比北京早／晚几小时」，
 * 只做这种一眼看得懂的时差题，不碰半小时时区、不碰夏令时。
 */
function qZone(rand: () => number): ClockQ {
  const here = "北京";
  let there = pick(rand, CITIES);
  let guard = 0;
  while (there === here && guard++ < 30) there = pick(rand, CITIES);
  if (there === here) there = CITIES[0];
  const now = randTime(rand, 0, 23);
  const delta = pick(rand, ZONE_DELTAS);
  const answer = formatHM24(shiftHours(now, delta));
  const { choices, correct } = threeChoices(rand, answer, () =>
    formatHM24(shiftHours(now, delta + pick(rand, [-3, -2, -1, 1, 2, 3, -2 * delta])))
  );
  const word = delta > 0 ? "早" : "晚";
  return {
    kind: "zone", answer,
    promptHTML: `<span style="${BIG}">🌍 ${here}时间 ${formatHM24(now)} · ${there} 比 ${here} ${word} ${Math.abs(delta)} 小时</span>`,
    ask: `${there}现在几点？`,
    choices, correct,
  };
}

// ---------------------------------------------------------------------------
// 1.1 新机制三：日历与星期推理
// ---------------------------------------------------------------------------

/** 往后数 N 天是星期几 */
function qWeekday(rand: () => number, t: number): ClockQ {
  const from = randInt(rand, 0, 6);
  const days = randInt(rand, t < 0.5 ? 8 : 20, t < 0.5 ? 40 : 99);
  const answer = WEEKDAYS[weekdayAfter(from, days)];
  const { choices, correct } = threeChoices(rand, answer, () => WEEKDAYS[randInt(rand, 0, 6)]);
  return {
    kind: "weekday", answer,
    promptHTML: `<span style="${BIG}">📅 ${WEEKDAYS[from]} ＋ ${days} 天</span>`,
    ask: "往后数是星期几？",
    choices, correct,
  };
}

/** 平年某月有几天 */
function qMonthDays(rand: () => number): ClockQ {
  const month = randInt(rand, 1, 12);
  const answer = `${daysInMonth(month)} 天`;
  const { choices, correct } = threeChoices(rand, answer, () => `${pick(rand, [28, 29, 30, 31])} 天`);
  return {
    kind: "monthdays", answer,
    promptHTML: `<span style="${BIG}">📅 平年 ${month} 月</span>`,
    ask: "这个月一共有多少天？",
    choices, correct,
  };
}

/** 已知某月 1 号星期几，求这个月第 n 个星期几是几号 */
function qNthDay(rand: () => number): ClockQ {
  let month = 1;
  let firstWeekday = 0;
  let weekday = 0;
  let nth = 1;
  let date = 0;
  let guard = 0;
  do {
    month = randInt(rand, 1, 12);
    firstWeekday = randInt(rand, 0, 6);
    weekday = randInt(rand, 0, 6);
    nth = randInt(rand, 2, 4);
    date = nthWeekdayDate(firstWeekday, weekday, nth, month);
  } while (date === 0 && guard++ < 60);
  if (date === 0) {
    // 兜底成一定排得下的一组（1 号就是目标星期几，第 2 个必然是 8 号）
    firstWeekday = weekday;
    nth = 2;
    date = 8;
  }
  const answer = `${date} 号`;
  const { choices, correct } = threeChoices(rand, answer, () => {
    const v = date + pick(rand, [-14, -7, -1, 1, 7, 14]);
    return v >= 1 && v <= daysInMonth(month) ? `${v} 号` : null;
  });
  return {
    kind: "nthday", answer,
    promptHTML: `<span style="${BIG}">📅 ${month} 月 1 号是${WEEKDAYS[firstWeekday]}</span>`,
    ask: `第 ${nth} 个${WEEKDAYS[weekday]}是几号？`,
    choices, correct,
  };
}

// ---------------------------------------------------------------------------
// 1.1 新机制四：时刻表阅读（三班车，最早到 / 最快 / 还要等多久）
// ---------------------------------------------------------------------------

export interface Trip {
  no: number;
  dep: number;
  arr: number;
  dur: number;
}

/** 三班车：到站时刻互不相同、路上时长也互不相同，保证「最早 / 最快」唯一 */
export function makeTrips(rand: () => number): Trip[] {
  for (let guard = 0; guard < 200; guard++) {
    const trips: Trip[] = [1, 2, 3].map((no) => {
      const dep = hmToMinutes(randInt(rand, 6, 17), randInt(rand, 0, 11) * 5);
      const dur = randInt(rand, 4, 24) * 5;
      return { no, dep, arr: dep + dur, dur };
    });
    const arrs = new Set(trips.map((x) => x.arr));
    const durs = new Set(trips.map((x) => x.dur));
    const deps = new Set(trips.map((x) => x.dep));
    if (arrs.size === 3 && durs.size === 3 && deps.size === 3) return trips;
  }
  // 理论上到不了这里；给一组固定的合法数据兜底
  return [
    { no: 1, dep: 7 * 60, arr: 7 * 60 + 40, dur: 40 },
    { no: 2, dep: 8 * 60, arr: 8 * 60 + 25, dur: 25 },
    { no: 3, dep: 9 * 60, arr: 10 * 60, dur: 60 },
  ];
}

function tableHTML(trips: Trip[], nowLine: string): string {
  const rows = trips
    .map((x) => `<div>🚌 ${x.no} 号车 ${formatHM24(x.dep)} → ${formatHM24(x.arr)}</div>`)
    .join("");
  return `<span style="font-size:17px;font-weight:900;line-height:1.7;display:block;text-align:left">${nowLine}${rows}</span>`;
}

function busChoices(rand: () => number, trips: Trip[], answerNo: number): { choices: string[]; correct: number; answer: string } {
  const labels = shuffled(trips.map((x) => `${x.no} 号车`), rand);
  const answer = `${answerNo} 号车`;
  return { choices: labels, correct: labels.indexOf(answer), answer };
}

/** 哪班车最早到站 */
function qTableEarly(rand: () => number): ClockQ {
  const trips = makeTrips(rand);
  const best = trips.reduce((a, b) => (b.arr < a.arr ? b : a));
  const { choices, correct, answer } = busChoices(rand, trips, best.no);
  return {
    kind: "tableEarly", answer,
    promptHTML: tableHTML(trips, ""),
    ask: "哪班车最早到站？",
    choices, correct,
  };
}

/** 哪班车路上花的时间最短 */
function qTableFast(rand: () => number): ClockQ {
  const trips = makeTrips(rand);
  const best = trips.reduce((a, b) => (b.dur < a.dur ? b : a));
  const { choices, correct, answer } = busChoices(rand, trips, best.no);
  return {
    kind: "tableFast", answer,
    promptHTML: tableHTML(trips, ""),
    ask: "哪班车路上最快？",
    choices, correct,
  };
}

/** 现在几点，坐某班车还要等多久 */
function qTableWait(rand: () => number): ClockQ {
  const trips = makeTrips(rand);
  const earliestDep = Math.min(...trips.map((x) => x.dep));
  const now = earliestDep - randInt(rand, 1, 12) * 5;
  const target = trips[randInt(rand, 0, trips.length - 1)];
  const wait = target.dep - now;
  const answer = formatDuration(wait);
  const { choices, correct } = threeChoices(rand, answer, () => {
    const v = wait + pick(rand, DURATION_DELTAS);
    return v > 0 && v < DAY_MINUTES ? formatDuration(v) : null;
  });
  return {
    kind: "tableWait", answer,
    promptHTML: tableHTML(trips, `<div>⏰ 现在 ${formatHM24(now)}</div>`),
    ask: `等 ${target.no} 号车还要多久？`,
    choices, correct,
  };
}

// ---------------------------------------------------------------------------
// 1.2 新机制一：分钟级读钟面与拨指针（时针永远带着分针带动的那一点偏移）
// ---------------------------------------------------------------------------

/** 读钟面到五分 / 一分：t < 0.5 出五分刻度，之后出任意一分钟 */
function qReadMin(rand: () => number, t: number): ClockQ {
  const hour = randInt(rand, 1, 12);
  const minute = t < 0.5 ? randInt(rand, 1, 11) * 5 : randInt(rand, 1, 59);
  const time = clockMinutes(hour, minute);
  const answer = formatClockMinute(time);
  const { choices, correct } = threeChoices(rand, answer, () => {
    const roll = randInt(rand, 0, 2);
    // 干扰项照着三种最常见的读错来：钟点读大一格、分针数错一大格、把分针当成时针读
    if (roll === 0) return formatClockMinute(clockMinutes(hour + 1, minute));
    if (roll === 1) return formatClockMinute(clockMinutes(hour, minute + pick(rand, [-5, 5, -1, 1])));
    return formatClockMinute(clockMinutes(hour, 60 - minute));
  });
  return {
    kind: "readMin",
    answer,
    promptHTML: faceSVG(time, 150, { className: "clk-face" }),
    ask: "钟面上是几点几分？",
    choices,
    correct,
  };
}

/** 拨指针：题面给一个能拖的钟面练手，再从三张钟面里挑出对的那张 */
function qSetMin(rand: () => number, t: number): ClockQ {
  const hour = randInt(rand, 1, 12);
  const minute = t < 0.5 ? randInt(rand, 1, 11) * 5 : randInt(rand, 1, 59);
  const time = clockMinutes(hour, minute);
  const label = formatClockMinute(time);
  const right = faceSVG(time, 84, { className: "clk-face-mini", label: "钟面" });
  const faces = new Map<string, string>([["right", right]]);
  // 一号干扰项就是这个年龄段最经典的错：分针拨对了，时针却死死压在数字上
  faces.set("stiff", faceSVG(time, 84, { className: "clk-face-mini", label: "钟面", hourAngle: (hour % 12) * 30 }));
  let guard = 0;
  while (faces.size < 3 && guard++ < 60) {
    const off = pick(rand, [-15, -10, -5, 5, 10, 15]);
    const other = clockMinutes(hour, minute + off);
    if (other !== time) faces.set(`m${other}`, faceSVG(other, 84, { className: "clk-face-mini", label: "钟面" }));
  }
  const order = shuffled([...faces.values()], rand);
  // 拨一拨的起始时刻故意错开，孩子得自己把它拨过去
  const start = clockMinutes(hour + pick(rand, [-2, -1, 1, 2]), pick(rand, [0, 15, 30, 45]));
  return {
    kind: "setMin",
    answer: right,
    answerText: label,
    promptHTML: `<span class="clk-dial-wrap"><span class="clk-dial-title">🔧 拨到 ${label}</span>${faceSVG(start, 150, {
      className: "clk-face",
      dial: true,
      label: "可以拖动的钟面",
    })}</span>`,
    ask: `哪个钟面是「${label}」？`,
    choices: order,
    correct: order.indexOf(right),
  };
}

// ---------------------------------------------------------------------------
// 1.2 新机制二：跨中午的经过时间
// ---------------------------------------------------------------------------

/** 上午出发、下午到达：算一算一共经过了多久（12 点那道坎是这一题的全部难点） */
function qSpanNoon(rand: () => number, t: number): ClockQ {
  const start = hmToMinutes(randInt(rand, t < 0.5 ? 10 : 8, 11), randInt(rand, 0, 11) * 5);
  const dur = NOON_MINUTES - start + randInt(rand, 1, t < 0.5 ? 12 : 30) * 5;
  const end = start + dur;
  const answer = formatDuration(dur);
  const { choices, correct } = threeChoices(rand, answer, () => {
    const v = dur + pick(rand, [-60, -45, -30, -20, -15, -10, 10, 15, 20, 30, 45, 60]);
    return v > 0 && v < DAY_MINUTES ? formatDuration(v) : null;
  });
  return {
    kind: "spanNoon",
    answer,
    promptHTML: `<span style="${BIG}">🕛 ${formatPeriodHM(start)} ➜ ${formatPeriodHM(end)}</span>`,
    ask: "中间一共经过了多久？",
    choices,
    correct,
  };
}

// ---------------------------------------------------------------------------
// 1.2 新机制三：时分秒单位换算
// ---------------------------------------------------------------------------

/** 时 ↔ 分 */
function qUnitHM(rand: () => number, t: number): ClockQ {
  const hours = randInt(rand, 1, t < 0.5 ? 2 : 4);
  const minutes = randInt(rand, 1, 11) * 5;
  const total = hours * 60 + minutes;
  const toMinutes = rand() < 0.5;
  const answer = toMinutes ? `${total} 分` : formatDuration(total);
  const { choices, correct } = threeChoices(rand, answer, () => {
    const v = total + pick(rand, [-60, -40, -20, -10, 10, 20, 40, 60]);
    if (v <= 0) return null;
    return toMinutes ? `${v} 分` : formatDuration(v);
  });
  return {
    kind: "unitHM",
    answer,
    promptHTML: `<span style="${BIG}">⏳ ${toMinutes ? formatDuration(total) : `${total} 分`}</span>`,
    ask: toMinutes ? "一共是多少分？" : "合起来是几小时几分？",
    choices,
    correct,
  };
}

/** 分 ↔ 秒 */
function qUnitMS(rand: () => number, t: number): ClockQ {
  const minutes = randInt(rand, 1, t < 0.5 ? 3 : 6);
  const seconds = randInt(rand, 1, 11) * 5;
  const total = msToTotalSeconds(minutes, seconds);
  const toSeconds = rand() < 0.5;
  const answer = toSeconds ? `${total} 秒` : formatMinSec(total);
  const { choices, correct } = threeChoices(rand, answer, () => {
    const v = total + pick(rand, [-60, -30, -20, -10, 10, 20, 30, 60]);
    if (v <= 0) return null;
    return toSeconds ? `${v} 秒` : formatMinSec(v);
  });
  return {
    kind: "unitMS",
    answer,
    promptHTML: `<span style="${BIG}">⏱️ ${toSeconds ? formatMinSec(total) : `${total} 秒`}</span>`,
    ask: toSeconds ? "一共是多少秒？" : "合起来是几分几秒？",
    choices,
    correct,
  };
}

/** 跨两级单位：小时 → 秒，或者天 → 小时 */
function qUnitMix(rand: () => number): ClockQ {
  if (rand() < 0.5) {
    const hours = randInt(rand, 1, 3);
    const minutes = pick(rand, [0, 15, 30, 45]);
    const total = (hours * 60 + minutes) * 60;
    const answer = `${total} 秒`;
    const { choices, correct } = threeChoices(rand, answer, () => {
      const v = total + pick(rand, [-3600, -1800, -900, 900, 1800, 3600]);
      return v > 0 ? `${v} 秒` : null;
    });
    return {
      kind: "unitMix",
      answer,
      promptHTML: `<span style="${BIG}">⏱️ ${formatDuration(hours * 60 + minutes)}</span>`,
      ask: "换成秒是多少？",
      choices,
      correct,
    };
  }
  const days = randInt(rand, 1, 5);
  const total = days * 24;
  const answer = `${total} 小时`;
  const { choices, correct } = threeChoices(rand, answer, () => {
    const v = total + pick(rand, [-24, -12, -6, 6, 12, 24]);
    return v > 0 ? `${v} 小时` : null;
  });
  return {
    kind: "unitMix",
    answer,
    promptHTML: `<span style="${BIG}">📆 ${days} 天</span>`,
    ask: "一共是多少小时？",
    choices,
    correct,
  };
}

// ---------------------------------------------------------------------------
// 1.2 新机制四：作息表读取（一天的安排表，比班次表更贴近孩子自己的生活）
// ---------------------------------------------------------------------------

/** 作息表的事项名（全部原创，按一天的顺序排） */
export const ROUTINE_ITEMS = [
  "起床",
  "早饭",
  "出门",
  "早读",
  "第一节课",
  "课间操",
  "午饭",
  "午休",
  "第五节课",
  "放学",
  "写作业",
  "晚饭",
  "看课外书",
  "睡觉",
] as const;

export interface RoutineRow {
  name: string;
  at: number;
}

/** 抽 5 行连续的作息，时刻严格递增（保证「下一项是什么」只有一个答案） */
export function makeRoutine(rand: () => number): RoutineRow[] {
  const startIndex = randInt(rand, 0, ROUTINE_ITEMS.length - 5);
  let at = hmToMinutes(randInt(rand, 6, 8), randInt(rand, 0, 11) * 5);
  const rows: RoutineRow[] = [];
  for (let i = 0; i < 5; i++) {
    rows.push({ name: ROUTINE_ITEMS[startIndex + i], at });
    at += randInt(rand, 3, 24) * 5;
  }
  return rows;
}

function routineHTML(rows: RoutineRow[]): string {
  const body = rows.map((r) => `<div>🗓️ ${r.name} ${formatHM24(r.at)}</div>`).join("");
  return `<span style="font-size:17px;font-weight:900;line-height:1.7;display:block;text-align:left">${body}</span>`;
}

/** 作息表：两项之间隔多久 / 某一项后面紧接着做什么 */
function qRoutine(rand: () => number): ClockQ {
  const rows = makeRoutine(rand);
  if (rand() < 0.5) {
    const from = randInt(rand, 0, rows.length - 2);
    const to = randInt(rand, from + 1, rows.length - 1);
    const gap = rows[to].at - rows[from].at;
    const answer = formatDuration(gap);
    const { choices, correct } = threeChoices(rand, answer, () => {
      const v = gap + pick(rand, DURATION_DELTAS);
      return v > 0 && v < DAY_MINUTES ? formatDuration(v) : null;
    });
    return {
      kind: "routine",
      answer,
      promptHTML: routineHTML(rows),
      ask: `从${rows[from].name}到${rows[to].name}隔多久？`,
      choices,
      correct,
    };
  }
  const from = randInt(rand, 0, rows.length - 2);
  const answer = rows[from + 1].name;
  const others = rows.filter((r) => r.name !== answer).map((r) => r.name);
  const pool = shuffled(others, rand).slice(0, 2);
  const order = shuffled([answer, ...pool], rand);
  return {
    kind: "routine",
    answer,
    promptHTML: routineHTML(rows),
    ask: `${rows[from].name}之后紧接着是什么？`,
    choices: order,
    correct: order.indexOf(answer),
  };
}

function makeAdvanced(rand: () => number, kind: ClockKind, t: number): ClockQ {
  switch (kind) {
    case "span": return qSpan(rand, t);
    case "spanNoon": return qSpanNoon(rand, t);
    case "arrive": return qArrive(rand, t);
    case "depart": return qDepart(rand, t);
    case "h24": return qH24(rand);
    case "h12": return qH12(rand);
    case "zone": return qZone(rand);
    case "weekday": return qWeekday(rand, t);
    case "monthdays": return qMonthDays(rand);
    case "nthday": return qNthDay(rand);
    case "readMin": return qReadMin(rand, t);
    case "setMin": return qSetMin(rand, t);
    case "unitHM": return qUnitHM(rand, t);
    case "unitMS": return qUnitMS(rand, t);
    case "unitMix": return qUnitMix(rand);
    case "routine": return qRoutine(rand);
    case "tableEarly": return qTableEarly(rand);
    case "tableFast": return qTableFast(rand);
    default: return qTableWait(rand);
  }
}

/** 各章允许出现的分钟类型 */
export function allowedQuarters(level: number): Quarter[] {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  switch (ci) {
    case 0: return [0];
    case 1: return t < 0.4 ? [0, 2] : [2, 0];
    case 2: return t < 0.4 ? [0, 1] : [0, 1, 2];
    case 3: return t < 0.4 ? [2, 3] : [0, 1, 2, 3];
    case 4: return t < 0.5 ? [0, 2] : [0, 1, 2, 3];
    default: return [0, 1, 2, 3];
  }
}

/** 本关在所属章节里的进度（0 → 1） */
function chapterProgress(level: number): number {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  return idx / Math.max(1, CHAPTERS[ci].size - 1);
}

/** 每关题目数：前 99 关 4 → 7 题；第 100–188 关 6 → 10 题（明显更长） */
export function questionCount(level: number): number {
  const ci = chapterOf(CHAPTERS, level);
  const t = chapterProgress(level);
  if (ci >= LEGACY_CHAPTER_COUNT) return 6 + Math.min(4, Math.floor(t * 4.6));
  return 4 + Math.min(3, Math.floor(t * 3.6));
}

/** 走 1.0/1.1 老路径的关卡数（第 1–99 关） */
export const LEGACY_LEVELS = 99;

/**
 * 前 99 关的题型池：1.0/1.1 定下来的阶梯，1.2 一个字不改。
 * `levels.test.ts` 会用「逐关比对 + 全量摘要哈希」两道锁把它钉死。
 */
export function legacyKindPool(level: number): ClockKind[] {
  const ci = chapterOf(CHAPTERS, level);
  const t = chapterProgress(level);
  if (ci <= 3) return ["read"];
  if (ci === 4) return t < 0.6 ? ["set"] : ["set", "read"];
  return t < 0.4 ? ["read", "set"] : ["read", "set", "next"];
}

/**
 * 这一关每道题分别出什么种类。
 *
 * - 第 1–99 关：走 `legacyKindPool`，返回的是「题型池」，题量超过池子时随机取（1.0 行为）；
 * - 第 100 关起：由 `kinds.ts` 的权重表排出**和题量一样长**的一串种类，
 *   每道题各占一格，难度曲线因此变成一张能读、能断言的表。
 */
export function kindPool(level: number): ClockKind[] {
  if (level < LEGACY_LEVELS) return legacyKindPool(level);
  return tableKinds(level, questionCount(level));
}

/** 按种类出一道题（前 99 关与错题回顾共用同一个分发口） */
function makeOne(rand: () => number, kind: ClockKind, quarters: Quarter[], t: number): ClockQ {
  if (kind === "read") return qRead(rand, quarters);
  if (kind === "set") return qSet(rand, quarters);
  if (kind === "next") return qNext(rand);
  return makeAdvanced(rand, kind, t);
}

/** 生成某一关的全部题目（确定性，重试不换题） */
export function buildQuestions(level: number): ClockQ[] {
  const rand = mulberry32(8500 + level * 7919);
  const quarters = allowedQuarters(level);
  const kinds = kindPool(level);
  const count = questionCount(level);
  const t = chapterProgress(level);
  const out: ClockQ[] = [];
  for (let i = 0; i < count; i++) {
    const kind = i < kinds.length ? kinds[i] : pick(rand, kinds);
    out.push(makeOne(rand, kind, quarters, t));
  }
  return shuffled(out, rand);
}

// ---------------------------------------------------------------------------
// 1.2 错题回顾：换个数字的同类题
// ---------------------------------------------------------------------------

/** 一关最多回顾几道错题（再多孩子就该累了，剩下的留给下次） */
export const MAX_REVIEW_QUESTIONS = 4;

/** 回顾轮的种子：和正题错开，保证「同类不同题」 */
export function reviewSeed(level: number, round = 0): number {
  return 620000 + level * 3517 + round * 977;
}

/**
 * 把这一关答错过的题按「同类换数字」重出一轮。
 *
 * 只认题型种类，不带原题的任何数字进来，所以孩子看到的是一道新题，想蒙对只能真的把方法用一遍。
 * `avoid` 传原题的题面：前 99 关那种「12 个钟点 × 4 种分钟」的老题型可选组合本来就少，
 * 不躲一下真会摇出一模一样的题，那这一轮回顾就白做了。
 */
export function makeReviewQuestions(
  wrongKinds: readonly ClockKind[],
  level: number,
  round = 0,
  avoid: readonly string[] = []
): ClockQ[] {
  const kinds: ClockKind[] = [];
  for (const k of wrongKinds) {
    if (kinds.length >= MAX_REVIEW_QUESTIONS) break;
    kinds.push(k);
  }
  if (kinds.length === 0) return [];
  const rand = mulberry32(reviewSeed(level, round));
  const quarters = allowedQuarters(level);
  const t = chapterProgress(level);
  const seen = new Set(avoid);
  return kinds.map((kind) => {
    let q = makeOne(rand, kind, quarters, t);
    for (let guard = 0; guard < 40 && seen.has(q.promptHTML); guard++) {
      q = makeOne(rand, kind, quarters, t);
    }
    seen.add(q.promptHTML);
    return q;
  });
}

/** 这一关会考到的题型（去重，攻略与错题统计用） */
export function typesOfLevel(level: number): ClockType[] {
  const seen = new Set<ClockType>();
  for (const kind of kindPool(level)) seen.add(typeOfKind(kind));
  return [...seen];
}

/** 188 关概览（测试用） */
export const LEVELS = Array.from({ length: TOTAL_LEVELS }, (_, i) => ({
  count: questionCount(i),
  kinds: kindPool(i),
  quarters: allowedQuarters(i),
}));
