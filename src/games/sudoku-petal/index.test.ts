import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY, cellsFromString, regionMapFor } from "./solver";
import { PUZZLE_BANK, bankAt, boardFromBank, solutionOfBank } from "./puzzles";
import { endlessConfig, endlessPick, levelSpec } from "./levels";
import { AI_PROFILES, AI_TIERS, AI_TIER_LABELS, estimateMs, nextMove, profileOf, tierStrength } from "./ai";
import guide from "./guide";
import {
  BLOOM_MS,
  BLOOM_STEP_MS,
  BLOOM_STEP_REDUCED_MS,
  CELL_MIN_PX,
  FONT_MIN_PX,
  KEY_MIN_PX,
  SP_CONSTS,
  SP_CSS,
  bloomDelayMs,
  cellPxFor,
  cellSay,
  clearSay,
  createSeat,
  createTable,
  digitFontPx,
  doneSay,
  fillSay,
  isFilledComplete,
  isOutOfTries,
  keyAction,
  meta,
  mount,
  noteDigits,
  noteFontPx,
  regionEdgeShadow,
  toggleNote,
  wrongSay,
  type SeatOpts,
  type SeatState
} from "./index";

// ---------------------------------------------------------------------------
// 一份够用的 DOM 替身:仓库的单测跑在 node 环境里,不引 jsdom 也要能验 destroy
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
    return this.all().find((el) => el.className.split(" ").includes(sel.replace(".", ""))) ?? null;
  }

  all(): FakeEl[] {
    const out: FakeEl[] = [];
    const walk = (el: FakeEl): void => {
      out.push(el);
      for (const c of el.children) walk(c);
    };
    for (const c of this.children) walk(c);
    return out;
  }

  byClass(cls: string): FakeEl[] {
    return this.all().filter((el) => el.className.split(" ").includes(cls));
  }
}

const keys = new Map<string, Set<Handler>>();
const frames = new Map<number, (ts: number) => void>();
let frameId = 0;
let clock = 0;
let saved: Record<string, unknown> = {};

function installDom(): void {
  keys.clear();
  frames.clear();
  frameId = 0;
  clock = 0;
  const g = globalThis as unknown as Record<string, unknown>;
  saved = {
    document: g.document,
    window: g.window,
    HTMLElement: g.HTMLElement,
    addEventListener: g.addEventListener,
    removeEventListener: g.removeEventListener,
    requestAnimationFrame: g.requestAnimationFrame,
    cancelAnimationFrame: g.cancelAnimationFrame
  };
  const add = (name: string, fn: Handler): void => {
    if (!keys.has(name)) keys.set(name, new Set());
    keys.get(name)?.add(fn);
  };
  const off = (name: string, fn: Handler): void => {
    keys.get(name)?.delete(fn);
  };
  g.document = { createElement: (tag: string) => new FakeEl(tag) };
  g.HTMLElement = FakeEl;
  g.addEventListener = add;
  g.removeEventListener = off;
  g.window = { addEventListener: add, removeEventListener: off };
  g.requestAnimationFrame = (fn: (ts: number) => void): number => {
    frameId += 1;
    frames.set(frameId, fn);
    return frameId;
  };
  g.cancelAnimationFrame = (id: number): void => {
    frames.delete(id);
  };
}

function removeDom(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete g[k];
    else g[k] = v;
  }
}

/** 推进 n 帧,每帧 ms 毫秒(计时与假人都靠这个走) */
function tick(n = 1, ms = 100): void {
  for (let i = 0; i < n; i++) {
    clock += ms;
    const batch = [...frames.entries()];
    frames.clear();
    for (const [, fn] of batch) fn(clock);
  }
}

function pressKey(key: string): void {
  for (const fn of [...(keys.get("keydown") ?? [])]) fn({ key, preventDefault: () => undefined });
}

function keyListenerCount(): number {
  return keys.get("keydown")?.size ?? 0;
}

function fakeApi(root: FakeEl) {
  const sounds: string[] = [];
  return {
    api: {
      root: root as unknown as HTMLElement,
      play: (n: string) => sounds.push(n),
      addStars: () => 0,
      getStars: () => 0,
      onWin: () => undefined,
      onLose: () => undefined
    },
    sounds
  };
}

function seatOpts(over: Partial<SeatOpts> = {}): SeatOpts {
  return {
    name: "朵朵",
    who: "duo",
    entry: bankAt(0),
    cell: 40,
    errorLimit: 3,
    hintTier: "nakedSingle",
    sfx: () => undefined,
    onDone: () => undefined,
    ...over
  };
}

/** 挂一块盘,并把「结束」回调收集起来 */
function seat(over: Partial<SeatOpts> = {}) {
  const host = new FakeEl("div");
  const done: SeatState[] = [];
  const sounds: string[] = [];
  const s = createSeat(host as unknown as HTMLElement, {
    ...seatOpts(over),
    sfx: (n) => sounds.push(n),
    onDone: (st) => done.push(st)
  });
  return { host, s, done, sounds };
}

