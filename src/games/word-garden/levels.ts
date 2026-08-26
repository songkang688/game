// 识字小花园：188 关 · 十一座主题花园题库生成（确定性可测试）
// 前 99 关是 1.0 的六座花园，一个字都没动；1.1 在末尾追加五座高年级花园（第 100–188 关）。
import { mulberry32, pick, randInt, shuffled, chapterOf, indexInChapter, type Chapter } from "../level99";
import type { QuizQuestion, QuizTheme } from "../quiz99";
import {
  BUILD_CHAR_CARDS,
  CLOZE_CARDS,
  IDIOM_CARDS,
  LOOKALIKE_SETS,
  POLYPHONE_CARDS,
  RADICAL_CARDS,
  SYN_ANT_CARDS,
  WORD_LEVELS,
  lookalikeGroupOf,
  realWordList,
  type WordCard,
} from "./logic";
import { hasStrokes } from "./strokes";

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
  { char: "一", pinyin: "yī", word: "一个", emoji: "1️⃣", meaning: "数目里最小的那个正整数，单个儿" },
  { char: "二", pinyin: "èr", word: "二月", emoji: "2️⃣", meaning: "一加一得到的数" },
  { char: "三", pinyin: "sān", word: "三只", emoji: "3️⃣", meaning: "二再加一得到的数" },
  { char: "四", pinyin: "sì", word: "四个", emoji: "4️⃣", meaning: "三再加一得到的数" },
  { char: "五", pinyin: "wǔ", word: "五角星", emoji: "5️⃣", meaning: "一只手的手指头那么多" },
  { char: "六", pinyin: "liù", word: "六岁", emoji: "6️⃣", meaning: "五再加一得到的数" },
  { char: "七", pinyin: "qī", word: "七彩", emoji: "7️⃣", meaning: "六再加一得到的数" },
  { char: "八", pinyin: "bā", word: "八个", emoji: "8️⃣", meaning: "七再加一得到的数" },
  { char: "九", pinyin: "jiǔ", word: "九层", emoji: "9️⃣", meaning: "个位里最大的那个数" },
  { char: "十", pinyin: "shí", word: "十分", emoji: "🔟", meaning: "九再加一，正好满一个整数位" },
];
const NUMBER_VALUE: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

/** 第五章：家人与称呼 */
export const FAMILY_CARDS: WordCard[] = [
  { char: "爸", pinyin: "bà", word: "爸爸", emoji: "👨", meaning: "家里的男性长辈，孩子管他叫父亲" },
  { char: "妈", pinyin: "mā", word: "妈妈", emoji: "👩", meaning: "家里的女性长辈，孩子管她叫母亲" },
  { char: "爷", pinyin: "yé", word: "爷爷", emoji: "👴", meaning: "父亲的父亲，家里辈分最高的男长辈" },
  { char: "奶", pinyin: "nǎi", word: "奶奶", emoji: "👵", meaning: "父亲的母亲，家里辈分高的女长辈" },
  { char: "哥", pinyin: "gē", word: "哥哥", emoji: "👦", meaning: "同辈里比自己大的男孩" },
  { char: "姐", pinyin: "jiě", word: "姐姐", emoji: "👧", meaning: "同辈里比自己大的女孩" },
  { char: "弟", pinyin: "dì", word: "弟弟", emoji: "🧒", meaning: "同辈里比自己小的男孩" },
  { char: "妹", pinyin: "mèi", word: "妹妹", emoji: "👶", meaning: "同辈里比自己小的女孩" },
  { char: "我", pinyin: "wǒ", word: "我们", emoji: "🙋", meaning: "说话的那一位自称的时候用它" },
  { char: "友", pinyin: "yǒu", word: "朋友", emoji: "🤝", meaning: "合得来、常在一起玩的伙伴" },
  { char: "家", pinyin: "jiā", word: "家人", emoji: "🏠", meaning: "自己住的那个地方，回去就踏实" },
  { char: "爱", pinyin: "ài", word: "爱心", emoji: "💖", meaning: "很喜欢、很在乎的那种心情" },
  { char: "笑", pinyin: "xiào", word: "笑脸", emoji: "😄", meaning: "高兴的时候脸上的样子" },
  { char: "好", pinyin: "hǎo", word: "你好", emoji: "👍", meaning: "不错，让大家满意" },
  { char: "宝", pinyin: "bǎo", word: "宝贝", emoji: "🍼", meaning: "很珍贵、舍不得的东西" },
  { char: "亲", pinyin: "qīn", word: "亲人", emoji: "🥰", meaning: "关系很近、很贴心" },
];

