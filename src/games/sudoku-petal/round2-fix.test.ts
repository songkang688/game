/**
 * 数独花田 · 1.3 第 2 轮 C 档修复契约（r1 遗留 2 落地）。
 *
 * r1 fixer 曾判「行 / 列刚好种齐缺轻反馈」需要动玩法状态机而遗留;r2 tester 复核给出
 * 渲染层口径:`place()` 里本就有纯视觉庆祝钩子(`regionDone`→`cheerRegion`),而落子格
 * 此前必未填对,「组现在齐」就是「这一手刚种齐」——不需要任何前后状态钩子。
 * 本轮平行照做:只读检查行列组(`variant.groups[0..2n)`),齐了就沿线错峰亮一道
 * 杏色柔光 `sp-linefx`(纯 fx 子节点,计时器入 timers 池随 destroy 清空;弱动效不放)。
 * 判定、数值、存档零触碰——这里把「纯视觉」也一并钉死。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY, cellsFromString } from "./solver";
import { bankAt, solutionOfBank, variantOfBank } from "./puzzles";
import { LINE_MS, LINE_STEP_MS, SP_CSS, createSeat, type SeatOpts, type SeatState } from "./index";

// ---------------------------------------------------------------------------
// 一份够用的 DOM 替身（与 index.test.ts 同款裁剪:node 环境、不引 jsdom）
// ---------------------------------------------------------------------------

type Handler = (e: unknown) => void;

class FakeEl {
  tag: string;
  className = "";
  type = "";
  hidden = false;
  disabled = false;
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  style: Record<string, string> & { setProperty: (k: string, v: string) => void };
  attrs: Record<string, string> = {};
  listeners = new Map<string, Set<Handler>>();
  private text = "";

  constructor(tag: string) {
    this.tag = tag;
    const props: Record<string, string> = {};
    this.style = Object.assign(props, {
      setProperty: (k: string, v: string) => {
        props[k] = v;
      }
    }) as Record<string, string> & { setProperty: (k: string, v: string) => void };
  }

  get textContent(): string {
    return this.text;
  }

  set textContent(v: string) {
    this.text = v;
    this.children = [];
  }

  set innerHTML(v: string) {
    this.children = [];
    this.text = v === "" ? "" : this.text;
  }

  get classList(): { add: (c: string) => void; remove: (c: string) => void; contains: (c: string) => boolean } {
    return {
      add: (c: string) => {
        if (!this.className.split(" ").includes(c)) this.className = `${this.className} ${c}`.trim();
      },
      remove: (c: string) => {
        this.className = this.className
          .split(" ")
          .filter((x) => x && x !== c)
          .join(" ");
      },
      contains: (c: string) => this.className.split(" ").includes(c)
    };
  }

  appendChild(child: FakeEl): FakeEl {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...kids: FakeEl[]): void {
    for (const k of kids) this.appendChild(k);
  }

  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }

  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
  }

  getAttribute(k: string): string | null {
    return this.attrs[k] ?? null;
  }

  addEventListener(name: string, fn: Handler): void {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)?.add(fn);
  }

  removeEventListener(name: string, fn: Handler): void {
    this.listeners.get(name)?.delete(fn);
  }

  fire(name: string, e: unknown = {}): void {
    for (const fn of [...(this.listeners.get(name) ?? [])]) fn(e);
  }

  querySelector(sel: string): FakeEl | null {
    const cls = sel.replace(".", "");
    const walk = (el: FakeEl): FakeEl | null => {
      for (const c of el.children) {
        if (c.className.split(" ").includes(cls)) return c;
        const hit = walk(c);
        if (hit) return hit;
      }
      return null;
    };
    return walk(this);
  }

  byClass(cls: string): FakeEl[] {
    const out: FakeEl[] = [];
    const walk = (el: FakeEl): void => {
      if (el.className.split(" ").includes(cls)) out.push(el);
      for (const c of el.children) walk(c);
    };
    for (const c of this.children) walk(c);
    return out;
  }
}

let saved: Record<string, unknown> = {};

function installDom(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  saved = {
    document: g.document,
    window: g.window,
    HTMLElement: g.HTMLElement,
    addEventListener: g.addEventListener,
    removeEventListener: g.removeEventListener
  };
  const noop = (): void => undefined;
  g.document = { createElement: (tag: string) => new FakeEl(tag) };
  g.HTMLElement = FakeEl;
  g.addEventListener = noop;
  g.removeEventListener = noop;
  g.window = { addEventListener: noop, removeEventListener: noop };
}

function removeDom(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete g[k];
    else g[k] = v;
  }
}

// ---------------------------------------------------------------------------

describe("sudoku-petal · 行 / 列种齐的轻反馈（r1 遗留 2 · 渲染层落地）", () => {
  beforeEach(installDom);
  afterEach(removeDom);

  function mountSeat(level: number) {
    const host = new FakeEl("div");
    const done: SeatState[] = [];
    const opts: SeatOpts = {
      name: "朵朵",
      who: "duo",
      entry: bankAt(level),
      cell: 40,
      errorLimit: 0,
      hintTier: "nakedSingle",
      sfx: () => undefined,
      onDone: (st) => done.push(st)
    };
    const s = createSeat(host as unknown as HTMLElement, opts);
    return { host, s, done };
  }

  it("种齐一整行:整行每格亮一道柔光,错峰写在 animation-delay 上,放完自己收干净", () => {
    vi.useFakeTimers();
    try {
      const level = 60;
      const entry = bankAt(level);
      const variant = variantOfBank(entry);
      const n = variant.n;
      const puzzle = cellsFromString(entry.p);
      const solution = solutionOfBank(entry);
      // 挑一行有空格的行,且盘上别处还有空格(整题不会因此完成)
      let row = -1;
      for (let r = 0; r < n && row < 0; r++) {
        const rowHoles: number[] = [];
        for (let c = 0; c < n; c++) if (puzzle[r * n + c] === EMPTY) rowHoles.push(r * n + c);
        const outside = puzzle.filter((v, i) => v === EMPTY && Math.floor(i / n) !== r).length;
        if (rowHoles.length > 0 && outside > 0) row = r;
      }
      expect(row, "题面挑不出可整行种齐的行").toBeGreaterThanOrEqual(0);
      const { host, s } = mountSeat(level);
      const cells = host.byClass("sp-cell");
      const holes: number[] = [];
      for (let c = 0; c < n; c++) if (puzzle[row * n + c] === EMPTY) holes.push(row * n + c);
      // 种到只剩最后一个空之前
      for (const idx of holes.slice(0, -1)) {
        cells[idx].fire("click");
        s.act({ type: "digit", digit: solution[idx] });
      }
      // 最后一空还空着,包含它的任何组都不可能已齐——它身上不许有柔光
      const last = holes[holes.length - 1];
      expect(cells[last].byClass("sp-linefx")).toHaveLength(0);
      // 最后一空落下:整行 n 格同时挂上柔光,错峰全部交给 CSS 的 animation-delay
      cells[last].fire("click");
      s.act({ type: "digit", digit: solution[last] });
      expect(s.state().solved).toBe(false);
      const rowCells = Array.from({ length: n }, (_, c) => cells[row * n + c]);
      for (let c = 0; c < n; c++) {
        const fx = rowCells[c].byClass("sp-linefx");
        expect(fx.length, `第 ${c} 格没亮柔光`).toBeGreaterThanOrEqual(1);
        // 行柔光的错峰 = 该格在行内的位置 × LINE_STEP_MS(途中列种齐的柔光另有自己的延迟,不混淆)
        expect(
          fx.some((f) => f.style.animationDelay === `${c * LINE_STEP_MS}ms`),
          `第 ${c} 格柔光错峰不对`
        ).toBe(true);
        expect(fx[0].getAttribute("aria-hidden")).toBe("true");
      }
      // 放完自己收干净,destroy 后计时器池清零
      vi.advanceTimersByTime(LINE_MS + n * LINE_STEP_MS + 50);
      expect(host.byClass("sp-linefx")).toHaveLength(0);
      s.destroy();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("纯视觉:柔光不改盘面数据、不吃点击,弱动效块整层不放", () => {
    // CSS 契约:fx 不拦事件、reduced 块里 display:none
    const rule = SP_CSS.match(/\.sp-linefx\{[^}]*\}/)?.[0] ?? "";
    expect(rule, ".sp-linefx 规则丢了").not.toBe("");
    expect(rule).toContain("pointer-events:none");
    expect(SP_CSS).toContain("@keyframes splineglow");
    const reducedBlock = SP_CSS.slice(SP_CSS.indexOf("@media (prefers-reduced-motion:reduce)"));
    expect(reducedBlock).toContain(".sp-budfx,.sp-petalfx,.sp-linefx{display:none;}");
  });
});
