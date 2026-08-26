// 时钟小屋：认整点、半点、1 刻、3 刻的出题纯逻辑

/** 0 = 整点，1 = 1 刻（15 分），2 = 半点（30 分），3 = 3 刻（45 分） */
export type Quarter = 0 | 1 | 2 | 3;

export type ClockQuestion = {
  hour: number; // 1..12
  quarter: Quarter;
  label: string;
  /** 三个时间选项文字（含正确的），已打乱 */
  choices: string[];
  answerIndex: number;
};

export function formatClock(hour: number, quarter: Quarter): string {
  if (quarter === 0) return `${hour} 点`;
  if (quarter === 1) return `${hour} 点 1 刻`;
  if (quarter === 2) return `${hour} 点半`;
  return `${hour} 点 3 刻`;
}

/** 时针角度（度，0 度指向 12，顺时针） */
export function hourHandAngle(hour: number, quarter: Quarter): number {
  return ((hour % 12) + quarter * 0.25) * 30;
}

/** 分针角度（度，0 度指向 12，顺时针）：整点 0°，1 刻 90°，半点 180°，3 刻 270° */
export function minuteHandAngle(quarter: Quarter): number {
  return quarter * 90;
}

function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/**
 * 出一道认时间题。
 * @param allowedQuarters 本关允许出现的分钟类型（干扰项也从这里挑，保证都是学过的说法）
 */
export function makeClockQuestion(
  rand: () => number = Math.random,
  allowedQuarters: Quarter[] = [0, 2]
): ClockQuestion {
  const quarters: Quarter[] = allowedQuarters.length > 0 ? allowedQuarters : [0];
  const hour = randInt(rand, 1, 12);
  const quarter = quarters[Math.floor(rand() * quarters.length)];
  const label = formatClock(hour, quarter);

  const set = new Set<string>([label]);
  let guard = 0;
  while (set.size < 3 && guard++ < 200) {
    // 干扰项：附近的小时或同小时的另一种分钟说法，都是孩子容易看混的
    const dh = randInt(rand, -2, 2);
    let h = hour + dh;
    if (h < 1) h += 12;
    if (h > 12) h -= 12;
    const q = quarters[Math.floor(rand() * quarters.length)];
    set.add(formatClock(h, q));
  }

  const choices = [...set];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { hour, quarter, label, choices, answerIndex: choices.indexOf(label) };
}

// ---------------------------------------------------------------------------
// 1.1 新增：分钟级时刻、时长、24 小时制、时区、日历（第 100–188 关专用）
// 上面那套「整点 / 刻」的接口一个都没动，前 99 关照旧。
// ---------------------------------------------------------------------------

/** 一整天的分钟数 */
export const DAY_MINUTES = 24 * 60;

