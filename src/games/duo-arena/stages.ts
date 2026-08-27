/**
 * 梨康擂台 · 场地数据表。
 *
 * 1.1 的擂台是一块空白矩形,三个回合长得一模一样,打两局就腻。
 * 1.2 把擂台写成**纯数据表**:每张场地的地块数量、会不会左右滑、边界是什么形状都不同,
 * 一场比赛按回合轮换,谁也不会连着三回合看同一张图。
 *
 * 坐标一律用 0..1 的相对值(左上角是 0,0),画面多大都能换算,单测里也好断言。
 * 场地只影响**走位**,不影响双方各自那份出目标时间表 —— 两个半场用的是同一张场地、
 * 同一份时间表,所以左右两边没有任何系统性优势。
 */

/** 边界形状:方台 / 圆台 / 沙漏(中间收腰) */
export type Boundary = "rect" | "round" | "hourglass";

export interface StageBlock {
  /** 地块中心 x(0..1);会滑的地块这是它的中位 */
  x: number;
  /** 地块中心 y(0..1) */
  y: number;
  /** 宽(0..1) */
  w: number;
  /** 高(0..1) */
  h: number;
  /** 左右滑动的幅度(0 或不填 = 不动) */
  sway?: number;
  /** 滑一个来回要几秒(会滑的地块必须填) */
  period?: number;
}

export interface Stage {
  id: string;
  /** 给小朋友看的名字 */
  name: string;
  emoji: string;
  boundary: Boundary;
  /** 场地上的地块(挡路的软垫子,撞上去只是停住,不会怎么样) */
  blocks: readonly StageBlock[];
  /** 地面色(Canvas 用) */
  tint: string;
  /** 目标出现节奏倍率:> 1 更慢(场地越挤给的时间越宽裕) */
  paceScale: number;
  /** 一句话说明,规则页里显示 */
  blurb: string;
}

export const STAGES: readonly Stage[] = [
  {
    id: "cloud-square",
    name: "云台广场",
    emoji: "☁️",
    boundary: "rect",
    blocks: [
      { x: 0.32, y: 0.5, w: 0.1, h: 0.16 },
      { x: 0.68, y: 0.5, w: 0.1, h: 0.16 },
    ],
    tint: "#EAF3FF",
    paceScale: 1,
    blurb: "方方正正的入门擂台,只有两块软垫子挡路,先在这里熟悉走位。",
  },
  {
    id: "flower-isle",
    name: "花田小岛",
    emoji: "🌼",
    boundary: "round",
    blocks: [
      { x: 0.5, y: 0.3, w: 0.14, h: 0.1 },
      { x: 0.28, y: 0.66, w: 0.1, h: 0.12 },
      { x: 0.72, y: 0.66, w: 0.1, h: 0.12, sway: 0.12, period: 5 },
    ],
    tint: "#FFF0F6",
    paceScale: 1.05,
    blurb: "圆圆的花田,四个角是围栏,右下角那块垫子会自己左右滑。",
  },
  {
    id: "star-bridge",
    name: "星桥回廊",
    emoji: "🌉",
    boundary: "rect",
    blocks: [
      { x: 0.5, y: 0.22, w: 0.26, h: 0.08, sway: 0.16, period: 4.2 },
      { x: 0.2, y: 0.52, w: 0.08, h: 0.2 },
      { x: 0.8, y: 0.52, w: 0.08, h: 0.2 },
      { x: 0.5, y: 0.8, w: 0.26, h: 0.08, sway: 0.16, period: 3.4 },
    ],
    tint: "#EEEAFF",
    paceScale: 1.12,
    blurb: "上下两条星桥来回滑,中间的立柱最容易堵路,提前绕开才跑得顺。",
  },
  {
    id: "candy-glass",
    name: "糖果沙漏",
    emoji: "🍬",
    boundary: "hourglass",
    blocks: [
      { x: 0.5, y: 0.5, w: 0.12, h: 0.12, sway: 0.1, period: 6 },
      { x: 0.5, y: 0.14, w: 0.16, h: 0.07 },
    ],
    tint: "#FFF6E5",
    paceScale: 1.15,
    blurb: "腰身收得很紧的沙漏台,过中间那道口子要排队,抢先卡位很关键。",
  },
];

export const STAGE_COUNT = STAGES.length;

/** 按序号取场地(超出范围会绕回来,永远拿得到一张) */
export function stageAt(index: number): Stage {
  const i = Number.isFinite(index) ? Math.floor(index) : 0;
  return STAGES[((i % STAGE_COUNT) + STAGE_COUNT) % STAGE_COUNT];
}

export function stageById(id: string): Stage | null {
  return STAGES.find((s) => s.id === id) ?? null;
}

/** 一场比赛里第 round 个回合用哪张场地:从 startIndex 起一回合换一张 */
export function stageForRound(startIndex: number, round: number): Stage {
  return stageAt(startIndex + round);
}

