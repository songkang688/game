/**
 * 朵星台球 · 自写 2D 圆碰撞物理（不引入任何物理引擎依赖）。
 *
 * 全部核心是纯函数：给进去一份球的数组，还回来一份新的球的数组 + 这一小步里发生的事件。
 * 单位是「台面单位」，不是像素：台面 200 × 100，画的时候再整体缩放，
 * 这样竖屏横屏、360px 还是宽屏，跑的都是同一套数。
 *
 * 三条自己定的简化，写在这里省得以后翻代码猜：
 *  1. 所有球等质量，球球碰撞只沿法线交换冲量，切向不管（不做摩擦扭矩）；
 *  2. 库边按「入射角 = 反射角」镜像，能量按同一个系数衰减两个分量，
 *     所以镜像瞄准（把目标点对着库边翻过去）是精确成立的，库边球才好教也好算；
 *  3. 旋转只做上下旋：母球碰到第一颗球之后，沿原方向补一点（跟进）或减一点（拉杆）。
 */

export interface Vec {
  x: number;
  y: number;
}

/** cue = 母球，warm = 暖色组，cool = 冷色组，black = 黑星球 */
export type BallKind = "cue" | "warm" | "cool" | "black";

export interface Ball {
  id: number;
  kind: BallKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 上下旋：正数跟进、负数拉杆，碰到第一颗球时用掉 */
  spin: number;
  potted: boolean;
  /** 落袋编号（没进是 -1），画入袋动画用 */
  pocket: number;
}

export interface TableSpec {
  /** 台面长（母球从左半区开球） */
  w: number;
  /** 台面宽 */
  h: number;
  /** 球半径 */
  r: number;
  /** 袋口吸入半径 */
  pocketR: number;
}

export const TABLE: TableSpec = { w: 200, h: 100, r: 2.6, pocketR: 5.2 };

/** 六个袋口：四个角 + 两个中袋 */
export const POCKETS: readonly Vec[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 200, y: 0 },
  { x: 0, y: 100 },
  { x: 100, y: 100 },
  { x: 200, y: 100 },
];

