/**
 * 雪球大作战 · 一局的规则(纯逻辑,不碰 DOM)。
 *
 * 一局是回合制的:轮到谁,谁就定角度、定力度、看风标,然后把雪球扔出去。
 * 雪球飞出去之后按 physics.ts 的抛物线走,路上会碰到三种东西:
 *   掩体(冰砖矮墙 / 自己堆的雪墙)—— 砸几下会碎;
 *   靶子(雪灯笼 / 雪怪)—— 砸中就化成一摊雪;
 *   对手 —— 砸中只是「变成雪人」歇一回合,一点都不疼。
 *
 * 全程没有血量、没有受伤:雪怪化成雪堆,人变成雪人,笑一笑接着玩。
 */
import {
  AI_PROFILES,
  FIELD_W,
  GROUND_Y,
  aiAim,
  clamp,
  flightTime,
  positionAt,
  solvePower,
  type AiLevel,
  type ThrowSpec,
  type Vec,
} from "./physics";

export type SnowMode = "campaign" | "versus" | "ai" | "endless";

/** 雪球半径 */
export const BALL_R = 0.55;
/** 站着的人的碰撞半径 */
export const BODY_R = 1.4;
/** 雪怪越过这条线,这一关就结束(它会把雪堡的灯笼推倒) */
export const GUARD_X = 12;
/** 一堵雪墙的默认耐久 */
export const SNOW_WALL_HP = 2;
/** 雪墙的默认尺寸 */
export const SNOW_WALL_W = 2.2;
export const SNOW_WALL_H = 4;

export interface Cover {
  id: number;
  /** 左边缘 */
  x: number;
  w: number;
  /** 从地面往上的高度 */
  h: number;
  hp: number;
  maxHp: number;
  kind: "ice" | "snow";
}

export type TargetKind = "lantern" | "monster";

export interface Target {
  id: number;
  kind: TargetKind;
  /** 站桩位置;左右滑动的靶子会绕着它晃 */
  homeX: number;
  x: number;
  y: number;
  r: number;
  /** 归谁(对战用),-1 表示中立 */
  owner: number;
  melted: boolean;
  /** 左右滑动的幅度,0 表示不动 */
  sway: number;
  swaySpeed: number;
  phase: number;
  /** 雪怪每回合往左挪多少 */
  march: number;
}

export interface Thrower {
  id: number;
  /** 0 = 朵朵,1 = 星星 / 电脑 */
  seat: number;
  x: number;
  y: number;
  dir: 1 | -1;
  /** 剩余雪球,-1 表示无限 */
  balls: number;
  /** 还能堆几堵雪墙 */
  walls: number;
  /** 变雪人还要歇几回合 */
  frozen: number;
  /** 被砸中过几次(只做统计) */
  bumps: number;
  /** 电脑控制的话是哪一档 */
  ai: AiLevel | null;
}

export interface Match {
  mode: SnowMode;
  wind: number;
  /** 每一投之后换到的风,循环使用;长度 1 就是全程一个风 */
  windPlan: number[];
  /** 已经投了几次(堆雪墙也算一次) */
  shots: number;
  /** 最多投几次(超过就按现有战果判) */
  maxShots: number;
  covers: Cover[];
  targets: Target[];
  throwers: Thrower[];
  turn: number;
  status: "playing" | "win" | "lose";
  winner: number;
  reason: string;
  wave: number;
  melted: number;
  nextId: number;
}

// ---------------------------------------------------------------------------
// 键位:朵朵 WASD + F/G,星星 方向键 + L/K,Esc 暂停
// ---------------------------------------------------------------------------

export type SnowAction = "up" | "down" | "left" | "right" | "throw" | "wall";

export interface SnowBind {
  player: 0 | 1;
  action: SnowAction;
}

export const KEY_MAP: Readonly<Record<string, SnowBind>> = {
  KeyW: { player: 0, action: "up" },
  KeyS: { player: 0, action: "down" },
  KeyA: { player: 0, action: "left" },
  KeyD: { player: 0, action: "right" },
  KeyF: { player: 0, action: "throw" },
  KeyG: { player: 0, action: "wall" },
  ArrowUp: { player: 1, action: "up" },
  ArrowDown: { player: 1, action: "down" },
  ArrowLeft: { player: 1, action: "left" },
  ArrowRight: { player: 1, action: "right" },
  KeyL: { player: 1, action: "throw" },
  KeyK: { player: 1, action: "wall" },
};

export const PAUSE_KEY = "Escape";

