/**
 * 便便超人 · 纯逻辑层(不碰 DOM,可以在测试里整关跑完)。
 *
 * 这里放三样东西:
 *  1. 跳跃 / 冲刺 / 蹲行的物理与碰撞;
 *  2. 清洁度、香香星、用时三条线的三星评分;
 *  3. 一个会自己打通关的小机器人 —— 测试靠它把关卡真的玩到「胜」,
 *     而不是只检查数据结构长得对不对。
 *
 * 坐标同 levels.ts:x 向右,y 向下,地面上表面 y = 0,空中是负数;
 * 角色的 (x, y) 指「脚底中点」。
 */
import {
  BEAM_CLEARANCE,
  dirtCount,
  groundSolidAt,
  type Gap,
  type LevelDef,
} from "./levels";

// ---------------------------------------------------------------------------
// 物理常量
// ---------------------------------------------------------------------------

export const GRAVITY = 2000;
/** 站着跑的速度 */
export const MOVE_SPEED = 250;
/** 蹲着挪的速度 */
export const CROUCH_SPEED = 130;
export const JUMP_V = 680;
/** 冲刺清扫的速度与时长 */
export const DASH_SPEED = 520;
export const DASH_TIME = 0.26;
export const DASH_COOLDOWN = 0.5;
/** 扫一扫(副动作):原地挥一下小扫帚 */
export const SWEEP_TIME = 0.24;
export const SWEEP_COOLDOWN = 0.42;
export const SWEEP_RANGE = 62;
export const PLAYER_W = 34;
export const PLAYER_H = 46;
export const CROUCH_H = 26;
export const MONSTER_W = 38;
export const MONSTER_H = 34;
/** 低矮管道的上下沿(下沿离地 BEAM_CLEARANCE) */
export const BEAM_TOP = -112;
export const BEAM_BOTTOM = -BEAM_CLEARANCE;
/** 掉出画面多深算摔下去 */
export const FALL_LIMIT = 260;
export const HURT_INVULN = 1.4;
export const STOMP_BOUNCE = 430;
export const SPRING_V = 900;
export const JUNK_R = 18;
/** 滑地板的减速系数(越小越滑) */
export const SLIP_FRICTION = 3.2;
/** 泥洼里的速度倍率 */
export const SLUDGE_SLOW = 0.55;
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

// ---------------------------------------------------------------------------
// 输入
// ---------------------------------------------------------------------------

export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** 动作键:冲刺清扫 */
  act: boolean;
  /** 副动作键:扫一扫 */
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
 * 单人模式下两套键位都开给 1 号玩家(一个人玩的时候左右手都顺)。
 */
export function keyToAction(
  code: string,
  playerCount: number
): { player: number; action: InputName } | null {
  const hit = KEY_MAP[code];
  if (!hit) return null;
  if (playerCount <= 1) return { player: 0, action: hit.action };
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
  crouch: boolean;
  dashT: number;
  dashCd: number;
  sweepT: number;
  sweepCd: number;
  invuln: number;
  prevUp: boolean;
  /** 本人清掉的脏东西数(双人合作用来分头统计) */
  cleaned: number;
  /** 本人捡到的香香星 */
  sparkles: number;
  /** 站在几号平台上(-1 表示地面或空中) */
  ridingPlatform: number;
  /** 刚从浮台上「蹲着跳」穿下去,这段时间内不再踩住浮台 */
  dropT: number;
  /** 刚受伤的抖动计时,只给渲染用 */
  hurtFlash: number;
}

export interface MonsterState {
  x: number;
  minX: number;
  maxX: number;
  speed: number;
  dir: 1 | -1;
  /** 已经变成小花了 */
  clean: boolean;
  /** 变花动画计时(渲染用) */
  bloom: number;
}

export interface StainState {
  x: number;
  clean: boolean;
  bloom: number;
}

export interface SludgeState {
  x: number;
  w: number;
  clean: boolean;
  bloom: number;
}

export interface SparkleState {
  x: number;
  y: number;
  ground: boolean;
  taken: boolean;
}

