// 保龄球小馆 · 球道物理(纯函数,不碰 DOM、不用随机数)。
//
// 简化成二维刚体:球和瓶都是圆,碰撞按动量守恒解,瓶被推离原位超过一段距离
// 就算倒了——倒下的瓶还会继续滑,所以「一瓶撞一瓶」的连锁是真的算出来的,
// 不是查表硬凑的。同一次投球(力度 + 落点 + 旋转)每次跑出来的结果完全一样,
// 所以画面上看到的那一次滚瓶,和单测里跑的是同一套代码。
//
// 坐标:x 是球道左右(0 = 左沟边,LANE_W = 右沟边),y 是往前推进的距离,
// 球从 y = 0 出手,瓶阵摆在 y = HEAD_Y 往后。

import { PINS } from "./scoring";

// ---------------------------------------------------------------------------
// 尺寸与手感常数
// ---------------------------------------------------------------------------

/** 球道宽度 */
export const LANE_W = 42;
/** 头瓶所在的距离 */
export const HEAD_Y = 62;
/** 瓶阵每一排之间的前后距离(正三角形排布) */
export const ROW_GAP = 10.4;
/** 同一排相邻两瓶的左右距离 */
export const PIN_GAP = 12;
/** 瓶台的尽头:滚过这里的瓶就掉下去了 */
export const DECK_END = HEAD_Y + ROW_GAP * 3 + 16;
/** 球的半径 */
export const BALL_R = 4.3;
/** 瓶的半径 */
export const PIN_R = 2.4;
/** 球的重量(比瓶重得多,所以撞完基本不改道) */
export const BALL_MASS = 12;
/** 离原位超过这么远就算这一瓶倒了 */
export const TOPPLE = 2.4;
/** 最慢 / 最快的出手速度 */
export const SPEED_MIN = 52;
export const SPEED_MAX = 104;
/** 旋转带来的侧向加速度上限 */
export const HOOK = 46;
/** 每秒保留的速度比例:球几乎不减速,瓶滑一小段就停 */
export const BALL_KEEP = 0.92;
export const PIN_KEEP = 0.3;
/** 碰撞弹性 */
export const BOUNCE = 0.7;
/** 一次投球最多算这么久,防止极端参数下算不完 */
export const SHOT_CAP_MS = 6000;
/** 球心越过这条线就掉进球沟了 */
export const GUTTER_EDGE = 3.4;
/** 护栏的弹性:撞上去弹回来,但速度会掉一截 */
export const BUMPER_BOUNCE = 0.55;

export function hypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 每秒保留 keep 的比例,换算成 dt 毫秒的衰减系数 */
export function dampFactor(keep: number, dtMs: number): number {
  return Math.pow(clamp(keep, 0.0001, 1), dtMs / 1000);
}

// ---------------------------------------------------------------------------
// 瓶
// ---------------------------------------------------------------------------

/** 瓶的种类:闯关后面几章会混进特殊瓶 */
export type PinKind = "wood" | "iron" | "ice" | "spring" | "balloon";

export interface PinTrait {
  name: string;
  emoji: string;
  /** 重量倍率 */
  mass: number;
  /** 每秒保留的速度比例(冰瓶特别滑) */
  keep: number;
  /** 弹性倍率(弹簧瓶撞人特别狠) */
  bounce: number;
  /** 要被推开多远才算倒(铁瓶站得稳) */
  topple: number;
  line: string;
}

export const PIN_TRAITS: Record<PinKind, PinTrait> = {
  wood: { name: "木瓶", emoji: "🎳", mass: 1.5, keep: PIN_KEEP, bounce: 1, topple: TOPPLE, line: "最普通的一种,推一下就倒。" },
  iron: { name: "铁瓶", emoji: "⚙️", mass: 4.2, keep: 0.12, bounce: 0.9, topple: TOPPLE * 1.5, line: "又重又稳,得正面撞实才推得动。" },
  ice: { name: "冰瓶", emoji: "🧊", mass: 1.2, keep: 0.72, bounce: 1.05, topple: TOPPLE, line: "一撞就滑出去很远,顺手把旁边的也带倒。" },
  spring: { name: "弹簧瓶", emoji: "🪀", mass: 1.4, keep: 0.3, bounce: 1.45, topple: TOPPLE, line: "弹性特别好,撞到别的瓶时力气翻倍。" },
  balloon: { name: "气球瓶", emoji: "🎈", mass: 0.7, keep: 0.55, bounce: 1.1, topple: TOPPLE * 0.8, line: "特别轻,擦一下就飞出去了。" },
};

