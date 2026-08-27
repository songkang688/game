import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeCard, type Card } from "./cards";
import { ROLE_LABELS, campOf, type GameState, type Request, type Role, type SeatSpec } from "./engine";
import { levelConfig } from "./levels";
import guide from "./guide";
import {
  BEAT_MS,
  FLY_MS,
  HC_CONSTS,
  HC_CSS,
  HUMAN,
  PETAL_MS,
  REVEAL_MS,
  createTable,
  keyAction,
  meta,
  mount,
  outcomeLine,
  playableForRequest,
  randomSeats,
  revealOrder,
  seatSummary,
  type TableResult
} from "./index";

// ---------------------------------------------------------------------------
// 一份够用的 DOM 替身:仓库的单测跑在 node 环境里,不引 jsdom 也要能验 destroy
// ---------------------------------------------------------------------------

type Handler = (e: unknown) => void;

class FakeStyle {
  props: Record<string, string> = {};
  [key: string]: unknown;
  setProperty(k: string, v: string): void {
    this.props[k] = v;
  }
}

class FakeEl {
  tag: string;
  className = "";
  type = "";
  hidden = false;
  disabled = false;
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  style = new FakeStyle();
  attrs: Record<string, string> = {};
  listeners = new Map<string, Set<Handler>>();
  html = "";
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
    this.html = v;
    this.children = [];
  }

  get innerHTML(): string {
    return this.html;
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

const keys = new Map<string, Set<Handler>>();
let savedAdd: unknown;
let savedRemove: unknown;

function installDom(): void {
  keys.clear();
  const g = globalThis as unknown as Record<string, unknown>;
  g.document = { createElement: (tag: string) => new FakeEl(tag) };
  savedAdd = g.addEventListener;
  savedRemove = g.removeEventListener;
  g.addEventListener = (name: string, fn: Handler) => {
    if (!keys.has(name)) keys.set(name, new Set());
    keys.get(name)?.add(fn);
  };
  g.removeEventListener = (name: string, fn: Handler) => {
    keys.get(name)?.delete(fn);
  };
}

function removeDom(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.document;
  g.addEventListener = savedAdd;
  g.removeEventListener = savedRemove;
}

function pressKey(key: string): void {
  for (const fn of [...(keys.get("keydown") ?? [])]) fn({ key, preventDefault: () => undefined });
}

function keyListenerCount(): number {
  return keys.get("keydown")?.size ?? 0;
}

const slash = (): Card => makeCard("slash", "leaf", 7);
const dodge = (): Card => makeCard("dodge", "leaf", 5);

/** 一桌两个人:玩家是花主、手上全是花瓣击,对面元气见底 */
function duel(opts: { foeVigor?: number; foeHand?: Card[]; myHand?: Card[] } = {}): SeatSpec[] {
  return [
    { name: "朵朵", heroId: "duoduo", role: "lord", hand: opts.myHand ?? [slash(), slash(), slash()] },
    { name: "云云", heroId: "yunmu", role: "rebel", vigor: opts.foeVigor ?? 1, hand: opts.foeHand ?? [] }
  ];
}

function table(seats: SeatSpec[], extra: Partial<Parameters<typeof createTable>[1]> = {}) {
  const host = new FakeEl("div");
  const over: TableResult[] = [];
  const sfx: string[] = [];
  const t = createTable(host as unknown as HTMLElement, {
    seats,
    seed: 4242,
    tier: "normal",
    goalText: "把云云请下桌",
    sfx: (n) => sfx.push(n),
    onOver: (r) => over.push(r),
    ...extra
  });
  return { host, t, over, sfx };
}

// ---------------------------------------------------------------------------

describe("meta 与模块形状", () => {
  it("meta 从 index 原样再导出一遍,字段跟规格一致", () => {
    expect(meta.id).toBe("hero-cards");
    expect(meta.title).toBe("英杰令");
    expect(meta.emoji).toBe("🎴");
    expect(meta.category).toBe("party");
    expect(meta.color).toBe("#FFD9C8");
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("mobile");
    expect(meta.blurb.length).toBeGreaterThan(10);
  });

  it("没有双人同屏,而且 guide 里写明了为什么", () => {
    expect(meta.modes).toEqual(["campaign", "versus", "endless"]);
    expect(meta.modes).not.toContain("twoPlayer");
    expect(guide.general.join("\n")).toContain("双人同屏");
  });

  it("攻略八段对得上八章,只讲思路", () => {
    expect(guide.gameId).toBe("hero-cards");
    expect(guide.entries.length).toBe(8);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
    for (const e of guide.entries) {
      expect(e.to).toBeGreaterThanOrEqual(e.from);
      expect(e.tips.length).toBeGreaterThanOrEqual(3);
    }
    // 区间首尾相接,一关都不漏
    for (let i = 1; i < guide.entries.length; i++) {
      expect(guide.entries[i].from).toBe(guide.entries[i - 1].to + 1);
    }
  });

  it("mount 是个函数,加载模块本身不碰 DOM", () => {
    expect(typeof mount).toBe("function");
  });

  it("动画时长都在,不是瞬变", () => {
    expect(FLY_MS).toBeGreaterThanOrEqual(150);
    expect(PETAL_MS).toBeGreaterThan(FLY_MS);
    expect(BEAT_MS).toBeGreaterThan(0);
    expect(REVEAL_MS).toBeGreaterThan(0);
    expect(HC_CONSTS).toEqual({ FLY_MS, BEAT_MS, PETAL_MS, REVEAL_MS, HUMAN });
    expect(HUMAN).toBe(0);
  });
});

describe("窄屏与动效红线", () => {
  function ruleOf(css: string, selector: string): string {
    const at = css.indexOf(`${selector}{`);
    if (at < 0) return "";
    return css.slice(at + selector.length + 1, css.indexOf("}", at));
  }

  function pxOf(rule: string, prop: string): number {
    const m = new RegExp(`(?:^|;|\\s)${prop}:(\\d+)px`).exec(rule);
    return m ? Number(m[1]) : Number.NaN;
  }

  const narrow = (() => {
    const at = HC_CSS.indexOf("@media (max-width:360px)");
    return at < 0 ? "" : HC_CSS.slice(at, HC_CSS.indexOf("\n}", at));
  })();

  it("360px 那一段确实存在", () => {
    expect(narrow.length).toBeGreaterThan(40);
  });

  it("牌宽任何屏下都 ≥ 48px", () => {
    expect(pxOf(ruleOf(HC_CSS, ".hc-card"), "width")).toBeGreaterThanOrEqual(48);
    expect(pxOf(ruleOf(narrow, ".hc-card"), "width")).toBeGreaterThanOrEqual(48);
  });

  it("手牌横滑,窄屏挤不爆", () => {
    expect(ruleOf(HC_CSS, ".hc-hand")).toContain("overflow-x:auto");
    expect(ruleOf(HC_CSS, ".hc-seats")).toContain("flex-wrap:wrap");
  });

  it("按钮与座位热区 ≥ 44px,窄屏也不缩", () => {
    expect(pxOf(ruleOf(HC_CSS, ".hc-btn"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(pxOf(ruleOf(HC_CSS, ".hc-seat"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(pxOf(ruleOf(HC_CSS, ".hc-open"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(pxOf(ruleOf(HC_CSS, ".hc-back"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(ruleOf(narrow, ".hc-btn")).not.toContain("min-height");
  });

  it("要读的字号一律 ≥ 13px", () => {
    for (const sel of [".hc-badge", ".hc-seat", ".hc-seat-line", ".hc-msg", ".hc-log", ".hc-card-name", ".hc-pile"]) {
      expect(pxOf(ruleOf(HC_CSS, sel), "font-size")).toBeGreaterThanOrEqual(13);
      const tight = ruleOf(narrow, sel);
      if (tight.includes("font-size")) expect(pxOf(tight, "font-size")).toBeGreaterThanOrEqual(13);
    }
  });

  it("长名字会折行,不会把座位撑出屏幕", () => {
    expect(ruleOf(HC_CSS, ".hc-seat")).toContain("overflow-wrap:anywhere");
    expect(ruleOf(HC_CSS, ".hc-seat")).toContain("min-width:0");
    expect(ruleOf(HC_CSS, ".hc-badge")).toContain("overflow-wrap:anywhere");
  });

  it("出牌是飞过去的,掉元气是飘花瓣,不做红闪", () => {
    expect(HC_CSS).toContain(`transition:left ${FLY_MS}ms`);
    expect(HC_CSS).toContain("@keyframes hcpetal");
    expect(HC_CSS).not.toMatch(/animation:[^;]*flash/);
  });

  it("prefers-reduced-motion 下只剩数字,飞行与花瓣都收起来", () => {
    const at = HC_CSS.indexOf("@media (prefers-reduced-motion:reduce)");
    expect(at).toBeGreaterThan(0);
    const block = HC_CSS.slice(at);
    expect(block).toContain(".hc-fly{display:none;}");
    expect(block).toContain(".hc-petal{display:none;}");
  });

  it("不引用任何图片、字体或外部地址", () => {
    expect(HC_CSS).not.toMatch(/url\(/);
    expect(HC_CSS).not.toMatch(/@import/);
    expect(HC_CSS).not.toMatch(/https?:/);
  });
});

describe("键位", () => {
  it("朵朵用 WASD 挪光标、F 确定、G 取消", () => {
    expect(keyAction("w")).toBe("up");
    expect(keyAction("a")).toBe("left");
    expect(keyAction("s")).toBe("down");
    expect(keyAction("d")).toBe("right");
    expect(keyAction("f")).toBe("confirm");
    expect(keyAction("g")).toBe("cancel");
  });

  it("星星用方向键 + L / K", () => {
    expect(keyAction("ArrowUp")).toBe("up");
    expect(keyAction("ArrowDown")).toBe("down");
    expect(keyAction("ArrowLeft")).toBe("left");
    expect(keyAction("ArrowRight")).toBe("right");
    expect(keyAction("l")).toBe("confirm");
    expect(keyAction("k")).toBe("cancel");
  });

  it("Esc 暂停,回车也是确定,别的键一律不响应", () => {
    expect(keyAction("Escape")).toBe("pause");
    expect(keyAction("Enter")).toBe("confirm");
    expect(keyAction("F")).toBe("confirm");
    expect(keyAction("K")).toBe("cancel");
    expect(keyAction("z")).toBeNull();
    expect(keyAction("Tab")).toBeNull();
  });
});

describe("界面上的几句话", () => {
  const state = (): GameState => {
    const { t } = table(duel());
    const s = t.state();
    t.destroy();
    return s;
  };

  beforeEach(() => {
    installDom();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removeDom();
  });

  it("座位那一行写着元气、手牌数和距离,身份没翻开就是问号", () => {
    const s = state();
    const mine = seatSummary(s, 0);
    expect(mine).toContain("元气");
    expect(mine).toContain("手牌");
    expect(mine).toContain("自己");
    expect(mine).toContain(ROLE_LABELS.lord);
    const foe = seatSummary(s, 1);
    expect(foe).toContain("距 1");
    expect(foe).toContain("❓");
  });

  it("结算时从自己开始绕一圈揭晓身份", () => {
    const s = state();
    expect(revealOrder(s, 0)).toEqual([0, 1]);
    expect(revealOrder(s, 1)).toEqual([1, 0]);
  });

  it("输了的那句话只鼓励,一个「输」字都没有", () => {
    expect(outcomeLine("lord", "lord")).toContain("赢");
    const lose = outcomeLine("rebel", "lord");
    expect(lose).not.toContain("输");
    expect(lose).toContain("再来");
    expect(outcomeLine(null, "lord")).toContain("平局");
  });

  it("响应请求时只把打得出去的牌算进来", () => {
    const s = state();
    s.players[0].hand = [slash(), dodge(), makeCard("nullify", "leaf", 3)];
    const ask = (need: Request extends { need: infer N } ? N : never): Card[] =>
      playableForRequest(s, { kind: "respond", who: 0, need, from: 1, prompt: "" });
    expect(ask("dodge").map((c) => c.kind)).toEqual(["dodge"]);
    expect(ask("slash").map((c) => c.kind)).toEqual(["slash"]);
    expect(ask("nullify").map((c) => c.kind)).toEqual(["nullify"]);
    expect(ask("heal")).toEqual([]);
    // 不是响应请求就一张都不给
    expect(playableForRequest(s, { kind: "discard", who: 0, count: 1, prompt: "" })).toEqual([]);
  });
});

describe("牌桌", () => {
  beforeEach(() => {
    installDom();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removeDom();
  });

  it("开局摆出每个座位、自己的手牌和本关目标", () => {
    const { host, t } = table(duel());
    expect(host.byClass("hc-seat").length).toBe(2);
    // 起手三张,回合一开始又摸了两张
    expect(host.byClass("hc-card").length).toBe(5);
    expect(host.byClass("hc-badge")[0].textContent).toContain("把云云请下桌");
    // 座位上读得出元气和装备
    expect(host.byClass("hc-seat")[0].getAttribute("aria-label")).toContain("元气");
    t.destroy();
  });

  it("五个人一桌也摆得下,牌堆与技能栏都写着数", () => {
    const { host, t } = table(randomSeats(77));
    expect(host.byClass("hc-seat").length).toBe(5);
    const chips = host.byClass("hc-pile").map((c) => c.textContent);
    expect(chips.some((c) => c.includes("牌堆"))).toBe(true);
    expect(chips.some((c) => c.includes("范围"))).toBe(true);
    t.destroy();
  });

  it("点一张牌再点人,这一击就打出去了", () => {
    const { host, t } = table(duel({ foeVigor: 3 }));
    const before = t.state().players[1].vigor;
    host.byClass("hc-card")[0].fire("click");
    expect(host.byClass("hc-msg")[0].textContent).toContain("选一个人");
    host.byClass("hc-seat")[1].fire("click");
    expect(t.state().players[1].vigor).toBe(before - 1);
    // 打出去一张,又被云牧的牧云顺走一张
    expect(t.state().players[0].hand.length).toBe(3);
    expect(t.state().players[1].hand.length).toBe(1);
    t.destroy();
  });

  it("点了不该点的人会好好说一句,不是干瞪眼", () => {
    const { host, t } = table(duel({ foeVigor: 3 }));
    host.byClass("hc-card")[0].fire("click");
    host.byClass("hc-seat")[0].fire("click");
    expect(host.byClass("hc-msg")[0].textContent).toContain("指不到");
    expect(t.state().players[1].vigor).toBe(3);
    t.destroy();
  });

  it("取消之后可以重新挑一张", () => {
    const { host, t } = table(duel({ foeVigor: 3 }));
    host.byClass("hc-card")[0].fire("click");
    const cancel = host.byClass("hc-btn").find((b) => b.textContent.includes("取消"));
    cancel?.fire("click");
    expect(host.byClass("hc-msg")[0].textContent).toContain("重新挑");
    expect(t.state().players[0].hand.length).toBe(5);
    t.destroy();
  });

  it("对方挡得住就问要不要挡,挡了就不掉元气", () => {
    const { host, t } = table(duel({ foeVigor: 3, foeHand: [dodge()] }));
    host.byClass("hc-card")[0].fire("click");
    host.byClass("hc-seat")[1].fire("click");
    // 普通档的对手有盾一定挡
    expect(t.state().players[1].vigor).toBe(3);
    expect(t.state().players[1].hand.length).toBe(0);
    t.destroy();
  });

  it("轮到自己要挡的时候,手牌里只有能挡的那张亮着", () => {
    // 对面先手,朝玩家出一击
    const seats: SeatSpec[] = [
      { name: "朵朵", heroId: "duoduo", role: "lord", hand: [dodge(), makeCard("heal", "flower", 9)] },
      { name: "云云", heroId: "yunmu", role: "rebel", hand: [slash()] }
    ];
    const { host, t } = table(seats);
    // 把回合让给对手
    host.byClass("hc-btn").find((b) => b.textContent.includes("结束回合"))?.fire("click");
    vi.advanceTimersByTime(BEAT_MS * 3);
    const dim = host.byClass("hc-card").filter((c) => c.className.includes("hc-card-dim"));
    expect(host.byClass("hc-msg")[0].textContent).toContain("挡");
    expect(dim.length).toBeGreaterThanOrEqual(1);
    // 点亮着的那张就挡下来了
    const live = host.byClass("hc-card").find((c) => !c.className.includes("hc-card-dim"));
    const before = t.state().players[0].vigor;
    live?.fire("click");
    expect(t.state().players[0].vigor).toBe(before);
    t.destroy();
  });

  it("请下桌之后逐个揭晓身份,再报结果", () => {
    const { host, t, over } = table(duel({ foeVigor: 1 }));
    host.byClass("hc-card")[0].fire("click");
    host.byClass("hc-seat")[1].fire("click");
    expect(t.state().over).toBe(true);
    // 先一个个报身份
    vi.advanceTimersByTime(REVEAL_MS + 10);
    expect(host.byClass("hc-msg")[0].textContent).toContain("身份是");
    expect(over.length).toBe(0);
    vi.advanceTimersByTime(REVEAL_MS * 4);
    expect(over.length).toBe(1);
    expect(over[0].myWin).toBe(true);
    expect(over[0].winner).toBe("lord");
    t.destroy();
  });

  it("回合用完就收场,判成没赢但不算被打退", () => {
    const { host, t, over } = table(duel({ foeVigor: 5 }), { maxTurns: 1 });
    host.byClass("hc-btn").find((b) => b.textContent.includes("结束回合"))?.fire("click");
    vi.advanceTimersByTime(BEAT_MS * 6 + REVEAL_MS * 6);
    expect(over.length).toBe(1);
    expect(over[0].timeout).toBe(true);
    expect(over[0].myWin).toBe(false);
    t.destroy();
  });

  it("A / D 挪光标,始终只有一张牌被挑着", () => {
    const { host, t } = table(duel({ foeVigor: 3 }));
    const on = (): number => host.byClass("hc-card").filter((c) => c.className.includes("hc-card-on")).length;
    expect(on()).toBe(1);
    pressKey("d");
    expect(on()).toBe(1);
    pressKey("a");
    pressKey("a");
    expect(on()).toBe(1);
    t.destroy();
  });

  it("F 选牌、W / S 换人、F 打出去,全程不用鼠标", () => {
    const { host, t } = table([
      { name: "朵朵", heroId: "duoduo", role: "lord", hand: [slash()] },
      { name: "云云", heroId: "yunmu", role: "rebel", vigor: 3 },
      { name: "闪闪", heroId: "nuonuo", role: "rebel", vigor: 3 }
    ]);
    pressKey("f");
    expect(host.byClass("hc-msg")[0].textContent).toContain("选一个人");
    pressKey("s");
    pressKey("f");
    const hurt = t.state().players.filter((p) => p.vigor < 3 && p.id > 0);
    expect(hurt.length).toBe(1);
    t.destroy();
  });

  it("Esc 暂停:盖上提示层,AI 不再往下走;再按一次继续", () => {
    const seats = duel({ foeVigor: 5 });
    const { host, t } = table(seats);
    host.byClass("hc-btn").find((b) => b.textContent.includes("结束回合"))?.fire("click");
    pressKey("Escape");
    expect(host.byClass("hc-pause").length).toBe(1);
    const frozen = t.state().round;
    vi.advanceTimersByTime(BEAT_MS * 20);
    expect(t.state().round).toBe(frozen);
    pressKey("Escape");
    expect(host.byClass("hc-pause").length).toBe(0);
    t.destroy();
  });

  it("暂停时点牌不生效,手牌一张都不会少", () => {
    const { host, t } = table(duel({ foeVigor: 5 }));
    pressKey("Escape");
    host.byClass("hc-card")[0].fire("click");
    host.byClass("hc-seat")[1].fire("click");
    expect(t.state().players[0].hand.length).toBe(5);
    t.destroy();
  });

  it("暂停层上写着键位,读得懂怎么玩", () => {
    const { host, t } = table(duel({ foeVigor: 5 }));
    pressKey("Escape");
    const keysText = host.byClass("hc-keys")[0]?.parent?.innerHTML ?? host.byClass("hc-pause")[0].innerHTML;
    expect(keysText).toContain("F");
    expect(keysText).toContain("G");
    t.destroy();
  });

  it("每一步都出声,只用 api 给的那几个音效名", () => {
    const { host, t, sfx } = table(duel({ foeVigor: 3 }));
    host.byClass("hc-card")[0].fire("click");
    host.byClass("hc-seat")[1].fire("click");
    expect(sfx.length).toBeGreaterThan(0);
    for (const n of sfx) expect(["tap", "win", "oops", "coin", "pop", "meow", "jump"]).toContain(n);
    t.destroy();
  });

  it("destroy 之后监听撤干净、界面摘掉、定时器不再回调", () => {
    const before = keyListenerCount();
    const { host, t, over } = table(duel({ foeVigor: 5 }));
    expect(keyListenerCount()).toBe(before + 1);
    expect(host.children.length).toBe(1);
    host.byClass("hc-btn").find((b) => b.textContent.includes("结束回合"))?.fire("click");
    t.destroy();
    expect(keyListenerCount()).toBe(before);
    expect(host.children.length).toBe(0);
    const round = t.state().round;
    vi.advanceTimersByTime(BEAT_MS * 40);
    expect(t.state().round).toBe(round);
    expect(over.length).toBe(0);
    expect(() => pressKey("f")).not.toThrow();
  });

  it("destroy 调两次也不会炸", () => {
    const { t } = table(duel());
    t.destroy();
    expect(() => t.destroy()).not.toThrow();
  });

  it("残局配置直接摆得上桌", () => {
    for (const lv of [0, 40, 90, 150, 187]) {
      const cfg = levelConfig(lv);
      const { host, t } = table(cfg.seats, {
        seed: cfg.seed,
        tier: cfg.tier,
        recipe: cfg.recipe,
        factionLock: cfg.factionLock,
        openHand: 0,
        maxTurns: cfg.maxTurns
      });
      expect(host.byClass("hc-seat").length).toBe(cfg.seats.length);
      expect(t.state().players[0].role).toBe(cfg.seats[0].role);
      t.destroy();
    }
  });
});

describe("身份场开局", () => {
  it("randomSeats 摆出五个人:一位花主亮明,两位夺花、一位护花、一位藏花", () => {
    for (const seed of [1, 42, 777, 90210]) {
      const seats = randomSeats(seed);
      expect(seats.length).toBe(5);
      expect(seats[0].role).toBe("lord");
      const roles = seats.map((s) => s.role as Role);
      expect(roles.filter((r) => r === "rebel").length).toBe(2);
      expect(roles.filter((r) => r === "loyal").length).toBe(1);
      expect(roles.filter((r) => r === "spy").length).toBe(1);
      expect(new Set(seats.map((s) => s.heroId)).size).toBe(5);
      expect(new Set(seats.map((s) => s.name)).size).toBe(5);
      expect(new Set(roles.map(campOf)).size).toBe(3);
    }
  });
});
