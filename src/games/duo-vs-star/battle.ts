/**
 * 朵朵大战星星 · 一局混战的确定性状态机。
 *
 * 这里比的不是谁更抗打：挨拍只会让「击退值」上涨，被撞出场地四周的
 * 弹飞线就少一次上场机会，上场机会用完就到场边加油区休息，最后还站在
 * 场上的队伍获胜。
 *
 * 状态机不碰 DOM：同一份 `stepMatch` 既给 canvas 渲染用，也给单测跑完整对局。
 */
import {
  AI_TIERS,
  canLandBeyond,
  decideAi,
  emptyInput,
  perilous,
  type AiStyle,
  type AiTier,
  type AiIntent,
  type Input,
} from "./ai";
import {
  CATCH_COOLDOWN,
  LIFT_COOLDOWN,
  LIFT_RANGE,
  LIFT_RELIEF,
  canCatch,
  canLift,
  catchVelocity,
  liftVelocity,
  type CoopActorView,
} from "./coop";
import {
  emptyBuffs,
  extraAirJumps,
  fallMul,
  itemSpawnX,
  jumpMul,
  powerMul,
  rollItem,
  speedMul,
  tickBuffs,
  weightMul,
  type Buffs,
  type ItemDef,
} from "./items";
import {
  SHIELD_MAX,
  STRUGGLE_WINDOW,
  addBump,
  canStruggle,
  clampBump,
  coolBump,
  outOfBoundsSide,
  resolveHit,
  stepFlight,
  struggleVelocity,
  type HitKind,
} from "./knockback";
import { fighterById, type Fighter } from "./roster";
import { platformAt, stageById, syrupLevel, type Platform, type Stage } from "./stages";

// ---------------------------------------------------------------------------
// 手感常数
// ---------------------------------------------------------------------------

/** 角色半径（世界单位） */
export const ACTOR_R = 22;
/** 地面跑动速度 */
export const RUN_SPEED = 240;
/** 空中横向加速度 */
export const AIR_ACCEL = 1500;
/** 起跳初速（负数 = 往上） */
export const JUMP_V = -520;
/** 重力 */
export const GRAVITY = 1250;
/** 被撞出去后等多久回场 */
export const RESPAWN_DELAY = 1.5;
/** 小电脑快掉出场时的思考间隔（保命不吃档位的反应延迟） */
export const PERIL_THINK = 0.06;
/** 挨打之后多少秒内不给这份「保命提速」：被撞飞的那一下还是得靠反应 */
export const PERIL_GRACE = 1.4;
/** 回场后的无敌时间（免得刚回来又被堵着打） */
export const SAFE_TIME = 1.2;

interface AttackSpec {
  /** 起手 */
  windup: number;
  /** 判定 */
  active: number;
  /** 收招 */
  recover: number;
  /** 力度倍率（再乘角色的 power 与道具加成） */
  power: number;
  /** 判定距离 */
  reach: number;
  kind: HitKind;
}

export const ATTACKS: Record<"light" | "heavy", AttackSpec> = {
  light: { windup: 0.07, active: 0.09, recover: 0.16, power: 8, reach: 56, kind: "light" },
  heavy: { windup: 0.22, active: 0.11, recover: 0.34, power: 16.5, reach: 66, kind: "heavy" },
};

// ---------------------------------------------------------------------------
// 配置与状态
// ---------------------------------------------------------------------------

export type ControlKind = "p1" | "p2" | "ai";

export interface FighterSlot {
  charId: string;
  /** 队伍号；乱斗模式下每人一队 */
  team: number;
  control: ControlKind;
  aiTier?: AiTier;
  /** 小电脑的打法（会绕后 / 抢道具 / 等你出招），不给就是正面来 */
  aiStyle?: AiStyle;
  /** 关卡给对手的力度加成 */
  powerBonus?: number;
  /** 单独指定这一位的上场机会（不给就用全局 stocks） */
  stocks?: number;
}

export interface MatchConfig {
  stageId: string;
  slots: FighterSlot[];
  /** 每人几次上场机会 */
  stocks: number;
  /** 限时（秒）；0 = 不限时 */
  timeLimit: number;
  /** 道具多久掉一次（秒）；0 = 本场没有道具 */
  itemEvery: number;
  /** 限定道具池（不给就是全都有） */
  itemPool?: string[];
  seed: number;
  /**
   * 战役关的「主角」槽位下标（那位真人玩家）。给了就多两条判定：
   *
   *  · 主角自己的上场机会用完 —— 这一关当场结束、算他输。队友再能打也不能替他过关；
   *  · 主角整局一个键都没按 —— 不给他这一队判胜。
   *
   * 星星是发给「你做到了」的凭证。组队赛让队友帮着赢没问题，
   * 但「手柄放在一边、真人早被撞出局，星星照发、下一关照解锁」不行。
   * 双人同乐、沙盒练习、无尽车轮战都不设主角，判法跟以前一模一样。
   */
  lead?: number;
}

export interface Actor {
  index: number;
  slot: FighterSlot;
  char: Fighter;
  team: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  /** 站在哪块平台上（-1 = 没站着） */
  platIndex: number;
  jumpsLeft: number;
  bump: number;
  shield: number;
  buffs: Buffs;
  attack: { kind: "light" | "heavy"; t: number; hit: number[] } | null;
  /** 挨拍后的僵直 */
  stun: number;
  /** 刚回场的无敌时间 */
  safe: number;
  /** 掉下去后的等待时间 */
  respawn: number;
  stocks: number;
  /** 被撞出去几次 */
  outs: number;
  /** 把别人撞出去几次 */
  kos: number;
  /** 自己出招打中对手几次（道具引发的推挤不算，那不是玩家操作） */
  hits: number;
  /** 上场机会用完了 */
  retired: boolean;
  /** 在场上（没在等回场、也没退场） */
  onStage: boolean;
  /** 上一帧的操作，用来做「按下的那一下」判定 */
  prev: Input;
  /** 小电脑：还有多久重新想一次 */
  aiT: number;
  aiInput: Input;
  aiIntent: AiIntent;
  /** 刚吃到的道具（给 UI 弹字用） */
  lastItem: string | null;
  lastItemT: number;
  /** 低元气挨拍后的挣扎窗口（秒），朝场地里按方向键就能挣一下 */
  struggle: number;
  /** 顶举 / 接应的冷却 */
  coopCd: number;
  /**
   * 正踩在哪位队友的头顶上（队友的下标，-1 = 没踩着）。
   * 队友的脑袋对同队的人来说就是一小块软平台——站得住，才有工夫喊他「顶我一下」。
   */
  ride: number;
  /** 顶举成功几次 */
  lifts: number;
  /** 接应成功几次 */
  catches: number;
  /** 被队友顶举 / 拉回来几次（给合作特训数进度） */
  helped: number;
  /** 这一位真人这一局按过键没有（小电脑的槽位不看这个） */
  acted: boolean;
}