export interface PlatformState {
  baseX: number;
  x: number;
  prevX: number;
  y: number;
  w: number;
  moving: boolean;
  range: number;
  speed: number;
}

export interface JunkState {
  x: number;
  speed: number;
  alive: boolean;
}

export type EventKind =
  | "jump"
  | "dash"
  | "sweep"
  | "flower"
  | "wipe"
  | "sparkle"
  | "hurt"
  | "spring"
  | "smash"
  | "door"
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
  def: LevelDef;
  players: PlayerState[];
  monsters: MonsterState[];
  stains: StainState[];
  sludges: SludgeState[];
  sparkles: SparkleState[];
  platforms: PlatformState[];
  junks: JunkState[];
  springs: Array<{ x: number; squash: number }>;
  beams: Array<{ x: number; w: number }>;
  gaps: Gap[];
  chaserX: number | null;
  time: number;
  hearts: number;
  cleaned: number;
  dirtTotal: number;
  sparklesTaken: number;
  status: WorldStatus;
  /** 结算时给玩家看的一句话 */
  message: string;
  events: WorldEvent[];
}

function makePlayer(index: number, x: number): PlayerState {
  return {
    index,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    onGround: true,
    facing: 1,
    crouch: false,
    dashT: 0,
    dashCd: 0,
    sweepT: 0,
    sweepCd: 0,
    invuln: 0,
    prevUp: false,
    cleaned: 0,
    sparkles: 0,
    ridingPlatform: -1,
    dropT: 0,
    hurtFlash: 0,
  };
}

export function createWorld(def: LevelDef, playerCount = 1): World {
  const players: PlayerState[] = [];
  for (let i = 0; i < Math.max(1, playerCount); i++) {
    players.push(makePlayer(i, 70 + i * 56));
  }
  return {
    def,
    players,
    monsters: def.monsters.map((m) => ({
      x: m.x,
      minX: m.minX,
      maxX: m.maxX,
      speed: m.speed,
      dir: 1,
      clean: false,
      bloom: 0,
    })),
    stains: def.stains.map((s) => ({ x: s.x, clean: false, bloom: 0 })),
    sludges: def.sludges.map((s) => ({ x: s.x, w: s.w, clean: false, bloom: 0 })),
    sparkles: def.sparkles.map((s) => ({ x: s.x, y: s.y, ground: s.ground, taken: false })),
    platforms: def.platforms.map((p) => ({
      baseX: p.x,
      x: p.x,
      prevX: p.x,
      y: p.y,
      w: p.w,
      moving: p.kind === "move",
      range: p.range ?? 0,
      speed: p.speed ?? 0,
    })),
    junks: def.junks.map((j) => ({ x: j.x, speed: j.speed, alive: true })),
    springs: def.springs.map((s) => ({ x: s.x, squash: 0 })),
    beams: def.beams.map((b) => ({ x: b.x, w: b.w })),
    gaps: def.gaps,
    chaserX: def.chaserSpeed === null ? null : -320,
    time: 0,
    hearts: def.hearts,
    cleaned: 0,
    dirtTotal: dirtCount(def),
    sparklesTaken: 0,
    status: "playing",
    message: "",
    events: [],
  };
}

// ---------------------------------------------------------------------------
// 查询helper
// ---------------------------------------------------------------------------

/** 已清理比例(0..1);没有脏东西的关直接算 1 */
export function cleanRatio(w: World): number {
  return w.dirtTotal > 0 ? w.cleaned / w.dirtTotal : 1;
}

/** 净化门开了没有 */
export function doorOpen(w: World): boolean {
  return cleanRatio(w) >= w.def.requiredRatio - 1e-9;
}

/** 还差几处才能开门 */
export function remainingForDoor(w: World): number {
  const need = Math.ceil(w.dirtTotal * w.def.requiredRatio);
  return Math.max(0, need - w.cleaned);
}

/** 还没清掉的脏东西坐标(机器人与提示箭头都用它) */
export function dirtSpots(w: World): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (const m of w.monsters) if (!m.clean) out.push({ x: m.x, y: -MONSTER_H / 2 });
  for (const s of w.stains) if (!s.clean) out.push({ x: s.x, y: -6 });
  for (const s of w.sludges) if (!s.clean) out.push({ x: s.x + s.w / 2, y: -6 });
  return out;
}

