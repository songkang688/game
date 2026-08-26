import { afterEach, describe, expect, it, vi } from "vitest";
import type { GuideBook } from "./level188Contract";
import {
  getLevelExtras,
  registerLevelExtras,
  resetLevelExtras
} from "./level188Contract";
import {
  GUIDE_NO_ENTRY_NOTE,
  currentLevelFromSave,
  distanceTo,
  hasGuideModule,
  isAnswerLeak,
  isGuideBook,
  isGuideEntry,
  loadGuideBook,
  matchEntries,
  mountGuide,
  nearestEntry,
  pickGuideBook,
  prefersSheetLayout,
  readCurrentLevel,
  selectGuide,
  sortedEntries,
  stripAnswerLeaks
} from "./guide";

// ---------------------------------------------------------------------------
// 极简 DOM 桩:仓库的 vitest 跑在 node 环境(无 jsdom),
// 这里只实现攻略抽屉真正用到的那几个 DOM 能力,不引入任何外部依赖。
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

class FakeEl {
  tagName: string;
  className = "";
  textContent = "";
  type = "";
  disabled = false;
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  readonly attrs = new Map<string, string>();
  readonly listeners = new Map<string, Handler[]>();
  ownerDocument: FakeDoc;

  constructor(tagName: string, doc: FakeDoc) {
    this.tagName = tagName;
    this.ownerDocument = doc;
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
  activeElement: FakeEl | null = null;
  readonly listeners = new Map<string, Handler[]>();

  constructor() {
    this.body = new FakeEl("body", this);
  }

  createElement(tag: string): FakeEl {
    return new FakeEl(tag, this);
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
  for (const kid of root.children) walk(kid, visit);
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

const BOOK: GuideBook = {
  gameId: "math-farm",
  title: "算数小农场",
  general: [
    "读完题先在心里说一遍要求什么,别急着按。",
    "算完再倒着检查一遍,比重算一次省时间。"
  ],
  entries: [
    { from: 1, to: 30, title: "萌芽田", tips: ["先凑十再加剩下的部分。"] },
    { from: 31, to: 60, title: "风车坡", tips: ["竖式对齐个位再算。", "估一估结果大概多大。"] },
    { from: 100, to: 140, title: "云端仓库", tips: ["两位数乘法拆成整十加零头。"] }
  ]
};

function mount(level: number, book: GuideBook = BOOK): {
  doc: FakeDoc;
  host: FakeEl;
  cleanup: () => void;
} {
  const doc = new FakeDoc();
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const cleanup = mountGuide(
    host as unknown as HTMLElement,
    book,
    () => level
  );
  return { doc, host, cleanup };
}

function openDrawer(doc: FakeDoc, host: FakeEl): FakeEl {
  const btn = findOne(host, "guide-btn");
  expect(btn).not.toBeNull();
  (btn as FakeEl).fire("click");
  const overlay = findOne(doc.body, "guide-overlay");
  expect(overlay).not.toBeNull();
  return overlay as FakeEl;
}

afterEach(() => {
  resetLevelExtras();
  delete (globalThis as { matchMedia?: unknown }).matchMedia;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe("攻略条目按当前关命中", () => {
  it("命中当前关所在的区间", () => {
    const sel = selectGuide(BOOK, 45);
    expect(sel.fallback).toBe(false);
    expect(sel.entries.map((e) => e.title)).toEqual(["风车坡"]);
  });

  it("区间包含两端(from 与 to 都算命中)", () => {
    expect(matchEntries(BOOK.entries, 31).map((e) => e.title)).toEqual(["风车坡"]);
    expect(matchEntries(BOOK.entries, 60).map((e) => e.title)).toEqual(["风车坡"]);
    expect(matchEntries(BOOK.entries, 61)).toEqual([]);
  });

  it("多条区间重叠时全部命中,并按起点排序", () => {
    const overlapped: GuideBook = {
      ...BOOK,
      entries: [
        { from: 50, to: 70, title: "后写的一章", tips: ["b"] },
        { from: 1, to: 99, title: "先写的一章", tips: ["a"] }
      ]
    };
    const sel = selectGuide(overlapped, 55);
    expect(sel.fallback).toBe(false);
    expect(sel.entries.map((e) => e.title)).toEqual(["先写的一章", "后写的一章"]);
  });

  it("sortedEntries 不改原数组,并丢掉形状不对的条目", () => {
    const raw = [
      { from: 10, to: 20, title: "后", tips: ["x"] },
      { from: 1, to: 5, title: "前", tips: ["y"] },
      { from: 3, to: 1, title: "区间反了", tips: ["z"] }
    ];
    const snapshot = JSON.stringify(raw);
    expect(sortedEntries(raw).map((e) => e.title)).toEqual(["前", "后"]);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });

  it("distanceTo:区间内为 0,区间外按最近端点算距离", () => {
    const entry = BOOK.entries[1];
    expect(distanceTo(entry, 45)).toBe(0);
    expect(distanceTo(entry, 25)).toBe(6);
    expect(distanceTo(entry, 70)).toBe(10);
  });
});

describe("命中不到时的兜底", () => {
  it("落在两章之间取最近的一条", () => {
    const sel = selectGuide(BOOK, 62);
    expect(sel.fallback).toBe(true);
    expect(sel.entries.map((e) => e.title)).toEqual(["风车坡"]);
  });

  it("距离并列时取靠前的那一章", () => {
    // 80 距「风车坡(…60)」20 关,距「云端仓库(100…)」也是 20 关
    expect(nearestEntry(BOOK.entries, 80)?.title).toBe("风车坡");
  });

  it("关号超出全部章节时取最后一条", () => {
    const sel = selectGuide(BOOK, 188);
    expect(sel.fallback).toBe(true);
    expect(sel.entries.map((e) => e.title)).toEqual(["云端仓库"]);
  });

  it("一条细则都没写时兜底为空,但通用思路还在", () => {
    const empty: GuideBook = { ...BOOK, entries: [] };
    const sel = selectGuide(empty, 5);
    expect(sel.fallback).toBe(true);
    expect(sel.entries).toEqual([]);
    expect(sel.general.length).toBe(2);
    expect(nearestEntry([], 5)).toBeNull();
  });
});

describe("攻略只讲方法不给答案", () => {
  it("写出现成答案的句子会被认出来", () => {
    expect(isAnswerLeak("答案是 36")).toBe(true);
    expect(isAnswerLeak("正确答案:小时针指向 3")).toBe(true);
    expect(isAnswerLeak("12 × 3 = 36")).toBe(true);
    expect(isAnswerLeak("答:一共 15 只")).toBe(true);
    expect(isAnswerLeak("正确选项在第二行")).toBe(true);
  });

  it("只讲思路的句子会被保留", () => {
    expect(isAnswerLeak("先算乘除,再算加减,括号最优先。")).toBe(false);
    expect(isAnswerLeak("把两位数拆成整十加零头,分两步乘。")).toBe(false);
    expect(isAnswerLeak("拼音先看声母再看韵母,最后标声调。")).toBe(false);
  });

  it("渲染前会把泄题的条目过滤掉,空白条目也一起去掉", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(stripAnswerLeaks(["先估个大概。", "  ", "答案是 42"])).toEqual(["先估个大概。"]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("selectGuide 的通用思路同样过滤答案", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const leaky: GuideBook = { ...BOOK, general: ["动笔前先读题。", "答案是 7"] };
    expect(selectGuide(leaky, 10).general).toEqual(["动笔前先读题。"]);
  });
});

describe("攻略数据校验与加载", () => {
  it("isGuideEntry 认得合法条目,拒绝残缺条目", () => {
    expect(isGuideEntry({ from: 1, to: 2, title: "章", tips: ["a"] })).toBe(true);
    expect(isGuideEntry({ from: 1, to: 2, title: "章" })).toBe(false);
    expect(isGuideEntry({ from: "1", to: 2, title: "章", tips: [] })).toBe(false);
    expect(isGuideEntry(null)).toBe(false);
  });

  it("isGuideBook 校验整本攻略的形状", () => {
    expect(isGuideBook(BOOK)).toBe(true);
    expect(isGuideBook({ ...BOOK, general: "一句话" })).toBe(false);
    expect(isGuideBook({ ...BOOK, entries: [{ from: 1 }] })).toBe(false);
    expect(isGuideBook(undefined)).toBe(false);
  });

  it("pickGuideBook 支持 guide / default 两种导出写法", () => {
    expect(pickGuideBook({ guide: BOOK })).toBe(BOOK);
    expect(pickGuideBook({ default: BOOK })).toBe(BOOK);
    expect(pickGuideBook({ whatever: BOOK })).toBeNull();
    expect(pickGuideBook(null)).toBeNull();
  });

  it("没有攻略模块的游戏静默返回 null(壳层据此不显示攻略按钮)", async () => {
    expect(hasGuideModule("这个游戏并不存在")).toBe(false);
    await expect(loadGuideBook("这个游戏并不存在")).resolves.toBeNull();
  });
});

describe("当前关推断(只读存档,不写)", () => {
  it("没有存档时当作第 1 关", () => {
    expect(currentLevelFromSave(null)).toBe(1);
    expect(currentLevelFromSave("")).toBe(1);
    expect(currentLevelFromSave("[]")).toBe(1);
  });

  it("前几关有星时当前关是第一个没过的关", () => {
    expect(currentLevelFromSave(JSON.stringify([3, 2, 1, 0, 0]))).toBe(4);
    expect(currentLevelFromSave(JSON.stringify([0, 0, 0]))).toBe(1);
  });

  it("全部通关时停在最后一关", () => {
    expect(currentLevelFromSave(JSON.stringify([1, 2, 3]))).toBe(3);
  });

  it("存档坏掉也不抛异常,降级为第 1 关", () => {
    expect(currentLevelFromSave("{不是 JSON")).toBe(1);
    expect(currentLevelFromSave('{"a":1}')).toBe(1);
    expect(currentLevelFromSave(JSON.stringify([3, "坏", 2]))).toBe(2);
  });

  it("readCurrentLevel 只读 yiduo-yixing.l99.<id>,一个字都不写回", () => {
    const reads: string[] = [];
    const storage = {
      getItem(key: string): string | null {
        reads.push(key);
        return key === "yiduo-yixing.l99.math-farm" ? JSON.stringify([3, 3, 0]) : null;
      }
    };
    expect(readCurrentLevel("math-farm", storage)).toBe(3);
    expect(reads).toEqual(["yiduo-yixing.l99.math-farm"]);
    expect(Object.keys(storage)).toEqual(["getItem"]);
  });

  it("读存档抛异常时降级为第 1 关", () => {
    const storage = {
      getItem(): string | null {
        throw new Error("隐私模式");
      }
    };
    expect(readCurrentLevel("math-farm", storage)).toBe(1);
    expect(readCurrentLevel("math-farm", null)).toBe(1);
  });
});

describe("攻略抽屉 UI", () => {
  it("在 host 里挂出「📖 攻略」按钮", () => {
    const { host, cleanup } = mount(45);
    const btn = findOne(host, "guide-btn");
    expect(btn?.textContent).toBe("📖 攻略");
    expect(btn?.type).toBe("button");
    expect(btn?.getAttribute("aria-expanded")).toBe("false");
    expect(btn?.getAttribute("aria-haspopup")).toBe("dialog");
    cleanup();
  });

  it("点按钮打开抽屉:role=dialog + aria-modal", () => {
    const { doc, host, cleanup } = mount(45);
    const overlay = openDrawer(doc, host);
    const panel = findOne(overlay, "guide-drawer");
    expect(panel?.getAttribute("role")).toBe("dialog");
    expect(panel?.getAttribute("aria-modal")).toBe("true");
    expect(findOne(host, "guide-btn")?.getAttribute("aria-expanded")).toBe("true");
    cleanup();
  });

  it("抽屉里同时有通用思路和命中当前关的细则", () => {
    const { doc, host, cleanup } = mount(45);
    const overlay = openDrawer(doc, host);
    const text = textOf(overlay);
    expect(text).toContain("通用思路");
    expect(text).toContain("读完题先在心里说一遍要求什么");
    expect(text).toContain("风车坡");
    expect(text).toContain("竖式对齐个位再算。");
    expect(text).toContain("第 45 关");
    expect(text).not.toContain("萌芽田");
    expect(findAll(overlay, "guide-tip").length).toBe(4);
    cleanup();
  });

  it("命中不到时显示最近一条并注明「这一章还没写细则」", () => {
    const { doc, host, cleanup } = mount(62);
    const overlay = openDrawer(doc, host);
    const note = findOne(overlay, "guide-note");
    expect(note?.textContent).toContain(GUIDE_NO_ENTRY_NOTE);
    expect(textOf(overlay)).toContain("风车坡");
    cleanup();
  });

  it("窄屏改成底部半屏抽屉", () => {
    (globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: true });
    expect(prefersSheetLayout()).toBe(true);
    const { doc, host, cleanup } = mount(45);
    const overlay = openDrawer(doc, host);
    expect(findOne(overlay, "guide-drawer")?.className).toContain("guide-drawer--sheet");
    cleanup();
  });

  it("没有 matchMedia 的环境按宽屏右侧抽屉处理", () => {
    expect(prefersSheetLayout()).toBe(false);
    const { doc, host, cleanup } = mount(45);
    const overlay = openDrawer(doc, host);
    expect(findOne(overlay, "guide-drawer")?.className).not.toContain("guide-drawer--sheet");
    cleanup();
  });

  it("Esc 关闭抽屉", () => {
    const { doc, host, cleanup } = mount(45);
    openDrawer(doc, host);
    const e = doc.press("Escape");
    expect(e.defaultPrevented).toBe(true);
    expect(findOne(doc.body, "guide-overlay")).toBeNull();
    expect(findOne(host, "guide-btn")?.getAttribute("aria-expanded")).toBe("false");
    cleanup();
  });

  it("关闭后焦点回到攻略按钮", () => {
    const { doc, host, cleanup } = mount(45);
    const overlay = openDrawer(doc, host);
    expect(doc.activeElement).toBe(findOne(overlay, "guide-close"));
    doc.press("Escape");
    expect(doc.activeElement).toBe(findOne(host, "guide-btn"));
    cleanup();
  });

  it("焦点陷阱:Tab 只在抽屉内的按钮之间打转", () => {
    const { doc, host, cleanup } = mount(45);
    const overlay = openDrawer(doc, host);
    const closeBtn = findOne(overlay, "guide-close");
    const doneBtn = findOne(overlay, "guide-done");
    expect(doc.activeElement).toBe(closeBtn);
    expect(doc.press("Tab").defaultPrevented).toBe(true);
    expect(doc.activeElement).toBe(doneBtn);
    doc.press("Tab");
    expect(doc.activeElement).toBe(closeBtn);
    doc.press("Tab", { shiftKey: true });
    expect(doc.activeElement).toBe(doneBtn);
    cleanup();
  });

  it("「知道啦」与遮罩都能关掉抽屉,点抽屉内容不关", () => {
    const { doc, host, cleanup } = mount(45);
    const overlay = openDrawer(doc, host);
    const panel = findOne(overlay, "guide-drawer") as FakeEl;
    overlay.fire("click", {}, panel);
    expect(findOne(doc.body, "guide-overlay")).not.toBeNull();
    overlay.fire("click", {}, overlay);
    expect(findOne(doc.body, "guide-overlay")).toBeNull();

    const again = openDrawer(doc, host);
    (findOne(again, "guide-done") as FakeEl).fire("click");
    expect(findOne(doc.body, "guide-overlay")).toBeNull();
    cleanup();
  });

  it("再点一次攻略按钮就收起抽屉", () => {
    const { doc, host, cleanup } = mount(45);
    openDrawer(doc, host);
    (findOne(host, "guide-btn") as FakeEl).fire("click");
    expect(findOne(doc.body, "guide-overlay")).toBeNull();
    cleanup();
  });

  it("每次打开都按当时的关号取内容", () => {
    const doc = new FakeDoc();
    const host = doc.createElement("div");
    doc.body.appendChild(host);
    let level = 20;
    const cleanup = mountGuide(host as unknown as HTMLElement, BOOK, () => level);
    expect(textOf(openDrawer(doc, host))).toContain("萌芽田");
    doc.press("Escape");
    level = 120;
    expect(textOf(openDrawer(doc, host))).toContain("云端仓库");
    cleanup();
  });

  it("getLevel 抛异常或给了非法关号时退回第 1 关", () => {
    const doc = new FakeDoc();
    const host = doc.createElement("div");
    doc.body.appendChild(host);
    const cleanup = mountGuide(host as unknown as HTMLElement, BOOK, () => {
      throw new Error("还没开始玩");
    });
    expect(textOf(openDrawer(doc, host))).toContain("萌芽田");
    cleanup();
  });

  it("清理函数收走按钮、抽屉与全局键盘监听", () => {
    const { doc, host, cleanup } = mount(45);
    openDrawer(doc, host);
    expect(doc.keydownCount()).toBe(1);
    cleanup();
    expect(findOne(host, "guide-btn")).toBeNull();
    expect(findOne(doc.body, "guide-overlay")).toBeNull();
    expect(doc.keydownCount()).toBe(0);
    expect(host.children.length).toBe(0);
  });
});

describe("契约注册表", () => {
  it("没注册时取不到 mountGuide,框架据此隐藏攻略入口", () => {
    resetLevelExtras();
    expect(getLevelExtras().mountGuide).toBeUndefined();
    expect(getLevelExtras().requestSkip).toBeUndefined();
  });

  it("注册之后框架就能拿到攻略实现,且注册是合并而不是覆盖", () => {
    resetLevelExtras();
    registerLevelExtras({ mountGuide });
    registerLevelExtras({ requestSkip: async () => false });
    expect(getLevelExtras().mountGuide).toBe(mountGuide);
    expect(typeof getLevelExtras().requestSkip).toBe("function");
  });
});
