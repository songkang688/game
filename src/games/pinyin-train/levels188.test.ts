// 1.1：拼音小火车 99 → 188 的新章节、新机制与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, indexInChapter, totalSize, TOTAL_LEVELS } from "../level99";
import {
  applyTone,
  DUOYIN_CARDS,
  ERHUA_WORDS,
  NEUTRAL_WORDS,
  PINYIN_SENTENCES,
  SPELL_ONLY_SYLLABLES,
  stripTone,
  TONED_WORDS,
  toneOf,
  WHOLE_READ_SYLLABLES,
} from "./logic";
import {
  buildPickAll,
  buildQuestions,
  CHAPTERS,
  CHAPTER_THEMES,
  isPickAllLevel,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  levelTimeLimitMs,
  questionCount,
  type PickAllTask,
} from "./levels";
import { judgePickAll, pickAllFeedback } from "./pickAll";
import { formatClock, isRushing, TIME_UP_LINE } from "./timed";

/** 前 99 关的「指纹」：任何一处生成参数被改动都会对不上 */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const NEW_LEVELS = Array.from({ length: TOTAL_LEVELS - LEGACY_LEVELS }, (_, i) => LEGACY_LEVELS + i);
const strip = (html: string): string => html.replace(/<[^>]+>/g, "");

describe("拼音小火车 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "单韵母站", "声母站", "双胞胎站", "声调站", "复韵母站", "音节站",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
  });

  it("前 99 关每关的题目一字未改（生成指纹回归）", () => {
    const digest = fnv(JSON.stringify(Array.from({ length: 99 }, (_, i) => buildQuestions(i))));
    expect(digest).toBe("2cac7f2a");
  });

  it("前 99 关既不限时，也没有挑拣车厢（新机制只在末尾追加）", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      expect(levelTimeLimitMs(i)).toBe(0);
      expect(isPickAllLevel(i)).toBe(false);
      expect(questionCount(i)).toBeLessThanOrEqual(7);
    }
  });
});

describe("拼音小火车 · 1.1 新章节", () => {
  it("总关数 188，末尾追加了 4 个全新章节共 89 关", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual(["整体认读快线", "多音字岔道", "轻声儿化坡", "句子注音终点"]);
  });

  it("新章节配色文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
    expect(CHAPTER_THEMES).toHaveLength(CHAPTERS.length);
  });

  it("新题库数据自检：句子注音对得上、多音字例句里真有那个字", () => {
    for (const s of PINYIN_SENTENCES) {
      expect(Array.from(s.text)).toHaveLength(s.syllables.length);
      expect(s.text).not.toMatch(/[A-Za-z]/);
    }
    for (const card of DUOYIN_CARDS) {
      expect(card.readings.length).toBeGreaterThanOrEqual(2);
      const pins = new Set(card.readings.map((r) => r.pinyin));
      expect(pins.size).toBe(card.readings.length);
      for (const r of card.readings) {
        expect(r.sentence).toContain(card.char);
        expect(r.words.length).toBeGreaterThanOrEqual(2);
        for (const w of r.words) expect(w).toContain(card.char);
      }
    }
    for (const w of NEUTRAL_WORDS) {
      expect(Array.from(w.word)).toHaveLength(2);
      expect(toneOf(w.syllables[0])).toBeGreaterThan(0);
      expect(toneOf(w.syllables[1])).toBe(0);
    }
    for (const w of TONED_WORDS) {
      expect(toneOf(w.syllables[0])).toBeGreaterThan(0);
      expect(toneOf(w.syllables[1])).toBeGreaterThan(0);
    }
    for (const w of ERHUA_WORDS) {
      expect(w.erhua.endsWith("r")).toBe(true);
      expect(stripTone(w.erhua)).toBe(`${stripTone(w.base)}r`);
    }
    // 整体认读音节与「要拼读」的干扰音节两个池子不许有交集
    for (const s of SPELL_ONLY_SYLLABLES) expect(WHOLE_READ_SYLLABLES).not.toContain(s);
  });
});

