// 窗口 4 · QA 档C · 第 1 轮学习优化员:贪吃毛毛虫的落地改进覆盖测试。
//
// L1-05 点心样子从 index.ts 里那句就地随机,改成 snake12.ts 的 nextSnackEmoji:
//       一是不许和上一颗重样,二是从此可测。
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { SNACK_EMOJI, nextSnackEmoji } from "./snake12";

describe("档C R1 学习优化 · L1-05 点心不许连着两颗重样", () => {
  it("连出 500 颗,一颗都不会和上一颗撞脸", () => {
    const rand = mulberry32(20260827);
    let prev = SNACK_EMOJI[0];
    for (let i = 0; i < 500; i++) {
      const next = nextSnackEmoji(prev, rand);
      expect(SNACK_EMOJI, `第 ${i} 颗冒出了名单外的 ${next}`).toContain(next);
      expect(next, `第 ${i} 颗和上一颗重样了`).not.toBe(prev);
      prev = next;
    }
  });

  it("五种点心都出得来,谁也不会被随机数落下", () => {
    const rand = mulberry32(7);
    const seen = new Set<string>();
    let prev = SNACK_EMOJI[0];
    for (let i = 0; i < 400; i++) {
      prev = nextSnackEmoji(prev, rand);
      seen.add(prev);
    }
    expect(seen.size).toBe(SNACK_EMOJI.length);
  });

  it("上一颗是星星果 ⭐ 或剪刀果 ✂️ 时,五种普通点心一个都不排除", () => {
    for (const prev of ["⭐", "✂️", ""]) {
      const seen = new Set<string>();
      const rand = mulberry32(31);
      for (let i = 0; i < 200; i++) seen.add(nextSnackEmoji(prev, rand));
      expect(seen.size, `上一颗是 ${prev} 时只出得来 ${seen.size} 种`).toBe(SNACK_EMOJI.length);
    }
  });

  it("随机数退化成常数 0 或 0.999… 也照样给出合法的一颗", () => {
    for (const v of [0, 0.5, 0.999999, 1]) {
      const e = nextSnackEmoji(SNACK_EMOJI[0], () => v);
      expect(SNACK_EMOJI).toContain(e);
      expect(e).not.toBe(SNACK_EMOJI[0]);
    }
  });

  it("点心名单本身是纯图案,没有掺进星星果和剪刀果", () => {
    expect(SNACK_EMOJI.length).toBeGreaterThanOrEqual(4);
    expect(new Set(SNACK_EMOJI).size).toBe(SNACK_EMOJI.length);
    expect(SNACK_EMOJI).not.toContain("⭐");
    expect(SNACK_EMOJI).not.toContain("✂️");
  });
});
