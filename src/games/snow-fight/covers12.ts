/**
 * 雪球大作战 1.2 · 三种掩体(纯函数,判定全在这里,画面只管照着画)。
 *
 *  - 雪墙 `wall`:砸三下就碎。碎了视野通了,但你也没地方躲了;
 *  - 木箱 `crate`:砸不碎,但每砸一下会被推着挪一点——可以一路把它推到想要的位置,
 *    也可能被对手推到你面前挡住自己的视线;
 *  - 雪坡 `slope`:挡不住站着的人,**蹲下**才半隐藏——一半的雪球会顺着坡面滑过去。
 *    「蹲下搓雪」和「蹲下躲」共用同一个动作,这是本款节奏的关键:
 *    搓雪的时候最安全,但搓雪的时候扔不出去。
 *
 * 伪纵深:掩体分近排 `row 0` 与远排 `row 1`。远排整体抬高 `ROW_LIFT`、画得小,
 * 判定也更严(见 `rowHitScale`)——低平的一发会从远排掩体底下穿过去,
 * 高抛的一发才会被它挡下来。不做真 3D。
 */

export type CoverKind = "wall" | "crate" | "slope";

/** 雪墙的耐久:砸三下碎 */
export const WALL_HP = 3;
/** 木箱被砸一下最多挪多远 */
export const CRATE_PUSH = 0.9;
/** 蹲在雪坡后面,对手的雪球有多大比例会滑过去(0.5 = 半隐藏) */
export const SLOPE_HIDE = 0.5;
/** 远排整体抬高多少个单位(画面上就是「更远、更高、更小」) */
export const ROW_LIFT = 1.8;
/** 远排的判定半径按这个比例收紧 */
export const FAR_HIT_SCALE = 0.7;

export interface Cover12 {
  id: number;
  kind: CoverKind;
  /** 左边缘 */
  x: number;
  w: number;
  /** 从自己那一排的地面往上多高 */
  h: number;
  hp: number;
  maxHp: number;
  /** 0 = 近排,1 = 远排 */
  row: 0 | 1;
}

export interface CoverSpec12 {
  kind: CoverKind;
  x: number;
  w: number;
  h: number;
  row?: 0 | 1;
  hp?: number;
}

/** 这一排的地面在哪儿 */
export function rowBase(row: 0 | 1): number {
  return row === 1 ? ROW_LIFT : 0;
}

/** 这一排的判定半径倍率:远排更严 */
export function rowHitScale(row: 0 | 1): number {
  return row === 1 ? FAR_HIT_SCALE : 1;
}

export function defaultHp(kind: CoverKind): number {
  if (kind === "wall") return WALL_HP;
  // 木箱砸不碎、雪坡是地形,都用一个永远减不到 0 的耐久表示
  return Infinity;
}

export function makeCover(spec: CoverSpec12, id: number): Cover12 {
  const hp = spec.hp ?? defaultHp(spec.kind);
  return {
    id,
    kind: spec.kind,
    x: spec.x,
    w: spec.w,
    h: spec.h,
    hp,
    maxHp: hp,
    row: spec.row ?? 0,
  };
}

/** 掩体占的那块方框(已经算进这一排的抬高) */
export function coverBox(c: Cover12): { x0: number; x1: number; y0: number; y1: number } {
  const base = rowBase(c.row);
  return { x0: c.x, x1: c.x + c.w, y0: base, y1: base + c.h };
}

/**
 * 一颗雪球撞上这个掩体了吗?
 * 雪坡是个斜面:越靠外侧越矮,所以擦着顶上过去的雪球能飞走。
 */
export function blocksBall(c: Cover12, p: { x: number; y: number }, ballR = 0.5): boolean {
  const box = coverBox(c);
  if (p.x < box.x0 - ballR || p.x > box.x1 + ballR) return false;
  if (p.y > box.y1 + ballR || p.y < box.y0 - ballR) return false;
  if (c.kind !== "slope") return true;
  // 雪坡从左到右由矮到高,过了坡顶就是背风面
  const k = (p.x - box.x0) / Math.max(0.0001, c.w);
  return p.y <= box.y0 + c.h * Math.min(1, Math.max(0, k));
}

export interface CoverHit {
  cover: Cover12;
  /** 砸碎了没有(只有雪墙会碎) */
  broke: boolean;
  /** 被推着挪了多远(只有木箱会动,正数向右) */
  pushed: number;
}

/**
 * 一发雪球砸上来的结果。
 * 不改传进来的对象:返回一个新的掩体,推不动 / 砸不碎就原样返回。
 */
export function hitCover(
  c: Cover12,
  impact: { dir: 1 | -1; speed: number },
  bounds: { min: number; max: number } = { min: 0, max: 60 }
): CoverHit {
  if (c.kind === "wall") {
    const hp = c.hp - 1;
    return { cover: { ...c, hp: Math.max(0, hp) }, broke: hp <= 0, pushed: 0 };
  }
  if (c.kind === "crate") {
    const step = CRATE_PUSH * speedRatio(impact.speed);
    const wantX = c.x + step * impact.dir;
    const x = Math.max(bounds.min, Math.min(bounds.max - c.w, wantX));
    return { cover: { ...c, x }, broke: false, pushed: x - c.x };
  }
  return { cover: c, broke: false, pushed: 0 };
}

/** 雪球飞多快才算「推得动木箱」:慢悠悠的一发只是啪一声 */
export function speedRatio(speed: number): number {
  return Math.max(0, Math.min(1, (speed - 8) / 24));
}

/**
 * 这个人躲在这个掩体后面吗?
 * 雪墙 / 木箱:站在它背后就挡得住(挡住的是「对面来的雪球」,方向由 `from` 给)。
 * 雪坡:只有**蹲下**才半隐藏。
 */
export function hidesFighter(
  c: Cover12,
  who: { x: number; crouching: boolean },
  from: 1 | -1
): number {
  const box = coverBox(c);
  const behind = from === 1 ? who.x > box.x1 : who.x < box.x0;
  if (!behind) return 0;
  const near = Math.abs(who.x - (from === 1 ? box.x1 : box.x0));
  if (near > 3.2) return 0;
  if (c.kind === "slope") return who.crouching ? SLOPE_HIDE : 0;
  // 雪墙 / 木箱:蹲下时整个人缩到掩体后面,站着只挡住下半身
  return who.crouching ? 1 : 0.35;
}

/** 把一串掩体的遮蔽度合成一个 0..1(取最好的那一处,不叠加) */
export function coverAt(
  covers: readonly Cover12[],
  who: { x: number; crouching: boolean },
  from: 1 | -1
): number {
  let best = 0;
  for (const c of covers) best = Math.max(best, hidesFighter(c, who, from));
  return best;
}

/** 碎掉的雪墙要从场上拿走 */
export function isGone(c: Cover12): boolean {
  return c.kind === "wall" && c.hp <= 0;
}