/** 第六章：美味食物 */
export const FOOD_CARDS: WordCard[] = [
  { char: "瓜", pinyin: "guā", word: "西瓜", emoji: "🍉", meaning: "藤上结的大果实，切开红瓤黑籽" },
  { char: "豆", pinyin: "dòu", word: "豆子", emoji: "🫘", meaning: "一粒一粒圆圆的，能煮能磨" },
  { char: "菜", pinyin: "cài", word: "青菜", emoji: "🥬", meaning: "能吃的绿叶植物，炒着吃" },
  { char: "蛋", pinyin: "dàn", word: "鸡蛋", emoji: "🥚", meaning: "圆圆一个，敲开里面有黄有清" },
  { char: "肉", pinyin: "ròu", word: "烤肉", emoji: "🍖", meaning: "能吃的那部分，红红的，有嚼头" },
  { char: "茶", pinyin: "chá", word: "热茶", emoji: "🍵", meaning: "泡出来的褐色饮品，微苦回甘" },
  { char: "糖", pinyin: "táng", word: "糖果", emoji: "🍬", meaning: "甜甜的一小块，含在嘴里会化" },
  { char: "面", pinyin: "miàn", word: "面条", emoji: "🍜", meaning: "磨成粉做成的长条，煮着吃" },
  { char: "包", pinyin: "bāo", word: "面包", emoji: "🍞", meaning: "外面一层裹住里面，也指裹好的那种食物" },
  { char: "桃", pinyin: "táo", word: "桃子", emoji: "🍑", meaning: "夏季的果子，尖尖的，外皮毛茸茸" },
  { char: "梨", pinyin: "lí", word: "梨子", emoji: "🍐", meaning: "秋季的果子，脆甜多汁" },
  { char: "橙", pinyin: "chéng", word: "橙子", emoji: "🍊", meaning: "黄红色的圆果子，剥开一瓣一瓣" },
  { char: "汤", pinyin: "tāng", word: "热汤", emoji: "🍲", meaning: "煮出来的一碗，稀稀的，能喝" },
  { char: "虾", pinyin: "xiā", word: "大虾", emoji: "🦐", meaning: "河里海里游的小东西，煮熟变红" },
  { char: "饼", pinyin: "bǐng", word: "饼干", emoji: "🍪", meaning: "扁扁圆圆、烙出来或烤出来的" },
  { char: "麦", pinyin: "mài", word: "麦子", emoji: "🌾", meaning: "地里种的作物，磨成粉做馒头" },
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
  | "radical"
  // ↓ 1.2 追加
  /** 多音字辨析：同一个字摆进两句话，读音就变了 */
  | "polyphone"
  /** 给字选意思：错题复查专用的「换个问法」 */
  | "meaning";

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

/**
 * 形近字：给一个只有它才组得成的词，挑出正确的那个字。
 *
 * 1.2 起干扰项**只从同一组里取**。1.1 的组大多只有 2 个字，凑不齐三选一时
 * 会从全表随便抓一个，结果 46% 的干扰项跟正确答案毫无关系；
 * 现在每组都补到 ≥3 个字，组内两两共享部件或只差一笔，随便挑都是真形近。
 */
function qLookalike(rand: () => number): WordQ {
  const group = pick(rand, LOOKALIKE_SETS);
  const target = pick(rand, group);
  const siblings = shuffled(group.filter((x) => x.char !== target.char).map((x) => x.char), rand).slice(0, 2);
  const choices = shuffled([target.char, ...siblings], rand);
  const blanked = target.word.replace(target.char, "□");
  return {
    kind: "lookalike", answer: target.char,
    promptHTML: `<span style="font-size:40px">${blanked}</span>`,
    ask: `${target.hint}，「□」里填哪个字？`,
    choices, correct: choices.indexOf(target.char),
  };
}

/** 多音字辨析：同一个字，换一句话就换一个读音 */
function qPolyphone(rand: () => number): WordQ {
  const card = pick(rand, POLYPHONE_CARDS);
  const at = rand() < 0.5 ? 0 : 1;
  const right = card.readings[at];
  const other = card.readings[1 - at];
  const choices = shuffled([right.pinyin, other.pinyin, card.decoy], rand);
  const shown = right.sentence.replace(
    card.char,
    `<span style="color:#c2255c">${card.char}</span>`
  );
  return {
    kind: "polyphone", answer: right.pinyin,
    promptHTML: `<span style="font-size:19px;line-height:1.7">${shown}</span>`,
    ask: `这句话里的「${card.char}」读什么？`,
    choices, correct: choices.indexOf(right.pinyin),
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
      // 句子填空亭：读懂整句才选得对，多音字正好也是「回到句子里」，1.2 排进来
      return t < 0.4 ? ["cloze", "synonym", "polyphone"] : ["cloze", "antonym", "polyphone", "idiom", "lookalike"];
    default:
      return t < 0.4
        ? ["radical", "lookalike", "polyphone"]
        : ["radical", "cloze", "polyphone", "idiom", "synonym"];
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
    case "polyphone": return qPolyphone(rand);
    default: return qCountChar(rand, t < 0.5 ? 5 : 10);
  }
}

// ---------------------------------------------------------------------------
// 1.2 新机制一：笔顺描红台
// 前 8 章都在「认」，这里第一次让孩子把字**写**出来：田字格里按顺序描，
// 描错顺序只温和提示重来，不扣分也不判失败。
// ---------------------------------------------------------------------------

/** 描红台每三关来一次（只在形近字迷宫里；一笔之差的字正好靠描红体会） */
export const TRACE_CHAPTER = 6;

/** 这一关是不是「笔顺描红台」 */
export function isTraceLevel(level: number): boolean {
  if (level < LEGACY_LEVELS) return false;
  if (chapterOf(CHAPTERS, level) !== TRACE_CHAPTER) return false;
  return indexInChapter(CHAPTERS, level) % 3 === 2;
}

/** 描红台一关描几个字：章节越往后越多，最多 4 个 */
export function traceCharCount(level: number): number {
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[TRACE_CHAPTER].size - 1);
  return 2 + Math.min(2, Math.floor(t * 3));
}

