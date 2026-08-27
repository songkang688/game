import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CORE_CLOCK_TYPES, typeOfKind } from "./kinds";
import { formatClock, type Quarter } from "./logic";
import {
  allowedQuarters,
  buildQuestions,
  CHAPTERS,
  kindPool,
  legacyKindPool,
  LEVELS,
  makeReviewQuestions,
  MAX_REVIEW_QUESTIONS,
  questionCount,
  reviewSeed,
  typesOfLevel,
} from "./levels";

describe("时钟小屋 188 关", () => {
  it("恰好 188 关", () => {
    expect(LEVELS).toHaveLength(188);
  });

  it("至少 6 个主题章节，章节大小之和为 188", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("每关题目合法：3 个唯一选项、正确项与答案一致", () => {
    for (let i = 0; i < 99; i++) {
      const qs = buildQuestions(i);
      expect(qs.length).toBe(questionCount(i));
      for (const q of qs) {
        expect(q.choices.length).toBe(3);
        expect(new Set(q.choices).size).toBe(3);
        expect(q.choices[q.correct]).toContain(q.answer);
      }
    }
  });

  it("整点钟楼只考整点，之后逐章加入半点、1 刻、3 刻", () => {
    expect(allowedQuarters(0)).toEqual([0]);
    expect(allowedQuarters(20)).toContain(2);
    expect(allowedQuarters(40)).toContain(1);
    expect(allowedQuarters(60)).toContain(3);
    for (let i = 0; i < 17; i++) {
      for (const q of buildQuestions(i)) {
        if (q.kind === "read") {
          expect(q.answer).not.toContain("半");
          expect(q.answer).not.toContain("刻");
        }
      }
    }
  });

  it("认钟面题答案与钟面 data 属性一致", () => {
    for (const i of [0, 20, 40, 60, 80, 98]) {
      for (const q of buildQuestions(i)) {
        if (q.kind !== "read") continue;
        const m = q.promptHTML.match(/data-h="(\d+)" data-q="(\d)"/);
        expect(m).not.toBeNull();
        const h = Number(m![1]);
        const qt = Number(m![2]);
        const expected = qt === 0 ? `${h} 点` : qt === 1 ? `${h} 点 1 刻` : qt === 2 ? `${h} 点半` : `${h} 点 3 刻`;
        expect(q.answer).toBe(expected);
      }
    }
  });

  it("再过几小时题算术正确", () => {
    let seen = 0;
    for (let i = 83; i < 99; i++) {
      for (const q of buildQuestions(i)) {
        if (q.kind !== "next") continue;
        seen++;
        const m = q.ask.match(/现在是 (\d+) 点，再过 (\d+) 小时/);
        expect(m).not.toBeNull();
        let after = Number(m![1]) + Number(m![2]);
        if (after > 12) after -= 12;
        expect(q.answer).toBe(`${after} 点`);
      }
    }
    expect(seen).toBeGreaterThan(5);
  });

  it("抽 20+ 题机器校验：认钟/拨针/推理时刻全对、引导语口语化（≤15 个汉字）", () => {
    const fmt = (h: number, qt: number) =>
      qt === 0 ? `${h} 点` : qt === 1 ? `${h} 点 1 刻` : qt === 2 ? `${h} 点半` : `${h} 点 3 刻`;
    const qs = [0, 24, 49, 74, 98].flatMap((i) => buildQuestions(i));
    expect(qs.length).toBeGreaterThanOrEqual(20);
    for (const q of qs) {
      expect((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length).toBeLessThanOrEqual(15);
      if (q.kind === "read") {
        const m = q.promptHTML.match(/data-h="(\d+)" data-q="(\d)"/);
        expect(m).not.toBeNull();
        expect(q.answer).toBe(fmt(Number(m![1]), Number(m![2])));
        expect(q.choices[q.correct]).toBe(q.answer);
      } else if (q.kind === "set") {
        const label = q.ask.match(/「(.+)」/)![1];
        const cm = q.choices[q.correct].match(/data-h="(\d+)" data-q="(\d)"/);
        expect(cm).not.toBeNull();
        expect(fmt(Number(cm![1]), Number(cm![2]))).toBe(label);
      } else {
        const m = q.ask.match(/现在是 (\d+) 点，再过 (\d+) 小时/);
        expect(m).not.toBeNull();
        let after = Number(m![1]) + Number(m![2]);
        if (after > 12) after -= 12;
        expect(q.answer).toBe(`${after} 点`);
        expect(q.choices[q.correct]).toBe(q.answer);
      }
    }
  });

  it("同一关重试题目一致（确定性生成）", () => {
    for (const i of [0, 20, 45, 70, 98]) {
      expect(JSON.stringify(buildQuestions(i))).toBe(JSON.stringify(buildQuestions(i)));
    }
  });

  it("六层玩法各有侧重（并非同一模板）", () => {
    // 前四章都是认钟面，但允许的分钟类型不同；后两章加入拨针与推理
    const sigs = new Set(
      [2, 19, 36, 52, 68, 90].map((i) => `${kindPool(i).join(",")}|${allowedQuarters(i).slice().sort().join("")}`)
    );
    expect(sigs.size).toBeGreaterThanOrEqual(6);
    expect(kindPool(70)).toContain("set");
    expect(kindPool(95)).toContain("next");
  });

  it("章节内题量递进", () => {
    expect(questionCount(0)).toBeLessThan(questionCount(16));
    expect(questionCount(83)).toBeLessThanOrEqual(questionCount(98));
  });
});

// ---------------------------------------------------------------------------
// 1.1：第 100–188 关（出发到达站 / 廿四时钟塔 / 星期日历屋 / 时刻表车站）
// ---------------------------------------------------------------------------

/** 1.0 的前 99 关章节切分，硬编码做回归断言 */
const LEGACY_CHAPTER_SNAPSHOT = [
  { name: "整点钟楼", size: 17 },
  { name: "半点小屋", size: 17 },
  { name: "一刻花园", size: 17 },
  { name: "三刻广场", size: 16 },
  { name: "拨针工坊", size: 16 },
  { name: "时间冒险家", size: 16 },
];

const NEW_FROM = 99;
const NEW_LEVELS = Array.from({ length: 188 - NEW_FROM }, (_, i) => NEW_FROM + i);
const ADVANCED_KINDS = new Set([
  // 1.1
  "span", "arrive", "depart", "h24", "h12", "zone",
  "weekday", "monthdays", "nthday", "tableEarly", "tableFast", "tableWait",
  // 1.2
  "readMin", "setMin", "spanNoon", "unitHM", "unitMS", "unitMix", "routine",
]);

function strip(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** "1 小时 45 分" / "45 分" / "2 小时" → 分钟数 */
function parseDur(text: string): number {
  const h = text.match(/(\d+)\s*小时/);
  const m = text.match(/(\d+)\s*分/);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

function parseHM(text: string): number {
  const m = text.match(/(\d{1,2}):(\d{2})/);
  if (!m) throw new Error(`时刻解析失败: ${text}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

function fmtHM(mins: number): string {
  const v = ((mins % 1440) + 1440) % 1440;
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}

function fmtHM24(mins: number): string {
  const v = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

function fmtDur(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} 分`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
}

const WEEK = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
const MONTH_LEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** 钟面分钟数 → 「3 点」/「3 点 25 分」，独立算一遍，不复用被测代码 */
function fmtFace(t: number): string {
  const v = ((t % 720) + 720) % 720;
  const h = Math.floor(v / 60) === 0 ? 12 : Math.floor(v / 60);
  const m = v % 60;
  return m === 0 ? `${h} 点` : `${h} 点 ${m} 分`;
}

/** 从一段 SVG 里读出钟面分钟数 */
function faceTime(svg: string): number {
  const m = svg.match(/data-t="(\d+)"/);
  if (!m) throw new Error(`钟面缺 data-t: ${svg.slice(0, 60)}`);
  return Number(m[1]);
}

/** 从一段 SVG 里读出时针末端坐标 */
function hourTip(svg: string): { x: number; y: number } {
  const m = svg.match(/data-clk-hand="hour" x1="50" y1="50" x2="([-\d.]+)" y2="([-\d.]+)"/);
  if (!m) throw new Error(`钟面缺时针: ${svg.slice(0, 60)}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

/** 「上午 10:40」/「下午 1:20」→ 一天内的分钟数 */
function parsePeriodHM(text: string): number {
  const m = text.match(/(上午|下午) (\d{1,2}):(\d{2})/);
  if (!m) throw new Error(`带上下午的时刻解析失败: ${text}`);
  const h12 = Number(m[2]) % 12;
  return (m[1] === "上午" ? h12 : h12 + 12) * 60 + Number(m[3]);
}

/** 「3 分 20 秒」/「45 秒」/「2 分」→ 秒数 */
function parseMinSec(text: string): number {
  const m = text.match(/(\d+)\s*分/);
  const s = text.match(/(\d+)\s*秒/);
  return (m ? Number(m[1]) * 60 : 0) + (s ? Number(s[1]) : 0);
}

function parseRoutine(text: string): Array<{ name: string; at: number }> {
  const out: Array<{ name: string; at: number }> = [];
  const re = /🗓️ ([^\s]+) (\d{2}):(\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ name: m[1], at: Number(m[2]) * 60 + Number(m[3]) });
  }
  return out;
}

function parseTrips(text: string): Array<{ no: number; dep: number; arr: number }> {
  const out: Array<{ no: number; dep: number; arr: number }> = [];
  const re = /(\d+) 号车 (\d{2}):(\d{2}) → (\d{2}):(\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({
      no: Number(m[1]),
      dep: Number(m[2]) * 60 + Number(m[3]),
      arr: Number(m[4]) * 60 + Number(m[5]),
    });
  }
  return out;
}

/** 逐题机器验算：从题面重新算一遍答案，对不上就是这一关不可解 */
function verify(q: ReturnType<typeof buildQuestions>[number], where: string): void {
  const text = strip(q.promptHTML);
  switch (q.kind) {
    case "span": {
      const m = text.match(/(\d{1,2}):(\d{2}) ➜ .*?(\d{1,2}):(\d{2})/);
      expect(m, where).not.toBeNull();
      const from = Number(m![1]) * 60 + Number(m![2]);
      const to = Number(m![3]) * 60 + Number(m![4]);
      expect(q.answer, where).toBe(fmtDur(((to - from) % 1440 + 1440) % 1440));
      break;
    }
    case "arrive": {
      const m = text.match(/(\d{1,2}):(\d{2}) 出发 · 走 (.+)$/);
      expect(m, where).not.toBeNull();
      expect(q.answer, where).toBe(fmtHM(Number(m![1]) * 60 + Number(m![2]) + parseDur(m![3])));
      break;
    }
    case "depart": {
      const m = text.match(/(\d{1,2}):(\d{2}) 到站 · 走 (.+)$/);
      expect(m, where).not.toBeNull();
      expect(q.answer, where).toBe(fmtHM(Number(m![1]) * 60 + Number(m![2]) - parseDur(m![3])));
      break;
    }
    case "h24": {
      const m = text.match(/(上午|下午) (\d{1,2}):(\d{2})/);
      expect(m, where).not.toBeNull();
      const h12 = Number(m![2]);
      const base = h12 === 12 ? 0 : h12;
      const h24 = m![1] === "上午" ? base : base + 12;
      expect(q.answer, where).toBe(fmtHM24(h24 * 60 + Number(m![3])));
      break;
    }
    case "h12": {
      const mins = parseHM(text);
      const h = Math.floor(mins / 60);
      const period = h < 12 ? "上午" : "下午";
      const hour = h % 12 === 0 ? 12 : h % 12;
      expect(q.answer, where).toBe(`${period} ${hour}:${String(mins % 60).padStart(2, "0")}`);
      break;
    }
    case "zone": {
      const m = text.match(/(\d{2}):(\d{2}) · (.+?) 比 (.+?) (早|晚) (\d+) 小时/);
      expect(m, where).not.toBeNull();
      const now = Number(m![1]) * 60 + Number(m![2]);
      const delta = (m![5] === "早" ? 1 : -1) * Number(m![6]);
      expect(q.answer, where).toBe(fmtHM24(now + delta * 60));
      // 问的必须是「另一座城」，方向不能搞反
      expect(q.ask, where).toContain(m![3]);
      expect(m![3], where).not.toBe(m![4]);
      break;
    }
    case "weekday": {
      const m = text.match(/(星期[一二三四五六日]) ＋ (\d+) 天/);
      expect(m, where).not.toBeNull();
      expect(q.answer, where).toBe(WEEK[(WEEK.indexOf(m![1]) + Number(m![2])) % 7]);
      break;
    }
    case "monthdays": {
      const m = text.match(/平年 (\d{1,2}) 月/);
      expect(m, where).not.toBeNull();
      expect(q.answer, where).toBe(`${MONTH_LEN[Number(m![1]) - 1]} 天`);
      break;
    }
    case "nthday": {
      const pm = text.match(/(\d{1,2}) 月 1 号是(星期[一二三四五六日])/);
      const am = q.ask.match(/第 (\d) 个(星期[一二三四五六日])是几号？/);
      expect(pm, where).not.toBeNull();
      expect(am, where).not.toBeNull();
      const first = WEEK.indexOf(pm![2]);
      const want = WEEK.indexOf(am![2]);
      const date = 1 + (((want - first) % 7) + 7) % 7 + (Number(am![1]) - 1) * 7;
      expect(date, where).toBeLessThanOrEqual(MONTH_LEN[Number(pm![1]) - 1]);
      expect(q.answer, where).toBe(`${date} 号`);
      break;
    }
    case "tableEarly": {
      const trips = parseTrips(text);
      expect(trips.length, where).toBe(3);
      const best = trips.reduce((a, b) => (b.arr < a.arr ? b : a));
      expect(new Set(trips.map((x) => x.arr)).size, where).toBe(3);
      expect(q.answer, where).toBe(`${best.no} 号车`);
      break;
    }
    case "tableFast": {
      const trips = parseTrips(text);
      expect(trips.length, where).toBe(3);
      const best = trips.reduce((a, b) => (b.arr - b.dep < a.arr - a.dep ? b : a));
      expect(new Set(trips.map((x) => x.arr - x.dep)).size, where).toBe(3);
      expect(q.answer, where).toBe(`${best.no} 号车`);
      break;
    }
    case "tableWait": {
      const trips = parseTrips(text);
      const now = parseHM(text.match(/现在 (\d{2}:\d{2})/)![1]);
      const no = Number(q.ask.match(/等 (\d+) 号车/)![1]);
      const target = trips.find((x) => x.no === no);
      expect(target, where).toBeDefined();
      expect(target!.dep - now, where).toBeGreaterThan(0);
      expect(q.answer, where).toBe(fmtDur(target!.dep - now));
      break;
    }
    // ---- 1.2 新增题型 ----
    case "readMin": {
      const t = faceTime(q.promptHTML);
      expect(q.answer, where).toBe(fmtFace(t));
      // 时针必须带着分针带动的那一点偏移，不许死死压在数字上
      const tip = hourTip(q.promptHTML);
      const rad = ((t * 0.5 - 90) * Math.PI) / 180;
      expect(tip.x, where).toBeCloseTo(50 + Math.cos(rad) * 21, 1);
      expect(tip.y, where).toBeCloseTo(50 + Math.sin(rad) * 21, 1);
      break;
    }
    case "setMin": {
      const label = q.ask.match(/「(.+)」/)![1];
      expect(q.answerText, where).toBe(label);
      const right = q.choices[q.correct];
      const t = faceTime(right);
      expect(fmtFace(t), where).toBe(label);
      // 正确钟面的时针联动到位；三张钟面里一定有一张是「时针压在数字上」的错钟面
      const rad = ((t * 0.5 - 90) * Math.PI) / 180;
      expect(hourTip(right).x, where).toBeCloseTo(50 + Math.cos(rad) * 21, 1);
      const stiffRad = (((t - (t % 60)) * 0.5 - 90) * Math.PI) / 180;
      const stiff = q.choices.some(
        (c) => faceTime(c) === t && Math.abs(hourTip(c).x - (50 + Math.cos(stiffRad) * 21)) < 0.05
      );
      expect(stiff, `${where}：缺少「时针压数字」的干扰钟面`).toBe(true);
      // 题面里那个能拖的钟面起点不能就是答案，否则孩子不用拨
      expect(q.promptHTML, where).toContain('data-clk-dial="1"');
      expect(faceTime(q.promptHTML), where).not.toBe(t);
      break;
    }
    case "spanNoon": {
      const parts = text.split("➜");
      expect(parts.length, where).toBe(2);
      const from = parsePeriodHM(parts[0]);
      const to = parsePeriodHM(parts[1]);
      expect(from, `${where}：出发必须在中午之前`).toBeLessThan(12 * 60);
      expect(to, `${where}：到达必须在中午之后`).toBeGreaterThan(12 * 60);
      expect(q.answer, where).toBe(fmtDur(to - from));
      break;
    }
    case "unitHM": {
      const only = text.match(/^⏳ (\d+) 分$/);
      if (only) {
        expect(q.answer, where).toBe(fmtDur(Number(only[1])));
      } else {
        expect(q.answer, where).toBe(`${parseDur(text)} 分`);
      }
      break;
    }
    case "unitMS": {
      const only = text.match(/^⏱️ (\d+) 秒$/);
      if (only) {
        const total = Number(only[1]);
        expect(q.answer, where).toBe(total % 60 === 0 ? `${total / 60} 分` : `${Math.floor(total / 60)} 分 ${total % 60} 秒`);
      } else {
        expect(q.answer, where).toBe(`${parseMinSec(text)} 秒`);
      }
      break;
    }
    case "unitMix": {
      const days = text.match(/📆 (\d+) 天/);
      if (days) expect(q.answer, where).toBe(`${Number(days[1]) * 24} 小时`);
      else expect(q.answer, where).toBe(`${parseDur(text) * 60} 秒`);
      break;
    }
    case "routine": {
      const rows = parseRoutine(text);
      expect(rows.length, where).toBe(5);
      for (let i = 1; i < rows.length; i++) expect(rows[i].at, where).toBeGreaterThan(rows[i - 1].at);
      expect(new Set(rows.map((r) => r.name)).size, where).toBe(5);
      const gap = q.ask.match(/^从(.+?)到(.+?)隔多久？$/);
      if (gap) {
        const a = rows.find((r) => r.name === gap[1])!;
        const b = rows.find((r) => r.name === gap[2])!;
        expect(a, where).toBeDefined();
        expect(b, where).toBeDefined();
        expect(b.at - a.at, where).toBeGreaterThan(0);
        expect(q.answer, where).toBe(fmtDur(b.at - a.at));
      } else {
        const m = q.ask.match(/^(.+?)之后紧接着是什么？$/);
        expect(m, where).not.toBeNull();
        const at = rows.findIndex((r) => r.name === m![1]);
        expect(at, where).toBeGreaterThanOrEqual(0);
        expect(at, where).toBeLessThan(rows.length - 1);
        expect(q.answer, where).toBe(rows[at + 1].name);
      }
      break;
    }
    default:
      throw new Error(`${where}：第 100–188 关不该出现旧题型 ${q.kind}`);
  }
}

describe("时钟小屋 · 1.1 第 100–188 关", () => {
  it("前 99 关章节切分与 1.0 完全一致（回归）", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => ({ name: c.name, size: c.size }))).toEqual(LEGACY_CHAPTER_SNAPSHOT);
    expect(CHAPTERS.slice(0, 6).reduce((s, c) => s + c.size, 0)).toBe(99);
  });

  it("末尾追加 4 个全新章节共 89 关，总数正好 188", () => {
    const extra = CHAPTERS.slice(6);
    expect(extra).toHaveLength(4);
    expect(extra.reduce((s, c) => s + c.size, 0)).toBe(89);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(CHAPTERS.length);
  });

  it("新章节都配齐了 emoji、粉彩色和一句话介绍", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.size).toBeGreaterThan(0);
    }
  });

  it("前 99 关的题量与题型池不受扩容影响（按 1.0 公式回归）", () => {
    const legacySizes = [17, 17, 17, 16, 16, 16];
    let start = 0;
    legacySizes.forEach((size, ci) => {
      for (let i = 0; i < size; i++) {
        const level = start + i;
        const t = i / Math.max(1, size - 1);
        expect(questionCount(level)).toBe(4 + Math.min(3, Math.floor(t * 3.6)));
        const expected =
          ci <= 3 ? ["read"]
            : ci === 4 ? (t < 0.6 ? ["set"] : ["set", "read"])
              : t < 0.4 ? ["read", "set"] : ["read", "set", "next"];
        expect(kindPool(level)).toEqual(expected);
      }
      start += size;
    });
    expect(start).toBe(99);
  });

  it("第 100–188 关逐关合法：题量 6–10、3 个唯一选项、正确项即答案", () => {
    for (const level of NEW_LEVELS) {
      const qs = buildQuestions(level);
      expect(qs.length, `第 ${level + 1} 关`).toBe(questionCount(level));
      expect(qs.length).toBeGreaterThanOrEqual(6);
      expect(qs.length).toBeLessThanOrEqual(10);
      for (const q of qs) {
        expect(q.choices.length, `第 ${level + 1} 关`).toBe(3);
        expect(new Set(q.choices).size, `第 ${level + 1} 关`).toBe(3);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(3);
        expect(q.choices[q.correct], `第 ${level + 1} 关`).toBe(q.answer);
        expect(ADVANCED_KINDS.has(q.kind)).toBe(true);
      }
    }
  });

  it("第 100–188 关逐关可解：每道题都能从题面重新算出答案", () => {
    let checked = 0;
    for (const level of NEW_LEVELS) {
      for (const q of buildQuestions(level)) {
        verify(q, `第 ${level + 1} 关 · ${q.kind}`);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(600);
  });

  it("出发到达站：出发 / 到达 / 时长三种问法都出现过且互相自洽", () => {
    const kinds = new Set<string>();
    for (let level = 99; level < 122; level++) {
      for (const q of buildQuestions(level)) kinds.add(q.kind);
    }
    expect(kinds.has("span")).toBe(true);
    expect(kinds.has("arrive")).toBe(true);
    expect(kinds.has("depart")).toBe(true);
    // 同一段行程正着算和倒着算必须闭合
    for (const level of [99, 108, 121]) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "arrive") continue;
        const m = strip(q.promptHTML).match(/(\d{1,2}):(\d{2}) 出发 · 走 (.+)$/)!;
        const start = Number(m[1]) * 60 + Number(m[2]);
        const dur = parseDur(m[3]);
        expect(dur).toBeGreaterThan(0);
        expect(fmtHM(start + dur)).toBe(q.answer);
        expect(fmtHM(parseHM(q.answer) - dur)).toBe(fmtHM(start));
      }
    }
  });

  it("廿四时钟塔：24 小时制互换与跨城对表都覆盖到了", () => {
    const kinds = new Set<string>();
    for (let level = 122; level < 144; level++) {
      for (const q of buildQuestions(level)) kinds.add(q.kind);
    }
    expect(kinds.has("h24")).toBe(true);
    expect(kinds.has("h12")).toBe(true);
    expect(kinds.has("zone")).toBe(true);
    // 24 小时制答案一律是补零的 00:00–23:59
    for (let level = 122; level < 144; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind === "h24" || q.kind === "zone") {
          expect(q.answer).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
        }
        if (q.kind === "h12") expect(q.answer).toMatch(/^(上午|下午) ([1-9]|1[0-2]):[0-5]\d$/);
      }
    }
  });

  it("星期日历屋：星期推算 / 平年月份天数 / 第 n 个星期几都覆盖到了", () => {
    const kinds = new Set<string>();
    for (let level = 144; level < 166; level++) {
      for (const q of buildQuestions(level)) kinds.add(q.kind);
    }
    expect(kinds.has("weekday")).toBe(true);
    expect(kinds.has("monthdays")).toBe(true);
    expect(kinds.has("nthday")).toBe(true);
    for (let level = 144; level < 166; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind === "weekday") expect(WEEK).toContain(q.answer);
        if (q.kind === "monthdays") expect(["28 天", "29 天", "30 天", "31 天"]).toContain(q.answer);
      }
    }
  });

  it("时刻表车站：最早到 / 最快 / 候车时长的答案都唯一", () => {
    const kinds = new Set<string>();
    for (let level = 166; level < 188; level++) {
      for (const q of buildQuestions(level)) kinds.add(q.kind);
    }
    expect(kinds.has("tableEarly")).toBe(true);
    expect(kinds.has("tableFast")).toBe(true);
    expect(kinds.has("tableWait")).toBe(true);
    for (let level = 166; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        if (!q.kind.startsWith("table")) continue;
        const trips = parseTrips(strip(q.promptHTML));
        expect(trips).toHaveLength(3);
        for (const trip of trips) expect(trip.arr).toBeGreaterThan(trip.dep);
        expect(new Set(trips.map((x) => x.no)).size).toBe(3);
      }
    }
  });

  it("引入了前 99 关没有的新机制（时长计算 / 24 小时制 / 日历 / 时刻表）", () => {
    const legacy = new Set<string>();
    for (let level = 0; level < 99; level++) for (const q of buildQuestions(level)) legacy.add(q.kind);
    const fresh = new Set<string>();
    for (const level of NEW_LEVELS) for (const q of buildQuestions(level)) fresh.add(q.kind);
    for (const k of legacy) expect(fresh.has(k)).toBe(false);
    expect(fresh.size).toBeGreaterThanOrEqual(2);
    expect([...fresh].every((k) => ADVANCED_KINDS.has(k))).toBe(true);
  });

  it("第 100–188 关明显更长：题量比前 99 关多", () => {
    expect(questionCount(121)).toBe(10);
    expect(questionCount(187)).toBe(10);
    const legacyMax = Math.max(...Array.from({ length: 99 }, (_, i) => questionCount(i)));
    const freshMin = Math.min(...NEW_LEVELS.map((i) => questionCount(i)));
    expect(legacyMax).toBe(7);
    expect(freshMin).toBe(6);
    // 章节起点略缓一点，但整体明显更长
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(NEW_LEVELS.map((i) => questionCount(i)))).toBeGreaterThan(
      avg(Array.from({ length: 99 }, (_, i) => questionCount(i)))
    );
  });

  it("第 100–188 关同一关重试题目一致（确定性生成）", () => {
    for (const level of [99, 121, 122, 139, 144, 165, 166, 187]) {
      expect(JSON.stringify(buildQuestions(level))).toBe(JSON.stringify(buildQuestions(level)));
    }
  });

  it("引导语依旧口语化：全部 188 关的 ask 都不超过 15 个汉字", () => {
    for (let level = 0; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        expect((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length, `第 ${level + 1} 关：${q.ask}`).toBeLessThanOrEqual(15);
      }
    }
  });

  it("文案零商标：题面与选项里没有英文字母（城市名全是原创中文）", () => {
    for (const level of NEW_LEVELS) {
      for (const q of buildQuestions(level)) {
        // 钟面是 SVG,标签名与属性名当然是英文;只看渲染出来的文字
        expect(strip(q.promptHTML)).not.toMatch(/[A-Za-z]/);
        expect(q.ask).not.toMatch(/[A-Za-z]/);
        for (const c of q.choices) expect(strip(c)).not.toMatch(/[A-Za-z]/);
      }
    }
  });

  it("四个新章节的题型池互不相同", () => {
    const sigs = new Set([110, 133, 155, 180].map((i) => kindPool(i).slice().sort().join(",")));
    expect(sigs.size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 1.2：题型补齐到 8 类、难度表驱动、错题回顾，以及「前 99 关一个字都没改」的锁
// ---------------------------------------------------------------------------

/**
 * 1.1 收尾时前 99 关全部题目的摘要。
 * 这一串是本步动代码之前从 `origin/game-1.2-window5` 上跑出来的，
 * 只要它对得上，就说明第 1–99 关的题面、选项、正确项一个字节都没被 1.2 碰过。
 */
const LEGACY_DIGEST = "5a314feb42c6eb7f65c23ccf5b08d08a0f9a4a2804193fd0d2c7933ad37296cf";

/**
 * 窗口5 第1轮改了钟面的一个读屏属性（W5-A-01：`aria-label` 原本直接就是答案），
 * 顺手补了 `role="img"`。孩子看得见的题面、选项、正确项一个字节都没动。
 *
 * 摘要锁不放水：这里把标签按钟面自己的 `data-h` / `data-q` 还原成 1.1 的写法、
 * 去掉新加的 `role`，还原完的字节流必须和 1.1 的摘要**一模一样**——
 * 也就是说这一条仍然钉着「除了那个读屏属性，前 99 关没有第二处改动」。
 */
function asLegacyHtml(html: string): string {
  return html.replace(
    /(<svg data-h="(\d+)" data-q="(\d)"[^>]*?) role="img" aria-label="[^"]*"(>)/g,
    (_all, head: string, h: string, q: string, tail: string) =>
      `${head} aria-label="${formatClock(Number(h), Number(q) as Quarter)}"${tail}`
  );
}

const FRESH_KINDS = ["readMin", "setMin", "spanNoon", "unitHM", "unitMS", "unitMix", "routine"];

describe("时钟小屋 · 1.2 前 99 关一个字都没改", () => {
  it("第 1–99 关全部题目的摘要和 1.1 逐字节一致（还原读屏标签后）", () => {
    const all = Array.from({ length: 99 }, (_, i) =>
      buildQuestions(i).map((q) => ({
        ...q,
        promptHTML: asLegacyHtml(q.promptHTML),
        choices: q.choices.map(asLegacyHtml),
      }))
    );
    const digest = createHash("sha256").update(JSON.stringify(all)).digest("hex");
    expect(digest, "前 99 关的题目被改动了").toBe(LEGACY_DIGEST);
  });

  it("前 99 关的钟面确实换上了不含时刻的读屏标签", () => {
    let faces = 0;
    for (let level = 0; level < 99; level++) {
      for (const q of buildQuestions(level)) {
        for (const html of [q.promptHTML, ...q.choices]) {
          for (const m of html.matchAll(/aria-label="([^"]*)"/g)) {
            faces++;
            expect(/\d/.test(m[1]), `第 ${level + 1} 关的钟面标签带时刻：${m[1]}`).toBe(false);
          }
        }
      }
    }
    expect(faces).toBeGreaterThan(300);
  });

  it("第 1–99 关只出 1.0 的三种老题型，一道 1.2 新题都没混进去", () => {
    for (let level = 0; level < 99; level++) {
      for (const q of buildQuestions(level)) {
        expect(["read", "set", "next"], `第 ${level + 1} 关混进了 ${q.kind}`).toContain(q.kind);
        expect(q.answerText, `第 ${level + 1} 关的老题型不该多出字段`).toBeUndefined();
      }
    }
  });

  it("kindPool 在前 99 关就是老阶梯，第 100 关起才换成难度表", () => {
    for (let level = 0; level < 99; level++) {
      expect(kindPool(level)).toEqual(legacyKindPool(level));
    }
    for (let level = 99; level < 188; level++) {
      expect(kindPool(level), `第 ${level + 1} 关`).toHaveLength(questionCount(level));
    }
  });
});

describe("时钟小屋 · 1.2 八类题型", () => {
  it("八类核心题型在 188 关里每一类都真的出过题", () => {
    const seen = new Set<string>();
    for (let level = 0; level < 188; level++) for (const q of buildQuestions(level)) seen.add(typeOfKind(q.kind));
    for (const type of CORE_CLOCK_TYPES) expect(seen.has(type), `${type} 一次都没出现`).toBe(true);
  });

  it("1.2 新加的七个种类都在第 100 关之后出过题", () => {
    const seen = new Set<string>();
    for (let level = 99; level < 188; level++) for (const q of buildQuestions(level)) seen.add(q.kind);
    for (const kind of FRESH_KINDS) expect(seen.has(kind), `${kind} 一次都没出现`).toBe(true);
  });

  it("读钟面读到一分：不是只出五分刻度的整数格", () => {
    const minutes = new Set<number>();
    for (let level = 99; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "readMin") continue;
        minutes.add(faceTime(q.promptHTML) % 60);
      }
    }
    expect(minutes.size).toBeGreaterThan(10);
    expect([...minutes].some((m) => m % 5 !== 0), "一分刻度的题一道都没有").toBe(true);
    expect([...minutes].some((m) => m % 5 === 0), "五分刻度的题一道都没有").toBe(true);
  });

  it("经过时间既有跨小时的，也有跨中午的", () => {
    let overHour = 0;
    let overNoon = 0;
    for (let level = 99; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind === "span" && parseDur(q.answer) > 60) overHour++;
        if (q.kind !== "spanNoon") continue;
        const parts = strip(q.promptHTML).split("➜");
        expect(parsePeriodHM(parts[0])).toBeLessThan(12 * 60);
        expect(parsePeriodHM(parts[1])).toBeGreaterThan(12 * 60);
        overNoon++;
      }
    }
    expect(overHour, "跨小时的经过时间太少").toBeGreaterThan(20);
    expect(overNoon, "跨中午的经过时间一道都没有").toBeGreaterThan(10);
  });

  it("时分秒换算逐题验算：进率一处都不能错", () => {
    let checked = 0;
    for (let level = 99; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        if (!q.kind.startsWith("unit")) continue;
        verify(q, `第 ${level + 1} 关 · ${q.kind}`);
        checked++;
      }
    }
    expect(checked, "单位换算题太少").toBeGreaterThan(30);
  });

  it("时区题只做「北京 + N」这种直观的，方向不会搞反", () => {
    let checked = 0;
    for (let level = 99; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "zone") continue;
        const text = strip(q.promptHTML);
        expect(text, `第 ${level + 1} 关`).toContain("北京时间");
        const m = text.match(/(.+?) 比 北京 (早|晚) (\d+) 小时/)!;
        expect(m).not.toBeNull();
        expect(m[1]).not.toBe("北京");
        expect(Number(m[3])).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("作息表逐张验：五行时刻严格递增，事项不重样，答案唯一", () => {
    let checked = 0;
    for (let level = 99; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "routine") continue;
        verify(q, `第 ${level + 1} 关 · 作息表`);
        checked++;
      }
    }
    expect(checked, "作息表题太少").toBeGreaterThan(15);
  });

  it("拨指针题一定给了一张「时针压在数字上」的错钟面，且练手钟面不是答案", () => {
    let checked = 0;
    for (let level = 99; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "setMin") continue;
        verify(q, `第 ${level + 1} 关 · 拨指针`);
        checked++;
      }
    }
    expect(checked, "拨指针题太少").toBeGreaterThan(5);
  });
});

describe("时钟小屋 · 1.2 错题回顾", () => {
  it("答错什么就回顾什么：题型一一对上，最多四道", () => {
    for (const level of [0, 50, 99, 130, 187]) {
      const kinds = [...new Set(buildQuestions(level).map((q) => q.kind))];
      const review = makeReviewQuestions(kinds, level);
      expect(review.length).toBe(Math.min(kinds.length, MAX_REVIEW_QUESTIONS));
      review.forEach((q, i) => expect(q.kind, `第 ${level + 1} 关第 ${i + 1} 道回顾题`).toBe(kinds[i]));
    }
    expect(makeReviewQuestions([], 10)).toEqual([]);
  });

  it("回顾题是「换个数字的同类题」：题面和原题不一样，也不会把原答案端出来", () => {
    let compared = 0;
    for (let level = 0; level < 188; level += 7) {
      const original = buildQuestions(level);
      const kinds = [...new Set(original.map((q) => q.kind))];
      const review = makeReviewQuestions(kinds, level, 0, original.map((q) => q.promptHTML));
      for (const q of review) {
        const sameKind = original.filter((o) => o.kind === q.kind);
        const identical = sameKind.filter((o) => o.promptHTML === q.promptHTML && o.ask === q.ask);
        expect(identical, `第 ${level + 1} 关的 ${q.kind} 回顾题和原题一模一样`).toHaveLength(0);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(40);
  });

  it("回顾题一样是三个唯一选项、正确项就是答案，重开一次结果不变", () => {
    for (const level of [12, 105, 150, 187]) {
      const kinds = [...new Set(buildQuestions(level).map((q) => q.kind))];
      const review = makeReviewQuestions(kinds, level);
      expect(review.length).toBeGreaterThan(0);
      for (const q of review) {
        expect(q.choices).toHaveLength(3);
        expect(new Set(q.choices).size).toBe(3);
        expect(q.choices[q.correct]).toContain(q.answer);
      }
      expect(JSON.stringify(makeReviewQuestions(kinds, level))).toBe(JSON.stringify(review));
      // 换一轮种子就换一批题，连着错两次不会看到同一道
      expect(JSON.stringify(makeReviewQuestions(kinds, level, 1))).not.toBe(JSON.stringify(review));
      expect(reviewSeed(level, 0)).not.toBe(reviewSeed(level, 1));
    }
  });

  it("回顾轮的种子和正题错开，绝不会撞成同一批题", () => {
    const seeds = new Set<number>();
    for (let level = 0; level < 188; level++) {
      for (const round of [0, 1, 2]) seeds.add(reviewSeed(level, round));
      expect(reviewSeed(level)).not.toBe(8500 + level * 7919);
    }
    expect(seeds.size).toBe(188 * 3);
  });
});

describe("时钟小屋 · 1.2 模式矩阵", () => {
  it("每一关都能列出它考的题型，全 188 关一关不落", () => {
    for (let level = 0; level < 188; level++) {
      const types = typesOfLevel(level);
      expect(types.length, `第 ${level + 1} 关一个题型都没有`).toBeGreaterThan(0);
      for (const t of types) expect(CORE_CLOCK_TYPES.concat(["calendar"])).toContain(t);
    }
  });

  it("学习类只做闯关：188 关一关不少，题量还是 4–10 道", () => {
    expect(LEVELS).toHaveLength(188);
    for (let level = 0; level < 188; level++) {
      const n = questionCount(level);
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(10);
      expect(buildQuestions(level)).toHaveLength(n);
    }
  });
});