export interface Pin {
  /** 0..9,就是保龄球里的 1..10 号瓶减一 */
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  r: number;
  mass: number;
  kind: PinKind;
  /** 已经被推离原位,算倒了 */
  down: boolean;
  /** 这一球开始前就不在场上(上一球已经打倒) */
  gone: boolean;
}

/**
 * 标准十瓶的摆位(0 基,对应 1..10 号瓶):
 *
 * ```
 *  7  8  9  10
 *    4  5  6
 *      2  3
 *        1
 * ```
 */
export function pinSpot(id: number): { x: number; y: number } {
  const cx = LANE_W / 2;
  const i = clamp(Math.round(id), 0, PINS - 1);
  const row = i === 0 ? 0 : i <= 2 ? 1 : i <= 5 ? 2 : 3;
  const inRow = i === 0 ? 0 : i <= 2 ? i - 1 : i <= 5 ? i - 3 : i - 6;
  const count = row + 1;
  const x = cx + (inRow - (count - 1) / 2) * PIN_GAP;
  return { x, y: HEAD_Y + row * ROW_GAP };
}

export function makePin(id: number, kind: PinKind = "wood"): Pin {
  const spot = pinSpot(id);
  const trait = PIN_TRAITS[kind];
  return {
    id,
    x: spot.x,
    y: spot.y,
    vx: 0,
    vy: 0,
    homeX: spot.x,
    homeY: spot.y,
    r: PIN_R,
    mass: trait.mass,
    kind,
    down: false,
    gone: false,
  };
}

/** 这一架瓶怎么摆:standing 决定哪几瓶还在场上,kinds 决定它们是什么瓶 */
export interface Rack {
  /** 长度 10,true = 这一瓶还站着 */
  standing: boolean[];
  /** 长度 10 的瓶种;不给就全是木瓶 */
  kinds?: PinKind[];
  /** 打油量 0..1:油越多球越难拐弯 */
  oil?: number;
  /** 球沟上架了护栏:球撞上去会被弹回球道,不会洗沟(教学关用) */
  bumpers?: boolean;
  /** 瓶阵横向来回挪的幅度(球道单位);0 = 老老实实站着 */
  drift?: number;
  /** 球沟宽度:无尽模式每十格加宽一次,球道就一格比一格窄 */
  gutter?: number;
}

export function fullRack(kinds?: PinKind[], oil = 0.4): Rack {
  return { standing: new Array<boolean>(PINS).fill(true), kinds, oil };
}

/**
 * 「分瓶」:只留几个瓶站着,别的先撤走。
 * 3-7 号分瓶这种经典难题就是这么摆出来的(参数是 1 基的瓶号)。
 */
export function splitRack(pins: readonly number[]): boolean[] {
  const standing = new Array<boolean>(PINS).fill(false);
  for (const n of pins) {
    const i = Math.round(n) - 1;
    if (i >= 0 && i < PINS) standing[i] = true;
  }
  return standing;
}

// ---------------------------------------------------------------------------
// 移动瓶
// ---------------------------------------------------------------------------

/** 瓶阵来回挪一趟要多少毫秒 */
export const DRIFT_MS = 2600;

/**
 * 移动瓶这一刻挪到哪儿(纯函数的三角波,-amp..amp)。
 * 球快撞上的时候瓶阵会定住——要的是「提前量」这个脑筋,不是手忙脚乱。
 */
export function driftOffset(amp: number, timeMs: number): number {
  if (amp <= 0) return 0;
  const t = ((timeMs % DRIFT_MS) + DRIFT_MS) % DRIFT_MS;
  const phase = t / DRIFT_MS;
  // 0 → +amp → 0 → -amp → 0
  return amp * Math.sin(phase * Math.PI * 2);
}

// ---------------------------------------------------------------------------
// 一次投球
// ---------------------------------------------------------------------------

/** 三段式操作的结果:力度 0..1、落点 -1..1(负数偏左)、旋转 -1..1(负数往左拐) */
export interface Shot {
  power: number;
  aim: number;
  spin: number;
}

export function cleanShot(shot: Shot): Shot {
  return {
    power: clamp(Number.isFinite(shot.power) ? shot.power : 0.5, 0, 1),
    aim: clamp(Number.isFinite(shot.aim) ? shot.aim : 0, -1, 1),
    spin: clamp(Number.isFinite(shot.spin) ? shot.spin : 0, -1, 1),
  };
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 侧向加速度(旋转拐弯用) */
  ax: number;
  r: number;
  mass: number;
  /** 掉进球沟了 */
  gutter: boolean;
  /** 已经滚过瓶台,退出这一球 */
  gone: boolean;
}

