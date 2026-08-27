/**
 * 雪球大作战 1.2 · 被砸中之后会怎样(纯函数状态机)。
 *
 * 这一款没有血、没有伤、没有淘汰。被雪球砸中只有两件事:
 *
 *   free ──被砸中──▶ snowman(变雪人 1.5 秒,动不了,头上顶个胡萝卜鼻子)
 *     ▲                   │ 1.5 秒到
 *     └───────────────────┘
 *
 *   连着被砸中三次 ──▶ warming(暖手休息 5 秒),歇完回场,次数清零重新算。
 *
 * 已经是雪人的时候再被砸不算数(`bump` 原样返回):
 * 一是不叠加惩罚,二是免得两个人对着一个雪人猛砸,那就不好玩了。
 */

/** 变雪人多久(秒) */
export const FREEZE_TIME = 1.5;
/** 暖手休息多久(秒) */
export const REST_TIME = 5;
/** 连中几次去暖手 */
export const BUMP_LIMIT = 3;

export type HitPhase = "free" | "snowman" | "warming";

export interface HitState {
  phase: HitPhase;
  /** 还要等几秒 */
  timer: number;
  /** 这一轮已经被砸中几次(去暖手之后清零) */
  bumps: number;
  /** 从开局到现在一共被砸中几次,只做统计与文案 */
  total: number;
}

export function makeHitState(): HitState {
  return { phase: "free", timer: 0, bumps: 0, total: 0 };
}

/** 现在能不能动(瞄准 / 走 / 搓雪 / 投都看它) */
export function canAct(s: HitState): boolean {
  return s.phase === "free";
}

/** 被砸中了 */
export function bump(s: HitState): HitState {
  if (s.phase !== "free") return s;
  const bumps = s.bumps + 1;
  const total = s.total + 1;
  if (bumps >= BUMP_LIMIT) {
    return { phase: "warming", timer: REST_TIME, bumps: 0, total };
  }
  return { phase: "snowman", timer: FREEZE_TIME, bumps, total };
}

/** 时间往前走一小步 */
export function tickHit(s: HitState, dt: number): HitState {
  if (s.phase === "free") return s;
  const timer = s.timer - dt;
  if (timer > 0) return { ...s, timer };
  return { phase: "free", timer: 0, bumps: s.bumps, total: s.total };
}

/** 倒计时圈画多满(1 = 刚被砸中,0 = 马上就能动) */
export function freezeRatio(s: HitState): number {
  if (s.phase === "snowman") return Math.max(0, Math.min(1, s.timer / FREEZE_TIME));
  if (s.phase === "warming") return Math.max(0, Math.min(1, s.timer / REST_TIME));
  return 0;
}

/** 还差几次就要去暖手(HUD 用) */
export function bumpsLeft(s: HitState): number {
  return Math.max(0, BUMP_LIMIT - s.bumps);
}

/** 一句给小朋友看的话。只鼓励,不说输赢、不说疼 */
export function hitLine(s: HitState, name: string): string {
  if (s.phase === "warming") return `${name}连着变了三次雪人,先去炉子边暖暖手,${REST_TIME} 秒后精神抖擞地回来!`;
  if (s.phase === "snowman") return `${name}变成雪人啦!抖一抖雪,${FREEZE_TIME} 秒就能动。`;
  return `${name}回场了,继续搓雪!`;
}
