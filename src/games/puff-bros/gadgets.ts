/**
 * 噗噗兄弟 · 关卡机关层(纯数据 + 纯函数,不认识世界也不认识 DOM)。
 *
 * 1.1 的场地里只有一种东西:单向浮台。188 关从头到尾就是「浮台更密、怪更快」,
 * 后段并没有新东西可学。1.2 补五种机关,每一种都只教一件事:
 *
 *  | 机关 | 教什么 |
 *  | --- | --- |
 *  | `updraft` 气流管 | 掉进这股上升气流里就慢慢飘,借它够到跳不上去的地方 |
 *  | `crate` 可推箱 | 走过去顶、或者对着它噗一口,把它推到该在的位置 |
 *  | `brittle` 脆弱地板 | 踩第一下先裂(看得见裂纹),再踩就碎,得抓紧走 |
 *  | `spring` 弹簧云 | 踩上去弹得老高,比二段跳还高一截 |
 *  | `warp` 传送泡 | 站上去按 ⬇ 咻地飞到配对的那一颗那儿 |
 *
 * 这一层刻意不认识 `arena.ts`:所有跟地面有关的高度都由调用方算好传进来,
 * 于是 `arena.ts` 可以放心 import 本文件而不绕成环。
 */

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

export type GadgetKind = "updraft" | "crate" | "brittle" | "spring" | "warp";

/** 五种机关,顺序即教学顺序 */
export const GADGET_KINDS: GadgetKind[] = ["updraft", "crate", "brittle", "spring", "warp"];

/** 气流管:管口宽度与默认管高 */
export const UPDRAFT_W = 44;
export const UPDRAFT_H = 132;
/** 管子里的上托加速度;它大于重力,所以人在管子里是往上飘的 */
export const UPDRAFT_ACCEL = 3050;
/** 但飘得再快也就这么快,不会一路顶到天花板贴着不下来 */
export const UPDRAFT_MAX_UP = 235;

/** 可推箱的尺寸 */
export const CRATE_W = 30;
export const CRATE_H = 28;
/** 走过去顶箱子的速度(慢慢挪,不是一脚踢飞) */
export const CRATE_WALK_PUSH = 86;
/** 箱子在地上滑行的减速(px/s²) */
export const CRATE_FRICTION = 460;
/** 箱子的下落加速度(比人轻飘一点,看得清) */
export const CRATE_GRAVITY = 1450;

/** 脆弱地板的尺寸 */
export const BRITTLE_W = 78;
export const BRITTLE_H = 10;
/** 踩几下碎:第一下裂(预警),第二下碎 */
export const BRITTLE_CRACKS = 2;
/** 碎掉之后多久重新长回来 —— 不长回来的话回头路就断了 */
export const BRITTLE_REGROW = 4.5;

/** 弹簧云的尺寸与弹力 */
export const SPRING_W = 58;
export const SPRING_H = 12;
export const SPRING_V = 880;
/** 弹一下之后云要蓄一小会儿,免得贴着它连弹好几回 */
export const SPRING_RECHARGE = 0.35;
/**
 * 落到云上的速度得有这么快才弹得起来。
 * 走过去只是踩在云上,不会莫名其妙被弹飞 —— 想弹就得先跳起来再落下去。
 */
export const SPRING_MIN_VY = 140;

/** 传送泡的半径与传送之后的冷却(防止两颗来回弹) */
export const WARP_R = 20;
export const WARP_CD = 0.9;

// ---------------------------------------------------------------------------
// 数据
// ---------------------------------------------------------------------------

export interface GadgetDef {
  kind: GadgetKind;
  /** 中心 x */
  x: number;
  /** 参考高度:气流管是**管底**,其余都是**上表面** */
  y: number;
  /** 横向尺寸 */
  w: number;
  /** 气流管的管高;其它机关用自己的固定厚度 */
  h: number;
  /** 脚下那块地面(-1 是地板)。脆弱地板碎掉以后人就落到这儿 */
  under: number;
  /** 传送泡配对的另一颗在 gadgets 里的下标;其它机关恒为 -1 */
  link: number;
}