function playerHeight(p: PlayerState): number {
  return p.crouch ? CROUCH_H : PLAYER_H;
}

/** 角色碰撞盒 */
export function playerBox(p: PlayerState): { x0: number; x1: number; y0: number; y1: number } {
  const h = playerHeight(p);
  return { x0: p.x - PLAYER_W / 2, x1: p.x + PLAYER_W / 2, y0: p.y - h, y1: p.y };
}

function overlaps(
  a: { x0: number; x1: number; y0: number; y1: number },
  b: { x0: number; x1: number; y0: number; y1: number }
): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/** 站着会不会顶到管道(蹲着钻管道时按不了「起立」) */
export function canStand(w: World, p: PlayerState): boolean {
  const box = { x0: p.x - PLAYER_W / 2, x1: p.x + PLAYER_W / 2, y0: p.y - PLAYER_H, y1: p.y };
  return !w.beams.some((b) =>
    overlaps(box, { x0: b.x, x1: b.x + b.w, y0: BEAM_TOP, y1: BEAM_BOTTOM })
  );
}

/**
 * 从 x 往回找一块「站得稳」的地面:不光脚下是实心的,前后各留半个身位,
 * 免得摔下去以后被放回断口边缘,一动就又掉下去。
 */
export function safeGroundX(def: LevelDef, x: number): number {
  const roomy = (probe: number): boolean =>
    groundSolidAt(def, probe) &&
    groundSolidAt(def, Math.max(24, probe - 52)) &&
    groundSolidAt(def, Math.min(def.len - 24, probe + 26));
  const from = Math.min(Math.max(24, x), def.len - 24);
  for (let probe = from; probe > 24; probe -= 6) {
    if (roomy(probe)) return probe;
  }
  for (let probe = from; probe < def.len - 24; probe += 6) {
    if (roomy(probe)) return probe;
  }
  return 40;
}

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
// 清理与受伤
// ---------------------------------------------------------------------------

function cleanMonster(w: World, m: MonsterState, by: PlayerState): void {
  if (m.clean) return;
  m.clean = true;
  m.bloom = 0.6;
  w.cleaned++;
  by.cleaned++;
  pushEvent(w, "flower", m.x, -MONSTER_H, by.index);
}

function cleanStain(w: World, s: StainState, by: PlayerState): void {
  if (s.clean) return;
  s.clean = true;
  s.bloom = 0.5;
  w.cleaned++;
  by.cleaned++;
  pushEvent(w, "wipe", s.x, -10, by.index);
}

function cleanSludge(w: World, s: SludgeState, by: PlayerState): void {
  if (s.clean) return;
  s.clean = true;
  s.bloom = 0.5;
  w.cleaned++;
  by.cleaned++;
  pushEvent(w, "wipe", s.x + s.w / 2, -10, by.index);
}

function hurt(w: World, p: PlayerState, fromX: number, why: string): void {
  if (p.invuln > 0 || w.status !== "playing") return;
  p.invuln = HURT_INVULN;
  p.hurtFlash = 0.5;
  w.hearts--;
  const away: 1 | -1 = p.x >= fromX ? 1 : -1;
  p.vx = away * 190;
  p.vy = -240;
  p.onGround = false;
  pushEvent(w, "hurt", p.x, p.y - 20, p.index);
  if (w.hearts <= 0) {
    w.status = "lost";
    w.message = why;
    pushEvent(w, "lose", p.x, p.y);
  }
}

// ---------------------------------------------------------------------------
// 单步推进
// ---------------------------------------------------------------------------

function stepPlatforms(w: World, dt: number): void {
  for (const pl of w.platforms) {
    pl.prevX = pl.x;
    if (!pl.moving || pl.range <= 0) continue;
    const omega = pl.speed / Math.max(20, pl.range);
    pl.x = pl.baseX + Math.sin(w.time * omega) * pl.range;
  }
}

