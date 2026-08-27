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
 * 1.2 在上面加了一层**声明式弹幕语法**:`PatternDecl` 就是一段 JSON
 * (`{ pattern, count, speed, delay, arc }`),`compileDecl` 把它翻成引擎口径,
 * 顺手把「弹速上限 / 弹体下限 / 预警下限」这三条可读性底线夹回去。
 * 基础图案八种,Boss 用它们的组合。
 *
 * 分级约定:子弹是星星 / 泡泡 / 光点这类卡通造型,飞得慢、个头大、暖色(敌)冷色(我)
 * 区分,而且**形状也各不相同**(不能只靠颜色);被打中只是打个转冒串白烟,
 * 没有爆炸、没有伤亡描写。
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

/**
 * 1.2 判定盒口径。画出来的小飞机是 72 宽 × 64 高(翅膀椭圆到 ±36,
 * 机身圆角矩形 22×42,尾焰再往下 12),判定圆直径只有 18 ——
 * 横向 25%、面积 5% 不到。「看着擦到翅膀其实没事」这句话是有数的。
 */
export const PLANE_ART = { width: 72, height: 64 } as const;

/** 判定核心画多大(半径):比判定圆略小一点点,免得孩子以为核心边缘也算中 */
export const CORE_DOT_R = 6;

/**
 * 擦弹半径:弹边缘进到这个距离但没碰到判定圆,就算「好险!」。
 * 做得比判定圆大不少,擦弹反馈才够容易触发,孩子才会去学「贴着弹走」。
 */
export const GRAZE_R = 30;

export type PatternKind = "fan" | "ring" | "spiral" | "sweep" | "wall" | "rain" | "aimed" | "cross";

/** 全部基础图案(≥ 6 种;boss 用它们的组合) */
export const PATTERN_KINDS: PatternKind[] = ["fan", "ring", "aimed", "spiral", "sweep", "wall", "rain", "cross"];

/** 弹幕图案说明,给攻略与 Boss 预告用 */
export const PATTERN_LABEL: Record<PatternKind, string> = {
  fan: "扇形弹",
  ring: "环形弹",
  spiral: "螺旋弹",
  sweep: "扫射弹",
  wall: "缺口墙",
  rain: "落雨弹",
  aimed: "锁定弹",
  cross: "十字弹",
};

/**
 * 图案的形状标记。同阵营里也要靠形状分得开 —— 只靠颜色的话,
 * 色觉不敏感的孩子就读不动弹幕了。敌弹一律是这几种暖色卡通造型。
 */
export type BulletShape = "bubble" | "star" | "petal" | "candy" | "cloud" | "drop" | "diamond" | "plus";

