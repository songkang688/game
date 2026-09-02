// 1.3 视觉升级 · 运行期冒烟:桩 DOM/canvas(和 flight-chess/flow.test.ts 一个路数)
// 下真跑 mount → 无尽模式 → 多帧 draw,验证重绘代码在运行期不抛异常——
// 点对(UFO 仪式 + 星屑)、点错(轻晃 + 问号云)、reduced 静态分支各走一遍。
// 只断言「不炸」与「点中的目标真的打了勾」,不断言任何玩法数值。
import { afterEach, describe, expect, it } from "vitest";

type Fn = (...args: unknown[]) => unknown;

function makeCtx(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  const target: Record<string | symbol, unknown> = {};
  return new Proxy(target, {
    get(t, prop) {
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => gradient;
      if (prop === "measureText") return () => ({ width: 48 });
      if (prop in t) return t[prop];
      return () => undefined;
    },
    set(t, prop, v) {
      t[prop] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const ctxStub = makeCtx();

class El {
  tag: string;
  children: El[] = [];
  listeners = new Map<string, Fn[]>();
  attrs = new Map<string, string>();
  style: Record<string, string> = {};
  className = "";
  textContent = "";
  hidden = false;
  disabled = false;
  type = "";
  value = "";
  width = 0;
  height = 0;
  parentEl: El | null = null;
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
  append(...cs: Array<El | string>): void {
    for (const c of cs) if (c instanceof El) this.appendChild(c);
  }
  prepend(...cs: Array<El | string>): void {
    for (const c of cs) if (c instanceof El) this.children.unshift(c);
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
  removeEventListener(): void {}
  dispatch(t: string, ev: Record<string, unknown> = {}): void {
    for (const f of this.listeners.get(t) ?? []) f({ preventDefault: () => {}, stopPropagation: () => {}, ...ev });
  }
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }
  removeAttribute(k: string): void {
    this.attrs.delete(k);
  }
  getBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number } {
    return { left: 0, top: 0, width: 360, height: 230, right: 360, bottom: 230 };
  }
  focus(): void {}
  blur(): void {}
  click(): void {
    this.dispatch("click");
  }
  getContext(): CanvasRenderingContext2D {
    return ctxStub;
  }
  get clientWidth(): number {
    return 360;
  }
  get clientHeight(): number {
    return 230;
  }
  get offsetWidth(): number {
    return 360;
  }
  get classList(): { add: Fn; remove: Fn; toggle: Fn; contains: () => boolean } {
    return { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false };
  }
  get parentElement(): El | null {
    return this.parentEl;
  }
  get isConnected(): boolean {
    return true;
  }
  get firstChild(): El | null {
    return this.children[0] ?? null;
  }
  querySelector(): null {
    return null;
  }
  querySelectorAll(): El[] {
    return [];
  }
  contains(): boolean {
    return false;
  }
  scrollIntoView(): void {}
  set scrollLeft(_v: number) {}
  get scrollLeft(): number {
    return 0;
  }
  /** 收集整棵子树,找按钮用 */
  all(): El[] {
    return [this, ...this.children.flatMap((c) => c.all())];
  }
}

interface RafPump {
  cbs: Array<(t: number) => void>;
  pump(times: number, dtMs: number): void;
}

function installDom(): RafPump {
  const g = globalThis as Record<string, unknown>;
  const rafs: Array<(t: number) => void> = [];
  let now = 1000;
  const pump: RafPump = {
    cbs: rafs,
    pump(times: number, dtMs: number) {
      for (let i = 0; i < times; i++) {
        now += dtMs;
        const batch = rafs.splice(0, rafs.length);
        for (const cb of batch) cb(now);
      }
    },
  };
  g.document = {
    createElement: (tag: string) => new El(tag),
    createTextNode: () => new El("#text"),
    body: new El("body"),
    documentElement: new El("html"),
    addEventListener: () => {},
    removeEventListener: () => {},
    activeElement: null,
    hidden: false,
  };
  const winListeners = new Map<string, Fn[]>();
  g.window = {
    addEventListener: (t: string, f: Fn) => {
      const arr = winListeners.get(t) ?? [];
      arr.push(f);
      winListeners.set(t, arr);
    },
    removeEventListener: () => {},
    dispatch: (t: string, ev: Record<string, unknown>) => {
      for (const f of [...(winListeners.get(t) ?? [])]) f({ preventDefault: () => {}, ...ev });
    },
    setTimeout,
    clearTimeout,
    innerWidth: 360,
    innerHeight: 640,
  };
  g.requestAnimationFrame = (cb: (t: number) => void): number => {
    rafs.push(cb);
    return rafs.length;
  };
  g.cancelAnimationFrame = () => {};
  g.Path2D = class {
    roundRect(): void {}
    rect(): void {}
    moveTo(): void {}
    lineTo(): void {}
    arc(): void {}
    ellipse(): void {}
    quadraticCurveTo(): void {}
    closePath(): void {}
  };
  return pump;
}

function uninstallDom(): void {
  const g = globalThis as Record<string, unknown>;
  delete g.document;
  delete g.window;
  delete g.requestAnimationFrame;
  delete g.cancelAnimationFrame;
  delete g.Path2D;
}

afterEach(() => uninstallDom());

describe("冒烟:1.3 视觉重绘运行期不炸", () => {
  it("mount → 无尽模式 → 点对/点错/多帧渲染/destroy 全程无异常", async () => {
    const pump = installDom();
    const { mount } = await import("./index");
    const { buildEndlessRound } = await import("./levels");
    const root = new El("div");
    const api = {
      root: root as unknown as HTMLElement,
      play: () => {},
      addStars: () => {},
      spendStars: () => true,
      stars: () => 0,
    } as never;
    const handle = mount(api);
    // 找到「无尽寻找」按钮点进去,开出真正的 createRunner
    const endlessBtn = root.all().find((el) => el.className.includes("as-open") && !el.className.includes("as-open-vs"));
    expect(endlessBtn).toBeTruthy();
    endlessBtn!.dispatch("click");
    // 跑 90 帧(约 1.5s):星空 / 亮星 / 流星调度 / idle 动作全走一遍
    pump.pump(90, 16);
    // 对着第 1 轮的目标与空地各点一下:走「找到 → UFO 仪式」与「点错 → 问号云」两条路
    const lv = buildEndlessRound(1);
    const canvas = root.all().find((el) => el.tag === "canvas" && el.className.includes("as-canvas"));
    expect(canvas).toBeTruthy();
    const targetSpot = lv.mode === "find" ? lv.spots[lv.targets[0].spot] : lv.spots[0];
    const missSpot = lv.spots.find((_, i) => lv.mode === "find" && !lv.targets.some((t) => t.spot === i)) ?? lv.spots[1];
    // 场景 1000×640 → 画布 360×230:等比缩放后点到目标正中与一个空藏身点
    const win = (globalThis as { window?: { dispatch: (t: string, ev: Record<string, unknown>) => void } }).window!;
    const scale = Math.min(360 / 1000, 230 / 640);
    const sx = (v: number): number => 360 / 2 + (v - 500) * scale;
    const sy = (v: number): number => 230 / 2 + (v - 320) * scale;
    let pid = 1;
    for (const p of [targetSpot, missSpot]) {
      canvas!.dispatch("pointerdown", { pointerId: pid, clientX: sx(p.x), clientY: sy(p.y) });
      win.dispatch("pointerup", { pointerId: pid, clientX: sx(p.x), clientY: sy(p.y) });
      pid++;
      // 点对(UFO 仪式 + 星屑)与点错(轻晃 + 问号云)各自跑满动画
      pump.pump(40, 16);
    }
    pump.pump(80, 16);
    // 点中的那个目标要真的被找到:清单里出现「✓ 找到」的卡
    expect(root.all().some((el) => el.className.includes("als-done"))).toBe(true);
    handle.destroy();
  });

  it("reduced-motion 下同一条链路也不炸(静态层次分支)", async () => {
    const pump = installDom();
    (globalThis as Record<string, unknown>).matchMedia = () => ({ matches: true });
    const { mount } = await import("./index");
    const root = new El("div");
    const api = {
      root: root as unknown as HTMLElement,
      play: () => {},
      addStars: () => {},
      spendStars: () => true,
      stars: () => 0,
    } as never;
    const handle = mount(api);
    const endlessBtn = root.all().find((el) => el.className.includes("as-open") && !el.className.includes("as-open-vs"));
    endlessBtn!.dispatch("click");
    pump.pump(60, 16);
    handle.destroy();
    delete (globalThis as Record<string, unknown>).matchMedia;
  });
});
