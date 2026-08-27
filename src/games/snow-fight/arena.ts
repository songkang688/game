/**
 * 雪球大作战 1.2 · 实时一局(不碰 DOM,只认「时间往前走一小步」)。
 *
 * 1.1 是回合制:你定角度、定力度、松手,然后等对面。
 * 1.2 改成实时的三拍子——**躲、搓、投**:
 *
 *   躲:蹲在雪坡后面,对面的雪球有一半会顺着坡滑过去;
 *   搓:蹲着 0.6 秒搓一颗,手里最多三颗,脚下的雪会被挖薄,得换阵地;
 *   投:站起来蓄力 0–1.2 秒,落点圈跟着蓄力实时变,松手把雪球抛出去。
 *
 * 三拍子互相咬:蹲着最安全但扔不出去,站着能扔但会被砸成雪人 1.5 秒。
 * 被砸中不掉血、不淘汰,连中三次去炉子边暖手 5 秒再回场。
 *
 * 推进方式:`stepArena` 内部按 `STEP_12`(1/120 秒)切成小步,
 * 随机数走自带的种子——同一个种子 + 同一串输入 = 同一局,用例才敢断言。
 */
import { mulberry32 } from "../level99";
import {
  ANGLE_MAX_12,
  ANGLE_MIN_12,
  BALL_R_12,
  CHARGE_MAX,
  STEP_12,
  aimAt12,
  applySpread,
  clamp12,
  landingCircle,
  launch,
  stepBall,
  type Ball12,
  type LandingCircle,
  type Throw12,
} from "./throw12";
import {
  DEPTH_PER_BALL,
  interrupt,
  makeField,
  makeHands,
  scoopTick,
  snowfallTick,
  spendBall,
  splashSnow,
  type Hands,
  type SnowField,
} from "./economy";
import {
  blocksBall,
  coverAt,
  hitCover,
  isGone,
  makeCover,
  rowBase,
  rowHitScale,
  type Cover12,
  type CoverSpec12,
} from "./covers12";
import { bump, canAct, makeHitState, tickHit, type HitState } from "./snowman";
import type { SnowLevel } from "./levels";
import type { AiLevel } from "./physics";

export type ArenaMode = "campaign" | "duel" | "endless";

/** 场地宽度(和 1.1 同一套坐标) */
export const FIELD_W_12 = 60;
/** 雪堡警戒线:雪怪走到这儿,这一轮就结束(不是「被打败」,是「该重来一次」) */
export const FORT_X = 12;
/** 走路速度(单位/秒) */
export const MOVE_SPEED = 6.5;
/** 准星每秒能抬多少度 */
export const AIM_SPEED = 52;
/** 人的碰撞半径 */
export const BODY_R_12 = 1.2;
/** 出手点在肩膀这么高 */
export const HAND_Y = 1.5;
/** 蹲下时人只有这么高(蹲着更难被砸中) */
export const CROUCH_SCALE = 0.55;
/** 出手之后要停这么久才能再蓄力(免得一秒连发三颗) */
export const THROW_COOLDOWN = 0.28;
/** 每隔几秒换一次风 */
export const WIND_SWITCH = 7;
/** 一波清完之后歇几秒再来下一波 */
export const WAVE_BREAK = 2.2;
/** 对战最长打多久(秒),到点按剩余灯笼数判 */
export const DUEL_TIME = 150;
/** 雪人对手出手时最多歪多少度(准度 0 的时候) */
export const FOE_MAX_JITTER = 7;

export interface Fighter {
  id: number;
  seat: 0 | 1;
  name: string;
  x: number;
  dir: 1 | -1;
  /** 准星仰角(度) */
  aim: number;
  crouch: boolean;
  hands: Hands;
  hit: HitState;
  /** 正在蓄力多久了;null = 没按 */
  charge: number | null;
  cooldown: number;
  /** 电脑控制的话是哪一档 */
  ai: AiLevel | null;
  /** 电脑的小本子:这一发打算怎么扔 */
  plan: { angle: number; charge: number } | null;
  /** 电脑的反应延迟计时 */
  think: number;
  /** 电脑正在蹲着躲,还要蹲几秒 */
  duck: number;
  /** 电脑正在补货:一直蹲到攥满三颗为止 */
  refilling: boolean;
  /** 电脑找不到出手角度时打算挪到哪个位置去,-1 表示没打算挪 */
  seek: number;
  minX: number;
  maxX: number;
  /** 砸化了几个 */
  score: number;
  /** 一共扔了几颗 */
  thrown: number;
}

export type FoeKind = "lantern" | "snowfoe";

