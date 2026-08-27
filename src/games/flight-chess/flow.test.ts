import { afterEach, describe, expect, it, vi } from "vitest";
import { meta } from "./meta";
import { BASE, COLOR_INFO, GOAL, RING_LEN, type Color } from "./board";
import { CLASSIC_RULES } from "./dice";
import { createState, place, resolveLanding } from "./rules";
import { levelConfig } from "./levels";
import {
  CSS,
  FLIGHT_CONSTS,
  MODE_TITLE,
  cellSummary,
  createTable,
  diceFace,
  mount,
  movePreview,
  overLine,
  pctOf,
  tokenXY
} from "./index";
import guideBook from "./guide";

/* ------------------------------------------------------------------ */
/* 极简假 DOM:够 createTable / mountLevelGame 跑起来，用来验 destroy    */
/* ------------------------------------------------------------------ */

type Handler = (e: unknown) => void;

class FakeEl {
  readonly tagName: string;
  readonly children: FakeEl[] = [];
  parent: FakeEl | null = null;
  readonly style: Record<string, string> = {};
  readonly attrs = new Map<string, string>();
  readonly listeners = new Map<string, Handler[]>();
  private classes = new Set<string>();
  textContent = "";
  innerHTML = "";
  type = "";
  disabled = false;
  hidden = false;

  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
  }

  get className(): string {
    return [...this.classes].join(" ");
  }

  set className(v: string) {
    this.classes = new Set(String(v).split(/\s+/).filter(Boolean));
  }

  readonly classList = {
    add: (...names: string[]): void => {
      for (const n of names) this.classes.add(n);
    },
    remove: (...names: string[]): void => {
      for (const n of names) this.classes.delete(n);
    },
    toggle: (name: string, force?: boolean): void => {
      const on = force === undefined ? !this.classes.has(name) : force;
      if (on) this.classes.add(name);
      else this.classes.delete(name);
    },
    contains: (name: string): boolean => this.classes.has(name)
  };

  appendChild(kid: FakeEl): FakeEl {
    kid.parent?.removeChild(kid);
    kid.parent = this;
    this.children.push(kid);
    return kid;
  }

  append(...kids: FakeEl[]): void {
    for (const k of kids) this.appendChild(k);
  }

  removeChild(kid: FakeEl): void {
    const i = this.children.indexOf(kid);
    if (i >= 0) this.children.splice(i, 1);
    kid.parent = null;
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }

  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }

  addEventListener(type: string, fn: Handler): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, fn: Handler): void {
    const list = this.listeners.get(type) ?? [];
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  click(): void {
    for (const fn of [...(this.listeners.get("click") ?? [])]) fn({ preventDefault() {} });
  }

  focus(): void {
    /* 假 DOM 不需要真的聚焦 */
  }

  scrollIntoView(): void {
    /* 同上 */
  }

  descendants(): FakeEl[] {
    const out: FakeEl[] = [];
    const walk = (el: FakeEl): void => {
      for (const kid of el.children) {
        out.push(kid);
        walk(kid);
      }
    };
    walk(this);
    return out;
  }

  querySelectorAll(sel: string): FakeEl[] {
    const want = sel.trim();
    return this.descendants().filter((el) =>
      want.startsWith(".") ? el.classList.contains(want.slice(1)) : el.tagName === want.toUpperCase()
    );
  }

  querySelector(sel: string): FakeEl | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }
}

interface FakeWorld {
  root: FakeEl;
  keydowns: () => number;
  press: (key: string) => void;
  restore: () => void;
}

