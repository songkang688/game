import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardFrom, createBoard, maxTile, type Board } from "./board";
import { levelConfig, startBoard } from "./levels";
import guide from "./guide";
import {
  AI_BEAT_MS,
  BORN_MS,
  MERGE_MS,
  MG_CONSTS,
  MG_CSS,
  MOVE_MS,
  SWIPE_MIN,
  cellPxFor,
  createTable,
  keyToDir,
  meta,
  mount,
  moveAnnounce,
  overAnnounce,
  seatEnded,
  swipeToDir,
  tileColors,
  tileFontPx,
  tileRingPx,
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
  offsetWidth = 0;
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
  g.window = {
    addEventListener: add,
    removeEventListener: off,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
    clearTimeout: (id: number) => clearTimeout(id)
  };
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

/** 推进 n 帧,每帧 20ms(动画和假人都靠这个走) */
function tick(n = 1, ms = 20): void {
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
    human: "duo",
    start: boardFrom([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]),
    seed: 4242,
    target: 0,
    stepLimit: 0,
    cell: 60,
    sfx: () => undefined,
    onDone: () => undefined,
    ...over
  };
}

function table(seats: SeatOpts[], extra: Partial<Parameters<typeof createTable>[1]> = {}) {
  const host = new FakeEl("div");
  const over: SeatState[][] = [];
  const t = createTable(host as unknown as HTMLElement, {
    seats,
    goalText: "合成 32",
    onOver: (s) => over.push(s),
    ...extra
  });
  return { host, t, over };
}

// ---------------------------------------------------------------------------

describe("meta 与模块形状", () => {
  it("meta 从 index 原样再导出一遍,字段与规格逐条对上", () => {
    expect(meta.id).toBe("merge-2048");
    expect(meta.title).toBe("星星合成");
    expect(meta.emoji).toBe("🔢");
    expect(meta.category).toBe("casual");
    expect(meta.color).toBe("#FFF3C8");
    expect(meta.blurb).toBe("同样的数字撞在一起就会变成更大的星星。合成到 2048,还能继续往上叠。");
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
  });

  it("mount 是个函数,光加载模块不碰 DOM", () => {
    expect(typeof mount).toBe("function");
  });

  it("攻略八段接得上,一关都不漏,只讲方法", () => {
    expect(guide.gameId).toBe("merge-2048");
    expect(guide.entries).toHaveLength(8);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[7].to).toBe(188);
    for (let i = 1; i < guide.entries.length; i++) {
      expect(guide.entries[i].from).toBe(guide.entries[i - 1].to + 1);
    }
    for (const e of guide.entries) expect(e.tips.length).toBeGreaterThanOrEqual(3);
    expect(guide.general.length).toBeGreaterThanOrEqual(4);
  });
});