/** 力度拉满时母球的初速度（台面单位 / 秒） */
export const MAX_SPEED = 420;
/** 力度最小档也要能推得动 */
export const MIN_SPEED = 34;
/** 台呢摩擦：每秒减多少速度 */
export const FRICTION = 150;
/** 慢到这个速度就当停了 */
export const STOP_SPEED = 2.2;
/** 库边保留多少能量 */
export const CUSHION_KEEP = 0.86;
/** 球球碰撞的恢复系数（1 = 完全弹性） */
export const BALL_KEEP = 0.96;
/** 上下旋在第一次碰撞后给母球补的速度比例 */
export const SPIN_KICK = 0.32;
/** 推演一杆最多跑多少秒，防止极端情况下算不完 */
export const MAX_SHOT_SECONDS = 26;
/** 推演用的固定步长 */
export const FIXED_DT = 1 / 120;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function speedOf(b: { vx: number; vy: number }): number {
  return Math.hypot(b.vx, b.vy);
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 造一颗静止的球 */
export function makeBall(id: number, kind: BallKind, x: number, y: number): Ball {
  return { id, kind, x, y, vx: 0, vy: 0, spin: 0, potted: false, pocket: -1 };
}

export function cloneBall(b: Ball): Ball {
  return { ...b };
}

export function cloneBalls(balls: readonly Ball[]): Ball[] {
  return balls.map(cloneBall);
}

// ---------------------------------------------------------------------------
// 击打
// ---------------------------------------------------------------------------

/**
 * 给母球一记冲量：方向 angleRad（0 = 朝右，顺时针为正，和 canvas 一致）、
 * 力度 power（0..1，会被夹住）、上下旋 spin（-1..1）。
 */
export function strike(cue: Ball, angleRad: number, power: number, spin = 0): Ball {
  const p = clamp(Number.isFinite(power) ? power : 0, 0, 1);
  const speed = MIN_SPEED + p * (MAX_SPEED - MIN_SPEED);
  return {
    ...cue,
    vx: Math.cos(angleRad) * speed,
    vy: Math.sin(angleRad) * speed,
    spin: clamp(Number.isFinite(spin) ? spin : 0, -1, 1),
  };
}

// ---------------------------------------------------------------------------
// 圆碰撞
// ---------------------------------------------------------------------------

/**
 * 两颗等质量球的碰撞：沿法线交换冲量（动量严格守恒，能量按 BALL_KEEP 损耗），
 * 顺手把重叠推开一点，免得两颗球黏在一起抖。
 * 正在分开的两颗球原样返回。
 */
export function collideBalls(a: Ball, b: Ball, r = TABLE.r): [Ball, Ball] {
  let nx = b.x - a.x;
  let ny = b.y - a.y;
  let d = Math.hypot(nx, ny);
  if (d === 0) {
    // 完全重合时随便挑一个方向推开，不然算不出法线
    nx = 1;
    ny = 0;
    d = 1e-6;
  }
  nx /= d;
  ny /= d;

  const na = { ...a };
  const nb = { ...b };

  // 先把重叠分开，两边各退一半
  const overlap = 2 * r - d;
  if (overlap > 0) {
    na.x -= (nx * overlap) / 2;
    na.y -= (ny * overlap) / 2;
    nb.x += (nx * overlap) / 2;
    nb.y += (ny * overlap) / 2;
  }

  // 法线方向的接近速度；<= 0 说明在分开，不再给冲量
  const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (vn <= 0) return [na, nb];

  const j = ((1 + BALL_KEEP) * vn) / 2;
  na.vx -= j * nx;
  na.vy -= j * ny;
  nb.vx += j * nx;
  nb.vy += j * ny;
  return [na, nb];
}

// ---------------------------------------------------------------------------
// 库边
// ---------------------------------------------------------------------------

/**
 * 库边反弹：入射角 = 反射角，两个分量一起按 CUSHION_KEEP 衰减，
 * 所以「把目标点对着库边镜像过去再瞄」是精确的。返回是否真的碰到了库。
 */
export function bounceCushion(ball: Ball, table: TableSpec = TABLE): { ball: Ball; hit: boolean } {
  const r = table.r;
  const nb = { ...ball };
  let hit = false;

  if (nb.x < r) {
    nb.x = r + (r - nb.x);
    nb.vx = -nb.vx;
    hit = true;
  } else if (nb.x > table.w - r) {
    const edge = table.w - r;
    nb.x = edge - (nb.x - edge);
    nb.vx = -nb.vx;
    hit = true;
  }
  if (nb.y < r) {
    nb.y = r + (r - nb.y);
    nb.vy = -nb.vy;
    hit = true;
  } else if (nb.y > table.h - r) {
    const edge = table.h - r;
    nb.y = edge - (nb.y - edge);
    nb.vy = -nb.vy;
    hit = true;
  }

  if (hit) {
    nb.vx *= CUSHION_KEEP;
    nb.vy *= CUSHION_KEEP;
    // 极端速度下镜像一次还可能落在台外，兜底夹回台面（绝不让球穿出去）
    nb.x = clamp(nb.x, r, table.w - r);
    nb.y = clamp(nb.y, r, table.h - r);
  }
  return { ball: nb, hit };
}

// ---------------------------------------------------------------------------
// 入袋
// ---------------------------------------------------------------------------

/** 球心落进哪个袋口的吸入半径就算进哪个袋；没进返回 -1 */
export function pocketed(ball: Vec, pockets: readonly Vec[] = POCKETS, pocketR = TABLE.pocketR): number {
  for (let i = 0; i < pockets.length; i++) {
    if (dist(ball, pockets[i]) <= pocketR) return i;
  }
  return -1;
}

/** 袋口豁口的半宽：真球台的库边在袋口是切开的，贴着库边滚进豁口的球会掉下去 */
export const POCKET_MOUTH = 7;

/**
 * 推演时用的落袋判定：吸入半径之内直接算进；
 * 另外，球贴到库边、而且横向正好落在某个袋口的豁口里，也顺着豁口掉进去
 * （不然沿着库边滚向角袋的球会先撞到库边被弹回来，角袋等于打不进）。
 */
export function pocketCapture(p: Vec, table: TableSpec = TABLE): number {
  const direct = pocketed(p, POCKETS, table.pocketR);
  if (direct >= 0) return direct;
  const atLeft = p.x < table.r;
  const atRight = p.x > table.w - table.r;
  const atTop = p.y < table.r;
  const atBottom = p.y > table.h - table.r;
  if (!atLeft && !atRight && !atTop && !atBottom) return -1;
  for (let i = 0; i < POCKETS.length; i++) {
    const k = POCKETS[i];
    if ((atLeft && k.x === 0) || (atRight && k.x === table.w)) {
      if (Math.abs(p.y - k.y) <= POCKET_MOUTH) return i;
    }
    if ((atTop && k.y === 0) || (atBottom && k.y === table.h)) {
      if (Math.abs(p.x - k.x) <= POCKET_MOUTH) return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// 一小步
// ---------------------------------------------------------------------------

export type StepEventType = "hit" | "cushion" | "pot";

export interface StepEvent {
  type: StepEventType;
  id: number;
  kind: BallKind;
  /** hit 事件里被撞的那颗 */
  other?: number;
  otherKind?: BallKind;
  /** pot 事件的袋号 */
  pocket?: number;
}

export interface StepOut {
  balls: Ball[];
  events: StepEvent[];
  /** 还有球在动吗 */
  moving: boolean;
}

/** 这一步要切成几个子步：保证任何一颗球单个子步走的距离都小于半个球半径 */
export function substepCount(maxSpeed: number, dt: number, r = TABLE.r): number {
  const travel = maxSpeed * dt;
  const limit = r * 0.5;
  return clamp(Math.ceil(travel / limit), 1, 512);
}

/**
 * 推进 dt 秒。内部按 substepCount 切子步，
 * 子步位移永远小于半个球半径，所以高速球既不会穿库边、也不会穿过另一颗球或袋口。
 */
export function stepWorld(balls: readonly Ball[], dt: number, table: TableSpec = TABLE): StepOut {
  const out = cloneBalls(balls);
  const events: StepEvent[] = [];
  let maxSpeed = 0;
  for (const b of out) {
    if (!b.potted) maxSpeed = Math.max(maxSpeed, speedOf(b));
  }
  if (maxSpeed <= 0) return { balls: out, events, moving: false };

  const steps = substepCount(maxSpeed, dt, table.r);
  const h = dt / steps;

  for (let s = 0; s < steps; s++) {
    // 1. 走一小步
    for (const b of out) {
      if (b.potted) continue;
      b.x += b.vx * h;
      b.y += b.vy * h;
    }

    // 2. 先看袋口，再看库边（袋口比库边优先，不然角袋边上的球会被弹出来）
    //    停着的球既进不了袋也碰不到库，直接跳过，省下大量无用判断
    for (const b of out) {
      if (b.potted || (b.vx === 0 && b.vy === 0)) continue;
      const p = pocketCapture(b, table);
      if (p >= 0) {
        b.potted = true;
        b.pocket = p;
        b.vx = 0;
        b.vy = 0;
        b.spin = 0;
        events.push({ type: "pot", id: b.id, kind: b.kind, pocket: p });
        continue;
      }
      const res = bounceCushion(b, table);
      if (res.hit) {
        b.x = res.ball.x;
        b.y = res.ball.y;
        b.vx = res.ball.vx;
        b.vy = res.ball.vy;
        events.push({ type: "cushion", id: b.id, kind: b.kind });
      }
    }

    // 3. 球球碰撞
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      if (a.potted) continue;
      for (let k = i + 1; k < out.length; k++) {
        const b = out[k];
        if (b.potted) continue;
        // 两颗都停着就不可能是新发生的碰撞
        if (a.vx === 0 && a.vy === 0 && b.vx === 0 && b.vy === 0) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d >= 2 * table.r) continue;
        const before = { ax: a.vx, ay: a.vy, bx: b.vx, by: b.vy };
        // 先沿相对速度倒回到刚好接触的那一刻再算法线：
        // 不倒回的话，子步跨过去多少就偏多少角度，几十单位外的球就会瞄歪一两度
        const back = contactBacktrack(a, b, table.r);
        if (back > 0) {
          a.x -= a.vx * back;
          a.y -= a.vy * back;
          b.x -= b.vx * back;
          b.y -= b.vy * back;
        }
        const [na, nb] = collideBalls(a, b, table.r);
        Object.assign(a, na);
        Object.assign(b, nb);
        const responded =
          a.vx !== before.ax || a.vy !== before.ay || b.vx !== before.bx || b.vy !== before.by;
        if (!responded) continue;
        events.push({ type: "hit", id: a.id, kind: a.kind, other: b.id, otherKind: b.kind });
        // 上下旋：母球碰到第一颗球时沿原方向补一点（跟进）或减一点（拉杆）
        applySpin(a, before.ax, before.ay);
        applySpin(b, before.bx, before.by);
        if (back > 0) {
          // 把刚才倒回去的那一点时间用新速度补回来
          a.x += a.vx * back;
          a.y += a.vy * back;
          b.x += b.vx * back;
          b.y += b.vy * back;
        }
      }
    }

    // 4. 摩擦
    for (const b of out) {
      if (b.potted) continue;
      const sp = speedOf(b);
      if (sp <= 0) continue;
      const next = sp - FRICTION * h;
      if (next <= STOP_SPEED) {
        b.vx = 0;
        b.vy = 0;
        b.spin = 0;
      } else {
        b.vx = (b.vx / sp) * next;
        b.vy = (b.vy / sp) * next;
      }
    }
  }

  let moving = false;
  for (const b of out) {
    if (!b.potted && speedOf(b) > 0) {
      moving = true;
      break;
    }
  }
  return { balls: out, events, moving };
}

/**
 * 两颗球已经重叠了，沿相对速度倒回多少秒才刚好是「碰到」的那一刻。
 * 解 |Δp − Δv·t| = 2r，取最小的非负根；解不出来就返回 0（退回原来的近似）。
 */
export function contactBacktrack(a: Ball, b: Ball, r = TABLE.r): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rvx = a.vx - b.vx;
  const rvy = a.vy - b.vy;
  const A = rvx * rvx + rvy * rvy;
  if (A <= 1e-12) return 0;
  const B = -2 * (dx * rvx + dy * rvy);
  const C = dx * dx + dy * dy - 4 * r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return 0;
  const root = Math.sqrt(disc);
  const t1 = (-B - root) / (2 * A);
  const t2 = (-B + root) / (2 * A);
  const cands = [t1, t2].filter((t) => t >= 0).sort((x, y) => x - y);
  return cands.length > 0 ? cands[0] : 0;
}

function applySpin(b: Ball, preVx: number, preVy: number): void {
  if (b.spin === 0) return;
  const sp = Math.hypot(preVx, preVy);
  if (sp <= 0) {
    b.spin = 0;
    return;
  }
  b.vx += (preVx / sp) * sp * SPIN_KICK * b.spin;
  b.vy += (preVy / sp) * sp * SPIN_KICK * b.spin;
  b.spin = 0;
}

// ---------------------------------------------------------------------------
// 一杆推演
// ---------------------------------------------------------------------------

export interface PottedBall {
  id: number;
  kind: BallKind;
  pocket: number;
}

export interface ShotResult {
  /** 全部球停下来之后的样子 */
  balls: Ball[];
  events: StepEvent[];
  /** 母球第一颗碰到的球是什么组；空杆是 null */
  firstHit: BallKind | null;
  firstHitId: number | null;
  potted: PottedBall[];
  /** 母球碰到第一颗球之前先吃了库 */
  cushionBeforeContact: boolean;
  /** 母球碰到第一颗球之后，有没有球再吃过库（开球合法性的另一种口径） */
  cushionAfterContact: boolean;
  /** 母球有没有越过中线（开球判定用） */
  cueCrossedCenter: boolean;
  /** 一共推了多少个固定步 */
  steps: number;
}

export interface SimOptions {
  table?: TableSpec;
  dt?: number;
  maxSeconds?: number;
}

/** 把一杆从击球到全部停下推演完，返回结果与事件流 */
export function simulateShot(state: { balls: readonly Ball[] }, opts: SimOptions = {}): ShotResult {
  const table = opts.table ?? TABLE;
  const dt = opts.dt ?? FIXED_DT;
  const maxSteps = Math.ceil((opts.maxSeconds ?? MAX_SHOT_SECONDS) / dt);

  let balls = cloneBalls(state.balls);
  const events: StepEvent[] = [];
  const cue = balls.find((b) => b.kind === "cue");
  const startedLeft = cue ? cue.x < table.w / 2 : true;
  let crossed = false;
  let steps = 0;

  for (; steps < maxSteps; steps++) {
    const out = stepWorld(balls, dt, table);
    balls = out.balls;
    for (const ev of out.events) events.push(ev);
    const c = balls.find((b) => b.kind === "cue");
    if (c && !c.potted) {
      if (startedLeft ? c.x > table.w / 2 : c.x < table.w / 2) crossed = true;
    }
    if (!out.moving) break;
  }

  let firstHit: BallKind | null = null;
  let firstHitId: number | null = null;
  let cushionBeforeContact = false;
  let cushionAfterContact = false;
  let contacted = false;
  const potted: PottedBall[] = [];

  for (const ev of events) {
    if (ev.type === "pot") {
      potted.push({ id: ev.id, kind: ev.kind, pocket: ev.pocket ?? -1 });
      continue;
    }
    if (ev.type === "cushion") {
      if (!contacted && ev.kind === "cue") cushionBeforeContact = true;
      if (contacted) cushionAfterContact = true;
      continue;
    }
    // hit
    if (!contacted && (ev.kind === "cue" || ev.otherKind === "cue")) {
      contacted = true;
      if (ev.kind === "cue") {
        firstHit = ev.otherKind ?? null;
        firstHitId = ev.other ?? null;
      } else {
        firstHit = ev.kind;
        firstHitId = ev.id;
      }
    }
  }

  return {
    balls,
    events,
    firstHit,
    firstHitId,
    potted,
    cushionBeforeContact,
    cushionAfterContact,
    cueCrossedCenter: crossed,
    steps,
  };
}

// ---------------------------------------------------------------------------
// 瞄准辅助（视图与电脑球手共用的几何）
// ---------------------------------------------------------------------------

/** 想让 target 走向 to，母球要撞的那个「假想球点」 */
export function ghostPoint(target: Vec, to: Vec, r = TABLE.r): Vec {
  const dx = target.x - to.x;
  const dy = target.y - to.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: target.x + (dx / d) * 2 * r, y: target.y + (dy / d) * 2 * r };
}