/** 两位玩家的键位有没有互相抢占 */
export function keyConflicts(): string[] {
  const bad: string[] = [];
  const seen = new Map<string, SnowBind>();
  for (const [code, bind] of Object.entries(KEY_MAP)) {
    const prev = seen.get(code);
    if (prev && prev.player !== bind.player) bad.push(code);
    seen.set(code, bind);
  }
  return bad;
}

/** 仰角的上下限与每次微调的步长 */
export const ANGLE_MIN = 10;
export const ANGLE_MAX = 85;
export const ANGLE_STEP = 3;

export function stepAngle(angle: number, delta: number): number {
  return clamp(angle + delta, ANGLE_MIN, ANGLE_MAX);
}

// ---------------------------------------------------------------------------
// 蓄力条:来回跑,松手那一下的位置就是力度
// ---------------------------------------------------------------------------

/** 蓄力条跑一个来回要几秒 */
export const CHARGE_CYCLE = 1.6;

/** 按住 t 秒之后,蓄力条停在哪(0..100 的三角波) */
export function chargeAt(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0;
  const phase = (t % CHARGE_CYCLE) / CHARGE_CYCLE;
  return phase <= 0.5 ? phase * 200 : (1 - phase) * 200;
}

// ---------------------------------------------------------------------------
// 一发雪球飞出去会碰到什么
// ---------------------------------------------------------------------------

export type HitKind = "lantern" | "monster" | "cover" | "player" | "ground" | "out";

export interface ShotResult {
  /** 采样出来的轨迹,给画面用 */
  points: Vec[];
  hit: HitKind;
  /** 撞上的东西的 id(撞地面 / 出界时是 -1) */
  id: number;
  x: number;
  y: number;
}

function insideCover(c: Cover, p: Vec): boolean {
  return p.x >= c.x - BALL_R && p.x <= c.x + c.w + BALL_R && p.y <= c.h + BALL_R && p.y >= GROUND_Y;
}

function insideTarget(t: Target, p: Vec): boolean {
  if (t.melted) return false;
  return Math.hypot(p.x - t.x, p.y - t.y) <= t.r + BALL_R;
}

/**
 * 让一发雪球飞完全程,报告它最先撞上什么。
 * 纯函数:不改动 match,方便先算再放动画,也方便测试。
 */
export function flyShot(match: Match, spec: ThrowSpec, self = -1, step = 0.02): ShotResult {
  const total = flightTime(spec) + 0.4;
  const points: Vec[] = [];
  for (let t = 0; t <= total; t += step) {
    const p = positionAt(spec, t);
    points.push(p);
    if (p.x < -BALL_R || p.x > FIELD_W + BALL_R) {
      return { points, hit: "out", id: -1, x: p.x, y: p.y };
    }
    for (const target of match.targets) {
      if (insideTarget(target, p)) {
        return { points, hit: target.kind, id: target.id, x: p.x, y: p.y };
      }
    }
    for (const cover of match.covers) {
      if (insideCover(cover, p)) {
        return { points, hit: "cover", id: cover.id, x: p.x, y: p.y };
      }
    }
    for (const who of match.throwers) {
      if (who.id === self) continue;
      if (Math.hypot(p.x - who.x, p.y - (who.y + 0.4)) <= BODY_R) {
        return { points, hit: "player", id: who.id, x: p.x, y: p.y };
      }
    }
    if (p.y <= GROUND_Y) {
      return { points, hit: "ground", id: -1, x: p.x, y: GROUND_Y };
    }
  }
  const last = points[points.length - 1] ?? { x: spec.x, y: spec.y };
  return { points, hit: "ground", id: -1, x: last.x, y: GROUND_Y };
}

// ---------------------------------------------------------------------------
// 结算一次出手
// ---------------------------------------------------------------------------

export interface TurnOutcome {
  shot: ShotResult;
  /** 一句给小朋友看的话:说清楚这一发怎么样、下一发往哪调 */
  line: string;
}

function throwerById(match: Match, id: number): Thrower | undefined {
  return match.throwers.find((t) => t.id === id);
}

/** 这一发差多远(按投手的朝向算,负数是没到、正数是过头) */
export function missHint(shot: ShotResult, target: Target | undefined, dir: 1 | -1): string {
  if (!target) return "这一发落空啦,先记住落点,下一发照着差多少调。";
  const diff = (shot.x - target.x) * dir;
  const far = Math.abs(diff);
  if (far < 2) return "就差一点点!力度只要动一丁点就中了。";
  if (diff < 0) return `没到,还差 ${far.toFixed(1)} 格,下一发力度加一点。`;
  return `过头了 ${far.toFixed(1)} 格,下一发力度收一点。`;
}

