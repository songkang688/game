/**
 * 算数小农场 1.2 的验收用例。
 *
 * 分七段：难度曲线 / 生成器与校验器 / 干扰项 / 两级提示 / 错题本 / 跑起来 / 外壳文案。
 * 最要紧的一条在第二段：随机生成 5000 道题，每一道都要过校验器，且三个选项互不等值。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mulberry32, type PlayCtx } from "../level99";
import { speechText } from "../speech";
import type { QuizOptions } from "../quiz99";
import {
  answerOf,
  buildFromSpec,
  canonAnswer,
  evalExpr,
  exprOf,
  FARM_CROPS,
  GENERATORS,
  LOOSE_WRONG_SPAN,
  noCarryProduct,
  noCarrySum,
  patternNextValues,
  renderSpec,
  strip,
  validateQuestion,
  validateSpec,
  visibleNumbers,
  wrongsOf,
  type MathQ,
  type MathSpec,
} from "./gen";
import guide from "./guide";
import {
  HINT_PREFIX,
  LEGACY_METHOD_HINTS,
  METHOD_HINTS,
  STEP_HINTS,
  STEP_PREFIX,
  hasDigits,
  methodHint,
  stepHint,
} from "./hints";
import {
  CORE_MATH_TYPES,
  DIFFICULTY_TABLE,
  KINDS_BY_TYPE,
  KIND_TYPE,
  MATH_TYPES,
  MATH_TYPE_NAMES,
  SENIOR_FROM,
  TABLE_DRIVEN_FROM,
  allocateSlots,
  bandOf,
  hardnessOf,
  tableKinds,
  typeOfKind,
  type AdvancedMathKind,
  type MathType,
} from "./kinds";
import { buildQuestions, makeReviewQuestions, questionCount, typesOfKinds } from "./levels";
import { gcd } from "./logic";
import { meta } from "./meta";
import {
  MISTAKES_KEY,
  clearMistakes,
  loadMistakes,
  migrateMistakes,
  practiceLine,
  recordMistakes,
  topMistakeTypes,
  type StorageLike,
} from "./mistakes";
import {
  CHEER_MS,
  HINT_AFTER_WRONG,
  MIN_VERT_PX,
  MTF_CSS,
  REVIEW_DONE,
  REVIEW_NOTE,
  STEP_AFTER_WRONG,
  attachFarmHelper,
  playFarmLevel,
} from "./runner";
import {
  StubEl,
  clickOn,
  findAll,
  findOne,
  installDom,
  installMutationObserver,
  installSpeech,
  liveObservers,
  removeSpeech,
  totalListeners,
} from "./domStub";

const NEW_LEVELS = Array.from({ length: 89 }, (_, i) => 99 + i);
const KIND_LIST = Object.keys(GENERATORS) as AdvancedMathKind[];

/** 全部 89 个新关卡的题（只算一次，后面几条用例共用） */
const ALL_NEW_QUESTIONS: MathQ[] = NEW_LEVELS.flatMap((level) => buildQuestions(level));

function memStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

// ---------------------------------------------------------------------------
// 一、难度曲线与题型分类
// ---------------------------------------------------------------------------

