/**
 * 康康射击场 1.2 · 靶子体系补齐 + 远近两排的伪纵深。
 *
 * 1.1 只有「站着的 / 飘着的 / 走着的 / 不许打的」四种行为，打法上其实是同一件事。
 * 1.2 补四类各自要求不同判断的靶：
 *
 * - 分裂靶 🫧：打中变两个小的，小的不再分裂 —— 教「一发不等于一个」。
 * - 护盾靶 🛡️：外面一层软壳，要打两次 —— 教「有的靶得多花一发」。
 * - 彩虹靶 🌈：只待几秒就自己走，越早打分越高 —— 教「先打会跑的」。
 * - 花朵靶 🌸：鸭梨种的花，打中扣分 —— 和好人靶一起教「忍住别打」。
 *
 * 伪纵深还是纯 2D：靶子只分「远排 / 近排」两档，远排半径小、分数乘 1.5，
 * 远近由 y 坐标算出来（`depthRowOf`），所以老关卡不用改一个字节也能吃到这条规则。
 *
 * 全文件没有 DOM，靶子的行为与结算都能被单测直接调。
 */
import {
  FLOWER_PENALTY,
  FRIEND_PENALTY,
  comboMultiplier,
  makeTarget,
  scoreForHit,
  type Target,
  type TargetKind,
} from "./logic";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 1.2 新加的四类靶 */
export const KINDS_12 = ["split", "shield", "rainbow", "flower"] as const;

/** 护盾靶的壳层数（要打两次） */
export const SHIELD_HP = 2;
/** 分裂靶炸成几个小的 */
export const SPLIT_CHILDREN = 2;
/** 小靶半径是原靶的几成 */
export const SPLIT_CHILD_SCALE = 0.62;
/** 小靶往两边弹开的横向速度 */
export const SPLIT_CHILD_SPEED = 70;
/** 分裂出来的小靶用这个号段，绝不会和原靶撞 id */
export const SPLIT_ID_BASE = 5000;

/** 彩虹靶在场上待几秒 */
export const RAINBOW_TTL = 4.5;
/** 彩虹靶最低分（拖到快走了才打中） */
export const RAINBOW_MIN = 30;
/** 彩虹靶最高分（刚出来就打中） */
export const RAINBOW_MAX = 60;

/** 远排 / 近排的分界线（逻辑 y，越小越远） */
export const FAR_ROW_Y = 250;
/** 远排的分数加成 */
export const FAR_SCORE_MUL = 1.5;
/** 远排靶半径打几折（关卡生成用） */
export const FAR_RADIUS_SCALE = 0.78;

export type DepthRow = "far" | "near";

// ---------------------------------------------------------------------------
// 分类
// ---------------------------------------------------------------------------

/** 不许打的靶（打中扣分，只提醒不批评） */
export function isForbidden(kind: TargetKind): boolean {
  return kind === "friend" || kind === "flower";
}

/** 必须打掉才算清场的靶（彩虹靶是白捡的奖励，不算指标） */
export function mustClear(kind: TargetKind): boolean {
  return !isForbidden(kind) && kind !== "rainbow";
}

/** 会自己走掉的靶（有 ttl） */
export function hasLifespan(t: Target): boolean {
  return typeof t.ttl === "number";
}

// ---------------------------------------------------------------------------
// 伪纵深
// ---------------------------------------------------------------------------

/** 这个高度算远排还是近排 */
export function depthRowOf(y: number): DepthRow {
  return y < FAR_ROW_Y ? "far" : "near";
}

/** 远排 / 近排的分数倍率 */
export function depthScoreMul(row: DepthRow): number {
  return row === "far" ? FAR_SCORE_MUL : 1;
}

/** 靶子自己的分数倍率：显式标了 `far` 的听自己的，没标的按 y 算 */
export function targetDepthMul(t: Target): number {
  return depthScoreMul(t.far === true ? "far" : t.far === false ? "near" : depthRowOf(t.y));
}

// ---------------------------------------------------------------------------
// 造靶
// ---------------------------------------------------------------------------

/** 造一个 1.2 的靶：把这一类该带的可选字段一次带齐 */
export function makeTarget12(
  id: number,
  kind: TargetKind,
  x: number,
  y: number,
  r: number,
  extra: { vx?: number; vy?: number; phase?: number; far?: boolean; ttl?: number } = {}
): Target {
  const far = extra.far ?? depthRowOf(y) === "far";
  return makeTarget(id, kind, x, y, Math.round(far ? r * FAR_RADIUS_SCALE : r), {
    vx: extra.vx ?? 0,
    vy: extra.vy ?? 0,
    phase: extra.phase ?? 0,
    far,
    ...(kind === "shield" ? { hp: SHIELD_HP } : {}),
    ...(kind === "split" ? { gen: 0 } : {}),
    ...(kind === "rainbow" ? { ttl: extra.ttl ?? RAINBOW_TTL } : extra.ttl !== undefined ? { ttl: extra.ttl } : {}),
  });
}

