/**
 * 朵朵星星象棋 · 视觉资产（1.3 视觉升级，纯绘制不碰玩法数值）。
 *
 * 这里只放「怎么画」和「动画公式」：
 *   · 有厚度的木刻棋子（影 / 侧壁 / 面 / 双圈 / 高光弧 / 阴刻字）与 14 种 sprite 预渲染缓存；
 *   · 棋盘装饰：双层木框 + 金线 + 四角如意云头、楚河汉界水波、兵位炮位十字角标、最后一手罗盘印记；
 *   · 演出小件：吃子花瓣、被吃大子金环、落定波纹、结算印章（含 2 粒微尘）；
 *   · 动画纯公式：走子滑行 / 落定回弹 / 吃子缩旋 / 将军红光呼吸 / 胜方跳子——view 只管何时调用。
 * 何时画、画在哪个交叉点由 view.ts 决定；px()/py()/GEOM 坐标一律不碰。
 *
 * 共享 art kit（src/art/kit/）还没建，按视觉宪法先落在本目录；
 * 建成后 paintPieceBody 的侧壁刻字画法可反向输出给 kit（供 dark-chess 等复用）。
 */
import { PIECE_NAME, type PieceType, type Side } from "./logic";

type Ctx2D = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ */
/* 调色板（改的是观感，不是胜负）                                       */
/* ------------------------------------------------------------------ */

/** 红方字色：比 1.2 更沉的朱砂红（对棋子底色仍 ≥ 4.5:1） */
export const RED_INK = "#C23B2E";
/** 黑方字色：更沉的墨绿黑（与红方除颜色外还有字形差异，天然双通道） */
export const BLACK_INK = "#2F3A2F";
/** 棋子面色（1.2 原样保留） */
export const PIECE_FACE = "#FFF7E6";
/** 侧壁色：面色加深 20%（真棋子 3–4mm 侧壁的月牙） */
export const PIECE_WALL = "#CCC6B8";
/** 阴刻描边用的深一档墨色 */
export const RED_DEEP = "#8F2A20";
export const BLACK_DEEP = "#1E271E";

/** 双层木框 */
export const FRAME_PX = 8;
export const FRAME_DARK = "#6B4423";
export const FRAME_LIGHT = "#96652F";
export const FRAME_GOLD = "#E8C57C";

/** 楚河汉界下面的极淡水波 */
export const RIVER_WAVE = "rgba(76,118,162,.05)";
/** 兵位 / 炮位的十字角标 */
export const POS_MARK = "rgba(169,118,47,.8)";
/** 最后一手罗盘印记（与圆棋子同族的圆形印） */
export const COMPASS_ORANGE = "rgba(226,140,60";

/** 吃子退场的花瓣（全仓库统一的「花瓣退场」口径） */
export const PETAL_PINK = "#F7A8C4";
export const PETAL_EDGE = "#E087AC";
/** 被吃大子（车马炮）的金环 */
export const CAPTURE_GOLD = "240,196,92";
/** 结算印章的印泥红 */
export const SEAL_RED = "#C7392B";

/** 棋子直径小于这个 CSS px 就去掉阴刻描边只保字 */
export const ENGRAVE_MIN_PX = 30;

/* ------------------------------------------------------------------ */
/* 动画纯公式（同输入同输出，方便契约测试锁死）                          */
/* ------------------------------------------------------------------ */

/** 走子滑行时长（拿起—移动—放下 的中段） */
export const MOVE_MS = 160;
/** 落定回弹时长（1.08 → 1） */
export const LAND_MS = 140;
/** 被吃方缩小旋出时长 */
export const CAPTURE_MS = 250;
/** 花瓣飘散时长（散完即回收） */
export const PETAL_MS = 520;
/** 落定波纹时长 */
export const RIPPLE_MS = 300;
/** 将军红光呼吸 2 次的总时长，之后转静态描边 */
export const CHECK_GLOW_MS = 800;
/** 结算印章盖下时长 */
export const SEAL_MS = 400;
/** 胜方将帅跳起两下的总时长 */
export const WIN_JUMP_MS = 900;
/** 一次走子演出的总窗口（花瓣散完为准），过了就把动画状态回收 */
export const ANIM_TOTAL_MS = 520;