/** 当前该谁出手 */
export function current(match: Match): Thrower {
  return match.throwers[match.turn] ?? match.throwers[0];
}

/** 还没化掉的靶子(可以按归属筛) */
export function liveTargets(match: Match, owner?: number): Target[] {
  return match.targets.filter((t) => !t.melted && (owner === undefined || t.owner === owner));
}

function meltTarget(match: Match, id: number): Target | undefined {
  const t = match.targets.find((x) => x.id === id);
  if (!t || t.melted) return t;
  t.melted = true;
  match.melted += 1;
  return t;
}

function damageCover(match: Match, id: number): void {
  const c = match.covers.find((x) => x.id === id);
  if (!c) return;
  c.hp -= 1;
  if (c.hp <= 0) match.covers = match.covers.filter((x) => x.id !== id);
}

/**
 * 出手一次:算轨迹、结算、扣雪球、推进回合。
 * 返回这一发的结果与一句点评;轮到别人或已经结束时返回 null。
 */
export function takeShot(match: Match, angle: number, power: number): TurnOutcome | null {
  if (match.status !== "playing") return null;
  const me = current(match);
  if (!me || me.balls === 0) return null;
  const spec: ThrowSpec = {
    x: me.x,
    y: me.y + 1.2,
    angle: clamp(angle, ANGLE_MIN, ANGLE_MAX),
    power: clamp(power, 0, 100),
    dir: me.dir,
    wind: match.wind,
  };
  const shot = flyShot(match, spec, me.id);
  if (me.balls > 0) me.balls -= 1;

  let line = "";
  if (shot.hit === "lantern" || shot.hit === "monster") {
    const t = meltTarget(match, shot.id);
    line = t?.kind === "monster" ? "正中雪怪,它化成一堆雪啦!" : "雪灯笼被砸中,化成一摊雪!";
  } else if (shot.hit === "cover") {
    damageCover(match, shot.id);
    line = "砸在掩体上了,再来两下它就碎。";
  } else if (shot.hit === "player") {
    const other = throwerById(match, shot.id);
    if (other) {
      other.frozen += 1;
      other.bumps += 1;
    }
    line = "砸中对手啦!他要变一会儿雪人,下一回合还是你先。";
  } else {
    const nearest = liveTargets(match).reduce<Target | undefined>((best, t) => {
      if (!best) return t;
      return Math.abs(t.x - shot.x) < Math.abs(best.x - shot.x) ? t : best;
    }, undefined);
    line = missHint(shot, nearest, me.dir);
  }

  endTurn(match, shot.hit === "player");
  return { shot, line };
}

/** 堆一堵雪墙:挡在自己前面,花掉这一回合 */
export function buildWall(match: Match): boolean {
  if (match.status !== "playing") return false;
  const me = current(match);
  if (!me || me.walls <= 0) return false;
  const x = me.dir === 1 ? me.x + 2.6 : me.x - 2.6 - SNOW_WALL_W;
  const existing = match.covers.find((c) => c.kind === "snow" && Math.abs(c.x - x) < 0.5);
  if (existing) {
    existing.hp = Math.min(existing.maxHp + 1, existing.hp + 1);
    existing.maxHp = Math.max(existing.maxHp, existing.hp);
    existing.h = Math.min(SNOW_WALL_H + 2, existing.h + 1);
  } else {
    match.covers.push({
      id: match.nextId++,
      x,
      w: SNOW_WALL_W,
      h: SNOW_WALL_H,
      hp: SNOW_WALL_HP,
      maxHp: SNOW_WALL_HP,
      kind: "snow",
    });
  }
  me.walls -= 1;
  endTurn(match, false);
  return true;
}

/** 雪怪往前挪一步;前面有掩体就先拆掩体 */
function marchMonsters(match: Match): void {
  for (const t of match.targets) {
    if (t.melted || t.kind !== "monster" || t.march <= 0) continue;
    const nextX = t.x - t.march;
    const blocker = match.covers.find((c) => nextX - t.r <= c.x + c.w && nextX + t.r >= c.x);
    if (blocker) {
      blocker.hp -= 1;
      if (blocker.hp <= 0) match.covers = match.covers.filter((c) => c.id !== blocker.id);
      continue;
    }
    t.x = nextX;
    t.homeX = nextX;
  }
}

/** 会左右滑的靶子往前走一相位 */
function swayTargets(match: Match): void {
  for (const t of match.targets) {
    if (t.melted || t.sway <= 0) continue;
    t.phase += t.swaySpeed;
    t.x = t.homeX + Math.sin(t.phase) * t.sway;
  }
}

