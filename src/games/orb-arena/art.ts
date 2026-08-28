/**
 * 圆圆大作战 · 1.3 视觉资产（纯绘制层,零玩法数值）。
 *
 * 全部是「只吃传入 ctx」的纯绘制函数:不查 DOM(除 makePelletSprites 的
 * offscreen 预渲染)、不挂监听、不碰 logic/ai/levels。调色与光影推导一律
 * 复用共享素材包 `src/art/kit/`(视觉宪法:凡 kit 有的不许重抄)。
 *
 * 兼容性约定:仓库单测跑在 node 环境,画布替身只认
 * arc / moveTo / lineTo / rect / fillRect / 渐变 / translate / rotate / scale
 * 这些基础调用,所以这里的椭圆用「变换 + 单位圆」画、月牙用采样折线画、
 * 精灵图走 `drawImage` 能力探测,探测不到就逐帧矢量兜底。
 */

import { KIT_PALETTE, drawSparkle, hexToRgb, shade, tint } from "../../art/kit";

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function fin(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** `#rrggbb` + 透明度 → `rgba()`;非法 hex 原样返回,不抛 */
function rgba(hex: string, a: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

/** 标准五角星/N 芒星路径(kit 未导出此原语,这里自备一份纯路径) */
function pathStar(g: Ctx, cx: number, cy: number, rOut: number, rIn: number, rot = -Math.PI / 2, points = 5): void {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = rot + (i * Math.PI) / points;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/** 椭圆路径:变换 + 单位圆,替身环境没有 ctx.ellipse 也能画 */
function pathOval(g: Ctx, cx: number, cy: number, rx: number, ry: number, rot = 0): void {
  const sx = Math.max(0.1, rx);
  const sy = Math.max(0.1, ry);
  g.save();
  g.translate(cx, cy);
  if (rot !== 0) g.rotate(rot);
  g.scale(sx, sy);
  g.beginPath();
  g.arc(0, 0, 1, 0, TAU);
  g.restore();
}

/** 月牙路径(开口朝右):外弧 + 内弧全用采样折线,环境无关 */
function pathMoon(g: Ctx, cx: number, cy: number, r: number): void {
  const d = r * 0.55;
  const r2 = Math.sqrt(d * d + r * r);
  const steps = 14;
  g.beginPath();
  // 外弧:从顶点走左侧到底点
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 - (Math.PI * i) / steps;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  // 内弧:沿偏移圆从底点回到顶点
  const aBot = Math.atan2(r, -d);
  const aTop = TAU - aBot;
  for (let i = 1; i <= steps; i++) {
    const a = aBot + ((aTop - aBot) * i) / steps;
    g.lineTo(cx + d + Math.cos(a) * r2, cy + Math.sin(a) * r2);
  }
  g.closePath();
}

// ---------------------------------------------------------------------------
// 关卡主题:每 ~47 关换一组调色(只换背景/网格/墙色,数值一概不动)
// ---------------------------------------------------------------------------

export interface ArenaTheme {
  name: string;
  bgTop: string;
  bgBottom: string;
  grid: string;
  blob: string;
  wallA: string;
  wallB: string;
}

export const ARENA_THEMES: readonly ArenaTheme[] = [
  { name: "糖果紫", bgTop: "#fbf7ff", bgBottom: "#efe6ff", grid: "#8f78d8", blob: "#d9c6f5", wallA: "#f2b8d8", wallB: "#fff3fa" },
  { name: "海洋青", bgTop: "#f2fcff", bgBottom: "#def2f8", grid: "#4fa8bf", blob: "#bfe6f0", wallA: "#9fd8e8", wallB: "#f4fdff" },
  { name: "黄昏橙", bgTop: "#fff9f0", bgBottom: "#ffe8d5", grid: "#d98a4f", blob: "#ffd9b8", wallA: "#ffc48f", wallB: "#fff8ef" },
  { name: "星夜蓝", bgTop: "#eef1fb", bgBottom: "#dbe2f5", grid: "#6e83c4", blob: "#c3cdf0", wallA: "#8fa3e0", wallB: "#f2f5ff" }
];

/** 每 47 关一段;混战/无尽/双人(level < 0)用第一套糖果紫 */
export function themeFor(level: number): ArenaTheme {
  if (!fin(level) || level < 0) return ARENA_THEMES[0];
  return ARENA_THEMES[Math.min(ARENA_THEMES.length - 1, Math.floor(level / 47))];
}

/** 人类头饰配色:P1 金星 / P2 银月(形状 + 颜色双通道,色弱也能分) */
export const CREST_COLORS = { star: KIT_PALETTE.starGold, moon: "#d7dce8" } as const;

// ---------------------------------------------------------------------------
// 背景:糖果竞技场(渐变底 + 6% 网格 + 视差圆斑 + 糖果条纹墙)
// ---------------------------------------------------------------------------

export interface BackgroundOpts {
  w: number;
  h: number;
  camX: number;
  camY: number;
  zoom: number;
  mapW: number;
  mapH: number;
  theme: ArenaTheme;
}

/** 视差圆斑的确定性布点(u, v, 相对尺寸),不引随机源 */
const BLOB_SEEDS: ReadonlyArray<readonly [number, number, number]> = [
  [0.13, 0.2, 0.36],
  [0.52, 0.06, 0.44],
  [0.84, 0.32, 0.3],
  [0.24, 0.64, 0.48],
  [0.66, 0.78, 0.36],
  [0.95, 0.58, 0.3],
  [0.42, 0.42, 0.52]
];

/** 竞技场边界墙厚度(世界像素) */
export const WALL_WORLD = 30;

// ---------------------------------------------------------------------------
// 中景具象贴片(1.3 r1 · learner P2):圆斑层之上、网格层之下,
// 把「7 粒无形柔光斑」补成具象中景(五瓣小花 / 四芒星 / 糖果石子三式)。
// 确定性哈希布点(写法参照 snake-royale/art.ts 的 hash2,注明出处、不引随机源);
// 视差 0.3 与圆斑层同系数(不添第三档速度);贴片静态,soft 无差别。
// ---------------------------------------------------------------------------

/** 贴片布点的世界格边(约 40% 格出件,八成画面留白) */
export const DECOR_CELL = 176;
/** 贴片层视差系数(与圆斑层同 0.3) */
export const DECOR_PARALLAX = 0.3;

/** 确定性二维哈希(搬自 snake-royale/art.ts hash2):同一格永远同一件 */
function hash2(ix: number, iy: number): number {
  const a = Math.imul((Math.round(fin(ix) ? ix : 0) | 0) + 0x9e3779b9, 0x85ebca6b);
  const b = Math.imul((Math.round(fin(iy) ? iy : 0) | 0) + 0x165667b1, 0xc2b2ae35);
  const m = Math.imul(a ^ (b >>> 13), 0x27d4eb2f);
  return (m ^ (m >>> 15)) >>> 0;
}

export interface ArenaDecor {
  /** 0 五瓣小花 / 1 四芒星 / 2 糖果石子 */
  kind: 0 | 1 | 2;
  /** 格内偏移(0..1) */
  u: number;
  v: number;
  /** 世界半径 3–5px(直径 6–10px) */
  s: number;
  /** 0.35–0.5,永不超 0.5 */
  alpha: number;
}

/** 某格出什么贴片(确定性;六成格子留白返回 null) */
export function decorAt(ix: number, iy: number): ArenaDecor | null {
  const h = hash2(ix, iy);
  if (h % 5 >= 2) return null; // 40% 格出件
  return {
    kind: (h % 3) as 0 | 1 | 2,
    u: ((h >>> 5) % 97) / 97,
    v: ((h >>> 11) % 89) / 89,
    s: 3 + ((h >>> 17) % 3),
    alpha: 0.35 + (((h >>> 21) % 16) / 15) * 0.15
  };
}

/** 单件贴片矢量画法(纯 fill,不加渐变;也是精灵图底稿) */
export function paintArenaDecor(g: Ctx, x: number, y: number, s: number, kind: 0 | 1 | 2, theme: ArenaTheme): void {
  if (!fin(x) || !fin(y) || !fin(s) || s <= 0) return;
  if (kind === 0) {
    // 五瓣小花:5 圆瓣 + 1 圆心
    g.fillStyle = tint(theme.blob, 0.3);
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k / 5) * TAU;
      g.beginPath();
      g.arc(x + Math.cos(a) * s * 0.62, y + Math.sin(a) * s * 0.62, s * 0.5, 0, TAU);
      g.fill();
    }
    g.fillStyle = shade(theme.blob, 0.15);
    g.beginPath();
    g.arc(x, y, s * 0.4, 0, TAU);
    g.fill();
    return;
  }
  if (kind === 1) {
    // 四芒星:主体 + 中心亮点
    g.fillStyle = shade(theme.blob, 0.15);
    pathStar(g, x, y, s, s * 0.4, -Math.PI / 2, 4);
    g.fill();
    g.fillStyle = tint(theme.blob, 0.5);
    g.beginPath();
    g.arc(x, y - s * 0.1, s * 0.22, 0, TAU);
    g.fill();
    return;
  }
  // 糖果石子:圆 + 左上高光点(两阶)
  g.fillStyle = shade(theme.blob, 0.1);
  g.beginPath();
  g.arc(x, y, s * 0.85, 0, TAU);
  g.fill();
  g.fillStyle = tint(theme.blob, 0.45);
  g.beginPath();
  g.arc(x - s * 0.26, y - s * 0.3, s * 0.3, 0, TAU);
  g.fill();
}

/** 贴片精灵缓存(3 式 × 主题;node 单测环境建不出来就走矢量兜底) */
const decorSpriteCache = new Map<string, HTMLCanvasElement | null>();

function decorSprite(theme: ArenaTheme, kind: 0 | 1 | 2): HTMLCanvasElement | null {
  const key = `${theme.name}#${kind}`;
  const hit = decorSpriteCache.get(key);
  if (hit !== undefined) return hit;
  let made: HTMLCanvasElement | null = null;
  try {
    if (typeof document !== "undefined") {
      const base = 12;
      const pad = Math.ceil(base * 1.6) + 2;
      const c = document.createElement("canvas");
      c.width = pad * 2;
      c.height = pad * 2;
      const g = c.getContext("2d");
      if (g) {
        paintArenaDecor(g as Ctx, pad, pad, base, kind, theme);
        made = c;
      }
    }
  } catch {
    made = null;
  }
  decorSpriteCache.set(key, made);
  return made;
}

/** 贴片层:主循环里每件要么 drawImage 一笔贴,要么矢量兜底 */
function drawArenaDecorLayer(g: Ctx, o: BackgroundOpts): void {
  const { w, h, zoom, theme } = o;
  const px = o.camX * DECOR_PARALLAX;
  const py = o.camY * DECOR_PARALLAX;
  const halfW = w / 2 / zoom;
  const halfH = h / 2 / zoom;
  const ix0 = Math.floor((px - halfW) / DECOR_CELL) - 1;
  const ix1 = Math.ceil((px + halfW) / DECOR_CELL) + 1;
  const iy0 = Math.floor((py - halfH) / DECOR_CELL) - 1;
  const iy1 = Math.ceil((py + halfH) / DECOR_CELL) + 1;
  let budget = 240;
  const canBlit = typeof (g as { drawImage?: unknown }).drawImage === "function";
  g.save();
  for (let iy = iy0; iy <= iy1 && budget > 0; iy++) {
    for (let ix = ix0; ix <= ix1 && budget > 0; ix++) {
      budget--;
      const d = decorAt(ix, iy);
      if (!d) continue;
      const wx = (ix + d.u) * DECOR_CELL;
      const wy = (iy + d.v) * DECOR_CELL;
      const sx = w / 2 + (wx - px) * zoom;
      const sy = h / 2 + (wy - py) * zoom;
      const s = Math.max(2.8, d.s * zoom);
      if (sx < -s * 2 || sy < -s * 2 || sx > w + s * 2 || sy > h + s * 2) continue;
      g.globalAlpha = d.alpha;
      const sprite = canBlit ? decorSprite(theme, d.kind) : null;
      if (sprite) {
        const dw = sprite.width * (s / 12);
        g.drawImage(sprite, sx - dw / 2, sy - dw / 2, dw, dw);
      } else {
        paintArenaDecor(g, sx, sy, s, d.kind, theme);
      }
    }
  }
  g.restore();
}

export function drawArenaBackground(g: Ctx, o: BackgroundOpts): void {
  if (!fin(o.w) || !fin(o.h) || o.w <= 0 || o.h <= 0 || !fin(o.zoom) || o.zoom <= 0) return;
  const { w, h, zoom, theme } = o;

  // 1) 底层线性渐变
  const lg = g.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0, theme.bgTop);
  lg.addColorStop(1, theme.bgBottom);
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);

  // 2) 顶层视差圆斑(系数 0.3 跟随相机慢移;位置随镜头,不自转不闪烁)
  const spanX = w + 320;
  const spanY = h + 320;
  for (const [u, v, s] of BLOB_SEEDS) {
    const sx = ((((u * spanX - o.camX * zoom * 0.3) % spanX) + spanX) % spanX) - 160;
    const sy = ((((v * spanY - o.camY * zoom * 0.3) % spanY) + spanY) % spanY) - 160;
    const br = s * Math.min(w, h);
    const rg = g.createRadialGradient(sx, sy, br * 0.1, sx, sy, br);
    rg.addColorStop(0, rgba(theme.blob, 0.4));
    rg.addColorStop(1, rgba(theme.blob, 0));
    g.fillStyle = rg;
    g.beginPath();
    g.arc(sx, sy, br, 0, TAU);
    g.fill();
  }

  // 2.5) 中景具象贴片(圆斑层之上、网格层之下;确定性哈希,约 40% 格出件)
  drawArenaDecorLayer(g, o);

  // 3) 中层网格降到 6% 透明
  const step = 100 * zoom;
  if (step > 6) {
    g.save();
    g.globalAlpha = 0.06;
    g.strokeStyle = theme.grid;
    g.lineWidth = 1;
    for (let x = (((-o.camX * zoom + w / 2) % step) + step) % step; x < w; x += step) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = (((-o.camY * zoom + h / 2) % step) + step) % step; y < h; y += step) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.restore();
  }

  // 4) 世界边缘的糖果条纹墙:走到头看见的是墙,不是「突然没了」
  const toX = (x: number): number => w / 2 + (x - o.camX) * zoom;
  const toY = (y: number): number => h / 2 + (y - o.camY) * zoom;
  const vx0 = o.camX - w / 2 / zoom;
  const vx1 = o.camX + w / 2 / zoom;
  const vy0 = o.camY - h / 2 / zoom;
  const vy1 = o.camY + h / 2 / zoom;
  const seg = 72;
  const wt = WALL_WORLD * zoom;
  const edgeColor = shade(theme.wallA, 0.35);

  const stripesV = (edgeX: number, outward: number): void => {
    const sx = toX(edgeX + Math.min(0, outward * WALL_WORLD));
    const i0 = Math.floor(Math.max(vy0, -WALL_WORLD) / seg);
    const i1 = Math.ceil(Math.min(vy1, o.mapH + WALL_WORLD) / seg);
    for (let i = i0; i < i1; i++) {
      g.fillStyle = (((i % 2) + 2) % 2) === 0 ? theme.wallA : theme.wallB;
      g.fillRect(sx, toY(i * seg), wt, seg * zoom + 1);
    }
    g.strokeStyle = edgeColor;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(toX(edgeX), toY(Math.max(vy0, 0)));
    g.lineTo(toX(edgeX), toY(Math.min(vy1, o.mapH)));
    g.stroke();
  };
  const stripesH = (edgeY: number, outward: number): void => {
    const sy = toY(edgeY + Math.min(0, outward * WALL_WORLD));
    const i0 = Math.floor(Math.max(vx0, -WALL_WORLD) / seg);
    const i1 = Math.ceil(Math.min(vx1, o.mapW + WALL_WORLD) / seg);
    for (let i = i0; i < i1; i++) {
      g.fillStyle = (((i % 2) + 2) % 2) === 0 ? theme.wallA : theme.wallB;
      g.fillRect(toX(i * seg), sy, seg * zoom + 1, wt);
    }
    g.strokeStyle = edgeColor;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(toX(Math.max(vx0, 0)), toY(edgeY));
    g.lineTo(toX(Math.min(vx1, o.mapW)), toY(edgeY));
    g.stroke();
  };

  if (vx0 < 0) stripesV(0, -1);
  if (vx1 > o.mapW) stripesV(o.mapW, 1);
  if (vy0 < 0) stripesH(0, -1);
  if (vy1 > o.mapH) stripesH(o.mapH, 1);
}