export interface Foe {
  id: number;
  kind: FoeKind;
  x: number;
  y: number;
  r: number;
  row: 0 | 1;
  /** 灯笼归谁(对战用),-1 中立 */
  owner: number;
  melted: boolean;
  homeX: number;
  sway: number;
  swaySpeed: number;
  phase: number;
  /** 往雪堡走多快(单位/秒),0 = 不动 */
  march: number;
  /** 还有几秒出手;throwEvery = 0 表示这个对手不扔雪球 */
  throwCd: number;
  /** 出手间隔 */
  throwEvery: number;
  /** 撞上掩体时,还有几秒能拆一层 */
  bashCd: number;
  /** 刚扔完雪球会站住喘几秒(这几秒不往前走,给人喘息也让动作看得清) */
  pause: number;
  /** 0..1,越大越准 */
  accuracy: number;
}

export interface FlyingBall extends Ball12 {
  id: number;
  /** 谁扔的:>=0 是 fighter.id,-1 是雪人对手 */
  owner: number;
  seat: number;
  spin: number;
  age: number;
  /** 出手时自己正躲在哪个掩体后面(那一个不挡自己的球) */
  skipCover: number;
}

export type ArenaEvent =
  | { kind: "throw"; x: number; y: number; seat: number }
  | { kind: "scoop"; x: number; seat: number }
  | { kind: "melt"; x: number; y: number; foe: FoeKind }
  | { kind: "cover"; x: number; y: number; broke: boolean; pushed: number }
  | { kind: "splash"; x: number; y: number }
  | { kind: "shield"; x: number; y: number; seat: number }
  | { kind: "snowman"; x: number; y: number; seat: number; warming: boolean }
  | { kind: "wave"; wave: number }
  | { kind: "over"; win: boolean };

export interface Arena {
  mode: ArenaMode;
  /** 开局到现在多少秒 */
  t: number;
  wind: number;
  windPlan: number[];
  /** 这一段风吹了多久 */
  windAt: number;
  /** 现在用的是 windPlan 的第几项 */
  windIndex: number;
  field: SnowField;
  covers: Cover12[];
  foes: Foe[];
  fighters: Fighter[];
  balls: FlyingBall[];
  wave: number;
  waveBreak: number;
  status: "playing" | "win" | "lose";
  /** 赢的是哪个座位(对战用),-1 = 平手 / 不适用 */
  winner: number;
  reason: string;
  melted: number;
  /** 闯关:雪怪走到哪儿算越线 */
  fortX: number;
  nextId: number;
  rand: () => number;
  /** 对战倒计时(秒),<=0 表示不限时 */
  clock: number;
}

/** 一小步的输入。四个键就是全部:走、抬准星、蹲下搓雪、按住投 */
export interface Input12 {
  move: number;
  aim: number;
  crouch: boolean;
  charging: boolean;
}

export function idleInput(): Input12 {
  return { move: 0, aim: 0, crouch: false, charging: false };
}

// ---------------------------------------------------------------------------
// 查询(画面与 AI 都靠这几个)
// ---------------------------------------------------------------------------

/** 这个人现在这一发的出手参数 */
export function throwSpecOf(f: Fighter): Throw12 {
  return {
    x: f.x + f.dir * 0.6,
    y: HAND_Y * (f.crouch ? CROUCH_SCALE + 0.25 : 1),
    angle: f.aim,
    dir: f.dir,
    charge: f.charge ?? 0,
  };
}

/** 这个人现在的落点圈(没在蓄力就按「刚按下去」算,先给个参考) */
export function aimCircle(a: Arena, f: Fighter): LandingCircle {
  return landingCircle(throwSpecOf(f), a.wind);
}

/** 还没化掉的靶子(可以按归属筛) */
export function liveFoes(a: Arena, owner?: number): Foe[] {
  return a.foes.filter((f) => !f.melted && (owner === undefined || f.owner === owner));
}

/** 这个人被掩体挡住多少(0 = 全露着,1 = 完全挡住) */
export function shieldOf(a: Arena, f: Fighter, from: 1 | -1): number {
  return coverAt(a.covers, { x: f.x, crouching: f.crouch }, from);
}

/** 给用例与存档用的一份扁平快照(同种子同输入必须完全一致) */
export function snapshot(a: Arena): string {
  const r = (v: number): string => v.toFixed(3);
  const fighters = a.fighters
    .map((f) => `${f.seat}:${r(f.x)}:${r(f.aim)}:${f.hands.balls}:${r(f.hands.progress)}:${f.hit.phase}:${f.score}`)
    .join("|");
  const foes = a.foes.map((f) => `${f.id}${f.melted ? "-" : "+"}${r(f.x)}`).join(",");
  const balls = a.balls.map((b) => `${r(b.x)}/${r(b.y)}`).join(",");
  return `t${r(a.t)} w${r(a.wind)} ${a.status} ${fighters} ${foes} ${balls} covers${a.covers.length} wave${a.wave}`;
}

