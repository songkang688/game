/**
 * 糖果秋千 · 1.2 深度层（纯函数，不碰 DOM，也不引入任何物理引擎依赖）。
 *
 * 1.1 已经有质点—约束绳（`physics.ts`）、188 关关卡表（`levels.ts`）
 * 和逐帧可通关性仿真（`sim.ts`），1.2 在**不动这三样既有资产**的前提下补五件事：
 *  1. **一刀两断**：一次划线同时切断多根绳给连击评价，绳头切断瞬间往两边甩一下；
 *  2. **粘性泡泡**：临时挂住糖果，到点自己松手，松手时把攒下的速度还回去；
 *  3. **弹簧蘑菇**：按蘑菇朝向把糖果弹开，有增益也有封顶，不会越弹越快；
 *  4. **糖果残影**：落点轨迹留 300 毫秒淡出小点，帮孩子把「速度」看出来；
 *  5. **无尽甜甜塔**：一颗接一颗地喂，机关越来越多，坚持吃到第几颗记成绩。
 *
 * 另外把两代前缀的老存档（`yiduo.` 开头）读一次搬到新 key 上，一颗星都不能丢。
 */
import {
  segmentsWithinDistance,
  type Link,
  type Particle,
} from "./physics";
import type { LevelDef } from "./levels";
import { LEVELS } from "./levels";

/* ---------------- 一、一刀两断：连击与绳头回甩 ---------------- */

/** 割绳判定带半宽，与 index.ts 的 CUT_HALF_WIDTH 保持一致 */
export const CUT_HALF_WIDTH = 10;

/** 一根绳被切断时，两头往划线的法线方向弹开多少像素（不是「啪」地消失） */
export const SNAP_FLICK = 3;

/**
 * 一笔划线（上一帧手指位置 → 这一帧手指位置）会切断哪几根绳。
 *
 * 关键是**拿位移当线段去判交**而不是拿当前这一个点去判半径：
 * 手指划得再快，两帧之间的那一段也会被完整检查，不会从绳中间穿过去（tunneling）。
 */
export function strokeCutIndices(
  particles: readonly Particle[],
  links: readonly Link[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  halfWidth = CUT_HALF_WIDTH,
): number[] {
  const hit: number[] = [];
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (!link.active) continue;
    const pa = particles[link.a];
    const pb = particles[link.b];
    if (!pa || !pb) continue;
    if (segmentsWithinDistance(x0, y0, x1, y1, pa.x, pa.y, pb.x, pb.y, halfWidth)) {
      hit.push(i);
    }
  }
  return hit;
}

/** 一笔划线的法线方向（单位向量）；线段退化成一个点时给一个稳定的默认值 */
export function strokeNormal(x0: number, y0: number, x1: number, y1: number): { nx: number; ny: number } {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { nx: 0, ny: -1 };
  return { nx: -dy / len, ny: dx / len };
}

/** 一刀切断几根算「连击」 */
export const COMBO_MIN = 2;

/** 连击评价语。只夸不损，切一根不吭声（免得刷屏） */
export function comboLabel(count: number): string | null {
  if (count < COMBO_MIN) return null;
  if (count === 2) return "一刀两断！";
  if (count === 3) return "一刀三断！好眼力！";
  return `一刀 ${count} 断！这一划太漂亮啦！`;
}

/** 连击奖励星屑：2 根 1 颗，往上每多一根再加 1 颗，封顶 5 颗 */
export function comboBonus(count: number): number {
  if (count < COMBO_MIN) return 0;
  return Math.min(5, count - 1);
}

/* ---------------- 二、粘性泡泡 ---------------- */

/** 粘性泡泡挂住糖果多少秒后自己松手 */
export const STICKY_HOLD = 1.2;
/** 松手时把挂住之前的速度还回去多少（留一点损耗，不然会越荡越快） */
export const STICKY_KEEP = 0.75;

export interface StickyState {
  held: boolean;
  remain: number;
  /** 挂住那一刻的速度，松手时按 STICKY_KEEP 还回去 */
  vx: number;
  vy: number;
}

export function createSticky(): StickyState {
  return { held: false, remain: 0, vx: 0, vy: 0 };
}

/** 糖果撞进粘性泡泡：挂住，速度先收起来 */
export function stickyCatch(state: StickyState, vx: number, vy: number, hold = STICKY_HOLD): StickyState {
  if (state.held) return state;
  return { held: true, remain: Math.max(0, hold), vx, vy };
}

export function tickSticky(state: StickyState, dt: number): StickyState {
  if (!state.held) return state;
  const remain = state.remain - Math.max(0, dt);
  if (remain > 0) return { ...state, remain };
  return { ...state, held: false, remain: 0 };
}

/** 松手瞬间还给糖果的速度 */
export function stickyRelease(state: StickyState): { vx: number; vy: number } {
  return { vx: state.vx * STICKY_KEEP, vy: state.vy * STICKY_KEEP };
}

