/**
 * 连招对决 —— 逐帧对局状态机。
 *
 * 60 逻辑帧/秒,没有任何随机数:同样的输入序列跑出来永远是同一场比赛,
 * 所以 AI 强度、闯关能不能打赢、连段接不接得上,全都能用单测钉住。
 *
 * 判定一律调 `rules.ts`,帧数据一律读 `frames.ts`,这里只管"状态怎么变"。
 * 一个 DOM 都不碰 —— 画面在 `index.ts` 里照着这份状态画。
 */
import { characterById, type Character, type GuardHeight, type Move, type MoveSlot, type Rect } from "./frames";
import {
  CLASH_FREEZE,
  CLASH_PUSHBACK,
  COMBO_RESET_FRAMES,
  GUARD_CRUSH_STUN,
  MAX_ROUNDS,
  METER_ON_BLOCKED,
  METER_ON_TAKEN,
  ROUNDS_TO_WIN,
  THROW_RANGE,
  airThrowConnects,
  bodyGap,
  canCancelInto,
  canGuard,
  canSuperCancel,
  clashOrHit,
  cornerClamp,
  cornerHitStun,
  cornerKnockback,
  describeInput,
  forcedKnockdown,
  guardAfterBlock,
  guardCrush,
  guardRegen,
  holdingBack,
  hurtRect,
  inCancelWindow,
  inputOf,
  isActiveFrame,
  isCornered,
  isInvulnFrame,
  isResting,
  landCancel,
  landingLagAfter,
  matchOver,
  matchResult,
  meterAfterGain,
  meterAfterSuper,
  movePhase,
  neutralInput,
  pushApart,
  pushHistory,
  readCommand,
  rectsOverlap,
  roundResult,
  scaledHitStun,
  scaledPower,
  superLevelFor,
  techWindowOpen,
  throwConnects,
  throwInvuln,
  vigorAfter,
  wakeupFrames,
  wakeupShift,
  worldBox,
  type Facing,
  type InputFrame,
  type Stance,
  type SuperLevel,
  type WakeupKind
} from "./rules";

export type Phase =
  | "idle"
  | "walk"
  | "crouch"
  | "jump"
  | "attack"
  | "landing"
  | "hitstun"
  | "blockstun"
  | "guardbreak"
  | "knockdown"
  | "wakeup"
  | "clash"
  | "rest";

/** 长按轻击这么多帧再松开就是蓄力超必 */
export const CHARGE_FRAMES = 26;
/** 一回合默认多少帧(60 秒) */
export const DEFAULT_ROUND_FRAMES = 60 * 60;
/** 回合之间的间隙帧 */
export const ROUND_BREAK_FRAMES = 70;
/** 默认舞台宽度 */
export const STAGE_WIDTH = 640;
/** 贴边悬崖章用的窄舞台 */
export const NARROW_STAGE_WIDTH = 430;
/** 倒地到能起身之间的帧数 */
export const DOWN_FRAMES = 14;

export interface SideStats {
  /** 打中几下 */
  hits: number;
  /** 被挡下几下 */
  blocked: number;
  /** 本场最长连段 */
  maxCombo: number;
  /** 取消了几次 */
  cancels: number;
  /** 超级取消了几次 */
  superCancels: number;
  /** 打出过几次「跳入命中 → 落地接地面连」 */
  jumpInCombos: number;
  /** 破了几次防 */
  guardCrushes: number;
  /** 投中几次 */
  throws: number;
  /** 贴边打中几下 */
  cornerHits: number;
  /** 本场最长空中连 */
  maxJuggle: number;
  /** 放了几次超必 */
  supersUsed: number;
  /** 落地取消成功几次 */
  landCancels: number;
  /** 轻击命中几下 */
  lightHits: number;
  /** 下段命中几下 */
  lowHits: number;
  /** 一共削掉对手多少元气 */
  vigorTaken: number;
}

function emptyStats(): SideStats {
  return {
    hits: 0,
    blocked: 0,
    maxCombo: 0,
    cancels: 0,
    superCancels: 0,
    jumpInCombos: 0,
    guardCrushes: 0,
    throws: 0,
    cornerHits: 0,
    maxJuggle: 0,
    supersUsed: 0,
    landCancels: 0,
    lightHits: 0,
    lowHits: 0,
    vigorTaken: 0
  };
}

