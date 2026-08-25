// 识字小花园：99 关 · 六座主题花园题库生成（一年级识字，确定性可测试）
import { mulberry32, pick, randInt, shuffled, chapterOf, indexInChapter, type Chapter } from "../level99";
import type { QuizQuestion, QuizTheme } from "../quiz99";
import { WORD_LEVELS, type WordCard } from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "青青花园", emoji: "🌿", color: "#d3f9d8", desc: "自然天地：看图认字", size: 17 },
  { name: "萌萌花园", emoji: "🐾", color: "#ffe8cc", desc: "动物朋友：认字选图", size: 17 },
  { name: "星星花园", emoji: "✨", color: "#e5dbff", desc: "身体宝贝：拼音来帮忙", size: 17 },
  { name: "数字花园", emoji: "🔢", color: "#d0f0fd", desc: "数一数，认汉字数字", size: 16 },
  { name: "亲亲花园", emoji: "🏠", color: "#ffdeeb", desc: "家人称呼 + 给字组词", size: 16 },
  { name: "美味花园", emoji: "🍉", color: "#fff3bf", desc: "美味食物：混合大挑战", size: 16 },
];

export const CHAPTER_THEMES: QuizTheme[] = [
  { bg: "linear-gradient(#e3fafc 0 55%,#d3f9d8 55% 100%)", accent: "#2b8a3e" },
  { bg: "linear-gradient(#fff4e6 0 55%,#ffe8cc 55% 100%)", accent: "#d9480f" },
  { bg: "linear-gradient(#f3f0ff 0 55%,#e5dbff 55% 100%)", accent: "#6741d9" },
  { bg: "linear-gradient(#e7f5ff 0 55%,#d0f0fd 55% 100%)", accent: "#1971c2" },
  { bg: "linear-gradient(#fff0f6 0 55%,#ffdeeb 55% 100%)", accent: "#c2255c" },
  { bg: "linear-gradient(#fff9db 0 55%,#fff3bf 55% 100%)", accent: "#e8590c" },
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

export type WordKind = "pic2char" | "char2pic" | "py2char" | "char2word" | "count";

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

/** 每关题目数：章节内 4 → 7 题递增 */
export function questionCount(level: number): number {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
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
    default:
      return t < 0.4
        ? ["pic2char", "char2pic", "char2word"]
        : ["pic2char", "char2pic", "py2char", "char2word"];
  }
}

/** 生成某一关的全部题目（确定性，重试不换题） */
export function buildQuestions(level: number): WordQ[] {
  const rand = mulberry32(5200 + level * 7919);
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  const pool = CHAPTER_POOLS[ci];
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
    default: return qCountChar(rand, t < 0.5 ? 5 : 10);
  }
}

/** 99 关概览（测试用） */
export const LEVELS = Array.from({ length: 99 }, (_, i) => ({
  count: questionCount(i),
  kinds: kindPool(i),
}));
