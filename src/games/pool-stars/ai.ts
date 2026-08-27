/**
 * 梨康台球 · 四档电脑球手。
 *
 * | 档 | 行为 |
 * | --- | --- |
 * | 菜鸟 | 随机角度、小力气，进球全靠运气 |
 * | 普通 | 瞄最近的己组球，直接往最近的袋打 |
 * | 高手 | 全台评估每颗球对每个袋口，会算一次库边反弹，挑成功率最高的 |
 * | 地狱 | 高手的基础上会走位（挑打完之后母球离己组球更近的那条线），没球打就打安全球 |
 *
 * 所有决策都是几何 + 一次物理试算，没有随机作弊，也不偷看对手。
 */
import {
  POCKETS,
  TABLE,
  type Ball,
  type Vec,
  angleTo,
  cloneBalls,
  dist,
  ghostPoint,
  mirrorPoint,
  pathClear,
  simulateShot,
  spotFree,
  strike,
} from "./physics";
import { type Group, breakSpot, nearestPocket, placeCueBall } from "./rules";

export type AiTier = 1 | 2 | 3 | 4;

export const AI_TIERS: readonly AiTier[] = [1, 2, 3, 4];

export const AI_LABEL: Record<AiTier, string> = {
  1: "菜鸟",
  2: "普通",
  3: "高手",
  4: "地狱",
};

export const AI_BLURB: Record<AiTier, string> = {
  1: "刚学会握杆，力气小、方向飘。",
  2: "会瞄最近的球，直球打得挺准。",
  3: "全台找线，还会算一次库边反弹。",
  4: "会走位，也会把母球藏起来让你没球打。",
};

export interface AiContext {
  balls: readonly Ball[];
  /** 出杆方这一局打哪一组；台面开放传 null */
  group: Group | null;
  /** 己组是不是清完了（该打黑星球了） */
  ownCleared: boolean;
  requireCall: boolean;
}

export interface AiShot {
  angle: number;
  power: number;
  spin: number;
  calledPocket: number | null;
  /** 这一杆是不是安全球（没球打的时候把母球藏起来） */
  safety: boolean;
}

/** 这一杆的合法目标球 */
export function legalBalls(ctx: AiContext): Ball[] {
  const live = ctx.balls.filter((b) => !b.potted && b.kind !== "cue");
  if (ctx.ownCleared) return live.filter((b) => b.kind === "black");
  if (ctx.group === null) return live.filter((b) => b.kind !== "black");
  return live.filter((b) => b.kind === ctx.group);
}

interface PotPlan {
  angle: number;
  power: number;
  pocket: number;
  targetId: number;
  score: number;
  bank: boolean;
}

/** 直球候选：假想球点在台面里、切角不过大、两段路都通 */
function directPlans(cue: Ball, targets: readonly Ball[], balls: readonly Ball[]): PotPlan[] {
  const out: PotPlan[] = [];
  for (const t of targets) {
    for (let pi = 0; pi < POCKETS.length; pi++) {
      const p = POCKETS[pi];
      const g = ghostPoint(t, p);
      if (g.x < 0 || g.x > TABLE.w || g.y < 0 || g.y > TABLE.h) continue;
      const toGhost = { x: g.x - cue.x, y: g.y - cue.y };
      const toPocket = { x: p.x - t.x, y: p.y - t.y };
      const lg = Math.hypot(toGhost.x, toGhost.y) || 1;
      const lp = Math.hypot(toPocket.x, toPocket.y) || 1;
      const cosCut = (toGhost.x * toPocket.x + toGhost.y * toPocket.y) / (lg * lp);
      if (cosCut < 0.28) continue; // 切角超过约 74°，几乎打不进
      if (!pathClear(cue, g, balls, [cue.id, t.id])) continue;
      if (!pathClear(t, p, balls, [t.id])) continue;
      const score = cosCut * 100 - lg * 0.16 - lp * 0.3;
      out.push({
        angle: angleTo(cue, g),
        power: Math.min(0.95, 0.34 + (lg + lp) / 320),
        pocket: pi,
        targetId: t.id,
        score,
        bank: false,
      });
    }
  }
  return out;
}

type Cushion = "left" | "right" | "top" | "bottom";

/**
 * 母球从 `from` 打向镜像点 `mirror` 时，真正撞上这条库边的那个点。
 * 拿不到有效交点（方向不对、打在库边之外、正好压在袋口上）就返回 null——
 * 这三种情况下「一库反弹」根本不成立，硬打出去只会白丢一杆。
 */
