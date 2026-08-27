/**
 * 噗噗兄弟 · 跳跃手感层(纯函数,不认识世界也不认识 DOM)。
 *
 * 1.1 的跳只有一条规则:「站在地上 + 按下跳键」。走出台沿的下一帧、
 * 落地前的一两帧,按下去的跳都会被直接吞掉 —— 大人按得准所以感觉不到,
 * 一年级小朋友按早半拍就白按一次,连着几回就不想玩了。
 *
 * 这里把三样东西补上,并且全部做成「常量 + 纯状态机」,好让单测直接验:
 *
 *  - **土狼时间**:离开地面之后还有 COYOTE_TIME 这么久算「还站着」;
 *  - **跳跃缓冲**:落地之前 JUMP_BUFFER 这么久里按的跳会被记下来,一落地就兑现;
 *  - **二段跳**:落地回满一次空中跳,空中再按一下能再蹬一脚(比地面跳矮一截)。
 *
 * 三个计时器都按秒记、按 dt 扣,所以 30fps 和 60fps 下的窗口长度是一样的,
 * 不会出现「慢机器上土狼时间变长」这种事。
 */

// ---------------------------------------------------------------------------
// 手感常量
// ---------------------------------------------------------------------------

/** 重力加速度(px/s²) */
export const GRAVITY = 1750;
/** 地面横向速度(px/s) */
export const MOVE_SPEED = 195;
/** 地面起跳初速(px/s) */
export const JUMP_V = 690;
/** 二段跳初速:比地面跳矮一截,不然二段跳就变成「随便飞」了 */
export const DOUBLE_JUMP_V = 545;
/** 空中左右微调的跟随系数(越大越跟手) */
export const AIR_CONTROL = 7;
/** 土狼时间:走出台沿之后还有这么久算「还踩着地」 */
export const COYOTE_TIME = 0.09;
/** 跳跃缓冲:落地之前这么久里按的跳会被记住,落地那一刻兑现 */
export const JUMP_BUFFER = 0.12;
/** 落地回满几次空中跳(1 就是二段跳) */
export const AIR_JUMPS = 1;
/**
 * 物理最大子步长:再大的 dt 会被切开,保证快慢机上位移一致。
 *
 * 这里刻意**没有**「松开跳键就砍掉上升速度」的短按小跳:一年级小朋友的手
 * 常常按一下就弹开,短按小跳会让他们莫名其妙地跳不高。跳的高度只由
 * JUMP_V / DOUBLE_JUMP_V 决定,按多久都一样。
 */
export const MAX_SUBSTEP = 1 / 120;

/** 落地压扁的幅度(8%),`prefers-reduced-motion` 下渲染层自行忽略 */
export const SQUASH_AMOUNT = 0.08;
/** 压扁回弹的时长 */
export const SQUASH_TIME = 0.18;
/** 落地速度超过这个值才看得出压扁 */
export const SQUASH_MIN_VY = 260;

/** 一次地面起跳能上升的最高点(px) */
export function jumpApex(): number {
  return (JUMP_V * JUMP_V) / (2 * GRAVITY);
}

/** 一次二段跳能再上升的高度(px) */
export function doubleJumpApex(): number {
  return (DOUBLE_JUMP_V * DOUBLE_JUMP_V) / (2 * GRAVITY);
}

/** 一次地面起跳能跨过的水平距离(px) */
export function jumpRange(): number {
  return ((2 * JUMP_V) / GRAVITY) * MOVE_SPEED;
}

/** 土狼时间折算成「最多能多走多远还算站着」(px),用来跟台沿宽度对账 */
export function coyoteSlack(): number {
  return MOVE_SPEED * COYOTE_TIME;
}

// ---------------------------------------------------------------------------
// 跳跃状态机
// ---------------------------------------------------------------------------

export type JumpKind = "ground" | "double";

export interface JumpFeel {
  /** 还剩多久算「踩着地」 */
  coyote: number;
  /** 缓冲里还压着的那一下跳,还有多久过期 */
  buffer: number;
  /** 空中跳还剩几次 */
  airJumps: number;
  /** 上一帧跳键的状态(数按下沿用) */
  prevUp: boolean;
  /** 落地压扁的剩余时间 */
  squash: number;
  /** 这一下落地砸得多重(0..1),渲染层拿它定压扁幅度 */
  squashPower: number;
}