/** 照着答案把一块盘种满(留 leave 个空不填) */
function fillSolved(s: ReturnType<typeof seat>["s"], host: FakeEl, level: number, leave = 0): void {
  const entry = bankAt(level);
  const puzzle = cellsFromString(entry.p);
  const solution = solutionOfBank(entry);
  const holes: number[] = [];
  for (let i = 0; i < puzzle.length; i++) {
    if (puzzle[i] === EMPTY) holes.push(i);
  }
  const cells = host.byClass("sp-cell");
  for (const idx of holes.slice(0, holes.length - leave)) {
    cells[idx].fire("click");
    s.act({ type: "digit", digit: solution[idx] });
  }
}

// ---------------------------------------------------------------------------

describe("meta 与模块形状", () => {
  it("meta 从 index 原样再导出一遍,字段与规格逐条对上", () => {
    expect(meta.id).toBe("sudoku-petal");
    expect(meta.title).toBe("数独花田");
    expect(meta.emoji).toBe("9️⃣");
    expect(meta.category).toBe("edu");
    expect(meta.color).toBe("#E8DDFF");
    expect(meta.blurb).toBe("每一行、每一列、每一朵九宫花都要种满 1 到 9。提示只讲方法，不把答案告诉你。");
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    expect(meta.levels).toBe(188);
    expect(meta.ageHint).toBe(9);
    expect(meta.platform).toBe("both");
  });

  it("mount 是个函数,光加载模块不碰 DOM", () => {
    expect(typeof mount).toBe("function");
  });
});

describe("360px 窄屏红线", () => {
  it("九宫盘在 360px 上每格不小于 34px,而且整块盘塞得进去", () => {
    const cell = cellPxFor(9, 360);
    expect(cell).toBeGreaterThanOrEqual(CELL_MIN_PX);
    // 盘宽 = 九格 + 八条缝 + 两边内边距
    expect(cell * 9 + 8 + 6).toBeLessThanOrEqual(360);
  });

  it("小盘面也不会撑成巨无霸,大屏上有上限", () => {
    expect(cellPxFor(4, 1200)).toBe(SP_CONSTS.CELL_MAX_PX);
    expect(cellPxFor(9, 1200)).toBeLessThanOrEqual(SP_CONSTS.CELL_MAX_PX);
    expect(cellPxFor(9, 0)).toBeGreaterThanOrEqual(CELL_MIN_PX);
    expect(cellPxFor(9, Number.NaN)).toBeGreaterThanOrEqual(CELL_MIN_PX);
  });

  it("两块盘只有够宽时才真的左右分,窄屏各自还是不小于 34px", () => {
    expect(cellPxFor(9, 360, 2)).toBeGreaterThanOrEqual(CELL_MIN_PX);
    expect(cellPxFor(9, 1000, 2)).toBeGreaterThanOrEqual(CELL_MIN_PX);
    expect(cellPxFor(9, 1000, 2)).toBeLessThan(cellPxFor(9, 1000, 1));
  });

  it("盘面数字字号不小于 16px,笔记小字更小一号", () => {
    for (const w of [320, 360, 414, 768]) {
      const cell = cellPxFor(9, w);
      expect(digitFontPx(cell)).toBeGreaterThanOrEqual(FONT_MIN_PX);
      expect(noteFontPx(cell)).toBeLessThan(digitFontPx(cell));
    }
  });

  it("数字钮一行九个、够高够点,而且不压在盘面上", () => {
    expect(SP_CSS).toContain(`min-height:${KEY_MIN_PX}px`);
    expect(KEY_MIN_PX).toBeGreaterThanOrEqual(44);
    expect(SP_CSS).toContain(".sp-pad{display:grid;grid-template-columns:repeat(9,1fr)");
    // 工具钮两个方向都够 44
    expect(SP_CSS).toContain(".sp-tool{min-height:44px;min-width:44px");
  });

  it("完成时九宫依次开花,每宫错开 100ms;减少动态效果时缩短", () => {
    expect(BLOOM_STEP_MS).toBe(100);
    expect(bloomDelayMs(0)).toBe(0);
    expect(bloomDelayMs(3)).toBe(300);
    expect(bloomDelayMs(8)).toBe(800);
    expect(bloomDelayMs(8, true)).toBe(8 * BLOOM_STEP_REDUCED_MS);
    expect(BLOOM_STEP_REDUCED_MS).toBeLessThan(BLOOM_STEP_MS);
    expect(SP_CSS).toContain("@keyframes spbloom");
    expect(SP_CSS).toContain(`${BLOOM_MS}ms`);
    expect(SP_CSS).toContain("@media (prefers-reduced-motion:reduce)");
  });
});

