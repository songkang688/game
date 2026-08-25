// 拼音小火车：出题纯逻辑（三站递进 + 声调题 + 看图选音节）

/** 韵母（单韵母 + 常见复韵母/鼻韵母） */
export const VOWELS = [
  "a", "o", "e", "i", "u", "ü",
  "ai", "ei", "ui", "ao", "ou", "iu",
  "ie", "üe", "er", "an", "en", "in",
  "un", "ün", "ang", "eng", "ing", "ong",
];

/** 全部声母 */
export const INITIALS = [
  "b", "p", "m", "f", "d", "t", "n", "l",
  "g", "k", "h", "j", "q", "x",
  "zh", "ch", "sh", "r", "z", "c", "s", "y", "w",
];

/** 容易认混的字母分组，用于「找相同」题 */
export const LOOKALIKE_GROUPS: string[][] = [
  ["b", "d", "p", "q"],
  ["m", "n"],
  ["u", "ü"],
  ["f", "t"],
  ["ei", "ie"],
  ["ui", "iu"],
  ["un", "ün"],
  ["z", "zh"],
  ["c", "ch"],
  ["s", "sh"],
  ["an", "ang"],
  ["en", "eng"],
  ["in", "ing"],
];

/** 带声调的单韵母，用于声调题 */
export const TONE_MARKS: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à"],
  o: ["ō", "ó", "ǒ", "ò"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  u: ["ū", "ú", "ǔ", "ù"],
};
export const TONE_NAMES = ["第一声", "第二声", "第三声", "第四声"];

/** 看图选音节的图卡 */
export type SyllableCard = { emoji: string; word: string; pinyin: string };
export const SYLLABLE_CARDS: SyllableCard[] = [
  { emoji: "🐱", word: "猫", pinyin: "māo" },
  { emoji: "🐶", word: "狗", pinyin: "gǒu" },
  { emoji: "🐟", word: "鱼", pinyin: "yú" },
  { emoji: "🐴", word: "马", pinyin: "mǎ" },
  { emoji: "🌸", word: "花", pinyin: "huā" },
  { emoji: "🌙", word: "月", pinyin: "yuè" },
  { emoji: "☀️", word: "日", pinyin: "rì" },
  { emoji: "💧", word: "水", pinyin: "shuǐ" },
  { emoji: "🔥", word: "火", pinyin: "huǒ" },
  { emoji: "⛰️", word: "山", pinyin: "shān" },
  { emoji: "🐦", word: "鸟", pinyin: "niǎo" },
  { emoji: "🌳", word: "树", pinyin: "shù" },
  { emoji: "🐮", word: "牛", pinyin: "niú" },
  { emoji: "🐑", word: "羊", pinyin: "yáng" },
  { emoji: "🚗", word: "车", pinyin: "chē" },
  { emoji: "📖", word: "书", pinyin: "shū" },
];

export type PinyinQuestion = {
  kind: "vowel" | "initial" | "match" | "tone" | "syllable";
  /** 题目提示文字 */
  prompt: string;
  /** 车头上展示的大字母 / 图片，无则为空字符串 */
  display: string;
  choices: string[];
  answerIndex: number;
};

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickDistinct(arr: string[], n: number, rand: () => number, exclude: string[] = []): string[] {
  const pool = arr.filter((x) => !exclude.includes(x));
  const out: string[] = [];
  while (out.length < n && pool.length > 0) {
    const x = pick(pool, rand);
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

export function makeVowelQuestion(rand: () => number = Math.random): PinyinQuestion {
  const target = pick(VOWELS, rand);
  const distractors = pickDistinct(INITIALS, 2, rand);
  const choices = shuffle([target, ...distractors], rand);
  return {
    kind: "vowel",
    prompt: "下面哪个是韵母？",
    display: "",
    choices,
    answerIndex: choices.indexOf(target),
  };
}

export function makeInitialQuestion(rand: () => number = Math.random): PinyinQuestion {
  const target = pick(INITIALS, rand);
  const distractors = pickDistinct(VOWELS, 2, rand);
  const choices = shuffle([target, ...distractors], rand);
  return {
    kind: "initial",
    prompt: "下面哪个是声母？",
    display: "",
    choices,
    answerIndex: choices.indexOf(target),
  };
}

export function makeMatchQuestion(rand: () => number = Math.random): PinyinQuestion {
  const group = pick(LOOKALIKE_GROUPS, rand);
  const target = pick(group, rand);
  const distractors = pickDistinct(group, Math.min(2, group.length - 1), rand, [target]);
  if (distractors.length < 2) {
    distractors.push(
      ...pickDistinct([...VOWELS, ...INITIALS], 2 - distractors.length, rand, [target, ...distractors])
    );
  }
  const choices = shuffle([target, ...distractors], rand);
  return {
    kind: "match",
    prompt: "找出和车头上一样的字母！",
    display: target,
    choices,
    answerIndex: choices.indexOf(target),
  };
}

export function makeToneQuestion(rand: () => number = Math.random): PinyinQuestion {
  const bases = Object.keys(TONE_MARKS);
  const base = pick(bases, rand);
  const forms = TONE_MARKS[base];
  const toneIdx = Math.floor(rand() * 4);
  const target = forms[toneIdx];
  const others = forms.filter((_, i) => i !== toneIdx);
  const distractors = pickDistinct(others, 2, rand);
  const choices = shuffle([target, ...distractors], rand);
  return {
    kind: "tone",
    prompt: `哪个是「${base}」的${TONE_NAMES[toneIdx]}？`,
    display: "",
    choices,
    answerIndex: choices.indexOf(target),
  };
}

export function makeSyllableQuestion(rand: () => number = Math.random): PinyinQuestion {
  const card = pick(SYLLABLE_CARDS, rand);
  const distractors = pickDistinct(
    SYLLABLE_CARDS.map((c) => c.pinyin),
    2,
    rand,
    [card.pinyin]
  );
  const choices = shuffle([card.pinyin, ...distractors], rand);
  return {
    kind: "syllable",
    prompt: `「${card.word}」的拼音是哪个？`,
    display: card.emoji,
    choices,
    answerIndex: choices.indexOf(card.pinyin),
  };
}

/** 兼容旧接口：随机出基础三类题 */
export function makePinyinQuestion(rand: () => number = Math.random): PinyinQuestion {
  const r = rand();
  if (r < 1 / 3) return makeVowelQuestion(rand);
  if (r < 2 / 3) return makeInitialQuestion(rand);
  return makeMatchQuestion(rand);
}

/**
 * 按车站出题：
 * 第 1 站认声母韵母，第 2 站双胞胎字母 + 声调，第 3 站看图选音节为主。
 */
export function makeQuestionForStage(stage: 1 | 2 | 3, rand: () => number = Math.random): PinyinQuestion {
  if (stage === 1) {
    return rand() < 0.5 ? makeVowelQuestion(rand) : makeInitialQuestion(rand);
  }
  if (stage === 2) {
    return rand() < 0.5 ? makeMatchQuestion(rand) : makeToneQuestion(rand);
  }
  const r = rand();
  if (r < 0.6) return makeSyllableQuestion(rand);
  if (r < 0.8) return makeToneQuestion(rand);
  return makeMatchQuestion(rand);
}
