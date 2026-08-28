/**
 * 1.3 第 1 步 B · 壳层动效工具 + 关卡壳/结算舞台的 DOM 断言。
 *
 * 分四块:
 *  1. motion.ts 纯函数:staggerDelays / tweenNumber / springScale / motionPref 与时序常量;
 *  2. 入场卡 DOM:buildLevelIntroCard 含关卡号、目标文案、reduced 静态降级;
 *  3. 结算舞台 DOM:真实调用 showResultDialog(自带极简 DOM 桩,不引 jsdom),
 *     断言三个星位、逐颗点亮延迟 ~250ms、分数滚动 ≤ 800ms 与 reduced 直达终值;
 *  4. styles.css 显式尺寸断言:按钮热区 ≥ 44px、胶囊圆角、悬停位移 ≤ 4px、reduced 降级。
 *
 * 只加新断言,不改任何旧测试的预期值。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  INTRO_HOLD_MS,
  INTRO_LEAVE_MS,
  PRESS_POP_PEAK,
  SCORE_ROLL_MS,
  STAR_BASE_MS,
  STAR_STEP_MS,
  easeOutCubic,
  motionPref,
  springScale,
  staggerDelays,
  tweenNumber
} from "./motion";
import { applyResultMotion, buildLevelIntroCard, introHeading } from "./gameShell";
import { FOCUSABLE_SELECTOR, showResultDialog } from "./dialogs";

const CSS = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");

// ===========================================================================
// 1. 纯函数
// ===========================================================================

describe("staggerDelays 错峰时序", () => {
  it("长度等于 count,延迟按 step 递增", () => {
    expect(staggerDelays(3, 250, false)).toEqual([0, 250, 500]);
    expect(staggerDelays(1, 999, false)).toEqual([0]);
  });

  it("reduced 时全 0,所有元素同时出现", () => {
    expect(staggerDelays(4, 250, true)).toEqual([0, 0, 0, 0]);
    expect(staggerDelays(4, 250, true).every((d) => d === 0)).toBe(true);
  });

  it("count 是脏值时收敛,不抛也不出负长度", () => {
    expect(staggerDelays(0, 250, false)).toEqual([]);
    expect(staggerDelays(-3, 250, false)).toEqual([]);
    expect(staggerDelays(Number.NaN, 250, false)).toEqual([]);
    expect(staggerDelays(2.9, 250, false)).toEqual([0, 250]);
  });

  it("step 是脏值时按 0 处理,延迟绝不是 NaN 或负数", () => {
    expect(staggerDelays(3, Number.NaN, false)).toEqual([0, 0, 0]);
    expect(staggerDelays(3, -100, false)).toEqual([0, 0, 0]);
  });
});

describe("tweenNumber 分数滚动插值", () => {
  it("端点精确:t=0 取 from,t=1 取 to,连不守规矩的缓动也拉不偏", () => {
    expect(tweenNumber(0, 100, 0)).toBe(0);
    expect(tweenNumber(0, 100, 1)).toBe(100);
    const sloppy = (): number => 0.5; // 两端都不归位的缓动
    expect(tweenNumber(10, 20, 0, sloppy)).toBe(10);
    expect(tweenNumber(10, 20, 1, sloppy)).toBe(20);
  });

  it("t 越界被夹住", () => {
    expect(tweenNumber(5, 15, -1)).toBe(5);
    expect(tweenNumber(5, 15, 2)).toBe(15);
  });

  it("NaN 安全:t 是 NaN 直接到终值,from/to 是 NaN 按 0 兜底,绝不返回 NaN", () => {
    expect(tweenNumber(0, 3, Number.NaN)).toBe(3);
    expect(tweenNumber(Number.NaN, 10, 1)).toBe(10);
    expect(tweenNumber(Number.NaN, 10, 0)).toBe(0);
    expect(tweenNumber(0, Number.NaN, 1)).toBe(0);
    expect(Number.isNaN(tweenNumber(Number.NaN, Number.NaN, Number.NaN))).toBe(false);
  });

  it("缺省缓动先快后慢:中途值在两端之间且单调不减", () => {
    let prev = 0;
    for (let i = 0; i <= 10; i++) {
      const v = tweenNumber(0, 100, i / 10);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
      prev = v;
    }
    // 先快后慢:前半程走过的路多于一半
    expect(tweenNumber(0, 100, 0.5)).toBeGreaterThan(50);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
  });

  it("缓动函数抛异常或算出脏值时退回线性,动画不把结算画面搞崩", () => {
    const boom = (): number => {
      throw new Error("bad easing");
    };
    expect(() => tweenNumber(0, 100, 0.5, boom)).not.toThrow();
    expect(tweenNumber(0, 100, 0.5, boom)).toBe(50);
    const dirty = (): number => Number.NaN;
    expect(tweenNumber(0, 100, 0.5, dirty)).toBe(50);
  });
});

describe("springScale 按压回弹", () => {
  it("首尾都是 1(目标值)", () => {
    expect(springScale(0)).toBe(1);
    expect(springScale(1)).toBe(1);
  });

  it("峰值不超过 1.08,而且确实有回弹(峰值 > 1.04)", () => {
    let peak = 1;
    for (let i = 0; i <= 2000; i++) peak = Math.max(peak, springScale(i / 2000));
    expect(peak).toBeLessThanOrEqual(PRESS_POP_PEAK);
    expect(peak).toBeLessThanOrEqual(1.08);
    expect(peak).toBeGreaterThan(1.04);
  });

  it("全程有界:不缩没也不炸缸,脏值一律返回 1", () => {
    for (let i = 0; i <= 2000; i++) {
      const v = springScale(i / 2000);
      expect(v).toBeGreaterThan(0.9);
      expect(v).toBeLessThanOrEqual(1.08);
    }
    expect(springScale(Number.NaN)).toBe(1);
    expect(springScale(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("t 越界被夹住,夹完还是 1", () => {
    expect(springScale(-0.5)).toBe(1);
    expect(springScale(1.5)).toBe(1);
  });
});

describe("motionPref 减弱动效偏好", () => {
  it("注入 matchMedia 桩:两种取值都问的是标准查询", () => {
    const asked: string[] = [];
    expect(
      motionPref((q: string) => {
        asked.push(q);
        return { matches: true };
      })
    ).toBe(true);
    expect(motionPref(() => ({ matches: false }))).toBe(false);
    expect(asked).toEqual(["(prefers-reduced-motion: reduce)"]);
  });

  it("读不到偏好一律当 false:宁可动效照旧,也不把画面全静了", () => {
    expect(motionPref(null)).toBe(false);
    expect(motionPref(() => null)).toBe(false);
    expect(motionPref(() => ({}))).toBe(false);
    expect(
      motionPref(() => {
        throw new Error("no media");
      })
    ).toBe(false);
  });
});

describe("时序常量与规格对账", () => {
  it("入场卡 600ms 让位、星级 ~250ms 一颗、分数滚动 ≤ 800ms、回弹峰值 ≤ 1.08", () => {
    expect(INTRO_HOLD_MS).toBe(600);
    expect(INTRO_LEAVE_MS).toBeLessThan(INTRO_HOLD_MS);
    expect(STAR_STEP_MS).toBe(250);
    expect(STAR_BASE_MS).toBeGreaterThanOrEqual(0);
    expect(SCORE_ROLL_MS).toBeLessThanOrEqual(800);
    expect(PRESS_POP_PEAK).toBeLessThanOrEqual(1.08);
  });

  it("styles.css 的关键帧与 motion.ts 用同名常量对账(注释在场)", () => {
    for (const name of ["INTRO_HOLD_MS", "INTRO_LEAVE_MS", "STAR_STEP_MS", "SCORE_ROLL_MS", "PRESS_POP_PEAK"]) {
      expect(CSS, `styles.css 里找不到对账注释 ${name}`).toContain(name);
    }
  });
});

// ===========================================================================
// 2. 极简 DOM 桩(测试环境是 node、没有 jsdom,照 a11y.test.ts 的路子自带一份)
// ===========================================================================

class MiniEl {
  tagName: string;
  className = "";
  textContent = "";
  id = "";
  disabled = false;
  readonly style: Record<string, string> = {};
  readonly attrs = new Map<string, string>();
  children: MiniEl[] = [];
  parent: MiniEl | null = null;
  ownerDocument: MiniDoc;
  focusCount = 0;
  readonly classList = {
    add: (c: string): void => {
      if (!this.className.split(/\s+/).includes(c)) this.className = `${this.className} ${c}`.trim();
    }
  };

  constructor(tag: string, doc: MiniDoc) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
  }

  get parentElement(): MiniEl | null {
    return this.parent;
  }

  get nextSibling(): MiniEl | null {
    if (!this.parent) return null;
    const i = this.parent.children.indexOf(this);
    return this.parent.children[i + 1] ?? null;
  }

  get isConnected(): boolean {
    let node: MiniEl = this;
    while (node.parent) node = node.parent;
    return node === this.ownerDocument.body;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attrs.has(name) ? (this.attrs.get(name) as string) : null;
  }

  appendChild(child: MiniEl): MiniEl {
    child.remove();
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...kids: MiniEl[]): void {
    for (const kid of kids) this.appendChild(kid);
  }

  insertBefore(node: MiniEl, ref: MiniEl | null): MiniEl {
    if (!ref) return this.appendChild(node);
    node.remove();
    const i = this.children.indexOf(ref);
    node.parent = this;
    this.children.splice(i < 0 ? this.children.length : i, 0, node);
    return node;
  }

  removeChild(child: MiniEl): void {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parent = null;
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  addEventListener(): void {
    /* 桩里不用派发事件 */
  }

  focus(): void {
    this.focusCount++;
    this.ownerDocument.activeElement = this;
  }

  descendants(): MiniEl[] {
    const out: MiniEl[] = [];
    const walk = (el: MiniEl): void => {
      for (const kid of el.children) {
        out.push(kid);
        walk(kid);
      }
    };
    walk(this);
    return out;
  }

  private matchesSimple(sel: string): boolean {
    if (sel.startsWith(".")) return this.className.split(/\s+/).includes(sel.slice(1));
    return this.tagName === sel.toUpperCase();
  }

  /** 只认测试真正用到的选择器:焦点清单、"h1,h2,h3"、类名与后代链 */
  querySelectorAll(selector: string): MiniEl[] {
    if (selector === FOCUSABLE_SELECTOR) {
      return this.descendants().filter(
        (el) =>
          (["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) && !el.disabled) ||
          (el.tagName === "A" && el.attrs.has("href")) ||
          (el.attrs.get("tabindex") ?? "-1") !== "-1"
      );
    }
    if (selector.includes(",")) {
      const parts = selector.split(",").map((s) => s.trim());
      return this.descendants().filter((el) => parts.some((p) => el.matchesSimple(p)));
    }
    const chain = selector.split(/\s+/).filter(Boolean);
    let found: MiniEl[] = [this];
    for (const part of chain) {
      const next: MiniEl[] = [];
      for (const base of found) {
        for (const el of base.descendants()) {
          if (el.matchesSimple(part) && !next.includes(el)) next.push(el);
        }
      }
      found = next;
    }
    return found;
  }

  querySelector(selector: string): MiniEl | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class MiniDoc {
  readonly body: MiniEl;
  activeElement: MiniEl | null = null;

  constructor() {
    this.body = new MiniEl("body", this);
  }

  createElement(tag: string): MiniEl {
    return new MiniEl(tag, this);
  }

  getElementById(id: string): MiniEl | null {
    return this.body.descendants().find((el) => el.id === id) ?? null;
  }

  addEventListener(): void {
    /* 桩里不用派发事件 */
  }

  removeEventListener(): void {
    /* 桩里不用派发事件 */
  }
}

/** 把桩安到全局上(showResultDialog 直接用全局 document / window),用完还回去 */
function installGlobals(doc: MiniDoc): void {
  const g = globalThis as Record<string, unknown>;
  g.__motionTestSaved = { document: g.document, window: g.window };
  g.document = doc;
  g.window = { setTimeout: () => 0, clearTimeout: () => undefined };
}

function restoreGlobals(): void {
  const g = globalThis as Record<string, unknown>;
  const saved = g.__motionTestSaved as { document: unknown; window: unknown } | undefined;
  if (saved) {
    if (saved.document === undefined) delete g.document;
    else g.document = saved.document;
    if (saved.window === undefined) delete g.window;
    else g.window = saved.window;
  }
  delete g.__motionTestSaved;
}

// ===========================================================================
// 3. 入场卡 DOM 断言
// ===========================================================================

describe("入场卡「第 N 关 + 目标」", () => {
  it("introHeading:闯关游戏是「第 N 关」,小数关号取整,没有关卡概念用游戏名", () => {
    expect(introHeading(5, "彩虹跑跑")).toBe("第 5 关");
    expect(introHeading(5.9, "彩虹跑跑")).toBe("第 5 关");
    expect(introHeading(0, "花园五子棋")).toBe("花园五子棋");
    expect(introHeading(Number.NaN, "花园五子棋")).toBe("花园五子棋");
  });

  it("入场卡元素存在且含关卡号与目标文案", () => {
    const doc = new MiniDoc();
    const card = buildLevelIntroCard(doc as unknown as Document, {
      level: 5,
      title: "彩虹跑跑",
      goal: "一路奔跑收集星星",
      emoji: "🌈",
      reduced: false
    }) as unknown as MiniEl;
    expect(card.className).toContain("level-intro");
    const heading = card.querySelector(".level-intro-level");
    expect(heading?.textContent).toBe("第 5 关");
    expect(card.querySelector(".level-intro-goal")?.textContent).toBe("一路奔跑收集星星");
    expect(card.querySelector(".level-intro-decor")?.textContent).toBe("🌈");
  });

  it("非闯关游戏的大字是游戏名,不硬凑「第 1 关」", () => {
    const doc = new MiniDoc();
    const card = buildLevelIntroCard(doc as unknown as Document, {
      level: 0,
      title: "花园五子棋",
      goal: "五颗连成一线就赢",
      emoji: "🌼",
      reduced: false
    }) as unknown as MiniEl;
    expect(card.querySelector(".level-intro-level")?.textContent).toBe("花园五子棋");
    expect(card.querySelector(".level-intro-level")?.textContent).not.toContain("第");
  });

  it("reduced 时带静态类(不弹入),整卡对读屏隐藏、不抢焦点", () => {
    const doc = new MiniDoc();
    const on = buildLevelIntroCard(doc as unknown as Document, {
      level: 3,
      title: "t",
      goal: "g",
      emoji: "⭐",
      reduced: true
    }) as unknown as MiniEl;
    const off = buildLevelIntroCard(doc as unknown as Document, {
      level: 3,
      title: "t",
      goal: "g",
      emoji: "⭐",
      reduced: false
    }) as unknown as MiniEl;
    expect(on.className).toContain("level-intro--static");
    expect(off.className).not.toContain("level-intro--static");
    expect(on.getAttribute("aria-hidden")).toBe("true");
  });
});

// ===========================================================================
// 4. 结算舞台 DOM 断言(真实调用 showResultDialog)
// ===========================================================================

describe("结算舞台:星位、逐颗点亮、分数滚动", () => {
  let doc: MiniDoc;

  beforeEach(() => {
    doc = new MiniDoc();
    installGlobals(doc);
  });

  afterEach(() => {
    restoreGlobals();
  });

  function openWinDialog(stars: 1 | 2 | 3): MiniEl {
    const handle = showResultDialog({
      win: true,
      stars,
      message: "你真棒!",
      onReplay: () => undefined,
      onHome: () => undefined,
      returnFocusTo: null
    });
    return handle.el as unknown as MiniEl;
  }

  it("结算星级容器有三个星位,拿几颗就亮几颗", () => {
    const el = openWinDialog(2);
    const row = el.querySelector(".result-stars");
    expect(row).not.toBeNull();
    expect(el.querySelectorAll(".result-stars .star")).toHaveLength(3);
    expect(el.querySelectorAll(".result-stars .star--on")).toHaveLength(2);
  });

  it("星级逐颗点亮:延迟按 STAR_BASE_MS + i·STAR_STEP_MS(~250ms 一颗)", () => {
    const el = openWinDialog(3);
    applyResultMotion(el as unknown as HTMLElement, { stars: 3, reduced: false, raf: null });
    const delays = el.querySelectorAll(".result-stars .star").map((s) => s.style.animationDelay);
    expect(delays).toEqual(["0.15s", "0.4s", "0.65s"]);
  });

  it("reduced:星星延迟全 0 直接亮,分数直接是终值", () => {
    const el = openWinDialog(3);
    applyResultMotion(el as unknown as HTMLElement, { stars: 3, reduced: true });
    const delays = el.querySelectorAll(".result-stars .star").map((s) => s.style.animationDelay);
    expect(delays).toEqual(["0s", "0s", "0s"]);
    expect(el.querySelector(".result-score")?.textContent).toBe("+3 ⭐");
  });

  it("分数滚动:从 0 滚到实际星数,时长封在 SCORE_ROLL_MS 内,收尾精确落在终值", () => {
    const el = openWinDialog(3);
    const frames: Array<() => void> = [];
    let clock = 0;
    applyResultMotion(el as unknown as HTMLElement, {
      stars: 3,
      reduced: false,
      raf: (fn) => frames.push(fn),
      now: () => clock
    });
    const score = el.querySelector(".result-score");
    expect(score).not.toBeNull();
    // 起步是 0,不是一上来就终值
    expect(score?.textContent).toBe("+0 ⭐");
    clock = 100;
    frames.shift()?.();
    const mid = Number(/\+(\d+)/.exec(score?.textContent ?? "")?.[1]);
    expect(mid).toBeGreaterThanOrEqual(0);
    expect(mid).toBeLessThanOrEqual(3);
    // 到 SCORE_ROLL_MS 就收尾:显示终值,而且不再排下一帧
    clock = SCORE_ROLL_MS;
    frames.shift()?.();
    expect(score?.textContent).toBe("+3 ⭐");
    expect(frames).toHaveLength(0);
  });

  it("分数胶囊紧跟星位之后,而且对读屏隐藏(announce 已经把星数念过了)", () => {
    const el = openWinDialog(1);
    applyResultMotion(el as unknown as HTMLElement, { stars: 1, reduced: true });
    const row = el.querySelector(".result-stars");
    const score = el.querySelector(".result-score");
    expect(row?.nextSibling).toBe(score);
    expect(score?.getAttribute("aria-hidden")).toBe("true");
  });

  it("失败结算没有星位:不加分数胶囊,也不抛;dialogEl 是 null 同样安全", () => {
    const handle = showResultDialog({
      win: false,
      message: "再来一次一定行!",
      onReplay: () => undefined,
      onHome: () => undefined,
      returnFocusTo: null
    });
    const el = handle.el as unknown as MiniEl;
    expect(() =>
      applyResultMotion(el as unknown as HTMLElement, { stars: 0, reduced: false, raf: null })
    ).not.toThrow();
    expect(el.querySelector(".result-score")).toBeNull();
    expect(() => applyResultMotion(null, { stars: 3, reduced: false })).not.toThrow();
  });
});

// ===========================================================================
// 5. styles.css 显式尺寸断言(热区、胶囊、位移、降级)
// ===========================================================================

/** 取某条规则的声明块(只匹配第一处,照 a11y.test.ts 的写法) */
function ruleBody(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(^|[},])\\s*${esc}\\s*\\{([^}]*)\\}`, "m").exec(CSS);
  expect(m, `styles.css 里找不到规则 ${selector}`).not.toBeNull();
  return (m as RegExpExecArray)[2];
}

/** 取所有 prefers-reduced-motion 块拼起来 */
function reducedBlocks(): string {
  const out: string[] = [];
  const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS)) !== null) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < CSS.length && depth > 0) {
      if (CSS[i] === "{") depth++;
      else if (CSS[i] === "}") depth--;
      i++;
    }
    out.push(CSS.slice(re.lastIndex, i - 1));
  }
  return out.join("\n");
}

describe("styles.css:热区、胶囊与位移的显式尺寸", () => {
  it("结算/暂停面板的按钮是圆角胶囊,热区 ≥ 44px", () => {
    const btn = ruleBody(".btn");
    expect(btn).toMatch(/border-radius:\s*999px/);
    const minHeight = Number(/min-height:\s*(\d+)px/.exec(btn)?.[1]);
    expect(minHeight).toBeGreaterThanOrEqual(44);
  });

  it("暂停面板按钮组间距 ≥ 8px;顶栏暂停键是胶囊,热区 ≥ 44px", () => {
    const gap = Number(/gap:\s*(\d+)px/.exec(ruleBody(".dialog-buttons"))?.[1]);
    expect(gap).toBeGreaterThanOrEqual(8);
    const icon = ruleBody(".icon-btn");
    expect(Number(/width:\s*(\d+)px/.exec(icon)?.[1])).toBeGreaterThanOrEqual(44);
    expect(Number(/height:\s*(\d+)px/.exec(icon)?.[1])).toBeGreaterThanOrEqual(44);
    // 圆角胶囊 = 999px 圆角,宽度大于高度(不再是正圆)
    const pause = CSS.match(/\.icon-btn--pause\s*\{([^}]*)\}[\s\S]*?\.icon-btn--pause\s*\{([^}]*)\}/);
    expect(pause, "找不到暂停键的胶囊规则").not.toBeNull();
    expect(`${pause?.[1]}${pause?.[2]}`).toMatch(/border-radius:\s*999px/);
  });

  it("首页卡片悬停位移 ≤ 4px(宪法七:悬停浮起不许超过 4px)", () => {
    const hover = ruleBody(".game-card:hover");
    const dy = /translateY\(-?(\d+(?:\.\d+)?)px\)/.exec(hover);
    expect(dy, ".game-card:hover 找不到 translateY").not.toBeNull();
    expect(Number(dy?.[1])).toBeLessThanOrEqual(4);
  });

  it("HUD 规范:半透明白底 + 圆角胶囊 + 一行排布;入场卡目标文案 ≥ 16px", () => {
    const chip = ruleBody(".shell-hud-chip");
    expect(chip).toMatch(/background:\s*rgba\(255,\s*255,\s*255/);
    expect(chip).toMatch(/border-radius:\s*999px/);
    expect(ruleBody(".shell-hud")).toMatch(/display:\s*flex/);
    const goal = ruleBody(".level-intro-goal");
    expect(Number(/font-size:\s*(\d+)px/.exec(goal)?.[1])).toBeGreaterThanOrEqual(16);
  });

  it("入场卡纯展示:pointer-events 穿透,一毫秒也不挡手", () => {
    expect(ruleBody(".level-intro")).toMatch(/pointer-events:\s*none/);
  });

  it("prefers-reduced-motion:入场卡与选中页签的新动效全部静态降级", () => {
    const rm = reducedBlocks();
    const intro = /\.level-intro-card[^{]*\{([^}]*)\}/.exec(rm);
    expect(intro, "减弱动效里没有 .level-intro-card").not.toBeNull();
    expect((intro as RegExpExecArray)[1]).toMatch(/animation:\s*none\s*!important/);
    expect(rm).toContain(".tab--active");
  });

  it("选中页签有形状变化(不只变色):圆角从胶囊变成花瓣", () => {
    const active = ruleBody(".tab--active");
    expect(active).toMatch(/border-radius:/);
    // 四角不全相等才算形状变化
    const radius = /border-radius:\s*([^;]+);/.exec(active)?.[1].trim() ?? "";
    expect(new Set(radius.split(/\s+/)).size).toBeGreaterThan(1);
  });

  it("页签滚动溢出有渐隐提示,并给尾部留了让位内边距", () => {
    const re = /\.tabs\s*\{([^}]*)\}/g;
    let hit = "";
    let m: RegExpExecArray | null;
    while ((m = re.exec(CSS)) !== null) {
      if (/mask-image/.test(m[1])) hit = m[1];
    }
    expect(hit, ".tabs 找不到渐隐 mask").not.toBe("");
    expect(hit).toMatch(/padding-inline-end/);
  });

  it("N-33:结算按钮列 sticky 贴弹窗底，矮横屏不滚也能点再玩一次/回首页", () => {
    const body = ruleBody(".dialog-buttons");
    expect(body).toMatch(/position:\s*sticky/);
    expect(body).toMatch(/bottom:\s*0/);
    expect(body).toMatch(/background:\s*#fff/);
    expect(body).toMatch(/box-shadow:/);
  });
});