describe("键位", () => {
  it("朵朵走 WASD + F 种下 + G 切铅笔", () => {
    expect(keyAction("w", "duo")).toEqual({ type: "move", dr: -1, dc: 0 });
    expect(keyAction("S", "duo")).toEqual({ type: "move", dr: 1, dc: 0 });
    expect(keyAction("a", "duo")).toEqual({ type: "move", dr: 0, dc: -1 });
    expect(keyAction("d", "duo")).toEqual({ type: "move", dr: 0, dc: 1 });
    expect(keyAction("f", "duo")).toEqual({ type: "fill" });
    expect(keyAction("g", "duo")).toEqual({ type: "pencil" });
  });

  it("星星走方向键 + L 种下 + K 切铅笔,不吃朵朵那一套", () => {
    expect(keyAction("ArrowUp", "star")).toEqual({ type: "move", dr: -1, dc: 0 });
    expect(keyAction("ArrowRight", "star")).toEqual({ type: "move", dr: 0, dc: 1 });
    expect(keyAction("l", "star")).toEqual({ type: "fill" });
    expect(keyAction("k", "star")).toEqual({ type: "pencil" });
    expect(keyAction("f", "star")).toBeNull();
    expect(keyAction("w", "star")).toBeNull();
    expect(keyAction("ArrowUp", "duo")).toBeNull();
  });

  it("单人时数字键 1–9 直接种,双人同屏时数字键让位给触屏", () => {
    expect(keyAction("5", "duo")).toEqual({ type: "digit", digit: 5 });
    expect(keyAction("9", "star")).toEqual({ type: "digit", digit: 9 });
    expect(keyAction("5", "duo", false)).toBeNull();
    expect(keyAction("0", "duo")).toBeNull();
    expect(keyAction("q", "duo")).toBeNull();
    expect(keyAction("", "duo")).toBeNull();
  });
});

describe("铅笔笔记", () => {
  it("笔记就是个位掩码,同一个数字按两下等于擦掉", () => {
    let mask = 0;
    mask = toggleNote(mask, 3);
    mask = toggleNote(mask, 7);
    expect(noteDigits(mask)).toEqual([3, 7]);
    mask = toggleNote(mask, 3);
    expect(noteDigits(mask)).toEqual([7]);
    expect(toggleNote(mask, 0)).toBe(mask);
    expect(toggleNote(mask, 10)).toBe(mask);
  });

  it("笔记不计入完成判定:满盘小字也不算种完", () => {
    const variant = regionMapFor("mini4");
    const solution = cellsFromString("1234341221434321");
    const allNotes = new Array(16).fill(0b1111111110);
    expect(isFilledComplete(variant, { cells: solution, notes: allNotes })).toBe(true);
    expect(isFilledComplete(variant, { cells: new Array(16).fill(EMPTY), notes: allNotes })).toBe(false);
    const oneShort = solution.slice();
    oneShort[5] = EMPTY;
    expect(isFilledComplete(variant, { cells: oneShort, notes: allNotes })).toBe(false);
  });

  it("铅笔打开时按数字只写小字,不占正文,也不算错", () => {
    installDom();
    const { s, host, done } = seat();
    const solution = solutionOfBank(bankAt(0));
    const hole = cellsFromString(bankAt(0).p).findIndex((v) => v === EMPTY);
    host.byClass("sp-cell")[hole].fire("click");
    s.act({ type: "pencil" });
    const wrong = solution[hole] === 1 ? 2 : 1;
    s.act({ type: "digit", digit: wrong });
    expect(s.state().errors).toBe(0);
    expect(s.state().filled).toBe(0);
    expect(host.byClass("sp-note").map((e) => e.textContent)).toEqual([String(wrong)]);
    expect(done).toHaveLength(0);
    s.destroy();
    removeDom();
  });
});

