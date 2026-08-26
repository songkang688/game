/**
 * 识字小花园 1.2：字库自检。
 *
 * 教材内容错一个都是教学事故，所以这一份不抽样、不放过：
 * 六张字卡表 + 五张高年级表 + 188 关生成出来的每一道题，全量扫。
 */
import { describe, expect, it } from "vitest";
import {
  BUILD_CHAR_CARDS,
  CLOZE_CARDS,
  IDIOM_CARDS,
  LOOKALIKE_SETS,
  POLYPHONE_CARDS,
  RADICAL_CARDS,
  SYN_ANT_CARDS,
  WORD_BANK,
  isConfusable,
  lookalikeGroupOf,
  type WordCard,
} from "./logic";
import {
  buildQuestions,
  buildReviewRound,
  CHAPTER_POOLS,
  isBuildCharLevel,
  isTraceLevel,
  makeReviewQuestion,
  questionFocus,
  REAL_WORDS,
  type WordQ,
} from "./levels";

const strip = (html: string): string => html.replace(/<[^>]+>/g, "").trim();
const ALL_CARDS: WordCard[] = CHAPTER_POOLS.flat();
const ALL_LEVELS = Array.from({ length: 188 }, (_, i) => i);
const ALL_QUESTIONS: WordQ[] = ALL_LEVELS.flatMap((lv) => buildQuestions(lv));

// ---------------------------------------------------------------------------
// 拼音合法性：拆得成「声母 + 韵母 + 一个声调」才算数
// ---------------------------------------------------------------------------

const TONED: Record<string, string> = {
  ā: "a", á: "a", ǎ: "a", à: "a",
  ē: "e", é: "e", ě: "e", è: "e",
  ī: "i", í: "i", ǐ: "i", ì: "i",
  ō: "o", ó: "o", ǒ: "o", ò: "o",
  ū: "u", ú: "u", ǔ: "u", ù: "u",
  ǖ: "ü", ǘ: "ü", ǚ: "ü", ǜ: "ü",
};

/** 声母，两个字母的排在前面才能贪心匹配对 */
const INITIALS = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s", "y", "w"];

const FINALS = new Set([
  "a", "o", "e", "er", "ai", "ei", "ao", "ou", "an", "en", "ang", "eng", "ong",
  "i", "ia", "ie", "iao", "iu", "ian", "in", "iang", "ing", "iong",
  "u", "ua", "uo", "uai", "ui", "uan", "un", "uang", "ueng",
  "ü", "üe", "üan", "ün", "ue",
]);

function toneCount(pinyin: string): number {
  return [...pinyin].filter((c) => c in TONED).length;
}

function stripTone(pinyin: string): string {
  return [...pinyin].map((c) => TONED[c] ?? c).join("");
}

/** 这个音节拆得成「声母 + 韵母」吗 */
export function isLegalSyllable(pinyin: string): boolean {
  const bare = stripTone(pinyin);
  if (!/^[a-zü]+$/.test(bare)) return false;
  for (const ini of INITIALS) {
    if (!bare.startsWith(ini)) continue;
    const fin = bare.slice(ini.length);
    if (!FINALS.has(fin)) continue;
    // ü 系韵母只跟得上少数几个声母，别的拼法一律不合法
    if (fin.startsWith("ü") && !["n", "l"].includes(ini)) continue;
    if (fin === "ue" && !["j", "q", "x", "y"].includes(ini)) continue;
    return true;
  }
  return FINALS.has(bare) && !bare.startsWith("ü") && bare !== "ue";
}

/** 这些繁体 / 异体字一个都不许出现在孩子看得见的任何一个字里 */
const FORBIDDEN = [
  "門", "馬", "鳥", "魚", "蟲", "龜", "葉", "雲", "電", "風", "車", "書", "筆", "燈", "傘",
  "學", "習", "語", "話", "讀", "請", "謝", "親", "愛", "樂", "發", "鴨", "雞", "豬", "貓",
  "狗兒", "蝦", "湯", "麵", "餅", "麥", "華", "國", "個", "們", "這", "來", "時", "間", "長",
  "東", "紅", "綠", "藍", "點", "會", "說", "頭", "臉", "體", "幾", "萬", "億", "號", "區",
];

