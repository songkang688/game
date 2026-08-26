/**
 * 弹弓小鸟 · 1.2 深度层（纯函数，不碰 DOM，也不引入任何物理引擎依赖）。
 *
 * 1.1 已经有固定步长积分（`physics.ts`）、188 关关卡表（`levels.ts`）与竖屏自适应画布，
 * 1.2 在**不动这些既有资产**的前提下补五件事：
 *  1. **弹道预测**：前 60% 精确、后 40% 淡出的衰减小点，故意**不给完整落点圈**，留出学习空间；
 *  2. **材质与结构**：木 / 冰 / 石三种硬度写成表，并把「上面的塌下来砸到下面的」做成可传递的连锁；
 *  3. **鸟的能力**：空中点按触发，触发窗口是常量；
 *  4. **无尽打靶塔**：随机生成越来越高的塔，弹数固定，塔倒得越多分越高；
 *  5. **关卡可解性**：给 188 关一个「存在一条能通关的弹道」的模拟入口，后段关卡尤其要验。
 */
import type { BirdKind, BlockKind, LevelDef } from "./levels";
import { LEVELS } from "./levels";
import {
  GRAVITY,
  MAX_DRAG,
  MAX_LAUNCH,
  SLING_X,
  SLING_Y,
  WORLD_W,
  launchVelocity,
  makeRng,
  simulateTrajectory,
} from "./physics";

/* ---------------- 一、弹道预测 ---------------- */

/** 预测点总数：少了看不出弧线，多了等于直接给答案。 */
export const PREDICT_POINTS = 10;
/** 前多少比例的点是「精确」的，后面的淡出 */
export const PREDICT_SHARP_RATIO = 0.6;
/** 点与点之间隔多少秒采样 */
export const PREDICT_STEP = 0.07;

export interface PredictDot {
  x: number;
  y: number;
  /** 不透明度：前段 1，后段线性淡到 0.15 */
  alpha: number;
  /** 半径：越靠后越小 */
  radius: number;
}

/**
 * 拉弓时的预测点。**故意只画到一半就淡出**：
 * 前 60% 让孩子看清方向，后 40% 只给个大概，落点仍要自己判断。
 */
export function predictDots(
  dragX: number,
  dragY: number,
  winds: Array<{ x: number; y: number; w: number; h: number; fx: number; fy: number }> = [],
  gfactor = 1,
): PredictDot[] {
  const { vx, vy } = launchVelocity(dragX, dragY);
  if (vx === 0 && vy === 0) return [];
  const pts = simulateTrajectory(
    SLING_X,
    SLING_Y,
    vx,
    vy,
    gfactor,
    winds,
    PREDICT_POINTS,
    PREDICT_STEP,
  );
  const sharp = Math.max(1, Math.round(PREDICT_POINTS * PREDICT_SHARP_RATIO));
  return pts.map((p, i) => {
    if (i < sharp) return { x: p.x, y: p.y, alpha: 1, radius: 3.2 };
    const t = (i - sharp + 1) / Math.max(1, PREDICT_POINTS - sharp);
    return {
      x: p.x,
      y: p.y,
      alpha: Math.max(0.15, 1 - t * 0.85),
      radius: Math.max(1.4, 3.2 - t * 1.8),
    };
  });
}

/** 预测点绝不许延伸到整条弹道的尽头（那就等于给答案了）。 */
export function predictCoversRatio(dragX: number, dragY: number): number {
  const dots = predictDots(dragX, dragY);
  if (dots.length === 0) return 0;
  const { vx, vy } = launchVelocity(dragX, dragY);
  // 一条完整弹道大概飞多久：竖直方向落回发射高度的时间
  const full = vy < 0 ? (-2 * vy) / GRAVITY : 0.6;
  return (dots.length * PREDICT_STEP) / Math.max(0.2, full);
}

/* ---------------- 二、材质与结构 ---------------- */

export interface MaterialSpec {
  kind: BlockKind;
  label: string;
  /** 硬度：撞击伤害要除以它，越大越结实 */
  hardness: number;
  /** 每格质量，连锁倒塌时算压下来的重量 */
  mass: number;
  /** 碎裂粒子的基色（渲染用） */
  color: string;
  /** 碎裂音效名（平台内置合成音） */
  sound: "pop" | "tap" | "oops" | "coin";
  hint: string;
}