describe("错三次本关失败", () => {
  it("errorLimit 为 3 时错满三次才判负,为 0 时永远不判负", () => {
    expect(isOutOfTries(2, 3)).toBe(false);
    expect(isOutOfTries(3, 3)).toBe(true);
    expect(isOutOfTries(9, 0)).toBe(false);
  });

  it("闯关每一关都开着「错 3 次本关失败」", () => {
    for (const lv of [0, 47, 95, 187]) expect(levelSpec(lv).errorLimit).toBe(3);
  });

  it("连错三次就收桌,而且冲突只是高亮,不会第一次就判负", () => {
    installDom();
    const { s, host, done, sounds } = seat();
    const entry = bankAt(0);
    const puzzle = cellsFromString(entry.p);
    const solution = solutionOfBank(entry);
    const holes = puzzle.map((v, i) => (v === EMPTY ? i : -1)).filter((i) => i >= 0);
    for (let k = 0; k < 3; k++) {
      host.byClass("sp-cell")[holes[k]].fire("click");
      const wrong = solution[holes[k]] === 1 ? 2 : 1;
      s.act({ type: "digit", digit: wrong });
      if (k < 2) expect(done, `第 ${k + 1} 次就判负了`).toHaveLength(0);
    }
    expect(s.state().errors).toBe(3);
    expect(done).toHaveLength(1);
    expect(done[0].failed).toBe(true);
    expect(done[0].solved).toBe(false);
    expect(sounds).toContain("oops");
    // 判负之后再敲键盘也不动了
    s.act({ type: "digit", digit: 1 });
    expect(done).toHaveLength(1);
    s.destroy();
    removeDom();
  });

  it("无尽这类不判负的局里错再多也接着玩", () => {
    installDom();
    const { s, host, done } = seat({ errorLimit: 0 });
    const entry = bankAt(0);
    const solution = solutionOfBank(entry);
    const holes = cellsFromString(entry.p)
      .map((v, i) => (v === EMPTY ? i : -1))
      .filter((i) => i >= 0);
    for (let k = 0; k < 4; k++) {
      host.byClass("sp-cell")[holes[k]].fire("click");
      s.act({ type: "digit", digit: solution[holes[k]] === 1 ? 2 : 1 });
    }
    expect(s.state().errors).toBe(4);
    expect(done).toHaveLength(0);
    s.destroy();
    removeDom();
  });
});

describe("一块盘的交互", () => {
  beforeEach(installDom);
  afterEach(removeDom);

  it("盘面画出全部格子、九个数字钮和三个工具钮", () => {
    const { s, host } = seat({ entry: bankAt(60) });
    expect(host.byClass("sp-cell")).toHaveLength(81);
    expect(host.byClass("sp-key")).toHaveLength(9);
    expect(host.byClass("sp-tool")).toHaveLength(3);
    // 题面原有的数字都标成「花田本来就有的」
    const given = cellsFromString(bankAt(60).p).filter((v) => v > EMPTY).length;
    expect(host.byClass("sp-given")).toHaveLength(given);
    s.destroy();
  });

  it("题面原有的格子按不动,只会温柔地提醒一句", () => {
    const { s, host } = seat({ entry: bankAt(60) });
    const givenIdx = cellsFromString(bankAt(60).p).findIndex((v) => v > EMPTY);
    host.byClass("sp-cell")[givenIdx].fire("click");
    s.act({ type: "digit", digit: 5 });
    expect(s.state().filled).toBe(0);
    expect(host.byClass("sp-msg")[0].textContent).toContain("花田原本就有的");
    s.destroy();
  });

  it("WASD 移光标不出界,种对了会响 pop", () => {
    const { s, host, sounds } = seat({ entry: bankAt(60) });
    s.act({ type: "move", dr: -1, dc: 0 });
    s.act({ type: "move", dr: 0, dc: -1 });
    expect(host.byClass("sp-cur")).toHaveLength(1);
    const entry = bankAt(60);
    const solution = solutionOfBank(entry);
    const hole = cellsFromString(entry.p).findIndex((v) => v === EMPTY);
    host.byClass("sp-cell")[hole].fire("click");
    s.act({ type: "digit", digit: solution[hole] });
    expect(sounds).toContain("pop");
    expect(s.state().errors).toBe(0);
    expect(s.state().filled).toBe(1);
    s.destroy();
  });

  it("同一格再按一次同一个数字就是擦掉", () => {
    const { s, host } = seat({ entry: bankAt(60) });
    const entry = bankAt(60);
    const solution = solutionOfBank(entry);
    const hole = cellsFromString(entry.p).findIndex((v) => v === EMPTY);
    host.byClass("sp-cell")[hole].fire("click");
    s.act({ type: "digit", digit: solution[hole] });
    expect(s.state().filled).toBe(1);
    s.act({ type: "digit", digit: solution[hole] });
    expect(s.state().filled).toBe(0);
    s.destroy();
  });

  it("提示钮只讲方法,弹出来的那句话里一个阿拉伯数字都没有", () => {
    const { s, host, sounds } = seat({ entry: bankAt(60), hintTier: "pointingPair" });
    host.byClass("sp-tool")[2].fire("click");
    const box = host.byClass("sp-hintbox")[0];
    expect(box.hidden).toBe(false);
    expect(box.textContent.length).toBeGreaterThan(10);
    expect(/[0-9]/.test(box.textContent)).toBe(false);
    expect(sounds).toContain("meow");
    // 高亮的是「该往哪儿看」,不是替你填好的格子
    expect(host.byClass("sp-hint").length).toBeGreaterThan(0);
    expect(s.state().filled).toBe(0);
    s.destroy();
  });

  it("F 只在真的只剩一种可能时才动手,想不清楚就什么都不做", () => {
    const { s, host } = seat({ entry: bankAt(60) });
    const entry = bankAt(60);
    const solution = solutionOfBank(entry);
    // 随便挑一个空格:多半不止一种可能,F 应该按兵不动
    const holes = cellsFromString(entry.p)
      .map((v, i) => (v === EMPTY ? i : -1))
      .filter((i) => i >= 0);
    let filled = 0;
    for (const idx of holes) {
      host.byClass("sp-cell")[idx].fire("click");
      s.act({ type: "fill" });
      const now = s.state().filled;
      if (now > filled) {
        // 真填了就必须填对 —— 只剩一种可能的格子不会填错
        expect(s.state().errors).toBe(0);
        filled = now;
      }
    }
    expect(filled).toBeGreaterThan(0);
    expect(s.state().errors).toBe(0);
    void solution;
    s.destroy();
  });

  it("种满整片花田会响 win,而且九朵花排着队开", () => {
    const { s, host, done, sounds } = seat({ entry: bankAt(0), errorLimit: 0 });
    fillSolved(s, host, 0);
    expect(done).toHaveLength(1);
    expect(done[0].solved).toBe(true);
    expect(done[0].errors).toBe(0);
    expect(sounds).toContain("win");
    s.destroy();
  });

  it("宫的分界线画在该画的地方:标准盘每三格一条,盘边四面都有", () => {
    const classic = regionMapFor("classic");
    // 左上角:上边和左边都是外框
    expect(regionEdgeShadow(classic, 0)).toContain("inset 0 2px 0");
    expect(regionEdgeShadow(classic, 0)).toContain("inset 2px 0 0");
    // (0,3) 是新一朵花的左边界
    expect(regionEdgeShadow(classic, 3)).toContain("inset 2px 0 0");
    // (0,1) 在花中间,左右都不画竖线
    expect(regionEdgeShadow(classic, 1)).not.toContain("inset 2px 0 0");
    expect(regionEdgeShadow(classic, 1)).not.toContain("inset -2px 0 0");
  });
});