/** 还要挂多久（画倒计时圈用），0–1 */
export function stickyProgress(state: StickyState, hold = STICKY_HOLD): number {
  if (!state.held || hold <= 0) return 0;
  return Math.max(0, Math.min(1, state.remain / hold));
}

/* ---------------- 三、弹簧蘑菇 ---------------- */

export type MushroomDir = "up" | "down" | "left" | "right";

/** 弹簧蘑菇的伞盖半径 */
export const MUSHROOM_R = 26;
/** 弹开的增益：比撞上去的速度快一点点，但不许无限累积 */
export const MUSHROOM_GAIN = 1.15;
/** 弹开速度的下限——轻轻碰一下也要弹得动，不然糖果会赖在蘑菇上 */
export const MUSHROOM_MIN_SPEED = 210;
/** 弹开速度的上限 */
export const MUSHROOM_MAX_SPEED = 760;

const MUSHROOM_AXIS: Record<MushroomDir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function mushroomAxis(dir: MushroomDir): { x: number; y: number } {
  return MUSHROOM_AXIS[dir];
}

/**
 * 糖果撞上弹簧蘑菇之后的速度。
 * 沿蘑菇朝向重新给一个速度（带增益、有上下限），
 * 侧向速度保留一半——这样斜着撞上去还是会斜着飞出来，孩子能预判。
 */
export function mushroomBounce(
  vx: number,
  vy: number,
  dir: MushroomDir,
): { vx: number; vy: number } {
  const axis = MUSHROOM_AXIS[dir];
  const speed = Math.hypot(vx, vy);
  const out = Math.max(MUSHROOM_MIN_SPEED, Math.min(MUSHROOM_MAX_SPEED, speed * MUSHROOM_GAIN));
  // 侧向分量 = 总速度减去沿轴分量
  const along = vx * axis.x + vy * axis.y;
  const sideX = vx - along * axis.x;
  const sideY = vy - along * axis.y;
  return { vx: axis.x * out + sideX * 0.5, vy: axis.y * out + sideY * 0.5 };
}

/** 撞上去的这一下算不算数：必须是朝着蘑菇伞面压过去，蹭着背面走不触发 */
export function mushroomTriggers(vx: number, vy: number, dir: MushroomDir): boolean {
  const axis = MUSHROOM_AXIS[dir];
  return vx * axis.x + vy * axis.y < 40;
}

/* ---------------- 四、糖果残影 ---------------- */

/** 残影留多少毫秒 */
export const GHOST_MS = 300;
/** 残影最多留几个点（`prefers-reduced-motion` 下取一半） */
export const GHOST_MAX = 12;

export interface Ghost {
  x: number;
  y: number;
  /** 生成时刻，秒 */
  t: number;
}

export function pushGhost(list: Ghost[], x: number, y: number, t: number, max = GHOST_MAX): Ghost[] {
  const next = [...list, { x, y, t }];
  while (next.length > max) next.shift();
  return next;
}

export function pruneGhosts(list: readonly Ghost[], now: number): Ghost[] {
  const cutoff = now - GHOST_MS / 1000;
  return list.filter((g) => g.t >= cutoff);
}

/** 越老越淡，超过 300ms 就是 0 */
export function ghostAlpha(g: Ghost, now: number): number {
  const age = (now - g.t) * 1000;
  if (age < 0) return 0.55;
  if (age >= GHOST_MS) return 0;
  return 0.55 * (1 - age / GHOST_MS);
}

/* ---------------- 五、无尽「甜甜塔」 ---------------- */

const W = 360;

/** 一小段确定性随机，seed 一样结果就一样 */
export function makeSwingRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

/** 第几颗糖开始出现移动木板 / 剪刀 / 咕噜噜 */
export const SWEET_BOARD_FROM = 3;
export const SWEET_SCISSORS_FROM = 6;
export const SWEET_GREMLIN_FROM = 9;
/** 星星颗数：一开始 1 颗，越往后越多，封顶 3 颗 */
export const SWEET_STAR_MAX = 3;

export function sweetStarCount(index: number): number {
  return Math.max(1, Math.min(SWEET_STAR_MAX, 1 + Math.floor((index - 1) / 4)));
}

/**
 * 无尽甜甜塔的第 index 颗糖。
 *
 * 几何是**故意保底可解**的：糖果吊在锚点正下方、啾啾就在正下方接着，
 * 一剪就能掉进嘴里；难度全部来自「什么时候剪」——
 * 会动的木板、定时剪刀和咕噜噜都在下落路线上来回过，剪早剪晚都不行。
 * 这样越往后越难，但**永远存在一个可行的剪断时机**（`searchCutTimeFor` 能搜到）。
 */