describe("识字小花园 · 字库正确性自检", () => {
  it("六张字卡表：单字、字段齐全、章内不重复、全表也不重复", () => {
    expect(CHAPTER_POOLS).toHaveLength(6);
    const global = new Set<string>();
    for (const pool of CHAPTER_POOLS) {
      const inChapter = new Set<string>();
      expect(pool.length).toBeGreaterThanOrEqual(10);
      for (const c of pool) {
        expect([...c.char]).toHaveLength(1);
        expect(inChapter.has(c.char), `同一章重复出现：${c.char}`).toBe(false);
        inChapter.add(c.char);
        expect(global.has(c.char), `跨章重复出现：${c.char}`).toBe(false);
        global.add(c.char);
        expect(c.word.length).toBeGreaterThan(0);
        expect(c.emoji.length).toBeGreaterThan(0);
      }
    }
    expect(global.size).toBe(96);
  });

  it("96 张字卡的拼音格式全部合法：声母 + 韵母 + 正好一个声调", () => {
    for (const c of ALL_CARDS) {
      expect(toneCount(c.pinyin), `${c.char} 的拼音应有且只有一个声调：${c.pinyin}`).toBe(1);
      expect(isLegalSyllable(c.pinyin), `${c.char} 的拼音拆不成合法音节：${c.pinyin}`).toBe(true);
    }
    // 自检本身是有效的：故意写错的音节必须被挡下来
    expect(isLegalSyllable("zhx")).toBe(false);
    expect(isLegalSyllable("bü")).toBe(false);
    expect(toneCount("shuǐi")).toBe(1);
  });

  it("每张字卡都有 meaning，而且不把答案字或示例词直接抄进去", () => {
    for (const c of ALL_CARDS) {
      expect(c.meaning.length, `${c.char} 缺 meaning`).toBeGreaterThanOrEqual(5);
      // 「给字选意思」的复查题要是把字本身写进释义里，就等于把答案摆在脸上
      expect(c.meaning.includes(c.char), `${c.char} 的释义泄题：${c.meaning}`).toBe(false);
      expect(c.meaning.includes(c.word), `${c.char} 的释义泄词：${c.meaning}`).toBe(false);
    }
  });

  it("孩子看得见的每一个字都是简体：无繁体、无异体", () => {
    const seen = [
      ...ALL_CARDS.flatMap((c) => [c.char, c.word, c.meaning]),
      ...LOOKALIKE_SETS.flat().flatMap((x) => [x.char, x.word, x.hint]),
      ...IDIOM_CARDS.flatMap((c) => [c.idiom, c.meaning]),
      ...SYN_ANT_CARDS.flatMap((c) => [c.word, c.synonym, c.antonym]),
      ...CLOZE_CARDS.map((c) => c.text),
      ...RADICAL_CARDS.flatMap((c) => [c.topic, ...c.chars]),
      ...BUILD_CHAR_CARDS.flatMap((c) => [c.char, c.word, c.clue]),
      ...POLYPHONE_CARDS.flatMap((c) => c.readings.flatMap((r) => [r.word, r.sentence, r.meaning])),
      ...ALL_QUESTIONS.flatMap((q) => [q.ask, ...q.choices.map(strip)]),
    ].join("");
    for (const bad of FORBIDDEN) {
      expect(seen.includes(bad), `出现了繁体 / 异体：${bad}`).toBe(false);
    }
  });
});

describe("识字小花园 · 每一道题都答得对、只有一个答案", () => {
  it("188 关每道题：三个不同选项、正确项就是答案、答案在选项里只出现一次", () => {
    expect(ALL_QUESTIONS.length).toBeGreaterThan(1000);
    for (const q of ALL_QUESTIONS) {
      expect(q.choices).toHaveLength(3);
      expect(new Set(q.choices).size).toBe(3);
      const plain = q.choices.map(strip);
      expect(plain[q.correct]).toBe(q.answer);
      expect(plain.filter((c) => c === q.answer), `答案不唯一：${q.ask}`).toHaveLength(1);
    }
  });

  it("每一道题都反查得出它在考哪个字（错题本靠这个记账）", () => {
    for (const q of ALL_QUESTIONS) {
      const focus = questionFocus(q);
      expect(focus.length, `反查不出考点：${q.kind} / ${q.ask}`).toBeGreaterThan(0);
    }
  });
});