/** easeOutQuad：0→1，先快后慢 */
export function slideEase(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return 1 - (1 - t) * (1 - t);
}

/** 落定回弹：k=0 时 1.08，落到 1 */
export function landScaleAt(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return 1 + 0.08 * (1 - t) * (1 - t);
}

/** 被吃方缩小：1 → 0 */
export function captureScale(k: number): number {
  return Math.max(0, 1 - Math.max(0, k));
}

/** 被吃方旋出的角度（弧度） */
export function captureSpin(k: number): number {
  return Math.max(0, Math.min(1, k)) * 1.8;
}

/** 第 i 片（0..2）花瓣在进度 k 时的位移与自转 */
export function petalOffset(i: number, k: number): { x: number; y: number; rot: number } {
  const t = Math.max(0, Math.min(1, k));
  const a = -Math.PI / 2 + (i - 1) * 0.95;
  const d = 6 + 30 * slideEase(t);
  return { x: Math.cos(a) * d, y: Math.sin(a) * d + 16 * t * t, rot: a + t * 2.2 };
}

/** 落定波纹半径：从棋子边缘往外扩到 1.65 倍 */
export function rippleRadius(r: number, k: number): number {
  return r * (1 + 0.65 * slideEase(k));
}

/** 波纹透明度：线性淡出 */
export function rippleAlpha(k: number): number {
  return Math.max(0, 0.5 * (1 - Math.max(0, Math.min(1, k))));
}

/**
 * 将军红光：前 CHECK_GLOW_MS 内呼吸 2 次（|sin(2πk)| 两个波峰），
 * 之后转成静态描边；reduced 一直是静态（警告不消失，只是不闪）。
 */
export function checkGlowAlpha(tMs: number, reduced: boolean): number {
  if (reduced) return 0.85;
  const k = tMs / CHECK_GLOW_MS;
  if (k >= 1 || k < 0) return 0.85;
  return 0.35 + 0.55 * Math.abs(Math.sin(Math.PI * 2 * k));
}

/** 胜方将帅跳起两下的抬升量（px）；reduced 不跳 */
export function winJumpOffset(tMs: number, reduced: boolean): number {
  if (reduced || tMs < 0 || tMs >= WIN_JUMP_MS) return 0;
  return Math.abs(Math.sin((Math.PI * 2 * tMs) / WIN_JUMP_MS)) * 7;
}

/* ------------------------------------------------------------------ */
/* 有厚度的木刻棋子：影 / 侧壁 / 面 / 双圈 / 高光弧 / 阴刻字             */
/* ------------------------------------------------------------------ */

/** 侧壁高度占半径的比例（r=20 时约 3px 月牙） */
export const WALL_K = 0.16;