/** 会滑的地块在 t 秒时的实际中心 x */
export function blockCenterX(block: StageBlock, t: number): number {
  if (!block.sway || !block.period) return block.x;
  return block.x + block.sway * Math.sin((2 * Math.PI * t) / block.period);
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** 地块在 t 秒时占住的矩形 */
export function blockRect(block: StageBlock, t: number): Rect {
  const cx = blockCenterX(block, t);
  return {
    x0: cx - block.w / 2,
    y0: block.y - block.h / 2,
    x1: cx + block.w / 2,
    y1: block.y + block.h / 2,
  };
}

/**
 * 这一行(y)上,擂台从中线往两边各能站多宽。
 * 方台一路到底;圆台是个椭圆;沙漏中间收腰,过中线要挤一挤。
 */
export function boundaryHalfWidth(stage: Stage, y: number): number {
  const cy = Math.min(1, Math.max(0, y));
  if (stage.boundary === "round") {
    const d = 2 * cy - 1;
    return 0.5 * Math.sqrt(Math.max(0, 1 - d * d));
  }
  if (stage.boundary === "hourglass") {
    // |2y-1| 在两端是 1、中间是 0 → 中间最窄
    return 0.5 - 0.2 * (1 - Math.abs(2 * cy - 1));
  }
  return 0.5;
}

/** 点在擂台里面吗(只看边界,不看地块) */
export function insideBoundary(stage: Stage, x: number, y: number, radius = 0): boolean {
  if (y < radius || y > 1 - radius) return false;
  const half = boundaryHalfWidth(stage, y);
  return Math.abs(x - 0.5) <= Math.max(0, half - radius) + 1e-9;
}

/** 点被地块挡住了吗 */
export function hitsBlock(stage: Stage, x: number, y: number, radius: number, t: number): boolean {
  for (const b of stage.blocks) {
    const r = blockRect(b, t);
    if (x > r.x0 - radius && x < r.x1 + radius && y > r.y0 - radius && y < r.y1 + radius) return true;
  }
  return false;
}

/** 这个位置能不能站人 / 能不能放目标 */
export function isFreeSpot(stage: Stage, x: number, y: number, radius: number, t: number): boolean {
  return insideBoundary(stage, x, y, radius) && !hitsBlock(stage, x, y, radius, t);
}

/**
 * 把一个位置收回擂台里:先收边界,再从地块里推出去(往最近的那条边推)。
 * 撞到地块只是停住,没有任何受伤语义。
 */
export function clampToArena(
  stage: Stage,
  x: number,
  y: number,
  radius: number,
  t: number,
): { x: number; y: number } {
  let cy = Math.min(1 - radius, Math.max(radius, y));
  const half = boundaryHalfWidth(stage, cy);
  const room = Math.max(0, half - radius);
  let cx = Math.min(0.5 + room, Math.max(0.5 - room, x));

  for (const b of stage.blocks) {
    const r = blockRect(b, t);
    const x0 = r.x0 - radius;
    const x1 = r.x1 + radius;
    const y0 = r.y0 - radius;
    const y1 = r.y1 + radius;
    if (cx <= x0 || cx >= x1 || cy <= y0 || cy >= y1) continue;
    const push = [
      { d: cx - x0, x: x0, y: cy },
      { d: x1 - cx, x: x1, y: cy },
      { d: cy - y0, x: cx, y: y0 },
      { d: y1 - cy, x: cx, y: y1 },
    ].sort((a, c) => a.d - c.d)[0];
    cx = push.x;
    cy = push.y;
  }

  // 推出地块之后可能又蹭出边界,再收一次
  cy = Math.min(1 - radius, Math.max(radius, cy));
  const half2 = boundaryHalfWidth(stage, cy);
  const room2 = Math.max(0, half2 - radius);
  cx = Math.min(0.5 + room2, Math.max(0.5 - room2, cx));
  return { x: cx, y: cy };
}

/**
 * 给目标找一个能落脚的位置:原位不行就沿着一圈方向试,实在不行就放中线上。
 * 双方半场用同一张场地、同一份时间表,所以这个函数对两个人给出的结果完全一样。
 */
export function placeTarget(
  stage: Stage,
  x: number,
  y: number,
  radius: number,
  t: number,
): { x: number; y: number } {
  if (isFreeSpot(stage, x, y, radius, t)) return { x, y };
  for (let ring = 1; ring <= 4; ring++) {
    const step = 0.07 * ring;
    for (let k = 0; k < 8; k++) {
      const a = (Math.PI * 2 * k) / 8;
      const nx = x + Math.cos(a) * step;
      const ny = y + Math.sin(a) * step;
      if (isFreeSpot(stage, nx, ny, radius, t)) return { x: nx, y: ny };
    }
  }
  return { x: 0.5, y: y < 0.5 ? radius + 0.02 : 1 - radius - 0.02 };
}

/** 两个人的出生点:各自半场的左右对称位,保证起手距离完全相同 */
export function spawnPoints(stage: Stage): { self: { x: number; y: number }; mirror: { x: number; y: number } } {
  const y = 0.5;
  const half = boundaryHalfWidth(stage, y);
  const dx = Math.max(0.12, half - 0.12);
  return {
    self: { x: 0.5 - dx, y },
    mirror: { x: 0.5 + dx, y },
  };
}