function stepMonsters(w: World, dt: number): void {
  for (const m of w.monsters) {
    if (m.bloom > 0) m.bloom = Math.max(0, m.bloom - dt);
    if (m.clean) continue;
    m.x += m.dir * m.speed * dt;
    if (m.x <= m.minX) {
      m.x = m.minX;
      m.dir = 1;
    } else if (m.x >= m.maxX) {
      m.x = m.maxX;
      m.dir = -1;
    }
  }
}

function stepJunks(w: World, dt: number): void {
  const leftMost = Math.min(...w.players.map((p) => p.x));
  for (const j of w.junks) {
    if (!j.alive) continue;
    j.x -= j.speed * dt;
    if (j.x < leftMost - 700 || j.x < -200) j.alive = false;
  }
}

function applyHorizontal(w: World, p: PlayerState, input: Input, dt: number): void {
  const def = w.def;
  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;
  if (dir !== 0) p.facing = dir > 0 ? 1 : -1;

  if (p.dashT > 0) {
    p.vx = p.facing * DASH_SPEED;
  } else {
    let target = (p.crouch ? CROUCH_SPEED : MOVE_SPEED) * dir;
    // 泥洼里跑不快
    for (const s of w.sludges) {
      if (!s.clean && p.y > -12 && p.x > s.x - 10 && p.x < s.x + s.w + 10) {
        target *= SLUDGE_SLOW;
        break;
      }
    }
    if (def.slippery && p.onGround) {
      // 滑地板:速度慢慢逼近目标值,松手还会往前溜一会儿
      p.vx += (target - p.vx) * Math.min(1, SLIP_FRICTION * dt);
    } else if (p.onGround) {
      p.vx = target;
    } else {
      // 空中给一点点操控余地
      p.vx += (target - p.vx) * Math.min(1, 6 * dt);
    }
  }

  p.x += p.vx * dt;
  if (p.x < 16) {
    p.x = 16;
    p.vx = 0;
  }
  if (p.x > def.len - 16) {
    p.x = def.len - 16;
    p.vx = 0;
  }
}

function resolveBeams(w: World, p: PlayerState): void {
  const box = playerBox(p);
  for (const b of w.beams) {
    const beam = { x0: b.x, x1: b.x + b.w, y0: BEAM_TOP, y1: BEAM_BOTTOM };
    if (!overlaps(box, beam)) continue;
    const penLeft = box.x1 - beam.x0;
    const penRight = beam.x1 - box.x0;
    const penTop = box.y1 - beam.y0;
    const penBottom = beam.y1 - box.y0;
    const minPen = Math.min(penLeft, penRight, penTop, penBottom);
    if (minPen === penTop && p.vy >= 0) {
      // 从上面落到管道顶上
      p.y = beam.y0;
      p.vy = 0;
      p.onGround = true;
    } else if (minPen === penBottom) {
      p.y = beam.y1 + playerHeight(p);
      if (p.vy < 0) p.vy = 0;
    } else if (minPen === penLeft) {
      p.x = beam.x0 - PLAYER_W / 2 - 0.5;
      p.vx = 0;
      p.dashT = 0;
    } else {
      p.x = beam.x1 + PLAYER_W / 2 + 0.5;
      p.vx = 0;
      p.dashT = 0;
    }
    box.x0 = p.x - PLAYER_W / 2;
    box.x1 = p.x + PLAYER_W / 2;
    box.y0 = p.y - playerHeight(p);
    box.y1 = p.y;
  }
}

