/**
 * 涂色小屋 · 颜料与混色（1.2 新增，纯函数，不碰 DOM）。
 *
 * 这一份只解决一件事：**别把孩子教错**。
 *
 * 屏幕上的颜色是加色的（红 + 绿 = 黄），颜料是减色的（红 + 绿 = 脏棕）。
 * 直接拿两个 hex 做 RGB 平均，蓝 + 黄会得到灰——而现实里蓝颜料加黄颜料就是绿。
 * 所以本文件的做法是：
 *
 *  1. **查表**：`RECIPES` 写死每一条配方，混出来是哪种颜料由表说了算；
 *  2. **受控插值**：颜色值取那种颜料自己钉死的 hex，只有搅拌动画的中间态才插值，
 *     而且插值也走减色（乘法）再朝查表结果收敛，看得见蓝一路走向绿。
 *
 * 顺带把「亮度排序」「两色差得开不开」这两件判定也做成纯函数，
 * 渐变章的深浅顺序和校验器的 ΔE 阈值都从这里取，免得两处各写一套。
 */

/** 一种颜料：名字是给孩子看的，`symbol` 给限色章当色盲友好的符号图例 */
export interface Pigment {
  name: string;
  hex: string;
  symbol: string;
}

/**
 * 全部颜料。
 *
 * 前 99 关在用的基础色（红黄蓝粉棕橙绿紫 / 深红金黄深蓝）hex **一个字都没动**。
 * 1.1 追加的浅色系里，粉 / 蓝 / 橙三支加深了一点点：原值与白画布只差 ΔE 16 上下，
 * 涂上去孩子看不出「这块涂过了」。另外补了「中绿」「深黄」两支，
 * 用来把亮度级差不到 12% 的两条明暗阶梯撑开（详见 `SHADE_LADDERS`）。
 */
export const PIGMENTS: Pigment[] = [
  { name: "红色", hex: "#ff6b6b", symbol: "●" },
  { name: "黄色", hex: "#ffe066", symbol: "■" },
  { name: "蓝色", hex: "#74c0fc", symbol: "▲" },
  { name: "粉色", hex: "#faa2c1", symbol: "♥" },
  { name: "棕色", hex: "#c08552", symbol: "◆" },
  { name: "橙色", hex: "#ffa94d", symbol: "★" },
  { name: "绿色", hex: "#8ce99a", symbol: "✚" },
  { name: "紫色", hex: "#b197fc", symbol: "◇" },
  { name: "深红", hex: "#e03131", symbol: "◉" },
  { name: "金黄", hex: "#fab005", symbol: "▣" },
  { name: "深蓝", hex: "#4263eb", symbol: "△" },
  { name: "浅粉", hex: "#ffd6e6", symbol: "♡" },
  { name: "深粉", hex: "#e64980", symbol: "❥" },
  { name: "浅蓝", hex: "#c5e4ff", symbol: "▽" },
  { name: "浅绿", hex: "#d3f9d8", symbol: "✿" },
  { name: "中绿", hex: "#51cf66", symbol: "❀" },
  { name: "深绿", hex: "#2f9e44", symbol: "✤" },
  { name: "浅黄", hex: "#fff3bf", symbol: "▢" },
  { name: "深黄", hex: "#9d7604", symbol: "▤" },
  { name: "浅紫", hex: "#e5dbff", symbol: "◈" },
  { name: "深紫", hex: "#7048e8", symbol: "❖" },
  { name: "浅橙", hex: "#ffe3c2", symbol: "☆" },
  { name: "深橙", hex: "#e8590c", symbol: "✦" },
  { name: "浅红", hex: "#ffc9c9", symbol: "○" },
  { name: "白色", hex: "#ffffff", symbol: "◌" },
  { name: "黑色", hex: "#3b3f46", symbol: "◼" },
  { name: "灰色", hex: "#adb5bd", symbol: "◐" },
];

/** 颜料名 → hex */
export const PIGMENT_HEX: Record<string, string> = Object.fromEntries(PIGMENTS.map((p) => [p.name, p.hex]));

/** 颜料名 → 符号（色盲友好：色块之外还有一个能认的记号） */
export const PIGMENT_SYMBOL: Record<string, string> = Object.fromEntries(PIGMENTS.map((p) => [p.name, p.symbol]));

/** 这种颜料存在吗 */
export function isPigment(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(PIGMENT_HEX, name);
}

/** 一条配方：两样倒进锅里，出来什么 */
export interface Recipe {
  a: string;
  b: string;
  out: string;
  /** 讲给孩子听的一句话（攻略与调色锅提示共用） */
  why: string;
}

/**
 * 配方表（减色法，写死）。
 *
 * 顺序有讲究：同一个结果有多条配方时，**只用三原色的那一条排在最后**。
 * `MIX_TABLE` 是按这个顺序铺出来的普通对象，`scripts/smoke188.mjs` 遍历它时
 * 后写的会覆盖先写的，于是自动化跑法拿到的仍然是 1.0 的三原色配方，一行都不用改。
 */
