/**
 * 噗噗兄弟 · 纯逻辑层(不碰 DOM,可以在测试里把整关跑完)。
 *
 * 这里放五样东西:
 *  1. 跳跃 / 单向浮台 / 掉落的物理;
 *  2. 「泡泡糖气流」的吹、飘、裹住、噗一下戳破;
 *  3. 合作闯关的清场判定与三星评分,对战的三局两胜赛制;
 *  4. 三档人机(新手 / 熟练 / 大师),同一个世界喂进去输出确定;
 *  5. 一个会自己把关卡打通的小机器人 —— 188 关的可解性就是靠它逐关跑出来的,
 *     而不是只检查数据结构长得对不对。
 *
 * 坐标同 arena.ts:x 向右,y 向下,0 在场地顶部;
 * 角色与怪物的 (x, y) 指「脚底中点」,浮台的 y 指上表面。
 */
import {
  ARENA_H,
  ARENA_W,
  CEILING_Y,
  FLOOR_Y,
  ROW_H,
  WALL,
  supportChain,
  surfaceSpan,
  surfaceY,
  type ArenaDef,
  type MonsterKind,
  type PlatformDef,
} from "./arena";

// ---------------------------------------------------------------------------
// 物理常量
// ---------------------------------------------------------------------------

export const GRAVITY = 1750;
export const MOVE_SPEED = 195;
export const JUMP_V = 690;
/** 空中左右微调的跟随速度 */
export const AIR_CONTROL = 7;
export const PLAYER_W = 26;
export const PLAYER_H = 34;
export const MONSTER_W = 30;
export const MONSTER_H = 28;
/** 蹦蹦怪的起跳速度 */
export const HOP_V = 430;
/** 蹦蹦怪两次弹跳之间的间隔 */
export const HOP_INTERVAL = 1.35;
/** 追追怪发现玩家的横向距离 */
export const CHASE_RANGE = 200;

/** 泡泡半径 */
export const BUBBLE_R = 17;
/** 吹出去时的横向速度与持续时间 */
export const BLOW_SPEED = 320;
export const BLOW_TIME = 0.4;
/** 两口气流之间的冷却 */
export const BLOW_CD = 0.4;
/**
 * 泡泡飘停的高度:从它脚下那块地面的上表面往上量。
 * 关键在于它必须小于层高(不然泡泡会飘进上一层),
 * 又要让站在地面上的人「噗」得着(见 popReachFromGround),
 * 所以不能按「从抓住的那一刻再往上飘 N 像素」来算 ——
 * 蹦蹦怪在半空被裹住时,那样算出来的泡泡会高得够不着。
 */
export const FLOAT_HEIGHT = 68;
export const RISE_SPEED = 96;
/** 空泡泡 / 裹着东西的泡泡各能撑多久 */
export const BUBBLE_LIFE = 6.5;
export const HELD_LIFE = 9;
/** 泡泡飘到位以后上下轻轻晃的幅度与频率 */
export const BOB_AMP = 5;
export const BOB_SPEED = 2.4;
/** 「噗」一下的够得着距离(从泡泡表面算起) */
export const POP_RANGE = 34;
export const POP_CD = 0.18;

/**
 * 起跳冲上去、或者从高处落下来的那一瞬间,身上带着一股气浪:
 * 竖直速度超过这个值时撞到咕噜怪不会挨打,反而会把它撞得发懵。
 * 站着不动去蹭它照样要挨一下 —— 跳是躲,不是免死金牌。
 */
export const PUFF_VY = 260;
/** 被气浪撞开的横向距离 */
export const PUFF_PUSH = 26;

/** 挨了一下之后的无敌时间 */
export const HURT_INVULN = 1.3;
/** 咕噜怪从破掉的泡泡里出来后发懵的时间 */
export const DIZZY_TIME = 0.9;
/** 对战里被戳破之后重新上场要等多久 */
export const RESPAWN_TIME = 1.4;
/** 被裹住之后要挣扎几下才能自己钻出来 */
export const STRUGGLE_NEED = 5;
/** 蹲着按跳穿过浮台以后,这段时间内不再踩住浮台 */
export const DROP_TIME = 0.3;
/** 物理最大子步长:再大的 dt 会被切开,保证快慢机上手感一致 */
export const MAX_SUBSTEP = 1 / 120;

/** 一次起跳能上升的最高点(px) */
export function jumpApex(): number {
  return (JUMP_V * JUMP_V) / (2 * GRAVITY);
}

/** 一次起跳能跨过的水平距离(px) */
export function jumpRange(): number {
  return ((2 * JUMP_V) / GRAVITY) * MOVE_SPEED;
}

/** 一口气流从吹出到停住,泡泡中心一共飞多远(px) */
export function blowReach(): number {
  return PLAYER_W / 2 + BUBBLE_R + BLOW_SPEED * BLOW_TIME;
}

/** 「噗」一下能够到多远(从泡泡中心到身体最近的一点) */
export function popReach(): number {
  return BUBBLE_R + POP_RANGE;
}

/**
 * 站在地面上时,头顶那颗飘停的泡泡离身体有多远(含上下轻晃的最差情况)。
 * 它必须小于 popReach(),否则「裹住了却戳不破」,188 关就不可解了。
 */
export function popGapFromGround(): number {
  return FLOAT_HEIGHT + BOB_AMP - PLAYER_H;
}

// ---------------------------------------------------------------------------
// 输入
// ---------------------------------------------------------------------------

export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** 主动作:吹一口泡泡糖气流 */
  act: boolean;
  /** 副动作:噗一下戳破身边的泡泡 */
  sub: boolean;
}

export function emptyInput(): Input {
  return { left: false, right: false, up: false, down: false, act: false, sub: false };
}

export type InputName = keyof Input;

/** 双人键位:朵朵 W A S D + F/G,星星 ↑←↓→ + L/K */
export const KEY_MAP: Record<string, { player: 0 | 1; action: InputName }> = {
  KeyW: { player: 0, action: "up" },
  KeyA: { player: 0, action: "left" },
  KeyS: { player: 0, action: "down" },
  KeyD: { player: 0, action: "right" },
  KeyF: { player: 0, action: "act" },
  KeyG: { player: 0, action: "sub" },
  ArrowUp: { player: 1, action: "up" },
  ArrowLeft: { player: 1, action: "left" },
  ArrowDown: { player: 1, action: "down" },
  ArrowRight: { player: 1, action: "right" },
  KeyL: { player: 1, action: "act" },
  KeyK: { player: 1, action: "sub" },
};

/**
 * 键盘事件 code 翻译成「几号玩家的哪个动作」。
 * 一个人玩的时候两套键位都开给 1 号玩家(左右手都顺);
 * 人机对战时电脑占 2 号位,方向键那套就交给电脑,人只用 WASD+F/G。
 */
export function keyToAction(
  code: string,
  playerCount: number,
  humanCount = playerCount
): { player: number; action: InputName } | null {
  const hit = KEY_MAP[code];
  if (!hit) return null;
  if (playerCount <= 1 || humanCount <= 1) return { player: 0, action: hit.action };
  return { player: hit.player, action: hit.action };
}

/** Esc 暂停 */
export function isPauseKey(code: string): boolean {
  return code === "Escape";
}