export type LaneEvent =
  | { kind: "hit"; pin: number; force: number }
  | { kind: "chain"; pin: number; other: number }
  | { kind: "gutter" }
  | { kind: "bumper" }
  | { kind: "down"; pin: number };

export interface LaneState {
  ball: Ball;
  pins: Pin[];
  oil: number;
  time: number;
  events: LaneEvent[];
  /** 这一球已经算完了 */
  settled: boolean;
  /** 球沟上有没有护栏 */
  bumpers: boolean;
  /** 瓶阵横移的幅度 */
  drift: number;
  /** 瓶阵当前已经横移了多少(stepLane 自己维护) */
  driftAt: number;
  /** 这条道的球沟有多宽 */
  gutter: number;
}

/** 落点换算成出手的横向位置 */
export function releaseX(aim: number, gutter = GUTTER_EDGE): number {
  const room = Math.max(1, LANE_W / 2 - gutter - BALL_R);
  return LANE_W / 2 + clamp(aim, -1, 1) * room;
}

/** 力度换算成出手速度 */
export function releaseSpeed(power: number): number {
  return SPEED_MIN + clamp(power, 0, 1) * (SPEED_MAX - SPEED_MIN);
}

/**
 * 旋转换算成侧向加速度:油越厚越拐不动,
 * 力度越大球越快、在道上待的时间越短,拐的幅度自然也小。
 */
export function hookAccel(spin: number, oil: number): number {
  return clamp(spin, -1, 1) * HOOK * (1 - clamp(oil, 0, 1) * 0.55);
}

export function createLane(rack: Rack, shot: Shot): LaneState {
  const s = cleanShot(shot);
  const oil = clamp(rack.oil ?? 0.4, 0, 1);
  const gutter = clamp(rack.gutter ?? GUTTER_EDGE, GUTTER_EDGE, LANE_W / 2 - BALL_R - 2);
  const pins: Pin[] = [];
  for (let i = 0; i < PINS; i++) {
    const pin = makePin(i, rack.kinds?.[i] ?? "wood");
    pin.gone = rack.standing[i] === false;
    pins.push(pin);
  }
  return {
    ball: {
      x: releaseX(s.aim, gutter),
      y: 0,
      vx: 0,
      vy: releaseSpeed(s.power),
      ax: hookAccel(s.spin, oil),
      r: BALL_R,
      mass: BALL_MASS,
      gutter: false,
      gone: false,
    },
    pins,
    oil,
    time: 0,
    events: [],
    settled: false,
    bumpers: rack.bumpers === true,
    drift: Math.max(0, rack.drift ?? 0),
    driftAt: 0,
    gutter,
  };
}

/** 这一瓶此刻还在场上(没被上一球打掉) */
export function pinInPlay(pin: Pin): boolean {
  return !pin.gone;
}

interface Circle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  inv: number;
}

/**
 * 两个圆的弹性碰撞:沿法线交换动量,切向不变。
 * 返回这一撞的冲击强度(法线方向的相对速度),0 表示两个圆正在分开、不用处理。
 * 这是纯函数式的经典公式,动量一定守恒——单测里直接断言这一条。
 */
export function resolveHit(a: Circle, b: Circle, bounce: number): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = hypot(dx, dy);
  if (dist === 0) return 0;
  const nx = dx / dist;
  const ny = dy / dist;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel >= 0) return 0;
  const invSum = a.inv + b.inv;
  if (invSum === 0) return 0;
  const j = (-(1 + bounce) * rel) / invSum;
  a.vx -= j * a.inv * nx;
  a.vy -= j * a.inv * ny;
  b.vx += j * b.inv * nx;
  b.vy += j * b.inv * ny;
  return -rel;
}

/** 把两个叠在一起的圆按质量比例分开,免得越陷越深 */
export function separate(a: Circle, b: Circle): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = hypot(dx, dy);
  const overlap = a.r + b.r - dist;
  if (overlap <= 0 || dist === 0) return;
  const invSum = a.inv + b.inv;
  if (invSum === 0) return;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * overlap * (a.inv / invSum);
  a.y -= ny * overlap * (a.inv / invSum);
  b.x += nx * overlap * (b.inv / invSum);
  b.y += ny * overlap * (b.inv / invSum);
}

function circleOfPin(pin: Pin): Circle {
  return { x: pin.x, y: pin.y, vx: pin.vx, vy: pin.vy, r: pin.r, inv: 1 / pin.mass };
}

