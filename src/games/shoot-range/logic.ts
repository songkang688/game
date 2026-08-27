/**
 * 星星射击场 —— 弹道、命中判定、计分与评级的纯逻辑。
 *
 * 这里一行 DOM 都没有:关卡生成、弹道反解、扫掠命中、遮挡、编号顺序、
 * 连击倍率、命中率评级、靶潮波次、双人分屏比分全是纯函数,单测直接调。
 *
 * 分级约定(整份文件都遵守):靶子一律是同心圆靶 / 气球 / 飞碟 / 铁皮机器人 /
 * 举旗子的笑脸好人靶,没有人形敌人;打中的表现是「啵一声变彩纸」「摊手坐下」,
 * 没有血、没有伤、没有死亡描写,发射物统一叫「星星弹」。
 */

// ---------------------------------------------------------------------------
// 场地与常量
// ---------------------------------------------------------------------------

/** 靶场逻辑宽度(渲染时等比缩放到画布) */
export const FIELD_W = 1000;
/** 靶场逻辑高度 */
export const FIELD_H = 620;

/** 发射口位置:画面底部正中,略微在场地下面一点 */
export const MUZZLE_X = FIELD_W / 2;
export const MUZZLE_Y = FIELD_H + 20;

/** 星星弹出膛速度(逻辑单位 / 秒) */
export const SHOT_SPEED = 1500;
/** 星星弹的轻微下坠(逻辑单位 / 秒²),远处靶要抬一点点 */
export const SHOT_GRAVITY = 420;
/** 弹道推进步长(秒):足够细,1500 速度下每步只走 15 个单位 */
export const TRACE_DT = 0.01;
/** 弹道最长飞行时间(秒),超过就算飞出场地 */
export const TRACE_MAX_T = 1.2;

/** 准星可移动的区域(留边,免得贴边看不见) */
export const AIM_BOUNDS = { x0: 24, y0: 24, x1: FIELD_W - 24, y1: FIELD_H - 24 };

/** 键盘微调一次走多远 */
export const NUDGE_STEP = 26;

// ---------------------------------------------------------------------------
// 靶子
// ---------------------------------------------------------------------------

export type TargetKind =
  | "bull"
  | "balloon"
  | "ufo"
  | "robot"
  | "number"
  | "friend"
  // 1.2 补齐的四类(细则在 targets12.ts)
  | "split"
  | "shield"
  | "rainbow"
  | "flower";

/** 每种靶子的说明,给 HUD 与攻略用(不要出现任何真实武器或人形敌人) */
export const TARGET_INFO: Record<TargetKind, { name: string; emoji: string; desc: string }> = {
  bull: { name: "同心圆靶", emoji: "🎯", desc: "站着不动,越靠圆心分越高。" },
  balloon: { name: "彩色气球", emoji: "🎈", desc: "慢慢往上飘,打中会变成一把小彩纸。" },
  ufo: { name: "小飞碟", emoji: "🛸", desc: "左右横着飘,还会小幅上下晃。" },
  robot: { name: "铁皮机器人", emoji: "🤖", desc: "走来走去,被打中就摊手坐下休息。" },
  number: { name: "编号靶", emoji: "🔢", desc: "带号码,必须从 1 号按顺序打。" },
  friend: { name: "好人靶", emoji: "🙂", desc: "举着小旗子的笑脸靶,千万别打它。" },
  split: { name: "分裂靶", emoji: "🫧", desc: "打中会分成两个小的,小的还要再打一次。" },
  shield: { name: "护盾靶", emoji: "🛡️", desc: "外面罩着一层软壳,要打两次才倒。" },
  rainbow: { name: "彩虹靶", emoji: "🌈", desc: "只待几秒就走,越早打中分越高。" },
  flower: { name: "花朵靶", emoji: "🌸", desc: "朵朵种的花,打中要扣分,得忍住。" },
};