export interface FighterState {
  charId: string;
  side: 0 | 1;
  x: number;
  /** 脚底高度,0 = 站在地上 */
  y: number;
  vx: number;
  vy: number;
  facing: Facing;
  stance: Stance;
  phase: Phase;
  /** 当前动作进行到第几帧 */
  frame: number;
  slot: MoveSlot | null;
  /** 当前这一招连上了没有 —— 取消窗口就靠它 */
  hasHit: boolean;
  vigor: number;
  vigorMax: number;
  meter: number;
  guard: number;
  guardMax: number;
  /** 硬直剩余帧 */
  stun: number;
  /** 正在按后方向格挡 */
  blocking: boolean;
  /** 本串连段打中几下 */
  comboHits: number;
  /** 本串连段里对手在空中挨了几下 */
  juggleHits: number;
  /** 连段计时:这么多帧没有新命中就清零 */
  comboTimer: number;
  /** 本串连段已经用过的槽位(同一招不能接自己) */
  usedSlots: MoveSlot[];
  /** 空中招命中过 —— 落地取消的钥匙 */
  airHitLanded: boolean;
  /** 这一串连段是从跳入开始的 */
  comboFromAir: boolean;
  /** 倒地帧计数(受身窗口用) */
  downFrames: number;
  wakeupKind: WakeupKind | null;
  /** 轻击已经按住了几帧 */
  chargeFrames: number;
  /** 这一帧松手时攒到了几帧(蓄力超必看它) */
  chargeRelease: number;
  /** 输入历史(训练模式显示) */
  history: string[];
  /** 上一帧的输入 */
  lastInput: InputFrame;
  /** 贴边了 */
  cornered: boolean;
  /** 本回合放过几次超必 */
  supersThisRound: number;
}

export interface Projectile {
  side: 0 | 1;
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
  power: number;
  hitStun: number;
  blockStun: number;
  guardCost: number;
  height: GuardHeight;
  knockback: number;
  priority: number;
  hitStop: number;
  life: number;
  color: string;
}

export type EventKind =
  | "hit"
  | "block"
  | "crush"
  | "clash"
  | "throw"
  | "super"
  | "cancel"
  | "landCancel"
  | "knockdown"
  | "roundEnd"
  | "matchEnd";

export interface MatchEvent {
  kind: EventKind;
  side: 0 | 1;
  x: number;
  y: number;
  power: number;
  text?: string;
}

export interface MatchConfig {
  chars: [string, string];
  stageWidth: number;
  roundsToWin: number;
  roundFrames: number;
  reducedMotion: boolean;
  /** 两边的元气倍率(闯关塔调难度用) */
  vigorScale: [number, number];
  /** 两边只许用这些槽(教学关限制),null = 不限 */
  allowedSlots: [MoveSlot[] | null, MoveSlot[] | null];
  /** 开局送多少能量 */
  startMeter: [number, number];
}

export interface MatchState {
  cfg: MatchConfig;
  fighters: [FighterState, FighterState];
  projectiles: Projectile[];
  frame: number;
  hitstop: number;
  timer: number;
  round: number;
  wins: [number, number];
  /** 本回合已经分出胜负:0/1 = 谁赢,-1 = 平局 */
  roundWinner: 0 | 1 | -1 | null;
  roundBreak: number;
  /** 整场结束:0/1 = 谁赢,-1 = 平局 */
  winner: 0 | 1 | -1 | null;
  events: MatchEvent[];
  stats: [SideStats, SideStats];
}

export function defaultConfig(partial: Partial<MatchConfig> = {}): MatchConfig {
  return {
    chars: ["duoduo", "xingxing"],
    stageWidth: STAGE_WIDTH,
    roundsToWin: ROUNDS_TO_WIN,
    roundFrames: DEFAULT_ROUND_FRAMES,
    reducedMotion: false,
    vigorScale: [1, 1],
    allowedSlots: [null, null],
    startMeter: [0, 0],
    ...partial
  };
}

function spawnX(cfg: MatchConfig, side: 0 | 1): number {
  const mid = cfg.stageWidth / 2;
  const off = Math.min(140, cfg.stageWidth * 0.22);
  return side === 0 ? mid - off : mid + off;
}

function makeFighter(cfg: MatchConfig, side: 0 | 1): FighterState {
  const ch = characterById(cfg.chars[side]);
  const vigor = Math.max(20, Math.round(ch.vigor * cfg.vigorScale[side]));
  return {
    charId: ch.id,
    side,
    x: spawnX(cfg, side),
    y: 0,
    vx: 0,
    vy: 0,
    facing: side === 0 ? 1 : -1,
    stance: "stand",
    phase: "idle",
    frame: 0,
    slot: null,
    hasHit: false,
    vigor,
    vigorMax: vigor,
    meter: cfg.startMeter[side],
    guard: ch.guardMax,
    guardMax: ch.guardMax,
    stun: 0,
    blocking: false,
    comboHits: 0,
    juggleHits: 0,
    comboTimer: 0,
    usedSlots: [],
    airHitLanded: false,
    comboFromAir: false,
    downFrames: 0,
    wakeupKind: null,
    chargeFrames: 0,
    chargeRelease: 0,
    history: [],
    lastInput: neutralInput(),
    cornered: false,
    supersThisRound: 0
  };
}

