/**
 * 长蛇争霸 · 规则纯函数。
 * 加速掉长度、头撞身体、头对头、掉落光点、围圈奖励、缩圈、排行榜,
 * 全部不依赖 DOM,单测可以直接调。
 */
import { MIN_LEN, dist, lenToRadius, type Pt } from "./body";

/** 加速时速度倍率 */
export const BOOST_MUL = 1.9;
/** 每这么多毫秒扣一次长度 */
export const BOOST_TICK = 120;
/** 每次扣多少长度 */
export const BOOST_COST = 1;
/** 加速掉下来的光点值多少 */
export const BOOST_ORB = 0.8;
/** 吃到一颗星光豆加多少长度 */
export const FOOD_GAIN = 1;
/** 淘汰掉落总量 = 长度 × 这个比例 */
export const DROP_RATE = 0.72;
/** 一串掉落最多摆几颗,免得一次刷太多 */
export const DROP_MAX = 26;
/** 头对头的处理方式:两条都先去休息(写死并单测,避免两种规则混用) */
export const HEAD_ON_HEAD_RULE = "both" as const;
/** 一次拦下几条才算「绕出一个圈」 */
export const MULTI_KILL_MIN = 2;
/** 围圈奖励:每多拦一条额外给多少长度 */
export const MULTI_KILL_BONUS = 6;
/** 安全区是连续收的(不做台阶,免得画面瞬变),每隔这么多秒提醒一次 */
export const ZONE_PERIOD = 12;
/** 圈外每秒掉多少长度 */
export const ZONE_DRAIN = 4.5;
/** 长度变化的 tween 速度(每秒补多少),挡住「长度瞬跳」 */
export const GROW_RATE = 26;

function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

export interface Orb {
  id: string;
  x: number;
  y: number;
  value: number;
}

