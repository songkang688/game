import { afterEach, describe, expect, it } from "vitest";
import type { StorageLike } from "../engine/save";
import type { Bonus, Loadout, Wallet } from "../engine/collection";
import {
  CollectionStore,
  GEARS,
  HEROES,
  MAX_LEVEL,
  PETS,
  itemById,
  unlockCost,
  upgradeCost
} from "../engine/collection";
import {
  PANEL_TITLE,
  TABS,
  bonusLines,
  cardStatus,
  closeCollection,
  drawFigure,
  figureAlt,
  figurePalette,
  isCollectionOpen,
  levelLabel,
  openCollection,
  outfitLine,
  scopeNote,
  slotTag,
  starsLabel
} from "./collection";

// ---------------------------------------------------------------------------
// 极简 DOM 桩:仓库的 vitest 跑在 node 环境(无 jsdom),
// 这里只实现收藏面板真正用到的那几样能力,不引入任何外部依赖。
// ---------------------------------------------------------------------------

type Handler = (e: FakeEvent) => void;

interface FakeEvent {
  key?: string;
  shiftKey?: boolean;
  target?: unknown;
  defaultPrevented?: boolean;
  preventDefault: () => void;
}

function makeEvent(target: unknown, extra: Partial<FakeEvent> = {}): FakeEvent {
  const e: FakeEvent = {
    target,
    defaultPrevented: false,
    preventDefault() {
      e.defaultPrevented = true;
    },
    ...extra
  };
  return e;
}

/** Canvas 2D 的记录桩:把每一笔画调用记下来,好断言「确实画了东西」 */
class FakeCtx {
  readonly calls: string[] = [];
  fillStyle = "";
  clearRect(): void {
    this.calls.push("clearRect");
  }
  beginPath(): void {
    this.calls.push("beginPath");
  }
  closePath(): void {
    this.calls.push("closePath");
  }
  moveTo(): void {
    this.calls.push("moveTo");
  }
  lineTo(): void {
    this.calls.push("lineTo");
  }
  arc(): void {
    this.calls.push("arc");
  }
  rect(): void {
    this.calls.push("rect");
  }
  fill(): void {
    this.calls.push(`fill:${this.fillStyle}`);
  }
}

class FakeEl {
  tagName: string;
  className = "";
  private text = "";
  type = "";
  id = "";
  disabled = false;
  width = 0;
  height = 0;
  readonly style: Record<string, string> = {};
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  readonly attrs = new Map<string, string>();
  readonly listeners = new Map<string, Handler[]>();
  ownerDocument: FakeDoc;
  ctx: FakeCtx | null = null;

  constructor(tagName: string, doc: FakeDoc) {
    this.tagName = tagName;
    this.ownerDocument = doc;
    if (tagName === "canvas") this.ctx = new FakeCtx();
  }

  getContext(kind: string): FakeCtx | null {
    return kind === "2d" ? this.ctx : null;
  }

  /** 和真 DOM 一样:写 textContent 会把原来的子节点全部摘掉 */
  get textContent(): string {
    return this.text;
  }

  set textContent(value: string) {
    for (const kid of [...this.children]) kid.parent = null;
    this.children = [];
    this.text = value;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attrs.has(name) ? (this.attrs.get(name) as string) : null;
  }

  appendChild(child: FakeEl): FakeEl {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...kids: FakeEl[]): void {
    for (const kid of kids) this.appendChild(kid);
  }

  removeChild(child: FakeEl): void {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parent = null;
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  /** 面板的焦点陷阱只查这一条选择器 */
  querySelectorAll(selector: string): FakeEl[] {
    const out: FakeEl[] = [];
    if (selector !== "button:not([disabled])") return out;
    walk(this, (el) => {
      if (el.tagName === "button" && !el.disabled) out.push(el);
    });
    return out;
  }

  addEventListener(type: string, fn: Handler): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, fn: Handler): void {
    const list = this.listeners.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  fire(type: string, extra: Partial<FakeEvent> = {}, target: unknown = this): void {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn(makeEvent(target, extra));
  }
}

class FakeDoc {
  readonly body: FakeEl;
  readonly head: FakeEl;
  activeElement: FakeEl | null = null;
  readonly listeners = new Map<string, Handler[]>();

