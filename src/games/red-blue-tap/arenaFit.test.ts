/**
 * 红蓝点点 · 战役竞技场必须整块落在舞台看得见的那一段里
 * （1.2 窗口5 第 1 轮 · 档B 监督修复）。
 *
 * 这一条是复审时补出来的，两份报告里都没有：测试员 W5-B-02 抓的是**双人对战**那四颗键，
 * 学习优化员照着改成了 2×2；可**战役**这一半没人量过。真机 320×640 第 188 关：
 * 竞技场高 280、上面那一截（比分条 + 道具芯片在 320px 宽各折成两三行）把它顶到 y=416，
 * 舞台底边只到 626——下面 70px 里的点一颗都 `elementFromPoint` 不到。
 *
 * 最难查的地方在于点是**随机**摆的（`placeDot` 写的是 `left/top: n%`），
 * 落在上半截就按得着、落在下半截就按不着，表现成「时灵时不灵」而不是「一直坏」。
 *
 * 两手一起上：① 又窄又矮的机器把竞技场上面那一截的留白与字号收一档；
 * ② 运行期把竞技场本身钳进可视范围。不给它挂滚动条——这是个连点游戏，
 * 能滚就会「想点却滚走了」。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ARENA_MIN_PX, arenaHeightPx, fitArena } from "./index";

const dir = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(`${dir}index.ts`, "utf8");

/** 只够 fitArena 用的假 DOM */
class FakeView {
  readonly listeners: Array<() => void> = [];
  getComputedStyle(el: FakeEl): { overflowY: string } {
    return { overflowY: el.overflowY };
  }
  addEventListener(_t: string, fn: () => void): void {
    this.listeners.push(fn);
  }
  removeEventListener(_t: string, fn: () => void): void {
    const i = this.listeners.indexOf(fn);
    if (i >= 0) this.listeners.splice(i, 1);
  }
}