export function buildSweetLevel(index: number, seed: number): LevelDef {
  const n = Math.max(1, Math.floor(index));
  const rng = makeSwingRng((seed >>> 0) + n * 2654435761);
  const cx = Math.round(120 + rng() * 120);
  const anchorY = 92;
  const ropeLen = 78 + Math.round(rng() * 26);
  const candyY = anchorY + ropeLen;
  const mouthY = 402;

  const stars: Array<{ x: number; y: number }> = [];
  const starCount = sweetStarCount(n);
  for (let i = 0; i < starCount; i++) {
    // 星星全部摆在下落线上，剪对时机自然全收——三星解一定存在
    stars.push({ x: cx, y: Math.round(candyY + 46 + i * 62) });
  }

  const level: LevelDef = {
    name: `甜甜塔 第 ${n} 颗`,
    tip: "看准机关的空档再剪绳，糖果会直直落进啾啾嘴里。",
    candy: { x: cx, y: candyY },
    monster: { x: cx, y: mouthY },
    ropes: [{ x: cx, y: anchorY, length: ropeLen }],
    stars,
    solve: { kind: "search", tMax: 6 },
  };

  if (n >= SWEET_BOARD_FROM) {
    // 会左右滑的木板：挡在半路，等它滑开的空档再剪
    const period = Math.max(1.6, 3.2 - n * 0.08);
    const y = 268;
    level.boards = [
      {
        x1: 10,
        y1: y,
        x2: W - 74,
        y2: y,
        w: 64,
        h: 12,
        period: +period.toFixed(2),
      },
    ];
  }

  if (n >= SWEET_SCISSORS_FROM) {
    // 自动剪刀会替你把绳剪掉：拖太久就轮不到你决定落点了
    level.scissors = [
      { x: cx, y: anchorY + Math.round(ropeLen * 0.45), radius: 16, period: 3.4, offset: 1.2 },
    ];
  }

  if (n >= SWEET_GREMLIN_FROM) {
    const side = rng() < 0.5 ? -1 : 1;
    level.gremlins = [
      {
        x1: cx + side * 78,
        y1: 330,
        x2: cx - side * 78,
        y2: 330,
        period: Math.max(1.8, 3.6 - n * 0.06),
        radius: 20,
        delay: 0.6,
      },
    ];
  }

  return level;
}

/** 吃到第 n 颗糖的累计分：每颗 10 分，每收一颗星再加 2 分 */
export function sweetScore(candiesEaten: number, starsCollected: number): number {
  return Math.max(0, Math.floor(candiesEaten)) * 10 + Math.max(0, Math.floor(starsCollected)) * 2;
}

export function bestSweetScore(prev: number, next: number): number {
  return Math.max(prev, next);
}

/* ---------------- 六、188 关可解性抽样 ---------------- */

/** 必验的关号（1 起数），点名 100 / 145 / 188，其余均匀铺开 */
export function solvabilitySample(): number[] {
  const must = [1, 2, 17, 34, 50, 66, 82, 99, 100, 110, 120, 130, 140, 145, 150, 160, 170, 180, 188];
  const out = new Set<number>(must);
  for (let id = 5; id <= LEVELS.length && out.size < 32; id += 11) out.add(id);
  return [...out].sort((a, b) => a - b);
}

/** 一关的星星是不是全都在，用来断言「三星解存在」的前置条件 */
export function levelStarCount(lv: LevelDef): number {
  return lv.stars.length;
}

/* ---------------- 七、两代前缀老存档迁移 ---------------- */

/** 1.2 之后写这个 key（统一 `yiduo-yixing.` 前缀） */
export const SAVE_KEY = "yiduo-yixing.candy-swing.campaign.v2";
/** 历史上出现过的老 key，按新到旧读一次就够 */
export const LEGACY_SAVE_KEYS = [
  "yiduo.candy-swing.campaign.v2",
  "yiduo.candy-swing.campaign",
];

function parseStars(raw: string | null | undefined, total: number): number[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { stars?: unknown };
    if (!Array.isArray(data.stars)) return null;
    const arr = data.stars as unknown[];
    return Array.from({ length: total }, (_, i) => {
      const v = arr[i];
      return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(3, Math.round(v))) : 0;
    });
  } catch {
    return null;
  }
}

/**
 * 读进度：先读新 key，读不到再往前翻老 key。
 * 两边都有的时候**逐关取大的那个**——不管孩子先前在哪个版本上打的，星星都不会丢。
 */
export function readStars(read: (key: string) => string | null, total = LEVELS.length): number[] {
  const merged = Array.from({ length: total }, () => 0);
  for (const key of [SAVE_KEY, ...LEGACY_SAVE_KEYS]) {
    const stars = parseStars(read(key), total);
    if (!stars) continue;
    for (let i = 0; i < total; i++) merged[i] = Math.max(merged[i], stars[i]);
  }
  return merged;
}

/** 老 key 里有、新 key 里没有的星星，就需要搬一次家 */
export function needsMigration(read: (key: string) => string | null, total = LEVELS.length): boolean {
  const fresh = parseStars(read(SAVE_KEY), total);
  for (const key of LEGACY_SAVE_KEYS) {
    const old = parseStars(read(key), total);
    if (!old) continue;
    if (!fresh) return old.some((v) => v > 0);
    for (let i = 0; i < total; i++) if (old[i] > fresh[i]) return true;
  }
  return false;
}
