/**
 * 王子与公主 · 跳跃的输入宽容层(纯函数,不认识世界也不认识 DOM)。
 *
 * 1.2 之前这一款的跳只有一条规则:「这一帧踩着地 + 跳键刚按下」。
 * 于是两种按法会被**静默吞掉**,而且吞掉的正好是小朋友最常见的两种按法:
 *
 *  1. **走出台沿之后才按**。断口边缘一走过去人就在半空了,王子的空中跳次数是 0,
 *     这一下跳按了等于没按,直接掉进坑里 —— 大人按得准所以感觉不到,
 *     一年级小朋友几乎每个断口都要摔一次。
 *  2. **落地之前提前按**。跳键的「按下沿」在空中就用掉了,落地那一刻手指还压着,
 *     人却贴着地不动,得松开再按一次。连着跳台阶的时候会一路卡节奏。
 *
 * 这里把两条宽容补上,做法和本窗口另外两款(`puff-bros/feel.ts`、
 * `ice-fire-forest/feel.ts`)一致 —— 常量 + 纯状态机,好让单测直接盯住窗口长度:
 *
 *  - **土狼时间**:离开地面之后还有 `COYOTE_TIME` 这么久算「还踩着地」;
 *  - **跳跃缓冲**:落地之前 `JUMP_BUFFER` 这么久里按的跳会被记下来,一落地立刻兑现。
 *
 * 两个计时器都按秒记、按 `dt` 扣,所以 30fps 和 60fps 下的窗口长度完全一样,
 * 不会出现「慢机器上土狼时间变长」。
 *
 * **这一层只放宽「什么时候算数」,不放宽「跳多高」**:
 * 起跳初速仍然由 `logic.ts` 的 `jumpSpeedOf` / `PRINCESS_DOUBLE_V` 说了算,
 * 公主二段跳的次数也还是公主自己的规则,这里一个数都不改。
 */

/** 土狼时间(秒):走出台沿之后还有这么久算「还踩着地」 */
export const COYOTE_TIME = 0.09;

/** 跳跃缓冲(秒):落地之前这么久里按的跳会被记住,落地那一刻兑现 */
export const JUMP_BUFFER = 0.12;

/** 这一下跳最后算成了哪一种;`null` = 现在跳不了 */
export type JumpKind = "ground" | "double";

export interface JumpFeel {
  /** 还剩多久算「踩着地」 */
  coyote: number;
  /** 缓冲里还压着的那一下跳,还有多久过期 */
  buffer: number;
}

export function freshJumpFeel(): JumpFeel {
  return { coyote: 0, buffer: 0 };
}

/**
 * 每个物理子步先走这一步:扣计时器,踩着地就把土狼时间刷满。
 * 站在地上的每一帧都刷满,所以「刚离开地面」那一瞬间它正好是满的。
 */
export function tickJumpFeel(f: JumpFeel, dt: number, onGround: boolean): void {
  const d = Math.max(0, Number.isFinite(dt) ? dt : 0);
  f.coyote = onGround ? COYOTE_TIME : Math.max(0, f.coyote - d);
  f.buffer = Math.max(0, f.buffer - d);
}

/** 记一次跳键的「按下沿」。调用方负责只在从松到按那一下调它 */
export function noteJumpPress(f: JumpFeel): void {
  f.buffer = JUMP_BUFFER;
}

/** 缓冲里还压着一下没兑现的跳 */
export function jumpQueued(f: JumpFeel): boolean {
  return f.buffer > 0;
}

/**
 * 现在这一下跳会算成什么:踩着地(或还在土狼时间里)是地面跳,
 * 否则看还剩几次空中跳。缓冲空了就是 `null`。
 */
export function peekJump(f: JumpFeel, onGround: boolean, airJumps: number): JumpKind | null {
  if (f.buffer <= 0) return null;
  if (onGround || f.coyote > 0) return "ground";
  if (airJumps > 0) return "double";
  return null;
}

/**
 * 真的把这一下跳兑现掉:返回种类并把缓冲与土狼时间一起结算。
 * 兑现之后缓冲清零,免得同一下按键连着触发两次。
 * (空中跳的**次数**由调用方自己扣 —— 那是 `logic.ts` 里公主的规则,不归手感层管。)
 */
export function takeJump(f: JumpFeel, onGround: boolean, airJumps: number): JumpKind | null {
  const kind = peekJump(f, onGround, airJumps);
  if (!kind) return null;
  f.buffer = 0;
  if (kind === "ground") f.coyote = 0;
  return kind;
}

/**
 * 这一下按键被别的动作用掉了(蹲着按跳从浮台穿下去就是这种)。
 * 缓冲与土狼时间一起清干净,不然人穿下去以后马上又原地弹一次。
 */
export function consumeJump(f: JumpFeel): void {
  f.buffer = 0;
  f.coyote = 0;
}

/** 土狼时间折算成「走出台沿之后最多还能走多远仍算站着」(px),用来跟断口宽度对账 */
export function coyoteSlack(moveSpeed: number): number {
  return Math.max(0, moveSpeed) * COYOTE_TIME;
}