// ---------------------------------------------------------------------------
// 1.2 新机制二：错题本换题型复查
// 「答错的是哪个字」不写进 WordQ（前 99 关的题目 JSON 一个字节都不能变），
// 而是靠下面这个纯函数从题目反查出来。
// ---------------------------------------------------------------------------

const ALL_CARDS: WordCard[] = CHAPTER_POOLS.flat();
const stripTags = (html: string): string => html.replace(/<[^>]+>/g, "");

/**
 * 受控真词表：组词题的每一个选项都必须落在这张表里。
 * 表里全是六张字卡表、形近字组、组字工坊、近反义卡上真实出现过的词 ——
 * 一个生造出来凑数的词都没有，`bank.test.ts` 会逐题反查。
 */
export const REAL_WORDS: ReadonlySet<string> = new Set(realWordList(ALL_CARDS.map((c) => c.word)));

/** 这道题在考哪个字（近反义与填空考的是词，就返回那个词） */
export function questionFocus(q: WordQ): string {
  switch (q.kind) {
    case "char2pic": {
      const card = ALL_CARDS.find((c) => c.char === stripTags(q.promptHTML).trim());
      return card?.char ?? "";
    }
    case "char2word": {
      const card = ALL_CARDS.find((c) => c.word === q.answer);
      return card?.char ?? "";
    }
    case "synonym":
    case "antonym":
      return stripTags(q.promptHTML).trim();
    case "polyphone": {
      const hit = POLYPHONE_CARDS.find((c) => q.ask.includes(`「${c.char}」`));
      return hit?.char ?? "";
    }
    case "radical": {
      const byTopic = RADICAL_CARDS.find((c) => q.ask.includes(`「${c.topic}」`));
      return byTopic ? q.answer : stripTags(q.promptHTML).trim();
    }
    default:
      return q.answer;
  }
}