/**
 * 木 / 冰 / 石三种主材质各有硬度与碎法；
 * 玻璃、炸药桶、蛋壳、蛋芯是 1.1 已有的特殊件，一并登记进表里，
 * 这样「有没有材质没配到」可以被测试一次扫出来。
 */
export const MATERIALS: Record<BlockKind, MaterialSpec> = {
  wood: {
    kind: "wood",
    label: "木头",
    hardness: 1,
    mass: 1,
    color: "#c8934f",
    sound: "tap",
    hint: "最常见，一撞就裂成小木屑",
  },
  ice: {
    kind: "ice",
    label: "冰块",
    hardness: 0.6,
    mass: 0.8,
    color: "#bfe6ff",
    sound: "pop",
    hint: "最脆，轻轻一碰就哗啦一片",
  },
  stone: {
    kind: "stone",
    label: "石头",
    hardness: 2.2,
    mass: 2.4,
    color: "#9aa3ad",
    sound: "oops",
    hint: "最结实，得让上面的东西压下来才好办",
  },
  glass: {
    kind: "glass",
    label: "玻璃",
    hardness: 0.45,
    mass: 0.7,
    color: "#d8f2ff",
    sound: "pop",
    hint: "比冰还脆，专门用来开路",
  },
  tnt: {
    kind: "tnt",
    label: "彩纸桶",
    hardness: 0.9,
    mass: 1.2,
    color: "#ff9d8a",
    sound: "coin",
    hint: "碰到就噗地喷出一堆彩纸，把旁边的都掀翻",
  },
  shell: {
    kind: "shell",
    label: "蛋壳",
    hardness: 1.6,
    mass: 1.4,
    color: "#f3e2c7",
    sound: "tap",
    hint: "外面这层要先敲开",
  },
  core: {
    kind: "core",
    label: "蛋芯",
    hardness: 0.5,
    mass: 0.6,
    color: "#ffd9a0",
    sound: "pop",
    hint: "敲开蛋壳露出来的芯，一碰就好",
  },
};

/** 材质硬度换算成「挨这一下掉多少」的系数（越结实越小）。 */
export function materialVuln(kind: BlockKind): number {
  return 1 / MATERIALS[kind].hardness;
}

/** 木 / 冰 / 石三种主材质的硬度必须严格分层：冰 < 木 < 石。 */
export function mainMaterialsOrdered(): boolean {
  return MATERIALS.ice.hardness < MATERIALS.wood.hardness
    && MATERIALS.wood.hardness < MATERIALS.stone.hardness;
}

/* ---------------- 连锁倒塌 ---------------- */

export interface CollapseBlock {
  id: number;
  kind: BlockKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 已经积累的损伤 */
  damage: number;
}

/** 判断 a 是不是压在 b 的正上方（水平有重叠、垂直挨着）。 */
export function restsOn(a: CollapseBlock, b: CollapseBlock, tolerance = 4): boolean {
  const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
  const touching = Math.abs(a.y + a.h - b.y) <= tolerance;
  return overlapX && touching;
}

/** 一块塌下来砸到下面那块，能传下去多少损伤（质量越大砸得越狠）。 */
export const COLLAPSE_TRANSFER = 0.55;

export function collapseDamage(faller: CollapseBlock, target: CollapseBlock): number {
  const weight = MATERIALS[faller.kind].mass;
  return weight * 40 * COLLAPSE_TRANSFER * materialVuln(target.kind);
}

/** 一块的损伤到多少就算碎掉。 */
export const BREAK_THRESHOLD = 100;

export interface CollapseStep {
  /** 这一轮碎掉的方块 id */
  broken: number[];
  /** 这一轮被砸到（但没碎）的方块 id */
  hit: number[];
}

/**
 * 连锁倒塌：从一批「刚碎掉」的方块出发，让压在它们上面的方块塌下来砸下一层，
 * 一层一层往下传，直到没有新的方块碎掉为止。
 * 每一轮的结果按 id 排序，所以同一个局面永远得到同一串结果（可复现）。
 */
