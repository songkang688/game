// 拼音小火车：188 关 · 十座车站章节题库生成（确定性可测试）
// 前 99 关是 1.0 的六座车站，一个字都没动；1.1 在末尾追加四座高年级车站（第 100–188 关）。
import { mulberry32, pick, randInt, shuffled, chapterOf, indexInChapter, type Chapter } from "../level99";
import type { QuizQuestion, QuizTheme } from "../quiz99";
import {
  applyTone,
  DUOYIN_CARDS,
  ERHUA_WORDS,
  INITIALS,
  LOOKALIKE_GROUPS,
  NEUTRAL_WORDS,
  PINYIN_SENTENCES,
  SPELL_ONLY_SYLLABLES,
  stripTone,
  SYLLABLE_CARDS,
  TONE_MARKS,
  TONE_NAMES,
  TONED_WORDS,
  toneOf,
  VOWELS,
  WHOLE_READ_SYLLABLES,
} from "./logic";

/** 1.0 的六座车站：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新章节从这里开始往后排） */
export const LEGACY_LEVELS = 99;

export const CHAPTERS: Chapter[] = [
  { name: "单韵母站", emoji: "🚉", color: "#d3f9d8", desc: "a o e i u ü 排排坐", size: 17 },
  { name: "声母站", emoji: "🚂", color: "#ffe8cc", desc: "认一认 23 个声母", size: 17 },
  { name: "双胞胎站", emoji: "👯", color: "#e5dbff", desc: "b d p q 双胞胎大搜查", size: 17 },
  { name: "声调站", emoji: "🎵", color: "#d0f0fd", desc: "四个声调爬山坡", size: 16 },
  { name: "复韵母站", emoji: "🌈", color: "#fff3bf", desc: "ai ei ui 复韵母来啦", size: 16 },
  { name: "音节站", emoji: "🖼️", color: "#ffdeeb", desc: "看图拼音节大终点", size: 16 },
  // ↓ 1.1 追加：四座高年级车站，合计 89 关
  { name: "整体认读快线", emoji: "🚄", color: "#ffe3e3", desc: "十六个整体认读音节，一眼认出不用拼", size: 22 },
  { name: "多音字岔道", emoji: "🔀", color: "#e6fcf5", desc: "同一个字换个词就换个读音", size: 22 },
  { name: "轻声儿化坡", emoji: "🍃", color: "#f8f0fc", desc: "轻轻一声、卷卷舌头，味道全变了", size: 23 },
  { name: "句子注音终点", emoji: "📜", color: "#edf2ff", desc: "读懂整句话，再决定这个字念什么", size: 22 },
];

export const CHAPTER_THEMES: QuizTheme[] = [
  { bg: "linear-gradient(#e3fafc,#d3f9d8)", accent: "#2b8a3e" },
  { bg: "linear-gradient(#fff4e6,#ffe8cc)", accent: "#d9480f" },
  { bg: "linear-gradient(#f3f0ff,#e5dbff)", accent: "#6741d9" },
  { bg: "linear-gradient(#e7f5ff,#d0f0fd)", accent: "#1971c2" },
  { bg: "linear-gradient(#fff9db,#fff3bf)", accent: "#e8590c" },
  { bg: "linear-gradient(#fff0f6,#ffdeeb)", accent: "#c2255c" },
  { bg: "linear-gradient(#fff5f5,#ffe3e3)", accent: "#c92a52" },
  { bg: "linear-gradient(#e6fcf5,#c3fae8)", accent: "#087f5b" },
  { bg: "linear-gradient(#f8f0fc,#eebefa)", accent: "#862e9c" },
  { bg: "linear-gradient(#edf2ff,#dbe4ff)", accent: "#364fc7" },
];

/** 单韵母 */
export const SINGLE_VOWELS = ["a", "o", "e", "i", "u", "ü"];
/** 复韵母 / 鼻韵母 */
export const COMPOUND_VOWELS = VOWELS.filter((v) => !SINGLE_VOWELS.includes(v));

/** 单字母双胞胎组（前两章用） */
const SIMPLE_GROUPS = LOOKALIKE_GROUPS.filter((g) => g.every((x) => x.length === 1));
/** 复韵母双胞胎组（复韵母站用） */
const COMPOUND_GROUPS = LOOKALIKE_GROUPS.filter((g) => g.some((x) => x.length >= 2));

