/**
 * 188 关全量题目的声调独立复算（窗口5 第3轮 档C 测试员）。
 * 与同目录 `toneIndependent.test.ts` 分工：那一支盯落位 / 字形 / 读调三件事的规则本身，
 * 这一支把 `buildQuestions(1…188)` 出的每一道题都拿去过一遍同一套独立判据。
 *
 * 独立性口径：调号表不抄 `logic.ts` / `pinyin.ts` 的任何常量，
 * 一律从 Unicode 组合附加符号现场拼出来再 NFC 归一；
 * 「调号戴在哪个字母上」也自己按《汉语拼音正词法基本规则》重写一遍。
 * 被测代码这边只 import 出题函数与题库数据，不 import 它算答案的工具。
 */
import { describe, expect, it } from "vitest";
import { buildQuestions, CHAPTERS, type PinyinQ } from "./levels";
import { DUOYIN_CARDS, TONE_DRILL_CARDS } from "./logic";

// --- 我自己的调号表：字母 + 组合附加符号 → NFC -------------------------------
const COMBINING = ["\u0304", "\u0301", "\u030C", "\u0300"]; // 一声 macron / 二声 acute / 三声 caron / 四声 grave
const PLAIN_VOWELS = ["a", "o", "e", "i", "u", "\u00FC"]; // a o e i u ü
function myToned(letter: string, tone: number): string {
  if (tone < 1 || tone > 4) return letter;
  return (letter + COMBINING[tone - 1]).normalize("NFC");
}
const MY_TONE_TABLE: Record<string, string[]> = {};
for (const v of PLAIN_VOWELS) MY_TONE_TABLE[v] = [1, 2, 3, 4].map((t) => myToned(v, t));
const MY_LOOKUP: Record<string, { base: string; tone: number }> = {};
for (const [base, forms] of Object.entries(MY_TONE_TABLE)) {
  forms.forEach((f, i) => (MY_LOOKUP[f] = { base, tone: i + 1 }));
}
/** 我这一套的「摘调号」 */
function myStrip(s: string): string {
  return Array.from(s).map((c) => (MY_LOOKUP[c] ? MY_LOOKUP[c].base : c)).join("");
}
/** 我这一套的「读出第几声」（没戴调号 = 轻声 0） */
function myReadTone(s: string): number {
  for (const c of Array.from(s)) if (MY_LOOKUP[c]) return MY_LOOKUP[c].tone;
  return 0;
}
/** 我这一套的落位规则：有 a 找 a，没 a 找 o / e，都没有就戴最后一个 i / u / ü */
function myTargetIndex(plain: string): number {
  const s = Array.from(plain.toLowerCase());
  for (const v of ["a", "o", "e"]) {
    const at = s.indexOf(v);
    if (at >= 0) return at;
  }
  for (let i = s.length - 1; i >= 0; i--) if (PLAIN_VOWELS.includes(s[i])) return i;
  return -1;
}
function myMark(plain: string, tone: number): string {
  const at = myTargetIndex(plain);
  if (at < 0) return plain;
  const s = Array.from(plain);
  s[at] = myToned(s[at], tone);
  return s.join("");
}
const MY_TONE_NAMES = ["第一声", "第二声", "第三声", "第四声"];

function allQuestions(): { level: number; q: PinyinQ }[] {
  const out: { level: number; q: PinyinQ }[] = [];
  for (let lv = 1; lv <= 188; lv++) for (const q of buildQuestions(lv)) out.push({ level: lv, q });
  return out;
}
const ALL = allQuestions();

