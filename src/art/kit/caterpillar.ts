// 共享美术套件 · 毛毛虫圆节链(1.3 第 20 步 C 档新增)。
//
// 输入「蛇身格数组 + 插值进度」,输出无副作用的 Canvas 2D 绘制调用:
// 不 import 任何 src/games/**,颜色 / 格宽 / 朝向全部由调用方传入,
// 逻辑层零依赖 —— 格子判定完全不动,只是把「方块」画成「圆节」。
// 光源统一左上 45°(三停渐变的亮心都偏左上)。

export type CatCell = readonly [number, number];

/** 头节半径 = CELL × 0.42 */
export const CAT_HEAD_R_RATIO = 0.42;
/** 尾节半径线性递减到 CELL × 0.34 */
export const CAT_TAIL_R_RATIO = 0.34;
/** 节间胶囊宽 = 较小节径 × 0.9 */
export const CAT_LINK_W_RATIO = 0.9;
/** 头部直径小于这个像素数就省略触角(眼睛保留)——360px 小屏兜底 */
export const CAT_ANTENNA_MIN_HEAD_PX = 12;
/** 圆节链在最小屏下的节间距下限(布局自查用) */
export const CAT_MIN_GAP_PX = 1;
/** 吃到奖励星那一帧的全身金闪色 */
export const CAT_GOLD = "#FFD86B";

const TAU = Math.PI * 2;

/** 渐变桩:真 CanvasGradient 与测试桩都只需要这一个方法 */
export interface CatGradient {
  addColorStop(offset: number, color: string): void;
}

/**
 * 画圆节链用到的最小 2D 画布面:真 CanvasRenderingContext2D 结构上满足,
 * 单测给一个记录式桩也满足 —— 不碰 DOM。
 */
export interface Chain2D {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: unknown;
  globalAlpha: number;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  fill(): void;
  stroke(): void;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CatGradient;
}

