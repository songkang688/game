/**
 * 果果合成 · 11 级合成链与计分（全部原创果名，不沿用任何商业作品的设定）。
 */
import { addCircle, massOf, type Circle, type World } from "./physics";

export interface FruitDef {
  name: string;
  emoji: string;
  r: number;
  color: string;
  /** 合成出这一级时的基础分 */
  score: number;
}

/** 籽 → 莓 → 柑 → 桃 → 梨 → 苹 → 橙 → 柚 → 瓜 → 玉瓜 → 团圆瓜 */
export const CHAIN: readonly FruitDef[] = [
  { name: "籽", emoji: "🫘", r: 11, color: "#C9E7B4", score: 1 },
  { name: "莓", emoji: "🍓", r: 15, color: "#FFB3C1", score: 3 },
  { name: "柑", emoji: "🍊", r: 20, color: "#FFCE8A", score: 6 },
  { name: "桃", emoji: "🍑", r: 25, color: "#FFC4C4", score: 10 },
  { name: "梨", emoji: "🍐", r: 31, color: "#E4EFA8", score: 15 },
  { name: "苹", emoji: "🍎", r: 38, color: "#FF9E9E", score: 21 },
  { name: "橙", emoji: "🟠", r: 45, color: "#FFB865", score: 28 },
  { name: "柚", emoji: "🟡", r: 53, color: "#FFE58A", score: 36 },
  { name: "瓜", emoji: "🍈", r: 62, color: "#BFE8C4", score: 45 },
  { name: "玉瓜", emoji: "🥝", r: 72, color: "#A7DCA9", score: 55 },
  { name: "团圆瓜", emoji: "🍉", r: 84, color: "#8FD48F", score: 66 },
];

export const MAX_LEVEL = CHAIN.length - 1;

/**
 * 两颗最高级果子相碰的处理方式。
 * 本款选择「合并成一颗最高级并额外加大分」，这样最高级不会凭空消失，
 * 孩子看得到自己堆出来的成果（常量写在这里，测试盯着它）。
 */
export const TOP_MERGE_MODE: "keepTop" | "vanish" = "keepTop";

/** 最高级相碰的额外加分 */
export const TOP_MERGE_BONUS = 300;

/** 一次连锁里第 n 段（0 基）的分数倍率 */
export function chainMultiplier(chain: number): number {
  return 1 + Math.max(0, Math.floor(chain)) * 0.5;
}

/** 合成出 level 级、处在连锁第 chain 段时得多少分 */
export function scoreFor(level: number, chain: number): number {
  const lv = Math.max(0, Math.min(MAX_LEVEL, Math.round(level)));
  const base = CHAIN[lv].score;
  const bonus = lv >= MAX_LEVEL && TOP_MERGE_MODE === "keepTop" ? TOP_MERGE_BONUS : 0;
  return Math.round((base + bonus) * chainMultiplier(chain));
}

export interface MergeEvent {
  /** 参与合成的两颗果子 */
  a: number;
  b: number;
  /** 合成出来的新果子 id（最高级 vanish 模式下为 -1） */
  born: number;
  level: number;
  x: number;
  y: number;
  score: number;
  chain: number;
}

function sameLevelTouching(a: Circle, b: Circle): boolean {
  if (a.level !== b.level) return false;
  if (a.side !== b.side) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rr = a.r + b.r;
  // 留 1px 余量：物理解算后两颗贴着的球距离会略大于半径和
  return dx * dx + dy * dy <= (rr + 1) * (rr + 1);
}

/**
 * 扫一遍场上所有果子，把同级相碰的合成掉。
 * 每次调用只处理一轮（一段连锁），返回本轮发生的合成事件。
 */
export function tryMerge(world: World, chain = 0): MergeEvent[] {
  const events: MergeEvent[] = [];
  const used = new Set<number>();
  // 只看这一轮开始时就在场上的果子：新生成的留到下一段连锁，动画才能一节一节播
  const list = world.circles.slice();
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (used.has(a.id)) continue;
    for (let k = i + 1; k < list.length; k++) {
      const b = list[k];
      if (used.has(b.id)) continue;
      if (!sameLevelTouching(a, b)) continue;
      used.add(a.id);
      used.add(b.id);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const nextLevel = Math.min(MAX_LEVEL, a.level + 1);
      const isTop = a.level >= MAX_LEVEL;
      const score = scoreFor(isTop ? MAX_LEVEL : nextLevel, chain);
      let bornId = -1;
      if (!isTop || TOP_MERGE_MODE === "keepTop") {
        const level = isTop ? MAX_LEVEL : nextLevel;
        const born = addCircle(world, level, mx, my, CHAIN[level].r, a.side);
        born.vx = (a.vx + b.vx) / 2;
        born.vy = (a.vy + b.vy) / 2;
        born.m = massOf(born.r);
        // 新生成的果子沿用较早那颗的宽限，避免刚合成就被判越线
        born.graceMs = Math.max(a.graceMs, b.graceMs, 260);
        bornId = born.id;
      }
      events.push({ a: a.id, b: b.id, born: bornId, level: isTop ? MAX_LEVEL : nextLevel, x: mx, y: my, score, chain });
      break;
    }
  }
  if (events.length > 0) {
    const dead = new Set<number>();
    for (const e of events) {
      dead.add(e.a);
      dead.add(e.b);
    }
    world.circles = world.circles.filter((c) => !dead.has(c.id));
  }
  return events;
}

/**
 * 连锁：一轮合成完可能又碰到一起，逐段结算直到没有新的合成。
 * 返回按段落分组的事件列表，前端可以一段一段播动画。
 */
export function chainMerges(world: World, maxRounds = 12): MergeEvent[][] {
  const rounds: MergeEvent[][] = [];
  for (let i = 0; i < maxRounds; i++) {
    const events = tryMerge(world, i);
    if (events.length === 0) break;
    rounds.push(events);
  }
  return rounds;
}

/** 一次连锁的总得分 */
export function totalScore(rounds: MergeEvent[][]): number {
  let s = 0;
  for (const round of rounds) for (const e of round) s += e.score;
  return s;
}

/** 场上出现过的最高等级 */
export function highestLevel(world: World, side = 0): number {
  let top = -1;
  for (const c of world.circles) {
    if (c.side !== side) continue;
    top = Math.max(top, c.level);
  }
  return top;
}

// ---------------------------------------------------------------------------
// 投放序列生成（种子化，保证同一关每次一样）
// ---------------------------------------------------------------------------

function hash32(seed: number, i: number): number {
  let h = (seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** 第 i 颗待投放果子的等级：只会出 0..maxLevel，越小越常见 */
export function nextFruit(seed: number, i: number, maxLevel: number): number {
  const cap = Math.max(0, Math.min(MAX_LEVEL, Math.round(maxLevel)));
  const roll = hash32(seed, i) / 0xffffffff;
  // 指数衰减：0 级最多，越高越罕见
  let acc = 0;
  let weightSum = 0;
  const weights: number[] = [];
  for (let lv = 0; lv <= cap; lv++) {
    const w = 1 / 2 ** lv;
    weights.push(w);
    weightSum += w;
  }
  for (let lv = 0; lv <= cap; lv++) {
    acc += weights[lv] / weightSum;
    if (roll <= acc) return lv;
  }
  return cap;
}
