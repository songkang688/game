// 音乐星星：旋律序列生成纯逻辑

/**
 * 生成一段长度为 length 的星星序列（元素为 0..starCount-1 的下标）。
 * 相邻两个音不重复，听起来更像小旋律，也更好记。
 * @param maxJump 相邻两个音的最大跨度（不传则不限制）；越小旋律越平滑，越好跟
 */
export function makeSequence(
  length: number,
  starCount: number,
  rand: () => number = Math.random,
  maxJump?: number
): number[] {
  if (length <= 0 || starCount <= 0) return [];
  const seq: number[] = [];
  for (let i = 0; i < length; i++) {
    if (i === 0 || starCount === 1) {
      seq.push(Math.floor(rand() * starCount));
      continue;
    }
    const prev = seq[i - 1];
    const candidates: number[] = [];
    for (let n = 0; n < starCount; n++) {
      if (n === prev) continue;
      if (maxJump !== undefined && Math.abs(n - prev) > maxJump) continue;
      candidates.push(n);
    }
    const pool = candidates.length > 0 ? candidates : [prev];
    seq.push(pool[Math.floor(rand() * pool.length)]);
  }
  return seq;
}

/**
 * 终曲《一闪一闪亮晶晶》第一句：哆哆索索拉拉索。
 * 下标对应五声音阶 [哆,来,咪,索,拉]。
 */
export const TWINKLE_FINALE: number[] = [0, 0, 3, 3, 4, 4, 3];

// ===========================================================================
// 1.1 追加：第 100–188 关的新玩法纯逻辑
// 节奏型 / 音程 / 双声部和弦 / 简谱
// 以下全部是新增内容，前 99 关的旋律生成一个字都没动。
// ===========================================================================

/** 五声音阶对应的简谱数字（哆来咪索拉） */
export const SCORE_DIGITS = [1, 2, 3, 5, 6];

/** 简谱视奏：把音符下标翻成谱面上的数字串 */
export function toScore(seq: readonly number[]): string {
  return seq.map((n) => SCORE_DIGITS[n] ?? "?").join(" ");
}

/**
 * 节奏型：0 是短音（♪），1 是长音（♩）。
 * 保证长短都有（不然听不出节奏），也不会连着四个一模一样。
 */
export function makeRhythm(length: number, rand: () => number = Math.random): number[] {
  if (length <= 1) return length === 1 ? [0] : [];
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    let v = rand() < 0.45 ? 1 : 0;
    const n = out.length;
    if (n >= 3 && out[n - 1] === v && out[n - 2] === v && out[n - 3] === v) v = v === 1 ? 0 : 1;
    out.push(v);
  }
  if (!out.includes(1)) out[Math.floor(length / 2)] = 1;
  if (!out.includes(0)) out[0] = 0;
  return out;
}

/** 音程：两个音之间差几格、往上还是往下 */
export function intervalLabel(a: number, b: number): string {
  if (a === b) return "一样高";
  return `${b > a ? "往上" : "往下"} ${Math.abs(b - a)} 格`;
}

/** 把一段旋律拆成两两一组的音程题用的音对（相邻音不重复） */
export function makeIntervalPair(
  starCount: number,
  rand: () => number = Math.random,
  maxGap = 4
): [number, number] {
  const a = Math.floor(rand() * starCount);
  const options: number[] = [];
  for (let n = 0; n < starCount; n++) {
    if (n === a) continue;
    if (Math.abs(n - a) > maxGap) continue;
    options.push(n);
  }
  const b = options.length > 0 ? options[Math.floor(rand() * options.length)] : (a + 1) % starCount;
  return [a, b];
}

/**
 * 双声部和弦：每一拍两个不同的音，两颗星星要一起按到。
 * 相邻两拍不会完全一样，不然一直按同两颗就过关了。
 *
 * @param minGap 两颗星星至少隔几格。1.2 起双声部关传 2：
 *   两个键真要同时按，挨在一起会被一根手指盖住（见 `touch.ts` 的 `DUET_MIN_GAP_PX`）。
 *   默认仍是 1，`makeChords` 本身的老行为一格不变。
 */
export function makeChords(
  length: number,
  starCount: number,
  rand: () => number = Math.random,
  minGap = 1
): number[][] {
  if (length <= 0 || starCount < 2) return [];
  // 星星不够宽时退回相邻也允许，否则一个和弦都摆不出来
  const gap = Math.max(1, Math.min(minGap, starCount - 1));
  const out: number[][] = [];
  for (let i = 0; i < length; i++) {
    let chord: number[] = [];
    for (let guard = 0; guard < 24; guard++) {
      const lo = Math.floor(rand() * starCount);
      const hi = Math.floor(rand() * starCount);
      if (lo === hi) continue;
      if (Math.abs(hi - lo) < gap) continue;
      chord = [Math.min(lo, hi), Math.max(lo, hi)];
      const prev = out[i - 1];
      if (!prev || prev[0] !== chord[0] || prev[1] !== chord[1]) break;
    }
    if (chord.length < 2) chord = [0, Math.min(gap, starCount - 1)];
    out.push(chord);
  }
  return out;
}
