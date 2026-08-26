/**
 * 算数小农场 1.2：连错之后的两级提示。
 *
 *  - 连错 2 次 → **方法提示**：这一类题该从哪儿下手（「先算括号里的」）。
 *  - 再错一次 → **拆一步**：把整道题拆成两小步，一步一步问回去。
 *
 * 铁律：两级提示都**一个数字都不出现**，更不许把得数说出来——
 * `hints.test.ts` 会拿 188 关全部题目的正确答案去扫这些句子，扫到一个就算不合格。
 *
 * 展示与朗读同一句：`quiz99` 让正确选项一闪一闪的那套体验原样保留（公共文件只读），
 * 本款只是把那一行提示语从通用话术换成真正能教会孩子的方法。
 */
import type { AdvancedMathKind, LegacyMathKind, MathKind, MathType } from "./kinds";
import { typeOfKind } from "./kinds";
import type { MathSpec } from "./gen";

/** 提示语开头统一挂个标记，孩子一眼知道这是提示而不是评语 */
export const HINT_PREFIX = "悄悄提示：";

/** 第二级提示的标记 */
export const STEP_PREFIX = "拆一步：";

/** 按题型给的方法提示（不含任何数字，也不含任何一题的答案） */
export const METHOD_HINTS: Record<MathType, string> = {
  basic: "先把题目读完再看选项。心里先说一遍算式，再动手。",
  muldiv: "先把两位数拆成整十和个位两部分，各乘各的，最后合起来。",
  divmod: "先看除数最多能整整齐齐分走几份，分不完的那一点就是余数，它一定比除数小。",
  vertical: "数位对齐，从个位算起；加法满十就往前一位进一，减法不够减就向前一位借一。",
  mixed: "先算括号里的，再算乘除，最后算加减。顺序想清楚再动笔。",
  fraction: "分母不一样先通分，把它们变成同一个分母；分母一样了，只算分子，最后记得约到最简。",
  decimal: "加减把小数点对齐再算；乘除先按整数算，最后数一数小数点该点在哪一位。",
  percent: "百分数就是「一百份里占几份」。先求出一份是多少，再看题目要几份；打折是按原价的几成付钱。",
  ratio: "先把两个数一起除以它们的公因数，化成最简整数比；按比分配先算一共分成几份。",
  equation: "把未知数当成一个还不认识的数，用逆运算把它单独留在等号一边：加了就减回去，乘了就除回去。",
  word: "先找那个题目没直接问、却必须先求出来的中间量，找到它，一道题就变成两小步。",
  pattern: "把相邻两项的差写出来看一看：差一样就是一个个加上去，差在变大就再看差的差，都不像就试试翻倍。",
};

/** 前 99 关那六种老题型也给方法提示（出题参数一个字没改，只是提示语更有用了） */
export const LEGACY_METHOD_HINTS: Record<LegacyMathKind, string> = {
  count: "按一个固定方向数，从左到右一个一个点过去，数完再回头点一遍。",
  add: "先看大的那个数离十还差几，把小的那个拆开去凑十，剩下的再加上。",
  sub: "不够减的时候先从十里减，再把个位剩下的加回来。",
  missing: "填空题反过来想：知道合起来是多少，就用逆运算把缺的那个数推出来。",
  compare: "比大小先看位数，位数一样再从最高位往下比；符号张开的那一边永远朝着大的数。",
  chain: "连加连减从左往右一步一步来，把中间结果在心里念出声，别在脑子里同时装两笔账。",
};

