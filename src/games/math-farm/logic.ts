// 算数小农场：出题纯逻辑
// 第 1 关：10 以内加减法
// 第 2 关：20 以内不进位加法 / 不退位减法
// 第 3 关：进位加法 / 退位减法预备题（可用开关退回不进退位）

export type MathQuestion = {
  a: number;
  b: number;
  op: "+" | "-";
  answer: number;
  /** 三个候选答案（含正确答案），已打乱 */
  choices: number[];
};

export type MathLevel = 1 | 2 | 3;

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

function withChoices(a: number, b: number, op: "+" | "-", max: number, rand: () => number): MathQuestion {
  const answer = op === "+" ? a + b : a - b;
  const set = new Set<number>([answer]);
  // 干扰项优先取正确答案附近的数，孩子更需要认真算
  let guard = 0;
  while (set.size < 3 && guard < 100) {
    guard++;
    const near = answer + randInt(rand, -3, 3);
    if (near >= 0 && near <= max) set.add(near);
  }
  while (set.size < 3) set.add(randInt(rand, 0, max));
  return { a, b, op, answer, choices: shuffle([...set], rand) };
}

/**
 * 第 1 关：10 以内加减法
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
  return withChoices(a, b, op, 10, rand);
}

/**
 * 第 2 关：20 以内、不进位不退位。
 * - 加法：个位相加不满 10，且和不超过 20
 * - 减法：被减数 20 以内，个位够减
 */
export function makeNoCarryQuestion(rand: () => number = Math.random): MathQuestion {
  const op: "+" | "-" = rand() < 0.5 ? "+" : "-";
  if (op === "+") {
    let a = 0, b = 0;
    do {
      a = randInt(rand, 10, 19);
      b = randInt(rand, 1, 9);
    } while ((a % 10) + b >= 10 || a + b > 20);
    return withChoices(a, b, "+", 20, rand);
  }
  let a = 0, b = 0;
  do {
    a = randInt(rand, 11, 20);
    b = randInt(rand, 1, 9);
  } while (a % 10 < b);
  return withChoices(a, b, "-", 20, rand);
}

/**
 * 第 3 关：进位 / 退位预备题。
 * - 进位加法：个位相加满 10，和不超过 20（如 8+5）
 * - 退位减法：被减数 11..18，个位不够减（如 13-6）
 */
export function makeCarryQuestion(rand: () => number = Math.random): MathQuestion {
  const op: "+" | "-" = rand() < 0.5 ? "+" : "-";
  if (op === "+") {
    let a = 0, b = 0;
    do {
      a = randInt(rand, 5, 9);
      b = randInt(rand, 2, 9);
    } while (a + b < 11 || a + b > 20);
    return withChoices(a, b, "+", 20, rand);
  }
  let a = 0, b = 0;
  do {
    a = randInt(rand, 11, 18);
    b = randInt(rand, 2, 9);
  } while (a % 10 >= b);
  return withChoices(a, b, "-", 20, rand);
}

/**
 * 按关卡出题。carryEnabled 为 false 时，第 3 关退回不进退位题。
 */
export function makeQuestionForLevel(
  level: MathLevel,
  carryEnabled: boolean,
  rand: () => number = Math.random
): MathQuestion {
  if (level === 1) return makeMathQuestion(rand);
  if (level === 2) return makeNoCarryQuestion(rand);
  return carryEnabled ? makeCarryQuestion(rand) : makeNoCarryQuestion(rand);
}