function writePin(pin: Pin, c: Circle): void {
  pin.x = c.x;
  pin.y = c.y;
  pin.vx = c.vx;
  pin.vy = c.vy;
}

/** 这一瓶被推离原位多远 */
export function pinShift(pin: Pin): number {
  return hypot(pin.x - pin.homeX, pin.y - pin.homeY);
}

/** 瓶台两侧的挡板起点:飞出去的瓶撞上挡板会弹回瓶台 */
export const KICKBACK_Y = HEAD_Y - ROW_GAP;
/** 挡板与后墙的弹性 */
export const WALL_BOUNCE = 0.34;

/**
 * 瓶撞挡板:真实球馆的瓶台两侧和后面都有挡板,
 * 飞出去的瓶会被弹回来再撞倒别的瓶——角上那两瓶经常就是这么倒的。
 */
export function bounceOffDeck(pin: Pin, state: LaneState): void {
  if (pin.y < KICKBACK_Y) return;
  if (pin.x < pin.r) {
    pin.x = pin.r;
    if (pin.vx < 0) {
      pin.vx = -pin.vx * WALL_BOUNCE;
      state.events.push({ kind: "chain", pin: pin.id, other: -1 });
    }
  } else if (pin.x > LANE_W - pin.r) {
    pin.x = LANE_W - pin.r;
    if (pin.vx > 0) {
      pin.vx = -pin.vx * WALL_BOUNCE;
      state.events.push({ kind: "chain", pin: pin.id, other: -1 });
    }
  }
  if (pin.y > DECK_END && pin.vy > 0) {
    pin.y = DECK_END;
    pin.vy = -pin.vy * WALL_BOUNCE;
  }
}

/**
 * 推进一帧。dt 会被截到 8ms 以内:瓶飞得很快,步子迈大了会穿过彼此。
 * 纯粹按状态算,暂停 / 快进 / 单测重放的结果完全一致。
 */
export function stepLane(state: LaneState, dtMs: number): void {
  const dt = clamp(dtMs, 0, 8);
  if (dt === 0 || state.settled) return;
  const s = dt / 1000;
  state.time += dt;
  const ball = state.ball;

  // ---- 移动瓶:球还没到跟前的时候瓶阵一直在横着挪,快撞上了就定住 ----
  if (state.drift > 0) {
    const frozen = ball.gone || ball.y >= HEAD_Y - PIN_R * 3;
    const want = frozen ? state.driftAt : driftOffset(state.drift, state.time);
    const move = want - state.driftAt;
    if (move !== 0) {
      for (const pin of state.pins) {
        if (!pinInPlay(pin) || pin.down) continue;
        // 只挪还没被碰过的瓶:被撞飞的那几个自己滚自己的
        if (pinShift(pin) > 0.01) continue;
        pin.x += move;
        pin.homeX += move;
      }
      state.driftAt = want;
    }
  }

  // ---- 球 ----
  if (!ball.gone) {
    ball.vx += ball.ax * s;
    const k = dampFactor(BALL_KEEP, dt);
    ball.vx *= k;
    ball.vy *= k;
    ball.x += ball.vx * s;
    ball.y += ball.vy * s;
    const edge = state.gutter;
    if (state.bumpers) {
      // 护栏:球撞上去被弹回球道,永远洗不了沟(前两章的教学护栏就是这个)
      if (ball.x < edge + ball.r) {
        ball.x = edge + ball.r;
        if (ball.vx < 0) ball.vx = -ball.vx * BUMPER_BOUNCE;
        if (ball.ax < 0) ball.ax = -ball.ax;
        state.events.push({ kind: "bumper" });
      } else if (ball.x > LANE_W - edge - ball.r) {
        ball.x = LANE_W - edge - ball.r;
        if (ball.vx > 0) ball.vx = -ball.vx * BUMPER_BOUNCE;
        if (ball.ax > 0) ball.ax = -ball.ax;
        state.events.push({ kind: "bumper" });
      }
    } else if (!ball.gutter && (ball.x < edge || ball.x > LANE_W - edge)) {
      ball.gutter = true;
      ball.vx = 0;
      ball.ax = 0;
      state.events.push({ kind: "gutter" });
    }
    if (ball.y > DECK_END) ball.gone = true;
  }

  // ---- 球撞瓶 ----
  if (!ball.gone && !ball.gutter) {
    const bc: Circle = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, r: ball.r, inv: 1 / ball.mass };
    for (const pin of state.pins) {
      if (!pinInPlay(pin)) continue;
      const pc = circleOfPin(pin);
      if (hypot(pc.x - bc.x, pc.y - bc.y) > bc.r + pc.r) continue;
      const force = resolveHit(bc, pc, BOUNCE * PIN_TRAITS[pin.kind].bounce);
      separate(bc, pc);
      writePin(pin, pc);
      if (force > 0) state.events.push({ kind: "hit", pin: pin.id, force });
    }
    ball.x = bc.x;
    ball.y = bc.y;
    ball.vx = bc.vx;
    ball.vy = bc.vy;
  }

  // ---- 瓶撞瓶(连锁就是从这里来的) ----
  for (let i = 0; i < state.pins.length; i++) {
    const a = state.pins[i];
    if (!pinInPlay(a)) continue;
    for (let j = i + 1; j < state.pins.length; j++) {
      const b = state.pins[j];
      if (!pinInPlay(b)) continue;
      const ca = circleOfPin(a);
      const cb = circleOfPin(b);
      if (hypot(cb.x - ca.x, cb.y - ca.y) > ca.r + cb.r) continue;
      const bounce = BOUNCE * Math.max(PIN_TRAITS[a.kind].bounce, PIN_TRAITS[b.kind].bounce);
      const force = resolveHit(ca, cb, bounce);
      separate(ca, cb);
      writePin(a, ca);
      writePin(b, cb);
      if (force > 0.5) state.events.push({ kind: "chain", pin: a.id, other: b.id });
    }
  }

  // ---- 瓶自己滑 ----
  for (const pin of state.pins) {
    if (!pinInPlay(pin)) continue;
    const trait = PIN_TRAITS[pin.kind];
    const k = dampFactor(trait.keep, dt);
    pin.vx *= k;
    pin.vy *= k;
    pin.x += pin.vx * s;
    pin.y += pin.vy * s;
    bounceOffDeck(pin, state);
    if (!pin.down && pinShift(pin) >= trait.topple) {
      pin.down = true;
      state.events.push({ kind: "down", pin: pin.id });
    }
  }

  // ---- 这一球算完了没 ----
  if (ball.gone || (ball.gutter && ball.y > HEAD_Y + ROW_GAP * 3) || state.time >= SHOT_CAP_MS) {
    const moving = state.pins.some((p) => pinInPlay(p) && hypot(p.vx, p.vy) > 1.2);
    if (!moving || state.time >= SHOT_CAP_MS) state.settled = true;
  }
}

