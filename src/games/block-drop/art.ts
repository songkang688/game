/**
 * 方块叠叠乐 · 1.3 视觉资产(纯绘制函数 + 纯数据)。
 *
 * 全部为 Canvas 2D 矢量绘制,复用 `src/art/kit/` 的调色板、明暗推导与粒子;
 * 玩法数值一个不碰 —— 这里只负责把「工程师原型」画成糖果果冻。
 *
 * 兼容性约定:单测跑在 node 替身环境里,2D 上下文只有最基础的
 * path / rect / arc / gradient 一族 API,所以这里
 *  - 圆角矩形用 arc 手工拼(不用 roundRect);
 *  - 椭圆一律用 arc + scale 或直接用圆;
 *  - `drawImage` 只在真浏览器里走预渲染贴图,替身环境退回直绘。
 */
import {
  KIT_PALETTE,
  drawSparkle,
  shade,
  tint
} from "../../art/kit";
import { PIECE_COLORS, cellsFor, type PieceId } from "./pieces";

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** 井壁厚度(px):左右两面、底面。井口敞开,方块从天上掉进来。 */
export const WELL_WALL = { side: 6, bottom: 8 } as const;

/** 消 4 行的彩虹描边时长(秒),纯视觉 */
export const RAINBOW_SEC = 0.3;
/** 发垃圾行的飞星时长(秒),纯视觉 */
export const SHOT_SEC = 0.4;
/** 收到垃圾行的井壁红光脉动时长(秒),纯视觉 */
export const ALARM_SEC = 0.45;

// ---------------------------------------------------------------------------
// 基础路径
// ---------------------------------------------------------------------------

/** 圆角矩形路径(用 arc 拼,单测替身没有 roundRect) */
export function rrPath(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0);
  g.lineTo(x + w, y + h - rr);
  g.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2);
  g.lineTo(x + rr, y + h);
  g.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI);
  g.lineTo(x, y + rr);
  g.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5);
  g.closePath();
}

// ---------------------------------------------------------------------------
// 1. 糖果果冻块(核心资产)
// ---------------------------------------------------------------------------

/** mark 角标只在格子够大时画(迷你预览格太小,画了也糊) */
export const MARK_MIN_PX = 20;

/**
 * 单格果冻块:底影 → 主体垂直渐变 → 顶面高光条 → 左亮边 + 右下暗边 → mark 字。
 * 五层结构,替代旧版「单色填充 + 白描边」的色纸感。
 */