export const RECIPES: Recipe[] = [
  // —— 加白变浅（同一种颜料掺白，只是变淡，不换色相）——
  { a: "红色", b: "白色", out: "浅红", why: "红加白，颜色变淡" },
  { a: "黄色", b: "白色", out: "浅黄", why: "黄加白，颜色变淡" },
  { a: "蓝色", b: "白色", out: "浅蓝", why: "蓝加白，颜色变淡" },
  { a: "粉色", b: "白色", out: "浅粉", why: "粉加白，颜色变淡" },
  { a: "橙色", b: "白色", out: "浅橙", why: "橙加白，颜色变淡" },
  { a: "绿色", b: "白色", out: "浅绿", why: "绿加白，颜色变淡" },
  { a: "紫色", b: "白色", out: "浅紫", why: "紫加白，颜色变淡" },
  // —— 加黑变深 ——
  { a: "红色", b: "黑色", out: "深红", why: "红加黑，颜色变沉" },
  { a: "黄色", b: "黑色", out: "深黄", why: "黄加黑，颜色变沉" },
  { a: "蓝色", b: "黑色", out: "深蓝", why: "蓝加黑，颜色变沉" },
  { a: "粉色", b: "黑色", out: "深粉", why: "粉加黑，颜色变沉" },
  { a: "橙色", b: "黑色", out: "深橙", why: "橙加黑，颜色变沉" },
  { a: "绿色", b: "黑色", out: "深绿", why: "绿加黑，颜色变沉" },
  { a: "紫色", b: "黑色", out: "深紫", why: "紫加黑，颜色变沉" },
  { a: "白色", b: "黑色", out: "灰色", why: "白加黑，调出灰" },
  // —— 中间色：浅色再加一点原色，就回到中间那一档 ——
  { a: "浅绿", b: "绿色", out: "中绿", why: "浅绿再加点绿，就是中绿" },
  // —— 三原色两两相加（排在最后，`MIX_TABLE` 里由它们最终生效）——
  { a: "红色", b: "黄色", out: "橙色", why: "红加黄，调出橙" },
  { a: "蓝色", b: "黄色", out: "绿色", why: "蓝加黄，调出绿" },
  { a: "红色", b: "蓝色", out: "紫色", why: "红加蓝，调出紫" },
  // —— 同色再倒一勺：颜料更浓，颜色更沉（1.0 的老配方，前 99 关靠它）——
  { a: "红色", b: "红色", out: "深红", why: "红再加一勺红，颜色更浓" },
  { a: "黄色", b: "黄色", out: "金黄", why: "黄再加一勺黄，颜色更浓" },
  { a: "蓝色", b: "蓝色", out: "深蓝", why: "蓝再加一勺蓝，颜色更浓" },
];

/** 一对颜料的查表 key（与顺序无关） */
export function mixKey(a: string, b: string): string {
  return [a, b].sort().join("+");
}

/**
 * 1.0 起对外的老形状：`"甲+乙" → 结果名`。
 * `levels.ts` 与 `scripts/smoke188.mjs` 都在读它，形状不许变。
 */
export const MIX_TABLE: Record<string, string> = Object.fromEntries(
  RECIPES.map((r) => [mixKey(r.a, r.b), r.out])
);

/** `"甲+乙" → 这一条配方讲给孩子听的话` */
export const MIX_WHY: Record<string, string> = Object.fromEntries(RECIPES.map((r) => [mixKey(r.a, r.b), r.why]));

/** 结果名 → 能调出它的全部配方 */
export const RECIPES_FOR: Record<string, Recipe[]> = (() => {
  const out: Record<string, Recipe[]> = {};
  for (const r of RECIPES) (out[r.out] ??= []).push(r);
  return out;
})();

/**
 * 倒两样进锅：查表得结果颜料名，查不到返回 null。
 * 与顺序无关（红黄和黄红是同一锅）。
 */
export function mixName(a: string, b: string): string | null {
  return MIX_TABLE[mixKey(a, b)] ?? null;
}

/** 混出来的颜色值：直接取那种颜料钉死的 hex，**不是两个 hex 的平均** */
export function mixHex(a: string, b: string): string | null {
  const out = mixName(a, b);
  return out === null ? null : PIGMENT_HEX[out] ?? null;
}

/** 这一锅为什么会变成这个颜色 */
export function mixWhy(a: string, b: string): string | null {
  return MIX_WHY[mixKey(a, b)] ?? null;
}

// ---------------------------------------------------------------------------
// 颜色数学（sRGB → CIE Lab，只用来做判定，不用来决定混色结果）
// ---------------------------------------------------------------------------

export type Rgb = [number, number, number];

