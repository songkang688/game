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

// ---------------------------------------------------------------------------
// 把小屋钳进「舞台看得见的那一段」
// ---------------------------------------------------------------------------

/** 从自己的顶边到最近那条裁切线还剩多少像素（没有裁切祖先就是无限） */
export function visibleRoomPx(selfTop: number, clipperBottoms: readonly number[]): number {
  if (clipperBottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...clipperBottoms) - selfTop;
}

/**
 * 一层裁切祖先真正的那条裁切线。
 *
 * 滚动口是 **padding box**，下边框那几像素照不进内容；
 * `getBoundingClientRect().bottom` 给的却是 border box 的下沿。
 * `.game-stage` 写着 `border:4px solid #fff`（`src/styles.css`，禁改），
 * 不减这一刀就白多算 4px——CDP 实测 390×844 第 141 关：舞台内容区下沿 826，
 * 钳位却按 830 写了 `max-height:608px`，搓澡那句「用手指画圈搓…」被切掉 5px。
 * 量不出宽度就当没有，绝不算成 NaN。
 */
export function clipBottomPx(bottom: number, borderBottom: string): number {
  const w = Number.parseFloat(borderBottom);
  return Number.isFinite(w) && w > 0 ? bottom - w : bottom;
}

/** 量一次这个节点头顶到最近那条裁切线之间还剩多少（量不了就返回 Infinity） */
export function stageRoomPx(el: HTMLElement): number {
  const view = el.ownerDocument?.defaultView ?? null;
  if (!view || typeof el.getBoundingClientRect !== "function") return Number.POSITIVE_INFINITY;
  const bottoms: number[] = [];
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = view.getComputedStyle(p);
    const oy = cs.overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "hidden") {
      bottoms.push(clipBottomPx(p.getBoundingClientRect().bottom, cs.borderBottomWidth));
    }
  }
  return visibleRoomPx(el.getBoundingClientRect().top, bottoms);
}

/**
 * 猫从大到小的几档画面高度（px）。装不下就往下退一档，退到最后一档还装不下才让小屋自己滚。
 * 一路退到 92px 是因为 320×640 上「舞台看得见的那一段」只有 304px，
 * 除猫以外的东西（任务条、心情条、气泡、托盘、提示行、内边距）就要去掉 200px 上下。
 */
export const CAT_FIT_STEPS = [260, 220, 190, 160, 138, 120, 104, 92] as const;

/**
 * 把小屋收进舞台看得见的那一段：先一档一档地收猫，收到最小还装不下才让它自己滚。
 *
 * 为什么非做不可：真机 360×720 / 360×640 / 320×640 上，`.game-stage` 是
 * `overflow:hidden` 且定高的（实测 `scrollHeight 544 > clientHeight 530`），
 * 文档本身又不滚（`scrollingElement.scrollHeight === clientHeight`）。
 * 小屋自己却由 `min-height:460px` 加一只 296px 高的猫撑到 488px，
 * 于是饭碗、食物托盘、提示行整片落在裁切线以下，`elementFromPoint` 一律返回 null——
 * 第 1 关连「喂饭」这一步都做不出来。`.game-stage{overflow:hidden}` 写在
 * `src/styles.css` 里，是本档的禁改文件（交窗口1）；但本款够得着自己的盒子，
 * 量一次裁切线的下沿，按它把猫收小就够了。
 *
 * 先收猫、后滚动是有先后的：矮屏上真正占地方的是那只猫，收它一档就能让整关不用滚；
 * 而滚动容器一旦出现，拖食物的手指一动就会连带滚屏，比小一点的猫难用得多。
 *
 * 装得下就把 `--ktc-cat-h` / `max-height` / `overflow-y` / `min-height` 原样还回去，
 * 免得高屏上凭空多出一个滚动容器。返回拆监听的函数，`destroy` 时叫一声。
 */