describe("动画与窄屏红线", () => {
  function ruleOf(css: string, selector: string): string {
    const at = css.indexOf(`${selector}{`);
    if (at < 0) return "";
    return css.slice(at + selector.length + 1, css.indexOf("}", at));
  }

  function pxOf(rule: string, prop: string): number {
    const m = new RegExp(`(?:^|;|\\s)${prop}:(\\d+)px`).exec(rule);
    return m ? Number(m[1]) : Number.NaN;
  }

  it("滑行时长落在规格要求的 80–140ms 里,不是瞬变", () => {
    expect(MOVE_MS).toBeGreaterThanOrEqual(80);
    expect(MOVE_MS).toBeLessThanOrEqual(140);
    expect(MERGE_MS).toBeGreaterThan(0);
    expect(BORN_MS).toBeGreaterThan(0);
    expect(MG_CONSTS).toEqual({ MOVE_MS, MERGE_MS, BORN_MS, SWIPE_MIN, AI_BEAT_MS, GAP: 6 });
  });

  it("CSS 里真的写了滑行 tween 和合并放大", () => {
    expect(MG_CSS).toContain(`transition:transform ${MOVE_MS}ms`);
    expect(MG_CSS).toContain("@keyframes mgpop");
    expect(MG_CSS).toContain("@keyframes mgborn");
  });

  it("prefers-reduced-motion 下收起弹跳与过渡", () => {
    const at = MG_CSS.indexOf("@media (prefers-reduced-motion:reduce)");
    expect(at).toBeGreaterThan(0);
    const block = MG_CSS.slice(at);
    expect(block).toContain("transition:none");
    expect(block).toContain("animation:none");
  });

  it("有 360px 专段,而且要读的字号都 ≥ 13px", () => {
    const at = MG_CSS.indexOf("@media (max-width:360px)");
    expect(at).toBeGreaterThan(0);
    const narrow = MG_CSS.slice(at, MG_CSS.indexOf("\n}", at));
    expect(narrow.length).toBeGreaterThan(40);
    for (const sel of [".mg-badge", ".mg-msg", ".mg-name", ".mg-over-s"]) {
      const base = pxOf(ruleOf(MG_CSS, sel), "font-size");
      if (!Number.isNaN(base)) expect(base).toBeGreaterThanOrEqual(13);
      const tight = ruleOf(narrow, sel);
      if (tight.includes("font-size")) expect(pxOf(tight, "font-size")).toBeGreaterThanOrEqual(13);
    }
  });

  it("按钮热区 ≥ 44px,窄屏也不缩", () => {
    const at = MG_CSS.indexOf("@media (max-width:360px)");
    const narrow = MG_CSS.slice(at, MG_CSS.indexOf("\n}", at));
    for (const sel of [".mg-btn", ".mg-open", ".mg-back"]) {
      expect(pxOf(ruleOf(MG_CSS, sel), "min-height")).toBeGreaterThanOrEqual(44);
      expect(ruleOf(narrow, sel)).not.toContain("min-height");
    }
  });

  it("长文案会折行,不会把徽章撑出屏幕", () => {
    expect(ruleOf(MG_CSS, ".mg-badge")).toContain("overflow-wrap:anywhere");
    expect(ruleOf(MG_CSS, ".mg-msg")).toContain("overflow-wrap:anywhere");
  });

  it("不引用任何图片、字体或外部地址", () => {
    expect(MG_CSS).not.toMatch(/url\(/);
    expect(MG_CSS).not.toMatch(/@import/);
    expect(MG_CSS).not.toMatch(/https?:/);
  });

  it("360px 屏上盘面不超出屏宽,数字仍旧 ≥ 16px", () => {
    for (const size of [3, 4, 5]) {
      const cell = cellPxFor(size, 360);
      const span = size * cell + (size + 1) * MG_CONSTS.GAP;
      expect(span).toBeLessThanOrEqual(360);
      expect(tileFontPx(2048, cell)).toBeGreaterThanOrEqual(16);
      expect(tileFontPx(4096, cell)).toBeGreaterThanOrEqual(16);
    }
  });

  it("两块盘并排时也塞得下", () => {
    const cell = cellPxFor(4, 360, 2);
    expect(4 * cell + 5 * MG_CONSTS.GAP).toBeLessThanOrEqual(180);
  });

  it("数字用颜色 + 圈粗细双重编码,色觉不一样也分得清", () => {
    expect(tileColors(2)[0]).not.toBe(tileColors(2048)[0]);
    expect(tileRingPx(2048)).toBeGreaterThan(tileRingPx(2));
    // 表里没有的更大数字沿用最后一档,不会变成 undefined
    expect(tileColors(65536)).toEqual(tileColors(8192));
  });

  it("位数越多字号越小,但绝不小于 16px", () => {
    expect(tileFontPx(2, 60)).toBeGreaterThan(tileFontPx(2048, 60));
    expect(tileFontPx(4096, 34)).toBeGreaterThanOrEqual(16);
  });
});

describe("键位与滑屏", () => {
  it("朵朵认 WASD", () => {
    expect(keyToDir("a", "duo")).toBe("left");
    expect(keyToDir("D", "duo")).toBe("right");
    expect(keyToDir("w", "duo")).toBe("up");
    expect(keyToDir("s", "duo")).toBe("down");
    expect(keyToDir("ArrowLeft", "duo")).toBeNull();
  });

  it("星星认方向键", () => {
    expect(keyToDir("ArrowLeft", "star")).toBe("left");
    expect(keyToDir("ArrowRight", "star")).toBe("right");
    expect(keyToDir("ArrowUp", "star")).toBe("up");
    expect(keyToDir("ArrowDown", "star")).toBe("down");
    expect(keyToDir("a", "star")).toBeNull();
  });

  it("滑得不够远不算滑动,避免误触", () => {
    expect(SWIPE_MIN).toBeGreaterThanOrEqual(20);
    expect(swipeToDir(5, 5)).toBeNull();
    expect(swipeToDir(SWIPE_MIN - 1, SWIPE_MIN - 1)).toBeNull();
  });

  it("滑得够远就按主轴判方向", () => {
    expect(swipeToDir(60, 10)).toBe("right");
    expect(swipeToDir(-60, 10)).toBe("left");
    expect(swipeToDir(10, 60)).toBe("down");
    expect(swipeToDir(10, -60)).toBe("up");
  });
});

describe("一块盘的实际操作", () => {
  beforeEach(installDom);
  afterEach(removeDom);

  it("开局按盘面摆好方块,障碍花另外画一朵", () => {
    const { host, t } = table([
      seatOpts({
        start: boardFrom([
          [2, -1, 0],
          [0, 0, 0],
          [0, 0, 4]
        ])
      })
    ]);
    expect(host.byClass("mg-tile")).toHaveLength(2);
    expect(host.byClass("mg-block")).toHaveLength(1);
    expect(host.byClass("mg-flower")).toHaveLength(1);
    t.destroy();
  });

  it("按 A 往左滑:两块 2 先叠到一格,动画放完才并成 4", () => {
    let state: SeatState | null = null;
    const { host, t } = table([seatOpts({ onTick: (s) => (state = s) })]);
    pressKey("a");
    // 还在滑行:数字都没变
    expect(host.byClass("mg-tile").map((e) => e.textContent)).toEqual(["2", "2"]);
    tick(10);
    const texts = host.byClass("mg-tile").map((e) => e.textContent);
    expect(texts).toContain("4");
    expect(state).not.toBeNull();
    expect((state as unknown as SeatState).score).toBe(4);
    expect((state as unknown as SeatState).steps).toBe(1);
    t.destroy();
  });

  it("推不动的方向按了也不算一步,更不会冒新块", () => {
    let state: SeatState | null = null;
    const { host, t } = table([
      seatOpts({
        start: boardFrom([
          [2, 4, 8, 16],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]),
        onTick: (s) => (state = s)
      })
    ]);
    const before = host.byClass("mg-tile").length;
    pressKey("a");
    tick(10);
    expect(host.byClass("mg-tile")).toHaveLength(before);
    expect(state).toBeNull();
    t.destroy();
  });

  it("一个人玩的时候方向键也认", () => {
    const { host, t } = table([seatOpts()]);
    pressKey("ArrowLeft");
    tick(10);
    expect(host.byClass("mg-tile").map((e) => e.textContent)).toContain("4");
    t.destroy();
  });

  it("手机上四个大钮和滑屏都能走一步", () => {
    const { host, t } = table([seatOpts()]);
    host.byClass("mg-btn")[0].fire("click");
    tick(10);
    expect(host.byClass("mg-tile").map((e) => e.textContent)).toContain("4");
    const board = host.byClass("mg-board")[0];
    board.fire("pointerdown", { clientX: 100, clientY: 100, preventDefault: () => undefined });
    board.fire("pointerup", { clientX: 100, clientY: 200, preventDefault: () => undefined });
    tick(10);
    t.destroy();
  });

  it("Esc 暂停之后键盘和滑屏都不动了,再按一次继续", () => {
    const { host, t } = table([seatOpts()]);
    pressKey("Escape");
    pressKey("a");
    tick(10);
    expect(host.byClass("mg-tile").map((e) => e.textContent)).toEqual(["2", "2"]);
    expect(host.byClass("mg-msg")[0].textContent).toContain("暂停");
    pressKey("Escape");
    pressKey("a");
    tick(10);
    expect(host.byClass("mg-tile").map((e) => e.textContent)).toContain("4");
    t.destroy();
  });

  it("合到目标就收工,而且报的是达成", () => {
    const done: SeatState[] = [];
    const { t } = table([
      seatOpts({
        start: boardFrom([
          [16, 16, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]),
        target: 32,
        onDone: (s) => done.push(s)
      })
    ]);
    pressKey("a");
    tick(10);
    expect(done).toHaveLength(1);
    expect(done[0].reached).toBe(true);
    expect(done[0].best).toBe(32);
    t.destroy();
  });

  it("限步关走满步数就判没过", () => {
    const done: SeatState[] = [];
    const { t } = table([seatOpts({ stepLimit: 1, target: 4096, onDone: (s) => done.push(s) })]);
    pressKey("a");
    tick(10);
    expect(done).toHaveLength(1);
    expect(done[0].outOfSteps).toBe(true);
    expect(done[0].reached).toBe(false);
    t.destroy();
  });

  it("推不动了就报 stuck,顺带触发结算", () => {
    const done: SeatState[] = [];
    const { t } = table([
      seatOpts({
        start: boardFrom([
          [2, 4, 2],
          [4, 2, 4],
          [0, 2, 4]
        ]),
        seed: 1,
        onDone: (s) => done.push(s)
      })
    ]);
    pressKey("a");
    tick(10);
    expect(done).toHaveLength(1);
    expect(done[0].stuck).toBe(true);
    t.destroy();
  });

  it("合并会响一声", () => {
    const sounds: string[] = [];
    const { t } = table([seatOpts({ sfx: (n) => sounds.push(n) })]);
    pressKey("a");
    tick(10);
    expect(sounds).toContain("pop");
    t.destroy();
  });

  it("HUD 上写着两边的分数与最大块", () => {
    const { host, t } = table([seatOpts()]);
    pressKey("a");
    tick(10);
    const badge = host.byClass("mg-badge").find((b) => b.textContent.includes("最大"));
    expect(badge?.textContent).toContain("朵朵");
    t.destroy();
  });
});

// ---------------------------------------------------------------------------
// 无障碍:盘面只有一句静态 aria-label,看不见的人得靠 aria-live 才知道刚才那一步合出了什么
// ---------------------------------------------------------------------------

describe("读屏播报", () => {
  function st(over: Partial<SeatState> = {}): SeatState {
    return { score: 0, steps: 0, best: 0, reached: false, stuck: false, outOfSteps: false, ...over };
  }

  it("合出更大的数字时说「合出」,没合大就只报当前最大", () => {
    expect(moveAnnounce("朵朵", st({ steps: 3, best: 16, score: 40 }), 8)).toBe("第 3 步,合出 16,40 分");
    expect(moveAnnounce("朵朵", st({ steps: 4, best: 16, score: 44 }), 16)).toBe("第 4 步,最大 16,44 分");
  });

  it("双人同屏才带名字,一个人玩的时候不啰嗦", () => {
    expect(moveAnnounce("星星", st({ steps: 1, best: 4, score: 4 }), 2, true)).toBe("星星:第 1 步,合出 4,4 分");
    expect(moveAnnounce("星星", st({ steps: 1, best: 4, score: 4 }), 2, false)).not.toContain("星星");
  });

  it("三种结束各有各的说法,都说清楚为什么结束", () => {
    expect(overAnnounce("朵朵", st({ reached: true, best: 32, steps: 9 }))).toContain("目标达成");
    expect(overAnnounce("朵朵", st({ outOfSteps: true, best: 8 }))).toContain("步数用完");
    expect(overAnnounce("朵朵", st({ stuck: true, best: 64, steps: 30 }))).toContain("挪不动");
    expect(overAnnounce("朵朵", st({ best: 4 }))).toContain("这一盘结束");
    // 达成优先于其它两种,不会同时念两句
    expect(overAnnounce("朵朵", st({ reached: true, stuck: true, best: 32 }))).toContain("目标达成");
  });

  it("播报里只有数字与中文,不带 emoji 与标点噪音", () => {
    const lines = [
      moveAnnounce("朵朵", st({ steps: 2, best: 8, score: 12 }), 4),
      overAnnounce("朵朵", st({ reached: true, best: 32, steps: 9 }))
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/[🌸⭐🚩♾️🤝👫]/u);
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });

  it("seatEnded 认得出三种结束,没结束就是 false", () => {
    expect(seatEnded(st())).toBe(false);
    expect(seatEnded(st({ reached: true }))).toBe(true);
    expect(seatEnded(st({ stuck: true }))).toBe(true);
    expect(seatEnded(st({ outOfSteps: true }))).toBe(true);
  });

  describe("挂到盘上之后", () => {
    beforeEach(installDom);
    afterEach(removeDom);

    it("有一块看不见的 live 区,提示行也是 status", () => {
      const { host, t } = table([seatOpts()]);
      const say = host.byClass("mg-say")[0];
      expect(say.getAttribute("role")).toBe("status");
      expect(say.getAttribute("aria-live")).toBe("polite");
      expect(say.getAttribute("aria-atomic")).toBe("true");
      const msg = host.byClass("mg-msg")[0];
      expect(msg.getAttribute("aria-live")).toBe("polite");
      // 看不见:靠 CSS 收成 1px,不是 display:none(那样读屏也读不到)
      expect(MG_CSS).toContain(".mg-say{");
      const rule = MG_CSS.slice(MG_CSS.indexOf(".mg-say{"), MG_CSS.indexOf("}", MG_CSS.indexOf(".mg-say{")));
      expect(rule).toContain("width:1px");
      expect(rule).not.toContain("display:none");
      t.destroy();
    });

    it("走一步就播一句,合成了会说合出多少", () => {
      const { host, t } = table([seatOpts()]);
      const say = host.byClass("mg-say")[0];
      expect(say.textContent).toBe("");
      pressKey("a");
      tick(10);
      expect(say.textContent).toBe("第 1 步,合出 4,4 分");
      t.destroy();
    });

    it("这一盘结束时播的是结论,不是「第几步」", () => {
      const { host, t } = table([
        seatOpts({
          start: boardFrom([
            [16, 16, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
          ]),
          target: 32
        })
      ]);
      pressKey("a");
      tick(10);
      const said = host.byClass("mg-say")[0].textContent;
      expect(said).toContain("目标达成");
      expect(said).not.toContain("第 1 步");
      t.destroy();
    });

    it("步数用完与推不动也各播一句", () => {
      const { host: h1, t: t1 } = table([seatOpts({ stepLimit: 1, target: 4096 })]);
      pressKey("a");
      tick(10);
      expect(h1.byClass("mg-say")[0].textContent).toContain("步数用完");
      t1.destroy();

      const { host: h2, t: t2 } = table([
        seatOpts({
          start: boardFrom([
            [2, 4, 2],
            [4, 2, 4],
            [0, 2, 4]
          ]),
          seed: 1
        })
      ]);
      pressKey("a");
      tick(10);
      expect(h2.byClass("mg-say")[0].textContent).toContain("挪不动");
      t2.destroy();
    });

    it("假人那块盘不播报,免得把读屏刷屏", () => {
      const { host, t } = table([
        seatOpts({ name: "地狱假人", human: undefined, tier: "hell", start: startBoard(0) })
      ]);
      tick(60, 40);
      expect(host.byClass("mg-say")[0].textContent).toBe("");
      t.destroy();
    });

    it("双人同屏时播报带上是谁走的", () => {
      const { host, t } = table(
        [seatOpts({ name: "朵朵", human: "duo" }), seatOpts({ name: "星星", human: "star" })],
        { split: true }
      );
      pressKey("a");
      tick(10);
      expect(host.byClass("mg-say")[0].textContent).toContain("朵朵:");
      pressKey("ArrowLeft");
      tick(10);
      expect(host.byClass("mg-say")[0].textContent).toContain("星星:");
      t.destroy();
    });

    it("系统要求减弱动效时真的不弹跳了(走的是共享的 prefersReducedMotion)", () => {
      const g = globalThis as { matchMedia?: (q: string) => { matches: boolean } };
      const saved = g.matchMedia;
      try {
        g.matchMedia = (q: string) => ({ matches: q === "(prefers-reduced-motion: reduce)" });
        const { host, t } = table([seatOpts()]);
        pressKey("a");
        tick(10);
        expect(host.byClass("mg-tile").map((e) => e.textContent)).toContain("4");
        // 合并放大与新块淡入这两个动画都不挂上去
        expect(host.byClass("mg-pop")).toHaveLength(0);
        expect(host.byClass("mg-born")).toHaveLength(0);
        t.destroy();
      } finally {
        if (saved === undefined) delete g.matchMedia;
        else g.matchMedia = saved;
      }
    });

    it("没要求减弱时照旧弹跳", () => {
      const { host, t } = table([seatOpts()]);
      pressKey("a");
      tick(10);
      expect(host.byClass("mg-pop").length + host.byClass("mg-born").length).toBeGreaterThan(0);
      t.destroy();
    });

    it("暂停这类提示还是写在看得见的那一行,播报行不抢词", () => {
      const { host, t } = table([seatOpts()]);
      pressKey("Escape");
      expect(host.byClass("mg-msg")[0].textContent).toContain("暂停");
      expect(host.byClass("mg-say")[0].textContent).toBe("");
      t.destroy();
    });
  });
});

describe("双人同屏与假人", () => {
  beforeEach(installDom);
  afterEach(removeDom);

  it("左右两块盘各认各的键位,互不串台", () => {
    const { host, t } = table(
      [
        seatOpts({ name: "朵朵", human: "duo" }),
        seatOpts({ name: "星星", human: "star" })
      ],
      { split: true }
    );
    pressKey("a");
    tick(10);
    const boards = host.byClass("mg-seat");
    expect(boards[0].byClass("mg-tile").map((e) => e.textContent)).toContain("4");
    expect(boards[1].byClass("mg-tile").map((e) => e.textContent)).toEqual(["2", "2"]);
    pressKey("ArrowLeft");
    tick(10);
    expect(boards[1].byClass("mg-tile").map((e) => e.textContent)).toContain("4");
    t.destroy();
  });

  it("假人不用人管,自己会一步一步合", () => {
    let last: SeatState | null = null;
    const { t } = table([
      seatOpts({
        name: "地狱假人",
        human: undefined,
        tier: "hell",
        start: startBoard(0),
        onTick: (s) => (last = s)
      })
    ]);
    // 假人两步之间要歇 AI_BEAT_MS,多推几帧让它走上几步
    tick(60, 40);
    expect(last).not.toBeNull();
    expect((last as unknown as SeatState).steps).toBeGreaterThan(2);
    t.destroy();
  });

  it("人这边一结束就出结果,不用干等假人", () => {
    const overs: SeatState[][] = [];
    const host = new FakeEl("div");
    vi.useFakeTimers();
    const t = createTable(host as unknown as HTMLElement, {
      goalText: "比谁先到 32",
      split: true,
      seats: [
        seatOpts({
          start: boardFrom([
            [16, 16, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
          ]),
          target: 32
        }),
        seatOpts({ name: "假人", human: undefined, tier: "normal", start: startBoard(20), target: 4096 })
      ],
      onOver: (s) => overs.push(s)
    });
    pressKey("a");
    tick(10);
    vi.advanceTimersByTime(400);
    expect(overs).toHaveLength(1);
    expect(overs[0][0].reached).toBe(true);
    t.destroy();
    vi.useRealTimers();
  });
});

describe("destroy 之后不留东西", () => {
  beforeEach(installDom);
  afterEach(removeDom);

  it("牌桌销毁后键盘监听和 rAF 都归零,DOM 也摘干净", () => {
    const before = keyListenerCount();
    const { host, t } = table([seatOpts()]);
    expect(keyListenerCount()).toBe(before + 1);
    expect(frames.size).toBeGreaterThan(0);
    pressKey("a");
    tick(2);
    t.destroy();
    expect(keyListenerCount()).toBe(before);
    expect(frames.size).toBe(0);
    expect(host.children).toHaveLength(0);
    // 销毁之后再按键、再推帧都不该炸,也不该冒出新 DOM
    pressKey("a");
    tick(5);
    expect(host.byClass("mg-tile")).toHaveLength(0);
  });

  it("销毁两次也不出事", () => {
    const { t } = table([seatOpts()]);
    t.destroy();
    expect(() => t.destroy()).not.toThrow();
  });

  it("挂在盘上的触屏监听会一起撤掉", () => {
    const { host, t } = table([seatOpts()]);
    const board = host.byClass("mg-board")[0];
    expect(board.listeners.get("pointerdown")?.size).toBe(1);
    t.destroy();
    expect(board.listeners.get("pointerdown")?.size).toBe(0);
  });
});

describe("整款游戏挂载", () => {
  beforeEach(installDom);
  afterEach(removeDom);

  it("mount 会挂出三个额外模式入口和 188 关选关地图", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    const labels = root.byClass("mg-open").map((b) => b.textContent);
    expect(labels).toEqual(["🤝 对战竞速", "♾️ 马拉松", "👫 双人同屏"]);
    expect(root.byClass("l99-map").length).toBe(1);
    expect(root.byClass("l99-tab").length).toBe(8);
    handle.destroy();
    expect(root.children).toHaveLength(0);
  });

  it("点开对战会盖住选关地图,回来又露出来", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    const versus = root.byClass("mg-open")[0];
    versus.fire("click");
    expect(root.byClass("mg-mode")).toHaveLength(1);
    const back = root.byClass("mg-back")[0];
    back.fire("click");
    expect(root.byClass("mg-mode")).toHaveLength(0);
    handle.destroy();
  });

  it("从选关地图点第一关能真的开打", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    root.byClass("l99-node")[0].fire("click");
    expect(root.byClass("mg-board")).toHaveLength(1);
    const cfg = levelConfig(0);
    const goal = root.byClass("mg-badge").find((b) => b.textContent.includes("合成"));
    expect(goal?.textContent).toContain(String(cfg.target));
    handle.destroy();
    expect(keyListenerCount()).toBe(0);
  });

  it("无尽入口先让你挑盘面大小", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    root.byClass("mg-open")[1].fire("click");
    const picks = root.byClass("mg-mode")[0].byClass("mg-open").map((b) => b.textContent);
    expect(picks).toEqual(["♾️ 四乘四马拉松", "🔳 三乘三马拉松"]);
    handle.destroy();
  });

  it("双人同屏直接给两块盘", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    root.byClass("mg-open")[2].fire("click");
    expect(root.byClass("mg-board")).toHaveLength(2);
    expect(root.byClass("mg-name").map((e) => e.textContent)).toEqual(["朵朵", "星星"]);
    handle.destroy();
  });
});

describe("文案红线", () => {
  it("不出现商标、原作游戏名与作者名", () => {
    const corpus = [
      MG_CSS,
      meta.title,
      meta.blurb,
      guide.title,
      ...guide.general,
      ...guide.entries.flatMap((e) => [e.title, ...e.tips])
    ].join("\n");
    for (const word of ["2048 游戏", "Cirulli", "俄罗斯方块", "Tetris", "三国杀", "大富翁", "Threes", "合成大西瓜"]) {
      expect(corpus).not.toContain(word);
    }
  });

  it("开局盘面里没有目标数字,棋盘也不是空的", () => {
    for (const lv of [0, 90, 187]) {
      const board: Board = startBoard(lv);
      expect(maxTile(board)).toBeGreaterThan(0);
      expect(maxTile(board)).toBeLessThan(levelConfig(lv).target);
    }
    expect(maxTile(createBoard(4))).toBe(0);
  });
});
