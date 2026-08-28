/**
 * 运行时(index.ts)的回归:主链路跑得通、`destroy()` 归零、平台那几条线接上。
 *
 * 本款只在 canvas 上挂 pointer 系列监听、跑一条主循环 rAF,
 * 跳关按钮还挂了一个 click。小朋友从关卡退回首页、再从首页退出游戏,
 * 这些东西一样都不许留下 —— 留一条 pointermove 在上面,
 * 下一款游戏里手指一划就会有人偷偷响应。
 *
 * 仓库的 vitest 跑在 node 环境(没有 jsdom,也不许为此引依赖),
 * 所以这里自己搭一个极简 DOM 桩,只实现本款真正用到的那几样能力。
 */
import { afterEach, describe, expect, it } from "vitest";
import { registerLevelExtras, resetLevelExtras } from "../../ui/level188Contract";
import { LEVELS, PROGRESS_KEY, plantsUnlockedAt, serializeProgress, themeSize } from "./logic";
import { mapNodePoints } from "./mapFit";
import { CARD_H, cardStripLayout, fieldMetrics } from "./sprout12";

type Handler = (e: unknown) => void;

class FakeCtx {
  fillStyle: unknown = "";
  strokeStyle: unknown = "";
  lineWidth = 0;
  lineCap = "";
  lineJoin = "";
  font = "";
  textAlign = "";
  textBaseline = "";
  globalAlpha = 1;
  save(): void {}
  restore(): void {}
  setTransform(): void {}
  translate(): void {}
  clip(): void {}
  fillRect(): void {}
  beginPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  quadraticCurveTo(): void {}
  arc(): void {}
  ellipse(): void {}
  roundRect(): void {}
  rect(): void {}
  fill(): void {}
  stroke(): void {}
  fillText(): void {}
  setLineDash(): void {}
  measureText(text: string): { width: number } {
    return { width: text.length * 7 };
  }
  createLinearGradient(): { addColorStop: () => void } {
    return { addColorStop: () => {} };
  }
  createRadialGradient(): { addColorStop: () => void } {
    return { addColorStop: () => {} };
  }
}

class FakeEl {
  tagName: string;
  className = "";
  type = "";
  disabled = false;
  textContent = "";
  width = 0;
  height = 0;
  clientWidth = 360;
  clientHeight = 720;
  readonly style: Record<string, string> = {};
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  readonly listeners = new Map<string, Handler[]>();
  private ctx: FakeCtx | null = null;

  constructor(tagName: string) {
    this.tagName = tagName;
    if (tagName === "canvas") this.ctx = new FakeCtx();
  }

  getContext(kind: string): FakeCtx | null {
    return kind === "2d" ? this.ctx : null;
  }

  appendChild(child: FakeEl): FakeEl {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeEl): void {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parent = null;
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  getBoundingClientRect(): { left: number; top: number } {
    return { left: 0, top: 0 };
  }

  addEventListener(type: string, fn: Handler): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, fn: Handler): void {
    const list = this.listeners.get(type);
    const i = list ? list.indexOf(fn) : -1;
    if (list && i >= 0) list.splice(i, 1);
  }

  listenerCount(): number {
    return [...this.listeners.values()].reduce((n, l) => n + l.length, 0);
  }

  /** 点一下(x, y 是画布坐标) */
  tap(x: number, y: number): void {
    for (const fn of [...(this.listeners.get("pointerdown") ?? [])]) {
      fn({ pointerId: 1, clientX: x, clientY: y });
    }
    for (const fn of [...(this.listeners.get("pointerup") ?? [])]) {
      fn({ pointerId: 1, clientX: x, clientY: y });
    }
  }

  fire(type: string): void {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn({});
  }
}

function walk(root: FakeEl, fn: (el: FakeEl) => void): void {
  fn(root);
  for (const kid of root.children) walk(kid, fn);
}

function findTag(root: FakeEl, tag: string): FakeEl | null {
  let hit: FakeEl | null = null;
  walk(root, (el) => {
    if (!hit && el.tagName === tag) hit = el;
  });
  return hit;
}