class FakeEl {
  readonly style: Record<string, string> = { height: "" };
  parentElement: FakeEl | null = null;
  overflowY = "visible";
  top = 0;
  /** CSS 给的高度（`style.height` 一清空就回到它） */
  cssHeight = 0;
  constructor(readonly view: FakeView) {}
  get ownerDocument(): { defaultView: FakeView } {
    return { defaultView: this.view };
  }
  getBoundingClientRect(): { top: number; bottom: number; height: number } {
    const forced = Number.parseFloat(this.style.height);
    const h = Number.isFinite(forced) ? forced : this.cssHeight;
    return { top: this.top, bottom: this.top + h, height: h };
  }
  asEl(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

/** 舞台(overflow:hidden，定高) → 壳层(auto 高) → .rbt-wrap → .rbt-arena */
function makeChain(stageTop: number, stageBottom: number, arenaTop: number, arenaCss: number) {
  const view = new FakeView();
  const stage = new FakeEl(view);
  stage.overflowY = "hidden";
  stage.top = stageTop;
  stage.cssHeight = stageBottom - stageTop;
  const wrap = new FakeEl(view);
  wrap.parentElement = stage;
  wrap.top = stageTop + 8;
  wrap.cssHeight = arenaTop + arenaCss - wrap.top;
  const arena = new FakeEl(view);
  arena.parentElement = wrap;
  arena.top = arenaTop;
  arena.cssHeight = arenaCss;
  return { view, stage, arena };
}

describe("红蓝点点 · arenaHeightPx", () => {
  it("放得下就一分不收，手感不动", () => {
    expect(arenaHeightPx(320, 500)).toBe(320);
    expect(arenaHeightPx(280, 280)).toBe(280);
  });

  it("放不下就收到可视高度，向下取整不留半像素", () => {
    expect(arenaHeightPx(280, 210.7)).toBe(ARENA_MIN_PX);
    expect(arenaHeightPx(320, 240.9)).toBe(240);
  });

  it("再挤也守住下限——低于这个高度三行点就摆不开了", () => {
    expect(arenaHeightPx(320, 80)).toBe(ARENA_MIN_PX);
    expect(arenaHeightPx(320, 1)).toBe(ARENA_MIN_PX);
    expect(ARENA_MIN_PX).toBe(216);
    // 下限得装得下三行 72px 的点
    expect(ARENA_MIN_PX).toBeGreaterThanOrEqual(72 * 3);
  });

  it("量不到可视高度（没有任何裁切祖先）就原样返回，不瞎收", () => {
    expect(arenaHeightPx(320, Number.POSITIVE_INFINITY)).toBe(320);
    expect(arenaHeightPx(320, Number.NaN)).toBe(320);
    expect(arenaHeightPx(320, 0)).toBe(320);
    expect(arenaHeightPx(320, -40)).toBe(320);
  });
});

describe("红蓝点点 · fitArena 把竞技场压进可视范围", () => {
  it("320×640 第 188 关那一屏：收完下沿正好贴着裁切线，随机摆的点全按得到", () => {
    // 真机实测：舞台 88…626，竞技场从 386 起、CSS 给 280
    const { view, arena } = makeChain(88, 626, 386, 280);
    const off = fitArena(arena.asEl());
    expect(arena.style.height).toBe("240px");
    expect(arena.getBoundingClientRect().bottom).toBeLessThanOrEqual(626);
    off();
    expect(view.listeners).toHaveLength(0);
  });

  it("反例：不收的话下面 40px 里的点是真按不着的——这条用例不是空转", () => {
    const { arena } = makeChain(88, 626, 386, 280);
    expect(arena.getBoundingClientRect().bottom).toBeGreaterThan(626);
  });

  it("屏够高就一个字都不写，竞技场保持 CSS 给的高度", () => {
    const { arena } = makeChain(88, 818, 300, 320);
    const off = fitArena(arena.asEl());
    expect(arena.style.height).toBe("");
    off();
  });

  it("不给它挂滚动条——连点游戏能滚就会「想点却滚走了」", () => {
    const { arena } = makeChain(88, 626, 386, 280);
    const off = fitArena(arena.asEl());
    expect(arena.style.overflowY ?? "").toBe("");
    expect(arena.style.maxHeight ?? "").toBe("");
    expect(source).not.toMatch(/\.rbt-arena[^{]*\{[^}]*overflow-y:\s*auto/);
    off();
  });

  it("转屏跟着重算，而且反复重算不会越收越小", () => {
    const { view, stage, arena } = makeChain(88, 818, 386, 280);
    const off = fitArena(arena.asEl());
    expect(arena.style.height).toBe("");

    stage.cssHeight = 626 - 88;
    for (const fn of view.listeners) fn();
    expect(arena.style.height).toBe("240px");
    for (const fn of [...view.listeners]) fn();
    expect(arena.style.height, "越量越小说明还原那一步漏了").toBe("240px");

    // 转回高屏要能自己退回去
    stage.cssHeight = 818 - 88;
    for (const fn of view.listeners) fn();
    expect(arena.style.height).toBe("");

    off();
    expect(view.listeners).toHaveLength(0);
  });

  it("没有布局能力的节点直接不动手，也不抛", () => {
    const bare = { style: {} as Record<string, string> } as unknown as HTMLElement;
    expect(() => fitArena(bare)()).not.toThrow();
  });

  it("接进了战役这一局的生命周期，destroy 时拆监听", () => {
    expect(source).toContain("fitArena(arenaEl)");
    expect(source).toContain("fitArenaOff()");
  });
});

describe("红蓝点点 · 又窄又矮的机器把竞技场上面那一截收一档", () => {
  const at = source.indexOf("@media (max-width: 420px) and (max-height: 700px)");

  it("有这一档，而且排在既有的窄屏 / 矮屏两档后面才不会被覆盖回去", () => {
    expect(at, "没有又窄又矮这一档").toBeGreaterThan(-1);
    expect(source.indexOf("@media (max-width: 420px) {")).toBeLessThan(at);
    expect(source.indexOf("@media (max-height: 700px) {")).toBeLessThan(at);
  });

  it("收的全是留白与字号：比分条、道具芯片、消息行", () => {
    const block = source.slice(at, source.indexOf("}\n`", at)).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const sel of [".rbt-top", ".rbt-badge", ".rbt-ava", ".rbt-gear", ".rbt-chip", ".rbt-msg"]) {
      expect(block, `${sel} 没收`).toContain(sel);
    }
  });

  it("这一款唯一的操作对象 .rbt-dot 热区一分不动", () => {
    const block = source.slice(at, source.indexOf("}\n`", at)).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(block, "顺手把点收小了，那是把 bug 换了个样子").not.toContain(".rbt-dot");
    // 既有的两档里点最小 56px，仍在 44px 底线之上
    expect(source).toContain(".rbt-dot { width: 56px; height: 56px");
  });
});