function meaningQuestion(char: string, rand: () => number): WordQ | null {
  const card = ALL_CARDS.find((c) => c.char === char);
  if (card) {
    const others = takeDistinct(rand, ALL_CARDS.filter((c) => c.char !== char).map((c) => c.meaning), 2, [
      card.meaning,
    ]);
    if (others.length < 2) return null;
    const choices = shuffled([card.meaning, ...others], rand);
    return {
      kind: "meaning", answer: card.meaning,
      promptHTML: `<span style="font-size:48px">${card.char}</span>`,
      ask: `「${card.char}」是什么意思？`,
      choices, correct: choices.indexOf(card.meaning),
    };
  }
  const idiom = IDIOM_CARDS.find((c) => Array.from(c.idiom)[c.blank] === char);
  if (!idiom) return null;
  const others = takeDistinct(rand, IDIOM_CARDS.filter((c) => c !== idiom).map((c) => c.meaning), 2, [
    idiom.meaning,
  ]);
  if (others.length < 2) return null;
  const choices = shuffled([idiom.meaning, ...others], rand);
  return {
    kind: "meaning", answer: idiom.meaning,
    promptHTML: `<span style="font-size:34px;letter-spacing:4px">${idiom.idiom}</span>`,
    ask: `「${idiom.idiom}」是什么意思？`,
    choices, correct: choices.indexOf(idiom.meaning),
  };
}

function cardQuestion(kind: WordKind, char: string, rand: () => number): WordQ | null {
  const ci = CHAPTER_POOLS.findIndex((pool) => pool.some((c) => c.char === char));
  if (ci < 0) return null;
  const pool = CHAPTER_POOLS[ci];
  const target = pool.find((c) => c.char === char);
  if (!target || pool.length < 3) return null;
  const cards = shuffled([target, ...pickDistinct(pool, 2, rand, target.char)], rand);
  switch (kind) {
    case "pic2char":
      return {
        kind, answer: target.char,
        promptHTML: `<span style="font-size:56px">${target.emoji}</span>`,
        ask: `这是「${target.word}」，哪个字是「${target.char}」？`,
        choices: cards.map((c) => c.char), correct: cards.indexOf(target),
      };
    case "char2pic":
      return {
        kind, answer: target.emoji,
        promptHTML: target.char,
        ask: `「${target.char}」说的是哪一个？`,
        choices: cards.map((c) => `<span style="font-size:34px">${c.emoji}</span>`),
        correct: cards.indexOf(target),
      };
    case "py2char":
      return {
        kind, answer: target.char,
        promptHTML: `<span style="color:#e64980">${target.pinyin}</span>`,
        ask: "读一读拼音，选出对的字～",
        choices: cards.map((c) => c.char), correct: cards.indexOf(target),
      };
    case "char2word":
      return {
        kind, answer: target.word,
        promptHTML: `${target.emoji} ${target.char}`,
        ask: `「${target.char}」可以组成哪个词？`,
        choices: cards.map((c) => c.word), correct: cards.indexOf(target),
      };
    default:
      return null;
  }
}

