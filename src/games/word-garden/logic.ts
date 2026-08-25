// 识字小花园：常见字出题纯逻辑（三座主题花园 + 错题本）

export type WordCard = {
  char: string;
  pinyin: string;
  /** 帮助理解的词语，例如「太阳」 */
  word: string;
  emoji: string;
};

export type WordLevel = {
  name: string;
  desc: string;
  emoji: string;
  cards: WordCard[];
};

export const WORD_LEVELS: WordLevel[] = [
  {
    name: "青青花园",
    desc: "自然天地",
    emoji: "🌿",
    cards: [
      { char: "日", pinyin: "rì", word: "太阳", emoji: "☀️" },
      { char: "月", pinyin: "yuè", word: "月亮", emoji: "🌙" },
      { char: "水", pinyin: "shuǐ", word: "水滴", emoji: "💧" },
      { char: "火", pinyin: "huǒ", word: "火苗", emoji: "🔥" },
      { char: "山", pinyin: "shān", word: "大山", emoji: "⛰️" },
      { char: "田", pinyin: "tián", word: "田地", emoji: "🌾" },
      { char: "木", pinyin: "mù", word: "树木", emoji: "🌳" },
      { char: "花", pinyin: "huā", word: "花朵", emoji: "🌸" },
      { char: "云", pinyin: "yún", word: "白云", emoji: "☁️" },
      { char: "雨", pinyin: "yǔ", word: "下雨", emoji: "🌧️" },
      { char: "雪", pinyin: "xuě", word: "雪花", emoji: "❄️" },
      { char: "星", pinyin: "xīng", word: "星星", emoji: "⭐" },
      { char: "电", pinyin: "diàn", word: "闪电", emoji: "⚡" },
      { char: "风", pinyin: "fēng", word: "大风", emoji: "🌬️" },
      { char: "天", pinyin: "tiān", word: "天空", emoji: "🌤️" },
      { char: "叶", pinyin: "yè", word: "树叶", emoji: "🍃" },
      { char: "草", pinyin: "cǎo", word: "小草", emoji: "🌱" },
      { char: "竹", pinyin: "zhú", word: "竹子", emoji: "🎋" },
    ],
  },
  {
    name: "萌萌花园",
    desc: "动物朋友",
    emoji: "🐾",
    cards: [
      { char: "鸟", pinyin: "niǎo", word: "小鸟", emoji: "🐦" },
      { char: "鱼", pinyin: "yú", word: "小鱼", emoji: "🐟" },
      { char: "虫", pinyin: "chóng", word: "虫子", emoji: "🐛" },
      { char: "牛", pinyin: "niú", word: "小牛", emoji: "🐮" },
      { char: "羊", pinyin: "yáng", word: "小羊", emoji: "🐑" },
      { char: "马", pinyin: "mǎ", word: "小马", emoji: "🐴" },
      { char: "狗", pinyin: "gǒu", word: "小狗", emoji: "🐶" },
      { char: "猫", pinyin: "māo", word: "小猫", emoji: "🐱" },
      { char: "兔", pinyin: "tù", word: "兔子", emoji: "🐰" },
      { char: "猪", pinyin: "zhū", word: "小猪", emoji: "🐷" },
      { char: "鸡", pinyin: "jī", word: "小鸡", emoji: "🐔" },
      { char: "鸭", pinyin: "yā", word: "鸭子", emoji: "🦆" },
      { char: "龟", pinyin: "guī", word: "乌龟", emoji: "🐢" },
      { char: "熊", pinyin: "xióng", word: "小熊", emoji: "🐻" },
      { char: "象", pinyin: "xiàng", word: "大象", emoji: "🐘" },
      { char: "虎", pinyin: "hǔ", word: "老虎", emoji: "🐯" },
      { char: "蛙", pinyin: "wā", word: "青蛙", emoji: "🐸" },
      { char: "鹅", pinyin: "é", word: "白鹅", emoji: "🦢" },
    ],
  },
  {
    name: "星星花园",
    desc: "身体和宝贝",
    emoji: "✨",
    cards: [
      { char: "手", pinyin: "shǒu", word: "小手", emoji: "✋" },
      { char: "口", pinyin: "kǒu", word: "嘴巴", emoji: "👄" },
      { char: "耳", pinyin: "ěr", word: "耳朵", emoji: "👂" },
      { char: "目", pinyin: "mù", word: "眼睛", emoji: "👀" },
      { char: "足", pinyin: "zú", word: "小脚", emoji: "🦶" },
      { char: "牙", pinyin: "yá", word: "牙齿", emoji: "🦷" },
      { char: "心", pinyin: "xīn", word: "爱心", emoji: "❤️" },
      { char: "人", pinyin: "rén", word: "人儿", emoji: "🧍" },
      { char: "门", pinyin: "mén", word: "大门", emoji: "🚪" },
      { char: "车", pinyin: "chē", word: "汽车", emoji: "🚗" },
      { char: "船", pinyin: "chuán", word: "小船", emoji: "⛵" },
      { char: "伞", pinyin: "sǎn", word: "雨伞", emoji: "☂️" },
      { char: "书", pinyin: "shū", word: "书本", emoji: "📖" },
      { char: "笔", pinyin: "bǐ", word: "铅笔", emoji: "✏️" },
      { char: "灯", pinyin: "dēng", word: "灯泡", emoji: "💡" },
      { char: "球", pinyin: "qiú", word: "皮球", emoji: "⚽" },
      { char: "果", pinyin: "guǒ", word: "果子", emoji: "🍎" },
      { char: "米", pinyin: "mǐ", word: "大米", emoji: "🍚" },
    ],
  },
];

export const WORD_BANK: WordCard[] = WORD_LEVELS.flatMap((l) => l.cards);

export type WordQuestion = {
  target: WordCard;
  /** 三个候选字卡（含正确的），已打乱 */
  choices: WordCard[];
  answerIndex: number;
};

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * 从指定字卡池里出一道「看图选字」题。
 * @param pool 本关可出题的字卡池（至少 3 张）
 * @param exclude 最近用过 / 已答对的字，尽量不重复出题
 */
export function makeQuestionFrom(
  pool: WordCard[],
  rand: () => number = Math.random,
  exclude: string[] = []
): WordQuestion {
  const fresh = pool.filter((c) => !exclude.includes(c.char));
  const candidates = fresh.length > 0 ? fresh : pool;
  const target = pick(candidates, rand);

  const others = pool.filter((c) => c.char !== target.char);
  const distractors: WordCard[] = [];
  while (distractors.length < 2) {
    const d = pick(others, rand);
    if (!distractors.includes(d)) distractors.push(d);
  }

  const choices = [target, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { target, choices, answerIndex: choices.indexOf(target) };
}

/** 从全部字库出一道题（兼容旧接口）。 */
export function makeWordQuestion(rand: () => number = Math.random, exclude: string[] = []): WordQuestion {
  return makeQuestionFrom(WORD_BANK, rand, exclude);
}

/** 针对某个指定字出一道题（错题本再练用）。 */
export function makeReviewQuestion(card: WordCard, rand: () => number = Math.random): WordQuestion {
  const others = WORD_BANK.filter((c) => c.char !== card.char);
  const distractors: WordCard[] = [];
  while (distractors.length < 2) {
    const d = pick(others, rand);
    if (!distractors.includes(d)) distractors.push(d);
  }
  const choices = [card, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { target: card, choices, answerIndex: choices.indexOf(card) };
}