// ---------------------------------------------------------------------------
// 缩圈:风暴光环(双层描边 + 圈外罩 + 绕行光点)
// ---------------------------------------------------------------------------

export interface ZoneOpts {
  x: number;
  y: number;
  r: number;
  w: number;
  h: number;
  /** 秒级时间,驱动光点绕行 */
  t: number;
  soft: boolean;
  /** 这一局圈会不会收(会收才亮绕行光点) */
  shrinking: boolean;
}

/** 缩圈进行时绕行的光点数 */
export const ZONE_ORBIT_DOTS = 8;

export function drawZone(g: Ctx, o: ZoneOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  // 圈外罩:rect + 圆 evenodd 挖洞,「圈外危险」一眼可见
  g.fillStyle = "rgba(127,184,196,0.12)";
  g.beginPath();
  g.rect(0, 0, o.w, o.h);
  g.arc(o.x, o.y, o.r, 0, TAU);
  g.fill("evenodd");
  // 内圈光带
  g.strokeStyle = "rgba(80,196,214,0.4)";
  g.lineWidth = 6;
  g.beginPath();
  g.arc(o.x, o.y, o.r, 0, TAU);
  g.stroke();
  // 外圈实线
  g.strokeStyle = "#38a8c2";
  g.lineWidth = 2;
  g.beginPath();
  g.arc(o.x, o.y, o.r, 0, TAU);
  g.stroke();
  // 缩圈时的绕行光点(soft 关动效:一颗都不画)
  if (o.shrinking && !o.soft) {
    const t = fin(o.t) ? o.t : 0;
    for (let i = 0; i < ZONE_ORBIT_DOTS; i++) {
      const a = t * 0.5 + (i * TAU) / ZONE_ORBIT_DOTS;
      drawSparkle(g, {
        x: o.x + Math.cos(a) * o.r,
        y: o.y + Math.sin(a) * o.r,
        r: 5,
        t: t * 0.4 + i / ZONE_ORBIT_DOTS,
        color: "#bdeff7"
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 彩豆 → 星光糖:三种造型 + 确定性哈希选型 + offscreen 预渲染
// ---------------------------------------------------------------------------

export type CandyKind = 0 | 1 | 2;

/** 彩豆造型:0 五角星糖 / 1 圆糖带十字高光 / 2 四瓣花糖 */
export const CANDY_COLORS: readonly string[] = [KIT_PALETTE.starGold, "#f78cc0", "#b89af0"];

/** 确定性哈希:同一颗豆永远同一造型同一相位,不引入新的随机源 */
export function pelletStyle(x: number, y: number): { kind: CandyKind; phase: number } {
  const hx = fin(x) ? x : 0;
  const hy = fin(y) ? y : 0;
  const h = Math.abs(Math.round(hx * 7 + hy * 11));
  return { kind: (h % 3) as CandyKind, phase: (h % 89) / 89 };
}

/**
 * 星光糖矢量画法(也是精灵图的底稿):主体渐变 + 白描边 + 高光,
 * 绝不是单次 fill 的纯色圆。`soft` 时摆动/闪烁全部停住。
 */
export function paintStarCandy(g: Ctx, x: number, y: number, r: number, kind: CandyKind, phase: number, t: number, soft: boolean): void {
  if (!fin(x) || !fin(y) || !fin(r) || r <= 0) return;
  const ph = fin(phase) ? phase : 0;
  const tt = fin(t) ? t : 0;
  const k = ((Math.round(kind) % 3) + 3) % 3;
  const base = CANDY_COLORS[k];

  if (k === 0) {
    // 五角星糖:±15° 摆动
    const wob = soft ? 0 : Math.sin(tt * 2.1 + ph * TAU) * 0.26;
    g.save();
    g.translate(x, y);
    if (wob !== 0) g.rotate(wob);
    const rg = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.12, 0, 0, r * 1.3);
    rg.addColorStop(0, tint(base, 0.5));
    rg.addColorStop(1, shade(base, 0.06));
    pathStar(g, 0, 0, r * 1.3, r * 0.62);
    g.fillStyle = rg;
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = Math.max(1, r * 0.16);
    g.lineJoin = "round";
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.beginPath();
    g.arc(-r * 0.28, -r * 0.3, Math.max(0.8, r * 0.2), 0, TAU);
    g.fill();
    g.restore();
    return;
  }

  if (k === 1) {
    // 圆糖:渐变主体 + 白描边 + 十字高光(闪烁)
    const rg = g.createRadialGradient(x - r * 0.32, y - r * 0.36, r * 0.12, x, y, r);
    rg.addColorStop(0, tint(base, 0.45));
    rg.addColorStop(1, shade(base, 0.08));
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = Math.max(1, r * 0.14);
    g.stroke();
    const tw = soft ? 0.85 : 0.6 + 0.4 * Math.abs(Math.sin(tt * 2.6 + ph * TAU));
    g.fillStyle = "rgba(255,255,255,0.9)";
    pathStar(g, x - r * 0.24, y - r * 0.28, r * 0.5 * tw, r * 0.16 * tw, -Math.PI / 2, 4);
    g.fill();
    return;
  }

  // 四瓣花糖:轻微脉动
  const pu = soft ? 1 : 1 + 0.06 * Math.sin(tt * 2.2 + ph * TAU);
  g.save();
  g.translate(x, y);
  g.scale(pu, pu);
  g.fillStyle = base;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + ph * 0.8;
    pathOval(g, Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, r * 0.55, r * 0.34, a);
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = Math.max(0.8, r * 0.1);
    g.stroke();
  }
  const cg = g.createRadialGradient(0, 0, r * 0.05, 0, 0, r * 0.5);
  cg.addColorStop(0, tint(KIT_PALETTE.lemon, 0.4));
  cg.addColorStop(1, shade(KIT_PALETTE.lemon, 0.12));
  g.fillStyle = cg;
  g.beginPath();
  g.arc(0, 0, r * 0.42, 0, TAU);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.beginPath();
  g.arc(-r * 0.14, -r * 0.16, Math.max(0.6, r * 0.12), 0, TAU);
  g.fill();
  g.restore();
}

export interface PelletSprites {
  kinds: Array<Array<{ canvas: HTMLCanvasElement; r: number }>>;
}

/**
 * 预渲染星光糖到 offscreen canvas(3 种 × 2 尺寸),主循环 drawImage,
 * 免得上千个 arc 的开销回归。建不出来(node 单测环境)返回 null,走矢量兜底。
 */
export function makePelletSprites(): PelletSprites | null {
  try {
    if (typeof document === "undefined") return null;
    const sizes = [5, 9];
    const kinds: PelletSprites["kinds"] = [];
    for (let k = 0; k < 3; k++) {
      const row: PelletSprites["kinds"][number] = [];
      for (const r of sizes) {
        const pad = Math.ceil(r * 1.7) + 2;
        const c = document.createElement("canvas");
        c.width = pad * 2;
        c.height = pad * 2;
        const g = c.getContext("2d");
        if (!g) return null;
        paintStarCandy(g, pad, pad, r, k as CandyKind, 0.35, 0, true);
        row.push({ canvas: c, r });
      }
      kinds.push(row);
    }
    return { kinds };
  } catch {
    return null;
  }
}

/** 主循环画一颗糖:有精灵图且环境支持 drawImage 就贴图,否则矢量兜底 */
export function drawPellet(
  g: Ctx,
  sprites: PelletSprites | null,
  x: number,
  y: number,
  r: number,
  kind: CandyKind,
  phase: number,
  t: number,
  soft: boolean
): void {
  if (!fin(x) || !fin(y) || !fin(r) || r <= 0) return;
  const k = (((Math.round(kind) % 3) + 3) % 3) as CandyKind;
  const canBlit = sprites !== null && typeof (g as { drawImage?: unknown }).drawImage === "function";
  if (canBlit && sprites) {
    const s = sprites.kinds[k][r > 6.5 ? 1 : 0];
    const dw = s.canvas.width * (r / s.r);
    const wob = !soft && k === 0 ? Math.sin(t * 2.1 + phase * TAU) * 0.26 : 0;
    if (wob !== 0) {
      g.save();
      g.translate(x, y);
      g.rotate(wob);
      g.drawImage(s.canvas, -dw / 2, -dw / 2, dw, dw);
      g.restore();
    } else {
      g.drawImage(s.canvas, x - dw / 2, y - dw / 2, dw, dw);
    }
    return;
  }
  paintStarCandy(g, x, y, r, k, phase, t, soft);
}

// ---------------------------------------------------------------------------
// 孢子:带高光的小水珠(与彩豆一眼可分:单色系、无糖果描边)
// ---------------------------------------------------------------------------

export function drawSpore(g: Ctx, x: number, y: number, r: number, color?: string): void {
  if (!fin(x) || !fin(y) || !fin(r) || r <= 0) return;
  const base = typeof color === "string" && hexToRgb(color) ? color : "#cdefc0";
  const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.34, r * 0.1, x, y, r);
  rg.addColorStop(0, tint(base, 0.4));
  rg.addColorStop(1, shade(base, 0.1));
  g.fillStyle = rg;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.strokeStyle = shade(base, 0.3);
  g.lineWidth = Math.max(0.8, r * 0.12);
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.beginPath();
  g.arc(x - r * 0.3, y - r * 0.32, Math.max(0.6, r * 0.24), 0, TAU);
  g.fill();
}

// ---------------------------------------------------------------------------
// 刺球 → 危险仙人掌球:渐变内芯 + 逐根尖刺 + 凶脸 + 呼吸
// ---------------------------------------------------------------------------

/** 仙人掌球的刺数 */
export const SPIKE_COUNT = 12;

export function drawSpikeBall(g: Ctx, x: number, y: number, r: number, t: number, soft: boolean): void {
  if (!fin(x) || !fin(y) || !fin(r) || r <= 0) return;
  const tt = fin(t) ? t : 0;
  // 呼吸 ±3% 正弦;soft 停住
  const R = r * (soft ? 1 : 1 + 0.03 * Math.sin(tt * 2.4));

  // 尖刺:刺根粗尖细,逐根三角形 + 刺尖描深绿
  const rootR = R * 0.82;
  const tipR = R * 1.26;
  const halfW = 0.17;
  g.fillStyle = "#6db56f";
  for (let i = 0; i < SPIKE_COUNT; i++) {
    const a = (i * TAU) / SPIKE_COUNT;
    g.beginPath();
    g.moveTo(x + Math.cos(a - halfW) * rootR, y + Math.sin(a - halfW) * rootR);
    g.lineTo(x + Math.cos(a + halfW) * rootR, y + Math.sin(a + halfW) * rootR);
    g.lineTo(x + Math.cos(a) * tipR, y + Math.sin(a) * tipR);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = "#3f7f44";
  g.lineWidth = Math.max(1, R * 0.045);
  for (let i = 0; i < SPIKE_COUNT; i++) {
    const a = (i * TAU) / SPIKE_COUNT;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * R * 0.92, y + Math.sin(a) * R * 0.92);
    g.lineTo(x + Math.cos(a) * tipR, y + Math.sin(a) * tipR);
    g.stroke();
  }

  // 内芯径向渐变
  const rg = g.createRadialGradient(x - R * 0.3, y - R * 0.32, R * 0.12, x, y, R * 0.92);
  rg.addColorStop(0, "#8fd48f");
  rg.addColorStop(1, "#5ca85c");
  g.fillStyle = rg;
  g.beginPath();
  g.arc(x, y, R * 0.9, 0, TAU);
  g.fill();
  g.strokeStyle = shade("#5ca85c", 0.25);
  g.lineWidth = Math.max(1, R * 0.05);
  g.stroke();
  // 左上高光
  g.fillStyle = "rgba(255,255,255,0.45)";
  pathOval(g, x - R * 0.32, y - R * 0.36, R * 0.24, R * 0.13, -0.5);
  g.fill();

  // 凶脸:倒八字眉 + 皱眉嘴,「碰不得」一眼可读(圆润不狰狞)
  if (R > 7) {
    const ink = "#2f5a33";
    g.strokeStyle = ink;
    g.lineWidth = Math.max(1, R * 0.07);
    g.lineCap = "round";
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(x + side * R * 0.4, y - R * 0.34);
      g.lineTo(x + side * R * 0.13, y - R * 0.2);
      g.stroke();
    }
    g.fillStyle = ink;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(x + side * R * 0.26, y - R * 0.04, Math.max(0.8, R * 0.09), 0, TAU);
      g.fill();
    }
    g.beginPath();
    g.arc(x, y + R * 0.42, R * 0.26, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  }
}

// ---------------------------------------------------------------------------
// 圆圆 → 有脸的果冻球(核心资产)
// ---------------------------------------------------------------------------

export interface JellyOrbOpts {
  x: number;
  y: number;
  r: number;
  color: string;
  /** 瞳孔朝向(单位向量,可缺省) */
  lookX?: number;
  lookY?: number;
  /** 表情:平时微笑 / 吞吃张嘴 / 被吞惊讶 O 嘴 */
  mouth?: "smile" | "eat" | "oops";
  /** 人类头饰:P1 五角星 / P2 月牙;AI 不戴 */
  crest?: "star" | "moon" | null;
  crestColor?: string;
  /** 排行榜 16–22px 头像:强制画脸 */
  avatar?: boolean;
  soft?: boolean;
}

export function drawJellyOrb(g: Ctx, o: JellyOrbOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const { x, y, r } = o;
  const base = typeof o.color === "string" && hexToRgb(o.color) ? o.color : "#d9c6f5";

  // 1) 径向渐变主体:中心提亮、边缘压暗(伪体积三件套之一)
  const rg = g.createRadialGradient(x - r * 0.32, y - r * 0.36, r * 0.12, x, y, r);
  rg.addColorStop(0, tint(base, 0.3));
  rg.addColorStop(0.72, base);
  rg.addColorStop(1, shade(base, 0.14));
  g.fillStyle = rg;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();

  // 2) 底部内阴影弧
  g.strokeStyle = rgba(shade(base, 0.4), 0.3);
  g.lineWidth = Math.max(1, r * 0.16);
  g.beginPath();
  g.arc(x, y - r * 0.06, r * 0.85, Math.PI * 0.24, Math.PI * 0.76);
  g.stroke();

  // 3) 深色 rim 描边
  g.strokeStyle = shade(base, 0.3);
  g.lineWidth = Math.max(1.2, Math.min(2.6, r * 0.08));
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.stroke();

  // 4) 左上椭圆高光
  g.fillStyle = "rgba(255,255,255,0.6)";
  pathOval(g, x - r * 0.36, y - r * 0.42, r * 0.28, r * 0.16, -0.5);
  g.fill();

  // 5) 脸:半径够大(或头像模式)才画,小到糊就只留体积
  const hasFace = o.avatar === true || r > 10;
  if (hasFace) {
    const lx = fin(o.lookX) ? Math.max(-1, Math.min(1, o.lookX)) : 0;
    const ly = fin(o.lookY) ? Math.max(-1, Math.min(1, o.lookY)) : 0;
    const eyeDX = r * 0.34;
    const eyeY = y - r * 0.14;
    const eyeR = Math.max(1.1, r * 0.17);
    const off = eyeR * 0.42;
    for (const side of [-1, 1]) {
      const ex = x + side * eyeDX;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(ex, eyeY, eyeR, 0, TAU);
      g.fill();
      g.fillStyle = KIT_PALETTE.ink;
      g.beginPath();
      g.arc(ex + lx * off, eyeY + ly * off, eyeR * 0.52, 0, TAU);
      g.fill();
      if (r > 16) {
        g.fillStyle = "#ffffff";
        g.beginPath();
        g.arc(ex + lx * off - eyeR * 0.16, eyeY + ly * off - eyeR * 0.18, eyeR * 0.16, 0, TAU);
        g.fill();
      }
    }
    // 腮红
    g.fillStyle = "rgba(255,182,193,0.6)";
    for (const side of [-1, 1]) {
      pathOval(g, x + side * r * 0.56, y + r * 0.14, r * 0.15, r * 0.09);
      g.fill();
    }
    // 嘴:吞吃张嘴 / 惊讶 O 嘴优先;平时半径 > 22 才画微笑
    const mouth = o.mouth ?? "smile";
    if (mouth === "eat" && r > 8) {
      g.fillStyle = "#6b3550";
      g.beginPath();
      g.arc(x, y + r * 0.22, r * 0.38, 0, Math.PI);
      g.closePath();
      g.fill();
      g.fillStyle = KIT_PALETTE.blush;
      g.beginPath();
      g.arc(x, y + r * 0.42, r * 0.16, Math.PI, TAU);
      g.closePath();
      g.fill();
    } else if (mouth === "oops" && r > 8) {
      g.fillStyle = "#6b3550";
      g.beginPath();
      g.arc(x, y + r * 0.3, Math.max(1, r * 0.14), 0, TAU);
      g.fill();
    } else if (r > 22 || o.avatar === true) {
      g.strokeStyle = KIT_PALETTE.ink;
      g.lineWidth = Math.max(1, r * 0.06);
      g.lineCap = "round";
      g.beginPath();
      g.arc(x, y + r * 0.18, r * 0.2, Math.PI * 0.16, Math.PI * 0.84);
      g.stroke();
    }
  }

  // 6) 人类头饰:形状 + 颜色双通道(P1 金星 / P2 银月),AI 不走这个分支
  if (o.crest === "star" || o.crest === "moon") {
    const cs = Math.max(4, Math.min(16, r * 0.42));
    const cc = typeof o.crestColor === "string" ? o.crestColor : o.crest === "star" ? CREST_COLORS.star : CREST_COLORS.moon;
    const cy = y - r - cs * 0.55;
    if (o.crest === "star") pathStar(g, x, cy, cs, cs * 0.46);
    else pathMoon(g, x, cy, cs * 0.92);
    g.fillStyle = cc;
    g.fill();
    g.strokeStyle = shade(cc, 0.35);
    g.lineWidth = Math.max(1, cs * 0.12);
    g.lineJoin = "round";
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.beginPath();
    g.arc(x - cs * 0.22, cy - cs * 0.2, Math.max(0.7, cs * 0.14), 0, TAU);
    g.fill();
  }
}

/** 名字牌:圆角白底 75% 透明胶囊,替代裸 fillText */
export function drawNameTag(g: Ctx, x: number, y: number, name: string): void {
  if (!fin(x) || !fin(y) || typeof name !== "string" || name.length === 0) return;
  const fs = 12;
  let units = 0;
  for (const ch of name) units += ch.charCodeAt(0) > 255 ? 1 : 0.58;
  const tw = units * fs;
  const hh = 8.5;
  const w = tw + 14;
  g.beginPath();
  g.arc(x - w / 2 + hh, y, hh, Math.PI / 2, Math.PI * 1.5);
  g.lineTo(x + w / 2 - hh, y - hh);
  g.arc(x + w / 2 - hh, y, hh, Math.PI * 1.5, Math.PI * 2.5);
  g.lineTo(x - w / 2 + hh, y + hh);
  g.closePath();
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.fill();
  g.strokeStyle = "rgba(120,95,180,0.35)";
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = "#4b3a75";
  g.font = `700 ${fs}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(name, x, y + 0.5);
}

// ---------------------------------------------------------------------------
// 分身拉丝:两球之间的果冻拉伸带(替代瞬移感)
// ---------------------------------------------------------------------------

export interface StretchOpts {
  x1: number;
  y1: number;
  r1: number;
  x2: number;
  y2: number;
  r2: number;
  color: string;
  /** 剩余强度 1 → 0,越小拉丝越细 */
  k: number;
}

export function drawSplitStretch(g: Ctx, o: StretchOpts): void {
  if (!fin(o.x1) || !fin(o.y1) || !fin(o.x2) || !fin(o.y2) || !fin(o.r1) || !fin(o.r2)) return;
  const k = fin(o.k) ? Math.max(0, Math.min(1, o.k)) : 0;
  if (k <= 0) return;
  const dx = o.x2 - o.x1;
  const dy = o.y2 - o.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const nx = -dy / len;
  const ny = dx / len;
  const base = typeof o.color === "string" && hexToRgb(o.color) ? o.color : "#d9c6f5";
  const N = 8;
  const top: Array<[number, number]> = [];
  const bot: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const cx = o.x1 + dx * t;
    const cy = o.y1 + dy * t;
    // 两端贴球半径、中间掐细:果冻拉丝的宽度包络
    const hw = (o.r1 + (o.r2 - o.r1) * t) * k * (1 - 0.72 * Math.sin(Math.PI * t));
    top.push([cx + nx * hw, cy + ny * hw]);
    bot.push([cx - nx * hw, cy - ny * hw]);
  }
  g.beginPath();
  g.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i <= N; i++) g.lineTo(top[i][0], top[i][1]);
  for (let i = N; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
  g.closePath();
  g.fillStyle = rgba(base, 0.55);
  g.fill();
  g.strokeStyle = rgba(shade(base, 0.25), 0.5);
  g.lineWidth = 1;
  g.stroke();
}

// ---------------------------------------------------------------------------
// 结算:名次奖杯 + 本局质量曲线(Canvas 画,不用 emoji 凑数)
// ---------------------------------------------------------------------------

const TROPHY_TONES: Record<number, string> = { 1: KIT_PALETTE.starGold, 2: "#cfd6e4", 3: "#e0a06b" };

/** 金/银/铜奖杯:杯口 + 杯身 + 双耳 + 杯座 + 星形浮雕 + 高光 */
export function drawTrophy(g: Ctx, cx: number, top: number, s: number, tone: string): void {
  if (!fin(cx) || !fin(top) || !fin(s) || s <= 0) return;
  const bowlR = s * 0.32;
  const bowlCY = top + s * 0.1;
  // 双耳
  g.strokeStyle = shade(tone, 0.18);
  g.lineWidth = Math.max(1.5, s * 0.07);
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(cx + side * s * 0.38, top + s * 0.18, s * 0.15, 0, TAU);
    g.stroke();
  }
  // 杯口沿
  g.fillStyle = tint(tone, 0.25);
  g.fillRect(cx - s * 0.38, top, s * 0.76, s * 0.09);
  // 杯身(下半圆)
  g.fillStyle = tone;
  g.beginPath();
  g.moveTo(cx - bowlR, bowlCY);
  g.lineTo(cx + bowlR, bowlCY);
  g.arc(cx, bowlCY, bowlR, 0, Math.PI);
  g.closePath();
  g.fill();
  // 右侧暗阶
  g.fillStyle = shade(tone, 0.22);
  g.beginPath();
  g.moveTo(cx + bowlR * 0.2, bowlCY);
  g.arc(cx, bowlCY, bowlR, Math.PI * 0.18, Math.PI * 0.5);
  g.closePath();
  g.fill();
  // 星形浮雕
  g.fillStyle = shade(tone, 0.32);
  pathStar(g, cx, bowlCY + bowlR * 0.34, s * 0.11, s * 0.05);
  g.fill();
  // 高光
  g.fillStyle = "rgba(255,255,255,0.55)";
  pathOval(g, cx - bowlR * 0.45, bowlCY + bowlR * 0.18, s * 0.07, s * 0.13, -0.3);
  g.fill();
  // 杯颈与底座
  g.fillStyle = shade(tone, 0.12);
  g.fillRect(cx - s * 0.06, bowlCY + bowlR, s * 0.12, s * 0.16);
  g.fillStyle = tone;
  g.fillRect(cx - s * 0.24, bowlCY + bowlR + s * 0.16, s * 0.48, s * 0.1);
  g.fillStyle = shade(tone, 0.28);
  g.fillRect(cx - s * 0.24, bowlCY + bowlR + s * 0.22, s * 0.48, s * 0.04);
}

/** 本局质量成长曲线:面积渐变 + 折线 + 终点圆点 */
export function drawMassCurve(g: Ctx, x: number, y: number, w: number, h: number, samples: number[]): void {
  if (!fin(x) || !fin(y) || !fin(w) || !fin(h) || w <= 0 || h <= 0) return;
  const pts = Array.isArray(samples) ? samples.filter((n) => fin(n) && n >= 0) : [];
  // 基线
  g.strokeStyle = "rgba(120,95,180,0.35)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x + w, y + h);
  g.stroke();
  if (pts.length < 2) return;
  const max = Math.max(...pts, 1);
  const px = (i: number): number => x + (w * i) / (pts.length - 1);
  const py = (v: number): number => y + h - (h * v) / max;
  // 面积
  const lg = g.createLinearGradient(0, y, 0, y + h);
  lg.addColorStop(0, "rgba(242,120,159,0.3)");
  lg.addColorStop(1, "rgba(242,120,159,0)");
  g.beginPath();
  g.moveTo(px(0), py(pts[0]));
  for (let i = 1; i < pts.length; i++) g.lineTo(px(i), py(pts[i]));
  g.lineTo(x + w, y + h);
  g.lineTo(x, y + h);
  g.closePath();
  g.fillStyle = lg;
  g.fill();
  // 折线
  g.strokeStyle = KIT_PALETTE.candyDeep;
  g.lineWidth = 2;
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(px(0), py(pts[0]));
  for (let i = 1; i < pts.length; i++) g.lineTo(px(i), py(pts[i]));
  g.stroke();
  // 终点圆点
  g.fillStyle = KIT_PALETTE.candyDeep;
  g.beginPath();
  g.arc(px(pts.length - 1), py(pts[pts.length - 1]), 3, 0, TAU);
  g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(px(pts.length - 1) - 0.8, py(pts[pts.length - 1]) - 0.8, 1.1, 0, TAU);
  g.fill();
}

/** 结算面板小画布:左侧名次奖杯(前三名金银铜),右侧本局质量曲线 */
export function drawResultArt(g: Ctx, w: number, h: number, rank: number, curve: number[]): void {
  if (!fin(w) || !fin(h) || w <= 0 || h <= 0) return;
  const rk = fin(rank) ? Math.max(1, Math.round(rank)) : 1;
  const tone = TROPHY_TONES[rk];
  if (tone) {
    drawTrophy(g, 40, 6, Math.min(56, h * 0.62), tone);
  } else {
    // 四名开外:画一颗微笑果冻球当纪念章,不发奖杯
    drawJellyOrb(g, { x: 40, y: h * 0.42, r: Math.min(24, h * 0.26), color: KIT_PALETTE.candy, avatar: true, mouth: "smile" });
  }
  g.fillStyle = "#6b53a8";
  g.font = "800 14px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(`第 ${rk} 名`, 40, h - 10);
  drawMassCurve(g, 86, 10, w - 100, h - 34, curve);
  g.fillStyle = "#7a67ab";
  g.font = "700 14px system-ui, sans-serif";
  g.fillText("本局成长", 86 + (w - 100) / 2, h - 10);
}
