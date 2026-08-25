import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWordQuestion, WORD_BANK } from "./logic";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("字库卡片字段齐全且汉字不重复", () => {
  assert.ok(WORD_BANK.length >= 10);
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

test("makeWordQuestion: 尊重 exclude 列表", () => {
  const rand = seeded(23);
  const exclude = ["日", "月", "水"];
  for (let i = 0; i < 200; i++) {
    const q = makeWordQuestion(rand, exclude);
    assert.ok(!exclude.includes(q.target.char), `不应出被排除的字: ${q.target.char}`);
  }
});

test("makeWordQuestion: 全部排除时也能出题（兜底不崩溃）", () => {
  const rand = seeded(5);
  const all = WORD_BANK.map((c) => c.char);
  const q = makeWordQuestion(rand, all);
  assert.ok(q.target.char.length === 1);
});