// ---------------------------------------------------------------------------
// 一小步
// ---------------------------------------------------------------------------

function fighterHitBox(f: Fighter): { x: number; y: number; r: number } {
  const r = BODY_R_12 * (f.crouch ? CROUCH_SCALE : 1);
  return { x: f.x, y: (f.crouch ? 0.5 : 1.1), r };
}

/**
 * 自己正躲在哪个掩体后面。
 * 这一个掩体不挡自己扔出去的球——从自家墙后面探头往外扔天经地义,
 * 不这么写的话「躲在雪坡后面」就等于「把自己关起来」。
 */
export function coverBehind(a: Arena, f: Fighter): number {
  let skip = -1;
  for (const c of a.covers) {
    const behind = f.dir === 1 ? f.x > c.x : f.x < c.x + c.w;
    if (behind && Math.abs(f.x - (f.dir === 1 ? c.x + c.w : c.x)) < 3.4) skip = c.id;
  }
  return skip;
}

function throwFrom(a: Arena, f: Fighter, ev: ArenaEvent[]): void {
  const spent = spendBall(f.hands);
  if (!spent) {
    f.charge = null;
    return;
  }
  const spec = applySpread(throwSpecOf(f), a.rand() * 2 - 1);
  const b = launch(spec);
  const skip = coverBehind(a, f);
  a.balls.push({
    ...b,
    id: a.nextId++,
    owner: f.id,
    seat: f.seat,
    spin: (a.rand() * 2 - 1) * 9,
    age: 0,
    skipCover: skip,
  });
  f.hands = spent;
  f.charge = null;
  f.cooldown = THROW_COOLDOWN;
  f.thrown += 1;
  ev.push({ kind: "throw", x: spec.x, y: spec.y, seat: f.seat });
}

function foeThrow(a: Arena, foe: Foe, target: Fighter, ev: ArenaEvent[]): void {
  const from = { x: foe.x, y: foe.y + rowBase(foe.row) + 0.4, dir: (foe.x > target.x ? -1 : 1) as 1 | -1 };
  const aim = aimAt12(from, { x: target.x, y: 0.8 }, a.wind);
  if (!aim) return;
  const jitter = (1 - foe.accuracy) * FOE_MAX_JITTER * (a.rand() * 2 - 1);
  const spec: Throw12 = {
    x: from.x,
    y: from.y,
    dir: from.dir,
    angle: clamp12(aim.angle + jitter, ANGLE_MIN_12, ANGLE_MAX_12),
    charge: aim.charge,
  };
  const b = launch(spec);
  a.balls.push({ ...b, id: a.nextId++, owner: -1, seat: 2, spin: 6, age: 0, skipCover: -1 });
  ev.push({ kind: "throw", x: spec.x, y: spec.y, seat: 2 });
}

function meltFoe(a: Arena, foe: Foe, by: Fighter | null, ev: ArenaEvent[]): void {
  foe.melted = true;
  a.melted += 1;
  if (by) by.score += 1;
  ev.push({ kind: "melt", x: foe.x, y: foe.y + rowBase(foe.row), foe: foe.kind });
}

function bumpFighter(a: Arena, f: Fighter, ev: ArenaEvent[]): void {
  const before = f.hit.phase;
  f.hit = bump(f.hit);
  if (f.hit.phase === before) return;
  f.hands = interrupt(f.hands);
  f.charge = null;
  f.crouch = false;
  ev.push({
    kind: "snowman",
    x: f.x,
    y: 1.2,
    seat: f.seat,
    warming: f.hit.phase === "warming",
  });
}