export interface ItemDrop {
  id: number;
  def: ItemDef;
  x: number;
  y: number;
  vy: number;
  /** 落在平台上了 */
  landed: boolean;
  /** 存在时间，太久没人捡就自己消失 */
  life: number;
}

export type MatchEvent =
  | { kind: "hit"; actor: number; by: number; x: number; y: number; heavy: boolean }
  | { kind: "block"; actor: number; x: number; y: number }
  | { kind: "pop"; actor: number; x: number; y: number }
  | { kind: "ko"; actor: number; by: number; side: string; x: number; y: number }
  | { kind: "item"; actor: number; item: string; x: number; y: number }
  | { kind: "respawn"; actor: number; x: number; y: number }
  | { kind: "retire"; actor: number }
  | { kind: "syrup"; actor: number; x: number; y: number }
  | { kind: "struggle"; actor: number; x: number; y: number }
  | { kind: "lift"; actor: number; rider: number; x: number; y: number }
  | { kind: "catch"; actor: number; flyer: number; x: number; y: number }
  | { kind: "collapse"; plat: number }
  | { kind: "end"; winnerTeam: number | null };

export interface PlatState {
  /** 有人站着累计了多久 */
  standT: number;
  hidden: boolean;
  restoreT: number;
  /** 这一帧的实际位置 */
  x: number;
  y: number;
  /** 上一帧的位置（升降台带着人一起走时要用） */
  prevX: number;
  prevY: number;
}

export interface MatchState {
  cfg: MatchConfig;
  stage: Stage;
  t: number;
  actors: Actor[];
  items: ItemDrop[];
  plats: PlatState[];
  /** 本帧发生的事，UI 取完就清 */
  events: MatchEvent[];
  over: boolean;
  winnerTeam: number | null;
  endReason: "ko" | "time" | null;
  nextItemT: number;
  nextItemId: number;
  /** 屏幕抖动强度（prefers-reduced-motion 时 UI 会忽略它） */
  shake: number;
  rand: () => number;
  /** 上一次把某人撞出去的是谁（撞飞自己也算，记 -1） */
  lastHitBy: number[];
  lastHitT: number[];
}

// ---------------------------------------------------------------------------
// 随机（带种子，保证同一场可以复现）
// ---------------------------------------------------------------------------

export function makeRng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 建局
// ---------------------------------------------------------------------------

function makeActor(slot: FighterSlot, index: number, stage: Stage): Actor {
  const spawn = stage.spawns[index % stage.spawns.length];
  const char = fighterById(slot.charId);
  return {
    index,
    slot,
    char,
    team: slot.team,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    facing: spawn.x < 480 ? 1 : -1,
    onGround: false,
    platIndex: -1,
    jumpsLeft: char.airJumps,
    bump: 0,
    shield: 0,
    buffs: emptyBuffs(),
    attack: null,
    stun: 0,
    safe: SAFE_TIME,
    respawn: 0,
    stocks: 1,
    outs: 0,
    kos: 0,
    hits: 0,
    retired: false,
    onStage: true,
    prev: emptyInput(),
    aiT: 0,
    aiInput: emptyInput(),
    aiIntent: "wait",
    lastItem: null,
    lastItemT: 0,
    struggle: 0,
    coopCd: 0,
    ride: -1,
    lifts: 0,
    catches: 0,
    helped: 0,
    acted: false,
  };
}

/** 把角色削成 `coop.ts` 认得的那点信息 */
function coopView(a: Actor): CoopActorView {
  return { x: a.x, y: a.y, team: a.team, onStage: a.onStage, onGround: a.onGround, cooldown: a.coopCd };
}

export function createMatch(cfg: MatchConfig): MatchState {
  const stage = stageById(cfg.stageId);
  const stocks = Math.max(1, Math.round(cfg.stocks));
  const actors = cfg.slots.map((slot, i) => {
    const a = makeActor(slot, i, stage);
    a.stocks = Math.max(1, Math.round(slot.stocks ?? stocks));
    return a;
  });
  const plats: PlatState[] = stage.platforms.map((p) => ({
    standT: 0,
    hidden: false,
    restoreT: 0,
    x: p.x,
    y: p.y,
    prevX: p.x,
    prevY: p.y,
  }));
  return {
    cfg,
    stage,
    t: 0,
    actors,
    items: [],
    plats,
    events: [],
    over: false,
    winnerTeam: null,
    endReason: null,
    nextItemT: cfg.itemEvery > 0 ? cfg.itemEvery * 0.6 : Number.POSITIVE_INFINITY,
    nextItemId: 1,
    shake: 0,
    rand: makeRng(cfg.seed),
    lastHitBy: actors.map(() => -1),
    lastHitT: actors.map(() => -99),
  };
}

// ---------------------------------------------------------------------------
// 场地查询
// ---------------------------------------------------------------------------

/** 主平台（面积最大的那块）的横向安全区间，AI 和出生点都参考它 */
export function safeZone(stage: Stage): { min: number; max: number; top: number } {
  let best: Platform | null = null;
  for (const p of stage.platforms) {
    if (!best || p.w * p.h > best.w * best.h) best = p;
  }
  if (!best) return { min: 240, max: 720, top: 400 };
  return { min: best.x, max: best.x + best.w, top: best.y };
}

