import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { validateQuestion } from "./gen";
import { buildQuestions, CHAPTERS, kindPool, LEVELS, questionCount } from "./levels";

describe("算数小农场 188 关", () => {
  it("恰好 188 关", () => {
    expect(LEVELS).toHaveLength(188);
  });

  it("至少 6 个主题章节，章节大小之和为 188", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("每关题目合法：选项唯一、正确项存在且与答案一致", () => {
    for (let i = 0; i < 99; i++) {
      const qs = buildQuestions(i);
      expect(qs.length).toBe(questionCount(i));
      expect(qs.length).toBeGreaterThanOrEqual(4);
      expect(qs.length).toBeLessThanOrEqual(7);
      for (const q of qs) {
        expect(q.choices.length).toBe(3);
        expect(new Set(q.choices).size).toBe(3);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(q.choices.length);
        expect(q.choices[q.correct]).toBe(String(q.answer));
      }
    }
  });

  it("算式题结果正确且不超过一年级范围（0..20）", () => {
    for (let i = 0; i < 99; i++) {
      for (const q of buildQuestions(i)) {
        if (typeof q.answer !== "number") continue;
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThanOrEqual(20);
        // 纯算式题（加/减/连算）能从题面直接验算
        const m = q.promptHTML.match(/^(\d+) ([+-]) (\d+)(?: ([+-]) (\d+))? = \?$/);
        if (m) {
          let v = m[2] === "+" ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3]);
          if (m[4]) v = m[4] === "+" ? v + Number(m[5]) : v - Number(m[5]);
          expect(v).toBe(q.answer);
        }
      }
    }
  });

  it("抽 20+ 题机器校验：答案可从题面验算、引导语口语化（≤15 个汉字）", () => {
    const qs = [0, 24, 49, 74, 98].flatMap((i) => buildQuestions(i));
    expect(qs.length).toBeGreaterThanOrEqual(20);
    const kindsSeen = new Set(qs.map((q) => q.kind));
    expect(kindsSeen.size).toBeGreaterThanOrEqual(4);
    for (const q of qs) {
      expect((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length).toBeLessThanOrEqual(15);
      const text = q.promptHTML.replace(/<[^>]+>/g, "");
      if (q.kind === "count") {
        expect(text.trim().split(/\s+/)).toHaveLength(q.answer as number);
        expect(q.choices[q.correct]).toBe(String(q.answer));
      } else if (q.kind === "add" || q.kind === "sub" || q.kind === "chain") {
        const m = text.match(/^(\d+) ([+-]) (\d+)(?: ([+-]) (\d+))? = \?$/);
        expect(m).not.toBeNull();
        let v = m![2] === "+" ? Number(m![1]) + Number(m![3]) : Number(m![1]) - Number(m![3]);
        if (m![4]) v = m![4] === "+" ? v + Number(m![5]) : v - Number(m![5]);
        expect(v).toBe(q.answer);
        expect(q.choices[q.correct]).toBe(String(q.answer));
      } else if (q.kind === "missing") {
        const m = text.match(/^(\d+|⬜) ([+-]) (\d+|⬜) = (\d+)$/);
        expect(m).not.toBeNull();
        const fill = (s: string) => (s === "⬜" ? Number(q.answer) : Number(s));
        const left = m![2] === "+" ? fill(m![1]) + fill(m![3]) : fill(m![1]) - fill(m![3]);
        expect(left).toBe(Number(m![4]));
        expect(q.choices[q.correct]).toBe(String(q.answer));
      } else {
        // compare：左边是数或算式，右边是数，符号必须判断正确
        const m = text.match(/^(.+) ○ (\d+)$/);
        expect(m).not.toBeNull();
        const lm = m![1].match(/^(\d+)(?: ([+-]) (\d+))?$/);
        expect(lm).not.toBeNull();
        let left = Number(lm![1]);
        if (lm![2]) left = lm![2] === "+" ? left + Number(lm![3]) : left - Number(lm![3]);
        const right = Number(m![2]);
        const sym = left > right ? "＞" : left < right ? "＜" : "＝";
        expect(q.answer).toBe(sym);
        expect(q.choices[q.correct]).toBe(sym);
      }
    }
  });

  it("同一关重试题目一致（确定性生成）", () => {
    for (const i of [0, 17, 40, 66, 98]) {
      expect(JSON.stringify(buildQuestions(i))).toBe(JSON.stringify(buildQuestions(i)));
    }
  });

  it("六章题型各有侧重（并非同一模板）", () => {
    const sig = (i: number) => kindPool(i).slice().sort().join(",");
    const signatures = new Set([sig(2), sig(19), sig(36), sig(52), sig(68), sig(85)]);
    expect(signatures.size).toBeGreaterThanOrEqual(5);
    // 首章从数一数起步，末章有连加连减
    expect(kindPool(0)).toContain("count");
    expect(kindPool(98)).toContain("chain");
  });

  it("章节内题量递进", () => {
    expect(questionCount(0)).toBeLessThan(questionCount(16));
    expect(questionCount(83)).toBeLessThanOrEqual(questionCount(98));
  });
});

