/**
 * 长蛇争霸 · 本机 AI(四档)。
 * 所有「其他玩家」都是这里算出来的,全程离线,不开任何网络连接。
 * 决策全是纯函数:同样的输入 + 同样的随机源,结果一定一样,方便固定 seed 单测。
 */
import { SPACING, TURN_RATE, angleDelta, dist, lenToRadius, normAngle, sampleBody, steer, type Pt } from "./body";
import {
  FOOD_GAIN,
  boostStep,
  headHitsBody,
  headOnHeadOut,
  isSpent,
  shrinkZone,
  zoneDrain,
  type BodyView,
  type Orb,
  type Zone
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
  /** 看多远(像素) */
  sight: number;
  /** 避让权重 0..1,菜鸟是 0 —— 撞到人才知道要转 */
  avoid: number;
  /** 探路探多远(秒) */
  lookAhead: number;
  /** 拦头意愿 0..1 */
  cut: number;
  /** 抢掉落光点的意愿 */
  greed: number;
  /** 加速意愿 */
  boost: number;
  /** 缩圈前回中心的意愿 */
  zoneCare: number;
  /** 卡边界:对手贴着围栏时,把它回中心的那条路先占住 */
  trap: number;
  /** 随机抖动(弧度) */
  jitter: number;
}

export const AI_PARAMS: Record<AiTier, AiParams> = {
  rookie: { sight: 260, avoid: 0, lookAhead: 0.25, cut: 0, greed: 0.2, boost: 0, zoneCare: 0, trap: 0, jitter: 0.18 },
  normal: { sight: 380, avoid: 0.6, lookAhead: 0.55, cut: 0, greed: 0.7, boost: 0.15, zoneCare: 0.4, trap: 0, jitter: 0.1 },
  pro: { sight: 520, avoid: 0.85, lookAhead: 1.1, cut: 0.55, greed: 0.9, boost: 0.35, zoneCare: 0.8, trap: 0, jitter: 0.05 },
  hell: { sight: 660, avoid: 1, lookAhead: 1.3, cut: 0.95, greed: 1, boost: 0.4, zoneCare: 1, trap: 1, jitter: 0.02 }
};

export interface AiSelf {
  id: string;
  x: number;
  y: number;
  angle: number;
  length: number;
  radius: number;
}

export interface AiRival extends BodyView {
  head: Pt;
  angle: number;
  length: number;
  speed: number;
}

export interface AiView {
  self: AiSelf;
  foods: readonly Pt[];
  orbs: readonly Orb[];
  others: readonly AiRival[];
  zone: Zone | null;
  mapR: number;
  /** 地图中心 */
  cx?: number;
  cy?: number;
}

export interface AiMove {
  /** 想要朝的角度 */
  target: number;
  /** 这一帧要不要加速 */
  boost: boolean;
}

