/**
 * 铁皮坦克大战 1.2 · 弹道(纯几何,不认识世界状态,只认识「这一格挡不挡」)。
 *
 * 三种弹丸,全是玩具:
 *  - `plain` 直线弹:一颗普通弹力球,直着飞,撞上就散成彩纸。
 *  - `bounce` 弹力球:出膛就带一点斜角,碰墙按反射公式弹回来,最多弹 2 次。
 *    炮口前有一条短短的预测虚线,**只画第一段反射**,让人看得懂它要往哪拐。
 *  - `pierce` 彩纸穿甲弹:唯一拆得动钢板的那一发,能连穿两层。
 *
 * 反射就是把撞墙那一根轴上的速度分量取反(墙面都是轴向的,法线自然也是轴向的),
 * 所以「入射角 = 反射角」是这几行代码的直接推论,`ballistics12.test.ts` 里按角度验过。
 */

import type { Dir } from "./terrain12";
import { DX, DY } from "./terrain12";

export type ShellKind = "plain" | "bounce" | "pierce";

export interface ShellSpec {
  kind: ShellKind;
  name: string;
  emoji: string;
  color: string;
  /** 相对基础速度的倍率 */
  speedMul: number;
  /** 相对基础冷却的倍率:好用的弹丸要多等一会儿 */
  coolMul: number;
  /** 最多弹几次墙 */
  maxBounces: number;
  /** 拆不拆得动钢板 */
  breaksSteel: boolean;
  /** 能连穿几层墙(穿完就散) */
  pierceBlocks: number;
  /** 出膛时的斜角(0 就是笔直) */
  tilt: number;
  desc: string;
}

/** 弹力球出膛的斜率:0.5 正好是一个好算又好看的角(约 26.6°) */
export const BOUNCE_TILT = 0.5;

export const SHELLS: Record<ShellKind, ShellSpec> = {
  plain: {
    kind: "plain",
    name: "直线弹",
    emoji: "🟡",
    color: "#ffe08a",
    speedMul: 1,
    coolMul: 1,
    maxBounces: 0,
    breaksSteel: false,
    pierceBlocks: 0,
    tilt: 0,
    desc: "直着飞,最听话。",
  },
  bounce: {
    kind: "bounce",
    name: "弹力球",
    emoji: "🔵",
    color: "#8ad2ff",
    speedMul: 0.86,
    coolMul: 1.5,
    maxBounces: 2,
    breaksSteel: false,
    pierceBlocks: 0,
    tilt: BOUNCE_TILT,
    desc: "斜着出膛,碰墙弹两次,能拐弯打到躲起来的人。",
  },
  pierce: {
    kind: "pierce",
    name: "彩纸穿甲弹",
    emoji: "🟣",
    color: "#d0a6ff",
    speedMul: 1.15,
    coolMul: 2.1,
    maxBounces: 0,
    breaksSteel: true,
    pierceBlocks: 2,
    tilt: 0,
    desc: "唯一拆得动钢板的一发,还能连穿两层。",
  },
};

export const SHELL_ORDER: readonly ShellKind[] = ["plain", "bounce", "pierce"];

/** 换下一种弹丸(HUD 上那个按钮就是它) */
export function nextShell(kind: ShellKind): ShellKind {
  const i = SHELL_ORDER.indexOf(kind);
  return SHELL_ORDER[(i + 1) % SHELL_ORDER.length];
}

export interface Vec2 {
  x: number;
  y: number;
}

export type Axis = "x" | "y" | "both";

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function unit(v: Vec2): Vec2 {
  const n = length(v);
  if (n === 0) return { x: 0, y: 0 };
  return { x: v.x / n, y: v.y / n };
}

/** 车头方向的左右垂线(tilt = +1 偏车头的右手边) */
export function sideways(dir: Dir): Vec2 {
  return { x: -DY[dir], y: DX[dir] };
}

/** 某种弹丸出膛时的速度方向(单位向量) */
export function shotVelocity(dir: Dir, kind: ShellKind, tilt: 1 | -1 = 1): Vec2 {
  const spec = SHELLS[kind];
  const ahead: Vec2 = { x: DX[dir], y: DY[dir] };
  if (spec.tilt === 0) return ahead;
  const side = sideways(dir);
  return unit({ x: ahead.x + side.x * spec.tilt * tilt, y: ahead.y + side.y * spec.tilt * tilt });
}

/** 反射公式:墙面是轴向的,撞哪根轴就把哪一路分量取反 */
export function reflect(v: Vec2, axis: Axis): Vec2 {
  if (axis === "x") return { x: -v.x, y: v.y };
  if (axis === "y") return { x: v.x, y: -v.y };
  return { x: -v.x, y: -v.y };
}