/** 雪球飞一小步,撞上什么就结算什么。返回 true 表示这颗球没了 */
function stepOneBall(a: Arena, ball: FlyingBall, h: number, ev: ArenaEvent[]): boolean {
  const next = stepBall(ball, h, a.wind);
  ball.x = next.x;
  ball.y = next.y;
  ball.vx = next.vx;
  ball.vy = next.vy;
  ball.age += h;
  if (ball.x < -1 || ball.x > FIELD_W_12 + 1) return true;
  if (ball.y <= 0) {
    a.field = splashSnow(a.field, ball.x);
    ev.push({ kind: "splash", x: ball.x, y: 0 });
    return true;
  }

  for (const c of a.covers) {
    if (c.id === ball.skipCover) continue;
    if (!blocksBall(c, ball, BALL_R_12)) continue;
    const speed = Math.hypot(ball.vx, ball.vy);
    const out = hitCover(c, { dir: ball.vx >= 0 ? 1 : -1, speed }, { min: 0, max: FIELD_W_12 });
    Object.assign(c, out.cover);
    if (isGone(c)) a.covers = a.covers.filter((x) => x.id !== c.id);
    ev.push({ kind: "cover", x: ball.x, y: ball.y, broke: out.broke, pushed: out.pushed });
    return true;
  }

  const thrower = a.fighters.find((f) => f.id === ball.owner) ?? null;
  if (ball.owner >= 0) {
    for (const foe of a.foes) {
      if (foe.melted) continue;
      if (foe.kind === "lantern" && foe.owner >= 0 && foe.owner === ball.seat) continue;
      const cy = foe.y + rowBase(foe.row);
      const reach = foe.r * rowHitScale(foe.row) + BALL_R_12;
      if (Math.hypot(ball.x - foe.x, ball.y - cy) <= reach) {
        meltFoe(a, foe, thrower, ev);
        return true;
      }
    }
  }

  for (const f of a.fighters) {
    if (f.id === ball.owner) continue;
    if (ball.owner < 0 && f.ai !== null) continue; // 雪人对手不砸自己人
    const box = fighterHitBox(f);
    if (Math.hypot(ball.x - box.x, ball.y - box.y) > box.r + BALL_R_12) continue;
    const from: 1 | -1 = ball.vx >= 0 ? 1 : -1;
    const shield = shieldOf(a, f, from);
    if (shield > 0 && a.rand() < shield) {
      ev.push({ kind: "shield", x: ball.x, y: ball.y, seat: f.seat });
      return true;
    }
    bumpFighter(a, f, ev);
    return true;
  }
  return false;
}

function stepFighter(a: Arena, f: Fighter, input: Input12, h: number, ev: ArenaEvent[]): void {
  f.hit = tickHit(f.hit, h);
  if (f.cooldown > 0) f.cooldown = Math.max(0, f.cooldown - h);
  if (!canAct(f.hit)) {
    f.crouch = false;
    f.charge = null;
    return;
  }
  const wantCrouch = input.crouch;
  if (!wantCrouch && f.crouch) f.hands = interrupt(f.hands);
  f.crouch = wantCrouch;
  if (!wantCrouch && Math.abs(input.move) > 0.01) {
    f.x = clamp12(f.x + Math.sign(input.move) * MOVE_SPEED * h, f.minX, f.maxX);
  }
  if (Math.abs(input.aim) > 0.01) {
    f.aim = clamp12(f.aim + input.aim * AIM_SPEED * h, ANGLE_MIN_12, ANGLE_MAX_12);
  }
  if (wantCrouch) {
    // 蹲着搓雪:安全,但这会儿扔不出去——这就是本款的节奏
    f.charge = null;
    const out = scoopTick(f.hands, a.field, f.x, h);
    f.hands = out.hands;
    a.field = out.field;
    if (out.made) ev.push({ kind: "scoop", x: f.x, seat: f.seat });
    return;
  }
  if (input.charging && f.cooldown <= 0 && f.hands.balls > 0) {
    f.charge = Math.min(CHARGE_MAX, (f.charge ?? 0) + h);
    return;
  }
  if (f.charge !== null) throwFrom(a, f, ev);
}

function stepFoes(a: Arena, h: number, ev: ArenaEvent[]): void {
  const humans = a.fighters.filter((f) => f.ai === null);
  for (const foe of a.foes) {
    if (foe.melted) continue;
    if (foe.pause > 0) foe.pause = Math.max(0, foe.pause - h);
    if (foe.march > 0 && foe.pause <= 0) {
      // 往前走的是「站桩位置」homeX,左右晃只是绕着它晃。
      // 把晃动也累加进 homeX 的话,每一帧的 sin 会一路积起来,雪人就飘到场外去了。
      const nextX = foe.homeX - foe.march * h;
      // 前面挡着雪墙 / 木箱就先拆它:雪墙一层层碎,木箱被推着走(雪坡是地形,直接踩过去)
      const wall = a.covers.find(
        (c) => c.kind !== "slope" && c.row === foe.row && nextX - foe.r <= c.x + c.w && nextX + foe.r >= c.x
      );
      if (wall) {
        foe.bashCd -= h;
        if (foe.bashCd <= 0) {
          const out = hitCover(wall, { dir: -1, speed: 20 }, { min: 0, max: FIELD_W_12 });
          Object.assign(wall, out.cover);
          if (isGone(wall)) a.covers = a.covers.filter((x) => x.id !== wall.id);
          ev.push({ kind: "cover", x: wall.x, y: rowBase(wall.row) + wall.h * 0.5, broke: out.broke, pushed: out.pushed });
          foe.bashCd = 0.9;
        }
      } else {
        foe.homeX = nextX;
      }
    }
    if (foe.sway > 0) foe.phase += foe.swaySpeed * h;
    foe.x = foe.sway > 0 ? foe.homeX + Math.sin(foe.phase) * foe.sway : foe.homeX;
    if (foe.throwEvery > 0 && humans.length > 0) {
      foe.throwCd -= h;
      if (foe.throwCd <= 0) {
        foe.throwCd = foe.throwEvery * (0.75 + a.rand() * 0.5);
        const target = humans.reduce((best, f) =>
          Math.abs(f.x - foe.x) < Math.abs(best.x - foe.x) ? f : best
        );
        if (canAct(target.hit)) {
          foeThrow(a, foe, target, ev);
          foe.pause = 1.1;
        }
      }
    }
  }
}

