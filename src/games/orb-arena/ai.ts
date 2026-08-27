/**
 * 圆圆大作战 · 本地对手(四档)。
 *
 * 竞技场里除了你都是本机 AI 冒充的「其他圆圆」,不联网、不开 socket。
 * 决策是纯函数:给一份视野快照,回一个前进方向和要不要分身 / 吐孢子。
 */
import {
  EAT_RATIO,
  MIN_SPIT_MASS,
  MIN_SPLIT_MASS,
  dist,
  massToRadius,
  type Cell,
  type Pellet,
  type Vec,
  type Virus
} from "./logic";

export type AiTier = "rookie" | "normal" | "pro" | "hell";

export const AI_TIERS: AiTier[] = ["rookie", "normal", "pro", "hell"];

export const AI_TIER_LABELS: Record<AiTier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  pro: "高手",
  hell: "地狱"
};

export interface AiParams {
  /** 看多远 */
  sight: number;
  /** 追彩豆的执着程度 */
  greed: number;
  /** 追小圆的积极程度 */
  aggression: number;
  /** 躲大圆与刺球的谨慎程度 */
  caution: number;
  /** 会不会用分身抓人 */
  splitSkill: number;
  /** 走位抖动(越大越乱) */
  jitter: number;
}

export const AI_PARAMS: Record<AiTier, AiParams> = {
  rookie: { sight: 150, greed: 0.35, aggression: 0.1, caution: 0.5, splitSkill: 0, jitter: 1 },
  normal: { sight: 320, greed: 0.8, aggression: 0.5, caution: 0.9, splitSkill: 0.2, jitter: 0.45 },
  pro: { sight: 520, greed: 1, aggression: 0.85, caution: 1.2, splitSkill: 0.6, jitter: 0.18 },
  hell: { sight: 760, greed: 1.15, aggression: 1.1, caution: 1.5, splitSkill: 1, jitter: 0.05 }
};

export interface AiView {
  self: Cell;
  pellets: readonly Pellet[];
  others: readonly Cell[];
  viruses: readonly Virus[];
  mapW: number;
  mapH: number;
}

export interface AiMove {
  /** 想去的世界坐标 */
  aim: Vec;
  split: boolean;
  spit: boolean;
}

