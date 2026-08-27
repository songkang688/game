/**
 * 音符下落 · 1.3 视觉资产(纯函数,不碰玩法数值)。
 *
 * 音符 sprite、判定爆点、粒子贴图全在这儿预渲染成离屏画布,
 * `draw()` 每帧只做 `drawImage` 拼装——60fps 大量音符的性能要求。
 * 光束角度、连击弹跳这些「视觉数学」也放这里,方便单测直接断言
 * reduced-motion 下光束静止、数字不弹跳。
 */

// ---------------------------------------------------------------------------
// 调色板(索引即轨道号,和判定手感无关,只管好不好看)
// ---------------------------------------------------------------------------

/** 四条轨的主色 */
export const LANE_COLORS = ["#B79CF0", "#7FB6EC", "#F09BC0", "#7ED3A8"] as const;
/** 四条轨的底色(淡) */
export const LANE_SOFT = ["#F1EAFF", "#E8F2FD", "#FDEAF2", "#E7F8EF"] as const;
/** 没启用的轨道底色 */
export const LANE_OFF = "#F4F1F8";

/** 把 #rrggbb 往白(f>0)或黑(f<0)方向调 */
export function shadeHex(hex: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const one = (v: number): number =>
    Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  const r = one((n >> 16) & 255);
  const g = one((n >> 8) & 255);
  const b = one(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** #rrggbb → rgba(r,g,b,a) 字符串 */
export function rgbaOf(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------------------------------------------------------------------------
// 路径小工具
// ---------------------------------------------------------------------------

type Ctx2D = CanvasRenderingContext2D;

/** 圆角矩形只建路径不落笔,填充还是描边由调用方决定 */
export function tracePill(c: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rr);
  c.lineTo(x + w, y + h - rr);
  c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  c.lineTo(x + rr, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rr);
  c.lineTo(x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
}

/** N 芒星路径(判定爆点、星星粒子、判定线端点共用) */
export function traceStar(
  c: Ctx2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
  rot = -Math.PI / 2
): void {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
}

/** 四列除颜色外的列首小符号:色弱模式下靠形状也能认列 */
export const LANE_SYMBOLS = ["circle", "diamond", "triangle", "star"] as const;

/** 列首符号路径(只建路径,填充由调用方决定) */
export function traceLaneSymbol(c: Ctx2D, lane: number, cx: number, cy: number, r: number): void {
  switch (LANE_SYMBOLS[((lane % 4) + 4) % 4]) {
    case "circle":
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.closePath();
      break;
    case "diamond":
      c.beginPath();
      c.moveTo(cx, cy - r);
      c.lineTo(cx + r, cy);
      c.lineTo(cx, cy + r);
      c.lineTo(cx - r, cy);
      c.closePath();
      break;
    case "triangle":
      c.beginPath();
      c.moveTo(cx, cy - r);
      c.lineTo(cx + r * 0.9, cy + r * 0.75);
      c.lineTo(cx - r * 0.9, cy + r * 0.75);
      c.closePath();
      break;
    default:
      traceStar(c, cx, cy, r, r * 0.45, 5);
      break;
  }
}

// ---------------------------------------------------------------------------
// 离屏 sprite 预渲染(带缓存,同一键永远拿同一张)
// ---------------------------------------------------------------------------

const spriteCache = new Map<string, HTMLCanvasElement>();

function makeLayer(key: string, w: number, h: number): { cv: HTMLCanvasElement; c: Ctx2D | null } {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  spriteCache.set(key, cv);
  return { cv, c: (cv.getContext("2d") ?? null) as Ctx2D | null };
}

export type NoteKind = "tap" | "hold";

/** 音符 sprite 的预渲染尺寸(拼装时按列宽缩放) */
export const NOTE_SPRITE_W = 144;
export const NOTE_SPRITE_H = 52;

/**
 * 星光琴键:某条轨、某种音符的预渲染贴图。
 * 三层:纵向渐变主体、顶面高光条 + 底部深色厚边、中心小星压印。
 * 长按条的头部另有一圈「按住」提示环,和单点一眼有别。
 */
export function noteSprite(lane: number, kind: NoteKind): HTMLCanvasElement {
  const li = ((Math.round(lane) % 4) + 4) % 4;
  const key = `note:${li}:${kind}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;

  const { cv, c } = makeLayer(key, NOTE_SPRITE_W, NOTE_SPRITE_H);
  if (!c) return cv;
  const color = LANE_COLORS[li];
  const w = NOTE_SPRITE_W;
  const h = NOTE_SPRITE_H;
  const r = 18;

  // 1) 主体:列色亮档 → 列色 → 微暗的纵向渐变(琴键的受光面)
  const body = c.createLinearGradient(0, 2, 0, h - 2);
  body.addColorStop(0, shadeHex(color, 0.42));
  body.addColorStop(0.62, color);
  body.addColorStop(1, shadeHex(color, -0.08));
  c.fillStyle = body;
  tracePill(c, 2, 2, w - 4, h - 4, r);
  c.fill();

  // 2) 底部厚边(琴键立体感)+ 顶面高光条(上缘 30%)
  c.fillStyle = shadeHex(color, -0.32);
  tracePill(c, 6, h - 9, w - 12, 5, 3);
  c.fill();
  c.fillStyle = "rgba(255,255,255,.22)";
  tracePill(c, 8, 5, w - 16, h * 0.3, 10);
  c.fill();

  // 3) 中心小星压印:「音符=星星」呼应产品
  c.fillStyle = "rgba(255,255,255,.35)";
  traceStar(c, w / 2, h / 2, 11, 4.8, 5);
  c.fill();

  if (kind === "hold") {
    // 长按头多一圈提示环 + 左右两个小缺口点,告诉孩子「这块要按住」
    c.strokeStyle = "rgba(255,255,255,.6)";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(w / 2, h / 2, 17, 0, Math.PI * 2);
    c.closePath();
    c.stroke();
    c.fillStyle = "rgba(255,255,255,.5)";
    c.beginPath();
    c.arc(w * 0.16, h / 2, 4, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(w * 0.84, h / 2, 4, 0, Math.PI * 2);
    c.fill();
  }
  return cv;
}

export type BurstGrade = "perfect" | "good";

/** 两档判定爆点的规格:完美=金色六芒星,良好=白色四芒星(一眼有别) */
export const BURST_SPECS: Record<
  BurstGrade,
  { points: number; color: string; glow: string; label: string; size: number }
> = {
  perfect: { points: 6, color: "#FFD76A", glow: "#FFBE4D", label: "完美", size: 112 },
  good: { points: 4, color: "#FFFFFF", glow: "#7FC9F5", label: "", size: 88 },
};

/** 判定等级爆点贴图:完美金色六芒星 / 良好白色四芒星 */
export function burstSprite(grade: BurstGrade): HTMLCanvasElement {
  const key = `burst:${grade}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;

  const spec = BURST_SPECS[grade];
  const s = spec.size;
  const { cv, c } = makeLayer(key, s, s);
  if (!c) return cv;
  const cx = s / 2;

  // 光晕:从中心往外淡出
  const glow = c.createRadialGradient(cx, cx, 2, cx, cx, s / 2);
  glow.addColorStop(0, rgbaOf(spec.glow, 0.55));
  glow.addColorStop(1, rgbaOf(spec.glow, 0));
  c.fillStyle = glow;
  c.fillRect(0, 0, s, s);

  // 芒星本体 + 描边
  c.fillStyle = spec.color;
  traceStar(c, cx, cx, s * 0.4, s * 0.16, spec.points);
  c.fill();
  c.strokeStyle = rgbaOf(spec.glow, 0.9);
  c.lineWidth = 2;
  traceStar(c, cx, cx, s * 0.4, s * 0.16, spec.points);
  c.stroke();

  // 白色小核心
  c.fillStyle = "rgba(255,255,255,.92)";
  c.beginPath();
  c.arc(cx, cx, s * 0.07, 0, Math.PI * 2);
  c.fill();
  return cv;
}

export type SparkShape = "star" | "note";

/**
 * 命中粒子贴图:小星星 / 小音符两种路径,按判定档配色。
 * 以前是 `fillText("♪")` 字符,现在是真正画出来的形状。
 */
export function sparkSprite(shape: SparkShape, grade: BurstGrade): HTMLCanvasElement {
  const key = `spark:${shape}:${grade}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;

  const s = 32;
  const { cv, c } = makeLayer(key, s, s);
  if (!c) return cv;
  const color = grade === "perfect" ? "#FFBE4D" : "#7FC9F5";

  if (shape === "star") {
    c.fillStyle = color;
    traceStar(c, s / 2, s / 2, 13, 5.5, 5);
    c.fill();
    c.fillStyle = "rgba(255,255,255,.75)";
    traceStar(c, s / 2, s / 2, 5.5, 2.4, 5);
    c.fill();
  } else {
    // 小音符:符头(圆)+ 符干 + 小旗
    c.fillStyle = color;
    c.beginPath();
    c.arc(s * 0.4, s * 0.72, 6, 0, Math.PI * 2);
    c.fill();
    c.fillRect(s * 0.54, s * 0.2, 3, s * 0.52);
    c.beginPath();
    c.moveTo(s * 0.54, s * 0.2);
    c.quadraticCurveTo(s * 0.82, s * 0.3, s * 0.62, s * 0.48);
    c.quadraticCurveTo(s * 0.72, s * 0.32, s * 0.54, s * 0.3);
    c.closePath();
    c.fill();
    c.fillStyle = "rgba(255,255,255,.6)";
    c.beginPath();
    c.arc(s * 0.37, s * 0.69, 2.2, 0, Math.PI * 2);
    c.fill();
  }
  return cv;
}

/** 「完美」小字上飘的贴图:文字预渲染一次,主画布不再逐帧 fillText */
export function gradeLabelSprite(grade: BurstGrade): HTMLCanvasElement {
  const key = `label:${grade}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;

  const w = 96;
  const h = 36;
  const { cv, c } = makeLayer(key, w, h);
  if (!c) return cv;
  const spec = BURST_SPECS[grade];
  const text = spec.label || "良好";
  c.font = '900 26px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = 6;
  c.strokeStyle = "rgba(255,255,255,.9)";
  c.strokeText(text, w / 2, h / 2 + 1);
  c.fillStyle = grade === "perfect" ? "#E8912D" : "#5FA8D8";
  c.fillText(text, w / 2, h / 2 + 1);
  return cv;
}

// ---------------------------------------------------------------------------
// 舞台主题(按 levels.ts 现有章节分段查表,纯视觉)
// ---------------------------------------------------------------------------

export interface StageTheme {
  name: string;
  /** 舞台光束的底色 */
  beam: string;
  /** 判定线、倒数圆点等装饰的主色 */
  glow: string;
}

/** 三套主题色调:紫夜 / 暖橙 / 青蓝 */
export const STAGE_THEMES: readonly StageTheme[] = [
  { name: "紫夜", beam: "#B79CF0", glow: "#8A6AD6" },
  { name: "暖橙", beam: "#F5B26B", glow: "#E08A3C" },
  { name: "青蓝", beam: "#7FC4EA", glow: "#4E9CD0" },
];

/** 8 个章节轮换三套主题(只改色调,不改任何判定与谱面) */
export function themeForChapter(chapter: number): number {
  const map = [0, 2, 1, 2, 1, 0, 2, 0];
  const ci = Number.isFinite(chapter) ? Math.abs(Math.round(chapter)) : 0;
  return map[ci % map.length];
}

// ---------------------------------------------------------------------------
// 舞台光束 / 连击弹跳的视觉数学(纯函数,reduced 契约在这儿守)
// ---------------------------------------------------------------------------

/** 舞台灯的道数 */
export const BEAM_COUNT = 3;
/** 光束摆动的最大角度(度) */
export const BEAM_MAX_DEG = 5;
/** 连击到这个数光束转暖色 */
export const WARM_COMBO = 20;
/** 光束的暖色(连击奖励) */
export const BEAM_WARM = "#FFB55E";

const BEAM_BASE_DEG = [-9, 4, 12];

/** 第 index 道光束此刻的角度:随曲目进度缓慢摆动 ±5°,reduced 时静止 */
export function beamAngle(tMs: number, index: number, reduced: boolean): number {
  const base = BEAM_BASE_DEG[((index % BEAM_COUNT) + BEAM_COUNT) % BEAM_COUNT];
  if (reduced) return base;
  const t = Number.isFinite(tMs) ? tMs : 0;
  return base + Math.sin(t / 3800 + index * 2.1) * BEAM_MAX_DEG;
}

/** 光束用什么颜色:连击 ≥ 20 转暖色,平时跟主题走 */
export function beamTint(theme: StageTheme, combo: number): string {
  return combo >= WARM_COMBO ? BEAM_WARM : theme.beam;
}

/** 连击数字从这个数起显示在画布上 */
export const COMBO_SHOW_MIN = 5;
/** 连击 +1 的弹跳时长(毫秒) */
export const COMBO_POP_MS = 140;

/** 连击数字的缩放:每 +1 弹跳一下,reduced 时永远 1(静态) */
export function comboScale(sinceMs: number, reduced: boolean): number {
  if (reduced) return 1;
  if (!Number.isFinite(sinceMs) || sinceMs < 0 || sinceMs >= COMBO_POP_MS) return 1;
  return 1 + 0.28 * (1 - sinceMs / COMBO_POP_MS);
}

/** 命中处扩散圆环的时长(毫秒) */
export const RING_MS = 250;

/** 预备倒数一共几个圆点 */
export const COUNTDOWN_DOTS = 3;

/**
 * 预备倒数还剩几个亮点(3→2→1),0 表示倒数结束。
 * 与开场时间轴对齐:leadMs 是第一个音符落线的时刻,纯视觉不碰判定。
 */
export function countdownStep(tMs: number, leadMs: number): number {
  if (!(leadMs > 0) || !Number.isFinite(tMs) || tMs >= leadMs - 120) return 0;
  const left = leadMs - tMs;
  return Math.max(1, Math.min(COUNTDOWN_DOTS, Math.ceil((left / leadMs) * COUNTDOWN_DOTS)));
}

// ---------------------------------------------------------------------------
// 暂停层的内联 SVG 小图标(round2 遗留 #6:DOM 按钮/遮罩标题的 ⏸▶️ emoji 换画制)
// ---------------------------------------------------------------------------

/**
 * 暂停图标:两根圆角竖条。`fill=currentColor` 跟随所在按钮 / 标题的文字色,
 * 同一份图标在浅紫按钮(#5b4a7a)与遮罩标题(#6b4fa0)上都不用重配色。
 */
export function pauseIconSVG(size = 13): string {
  return (
    `<svg viewBox="0 0 14 14" width="${size}" height="${size}" aria-hidden="true" style="vertical-align:-1px">` +
    `<rect x="2.6" y="1.5" width="3.3" height="11" rx="1.65" fill="currentColor"/>` +
    `<rect x="8.1" y="1.5" width="3.3" height="11" rx="1.65" fill="currentColor"/>` +
    `</svg>`
  );
}

/** 继续图标:圆角小三角(与暂停图标同尺寸同色,同一颗按钮上来回切换不跳动) */
export function playIconSVG(size = 13): string {
  return (
    `<svg viewBox="0 0 14 14" width="${size}" height="${size}" aria-hidden="true" style="vertical-align:-1px">` +
    `<path d="M5 3.2 L11 6.6 Q11.7 7 11 7.4 L5 10.8 Q4.3 11.2 4.3 10.4 L4.3 3.6 Q4.3 2.8 5 3.2 Z"` +
    ` fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>` +
    `</svg>`
  );
}
