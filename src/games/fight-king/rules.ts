/**
 * 朵星格斗王 —— 判定纯函数。
 *
 * 这里一个 DOM 都不碰、一个随机数都不掷：给同样的输入永远得到同样的输出，
 * 所以判定框重叠、优先级对拼、连段取消、无限连防护这些规矩都能被单测牢牢盯住。
 *
 * 对局状态机在 `engine.ts`，它只调用这里的函数，不自己写判定。
 */
import {
  METER_MAX,
  SUPER_COST,
  type Box,
  type GuardHeight,
  type Move,
  type MoveKind,
  type MoveSlot,
  type Rect,
  totalFrames
} from "./frames";

// ---------------------------------------------------------------------------
// 几何：判定框换算与重叠
// ---------------------------------------------------------------------------

/** 朝向：1 = 面朝右，-1 = 面朝左 */
export type Facing = 1 | -1;

/**
 * 把角色身上的相对框换算成世界坐标矩形。
 * 角色朝右时框往 +x 长；朝左时整个框以角色为轴镜像过去。
 */
export function worldBox(x: number, y: number, facing: Facing, box: Box): Rect {
  return {
    x: facing === 1 ? x + box.x : x - box.x - box.w,
    y: y + box.y,
    w: box.w,
    h: box.h
  };
}

/** 两个矩形有没有重叠（边贴边不算重叠，避免"擦过去也算命中"） */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** 重叠面积（0 表示没碰上），特效想画在重叠中心时用得上 */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** 受击框：站着一个高、蹲下矮一截、空中跟站着一样但整体抬高 */
export function hurtRect(
  x: number,
  y: number,
  halfWidth: number,
  height: number,
  crouchHeight: number,
  crouching: boolean
): Rect {
  return {
    x: x - halfWidth,
    y,
    w: halfWidth * 2,
    h: crouching ? crouchHeight : height
  };
}

/**
 * 出招时的受击框：手脚伸出去多远，前面那一截就得跟着挨打。
 * 有了这一条，长手招不再是白嫖 —— 隔着老远戳过来的人自己也在判定里。
 */
export function extendHurtRect(base: Rect, facing: Facing, extend: number): Rect {
  if (extend <= 0) return base;
  return facing === 1
    ? { ...base, w: base.w + extend }
    : { ...base, x: base.x - extend, w: base.w + extend };
}

/** 身体碰撞框（只管左右推挤，不管上下） */
export function bodyRect(x: number, halfWidth: number): { left: number; right: number } {
  return { left: x - halfWidth, right: x + halfWidth };
}

/** 两个身体挤在一起时各自要挪多远（对半分，谁贴墙由调用方再夹一次） */
export function pushApart(xa: number, xb: number, halfA: number, halfB: number): number {
  const need = halfA + halfB;
  const gap = Math.abs(xa - xb);
  if (gap >= need) return 0;
  return (need - gap) / 2;
}

/** 我该面朝哪边：对手在右边就朝右 */
export function facingTowards(myX: number, otherX: number): Facing {
  return otherX >= myX ? 1 : -1;
}

/** 两人身体之间的净距离（贴在一起就是 0） */
export function bodyGap(xa: number, xb: number, halfA: number, halfB: number): number {
  return Math.max(0, Math.abs(xa - xb) - halfA - halfB);
}

// ---------------------------------------------------------------------------
// 帧：起手 / 命中 / 收招
// ---------------------------------------------------------------------------

export type MovePhase = "startup" | "active" | "recovery" | "done";

/** 招式进行到第 frame 帧时处在哪一段（frame 从 0 开始数） */
export function movePhase(move: Move, frame: number): MovePhase {
  if (frame < 0) return "startup";
  if (frame < move.startup) return "startup";
  if (frame < move.startup + move.active) return "active";
  if (frame < totalFrames(move)) return "recovery";
  return "done";
}

/** 这一帧判定框生效吗 */
export function isActiveFrame(move: Move, frame: number): boolean {
  return movePhase(move, frame) === "active";
}

/** 出招后还剩多少帧动不了（按"命中帧第一帧就打中"算） */
export function framesAfterFirstActive(move: Move): number {
  return move.active - 1 + move.recovery;
}