/** `#rrggbb` → [r, g, b]（0..255）；写坏了当黑色，绝不抛异常把整关拖垮 */
export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** [r, g, b] → `#rrggbb` */
export function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** CIE Lab（D65 / 2°），只取来算亮度与色差 */
export function hexToLab(hex: string): [number, number, number] {
  const [r0, g0, b0] = hexToRgb(hex).map(srgbToLinear) as Rgb;
  let x = (r0 * 0.4124 + g0 * 0.3576 + b0 * 0.1805) / 0.95047;
  let y = r0 * 0.2126 + g0 * 0.7152 + b0 * 0.0722;
  let z = (r0 * 0.0193 + g0 * 0.1192 + b0 * 0.9505) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** 感知亮度 L\*，0（黑）到 100（白）。渐变章「哪个更浅」只认它 */
export function lightness(hex: string): number {
  return hexToLab(hex)[0];
}

/** 某种颜料的亮度；不存在的名字返回 NaN，让校验器报出来而不是悄悄当 0 */
export function pigmentLightness(name: string): number {
  const hex = PIGMENT_HEX[name];
  return hex === undefined ? Number.NaN : lightness(hex);
}

/** 两色的 CIE76 色差 ΔE：越大越好分辨 */
export function deltaE(hexA: string, hexB: string): number {
  const a = hexToLab(hexA);
  const b = hexToLab(hexB);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** 两种颜料差得开不开 */
export function pigmentDeltaE(a: string, b: string): number {
  const ha = PIGMENT_HEX[a];
  const hb = PIGMENT_HEX[b];
  if (ha === undefined || hb === undefined) return 0;
  return deltaE(ha, hb);
}

/** 同一关里两种目标色至少要差这么多，孩子才分得清 */
export const MIN_TARGET_DELTA_E = 16;

/** 明暗阶梯相邻两级的亮度差下限（L\* 的百分点，即「12%」） */
export const MIN_SHADE_STEP = 12;

/** 两种颜料在同一关里能不能同时当目标色 */
export function distinguishable(a: string, b: string, min: number = MIN_TARGET_DELTA_E): boolean {
  return a === b ? true : pigmentDeltaE(a, b) >= min;
}

/** 由浅到深排好（纯函数：同亮度时按名字定序，保证结果稳定可测） */
export function sortLightToDark(names: readonly string[]): string[] {
  return names.slice().sort((x, y) => {
    const d = pigmentLightness(y) - pigmentLightness(x);
    return d !== 0 ? d : x < y ? -1 : x > y ? 1 : 0;
  });
}

/** 这一串是不是严格由浅到深，且每一级都比下一级亮出至少 `min` */
export function isLightToDark(names: readonly string[], min: number = MIN_SHADE_STEP): boolean {
  for (let i = 1; i < names.length; i++) {
    const step = pigmentLightness(names[i - 1]) - pigmentLightness(names[i]);
    if (!(step >= min)) return false;
  }
  return true;
}

/** 一串颜色里最小的相邻亮度差（少于两个就当无穷大） */
export function minShadeStep(names: readonly string[]): number {
  let worst = Number.POSITIVE_INFINITY;
  for (let i = 1; i < names.length; i++) {
    worst = Math.min(worst, pigmentLightness(names[i - 1]) - pigmentLightness(names[i]));
  }
  return worst;
}

// ---------------------------------------------------------------------------
// 受控插值（只给搅拌动画用）
// ---------------------------------------------------------------------------

/**
 * 反例，专门留给用例：把两个 hex 做 RGB 平均。
 * 蓝 `#74c0fc` 和黄 `#ffe066` 平均出来是灰扑扑的 `#bad0b1`——
 * 现实里蓝颜料加黄颜料是绿。**玩法代码一行都不许调它。**
 */
export function naiveRgbAverage(hexA: string, hexB: string): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] as Rgb);
}

/** 减色（乘法）叠色：两层透明颜料压在一起是什么样 */
export function subtractiveBlend(hexA: string, hexB: string): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex([(a[0] * b[0]) / 255, (a[1] * b[1]) / 255, (a[2] * b[2]) / 255] as Rgb);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 搅拌到 `t`（0..1）时锅里是什么颜色：
 * 先按减色把两层压在一起，再朝查表结果收敛。
 * 查不到配方就一路停在减色叠色上——锅里确实会是一团说不清的颜色。
 */
export function stirColor(a: string, b: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const ha = PIGMENT_HEX[a] ?? "#ffffff";
  const hb = PIGMENT_HEX[b] ?? "#ffffff";
  const muddy = hexToRgb(subtractiveBlend(ha, hb));
  const target = mixHex(a, b);
  if (target === null) return rgbToHex(muddy);
  const goal = hexToRgb(target);
  // 前半程看得见两色搅在一起，后半程才收到查表的那个颜色上
  const k = clamped < 0.35 ? 0 : (clamped - 0.35) / 0.65;
  return rgbToHex([lerp(muddy[0], goal[0], k), lerp(muddy[1], goal[1], k), lerp(muddy[2], goal[2], k)] as Rgb);
}