// ---------------------------------------------------------------------------
// 世界状态
// ---------------------------------------------------------------------------

export interface PlayerState {
  index: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  /** 最近一次站住的地面(-1 是地板),机器人导航靠它 */
  surface: number;
  blowCd: number;
  popCd: number;
  invuln: number;
  /** 蹲跳穿台的计时 */
  dropT: number;
  /** 正在从哪块浮台穿下去(只让这一块失效,免得连穿两层) */
  dropFrom: number;
  prevUp: boolean;
  hurtFlash: number;
  /** 被裹进泡泡里了(对战限定) */
  trapped: boolean;
  /** 挣扎次数,攒够 STRUGGLE_NEED 就自己钻出来 */
  struggle: number;
  /** 上一帧有没有按着方向键(数挣扎次数用) */
  prevStruggleKey: boolean;
  /** 被戳破以后的重生倒计时 */
  respawnT: number;
  /** 本人戳破的泡泡数(合作:清掉的咕噜怪;对战:本局得分) */
  pops: number;
  /** 本人吃到的糖果 */
  candies: number;
  /** 连着戳破的次数(合作与无尽的连击) */
  combo: number;
  comboT: number;
}

export interface MonsterState {
  kind: MonsterKind;
  x: number;
  y: number;
  vy: number;
  surface: number;
  minX: number;
  maxX: number;
  speed: number;
  dir: 1 | -1;
  /** free=在地上跑 bubbled=被裹住 gone=已经变成糖果 */
  state: "free" | "bubbled" | "gone";
  /** 刚从破掉的泡泡里出来,发懵不会动 */
  dizzy: number;
  hopT: number;
}

export type HoldKind = "monster" | "player";

export interface BubbleState {
  id: number;
  /** 谁吹出来的 */
  owner: number;
  x: number;
  y: number;
  vx: number;
  /** 还要平飞多久 */
  shootT: number;
  /** 飘到位以后停在哪个高度 */
  restY: number;
  life: number;
  bob: number;
  /** 裹着谁:null 是空泡泡 */
  hold: { kind: HoldKind; id: number } | null;
  popped: boolean;
}

export interface CandyState {
  x: number;
  y: number;
  vy: number;
  landed: boolean;
  taken: boolean;
}

export type EventKind =
  | "jump"
  | "blow"
  | "catch"
  | "pop"
  | "burst"
  | "candy"
  | "hurt"
  | "escape"
  | "combo"
  | "win"
  | "lose";

export interface WorldEvent {
  kind: EventKind;
  x: number;
  y: number;
  player?: number;
}

export type WorldStatus = "playing" | "won" | "lost";

export interface World {
  def: ArenaDef;
  /** 对战模式:两位玩家互为对手 */
  rivalry: boolean;
  players: PlayerState[];
  monsters: MonsterState[];
  bubbles: BubbleState[];
  candies: CandyState[];
  time: number;
  hearts: number;
  startHearts: number;
  /** 已经清掉的咕噜怪 */
  cleared: number;
  monsterTotal: number;
  candiesTaken: number;
  status: WorldStatus;
  /** 对战:这一局谁赢了(0 / 1 / -1 平局);合作模式恒为 -1 */
  roundWinner: number;
  message: string;
  events: WorldEvent[];
  nextBubbleId: number;
  /** 人机抖动用的确定性种子 */
  seed: number;
}

function makePlayer(index: number, x: number, y: number, surface: number): PlayerState {
  return {
    index,
    x,
    y,
    vx: 0,
    vy: 0,
    onGround: true,
    facing: index === 0 ? 1 : -1,
    surface,
    blowCd: 0,
    popCd: 0,
    invuln: 0,
    dropT: 0,
    dropFrom: -1,
    prevUp: false,
    hurtFlash: 0,
    trapped: false,
    struggle: 0,
    prevStruggleKey: false,
    respawnT: 0,
    pops: 0,
    candies: 0,
    combo: 0,
    comboT: 0,
  };
}

export interface WorldOpts {
  players?: number;
  /** 覆盖场地自带的心数(无尽模式跨波次带心用得上) */
  hearts?: number;
  /** 覆盖「互为对手」的默认值 */
  rivalry?: boolean;
}

export function createWorld(def: ArenaDef, opts: WorldOpts = {}): World {
  const count = Math.max(1, Math.min(2, Math.round(opts.players ?? (def.kind === "versus" ? 2 : 1))));
  const players: PlayerState[] = [];
  for (let i = 0; i < count; i++) {
    const spawn = def.spawns[i] ?? def.spawns[0] ?? { x: ARENA_W / 2, surface: -1 };
    players.push(makePlayer(i, spawn.x, surfaceY(def.platforms, spawn.surface), spawn.surface));
  }
  const hearts = opts.hearts ?? def.hearts;
  return {
    def,
    rivalry: opts.rivalry ?? def.kind === "versus",
    players,
    monsters: def.monsters.map((m) => ({
      kind: m.kind,
      x: m.x,
      y: surfaceY(def.platforms, m.surface),
      vy: 0,
      surface: m.surface,
      minX: m.minX,
      maxX: m.maxX,
      speed: m.speed,
      dir: m.dir,
      state: "free" as const,
      dizzy: 0,
      hopT: 0,
    })),
    bubbles: [],
    candies: def.candies.map((c) => ({
      x: c.x,
      y: surfaceY(def.platforms, c.surface) - 14,
      vy: 0,
      landed: true,
      taken: false,
    })),
    time: 0,
    hearts,
    startHearts: hearts,
    cleared: 0,
    monsterTotal: def.monsters.length,
    candiesTaken: 0,
    status: "playing",
    roundWinner: -1,
    message: "",
    events: [],
    nextBubbleId: 1,
    seed: (def.index + 1) * 2654435761 + (def.kind === "versus" ? 7919 : 104729),
  };
}

// ---------------------------------------------------------------------------
// 几何查询(纯函数,机器人与渲染都用)
// ---------------------------------------------------------------------------

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export function playerBox(p: PlayerState): Box {
  return { x0: p.x - PLAYER_W / 2, x1: p.x + PLAYER_W / 2, y0: p.y - PLAYER_H, y1: p.y };
}

export function monsterBox(m: MonsterState): Box {
  return { x0: m.x - MONSTER_W / 2, x1: m.x + MONSTER_W / 2, y0: m.y - MONSTER_H, y1: m.y };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/** 点到矩形的距离(点在矩形里算 0) */
export function distToBox(x: number, y: number, b: Box): number {
  const dx = Math.max(b.x0 - x, 0, x - b.x1);
  const dy = Math.max(b.y0 - y, 0, y - b.y1);
  return Math.hypot(dx, dy);
}

/** x 在不在某块地面的跨度里(留出半个身位的容差) */
export function overSurface(platforms: readonly PlatformDef[], surface: number, x: number, slack = 0): boolean {
  const span = surfaceSpan(platforms, surface);
  return x >= span.x0 - slack && x <= span.x1 + slack;
}

/**
 * (x, y) 正下方最近的那块地面(-1 是地板)。
 * 泡泡飘在哪块地面的上空、糖果会掉到哪儿,都靠它。
 */
export function surfaceBelow(platforms: readonly PlatformDef[], x: number, y: number): number {
  let best = -1;
  let bestY = FLOOR_Y;
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (x < p.x || x > p.x + p.w) continue;
    if (p.y < y - 1) continue;
    if (p.y < bestY) {
      bestY = p.y;
      best = i;
    }
  }
  return best;
}

