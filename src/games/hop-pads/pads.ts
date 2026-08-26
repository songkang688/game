/**
 * 跳跳台 · 五种台面与台序生成器。
 *
 * 台面一共五种:稳台、左右移动台、逐渐缩小台、弹簧台(落上后自动多跳一次)、
 * 一次台(跳走就没了)。`padTick(pad, t)` 拿到的永远是**台面定义**,返回的是
 * 那一刻的快照;判定用哪一刻的快照由调用方决定 —— 落台判定一律用落地时刻。
 *
 * 生成器的可达性是**构造**出来的:先在 [REACH_MIN, REACH_MAX] 里抽一个「所需力度」,
 * 再用 `jumpDistance` 反推台心该摆在哪儿,而不是先摆台子再祈祷跳得到。
 * 移动台的振幅按射程余量收窄,台子滑到两个极端时所需力度照样在区间内。
 */
import { mulberry32 } from "../level99";
import {
  PERFECT_R,
  REACH_MAX,
  REACH_MIN,
  clamp,
  jumpDistance,
  powerForDistance,
  type Point,
} from "./physics";

/** 台面类型 */
export type PadKind = "steady" | "slider" | "shrink" | "spring" | "once";

/** 落台判定结果 */
export type Verdict = "perfect" | "edge" | "miss";

/** 台面中文名(界面与攻略共用) */
export const KIND_NAMES: Record<PadKind, string> = {
  steady: "稳台",
  slider: "移动台",
  shrink: "缩小台",
  spring: "弹簧台",
  once: "一次台",
};

/** 台面小图标 */
export const KIND_ICONS: Record<PadKind, string> = {
  steady: "⭕",
  slider: "↔️",
  shrink: "🌀",
  spring: "🌸",
  once: "💠",
};

export interface Pad {
  kind: PadKind;
  /** 台心「老家」的横坐标(移动台围着它左右滑) */
  x: number;
  /** 台心的纵深坐标 */
  z: number;
  /** 出生时的台面半径 */
  r: number;
  /** 移动台:横向振幅(0 表示不动) */
  amp: number;
  /** 移动台:来回一趟的秒数 */
  period: number;
  /** 移动台:初相位 */
  phase: number;
  /** 缩小台:每秒缩掉多少半径 */
  shrink: number;
  /** 缩小台:缩到这么小就不再缩 */
  minR: number;
  /** 缩小台从哪一刻开始缩(玩家站上前一座台的时刻) */
  bornAt: number;
  /** 一次台被跳走之后就是 false,再落回来算落空 */
  alive: boolean;
}

/** 生成一座台面,没写的字段都给稳台的默认值 */
export function makePad(patch: Partial<Pad> & Pick<Pad, "x" | "z" | "r">): Pad {
  return {
    kind: "steady",
    amp: 0,
    period: 4,
    phase: 0,
    shrink: 0,
    minR: patch.r,
    bornAt: 0,
    alive: true,
    ...patch,
  };
}

/** 每一局的第一座台:角色就站在这儿,永远不动 */
export function originPad(): Pad {
  return makePad({ kind: "steady", x: 0, z: 0, r: 46 });
}

/**
 * 取 t 时刻的台面快照(纯函数)。
 * 传进来的必须是台面**定义**;把快照再喂一次会重复位移,别这么用。
 */
export function padTick(pad: Pad, t: number): Pad {
  if (pad.kind === "slider" && pad.amp > 0 && pad.period > 0) {
    const w = (Math.PI * 2 * t) / pad.period + pad.phase;
    return { ...pad, x: pad.x + pad.amp * Math.sin(w) };
  }
  if (pad.kind === "shrink" && pad.shrink > 0) {
    const age = Math.max(0, t - pad.bornAt);
    return { ...pad, r: Math.max(pad.minR, pad.r - pad.shrink * age) };
  }
  return pad;
}

/** 这座台的完美圈半径:台子被缩得太小时跟着收窄,免得完美圈比台子还大 */
export function perfectRadius(pad: Pad): number {
  return Math.min(PERFECT_R, pad.r * 0.6);
}

/** 落点判定:完美 / 边缘 / 落空。pad 要传落地那一刻的快照 */
export function onPad(p: Point, pad: Pad): Verdict {
  if (!pad.alive || pad.r <= 0) return "miss";
  const d = Math.hypot(p.x - pad.x, p.z - pad.z);
  if (d < perfectRadius(pad)) return "perfect";
  if (d <= pad.r) return "edge";
  return "miss";
}

/** 跳离一座台:一次台从此消失,别的台原样留着 */
export function leavePad(pad: Pad): Pad {
  return pad.kind === "once" ? { ...pad, alive: false } : pad;
}

/** 一章(或一局)的难度配方,生成器完全照它抽 */
export interface Difficulty {
  /** 这一档会出现的台面类型 */
  kinds: readonly PadKind[];
  /** 所需力度的抽样区间,再怎么写都会被夹进 [REACH_MIN, REACH_MAX] */
  minPower: number;
  maxPower: number;
  /** 横向偏角上限(弧度),0 就是一条直线 */
  maxYaw: number;
  /** 台面半径范围 */
  minR: number;
  maxR: number;
  /** 移动台的振幅上限(还会按射程余量再收一次) */
  slideAmp: number;
  /** 移动台来回一趟的秒数范围 */
  minPeriod: number;
  maxPeriod: number;
  /** 缩小台每秒缩掉多少半径 */
  shrink: number;
  /** 缩小台最多缩到初始半径的百分之多少 */
  minRRatio: number;
}

