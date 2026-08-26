/**
 * 拼音规则纯函数用例（1.2 新增）。
 *
 * 这一份是「教学正确性」的底线：标调位置、ü 去点、y / w 隔音、三拼省写、
 * 整体认读音节表，错一个都是教学事故，所以逐条钉死。
 */
import { describe, expect, it } from "vitest";
import {
  BASE_FINALS,
  TONE_ROWS,
  UMLAUT_DROP_INITIALS,
  UMLAUT_KEEP_INITIALS,
  WHOLE_READ_SYLLABLES,
  dropsUmlautDots,
  isWholeRead,
  markTone,
  markToneAt,
  plainSyllable,
  readTone,
  removeToneMarks,
  restoreUmlaut,
  spell,
  toneMarkPlacedRight,
  toneTargetIndex,
  toneTargetLetter,
  writtenFinal,
  zeroInitialSpelling,
} from "./pinyin";
import { applyTone, INITIALS, SPELL_CARDS, stripTone, toneOf } from "./logic";

describe("拼音小火车 · 标调规则", () => {
  it("有 a 找 a，没 a 找 o 和 e（12 组以上逐个点名）", () => {
    const cases: Array<[string, string]> = [
      ["hao", "a"],
      ["mao", "a"],
      ["bai", "a"],
      ["kuai", "a"],
      ["niao", "a"],
      ["guang", "a"],
      ["yuan", "a"],
      ["gou", "o"],
      ["huo", "o"],
      ["you", "o"],
      ["mei", "e"],
      ["xie", "e"],
      ["xue", "e"],
      ["lüe", "e"],
      ["yue", "e"],
      ["er", "e"],
      ["weng", "e"],
    ];
    for (const [plain, letter] of cases) {
      expect(`${plain}:${toneTargetLetter(plain)}`).toBe(`${plain}:${letter}`);
    }
  });

  it("iu 标在 u 上、ui 标在 i 上（课本单独强调的两条）", () => {
    expect(toneTargetLetter("liu")).toBe("u");
    expect(toneTargetLetter("jiu")).toBe("u");
    expect(toneTargetLetter("xiu")).toBe("u");
    expect(toneTargetLetter("niu")).toBe("u");
    expect(toneTargetLetter("shui")).toBe("i");
    expect(toneTargetLetter("gui")).toBe("i");
    expect(toneTargetLetter("dui")).toBe("i");
    expect(toneTargetLetter("hui")).toBe("i");
    expect(markTone("liu", 2)).toBe("liú");
    expect(markTone("shui", 3)).toBe("shuǐ");
    expect(markTone("gui", 1)).toBe("guī");
    expect(markTone("jiu", 3)).toBe("jiǔ");
  });

  it("只有一个 i / u / ü 时就标在它头上，没有元音时不标", () => {
    expect(markTone("yi", 1)).toBe("yī");
    expect(markTone("wu", 3)).toBe("wǔ");
    expect(markTone("yu", 2)).toBe("yú");
    expect(markTone("nü", 3)).toBe("nǚ");
    expect(markTone("jun", 1)).toBe("jūn");
    expect(markTone("lun", 2)).toBe("lún");
    expect(markTone("ying", 1)).toBe("yīng");
    expect(toneTargetIndex("m")).toBe(-1);
    expect(markTone("m", 2)).toBe("m");
  });

  it("轻声和越界的调值一律原样返回，不会莫名其妙加个调号", () => {
    expect(markTone("zi", 0)).toBe("zi");
    expect(markTone("zi", 5)).toBe("zi");
    expect(markTone("zi", -1)).toBe("zi");
    expect(markTone("zi", 1.5)).toBe("zi");
    expect(markToneAt("hao", 99, 2)).toBe("hao");
    expect(markToneAt("hao", 0, 2)).toBe("hao");
  });

  it("戴调号 / 摘调号 / 认调号三个方向自洽（四声全跑一遍）", () => {
    const plains = ["ma", "hao", "liu", "shui", "xue", "nü", "jun", "yuan", "weng", "er", "zhuo"];
    for (const plain of plains) {
      for (const tone of [1, 2, 3, 4]) {
        const toned = markTone(plain, tone);
        expect(readTone(toned)).toBe(tone);
        expect(removeToneMarks(toned)).toBe(plain);
        expect(toneMarkPlacedRight(toned)).toBe(true);
      }
    }
    expect(readTone("zi")).toBe(0);
    expect(toneMarkPlacedRight("zi")).toBe(true);
  });

  it("调号戴错地方能被认出来（判分靠它）", () => {
    expect(toneMarkPlacedRight("haǒ")).toBe(false);
    expect(toneMarkPlacedRight("shùi")).toBe(false);
    expect(toneMarkPlacedRight("líu")).toBe(false);
    expect(toneMarkPlacedRight("hǎo")).toBe(true);
    expect(toneMarkPlacedRight("shuì")).toBe(true);
  });

  it("六个元音的四声表齐全且互不重样", () => {
    expect(Object.keys(TONE_ROWS)).toEqual(["a", "o", "e", "i", "u", "ü"]);
    const all = Object.values(TONE_ROWS).flat();
    expect(all).toHaveLength(24);
    expect(new Set(all).size).toBe(24);
  });
});

