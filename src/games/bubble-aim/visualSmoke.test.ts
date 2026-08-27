// bubble-aim · 1.3 视觉升级运行期冒烟(桩 DOM + 记录型 canvas,box-hamster 一个路数):
// 真跑 mount → 进第 1 关 → 走几帧 → 拖动瞄准 → Tab 换弹 → destroy,
// 断言新皮肤的 token 色真的画上了 canvas、色觉标记仍渲染、瞄准点串出现、
// 换弹计时挂上又被 destroy 清零、关卡数据一个字不改、reduced 下换弹瞬时。
// 只断言视觉与「状态没被写」,不断言任何玩法数值。
import { afterEach, describe, expect, it } from "vitest";
import { BA_COLORS } from "./visual";
import { LEVELS } from "./levels";

type Fn = (...args: unknown[]) => unknown;

/** 记录型 2D 上下文:把样式赋值与关键笔迹按顺序记进 ops */
function makeCtx(ops: string[]): Record<string, unknown> {
  const gradient = (): { addColorStop: (o: number, c: string) => void } => ({
    addColorStop: (_o: number, c: string) => void ops.push(`stop=${c}`),
  });
  let fillStyle: unknown = "";
  let strokeStyle: unknown = "";
  return {
    globalAlpha: 1,
    lineWidth: 1,
    lineDashOffset: 0,
    font: "",
    textAlign: "left",
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: unknown) {
      fillStyle = v;
      ops.push(typeof v === "string" ? `fillStyle=${v}` : "fillStyle=[grad]");
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(v: unknown) {
      strokeStyle = v;
      ops.push(typeof v === "string" ? `strokeStyle=${v}` : "strokeStyle=[grad]");
    },
    save: () => void ops.push("save"),
    restore: () => void ops.push("restore"),
    beginPath: () => {},
    closePath: () => {},
    arc: () => void ops.push("arc"),
    ellipse: () => void ops.push("ellipse"),
    moveTo: () => {},
    lineTo: () => {},
    fill: () => void ops.push("fill"),
    stroke: () => void ops.push("stroke"),
    fillRect: () => void ops.push("fillRect"),
    roundRect: () => {},
    setLineDash: () => {},
    fillText: (t: string) => void ops.push(`fillText=${t}`),
    strokeText: () => {},
    translate: () => {},
    rotate: () => void ops.push("rotate"),
    scale: () => void ops.push("scale"),
    createRadialGradient: gradient,
    createLinearGradient: gradient,
  };
}

class El {
  tag: string;
  children: El[] = [];
  listeners = new Map<string, Fn[]>();
  style: Record<string, string> = {};
  className = "";
  title = "";
  type = "";
  textContent = "";
  parentEl: El | null = null;
  selectorCache = new Map<string, El>();
  ctxOps: string[] | null = null;
  private html = "";
  constructor(tag: string) {
    this.tag = tag;
  }
  set innerHTML(v: string) {
    this.html = v;
    if (v === "") this.children = [];
  }
  get innerHTML(): string {
    return this.html;
  }
  appendChild(c: El): El {
    this.children.push(c);
    c.parentEl = this;
    return c;
  }
  append(...cs: El[]): void {
    for (const c of cs) this.appendChild(c);
  }
  removeChild(c: El): El {
    this.children = this.children.filter((x) => x !== c);
    return c;
  }
  remove(): void {
    this.parentEl?.removeChild(this);
  }
  addEventListener(t: string, f: Fn): void {
    const arr = this.listeners.get(t) ?? [];
    arr.push(f);
    this.listeners.set(t, arr);
  }
  removeEventListener(t: string, f: Fn): void {
    this.listeners.set(t, (this.listeners.get(t) ?? []).filter((x) => x !== f));
  }
  dispatch(t: string, ev: Record<string, unknown> = {}): void {
    for (const f of [...(this.listeners.get(t) ?? [])]) f({ preventDefault: () => {}, ...ev });
  }
  /** mount 用 innerHTML 铺骨架,这里按选择器发同一个桩元素(canvas 带记录 ctx) */
  querySelector(sel: string): El {
    let el = this.selectorCache.get(sel);
    if (!el) {
      el = new El(sel.includes("canvas") ? "canvas" : "div");
      if (el.tag === "canvas") el.ctxOps = [];
      this.selectorCache.set(sel, el);
    }
    return el;
  }
  getContext(): Record<string, unknown> {
    return makeCtx(this.ctxOps!);
  }
  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: 360, height: 480 };
  }
  all(): El[] {
    return [this, ...this.children.flatMap((c) => c.all())];
  }
}

interface StubWin {
  dispatch: (t: string, ev?: Record<string, unknown>) => void;
}

