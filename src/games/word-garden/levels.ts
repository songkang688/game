// 识字小花园：188 关 · 十一座主题花园题库生成（确定性可测试）
// 前 99 关是 1.0 的六座花园，一个字都没动；1.1 在末尾追加五座高年级花园（第 100–188 关）。
import { mulberry32, pick, randInt, shuffled, chapterOf, indexInChapter, type Chapter } from "../level99";
import type { QuizQuestion, QuizTheme } from "../quiz99";
import {
  BUILD_CHAR_CARDS,
  CLOZE_CARDS,
  IDIOM_CARDS,
  LOOKALIKE_SETS,
  RADICAL_CARDS,
  SYN_ANT_CARDS,
  WORD_LEVELS,
  type WordCard,
} from "./logic";

/** 1.0 的六座花园：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新花园从这里开始往后排） */
export const LEGACY_LEVELS = 99;

export const CHAPTERS: Chapter[] = [
  { name: "青青花园", emoji: "🌿", color: "#d3f9d8", desc: "自然天地：看图认字", size: 17 },
  { name: "萌萌花园", emoji: "🐾", color: "#ffe8cc", desc: "动物朋友：认字选图", size: 17 },
  { name: "星星花园", emoji: "✨", color: "#e5dbff", desc: "身体宝贝：拼音来帮忙", size: 17 },
  { name: "数字花园", emoji: "🔢", color: "#d0f0fd", desc: "数一数，认汉字数字", size: 16 },
  { name: "亲亲花园", emoji: "🏠", color: "#ffdeeb", desc: "家人称呼 + 给字组词", size: 16 },
  { name: "美味花园", emoji: "🍉", color: "#fff3bf", desc: "美味食物：混合大挑战", size: 16 },
  // ↓ 1.1 追加：五座高年级花园，合计 89 关
  { name: "形近字迷宫", emoji: "🪞", color: "#ffe3e3", desc: "长得像的字，一笔之差意思全变", size: 18 },
  { name: "成语花廊", emoji: "🏮", color: "#e6fcf5", desc: "四个字的小故事，缺一个字就走味", size: 18 },
  { name: "近反义花海", emoji: "⚖️", color: "#f8f0fc", desc: "同一个意思往两边走，一近一反", size: 18 },
  { name: "句子填空亭", emoji: "✍️", color: "#edf2ff", desc: "读完整句话，挑出最合适的那个词", size: 18 },
  { name: "偏旁推字园", emoji: "🧩", color: "#fff4e6", desc: "看偏旁猜意思，再动手把字拼出来", size: 17 },
];

export const CHAPTER_THEMES: QuizTheme[] = [
  { bg: "linear-gradient(#e3fafc 0 55%,#d3f9d8 55% 100%)", accent: "#2b8a3e" },
  { bg: "linear-gradient(#fff4e6 0 55%,#ffe8cc 55% 100%)", accent: "#d9480f" },
  { bg: "linear-gradient(#f3f0ff 0 55%,#e5dbff 55% 100%)", accent: "#6741d9" },
  { bg: "linear-gradient(#e7f5ff 0 55%,#d0f0fd 55% 100%)", accent: "#1971c2" },
  { bg: "linear-gradient(#fff0f6 0 55%,#ffdeeb 55% 100%)", accent: "#c2255c" },
  { bg: "linear-gradient(#fff9db 0 55%,#fff3bf 55% 100%)", accent: "#e8590c" },
  { bg: "linear-gradient(#fff5f5 0 55%,#ffe3e3 55% 100%)", accent: "#c92a52" },
  { bg: "linear-gradient(#e6fcf5 0 55%,#c3fae8 55% 100%)", accent: "#087f5b" },
  { bg: "linear-gradient(#f8f0fc 0 55%,#eebefa 55% 100%)", accent: "#862e9c" },
  { bg: "linear-gradient(#edf2ff 0 55%,#dbe4ff 55% 100%)", accent: "#364fc7" },
  { bg: "linear-gradient(#fff4e6 0 55%,#ffe8cc 55% 100%)", accent: "#b25000" },
];