export function createMatch(cfg: MatchConfig = defaultConfig()): MatchState {
  return {
    cfg,
    fighters: [makeFighter(cfg, 0), makeFighter(cfg, 1)],
    projectiles: [],
    frame: 0,
    hitstop: 0,
    timer: cfg.roundFrames,
    round: 1,
    wins: [0, 0],
    roundWinner: null,
    roundBreak: 0,
    winner: null,
    events: [],
    stats: [emptyStats(), emptyStats()]
  };
}

/** 开下一回合:元气与护盾满上,能量保留,位置回到起手点 */
export function startRound(m: MatchState): MatchState {
  for (const side of [0, 1] as const) {
    const keepMeter = m.fighters[side].meter;
    const fresh = makeFighter(m.cfg, side);
    fresh.meter = keepMeter;
    m.fighters[side] = fresh;
  }
  m.projectiles = [];
  m.timer = m.cfg.roundFrames;
  m.roundWinner = null;
  m.roundBreak = 0;
  m.hitstop = 0;
  return m;
}

// ---------------------------------------------------------------------------
// 查询小工具(AI 与界面都用)
// ---------------------------------------------------------------------------

export function characterOf(f: FighterState): Character {
  return characterById(f.charId);
}

export function currentMove(f: FighterState): Move | null {
  if (f.phase !== "attack" || !f.slot) return null;
  return characterOf(f).moves[f.slot];
}

/** 两人身体之间的净距离 */
export function gapBetween(m: MatchState): number {
  const [a, b] = m.fighters;
  return bodyGap(a.x, b.x, characterOf(a).halfWidth, characterOf(b).halfWidth);
}

/** 这一帧能不能自由行动 */
export function isFree(f: FighterState): boolean {
  return f.phase === "idle" || f.phase === "walk" || f.phase === "crouch" || f.phase === "jump";
}

export function isAirborne(f: FighterState): boolean {
  return f.y > 0;
}

/** 槽够放到几级超必 */
export function superReady(f: FighterState): SuperLevel {
  return superLevelFor(f.meter);
}

function slotAllowed(m: MatchState, side: 0 | 1, slot: MoveSlot): boolean {
  const list = m.cfg.allowedSlots[side];
  return !list || list.includes(slot);
}

function attackRect(f: FighterState, move: Move): Rect {
  return worldBox(f.x, f.y, f.facing, move.box);
}

function hurtOf(f: FighterState): Rect {
  const ch = characterOf(f);
  return hurtRect(f.x, f.y, ch.halfWidth, ch.height, ch.crouchHeight, f.stance);
}

// ---------------------------------------------------------------------------
// 出招
// ---------------------------------------------------------------------------

function resetString(f: FighterState): void {
  f.usedSlots = [];
  f.comboHits = 0;
  f.juggleHits = 0;
  f.comboFromAir = false;
}

function beginMove(m: MatchState, side: 0 | 1, slot: MoveSlot, canceled: boolean): boolean {
  const f = m.fighters[side];
  const ch = characterOf(f);
  const move = ch.moves[slot];
  if (!move) return false;
  if (!slotAllowed(m, side, slot)) return false;
  if (move.airOnly && !isAirborne(f)) return false;
  if (move.groundOnly && isAirborne(f)) return false;
  if (move.meterCost > 0) {
    if (f.meter < move.meterCost) return false;
    const level: SuperLevel = slot === "sv2" ? 2 : 1;
    f.meter = meterAfterSuper(f.meter, level);
    f.supersThisRound += 1;
    m.stats[side].supersUsed += 1;
    m.events.push({ kind: "super", side, x: f.x, y: f.y + 40, power: move.power, text: move.name });
  }
  if (canceled) {
    m.stats[side].cancels += 1;
    if (move.kind === "super") m.stats[side].superCancels += 1;
    m.events.push({ kind: "cancel", side, x: f.x, y: f.y + 50, power: 0, text: move.name });
  } else {
    resetString(f);
  }
  f.phase = "attack";
  f.slot = slot;
  f.frame = 0;
  f.hasHit = false;
  f.usedSlots.push(slot);
  if (!isAirborne(f)) f.stance = f.stance === "crouch" ? "crouch" : "stand";
  return true;
}

/**
 * 这一帧玩家想出什么招。返回 null 表示不出招。
 *
 * 键位:轻 = 轻击 / 蹲轻,重 = 重击 / 蹲重;
 * 必杀钮 = 贴身且按前 → 投技,按下 → 必杀二,否则必杀一;空中按必杀钮 = 跳投;
 * 「下 → 前 + 重」是必杀二的指令写法;轻击长按满 26 帧松手 = 蓄力超必。
 */