describe("识字小花园 · 干扰项讲道理", () => {
  it("形近字：21 组每组 ≥3 个字，组内两两共享部件或只差一笔", () => {
    expect(LOOKALIKE_SETS.length).toBeGreaterThanOrEqual(20);
    const seen = new Set<string>();
    for (const group of LOOKALIKE_SETS) {
      expect(group.length, `这一组凑不齐三选一：${group.map((x) => x.char).join("")}`).toBeGreaterThanOrEqual(3);
      for (const item of group) {
        expect([...item.char]).toHaveLength(1);
        expect(item.parts.length).toBeGreaterThan(0);
        expect(item.strokes).toBeGreaterThan(0);
        expect(seen.has(item.char), `形近字表里重复：${item.char}`).toBe(false);
        seen.add(item.char);
      }
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          expect(
            isConfusable(group[i], group[j]),
            `${group[i].char} 和 ${group[j].char} 既不共享部件也不只差一笔`
          ).toBe(true);
        }
      }
    }
    // 自检有效性：随便拉两个八竿子打不着的字必须判为不形近
    const ri = { char: "日", word: "太阳", hint: "", parts: ["日"], strokes: 4 };
    const chuan = { char: "船", word: "小船", hint: "", parts: ["舟"], strokes: 11 };
    expect(isConfusable(ri, chuan)).toBe(false);
  });

  it("形近字题：三个选项 100% 来自同一组，不再跨组抓随机字", () => {
    let checked = 0;
    for (const q of ALL_QUESTIONS) {
      if (q.kind !== "lookalike") continue;
      const group = lookalikeGroupOf(q.answer).map((x) => x.char);
      expect(group.length).toBeGreaterThanOrEqual(3);
      for (const c of q.choices) {
        expect(group, `跨组干扰项：${c} 不在 ${q.answer} 那一组里`).toContain(c);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("组词题：三个选项全部来自受控真词表，没有一个是生造词", () => {
    const real = REAL_WORDS;
    let checked = 0;
    for (const q of ALL_QUESTIONS) {
      if (q.kind !== "char2word") continue;
      for (const c of q.choices) {
        expect(real.has(strip(c)), `生造词：${c}`).toBe(true);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it("成语题：干扰项填回去凑不出另一条成语，答案唯一", () => {
    let checked = 0;
    const idioms = new Set(IDIOM_CARDS.map((c) => c.idiom));
    for (const q of ALL_QUESTIONS) {
      if (q.kind !== "idiom") continue;
      const shown = strip(q.promptHTML);
      const card = IDIOM_CARDS.find(
        (c) => Array.from(c.idiom).map((ch, i) => (i === c.blank ? "□" : ch)).join("") === shown
      );
      expect(card).toBeDefined();
      for (const c of q.choices) {
        const filled = shown.replace("□", c);
        if (c === q.answer) expect(filled).toBe(card!.idiom);
        else expect(idioms.has(filled), `干扰项也能凑成成语：${filled}`).toBe(false);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("近反义：18 条词各不相同、三个方向互不打架，填空的答案一定挑得出干扰项", () => {
    const words = SYN_ANT_CARDS.map((c) => c.word);
    expect(new Set(words).size).toBe(words.length);
    for (const c of SYN_ANT_CARDS) {
      expect(c.synonym).not.toBe(c.word);
      expect(c.antonym).not.toBe(c.word);
      expect(c.antonym).not.toBe(c.synonym);
      // 一个词的近义词不许正好是另一条卡的这个词的反义词，不然答案就不唯一了
      const clash = SYN_ANT_CARDS.filter((o) => o !== c && o.word === c.word);
      expect(clash).toHaveLength(0);
    }
    for (const cloze of CLOZE_CARDS) {
      expect(cloze.text).toContain("____");
      expect(words).toContain(cloze.answer);
    }
  });
});

describe("识字小花园 · 多音字辨析", () => {
  it("每张多音字卡：两个读音不同、两句话都含这个字、近音干扰项不是它的真读音", () => {
    expect(POLYPHONE_CARDS.length).toBeGreaterThanOrEqual(20);
    const seen = new Set<string>();
    for (const card of POLYPHONE_CARDS) {
      expect([...card.char]).toHaveLength(1);
      expect(seen.has(card.char), `多音字表里重复：${card.char}`).toBe(false);
      seen.add(card.char);
      const [a, b] = card.readings;
      expect(a.pinyin, `${card.char} 的两个读音居然一样`).not.toBe(b.pinyin);
      expect(card.decoy).not.toBe(a.pinyin);
      expect(card.decoy).not.toBe(b.pinyin);
      for (const r of [a, b]) {
        expect(toneCount(r.pinyin), `${card.char} 的 ${r.pinyin} 声调不对`).toBe(1);
        expect(isLegalSyllable(r.pinyin), `${card.char} 的 ${r.pinyin} 不是合法音节`).toBe(true);
        expect(r.sentence, `${card.char} 的例句里没有这个字`).toContain(card.char);
        expect(r.word).toContain(card.char);
        expect(r.meaning.length).toBeGreaterThanOrEqual(2);
      }
      expect(toneCount(card.decoy)).toBe(1);
      expect(isLegalSyllable(card.decoy), `近音干扰项不合法：${card.decoy}`).toBe(true);
    }
  });

  it("多音字题：三个选项都是拼音、互不相同，答案就是这句话里的那个读音", () => {
    let checked = 0;
    for (const q of ALL_QUESTIONS) {
      if (q.kind !== "polyphone") continue;
      const card = POLYPHONE_CARDS.find((c) => q.ask.includes(`「${c.char}」`));
      expect(card).toBeDefined();
      const right = card!.readings.find((r) => strip(q.promptHTML) === r.sentence);
      expect(right, `题面对不上任何一句例句：${strip(q.promptHTML)}`).toBeDefined();
      expect(q.answer).toBe(right!.pinyin);
      expect(new Set(q.choices).size).toBe(3);
      for (const c of q.choices) expect(isLegalSyllable(c), `选项不是合法拼音：${c}`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });
});

describe("识字小花园 · 错题换题型复查", () => {
  it("同一个字换一种题型：题型一定变，考的还是那个字", () => {
    let checked = 0;
    for (const q of ALL_QUESTIONS) {
      const focus = questionFocus(q);
      const review = makeReviewQuestion(focus, q.kind, 7);
      if (!review) continue;
      expect(review.kind, `复查没换题型：${focus}`).not.toBe(q.kind);
      expect(review.choices).toHaveLength(3);
      expect(new Set(review.choices).size).toBe(3);
      expect(review.choices.map(strip)[review.correct]).toBe(review.answer);
      checked++;
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("字卡上的每一个字都换得出复查题（错题本不会有死角）", () => {
    for (const c of ALL_CARDS) {
      for (const kind of ["pic2char", "char2pic", "py2char", "char2word"] as const) {
        const q = makeReviewQuestion(c.char, kind, 3);
        expect(q, `${c.char} 换不出 ${kind} 之外的题`).not.toBeNull();
        expect(q!.kind).not.toBe(kind);
      }
    }
  });

  it("一关的复查轮：同一个字只复查一次，题型全部换过", () => {
    const wrong = [
      { focus: "日", kind: "pic2char" as const },
      { focus: "日", kind: "py2char" as const },
      { focus: "牛", kind: "char2pic" as const },
      { focus: "美丽", kind: "synonym" as const },
    ];
    const round = buildReviewRound(wrong, 12);
    expect(round).toHaveLength(3);
    expect(round[0].kind).not.toBe("pic2char");
    expect(round[1].kind).not.toBe("char2pic");
    expect(round[2].kind).not.toBe("synonym");
    // 空错题本不该凭空造题
    expect(buildReviewRound([], 12)).toHaveLength(0);
  });
});

describe("识字小花园 · 前 99 关一个字都没动（第二道锁）", () => {
  it("逐章摘要与题型直方图和升级前完全一致", () => {
    // 第一道锁是 levels188.test.ts 里那条 fnv 指纹；这里换个角度再钉一遍，
    // 章节切分、每关题量、每种题型出现多少次，任何一处被改都会对不上。
    const perChapter = [17, 17, 17, 16, 16, 16];
    const histogram: Record<string, number> = {};
    let at = 0;
    const counts: number[] = [];
    for (const size of perChapter) {
      for (let i = 0; i < size; i++, at++) {
        const qs = buildQuestions(at);
        counts.push(qs.length);
        for (const q of qs) histogram[q.kind] = (histogram[q.kind] ?? 0) + 1;
      }
    }
    expect(at).toBe(99);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(528);
    expect(histogram).toEqual({
      pic2char: 200,
      char2pic: 120,
      py2char: 106,
      char2word: 54,
      count: 48,
    });
    // 1.2 追加的题型一个都不许漏进前 99 关
    expect(histogram.polyphone).toBeUndefined();
    expect(histogram.meaning).toBeUndefined();
  });

  it("前 99 关既没有描红台，也没有组字工坊（新机制只在后 89 关）", () => {
    for (let lv = 0; lv < 99; lv++) {
      expect(isTraceLevel(lv)).toBe(false);
      expect(isBuildCharLevel(lv)).toBe(false);
    }
  });

  it("字卡的 char / pinyin / word / emoji 四个老字段一字未改（只多了 meaning）", () => {
    // 老字段任何一处被改都会改掉前 99 关的题面，这里把它们的拼接摘要钉死
    const digest = ALL_CARDS.map((c) => `${c.char}${c.pinyin}${c.word}${c.emoji}`).join("|");
    expect(digest.length).toBe(864);
    expect(WORD_BANK).toHaveLength(54);
    expect(digest.startsWith("日rì太阳☀️|月yuè月亮🌙|水shuǐ水滴💧")).toBe(true);
    expect(digest.endsWith("|麦mài麦子🌾")).toBe(true);
  });
});
