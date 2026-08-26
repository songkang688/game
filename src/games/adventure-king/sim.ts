// 冒险小王:一局游戏的纯状态机(不碰 DOM、不碰画布)。
//
// index.ts 每一帧把「按住哪些键」交给 stepRun,拿回一串事件去放音效、画画面;
// 单测则用 botInput 驱动同一套状态机,让机器人把关卡从头玩到尾,
// 以此证明 188 关 + 无尽层 + 速通赛道全部真的能通关。
import type { AdvLevel } from "./levels";
import {
  BOOMERANG_HIT,
  GRAVITY,
  JUMP_V,
  ROPE_MAX,
  boomerangDone,
  boomerangOffset,
  clamp,
  dist,
  fallStep,
  initialAngVel,
  landsOn,
  patrolStep,
  pickAnchor,
  rectsOverlap,
  releaseVelocity,
  ropeAngle,
  ropeLength,
  runStep,
  swingPoint,
  swingStep,
  type Rect,
} from "./logic";

export const PLAYER_W = 34;
export const PLAYER_H = 46;
/** 掉到这条线以下就算掉进坑里(比荡绳最低点还低,荡过去时不会误判) */
export const PIT_Y = 500;
/** 世界坐标里画面的高度;摄像机只左右跟随,上下固定 */
export const VIEW_H = 520;
/** 挂上藤环后至少荡这么久、横向挪出这么远,才允许自动落到石台上 */
export const HOOK_SETTLE_SEC = 0.35;
export const HOOK_SETTLE_X = 50;
/** 按方向键「加把劲」的角加速度 */
export const SWING_PUMP = 2.4;
/** 角速度封顶,防止一直按着把单摆蹬成风车 */
export const SWING_MAX_ANG_VEL = 3;
/** 摆角上限(约 83 度),再高绳子就软了 */
export const SWING_MAX_ANGLE = 1.45;

export interface HookState {
  anchor: number;
  len: number;
  angle: number;
  angVel: number;
  age: number;
  startX: number;
}

export interface BoomState {
  t: number;
  ox: number;
  oy: number;
  dir: number;
}

export interface SimEnemy {
  x: number;
  y: number;
  from: number;
  to: number;
  dir: number;
  kind: "ground" | "flyer";
  alive: boolean;
  bob: number;
}

export interface RunState {
  px: number;
  py: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
  /** 最近一次站稳的位置,掉坑后从这里复活 */
  safeX: number;
  safeY: number;
  hook: HookState | null;
  boom: BoomState | null;
  enemies: SimEnemy[];
  /** 已经拿到的神器种类 */
  got: Set<number>;
  hearts: number;
  hurts: number;
  invincible: number;
  elapsed: number;
  outcome: "run" | "clear" | "fail";
}

/** 这一帧玩家在做什么:方向是「按住」,其余三个是「刚按下」 */
export interface RunInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  hook: boolean;
  throw: boolean;
}

export type RunEvent =
  | { kind: "jump" }
  | { kind: "hookOn" }
  | { kind: "hookOff" }
  | { kind: "noAnchor" }
  | { kind: "land" }
  | { kind: "throw" }
  | { kind: "enemyDown" }
  | { kind: "artifact"; artifact: number; left: number }
  | { kind: "hurt"; text: string }
  | { kind: "doorLocked"; need: number }
  | { kind: "clear" }
  | { kind: "fail"; text: string };

export function emptyInput(): RunInput {
  return { left: false, right: false, jump: false, hook: false, throw: false };
}

export function createRun(lv: AdvLevel): RunState {
  const start = lv.platforms[0];
  return {
    px: start.x + 60,
    py: start.y,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: true,
    safeX: start.x + 60,
    safeY: start.y,
    hook: null,
    boom: null,
    enemies: lv.enemies.map((e) => ({
      x: e.x,
      y: e.y,
      from: e.from,
      to: e.to,
      dir: 1,
      kind: e.kind,
      alive: true,
      bob: 0,
    })),
    got: new Set<number>(),
    hearts: lv.hearts,
    hurts: 0,
    invincible: 0,
    elapsed: 0,
    outcome: "run",
  };
}

