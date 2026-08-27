/**
 * 窗口5 · 第 3 轮档C 测试员 —— 声调专项的**独立复算**守门用例。
 *
 * 口径：本文件**不 import 任何被测的拼音工具**（`pinyin.ts` / `logic.ts` 里的
 * `applyTone` / `toneOf` / `markTone` / `toneTargetIndex` 一律不碰），
 * 调号落位、调号字形、读调三件事全部由本文件自己从零写一遍，
 * 再拿去核对题库数据与 `buildQuestions()` 生成出来的每一道题。
 *
 * 被测代码只被允许干一件事：**出题**（`buildQuestions()` 是确定性的）。
 * 「这道题的答案对不对」由本文件的判据说了算。
 */
import { describe, expect, it } from "vitest";
import { buildQuestions, CHAPTERS } from "./levels";
import { DUOYIN_CARDS, SYLLABLE_CARDS, TONE_DRILL_CARDS, TONE_MARKS, TONED_WORDS } from "./logic";

// ---------------------------------------------------------------------------
// 我自己那一套（从零写）
// ---------------------------------------------------------------------------

/** 四个声调的字形，按 Unicode 码位一个一个写出来，不抄被测代码的表 */
const MARK: Record<string, readonly string[]> = {
  a: ["\u0101", "\u00e1", "\u01ce", "\u00e0"],
  o: ["\u014d", "\u00f3", "\u01d2", "\u00f2"],
  e: ["\u0113", "\u00e9", "\u011b", "\u00e8"],
  i: ["\u012b", "\u00ed", "\u01d0", "\u00ec"],
  u: ["\u016b", "\u00fa", "\u01d4", "\u00f9"],
  "\u00fc": ["\u01d6", "\u01d8", "\u01da", "\u01dc"],
};
const VOWELS = "aoeiu\u00fc";

/** 调号落位：有 a 找 a；没 a 找 o、e；i / u 并列标在后一个；其余标唯一那个元音 */
function myMarkIndex(plain: string): number {
  const s = plain.replace(/v/g, "\u00fc");
  for (const first of ["a", "o", "e"]) {
    const at = s.indexOf(first);
    if (at >= 0) return at;
  }
  let last = -1;
  for (let i = 0; i < s.length; i++) if (VOWELS.includes(s[i])) last = i;
  return last;
}

function myApplyTone(plain: string, tone: number): string {
  const s = plain.replace(/v/g, "\u00fc");
  if (tone < 1 || tone > 4) return s;
  const at = myMarkIndex(s);
  if (at < 0) return s;
  const row = MARK[s[at]];
  return row ? s.slice(0, at) + row[tone - 1] + s.slice(at + 1) : s;
}

/** 读调：在音节里找那个戴了调号的字母 */
function myReadTone(syllable: string): number {
  for (const row of Object.values(MARK))
    for (let t = 0; t < 4; t++) if (syllable.includes(row[t])) return t + 1;
  return 0;
}

function myStrip(syllable: string): string {
  let out = "";
  outer: for (const ch of syllable) {
    for (const [base, row] of Object.entries(MARK)) {
      if (row.includes(ch)) {
        out += base;
        continue outer;
      }
    }
    out += ch;
  }
  return out;
}

/** 我自己手写的参考读音（按现代汉语普通话，不看被测代码） */
const REF: Record<string, string> = {
  好: "h\u01ceo", 流: "li\u00fa", 水: "shu\u01d0", 学: "xu\u00e9", 美: "m\u011bi",
  写: "xi\u011b", 狗: "g\u01d2u", 火: "hu\u01d2", 快: "ku\u00e0i", 九: "ji\u01d4",
  龟: "gu\u012b", 略: "l\u00fc\u00e8", 鸟: "ni\u01ceo", 白: "b\u00e1i", 跳: "ti\u00e0o",
  桌: "zhu\u014d", 休: "xi\u016b", 对: "du\u00ec", 月: "yu\u00e8", 有: "y\u01d2u",
  猫: "m\u0101o", 鱼: "y\u00fa", 马: "m\u01ce", 花: "hu\u0101", 日: "r\u00ec",
  书: "sh\u016b", 包: "b\u0101o", 雨: "y\u01d4", 伞: "s\u01cen", 公: "g\u014dng",
  园: "yu\u00e1n", 森: "s\u0113n", 林: "l\u00edn", 校: "xi\u00e0o", 课: "k\u00e8",
  本: "b\u011bn", 山: "sh\u0101n", 峰: "f\u0113ng", 习: "x\u00ed", 老: "l\u01ceo",
  师: "sh\u012b", 车: "ch\u0113", 大: "d\u00e0", 海: "h\u01cei", 云: "y\u00fan",
  春: "ch\u016bn", 天: "ti\u0101n", 铅: "qi\u0101n", 笔: "b\u01d0",
};