describe("窗口5 第3轮 档C · 188 关全量声调独立复算", () => {
  it("自建调号表与被测代码的落位无关，先自证它自己是对的", () => {
    expect(MY_TONE_TABLE["a"]).toEqual(["\u0101", "\u00E1", "\u01CE", "\u00E0"]);
    expect(MY_TONE_TABLE["\u00FC"]).toEqual(["\u01D6", "\u01D8", "\u01DA", "\u01DC"]);
    expect(myMark("liu", 2)).toBe("li\u00FA");      // iu 标在 u 上
    expect(myMark("shui", 3)).toBe("shu\u01D0");    // ui 标在 i 上
    expect(myMark("hao", 3)).toBe("h\u01CEo");      // 有 a 找 a
    expect(myMark("gou", 3)).toBe("g\u01D2u");      // 没 a 找 o
    expect(myMark("xue", 2)).toBe("xu\u00E9");      // 没 a 找 e
    expect(myMark("l\u00FCe", 4)).toBe("l\u00FC\u00E8");
  });

  it("`tone` 题：问第几声就必须给第几声，三个选项同底不同调、无重样", () => {
    const bad: string[] = [];
    let n = 0;
    for (const { level, q } of ALL) {
      if (q.kind !== "tone") continue;
      n++;
      const m = /「(.+?)」的(第.声)/.exec(q.ask || "");
      if (!m) { bad.push(`L${level} 问法认不出：${q.ask}`); continue; }
      const base = m[1], want = MY_TONE_NAMES.indexOf(m[2]) + 1;
      const expectAns = myToned(base, want);
      if (q.answer !== expectAns) bad.push(`L${level} 「${base}」${m[2]} 该是 ${expectAns}，题给 ${q.answer}`);
      if (q.choices[q.correct] !== q.answer) bad.push(`L${level} correct 下标没指向 answer`);
      if (new Set(q.choices).size !== q.choices.length) bad.push(`L${level} 选项重样：${q.choices.join("/")}`);
      for (const c of q.choices) {
        if (myStrip(c) !== base) bad.push(`L${level} 干扰项换了底：${c}`);
        if (c !== q.answer && myReadTone(c) === want) bad.push(`L${level} 干扰项也是${m[2]}：${c}`);
      }
    }
    expect(bad.slice(0, 12), `tone 题 ${n} 道，问题 ${bad.length} 条`).toEqual([]);
    console.log(`[探针] tone 题 ${n} 道，独立复算 0 错`);
  });

  it("`tonemark` 题两种问法：戴在哪个字母 / 哪个写对了", () => {
    const bad: string[] = [];
    let a = 0, b = 0;
    for (const { level, q } of ALL) {
      if (q.kind !== "tonemark") continue;
      const letterAsk = /调号戴在哪个字母上/.test(q.ask || "");
      const m = /「(.+?)」读(第.声)/.exec(q.ask || "");
      if (!m) { bad.push(`L${level} 问法认不出：${q.ask}`); continue; }
      const word = m[1], tone = MY_TONE_NAMES.indexOf(m[2]) + 1;
      const card = TONE_DRILL_CARDS.find((c) => c.word === word);
      if (!card) { bad.push(`L${level} 题库里没有「${word}」`); continue; }
      if (card.tone !== tone) bad.push(`L${level} 「${word}」题面说${m[2]}，卡片写的是第${card.tone}声`);
      if (letterAsk) {
        a++;
        const want = card.plain[myTargetIndex(card.plain)];
        if (q.answer !== want) bad.push(`L${level} 「${word}」(${card.plain}) 调号该戴 ${want}，题给 ${q.answer}`);
        for (const c of q.choices) if (c !== want && c === want) bad.push(`L${level} 干扰项与答案同字母`);
      } else {
        b++;
        const want = myMark(card.plain, tone);
        if (q.answer !== want) bad.push(`L${level} 「${word}」该写成 ${want}，题给 ${q.answer}`);
        for (const c of q.choices) {
          if (c === q.answer) continue;
          if (c === want) bad.push(`L${level} 干扰项与正确写法一模一样：${c}`);
          if (myStrip(c) !== card.plain) bad.push(`L${level} 干扰项换了音节：${c}`);
        }
      }
      if (q.choices[q.correct] !== q.answer) bad.push(`L${level} correct 下标没指向 answer`);
      if (new Set(q.choices).size !== q.choices.length) bad.push(`L${level} 选项重样`);
    }
    expect(bad.slice(0, 12), `tonemark 问题 ${bad.length} 条`).toEqual([]);
    console.log(`[探针] tonemark 题 ${a + b} 道（问字母 ${a} / 问写法 ${b}），独立复算 0 错`);
  });

  it("`duoyin` 题：答案是该词的读音，且第二个正确答案不许混进选项", () => {
    const bad: string[] = [];
    let n = 0;
    const twoAnswer: string[] = [];
    for (const { level, q } of ALL) {
      if (q.kind !== "duoyin") continue;
      n++;
      const word = String(q.promptHTML || "").replace(/<[^>]*>/g, "").trim();
      // 这个词在题库里对应哪几个读音——一个词落在两个读音下就是「有两个正确答案」
      const hits: string[] = [];
      for (const card of DUOYIN_CARDS)
        for (const r of card.readings)
          if (r.words.includes(word)) hits.push(r.pinyin);
      if (!hits.length) { bad.push(`L${level} 「${word}」不在多音字表里`); continue; }
      if (!hits.includes(q.answer)) bad.push(`L${level} 「${word}」的答案 ${q.answer} 不在题库读音 ${hits.join("/")} 里`);
      const otherRight = q.choices.filter((c) => c !== q.answer && hits.includes(c));
      if (otherRight.length) twoAnswer.push(`L${level} 「${word}」答 ${q.answer}，但 ${otherRight.join("/")} 也在这个词的读音表里`);
      if (q.choices[q.correct] !== q.answer) bad.push(`L${level} correct 下标没指向 answer`);
      if (new Set(q.choices).size !== q.choices.length) bad.push(`L${level} 选项重样`);
      // 声调变体干扰项必须只是变调，不能变成另一个真读音
      for (const c of q.choices) if (c !== q.answer && myStrip(c) === myStrip(q.answer) && hits.includes(c))
        bad.push(`L${level} 变调干扰项撞上真读音：${c}`);
    }
    console.log(`[探针] duoyin 题 ${n} 道；「词本身定不了音」${twoAnswer.length} 道`);
    if (twoAnswer.length) console.log(twoAnswer.slice(0, 10).join("\n"));
    expect(bad.slice(0, 12), `duoyin 结构问题 ${bad.length} 条`).toEqual([]);
    expect(twoAnswer.length, "有第二个正确答案的题").toBe(0);
  });

  it("凡是带调号的选项，调号落位一律合规（全题型通扫）", () => {
    const bad: string[] = [];
    let n = 0;
    let designedWrong = 0;
    for (const { level, q } of ALL) {
      for (const c of q.choices) {
        // `tonemark` 的干扰项本来就是「故意写错的落位」，那是题目本身要考的，不算违规
        if (q.kind === "tonemark" && c !== q.answer) { designedWrong++; continue; }
        const marked = Array.from(c).findIndex((ch) => MY_LOOKUP[ch]);
        if (marked < 0) continue;
        n++;
        // 只挑「一个音节」的选项复算落位；词组/句子里含空格或多个调号的跳过
        if (/[\s，。、？！]/.test(c)) continue;
        if (Array.from(c).filter((ch) => MY_LOOKUP[ch]).length !== 1) continue;
        const plain = myStrip(c);
        const want = myTargetIndex(plain);
        if (want !== marked) bad.push(`L${level} ${q.kind} 「${c}」调号戴在第 ${marked} 位，按规则该在第 ${want} 位`);
      }
    }
    console.log(`[探针] 带调号的选项共 ${n} 个（另有 tonemark 故意写错的干扰项 ${designedWrong} 个已排除），落位违规 ${bad.length} 个`);
    expect(bad.slice(0, 15)).toEqual([]);
  });

  it("题目结构通扫：correct 指向 answer / 答案在选项里 / 选项不重样", () => {
    const bad: string[] = [];
    const byKind: Record<string, number> = {};
    for (const { level, q } of ALL) {
      byKind[q.kind] = (byKind[q.kind] || 0) + 1;
      if (!q.choices.includes(q.answer)) bad.push(`L${level} ${q.kind} 答案不在选项里`);
      if (q.choices[q.correct] !== q.answer) bad.push(`L${level} ${q.kind} correct 没指向 answer`);
      if (new Set(q.choices).size !== q.choices.length) bad.push(`L${level} ${q.kind} 选项重样`);
    }
    console.log(`[探针] 全量 ${ALL.length} 道；题型分布 ${JSON.stringify(byKind)}；章 ${CHAPTERS.length} 座`);
    expect(bad.slice(0, 12)).toEqual([]);
  });
});