describe("拼音小火车 · ü 的两点", () => {
  it("j q x y 遇 ü 去两点，n l 遇 ü 留着", () => {
    expect(UMLAUT_DROP_INITIALS).toEqual(["j", "q", "x", "y"]);
    for (const ini of UMLAUT_DROP_INITIALS) expect(dropsUmlautDots(ini)).toBe(true);
    for (const ini of UMLAUT_KEEP_INITIALS) expect(dropsUmlautDots(ini)).toBe(false);
    expect(writtenFinal("j", "ü")).toBe("u");
    expect(writtenFinal("q", "üe")).toBe("ue");
    expect(writtenFinal("x", "üan")).toBe("uan");
    expect(writtenFinal("j", "ün")).toBe("un");
    expect(writtenFinal("n", "ü")).toBe("ü");
    expect(writtenFinal("l", "üe")).toBe("üe");
  });

  it("整个音节拼出来：ju / que / xuan / jun 去点，nü / lüe 留点", () => {
    expect(spell("j", "ü", 1)).toBe("jū");
    expect(spell("q", "üe", 4)).toBe("què");
    expect(spell("x", "üan", 2)).toBe("xuán");
    expect(spell("j", "ün", 1)).toBe("jūn");
    expect(spell("n", "ü", 3)).toBe("nǚ");
    expect(spell("l", "ü", 4)).toBe("lǜ");
    expect(spell("l", "üe", 4)).toBe("lüè");
    expect(spell("n", "üe", 4)).toBe("nüè");
  });

  it("写成 u 的 ü 能按声母还原回来（判分不会把 ju 当成 lu 那种 u）", () => {
    expect(restoreUmlaut("j", "u")).toBe("ü");
    expect(restoreUmlaut("q", "ue")).toBe("üe");
    expect(restoreUmlaut("x", "uan")).toBe("üan");
    expect(restoreUmlaut("l", "u")).toBe("u");
    expect(restoreUmlaut("g", "uo")).toBe("uo");
  });
});