const TOTAL = CHAPTERS.reduce((n, c) => n + c.size, 0);
const SYLLABLE_RE = new RegExp(
  `^[a-z\u00fc${Object.values(MARK).flat().join("")}]+$`
);

type Q = { kind: string; answer: string; ask: string; choices: string[]; correct: number };
const ALL: Array<{ level: number; q: Q }> = [];
for (let lv = 0; lv < TOTAL; lv++)
  for (const q of buildQuestions(lv) as Q[]) ALL.push({ level: lv, q });

// ---------------------------------------------------------------------------

describe("pinyin-train 声调独立复算（不调被测代码算答案）", () => {
  it("我这套判据本身抓得住错：调号戴错字母 / 戴错声调都要判出来", () => {
    // 先证明尺子是活的，再拿它去量别人
    expect(myApplyTone("hao", 3)).toBe("h\u01ceo");
    expect(myApplyTone("liu", 2)).toBe("li\u00fa"); // i/u 并列标在后
    expect(myApplyTone("gui", 1)).toBe("gu\u012b");
    expect(myApplyTone("lve", 4)).toBe("l\u00fc\u00e8"); // v → ü，有 e 标 e
    expect(myApplyTone("hao", 3)).not.toBe("h\u0061\u030co"); // 组合字符不算
    expect(myReadTone("h\u01ceo")).toBe(3);
    expect(myStrip("l\u00fc\u00e8")).toBe("l\u00fc\u0065".replace("e", "e"));
    expect(myApplyTone("hao", 2)).not.toBe(myApplyTone("hao", 3));
  });

  it("调号字形表：TONE_MARKS 每一格都与我自己写的码位一致", () => {
    let n = 0;
    for (const [base, row] of Object.entries(TONE_MARKS)) {
      const mine = MARK[base];
      expect(mine, `TONE_MARKS 里多了个基字母 ${base}`).toBeTruthy();
      row.forEach((ch, i) => {
        n++;
        expect(ch, `TONE_MARKS[${base}][${i}]`).toBe(mine[i]);
      });
    }
    expect(n).toBeGreaterThanOrEqual(20);
  });

  it("TONE_DRILL_CARDS：每张卡的拼写与声调都对得上我的参考读音", () => {
    const bad: string[] = [];
    for (const c of TONE_DRILL_CARDS) {
      const ref = REF[c.word];
      if (!ref) continue;
      if (myStrip(ref) !== c.plain.replace(/v/g, "\u00fc"))
        bad.push(`「${c.word}」拼成 ${c.plain}，我的参考是 ${myStrip(ref)}`);
      if (myReadTone(ref) !== c.tone)
        bad.push(`「${c.word}」标第 ${c.tone} 声，我的参考读第 ${myReadTone(ref)} 声（${ref}）`);
    }
    expect(bad, bad.join(" / ")).toEqual([]);
  });

  it("看图音节卡与双音节词：调号既没戴错字母，也没标错声调", () => {
    const bad: string[] = [];
    const check = (label: string, syllable: string, refChar?: string) => {
      const tone = myReadTone(syllable);
      if (tone > 0 && myApplyTone(myStrip(syllable), tone) !== syllable)
        bad.push(`${label} ${syllable} 调号戴错字母，我算应写 ${myApplyTone(myStrip(syllable), tone)}`);
      const ref = refChar ? REF[refChar] : undefined;
      if (ref && ref !== syllable) bad.push(`${label} 写 ${syllable}，我的参考是 ${ref}`);
    };
    for (const c of SYLLABLE_CARDS) check(`看图卡「${c.word}」`, c.pinyin, c.word);
    for (const w of TONED_WORDS)
      w.syllables.forEach((sy, i) => check(`双音节词「${w.word}」第 ${i + 1} 字`, sy, w.word[i]));
    expect(bad, bad.join(" / ")).toEqual([]);
  });

  it(`全 ${TOTAL} 关生成的每一道题：结构上只有一个正确答案`, () => {
    const bad: string[] = [];
    for (const { level, q } of ALL) {
      if (q.choices[q.correct] !== q.answer)
        bad.push(`L${level + 1} ${q.kind}：correct 指到 ${q.choices[q.correct]}，答案却是 ${q.answer}`);
      if (new Set(q.choices).size !== q.choices.length)
        bad.push(`L${level + 1} ${q.kind}：选项重样 ${q.choices.join("/")}`);
      if (q.choices.filter((c) => c === q.answer).length !== 1)
        bad.push(`L${level + 1} ${q.kind}：正确答案不止一个 ${q.choices.join("/")}`);
    }
    expect(bad.slice(0, 12), bad.slice(0, 12).join(" / ")).toEqual([]);
    expect(ALL.length).toBeGreaterThan(900);
  });

  it("`tone` 题：答案由我自己算一遍，干扰项不许与答案同调", () => {
    const bad: string[] = [];
    let n = 0;
    for (const { level, q } of ALL) {
      if (q.kind !== "tone") continue;
      n++;
      const m = q.ask.match(/^哪个是「(.+?)」的第(.)声？$/);
      if (!m) {
        bad.push(`L${level + 1} 题干不认得：${q.ask}`);
        continue;
      }
      const base = m[1];
      const tone = "一二三四".indexOf(m[2]) + 1;
      const mine = myApplyTone(base, tone);
      if (mine !== q.answer) bad.push(`L${level + 1}「${base}」第${tone}声 答案 ${q.answer}，我算 ${mine}`);
      for (const c of q.choices) {
        if (c === q.answer) continue;
        if (myStrip(c) !== base) bad.push(`L${level + 1} 干扰项 ${c} 换了基字母`);
        if (myReadTone(c) === tone) bad.push(`L${level + 1} 干扰项 ${c} 与答案同调`);
      }
    }
    expect(n).toBeGreaterThan(0);
    expect(bad, bad.join(" / ")).toEqual([]);
  });

  it("`tonemark` 题：调号该戴在哪个字母上，由我的落位规则说了算", () => {
    const bad: string[] = [];
    let n = 0;
    for (const { level, q } of ALL) {
      if (q.kind !== "tonemark") continue;
      n++;
      const letterQ = q.ask.match(/^「(.+?)」读第(.)声，调号戴在哪个字母上？$/);
      const wholeQ = q.ask.match(/^「(.+?)」读第(.)声，哪个写对了？$/);
      const m = letterQ ?? wholeQ;
      if (!m) {
        bad.push(`L${level + 1} 题干不认得：${q.ask}`);
        continue;
      }
      const tone = "一二三四".indexOf(m[2]) + 1;
      const card = TONE_DRILL_CARDS.find((c) => c.word === m[1]);
      if (!card) {
        bad.push(`L${level + 1} 找不到卡片「${m[1]}」`);
        continue;
      }
      if (card.tone !== tone) bad.push(`L${level + 1} 题干说第${tone}声，卡片写第${card.tone}声`);
      if (letterQ) {
        const mine = card.plain.replace(/v/g, "\u00fc")[myMarkIndex(card.plain)];
        if (mine !== q.answer) bad.push(`L${level + 1}「${m[1]}」答案字母 ${q.answer}，我算 ${mine}`);
      } else {
        const mine = myApplyTone(card.plain, tone);
        if (mine !== q.answer) bad.push(`L${level + 1}「${m[1]}」答案 ${q.answer}，我算 ${mine}`);
        // 干扰项两种都算数：调号戴错字母、或者戴对字母但标错声调。
        // 不算数的只有一种——它其实也是对的。
        for (const c of q.choices) {
          if (c === q.answer) continue;
          if (c === mine) bad.push(`L${level + 1} 干扰项 ${c} 其实也是对的`);
          if (myStrip(c) !== myStrip(mine)) bad.push(`L${level + 1} 干扰项 ${c} 连拼写都换了`);
          const wrongLetter = myReadTone(c) === tone;
          const wrongTone = myApplyTone(myStrip(c), myReadTone(c)) === c;
          if (!wrongLetter && !wrongTone)
            bad.push(`L${level + 1} 干扰项 ${c} 既不是戴错字母也不是标错声调，说不清错在哪`);
        }
      }
    }
    expect(n).toBeGreaterThan(0);
    expect(bad, bad.join(" / ")).toEqual([]);
  });

  it("凡是长得像音节的选项，调号一律不许戴错字母（全 188 关逐项扫）", () => {
    // `tonemark` 那一类的干扰项本来就是「故意戴错」的，是考点本身，另有专项用例管；这里排除掉
    const bad: string[] = [];
    let n = 0;
    for (const { level, q } of ALL) {
      if (q.kind === "tonemark") continue;
      for (const c of q.choices) {
        if (!SYLLABLE_RE.test(c)) continue;
        const tone = myReadTone(c);
        if (tone === 0) continue;
        n++;
        const mine = myApplyTone(myStrip(c), tone);
        if (mine !== c) bad.push(`L${level + 1} ${q.kind} 选项 ${c}，我算应写 ${mine}`);
      }
    }
    expect(n).toBeGreaterThan(500);
    expect([...new Set(bad)].slice(0, 12), bad.slice(0, 12).join(" / ")).toEqual([]);
  });

  it("`tonemark`「哪个写对了」：答案自己戴对了，三个选项里只有它戴对", () => {
    let n = 0;
    const bad: string[] = [];
    for (const { level, q } of ALL) {
      if (q.kind !== "tonemark") continue;
      const m = q.ask.match(/^「(.+?)」读第(.)声，哪个写对了？$/);
      if (!m) continue;
      n++;
      const tone = "一二三四".indexOf(m[2]) + 1;
      const right = q.choices.filter((c) => myApplyTone(myStrip(c), tone) === c && myReadTone(c) === tone);
      if (right.length !== 1) bad.push(`L${level + 1}「${m[1]}」戴对的有 ${right.length} 个：${q.choices.join("/")}`);
      if (right[0] !== q.answer) bad.push(`L${level + 1}「${m[1]}」戴对的是 ${right[0]}，答案却记成 ${q.answer}`);
    }
    expect(n).toBeGreaterThan(0);
    expect(bad, bad.join(" / ")).toEqual([]);
  });

  it("多音字卡：两读不重样、词里真有这个字、只差声调的两读不共用词", () => {
    const bad: string[] = [];
    for (const card of DUOYIN_CARDS) {
      const seen = new Set<string>();
      for (const r of card.readings) {
        const tone = myReadTone(r.pinyin);
        if (tone > 0 && myApplyTone(myStrip(r.pinyin), tone) !== r.pinyin)
          bad.push(`「${card.char}」${r.pinyin} 调号戴错字母`);
        if (seen.has(r.pinyin)) bad.push(`「${card.char}」两读写成了同一个 ${r.pinyin}`);
        seen.add(r.pinyin);
        for (const w of r.words) if (!w.includes(card.char)) bad.push(`「${card.char}」的词「${w}」里没有这个字`);
      }
      const plains = card.readings.map((r) => myStrip(r.pinyin));
      if (new Set(plains).size === 1) {
        const dup = card.readings[0].words.filter((w) => card.readings[1].words.includes(w));
        if (dup.length) bad.push(`「${card.char}」两读共用了词 ${dup.join("/")}`);
      }
    }
    expect(bad, bad.join(" / ")).toEqual([]);
  });
});