// ---------------------------------------------------------------------------
// 1.1：第 100–188 关（丰收乘法坊 / 余数磨坊 / 分数果酱铺 / 括号谷仓）
// ---------------------------------------------------------------------------

/** 1.0 的前 99 关章节切分，硬编码做回归断言 */
const LEGACY_CHAPTER_SNAPSHOT = [
  { name: "青青牧场", size: 17 },
  { name: "甜甜果园", size: 17 },
  { name: "叮咚池塘", size: 17 },
  { name: "彩虹麦田", size: 16 },
  { name: "星星谷仓", size: 16 },
  { name: "月光农庄", size: 16 },
];

const NEW_FROM = 99;
const NEW_LEVELS = Array.from({ length: 188 - NEW_FROM }, (_, i) => NEW_FROM + i);
/** 1.2 起第 100–188 关的全部种类：1.1 的七种 + 补齐六年级的七种 */
const ADVANCED_KINDS = new Set([
  "mul",
  "div",
  "divmod",
  "frac",
  "dec",
  "paren",
  "word",
  "vertical",
  "fracLcd",
  "decMul",
  "percent",
  "ratio",
  "equation",
  "pattern",
]);

function strip(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** 极小的四则运算求值器（只认 + - * / 和括号），用来独立复算一遍答案 */
function evalExpr(src: string): number {
  const tokens = src.match(/\d+|[+\-*/()]/g) ?? [];
  let pos = 0;
  const peek = (): string | undefined => tokens[pos];
  function factor(): number {
    const tk = tokens[pos++];
    if (tk === "(") {
      const v = expr();
      if (tokens[pos] !== ")") throw new Error(`括号不匹配: ${src}`);
      pos++;
      return v;
    }
    if (tk === "-") return -factor();
    const n = Number(tk);
    if (!Number.isFinite(n)) throw new Error(`表达式非法: ${src}`);
    return n;
  }
  function term(): number {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = tokens[pos++];
      const r = factor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[pos++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  const out = expr();
  if (pos !== tokens.length) throw new Error(`表达式有多余符号: ${src}`);
  return out;
}

function fmtTenths(v: number): string {
  const whole = Math.floor(Math.abs(v) / 10);
  const frac = Math.abs(v) % 10;
  return `${v < 0 ? "-" : ""}${frac === 0 ? whole : `${whole}.${frac}`}`;
}

function tenths(text: string): number {
  const m = text.trim().match(/^(\d+)(?:\.(\d))?$/);
  if (!m) throw new Error(`小数解析失败: ${text}`);
  return Number(m[1]) * 10 + (m[2] ? Number(m[2]) : 0);
}

function gcdOf(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

/** 逐题机器验算：先过一遍本款自己的校验器，再用这份测试独立写的解析器复算 1.1 那七种老题型 */
function verify(q: ReturnType<typeof buildQuestions>[number], where: string): void {
  const problems = validateQuestion(q);
  expect(problems.join("；"), where).toBe("");
  const text = strip(q.promptHTML);
  switch (q.kind) {
    case "mul": {
      const m = text.match(/^(\d+) × (\d+) = \?$/);
      expect(m, where).not.toBeNull();
      expect(q.answer, where).toBe(Number(m![1]) * Number(m![2]));
      break;
    }
    case "div": {
      const m = text.match(/^(\d+) ÷ (\d+) = \?$/);
      expect(m, where).not.toBeNull();
      expect(Number(m![1]) % Number(m![2]), where).toBe(0);
      expect(q.answer, where).toBe(Number(m![1]) / Number(m![2]));
      break;
    }
    case "divmod": {
      const m = text.match(/^(\d+) ÷ (\d+) = \?$/);
      expect(m, where).not.toBeNull();
      const a = Number(m![1]);
      const b = Number(m![2]);
      const quotient = Math.floor(a / b);
      const remainder = a - quotient * b;
      expect(remainder, where).toBeGreaterThan(0);
      if (q.ask === "余数是几？") expect(q.answer, where).toBe(remainder);
      else expect(q.answer, where).toBe(`${quotient} 余 ${remainder}`);
      break;
    }
    case "frac": {
      const cmp = text.match(/^(\d+)\/(\d+) ○ (\d+)\/(\d+)$/);
      if (cmp) {
        const left = Number(cmp[1]) * Number(cmp[4]);
        const right = Number(cmp[3]) * Number(cmp[2]);
        expect(q.answer, where).toBe(left > right ? "＞" : left < right ? "＜" : "＝");
        break;
      }
      const simp = text.match(/^(\d+)\/(\d+) ⇒ 最简$/);
      if (simp) {
        const n = Number(simp[1]);
        const d = Number(simp[2]);
        const g = gcdOf(n, d);
        expect(q.answer, where).toBe(`${n / g}/${d / g}`);
        break;
      }
      const sum = text.match(/^(\d+)\/(\d+) ([+-]) (\d+)\/(\d+) = \?$/);
      expect(sum, where).not.toBeNull();
      expect(sum![2], where).toBe(sum![5]);
      const v = sum![3] === "+" ? Number(sum![1]) + Number(sum![4]) : Number(sum![1]) - Number(sum![4]);
      expect(v, where).toBeGreaterThan(0);
      expect(q.answer, where).toBe(`${v}/${sum![2]}`);
      break;
    }
    case "dec": {
      const m = text.match(/^([\d.]+) ([+-]) ([\d.]+) = \?$/);
      expect(m, where).not.toBeNull();
      const v = m![2] === "+" ? tenths(m![1]) + tenths(m![3]) : tenths(m![1]) - tenths(m![3]);
      expect(v, where).toBeGreaterThan(0);
      expect(q.answer, where).toBe(fmtTenths(v));
      break;
    }
    case "paren": {
      const m = text.match(/^(.+) = \?$/);
      expect(m, where).not.toBeNull();
      const v = evalExpr(m![1].replace(/×/g, "*").replace(/÷/g, "/"));
      expect(Number.isInteger(v), `${where}：${m![1]} 应算出整数`).toBe(true);
      expect(q.answer, where).toBe(v);
      break;
    }
    case "word": {
      expect(q.expr, where).toBeDefined();
      const v = evalExpr(q.expr!);
      expect(Number.isInteger(v), `${where}：${q.expr} 应算出整数`).toBe(true);
      expect(v, where).toBeGreaterThan(0);
      expect(q.answer, where).toBe(v);
      // 算式里的每个数都必须在题面上出现，否则孩子无从下手
      for (const n of q.expr!.match(/\d+/g) ?? []) {
        expect(text, `${where}：题面缺少数字 ${n}`).toContain(n);
      }
      break;
    }
    default:
      // 1.2 新增的七种（竖式 / 通分 / 小数乘除 / 百分数 / 比与比例 / 方程 / 找规律）
      // 由上面的校验器逐条盯着：它会从题面重新解析、独立算一遍，再核对约束
      expect(ADVANCED_KINDS.has(q.kind), `${where}：出现了没登记的题型`).toBe(true);
      break;
  }
}

describe("算数小农场 · 1.1 第 100–188 关", () => {
  it("前 99 关章节切分与 1.0 完全一致（回归）", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => ({ name: c.name, size: c.size }))).toEqual(LEGACY_CHAPTER_SNAPSHOT);
    expect(CHAPTERS.slice(0, 6).reduce((s, c) => s + c.size, 0)).toBe(99);
  });

  it("末尾追加 4 个全新章节共 89 关，总数正好 188", () => {
    const extra = CHAPTERS.slice(6);
    expect(extra).toHaveLength(4);
    expect(extra.reduce((s, c) => s + c.size, 0)).toBe(89);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(CHAPTERS.length);
  });

  it("新章节都配齐了 emoji、粉彩色和一句话介绍", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("前 99 关的题量与题型池不受扩容影响（按 1.0 公式回归）", () => {
    const legacySizes = [17, 17, 17, 16, 16, 16];
    let start = 0;
    legacySizes.forEach((size, ci) => {
      for (let i = 0; i < size; i++) {
        const level = start + i;
        const t = i / Math.max(1, size - 1);
        expect(questionCount(level)).toBe(4 + Math.min(3, Math.floor(t * 3.6)));
        for (const k of kindPool(level)) {
          expect(ADVANCED_KINDS.has(k), `第 ${level + 1} 关不该出现新题型 ${k}`).toBe(false);
        }
        expect(ci).toBeLessThan(6);
      }
      start += size;
    });
    expect(start).toBe(99);
  });

  it("第 100–188 关逐关合法：题量 6–10、3 个唯一选项、正确项即答案", () => {
    for (const level of NEW_LEVELS) {
      const qs = buildQuestions(level);
      expect(qs.length, `第 ${level + 1} 关`).toBe(questionCount(level));
      expect(qs.length).toBeGreaterThanOrEqual(6);
      expect(qs.length).toBeLessThanOrEqual(10);
      for (const q of qs) {
        expect(q.choices.length, `第 ${level + 1} 关`).toBe(3);
        expect(new Set(q.choices).size, `第 ${level + 1} 关`).toBe(3);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(3);
        expect(q.choices[q.correct], `第 ${level + 1} 关`).toBe(String(q.answer));
        expect(ADVANCED_KINDS.has(q.kind)).toBe(true);
      }
    }
  });

  it("第 100–188 关逐关可解：每道题都能从题面重新算出答案", () => {
    let checked = 0;
    for (const level of NEW_LEVELS) {
      for (const q of buildQuestions(level)) {
        verify(q, `第 ${level + 1} 关 · ${q.kind}`);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(600);
  });

  it("丰收乘法坊：乘法与整除都出现，且积不会大到离谱", () => {
    const kinds = new Set<string>();
    for (let level = 99; level < 122; level++) {
      for (const q of buildQuestions(level)) {
        kinds.add(q.kind);
        if (q.kind === "mul") {
          expect(q.answer).toBeGreaterThan(0);
          expect(q.answer).toBeLessThanOrEqual(49 * 9);
        }
        if (q.kind === "div") expect(q.answer).toBeGreaterThan(0);
      }
    }
    expect(kinds.has("mul")).toBe(true);
    expect(kinds.has("div")).toBe(true);
  });

  it("余数磨坊：余数一定比除数小且大于 0", () => {
    let seen = 0;
    for (let level = 122; level < 144; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "divmod") continue;
        seen++;
        const m = strip(q.promptHTML).match(/^(\d+) ÷ (\d+) = \?$/)!;
        const b = Number(m[2]);
        const r = Number(m[1]) % b;
        expect(r).toBeGreaterThan(0);
        expect(r).toBeLessThan(b);
      }
    }
    expect(seen).toBeGreaterThan(30);
  });

  it("分数果酱铺：比大小 / 约分 / 同分母加减三种玩法都覆盖到了", () => {
    let cmp = 0;
    let simp = 0;
    let sum = 0;
    let dec = 0;
    for (let level = 144; level < 166; level++) {
      for (const q of buildQuestions(level)) {
        const text = strip(q.promptHTML);
        if (q.kind === "dec") dec++;
        if (q.kind !== "frac") continue;
        if (text.includes("○")) cmp++;
        else if (text.includes("最简")) simp++;
        else sum++;
      }
    }
    expect(cmp).toBeGreaterThan(0);
    expect(simp).toBeGreaterThan(0);
    expect(sum).toBeGreaterThan(0);
    expect(dec).toBeGreaterThan(0);
  });

  it("约分题的答案一定已经是最简分数", () => {
    let seen = 0;
    for (let level = 144; level < 166; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "frac" || !strip(q.promptHTML).includes("最简")) continue;
        seen++;
        const m = String(q.answer).match(/^(\d+)\/(\d+)$/)!;
        expect(gcdOf(Number(m[1]), Number(m[2]))).toBe(1);
      }
    }
    expect(seen).toBeGreaterThan(5);
  });

  it("一位小数题不会出现浮点毛刺（0.1+0.2 之类的尾巴）", () => {
    let seen = 0;
    for (let level = 144; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "dec") continue;
        seen++;
        expect(String(q.answer)).toMatch(/^\d+(\.\d)?$/);
        for (const c of q.choices) expect(c).toMatch(/^\d+(\.\d)?$/);
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  it("括号谷仓：混合运算与两步应用题都出现，应用题给得出规范算式", () => {
    let paren = 0;
    let word = 0;
    for (let level = 166; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind === "paren") paren++;
        if (q.kind === "word") {
          word++;
          expect(q.expr).toMatch(/^[\d+\-*/()]+$/);
          // 至少两步：算式里必须有两个以上运算符
          expect((q.expr!.match(/[+\-*/]/g) ?? []).length).toBeGreaterThanOrEqual(2);
        }
      }
    }
    expect(paren).toBeGreaterThan(20);
    expect(word).toBeGreaterThan(10);
  });

  it("引入了前 99 关没有的新机制（乘除 / 余数 / 分数小数 / 括号应用题 / 1.2 补齐的六年级题型）", () => {
    const legacy = new Set<string>();
    for (let level = 0; level < 99; level++) for (const q of buildQuestions(level)) legacy.add(q.kind);
    const fresh = new Set<string>();
    for (const level of NEW_LEVELS) for (const q of buildQuestions(level)) fresh.add(q.kind);
    for (const k of legacy) expect(fresh.has(k), `${k} 不该出现在新章节`).toBe(false);
    expect(fresh.size).toBeGreaterThanOrEqual(2);
    expect([...fresh].every((k) => ADVANCED_KINDS.has(k))).toBe(true);
  });

  it("第 100–188 关同一关重试题目一致（确定性生成）", () => {
    for (const level of [99, 121, 122, 143, 144, 165, 166, 187]) {
      expect(JSON.stringify(buildQuestions(level))).toBe(JSON.stringify(buildQuestions(level)));
    }
  });

  it("引导语依旧口语化：全部 188 关的 ask 都不超过 15 个汉字", () => {
    for (let level = 0; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        expect((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length, `第 ${level + 1} 关：${q.ask}`).toBeLessThanOrEqual(15);
      }
    }
  });

  it("文案零商标：题面与选项里除了方程的未知数没有任何英文字母", () => {
    for (const level of NEW_LEVELS) {
      for (const q of buildQuestions(level)) {
        // 简单方程要写 x + 3 = 8 这种式子，那个 x 是数学符号，别的字母一个都不许有
        const text = strip(q.promptHTML);
        const letters = text.match(/[A-Za-z]/g) ?? [];
        if (letters.length > 0) {
          expect(q.kind, `第 ${level + 1} 关：${text}`).toBe("equation");
          expect(letters).toEqual(["x"]);
        }
        expect(q.ask).not.toMatch(/[A-Za-z]/);
        for (const c of q.choices) expect(c).not.toMatch(/[A-Za-z]/);
      }
    }
  });

  it("四个新章节的题型池互不相同，题量也明显更长", () => {
    const sigs = new Set([110, 133, 155, 180].map((i) => kindPool(i).slice().sort().join(",")));
    expect(sigs.size).toBe(4);
    expect(questionCount(121)).toBe(10);
    expect(questionCount(187)).toBe(10);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(NEW_LEVELS.map((i) => questionCount(i)))).toBeGreaterThan(
      avg(Array.from({ length: 99 }, (_, i) => questionCount(i)))
    );
  });
});
