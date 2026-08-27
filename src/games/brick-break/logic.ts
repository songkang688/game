/**
 * 碰碰砖块 · 纯逻辑层（1.2 抽出）
 *
 * 1.1 的时候反弹、碰撞、掉落全都写在 `index.ts` 的 rAF 循环里，
 * 想验证「板边打的球会不会角度太平」「高速球会不会穿砖」只能靠肉眼盯屏幕。
 * 1.2 把这些规则搬到这里，全部做成不碰 DOM 的纯函数，于是可以直接写断言：
 *
 *  - 出射角永远落在 20°–160°（不会出现贴地横飞的死球）
 *  - 8 秒没打到砖就每秒把角度掰竖 2°，并且掰的方向一定是「更竖直」
 *  - 碰撞用「上一帧位置 → 这一帧位置」的线段与砖块 AABB 求交，
 *    球再快也不会从砖缝里穿过去
 *  - 六种砖、六种道具的时限与效果上限
 *  - 无尽「砖塔」的下移节奏与触底判定
 *
 * 玩法数值（前 99 关的砖阵、球速、板宽）在 `levels.ts`，这里一个都不改。
 */

import { COLS, type BrickLevel } from "./levels";
import { mulberry32 } from "../level99";

// ---------------------------------------------------------------------------
// 球台尺寸（从 index.ts 搬过来，模拟器与渲染共用同一套）
// ---------------------------------------------------------------------------

export const W = 360;
export const H = 430;
export const BRICK_H = 18;
export const BRICK_TOP = 42;
export const PADDLE_H = 12;
export const PADDLE_Y = H - 24;
export const BALL_R = 7;
/** 星门传送后的冷却（秒），防止球在两扇门之间来回抖 */
export const PORTAL_COOLDOWN = 0.4;

// ---------------------------------------------------------------------------
// 一、反弹模型：按接触点偏移决定出射角，角度锁在 20°–160°
// ---------------------------------------------------------------------------

/** 出射角下限（度，从水平向右量起；90° = 竖直向上） */
export const MIN_BOUNCE_DEG = 20;
/** 出射角上限（度）；低于下限或高于上限都会变成贴地横飞的死球 */
export const MAX_BOUNCE_DEG = 160;

const DEG = Math.PI / 180;

/** 把接触点偏移（-1 = 板最左，0 = 板心，1 = 板最右）换成出射角 */
export function bounceDegFromOffset(offset: number): number {
  const o = Math.max(-1, Math.min(1, offset));
  return 90 - o * (90 - MIN_BOUNCE_DEG);
}

/** 球打在板上的接触点偏移；超出板宽会被夹到 ±1 */
export function paddleOffset(ballX: number, paddleX: number, paddleW: number): number {
  if (paddleW <= 0) return 0;
  return Math.max(-1, Math.min(1, (ballX - paddleX) / (paddleW / 2)));
}

/** 板子反弹：接触点越靠边角度越平，但永远不会平过 20° */
export function paddleBounce(
  ballX: number,
  paddleX: number,
  paddleW: number,
  speed: number
): { vx: number; vy: number } {
  const deg = bounceDegFromOffset(paddleOffset(ballX, paddleX, paddleW));
  const rad = deg * DEG;
  return { vx: Math.cos(rad) * speed, vy: -Math.sin(rad) * speed };
}

/** 发球角度：也走同一套上下限，永远不会一发球就横着飞 */
export function launchVelocity(speed: number, roll: number, spread = 0): { vx: number; vy: number } {
  const t = Math.max(0, Math.min(1, roll));
  // 只在 ±45° 的锥形里发球，spread 给多球留出岔开的余量
  const deg = Math.max(MIN_BOUNCE_DEG, Math.min(MAX_BOUNCE_DEG, 90 + (t - 0.5) * 60 + spread));
  const rad = deg * DEG;
  return { vx: Math.cos(rad) * speed, vy: -Math.sin(rad) * speed };
}

/** 速度矢量与水平方向的夹角（0°–90°，越小越平） */
export function flatnessDeg(vx: number, vy: number): number {
  const speed = Math.hypot(vx, vy);
  if (speed === 0) return 90;
  return Math.abs(Math.asin(Math.abs(vy) / speed)) / DEG;
}

/** 向上飞的球是否落在 20°–160° 的安全区里 */
export function angleWithinLimits(vx: number, vy: number): boolean {
  return flatnessDeg(vx, vy) >= MIN_BOUNCE_DEG - 1e-6;
}

// ---------------------------------------------------------------------------
// 二、水平死球自纠：8 秒没击中砖，就每秒把角度掰竖 2°
// ---------------------------------------------------------------------------

export const STALL_SECONDS = 8;
export const STALL_NUDGE_DEG = 2;

/** 距上次击砖 elapsed 秒，累计应当施加过几次微调 */
export function stallNudges(elapsed: number): number {
  if (!Number.isFinite(elapsed) || elapsed < STALL_SECONDS) return 0;
  return Math.floor(elapsed - STALL_SECONDS) + 1;
}

/** 把速度往「更竖直」的方向转 deg 度，速度大小不变 */
export function nudgeToVertical(vx: number, vy: number, deg: number): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy);
  if (speed === 0) return { vx, vy };
  const a = Math.atan2(vy, vx);
  // |sin a| 对 a 的导数是 cos a · sign(sin a)：顺着它转就一定更竖
  const slope = Math.cos(a) * (Math.sin(a) >= 0 ? 1 : -1);
  const dir = slope >= 0 ? 1 : -1;
  const next = a + dir * deg * DEG;
  return { vx: Math.cos(next) * speed, vy: Math.sin(next) * speed };
}

