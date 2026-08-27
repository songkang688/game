/**
 * 豆豆迷宫 · 1.3 视觉素材（纯绘制，零玩法数值）。
 *
 * 共享 art kit（src/art/kit/）未合入前，按 visual-bible 的口径把本款的
 * 贴图与绘制函数收在这一个文件里：发光感全部预渲染成小画布、帧循环里只
 * drawImage 复用，不逐帧 shadowBlur；全部 Canvas 2D 矢量代码化，
 * 不引位图、不引 emoji 字形，离线可用也不膨胀包体。
 * 这里只有「怎么画」，胜负与数值一个字都不碰。
 */
import type { Dir } from "./maze";

/* ------------------------------------------------------------------ */
/* 墙面主题                                                            */
/* ------------------------------------------------------------------ */

/** 一套墙色：外缘霓虹描边 + 内部深色填充 + 背景星点的淡色 */
export interface WallTheme {
  edge: string;
  fill: string;
  spark: string;
}

/** 四套主题：蓝紫 → 青绿 → 橙红 → 金紫，每 47 关换一套 */
export const WALL_THEMES: readonly WallTheme[] = [
  { edge: "#6E82D9", fill: "#39406E", spark: "#8FA3F0" },
  { edge: "#5BC8AF", fill: "#2E5B52", spark: "#8FE7D2" },
  { edge: "#E8845E", fill: "#5C3A34", spark: "#F5B598" },
  { edge: "#D9B75E", fill: "#4A3A6E", spark: "#F0DC9A" },
];

/** 第 level 关（0 基）用第几套墙色：每 47 关换一套，循环使用 */
export function wallThemeIndex(level: number): number {
  return Math.floor(Math.max(0, level) / 47) % WALL_THEMES.length;
}

/* ------------------------------------------------------------------ */
/* 贴图小工厂                                                          */
/* ------------------------------------------------------------------ */