export type PinyinKind =
  | "vowel"
  | "initial"
  | "match"
  | "tone"
  | "syllable"
  // ↓ 1.1 追加的高年级题型
  | "whole"
  | "duoyin"
  | "context"
  | "neutral"
  | "erhua"
  | "sentence";

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

// ---------------------------------------------------------------------------
// 1.1 追加：高年级题型（整体认读 / 多音字 / 联系句子 / 轻声 / 儿化 / 句子注音）
// ---------------------------------------------------------------------------

/** 换声调做干扰项：同一个光板音节换几个调，最像的错答案 */
function toneVariants(rand: () => number, syllable: string, n: number, exclude: string[]): string[] {
  const plain = stripTone(syllable);
  const out: string[] = [];
  for (const tone of shuffled([1, 2, 3, 4, 0], rand)) {
    const cand = applyTone(plain, tone);
    if (cand === syllable || exclude.includes(cand) || out.includes(cand)) continue;
    out.push(cand);
    if (out.length >= n) break;
  }
  return out;
}

/** 整体认读音节：从三个音节里挑出那个「不用拼、整个儿读」的 */
function qWhole(rand: () => number): PinyinQ {
  const target = pick(rand, WHOLE_READ_SYLLABLES);
  const choices = shuffled([target, ...pickDistinct(SPELL_ONLY_SYLLABLES, 2, rand, [target])], rand);
  return {
    kind: "whole", answer: target,
    promptHTML: `<span style="font-size:38px">🚄</span>`,
    ask: "哪个是整体认读音节？",
    choices, correct: choices.indexOf(target),
  };
}

/** 多音字：给词定音 */
function qDuoyin(rand: () => number): PinyinQ {
  const card = pick(rand, DUOYIN_CARDS);
  const ri = randInt(rand, 0, card.readings.length - 1);
  const reading = card.readings[ri];
  const other = card.readings[(ri + 1) % card.readings.length].pinyin;
  const word = pick(rand, reading.words);
  const extra = toneVariants(rand, reading.pinyin, 1, [other]);
  const choices = shuffled([reading.pinyin, other, ...extra], rand);
  return {
    kind: "duoyin", answer: reading.pinyin,
    promptHTML: `<span style="font-size:40px">${word}</span>`,
    ask: `「${word}」里的「${card.char}」读什么？`,
    choices, correct: choices.indexOf(reading.pinyin),
  };
}

/** 联系句子定音：先读懂整句话的意思，再决定这个字念哪个音（多步推理） */
function qContext(rand: () => number): PinyinQ {
  const card = pick(rand, DUOYIN_CARDS);
  const ri = randInt(rand, 0, card.readings.length - 1);
  const reading = card.readings[ri];
  const other = card.readings[(ri + 1) % card.readings.length].pinyin;
  const extra = toneVariants(rand, reading.pinyin, 1, [other]);
  const choices = shuffled([reading.pinyin, other, ...extra], rand);
  const marked = reading.sentence.replace(
    card.char,
    `<span style="color:#c2255c;border-bottom:3px solid #ffa8a8">${card.char}</span>`
  );
  return {
    kind: "context", answer: reading.pinyin,
    promptHTML: `<span style="font-size:20px;line-height:1.6">${marked}</span>`,
    ask: `联系句子想一想，「${card.char}」读什么？`,
    choices, correct: choices.indexOf(reading.pinyin),
  };
}

/** 轻声：第二个字读得又轻又短，调号都省了 */
function qNeutral(rand: () => number): PinyinQ {
  const card = pick(rand, NEUTRAL_WORDS);
  const target = card.syllables[1];
  const second = Array.from(card.word)[1];
  const choices = shuffled([target, ...toneVariants(rand, target, 2, [])], rand);
  return {
    kind: "neutral", answer: target,
    promptHTML: `<span style="font-size:38px">${card.word}</span>`,
    ask: `「${card.word}」后面的「${second}」怎么读？`,
    choices, correct: choices.indexOf(target),
  };
}

/** 儿化：两个字连读，舌头一卷成一个音节 */
function qErhua(rand: () => number): PinyinQ {
  const card = pick(rand, ERHUA_WORDS);
  const apart = `${card.base} ér`;
  const extra = toneVariants(rand, card.erhua, 1, [apart]);
  const choices = shuffled([card.erhua, apart, ...extra], rand);
  return {
    kind: "erhua", answer: card.erhua,
    promptHTML: `<span style="font-size:38px">${card.word}</span>`,
    ask: `「${card.word}」连起来读是哪个？`,
    choices, correct: choices.indexOf(card.erhua),
  };
}