function checkStatus(match: Match): void {
  if (match.status !== "playing") return;
  if (match.mode === "versus" || match.mode === "ai") {
    for (const who of match.throwers) {
      const foe = 1 - who.seat;
      if (liveTargets(match, foe).length === 0) {
        match.status = "win";
        match.winner = who.seat;
        match.reason = `${who.seat === 0 ? "朵朵" : "对手"}把对面三盏雪灯笼全砸化啦`;
        return;
      }
    }
    if (match.shots >= match.maxShots) {
      const left0 = liveTargets(match, 0).length;
      const left1 = liveTargets(match, 1).length;
      match.status = "win";
      match.winner = left0 === left1 ? -1 : left0 < left1 ? 1 : 0;
      match.reason = match.winner < 0 ? "回合用完,两边打平" : "回合用完,剩灯笼少的一方获胜";
    }
    return;
  }

  // 闯关 / 无尽:雪怪越线就算这一轮结束
  const crossed = match.targets.some((t) => !t.melted && t.kind === "monster" && t.x - t.r <= GUARD_X);
  if (crossed) {
    match.status = "lose";
    match.reason = "有雪怪走到雪堡跟前啦";
    return;
  }
  if (liveTargets(match).length === 0) {
    if (match.mode === "endless") return; // 无尽由外面补下一波
    match.status = "win";
    match.reason = "全部靶子都化成雪啦";
    return;
  }
  const me = match.throwers[0];
  if (me && me.balls === 0) {
    match.status = "lose";
    match.reason = "雪球用完了,还有靶子没打掉";
  }
}

/** 一回合结束:换风、动靶子、换人 */
export function endTurn(match: Match, keepTurn = false): void {
  match.shots += 1;
  if (match.windPlan.length > 0) {
    match.wind = match.windPlan[match.shots % match.windPlan.length];
  }
  swayTargets(match);
  marchMonsters(match);
  if (!keepTurn && match.throwers.length > 1) {
    let next = (match.turn + 1) % match.throwers.length;
    // 变雪人的那一位歇一回合(不是被扣血,只是先站着笑)
    const who = match.throwers[next];
    if (who && who.frozen > 0) {
      who.frozen -= 1;
      next = match.turn;
    }
    match.turn = next;
  }
  checkStatus(match);
}

// ---------------------------------------------------------------------------
// 电脑对手
// ---------------------------------------------------------------------------

/** 电脑挑仰角时会依次试这些角度:先试顺手的平抛,不行再一路抬高越过掩体 */
const AI_ANGLES = [34, 42, 50, 58, 64, 70, 76, 82];

/**
 * 轮到电脑时它怎么出手。
 *
 * 它做的事和小朋友一样:挑一个还没化的靶子,从平抛开始往上抬角度,
 * 心里比划一遍这一发会不会撞到掩体,选第一个「看起来能过去」的角度。
 * 差别只在手准不准——低档的心里那一遍不算风,手还抖;高档会把风偏算进去。
 */
export function aiTurn(match: Match, rand: () => number): TurnOutcome | null {
  const me = current(match);
  if (!me || !me.ai) return null;
  const foeSeat = 1 - me.seat;
  const pool = liveTargets(match, foeSeat);
  const targets = pool.length > 0 ? pool : liveTargets(match);
  if (targets.length === 0) return null;
  // 先打离自己最近的那一盏:省力,也符合攻略里教的顺序
  const pick = targets.reduce((best, t) =>
    Math.abs(t.x - me.x) < Math.abs(best.x - me.x) ? t : best
  );
  const from = { x: me.x, y: me.y + 1.2, dir: me.dir };
  const believedWind = AI_PROFILES[me.ai].readsWind ? match.wind : 0;

  let aim = aiAim(me.ai, from, pick.x, match.wind, rand);
  for (const angle of AI_ANGLES) {
    const power = solvePower({ ...from, angle, wind: believedWind }, pick.x, pick.y);
    if (power === null) continue;
    // 用「自己以为的风」在脑子里飞一遍,看看这个角度绕不绕得过掩体
    const rehearsal = flyShot(match, { ...from, angle, power, wind: believedWind }, me.id);
    if (rehearsal.id !== pick.id) continue;
    const profile = AI_PROFILES[me.ai];
    aim = {
      angle: clamp(angle + (rand() * 2 - 1) * profile.angleJitter, ANGLE_MIN, ANGLE_MAX),
      power: clamp(power * (1 + (rand() * 2 - 1) * profile.jitter), 5, 100),
    };
    break;
  }
  return takeShot(match, aim.angle, aim.power);
}