/** 死球提示语（只鼓励、不批评） */
export const STALL_HINT = "球有点绕晕啦，帮它把方向掰正一点，往砖多的一边接～";

// ---------------------------------------------------------------------------
// 三、连续碰撞检测：线段（上一帧 → 这一帧）对砖块 AABB 求交
// ---------------------------------------------------------------------------

export interface Aabb {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SweepHit {
  /** 命中发生在这一段位移的 t（0–1） */
  t: number;
  /** 命中面的法线（只会是 ±1 / 0） */
  nx: number;
  ny: number;
}

/**
 * 半径 r 的球从 (px,py) 沿 (dx,dy) 走一整段，第一次撞到 box 的时刻与法线。
 * 做法是把盒子按半径外扩，再对射线做经典的 slab 求交。
 */
export function sweepAabb(
  px: number,
  py: number,
  dx: number,
  dy: number,
  box: Aabb,
  r: number
): SweepHit | null {
  const x0 = box.x0 - r;
  const y0 = box.y0 - r;
  const x1 = box.x1 + r;
  const y1 = box.y1 + r;

  // 起点已经陷在盒子里：按最浅的那一面推出去，绝不让球卡死在砖里
  if (px > x0 && px < x1 && py > y0 && py < y1) {
    const left = px - x0;
    const right = x1 - px;
    const up = py - y0;
    const down = y1 - py;
    const m = Math.min(left, right, up, down);
    if (m === left) return { t: 0, nx: -1, ny: 0 };
    if (m === right) return { t: 0, nx: 1, ny: 0 };
    if (m === up) return { t: 0, nx: 0, ny: -1 };
    return { t: 0, nx: 0, ny: 1 };
  }

  let tMin = 0;
  let tMax = 1;
  let nx = 0;
  let ny = 0;

  if (dx === 0) {
    if (px <= x0 || px >= x1) return null;
  } else {
    let t1 = (x0 - px) / dx;
    let t2 = (x1 - px) / dx;
    let n = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      n = 1;
    }
    if (t1 > tMin) {
      tMin = t1;
      nx = n;
      ny = 0;
    }
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  if (dy === 0) {
    if (py <= y0 || py >= y1) return null;
  } else {
    let t1 = (y0 - py) / dy;
    let t2 = (y1 - py) / dy;
    let n = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      n = 1;
    }
    if (t1 > tMin) {
      tMin = t1;
      nx = 0;
      ny = n;
    }
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  if (tMin > 1 || tMin < 0) return null;
  if (nx === 0 && ny === 0) return null;
  return { t: tMin, nx, ny };
}

export interface BrickGeom {
  rows: number;
  cols: number;
  brickW: number;
  brickH: number;
  /** 第一行砖的顶边 y */
  top: number;
  /** 砖阵整体的横向偏移（滑动迷阵用） */
  offsetX: number;
  /** 砖块四周留出的缝（渲染与碰撞用同一个值） */
  inset?: number;
}

export function brickBox(geom: BrickGeom, r: number, c: number): Aabb {
  const pad = geom.inset ?? 2;
  const x = geom.offsetX + c * geom.brickW;
  const y = geom.top + r * geom.brickH;
  return { x0: x + pad, y0: y + pad, x1: x + geom.brickW - pad, y1: y + geom.brickH - pad };
}

export interface BrickHit extends SweepHit {
  r: number;
  c: number;
}

/** 这一段位移里第一块被撞到的砖（没有就是 null） */
export function firstBrickHit(
  geom: BrickGeom,
  solid: (r: number, c: number) => boolean,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number
): BrickHit | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const minX = Math.min(x0, x1) - radius;
  const maxX = Math.max(x0, x1) + radius;
  const minY = Math.min(y0, y1) - radius;
  const maxY = Math.max(y0, y1) + radius;
  const c0 = Math.max(0, Math.floor((minX - geom.offsetX) / geom.brickW));
  const c1 = Math.min(geom.cols - 1, Math.floor((maxX - geom.offsetX) / geom.brickW));
  const r0 = Math.max(0, Math.floor((minY - geom.top) / geom.brickH));
  const r1 = Math.min(geom.rows - 1, Math.floor((maxY - geom.top) / geom.brickH));

  let best: BrickHit | null = null;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!solid(r, c)) continue;
      const hit = sweepAabb(x0, y0, dx, dy, brickBox(geom, r, c), radius);
      if (hit && (!best || hit.t < best.t)) best = { ...hit, r, c };
    }
  }
  return best;
}

