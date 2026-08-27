/**
 * 连招对决 —— 判定纯函数。
 *
 * 这里一个 DOM 都不碰、一个随机数都不掷:同样的输入永远得到同样的输出,
 * 所以取消窗口、超级取消、跳入落地接、破防、对拼、起身、贴边、连段衰减、BO3
 * 这些规矩全都能被单测牢牢盯住。
 *
 * 对局状态机在 `engine.ts`,它只调用这里的函数,不自己写判定。
 */
import {
  METER_MAX,
  SUPER_LV1_COST,
  SUPER_LV2_COST,
  totalFrames,
  type Box,
  type GuardHeight,
  type Move,
  type MoveKind,
  type MoveSlot,
  type Rect
} from "./frames";

export { totalFrames };

// ---------------------------------------------------------------------------
// 几何
// ---------------------------------------------------------------------------

/** 朝向:1 = 面朝右,-1 = 面朝左 */
export type Facing = 1 | -1;

/** 站姿:站 / 蹲 / 空中 */
export type Stance = "stand" | "crouch" | "air";

/** 把角色身上的相对框换算成世界坐标矩形 */
export function worldBox(x: number, y: number, facing: Facing, box: Box): Rect {
  return {
    x: facing === 1 ? x + box.x : x - box.x - box.w,
    y: y + box.y,
    w: box.w,
    h: box.h
  };
}