function installDom(): FakeWorld {
  const winListeners = new Map<string, Handler[]>();
  const doc = {
    createElement: (tag: string) => new FakeEl(tag),
    createElementNS: (_ns: string, tag: string) => new FakeEl(tag),
    body: new FakeEl("body")
  };
  const win = {
    addEventListener(type: string, fn: Handler) {
      const list = winListeners.get(type) ?? [];
      list.push(fn);
      winListeners.set(type, list);
    },
    removeEventListener(type: string, fn: Handler) {
      const list = winListeners.get(type) ?? [];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    }
  };
  const g = globalThis as Record<string, unknown>;
  const saved = { document: g.document, window: g.window, add: g.addEventListener, remove: g.removeEventListener };
  g.document = doc;
  g.window = win;
  g.addEventListener = win.addEventListener;
  g.removeEventListener = win.removeEventListener;
  return {
    root: new FakeEl("div"),
    keydowns: () => (winListeners.get("keydown") ?? []).length,
    press: (key: string) => {
      for (const fn of [...(winListeners.get("keydown") ?? [])]) fn({ key, preventDefault() {} });
    },
    restore: () => {
      g.document = saved.document;
      g.window = saved.window;
      g.addEventListener = saved.add;
      g.removeEventListener = saved.remove;
    }
  };
}

function fakeApi(root: FakeEl): {
  api: Parameters<typeof mount>[0];
  sounds: string[];
} {
  const sounds: string[] = [];
  const api = {
    root: root as unknown as HTMLElement,
    play: (n: string) => {
      sounds.push(n);
    },
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => undefined,
    onLose: () => undefined
  };
  return { api: api as unknown as Parameters<typeof mount>[0], sounds };
}

afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */

describe("meta 与首页契约", () => {
  it("meta 按规格逐字落地", () => {
    expect(meta).toEqual({
      id: "flight-chess",
      title: "飞行棋乐园",
      emoji: "✈️",
      category: "party",
      color: "#D6F0FF",
      blurb: "四个人掷骰子绕圈飞。叠在一起最安全，跳格飞线最开心，先到齐的人获胜。",
      modes: ["campaign", "versus", "endless", "twoPlayer"],
      levels: 188,
      platform: "both"
    });
  });

  it("攻略配齐了，gameId 与目录名一致，只讲方法不给答案", () => {
    expect(guideBook.gameId).toBe("flight-chess");
    expect(guideBook.entries).toHaveLength(8);
    expect(guideBook.entries[0].from).toBe(1);
    expect(guideBook.entries.at(-1)?.to).toBe(188);
    const all = [guideBook.title, ...guideBook.general, ...guideBook.entries.flatMap((e) => [e.title, ...e.tips])];
    for (const line of all) {
      expect(line).not.toMatch(/答案|坠毁|爆炸/);
      expect(line.length).toBeGreaterThan(2);
    }
  });

  it("三个额外模式都有中文名", () => {
    expect(Object.keys(MODE_TITLE)).toEqual(["versus", "endless", "duo"]);
    for (const v of Object.values(MODE_TITLE)) expect(v.length).toBeGreaterThan(2);
  });
});