  constructor() {
    this.body = new FakeEl("body", this);
    this.head = new FakeEl("head", this);
  }

  createElement(tag: string): FakeEl {
    return new FakeEl(tag, this);
  }

  getElementById(id: string): FakeEl | null {
    let hit: FakeEl | null = null;
    for (const root of [this.head, this.body]) {
      walk(root, (el) => {
        if (!hit && el.id === id) hit = el;
      });
    }
    return hit;
  }

  addEventListener(type: string, fn: Handler): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, fn: Handler): void {
    const list = this.listeners.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  keydownCount(): number {
    return (this.listeners.get("keydown") ?? []).length;
  }

  press(key: string, extra: Partial<FakeEvent> = {}): FakeEvent {
    const e = makeEvent(this.activeElement, { key, ...extra });
    for (const fn of [...(this.listeners.get("keydown") ?? [])]) fn(e);
    return e;
  }
}

function walk(root: FakeEl, visit: (el: FakeEl) => void): void {
  visit(root);
  for (const kid of [...root.children]) walk(kid, visit);
}

function findAll(root: FakeEl, className: string): FakeEl[] {
  const out: FakeEl[] = [];
  walk(root, (el) => {
    if (el.className.split(/\s+/).includes(className)) out.push(el);
  });
  return out;
}

function findOne(root: FakeEl, className: string): FakeEl | null {
  return findAll(root, className)[0] ?? null;
}

function textOf(root: FakeEl): string {
  let out = "";
  walk(root, (el) => {
    out += el.textContent;
  });
  return out;
}

/** 找某张卡片(按收藏品 id) */
function cardOf(root: FakeEl, itemId: string): FakeEl | null {
  return findAll(root, "collection-card").find((c) => c.getAttribute("data-item") === itemId) ?? null;
}

/** 卡片上按钮文字里含某几个字的那一个 */
function buttonWith(card: FakeEl, text: string): FakeEl | null {
  return findAll(card, "card-btn").find((b) => b.textContent.includes(text)) ?? null;
}

// ---------------------------------------------------------------------------
// 假钱包 / 假存储 / 开面板
// ---------------------------------------------------------------------------

function makeWallet(start: number): Wallet & { balance: number } {
  return {
    balance: Math.max(0, Math.round(start)),
    getStars() {
      return this.balance;
    },
    addStars(n: number) {
      this.balance = Math.max(0, Math.round(this.balance + n));
      return this.balance;
    }
  };
}

function makeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    keys: () => [...map.keys()]
  };
}

function open(stars = 1000, scope?: string) {
  const doc = new FakeDoc();
  const wallet = makeWallet(stars);
  const store = new CollectionStore(wallet, makeStorage());
  // 数一数面板订阅了几次收藏变化,关掉之后必须归零
  let subs = 0;
  const origOnChange = store.onChange.bind(store);
  store.onChange = (fn: () => void) => {
    subs += 1;
    const off = origOnChange(fn);
    return () => {
      subs -= 1;
      off();
    };
  };
  const handle = openCollection(scope, {
    doc: doc as unknown as Document,
    store
  });
  const panel = handle.el as unknown as FakeEl;
  return { doc, wallet, store, handle, panel, subs: () => subs };
}

afterEach(() => {
  closeCollection();
});

// ---------------------------------------------------------------------------
// 1. 文案(纯函数)
// ---------------------------------------------------------------------------