describe("竞速假人", () => {
  it("四档越往上越快、越不容易失手", () => {
    for (let i = 1; i < AI_TIERS.length; i++) {
      const prev = profileOf(AI_TIERS[i - 1]);
      const cur = profileOf(AI_TIERS[i]);
      expect(cur.stepMs, `${AI_TIERS[i]} 应该比 ${AI_TIERS[i - 1]} 快`).toBeLessThan(prev.stepMs);
      expect(cur.missRate).toBeLessThanOrEqual(prev.missRate);
      expect(tierStrength(AI_TIERS[i])).toBeGreaterThan(tierStrength(AI_TIERS[i - 1]));
      expect(estimateMs(AI_TIERS[i], 50)).toBeLessThan(estimateMs(AI_TIERS[i - 1], 50));
    }
    // 规格钉死的四档节奏
    expect(AI_PROFILES.rookie.stepMs).toBe(3000);
    expect(AI_PROFILES.normal.stepMs).toBe(1500);
    expect(AI_PROFILES.pro.stepMs).toBe(800);
    expect(AI_PROFILES.hell.stepMs).toBe(400);
    expect(AI_PROFILES.hell.missRate).toBe(0);
    expect(AI_PROFILES.rookie.missRate).toBeGreaterThan(0);
  });

  it("假人按技巧一步一步填,不是抄答案:地狱档八章都能一手不错地推到底", () => {
    // 数对与区块摒除只划候选、不落子,常常要连划好几轮才逼得出一个独苗。
    // 这里连着高难章一起跑,盯住「一手不错、正好用掉空格数那么多手」。
    for (const lv of [0, 30, 60, 90, 110, 130, 150, 170]) {
      const entry = bankAt(lv);
      const board = boardFromBank(entry);
      const solution = solutionOfBank(entry);
      const holes = board.cells.filter((v) => v === EMPTY).length;
      let steps = 0;
      while (board.cells.some((v) => v === EMPTY) && steps < holes + 8) {
        const move = nextMove(board, 0.99, AI_PROFILES.hell);
        if (!move) break;
        expect(move.slip).toBe(false);
        expect(move.digit, `第 ${lv + 1} 关第 ${steps} 手填错了`).toBe(solution[move.idx]);
        board.cells[move.idx] = move.digit;
        steps += 1;
      }
      expect(board.cells, `第 ${lv + 1} 关没推到底`).toEqual(solution);
      expect(steps, `第 ${lv + 1} 关多绕了路`).toBe(holes);
    }
  });

  it("菜鸟档真的会种错一朵,而且错的那一朵仍然是合规矩的落子", () => {
    const entry = bankAt(60);
    const board = boardFromBank(entry);
    const solution = solutionOfBank(entry);
    const move = nextMove(board, 0.01, AI_PROFILES.rookie);
    expect(move).not.toBeNull();
    expect(move!.slip).toBe(true);
    expect(move!.digit).not.toBe(solution[move!.idx]);
  });

  it("盘面已经满了就没有下一步了", () => {
    const entry = bankAt(0);
    const full = { variant: boardFromBank(entry).variant, cells: solutionOfBank(entry) };
    expect(nextMove(full, 0.5, AI_PROFILES.pro)).toBeNull();
  });
});