/** 建一张 size×size 的离屏小画布并画好内容（预渲染贴图都从这走） */
function makeSprite(size: number, paint: (g: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const c = document.createElement("canvas") as HTMLCanvasElement;
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (g) paint(g, size);
  return c;
}

/**
 * 往当前路径里放一颗 points 芒的星星（只建路径，fill / stroke 交给调用方）。
 * rot 默认让第一个尖朝上。
 */
export function starPath(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  points: number,
  rOuter: number,
  rInner: number,
  rot = -Math.PI / 2
): void {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i * Math.PI) / points;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/* ------------------------------------------------------------------ */
/* 豆子 / 能量豆 / 抢豆星星：发光贴图                                    */
/* ------------------------------------------------------------------ */

let dotCache: HTMLCanvasElement | null = null;

/**
 * 豆子贴图：中心亮黄小圆 + 外圈约 1.5 倍的柔光晕。
 * 一张 16×16 贴图全场 drawImage 复用，比逐颗画渐变便宜得多。
 */
export function dotSprite(): HTMLCanvasElement {
  dotCache ??= makeSprite(16, (g) => {
    const halo = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    halo.addColorStop(0, "rgba(255,244,205,0.95)");
    halo.addColorStop(0.42, "rgba(255,233,168,0.5)");
    halo.addColorStop(1, "rgba(255,233,168,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = "#FFEFB5";
    g.beginPath();
    g.arc(8, 8, 3.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#FFFDF2";
    g.beginPath();
    g.arc(7, 7, 1.4, 0, Math.PI * 2);
    g.fill();
  });
  return dotCache;
}

let powerCache: HTMLCanvasElement | null = null;

/**
 * 能量豆贴图：四芒星光点（粉渐变 + 光晕 + 高光点）。
 * 旋转与脉动在帧循环里用变换实现，贴图本身是静态的。
 */
export function powerSprite(): HTMLCanvasElement {
  powerCache ??= makeSprite(32, (g) => {
    const halo = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    halo.addColorStop(0, "rgba(255,201,229,0.85)");
    halo.addColorStop(0.55, "rgba(255,143,199,0.28)");
    halo.addColorStop(1, "rgba(255,143,199,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, 32, 32);
    const body = g.createLinearGradient(16, 3, 16, 29);
    body.addColorStop(0, "#FFC9E5");
    body.addColorStop(1, "#FF8FC7");
    g.fillStyle = body;
    starPath(g, 16, 16, 4, 12.5, 4.4);
    g.fill();
    g.strokeStyle = "#E56AA8";
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.arc(13, 11, 1.6, 0, Math.PI * 2);
    g.fill();
  });
  return powerCache;
}

/* ------------------------------------------------------------------ */
/* 背景与迷宫墙                                                        */
/* ------------------------------------------------------------------ */

/** 圆角矩形路径（只建路径，fill 交给调用方） */
export function pathRoundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/**
 * 夜空背景：深色底 + 20 颗极淡的静态星点。
 * 位置用黄金比例哈希撒出来，同一张画布上永远一样，不闪不抖，
 * 所以 soft 与否都可以画（它本来就是静态的）。
 */
export function drawBackdrop(g: CanvasRenderingContext2D, w: number, h: number, theme: WallTheme): void {
  g.fillStyle = "#241f3a";
  g.fillRect(0, 0, w, h);
  g.fillStyle = theme.spark;
  for (let i = 0; i < 20; i++) {
    const fx = (i * 0.6180339887 + 0.19) % 1;
    const fy = (i * 0.7548776662 + 0.37) % 1;
    const r = 0.7 + ((i * 37) % 5) * 0.16;
    g.globalAlpha = 0.1 + ((i * 13) % 4) * 0.03;
    g.beginPath();
    g.arc(fx * w, fy * h, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** drawWalls 只关心这三样，方便测试用手搓的小迷宫喂它 */
export interface WallGrid {
  w: number;
  h: number;
  wall: readonly boolean[];
}

/**
 * 连通霓虹墙：不再逐格画孤立的小方块。
 * 画两层圆角矩形——外层霓虹描边色、内层深色填充——相邻墙格之间
 * 各补一段连接矩形，墙面就连成一整条，外缘自然留出约 2px 的霓虹描边，
 * 拐角由圆角矩形自带的圆弧收圆。全部落在静态层上，每帧只 drawImage 一次。
 */
export function drawWalls(g: CanvasRenderingContext2D, maze: WallGrid, cell: number, theme: WallTheme): void {
  const at = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= maze.w || y >= maze.h ? false : Boolean(maze.wall[y * maze.w + x]);
  const edgeInset = Math.max(1.5, cell * 0.08);
  const fillInset = edgeInset + 2;
  // 第一层：霓虹描边色打底
  g.fillStyle = theme.edge;
  for (let y = 0; y < maze.h; y++) {
    for (let x = 0; x < maze.w; x++) {
      if (!at(x, y)) continue;
      const px = x * cell;
      const py = y * cell;
      pathRoundRect(g, px + edgeInset, py + edgeInset, cell - edgeInset * 2, cell - edgeInset * 2, cell * 0.24);
      g.fill();
      if (at(x + 1, y)) g.fillRect(px + cell - edgeInset - 1, py + edgeInset, edgeInset * 2 + 2, cell - edgeInset * 2);
      if (at(x, y + 1)) g.fillRect(px + edgeInset, py + cell - edgeInset - 1, cell - edgeInset * 2, edgeInset * 2 + 2);
    }
  }
  // 第二层：内部深色，四周留出的就是霓虹描边
  g.fillStyle = theme.fill;
  for (let y = 0; y < maze.h; y++) {
    for (let x = 0; x < maze.w; x++) {
      if (!at(x, y)) continue;
      const px = x * cell;
      const py = y * cell;
      pathRoundRect(g, px + fillInset, py + fillInset, cell - fillInset * 2, cell - fillInset * 2, cell * 0.18);
      g.fill();
      if (at(x + 1, y)) g.fillRect(px + cell - fillInset - 1, py + fillInset, fillInset * 2 + 2, cell - fillInset * 2);
      if (at(x, y + 1)) g.fillRect(px + fillInset, py + cell - fillInset - 1, cell - fillInset * 2, fillInset * 2 + 2);
    }
  }
}

let versusStarCache: HTMLCanvasElement | null = null;

/** 抢豆模式里星星的棋子：真五角星（金黄渐变 + 描边 + 光晕），不再是蓝圆 */
export function versusStarSprite(): HTMLCanvasElement {
  versusStarCache ??= makeSprite(32, (g) => {
    const halo = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    halo.addColorStop(0, "rgba(255,236,158,0.8)");
    halo.addColorStop(0.6, "rgba(255,226,122,0.25)");
    halo.addColorStop(1, "rgba(255,226,122,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, 32, 32);
    const body = g.createLinearGradient(16, 3, 16, 29);
    body.addColorStop(0, "#FFEC9E");
    body.addColorStop(1, "#F5B93D");
    g.fillStyle = body;
    starPath(g, 16, 17, 5, 12.5, 5.4);
    g.fill();
    g.strokeStyle = "#C98A2E";
    g.lineWidth = 1.4;
    g.lineJoin = "round";
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.arc(12.6, 11.4, 1.7, 0, Math.PI * 2);
    g.fill();
  });
  return versusStarCache;
}

/* ------------------------------------------------------------------ */
/* 小幽灵                                                              */
/* ------------------------------------------------------------------ */

export type GhostFigureMood = "normal" | "fright" | "eyes";

export interface GhostFigureOpts {
  x: number;
  y: number;
  /** 身体半径（≈ 格子的 0.38 倍） */
  r: number;
  /** 身体色（变蓝过渡、白闪帧都由调用方混好再传进来） */
  color: string;
  mood: GhostFigureMood;
  /** 瞳孔顺着移动方向的偏移（像素） */
  pupil: { dx: number; dy: number };
  /** 星星操纵的那只：头顶一颗小金星 */
  starMark: boolean;
  /** 减弱动效下的白描边预警（替代白闪帧） */
  warnRing: boolean;
}

/**
 * 圆头圆脑小幽灵：上半圆 + 四尖波浪裙边 + 顶部高光。
 * 三种状态画法互不相同——normal 是白底深瞳（瞳孔随移动方向偏），
 * fright 是缩成小点的眼睛加一条抖抖的锯齿嘴，eyes 只剩一对眼睛飘回巢。
 */
export function drawGhostFigure(g: CanvasRenderingContext2D, o: GhostFigureOpts): void {
  const { x, y, r } = o;
  if (o.mood === "eyes") {
    g.fillStyle = "#EAF2FF";
    g.beginPath();
    g.arc(x - r * 0.4, y - r * 0.1, r * 0.34, 0, Math.PI * 2);
    g.arc(x + r * 0.4, y - r * 0.1, r * 0.34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#5B79D9";
    g.beginPath();
    g.arc(x - r * 0.4 + o.pupil.dx, y - r * 0.1 + o.pupil.dy, r * 0.16, 0, Math.PI * 2);
    g.arc(x + r * 0.4 + o.pupil.dx, y - r * 0.1 + o.pupil.dy, r * 0.16, 0, Math.PI * 2);
    g.fill();
    return;
  }
  // 身体：上半圆 + 四尖波浪裙边
  const hem = y + r * 0.82;
  const valley = y + r * 0.5;
  const tooth = r / 2;
  g.fillStyle = o.color;
  g.beginPath();
  g.arc(x, y - r * 0.08, r, Math.PI, 0);
  g.lineTo(x + r, valley);
  for (let k = 0; k < 4; k++) {
    g.lineTo(x + r - tooth * (k + 0.5), hem);
    g.lineTo(x + r - tooth * (k + 1), valley);
  }
  g.closePath();
  g.fill();
  // 顶部约两成高度的高光
  g.fillStyle = "rgba(255,255,255,0.32)";
  g.beginPath();
  g.arc(x - r * 0.3, y - r * 0.48, r * 0.32, 0, Math.PI * 2);
  g.fill();
  if (o.mood === "fright") {
    // 吓到了：眼睛缩成小点，嘴抖成锯齿
    g.fillStyle = "#FFFFFF";
    g.beginPath();
    g.arc(x - r * 0.36, y - r * 0.24, r * 0.15, 0, Math.PI * 2);
    g.arc(x + r * 0.36, y - r * 0.24, r * 0.15, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#FFFFFF";
    g.lineWidth = Math.max(1.2, r * 0.1);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    const mx = x - r * 0.48;
    const seg = (r * 0.96) / 6;
    g.moveTo(mx, y + r * 0.3);
    for (let k = 1; k <= 6; k++) {
      g.lineTo(mx + seg * k, y + r * (k % 2 === 1 ? 0.16 : 0.3));
    }
    g.stroke();
  } else {
    // 白底 + 深瞳，瞳孔顺着走向偏一点，跑起来就有「看路」的神气
    g.fillStyle = "#FFFFFF";
    g.beginPath();
    g.arc(x - r * 0.36, y - r * 0.18, r * 0.3, 0, Math.PI * 2);
    g.arc(x + r * 0.36, y - r * 0.18, r * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2f2a45";
    g.beginPath();
    g.arc(x - r * 0.36 + o.pupil.dx, y - r * 0.18 + o.pupil.dy, r * 0.15, 0, Math.PI * 2);
    g.arc(x + r * 0.36 + o.pupil.dx, y - r * 0.18 + o.pupil.dy, r * 0.15, 0, Math.PI * 2);
    g.fill();
  }
  if (o.starMark) {
    // 星星操纵的那只：头顶一颗小金星，比原来的描边圈醒目也不挡脸
    g.fillStyle = "#FFE27A";
    starPath(g, x, y - r * 1.42, 5, r * 0.4, r * 0.17);
    g.fill();
    g.strokeStyle = "#C98A2E";
    g.lineWidth = 1;
    g.stroke();
  }
  if (o.warnRing) {
    g.strokeStyle = "#FFFFFF";
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(x, y, r * 1.18, 0, Math.PI * 2);
    g.stroke();
  }
}

/* ------------------------------------------------------------------ */
/* 玩家：原创豆豆勇士                                                  */
/* ------------------------------------------------------------------ */

/** 四个朝向的脸面向哪个角度 */
export const FACE_ANGLE: Record<Dir, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

export interface PlayerFigureOpts {
  x: number;
  y: number;
  /** 身体半径（≈ 格子的 0.4 倍） */
  r: number;
  dir: Dir;
  /** 张嘴半幅（弧度）；委屈脸时忽略 */
  mouth: number;
  /** 无敌期间的亮色帧（闪烁节奏由调用方掌握） */
  flash: boolean;
  /** 淡金护盾光环（减弱动效时调用方不要开） */
  shield: boolean;
  /** 被抓之后的委屈脸：嘴闭上、眼睛耷下来，0.4s 后照常重来 */
  sad: boolean;
}

/**
 * 豆豆勇士：保持「原创小圆脸」的口径——朝向那侧一只大眼睛、
 * 头顶一根小呆毛、身体是带底部暗晕的径向渐变，和任何街机角色都不同。
 */
export function drawPlayerFigure(g: CanvasRenderingContext2D, o: PlayerFigureOpts): void {
  const { x, y, r } = o;
  const a = FACE_ANGLE[o.dir];
  if (o.shield) {
    g.strokeStyle = "rgba(255,214,110,0.6)";
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(x, y, r * 1.32, 0, Math.PI * 2);
    g.stroke();
  }
  // 身体：径向渐变重心略偏左上，底部自然压出一圈暗晕
  const body = g.createRadialGradient(x - r * 0.24, y - r * 0.3, r * 0.15, x, y, r * 1.02);
  if (o.flash) {
    body.addColorStop(0, "#FFFBE2");
    body.addColorStop(0.72, "#FFF6C9");
    body.addColorStop(1, "#EFD98F");
  } else {
    body.addColorStop(0, "#FFE27A");
    body.addColorStop(0.72, "#F7C24E");
    body.addColorStop(1, "#E19E2B");
  }
  g.fillStyle = body;
  const mouth = o.sad ? 0.02 : Math.max(0.02, o.mouth);
  g.beginPath();
  g.moveTo(x, y);
  g.arc(x, y, r, a + mouth, a - mouth + Math.PI * 2);
  g.closePath();
  g.fill();
  // 头顶一根小呆毛
  g.strokeStyle = "#D99B2B";
  g.lineWidth = 2;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x + r * 0.06, y - r * 0.92);
  g.quadraticCurveTo(x - r * 0.16, y - r * 1.3, x + r * 0.22, y - r * 1.36);
  g.stroke();
  // 朝向那侧的一只眼睛：白底 + 深瞳 + 高光点
  const ea = a - Math.PI * 0.46;
  const ex = x + Math.cos(ea) * r * 0.46;
  const ey = y + Math.sin(ea) * r * 0.46;
  const droop = o.sad ? r * 0.1 : 0;
  g.fillStyle = "#FFFFFF";
  g.beginPath();
  g.arc(ex, ey + droop * 0.5, r * 0.24, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#3A2F1B";
  g.beginPath();
  g.arc(
    ex + (o.sad ? 0 : Math.cos(a) * r * 0.07),
    ey + droop + (o.sad ? 0 : Math.sin(a) * r * 0.07),
    r * 0.12,
    0,
    Math.PI * 2
  );
  g.fill();
  g.fillStyle = "#FFFFFF";
  g.beginPath();
  g.arc(ex + r * 0.03, ey + droop - r * 0.06, r * 0.05, 0, Math.PI * 2);
  g.fill();
  if (o.sad) {
    // 委屈：眉毛一垂、嘴角一撇，仅此而已，下一口气就重新出发
    g.strokeStyle = "#8A6B3A";
    g.lineWidth = Math.max(1.2, r * 0.09);
    g.lineCap = "round";
    g.beginPath();
    g.arc(ex, ey - r * 0.34, r * 0.22, Math.PI * 0.2, Math.PI * 0.8);
    g.stroke();
    g.strokeStyle = "#3A2F1B";
    g.beginPath();
    g.arc(x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.52 + r * 0.3, r * 0.2, Math.PI * 1.2, Math.PI * 1.8);
    g.stroke();
  }
}
