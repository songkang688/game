// 算数小农场：188 关 · 十大农场章节题库生成（20 以内加减 → 乘除/余数/分数小数/括号应用题）
//
// 1.1 起总关数 99 → 188：前 99 关（前 6 章）的章节切分、seed、生成参数逐字未动，
// 新的 4 章共 89 关只在末尾追加，面向约小学六年级，允许多步推理。
import { TOTAL_LEVELS, mulberry32, pick, randInt, shuffled, chapterOf, indexInChapter, type Chapter } from "../level99";
import type { QuizQuestion, QuizTheme } from "../quiz99";
import { compareFractions, formatFraction, formatTenths, simplifyFraction } from "./logic";

/** 1.0 时代的章节数：下标 < 这个数的章节一律保持原样 */
export const LEGACY_CHAPTER_COUNT = 6;

export const CHAPTERS: Chapter[] = [
  { name: "青青牧场", emoji: "🐮", color: "#d3f9d8", desc: "数一数 + 5 以内加减法", size: 17 },
  { name: "甜甜果园", emoji: "🍎", color: "#ffe8cc", desc: "10 以内加减法", size: 17 },
  { name: "叮咚池塘", emoji: "🦆", color: "#d0f0fd", desc: "20 以内不进位不退位 + 填空", size: 17 },
  { name: "彩虹麦田", emoji: "🌈", color: "#fff3bf", desc: "凑十法：进位加法闯关", size: 16 },
  { name: "星星谷仓", emoji: "⭐", color: "#e5dbff", desc: "破十法：退位减法 + 比大小", size: 16 },
  { name: "月光农庄", emoji: "🌙", color: "#ffdeeb", desc: "连加连减混合大挑战", size: 16 },
  // ↓ 1.1 新增：第 100–188 关
  { name: "丰收乘法坊", emoji: "✖️", color: "#ffe9d6", desc: "两位数乘一位数、整十数除法，一步算到底", size: 23 },
  { name: "余数磨坊", emoji: "🌾", color: "#fff4d6", desc: "分不完怎么办：带余除法，商和余数都要说清", size: 22 },
  { name: "分数果酱铺", emoji: "🍯", color: "#ffe9f0", desc: "分数比大小与约分，还有一位小数加减", size: 22 },
  { name: "括号谷仓", emoji: "🧺", color: "#e3f0ff", desc: "带括号的混合运算和两步应用题", size: 22 },
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

export type LegacyMathKind = "count" | "add" | "sub" | "missing" | "compare" | "chain";
/** 1.1 新增的进阶题型（第 100–188 关专用） */
export type AdvancedMathKind = "mul" | "div" | "divmod" | "frac" | "dec" | "paren" | "word";
export type MathKind = LegacyMathKind | AdvancedMathKind;

export interface MathQ extends QuizQuestion {
  kind: MathKind;
  /** 正确答案（数字题为数值，比大小题为符号） */
  answer: number | string;
  /**
   * 1.1 应用题专用：题目对应的规范算式（例如 `3*8-5`）。
   * 测试会独立求值一遍并核对题面里出现过这些数字，保证每一关都真的可解。
   */
  expr?: string;
}

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

// ---------------------------------------------------------------------------
// 1.1 新机制一：两位数乘一位数 / 整除 / 带余除法
// ---------------------------------------------------------------------------

/** 大数题的干扰项：围着正确答案做「像模像样的错算」，而不是随便偏 1、2 */
function bigChoicesFor(rand: () => number, answer: number, deltas: number[]): { choices: string[]; correct: number } {
  const set = new Set<number>([answer]);
  let guard = 0;
  while (set.size < 3 && guard++ < 120) {
    const v = answer + pick(rand, deltas) * (rand() < 0.5 ? 1 : -1);
    if (v >= 0 && v !== answer) set.add(v);
  }
  let filler = 1;
  while (set.size < 3) set.add(answer + filler++);
  const arr = shuffled([...set], rand);
  return { choices: arr.map(String), correct: arr.indexOf(answer) };
}

/** 从若干候选字符串里凑够 3 个互不相同的选项 */
function textChoices(rand: () => number, answer: string, more: () => string | null): { choices: string[]; correct: number } {
  const set = new Set<string>([answer]);
  let guard = 0;
  while (set.size < 3 && guard++ < 200) {
    const v = more();
    if (v) set.add(v);
  }
  let filler = 1;
  while (set.size < 3) set.add(`${answer}　${"·".repeat(filler++)}`);
  const arr = shuffled([...set], rand);
  return { choices: arr, correct: arr.indexOf(answer) };
}

/** 乘法：表内乘法 → 两位数乘一位数 */
function qMul(rand: () => number, t: number): MathQ {
  const a = t < 0.4 ? randInt(rand, 3, 9) : randInt(rand, 11, t < 0.75 ? 29 : 49);
  const b = randInt(rand, 2, 9);
  const answer = a * b;
  const { choices, correct } = bigChoicesFor(rand, answer, [a, b, 10, 1, a + b]);
  return {
    kind: "mul", answer,
    promptHTML: `${a} × ${b} = ?`,
    ask: "算一算，积是多少？",
    choices, correct,
  };
}

/** 除法：正好分完（含整十数除法） */
function qDiv(rand: () => number, t: number): MathQ {
  const b = randInt(rand, 2, 9);
  const quotient = t < 0.4 ? randInt(rand, 2, 9) : randInt(rand, 5, t < 0.75 ? 20 : 40);
  const a = b * quotient;
  const { choices, correct } = bigChoicesFor(rand, quotient, [1, 2, 10, b]);
  return {
    kind: "div", answer: quotient,
    promptHTML: `${a} ÷ ${b} = ?`,
    ask: "平均分，每份是多少？",
    choices, correct,
  };
}

/** 带余除法：问「商几余几」或单问余数 */
function qDivMod(rand: () => number, t: number): MathQ {
  const b = randInt(rand, 3, 9);
  const quotient = t < 0.4 ? randInt(rand, 2, 9) : randInt(rand, 6, 30);
  const remainder = randInt(rand, 1, b - 1);
  const a = b * quotient + remainder;
  const askRemainderOnly = t >= 0.5 && rand() < 0.4;
  if (askRemainderOnly) {
    const { choices, correct } = bigChoicesFor(rand, remainder, [1, 2, 3]);
    return {
      kind: "divmod", answer: remainder,
      promptHTML: `${a} ÷ ${b} = ?`,
      ask: "余数是几？",
      choices, correct,
    };
  }
  const answer = `${quotient} 余 ${remainder}`;
  const { choices, correct } = textChoices(rand, answer, () => {
    const dq = quotient + randInt(rand, -2, 2);
    const dr = randInt(rand, 1, b - 1);
    return dq >= 0 ? `${dq} 余 ${dr}` : null;
  });
  return {
    kind: "divmod", answer,
    promptHTML: `${a} ÷ ${b} = ?`,
    ask: "商几余几？",
    choices, correct,
  };
}

// ---------------------------------------------------------------------------
// 1.1 新机制二：简易分数与一位小数
// ---------------------------------------------------------------------------

/** 分数题：比大小 / 约分 / 同分母加减 */
function qFrac(rand: () => number, t: number): MathQ {
  const form = t < 0.35 ? 0 : t < 0.7 ? randInt(rand, 0, 1) : randInt(rand, 0, 2);
  if (form === 0) {
    // 比大小
    const ad = randInt(rand, 2, 9);
    const an = randInt(rand, 1, ad - 1);
    const bd = randInt(rand, 2, 9);
    const bn = randInt(rand, 1, bd - 1);
    const cmp = compareFractions(an, ad, bn, bd);
    const answer = cmp > 0 ? "＞" : cmp < 0 ? "＜" : "＝";
    const arr = shuffled(["＞", "＜", "＝"], rand);
    return {
      kind: "frac", answer,
      promptHTML: `${formatFraction(an, ad)} <span style="color:#e8590c">○</span> ${formatFraction(bn, bd)}`,
      ask: "○ 里应该填哪个符号？",
      choices: arr, correct: arr.indexOf(answer),
    };
  }
  if (form === 1) {
    // 约分
    const base = simplifyFraction(randInt(rand, 1, 7), randInt(rand, 2, 9));
    const k = randInt(rand, 2, 6);
    const n = base.n * k;
    const d = base.d * k;
    const answer = formatFraction(base.n, base.d);
    const { choices, correct } = textChoices(rand, answer, () => {
      const wn = base.n * randInt(rand, 1, 3) + randInt(rand, -1, 1);
      const wd = base.d * randInt(rand, 1, 3);
      return wn >= 1 && wd >= 2 ? formatFraction(wn, wd) : null;
    });
    return {
      kind: "frac", answer,
      promptHTML: `${formatFraction(n, d)} <span style="color:#e8590c">⇒</span> 最简`,
      ask: "约成最简分数是多少？",
      choices, correct,
    };
  }
  // 同分母加减：加法保证和仍是真分数，减法保证差为正
  const d = randInt(rand, 4, 12);
  const plus = rand() < 0.5;
  let an: number;
  let bn: number;
  if (plus) {
    an = randInt(rand, 1, d - 2);
    bn = randInt(rand, 1, d - 1 - an);
  } else {
    an = randInt(rand, 2, d - 1);
    bn = randInt(rand, 1, an - 1);
  }
  const resultN = plus ? an + bn : an - bn;
  const answer = formatFraction(resultN, d);
  const { choices, correct } = textChoices(rand, answer, () => {
    const wn = resultN + randInt(rand, -2, 2);
    return wn >= 1 && wn !== resultN ? formatFraction(wn, d) : formatFraction(Math.max(1, resultN), d + randInt(rand, 1, 3));
  });
  return {
    kind: "frac", answer,
    promptHTML: `${formatFraction(an, d)} ${plus ? "+" : "-"} ${formatFraction(bn, d)} = ?`,
    ask: "同分母，分子直接算～",
    choices, correct,
  };
}

/** 一位小数加减（内部按十分之几的整数算，结果不会出现浮点毛刺） */
function qDec(rand: () => number, t: number): MathQ {
  const max = t < 0.5 ? 99 : 299;
  let a10 = 0;
  let b10 = 0;
  let plus = true;
  let result = 0;
  let guard = 0;
  do {
    a10 = randInt(rand, 11, max);
    b10 = randInt(rand, 11, max);
    plus = rand() < 0.5;
    if (!plus && b10 > a10) [a10, b10] = [b10, a10];
    result = plus ? a10 + b10 : a10 - b10;
  } while ((result % 10 === 0 || result <= 0) && guard++ < 60);
  const answer = formatTenths(result);
  const { choices, correct } = textChoices(rand, answer, () => {
    const v = result + pick(rand, [-10, -9, -1, 1, 9, 10]);
    return v > 0 && v !== result ? formatTenths(v) : null;
  });
  return {
    kind: "dec", answer,
    promptHTML: `${formatTenths(a10)} ${plus ? "+" : "-"} ${formatTenths(b10)} = ?`,
    ask: "小数点对齐，再算～",
    choices, correct,
  };
}

// ---------------------------------------------------------------------------
// 1.1 新机制三：带括号的混合运算 + 两步应用题
// ---------------------------------------------------------------------------

/** 带括号 / 先乘除后加减的混合运算 */
function qParen(rand: () => number, t: number): MathQ {
  for (let guard = 0; guard < 200; guard++) {
    const form = randInt(rand, 0, t < 0.5 ? 2 : 3);
    const a = randInt(rand, 2, t < 0.5 ? 12 : 25);
    const b = randInt(rand, 2, t < 0.5 ? 9 : 18);
    const c = randInt(rand, 2, 9);
    let text = "";
    let answer = 0;
    if (form === 0) {
      text = `( ${a} + ${b} ) × ${c}`;
      answer = (a + b) * c;
    } else if (form === 1) {
      if (a <= b) continue;
      text = `( ${a} - ${b} ) × ${c}`;
      answer = (a - b) * c;
    } else if (form === 2) {
      text = `${a} + ${b} × ${c}`;
      answer = a + b * c;
    } else {
      const sum = c * randInt(rand, 2, 12);
      text = `( ${sum} + ${c} ) ÷ ${c}`;
      answer = (sum + c) / c;
    }
    if (answer < 0 || answer > 500 || !Number.isInteger(answer)) continue;
    const { choices, correct } = bigChoicesFor(rand, answer, [1, c, b, 10, a]);
    return {
      kind: "paren", answer,
      promptHTML: `${text} = ?`,
      ask: form === 2 ? "先乘除，后加减～" : "先算括号里的～",
      choices, correct,
    };
  }
  const { choices, correct } = bigChoicesFor(rand, 24, [1, 2, 6]);
  return { kind: "paren", answer: 24, promptHTML: `( 5 + 3 ) × 3 = ?`, ask: "先算括号里的～", choices, correct };
}

/** 应用题里的原创农场物件（不使用任何商标或官方角色名） */
const FARM_ITEMS = ["南瓜", "玉米", "草莓", "小番茄", "鸡蛋", "萝卜", "苹果", "土豆"];
const FARM_BAGS = ["筐", "袋", "箱", "篮"];

/** 两步应用题：题面是中文，`expr` 给出规范算式，测试会独立验算 */
function qWord(rand: () => number, t: number): MathQ {
  const item = pick(rand, FARM_ITEMS);
  const bag = pick(rand, FARM_BAGS);
  const form = randInt(rand, 0, t < 0.5 ? 1 : 3);
  let text = "";
  let expr = "";
  let answer = 0;
  if (form === 0) {
    const rows = randInt(rand, 3, 9);
    const each = randInt(rand, 4, 12);
    const away = randInt(rand, 2, Math.max(2, rows * each - 2));
    text = `农场种了 ${rows} 排${item}，每排 ${each} 个，送走 ${away} 个，还剩几个？`;
    expr = `${rows}*${each}-${away}`;
    answer = rows * each - away;
  } else if (form === 1) {
    const per = randInt(rand, 3, 9);
    const bags = randInt(rand, 4, 15);
    const extra = randInt(rand, 2, 19);
    text = `每${bag}装 ${per} 个${item}，装满了 ${bags} ${bag}，又多出 ${extra} 个，一共几个？`;
    expr = `${per}*${bags}+${extra}`;
    answer = per * bags + extra;
  } else if (form === 2) {
    const people = randInt(rand, 3, 9);
    const each = randInt(rand, 4, 15);
    const sold = randInt(rand, 5, 40);
    const total = people * each + sold;
    text = `一共 ${total} 个${item}，先卖掉 ${sold} 个，剩下的平均分给 ${people} 个小朋友，每人几个？`;
    expr = `(${total}-${sold})/${people}`;
    answer = each;
  } else {
    const per = randInt(rand, 3, 9);
    const bags = randInt(rand, 3, 12);
    const away = randInt(rand, 2, 30);
    const total = per * bags + away;
    text = `摘了 ${total} 个${item}，先送走 ${away} 个，剩下的每${bag}放 ${per} 个，能装满几${bag}？`;
    expr = `(${total}-${away})/${per}`;
    answer = bags;
  }
  const { choices, correct } = bigChoicesFor(rand, answer, [1, 2, 5, 10]);
  return {
    kind: "word", answer, expr,
    promptHTML: `<span style="font-size:19px;font-weight:800;line-height:1.6;display:block">🧑‍🌾 ${text}</span>`,
    ask: "分两步想，先算什么？",
    choices, correct,
  };
}

function makeAdvanced(rand: () => number, kind: AdvancedMathKind, t: number): MathQ {
  switch (kind) {
    case "mul": return qMul(rand, t);
    case "div": return qDiv(rand, t);
    case "divmod": return qDivMod(rand, t);
    case "frac": return qFrac(rand, t);
    case "dec": return qDec(rand, t);
    case "paren": return qParen(rand, t);
    default: return qWord(rand, t);
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
    // ↓ 1.1 新增章节
    case 6:
      if (t < 0.35) return ["mul"];
      if (t < 0.7) return ["mul", "div"];
      return ["mul", "div", "word"];
    case 7:
      if (t < 0.4) return ["divmod"];
      if (t < 0.7) return ["divmod", "div"];
      return ["divmod", "div", "word"];
    case 8:
      if (t < 0.35) return ["frac"];
      if (t < 0.7) return ["frac", "dec"];
      return ["frac", "dec", "word"];
    default:
      if (t < 0.35) return ["paren"];
      if (t < 0.7) return ["paren", "word"];
      return ["paren", "word", "mul", "dec"];
  }
}

/** 生成某一关的全部题目（同一关每次进入题目一致，重试不换题） */
export function buildQuestions(level: number): MathQ[] {
  const rand = mulberry32(4100 + level * 7919);
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  const pool = kindPool(level);
  const count = questionCount(level);
  const out: MathQ[] = [];
  for (let i = 0; i < count; i++) {
    // 轮流覆盖全部题型，超出部分随机补
    const kind = i < pool.length ? pool[i] : pick(rand, pool);
    out.push(makeOne(rand, ci, t, kind));
  }
  return shuffled(out, rand);
}

function makeOne(rand: () => number, ci: number, t: number, kind: MathKind): MathQ {
  // 1.1 新章节走独立的进阶生成器；前 6 章的分支一行都没动
  if (ci >= LEGACY_CHAPTER_COUNT) return makeAdvanced(rand, kind as AdvancedMathKind, t);
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
