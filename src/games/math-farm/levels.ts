// 算数小农场：188 关 · 十大农场章节题库生成（20 以内加减 → 六年级全套）
//
// 1.1 起总关数 99 → 188：前 99 关（前 6 章）的章节切分、seed、生成参数逐字未动。
// 1.2 把第 100–188 关的出题换成「难度权重表（kinds.ts）+ 生成器与校验器（gen.ts）」那一套，
// 题型从 7 种补到 14 种（竖式 / 通分 / 小数乘除 / 百分数 / 比与比例 / 方程 / 找规律），
// 干扰项一律来自典型错误。前 99 关的代码路径一行都没动。
import { TOTAL_LEVELS, mulberry32, pick, randInt, shuffled, chapterOf, indexInChapter, type Chapter } from "../level99";
import type { QuizTheme } from "../quiz99";
import { makeAdvanced, type MathQ } from "./gen";
import {
  KINDS_BY_TYPE,
  hardnessOf,
  tableKinds,
  typeOfKind,
  type AdvancedMathKind,
  type LegacyMathKind,
  type MathKind,
  type MathType,
} from "./kinds";

/** 1.0 时代的章节数：下标 < 这个数的章节一律保持原样 */
export const LEGACY_CHAPTER_COUNT = 6;

export const CHAPTERS: Chapter[] = [
  { name: "青青牧场", emoji: "🐮", color: "#d3f9d8", desc: "数一数 + 5 以内加减法", size: 17 },
  { name: "甜甜果园", emoji: "🍎", color: "#ffe8cc", desc: "10 以内加减法", size: 17 },
  { name: "叮咚池塘", emoji: "🦆", color: "#d0f0fd", desc: "20 以内不进位不退位 + 填空", size: 17 },
  { name: "彩虹麦田", emoji: "🌈", color: "#fff3bf", desc: "凑十法：进位加法闯关", size: 16 },
  { name: "星星谷仓", emoji: "⭐", color: "#e5dbff", desc: "破十法：退位减法 + 比大小", size: 16 },
  { name: "月光农庄", emoji: "🌙", color: "#ffdeeb", desc: "连加连减混合大挑战", size: 16 },
  // ↓ 1.1 新增：第 100–188 关（1.2 把每一章的内容都补厚了，章节切分没动）
  { name: "丰收乘法坊", emoji: "✖️", color: "#ffe9d6", desc: "两位数乘一位数、整十数除法，还有竖式的进位与退位", size: 23 },
  { name: "余数磨坊", emoji: "🌾", color: "#fff4d6", desc: "分不完怎么办：带余除法、竖式与找规律", size: 22 },
  { name: "分数果酱铺", emoji: "🍯", color: "#ffe9f0", desc: "通分与约分、小数四则，还有百分数和打折", size: 22 },
  { name: "括号谷仓", emoji: "🧺", color: "#e3f0ff", desc: "混合运算、比与比例、简单方程和三类应用题", size: 22 },
];

export const CHAPTER_THEMES: QuizTheme[] = [
  { bg: "linear-gradient(#c9ecff 0 42%,#b7e8a4 42% 100%)", accent: "#2b8a3e" },
  { bg: "linear-gradient(#ffe9c7 0 42%,#c9e8a4 42% 100%)", accent: "#d9480f" },
  { bg: "linear-gradient(#c5f0ff 0 42%,#a4d8e8 42% 100%)", accent: "#1971c2" },
  { bg: "linear-gradient(#fff3bf 0 42%,#ffe28a 42% 100%)", accent: "#e8590c" },
  { bg: "linear-gradient(#e5dbff 0 42%,#c8b8f0 42% 100%)", accent: "#6741d9" },
  { bg: "linear-gradient(#2b2a5e 0 42%,#4a3f8f 42% 100%)", accent: "#f783ac" },
  { bg: "linear-gradient(#ffe9d6 0 42%,#f7cba4 42% 100%)", accent: "#c2410c" },
  { bg: "linear-gradient(#fff4d6 0 42%,#ecd9a0 42% 100%)", accent: "#a16207" },
  { bg: "linear-gradient(#ffe9f0 0 42%,#f2c2d6 42% 100%)", accent: "#b03060" },
  { bg: "linear-gradient(#e3f0ff 0 42%,#bcd6f5 42% 100%)", accent: "#1e40af" },
];

