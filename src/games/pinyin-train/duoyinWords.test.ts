/**
 * 拼音小火车 · 多音词题的词本身必须定得了读音（窗口5 第2轮 档C · W5R2-C-10 / C-12）。
 *
 * 测试员抓到两道**有两个正确答案**的题：
 *   · L137「好学」里的「好」读什么？答 `hào`——可 `hǎo xué`（容易学）同样标准，
 *     而 `hǎo` 就摆在选项里当干扰项；
 *   · L167「同行」里的「行」读什么？答 `háng`——可 `tóng xíng`（结伴走）同样标准，
 *     `xíng` 也在选项里。
 *
 * 根在题型本身：`qDuoyin()` 只把词摆出来问读音，词就是**唯一的上下文**。
 * 所以词表里凡是两读都标准的词，这题必然有两个正确答案——
 * 不是教错，是题目缺上下文（测试员判一般）。挑词的时候就得把这类词滤掉。
 *
 * 顺带一并换掉 C-12 的方言词「困觉」（现汉标〈方〉），
 * 以及同一类毛病的「转动」（zhuàn dòng 打转 / zhuǎn dòng 挪动，现汉两读都收）。
 *
 * 「意思对了读音就对了」是 `pick-all` 那一关写在提示里的话（`levels.ts`），
 * 词表里留着两读都对的词，这句话就成了空头支票。
 */
import { describe, expect, it } from "vitest";

import { DUOYIN_CARDS } from "./logic";

/**
 * 词本身定不了读音的词：两个读音都标准，摆出来问「读什么」必有两解。
 * 每加一个词都得写清楚两读各是什么意思，不然下一个人分不出是真两读还是手滑。
 */
const AMBIGUOUS: ReadonlyArray<readonly [string, string]> = [
  ["同行", "tóng háng 同业 / tóng xíng 结伴走"],
  ["好学", "hào xué 爱学 / hǎo xué 容易学"],
  ["转动", "zhuàn dòng 打转 / zhuǎn dòng 挪动"],
  ["一行", "yī háng 一行字 / yī xíng 一行人"],
  ["重重", "chóng chóng 重重叠叠 / zhòng zhòng 重重地摔"],
];

/** 方言词：读音本身没错，但普通话不这么说（现汉标〈方〉） */
const DIALECT: readonly string[] = ["困觉", "晓得", "作兴", "物事"];

const ALL_WORDS = DUOYIN_CARDS.flatMap((c) => c.readings.flatMap((r) => r.words));

describe("拼音小火车 · 多音词题的词得定得了音（W5R2-C-10）", () => {
  it("词表里不许再出现两读都标准的词", () => {
    for (const [word, why] of AMBIGUOUS) {
      expect(ALL_WORDS, `「${word}」两读都标准（${why}），摆出来问读什么必有两解`).not.toContain(word);
    }
  });

  it("词表里不许出现方言词（W5R2-C-12）", () => {
    for (const word of DIALECT) {
      expect(ALL_WORDS, `「${word}」是方言词，普通话不这么说`).not.toContain(word);
    }
  });

  it("同一个字的两个读音之间没有共用词——共用了就等于两个答案", () => {
    for (const card of DUOYIN_CARDS) {
      const seen = new Map<string, string>();
      for (const r of card.readings) {
        for (const w of r.words) {
          const prev = seen.get(w);
          expect(prev, `「${card.char}」的「${w}」同时挂在 ${prev} 和 ${r.pinyin} 下`).toBeUndefined();
          seen.set(w, r.pinyin);
        }
      }
    }
  });

  it("换上来的词还是那个字的词，条数也没少", () => {
    const byChar = new Map(DUOYIN_CARDS.map((c) => [c.char, c]));
    for (const [char, pinyin, word] of [
      ["行", "háng", "行列"],
      ["好", "hào", "好动"],
      ["觉", "jiào", "懒觉"],
      ["转", "zhuàn", "转盘"],
    ] as const) {
      const reading = byChar.get(char)?.readings.find((r) => r.pinyin === pinyin);
      expect(reading, `找不到「${char}」的 ${pinyin}`).toBeDefined();
      expect(reading!.words).toContain(word);
      expect(reading!.words).toHaveLength(3);
      for (const w of reading!.words) expect(w).toContain(char);
    }
  });

  it("例句仍旧一句一个字、读音由句意定死", () => {
    for (const card of DUOYIN_CARDS) {
      for (const r of card.readings) {
        expect(r.sentence).toContain(card.char);
        expect(r.words[0]).toContain(card.char);
      }
    }
  });
});
