import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTable, type TableState } from "./table";
import { levelConfig } from "./levels";
import { parseTiles, tileName } from "./tiles";
import {
  FAN_STEP_MS,
  FAN_VISIBLE,
  FLY_MS,
  MELD_MS,
  MJ_CONSTS,
  MJ_CSS,
  claimButtonLabel,
  createLive,
  endlessGain,
  faceOf,
  kanAvailable,
  keyAction,
  levelSolvable,
  meta,
  mount,
  mountPuzzle,
  popFans,
  preferredAction,
  tierTip,
  tileColorClass,
  tileEl,
  type LiveOptions,
  type Scheduler
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
  scrollTop = 0;
  scrollHeight = 0;
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  listeners = new Map<string, Set<Handler>>();
  private text = "";

  constructor(tag: string) {
    this.tag = tag;
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

  get classList(): { add: (c: string) => void; contains: (c: string) => boolean } {
    return {
      add: (c: string) => {
        if (!this.className.split(" ").includes(c)) this.className = `${this.className} ${c}`.trim();
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

  fire(name: string): void {
    for (const fn of [...(this.listeners.get(name) ?? [])]) fn({});
  }

  querySelector(sel: string): FakeEl | null {
    return this.all().find((el) => el.className.split(" ").includes(sel.replace(".", ""))) ?? null;
  }

  /** 自己和全部后代 */
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

interface WinStub {
  addEventListener: (name: string, fn: Handler) => void;
  removeEventListener: (name: string, fn: Handler) => void;
  keys: Map<string, Set<Handler>>;
}

let winStub: WinStub;

function installDom(): void {
  const keys = new Map<string, Set<Handler>>();
  winStub = {
    keys,
    addEventListener(name, fn) {
      if (!keys.has(name)) keys.set(name, new Set());
      keys.get(name)?.add(fn);
    },
    removeEventListener(name, fn) {
      keys.get(name)?.delete(fn);
    }
  };
  const g = globalThis as unknown as Record<string, unknown>;
  g.document = { createElement: (tag: string) => new FakeEl(tag) };
  g.window = winStub;
}

function removeDom(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.document;
  delete g.window;
}

function pressKey(key: string): void {
  for (const fn of [...(winStub.keys.get("keydown") ?? [])]) {
    fn({ key, preventDefault: () => undefined });
  }
}

function keyListenerCount(): number {
  return winStub.keys.get("keydown")?.size ?? 0;
}

// ---------------------------------------------------------------------------

describe("meta 与模块形状", () => {
  it("meta 从 index 原样再导出一遍", () => {
    expect(meta.id).toBe("mahjong-bloom");
    expect(meta.title).toBe("花开麻将");
    expect(meta.emoji).toBe("🀄");
    expect(meta.category).toBe("party");
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
  });

  it("mount 是个函数,加载模块本身不碰 DOM", () => {
    expect(typeof mount).toBe("function");
  });

  it("动画时长符合规格:出牌 ~200ms,不是瞬变", () => {
    expect(FLY_MS).toBe(200);
    expect(MELD_MS).toBeGreaterThanOrEqual(150);
    expect(MJ_CONSTS.FLY_MS).toBe(FLY_MS);
    expect(FAN_VISIBLE).toBe(6);
    expect(FAN_STEP_MS).toBeGreaterThan(0);
  });
});

describe("窄屏与动效红线", () => {
  /** 取某条选择器的声明块 */
  function ruleOf(css: string, selector: string): string {
    const at = css.indexOf(`${selector}{`);
    if (at < 0) return "";
    return css.slice(at + selector.length + 1, css.indexOf("}", at));
  }

  function pxOf(rule: string, prop: string): number {
    const m = new RegExp(`(?:^|;)\\s*${prop}:(\\d+)px`).exec(rule);
    return m ? Number(m[1]) : Number.NaN;
  }

  /** 360px 那段 media query 的内容 */
  const narrow = (() => {
    const at = MJ_CSS.indexOf("@media (max-width:360px)");
    return at < 0 ? "" : MJ_CSS.slice(at, MJ_CSS.indexOf("\n}", at));
  })();

  it("牌宽任何屏下都 ≥ 28px", () => {
    expect(pxOf(ruleOf(MJ_CSS, ".mj-tile"), "width")).toBeGreaterThanOrEqual(28);
    expect(pxOf(ruleOf(narrow, ".mj-tile"), "width")).toBeGreaterThanOrEqual(28);
  });

  it("360px 那段确实存在,而且把牌收窄了", () => {
    expect(narrow.length).toBeGreaterThan(40);
    expect(pxOf(ruleOf(narrow, ".mj-tile"), "width")).toBeLessThan(
      pxOf(ruleOf(MJ_CSS, ".mj-tile"), "width")
    );
  });

  it("自家手牌能横滑,不会在窄屏挤爆", () => {
    expect(ruleOf(MJ_CSS, ".mj-hand")).toContain("overflow-x:auto");
  });

  it("动作钮热区 ≥ 44px,窄屏也不缩", () => {
    expect(pxOf(ruleOf(MJ_CSS, ".mj-btn"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(pxOf(ruleOf(MJ_CSS, ".mj-open"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(pxOf(ruleOf(MJ_CSS, ".mj-back-btn"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(ruleOf(narrow, ".mj-btn")).not.toContain("min-height");
  });

  it("要读的字号一律 ≥ 13px", () => {
    for (const sel of [".mj-badge", ".mj-goal", ".mj-msg", ".mj-btn", ".mj-fan", ".mj-foe-name"]) {
      expect(pxOf(ruleOf(MJ_CSS, sel), "font-size")).toBeGreaterThanOrEqual(13);
      const tight = ruleOf(narrow, sel);
      if (tight.includes("font-size")) expect(pxOf(tight, "font-size")).toBeGreaterThanOrEqual(13);
    }
  });

  it("番种表最多先露 6 条,再多就滚动看", () => {
    const rule = ruleOf(MJ_CSS, ".mj-fans");
    expect(rule).toContain("overflow-y:auto");
    expect(rule).toContain("max-height");
  });

  it("出牌与副露都有动画,不是瞬变", () => {
    expect(MJ_CSS).toContain(`animation:mjfly ${FLY_MS}ms`);
    expect(MJ_CSS).toContain(`animation:mjslide ${MELD_MS}ms`);
  });

  it("prefers-reduced-motion 下动画缩到最短但还在", () => {
    const at = MJ_CSS.indexOf("@media (prefers-reduced-motion:reduce)");
    expect(at).toBeGreaterThan(0);
    const block = MJ_CSS.slice(at);
    expect(block).toContain(".mj-fly{animation-duration:60ms;}");
    expect(block).not.toContain("animation:none");
  });

  it("不引用任何图片、字体或外部地址", () => {
    expect(MJ_CSS).not.toMatch(/url\(/);
    expect(MJ_CSS).not.toMatch(/@import/);
    expect(MJ_CSS).not.toMatch(/https?:/);
  });
});

describe("键位", () => {
  it("朵朵用 WASD 挑牌、F 打出、G 吃碰杠胡", () => {
    expect(keyAction("w")).toEqual({ who: "duo", kind: "up" });
    expect(keyAction("a")).toEqual({ who: "duo", kind: "left" });
    expect(keyAction("s")).toEqual({ who: "duo", kind: "down" });
    expect(keyAction("d")).toEqual({ who: "duo", kind: "right" });
    expect(keyAction("f")).toEqual({ who: "duo", kind: "play" });
    expect(keyAction("g")).toEqual({ who: "duo", kind: "act" });
  });

  it("星星用方向键、L 打出、K 吃碰杠胡", () => {
    expect(keyAction("ArrowLeft")).toEqual({ who: "star", kind: "left" });
    expect(keyAction("ArrowRight")).toEqual({ who: "star", kind: "right" });
    expect(keyAction("ArrowUp")).toEqual({ who: "star", kind: "up" });
    expect(keyAction("ArrowDown")).toEqual({ who: "star", kind: "down" });
    expect(keyAction("l")).toEqual({ who: "star", kind: "play" });
    expect(keyAction("k")).toEqual({ who: "star", kind: "act" });
  });

  it("大小写都认,别的键一律不响应", () => {
    expect(keyAction("F")).toEqual({ who: "duo", kind: "play" });
    expect(keyAction("K")).toEqual({ who: "star", kind: "act" });
    expect(keyAction("Escape")).toBeNull();
    expect(keyAction("z")).toBeNull();
  });

  it("键盘确认按胡 > 杠 > 碰 > 吃 的顺序挑", () => {
    expect(preferredAction([{ kind: "chi" }, { kind: "pon" }, { kind: "ron" }])?.kind).toBe("ron");
    expect(preferredAction([{ kind: "chi" }, { kind: "kan" }, { kind: "pon" }])?.kind).toBe("kan");
    expect(preferredAction([{ kind: "chi" }, { kind: "pon" }])?.kind).toBe("pon");
    expect(preferredAction([{ kind: "chi" }])?.kind).toBe("chi");
    expect(preferredAction([])).toBeNull();
  });

  it("三种吃法的按钮写着用哪两张,分得开", () => {
    const a = claimButtonLabel({ kind: "chi", tile: 3, pair: parseTiles("12m") });
    const b = claimButtonLabel({ kind: "chi", tile: 3, pair: parseTiles("45m") });
    expect(a).not.toBe(b);
    expect(a).toContain("吃");
    expect(claimButtonLabel({ kind: "pon", tile: 5 })).toBe("碰");
    expect(claimButtonLabel({ kind: "ron", tile: 5 })).toBe("和");
    expect(claimButtonLabel({ kind: "ankan", tile: 35 })).toContain("暗杠");
  });
});

describe("牌面", () => {
  beforeEach(installDom);
  afterEach(removeDom);

  it("三门数牌各用一种颜色,字牌另有一种", () => {
    expect(tileColorClass(parseTiles("1m")[0])).toBe("mj-t-m");
    expect(tileColorClass(parseTiles("1p")[0])).toBe("mj-t-p");
    expect(tileColorClass(parseTiles("1s")[0])).toBe("mj-t-s2");
    expect(tileColorClass(parseTiles("1z")[0])).toBe("mj-t-z");
  });

  it("红中是红的,发财是绿的", () => {
    expect(tileColorClass(parseTiles("5z")[0])).toBe("mj-t-red");
    expect(tileColorClass(parseTiles("6z")[0])).toBe("mj-t-green");
  });

  it("数牌画数字 + 花色字,字牌只画一个字", () => {
    expect(faceOf(parseTiles("3s")[0])).toEqual({ top: "3", bottom: "条" });
    expect(faceOf(parseTiles("1z")[0])).toEqual({ top: "东", bottom: "" });
  });

  it("一张牌是一个 DOM,读屏能念出牌名", () => {
    const el = tileEl(parseTiles("7p")[0]) as unknown as FakeEl;
    expect(el.className).toContain("mj-tile");
    expect(el.getAttribute("aria-label")).toBe(tileName(parseTiles("7p")[0]));
    expect(el.children.length).toBe(2);
  });

  it("能点的牌是 button,不能点的是 div", () => {
    const clickable = tileEl(1, { onClick: () => undefined }) as unknown as FakeEl;
    const plain = tileEl(1) as unknown as FakeEl;
    expect(clickable.tag).toBe("button");
    expect(clickable.type).toBe("button");
    expect(plain.tag).toBe("div");
  });

  it("光标 / 高亮 / 刚摸到 各有各的样式", () => {
    const el = tileEl(1, { cursor: true, hot: true, drawn: true, small: true, fly: true }) as unknown as FakeEl;
    for (const c of ["mj-cur", "mj-hot", "mj-drawn", "mj-small", "mj-fly"]) {
      expect(el.classList.contains(c)).toBe(true);
    }
  });
});

describe("和牌番种一条条弹出来", () => {
  beforeEach(() => {
    installDom();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removeDom();
  });

  const sched: Scheduler = {
    after: (ms, fn) => {
      setTimeout(fn, ms);
    }
  };

  it("不是只弹一句「你赢了」,而是一条番一行,最后再来一行合计", () => {
    const host = new FakeEl("div");
    const fans = [
      { name: "清一色", points: 24 },
      { name: "碰碰和", points: 6 },
      { name: "自摸", points: 1 }
    ];
    popFans(host as unknown as HTMLElement, fans, 31, sched);
    vi.advanceTimersByTime(FAN_STEP_MS * 5 + 200);
    const rows = host.byClass("mj-fan");
    expect(rows.length).toBe(fans.length + 1);
    expect(rows[0].children[0].textContent).toBe("清一色");
    expect(rows[rows.length - 1].className).toContain("mj-fan-total");
  });

  it("番种一条条来,不是一口气全冒出来", () => {
    const host = new FakeEl("div");
    const fans = Array.from({ length: 5 }, (_, i) => ({ name: `番${i}`, points: i + 1 }));
    popFans(host as unknown as HTMLElement, fans, 15, sched);
    vi.advanceTimersByTime(FAN_STEP_MS + 10);
    expect(host.byClass("mj-fan").length).toBeLessThan(fans.length);
    vi.advanceTimersByTime(FAN_STEP_MS * 6);
    expect(host.byClass("mj-fan").length).toBe(fans.length + 1);
  });
});

describe("闯关残局", () => {
  beforeEach(() => {
    installDom();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removeDom();
  });

  function play(level: number): {
    stage: FakeEl;
    handle: { destroy: () => void };
    won: Array<{ stars: number; msg?: string }>;
    lost: string[];
  } {
    const stage = new FakeEl("div");
    const won: Array<{ stars: number; msg?: string }> = [];
    const lost: string[] = [];
    const handle = mountPuzzle(stage as unknown as HTMLElement, levelConfig(level), {
      win: (stars, msg) => won.push({ stars, msg }),
      lose: (msg) => lost.push(msg ?? ""),
      sfx: () => undefined
    });
    return { stage, handle, won, lost };
  }

  it("开局摆出 13 张手牌和本关目标", () => {
    const { stage, handle } = play(0);
    const cfg = levelConfig(0);
    expect(stage.byClass("mj-tile").length).toBeGreaterThanOrEqual(cfg.hand.length);
    expect(stage.byClass("mj-goal")[0].textContent).toContain(cfg.require[0]);
    handle.destroy();
  });

  it("过一会儿会自动摸第一张", () => {
    const { stage, handle } = play(0);
    vi.advanceTimersByTime(400);
    expect(stage.byClass("mj-drawn").length).toBe(1);
    handle.destroy();
  });

  it("照着既定路线打:闲牌全打掉,摸到和牌张就能开花拿三星", () => {
    const level = 0;
    const cfg = levelConfig(level);
    const { stage, handle, won, lost } = play(level);
    // 小牌墙里除了最后那张和牌张,前面都是该打掉的闲牌
    for (let i = 0; i < cfg.wall.length - 1; i++) {
      vi.advanceTimersByTime(400);
      const drawn = stage.byClass("mj-drawn")[0];
      expect(drawn).toBeTruthy();
      drawn.fire("click");
      vi.advanceTimersByTime(FLY_MS + 120);
    }
    vi.advanceTimersByTime(400);
    const hu = stage.byClass("mj-go")[0];
    expect(hu.textContent).toContain("和牌");
    hu.fire("click");
    // 番种弹完之后点「收下这些番」才结算
    vi.advanceTimersByTime(2000);
    const ok = stage.byClass("mj-open")[0];
    ok.fire("click");
    expect(lost).toEqual([]);
    expect(won.length).toBe(1);
    expect(won[0].stars).toBe(3);
    expect(won[0].msg).toContain("番开花");
    handle.destroy();
  });

  it("和牌弹的是一整张番种表,不是一句话", () => {
    const cfg = levelConfig(0);
    const { stage, handle } = play(0);
    for (let i = 0; i < cfg.wall.length - 1; i++) {
      vi.advanceTimersByTime(400);
      stage.byClass("mj-drawn")[0].fire("click");
      vi.advanceTimersByTime(FLY_MS + 120);
    }
    vi.advanceTimersByTime(400);
    stage.byClass("mj-go")[0].fire("click");
    vi.advanceTimersByTime(2000);
    const rows = stage.byClass("mj-fan");
    expect(rows.length).toBeGreaterThanOrEqual(2);
    handle.destroy();
  });

  it("牌墙摸空还没和,只鼓励不批评", () => {
    const cfg = levelConfig(3);
    const { stage, handle, won, lost } = play(3);
    // 每一张都打掉(包括和牌张),故意把机会用完
    for (let i = 0; i < cfg.wall.length; i++) {
      vi.advanceTimersByTime(400);
      const drawn = stage.byClass("mj-drawn")[0];
      if (!drawn) break;
      drawn.fire("click");
      vi.advanceTimersByTime(FLY_MS + 120);
    }
    vi.advanceTimersByTime(600);
    expect(won).toEqual([]);
    expect(lost.length).toBe(1);
    expect(lost[0]).toContain("差一点点");
    expect(lost[0]).not.toContain("输");
    handle.destroy();
  });

  it("键盘也能打牌:F 把光标上那张打出去", () => {
    const { stage, handle } = play(0);
    vi.advanceTimersByTime(400);
    const riverTiles = (): number => stage.byClass("mj-river")[0].byClass("mj-tile").length;
    expect(riverTiles()).toBe(0);
    pressKey("f");
    expect(riverTiles()).toBe(1);
    handle.destroy();
  });

  it("WASD 挪光标,光标始终落在一张牌上", () => {
    const { stage, handle } = play(0);
    vi.advanceTimersByTime(400);
    pressKey("a");
    expect(stage.byClass("mj-cur").length).toBe(1);
    pressKey("d");
    pressKey("d");
    expect(stage.byClass("mj-cur").length).toBe(1);
    pressKey("w");
    expect(stage.byClass("mj-cur").length).toBe(1);
    handle.destroy();
  });

  it("destroy 之后监听撤干净、界面摘掉、定时器不再回调", () => {
    const stage = new FakeEl("div");
    const before = keyListenerCount();
    const handle = mountPuzzle(stage as unknown as HTMLElement, levelConfig(1), {
      win: () => undefined,
      lose: () => undefined,
      sfx: () => undefined
    });
    expect(keyListenerCount()).toBe(before + 1);
    expect(stage.children.length).toBe(1);
    handle.destroy();
    expect(keyListenerCount()).toBe(before);
    expect(stage.children.length).toBe(0);
    // destroy 之后 timer 全撤了,再走多久都不会有人回来改 DOM
    vi.advanceTimersByTime(5000);
    expect(stage.children.length).toBe(0);
    // 撤完再按键不会炸
    expect(() => pressKey("f")).not.toThrow();
  });

  it("destroy 调两次也不会炸", () => {
    const { handle } = play(2);
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });

  it("随手抽几关都能按既定路线走通", () => {
    for (const lv of [0, 30, 60, 100, 130, 170, 187]) {
      expect(levelSolvable(lv)).toBe(true);
    }
  });
});

describe("四人牌桌", () => {
  beforeEach(() => {
    installDom();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removeDom();
  });

  function table(seats: LiveOptions["seats"], seed = 4242, dealer = 0): {
    host: FakeEl;
    live: ReturnType<typeof createLive>;
    over: TableState[];
  } {
    const host = new FakeEl("div");
    const over: TableState[] = [];
    const live = createLive(host as unknown as HTMLElement, {
      seed,
      floor: 8,
      dealer,
      roundWind: 1,
      hints: true,
      seats,
      sfx: () => undefined,
      onOver: (st) => over.push(st)
    });
    return { host, live, over };
  }

  const SOLO: LiveOptions["seats"] = [
    { name: "朵朵", human: "duo" },
    { name: "糯糯", tier: "normal" },
    { name: "星星", tier: "normal" },
    { name: "云云", tier: "normal" }
  ];

  /** 一直点到这盘结束:能鸣牌就先「过」,轮到自己就打第一张,番种表弹完就收下 */
  function autoPlay(host: FakeEl, over: TableState[], rounds = 800): void {
    for (let i = 0; i < rounds && over.length === 0; i++) {
      vi.advanceTimersByTime(500);
      const sheetBtn = host.byClass("mj-open")[0];
      if (sheetBtn) {
        sheetBtn.fire("click");
        continue;
      }
      const pass = host.byClass("mj-btn").find((b) => b.textContent === "过");
      if (pass) {
        pass.fire("click");
        continue;
      }
      const hand = host.byClass("mj-hand")[0];
      const tile = hand?.byClass("mj-tile").find((t) => t.tag === "button");
      if (tile) tile.fire("click");
    }
  }

  it("开局摆好四家:自己有手牌,别人是牌背", () => {
    const { host, live } = table(SOLO);
    expect(host.byClass("mj-hand")[0].byClass("mj-tile").length).toBeGreaterThanOrEqual(13);
    expect(host.byClass("mj-back").length).toBeGreaterThan(30);
    live.destroy();
  });

  it("顶栏写着牌墙剩几张、几番起和、什么圈", () => {
    const { host, live } = table(SOLO);
    const texts = host.byClass("mj-badge").map((b) => b.textContent);
    expect(texts.some((t) => t.includes("牌墙"))).toBe(true);
    expect(texts.some((t) => t.includes("8 番起和"))).toBe(true);
    expect(texts.some((t) => t.includes("圈"))).toBe(true);
    live.destroy();
  });

  it("一盘从头打到尾会出结果,四家分数加起来还是 0", () => {
    const { host, live, over } = table(SOLO);
    autoPlay(host, over);
    expect(over.length).toBe(1);
    const st = over[0];
    expect(st.phase).toBe("over");
    expect(st.result).not.toBeNull();
    expect(st.seats.reduce((a, s) => a + s.score, 0)).toBe(0);
    live.destroy();
  });

  it("AI 会自己摸打,牌墙一路变少", () => {
    // 庄家换成棋友,不点也会自己打起来
    const { live } = table(SOLO, 4242, 1);
    const start = live.state.wall.length;
    vi.advanceTimersByTime(3000);
    expect(live.state.wall.length).toBeLessThan(start);
    live.destroy();
  });

  it("Esc 暂停,再按一次继续", () => {
    const { host, live } = table(SOLO, 4242, 1);
    vi.advanceTimersByTime(1500);
    pressKey("Escape");
    expect(host.byClass("mj-sheet-pause").length).toBe(1);
    const frozen = live.state.wall.length;
    vi.advanceTimersByTime(4000);
    expect(live.state.wall.length).toBe(frozen);
    pressKey("Escape");
    expect(host.byClass("mj-sheet-pause").length).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(live.state.wall.length).toBeLessThan(frozen);
    live.destroy();
  });

  it("双人同桌:朵朵和星星各坐一家,另两家是棋友", () => {
    const { host, live } = table([
      { name: "朵朵", human: "duo" },
      { name: "糯糯", tier: "normal" },
      { name: "星星", human: "star" },
      { name: "云云", tier: "normal" }
    ]);
    expect(live.state.seats.filter((s) => s.human).length).toBe(2);
    // 两位小朋友的手牌都摊开画出来,不是牌背
    expect(host.byClass("mj-hand").length).toBe(2);
    live.destroy();
  });

  it("双人同桌时 WASD 只动朵朵、方向键只动星星", () => {
    const { host, live } = table([
      { name: "朵朵", human: "duo" },
      { name: "糯糯", tier: "normal" },
      { name: "星星", human: "star" },
      { name: "云云", tier: "normal" }
    ]);
    // 庄家是朵朵,现在轮到她;方向键是星星的,按了不该动朵朵的光标
    const before = host.byClass("mj-cur").length;
    pressKey("ArrowLeft");
    expect(host.byClass("mj-cur").length).toBe(before);
    pressKey("a");
    expect(host.byClass("mj-cur").length).toBe(1);
    live.destroy();
  });

  it("轮到人的时候会等着,不会替人出牌", () => {
    const { host, live } = table(SOLO);
    const hand = live.state.seats[0].hand.length;
    vi.advanceTimersByTime(8000);
    // 庄家开局就是自己,没点就一直等
    expect(live.state.seats[0].hand.length).toBe(hand);
    expect(live.state.turn).toBe(0);
    live.destroy();
  });

  it("点一张牌就打出去,牌河里多一张", () => {
    const { host, live } = table(SOLO);
    vi.advanceTimersByTime(500);
    const tile = host.byClass("mj-hand")[0].byClass("mj-tile").find((t) => t.tag === "button");
    expect(tile).toBeTruthy();
    tile?.fire("click");
    expect(live.state.seats[0].discards.length).toBe(1);
    live.destroy();
  });

  it("destroy 之后监听撤干净,定时器也不再推进牌局", () => {
    const before = keyListenerCount();
    const { host, live } = table(SOLO);
    expect(keyListenerCount()).toBe(before + 1);
    vi.advanceTimersByTime(1200);
    const frozen = live.state.wall.length;
    live.destroy();
    expect(keyListenerCount()).toBe(before);
    expect(host.children.length).toBe(0);
    vi.advanceTimersByTime(10000);
    expect(live.state.wall.length).toBe(frozen);
    expect(() => pressKey("f")).not.toThrow();
  });
});

describe("无尽计分与档位文案", () => {
  it("赢一盘至少进一分,输了按实际花分算", () => {
    const st = createTable({ seed: 7, floor: 8, seats: [{ name: "朵朵" }, {}, {}, {}].map((s) => ({ name: s.name ?? "棋友" })) });
    st.result = {
      kind: "hu",
      winner: 0,
      discarder: -1,
      selfDraw: true,
      fans: [],
      points: 8,
      flowerPoints: 0,
      delta: [0, 0, 0, 0],
      line: ""
    };
    st.seats[0].score = 0;
    expect(endlessGain(st, 0)).toBe(1);
    st.seats[0].score = 30;
    expect(endlessGain(st, 0)).toBe(30);
    st.result.winner = 1;
    st.seats[0].score = -8;
    expect(endlessGain(st, 0)).toBe(-8);
  });

  it("还没出结果就不加分", () => {
    const st = createTable({ seed: 7, floor: 8, seats: [{ name: "朵朵" }, { name: "糯糯" }, { name: "星星" }, { name: "云云" }] });
    expect(endlessGain(st, 0)).toBe(0);
  });

  it("四档棋友各有一句介绍,互不相同", () => {
    const tips = (["rookie", "normal", "pro", "hell"] as const).map(tierTip);
    expect(new Set(tips).size).toBe(4);
    for (const t of tips) expect(t.length).toBeGreaterThan(8);
  });
});

describe("杠按钮跟规则对得上", () => {
  it("手里四张一样才亮杠", () => {
    expect(kanAvailable(parseTiles("1111m234p567s99s"), [])).toBe(true);
    expect(kanAvailable(parseTiles("111m234p567s99s2z"), [])).toBe(false);
  });
});
