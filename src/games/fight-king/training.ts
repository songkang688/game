/**
 * 朵星格斗王 —— 训练场的两件东西，都是纯函数：
 *
 *  1. **帧数据读数**：当前这一招的起手 / 命中 / 收招各几帧、现在处在哪一段、
 *     这一段还剩几帧、挡下与命中的帧数差、**能不能取消、能取消成哪几招**。
 *  2. **假人行为**：站立不动 / 蹲着格挡 / 随机反击，三选一。
 *
 * 一个 DOM 都不碰、一个 `Math.random()` 都不掷（随机数由调用方传进来），
 * 所以整块都能被单测按住，界面怎么改都不影响这里的结论。
 */
import {
  MOVE_SLOTS,
  characterById,
  type Character,
  type Move,
  type MoveSlot,
  totalFrames
} from "./frames";
import { holdingBack, movePhase, onBlockAdvantage, onHitAdvantage, canChain, type MovePhase } from "./rules";
import { inputOf, type FighterState, type InputFrame } from "./engine";

/* ------------------------------------------------------------------ */
/* 一、帧数据读数                                                      */
/* ------------------------------------------------------------------ */

/** 三段的中文名（界面与读屏共用一份，不许各写各的） */
export const PHASE_LABELS: Record<MovePhase | "idle", string> = {
  startup: "起手",
  active: "命中",
  recovery: "收招",
  done: "收完了",
  idle: "站着没动"
};

/** 出招时的场上状态，决定哪些招现在真的接得上 */
export interface TrainContext {
  /** 这一招已经打中（或被挡下）了吗 —— 没打中是取消不了的 */
  hitDone: boolean;
  /** 这一段连段已经用过哪几个槽 */
  used: readonly MoveSlot[];
  /** 这一段连段已经打中几下 */
  hits: number;
  /** 现在有多少能量（超必杀要满槽） */
  meter: number;
  /** 人在空中吗（地面招和空中招互相出不了） */
  airborne: boolean;
}

export function emptyContext(): TrainContext {
  return { hitDone: false, used: [], hits: 0, meter: 0, airborne: false };
}

/** 这一招现在这个姿势 / 这点能量出得来吗（与引擎的 `moveUsable` 同一套规矩） */
export function usableNow(mv: Move, ctx: TrainContext): boolean {
  if (mv.airOnly && !ctx.airborne) return false;
  if (mv.groundOnly && ctx.airborne) return false;
  return !(mv.meterCost > 0 && ctx.meter < mv.meterCost);
}

/**
 * 现在这一招能取消成哪几招（按槽位顺序返回，接不了就是空数组）。
 * 三个条件缺一不可：已经打中、取消表允许、这一招现在出得来。
 */
export function cancelTargets(char: Character, from: Move, ctx: TrainContext): MoveSlot[] {
  if (!ctx.hitDone) return [];
  return MOVE_SLOTS.filter((slot) => {
    const to = char.moves[slot];
    return usableNow(to, ctx) && canChain(from, to, ctx.used, ctx.hits);
  });
}

export interface FrameReadout {
  /** 正在出招吗 */
  attacking: boolean;
  moveName: string;
  slot: MoveSlot | null;
  startup: number;
  active: number;
  recovery: number;
  total: number;
  phase: MovePhase | "idle";
  phaseLabel: string;
  /** 招式进行到第几帧（1 基，给人看的；没出招就是 0） */
  frame: number;
  /** 当前这一段还剩几帧 */
  phaseLeft: number;
  /** 挡下之后的帧数差（正数 = 我先能动） */
  onBlock: number;
  /** 命中之后的帧数差 */
  onHit: number;
  /** 现在能不能取消 */
  cancelable: boolean;
  /** 能取消成哪几招（招式名） */
  cancelInto: string[];
}

/** 没出招时的读数（站着不动也要有东西显示，不能一片空白） */
export function idleReadout(): FrameReadout {
  return {
    attacking: false,
    moveName: "—",
    slot: null,
    startup: 0,
    active: 0,
    recovery: 0,
    total: 0,
    phase: "idle",
    phaseLabel: PHASE_LABELS.idle,
    frame: 0,
    phaseLeft: 0,
    onBlock: 0,
    onHit: 0,
    cancelable: false,
    cancelInto: []
  };
}

/**
 * 把「角色 + 当前槽位 + 当前帧」算成一份可以直接往屏幕上贴的读数。
 * 这是训练场的心脏，所以它必须是纯的：给同样的输入永远同样的输出。
 */