function checkStatus(a: Arena, ev: ArenaEvent[]): void {
  if (a.status !== "playing") return;
  if (a.mode === "duel") {
    for (const f of a.fighters) {
      const foeSeat = 1 - f.seat;
      if (liveFoes(a, foeSeat).length === 0) {
        a.status = "win";
        a.winner = f.seat;
        a.reason = `${f.name}把对面三盏雪灯笼全砸化啦`;
        ev.push({ kind: "over", win: true });
        return;
      }
    }
    if (a.clock > 0 && a.t >= a.clock) {
      const left0 = liveFoes(a, 0).length;
      const left1 = liveFoes(a, 1).length;
      a.status = "win";
      a.winner = left0 === left1 ? -1 : left0 < left1 ? 1 : 0;
      a.reason = a.winner < 0 ? "时间到,两边打成平手" : "时间到,灯笼剩得少的一方赢";
      ev.push({ kind: "over", win: true });
    }
    return;
  }
  const crossed = a.foes.find((f) => !f.melted && f.march > 0 && f.x - f.r <= a.fortX);
  if (crossed) {
    a.status = "lose";
    a.reason = "有雪人走到雪堡跟前啦";
    ev.push({ kind: "over", win: false });
    return;
  }
  if (liveFoes(a).length === 0) {
    if (a.mode === "endless") return; // 无尽由波次接管
    a.status = "win";
    a.reason = "全部靶子都化成一摊雪啦";
    ev.push({ kind: "over", win: true });
  }
}

function stepWaves(a: Arena, h: number, ev: ArenaEvent[]): void {
  if (a.mode !== "endless" || a.status !== "playing") return;
  if (liveFoes(a).length > 0) return;
  a.waveBreak -= h;
  if (a.waveBreak > 0) return;
  a.wave += 1;
  a.waveBreak = WAVE_BREAK;
  a.foes = a.foes.filter((f) => !f.melted);
  for (const spec of waveFoes(a.wave, a.rand)) a.foes.push(makeFoe(spec, a.nextId++));
  // 一波结束会下一场雪:被挖秃的阵地慢慢又能用了
  a.field = snowfallTick(a.field, 1, DEPTH_PER_BALL);
  ev.push({ kind: "wave", wave: a.wave });
}

/**
 * 往前走一段时间。内部切成 1/120 秒的小步,所以传多大的 dt 都稳。
 * 返回这一段时间里发生的事,画面照着放粒子和音效。
 */
export function stepArena(a: Arena, dt: number, inputs: Partial<Record<number, Input12>>): ArenaEvent[] {
  const ev: ArenaEvent[] = [];
  if (a.status !== "playing") return ev;
  let left = Math.max(0, Math.min(0.1, dt));
  while (left > 1e-9 && a.status === "playing") {
    const h = Math.min(STEP_12, left);
    left -= h;
    a.t += h;
    if (a.windPlan.length > 1) {
      a.windAt += h;
      if (a.windAt >= WIND_SWITCH) {
        a.windAt -= WIND_SWITCH;
        a.windIndex = (a.windIndex + 1) % a.windPlan.length;
        a.wind = a.windPlan[a.windIndex] ?? a.wind;
      }
    }
    a.field = snowfallTick(a.field, h);
    for (const f of a.fighters) {
      stepFighter(a, f, inputs[f.seat] ?? idleInput(), h, ev);
    }
    stepFoes(a, h, ev);
    const keep: FlyingBall[] = [];
    for (const b of a.balls) {
      if (!stepOneBall(a, b, h, ev)) keep.push(b);
    }
    a.balls = keep;
    stepWaves(a, h, ev);
    checkStatus(a, ev);
  }
  return ev;
}