export function paintCellFace(g: Ctx, x: number, y: number, size: number, base: string, mark = ""): void {
  if (!(size > 2)) return;
  const pad = Math.max(1, size * 0.045);
  const w = size - pad * 2;
  const r = Math.max(2.5, size * 0.22);
  // 1) 底影:加深的圆角矩形沉底,当落地阴影
  g.fillStyle = shade(base, 0.3);
  rrPath(g, x + pad, y + pad + Math.max(1, size * 0.07), w, size - pad * 2 - 1, r);
  g.fill();
  // 2) 主体:垂直线性渐变(顶亮 → 底沉)
  const lg = g.createLinearGradient(x, y + pad, x, y + size - pad);
  lg.addColorStop(0, tint(base, 0.24));
  lg.addColorStop(0.55, base);
  lg.addColorStop(1, shade(base, 0.1));
  g.fillStyle = lg;
  rrPath(g, x + pad, y + pad, w, size - pad * 2 - 1, r);
  g.fill();
  // 3) 顶面高光条:上缘 30% 高度的半透明白
  g.fillStyle = "rgba(255,255,255,0.32)";
  rrPath(g, x + pad * 2.2, y + pad * 2.2, w - pad * 2.4, (size - pad * 4) * 0.3, r * 0.7);
  g.fill();
  // 4) 左亮边 + 右下暗边(伪 2.5D 斜面)
  g.lineWidth = Math.max(1, size * 0.05);
  g.strokeStyle = tint(base, 0.5);
  g.beginPath();
  g.moveTo(x + pad + 1, y + size * 0.28);
  g.lineTo(x + pad + 1, y + size * 0.72);
  g.stroke();
  g.strokeStyle = shade(base, 0.26);
  g.beginPath();
  g.moveTo(x + size - pad - 1, y + size * 0.28);
  g.lineTo(x + size - pad - 1, y + size * 0.7);
  g.moveTo(x + size * 0.3, y + size - pad - 1.5);
  g.lineTo(x + size * 0.72, y + size - pad - 1.5);
  g.stroke();
  // 5) mark 角标:低龄 / 色弱玩家靠字认块,字色随格色加深
  if (mark && size >= MARK_MIN_PX) {
    g.fillStyle = shade(base, 0.52);
    g.font = `700 ${Math.round(size * 0.42)}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(mark, x + size / 2, y + size * 0.56);
  }
}

const spriteCache = new Map<string, HTMLCanvasElement>();

/**
 * 7 色 × 尺寸的离屏贴图缓存:主循环 `drawImage` 一笔贴上,
 * 替代每格十来次路径绘制。没有 document(纯 node)时返回 null。
 */
export function getCellSprite(base: string, mark: string, size: number): HTMLCanvasElement | null {
  if (typeof document === "undefined" || !(size > 2)) return null;
  const key = `${base}|${mark}|${Math.round(size)}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = Math.round(size);
  cv.height = Math.round(size);
  const g = cv.getContext("2d");
  if (!g) return null;
  paintCellFace(g, 0, 0, Math.round(size), base, mark);
  spriteCache.set(key, cv);
  return cv;
}

/**
 * 画一个果冻格:真浏览器走预渲染贴图,替身环境(无 drawImage)退回直绘。
 */
export function drawCellSprite(g: Ctx, x: number, y: number, size: number, base: string, mark = ""): void {
  const blit = (g as Partial<Ctx>).drawImage;
  if (typeof blit === "function") {
    const tile = getCellSprite(base, mark, size);
    if (tile) {
      g.drawImage(tile, Math.round(x), Math.round(y));
      return;
    }
  }
  paintCellFace(g, x, y, size, base, mark);
}

/**
 * 影子格:只描边 + 内部斜纹,和实体块形成形态差(不再只靠 alpha)。
 * 全程零 fill,方便测试断言「影子与实体走的是不同路径」。
 */
export function paintGhostCell(g: Ctx, x: number, y: number, size: number, base: string): void {
  if (!(size > 2)) return;
  const prev = g.globalAlpha;
  g.globalAlpha = 0.8;
  g.strokeStyle = shade(base, 0.22);
  g.lineWidth = Math.max(1.5, size * 0.08);
  rrPath(g, x + 2, y + 2, size - 4, size - 4, Math.max(2, size * 0.2));
  g.stroke();
  // 内部斜纹:两道 45° 细线
  g.globalAlpha = 0.4;
  g.lineWidth = Math.max(1, size * 0.05);
  g.beginPath();
  g.moveTo(x + size * 0.22, y + size * 0.72);
  g.lineTo(x + size * 0.72, y + size * 0.22);
  g.moveTo(x + size * 0.45, y + size * 0.85);
  g.lineTo(x + size * 0.85, y + size * 0.45);
  g.stroke();
  g.globalAlpha = prev;
}

// ---------------------------------------------------------------------------
// 2. 井与背景 · 花园积木箱(四段主题)
// ---------------------------------------------------------------------------

export interface WellTheme {
  id: string;
  name: string;
  /** 井内背景渐变(浅色,保证粉彩方块可读) */
  innerTop: string;
  innerBottom: string;
  grid: string;
  /** 井壁双色 */
  wallLight: string;
  wallDark: string;
  /** 远景装饰风格 */
  decor: "clouds" | "ice" | "dusk" | "night";
}

/** 188 关分四段换皮:木箱 → 冰晶 → 黄昏 → 星夜。只换常量,不碰判定。 */
export const WELL_THEMES: readonly WellTheme[] = [
  {
    id: "wood",
    name: "木箱花园",
    innerTop: "#f7faff",
    innerBottom: "#e9effc",
    grid: "#e2e9f7",
    wallLight: KIT_PALETTE.woodLight,
    wallDark: KIT_PALETTE.woodDark,
    decor: "clouds"
  },
  {
    id: "ice",
    name: "冰晶乐园",
    innerTop: "#f2fbff",
    innerBottom: "#ddeffd",
    grid: "#d8eaf8",
    wallLight: "#a8d8f0",
    wallDark: "#4f89b8",
    decor: "ice"
  },
  {
    id: "dusk",
    name: "黄昏果酱",
    innerTop: "#fff8ef",
    innerBottom: "#ffe9f0",
    grid: "#f4e0e4",
    wallLight: "#f2b273",
    wallDark: "#a05c30",
    decor: "dusk"
  },
  {
    id: "night",
    name: "星夜积木",
    innerTop: "#eef1fb",
    innerBottom: "#dde3f4",
    grid: "#cfd8ec",
    wallLight: "#7286b4",
    wallDark: "#3a486e",
    decor: "night"
  }
] as const;

/** 关号(0 基)→ 主题:188 关每 ~47 关换一段 */
export function themeForLevel(level: number): WellTheme {
  const lv = Number.isFinite(level) ? Math.max(0, Math.round(level)) : 0;
  return WELL_THEMES[Math.min(WELL_THEMES.length - 1, Math.floor(lv / 47))];
}

/** 一朵软云:三个叠圆 */
function paintCloud(g: Ctx, x: number, y: number, r: number, color: string, alpha: number): void {
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  g.arc(x - r * 0.9, y, r * 0.62, 0, TAU);
  g.arc(x, y - r * 0.3, r * 0.8, 0, TAU);
  g.arc(x + r * 0.95, y + r * 0.05, r * 0.58, 0, TAU);
  g.fill();
  g.globalAlpha = 1;
}

/** 井壁浮雕件的高度(px);宽度 ≤ WELL_WALL.side(6px) */
export const RELIEF_H = 12;

/**
 * 单件井壁浮雕(1.3 r1 · learner P9):cx 为壁中线,ty 为件顶。
 * 6×12 内的主题小件:wood=小花窗 / ice=冰晶 / dusk=果酱滴 / night=星窗。
 * 双色阶只从 wallLight 同族派生(shade 深底 + tint 亮点),条纹明暗两段上都读得出。
 */
export function paintWallRelief(g: Ctx, cx: number, ty: number, theme: WellTheme): void {
  const dark = shade(theme.wallLight, 0.32);
  const lite = tint(theme.wallLight, 0.5);
  const my = ty + RELIEF_H / 2;
  if (theme.decor === "clouds") {
    // wood · 小花窗:圆头窗一扇 + 亮色花心与花茎
    g.fillStyle = dark;
    g.beginPath();
    g.arc(cx, ty + 2.4, 2.4, Math.PI, TAU);
    g.fill();
    g.fillRect(cx - 2.4, ty + 2.4, 4.8, RELIEF_H - 2.4);
    g.fillStyle = lite;
    g.beginPath();
    g.arc(cx, ty + 4.6, 1.1, 0, TAU);
    g.fill();
    g.fillRect(cx - 0.5, ty + 6, 1, 3.8);
    return;
  }
  if (theme.decor === "ice") {
    // ice · 冰晶:竖菱形 + 亮十字芯
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(cx, ty);
    g.lineTo(cx + 2.6, my);
    g.lineTo(cx, ty + RELIEF_H);
    g.lineTo(cx - 2.6, my);
    g.closePath();
    g.fill();
    g.strokeStyle = lite;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx, ty + 2);
    g.lineTo(cx, ty + RELIEF_H - 2);
    g.moveTo(cx - 1.5, my);
    g.lineTo(cx + 1.5, my);
    g.stroke();
    return;
  }
  if (theme.decor === "dusk") {
    // dusk · 果酱滴:尖顶圆滴 + 亮高光点
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(cx, ty + 0.5);
    g.lineTo(cx + 2.3, ty + 7.4);
    g.lineTo(cx - 2.3, ty + 7.4);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(cx, ty + 8.6, 2.6, 0, TAU);
    g.fill();
    g.fillStyle = lite;
    g.beginPath();
    g.arc(cx - 0.8, ty + 7.9, 0.9, 0, TAU);
    g.fill();
    return;
  }
  // night · 星窗:深色窗身 + 亮色四角星
  g.fillStyle = dark;
  g.fillRect(cx - 2.4, ty, 4.8, RELIEF_H);
  g.fillStyle = lite;
  g.beginPath();
  g.moveTo(cx, ty + 3);
  g.lineTo(cx + 1.6, my);
  g.lineTo(cx, ty + RELIEF_H - 3);
  g.lineTo(cx - 1.6, my);
  g.closePath();
  g.fill();
}