describe("拼音小火车 · y w 隔音与三拼省写", () => {
  it("i 行加 y：i / in / ing 补齐，其余把 i 换成 y", () => {
    const table: Array<[string, string]> = [
      ["i", "yi"],
      ["in", "yin"],
      ["ing", "ying"],
      ["ia", "ya"],
      ["ie", "ye"],
      ["iao", "yao"],
      ["iou", "you"],
      ["ian", "yan"],
      ["iang", "yang"],
      ["iong", "yong"],
    ];
    for (const [final, written] of table) expect(`${final}→${zeroInitialSpelling(final)}`).toBe(`${final}→${written}`);
  });

  it("u 行加 w：单个 u 补成 wu，其余把 u 换成 w", () => {
    const table: Array<[string, string]> = [
      ["u", "wu"],
      ["ua", "wa"],
      ["uo", "wo"],
      ["uai", "wai"],
      ["uei", "wei"],
      ["uan", "wan"],
      ["uen", "wen"],
      ["uang", "wang"],
      ["ueng", "weng"],
    ];
    for (const [final, written] of table) expect(`${final}→${zeroInitialSpelling(final)}`).toBe(`${final}→${written}`);
  });

  it("ü 行加 y 并去掉两点", () => {
    expect(zeroInitialSpelling("ü")).toBe("yu");
    expect(zeroInitialSpelling("üe")).toBe("yue");
    expect(zeroInitialSpelling("üan")).toBe("yuan");
    expect(zeroInitialSpelling("ün")).toBe("yun");
    expect(spell("y", "ü", 2)).toBe("yú");
    expect(spell("y", "üe", 4)).toBe("yuè");
    expect(spell("y", "ün", 2)).toBe("yún");
    expect(spell("w", "u", 3)).toBe("wǔ");
  });

  it("三拼省写：iou → iu、uei → ui、uen → un（只在有声母时省）", () => {
    expect(writtenFinal("l", "iou")).toBe("iu");
    expect(writtenFinal("g", "uei")).toBe("ui");
    expect(writtenFinal("l", "uen")).toBe("un");
    expect(spell("l", "iou", 2)).toBe("liú");
    expect(spell("n", "iou", 2)).toBe("niú");
    expect(spell("g", "uei", 1)).toBe("guī");
    expect(spell("sh", "uei", 3)).toBe("shuǐ");
    expect(spell("d", "uei", 4)).toBe("duì");
    expect(spell("l", "uen", 2)).toBe("lún");
    // 没有声母时不省写，走 y / w
    expect(plainSyllable("", "iou")).toBe("you");
    expect(plainSyllable("", "uei")).toBe("wei");
    expect(plainSyllable("", "uen")).toBe("wen");
  });

  it("整张韵母表都能拼出合法的零声母写法（36 个，无重复、无残留 ü 点）", () => {
    expect(new Set(BASE_FINALS).size).toBe(BASE_FINALS.length);
    for (const final of BASE_FINALS) {
      const written = zeroInitialSpelling(final);
      expect(written.length).toBeGreaterThan(0);
      expect(written).not.toMatch(/ü/);
      expect(written).toMatch(/^[a-z]+$/);
    }
  });
});

describe("拼音小火车 · 整体认读音节表", () => {
  it("不多不少十六个，且互不重复", () => {
    expect(WHOLE_READ_SYLLABLES).toHaveLength(16);
    expect(new Set(WHOLE_READ_SYLLABLES).size).toBe(16);
    expect([...WHOLE_READ_SYLLABLES]).toEqual([
      "zhi", "chi", "shi", "ri", "zi", "ci", "si", "yi",
      "wu", "yu", "ye", "yue", "yuan", "yin", "yun", "ying",
    ]);
  });

  it("带调号也能认出来，长得像的要拼读音节不会被误判", () => {
    for (const s of WHOLE_READ_SYLLABLES) {
      expect(isWholeRead(s)).toBe(true);
      for (const tone of [1, 2, 3, 4]) expect(isWholeRead(markTone(s, tone))).toBe(true);
    }
    for (const s of ["zha", "zhu", "cha", "shu", "za", "yao", "wan", "yang", "wo"]) {
      expect(isWholeRead(s)).toBe(false);
    }
  });
});

describe("拼音小火车 · 规则函数与 1.1 老接口不打架", () => {
  it("logic.ts 的 applyTone / stripTone / toneOf 只是转调，结果一模一样", () => {
    for (const plain of ["ma", "hao", "liu", "gui", "wanr", "xiang", "nü", "lüe", "zi"]) {
      for (const tone of [0, 1, 2, 3, 4]) {
        expect(applyTone(plain, tone)).toBe(markTone(plain, tone));
      }
    }
    expect(stripTone("shàng")).toBe("shang");
    expect(toneOf("shàng")).toBe(4);
    expect(toneOf("zi")).toBe(0);
  });

  it("拼读车厢的 30 张卡：声母合法、韵母在表里、拼出来就是那个字的音", () => {
    expect(SPELL_CARDS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(SPELL_CARDS.map((c) => c.word)).size).toBe(SPELL_CARDS.length);
    for (const card of SPELL_CARDS) {
      expect(INITIALS).toContain(card.initial);
      expect(BASE_FINALS).toContain(card.final);
      expect(card.tone).toBeGreaterThanOrEqual(1);
      expect(card.tone).toBeLessThanOrEqual(4);
      const syllable = spell(card.initial, card.final, card.tone);
      expect(readTone(syllable)).toBe(card.tone);
      expect(toneMarkPlacedRight(syllable)).toBe(true);
      // 车厢上写的是带点的 ü，拼出来该去点的必须去干净
      if (card.final.startsWith("ü") && dropsUmlautDots(card.initial)) {
        expect(syllable).not.toMatch(/ü|ǖ|ǘ|ǚ|ǜ/);
      }
    }
  });
});