export interface BallLike {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface StepWorld {
  geom: BrickGeom;
  radius: number;
  left: number;
  right: number;
  top: number;
  solid: (r: number, c: number) => boolean;
  /** 命中一块砖：返回 "bounce" 反弹，返回 "pass" 直接穿过去（穿透球 / 星门） */
  hit: (r: number, c: number, ball: BallLike, normal: SweepHit) => "bounce" | "pass";
  wall?: (side: "left" | "right" | "top") => void;
}

/** 一帧最多解算几次「撞了再走」，防病态输入把循环拖死 */
const MAX_SUBSTEPS = 8;

/**
 * 推进一颗球 dt 秒：位移被切成若干段，每段都做连续碰撞检测。
 * 球速再高也不会跳过砖块（这正是 1.1 的隧穿老毛病）。
 * 会就地改写 ball，返回本帧命中了几块砖。
 */
export function stepBall(ball: BallLike, dt: number, world: StepWorld): number {
  let remain = dt;
  let hits = 0;
  const done = new Set<number>();
  const solid = (r: number, c: number) => !done.has(r * 1000 + c) && world.solid(r, c);

  for (let guard = 0; guard < MAX_SUBSTEPS && remain > 1e-9; guard++) {
    const nx = ball.x + ball.vx * remain;
    const ny = ball.y + ball.vy * remain;
    const hit = firstBrickHit(world.geom, solid, ball.x, ball.y, nx, ny, world.radius);
    if (!hit) {
      ball.x = nx;
      ball.y = ny;
      remain = 0;
    } else {
      const t = Math.max(0, Math.min(1, hit.t));
      ball.x += ball.vx * remain * t;
      ball.y += ball.vy * remain * t;
      const how = world.hit(hit.r, hit.c, ball, hit);
      if (how === "bounce") {
        if (hit.nx !== 0) ball.vx = Math.abs(ball.vx) * hit.nx;
        if (hit.ny !== 0) ball.vy = Math.abs(ball.vy) * hit.ny;
        // 沿新方向挪出一丁点，避免贴着砖面反复触发
        ball.x += ball.vx * 1e-4;
        ball.y += ball.vy * 1e-4;
      }
      done.add(hit.r * 1000 + hit.c);
      remain *= 1 - t;
      hits++;
    }

    if (ball.x < world.left + world.radius) {
      ball.x = world.left + world.radius;
      ball.vx = Math.abs(ball.vx);
      world.wall?.("left");
    } else if (ball.x > world.right - world.radius) {
      ball.x = world.right - world.radius;
      ball.vx = -Math.abs(ball.vx);
      world.wall?.("right");
    }
    if (ball.y < world.top + world.radius) {
      ball.y = world.top + world.radius;
      ball.vy = Math.abs(ball.vy);
      world.wall?.("top");
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// 四、砖块体系：六种砖，颜色 + 图案双通道
// ---------------------------------------------------------------------------

export const KIND = {
  EMPTY: 0,
  /** 普通砖：一下就碎 */
  NORMAL: 1,
  /** 二层砖：打两下（1.0 的「钢砖」，砖阵数据一个字都没改） */
  TWO: 2,
  /** 星门：打不碎，球会被传送 */
  PORTAL: 3,
  /** 图案砖：图案工坊的目标砖 */
  PATTERN: 4,
  /** 三层砖：打三下 */
  THREE: 5,
  /** 钢砖：普通球打不动，得靠穿透球 */
  STEEL: 6,
  /** 爆米花砖：碎的时候连带炸掉周围一圈 */
  POPCORN: 7,
  /** 道具砖：碎了必掉一颗道具 */
  GIFT: 8
} as const;

/** 图案通道：不靠颜色也能认出砖的种类（色觉不一样的孩子也分得清） */
export type BrickMark = "none" | "layers2" | "layers3" | "bolt" | "corn" | "gift" | "swirl" | "shine";

export interface BrickInfo {
  kind: number;
  name: string;
  /** 还要挨几下才碎（钢砖是 Infinity） */
  hits: number;
  breakable: boolean;
  /** 只有穿透球才能清掉 */
  needsPierce: boolean;
  /** 碎的时候连带周围一圈 */
  chain: boolean;
  /** 碎的时候必掉道具 */
  gift: boolean;
  color: string;
  mark: BrickMark;
}

export const BRICKS: Readonly<Record<number, BrickInfo>> = {
  [KIND.NORMAL]: { kind: 1, name: "普通砖", hits: 1, breakable: true, needsPierce: false, chain: false, gift: false, color: "#FF9EC8", mark: "none" },
  [KIND.TWO]: { kind: 2, name: "二层砖", hits: 2, breakable: true, needsPierce: false, chain: false, gift: false, color: "#9AA0AE", mark: "layers2" },
  [KIND.PORTAL]: { kind: 3, name: "星门", hits: Infinity, breakable: false, needsPierce: false, chain: false, gift: false, color: "#7B6CD9", mark: "swirl" },
  [KIND.PATTERN]: { kind: 4, name: "图案砖", hits: 1, breakable: true, needsPierce: false, chain: false, gift: false, color: "#FFC53D", mark: "shine" },
  [KIND.THREE]: { kind: 5, name: "三层砖", hits: 3, breakable: true, needsPierce: false, chain: false, gift: false, color: "#7E8798", mark: "layers3" },
  [KIND.STEEL]: { kind: 6, name: "钢砖", hits: Infinity, breakable: false, needsPierce: true, chain: false, gift: false, color: "#5F6A7D", mark: "bolt" },
  [KIND.POPCORN]: { kind: 7, name: "爆米花砖", hits: 1, breakable: true, needsPierce: false, chain: true, gift: false, color: "#FFE9A8", mark: "corn" },
  [KIND.GIFT]: { kind: 8, name: "道具砖", hits: 1, breakable: true, needsPierce: false, chain: false, gift: true, color: "#8FE0C6", mark: "gift" }
};

/** 1.2 的六种砖（星门与图案砖属于关卡机制，不算在「砖块体系」里） */
export const BRICK_KINDS: readonly number[] = [KIND.NORMAL, KIND.TWO, KIND.THREE, KIND.STEEL, KIND.POPCORN, KIND.GIFT];

export function brickInfo(v: number): BrickInfo | null {
  return BRICKS[v] ?? null;
}

export function isBreakableKind(v: number): boolean {
  return brickInfo(v)?.breakable === true;
}

export interface DamageResult {
  /** 挨完这一下之后格子里剩下什么（多层砖会掉一层） */
  next: number;
  /** 是否被彻底打碎 */
  broken: boolean;
  /** 是否要连带炸掉周围一圈 */
  chain: boolean;
  /** 是否要掉一颗道具 */
  gift: boolean;
}

/**
 * 打一下某种砖。多层砖用「掉一层」表示掉血：三层 → 二层 → 普通 → 空，
 * 于是渲染层看一眼格子里的值就知道还剩几层，不用再维护一份 hp 矩阵。
 */
export function damageBrick(v: number, pierce = false): DamageResult {
  const info = brickInfo(v);
  if (!info) return { next: v, broken: false, chain: false, gift: false };
  if (!info.breakable) {
    if (info.needsPierce && pierce) return { next: KIND.EMPTY, broken: true, chain: false, gift: false };
    return { next: v, broken: false, chain: false, gift: false };
  }
  if (pierce || info.hits <= 1) {
    return { next: KIND.EMPTY, broken: true, chain: info.chain, gift: info.gift };
  }
  if (v === KIND.THREE) return { next: KIND.TWO, broken: false, chain: false, gift: false };
  if (v === KIND.TWO) return { next: KIND.NORMAL, broken: false, chain: false, gift: false };
  return { next: KIND.EMPTY, broken: true, chain: info.chain, gift: info.gift };
}

/** 爆米花砖连带的格子：周围一圈八格（越界的不算） */
export function popcornTargets(r: number, c: number, rows: number, cols: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push([rr, cc]);
    }
  }
  return out;
}

/**
 * 渲染用：原始砖种 + 格子里现在剩什么 → 颜色与图案。
 * 掉一层就浅一档、图案上的横线也少一条，孩子看一眼就知道还差几下。
 */
export function brickFace(orig: number, cur: number): { color: string; mark: BrickMark; steps: number } {
  const o = brickInfo(orig);
  const n = brickInfo(cur);
  if (!n) return { color: "#FFFFFF", mark: "none", steps: 0 };
  const full = o && Number.isFinite(o.hits) ? o.hits : n.hits;
  const left = Number.isFinite(n.hits) ? n.hits : full;
  const steps = Math.max(0, (Number.isFinite(full) ? full : 0) - (Number.isFinite(left) ? left : 0));
  return { color: lighten((o ?? n).color, steps * 28), mark: n.mark, steps };
}

export function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amount);
  const g = Math.min(255, ((n >> 8) & 255) + amount);
  const b = Math.min(255, (n & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// 五、道具：全部有时限，没有一个是永久强化
// ---------------------------------------------------------------------------

export type PowerKind = "wide" | "triple" | "pierce" | "slow" | "magnet" | "narrow";

export interface PowerInfo {
  key: PowerKind;
  name: string;
  emoji: string;
  /** 持续秒数；0 表示一次性生效（分身球），不会变成常驻加成 */
  seconds: number;
  /** 是不是对孩子有利的道具 */
  good: boolean;
  hint: string;
  /** 掉落权重 */
  weight: number;
}

export const POWERS: Readonly<Record<PowerKind, PowerInfo>> = {
  wide: { key: "wide", name: "加宽板", emoji: "🧽", seconds: 12, good: true, hint: "球拍变宽 12 秒！", weight: 22 },
  triple: { key: "triple", name: "三球", emoji: "🎊", seconds: 0, good: true, hint: "一下变三颗球！", weight: 18 },
  pierce: { key: "pierce", name: "穿透球", emoji: "💫", seconds: 8, good: true, hint: "8 秒里球会穿砖，连钢砖都能清！", weight: 14 },
  slow: { key: "slow", name: "慢速", emoji: "🐢", seconds: 10, good: true, hint: "球慢下来 10 秒，好好瞄！", weight: 16 },
  magnet: { key: "magnet", name: "磁力板", emoji: "🧲", seconds: 10, good: true, hint: "10 秒里接住就能再发一次！", weight: 18 },
  narrow: { key: "narrow", name: "小板子", emoji: "🌀", seconds: 5, good: false, hint: "板子小了一点点，5 秒就好～", weight: 12 }
};

export const POWER_ORDER: readonly PowerKind[] = ["wide", "triple", "pierce", "slow", "magnet", "narrow"];

/** 任何道具都不许超过这个秒数（防止「拿到就赢」） */
export const MAX_POWER_SECONDS = 15;

export type PowerTimers = Partial<Record<PowerKind, number>>;

export function grantPower(timers: PowerTimers, kind: PowerKind): PowerTimers {
  const info = POWERS[kind];
  if (!info || info.seconds <= 0) return { ...timers };
  const next: PowerTimers = { ...timers };
  // 同种道具续时间，但封顶在单次时限，不会越叠越长
  next[kind] = Math.min(info.seconds, (next[kind] ?? 0) + info.seconds);
  if (kind === "narrow") delete next.wide;
  if (kind === "wide") delete next.narrow;
  return next;
}

export function tickPowers(timers: PowerTimers, dt: number): PowerTimers {
  const next: PowerTimers = {};
  for (const key of POWER_ORDER) {
    const left = timers[key];
    if (left === undefined) continue;
    const v = left - dt;
    if (v > 0) next[key] = v;
  }
  return next;
}

export interface PowerEffects {
  paddleScale: number;
  pierce: boolean;
  magnet: boolean;
  speedScale: number;
}

/** 板宽倍率的上下限：再怎么叠也不会宽到「站着不动就赢」 */
export const PADDLE_SCALE_MIN = 0.72;
export const PADDLE_SCALE_MAX = 1.5;

export function powerEffects(timers: PowerTimers): PowerEffects {
  let scale = 1;
  if ((timers.wide ?? 0) > 0) scale *= 1.5;
  if ((timers.narrow ?? 0) > 0) scale *= 0.72;
  return {
    paddleScale: Math.max(PADDLE_SCALE_MIN, Math.min(PADDLE_SCALE_MAX, scale)),
    pierce: (timers.pierce ?? 0) > 0,
    magnet: (timers.magnet ?? 0) > 0,
    speedScale: (timers.slow ?? 0) > 0 ? 0.7 : 1
  };
}

/** 按权重摇一颗道具 */
export function rollPower(roll: number): PowerKind {
  const total = POWER_ORDER.reduce((sum, k) => sum + POWERS[k].weight, 0);
  let acc = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const k of POWER_ORDER) {
    acc -= POWERS[k].weight;
    if (acc < 0) return k;
  }
  return "wide";
}

/**
 * 一颗胶囊该画成什么样。
 *
 * 原来好道具和「别接的那个」只差一点点粉（`#FFFFFF` 对 `#FFE1E9`），
 * 两者都是实心圆、都印一个表情。色弱的孩子分不出这点色差，
 * 四岁还不识字的孩子更是只能靠颜色猜——猜错就白丢五秒板宽。
 * 改成「好的是实心、别接的是空心圈」之后，形状本身就把话说清楚了，
 * 颜色只是锦上添花。
 */
export interface CapsuleLook {
  fill: string;
  /** 空心圈：只描边、中间留空。形状本身就是「别接我」 */
  hollow: boolean;
  emoji: string;
}

export function capsuleLook(kind: PowerKind): CapsuleLook {
  const info = POWERS[kind];
  return info.good
    ? { fill: "#FFFFFF", hollow: false, emoji: info.emoji }
    : { fill: "#FFE1E9", hollow: true, emoji: info.emoji };
}

/** 掉落胶囊的下落速度（像素/秒） */
export const CAPSULE_SPEED = 130;
/** 闯关里打碎一块普通砖掉道具的概率（道具砖是必掉） */
export const DROP_CHANCE = 0.09;

export function powerBarLabel(timers: PowerTimers): string {
  const parts: string[] = [];
  for (const k of POWER_ORDER) {
    const left = timers[k];
    if (left === undefined || left <= 0) continue;
    parts.push(`${POWERS[k].emoji}${Math.ceil(left)}`);
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// 六、无尽「砖塔」：砖墙不断下移，打掉一行加分，触底就收工
// ---------------------------------------------------------------------------

export const TOWER_COLS = 8;
export const TOWER_TOP = 30;
/** 砖墙压到这条线就收工（球拍上方留出手的空间） */
export const TOWER_FLOOR = 318;
export const TOWER_START_ROWS = 4;

export interface TowerState {
  /** rows[0] 是最上面一排；新排从上面推进来 */
  rows: number[][];
  /** 距离「再推一排」还差多少像素（0 – 一行高） */
  drop: number;
  /** 一共推出来过几排 */
  spawned: number;
  rowsCleared: number;
  bricksBroken: number;
  score: number;
  /** 这一趟玩了多少秒——下压速度只跟它有关 */
  elapsed: number;
  over: boolean;
}

/** 开局的下压速度（像素/秒） */
export const TOWER_SPEED_BASE = 7;
/** 每玩一秒，下压速度加这么多 */
export const TOWER_SPEED_RAMP = 0.075;
/** 下压速度的天花板：到了这一档就不再快了，剩下的全看手熟 */
export const TOWER_SPEED_MAX = 17;

/**
 * 下移速度（像素/秒）：只跟「这一趟玩了多久」有关。
 *
 * 原来它是 `min(26, 7 + rowsCleared × 1.2)`——按清掉的行数加速。
 * 那等于「打得越好，墙压得越快」：清一行换来 18 像素的喘息，
 * 却把往后每一秒的下压都抬高 1.2 像素，十几秒就回本亏光。
 * 走查里 2 / 3 / 4 / 6 砖每秒四种手速全都活不过 40 秒，而且手越快死得越早。
 * 改成按时间加速之后，清行是纯赚的，孩子打得好就真的能多玩一会儿。
 */
export function towerSpeed(elapsed: number): number {
  return Math.min(TOWER_SPEED_MAX, TOWER_SPEED_BASE + Math.max(0, elapsed) * TOWER_SPEED_RAMP);
}

/**
 * 把已经打空的排收掉，下面那半截整体往上提一格。
 *
 * 原来空排是原地留着的（怕行号变了砖墙看起来「跳一下」），
 * 于是「清掉中间一行」对底线一点帮助都没有——只有把最底下那排清光才换得到 18 像素。
 * 现在清哪一行都算数：跳的那一下是往上跳，是奖励，孩子看得懂。
 *
 * 只在 `towerTick` 里调用（每帧开头一次），这样一帧之内的碰撞扫描看到的行号是稳的。
 */
export function squeezeTower(rows: readonly number[][]): number[][] {
  return rows.filter((row) => row.some((v) => v !== KIND.EMPTY)).map((row) => row.slice());
}

/**
 * 这一排算不算「打通了」：所有格子非空即钢。
 * 钢砖球打不动，所以「只剩钢砖」就是孩子能做到的极限——
 * 到了这一步就该算他赢，剩下的钢砖跟着一起塌。
 */
export function rowSettled(row: readonly number[]): boolean {
  return row.every((v) => v === KIND.EMPTY || v === KIND.STEEL);
}

/** 第 wave 排砖长什么样（越往后越硬，但永远留得下缝） */
export function makeTowerRow(rand: () => number, wave: number): number[] {
  const row = new Array<number>(TOWER_COLS).fill(KIND.EMPTY);
  const fill = Math.min(0.92, 0.6 + wave * 0.012);
  const hardChance = Math.min(0.34, wave * 0.02);
  const steelChance = wave >= 8 ? Math.min(0.12, (wave - 8) * 0.01) : 0;
  for (let c = 0; c < TOWER_COLS; c++) {
    if (rand() >= fill) continue;
    const r = rand();
    if (r < steelChance) row[c] = KIND.STEEL;
    else if (r < steelChance + hardChance * 0.35) row[c] = KIND.THREE;
    else if (r < steelChance + hardChance) row[c] = KIND.TWO;
    else if (r < steelChance + hardChance + 0.07) row[c] = KIND.POPCORN;
    else if (r < steelChance + hardChance + 0.13) row[c] = KIND.GIFT;
    else row[c] = KIND.NORMAL;
  }
  // 一排全空就没意思，也一排全钢就打不动：两头都兜一下
  const solid = row.filter((v) => v !== KIND.EMPTY);
  if (solid.length === 0) row[Math.floor(rand() * TOWER_COLS)] = KIND.NORMAL;
  if (solid.length > 0 && solid.every((v) => v === KIND.STEEL)) row[Math.floor(rand() * TOWER_COLS)] = KIND.NORMAL;
  return row;
}

export function makeTower(rand: () => number): TowerState {
  const rows: number[][] = [];
  for (let i = 0; i < TOWER_START_ROWS; i++) rows.unshift(makeTowerRow(rand, i));
  return { rows, drop: 0, spawned: TOWER_START_ROWS, rowsCleared: 0, bricksBroken: 0, score: 0, elapsed: 0, over: false };
}

/** 砖墙最下面那一块砖的底边 y */
export function towerBottomY(state: TowerState): number {
  let last = -1;
  for (let r = 0; r < state.rows.length; r++) {
    if (state.rows[r].some((v) => v !== KIND.EMPTY)) last = r;
  }
  return TOWER_TOP + state.drop + (last + 1) * BRICK_H;
}

/** 某一排砖当前的顶边 y */
export function towerRowY(state: TowerState, r: number): number {
  return TOWER_TOP + state.drop + r * BRICK_H;
}

/** 推进 dt 秒：砖墙下移，够一行就从顶上补一排，压到底线就结束 */
export function towerTick(state: TowerState, dt: number, rand: () => number): TowerState {
  if (state.over) return state;
  const elapsed = state.elapsed + Math.max(0, dt);
  let drop = state.drop + towerSpeed(state.elapsed) * dt;
  // 上一帧打空的排在这里统一收走：帧内的碰撞扫描看到的行号才是稳的
  let rows: number[][] = state.rows.some((row) => row.every((v) => v === KIND.EMPTY))
    ? squeezeTower(state.rows)
    : state.rows;
  let spawned = state.spawned;
  let guard = 0;
  while (drop >= BRICK_H && guard++ < 16) {
    drop -= BRICK_H;
    rows = [makeTowerRow(rand, spawned), ...rows];
    spawned++;
  }
  const next: TowerState = { ...state, rows, drop, spawned, elapsed };
  next.over = towerBottomY(next) >= TOWER_FLOOR;
  return next;
}

/** 清掉一整排的得分：清得越多，一排越值钱（封顶，避免数字大到读不懂） */
export function towerRowScore(rowsCleared: number): number {
  return 10 + Math.min(20, rowsCleared) * 2;
}

/** 打碎一块砖的得分 */
export function towerBrickScore(kind: number): number {
  if (kind === KIND.THREE) return 3;
  if (kind === KIND.TWO) return 2;
  return 1;
}

/**
 * 打一下砖塔里的某块砖（含爆米花连带），返回新状态与掉落的道具位置。
 * 整排清空就加分并把空排收走。
 */
export function towerBreak(
  state: TowerState,
  r: number,
  c: number,
  pierce = false
): { state: TowerState; broke: Array<[number, number]>; gifts: Array<[number, number]>; clearedRows: number } {
  if (state.over || r < 0 || r >= state.rows.length || c < 0 || c >= TOWER_COLS) {
    return { state, broke: [], gifts: [], clearedRows: 0 };
  }
  const rows = state.rows.map((row) => row.slice());
  const broke: Array<[number, number]> = [];
  const gifts: Array<[number, number]> = [];
  let score = state.score;
  let bricksBroken = state.bricksBroken;

  const queue: Array<[number, number, boolean]> = [[r, c, pierce]];
  const seen = new Set<number>();
  while (queue.length) {
    const [rr, cc, pi] = queue.shift() as [number, number, boolean];
    const key = rr * 1000 + cc;
    if (seen.has(key)) continue;
    seen.add(key);
    const cur = rows[rr]?.[cc];
    if (cur === undefined || cur === KIND.EMPTY) continue;
    const res = damageBrick(cur, pi);
    if (res.next === cur) continue;
    score += towerBrickScore(cur);
    rows[rr][cc] = res.next;
    if (res.broken) {
      bricksBroken++;
      broke.push([rr, cc]);
      if (res.gift) gifts.push([rr, cc]);
      if (res.chain) {
        // 连带的一圈按穿透算，和战役里的爆米花砖同一套规矩。
        // 砖塔从第 8 排起会掺钢砖，不让爆米花清得动它，钢砖就会一路堆到底线，
        // 无尽模式撑不了几分钟就被一堵拆不开的墙压死。
        for (const [nr, nc] of popcornTargets(rr, cc, rows.length, TOWER_COLS)) queue.push([nr, nc, true]);
      }
    }
  }

  // 这一下刚好打通的整排 → 额外加分。空排原地留着不抽走，
  // 由下一帧开头的 squeezeTower 统一收走：帧内的碰撞扫描看到的行号才是稳的。
  let rowsCleared = state.rowsCleared;
  let clearedRows = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rowSettled(state.rows[i]) || !rowSettled(rows[i])) continue;
    // 同伴全被打光了，剩下的钢砖自己塌下来。
    // 不给它这条出路的话，凡是带钢砖的排都永远打不通，
    // 砖塔玩上一两分钟就被一堵拆不开的墙压到底线。
    for (let c = 0; c < TOWER_COLS; c++) if (rows[i][c] === KIND.STEEL) rows[i][c] = KIND.EMPTY;
    clearedRows++;
    score += towerRowScore(rowsCleared);
    rowsCleared++;
  }

  // 只把「最底下已经空掉」的排收走：它们的位置在最后，收走谁都不会挪
  let end = rows.length;
  while (end > 0 && rows[end - 1].every((v) => v === KIND.EMPTY)) end--;

  const next: TowerState = { ...state, rows: rows.slice(0, end), score, bricksBroken, rowsCleared };
  next.over = towerBottomY(next) >= TOWER_FLOOR;
  return { state: next, broke, gifts, clearedRows };
}

// ---------------------------------------------------------------------------
// 七、手感小料：顿感 / 连击音高 / 拖尾 / 粒子
// ---------------------------------------------------------------------------

/** 击砖顿感帧数（3–5 帧），越硬的砖顿得越明显 */
export function hitStopFrames(kind: number): number {
  if (kind === KIND.THREE || kind === KIND.STEEL) return 5;
  if (kind === KIND.TWO || kind === KIND.POPCORN) return 4;
  return 3;
}

/** 连击的节奏：连得越久两声之间越紧凑，听起来像音高在往上走 */
export function comboGapMs(combo: number): number {
  return Math.max(60, 170 - Math.min(10, combo) * 11);
}

/** 拖尾长度（像素）：球越快尾越长，帮孩子预判落点 */
export function trailLength(speed: number): number {
  return Math.max(10, Math.min(46, speed * 0.13));
}

/** 碎片粒子数；开了「减少动态效果」就减半 */
export function particleCount(base: number, reducedMotion: boolean): number {
  return reducedMotion ? Math.max(1, Math.round(base / 2)) : base;
}

// ---------------------------------------------------------------------------
// 八、188 关模拟器：不开画面也能验证「这一关打得完」
// ---------------------------------------------------------------------------

export interface SimOptions {
  seed?: number;
  dt?: number;
  maxSeconds?: number;
  /** 模拟球拍的最大移动速度（像素/秒） */
  paddleSpeed?: number;
}

export interface SimResult {
  won: boolean;
  seconds: number;
  /** 还剩几块该打的砖 */
  left: number;
  brickHits: number;
  misses: number;
  /** 整局里出现过的最平的角度（应当 ≥ 20°） */
  minAngleDeg: number;
  nudges: number;
}

/**
 * 让一个「会追球但不瞬移」的假玩家把一关打完。
 * 用的就是上面那套连续碰撞与反弹，所以模拟通过 = 真机同样打得通：
 * 关卡可解性、隧穿、死球自纠一次全查掉。
 */
export function simulateLevel(cfg: BrickLevel, opts: SimOptions = {}): SimResult {
  const dt = opts.dt ?? 1 / 60;
  const maxSeconds = opts.maxSeconds ?? 420;
  const paddleSpeed = opts.paddleSpeed ?? 460;
  const rand = mulberry32(opts.seed ?? 20250518);

  const grid = cfg.layout.map((row) => row.slice());
  const rows = grid.length;
  const brickW = W / COLS;
  const isPattern = cfg.goal === "pattern";
  const target = () => {
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        if (isPattern ? v === KIND.PATTERN : isBreakableKind(v)) n++;
      }
    }
    return n;
  };

