import { beforeEach, describe, expect, it } from "vitest";
import {
  ROOT_PERMANENT_NOTE,
  ROOT_UNLOCK_CLASS,
  applyRootUnlock,
  parseLevelFromLabel,
  rootUnlockAria,
  rootUnlockNodeHTML,
  stripLockMark,
  type LockedNodeLike,
  type UnlockHostLike
} from "./rootUnlock";
import { clearRootSession, openRootSession, resetRoot12Extras } from "./root12Contract";

// ---------------------------------------------------------------------------
// 假 DOM:node 环境里没有真 document,按 rootUnlock 用到的最小接口造一套,
// 行为(类名过滤、点击派发)与真 DOM 对齐,断言才有意义。
// ---------------------------------------------------------------------------

interface FakeNode extends LockedNodeLike {
  classes: Set<string>;
  listeners: Array<() => void>;
  click(): void;
}

/** 造一个「还锁着」的关卡格,无障碍标签与 level99 的 nodeAriaLabel 逐字一致 */
function fakeLockedNode(levelNo: number): FakeNode {
  const attrs = new Map<string, string>([["aria-label", `第 ${levelNo} 关，还没解锁`]]);
  const classes = new Set(["l99-node", "l99-node-lock"]);
  const listeners: Array<() => void> = [];
  return {
    classes,
    listeners,
    disabled: true,
    innerHTML: `<span class="l99-node-num">🔒</span>`,
    getAttribute: (name) => attrs.get(name) ?? null,
    setAttribute: (name, value) => {
      attrs.set(name, value);
    },
    classList: {
      add: (cls) => {
        classes.add(cls);
      },
      remove: (cls) => {
        classes.delete(cls);
      }
    },
    addEventListener: (_type, fn) => {
      listeners.push(fn);
    },
    click() {
      for (const fn of listeners) fn();
    }
  };
}

interface FakeTab {
  classes: Set<string>;
  classList: { remove(cls: string): void };
  textContent: string | null;
}

function fakeLockedTab(label: string): FakeTab {
  const classes = new Set(["l99-tab", "l99-tab-lock"]);
  return {
    classes,
    classList: {
      remove: (cls) => {
        classes.delete(cls);
      }
    },
    textContent: label
  };
}

interface FakeMapOptions {
  /** 不放「直达」控件(模拟异常情形,增强必须整体放弃) */
  withoutJump?: boolean;
}

function fakeMap(nodes: FakeNode[], tabs: FakeTab[] = [], opts: FakeMapOptions = {}) {
  const input = { value: "" };
  const go = {
    clicks: 0,
    click() {
      this.clicks++;
    }
  };
  const note = { textContent: "管理员权限还剩 60 分钟" };
  return {
    input,
    go,
    note,
    querySelector(selector: string): unknown {
      if (opts.withoutJump) return null;
      if (selector === ".l99-jump-input") return input;
      if (selector === ".l99-jump .l99-tool") return go;
      if (selector === ".l99-jump-note") return note;
      return null;
    },
    querySelectorAll(selector: string): unknown[] {
      // 与真 DOM 一致:按「当前」类名过滤,解锁过的格子第二次查不到
      if (selector === "button.l99-node-lock") return nodes.filter((n) => n.classes.has("l99-node-lock"));
      if (selector === ".l99-tab-lock") return tabs.filter((t) => t.classes.has("l99-tab-lock"));
      return [];
    }
  };
}

function fakeHost(maps: ReturnType<typeof fakeMap>[]): UnlockHostLike {
  return {
    querySelectorAll(selector: string): unknown[] {
      return selector === ".l99-map" ? maps : [];
    }
  };
}

const NOW = 50_000_000;

beforeEach(() => {
  resetRoot12Extras();
  clearRootSession(null);
});

describe("rootUnlock 纯逻辑", () => {
  it("从无障碍标签里解析 1 基关号(全角逗号、空格都认)", () => {
    expect(parseLevelFromLabel("第 100 关，还没解锁")).toBe(100);
    expect(parseLevelFromLabel("第 5 关，已通关 2 星")).toBe(5);
    expect(parseLevelFromLabel("第188关")).toBe(188);
    expect(parseLevelFromLabel("第 1 关,还没通关")).toBe(1);
  });

  it("读不出关号返回 null,不抛异常", () => {
    expect(parseLevelFromLabel(null)).toBeNull();
    expect(parseLevelFromLabel(undefined)).toBeNull();
    expect(parseLevelFromLabel("")).toBeNull();
    expect(parseLevelFromLabel("还没解锁")).toBeNull();
    expect(parseLevelFromLabel("第 0 关")).toBeNull();
  });

  it("解锁格的无障碍文案带关号,不写吓人词也不写 root", () => {
    const text = rootUnlockAria(66);
    expect(text).toContain("第 66 关");
    expect(text).toContain("管理员");
    expect(text.toLowerCase()).not.toContain("root");
    expect(text).not.toContain("高权限");
  });

  it("解锁格的内容:关号 + 开锁图形,复用地图自己的字号类", () => {
    const html = rootUnlockNodeHTML(42);
    expect(html).toContain(">42<");
    expect(html).toContain("l99-node-num");
    expect(html).toContain("l99-node-stars");
    expect(html).not.toContain("🔒");
  });

  it("章节页签去锁标:只摘结尾的 🔒,其余文字原样保留", () => {
    expect(stripLockMark("🌊 冰雪山谷 🔒")).toBe("🌊 冰雪山谷");
    expect(stripLockMark("🌊 冰雪山谷")).toBe("🌊 冰雪山谷");
    expect(stripLockMark(null)).toBe("");
    expect(stripLockMark("🔒 开头的不动它")).toBe("🔒 开头的不动它");
  });
});