/** 两个矩形有没有重叠(边贴边不算) */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** 重叠中心(命中火花画在这儿) */
export function overlapCenter(a: Rect, b: Rect): { x: number; y: number } {
  const x1 = Math.max(a.x, b.x);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.max(a.y, b.y);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

/** 受击框:站着一个高、蹲下矮一截、空中跟站着一样但整体抬高 */
export function hurtRect(
  x: number,
  y: number,
  halfWidth: number,
  height: number,
  crouchHeight: number,
  stance: Stance
): Rect {
  return {
    x: x - halfWidth,
    y,
    w: halfWidth * 2,
    h: stance === "crouch" ? crouchHeight : height
  };
}

/** 我该面朝哪边 */
export function facingTowards(myX: number, otherX: number): Facing {
  return otherX >= myX ? 1 : -1;
}

/** 两人身体之间的净距离(贴在一起就是 0) */
export function bodyGap(xa: number, xb: number, halfA: number, halfB: number): number {
  return Math.max(0, Math.abs(xa - xb) - halfA - halfB);
}

/** 身体挤在一起时各自要挪多远(对半分) */
export function pushApart(xa: number, xb: number, halfA: number, halfB: number): number {
  const need = halfA + halfB;
  const gap = Math.abs(xa - xb);
  if (gap >= need) return 0;
  return (need - gap) / 2;
}

// ---------------------------------------------------------------------------
// 帧:起手 / 命中 / 收招
// ---------------------------------------------------------------------------

export type MovePhase = "startup" | "active" | "recovery" | "done";

/** 招式进行到第 frame 帧(0 基)时处在哪一段 */
export function movePhase(move: Move, frame: number): MovePhase {
  if (frame < move.startup) return "startup";
  if (frame < move.startup + move.active) return "active";
  if (frame < totalFrames(move)) return "recovery";
  return "done";
}

/** 这一帧判定框生效吗 */
export function isActiveFrame(move: Move, frame: number): boolean {
  return movePhase(move, frame) === "active";
}

/** 超必的无敌帧 */
export function isInvulnFrame(move: Move, frame: number): boolean {
  if (move.invulnFrom === undefined || move.invulnTo === undefined) return false;
  return frame >= move.invulnFrom && frame <= move.invulnTo;
}

/** 命中第一帧之后还剩多少帧动不了 */
export function framesAfterFirstActive(move: Move): number {
  return move.active - 1 + move.recovery;
}

/** 被挡下的帧数差:正数 = 我先能动 */
export function onBlockAdvantage(move: Move): number {
  return move.blockStun - framesAfterFirstActive(move);
}

/** 命中之后的帧数差 */
export function onHitAdvantage(move: Move): number {
  return move.hitStun - framesAfterFirstActive(move);
}

/** 被挡下会不会被狠狠反击 */
export const PUNISH_THRESHOLD = -9;

export function punishableOnBlock(move: Move): boolean {
  return onBlockAdvantage(move) <= PUNISH_THRESHOLD;
}

// ---------------------------------------------------------------------------
// 上中下段:站挡蹲挡各挡得住什么
// ---------------------------------------------------------------------------

/**
 * 这个姿势(按住后方向)挡不挡得住这个高度的招。
 *  · 上段:必须**站**着挡,蹲着要挨;
 *  · 下段:必须**蹲**着挡,站着要挨;
 *  · 中段:站蹲都能挡;
 *  · 投技:谁都挡不住。
 */
export function guardBeats(height: GuardHeight, crouching: boolean): boolean {
  if (height === "throw") return false;
  if (height === "high") return !crouching;
  if (height === "low") return crouching;
  return true;
}

/** 按住"远离对手"的方向键就是在格挡 */
export function holdingBack(facing: Facing, left: boolean, right: boolean): boolean {
  return facing === 1 ? left && !right : right && !left;
}

/** 综合判定:这一下挡下来了吗(空中不能防御) */
export function canGuard(stance: Stance, height: GuardHeight, back: boolean): boolean {
  if (!back) return false;
  if (stance === "air") return false;
  return guardBeats(height, stance === "crouch");
}

// ---------------------------------------------------------------------------
// 取消窗口:只有 active **命中之后** 那几帧能取消
// ---------------------------------------------------------------------------

/** 取消窗口从哪一帧开始(命中帧的第一帧) */
export function cancelWindowStart(move: Move): number {
  return move.startup;
}

/** 取消窗口到哪一帧结束(含) */
export function cancelWindowEnd(move: Move): number {
  return move.startup + move.active - 1 + move.cancelLag;
}

/**
 * 现在能不能取消。
 * `hasHit` 为假(空振或者还没碰到人)时窗口根本不开 —— 空振取消一律失败,进收招。
 */
export function inCancelWindow(move: Move, frame: number, hasHit: boolean): boolean {
  if (!hasHit) return false;
  if (move.cancelLag <= 0) return false;
  return frame >= cancelWindowStart(move) && frame <= cancelWindowEnd(move);
}

/** 空振还想取消的下场:取消失败,照常收招 */
export function whiffCancelFails(move: Move, frame: number, hasHit: boolean): boolean {
  return !hasHit && frame >= cancelWindowStart(move) && frame < totalFrames(move);
}

/**
 * 取消表:一招命中 / 被挡之后可以取消成哪几类。
 * 轻 → 轻 / 重 / 必杀 / 超必,重 → 必杀 / 超必,必杀 → 超必,一条单向的路。
 */
export const CANCEL_TABLE: Record<MoveKind, MoveKind[]> = {
  light: ["light", "heavy", "special", "super"],
  heavy: ["special", "super"],
  special: ["super"],
  super: [],
  throw: []
};

/** 单看类别能不能取消 */
export function canCancelInto(from: Move, to: Move): boolean {
  return CANCEL_TABLE[from.kind].includes(to.kind);
}

/** 类别 + 窗口一起看 */
export function canCancelNow(from: Move, to: Move, frame: number, hasHit: boolean): boolean {
  return inCancelWindow(from, frame, hasHit) && canCancelInto(from, to);
}

// ---------------------------------------------------------------------------
// 超级取消:必杀命中的那几帧里花槽换成超必
// ---------------------------------------------------------------------------

/** 超必等级:0 = 放不出,1 = LV1(槽 50),2 = LV2(槽 100) */
export type SuperLevel = 0 | 1 | 2;

/** 一级超必要多少槽 */
export function superCost(level: SuperLevel): number {
  if (level === 2) return SUPER_LV2_COST;
  if (level === 1) return SUPER_LV1_COST;
  return 0;
}

/** 这么多槽最高能放到几级超必 */
export function superLevelFor(meter: number): SuperLevel {
  if (meter >= SUPER_LV2_COST) return 2;
  if (meter >= SUPER_LV1_COST) return 1;
  return 0;
}

/**
 * 超级取消:只有**必杀**能取消成超必,而且要付得起槽。
 * 普通招要先取消成必杀再超级取消,超必自己不能再取消。
 */
export function canSuperCancel(from: Move, meter: number): SuperLevel {
  if (from.kind !== "special") return 0;
  return superLevelFor(meter);
}

/** 放完超必之后剩多少槽 */
export function meterAfterSuper(meter: number, level: SuperLevel): number {
  return Math.max(0, Math.min(METER_MAX, meter - superCost(level)));
}

/** 涨槽(封顶 100) */
export function meterAfterGain(meter: number, gain: number): number {
  return Math.max(0, Math.min(METER_MAX, meter + gain));
}

/** 挨打时也涨槽,涨得比出招少 */
export const METER_ON_TAKEN = 0.5;
/** 挡下时涨得更少 */
export const METER_ON_BLOCKED = 0.25;

// ---------------------------------------------------------------------------
// 跳入:空中命中之后落地能接地面连
// ---------------------------------------------------------------------------

/** 落地硬直帧数 */
export const LANDING_LAG = 7;
/** 空中招命中过之后,落地硬直的前几帧可以取消成地面招 */
export const LAND_CANCEL_WINDOW = 5;

/**
 * 跳入落地接:空中招**命中过**才开窗口,而且只在落地硬直的前几帧。
 * 空振落地就得老老实实站完 `LANDING_LAG` 帧。
 */
export function landCancel(airHit: boolean, landingFrame: number): boolean {
  if (!airHit) return false;
  return landingFrame >= 0 && landingFrame < LAND_CANCEL_WINDOW;
}

/** 空中招命中之后落地还剩多少硬直 */
export function landingLagAfter(airHit: boolean): number {
  return airHit ? LANDING_LAG - LAND_CANCEL_WINDOW : LANDING_LAG;
}

// ---------------------------------------------------------------------------
// 护盾槽与破防
// ---------------------------------------------------------------------------

/** 挡一下之后剩多少护盾 */
export function guardAfterBlock(guard: number, cost: number): number {
  return Math.max(0, guard - cost);
}

/** 护盾见底就是破防 */
export function guardCrush(guardMeter: number): boolean {
  return guardMeter <= 0;
}

/** 破防之后愣多少帧:比任何普通硬直都长得多,够对手接一整套 */
export const GUARD_CRUSH_STUN = 54;
/** 一般硬直的上限(用来证明"破防硬直显著变长") */
export const MAX_NORMAL_STUN = 40;

export function guardBreakStun(): number {
  return GUARD_CRUSH_STUN;
}

/** 不挡的时候护盾每帧回一点 */
export const GUARD_REGEN_PER_FRAME = 0.2;

export function guardRegen(guard: number, max: number, frames = 1): number {
  return Math.min(max, guard + GUARD_REGEN_PER_FRAME * frames);
}

// ---------------------------------------------------------------------------
// 对拼:同帧判定框重叠,优先级差 ≤ 1 就火花互退
// ---------------------------------------------------------------------------

export type ClashOutcome = "clash" | "a" | "b";

/** 对拼算不算成立的优先级差上限 */
export const CLASH_PRIORITY_GAP = 1;

/** 同帧双方判定框都生效时:差 ≤ 1 → 互退,否则优先级高的那招打中 */
export function clashOrHit(a: Move, b: Move): ClashOutcome {
  if (Math.abs(a.priority - b.priority) <= CLASH_PRIORITY_GAP) return "clash";
  return a.priority > b.priority ? "a" : "b";
}

/** 互退的距离与愣住的帧数 */
export const CLASH_PUSHBACK = 16;
export const CLASH_FREEZE = 12;

// ---------------------------------------------------------------------------
// 倒地与起身三选一
// ---------------------------------------------------------------------------

/** 起身方式:受身落地 / 原地起 / 后跳起 */
export type WakeupKind = "tech" | "inPlace" | "backRoll";

export const WAKEUP_KINDS: WakeupKind[] = ["tech", "inPlace", "backRoll"];

export const WAKEUP_LABELS: Record<WakeupKind, string> = {
  tech: "受身落地",
  inPlace: "原地起来",
  backRoll: "后跳起来"
};

/** 倒地后这么多帧内按键才算受身 */
export const TECH_WINDOW = 9;

export function techWindowOpen(framesSinceKnockdown: number): boolean {
  return framesSinceKnockdown >= 0 && framesSinceKnockdown <= TECH_WINDOW;
}

/** 现在能选哪几种起身:受身窗口关了就只剩原地起和后跳起 */
export function wakeupOptions(canTech: boolean): WakeupKind[] {
  return canTech ? [...WAKEUP_KINDS] : ["inPlace", "backRoll"];
}

/** 三种起身各要多少帧 */
export const WAKEUP_FRAMES: Record<WakeupKind, number> = { tech: 17, inPlace: 30, backRoll: 36 };

export function wakeupFrames(kind: WakeupKind): number {
  return WAKEUP_FRAMES[kind];
}

/** 后跳起会往后挪一段,其它两种原地起 */
export function wakeupShift(kind: WakeupKind): number {
  return kind === "backRoll" ? 46 : 0;
}

/** 起身前几帧投技无敌(免得刚站起来就被抓) */
export const THROW_INVULN_FRAMES = 4;

/** 起身开始后第 framesSinceWakeup 帧还在投无敌里吗 */
export function throwInvuln(framesSinceWakeup: number): boolean {
  return framesSinceWakeup >= 0 && framesSinceWakeup < THROW_INVULN_FRAMES;
}

/** 投技抓得到的净距离 */
export const THROW_RANGE = 20;

/** 这些状态抓不着人 */
export const THROW_IMMUNE_PHASES = [
  "hitstun",
  "blockstun",
  "knockdown",
  "guardbreak",
  "grabbed",
  "rest"
] as const;

export function throwConnects(
  gap: number,
  defenderPhase: string,
  defenderAirborne: boolean,
  defenderThrowInvuln: boolean
): boolean {
  if (defenderAirborne) return false;
  if (defenderThrowInvuln) return false;
  if ((THROW_IMMUNE_PHASES as readonly string[]).includes(defenderPhase)) return false;
  return gap <= THROW_RANGE;
}

/** 跳投:双方都在空中,而且靠得够近 */
export const AIR_THROW_RANGE = 26;

export function airThrowConnects(gap: number, attackerAir: boolean, defenderAir: boolean, defenderPhase: string): boolean {
  if (!attackerAir || !defenderAir) return false;
  if ((THROW_IMMUNE_PHASES as readonly string[]).includes(defenderPhase)) return false;
  return gap <= AIR_THROW_RANGE;
}

// ---------------------------------------------------------------------------
// 贴边:场地有边角,贴边连段更厚
// ---------------------------------------------------------------------------

/** 离边多近算"贴边" */
export const CORNER_MARGIN = 54;

/** 把角色夹在场地里,并报告贴到了哪一边 */
export function cornerClamp(
  x: number,
  halfWidth: number,
  stageWidth: number
): { x: number; atCorner: "left" | "right" | null } {
  const lo = halfWidth;
  const hi = stageWidth - halfWidth;
  if (x <= lo) return { x: lo, atCorner: "left" };
  if (x >= hi) return { x: hi, atCorner: "right" };
  return { x, atCorner: null };
}

/** 贴边了吗(还没碰到墙,但已经很近) */
export function isCornered(x: number, halfWidth: number, stageWidth: number): boolean {
  return x - halfWidth <= CORNER_MARGIN || stageWidth - halfWidth - x <= CORNER_MARGIN;
}

/** 贴边硬直加成:被逼到角落里更容易被接住 */
export const CORNER_HITSTUN_BONUS = 4;

export function cornerHitStun(base: number, cornered: boolean): number {
  return cornered ? base + CORNER_HITSTUN_BONUS : base;
}

/** 贴边击退打折:推不动了,所以连段接得上 */
export const CORNER_KNOCKBACK_SCALE = 0.45;

export function cornerKnockback(base: number, cornered: boolean): number {
  return cornered ? base * CORNER_KNOCKBACK_SCALE : base;
}

// ---------------------------------------------------------------------------
// 连段衰减与无限连防护
// ---------------------------------------------------------------------------

/** 地面连段的威力递减 */
export const COMBO_SCALES = [1, 0.9, 0.8, 0.72, 0.64, 0.56, 0.48, 0.42];
/** 递减地板 */
export const MIN_COMBO_SCALE = 0.35;

export function comboScale(hitIndex: number): number {
  if (hitIndex <= 0) return 1;
  return COMBO_SCALES[hitIndex] ?? MIN_COMBO_SCALE;
}

/** 空中连(juggle)另有一套更狠的递减 */
export const JUGGLE_SCALES = [1, 0.8, 0.65, 0.52, 0.42, 0.34];
export const MIN_JUGGLE_SCALE = 0.25;

export function juggleScale(hitIndex: number): number {
  if (hitIndex <= 0) return 1;
  return JUGGLE_SCALES[hitIndex] ?? MIN_JUGGLE_SCALE;
}

/** 第 hitIndex 段(0 基)实际削多少元气 */
export function scaledPower(base: number, hitIndex: number, airborne = false): number {
  const scale = airborne ? juggleScale(hitIndex) : comboScale(hitIndex);
  return Math.max(1, Math.round(base * scale));
}

/** 连段越往后硬直越短,连段自己就会断 */
export function scaledHitStun(base: number, hitIndex: number): number {
  return Math.max(7, Math.round(base - hitIndex * 2));
}

/** 超过这么多段强制倒地 —— 无限连防护的最后一道闸 */
export const JUGGLE_LIMIT = 8;

export function forcedKnockdown(hits: number): boolean {
  return hits >= JUGGLE_LIMIT;
}

/** 连段计数多久不挨新的一下就清零(帧) */
export const COMBO_RESET_FRAMES = 26;

/** 一串招接不接得起来(训练模式检查用) */
export function isValidCombo(moves: readonly Move[]): boolean {
  if (moves.length === 0) return false;
  if (moves.length > JUGGLE_LIMIT) return false;
  const used: MoveSlot[] = [moves[0].slot];
  for (let i = 1; i < moves.length; i++) {
    const from = moves[i - 1];
    const to = moves[i];
    if (!canCancelInto(from, to)) return false;
    if (to.slot === from.slot) return false;
    if (used.includes(to.slot)) return false;
    used.push(to.slot);
  }
  return true;
}

/** 一串连段一共削多少元气 */
export function comboTotalPower(moves: readonly Move[], airborne = false): number {
  let total = 0;
  for (let i = 0; i < moves.length && i < JUGGLE_LIMIT; i++) {
    total += scaledPower(moves[i].power, i, airborne);
  }
  return total;
}

// ---------------------------------------------------------------------------
// 元气与回合(BO3)
// ---------------------------------------------------------------------------

export function vigorAfter(vigor: number, power: number): number {
  return Math.max(0, vigor - power);
}

/** 元气见底 = 坐下休息,这一回合到此为止 */
export function isResting(vigor: number): boolean {
  return vigor <= 0;
}

/** 回合结果:0 = 一号位胜,1 = 二号位胜,-1 = 平局 */
export function roundResult(vigorA: number, vigorB: number): 0 | 1 | -1 {
  const aOut = isResting(vigorA);
  const bOut = isResting(vigorB);
  if (aOut && bOut) return -1;
  if (bOut) return 0;
  if (aOut) return 1;
  if (vigorA > vigorB) return 0;
  if (vigorB > vigorA) return 1;
  return -1;
}

/** 三局两胜:先赢两回合 */
export const ROUNDS_TO_WIN = 2;
/** BO3 最多打几回合(含平局重来的上限) */
export const MAX_ROUNDS = 5;

export function matchOver(wins: readonly [number, number], needed: number = ROUNDS_TO_WIN): boolean {
  return wins[0] >= needed || wins[1] >= needed;
}

export function matchResult(wins: readonly [number, number], needed: number = ROUNDS_TO_WIN): 0 | 1 | -1 {
  if (wins[0] >= needed && wins[0] > wins[1]) return 0;
  if (wins[1] >= needed && wins[1] > wins[0]) return 1;
  return -1;
}

/** 按剩余元气比例评星(闯关塔用) */
export function rateByVigor(left: number, max: number): 1 | 2 | 3 {
  const ratio = max > 0 ? left / max : 0;
  if (ratio >= 0.68) return 3;
  if (ratio >= 0.34) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// 手感:顿帧、抖动、火花
// ---------------------------------------------------------------------------

/** 命中顿帧;`prefers-reduced-motion` 下为 0 */
export function hitStopFrames(move: Move, reducedMotion: boolean): number {
  return reducedMotion ? 0 : move.hitStop;
}

/** 屏幕抖动幅度;减弱动效时恒为 0 */
export function shakeAmount(power: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.min(8, 1 + power * 0.2);
}

/** 命中火花的星星数量 */
export function sparkCount(power: number, reducedMotion: boolean): number {
  const n = Math.min(14, 3 + Math.round(power * 0.35));
  return reducedMotion ? Math.min(4, n) : n;
}

/** 超必演出帧数;减弱动效时直接跳过演出只结算 */
export const SUPER_CUTIN_FRAMES = 20;

export function superCutinFrames(reducedMotion: boolean): number {
  return reducedMotion ? 0 : SUPER_CUTIN_FRAMES;
}

// ---------------------------------------------------------------------------
// 简化指令与输入历史
// ---------------------------------------------------------------------------

export interface InputFrame {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** 轻击(朵朵 F / 星星 L) */
  light: boolean;
  /** 重击(朵朵 G / 星星 K) */
  heavy: boolean;
  /** 必杀钮(F+G 同按,或手机上的第三个大钮) */
  burst: boolean;
}

export function neutralInput(): InputFrame {
  return { left: false, right: false, up: false, down: false, light: false, heavy: false, burst: false };
}

export function inputOf(partial: Partial<InputFrame>): InputFrame {
  return { ...neutralInput(), ...partial };
}

/** 指令输入的判定窗口(帧) */
export const COMMAND_WINDOW = 14;

/**
 * 简化指令:「下 → 前 + 重」。
 * 在最近 `COMMAND_WINDOW` 帧里先出现过「下」,之后某一帧同时按住「前」和「重」就算成立。
 * 一键必杀钮走另一条路,两种都能出必杀。
 */
export function readCommand(history: readonly InputFrame[], facing: Facing, window: number = COMMAND_WINDOW): boolean {
  const start = Math.max(0, history.length - window);
  let sawDown = false;
  for (let i = start; i < history.length; i++) {
    const f = history[i];
    if (f.down) {
      sawDown = true;
      continue;
    }
    const forward = facing === 1 ? f.right : f.left;
    if (sawDown && forward && f.heavy) return true;
  }
  return false;
}

/** 一帧输入写成人看得懂的一小段(训练模式的输入历史) */
export function describeInput(f: InputFrame, facing: Facing): string {
  const parts: string[] = [];
  const forward = facing === 1 ? f.right : f.left;
  const back = facing === 1 ? f.left : f.right;
  if (f.up) parts.push("↑");
  if (f.down) parts.push("↓");
  if (forward) parts.push("前");
  if (back) parts.push("后");
  if (f.light) parts.push("轻");
  if (f.heavy) parts.push("重");
  if (f.burst) parts.push("必杀");
  return parts.length > 0 ? parts.join("") : "·";
}

/** 输入历史最多留几条 */
export const INPUT_HISTORY_MAX = 12;

/** 把新的一帧记进输入历史(只记有动作的帧,连续重复的合并) */
export function pushHistory(history: readonly string[], label: string, max: number = INPUT_HISTORY_MAX): string[] {
  if (label === "·") return [...history];
  if (history.length > 0 && history[history.length - 1] === label) return [...history];
  const next = [...history, label];
  return next.length > max ? next.slice(next.length - max) : next;
}

// ---------------------------------------------------------------------------
// 训练假人
// ---------------------------------------------------------------------------

/** 假人行为:站着 / 一直跳 / 一直挡 / 挡一下就还手 */
export type DummyMode = "stand" | "jump" | "block" | "counter";

export const DUMMY_MODES: DummyMode[] = ["stand", "jump", "block", "counter"];

export const DUMMY_LABELS: Record<DummyMode, string> = {
  stand: "站着不动",
  jump: "一直跳",
  block: "一直挡",
  counter: "挡完就还手"
};