// ---------------------------------------------------------------------------
// 组装一局
// ---------------------------------------------------------------------------

export interface CoverSpec {
  x: number;
  w: number;
  h: number;
  hp: number;
  kind?: "ice" | "snow";
}

export interface TargetSpec {
  x: number;
  y: number;
  r?: number;
  kind?: TargetKind;
  owner?: number;
  sway?: number;
  swaySpeed?: number;
  march?: number;
}

export interface MatchSpec {
  mode: SnowMode;
  windPlan: number[];
  covers?: CoverSpec[];
  targets: TargetSpec[];
  throwers: Array<{
    seat: number;
    x: number;
    dir: 1 | -1;
    balls: number;
    walls: number;
    ai?: AiLevel | null;
  }>;
  maxShots?: number;
}

export function createMatch(spec: MatchSpec): Match {
  let nextId = 1;
  const match: Match = {
    mode: spec.mode,
    wind: spec.windPlan[0] ?? 0,
    windPlan: spec.windPlan.length > 0 ? [...spec.windPlan] : [0],
    shots: 0,
    maxShots: spec.maxShots ?? 60,
    covers: (spec.covers ?? []).map((c) => ({
      id: nextId++,
      x: c.x,
      w: c.w,
      h: c.h,
      hp: c.hp,
      maxHp: c.hp,
      kind: c.kind ?? "ice",
    })),
    targets: spec.targets.map((t) => ({
      id: nextId++,
      kind: t.kind ?? "lantern",
      homeX: t.x,
      x: t.x,
      y: t.y,
      r: t.r ?? 1.2,
      owner: t.owner ?? -1,
      melted: false,
      sway: t.sway ?? 0,
      swaySpeed: t.swaySpeed ?? 0.5,
      phase: 0,
      march: t.march ?? 0,
    })),
    throwers: spec.throwers.map((t) => ({
      id: nextId++,
      seat: t.seat,
      x: t.x,
      y: GROUND_Y,
      dir: t.dir,
      balls: t.balls,
      walls: t.walls,
      frozen: 0,
      bumps: 0,
      ai: t.ai ?? null,
    })),
    turn: 0,
    status: "playing",
    winner: -1,
    reason: "",
    wave: 1,
    melted: 0,
    nextId,
  };
  return match;
}

// ---------------------------------------------------------------------------
// 评分与文案
// ---------------------------------------------------------------------------

/** 过关评星:雪球省得越多越好 */
export function rateLevel(ballsLeft: number, ballsTotal: number): 1 | 2 | 3 {
  if (ballsTotal <= 0) return 1;
  const ratio = ballsLeft / ballsTotal;
  if (ratio >= 0.4) return 3;
  if (ratio >= 0.15) return 2;
  return 1;
}

export function winLine(stars: 1 | 2 | 3, used: number, total: number): string {
  const head = `用了 ${used} 个雪球(一共 ${total} 个)。`;
  if (stars === 3) return `${head}又准又省,夹逼两下就找到落点了!`;
  if (stars === 2) return `${head}打得不错,第一发当试投、第二发照着差多少改,还能更省。`;
  return `${head}过关啦。下次先看风标再出手,能少扔好几个。`;
}

export function loseLine(reason: string, left: number): string {
  if (reason.includes("雪怪")) {
    return "雪怪走到跟前了。下次先打最靠近雪堡的那一个,挡不住就用 G / K 堆一堵雪墙拖住它。";
  }
  return `雪球用完了,还剩 ${left} 个靶子。记住:第一发试投,第二发照着差多少改,别每次都重新猜。`;
}

/** 无尽:第 n 波派几个雪怪 */
export function endlessWaveSize(wave: number): number {
  return Math.min(7, 2 + Math.floor(wave / 2));
}

/** 无尽:第 n 波的雪怪走多快 */
export function endlessMarch(wave: number): number {
  return Math.min(2.4, 0.9 + wave * 0.12);
}

/** 无尽:一波雪怪的站位(确定性) */
export function endlessTargets(wave: number, rand: () => number): TargetSpec[] {
  const n = endlessWaveSize(wave);
  const march = endlessMarch(wave);
  const out: TargetSpec[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: 28 + i * 3.2 + rand() * 2.4,
      y: 1.6 + rand() * 2.4,
      r: 1.3,
      kind: "monster",
      march,
      sway: wave >= 4 ? 1.2 : 0,
      swaySpeed: 0.6,
    });
  }
  return out;
}
