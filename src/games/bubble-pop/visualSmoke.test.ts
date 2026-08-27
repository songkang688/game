// 泡泡噗噗 · 1.3 视觉升级运行期冒烟(桩 DOM,和 box-hamster/visualSmoke 一个路数):
// 真跑 paintCell / runCollapse / paintAmbience,断言 dataset.v 状态镜像原样、
// 破裂幽灵按波次给延迟且结算终态与 planCollapse 一致、果冻只加类、
// reduced 下波次/果冻/装饰气泡类名不加、装饰清场归零、热区样式未被写入。
// 只断言视觉与「状态没被改」,不断言任何玩法数值。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CHAIN, planCollapse } from "./collapse";
import { FROZEN_OFFSET, RAINBOW, STONE } from "./logic";
import { BP_TIMINGS } from "./visual";

type Fn = (...args: unknown[]) => unknown;

class El {
  tag: string;
  children: El[] = [];
  attrs = new Map<string, string>();
  style: Record<string, string> & { setProperty?: (k: string, v: string) => void };
  dataset: Record<string, string> = {};
  className = "";
  parentEl: El | null = null;
  rect = { left: 0, top: 0, width: 40, height: 40 };
  clientWidth = 40;
  private html = "";
  private text = "";

  constructor(tag: string) {
    this.tag = tag;
    const bag: Record<string, string> & { setProperty?: (k: string, v: string) => void } = {};
    bag.setProperty = (k: string, v: string): void => {
      bag[k] = v;
    };
    this.style = bag;
  }
  set innerHTML(v: string) {
    this.html = v;
    if (v === "") this.children = [];
  }
  get innerHTML(): string {
    return this.html;
  }
  set textContent(v: string) {
    this.text = v;
    // 和真 DOM 一致:写 textContent 会清空子节点
    this.children = [];
  }
  get textContent(): string {
    return this.text;
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
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return this.rect;
  }
  get classList(): {
    add: (...cs: string[]) => void;
    remove: (...cs: string[]) => void;
    contains: (c: string) => boolean;
    toggle: (c: string, force?: boolean) => void;
  } {
    const self = this;
    return {
      add: (...cs: string[]) => {
        const cur = self.className.split(/\s+/).filter(Boolean);
        for (const c of cs) if (!cur.includes(c)) cur.push(c);
        self.className = cur.join(" ");
      },
      remove: (...cs: string[]) => {
        self.className = self.className
          .split(/\s+/)
          .filter((c) => c && !cs.includes(c))
          .join(" ");
      },
      contains: (c: string) => self.className.split(/\s+/).includes(c),
      toggle: (c: string, force?: boolean) => {
        const has = self.className.split(/\s+/).includes(c);
        const want = force ?? !has;
        if (want && !has) self.classList.add(c);
        if (!want && has) self.classList.remove(c);
      },
    };
  }
  /** 收集整棵子树,找元素用 */
  all(): El[] {
    return [this, ...this.children.flatMap((c) => c.all())];
  }
  byClass(cls: string): El[] {
    return this.all().filter((e) => e.className.split(/\s+/).includes(cls));
  }
}

const saved: Record<string, unknown> = {};
let rafQ: Fn[] = [];
let vt = 0;
let reducedFlag = false;

function installDom(reduced: boolean): void {
  const g = globalThis as Record<string, unknown>;
  reducedFlag = reduced;
  for (const k of ["document", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "performance"]) {
    saved[k] = g[k];
  }
  g.document = {
    createElement: (t: string) => new El(t),
    // level99 → ui/dialogs → engine/audio 在模块加载时会挂全局监听,给个空实现
    addEventListener: () => {},
    removeEventListener: () => {},
    hidden: false,
  };
  g.matchMedia = () => ({ matches: reducedFlag });
  rafQ = [];
  vt = 0;
  g.requestAnimationFrame = (fn: Fn): number => rafQ.push(fn);
  g.cancelAnimationFrame = (): void => {};
  g.performance = { now: () => vt };
}

function restoreDom(): void {
  const g = globalThis as Record<string, unknown>;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete g[k];
    else g[k] = v;
  }
}

/** 手摇时间轮,把塌陷时间线一路播到 done */
function drive(maxFrames = 400): void {
  let guard = 0;
  while (rafQ.length > 0 && guard++ < maxFrames) {
    vt += 40;
    const cb = rafQ.shift() as Fn;
    cb(vt);
  }
}

interface Hooks {
  paintCell: (el: unknown, v: number) => void;
  paintBoard: (cells: unknown[], grid: number[][], rows: number) => void;
  runCollapse: (host: unknown, popped: Array<[number, number]>, origin: [number, number], done: () => void) => void;
  paintAmbience: (wrap: unknown) => void;
}

async function loadHooks(): Promise<Hooks> {
  const mod = await import("./index");
  return mod.__bpVisualHooks as unknown as Hooks;
}