export const PATTERN_SHAPE: Record<PatternKind, BulletShape> = {
  fan: "bubble",
  ring: "petal",
  spiral: "star",
  sweep: "candy",
  wall: "cloud",
  rain: "drop",
  aimed: "diamond",
  cross: "plus",
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

// ---------------------------------------------------------------------------
// 1.2 弹幕语法:一段 JSON 就是一个图案
// ---------------------------------------------------------------------------

/**
 * 声明式弹幕。整张表可以直接写在 JSON 里(角度用**度**,不用弧度,
 * 手写和读日志都省事),`compileDecl` 负责翻成引擎口径的 `PatternSpec`。
 *
 * 只有 `pattern` 是必填的,其余全部有安全默认值;而且编译时会把
 * 「弹速上限 / 弹体下限 / 预警下限」这三条可读性底线夹回去 ——
 * 语法层就不允许写出一片看不清的弹雨。
 */
export interface PatternDecl {
  pattern: PatternKind;
  /** 每轮齐射发多少弹 */
  count?: number;
  /** 弹速(逻辑单位 / 秒) */
  speed?: number;
  /** 第一轮齐射前的静默(秒) */
  delay?: number;
  /** 扇面张角,单位**度**;环形 / 十字 / 缺口墙用不上 */
  arc?: number;
  /** 弹半径 */
  radius?: number;
  /** 两轮齐射的间隔(秒) */
  interval?: number;
  /** 每轮整体旋转多少**度**(螺旋 / 环形 / 十字用) */
  rotate?: number;
  /** 缺口墙里留几个缺口 */
  gaps?: number;
  /** 亮一下再飞的预警时间(秒) */
  warn?: number;
}

/** 可读性底线:弹再快也不许超过这个速度 */
export const MAX_BULLET_SPEED = 160;
/** 可读性底线:弹再小也不许小于这个半径 */
export const MIN_BULLET_RADIUS = 10;
/** 可读性底线:再急也要先亮这么久的预警 */
export const MIN_BULLET_WARN = 0.2;

const DEG = Math.PI / 180;

/**
 * 把一段声明翻成引擎口径的 `PatternSpec`(纯函数,同样的输入永远同样的输出)。
 * 越界的字段一律夹回可读范围,而不是抛错 —— 关卡数据写错也不能让孩子白屏。
 */
export function compileDecl(decl: PatternDecl): PatternSpec {
  const kind: PatternKind = PATTERN_KINDS.includes(decl.pattern) ? decl.pattern : "fan";
  const num = (v: number | undefined, fallback: number): number => (Number.isFinite(v) ? (v as number) : fallback);
  return {
    kind,
    count: Math.max(1, Math.round(num(decl.count, 8))),
    speed: Math.max(40, Math.min(MAX_BULLET_SPEED, num(decl.speed, 110))),
    radius: Math.max(MIN_BULLET_RADIUS, num(decl.radius, 12)),
    interval: Math.max(0.05, num(decl.interval, 1.5)),
    spread: Math.max(0, Math.min(Math.PI * 2, num(decl.arc, 90) * DEG)),
    rotate: num(decl.rotate, 20) * DEG,
    gaps: Math.max(1, Math.round(num(decl.gaps, 2))),
    warn: Math.max(MIN_BULLET_WARN, num(decl.warn, 0.35)),
    delay: Math.max(0, num(decl.delay, 0)),
  };
}

/** 一整套弹幕的声明(boss 一个阶段就是若干套叠在一起) */
export function compileDecks(decls: readonly PatternDecl[]): PatternSpec[] {
  return decls.map(compileDecl);
}

/** 声明 → 直接展开成子弹列表(纯函数,给测试和攻略预览用) */
export function expandDecl(
  decl: PatternDecl,
  index: number,
  origin: { x: number; y: number },
  ctx: VolleyCtx = {}
): Bullet[] {
  return buildVolley(compileDecl(decl), index, origin, ctx);
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
  /** 画成什么形状(不能只靠颜色区分阵营) */
  shape: BulletShape;
}

/** Boss 在 t 秒时的横向位置(确定函数,和玩家无关) */
export function bossX(t: number, swing: number, width = SKY_W): number {
  return width / 2 + Math.sin(t * 0.6) * swing;
}

export interface VolleyCtx {
  width?: number;
  /**
   * 锁定弹瞄准的那个点。不给就用「指路星」——一条与玩家无关的确定性轨迹,
   * 这样整片 boss 弹幕仍然可以离线完整模拟,可躲避性还是能被**证明**。
   * 普通敌机才把真实机位传进来(它们弹稀、预警足,侧身一步就让开)。
   */
  aim?: { x: number; y: number };
}

/** 「指路星」:锁定弹与扫射弹的确定性引导点,和玩家位置无关 */
export function guideStar(index: number, width = SKY_W): { x: number; y: number } {
  return { x: width * (0.5 + 0.34 * Math.sin(index * 0.8)), y: PLAYER_ROW };
}

/**
 * 锁定弹是不是「侧身一步就能让开」:预警时间里能挪出的距离,
 * 要大于弹体加机身的直径还有富余。语法层保证了 warn ≥ 0.2,
 * 这个判据让「敌机可以瞄着你打」不至于变成躲不掉的追踪弹。
 */
export function aimedDodgeable(spec: PatternSpec, playerSpeed = PLAYER_SPEED, playerR = PLAYER_HIT_R): boolean {
  return playerSpeed * spec.warn > (spec.radius + playerR) * 2;
}

export type TouchLevel = "hit" | "graze" | "clear";

/**
 * 一发弹和判定核心的关系:碰到了 / 擦过去了 / 还早着呢。
 * 擦弹是正反馈(「好险!」),不扣任何东西 —— 它教的是「判定点很小,
 * 敢贴着弹走」,这正是弹幕手感的基本盘。
 */
export function bulletTouch(
  dx: number,
  dy: number,
  bulletR: number,
  playerR = PLAYER_HIT_R,
  grazeR = GRAZE_R
): TouchLevel {
  const d2 = dx * dx + dy * dy;
  const hit = bulletR + playerR;
  if (d2 <= hit * hit) return "hit";
  const graze = bulletR + grazeR;
  return d2 <= graze * graze ? "graze" : "clear";
}

/** 判定圆相对机身画面的占比(横向 / 面积),给「判定盒必须更小」的断言用 */
export function hitBoxRatio(): { width: number; area: number } {
  const d = PLAYER_HIT_R * 2;
  return {
    width: d / PLANE_ART.width,
    area: (Math.PI * PLAYER_HIT_R * PLAYER_HIT_R) / (PLANE_ART.width * PLANE_ART.height),
  };
}

/**
 * 生成第 index 轮齐射(0 基)。origin 是 Boss 当时的位置。
 * 屏幕坐标:y 向下为正,所以「朝下」是角度 π/2。
 */
export function buildVolley(
  spec: PatternSpec,
  index: number,
  origin: { x: number; y: number },
  ctx: VolleyCtx = {}
): Bullet[] {
  const width = ctx.width ?? SKY_W;
  const shape = PATTERN_SHAPE[spec.kind] ?? "bubble";
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
      shape,
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
      const star = guideStar(index, width);
      const base = Math.atan2(star.y - origin.y, star.x - origin.x);
      const n = Math.max(1, Math.min(5, spec.count));
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0 : i / (n - 1) - 0.5;
        push(origin.x, origin.y, base + f * spec.spread * 0.4);
      }
      break;
    }
    case "aimed": {
      // 锁定弹:亮完预警才朝锁定点飞过去,而且一次只锁一小束。
      // 不给 aim 就锁「指路星」,整片弹幕依旧与玩家无关、可离线证明。
      const target = ctx.aim ?? guideStar(index, width);
      const base = Math.atan2(target.y - origin.y, target.x - origin.x);
      const n = Math.max(1, Math.min(5, spec.count));
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0 : i / (n - 1) - 0.5;
        push(origin.x, origin.y, base + f * spec.spread * 0.25);
      }
      break;
    }
    case "cross": {
      // 十字弹:四条胳膊,整体每轮转一点。胳膊之间永远是空的,
      // 站在两条胳膊中间的扇区就一定安全。
      const arms = 4;
      const per = Math.max(1, Math.min(3, Math.ceil(spec.count / arms)));
      for (let a = 0; a < arms; a++) {
        const ang = index * spec.rotate + (a / arms) * Math.PI * 2 + Math.PI / 4;
        for (let i = 0; i < per; i++) {
          push(origin.x, origin.y, ang, spec.speed * (1 - i * 0.18));
        }
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

/**
 * 阶段切换的**预告动作**。1.2 要求「阶段切换有明确预告」:
 * Boss 先做一个看得懂的大动作(吸气 / 张开 / 转身),这段时间**完全停火**,
 * 场上残弹也清空,孩子有一段绝对安全的窗口去读下一段是什么。
 */
export interface PhaseCue {
  /** 预告动作:吸气缩小 / 花瓣张开 / 原地转身 */
  move: "inhale" | "bloom" | "spin";
  /** 预告持续多久(秒);这段时间不发弹 */
  seconds: number;
  /** 预告时的一句话(和 `shout` 分工:call 是「要来了」,shout 是「这段怎么躲」) */
  call: string;
}

/** 没写预告时的兜底(保证运行时永远有一个安全窗口) */
export const DEFAULT_CUE: PhaseCue = { move: "inhale", seconds: 1.4, call: "它要换招啦,看好下一段!" };

export function cueOf(phase: PhaseSpec): PhaseCue {
  const cue = phase.cue ?? DEFAULT_CUE;
  return { ...cue, seconds: Math.max(0.8, cue.seconds) };
}

export interface PhaseSpec {
  name: string;
  /** 血量降到总量的这个比例以下时进入下一阶段(最后一阶段写 0) */
  until: number;
  /** 这一阶段同时跑的弹幕(1~3 套) */
  patterns: PatternSpec[];
  /** Boss 这一阶段的横向摆动幅度 */
  swing: number;
  /** 阶段主色(粉彩) */
  color: string;
  /** 进入这一阶段时的提示语 */
  shout: string;
  /** 进这一段之前的预告动作;不写就用 `DEFAULT_CUE` */
  cue?: PhaseCue;
}

export interface BossSpec {
  id: string;
  name: string;
  emoji: string;
  /** 血量(打中一次掉 1) */
  hp: number;
  phases: PhaseSpec[];
}

export interface TimelineSlot {
  kind: "cue" | "phase";
  /** 属于第几阶段(0 基) */
  phase: number;
  name: string;
  /** 这一段从 Boss 出场后第几秒开始(阶段段落按「打得动」的估计时长排) */
  at: number;
  seconds: number;
  /** cue 段落一定不发弹 */
  firing: boolean;
}

/**
 * Boss 的三阶段时间线(纯函数,给攻略、预告 UI 与测试共用)。
 * 结构永远是:预告 → 一阶段 → 预告 → 二阶段 → 预告 → 三阶段,
 * 也就是**每一次换段前面都挂着一个不发弹的安全窗口**。
 */
export function bossTimeline(boss: BossSpec, phaseSeconds = 18): TimelineSlot[] {
  const out: TimelineSlot[] = [];
  let at = 0;
  boss.phases.forEach((ph, i) => {
    const cue = cueOf(ph);
    out.push({ kind: "cue", phase: i, name: cue.call, at, seconds: cue.seconds, firing: false });
    at += cue.seconds;
    out.push({ kind: "phase", phase: i, name: ph.name, at, seconds: phaseSeconds, firing: true });
    at += phaseSeconds;
  });
  return out;
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
        const fresh = buildVolley(spec, volleyIndex[pi], origin, { width: opt.width });
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