function applyVertical(w: World, p: PlayerState, dt: number): void {
  const def = w.def;
  const prevFeet = p.y;
  p.vy += GRAVITY * dt;
  p.y += p.vy * dt;
  p.onGround = false;
  p.ridingPlatform = -1;

  // 空中平台(单向:只有从上往下落才踩得住)
  for (let i = 0; i < w.platforms.length; i++) {
    const pl = w.platforms[i];
    if (p.vy < 0 || p.dropT > 0) continue;
    const within = p.x > pl.x - PLAYER_W * 0.35 && p.x < pl.x + pl.w + PLAYER_W * 0.35;
    if (!within) continue;
    if (prevFeet <= pl.y + 6 && p.y >= pl.y) {
      p.y = pl.y;
      p.vy = 0;
      p.onGround = true;
      p.ridingPlatform = i;
      p.x += pl.x - pl.prevX;
    }
  }

  // 地面:只有「上一刻还在地面之上」才踩得住,
  // 否则掉进断口以后会被对面的地面从下面接住,像是穿墙一样弹上来
  if (!p.onGround && p.vy >= 0 && prevFeet <= 0.01 && p.y >= 0 && groundSolidAt(def, p.x)) {
    p.y = 0;
    p.vy = 0;
    p.onGround = true;
  }

  if (p.y > FALL_LIMIT) {
    const back = safeGroundX(def, p.x - 30);
    hurt(w, p, p.x, "摔了一跤,晕乎乎的。歇一会儿,我们从头再来一遍!");
    p.x = back;
    p.y = -50;
    p.vy = 0;
    p.vx = 0;
  }
}

function applyActions(w: World, p: PlayerState, input: Input, dt: number): void {
  // 蹲:管道下面不许起立
  const wantCrouch = input.down && p.onGround;
  if (wantCrouch) p.crouch = true;
  else if (p.crouch && canStand(w, p)) p.crouch = false;

  if (p.dashT > 0) p.dashT = Math.max(0, p.dashT - dt);
  if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
  if (p.sweepT > 0) p.sweepT = Math.max(0, p.sweepT - dt);
  if (p.sweepCd > 0) p.sweepCd = Math.max(0, p.sweepCd - dt);
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  if (p.hurtFlash > 0) p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  if (p.dropT > 0) p.dropT = Math.max(0, p.dropT - dt);

  if (input.up && !p.prevUp && p.onGround) {
    if (p.crouch && p.ridingPlatform >= 0) {
      // 蹲着按跳:从浮台上穿下去(想回地面清脏东西的时候用得上)
      p.onGround = false;
      p.ridingPlatform = -1;
      p.dropT = 0.3;
      p.y += 6;
      p.vy = 60;
    } else if (!p.crouch) {
      // 跳(按下的那一下才起跳,按住不会一直弹)
      p.vy = -JUMP_V;
      p.onGround = false;
      pushEvent(w, "jump", p.x, p.y, p.index);
    }
  }
  p.prevUp = input.up;

  if (input.act && p.dashT <= 0 && p.dashCd <= 0) {
    p.dashT = DASH_TIME;
    p.dashCd = DASH_COOLDOWN;
    pushEvent(w, "dash", p.x, p.y - 20, p.index);
  }
  if (input.sub && p.sweepT <= 0 && p.sweepCd <= 0) {
    p.sweepT = SWEEP_TIME;
    p.sweepCd = SWEEP_COOLDOWN;
    pushEvent(w, "sweep", p.x + p.facing * 26, p.y - 16, p.index);
  }
}

/** 冲刺 / 扫一扫时的清洁范围 */
function cleanBox(p: PlayerState): { x0: number; x1: number; y0: number; y1: number } | null {
  if (p.dashT > 0) {
    const b = playerBox(p);
    return { x0: b.x0 - 8, x1: b.x1 + 8, y0: b.y0, y1: b.y1 + 6 };
  }
  if (p.sweepT > 0) {
    const front = p.x + p.facing * (PLAYER_W / 2 + SWEEP_RANGE / 2);
    return {
      x0: front - SWEEP_RANGE / 2,
      x1: front + SWEEP_RANGE / 2,
      y0: p.y - PLAYER_H,
      y1: p.y + 8,
    };
  }
  return null;
}