// ---------------------------------------------------------------------------
// 组装一局
// ---------------------------------------------------------------------------

export interface FoeSpec {
  kind?: FoeKind;
  x: number;
  y: number;
  r?: number;
  row?: 0 | 1;
  owner?: number;
  sway?: number;
  swaySpeed?: number;
  march?: number;
  throwEvery?: number;
  accuracy?: number;
}

export function makeFoe(spec: FoeSpec, id: number): Foe {
  return {
    id,
    kind: spec.kind ?? "lantern",
    x: spec.x,
    y: spec.y,
    r: spec.r ?? 1.2,
    row: spec.row ?? 0,
    owner: spec.owner ?? -1,
    melted: false,
    homeX: spec.x,
    sway: spec.sway ?? 0,
    swaySpeed: spec.swaySpeed ?? 0.6,
    phase: 0,
    march: spec.march ?? 0,
    throwCd: (spec.throwEvery ?? 0) * 0.8,
    throwEvery: spec.throwEvery ?? 0,
    bashCd: 0.9,
    pause: 0,
    accuracy: spec.accuracy ?? 0,
  };
}

export interface FighterSpec {
  seat: 0 | 1;
  name: string;
  x: number;
  dir: 1 | -1;
  minX: number;
  maxX: number;
  balls?: number;
  ai?: AiLevel | null;
}

export function makeFighter(spec: FighterSpec, id: number): Fighter {
  return {
    id,
    seat: spec.seat,
    name: spec.name,
    x: spec.x,
    dir: spec.dir,
    aim: 45,
    crouch: false,
    hands: makeHands(spec.balls ?? 2),
    hit: makeHitState(),
    charge: null,
    cooldown: 0,
    ai: spec.ai ?? null,
    plan: null,
    think: 0,
    duck: 0,
    refilling: false,
    seek: -1,
    minX: spec.minX,
    maxX: spec.maxX,
    score: 0,
    thrown: 0,
  };
}

export interface ArenaSpec {
  mode: ArenaMode;
  seed: number;
  windPlan: number[];
  covers: CoverSpec12[];
  foes: FoeSpec[];
  fighters: FighterSpec[];
  fortX?: number;
  clock?: number;
  /** 开局地面积雪厚度 */
  snow?: number;
}

export function createArena(spec: ArenaSpec): Arena {
  let nextId = 1;
  const covers = spec.covers.map((c) => makeCover(c, nextId++));
  const foes = spec.foes.map((f) => makeFoe(f, nextId++));
  const fighters = spec.fighters.map((f) => makeFighter(f, nextId++));
  return {
    mode: spec.mode,
    t: 0,
    wind: spec.windPlan[0] ?? 0,
    windPlan: spec.windPlan.length > 0 ? [...spec.windPlan] : [0],
    windAt: 0,
    windIndex: 0,
    field: makeField(FIELD_W_12, spec.snow ?? 1),
    covers,
    foes,
    fighters,
    balls: [],
    wave: 1,
    waveBreak: WAVE_BREAK,
    status: "playing",
    winner: -1,
    reason: "",
    melted: 0,
    fortX: spec.fortX ?? FORT_X,
    nextId,
    rand: mulberry32(spec.seed >>> 0),
    clock: spec.clock ?? 0,
  };
}

// ---------------------------------------------------------------------------
// 188 关:直接读 levels.ts 生成的那一份数据,一个数都不改
// ---------------------------------------------------------------------------

/**
 * 1.1 的靶子「每回合走 march 格」换算成实时的「每秒走多少」。
 * 0.26 是跑出来的:最快的雪人走 0.6 格/秒,从 24 格外走到雪堡要二十秒,
 * 够搓两颗雪球再从容瞄一发——后段关卡靠「同时来好几个」变难,而不是靠跑得快。
 */
export const MARCH_TO_SPEED = 0.26;

/**
 * 第几章的雪人开始会还手,还手得多准。
 *
 * 数字往下压过一轮:后面几章一次来四个雪怪,每个 3 秒一发就等于**不到一秒一发**,
 * 场上永远有球在飞,人从头到尾在「变雪人」和「暖手」之间来回,连蹲下搓一颗的空都没有。
 * 现在最快也要 3.6 秒一发、最准也只有 0.5,四个一起来仍然紧张,但躲得过来。
 */
export function chapterFoeFire(ci: number): { throwEvery: number; accuracy: number } {
  if (ci < 3) return { throwEvery: 0, accuracy: 0 };
  return {
    throwEvery: Math.max(3.6, 6.4 - ci * 0.35),
    accuracy: Math.min(0.5, 0.14 + ci * 0.045),
  };
}