export type Hop = { kind: "up"; platform: number } | { kind: "down" } | null;

/**
 * 从 from 这块地面去 to 那块地面的下一步:
 * 顺着 arena.ts 建好的支撑树走 —— 要么原地起跳顶穿到某块浮台上,
 * 要么蹲着按跳从脚下穿下去。因为每块浮台的中点都压在 parent 的跨度里,
 * 这条路一定走得通,这就是 188 关可解性的地基。
 */
export function nextHop(platforms: readonly PlatformDef[], from: number, to: number): Hop {
  if (from === to) return null;
  const chain = supportChain(platforms, to);
  const at = chain.indexOf(from);
  if (at > 0) return { kind: "up", platform: chain[at - 1] };
  return { kind: "down" };
}

/** 某位玩家脚下这块地面一路到地板的支撑链(末项恒为 -1) */
export function supportChainOfPlayer(w: World, p: PlayerState): number[] {
  return supportChain(w.def.platforms, p.surface);
}

/** 某块浮台的中点 x —— 站在这儿原地起跳就能顶上去 */
export function climbX(platforms: readonly PlatformDef[], platform: number): number {
  const span = surfaceSpan(platforms, platform);
  return (span.x0 + span.x1) / 2;
}

// ---------------------------------------------------------------------------
// 事件
// ---------------------------------------------------------------------------

function pushEvent(w: World, kind: EventKind, x: number, y: number, player?: number): void {
  if (w.events.length > 80) w.events.shift();
  w.events.push({ kind, x, y, player });
}

/** 取走并清空事件队列(渲染层每帧调一次,用来放音效和特效) */
export function drainEvents(w: World): WorldEvent[] {
  const out = w.events;
  w.events = [];
  return out;
}

// ---------------------------------------------------------------------------
// 泡泡
// ---------------------------------------------------------------------------

/** 泡泡在 (x, y) 处该飘停在多高:永远相对脚下那块地面来算 */
export function restHeightAt(platforms: readonly PlatformDef[], x: number, y: number): number {
  const below = surfaceBelow(platforms, x, y);
  return Math.max(CEILING_Y + BUBBLE_R, surfaceY(platforms, below) - FLOAT_HEIGHT);
}

function restFor(w: World, x: number, y: number): number {
  return restHeightAt(w.def.platforms, x, y);
}

function blow(w: World, p: PlayerState): void {
  const y = p.y - PLAYER_H * 0.55;
  const x = p.x + p.facing * (PLAYER_W / 2 + BUBBLE_R);
  const b: BubbleState = {
    id: w.nextBubbleId++,
    owner: p.index,
    x,
    y,
    vx: p.facing * BLOW_SPEED,
    shootT: BLOW_TIME,
    restY: restFor(w, x, y),
    life: BUBBLE_LIFE,
    bob: 0,
    hold: null,
    popped: false,
  };
  w.bubbles.push(b);
  p.blowCd = BLOW_CD;
  pushEvent(w, "blow", x, y, p.index);
}

/** 泡泡裹住东西的那一刻:寿命换成 HELD_LIFE,重新算一个飘停高度 */
function capture(w: World, b: BubbleState, hold: { kind: HoldKind; id: number }): void {
  b.hold = hold;
  b.shootT = 0;
  b.vx = 0;
  b.life = HELD_LIFE;
  b.restY = restFor(w, b.x, b.y);
  pushEvent(w, "catch", b.x, b.y, b.owner);
}

/** 咕噜怪回到自己那块地面上发一会儿懵(它永远不会换地面,机器人才导航得准) */
function releaseMonster(w: World, m: MonsterState, x: number): void {
  m.state = "free";
  m.x = Math.min(Math.max(x, m.minX), m.maxX);
  m.y = surfaceY(w.def.platforms, m.surface);
  m.vy = 0;
  m.dizzy = DIZZY_TIME;
  m.hopT = 0;
}

function dropCandy(w: World, x: number, y: number): void {
  w.candies.push({ x, y, vy: 0, landed: false, taken: false });
}

function bumpCombo(w: World, p: PlayerState): void {
  p.combo = p.comboT > 0 ? p.combo + 1 : 1;
  p.comboT = 2.4;
  if (p.combo >= 2) pushEvent(w, "combo", p.x, p.y - PLAYER_H, p.index);
}

/** 噗一下戳破泡泡:裹着咕噜怪就变糖果,裹着对手就得一分 */
function popBubble(w: World, b: BubbleState, by: PlayerState | null): void {
  if (b.popped) return;
  b.popped = true;
  // 归零寿命,让「破掉后再留一小会儿播动画」的计时从现在开始
  b.life = Math.min(b.life, 0);
  pushEvent(w, "pop", b.x, b.y, by?.index);
  const hold = b.hold;
  b.hold = null;
  if (!hold) return;

  if (hold.kind === "monster") {
    const m = w.monsters[hold.id];
    if (!m || m.state !== "bubbled") return;
    m.state = "gone";
    w.cleared++;
    if (by) {
      by.pops++;
      bumpCombo(w, by);
    }
    dropCandy(w, b.x, b.y);
    return;
  }

  const victim = w.players[hold.id];
  if (!victim) return;
  victim.trapped = false;
  victim.struggle = 0;
  victim.respawnT = RESPAWN_TIME;
  victim.vx = 0;
  victim.vy = 0;
  if (by && by.index !== victim.index) {
    by.pops++;
    bumpCombo(w, by);
  }
}

/** 泡泡自己撑不住破掉:裹着的东西原样放出来,不算谁的分 */
function burstBubble(w: World, b: BubbleState): void {
  if (b.popped) return;
  b.popped = true;
  b.life = Math.min(b.life, 0);
  pushEvent(w, "burst", b.x, b.y);
  const hold = b.hold;
  b.hold = null;
  if (!hold) return;
  if (hold.kind === "monster") {
    const m = w.monsters[hold.id];
    if (m && m.state === "bubbled") releaseMonster(w, m, b.x);
    return;
  }
  const victim = w.players[hold.id];
  if (!victim) return;
  victim.trapped = false;
  victim.struggle = 0;
  victim.invuln = HURT_INVULN;
  victim.y = b.y + PLAYER_H / 2;
  victim.vy = 0;
  pushEvent(w, "escape", b.x, b.y, victim.index);
}