export function desiredSlot(m: MatchState, side: 0 | 1, input: InputFrame, prev: InputFrame): MoveSlot | null {
  const f = m.fighters[side];
  const air = isAirborne(f);
  const forward = f.facing === 1 ? input.right : input.left;
  const pressed = (k: "light" | "heavy" | "burst"): boolean => input[k] && !prev[k];

  // 蓄力超必:轻击按满再松手
  if (f.chargeRelease >= CHARGE_FRAMES) {
    const level = superReady(f);
    if (level === 2) return "sv2";
    if (level === 1) return "sv1";
  }

  if (air) {
    if (pressed("burst")) return "airThrow";
    if (pressed("heavy")) return "jH";
    if (pressed("light")) return "jL";
    return null;
  }

  if (pressed("burst")) {
    if (forward && gapBetween(m) <= THROW_RANGE) return "throw";
    return input.down ? "s2" : "s1";
  }
  if (pressed("heavy") && forward && readCommand(rawHistory(f), f.facing)) return "s2";
  if (pressed("heavy")) return input.down ? "2H" : "5H";
  if (pressed("light")) return input.down ? "2L" : "5L";
  return null;
}

/** 指令判定要看原始输入帧,单独存一份,不进状态对象免得序列化变胖 */
const RAW_HISTORY = new WeakMap<FighterState, InputFrame[]>();

function rawHistory(f: FighterState): InputFrame[] {
  return RAW_HISTORY.get(f) ?? [];
}

function rememberInput(f: FighterState, input: InputFrame): void {
  const list = RAW_HISTORY.get(f) ?? [];
  list.push(input);
  if (list.length > 30) list.shift();
  RAW_HISTORY.set(f, list);
}

// ---------------------------------------------------------------------------
// 每帧推进一个人
// ---------------------------------------------------------------------------