  let paddleX = W / 2;
  let ball: BallLike = { x: paddleX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0 };
  let launched = false;
  let seconds = 0;
  let sinceHit = 0;
  let applied = 0;
  let brickHits = 0;
  let misses = 0;
  let nudges = 0;
  let minAngleDeg = 90;
  let moveT = 0;
  // 假玩家每接一次球就换一个「想用板子的哪个位置接」，于是出射角会不断变化，
  // 球才会往整片砖阵的各个角落跑（真人本来也不会每次都拿板心怼）
  let aim = (rand() - 0.5) * 1.7;

  const offsetAt = (t: number): number => {
    if (!cfg.moveSpeed || !cfg.moveRange) return 0;
    return Math.sin(t * (cfg.moveSpeed / Math.max(1, cfg.moveRange))) * cfg.moveRange;
  };

  while (seconds < maxSeconds) {
    seconds += dt;
    moveT += dt;
    const geom: BrickGeom = { rows, cols: COLS, brickW, brickH: BRICK_H, top: BRICK_TOP, offsetX: offsetAt(moveT) };

    if (!launched) {
      const v = launchVelocity(cfg.ballSpeed, rand(), 0);
      ball = { x: paddleX, y: PADDLE_Y - BALL_R - 1, vx: v.vx, vy: v.vy };
      launched = true;
      sinceHit = 0;
      applied = 0;
    }

    // 假玩家：追着球跑，但速度有限，所以接触点自然会有偏移
    const want = Math.max(cfg.paddleW / 2, Math.min(W - cfg.paddleW / 2, ball.x - aim * (cfg.paddleW / 2)));
    const delta = want - paddleX;
    paddleX += Math.max(-paddleSpeed * dt, Math.min(paddleSpeed * dt, delta));

    stepBall(ball, dt, {
      geom,
      radius: BALL_R,
      left: 0,
      right: W,
      top: 0,
      solid: (r, c) => grid[r]?.[c] !== undefined && grid[r][c] !== KIND.EMPTY,
      hit: (r, c) => {
        const cur = grid[r][c];
        if (cur === KIND.PORTAL) return "pass";
        const res = damageBrick(cur, false);
        grid[r][c] = res.next;
        if (res.broken && res.chain) {
          for (const [nr, nc] of popcornTargets(r, c, rows, COLS)) {
            const t = grid[nr][nc];
            if (t !== KIND.EMPTY && t !== KIND.PORTAL) grid[nr][nc] = damageBrick(t, true).next;
          }
        }
        brickHits++;
        sinceHit = 0;
        applied = 0;
        return "bounce";
      }
    });

    minAngleDeg = Math.min(minAngleDeg, flatnessDeg(ball.vx, ball.vy));

    // 板子
    if (ball.vy > 0 && ball.y >= PADDLE_Y - BALL_R && ball.y <= PADDLE_Y + PADDLE_H && Math.abs(ball.x - paddleX) <= cfg.paddleW / 2 + BALL_R) {
      const v = paddleBounce(ball.x, paddleX, cfg.paddleW, cfg.ballSpeed);
      ball.vx = v.vx;
      ball.vy = v.vy;
      ball.y = PADDLE_Y - BALL_R - 0.5;
      aim = (rand() - 0.5) * 1.7;
    }

    if (ball.y > H + BALL_R) {
      misses++;
      launched = false;
      continue;
    }

    // 死球自纠
    sinceHit += dt;
    const due = stallNudges(sinceHit);
    if (due > applied) {
      const v = nudgeToVertical(ball.vx, ball.vy, STALL_NUDGE_DEG * (due - applied));
      ball.vx = v.vx;
      ball.vy = v.vy;
      nudges += due - applied;
      applied = due;
    }

    if (target() === 0) {
      return { won: true, seconds, left: 0, brickHits, misses, minAngleDeg, nudges };
    }
  }

