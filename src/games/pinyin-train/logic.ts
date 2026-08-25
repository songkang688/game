// 拼音小火车：出题纯逻辑

export const VOWELS = ["a", "o", "e", "i", "u", "ü"];
export const INITIALS = ["b", "p", "m", "f", "d", "t", "n", "l"];
/** 容易认混的字母分组，用于「找相同」题 */
export const LOOKALIKE_GROUPS: string[][] = [
  ["b", "d", "p", "q"],
  ["m", "n"],
  ["u", "ü"],
  ["f", "t"],
];

export type PinyinQuestion = {
  kind: "vowel" | "initial" | "match";
  /** 题目提示文字 */
  prompt: string;
  /** 「找相同」题时车头上展示的大字母，其它题为空字符串 */
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

export function makePinyinQuestion(rand: () => number = Math.random): PinyinQuestion {
  const r = rand();
  if (r < 1 / 3) {
    // 从三个字母里找出唯一的韵母
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
  if (r < 2 / 3) {
    // 找出唯一的声母
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
  // 在容易认混的字母里，找出和车头一样的那个
  const group = pick(LOOKALIKE_GROUPS, rand);
  const target = pick(group, rand);
  const distractors = pickDistinct(group, Math.min(2, group.length - 1), rand, [target]);
  if (distractors.length < 2) {
    distractors.push(...pickDistinct([...VOWELS, ...INITIALS], 2 - distractors.length, rand, [target, ...distractors]));
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