export interface Target {
  id: number;
  kind: TargetKind;
  x: number;
  y: number;
  /** 命中半径 */
  r: number;
  vx: number;
  vy: number;
  /** 编号靶的顺序号(1 基);其它靶子是 0 */
  order: number;
  /** 还立着没有 */
  alive: boolean;
  /** 摆动相位,让同批靶子不要整齐划一 */
  phase: number;
  /**
   * 以下四个是 1.2 追加的可选字段。故意不给默认值:不写进对象,
   * `JSON.stringify` 就看不见它们,前 99 关的关卡数据才能逐字节保持原样。
   */
  /** 护盾靶还剩几层壳(其余靶不写) */
  hp?: number;
  /** 还能待几秒(彩虹靶与无尽靶场的靶子会自己走掉) */
  ttl?: number;
  /** 远排靶:小一点、分数高一点(伪纵深) */
  far?: boolean;
  /** 分裂代数:0 是原靶,1 是分裂出来的小靶(小靶不再分裂) */
  gen?: number;
}

/** 遮挡木板:星星弹打在上面就停住 */
export interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function makeTarget(
  id: number,
  kind: TargetKind,
  x: number,
  y: number,
  r: number,
  extra: Partial<Pick<Target, "vx" | "vy" | "order" | "phase" | "hp" | "ttl" | "far" | "gen">> = {}
): Target {
  const t: Target = {
    id,
    kind,
    x,
    y,
    r,
    vx: extra.vx ?? 0,
    vy: extra.vy ?? 0,
    order: extra.order ?? 0,
    alive: true,
    phase: extra.phase ?? 0,
  };
  // 1.2 的可选字段只在真的用到时才写进去,老靶子的形状一个字节都不变
  if (extra.hp !== undefined) t.hp = extra.hp;
  if (extra.ttl !== undefined) t.ttl = extra.ttl;
  if (extra.far !== undefined) t.far = extra.far;
  if (extra.gen !== undefined) t.gen = extra.gen;
  return t;
}

/**
 * 靶子走一步(纯函数,返回新对象):
 * 气球一路往上飘,飘出顶就从底下重新升起;飞碟与机器人碰到左右边界回头。
 * 逻辑坐标是「y 越小越高」。
 */
export function stepTarget(t: Target, dt: number, bounds = { x0: 60, y0: 60, x1: FIELD_W - 60, y1: 480 }): Target {
  if (!t.alive) return t;
  let x = t.x + t.vx * dt;
  let y = t.y + t.vy * dt;
  let vx = t.vx;
  let vy = t.vy;
  const phase = t.phase + dt;

  if (t.kind === "balloon") {
    // 气球飘出顶部就回到底下重新升起,不会凭空消失
    if (y + t.r < bounds.y0) y = bounds.y1 + t.r;
    // 左右轻轻摇,幅度很小,不影响瞄准可读性
    x += Math.sin(phase * 1.6) * 14 * dt;
  }
  if (x - t.r < bounds.x0) {
    x = bounds.x0 + t.r;
    vx = Math.abs(vx);
  } else if (x + t.r > bounds.x1) {
    x = bounds.x1 - t.r;
    vx = -Math.abs(vx);
  }
  if (t.kind !== "balloon") {
    if (y - t.r < bounds.y0) {
      y = bounds.y0 + t.r;
      vy = Math.abs(vy);
    } else if (y + t.r > bounds.y1) {
      y = bounds.y1 - t.r;
      vy = -Math.abs(vy);
    }
  }
  return { ...t, x, y, vx, vy, phase };
}

// ---------------------------------------------------------------------------
// 弹道
// ---------------------------------------------------------------------------

export interface Shot {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  /** 这一发的重力(下坠),给测试留了可调口子 */
  g: number;
  /** 预计飞到准星要多久(秒) */
  flight: number;
}

/**
 * 反解出膛速度:让星星弹在 `flight` 秒后正好落在准星上。
 * 飞行时间取「直线距离 / 出膛速度」,再把下坠补偿回仰角里,
 * 所以玩家「瞄哪打哪」,远处的靶只是弹道更弯一点。
 */
export function aimToVelocity(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  speed = SHOT_SPEED,
  g = SHOT_GRAVITY
): Shot {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  const flight = Math.max(0.02, dist / Math.max(1, speed));
  return {
    x0: fromX,
    y0: fromY,
    vx: dx / flight,
    vy: (dy - 0.5 * g * flight * flight) / flight,
    g,
    flight,
  };
}