  return { won: false, seconds, left: target(), brickHits, misses, minAngleDeg, nudges };
}

// ---------------------------------------------------------------------------
// 九、资源看管：destroy 之后必须一件不剩
// ---------------------------------------------------------------------------

export interface TimerHost {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  requestAnimationFrame?(fn: (t: number) => void): number;
  cancelAnimationFrame?(id: number): void;
}

export interface ListenerTarget {
  addEventListener(type: string, fn: (ev: Event) => void): void;
  removeEventListener(type: string, fn: (ev: Event) => void): void;
}

function defaultHost(): TimerHost {
  const g = globalThis as unknown as TimerHost;
  return {
    setTimeout: (fn, ms) => g.setTimeout(fn, ms),
    clearTimeout: (id) => g.clearTimeout(id),
    requestAnimationFrame: g.requestAnimationFrame
      ? (fn) => (g.requestAnimationFrame as (f: (t: number) => void) => number)(fn)
      : undefined,
    cancelAnimationFrame: g.cancelAnimationFrame
      ? (id) => (g.cancelAnimationFrame as (i: number) => void)(id)
      : undefined
  };
}

/** 定时器 / rAF / 监听的总管：`pending()` 在 destroy 之后必须是 0 */
export class Janitor {
  private timers = new Set<number>();
  private frames = new Set<number>();
  private offs: Array<() => void> = [];
  private readonly host: TimerHost;
  dead = false;

