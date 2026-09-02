import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { levelConfig } from "./levels";
import { parseTiles, tileFace, tileName } from "./tiles";
import {
  ART_INK,
  ART_RED,
  ART_TEAL,
  ART_VIEW,
  backArtSVG,
  bloomFlowerSVG,
  compassSVG,
  leafSVG,
  petalSVG,
  tileArtSVG
} from "./tileart";
import {
  BLOOM_MS,
  BLOOM_PETALS,
  FLY_MS,
  MJ_CSS,
  backsEl,
  bloomBurst,
  floorBadgeClass,
  mountPuzzle,
  prefersSoft,
  tileEl,
  windCompassEl,
  type Scheduler
} from "./index";

// ---------------------------------------------------------------------------
// 迷你 DOM 替身:与 index.test.ts 的思路一致,但 innerHTML 存得下来,
// 这样能断言「图案层里真的塞了 SVG」。
// ---------------------------------------------------------------------------

type Handler = (e: unknown) => void;

class El {
  tag: string;
  className = "";
  type = "";
  hidden = false;
  disabled = false;
  scrollTop = 0;
  scrollHeight = 0;
  children: El[] = [];
  parent: El | null = null;
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  listeners = new Map<string, Set<Handler>>();
  private text = "";
  private html = "";

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

  get innerHTML(): string {
    return this.html;
  }

  set innerHTML(v: string) {
    this.html = v;
    this.children = [];
  }

  get classList(): { add: (c: string) => void; contains: (c: string) => boolean } {
    return {
      add: (c: string) => {
        if (!this.has(c)) this.className = `${this.className} ${c}`.trim();
      },
      contains: (c: string) => this.has(c)
    };
  }

  has(c: string): boolean {
    return this.className.split(" ").includes(c);
  }