export interface GadgetState {
  def: GadgetDef;
  /** 可推箱当前的位置与速度(其它机关就停在 def 上) */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 脆弱地板已经被踩了几下 */
  cracks: number;
  /** 碎掉之后重新长出来的倒计时;>0 表示这会儿是空的 */
  regrow: number;
  /** 弹簧云的蓄力倒计时 */
  recharge: number;
  /** 刚被用过的高亮计时(渲染层用) */
  flash: number;
  /** 每位玩家各自的传送冷却 */
  warpCd: number[];
}

export function newGadget(def: GadgetDef): GadgetState {
  return {
    def,
    x: def.x,
    y: def.y,
    vx: 0,
    vy: 0,
    cracks: 0,
    regrow: 0,
    recharge: 0,
    flash: 0,
    warpCd: [0, 0],
  };
}

/** 造一个机关定义,只写关心的字段,其余按种类取默认值 */
export function gadget(kind: GadgetKind, x: number, y: number, over: Partial<GadgetDef> = {}): GadgetDef {
  const size: Record<GadgetKind, { w: number; h: number }> = {
    updraft: { w: UPDRAFT_W, h: UPDRAFT_H },
    crate: { w: CRATE_W, h: CRATE_H },
    brittle: { w: BRITTLE_W, h: BRITTLE_H },
    spring: { w: SPRING_W, h: SPRING_H },
    warp: { w: WARP_R * 2, h: WARP_R * 2 },
  };
  return { kind, x, y, w: size[kind].w, h: size[kind].h, under: -1, link: -1, ...over };
}

// ---------------------------------------------------------------------------
// 几何
// ---------------------------------------------------------------------------