/** 每章「数一数」用的小动物 / 小物件 */
const COUNT_EMOJIS: string[][] = [
  ["🐮", "🐑", "🐷"],
  ["🍎", "🍐", "🍊"],
  ["🦆", "🐸", "🐟"],
  ["🌾", "🌻", "🐝"],
  ["⭐", "🌟", "✨"],
  ["🌙", "🦉", "🍄"],
];
const COUNT_NAMES: string[][] = [
  ["小牛", "小羊", "小猪"],
  ["苹果", "梨子", "橘子"],
  ["小鸭", "青蛙", "小鱼"],
  ["麦穗", "向日葵", "小蜜蜂"],
  ["星星", "亮星星", "小星光"],
  ["月亮", "猫头鹰", "蘑菇"],
];

// 题型分类与出题参数都搬进了 kinds.ts / gen.ts，这里只做转发，老的 import 路径继续可用
export type { AdvancedMathKind, LegacyMathKind, MathKind } from "./kinds";
export type { MathQ, MathSpec } from "./gen";

function numChoices(rand: () => number, answer: number, max: number): { choices: string[]; correct: number } {
  const set = new Set<number>([answer]);
  let guard = 0;
  while (set.size < 3 && guard++ < 60) {
    const near = answer + randInt(rand, -3, 3);
    if (near >= 0 && near <= max && near !== answer) set.add(near);
  }
  while (set.size < 3) set.add(set.size);
  const arr = shuffled([...set], rand);
  return { choices: arr.map(String), correct: arr.indexOf(answer) };
}

function qCount(rand: () => number, ci: number, maxN: number): MathQ {
  const which = randInt(rand, 0, COUNT_EMOJIS[ci].length - 1);
  const emoji = COUNT_EMOJIS[ci][which];
  const name = COUNT_NAMES[ci][which];
  const n = randInt(rand, 2, maxN);
  const row = Array.from({ length: n }, () => emoji).join(" ");
  const { choices, correct } = numChoices(rand, n, maxN + 3);
  return {
    kind: "count", answer: n,
    promptHTML: `<span style="font-size:30px;letter-spacing:2px;line-height:1.5">${row}</span>`,
    ask: `数一数，一共有几${which === 0 && ci === 0 ? "头" : "个"}${name}？`,
    choices, correct,
  };
}

function qAdd(rand: () => number, maxSum: number, minSum = 1): MathQ {
  let a = 0, b = 0;
  do {
    a = randInt(rand, 0, maxSum);
    b = randInt(rand, 0, maxSum - a);
  } while (a + b < minSum || (a === 0 && b === 0));
  const { choices, correct } = numChoices(rand, a + b, maxSum + 3);
  return {
    kind: "add", answer: a + b,
    promptHTML: `${a} + ${b} = ?`,
    ask: "算一算，等于几？",
    choices, correct,
  };
}

function qSub(rand: () => number, max: number): MathQ {
  const a = randInt(rand, 1, max);
  const b = randInt(rand, 0, a);
  const { choices, correct } = numChoices(rand, a - b, max);
  return {
    kind: "sub", answer: a - b,
    promptHTML: `${a} - ${b} = ?`,
    ask: "算一算，还剩几？",
    choices, correct,
  };
}

/** 20 以内不进位加法 / 不退位减法 */
function qNoCarry(rand: () => number): MathQ {
  if (rand() < 0.5) {
    let a = 0, b = 0;
    do {
      a = randInt(rand, 10, 19);
      b = randInt(rand, 1, 9);
    } while ((a % 10) + b >= 10 || a + b > 20);
    const { choices, correct } = numChoices(rand, a + b, 20);
    return { kind: "add", answer: a + b, promptHTML: `${a} + ${b} = ?`, ask: "个位加个位，等于几？", choices, correct };
  }
  let a = 0, b = 0;
  do {
    a = randInt(rand, 11, 20);
    b = randInt(rand, 1, 9);
  } while (a % 10 < b);
  const { choices, correct } = numChoices(rand, a - b, 20);
  return { kind: "sub", answer: a - b, promptHTML: `${a} - ${b} = ?`, ask: "个位减个位，还剩几？", choices, correct };
}

/** 进位加法（凑十法，和 11..20） */
function qCarryAdd(rand: () => number): MathQ {
  let a = 0, b = 0;
  do {
    a = randInt(rand, 5, 9);
    b = randInt(rand, 2, 9);
  } while (a + b < 11 || a + b > 20);
  const { choices, correct } = numChoices(rand, a + b, 20);
  return { kind: "add", answer: a + b, promptHTML: `${a} + ${b} = ?`, ask: `先凑成 10，再加剩下的～`, choices, correct };
}