/** 固定 seed 的随机源,保证对局可复现 */
export function rng(seed: number): () => number {
  let a = (Math.round(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 一条射线上有多危险:0 是干净,1 是马上要撞。
 * 只看别人的身体和围栏,自己的身体不算(IO 型规则)。
 */
export function rayDanger(
  from: Pt,
  angle: number,
  reach: number,
  selfId: string,
  others: readonly AiRival[],
  mapR: number,
  cx = 0,
  cy = 0
): number {
  const steps = 7;
  let worst = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = from.x + Math.cos(angle) * reach * t;
    const py = from.y + Math.sin(angle) * reach * t;
    // 快撞围栏也算危险,虽然不会淘汰,但会被贴着墙切
    const edge = Math.hypot(px - cx, py - cy);
    if (edge > mapR * 0.97) worst = Math.max(worst, (1 - t) * 0.6);
    for (const o of others) {
      if (!o.alive || o.id === selfId) continue;
      const near = o.radius + 14;
      if (Math.hypot(px - o.head.x, py - o.head.y) < near + 10) worst = Math.max(worst, 1 - t * 0.5);
      for (let k = 0; k < o.nodes.length; k += 2) {
        const nd = o.nodes[k];
        if (Math.hypot(px - nd.x, py - nd.y) < near) {
          worst = Math.max(worst, 1 - t * 0.5);
          break;
        }
      }
    }
    if (worst >= 1) break;
  }
  return Math.min(1, worst);
}

/**
 * 按当前转向一直开下去,多久会撞上东西。
 * 返回 0..1:1 表示这段时间内一路干净,越小表示撞得越早。
 * 蛇是有最大角速度的,所以只看直线射线会骗自己,这里按真实的圆弧往前推。
 */
export function arcSafety(
  self: AiSelf,
  turn: number,
  sec: number,
  others: readonly AiRival[],
  mapR: number,
  cx = 0,
  cy = 0,
  speed = 170
): number {
  const steps = 12;
  const horizon = Math.max(0.05, Number.isFinite(sec) ? sec : 0.5);
  const dt = horizon / steps;
  let x = self.x;
  let y = self.y;
  let a = self.angle;
  for (let i = 1; i <= steps; i++) {
    a = normAngle(a + turn * dt);
    x += Math.cos(a) * speed * dt;
    y += Math.sin(a) * speed * dt;
    // 贴围栏不会淘汰,只是会被人堵,所以算「有点危险」而不是致命
    if (Math.hypot(x - cx, y - cy) > mapR * 0.99) return (i / steps) * 0.9;
    for (const o of others) {
      if (!o.alive || o.id === self.id) continue;
      const near = o.radius + self.radius + 5;
      if (Math.hypot(x - o.head.x, y - o.head.y) < near + 6) return i / steps;
      for (const nd of o.nodes) {
        if (Math.hypot(x - nd.x, y - nd.y) < near) return i / steps;
      }
    }
  }
  return 1;
}

/** 预测对手 sec 秒之后的位置(它保持当前朝向的话) */
export function predictHead(rival: AiRival, sec: number): Pt {
  const s = Math.max(0, Number.isFinite(sec) ? sec : 0);
  return {
    x: rival.head.x + Math.cos(rival.angle) * rival.speed * s,
    y: rival.head.y + Math.sin(rival.angle) * rival.speed * s
  };
}

function bestFood(view: AiView, p: AiParams): Pt | null {
  let best: Pt | null = null;
  let bestScore = -Infinity;
  const self = view.self;
  for (const f of view.foods) {
    const d = Math.hypot(f.x - self.x, f.y - self.y);
    if (d > p.sight) continue;
    const score = FOOD_GAIN / (d + 40);
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  for (const o of view.orbs) {
    const d = Math.hypot(o.x - self.x, o.y - self.y);
    if (d > p.sight * 1.2) continue;
    const score = (o.value * (0.4 + p.greed)) / (d + 40);
    if (score > bestScore) {
      bestScore = score;
      best = { x: o.x, y: o.y };
    }
  }
  return best;
}

/** 高手 / 地狱档的拦头:绕到对手前面,让它自己撞上来 */
export function cutTarget(view: AiView, p: AiParams): { point: Pt; rush: boolean } | null {
  if (p.cut <= 0) return null;
  const self = view.self;
  let pick: AiRival | null = null;
  let bestD = Infinity;
  for (const o of view.others) {
    if (!o.alive || o.id === self.id) continue;
    const d = Math.hypot(o.head.x - self.x, o.head.y - self.y);
    if (d > p.sight) continue;
    // 已经在身后的就别掉头去追,掉头本来也来不及
    const dir = Math.atan2(o.head.y - self.y, o.head.x - self.x);
    if (Math.abs(angleDelta(self.angle, dir)) > 1.35) continue;
    if (d < bestD) {
      bestD = d;
      pick = o;
    }
  }
  if (!pick) return null;
  // 我大概要多久才能开到它那儿,就按这个时间预测它会到哪
  const lead = Math.min(2, bestD / 170) * p.cut;
  const ahead = predictHead(pick, lead);
  // 目标是把身体横在它前面,而不是去撞它的头,所以往前多让出一段
  const off = pick.radius + self.radius + 44;
  const point = {
    x: ahead.x + Math.cos(pick.angle) * off,
    y: ahead.y + Math.sin(pick.angle) * off
  };
  // 卡边界:对手已经贴到围栏边上了,就把它回中心的那条路先占住,
  // 它要么继续贴着墙走,要么只能往我这边拐 —— 这一手只有地狱档会。
  if (p.trap > 0) {
    const cx = view.cx ?? 0;
    const cy = view.cy ?? 0;
    const edge = Math.hypot(pick.head.x - cx, pick.head.y - cy);
    const limit = view.zone ? Math.min(view.mapR, view.zone.radius) : view.mapR;
    if (edge > limit * 0.62) {
      const inward = Math.atan2(cy - pick.head.y, cx - pick.head.x);
      const w = p.trap * Math.min(1, (edge / Math.max(1, limit) - 0.62) / 0.3);
      point.x += Math.cos(inward) * off * 1.2 * w;
      point.y += Math.sin(inward) * off * 1.2 * w;
    }
  }
  // 离得远才值得花长度加速冲过去
  const rush = bestD > 170 && bestD < p.sight * 0.75;
  return { point, rush };
}

/**
 * 一帧的 AI 决策。返回它想朝的角度和要不要加速;
 * 真正的转向仍然要经过 steer() 的角速度上限,AI 也做不到瞬间掉头。
 */
export function aiSteer(view: AiView, tier: AiTier, rand: () => number = Math.random): AiMove {
  const p = AI_PARAMS[tier] ?? AI_PARAMS.normal;
  const self = view.self;
  const cx = view.cx ?? 0;
  const cy = view.cy ?? 0;

  // 1) 先定一个「想去哪」
  let desired = self.angle;
  let rush = false;
  const cut = cutTarget(view, p);
  if (cut) {
    desired = Math.atan2(cut.point.y - self.y, cut.point.x - self.x);
    rush = cut.rush && rand() < p.boost;
  } else {
    const food = bestFood(view, p);
    if (food) desired = Math.atan2(food.y - self.y, food.x - self.x);
  }

  // 2) 缩圈:圈外或者贴着圈边就往圈心挪
  if (view.zone && p.zoneCare > 0) {
    const dz = Math.hypot(self.x - view.zone.cx, self.y - view.zone.cy);
    if (dz > view.zone.radius * (1 - 0.25 * p.zoneCare)) {
      const home = Math.atan2(view.zone.cy - self.y, view.zone.cx - self.x);
      const w = Math.min(1, p.zoneCare * (dz / Math.max(1, view.zone.radius)));
      desired = normAngle(self.angle + angleDelta(self.angle, home) * w);
      if (dz > view.zone.radius) rush = rand() < p.boost + 0.4;
    }
  }

  // 3) 选一个转向:在「转得动」的范围里挑一条既安全又朝着目标的弧线
  const turns = [-1, -0.7, -0.42, -0.18, 0, 0.18, 0.42, 0.7, 1];
  let bestTurn = 0;
  let bestScore = -Infinity;
  let bestSafety = 1;
  for (const k of turns) {
    const turn = k * TURN_RATE;
    const safety =
      p.avoid > 0 ? arcSafety(self, turn, p.lookAhead, view.others, view.mapR, cx, cy) : 1;
    // 这条弧线开半个探路时间之后大概朝哪,离想去的方向差多少
    const facing = normAngle(self.angle + turn * p.lookAhead * 0.5);
    const err = Math.abs(angleDelta(facing, desired));
    // 路干净的时候几条弧线得分一样,谁也别乱躲;真出现危险了才按档位轻重反应
    const danger = 1 - safety;
    const score = -danger * danger * (2 + 8 * p.avoid) - err;
    if (score > bestScore) {
      bestScore = score;
      bestTurn = turn;
      bestSafety = safety;
    }
  }
  // 转向意图换算成一个目标角度,后面还要过 steer() 的角速度上限
  let target = normAngle(self.angle + bestTurn * 0.35);
  if (p.avoid <= 0) target = desired; // 菜鸟只会朝豆子直走,撞到人才知道要转
  // 前面确实堵着就别加速往里冲
  if (bestSafety < 0.75) rush = false;

  // 4) 抖一点点,免得看起来像机器人走直线
  if (p.jitter > 0) target = normAngle(target + (rand() - 0.5) * 2 * p.jitter);

  // 加速要掉长度,所以只有长度够富裕、前面又干净的时候才值得按
  const boost = rush && self.length > 40 && bestSafety > 0.9;
  return { target: normAngle(target), boost };
}

// ---------------------------------------------------------------------------
// 无头对局模拟:用来断言「档位越高越强」
// ---------------------------------------------------------------------------

interface SimSnake {
  id: string;
  tier: AiTier;
  x: number;
  y: number;
  angle: number;
  length: number;
  alive: boolean;
  path: Pt[];
  nodes: Pt[];
  boostAcc: number;
}

export interface DuelResult {
  winner: "a" | "b" | "draw";
  lenA: number;
  lenB: number;
  steps: number;
}

/**
 * 两条 AI 单挑一局(纯计算,不碰 DOM)。
 * 场地故意开得小,两条蛇一直在互相绕,所以胜负主要看「会不会躲、会不会拦」,
 * 而不是看谁埋头吃豆快。头撞身体就出局,都活着才比长度。
 * 两条蛇各用一条独立随机流,场地用第三条,换边不会带偏结果。
 */
export function simulateDuel(tierA: AiTier, tierB: AiTier, seed: number, maxSteps = 1800): DuelResult {
  const s0 = Math.round(seed) || 1;
  const rand = rng(s0);
  const randA = rng(s0 * 2 + 1);
  const randB = rng(s0 * 2 + 2);
  const mapR = 380;
  const dt = 1 / 30;

  const make = (id: string, tier: AiTier, ang: number): SimSnake => {
    const x = Math.cos(ang) * mapR * 0.42;
    const y = Math.sin(ang) * mapR * 0.42;
    const path: Pt[] = [];
    for (let i = 0; i < 60; i++) path.push({ x: x - Math.cos(ang + Math.PI) * i * 4, y: y - Math.sin(ang + Math.PI) * i * 4 });
    return {
      id,
      tier,
      x,
      y,
      angle: normAngle(ang + Math.PI),
      length: 24,
      alive: true,
      path,
      nodes: [],
      boostAcc: 0
    };
  };

  const a = make("a", tierA, 0);
  const b = make("b", tierB, Math.PI);
  const snakes = [a, b];

  const randOf: Record<string, () => number> = { a: randA, b: randB };

  // 安全区一路收到很小,逼着两条蛇必须在同一片地方绕,
  // 不然「谁都躲得远远的」就变成比谁吃豆快,测不出档位差别。
  let zone: Zone = { cx: 0, cy: 0, radius: mapR * 0.95 };
  const zoneSpeed = ((mapR * 0.95 - 90) / (maxSteps * dt)) * 1.05;

  const foods: Pt[] = [];
  for (let i = 0; i < 46; i++) {
    const ang = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * mapR * 0.92;
    foods.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
  }

  const rivalsFor = (me: SimSnake): AiRival[] =>
    snakes
      .filter((s) => s.id !== me.id)
      .map((s) => ({
        id: s.id,
        alive: s.alive,
        nodes: s.nodes,
        radius: lenToRadius(s.length),
        head: { x: s.x, y: s.y },
        angle: s.angle,
        length: s.length,
        speed: 170
      }));

  let steps = 0;
  for (; steps < maxSteps; steps++) {
    zone = shrinkZone(zone, dt, zoneSpeed, 90);
    // 先按同一份「帧初快照」把两条蛇的决策都算出来,再一起动。
    // 顺序更新会让后动的那条白拿半帧情报,换边测强度就不公平了。
    const moves = new Map<string, AiMove>();
    for (const s of snakes) {
      if (!s.alive) continue;
      moves.set(
        s.id,
        aiSteer(
          {
            self: { id: s.id, x: s.x, y: s.y, angle: s.angle, length: s.length, radius: lenToRadius(s.length) },
            foods,
            orbs: [],
            others: rivalsFor(s),
            zone,
            mapR,
            cx: 0,
            cy: 0
          },
          s.tier,
          randOf[s.id] ?? rand
        )
      );
    }
    for (const s of snakes) {
      if (!s.alive) continue;
      const move = moves.get(s.id) ?? { target: s.angle, boost: false };
      s.angle = steer(s.angle, move.target, dt, TURN_RATE);
      const bs = boostStep(s.length, s.boostAcc, dt * 1000, move.boost);
      s.length = bs.length;
      s.boostAcc = bs.acc;
      const speed = 170 * (bs.boosting ? 1.9 : 1);
      s.x += Math.cos(s.angle) * speed * dt;
      s.y += Math.sin(s.angle) * speed * dt;
      // 围栏不淘汰,只是被推回去
      const d = Math.hypot(s.x, s.y);
      if (d > mapR) {
        s.x = (s.x / d) * mapR;
        s.y = (s.y / d) * mapR;
      }
      // 圈外一直掉长度,掉到下限就先去休息
      s.length = zoneDrain(s.length, { x: s.x, y: s.y }, zone, dt);
      if (isSpent(s.length, { x: s.x, y: s.y }, zone)) {
        s.alive = false;
        continue;
      }
      s.path.unshift({ x: s.x, y: s.y });
      if (s.path.length > 320) s.path.length = 320;
      s.nodes = sampleBody(s.path, SPACING, Math.min(90, Math.max(4, Math.round(s.length * 0.85))));
    }

    // 吃豆也按同一份快照结算:同一颗豆两条都够得着就都算吃到,谁先动不占便宜
    for (let i = 0; i < foods.length; i++) {
      let taken = false;
      for (const s of snakes) {
        if (!s.alive) continue;
        if (Math.hypot(foods[i].x - s.x, foods[i].y - s.y) < lenToRadius(s.length) + 7) {
          s.length += FOOD_GAIN;
          taken = true;
        }
      }
      if (taken) {
        const ang = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * mapR * 0.92;
        foods[i] = { x: Math.cos(ang) * r, y: Math.sin(ang) * r };
      }
    }

    // 头对头
    if (a.alive && b.alive) {
      const ha = { id: a.id, x: a.x, y: a.y, radius: lenToRadius(a.length) };
      const hb = { id: b.id, x: b.x, y: b.y, radius: lenToRadius(b.length) };
      const both = headOnHeadOut(ha, hb);
      if (both.length === 2) {
        a.alive = false;
        b.alive = false;
        break;
      }
    }
    // 头撞身体
    const outs: string[] = [];
    for (const s of snakes) {
      if (!s.alive) continue;
      const hit = headHitsBody({ id: s.id, x: s.x, y: s.y, radius: lenToRadius(s.length) }, rivalsFor(s));
      if (hit) outs.push(s.id);
    }
    for (const id of outs) {
      const s = snakes.find((k) => k.id === id);
      if (s) s.alive = false;
    }
    if (!a.alive || !b.alive) break;
  }

  let winner: DuelResult["winner"];
  if (a.alive && !b.alive) winner = "a";
  else if (b.alive && !a.alive) winner = "b";
  else if (a.length > b.length + 0.5) winner = "a";
  else if (b.length > a.length + 0.5) winner = "b";
  else winner = "draw";

  return { winner, lenA: a.length, lenB: b.length, steps };
}

/**
 * 跑 games 局,统计 tierA / tierB 各赢几场。
 * 每隔一局换边,出生点和随机流的差异不会算到某一档头上。
 */
export function duelWins(
  tierA: AiTier,
  tierB: AiTier,
  games = 20,
  seed0 = 20240612
): { a: number; b: number; draw: number } {
  let a = 0;
  let b = 0;
  let draw = 0;
  for (let i = 0; i < games; i++) {
    const swap = i % 2 === 1;
    const r = simulateDuel(swap ? tierB : tierA, swap ? tierA : tierB, seed0 + i * 7919);
    const winnerIsA = swap ? r.winner === "b" : r.winner === "a";
    const winnerIsB = swap ? r.winner === "a" : r.winner === "b";
    if (winnerIsA) a++;
    else if (winnerIsB) b++;
    else draw++;
  }
  return { a, b, draw };
}

/** 给 HUD 用的档位说明 */
export function tierBlurb(tier: AiTier): string {
  switch (tier) {
    case "rookie":
      return "菜鸟:只顾着吃豆,撞到人才会转。";
    case "normal":
      return "普通:会绕开别人的身体,也会抢掉落的光点。";
    case "pro":
      return "高手:会算你一秒后在哪,提前切到你前面。";
    default:
      return "地狱:会绕圈、会诱你加速,还会贴着围栏堵你。";
  }
}

export { dist };
