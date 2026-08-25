// 拼音小火车：99 关 · 六大车站章节题库生成（一年级拼音，确定性可测试）
import { mulberry32, pick, randInt, shuffled, chapterOf, indexInChapter, type Chapter } from "../level99";
import type { QuizQuestion, QuizTheme } from "../quiz99";
import {
  INITIALS,
  LOOKALIKE_GROUPS,
  SYLLABLE_CARDS,
  TONE_MARKS,
  TONE_NAMES,
  VOWELS,
} from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "单韵母站", emoji: "🚉", color: "#d3f9d8", desc: "a o e i u ü 排排坐", size: 17 },
  { name: "声母站", emoji: "🚂", color: "#ffe8cc", desc: "认一认 23 个声母", size: 17 },
  { name: "双胞胎站", emoji: "👯", color: "#e5dbff", desc: "b d p q 双胞胎大搜查", size: 17 },
  { name: "声调站", emoji: "🎵", color: "#d0f0fd", desc: "四个声调爬山坡", size: 16 },
  { name: "复韵母站", emoji: "🌈", color: "#fff3bf", desc: "ai ei ui 复韵母来啦", size: 16 },
  { name: "音节站", emoji: "🖼️", color: "#ffdeeb", desc: "看图拼音节大终点", size: 16 },
];

export const CHAPTER_THEMES: QuizTheme[] = [
  { bg: "linear-gradient(#e3fafc,#d3f9d8)", accent: "#2b8a3e" },
  { bg: "linear-gradient(#fff4e6,#ffe8cc)", accent: "#d9480f" },
  { bg: "linear-gradient(#f3f0ff,#e5dbff)", accent: "#6741d9" },
  { bg: "linear-gradient(#e7f5ff,#d0f0fd)", accent: "#1971c2" },
  { bg: "linear-gradient(#fff9db,#fff3bf)", accent: "#e8590c" },
  { bg: "linear-gradient(#fff0f6,#ffdeeb)", accent: "#c2255c" },
];

/** 单韵母 */
export const SINGLE_VOWELS = ["a", "o", "e", "i", "u", "ü"];
/** 复韵母 / 鼻韵母 */
export const COMPOUND_VOWELS = VOWELS.filter((v) => !SINGLE_VOWELS.includes(v));

/** 单字母双胞胎组（前两章用） */
const SIMPLE_GROUPS = LOOKALIKE_GROUPS.filter((g) => g.every((x) => x.length === 1));
/** 复韵母双胞胎组（复韵母站用） */
const COMPOUND_GROUPS = LOOKALIKE_GROUPS.filter((g) => g.some((x) => x.length >= 2));

export type PinyinKind = "vowel" | "initial" | "match" | "tone" | "syllable";

export interface PinyinQ extends QuizQuestion {
  kind: PinyinKind;
  answer: string;
}