describe("收藏面板文案", () => {
  it("不带 scope 时说这一身到处通用", () => {
    expect(scopeNote()).toContain("所有游戏");
    expect(scopeNote("   ")).toContain("所有游戏");
  });

  it("认得的 scope 写出游戏名,认不出的就原样带上", () => {
    expect(scopeNote("rainbow-run")).toContain("彩虹跑跑");
    expect(scopeNote("some-new-game")).toContain("some-new-game");
  });

  it("星星余额与等级都写成人话", () => {
    expect(starsLabel(128)).toBe("⭐ 128");
    expect(starsLabel(-5)).toBe("⭐ 0");
    expect(starsLabel(Number.NaN)).toBe("⭐ 0");
    expect(levelLabel(0)).toBe("还没解锁");
    expect(levelLabel(2)).toBe(`Lv.2 / ${MAX_LEVEL}`);
    expect(levelLabel(99)).toBe(`Lv.${MAX_LEVEL} / ${MAX_LEVEL}`);
  });

  it("三个页签齐全,装备卡才标部位", () => {
    expect(TABS.map((t) => t.kind)).toEqual(["hero", "pet", "gear"]);
    expect(slotTag(itemById("shoes-cloud")!)).toBe("鞋");
    expect(slotTag(itemById("duoduo")!)).toBe("");
  });
});

describe("卡片状态", () => {
  const gear = itemById("cape-star")!;

  it("没解锁又买不起时按钮点不动,并写出还差多少星", () => {
    const s = cardStatus(gear, 0, 0, false);
    expect(s.state).toBe("locked-poor");
    expect(s.disabled).toBe(true);
    expect(s.action).toBe(`解锁 ⭐${unlockCost(gear)}`);
    expect(s.aria).toContain(`还差 ${unlockCost(gear)} 颗星星`);
  });

  it("星星刚好够时按钮就亮了", () => {
    const s = cardStatus(gear, 0, unlockCost(gear), false);
    expect(s.state).toBe("locked-ready");
    expect(s.disabled).toBe(false);
    expect(s.badge).toBe(`需要 ${unlockCost(gear)} 颗星`);
  });

  it("解锁之后主按钮变成升级,价钱跟着等级涨", () => {
    const s1 = cardStatus(gear, 1, 9999, false);
    const s2 = cardStatus(gear, 2, 9999, false);
    expect(s1.state).toBe("owned");
    expect(s1.action).toBe(`升级 ⭐${upgradeCost(gear, 1)}`);
    expect(s2.action).toBe(`升级 ⭐${upgradeCost(gear, 2)}`);
    expect(cardStatus(gear, 1, 0, false).disabled).toBe(true);
  });

  it("满级并且穿在身上时不再给主按钮", () => {
    const worn = cardStatus(gear, MAX_LEVEL, 9999, true);
    expect(worn.state).toBe("equipped");
    expect(worn.action).toBeNull();
    expect(worn.badge).toContain("满级");
    const spare = cardStatus(gear, MAX_LEVEL, 9999, false);
    expect(spare.state).toBe("max");
    expect(spare.action).toBe("试穿");
  });

  it("等级或余额是脏数据时按 0 处理,不会算出负数", () => {
    const s = cardStatus(gear, Number.NaN, Number.NaN, false);
    expect(s.state).toBe("locked-poor");
    expect(s.aria).toContain(`还差 ${unlockCost(gear)} 颗星星`);
  });
});

// ---------------------------------------------------------------------------
// 2. 试穿预览(纯函数 + Canvas)
// ---------------------------------------------------------------------------