/** 星星弹在 t 秒时的位置 */
export function shotPoint(shot: Shot, t: number): { x: number; y: number } {
  return {
    x: shot.x0 + shot.vx * t,
    y: shot.y0 + shot.vy * t + 0.5 * shot.g * t * t,
  };
}

/**
 * 线段 AB 与圆(cx, cy, r)是否相交(扫掠命中判定的核心)。
 * 返回命中时的参数 u∈[0,1](最早接触点),不相交返回 null。
 */
export function segmentCircleHit(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number
): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;
  const a = dx * dx + dy * dy;
  if (a <= 1e-9) {
    return fx * fx + fy * fy <= r * r ? 0 : null;
  }
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const u1 = (-b - sq) / (2 * a);
  const u2 = (-b + sq) / (2 * a);
  if (u1 >= 0 && u1 <= 1) return u1;
  if (u2 >= 0 && u2 <= 1) return u2;
  // 线段整段都在圆里
  if (u1 < 0 && u2 > 1) return 0;
  return null;
}

/** 线段 AB 与矩形是否相交(遮挡木板判定),返回最早接触参数 u∈[0,1] */
export function segmentRectHit(ax: number, ay: number, bx: number, by: number, rect: Block): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - rect.x, rect.x + rect.w - ax, ay - rect.y, rect.y + rect.h - ay];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) {
      if (q[i] < 0) return null;
      continue;
    }
    const u = q[i] / p[i];
    if (p[i] < 0) {
      if (u > t1) return null;
      if (u > t0) t0 = u;
    } else {
      if (u < t0) return null;
      if (u < t1) t1 = u;
    }
  }
  return t0 <= t1 ? Math.max(0, t0) : null;
}

export interface TraceResult {
  /** 命中的靶子 id,没打中任何东西是 null */
  targetId: number | null;
  /** 被遮挡木板挡住了 */
  blocked: boolean;
  /** 命中点(或飞出场地前的最后一点) */
  x: number;
  y: number;
  /** 命中时刻(秒) */
  t: number;
  /** 命中点到靶心的距离,用来算环数;没命中是 Infinity */
  offset: number;
}

/**
 * 沿弹道一步步推进,先看遮挡再看靶子,取最早接触的那个。
 * 靶子在弹道推进期间当作静止(飞行时间只有零点几秒,肉眼看不出差别)。
 */
export function traceShot(
  shot: Shot,
  targets: readonly Target[],
  blocks: readonly Block[] = [],
  maxT = TRACE_MAX_T,
  dt = TRACE_DT
): TraceResult {
  let prev = shotPoint(shot, 0);
  for (let t = dt; t <= maxT + 1e-9; t += dt) {
    const cur = shotPoint(shot, t);

    let best: { u: number; target: Target | null } | null = null;
    for (const blk of blocks) {
      const u = segmentRectHit(prev.x, prev.y, cur.x, cur.y, blk);
      if (u !== null && (best === null || u < best.u)) best = { u, target: null };
    }
    for (const tgt of targets) {
      if (!tgt.alive) continue;
      const u = segmentCircleHit(prev.x, prev.y, cur.x, cur.y, tgt.x, tgt.y, tgt.r);
      if (u !== null && (best === null || u < best.u)) best = { u, target: tgt };
    }
    if (best) {
      const hx = prev.x + (cur.x - prev.x) * best.u;
      const hy = prev.y + (cur.y - prev.y) * best.u;
      const hitT = t - dt + dt * best.u;
      if (!best.target) {
        return { targetId: null, blocked: true, x: hx, y: hy, t: hitT, offset: Infinity };
      }
      return {
        targetId: best.target.id,
        blocked: false,
        x: hx,
        y: hy,
        t: hitT,
        offset: Math.hypot(hx - best.target.x, hy - best.target.y),
      };
    }

    // 飞出场地(左右或者上边)就不用再算了
    if (cur.x < -80 || cur.x > FIELD_W + 80 || cur.y < -120) {
      return { targetId: null, blocked: false, x: cur.x, y: cur.y, t, offset: Infinity };
    }
    prev = cur;
  }
  return { targetId: null, blocked: false, x: prev.x, y: prev.y, t: maxT, offset: Infinity };
}

// ---------------------------------------------------------------------------
// 计分
// ---------------------------------------------------------------------------