function stepFighter(m: MatchState, side: 0 | 1, input: InputFrame): void {
  const f = m.fighters[side];
  const ch = characterOf(f);
  const prev = f.lastInput;
  rememberInput(f, input);
  f.history = pushHistory(f.history, describeInput(input, f.facing));

  f.chargeRelease = !input.light && prev.light ? f.chargeFrames : 0;
  f.chargeFrames = input.light ? Math.min(150, f.chargeFrames + 1) : 0;

  if (f.comboTimer > 0) {
    f.comboTimer -= 1;
    if (f.comboTimer === 0) resetString(f);
  }

  const foe = m.fighters[side === 0 ? 1 : 0];
  if (isFree(f) && !isAirborne(f)) f.facing = foe.x >= f.x ? 1 : -1;

  f.blocking = false;

  switch (f.phase) {
    case "rest":
      break;
    case "hitstun":
    case "blockstun":
    case "guardbreak": {
      f.stun -= 1;
      if (f.stun <= 0) {
        if (isAirborne(f)) {
          f.phase = "jump";
        } else {
          f.phase = "idle";
          f.stance = "stand";
        }
      }
      break;
    }
    case "clash": {
      f.stun -= 1;
      if (f.stun <= 0) f.phase = isAirborne(f) ? "jump" : "idle";
      break;
    }
    case "knockdown": {
      f.downFrames += 1;
      // 起身三选一:受身窗口内按键 = 受身;按住后 = 后跳起;按住下(或什么都不按) = 原地起
      if (f.wakeupKind === null) {
        const back = holdingBack(f.facing, input.left, input.right);
        if (techWindowOpen(f.downFrames) && (input.light || input.heavy || input.burst)) f.wakeupKind = "tech";
        else if (back) f.wakeupKind = "backRoll";
        else if (input.down) f.wakeupKind = "inPlace";
      }
      if (f.downFrames >= DOWN_FRAMES) {
        const kind: WakeupKind = f.wakeupKind ?? "inPlace";
        f.phase = "wakeup";
        f.frame = 0;
        f.wakeupKind = kind;
        f.x += wakeupShift(kind) * (f.facing === 1 ? -1 : 1);
      }
      break;
    }
    case "wakeup": {
      f.frame += 1;
      if (f.frame >= wakeupFrames(f.wakeupKind ?? "inPlace")) {
        f.phase = "idle";
        f.stance = "stand";
        f.frame = 0;
        f.wakeupKind = null;
        f.downFrames = 0;
      }
      break;
    }
    case "landing": {
      f.frame += 1;
      if (landCancel(f.airHitLanded, f.frame - 1)) {
        const want = desiredSlot(m, side, input, prev);
        if (want) {
          const before = { hits: f.comboHits, juggle: f.juggleHits, used: [...f.usedSlots] };
          if (beginMove(m, side, want, true)) {
            f.comboHits = before.hits;
            f.juggleHits = before.juggle;
            f.usedSlots = [...before.used, want];
            f.comboFromAir = true;
            f.airHitLanded = false;
            m.stats[side].landCancels += 1;
            m.events.push({ kind: "landCancel", side, x: f.x, y: f.y + 40, power: 0 });
            break;
          }
        }
      }
      if (f.frame >= landingLagAfter(f.airHitLanded)) {
        f.phase = "idle";
        f.frame = 0;
        f.airHitLanded = false;
      }
      break;
    }
    case "attack": {
      const move = ch.moves[f.slot ?? "5L"];
      f.frame += 1;
      if (inCancelWindow(move, f.frame - 1, f.hasHit)) {
        // 超级取消:必杀命中的窗口里按必杀钮,花槽换成超必
        const burstNow = input.burst && !prev.burst;
        const superLv = burstNow ? canSuperCancel(move, f.meter) : 0;
        const want = superLv >= 1 ? (superLv === 2 ? "sv2" : "sv1") : desiredSlot(m, side, input, prev);
        if (want) {
          const to = ch.moves[want];
          const isSuper = to.kind === "super";
          const ok = isSuper
            ? canSuperCancel(move, f.meter) >= (want === "sv2" ? 2 : 1)
            : canCancelInto(move, to) && !f.usedSlots.includes(want);
          if (ok) {
            const before = { hits: f.comboHits, juggle: f.juggleHits, air: f.comboFromAir, used: [...f.usedSlots] };
            if (beginMove(m, side, want, true)) {
              f.comboHits = before.hits;
              f.juggleHits = before.juggle;
              f.comboFromAir = before.air;
              f.usedSlots = [...before.used, want];
              break;
            }
          }
        }
      }
      if (movePhase(move, f.frame) === "done") {
        if (isAirborne(f)) {
          f.phase = "jump";
        } else {
          f.phase = "idle";
          f.stance = "stand";
        }
        f.slot = null;
        f.frame = 0;
      }
      break;
    }
    default: {
      if (isAirborne(f)) {
        const want = desiredSlot(m, side, input, prev);
        if (want) beginMove(m, side, want, false);
        break;
      }
      const want = desiredSlot(m, side, input, prev);
      if (want && beginMove(m, side, want, false)) break;
      if (input.up) {
        f.vy = ch.jump;
        f.y = 0.01;
        f.vx = (input.left ? -1 : input.right ? 1 : 0) * ch.walk;
        f.stance = "air";
        f.phase = "jump";
        break;
      }
      if (input.down) {
        f.stance = "crouch";
        f.phase = "crouch";
        f.blocking = holdingBack(f.facing, input.left, input.right);
        break;
      }
      f.stance = "stand";
      const back = holdingBack(f.facing, input.left, input.right);
      f.blocking = back;
      if (input.left || input.right) {
        f.x += (input.left ? -1 : 1) * (back ? ch.backWalk : ch.walk);
        f.phase = "walk";
      } else {
        f.phase = "idle";
      }
      break;
    }
  }

  // 空中物理
  if (isAirborne(f)) {
    f.vy -= ch.gravity;
    f.y += f.vy;
    f.x += f.vx;
    f.stance = "air";
    if (f.y <= 0) {
      f.y = 0;
      f.vy = 0;
      f.vx = 0;
      if (f.phase === "hitstun") {
        toKnockdown(m, side);
      } else {
        f.phase = "landing";
        f.frame = 0;
        f.slot = null;
        f.stance = "stand";
      }
    }
  } else if (!f.blocking) {
    f.guard = guardRegen(f.guard, f.guardMax);
  }

  f.lastInput = { ...input };
}

function toKnockdown(m: MatchState, side: 0 | 1): void {
  const f = m.fighters[side];
  f.phase = "knockdown";
  f.downFrames = 0;
  f.wakeupKind = null;
  f.frame = 0;
  f.slot = null;
  f.stance = "stand";
  f.y = 0;
  f.vy = 0;
  f.vx = 0;
  m.events.push({ kind: "knockdown", side, x: f.x, y: f.y, power: 0 });
}

// ---------------------------------------------------------------------------
// 命中结算
// ---------------------------------------------------------------------------

interface HitSpec {
  power: number;
  hitStun: number;
  blockStun: number;
  guardCost: number;
  knockback: number;
  launch: number;
  height: GuardHeight;
  hitStop: number;
  meterGain: number;
  knockdown: boolean;
  isThrow: boolean;
  isLight: boolean;
  name: string;
}