/** 这一球把哪几瓶打倒了(长度 10 的布尔数组) */
export function downFlags(state: LaneState): boolean[] {
  return state.pins.map((p) => pinInPlay(p) && p.down);
}

/** 这一球打倒了几瓶 */
export function downCount(state: LaneState): number {
  return downFlags(state).filter(Boolean).length;
}

/** 这一球之后还站着哪几瓶 */
export function standingAfter(state: LaneState): boolean[] {
  return state.pins.map((p) => pinInPlay(p) && !p.down);
}

export interface ShotResult {
  /** 长度 10:这一球倒了哪几瓶 */
  down: boolean[];
  count: number;
  /** 这一球之后还站着哪几瓶 */
  standing: boolean[];
  gutter: boolean;
  /** 算完这一球用了多少毫秒(球道时间,不是真实时间) */
  ms: number;
}

/**
 * 把一次投球从头算到尾:UI 里是一帧一帧放出来的,这里一口气算完,
 * 给单测和电脑对手用。同样的输入永远给同样的结果。
 */
export function simulateShot(rack: Rack, shot: Shot): ShotResult {
  const state = createLane(rack, shot);
  let guard = 0;
  while (!state.settled && guard < 4000) {
    stepLane(state, 8);
    guard++;
  }
  return {
    down: downFlags(state),
    count: downCount(state),
    standing: standingAfter(state),
    gutter: state.ball.gutter,
    ms: state.time,
  };
}

// ---------------------------------------------------------------------------
// 三段式操作:力度 → 落点 → 旋转,每一段都是来回跑的指针
// ---------------------------------------------------------------------------

export type Stage = "power" | "aim" | "spin" | "roll";

export const STAGE_LABEL: Record<Stage, string> = {
  power: "蓄力",
  aim: "落点",
  spin: "旋转",
  roll: "滚球中",
};

/** 每一段指针来回跑一趟要多少毫秒(越靠后越快,考手感) */
export const STAGE_MS: Record<Exclude<Stage, "roll">, number> = {
  power: 1500,
  aim: 1300,
  spin: 1100,
};

/**
 * 来回跑的指针:三角波,0 → 1 → 0。
 * 纯函数,所以「按下的那一刻停在哪」在单测里能精确算出来。
 */