/** 同心圆靶环数:离圆心越近环数越高(10 / 8 / 6 / 4 环) */
export function ringScore(offset: number, radius: number): number {
  if (!(radius > 0)) return 4;
  const f = Math.max(0, offset) / radius;
  if (f <= 0.25) return 10;
  if (f <= 0.5) return 8;
  if (f <= 0.75) return 6;
  return 4;
}

/** 连击每连中一发涨多少倍率 */
export const COMBO_STEP = 0.1;
/** 涨到第几连就封顶(第 10 连之后再连也不涨,避免一局定胜负) */
export const COMBO_CAP_HITS = 10;
/** 倍率上限 */
export const COMBO_MAX_MULT = 1 + COMBO_CAP_HITS * COMBO_STEP;

/** 连击倍率:每连中一发 +0.1,最高 2.0 倍;失手由调用方清零 */
export function comboMultiplier(combo: number): number {
  const n = Math.max(0, Math.floor(combo));
  return 1 + Math.min(COMBO_CAP_HITS, n) * COMBO_STEP;
}

/** 打中好人靶的扣分(只扣分,不做任何受伤表现) */
export const FRIEND_PENALTY = 30;
/** 打中花朵靶的扣分(比好人靶轻一点:花能再开,但也是要忍住的) */
export const FLOWER_PENALTY = 25;

/** 一发命中的得分(好人靶 / 花朵靶返回负分) */
export function scoreForHit(kind: TargetKind, offset: number, radius: number, combo: number): number {
  if (kind === "friend") return -FRIEND_PENALTY;
  if (kind === "flower") return -FLOWER_PENALTY;
  const base =
    kind === "bull"
      ? ringScore(offset, radius) * 2
      : kind === "balloon"
        ? 14
        : kind === "ufo"
          ? 18
          : kind === "robot"
            ? 20
            : kind === "split"
              ? 12
              : kind === "shield"
                ? 26
                : kind === "rainbow"
                  ? 45
                  : 16;
  return Math.round(base * comboMultiplier(combo));
}

/** 命中率 0..1(一发没打是 0) */
export function accuracy(hits: number, shots: number): number {
  if (shots <= 0) return 0;
  return Math.max(0, Math.min(1, hits / shots));
}

export type Grade = "S" | "A" | "B" | "C";

/** 命中率评级 */
export function accuracyGrade(acc: number): Grade {
  if (acc >= 0.95) return "S";
  if (acc >= 0.8) return "A";
  if (acc >= 0.6) return "B";
  return "C";
}

/** 评级对应的一句夸奖(六年级口吻,不油腻) */
export function gradeWord(grade: Grade): string {
  return grade === "S"
    ? "发发进环,神准!"
    : grade === "A"
      ? "手很稳,再练练就满分。"
      : grade === "B"
        ? "节奏不错,注意别抢时间。"
        : "慢一点、稳一点,命中率立刻上来。";
}

export interface RoundStat {
  /** 开了几发 */
  shots: number;
  /** 打中(有效靶)几发 */
  hits: number;
  /** 剩下几个必须打掉的靶 */
  remaining: number;
  /** 误伤好人靶几次 */
  friendHits: number;
  /** 编号打错顺序几次 */
  orderMistakes: number;
  /** 打到花朵靶几次(1.2 新增,老调用方不传就是 0) */
  flowerHits?: number;
}

/** 「不许打的靶」一共碰了几次:好人靶 + 花朵靶 */
export function foulHits(stat: RoundStat): number {
  return stat.friendHits + (stat.flowerHits ?? 0);
}

/**
 * 关卡星级:先看有没有清完靶,再看命中率,最后看有没有犯规。
 * 没清完靶一律算没过关(由调用方判 lose),这里只负责给过关时的星数。
 */
export function starsForRound(stat: RoundStat): 1 | 2 | 3 {
  const acc = accuracy(stat.hits, stat.shots);
  const fouls = foulHits(stat);
  const clean = fouls === 0 && stat.orderMistakes === 0;
  if (clean && acc >= 0.9) return 3;
  if (acc >= 0.7 && fouls === 0) return 2;
  return 1;
}