/**
 * 整张场地「脚下还有东西」的横向范围：所有台子的并集，平移台按它跑到的两头算。
 *
 * 主平台只是其中最大的一块。像「星光升降台」「夜空跳台」这种主平台只有 140–200px、
 * 出生点却在两侧台子上的图，光看主平台会得出「一出生就掉出场了」的错觉——
 * 小电脑因此一开局就狂按回场键，把二段跳全耗在半空，然后直直掉下去。
 * 判断「是不是真的掉出场了」要看这个并集，不是主平台。
 */
export function standSpan(stage: Stage): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const p of stage.platforms) {
    const swing = Math.abs(p.moveX ?? 0);
    min = Math.min(min, p.x - swing);
    max = Math.max(max, p.x + p.w + swing);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    const zone = safeZone(stage);
    return { min: zone.min, max: zone.max };
  }
  return { min, max };
}

function actorWeight(a: Actor): number {
  return a.char.weight * weightMul(a.buffs);
}

function actorRadius(a: Actor): number {
  return a.buffs.mini > 0 ? ACTOR_R * 0.7 : ACTOR_R;
}

// ---------------------------------------------------------------------------
// 道具
// ---------------------------------------------------------------------------

function spawnItem(s: MatchState): void {
  const def = rollItem(s.rand(), s.cfg.itemPool);
  const zone = safeZone(s.stage);
  // 左右轮流、镜像对称：第几件道具决定落在中线的哪一边，两边的机会长期完全一样
  const id = s.nextItemId++;
  const x = itemSpawnX(zone.min, zone.max, id - 1, s.rand());
  s.items.push({ id, def, x, y: -30, vy: 90, landed: false, life: 0 });
}