describe("applyRootUnlock:管理员开着才解锁", () => {
  it("权限关着:一个格子都不动,返回 0", () => {
    const node = fakeLockedNode(10);
    const host = fakeHost([fakeMap([node])]);
    expect(applyRootUnlock(host, NOW)).toBe(0);
    expect(node.disabled).toBe(true);
    expect(node.classes.has("l99-node-lock")).toBe(true);
  });

  it("权限开着(1 小时):所有锁定格子解锁、可点、换无障碍文案", () => {
    openRootSession(NOW, "1h", null);
    const nodes = [fakeLockedNode(50), fakeLockedNode(120), fakeLockedNode(188)];
    const host = fakeHost([fakeMap(nodes)]);
    expect(applyRootUnlock(host, NOW)).toBe(3);
    for (const n of nodes) {
      expect(n.disabled).toBe(false);
      expect(n.classes.has("l99-node-lock")).toBe(false);
      expect(n.classes.has(ROOT_UNLOCK_CLASS)).toBe(true);
      expect(n.getAttribute("aria-label")).toContain("管理员已解锁");
      expect(n.innerHTML).not.toContain("🔒");
    }
    expect(nodes[2].innerHTML).toContain(">188<");
  });

  it("点解锁格 = 借道「直达」控件直接开那一关", () => {
    openRootSession(NOW, "1h", null);
    const node = fakeLockedNode(188);
    const map = fakeMap([node]);
    applyRootUnlock(fakeHost([map]), NOW);
    node.click();
    expect(map.input.value).toBe("188");
    expect(map.go.clicks).toBe(1);
  });

  it("地图上没有「直达」控件时整体放弃,绝不解出点了没反应的死按钮", () => {
    openRootSession(NOW, "1h", null);
    const node = fakeLockedNode(30);
    const host = fakeHost([fakeMap([node], [], { withoutJump: true })]);
    expect(applyRootUnlock(host, NOW)).toBe(0);
    expect(node.disabled).toBe(true);
    expect(node.classes.has("l99-node-lock")).toBe(true);
  });

  it("锁着的章节页签一起解锁:类摘掉、🔒 摘掉", () => {
    openRootSession(NOW, "1h", null);
    const tab = fakeLockedTab("🌋 火山谷 🔒");
    applyRootUnlock(fakeHost([fakeMap([], [tab])]), NOW);
    expect(tab.classes.has("l99-tab-lock")).toBe(false);
    expect(tab.textContent).toBe("🌋 火山谷");
  });

  it("幂等:第二遍是空转,不会给格子重复挂点击", () => {
    openRootSession(NOW, "1h", null);
    const node = fakeLockedNode(77);
    const map = fakeMap([node]);
    const host = fakeHost([map]);
    expect(applyRootUnlock(host, NOW)).toBe(1);
    expect(applyRootUnlock(host, NOW)).toBe(0);
    expect(node.listeners.length).toBe(1);
  });

  it("权限过期后再跑:不再解锁(恢复真实进度靠地图重画)", () => {
    openRootSession(NOW, "30m", null);
    const node = fakeLockedNode(9);
    const host = fakeHost([fakeMap([node])]);
    expect(applyRootUnlock(host, NOW + 31 * 60_000)).toBe(0);
    expect(node.disabled).toBe(true);
  });

  it("永久开启时把「还剩 XX 分钟」的小字改成永久开启", () => {
    openRootSession(NOW, "forever", null);
    const map = fakeMap([fakeLockedNode(2)]);
    applyRootUnlock(fakeHost([map]), NOW);
    expect(map.note.textContent).toBe(ROOT_PERMANENT_NOTE);
  });

  it("限时开启时小字不动,仍旧报剩余分钟", () => {
    openRootSession(NOW, "1h", null);
    const map = fakeMap([fakeLockedNode(2)]);
    applyRootUnlock(fakeHost([map]), NOW);
    expect(map.note.textContent).toBe("管理员权限还剩 60 分钟");
  });

  it("一次能处理多张地图,返回总解锁数", () => {
    openRootSession(NOW, "1h", null);
    const a = fakeMap([fakeLockedNode(3), fakeLockedNode(4)]);
    const b = fakeMap([fakeLockedNode(5)]);
    expect(applyRootUnlock(fakeHost([a, b]), NOW)).toBe(3);
  });

  it("host 不像个 DOM 节点时返回 0,不抛异常", () => {
    openRootSession(NOW, "1h", null);
    expect(applyRootUnlock(null as unknown as UnlockHostLike, NOW)).toBe(0);
    expect(applyRootUnlock({} as UnlockHostLike, NOW)).toBe(0);
  });

  it("读不出关号的格子跳过,其余照常解锁", () => {
    openRootSession(NOW, "1h", null);
    const good = fakeLockedNode(12);
    const bad = fakeLockedNode(13);
    bad.setAttribute("aria-label", "这一格标签坏了");
    expect(applyRootUnlock(fakeHost([fakeMap([good, bad])]), NOW)).toBe(1);
    expect(good.disabled).toBe(false);
    expect(bad.disabled).toBe(true);
  });
});