export function sweep(elapsedMs: number, periodMs: number): number {
  const p = Math.max(1, periodMs);
  const t = ((elapsedMs % p) + p) % p;
  const half = p / 2;
  return t < half ? t / half : (p - t) / half;
}

/** 力度条:指针 0..1 直接就是力度 */
export function powerFromSweep(v: number): number {
  return clamp(v, 0, 1);
}

/** 落点条:0..1 映射到 -1..1 */
export function aimFromSweep(v: number): number {
  return clamp(v, 0, 1) * 2 - 1;
}

/** 旋转条:0..1 映射到 -1..1 */
export function spinFromSweep(v: number): number {
  return clamp(v, 0, 1) * 2 - 1;
}

/** 下一段是什么 */
export function nextStage(stage: Stage): Stage {
  if (stage === "power") return "aim";
  if (stage === "aim") return "spin";
  return "roll";
}

/**
 * 上一段是什么:三段里的**每一段在球出手之前都能反悔重来**。
 * 已经在滚球了就没得反悔——球都出手了,规矩就是规矩。
 */
export function prevStage(stage: Stage): Stage {
  if (stage === "spin") return "aim";
  if (stage === "aim") return "power";
  return "power";
}

/** 这一段还能不能反悔(第一段没有上一段,滚球中也来不及了) */
export function canUndo(stage: Stage): boolean {
  return stage === "aim" || stage === "spin";
}

// ---------------------------------------------------------------------------
// 口袋位教学
// ---------------------------------------------------------------------------

/**
 * 口袋:1 号瓶(头瓶)与 3 号瓶之间的那条缝。
 * 球从这儿切进去,头瓶会斜着撞倒 2 号、5 号,连锁一路铺开——全中基本都是这么来的。
 * 正对头瓶撞过去反而容易剩下两边的角瓶。
 */
export function pocketX(): number {
  return (pinSpot(0).x + pinSpot(2).x) / 2;
}

/** 左撇子的口袋(1 号瓶与 2 号瓶之间),画教学线时两条一起画 */
export function pocketLeftX(): number {
  return (pinSpot(0).x + pinSpot(1).x) / 2;
}

/**
 * 瞄准辅助线的浓淡:前两章常驻(实打实画出来),越往后越淡,第七章起彻底消失。
 *
 * **只给方向,不给答案**——线画的是「口袋在哪儿」,不是「这一球该用什么参数」,
 * 力度、旋转和落点还是得自己定。
 */
export function guideAlpha(chapter: number): number {
  const c = Math.max(0, Math.round(chapter));
  if (c <= 1) return 1;
  if (c >= 6) return 0;
  // 第三章 0.8,往后一章淡一档,到第七章正好归零
  return Math.max(0, 1 - (c - 1) * 0.2);
}

// ---------------------------------------------------------------------------
// 伪 2.5D 透视:碰撞永远在俯视坐标里算,透视只发生在渲染这一步
// ---------------------------------------------------------------------------

/** 球道从出手线到瓶台尽头的总长度 */
export const LANE_LEN = DECK_END + 4;
/** 最远端(瓶台)的宽度是近端的百分之多少 */
export const VIEW_FAR = 0.46;
/** 纵深压缩强度:越大,近处的一段占的屏幕越多 */
export const VIEW_PERSP = 0.9;

export interface LaneView {
  /** 画布宽 */
  w: number;
  /** 画布高 */
  h: number;
  /** 远端宽度比例;不传用 VIEW_FAR */
  far?: number;
  /** 纵深压缩;不传用 VIEW_PERSP */
  persp?: number;
}

/** 世界纵深 0..1 → 屏幕纵向 0..1(近处铺得开、远处挤在一起) */
export function depthAt(t: number, persp = VIEW_PERSP): number {
  const k = clamp(t, 0, 1);
  const p = Math.max(0, persp);
  return (k * (1 + p)) / (1 + p * k);
}

/** depthAt 的反函数:屏幕纵向 0..1 → 世界纵深 0..1 */
export function depthInv(u: number, persp = VIEW_PERSP): number {
  const k = clamp(u, 0, 1);
  const p = Math.max(0, persp);
  return k / (1 + p - p * k);
}

/** 这个纵深上的横向缩放:1 = 近端原宽,越远越小 */
export function widthScaleAt(t: number, far = VIEW_FAR): number {
  return 1 + (clamp(far, 0.05, 1) - 1) * clamp(t, 0, 1);
}