function specOfMove(move: Move): HitSpec {
  return {
    power: move.power,
    hitStun: move.hitStun,
    blockStun: move.blockStun,
    guardCost: move.guardCost,
    knockback: move.knockback,
    launch: move.launch,
    height: move.height,
    hitStop: move.hitStop,
    meterGain: move.meterGain,
    knockdown: Boolean(move.knockdown),
    isThrow: move.kind === "throw" || move.height === "throw",
    isLight: move.kind === "light",
    name: move.name
  };
}

function stopFrames(m: MatchState, raw: number): number {
  return m.cfg.reducedMotion ? 0 : Math.max(0, Math.round(raw));
}

function applyHit(m: MatchState, ai: 0 | 1, spec: HitSpec, fromAir: boolean): void {
  const di: 0 | 1 = ai === 0 ? 1 : 0;
  const att = m.fighters[ai];
  const def = m.fighters[di];
  const defCh = characterOf(def);
  const defCornered = isCornered(def.x, defCh.halfWidth, m.cfg.stageWidth);

  att.hasHit = true;
  att.comboTimer = COMBO_RESET_FRAMES;

  const blocked = !spec.isThrow && canGuard(def.stance, spec.height, def.blocking);
  if (blocked) {
    m.stats[ai].blocked += 1;
    def.guard = guardAfterBlock(def.guard, spec.guardCost);
    att.meter = meterAfterGain(att.meter, spec.meterGain * 0.6);
    def.meter = meterAfterGain(def.meter, spec.guardCost * METER_ON_BLOCKED);
    if (guardCrush(def.guard)) {
      def.guard = def.guardMax;
      def.phase = "guardbreak";
      def.stun = GUARD_CRUSH_STUN;
      def.slot = null;
      m.stats[ai].guardCrushes += 1;
      m.events.push({ kind: "crush", side: ai, x: def.x, y: def.y + 40, power: 0, text: "破防!" });
    } else {
      def.phase = "blockstun";
      def.stun = spec.blockStun;
      m.events.push({ kind: "block", side: ai, x: def.x, y: def.y + 40, power: 0 });
    }
    def.x += (att.facing === 1 ? 1 : -1) * spec.knockback * 0.5;
    m.hitstop = Math.max(m.hitstop, stopFrames(m, spec.hitStop * 0.6));
    return;
  }

  const airborne = def.y > 0;
  const hitIndex = att.comboHits;
  const power = scaledPower(spec.power, hitIndex, airborne);
  const before = def.vigor;
  def.vigor = vigorAfter(def.vigor, power);

  const st = m.stats[ai];
  st.vigorTaken += before - def.vigor;
  st.hits += 1;
  if (spec.isLight) st.lightHits += 1;
  if (spec.height === "low") st.lowHits += 1;
  if (spec.isThrow) st.throws += 1;
  if (defCornered) st.cornerHits += 1;

  if (fromAir) {
    att.comboFromAir = true;
    att.airHitLanded = true;
  } else if (att.comboFromAir) {
    // 跳入命中之后落地又接上了一下,这一串才算「跳入连」;一串只记一次
    st.jumpInCombos += 1;
    att.comboFromAir = false;
  }

  att.comboHits += 1;
  if (airborne) att.juggleHits += 1;
  st.maxCombo = Math.max(st.maxCombo, att.comboHits);
  st.maxJuggle = Math.max(st.maxJuggle, att.juggleHits);

  att.meter = meterAfterGain(att.meter, spec.meterGain);
  def.meter = meterAfterGain(def.meter, spec.power * METER_ON_TAKEN);

  const stun = cornerHitStun(scaledHitStun(spec.hitStun, hitIndex), defCornered);
  def.x += (att.facing === 1 ? 1 : -1) * cornerKnockback(spec.knockback, defCornered);
  def.slot = null;
  def.frame = 0;

  if (spec.launch > 0) {
    def.vy = spec.launch;
    def.y = Math.max(def.y, 0.01);
    def.stance = "air";
    def.phase = "hitstun";
    def.stun = stun + 6;
  } else if (spec.isThrow || spec.knockdown || forcedKnockdown(att.comboHits)) {
    toKnockdown(m, di);
  } else {
    def.phase = "hitstun";
    def.stun = stun;
  }

  m.hitstop = Math.max(m.hitstop, stopFrames(m, spec.hitStop));
  m.events.push({
    kind: spec.isThrow ? "throw" : "hit",
    side: ai,
    x: def.x,
    y: def.y + 42,
    power,
    text: spec.name
  });

  if (isResting(def.vigor)) {
    def.phase = "rest";
    def.stun = 0;
  }
}

// ---------------------------------------------------------------------------
// 投射物
// ---------------------------------------------------------------------------