function nearest<T extends Vec>(from: Vec, list: readonly T[], within: number): T | null {
  let best: T | null = null;
  let bestD = within;
  for (const item of list) {
    const d = dist(from, item);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

/**
 * 一次决策。`rand` 只用于抖动,传固定 seed 的随机数就完全可复现。
 *
 * 打分很朴素:躲开吃得下我的圆(权重最高)→ 追吃得下的小圆 → 捡彩豆 → 兜着地图中心走。
 */
export function aiSteer(view: AiView, tier: AiTier, rand: () => number = Math.random): AiMove {
  const p = AI_PARAMS[tier] ?? AI_PARAMS.normal;
  const self = view.self;
  const center = { x: view.mapW / 2, y: view.mapH / 2 };
  let aim: Vec = center;
  let split = false;
  let spit = false;

  // 1) 有人吃得下我 → 掉头就跑
  const threats = view.others.filter(
    (o) => o.owner !== self.owner && o.mass >= self.mass * EAT_RATIO && dist(self, o) < p.sight
  );
  const threat = nearest(self, threats, p.sight);
  if (threat) {
    const dx = self.x - threat.x;
    const dy = self.y - threat.y;
    const len = Math.hypot(dx, dy) || 1;
    const flee = 200 * p.caution;
    aim = { x: self.x + (dx / len) * flee, y: self.y + (dy / len) * flee };
    return jitterMove(aim, p, rand, self, view, false, false);
  }

  // 2) 刺球:比我小的刺球我可以吃,比我大的绕开
  const virus = nearest(self, view.viruses, p.sight * 0.6);
  if (virus && self.mass <= virus.mass && dist(self, virus) < massToRadius(self.mass) + 70) {
    const dx = self.x - virus.x;
    const dy = self.y - virus.y;
    const len = Math.hypot(dx, dy) || 1;
    aim = { x: self.x + (dx / len) * 160 * p.caution, y: self.y + (dy / len) * 160 * p.caution };
    return jitterMove(aim, p, rand, self, view, false, false);
  }

  // 3) 追吃得下的小圆
  const prey = view.others.filter(
    (o) => o.owner !== self.owner && self.mass >= o.mass * EAT_RATIO && dist(self, o) < p.sight
  );
  const target = nearest(self, prey, p.sight);
  if (target && p.aggression > 0.2) {
    aim = { x: target.x, y: target.y };
    const gap = dist(self, target);
    // 会算质量比的档位才敢拍分身:分完两半都还吃得下对面才拍
    split =
      p.splitSkill > 0.5 &&
      self.mass / 2 >= MIN_SPLIT_MASS &&
      self.mass / 2 >= target.mass * EAT_RATIO &&
      gap < massToRadius(self.mass) * 3.2;
    return jitterMove(aim, p, rand, self, view, split, false);
  }

  // 4) 捡彩豆
  const pellet = nearest(self, view.pellets, p.sight);
  if (pellet && p.greed > 0) {
    aim = { x: pellet.x, y: pellet.y };
    return jitterMove(aim, p, rand, self, view, false, false);
  }

  // 5) 没事干:地狱档会拿孢子把刺球往人多的方向推
  if (tier === "hell" && virus && self.mass > MIN_SPIT_MASS * 2) {
    aim = { x: virus.x, y: virus.y };
    spit = true;
  }
  return jitterMove(aim, p, rand, self, view, split, spit);
}

function jitterMove(
  aim: Vec,
  p: AiParams,
  rand: () => number,
  self: Cell,
  view: AiView,
  split: boolean,
  spit: boolean
): AiMove {
  const amp = 120 * p.jitter;
  const jx = (rand() - 0.5) * 2 * amp;
  const jy = (rand() - 0.5) * 2 * amp;
  return {
    aim: {
      x: Math.max(0, Math.min(view.mapW, aim.x + jx)),
      y: Math.max(0, Math.min(view.mapH, aim.y + jy))
    },
    split,
    spit
  };
}

// ---------------------------------------------------------------------------
// 强度对照:同一个 seed 下两档对着跑一局,谁的圆圆更大谁赢
// ---------------------------------------------------------------------------

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DuelResult {
  winner: "a" | "b" | "draw";
  massA: number;
  massB: number;
}

/**
 * headless 小竞技场:两个 AI、一堆彩豆、两颗刺球,跑固定拍数比总质量。
 * 用的就是上面的 `aiSteer` 与 logic 里的运动 / 进食规则,不是另写一套假模型。
 */
export function simulateDuel(tierA: AiTier, tierB: AiTier, seed: number, ticks = 600): DuelResult {
  const rand = rng(seed);
  const mapW = 900;
  const mapH = 900;
  const dt = 1 / 30;
  const a: Cell = { id: "a", owner: "a", mass: 30, x: 200, y: 450, vx: 0, vy: 0, bornAt: 0 };
  const b: Cell = { id: "b", owner: "b", mass: 30, x: 700, y: 450, vx: 0, vy: 0, bornAt: 0 };
  const pellets: Pellet[] = [];
  for (let i = 0; i < 120; i++) {
    pellets.push({ id: `p${i}`, x: rand() * mapW, y: rand() * mapH });
  }
  const viruses: Virus[] = [
    { id: "v0", x: 450, y: 250, mass: 45, fed: 0 },
    { id: "v1", x: 450, y: 650, mass: 45, fed: 0 }
  ];

  const step = (self: Cell, other: Cell, tier: AiTier): void => {
    const move = aiSteer({ self, pellets, others: [other], viruses, mapW, mapH }, tier, rand);
    const dx = move.aim.x - self.x;
    const dy = move.aim.y - self.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 260 / (1 + self.mass / 120);
    self.x = Math.max(0, Math.min(mapW, self.x + (dx / len) * speed * dt));
    self.y = Math.max(0, Math.min(mapH, self.y + (dy / len) * speed * dt));
    const r = massToRadius(self.mass);
    for (let i = pellets.length - 1; i >= 0; i--) {
      if (dist(self, pellets[i]) < r + 4) {
        self.mass += 1.2;
        pellets[i] = { id: pellets[i].id, x: rand() * mapW, y: rand() * mapH };
      }
    }
  };

  for (let t = 0; t < ticks; t++) {
    step(a, b, tierA);
    step(b, a, tierB);
    // 贴上去且质量够大就吃掉对方,直接分胜负
    if (a.mass >= b.mass * EAT_RATIO && dist(a, b) < massToRadius(a.mass)) {
      return { winner: "a", massA: a.mass + b.mass, massB: 0 };
    }
    if (b.mass >= a.mass * EAT_RATIO && dist(a, b) < massToRadius(b.mass)) {
      return { winner: "b", massA: 0, massB: b.mass + a.mass };
    }
  }
  const winner = a.mass === b.mass ? "draw" : a.mass > b.mass ? "a" : "b";
  return { winner, massA: a.mass, massB: b.mass };
}

/** 跑 n 局,返回 A 赢了几局 */
export function duelWins(tierA: AiTier, tierB: AiTier, games = 20, seed0 = 1): number {
  let wins = 0;
  for (let i = 0; i < games; i++) {
    if (simulateDuel(tierA, tierB, seed0 + i * 7919).winner === "a") wins++;
  }
  return wins;
}