export function cushionHit(from: Vec, mirror: Vec, side: Cushion): Vec | null {
  const r = TABLE.r;
  const rail = side === "left" ? r : side === "right" ? TABLE.w - r : side === "top" ? r : TABLE.h - r;
  const along = side === "left" || side === "right" ? "x" : "y";
  const a = along === "x" ? from.x : from.y;
  const b = along === "x" ? mirror.x : mirror.y;
  // 起点与镜像点得分别落在库边两侧，中间那一下才是真的碰库
  if ((a - rail) * (b - rail) >= 0) return null;
  const k = (rail - a) / (b - a);
  const hit =
    along === "x"
      ? { x: rail, y: from.y + (mirror.y - from.y) * k }
      : { x: from.x + (mirror.x - from.x) * k, y: rail };
  const cross = along === "x" ? hit.y : hit.x;
  const span = along === "x" ? TABLE.h : TABLE.w;
  if (cross < r || cross > span - r) return null;
  for (const p of POCKETS) {
    if (dist(hit, p) < TABLE.pocketR * 1.2) return null; // 打在袋口上就直接掉进去了
  }
  return hit;
}

/** 这一段路上有没有从袋口边上蹭过去（母球顺路掉袋就白打了） */
export function clearOfPockets(from: Vec, to: Vec, keep = TABLE.pocketR): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return true;
  for (const p of POCKETS) {
    const t = ((p.x - from.x) * dx + (p.y - from.y) * dy) / (len * len);
    if (t <= 0 || t >= 1) continue;
    const px = from.x + dx * t;
    const py = from.y + dy * t;
    if (Math.hypot(p.x - px, p.y - py) < keep) return false;
  }
  return true;
}

/**
 * 一次库边反弹的候选（高手档以上才用）。
 * 两段路都要通：母球到库边那一段、库边弹出去到假想球点那一段。
 * 打分也按真实路程算——绕一大圈的库边球本来就比贴着打的难成。
 */
function bankPlans(cue: Ball, targets: readonly Ball[], balls: readonly Ball[]): PotPlan[] {
  const out: PotPlan[] = [];
  const sides: Cushion[] = ["left", "right", "top", "bottom"];
  for (const t of targets) {
    for (let pi = 0; pi < POCKETS.length; pi++) {
      const p = POCKETS[pi];
      const g = ghostPoint(t, p);
      if (g.x < 0 || g.x > TABLE.w || g.y < 0 || g.y > TABLE.h) continue;
      if (!pathClear(t, p, balls, [t.id])) continue;
      for (const side of sides) {
        const m = mirrorPoint(g, side);
        const hit = cushionHit(cue, m, side);
        if (!hit) continue;
        if (!pathClear(cue, hit, balls, [cue.id])) continue;
        if (!pathClear(hit, g, balls, [cue.id, t.id])) continue;
        if (!clearOfPockets(cue, hit) || !clearOfPockets(hit, g)) continue;
        const run = dist(cue, hit) + dist(hit, g);
        out.push({
          angle: angleTo(cue, m),
          // 库边球不用打满：路程长归长，力气一大母球自己先满台乱窜
          power: Math.min(0.78, 0.42 + run / 340),
          pocket: pi,
          targetId: t.id,
          score: 26 - run * 0.06,
          bank: true,
        });
      }
    }
  }
  return out;
}

/** 打完这一杆母球停在哪、进没进球——地狱档靠它挑走位 */
function previewShot(
  balls: readonly Ball[],
  angle: number,
  power: number
): { cuePos: Vec | null; potted: number[]; firstHit: number | null } {
  const work = cloneBalls(balls);
  const idx = work.findIndex((b) => b.kind === "cue");
  if (idx < 0) return { cuePos: null, potted: [], firstHit: null };
  work[idx] = strike(work[idx], angle, power, 0);
  const res = simulateShot({ balls: work }, { maxSeconds: 10 });
  const cue = res.balls.find((b) => b.kind === "cue");
  return {
    cuePos: cue && !cue.potted ? { x: cue.x, y: cue.y } : null,
    potted: res.potted.map((p) => p.id),
    firstHit: res.firstHitId,
  };
}

/** 安全球：软软地碰一下己组球，让母球停在离对手的球最远的地方 */
function safetyShot(ctx: AiContext, cue: Ball, targets: readonly Ball[]): AiShot {
  const rivals = ctx.balls.filter(
    (b) => !b.potted && b.kind !== "cue" && b.kind !== "black" && !targets.some((t) => t.id === b.id)
  );
  let best: AiShot | null = null;
  let bestScore = -Infinity;
  for (const t of targets) {
    for (const power of [0.16, 0.24, 0.34]) {
      const g = ghostPoint(t, { x: TABLE.w / 2, y: TABLE.h / 2 });
      const angle = angleTo(cue, g);
      const pv = previewShot(ctx.balls, angle, power);
      if (!pv.cuePos) continue; // 母球掉袋的安全球不叫安全球
      if (pv.firstHit !== t.id) continue; // 没碰到己组球就是犯规
      let score = 0;
      for (const r of rivals) {
        // 母球离对手的球越远、越挡在人家和袋口中间越好
        score += Math.min(60, dist(pv.cuePos, r)) * 0.5;
        const pk = nearestPocket(r);
        if (!pathClear(r, POCKETS[pk], [{ ...r, id: -99 }, { ...cue, ...pv.cuePos, id: -98 }], [r.id])) {
          score += 24;
        }
      }
      score -= pv.potted.length * 8; // 安全球不是为了进球
      if (score > bestScore) {
        bestScore = score;
        best = { angle, power, spin: 0, calledPocket: null, safety: true };
      }
    }
  }
  if (best) return best;
  const t = targets[0];
  return {
    angle: t ? angleTo(cue, t) : 0,
    power: 0.22,
    spin: 0,
    calledPocket: null,
    safety: true,
  };
}

