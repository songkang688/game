/**
 * 音乐星星 · 星空视觉主题（1.3 视觉升级 · 第 26 步 B 档新增，纯视觉模块）。
 *
 * 这里只做「音高数据 → 颜色 / 位置 / 装饰」的**只读映射**：
 *  - 彩虹音阶：do 红到 si 紫七色，色相沿音阶单调走高（助记通道）；
 *    同音名不同八度用亮度 ±12% 区分——`PENTATONIC_MIDI` 等音高数据零改动；
 *  - 果冻键式样：音色渐变 + 顶部白色顶光 + 2px 深色描边 + 底部 2px 暗边，
 *    描边全走 inset box-shadow，键的盒子几何（热区）一个像素不动；
 *  - 星空舞台：夜空渐变 + 五线谱星轨线 + 星座连线风格谱号，程序化 SVG
 *    data-URI（无位图资源）；
 *  - 音程选项卡：从选项文案（题目数据）解析方向与格数，映射两颗小星的
 *    距离示意——乐理与选项文本零改动；
 *  - 录音胶带条：从片段音符（只读）映射波形微缩条的高度。
 */
import { shade, withAlpha } from "../../art/kit/palette";

/** 夜空舞台纵向渐变（上 → 下） */
export const NIGHT_TOP = "#1d2b53";
export const NIGHT_BOTTOM = "#3a4a7d";
/** 五线谱星轨线（1px + 微光晕） */
export const STAFF_GLOW = "rgba(180,200,255,.55)";
/** 命中音波环 */
export const WAVE_RING = "rgba(255,255,255,.5)";
/** 连击流星尾迹 */
export const METEOR_TAIL = "rgba(255,246,214,.7)";
/** 星心高亮 */
export const STAR_GLOW_INNER = "rgba(255,255,255,.9)";

/** 彩虹音阶七色：do → si 色相单调走高（红 橙 黄 绿 青 蓝 紫） */
export const RAINBOW: readonly string[] = [
  "#ff6b6b", // noteDo
  "#ff9f43", // noteRe
  "#ffd93d", // noteMi
  "#7bc86c", // noteFa
  "#2ec4b6", // noteSol
  "#5b9bff", // noteLa
  "#9b6dd6", // noteSi
];

/** 同音名不同八度的亮度差（±12%） */
export const OCTAVE_SHADE_PCT = 12;

/** 十二个音级 → 音阶级数（C=do … B=si；黑键落到左邻的白键，本库数据用不到黑键） */
const PC_DEGREE: readonly number[] = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

/** MIDI 号 → 音阶级数 0..6（do..si） */
export function degreeOfMidi(midi: number): number {
  if (!Number.isFinite(midi)) return 0;
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  return PC_DEGREE[pc] ?? 0;
}

/**
 * MIDI 号 → 彩虹音阶颜色。级数定色相，八度定亮度：
 * 中央那一组（C4 起）用本色，高八度提亮 12%，低八度压暗 12%（逐级叠加，夹在 ±24%）。
 * **只读映射**：音高数据本身一个字不动。
 */
export function noteColorByMidi(midi: number): string {
  const base = RAINBOW[degreeOfMidi(midi)];
  if (!Number.isFinite(midi)) return base;
  const octave = Math.floor((Math.round(midi) - 60) / 12);
  if (octave === 0) return base;
  const pct = Math.max(-2, Math.min(2, octave)) * OCTAVE_SHADE_PCT;
  return shade(base, pct);
}