/**
 * 井体全套:井内渐变 + 远景装饰 + 网格 + 三面井壁(双色条纹、内缘高光、螺钉、
 * 主题浮雕)。静态内容,真浏览器里由 drawWellBackground 缓存成一张离屏贴图。
 */
export function paintWellBackground(g: Ctx, w: number, h: number, cell: number, theme: WellTheme): void {
  const ws = WELL_WALL.side;
  const wb = WELL_WALL.bottom;
  const innerW = w - ws * 2;
  const innerH = h - wb;
  // 井内上下渐变
  const lg = g.createLinearGradient(0, 0, 0, innerH);
  lg.addColorStop(0, theme.innerTop);
  lg.addColorStop(1, theme.innerBottom);
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);
  // 远景装饰(画在井内顶部,方块会盖过它 —— 这是「远景」)
  const cy = cell * 1.15;
  if (theme.decor === "night") {
    for (let i = 0; i < 5; i++) {
      const sx = ws + innerW * (0.12 + i * 0.19);
      const sy = cy * (0.5 + (i % 3) * 0.45);
      drawSparkle(g, { x: sx, y: sy, r: 3 + (i % 2) * 2, t: i * 0.2, color: KIT_PALETTE.starGold });
    }
  } else {
    paintCloud(g, ws + innerW * 0.22, cy, cell * 0.5, KIT_PALETTE.cloud, theme.decor === "dusk" ? 0.75 : 0.6);
    paintCloud(g, ws + innerW * 0.72, cy * 0.72, cell * 0.4, KIT_PALETTE.cloud, 0.5);
    if (theme.decor === "dusk") {
      g.globalAlpha = 0.6;
      g.fillStyle = KIT_PALETTE.peach;
      g.beginPath();
      g.arc(ws + innerW * 0.85, cy * 1.1, cell * 0.42, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
    if (theme.decor === "ice") {
      drawSparkle(g, { x: ws + innerW * 0.5, y: cy * 0.6, r: 4, t: 0.25, color: "#cdeafc" });
      drawSparkle(g, { x: ws + innerW * 0.9, y: cy * 1.3, r: 3, t: 0.6, color: "#cdeafc" });
    }
  }
  // 网格
  const cols = Math.max(1, Math.round(innerW / cell));
  const rows = Math.max(1, Math.round(innerH / cell));
  g.strokeStyle = theme.grid;
  g.lineWidth = 1;
  g.beginPath();
  for (let c = 1; c < cols; c++) {
    g.moveTo(ws + c * cell, 0);
    g.lineTo(ws + c * cell, innerH);
  }
  for (let r = 1; r < rows; r++) {
    g.moveTo(ws, r * cell);
    g.lineTo(w - ws, r * cell);
  }
  g.stroke();
  // 三面井壁
  g.fillStyle = theme.wallLight;
  g.fillRect(0, 0, ws, h);
  g.fillRect(w - ws, 0, ws, h);
  g.fillRect(0, innerH, w, wb);
  // 双色条纹(木板 / 冰砖分节)
  g.fillStyle = shade(theme.wallLight, 0.18);
  const seg = Math.max(10, cell);
  for (let y = seg; y < innerH; y += seg * 2) {
    g.fillRect(0, y, ws, seg);
    g.fillRect(w - ws, y + seg * 0.5, ws, seg);
  }
  for (let x = seg; x < w; x += seg * 2) g.fillRect(x, innerH, seg, wb);
  // 井壁主题浮雕(1.3 r1 · learner P9):左右壁各一列、纵向每 6 格一件。
  // 顶部远景云 / 星会被堆高的方块盖住,井壁浮雕是中后期唯一还看得见的装饰。
  // 静态内容,随本函数一起进离屏缓存,零逐帧成本。
  const reliefStep = Math.max(60, cell * 6);
  for (let ry = reliefStep * 0.5; ry + RELIEF_H <= innerH - cell * 0.6; ry += reliefStep) {
    paintWallRelief(g, ws / 2, ry, theme);
    paintWallRelief(g, w - ws / 2, ry, theme);
  }
  // 内缘高光线
  g.strokeStyle = tint(theme.wallLight, 0.5);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(ws - 0.8, 0);
  g.lineTo(ws - 0.8, innerH);
  g.moveTo(w - ws + 0.8, 0);
  g.lineTo(w - ws + 0.8, innerH);
  g.moveTo(ws, innerH + 0.8);
  g.lineTo(w - ws, innerH + 0.8);
  g.stroke();
  // 外框
  g.strokeStyle = theme.wallDark;
  g.lineWidth = 2;
  g.strokeRect(1, 1, w - 2, h - 2);
  // 螺钉:井口两颗 + 井底两颗
  for (const [nx, ny] of [
    [ws / 2, cell * 0.55],
    [w - ws / 2, cell * 0.55],
    [ws / 2, innerH - cell * 0.35],
    [w - ws / 2, innerH - cell * 0.35]
  ] as const) {
    g.fillStyle = shade(theme.wallDark, 0.2);
    g.beginPath();
    g.arc(nx, ny, 2.2, 0, TAU);
    g.fill();
    g.fillStyle = tint(theme.wallLight, 0.6);
    g.beginPath();
    g.arc(nx - 0.7, ny - 0.7, 0.9, 0, TAU);
    g.fill();
  }
}

const bgCache = new Map<string, HTMLCanvasElement>();

/** 井体背景:真浏览器走离屏缓存一笔贴上,替身环境直绘 */
export function drawWellBackground(g: Ctx, w: number, h: number, cell: number, theme: WellTheme): void {
  const blit = (g as Partial<Ctx>).drawImage;
  if (typeof blit === "function" && typeof document !== "undefined") {
    const key = `${theme.id}|${w}x${h}|${cell}`;
    let cv = bgCache.get(key);
    if (!cv) {
      cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const c2 = cv.getContext("2d");
      if (c2) paintWellBackground(c2, w, h, cell, theme);
      bgCache.set(key, cv);
    }
    g.drawImage(cv, 0, 0);
    return;
  }
  paintWellBackground(g, w, h, cell, theme);
}

// ---------------------------------------------------------------------------
// 3. 消行 · 真的开花
// ---------------------------------------------------------------------------

export interface ClearParticle {
  /** 出生位置(格单位,列中心) */
  col: number;
  /** 场地行号(含缓冲行) */
  row: number;
  /** 整段动画内的位移(格单位) */
  vx: number;
  vy: number;
  kind: "petal" | "star";
  color: string;
  /** 相对格宽的尺寸 */
  size: number;
  /** 花朵自转(弧度) */
  spin: number;
}

const BLOSSOM_COLORS = [
  KIT_PALETTE.candy,
  KIT_PALETTE.lemon,
  KIT_PALETTE.lilac,
  KIT_PALETTE.mint,
  KIT_PALETTE.blush
];

/** 每行的粒子上限(规格红线:≤ 10) */
export const CLEAR_FX_PER_ROW = 10;

/**
 * 消行开花粒子:确定性布点(不吃随机数,测试可复现)。
 * soft(prefers-reduced-motion)时一颗都不出。
 */
export function makeClearBlossom(rows: readonly number[], cols: number, soft: boolean): ClearParticle[] {
  if (soft || !Array.isArray(rows) || rows.length === 0 || !(cols > 0)) return [];
  const out: ClearParticle[] = [];
  for (const row of rows) {
    for (let k = 0; k < CLEAR_FX_PER_ROW; k++) {
      const petal = k % 2 === 0;
      out.push({
        col: ((k + 0.5) / CLEAR_FX_PER_ROW) * cols,
        row,
        vx: (k - (CLEAR_FX_PER_ROW - 1) / 2) * 0.22,
        vy: -(1.1 + (k % 3) * 0.55),
        kind: petal ? "petal" : "star",
        color: petal ? BLOSSOM_COLORS[(k / 2) % BLOSSOM_COLORS.length] : KIT_PALETTE.starGold,
        size: petal ? 0.34 : 0.28,
        spin: (k % 2 === 0 ? 1 : -1) * 2.4
      });
    }
  }
  return out;
}

/** 五瓣小花:5 个花瓣圆 + 柠檬花芯 + 高光点 */
export function paintBlossom(g: Ctx, x: number, y: number, r: number, color: string, rot = 0): void {
  if (!(r > 0)) return;
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5) * TAU - Math.PI / 2;
    g.arc(x + Math.cos(a) * r * 0.58, y + Math.sin(a) * r * 0.58, r * 0.42, 0, TAU);
  }
  g.fill();
  g.fillStyle = KIT_PALETTE.lemon;
  g.beginPath();
  g.arc(x, y, r * 0.3, 0, TAU);
  g.fill();
  g.fillStyle = KIT_PALETTE.cloud;
  g.beginPath();
  g.arc(x - r * 0.1, y - r * 0.12, r * 0.1, 0, TAU);
  g.fill();
}

