/**
 * 算数小农场 1.2：题型分类与「关号 → 题型权重」难度表。
 *
 * 这一份只放纯数据与纯函数（不 import 出题代码），让难度曲线变成一张能读、能断言的表，
 * 而不是散在 if-else 里的经验值。第 100 关往后由这张表排题；前 99 关仍走 1.0/1.1 的老阶梯，
 * 表里只是把那三段**如实描述**下来，测试会反过来核对描述和老代码真正产出的题型对得上。
 */

/**
 * 1.2 要求补齐的九类题型 + 1.1 已有的乘除与带余除法（续写保留，不推翻）
 * + `basic`：前 99 关那六种口算题型的归口（难度表里权重恒为 0，只给错题本用）。
 */
export const MATH_TYPES = [
  "basic",
  "muldiv",
  "divmod",
  "vertical",
  "mixed",
  "fraction",
  "decimal",
  "percent",
  "ratio",
  "equation",
  "word",
  "pattern",
] as const;

export type MathType = (typeof MATH_TYPES)[number];

/** 规格点名要补齐的那九类（`muldiv` / `divmod` 是 1.1 的存量内容，不在其列） */
export const CORE_MATH_TYPES: readonly MathType[] = [
  "mixed",
  "vertical",
  "fraction",
  "decimal",
  "percent",
  "ratio",
  "equation",
  "word",
  "pattern",
];

/** 题型的中文名（提示语、错题本、家长面板都用它） */
export const MATH_TYPE_NAMES: Record<MathType, string> = {
  basic: "口算基础",
  muldiv: "乘法与除法",
  divmod: "带余除法",
  vertical: "竖式进退位",
  mixed: "四则混合运算",
  fraction: "分数",
  decimal: "小数",
  percent: "百分数与折扣",
  ratio: "比与比例",
  equation: "简单方程",
  word: "应用题",
  pattern: "找规律",
};

/** 1.0/1.1 就有的前 99 关题目种类 */
export type LegacyMathKind = "count" | "add" | "sub" | "missing" | "compare" | "chain";

/** 第 100–188 关的题目种类：1.1 的七种 + 1.2 新增的五种 */
export type AdvancedMathKind =
  | "mul"
  | "div"
  | "divmod"
  | "frac"
  | "dec"
  | "paren"
  | "word"
  | "vertical"
  | "fracLcd"
  | "decMul"
  | "percent"
  | "ratio"
  | "equation"
  | "pattern";

export type MathKind = LegacyMathKind | AdvancedMathKind;

/** 每个种类归哪一类题型（前 99 关那六种一律归 `basic`） */
export const KIND_TYPE: Record<MathKind, MathType> = {
  count: "basic",
  add: "basic",
  sub: "basic",
  missing: "basic",
  compare: "basic",
  chain: "basic",
  mul: "muldiv",
  div: "muldiv",
  divmod: "divmod",
  vertical: "vertical",
  paren: "mixed",
  frac: "fraction",
  fracLcd: "fraction",
  dec: "decimal",
  decMul: "decimal",
  percent: "percent",
  ratio: "ratio",
  equation: "equation",
  word: "word",
  pattern: "pattern",
};

export function typeOfKind(kind: MathKind): MathType {
  return KIND_TYPE[kind];
}

/** 一个题型可以派出的具体种类（同类之内按关号轮换，谁都不会被饿死） */
export const KINDS_BY_TYPE: Record<MathType, readonly AdvancedMathKind[]> = {
  // 前 99 关不走这张表，`basic` 永远排不到题位
  basic: [],
  muldiv: ["mul", "div"],
  divmod: ["divmod"],
  vertical: ["vertical"],
  mixed: ["paren"],
  fraction: ["frac", "fracLcd"],
  decimal: ["dec", "decMul"],
  percent: ["percent"],
  ratio: ["ratio"],
  equation: ["equation"],
  word: ["word"],
  pattern: ["pattern"],
};

// ---------------------------------------------------------------------------
// 难度表：关号 → 题型权重
// ---------------------------------------------------------------------------

export interface DifficultyBand {
  /** 覆盖的关号区间（1 基，含两端） */
  from: number;
  to: number;
  title: string;
  /** 题型 → 权重，一段之内必须正好加到 1 */
  weights: Partial<Record<MathType, number>>;
}

/** 第一段真正由权重表驱动出题的关号（1 基）；小于它的关走 1.0/1.1 的老路径 */
export const TABLE_DRIVEN_FROM = 100;

/**
 * 前 99 关的**如实描述**：这 99 关的出题参数在 1.0/1.1 就定死了，1.2 一个字不改。
 * 写下来只为让整条曲线能一眼读完，测试会拿它和 `kindPool` 的真实返回值对账。
 */
export interface LegacyBand {
  from: number;
  to: number;
  title: string;
  kinds: readonly LegacyMathKind[];
}

export const LEGACY_BANDS: readonly LegacyBand[] = [
  { from: 1, to: 17, title: "青青牧场：数一数与 5 以内加减", kinds: ["count", "add", "sub"] },
  { from: 18, to: 34, title: "甜甜果园：10 以内加减", kinds: ["count", "add", "sub"] },
  { from: 35, to: 51, title: "叮咚池塘：20 以内不进退位与填空", kinds: ["add", "sub", "missing"] },
  { from: 52, to: 67, title: "彩虹麦田：凑十法进位加", kinds: ["add", "missing"] },
  { from: 68, to: 83, title: "星星谷仓：破十法退位减与比大小", kinds: ["sub", "compare"] },
  { from: 84, to: 99, title: "月光农庄：连加连减", kinds: ["chain", "compare", "add", "sub"] },
];