/** 句子注音：整句话摆出来，只给一个字标色，考的是在句子里定音 */
function qSentence(rand: () => number): PinyinQ {
  const s = pick(rand, PINYIN_SENTENCES);
  const chars = Array.from(s.text);
  const candidates = s.syllables.map((_, i) => i).filter((i) => toneOf(s.syllables[i]) > 0);
  const at = pick(rand, candidates);
  const target = s.syllables[at];
  const marked = chars
    .map((c, i) => (i === at ? `<span style="color:#c2255c;border-bottom:3px solid #ffa8a8">${c}</span>` : c))
    .join("");
  const choices = shuffled([target, ...toneVariants(rand, target, 2, [])], rand);
  return {
    kind: "sentence", answer: target,
    promptHTML: `<span style="font-size:20px;line-height:1.6">${marked}</span>`,
    ask: `句子里标色的「${chars[at]}」读什么？`,
    choices, correct: choices.indexOf(target),
  };
}

/** 每关题目数：1.0 六站 4 → 7 题；1.1 新车站 6 → 9 题（更长的题组） */
export function questionCount(level: number): number {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  if (ci >= LEGACY_CHAPTER_SIZES.length) return 6 + Math.min(3, Math.floor(t * 3.6));
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
    case 5:
      return t < 0.4 ? ["syllable", "tone"] : ["syllable", "tone", "match", "vowel"];
    case 6:
      return t < 0.5 ? ["whole", "tone"] : ["whole", "tone", "syllable"];
    case 7:
      return t < 0.5 ? ["duoyin"] : ["duoyin", "context"];
    case 8:
      return t < 0.4 ? ["neutral", "erhua"] : ["neutral", "erhua", "duoyin"];
    default:
      return t < 0.4 ? ["sentence", "context"] : ["sentence", "context", "neutral", "duoyin"];
  }
}

/** 生成某一关的全部题目（确定性，重试不换题） */
export function buildQuestions(level: number): PinyinQ[] {
  const rand = mulberry32(6300 + level * 7919);
  const ci = chapterOf(CHAPTERS, level);
  const kinds = kindPool(level);
  const count = questionCount(level);
  const out: PinyinQ[] = [];
  // 新车站题量大，同一关尽量不重复考同一个字/词，老车站保持 1.0 的生成顺序
  const fresh = ci >= LEGACY_CHAPTER_SIZES.length;
  const used: string[] = [];
  for (let i = 0; i < count; i++) {
    const kind = i < kinds.length ? kinds[i] : pick(rand, kinds);
    let q = makeOne(rand, ci, kind);
    if (fresh) {
      let guard = 0;
      while (guard++ < 12 && used.includes(`${q.kind}:${q.answer}:${q.ask}`)) q = makeOne(rand, ci, kind);
      used.push(`${q.kind}:${q.answer}:${q.ask}`);
    }
    out.push(q);
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
    case "whole":
      return qWhole(rand);
    case "duoyin":
      return qDuoyin(rand);
    case "context":
      return qContext(rand);
    case "neutral":
      return qNeutral(rand);
    case "erhua":
      return qErhua(rand);
    case "sentence":
      return qSentence(rand);
    default:
      return qSyllable(rand);
  }
}

// ---------------------------------------------------------------------------
// 1.1 新机制一：挑拣车厢（多选题）
// 一次要把「全部符合条件的」都挑出来，多选漏选都算一次错——比三选一难得多。
// ---------------------------------------------------------------------------

export type PickAllRule = "whole" | "reading" | "neutral" | "erhua" | "tone3";

export interface PickAllTask {
  rule: PickAllRule;
  /** 车厢标题，例如「挑出全部整体认读音节」 */
  title: string;
  /** 一句话说清判断标准（只讲方法，不给答案） */
  hint: string;
  /** 车厢里的全部卡片（互不相同） */
  chips: string[];
  /** 其中应该被挑出来的那些 */
  correct: string[];
  /** 允许提交错几次 */
  maxWrong: number;
}

/** 这一关是不是「挑拣车厢」多选关（只在 1.1 新车站里出现） */
export function isPickAllLevel(level: number): boolean {
  if (level < LEGACY_LEVELS) return false;
  return indexInChapter(CHAPTERS, level) % 4 === 3;
}

