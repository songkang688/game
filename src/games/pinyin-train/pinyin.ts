/**
 * 拼音规则纯函数（1.2 新增）。
 *
 * 拼音小火车是教学游戏，**规则错一个就是教学事故**，所以把「哪个字母戴调号」
 * 「ü 什么时候去掉两点」「没有声母时怎么写 y / w」「三拼怎么省写」这几条
 * 全部抽成没有副作用、不碰 DOM 的纯函数，逐条钉上单测。
 *
 * 出题、判分、攻略都只许调用这里的函数，不许在别处再手写一遍规则。
 */

// ---------------------------------------------------------------------------
// 一、调号
// ---------------------------------------------------------------------------

/** 六个能戴调号的元音字母：一声 → 四声 */
export const TONE_ROWS: Record<string, readonly string[]> = {
  a: ["ā", "á", "ǎ", "à"],
  o: ["ō", "ó", "ǒ", "ò"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  u: ["ū", "ú", "ǔ", "ù"],
  "ü": ["ǖ", "ǘ", "ǚ", "ǜ"],
};

/** 反查：戴了调号的字母 → 光板字母与第几声 */
const TONE_LOOKUP: Record<string, { base: string; tone: number }> = (() => {
  const map: Record<string, { base: string; tone: number }> = {};
  for (const [base, forms] of Object.entries(TONE_ROWS)) {
    forms.forEach((f, i) => {
      map[f] = { base, tone: i + 1 };
    });
  }
  return map;
})();

/** 能戴调号的字母（光板形态） */
export const TONEABLE_LETTERS = Object.keys(TONE_ROWS);

/**
 * 调号该戴在第几个字母上（0 基；没有元音返回 -1）。
 *
 * 一条规则讲完：**有 a 找 a，没 a 找 o、e，都没有就戴在最后一个 i / u / ü 上。**
 * 最后那一句同时覆盖了课本上单独强调的「iu 标在 u 上」「ui 标在 i 上」——
 * 因为 iu 的最后一个是 u、ui 的最后一个是 i。
 */
export function toneTargetIndex(plain: string): number {
  const s = String(plain ?? "").toLowerCase();
  for (const v of ["a", "o", "e"]) {
    const at = s.indexOf(v);
    if (at >= 0) return at;
  }
  for (let i = s.length - 1; i >= 0; i--) {
    if (TONEABLE_LETTERS.includes(s[i])) return i;
  }
  return -1;
}

/** 调号该戴在哪个字母上（没有元音返回空串） */
export function toneTargetLetter(plain: string): string {
  const at = toneTargetIndex(plain);
  return at < 0 ? "" : plain[at];
}

/** 把调号戴到指定位置（位置不合法或该字母戴不了调号就原样返回） */
export function markToneAt(plain: string, index: number, tone: number): string {
  if (!Number.isInteger(tone) || tone <= 0 || tone > 4) return plain;
  if (!Number.isInteger(index) || index < 0 || index >= plain.length) return plain;
  const forms = TONE_ROWS[plain[index]];
  if (!forms) return plain;
  return plain.slice(0, index) + forms[tone - 1] + plain.slice(index + 1);
}

/** 按标调规则给光板音节戴调号；tone 传 0 就是轻声，什么也不加 */
export function markTone(plain: string, tone: number): string {
  if (!Number.isInteger(tone) || tone <= 0 || tone > 4) return plain;
  return markToneAt(plain, toneTargetIndex(plain), tone);
}

/** 摘掉调号，还原成光板音节（本来就没调号的原样返回） */
export function removeToneMarks(syllable: string): string {
  let out = "";
  for (const ch of String(syllable ?? "")) out += TONE_LOOKUP[ch]?.base ?? ch;
  return out;
}

/** 读出音节的声调：1..4；轻声（没有调号）是 0 */
export function readTone(syllable: string): number {
  for (const ch of String(syllable ?? "")) {
    const hit = TONE_LOOKUP[ch];
    if (hit) return hit.tone;
  }
  return 0;
}

/** 这个音节的调号戴对地方了吗（轻声一律算对） */
export function toneMarkPlacedRight(syllable: string): boolean {
  const tone = readTone(syllable);
  if (tone === 0) return true;
  const plain = removeToneMarks(syllable);
  return markTone(plain, tone) === syllable;
}

// ---------------------------------------------------------------------------
// 二、ü 的两点
// ---------------------------------------------------------------------------

/** 和 ü 相拼要去掉两点的声母：j q x（还有零声母的 y） */
export const UMLAUT_DROP_INITIALS: readonly string[] = ["j", "q", "x", "y"];

/** 和 ü 相拼要保留两点的声母：n l */
export const UMLAUT_KEEP_INITIALS: readonly string[] = ["n", "l"];

/** 这个声母和 ü 相拼时要去掉两点吗 */
export function dropsUmlautDots(initial: string): boolean {
  return UMLAUT_DROP_INITIALS.includes(String(initial ?? "").toLowerCase());
}

/**
 * 把写成 u 的 ü 还原回来（判分时用）。
 * `ju` 的 u 其实是 ü，`lu` 的 u 就是 u —— 靠声母区分。
 */
export function restoreUmlaut(initial: string, written: string): string {
  if (!dropsUmlautDots(initial)) return written;
  return written.startsWith("u") ? `ü${written.slice(1)}` : written;
}

// ---------------------------------------------------------------------------
// 三、韵母的书写形式（三拼省写 + 零声母的 y / w）
// ---------------------------------------------------------------------------

/** 三拼音节省写：iou → iu，uei → ui，uen → un（只在有声母时省） */
const ABBREVIATED: Record<string, string> = { iou: "iu", uei: "ui", uen: "un" };

/**
 * 韵母跟在声母后面时的写法：先省写三拼，再按声母决定 ü 去不去点。
 * 例：`l` + `iou` → `iu`（liu）、`g` + `uei` → `ui`（gui）、`j` + `üe` → `ue`（jue）。
 */
export function writtenFinal(initial: string, final: string): string {
  let f = ABBREVIATED[final] ?? final;
  if (f.startsWith("ü") && dropsUmlautDots(initial)) f = `u${f.slice(1)}`;
  return f;
}

/**
 * 没有声母时韵母自己怎么写（隔音）：
 * i 行前面加 y（i / in / ing 补成 yi / yin / ying，其余把 i 换成 y）；
 * u 行前面加 w（单个 u 补成 wu，其余把 u 换成 w）；
 * ü 行前面加 y 并去掉两点（ü → yu，üe → yue，üan → yuan，ün → yun）。
 */
export function zeroInitialSpelling(final: string): string {
  const f = String(final ?? "");
  if (f.startsWith("ü")) return `yu${f.slice(1)}`;
  if (f.startsWith("i")) return f === "i" || f === "in" || f === "ing" ? `y${f}` : `y${f.slice(1)}`;
  if (f.startsWith("u")) return f === "u" ? "wu" : `w${f.slice(1)}`;
  return f;
}

/** 声母 + 韵母拼出来的光板音节（还没戴调号）。声母传空串、`y` 或 `w` 都按零声母处理 */
export function plainSyllable(initial: string, final: string): string {
  const ini = String(initial ?? "").toLowerCase();
  if (!ini || ini === "y" || ini === "w") return zeroInitialSpelling(final);
  return ini + writtenFinal(ini, final);
}

/** 声母 + 韵母 + 声调 → 完整音节（tone 传 0 就是轻声） */
export function spell(initial: string, final: string, tone = 0): string {
  return markTone(plainSyllable(initial, final), tone);
}

/** 教学常用韵母表（基本形：三拼不省写、ü 带两点），出题与自检都用这一份 */
export const BASE_FINALS: readonly string[] = [
  "a", "o", "e", "er",
  "ai", "ei", "ao", "ou",
  "an", "en", "ang", "eng", "ong",
  "i", "ia", "ie", "iao", "iou", "ian", "in", "iang", "ing", "iong",
  "u", "ua", "uo", "uai", "uei", "uan", "uen", "uang", "ueng",
  "ü", "üe", "üan", "ün",
];

// ---------------------------------------------------------------------------
// 四、整体认读音节
// ---------------------------------------------------------------------------

/** 十六个整体认读音节：看见就整个儿读出来，不用拼 */
export const WHOLE_READ_SYLLABLES: readonly string[] = [
  "zhi", "chi", "shi", "ri", "zi", "ci", "si", "yi",
  "wu", "yu", "ye", "yue", "yuan", "yin", "yun", "ying",
];

/** 是整体认读音节吗（带不带调号都认） */
export function isWholeRead(syllable: string): boolean {
  return WHOLE_READ_SYLLABLES.includes(removeToneMarks(String(syllable ?? "")).toLowerCase());
}