describe("算数小农场 1.2 · 难度曲线", () => {
  it("六年级那九类题型全部登记在案，每个种类都归得了类", () => {
    for (const type of CORE_MATH_TYPES) {
      expect(MATH_TYPES).toContain(type);
      expect(MATH_TYPE_NAMES[type].length).toBeGreaterThan(1);
      expect(KINDS_BY_TYPE[type].length).toBeGreaterThan(0);
    }
    // 规格点名的九类：混合 / 竖式 / 分数 / 小数 / 百分数 / 比 / 方程 / 应用题 / 找规律
    expect(CORE_MATH_TYPES).toHaveLength(9);
    for (const kind of KIND_LIST) {
      expect(KIND_TYPE[kind], `${kind} 没归类`).toBeDefined();
      expect(KINDS_BY_TYPE[typeOfKind(kind)]).toContain(kind);
    }
  });

  it("难度表连续铺满 100–188 关，每段权重加起来正好是 1", () => {
    expect(DIFFICULTY_TABLE[0].from).toBe(TABLE_DRIVEN_FROM);
    expect(DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1].to).toBe(188);
    DIFFICULTY_TABLE.forEach((band, i) => {
      const sum = Object.values(band.weights).reduce((a, b) => a + b, 0);
      expect(sum, `${band.title} 的权重和`).toBeCloseTo(1, 6);
      expect(band.to).toBeGreaterThanOrEqual(band.from);
      if (i > 0) expect(band.from).toBe(DIFFICULTY_TABLE[i - 1].to + 1);
      // 「基础口算」是前 99 关的归口，不许挤进后面的曲线
      expect(band.weights.basic ?? 0).toBe(0);
    });
    for (let level1 = TABLE_DRIVEN_FROM; level1 <= 188; level1++) {
      const band = bandOf(level1);
      expect(level1).toBeGreaterThanOrEqual(band.from);
      expect(level1).toBeLessThanOrEqual(band.to);
    }
  });

  it("题位按权重分配：总数守恒，相邻关轮换让小题型也排得上", () => {
    const band = DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1];
    for (let count = 6; count <= 10; count++) {
      for (let rotate = 0; rotate < 5; rotate++) {
        const alloc = allocateSlots(band, count, rotate);
        expect(alloc.reduce((s, x) => s + x.slots, 0), `${count} 题位`).toBe(count);
        expect(alloc.every((x) => x.slots > 0)).toBe(true);
      }
    }
    // 末章十种题型、一关只有十个题位：靠轮换，一章之内每一类都轮得到
    const seen = new Set<MathType>();
    for (let level = 177; level < 188; level++) {
      for (const kind of tableKinds(level, questionCount(level))) seen.add(typeOfKind(kind));
    }
    expect(seen.size).toBeGreaterThanOrEqual(9);
  });

  it("数字规模按关号上升：档位从第 100 关的 0 一路走到第 188 关的 1", () => {
    expect(hardnessOf(99)).toBe(0);
    expect(hardnessOf(187)).toBe(1);
    for (let level = 99; level < 187; level++) {
      expect(hardnessOf(level + 1)).toBeGreaterThan(hardnessOf(level));
    }
    // 生成器也得跟着涨：同一个题型，高档位的数字明显比低档位大
    const meanSize = (kind: AdvancedMathKind, t: number): number => {
      const rand = mulberry32(515 + Math.round(t * 100));
      let sum = 0;
      for (let i = 0; i < 200; i++) {
        const nums = visibleNumbers(GENERATORS[kind](rand, t));
        sum += Math.max(...nums, 0);
      }
      return sum / 200;
    };
    for (const kind of ["mul", "div", "paren", "equation", "percent"] as const) {
      expect(meanSize(kind, 0.95), `${kind} 的数字没随关号变大`).toBeGreaterThan(meanSize(kind, 0.05));
    }
    // 找规律靠的不是大数字，而是更难的规律：高档位才会出「差在变大」和「前两项相加」
    const rules = (t: number): Set<string> => {
      const rand = mulberry32(4649);
      const out = new Set<string>();
      for (let i = 0; i < 200; i++) {
        const spec = GENERATORS.pattern(rand, t) as Extract<MathSpec, { kind: "pattern" }>;
        out.add(spec.rule);
      }
      return out;
    };
    expect(rules(0.05).size).toBeLessThan(rules(0.95).size);
  });

  it("九类题型在 100–188 关真的都出过题，高段还在练方程与比例", () => {
    const types = new Set(ALL_NEW_QUESTIONS.map((q) => typeOfKind(q.kind)));
    for (const type of CORE_MATH_TYPES) {
      expect(types.has(type), `${MATH_TYPE_NAMES[type]} 一道都没排上`).toBe(true);
    }
    const senior = new Set<MathType>();
    for (let level = SENIOR_FROM - 1; level < 188; level++) {
      for (const q of buildQuestions(level)) senior.add(typeOfKind(q.kind));
    }
    expect(senior.has("equation")).toBe(true);
    expect(senior.has("ratio")).toBe(true);
    expect(senior.has("percent")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 二、生成器与校验器
// ---------------------------------------------------------------------------

describe("算数小农场 1.2 · 生成器与校验器", () => {
  it("随机生成 5000 题：全部合法、答案唯一、没有一道要靠重试兜底", () => {
    const per = Math.ceil(5000 / KIND_LIST.length);
    let made = 0;
    for (const [ki, kind] of KIND_LIST.entries()) {
      const rand = mulberry32(20250824 + ki * 7919);
      for (let i = 0; i < per; i++) {
        const t = (i % 100) / 99;
        const spec = GENERATORS[kind](rand, t);
        const q = buildFromSpec(spec, rand);
        const problems = validateQuestion(q);
        expect(problems.join("；"), `${kind} 第 ${i} 题：${strip(q.promptHTML)}`).toBe("");
        expect(new Set(q.choices.map(canonAnswer)).size, `${kind} 第 ${i} 题选项撞车`).toBe(3);
        made++;
      }
    }
    expect(made).toBeGreaterThanOrEqual(5000);
  });

  it("除法一律除得尽，带余除法的余数一定比除数小且大于零", () => {
    const rand = mulberry32(4242);
    for (let i = 0; i < 400; i++) {
      const t = (i % 100) / 99;
      const div = GENERATORS.div(rand, t) as Extract<MathSpec, { kind: "div" }>;
      expect(div.a % div.b).toBe(0);
      expect(div.a / div.b).toBeGreaterThan(0);
      const dm = GENERATORS.divmod(rand, t) as Extract<MathSpec, { kind: "divmod" }>;
      const r = dm.a % dm.b;
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(dm.b);
      const dec = GENERATORS.decMul(rand, t) as Extract<MathSpec, { kind: "decMul" }>;
      if (!dec.times) expect(dec.a % dec.b).toBe(0);
    }
  });

  it("竖式题必须真的进位或退位，而且不出负数", () => {
    const rand = mulberry32(777);
    let carry = 0;
    let borrow = 0;
    for (let i = 0; i < 400; i++) {
      const spec = GENERATORS.vertical(rand, (i % 100) / 99) as Extract<MathSpec, { kind: "vertical" }>;
      expect(validateSpec(spec)).toEqual([]);
      if (spec.plus) {
        carry++;
        expect(noCarrySum(spec.a, spec.b)).not.toBe(spec.a + spec.b);
      } else {
        borrow++;
        expect(spec.a).toBeGreaterThan(spec.b);
      }
      expect(Number(answerOf(spec))).toBeGreaterThan(0);
    }
    expect(carry).toBeGreaterThan(50);
    expect(borrow).toBeGreaterThan(50);
  });

  it("分数结果最简、通分题两个分母不同、比化到最简整数比", () => {
    const rand = mulberry32(31415);
    for (let i = 0; i < 400; i++) {
      const t = (i % 100) / 99;
      for (const kind of ["frac", "fracLcd", "ratio"] as const) {
        const spec = GENERATORS[kind](rand, t);
        expect(validateSpec(spec), kind).toEqual([]);
        const answer = String(answerOf(spec));
        const frac = answer.match(/^(\d+)\/(\d+)$/);
        if (frac) expect(gcd(Number(frac[1]), Number(frac[2])), `${answer} 没约到最简`).toBe(1);
        const ratio = answer.match(/^(\d+):(\d+)$/);
        if (ratio) expect(gcd(Number(ratio[1]), Number(ratio[2])), `${answer} 不是最简整数比`).toBe(1);
        if (spec.kind === "fracLcd") expect(spec.ad).not.toBe(spec.bd);
      }
    }
  });

  it("小数只保留一位，没有 0.30000000000000004 这种浮点尾巴", () => {
    const rand = mulberry32(2718);
    for (let i = 0; i < 400; i++) {
      const t = (i % 100) / 99;
      for (const kind of ["dec", "decMul"] as const) {
        const q = buildFromSpec(GENERATORS[kind](rand, t), rand);
        expect(String(q.answer)).toMatch(/^\d+(\.\d)?$/);
        for (const c of q.choices) expect(c, `${kind} 的选项 ${c}`).toMatch(/^\d+(\.\d)?$/);
      }
    }
  });

  it("百分数与折扣：结果是整数，打折算的是「按原价的几成付」", () => {
    const rand = mulberry32(9001);
    let discounts = 0;
    for (let i = 0; i < 400; i++) {
      const spec = GENERATORS.percent(rand, (i % 100) / 99) as Extract<MathSpec, { kind: "percent" }>;
      expect(validateSpec(spec)).toEqual([]);
      if (spec.form !== "discount") continue;
      discounts++;
      // 打八折要付原价的 80%，不是只付掉的那 20%
      expect(answerOf(spec)).toBe((spec.base * spec.rate) / 100);
      expect(Number(answerOf(spec))).toBeLessThan(spec.base);
      expect(strip(renderSpec(spec).promptHTML)).toMatch(/打[一二三四五六七八九](五)?折/);
    }
    expect(discounts).toBeGreaterThan(30);
  });

  it("简单方程的解永远是正整数，题面只出现 x 一个字母", () => {
    const rand = mulberry32(5150);
    for (let i = 0; i < 400; i++) {
      const spec = GENERATORS.equation(rand, (i % 100) / 99);
      expect(validateSpec(spec)).toEqual([]);
      const x = Number(answerOf(spec));
      expect(Number.isInteger(x)).toBe(true);
      expect(x).toBeGreaterThan(0);
      const text = strip(renderSpec(spec).promptHTML);
      expect(text.match(/[A-Za-z]/g)).toEqual(["x"]);
    }
  });

  it("应用题是农场语境的两步题，行程 / 单价 / 面积都出得来", () => {
    const rand = mulberry32(606);
    const forms = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const spec = GENERATORS.word(rand, (i % 100) / 99) as Extract<MathSpec, { kind: "word" }>;
      forms.add(spec.form);
      const expr = exprOf(spec) as string;
      const v = evalExpr(expr);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
      expect((expr.match(/[+\-*/]/g) ?? []).length, `${expr} 不像两步题`).toBeGreaterThanOrEqual(2);
      const text = strip(renderSpec(spec).promptHTML);
      // 算式里的每个数都要在题面上找得到，孩子才有下手的地方
      for (const n of expr.match(/\d+/g) ?? []) expect(text).toContain(n);
      expect(text).toMatch(/南瓜|玉米|草莓|小番茄|鸡蛋|萝卜|苹果|土豆|果园|农场/);
      // 论排种、论亩收的只挑地里长出来的（鸡蛋不长在地里）
      if (spec.form === "rows" || spec.form === "area") {
        expect(FARM_CROPS.some((c) => text.includes(c))).toBe(true);
        expect(text).not.toContain("鸡蛋");
      }
    }
    for (const need of ["trip", "price", "area"]) expect(forms.has(need), `${need} 没出过`).toBe(true);
  });

  it("找规律只有一种说得通的下一项", () => {
    const rand = mulberry32(1123);
    for (let i = 0; i < 400; i++) {
      const spec = GENERATORS.pattern(rand, (i % 100) / 99) as Extract<MathSpec, { kind: "pattern" }>;
      expect(patternNextValues(spec.terms)).toHaveLength(1);
      expect(spec.terms.every((n) => n > 0)).toBe(true);
      expect(Number(answerOf(spec))).toBe(patternNextValues(spec.terms)[0]);
    }
  });

  it("校验器不是摆设：手搓的坏题一道一道都被拦下来", () => {
    const cases: Array<[MathSpec, RegExp]> = [
      [{ kind: "div", a: 7, b: 2 }, /除得尽/],
      [{ kind: "divmod", a: 8, b: 4, askRemainder: true }, /真的有余数/],
      [{ kind: "vertical", plus: false, a: 12, b: 30 }, /负数/],
      [{ kind: "vertical", plus: true, a: 11, b: 22 }, /没有进位/],
      [{ kind: "frac", form: "same", an: 2, bn: 4, d: 6, plus: false }, /负数或零/],
      [{ kind: "frac", form: "same", an: 1, bn: 1, d: 4, plus: true }, /最简/],
      [{ kind: "fracLcd", an: 1, ad: 5, bn: 1, bd: 5, plus: true }, /分母不能一样/],
      [{ kind: "decMul", times: false, a: 25, b: 4 }, /除得尽/],
      [{ kind: "percent", form: "rate", part: 3, base: 7, item: 0 }, /整数/],
      [{ kind: "ratio", form: "simplify", a: 3, b: 5 }, /本来就是最简/],
      [{ kind: "ratio", form: "share", total: 10, p: 1, q: 2, item: 0 }, /分得尽/],
      [{ kind: "equation", form: "xSub", a: 3, b: 9 }, /负数或零/],
      [{ kind: "word", form: "rows", n1: 2, n2: 2, n3: 9, item: 0, bag: 0 }, /负数或零/],
      [{ kind: "pattern", rule: "arith", terms: [1, 2, 3] }, /至少要给四项/],
    ];
    for (const [spec, hit] of cases) {
      const bad = validateSpec(spec).join("；");
      expect(bad, `${spec.kind} 这道坏题没被拦住`).toMatch(hit);
    }
    // 选项撞车（两个写法数值相等）也算没有唯一答案
    const clash: MathQ = {
      kind: "frac",
      answer: "1/2",
      promptHTML: "3/6 ⇒ 最简",
      ask: "约成最简分数是多少？",
      choices: ["1/2", "2/4", "3/5"],
      correct: 0,
      spec: { kind: "frac", form: "simplify", n: 3, d: 6 },
    };
    expect(validateQuestion(clash).join("；")).toMatch(/唯一答案/);
  });

  it("同一份出题参数永远得到同一道题（生成器是纯函数）", () => {
    for (const kind of KIND_LIST) {
      const a = buildFromSpec(GENERATORS[kind](mulberry32(88), 0.5), mulberry32(99));
      const b = buildFromSpec(GENERATORS[kind](mulberry32(88), 0.5), mulberry32(99));
      expect(JSON.stringify(a), kind).toBe(JSON.stringify(b));
    }
  });
});

// ---------------------------------------------------------------------------
// 三、干扰项
// ---------------------------------------------------------------------------

describe("算数小农场 1.2 · 干扰项来自典型错误", () => {
  it("每个干扰项都能在「典型错误表」里对上号，并且说得出错在哪一步", () => {
    for (const q of ALL_NEW_QUESTIONS) {
      const spec = q.spec as MathSpec;
      const errors = wrongsOf(spec);
      const bank = new Set(errors.map((w) => w.text));
      const answerText = String(q.answer);
      for (const c of q.choices) {
        if (c === answerText) continue;
        expect(bank.has(c), `${strip(q.promptHTML)} 的选项 ${c} 不在典型错误表里`).toBe(true);
      }
      expect(q.traps).toHaveLength(2);
      for (const why of q.traps ?? []) {
        expect(why.length, `${q.kind} 的干扰项没说清错在哪`).toBeGreaterThanOrEqual(4);
        expect(hasDigits(why), `错因里不该写死数字：${why}`).toBe(false);
      }
    }
  });

  it("干扰项像模像样：非负、同一种写法、和正解同一个量级", () => {
    for (const q of ALL_NEW_QUESTIONS) {
      const answerText = String(q.answer);
      const symbolic = ["＞", "＜", "＝"].includes(answerText);
      for (const c of q.choices) {
        expect(c).not.toMatch(/-/);
        expect(canonAnswer(c) === canonAnswer(answerText)).toBe(c === answerText);
        if (symbolic) {
          expect(["＞", "＜", "＝"]).toContain(c);
          continue;
        }
        // 写法要跟正解一路：分数配分数、比配比、商余配商余
        expect(/^\d+\/\d+$/.test(c)).toBe(/^\d+\/\d+$/.test(answerText));
        expect(/^\d+:\d+$/.test(c)).toBe(/^\d+:\d+$/.test(answerText));
        expect(/余/.test(c)).toBe(/余/.test(answerText));
        expect(/%$/.test(c)).toBe(/%$/.test(answerText));
        if (!/^\d+(\.\d)?$/.test(answerText)) continue;
        const v = Number(c);
        const right = Number(answerText);
        // 中文叙述的题放宽量级：「只算了第一步」本来就可能是正解的十几倍
        const span = ["word", "percent", "ratio"].includes(q.kind) ? LOOSE_WRONG_SPAN : 10;
        expect(v).toBeGreaterThan(0);
        expect(v, `${strip(q.promptHTML)} 的 ${c} 离谱了`).toBeLessThanOrEqual(right * span + span);
        expect(v * span + span).toBeGreaterThanOrEqual(right);
        // 整数题不许混一个小数选项进来，那种干扰项一眼就能排除
        if (Number.isInteger(right)) expect(Number.isInteger(v), `${c} 不该是小数`).toBe(true);
      }
    }
  });

  it("最常见的那几种错法都造得出来：忘进位、忽略括号、分母也相加、打折反着算", () => {
    const has = (spec: MathSpec, text: string, why: RegExp): void => {
      const hit = wrongsOf(spec).find((w) => w.text === text);
      expect(hit, `${spec.kind} 没造出干扰项 ${text}`).toBeDefined();
      expect(hit!.why).toMatch(why);
    };
    // 47 + 38：忘了进位就写成 715（个位 5、十位 7）
    has({ kind: "vertical", plus: true, a: 47, b: 38 }, String(noCarrySum(47, 38)), /进位/);
    // 62 - 38：不够减就大减小，写成 36
    has({ kind: "vertical", plus: false, a: 62, b: 38 }, "36", /退位|借/);
    // 24 × 3：每一位各乘各的，进位全丢
    has({ kind: "mul", a: 24, b: 3 }, String(noCarryProduct(24, 3)), /进位/);
    // (5 + 3) × 4：忽略括号先算乘法就是 17
    has({ kind: "paren", form: 0, a: 5, b: 3, c: 4, d: 2 }, "17", /括号/);
    // 1/5 + 2/5：分母也跟着加，写成 3/10
    has({ kind: "frac", form: "same", an: 1, bn: 2, d: 5, plus: true }, "3/10", /分母/);
    // 100 元打八折：算成只付掉的那 20 元
    has({ kind: "percent", form: "discount", base: 100, rate: 80, item: 0 }, "20", /打折/);
    // 12 : 18 化简：前项后项写反了就成了 3:2
    has({ kind: "ratio", form: "simplify", a: 12, b: 18 }, "3:2", /写反/);
    // x + 7 = 20：逆运算用反了，加成 27
    has({ kind: "equation", form: "addX", a: 7, b: 20 }, "27", /逆运算/);
    // 2, 4, 8, 16, 32：把等比看成等差
    has({ kind: "pattern", rule: "geo", terms: [2, 4, 8, 16, 32] }, "48", /等差/);
    // 长 8 宽 5 已种 12：面积算成周长
    has({ kind: "word", form: "area", n1: 8, n2: 5, n3: 12, item: 0, bag: 0 }, "14", /周长/);
  });
});

// ---------------------------------------------------------------------------
// 四、两级提示
// ---------------------------------------------------------------------------

describe("算数小农场 1.2 · 连错给方法不给答案", () => {
  it("两级提示一个数字都不带，更不会把哪一关的得数说出来", () => {
    const lines = [
      ...Object.values(METHOD_HINTS),
      ...Object.values(LEGACY_METHOD_HINTS),
      ...Object.values(STEP_HINTS),
      ...KIND_LIST.map((k) => methodHint(k)),
      ...KIND_LIST.map((k) => stepHint(k)),
    ];
    for (const line of lines) {
      expect(hasDigits(line), `提示里出现了数字：${line}`).toBe(false);
      expect(line).not.toMatch(/答案是|选第|就是它/);
      expect(line.length).toBeGreaterThan(8);
    }
    // 拿 188 关的真答案去扫一遍，一个都不许被提前说出来
    const answers = new Set(ALL_NEW_QUESTIONS.map((q) => String(q.answer)).filter((a) => /\d/.test(a)));
    for (const line of lines) {
      for (const a of answers) expect(line.includes(a), `${line} 里漏了答案 ${a}`).toBe(false);
    }
  });

  it("每个题型都有自己的方法提示与拆一步，两级不重样", () => {
    for (const kind of KIND_LIST) {
      const m = methodHint(kind);
      const s = stepHint(kind);
      expect(m.startsWith(HINT_PREFIX), kind).toBe(true);
      expect(s.startsWith(STEP_PREFIX), kind).toBe(true);
      expect(m).not.toBe(s);
      // 拆一步真的拆成了两小步
      expect(s).toContain("第一步");
      expect(s).toContain("第二步");
    }
    // 老题型（前 99 关）也照顾到了
    for (const kind of ["count", "add", "sub", "missing", "compare", "chain"] as const) {
      expect(methodHint(kind).startsWith(HINT_PREFIX)).toBe(true);
      expect(stepHint(kind)).toContain("第二步");
    }
    expect(new Set(KIND_LIST.map((k) => stepHint(k))).size).toBe(KIND_LIST.length);
  });

  it("应用题的拆一步拆到中间量上：行程说速度乘时间，单价说先算花掉多少", () => {
    const trip = stepHint("word", { kind: "word", form: "trip", n1: 60, n2: 8, n3: 40, item: 0, bag: 0 });
    const price = stepHint("word", { kind: "word", form: "price", n1: 6, n2: 4, n3: 30, item: 0, bag: 0 });
    const area = stepHint("word", { kind: "word", form: "area", n1: 9, n2: 6, n3: 20, item: 0, bag: 0 });
    expect(trip).toContain("时间");
    expect(price).toContain("单价");
    expect(area).toContain("长乘宽");
    expect(new Set([trip, price, area]).size).toBe(3);
    for (const line of [trip, price, area]) expect(hasDigits(line)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 五、错题本
// ---------------------------------------------------------------------------

describe("算数小农场 1.2 · 错题本", () => {
  it("存档 key 走 yiduo-yixing. 前缀，记的是题型不是题目", () => {
    expect(MISTAKES_KEY.startsWith("yiduo-yixing.")).toBe(true);
    const store = memStorage();
    recordMistakes(["fraction", "fraction", "equation"], store);
    expect([...store.map.keys()]).toEqual([MISTAKES_KEY]);
    const saved = JSON.parse(store.map.get(MISTAKES_KEY) as string) as Record<string, number>;
    expect(saved).toEqual({ fraction: 2, equation: 1 });
    // 存下来的只有题型名和次数，没有任何一道题的题面
    expect(store.map.get(MISTAKES_KEY)).not.toMatch(/[\u4e00-\u9fff]/);
    expect(loadMistakes(store)).toEqual({ fraction: 2, equation: 1 });
  });

  it("存档坏了也能照常开局，清空之后归零", () => {
    const store = memStorage();
    store.setItem(MISTAKES_KEY, "{不是 JSON");
    expect(loadMistakes(store)).toEqual({});
    expect(migrateMistakes({ fraction: -3, ratio: "多", equation: 2.4, 不存在的类: 9 })).toEqual({ equation: 2 });
    expect(migrateMistakes(null)).toEqual({});
    recordMistakes(["ratio"], store);
    clearMistakes(store);
    expect(loadMistakes(store)).toEqual({});
    // 没有 localStorage 的环境（隐私模式）也不许炸
    expect(() => recordMistakes(["word"], null)).not.toThrow();
  });

  it("错得最多的排在前面，「练一练」只说练什么、不说孩子笨", () => {
    const stats = { decimal: 1, percent: 5, word: 3 } as const;
    expect(topMistakeTypes(stats, 2)).toEqual(["percent", "word"]);
    expect(topMistakeTypes({}, 3)).toEqual([]);
    const line = practiceLine(topMistakeTypes(stats, 2));
    expect(line).toContain(MATH_TYPE_NAMES.percent);
    expect(line).not.toMatch(/错|笨|差|不行|又|才/);
    expect(practiceLine([]).length).toBeGreaterThan(6);
    // 关末回顾按题型换一批新题，题面不和正题重样
    const level = 170;
    const main = buildQuestions(level);
    const review = makeReviewQuestions(
      main.slice(0, 3).map((q) => q.kind),
      level,
      0,
      main.map((q) => q.promptHTML)
    );
    expect(review.length).toBeGreaterThan(0);
    for (const q of review) {
      expect(validateQuestion(q).join("；")).toBe("");
      expect(main.some((m) => m.promptHTML === q.promptHTML)).toBe(false);
    }
    expect(typesOfKinds(main.map((q) => q.kind)).every((t) => MATH_TYPES.includes(t))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 六、跑起来
// ---------------------------------------------------------------------------

describe("算数小农场 1.2 · 一关跑起来", () => {
  let restoreDom = installDom();
  let restoreObserver = installMutationObserver();

  beforeEach(() => {
    restoreDom = installDom();
    restoreObserver = installMutationObserver();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreObserver();
    restoreDom();
  });

  interface Round {
    stage: StubEl;
    opts: QuizOptions;
    destroys: number;
    paint: (index: number) => void;
  }

  interface Harness {
    stage: StubEl;
    rounds: Round[];
    wins: Array<{ stars: number; msg?: string }>;
    loses: string[];
    handle: { destroy?: () => void };
    store: ReturnType<typeof memStorage>;
  }

  /** 照着 `quiz99` 渲染出来的骨架搭一份替身：辅助层只认这几个类名 */
  function paintRound(stage: StubEl, opts: QuizOptions): (index: number) => void {
    const wrap = new StubEl("div");
    wrap.className = "qz-wrap";
    const prompt = new StubEl("div");
    prompt.className = "qz-prompt";
    const choices = new StubEl("div");
    choices.className = "qz-choices";
    const msg = new StubEl("div");
    msg.className = "qz-msg";
    wrap.appendChild(prompt);
    wrap.appendChild(choices);
    wrap.appendChild(msg);
    stage.appendChild(wrap);
    return (index: number) => {
      const q = opts.questions[index];
      while (prompt.children.length) prompt.children[0].remove();
      const line = new StubEl("span");
      line.textContent = q.promptHTML;
      prompt.appendChild(line);
      while (choices.children.length) choices.children[0].remove();
      for (const c of q.choices) {
        const btn = new StubEl("button");
        btn.className = "qz-choice";
        btn.textContent = c;
        choices.appendChild(btn);
      }
      msg.textContent = "";
    };
  }

  function run(level = 170): Harness {
    const stage = new StubEl("div");
    const h: Harness = { stage, rounds: [], wins: [], loses: [], handle: {}, store: memStorage() };
    const ctx: PlayCtx = {
      level,
      chapter: { name: "括号谷仓", emoji: "🧺", color: "#e3f0ff", desc: "", size: 22 },
      chapterIndex: 9,
      indexInChapter: 3,
      win: (stars, msg) => void h.wins.push({ stars, msg }),
      lose: (msg) => void h.loses.push(msg ?? ""),
      sfx: () => {},
      bonusStars: () => {},
    };
    h.handle = playFarmLevel(stage as unknown as HTMLElement, ctx, {
      storage: h.store,
      runner: (opts) => {
        const round: Round = { stage, opts, destroys: 0, paint: paintRound(stage, opts) };
        round.paint(0);
        h.rounds.push(round);
        return { destroy: () => void round.destroys++ };
      },
    });
    return h;
  }

  function buttons(stage: StubEl): StubEl[] {
    return findAll(stage, "qz-choice");
  }

  it("连错 2 次换成方法提示，再错一次换成拆一步，展示与朗读同一句", () => {
    const speech = installSpeech();
    try {
      const h = run();
      const q = h.rounds[0].opts.questions[0] as MathQ;
      const wrongBtns = buttons(h.stage).filter((_, i) => i !== q.correct);
      const msg = findOne(h.stage, "qz-msg") as StubEl;

      clickOn(h.stage, wrongBtns[0]);
      vi.advanceTimersByTime(5);
      // 第一次错：壳自己那句鼓励留着，本款不插嘴
      expect(msg.classList.contains("mtf-hint")).toBe(false);

      clickOn(h.stage, wrongBtns[1]);
      vi.advanceTimersByTime(5);
      expect(msg.textContent).toBe(methodHint(q.kind));
      expect(msg.classList.contains("mtf-hint")).toBe(true);
      expect(speech.spoken.at(-1)).toBe(speechText(methodHint(q.kind)));
      expect(hasDigits(msg.textContent)).toBe(false);

      clickOn(h.stage, wrongBtns[0]);
      vi.advanceTimersByTime(5);
      expect(msg.textContent).toBe(stepHint(q.kind, q.spec));
      expect(msg.classList.contains("mtf-step")).toBe(true);
      expect(msg.classList.contains("mtf-hint")).toBe(false);
      expect(speech.spoken.at(-1)).toBe(speechText(stepHint(q.kind, q.spec)));
      expect(HINT_AFTER_WRONG).toBeLessThan(STEP_AFTER_WRONG);
    } finally {
      speech.restore();
    }
  });

  it("答对冒出一只欢呼的小动物，答错什么都不加（绝不打红叉）", () => {
    const h = run();
    const q = h.rounds[0].opts.questions[0] as MathQ;
    const btns = buttons(h.stage);

    clickOn(h.stage, btns[(q.correct + 1) % 3]);
    vi.advanceTimersByTime(5);
    expect(findAll(h.stage, "mtf-cheer")).toHaveLength(0);
    expect(h.stage.children.map((c) => c.className).join(" ")).not.toMatch(/cross|red|✗/);

    clickOn(h.stage, btns[q.correct]);
    const cheer = findOne(h.stage, "mtf-cheer") as StubEl;
    expect(cheer).not.toBeNull();
    expect(cheer.textContent).toMatch(/🎉$/);
    expect(cheer.getAttribute("aria-hidden")).toBe("true");
    // 几百毫秒后自己收走，不会在屏幕上堆着
    vi.advanceTimersByTime(CHEER_MS + 20);
    expect(findAll(h.stage, "mtf-cheer")).toHaveLength(0);
  });

  it("换题之后错误次数重新数，不会把上一题的账算到这一题头上", () => {
    const h = run();
    const round = h.rounds[0];
    const msg = findOne(h.stage, "qz-msg") as StubEl;
    const q0 = round.opts.questions[0] as MathQ;
    for (const btn of buttons(h.stage).filter((_, i) => i !== q0.correct)) clickOn(h.stage, btn);
    vi.advanceTimersByTime(5);
    expect(msg.classList.contains("mtf-hint")).toBe(true);

    // 壳换题：题面一变，MutationObserver 就通知辅助层翻页
    round.paint(1);
    expect(msg.classList.contains("mtf-hint")).toBe(false);
    const q1 = round.opts.questions[1] as MathQ;
    clickOn(h.stage, buttons(h.stage).filter((_, i) => i !== q1.correct)[0]);
    vi.advanceTimersByTime(5);
    expect(findOne(h.stage, "qz-msg")?.textContent).toBe("");
  });

  it("关末按错过的题型加练一轮，回顾轮做完才把星级报上去", () => {
    const h = run();
    const q = h.rounds[0].opts.questions[0] as MathQ;
    clickOn(h.stage, buttons(h.stage).filter((_, i) => i !== q.correct)[0]);

    h.rounds[0].opts.ctx.win(2, "都做完啦！");
    expect(h.wins, "回顾轮还没做完就不许结算").toHaveLength(0);
    expect(h.rounds).toHaveLength(2);
    expect(h.rounds[0].destroys).toBe(1);

    const banner = findOne(h.stage, "mtf-review") as StubEl;
    expect(banner.textContent).toContain(REVIEW_NOTE);
    expect(banner.textContent).toContain(MATH_TYPE_NAMES[typeOfKind(q.kind)]);
    // 加练的是同类新题，容错放到远超题量：回顾轮只复习，不判失败
    const review = h.rounds[1];
    expect(review.opts.questions.length).toBeGreaterThan(0);
    expect(review.opts.questions.every((r) => (r as MathQ).kind === q.kind)).toBe(true);
    expect(review.opts.maxWrong as number).toBeGreaterThan(review.opts.questions.length);
    expect(loadMistakes(h.store)[typeOfKind(q.kind)]).toBe(1);

    review.opts.ctx.win(3, "回顾轮的分数不算数");
    expect(h.wins).toEqual([{ stars: 2, msg: `都做完啦！ ${REVIEW_DONE}` }]);
    // 回顾轮失败也只是收工，星级仍按正题那一轮算
    expect(h.loses).toHaveLength(0);
  });

  it("一道没错就直接结算，不用陪着再做一轮", () => {
    const h = run(120);
    h.rounds[0].opts.ctx.win(3, "全部一次答对，太了不起啦！");
    expect(h.rounds).toHaveLength(1);
    expect(h.wins).toEqual([{ stars: 3, msg: "全部一次答对，太了不起啦！" }]);
    expect(loadMistakes(h.store)).toEqual({});
  });

  it("没有中文语音包时照样出提示、翻得动页，一声不吭也不报错", () => {
    const restore = removeSpeech();
    try {
      const h = run();
      const q = h.rounds[0].opts.questions[0] as MathQ;
      const wrongBtns = buttons(h.stage).filter((_, i) => i !== q.correct);
      expect(() => {
        clickOn(h.stage, wrongBtns[0]);
        clickOn(h.stage, wrongBtns[1]);
        vi.advanceTimersByTime(5);
      }).not.toThrow();
      expect(findOne(h.stage, "qz-msg")?.textContent).toBe(methodHint(q.kind));
    } finally {
      restore();
    }
  });

  it("destroy 之后监听、定时器、观察者、节点一个都不剩，再调一次也不炸", () => {
    const h = run();
    const q = h.rounds[0].opts.questions[0] as MathQ;
    clickOn(h.stage, buttons(h.stage)[q.correct]);
    expect(totalListeners(h.stage)).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    expect(liveObservers()).toBeGreaterThan(0);

    h.handle.destroy?.();
    expect(totalListeners(h.stage)).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(liveObservers()).toBe(0);
    expect(findAll(h.stage, "mtf-cheer")).toHaveLength(0);
    expect(h.stage.children.filter((c) => c.tagName === "style")).toHaveLength(0);
    expect(h.rounds[0].destroys).toBe(1);
    expect(() => h.handle.destroy?.()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 七、外壳与文案
// ---------------------------------------------------------------------------

describe("算数小农场 1.2 · 外壳与文案", () => {
  it("1.1 的基线一个字没动：edu / campaign / 188 关", () => {
    expect(meta.id).toBe("math-farm");
    expect(meta.category).toBe("edu");
    expect(meta.modes).toEqual(["campaign"]);
    expect(meta.levels).toBe(188);
    expect(meta.blurb.length).toBeGreaterThan(20);
    expect(meta.blurb).not.toMatch(/[A-Za-z]/);
  });

  it("新样式一律 mtf- 前缀，窄屏竖式还看得清", () => {
    const classes = MTF_CSS.match(/\.[a-zA-Z][\w-]*/g) ?? [];
    for (const c of classes) expect(c.startsWith(".mtf-"), `${c} 不是本款的前缀`).toBe(true);
    expect(MTF_CSS).not.toMatch(/\.qz-|\.l99-/);
    // 360px 的手机上竖式不能小到看不清，也不能宽到撑破屏幕
    expect(MTF_CSS).toContain("@media (max-width: 400px)");
    expect(MIN_VERT_PX).toBeGreaterThanOrEqual(22);
    expect(MTF_CSS).toContain(`font-size: ${MIN_VERT_PX}px`);
    // 关掉动画偏好时也有交代
    expect(MTF_CSS).toContain("prefers-reduced-motion");
  });

  it("攻略跟着改了区间，只讲方法不泄题", () => {
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
    let prev = 0;
    for (const entry of guide.entries) {
      expect(entry.from).toBe(prev + 1);
      expect(entry.to).toBeGreaterThanOrEqual(entry.from);
      prev = entry.to;
      for (const tip of entry.tips) {
        // 攻略里不许出现「= 得数」这种直接给答案的写法
        expect(tip).not.toMatch(/=\s*\d/);
        expect(tip).not.toMatch(/[A-Za-z]/);
      }
    }
    const late = guide.entries[guide.entries.length - 1].tips.join("");
    for (const word of ["括号", "比", "方程", "应用题"]) expect(late).toContain(word);
    const mid = guide.entries[guide.entries.length - 2].tips.join("");
    for (const word of ["通分", "约分", "小数", "百分数"]) expect(mid).toContain(word);
  });
});