/**
 * 挑一杆。rand 传确定性随机（`mulberry32`），同一个 seed 每次挑出同一杆。
 */
export function chooseShot(ctx: AiContext, tier: AiTier, rand: () => number): AiShot {
  const cue = ctx.balls.find((b) => b.kind === "cue" && !b.potted);
  const targets = legalBalls(ctx);
  if (!cue || targets.length === 0) {
    return { angle: rand() * Math.PI * 2, power: 0.4, spin: 0, calledPocket: null, safety: false };
  }

  // 菜鸟：随机角度小力气
  if (tier === 1) {
    return {
      angle: rand() * Math.PI * 2,
      power: 0.15 + rand() * 0.25,
      spin: 0,
      calledPocket: ctx.requireCall && ctx.ownCleared ? nearestPocket(targets[0]) : null,
      safety: false,
    };
  }

  // 普通：最近的己组球 + 离它最近的袋，直球
  if (tier === 2) {
    let near = targets[0];
    for (const t of targets) if (dist(cue, t) < dist(cue, near)) near = t;
    const pk = nearestPocket(near);
    const g = ghostPoint(near, POCKETS[pk]);
    return {
      angle: angleTo(cue, g) + (rand() - 0.5) * 0.02,
      power: 0.5 + rand() * 0.15,
      spin: 0,
      calledPocket: ctx.requireCall && near.kind === "black" ? pk : null,
      safety: false,
    };
  }

  // 高手 / 地狱：全台评估
  const plans = directPlans(cue, targets, ctx.balls);
  if (tier >= 3 && plans.length === 0) {
    plans.push(...bankPlans(cue, targets, ctx.balls));
  }

  if (plans.length > 0) {
    plans.sort((a, b) => b.score - a.score);
    if (tier === 3) {
      const pick = plans[0];
      return {
        angle: pick.angle + (rand() - 0.5) * 0.012,
        power: pick.power,
        spin: 0,
        calledPocket: ctx.requireCall && targetKind(ctx, pick.targetId) === "black" ? pick.pocket : null,
        safety: false,
      };
    }
    // 地狱：前几条线真试一遍，挑「进了球而且母球落点离下一颗己组球最近」的那条
    let best = plans[0];
    let bestScore = -Infinity;
    for (const plan of plans.slice(0, 6)) {
      const pv = previewShot(ctx.balls, plan.angle, plan.power);
      if (!pv.potted.includes(plan.targetId)) continue;
      if (!pv.cuePos) continue; // 进球顺带把母球送掉，不要
      let score = plan.score + 60;
      const rest = targets.filter((t) => t.id !== plan.targetId && !pv.potted.includes(t.id));
      if (rest.length > 0) {
        let nearest = Infinity;
        for (const t of rest) nearest = Math.min(nearest, dist(pv.cuePos, t));
        score -= nearest * 0.35; // 走位：下一颗越近越好
      }
      if (score > bestScore) {
        bestScore = score;
        best = plan;
      }
    }
    if (bestScore > -Infinity) {
      return {
        angle: best.angle,
        power: best.power,
        spin: 0,
        calledPocket: ctx.requireCall && targetKind(ctx, best.targetId) === "black" ? best.pocket : null,
        safety: false,
      };
    }
    return safetyShot(ctx, cue, targets);
  }

  if (tier === 4) return safetyShot(ctx, cue, targets);

  // 高手没线可打时也别空杆：软软碰一下己组球
  let near = targets[0];
  for (const t of targets) if (dist(cue, t) < dist(cue, near)) near = t;
  return {
    angle: angleTo(cue, near),
    power: 0.3,
    spin: 0,
    calledPocket: ctx.requireCall && near.kind === "black" ? nearestPocket(near) : null,
    safety: true,
  };
}

function targetKind(ctx: AiContext, id: number): string {
  return ctx.balls.find((b) => b.id === id)?.kind ?? "";
}

/** 自由球时电脑把母球放哪：放到最容易打的那颗己组球对面 */
export function aiCuePlacement(ctx: AiContext): Vec {
  const targets = legalBalls(ctx);
  if (targets.length === 0) return breakSpot();
  let best = breakSpot();
  let bestScore = -Infinity;
  for (const t of targets) {
    const pk = nearestPocket(t);
    const p = POCKETS[pk];
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    for (const back of [26, 40, 56]) {
      const cand = { x: t.x + (dx / len) * back, y: t.y + (dy / len) * back };
      if (!spotFree(cand, ctx.balls.filter((b) => b.kind !== "cue"))) continue;
      const placed = placeCueBall(ctx.balls, cand).pos;
      const score = 100 - dist(placed, t) * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = placed;
      }
    }
  }
  return best;
}
