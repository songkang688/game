/**
 * 1.3 视觉契约测试(英杰令)。
 *
 * 只加不改:引擎、卡牌效果、距离、技能的旧测试一个都不动,这里专门钉住
 * 「卡面/头像/牌背/心形排/出牌动画/弱动效降级」这些新画出来的东西。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAR_COLORS, hexToRgb } from "../../art/kit";
import {
  GEARS,
  SUITS,
  cardLabel,
  makeCard,
  type Card,
  type CardKind,
  type GearId,
  type Suit
} from "./cards";
import { HEROES } from "./heroes";
import type { SeatSpec } from "./engine";
import {
  PLATE_COLORS,
  PORTRAIT_IDS,
  SUIT_ART,
  cardArtSVG,
  cardBackSVG,
  deckStackSVG,
  emptyDiscardSVG,
  gearIconSVG,
  healRiseSVG,
  heartsSVG,
  heroPortrait,
  kindIconSVG,
  petalBitSVG,
  plateKind,
  slashArcSVG,
  statIconSVG,
  suitGlyphSVG
} from "./cardart";
import { FLY_MS, HC_CSS, HOLD_MS, HUMAN, PETAL_MS, createTable, seatSummary, type TableResult } from "./index";

const ALL_KINDS: readonly CardKind[] = [
  "slash",
  "dodge",
  "heal",
  "snatch",
  "dismantle",
  "duel",
  "petalStorm",
  "starShower",
  "playful",
  "nullify",
  "borrow",
  "weapon",
  "armor",
  "horsePlus",
  "horseMinus"
];

const GEAR_IDS = Object.keys(GEARS) as GearId[];

function count(hay: string, needle: string): number {
  return hay.split(needle).length - 1;
}

// ---------------------------------------------------------------------------
// 纯函数资产:不需要 DOM
// ---------------------------------------------------------------------------

describe("卡面 cardArtSVG", () => {
  it("每种牌 × 每门花色都画得出:非空、含 <svg,还带三层(角标/中图/名牌)", () => {
    for (const kind of ALL_KINDS) {
      for (const suit of SUITS) {
        const svg = cardArtSVG(makeCard(kind, suit, 7));
        expect(svg.length, `${kind}/${suit}`).toBeGreaterThan(80);
        expect(svg).toContain("<svg");
        // 角标点数与底部名牌的文字层
        expect(svg).toContain('class="hc-card-suit"');
        expect(svg).toContain('class="hc-card-name"');
      }
    }
  });

  it("红门(花/果)卡面含红色系填充,黑门(叶/石)含深色系", () => {
    for (const suit of SUITS) {
      const art = SUIT_ART[suit];
      const rgb = hexToRgb(art.color);
      expect(rgb, suit).not.toBeNull();
      const svg = cardArtSVG(makeCard("slash", suit, 7));
      expect(svg).toContain(art.color);
      if (suit === "flower" || suit === "berry") {
        // 红色系:红通道压过绿蓝
        expect(rgb!.r).toBeGreaterThan(rgb!.g);
        expect(rgb!.r).toBeGreaterThan(rgb!.b);
      } else {
        // 黑色系:整体够暗(传统黑花色),色弱下还有形状兜底
        expect(rgb!.r + rgb!.g + rgb!.b).toBeLessThan(320);
      }
    }
  });

  it("四门花色符号剪影互不相同(形状+颜色双通道)", () => {
    const glyphs = SUITS.map((s: Suit) => suitGlyphSVG(s));
    expect(new Set(glyphs).size).toBe(SUITS.length);
    for (const g of glyphs) expect(g).toContain("<svg");
  });

  it("点数与牌名进了卡面文字层", () => {
    const ace = cardArtSVG(makeCard("slash", "flower", 1));
    expect(ace).toContain(">A</text>");
    expect(ace).toContain("花瓣击");
    const gear = cardArtSVG(makeCard("weapon", "leaf", 12, "ribbon"));
    expect(gear).toContain(">Q</text>");
    expect(gear).toContain("长虹彩带");
  });

  it("名牌分色:攻击红/防御蓝/回复绿/锦囊紫/装备棕,五色互不相同且都是合法色值", () => {
    expect(plateKind("slash")).toBe("attack");
    expect(plateKind("duel")).toBe("attack");
    expect(plateKind("dodge")).toBe("guard");
    expect(plateKind("nullify")).toBe("guard");
    expect(plateKind("heal")).toBe("heal");
    expect(plateKind("snatch")).toBe("trick");
    expect(plateKind("playful")).toBe("trick");
    expect(plateKind("weapon")).toBe("gear");
    expect(plateKind("horseMinus")).toBe("gear");
    const colors = Object.values(PLATE_COLORS);
    expect(new Set(colors).size).toBe(colors.length);
    for (const c of colors) expect(hexToRgb(c)).not.toBeNull();
  });

  it("八件装备小图标互不相同,任意牌类小图标也画得出", () => {
    const icons = GEAR_IDS.map((id) => gearIconSVG(id));
    expect(new Set(icons).size).toBe(GEAR_IDS.length);
    for (const s of icons) expect(s).toContain("<svg");
    expect(kindIconSVG("playful")).toContain("<svg");
  });
});

describe("牌背与牌堆", () => {
  it("牌背是深蓝底 + 金色云纹 + 「令」字圆章", () => {
    const back = cardBackSVG();
    expect(back).toContain("<svg");
    expect(back).toContain("#3f4f74");
    expect(back).toContain("#ffd34e");
    expect(back).toContain("令");
  });

  it("牌堆实体叠了三张牌背", () => {
    expect(count(deckStackSVG(), "令")).toBe(3);
  });

  it("弃牌堆空位是虚线框,不是空白", () => {
    const empty = emptyDiscardSVG();
    expect(empty).toContain("<svg");
    expect(empty).toContain("stroke-dasharray");
  });
});

describe("体力心形排 heartsSVG", () => {
  it("实心数 = 元气,总数 = 上限", () => {
    const svg = heartsSVG(2, 4);
    expect(count(svg, "hc-heart-full")).toBe(2);
    expect(count(svg, "hc-heart-empty")).toBe(2);
  });

  it("越界都收得住:超上限截断、负数当零、零上限给空串", () => {
    expect(count(heartsSVG(9, 4), "hc-heart-full")).toBe(4);
    expect(count(heartsSVG(-1, 4), "hc-heart-full")).toBe(0);
    expect(count(heartsSVG(-1, 4), "hc-heart-empty")).toBe(4);
    expect(heartsSVG(0, 0)).toBe("");
  });
});

describe("英杰头像 heroPortrait", () => {
  it("十四位英杰个个非空、互不相同", () => {
    expect(PORTRAIT_IDS.length).toBe(HEROES.length);
    const faces = PORTRAIT_IDS.map((id) => heroPortrait(id));
    for (const f of faces) {
      expect(f).toContain("<svg");
      expect(f.length).toBeGreaterThan(120);
    }
    expect(new Set(faces).size).toBe(faces.length);
  });

  it("朵朵与星星是全家共享 IP,配色必须走 kit 的 CHAR_COLORS", () => {
    expect(heroPortrait("duoduo")).toContain(CHAR_COLORS.duoduo.primary);
    expect(heroPortrait("xingxing")).toContain(CHAR_COLORS.xingxing.primary);
    // 双人可分辨:两位主色不同(kit 契约在这一款里再钉一遍)
    expect(CHAR_COLORS.duoduo.primary).not.toBe(CHAR_COLORS.xingxing.primary);
  });

  it("每张脸都有大眼 + 腮红 + 落地软阴影(三阶标准)", () => {
    for (const id of PORTRAIT_IDS) {
      const f = heroPortrait(id);
      expect(count(f, "<ellipse"), id).toBeGreaterThanOrEqual(3);
      expect(f).toContain("rgba(107,79,63");
    }
  });
});

describe("特效小件", () => {
  it("花瓣与星屑两种粒子都画得出且不同", () => {
    const petal = petalBitSVG("petal");
    const spark = petalBitSVG("spark");
    expect(petal).toContain("<svg");
    expect(spark).toContain("<svg");
    expect(petal).not.toBe(spark);
  });

  it("剑光弧带星星不带血,回血飘字带 +1", () => {
    expect(slashArcSVG()).toContain("<svg");
    expect(healRiseSVG()).toContain("+1");
    for (const k of ["attack", "guard", "heal"] as const) expect(statIconSVG(k)).toContain("<svg");
    expect(new Set([statIconSVG("attack"), statIconSVG("guard"), statIconSVG("heal")]).size).toBe(3);
  });
});

describe("CSS 契约(新增部分)", () => {
  it("扇形在 360px 窄屏退化成平排,单卡仍 ≥ 56×80", () => {
    const at = HC_CSS.indexOf("@media (max-width:360px)");
    const narrow = HC_CSS.slice(at, HC_CSS.indexOf("\n}", at));
    const cardRule = narrow.slice(narrow.indexOf(".hc-card{") + 9, narrow.indexOf("}", narrow.indexOf(".hc-card{")));
    expect(cardRule).toContain("transform:none");
    expect(cardRule).toContain("width:56px");
    expect(cardRule).toContain("min-height:80px");
  });

  it("弱动效把新加的特效层也全部收起来", () => {
    const at = HC_CSS.indexOf("@media (prefers-reduced-motion:reduce)");
    const block = HC_CSS.slice(at);
    expect(block).toContain(".hc-fx{display:none;}");
    expect(block).toContain(".hc-seat-hit{animation:none;}");
  });
});

// ---------------------------------------------------------------------------
// 桌面渲染与动画:跟 index.test 一样用假 DOM
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

let savedAdd: unknown;
let savedRemove: unknown;
let savedMatch: unknown;

function installDom(reduced = false): void {
  const g = globalThis as unknown as Record<string, unknown>;
  g.document = { createElement: (tag: string) => new FakeEl(tag) };
  savedAdd = g.addEventListener;
  savedRemove = g.removeEventListener;
  savedMatch = g.matchMedia;
  g.addEventListener = () => undefined;
  g.removeEventListener = () => undefined;
  g.matchMedia = reduced ? () => ({ matches: true }) : undefined;
}

function removeDom(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.document;
  g.addEventListener = savedAdd;
  g.removeEventListener = savedRemove;
  g.matchMedia = savedMatch;
}

const slash = (): Card => makeCard("slash", "leaf", 7);

function duel(foeVigor: number): SeatSpec[] {
  return [
    { name: "朵朵", heroId: "duoduo", role: "lord", hand: [slash(), slash(), slash()] },
    { name: "云云", heroId: "yunmu", role: "rebel", vigor: foeVigor, hand: [] }
  ];
}

function table(seats: SeatSpec[]) {
  const host = new FakeEl("div");
  const over: TableResult[] = [];
  const t = createTable(host as unknown as HTMLElement, {
    seats,
    seed: 4242,
    tier: "normal",
    goalText: "把云云请下桌",
    sfx: () => undefined,
    onOver: (r) => over.push(r)
  });
  return { host, t, over };
}

describe("牌桌渲染(视觉层)", () => {
  beforeEach(() => {
    installDom();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removeDom();
  });

  it("renderHand 的每颗按钮仍带 aria-label = cardLabel(card),卡面 SVG 进了按钮", () => {
    const { host, t } = table(duel(5));
    const hand = t.state().players[HUMAN].hand;
    const btns = host.byClass("hc-card");
    expect(btns.length).toBe(hand.length);
    btns.forEach((btn, i) => {
      expect(btn.getAttribute("aria-label")).toBe(cardLabel(hand[i]));
      expect(btn.innerHTML).toContain("<svg");
      expect(btn.innerHTML).toContain('class="hc-card-name"');
    });
    t.destroy();
  });

  it("手牌摆成扇形:每张都有 --fan/--arc,边上的比中间翘得低", () => {
    const { host, t } = table(duel(5));
    const btns = host.byClass("hc-card");
    expect(btns.length).toBeGreaterThanOrEqual(5);
    for (const b of btns) {
      expect(b.style.props["--fan"]).toMatch(/deg$/);
      expect(b.style.props["--arc"]).toMatch(/px$/);
    }
    const arc = (i: number): number => parseFloat(btns[i].style.props["--arc"]);
    const mid = Math.floor(btns.length / 2);
    expect(arc(0)).toBeGreaterThan(arc(mid));
    expect(arc(btns.length - 1)).toBeGreaterThan(arc(mid));
    t.destroy();
  });

  it("座位画着头像与心形排,实心数与 seatSummary 的元气一致", () => {
    const { host, t } = table(duel(3));
    const seats = host.byClass("hc-seat");
    seats.forEach((el, i) => {
      const m = /元气 (\d+)\/(\d+)/.exec(seatSummary(t.state(), i));
      expect(m).not.toBeNull();
      expect(count(el.innerHTML, "hc-heart-full")).toBe(Number(m![1]));
      expect(count(el.innerHTML, "hc-heart-")).toBe(Number(m![2]));
      expect(el.innerHTML).toContain('class="hc-seat-face"');
      // aria 上仍能读到元气数字
      expect(el.getAttribute("aria-label")).toContain("元气");
    });
    t.destroy();
  });

  it("桌面中心区:牌堆是叠起来的牌背,弃牌堆开局是虚位、打出一张后露出那张卡面", () => {
    const { host, t } = table(duel(3));
    expect(host.byClass("hc-deck-art")[0].innerHTML).toContain("令");
    const discardArt = host.byClass("hc-discard-art")[0];
    expect(discardArt.innerHTML).toContain("stroke-dasharray");
    host.byClass("hc-card")[0].fire("click");
    host.byClass("hc-seat")[1].fire("click");
    expect(discardArt.innerHTML).toContain('class="hc-card-name"');
    t.destroy();
  });

  it("英杰面板带自己的头像,技能与范围仍是文字", () => {
    const { host, t } = table(duel(3));
    expect(host.byClass("hc-hero-face")[0].innerHTML).toContain("<svg");
    const chips = host.byClass("hc-pile").map((c) => c.textContent);
    expect(chips.some((c) => c.includes("范围"))).toBe(true);
    expect(chips.some((c) => c.includes("牌堆"))).toBe(true);
    t.destroy();
  });
});

describe("出牌动画与弱动效降级", () => {
  afterEach(() => {
    vi.useRealTimers();
    removeDom();
  });

  it("出牌起飞行卡面 + 剑光 + 受击花瓣,动画结束后节点全部清理", () => {
    installDom();
    vi.useFakeTimers();
    const { host, t, over } = table(duel(1));
    host.byClass("hc-card")[0].fire("click");
    host.byClass("hc-seat")[1].fire("click");
    // 刚打出去:飞行卡面与特效都在
    expect(host.byClass("hc-fly").length).toBeGreaterThanOrEqual(1);
    expect(host.byClass("hc-fx").length).toBeGreaterThanOrEqual(1);
    expect(host.byClass("hc-petal").length).toBeGreaterThanOrEqual(1);
    // 飞行卡面上画的是整张卡
    expect(host.byClass("hc-fly")[0].innerHTML).toContain('class="hc-card-name"');
    // 动画都播完之后一个不剩
    vi.advanceTimersByTime(FLY_MS * 2 + HOLD_MS + PETAL_MS + 2000);
    expect(host.byClass("hc-fly").length).toBe(0);
    expect(host.byClass("hc-fx").length).toBe(0);
    expect(host.byClass("hc-petal").length).toBe(0);
    expect(over.length).toBe(1);
    t.destroy();
  });

  it("prefers-reduced-motion 下一个动画节点都不建,座位也不加震动类", () => {
    installDom(true);
    vi.useFakeTimers();
    const { host, t } = table(duel(1));
    host.byClass("hc-card")[0].fire("click");
    host.byClass("hc-seat")[1].fire("click");
    expect(host.byClass("hc-fly").length).toBe(0);
    expect(host.byClass("hc-fx").length).toBe(0);
    expect(host.byClass("hc-petal").length).toBe(0);
    expect(host.byClass("hc-seat-hit").length).toBe(0);
    vi.advanceTimersByTime(4000);
    expect(host.byClass("hc-fly").length).toBe(0);
    expect(host.byClass("hc-fx").length).toBe(0);
    t.destroy();
  });

  it("结算结果带出牌统计与胜者英杰,给结算面板画图标条", () => {
    installDom();
    vi.useFakeTimers();
    const { host, t, over } = table(duel(1));
    host.byClass("hc-card")[0].fire("click");
    host.byClass("hc-seat")[1].fire("click");
    vi.advanceTimersByTime(6000);
    expect(over.length).toBe(1);
    expect(over[0].stats.attack).toBe(1);
    expect(over[0].stats.guard).toBe(0);
    expect(over[0].winnerHero).toBe("duoduo");
    t.destroy();
  });
});
