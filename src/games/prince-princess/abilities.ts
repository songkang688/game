/**
 * 王子公主大冒险 · 两位主角的专属能力(纯函数,不碰 DOM,也不碰世界状态)。
 *
 * 1.1 里两个人的区别只有「近战 / 远程」和「一段跳 / 二段跳」,
 * 而且关卡几何一律按跳得最矮的王子卡,所以公主的二段跳**从来不是必需的**——
 * 说白了是半个换皮。1.2 给两个人各补一个**别人做不到的动作**:
 *
 *  - 公主 · 滑翔:在空中按住跳键,最多飘 **2 秒**,降速到 `GLIDE_FALL_SPEED`。
 *    王子按住不会有任何反应。滑翔额度落地就满,和二段跳各算各的。
 *  - 王子 · 推重物:重箱子只有他推得动,推速比走路慢。
 *    公主推不动,但箱子只有 `BLOCK_H` 那么高,她跳上去、跳过去都行——**永远不会把人卡死**。
 *    箱子推进断口会掉下去架成一座桥,两个人都能从上面走过。
 *
 * 「交替关」就是靠这两样搭出来的:重箱子后面的龛里一颗宝石(只有王子拿得到),
 * 高台上一颗宝石只有滑翔够得着(只有公主拿得到),两颗都收齐才是三星。
 * 单人模式按 Tab / 点 🔁 换人,一个人也玩得全。
 */
import type { HeroKind } from "./logic";

// ---------------------------------------------------------------------------
// 公主 · 滑翔
// ---------------------------------------------------------------------------

/** 一次腾空最多能滑多久(秒) */
export const GLIDE_MAX_TIME = 2;
/** 滑翔时的下落速度(px/s);正常自由落体到这时候早就三四百了 */
export const GLIDE_FALL_SPEED = 96;
/** 慢到这个速度以下就不算在滑(免得刚起跳的上升段也被算进去) */
export const GLIDE_MIN_FALL = 12;

export interface GlideState {
  /** 这次腾空还剩多少滑翔额度(秒) */
  left: number;
  /** 这一帧是不是真的在滑 */
  active: boolean;
}

export function freshGlide(): GlideState {
  return { left: GLIDE_MAX_TIME, active: false };
}

/** 只有公主会滑翔 */
export function canGlide(kind: HeroKind): boolean {
  return kind === "princess";
}

export interface GlideInput {
  kind: HeroKind;
  onGround: boolean;
  /** 按住跳键没有 */
  holding: boolean;
  vy: number;
  dt: number;
}

/**
 * 算这一帧滑不滑、滑完之后的下落速度和剩余额度。
 *
 * 纯函数:进什么出什么,不改传进来的 state。
 * 落地(`onGround`)那一下额度加满——所以「跳一下滑两秒、落地再跳」是允许的,
 * 「一次腾空滑四秒」不行。
 */
export function glideStep(state: GlideState, input: GlideInput): { vy: number; glide: GlideState } {
  if (input.onGround) return { vy: input.vy, glide: { left: GLIDE_MAX_TIME, active: false } };
  const ok =
    canGlide(input.kind) && input.holding && input.vy > GLIDE_MIN_FALL && state.left > 0;
  if (!ok) return { vy: input.vy, glide: { left: state.left, active: false } };
  const used = Math.min(state.left, input.dt);
  return {
    vy: Math.min(input.vy, GLIDE_FALL_SPEED),
    glide: { left: Math.max(0, state.left - used), active: true },
  };
}

/** 滑翔额度还剩几成(HUD 上那根小羽毛条) */
export function glideFraction(state: GlideState): number {
  return Math.max(0, Math.min(1, state.left / GLIDE_MAX_TIME));
}

// ---------------------------------------------------------------------------
// 王子 · 推重物
// ---------------------------------------------------------------------------

/** 重箱子的边长 */
export const BLOCK_W = 46;
/** 重箱子的高:必须明显低于公主的一段跳,不然推不动的人会被卡死 */
export const BLOCK_H = 34;
/** 推着走的速度(px/s),比正常走路慢一截,推起来有分量 */
export const PUSH_SPEED = 96;
/**
 * 箱子掉进断口、落到这么深就卡住架成一座桥。
 * 正好等于箱高,所以桥面和地面齐平,走上去不会一脚踩空。
 */