function interactions(w: World, p: PlayerState, dt: number): void {
  const box = playerBox(p);
  const brush = cleanBox(p);

  // 香香星
  for (const s of w.sparkles) {
    if (s.taken) continue;
    if (Math.abs(s.x - p.x) < 28 && s.y > box.y0 - 22 && s.y < box.y1 + 18) {
      s.taken = true;
      w.sparklesTaken++;
      p.sparkles++;
      pushEvent(w, "sparkle", s.x, s.y, p.index);
    }
  }

  // 弹簧蘑菇
  for (const sp of w.springs) {
    if (sp.squash > 0) sp.squash = Math.max(0, sp.squash - dt);
    if (p.onGround && p.y > -4 && Math.abs(sp.x - p.x) < 28) {
      p.vy = -SPRING_V;
      p.onGround = false;
      sp.squash = 0.3;
      pushEvent(w, "spring", sp.x, -10, p.index);
    }
  }

  // 污渍 / 泥洼:冲刺或扫一扫擦掉
  if (brush) {
    for (const s of w.stains) {
      if (s.clean) continue;
      if (overlaps(brush, { x0: s.x - 18, x1: s.x + 18, y0: -14, y1: 2 })) cleanStain(w, s, p);
    }
    for (const s of w.sludges) {
      if (s.clean) continue;
      if (overlaps(brush, { x0: s.x, x1: s.x + s.w, y0: -12, y1: 2 })) cleanSludge(w, s, p);
    }
  }

  // 臭臭怪:冲刺扫到 / 扫帚扫到 / 从上面踩到,都变成小花
  for (const m of w.monsters) {
    const mbox = { x0: m.x - MONSTER_W / 2, x1: m.x + MONSTER_W / 2, y0: -MONSTER_H, y1: 0 };
    if (m.clean) continue;
    if (brush && overlaps(brush, mbox)) {
      cleanMonster(w, m, p);
      continue;
    }
    if (!overlaps(box, mbox)) continue;
    if (p.vy > 40 && box.y1 - p.vy * dt <= -MONSTER_H * 0.45) {
      cleanMonster(w, m, p);
      p.vy = -STOMP_BOUNCE;
      p.onGround = false;
    } else {
      hurt(w, p, m.x, "臭臭怪太皮啦!别灰心,我们换个节奏再来一次。");
    }
  }

  // 滚过来的废纸团
  for (const j of w.junks) {
    if (!j.alive) continue;
    const jbox = { x0: j.x - JUNK_R, x1: j.x + JUNK_R, y0: -JUNK_R * 2, y1: 0 };
    if (!overlaps(box, jbox)) continue;
    if (p.dashT > 0) {
      j.alive = false;
      pushEvent(w, "smash", j.x, -JUNK_R, p.index);
    } else {
      j.alive = false;
      hurt(w, p, j.x, "被废纸团撞了个趔趄!下次早一点跳起来。");
    }
  }
}

function stepChaser(w: World, dt: number): void {
  if (w.chaserX === null || w.def.chaserSpeed === null) return;
  const lead = Math.max(...w.players.map((p) => p.x));
  w.chaserX += w.def.chaserSpeed * dt;
  // 别让臭味潮掉得太远,不然追逐段就没紧张感了
  w.chaserX = Math.max(w.chaserX, lead - 900);
  for (const p of w.players) {
    if (p.x < w.chaserX) {
      hurt(w, p, w.chaserX, "臭味潮追上来啦!下次别停太久,一路向前冲。");
      p.x = w.chaserX + 110;
      p.y = Math.min(p.y, -20);
    }
  }
}

function checkGoal(w: World): void {
  if (w.status !== "playing") return;
  const def = w.def;
  if (!doorOpen(w)) return;
  const atDoor = w.players.filter((p) => Math.abs(p.x - def.goalX) < 62 && p.y > -160);
  const need = def.goalNeedsAll ? w.players.length : 1;
  if (atDoor.length >= need) {
    w.status = "won";
    w.message = "";
    pushEvent(w, "win", def.goalX, -40);
  }
}