/** 被挡下之后的帧数差：正数=我先能动（可以继续压），负数=对手先能动（要挨打） */
export function onBlockAdvantage(move: Move): number {
  return move.blockStun - framesAfterFirstActive(move);
}

/** 命中之后的帧数差：正数才有可能接下一招 */
export function onHitAdvantage(move: Move): number {
  return move.hitStun - framesAfterFirstActive(move);
}

/** 被挡下会不会被狠狠反击（帧数差太亏就是"能确反"） */
export const PUNISH_THRESHOLD = -8;

export function punishableOnBlock(move: Move): boolean {
  return onBlockAdvantage(move) <= PUNISH_THRESHOLD;
}

// ---------------------------------------------------------------------------
// 优先级：同一帧两边都打中怎么办
// ---------------------------------------------------------------------------

export type ClashResult = "a" | "b" | "trade";

/** 同帧对拼：优先级高的赢，一样高就双方一起被弹开 */
export function resolveClash(a: Move, b: Move): ClashResult {
  if (a.priority > b.priority) return "a";
  if (b.priority > a.priority) return "b";
  return "trade";
}

/**
 * 投技的额外规矩：投技优先级最高，但只要对手已经打到你身上（你在硬直里）就抓不着。
 * 这里只判"两个招同帧撞上"的情况，距离与状态在 `throwConnects` 里管。
 */
export function throwBeatsStrike(throwMove: Move, strike: Move): boolean {
  return throwMove.kind === "throw" && throwMove.priority > strike.priority;
}

// ---------------------------------------------------------------------------
// 连段：取消表、上限、递减、无限连防护
// ---------------------------------------------------------------------------

/**
 * 取消表：一招在命中 / 被挡之后可以取消成哪几类招。
 *
 * 轻 → 轻 → 重 → 重 → 必杀 → 必杀 → 超必杀，一条**单向**的路：
 * 同一类里可以再接一招（换一个槽），但绝不能往回走。
 * 配上「同一段连段里同一个槽只用一次」，任何取消路线都必然越走越短，
 * 走不出环 —— 这是无限连的第一道闸。
 *
 * 1.1 时代 `heavy` 与 `special` 都只能往下一类走，
 * 结果地面最长路线只有 `5L > 2L > 5H > s1 > super` 五段，
 * 「上限 6」那道闸这辈子没被触发过。补上同类接续之后，
 * `5L > 2L > 5H > s1 > s2 > super` 正好是六段，第七下必定撞上上限。
 */
export const CANCEL_TABLE: Record<MoveKind, MoveKind[]> = {
  light: ["light", "heavy", "special", "super"],
  heavy: ["heavy", "special", "super"],
  special: ["special", "super"],
  super: [],
  throw: []
};

/** 单看类别，from 能不能取消成 to */
export function canCancelInto(from: Move, to: Move): boolean {
  return CANCEL_TABLE[from.kind].includes(to.kind);
}

/**
 * 一次连段里最多几段。到顶之后再打中也不算连段，
 * 对手会直接被弹开倒地（下面的 `cappedOutcome`），这是无限连防护的第二道闸。
 */
export const COMBO_LIMIT = 6;

/** 连段递减：第几段就乘多少，越往后越轻 */
export const COMBO_SCALES = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
/** 递减地板，再长也不会低于它 */
export const MIN_COMBO_SCALE = 0.4;

export function comboScale(hitIndex: number): number {
  if (hitIndex <= 0) return 1;
  return COMBO_SCALES[hitIndex] ?? MIN_COMBO_SCALE;
}

/** 连段第 hitIndex 段（0 基）实际削多少元气 */
export function scaledPower(base: number, hitIndex: number): number {
  return Math.max(1, Math.round(base * comboScale(hitIndex)));
}

/** 连段第 hitIndex 段实际给多长硬直：越往后越短，连段自己就会断 */
export function scaledHitStun(base: number, hitIndex: number): number {
  return Math.max(6, Math.round(base - hitIndex * 2));
}

/** 连段到顶了吗 */
export function isComboCapped(hits: number): boolean {
  return hits >= COMBO_LIMIT;
}

/**
 * 连段到顶之后的处理：不再削元气、直接放倒并弹开。
 * 这样再厉害的连段也不可能把对手一直按住，绝不会出现"打到结束都动不了"。
 */