/** 退位减法（破十法，被减数 11..18） */
function qBorrowSub(rand: () => number): MathQ {
  let a = 0, b = 0;
  do {
    a = randInt(rand, 11, 18);
    b = randInt(rand, 2, 9);
  } while (a % 10 >= b);
  const { choices, correct } = numChoices(rand, a - b, 20);
  return { kind: "sub", answer: a - b, promptHTML: `${a} - ${b} = ?`, ask: "先从 10 里减，再加个位～", choices, correct };
}

/** 填空题：a + ⬜ = c 或 ⬜ + b = c 或 a - ⬜ = c */
function qMissing(rand: () => number, max: number, carry: boolean): MathQ {
  let a: number, b: number;
  if (carry) {
    do {
      a = randInt(rand, 5, 9);
      b = randInt(rand, 2, 9);
    } while (a + b < 11 || a + b > 20);
  } else {
    a = randInt(rand, 1, max - 1);
    b = randInt(rand, 1, max - a);
  }
  const sum = a + b;
  const form = randInt(rand, 0, 2);
  let promptHTML: string;
  let answer: number;
  if (form === 0) {
    promptHTML = `${a} + <span style="color:#e8590c">⬜</span> = ${sum}`;
    answer = b;
  } else if (form === 1) {
    promptHTML = `<span style="color:#e8590c">⬜</span> + ${b} = ${sum}`;
    answer = a;
  } else {
    promptHTML = `${sum} - <span style="color:#e8590c">⬜</span> = ${a}`;
    answer = b;
  }
  const { choices, correct } = numChoices(rand, answer, Math.max(max, sum));
  return { kind: "missing", answer, promptHTML, ask: "⬜ 里应该填几？", choices, correct };
}

/** 比大小：左右两个数或算式，选 > < = */
function qCompare(rand: () => number, max: number, useExpr: boolean): MathQ {
  let leftText: string;
  let leftVal: number;
  if (useExpr) {
    const a = randInt(rand, 2, max - 1);
    const b = randInt(rand, 1, Math.min(9, max - a));
    if (rand() < 0.5) {
      leftText = `${a} + ${b}`;
      leftVal = a + b;
    } else {
      leftText = `${a + b} - ${b}`;
      leftVal = a;
    }
  } else {
    leftVal = randInt(rand, 0, max);
    leftText = String(leftVal);
  }
  let rightVal = leftVal + randInt(rand, -3, 3);
  rightVal = Math.max(0, Math.min(max, rightVal));
  const answer = leftVal > rightVal ? "＞" : leftVal < rightVal ? "＜" : "＝";
  const arr = shuffled(["＞", "＜", "＝"], rand);
  return {
    kind: "compare", answer,
    promptHTML: `${leftText} <span style="color:#e8590c">○</span> ${rightVal}`,
    ask: "○ 里应该填哪个符号？",
    choices: arr, correct: arr.indexOf(answer),
  };
}

/** 连加连减：a ± b ± c，中间结果与最终结果都在 0..20 */
function qChain(rand: () => number): MathQ {
  for (;;) {
    const a = randInt(rand, 2, 10);
    const b = randInt(rand, 1, 9);
    const c = randInt(rand, 1, 9);
    const op1 = rand() < 0.6 ? "+" : "-";
    const op2 = rand() < 0.5 ? "+" : "-";
    const mid = op1 === "+" ? a + b : a - b;
    if (mid < 0 || mid > 20) continue;
    const fin = op2 === "+" ? mid + c : mid - c;
    if (fin < 0 || fin > 20) continue;
    const { choices, correct } = numChoices(rand, fin, 20);
    return {
      kind: "chain", answer: fin,
      promptHTML: `${a} ${op1} ${b} ${op2} ${c} = ?`,
      ask: "从左往右一步步算～",
      choices, correct,
    };
  }
}

/** 每关题目数：前 99 关 4 → 7 题；第 100–188 关 6 → 10 题（明显更长） */
export function questionCount(level: number): number {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  if (ci >= LEGACY_CHAPTER_COUNT) return 6 + Math.min(4, Math.floor(t * 4.6));
  return 4 + Math.min(3, Math.floor(t * 3.6));
}

