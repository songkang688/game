/**
 * 朵星格斗王 —— 对局状态机。
 *
 * 一帧一步（`stepMatch`），完全确定性：同样的初始状态 + 同样的每帧按键
 * 一定得到同样的结果，所以整局比赛都能在单测里跑完并断言胜负。
 *
 * 这里只负责"世界怎么动"，具体的判定规矩全在 `rules.ts`，帧数字全在 `frames.ts`。
 * 渲染层（index.ts）每帧读 `state` 画画面，读 `state.events` 放音效和星星特效。
 */
import {
  METER_MAX,
  ROUND_FRAMES,
  STAGE_WIDTH,
  START_GAP,
  SUPER_COST,
  WALL_MARGIN,
  characterById,
  type Character,
  type Move,
  type MoveSlot
} from "./frames";
import {
  COMBO_RESET_FRAMES,
  GUARD_BREAK_FRAMES,
  METER_ON_TAKEN,
  NORMAL_WAKEUP_FRAMES,
  WAKEUP_INVULN,
  blocksAttack,
  bodyGap,
  canChain,
  canPaySuper,
  cappedOutcome,
  facingTowards,
  guardAfterBlock,
  guardRegen,
  holdingBack,
  hitStopFrames,
  hurtRect,
  isActiveFrame,
  isComboCapped,
  isGuardBroken,
  meterAfterGain,
  meterAfterPay,
  movePhase,
  pushApart,
  rectsOverlap,
  resolveClash,
  roundResult,
  scaledHitStun,
  scaledPower,
  shakeAmount,
  techWindowOpen,
  throwConnects,
  vigorAfter,
  wakeupFrames,
  worldBox,
  type Facing,
  type Stance
} from "./rules";

// ---------------------------------------------------------------------------
// 输入
// ---------------------------------------------------------------------------

export interface InputFrame {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** 轻击键 */
  light: boolean;
  /** 重击键 */
  heavy: boolean;
}

export function neutralInput(): InputFrame {
  return { left: false, right: false, up: false, down: false, light: false, heavy: false };
}

/** 只按了某几个键的输入（写测试和写 AI 都方便） */
export function inputOf(partial: Partial<InputFrame>): InputFrame {
  return { ...neutralInput(), ...partial };
}

// ---------------------------------------------------------------------------
// 选招：按键组合 → 招式槽位（纯函数，单独可测）
// ---------------------------------------------------------------------------

export interface PickContext {
  airborne: boolean;
  meter: number;
}

/**
 * 键位表（面向小学高年级，六种组合就够用）：
 *  地面 轻 / 重 / 蹲+轻 / 蹲+重（下段）/ 前+轻（必杀一）/ 前+重（必杀二）/ 后+重（必杀三）
 *      轻+重 同时 = 转圈摔；蹲 + 轻+重 同时 = 超必杀（要满槽）
 *  空中 轻 / 重 / 前+重（有空中必杀的角色才有）
 */
export function pickMove(char: Character, input: InputFrame, facing: Facing, ctx: PickContext): MoveSlot | null {
  const forward = facing === 1 ? input.right : input.left;
  const back = facing === 1 ? input.left : input.right;

  if (ctx.airborne) {
    const airSpecial = (["s1", "s2", "s3"] as MoveSlot[]).find((s) => char.moves[s].airOnly);
    if (forward && input.heavy && airSpecial) return airSpecial;
    if (input.light) return "jL";
    if (input.heavy) return "jH";
    return null;
  }

  if (input.light && input.heavy) {
    if (input.down && canPaySuper(ctx.meter)) return "super";
    return "throw";
  }
  if (forward && input.light && !char.moves.s1.airOnly) return "s1";
  if (forward && input.heavy && !char.moves.s2.airOnly) return "s2";
  if (back && input.heavy && !char.moves.s3.airOnly) return "s3";
  if (input.down && input.light) return "2L";
  if (input.down && input.heavy) return "2H";
  if (input.light) return "5L";
  if (input.heavy) return "5H";
  return null;
}

// ---------------------------------------------------------------------------
// 选手状态
// ---------------------------------------------------------------------------

export type FighterPhase =
  | "idle"
  | "walk"
  | "crouch"
  | "jump"
  | "attack"
  | "blockstun"
  | "hitstun"
  | "knockdown"
  | "guardbreak";

/** 这些状态下人是"自由的"，可以走、跳、出招 */
const FREE_PHASES: FighterPhase[] = ["idle", "walk", "crouch", "jump"];