function stepBubbles(w: World, dt: number): void {
  for (const b of w.bubbles) {
    b.life -= dt;
    // 破掉的泡泡再留一小会儿只是为了播个动画,不参与任何判定
    if (b.popped) continue;
    if (b.shootT > 0) {
      b.shootT = Math.max(0, b.shootT - dt);
      b.x += b.vx * dt;
      const lo = WALL + BUBBLE_R;
      const hi = ARENA_W - WALL - BUBBLE_R;
      if (b.x <= lo || b.x >= hi) {
        b.x = Math.min(Math.max(b.x, lo), hi);
        b.shootT = 0;
        b.vx = 0;
      }
      if (b.shootT === 0) b.restY = restFor(w, b.x, b.y);
    } else if (Math.abs(b.y - b.restY) > 0.5) {
      // 高了就慢慢沉、低了就慢慢升,最后停在离地面 FLOAT_HEIGHT 的地方
      const step = RISE_SPEED * dt;
      b.y += Math.min(step, Math.max(-step, b.restY - b.y));
    } else {
      b.bob += dt * BOB_SPEED;
      b.y = b.restY + Math.sin(b.bob) * BOB_AMP;
    }

    // 裹着的东西跟着泡泡走
    if (b.hold?.kind === "monster") {
      const m = w.monsters[b.hold.id];
      if (m) {
        m.x = b.x;
        m.y = b.y + MONSTER_H / 2;
        m.vy = 0;
      }
    } else if (b.hold?.kind === "player") {
      const p = w.players[b.hold.id];
      if (p) {
        p.x = b.x;
        p.y = b.y + PLAYER_H / 2;
        p.vx = 0;
        p.vy = 0;
      }
    }

    if (b.life <= 0) burstBubble(w, b);
  }
  w.bubbles = w.bubbles.filter((b) => (b.popped ? b.life > -0.35 : true));
  if (w.bubbles.length > 24) w.bubbles = w.bubbles.filter((b) => !b.popped);
}