function tryProjectileSpawn(m: MatchState, side: 0 | 1): void {
  const f = m.fighters[side];
  const move = currentMove(f);
  if (!move || !move.projectile) return;
  if (f.frame - 1 !== move.startup) return;
  const ch = characterOf(f);
  const rect = attackRect(f, move);
  m.projectiles.push({
    side,
    x: rect.x,
    y: rect.y,
    vx: (move.projectileSpeed ?? 6) * f.facing,
    w: move.box.w,
    h: move.box.h,
    power: move.power,
    hitStun: move.hitStun,
    blockStun: move.blockStun,
    guardCost: move.guardCost,
    height: move.height,
    knockback: move.knockback,
    priority: move.priority,
    hitStop: move.hitStop,
    life: 110,
    color: ch.color
  });
  // 弹丸射出去就算这一招连上了,取消窗口照常打开
  f.hasHit = true;
}

function stepProjectiles(m: MatchState): void {
  const alive: Projectile[] = [];
  for (const p of m.projectiles) {
    p.x += p.vx;
    p.life -= 1;
    if (p.life <= 0 || p.x < -80 || p.x > m.cfg.stageWidth + 80) continue;
    alive.push(p);
  }
  // 弹丸互撞:一起消失,冒个火花
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i];
      const b = alive[j];
      if (a.side === b.side) continue;
      if (rectsOverlap({ x: a.x, y: a.y, w: a.w, h: a.h }, { x: b.x, y: b.y, w: b.w, h: b.h })) {
        a.life = 0;
        b.life = 0;
        m.events.push({ kind: "clash", side: a.side, x: (a.x + b.x) / 2, y: a.y + a.h / 2, power: 0 });
      }
    }
  }
  m.projectiles = alive.filter((p) => p.life > 0);

  const hitList = [...m.projectiles];
  for (const p of hitList) {
    const di: 0 | 1 = p.side === 0 ? 1 : 0;
    const def = m.fighters[di];
    if (def.phase === "rest" || def.phase === "knockdown") continue;
    if (!rectsOverlap({ x: p.x, y: p.y, w: p.w, h: p.h }, hurtOf(def))) continue;
    applyHit(
      m,
      p.side,
      {
        power: p.power,
        hitStun: p.hitStun,
        blockStun: p.blockStun,
        guardCost: p.guardCost,
        knockback: p.knockback,
        launch: 0,
        height: p.height,
        hitStop: p.hitStop,
        meterGain: 4,
        knockdown: false,
        isThrow: false,
        isLight: false,
        name: "投射"
      },
      false
    );
    m.projectiles = m.projectiles.filter((q) => q !== p);
  }
}

// ---------------------------------------------------------------------------
// 对拼与命中
// ---------------------------------------------------------------------------

/** 这一帧这个人的判定框生效吗(投射招的本体不算) */
function liveAttack(f: FighterState): Move | null {
  const move = currentMove(f);
  if (!move) return null;
  if (move.projectile) return null;
  if (!isActiveFrame(move, f.frame - 1)) return null;
  if (f.hasHit) return null;
  return move;
}

function resolveCombat(m: MatchState): void {
  const [a, b] = m.fighters;
  const ma = liveAttack(a);
  const mb = liveAttack(b);

  if (ma && mb) {
    const ra = attackRect(a, ma);
    const rb = attackRect(b, mb);
    if (rectsOverlap(ra, rb)) {
      const out = clashOrHit(ma, mb);
      if (out === "clash") {
        for (const side of [0, 1] as const) {
          const f = m.fighters[side];
          f.phase = "clash";
          f.stun = CLASH_FREEZE;
          f.slot = null;
          f.frame = 0;
          f.hasHit = true;
          f.x += (f.facing === 1 ? -1 : 1) * CLASH_PUSHBACK;
        }
        m.hitstop = Math.max(m.hitstop, stopFrames(m, 6));
        m.events.push({ kind: "clash", side: 0, x: (a.x + b.x) / 2, y: 60, power: 0, text: "火花!" });
        return;
      }
      const winner: 0 | 1 = out === "a" ? 0 : 1;
      resolveOne(m, winner, winner === 0 ? ma : mb);
      return;
    }
  }

  if (ma) resolveOne(m, 0, ma);
  const mb2 = liveAttack(m.fighters[1]);
  if (mb2) resolveOne(m, 1, mb2);
}