export interface FighterBuff {
  /** 元气上限倍率 */
  vigorMul: number;
  /** 威力倍率 */
  powerMul: number;
  /** 移动速度倍率 */
  speedMul: number;
}

export function noBuff(): FighterBuff {
  return { vigorMul: 1, powerMul: 1, speedMul: 1 };
}

export interface FighterState {
  charId: string;
  side: 0 | 1;
  x: number;
  /** 脚底高度，0 = 站在地上 */
  y: number;
  vy: number;
  /** 水平惯性（击退与跳跃都用它） */
  vx: number;
  facing: Facing;
  vigor: number;
  maxVigor: number;
  meter: number;
  guard: number;
  guardMax: number;
  phase: FighterPhase;
  crouching: boolean;
  airborne: boolean;
  slot: MoveSlot | null;
  /** 当前招式进行到第几帧 */
  frame: number;
  /** 这一次出招已经判定过了（命中或被挡都算），防止一招打好几下 */
  hitDone: boolean;
  /** 硬直 / 起身剩余帧 */
  stun: number;
  /** 倒地之后过了几帧（受身窗口用） */
  downFrames: number;
  teched: boolean;
  /** 无敌帧（起身瞬间） */
  invuln: number;
  /** 这一段连段我打中了几下 */
  combo: number;
  /** 这一段连段已经用过哪几招（同一招不许在同一段里用第二次） */
  comboUsed: MoveSlot[];
  comboTimer: number;
  /** 这一帧在不在格挡姿势 */
  blocking: boolean;
  /** 本回合最长连段（结算展示） */
  bestCombo: number;
  buff: FighterBuff;
}

export type MatchEventType =
  | "hit"
  | "block"
  | "guardbreak"
  | "throw"
  | "clash"
  | "tech"
  | "super"
  | "whiff"
  | "ko"
  | "timeup";

export interface MatchEvent {
  type: MatchEventType;
  /** 事件由谁引发（0 / 1 号位） */
  side: 0 | 1;
  x: number;
  y: number;
  power: number;
  combo: number;
  slot: MoveSlot | null;
}

export interface MatchConfig {
  reducedMotion: boolean;
  /** 回合时限（帧），0 表示不计时 */
  timeLimit: number;
  /** 训练模式：元气不掉、打不完 */
  training: boolean;
}

export function defaultConfig(partial: Partial<MatchConfig> = {}): MatchConfig {
  return { reducedMotion: false, timeLimit: ROUND_FRAMES, training: false, ...partial };
}

export interface MatchState {
  frame: number;
  timeLeft: number;
  fighters: [FighterState, FighterState];
  /** 顿帧：大于 0 时全世界定格 */
  hitStop: number;
  shake: number;
  over: boolean;
  winner: 0 | 1 | -1;
  events: MatchEvent[];
  config: MatchConfig;
}

function makeFighter(charId: string, side: 0 | 1, buff: FighterBuff): FighterState {
  const ch = characterById(charId);
  const maxVigor = Math.max(20, Math.round(ch.vigor * buff.vigorMul));
  return {
    charId: ch.id,
    side,
    x: side === 0 ? STAGE_WIDTH / 2 - START_GAP : STAGE_WIDTH / 2 + START_GAP,
    y: 0,
    vy: 0,
    vx: 0,
    facing: side === 0 ? 1 : -1,
    vigor: maxVigor,
    maxVigor,
    meter: 0,
    guard: ch.guardMax,
    guardMax: ch.guardMax,
    phase: "idle",
    crouching: false,
    airborne: false,
    slot: null,
    frame: 0,
    hitDone: false,
    stun: 0,
    downFrames: 0,
    teched: false,
    invuln: 0,
    combo: 0,
    comboUsed: [],
    comboTimer: 0,
    blocking: false,
    bestCombo: 0,
    buff
  };
}

export interface MatchOptions {
  config?: Partial<MatchConfig>;
  buffs?: [FighterBuff, FighterBuff];
}

/** 开一场新对局（一个回合） */
export function createMatch(charA: string, charB: string, opts: MatchOptions = {}): MatchState {
  const buffs = opts.buffs ?? [noBuff(), noBuff()];
  const config = defaultConfig(opts.config);
  return {
    frame: 0,
    timeLeft: config.timeLimit,
    fighters: [makeFighter(charA, 0, buffs[0]), makeFighter(charB, 1, buffs[1])],
    hitStop: 0,
    shake: 0,
    over: false,
    winner: -1,
    events: [],
    config
  };
}