/** 棋子投影：立在盘上的椭圆影，随 lift 抬起而变淡摊开 */
export function paintPieceShadow(ctx: Ctx2D, cx: number, cy: number, r: number, lift = 0): void {
  if (r <= 0) return;
  ctx.fillStyle = `rgba(110,75,35,${Math.max(0.12, 0.26 - lift * 0.02)})`;
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.04, cy + r * (WALL_K + 0.1), r * (1.02 + lift * 0.02), r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 棋子本体（不含投影，sprite 预渲染与直接绘制共用）：
 * 底部月牙侧壁 → 径向渐变面 → 双圈线 → 左上高光弧 → 阴刻楷体字。
 * engrave=false 时去掉描边与错位只保字（棋子屏显 < 30px 的降级）。
 */
export function paintPieceBody(
  ctx: Ctx2D,
  cx: number,
  cy: number,
  r: number,
  side: Side,
  type: PieceType,
  engrave = true,
): void {
  if (r <= 0) return;
  const ink = side === "red" ? RED_INK : BLACK_INK;
  const deep = side === "red" ? RED_DEEP : BLACK_DEEP;
  const name = PIECE_NAME[side][type];
  const wall = r * WALL_K;
  // 侧壁：往下错开的一整圆，被面盖住后只剩底部月牙
  ctx.fillStyle = PIECE_WALL;
  ctx.beginPath();
  ctx.arc(cx, cy + wall, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,90,50,.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy + wall, r - 0.5, 0, Math.PI);
  ctx.stroke();
  // 面：径向渐变（左上受光）
  const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.15, cx, cy, r);
  grad.addColorStop(0, "#FFFDF6");
  grad.addColorStop(1, PIECE_FACE);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // 双圈线（1.2 制式保留，线宽按半径等比）
  ctx.strokeStyle = ink;
  ctx.lineWidth = r * 0.125;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.925, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
  ctx.stroke();
  // 外圈左上 90° 的极淡高光弧
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = r * 0.07;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.925, Math.PI * 0.95, Math.PI * 1.45);
  ctx.stroke();
  // 阴刻楷体字：右下浅色错位 + 本字 + 同色深描边
  ctx.font = `800 ${Math.round(r * 1.08)}px "Kaiti SC","STKaiti","PingFang SC",serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (engrave) {
    ctx.fillStyle = "rgba(255,255,255,.6)";
    ctx.fillText(name, cx + r * 0.05, cy + r * 0.1);
  }
  ctx.fillStyle = ink;
  ctx.fillText(name, cx, cy + r * 0.05);
  if (engrave) {
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(0.5, r * 0.025);
    ctx.strokeText(name, cx, cy + r * 0.05);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** 一整颗棋子：投影 + 本体（sprite 之外的直绘退路与测试入口） */
export function paintPiece(
  ctx: Ctx2D,
  cx: number,
  cy: number,
  r: number,
  side: Side,
  type: PieceType,
  engrave = r * 2 >= ENGRAVE_MIN_PX,
): void {
  paintPieceShadow(ctx, cx, cy, r, 0);
  paintPieceBody(ctx, cx, cy, r, side, type, engrave);
}

/* ------------------------------------------------------------------ */
/* 14 种棋子 sprite 预渲染（2 方 × 7 种；满盘 32 子 draw() 只做 drawImage） */
/* ------------------------------------------------------------------ */

/** sprite 相对棋子半径的边长倍数（放得下侧壁与描边呼吸余量） */
export const SPRITE_SPAN = 2.6;
/** 预渲染倍率：落定回弹会放大到 1.08，2 倍采样保证不糊 */
export const SPRITE_OVERSAMPLE = 2;

export interface PieceSprite {
  canvas: HTMLCanvasElement;
  /** 画到主画布上的逻辑边长（px），sprite 中心 = 棋子面中心 */
  span: number;
}

let spriteR = 0;
const spriteCache = new Map<string, PieceSprite>();

/** 清空 sprite 缓存（测试与尺寸重建用） */
export function resetPieceSprites(): void {
  spriteCache.clear();
  spriteR = 0;
}

/**
 * 取（或预渲染）一种棋子的 sprite：按 (side, type, r) 缓存，r 变了整套重建。
 * 离屏环境拿不到 2d 上下文时返回 null，调用方退回逐颗直绘。
 */
export function pieceSprite(
  doc: { createElement(tag: string): unknown },
  side: Side,
  type: PieceType,
  r: number,
): PieceSprite | null {
  if (r <= 0) return null;
  if (r !== spriteR) {
    spriteCache.clear();
    spriteR = r;
  }
  const key = `${side}:${type}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const span = r * SPRITE_SPAN;
  const size = Math.max(2, Math.ceil(span * SPRITE_OVERSAMPLE));
  const canvas = doc.createElement("canvas") as HTMLCanvasElement;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext?.("2d") as Ctx2D | null;
  if (!ctx) return null;
  paintPieceBody(ctx, size / 2, size / 2, r * SPRITE_OVERSAMPLE, side, type, r * 2 >= ENGRAVE_MIN_PX);
  const sprite: PieceSprite = { canvas, span };
  spriteCache.set(key, sprite);
  return sprite;
}

