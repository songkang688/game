/**
 * 便便超人 · 手感常量(1.2 抽出来的一份)。
 *
 * 移动、跳跃、清扫范围、冷却、雨天惯性、清洁车、分类站的判定距离全部集中在这里,
 * 逻辑层与关卡生成器都从这儿读,改手感只改这一个文件。
 *
 * 帧率无关的做法:`stepWorld` 把任意 dt 切成不超过 `MAX_SUBSTEP` 的子步,
 * 所以 30fps 与 60fps 走的是同一串子步,位移不会因为机器快慢而变(用例里钉死 < 2%)。
 */

// ---------------------------------------------------------------------------
// 跑跳
// ---------------------------------------------------------------------------

export const GRAVITY = 2000;
/** 站着跑的速度 */
export const MOVE_SPEED = 250;
/** 蹲着挪的速度 */
export const CROUCH_SPEED = 130;
export const JUMP_V = 680;

// ---------------------------------------------------------------------------
// 两种清洁动作
// ---------------------------------------------------------------------------

/** 冲刺清扫的速度与时长 */
export const DASH_SPEED = 520;
export const DASH_TIME = 0.26;
export const DASH_COOLDOWN = 0.5;
/** 扫一扫(副动作):原地挥一下小扫帚 */
export const SWEEP_TIME = 0.24;
export const SWEEP_COOLDOWN = 0.42;
export const SWEEP_RANGE = 62;

// ---------------------------------------------------------------------------
// 身体与碰撞
// ---------------------------------------------------------------------------

export const PLAYER_W = 34;
export const PLAYER_H = 46;
export const CROUCH_H = 26;
export const MONSTER_W = 38;
export const MONSTER_H = 34;
/** 掉出画面多深算摔下去 */
export const FALL_LIMIT = 260;
export const HURT_INVULN = 1.4;
export const STOMP_BOUNCE = 430;
export const SPRING_V = 900;
export const JUNK_R = 18;

// ---------------------------------------------------------------------------
// 地面手感
// ---------------------------------------------------------------------------

/** 滑地板(泡泡洗衣坊)的减速系数:越小越滑 */
export const SLIP_FRICTION = 3.2;
/** 暴雨天的减速系数:比洗衣坊还小一截,惯性明显更大 */
export const RAIN_FRICTION = 1.6;
/** 泥洼里的速度倍率 */
export const SLUDGE_SLOW = 0.55;
/** 物理最大子步长:再大的 dt 会被切开,保证快慢机上手感一致 */
export const MAX_SUBSTEP = 1 / 120;

// ---------------------------------------------------------------------------
// 护送清洁车
// ---------------------------------------------------------------------------

/** 推着清洁车走的速度(比人慢,所以要陪着它) */
export const CART_SPEED = 118;
/** 站在车尾多远之内算「在推车」 */
export const CART_PUSH_RANGE = 78;
export const CART_W = 52;
export const CART_H = 42;

// ---------------------------------------------------------------------------
// 垃圾分类
// ---------------------------------------------------------------------------

/** 走到多近算捡起地上的可分类垃圾 */
export const LITTER_PICK_RANGE = 26;
/** 走到多近算投进这个桶 */
export const BIN_RANGE = 34;
/** 投一次(不管对不对)之后要隔多久才会再判定一次,免得站在桶边一直触发 */
export const SORT_COOLDOWN = 0.7;
/** 投对一件多给几颗星星 */
export const SORT_STAR = 1;

// ---------------------------------------------------------------------------
// 无尽「打扫不完的城市」
// ---------------------------------------------------------------------------

/** 清掉一处脏东西,脏乱度往回退多少 */
export const MESS_RELIEF = 0.05;
/** 投对一件垃圾,脏乱度往回退多少 */
export const MESS_SORT_RELIEF = 0.04;

/**
 * 一整套手感常量的只读快照:UI 里要显示、用例里要断言都读它,
 * 免得有人偷偷在别处又写一个魔法数字。
 */
export const HANDLING = Object.freeze({
  gravity: GRAVITY,
  moveSpeed: MOVE_SPEED,
  crouchSpeed: CROUCH_SPEED,
  jumpV: JUMP_V,
  dashSpeed: DASH_SPEED,
  dashTime: DASH_TIME,
  dashCooldown: DASH_COOLDOWN,
  sweepTime: SWEEP_TIME,
  sweepCooldown: SWEEP_COOLDOWN,
  sweepRange: SWEEP_RANGE,
  slipFriction: SLIP_FRICTION,
  rainFriction: RAIN_FRICTION,
  sludgeSlow: SLUDGE_SLOW,
  maxSubstep: MAX_SUBSTEP,
  cartSpeed: CART_SPEED,
  cartPushRange: CART_PUSH_RANGE,
  litterPickRange: LITTER_PICK_RANGE,
  binRange: BIN_RANGE,
  sortCooldown: SORT_COOLDOWN,
});

/** 一次起跳能上升的最高点(px) */
export function jumpApex(): number {
  return (JUMP_V * JUMP_V) / (2 * GRAVITY);
}

/** 一次起跳能跨过的水平距离(px) */
export function jumpRange(): number {
  return ((2 * JUMP_V) / GRAVITY) * MOVE_SPEED;
}