/** 空泡泡碰到咕噜怪或对手就把它裹起来 */
function bubbleCatches(w: World): void {
  for (const b of w.bubbles) {
    if (b.popped || b.hold) continue;
    const bb: Box = { x0: b.x - BUBBLE_R, x1: b.x + BUBBLE_R, y0: b.y - BUBBLE_R, y1: b.y + BUBBLE_R };

    let caught = false;
    for (let i = 0; i < w.monsters.length; i++) {
      const m = w.monsters[i];
      if (m.state !== "free") continue;
      if (!overlaps(bb, monsterBox(m))) continue;
      m.state = "bubbled";
      m.vy = 0;
      capture(w, b, { kind: "monster", id: i });
      caught = true;
      break;
    }
    if (caught || !w.rivalry) continue;

    for (const p of w.players) {
      if (p.index === b.owner || p.trapped || p.invuln > 0 || p.respawnT > 0) continue;
      if (!overlaps(bb, playerBox(p))) continue;
      p.trapped = true;
      p.struggle = 0;
      p.prevStruggleKey = false;
      capture(w, b, { kind: "player", id: p.index });
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// 怪物
// ---------------------------------------------------------------------------

function nearestPlayerOnSurface(w: World, m: MonsterState): PlayerState | null {
  let best: PlayerState | null = null;
  let bestD = Infinity;
  for (const p of w.players) {
    if (p.trapped || p.respawnT > 0) continue;
    if (p.surface !== m.surface || !p.onGround) continue;
    const d = Math.abs(p.x - m.x);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return bestD <= CHASE_RANGE ? best : null;
}

function stepMonsters(w: World, dt: number): void {
  const groundY = (m: MonsterState): number => surfaceY(w.def.platforms, m.surface);
  for (const m of w.monsters) {
    if (m.state !== "free") continue;
    if (m.dizzy > 0) {
      m.dizzy = Math.max(0, m.dizzy - dt);
      continue;
    }

    if (m.kind === "chaser") {
      const target = nearestPlayerOnSurface(w, m);
      if (target) m.dir = target.x >= m.x ? 1 : -1;
    }
    if (m.kind === "hopper") {
      m.hopT += dt;
      if (m.y >= groundY(m) - 0.01 && m.hopT >= HOP_INTERVAL) {
        m.hopT = 0;
        m.vy = -HOP_V;
      }
      if (m.y < groundY(m) - 0.01 || m.vy < 0) {
        m.vy += GRAVITY * dt;
        m.y += m.vy * dt;
        if (m.y - MONSTER_H < CEILING_Y) {
          m.y = CEILING_Y + MONSTER_H;
          if (m.vy < 0) m.vy = 0;
        }
        if (m.y >= groundY(m)) {
          m.y = groundY(m);
          m.vy = 0;
        }
      }
    }

    const speed = m.kind === "chaser" && nearestPlayerOnSurface(w, m) ? m.speed * 1.35 : m.speed;
    m.x += m.dir * speed * dt;
    if (m.x <= m.minX) {
      m.x = m.minX;
      m.dir = 1;
    } else if (m.x >= m.maxX) {
      m.x = m.maxX;
      m.dir = -1;
    }
  }
}

// ---------------------------------------------------------------------------
// 玩家
// ---------------------------------------------------------------------------

function hurt(w: World, p: PlayerState, fromX: number, why: string): void {
  if (p.invuln > 0 || w.status !== "playing" || p.trapped || p.respawnT > 0) return;
  if (w.hearts <= 0) return;
  p.invuln = HURT_INVULN;
  p.hurtFlash = 0.5;
  p.combo = 0;
  p.comboT = 0;
  const away: 1 | -1 = p.x >= fromX ? 1 : -1;
  p.vx = away * 170;
  p.vy = -240;
  p.onGround = false;
  pushEvent(w, "hurt", p.x, p.y - 18, p.index);
  if (w.rivalry) return;
  w.hearts--;
  if (w.hearts <= 0) {
    w.status = "lost";
    w.message = why;
    pushEvent(w, "lose", p.x, p.y);
  }
}

function respawn(w: World, p: PlayerState): void {
  const spawn = w.def.spawns[p.index] ?? w.def.spawns[0] ?? { x: ARENA_W / 2, surface: -1 };
  p.x = spawn.x;
  p.y = surfaceY(w.def.platforms, spawn.surface);
  p.surface = spawn.surface;
  p.vx = 0;
  p.vy = 0;
  p.onGround = true;
  p.invuln = HURT_INVULN;
  p.dropT = 0;
  p.dropFrom = -1;
  p.trapped = false;
  p.struggle = 0;
}

/** 被裹住时的挣扎:每按一下方向键攒一次,攒够就自己钻出来 */
function stepTrapped(w: World, p: PlayerState, input: Input): void {
  const pressed = input.left || input.right || input.up || input.down;
  if (pressed && !p.prevStruggleKey) p.struggle++;
  p.prevStruggleKey = pressed;
  if (p.struggle < STRUGGLE_NEED) return;
  const holder = w.bubbles.find((b) => !b.popped && b.hold?.kind === "player" && b.hold.id === p.index);
  if (holder) burstBubble(w, holder);
}

function applyActions(w: World, p: PlayerState, input: Input, dt: number): void {
  // 先按方向再吹:同一帧里「转身 + 吹」要吹到转过去的那一边
  if (input.left !== input.right) p.facing = input.right ? 1 : -1;

  if (p.blowCd > 0) p.blowCd = Math.max(0, p.blowCd - dt);
  if (p.popCd > 0) p.popCd = Math.max(0, p.popCd - dt);
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  if (p.hurtFlash > 0) p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  if (p.dropT > 0) p.dropT = Math.max(0, p.dropT - dt);
  if (p.comboT > 0) {
    p.comboT = Math.max(0, p.comboT - dt);
    if (p.comboT === 0) p.combo = 0;
  }

  if (input.up && !p.prevUp && p.onGround) {
    if (input.down && p.surface >= 0) {
      // 蹲着按跳:从脚下这块浮台穿下去(只让这一块失效,不会一路穿到底)
      p.onGround = false;
      p.dropT = DROP_TIME;
      p.dropFrom = p.surface;
      p.y += 4;
      p.vy = 60;
    } else {
      p.vy = -JUMP_V;
      p.onGround = false;
      pushEvent(w, "jump", p.x, p.y, p.index);
    }
  }
  p.prevUp = input.up;

  if (input.act && p.blowCd <= 0) blow(w, p);

  if (input.sub && p.popCd <= 0) {
    p.popCd = POP_CD;
    const box = playerBox(p);
    for (const b of w.bubbles) {
      if (b.popped) continue;
      if (b.hold?.kind === "player" && b.hold.id === p.index) continue;
      if (distToBox(b.x, b.y, box) <= BUBBLE_R + POP_RANGE) popBubble(w, b, p);
    }
  }
}

function applyHorizontal(p: PlayerState, input: Input, dt: number): void {
  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;
  if (dir !== 0) p.facing = dir > 0 ? 1 : -1;

  const target = MOVE_SPEED * dir;
  if (p.onGround) p.vx = target;
  else p.vx += (target - p.vx) * Math.min(1, AIR_CONTROL * dt);

  p.x += p.vx * dt;
  const lo = WALL + PLAYER_W / 2;
  const hi = ARENA_W - WALL - PLAYER_W / 2;
  if (p.x < lo) {
    p.x = lo;
    p.vx = 0;
  } else if (p.x > hi) {
    p.x = hi;
    p.vx = 0;
  }
}

function applyVertical(w: World, p: PlayerState, dt: number): void {
  const prevFeet = p.y;
  p.vy += GRAVITY * dt;
  p.y += p.vy * dt;
  p.onGround = false;

  // 头顶天花板
  if (p.y - PLAYER_H < CEILING_Y) {
    p.y = CEILING_Y + PLAYER_H;
    if (p.vy < 0) p.vy = 0;
  }

  // 单向浮台:只有从上往下落、而且刚才还在台面之上,才踩得住
  if (p.vy >= 0) {
    for (let i = 0; i < w.def.platforms.length; i++) {
      if (p.dropT > 0 && p.dropFrom === i) continue;
      const pl = w.def.platforms[i];
      if (p.x < pl.x - PLAYER_W * 0.3 || p.x > pl.x + pl.w + PLAYER_W * 0.3) continue;
      if (prevFeet <= pl.y + 6 && p.y >= pl.y) {
        p.y = pl.y;
        p.vy = 0;
        p.onGround = true;
        p.surface = i;
        break;
      }
    }
  }

  if (!p.onGround && p.y >= FLOOR_Y) {
    p.y = FLOOR_Y;
    p.vy = 0;
    p.onGround = true;
    p.surface = -1;
  }
}

function playerInteractions(w: World, p: PlayerState): void {
  const box = playerBox(p);

  for (const c of w.candies) {
    if (c.taken) continue;
    if (distToBox(c.x, c.y, box) > 20) continue;
    c.taken = true;
    w.candiesTaken++;
    p.candies++;
    pushEvent(w, "candy", c.x, c.y, p.index);
  }

  // 撞上飘着的泡泡也算噗一下(跳上去顶破,手感更痛快)。
  // 还在平飞的气流不算:那是「要去裹人」的阶段,得先让它有机会裹住对手。
  for (const b of w.bubbles) {
    if (b.popped || b.shootT > 0) continue;
    if (b.hold?.kind === "player" && b.hold.id === p.index) continue;
    const bb: Box = { x0: b.x - BUBBLE_R, x1: b.x + BUBBLE_R, y0: b.y - BUBBLE_R, y1: b.y + BUBBLE_R };
    if (overlaps(box, bb)) popBubble(w, b, p);
  }

  for (const m of w.monsters) {
    if (m.state !== "free") continue;
    if (!overlaps(box, monsterBox(m))) continue;
    // 发懵的咕噜怪正看着小星星,撞上也不疼
    if (m.dizzy > 0) continue;
    if (Math.abs(p.vy) > PUFF_VY) {
      // 起跳 / 落地那一下带着气浪,把它撞得晕头转向
      m.dizzy = DIZZY_TIME;
      m.dir = p.x <= m.x ? 1 : -1;
      m.x = Math.min(Math.max(m.x + (p.x <= m.x ? PUFF_PUSH : -PUFF_PUSH), m.minX), m.maxX);
      pushEvent(w, "escape", m.x, m.y - MONSTER_H, p.index);
      continue;
    }
    hurt(w, p, m.x, "咕噜怪太顽皮啦!先用泡泡糖气流把它裹住再靠近。");
    return;
  }
}

function stepCandies(w: World, dt: number): void {
  for (const c of w.candies) {
    if (c.taken || c.landed) continue;
    c.vy += GRAVITY * 0.5 * dt;
    c.y += c.vy * dt;
    const below = surfaceBelow(w.def.platforms, c.x, c.y);
    const restY = surfaceY(w.def.platforms, below) - 14;
    if (c.y >= restY) {
      c.y = restY;
      c.vy = 0;
      c.landed = true;
    }
  }
}

// ---------------------------------------------------------------------------
// 胜负
// ---------------------------------------------------------------------------

function checkCoopGoal(w: World): void {
  if (w.status !== "playing") return;
  if (w.monsterTotal > 0 && w.cleared >= w.monsterTotal) {
    w.status = "won";
    w.message = "";
    pushEvent(w, "win", ARENA_W / 2, ARENA_H / 2);
  }
}

function checkVersusGoal(w: World): void {
  if (w.status !== "playing") return;
  const target = Math.max(1, w.def.roundTarget);
  for (const p of w.players) {
    if (p.pops >= target) {
      w.status = "won";
      w.roundWinner = p.index;
      pushEvent(w, "win", p.x, p.y - PLAYER_H);
      return;
    }
  }
  if (w.def.timeLimit > 0 && w.time >= w.def.timeLimit) {
    const a = w.players[0]?.pops ?? 0;
    const b = w.players[1]?.pops ?? 0;
    w.status = "won";
    w.roundWinner = a === b ? -1 : a > b ? 0 : 1;
    pushEvent(w, "win", ARENA_W / 2, ARENA_H / 2);
  }
}

function stepOnce(w: World, dt: number, inputs: Input[]): void {
  if (w.status !== "playing") return;
  w.time += dt;

  stepBubbles(w, dt);
  stepMonsters(w, dt);
  stepCandies(w, dt);

  for (let i = 0; i < w.players.length; i++) {
    const p = w.players[i];
    const input = inputs[i] ?? emptyInput();

    if (p.respawnT > 0) {
      p.respawnT = Math.max(0, p.respawnT - dt);
      if (p.respawnT === 0) respawn(w, p);
      continue;
    }
    if (p.trapped) {
      stepTrapped(w, p, input);
      continue;
    }

    applyActions(w, p, input, dt);
    applyHorizontal(p, input, dt);
    applyVertical(w, p, dt);
    playerInteractions(w, p);
    if (w.status !== "playing") return;
  }

  bubbleCatches(w);

  if (w.rivalry) {
    checkVersusGoal(w);
    return;
  }
  if (w.def.timeLimit > 0 && w.time > w.def.timeLimit) {
    w.status = "lost";
    w.message = "时间到啦!下次先清离自己最近的那只咕噜怪。";
    pushEvent(w, "lose", ARENA_W / 2, ARENA_H / 2);
    return;
  }
  checkCoopGoal(w);
}

/** 推进世界。任意 dt 都会被切成不超过 MAX_SUBSTEP 的小步,保证物理稳定 */
export function stepWorld(w: World, dt: number, inputs: Input[]): void {
  let left = Math.max(0, Math.min(0.25, dt));
  let guard = 0;
  while (left > 1e-6 && w.status === "playing" && guard++ < 64) {
    const step = Math.min(MAX_SUBSTEP, left);
    stepOnce(w, step, inputs);
    left -= step;
  }
}

// ---------------------------------------------------------------------------
// 结算与评分
// ---------------------------------------------------------------------------

export interface RunSummary {
  win: boolean;
  cleared: number;
  monsterTotal: number;
  candies: number;
  time: number;
  hearts: number;
  startHearts: number;
}

export function summarize(w: World): RunSummary {
  return {
    win: w.status === "won",
    cleared: w.cleared,
    monsterTotal: w.monsterTotal,
    candies: w.candiesTaken,
    time: w.time,
    hearts: w.hearts,
    startHearts: w.startHearts,
  };
}

/** 三条三星标准分别达成了没有:用时 / 糖果 / 一颗心都没丢 */
export function starGoals(def: ArenaDef, r: RunSummary): { time: boolean; candy: boolean; safe: boolean } {
  return {
    time: r.time <= def.parSeconds,
    candy: r.candies >= def.candyGoal,
    safe: r.hearts >= r.startHearts,
  };
}

/** 三条都达成 3 星,两条 2 星,其余 1 星 */
export function starsForRun(def: ArenaDef, r: RunSummary): 1 | 2 | 3 {
  const g = starGoals(def, r);
  const met = (g.time ? 1 : 0) + (g.candy ? 1 : 0) + (g.safe ? 1 : 0);
  if (met >= 3) return 3;
  if (met === 2) return 2;
  return 1;
}

/** 过关时给孩子看的一句夸奖(只夸做到的部分,没做到的说成「下次可以试试」) */
export function winMessage(def: ArenaDef, r: RunSummary): string {
  const g = starGoals(def, r);
  const done: string[] = [];
  const next: string[] = [];
  if (g.time) done.push(`只用了 ${Math.round(r.time)} 秒`);
  else next.push(`用时 ${Math.round(r.time)} 秒,标准是 ${def.parSeconds} 秒`);
  if (g.candy) done.push(`糖果收了 ${r.candies} 颗`);
  else next.push(`糖果差 ${Math.max(0, def.candyGoal - r.candies)} 颗`);
  if (g.safe) done.push("一颗心都没丢");
  else next.push(`被咕噜怪碰到了 ${r.startHearts - r.hearts} 次`);
  const head = done.length ? `${done.join("、")},真棒!` : "顺利清场啦!";
  return next.length ? `${head}下次试试:${next.join(";")}。` : head;
}

/** 无尽模式的噗噗分:清怪、糖果、活下来的波次各算一点 */
export function endlessScore(cleared: number, candies: number, waves: number): number {
  return cleared * 12 + candies * 6 + Math.max(0, waves) * 40;
}

/** 连击加成:连着戳破 n 个泡泡额外给几分 */
export function comboBonus(combo: number): number {
  if (combo < 2) return 0;
  return Math.min(60, (combo - 1) * 8);
}

// ---------------------------------------------------------------------------
// 三局两胜赛制(纯数据,和世界完全解耦)
// ---------------------------------------------------------------------------

/** 先赢两局就拿下整场 */
export const ROUNDS_TO_WIN = 2;
/** 一直平局也不能没完没了:打满这么多局就按总分定胜负 */
export const MAX_ROUNDS = 5;

export interface MatchState {
  /** 两位玩家各赢了几局 */
  rounds: [number, number];
  /** 两位玩家的累计得分 */
  points: [number, number];
  /** 已经打完几局 */
  played: number;
}

export function newMatch(): MatchState {
  return { rounds: [0, 0], points: [0, 0], played: 0 };
}

/** 记一局结果(winner 传 -1 表示这局平了),返回新的赛况 */
export function applyRound(m: MatchState, winner: number, points: [number, number] = [0, 0]): MatchState {
  const rounds: [number, number] = [m.rounds[0], m.rounds[1]];
  if (winner === 0 || winner === 1) rounds[winner]++;
  return {
    rounds,
    points: [m.points[0] + points[0], m.points[1] + points[1]],
    played: m.played + 1,
  };
}

/** 整场的赢家:还没分出来返回 -1,打满局数还平就返回 -1 */
export function matchWinner(m: MatchState): number {
  if (m.rounds[0] >= ROUNDS_TO_WIN) return 0;
  if (m.rounds[1] >= ROUNDS_TO_WIN) return 1;
  if (m.played < MAX_ROUNDS) return -1;
  if (m.rounds[0] !== m.rounds[1]) return m.rounds[0] > m.rounds[1] ? 0 : 1;
  if (m.points[0] !== m.points[1]) return m.points[0] > m.points[1] ? 0 : 1;
  return -1;
}

export function isMatchOver(m: MatchState): boolean {
  return m.rounds[0] >= ROUNDS_TO_WIN || m.rounds[1] >= ROUNDS_TO_WIN || m.played >= MAX_ROUNDS;
}

/** 赛况一句话:「朵朵 1 : 0 星星」 */
export function scoreLine(m: MatchState, names: [string, string]): string {
  return `${names[0]} ${m.rounds[0]} : ${m.rounds[1]} ${names[1]}`;
}

// ---------------------------------------------------------------------------
// 机器人:合作闯关的自动通关(188 关可解性就是靠它逐关跑出来的)
// ---------------------------------------------------------------------------

/** 机器人站在同一块地面上、离目标多远才开吹 */
export const BOT_BLOW_MIN = 30;
export const BOT_BLOW_MAX = 132;
/** 贴得比这还近就先退半步(身体半宽 13 + 咕噜怪半宽 15,再留一截余量) */
export const BOT_BACKOFF = 54;
/** 同一层里进到这个距离就得先处理掉,不能埋头赶路 */
export const BOT_DANGER = 118;

interface BotTarget {
  x: number;
  y: number;
  surface: number;
  kind: "bubble" | "monster" | "candy";
  index: number;
}

/**
 * 机器人当前该去处理谁:先戳破已经裹住的泡泡,再去裹新的,最后才捡糖。
 * 双人时会分头行动 —— 离队友更近的目标要额外加一段「让给他」的代价,
 * 免得两个人挤在一起抢同一只咕噜怪,反倒各挨一下。
 */
export function chooseTarget(w: World, p: PlayerState): BotTarget | null {
  const plats = w.def.platforms;
  const mate = w.players.find((o) => o.index !== p.index && !o.trapped && o.respawnT <= 0) ?? null;

  const cost = (x: number, y: number): number => {
    const mine = Math.abs(x - p.x) + Math.abs(y - p.y) * 0.6;
    if (!mate) return mine;
    const theirs = Math.abs(x - mate.x) + Math.abs(y - mate.y) * 0.6;
    return theirs < mine ? mine + 150 : mine;
  };

  let best: BotTarget | null = null;
  let bestD = Infinity;

  for (const b of w.bubbles) {
    if (b.popped || b.hold?.kind !== "monster") continue;
    const d = cost(b.x, b.y);
    if (d < bestD) {
      bestD = d;
      best = { x: b.x, y: b.y, surface: surfaceBelow(plats, b.x, b.y), kind: "bubble", index: b.id };
    }
  }
  if (best) return best;

  for (let i = 0; i < w.monsters.length; i++) {
    const m = w.monsters[i];
    if (m.state !== "free") continue;
    const d = cost(m.x, m.y);
    if (d < bestD) {
      bestD = d;
      best = { x: m.x, y: m.y, surface: m.surface, kind: "monster", index: i };
    }
  }
  if (best) return best;

  for (let i = 0; i < w.candies.length; i++) {
    const c = w.candies[i];
    if (c.taken || !c.landed) continue;
    const d = cost(c.x, c.y);
    if (d < bestD) {
      bestD = d;
      best = { x: c.x, y: c.y, surface: surfaceBelow(plats, c.x, c.y + 16), kind: "candy", index: i };
    }
  }
  return best;
}

/** 沿着支撑树往目标那块地面挪一步;已经同层就返回 null(交给攻击逻辑) */
function navigate(w: World, p: PlayerState, input: Input, targetSurface: number): boolean {
  const plats = w.def.platforms;
  const hop = nextHop(plats, p.surface, targetSurface);
  if (!hop) return false;
  if (hop.kind === "up") {
    const mid = climbX(plats, hop.platform);
    const dx = mid - p.x;
    if (Math.abs(dx) > 9) {
      input.right = dx > 0;
      input.left = dx < 0;
    } else if (p.onGround) {
      input.up = true;
    }
    return true;
  }
  // 往下走:先挪到自己这块浮台的中点再穿下去。
  // 中点一定压在 parent 的跨度里(arena.ts 的支撑树保证),
  // 所以从中点掉下去必然稳稳落在下面那块上,不会一路漏到地板。
  if (p.surface >= 0) {
    const mid = climbX(plats, p.surface);
    const dx = mid - p.x;
    if (Math.abs(dx) > 10) {
      input.right = dx > 0;
      input.left = dx < 0;
      return true;
    }
  }
  if (p.onGround && p.surface >= 0) {
    input.down = true;
    input.up = true;
  }
  return true;
}

/** 咕噜怪这会儿站在自己那块地面上没有(蹦到半空的裹不住) */
function monsterLanded(w: World, m: MonsterState): boolean {
  return Math.abs(m.y - surfaceY(w.def.platforms, m.surface)) < 8;
}

/** 同一层里离我最近、还没被裹住的咕噜怪 */
function nearestThreat(w: World, p: PlayerState, range: number): MonsterState | null {
  let best: MonsterState | null = null;
  let bestD = range;
  for (const m of w.monsters) {
    if (m.state !== "free" || m.surface !== p.surface) continue;
    const d = Math.abs(m.x - p.x);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

/** 朝 dx 的反方向退,退到墙角就跳起来换个位置 */
function backOff(p: PlayerState, input: Input, dx: number): void {
  const away = dx >= 0 ? -1 : 1;
  const nextX = p.x + away * 60;
  if (nextX <= WALL + PLAYER_W || nextX >= ARENA_W - WALL - PLAYER_W) {
    // 退无可退:跳过它头顶
    if (p.onGround) input.up = true;
    input.right = dx > 0;
    input.left = dx < 0;
    return;
  }
  input.right = away > 0;
  input.left = away < 0;
}

/**
 * 合作 / 闯关模式下机器人这一帧要按什么键。
 * 顺序很重要:先处理贴脸的咕噜怪(不然一边赶路一边被撞,五颗心撑不过十秒),
 * 再去戳破已经裹住的泡泡,最后才是裹新的、捡糖。
 */
export function coopBotInput(w: World, playerIndex = 0): Input {
  const input = emptyInput();
  const p = w.players[playerIndex];
  if (!p || w.status !== "playing" || p.trapped || p.respawnT > 0) return input;

  // 无敌帧里撞不疼,正好埋头干活
  const threat = p.invuln <= 0.35 ? nearestThreat(w, p, BOT_DANGER) : null;
  if (threat) {
    const dx = threat.x - p.x;
    const adx = Math.abs(dx);
    const face: 1 | -1 = dx >= 0 ? 1 : -1;
    const safe = threat.dizzy > 0;
    if (!monsterLanded(w, threat) || (!safe && adx < BOT_BACKOFF)) {
      // 蹦在半空的裹不住,贴太近的先拉开距离(退的时候会转身,所以这一下不吹)
      backOff(p, input, dx);
      return input;
    }
    if (p.facing !== face) {
      input.right = face > 0;
      input.left = face < 0;
    } else if (safe && adx > BOT_BLOW_MAX) {
      input.right = dx > 0;
      input.left = dx < 0;
    }
    if (p.blowCd <= 0 && adx > BOT_BLOW_MIN && adx <= BOT_BLOW_MAX) input.act = true;
    return input;
  }

  const target = chooseTarget(w, p);
  if (!target) return input;

  if (navigate(w, p, input, target.surface)) return input;

  const dx = target.x - p.x;
  const adx = Math.abs(dx);
  const face: 1 | -1 = dx >= 0 ? 1 : -1;

  if (target.kind === "bubble") {
    // 走到泡泡底下噗一口;够得着就一直按,反正有冷却
    if (adx > 10) {
      input.right = dx > 0;
      input.left = dx < 0;
    }
    if (adx < BUBBLE_R + POP_RANGE) input.sub = true;
    return input;
  }

  if (target.kind === "candy") {
    if (adx > 6) {
      input.right = dx > 0;
      input.left = dx < 0;
    }
    return input;
  }

  // 咕噜怪:走到吹得到的距离,面朝它,吹
  if (adx > BOT_BLOW_MAX) {
    input.right = dx > 0;
    input.left = dx < 0;
    return input;
  }
  if (p.facing !== face) {
    input.right = face > 0;
    input.left = face < 0;
  }
  if (p.blowCd <= 0 && monsterLanded(w, w.monsters[target.index])) input.act = true;
  return input;
}

// ---------------------------------------------------------------------------
// 人机三档
// ---------------------------------------------------------------------------

export type BotLevel = "easy" | "normal" | "hard";

export interface BotProfile {
  key: BotLevel;
  name: string;
  blurb: string;
  /** 每隔多久重新拿一次主意(越小越灵敏) */
  react: number;
  /** 在多远之内就敢吹气流 */
  blowRange: number;
  /** 躲开迎面飞来的泡泡的概率 */
  dodge: number;
  /** 真的会动的帧占比(越低越像在发呆) */
  duty: number;
  /** 追着去戳破泡泡的积极程度 */
  chase: number;
}

export const BOT_PROFILES: Record<BotLevel, BotProfile> = {
  easy: {
    key: "easy",
    name: "小噗噗",
    blurb: "刚学会吹泡泡,反应慢半拍,适合第一次上手。",
    react: 0.6,
    blowRange: 120,
    dodge: 0,
    duty: 0.6,
    chase: 0.55,
  },
  normal: {
    key: "normal",
    name: "熟练噗噗",
    blurb: "会瞄准也会躲,认真打才赢得下来。",
    react: 0.28,
    blowRange: 150,
    dodge: 0.5,
    duty: 0.85,
    chase: 0.85,
  },
  hard: {
    key: "hard",
    name: "泡泡大师",
    blurb: "又准又狠,泡泡刚出手它就贴上来了。",
    react: 0.12,
    blowRange: 168,
    dodge: 0.9,
    duty: 1,
    chase: 1,
  },
};

export const BOT_LEVELS: BotLevel[] = ["easy", "normal", "hard"];

/** 确定性抖动:同一个世界、同一个时间片,算出来永远是同一个数 */
export function jitter(seed: number, salt: number, slot: number): number {
  let a = (seed ^ (salt * 0x9e3779b1) ^ (slot * 0x85ebca6b)) >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 有没有一颗别人吹的泡泡正朝我飞过来 */
function incomingBubble(w: World, p: PlayerState): BubbleState | null {
  for (const b of w.bubbles) {
    if (b.popped || b.hold || b.owner === p.index || b.shootT <= 0) continue;
    if (Math.abs(b.y - (p.y - PLAYER_H * 0.5)) > 34) continue;
    const rel = (p.x - b.x) * Math.sign(b.vx || 1);
    if (rel > 0 && rel < 160) return b;
  }
  return null;
}

/**
 * 对战模式的人机输入。纯函数:同样的世界 + 同样的档位,算出来的键永远一样,
 * 所以单测可以整场跑完再看谁赢。
 */
export function versusBotInput(w: World, playerIndex: number, level: BotLevel = "normal"): Input {
  const input = emptyInput();
  const prof = BOT_PROFILES[level] ?? BOT_PROFILES.normal;
  const p = w.players[playerIndex];
  if (!p || w.status !== "playing" || p.respawnT > 0) return input;

  const slot = Math.floor(w.time / prof.react);
  const j = jitter(w.seed, playerIndex * 31 + 1, slot);
  const j2 = jitter(w.seed, playerIndex * 31 + 2, slot);

  if (p.trapped) {
    // 被裹住了就左右猛挣扎(交替按,才数得上挣扎次数)
    const flip = Math.floor(w.time * 9) % 2 === 0;
    input.left = flip;
    input.right = !flip;
    return input;
  }

  const rival = w.players[1 - playerIndex];
  const plats = w.def.platforms;

  // 第一优先:对手已经被裹在泡泡里,冲上去噗一下
  const prize = w.bubbles.find((b) => !b.popped && b.hold?.kind === "player" && b.hold.id !== playerIndex);
  if (prize && j2 < prof.chase) {
    const surface = surfaceBelow(plats, prize.x, prize.y);
    if (!navigate(w, p, input, surface)) {
      const dx = prize.x - p.x;
      if (Math.abs(dx) > 10) {
        input.right = dx > 0;
        input.left = dx < 0;
      }
      if (Math.abs(dx) < BUBBLE_R + POP_RANGE) input.sub = true;
    }
    return input;
  }

  // 第二优先:躲开迎面飞来的泡泡
  const threat = incomingBubble(w, p);
  if (threat && j < prof.dodge) {
    if (p.onGround) input.up = true;
    input.left = threat.vx > 0;
    input.right = threat.vx < 0;
    return input;
  }

  if (!rival || rival.respawnT > 0) {
    // 对手不在场:顺路捡颗糖
    const candy = w.candies.find((c) => !c.taken && c.landed);
    if (candy && !navigate(w, p, input, surfaceBelow(plats, candy.x, candy.y + 16))) {
      const dx = candy.x - p.x;
      if (Math.abs(dx) > 6) {
        input.right = dx > 0;
        input.left = dx < 0;
      }
    }
    return input;
  }

  if (navigate(w, p, input, rival.surface)) {
    if (j >= prof.duty) {
      input.left = false;
      input.right = false;
    }
    return input;
  }

  const dx = rival.x - p.x;
  const adx = Math.abs(dx);
  const face: 1 | -1 = dx >= 0 ? 1 : -1;
  const aligned = Math.abs(rival.y - p.y) < 26;

  if (adx > prof.blowRange) {
    input.right = dx > 0;
    input.left = dx < 0;
  } else if (adx < BOT_BACKOFF) {
    input.right = dx < 0;
    input.left = dx > 0;
  } else if (p.facing !== face) {
    input.right = face > 0;
    input.left = face < 0;
  }

  // 高手只在对准了才出手,新手看见人就乱吹,气流全喂给了冷却
  const wantBlow = adx <= prof.blowRange && (aligned || level === "easy");
  if (wantBlow && p.blowCd <= 0) input.act = true;

  if (j >= prof.duty) {
    input.left = false;
    input.right = false;
  }
  return input;
}

// ---------------------------------------------------------------------------
// 自动对局(测试用,也给「看一遍怎么打」的演示留了口子)
// ---------------------------------------------------------------------------

export interface AutoPlayResult extends RunSummary {
  lost: boolean;
  steps: number;
  timedOut: boolean;
}

/** 让机器人把这个世界玩到底(测试里用来验「真的能通关」) */
export function autoPlay(w: World, opts: { dt?: number; maxSeconds?: number } = {}): AutoPlayResult {
  const dt = opts.dt ?? 1 / 60;
  const maxSeconds = opts.maxSeconds ?? 180;
  const limit = Math.ceil(maxSeconds / dt);
  let steps = 0;
  while (w.status === "playing" && steps < limit) {
    const inputs = w.players.map((_, i) => coopBotInput(w, i));
    stepWorld(w, dt, inputs);
    steps++;
  }
  return {
    ...summarize(w),
    lost: w.status === "lost",
    steps,
    timedOut: w.status === "playing",
  };
}

export interface VersusResult {
  winner: number;
  scores: [number, number];
  time: number;
  timedOut: boolean;
}

/** 两个人机打完一局,返回胜负与比分 */
export function autoVersusRound(
  w: World,
  levels: [BotLevel, BotLevel],
  opts: { dt?: number; maxSeconds?: number } = {}
): VersusResult {
  const dt = opts.dt ?? 1 / 60;
  const maxSeconds = opts.maxSeconds ?? (w.def.timeLimit > 0 ? w.def.timeLimit + 5 : 90);
  const limit = Math.ceil(maxSeconds / dt);
  let steps = 0;
  while (w.status === "playing" && steps < limit) {
    const inputs = w.players.map((_, i) => versusBotInput(w, i, levels[i] ?? "normal"));
    stepWorld(w, dt, inputs);
    steps++;
  }
  return {
    winner: w.roundWinner,
    scores: [w.players[0]?.pops ?? 0, w.players[1]?.pops ?? 0],
    time: w.time,
    timedOut: w.status === "playing",
  };
}

/** 几何红线自检:层高必须明显小于一次起跳的最高点,不然浮台就上不去了 */
export function rowHeightIsClimbable(): boolean {
  return ROW_H + PLAYER_H * 0.2 < jumpApex();
}
