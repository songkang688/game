import { test } from "node:test";
import assert from "node:assert/strict";
import { INITIALS, LOOKALIKE_GROUPS, makePinyinQuestion, VOWELS } from "./logic";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("声母韵母表没有重叠", () => {
  for (const v of VOWELS) assert.ok(!INITIALS.includes(v), `${v} 不能同时是声母`);
});

test("makePinyinQuestion: 500 道题合法", () => {
  const rand = seeded(88);
  const kinds = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const q = makePinyinQuestion(rand);
    kinds.add(q.kind);
    assert.equal(q.choices.length, 3);
    assert.equal(new Set(q.choices).size, 3, "候选必须互不相同");
    assert.ok(q.answerIndex >= 0 && q.answerIndex < 3);
    const answer = q.choices[q.answerIndex];

    if (q.kind === "vowel") {
      assert.ok(VOWELS.includes(answer), `正确答案应是韵母: ${answer}`);
      const vowelCount = q.choices.filter((c) => VOWELS.includes(c)).length;
      assert.equal(vowelCount, 1, "韵母题的候选里只能有一个韵母");
    } else if (q.kind === "initial") {
      assert.ok(INITIALS.includes(answer), `正确答案应是声母: ${answer}`);
      const initialCount = q.choices.filter((c) => INITIALS.includes(c)).length;
      assert.equal(initialCount, 1, "声母题的候选里只能有一个声母");
    } else {
      assert.equal(answer, q.display, "找相同题的答案必须等于车头字母");
      assert.equal(q.choices.filter((c) => c === q.display).length, 1, "候选里只能有一个和车头相同");
      assert.ok(
        LOOKALIKE_GROUPS.some((g) => g.includes(q.display)),
        "车头字母应来自易混分组"
      );
    }
  }
  assert.deepEqual([...kinds].sort(), ["initial", "match", "vowel"], "三种题型都应出现");
});