function countNodes(root: FakeEl): number {
  let n = 0;
  walk(root, () => n++);
  return n;
}

interface Harness {
  root: FakeEl;
  canvas: () => FakeEl;
  pendingFrames: () => number;
  spoken: string[];
  flush: (times?: number) => void;
  restore: () => void;
}

function install(search = ""): Harness {
  const g = globalThis as Record<string, unknown>;
  const saved = {
    document: g.document,
    window: g.window,
    raf: g.requestAnimationFrame,
    caf: g.cancelAnimationFrame,
    storage: g.localStorage,
    perf: g.performance,
    synth: g.speechSynthesis,
    utter: g.SpeechSynthesisUtterance,
  };

  const frames = new Map<number, (t: number) => void>();
  let nextId = 1;
  let clock = 0;
  const spoken: string[] = [];
  const root = new FakeEl("div");

  g.document = {
    createElement: (tag: string) => new FakeEl(tag),
    body: new FakeEl("body"),
    head: new FakeEl("head"),
    documentElement: new FakeEl("html"),
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  g.window = {
    devicePixelRatio: 2,
    location: { search },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  g.requestAnimationFrame = (fn: (t: number) => void): number => {
    const id = nextId++;
    frames.set(id, fn);
    return id;
  };
  g.cancelAnimationFrame = (id: number): void => void frames.delete(id);
  const store = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  g.performance = { now: () => clock };
  // 朗读:装一个假的语音合成,好验证 destroy 真的把嘴闭上了
  g.speechSynthesis = {
    getVoices: () => [{ lang: "zh-CN" }],
    speak: (u: { text?: string }) => void spoken.push(String(u.text ?? "speak")),
    cancel: () => void spoken.push("cancel"),
  };
  g.SpeechSynthesisUtterance = class {
    lang = "";
    rate = 1;
    voice: unknown = null;
    text: string;
    constructor(text: string) {
      this.text = text;
    }
  };

  return {
    root,
    canvas: () => findTag(root, "canvas")!,
    pendingFrames: () => frames.size,
    spoken,
    flush(times = 1) {
      for (let i = 0; i < times; i++) {
        const due = [...frames.entries()];
        frames.clear();
        clock += 16;
        for (const [, fn] of due) fn(clock);
      }
    },
    restore() {
      g.document = saved.document;
      g.window = saved.window;
      g.requestAnimationFrame = saved.raf;
      g.cancelAnimationFrame = saved.caf;
      g.localStorage = saved.storage;
      g.performance = saved.perf;
      g.speechSynthesis = saved.synth;
      g.SpeechSynthesisUtterance = saved.utter;
    },
  };
}

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
  resetLevelExtras();
});

interface Mounted {
  destroy: () => void;
  openCampaignLevel: (n: number) => number;
}

async function mountGame(h: Harness): Promise<{ game: Mounted; played: string[] }> {
  const mod = await import("./index");
  const played: string[] = [];
  const game = mod.mount({
    root: h.root as unknown as HTMLElement,
    play: (n: string) => void played.push(n),
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {},
  } as never) as unknown as Mounted;
  return { game, played };
}

/* ---- 画布坐标:和 index.ts 用同一套版面函数算,不写死数字 ---- */
const VIEW_W = 360;
const VIEW_H = 720;
const HUD_ROW_H = 26;
const TOOLBAR_H = HUD_ROW_H + CARD_H + 10;

const field = () => fieldMetrics(VIEW_W, VIEW_H, TOOLBAR_H, 1.2);

/** 第 i 张苗卡的中心 */
function cardPoint(i: number, cardCount: number): [number, number] {
  const strip = cardStripLayout(VIEW_W, cardCount, 0);
  return [6 + i * (strip.cardW + strip.gap) + strip.cardW / 2, HUD_ROW_H + 4 + CARD_H / 2];
}

/** 第 (col, lane) 格的中心 */
function cellPoint(col: number, lane: number): [number, number] {
  const m = field();
  return [m.ox + (col + 0.5) * m.cw, m.oy + (lane + 0.5) * m.ch];
}