/**
 * 画一帧开花粒子。p 是整段消行动画的进度 0→1:
 * 30% 前还在泛金光阶段,粒子不出;30% 起弹出并向上飘散淡出。
 */
export function drawClearFx(
  g: Ctx,
  parts: readonly ClearParticle[],
  p: number,
  cell: number,
  wallSide: number,
  bufferRows: number
): void {
  const q = Math.min(1, (p - 0.3) / 0.7);
  if (q <= 0 || parts.length === 0) return;
  for (const pt of parts) {
    const vy = pt.row - bufferRows;
    if (vy < -1) continue;
    const x = wallSide + (pt.col + pt.vx * q) * cell;
    const y = (vy + 0.5 + pt.vy * q) * cell;
    const a = 1 - q;
    if (a <= 0.02 || y < -cell) continue;
    g.globalAlpha = a;
    if (pt.kind === "star") {
      drawSparkle(g, { x, y, r: cell * pt.size, t: q, color: pt.color });
    } else {
      paintBlossom(g, x, y, cell * pt.size, pt.color, q * pt.spin);
    }
  }
  g.globalAlpha = 1;
}

/** 消行整行的金光:白 → 金的垂直渐变,glow 是 0–1 强度 */
export function drawRowGlow(g: Ctx, x: number, y: number, w: number, h: number, glow: number): void {
  if (!(glow > 0)) return;
  const lg = g.createLinearGradient(0, y, 0, y + h);
  lg.addColorStop(0, "#ffffff");
  lg.addColorStop(1, KIT_PALETTE.starGold);
  g.globalAlpha = Math.min(1, glow) * 0.85;
  g.fillStyle = lg;
  g.fillRect(x, y, w, h);
  g.globalAlpha = 1;
}