/**
 * 把一关折成一局实时对局。
 *
 * 靶位、掩体、风、雪球数全部来自 `levels.ts`(**数据一个字没改**),
 * 只是换了一套读法:`march` 从「每回合几格」变成「每秒几格」,
 * 掩体按下标轮流变成雪墙 / 木箱 / 雪坡,单数号摆到远排做伪纵深,
 * 自家阵地固定送一道雪坡——蹲下去既能搓雪也能躲。
 */
export function campaignArena(level: SnowLevel, seed = 20260215): Arena {
  const ci = level.chapterIndex;
  const fire = chapterFoeFire(ci);
  const kinds: Array<CoverSpec12["kind"]> = ["wall", "crate", "slope"];
  const covers: CoverSpec12[] = [
    { kind: "slope", x: 7.4, w: 3.4, h: 2.2, row: 0 },
    ...level.covers.map((c, i) => ({
      kind: kinds[i % kinds.length],
      x: c.x,
      w: c.w,
      h: c.h,
      row: (ci >= 2 && i % 2 === 1 ? 1 : 0) as 0 | 1,
    })),
  ];
  if (ci >= 3) covers.push({ kind: "crate", x: 10.2, w: 1.8, h: 2.4, row: 0 });
  const foes: FoeSpec[] = level.targets.map((t, i) => {
    const monster = t.kind === "monster";
    return {
      kind: monster ? "snowfoe" : "lantern",
      x: t.x,
      y: t.y,
      r: t.r ?? 1.2,
      // 会走过来的一律走近排。远排又高 1.8 格、判定还收窄三成,
      // 一个走到你脸上的雪人要是站在远排,就成了「看得见、砸不着」——
      // 灯笼站远排是练准头,雪怪站远排是耍赖。
      row: (!monster && ci >= 2 && i % 2 === 1 ? 1 : 0) as 0 | 1,
      sway: t.sway ?? 0,
      swaySpeed: t.swaySpeed ?? 0.6,
      march: (t.march ?? 0) * MARCH_TO_SPEED,
      throwEvery: monster ? fire.throwEvery : 0,
      accuracy: fire.accuracy,
    };
  });
  return createArena({
    mode: "campaign",
    seed: seed + level.index * 977,
    windPlan: level.windPlan,
    covers,
    foes,
    fighters: [
      // 能一路走到雪堡前面 20 格:远处的高靶子够不着的时候得往前压,
      // 压上去雪厚、视野好,但雪人也更容易砸到你——这就是「阵地选择」的代价。
      { seat: 0, name: "朵朵", x: 6, dir: 1, minX: 2, maxX: 20, balls: 2 },
    ],
    fortX: FORT_X,
  });
}

/** 这一关三星要多省:沿用 1.1 的口径,拿关卡给的雪球数当基准 */
export function campaignBallBudget(level: SnowLevel): number {
  return level.balls;
}

// ---------------------------------------------------------------------------
// 双人对战 / 人机对战
// ---------------------------------------------------------------------------

/** 对战场地:左右完全对称,谁都占不到便宜 */
export function duelArena(ai: AiLevel | null, seed = 771): Arena {
  // 场地分三段:两头各一块「自家阵地」(有雪坡可以蹲着搓雪),中间是一条谁都得抬高角度
  // 才越得过去的掩体带。掩体带故意矮而密:躲得住,但躲久了对面就压上来了。
  //
  // 每一件掩体都**关于场地中线 x=30 严格对称**——差半格都不行:
  // 两边打的是同一套规则,谁赢该看谁躲得好、搓得快,不该看谁那边的墙矮一点。
  const covers: CoverSpec12[] = [
    { kind: "slope", x: 17.4, w: 3.4, h: 2.2, row: 0 }, // [17.4,20.8]
    { kind: "crate", x: 22.2, w: 1.8, h: 2.6, row: 0 }, // [22.2,24.0]
    { kind: "wall", x: 28.9, w: 2.2, h: 3.6, row: 0 }, // [28.9,31.1] 正中那一堵
    { kind: "crate", x: 36.0, w: 1.8, h: 2.6, row: 0 }, // [36.0,37.8]
    { kind: "slope", x: 39.2, w: 3.4, h: 2.2, row: 0 }, // [39.2,42.6]
    { kind: "wall", x: 25.0, w: 2.4, h: 3.2, row: 1 }, // [25.0,27.4]
    { kind: "wall", x: 32.6, w: 2.4, h: 3.2, row: 1 }, // [32.6,35.0]
  ];
  const foes: FoeSpec[] = [
    { x: 4, y: 2.4, r: 1.25, owner: 0, row: 0 },
    { x: 8, y: 3.2, r: 1.25, owner: 0, row: 1 },
    { x: 12, y: 2.4, r: 1.25, owner: 0, row: 0 },
    { x: 48, y: 2.4, r: 1.25, owner: 1, row: 0 },
    { x: 52, y: 3.2, r: 1.25, owner: 1, row: 1 },
    { x: 56, y: 2.4, r: 1.25, owner: 1, row: 0 },
  ];
  return createArena({
    mode: "duel",
    seed,
    windPlan: [0.8, -1.4, 1.9, -0.6, 2.4, -2.1],
    covers,
    foes,
    fighters: [
      { seat: 0, name: "朵朵", x: 18, dir: 1, minX: 15, maxX: 25, balls: 3 },
      { seat: 1, name: ai ? "雪人教练" : "星星", x: 42, dir: -1, minX: 35, maxX: 45, balls: 3, ai },
    ],
    clock: DUEL_TIME,
  });
}

