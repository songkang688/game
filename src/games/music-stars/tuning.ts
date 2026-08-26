/**
 * 音乐星星 · 音准与乐理（1.2 新增，纯函数，无副作用）。
 *
 * 1.1 之前的频率是手打的常数（261.63 / 293.66 / …），近似对但没人校验。
 * 这里改成按十二平均律算：`f = 440 × 2^((n − 69) / 12)`，
 * 五声 / 七声音阶都只写 MIDI 号，频率一律现算，改错了单测会红。
 *
 * 音程名称表对照乐理写死。**教错音程名是教学事故**，所以这张表 0–12 半音全覆盖单测。
 */

/** 国际标准音 A4 的 MIDI 号 */
export const A4_MIDI = 69;
/** 国际标准音 A4 的频率（Hz） */
export const A4_FREQ = 440;
/** 中央 C（C4）的 MIDI 号 */
export const C4_MIDI = 60;

/** 十二平均律：MIDI 音高号 → 频率（Hz） */
export function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** 频率 → MIDI 音高号（不取整，便于测音准偏差） */
export function freqToMidi(freq: number): number {
  if (!(freq > 0)) return Number.NaN;
  return A4_MIDI + 12 * Math.log2(freq / A4_FREQ);
}

/**
 * 五声音阶（C 宫：哆来咪索拉）。
 * 与 1.0 起沿用的五颗星星一一对应，`SCORE_DIGITS` 的 1 2 3 5 6 说的就是这五个音。
 */
export const PENTATONIC_MIDI: readonly number[] = [60, 62, 64, 67, 69];

/**
 * 七声音阶（C 大调自然音阶 + 高八度的哆），只在自由弹奏沙盒里可选。
 * 关卡一律用五声——五声怎么弹都不难听，是给孩子的保护。
 */
export const DIATONIC_MIDI: readonly number[] = [60, 62, 64, 65, 67, 69, 71, 72];

/** 五声音阶每颗星星的名字与配色（配色沿用 1.0，孩子已经认熟了） */
export const PENTATONIC_NOTES: readonly { name: string; color: string }[] = [
  { name: "哆", color: "#ff8787" },
  { name: "来", color: "#ffa94d" },
  { name: "咪", color: "#ffe066" },
  { name: "索", color: "#8ce99a" },
  { name: "拉", color: "#74c0fc" },
];

/** 七声音阶多出来的两个音（发与西）与高八度的哆 */
export const DIATONIC_NOTES: readonly { name: string; color: string }[] = [
  { name: "哆", color: "#ff8787" },
  { name: "来", color: "#ffa94d" },
  { name: "咪", color: "#ffe066" },
  { name: "发", color: "#b2f2bb" },
  { name: "索", color: "#8ce99a" },
  { name: "拉", color: "#74c0fc" },
  { name: "西", color: "#d0bfff" },
  { name: "高哆", color: "#ffc9c9" },
];

/**
 * 音程名称：下标就是半音数，0 = 同音，12 = 八度。
 * 6 个半音在乐理上按记谱可以叫增四度或减五度，面向孩子统一说「增四度」。
 */
export const INTERVAL_NAMES: readonly string[] = [
  "纯一度",
  "小二度",
  "大二度",
  "小三度",
  "大三度",
  "纯四度",
  "增四度",
  "纯五度",
  "小六度",
  "大六度",
  "小七度",
  "大七度",
  "纯八度",
];

/** 半音数 → 音程名（负数按绝对值算；超过八度拆成「几个八度又几度」） */
export function intervalName(semitones: number): string {
  if (!Number.isFinite(semitones)) return INTERVAL_NAMES[0];
  const n = Math.abs(Math.round(semitones));
  if (n <= 12) return INTERVAL_NAMES[n];
  const octaves = Math.floor(n / 12);
  const rest = n % 12;
  if (rest === 0) return `${octaves} 个纯八度`;
  return `${octaves} 个八度又${INTERVAL_NAMES[rest]}`;
}

/** 两个 MIDI 音之间差几个半音（带正负号：正数是往上） */
export function semitonesBetween(fromMidi: number, toMidi: number): number {
  return Math.round(toMidi - fromMidi);
}

/**
 * 五声音阶上两颗星星（下标）之间真正的音程名。
 * 这就是 1.1 那句「往上 2 格」说不清楚的东西：
 * 哆→咪是 2 格 = 大三度，来→索也是 2 格，却是纯四度。
 */
export function pentatonicIntervalName(a: number, b: number): string {
  const lo = PENTATONIC_MIDI[a];
  const hi = PENTATONIC_MIDI[b];
  if (lo === undefined || hi === undefined) return "";
  return intervalName(semitonesBetween(lo, hi));
}

/** 答对之后念给孩子听的整句话：方向 + 真名 */
export function pentatonicIntervalPhrase(a: number, b: number): string {
  const name = pentatonicIntervalName(a, b);
  if (!name) return "";
  if (a === b) return `两个音一样高，这叫${name}`;
  return `${b > a ? "往上" : "往下"}${name}`;
}

/**
 * 音高 → 纵向偏移（像素）：音越高星星摆得越上，让孩子看得见「高低」。
 * 线性映射，最低音贴底（0），最高音抬到 rise 像素高。
 */
export function pitchOffsetPx(midi: number, lowMidi: number, highMidi: number, rise = 72): number {
  if (!Number.isFinite(midi)) return 0;
  const span = highMidi - lowMidi;
  if (!(span > 0)) return 0;
  const t = (midi - lowMidi) / span;
  return Math.round(Math.max(0, Math.min(1, t)) * rise);
}