const RAINBOW = [
  KIT_PALETTE.coral,
  KIT_PALETTE.starGold,
  KIT_PALETTE.grass,
  KIT_PALETTE.gem,
  KIT_PALETTE.lilac,
  KIT_PALETTE.candy
];

/** 消 4 行的彩虹描边:六色圆角框逐层内缩,q 0→1 淡出 */
export function drawRainbowEdge(g: Ctx, w: number, h: number, q: number): void {
  const a = 1 - Math.min(1, Math.max(0, q));
  if (a <= 0) return;
  g.lineWidth = 2.5;
  for (let i = 0; i < RAINBOW.length; i++) {
    g.globalAlpha = a * (1 - i * 0.1);
    g.strokeStyle = RAINBOW[i];
    const inset = 1.5 + i * 2.4;
    rrPath(g, inset, inset, w - inset * 2, h - inset * 2, 8);
    g.stroke();
  }
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// 4. 垃圾行警示 + 飞星弹
// ---------------------------------------------------------------------------

/**
 * 待落垃圾的画面语义:井底升起警示斜纹带,收到那一刻井壁泛红光(alarm 0→1)。
 */
export function drawGarbageAlarm(
  g: Ctx,
  w: number,
  h: number,
  cell: number,
  incoming: number,
  alarm: number
): void {
  if (!(incoming > 0)) return;
  const wb = WELL_WALL.bottom;
  const ws = WELL_WALL.side;
  const bandH = Math.min(4, incoming) * cell * 0.22 + 4;
  const y0 = h - wb - bandH;
  // 半透明红带
  g.globalAlpha = 0.16 + 0.2 * Math.min(1, alarm);
  g.fillStyle = KIT_PALETTE.coral;
  g.fillRect(ws, y0, w - ws * 2, bandH);
  // 警示斜纹
  g.globalAlpha = 0.4;
  g.strokeStyle = KIT_PALETTE.coral;
  g.lineWidth = 3;
  g.beginPath();
  for (let x = ws - bandH; x < w - ws; x += 14) {
    g.moveTo(Math.max(ws, x), x < ws ? y0 + (ws - x) : y0 + bandH);
    g.lineTo(Math.min(w - ws, x + bandH), y0);
  }
  g.stroke();
  // 井壁红光脉动
  if (alarm > 0) {
    g.globalAlpha = 0.75 * Math.min(1, alarm);
    g.strokeStyle = KIT_PALETTE.coral;
    g.lineWidth = 3.5;
    rrPath(g, 2, 2, w - 4, h - 4, 6);
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** 发垃圾行的飞星弹:从井顶中央斜着飞出画面,t 0→1 */
export function drawSentStar(g: Ctx, w: number, t: number): void {
  const q = Math.min(1, Math.max(0, t));
  if (q >= 1) return;
  const x = w * (0.5 + 0.42 * q);
  const y = 16 - 42 * q + 20 * q * q;
  // 尾迹
  g.globalAlpha = (1 - q) * 0.35;
  g.fillStyle = KIT_PALETTE.starGold;
  g.beginPath();
  g.arc(x - 8 * q - 4, y + 5 * q + 2, 2.4, 0, TAU);
  g.arc(x - 14 * q - 7, y + 8 * q + 3, 1.6, 0, TAU);
  g.fill();
  g.globalAlpha = 1 - q * 0.6;
  drawSparkle(g, { x, y, r: 7, t: q, color: KIT_PALETTE.starGold });
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// 5. 暂存 / 下一个 · 迷你画布
// ---------------------------------------------------------------------------

/** 把一个块画进指定小方区(居中,果冻材质同款) */
export function paintMiniPieceAt(g: Ctx, id: PieceId, x: number, y: number, w: number, h: number): void {
  const cs = cellsFor(id, 0);
  let minX = 4;
  let maxX = 0;
  let minY = 4;
  let maxY = 0;
  for (const c of cs) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const s = Math.max(6, Math.min(12, Math.floor(Math.min(w / bw, h / bh))));
  const ox = x + (w - bw * s) / 2;
  const oy = y + (h - bh * s) / 2;
  for (const c of cs) {
    drawCellSprite(g, ox + (c.x - minX) * s, oy + (c.y - minY) * s, s, PIECE_COLORS[id]);
  }
}

/**
 * 暂存小画布:有块画块,没块画一个虚位;本回合换过(locked)时盖灰罩 + 锁图标。
 */
export function paintHoldCanvas(cv: HTMLCanvasElement, id: PieceId | null, locked: boolean): void {
  const g = cv.getContext("2d");
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  g.globalAlpha = 1;
  if (id) {
    paintMiniPieceAt(g, id, 2, 2, cv.width - 4, cv.height - 4);
  } else {
    // 空位:圆角虚框 + 中线
    g.globalAlpha = 0.55;
    g.strokeStyle = "#a9bbd8";
    g.lineWidth = 1.5;
    rrPath(g, cv.width * 0.2, cv.height * 0.2, cv.width * 0.6, cv.height * 0.6, 5);
    g.stroke();
    g.beginPath();
    g.moveTo(cv.width * 0.36, cv.height * 0.5);
    g.lineTo(cv.width * 0.64, cv.height * 0.5);
    g.stroke();
    g.globalAlpha = 1;
  }
  if (locked) {
    // 45% 灰罩 + 小锁
    g.globalAlpha = 0.45;
    g.fillStyle = "#41506b";
    g.fillRect(0, 0, cv.width, cv.height);
    g.globalAlpha = 1;
    const cx = cv.width / 2;
    const cy = cv.height / 2 + 1;
    g.strokeStyle = "#f4f7ff";
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(cx, cy - 3, 4, Math.PI, TAU);
    g.stroke();
    g.fillStyle = "#f4f7ff";
    rrPath(g, cx - 6, cy - 3, 12, 9, 2);
    g.fill();
    g.fillStyle = "#41506b";
    g.beginPath();
    g.arc(cx, cy + 1.2, 1.5, 0, TAU);
    g.fill();
  }
}

/** 下一个队列:纵向一格一个,真实形状迷你块 */
export function paintNextCanvas(cv: HTMLCanvasElement, ids: readonly PieceId[]): void {
  const g = cv.getContext("2d");
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  g.globalAlpha = 1;
  if (ids.length === 0) return;
  const slotH = cv.height / ids.length;
  ids.forEach((id, i) => {
    if (i > 0) {
      g.globalAlpha = 0.5;
      g.strokeStyle = "#c7d5ec";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cv.width * 0.14, i * slotH);
      g.lineTo(cv.width * 0.86, i * slotH);
      g.stroke();
      g.globalAlpha = 1;
    }
    paintMiniPieceAt(g, id, 2, i * slotH + 2, cv.width - 4, slotH - 4);
  });
}

// ---------------------------------------------------------------------------
// 6. 结算奖杯
// ---------------------------------------------------------------------------

/**
 * 结算奖杯:碗身 + 双把手 + 柱 + 底座 + 星饰 + 高光。
 * gold=false 时画银灰色(惜败也有参与奖)。
 */
export function paintTrophy(g: Ctx, cx: number, cy: number, r: number, gold: boolean): void {
  if (!(r > 0)) return;
  const base = gold ? KIT_PALETTE.starGold : "#c3cddd";
  const dark = shade(base, 0.32);
  const light = tint(base, 0.55);
  g.globalAlpha = 1;
  // 底座(木色台)
  g.fillStyle = KIT_PALETTE.woodLight;
  rrPath(g, cx - r * 0.62, cy + r * 0.66, r * 1.24, r * 0.3, r * 0.08);
  g.fill();
  g.fillStyle = shade(KIT_PALETTE.woodLight, 0.25);
  rrPath(g, cx - r * 0.46, cy + r * 0.52, r * 0.92, r * 0.2, r * 0.06);
  g.fill();
  // 柱
  g.fillStyle = dark;
  g.fillRect(cx - r * 0.12, cy + r * 0.24, r * 0.24, r * 0.34);
  // 把手
  g.strokeStyle = dark;
  g.lineWidth = Math.max(2, r * 0.12);
  g.beginPath();
  g.arc(cx - r * 0.6, cy - r * 0.18, r * 0.24, Math.PI * 0.4, Math.PI * 1.6);
  g.stroke();
  g.beginPath();
  g.arc(cx + r * 0.6, cy - r * 0.18, r * 0.24, Math.PI * 1.4, Math.PI * 0.6);
  g.stroke();
  // 碗身:下半圆
  g.fillStyle = base;
  g.beginPath();
  g.arc(cx, cy - r * 0.28, r * 0.58, 0, Math.PI);
  g.closePath();
  g.fill();
  // 碗口沿
  g.fillStyle = light;
  rrPath(g, cx - r * 0.66, cy - r * 0.46, r * 1.32, r * 0.2, r * 0.08);
  g.fill();
  // 左侧高光
  g.strokeStyle = light;
  g.lineWidth = Math.max(1.5, r * 0.08);
  g.beginPath();
  g.moveTo(cx - r * 0.32, cy - r * 0.2);
  g.lineTo(cx - r * 0.24, cy + r * 0.08);
  g.stroke();
  // 星饰
  drawSparkle(g, { x: cx + r * 0.16, y: cy - r * 0.04, r: r * 0.2, t: 0.25, color: KIT_PALETTE.cloud });
}