function installDom(reduced: boolean): StubWin {
  const g = globalThis as Record<string, unknown>;
  g.document = { createElement: (tag: string) => new El(tag) };
  const winListeners = new Map<string, Fn[]>();
  const win: StubWin & Record<string, unknown> = {
    addEventListener: (t: string, f: Fn) => {
      const arr = winListeners.get(t) ?? [];
      arr.push(f);
      winListeners.set(t, arr);
    },
    removeEventListener: (t: string, f: Fn) => {
      winListeners.set(t, (winListeners.get(t) ?? []).filter((x) => x !== f));
    },
    dispatch: (t: string, ev: Record<string, unknown> = {}) => {
      for (const f of [...(winListeners.get(t) ?? [])]) f({ preventDefault: () => {}, ...ev });
    },
  };
  g.window = win;
  let rafCb: ((t: number) => void) | null = null;
  g.requestAnimationFrame = (cb: (t: number) => void): number => {
    rafCb = cb;
    return 1;
  };
  g.cancelAnimationFrame = () => {};
  g.__stepRaf = (t: number) => {
    const cb = rafCb;
    rafCb = null;
    cb?.(t);
  };
  if (reduced) g.matchMedia = () => ({ matches: true });
  return win;
}

function uninstallDom(): void {
  const g = globalThis as Record<string, unknown>;
  for (const k of ["document", "window", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "__stepRaf"]) {
    delete g[k];
  }
}

afterEach(() => uninstallDom());

interface Mounted {
  game: { destroy: () => void; fxCount: () => number };
  canvas: El;
  ops: string[];
  win: StubWin;
  step: (ms: number) => void;
}

/** 挂载 → 点开第 1 关 → 把 rAF 走起来 */
async function mountGame(reduced = false): Promise<Mounted> {
  const win = installDom(reduced);
  const { mount } = await import("./index");
  const root = new El("div");
  const game = mount({
    root: root as unknown as HTMLElement,
    play: () => {},
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {},
  });
  const wrap = root.children[0];
  const themes = wrap.querySelector(".ba-themes");
  const lv1 = themes.all().find((e) => e.className.includes("ba-lv") && e.listeners.has("click"))!;
  expect(lv1).toBeTruthy();
  lv1.dispatch("click");
  const canvas = wrap.querySelector(".ba-canvas");
  let now = 0;
  const step = (ms: number): void => {
    now += ms;
    (globalThis as Record<string, unknown> & { __stepRaf: (t: number) => void }).__stepRaf(now);
  };
  step(0); // 第一帧只记 lastTime
  return { game, canvas, ops: canvas.ctxOps!, win, step };
}

describe("冒烟 · 换肤后的一帧:token 色上画布,色觉标记仍渲染", () => {
  it("藤蔓/落影/吊灯/色觉标记的颜色都真的画进 canvas;关卡数据一个字不改", async () => {
    const layoutBefore = JSON.stringify(LEVELS[0].layout);
    const m = await mountGame();
    m.step(16);
    m.step(16);
    expect(m.ops).toContain(`strokeStyle=${BA_COLORS.baVine}`); // ② 藤蔓装饰带
    expect(m.ops).toContain(`fillStyle=${BA_COLORS.baShadow}`); // ⑦ 炮台落影
    expect(m.ops).toContain(`fillStyle=${BA_COLORS.baLamp}`); // 吊灯暖光/星徽
    expect(m.ops).toContain("fillStyle=rgba(255,255,255,0.7)"); // 色觉辅助标记(功能件)
    expect(JSON.stringify(LEVELS[0].layout)).toBe(layoutBefore);
    m.game.destroy();
    expect(m.game.fxCount()).toBe(0);
  });

  it("拖动瞄准:渐隐点串出现(功能件);pointercancel 收起不发射", async () => {
    const m = await mountGame();
    m.step(16);
    m.canvas.dispatch("pointerdown", { clientX: 180, clientY: 200 });
    m.step(16);
    expect(m.ops.some((o) => o.startsWith("fillStyle=rgba(90, 150, 220"))).toBe(true);
    m.win.dispatch("pointercancel");
    m.game.destroy();
  });
});

describe("冒烟 · 换弹计时与 destroy 清零", () => {
  it("Tab 换弹挂上 150ms 视觉计时,destroy 当场归零", async () => {
    const m = await mountGame();
    m.step(16);
    m.win.dispatch("keydown", { key: "Tab" });
    expect(m.game.fxCount()).toBeGreaterThan(0);
    m.step(16); // 过场进行中还在计时
    expect(m.game.fxCount()).toBeGreaterThan(0);
    m.game.destroy();
    expect(m.game.fxCount()).toBe(0);
  });

  it("reduced:换弹瞬时到位,不挂任何计时;画面照常出帧", async () => {
    const m = await mountGame(true);
    m.step(16);
    m.win.dispatch("keydown", { key: "Tab" });
    expect(m.game.fxCount()).toBe(0);
    m.step(16);
    expect(m.ops).toContain(`strokeStyle=${BA_COLORS.baVine}`);
    m.game.destroy();
    expect(m.game.fxCount()).toBe(0);
  });
});