export interface CappedOutcome {
  power: number;
  hitStun: number;
  knockdown: true;
  knockback: number;
}

export function cappedOutcome(move: Move): CappedOutcome {
  return { power: 0, hitStun: 0, knockdown: true, knockback: Math.max(8, move.knockback) };
}

/**
 * 完整的连段合法性：
 *  1. 取消表允许；
 *  2. 同一段连段里同一个招只能用一次（否则轻击自己接自己就无限了）；
 *  3. 连段没到上限。
 */
export function canChain(from: Move, to: Move, usedSlots: readonly MoveSlot[], hits: number): boolean {
  if (isComboCapped(hits)) return false;
  if (!canCancelInto(from, to)) return false;
  if (to.slot === from.slot) return false;
  return !usedSlots.includes(to.slot);
}

/** 连段计数多久不挨新的一下就清零（帧） */
export const COMBO_RESET_FRAMES = 24;

/** 一串连段的总元气削减（纯算数，训练模式用来显示"这套能打多少"） */
export function comboTotalPower(moves: readonly Move[]): number {
  let total = 0;
  for (let i = 0; i < moves.length && i < COMBO_LIMIT; i++) {
    total += scaledPower(moves[i].power, i);
  }
  return total;
}

/** 这一串招式接得起来吗（训练模式检查玩家想练的连段是否成立） */
export function isValidCombo(moves: readonly Move[]): boolean {
  if (moves.length === 0) return false;
  if (moves.length > COMBO_LIMIT) return false;
  const used: MoveSlot[] = [moves[0].slot];
  for (let i = 1; i < moves.length; i++) {
    if (!canChain(moves[i - 1], moves[i], used, i)) return false;
    used.push(moves[i].slot);
  }
  return true;
}

// ---------------------------------------------------------------------------
// 格挡与破防
// ---------------------------------------------------------------------------

export type Stance = "stand" | "crouch" | "air";

/** 这个姿势挡得住这个高度的招吗（投技谁都挡不住，空中也不能防御） */
export function blocksAttack(stance: Stance, height: GuardHeight): boolean {
  if (height === "throw") return false;
  if (stance === "air") return false;
  if (stance === "stand") return height !== "low";
  return height !== "high";
}

/** 按住"远离对手"的方向键就是在格挡 */
export function holdingBack(facing: Facing, left: boolean, right: boolean): boolean {
  return facing === 1 ? left && !right : right && !left;
}

/** 挡一下之后剩多少格挡槽 */
export function guardAfterBlock(guard: number, cost: number): number {
  return Math.max(0, guard - cost);
}

/** 格挡槽空了就是破防 */
export function isGuardBroken(guard: number): boolean {
  return guard <= 0;
}

/** 不挡的时候格挡槽每帧回一点 */
export const GUARD_REGEN_PER_FRAME = 0.22;

export function guardRegen(guard: number, max: number, frames = 1): number {
  return Math.min(max, guard + GUARD_REGEN_PER_FRAME * frames);
}

/** 破防之后要愣多少帧（够对手接一套，但不至于一套打完） */
export const GUARD_BREAK_FRAMES = 46;

// ---------------------------------------------------------------------------
// 投技
// ---------------------------------------------------------------------------

/** 投技抓得到的净距离 */
export const THROW_RANGE = 18;

/** 这些状态下抓不到人：已经在硬直里的人有"投技保护" */
export const THROW_IMMUNE_PHASES = ["hitstun", "blockstun", "knockdown", "wakeup", "guardbreak", "grabbed"] as const;

export type ThrowImmunePhase = (typeof THROW_IMMUNE_PHASES)[number];

/**
 * 被摔过一次之后的投技保护帧：爬起来之后这么久之内摔不着。
 * 有了它，"摔倒 → 起身 → 再摔" 这条循环就彻底成不了立 ——
 * 挨摔的人一定拿得到一段完整的、能走能打的自由时间。
 */
export const THROW_PROTECT_FRAMES = 46;