  appendChild(child: El): El {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...kids: El[]): void {
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

  querySelector(sel: string): El | null {
    return this.all().find((el) => el.has(sel.replace(".", ""))) ?? null;
  }

  all(): El[] {
    const out: El[] = [];
    const walk = (el: El): void => {
      out.push(el);
      for (const c of el.children) walk(c);
    };
    for (const c of this.children) walk(c);
    return out;
  }

  byClass(cls: string): El[] {
    return this.all().filter((el) => el.has(cls));
  }
}

function installDom(): void {
  const keys = new Map<string, Set<Handler>>();
  const g = globalThis as unknown as Record<string, unknown>;
  g.document = { createElement: (tag: string) => new El(tag) };
  g.window = {
    addEventListener(name: string, fn: Handler) {
      if (!keys.has(name)) keys.set(name, new Set());
      keys.get(name)?.add(fn);
    },
    removeEventListener(name: string, fn: Handler) {
      keys.get(name)?.delete(fn);
    }
  };
}

function removeDom(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.document;
  delete g.window;
}

/** 所有 34 + 8 = 42 种合法牌 id */
const LEGAL_IDS: number[] = [
  ...Array.from({ length: 9 }, (_, i) => i + 1),
  ...Array.from({ length: 9 }, (_, i) => i + 11),
  ...Array.from({ length: 9 }, (_, i) => i + 21),
  ...Array.from({ length: 7 }, (_, i) => i + 31),
  ...Array.from({ length: 8 }, (_, i) => i + 41)
];

const count = (svg: string, token: string): number => svg.split(token).length - 1;

// ---------------------------------------------------------------------------

describe("牌面 SVG:每张牌都有真图案", () => {
  it("每个合法 id 输出非空且含 <svg,规格统一 28×38", () => {
    for (const id of LEGAL_IDS) {
      const svg = tileArtSVG(id);
      expect(svg.length, `id=${id}`).toBeGreaterThan(40);
      expect(svg, `id=${id}`).toContain("<svg");
      expect(svg, `id=${id}`).toContain(`viewBox="0 0 ${ART_VIEW.w} ${ART_VIEW.h}"`);
    }
  });

  it("认不出的 id 画空框兜底,不抛异常", () => {
    expect(() => tileArtSVG(-3)).not.toThrow();
    expect(tileArtSVG(99)).toContain("<svg");
  });

  it("筒子是同心圆饼:circle 数 ≥ 点数,而且是三层饼不是单圈", () => {
    for (let r = 1; r <= 9; r++) {
      const svg = tileArtSVG(10 + r);
      expect(count(svg, "<circle"), `${r}筒`).toBeGreaterThanOrEqual(Math.max(3, r));
      expect(svg).not.toContain("<text");
    }
  });

  it("条子是竹节棒:rect 数 ≥ 点数,5 条中间一根是红的", () => {
    for (let r = 2; r <= 9; r++) {
      expect(count(tileArtSVG(20 + r), "<rect"), `${r}条`).toBeGreaterThanOrEqual(r);
    }
    expect(tileArtSVG(25)).toContain(ART_RED);
    expect(tileArtSVG(22)).not.toContain(ART_RED);
  });

  it("1 条按传统画一只小鸟:青身、红尾、点睛", () => {
    const svg = tileArtSVG(21);
    expect(svg).toContain("<path");
    expect(svg).toContain(ART_TEAL);
    expect(svg).toContain(ART_RED);
    expect(svg).toContain(ART_INK);
  });

  it("万字牌:上红色数字汉字、下黑「万」", () => {
    for (let r = 1; r <= 9; r++) {
      const svg = tileArtSVG(r);
      expect(svg, `${r}万`).toContain(">万<");
      expect(svg, `${r}万`).toContain(`>${"一二三四五六七八九"[r - 1]}<`);
      expect(svg).toContain(ART_RED);
      expect(svg).toContain(ART_INK);
    }
  });

  it("字牌传统配色:东南西北黑,中红、发绿、白=蓝色双线空框", () => {
    for (const id of [31, 32, 33, 34]) {
      const svg = tileArtSVG(id);
      expect(svg).toContain(`>${tileName(id)}<`);
      expect(svg).toContain(ART_INK);
    }
    const zhong = tileArtSVG(35);
    expect(zhong).toContain(">中<");
    expect(zhong).toContain(ART_RED);
    const fa = tileArtSVG(36);
    expect(fa).toContain(">发<");
    expect(fa).toContain(ART_TEAL);
    const bai = tileArtSVG(37);
    expect(bai).toContain(ART_INK);
    expect(count(bai, "<rect")).toBeGreaterThanOrEqual(2);
    expect(bai).not.toContain("<text");
  });

  it("花牌真的画花:五瓣 + 花芯 ≥ 6 个圆,角标写牌名", () => {
    for (let r = 1; r <= 8; r++) {
      const svg = tileArtSVG(40 + r);
      expect(count(svg, "<circle"), `花${r}`).toBeGreaterThanOrEqual(6);
      expect(svg).toContain(`>${tileName(40 + r)}<`);
    }
  });

  it("图案全是矢量代码:不引用图片、外链或位图", () => {
    for (const id of LEGAL_IDS) {
      const svg = tileArtSVG(id);
      expect(svg).not.toMatch(/url\(/);
      expect(svg).not.toMatch(/https?:/);
      expect(svg).not.toMatch(/<image/);
    }
  });
});

describe("tileEl:图案层进 DOM,无障碍与点击不变", () => {
  beforeEach(installDom);
  afterEach(removeDom);

  it("能点的牌仍是 button,aria-label 仍是中文牌名", () => {
    for (const id of [parseTiles("5p")[0], parseTiles("1s")[0], parseTiles("5z")[0]]) {
      const el = tileEl(id, { onClick: () => undefined }) as unknown as El;
      expect(el.tag).toBe("button");
      expect(el.type).toBe("button");
      expect(el.getAttribute("aria-label")).toBe(tileName(id));
    }
  });

  it("图案层塞的是这张牌的 SVG,文字层留作超小屏退化", () => {
    const id = parseTiles("7p")[0];
    const el = tileEl(id) as unknown as El;
    const art = el.byClass("mj-t-art")[0];
    expect(art).toBeTruthy();
    expect(art.innerHTML).toBe(tileArtSVG(id));
    expect(art.getAttribute("aria-hidden")).toBe("true");
    const txt = el.byClass("mj-t-txt")[0];
    expect(txt.byClass("mj-t-n")[0].textContent).toBe(tileFace(id).top);
    expect(txt.byClass("mj-t-s")[0].textContent).toBe(tileFace(id).bottom);
  });

  it("CSS 里 <340px 时图案层藏起、文字层顶上", () => {
    const at = MJ_CSS.indexOf("@media (max-width:340px)");
    expect(at).toBeGreaterThan(0);
    const block = MJ_CSS.slice(at, MJ_CSS.indexOf("\n}", at));
    expect(block).toContain(".mj-t-art{display:none;}");
    expect(block).toContain(".mj-t-txt{display:flex;}");
  });
});

describe("牌背:花纹层 + 微弧,不再是紫色小药片", () => {
  beforeEach(installDom);
  afterEach(removeDom);

  it("每张牌背都有四瓣花压纹层", () => {
    const box = backsEl(5) as unknown as El;
    const backs = box.byClass("mj-back");
    expect(backs).toHaveLength(5);
    for (const b of backs) {
      const fl = b.byClass("mj-back-fl")[0];
      expect(fl).toBeTruthy();
      expect(fl.innerHTML).toContain("<svg");
      expect(fl.innerHTML).toBe(backArtSVG());
    }
  });

  it("压纹是四瓣小花:4 个花瓣椭圆 + 1 个花芯", () => {
    expect(count(backArtSVG(), "<ellipse")).toBe(4);
    expect(count(backArtSVG(), "<circle")).toBe(1);
  });

  it("整排牌背按 1.5° 一档排成微弧", () => {
    const box = backsEl(3) as unknown as El;
    const rots = box.byClass("mj-back").map((b) => b.style.transform);
    expect(rots).toEqual(["rotate(-1.50deg)", "rotate(0.00deg)", "rotate(1.50deg)"]);
  });

  it("CSS:牌背 3:4 比例、宽 ≥ 14px、绿渐变(窄屏也不低于 14px)", () => {
    const rule = (css: string, sel: string): string => {
      const at = css.indexOf(`${sel}{`);
      return at < 0 ? "" : css.slice(at + sel.length + 1, css.indexOf("}", at));
    };
    const base = rule(MJ_CSS, ".mj-back");
    const w = Number(/(?:^|;)width:(\d+)px/.exec(base)?.[1]);
    const h = Number(/(?:^|;)height:(\d+)px/.exec(base)?.[1]);
    expect(w).toBeGreaterThanOrEqual(14);
    expect(Math.abs(h / w - 4 / 3)).toBeLessThan(0.08);
    expect(base).toContain("linear-gradient");
    const at360 = MJ_CSS.indexOf("@media (max-width:360px)");
    const narrow = MJ_CSS.slice(at360, MJ_CSS.indexOf("\n}", at360));
    expect(Number(/\.mj-back\{width:(\d+)px/.exec(narrow)?.[1])).toBeGreaterThanOrEqual(14);
  });
});

describe("牌桌与牌体:毛毡、木框、三层立体", () => {
  const rule = (sel: string): string => {
    const at = MJ_CSS.indexOf(`${sel}{`);
    return at < 0 ? "" : MJ_CSS.slice(at + sel.length + 1, MJ_CSS.indexOf("}", at));
  };

  it("牌桌是深绿毛毡径向渐变 + 8px 木纹条纹边框", () => {
    const board = rule(".mj-board");
    expect(board).toContain("radial-gradient");
    expect(board).toContain("border:8px solid transparent");
    expect(board).toContain("border-box");
  });

  it("牌体三层:象牙渐变顶面 + 侧墙 inset + 绿底座", () => {
    const tile = rule(".mj-tile");
    expect(tile).toContain("linear-gradient(180deg,#FFFEF9,#F4EDDD)");
    expect(tile).toContain("inset -2px -2px 0 #D8CBAE");
    expect(tile).toContain("0 2px 0 #2E8B6A");
  });

  it("选中上浮 4px,可胡牌金边呼吸(reduced 收成单次)", () => {
    expect(rule(".mj-tile.mj-cur")).toContain("translateY(-4px)");
    expect(rule(".mj-tile.mj-hot")).toContain("animation:mjhot");
    expect(MJ_CSS).toContain("@keyframes mjhot");
    const at = MJ_CSS.indexOf("@media (prefers-reduced-motion:reduce)");
    const block = MJ_CSS.slice(at);
    expect(block).toContain(".mj-tile.mj-hot{animation-duration:60ms;animation-iteration-count:1;}");
    expect(block).not.toContain("animation:none");
  });

  it("打牌是两段弧线,摸牌有滑入弹跳,reduced 全部收短", () => {
    expect(MJ_CSS).toContain(`animation:mjfly ${FLY_MS}ms`);
    const fly = MJ_CSS.slice(MJ_CSS.indexOf("@keyframes mjfly"));
    expect(fly.slice(0, fly.indexOf("}}"))).toContain("55%");
    expect(MJ_CSS).toContain("@keyframes mjdraw");
    const at = MJ_CSS.indexOf("@media (prefers-reduced-motion:reduce)");
    const block = MJ_CSS.slice(at);
    expect(block).toContain(".mj-drawin{animation-duration:60ms;}");
    expect(block).toContain(".mj-bloom-open{animation-duration:60ms;}");
    expect(block).toContain(".mj-petal-fall{animation-duration:60ms;}");
    expect(block).toContain(".mj-leaf-fall{animation-duration:60ms;}");
  });

  it("樱花角贴、开花、落叶的关键帧都在,且不引用图片外链", () => {
    expect(MJ_CSS).toContain(".mj-wrap::before");
    expect(MJ_CSS).toContain("@keyframes mjbloom");
    expect(MJ_CSS).toContain("@keyframes mjpetal");
    expect(MJ_CSS).toContain("@keyframes mjleaf");
    expect(MJ_CSS).not.toMatch(/url\(/);
    expect(MJ_CSS).not.toMatch(/https?:/);
  });
});

describe("胡牌开花与弱动效", () => {
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

  it("正常模式:一朵五瓣主花 + 12 片花瓣飘落,播完自动收场", () => {
    const host = new El("div");
    bloomBurst(host as unknown as HTMLElement, false, sched);
    expect(host.byClass("mj-bloom")).toHaveLength(1);
    const core = host.byClass("mj-bloom-core")[0];
    expect(core.has("mj-bloom-open")).toBe(true);
    expect(core.innerHTML).toBe(bloomFlowerSVG());
    expect(host.byClass("mj-petal")).toHaveLength(BLOOM_PETALS);
    for (const p of host.byClass("mj-petal")) expect(p.has("mj-petal-fall")).toBe(true);
    vi.advanceTimersByTime(BLOOM_MS + 300);
    expect(host.byClass("mj-bloom")).toHaveLength(0);
  });

  it("soft:不加任何动画类,只留一朵金光静态花闪一下", () => {
    const host = new El("div");
    bloomBurst(host as unknown as HTMLElement, true, sched);
    expect(host.byClass("mj-bloom")).toHaveLength(1);
    expect(host.byClass("mj-petal")).toHaveLength(0);
    expect(host.byClass("mj-petal-fall")).toHaveLength(0);
    expect(host.byClass("mj-bloom-open")).toHaveLength(0);
    expect(host.byClass("mj-bloom-flash")).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(host.byClass("mj-bloom")).toHaveLength(0);
  });

  it("闯关胡牌:先在牌面区开花,花开完番种表才弹出来", () => {
    const stage = new El("div");
    const cfg = levelConfig(0);
    const handle = mountPuzzle(stage as unknown as HTMLElement, cfg, {
      win: () => undefined,
      lose: () => undefined,
      sfx: () => undefined
    });
    for (let i = 0; i < cfg.wall.length - 1; i++) {
      vi.advanceTimersByTime(400);
      stage.byClass("mj-drawn")[0].fire("click");
      vi.advanceTimersByTime(FLY_MS + 120);
    }
    vi.advanceTimersByTime(400);
    stage.byClass("mj-go")[0].fire("click");
    expect(stage.byClass("mj-bloom")).toHaveLength(1);
    expect(stage.byClass("mj-petal")).toHaveLength(BLOOM_PETALS);
    expect(stage.byClass("mj-sheet")).toHaveLength(0);
    vi.advanceTimersByTime(BLOOM_MS + 60);
    expect(stage.byClass("mj-sheet")).toHaveLength(1);
    handle.destroy();
  });

  it("prefersSoft 跟着系统的 prefers-reduced-motion 走,拿不到就当没开", () => {
    const g = globalThis as unknown as Record<string, unknown>;
    expect(prefersSoft()).toBe(false);
    g.matchMedia = (q: string) => ({ matches: q.includes("prefers-reduced-motion") });
    expect(prefersSoft()).toBe(true);
    g.matchMedia = () => ({ matches: false });
    expect(prefersSoft()).toBe(false);
    delete g.matchMedia;
  });
});

describe("HUD:圈风罗盘与番起和等级色", () => {
  beforeEach(installDom);
  afterEach(removeDom);

  it("罗盘徽章:文字还在(读屏/旧断言都认),盘面点亮当前圈风", () => {
    const el = windCompassEl(1, "东圈") as unknown as El;
    expect(el.has("mj-badge")).toBe(true);
    expect(el.textContent).toBe("东圈");
    const dial = el.byClass("mj-dial")[0];
    expect(dial.innerHTML).toBe(compassSVG(1));
    expect(dial.innerHTML).toContain("<svg");
  });

  it("四个圈风点亮的方位各不相同,越界输入不抛", () => {
    const faces = [1, 2, 3, 4].map(compassSVG);
    expect(new Set(faces).size).toBe(4);
    expect(compassSVG(99)).toBe(compassSVG(4));
    expect(compassSVG(Number.NaN)).toBe(compassSVG(1));
  });

  it("番起和门槛分花苞等级色,样式表里三档都有", () => {
    expect(floorBadgeClass(1)).toBe("mj-floor-bud");
    expect(floorBadgeClass(8)).toBe("mj-floor-rose");
    expect(floorBadgeClass(16)).toBe("mj-floor-gold");
    for (const cls of ["mj-floor-bud", "mj-floor-rose", "mj-floor-gold"]) {
      expect(MJ_CSS).toContain(`.mj-badge.${cls}{`);
    }
  });

  it("落叶与花瓣素材都是内联矢量", () => {
    expect(leafSVG()).toContain("<svg");
    expect(leafSVG()).toContain("<path");
    expect(petalSVG(0)).toContain("<svg");
    expect(petalSVG(0)).not.toBe(petalSVG(1));
  });
});