/* ------------------------------------------------------------------ */
/* 棋盘装饰：双层木框 + 如意云头 / 水波 / 位点角标 / 罗盘印记            */
/* ------------------------------------------------------------------ */

/** 四角如意云头小饰（≤ 8 笔）：一个主云头 + 两个小云卷 */
export function paintCloudCorner(ctx: Ctx2D, x: number, y: number, rot: number, s = 11): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = FRAME_GOLD;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(s * 0.55, s * 0.55, s * 0.4, Math.PI * 0.75, Math.PI * 2.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.2, s * 0.72, s * 0.17, Math.PI * 1.1, Math.PI * 2.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.72, s * 0.2, s * 0.17, Math.PI * 0.5, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** 双层木框：外 8px 深木渐变 + 内 1px 金线 + 四角如意云头 */
export function paintBoardFrame(ctx: Ctx2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, FRAME_LIGHT);
  g.addColorStop(0.5, FRAME_DARK);
  g.addColorStop(1, FRAME_LIGHT);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, FRAME_PX);
  ctx.fillRect(0, h - FRAME_PX, w, FRAME_PX);
  ctx.fillRect(0, 0, FRAME_PX, h);
  ctx.fillRect(w - FRAME_PX, 0, FRAME_PX, h);
  ctx.strokeStyle = FRAME_GOLD;
  ctx.lineWidth = 1;
  ctx.strokeRect(FRAME_PX + 0.5, FRAME_PX + 0.5, w - FRAME_PX * 2 - 1, h - FRAME_PX * 2 - 1);
  paintCloudCorner(ctx, 10, 10, 0);
  paintCloudCorner(ctx, w - 10, 10, Math.PI / 2);
  paintCloudCorner(ctx, w - 10, h - 10, Math.PI);
  paintCloudCorner(ctx, 10, h - 10, Math.PI * 1.5);
}

/** 楚河汉界底下的两道极淡水波（静态，不参与动画） */
export function paintRiverWaves(ctx: Ctx2D, x0: number, x1: number, yMid: number): void {
  const w = x1 - x0;
  if (w <= 0) return;
  ctx.strokeStyle = RIVER_WAVE;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const dy of [-7, 8]) {
    ctx.beginPath();
    ctx.moveTo(x0, yMid + dy);
    for (let i = 1; i <= 8; i++) {
      const bend = i % 2 === 1 ? (i % 4 === 1 ? -4 : 4) : 0;
      ctx.quadraticCurveTo(x0 + (w * (i - 0.5)) / 8, yMid + dy + bend, x0 + (w * i) / 8, yMid + dy);
    }
    ctx.stroke();
  }
}

/**
 * 兵位 / 炮位的传统十字角标（线宽 1）。
 * left/right 控制画不画左右两半：0 路只画右半、8 路只画左半。
 */
export function paintPositionMark(ctx: Ctx2D, cx: number, cy: number, left = true, right = true): void {
  const g = 4;
  const l = 5;
  ctx.strokeStyle = POS_MARK;
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.beginPath();
  const quad = (sx: number, sy: number): void => {
    ctx.moveTo(cx + sx * g, cy + sy * (g + l));
    ctx.lineTo(cx + sx * g, cy + sy * g);
    ctx.lineTo(cx + sx * (g + l), cy + sy * g);
  };
  if (right) {
    quad(1, -1);
    quad(1, 1);
  }
  if (left) {
    quad(-1, -1);
    quad(-1, 1);
  }
  ctx.stroke();
}

/** 最后一手的罗盘印记：细圈 + 上下左右四根短线（与圆棋子同族） */
export function paintCompassMark(ctx: Ctx2D, cx: number, cy: number, r: number, alpha: number): void {
  if (alpha <= 0 || r <= 0) return;
  ctx.strokeStyle = `${COMPASS_ORANGE},${alpha})`;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
    ctx.moveTo(cx + dx * r, cy + dy * r);
    ctx.lineTo(cx + dx * (r + 4), cy + dy * (r + 4));
  }
  ctx.stroke();
}