export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** 机关占的那块矩形(可推箱按当前位置算) */
export function gadgetRect(g: GadgetState): Rect {
  const d = g.def;
  if (d.kind === "updraft") {
    return { x0: d.x - d.w / 2, x1: d.x + d.w / 2, y0: d.y - d.h, y1: d.y };
  }
  if (d.kind === "crate") {
    return { x0: g.x - d.w / 2, x1: g.x + d.w / 2, y0: g.y - d.h, y1: g.y };
  }
  if (d.kind === "warp") {
    return { x0: d.x - WARP_R, x1: d.x + WARP_R, y0: d.y - WARP_R * 2, y1: d.y };
  }
  return { x0: d.x - d.w / 2, x1: d.x + d.w / 2, y0: d.y - d.h, y1: d.y };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

// ---------------------------------------------------------------------------
// 气流管
// ---------------------------------------------------------------------------

/** (x, y) 在不在这根管子的气流里 */
export function inUpdraft(g: GadgetState, x: number, y: number): boolean {
  if (g.def.kind !== "updraft") return false;
  const r = gadgetRect(g);
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/**
 * 管子里这一子步之后的竖直速度。
 * 上托加速度大于重力,所以人会往上飘;但飘到 UPDRAFT_MAX_UP 就封顶,
 * 于是最高只会浮到管口附近,不会一路怼到天花板卡住。
 */
export function updraftVy(vy: number, dt: number): number {
  const next = vy - UPDRAFT_ACCEL * dt;
  return Math.max(next, -UPDRAFT_MAX_UP);
}

// ---------------------------------------------------------------------------
// 脆弱地板
// ---------------------------------------------------------------------------

export type BrittlePhase = "solid" | "cracked" | "gone";

/** 脆弱地板现在是完好、已经裂了,还是碎掉了 */
export function brittlePhase(g: GadgetState): BrittlePhase {
  if (g.regrow > 0) return "gone";
  return g.cracks >= 1 ? "cracked" : "solid";
}

/** 这会儿踩得住吗 */
export function brittleSolid(g: GadgetState): boolean {
  return g.def.kind === "brittle" && g.regrow <= 0;
}

/**
 * 记一下「有人踩上来了」。第一下只裂出纹路当预警,踩满 BRITTLE_CRACKS 下才碎。
 * 返回 true 表示这一下把它踩碎了。
 */
export function stepOnBrittle(g: GadgetState): boolean {
  if (!brittleSolid(g)) return false;
  g.cracks++;
  g.flash = 0.35;
  if (g.cracks < BRITTLE_CRACKS) return false;
  g.regrow = BRITTLE_REGROW;
  g.cracks = 0;
  return true;
}

// ---------------------------------------------------------------------------
// 弹簧云
// ---------------------------------------------------------------------------

/** 弹簧云这会儿弹得动吗(落得够快 + 云已经蓄好力) */
export function springReady(g: GadgetState, vy = SPRING_MIN_VY): boolean {
  return g.def.kind === "spring" && g.recharge <= 0 && vy >= SPRING_MIN_VY;
}

/** 踩上去弹一下,返回弹出去的竖直速度(负数是往上) */
export function bounceOffSpring(g: GadgetState): number {
  g.recharge = SPRING_RECHARGE;
  g.flash = 0.3;
  return -SPRING_V;
}

/** 弹簧云弹得比二段跳还高一截,不然它就白摆了 */
export function springApex(gravity: number): number {
  return (SPRING_V * SPRING_V) / (2 * gravity);
}

// ---------------------------------------------------------------------------
// 传送泡
// ---------------------------------------------------------------------------

/** 人站在这颗传送泡上没有(脚底中点落在泡里就算) */
export function onWarp(g: GadgetState, x: number, y: number): boolean {
  if (g.def.kind !== "warp") return false;
  return Math.abs(x - g.def.x) <= WARP_R && Math.abs(y - g.def.y) <= WARP_R;
}

/** 这颗传送泡配对的那一颗;没配对就返回 null */
export function warpPartner(list: readonly GadgetState[], index: number): GadgetState | null {
  const g = list[index];
  if (!g || g.def.kind !== "warp") return null;
  const other = list[g.def.link];
  if (!other || other.def.kind !== "warp") return null;
  return other;
}

/** 传送之后两头都要挂上冷却,免得来回弹个没完 */
export function noteWarp(a: GadgetState, b: GadgetState, player: number): void {
  a.warpCd[player] = WARP_CD;
  b.warpCd[player] = WARP_CD;
  a.flash = 0.35;
  b.flash = 0.35;
}

// ---------------------------------------------------------------------------
// 可推箱
// ---------------------------------------------------------------------------

/** 有人走过来顶箱子:给它一个慢慢挪的速度(dir 是顶的方向) */
export function shoveCrate(g: GadgetState, dir: 1 | -1): void {
  if (g.def.kind !== "crate") return;
  if (Math.abs(g.vx) >= CRATE_WALK_PUSH) return;
  g.vx = dir * CRATE_WALK_PUSH;
}

/**
 * 箱子自己走一子步:横着滑、竖着落。
 * `groundY` 是这一列脚下最近那块地面的上表面,由调用方算好传进来。
 */
export function stepCrate(g: GadgetState, dt: number, groundY: number, lo: number, hi: number): void {
  if (g.def.kind !== "crate") return;
  g.x += g.vx * dt;
  if (g.x < lo) {
    g.x = lo;
    g.vx = 0;
  } else if (g.x > hi) {
    g.x = hi;
    g.vx = 0;
  }
  const drag = CRATE_FRICTION * dt;
  if (Math.abs(g.vx) <= drag) g.vx = 0;
  else g.vx -= Math.sign(g.vx) * drag;

  g.vy += CRATE_GRAVITY * dt;
  g.y += g.vy * dt;
  if (g.y >= groundY) {
    g.y = groundY;
    g.vy = 0;
  }
}

// ---------------------------------------------------------------------------
// 统一推进
// ---------------------------------------------------------------------------

/** 扣掉所有机关身上的各种计时器(箱子的位移另走 stepCrate) */
export function tickGadget(g: GadgetState, dt: number): void {
  if (g.regrow > 0) g.regrow = Math.max(0, g.regrow - dt);
  if (g.recharge > 0) g.recharge = Math.max(0, g.recharge - dt);
  if (g.flash > 0) g.flash = Math.max(0, g.flash - dt);
  for (let i = 0; i < g.warpCd.length; i++) {
    if (g.warpCd[i] > 0) g.warpCd[i] = Math.max(0, g.warpCd[i] - dt);
  }
}

/** 一句话说明,给关卡提示语和攻略共用 */
export const GADGET_BLURB: Record<GadgetKind, string> = {
  updraft: "气流管:掉进这股上升气流里就会慢慢往上飘,借它够到跳不上去的地方。",
  crate: "可推箱:走过去顶一顶,或者对着它噗一口,就能把箱子推到别处。",
  brittle: "脆弱地板:踩第一下会裂开一道纹,再踩一下就碎啦,看到裂纹就快走。",
  spring: "弹簧云:软软的一朵,踩上去会把你弹得老高。",
  warp: "传送泡:站在泡上按 ⬇,咻地一下就飞到另一颗泡那儿。",
};