/** 分裂靶炸开之后的两个小靶（纯函数：同样的输入永远同样的两个小靶） */
export function splitChildren(t: Target, seq: number): Target[] {
  if (t.kind !== "split" || (t.gen ?? 0) > 0) return [];
  const r = Math.max(14, Math.round(t.r * SPLIT_CHILD_SCALE));
  const out: Target[] = [];
  for (let i = 0; i < SPLIT_CHILDREN; i++) {
    const dir = i === 0 ? -1 : 1;
    out.push(
      makeTarget(SPLIT_ID_BASE + seq * SPLIT_CHILDREN + i, "split", Math.round(t.x + dir * t.r * 0.8), t.y, r, {
        vx: dir * SPLIT_CHILD_SPEED,
        vy: t.vy,
        phase: t.phase + i,
        gen: (t.gen ?? 0) + 1,
        ...(t.far !== undefined ? { far: t.far } : {}),
        ...(t.ttl !== undefined ? { ttl: t.ttl } : {}),
      })
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 命中结算
// ---------------------------------------------------------------------------

export interface HitOutcome {
  /** 这一发之后的靶子状态（护盾靶掉一层壳还立着） */
  target: Target;
  /** 靶子倒了没有 */
  destroyed: boolean;
  /** 算不算一次有效命中（进命中率、接连击） */
  counted: boolean;
  /** 打了不许打的靶 */
  foul: boolean;
  /** 分数增量（可能是负的） */
  score: number;
  /** 分裂出来的小靶 */
  spawns: Target[];
  /** 命中顿感该顿几帧（交给 feel12.hitStopSeconds） */
  stop: "normal" | "shield" | "big";
  /** 屏幕上蹦的一句话（只鼓励，不批评） */
  say: string;
}

/** 彩虹靶的分：越早打中越高，拖到快走了也还有保底 */
export function rainbowScore(ttlLeft: number): number {
  const k = Math.max(0, Math.min(1, ttlLeft / RAINBOW_TTL));
  return Math.round(RAINBOW_MIN + (RAINBOW_MAX - RAINBOW_MIN) * k);
}

/**
 * 打中一个靶之后发生了什么。`seq` 只用来给分裂出来的小靶编号。
 * 连击倍率在这里乘，扣分不受倍率影响（不然连击越高误伤越亏，会劝退）。
 */
export function resolveHit(t: Target, offset: number, combo: number, seq = 0): HitOutcome {
  const depth = targetDepthMul(t);

  if (t.kind === "friend") {
    return {
      target: { ...t },
      destroyed: false,
      counted: false,
      foul: true,
      score: -FRIEND_PENALTY,
      spawns: [],
      stop: "normal",
      say: "那是好人靶呀,它在跟你打招呼呢。",
    };
  }
  if (t.kind === "flower") {
    return {
      target: { ...t },
      destroyed: false,
      counted: false,
      foul: true,
      score: -FLOWER_PENALTY,
      spawns: [],
      stop: "normal",
      say: "花朵靶要留着开花,忍住这一发更帅。",
    };
  }

  if (t.kind === "shield") {
    const hp = (t.hp ?? SHIELD_HP) - 1;
    if (hp > 0) {
      return {
        target: { ...t, hp },
        destroyed: false,
        counted: true,
        foul: false,
        // 敲壳只给一点点分，真正的分在敲开之后
        score: Math.round(6 * comboMultiplier(combo) * depth),
        spawns: [],
        stop: "shield",
        say: "壳裂了一道缝,再来一发!",
      };
    }
    return {
      target: { ...t, hp: 0, alive: false },
      destroyed: true,
      counted: true,
      foul: false,
      score: Math.round(scoreForHit("shield", offset, t.r, combo) * depth),
      spawns: [],
      stop: "shield",
      say: "",
    };
  }

  if (t.kind === "split" && (t.gen ?? 0) === 0) {
    return {
      target: { ...t, alive: false },
      destroyed: true,
      counted: true,
      foul: false,
      score: Math.round(scoreForHit("split", offset, t.r, combo) * depth),
      spawns: splitChildren(t, seq),
      stop: "big",
      say: "分成两个啦,别漏了小的!",
    };
  }

  if (t.kind === "rainbow") {
    return {
      target: { ...t, alive: false },
      destroyed: true,
      counted: true,
      foul: false,
      score: Math.round(rainbowScore(t.ttl ?? RAINBOW_TTL) * comboMultiplier(combo) * depth),
      spawns: [],
      stop: "big",
      say: "彩虹靶!这一发最值钱。",
    };
  }

  return {
    target: { ...t, alive: false },
    destroyed: true,
    counted: true,
    foul: false,
    score: Math.round(scoreForHit(t.kind, offset, t.r, combo) * depth),
    spawns: [],
    stop: "normal",
    say: "",
  };
}

// ---------------------------------------------------------------------------
// 会走掉的靶
// ---------------------------------------------------------------------------

export interface LifeStep {
  target: Target;
  /** 这一步之后靶子自己走掉了 */
  gone: boolean;
}

/** ttl 倒计时。走掉的靶不算「打空」，只是没赚到；彩虹靶走掉更不该罚。 */
export function stepLifespan(t: Target, dt: number): LifeStep {
  if (!t.alive || typeof t.ttl !== "number") return { target: t, gone: false };
  const ttl = t.ttl - Math.max(0, dt);
  if (ttl > 0) return { target: { ...t, ttl }, gone: false };
  return { target: { ...t, ttl: 0, alive: false }, gone: true };
}

/** 靶子快走了没有（画面上闪一闪提醒） */
export function isLeavingSoon(t: Target): boolean {
  return typeof t.ttl === "number" && t.ttl > 0 && t.ttl < 1.2;
}