export function angleDeg(v: Vec2): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}

/** 与墙面法线的夹角(0..90):用来验「入射角 = 反射角」 */
export function angleToNormal(v: Vec2, axis: Axis): number {
  const n: Vec2 = axis === "x" ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const u = unit(v);
  const dot = Math.abs(u.x * n.x + u.y * n.y);
  return (Math.acos(Math.min(1, dot)) * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// 走一条弹道
// ---------------------------------------------------------------------------

/** 「这一点挡不挡弹丸」;格坐标和精确坐标都给,砖的四分之一格判定用得上 */
export type BlockedAt = (cx: number, cy: number, x: number, y: number) => boolean;

export interface TracePoint {
  x: number;
  y: number;
}

export interface TraceResult {
  /** 折线顶点:枪口 → 每个反射点 → 终点 */
  points: TracePoint[];
  bounces: number;
  end: TracePoint;
  /** 是撞墙没的,还是飞到最远距离了 */
  stop: "wall" | "range";
  /** 走了多少格 */
  dist: number;
}

export interface TraceOpts {
  maxBounces?: number;
  maxDist?: number;
  step?: number;
}

/** 从 (x,y) 沿 v 往前撞,撞到哪根轴上的墙就返回哪根轴 */
export function hitAxis(x: number, y: number, nx: number, ny: number, blocked: BlockedAt): Axis | null {
  const inX = blocked(Math.floor(nx), Math.floor(y), nx, y);
  const inY = blocked(Math.floor(x), Math.floor(ny), x, ny);
  if (inX && inY) return "both";
  if (inX) return "x";
  if (inY) return "y";
  return blocked(Math.floor(nx), Math.floor(ny), nx, ny) ? "both" : null;
}

/**
 * 把一发弹丸从头走到尾。maxBounces 用完之后再撞墙就散掉。
 * 只做几何,不管打中了谁——打中谁是 `logic.ts` 的事。
 */
export function traceShot(start: TracePoint, v: Vec2, blocked: BlockedAt, opts: TraceOpts = {}): TraceResult {
  const step = opts.step ?? 0.05;
  const maxDist = opts.maxDist ?? 18;
  const maxBounces = opts.maxBounces ?? 0;
  let x = start.x;
  let y = start.y;
  let dir = unit(v);
  const points: TracePoint[] = [{ x, y }];
  let bounces = 0;
  let dist = 0;
  // 撞进死角时可能一步都走不动,给个上限免得空转
  const guard = Math.ceil(maxDist / step) + 8 * (maxBounces + 1);

  for (let n = 0; n < guard && dist < maxDist; n++) {
    const nx = x + dir.x * step;
    const ny = y + dir.y * step;
    const axis = hitAxis(x, y, nx, ny, blocked);
    if (axis === null) {
      x = nx;
      y = ny;
      dist += step;
      continue;
    }
    if (bounces >= maxBounces) {
      points.push({ x, y });
      return { points, bounces, end: { x, y }, stop: "wall", dist };
    }
    points.push({ x, y });
    dir = reflect(dir, axis);
    bounces += 1;
  }
  points.push({ x, y });
  return { points, bounces, end: { x, y }, stop: dist >= maxDist ? "range" : "wall", dist };
}

/** 预测虚线最长看多远(格) */
export const PREVIEW_RANGE = 8;
/** 反射之后只画这么短一截:够看清往哪拐,又不至于把屏幕画成一团线 */
export const PREVIEW_TAIL = 2.2;

/**
 * 弹力球的预测虚线:**只画第一段反射**。
 * 返回 2 或 3 个点(枪口 → 墙 → 拐过去一小段),运行时照着连虚线就行。
 */
export function previewPath(start: TracePoint, v: Vec2, blocked: BlockedAt, range: number = PREVIEW_RANGE): TracePoint[] {
  const first = traceShot(start, v, blocked, { maxBounces: 0, maxDist: range });
  const wall = first.end;
  if (first.stop !== "wall") return [first.points[0], wall];

  // 撞墙那一下是哪根轴:再往前踩半步问一次,拿到的就是反射轴
  const dir = unit(v);
  const axis = hitAxis(wall.x, wall.y, wall.x + dir.x * 0.06, wall.y + dir.y * 0.06, blocked) ?? "both";
  const back = reflect(dir, axis);
  const tail = traceShot(wall, back, blocked, { maxBounces: 0, maxDist: PREVIEW_TAIL });
  return [first.points[0], wall, tail.end];
}