/**
 * 俯视坐标 (x = 球道左右, y = 往前推进) → 画布坐标。
 * k 是这一点的缩放倍率,球和瓶按它放大缩小,就有了「近大远小」。
 */
export function laneProject(x: number, y: number, view: LaneView): { sx: number; sy: number; k: number } {
  const t = clamp(y / LANE_LEN, 0, 1);
  const k = widthScaleAt(t, view.far);
  const perUnit = view.w / LANE_W;
  return {
    // 屏幕下方是出手线,上方是瓶台:纵深越大画得越高
    sx: view.w / 2 + (x - LANE_W / 2) * perUnit * k,
    sy: view.h * (1 - depthAt(t, view.persp)),
    k,
  };
}

/** laneProject 的反函数:点在画布上的位置 → 俯视坐标(触屏拖落点要用) */
export function laneUnproject(sx: number, sy: number, view: LaneView): { x: number; y: number } {
  const u = clamp(1 - sy / Math.max(1, view.h), 0, 1);
  const t = depthInv(u, view.persp);
  const k = widthScaleAt(t, view.far);
  const perUnit = view.w / LANE_W;
  return {
    x: LANE_W / 2 + (sx - view.w / 2) / Math.max(0.0001, perUnit * k),
    y: t * LANE_LEN,
  };
}

// ---------------------------------------------------------------------------
// 电脑对手:按「想要的落点」倒推一次投球
// ---------------------------------------------------------------------------

export type AiLevel = 1 | 2 | 3;

export const AI_LABEL: Record<AiLevel, string> = {
  1: "新手球童",
  2: "熟练球手",
  3: "冠军球手",
};

/** 三档电脑的手抖幅度(高斯噪声的标准差):越低档抖得越厉害 */
export const AI_WOBBLE: Record<AiLevel, number> = { 1: 0.34, 2: 0.16, 3: 0.05 };

/** 确定性伪噪声:同一个回合号永远抖出同一个值,落在 -1..1 */
export function wobble(seedA: number, seedB: number): number {
  const t = Math.sin(seedA * 12.9898 + seedB * 78.233) * 43758.5453;
  return (t - Math.floor(t)) * 2 - 1;
}

/**
 * 确定性的高斯噪声(Box–Muller):真人手抖是「大多数时候差一点点,偶尔差很多」,
 * 均匀噪声做不出这个味道——所以落点和旋转的抖动走这一条,标准差就是档位的 `AI_WOBBLE`。
 *
 * 结果被夹在 ±3 个标准差以内:再倒霉的一球也不会离谱到直接扔进隔壁球道。
 */
export function gaussNoise(seedA: number, seedB: number): number {
  // wobble 落在 -1..1,先搬回 (0,1) 当均匀分布用
  const u1 = Math.min(0.999999, Math.max(1e-6, (wobble(seedA, seedB) + 1) / 2));
  const u2 = (wobble(seedA + 101, seedB + 7) + 1) / 2;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return clamp(z, -3, 3);
}

/** 落点条的可用行程:把球道上的横坐标换算回 -1..1 的落点值 */
export function aimForX(x: number): number {
  return clamp((x - LANE_W / 2) / (LANE_W / 2 - GUTTER_EDGE - BALL_R), -1, 1);
}

/** 满架时的「口袋」:头瓶偏右那一条缝,正面撞头瓶反而容易留下两边的角瓶 */
export const POCKET_AIM = 0.2;

/**
 * 补中该往哪儿投。
 *
 * 不能直接瞄剩下几瓶的**重心**——分瓶的时候重心正好落在两瓶中间那片空气上,
 * 球从缝里穿过去一个都碰不到。所以先找出离重心最近的那一瓶,球必须实打实
 * 砸在它身上;再朝重心那边偏一点点(不超过半个瓶距),让它倒下时往同伴那边滚,
 * 连锁才有机会补上另一边。
 */
export function spareAimX(standing: readonly boolean[]): number {
  const xs: number[] = [];
  for (let i = 0; i < PINS; i++) {
    if (standing[i]) xs.push(pinSpot(i).x);
  }
  if (xs.length === 0) return LANE_W / 2;
  const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
  let best = xs[0];
  for (const x of xs) {
    if (Math.abs(x - mid) < Math.abs(best - mid)) best = x;
  }
  const lean = clamp(mid - best, -PIN_GAP / 2, PIN_GAP / 2);
  return best + lean * 0.35;
}

/**
 * 电脑这一球怎么投:满架瞄口袋,补中瞄「够得着的那一瓶」,档位越高抖得越小。
 * 纯函数,给定同样的场面与回合号一定投出同样的球。
 */
