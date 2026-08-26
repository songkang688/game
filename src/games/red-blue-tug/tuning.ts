/**
 * 红蓝拔河 · 1.2 手感常量。
 *
 * 1.1 的常量留在 `logic.ts`(那一套是按「点一下加固定量」写的,前 99 关的
 * 可通关性用例还靠它),这里是 1.2 的**连续力量模型**用的一整套数,集中冻结在一处:
 * 想调手感只改这个文件,`force.ts` / `ai.ts` / `duel.ts` / `index.ts` 都从这里取。
 *
 * 单位约定与 1.1 一致:绳子位置是 -100..100 的连续量,力量是「每秒拉多少」。
 */

export const TUG12 = Object.freeze({
  /** 绳子拉到这个位置就分胜负(与 1.1 的 WIN_AT 同口径) */
  ROPE_WIN: 100,
  /** 主循环最大子步长:再长的一帧也切成这么多小步,保证 30fps 与 120fps 结果一致 */
  MAX_SUBSTEP: 1 / 120,

  // ---- 体力 ----
  /** 体力上限(关卡可以按 `cfg.stamina` 调低) */
  STAMINA_MAX: 100,
  /** 按住时每秒掉多少体力 */
  DRAIN_PER_SEC: 26,
  /** 松开时每秒回多少体力 */
  REGEN_PER_SEC: 34,
  /** 体力高于这个值就是满力,低于它力量线性往下掉 */
  STRONG_AT: 45,
  /** 体力刚好为 0(还没脱力)时的力量倍率 */
  LOW_FACTOR: 0.5,
  /** 脱力时的力量倍率:见底之后力量骤降到三成 */
  EXHAUST_FACTOR: 0.26,
  /** 脱力后要把体力缓到这个值才恢复正常出力 */
  WINDED_CLEAR: 30,

  // ---- 抓绳:手要抓稳了才使得上劲 ----
  /** 刚按下的那一瞬只有这几成力 */
  GRIP_MIN: 0.5,
  /** 抓稳要多久(毫秒);一抽一放的狂按永远吃不到满力 */
  GRIP_RAMP_MS: 240,

  // ---- 蓄力 / 突然发力 ----
  /** 松手攒够这么久,下一次按下才带爆发 */
  CHARGE_MS: 500,
  /** 一次爆发能持续多久 */
  BURST_MS: 450,
  /** 爆发期间的力量倍率 */
  BURST_GAIN: 1.35,

  // ---- 节奏点(绳子上的加油点) ----
  /** 加油点经过中线的判定窗口(前后各这么多毫秒) */
  BEAT_WINDOW_MS: 120,
  /** 踩点这一下必须是「松手蓄力之后的发力」,狂按不算 */
  BEAT_MIN_REST_MS: 250,
  /** 踩中一个加油点额外拉回多少 */
  BEAT_IMPULSE: 5.5,
  /** 两个加油点之间的最短 / 最长间隔 */
  BEAT_GAP_MIN_MS: 2200,
  BEAT_GAP_MAX_MS: 3400,
  /** 加油点从场边飘到中线要多久(画面提前量,双方看到的是同一颗) */
  BEAT_TRAVEL_MS: 1700,

  // ---- 反拉「拼一把」 ----
  /** 被拉到这个比例的位置(0..1)就给落后方开窗口 */
  COMEBACK_AT: 0.8,
  /** 窗口持续多久 */
  COMEBACK_MS: 2000,
  /** 窗口内的拉力加成(封顶就是这一档,不叠加) */
  COMEBACK_GAIN: 0.15,
  /** 一次窗口结束后要隔多久才可能再开 */
  COMEBACK_COOLDOWN_MS: 6000,

  // ---- 关卡机关 ----
  /** 红灯硬拉每秒往回滑多少 */
  SLIP_PER_SEC: 9,
  /** 红绿灯的周期(与 1.1 同一组数) */
  LIGHT_GREEN_MS: 2500,
  LIGHT_RED_MS: 1250,
  /** 节奏关连按同一只手只使得出几成劲 */
  OFFHAND_FACTOR: 0.5,
  /** 抢到补给之后的力量加成与持续时间 */
  SUPPLY_GAIN: 1.25,
  SUPPLY_MS: 4000,
});

export type Tuning = typeof TUG12;

// ---------------------------------------------------------------------------
// 手机 360px 的排版红线
// ---------------------------------------------------------------------------

/** 两侧大按钮的最小边长 */
export const SIDE_BTN_MIN = 72;
/** 两个按钮中间的隔离带,免得双人同屏时按串 */
export const SIDE_GAP_MIN = 16;
/** 体力条旁边的字号下限 */
export const LABEL_FONT_MIN = 14;

/** 把力量倍率折算成绳子的抖动幅度(px);`reduced` 时不抖,只把形变留给形状 */
export function ropeShake(factor: number, reduced: boolean): number {
  if (reduced || !Number.isFinite(factor) || factor <= 0) return 0;
  return Math.min(6, factor * 4);
}

/** 力量越大绳子绷得越直:返回下垂的像素数(0 = 绷直) */
export function ropeSag(factor: number): number {
  const f = Number.isFinite(factor) ? Math.max(0, Math.min(1.4, factor)) : 0;
  return Math.round((1 - f / 1.4) * 10);
}