function pickDistinct(arr: readonly string[], n: number, rand: () => number, exclude: string[]): string[] {
  const pool = arr.filter((x) => !exclude.includes(x));
  const out: string[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const x = pick(rand, pool);
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

function qVowel(rand: () => number, vowelPool: string[]): PinyinQ {
  const target = pick(rand, vowelPool);
  const choices = shuffled([target, ...pickDistinct(INITIALS, 2, rand, [target])], rand);
  return {
    kind: "vowel", answer: target,
    promptHTML: `<span style="font-size:40px">🚂💨</span>`,
    ask: "下面哪个是韵母？",
    choices, correct: choices.indexOf(target),
  };
}

function qInitial(rand: () => number): PinyinQ {
  const target = pick(rand, INITIALS);
  const choices = shuffled([target, ...pickDistinct(VOWELS, 2, rand, [target])], rand);
  return {
    kind: "initial", answer: target,
    promptHTML: `<span style="font-size:40px">🚃🚃</span>`,
    ask: "下面哪个是声母？",
    choices, correct: choices.indexOf(target),
  };
}

function qMatch(rand: () => number, groups: string[][]): PinyinQ {
  const group = pick(rand, groups);
  const target = pick(rand, group);
  let distractors = pickDistinct(group, 2, rand, [target]);
  if (distractors.length < 2) {
    distractors = distractors.concat(
      pickDistinct([...VOWELS, ...INITIALS], 2 - distractors.length, rand, [target, ...distractors])
    );
  }
  const choices = shuffled([target, ...distractors], rand);
  return {
    kind: "match", answer: target,
    promptHTML: target,
    ask: "找出和车头上一模一样的！",
    choices, correct: choices.indexOf(target),
  };
}

function qTone(rand: () => number): PinyinQ {
  const bases = Object.keys(TONE_MARKS);
  const base = pick(rand, bases);
  const forms = TONE_MARKS[base];
  const toneIdx = randInt(rand, 0, 3);
  const target = forms[toneIdx];
  const others = forms.filter((_, i) => i !== toneIdx);
  const distractors = pickDistinct(others, 2, rand, []);
  const choices = shuffled([target, ...distractors], rand);
  return {
    kind: "tone", answer: target,
    promptHTML: `<span style="font-size:30px">🎵</span> ${base}`,
    ask: `哪个是「${base}」的${TONE_NAMES[toneIdx]}？`,
    choices, correct: choices.indexOf(target),
  };
}

function qSyllable(rand: () => number): PinyinQ {
  const card = pick(rand, SYLLABLE_CARDS);
  const distractors = pickDistinct(
    SYLLABLE_CARDS.map((c) => c.pinyin),
    2, rand, [card.pinyin]
  );
  const choices = shuffled([card.pinyin, ...distractors], rand);
  return {
    kind: "syllable", answer: card.pinyin,
    promptHTML: `<span style="font-size:56px">${card.emoji}</span>`,
    ask: `「${card.word}」的拼音是哪个？`,
    choices, correct: choices.indexOf(card.pinyin),
  };
}

/** 每关题目数：章节内 4 → 7 题递增 */
export function questionCount(level: number): number {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  return 4 + Math.min(3, Math.floor(t * 3.6));
}

export function kindPool(level: number): PinyinKind[] {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  switch (ci) {
    case 0:
      return t < 0.6 ? ["vowel"] : ["vowel", "match"];
    case 1:
      return t < 0.5 ? ["initial"] : ["initial", "vowel", "match"];
    case 2:
      return t < 0.6 ? ["match"] : ["match", "initial"];
    case 3:
      return t < 0.5 ? ["tone"] : ["tone", "match"];
    case 4:
      return t < 0.5 ? ["vowel", "match"] : ["vowel", "match", "tone"];
    default:
      return t < 0.4 ? ["syllable", "tone"] : ["syllable", "tone", "match", "vowel"];
  }
}

/** 生成某一关的全部题目（确定性，重试不换题） */
export function buildQuestions(level: number): PinyinQ[] {
  const rand = mulberry32(6300 + level * 7919);
  const ci = chapterOf(CHAPTERS, level);
  const kinds = kindPool(level);
  const count = questionCount(level);
  const out: PinyinQ[] = [];
  for (let i = 0; i < count; i++) {
    const kind = i < kinds.length ? kinds[i] : pick(rand, kinds);
    out.push(makeOne(rand, ci, kind));
  }
  return shuffled(out, rand);
}

function makeOne(rand: () => number, ci: number, kind: PinyinKind): PinyinQ {
  switch (kind) {
    case "vowel":
      // 单韵母站只考单韵母，复韵母站只考复韵母，其余混合
      if (ci === 0) return qVowel(rand, SINGLE_VOWELS);
      if (ci === 4) return qVowel(rand, COMPOUND_VOWELS);
      return qVowel(rand, VOWELS);
    case "initial":
      return qInitial(rand);
    case "match":
      if (ci <= 1) return qMatch(rand, SIMPLE_GROUPS);
      if (ci === 4) return qMatch(rand, COMPOUND_GROUPS);
      return qMatch(rand, LOOKALIKE_GROUPS);
    case "tone":
      return qTone(rand);
    default:
      return qSyllable(rand);
  }
}

/** 99 关概览（测试用） */
export const LEVELS = Array.from({ length: 99 }, (_, i) => ({
  count: questionCount(i),
  kinds: kindPool(i),
}));