describe("拼音小火车 · 第 100–188 关逐关可解", () => {
  it("答题关：每关 6–9 题、选项唯一、答案就在选项里", () => {
    for (const lv of NEW_LEVELS) {
      if (isPickAllLevel(lv)) continue;
      const qs = buildQuestions(lv);
      expect(qs.length).toBe(questionCount(lv));
      expect(qs.length).toBeGreaterThanOrEqual(6);
      expect(qs.length).toBeLessThanOrEqual(9);
      for (const q of qs) {
        expect(q.choices).toHaveLength(3);
        expect(new Set(q.choices).size).toBe(3);
        expect(q.choices[q.correct]).toBe(q.answer);
        expect((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length).toBeLessThanOrEqual(15);
      }
    }
  });

  it("答题关：每一道题的答案都能从题库反查出来（逐题校验）", () => {
    for (const lv of NEW_LEVELS) {
      if (isPickAllLevel(lv)) continue;
      for (const q of buildQuestions(lv)) {
        if (q.kind === "whole") {
          expect(WHOLE_READ_SYLLABLES).toContain(q.answer);
          for (const c of q.choices) if (c !== q.answer) expect(SPELL_ONLY_SYLLABLES).toContain(c);
        } else if (q.kind === "duoyin") {
          const m = q.ask.match(/「(.+?)」里的「(.+?)」/);
          expect(m).not.toBeNull();
          const card = DUOYIN_CARDS.find((c) => c.char === m![2]);
          expect(card).toBeDefined();
          const reading = card!.readings.find((r) => r.pinyin === q.answer);
          expect(reading).toBeDefined();
          expect(reading!.words).toContain(m![1]);
        } else if (q.kind === "context") {
          const m = q.ask.match(/「(.+?)」读什么/);
          expect(m).not.toBeNull();
          const card = DUOYIN_CARDS.find((c) => c.char === m![1]);
          expect(card).toBeDefined();
          const reading = card!.readings.find((r) => r.pinyin === q.answer);
          expect(reading).toBeDefined();
          expect(strip(q.promptHTML)).toBe(reading!.sentence);
        } else if (q.kind === "neutral") {
          const m = q.ask.match(/「(.+?)」后面/);
          expect(m).not.toBeNull();
          const card = NEUTRAL_WORDS.find((w) => w.word === m![1]);
          expect(card).toBeDefined();
          expect(q.answer).toBe(card!.syllables[1]);
          expect(toneOf(q.answer)).toBe(0);
        } else if (q.kind === "erhua") {
          const m = q.ask.match(/「(.+?)」连起来/);
          expect(m).not.toBeNull();
          const card = ERHUA_WORDS.find((w) => w.word === m![1]);
          expect(card).toBeDefined();
          expect(q.answer).toBe(card!.erhua);
        } else if (q.kind === "sentence") {
          const text = strip(q.promptHTML);
          const s = PINYIN_SENTENCES.find((x) => x.text === text);
          expect(s).toBeDefined();
          const m = q.ask.match(/「(.+?)」读什么/);
          expect(m).not.toBeNull();
          const hits = Array.from(s!.text)
            .map((c, i) => (c === m![1] ? s!.syllables[i] : null))
            .filter((x): x is string => x !== null);
          expect(hits).toContain(q.answer);
        }
      }
    }
  });

  it("挑拣车厢关：每章都有，且答案集合唯一可判定", () => {
    const perChapter = new Map<number, number>();
    for (const lv of NEW_LEVELS) {
      if (!isPickAllLevel(lv)) continue;
      const ci = chapterOf(CHAPTERS, lv);
      perChapter.set(ci, (perChapter.get(ci) ?? 0) + 1);
      const task: PickAllTask = buildPickAll(lv);
      expect(new Set(task.chips).size).toBe(task.chips.length);
      expect(task.correct.length).toBeGreaterThanOrEqual(2);
      expect(task.chips.length).toBeGreaterThan(task.correct.length);
      for (const c of task.correct) expect(task.chips).toContain(c);
      expect(task.maxWrong).toBeGreaterThanOrEqual(1);
      expect(task.title.length).toBeGreaterThan(0);
      expect(task.hint.length).toBeGreaterThan(0);
    }
    for (const ci of [6, 7, 8, 9]) {
      expect(perChapter.get(ci) ?? 0).toBeGreaterThanOrEqual(4);
    }
  });

  it("挑拣车厢关：判断标准和卡片对得上（挑不出第二种答案）", () => {
    const wrong = new Set(TONED_WORDS.map((w) => w.word));
    for (const lv of NEW_LEVELS) {
      if (!isPickAllLevel(lv)) continue;
      const task = buildPickAll(lv);
      const others = task.chips.filter((c) => !task.correct.includes(c));
      expect(others.length).toBeGreaterThanOrEqual(2);
      if (task.rule === "whole") {
        for (const c of task.correct) expect(WHOLE_READ_SYLLABLES).toContain(c);
        for (const c of others) expect(WHOLE_READ_SYLLABLES).not.toContain(c);
      } else if (task.rule === "neutral") {
        for (const c of task.correct) expect(NEUTRAL_WORDS.map((w) => w.word)).toContain(c);
        for (const c of others) expect(wrong.has(c)).toBe(true);
      } else if (task.rule === "erhua") {
        for (const c of task.correct) expect(ERHUA_WORDS.map((w) => w.word)).toContain(c);
        for (const c of others) expect(wrong.has(c)).toBe(true);
      } else if (task.rule === "reading") {
        const m = task.title.match(/「(.+?)」读 (\S+) 的词/);
        expect(m).not.toBeNull();
        const card = DUOYIN_CARDS.find((c) => c.char === m![1]);
        expect(card).toBeDefined();
        const reading = card!.readings.find((r) => r.pinyin === m![2]);
        expect(reading).toBeDefined();
        for (const c of task.correct) expect(reading!.words).toContain(c);
        for (const c of others) expect(reading!.words).not.toContain(c);
      } else {
        for (const chip of task.chips) {
          const py = chip.split(" ")[1];
          expect(py).toBeTruthy();
          expect(task.correct.includes(chip)).toBe(toneOf(py) === 3);
        }
      }
    }
  });

  it("第 100–188 关重玩不换题（确定性生成）", () => {
    for (const lv of [99, 120, 140, 165, 187]) {
      expect(JSON.stringify(buildQuestions(lv))).toBe(JSON.stringify(buildQuestions(lv)));
      expect(JSON.stringify(buildPickAll(lv))).toBe(JSON.stringify(buildPickAll(lv)));
    }
  });

  it("难度确实往上走：新关题量比 1.0 末关更多、题型更杂", () => {
    // 新章节的起步题量就比 1.0 每章的起步题量多，末关更是拉满
    expect(questionCount(99)).toBeGreaterThan(questionCount(0));
    expect(questionCount(187)).toBeGreaterThan(questionCount(98));
    const oldKinds = new Set(Array.from({ length: 99 }, (_, i) => buildQuestions(i)).flat().map((q) => q.kind));
    const newKinds = new Set(NEW_LEVELS.filter((l) => !isPickAllLevel(l)).flatMap((l) => buildQuestions(l)).map((q) => q.kind));
    for (const k of ["whole", "duoyin", "context", "neutral", "erhua", "sentence"]) {
      expect(newKinds.has(k as never)).toBe(true);
      expect(oldKinds.has(k as never)).toBe(false);
    }
  });
});

describe("拼音小火车 · 新机制纯逻辑", () => {
  it("标调 / 去调 / 认调三个函数互相自洽", () => {
    expect(applyTone("ma", 1)).toBe("mā");
    expect(applyTone("hao", 3)).toBe("hǎo");
    expect(applyTone("liu", 2)).toBe("liú");
    expect(applyTone("gui", 4)).toBe("guì");
    expect(applyTone("lüe", 4)).toBe("lüè");
    expect(applyTone("zi", 0)).toBe("zi");
    for (const base of ["ma", "hao", "liu", "gui", "wanr", "xiang", "nü"]) {
      for (const tone of [1, 2, 3, 4]) {
        const toned = applyTone(base, tone);
        expect(toneOf(toned)).toBe(tone);
        expect(stripTone(toned)).toBe(base);
      }
    }
    expect(toneOf("zi")).toBe(0);
    expect(stripTone("shàng")).toBe("shang");
  });

  it("挑拣车厢的判分：漏挑、多挑、全对分得清清楚楚", () => {
    const want = ["zhi", "chi", "yu"];
    expect(judgePickAll(["zhi", "chi", "yu"], want)).toEqual({ missing: 0, extra: 0, ok: true });
    expect(judgePickAll(["zhi", "chi"], want)).toEqual({ missing: 1, extra: 0, ok: false });
    expect(judgePickAll(["zhi", "chi", "yu", "zha"], want)).toEqual({ missing: 0, extra: 1, ok: false });
    expect(judgePickAll(["zha"], want)).toEqual({ missing: 3, extra: 1, ok: false });
    expect(judgePickAll([], want).ok).toBe(false);
  });

  it("挑拣车厢的反馈只报差多少、绝不批评孩子", () => {
    const lines = [
      pickAllFeedback({ missing: 0, extra: 0, ok: true }),
      pickAllFeedback({ missing: 2, extra: 0, ok: false }),
      pickAllFeedback({ missing: 0, extra: 2, ok: false }),
      pickAllFeedback({ missing: 1, extra: 1, ok: false }),
    ];
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(0);
      expect(line).not.toMatch(/错|笨|差劲|不行/);
    }
    expect(TIME_UP_LINE).not.toMatch(/慢|笨|不行/);
  });

  it("限时特快：前两站不限时，后三站逐关收紧但不过分", () => {
    for (let lv = 99; lv < 121; lv++) expect(levelTimeLimitMs(lv)).toBe(0);
    for (const lv of [121, 143, 166, 187]) {
      expect(levelTimeLimitMs(lv)).toBeGreaterThanOrEqual(90000);
      expect(levelTimeLimitMs(lv)).toBeLessThanOrEqual(180000);
    }
    // 同一章越往后时间越紧
    const ci = chapterOf(CHAPTERS, 130);
    const first = 121 + 0;
    expect(levelTimeLimitMs(first)).toBeGreaterThan(levelTimeLimitMs(first + CHAPTERS[ci].size - 1));
    expect(indexInChapter(CHAPTERS, first)).toBe(0);
  });

  it("倒计时显示：分秒好读，最后两成时间进入冲刺提醒", () => {
    expect(formatClock(180000)).toBe("3:00");
    expect(formatClock(65000)).toBe("1:05");
    expect(formatClock(9000)).toBe("0:09");
    expect(formatClock(-500)).toBe("0:00");
    expect(isRushing(100000, 180000)).toBe(false);
    expect(isRushing(20000, 180000)).toBe(true);
    expect(isRushing(5000, 0)).toBe(false);
  });
});