/** 本关会出现的题型池（章节内前段简单、后段丰富） */
export function kindPool(level: number): MathKind[] {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  switch (ci) {
    case 0:
      if (t < 0.35) return ["count"];
      if (t < 0.7) return ["count", "add"];
      return ["count", "add", "sub"];
    case 1:
      if (t < 0.5) return ["add", "sub"];
      return ["add", "sub", "count"];
    case 2:
      if (t < 0.4) return ["add", "sub"];
      return ["add", "sub", "missing"];
    case 3:
      if (t < 0.5) return ["add"];
      return ["add", "missing"];
    case 4:
      if (t < 0.5) return ["sub"];
      return ["sub", "compare"];
    case 5:
      if (t < 0.4) return ["chain"];
      return ["chain", "compare", "add", "sub"];
    // ↓ 第 100–188 关：1.2 起由 kinds.ts 的难度权重表排题，这里只是把排出来的种类去重报出去
    default:
      return [...new Set(tableKinds(level, questionCount(level)))];
  }
}

/** 生成某一关的全部题目（同一关每次进入题目一致，重试不换题） */
export function buildQuestions(level: number): MathQ[] {
  const rand = mulberry32(4100 + level * 7919);
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  const count = questionCount(level);
  const out: MathQ[] = [];
  if (ci >= LEGACY_CHAPTER_COUNT) {
    // 第 100–188 关：题位由权重表分配，每道题都过一遍校验器
    const hard = hardnessOf(level);
    for (const kind of tableKinds(level, count)) out.push(makeAdvanced(rand, kind, hard));
    return shuffled(out, rand);
  }
  const pool = kindPool(level);
  for (let i = 0; i < count; i++) {
    // 轮流覆盖全部题型，超出部分随机补
    const kind = i < pool.length ? pool[i] : pick(rand, pool);
    out.push(makeOne(rand, ci, t, kind));
  }
  return shuffled(out, rand);
}

/**
 * 错题回顾用的「同类换数字」新题：答错过哪几类，就每类再来一道。
 * 换一颗种子，并且躲开正题已经出过的题面，孩子不会以为是原题重播。
 */
export function makeReviewQuestions(
  kinds: readonly MathKind[],
  level: number,
  salt = 0,
  avoid: readonly string[] = []
): MathQ[] {
  const rand = mulberry32(9700 + level * 104729 + salt * 7919);
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  const hard = hardnessOf(level);
  const seen = new Set(avoid);
  const out: MathQ[] = [];
  for (const kind of [...new Set(kinds)].slice(0, 4)) {
    for (let guard = 0; guard < 20; guard++) {
      const q = ci >= LEGACY_CHAPTER_COUNT ? makeAdvanced(rand, kind as AdvancedMathKind, hard) : makeOne(rand, ci, t, kind);
      if (seen.has(q.promptHTML)) continue;
      seen.add(q.promptHTML);
      out.push(q);
      break;
    }
  }
  return out;
}

/** 本关答错过的那几类题型（错题本按类型记，不记具体题目） */
export function typesOfKinds(kinds: readonly MathKind[]): MathType[] {
  return [...new Set(kinds.map((k) => typeOfKind(k)))];
}

/** 某一类题型能派出的具体种类（「练一练」按类型推荐时用） */
export function kindsOfType(type: MathType): readonly AdvancedMathKind[] {
  return KINDS_BY_TYPE[type];
}

function makeOne(rand: () => number, ci: number, t: number, kind: MathKind): MathQ {
  switch (ci) {
    case 0: {
      const maxN = t < 0.5 ? 5 : 8;
      if (kind === "count") return qCount(rand, 0, maxN);
      if (kind === "add") return qAdd(rand, 5);
      return qSub(rand, 5);
    }
    case 1: {
      if (kind === "count") return qCount(rand, 1, 10);
      if (kind === "add") return qAdd(rand, 10, 3);
      return qSub(rand, 10);
    }
    case 2: {
      if (kind === "missing") return qMissing(rand, 10, false);
      return qNoCarry(rand);
    }
    case 3: {
      if (kind === "missing") return qMissing(rand, 20, true);
      return qCarryAdd(rand);
    }
    case 4: {
      if (kind === "compare") return qCompare(rand, 20, t > 0.7);
      return qBorrowSub(rand);
    }
    default: {
      if (kind === "chain") return qChain(rand);
      if (kind === "compare") return qCompare(rand, 20, true);
      if (kind === "add") return qCarryAdd(rand);
      return qBorrowSub(rand);
    }
  }
}

/** 188 关概览（选关地图 / 测试用） */
export const LEVELS = Array.from({ length: TOTAL_LEVELS }, (_, i) => ({
  count: questionCount(i),
  kinds: kindPool(i),
}));