export function resolveCollapse(
  blocks: readonly CollapseBlock[],
  initiallyBroken: readonly number[],
): CollapseStep[] {
  const state = new Map<number, CollapseBlock>();
  for (const b of blocks) state.set(b.id, { ...b });
  const gone = new Set<number>(initiallyBroken);
  const steps: CollapseStep[] = [];
  let wave = [...initiallyBroken].sort((a, b) => a - b);
  let guard = 0;
  while (wave.length > 0 && guard++ < 64) {
    const broken: number[] = [];
    const hit: number[] = [];
    for (const id of wave) {
      const lost = state.get(id);
      if (!lost) continue;
      // 谁原本压在这块上面，就跟着塌下来
      for (const faller of state.values()) {
        if (gone.has(faller.id)) continue;
        if (!restsOn(faller, lost)) continue;
        // 它掉下去会砸到自己下方的那些
        for (const below of state.values()) {
          if (gone.has(below.id) || below.id === faller.id) continue;
          if (below.y <= faller.y) continue;
          const overlapX = faller.x < below.x + below.w && faller.x + faller.w > below.x;
          if (!overlapX) continue;
          below.damage += collapseDamage(faller, below);
          if (below.damage >= BREAK_THRESHOLD) {
            if (!broken.includes(below.id)) broken.push(below.id);
          } else if (!hit.includes(below.id)) {
            hit.push(below.id);
          }
        }
      }
    }
    for (const id of broken) gone.add(id);
    broken.sort((a, b) => a - b);
    hit.sort((a, b) => a - b);
    if (broken.length === 0 && hit.length === 0) break;
    steps.push({ broken, hit });
    wave = broken;
  }
  return steps;
}

/* ---------------- 三、鸟的能力 ---------------- */

export interface BirdAbility {
  kind: BirdKind;
  label: string;
  /** 空中点按能不能触发（straight 没有能力） */
  triggerable: boolean;
  /** 出弓后多久才允许触发（秒）——太早触发等于没飞出去 */
  windowFrom: number;
  /** 出弓后多久之后就来不及了（秒） */
  windowTo: number;
  hint: string;
}

export const ABILITY_WINDOW_FROM = 0.12;
export const ABILITY_WINDOW_TO = 2.4;

export const BIRD_ABILITIES: Record<BirdKind, BirdAbility> = {
  straight: {
    kind: "straight",
    label: "直飞豆",
    triggerable: false,
    windowFrom: 0,
    windowTo: 0,
    hint: "老老实实飞一条弧线，最好瞄准",
  },
  split: {
    kind: "split",
    label: "分身豆",
    triggerable: true,
    windowFrom: ABILITY_WINDOW_FROM,
    windowTo: ABILITY_WINDOW_TO,
    hint: "空中点一下就分成三个，打一整排最好用",
  },
  slam: {
    kind: "slam",
    label: "砸地豆",
    triggerable: true,
    windowFrom: ABILITY_WINDOW_FROM,
    windowTo: ABILITY_WINDOW_TO,
    hint: "空中点一下就往下猛砸，对付顶上那层",
  },
  drill: {
    kind: "drill",
    label: "钻钻豆",
    triggerable: true,
    windowFrom: ABILITY_WINDOW_FROM,
    windowTo: ABILITY_WINDOW_TO,
    hint: "空中点一下就提速直冲，专门啃石头",
  },
  boomerang: {
    kind: "boomerang",
    label: "回旋豆",
    triggerable: true,
    windowFrom: ABILITY_WINDOW_FROM,
    windowTo: ABILITY_WINDOW_TO,
    hint: "空中点一下就掉头飞回来，能打到后面藏着的",
  },
};

/** 这一刻按下去，能力触发得了吗。 */
export function canTriggerAbility(kind: BirdKind, secondsSinceLaunch: number): boolean {
  const a = BIRD_ABILITIES[kind];
  if (!a.triggerable) return false;
  return secondsSinceLaunch >= a.windowFrom && secondsSinceLaunch <= a.windowTo;
}