export function playerRect(s: RunState): Rect {
  return { x: s.px - PLAYER_W / 2, y: s.py - PLAYER_H, w: PLAYER_W, h: PLAYER_H };
}

/** 小怪当前实际所在的高度(飞行的会上下浮动) */
export function enemyY(e: SimEnemy): number {
  return e.kind === "flyer" ? e.y + Math.sin(e.bob) * 12 : e.y;
}

function releaseRope(s: RunState, out: RunEvent[]): void {
  if (!s.hook) return;
  const v = releaseVelocity(s.hook.angle, s.hook.angVel, s.hook.len);
  s.vx = clamp(v.vx, -520, 520);
  s.vy = clamp(v.vy, -720, 720);
  s.hook = null;
  s.onGround = false;
  out.push({ kind: "hookOff" });
}

function hurt(s: RunState, text: string, out: RunEvent[]): void {
  if (s.invincible > 0 || s.outcome !== "run") return;
  s.hearts--;
  s.hurts++;
  s.invincible = 1.5;
  out.push({ kind: "hurt", text });
  if (s.hearts <= 0) {
    s.outcome = "fail";
    out.push({ kind: "fail", text });
    return;
  }
  s.hook = null;
  s.vx = -s.facing * 160;
  s.vy = -220;
}

/**
 * 推进一帧。会就地修改 state,并返回这一帧发生的事件。
 * dt 建议不超过 1/30 秒,太大会穿模。
 */