// ---------------------------------------------------------------------------
// 查询小工具（渲染层与 AI 都要用）
// ---------------------------------------------------------------------------

export function charOf(f: FighterState): Character {
  return characterById(f.charId);
}

export function currentMove(f: FighterState): Move | null {
  return f.slot ? charOf(f).moves[f.slot] : null;
}

export function stanceOf(f: FighterState): Stance {
  if (f.airborne) return "air";
  return f.crouching ? "crouch" : "stand";
}

export function isFree(f: FighterState): boolean {
  return FREE_PHASES.includes(f.phase);
}

export function fighterHurtRect(f: FighterState) {
  const ch = charOf(f);
  return hurtRect(f.x, f.y, ch.halfWidth, ch.height, ch.crouchHeight, f.crouching && !f.airborne);
}

export function activeHitRect(f: FighterState) {
  const mv = currentMove(f);
  if (!mv || f.phase !== "attack" || !isActiveFrame(mv, f.frame)) return null;
  return worldBox(f.x, f.y, f.facing, mv.box);
}

/** 两人身体之间的净距离 */
export function gapBetween(a: FighterState, b: FighterState): number {
  return bodyGap(a.x, b.x, charOf(a).halfWidth, charOf(b).halfWidth);
}

function clampToStage(f: FighterState): void {
  const half = charOf(f).halfWidth;
  const min = WALL_MARGIN + half;
  const max = STAGE_WIDTH - WALL_MARGIN - half;
  if (f.x < min) {
    f.x = min;
    if (f.vx < 0) f.vx = 0;
  }
  if (f.x > max) {
    f.x = max;
    if (f.vx > 0) f.vx = 0;
  }
}

function pushEvent(state: MatchState, ev: Partial<MatchEvent> & { type: MatchEventType; side: 0 | 1 }): void {
  state.events.push({ x: 0, y: 0, power: 0, combo: 0, slot: null, ...ev });
}

// ---------------------------------------------------------------------------
// 出招
// ---------------------------------------------------------------------------

/** 这一招现在能不能出（姿势对不对、能量够不够） */
export function moveUsable(f: FighterState, slot: MoveSlot): boolean {
  const mv = charOf(f).moves[slot];
  if (mv.airOnly && !f.airborne) return false;
  if (mv.groundOnly && f.airborne) return false;
  if (mv.meterCost > 0 && f.meter < mv.meterCost) return false;
  return true;
}

function startMove(state: MatchState, f: FighterState, slot: MoveSlot): void {
  const mv = charOf(f).moves[slot];
  f.phase = "attack";
  f.slot = slot;
  f.frame = 0;
  f.hitDone = false;
  f.blocking = false;
  if (mv.meterCost > 0) {
    f.meter = meterAfterPay(f.meter, mv.meterCost);
    pushEvent(state, { type: "super", side: f.side, x: f.x, y: f.y, slot });
  }
  // 地面招起手时把自己钉在地上（空中招保留空中惯性）
  if (mv.groundOnly) {
    f.airborne = false;
    f.y = 0;
    f.vy = 0;
  }
}

// ---------------------------------------------------------------------------
// 每帧：一个人的更新
// ---------------------------------------------------------------------------

