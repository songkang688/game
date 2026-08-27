/**
 * 噗噗兄弟 · 推力层(纯函数)。
 *
 * 1.1 的「噗」只会戳破身边的泡泡。1.2 把它扩成一股真的**空气**,
 * 从嘴边喷出一个气流环,按打到谁分成三种用途:
 *
 *  | 用途 | 打到谁 | 效果 | 冷却 |
 *  | --- | --- | --- | --- |
 *  | `self` 自我加速 | 没打到东西,而且人在空中 | 朝面朝的反方向喷气,把自己推出去(空中只能用一次) | 长 |
 *  | `rival` 推开对手 | 气流环里有别人 | 把对手推开并轻轻抬起来,他会被吹得扁一下,但不掉血 | 中 |
 *  | `object` 推动物件 | 气流环里有箱子之类的物件 | 把物件推走 | 短 |
 *
 * 三种都有各自的冷却,而且共用一段**前摇**:按下去先鼓一口气(看得见气流环
 * 在攒),PUFF_WINDUP 之后才真的喷出去。前摇让对手来得及躲,也让小朋友看得懂
 * 「我刚才按了」。
 *
 * 题材上这一口是气泡和空气,不是别的什么 —— 气流环、鼓腮帮、噗的一声,如此而已。
 */

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

export type PushUse = "self" | "rival" | "object";

export const PUSH_USES: PushUse[] = ["self", "rival", "object"];

/** 按下到真的喷出去之间的前摇(秒) */
export const PUFF_WINDUP = 0.09;
/** 三种用途各自的冷却(秒) */
export const PUFF_CD: Record<PushUse, number> = { self: 1.05, rival: 0.55, object: 0.3 };
/** 气流环从嘴边往前伸多远 */
export const PUFF_REACH = 46;
/** 气流环的半高(上下能扫到多宽的一条) */
export const PUFF_HALF_H = 20;
/** 自我加速:朝反方向把自己推出去的横向 / 竖向速度 */
export const PUFF_SELF_VX = 250;
export const PUFF_SELF_VY = -190;
/** 空中自我加速一次就用完,落地才回满 */
export const PUFF_SELF_AIR_USES = 1;
/** 推开对手:最近处的横向 / 竖向初速 */
export const PUFF_RIVAL_VX = 330;
export const PUFF_RIVAL_VY = -170;
/** 被推之后这么久里身体是扁的(渲染层用),不掉血也不算受伤 */
export const PUFF_SQUISH_TIME = 0.32;
/** 推动物件:最近处给物件的横向初速 */
export const PUFF_OBJECT_VX = 235;
/** 离得越远推得越轻,衰减到这个下限就不再往下掉 */
export const PUFF_FALLOFF_MIN = 0.35;

// ---------------------------------------------------------------------------
// 气流环几何
// ---------------------------------------------------------------------------

export interface Ring {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** 环心(嘴边往前半格),渲染层照着这儿画 */
  cx: number;
  cy: number;
}

/**
 * 从「脚底中点 + 身高 + 朝向」算出这一口气流环扫到的那块矩形。
 * 环心画在身前,矩形从身体边缘一直伸到 PUFF_REACH。
 */
export function puffRing(x: number, y: number, height: number, halfW: number, facing: 1 | -1): Ring {
  const mouthY = y - height * 0.55;
  const near = x + facing * halfW;
  const far = near + facing * PUFF_REACH;
  return {
    x0: Math.min(near, far),
    x1: Math.max(near, far),
    y0: mouthY - PUFF_HALF_H,
    y1: mouthY + PUFF_HALF_H,
    cx: (near + far) / 2,
    cy: mouthY,
  };
}