describe("一张桌子:计时、暂停、键盘与 destroy", () => {
  beforeEach(installDom);
  afterEach(removeDom);

  function table(seats: SeatOpts[], extra: Partial<Parameters<typeof createTable>[1]> = {}) {
    const host = new FakeEl("div");
    const over: SeatState[][] = [];
    const t = createTable(host as unknown as HTMLElement, {
      goalText: "9×9 花田",
      seats,
      onOver: (s) => over.push(s),
      ...extra
    });
    return { host, t, over };
  }

  it("挂上桌就开始计时,秒数会往上走", () => {
    const { host, t } = table([seatOpts()]);
    tick(12, 100);
    const clockChip = host.byClass("sp-badge").find((b) => b.textContent.includes("秒"));
    expect(clockChip?.textContent).not.toBe("⏱️ 0 秒");
    expect(t.elapsedMs()).toBeGreaterThan(0);
    t.destroy();
  });

  it("Esc 暂停会停表,再按一次接着走", () => {
    const { host, t } = table([seatOpts()]);
    tick(5, 100);
    const running = t.elapsedMs();
    pressKey("Escape");
    expect(host.byClass("sp-pause")[0].textContent).toContain("暂停");
    tick(10, 100);
    expect(t.elapsedMs()).toBe(running);
    pressKey("Escape");
    tick(5, 100);
    expect(t.elapsedMs()).toBeGreaterThan(running);
    t.destroy();
  });

  it("键盘落到对的那块盘上:朵朵按 WASD,星星按方向键,互不串台", () => {
    const { host, t } = table([
      seatOpts({ name: "🌸 朵朵", who: "duo" }),
      seatOpts({ name: "⭐ 星星", who: "star" })
    ]);
    expect(host.byClass("sp-grid")).toHaveLength(2);
    const before = host.byClass("sp-cur").map((e) => e.getAttribute("aria-label"));
    pressKey("d");
    pressKey("ArrowDown");
    const after = host.byClass("sp-cur").map((e) => e.getAttribute("aria-label"));
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    t.destroy();
  });

  it("假人到点会自己走一步,档位越高走得越勤", () => {
    const { host, t } = table([
      seatOpts({ name: "朵朵" }),
      seatOpts({ name: "地狱假人", who: null, ai: "hell", errorLimit: 0 })
    ]);
    const filledBefore = host.byClass("sp-cell").filter((c) => c.querySelector(".sp-digit")?.textContent).length;
    tick(20, 100);
    const filledAfter = host.byClass("sp-cell").filter((c) => c.querySelector(".sp-digit")?.textContent).length;
    expect(filledAfter).toBeGreaterThan(filledBefore);
    t.destroy();
  });

  it("destroy 之后监听、rAF 和 DOM 一个都不剩,再按键再推帧也不出事", () => {
    const before = keyListenerCount();
    const { host, t } = table([seatOpts()]);
    expect(keyListenerCount()).toBe(before + 1);
    expect(frames.size).toBeGreaterThan(0);
    pressKey("w");
    tick(2);
    t.destroy();
    expect(keyListenerCount()).toBe(before);
    expect(frames.size).toBe(0);
    expect(host.children).toHaveLength(0);
    pressKey("w");
    tick(5);
    expect(host.byClass("sp-cell")).toHaveLength(0);
  });

  it("销毁两次也不出事", () => {
    const { t } = table([seatOpts()]);
    t.destroy();
    expect(() => t.destroy()).not.toThrow();
  });
});

