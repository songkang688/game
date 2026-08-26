// 1.1：识字小花园 99 → 188 的新章节、新机制与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, indexInChapter, totalSize, TOTAL_LEVELS } from "../level99";
import {
  BUILD_CHAR_CARDS,
  CLOZE_CARDS,
  IDIOM_CARDS,
  LOOKALIKE_SETS,
  RADICAL_CARDS,
  SYN_ANT_CARDS,
} from "./logic";
import {
  buildCharTask,
  buildQuestions,
  CHAPTERS,
  CHAPTER_THEMES,
  isBuildCharLevel,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  levelTimeLimitMs,
  questionCount,
} from "./levels";
import { checkStep, isRoundSolvable, stepHint } from "./buildChar";
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

describe("识字小花园 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "青青花园", "萌萌花园", "星星花园", "数字花园", "亲亲花园", "美味花园",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
  });

  it("前 99 关每关的题目一字未改（生成指纹回归）", () => {
    const digest = fnv(JSON.stringify(Array.from({ length: 99 }, (_, i) => buildQuestions(i))));
    expect(digest).toBe("465a6c3b");
  });

  it("前 99 关既不限时，也没有组字工坊（新机制只在末尾追加）", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      expect(levelTimeLimitMs(i)).toBe(0);
      expect(isBuildCharLevel(i)).toBe(false);
      expect(questionCount(i)).toBeLessThanOrEqual(7);
    }
  });
});

