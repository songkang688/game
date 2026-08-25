import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeQuestionFrom,
  makeReviewQuestion,
  makeWordQuestion,
  WORD_BANK,
  WORD_LEVELS,
} from "./logic";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("三座花园字库：每关至少 18 字，总量至少 48 字（扩大 3 倍）", () => {
  assert.equal(WORD_LEVELS.length, 3);
  for (const lv of WORD_LEVELS) {
    assert.ok(lv.cards.length >= 18, `${lv.name} 字卡太少: ${lv.cards.length}`);
    assert.ok(lv.name.length > 0 && lv.desc.length > 0);
  }
  assert.ok(WORD_BANK.length >= 48, `总字库应至少 48: ${WORD_BANK.length}`);
});

test("字库卡片字段齐全且汉字不重复", () => {
  const chars = new Set(WORD_BANK.map((c) => c.char));
  assert.equal(chars.size, WORD_BANK.length);
  for (const c of WORD_BANK) {
    assert.ok(c.char.length === 1, `应为单字: ${c.char}`);
    assert.ok(c.pinyin.length > 0 && c.word.length > 0 && c.emoji.length > 0);
  }
});

test("makeWordQuestion: 300 道题选项合法", () => {
  const rand = seeded(11);
  for (let i = 0; i < 300; i++) {
    const q = makeWordQuestion(rand);
    assert.equal(q.choices.length, 3);
    assert.equal(new Set(q.choices.map((c) => c.char)).size, 3, "候选字必须互不相同");
    assert.equal(q.choices[q.answerIndex].char, q.target.char, "answerIndex 必须指向正确字");
  }
});

test("makeQuestionFrom: 目标与干扰项都来自本关字库", () => {
  const rand = seeded(17);
  for (const lv of WORD_LEVELS) {
    const pool = new Set(lv.cards.map((c) => c.char));
    for (let i = 0; i < 100; i++) {
      const q = makeQuestionFrom(lv.cards, rand);
      for (const c of q.choices) {
        assert.ok(pool.has(c.char), `候选字应来自 ${lv.name}: ${c.char}`);
      }
    }
  }
});

test("makeQuestionFrom: 尊重 exclude 列表", () => {
  const rand = seeded(23);
  const exclude = ["日", "月", "水"];
  for (let i = 0; i < 200; i++) {
    const q = makeQuestionFrom(WORD_LEVELS[0].cards, rand, exclude);
    assert.ok(!exclude.includes(q.target.char), `不应出被排除的字: ${q.target.char}`);
  }
});

test("makeQuestionFrom: 全部排除时也能出题（兜底不崩溃）", () => {
  const rand = seeded(5);
  const all = WORD_LEVELS[0].cards.map((c) => c.char);
  const q = makeQuestionFrom(WORD_LEVELS[0].cards, rand, all);
  assert.ok(q.target.char.length === 1);
});

test("makeReviewQuestion: 指定字必在候选中且为正确答案", () => {
  const rand = seeded(31);
  for (let i = 0; i < 100; i++) {
    const card = WORD_BANK[i % WORD_BANK.length];
    const q = makeReviewQuestion(card, rand);
    assert.equal(q.target.char, card.char);
    assert.equal(q.choices[q.answerIndex].char, card.char);
    assert.equal(new Set(q.choices.map((c) => c.char)).size, 3);
  }
});