/** 形近字换个问法：给字选词（干扰项是同组兄弟的真词，不是生造词） */
function lookalikeWordQuestion(char: string, rand: () => number): WordQ | null {
  const group = lookalikeGroupOf(char);
  const target = group.find((x) => x.char === char);
  if (!target || group.length < 3) return null;
  const others = shuffled(group.filter((x) => x.char !== char), rand).slice(0, 2);
  const choices = shuffled([target.word, ...others.map((x) => x.word)], rand);
  return {
    kind: "char2word", answer: target.word,
    promptHTML: `<span style="font-size:48px">${char}</span>`,
    ask: `「${char}」能组成下面哪个词？`,
    choices, correct: choices.indexOf(target.word),
  };
}

function polyphoneQuestion(char: string, rand: () => number): WordQ | null {
  if (!POLYPHONE_CARDS.some((c) => c.char === char)) return null;
  let q = qPolyphone(rand);
  for (let i = 0; i < 40 && questionFocus(q) !== char; i++) q = qPolyphone(rand);
  return questionFocus(q) === char ? q : null;
}

function synAntQuestion(kind: "synonym" | "antonym" | "cloze", word: string, rand: () => number): WordQ | null {
  if (kind === "cloze") {
    const card = CLOZE_CARDS.find((c) => c.answer === word);
    if (!card) return null;
    let q = qCloze(rand);
    for (let i = 0; i < 60 && q.answer !== word; i++) q = qCloze(rand);
    return q.answer === word ? q : null;
  }
  if (!SYN_ANT_CARDS.some((c) => c.word === word)) return null;
  let q = kind === "synonym" ? qSynonym(rand) : qAntonym(rand);
  for (let i = 0; i < 60 && stripTags(q.promptHTML).trim() !== word; i++) {
    q = kind === "synonym" ? qSynonym(rand) : qAntonym(rand);
  }
  return stripTags(q.promptHTML).trim() === word ? q : null;
}

/** 复查轮的候选题型，按这个顺序试第一个能出得来的 */
const REVIEW_ORDER: WordKind[] = [
  "meaning",
  "char2word",
  "py2char",
  "pic2char",
  "char2pic",
  "polyphone",
  "antonym",
  "synonym",
  "cloze",
];

function buildReviewOne(kind: WordKind, focus: string, rand: () => number): WordQ | null {
  switch (kind) {
    case "meaning": return meaningQuestion(focus, rand);
    case "char2word": return cardQuestion("char2word", focus, rand) ?? lookalikeWordQuestion(focus, rand);
    case "py2char":
    case "pic2char":
    case "char2pic": return cardQuestion(kind, focus, rand);
    case "polyphone": return polyphoneQuestion(focus, rand);
    case "synonym":
    case "antonym":
    case "cloze": return synAntQuestion(kind, focus, rand);
    default: return null;
  }
}

/**
 * 给答错的那个字换一种题型再考一遍。
 * @param focus 答错的字（近反义与填空是词）
 * @param avoid 刚才错的是哪种题型 —— 复查一定换一种，换不出来就返回 null
 */
export function makeReviewQuestion(focus: string, avoid: WordKind, seed: number): WordQ | null {
  if (!focus) return null;
  const rand = mulberry32(9700 + seed * 7919);
  for (const kind of REVIEW_ORDER) {
    if (kind === avoid) continue;
    const q = buildReviewOne(kind, focus, rand);
    if (q && q.choices.length === 3 && new Set(q.choices).size === 3) return q;
  }
  return null;
}

/** 一关答完，给错过的字排一轮复查题（同一个字只复查一次，题型一定和刚才不同） */
export function buildReviewRound(
  wrong: ReadonlyArray<{ focus: string; kind: WordKind }>,
  level: number
): WordQ[] {
  const out: WordQ[] = [];
  const seen = new Set<string>();
  wrong.forEach((w, i) => {
    if (!w.focus || seen.has(w.focus)) return;
    seen.add(w.focus);
    const q = makeReviewQuestion(w.focus, w.kind, level * 31 + i);
    if (q) out.push(q);
  });
  return out;
}

/** 这个字能不能进描红台（错题本回顾时用来判断要不要建议去描一描） */
export function traceableFocus(focus: string): boolean {
  return hasStrokes(focus);
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