/** 明暗推导:amt 正变亮负变暗(-1..1);非法输入原样返回,不抛 */
export function catShade(hex: string, amt: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const one = (v: number): number => {
    const t = amt >= 0 ? v + (255 - v) * amt : v * (1 + amt);
    return Math.round(Math.max(0, Math.min(255, t)));
  };
  const r = one((n >> 16) & 255);
  const g = one((n >> 8) & 255);
  const b = one(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** 每节半径:头 CELL×0.42 → 尾 CELL×0.34 线性递减,节数不足也不抛 */
export function nodeRadii(count: number, cell: number): number[] {
  const n = Math.max(0, Math.floor(count));
  const head = cell * CAT_HEAD_R_RATIO;
  const tail = cell * CAT_TAIL_R_RATIO;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : i / (n - 1);
    out.push(head + (tail - head) * t);
  }
  return out;
}

/**
 * 逐节像素中心:上一拍 → 这一拍插值(t 0..1),纯函数不改任何入参。
 * 相邻格距 > 1(穿星门那种大跳)直接落位,不横穿整个园子;
 * prev 比 cells 短(刚吃长了一节)时拿 prev 末位兜底 —— 和逻辑层无关,只是画面。
 */
export function chainCenters(
  cells: ReadonlyArray<CatCell>,
  prev: ReadonlyArray<CatCell>,
  cell: number,
  t: number
): Array<[number, number]> {
  const tt = Math.max(0, Math.min(1, t));
  return cells.map((cur, i) => {
    const old = prev[i] ?? prev[prev.length - 1] ?? cur;
    const jump = Math.abs(cur[0] - old[0]) + Math.abs(cur[1] - old[1]) > 1;
    const gx = jump ? cur[0] : old[0] + (cur[0] - old[0]) * tt;
    const gy = jump ? cur[1] : old[1] + (cur[1] - old[1]) * tt;
    return [(gx + 0.5) * cell, (gy + 0.5) * cell];
  });
}

/** 节间胶囊宽:较小节的直径 × 0.9,胶囊永远藏在两个圆下面 */
export function linkWidth(rA: number, rB: number): number {
  return Math.min(rA, rB) * 2 * CAT_LINK_W_RATIO;
}

/** 头径(直径)不足 12px 就省略触角,眼睛保留 */
export function showAntenna(headRadius: number): boolean {
  return headRadius * 2 >= CAT_ANTENNA_MIN_HEAD_PX;
}

/** 两只眼睛相对头心的偏移:永远朝移动方向看 */
export function eyeOffsets(
  dir: CatCell,
  r: number
): { left: [number, number]; right: [number, number] } {
  const [dx, dy] = dir;
  const px = -dy;
  const py = dx;
  return {
    left: [dx * r * 0.45 + px * r * 0.38, dy * r * 0.45 + py * r * 0.38],
    right: [dx * r * 0.45 - px * r * 0.38, dy * r * 0.45 - py * r * 0.38],
  };
}

/**
 * 鼓包波:吃下去的那一口经过第 index 节时半径鼓一下。
 * bulge 是波此刻的节位置(小数);负数 = 没有波,返回 1。
 */
export function bulgeScale(index: number, bulge: number, width = 1.4): number {
  if (bulge < 0) return 1;
  const d = Math.abs(index - bulge);
  if (d > width) return 1;
  return 1 + 0.24 * Math.cos((d / width) * (Math.PI / 2));
}

export interface CatLook {
  /** 头部主色 */
  head: string;
  /** 身体双色交替 A / B */
  bodyA: string;
  bodyB: string;
  /** 统一落影色(半透明) */
  shadow: string;
}

export interface CaterpillarOpts {
  /** 逐节像素中心,头在前(chainCenters 的输出) */
  centers: ReadonlyArray<CatCell>;
  cell: number;
  look: CatLook;
  /** 移动方向:眼睛朝它看,嘴与触角也顺它长 */
  dir: CatCell;
  /** 吃到点心那一帧张嘴 */
  mouthOpen?: boolean;
  /** 吃到奖励星那一帧全身闪金 */
  goldFlash?: boolean;
  /** 鼓包波位置(节序号小数),负数 = 没有波 */
  bulge?: number;
  /** 摆尾相位 -1 / 0 / 1(reduced 给 0 就静止) */
  tailWag?: number;
}

/** 第 i 节的底色:头一色、身体双色交替;金闪帧全身盖金 */
function nodeColor(i: number, look: CatLook, gold: boolean): string {
  if (gold) return CAT_GOLD;
  if (i === 0) return look.head;
  return i % 2 === 0 ? look.bodyA : look.bodyB;
}

/**
 * 毛毛虫圆节链,六道工序一次画完:
 * ① 逐节落影(仅头与偶数节,避免过密) ② 节间胶囊补隙 ③ 尾节小尖
 * ④ 圆节(尾→头,三停渐变) ⑤ 每节顶部高光一粒 ⑥ 头部触角 + 大眼 + 微笑。
 * 头永远画在最上。
 */
export function drawCaterpillar(ctx: Chain2D, o: CaterpillarOpts): void {
  const n = o.centers.length;
  if (n === 0 || !(o.cell > 0)) return;
  const radii = nodeRadii(n, o.cell);
  const bulge = o.bulge ?? -9;
  const rAt = (i: number): number => radii[i] * bulgeScale(i, bulge);
  const gold = o.goldFlash === true;

  // ① 落影:头与偶数节
  ctx.fillStyle = o.look.shadow;
  for (let i = n - 1; i >= 0; i--) {
    if (i !== 0 && i % 2 !== 0) continue;
    const [x, y] = o.centers[i];
    const r = rAt(i);
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.66, r * 0.92, r * 0.34, 0, 0, TAU);
    ctx.fill();
  }

  // ② 节间胶囊补隙:相邻节中心连线方向,宽 = 较小节径 × 0.9;穿门大跳不补
  ctx.lineCap = "round";
  for (let i = n - 1; i >= 1; i--) {
    const [ax, ay] = o.centers[i];
    const [bx, by] = o.centers[i - 1];
    if (Math.hypot(bx - ax, by - ay) > o.cell + 0.001) continue;
    ctx.strokeStyle = nodeColor(i, o.look, gold);
    ctx.lineWidth = linkWidth(rAt(i), rAt(i - 1));
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  // ③ 尾节小尖(带一点摆尾;单节小虫没有尾巴)
  if (n >= 2) {
    const [tx, ty] = o.centers[n - 1];
    const [sx, sy] = o.centers[n - 2];
    let vx = tx - sx;
    let vy = ty - sy;
    const len = Math.hypot(vx, vy) || 1;
    vx /= len;
    vy /= len;
    const ox = -vy;
    const oy = vx;
    const r = rAt(n - 1);
    const wag = (o.tailWag ?? 0) * r * 0.3;
    ctx.fillStyle = catShade(nodeColor(n - 1, o.look, gold), -0.08);
    ctx.beginPath();
    ctx.moveTo(tx + ox * r * 0.6, ty + oy * r * 0.6);
    ctx.quadraticCurveTo(
      tx + vx * r * 1.05 + ox * wag * 0.5,
      ty + vy * r * 1.05 + oy * wag * 0.5,
      tx + vx * r * 1.55 + ox * wag,
      ty + vy * r * 1.55 + oy * wag
    );
    ctx.quadraticCurveTo(tx + vx * r * 1.05, ty + vy * r * 1.05, tx - ox * r * 0.6, ty - oy * r * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  // ④⑤ 圆节尾→头:三停渐变(亮心偏左上 45°) + 顶部高光一粒(偏左上 30%)
  for (let i = n - 1; i >= 0; i--) {
    const [x, y] = o.centers[i];
    const r = rAt(i);
    const base = nodeColor(i, o.look, gold);
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.15, x, y, r);
    g.addColorStop(0, catShade(base, 0.28));
    g.addColorStop(0.62, base);
    g.addColorStop(1, catShade(base, -0.18));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.2, 0, TAU);
    ctx.fill();
  }

  // ⑥ 头部:触角(小头省略) + 大眼朝移动方向 + 腮红 + 微笑 / 张嘴
  drawFace(ctx, o, rAt(0));
}

function drawFace(ctx: Chain2D, o: CaterpillarOpts, r: number): void {
  const [hx, hy] = o.centers[0];
  const [dx, dy] = o.dir;
  const px = -dy;
  const py = dx;
  const headColor = o.goldFlash === true ? CAT_GOLD : o.look.head;

  // 触角两根:球头,顺前进方向往外撇;头径 < 12px 时省略
  if (showAntenna(r)) {
    ctx.strokeStyle = catShade(headColor, -0.3);
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.lineCap = "round";
    for (const side of [1, -1]) {
      const bx = hx + dx * r * 0.35 + px * side * r * 0.4;
      const by = hy + dy * r * 0.35 + py * side * r * 0.4;
      const tx = hx + dx * r * 1.0 + px * side * r * 0.85;
      const ty = hy + dy * r * 1.0 + py * side * r * 0.85;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(
        hx + dx * r * 0.8 + px * side * r * 0.45,
        hy + dy * r * 0.8 + py * side * r * 0.45,
        tx,
        ty
      );
      ctx.stroke();
      ctx.fillStyle = catShade(headColor, -0.22);
      ctx.beginPath();
      ctx.arc(tx, ty, r * 0.18, 0, TAU);
      ctx.fill();
    }
  }

  // 大眼:眼白 + 黑瞳 + 眼神光,永远朝移动方向看
  const eyes = eyeOffsets(o.dir, r);
  for (const [ex, ey] of [eyes.left, eyes.right]) {
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(hx + ex, hy + ey, r * 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#2F4F2A";
    ctx.beginPath();
    ctx.arc(hx + ex + dx * r * 0.09, hy + ey + dy * r * 0.09, r * 0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(hx + ex + dx * r * 0.02 - r * 0.05, hy + ey + dy * r * 0.02 - r * 0.05, r * 0.05, 0, TAU);
    ctx.fill();
  }

  // 腮红两点
  ctx.fillStyle = "rgba(255,138,150,0.5)";
  for (const side of [1, -1]) {
    ctx.beginPath();
    ctx.arc(hx + dx * r * 0.12 + px * side * r * 0.62, hy + dy * r * 0.12 + py * side * r * 0.62, r * 0.14, 0, TAU);
    ctx.fill();
  }

  // 微笑弧;吃到点心那一帧改成小圆张嘴
  if (o.mouthOpen === true) {
    ctx.fillStyle = "#7A4A3A";
    ctx.beginPath();
    ctx.arc(hx + dx * r * 0.55, hy + dy * r * 0.55, r * 0.24, 0, TAU);
    ctx.fill();
  } else {
    const a = Math.atan2(dy, dx);
    ctx.strokeStyle = "#5B7A4E";
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(hx + dx * r * 0.38, hy + dy * r * 0.38, r * 0.26, a - 0.55, a + 0.55);
    ctx.stroke();
  }
}
