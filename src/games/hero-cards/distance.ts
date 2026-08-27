/**
 * 英杰令 · 座位环与距离。
 *
 * 座位围成一个环,退场休息的人从环上摘掉,距离就是环上的最短步数,
 * 再算上坐骑修正:目标挂了 +1 坐骑就 +1,自己挂了 -1 坐骑就 -1,最小 1。
 * 武器只改「花瓣击」的攻击范围,不改锦囊的距离要求 —— 这一条是本作距离系统的重点。
 *
 * 全是纯函数,不认识牌也不认识技能。
 */

export interface Seat {
  id: number;
  /** 退场休息中:不占环上的位置了 */
  out?: boolean;
}

export interface Horses {
  /** 挂着 +1 坐骑的座位:别人算到他的距离 +1 */
  plus?: readonly number[];
  /** 挂着 -1 坐骑的座位:他算到别人的距离 -1 */
  minus?: readonly number[];
  /** 技能带来的额外修正:别人算到 key 的距离再 +value(闪闪的轻身) */
  extraPlus?: Readonly<Record<number, number>>;
}

/** 还在场上的座位,按环上的顺序 */
export function aliveRing(seats: readonly Seat[]): number[] {
  return seats.filter((s) => !s.out).map((s) => s.id);
}

/**
 * 不含坐骑的环上最短步数。
 * 同一个人是 0;有一边不在环上(已退场 / 不存在)返回 Infinity。
 */
export function ringDistance(from: number, to: number, seats: readonly Seat[]): number {
  if (from === to) return 0;
  const ring = aliveRing(seats);
  const a = ring.indexOf(from);
  const b = ring.indexOf(to);
  if (a < 0 || b < 0) return Number.POSITIVE_INFINITY;
  const gap = Math.abs(a - b);
  return Math.min(gap, ring.length - gap);
}

/**
 * 算好坐骑的距离。规格签名:`distance(from, to, seats, horses)`。
 * 距离最小是 1(自己到自己仍旧是 0)。
 */
export function distance(from: number, to: number, seats: readonly Seat[], horses: Horses = {}): number {
  const base = ringDistance(from, to, seats);
  if (!Number.isFinite(base) || base === 0) return base;
  let d = base;
  if (horses.plus?.includes(to)) d += 1;
  if (horses.extraPlus?.[to]) d += horses.extraPlus[to];
  if (horses.minus?.includes(from)) d -= 1;
  return Math.max(1, d);
}

/** 攻击范围:没武器是 1,挂了武器就按武器的范围来 */
export function attackRange(weaponRange?: number): number {
  return typeof weaponRange === "number" && weaponRange > 0 ? weaponRange : 1;
}

export interface RangeQuery {
  seats: readonly Seat[];
  horses?: Horses;
  /** 攻击方武器的范围;不填按 1 算 */
  weaponRange?: number;
}

/** 「花瓣击」够不够得着:攻击范围 ≥ 距离 */
export function inSlashRange(from: number, to: number, q: RangeQuery): boolean {
  if (from === to) return false;
  const d = distance(from, to, q.seats, q.horses);
  if (!Number.isFinite(d)) return false;
  return attackRange(q.weaponRange) >= d;
}

/** 锦囊的距离要求:武器一概不算数,只看坐骑 */
export function withinTrickRange(from: number, to: number, need: number, q: Omit<RangeQuery, "weaponRange">): boolean {
  if (from === to) return false;
  const d = distance(from, to, q.seats, q.horses);
  return Number.isFinite(d) && d <= need;
}

/** 每张牌各自的距离要求:0 表示不看距离,-1 表示只能选自己 */
export const TRICK_RANGE_NEED: Record<string, number> = {
  snatch: 1,
  dismantle: 0,
  duel: 0,
  borrow: 0,
  playful: 0
};