function nearestOpponent(s: MatchState, a: Actor): Actor | null {
  let best: Actor | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const o of s.actors) {
    if (o === a || !o.onStage || o.team === a.team) continue;
    const d = Math.hypot(o.x - a.x, o.y - a.y);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function applyItem(s: MatchState, a: Actor, def: ItemDef): void {
  a.lastItem = def.name;
  a.lastItemT = 1.4;
  switch (def.id) {
    case "hammer":
      a.buffs.hammer = def.duration;
      // 强道具要先举满：这段时间里锤子还是软的，对手来得及躲
      a.buffs.hammerCharge = def.charge ?? 0;
      break;
    case "springshoe":
      a.buffs.spring = def.duration;
      break;
    case "shield":
      a.shield = SHIELD_MAX;
      break;
    case "feather":
      a.buffs.fast = def.duration;
      break;
    case "cookie":
      a.buffs.heavy = def.duration;
      break;
    case "mushroom":
      a.buffs.mini = def.duration;
      break;
    case "balloon":
      a.buffs.float = def.duration;
      a.jumpsLeft = Math.max(a.jumpsLeft, 1);
      break;
    case "magnet":
      a.buffs.magnet = def.duration;
      break;
    case "bell":
      a.bump = clampBump(a.bump / 2);
      break;
    case "rainbow": {
      const zone = safeZone(s.stage);
      a.x = (zone.min + zone.max) / 2;
      a.y = zone.top - 150;
      a.vx = 0;
      a.vy = 0;
      a.stun = 0;
      a.jumpsLeft = a.char.airJumps + extraAirJumps(a.buffs);
      break;
    }
    case "honey":
      for (const o of s.actors) {
        if (o !== a && o.onStage) o.buffs.slow = def.duration;
      }
      break;
    case "icecream": {
      const target = nearestOpponent(s, a);
      if (target) target.buffs.dizzy = def.duration;
      break;
    }
    case "fountain":
      for (const o of s.actors) {
        if (o === a || !o.onStage || o.safe > 0) continue;
        if (Math.hypot(o.x - a.x, o.y - a.y) > 170) continue;
        const dir: 1 | -1 = o.x >= a.x ? 1 : -1;
        const hit = resolveHit({
          bump: o.bump,
          shield: o.shield,
          weight: actorWeight(o),
          power: 6,
          kind: "light",
          attackerX: a.x,
          targetX: o.x,
          fallbackDir: dir,
        });
        o.shield = hit.shield.shieldLeft;
        if (!hit.fullyBlocked) {
          o.bump = hit.bump;
          o.vx = hit.vx;
          o.vy = hit.vy;
          o.onGround = false;
          o.stun = 0.16;
          s.lastHitBy[o.index] = a.index;
          s.lastHitT[o.index] = s.t;
        }
      }
      break;
    case "drum":
      for (const o of s.actors) {
        if (o === a || !o.onStage || o.safe > 0) continue;
        if (!o.onGround) continue;
        o.vy = -320;
        o.onGround = false;
        o.bump = addBump(o.bump, 3);
        o.stun = 0.2;
        s.lastHitBy[o.index] = a.index;
        s.lastHitT[o.index] = s.t;
      }
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// 平台
// ---------------------------------------------------------------------------

function updatePlatforms(s: MatchState, dt: number): void {
  s.stage.platforms.forEach((p, i) => {
    const st = s.plats[i];
    const pos = platformAt(p, s.t);
    st.prevX = st.x;
    st.prevY = st.y;
    st.x = pos.x;
    st.y = pos.y;
    if (st.hidden) {
      st.restoreT -= dt;
      if (st.restoreT <= 0) {
        st.hidden = false;
        st.standT = 0;
      }
      return;
    }
    if (!p.collapse) return;
    const someoneOn = s.actors.some((a) => a.onStage && a.platIndex === i);
    if (someoneOn) {
      st.standT += dt;
      if (st.standT >= p.collapse) {
        st.hidden = true;
        st.restoreT = p.restore ?? 3;
        st.standT = 0;
        s.events.push({ kind: "collapse", plat: i });
      }
    } else {
      st.standT = Math.max(0, st.standT - dt * 0.6);
    }
  });
}

/** 队友脑袋顶那条线（世界 y） */
function headTop(a: Actor): number {
  return a.y - actorRadius(a);
}

/**
 * 这一位队友的脑袋现在还站得住吗。
 * 他自己得在场上、站稳了，而且踩着的人没歪出去太远。
 */
function headHolds(rider: Actor, lifter: Actor): boolean {
  if (!lifter.onStage || !lifter.onGround) return false;
  if (lifter.team !== rider.team) return false;
  return Math.abs(rider.x - lifter.x) <= LIFT_RANGE + 8;
}

/**
 * 这一帧有没有落到某位队友的头顶上；没有就返回 -1。
 *
 * 同队的人本来就打不到彼此，1.1 里连站都站不到一起去；
 * 1.2 让队友的脑袋变成一小块软平台——踩上去站得住，才谈得上「顶我一下」。
 * 对手的头顶一律踩不住，所以这条路只通向配合。
 */
function landingHead(s: MatchState, a: Actor, prevFeet: number, feet: number): number {
  if (a.vy < 0) return -1;
  for (const o of s.actors) {
    if (o === a || !headHolds(a, o)) continue;
    const top = headTop(o);
    if (prevFeet > top + 6) continue;
    if (feet < top) continue;
    return o.index;
  }
  return -1;
}

/** 找脚下这一帧踩到的平台；没踩到返回 -1 */
function landingPlatform(s: MatchState, a: Actor, prevFeet: number, feet: number): number {
  if (a.vy < 0) return -1;
  const r = actorRadius(a);
  for (let i = 0; i < s.stage.platforms.length; i++) {
    const p = s.stage.platforms[i];
    const st = s.plats[i];
    if (st.hidden) continue;
    const top = st.y;
    // 「上一帧还在台面上方」比的要是上一帧的台面：升降台正往上走的时候，
    // 台面这一帧能抬起两三个像素，拿新台面去判旧脚位，等于台子自己把落脚窗口吃掉了 ——
    // 人明明是从台子正上方落下来的，却被判成「早就在台子下面」，直接穿过去掉下场。
    if (prevFeet > st.prevY + 1) continue;
    if (feet < top) continue;
    if (a.x + r * 0.55 < st.x || a.x - r * 0.55 > st.x + p.w) continue;
    return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// 出招与命中
// ---------------------------------------------------------------------------

function attackPhase(a: Actor): "windup" | "active" | "recover" | null {
  if (!a.attack) return null;
  const spec = ATTACKS[a.attack.kind];
  if (a.attack.t < spec.windup) return "windup";
  if (a.attack.t < spec.windup + spec.active) return "active";
  return "recover";
}

function tryHit(s: MatchState, a: Actor): void {
  if (!a.attack) return;
  const spec = ATTACKS[a.attack.kind];
  const r = actorRadius(a);
  const hx = a.x + a.facing * (r + spec.reach * 0.45);
  const power = spec.power * a.char.power * powerMul(a.buffs) * (a.slot.powerBonus ?? 1);
  for (const o of s.actors) {
    if (o === a || !o.onStage || o.team === a.team) continue;
    if (a.attack.hit.includes(o.index)) continue;
    if (o.safe > 0) continue;
    const or = actorRadius(o);
    if (Math.abs(o.x - hx) > spec.reach * 0.55 + or) continue;
    if (Math.abs(o.y - a.y) > 46 + or) continue;
    a.attack.hit.push(o.index);
    const hit = resolveHit({
      bump: o.bump,
      shield: o.shield,
      weight: actorWeight(o),
      power,
      kind: spec.kind,
      attackerX: a.x,
      targetX: o.x,
      fallbackDir: a.facing,
    });
    const popped = hit.shield.popped;
    o.shield = hit.shield.shieldLeft;
    if (hit.fullyBlocked) {
      s.events.push({ kind: "block", actor: o.index, x: o.x, y: o.y });
      if (popped) s.events.push({ kind: "pop", actor: o.index, x: o.x, y: o.y });
      continue;
    }
    o.bump = hit.bump;
    o.vx = hit.vx;
    o.vy = hit.vy;
    o.onGround = false;
    o.platIndex = -1;
    o.ride = -1;
    o.attack = null;
    // 被弹飞的人重新拿满空中跳跃次数：救场的机会永远留着，不至于一下就没戏
    o.jumpsLeft = o.char.airJumps + extraAirJumps(o.buffs);
    // 元气见底的时候给 0.4 秒挣扎窗口：朝场地里按方向键就能把这一下挣回来大半
    o.struggle = canStruggle(o.bump) ? STRUGGLE_WINDOW : 0;
    o.stun = Math.min(0.7, 0.14 + hit.speed / 2600);
    a.hits++;
    s.lastHitBy[o.index] = a.index;
    s.lastHitT[o.index] = s.t;
    s.shake = Math.min(1, s.shake + (a.attack.kind === "heavy" ? 0.6 : 0.28));
    s.events.push({
      kind: "hit",
      actor: o.index,
      by: a.index,
      x: o.x,
      y: o.y,
      heavy: a.attack.kind === "heavy",
    });
    if (popped) s.events.push({ kind: "pop", actor: o.index, x: o.x, y: o.y });
  }
}

// ---------------------------------------------------------------------------
// 配合：顶举与接应
// ---------------------------------------------------------------------------

/**
 * 顶举：头顶上正踩着队友就把他送上去，自己不跳。
 * 成功返回 true，调用方据此跳过这一帧的普通跳跃。
 */
function tryLift(s: MatchState, a: Actor): boolean {
  if (a.coopCd > 0 || !a.onGround) return false;
  const me = coopView(a);
  for (const rider of s.actors) {
    if (rider === a || !canLift(me, coopView(rider))) continue;
    rider.vy = liftVelocity(a.char.power, actorWeight(rider));
    rider.vx += (rider.x - a.x) * 1.6;
    rider.onGround = false;
    rider.platIndex = -1;
    rider.ride = -1;
    rider.stun = 0;
    rider.jumpsLeft = rider.char.airJumps + extraAirJumps(rider.buffs);
    // 互相打气：顶的那一下两个人都松快一点
    rider.bump = clampBump(rider.bump - LIFT_RELIEF);
    a.bump = clampBump(a.bump - LIFT_RELIEF);
    a.coopCd = LIFT_COOLDOWN;
    a.lifts++;
    rider.helped++;
    s.events.push({ kind: "lift", actor: a.index, rider: rider.index, x: rider.x, y: rider.y });
    return true;
  }
  return false;
}

/**
 * 接应：甩一条星星绳，把飘在场边外面的队友往场地里拽一把。
 * 成功返回 true，调用方据此不再把这一下当成重击。
 */
function tryCatch(s: MatchState, a: Actor): boolean {
  if (a.coopCd > 0) return false;
  const zone = safeZone(s.stage);
  const me = coopView(a);
  for (const flyer of s.actors) {
    if (flyer === a || !canCatch(me, coopView(flyer), zone)) continue;
    const v = catchVelocity(flyer.x, flyer.vx, flyer.vy, zone);
    flyer.vx = v.vx;
    flyer.vy = v.vy;
    flyer.stun = 0;
    flyer.jumpsLeft = flyer.char.airJumps + extraAirJumps(flyer.buffs);
    a.coopCd = CATCH_COOLDOWN;
    a.catches++;
    flyer.helped++;
    s.events.push({ kind: "catch", actor: a.index, flyer: flyer.index, x: flyer.x, y: flyer.y });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 一帧
// ---------------------------------------------------------------------------

function buildAiView(s: MatchState, a: Actor) {
  const target = nearestOpponent(s, a);
  let item: { x: number; y: number } | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const it of s.items) {
    const d = Math.hypot(it.x - a.x, it.y - a.y);
    if (d < bestD) {
      bestD = d;
      item = { x: it.x, y: it.y };
    }
  }
  return {
    self: {
      x: a.x,
      y: a.y,
      vx: a.vx,
      vy: a.vy,
      onGround: a.onGround,
      bump: a.bump,
      jumpsLeft: a.jumpsLeft,
    },
    target: target
      ? {
          x: target.x,
          y: target.y,
          bump: target.bump,
          onGround: target.onGround,
          attacking: attackPhase(target) === "windup" || attackPhase(target) === "active",
          recovering: attackPhase(target) === "recover",
        }
      : null,
    item,
    safe: safeZone(s.stage),
    ground: standSpan(s.stage),
    stand: standingOn(s, a),
    pads: livePads(s),
    bounds: s.stage.bounds,
  };
}

/** 场上还在的台子，按此刻的位置给（升降 / 平移台会动） */
function livePads(s: MatchState): Array<{ min: number; max: number; top: number }> {
  const out: Array<{ min: number; max: number; top: number }> = [];
  for (let i = 0; i < s.stage.platforms.length; i++) {
    const st = s.plats[i];
    if (st.hidden) continue;
    out.push({ min: st.x, max: st.x + s.stage.platforms[i].w, top: st.y });
  }
  return out;
}

/**
 * 每一帧都过一道台沿保险：脚下这块台子到头了、那边又没有接得住的台子，
 * 就把那个方向的按键松开（顺手把跳也收了）。
 *
 * 只在 `decideAi` 里看边缘是拦不住的：轻松档 0.46 秒才想一次，
 * 按着方向键这段时间能跑一百三十多像素，想明白的时候人已经在场外了。
 */
function ledgeSafeInput(s: MatchState, a: Actor, input: Input): Input {
  if (!a.onGround) return input;
  const dir = input.right ? 1 : input.left ? -1 : 0;
  if (dir === 0) return input;
  const stand = standingOn(s, a);
  if (!stand) return input;
  const look = actorRadius(a) + Math.max(18, Math.abs(a.vx) * 0.12);
  const nextX = a.x + dir * look;
  if (nextX <= stand.max && nextX >= stand.min) return input;
  if (canLandBeyond(livePads(s), stand, a, dir)) return input;
  return { ...input, left: false, right: false, up: false };
}

/** 脚下这块台子现在的横向范围；悬空（或踩在队友头上）时是 null */
function standingOn(s: MatchState, a: Actor): { min: number; max: number } | null {
  if (!a.onGround || a.platIndex < 0) return null;
  const p = s.stage.platforms[a.platIndex];
  const st = s.plats[a.platIndex];
  if (!p || !st || st.hidden) return null;
  return { min: st.x, max: st.x + p.w };
}

function respawnActor(s: MatchState, a: Actor): void {
  const spawn = s.stage.spawns[a.index % s.stage.spawns.length];
  a.x = spawn.x;
  a.y = spawn.y - 60;
  a.vx = 0;
  a.vy = 0;
  a.bump = 0;
  a.shield = 0;
  a.buffs = emptyBuffs();
  a.attack = null;
  a.stun = 0;
  a.safe = SAFE_TIME;
  a.onGround = false;
  a.platIndex = -1;
  a.jumpsLeft = a.char.airJumps;
  a.onStage = true;
  a.struggle = 0;
  a.coopCd = 0;
  a.ride = -1;
  s.events.push({ kind: "respawn", actor: a.index, x: a.x, y: a.y });
}

/**
 * 开局时一共有几支队伍。
 * 只有一支（沙盒练习、合作特训的双人同队）就没有「谁把谁请出场」这回事，
 * 这一局要么打到时间到，要么由外面的过关条件说了算。
 */
export function startingTeams(s: MatchState): number {
  return new Set(s.actors.map((a) => a.team)).size;
}

/** 还站在场上的队伍（有上场机会或正在场上的） */
export function livingTeams(s: MatchState): number[] {
  const set = new Set<number>();
  for (const a of s.actors) {
    if (!a.retired) set.add(a.team);
  }
  return Array.from(set).sort((x, y) => x - y);
}

export interface TeamStat {
  team: number;
  stocks: number;
  kos: number;
  outs: number;
}

/**
 * 「上场机会还剩几成」。战役关经常给玩家 3 条命、对手只给 1 条（照顾小朋友），
 * 时间到的时候直接比剩几条，玩家躺着不动也稳赢 —— 得比剩下的**比例**。
 */
function stockShare(t: TeamStat): number {
  const started = t.stocks + t.outs;
  return started > 0 ? t.stocks / started : 0;
}

/** 每队现在的战况，按「上场机会剩得多 → 撞飞别人多 → 自己被撞飞少」排 */
export function teamStats(s: MatchState): TeamStat[] {
  const map = new Map<number, TeamStat>();
  for (const a of s.actors) {
    const cur = map.get(a.team) ?? { team: a.team, stocks: 0, kos: 0, outs: 0 };
    cur.stocks += Math.max(0, a.stocks);
    cur.kos += a.kos;
    cur.outs += a.outs;
    map.set(a.team, cur);
  }
  return Array.from(map.values()).sort(
    (x, y) => stockShare(y) - stockShare(x) || y.kos - x.kos || x.outs - y.outs
  );
}

/** 一整队做成了多少次配合动作（合作特训按它算过关） */
export function coopTally(s: MatchState, team: number): { lifts: number; catches: number } {
  let lifts = 0;
  let catches = 0;
  for (const a of s.actors) {
    if (a.team !== team) continue;
    lifts += a.lifts;
    catches += a.catches;
  }
  return { lifts, catches };
}

/** 时间到的时候按战况判胜负；并列就是平局（返回 null） */
export function timeoutWinner(s: MatchState): number | null {
  const stats = teamStats(s);
  if (stats.length === 0) return null;
  if (stats.length === 1) return stats[0].team;
  const a = stats[0];
  const b = stats[1];
  if (stockShare(a) === stockShare(b) && a.kos === b.kos && a.outs === b.outs) return null;
  return a.team;
}

/** 战役关的主角；这一局没设主角就是 null */
export function leadActor(s: MatchState): Actor | null {
  const i = s.cfg.lead;
  if (i === undefined || !Number.isInteger(i)) return null;
  return s.actors[i] ?? null;
}

/** 除了 `team` 以外战况最好的那一队；场上只有这一队就返回 null */
function rivalWinner(s: MatchState, team: number): number | null {
  const other = teamStats(s).find((t) => t.team !== team);
  return other ? other.team : null;
}

/**
 * 主角这一局是不是一个键都没按过。
 * 结算文案要靠它区分「打输了」和「压根没上手」。
 */
export function leadIdle(s: MatchState): boolean {
  const lead = leadActor(s);
  return lead !== null && !lead.acted;
}

function endMatch(s: MatchState, winner: number | null, reason: "ko" | "time"): void {
  // 判给主角那一队之前的最后一道关：他自己一个键都没按，这一局就不作数。
  // 队友替你打赢可以，但「手柄放在一边」不该解锁下一关。
  const lead = leadActor(s);
  const credited = lead !== null && winner === lead.team && !lead.acted ? null : winner;
  s.over = true;
  s.winnerTeam = credited;
  s.endReason = reason;
  s.events.push({ kind: "end", winnerTeam: credited });
}

/**
 * 推进一帧。`inputs` 按 actor 下标给操作，小电脑的槽位可以不给。
 * 直接改传进来的 state（每帧新建对象在手机上太费），返回同一个引用方便串写。
 */
export function stepMatch(s: MatchState, dt: number, inputs: Record<number, Input>): MatchState {
  if (s.over) return s;
  const step = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0));
  if (step <= 0) return s;
  s.events.length = 0;
  s.t += step;
  s.shake = Math.max(0, s.shake - step * 3);

  updatePlatforms(s, step);

  const gravity = GRAVITY * (s.stage.gravityScale ?? 1);
  const syrupY = syrupLevel(s.stage, s.t);
  const stageSafe = safeZone(s.stage);
  const stageGround = standSpan(s.stage);

  // ---- 道具掉落 ----
  if (s.cfg.itemEvery > 0 && s.t >= s.nextItemT && s.items.length < 4) {
    spawnItem(s);
    s.nextItemT = s.t + s.cfg.itemEvery * (0.7 + s.rand() * 0.6);
  }

  for (const a of s.actors) {
    if (a.retired) continue;

    // ---- 等待回场 ----
    if (!a.onStage) {
      a.respawn -= step;
      if (a.respawn <= 0) respawnActor(s, a);
      continue;
    }

    a.safe = Math.max(0, a.safe - step);
    a.stun = Math.max(0, a.stun - step);
    a.struggle = Math.max(0, a.struggle - step);
    a.coopCd = Math.max(0, a.coopCd - step);
    a.buffs = tickBuffs(a.buffs, step);
    a.lastItemT = Math.max(0, a.lastItemT - step);
    if (a.onGround && a.stun <= 0) a.bump = coolBump(a.bump, step, 2.4);

    // ---- 取本帧操作 ----
    let input: Input;
    if (a.slot.control === "ai") {
      // 快掉出场了就别再等反应间隔：空中跳跃只有一次、只抬得起一百来像素，
      // 轻松档 0.46 秒才想一次，等它想明白人已经低到跳不回来了 ——
      // 「对手自己掉下台、玩家白拿三星」大半就是这么来的。
      //
      // 只对「自己走下去的」提速。刚被打飞的那一下照旧要吃反应延迟，
      // 不然谁都救得回来，对局就再也打不出胜负了。
      //
      // 「空中跳跃用光了还没落地」跟真的飘出场外一样急：这段滞空里落点只剩横着挪
      // 这一个变量，0.46 秒想一次的话，等它发现自己会从台子边上擦过去，
      // 刹车加转向早就来不及了。云朵广场那次「对手飘到主平台左边 43 像素处掉下去」
      // 就是这么来的 —— 它一直按着左，两百多的横速一直到出界都没收回来。
      const selfInflicted = s.t - s.lastHitT[a.index] > PERIL_GRACE;
      const stranded = !a.onGround && a.jumpsLeft <= 0;
      const urgent = perilous(a, stageSafe, stageGround, livePads(s)) || stranded;
      if (selfInflicted && urgent && a.aiT > PERIL_THINK) {
        a.aiT = PERIL_THINK;
      }
      a.aiT -= step;
      if (a.aiT <= 0) {
        const tier: AiTier = a.slot.aiTier ?? "normal";
        const d = decideAi(buildAiView(s, a), tier, s.rand(), a.slot.aiStyle ?? "plain");
        a.aiInput = d.input;
        a.aiIntent = d.intent;
        a.aiT = AI_TIERS[tier].think;
        // 每想一次就算重新按了一次键：不然「一直按着」会被当成同一下，
        // 小电脑只会在第一帧出招，之后再也不动手
        a.prev = { ...a.prev, light: false, heavy: false, up: false };
      }
      input = ledgeSafeInput(s, a, a.aiInput);
    } else {
      input = inputs[a.index] ?? emptyInput();
      // 「这一局真人有没有上手」只认真按下去的那一下：僵直会把操作清空，
      // 所以要在清空之前记，不然被打懵的那几帧会被当成没按。
      if (!a.acted && (input.left || input.right || input.up || input.down || input.light || input.heavy)) {
        a.acted = true;
      }
    }
    // 挣扎窗口：僵直里唯一还能按的东西，所以要在「僵直清空操作」之前读
    const raw = input;
    if (a.struggle > 0 && (raw.left || raw.right)) {
      const zone = safeZone(s.stage);
      const inward: 1 | -1 = a.x < (zone.min + zone.max) / 2 ? 1 : -1;
      const pushing = inward === 1 ? raw.right : raw.left;
      if (pushing) {
        const v = struggleVelocity(a.vx, a.vy, inward);
        a.vx = v.vx;
        a.vy = v.vy;
        a.stun = Math.min(a.stun, 0.12);
        a.struggle = 0;
        s.events.push({ kind: "struggle", actor: a.index, x: a.x, y: a.y });
      }
    }
    if (a.stun > 0 || a.buffs.dizzy > 0) input = emptyInput();

    // ---- 配合：接应（按下 + 副动作，把飘在外面的队友拉回来） ----
    const caught =
      input.down && input.heavy && !a.prev.heavy && a.stun <= 0 && a.buffs.dizzy <= 0
        ? tryCatch(s, a)
        : false;

    // ---- 出招 ----
    if (a.attack) {
      const spec = ATTACKS[a.attack.kind];
      a.attack.t += step;
      if (attackPhase(a) === "active") tryHit(s, a);
      if (a.attack.t >= spec.windup + spec.active + spec.recover) a.attack = null;
    } else if (!caught && a.stun <= 0 && a.buffs.dizzy <= 0) {
      if (input.heavy && !a.prev.heavy) a.attack = { kind: "heavy", t: 0, hit: [] };
      else if (input.light && !a.prev.light) a.attack = { kind: "light", t: 0, hit: [] };
    }

    // ---- 横向移动 ----
    const canMove = a.stun <= 0 && a.buffs.dizzy <= 0 && attackPhase(a) !== "active";
    const dir = canMove ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
    if (dir !== 0) a.facing = dir > 0 ? 1 : -1;
    const run = RUN_SPEED * a.char.speed * speedMul(a.buffs);
    const plat = a.platIndex >= 0 ? s.stage.platforms[a.platIndex] : null;
    if (a.onGround) {
      if (plat?.ice) {
        a.vx += dir * 900 * step;
        a.vx *= Math.pow(0.86, step * 60 * 0.02);
        a.vx = Math.max(-run * 1.25, Math.min(run * 1.25, a.vx));
      } else {
        a.vx = dir * run;
      }
      if (plat?.drift) a.vx += plat.drift;
    } else if (canMove && dir !== 0) {
      // 空中推方向最多把人推到跑动速度。
      // 之前是「先加速、超了再乘 0.985」，那不是封顶而是慢一点的加速：
      // 一直朝一个方向按下去会收敛到一千六百多、半秒横穿全场，
      // 小电脑追道具追着追着就把自己射出了场外。
      // 比跑动速度更快的横向速度只可能来自被撞飞，那一份照旧慢慢衰减、手感不变。
      const pushed = a.vx + dir * AIR_ACCEL * step;
      a.vx =
        Math.abs(pushed) > run
          ? Math.sign(pushed) * Math.max(run, Math.abs(a.vx) * 0.985)
          : pushed;
    }

    // ---- 跳（先看看头顶上是不是站着队友：那就改成顶举） ----
    const lifted = canMove && input.up && !a.prev.up ? tryLift(s, a) : false;
    if (canMove && input.up && !a.prev.up && !lifted) {
      const maxJumps = a.char.airJumps + extraAirJumps(a.buffs);
      if (a.onGround) {
        a.vy = JUMP_V * a.char.jump * jumpMul(a.buffs);
        a.onGround = false;
        a.platIndex = -1;
        a.ride = -1;
        a.jumpsLeft = maxJumps;
      } else if (a.jumpsLeft > 0) {
        a.jumpsLeft--;
        a.vy = JUMP_V * a.char.jump * jumpMul(a.buffs) * 0.92;
      }
    }
    // 按住下 + 跳：从软平台上跳下去
    if (canMove && a.onGround && input.down && input.up && plat?.kind === "pass") {
      a.onGround = false;
      a.platIndex = -1;
      a.y += 6;
      a.vy = 40;
    }

    // ---- 竖直 ----
    const prevFeet = a.y + actorRadius(a);
    if (a.onGround) {
      a.vy = 0;
      // 踩在队友头顶上：他往哪走，脑袋就跟到哪，站着的人也跟着挪
      if (a.ride >= 0) {
        const lifter = s.actors[a.ride];
        a.y = headTop(lifter) - actorRadius(a);
      } else if (a.platIndex >= 0) {
        const st = s.plats[a.platIndex];
        if (st.hidden) {
          a.onGround = false;
          a.platIndex = -1;
        } else {
          a.x += st.x - st.prevX;
          a.y = st.y - actorRadius(a);
        }
      }
      a.x += a.vx * step;
    } else {
      const fall = fallMul(a.buffs);
      const flown = stepFlight(
        { x: a.x, y: a.y, vx: a.vx, vy: a.vy },
        step,
        {
          gravity: gravity * fall,
          drag: a.stun > 0 ? 0.15 : 0.5,
          wind: s.stage.wind ?? 0,
          maxFall: 900 * fall,
        }
      );
      a.x = flown.x;
      a.y = flown.y;
      a.vx = flown.vx;
      a.vy = flown.vy;
    }

    // ---- 落地 ----
    if (!a.onGround) {
      const feet = a.y + actorRadius(a);
      // 先看看有没有落到队友头顶上——那是这一款唯一「站得住的人」
      const hi = landingHead(s, a, prevFeet, feet);
      const pi = hi >= 0 ? -1 : landingPlatform(s, a, prevFeet, feet);
      if (hi >= 0) {
        a.onGround = true;
        a.ride = hi;
        a.platIndex = -1;
        a.y = headTop(s.actors[hi]) - actorRadius(a);
        a.vy = 0;
        a.jumpsLeft = a.char.airJumps + extraAirJumps(a.buffs);
      } else if (pi >= 0) {
        const p = s.stage.platforms[pi];
        const st = s.plats[pi];
        if (p.bounce) {
          a.vy = -p.bounce * 22;
          a.jumpsLeft = a.char.airJumps + extraAirJumps(a.buffs);
        } else {
          a.onGround = true;
          a.platIndex = pi;
          a.y = st.y - actorRadius(a);
          a.vy = 0;
          a.jumpsLeft = a.char.airJumps + extraAirJumps(a.buffs);
        }
      }
    } else if (a.ride >= 0) {
      // 踩着的队友走开了、跳走了或者被撞飞了，脚下自然就空了
      if (!headHolds(a, s.actors[a.ride])) {
        a.onGround = false;
        a.ride = -1;
      }
    } else {
      // 走出平台边缘就自然掉下去
      const st = s.plats[a.platIndex];
      const p = a.platIndex >= 0 ? s.stage.platforms[a.platIndex] : null;
      if (!p || !st || st.hidden || a.x < st.x - 6 || a.x > st.x + p.w + 6) {
        a.onGround = false;
        a.platIndex = -1;
      }
    }

    // ---- 咕嘟糖浆：碰到只会被弹得高高的 ----
    if (Number.isFinite(syrupY) && a.y + actorRadius(a) > syrupY && a.safe <= 0) {
      const s2 = s.stage.syrup;
      if (s2) {
        a.y = syrupY - actorRadius(a) - 2;
        a.vy = -s2.bounce * 20;
        a.onGround = false;
        a.platIndex = -1;
        a.bump = addBump(a.bump, s2.bump);
        a.jumpsLeft = a.char.airJumps + extraAirJumps(a.buffs);
        s.events.push({ kind: "syrup", actor: a.index, x: a.x, y: a.y });
      }
    }

    a.prev = { ...input };
  }

  // ---- 道具下落与拾取 ----
  for (const it of s.items) {
    it.life += step;
    if (!it.landed) {
      it.vy = Math.min(320, it.vy + 620 * step);
      it.y += it.vy * step;
      for (let i = 0; i < s.stage.platforms.length; i++) {
        const p = s.stage.platforms[i];
        const st = s.plats[i];
        if (st.hidden) continue;
        if (it.x < st.x || it.x > st.x + p.w) continue;
        if (it.y >= st.y - 12 && it.y <= st.y + 18) {
          it.y = st.y - 12;
          it.vy = 0;
          it.landed = true;
          break;
        }
      }
    }
    // 吸铁石：把道具往身边拉
    for (const a of s.actors) {
      if (!a.onStage || a.buffs.magnet <= 0) continue;
      const d = Math.hypot(a.x - it.x, a.y - it.y);
      if (d < 240 && d > 1) {
        it.x += ((a.x - it.x) / d) * 220 * step;
        it.y += ((a.y - it.y) / d) * 220 * step;
        it.landed = false;
      }
    }
  }
  s.items = s.items.filter((it) => {
    if (it.y > s.stage.bounds.bottom || it.life > 16) return false;
    for (const a of s.actors) {
      if (!a.onStage) continue;
      if (Math.hypot(a.x - it.x, a.y - it.y) < actorRadius(a) + 16) {
        applyItem(s, a, it.def);
        s.events.push({ kind: "item", actor: a.index, item: it.def.id, x: it.x, y: it.y });
        return false;
      }
    }
    return true;
  });

  // ---- 出界结算 ----
  for (const a of s.actors) {
    if (!a.onStage || a.retired) continue;
    const side = outOfBoundsSide(a.x, a.y, s.stage.bounds);
    if (!side) continue;
    a.onStage = false;
    a.respawn = RESPAWN_DELAY;
    a.outs++;
    a.stocks = Math.max(0, a.stocks - 1);
    const by = s.t - s.lastHitT[a.index] < 3 ? s.lastHitBy[a.index] : -1;
    if (by >= 0 && s.actors[by] && s.actors[by].team !== a.team) s.actors[by].kos++;
    s.events.push({ kind: "ko", actor: a.index, by, side, x: a.x, y: a.y });
    s.shake = Math.min(1, s.shake + 0.7);
    if (a.stocks <= 0) {
      a.retired = true;
      s.events.push({ kind: "retire", actor: a.index });
    }
  }

  // ---- 胜负 ----
  // 开局就只有一队（一个人的沙盒局、两个人的合作特训）不判胜负，让他们自己练
  const teams = livingTeams(s);
  if (teams.length === 0 && s.actors.length > 0) {
    endMatch(s, null, "ko");
    return s;
  }
  if (startingTeams(s) > 1 && teams.length <= 1) {
    endMatch(s, teams.length === 1 ? teams[0] : null, "ko");
    return s;
  }
  // 战役关的主角自己出局了：这一关到此为止。
  // 组队赛的队友还站着也不算过关 —— 玩家已经在场边加油区了，星星不该发给他。
  const lead = leadActor(s);
  if (lead && lead.retired && startingTeams(s) > 1) {
    endMatch(s, rivalWinner(s, lead.team), "ko");
    return s;
  }
  if (s.cfg.timeLimit > 0 && s.t >= s.cfg.timeLimit) {
    endMatch(s, timeoutWinner(s), "time");
  }
  return s;
}

/**
 * 无头跑完一整局（单测与关卡三星预演用）。
 * `inputsFor` 每帧返回各个真人槽位的操作，不给就当没人按键。
 */
export function runMatch(
  s: MatchState,
  maxSeconds = 120,
  inputsFor?: (state: MatchState) => Record<number, Input>,
  dt = 1 / 60
): MatchState {
  const steps = Math.ceil(maxSeconds / dt);
  for (let i = 0; i < steps && !s.over; i++) {
    stepMatch(s, dt, inputsFor ? inputsFor(s) : {});
  }
  if (!s.over) endMatch(s, timeoutWinner(s), "time");
  return s;
}