/** 把一个点对着某条库边镜像过去（库边球的瞄准点） */
export function mirrorPoint(p: Vec, side: "left" | "right" | "top" | "bottom", table: TableSpec = TABLE): Vec {
  const r = table.r;
  if (side === "left") return { x: 2 * r - p.x, y: p.y };
  if (side === "right") return { x: 2 * (table.w - r) - p.x, y: p.y };
  if (side === "top") return { x: p.x, y: 2 * r - p.y };
  return { x: p.x, y: 2 * (table.h - r) - p.y };
}

export function angleTo(from: Vec, to: Vec): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** 线段 from→to 上有没有别的球挡路（不算 ignore 里的） */
export function pathClear(
  from: Vec,
  to: Vec,
  balls: readonly Ball[],
  ignore: readonly number[] = [],
  r = TABLE.r
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return true;
  const ux = dx / len;
  const uy = dy / len;
  for (const b of balls) {
    if (b.potted || ignore.includes(b.id)) continue;
    const t = (b.x - from.x) * ux + (b.y - from.y) * uy;
    if (t <= 0 || t >= len) continue;
    const px = from.x + ux * t;
    const py = from.y + uy * t;
    if (Math.hypot(b.x - px, b.y - py) < 2 * r * 0.98) return false;
  }
  return true;
}

/** 台面上这个位置放得下一颗球吗（在台内、不压袋口、不和别的球重叠） */
export function spotFree(
  pos: Vec,
  balls: readonly Ball[],
  table: TableSpec = TABLE,
  ignore: readonly number[] = []
): boolean {
  if (pos.x < table.r || pos.x > table.w - table.r) return false;
  if (pos.y < table.r || pos.y > table.h - table.r) return false;
  if (pocketed(pos, POCKETS, table.pocketR + table.r * 0.4) >= 0) return false;
  for (const b of balls) {
    if (b.potted || ignore.includes(b.id)) continue;
    if (dist(pos, b) < 2 * table.r + 0.3) return false;
  }
  return true;
}
