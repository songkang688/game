// 算数小农场：出题纯逻辑（10 以内加减法）

export type MathQuestion = {
  a: number;
  b: number;
  op: "+" | "-";
  answer: number;
  /** 三个候选答案（含正确答案），已打乱 */
  choices: number[];
};

export function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 生成一道 10 以内加减法题：
 * - 加法：a + b <= 10
 * - 减法：a >= b（结果不为负）
 * - 不会出现 0 + 0 / 0 - 0 这种没意思的题
 */
export function makeMathQuestion(rand: () => number = Math.random): MathQuestion {
  const op: "+" | "-" = rand() < 0.5 ? "+" : "-";
  let a = 0;
  let b = 0;
  do {
    if (op === "+") {
      a = randInt(rand, 0, 10);
      b = randInt(rand, 0, 10 - a);
    } else {
      a = randInt(rand, 0, 10);
      b = randInt(rand, 0, a);
    }
  } while (a === 0 && b === 0);

  const answer = op === "+" ? a + b : a - b;
  const set = new Set<number>([answer]);
  while (set.size < 3) {
    set.add(randInt(rand, 0, 10));
  }
  return { a, b, op, answer, choices: shuffle([...set], rand) };
}
