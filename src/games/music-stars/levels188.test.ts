// 1.1：音乐星星 99 → 188 的新音乐会、新玩法与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, totalSize, TOTAL_LEVELS } from "../level99";
import {
  buildDuets,
  buildIntervals,
  buildMelodies,
  buildRhythms,
  buildScores,
  CHAPTERS,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  LEVELS,
  type MusicMode,
} from "./levels";
import {
  intervalLabel,
  makeChords,
  makeIntervalPair,
  makeRhythm,
  SCORE_DIGITS,
  toScore,
} from "./logic";
import { beatMs, modeIntro } from "./advanced";

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

/** 关卡按新玩法分组，便于逐关校验 */
function levelsOf(mode: MusicMode): number[] {
  return NEW_LEVELS.filter((lv) => LEVELS[lv].mode === mode);
}

describe("音乐星星 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "三星广场", "四星舞台", "五星剧院", "回声森林", "闪电音符", "星光音乐会",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("前 99 关每关参数一笔未改（生成指纹回归）", () => {
    const digest = fnv(JSON.stringify(LEVELS.slice(0, 99)));
    expect(digest).toBe("de52474f");
  });

  it("前 99 关的旋律一个音都没变（旋律指纹回归）", () => {
    const digest = fnv(JSON.stringify(Array.from({ length: 99 }, (_, i) => buildMelodies(i))));
    expect(digest).toBe("71ee0837");
  });

  it("前 99 关一律是 1.0 的跟弹玩法，不带任何新字段", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      expect(LEVELS[i].mode).toBeUndefined();
    }
  });
});

describe("音乐星星 · 1.1 新音乐会", () => {
  it("总关数 188，末尾追加了 4 场全新音乐会共 89 关", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual([
      "节奏鼓点坡", "音程听辨馆", "双声部合奏厅", "简谱视奏台",
    ]);
  });

  it("新音乐会文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
    for (const mode of ["rhythm", "interval", "duet", "score"] as const) {
      expect(modeIntro(mode)).not.toMatch(/[A-Za-z]/);
      expect(modeIntro(mode).length).toBeGreaterThanOrEqual(10);
    }
  });

  it("四场新音乐会各玩各的，玩法一个都不重样", () => {
    expect(LEVELS[99].mode).toBe("rhythm");
    expect(LEVELS[121].mode).toBe("interval");
    expect(LEVELS[143].mode).toBe("duet");
    expect(LEVELS[166].mode).toBe("score");
    expect(LEVELS[187].mode).toBe("score");
    expect(new Set(NEW_LEVELS.map((lv) => LEVELS[lv].mode)).size).toBe(4);
    for (const lv of NEW_LEVELS) {
      expect(LEVELS[lv].mode).toBeDefined();
      expect(LEVELS[lv].theme).toBe(chapterOf(CHAPTERS, lv));
    }
  });

  it("第 100–188 关每关配置都合法：星星数、乐句长度、容错都在谱上", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      expect(cfg.rounds).toBeGreaterThanOrEqual(2);
      expect(cfg.rounds).toBeLessThanOrEqual(6);
      expect(cfg.seqLen).toBeGreaterThanOrEqual(2);
      expect(cfg.seqLen).toBeLessThanOrEqual(10);
      expect(cfg.starCount).toBeGreaterThanOrEqual(2);
      expect(cfg.starCount).toBeLessThanOrEqual(5);
      expect(cfg.noteMs).toBeGreaterThanOrEqual(380);
      expect(cfg.maxMiss).toBeGreaterThanOrEqual(3);
      expect(cfg.replays).toBeGreaterThanOrEqual(-1);
    }
  });
});