/** 第二级提示：把这一类题拆成两小步问回去（同样一个数字都没有） */
export const STEP_HINTS: Record<AdvancedMathKind, string> = {
  mul: "第一步：整十的那部分乘出来是多少？第二步：个位的那部分乘出来是多少？把两个结果加起来。",
  div: "第一步：除数乘几最接近被除数的前几位？第二步：把剩下的那部分接着往下除。",
  divmod: "第一步：先分掉能整整齐齐分完的那些份，一共几份？第二步：手里还剩下多少没分掉？",
  vertical: "第一步：只看个位，它够不够？第二步：把进上去或者借过来的那一个十，记到前一位再算。",
  paren: "第一步：括号里那一小段先算出来是多少？第二步：拿这个结果再去做外面那一步。",
  frac: "第一步：这两个分数的分母一样吗？第二步：分母一样就只算分子，最后看看还能不能约。",
  fracLcd: "第一步：两个分母的最小公倍数是多少？第二步：把两个分数都换成这个分母，再算分子。",
  dec: "第一步：把两个数的小数点上下对齐；第二步：从最右边一位算起，进位借位照旧。",
  decMul: "第一步：先不管小数点，按整数算一遍；第二步：数一数原来有几位小数，把点点回去。",
  percent: "第一步：总数的一份是多少？第二步：题目要的是其中的几份，或者要付原价的几成？",
  ratio: "第一步：一共分成了几份？第二步：题目问的那个人占其中几份？",
  equation: "第一步：等号这边除了未知数还多了什么？第二步：用相反的运算把它挪到等号另一边去。",
  word: "第一步：题目没直接问、但必须先求的那个数是多少？第二步：拿它去回答题目真正问的那句话。",
  pattern: "第一步：把相邻两项的差挨个写出来；第二步：看这些差是一样的、在变大的，还是在翻倍。",
};

/** 前 99 关的拆一步 */
export const LEGACY_STEP_HINTS: Record<LegacyMathKind, string> = {
  count: "第一步：先数左边一半有几个？第二步：再数右边一半，两边合起来。",
  add: "第一步：大数再添几就正好是十？第二步：小数拆掉那几个之后还剩多少，加上去。",
  sub: "第一步：先从十里减掉要减的数；第二步：把个位上剩下的那几个再加回来。",
  missing: "第一步：两个已知的数之间差多少？第二步：把这个差数填回空里念一遍，顺口就对了。",
  compare: "第一步：左边那一串先算出一个数；第二步：拿它和右边比，谁大符号就朝谁张开。",
  chain: "第一步：只算前面两个数，得到一个中间结果；第二步：拿中间结果再和第三个数算。",
};

/**
 * 应用题的三种新情境各有各的中间量，拆一步要拆到点子上。
 * 键是 `MathSpec` 里的 `form`，没列到的走 `STEP_HINTS.word` 的通用说法。
 */
export const WORD_STEP_HINTS: Record<string, string> = {
  trip: "第一步：骑过的那一段有多远，用每分钟走的距离乘时间；第二步：再把后面走的那一段加上去。",
  price: "第一步：买这些一共要花多少钱，用单价乘数量；第二步：拿付出去的钱减掉它。",
  area: "第一步：整块地的面积是多少，用长乘宽；第二步：减掉已经种好的那一部分。",
  share: "第一步：卖掉之后还剩多少个？第二步：把剩下的平均分给这些人。",
  fill: "第一步：送走之后还剩多少个？第二步：看剩下的能装满几个容器。",
  rows: "第一步：一共种了多少个，用排数乘每排的个数；第二步：减掉送走的那些。",
  pack: "第一步：装满的那些一共多少个，用每份的个数乘份数；第二步：把多出来的加上。",
};

/** 这一题该给哪句方法提示（已带前缀，展示与朗读用的是同一个字符串） */
export function methodHint(kind: MathKind): string {
  const legacy = LEGACY_METHOD_HINTS[kind as LegacyMathKind];
  if (legacy) return `${HINT_PREFIX}${legacy}`;
  return `${HINT_PREFIX}${METHOD_HINTS[typeOfKind(kind as AdvancedMathKind)]}`;
}

/** 这一题该怎么拆成两小步（已带前缀） */
export function stepHint(kind: MathKind, spec?: MathSpec): string {
  if (spec && spec.kind === "word") {
    const line = WORD_STEP_HINTS[spec.form];
    if (line) return `${STEP_PREFIX}${line}`;
  }
  const legacy = LEGACY_STEP_HINTS[kind as LegacyMathKind];
  if (legacy) return `${STEP_PREFIX}${legacy}`;
  return `${STEP_PREFIX}${STEP_HINTS[kind as AdvancedMathKind]}`;
}

/** 提示语里出现数字就说明有泄题风险，纯函数便于测试 */
export function hasDigits(text: string): boolean {
  return /[0-9]/.test(text);
}
