// 碰碰砖块 · 1.3 视觉层（A 档视觉升级）。
//
// 这里放的全是「怎么画」：配色板、图层序、动效时序、碎砖碎片、
// 挡板回弹 / 磁铁电弧 / 传送门旋转 / 胶囊摆动 / 连击彩带的纯计算——
// 不碰 DOM、不碰任何玩法数值。index.ts 只负责把这里算出来的东西描到画布上。
//
// 红线：这一层绝不读写球速 / 反弹角 / 血量 / 判定值 / 存档，视觉测试只咬这里。
import { CHAPTERS, LEVELS } from "./levels";
import { KIND, brickInfo, trailLength } from "./logic";

// ---------------------------------------------------------------------------
// 一、配色板（四·补一规格表原样落成常量，动一个色值单测就红）
// ---------------------------------------------------------------------------

export const BK_PALETTE = {
  /** 背景上下渐变 */
  bkBgTop: "#FDEFF5",
  bkBgBottom: "#F3E4F0",
  /** 边墙内凹槽 */
  bkWall: "#E0D2E8",
  /** 挡板主色（磁铁态换 bkPaddleMagnet） */
  bkPaddle: "#7FB2F0",
  bkPaddleMagnet: "#8FD98B",
  /** 拖尾芯 / 外晕 */
  bkTrailCore: "#FFFFFF",
  bkTrailGlow: "rgba(255,214,120,.4)",
  /** 统一落影 */
  bkShadow: "rgba(93,74,110,.16)"
} as const;

/** draw 的图层序，从底到顶；index.ts 按这个顺序画，测试按这个顺序钉 */
export const BK_LAYER_ORDER = [
  "bg",
  "walls",
  "bricks",
  "portal",
  "capsules",
  "trail",
  "ball",
  "paddle",
  "debris",
  "hud"
] as const;

/** 边墙内凹槽宽度（纯装饰，物理边界仍是 0..W） */
export const BK_WALL_PX = 3;

// ---------------------------------------------------------------------------
// 二、动效时序表（四·补三，毫秒写死成常量并被测试引用）
// ---------------------------------------------------------------------------

/** 接球瞬间挡板下压回弹：2px、80ms、easeOutBack；reduced 关闭 */
export const PADDLE_PRESS_MS = 80;
export const PADDLE_PRESS_PX = 2;
/** 磁铁电弧：两条抖动细线每 90ms 换一次姿势（step）；reduced 常亮直线 */
export const MAGNET_ARC_STEP_MS = 90;
export const MAGNET_ARC_LINES = 2;
/** 砖碎碎片：四角碎片 300ms 旋转抛物线；reduced 不生成 */
export const SHARD_LIFE_MS = 300;
export const SHARDS_PER_BRICK = 4;
export const STARS_PER_BRICK = 3;
/** 同屏碎片总量上限（连锁爆米花也不许刷屏） */
export const MAX_DEBRIS = 84;
/** 连击彩带：连击 >= 5 边缘一闪 120ms；reduced 关闭 */
export const RIBBON_MS = 120;
export const RIBBON_MIN_COMBO = 5;
/** 传送门常驻旋转 3200ms/圈（linear）；reduced 静止双环 */
export const PORTAL_SPIN_MS = 3200;
/** 球进出时门圈涨 8%、160ms 回落；reduced 关闭 */
export const PORTAL_PULSE_MS = 160;
export const PORTAL_PULSE_K = 0.08;
/** 胶囊下落摆动 ±4°、600ms 周期（sin）；reduced 竖直下落 */
export const CAPSULE_SWING_DEG = 4;
export const CAPSULE_SWING_MS = 600;
/** 穿透态绕球星屑：2 颗 */
export const PIERCE_ORBIT_STARS = 2;

// ---------------------------------------------------------------------------
// 三、缓动（纯函数）
// ---------------------------------------------------------------------------

export function easeOutQuad(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return 1 - (1 - k) * (1 - k);
}