/** 生成器留给自己的安全边距:抽到的力度不会贴着 0.2 / 0.9 的边 */
export const REACH_MARGIN = 0.02;

/** 一份最保守的难度:第 1 章的直线稳台 */
export const EASY: Difficulty = {
  kinds: ["steady"],
  minPower: 0.3,
  maxPower: 0.55,
  maxYaw: 0,
  minR: 40,
  maxR: 46,
  slideAmp: 0,
  minPeriod: 4,
  maxPeriod: 5,
  shrink: 0,
  minRRatio: 1,
};

/** 把难度配方整理干净:力度区间夹进可达区间、半径不为负、周期不为 0 */
export function normalizeDifficulty(d: Difficulty): Difficulty {
  const lo = clamp(Math.min(d.minPower, d.maxPower), REACH_MIN + REACH_MARGIN, REACH_MAX - REACH_MARGIN);
  const hi = clamp(Math.max(d.minPower, d.maxPower), lo, REACH_MAX - REACH_MARGIN);
  const minR = Math.max(8, Math.min(d.minR, d.maxR));
  const maxR = Math.max(minR, d.maxR);
  return {
    kinds: d.kinds.length > 0 ? d.kinds : EASY.kinds,
    minPower: lo,
    maxPower: hi,
    maxYaw: clamp(Math.abs(d.maxYaw), 0, 0.55),
    minR,
    maxR,
    slideAmp: Math.max(0, d.slideAmp),
    minPeriod: Math.max(1.5, Math.min(d.minPeriod, d.maxPeriod)),
    maxPeriod: Math.max(Math.max(1.5, Math.min(d.minPeriod, d.maxPeriod)), d.maxPeriod),
    shrink: Math.max(0, d.shrink),
    minRRatio: clamp(d.minRRatio, 0.3, 1),
  };
}

/** 每座台一把独立的随机数,同 seed 同序号一定长得一模一样 */
function padRand(seed: number, i: number): () => number {
  return mulberry32(((seed >>> 0) + Math.imul(i + 1, 0x9e3779b1)) >>> 0);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 移动台能摆多大振幅:台子滑到最左 / 最右时,所需力度不能顶出 [REACH_MIN, REACH_MAX]。
 * 三角不等式保证「距离变化 ≤ 振幅」,所以按射程余量收一次就够保守。
 */
export function safeAmp(dist: number, want: number): number {
  const room = Math.min(
    dist - jumpDistance(REACH_MIN + REACH_MARGIN),
    jumpDistance(REACH_MAX - REACH_MARGIN) - dist
  );
  return Math.max(0, Math.min(want, room));
}

/**
 * 生成第 i 座台(i 从 0 起算,prev 是玩家现在站的那一座)。
 * 同一个 seed + i + 难度永远给出同一座台,便于对战用同一条台序比分。
 */
export function nextPad(
  seed: number,
  i: number,
  difficulty: Difficulty,
  prev: Pad = originPad()
): Pad {
  const d = normalizeDifficulty(difficulty);
  const rand = padRand(seed, i);

  // 1. 先抽「这一跳要用多大力」,可达性从这里就定死了
  const power = clamp(lerp(d.minPower, d.maxPower, rand()), REACH_MIN + REACH_MARGIN, REACH_MAX - REACH_MARGIN);
  const dist = jumpDistance(power);

  // 2. 再抽方向与台面大小
  const yaw = (rand() * 2 - 1) * d.maxYaw;
  const kind = d.kinds[Math.floor(rand() * d.kinds.length) % d.kinds.length];
  const r = Math.round(lerp(d.minR, d.maxR, rand()));

  const pad = makePad({
    kind,
    x: prev.x + Math.sin(yaw) * dist,
    z: prev.z + Math.cos(yaw) * dist,
    r,
  });

  if (kind === "slider") {
    pad.amp = safeAmp(dist, d.slideAmp);
    pad.period = lerp(d.minPeriod, d.maxPeriod, rand());
    pad.phase = rand() * Math.PI * 2;
  }
  if (kind === "shrink") {
    pad.shrink = d.shrink;
    // 再怎么缩也要留得下脚:半径 16 对应 ±96 毫秒的蓄力余量
    pad.minR = Math.max(16, Math.round(r * d.minRRatio));
  }
  return pad;
}

/** 一口气生成 n 座台(第 0 项是起始台),对战与测试都用它 */
export function buildPads(seed: number, difficulty: Difficulty, n: number): Pad[] {
  const pads: Pad[] = [originPad()];
  for (let i = 0; i < n; i++) {
    pads.push(nextPad(seed, i, difficulty, pads[pads.length - 1]));
  }
  return pads;
}

/**
 * 这座台**站着不动时**所需的力度 —— 生成器的可达性断言就查它。
 * 移动台还要按相位各查一遍,那是 `requiredPowerRange` 的活。
 */
export function requiredPowerFor(prev: Pad, pad: Pad): number {
  return powerForDistance(Math.hypot(pad.x - prev.x, pad.z - prev.z));
}

/** 移动台滑过一整圈时,所需力度的最小值与最大值(采样 samples 个相位) */
export function requiredPowerRange(
  prev: Pad,
  pad: Pad,
  samples = 24
): { min: number; max: number } {
  if (pad.kind !== "slider" || pad.amp <= 0) {
    const p = requiredPowerFor(prev, pad);
    return { min: p, max: p };
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let k = 0; k < samples; k++) {
    const snap = padTick(pad, (k / samples) * pad.period);
    const p = requiredPowerFor(prev, snap);
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return { min, max };
}
