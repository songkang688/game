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
