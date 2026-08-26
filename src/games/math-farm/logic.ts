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

// ---------------------------------------------------------------------------
// 1.1 新增：带余除法、分数、一位小数（第 100–188 关专用纯逻辑）
// 上面那套 20 以内加减法接口一个都没动，前 99 关照旧。
// ---------------------------------------------------------------------------

/** 最大公约数（辗转相除） */
export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x === 0 ? 1 : x;
}

/** 约分成最简分数（分母恒为正） */
export function simplifyFraction(n: number, d: number): { n: number; d: number } {
  if (d === 0) return { n: 0, d: 1 };
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: (sign * Math.round(n)) / g, d: (sign * Math.round(d)) / g };
}

/** 分数写法「3/4」 */
export function formatFraction(n: number, d: number): string {
  return `${n}/${d}`;
}

/** 比较两个分数：a 大返回 1，b 大返回 -1，一样大返回 0 */
export function compareFractions(an: number, ad: number, bn: number, bd: number): -1 | 0 | 1 {
  const left = an * bd;
  const right = bn * ad;
  if (left > right) return 1;
  if (left < right) return -1;
  return 0;
}

/** 带余除法：返回商与余数（除数必须是正整数） */
export function divideWithRemainder(a: number, b: number): { quotient: number; remainder: number } {
  const d = Math.max(1, Math.round(b));
  const n = Math.round(a);
  return { quotient: Math.floor(n / d), remainder: n - Math.floor(n / d) * d };
}

/**
 * 一位小数：内部一律按「十分之几」的整数算，避免浮点误差。
 * 传入 35 得到 "3.5"，传入 30 得到 "3"。
 */
export function formatTenths(tenths: number): string {
  const v = Math.round(tenths);
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const whole = Math.floor(abs / 10);
  const frac = abs % 10;
  return frac === 0 ? `${sign}${whole}` : `${sign}${whole}.${frac}`;
}

/** "3.5" / "3" → 35 / 30（一位小数的整数化） */
export function parseTenths(text: string): number {
  const m = text.trim().match(/^(-?)(\d+)(?:\.(\d))?$/);
  if (!m) return NaN;
  const v = Number(m[2]) * 10 + (m[3] ? Number(m[3]) : 0);
  return m[1] === "-" ? -v : v;
}
