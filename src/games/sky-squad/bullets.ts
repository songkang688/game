/**
 * 飞机小队 —— 弹幕生成器与「可躲避性」求解器(纯函数,零 DOM)。
 *
 * 设计上刻意做成**和玩家位置无关**的弹幕:
 * 每一发子弹从哪儿出、往哪儿飞,只取决于「第几轮齐射」和「当时 Boss 在哪」,
 * 而 Boss 的横向摆动又是时间的确定函数。这样做有两个好处:
 *  1. 对小朋友友好——弹幕是「看得懂、背得下来」的图案,而不是甩不掉的追踪弹;
 *  2. 整片弹幕可以离线完整模拟,于是「这一阶段到底躲不躲得掉」可以被**证明**,
 *     而不是靠手感估计。`findDodgePath` 就是那个证明器,单测逐个阶段跑它。
 *
 * 分级约定:子弹是星星 / 泡泡 / 光点这类卡通造型,飞得慢、个头大、暖色(敌)冷色(我)
 * 区分;被打中只是冒烟迫降,没有爆炸、没有伤亡描写。
 */
import { mulberry32 } from "../level99";

/** 纵版战场逻辑宽度 */
export const SKY_W = 480;
/** 纵版战场逻辑高度 */
export const SKY_H = 720;
/** 玩家平时活动的那一行(躲弹幕主要靠横向挪动) */
export const PLAYER_ROW = 596;
/** 玩家的判定半径:比机身小一圈,擦弹不算中 */
export const PLAYER_HIT_R = 9;
/** 玩家最大横向速度(逻辑单位 / 秒) */
export const PLAYER_SPEED = 250;

export type PatternKind = "fan" | "ring" | "spiral" | "sweep" | "wall" | "rain";

/** 弹幕图案说明,给攻略与 Boss 预告用 */
export const PATTERN_LABEL: Record<PatternKind, string> = {
  fan: "扇形弹",
  ring: "环形弹",
  spiral: "螺旋弹",
  sweep: "扫射弹",
  wall: "缺口墙",
  rain: "落雨弹",
};

export interface PatternSpec {
  kind: PatternKind;
  /** 每轮齐射发多少弹 */
  count: number;
  /** 弹速(逻辑单位 / 秒),故意压得很低,看得清才躲得开 */
  speed: number;
  /** 弹半径,故意做大,远看也能分辨 */
  radius: number;
  /** 两轮齐射的间隔(秒) */
  interval: number;
  /** 扇形张角(弧度);环形忽略 */
  spread: number;
  /** 每轮整体旋转多少弧度(螺旋用) */
  rotate: number;
  /** 缺口墙里留几个缺口 */
  gaps: number;
  /** 亮一下再飞的预警时间(秒),给反应时间 */
  warn: number;
  /** 第一轮齐射前的静默(秒) */
  delay: number;
}

export function makeSpec(kind: PatternKind, over: Partial<PatternSpec> = {}): PatternSpec {
  const base: PatternSpec = {
    kind,
    count: 8,
    speed: 120,
    radius: 11,
    interval: 1.5,
    spread: Math.PI * 0.5,
    rotate: 0.36,
    gaps: 2,
    warn: 0.35,
    delay: 0,
  };
  return { ...base, ...over, kind };
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 还要亮多久才起飞(预警);>0 时不动 */
  warn: number;
  kind: PatternKind;
  /** 同一轮齐射共用一个序号,方便配色 */
  volley: number;
}

/** Boss 在 t 秒时的横向位置(确定函数,和玩家无关) */
export function bossX(t: number, swing: number, width = SKY_W): number {
  return width / 2 + Math.sin(t * 0.6) * swing;
}

/**
 * 生成第 index 轮齐射(0 基)。origin 是 Boss 当时的位置。
 * 屏幕坐标:y 向下为正,所以「朝下」是角度 π/2。
 */
