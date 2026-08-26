/**
 * 形状王国 · 三级提示（1.2 新增）。
 *
 * 提示分三级，一级比一级具体，但**任何一级都不许把答案说出来**：
 *   ① 指出这道题在考什么（「先想周长是绕一圈」）
 *   ② 给出用得上的公式
 *   ③ 把第一步的结果算给孩子看（注意：第一步的结果一定不等于最终答案）
 *
 * `hintLeaksAnswer` 既是单测的判据，也是运行时的保险丝：万一哪天有人写漏了，
 * `safeHints` 会把那一级换成不含结论的通用话，绝不会把答案递到孩子手上。
 */

export type HintTrio = readonly [string, string, string];

/** 三级提示的小标题（界面上按钮的文字） */
export const HINT_LABELS: readonly [string, string, string] = [
  "① 这题在考什么",
  "② 用得上的公式",
  "③ 第一步先算出来",
];

export function trio(what: string, formula: string, firstStep: string): HintTrio {
  return [what, formula, firstStep];
}

/** 文本里有没有「独立出现」的这个数字（`24` 不算命中 `2`，`2 厘米` 才算） */
export function containsStandaloneNumber(text: string, n: number): boolean {
  const want = String(n);
  for (let i = 0; i <= text.length - want.length; i++) {
    if (text.slice(i, i + want.length) !== want) continue;
    const before = i > 0 ? text[i - 1] : "";
    const after = i + want.length < text.length ? text[i + want.length] : "";
    const isDigit = (ch: string): boolean => ch >= "0" && ch <= "9";
    if (!isDigit(before) && !isDigit(after)) return true;
  }
  return false;
}

/** 答案里打头的那个整数（`"24 平方厘米"` → 24；没有数字返回 null） */
export function leadingNumber(answer: string): number | null {
  const m = answer.match(/-?\d+/);
  return m ? Number(m[0]) : null;
}

/** 这条提示是不是把答案漏出去了 */
export function hintLeaksAnswer(hint: string, answer: string): boolean {
  const trimmed = answer.trim();
  if (trimmed.length === 0) return false;
  // 选项本身是一段 HTML（图形题）时，只要提示里出现同一段属性就算泄题
  if (trimmed.length >= 3 && hint.includes(trimmed)) return true;
  const n = leadingNumber(trimmed);
  if (n !== null && containsStandaloneNumber(hint, n)) return true;
  return false;
}

/** 通用兜底提示：只讲方法，不含任何结论 */
export const FALLBACK_HINTS: HintTrio = [
  "先弄清题目问的是哪一样：形状、长度、面积，还是位置。",
  "把图上给出的数一个个抄下来，再想想它们该怎么用。",
  "先把最容易看出来的那一步做掉，剩下的就简单了。",
];

/** 运行时保险丝：哪一级漏了答案就把那一级换成不含结论的通用话 */
export function safeHints(hints: HintTrio, answer: string): HintTrio {
  return hints.map((h, i) => (hintLeaksAnswer(h, answer) ? FALLBACK_HINTS[i] : h)) as unknown as HintTrio;
}