export interface HeadView {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface BodyView {
  id: string;
  alive: boolean;
  /** 等距节点,nodes[0] 靠近头 */
  nodes: readonly Pt[];
  radius: number;
}

export interface Zone {
  cx: number;
  cy: number;
  radius: number;
}

export interface BoostOut {
  length: number;
  acc: number;
  /** 这一帧要不要在尾巴掉一颗光点 */
  drop: boolean;
  /** 实际有没有加上速 */
  boosting: boolean;
}

/** 长度到下限就加不动了,这是保护不是卡住 */
export function canBoost(length: number): boolean {
  return finite(length, 0) > MIN_LEN;
}

/**
 * 加速一帧:按住就提速,每 BOOST_TICK 毫秒掉 BOOST_COST 长度并吐一颗光点。
 */
export function boostStep(length: number, acc: number, dtMs: number, want: boolean): BoostOut {
  const len0 = Math.max(0, finite(length, 0));
  if (!want || !canBoost(len0)) return { length: len0, acc: 0, drop: false, boosting: false };
  let len = len0;
  let a = Math.max(0, finite(acc, 0)) + Math.max(0, finite(dtMs, 0));
  let drop = false;
  while (a >= BOOST_TICK && len > MIN_LEN) {
    a -= BOOST_TICK;
    len = Math.max(MIN_LEN, len - BOOST_COST);
    drop = true;
  }
  if (len <= MIN_LEN) a = 0;
  return { length: len, acc: a, drop, boosting: true };
}

/** 加速时的速度倍率 */
export function boostMul(boosting: boolean): number {
  return boosting ? BOOST_MUL : 1;
}

/**
 * 长度平滑跟到目标值:一帧最多补 GROW_RATE * dt,所以看得见「慢慢变长」。
 */
export function tweenLength(shown: number, target: number, dt: number): number {
  const from = Math.max(0, finite(shown, 0));
  const to = Math.max(0, finite(target, 0));
  const step = GROW_RATE * Math.max(0, finite(dt, 0));
  if (Math.abs(to - from) <= step) return to;
  return from + Math.sign(to - from) * step;
}

/**
 * 头撞到别人身体 → 自己被淘汰。这是唯一的淘汰方式。
 * 自己的身体不判定,已经休息的蛇也不判定。
 * 返回撞到的那条蛇 id,没撞到返回 null。
 */
export function headHitsBody(head: HeadView, snakes: readonly BodyView[]): string | null {
  const hr = Math.max(0, finite(head.radius, 0));
  for (const s of snakes) {
    if (!s.alive) continue;
    if (s.id === head.id) continue; // 自己的身体永远安全
    const reach = hr + Math.max(0, finite(s.radius, 0));
    for (const nd of s.nodes) {
      if (dist({ x: head.x, y: head.y }, nd) < reach) return s.id;
    }
  }
  return null;
}

/** 两个头是不是撞在一起了 */
export function headOnHead(a: HeadView, b: HeadView): boolean {
  if (a.id === b.id) return false;
  const reach = Math.max(0, finite(a.radius, 0)) + Math.max(0, finite(b.radius, 0));
  return dist({ x: a.x, y: a.y }, { x: b.x, y: b.y }) < reach;
}

/** 头对头的结果:按 HEAD_ON_HEAD_RULE,两条一起先去休息 */
export function headOnHeadOut(a: HeadView, b: HeadView): string[] {
  if (!headOnHead(a, b)) return [];
  return [a.id, b.id];
}

/**
 * 淘汰掉落:沿身体轨迹摆一串高价值光点,总量 ≈ 长度 × DROP_RATE。
 */
export function dropOrbs(nodes: readonly Pt[], length: number, idPrefix = "d", rate = DROP_RATE): Orb[] {
  const len = Math.max(0, finite(length, 0));
  const total = len * Math.max(0, finite(rate, DROP_RATE));
  if (total <= 0 || nodes.length === 0) return [];
  const count = Math.max(1, Math.min(DROP_MAX, nodes.length));
  const stride = nodes.length / count;
  const each = total / count;
  const out: Orb[] = [];
  for (let i = 0; i < count; i++) {
    const nd = nodes[Math.min(nodes.length - 1, Math.floor(i * stride))];
    out.push({ id: `${idPrefix}${i}`, x: finite(nd.x, 0), y: finite(nd.y, 0), value: each });
  }
  return out;
}

/** 掉落总量,给测试和 HUD 用 */
export function orbTotal(orbs: readonly Orb[]): number {
  return orbs.reduce((s, o) => s + Math.max(0, finite(o.value, 0)), 0);
}

/**
 * 围圈奖励:一次拦下 ≥ 2 条才给,文案是原创的「绕出一个圈啦」。
 */
export function multiKillBonus(count: number): { bonus: number; text: string } {
  const n = Math.max(0, Math.round(finite(count, 0)));
  if (n < MULTI_KILL_MIN) return { bonus: 0, text: "" };
  return {
    bonus: MULTI_KILL_BONUS * (n - 1),
    text: `绕出一个圈啦！一口气拦下 ${n} 条`
  };
}

/** 安全区缩一帧 */
export function shrinkZone(zone: Zone, dt: number, speed: number, minR = 180): Zone {
  const step = Math.max(0, finite(speed, 0)) * Math.max(0, finite(dt, 0));
  return { cx: zone.cx, cy: zone.cy, radius: Math.max(minR, finite(zone.radius, minR) - step) };
}

/** 在不在安全区里 */
export function insideZone(p: Pt, zone: Zone | null): boolean {
  if (!zone) return true;
  return dist(p, { x: zone.cx, y: zone.cy }) <= zone.radius;
}

/** 圈外每秒掉长度,掉到下限就该「先去休息」 */
export function zoneDrain(length: number, p: Pt, zone: Zone | null, dt: number): number {
  const len = Math.max(0, finite(length, 0));
  if (insideZone(p, zone)) return len;
  return Math.max(MIN_LEN, len - ZONE_DRAIN * Math.max(0, finite(dt, 0)));
}

/** 掉到下限并且还在圈外,就判「先去休息」 */
export function isSpent(length: number, p: Pt, zone: Zone | null): boolean {
  return finite(length, 0) <= MIN_LEN && !insideZone(p, zone);
}

export interface LeaderRow {
  id: string;
  name: string;
  length: number;
}

export interface RankInput {
  id: string;
  name: string;
  length: number;
  alive: boolean;
}

/** 按长度排,长度一样按 id 稳定排,保证同样输入永远同样顺序 */
export function leaderboard(snakes: readonly RankInput[], top = 10): LeaderRow[] {
  return snakes
    .filter((s) => s.alive)
    .map((s) => ({ id: s.id, name: s.name, length: Math.max(0, finite(s.length, 0)) }))
    .sort((a, b) => (b.length !== a.length ? b.length - a.length : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, Math.max(0, Math.round(top)));
}

/** 我排第几(1 基);已经休息的返回 0 */
export function rankOf(snakes: readonly RankInput[], id: string): number {
  const all = leaderboard(snakes, snakes.length);
  const i = all.findIndex((r) => r.id === id);
  return i < 0 ? 0 : i + 1;
}

/** 结算文案:赢了夸,输了也只鼓励,不写任何吓人的词 */
export function runLine(won: boolean, rank: number, length: number): string {
  const len = Math.round(Math.max(0, finite(length, 0)));
  if (won) return `第 ${Math.max(1, Math.round(rank))} 名 · 长度 ${len},这条长蛇绕得真漂亮！`;
  return `长蛇打了个盹,下一局再长大！这次长度 ${len},第 ${Math.max(1, Math.round(rank))} 名。`;
}

/** HUD 上「我」的那一行 */
export function selfLine(rank: number, length: number): string {
  return `第 ${Math.max(1, Math.round(rank))} 名 · 长度 ${Math.round(Math.max(0, finite(length, 0)))}`;
}

/** 半径换算再导出一次,方便玩法层只 import 一处 */
export { lenToRadius };