export function fitIntoStage(el: HTMLElement): { relayout: () => void; dispose: () => void } {
  const view = el.ownerDocument?.defaultView ?? null;
  const measurable = typeof el.getBoundingClientRect === "function" && !!view;
  const reset = (): void => {
    if (!measurable) return;
    el.classList.remove("ktc-fit");
    el.classList.remove("ktc-scroll");
    el.style.removeProperty("--ktc-cat-h");
    el.style.maxHeight = "";
    el.style.overflowY = "";
    el.style.minHeight = "";
  };
  const relayout = (): void => {
    if (!measurable || !view) return;
    // 先把上一次收出来的值还原，不然量到的是收完的高度，越量越小
    reset();
    const room = stageRoomPx(el);
    if (!Number.isFinite(room) || room <= 0) return;
    if (el.scrollHeight <= room + 1) return;
    // `min-height:460px` 会盖过一切，收的时候得先让开
    el.classList.add("ktc-fit");
    el.style.minHeight = "0";
    for (const h of CAT_FIT_STEPS) {
      el.style.setProperty("--ktc-cat-h", `${h}px`);
      if (el.scrollHeight <= room + 1) return;
    }
    // 猫收到最小还是装不下（多猫关 + 搓澡区就会这样），剩下的交给滚动
    el.style.maxHeight = `${Math.floor(room)}px`;
    el.style.overflowY = "auto";
    // 打个记号：提示行这时候要粘在滚动口下沿，不然「这一关要干什么」滚不到就看不见
    el.classList.add("ktc-scroll");
  };
  relayout();
  let live = true;
  nextFrame(view, () => {
    if (live) relayout();
  });
  view?.addEventListener("resize", relayout);
  return {
    relayout,
    dispose(): void {
      live = false;
      view?.removeEventListener("resize", relayout);
      reset();
    }
  };
}

/**
 * 下一帧再叫一次。
 *
 * 为什么非补这一帧不可：钳位是在 `playLevel` 里量的，而平台顶栏 `.l99-stagebar`
 * 在窄屏上会折行——折之前和折之后，这一屏的起点差 8px。量在折行之前，
 * `max-height` 就写大了 8px，钳完舞台照样裁掉 8px（CDP 实测 360×640 第 141 关：
 * 写进去 408px，真正剩下的只有 400px）。拿不到 `requestAnimationFrame`
 * （测试桩 / SSR）就安静跳过，不改变任何既有行为。
 */
function nextFrame(view: (Window & typeof globalThis) | null, fn: () => void): void {
  const raf = view?.requestAnimationFrame;
  if (typeof raf !== "function") return;
  raf.call(view, () => fn());
}

/** 长列表钳到这个高度以下就不值得再钳了——再矮连一张卡片都露不全 */
export const LIST_MIN_ROOM = 160;

/**
 * 把一块**本来就该翻着看**的长列表钳进舞台看得见的那一段，并给它自己挂一条滚动条。
 *
 * 与 `fitIntoStage()` 的分工：那一份是「先收猫、收不下才滚」，为的是让整关不用滚
 * （拖食物的手指一动就连带滚屏，比小一点的猫难用得多）；这一份**只做钳位与挂滚动条**，
 * 给相册这种一屏本来就装不下的清单用。
 *
 * 为什么非做不可：小屋相册 24 件收藏一共 2809px 高，`.game-stage` 只给 530–730px，
 * 裁掉 2183–2383px，而 `.ktc-album` 是 `overflow:visible / max-height:none`，
 * **一个可滚祖先都没有**——真手指往上甩三次 `scrollTop` 一格没动，
 * 24 颗 `⭐N 换回来` 里 20–22 颗永远点不着。星星兑换是相册唯一的主动玩法（W5R2-C-03 阻断）。
 *
 * 装得下就把值原样还回去，免得高屏上凭空多出一个滚动容器。
 */
export function scrollIntoStage(el: HTMLElement, minRoom = LIST_MIN_ROOM): { relayout: () => void; dispose: () => void } {
  const view = el.ownerDocument?.defaultView ?? null;
  const measurable = typeof el.getBoundingClientRect === "function" && !!view;
  const reset = (): void => {
    if (!measurable) return;
    el.style.maxHeight = "";
    el.style.overflowY = "";
  };
  const relayout = (): void => {
    if (!measurable || !view) return;
    reset();
    const room = stageRoomPx(el);
    // 量不到裁切线（高屏）或已经整块在裁切线以下（这时候钳只会把它压成一条缝）就不管
    if (!Number.isFinite(room) || room < minRoom) return;
    if (el.scrollHeight <= room + 1) return;
    el.style.maxHeight = `${Math.floor(room)}px`;
    el.style.overflowY = "auto";
  };
  relayout();
  let live = true;
  nextFrame(view, () => {
    if (live) relayout();
  });
  view?.addEventListener("resize", relayout);
  return {
    relayout,
    dispose(): void {
      live = false;
      view?.removeEventListener("resize", relayout);
      reset();
    }
  };
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