export const BLOCK_SETTLE_DEPTH = BLOCK_H;

/** 只有王子推得动 */
export function canPush(kind: HeroKind): boolean {
  return kind === "prince";
}

export interface BlockState {
  /** 箱子中心 x */
  x: number;
  /** 箱子底面 y(地面是 0,掉进断口是正数) */
  y: number;
  vy: number;
  /** 掉进断口落了底,变成一座桥,不能再推 */
  bridge: boolean;
}

export function blockBox(b: BlockState): { x0: number; x1: number; y0: number; y1: number } {
  return { x0: b.x - BLOCK_W / 2, x1: b.x + BLOCK_W / 2, y0: b.y - BLOCK_H, y1: b.y };
}

/** 架成桥之后,这一段 x 就变成实地了 */
export function bridgeSpan(b: BlockState): { x0: number; x1: number } | null {
  if (!b.bridge) return null;
  return { x0: b.x - BLOCK_W / 2, x1: b.x + BLOCK_W / 2 };
}

/**
 * 推一下箱子:返回箱子的新 x 和推箱子的人被限到多快。
 *
 * `dir` 是人想走的方向(-1 / 0 / 1),`heroX` 是人的脚底中点。
 * 推不动的人(公主)返回 `pushed: false`,`limit` 为 0 —— 调用方据此把人挡在箱子外面。
 */
export function pushStep(
  b: BlockState,
  hero: { kind: HeroKind; x: number },
  dir: -1 | 0 | 1,
  dt: number
): { x: number; pushed: boolean; limit: number } {
  if (b.bridge || dir === 0) return { x: b.x, pushed: false, limit: 0 };
  // 只能从箱子的那一侧往里推,不能隔空把它拽过来
  const fromLeft = hero.x < b.x;
  if ((fromLeft && dir < 0) || (!fromLeft && dir > 0)) return { x: b.x, pushed: false, limit: 0 };
  if (!canPush(hero.kind)) return { x: b.x, pushed: false, limit: 0 };
  return { x: b.x + dir * PUSH_SPEED * dt, pushed: true, limit: PUSH_SPEED };
}

/**
 * 箱子自己的重力。
 *
 * `supportY` 是脚下那块托着它的面(地面是 0,台面是负数);
 * `null` 表示脚下是断口 —— 那就一路往下掉,掉到 `BLOCK_SETTLE_DEPTH` 卡住架成一座桥。
 * 架好的桥不再动,也不再推得动。
 */
export function fallStep(
  b: BlockState,
  supportY: number | null,
  gravity: number,
  dt: number
): BlockState {
  if (b.bridge) return b;
  if (supportY !== null && b.y >= supportY) return { ...b, y: supportY, vy: 0 };
  const vy = b.vy + gravity * dt;
  let y = b.y + vy * dt;
  if (supportY !== null) {
    if (y >= supportY) return { ...b, y: supportY, vy: 0 };
    return { ...b, y, vy };
  }
  if (y >= BLOCK_SETTLE_DEPTH) {
    y = BLOCK_SETTLE_DEPTH;
    return { x: b.x, y, vy: 0, bridge: true };
  }
  return { x: b.x, y, vy, bridge: false };
}

// ---------------------------------------------------------------------------
// 能力名片 & 交替
// ---------------------------------------------------------------------------

export interface AbilityCard {
  id: "push" | "glide";
  owner: HeroKind;
  name: string;
  icon: string;
  /** ≤ 12 字一行,手机上不折行 */
  howto: string;
}

export const ABILITIES: Record<HeroKind, AbilityCard> = {
  prince: { id: "push", owner: "prince", name: "推重物", icon: "📦", howto: "走过去顶住就推动" },
  princess: { id: "glide", owner: "princess", name: "滑翔", icon: "🪶", howto: "空中按住跳键飘" },
};

export function abilityOf(kind: HeroKind): AbilityCard {
  return ABILITIES[kind];
}

/** 这一关要不要两位轮流上(有重箱子、又有只有滑翔够得到的高台) */
export function needsAlternating(def: {
  blocks?: Array<unknown>;
  glideGems?: Array<unknown>;
}): boolean {
  return (def.blocks?.length ?? 0) > 0 && (def.glideGems?.length ?? 0) > 0;
}
