/**
 * 音乐星星 · 简谱记号（1.2 新增，纯函数）。
 *
 * 1.1 的谱面只有裸数字「1 2 3 5 6」：没有八度点、没有时值横线，
 * 也就是说**节奏信息在谱上完全看不出来**。这里补齐三件事：
 *
 *  - 数字：五声音阶 1 2 3 5 6（宫商角徵羽），七声再加 4 与 7；
 *  - 八度点：高八度在数字上方点一点，低八度在下方点一点；
 *  - 时值：四分音符不加线，八分音符加下划线，二分音符后面加一条增时线「1 -」。
 *
 * 输出成结构体而不是一串 HTML，渲染怎么摆是 UI 的事，判定与单测只看结构。
 */

/** 十二平均律里每个音级对应的简谱数字（C 大调：C=1 D=2 E=3 F=4 G=5 A=6 B=7） */
const PITCH_CLASS_DIGIT: readonly (number | null)[] = [1, null, 2, null, 3, 4, null, 5, null, 6, null, 7];

/** 时值：四分音符是一拍 */
export type NoteValue = "half" | "quarter" | "eighth";

export interface ScoreGlyph {
  /** 简谱数字，1–7；休止符是 0 */
  digit: number;
  /** 八度：0 是中央那一组，+1 是高八度（上加点），−1 是低八度（下加点） */
  octave: number;
  value: NoteValue;
  /** 数字上方几个点 */
  dotsAbove: number;
  /** 数字下方几个点 */
  dotsBelow: number;
  /** 数字下方几条时值下划线（八分音符 1 条） */
  underlines: number;
  /** 数字后面几条增时线（二分音符 1 条） */
  dashes: number;
}

/** MIDI 号 → 简谱字形（以中央 C 那一组为 0 八度） */
export function glyphOf(midi: number, value: NoteValue = "quarter"): ScoreGlyph {
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const digit = PITCH_CLASS_DIGIT[pc] ?? 1;
  const octave = Math.floor((Math.round(midi) - 60) / 12);
  return {
    digit,
    octave,
    value,
    dotsAbove: Math.max(0, octave),
    dotsBelow: Math.max(0, -octave),
    underlines: value === "eighth" ? 1 : 0,
    dashes: value === "half" ? 1 : 0,
  };
}

/** 一整句谱 */
export function glyphLine(midis: readonly number[], values?: readonly NoteValue[]): ScoreGlyph[] {
  return midis.map((m, i) => glyphOf(m, values?.[i] ?? "quarter"));
}

/**
 * 字形 → 纯文本（无障碍标签与单测都用它）。
 * 高八度写成 `5̇` 不好读，这里用括号说清楚：`5(高)`、`5(低)`、二分音符补 ` -`。
 */
export function glyphText(g: ScoreGlyph): string {
  const oct = g.octave > 0 ? "(高)" : g.octave < 0 ? "(低)" : "";
  const dash = g.dashes > 0 ? " -" : "";
  const under = g.underlines > 0 ? "_" : "";
  return `${g.digit}${oct}${under}${dash}`;
}

/** 一整句的纯文本谱 */
export function lineText(glyphs: readonly ScoreGlyph[]): string {
  return glyphs.map(glyphText).join(" ");
}

/** 一整句念给孩子听的说法（读屏用；不含任何一关的旋律走向描述） */
export function glyphAria(g: ScoreGlyph): string {
  const names = ["休止", "哆", "来", "咪", "发", "索", "拉", "西"];
  const name = names[g.digit] ?? "音";
  const oct = g.octave > 0 ? "高八度" : g.octave < 0 ? "低八度" : "";
  const dur = g.value === "half" ? "两拍" : g.value === "eighth" ? "半拍" : "一拍";
  return `${oct}${name}，${dur}`;
}

/** 简谱区的最小字号（像素）：360px 屏上八度点也得看得清 */
export const SCORE_MIN_FONT_PX = 22;

/** 节奏关的长短音对应的时值：长音是二分，短音是八分 */
export function rhythmValue(long: boolean): NoteValue {
  return long ? "half" : "eighth";
}
