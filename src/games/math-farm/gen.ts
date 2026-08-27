/**
 * 算数小农场 1.2：第 100–188 关的题目生成器与校验器。
 *
 * 三条硬规矩，全写在这一个文件里，新加题型不可能漏：
 *
 *  1. **一题一份出题参数**（`MathSpec`）。生成器是纯函数：吃一个随机源和一个难度档位，
 *     吐一份参数；题面、答案、干扰项全部由这份参数推出来，同一份参数永远得到同一道题。
 *  2. **校验器不信生成器**（`validateQuestion`）。它把渲染好的题面重新解析一遍、独立算一遍答案，
 *     再逐条核对：结果非负、除法整除、小数只保留一位、分数与比都是最简、题面上出现过算式里的每个数、
 *     三个选项互不等值（写法不同但数值相等也算重复，那种题没有唯一答案）。
 *  3. **干扰项来自典型错误**（`wrongsOf`）。每个题型配一张「孩子会怎么错」的表——忘记进位、
 *     退位当成大减小、忽略括号从左往右算、分母也相加、约分只约一半、小数点错位、
 *     打八折算成只付两成、比反着写、解方程用错逆运算、把等比当等差、面积算成周长、应用题只算第一步。
 *     选项只许从这张表里挑，代码里没有「随便加减几」的兜底。
 */
import { pick, randInt, shuffled } from "../level99";
import type { QuizQuestion } from "../quiz99";
import type { AdvancedMathKind, MathKind } from "./kinds";
import { formatFraction, formatTenths, gcd, simplifyFraction } from "./logic";

// ---------------------------------------------------------------------------
// 出题参数
// ---------------------------------------------------------------------------

/** 折扣的说法：折数 → 现价占原价的百分之几 */
export const DISCOUNTS: ReadonlyArray<{ name: string; rate: number }> = [
  { name: "九折", rate: 90 },
  { name: "八折", rate: 80 },
  { name: "七五折", rate: 75 },
  { name: "七折", rate: 70 },
  { name: "六折", rate: 60 },
  { name: "五折", rate: 50 },
];

/** 应用题里的原创农场物件（不使用任何商标或官方角色名） */
export const FARM_ITEMS = ["南瓜", "玉米", "草莓", "小番茄", "鸡蛋", "萝卜", "苹果", "土豆"];
/** 种在地里、能论「排」论「亩」的那些（鸡蛋不长在地里，得挑出去） */
export const FARM_CROPS = FARM_ITEMS.filter((x) => x !== "鸡蛋");
export const FARM_BAGS = ["筐", "袋", "箱", "篮"];

export type WordForm = "rows" | "pack" | "share" | "fill" | "trip" | "price" | "area";
export type PatternRule = "arith" | "geo" | "quad" | "fib";

export type MathSpec =
  | { kind: "mul"; a: number; b: number }
  | { kind: "div"; a: number; b: number }
  | { kind: "divmod"; a: number; b: number; askRemainder: boolean }
  | { kind: "vertical"; plus: boolean; a: number; b: number }
  | { kind: "paren"; form: 0 | 1 | 2 | 3 | 4 | 5; a: number; b: number; c: number; d: number }
  | { kind: "frac"; form: "compare"; an: number; ad: number; bn: number; bd: number }
  | { kind: "frac"; form: "simplify"; n: number; d: number }
  | { kind: "frac"; form: "same"; an: number; bn: number; d: number; plus: boolean }
  | { kind: "fracLcd"; an: number; ad: number; bn: number; bd: number; plus: boolean }
  | { kind: "dec"; a: number; b: number; plus: boolean }
  | { kind: "decMul"; times: boolean; a: number; b: number }
  | { kind: "percent"; form: "of"; base: number; rate: number; item: number }
  | { kind: "percent"; form: "discount"; base: number; rate: number; item: number }
  | { kind: "percent"; form: "rate"; part: number; base: number; item: number }
  | { kind: "ratio"; form: "simplify"; a: number; b: number }
  | { kind: "ratio"; form: "share"; total: number; p: number; q: number; item: number }
  | { kind: "ratio"; form: "proportion"; a: number; b: number; k: number }
  | { kind: "equation"; form: "addX" | "subX" | "xSub" | "mulX" | "divX"; a: number; b: number }
  | { kind: "word"; form: WordForm; n1: number; n2: number; n3: number; item: number; bag: number }
  | { kind: "pattern"; rule: PatternRule; terms: number[] };

export interface MathQ extends QuizQuestion {
  kind: MathKind;
  /** 正确答案（数字题为数值，分数 / 比 / 百分数 / 商余为字符串） */
  answer: number | string;
  /** 应用题与百分数题的规范算式（例如 `3*8-5`）；测试会独立求值一遍 */
  expr?: string;
  /** 1.2 起：第 100–188 关的题都带着自己的出题参数，校验器与错题回顾都靠它 */
  spec?: MathSpec;
  /** 两个干扰项分别对应哪种典型错误（测试断言用，界面上看不到） */
  traps?: string[];
}