/** 8 列小盘 + 桩宿主:pending 收集装饰清场回调,flush 一把倒干净 */
function makeHost(hooks: Hooks, grid: number[][]): {
  board: El;
  cells: El[];
  host: Record<string, unknown>;
  pending: Array<() => void>;
  flush: () => void;
} {
  const rows = grid.length;
  const board = new El("div");
  board.rect = { left: 0, top: 0, width: 320, height: rows * 40 };
  const cells: El[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 8; c++) {
      const btn = new El("button");
      btn.rect = { left: c * 40, top: r * 40, width: 40, height: 40 };
      board.appendChild(btn);
      cells.push(btn);
    }
  }
  hooks.paintBoard(cells, grid, rows);
  const pending: Array<() => void> = [];
  const host = {
    rows,
    cells,
    grid,
    gravityUp: false,
    render: () => hooks.paintBoard(cells, grid, rows),
    alive: () => true,
    onRaf: () => {},
    board: () => board,
    after: (fn: () => void) => pending.push(fn),
  };
  return {
    board,
    cells,
    host,
    pending,
    flush: () => {
      while (pending.length > 0) (pending.shift() as () => void)();
    },
  };
}

afterEach(restoreDom);

describe("桩 DOM 冒烟 · 常规动效", () => {
  beforeEach(() => installDom(false));

  it("paintCell:dataset.v 状态镜像原样,特殊泡挂 SVG 纹样,普通泡留图案", async () => {
    const hooks = await loadHooks();
    for (const v of [-1, 0, 3, FROZEN_OFFSET + 1, CHAIN, STONE, RAINBOW]) {
      const el = new El("button");
      hooks.paintCell(el, v);
      expect(el.dataset.v, `v=${v} 镜像丢了`).toBe(String(v));
      if (v < 0) {
        expect(el.style.background).toBe("");
        expect(el.classList.contains("bp-empty")).toBe(true);
        expect(el.children.length).toBe(0);
      } else {
        expect(el.style.background).toContain("gradient(");
      }
    }
    const rainbow = new El("button");
    hooks.paintCell(rainbow, RAINBOW);
    expect(rainbow.classList.contains("bp-rainbow")).toBe(true);
    expect(rainbow.byClass("bp-pat")[0]?.innerHTML).toContain("<svg");
    const plain = new El("button");
    hooks.paintCell(plain, 2);
    expect(plain.byClass("bbp-mark")[0]?.textContent).toBe("■");
  });

  it("paintCell 重绘不残留:彩虹 → 空格,类与子节点全部撤干净", async () => {
    const hooks = await loadHooks();
    const el = new El("button");
    hooks.paintCell(el, RAINBOW);
    hooks.paintCell(el, -1);
    expect(el.dataset.v).toBe("-1");
    expect(el.classList.contains("bp-rainbow")).toBe(false);
    expect(el.children.length).toBe(0);
  });

  it("runCollapse:幽灵按曼哈顿波次给延迟,本体隐身,结算终态与 planCollapse 一致", async () => {
    const hooks = await loadHooks();
    const grid = [
      [1, 2, 1, 0, 0, 0, 0, 0],
      [-1, -1, 0, 0, 0, 0, 0, 0],
    ];
    const expected = planCollapse(grid, 8, false).next;
    const { board, cells, host, flush } = makeHost(hooks, grid);
    const popped: Array<[number, number]> = [[1, 0], [1, 1]];
    let doneCalled = false;
    hooks.runCollapse(host, popped, [1, 0], () => {
      doneCalled = true;
    });
    const ghosts = board.byClass("bp-burst");
    expect(ghosts.length).toBe(2);
    const waits = ghosts.map((gh) => parseInt(gh.style["--bp-wait"] ?? "0", 10));
    // 点击格第 0 波(0–12ms),隔壁第 1 波(40–52ms)
    expect(waits[0]).toBeGreaterThanOrEqual(0);
    expect(waits[0]).toBeLessThanOrEqual(BP_TIMINGS.waveJitterMs);
    expect(waits[1]).toBeGreaterThanOrEqual(BP_TIMINGS.waveStepMs);
    expect(waits[1]).toBeLessThanOrEqual(BP_TIMINGS.waveStepMs + BP_TIMINGS.waveJitterMs);
    // 幽灵放出去,本体挂 bp-ghosted 而不是 1.2 的 bbp-pop
    expect(cells[8].classList.contains("bp-ghosted")).toBe(true);
    expect(cells[8].classList.contains("bbp-pop")).toBe(false);
    drive();
    expect(doneCalled).toBe(true);
    // 波次纯装饰:终态盘面与纯逻辑 planCollapse 一字不差,dataset 镜像同步
    expect(grid).toEqual(expected);
    for (let i = 0; i < cells.length; i++) {
      expect(cells[i].dataset.v).toBe(String(expected[Math.floor(i / 8)][i % 8]));
    }
    // 装饰清场:幽灵全部移除、果冻类摘干净
    flush();
    expect(board.byClass("bp-burst").length).toBe(0);
    expect(board.byClass("bp-jelly").length).toBe(0);
  });

  it("波次上限:再远的格子 --bp-wait 也不超过 5×40+12ms", async () => {
    const hooks = await loadHooks();
    const grid = [
      [0, 0, 0, 0, 0, 0, 0, 1],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ];
    const { board, host } = makeHost(hooks, grid);
    const popped: Array<[number, number]> = [];
    for (let c = 0; c < 8; c++) popped.push([0, c], [1, c]);
    hooks.runCollapse(host, popped, [0, 0], () => {});
    const waits = board.byClass("bp-burst").map((gh) => parseInt(gh.style["--bp-wait"] ?? "0", 10));
    expect(waits.length).toBe(16);
    for (const w of waits) {
      expect(w).toBeLessThanOrEqual(5 * BP_TIMINGS.waveStepMs + BP_TIMINGS.waveJitterMs);
    }
    drive();
  });

  it("补位果冻:有下落时终态格短暂挂 bp-jelly,清场后摘除", async () => {
    const hooks = await loadHooks();
    const grid = [
      [3, -1, -1, -1, -1, -1, -1, -1],
      [1, -1, -1, -1, -1, -1, -1, -1],
    ];
    const { board, cells, host, flush } = makeHost(hooks, grid);
    // 消掉底下那颗,顶上的 3 会落下来
    grid[1][0] = -1;
    hooks.runCollapse(host, [[1, 0]], [1, 0], () => {});
    drive();
    expect(cells[8].classList.contains("bp-jelly")).toBe(true);
    expect(board.byClass("bp-jelly").length).toBe(1);
    flush();
    expect(board.byClass("bp-jelly").length).toBe(0);
  });

  it("paintAmbience:光柱 2 + 水草 1 + 装饰气泡 3–5 颗,全部 aria-hidden、不碰按钮", async () => {
    const hooks = await loadHooks();
    const wrap = new El("div");
    hooks.paintAmbience(wrap);
    expect(wrap.byClass("bp-beam").length).toBe(2);
    expect(wrap.byClass("bp-weeds").length).toBe(1);
    const decor = wrap.byClass("bp-decor");
    expect(decor.length).toBeGreaterThanOrEqual(3);
    expect(decor.length).toBeLessThanOrEqual(5);
    for (const el of [...wrap.byClass("bp-beam"), ...wrap.byClass("bp-weeds"), ...decor]) {
      expect(el.attrs.get("aria-hidden")).toBe("true");
      expect(el.tag).not.toBe("button");
    }
    expect(wrap.byClass("bp-weeds")[0].innerHTML).toContain("<svg");
  });

  it("热区回归:动效全程没有往泡泡按钮上写宽高/内边距", async () => {
    const hooks = await loadHooks();
    const grid = [
      [0, 0, 1, 1, 1, 1, 1, 1],
      [2, 2, 1, 1, 1, 1, 1, 1],
    ];
    const { cells, host, flush } = makeHost(hooks, grid);
    hooks.runCollapse(host, [[0, 0], [0, 1]], [0, 0], () => {});
    drive();
    flush();
    for (const el of cells) {
      expect(el.style.width).toBeUndefined();
      expect(el.style.height).toBeUndefined();
      expect(el.style.padding).toBeUndefined();
    }
  });
});