function updateFighter(state: MatchState, f: FighterState, other: FighterState, input: InputFrame): void {
  const ch = charOf(f);

  if (f.invuln > 0) f.invuln--;
  if (f.comboTimer > 0) {
    f.comboTimer--;
    if (f.comboTimer === 0) {
      f.combo = 0;
      f.comboUsed = [];
    }
  }

  // 击退惯性：不管什么状态都在生效，撞墙自然停下
  f.x += f.vx;
  f.vx *= 0.86;
  if (Math.abs(f.vx) < 0.08) f.vx = 0;

  // 空中：抛物线
  if (f.airborne) {
    f.y += f.vy;
    f.vy -= ch.gravity;
    if (f.y <= 0) {
      f.y = 0;
      f.vy = 0;
      f.airborne = false;
      if (f.phase === "jump" || f.phase === "attack") {
        // 落地：空中招直接收招，跳跃落地回中立
        f.phase = "idle";
        f.slot = null;
        f.frame = 0;
      }
    }
  }

  switch (f.phase) {
    case "knockdown": {
      f.downFrames++;
      if (!f.teched && techWindowOpen(f.downFrames) && input.light) {
        f.teched = true;
        f.stun = Math.max(1, wakeupFrames(true) - f.downFrames);
        pushEvent(state, { type: "tech", side: f.side, x: f.x, y: f.y });
      }
      f.stun--;
      if (f.stun <= 0) {
        f.phase = "idle";
        f.slot = null;
        f.invuln = WAKEUP_INVULN;
        f.crouching = false;
      }
      return;
    }
    case "hitstun":
    case "blockstun":
    case "guardbreak": {
      f.stun--;
      if (f.stun <= 0 && !f.airborne) {
        f.phase = "idle";
        f.slot = null;
        f.crouching = false;
      } else if (f.stun <= 0 && f.airborne) {
        // 还在空中就先挂着，落地那一帧上面已经把状态收回去了
        f.phase = "jump";
      }
      return;
    }
    case "attack": {
      const mv = charOf(f).moves[f.slot as MoveSlot];
      f.frame++;
      // 命中 / 被挡之后可以取消成更"重"的招，这就是连段
      if (f.hitDone && movePhase(mv, f.frame) !== "done") {
        const next = pickMove(ch, input, f.facing, { airborne: f.airborne, meter: f.meter });
        if (next && moveUsable(f, next) && canChain(mv, ch.moves[next], f.comboUsed, f.combo)) {
          startMove(state, f, next);
          return;
        }
      }
      if (movePhase(mv, f.frame) === "done") {
        f.phase = f.airborne ? "jump" : "idle";
        f.slot = null;
        f.frame = 0;
      }
      return;
    }
    default:
      break;
  }

  // ---- 自由状态：转身、走、蹲、跳、出招 ----
  if (!f.airborne) {
    f.facing = facingTowards(f.x, other.x);
  }

  const speed = ch.walk * f.buff.speedMul;
  const backSpeed = ch.backWalk * f.buff.speedMul;
  const forward = f.facing === 1 ? input.right : input.left;
  const back = holdingBack(f.facing, input.left, input.right);

  // 起跳
  if (!f.airborne && input.up) {
    f.airborne = true;
    f.vy = ch.jump;
    f.phase = "jump";
    f.crouching = false;
    f.vx = forward ? speed * 0.9 : back ? -backSpeed * 0.9 : 0;
    return;
  }

  // 出招
  const slot = pickMove(ch, input, f.facing, { airborne: f.airborne, meter: f.meter });
  if (slot && moveUsable(f, slot)) {
    startMove(state, f, slot);
    return;
  }

  if (f.airborne) {
    f.phase = "jump";
    f.blocking = false;
    return;
  }

  // 蹲下 / 走动 / 站着
  f.crouching = input.down;
  f.blocking = back;
  if (f.crouching) {
    f.phase = "crouch";
  } else if (back) {
    // 后退就是格挡姿势，退得慢一点
    f.x -= f.facing * backSpeed;
    f.phase = "walk";
  } else if (forward) {
    f.x += f.facing * speed;
    f.phase = "walk";
  } else {
    f.phase = "idle";
  }

  if (!f.blocking) f.guard = guardRegen(f.guard, f.guardMax);
}

// ---------------------------------------------------------------------------
// 每帧：命中判定与结算
// ---------------------------------------------------------------------------

interface Contact {
  atk: 0 | 1;
  move: Move;
}

/**
 * 倒在地上的人打不到。
 * 少了这一条，站在旁边一直点轻击就能把对手永远按在地上（判定 0 威力 + 再次放倒），
 * 那就是最恶劣的一种无限连，所以倒地期间整个受击框都收起来。
 */
function hittable(d: FighterState): boolean {
  return d.phase !== "knockdown";
}

function findContacts(state: MatchState): Contact[] {
  const out: Contact[] = [];
  for (const atk of [0, 1] as const) {
    const a = state.fighters[atk];
    const d = state.fighters[1 - atk];
    const mv = currentMove(a);
    if (!mv || a.phase !== "attack" || a.hitDone || !isActiveFrame(mv, a.frame)) continue;
    if (!hittable(d)) continue;
    if (mv.kind === "throw") {
      if (throwConnects(gapBetween(a, d), d.phase, d.airborne)) out.push({ atk, move: mv });
      continue;
    }
    const hit = worldBox(a.x, a.y, a.facing, mv.box);
    if (rectsOverlap(hit, fighterHurtRect(d))) out.push({ atk, move: mv });
  }
  return out;
}