/** 有能力的鸟至少要有这么多种（规格要求 ≥ 3）。 */
export function triggerableBirds(): BirdKind[] {
  return (Object.keys(BIRD_ABILITIES) as BirdKind[]).filter(
    (k) => BIRD_ABILITIES[k].triggerable,
  );
}

/* ---------------- 四、无尽「打靶塔」 ---------------- */

/** 无尽模式固定给几只鸟 */
export const TOWER_BIRDS = 5;
/** 第一座塔多少层 */
export const TOWER_BASE_FLOORS = 3;
/** 每过一座塔多几层 */
export const TOWER_FLOOR_STEP = 1;
/** 塔最高多少层（再高屏幕就放不下了） */
export const TOWER_MAX_FLOORS = 12;

export interface TowerFloor {
  kind: BlockKind;
  /** 这一层几块 */
  count: number;
}

export interface TowerSpec {
  /** 第几座塔（从 1 开始） */
  index: number;
  floors: TowerFloor[];
  /** 这座塔一共几块 */
  blocks: number;
  /** 全部打倒能拿多少分 */
  maxScore: number;
}

/** 第 n 座塔有几层（有上限，不会无限长高）。 */
export function towerFloors(index: number): number {
  const n = Number.isFinite(index) ? Math.max(1, Math.floor(index)) : 1;
  return Math.min(TOWER_MAX_FLOORS, TOWER_BASE_FLOORS + (n - 1) * TOWER_FLOOR_STEP);
}

/**
 * 生成第 n 座塔（固定 seed 可复现）。
 * 越往上越脆（冰在顶、石在底），这样「先打底下让它塌」才是聪明打法。
 */
export function buildTower(index: number, seed: number): TowerSpec {
  const rng = makeRng((seed + index * 7919) >>> 0);
  const floorCount = towerFloors(index);
  const floors: TowerFloor[] = [];
  let blocks = 0;
  for (let f = 0; f < floorCount; f++) {
    const height = f / Math.max(1, floorCount - 1); // 0 底 1 顶
    const roll = rng();
    let kind: BlockKind;
    if (height > 0.66) kind = roll < 0.7 ? "ice" : "glass";
    else if (height > 0.33) kind = roll < 0.7 ? "wood" : "ice";
    else kind = roll < 0.55 ? "stone" : "wood";
    const count = 2 + Math.floor(rng() * 3);
    floors.push({ kind, count });
    blocks += count;
  }
  return { index: floorCount > 0 ? Math.max(1, Math.floor(index)) : 1, floors, blocks, maxScore: blocks * 10 };
}

/** 无尽塔关卡在世界坐标里的落脚点与格子尺寸 */
export const TOWER_BLOCK_W = 30;
export const TOWER_BLOCK_H = 22;
export const TOWER_BASE_X = 330;
export const TOWER_BASE_Y = 312;

/**
 * 把一座塔铺成真正的 `LevelDef`，直接丢给既有的关卡运行时跑。
 * 顶上放一颗绿绿豆当目标，所以「把塔打塌」和「打到豆」是同一件事。
 */
export function buildTowerLevel(index: number, seed: number): LevelDef {
  const tower = buildTower(index, seed);
  const blocks: LevelDef["blocks"] = [];
  let y = TOWER_BASE_Y;
  for (const floor of tower.floors) {
    y -= TOWER_BLOCK_H;
    const total = floor.count * TOWER_BLOCK_W;
    const startX = TOWER_BASE_X - total / 2;
    for (let i = 0; i < floor.count; i++) {
      blocks.push({
        kind: floor.kind,
        x: startX + i * TOWER_BLOCK_W,
        y,
        w: TOWER_BLOCK_W,
        h: TOWER_BLOCK_H,
      });
    }
  }
  const birds: BirdKind[] = [];
  const pool: BirdKind[] = ["straight", "split", "slam", "drill", "boomerang"];
  const rng = makeRng((seed + index * 104729) >>> 0);
  for (let i = 0; i < TOWER_BIRDS; i++) {
    birds.push(i === 0 ? "straight" : pool[Math.floor(rng() * pool.length)]);
  }
  return {
    id: 10000 + Math.max(1, Math.floor(index)),
    chapter: 0,
    name: `打靶塔 第 ${Math.max(1, Math.floor(index))} 座`,
    birds,
    beans: [{ x: TOWER_BASE_X, y: y - 12 }],
    blocks,
  };
}