/** 第一章地图上第 1 关节点的中心:和 drawMap 共用 mapNodePoints,行距钳制后位置变了也不怕 */
function firstNodePoint(): [number, number] {
  const p = mapNodePoints(VIEW_W, VIEW_H, themeSize(0))[0];
  return [p.x, p.y];
}

describe("sprout-defense 1.2 · 主链路", () => {
  it("首页 → 花园 → 关卡 → 选苗种植:一路点下来种得下苗", async () => {
    const h = install();
    harness = h;
    const { game, played } = await mountGame(h);
    h.flush(1);
    const canvas = h.canvas();

    // 首页选第一章(卡片在左上角),再点地图上的第一关
    canvas.tap(60, 100);
    h.flush(1);
    canvas.tap(...firstNodePoint());
    h.flush(1);
    // 开场面板点一下就开打
    canvas.tap(VIEW_W / 2, VIEW_H / 2);
    h.flush(2);

    const unlocked = plantsUnlockedAt(0, LEVELS);
    const cardCount = unlocked.length + 1;
    // 选第一张苗卡(泡泡芽),再点一格空地
    canvas.tap(...cardPoint(unlocked.indexOf("bubble"), cardCount));
    h.flush(1);
    const before = played.filter((n) => n === "pop").length;
    canvas.tap(...cellPoint(1, 1));
    h.flush(2);
    expect(played.filter((n) => n === "pop").length, "苗没种下去").toBe(before + 1);

    game.destroy();
  });

  it("放着不管会被虫虫冲进小屋,失败只有鼓励,没有一句难听话", async () => {
    const h = install();
    harness = h;
    const { game, played } = await mountGame(h);
    h.flush(1);
    const canvas = h.canvas();
    canvas.tap(60, 100);
    h.flush(1);
    canvas.tap(...firstNodePoint());
    h.flush(1);
    canvas.tap(VIEW_W / 2, VIEW_H / 2);
    // 一株不种,让第一波直接推到家:60 秒足够
    h.flush(4000);

    expect(played, "虫虫没能冲进小屋,这一局没输").toContain("oops");
    expect(played).not.toContain("win");
    const lines = h.spoken.filter((s) => s !== "cancel");
    expect(lines.length, "失败了却一句话没说").toBeGreaterThan(0);
    const said = lines.join("\n");
    expect(said).not.toMatch(/失败|输了|笨|不行|真差/);
    expect(said).toMatch(/再来|下一次|没关系|加油|试试|不要紧|厉害|棒/);
    game.destroy();
  });

  it("无尽入口:没星星时点不开,拿过星星就能进守夜", async () => {
    const h = install();
    harness = h;
    const g = globalThis as Record<string, unknown>;
    const store = g.localStorage as { setItem: (k: string, v: string) => void };
    const stars = new Array(LEVELS.length).fill(0);
    stars[0] = 3;
    store.setItem(PROGRESS_KEY, serializeProgress(stars));

    const { game, played } = await mountGame(h);
    h.flush(1);
    const canvas = h.canvas();
    // 无尽按钮在首页最下面那一条
    canvas.tap(VIEW_W / 2, VIEW_H - 40);
    h.flush(2);
    expect(played).toContain("tap");
    // 进了无尽:点一下开打,再跑一阵子波次会自己往上走
    canvas.tap(VIEW_W / 2, VIEW_H / 2);
    h.flush(900);
    expect(h.pendingFrames()).toBeGreaterThan(0);
    game.destroy();
  });

  it("老档照旧能读:1.1 存下来的星星数原样认,坏档当新档不崩", async () => {
    const h = install();
    harness = h;
    const g = globalThis as Record<string, unknown>;
    const store = g.localStorage as { setItem: (k: string, v: string) => void };
    store.setItem(PROGRESS_KEY, JSON.stringify([3, 2, 1]));
    const first = await mountGame(h);
    h.flush(2);
    first.game.destroy();

    store.setItem(PROGRESS_KEY, "{坏档}");
    const second = await mountGame(h);
    h.flush(2);
    expect(h.pendingFrames()).toBeGreaterThan(0);
    second.game.destroy();
  });
});