function isBlockingNow(d: FighterState, mv: Move, input: InputFrame): boolean {
  if (d.airborne) return false;
  if (mv.kind === "throw") return false;
  // 已经在格挡硬直里的人保持格挡（连续挡下一整串）
  const holding = d.phase === "blockstun" ? holdingBack(d.facing, input.left, input.right) : d.blocking;
  if (!holding) return false;
  if (!isFree(d) && d.phase !== "blockstun") return false;
  return blocksAttack(stanceOf(d), mv.height);
}

function applyContact(state: MatchState, c: Contact, defenderInput: InputFrame): void {
  const a = state.fighters[c.atk];
  const d = state.fighters[1 - c.atk];
  const mv = c.move;
  const dir: 1 | -1 = a.facing;
  a.hitDone = true;

  // 起身无敌：打空了，攻击方照样要收招
  if (d.invuln > 0) {
    pushEvent(state, { type: "whiff", side: a.side, x: d.x, y: d.y + 40, slot: mv.slot });
    return;
  }

  if (isBlockingNow(d, mv, defenderInput)) {
    d.guard = guardAfterBlock(d.guard, mv.guardCost);
    d.phase = "blockstun";
    d.stun = mv.blockStun;
    d.vx = dir * mv.knockback * 0.45;
    d.meter = meterAfterGain(d.meter, Math.round(mv.meterGain * 0.4));
    a.meter = meterAfterGain(a.meter, Math.round(mv.meterGain * 0.6));
    a.comboUsed.push(mv.slot);
    a.comboTimer = Math.max(a.comboTimer, mv.blockStun + COMBO_RESET_FRAMES);
    state.hitStop = Math.max(state.hitStop, Math.round(hitStopFrames(mv, state.config.reducedMotion) * 0.6));
    pushEvent(state, { type: "block", side: a.side, x: d.x, y: d.y + 46, power: 0, slot: mv.slot });
    if (isGuardBroken(d.guard)) {
      d.phase = "guardbreak";
      d.stun = GUARD_BREAK_FRAMES;
      d.guard = d.guardMax;
      d.crouching = false;
      pushEvent(state, { type: "guardbreak", side: a.side, x: d.x, y: d.y + 60, slot: mv.slot });
    }
    return;
  }

  // ---- 真的打中了 ----
  const hitIndex = a.combo;
  const capped = isComboCapped(hitIndex);
  const cap = cappedOutcome(mv);
  const basePower = Math.round(mv.power * a.buff.powerMul);
  const power = capped ? cap.power : scaledPower(basePower, hitIndex);
  const stun = capped ? cap.hitStun : scaledHitStun(mv.hitStun, hitIndex);
  const knockdown = capped || mv.knockdown === true;
  const knockback = capped ? cap.knockback : mv.knockback;

  if (!state.config.training) d.vigor = vigorAfter(d.vigor, power);
  d.vx = dir * knockback;
  d.crouching = false;
  d.blocking = false;

  if (mv.launch > 0 && !capped) {
    d.airborne = true;
    d.vy = mv.launch;
    d.y = Math.max(d.y, 1);
  }

  if (knockdown) {
    d.phase = "knockdown";
    d.stun = NORMAL_WAKEUP_FRAMES;
    d.downFrames = 0;
    d.teched = false;
    d.airborne = false;
    d.y = 0;
    d.vy = 0;
  } else {
    d.phase = "hitstun";
    d.stun = stun;
  }
  d.slot = null;

  a.combo++;
  a.comboUsed.push(mv.slot);
  a.comboTimer = stun + COMBO_RESET_FRAMES;
  a.bestCombo = Math.max(a.bestCombo, a.combo);
  a.meter = meterAfterGain(a.meter, mv.meterGain);
  d.meter = meterAfterGain(d.meter, Math.round(mv.meterGain * METER_ON_TAKEN));

  state.hitStop = Math.max(state.hitStop, hitStopFrames(mv, state.config.reducedMotion));
  state.shake = Math.max(state.shake, shakeAmount(power, state.config.reducedMotion));

  pushEvent(state, {
    type: mv.kind === "throw" ? "throw" : "hit",
    side: a.side,
    x: (a.x + d.x) / 2,
    y: d.y + 48,
    power,
    combo: a.combo,
    slot: mv.slot
  });
}