describe("桩 DOM 冒烟 · prefers-reduced-motion", () => {
  beforeEach(() => installDom(true));

  it("reduced:不放幽灵、退回 bbp-pop 淡出,果冻/装饰气泡类名不加", async () => {
    const hooks = await loadHooks();
    const grid = [
      [3, -1, -1, -1, -1, -1, -1, -1],
      [1, 1, -1, -1, -1, -1, -1, -1],
    ];
    const { board, cells, host, pending, flush } = makeHost(hooks, grid);
    grid[1][0] = -1;
    grid[1][1] = -1;
    hooks.runCollapse(host, [[1, 0], [1, 1]], [1, 0], () => {});
    expect(board.byClass("bp-burst").length).toBe(0);
    expect(cells[8].classList.contains("bbp-pop")).toBe(true);
    expect(cells[8].classList.contains("bp-ghosted")).toBe(false);
    drive();
    flush();
    expect(board.byClass("bp-jelly").length).toBe(0);
    expect(pending.length).toBe(0);
    const wrap = new El("div");
    hooks.paintAmbience(wrap);
    expect(wrap.byClass("bp-decor").length).toBe(0);
    expect(wrap.byClass("bp-beam").length).toBe(2);
    expect(wrap.byClass("bp-weeds").length).toBe(1);
  });
});
