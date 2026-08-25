// 时钟小屋：99 关 · 六层小屋章节题库生成（一年级认时间，确定性可测试）
import { mulberry32, pick, randInt, shuffled, chapterOf, indexInChapter, type Chapter } from "../level99";
import type { QuizQuestion, QuizTheme } from "../quiz99";
import { formatClock, hourHandAngle, minuteHandAngle, type Quarter } from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "整点钟楼", emoji: "🕐", color: "#ffe8cc", desc: "分针指 12，就是整点", size: 17 },
  { name: "半点小屋", emoji: "🕜", color: "#d3f9d8", desc: "分针指 6，就是几点半", size: 17 },
  { name: "一刻花园", emoji: "🌷", color: "#ffdeeb", desc: "分针指 3，就是 1 刻", size: 17 },
  { name: "三刻广场", emoji: "⛲", color: "#d0f0fd", desc: "分针指 9，三刻登场", size: 16 },
  { name: "拨针工坊", emoji: "🔧", color: "#fff3bf", desc: "反过来：听时间找钟面", size: 16 },
  { name: "时间冒险家", emoji: "🧭", color: "#e5dbff", desc: "混合挑战 + 再过几小时", size: 16 },
];

export const CHAPTER_THEMES: QuizTheme[] = [
  { bg: "linear-gradient(#fff4e6,#ffe8cc)", accent: "#d9480f" },
  { bg: "linear-gradient(#e3fafc,#d3f9d8)", accent: "#2b8a3e" },
  { bg: "linear-gradient(#fff0f6,#ffdeeb)", accent: "#c2255c" },
  { bg: "linear-gradient(#e7f5ff,#d0f0fd)", accent: "#1971c2" },
  { bg: "linear-gradient(#fff9db,#fff3bf)", accent: "#e8590c" },
  { bg: "linear-gradient(#f3f0ff,#e5dbff)", accent: "#6741d9" },
];

/** 画一个钟面 SVG（data-h / data-q 供测试与判定） */
export function clockSVG(hour: number, quarter: Quarter, size: number): string {
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
  return `<svg data-h="${hour}" data-q="${quarter}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-label="${formatClock(hour, quarter)}">
    <circle cx="${cx}" cy="${cy}" r="46" fill="#fff" stroke="#845ef7" stroke-width="5"/>
    ${ticks}
    <line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(hA) * 20).toFixed(1)}" y2="${(cy + Math.sin(hA) * 20).toFixed(1)}" stroke="#e8590c" stroke-width="6" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(mA) * 30).toFixed(1)}" y2="${(cy + Math.sin(mA) * 30).toFixed(1)}" stroke="#1971c2" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="3.4" fill="#5c4a7d"/>
  </svg>`;
}

export type ClockKind = "read" | "set" | "next";

export interface ClockQ extends QuizQuestion {
  kind: ClockKind;
  answer: string;
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
    choices: order.map((f) => clockSVG(f.h, f.q, 82)),
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

/** 每关题目数：章节内 4 → 7 题递增 */
export function questionCount(level: number): number {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  return 4 + Math.min(3, Math.floor(t * 3.6));
}

export function kindPool(level: number): ClockKind[] {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  if (ci <= 3) return ["read"];
  if (ci === 4) return t < 0.6 ? ["set"] : ["set", "read"];
  return t < 0.4 ? ["read", "set"] : ["read", "set", "next"];
}

/** 生成某一关的全部题目（确定性，重试不换题） */
export function buildQuestions(level: number): ClockQ[] {
  const rand = mulberry32(8500 + level * 7919);
  const quarters = allowedQuarters(level);
  const kinds = kindPool(level);
  const count = questionCount(level);
  const out: ClockQ[] = [];
  for (let i = 0; i < count; i++) {
    const kind = i < kinds.length ? kinds[i] : pick(rand, kinds);
    if (kind === "read") out.push(qRead(rand, quarters));
    else if (kind === "set") out.push(qSet(rand, quarters));
    else out.push(qNext(rand));
  }
  return shuffled(out, rand);
}

/** 99 关概览（测试用） */
export const LEVELS = Array.from({ length: 99 }, (_, i) => ({
  count: questionCount(i),
  kinds: kindPool(i),
  quarters: allowedQuarters(i),
}));
