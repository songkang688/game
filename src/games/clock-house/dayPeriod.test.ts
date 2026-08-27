/**
 * 守门：12 ↔ 24 时制的**时段词**必须跟小学课本《24 时计时法》一课对得上。
 *
 * 背景（第 2 轮测试员 W5R2-A-03）：老代码只有「上午 / 下午」这种 AM/PM 二分，
 * 于是 188 关里有 78 道题的说法跟课本不一致，其中 9 道是硬错——
 * 中文里没有「上午 12 点」（0 点是夜里 / 凌晨），也没有「下午 12 点」（12 点是中午）。
 * 这是一款专门教读钟与时制换算的游戏，教出来的说法孩子在课堂上会被判错。
 *
 * 本文件里的对照表是**照课本另抄的一份**，不从 `logic.ts` import：
 * 拿产品代码去验产品代码等于什么都没验，那正是上一轮漏掉这条的原因。
 */
import { describe, expect, it } from "vitest";
import { buildQuestions } from "./levels";
import { DAY_PERIODS, PERIOD_BANDS, dayPeriodOf, hoursOfPeriod, to12Hour, to24Hour } from "./logic";
import { METHOD_HINTS } from "./hints";

/** 课本口径：时段词 → 它管的 24 小时制整点区间（含两端） */
const BOOK: ReadonlyArray<readonly [string, number, number]> = [
  ["夜里", 0, 0],
  ["凌晨", 1, 5],
  ["早上", 6, 8],
  ["上午", 9, 11],
  ["中午", 12, 12],
  ["下午", 13, 17],
  ["晚上", 18, 23],
];

const WORDS = BOOK.map(([w]) => w).join("|");

/** 题面 / 选项 / 答案里出现的每一处「时段词 + 钟点」 */
const PERIOD_HM = new RegExp(`(${WORDS}|上午|下午) (\\d{1,2}):(\\d{2})`, "g");