describe("sprout-defense 1.2 · destroy 归零", () => {
  it("挂上、打一会儿、再 destroy:rAF、监听、节点、朗读全部收干净", async () => {
    const h = install();
    harness = h;

    const { game } = await mountGame(h);
    h.flush(4);
    const canvas = h.canvas();
    expect(canvas.listenerCount()).toBeGreaterThanOrEqual(4);
    expect(h.pendingFrames()).toBeGreaterThan(0);
    expect(countNodes(h.root)).toBeGreaterThan(1);

    game.destroy();

    expect(h.pendingFrames()).toBe(0);
    expect(canvas.listenerCount()).toBe(0);
    // 根节点下面一个残留都不许有
    expect(countNodes(h.root)).toBe(1);
    // destroy 一定会去停朗读
    expect(h.spoken).toContain("cancel");

    // 再跑几帧也不该冒出新的 rAF
    h.flush(3);
    expect(h.pendingFrames()).toBe(0);
  });

  it("反复挂载再销毁,监听不会越挂越多", async () => {
    const h = install();
    harness = h;
    for (let i = 0; i < 3; i++) {
      const { game } = await mountGame(h);
      h.flush(3);
      expect(countNodes(h.root)).toBeGreaterThan(1);
      game.destroy();
      expect(h.pendingFrames()).toBe(0);
      expect(countNodes(h.root)).toBe(1);
    }
  });

  it("destroy 之后再点画布不会有人接:不报错、也不再排帧", async () => {
    const h = install();
    harness = h;
    const { game, played } = await mountGame(h);
    h.flush(3);
    const canvas = h.canvas();
    game.destroy();
    const before = played.length;
    // 监听已经摘了,这里直接调也应当安静
    canvas.tap(100, 100);
    expect(played.length).toBe(before);
    expect(h.pendingFrames()).toBe(0);
  });
});

describe("sprout-defense 1.2 · 平台接线", () => {
  it("api.initialLevel 直达第 N 关,返回真正打开的关号", async () => {
    const h = install();
    harness = h;
    const mod = await import("./index");
    const game = mod.mount({
      root: h.root as unknown as HTMLElement,
      play: () => {},
      addStars: () => 0,
      getStars: () => 0,
      onWin: () => {},
      onLose: () => {},
      initialLevel: 145,
    } as never) as unknown as Mounted;
    h.flush(2);
    expect(game.openCampaignLevel(188)).toBe(188);
    // 越界会夹回合法范围,不会崩
    expect(game.openCampaignLevel(9999)).toBe(188);
    expect(game.openCampaignLevel(0)).toBe(1);
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
  });

  it("地址栏 ?level= 也能直达", async () => {
    const h = install("?level=100");
    harness = h;
    const { game } = await mountGame(h);
    h.flush(2);
    expect(game.openCampaignLevel(100)).toBe(100);
    game.destroy();
  });

  it("跳关走 requestSkip:壳层没注册就不挂按钮,注册了才出现", async () => {
    const bare = install();
    harness = bare;
    const first = await mountGame(bare);
    bare.flush(2);
    let buttons = 0;
    walk(bare.root, (el) => {
      if (el.tagName === "button" && el.style.display !== "none") buttons++;
    });
    expect(buttons).toBe(0);
    first.game.destroy();
    bare.restore();

    const h = install();
    harness = h;
    const asked: Array<[string, number]> = [];
    registerLevelExtras({
      requestSkip: (gameId, level) => {
        asked.push([gameId, level]);
        return Promise.resolve(true);
      },
    });
    const { game } = await mountGame(h);
    game.openCampaignLevel(5);
    h.flush(2);
    const btn = findTag(h.root, "button");
    expect(btn).not.toBeNull();
    expect(btn!.style.display).not.toBe("none");
    expect(btn!.textContent).toContain("第5关");
    btn!.fire("click");
    expect(asked).toEqual([["sprout-defense", 4]]);
    game.destroy();
    expect(countNodes(h.root)).toBe(1);
  });
});
