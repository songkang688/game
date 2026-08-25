// 识字小花园：常见象形字出题纯逻辑

export type WordCard = {
  char: string;
  pinyin: string;
  /** 帮助理解的词语，例如「太阳」 */
  word: string;
  emoji: string;
};

export const WORD_BANK: WordCard[] = [
  { char: "日", pinyin: "rì", word: "太阳", emoji: "☀️" },
  { char: "月", pinyin: "yuè", word: "月亮", emoji: "🌙" },
  { char: "水", pinyin: "shuǐ", word: "水滴", emoji: "💧" },
  { char: "火", pinyin: "huǒ", word: "火苗", emoji: "🔥" },
  { char: "山", pinyin: "shān", word: "大山", emoji: "⛰️" },
  { char: "田", pinyin: "tián", word: "田地", emoji: "🌾" },
  { char: "木", pinyin: "mù", word: "树木", emoji: "🌳" },
  { char: "花", pinyin: "huā", word: "花朵", emoji: "🌸" },
  { char: "鸟", pinyin: "niǎo", word: "小鸟", emoji: "🐦" },
  { char: "鱼", pinyin: "yú", word: "小鱼", emoji: "🐟" },
  { char: "云", pinyin: "yún", word: "白云", emoji: "☁️" },
  { char: "雨", pinyin: "yǔ", word: "下雨", emoji: "🌧️" },
  { char: "手", pinyin: "shǒu", word: "小手", emoji: "✋" },
  { char: "口", pinyin: "kǒu", word: "嘴巴", emoji: "👄" },
  { char: "耳", pinyin: "ěr", word: "耳朵", emoji: "👂" },
  { char: "虫", pinyin: "chóng", word: "虫子", emoji: "🐛" },
];

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
 * 出一道「看图选字」题。
 * @param exclude 最近用过的字，尽量不重复出题
 */
export function makeWordQuestion(rand: () => number = Math.random, exclude: string[] = []): WordQuestion {
  const fresh = WORD_BANK.filter((c) => !exclude.includes(c.char));
  const pool = fresh.length > 0 ? fresh : WORD_BANK;
  const target = pick(pool, rand);

  const others = WORD_BANK.filter((c) => c.char !== target.char);
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
