/**
 * 萌猫小屋 · 直开第 N 关的小工具（1.2 新增，纯函数，不碰 DOM 之外的东西）。
 *
 * 通用闯关框架 `level99.ts` 没给「直接开某一关」的入口，而它是只读的公共文件。
 * 于是照着地图上的按钮替玩家点一下：先切章，再点那一关的格子；
 * 点不到（章节还锁着 / 关卡还锁着）就安静停在地图上，绝不把游戏卡住。
 */
import { TOTAL_LEVELS } from "../level99";

/** 从 `?level=12` 之类的串里读关号（1 基）；读不到返回 null */
export function parseLevelParam(search: string): number | null {
  if (typeof search !== "string" || !search) return null;
  const hit = /[?&#]level=(-?\d+)/.exec(search);
  if (!hit) return null;
  const n = Number(hit[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * 壳层给的 `initialLevel`（1 基）或地址栏 `?level=N` 落成实际要开的关号（0 基）：
 * 越界夹回来，还没解锁的退到当前能玩到的最远那一关，没点名就返回 null。
 */
export function resolveInitialLevel(raw: unknown, unlocked: number, total = TOTAL_LEVELS): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n)) return null;
  const top = Math.max(1, Math.round(total));
  const wanted = Math.max(1, Math.min(top, Math.round(n))) - 1;
  const reachable = Math.max(0, Math.min(top - 1, Math.round(unlocked)));
  return Math.min(wanted, reachable);
}

/** 地图上一个能点的格子（只要求这三样，真 DOM 与测试桩都对得上） */
export interface MapNodeLike {
  classList: { contains(token: string): boolean };
  getAttribute(name: string): string | null;
  click(): void;
}

/** 地图容器（只要求查得出格子） */
export interface MapHostLike {
  querySelectorAll(selector: string): ArrayLike<MapNodeLike>;
}

/** 替玩家在地图上点开第 level 关（0 基）；章节锁着或格子锁着就返回 false */
export function openLevelOnMap(host: MapHostLike, level: number, chapterIndex: number): boolean {
  const tabs = host.querySelectorAll("button.l99-tab");
  const tab = chapterIndex >= 0 && chapterIndex < tabs.length ? tabs[chapterIndex] : undefined;
  if (!tab || tab.classList.contains("l99-tab-lock")) return false;
  tab.click();
  const label = `第 ${level + 1} 关`;
  const nodes = host.querySelectorAll("button.l99-node");
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!(node.getAttribute("aria-label") ?? "").startsWith(label)) continue;
    if (node.classList.contains("l99-node-lock")) return false;
    node.click();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 生命周期登记处：所有 timer / rAF / 监听都从这里出去，destroy 一把全收
// ---------------------------------------------------------------------------

type TimerId = ReturnType<typeof setTimeout>;

export interface ListenerTargetLike {
  addEventListener(type: string, fn: (e: Event) => void, opts?: unknown): void;
  removeEventListener(type: string, fn: (e: Event) => void, opts?: unknown): void;
}

export interface TimerHost {
  setTimeout(fn: () => void, ms: number): TimerId;
  clearTimeout(id: TimerId): void;
  setInterval(fn: () => void, ms: number): TimerId;
  clearInterval(id: TimerId): void;
  requestAnimationFrame?(fn: (t: number) => void): number;
  cancelAnimationFrame?(id: number): void;
}

/**
 * 一个还在跑的循环：`stop()` 单独把它收掉（重复 stop 无害）。
 * 有了它，「换一轮先停上一轮的秒表」才写得出来，不必等到 `destroy()`。
 */
export interface Loop {
  stop(): void;
  /** 还在跑吗（测试与断言用） */
  readonly live: boolean;
}

/** 已经停掉的循环：`every()` 在 `destroy()` 之后返回它，调用方不用判空 */
const DEAD_LOOP: Loop = {
  stop() {},
  get live() {
    return false;
  }
};

/**
 * 一局游戏里所有会「留下来」的东西都登记在这儿：
 * 延时、循环、动画帧、事件监听。`destroy()` 一次全部收干净，
 * 收完 `pending` 全是 0——这一条有单测盯着。
 */
export class Life {
  private readonly timers = new Set<TimerId>();
  private readonly loops = new Set<TimerId>();
  private readonly frames = new Set<number>();
  private readonly listeners: Array<{ target: ListenerTargetLike; type: string; fn: (e: Event) => void }> = [];
  private dead = false;

  constructor(private readonly host: TimerHost = globalThis as unknown as TimerHost) {}

  after(fn: () => void, ms: number): void {
    if (this.dead) return;
    const id = this.host.setTimeout(() => {
      this.timers.delete(id);
      if (!this.dead) fn();
    }, ms);
    this.timers.add(id);
  }

  /** 起一个循环，并把「单独停掉它」的把手交回去（不接也行，`destroy()` 照样收） */
  every(fn: () => void, ms: number): Loop {
    if (this.dead) return DEAD_LOOP;
    const id = this.host.setInterval(() => {
      if (!this.dead) fn();
    }, ms);
    this.loops.add(id);
    const loops = this.loops;
    const host = this.host;
    return {
      get live() {
        return loops.has(id);
      },
      stop() {
        if (!loops.delete(id)) return;
        host.clearInterval(id);
      }
    };
  }

  /** 下一帧跑一次（连续动画就在回调里再登记一次，destroy 之后自动断链） */
  frame(fn: (t: number) => void): void {
    if (this.dead) return;
    const raf = this.host.requestAnimationFrame;
    if (typeof raf !== "function") {
      this.after(() => fn(0), 16);
      return;
    }
    const id = raf.call(this.host, (t: number) => {
      this.frames.delete(id);
      if (!this.dead) fn(t);
    });
    this.frames.add(id);
  }

  on(target: ListenerTargetLike, type: string, fn: (e: Event) => void, opts?: unknown): void {
    if (this.dead) return;
    target.addEventListener(type, fn, opts);
    this.listeners.push({ target, type, fn });
  }

  /** 现在还挂着多少东西（测试用） */
  get pending(): { timers: number; loops: number; frames: number; listeners: number } {
    return {
      timers: this.timers.size,
      loops: this.loops.size,
      frames: this.frames.size,
      listeners: this.listeners.length
    };
  }

  destroy(): void {
    this.dead = true;
    for (const id of this.timers) this.host.clearTimeout(id);
    this.timers.clear();
    for (const id of this.loops) this.host.clearInterval(id);
    this.loops.clear();
    const cancel = this.host.cancelAnimationFrame;
    for (const id of this.frames) {
      if (typeof cancel === "function") cancel.call(this.host, id);
    }
    this.frames.clear();
    while (this.listeners.length > 0) {
      const item = this.listeners.pop();
      try {
        item?.target.removeEventListener(item.type, item.fn);
      } catch {
        // 元素已经被摘掉了就算了
      }
    }
  }
}

/** 这台设备想要静一点的动画吗（呼吸、尾巴、飘心都听它的） */
export function prefersReducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return typeof mm === "function" && mm("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