/** 点在不在气流环里 */
export function ringHas(r: Ring, x: number, y: number): boolean {
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/** 两个矩形有没有交叠(气流环 × 物件的包围盒) */
export function ringOverlaps(r: Ring, x0: number, x1: number, y0: number, y1: number): boolean {
  return r.x0 < x1 && r.x1 > x0 && r.y0 < y1 && r.y1 > y0;
}

/**
 * 离环心越远推得越轻,但不会轻到没有 —— 蹭到边上也得看得出被吹了一下。
 * 返回 0..1 的系数。
 */
export function puffFalloff(dist: number): number {
  const t = 1 - Math.min(1, Math.max(0, dist) / PUFF_REACH);
  return PUFF_FALLOFF_MIN + (1 - PUFF_FALLOFF_MIN) * t;
}

// ---------------------------------------------------------------------------
// 状态机
// ---------------------------------------------------------------------------

export interface PuffState {
  /** 前摇剩余时间;>0 表示正在鼓气 */
  windup: number;
  /** 这一口鼓完之后要放哪一种 */
  pending: PushUse | null;
  /** 三种用途各自的剩余冷却 */
  cd: Record<PushUse, number>;
  /** 空中自我加速还剩几次(落地回满) */
  selfLeft: number;
  /** 上一帧噗键的状态(数按下沿用) */
  prevSub: boolean;
  /** 刚被别人推了,这么久里身体是扁的 */
  squish: number;
  /** 被推的方向(渲染层照它压扁) */
  squishDir: 1 | -1;
}

export function newPuffState(): PuffState {
  return {
    windup: 0,
    pending: null,
    cd: { self: 0, rival: 0, object: 0 },
    selfLeft: PUFF_SELF_AIR_USES,
    prevSub: false,
    squish: 0,
    squishDir: 1,
  };
}

/** 每个子步先走这一步:扣冷却与前摇,落地回满自我加速 */
export function tickPuff(s: PuffState, dt: number, onGround: boolean): void {
  for (const use of PUSH_USES) s.cd[use] = Math.max(0, s.cd[use] - dt);
  if (s.windup > 0) s.windup = Math.max(0, s.windup - dt);
  if (s.squish > 0) s.squish = Math.max(0, s.squish - dt);
  if (onGround) s.selfLeft = PUFF_SELF_AIR_USES;
}

/** 这一种用途现在放得出来吗 */
export function puffReady(s: PuffState, use: PushUse, onGround: boolean): boolean {
  if (s.cd[use] > 0) return false;
  if (use === "self") return !onGround && s.selfLeft > 0;
  return true;
}

export interface PuffTargets {
  /** 气流环里有对手 */
  rival: boolean;
  /** 气流环里有可推的物件 */
  object: boolean;
  /** 人这会儿站在地上没有 */
  onGround: boolean;
}

/**
 * 这一下按键该走哪一种用途:先推物件(最便宜、最常用),再推对手,
 * 都没打着而且人在空中,才把这口气喷给自己。三种都不满足就返回 null。
 */
export function choosePuffUse(s: PuffState, t: PuffTargets): PushUse | null {
  if (t.object && puffReady(s, "object", t.onGround)) return "object";
  if (t.rival && puffReady(s, "rival", t.onGround)) return "rival";
  if (!t.object && !t.rival && puffReady(s, "self", t.onGround)) return "self";
  return null;
}

/** 开始鼓气:进前摇,冷却要等真的喷出去才起算 */
export function beginPuff(s: PuffState, use: PushUse): void {
  s.windup = PUFF_WINDUP;
  s.pending = use;
}

/**
 * 前摇走完了就把这一口喷出去:返回用途并把冷却挂上;还在鼓气就返回 null。
 * 自我加速额外扣一次空中次数。
 */
export function releasePuff(s: PuffState): PushUse | null {
  if (!s.pending || s.windup > 0) return null;
  const use = s.pending;
  s.pending = null;
  s.cd[use] = PUFF_CD[use];
  if (use === "self") s.selfLeft = Math.max(0, s.selfLeft - 1);
  return use;
}

/** 自我加速:朝面朝的**反**方向喷气,人被推着往前冲 */
export function selfBoost(facing: 1 | -1): { vx: number; vy: number } {
  return { vx: facing * PUFF_SELF_VX, vy: PUFF_SELF_VY };
}

/** 推开对手:离环心越近推得越狠 */
export function rivalImpulse(dist: number, dir: 1 | -1): { vx: number; vy: number } {
  const k = puffFalloff(dist);
  return { vx: dir * PUFF_RIVAL_VX * k, vy: PUFF_RIVAL_VY * k };
}

/** 推动物件:只给横向,箱子该掉还是要掉 */
export function objectImpulse(dist: number, dir: 1 | -1): number {
  return dir * PUFF_OBJECT_VX * puffFalloff(dist);
}

/** 记一次「被吹扁」:不掉血,只是身体扁一下再弹回来 */
export function noteSquish(s: PuffState, dir: 1 | -1): void {
  s.squish = PUFF_SQUISH_TIME;
  s.squishDir = dir;
}

/** 被推形变的当前幅度(0..1),渲染层横着乘 1+v、竖着乘 1-v */
export function squishScale(s: PuffState): number {
  if (s.squish <= 0) return 0;
  return 0.16 * Math.sin((s.squish / PUFF_SQUISH_TIME) * Math.PI);
}

/** 前摇进度 0..1,渲染层拿它把气流环从小画到大 */
export function windupProgress(s: PuffState): number {
  if (!s.pending) return 0;
  return 1 - Math.min(1, Math.max(0, s.windup / PUFF_WINDUP));
}