describe("界面纯函数", () => {
  it("节奏常量都在合理范围，走格绝不瞬移", () => {
    expect(FLIGHT_CONSTS.HOP_MS).toBeGreaterThanOrEqual(100);
    expect(FLIGHT_CONSTS.ARC_MS).toBeGreaterThan(FLIGHT_CONSTS.HOP_MS);
    expect(FLIGHT_CONSTS.BEAT_MS).toBeGreaterThan(0);
    expect(FLIGHT_CONSTS.SPIN_MS).toBeGreaterThan(0);
    expect(FLIGHT_CONSTS.RING_LEN).toBe(52);
    expect(FLIGHT_CONSTS.GOAL).toBe(57);
    expect(FLIGHT_CONSTS.SIX_STREAK_LIMIT).toBe(3);
  });

  it("样式表:字号一律 ≥13px，能点的飞机有 ≥44px 热区，棋盘保持正方形", () => {
    const px = [...CSS.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(px.length).toBeGreaterThan(8);
    for (const n of px) expect(n).toBeGreaterThanOrEqual(13);
    // clamp 的下限也要够大
    for (const m of CSS.matchAll(/font-size:\s*clamp\((\d+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(13);
    const hot = /\.fc-token-can::before\{[^}]*width:44px;height:44px/.exec(CSS);
    expect(hot).not.toBeNull();
    for (const cls of [".fc-btn", ".fc-pick", ".fc-open", ".fc-back"]) {
      const rule = new RegExp(`\\${cls}\\{[^}]*min-height:(\\d+)px`).exec(CSS);
      expect(Number(rule?.[1])).toBeGreaterThanOrEqual(44);
    }
    expect(CSS).toContain("aspect-ratio:1");
  });

  it("棋子坐标都落在棋盘内，基地与路上分得清", () => {
    for (const c of [0, 1, 2, 3] as Color[]) {
      for (const p of [BASE, 0, 25, RING_LEN + 3, GOAL]) {
        const pos = pctOf(tokenXY(c, p, 0));
        expect(pos.left).toBeGreaterThan(0);
        expect(pos.left).toBeLessThan(100);
        expect(pos.top).toBeGreaterThan(0);
        expect(pos.top).toBeLessThan(100);
      }
      expect(tokenXY(c, BASE, 0)).not.toEqual(tokenXY(c, BASE, 1));
    }
  });

  it("骰面有六个，落在 1..6 之外也不会给 undefined", () => {
    for (let i = 1; i <= 6; i++) expect(diceFace(i).length).toBeGreaterThan(0);
    expect(diceFace(0)).toBeTruthy();
    expect(diceFace(9)).toBe("🎲");
  });

  it("这一手能干什么的提示写得清楚", () => {
    const s = createState([0, 1], CLASSIC_RULES);
    place(s, 0, [10, BASE, BASE, BASE]);
    const line = movePreview(s, { kind: "fly", plane: { color: 0, idx: 0 } }, 2);
    expect(line).toContain("朵朵");
    expect(line).toContain("航线");
    expect(line).not.toContain("undefined");
    expect(movePreview(s, { kind: "takeOff", plane: { color: 0, idx: 1 } }, 6)).toContain("起飞");
  });

  it("格子说明认得出本色格与航线格", () => {
    expect(cellSummary(0, 16)).toContain("虚线航线");
    expect(cellSummary(0, 12)).toContain("本色格");
    expect(cellSummary(0, BASE)).toContain("基地");
    expect(cellSummary(0, RING_LEN + 2)).toContain("终点通道");
    for (const c of [0, 1, 2, 3] as Color[]) expect(cellSummary(c, 5)).not.toContain("undefined");
  });

  it("结算文案只鼓励，不批评", () => {
    expect(overLine(true, 4)).toContain("拿下");
    const lose = overLine(false, 1);
    expect(lose).toContain("差一点点");
    expect(lose).not.toMatch(/输惨|太笨|失败者/);
  });
});

describe("牌桌:挂载、走完一局、destroy 干净", () => {
  it("四个电脑对手自己能把一局打完，然后 destroy 清干净", () => {
    vi.useFakeTimers();
    const world = installDom();
    let over = 0;
    let winner: Color | null = null;
    const table = createTable(world.root as unknown as HTMLElement, {
      seats: [
        { color: 0, human: null, tier: "pro" },
        { color: 1, human: null, tier: "normal" },
        { color: 2, human: null, tier: "hell" },
        { color: 3, human: null, tier: "rookie" }
      ],
      rules: CLASSIC_RULES,
      seed: 4242,
      rounds: 200,
      goalText: "测试局",
      sfx: () => undefined,
      onOver: (r) => {
        over++;
        winner = r.winner;
      }
    });

    expect(world.root.children.length).toBe(1);
    expect(world.keydowns()).toBe(1);
    // 棋盘上 16 架飞机都画出来了
    expect(world.root.querySelectorAll(".fc-token").length).toBe(16);

    vi.advanceTimersByTime(1000 * 60 * 12);
    expect(over).toBe(1);
    expect(winner).not.toBeNull();

    table.destroy();
    expect(world.root.children.length).toBe(0);
    expect(world.keydowns()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    world.restore();
  });

  it("人类座位:F 掷骰、G 换飞机，Esc 能开关暂停", () => {
    vi.useFakeTimers();
    const world = installDom();
    const table = createTable(world.root as unknown as HTMLElement, {
      seats: [
        { color: 0, human: "duo", tier: "pro" },
        { color: 2, human: null, tier: "rookie" }
      ],
      rules: CLASSIC_RULES,
      setup: [[6, 20, 30, BASE], [], [], []],
      seed: 77,
      goalText: "测试局",
      sfx: () => undefined,
      onOver: () => undefined
    });

    const rollBtn = world.root.querySelectorAll(".fc-btn-go")[0];
    expect(rollBtn.disabled).toBe(false);
    world.press("f");
    vi.advanceTimersByTime(2000);
    // 掷完之后要么在选飞机，要么已经走完轮到电脑
    const picks = world.root.querySelectorAll(".fc-pick");
    expect(picks).toHaveLength(4);
    world.press("g");
    world.press("Escape");
    expect(world.root.querySelectorAll(".fc-pause")).toHaveLength(1);
    world.press("Escape");
    expect(world.root.querySelectorAll(".fc-pause")).toHaveLength(0);

    table.destroy();
    expect(vi.getTimerCount()).toBe(0);
    expect(world.keydowns()).toBe(0);
    world.restore();
  });

  it("闯关第 1 关能挂上，destroy 之后再进不报错", () => {
    vi.useFakeTimers();
    const world = installDom();
    const { api } = fakeApi(world.root);
    const handle = mount(api);
    expect(world.root.children.length).toBe(1);
    expect(world.root.querySelectorAll(".fc-open")).toHaveLength(3);
    // 选关地图上第 1 关点进去
    const nodes = world.root.querySelectorAll(".l99-node");
    expect(nodes.length).toBeGreaterThan(0);
    nodes[0].click();
    vi.advanceTimersByTime(3000);
    expect(world.root.querySelectorAll(".fc-board").length).toBe(1);

    handle.destroy();
    expect(world.root.children.length).toBe(0);
    expect(world.keydowns()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    const again = mount(api);
    expect(world.root.children.length).toBe(1);
    again.destroy();
    expect(world.root.children.length).toBe(0);
    world.restore();
  });

  it("残局关里「不动」的座位只当路障:轮不到它掷骰，飞机一格都不挪", () => {
    vi.useFakeTimers();
    const world = installDom();
    const table = createTable(world.root as unknown as HTMLElement, {
      seats: [
        { color: 0, human: null, tier: "pro" },
        { color: 2, human: null, tier: "hell", idle: true }
      ],
      rules: CLASSIC_RULES,
      setup: [
        [3, 9, BASE, BASE],
        [],
        [14, 14, 20, BASE],
        []
      ],
      dice: [6, 4, 5, 3, 2, 6, 4, 1],
      seed: 31,
      goalText: "测试局",
      sfx: () => undefined,
      onOver: () => undefined
    });

    const idleSeat = world.root
      .querySelectorAll(".fc-seat")
      .find((el) => el.innerHTML.includes(COLOR_INFO[2].name));
    expect(idleSeat?.innerHTML).toContain("补给");

    vi.advanceTimersByTime(1000 * 60);
    // 轮到谁的提示始终是朵朵，另一色的三架还停在摆好的位置上
    const badge = world.root.querySelectorAll(".fc-badge")[0];
    expect(badge.textContent).toContain(COLOR_INFO[0].name);
    const parked = world.root
      .querySelectorAll(".fc-token")
      .filter((el) => (el.getAttribute("aria-label") ?? "").startsWith(COLOR_INFO[2].name))
      .map((el) => el.getAttribute("aria-label"));
    expect(parked).toHaveLength(4);
    expect(parked.filter((t) => t?.includes("基地"))).toHaveLength(1);

    table.destroy();
    expect(vi.getTimerCount()).toBe(0);
    world.restore();
  });

  it("闯关关卡的目标能被参考走法之外的玩法达成前，先把配置读对", () => {
    const cfg = levelConfig(0);
    expect(cfg.seats).toContain(cfg.player);
    expect(cfg.dice.length).toBeGreaterThan(3);
    const s = createState(cfg.seats, cfg.rules);
    for (let c = 0; c < 4; c++) place(s, c as Color, cfg.setup[c] ?? []);
    // 初始局面里的每一架都能被结算函数处理，不抛异常
    for (const c of cfg.seats) {
      for (let i = 0; i < 4; i++) {
        expect(() => resolveLanding(s, { color: c, idx: i }, 3)).not.toThrow();
      }
    }
    expect(COLOR_INFO[cfg.player].name).toBe("朵朵");
  });
});
