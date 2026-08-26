/**
 * 飞机小队 —— 子弹与粒子的对象池(纯逻辑,零 DOM)。
 *
 * 1.1 的运行时是 `concat` + `filter` 流:一帧下来要新建上百个临时对象,
 * 弹幕一密 GC 就开始跳。1.2 把「活着的东西」全部换成**定长复用**:
 *
 *   - `acquire()` 优先从回收槽里拿一个旧对象,重置字段后交出去;
 *   - `release(obj)` 把它放回回收槽,不释放内存;
 *   - `sweep(pred)` 原地压缩活跃数组,把死掉的顺手回收 —— 不产生新数组。
 *
 * 池子有**硬上限**(`cap`):到顶了就不再新建,直接拒发。
 * 这条比性能更重要 —— 关卡数据写飞了也不会把手机内存吃干净。
 *
 * 「1000 次生成回收后池不膨胀」是这个文件的验收线,写在 `sky12.test.ts` 里。
 */
import { PATTERN_SHAPE, type BulletShape, type PatternKind } from "./bullets";

export interface PoolStats {
  /** 现在活着几个 */
  live: number;
  /** 回收槽里躺着几个 */
  idle: number;
  /** 这个池子一共造过几个对象(池不膨胀 = 这个数不涨) */
  created: number;
  /** 因为到顶被拒发过几次 */
  refused: number;
}

export class Pool<T> {
  private readonly make: () => T;
  private readonly reset: (item: T) => void;
  private readonly cap: number;
  private readonly idleList: T[] = [];
  private created = 0;
  private refused = 0;
  /** 活跃对象。外部只读遍历它,不要自己 push / splice */
  readonly live: T[] = [];

  constructor(make: () => T, reset: (item: T) => void, cap = 900) {
    this.make = make;
    this.reset = reset;
    this.cap = Math.max(1, Math.floor(cap));
  }

  /** 取一个用(到顶返回 null,调用方自己决定是少发一颗还是直接跳过) */
  acquire(): T | null {
    const recycled = this.idleList.pop();
    if (recycled !== undefined) {
      this.reset(recycled);
      this.live.push(recycled);
      return recycled;
    }
    if (this.live.length >= this.cap) {
      this.refused++;
      return null;
    }
    const fresh = this.make();
    this.created++;
    this.reset(fresh);
    this.live.push(fresh);
    return fresh;
  }

  /**
   * 原地清理:`keep` 返回 false 的对象回收进闲置槽。
   * 全程只挪指针,不新建数组 —— 这是「弹幕多也不掉帧」的关键一环。
   */
  sweep(keep: (item: T) => boolean): void {
    let write = 0;
    for (let read = 0; read < this.live.length; read++) {
      const item = this.live[read];
      if (keep(item)) {
        this.live[write++] = item;
      } else {
        this.idleList.push(item);
      }
    }
    this.live.length = write;
  }

  /** 一口气全部回收(炸弹清屏、换阶段、重开一局都走它) */
  clear(): void {
    for (const item of this.live) this.idleList.push(item);
    this.live.length = 0;
  }

  /** 连闲置槽一起丢掉(只有 destroy 才该调用) */
  drop(): void {
    this.live.length = 0;
    this.idleList.length = 0;
  }

  get size(): number {
    return this.live.length;
  }

  /** 池子一共占着几个对象(活跃 + 闲置)。「不膨胀」断言看的就是它 */
  get footprint(): number {
    return this.live.length + this.idleList.length;
  }

  stats(): PoolStats {
    return { live: this.live.length, idle: this.idleList.length, created: this.created, refused: this.refused };
  }
}

// ---------------------------------------------------------------------------
// 两种池子的具体形状
// ---------------------------------------------------------------------------

/** 池化的敌弹(字段和 `Bullet` 对齐,多一个 `dead` 供原地清理) */
export interface PooledBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  warn: number;
  kind: PatternKind;
  volley: number;
  shape: BulletShape;
  /** 已经给哪几号飞机记过「好险!」(位掩码,免得一发弹刷一串擦弹) */
  grazed: number;
  dead: boolean;
}

export function makeBulletPool(cap = 900): Pool<PooledBullet> {
  return new Pool<PooledBullet>(
    () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 10,
      warn: 0,
      kind: "fan" as PatternKind,
      volley: 0,
      shape: "bubble" as BulletShape,
      grazed: 0,
      dead: false,
    }),
    (b) => {
      b.x = 0;
      b.y = 0;
      b.vx = 0;
      b.vy = 0;
      b.r = 10;
      b.warn = 0;
      b.kind = "fan";
      b.volley = 0;
      b.shape = "bubble";
      b.grazed = 0;
      b.dead = false;
    },
    cap
  );
}

/** 把一发生成好的子弹数据搬进池里的槽位(拿不到槽就返回 null) */
export function spawnPooled(
  pool: Pool<PooledBullet>,
  src: { x: number; y: number; vx: number; vy: number; r: number; warn: number; kind: PatternKind; volley: number; shape?: BulletShape }
): PooledBullet | null {
  const b = pool.acquire();
  if (!b) return null;
  b.x = src.x;
  b.y = src.y;
  b.vx = src.vx;
  b.vy = src.vy;
  b.r = src.r;
  b.warn = src.warn;
  b.kind = src.kind;
  b.volley = src.volley;
  b.shape = src.shape ?? PATTERN_SHAPE[src.kind] ?? "bubble";
  b.grazed = 0;
  b.dead = false;
  return b;
}

/** 池化的我方弹。形状取自 `power.ts` 的三种,和敌弹那八种不重叠 */
export interface PooledShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  /** 还能穿几个目标(1 = 打中就消失) */
  pierce: number;
  /** 每秒最多拐多少弧度(0 = 直线) */
  homing: number;
  color: string;
  shape: "arrow" | "ring" | "beam" | "merge";
  /** 已经打过的目标 id,免得穿透弹在同一个身上反复扣血 */
  hitIds: number[];
  dead: boolean;
}

export function makeShotPool(cap = 420): Pool<PooledShot> {
  return new Pool<PooledShot>(
    () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 5,
      damage: 1,
      pierce: 1,
      homing: 0,
      color: "#7FC6FF",
      shape: "arrow" as const,
      hitIds: [] as number[],
      dead: false,
    }),
    (s) => {
      s.x = 0;
      s.y = 0;
      s.vx = 0;
      s.vy = 0;
      s.r = 5;
      s.damage = 1;
      s.pierce = 1;
      s.homing = 0;
      s.color = "#7FC6FF";
      s.shape = "arrow";
      s.hitIds.length = 0;
      s.dead = false;
    },
    cap
  );
}

/** 池化的粒子:白烟、亮片、擦弹光环共用一种 */
export interface PooledPuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  tone: "smoke" | "spark" | "graze";
}

export function makePuffPool(cap = 260): Pool<PooledPuff> {
  return new Pool<PooledPuff>(
    () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 8, life: 0, max: 1, tone: "smoke" }),
    (p) => {
      p.x = 0;
      p.y = 0;
      p.vx = 0;
      p.vy = 0;
      p.r = 8;
      p.life = 0;
      p.max = 1;
      p.tone = "smoke";
    },
    cap
  );
}