function resolveOne(m: MatchState, ai: 0 | 1, move: Move): void {
  const di: 0 | 1 = ai === 0 ? 1 : 0;
  const att = m.fighters[ai];
  const def = m.fighters[di];
  if (def.phase === "rest" || att.phase === "rest") return;

  // 对手正在超必的无敌帧里,这一下穿过去
  const defMove = currentMove(def);
  if (defMove && isInvulnFrame(defMove, def.frame - 1)) return;

  const attCh = characterOf(att);
  const defCh = characterOf(def);
  const gap = bodyGap(att.x, def.x, attCh.halfWidth, defCh.halfWidth);
  const isThrow = move.kind === "throw" || move.height === "throw";

  if (isThrow) {
    const defInvuln = def.phase === "wakeup" && throwInvuln(def.frame);
    const ok = move.airOnly
      ? airThrowConnects(gap, att.y > 0, def.y > 0, def.phase)
      : throwConnects(gap, def.phase, def.y > 0, defInvuln);
    if (!ok) return;
    applyHit(m, ai, specOfMove(move), att.y > 0);
    return;
  }

  if (!rectsOverlap(attackRect(att, move), hurtOf(def))) return;
  applyHit(m, ai, specOfMove(move), att.y > 0);
}

// ---------------------------------------------------------------------------
// 回合与整场
// ---------------------------------------------------------------------------

/** 两边元气上限可能被关卡调过,时间到了要按比例比,不然让血多的一方白占便宜 */
function vigorRatio(f: FighterState): number {
  if (f.vigor <= 0) return 0;
  return f.vigor / f.vigorMax;
}

function finishRound(m: MatchState, winner: 0 | 1 | -1): void {
  m.roundWinner = winner;
  m.roundBreak = ROUND_BREAK_FRAMES;
  if (winner === 0 || winner === 1) m.wins[winner] += 1;
  m.events.push({ kind: "roundEnd", side: winner === 1 ? 1 : 0, x: 0, y: 0, power: 0 });
  if (matchOver(m.wins, m.cfg.roundsToWin)) {
    m.winner = matchResult(m.wins, m.cfg.roundsToWin);
  } else if (m.round >= MAX_ROUNDS) {
    // 一直平局也要收场:回合数封顶,按累计胜场判
    m.winner = m.wins[0] === m.wins[1] ? -1 : m.wins[0] > m.wins[1] ? 0 : 1;
  }
  if (m.winner !== null) {
    m.events.push({ kind: "matchEnd", side: m.winner === 1 ? 1 : 0, x: 0, y: 0, power: 0 });
  }
}

/** 推进一帧。返回同一个对象(原地更新),方便逐帧循环 */
export function stepMatch(m: MatchState, inputs: [InputFrame, InputFrame]): MatchState {
  m.events = [];
  if (m.winner !== null) return m;

  if (m.roundBreak > 0) {
    m.roundBreak -= 1;
    if (m.roundBreak === 0) {
      m.round += 1;
      startRound(m);
    }
    return m;
  }

  if (m.hitstop > 0) {
    m.hitstop -= 1;
    return m;
  }

  m.frame += 1;
  if (m.timer > 0) m.timer -= 1;

  stepFighter(m, 0, inputs[0]);
  stepFighter(m, 1, inputs[1]);
  tryProjectileSpawn(m, 0);
  tryProjectileSpawn(m, 1);
  resolveCombat(m);
  stepProjectiles(m);

  // 身体推挤 + 贴边
  const [a, b] = m.fighters;
  const shift = pushApart(a.x, b.x, characterOf(a).halfWidth, characterOf(b).halfWidth);
  if (shift > 0) {
    const dir = a.x <= b.x ? -1 : 1;
    a.x += dir * shift;
    b.x -= dir * shift;
  }
  for (const side of [0, 1] as const) {
    const f = m.fighters[side];
    const ch = characterOf(f);
    const clamped = cornerClamp(f.x, ch.halfWidth, m.cfg.stageWidth);
    f.x = clamped.x;
    f.cornered = isCornered(f.x, ch.halfWidth, m.cfg.stageWidth);
  }

  if (m.roundWinner === null && (isResting(a.vigor) || isResting(b.vigor) || m.timer <= 0)) {
    finishRound(m, roundResult(vigorRatio(a), vigorRatio(b)));
  }

  return m;
}

// ---------------------------------------------------------------------------
// 无头模拟(测试与关卡校验用)
// ---------------------------------------------------------------------------

export type Decider = (m: MatchState, side: 0 | 1) => InputFrame;

export interface HeadlessResult {
  state: MatchState;
  frames: number;
  winner: 0 | 1 | -1 | null;
}

/** 让两边各自照 `decide` 出招,一直跑到分出胜负或帧数用完 */
export function runHeadless(m: MatchState, deciders: [Decider, Decider], maxFrames = 60 * 60 * 8): HeadlessResult {
  let frames = 0;
  while (m.winner === null && frames < maxFrames) {
    stepMatch(m, [deciders[0](m, 0), deciders[1](m, 1)]);
    frames += 1;
  }
  return { state: m, frames, winner: m.winner };
}

/** 一个什么都不做的决策器 */
export const idleDecider: Decider = () => inputOf({});
