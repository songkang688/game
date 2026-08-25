import { test } from "vitest";
import assert from "node:assert/strict";
import {
  INITIALS,
  LOOKALIKE_GROUPS,
  makePinyinQuestion,
  makeQuestionForStage,
  makeSyllableQuestion,
  makeToneQuestion,
  SYLLABLE_CARDS,
  TONE_MARKS,
  VOWELS,
} from "./logic";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("题库扩容：声母 23 个、韵母 24 个、图卡至少 16 张", () => {
  assert.equal(INITIALS.length, 23);
  assert.equal(VOWELS.length, 24);
  assert.ok(SYLLABLE_CARDS.length >= 16);
  assert.equal(new Set(INITIALS).size, INITIALS.length);
  assert.equal(new Set(VOWELS).size, VOWELS.length);
  assert.equal(new Set(SYLLABLE_CARDS.map((c) => c.pinyin)).size, SYLLABLE_CARDS.length);
  assert.ok(LOOKALIKE_GROUPS.length >= 10);
});

test("makePinyinQuestion: 500 道题选项合法且答案正确", () => {
  const rand = seeded(42);
  for (let i = 0; i < 500; i++) {
    const q = makePinyinQuestion(rand);
    assert.equal(q.choices.length, 3);
    assert.equal(new Set(q.choices).size, 3, "候选必须互不相同");
    const answer = q.choices[q.answerIndex];
    if (q.kind === "vowel") {
      assert.ok(VOWELS.includes(answer), `韵母题答案应是韵母: ${answer}`);
      for (let c = 0; c < q.choices.length; c++) {
        if (c !== q.answerIndex) assert.ok(INITIALS.includes(q.choices[c]));
      }
    } else if (q.kind === "initial") {
      assert.ok(INITIALS.includes(answer), `声母题答案应是声母: ${answer}`);
    } else if (q.kind === "match") {
      assert.equal(answer, q.display, "找相同题答案必须与车头一致");
    }
  }
});

test("makeToneQuestion: 300 道题声调正确", () => {
  const rand = seeded(7);
  for (let i = 0; i < 300; i++) {
    const q = makeToneQuestion(rand);
    assert.equal(q.kind, "tone");
    assert.equal(new Set(q.choices).size, 3);
    const answer = q.choices[q.answerIndex];
    const m = q.prompt.match(/「(.+)」的(第.声)/);
    assert.ok(m, `提示语格式不对: ${q.prompt}`);
    const base = m![1];
    const toneName = m![2];
    const forms = TONE_MARKS[base];
    assert.ok(forms, `未知的基础字母: ${base}`);
    const toneIdx = ["第一声", "第二声", "第三声", "第四声"].indexOf(toneName);
    assert.equal(answer, forms[toneIdx], `答案应是 ${forms[toneIdx]}: ${answer}`);
  }
});

test("makeSyllableQuestion: 300 道题图与音节匹配", () => {
  const rand = seeded(99);
  for (let i = 0; i < 300; i++) {
    const q = makeSyllableQuestion(rand);
    assert.equal(q.kind, "syllable");
    assert.equal(new Set(q.choices).size, 3);
    const card = SYLLABLE_CARDS.find((c) => c.emoji === q.display);
    assert.ok(card, `图卡不存在: ${q.display}`);
    assert.equal(q.choices[q.answerIndex], card!.pinyin);
  }
});

test("makeQuestionForStage: 各站题型符合设计", () => {
  const rand = seeded(5);
  for (let i = 0; i < 200; i++) {
    const q1 = makeQuestionForStage(1, rand);
    assert.ok(q1.kind === "vowel" || q1.kind === "initial", `第 1 站题型: ${q1.kind}`);
    const q2 = makeQuestionForStage(2, rand);
    assert.ok(q2.kind === "match" || q2.kind === "tone", `第 2 站题型: ${q2.kind}`);
    const q3 = makeQuestionForStage(3, rand);
    assert.ok(
      q3.kind === "syllable" || q3.kind === "tone" || q3.kind === "match",
      `第 3 站题型: ${q3.kind}`
    );
  }
});
