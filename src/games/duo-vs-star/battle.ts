/**
 * 朵朵大战星星 · 一局混战的确定性状态机。
 *
 * 这里比的不是谁更抗打：挨拍只会让「击退值」上涨，被撞出场地四周的
 * 弹飞线就少一次上场机会，上场机会用完就到场边加油区休息，最后还站在
 * 场上的队伍获胜。
 *
 * 状态机不碰 DOM：同一份 `stepMatch` 既给 canvas 渲染用，也给单测跑完整对局。
 */
import { AI_TIERS, decideAi, emptyInput, type AiTier, type AiIntent, type Input } from "./ai";
import {
  emptyBuffs,
  extraAirJumps,
  fallMul,
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
  addBump,
  clampBump,
  coolBump,
  outOfBoundsSide,
  resolveHit,
  stepFlight,
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
    retired: false,
    onStage: true,
    prev: emptyInput(),
    aiT: 0,
    aiInput: emptyInput(),
    aiIntent: "wait",
    lastItem: null,
    lastItemT: 0,
  };
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
  const x = zone.min + 30 + s.rand() * Math.max(20, zone.max - zone.min - 60);
  s.items.push({ id: s.nextItemId++, def, x, y: -30, vy: 90, landed: false, life: 0 });
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

/** 找脚下这一帧踩到的平台；没踩到返回 -1 */
function landingPlatform(s: MatchState, a: Actor, prevFeet: number, feet: number): number {
  if (a.vy < 0) return -1;
  const r = actorRadius(a);
  for (let i = 0; i < s.stage.platforms.length; i++) {
    const p = s.stage.platforms[i];
    const st = s.plats[i];
    if (st.hidden) continue;
    const top = st.y;
    if (prevFeet > top + 1) continue;
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
    o.attack = null;
    // 被弹飞的人重新拿满空中跳跃次数：救场的机会永远留着，不至于一下就没戏
    o.jumpsLeft = o.char.airJumps + extraAirJumps(o.buffs);
    o.stun = Math.min(0.7, 0.14 + hit.speed / 2600);
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
    target: target ? { x: target.x, y: target.y, bump: target.bump, onGround: target.onGround } : null,
    item,
    safe: safeZone(s.stage),
    bounds: s.stage.bounds,
  };
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
  s.events.push({ kind: "respawn", actor: a.index, x: a.x, y: a.y });
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

/** 每队现在的战况，按「剩余上场机会多 → 撞飞别人多 → 自己被撞飞少」排 */
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
    (x, y) => y.stocks - x.stocks || y.kos - x.kos || x.outs - y.outs
  );
}

/** 时间到的时候按战况判胜负；并列就是平局（返回 null） */
export function timeoutWinner(s: MatchState): number | null {
  const stats = teamStats(s);
  if (stats.length === 0) return null;
  if (stats.length === 1) return stats[0].team;
  const a = stats[0];
  const b = stats[1];
  if (a.stocks === b.stocks && a.kos === b.kos && a.outs === b.outs) return null;
  return a.team;
}

function endMatch(s: MatchState, winner: number | null, reason: "ko" | "time"): void {
  s.over = true;
  s.winnerTeam = winner;
  s.endReason = reason;
  s.events.push({ kind: "end", winnerTeam: winner });
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
    a.buffs = tickBuffs(a.buffs, step);
    a.lastItemT = Math.max(0, a.lastItemT - step);
    if (a.onGround && a.stun <= 0) a.bump = coolBump(a.bump, step, 2.4);

    // ---- 取本帧操作 ----
    let input: Input;
    if (a.slot.control === "ai") {
      a.aiT -= step;
      if (a.aiT <= 0) {
        const tier: AiTier = a.slot.aiTier ?? "normal";
        const d = decideAi(buildAiView(s, a), tier, s.rand());
        a.aiInput = d.input;
        a.aiIntent = d.intent;
        a.aiT = AI_TIERS[tier].think;
        // 每想一次就算重新按了一次键：不然「一直按着」会被当成同一下，
        // 小电脑只会在第一帧出招，之后再也不动手
        a.prev = { ...a.prev, light: false, heavy: false, up: false };
      }
      input = a.aiInput;
    } else {
      input = inputs[a.index] ?? emptyInput();
    }
    if (a.stun > 0 || a.buffs.dizzy > 0) input = emptyInput();

    // ---- 出招 ----
    if (a.attack) {
      const spec = ATTACKS[a.attack.kind];
      a.attack.t += step;
      if (attackPhase(a) === "active") tryHit(s, a);
      if (a.attack.t >= spec.windup + spec.active + spec.recover) a.attack = null;
    } else if (a.stun <= 0 && a.buffs.dizzy <= 0) {
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
      a.vx += dir * AIR_ACCEL * step;
      if (Math.abs(a.vx) > run) a.vx = Math.sign(a.vx) * Math.max(run, Math.abs(a.vx) * 0.985);
    }

    // ---- 跳 ----
    if (canMove && input.up && !a.prev.up) {
      const maxJumps = a.char.airJumps + extraAirJumps(a.buffs);
      if (a.onGround) {
        a.vy = JUMP_V * a.char.jump * jumpMul(a.buffs);
        a.onGround = false;
        a.platIndex = -1;
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
      // 平台自己在动（升降台 / 平移台）：站在上面的人跟着一起走
      if (a.platIndex >= 0) {
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
      const pi = landingPlatform(s, a, prevFeet, feet);
      if (pi >= 0) {
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
  // 只有一个人在场（练习 / 测试用的沙盒局）就不判胜负，让他自己玩
  const teams = livingTeams(s);
  if (s.actors.length > 1 && teams.length <= 1) {
    endMatch(s, teams.length === 1 ? teams[0] : null, "ko");
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