describe("识字小花园 · 1.1 新章节", () => {
  it("总关数 188，末尾追加了 5 个全新花园共 89 关", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual([
      "形近字迷宫", "成语花廊", "近反义花海", "句子填空亭", "偏旁推字园",
    ]);
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

  it("新字词库自检：形近字组得成词、成语挖空对得上、近反义不打架", () => {
    const seen = new Set<string>();
    for (const group of LOOKALIKE_SETS) {
      expect(group.length).toBeGreaterThanOrEqual(2);
      for (const item of group) {
        expect(item.char).toHaveLength(1);
        expect(item.word).toContain(item.char);
        expect(item.hint.length).toBeGreaterThanOrEqual(3);
        expect(seen.has(item.char)).toBe(false);
        seen.add(item.char);
      }
    }
    for (const card of IDIOM_CARDS) {
      const chars = Array.from(card.idiom);
      expect(chars).toHaveLength(4);
      expect(card.blank).toBeGreaterThanOrEqual(0);
      expect(card.blank).toBeLessThan(4);
      expect(card.meaning.length).toBeLessThanOrEqual(10);
    }
    for (const card of SYN_ANT_CARDS) {
      expect(card.synonym).not.toBe(card.word);
      expect(card.antonym).not.toBe(card.word);
      expect(card.antonym).not.toBe(card.synonym);
    }
    // 每个填空的答案都能在近反义卡里找到，干扰项才有得挑
    for (const cloze of CLOZE_CARDS) {
      expect(cloze.text).toContain("____");
      expect(SYN_ANT_CARDS.map((c) => c.word)).toContain(cloze.answer);
    }
  });

  it("偏旁与组字数据自检：一个字只归一个偏旁，两半拼起来就是它", () => {
    const owner = new Map<string, string>();
    for (const card of RADICAL_CARDS) {
      expect(card.chars.length).toBeGreaterThanOrEqual(4);
      for (const ch of card.chars) {
        expect(owner.has(ch)).toBe(false);
        owner.set(ch, card.radical);
      }
    }
    for (const card of BUILD_CHAR_CARDS) {
      expect(card.char).toHaveLength(1);
      expect(card.word).toContain(card.char);
      expect(card.radical.length).toBeGreaterThan(0);
      expect(card.part.length).toBeGreaterThan(0);
      expect(card.clue.length).toBeGreaterThanOrEqual(5);
    }
    // 「青」「包」两个部件都被好几个偏旁共用，才撑得起两步推理
    const parts = BUILD_CHAR_CARDS.filter((c) => c.part === "青").map((c) => c.radical);
    expect(new Set(parts).size).toBeGreaterThanOrEqual(4);
  });
});

describe("识字小花园 · 第 100–188 关逐关可解", () => {
  it("答题关：每关 6–9 题、选项唯一、答案就在选项里", () => {
    for (const lv of NEW_LEVELS) {
      if (isBuildCharLevel(lv)) continue;
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

  it("答题关：每一道题的答案都能从字词库反查出来（逐题校验）", () => {
    const allLookalike = LOOKALIKE_SETS.flat();
    for (const lv of NEW_LEVELS) {
      if (isBuildCharLevel(lv)) continue;
      for (const q of buildQuestions(lv)) {
        if (q.kind === "lookalike") {
          const item = allLookalike.find((x) => x.char === q.answer && q.ask.startsWith(x.hint));
          expect(item).toBeDefined();
          expect(strip(q.promptHTML)).toBe(item!.word.replace(item!.char, "□"));
        } else if (q.kind === "idiom") {
          const shown = strip(q.promptHTML);
          const card = IDIOM_CARDS.find(
            (c) => Array.from(c.idiom).map((ch, i) => (i === c.blank ? "□" : ch)).join("") === shown
          );
          expect(card).toBeDefined();
          expect(q.answer).toBe(Array.from(card!.idiom)[card!.blank]);
          expect(q.ask).toContain(card!.meaning);
        } else if (q.kind === "synonym") {
          const card = SYN_ANT_CARDS.find((c) => c.word === strip(q.promptHTML));
          expect(card).toBeDefined();
          expect(q.answer).toBe(card!.synonym);
          expect(q.choices).toContain(card!.antonym);
        } else if (q.kind === "antonym") {
          const card = SYN_ANT_CARDS.find((c) => c.word === strip(q.promptHTML));
          expect(card).toBeDefined();
          expect(q.answer).toBe(card!.antonym);
          expect(q.choices).toContain(card!.synonym);
        } else if (q.kind === "cloze") {
          const card = CLOZE_CARDS.find((c) => c.text === strip(q.promptHTML));
          expect(card).toBeDefined();
          expect(q.answer).toBe(card!.answer);
        } else if (q.kind === "radical") {
          const byTopic = RADICAL_CARDS.find((c) => q.ask.includes(`「${c.topic}」`));
          if (byTopic) {
            expect(byTopic.chars).toContain(q.answer);
            for (const c of q.choices) if (c !== q.answer) expect(byTopic.chars).not.toContain(c);
          } else {
            const byRadical = RADICAL_CARDS.find((c) => c.radical === strip(q.promptHTML));
            expect(byRadical).toBeDefined();
            expect(q.answer).toBe(byRadical!.topic);
          }
        }
      }
    }
  });

  it("组字工坊关：偏旁推字园里至少 8 关，每一轮都拼得出来", () => {
    let count = 0;
    for (const lv of NEW_LEVELS) {
      if (!isBuildCharLevel(lv)) continue;
      count++;
      expect(chapterOf(CHAPTERS, lv)).toBe(CHAPTERS.length - 1);
      const task = buildCharTask(lv);
      expect(task.rounds.length).toBeGreaterThanOrEqual(4);
      expect(task.maxWrong).toBeGreaterThanOrEqual(3);
      const chars = task.rounds.map((r) => r.char);
      expect(new Set(chars).size).toBe(chars.length);
      for (const round of task.rounds) {
        expect(isRoundSolvable(round)).toBe(true);
        expect(round.radicalChoices.length).toBeGreaterThanOrEqual(3);
        expect(round.partChoices.length).toBeGreaterThanOrEqual(3);
        // 两半必须真的来自同一张卡，不然拼出来的不是这个字
        const card = BUILD_CHAR_CARDS.find((c) => c.char === round.char);
        expect(card).toBeDefined();
        expect(round.radical).toBe(card!.radical);
        expect(round.part).toBe(card!.part);
      }
    }
    expect(count).toBeGreaterThanOrEqual(8);
  });

  it("第 100–188 关重玩不换题（确定性生成）", () => {
    for (const lv of [99, 120, 140, 171, 187]) {
      expect(JSON.stringify(buildQuestions(lv))).toBe(JSON.stringify(buildQuestions(lv)));
      expect(JSON.stringify(buildCharTask(lv))).toBe(JSON.stringify(buildCharTask(lv)));
    }
  });

  it("难度确实往上走：新关题量更多、题型全是 1.0 没有的", () => {
    expect(questionCount(99)).toBeGreaterThan(questionCount(0));
    expect(questionCount(187)).toBeGreaterThan(questionCount(98));
    const oldKinds = new Set(Array.from({ length: 99 }, (_, i) => buildQuestions(i)).flat().map((q) => q.kind));
    const newKinds = new Set(
      NEW_LEVELS.filter((l) => !isBuildCharLevel(l)).flatMap((l) => buildQuestions(l)).map((q) => q.kind)
    );
    for (const k of ["lookalike", "idiom", "synonym", "antonym", "cloze", "radical"]) {
      expect(newKinds.has(k as never)).toBe(true);
      expect(oldKinds.has(k as never)).toBe(false);
    }
  });
});

describe("识字小花园 · 新机制纯逻辑", () => {
  it("组字两步判定：偏旁和部件分别判，互不串门", () => {
    const round = buildCharTask(171).rounds[0];
    expect(checkStep(round, "radical", round.radical)).toBe(true);
    expect(checkStep(round, "radical", round.part)).toBe(false);
    expect(checkStep(round, "part", round.part)).toBe(true);
    expect(checkStep(round, "part", round.radical)).toBe(false);
  });

  it("组字关的提示只指方向、不批评孩子", () => {
    const hints = [stepHint("radical", "水流成的一条带子"), stepHint("part", "水流成的一条带子")];
    for (const h of hints) {
      expect(h.length).toBeGreaterThan(0);
      expect(h).not.toMatch(/错|笨|差劲|不行/);
    }
    expect(TIME_UP_LINE).not.toMatch(/慢|笨|不行/);
  });

  it("坏数据能被 isRoundSolvable 挡下来", () => {
    const good = buildCharTask(173).rounds[0];
    expect(isRoundSolvable(good)).toBe(true);
    expect(isRoundSolvable({ ...good, radicalChoices: good.radicalChoices.filter((r) => r !== good.radical) })).toBe(false);
    expect(isRoundSolvable({ ...good, partChoices: [good.part, good.part, good.part] })).toBe(false);
  });

  it("限时花房：前两座新花园不限时，后三座逐关收紧但不过分", () => {
    for (let lv = 99; lv < 135; lv++) expect(levelTimeLimitMs(lv)).toBe(0);
    for (const lv of [135, 153, 171, 187]) {
      expect(levelTimeLimitMs(lv)).toBeGreaterThanOrEqual(90000);
      expect(levelTimeLimitMs(lv)).toBeLessThanOrEqual(180000);
    }
    const first = 135;
    expect(indexInChapter(CHAPTERS, first)).toBe(0);
    expect(chapterOf(CHAPTERS, first)).toBe(8);
    expect(levelTimeLimitMs(first)).toBeGreaterThan(levelTimeLimitMs(first + CHAPTERS[8].size - 1));
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