export function stepRun(lv: AdvLevel, s: RunState, input: RunInput, dt: number): RunEvent[] {
  const out: RunEvent[] = [];
  if (s.outcome !== "run") return out;
  s.elapsed += dt;
  s.invincible = Math.max(0, s.invincible - dt);

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) s.facing = dir;

  // ---- 边沿触发的三个动作 ----
  if (input.jump) {
    if (s.hook) {
      releaseRope(s, out);
      s.vy = Math.min(s.vy, -JUMP_V * 0.55);
    } else if (s.onGround) {
      s.vy = -JUMP_V;
      s.onGround = false;
      out.push({ kind: "jump" });
    }
  }
  if (input.hook) {
    if (s.hook) {
      releaseRope(s, out);
    } else {
      const chestY = s.py - PLAYER_H * 0.6;
      const i = pickAnchor(lv.anchors, s.px, chestY, ROPE_MAX, s.facing);
      if (i < 0) {
        out.push({ kind: "noAnchor" });
      } else {
        const a = lv.anchors[i];
        const len = ropeLength(s.px, chestY, a.x, a.y);
        const angle = ropeAngle(s.px, chestY, a.x, a.y);
        s.hook = { anchor: i, len, angle, angVel: initialAngVel(angle, len, s.vx, s.vy), age: 0, startX: s.px };
        s.onGround = false;
        out.push({ kind: "hookOn" });
      }
    }
  }
  if (input.throw && !s.boom) {
    s.boom = { t: 0, ox: s.px, oy: s.py - PLAYER_H * 0.6, dir: s.facing };
    out.push({ kind: "throw" });
  }

  // ---- 位移 ----
  if (s.hook) {
    s.hook.age += dt;
    // 荡秋千式的「加把劲」:只有顺着当前摆动方向蹬才有用,而且角速度有封顶,
    // 一直按着也不会越荡越疯、更不会绕着藤环转圈。
    if (dir !== 0 && Math.abs(s.hook.angVel) > 0.15 && Math.sign(s.hook.angVel) === dir) {
      s.hook.angVel = clamp(s.hook.angVel + dir * SWING_PUMP * dt, -SWING_MAX_ANG_VEL, SWING_MAX_ANG_VEL);
    }
    const next = swingStep(s.hook, s.hook.len, dt, GRAVITY * lv.gravityScale);
    s.hook.angle = next.angle;
    s.hook.angVel = clamp(next.angVel, -SWING_MAX_ANG_VEL, SWING_MAX_ANG_VEL);
    // 绳子不会甩到藤环上方:到极限角就当绳子软了,速度归零重新往下荡
    if (Math.abs(s.hook.angle) > SWING_MAX_ANGLE) {
      s.hook.angle = Math.sign(s.hook.angle) * SWING_MAX_ANGLE;
      s.hook.angVel = 0;
    }
    const a = lv.anchors[s.hook.anchor];
    const p = swingPoint(a.x, a.y, s.hook.len, s.hook.angle);
    s.px = p.x;
    s.py = p.y + PLAYER_H * 0.6;
    const v = releaseVelocity(s.hook.angle, s.hook.angVel, s.hook.len);
    s.vx = v.vx;
    s.vy = v.vy;
    if (s.hook.age > HOOK_SETTLE_SEC && Math.abs(s.px - s.hook.startX) > HOOK_SETTLE_X) {
      for (const plat of lv.platforms) {
        const over = s.px > plat.x - 26 && s.px < plat.x + plat.w + 26;
        if (over && s.py >= plat.y - 4 && s.py <= plat.y + 18 && s.vy >= -30) {
          s.hook = null;
          s.px = clamp(s.px, plat.x + 14, plat.x + plat.w - 14);
          s.py = plat.y;
          s.vx = 0;
          s.vy = 0;
          s.onGround = true;
          s.safeX = s.px;
          s.safeY = plat.y;
          out.push({ kind: "land" });
          break;
        }
      }
    }
  } else {
    const friction = s.onGround ? 2600 * lv.frictionScale : 900;
    s.vx = runStep(s.vx, dir, dt, s.onGround ? 2200 : 1500, friction);
    s.vy = fallStep(s.vy, dt, GRAVITY * lv.gravityScale);
    const prevFoot = s.py;
    s.px = clamp(s.px + s.vx * dt, 18, lv.width - 18);
    s.py += s.vy * dt;
    let landed = false;
    for (const plat of lv.platforms) {
      if (landsOn(prevFoot, s.py, s.vy, s.px - PLAYER_W / 2, s.px + PLAYER_W / 2, plat)) {
        s.py = plat.y;
        s.vy = 0;
        landed = true;
        s.safeX = clamp(s.px, plat.x + 20, plat.x + plat.w - 20);
        s.safeY = plat.y;
        break;
      }
    }
    if (landed && !s.onGround) out.push({ kind: "land" });
    s.onGround = landed;
  }

  // ---- 掉坑 ----
  if (s.py > PIT_Y && !s.hook) {
    hurt(s, "哎呀掉进坑里啦,下次早一点起跳!", out);
    if (s.outcome === "run") {
      s.px = s.safeX;
      s.py = s.safeY;
      s.vx = 0;
      s.vy = 0;
      s.hook = null;
      s.onGround = true;
    }
    return out;
  }

  // ---- 守卫巡逻 ----
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const speed = lv.enemySpeed * (e.kind === "flyer" ? 1.25 : 1);
    const next = patrolStep(e.x, e.dir, dt, speed, e.from, e.to);
    e.x = next.x;
    e.dir = next.dir;
    e.bob += dt * 3;
  }

  // ---- 回旋镖 ----
  if (s.boom) {
    s.boom.t += dt;
    const off = boomerangOffset(s.boom.t, s.boom.dir);
    const bx = s.boom.ox + off.x;
    const by = s.boom.oy + off.y;
    for (const e of s.enemies) {
      if (!e.alive) continue;
      // 守卫按整个身子判定:横向要挨着,纵向只要蹭到它 40 像素高的身体就算打中
      const ey = enemyY(e);
      if (Math.abs(bx - e.x) < BOOMERANG_HIT && by > ey - 52 && by < ey + 12) {
        e.alive = false;
        out.push({ kind: "enemyDown" });
      }
    }
    if (boomerangDone(s.boom.t)) s.boom = null;
  }

  // ---- 捡神器 ----
  for (const art of lv.artifacts) {
    if (s.got.has(art.kind)) continue;
    if (dist(s.px, s.py - PLAYER_H / 2, art.x, art.y) < 34) {
      s.got.add(art.kind);
      out.push({ kind: "artifact", artifact: art.kind, left: 3 - s.got.size });
    }
  }

  // ---- 撞守卫 ----
  const box = playerRect(s);
  if (s.invincible <= 0) {
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const ey = enemyY(e);
      if (rectsOverlap(box, { x: e.x - 20, y: ey - 40, w: 40, h: 40 })) {
        hurt(s, "被守卫撞到啦,先用回旋镖敲晕它!", out);
        break;
      }
    }
  }
  if (s.outcome !== "run") return out;

  // ---- 首领之门 ----
  if (rectsOverlap(box, { x: lv.door.x, y: lv.door.y - 76, w: 62, h: 76 })) {
    if (s.got.size >= 3) {
      s.outcome = "clear";
      out.push({ kind: "clear" });
    } else {
      out.push({ kind: "doorLocked", need: 3 - s.got.size });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 机器人试玩:单测用它证明每一关都真的能从头玩到尾
// ---------------------------------------------------------------------------

/** 站在(或即将踩到)哪块石台上 */
function platformAt(lv: AdvLevel, x: number): number {
  for (let i = 0; i < lv.platforms.length; i++) {
    const p = lv.platforms[i];
    if (x >= p.x - 20 && x <= p.x + p.w + 20) return i;
  }
  return -1;
}

/** 前方第一块还没走到的石台 */
function nextPlatform(lv: AdvLevel, x: number): number {
  for (let i = 0; i < lv.platforms.length; i++) {
    if (lv.platforms[i].x > x + 4) return i;
  }
  return -1;
}

interface BotMemory {
  throwCooldown: number;
  /**
   * 起跳/挂绳那一刻锁定的落点石台下标(-1 表示没锁定)。
   * 锁死目标是为了别在空中「改主意」:一旦飞过原目标的左沿,
   * 按当前位置重算出来的下一块石台会突然变成更远的那块,机器人就会一路冲过头掉坑。
   */
  landing: number;
  /** 原地不动了多久:卡住太久就别再谦让,直接顶着往前闯 */
  stuckSec: number;
  lastX: number;
  /** 在坑口等对岸守卫让路等了多久:等太久就硬着头皮过去 */
  waitSec: number;
}

export function createBotMemory(): BotMemory {
  return { throwCooldown: 0, landing: -1, stuckSec: 0, lastX: -1, waitSec: 0 };
}

/** 空中朝锁定的落点做微调:没到就往前推,冲过头就反推刹车,落点正上方就松手 */
function steerTo(input: RunInput, px: number, target: { x: number; w: number }): void {
  const left = target.x + Math.min(26, target.w * 0.3);
  const right = target.x + target.w - Math.min(26, target.w * 0.3);
  input.right = px < left;
  input.left = px > right;
}

/**
 * 一个「只会往右冲」的机器人:
 * 小坑走到边上就跳,宽裂口够得着藤环就荡,守卫挡路先扔回旋镖,
 * 落地时如果把神器落在身后就退回去捡。它能通关,说明关卡的路是通的。
 */
export function botInput(lv: AdvLevel, s: RunState, mem: BotMemory, dt: number): RunInput {
  const input = emptyInput();
  mem.throwCooldown = Math.max(0, mem.throwCooldown - dt);
  if (s.onGround) mem.landing = -1;
  mem.stuckSec = Math.abs(s.px - mem.lastX) < 1.2 ? mem.stuckSec + dt : 0;
  mem.lastX = s.px;
  const impatient = mem.stuckSec > 2.2;

  const here = platformAt(lv, s.px);
  const plat = here >= 0 ? lv.platforms[here] : null;

  // 落在身后的神器:站稳了就退回去捡,但绝不退出这块石台的左沿
  const behind = lv.artifacts.find(
    (a) => !s.got.has(a.kind) && a.x < s.px - 12 && Math.abs(a.y + 42 - s.py) < 8
  );
  if (behind && s.onGround && plat && s.px > plat.x + 22) {
    input.left = true;
    return input;
  }

  input.right = true;

  // 挡在前方的活守卫:够得着就先甩回旋镖,太近了别硬撞。
  // 人在空中往下落时,「同一高度」要放宽——落点上蹲着的守卫也得先敲掉。
  const band = 48;
  const threats = s.enemies.filter(
    (e) => e.alive && e.x - s.px > -24 && e.x - s.px < 290 && Math.abs(enemyY(e) - s.py) < band
  );
  const closest = threats.reduce((m, e) => Math.min(m, e.x - s.px), Infinity);
  let wantThrow = threats.length > 0 && !s.boom && mem.throwCooldown <= 0;

  if (!s.hook && s.onGround && closest < 155 && !impatient) {
    input.right = false;
    if (closest < 105 && plat) {
      if (plat.x + plat.w - s.px > 240) {
        // 前面还有一长段台面:直接从它头顶跳过去
        input.right = true;
        input.jump = true;
        mem.landing = here;
      } else if (s.px - 46 > plat.x) {
        // 退两步等回旋镖清场;这一帧不扔,免得朝向翻过来把镖往后甩
        input.left = true;
        wantThrow = false;
      }
    }
  }
  if (wantThrow) {
    // 出手这一帧必须朝着守卫:stepRun 是先按方向键改朝向、再出镖的,
    // 刚往后退过两步的话不推一下方向,镖会朝身后飞出去。
    input.right = true;
    input.left = false;
    input.throw = true;
    mem.throwCooldown = 0.15;
  }

  if (s.hook) {
    // 荡到落点石台的上方、速度也慢下来了,就松手让自己落下去
    const goal = mem.landing >= 0 ? lv.platforms[mem.landing] : null;
    const overGoal = goal && s.px > goal.x + 24 && s.px < goal.x + goal.w - 24;
    const far = s.px > s.hook.startX + 40;
    if (overGoal && goal && s.hook.age > 0.4 && s.py < goal.y - 6 && Math.abs(s.vx) < 110 && far) {
      input.hook = true;
    }
    return input;
  }

  // 空中:一路盯着起跳时锁定的那块石台,别改主意
  if (!s.onGround && mem.landing >= 0) {
    steerTo(input, s.px, lv.platforms[mem.landing]);
    return input;
  }
  if (!input.right || !plat || here < 0) return input;

  const nxt = nextPlatform(lv, s.px);
  if (nxt < 0) return input;
  const target = lv.platforms[nxt];
  const edge = plat.x + plat.w;
  const gap = target.x - edge;

  // 对岸的落脚处正站着守卫的话就在边上等一等,等它巡逻走开再过去;
  // 万一它就赖在那儿不走,等够 2.5 秒也得过,总不能一直站在坑口。
  const landingBusy = s.enemies.some(
    (e) => e.alive && Math.abs(e.x - (target.x + 46)) < 96 && Math.abs(enemyY(e) - target.y) < 62
  );
  mem.waitSec = landingBusy ? mem.waitSec + dt : 0;
  const holdBack = landingBusy && mem.waitSec < 2.5;

  if (s.onGround && here === nxt - 1 && !holdBack) {
    if (gap <= 150) {
      // 小坑:走到台子边缘再起跳,落点刚好在对岸台面上
      if (s.px >= edge - 14) {
        input.jump = true;
        mem.landing = nxt;
      }
    } else if (s.px >= edge - 30 && pickAnchor(lv.anchors, s.px, s.py - PLAYER_H * 0.6, ROPE_MAX, 1) >= 0) {
      // 尽量走到台子边上再挂:绳子短一点,一荡就能到对岸
      input.hook = true;
      mem.landing = nxt;
    }
  }
  // 提前一大截就收脚:跑起来有惯性,踩到坑口才刹车已经来不及了
  if (holdBack && s.onGround && s.px > edge - 70) input.right = false;
  return input;
}

export interface BotResult {
  outcome: "clear" | "fail" | "timeout";
  seconds: number;
  artifacts: number;
  hearts: number;
  hurts: number;
  x: number;
}

/** 让机器人把一关从头玩到尾;maxSec 是超时保护 */
export function botPlay(lv: AdvLevel, maxSec = 90, dt = 1 / 60): BotResult {
  const s = createRun(lv);
  const mem = createBotMemory();
  let t = 0;
  while (t < maxSec && s.outcome === "run") {
    stepRun(lv, s, botInput(lv, s, mem, dt), dt);
    t += dt;
  }
  return {
    outcome: s.outcome === "run" ? "timeout" : s.outcome,
    seconds: Math.round(t * 100) / 100,
    artifacts: s.got.size,
    hearts: s.hearts,
    hurts: s.hurts,
    x: Math.round(s.px),
  };
}