/** 打倒了 `downed` 块能拿多少分（越高的塔单块越值钱）。 */
export function towerScore(tower: TowerSpec, downed: number): number {
  const n = Math.max(0, Math.min(tower.blocks, Math.floor(downed)));
  return n * 10 + (n === tower.blocks ? tower.blocks * 2 : 0);
}

/** 无尽成绩只增不减。 */
export function bestTowerScore(prev: number, next: number): number {
  const p = Number.isFinite(prev) ? Math.max(0, Math.round(prev)) : 0;
  if (!Number.isFinite(next)) return p;
  return Math.max(p, Math.max(0, Math.round(next)));
}

/* ---------------- 五、关卡可解性 ---------------- */

/** 可解性模拟里试多少个拉弓角度 */
export const SOLVE_ANGLE_SAMPLES = 24;
/** 每个角度试多少种力度 */
export const SOLVE_POWER_SAMPLES = 8;

export interface SolveProbe {
  dragX: number;
  dragY: number;
  /** 这条弹道最远飞到哪个 x */
  reachX: number;
}

/**
 * 一关「存在一条打得到的弹道」吗？
 *
 * 判据刻意保守：只要**存在一组拉弓参数，让弹道经过某颗绿绿豆附近**，
 * 这一关就至少不是「怎么打都够不着」。真正的过关还要靠孩子自己瞄，
 * 但「够得着」这条底线必须由测试守住，尤其是后段那些又高又远的关。
 */
export function levelHasReachableTarget(level: LevelDef, tolerance = 26): boolean {
  if (level.beans.length === 0) return false;
  for (const probe of solveProbes()) {
    const { vx, vy } = launchVelocity(probe.dragX, probe.dragY);
    const pts = simulateTrajectory(SLING_X, SLING_Y, vx, vy, 1, level.winds ?? [], 80, 0.03);
    for (const p of pts) {
      if (p.x < 0 || p.x > WORLD_W + 60) break;
      for (const bean of level.beans) {
        if (Math.hypot(p.x - bean.x, p.y - bean.y) <= tolerance) return true;
      }
    }
  }
  return false;
}

/** 拉弓参数的采样网格（固定，不随机，所以结论可复现）。 */
export function solveProbes(): SolveProbe[] {
  const out: SolveProbe[] = [];
  for (let a = 0; a < SOLVE_ANGLE_SAMPLES; a++) {
    // 只取「往左下拉」这半边，那才是真的能把鸟弹出去的方向
    const angle = Math.PI * 0.02 + (a / SOLVE_ANGLE_SAMPLES) * Math.PI * 0.48;
    for (let p = 1; p <= SOLVE_POWER_SAMPLES; p++) {
      const r = (p / SOLVE_POWER_SAMPLES) * MAX_DRAG;
      out.push({ dragX: -Math.cos(angle) * r, dragY: Math.sin(angle) * r, reachX: 0 });
    }
  }
  return out;
}

/** 抽样一批关卡编号做可解性验证（含规格点名的 100 / 145 / 188）。 */
export function solvabilitySample(): number[] {
  const must = [1, 15, 30, 45, 60, 75, 90, 99, 100, 110, 120, 130, 140, 145, 150, 160, 170, 180, 185, 188];
  return must.filter((n) => n >= 1 && n <= LEVELS.length);
}

/** 拉满弓时的初速不许超过 `MAX_LAUNCH`（手感封顶，也保证预测点不会飞出世界）。 */
export function maxLaunchSpeed(): number {
  const { vx, vy } = launchVelocity(-MAX_DRAG, MAX_DRAG);
  return Math.hypot(vx, vy);
}

/** 弹道封顶常量给测试与 HUD 共用，避免两处各写一个数。 */
export const LAUNCH_CEILING = MAX_LAUNCH;