/** 第四章：汉字数字（数一数选汉字） */
export const NUMBER_CARDS: WordCard[] = [
  { char: "一", pinyin: "yī", word: "一个", emoji: "1️⃣" },
  { char: "二", pinyin: "èr", word: "二月", emoji: "2️⃣" },
  { char: "三", pinyin: "sān", word: "三只", emoji: "3️⃣" },
  { char: "四", pinyin: "sì", word: "四个", emoji: "4️⃣" },
  { char: "五", pinyin: "wǔ", word: "五角星", emoji: "5️⃣" },
  { char: "六", pinyin: "liù", word: "六岁", emoji: "6️⃣" },
  { char: "七", pinyin: "qī", word: "七彩", emoji: "7️⃣" },
  { char: "八", pinyin: "bā", word: "八个", emoji: "8️⃣" },
  { char: "九", pinyin: "jiǔ", word: "九层", emoji: "9️⃣" },
  { char: "十", pinyin: "shí", word: "十分", emoji: "🔟" },
];
const NUMBER_VALUE: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

/** 第五章：家人与称呼 */
export const FAMILY_CARDS: WordCard[] = [
  { char: "爸", pinyin: "bà", word: "爸爸", emoji: "👨" },
  { char: "妈", pinyin: "mā", word: "妈妈", emoji: "👩" },
  { char: "爷", pinyin: "yé", word: "爷爷", emoji: "👴" },
  { char: "奶", pinyin: "nǎi", word: "奶奶", emoji: "👵" },
  { char: "哥", pinyin: "gē", word: "哥哥", emoji: "👦" },
  { char: "姐", pinyin: "jiě", word: "姐姐", emoji: "👧" },
  { char: "弟", pinyin: "dì", word: "弟弟", emoji: "🧒" },
  { char: "妹", pinyin: "mèi", word: "妹妹", emoji: "👶" },
  { char: "我", pinyin: "wǒ", word: "我们", emoji: "🙋" },
  { char: "友", pinyin: "yǒu", word: "朋友", emoji: "🤝" },
  { char: "家", pinyin: "jiā", word: "家人", emoji: "🏠" },
  { char: "爱", pinyin: "ài", word: "爱心", emoji: "💖" },
  { char: "笑", pinyin: "xiào", word: "笑脸", emoji: "😄" },
  { char: "好", pinyin: "hǎo", word: "你好", emoji: "👍" },
  { char: "宝", pinyin: "bǎo", word: "宝贝", emoji: "🍼" },
  { char: "亲", pinyin: "qīn", word: "亲人", emoji: "🥰" },
];

/** 第六章：美味食物 */
export const FOOD_CARDS: WordCard[] = [
  { char: "瓜", pinyin: "guā", word: "西瓜", emoji: "🍉" },
  { char: "豆", pinyin: "dòu", word: "豆子", emoji: "🫘" },
  { char: "菜", pinyin: "cài", word: "青菜", emoji: "🥬" },
  { char: "蛋", pinyin: "dàn", word: "鸡蛋", emoji: "🥚" },
  { char: "肉", pinyin: "ròu", word: "烤肉", emoji: "🍖" },
  { char: "茶", pinyin: "chá", word: "热茶", emoji: "🍵" },
  { char: "糖", pinyin: "táng", word: "糖果", emoji: "🍬" },
  { char: "面", pinyin: "miàn", word: "面条", emoji: "🍜" },
  { char: "包", pinyin: "bāo", word: "面包", emoji: "🍞" },
  { char: "桃", pinyin: "táo", word: "桃子", emoji: "🍑" },
  { char: "梨", pinyin: "lí", word: "梨子", emoji: "🍐" },
  { char: "橙", pinyin: "chéng", word: "橙子", emoji: "🍊" },
  { char: "汤", pinyin: "tāng", word: "热汤", emoji: "🍲" },
  { char: "虾", pinyin: "xiā", word: "大虾", emoji: "🦐" },
  { char: "饼", pinyin: "bǐng", word: "饼干", emoji: "🍪" },
  { char: "麦", pinyin: "mài", word: "麦子", emoji: "🌾" },
];