// ---------------------------------------------------------------------------
// 无尽「雪季」:一波比一波准
// ---------------------------------------------------------------------------

export interface WaveShape {
  count: number;
  march: number;
  accuracy: number;
  throwEvery: number;
}

/** 第 n 波长什么样。人数、走速、准度都随波次往上走,准度封顶 0.86——再准就没得躲了 */
export function seasonWave(wave: number): WaveShape {
  const w = Math.max(1, Math.round(wave));
  return {
    count: Math.min(6, 1 + Math.ceil(w / 2)),
    march: Math.min(1.1, 0.34 + w * 0.06),
    accuracy: Math.min(0.86, 0.28 + w * 0.07),
    throwEvery: Math.max(1.7, 3.6 - w * 0.22),
  };
}

/** 第 n 波的雪人站位(确定性:同一个随机源同一串结果) */
export function waveFoes(wave: number, rand: () => number): FoeSpec[] {
  const shape = seasonWave(wave);
  const out: FoeSpec[] = [];
  for (let i = 0; i < shape.count; i++) {
    out.push({
      kind: "snowfoe",
      x: 40 + i * 3.4 + rand() * 3,
      y: 1.4 + rand() * 1.2,
      r: 1.3,
      row: i % 3 === 2 ? 1 : 0,
      march: shape.march,
      throwEvery: shape.throwEvery,
      accuracy: shape.accuracy,
      sway: wave >= 4 ? 0.8 : 0,
      swaySpeed: 0.7,
    });
  }
  return out;
}

/** 无尽「雪季」:雪人一波波从雪原那头过来 */
export function endlessArena(seed = 90210): Arena {
  const a = createArena({
    mode: "endless",
    seed,
    windPlan: [0, 1.2, -1.6, 2.2, -0.9, 1.7, -2.4],
    covers: [
      { kind: "slope", x: 9.5, w: 3.6, h: 2.3, row: 0 },
      { kind: "wall", x: 16, w: 2.4, h: 4.6, row: 0 },
      { kind: "crate", x: 21, w: 1.8, h: 2.6, row: 0 },
      { kind: "wall", x: 25, w: 2.4, h: 4.2, row: 1 },
    ],
    foes: [],
    fighters: [{ seat: 0, name: "朵朵", x: 8, dir: 1, minX: 3, maxX: 24, balls: 3 }],
    fortX: FORT_X,
  });
  for (const spec of waveFoes(1, a.rand)) a.foes.push(makeFoe(spec, a.nextId++));
  return a;
}

// ---------------------------------------------------------------------------
// 文案(只鼓励,不说输赢死伤)
// ---------------------------------------------------------------------------

export function campaignWinLine(thrown: number, budget: number): string {
  const head = `扔了 ${thrown} 颗雪球(基准 ${budget} 颗)。`;
  if (thrown <= budget * 0.6) return `${head}又准又省!落点圈套住靶子再松手,就是这个节奏。`;
  if (thrown <= budget) return `${head}打得不错。下次试试蹲在雪坡后面多攒一颗再站起来。`;
  return `${head}过关啦。记住第一发看落点圈落在哪边,第二发照着差多少改。`;
}

export function campaignLoseLine(reason: string): string {
  if (reason.includes("雪人")) {
    return "雪人走到雪堡跟前啦。下次先拦最靠前的那一个,雪墙能挡它三下,雪坡后面蹲着搓雪最安全。";
  }
  return "这一关先到这儿。蹲下搓雪、站起来蓄力,落点圈套住靶子再松手,下一次一定行。";
}

/** 无尽结算 */
export function seasonLine(wave: number, melted: number, best: number): string {
  return `这一场雪季顶到了第 ${wave} 波,化掉 ${melted} 个雪人。历史最好:第 ${best} 波。`;
}