/* ------------------------------------------------------------------ */
/* 演出小件：花瓣 / 金环 / 波纹 / 印章                                   */
/* ------------------------------------------------------------------ */

/** 一片花瓣（吃子=花瓣退场，全仓库统一口径） */
export function paintPetal(ctx: Ctx2D, x: number, y: number, s: number, rot: number, alpha: number): void {
  if (s <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PETAL_PINK;
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PETAL_EDGE;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.beginPath();
  ctx.ellipse(-s * 0.25, -s * 0.15, s * 0.35, s * 0.18, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** 被吃大子（车马炮）的一圈金环：随进度扩散淡出 */
export function paintGoldRing(ctx: Ctx2D, cx: number, cy: number, r: number, k: number): void {
  const t = Math.max(0, Math.min(1, k));
  const a = 0.85 * (1 - t);
  if (a <= 0 || r <= 0) return;
  ctx.strokeStyle = `rgba(${CAPTURE_GOLD},${a})`;
  ctx.lineWidth = 3 * (1 - t * 0.6);
  ctx.beginPath();
  ctx.arc(cx, cy, r * (1 + 0.8 * slideEase(t)), 0, Math.PI * 2);
  ctx.stroke();
}

/** 落定波纹：一圈细波纹从棋子边缘扩散开（reduced 下由 view 直接不排） */
export function paintRipple(ctx: Ctx2D, cx: number, cy: number, r: number, k: number): void {
  const a = rippleAlpha(k);
  if (a <= 0) return;
  ctx.strokeStyle = `rgba(214,158,88,${a})`;
  ctx.lineWidth = 1.6 * (1 - Math.max(0, Math.min(1, k)) * 0.5);
  ctx.beginPath();
  ctx.arc(cx, cy, rippleRadius(r, k), 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * 结算印章：印影 + 印泥红方章 + 白边框 + 楷体字，1.6 倍缩放盖下（k=1 落定）。
 * k < 1 时印章两侧各溅 1 粒微尘；reduced 由 view 直接传 k=1（静态盖好）。
 */
export function paintSeal(ctx: Ctx2D, cx: number, cy: number, size: number, k: number, text: string): void {
  if (size <= 0 || !text) return;
  const t = Math.max(0, Math.min(1, k));
  const s = size * (1 + 0.6 * (1 - slideEase(t)));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.07);
  ctx.globalAlpha = Math.min(1, 0.15 + t * 0.85);
  ctx.fillStyle = "rgba(90,20,12,.35)";
  ctx.fillRect(-s / 2 + 3, -s / 2 + 4, s, s);
  ctx.fillStyle = SEAL_RED;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = "rgba(255,240,230,.9)";
  ctx.lineWidth = Math.max(1.5, s * 0.03);
  ctx.strokeRect(-s / 2 + s * 0.07, -s / 2 + s * 0.07, s * 0.86, s * 0.86);
  ctx.fillStyle = "#FFF6EC";
  ctx.font = `900 ${Math.round(text.length > 1 ? s * 0.4 : s * 0.6)}px "Kaiti SC","STKaiti",serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, s * 0.02);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.restore();
  ctx.globalAlpha = 1;
  if (t < 1) {
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = FRAME_GOLD;
    ctx.beginPath();
    ctx.arc(cx - size * 0.62, cy + size * 0.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + size * 0.58, cy + size * 0.46, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */
/* HUD 用的 SVG 小棋子图标（座位条将帅 / 吃子槽），全部原创矢量           */
/* ------------------------------------------------------------------ */

/** 一颗迷你棋子：投影 + 侧壁 + 面 + 圈 + 楷体字，与画布同一套配色 */
export function pieceIconSVG(side: Side, type: PieceType, size: number): string {
  const ink = side === "red" ? RED_INK : BLACK_INK;
  const name = PIECE_NAME[side][type];
  return (
    `<svg class="xq-picon" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">` +
    `<ellipse cx="16.4" cy="18.8" rx="13.4" ry="12.2" fill="rgba(110,75,35,.25)"/>` +
    `<circle cx="16" cy="17.5" r="13" fill="${PIECE_WALL}"/>` +
    `<circle cx="16" cy="15.5" r="13" fill="${PIECE_FACE}"/>` +
    `<circle cx="16" cy="15.5" r="11.8" fill="none" stroke="${ink}" stroke-width="1.6"/>` +
    `<text x="16" y="16.6" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="'Kaiti SC','STKaiti',serif" font-weight="800" font-size="14" fill="${ink}">${name}</text>` +
    `</svg>`
  );
}

/* ------------------------------------------------------------------ */
/* AI 对手「棋灵象」的画制头像（替掉 1.2 时代的 🐘 emoji 兜底）           */
/* ------------------------------------------------------------------ */

/**
 * Q 版小象头像：**复用棋子 sprite 的面 / 侧壁 / 描边规格**（B 档 TOP10 之 4）——
 * 底是 PIECE_FACE 圆面 + PIECE_WALL 月牙侧壁 + 投影，与座位条上的迷你棋子
 * 同一套材质；象头用 BLACK_INK 双笔画「圆头 + 大耳 + 卷鼻」，耳内一抹
 * RED_INK 10% 淡红。原创造型，不近似任何会徽 / 商标。
 * 纯 SVG 字符串，座位条 / 结算行直接 innerHTML 内联。
 */
export function robotAvatarSVG(size: number): string {
  const ink = BLACK_INK;
  const earTint = "rgba(194,59,46,.1)"; // RED_INK 10%
  return (
    `<svg class="xq-robot" viewBox="0 0 48 48" width="${size}" height="${size}"` +
    ` style="vertical-align:middle" aria-hidden="true">` +
    // 投影 + 侧壁 + 面 + 内圈:与 pieceIconSVG 同一套棋子材质
    `<ellipse cx="24.6" cy="28.2" rx="20.1" ry="18.3" fill="rgba(110,75,35,.25)"/>` +
    `<circle cx="24" cy="26.2" r="19.5" fill="${PIECE_WALL}"/>` +
    `<circle cx="24" cy="23.2" r="19.5" fill="${PIECE_FACE}"/>` +
    `<circle cx="24" cy="23.2" r="17.7" fill="none" stroke="${ink}" stroke-width="1.6"/>` +
    // 象头三笔:大耳(剪影①)、圆头、卷鼻(剪影②),全部 BLACK_INK 描边
    `<ellipse cx="14.2" cy="21.4" rx="5.2" ry="6.6" fill="${earTint}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>` +
    `<ellipse cx="33.8" cy="21.4" rx="5.2" ry="6.6" fill="${earTint}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="24" cy="22.4" r="8.6" fill="${PIECE_FACE}" stroke="${ink}" stroke-width="2"/>` +
    `<path d="M22.6 26.2 C21.9 28.9 22.2 31.1 23.7 32.5 C24.9 33.6 26.7 33.8 28.1 32.9` +
    ` L27.4 31.4 C26.3 31.9 25.3 31.8 24.7 31.1 C23.8 30 23.8 28.2 24.6 26.4 Z"` +
    ` fill="${PIECE_FACE}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>` +
    // 眼睛(带高光点)与眉上一点朱砂(呼应红方印色,同为圆点不成徽记)
    `<circle cx="20.4" cy="21" r="1.5" fill="${ink}"/>` +
    `<circle cx="27.6" cy="21" r="1.5" fill="${ink}"/>` +
    `<circle cx="19.9" cy="20.4" r=".6" fill="#fff"/>` +
    `<circle cx="27.1" cy="20.4" r=".6" fill="#fff"/>` +
    `<circle cx="24" cy="14.6" r="1.2" fill="${RED_INK}"/>` +
    `</svg>`
  );
}