/** 每章的字卡池 */
export const CHAPTER_POOLS: WordCard[][] = [
  WORD_LEVELS[0].cards,
  WORD_LEVELS[1].cards,
  WORD_LEVELS[2].cards,
  NUMBER_CARDS,
  FAMILY_CARDS,
  FOOD_CARDS,
];

export type WordKind =
  | "pic2char"
  | "char2pic"
  | "py2char"
  | "char2word"
  | "count"
  // ↓ 1.1 追加的高年级题型
  | "lookalike"
  | "idiom"
  | "synonym"
  | "antonym"
  | "cloze"
  | "radical";

export interface WordQ extends QuizQuestion {
  kind: WordKind;
  answer: string;
}

function pickDistinct(pool: WordCard[], n: number, rand: () => number, excludeChar: string): WordCard[] {
  const others = pool.filter((c) => c.char !== excludeChar);
  const out: WordCard[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const c = pick(rand, others);
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

function qPic2Char(rand: () => number, pool: WordCard[]): WordQ {
  const target = pick(rand, pool);
  const cards = shuffled([target, ...pickDistinct(pool, 2, rand, target.char)], rand);
  return {
    kind: "pic2char", answer: target.char,
    promptHTML: `<span style="font-size:56px">${target.emoji}</span>`,
    ask: `这是「${target.word}」，哪个字是「${target.char}」？`,
    choices: cards.map((c) => c.char),
    correct: cards.indexOf(target),
  };
}

function qChar2Pic(rand: () => number, pool: WordCard[]): WordQ {
  const target = pick(rand, pool);
  const cards = shuffled([target, ...pickDistinct(pool, 2, rand, target.char)], rand);
  return {
    kind: "char2pic", answer: target.emoji,
    promptHTML: target.char,
    ask: `「${target.char}」说的是哪一个？`,
    choices: cards.map((c) => `<span style="font-size:34px">${c.emoji}</span>`),
    correct: cards.indexOf(target),
  };
}

function qPy2Char(rand: () => number, pool: WordCard[]): WordQ {
  const target = pick(rand, pool);
  const cards = shuffled([target, ...pickDistinct(pool, 2, rand, target.char)], rand);
  return {
    kind: "py2char", answer: target.char,
    promptHTML: `<span style="color:#e64980">${target.pinyin}</span>`,
    ask: "读一读拼音，选出对的字～",
    choices: cards.map((c) => c.char),
    correct: cards.indexOf(target),
  };
}

function qChar2Word(rand: () => number, pool: WordCard[]): WordQ {
  const target = pick(rand, pool);
  const cards = shuffled([target, ...pickDistinct(pool, 2, rand, target.char)], rand);
  return {
    kind: "char2word", answer: target.word,
    promptHTML: `${target.emoji} ${target.char}`,
    ask: `「${target.char}」可以组成哪个词？`,
    choices: cards.map((c) => c.word),
    correct: cards.indexOf(target),
  };
}

const COUNT_THINGS = ["🌸", "🌷", "🌻", "🍀", "🦋", "🐞"];

function qCountChar(rand: () => number, maxN: number): WordQ {
  const idx = randInt(rand, 0, Math.min(maxN, 10) - 1);
  const target = NUMBER_CARDS[idx];
  const n = NUMBER_VALUE[target.char];
  const thing = pick(rand, COUNT_THINGS);
  const cards = shuffled([target, ...pickDistinct(NUMBER_CARDS, 2, rand, target.char)], rand);
  return {
    kind: "count", answer: target.char,
    promptHTML: `<span style="font-size:26px;letter-spacing:2px;line-height:1.5">${Array.from({ length: n }, () => thing).join(" ")}</span>`,
    ask: "数一数，用哪个汉字表示？",
    choices: cards.map((c) => c.char),
    correct: cards.indexOf(target),
  };
}

// ---------------------------------------------------------------------------
// 1.1 追加：高年级题型（形近字 / 成语 / 近义 / 反义 / 句子填空 / 偏旁）
// ---------------------------------------------------------------------------

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

/** 形近字：给一个只有它才组得成的词，挑出正确的那个字 */
function qLookalike(rand: () => number): WordQ {
  const group = pick(rand, LOOKALIKE_SETS);
  const target = pick(rand, group);
  const siblings = shuffled(group.filter((x) => x.char !== target.char).map((x) => x.char), rand).slice(0, 2);
  const filler = takeDistinct(
    rand,
    LOOKALIKE_SETS.flat().map((x) => x.char),
    2 - siblings.length,
    [target.char, ...siblings]
  );
  const choices = shuffled([target.char, ...siblings, ...filler], rand);
  const blanked = target.word.replace(target.char, "□");
  return {
    kind: "lookalike", answer: target.char,
    promptHTML: `<span style="font-size:40px">${blanked}</span>`,
    ask: `${target.hint}，「□」里填哪个字？`,
    choices, correct: choices.indexOf(target.char),
  };
}

/** 成语补全：靠意思把缺的那个字填回去 */
function qIdiom(rand: () => number): WordQ {
  const card = pick(rand, IDIOM_CARDS);
  const chars = Array.from(card.idiom);
  const target = chars[card.blank];
  const pool = IDIOM_CARDS.flatMap((c) => Array.from(c.idiom)).filter((c) => c !== target);
  const choices = shuffled([target, ...takeDistinct(rand, pool, 2, [target])], rand);
  const shown = chars.map((c, i) => (i === card.blank ? "□" : c)).join("");
  return {
    kind: "idiom", answer: target,
    promptHTML: `<span style="font-size:36px;letter-spacing:4px">${shown}</span>`,
    ask: `${card.meaning}，缺哪个字？`,
    choices, correct: choices.indexOf(target),
  };
}

/** 近义词：反义词就摆在旁边当干扰项，看清楚方向才不会掉坑 */
function qSynonym(rand: () => number): WordQ {
  const card = pick(rand, SYN_ANT_CARDS);
  const extra = takeDistinct(
    rand,
    SYN_ANT_CARDS.filter((c) => c.word !== card.word).map((c) => c.synonym),
    1,
    [card.synonym, card.antonym]
  );
  const choices = shuffled([card.synonym, card.antonym, ...extra], rand);
  return {
    kind: "synonym", answer: card.synonym,
    promptHTML: `<span style="font-size:38px">${card.word}</span>`,
    ask: `「${card.word}」的近义词是哪个？`,
    choices, correct: choices.indexOf(card.synonym),
  };
}

/** 反义词：近义词摆旁边当干扰项 */
function qAntonym(rand: () => number): WordQ {
  const card = pick(rand, SYN_ANT_CARDS);
  const extra = takeDistinct(
    rand,
    SYN_ANT_CARDS.filter((c) => c.word !== card.word).map((c) => c.antonym),
    1,
    [card.synonym, card.antonym]
  );
  const choices = shuffled([card.antonym, card.synonym, ...extra], rand);
  return {
    kind: "antonym", answer: card.antonym,
    promptHTML: `<span style="font-size:38px">${card.word}</span>`,
    ask: `「${card.word}」的反义词是哪个？`,
    choices, correct: choices.indexOf(card.antonym),
  };
}

/** 句子填空：读完整句话才知道该填哪个词（干扰项是答案的反义词） */
function qCloze(rand: () => number): WordQ {
  const card = pick(rand, CLOZE_CARDS);
  const mate = SYN_ANT_CARDS.find((c) => c.word === card.answer);
  const opposite = mate ? [mate.antonym] : [];
  const extra = takeDistinct(
    rand,
    SYN_ANT_CARDS.map((c) => c.word),
    2 - opposite.length,
    [card.answer, ...opposite]
  );
  const choices = shuffled([card.answer, ...opposite, ...extra], rand);
  return {
    kind: "cloze", answer: card.answer,
    promptHTML: `<span style="font-size:19px;line-height:1.7">${card.text.replace(
      "____",
      `<span style="color:#c2255c">____</span>`
    )}</span>`,
    ask: "横线上填哪个词最合适？",
    choices, correct: choices.indexOf(card.answer),
  };
}

/** 偏旁推字义：一半问偏旁管什么，一半问哪个字属于这一类 */
function qRadical(rand: () => number): WordQ {
  const card = pick(rand, RADICAL_CARDS);
  if (rand() < 0.5) {
    const topics = RADICAL_CARDS.filter((c) => c.radical !== card.radical).map((c) => c.topic);
    const choices = shuffled([card.topic, ...takeDistinct(rand, topics, 2, [card.topic])], rand);
    return {
      kind: "radical", answer: card.topic,
      promptHTML: `<span style="font-size:44px">${card.radical}</span>`,
      ask: `带「${card.radical}」的字多半和什么有关？`,
      choices, correct: choices.indexOf(card.topic),
    };
  }
  const target = pick(rand, card.chars);
  const others = RADICAL_CARDS.filter((c) => c.radical !== card.radical).flatMap((c) => c.chars);
  const choices = shuffled([target, ...takeDistinct(rand, others, 2, [target])], rand);
  return {
    kind: "radical", answer: target,
    promptHTML: `<span style="font-size:34px">${card.radical}</span>`,
    ask: `哪个字和「${card.topic}」有关？`,
    choices, correct: choices.indexOf(target),
  };
}

/** 每关题目数：1.0 六园 4 → 7 题；1.1 新花园 6 → 9 题 */
export function questionCount(level: number): number {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  if (ci >= LEGACY_CHAPTER_SIZES.length) return 6 + Math.min(3, Math.floor(t * 3.6));
  return 4 + Math.min(3, Math.floor(t * 3.6));
}

export function kindPool(level: number): WordKind[] {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  switch (ci) {
    case 0:
      return t < 0.6 ? ["pic2char"] : ["pic2char", "char2pic"];
    case 1:
      return t < 0.5 ? ["char2pic", "pic2char"] : ["char2pic", "pic2char", "py2char"];
    case 2:
      return t < 0.4 ? ["py2char", "pic2char"] : ["py2char", "char2pic", "pic2char"];
    case 3:
      return t < 0.5 ? ["count"] : ["count", "pic2char", "py2char"];
    case 4:
      return t < 0.5 ? ["pic2char", "char2word"] : ["char2word", "char2pic", "py2char"];
    case 5:
      return t < 0.4
        ? ["pic2char", "char2pic", "char2word"]
        : ["pic2char", "char2pic", "py2char", "char2word"];
    case 6:
      return t < 0.5 ? ["lookalike"] : ["lookalike", "radical"];
    case 7:
      return t < 0.5 ? ["idiom"] : ["idiom", "lookalike"];
    case 8:
      return t < 0.4 ? ["synonym", "antonym"] : ["synonym", "antonym", "idiom"];
    case 9:
      return t < 0.4 ? ["cloze", "synonym"] : ["cloze", "antonym", "idiom", "lookalike"];
    default:
      return t < 0.4 ? ["radical", "lookalike"] : ["radical", "cloze", "idiom", "synonym"];
  }
}

/** 生成某一关的全部题目（确定性，重试不换题） */
export function buildQuestions(level: number): WordQ[] {
  const rand = mulberry32(5200 + level * 7919);
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  // 新花园（第 100–188 关）不吃老字卡池，这里只是兜底，避免下标越界
  const pool = CHAPTER_POOLS[ci] ?? CHAPTER_POOLS[CHAPTER_POOLS.length - 1];
  const kinds = kindPool(level);
  const count = questionCount(level);
  const out: WordQ[] = [];
  const usedChars: string[] = [];
  for (let i = 0; i < count; i++) {
    const kind = i < kinds.length ? kinds[i] : pick(rand, kinds);
    let q: WordQ;
    let guard = 0;
    do {
      q = makeOne(rand, pool, kind, t);
      guard++;
    } while (guard < 12 && usedChars.includes(keyChar(q)));
    usedChars.push(keyChar(q));
    out.push(q);
  }
  return shuffled(out, rand);
}

/** 本题考的核心字（尽量一关内不重复考同一个字） */
function keyChar(q: WordQ): string {
  return `${q.kind}:${q.answer}`;
}

function makeOne(rand: () => number, pool: WordCard[], kind: WordKind, t: number): WordQ {
  switch (kind) {
    case "pic2char": return qPic2Char(rand, pool);
    case "char2pic": return qChar2Pic(rand, pool);
    case "py2char": return qPy2Char(rand, pool);
    case "char2word": return qChar2Word(rand, pool);
    case "lookalike": return qLookalike(rand);
    case "idiom": return qIdiom(rand);
    case "synonym": return qSynonym(rand);
    case "antonym": return qAntonym(rand);
    case "cloze": return qCloze(rand);
    case "radical": return qRadical(rand);
    default: return qCountChar(rand, t < 0.5 ? 5 : 10);
  }
}

// ---------------------------------------------------------------------------
// 1.1 新机制一：组字工坊（两步组字）
// 先按字义挑偏旁，再挑另一半部件——两步都对才算把字造出来，
// 「青」字家族（清晴睛请情）这种同部件不同偏旁的字，必须真读懂意思才选得对。
// ---------------------------------------------------------------------------

export interface BuildCharRound {
  char: string;
  word: string;
  clue: string;
  radical: string;
  part: string;
  radicalChoices: string[];
  partChoices: string[];
}

export interface BuildCharTask {
  rounds: BuildCharRound[];
  /** 允许挑错几次 */
  maxWrong: number;
}

/** 这一关是不是「组字工坊」（只在偏旁推字园里出现） */
export function isBuildCharLevel(level: number): boolean {
  if (level < LEGACY_LEVELS) return false;
  const ci = chapterOf(CHAPTERS, level);
  if (ci !== CHAPTERS.length - 1) return false;
  return indexInChapter(CHAPTERS, level) % 2 === 0;
}

/** 生成某一关的组字工坊（确定性；只对 isBuildCharLevel 为真的关有意义） */
export function buildCharTask(level: number): BuildCharTask {
  const rand = mulberry32(8300 + level * 7919);
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  const count = 4 + Math.floor(t * 2);
  const allRadicals = [...new Set(BUILD_CHAR_CARDS.map((c) => c.radical))];
  const allParts = [...new Set(BUILD_CHAR_CARDS.map((c) => c.part))];
  const optionCount = t > 0.5 ? 4 : 3;

  const used: string[] = [];
  const rounds: BuildCharRound[] = [];
  for (let i = 0; i < count; i++) {
    let card = pick(rand, BUILD_CHAR_CARDS);
    let guard = 0;
    while (guard++ < 20 && used.includes(card.char)) card = pick(rand, BUILD_CHAR_CARDS);
    used.push(card.char);
    // 同部件不同偏旁的字优先当干扰项：这才是真正要动脑的地方
    const sameParts = BUILD_CHAR_CARDS.filter((c) => c.part === card.part && c.radical !== card.radical).map(
      (c) => c.radical
    );
    const radicalChoices = shuffled(
      [
        card.radical,
        ...takeDistinct(rand, [...sameParts, ...allRadicals], optionCount - 1, [card.radical]),
      ],
      rand
    );
    const partChoices = shuffled(
      [card.part, ...takeDistinct(rand, allParts, optionCount - 1, [card.part])],
      rand
    );
    rounds.push({
      char: card.char,
      word: card.word,
      clue: card.clue,
      radical: card.radical,
      part: card.part,
      radicalChoices,
      partChoices,
    });
  }
  return { rounds, maxWrong: t > 0.6 ? 3 : 4 };
}

// ---------------------------------------------------------------------------
// 1.1 新机制二：限时花房
// 从近反义花海开始，整关加一个倒计时；时间到也只鼓励，随时可以再来一次。
// ---------------------------------------------------------------------------

/** 本关的整关时限（毫秒）；0 表示不限时（前 99 关永远是 0） */
export function levelTimeLimitMs(level: number): number {
  if (level < LEGACY_LEVELS) return 0;
  const ci = chapterOf(CHAPTERS, level);
  if (ci <= 7) return 0;
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  const base = ci === 8 ? 180000 : ci === 9 ? 165000 : 150000;
  return Math.round(base - t * 30000);
}

/** 188 关概览（测试用） */
export const LEVELS = Array.from({ length: 188 }, (_, i) => ({
  count: questionCount(i),
  kinds: kindPool(i),
}));