function resolveHits(state: MatchState, inputs: [InputFrame, InputFrame]): void {
  const contacts = findContacts(state);
  if (contacts.length === 0) return;
  if (contacts.length === 1) {
    applyContact(state, contacts[0], inputs[1 - contacts[0].atk]);
    return;
  }
  // 同帧对拼：优先级说了算
  const [ca, cb] = contacts;
  const who = resolveClash(ca.move, cb.move);
  if (who === "a") {
    applyContact(state, ca, inputs[1 - ca.atk]);
    cancelMoveInto(state.fighters[cb.atk], "hitstun");
  } else if (who === "b") {
    applyContact(state, cb, inputs[1 - cb.atk]);
    cancelMoveInto(state.fighters[ca.atk], "hitstun");
  } else {
    // 势均力敌：谁也没占到便宜，两个人一起弹开
    for (const c of contacts) {
      const f = state.fighters[c.atk];
      const o = state.fighters[1 - c.atk];
      f.hitDone = true;
      o.vx = f.facing * 3.4;
      f.meter = meterAfterGain(f.meter, Math.round(c.move.meterGain * 0.5));
    }
    const mid = (state.fighters[0].x + state.fighters[1].x) / 2;
    state.hitStop = Math.max(state.hitStop, 8);
    pushEvent(state, { type: "clash", side: 0, x: mid, y: 60 });
  }
}

/** 被抢先了：当前招直接作废，进入短硬直 */
function cancelMoveInto(f: FighterState, phase: FighterPhase): void {
  f.slot = null;
  f.frame = 0;
  f.hitDone = false;
  if (f.phase === "attack") {
    f.phase = phase;
    f.stun = Math.max(f.stun, 8);
  }
}

function resolveCollision(state: MatchState): void {
  const [a, b] = state.fighters;
  const shift = pushApart(a.x, b.x, charOf(a).halfWidth, charOf(b).halfWidth);
  if (shift > 0) {
    const dir = a.x <= b.x ? 1 : -1;
    a.x -= dir * shift;
    b.x += dir * shift;
  }
  clampToStage(a);
  clampToStage(b);
}

function checkEnd(state: MatchState): void {
  if (state.config.training) return;
  const [a, b] = state.fighters;
  if (a.vigor <= 0 || b.vigor <= 0) {
    state.over = true;
    state.winner = roundResult(a.vigor, b.vigor);
    pushEvent(state, { type: "ko", side: state.winner === 1 ? 1 : 0, x: STAGE_WIDTH / 2, y: 80 });
    return;
  }
  if (state.config.timeLimit > 0 && state.timeLeft <= 0) {
    state.over = true;
    state.winner = roundResult(a.vigor, b.vigor);
    pushEvent(state, { type: "timeup", side: 0, x: STAGE_WIDTH / 2, y: 80 });
  }
}

/**
 * 推进一帧。返回的就是传进来的那个 state（原地更新，省得每帧造垃圾）。
 * 顿帧期间世界定格，只把顿帧计数减一。
 */
export function stepMatch(state: MatchState, inputs: [InputFrame, InputFrame]): MatchState {
  state.events = [];
  if (state.over) return state;
  if (state.hitStop > 0) {
    state.hitStop--;
    return state;
  }
  state.frame++;
  if (state.config.timeLimit > 0 && state.timeLeft > 0) state.timeLeft--;
  state.shake = Math.max(0, state.shake * 0.82 - 0.15);

  updateFighter(state, state.fighters[0], state.fighters[1], inputs[0]);
  updateFighter(state, state.fighters[1], state.fighters[0], inputs[1]);
  resolveHits(state, inputs);
  resolveCollision(state);
  checkEnd(state);
  return state;
}

/** 连跑若干帧（测试与 AI 演练都用得上） */
export function runFrames(
  state: MatchState,
  frames: number,
  provider: (state: MatchState, frame: number) => [InputFrame, InputFrame]
): MatchState {
  for (let i = 0; i < frames && !state.over; i++) {
    stepMatch(state, provider(state, i));
  }
  return state;
}

/** 元气比例（画元气条用，0..1） */
export function vigorRatio(f: FighterState): number {
  return f.maxVigor > 0 ? Math.max(0, f.vigor / f.maxVigor) : 0;
}

/** 能量比例（0..1） */
export function meterRatio(f: FighterState): number {
  return Math.max(0, Math.min(1, f.meter / METER_MAX));
}

/** 能量够不够放超必杀 */
export function superReady(f: FighterState): boolean {
  return f.meter >= SUPER_COST;
}