function takeDistinct(rand: () => number, pool: readonly string[], n: number, exclude: string[]): string[] {
  const out: string[] = [];
  if (n <= 0) return out;
  for (const x of shuffled(pool, rand)) {
    if (exclude.includes(x) || out.includes(x)) continue;
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

/** 生成某一关的挑拣车厢（确定性；只对 isPickAllLevel 为真的关有意义） */
export function buildPickAll(level: number): PickAllTask {
  const rand = mulberry32(7700 + level * 7919);
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  const need = 3 + Math.floor(t * 2);
  const noise = 3 + Math.floor(t * 2);
  const maxWrong = t > 0.6 ? 1 : 2;

  if (ci === 7) {
    // 多音字：同一个字，挑出读某个音的全部词
    const card = pick(rand, DUOYIN_CARDS);
    const ri = randInt(rand, 0, card.readings.length - 1);
    const reading = card.readings[ri];
    const other = card.readings[(ri + 1) % card.readings.length];
    const correct = takeDistinct(rand, reading.words, Math.min(3, Math.max(2, need - 1)), []);
    const chips = shuffled([...correct, ...takeDistinct(rand, other.words, 3, correct)], rand);
    return {
      rule: "reading",
      title: `挑出「${card.char}」读 ${reading.pinyin} 的词`,
      hint: "先想想每个词是什么意思，意思对了读音就对了。",
      chips, correct, maxWrong,
    };
  }

  if (ci === 8) {
    // 一半关考轻声、一半关考儿化，两种判断标准轮着来
    if (idx % 8 === 3) {
      const correct = takeDistinct(rand, ERHUA_WORDS.map((w) => w.word), need, []);
      const chips = shuffled([...correct, ...takeDistinct(rand, TONED_WORDS.map((w) => w.word), noise, correct)], rand);
      return {
        rule: "erhua",
        title: "挑出全部儿化的词",
        hint: "读一读，末尾要卷舌、两个字连成一个音节的就是它。",
        chips, correct, maxWrong,
      };
    }
    const correct = takeDistinct(rand, NEUTRAL_WORDS.map((w) => w.word), need, []);
    const chips = shuffled([...correct, ...takeDistinct(rand, TONED_WORDS.map((w) => w.word), noise, correct)], rand);
    return {
      rule: "neutral",
      title: "挑出第二个字读轻声的词",
      hint: "后一个字读得又轻又短、听不出声调的，就是轻声。",
      chips, correct, maxWrong,
    };
  }

  if (ci === 9) {
    // 句子里挑出全部第三声的字（先注音，再判调）
    const usable = PINYIN_SENTENCES.filter(
      (s) => s.syllables.filter((y) => toneOf(y) === 3).length >= 2
    );
    const s = pick(rand, usable);
    const chars = Array.from(s.text);
    const chips: string[] = [];
    const correct: string[] = [];
    chars.forEach((c, i) => {
      const chip = `${c} ${s.syllables[i]}`;
      if (chips.includes(chip)) return;
      chips.push(chip);
      if (toneOf(s.syllables[i]) === 3) correct.push(chip);
    });
    return {
      rule: "tone3",
      title: "挑出句中读第三声的字",
      hint: "第三声的调号是先降后升的小勾，像个小山谷。",
      chips, correct, maxWrong,
    };
  }

  // 默认（整体认读快线）：从一车音节里挑出全部整体认读音节
  const correct = takeDistinct(rand, WHOLE_READ_SYLLABLES, need, []);
  const chips = shuffled([...correct, ...takeDistinct(rand, SPELL_ONLY_SYLLABLES, noise, correct)], rand);
  return {
    rule: "whole",
    title: "挑出全部整体认读音节",
    hint: "整体认读音节不用拼，看见就能整个儿读出来。",
    chips, correct, maxWrong,
  };
}

// ---------------------------------------------------------------------------
// 1.1 新机制二：限时特快
// 从多音字岔道开始，整关有一个倒计时；时间到了也只鼓励，随时可以再发车。
// ---------------------------------------------------------------------------

/** 本关的整关时限（毫秒）；0 表示不限时（前 99 关永远是 0） */
export function levelTimeLimitMs(level: number): number {
  if (level < LEGACY_LEVELS) return 0;
  const ci = chapterOf(CHAPTERS, level);
  if (ci <= 6) return 0;
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  const base = ci === 7 ? 180000 : ci === 8 ? 165000 : 150000;
  return Math.round(base - t * 30000);
}

/** 188 关概览（测试用） */
export const LEVELS = Array.from({ length: 188 }, (_, i) => ({
  count: questionCount(i),
  kinds: kindPool(i),
}));