export function aiShot(standing: readonly boolean[], skill: AiLevel, turn: number): Shot {
  let n = 0;
  for (let i = 0; i < PINS; i++) {
    if (standing[i]) n++;
  }
  const full = n >= PINS;
  const want = full ? POCKET_AIM : aimForX(spareAimX(standing));
  // 落点与旋转的手抖走高斯:大多数球只差一点点,偶尔来一发离谱的
  const shake = AI_WOBBLE[skill];
  const aim = clamp(want + gaussNoise(turn, skill) * shake, -1, 1);
  const power = clamp(0.7 + gaussNoise(turn + 11, skill) * shake * 0.5, 0.25, 1);
  const spin = clamp(gaussNoise(turn + 23, skill) * shake * 0.8, -1, 1);
  return { power, aim, spin };
}

// ---------------------------------------------------------------------------
// 键位
// ---------------------------------------------------------------------------

export type InputName = "confirm" | "cancel" | "up" | "down" | "left" | "right";

/**
 * 朵朵 W A S D + F 确认 / G 取消;星星 方向键 + L 确认 / K 取消。
 * 三段式只需要「确认」一个键,方向键留给微调落点。
 */
export const KEY_MAP: Record<string, { player: 0 | 1; action: InputName }> = {
  KeyW: { player: 0, action: "up" },
  KeyA: { player: 0, action: "left" },
  KeyS: { player: 0, action: "down" },
  KeyD: { player: 0, action: "right" },
  KeyF: { player: 0, action: "confirm" },
  KeyG: { player: 0, action: "cancel" },
  ArrowUp: { player: 1, action: "up" },
  ArrowLeft: { player: 1, action: "left" },
  ArrowDown: { player: 1, action: "down" },
  ArrowRight: { player: 1, action: "right" },
  KeyL: { player: 1, action: "confirm" },
  KeyK: { player: 1, action: "cancel" },
  // 空格谁按都算「停指针」,单人玩的时候最顺手
  Space: { player: 0, action: "confirm" },
};

/** 键盘 code 翻译成「几号玩家的哪个动作」;单人玩的时候两套键位都归 0 号 */
export function keyToAction(code: string, players: number): { player: number; action: InputName } | null {
  const hit = KEY_MAP[code];
  if (!hit) return null;
  if (code === "Space") return { player: 0, action: "confirm" };
  if (players <= 1) return { player: 0, action: hit.action };
  return { player: hit.player, action: hit.action };
}

export function isPauseKey(code: string): boolean {
  return code === "Escape";
}

// ---------------------------------------------------------------------------
// 评分与文案
// ---------------------------------------------------------------------------

/**
 * 闯关评星:分数超过目标越多星越多。
 * 刚好达标 1 星,多两成 2 星,多五成 3 星。
 */
export function rateLevel(score: number, target: number): 1 | 2 | 3 {
  const t = Math.max(1, target);
  if (score >= t * 1.5) return 3;
  if (score >= t * 1.2) return 2;
  return 1;
}

/** 这一球的播报 */
export function shotLine(count: number, first: boolean, gutter: boolean): string {
  if (gutter && count === 0) return "球掉进球沟啦,下一球把落点往中间挪一点。";
  if (first && count === PINS) return "全中!十个瓶一个不剩。";
  if (count === 0) return "这一球没碰到瓶,换个落点再来。";
  if (!first && count > 0) return `补上 ${count} 瓶。`;
  return `打倒 ${count} 瓶。`;
}

export function winLine(score: number, target: number, strikes: number): string {
  if (strikes >= 2) return `${score} 分达标(目标 ${target} 分),而且打出了 ${strikes} 次全中。口袋位找得很准,继续保持。`;
  return `${score} 分达标,目标是 ${target} 分。想再高一点就练全中:让球斜着切进头瓶旁边那个口子。`;
}

export function loseLine(score: number, target: number): string {
  return `这一次 ${score} 分,还差 ${Math.max(0, target - score)} 分。别急,先把落点稳住,能连着补中,分数自然就上去了。`;
}

export function versusLine(scores: readonly number[], names: readonly string[]): string {
  return `${names[0]} ${scores[0]} 比 ${scores[1]} ${names[1]}`;
}

export function endlessLine(frames: number, best: number): string {
  if (frames >= best && frames > 0) return `连着打过 ${frames} 格,刷新了自己的纪录!节奏稳住,还能更远。`;
  return `这次撑了 ${frames} 格,最好成绩是 ${best} 格。稳定比爆发更重要,先保证每一格都补中。`;
}