  constructor(host?: TimerHost) {
    this.host = host ?? defaultHost();
  }

  pending(): number {
    return this.timers.size + this.frames.size + this.offs.length;
  }

  after(ms: number, fn: () => void): number {
    const id = this.host.setTimeout(() => {
      this.timers.delete(id);
      if (!this.dead) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  frame(fn: (t: number) => void): number {
    if (!this.host.requestAnimationFrame) return 0;
    const id = this.host.requestAnimationFrame((t) => {
      this.frames.delete(id);
      if (!this.dead) fn(t);
    });
    this.frames.add(id);
    return id;
  }

  on<T extends ListenerTarget>(target: T, type: string, fn: (ev: Event) => void): void {
    target.addEventListener(type, fn);
    this.own(() => target.removeEventListener(type, fn));
  }

  own(off: () => void): void {
    this.offs.push(off);
  }

  destroy(): void {
    this.dead = true;
    for (const id of this.timers) this.host.clearTimeout(id);
    this.timers.clear();
    if (this.host.cancelAnimationFrame) {
      for (const id of this.frames) this.host.cancelAnimationFrame(id);
    }
    this.frames.clear();
    while (this.offs.length) {
      try {
        this.offs.pop()?.();
      } catch (err) {
        console.warn("[一朵一星] 碰碰砖块清理时出错:", err);
      }
    }
  }
}