describe("音乐星星 · 第 100–188 关逐关可通关", () => {
  it("节奏关：每句长短音都敲得出来，且长短都有、不会连着四个一样", () => {
    const list = levelsOf("rhythm");
    expect(list.length).toBeGreaterThanOrEqual(20);
    for (const lv of list) {
      const cfg = LEVELS[lv];
      const rounds = buildRhythms(lv);
      expect(rounds).toHaveLength(cfg.rounds);
      for (const pattern of rounds) {
        expect(pattern).toHaveLength(cfg.seqLen);
        expect(pattern.includes(0)).toBe(true);
        expect(pattern.includes(1)).toBe(true);
        for (const v of pattern) expect([0, 1]).toContain(v);
        for (let i = 3; i < pattern.length; i++) {
          const same = pattern[i] === pattern[i - 1] && pattern[i] === pattern[i - 2]
            && pattern[i] === pattern[i - 3];
          expect(same).toBe(false);
        }
      }
    }
  });

  it("音程关：每题都有唯一正确选项，答案就是那两个音的真实关系", () => {
    const list = levelsOf("interval");
    expect(list.length).toBeGreaterThanOrEqual(20);
    for (const lv of list) {
      const cfg = LEVELS[lv];
      const rounds = buildIntervals(lv);
      expect(rounds).toHaveLength(cfg.rounds);
      for (const q of rounds) {
        expect(q.a).not.toBe(q.b);
        expect(q.a).toBeGreaterThanOrEqual(0);
        expect(q.a).toBeLessThan(cfg.starCount);
        expect(q.b).toBeGreaterThanOrEqual(0);
        expect(q.b).toBeLessThan(cfg.starCount);
        expect(Math.abs(q.a - q.b)).toBeLessThanOrEqual(cfg.maxJump);
        expect(q.choices).toHaveLength(3);
        expect(new Set(q.choices).size).toBe(3);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.choices[q.correct]).toBe(intervalLabel(q.a, q.b));
        // 干扰项必须真的是错的，不能和正确答案说同一件事
        q.choices.forEach((c, i) => {
          if (i !== q.correct) expect(c).not.toBe(intervalLabel(q.a, q.b));
        });
      }
    }
  });

  it("双声部关：每拍两颗不同星星，相邻两拍不会一模一样", () => {
    const list = levelsOf("duet");
    expect(list.length).toBeGreaterThanOrEqual(20);
    for (const lv of list) {
      const cfg = LEVELS[lv];
      const rounds = buildDuets(lv);
      expect(rounds).toHaveLength(cfg.rounds);
      for (const chords of rounds) {
        expect(chords).toHaveLength(cfg.seqLen);
        chords.forEach((chord, i) => {
          expect(chord).toHaveLength(2);
          expect(chord[0]).toBeLessThan(chord[1]);
          for (const n of chord) {
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThan(cfg.starCount);
          }
          const prev = chords[i - 1];
          if (prev) expect(`${prev}`).not.toBe(`${chord}`);
        });
      }
    }
  });

  it("简谱关：谱面音符都在键盘上，数字串和音符一一对上", () => {
    const list = levelsOf("score");
    expect(list.length).toBeGreaterThanOrEqual(20);
    for (const lv of list) {
      const cfg = LEVELS[lv];
      const rounds = buildScores(lv);
      expect(rounds.length).toBe(cfg.rounds + (cfg.finale ? 1 : 0));
      for (const seq of rounds) {
        expect(seq.length).toBeGreaterThanOrEqual(2);
        for (const n of seq) {
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThan(cfg.starCount);
        }
        const digits = toScore(seq).split(" ");
        expect(digits).toHaveLength(seq.length);
        expect(digits).not.toContain("?");
        seq.forEach((n, i) => expect(digits[i]).toBe(String(SCORE_DIGITS[n])));
      }
      // 视奏关没有范奏可听
      expect(cfg.replays).toBe(0);
    }
  });

  it("同一关重玩题目一致（确定性生成）", () => {
    for (const lv of [99, 110, 121, 132, 143, 155, 166, 187]) {
      const mode = LEVELS[lv].mode;
      const build = mode === "rhythm" ? buildRhythms
        : mode === "interval" ? buildIntervals
          : mode === "duet" ? buildDuets
            : buildScores;
      expect(JSON.stringify(build(lv))).toBe(JSON.stringify(build(lv)));
    }
  });

  it("难度往上走：新音乐会更长更快、容错更少", () => {
    expect(LEVELS[187].maxMiss).toBeLessThanOrEqual(LEVELS[0].maxMiss);
    expect(LEVELS[187].seqLen).toBeGreaterThan(LEVELS[0].seqLen);
    expect(LEVELS[187].noteMs).toBeLessThan(LEVELS[0].noteMs);
    // 每场音乐会内部也在往上走：越到后面重听越少
    expect(LEVELS[120].replays).toBeLessThan(0 + 3);
    expect(LEVELS[164].replays).toBeLessThanOrEqual(LEVELS[143].replays);
  });
});

describe("音乐星星 · 新玩法纯逻辑", () => {
  it("节奏型生成：长短都有、长度对、极短输入不炸", () => {
    for (let len = 4; len <= 9; len++) {
      const seq = makeRhythm(len, mockRand(len));
      expect(seq).toHaveLength(len);
      expect(seq.includes(0)).toBe(true);
      expect(seq.includes(1)).toBe(true);
    }
    expect(makeRhythm(0)).toEqual([]);
    expect(makeRhythm(1)).toEqual([0]);
  });

  it("音程文案：往上往下和格数都说得清楚，同音也有说法", () => {
    expect(intervalLabel(0, 2)).toBe("往上 2 格");
    expect(intervalLabel(4, 1)).toBe("往下 3 格");
    expect(intervalLabel(2, 2)).toBe("一样高");
    const [a, b] = makeIntervalPair(5, mockRand(7), 2);
    expect(a).not.toBe(b);
    expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
  });

  it("和弦生成：两个不同音，星星不够时也不会死循环", () => {
    const chords = makeChords(6, 5, mockRand(3));
    expect(chords).toHaveLength(6);
    for (const c of chords) expect(c[0]).toBeLessThan(c[1]);
    expect(makeChords(4, 1)).toEqual([]);
    expect(makeChords(0, 5)).toEqual([]);
  });

  it("简谱数字：五声音阶记成 1 2 3 5 6", () => {
    expect(SCORE_DIGITS).toEqual([1, 2, 3, 5, 6]);
    expect(toScore([0, 1, 2, 3, 4])).toBe("1 2 3 5 6");
    expect(toScore([])).toBe("");
  });

  it("节奏时长：长音明显比短音长，且都是正整数毫秒", () => {
    expect(beatMs(600, true)).toBeGreaterThan(beatMs(600, false));
    for (const base of [420, 540, 620]) {
      for (const long of [true, false]) {
        const ms = beatMs(base, long);
        expect(Number.isInteger(ms)).toBe(true);
        expect(ms).toBeGreaterThan(0);
      }
    }
  });
});

/** 固定种子的小随机数，测试里用来复现同一串题 */
function mockRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