export function throwConnects(
  gap: number,
  defenderPhase: string,
  defenderAirborne: boolean,
  defenderThrowProtect = 0
): boolean {
  if (defenderAirborne) return false;
  if (defenderThrowProtect > 0) return false;
  if ((THROW_IMMUNE_PHASES as readonly string[]).includes(defenderPhase)) return false;
  return gap <= THROW_RANGE;
}

// ---------------------------------------------------------------------------
// 倒地与受身
// ---------------------------------------------------------------------------

/** 倒地后这么多帧内按轻击可以受身（快速爬起来） */
export const TECH_WINDOW = 8;
/** 受身成功的起身帧 */
export const TECH_WAKEUP_FRAMES = 18;
/** 没受身的起身帧 */
export const NORMAL_WAKEUP_FRAMES = 40;
/**
 * 起身瞬间这么多帧打不到（免得刚站起来又被压回去）。
 * 1.1 给的 6 帧还不够连最快的轻击都躲不开一拍，1.2 提到 12 帧：
 * 起身的人至少来得及做一个选择（后退格挡 / 跳走 / 抢一手轻击）。
 */
export const WAKEUP_INVULN = 12;

export function techWindowOpen(framesSinceKnockdown: number): boolean {
  return framesSinceKnockdown >= 0 && framesSinceKnockdown <= TECH_WINDOW;
}

export function wakeupFrames(teched: boolean): number {
  return teched ? TECH_WAKEUP_FRAMES : NORMAL_WAKEUP_FRAMES;
}

// ---------------------------------------------------------------------------
// 能量槽
// ---------------------------------------------------------------------------

/** 挨打时也涨能量（涨得比出招少），这样落后的一方追得回来 */
export const METER_ON_TAKEN = 0.55;

export function meterAfterGain(meter: number, gain: number): number {
  return Math.max(0, Math.min(METER_MAX, meter + gain));
}

export function canPaySuper(meter: number): boolean {
  return meter >= SUPER_COST;
}

export function meterAfterPay(meter: number, cost: number): number {
  return Math.max(0, meter - cost);
}

// ---------------------------------------------------------------------------
// 手感：顿帧与抖动
// ---------------------------------------------------------------------------

/** 屏幕抖动幅度；`prefers-reduced-motion` 下恒为 0 */
export function shakeAmount(power: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.min(9, 1 + power * 0.22);
}

/** 命中顿帧；减弱动效时也保留（它是手感不是闪烁），但砍掉一半免得像卡住 */
export function hitStopFrames(move: Move, reducedMotion: boolean): number {
  return reducedMotion ? Math.round(move.hitStop / 2) : move.hitStop;
}

/** 星星特效数量：减弱动效时少一点，不闪 */
export function sparkCount(power: number, reducedMotion: boolean): number {
  const n = Math.min(12, 3 + Math.round(power * 0.35));
  return reducedMotion ? Math.min(4, n) : n;
}

// ---------------------------------------------------------------------------
// 元气与回合
// ---------------------------------------------------------------------------

export function vigorAfter(vigor: number, power: number): number {
  return Math.max(0, vigor - power);
}

export function isDown(vigor: number): boolean {
  return vigor <= 0;
}

/** 回合结果：0 = 一号位胜，1 = 二号位胜，-1 = 平局 */
export function roundResult(vigorA: number, vigorB: number): 0 | 1 | -1 {
  const aOut = isDown(vigorA);
  const bOut = isDown(vigorB);
  if (aOut && bOut) return -1;
  if (bOut) return 0;
  if (aOut) return 1;
  if (vigorA > vigorB) return 0;
  if (vigorB > vigorA) return 1;
  return -1;
}

/** 一场比赛打完没有：先赢 needed 回合的人拿下整场 */
export function matchOver(wins: readonly [number, number], needed: number): boolean {
  return wins[0] >= needed || wins[1] >= needed;
}

export function matchWinner(wins: readonly [number, number], needed: number): 0 | 1 | -1 {
  if (wins[0] >= needed && wins[0] > wins[1]) return 0;
  if (wins[1] >= needed && wins[1] > wins[0]) return 1;
  return -1;
}

/** 按剩余元气比例评星（格斗塔用：赢得越轻松星越多） */
export function rateByVigor(left: number, max: number): 1 | 2 | 3 {
  const ratio = max > 0 ? left / max : 0;
  if (ratio >= 0.7) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}