/** 一个干扰项：错在哪一步 + 错出来的写法 */
export interface Wrong {
  text: string;
  why: string;
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** 去掉标签，只留孩子能看见的那行字 */
export function strip(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** 难度档位 t（0..1）在 [lo, hi] 上的取值 */
function scale(t: number, lo: number, hi: number): number {
  return Math.round(lo + (hi - lo) * Math.min(1, Math.max(0, t)));
}

/** 两个数的最小公倍数 */
export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

/**
 * 把一个答案写法归一成「数值指纹」：`2/4` 与 `1/2`、`6:9` 与 `2:3` 指纹相同。
 * 唯一答案就是靠它保证的——三个选项的指纹必须互不相同。
 */
export function canonAnswer(text: string | number): string {
  const t = String(text).trim();
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const s = simplifyFraction(Number(frac[1]), Number(frac[2]));
    return `f${s.n}/${s.d}`;
  }
  const ratio = t.match(/^(\d+):(\d+)$/);
  if (ratio) {
    const g = gcd(Number(ratio[1]), Number(ratio[2]));
    return `r${Number(ratio[1]) / g}:${Number(ratio[2]) / g}`;
  }
  const pct = t.match(/^(\d+(?:\.\d)?)%$/);
  if (pct) return `p${Number(pct[1])}`;
  if (/^\d+(?:\.\d)?$/.test(t)) return `n${Number(t)}`;
  return `s${t}`;
}

/** 极小的四则运算求值器（只认 + - * / 和括号），校验器用它独立复算 */
export function evalExpr(src: string): number {
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

/** 按位相加不进位（竖式最经典的错法） */
export function noCarrySum(a: number, b: number): number {
  let out = 0;
  let unit = 1;
  let x = a;
  let y = b;
  while (x > 0 || y > 0) {
    out += ((x % 10) + (y % 10)) % 10 * unit;
    x = Math.floor(x / 10);
    y = Math.floor(y / 10);
    unit *= 10;
  }
  return out;
}

/** 按位「大减小」不退位（另一个最经典的错法） */
export function noBorrowDiff(a: number, b: number): number {
  let out = 0;
  let unit = 1;
  let x = a;
  let y = b;
  while (x > 0 || y > 0) {
    out += Math.abs((x % 10) - (y % 10)) * unit;
    x = Math.floor(x / 10);
    y = Math.floor(y / 10);
    unit *= 10;
  }
  return out;
}

/** 乘法忘记进位：每一位各乘各的，进位全丢掉 */
export function noCarryProduct(a: number, b: number): number {
  let out = 0;
  let unit = 1;
  let x = a;
  while (x > 0) {
    out += ((x % 10) * b) % 10 * unit;
    x = Math.floor(x / 10);
    unit *= 10;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 答案
// ---------------------------------------------------------------------------

/** 一份出题参数对应的正确答案（数字题给数值，其余给规范写法） */
export function answerOf(spec: MathSpec): number | string {
  switch (spec.kind) {
    case "mul":
      return spec.a * spec.b;
    case "div":
      return spec.a / spec.b;
    case "divmod": {
      const q = Math.floor(spec.a / spec.b);
      const r = spec.a - q * spec.b;
      return spec.askRemainder ? r : `${q} 余 ${r}`;
    }
    case "vertical":
      return spec.plus ? spec.a + spec.b : spec.a - spec.b;
    case "paren":
      return evalExpr(parenExpr(spec));
    case "frac": {
      if (spec.form === "compare") {
        const left = spec.an * spec.bd;
        const right = spec.bn * spec.ad;
        return left > right ? "＞" : left < right ? "＜" : "＝";
      }
      if (spec.form === "simplify") {
        const s = simplifyFraction(spec.n, spec.d);
        return formatFraction(s.n, s.d);
      }
      const n = spec.plus ? spec.an + spec.bn : spec.an - spec.bn;
      const s = simplifyFraction(n, spec.d);
      return formatFraction(s.n, s.d);
    }
    case "fracLcd": {
      const L = lcm(spec.ad, spec.bd);
      const n = spec.plus
        ? spec.an * (L / spec.ad) + spec.bn * (L / spec.bd)
        : spec.an * (L / spec.ad) - spec.bn * (L / spec.bd);
      const s = simplifyFraction(n, L);
      return formatFraction(s.n, s.d);
    }
    case "dec":
      return formatTenths(spec.plus ? spec.a + spec.b : spec.a - spec.b);
    case "decMul":
      return formatTenths(spec.times ? spec.a * spec.b : spec.a / spec.b);
    case "percent": {
      if (spec.form === "rate") return `${(spec.part * 100) / spec.base}%`;
      return (spec.base * spec.rate) / 100;
    }
    case "ratio": {
      if (spec.form === "simplify") {
        const g = gcd(spec.a, spec.b);
        return `${spec.a / g}:${spec.b / g}`;
      }
      if (spec.form === "share") return (spec.total * spec.q) / (spec.p + spec.q);
      return spec.b * spec.k;
    }
    case "equation": {
      const { a, b } = spec;
      switch (spec.form) {
        case "addX":
          return b - a;
        case "subX":
          return b + a;
        case "xSub":
          return a - b;
        case "mulX":
          return b / a;
        default:
          return a * b;
      }
    }
    case "word":
      return evalExpr(wordExpr(spec));
    default: {
      const t = spec.terms;
      return nextOfPattern(spec.rule, t);
    }
  }
}

/** 数列按给定规律的下一项 */
export function nextOfPattern(rule: PatternRule, terms: readonly number[]): number {
  const n = terms.length;
  const last = terms[n - 1];
  switch (rule) {
    case "arith":
      return last + (terms[1] - terms[0]);
    case "geo":
      return last * (terms[1] / terms[0]);
    case "quad": {
      const d1 = terms[n - 1] - terms[n - 2];
      const e = terms[n - 2] - terms[n - 3] - (terms[n - 3] - terms[n - 4]);
      return last + d1 + e;
    }
    default:
      return last + terms[n - 2];
  }
}

// ---------------------------------------------------------------------------
// 题面
// ---------------------------------------------------------------------------

/** 混合运算的规范算式（校验器与答案都用它） */
export function parenExpr(spec: Extract<MathSpec, { kind: "paren" }>): string {
  const { form, a, b, c, d } = spec;
  switch (form) {
    case 0:
      return `(${a}+${b})*${c}`;
    case 1:
      return `(${a}-${b})*${c}`;
    case 2:
      return `${a}+${b}*${c}`;
    case 3:
      return `(${a}+${b})/${c}`;
    case 4:
      return `${a}*${b}-${c}*${d}`;
    default:
      return `${a}*(${b}+${c})-${d}`;
  }
}

function parenText(spec: Extract<MathSpec, { kind: "paren" }>): string {
  const { form, a, b, c, d } = spec;
  switch (form) {
    case 0:
      return `( ${a} + ${b} ) × ${c}`;
    case 1:
      return `( ${a} - ${b} ) × ${c}`;
    case 2:
      return `${a} + ${b} × ${c}`;
    case 3:
      return `( ${a} + ${b} ) ÷ ${c}`;
    case 4:
      return `${a} × ${b} - ${c} × ${d}`;
    default:
      return `${a} × ( ${b} + ${c} ) - ${d}`;
  }
}

/** 应用题的规范算式 */
export function wordExpr(spec: Extract<MathSpec, { kind: "word" }>): string {
  const { form, n1, n2, n3 } = spec;
  switch (form) {
    case "rows":
      return `${n1}*${n2}-${n3}`;
    case "pack":
      return `${n1}*${n2}+${n3}`;
    case "share":
      return `(${n1}-${n2})/${n3}`;
    case "fill":
      return `(${n1}-${n2})/${n3}`;
    case "trip":
      return `${n1}*${n2}+${n3}`;
    case "price":
      return `${n3}-${n1}*${n2}`;
    default:
      return `${n1}*${n2}-${n3}`;
  }
}

function wordText(spec: Extract<MathSpec, { kind: "word" }>): string {
  // 论排种、论亩收的题只挑地里长出来的那些
  const grown = spec.form === "rows" || spec.form === "area";
  const item = grown ? FARM_CROPS[spec.item % FARM_CROPS.length] : FARM_ITEMS[spec.item % FARM_ITEMS.length];
  const bag = FARM_BAGS[spec.bag % FARM_BAGS.length];
  const { n1, n2, n3 } = spec;
  switch (spec.form) {
    case "rows":
      return `农场种了 ${n1} 排${item}，每排 ${n2} 个，送走 ${n3} 个，还剩几个？`;
    case "pack":
      return `每${bag}装 ${n1} 个${item}，装满了 ${n2} ${bag}，又多出 ${n3} 个，一共几个？`;
    case "share":
      return `一共 ${n1} 个${item}，先卖掉 ${n2} 个，剩下的平均分给 ${n3} 个小伙伴，每人几个？`;
    case "fill":
      return `摘了 ${n1} 个${item}，先送走 ${n2} 个，剩下的每${bag}放 ${n3} 个，能装满几${bag}？`;
    case "trip":
      return `朵朵去果园摘${item}，每分钟走 ${n1} 米，走了 ${n2} 分钟，再走 ${n3} 米就到，一共多少米？`;
    case "price":
      return `${item}每千克 ${n1} 元，买了 ${n2} 千克，付出 ${n3} 元，应该找回多少元？`;
    default:
      return `一块长方形${item}地长 ${n1} 米、宽 ${n2} 米，已经种了 ${n3} 平方米，还剩多少平方米？`;
  }
}

/** 竖式题面：数位右对齐，横线下面是要填的那个数 */
function verticalHTML(a: number, b: number, plus: boolean): string {
  return (
    `<span class="mtf-vert">` +
    `<span class="mtf-vert-row">${a}</span>` +
    `<span class="mtf-vert-row">${plus ? "+" : "-"} ${b}</span>` +
    `<span class="mtf-vert-rule"></span>` +
    `<span class="mtf-vert-row">?</span>` +
    `</span>`
  );
}

function bigText(text: string): string {
  return `<span class="mtf-word">🧑‍🌾 ${text}</span>`;
}

/** 带余除法只问余数时的引导语（校验器靠它分辨两种问法） */
export const REMAINDER_ASK = "余数是几？";

/** 一份出题参数对应的题面与引导语（引导语一律 ≤ 15 个汉字） */
export function renderSpec(spec: MathSpec): { promptHTML: string; ask: string } {
  switch (spec.kind) {
    case "mul":
      return { promptHTML: `${spec.a} × ${spec.b} = ?`, ask: "算一算，积是多少？" };
    case "div":
      return { promptHTML: `${spec.a} ÷ ${spec.b} = ?`, ask: "平均分，每份是多少？" };
    case "divmod":
      return {
        promptHTML: `${spec.a} ÷ ${spec.b} = ?`,
        ask: spec.askRemainder ? REMAINDER_ASK : "商几余几？",
      };
    case "vertical":
      return {
        promptHTML: verticalHTML(spec.a, spec.b, spec.plus),
        ask: spec.plus ? "个位满十要进一～" : "个位不够减要借一～",
      };
    case "paren":
      return {
        promptHTML: `${parenText(spec)} = ?`,
        ask: spec.form === 2 || spec.form === 4 ? "先乘除，后加减～" : "先算括号里的～",
      };
    case "frac": {
      if (spec.form === "compare") {
        return {
          promptHTML: `${formatFraction(spec.an, spec.ad)} <span class="mtf-slot">○</span> ${formatFraction(
            spec.bn,
            spec.bd
          )}`,
          ask: "○ 里应该填哪个符号？",
        };
      }
      if (spec.form === "simplify") {
        return {
          promptHTML: `${formatFraction(spec.n, spec.d)} <span class="mtf-slot">⇒</span> 最简`,
          ask: "约成最简分数是多少？",
        };
      }
      return {
        promptHTML: `${formatFraction(spec.an, spec.d)} ${spec.plus ? "+" : "-"} ${formatFraction(
          spec.bn,
          spec.d
        )} = ?`,
        ask: "同分母，分子直接算～",
      };
    }
    case "fracLcd":
      return {
        promptHTML: `${formatFraction(spec.an, spec.ad)} ${spec.plus ? "+" : "-"} ${formatFraction(
          spec.bn,
          spec.bd
        )} = ?`,
        ask: "先通分，再算分子～",
      };
    case "dec":
      return {
        promptHTML: `${formatTenths(spec.a)} ${spec.plus ? "+" : "-"} ${formatTenths(spec.b)} = ?`,
        ask: "小数点对齐，再算～",
      };
    case "decMul":
      return {
        promptHTML: `${formatTenths(spec.a)} ${spec.times ? "×" : "÷"} ${spec.b} = ?`,
        ask: spec.times ? "算完看小数点在哪～" : "商的小数点要对齐～",
      };
    case "percent": {
      const item = FARM_ITEMS[spec.item % FARM_ITEMS.length];
      if (spec.form === "of") {
        return {
          promptHTML: bigText(`农场收了 ${spec.base} 个${item}，其中 ${spec.rate}% 送去了集市，送走多少个？`),
          ask: "先想一份是多少～",
        };
      }
      if (spec.form === "discount") {
        const name = DISCOUNTS.find((d) => d.rate === spec.rate)?.name ?? "八折";
        return {
          promptHTML: bigText(`一箱${item}原价 ${spec.base} 元，现在打${name}，要付多少元？`),
          ask: "打折是按原价的几成算～",
        };
      }
      return {
        promptHTML: bigText(`摘了 ${spec.base} 个${item}，其中 ${spec.part} 个是熟的，熟的占百分之几？`),
        ask: "先看部分占总数的几分之几～",
      };
    }
    case "ratio": {
      if (spec.form === "simplify") {
        return {
          promptHTML: `${spec.a} : ${spec.b} <span class="mtf-slot">⇒</span> 最简`,
          ask: "化成最简整数比是多少？",
        };
      }
      if (spec.form === "share") {
        const item = FARM_ITEMS[spec.item % FARM_ITEMS.length];
        return {
          promptHTML: bigText(
            `${spec.total} 个${item}按 ${spec.p} : ${spec.q} 分给朵朵和星星，星星分到几个？`
          ),
          ask: "先算一共分成几份～",
        };
      }
      return {
        promptHTML: `${spec.a} : ${spec.b} = ${spec.a * spec.k} : <span class="mtf-slot">?</span>`,
        ask: "前项扩大了几倍？",
      };
    }
    case "equation": {
      const { a, b } = spec;
      const x = `<span class="mtf-x">x</span>`;
      const text =
        spec.form === "addX"
          ? `${x} + ${a} = ${b}`
          : spec.form === "subX"
            ? `${x} - ${a} = ${b}`
            : spec.form === "xSub"
              ? `${a} - ${x} = ${b}`
              : spec.form === "mulX"
                ? `${a} × ${x} = ${b}`
                : `${x} ÷ ${a} = ${b}`;
      return { promptHTML: text, ask: "未知数是几？" };
    }
    case "word":
      return { promptHTML: bigText(wordText(spec)), ask: "分两步想，先算什么？" };
    default:
      return {
        promptHTML: `${spec.terms.join("，")}，<span class="mtf-slot">⬜</span>`,
        ask: "找出规律，下一个是几？",
      };
  }
}

/** 题面上孩子看得见、算题必须用到的那些数（校验器逐个回题面里找） */
export function visibleNumbers(spec: MathSpec): number[] {
  switch (spec.kind) {
    case "mul":
    case "div":
    case "divmod":
    case "vertical":
      return [spec.a, spec.b];
    case "paren":
      return (parenExpr(spec).match(/\d+/g) ?? []).map(Number);
    case "frac":
      if (spec.form === "compare") return [spec.an, spec.ad, spec.bn, spec.bd];
      if (spec.form === "simplify") return [spec.n, spec.d];
      return [spec.an, spec.bn, spec.d];
    case "fracLcd":
      return [spec.an, spec.ad, spec.bn, spec.bd];
    case "dec":
    case "decMul":
      return [];
    case "percent":
      // 折扣题写的是「八折」这个说法，题面上没有 80 这个数
      if (spec.form === "discount") return [spec.base];
      return spec.form === "rate" ? [spec.part, spec.base] : [spec.base, spec.rate];
    case "ratio":
      if (spec.form === "simplify") return [spec.a, spec.b];
      if (spec.form === "share") return [spec.total, spec.p, spec.q];
      return [spec.a, spec.b, spec.a * spec.k];
    case "equation":
      return [spec.a, spec.b];
    case "word":
      return [spec.n1, spec.n2, spec.n3];
    default:
      return spec.terms.slice();
  }
}

// ---------------------------------------------------------------------------
// 干扰项：每一个都来自一种典型错误
// ---------------------------------------------------------------------------

function num(text: number, why: string): Wrong {
  return { text: String(text), why };
}

export function wrongsOf(spec: MathSpec): Wrong[] {
  switch (spec.kind) {
    case "mul": {
      const { a, b } = spec;
      return [
        num(noCarryProduct(a, b), "忘记进位：每一位各乘各的"),
        num((a % 10) * b + (a - (a % 10)), "只把个位乘了，十位原样抄下来"),
        num(a * (b - 1), "少乘了一次"),
        num(a * (b + 1), "多乘了一次"),
        num(a + b, "把乘号看成了加号"),
      ];
    }
    case "div": {
      const q = spec.a / spec.b;
      const out = [num(q - 1, "试商小了一点"), num(q + 1, "试商大了一点"), num(spec.b, "把除数当成了商")];
      if (q % 10 === 0) out.push(num(q / 10, "商末尾的零漏写了"));
      return out;
    }
    case "divmod": {
      const q = Math.floor(spec.a / spec.b);
      const r = spec.a - q * spec.b;
      if (spec.askRemainder) {
        return [
          num(spec.b, "余数写成了除数，余数必须比除数小"),
          num(spec.b - r, "余数和「差多少够一份」弄反了"),
          num(r + 1, "余数多算了一"),
          num(Math.max(0, r - 1), "余数少算了一"),
        ];
      }
      return [
        { text: `${q + 1} 余 ${r}`, why: "商大了一，剩下的没够一份" },
        { text: `${q} 余 ${spec.b}`, why: "余数写成了除数，余数必须比除数小" },
        { text: `${q} 余 ${spec.b - r}`, why: "余数和「差多少够一份」弄反了" },
        { text: `${Math.max(0, q - 1)} 余 ${r}`, why: "商小了一" },
      ];
    }
    case "vertical": {
      const { a, b, plus } = spec;
      const answer = plus ? a + b : a - b;
      return plus
        ? [
            num(noCarrySum(a, b), "忘记进位：满十的那一个十没加上去"),
            num(answer - 10, "进位只进了一半"),
            num(answer + 10, "多进了一个十"),
            num(answer + 1, "进位的那个一记到了个位上"),
            num(answer - 1, "个位相加时少数了一个"),
          ]
        : [
            num(noBorrowDiff(a, b), "不够减就大减小，忘了向前一位借"),
            num(answer + 10, "借了一个十，前一位却没减去一"),
            num(answer - 10, "多借了一个十"),
            num(answer - 1, "借来的十少数了一个"),
            num(answer + 1, "个位借位之后多数了一个"),
          ];
    }
    case "paren": {
      const { form, a, b, c, d } = spec;
      const answer = evalExpr(parenExpr(spec));
      const out: Wrong[] = [];
      switch (form) {
        case 0:
          out.push(num(a + b * c, "忽略括号，先算了乘法"));
          out.push(num(a + b, "只算了括号里那一步"));
          out.push(num(a * c + b, "只把括号里第一个数乘了"));
          break;
        case 1:
          out.push(num(a - b * c, "忽略括号，先算了乘法"));
          out.push(num(a - b, "只算了括号里那一步"));
          out.push(num(a * c - b, "只把括号里第一个数乘了"));
          break;
        case 2:
          out.push(num((a + b) * c, "从左往右算，忘了先乘后加"));
          out.push(num(b * c, "只算了乘法那一步"));
          out.push(num(a + b + c, "把乘号看成了加号"));
          break;
        case 3:
          out.push(num(a + b / c, "忽略括号，先算了除法"));
          out.push(num(a + b, "只算了括号里那一步"));
          out.push(num((a + b) * c, "把除号看成了乘号"));
          break;
        case 4:
          out.push(num((a * b - c) * d, "从左往右算，忘了两个乘法各算各的"));
          out.push(num(a * b, "只算了前一个乘法"));
          out.push(num(a * b - c - d, "后一个乘法做成了连减"));
          break;
        default:
          out.push(num(a * b + c - d, "忽略括号，只把括号里第一个数乘了"));
          out.push(num(a * (b + c), "少减了最后一步"));
          out.push(num(a * (b + c - d), "把减法也塞进括号里算了"));
      }
      const where = form === 2 || form === 4 ? "乘的那一步" : "括号里";
      out.push(num(answer + c, `${where}多算了一份`));
      out.push(num(answer - c, `${where}少算了一份`));
      return out;
    }
    case "frac": {
      if (spec.form === "compare") {
        const answer = answerOf(spec);
        const why: Record<string, string> = {
          "＞": "只比了分子，忘了分母越大每份越小",
          "＜": "只比了分母，分母大的反而每份小",
          "＝": "看着数字差不多就以为一样大",
        };
        return ["＞", "＜", "＝"].filter((s) => s !== answer).map((s) => ({ text: s, why: why[s] }));
      }
      if (spec.form === "simplify") {
        const g = gcd(spec.n, spec.d);
        const half = smallestFactor(g);
        return [
          { text: formatFraction(spec.n / half, spec.d / half), why: "只约了一半，还能接着约" },
          { text: formatFraction(spec.n / g, spec.d), why: "只约了分子，分母原样抄下来" },
          { text: formatFraction(Math.max(1, spec.n - 1), Math.max(2, spec.d - 1)), why: "分子分母各减了同一个数" },
          { text: formatFraction(spec.d / g, spec.n / g), why: "分子分母写反了" },
        ];
      }
      const n = spec.plus ? spec.an + spec.bn : spec.an - spec.bn;
      return [
        { text: formatFraction(n, spec.d * 2), why: "分母也跟着相加了" },
        {
          text: formatFraction(spec.plus ? Math.abs(spec.an - spec.bn) : spec.an + spec.bn, spec.d),
          why: "加号减号看反了",
        },
        { text: formatFraction(spec.an * spec.bn, spec.d), why: "把加减做成了乘" },
        { text: formatFraction(spec.an, spec.d), why: "只抄了第一个分数，没接着算" },
        { text: formatFraction(spec.d, Math.max(1, n)), why: "分子分母写反了" },
      ];
    }
    case "fracLcd": {
      const L = lcm(spec.ad, spec.bd);
      const n = spec.plus
        ? spec.an * (L / spec.ad) + spec.bn * (L / spec.bd)
        : spec.an * (L / spec.ad) - spec.bn * (L / spec.bd);
      return [
        {
          text: formatFraction(spec.plus ? spec.an + spec.bn : spec.an - spec.bn, spec.ad + spec.bd),
          why: "分子加分子、分母加分母",
        },
        {
          text: formatFraction(spec.plus ? spec.an + spec.bn : spec.an - spec.bn, L),
          why: "分母通分了，分子却没跟着变",
        },
        { text: formatFraction(n, spec.ad * spec.bd), why: "分母用了两数相乘，没找最小公倍数" },
        { text: formatFraction(n, spec.ad + spec.bd), why: "分母直接加起来当成了公分母" },
        {
          text: formatFraction(
            Math.abs(
              spec.plus
                ? spec.an * (L / spec.ad) - spec.bn * (L / spec.bd)
                : spec.an * (L / spec.ad) + spec.bn * (L / spec.bd)
            ),
            L
          ),
          why: "加号减号看反了",
        },
        {
          text: formatFraction(
            Math.abs(spec.plus ? spec.an * (L / spec.ad) + spec.bn : spec.an * (L / spec.ad) - spec.bn),
            L
          ),
          why: "只通分了一个分数，另一个分子照抄下来",
        },
      ];
    }
    case "dec": {
      const r = spec.plus ? spec.a + spec.b : spec.a - spec.b;
      return [
        { text: formatTenths(r + (spec.plus ? -10 : 10)), why: "整数部分的进位或借位漏了" },
        { text: formatTenths(r + 1), why: "十分位算多了一" },
        { text: formatTenths(r - 1), why: "十分位算少了一" },
        { text: String(r), why: "小数点丢了，当成整数算" },
      ];
    }
    case "decMul": {
      const r = spec.times ? spec.a * spec.b : spec.a / spec.b;
      return [
        { text: String(r), why: "小数点丢了，当成整数算" },
        { text: formatTenths(r * 10), why: "小数点点错了一位" },
        { text: formatTenths(r + spec.b), why: "多算了一个" },
        { text: formatTenths(Math.max(1, r - spec.b)), why: "少算了一个" },
      ];
    }
    case "percent": {
      if (spec.form === "rate") {
        const v = (spec.part * 100) / spec.base;
        const flipped = (spec.base * 100) / spec.part;
        const out: Wrong[] = [
          { text: `${100 - v}%`, why: "算成了剩下那部分占的百分比" },
          { text: `${v * 10}%`, why: "百分号的位置点错了" },
          { text: `${spec.base - spec.part}%`, why: "把相差的个数直接当成了百分数" },
          { text: `${v + 10}%`, why: "百分率多看了一成" },
          { text: `${Math.max(1, v - 10)}%`, why: "百分率少看了一成" },
        ];
        if (Number.isInteger(flipped)) out.push({ text: `${flipped}%`, why: "部分和总数倒过来除了" });
        return out;
      }
      const answer = (spec.base * spec.rate) / 100;
      // 差一成：孩子把百分数看错一档，是这一类最常见的算偏
      const step = spec.base / 10;
      const offByTen = [
        num(answer + step, "百分数多看了一成"),
        num(Math.max(1, answer - step), "百分数少看了一成"),
      ];
      if (spec.form === "discount") {
        return [
          num(spec.base - answer, "打折算成了只付折扣掉的那部分"),
          num(spec.base - spec.rate / 10, "把折数当成了要减掉的钱"),
          num(spec.base - (100 - spec.rate), "把百分数直接当成了钱数减掉"),
          ...offByTen,
        ];
      }
      return [
        num(spec.base - answer, "算成了留下的那部分"),
        num((spec.base * spec.rate) / 10, "百分数当成了十分之几"),
        num(spec.base - spec.rate, "把百分数直接当成了个数减掉"),
        ...offByTen,
      ];
    }
    case "ratio": {
      if (spec.form === "simplify") {
        const g = gcd(spec.a, spec.b);
        // 「只约了一半」这种错法在比里写出来数值和正解一样（6:9 就是 2:3），
        // 那种选项没有唯一答案可言，所以这里挑的是真会写歪的几种
        return [
          { text: `${spec.b / g}:${spec.a / g}`, why: "前项后项写反了" },
          { text: `${spec.a / g}:${spec.b}`, why: "只约了前项，后项照抄下来" },
          { text: `${spec.a}:${spec.b / g}`, why: "只约了后项，前项照抄下来" },
          { text: `${spec.a / g}:${spec.b / g + 1}`, why: "后项多约了一步" },
          { text: `${spec.a / g + 1}:${spec.b / g}`, why: "前项多约了一步" },
        ];
      }
      if (spec.form === "share") {
        const parts = spec.p + spec.q;
        return [
          num((spec.total * spec.p) / parts, "拿错了份数，算成了另一个人的"),
          num(spec.total / parts, "只算出一份是多少就停了"),
          num(spec.total - spec.q, "把份数当成了个数直接减"),
          num((spec.total * spec.q) / parts + spec.total / parts, "多分了一份"),
          num(Math.max(1, (spec.total * spec.q) / parts - spec.total / parts), "少分了一份"),
        ];
      }
      const answer = spec.b * spec.k;
      return [
        num(spec.b + (spec.a * spec.k - spec.a), "用加法凑，比例要看倍数"),
        num(spec.a * spec.k, "照抄了前项的结果"),
        num(spec.b * (spec.k + 1), "倍数多算了一倍"),
      ];
    }
    case "equation": {
      const { a, b } = spec;
      const x = Number(answerOf(spec));
      const out: Wrong[] = [];
      switch (spec.form) {
        case "addX":
          out.push(num(b + a, "逆运算用反了，加号两边都加"), num(b, "把等号右边直接当成了未知数"), num(a, "把已知数当成了未知数"));
          break;
        case "subX":
          out.push(num(Math.max(1, b - a), "逆运算用反了"), num(b, "把等号右边直接当成了未知数"), num(a, "把已知数当成了未知数"));
          break;
        case "xSub":
          out.push(num(a + b, "逆运算用反了"), num(b, "把等号右边直接当成了未知数"), num(Math.max(1, b - a), "被减数和差弄反了"));
          break;
        case "mulX":
          out.push(num(b * a, "逆运算用反了，乘除弄颠倒"), num(Math.max(1, b - a), "把乘法当成了加法"), num(a + b, "把乘法当成了加法"));
          break;
        default:
          out.push(num(Math.max(1, b - a), "逆运算用反了"), num(a + b, "把除法当成了减法"), num(b, "把等号右边直接当成了未知数"));
      }
      // 逆运算方向对了、位值算歪了，也是这一类的常客
      out.push(num(x + 10, "十位上多算了一个十"), num(Math.max(1, x - 10), "十位上少算了一个十"));
      return out;
    }
    case "word": {
      const { form, n1, n2, n3 } = spec;
      const answer = evalExpr(wordExpr(spec));
      const out: Wrong[] = [];
      switch (form) {
        case "rows":
          out.push(num(n1 * n2, "只算了第一步，忘了送走的"), num(n1 * n2 + n3, "该减的做成了加"), num(n1 + n2 - n3, "该乘的做成了加"));
          out.push(num(noBorrowDiff(n1 * n2, n3), "第二步不够减就大减小，忘了借位"));
          break;
        case "pack":
          out.push(num(n1 * n2, "只算了装满的，忘了多出来的"), num(n1 * n2 - n3, "该加的做成了减"), num(n1 + n2 + n3, "该乘的做成了加"));
          out.push(num(noCarrySum(n1 * n2, n3), "第二步加的时候忘了进位"));
          break;
        case "share":
          out.push(num(n1 - n2, "只算了第一步，还没平均分"), num(Math.round(n1 / n3), "忘了先减掉卖出去的"), num(n1 - n2 - n3, "该除的做成了减"));
          out.push(num(answer + 1, "试商大了一"), num(Math.max(1, answer - 1), "试商小了一"));
          break;
        case "fill":
          out.push(num(n1 - n2, "只算了第一步，还没往里放"), num(Math.round(n1 / n3), "忘了先减掉送走的"), num(n1 - n2 - n3, "该除的做成了减"));
          out.push(num(answer + 1, "试商大了一"), num(Math.max(1, answer - 1), "试商小了一"));
          break;
        case "trip":
          out.push(num(n1 * n2, "只算了骑过的那一段"), num(n1 * n2 - n3, "该加的做成了减"), num(n1 + n2 + n3, "路程要用速度乘时间"));
          out.push(num(noCarrySum(n1 * n2, n3), "第二步加的时候忘了进位"));
          break;
        case "price":
          out.push(num(n1 * n2, "只算了花掉的钱"), num(n3 + n1 * n2, "找回的钱做成了加"), num(n3 - n1 - n2, "该乘的做成了减"));
          out.push(num(noBorrowDiff(n3, n1 * n2), "第二步不够减就大减小，忘了借位"));
          break;
        default:
          out.push(
            num(n1 * n2, "只算了整块地的面积"),
            num((n1 + n2) * 2 - n3, "面积算成了周长"),
            num(n1 * n2 + n3, "该减的做成了加")
          );
          out.push(num(noBorrowDiff(n1 * n2, n3), "第二步不够减就大减小，忘了借位"));
      }
      return out;
    }
    default: {
      const t = spec.terms;
      const last = t[t.length - 1];
      const prev = t[t.length - 2];
      switch (spec.rule) {
        case "arith":
          return [num(last + (t[1] - t[0]) + 1, "公差记多了一"), num(last + (t[1] - t[0]) - 1, "公差记少了一"), num(last * 2, "把等差看成了翻倍")];
        case "geo":
          return [num(last + (last - prev), "把等比看成了等差"), num(last + t[1] / t[0], "倍数当成了要加的数"), num(last * (t[1] / t[0]) + 1, "算完多加了一")];
        case "quad":
          return [num(last + (last - prev), "只看了最后一次的差，没看差在变大"), num(last + (last - prev) + 2, "差变大的幅度记错了"), num(last * 2, "把它看成了翻倍")];
        default:
          return [num(last * 2, "把「前两个相加」看成了翻倍"), num(last + prev + 1, "多加了一"), num(last + prev - 1, "少加了一")];
      }
    }
  }
}

/** g 的最小质因数（约分只约一半这种错法要用） */
function smallestFactor(g: number): number {
  for (let i = 2; i <= g; i++) {
    if (g % i === 0) return i;
  }
  return Math.max(2, g);
}

// ---------------------------------------------------------------------------
// 生成器：一个题型一个纯函数，吃随机源与难度档位
// ---------------------------------------------------------------------------

export function genMul(rand: () => number, t: number): MathSpec {
  // 表内乘法只在最开始那十几关出现，之后一律两位数乘一位数，数字随关号往上走
  const a = t < 0.15 ? randInt(rand, 4, 9) : randInt(rand, 11, scale(t, 25, 79));
  const b = randInt(rand, 3, 9);
  return { kind: "mul", a, b };
}

export function genDiv(rand: () => number, t: number): MathSpec {
  const b = randInt(rand, 2, 9);
  // 被除数至少两位数：4 ÷ 2 这种口算在前 99 关就练完了
  const lo = Math.max(3, Math.ceil(24 / b));
  const q = randInt(rand, lo, Math.max(lo + 3, scale(t, 14, 60)));
  return { kind: "div", a: b * q, b };
}

export function genDivMod(rand: () => number, t: number): MathSpec {
  const b = randInt(rand, 3, 9);
  const q = t < 0.15 ? randInt(rand, 3, 9) : randInt(rand, 6, scale(t, 20, 40));
  const r = randInt(rand, 1, b - 1);
  return { kind: "divmod", a: b * q + r, b, askRemainder: t >= 0.25 && rand() < 0.4 };
}

export function genVertical(rand: () => number, t: number): MathSpec {
  const plus = rand() < 0.5;
  const top = t < 0.35 ? 99 : t < 0.7 ? 499 : 999;
  for (let guard = 0; guard < 200; guard++) {
    if (plus) {
      const a = randInt(rand, 15, top);
      const b = randInt(rand, 15, top);
      // 必须真的有一次进位，否则练不到「满十进一」
      if (noCarrySum(a, b) === a + b) continue;
      return { kind: "vertical", plus: true, a, b };
    }
    const a = randInt(rand, 25, top);
    const b = randInt(rand, 12, a - 1);
    // 必须真的有一次退位，而且不能借到没有的位上
    if (noBorrowDiff(a, b) === a - b) continue;
    return { kind: "vertical", plus: false, a, b };
  }
  return { kind: "vertical", plus: true, a: 47, b: 38 };
}

export function genParen(rand: () => number, t: number): MathSpec {
  const hi = scale(t, 12, 40);
  for (let guard = 0; guard < 300; guard++) {
    const form = (t < 0.4 ? randInt(rand, 0, 3) : randInt(rand, 0, 5)) as 0 | 1 | 2 | 3 | 4 | 5;
    const c = randInt(rand, 2, 9);
    let a = randInt(rand, 2, hi);
    let b = randInt(rand, 2, Math.max(3, Math.floor(hi / 2)));
    let d = randInt(rand, 2, 9);
    if (form === 1 && a <= b) continue;
    if (form === 3) {
      // 括号里的和必须能被整除
      const total = c * randInt(rand, 2, 12);
      b = randInt(rand, 1, total - 1);
      a = total - b;
    }
    if (form === 4) d = randInt(rand, 2, 9);
    const spec: MathSpec = { kind: "paren", form, a, b, c, d };
    const answer = evalExpr(parenExpr(spec));
    if (!Number.isInteger(answer) || answer < 1 || answer > 900) continue;
    return spec;
  }
  return { kind: "paren", form: 0, a: 5, b: 3, c: 3, d: 2 };
}

export function genFrac(rand: () => number, t: number): MathSpec {
  const form = t < 0.3 ? 0 : t < 0.6 ? randInt(rand, 0, 1) : randInt(rand, 0, 2);
  if (form === 0) {
    for (let guard = 0; guard < 200; guard++) {
      const ad = randInt(rand, 2, 9);
      const an = randInt(rand, 1, ad - 1);
      const bd = randInt(rand, 2, 9);
      const bn = randInt(rand, 1, bd - 1);
      // 两边写得一模一样就不用比了，得让孩子真的通分或者交叉相乘
      if (an === bn && ad === bd) continue;
      return { kind: "frac", form: "compare", an, ad, bn, bd };
    }
    return { kind: "frac", form: "compare", an: 3, ad: 5, bn: 2, bd: 3 };
  }
  if (form === 1) {
    for (let guard = 0; guard < 200; guard++) {
      const base = simplifyFraction(randInt(rand, 1, 7), randInt(rand, 2, 9));
      const k = randInt(rand, 2, 6);
      if (base.n >= base.d) continue;
      return { kind: "frac", form: "simplify", n: base.n * k, d: base.d * k };
    }
    return { kind: "frac", form: "simplify", n: 6, d: 8 };
  }
  for (let guard = 0; guard < 300; guard++) {
    const d = randInt(rand, 4, 12);
    const plus = rand() < 0.5;
    let an: number;
    let bn: number;
    if (plus) {
      an = randInt(rand, 1, d - 2);
      bn = randInt(rand, 1, d - 1 - an);
    } else {
      an = randInt(rand, 2, d - 1);
      bn = randInt(rand, 1, an - 1);
    }
    const n = plus ? an + bn : an - bn;
    // 结果必须已经是最简：否则「没约分」的写法和正解数值相等，这题就没有唯一答案了
    if (gcd(n, d) !== 1) continue;
    return { kind: "frac", form: "same", an, bn, d, plus };
  }
  return { kind: "frac", form: "same", an: 1, bn: 2, d: 5, plus: true };
}

export function genFracLcd(rand: () => number, t: number): MathSpec {
  const top = t < 0.5 ? 8 : 12;
  for (let guard = 0; guard < 400; guard++) {
    const ad = randInt(rand, 2, top);
    const bd = randInt(rand, 2, top);
    if (ad === bd) continue;
    const L = lcm(ad, bd);
    if (L > 36) continue;
    const an = randInt(rand, 1, ad - 1);
    const bn = randInt(rand, 1, bd - 1);
    const plus = rand() < 0.5;
    const n = plus ? an * (L / ad) + bn * (L / bd) : an * (L / ad) - bn * (L / bd);
    // 结果得是真分数、非负，而且已经最简（同样是为了唯一答案）
    if (n <= 0 || n >= L) continue;
    if (gcd(n, L) !== 1) continue;
    return { kind: "fracLcd", an, ad, bn, bd, plus };
  }
  return { kind: "fracLcd", an: 1, ad: 2, bn: 1, bd: 3, plus: true };
}

export function genDec(rand: () => number, t: number): MathSpec {
  const max = t < 0.5 ? 99 : 299;
  for (let guard = 0; guard < 200; guard++) {
    let a = randInt(rand, 11, max);
    let b = randInt(rand, 11, max);
    const plus = rand() < 0.5;
    if (!plus && b > a) [a, b] = [b, a];
    const r = plus ? a + b : a - b;
    // 两个加数都得是真小数，不然「小数点对齐」根本练不到
    if (a % 10 === 0 || b % 10 === 0) continue;
    // 结果也留一位小数才看得出练到了没
    if (r <= 0 || r % 10 === 0) continue;
    return { kind: "dec", a, b, plus };
  }
  return { kind: "dec", a: 25, b: 13, plus: true };
}

export function genDecMul(rand: () => number, t: number): MathSpec {
  const times = rand() < 0.5;
  for (let guard = 0; guard < 200; guard++) {
    const b = randInt(rand, 2, 9);
    if (times) {
      const a = randInt(rand, 11, t < 0.5 ? 59 : 99);
      // 被乘的数和积都得是真小数，不然这题跟整数乘法没两样
      if (a % 10 === 0 || (a * b) % 10 === 0) continue;
      if (a * b > 999) continue;
      return { kind: "decMul", times: true, a, b };
    }
    // 除法必须除得尽，商仍是规范的一位小数
    const q = randInt(rand, 2, t < 0.5 ? 40 : 99);
    const a = q * b;
    if (a % 10 === 0 || q % 10 === 0) continue;
    if (a > 999) continue;
    return { kind: "decMul", times: false, a, b };
  }
  return { kind: "decMul", times: true, a: 25, b: 4 };
}

export function genPercent(rand: () => number, t: number): MathSpec {
  const form = t < 0.4 ? randInt(rand, 0, 1) : randInt(rand, 0, 2);
  const item = randInt(rand, 0, FARM_ITEMS.length - 1);
  if (form === 0) {
    const rate = pick(rand, [10, 20, 25, 40, 50, 60, 75, 80]);
    for (let guard = 0; guard < 200; guard++) {
      const base = randInt(rand, 2, scale(t, 12, 40)) * 20;
      if (((base * rate) / 100) % 1 !== 0) continue;
      if (base * rate === 0) continue;
      return { kind: "percent", form: "of", base, rate, item };
    }
    return { kind: "percent", form: "of", base: 200, rate: 25, item };
  }
  if (form === 1) {
    const d = pick(rand, DISCOUNTS);
    for (let guard = 0; guard < 200; guard++) {
      // 一箱农产品的价钱控制在 20–300 元，别写出离谱的天价
      const base = randInt(rand, 1, scale(t, 5, 15)) * 20;
      if (((base * d.rate) / 100) % 1 !== 0) continue;
      return { kind: "percent", form: "discount", base, rate: d.rate, item };
    }
    return { kind: "percent", form: "discount", base: 80, rate: 80, item };
  }
  for (let guard = 0; guard < 200; guard++) {
    const base = pick(rand, [20, 25, 40, 50, 80, 100, 200]);
    const v = pick(rand, [10, 20, 25, 40, 50, 60, 75, 80]);
    const part = (base * v) / 100;
    if (!Number.isInteger(part) || part <= 0 || part >= base) continue;
    return { kind: "percent", form: "rate", part, base, item };
  }
  return { kind: "percent", form: "rate", part: 20, base: 50, item };
}

export function genRatio(rand: () => number, t: number): MathSpec {
  const form = t < 0.4 ? randInt(rand, 0, 1) : randInt(rand, 0, 2);
  if (form === 0) {
    for (let guard = 0; guard < 200; guard++) {
      const g = randInt(rand, 2, 9);
      const x = randInt(rand, 1, 9);
      const y = randInt(rand, 1, 9);
      if (x === y || gcd(x, y) !== 1) continue;
      return { kind: "ratio", form: "simplify", a: g * x, b: g * y };
    }
    return { kind: "ratio", form: "simplify", a: 12, b: 18 };
  }
  if (form === 1) {
    for (let guard = 0; guard < 200; guard++) {
      const p = randInt(rand, 1, 5);
      const q = randInt(rand, 1, 6);
      if (p === q || gcd(p, q) !== 1) continue;
      const each = randInt(rand, 2, scale(t, 8, 20));
      return { kind: "ratio", form: "share", total: (p + q) * each, p, q, item: randInt(rand, 0, FARM_ITEMS.length - 1) };
    }
    return { kind: "ratio", form: "share", total: 24, p: 1, q: 2, item: 0 };
  }
  for (let guard = 0; guard < 200; guard++) {
    const a = randInt(rand, 2, 9);
    const b = randInt(rand, 2, 9);
    if (a === b || gcd(a, b) !== 1) continue;
    const k = randInt(rand, 2, t < 0.5 ? 6 : 9);
    return { kind: "ratio", form: "proportion", a, b, k };
  }
  return { kind: "ratio", form: "proportion", a: 3, b: 4, k: 3 };
}

export function genEquation(rand: () => number, t: number): MathSpec {
  const forms = t < 0.4 ? (["addX", "subX", "xSub"] as const) : (["addX", "subX", "xSub", "mulX", "divX"] as const);
  const form = pick(rand, forms);
  const hi = scale(t, 20, 99);
  if (form === "addX") {
    const x = randInt(rand, 2, hi);
    const a = randInt(rand, 2, hi);
    return { kind: "equation", form, a, b: x + a };
  }
  if (form === "subX") {
    const a = randInt(rand, 2, hi);
    const b = randInt(rand, 2, hi);
    return { kind: "equation", form, a, b };
  }
  if (form === "xSub") {
    const x = randInt(rand, 2, hi);
    const b = randInt(rand, 2, hi);
    return { kind: "equation", form, a: x + b, b };
  }
  if (form === "mulX") {
    const a = randInt(rand, 2, 9);
    const x = randInt(rand, 2, scale(t, 9, 30));
    return { kind: "equation", form, a, b: a * x };
  }
  const a = randInt(rand, 2, 9);
  const b = randInt(rand, 2, scale(t, 9, 30));
  return { kind: "equation", form: "divX", a, b };
}

export function genWord(rand: () => number, t: number): MathSpec {
  const item = randInt(rand, 0, FARM_ITEMS.length - 1);
  const bag = randInt(rand, 0, FARM_BAGS.length - 1);
  const forms: WordForm[] =
    t < 0.35 ? ["rows", "pack"] : t < 0.7 ? ["rows", "pack", "share", "fill", "price"] : ["share", "fill", "trip", "price", "area"];
  const form = pick(rand, forms);
  for (let guard = 0; guard < 200; guard++) {
    let n1 = 0;
    let n2 = 0;
    let n3 = 0;
    switch (form) {
      case "rows":
        n1 = randInt(rand, 3, 9);
        n2 = randInt(rand, 4, 12);
        n3 = randInt(rand, 2, Math.max(2, n1 * n2 - 2));
        break;
      case "pack":
        n1 = randInt(rand, 3, 9);
        n2 = randInt(rand, 4, 15);
        n3 = randInt(rand, 2, 19);
        break;
      case "share": {
        const people = randInt(rand, 3, 9);
        const each = randInt(rand, 4, 15);
        const sold = randInt(rand, 5, 40);
        n1 = people * each + sold;
        n2 = sold;
        n3 = people;
        break;
      }
      case "fill": {
        const per = randInt(rand, 3, 9);
        const bags = randInt(rand, 3, 12);
        const away = randInt(rand, 2, 30);
        n1 = per * bags + away;
        n2 = away;
        n3 = per;
        break;
      }
      case "trip":
        n1 = randInt(rand, 4, 12) * 10;
        n2 = randInt(rand, 5, 15);
        n3 = randInt(rand, 2, 40) * 10;
        break;
      case "price":
        n1 = randInt(rand, 3, 15);
        n2 = randInt(rand, 2, 9);
        n3 = n1 * n2 + randInt(rand, 2, 40);
        break;
      default:
        n1 = randInt(rand, 6, 20);
        n2 = randInt(rand, 4, 12);
        n3 = randInt(rand, 5, Math.max(5, n1 * n2 - 5));
        break;
    }
    const spec: MathSpec = { kind: "word", form, n1, n2, n3, item, bag };
    const v = evalExpr(wordExpr(spec));
    // 结果太小的题不要：剩 3 个、找回 2 元这种，能凑出来的错法也所剩无几了
    if (!Number.isInteger(v) || v < 5) continue;
    return spec;
  }
  return { kind: "word", form: "rows", n1: 5, n2: 6, n3: 8, item, bag };
}

export function genPattern(rand: () => number, t: number): MathSpec {
  const rules: PatternRule[] = t < 0.4 ? ["arith", "geo"] : ["arith", "geo", "quad", "fib"];
  for (let guard = 0; guard < 300; guard++) {
    const rule = pick(rand, rules);
    const terms: number[] = [];
    if (rule === "arith") {
      const start = randInt(rand, 1, scale(t, 9, 30));
      const d = randInt(rand, 2, scale(t, 6, 15));
      for (let i = 0; i < 5; i++) terms.push(start + d * i);
    } else if (rule === "geo") {
      const start = randInt(rand, 1, 4);
      const r = randInt(rand, 2, 3);
      for (let i = 0; i < 5; i++) terms.push(start * r ** i);
    } else if (rule === "quad") {
      const start = randInt(rand, 1, 9);
      const d0 = randInt(rand, 1, 6);
      const e = randInt(rand, 1, 4);
      let cur = start;
      let d = d0;
      for (let i = 0; i < 5; i++) {
        terms.push(cur);
        cur += d;
        d += e;
      }
    } else {
      const t1 = randInt(rand, 1, 6);
      const t2 = randInt(rand, t1, t1 + 6);
      terms.push(t1, t2);
      for (let i = 2; i < 5; i++) terms.push(terms[i - 1] + terms[i - 2]);
    }
    const next = nextOfPattern(rule, terms);
    if (next > 999) continue;
    // 唯一答案：给出的五项不能同时符合另一条规律却指向别的下一项
    if (patternNextValues(terms).length !== 1) continue;
    return { kind: "pattern", rule, terms };
  }
  return { kind: "pattern", rule: "arith", terms: [3, 7, 11, 15, 19] };
}

/**
 * 这五项能符合的全部规律各自指向的下一项（去重）。
 * 只有恰好剩下一个值，这道找规律题才有唯一答案。
 */
export function patternNextValues(terms: readonly number[]): number[] {
  const out = new Set<number>();
  const n = terms.length;
  const diffs = terms.slice(1).map((v, i) => v - terms[i]);
  if (diffs.every((d) => d === diffs[0])) out.add(terms[n - 1] + diffs[0]);
  if (terms[0] !== 0 && terms.every((v, i) => (i === 0 ? true : v * terms[0] === terms[1] * terms[i - 1]))) {
    out.add((terms[n - 1] * terms[1]) / terms[0]);
  }
  const dd = diffs.slice(1).map((v, i) => v - diffs[i]);
  if (dd.length > 0 && dd.every((v) => v === dd[0])) out.add(terms[n - 1] + diffs[n - 2] + dd[0]);
  if (terms.slice(2).every((v, i) => v === terms[i] + terms[i + 1])) out.add(terms[n - 1] + terms[n - 2]);
  return [...out];
}

/** 题型 → 生成器（纯函数表，测试直接遍历它） */
export const GENERATORS: Record<AdvancedMathKind, (rand: () => number, t: number) => MathSpec> = {
  mul: genMul,
  div: genDiv,
  divmod: genDivMod,
  vertical: genVertical,
  paren: genParen,
  frac: genFrac,
  fracLcd: genFracLcd,
  dec: genDec,
  decMul: genDecMul,
  percent: genPercent,
  ratio: genRatio,
  equation: genEquation,
  word: genWord,
  pattern: genPattern,
};

// ---------------------------------------------------------------------------
// 组装一道题
// ---------------------------------------------------------------------------

/** 一份出题参数 → 一道完整的题（选项从典型错误里挑两个，打乱后给出） */
export function buildFromSpec(spec: MathSpec, rand: () => number): MathQ {
  const answer = answerOf(spec);
  const answerText = String(answer);
  const seen = new Set<string>([canonAnswer(answerText)]);
  const usable: Wrong[] = [];
  const loose = CHINESE_PROMPT_KINDS.has(spec.kind as AdvancedMathKind);
  for (const w of wrongsOf(spec)) {
    if (!isSaneWrong(w.text, answerText, loose)) continue;
    const key = canonAnswer(w.text);
    if (seen.has(key)) continue;
    seen.add(key);
    usable.push(w);
  }
  const picked = shuffled(usable, rand).slice(0, 2);
  const chosen = shuffled([{ text: answerText, why: "" }, ...picked], rand);
  const { promptHTML, ask } = renderSpec(spec);
  const q: MathQ = {
    kind: spec.kind,
    answer,
    promptHTML,
    ask,
    choices: chosen.map((c) => c.text),
    correct: chosen.findIndex((c) => c.text === answerText),
    spec,
    traps: picked.map((w) => w.why),
  };
  const expr = exprOf(spec);
  if (expr) q.expr = expr;
  return q;
}

/**
 * 题目对应的规范算式。中文叙述的题（应用题 / 百分数 / 按比分配）靠它被独立验算一遍，
 * 校验器会拿算式的值和答案对账，所以这几类题**必须**给得出算式。
 */
export function exprOf(spec: MathSpec): string | undefined {
  switch (spec.kind) {
    case "word":
      return wordExpr(spec);
    case "paren":
      return parenExpr(spec);
    case "percent":
      return spec.form === "rate"
        ? `${spec.part}*100/${spec.base}`
        : `${spec.base}*${spec.rate}/100`;
    case "ratio":
      return spec.form === "share" ? `${spec.total}*${spec.q}/(${spec.p}+${spec.q})` : undefined;
    default:
      return undefined;
  }
}

/**
 * 干扰项起码得像个答案：非负、写法规范、和正解不等值、不离谱。
 *
 * `loose` 给中文叙述的题（应用题 / 百分数 / 按比分配）放宽量级：
 * 那几类最典型的错法是「只算了第一步」，整块地的面积本来就可能是剩余面积的十几倍，
 * 这种选项不但不离谱，还正是要考的地方。
 */
function isSaneWrong(text: string, answerText: string, loose = false): boolean {
  if (text === answerText) return false;
  // 比大小题的三个符号本来就是全部选项
  if (["＞", "＜", "＝"].includes(text)) return true;
  if (/^-/.test(text) || text.includes("-")) return false;
  if (/\/0\b|:0\b/.test(text)) return false;
  const frac = text.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) >= 1 && Number(frac[2]) >= 2;
  const ratio = text.match(/^(\d+):(\d+)$/);
  if (ratio) return Number(ratio[1]) >= 1 && Number(ratio[2]) >= 1;
  const pct = text.match(/^(\d+(?:\.\d)?)%$/);
  if (pct) return Number(pct[1]) > 0 && Number(pct[1]) <= 400;
  const remainder = text.match(/^(\d+) 余 (\d+)$/);
  if (remainder) return Number(remainder[1]) >= 1 && Number(remainder[2]) >= 1;
  if (!/^\d+(?:\.\d)?$/.test(text)) return false;
  const v = Number(text);
  const right = Number(answerText);
  if (!Number.isFinite(v) || v <= 0) return false;
  if (!Number.isFinite(right)) return true;
  // 整数题就别混一个小数进来当选项，那种干扰项一眼就能排除
  if (Number.isInteger(right) && !Number.isInteger(v)) return false;
  // 同一个量级才算「像模像样的错」：差出十倍以上孩子一眼就排除了
  const span = loose ? LOOSE_WRONG_SPAN : 10;
  return v <= right * span + span && v * span + span >= right;
}

/** 中文叙述的题放宽到这个倍数（「只算了第一步」经常就是十几倍） */
export const LOOSE_WRONG_SPAN = 40;

/** 按题型出一道题（生成 → 校验，校验不过就换一份参数重来） */
export function makeAdvanced(rand: () => number, kind: AdvancedMathKind, t: number): MathQ {
  let last: MathQ | null = null;
  for (let guard = 0; guard < 40; guard++) {
    const q = buildFromSpec(GENERATORS[kind](rand, t), rand);
    last = q;
    if (validateQuestion(q).length === 0) return q;
  }
  return last as MathQ;
}

// ---------------------------------------------------------------------------
// 校验器：不信生成器，从题面重新算一遍
// ---------------------------------------------------------------------------

/**
 * 从题面文字独立算出答案；算不出来返回 null（说明这题孩子也没法做）。
 * 带余除法的题面两种问法长得一样（`87 ÷ 5 = ?`），到底要「商几余几」还是只要余数，
 * 得看引导语，所以这里也把 `ask` 收进来。
 */
export function solveFromPrompt(kind: AdvancedMathKind, text: string, ask = ""): string | null {
  const two = text.match(/^(\d+) ([×÷]) (\d+) = \?$/);
  if (two && (kind === "mul" || kind === "div" || kind === "divmod")) {
    const a = Number(two[1]);
    const b = Number(two[3]);
    if (two[2] === "×") return String(a * b);
    if (kind === "div") return a % b === 0 ? String(a / b) : null;
    const q = Math.floor(a / b);
    const r = a - q * b;
    return ask === REMAINDER_ASK ? String(r) : `${q} 余 ${r}`;
  }
  if (kind === "vertical") {
    const m = text.match(/^(\d+) ([+-]) (\d+) \?$/);
    if (!m) return null;
    return String(m[2] === "+" ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3]));
  }
  if (kind === "paren") {
    const m = text.match(/^(.+) = \?$/);
    if (!m) return null;
    const v = evalExpr(m[1].replace(/×/g, "*").replace(/÷/g, "/"));
    return Number.isInteger(v) ? String(v) : null;
  }
  if (kind === "frac" || kind === "fracLcd") {
    const cmp = text.match(/^(\d+)\/(\d+) ○ (\d+)\/(\d+)$/);
    if (cmp) {
      const left = Number(cmp[1]) * Number(cmp[4]);
      const right = Number(cmp[3]) * Number(cmp[2]);
      return left > right ? "＞" : left < right ? "＜" : "＝";
    }
    const simp = text.match(/^(\d+)\/(\d+) ⇒ 最简$/);
    if (simp) {
      const s = simplifyFraction(Number(simp[1]), Number(simp[2]));
      return formatFraction(s.n, s.d);
    }
    const sum = text.match(/^(\d+)\/(\d+) ([+-]) (\d+)\/(\d+) = \?$/);
    if (!sum) return null;
    const ad = Number(sum[2]);
    const bd = Number(sum[5]);
    const L = lcm(ad, bd);
    const an = Number(sum[1]) * (L / ad);
    const bn = Number(sum[4]) * (L / bd);
    const n = sum[3] === "+" ? an + bn : an - bn;
    if (n <= 0) return null;
    const s = simplifyFraction(n, L);
    return formatFraction(s.n, s.d);
  }
  if (kind === "dec" || kind === "decMul") {
    const m = text.match(/^(\d+(?:\.\d)?) ([+\-×÷]) (\d+(?:\.\d)?) = \?$/);
    if (!m) return null;
    const a = Math.round(Number(m[1]) * 10);
    const b = Math.round(Number(m[3]) * 10);
    if (m[2] === "+") return formatTenths(a + b);
    if (m[2] === "-") return a >= b ? formatTenths(a - b) : null;
    if (m[2] === "×") return formatTenths((a * b) / 10);
    return b !== 0 && (a * 10) % b === 0 ? formatTenths((a * 10) / b) : null;
  }
  if (kind === "ratio") {
    const simp = text.match(/^(\d+) : (\d+) ⇒ 最简$/);
    if (simp) {
      const g = gcd(Number(simp[1]), Number(simp[2]));
      return `${Number(simp[1]) / g}:${Number(simp[2]) / g}`;
    }
    const prop = text.match(/^(\d+) : (\d+) = (\d+) : \?$/);
    if (prop) {
      const a = Number(prop[1]);
      const b = Number(prop[2]);
      const c = Number(prop[3]);
      return a !== 0 && (b * c) % a === 0 ? String((b * c) / a) : null;
    }
    return null;
  }
  if (kind === "equation") {
    const m = text.match(/^(x|\d+) ([+\-×÷]) (x|\d+) = (\d+)$/);
    if (!m) return null;
    const right = Number(m[4]);
    const leftIsX = m[1] === "x";
    const other = Number(leftIsX ? m[3] : m[1]);
    switch (m[2]) {
      case "+":
        return String(right - other);
      case "-":
        return String(leftIsX ? right + other : other - right);
      case "×":
        return other !== 0 && right % other === 0 ? String(right / other) : null;
      default:
        return leftIsX ? String(other * right) : null;
    }
  }
  if (kind === "pattern") {
    const nums = text.replace(/⬜/g, "").split("，").map((s) => s.trim()).filter(Boolean).map(Number);
    if (nums.some((n) => !Number.isFinite(n))) return null;
    const next = patternNextValues(nums);
    return next.length === 1 ? String(next[0]) : null;
  }
  return null;
}

/**
 * 一道题的全套体检。返回空数组才算合格。
 * 除了「答案对不对」，还盯着规格里那几条硬约束：非负、整除、一位小数、分数与比最简、
 * 题面上找得到算式里的每个数、三个选项互不等值。
 */
export function validateQuestion(q: MathQ): string[] {
  const bad: string[] = [];
  const spec = q.spec;
  const text = strip(q.promptHTML);
  const answerText = String(q.answer);

  if (q.choices.length !== 3) bad.push("选项必须正好 3 个");
  if (new Set(q.choices).size !== q.choices.length) bad.push("选项有重复写法");
  if (new Set(q.choices.map(canonAnswer)).size !== q.choices.length) {
    bad.push("有两个选项数值相等，这题没有唯一答案");
  }
  if (q.choices[q.correct] !== answerText) bad.push("正确项对不上答案");
  if ((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length > 15) bad.push("引导语太长了");
  if (typeof q.answer === "number" && q.answer < 0) bad.push("答案不能是负数");
  if (/^-|\/-/.test(answerText)) bad.push("答案不能是负数");
  if (!spec) return bad.concat("这道题没有出题参数");

  // 题面上必须找得到算题要用的每个数
  for (const n of visibleNumbers(spec)) {
    if (!text.includes(String(n))) bad.push(`题面里缺少数字 ${n}`);
  }

  // 从题面独立算一遍
  const solved = solveFromPrompt(spec.kind, text, q.ask);
  if (solved !== null && canonAnswer(solved) !== canonAnswer(answerText)) {
    bad.push(`从题面算出来是 ${solved}，和答案 ${answerText} 对不上`);
  }
  if (solved === null && !CHINESE_PROMPT_KINDS.has(spec.kind)) {
    bad.push("题面解析不出来，孩子也没法照着算");
  }

  // 中文题面靠规范算式核对：这几类题必须给得出算式
  if (CHINESE_PROMPT_KINDS.has(spec.kind) && !q.expr && !(spec.kind === "ratio" && solved !== null)) {
    bad.push("中文叙述的题必须给出规范算式");
  }
  if (q.expr) {
    const v = evalExpr(q.expr);
    if (!Number.isInteger(v)) bad.push("算式算出来不是整数");
    if (v < 0) bad.push("算式算出来是负数");
    if (String(v) !== answerText.replace("%", "")) bad.push("算式与答案对不上");
  }

  bad.push(...validateSpec(spec));
  return bad;
}

/** 题面是中文叙述、没法逐字符解析的题型（靠 `expr` 与规格约束核对） */
const CHINESE_PROMPT_KINDS = new Set<AdvancedMathKind>(["word", "percent", "ratio"]);

/** 出题参数本身的硬约束（结果非负、整除、一位小数、最简……） */
export function validateSpec(spec: MathSpec): string[] {
  const bad: string[] = [];
  switch (spec.kind) {
    case "div":
      if (spec.a % spec.b !== 0) bad.push("除法必须除得尽");
      if (spec.a / spec.b < 1) bad.push("商要大于 0");
      break;
    case "divmod": {
      const r = spec.a % spec.b;
      if (r === 0) bad.push("带余除法必须真的有余数");
      if (r >= spec.b) bad.push("余数必须比除数小");
      break;
    }
    case "vertical":
      if (!spec.plus && spec.a < spec.b) bad.push("减法不能出负数");
      if (spec.plus && noCarrySum(spec.a, spec.b) === spec.a + spec.b) bad.push("这道加法根本没有进位");
      if (!spec.plus && noBorrowDiff(spec.a, spec.b) === spec.a - spec.b) bad.push("这道减法根本没有退位");
      break;
    case "paren": {
      const v = evalExpr(parenExpr(spec));
      if (!Number.isInteger(v)) bad.push("混合运算必须算得出整数");
      if (v < 0) bad.push("混合运算不能出负数");
      break;
    }
    case "frac": {
      if (spec.form === "simplify" && gcd(spec.n, spec.d) === 1) bad.push("这个分数本来就是最简，没得约");
      if (spec.form === "same") {
        const n = spec.plus ? spec.an + spec.bn : spec.an - spec.bn;
        if (n <= 0) bad.push("分数结果不能是负数或零");
        if (gcd(n, spec.d) !== 1) bad.push("分数结果没约到最简");
      }
      const answer = String(answerOf(spec));
      const m = answer.match(/^(\d+)\/(\d+)$/);
      if (m && gcd(Number(m[1]), Number(m[2])) !== 1) bad.push("分数答案没约到最简");
      break;
    }
    case "fracLcd": {
      if (spec.ad === spec.bd) bad.push("通分题的两个分母不能一样");
      const m = String(answerOf(spec)).match(/^(\d+)\/(\d+)$/);
      if (!m) bad.push("通分的结果应该写成分数");
      else if (gcd(Number(m[1]), Number(m[2])) !== 1) bad.push("分数答案没约到最简");
      break;
    }
    case "dec": {
      const r = spec.plus ? spec.a + spec.b : spec.a - spec.b;
      if (r <= 0) bad.push("小数结果不能是负数或零");
      if (spec.a % 10 === 0 || spec.b % 10 === 0) bad.push("小数题的两个数都得带小数");
      if (r % 10 === 0) bad.push("小数题的结果也得带小数");
      if (!/^\d+(\.\d)?$/.test(formatTenths(r))) bad.push("小数只保留一位");
      break;
    }
    case "decMul": {
      if (!spec.times && spec.a % spec.b !== 0) bad.push("小数除法必须除得尽（商仍是一位小数）");
      const r = spec.times ? spec.a * spec.b : spec.a / spec.b;
      if (r <= 0) bad.push("小数结果不能是负数或零");
      if (spec.a % 10 === 0) bad.push("小数题的那个数得带小数");
      if (r % 10 === 0) bad.push("小数题的结果也得带小数");
      if (!/^\d+(\.\d)?$/.test(formatTenths(r))) bad.push("小数只保留一位");
      break;
    }
    case "percent": {
      if (spec.form === "rate") {
        const v = (spec.part * 100) / spec.base;
        if (!Number.isInteger(v)) bad.push("百分率要算得出整数");
        if (spec.part >= spec.base) bad.push("部分不能比总数还大");
      } else {
        const v = (spec.base * spec.rate) / 100;
        if (!Number.isInteger(v)) bad.push("百分数的结果要算得出整数");
        if (v <= 0) bad.push("结果不能是零");
      }
      break;
    }
    case "ratio": {
      if (spec.form === "simplify") {
        if (gcd(spec.a, spec.b) === 1) bad.push("这个比本来就是最简，没得化简");
        const m = String(answerOf(spec)).match(/^(\d+):(\d+)$/);
        if (!m || gcd(Number(m[1]), Number(m[2])) !== 1) bad.push("比没化到最简整数比");
      } else if (spec.form === "share") {
        if ((spec.total % (spec.p + spec.q)) !== 0) bad.push("按比分配必须分得尽");
        if (spec.p === spec.q) bad.push("两份一样多就没有「多的那份」了");
      } else if (spec.k < 2) {
        bad.push("解比例的倍数至少是 2");
      }
      break;
    }
    case "equation": {
      const x = Number(answerOf(spec));
      if (!Number.isInteger(x)) bad.push("方程的解要是整数");
      if (x <= 0) bad.push("方程的解不能是负数或零");
      break;
    }
    case "word": {
      const v = evalExpr(wordExpr(spec));
      if (!Number.isInteger(v)) bad.push("应用题必须算得出整数");
      if (v <= 0) bad.push("应用题的结果不能是负数或零");
      break;
    }
    case "pattern": {
      if (spec.terms.length < 4) bad.push("找规律至少要给四项");
      if (spec.terms.some((n) => n < 0)) bad.push("数列不能出现负数");
      if (patternNextValues(spec.terms).length !== 1) bad.push("这串数不止一种规律，没有唯一答案");
      break;
    }
    default:
      break;
  }
  return bad;
}