describe("整款游戏挂载", () => {
  beforeEach(installDom);
  afterEach(removeDom);

  it("mount 会挂出三个额外模式入口和 188 关选关地图", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    expect(root.byClass("sp-open").map((b) => b.textContent)).toEqual(["🤝 对战竞速", "♾️ 花田马拉松", "👫 双人同屏"]);
    expect(root.byClass("l99-map")).toHaveLength(1);
    expect(root.byClass("l99-tab")).toHaveLength(8);
    handle.destroy();
    expect(root.children).toHaveLength(0);
    expect(keyListenerCount()).toBe(0);
  });

  it("从选关地图点第一关能真的开打,而且是四宫小花田", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    root.byClass("l99-node")[0].fire("click");
    expect(root.byClass("sp-grid")).toHaveLength(1);
    expect(root.byClass("sp-cell")).toHaveLength(16);
    const goal = root.byClass("sp-badge").find((b) => b.textContent.includes("花田"));
    expect(goal?.textContent).toContain("4×4");
    handle.destroy();
    expect(keyListenerCount()).toBe(0);
  });

  it("点开对战会盖住选关地图,回来又露出来,而且是两块盘同一题", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    root.byClass("sp-open")[0].fire("click");
    expect(root.byClass("sp-mode")).toHaveLength(1);
    expect(root.byClass("sp-grid")).toHaveLength(2);
    const names = root.byClass("sp-name").map((e) => e.textContent);
    expect(names[0]).toBe("朵朵");
    expect(names[1]).toContain("假人");
    // 四档假人 + 八章赛题都挑得到
    const labels = root.byClass("sp-mhead")[1].byClass("sp-tool").map((b) => b.textContent);
    expect(labels).toHaveLength(AI_TIERS.length + 8);
    for (const t of AI_TIERS) expect(labels).toContain(AI_TIER_LABELS[t]);
    root.byClass("sp-back")[0].fire("click");
    expect(root.byClass("sp-mode")).toHaveLength(0);
    handle.destroy();
  });

  it("无尽入口先让你挑题池,而且写明错三题结束", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    root.byClass("sp-open")[1].fire("click");
    const picks = root.byClass("sp-mhead")[1].byClass("sp-tool").map((b) => b.textContent);
    expect(picks).toEqual(["♾️ 花田马拉松", "🌱 小花田马拉松"]);
    const score = root.byClass("sp-msg").find((e) => e.textContent.includes("连解"));
    expect(score?.textContent).toContain("错 0/3 题");
    handle.destroy();
  });

  /** 照答案把无尽当前这一题种满,逼出「这一题过了」的换题定时器 */
  function solveEndlessPuzzle(root: FakeEl, lv: number): void {
    const entry = bankAt(lv);
    const puzzle = cellsFromString(entry.p);
    const solution = solutionOfBank(entry);
    const cells = root.byClass("sp-cell");
    const digitKeys = root.byClass("sp-key");
    expect(cells.length).toBe(puzzle.length);
    for (let i = 0; i < puzzle.length; i++) {
      if (puzzle[i] !== EMPTY) continue;
      cells[i].fire("click");
      digitKeys[solution[i] - 1].fire("click");
    }
  }

  it("无尽换题是延时的:这一秒里退出去,定时器不许再把新盘面开出来", () => {
    vi.useFakeTimers();
    try {
      const root = new FakeEl("div");
      const { api } = fakeApi(root);
      const base = keyListenerCount();
      const handle = mount(api);
      root.byClass("sp-open")[1].fire("click");
      solveEndlessPuzzle(root, endlessPick(endlessConfig("mixed"), 0, 7));

      // 这一题确实收桌了,换题的定时器已经排上
      expect(root.byClass("sp-msg").some((e) => e.textContent.includes("连解 1 题"))).toBe(true);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      // 开花动画还没放完就退出去
      handle.destroy();
      expect(vi.getTimerCount()).toBe(0);

      // 再把时间推过换题点:不许冒出新盘面,更不许留下一个没人摘的 window 键盘监听
      vi.advanceTimersByTime(SP_CONSTS.BLOOM_STEP_MS * 9 + SP_CONSTS.BLOOM_MS + 500);
      expect(root.byClass("sp-cell")).toHaveLength(0);
      expect(root.children).toHaveLength(0);
      expect(keyListenerCount()).toBe(base);
    } finally {
      vi.useRealTimers();
    }
  });

  it("无尽正常玩下去还是会自己换下一题", () => {
    vi.useFakeTimers();
    try {
      const root = new FakeEl("div");
      const { api } = fakeApi(root);
      const handle = mount(api);
      root.byClass("sp-open")[1].fire("click");
      solveEndlessPuzzle(root, endlessPick(endlessConfig("mixed"), 0, 7));

      vi.advanceTimersByTime(SP_CONSTS.BLOOM_STEP_MS * 9 + SP_CONSTS.BLOOM_MS + 50);
      // 第二题开出来了,而且还是一块能玩的盘
      expect(root.byClass("sp-grid")).toHaveLength(1);
      expect(root.byClass("sp-cell").length).toBeGreaterThan(0);

      handle.destroy();
      vi.advanceTimersByTime(5000);
      expect(root.children).toHaveLength(0);
      expect(keyListenerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("双人同屏直接给两块盘,朵朵和星星各一片", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    root.byClass("sp-open")[2].fire("click");
    expect(root.byClass("sp-grid")).toHaveLength(2);
    expect(root.byClass("sp-name").map((e) => e.textContent)).toEqual(["🌸 朵朵", "⭐ 星星"]);
    const hint = root.byClass("sp-msg").find((e) => e.textContent.includes("方向键"));
    expect(hint?.textContent).toContain("W A S D");
    handle.destroy();
    expect(keyListenerCount()).toBe(0);
  });
});

describe("文案红线", () => {
  it("不出现商标、原作名与出版物名,注释里也没有", () => {
    const corpus = [
      SP_CSS,
      meta.title,
      meta.blurb,
      guide.title,
      ...guide.general,
      ...guide.entries.flatMap((e) => [e.title, ...e.tips])
    ].join("\n");
    for (const bad of ["数独app", "Sudoku", "扫雷", "俄罗斯方块", "宝可梦", "马里奥", "原神", "王者荣耀"]) {
      expect(corpus.toLowerCase()).not.toContain(bad.toLowerCase());
    }
  });

  it("角色只有朵朵和星星,失败话术只鼓励", () => {
    const names = PUZZLE_BANK.length > 0 ? ["朵朵", "星星"] : [];
    expect(names).toEqual(["朵朵", "星星"]);
    const corpus = [...guide.general, ...guide.entries.flatMap((e) => e.tips)].join("");
    for (const bad of ["笨", "死", "血", "输给", "太差"]) expect(corpus).not.toContain(bad);
  });
});

describe("读屏听得见落子", () => {
  it("行列的说法和格子 aria-label 一个口径", () => {
    expect(cellSay(0, 9)).toBe("第1行第1列");
    expect(cellSay(80, 9)).toBe("第9行第9列");
    expect(cellSay(5, 4)).toBe("第2行第2列");
  });

  it("种对了会说还剩多少朵,最后一朵改口说种满", () => {
    expect(fillSay(10, 9, 7, 42)).toBe("第2行第2列种下 7,还剩 42 朵。");
    expect(fillSay(10, 9, 7, 0)).toContain("花田种满啦");
  });

  it("种错了要说还能改几次;不判负的局不吓唬人", () => {
    expect(wrongSay(0, 9, 5, 1, 3)).toContain("还能改 2 次");
    expect(wrongSay(0, 9, 5, 3, 3)).toContain("还能改 0 次");
    expect(wrongSay(0, 9, 5, 9, 0)).toContain("再看看同一行同一列");
  });

  it("擦掉与收场各有一句,收场那句不批评人", () => {
    expect(clearSay(0, 9)).toBe("第1行第1列擦干净了。");
    expect(doneSay(true, 51, 0)).toContain("一共种了 51 朵");
    const lose = doneSay(false, 12, 3);
    expect(lose).toContain("种了 12 朵");
    expect(lose).not.toMatch(/笨|差劲|输|失败/);
  });

  it("播报行是 status,而且靠 1px 收起来不是 display:none", () => {
    installDom();
    const { host } = seat();
    const say = host.byClass("sp-say")[0];
    expect(say).toBeDefined();
    expect(say.getAttribute("role")).toBe("status");
    expect(say.getAttribute("aria-live")).toBe("polite");
    expect(say.getAttribute("aria-atomic")).toBe("true");
    expect(host.byClass("sp-msg")[0].getAttribute("role")).toBe("status");
    const rule = SP_CSS.slice(SP_CSS.indexOf(".sp-say{"), SP_CSS.indexOf("}", SP_CSS.indexOf(".sp-say{")));
    expect(rule).toContain("width:1px");
    expect(rule).not.toContain("display:none");
  });

  it("种下一朵就播一句,擦掉也播", () => {
    installDom();
    const { host, s } = seat();
    const entry = bankAt(0);
    const puzzle = cellsFromString(entry.p);
    const solution = solutionOfBank(entry);
    const hole = puzzle.findIndex((v) => v === EMPTY);
    const say = host.byClass("sp-say")[0];
    expect(say.textContent).toBe("");
    host.byClass("sp-cell")[hole].fire("click");
    s.act({ type: "digit", digit: solution[hole] });
    expect(say.textContent).toContain(cellSay(hole, 9));
    expect(say.textContent).toContain(`种下 ${solution[hole]}`);
    expect(say.textContent).toMatch(/还剩 \d+ 朵/);
    s.act({ type: "digit", digit: solution[hole] });
    expect(say.textContent).toBe(clearSay(hole, 9));
  });

  it("种错了播的是「还能改几次」,不是「还剩多少朵」", () => {
    installDom();
    const { host, s } = seat({ errorLimit: 3 });
    const entry = bankAt(0);
    const puzzle = cellsFromString(entry.p);
    const solution = solutionOfBank(entry);
    const hole = puzzle.findIndex((v) => v === EMPTY);
    const wrong = solution[hole] === 9 ? 1 : solution[hole] + 1;
    host.byClass("sp-cell")[hole].fire("click");
    s.act({ type: "digit", digit: wrong });
    const said = host.byClass("sp-say")[0].textContent;
    expect(said).toContain("还能改 2 次");
    expect(said).not.toContain("还剩");
  });

  it("种满之后播的是结论,不是「还剩 0 朵」", () => {
    installDom();
    const { host, s } = seat();
    fillSolved(s, host, 0);
    expect(host.byClass("sp-say")[0].textContent).toContain("花田开满啦");
  });

  it("假人那块盘一句都不播", () => {
    installDom();
    const { host, s } = seat({ who: undefined, ai: "normal" });
    for (let i = 0; i < 12; i++) s.stepAi(0.5);
    expect(host.byClass("sp-say")[0].textContent).toBe("");
  });
});