export function newJumpFeel(): JumpFeel {
  return { coyote: 0, buffer: 0, airJumps: AIR_JUMPS, prevUp: false, squash: 0, squashPower: 0 };
}

/**
 * 每个物理子步先走这一步:扣计时器、按需要回满土狼时间与空中跳。
 * 站在地上的每一帧都把土狼时间刷成满值,所以「刚离开地面」这一瞬间它正好是满的。
 */
export function tickJumpFeel(f: JumpFeel, dt: number, onGround: boolean): void {
  if (onGround) {
    f.coyote = COYOTE_TIME;
    f.airJumps = AIR_JUMPS;
  } else {
    f.coyote = Math.max(0, f.coyote - dt);
  }
  f.buffer = Math.max(0, f.buffer - dt);
  f.squash = Math.max(0, f.squash - dt);
  if (f.squash === 0) f.squashPower = 0;
}

/** 记一次跳键的「按下沿」:只有从松到按那一下才往缓冲里压 */
export function noteJumpKey(f: JumpFeel, up: boolean): boolean {
  const edge = up && !f.prevUp;
  f.prevUp = up;
  if (edge) f.buffer = JUMP_BUFFER;
  return edge;
}

/** 现在这一下跳会是地面跳、二段跳,还是根本跳不了 */
export function peekJump(f: JumpFeel, onGround: boolean): JumpKind | null {
  if (f.buffer <= 0) return null;
  if (onGround || f.coyote > 0) return "ground";
  if (f.airJumps > 0) return "double";
  return null;
}

/**
 * 真的把这一下跳兑现掉:返回跳的种类并把缓冲 / 土狼 / 空中跳次数一起结算。
 * 兑现之后缓冲清零,免得同一下按键连着触发两次。
 */
export function takeJump(f: JumpFeel, onGround: boolean): JumpKind | null {
  const kind = peekJump(f, onGround);
  if (!kind) return null;
  f.buffer = 0;
  if (kind === "ground") {
    f.coyote = 0;
  } else {
    f.airJumps = Math.max(0, f.airJumps - 1);
  }
  return kind;
}

/** 某一种跳的初速 */
export function jumpSpeed(kind: JumpKind): number {
  return kind === "ground" ? JUMP_V : DOUBLE_JUMP_V;
}

/** 蹲着按跳穿浮台时也要把这一下吃掉,不然人穿下去以后又原地弹一次 */
export function consumeBuffer(f: JumpFeel): void {
  f.buffer = 0;
  f.coyote = 0;
}

/** 记一次落地:砸得越重压得越扁 */
export function noteLanding(f: JumpFeel, vy: number): void {
  if (vy < SQUASH_MIN_VY) return;
  f.squash = SQUASH_TIME;
  f.squashPower = Math.min(1, (vy - SQUASH_MIN_VY) / 520);
}

/**
 * 落地压扁的当前形变(0 表示原样)。渲染层把身体竖着乘 1-s、横着乘 1+s。
 * `prefers-reduced-motion` 下渲染层直接当 0 用 —— 位移照旧,只是不形变。
 */
export function squashScale(f: JumpFeel): number {
  if (f.squash <= 0) return 0;
  const t = f.squash / SQUASH_TIME;
  return SQUASH_AMOUNT * f.squashPower * Math.sin(t * Math.PI);
}

// ---------------------------------------------------------------------------
// 帧率无关
// ---------------------------------------------------------------------------

/**
 * 把 dt 切成一串不超过 MAX_SUBSTEP 的子步(最后一段是余数)。
 * `stepWorld` 与所有帧率无关的用例都走这一条,保证 30fps 和 60fps
 * 推进同样的模拟时间、得到同样的位移。
 */
export function substeps(dt: number, maxTotal = 0.25): number[] {
  const total = Math.max(0, Math.min(maxTotal, dt));
  const out: number[] = [];
  let left = total;
  let guard = 0;
  while (left > 1e-6 && guard++ < 64) {
    const step = Math.min(MAX_SUBSTEP, left);
    out.push(step);
    left -= step;
  }
  return out;
}

/** 空中横向跟随:同样一段时间里,切多少子步算出来的结果都差不多 */
export function airApproach(vx: number, target: number, dt: number): number {
  return vx + (target - vx) * Math.min(1, AIR_CONTROL * dt);
}