/**
 * 第 100–188 关的八段难度曲线，从两位数乘除一路走到六年级综合。
 * 每一段的权重加起来正好是 1；区间连续铺满 100–188，不留缝也不重叠。
 */
export const DIFFICULTY_TABLE: readonly DifficultyBand[] = [
  {
    from: 100,
    to: 111,
    title: "丰收乘法坊 · 上：两位数乘一位数与竖式进位",
    weights: { muldiv: 0.45, vertical: 0.3, mixed: 0.15, word: 0.1 },
  },
  {
    from: 112,
    to: 122,
    title: "丰收乘法坊 · 下：竖式退位与两级运算",
    weights: { muldiv: 0.3, vertical: 0.25, mixed: 0.2, word: 0.15, pattern: 0.1 },
  },
  {
    from: 123,
    to: 133,
    title: "余数磨坊 · 上：分不完的那一点",
    weights: { divmod: 0.4, muldiv: 0.2, vertical: 0.15, word: 0.15, pattern: 0.1 },
  },
  {
    from: 134,
    to: 144,
    title: "余数磨坊 · 下：余数进应用题",
    weights: { divmod: 0.3, word: 0.25, mixed: 0.2, pattern: 0.15, muldiv: 0.1 },
  },
  {
    from: 145,
    to: 155,
    title: "分数果酱铺 · 上：通分与小数四则",
    weights: { fraction: 0.45, decimal: 0.3, word: 0.15, mixed: 0.1 },
  },
  {
    from: 156,
    to: 166,
    title: "分数果酱铺 · 下：百分数与折扣进场",
    weights: { fraction: 0.3, decimal: 0.25, percent: 0.25, word: 0.1, mixed: 0.1 },
  },
  {
    from: 167,
    to: 177,
    title: "括号谷仓 · 上：比与比例、解方程",
    weights: { mixed: 0.3, ratio: 0.25, equation: 0.2, word: 0.15, percent: 0.1 },
  },
  {
    from: 178,
    to: 188,
    title: "括号谷仓 · 下：六年级综合，什么都可能来",
    weights: {
      mixed: 0.15,
      equation: 0.15,
      ratio: 0.12,
      percent: 0.12,
      word: 0.12,
      fraction: 0.1,
      decimal: 0.09,
      pattern: 0.05,
      divmod: 0.05,
      muldiv: 0.05,
    },
  },
];

/** 「高段」的起点（1 基）：这之后必须还在练方程与比例 */
export const SENIOR_FROM = 167;

/** 关号（1 基）落在哪一段 */
export function bandOf(level1: number): DifficultyBand {
  const n = Math.max(TABLE_DRIVEN_FROM, Math.round(level1));
  for (const band of DIFFICULTY_TABLE) {
    if (n >= band.from && n <= band.to) return band;
  }
  return DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1];
}

/** 一段里权重大于 0 的题型，按权重从大到小、同权重按 MATH_TYPES 顺序排 */
export function bandTypes(band: DifficultyBand): MathType[] {
  return MATH_TYPES.filter((t) => (band.weights[t] ?? 0) > 0).sort(
    (a, b) => (band.weights[b] ?? 0) - (band.weights[a] ?? 0) || MATH_TYPES.indexOf(a) - MATH_TYPES.indexOf(b)
  );
}

/**
 * 把 count 个题位按权重分给各题型（最大余数法，确定性）。
 * `rotate` 让相邻关卡把「余数题位」轮着给不同题型：不加这一手，
 * 权重并列的小题型会因为下标靠后被永远饿死，一章之内根本轮不到它。
 */
export function allocateSlots(
  band: DifficultyBand,
  count: number,
  rotate = 0
): Array<{ type: MathType; slots: number }> {
  const total = Math.max(0, Math.round(count));
  const types = bandTypes(band);
  if (types.length === 0 || total === 0) return [];
  const raw = types.map((type) => ({ type, exact: (band.weights[type] ?? 0) * total }));
  const out = raw.map((x) => ({ type: x.type, slots: Math.floor(x.exact) }));
  let left = total - out.reduce((s, x) => s + x.slots, 0);
  const byRemainder = raw
    .map((x, i) => ({ i, rem: x.exact - Math.floor(x.exact) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  const start = ((Math.round(rotate) % byRemainder.length) + byRemainder.length) % byRemainder.length;
  for (let k = 0; left > 0; k++, left--) out[byRemainder[(start + k) % byRemainder.length].i].slots++;
  return out.filter((x) => x.slots > 0);
}

/**
 * 某一关（0 基）按难度表排出来的题型序列，长度正好等于题量。
 * 同一题型内部按「关号 + 题位」轮换具体种类，保证一章之内每个种类都轮得到，
 * 而且同一关重开时排法完全一致。
 */
export function tableKinds(level: number, count: number): AdvancedMathKind[] {
  const band = bandOf(level + 1);
  const alloc = allocateSlots(band, count, level);
  const out: AdvancedMathKind[] = [];
  alloc.forEach((entry, ti) => {
    const kinds = KINDS_BY_TYPE[entry.type];
    for (let i = 0; i < entry.slots; i++) {
      out.push(kinds[(level + ti + i) % kinds.length]);
    }
  });
  return out;
}

/**
 * 关号（0 基）对应的数字规模档位 0..1：越靠后数字越大。
 * 生成器统一吃这一个参数，「数字规模按关号上升」就只有一处定义。
 */
export function hardnessOf(level: number): number {
  const span = 188 - TABLE_DRIVEN_FROM; // 100..188 共 89 关
  const t = (level + 1 - TABLE_DRIVEN_FROM) / span;
  return Math.min(1, Math.max(0, t));
}