export function easeOutBack(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

// ---------------------------------------------------------------------------
// 四、挡板：下压回弹 / 磁铁电弧（只算数值，不碰 PADDLE_Y / PADDLE_H）
// ---------------------------------------------------------------------------

/**
 * 接球后 elapsed 毫秒时挡板往下画几像素（纯视觉偏移，判定线一动不动）。
 * 0ms 压满 2px，80ms 内 easeOutBack 弹回 0；reduced 或超时恒为 0。
 */
export function paddlePressOffset(elapsedMs: number, reduced: boolean): number {
  if (reduced || elapsedMs < 0 || elapsedMs >= PADDLE_PRESS_MS) return 0;
  return PADDLE_PRESS_PX * (1 - easeOutBack(elapsedMs / PADDLE_PRESS_MS));
}

/** 电弧的抖动相位：每 90ms 换一个整数档；reduced 恒为 0（常亮直线） */
export function magnetArcPhase(nowMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return Math.floor(Math.max(0, nowMs) / MAGNET_ARC_STEP_MS);
}

/**
 * 第 line 条电弧在相位 phase 时的抖动幅度（-1..1，乘上像素幅度用）。
 * phase 0（reduced 常亮档）恒为 0——静止时是两条直线不是抖线。
 */
export function magnetArcWobble(phase: number, line: number): number {
  if (phase === 0) return 0;
  const n = Math.imul(phase * 2654435761 + line * 40503, 1 | phase);
  return (((n >>> 8) % 1000) / 1000) * 2 - 1;
}

// ---------------------------------------------------------------------------
// 五、球与拖尾：双层规格（span 沿用 logic.trailLength，只读）
// ---------------------------------------------------------------------------

export interface TrailLayers {
  /** 拖尾理想长度（像素）——直接引用 logic.trailLength(speed)，一格不改 */
  span: number;
  /** 外晕宽度 */
  glowWidth: number;
  /** 芯线宽度（永远比外晕细） */
  coreWidth: number;
}

/** 双层拖尾的几何规格：速度只进不出，映射关系全在这一处 */
export function trailLayers(speed: number, ballR: number): TrailLayers {
  const span = trailLength(speed);
  const glowWidth = Math.max(4, Math.min(ballR * 1.9, span * 0.34));
  return { span, glowWidth, coreWidth: Math.max(1.6, glowWidth * 0.42) };
}

/** 穿透态绕球星屑的角度（弧度）；reduced 静止在固定角 */
export function pierceOrbitAngle(nowMs: number, idx: number, reduced: boolean): number {
  const base = (idx * Math.PI * 2) / PIERCE_ORBIT_STARS;
  if (reduced) return base;
  return base + ((nowMs % 1200) / 1200) * Math.PI * 2;
}

// ---------------------------------------------------------------------------
// 六、碎砖碎片：四角方块碎片 + 星屑（seed 可复现；reduced 不生成）
// ---------------------------------------------------------------------------

export interface Debris {
  kind: "shard" | "star";
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 旋转角与角速度（弧度 / 弧度每秒），星屑不转 */
  rot: number;
  vrot: number;
  size: number;
  color: string;
  /** 还能活多少毫秒（从 SHARD_LIFE_MS 倒数） */
  lifeMs: number;
}

function debrisRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 星屑用的粉彩点缀色（和 kit/sparkle 一家人） */
export const DEBRIS_STAR_COLORS = ["#FFD75E", "#FFFFFF", "#FFB6C9"] as const;

/**
 * 一块砖碎掉时的碎片：同砖色小方块 4 片（往四角抛）+ 星屑 3 颗。
 * reduced 一片都不生成；同 seed 两次生成完全相等。
 */
export function spawnBrickDebris(seed: number, cx: number, cy: number, color: string, reduced: boolean): Debris[] {
  if (reduced) return [];
  const rng = debrisRng(seed);
  const out: Debris[] = [];
  // 四角碎片：左上 / 右上 / 左下 / 右下 各一片
  for (let i = 0; i < SHARDS_PER_BRICK; i++) {
    const sx = i % 2 === 0 ? -1 : 1;
    const sy = i < 2 ? -1 : 1;
    out.push({
      kind: "shard",
      x: cx + sx * 6,
      y: cy + sy * 3,
      vx: sx * (60 + rng() * 90),
      vy: sy * 40 - 60 - rng() * 50,
      rot: rng() * Math.PI,
      vrot: (rng() - 0.5) * 14,
      size: 3 + rng() * 2,
      color,
      lifeMs: SHARD_LIFE_MS
    });
  }
  for (let i = 0; i < STARS_PER_BRICK; i++) {
    const a = rng() * Math.PI * 2;
    const sp = 50 + rng() * 80;
    out.push({
      kind: "star",
      x: cx,
      y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      rot: 0,
      vrot: 0,
      size: 1.4 + rng() * 1.4,
      color: DEBRIS_STAR_COLORS[i % DEBRIS_STAR_COLORS.length],
      lifeMs: SHARD_LIFE_MS
    });
  }
  return out;
}

/** 追加碎片但守住同屏总量上限（超出的直接不收） */
export function pushDebris(list: Debris[], spawned: Debris[]): Debris[] {
  const room = Math.max(0, MAX_DEBRIS - list.length);
  return room >= spawned.length ? list.concat(spawned) : list.concat(spawned.slice(0, room));
}

/** 推进一帧（旋转抛物线：重力 + 自转），寿命尽的丢掉 */
export function stepDebris(list: Debris[], dtMs: number): Debris[] {
  const dt = dtMs / 1000;
  const alive: Debris[] = [];
  for (const d of list) {
    d.lifeMs -= dtMs;
    if (d.lifeMs <= 0) continue;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += 420 * dt;
    d.rot += d.vrot * dt;
    alive.push(d);
  }
  return alive;
}

/** destroy 清场：碎片当场归零 */
export function clearDebris(list: Debris[]): void {
  list.length = 0;
}

/** 薄绘制层：方块碎片带旋转，星屑是小圆点，全员随寿命渐隐 */
export function paintDebris(ctx: CanvasRenderingContext2D, list: Debris[]): void {
  for (const d of list) {
    const k = Math.max(0, Math.min(1, d.lifeMs / SHARD_LIFE_MS));
    ctx.save();
    ctx.globalAlpha = easeOutQuad(k);
    ctx.fillStyle = d.color;
    if (d.kind === "shard") {
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
    } else {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 七、连击彩带：连击 >= 5 画面边缘一闪 120ms
// ---------------------------------------------------------------------------

/** 彩带此刻的透明度（0 = 不画）。combo 不够 / reduced / 过了 120ms 都是 0 */
export function ribbonAlpha(sinceMs: number, combo: number, reduced: boolean): number {
  if (reduced || combo < RIBBON_MIN_COMBO || sinceMs < 0 || sinceMs >= RIBBON_MS) return 0;
  return 1 - easeOutQuad(sinceMs / RIBBON_MS);
}

/** 彩带条色（边缘细彩带的三段色） */
export const RIBBON_COLORS = ["#FFD75E", "#FF9EC8", "#8FCBFF"] as const;

// ---------------------------------------------------------------------------
// 八、传送门：双环旋转渐变，进出口互为反色，进出涨缩 8%
// ---------------------------------------------------------------------------

/** RGB 反色（#rrggbb → #rrggbb），进口 / 出口的双环互换用 */
export function portalInverseColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = 255 - ((n >> 16) & 255);
  const g = 255 - ((n >> 8) & 255);
  const b = 255 - (n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** 进口门的亮环色；出口门用它的反色——两扇门一眼分清 */
export const PORTAL_ACCENT_IN = "#FFD75E";
export const PORTAL_ACCENT_OUT = portalInverseColor(PORTAL_ACCENT_IN);

/** 常驻旋转角（弧度）：3200ms 一圈 linear；reduced 恒为 0（静止双环） */
export function portalSpinAngle(nowMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return ((Math.max(0, nowMs) % PORTAL_SPIN_MS) / PORTAL_SPIN_MS) * Math.PI * 2;
}

/** 球进出后 elapsed 毫秒时门圈的缩放：涨到 1.08 再 160ms 回 1；reduced 恒 1 */
export function portalPulseScale(elapsedMs: number, reduced: boolean): number {
  if (reduced || elapsedMs < 0 || elapsedMs >= PORTAL_PULSE_MS) return 1;
  return 1 + PORTAL_PULSE_K * (1 - easeOutQuad(elapsedMs / PORTAL_PULSE_MS));
}

// ---------------------------------------------------------------------------
// 九、胶囊：药丸摆动
// ---------------------------------------------------------------------------

/** 下落摆动角（度）：±4°、600ms 正弦周期；reduced 恒 0（竖直下落） */
export function capsuleSwingDeg(nowMs: number, phase: number, reduced: boolean): number {
  if (reduced) return 0;
  return CAPSULE_SWING_DEG * Math.sin(((nowMs % CAPSULE_SWING_MS) / CAPSULE_SWING_MS) * Math.PI * 2 + phase);
}

/** 两半色药丸：上半亮白、下半淡蓝（好道具通用；「别接我」仍是空心圈形状通道） */
export const CAPSULE_TOP = "#FFFFFF";
export const CAPSULE_BOTTOM = "#C8E4FF";

// ---------------------------------------------------------------------------
// 十、裂纹层数：只读格子值换算，绝不写血量
// ---------------------------------------------------------------------------

/**
 * 多血砖掉了几档血（= 该叠几层裂纹）。
 * 只读 KIND 值：三层砖打剩两层是 1，打剩普通是 2；打不动的钢砖 / 星门恒 0。
 */
export function crackLevel(orig: number, cur: number): number {
  const o = brickInfo(orig);
  const n = brickInfo(cur);
  if (!o || !n || !Number.isFinite(o.hits) || !Number.isFinite(n.hits)) return 0;
  return Math.max(0, o.hits - n.hits);
}

// ---------------------------------------------------------------------------
// 十一、场景：章节主题色灯带
// ---------------------------------------------------------------------------

/** 无尽砖塔的灯带主题色（关卡外没有章节，给一个固定粉彩） */
export const BK_TOWER_ACCENT = "#C9A0F0";

/** 第 level 关（0 起）落在哪个章节，返回该章节的主题色；越界给砖塔色兜底 */
export function chapterAccent(level: number): string {
  if (level >= 0 && level < LEVELS.length) {
    let acc = 0;
    for (const ch of CHAPTERS) {
      acc += ch.size;
      if (level < acc) return ch.color;
    }
  }
  return BK_TOWER_ACCENT;
}

/** 顶部装饰灯带：一排小圆灯的圆心 x 坐标（间距均匀，纯装饰） */
export function lampXs(width: number, count = 9): number[] {
  const n = Math.max(2, count);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((width * (i + 0.5)) / n);
  return out;
}