export function frameReadout(
  char: Character,
  slot: MoveSlot | null,
  frame: number,
  ctx: TrainContext = emptyContext()
): FrameReadout {
  if (!slot) return idleReadout();
  const mv = char.moves[slot];
  const phase = movePhase(mv, frame);
  const targets = cancelTargets(char, mv, ctx);
  return {
    attacking: phase !== "done",
    moveName: mv.name,
    slot,
    startup: mv.startup,
    active: mv.active,
    recovery: mv.recovery,
    total: totalFrames(mv),
    phase,
    phaseLabel: PHASE_LABELS[phase],
    frame: Math.max(0, Math.min(totalFrames(mv), frame + 1)),
    phaseLeft: phaseLeftOf(mv, frame),
    onBlock: onBlockAdvantage(mv),
    onHit: onHitAdvantage(mv),
    cancelable: targets.length > 0,
    cancelInto: targets.map((s) => char.moves[s].name)
  };
}

/** 当前这一段还剩几帧（收完了就是 0） */
export function phaseLeftOf(mv: Move, frame: number): number {
  switch (movePhase(mv, frame)) {
    case "startup":
      return mv.startup - Math.max(0, frame);
    case "active":
      return mv.startup + mv.active - frame;
    case "recovery":
      return totalFrames(mv) - frame;
    default:
      return 0;
  }
}

/** 帧数差写成带正负号的字符串（界面上 +3 / −7 一眼看得懂） */
export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** 训练场那几行字（纯函数，测试直接比字符串） */
export function readoutLines(r: FrameReadout, combo: number, bestCombo: number, gap: number): string[] {
  const head = r.attacking
    ? `${r.moveName}　起手 ${r.startup} / 命中 ${r.active} / 收招 ${r.recovery}`
    : "站着没动　按一下攻击键就能看到帧数";
  const now = r.attacking
    ? `现在：${r.phaseLabel}（第 ${r.frame} / ${r.total} 帧，本段还剩 ${r.phaseLeft} 帧）`
    : "现在：站着没动";
  const adv = r.attacking ? `挡下 ${signed(r.onBlock)}　命中 ${signed(r.onHit)}` : "挡下 —　命中 —";
  const cancel = r.cancelable ? `可以取消成：${r.cancelInto.join(" / ")}` : "现在取消不了";
  return [head, now, adv, cancel, `连段 ${combo} 段（本次最长 ${bestCombo} 段）　与陪练的距离 ${Math.round(gap)}`];
}

/* ------------------------------------------------------------------ */
/* 二、假人行为                                                        */
/* ------------------------------------------------------------------ */

/** 三种假人：站着不动 / 蹲着格挡 / 随机反击 */
export type DummyMode = "stand" | "guard" | "counter";

export const DUMMY_MODES: DummyMode[] = ["stand", "guard", "counter"];

export const DUMMY_LABELS: Record<DummyMode, string> = {
  stand: "站立",
  guard: "蹲防",
  counter: "随机反击"
};

export const DUMMY_HINTS: Record<DummyMode, string> = {
  stand: "一动不动，拿来量连段能打几段、每段掉多少",
  guard: "一直蹲着挡，拿来看哪些招挡下来是亏的（挡下那一栏是负数就要挨反击）",
  counter: "挡完会随机还手，拿来练「打完就退」和确反的节奏"
};

/** 反击型假人还手的概率（每次重新拿主意时掷一遍） */
export const COUNTER_CHANCE = 0.45;

/** 面朝对手时，"后退"对应哪个方向键 */
function backKeyOf(me: FighterState): "left" | "right" {
  return me.facing === 1 ? "left" : "right";
}

/**
 * 假人这一帧按什么键。
 * `rand` 由调用方给（界面给真随机、测试给固定序列），所以这个函数是纯的。
 */
export function dummyInput(mode: DummyMode, me: FighterState, foe: FighterState, rand: () => number): InputFrame {
  const back = backKeyOf(me);

  // 倒地了先爬起来：三种假人都会受身，不然练手的人要干等
  if (me.phase === "knockdown") return inputOf({ light: true });

  if (mode === "stand") return inputOf({});

  if (mode === "guard") return inputOf({ [back]: true, down: true } as Partial<InputFrame>);

  // 随机反击：对手在起手 / 命中就老实蹲防，等他收招或者站着发呆再掷骰子还手
  const guard = inputOf({ [back]: true, down: true } as Partial<InputFrame>);
  if (foePhaseOf(foe) === "startup" || foePhaseOf(foe) === "active") return guard;
  return rand() < COUNTER_CHANCE ? inputOf({ light: true }) : guard;
}

/** 对手正处在自己招式的哪一段（没出招返回 null） */
export function foePhaseOf(foe: FighterState): MovePhase | null {
  if (foe.phase !== "attack" || !foe.slot) return null;
  return movePhase(characterById(foe.charId).moves[foe.slot], foe.frame);
}

/** 按住"远离对手"就是格挡：给界面上的小提示用 */
export function dummyIsBlocking(input: InputFrame, me: FighterState): boolean {
  return holdingBack(me.facing, input.left, input.right);
}