/** 「时:分」折算成一天内的分钟数（越界自动回绕到 0..1439） */
export function hmToMinutes(hour: number, minute: number): number {
  const raw = Math.round(hour) * 60 + Math.round(minute);
  return ((raw % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

function normMinutes(mins: number): number {
  return ((Math.round(mins) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

/** 分钟数 → 「7:05」（24 小时制，小时不补零） */
export function formatHM(mins: number): string {
  const m = normMinutes(mins);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** 分钟数 → 「07:05」（时刻表与时区题用的补零写法） */
export function formatHM24(mins: number): string {
  const m = normMinutes(mins);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** from 到 to 经过的分钟数；跨过午夜就按第二天算 */
export function elapsedMinutes(from: number, to: number): number {
  const d = (Math.round(to) - Math.round(from)) % DAY_MINUTES;
  return d < 0 ? d + DAY_MINUTES : d;
}

/** 时长 → 「1 小时 45 分」/「45 分」/「2 小时」 */
export function formatDuration(mins: number): string {
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} 分`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
}

export type DayPeriod = "上午" | "下午";

/** 12 小时制 → 24 小时制的小时数（上午 12 点是 0 点，下午 12 点还是 12 点） */
export function to24Hour(hour12: number, period: DayPeriod): number {
  const h = ((((Math.round(hour12) - 1) % 12) + 12) % 12) + 1;
  if (period === "上午") return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
}

/** 24 小时制 → 12 小时制 */
export function to12Hour(hour24: number): { hour: number; period: DayPeriod } {
  const h = ((Math.round(hour24) % 24) + 24) % 24;
  if (h === 0) return { hour: 12, period: "上午" };
  if (h < 12) return { hour: h, period: "上午" };
  if (h === 12) return { hour: 12, period: "下午" };
  return { hour: h - 12, period: "下午" };
}

/** 时刻整体加减若干小时（跨天回绕），时区题用 */
export function shiftHours(mins: number, deltaHours: number): number {
  return hmToMinutes(0, Math.round(mins) + Math.round(deltaHours) * 60);
}

/** 星期名，下标 0 = 星期一 */
export const WEEKDAYS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

/** 从 index（0 = 星期一）往后数 days 天是星期几 */
export function weekdayAfter(index: number, days: number): number {
  return ((((Math.round(index) + Math.round(days)) % 7) + 7) % 7);
}

/** 平年每月天数，下标 0 = 1 月 */
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** 平年某月有几天 */
export function daysInMonth(month: number): number {
  return MONTH_DAYS[((((Math.round(month) - 1) % 12) + 12) % 12)];
}

/**
 * 某月 1 号是 firstWeekday（0 = 星期一）时，这个月第 nth 个 weekday 是几号。
 * 排不下（比如第 5 个星期六）就返回 0，出题时会换一组重来。
 */
export function nthWeekdayDate(firstWeekday: number, weekday: number, nth: number, month: number): number {
  const offset = ((((Math.round(weekday) - Math.round(firstWeekday)) % 7) + 7) % 7);
  const date = 1 + offset + (Math.round(nth) - 1) * 7;
  return date >= 1 && date <= daysInMonth(month) ? date : 0;
}

// ---------------------------------------------------------------------------
// 1.2 新增一：分钟级钟面模型与「拨指针」的时针联动
//
// 钟面上的一个时刻统一用「12 小时制走一圈的总分钟数」表示（0..719）：
// 13:20 和 1:20 在钟面上是同一个位置，用同一个数表示，读题与拨针共用一套坐标。
// 上面那套「整点 / 刻」的接口一个都没动，前 99 关照旧。
// ---------------------------------------------------------------------------

/** 钟面走一圈的分钟数（12 小时制） */
export const CLOCK_MINUTES = 12 * 60;

/** 一小时的分钟数 */
export const HOUR_MINUTES = 60;

/** 一分钟的秒数 */
export const MINUTE_SECONDS = 60;

/** 回绕到 0..719（保留小数，精确模式下指针可以停在整分之间） */
export function wrapClockMinutes(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const r = v % CLOCK_MINUTES;
  return r < 0 ? r + CLOCK_MINUTES : r;
}

/** 回绕并取整到 0..719 */
export function normClockMinutes(v: number): number {
  return wrapClockMinutes(Math.round(Number.isFinite(v) ? v : 0));
}

/** 「几点几分」→ 钟面分钟数（hour 用 1..12，12 点当 0 点算） */
export function clockMinutes(hour12: number, minute: number): number {
  return normClockMinutes((Math.round(hour12) % 12) * 60 + Math.round(minute));
}

/** 钟面分钟数 → 读出来的钟点（1..12） */
export function clockHour(t: number): number {
  const h = Math.floor(normClockMinutes(t) / 60);
  return h === 0 ? 12 : h;
}

/** 钟面分钟数 → 分针指着的分钟（0..59） */
export function clockMinute(t: number): number {
  return normClockMinutes(t) % 60;
}

/** 钟面分钟数 → 「3 点」/「3 点 25 分」 */
export function formatClockMinute(t: number): string {
  const m = clockMinute(t);
  return m === 0 ? `${clockHour(t)} 点` : `${clockHour(t)} 点 ${m} 分`;
}

/** 分针角度（度，0 度指向 12，顺时针）：每分钟 6 度 */
export function minuteHandAngleAt(t: number): number {
  return (wrapClockMinutes(t) % 60) * 6;
}

/**
 * 时针角度（度，0 度指向 12，顺时针）：整点 30 度一格，再加上分针带动的 0.5 度／分。
 * 「拨分针时针要跟着走一点」这条教学正确性，全部落在这一个式子上。
 */
export function hourHandAngleAt(t: number): number {
  return wrapClockMinutes(t) * 0.5;
}

/** 秒针角度（度）：每秒 6 度 */
export function secondHandAngleAt(second: number): number {
  const s = ((second % 60) + 60) % 60;
  return s * 6;
}

/** 分针转过 delta 分钟时，时针跟着转多少度（比例恒定，0.5 度／分） */
export function hourHandDriftDegrees(deltaMinutes: number): number {
  return deltaMinutes * 0.5;
}

/** 角度（0 度指向 12，顺时针）→ 分针指到的分钟数（0..60 的小数） */
export function angleToMinute(angle: number): number {
  const a = ((angle % 360) + 360) % 360;
  return a / 6;
}

/** 磁性吸附：默认吸到最近的整分；精确模式保留小数，指针可以停在两分之间 */
export function snapMinute(minute: number, precise = false): number {
  const m = ((minute % 60) + 60) % 60;
  if (precise) return m;
  return Math.round(m) % 60;
}

/**
 * 把分针拨到 minute（0..60），时针按比例联动。
 * 走最短路径：分针越过 12 就自动进一个钟点、倒着越过就退一个钟点，
 * 绝不会因为「55 分拨到 5 分」凭空倒退 50 分钟。
 */
export function dragMinuteTo(t: number, minute: number): number {
  const cur = wrapClockMinutes(t);
  const target = ((minute % 60) + 60) % 60;
  let delta = target - (cur % 60);
  if (delta > 30) delta -= 60;
  else if (delta < -30) delta += 60;
  return wrapClockMinutes(cur + delta);
}

/** 直接把时针拨到某个角度（分针落到对应的分钟上，两针始终自洽） */
export function dragHourTo(t: number, angle: number): number {
  const a = ((angle % 360) + 360) % 360;
  return wrapClockMinutes(a * 2);
}

// ---------------------------------------------------------------------------
// 1.2 新增二：时分秒单位换算（六年级的分秒互化）
// ---------------------------------------------------------------------------

/** 「几小时几分」→ 总分钟数 */
export function hmToTotalMinutes(hours: number, minutes: number): number {
  return Math.round(hours) * HOUR_MINUTES + Math.round(minutes);
}

/** 「几分几秒」→ 总秒数 */
export function msToTotalSeconds(minutes: number, seconds: number): number {
  return Math.round(minutes) * MINUTE_SECONDS + Math.round(seconds);
}

/** 秒数 → 「3 分 20 秒」/「45 秒」/「2 分」 */
export function formatMinSec(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(total / MINUTE_SECONDS);
  const s = total % MINUTE_SECONDS;
  if (m === 0) return `${s} 秒`;
  if (s === 0) return `${m} 分`;
  return `${m} 分 ${s} 秒`;
}

/** 一天里的中午 12 点（分钟数） */
export const NOON_MINUTES = 12 * 60;

/** from 出发、走 duration 分钟，这一段有没有跨过中午 12 点 */
export function crossesNoon(from: number, duration: number): boolean {
  const start = Math.round(from);
  return start < NOON_MINUTES && start + Math.round(duration) > NOON_MINUTES;
}

/** 一天内的分钟数 → 「上午 10:40」/「下午 1:20」（跨中午的题用这种说法才看得出难点） */
export function formatPeriodHM(mins: number): string {
  const m = ((Math.round(mins) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const { hour, period } = to12Hour(Math.floor(m / 60));
  return `${period} ${hour}:${String(m % 60).padStart(2, "0")}`;
}