/** 关卡结算文案 */
export function roundMessage(stat: RoundStat): string {
  const acc = accuracy(stat.hits, stat.shots);
  const grade = accuracyGrade(acc);
  const pct = Math.round(acc * 100);
  const flowers = stat.flowerHits ?? 0;
  const extra =
    stat.friendHits > 0
      ? `不过好人靶被碰到 ${stat.friendHits} 次,下次看清旗子再打。`
      : flowers > 0
        ? `花朵靶碰到 ${flowers} 次,忍住不打才是真本事。`
        : stat.orderMistakes > 0
          ? `编号乱了 ${stat.orderMistakes} 次,记得从 1 号开始数。`
          : "";
  return `命中率 ${pct}%,评级 ${grade}。${gradeWord(grade)}${extra}`;
}

// ---------------------------------------------------------------------------
// 星星弹夹与换弹节奏
// ---------------------------------------------------------------------------

export interface Gun {
  /** 弹夹里还剩几发 */
  mag: number;
  /** 弹夹容量 */
  magSize: number;
  /** 正在换弹时的剩余秒数,0 表示可以打 */
  reloadLeft: number;
  /** 换一次弹要几秒 */
  reloadTime: number;
  /** 两发之间的最短间隔(秒) */
  cooldown: number;
  /** 距离下一发还要等几秒 */
  cooldownLeft: number;
}

export function makeGun(magSize = 6, reloadTime = 1.1, cooldown = 0.16): Gun {
  return { mag: magSize, magSize, reloadLeft: 0, reloadTime, cooldown, cooldownLeft: 0 };
}

/** 现在能不能开火 */
export function canFire(gun: Gun): boolean {
  return gun.mag > 0 && gun.reloadLeft <= 0 && gun.cooldownLeft <= 0;
}

/** 开一发(不能开火时原样返回,由调用方判断 fired) */
export function fireGun(gun: Gun): { gun: Gun; fired: boolean } {
  if (!canFire(gun)) return { gun, fired: false };
  const mag = gun.mag - 1;
  return {
    gun: { ...gun, mag, cooldownLeft: gun.cooldown, reloadLeft: mag <= 0 ? gun.reloadTime : 0 },
    fired: true,
  };
}

/** 主动换弹(弹夹满或者正在换就没反应) */
export function startReload(gun: Gun): Gun {
  if (gun.reloadLeft > 0 || gun.mag >= gun.magSize) return gun;
  return { ...gun, reloadLeft: gun.reloadTime };
}

/** 时间推进:换弹倒计时走完就自动装满 */
export function stepGun(gun: Gun, dt: number): Gun {
  const cooldownLeft = Math.max(0, gun.cooldownLeft - dt);
  if (gun.reloadLeft <= 0) return { ...gun, cooldownLeft };
  const reloadLeft = gun.reloadLeft - dt;
  if (reloadLeft <= 0) return { ...gun, mag: gun.magSize, reloadLeft: 0, cooldownLeft };
  return { ...gun, reloadLeft, cooldownLeft };
}

// ---------------------------------------------------------------------------
// 编号靶顺序
// ---------------------------------------------------------------------------

/** 下一个该打的编号(全打完返回 0) */
export function nextOrder(targets: readonly Target[]): number {
  let min = 0;
  for (const t of targets) {
    if (!t.alive || t.kind !== "number") continue;
    if (min === 0 || t.order < min) min = t.order;
  }
  return min;
}

/** 打中的这个编号靶是不是打错顺序了 */
export function isOrderViolation(targets: readonly Target[], hit: Target): boolean {
  if (hit.kind !== "number") return false;
  const want = nextOrder(targets);
  return want !== 0 && hit.order !== want;
}

// ---------------------------------------------------------------------------
// 准星微调 / 键位
// ---------------------------------------------------------------------------

export interface Aim {
  x: number;
  y: number;
}

/** 键盘微调准星,自动夹在场地里 */
export function nudgeAim(aim: Aim, dx: number, dy: number, bounds = AIM_BOUNDS): Aim {
  return {
    x: Math.max(bounds.x0, Math.min(bounds.x1, aim.x + dx)),
    y: Math.max(bounds.y0, Math.min(bounds.y1, aim.y + dy)),
  };
}

export type RangeAction = "left" | "right" | "up" | "down" | "fire" | "reload";