export function buildVolley(spec: PatternSpec, index: number, origin: { x: number; y: number }, width = SKY_W): Bullet[] {
  const out: Bullet[] = [];
  const push = (x: number, y: number, ang: number, speed = spec.speed): void => {
    out.push({
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r: spec.radius,
      warn: spec.warn,
      kind: spec.kind,
      volley: index,
    });
  };
  const down = Math.PI / 2;

  switch (spec.kind) {
    case "fan": {
      const n = Math.max(1, spec.count);
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0.5 : i / (n - 1);
        push(origin.x, origin.y, down - spec.spread / 2 + spec.spread * f + index * spec.rotate * 0.25);
      }
      break;
    }
    case "ring": {
      const n = Math.max(3, spec.count);
      for (let i = 0; i < n; i++) {
        push(origin.x, origin.y, (i / n) * Math.PI * 2 + index * spec.rotate);
      }
      break;
    }
    case "spiral": {
      const arms = Math.max(1, Math.min(4, Math.round(spec.count / 4)));
      for (let a = 0; a < arms; a++) {
        push(origin.x, origin.y, index * spec.rotate + (a / arms) * Math.PI * 2);
      }
      break;
    }
    case "sweep": {
      // 朝着底部一个来回扫动的引导点打一小束,永远只覆盖一段,不会封死整行
      const aimX = width * (0.5 + 0.34 * Math.sin(index * 0.8));
      const aimY = PLAYER_ROW;
      const base = Math.atan2(aimY - origin.y, aimX - origin.x);
      const n = Math.max(1, Math.min(5, spec.count));
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0 : i / (n - 1) - 0.5;
        push(origin.x, origin.y, base + f * spec.spread * 0.4);
      }
      break;
    }
    case "wall": {
      // 一整排往下压的大弹,但一定留出够宽的缺口(缺口位置每轮平移)
      const n = Math.max(5, spec.count);
      const step = width / n;
      const gaps = Math.max(1, Math.min(spec.gaps, Math.floor(n / 3)));
      const holes = new Set<number>();
      for (let k = 0; k < gaps; k++) {
        // 每个缺口占两格,保证宽度远大于机身
        const start = (index * 2 + k * Math.floor(n / gaps) + 1) % n;
        holes.add(start);
        holes.add((start + 1) % n);
      }
      for (let i = 0; i < n; i++) {
        if (holes.has(i)) continue;
        push(step * (i + 0.5), origin.y, down);
      }
      break;
    }
    case "rain": {
      // 把宽度切成若干条泳道,每轮只占一部分泳道,剩下的永远是安全通道
      const lanes = 11;
      const rand = mulberry32(0x51a7 + index * 2654435761);
      const order: number[] = [];
      for (let i = 0; i < lanes; i++) order.push(i);
      for (let i = lanes - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const take = Math.max(1, Math.min(spec.count, lanes - 4));
      const step = width / lanes;
      for (let i = 0; i < take; i++) {
        push(step * (order[i] + 0.5), origin.y, down);
      }
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Boss 阶段
// ---------------------------------------------------------------------------

export interface PhaseSpec {
  name: string;
  /** 血量降到总量的这个比例以下时进入下一阶段(最后一阶段写 0) */
  until: number;
  /** 这一阶段同时跑的弹幕(1~2 套) */
  patterns: PatternSpec[];
  /** Boss 这一阶段的横向摆动幅度 */
  swing: number;
  /** 阶段主色(粉彩) */
  color: string;
  /** 进入这一阶段时的提示语 */
  shout: string;
}

export interface BossSpec {
  id: string;
  name: string;
  emoji: string;
  /** 血量(打中一次掉 1) */
  hp: number;
  phases: PhaseSpec[];
}

// ---------------------------------------------------------------------------
// 弹幕模拟
// ---------------------------------------------------------------------------

export interface SimOptions {
  width: number;
  height: number;
  /** Boss 所在的行 */
  bossY: number;
  /** 模拟多久(秒) */
  duration: number;
  /** 步长(秒) */
  dt: number;
}

export const DEFAULT_SIM: SimOptions = {
  width: SKY_W,
  height: SKY_H,
  bossY: 130,
  duration: 12,
  dt: 1 / 30,
};

/** 一步弹幕推进:先走预警,再走位移,飞出场地就丢掉。返回新数组(纯函数) */
export function stepBullets(bullets: readonly Bullet[], dt: number, width = SKY_W, height = SKY_H): Bullet[] {
  const out: Bullet[] = [];
  for (const b of bullets) {
    if (b.warn > 0) {
      out.push({ ...b, warn: b.warn - dt });
      continue;
    }
    const next = { ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt };
    if (next.x < -60 || next.x > width + 60 || next.y < -80 || next.y > height + 80) continue;
    out.push(next);
  }
  return out;
}

/** 线段 AB 与圆是否相交(躲避判定用,和射击场那套是同一个数学) */
function segmentHitsCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;
  const a = dx * dx + dy * dy;
  if (a <= 1e-9) return fx * fx + fy * fy <= r * r;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const sq = Math.sqrt(disc);
  const u1 = (-b - sq) / (2 * a);
  const u2 = (-b + sq) / (2 * a);
  return (u1 >= 0 && u1 <= 1) || (u2 >= 0 && u2 <= 1) || (u1 < 0 && u2 > 1);
}

export interface DodgeOptions extends SimOptions {
  /** 玩家躲弹幕时待的那一行 */
  playerRow: number;
  /** 玩家判定半径 */
  playerR: number;
  /** 玩家最大横向速度 */
  playerSpeed: number;
  /** 横向离散成多少列(越多越精细) */
  columns: number;
  /** 左右各留多少边距不站人 */
  margin: number;
}

export const DEFAULT_DODGE: DodgeOptions = {
  ...DEFAULT_SIM,
  playerRow: PLAYER_ROW,
  playerR: PLAYER_HIT_R,
  playerSpeed: PLAYER_SPEED,
  columns: 97,
  margin: 22,
};

export interface DodgeReport {
  /** 存在一条全程不被击中的路径吗 */
  ok: boolean;
  /** 那条路径上每一步的横坐标(ok 为 false 时是走到哪一步断掉的前缀) */
  path: number[];
  /** 一共模拟了几步 */
  steps: number;
  /** 断在第几步(ok 为 true 时等于 steps) */
  survivedSteps: number;
  /** 模拟期间一共出现过多少发子弹 */
  spawned: number;
}

/**
 * 「可躲避性」求解器。
 *
 * 把玩家的横向位置离散成 `columns` 列,在「时间 × 列」的网格上做可达集合推进:
 * 每一步只允许挪动 `playerSpeed * dt` 那么远(向下取整到整列,所以是**保守**的——
 * 求解器认为玩家比实际更笨重),而且要求
 *   1. 落点这一列在这一时刻没有被任何子弹的扫掠线段碰到;
 *   2. 从上一列挪到这一列的中点同样安全(防止穿过一发子弹)。
 * 只要终点还有任何一列可达,就说明存在一条全程不被击中的路径,原样回放即可。
 *
 * 弹幕与玩家位置无关,所以这个判断是精确的,不是估计。
 */
export function findDodgePath(phase: PhaseSpec, options: Partial<DodgeOptions> = {}): DodgeReport {
  const opt: DodgeOptions = { ...DEFAULT_DODGE, ...options };
  const cols = Math.max(5, Math.floor(opt.columns));
  const span = opt.width - opt.margin * 2;
  const colStep = span / (cols - 1);
  const colX = (i: number): number => opt.margin + colStep * i;
  const maxJump = Math.max(1, Math.floor((opt.playerSpeed * opt.dt) / colStep));
  const steps = Math.max(1, Math.round(opt.duration / opt.dt));
  const hitR = opt.playerR;

  let bullets: Bullet[] = [];
  let spawned = 0;
  const nextVolley = phase.patterns.map((p) => p.delay);
  const volleyIndex = phase.patterns.map(() => 0);

  let reach = new Array<boolean>(cols).fill(false);
  const parents: Int16Array[] = [];
  // 起手站在正中间那一列
  reach[Math.floor(cols / 2)] = true;
  let survived = 0;

  for (let k = 1; k <= steps; k++) {
    const t = k * opt.dt;

    // 到点就发一轮齐射
    for (let pi = 0; pi < phase.patterns.length; pi++) {
      const spec = phase.patterns[pi];
      while (t >= nextVolley[pi]) {
        const origin = { x: bossX(nextVolley[pi], phase.swing, opt.width), y: opt.bossY };
        const fresh = buildVolley(spec, volleyIndex[pi], origin, opt.width);
        bullets = bullets.concat(fresh);
        spawned += fresh.length;
        volleyIndex[pi]++;
        nextVolley[pi] += Math.max(0.05, spec.interval);
      }
    }

    const before = bullets;
    bullets = stepBullets(bullets, opt.dt, opt.width, opt.height);

    // 只有可能碰到玩家那一行的子弹才需要参与判定,其余直接跳过
    const near: Array<{ ax: number; ay: number; bx: number; by: number; r: number }> = [];
    for (let i = 0; i < before.length; i++) {
      const a = before[i];
      const b = a.warn > 0 ? a : { ...a, x: a.x + a.vx * opt.dt, y: a.y + a.vy * opt.dt };
      const lo = Math.min(a.y, b.y) - a.r - hitR;
      const hi = Math.max(a.y, b.y) + a.r + hitR;
      if (opt.playerRow < lo || opt.playerRow > hi) continue;
      near.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, r: a.r + hitR });
    }

    const safeAt = (x: number): boolean => {
      for (const n of near) {
        if (segmentHitsCircle(n.ax, n.ay, n.bx, n.by, x, opt.playerRow, n.r)) return false;
      }
      return true;
    };

    const parent = new Int16Array(cols).fill(-1);
    const next = new Array<boolean>(cols).fill(false);
    const safeCache = new Array<boolean | undefined>(cols);
    for (let j = 0; j < cols; j++) {
      const sj = safeCache[j] ?? (safeCache[j] = safeAt(colX(j)));
      if (!sj) continue;
      for (let d = -maxJump; d <= maxJump; d++) {
        const i = j + d;
        if (i < 0 || i >= cols || !reach[i]) continue;
        // 半路也不许挨到弹
        if (d !== 0 && !safeAt((colX(i) + colX(j)) / 2)) continue;
        next[j] = true;
        parent[j] = i;
        break;
      }
    }

    parents.push(parent);
    if (!next.some(Boolean)) {
      return { ok: false, path: rebuild(parents, reach, colX, k - 1), steps, survivedSteps: survived, spawned };
    }
    reach = next;
    survived = k;
  }

  return { ok: true, path: rebuild(parents, reach, colX, steps), steps, survivedSteps: survived, spawned };
}

/** 从可达集合回溯出具体路径(取最靠中间的终点,回放起来最自然) */
function rebuild(parents: Int16Array[], reach: boolean[], colX: (i: number) => number, upTo: number): number[] {
  if (upTo <= 0) return [];
  const cols = reach.length;
  let end = -1;
  let bestDist = Infinity;
  for (let j = 0; j < cols; j++) {
    if (!reach[j]) continue;
    const d = Math.abs(j - cols / 2);
    if (d < bestDist) {
      bestDist = d;
      end = j;
    }
  }
  if (end < 0) return [];
  const idx: number[] = [end];
  for (let k = Math.min(upTo, parents.length) - 1; k >= 0; k--) {
    const p = parents[k][idx[0]];
    if (p < 0) break;
    idx.unshift(p);
  }
  return idx.map(colX);
}