function stepOnce(w: World, dt: number, inputs: Input[]): void {
  if (w.status !== "playing") return;
  w.time += dt;
  stepPlatforms(w, dt);
  stepMonsters(w, dt);
  stepJunks(w, dt);

  for (let i = 0; i < w.players.length; i++) {
    const p = w.players[i];
    const input = inputs[i] ?? emptyInput();
    applyActions(w, p, input, dt);
    applyHorizontal(w, p, input, dt);
    applyVertical(w, p, dt);
    resolveBeams(w, p);
    interactions(w, p, dt);
    if (w.status !== "playing") return;
  }

  for (const s of w.stains) if (s.bloom > 0) s.bloom = Math.max(0, s.bloom - dt);
  for (const s of w.sludges) if (s.bloom > 0) s.bloom = Math.max(0, s.bloom - dt);

  stepChaser(w, dt);
  if (w.status !== "playing") return;

  if (w.def.timeLimit > 0 && w.time > w.def.timeLimit) {
    w.status = "lost";
    w.message = "时间到啦!这段路有点长,下次先挑近的脏东西清。";
    pushEvent(w, "lose", w.players[0].x, w.players[0].y);
    return;
  }
  checkGoal(w);
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
// 结算
// ---------------------------------------------------------------------------

export interface RunSummary {
  win: boolean;
  cleanPct: number;
  cleaned: number;
  dirtTotal: number;
  sparkles: number;
  time: number;
  hearts: number;
}

export function summarize(w: World): RunSummary {
  return {
    win: w.status === "won",
    cleanPct: Math.round(cleanRatio(w) * 100),
    cleaned: w.cleaned,
    dirtTotal: w.dirtTotal,
    sparkles: w.sparklesTaken,
    time: w.time,
    hearts: w.hearts,
  };
}

/** 三条三星标准分别达成了没有:清洁度 / 用时 / 香香星 */
export function starGoals(def: LevelDef, r: RunSummary): { clean: boolean; time: boolean; sparkle: boolean } {
  return {
    clean: r.dirtTotal === 0 || r.cleaned >= r.dirtTotal,
    time: r.time <= def.parSeconds,
    sparkle: r.sparkles >= def.sparkleGoal,
  };
}

/** 三条都达成 3 星,两条 2 星,其余 1 星 */
export function starsForRun(def: LevelDef, r: RunSummary): 1 | 2 | 3 {
  const g = starGoals(def, r);
  const met = (g.clean ? 1 : 0) + (g.time ? 1 : 0) + (g.sparkle ? 1 : 0);
  if (met >= 3) return 3;
  if (met === 2) return 2;
  return 1;
}

/** 过关时给孩子看的一句夸奖(只夸做到的部分,没做到的说成「下次可以试试」) */
export function winMessage(def: LevelDef, r: RunSummary): string {
  const g = starGoals(def, r);
  const done: string[] = [];
  const next: string[] = [];
  if (g.clean) done.push("整条路清得干干净净");
  else next.push(`还剩 ${r.dirtTotal - r.cleaned} 处没清完`);
  if (g.time) done.push(`只用了 ${Math.round(r.time)} 秒`);
  else next.push(`用时 ${Math.round(r.time)} 秒,标准是 ${def.parSeconds} 秒`);
  if (g.sparkle) done.push(`香香星收了 ${r.sparkles} 颗`);
  else next.push(`香香星差 ${Math.max(0, def.sparkleGoal - r.sparkles)} 颗`);
  const head = done.length ? `${done.join("、")},真棒!` : "顺利通过啦!";
  return next.length ? `${head}下次试试:${next.join(";")}。` : head;
}

/** 无尽模式的清洁分:清掉的脏东西、香香星和跑过的距离各算一点 */
export function endlessScore(cleaned: number, sparkles: number, meters: number): number {
  return cleaned * 10 + sparkles * 5 + Math.floor(Math.max(0, meters) / 4);
}

/** 无尽模式跑了多少米(1 米 = 20 像素,给孩子一个好读的数) */
export function metersOf(pixels: number): number {
  return Math.max(0, Math.floor(pixels / 20));
}

// ---------------------------------------------------------------------------
// 会自己通关的小机器人(测试用,也给「看一遍怎么打」的演示留了口子)
// ---------------------------------------------------------------------------

function beamBlocksAhead(w: World, p: PlayerState, dir: number): boolean {
  if (p.y < -20) return false;
  const probeFront = p.x + dir * 52;
  const x0 = Math.min(p.x - PLAYER_W / 2, probeFront - PLAYER_W / 2);
  const x1 = Math.max(p.x + PLAYER_W / 2, probeFront + PLAYER_W / 2);
  return w.beams.some((b) => x1 > b.x && x0 < b.x + b.w);
}

/** 面朝方向 range 之内还有没有没清掉的臭臭怪 */
function monsterAhead(w: World, p: PlayerState, face: number, range: number): boolean {
  return w.monsters.some((m) => {
    if (m.clean) return false;
    const rel = (m.x - p.x) * face;
    return rel > -26 && rel < range && p.y > -70;
  });
}

/** 机器人这一帧要按什么键 */
export function botInput(w: World, playerIndex = 0): Input {
  const input = emptyInput();
  const p = w.players[playerIndex];
  if (!p || w.status !== "playing") return input;
  const def = w.def;

  // 目标:门还没开就去清最近的脏东西,开了就直奔净化门
  let targetX = def.goalX;
  let targetY = 0;
  let targetIsDirt = false;
  if (!doorOpen(w)) {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const spot of dirtSpots(w)) {
      const d = Math.abs(spot.x - p.x);
      if (d < bestD) {
        bestD = d;
        best = spot;
      }
    }
    if (best) {
      targetX = best.x;
      targetY = best.y;
      targetIsDirt = true;
    }
  }

  const dx = targetX - p.x;
  const dir = dx > 10 ? 1 : dx < -10 ? -1 : 0;
  input.right = dir > 0;
  input.left = dir < 0;
  const face = dir !== 0 ? dir : p.facing;

  // 站在浮台上而目标在下面的地面:蹲着跳穿下去
  if (p.onGround && p.ridingPlatform >= 0 && targetY - p.y > 40) {
    input.down = true;
    input.up = true;
    return input;
  }

  // 管道:蹲下来钻
  if (beamBlocksAhead(w, p, face)) {
    input.down = true;
    input.up = false;
  } else {
    // 断口:提前起跳
    const gapAhead =
      dir !== 0 && groundSolidAt(def, p.x) && !groundSolidAt(def, p.x + face * 54) && p.y > -8;
    // 迎面滚来的废纸团(它比人跑得还快,得早一点起跳)
    const junkNear = w.junks.some((j) => j.alive && j.x - p.x > -40 && j.x - p.x < 175);
    // 前面有臭臭怪,冲刺还在冷却,就跳上去踩
    const stompable = monsterAhead(w, p, face, 78) && p.dashCd > 0.05;
    if (p.onGround && (gapAhead || junkNear || stompable)) {
      input.up = true;
      // 为了躲废纸团起跳,但落点正好在断口上:原地跳,让它从脚底下滚过去
      if (!gapAhead && !groundSolidAt(def, p.x + face * jumpRange())) {
        input.left = false;
        input.right = false;
      }
    }
  }

  // 冲刺清扫:目标就在前面一点点、或者迎面撞上臭臭怪的时候放
  const wantDash = (targetIsDirt && Math.abs(dx) < 150) || monsterAhead(w, p, face, 130);
  if (wantDash && p.dashCd <= 0) input.act = true;
  if (targetIsDirt && Math.abs(dx) < 70) input.sub = true;

  return input;
}

export interface AutoPlayResult extends RunSummary {
  lost: boolean;
  steps: number;
  timedOut: boolean;
}

/** 让机器人把这个世界玩到底(测试里用来验「真的能通关」) */
export function autoPlay(w: World, opts: { dt?: number; maxSeconds?: number } = {}): AutoPlayResult {
  const dt = opts.dt ?? 1 / 60;
  const maxSeconds = opts.maxSeconds ?? 180;
  let steps = 0;
  const limit = Math.ceil(maxSeconds / dt);
  while (w.status === "playing" && steps < limit) {
    const inputs = w.players.map((_, i) => botInput(w, i));
    stepWorld(w, dt, inputs);
    steps++;
  }
  const summary = summarize(w);
  return {
    ...summary,
    lost: w.status === "lost",
    steps,
    timedOut: w.status === "playing",
  };
}