/** 十六进制色 → 色相（0–360，HSL 口径）；给「色相单调」的守门用例用 */
export function hueOfHex(hex: string): number {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0;
  const r = Number.parseInt(full.slice(0, 2), 16) / 255;
  const g = Number.parseInt(full.slice(2, 4), 16) / 255;
  const b = Number.parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) (h = (b - r) / d + 2);
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** 感知亮度（0–255，Rec. 601 加权）；给「八度亮度差」的守门用例用 */
export function lumaOfHex(hex: string): number {
  const raw = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return 0;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export interface JellyKeyStyle {
  /** 音色渐变 + 顶部 35% 白色顶光弧 */
  background: string;
  /** 2px 同色系深描边 + 底部 2px 暗边，全走 inset box-shadow（盒子几何零改动） */
  boxShadow: string;
}

/** 果冻键的描边粗细与底部暗边厚度（全走 inset box-shadow，不占盒子） */
export const JELLY_EDGE_PX = 2;
export const JELLY_BOTTOM_PX = 2;

/** 一颗果冻键的内联式样（音色渐变 + 顶光 + 描边），几何零改动 */
export function jellyKeyStyle(color: string): JellyKeyStyle {
  const light = shade(color, 40);
  const dark = shade(color, -22);
  const edge = shade(color, -45);
  return {
    background:
      `linear-gradient(180deg,${withAlpha("#ffffff", 0.35)} 0%,${withAlpha("#ffffff", 0)} 35%),` +
      `linear-gradient(180deg,${light} 0%,${color} 55%,${dark} 100%)`,
    boxShadow: `inset 0 0 0 ${JELLY_EDGE_PX}px ${edge},inset 0 -${JELLY_BOTTOM_PX}px 0 ${edge}`,
  };
}

// ---------------------------------------------------------------------------
// 星空舞台：夜空 + 五线谱星轨 + 星座谱号（程序化 SVG data-URI，无位图）
// ---------------------------------------------------------------------------

/** 五线谱星轨线的纵坐标（viewBox 0–100，间距 10 → 104px 高的星空上仍有 ≥8px 线距） */
export const STAFF_LINE_YS: readonly number[] = [26, 36, 46, 56, 66];

/** 星座连线风格的谱号锚点（viewBox 坐标，画在舞台左侧） */
const CLEF_POINTS: ReadonlyArray<readonly [number, number]> = [
  [9, 24], [5, 38], [9, 52], [13, 40], [7, 66],
];

/** 背景细星（x, y, r） */
const SPRINKLE_STARS: ReadonlyArray<readonly [number, number, number]> = [
  [16, 12, 0.7], [34, 20, 0.5], [52, 9, 0.8], [68, 16, 0.5],
  [84, 11, 0.7], [93, 26, 0.5], [24, 74, 0.5], [76, 78, 0.7],
];

/**
 * 星轨远端的锚点星（1.3 第 3 轮 · B 档修订清单第 8 条）：三颗四角小星钉在
 * 第 1 / 3 / 5 条星轨线的右端，让全屏等距的谱线有个「星座感」的收笔。
 * 纯 fill 静态装饰（跟着 data-URI 走 CSS 背景），reduced 无关。
 */
export const ANCHOR_STARS: ReadonlyArray<readonly [number, number]> = [
  [96, 26], [97.5, 46], [96, 66],
];

/** 一颗四角小星的路径（r 是半径，viewBox 单位；拉伸到舞台上约 2px 尖角） */
function anchorStarPath(x: number, y: number, r: number): string {
  const w = +(r * 0.34).toFixed(2);
  return (
    `M${x} ${y - r} L${x + w} ${y - w} L${x + r} ${y} L${x + w} ${y + w} ` +
    `L${x} ${y + r} L${x - w} ${y + w} L${x - r} ${y} L${x - w} ${y - w} Z`
  );
}

/**
 * 星空舞台的装饰 SVG（`preserveAspectRatio:none` 拉伸铺满）：
 * 五条星轨线各画两笔（宽 2 的微光晕 + 宽 0.6 的亮芯），谱号用星点 + 细线连成
 * 一笔星座，右上再撒几颗背景细星。纯装饰，进 CSS 背景，不占 DOM、不接指针。
 */
export function skyStageSvg(): string {
  const lines = STAFF_LINE_YS.map(
    (y) =>
      `<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="${STAFF_GLOW}" stroke-width="2" opacity=".35"/>` +
      `<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="${STAFF_GLOW}" stroke-width="0.6"/>`
  ).join("");
  const clefLines = CLEF_POINTS.slice(1)
    .map((p, i) => {
      const prev = CLEF_POINTS[i];
      return `<line x1="${prev[0]}" y1="${prev[1]}" x2="${p[0]}" y2="${p[1]}" stroke="${STAFF_GLOW}" stroke-width="0.5"/>`;
    })
    .join("");
  const clefDots = CLEF_POINTS.map(
    ([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="${STAR_GLOW_INNER}"/>`
  ).join("");
  const sprinkles = SPRINKLE_STARS.map(
    ([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity=".55"/>`
  ).join("");
  const anchors = ANCHOR_STARS.map(
    ([x, y]) => `<path data-anchor="1" d="${anchorStarPath(x, y, 1.5)}" fill="${STAR_GLOW_INNER}" opacity=".85"/>`
  ).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">` +
    lines + clefLines + clefDots + sprinkles + anchors +
    `</svg>`
  );
}

/** 星空舞台 SVG 的 data-URI（进 CSS `background-image` 用） */
export function skyStageUri(): string {
  return `url("data:image/svg+xml,${encodeURIComponent(skyStageSvg())}")`;
}

// ---------------------------------------------------------------------------
// 音程选项卡：从选项文案（题目数据）解析出两颗小星的距离示意
// ---------------------------------------------------------------------------

export interface IntervalChoiceShape {
  /** 方向：+1 往上、-1 往下、0 一样高 */
  dir: -1 | 0 | 1;
  /** 差几格（题目数据里的原话） */
  steps: number;
}

/** 解析「往上 N 格 / 往下 N 格 / 一样高」；认不出就当 0（视觉兜底，绝不改题） */
export function parseIntervalChoice(label: string): IntervalChoiceShape {
  if (typeof label !== "string") return { dir: 0, steps: 0 };
  const hit = /^(往上|往下)\s*(\d+)\s*格$/.exec(label.trim());
  if (!hit) return { dir: 0, steps: 0 };
  return { dir: hit[1] === "往上" ? 1 : -1, steps: Number(hit[2]) };
}

/** 音程卡上下两星的纵向距离（像素）：随格数单调增，封顶不出卡 */
export function choiceStarGapPx(steps: number): number {
  const n = Number.isFinite(steps) ? Math.max(0, Math.round(steps)) : 0;
  return Math.min(6 + n * 7, 34);
}

// ---------------------------------------------------------------------------
// 录音胶带条：从片段音符（只读）映射波形微缩条
// ---------------------------------------------------------------------------

/** 波形条最多几根、高度上下限（像素） */
export const CLIP_WAVE_BARS = 12;
export const CLIP_WAVE_MIN_PX = 3;
export const CLIP_WAVE_MAX_PX = 14;

/**
 * 片段音符 → 波形微缩条高度。把片段时间轴切成 bars 份，每一份取落进来的
 * 音符时值映射高度，空档给最低条。**只读**：不改音符数组一个字。
 */
export function clipWaveHeights(
  notes: ReadonlyArray<{ readonly at: number; readonly dur: number }>,
  bars = CLIP_WAVE_BARS
): number[] {
  const n = Math.max(1, Math.round(bars));
  const out = new Array<number>(n).fill(CLIP_WAVE_MIN_PX);
  if (!Array.isArray(notes) || notes.length === 0) return out;
  const total = Math.max(1, ...notes.map((note) => note.at + note.dur));
  for (const note of notes) {
    if (!Number.isFinite(note.at) || !Number.isFinite(note.dur)) continue;
    const idx = Math.max(0, Math.min(n - 1, Math.floor((note.at / total) * n)));
    const h = Math.max(
      CLIP_WAVE_MIN_PX,
      Math.min(CLIP_WAVE_MAX_PX, Math.round(CLIP_WAVE_MIN_PX + note.dur / 60))
    );
    out[idx] = Math.max(out[idx], h);
  }
  return out;
}