describe("试穿预览", () => {
  function loadoutOf(heroId: string, petId: string | null, gearIds: string[]): Loadout {
    const hero = itemById(heroId)!;
    const pet = petId ? itemById(petId) : null;
    const gear = gearIds.map((id) => itemById(id)!);
    const levels: Record<string, number> = {};
    for (const it of [hero, pet, ...gear]) if (it) levels[it.id] = 1;
    return { hero, pet, gear, levels };
  }

  it("这一身列出人物、宠物和每一件装备", () => {
    const line = outfitLine(loadoutOf("yunyun", "jiujiu", ["shoes-cloud", "hat-straw"]));
    expect(line).toContain("云云");
    expect(line).toContain("啾啾(宠物)");
    expect(line).toContain("云朵跑鞋");
    expect(line).toContain("草编凉帽");
    expect(outfitLine(loadoutOf("duoduo", null, []))).toBe("朵朵");
  });

  it("加成清单没有加成时也有一句兜底", () => {
    const zero: Bonus = { speed: 0, jump: 0, magnet: 0, coin: 0, luck: 0 };
    expect(bonusLines(zero)).toEqual(["还没有加成,先挑一件试试看"]);
    expect(bonusLines({ ...zero, speed: 66, coin: 240 })).toEqual([
      "速度 +6.6%",
      "金币收益 +24%"
    ]);
  });

  it("配色跟着人物与装备走,没穿的部位就是空", () => {
    const palette = figurePalette(loadoutOf("shanshan", "lvludou", ["cape-leaf"]));
    expect(palette.body).toBe(itemById("shanshan")!.color);
    expect(palette.cape).toBe(itemById("cape-leaf")!.color);
    expect(palette.pet).toBe(itemById("lvludou")!.color);
    expect(palette.hat).toBeNull();
    expect(palette.shoes).toBeNull();
  });

  it("读屏软件听得到试穿了什么", () => {
    const alt = figureAlt(loadoutOf("nuonuo", "dingding", ["goggles-rainbow"]));
    expect(alt).toContain("糯糯");
    expect(alt).toContain("护目镜是彩虹护目镜");
    expect(alt).toContain("叮叮跟在旁边");
    expect(figureAlt(loadoutOf("duoduo", null, []))).toContain("还没换装备");
  });

  it("小人是现画的:清屏之后真的落了笔,而且不用任何外部图片", () => {
    const ctx = new FakeCtx();
    drawFigure(ctx, 200, 230, figurePalette(loadoutOf("yunyun", "jiujiu", ["hat-crown"])));
    expect(ctx.calls[0]).toBe("clearRect");
    expect(ctx.calls.filter((c) => c.startsWith("fill:")).length).toBeGreaterThan(6);
    expect(ctx.calls).toContain("arc");
  });

  it("窄屏的小预览与宽屏的大预览都画得出来", () => {
    const palette = figurePalette(loadoutOf("duoduo", null, []));
    for (const [w, h] of [
      [104, 124],
      [200, 230],
      [8, 8]
    ]) {
      const ctx = new FakeCtx();
      expect(() => drawFigure(ctx, w, h, palette)).not.toThrow();
      expect(ctx.calls.length).toBeGreaterThan(3);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. 面板开合
// ---------------------------------------------------------------------------

describe("面板结构", () => {
  it("打开后挂在 body 上,标题、余额、三个页签都在", () => {
    const { doc, panel } = open(320, "rainbow-run");
    expect(findOne(doc.body, "collection-overlay")).not.toBeNull();
    expect(findOne(panel, "collection-title")?.textContent).toBe(PANEL_TITLE);
    expect(findOne(panel, "collection-stars")?.textContent).toBe("⭐ 320");
    expect(findAll(panel, "collection-tab").map((t) => t.textContent)).toEqual([
      "人物",
      "宠物",
      "装备"
    ]);
    expect(findOne(panel, "collection-note")?.textContent).toContain("彩虹跑跑");
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-modal")).toBe("true");
  });

  it("默认停在人物页,卡片数量和图鉴对得上", () => {
    const { panel } = open();
    expect(findAll(panel, "collection-card").length).toBe(HEROES.length);
    expect(cardOf(panel, "duoduo")).not.toBeNull();
    expect(cardOf(panel, "lvludou")).toBeNull();
  });

  it("切页签换成宠物和装备", () => {
    const { panel } = open();
    findAll(panel, "collection-tab")[1].fire("click");
    expect(findAll(panel, "collection-card").length).toBe(PETS.length);
    expect(cardOf(panel, "jiujiu")).not.toBeNull();
    findAll(panel, "collection-tab")[2].fire("click");
    expect(findAll(panel, "collection-card").length).toBe(GEARS.length);
    expect(cardOf(panel, "shoes-cloud")).not.toBeNull();
  });

  it("已解锁与未解锁的卡片一眼分得出来", () => {
    const { panel } = open(0);
    expect(cardOf(panel, "duoduo")?.className).not.toContain("collection-card--locked");
    expect(cardOf(panel, "duoduo")?.className).toContain("collection-card--equipped");
    const locked = cardOf(panel, "shanshan")!;
    expect(locked.className).toContain("collection-card--locked");
    expect(textOf(locked)).toContain(`需要 ${unlockCost(itemById("shanshan")!)} 颗星`);
  });
});

describe("面板里的解锁与试穿", () => {
  it("点解锁会扣星、自动穿上,余额和卡片一起刷新", () => {
    const cost = unlockCost(itemById("shanshan")!);
    const { panel, wallet, store } = open(cost + 5);
    buttonWith(cardOf(panel, "shanshan")!, "解锁")!.fire("click");
    expect(wallet.balance).toBe(5);
    expect(store.getLevel("shanshan")).toBe(1);
    expect(store.equippedId("hero")).toBe("shanshan");
    expect(findOne(panel, "collection-stars")?.textContent).toBe("⭐ 5");
    expect(cardOf(panel, "shanshan")?.className).toContain("collection-card--equipped");
    expect(findOne(panel, "collection-outfit")?.textContent).toContain("闪闪");
  });

  it("星星不够时解锁按钮是禁用的,点了也不扣星", () => {
    const { panel, wallet, store } = open(1);
    const btn = buttonWith(cardOf(panel, "dundun")!, "解锁")!;
    expect(btn.disabled).toBe(true);
    btn.fire("click");
    expect(wallet.balance).toBe(1);
    expect(store.isUnlocked("dundun")).toBe(false);
  });

  it("解锁过的可以升级,升到满级后主按钮消失", () => {
    const { panel, store } = open(9999);
    for (let lv = 1; lv < MAX_LEVEL; lv++) {
      buttonWith(cardOf(panel, "duoduo")!, "升级")!.fire("click");
    }
    expect(store.getLevel("duoduo")).toBe(MAX_LEVEL);
    expect(buttonWith(cardOf(panel, "duoduo")!, "升级")).toBeNull();
    expect(textOf(cardOf(panel, "duoduo")!)).toContain("满级");
  });

  it("试穿换人,预览文字跟着变", () => {
    const { panel, store } = open(9999);
    buttonWith(cardOf(panel, "yunyun")!, "解锁")!.fire("click");
    buttonWith(cardOf(panel, "duoduo")!, "试穿")!.fire("click");
    expect(store.equippedId("hero")).toBe("duoduo");
    expect(findOne(panel, "collection-outfit")?.textContent).toContain("朵朵");
  });

  it("宠物可以换下来,人物卡上没有换下按钮", () => {
    const { panel, store } = open(9999);
    findAll(panel, "collection-tab")[1].fire("click");
    buttonWith(cardOf(panel, "jiujiu")!, "解锁")!.fire("click");
    expect(store.equippedId("pet")).toBe("jiujiu");
    buttonWith(cardOf(panel, "jiujiu")!, "换下")!.fire("click");
    expect(store.equippedId("pet")).toBeNull();
    findAll(panel, "collection-tab")[0].fire("click");
    expect(buttonWith(cardOf(panel, "duoduo")!, "换下")).toBeNull();
  });

  it("解锁一件装备之后加成清单里就有数了", () => {
    const { panel, store } = open(9999);
    findAll(panel, "collection-tab")[2].fire("click");
    buttonWith(cardOf(panel, "goggles-rainbow")!, "解锁")!.fire("click");
    expect(store.bonus().magnet).toBeGreaterThan(0);
    expect(textOf(findOne(panel, "collection-bonus")!)).toContain("吸金范围");
  });

  it("解锁结果会写进播报区,读屏软件听得到", () => {
    const { panel } = open(9999);
    buttonWith(cardOf(panel, "nuonuo")!, "解锁")!.fire("click");
    const live = findOne(panel, "collection-live")!;
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toContain("糯糯解锁啦");
  });
});

describe("关闭与监听清理", () => {
  it("Esc 关掉面板,keydown 监听一条不剩", () => {
    const { doc, handle, subs } = open();
    expect(doc.keydownCount()).toBe(1);
    expect(isCollectionOpen()).toBe(true);
    const e = doc.press("Escape");
    expect(e.defaultPrevented).toBe(true);
    expect(findOne(doc.body, "collection-overlay")).toBeNull();
    expect(doc.keydownCount()).toBe(0);
    expect(subs()).toBe(0);
    expect(isCollectionOpen()).toBe(false);
    // 关过之后再关一次也不出错
    expect(() => handle.close()).not.toThrow();
    expect(doc.keydownCount()).toBe(0);
  });

  it("关闭按钮、知道啦、点遮罩都能关,而且都清干净", () => {
    for (const cls of ["collection-close", "collection-done"]) {
      const { doc, panel, subs } = open();
      findOne(panel, cls)!.fire("click");
      expect(findOne(doc.body, "collection-overlay")).toBeNull();
      expect(doc.keydownCount()).toBe(0);
      expect(subs()).toBe(0);
    }
    const { doc, subs } = open();
    const overlay = findOne(doc.body, "collection-overlay")!;
    overlay.fire("click", {}, overlay);
    expect(findOne(doc.body, "collection-overlay")).toBeNull();
    expect(subs()).toBe(0);
  });

  it("点在卡片上不会误关面板", () => {
    const { doc, panel } = open();
    const overlay = findOne(doc.body, "collection-overlay")!;
    overlay.fire("click", {}, findOne(panel, "collection-card"));
    expect(findOne(doc.body, "collection-overlay")).not.toBeNull();
  });

  it("destroy 就是 close 的别名", () => {
    const { doc, handle, subs } = open();
    handle.destroy();
    expect(findOne(doc.body, "collection-overlay")).toBeNull();
    expect(doc.keydownCount()).toBe(0);
    expect(subs()).toBe(0);
  });

  it("关掉之后星星变化不再回写面板,订阅确实断了", () => {
    const { doc, store, handle, subs } = open(9999);
    handle.close();
    expect(subs()).toBe(0);
    expect(() => store.unlock("shanshan")).not.toThrow();
    expect(findOne(doc.body, "collection-overlay")).toBeNull();
  });

  it("重复点开只留一个面板,旧的那个连监听一起收走", () => {
    const first = open();
    const second = open();
    expect(first.doc.keydownCount()).toBe(0);
    expect(first.subs()).toBe(0);
    expect(second.doc.keydownCount()).toBe(1);
    closeCollection();
    expect(second.doc.keydownCount()).toBe(0);
    expect(isCollectionOpen()).toBe(false);
  });
});

describe("键盘可达", () => {
  it("Tab 只在面板里的按钮之间打转", () => {
    const { doc, panel } = open();
    const buttons = panel.querySelectorAll("button:not([disabled])");
    expect(buttons.length).toBeGreaterThan(3);
    expect(doc.activeElement).toBe(findOne(panel, "collection-close"));
    const e = doc.press("Tab");
    expect(e.defaultPrevented).toBe(true);
    expect(buttons).toContain(doc.activeElement as FakeEl);
    doc.press("Tab", { shiftKey: true });
    expect(buttons).toContain(doc.activeElement as FakeEl);
  });

  it("面板里的按钮都能被键盘摸到(禁用的除外)", () => {
    const { panel } = open(0);
    const enabled = panel.querySelectorAll("button:not([disabled])");
    const disabled = findAll(panel, "card-btn").filter((b) => b.disabled);
    expect(disabled.length).toBeGreaterThan(0);
    for (const btn of disabled) expect(enabled).not.toContain(btn);
  });
});

describe("样式自带,不动公共 styles.css", () => {
  it("样式只注入一次,而且带窄屏断点", () => {
    const { doc } = open();
    const styles = findAll(doc.head, "").filter((el) => el.tagName === "style");
    expect(styles.length).toBe(1);
    expect(styles[0].textContent).toContain("@media (max-width:640px)");
    expect(styles[0].textContent).toContain(".collection-panel");
    closeCollection();
    openCollection(undefined, {
      doc: doc as unknown as Document,
      store: new CollectionStore(makeWallet(0), makeStorage())
    });
    expect(findAll(doc.head, "").filter((el) => el.tagName === "style").length).toBe(1);
  });

  it("样式里没有任何外部图片引用", () => {
    const { doc } = open();
    const css = findAll(doc.head, "").find((el) => el.tagName === "style")!.textContent;
    expect(css).not.toContain("url(");
    expect(css).not.toContain(".png");
    expect(css).not.toContain(".svg");
  });
});