/** 双人键位:朵朵 W A S D + F(开火)/G(换弹),星星 ↑←↓→ + L(开火)/K(换弹) */
export const KEY_MAP: Record<string, { player: 0 | 1; action: RangeAction }> = {
  KeyW: { player: 0, action: "up" },
  KeyA: { player: 0, action: "left" },
  KeyS: { player: 0, action: "down" },
  KeyD: { player: 0, action: "right" },
  KeyF: { player: 0, action: "fire" },
  KeyG: { player: 0, action: "reload" },
  ArrowUp: { player: 1, action: "up" },
  ArrowLeft: { player: 1, action: "left" },
  ArrowDown: { player: 1, action: "down" },
  ArrowRight: { player: 1, action: "right" },
  KeyL: { player: 1, action: "fire" },
  KeyK: { player: 1, action: "reload" },
};

/** 键盘 code 翻译成「几号玩家的哪个动作」;单人时两套键位都归 0 号 */
export function keyToAction(code: string, playerCount: number): { player: number; action: RangeAction } | null {
  const hit = KEY_MAP[code];
  if (!hit) return null;
  return { player: playerCount <= 1 ? 0 : hit.player, action: hit.action };
}

/** Esc 暂停 */
export function isPauseKey(code: string): boolean {
  return code === "Escape";
}

// ---------------------------------------------------------------------------
// 无尽靶潮
// ---------------------------------------------------------------------------

export interface TideWave {
  /** 这一波放几个靶 */
  count: number;
  /** 移动速度倍率 */
  speed: number;
  /** 这一波会出现的靶子种类 */
  kinds: TargetKind[];
  /** 混进好人靶的概率 0..1 */
  friendChance: number;
  /** 这一波的限时(秒) */
  seconds: number;
}

/** 无尽模式第 wave 波(1 基)的强度 */
export function tideWave(wave: number): TideWave {
  const w = Math.max(1, Math.floor(wave));
  const kinds: TargetKind[] = ["bull"];
  if (w >= 2) kinds.push("balloon");
  if (w >= 4) kinds.push("ufo");
  if (w >= 6) kinds.push("robot");
  return {
    count: Math.min(12, 3 + Math.floor(w / 2)),
    speed: Math.min(2.4, 1 + w * 0.08),
    kinds,
    friendChance: w >= 5 ? Math.min(0.3, 0.06 * (w - 4)) : 0,
    seconds: Math.max(9, 16 - Math.floor(w / 3)),
  };
}

/** 无尽成绩:清掉的靶数 × 10 + 波数 × 25,再乘命中率加成 */
export function tideScore(cleared: number, wave: number, acc: number): number {
  const bonus = 1 + Math.max(0, Math.min(1, acc)) * 0.5;
  return Math.round((cleared * 10 + Math.max(0, wave - 1) * 25) * bonus);
}

// ---------------------------------------------------------------------------
// 双人分屏对战
// ---------------------------------------------------------------------------

export interface DuelSide {
  name: string;
  hits: number;
  shots: number;
  friendHits: number;
}

export interface DuelResult {
  /** 0 = 朵朵赢,1 = 星星赢,-1 = 平手 */
  winner: number;
  accA: number;
  accB: number;
  line: string;
}

/**
 * 分屏对战判定:先比命中率,命中率一样比命中数,还一样才算平手。
 * 误打好人靶按「少算一发命中」处理,不做任何惩罚性表现。
 */
export function duelResult(a: DuelSide, b: DuelSide): DuelResult {
  const scoreOf = (s: DuelSide): number => accuracy(Math.max(0, s.hits - s.friendHits), s.shots);
  const accA = scoreOf(a);
  const accB = scoreOf(b);
  let winner = -1;
  if (Math.abs(accA - accB) > 1e-6) winner = accA > accB ? 0 : 1;
  else if (a.hits !== b.hits) winner = a.hits > b.hits ? 0 : 1;
  const pa = Math.round(accA * 100);
  const pb = Math.round(accB * 100);
  const line =
    winner === -1
      ? `${pa}% 对 ${pb}%,打成平手,再来一局!`
      : `${winner === 0 ? a.name : b.name}赢啦!命中率 ${pa}% 对 ${pb}%。`;
  return { winner, accA, accB, line };
}