function strip(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

/** 这一处说法跟课本对不对得上；对不上就返回一句人看得懂的原因 */
function checkSaying(period: string, hour12: number): string | null {
  const row = BOOK.find(([w]) => w === period);
  if (!row) return `课本里没有「${period}」这个时段词`;
  const [, from, to] = row;
  if (hour12 < 1 || hour12 > 12) return `钟点 ${hour12} 不在 1–12 之间`;
  const h24 = from >= 12 ? (hour12 % 12) + 12 : hour12 % 12;
  if (h24 < from || h24 > to) return `「${period} ${hour12} 点」对不上：${period}管的是 ${from}–${to} 点`;
  return null;
}

describe("时钟小屋 · 时段词口径（W5R2-A-03）", () => {
  it("七个时段词把一天 24 小时不重不漏地铺满，顺序也是按时间先后排的", () => {
    expect([...DAY_PERIODS]).toEqual(BOOK.map(([w]) => w));
    const covered = new Map<number, string>();
    for (const band of PERIOD_BANDS) {
      for (let h = band.from; h <= band.to; h++) {
        expect(covered.has(h), `${h} 点被两个时段词都认领了`).toBe(false);
        covered.set(h, band.period);
      }
    }
    expect(covered.size, "一天 24 个整点要全部有归属").toBe(24);
    for (const [word, from, to] of BOOK) {
      for (let h = from; h <= to; h++) expect(covered.get(h), `${h} 点`).toBe(word);
      expect(hoursOfPeriod(word as (typeof DAY_PERIODS)[number])).toEqual(
        Array.from({ length: to - from + 1 }, (_, i) => from + i)
      );
    }
  });

  it("dayPeriodOf 24 个整点逐点对课本，负数与超界也回绕得回来", () => {
    for (const [word, from, to] of BOOK) {
      for (let h = from; h <= to; h++) expect(dayPeriodOf(h), `${h} 点`).toBe(word);
    }
    expect(dayPeriodOf(24)).toBe("夜里");
    expect(dayPeriodOf(-1)).toBe("晚上");
    expect(dayPeriodOf(25)).toBe("凌晨");
  });

  it("两个端点：0 点是夜里 12 点、12 点是中午 12 点，不许说成上午 / 下午 12 点", () => {
    expect(to12Hour(0)).toEqual({ hour: 12, period: "夜里" });
    expect(to12Hour(12)).toEqual({ hour: 12, period: "中午" });
    expect(to24Hour(12, "夜里")).toBe(0);
    expect(to24Hour(12, "中午")).toBe(12);
    // 老口径（AM/PM 二分）在这两点上说的话，逐条确认现在都说不出来了
    expect(checkSaying("上午", 12)).not.toBeNull();
    expect(checkSaying("下午", 12)).not.toBeNull();
  });

  it("24 个整点来回转一圈都回得到原值", () => {
    for (let h = 0; h < 24; h++) {
      const { hour, period } = to12Hour(h);
      expect(to24Hour(hour, period), `${h} 点`).toBe(h);
      expect(checkSaying(period, hour), `${h} 点的说法`).toBeNull();
    }
  });

  it("188 关里每一处「时段词 + 钟点」都跟课本对得上", () => {
    const bad: string[] = [];
    let checked = 0;
    for (let level = 0; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        for (const text of [strip(q.promptHTML), q.ask, q.answer, ...q.choices]) {
          for (const m of text.matchAll(PERIOD_HM)) {
            checked++;
            const why = checkSaying(m[1], Number(m[2]));
            if (why) bad.push(`第 ${level + 1} 关 ${q.kind}：${m[0]} —— ${why}`);
          }
        }
      }
    }
    // 自检：真的扫到东西了才算数，别扫了个空还绿
    expect(checked, "一处时段词都没扫到，这条用例空转了").toBeGreaterThan(300);
    expect(bad.slice(0, 12)).toEqual([]);
  });

  it("188 关里一次都不出现「上午 12 点」「下午 12 点」这两句硬错", () => {
    const bad: string[] = [];
    for (let level = 0; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        for (const text of [strip(q.promptHTML), q.ask, q.answer, ...q.choices]) {
          for (const m of text.matchAll(/(上午|下午) 12:(\d{2})/g)) {
            bad.push(`第 ${level + 1} 关 ${q.kind}：${m[0]}`);
          }
        }
      }
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });

  it("h12 题的答案、h24 题的题面都是七段说法，选项里也不许混进二分说法", () => {
    let h12 = 0;
    let h24 = 0;
    const seen = new Set<string>();
    for (let level = 99; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind === "h12") {
          h12++;
          const m = q.answer.match(new RegExp(`^(${WORDS}) ([1-9]|1[0-2]):[0-5]\\d$`));
          expect(m, `第 ${level + 1} 关的 h12 答案不是七段说法：${q.answer}`).not.toBeNull();
          seen.add(m![1]);
          for (const c of q.choices) {
            expect(c, `第 ${level + 1} 关的干扰项跑调了：${c}`).toMatch(
              new RegExp(`^(${WORDS}) ([1-9]|1[0-2]):[0-5]\\d$`)
            );
          }
        }
        if (q.kind === "h24") {
          h24++;
          const m = strip(q.promptHTML).match(new RegExp(`(${WORDS}) ([1-9]|1[0-2]):[0-5]\\d`));
          expect(m, `第 ${level + 1} 关的 h24 题面不是七段说法`).not.toBeNull();
          seen.add(m![1]);
        }
      }
    }
    expect(h12, "h12 题一道都没扫到").toBeGreaterThan(30);
    expect(h24, "h24 题一道都没扫到").toBeGreaterThan(30);
    // 七个词不是摆设：188 关里至少得真的出过 6 个（「夜里」只管 0 点这一小时，最稀）
    expect(seen.size, `188 关只用到了 ${[...seen].join("/")}`).toBeGreaterThanOrEqual(6);
  });

  it("跨中午那一题的两头也走同一套说法（12 点那一小时说「中午」）", () => {
    let noon = 0;
    for (let level = 99; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "spanNoon") continue;
        for (const m of strip(q.promptHTML).matchAll(PERIOD_HM)) {
          expect(checkSaying(m[1], Number(m[2])), `第 ${level + 1} 关：${m[0]}`).toBeNull();
          if (m[1] === "中午") noon++;
        }
      }
    }
    expect(noon, "跨中午的题里一次都没出现「中午 12 点」，多半是说成「下午 12 点」了").toBeGreaterThan(0);
  });

  it("这一类的方法提示改口了：不再教「只有上午和下午两种」", () => {
    const hint = METHOD_HINTS.convert1224;
    expect(hint).toContain("中午");
    expect(hint).toContain("凌晨");
    expect(hint).toContain("晚上");
    expect(/[0-9]/.test(hint), "提示里不许出现数字").toBe(false);
  });
});
