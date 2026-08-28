/**
 * 1.1 第 12 步 · 角色 C:无障碍回归测试。
 *
 * 分四块:
 *  1. 对比度纯函数 + 全站关键色对(改配色调浅了会当场红);
 *  2. `styles.css` / `index.html` 的静态巡检(焦点描边、热区、减弱动效、语义标签);
 *  3. 暂停面板与攻略入口的纯逻辑;
 *  4. 弹窗的键盘可达:焦点陷阱、Esc 关闭、关闭后焦点归位(自带极简 DOM 桩,不引 jsdom)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AA_LARGE,
  AA_NORMAL,
  CONTRAST_CHECKS,
  PALETTE,
  blendOver,
  channelToLinear,
  contrastRatio,
  isLargeText,
  meetsAA,
  mixColors,
  parseHex,
  ratio2,
  relativeLuminance,
  requiredRatio
} from "./contrast";
import {
  FOCUSABLE_SELECTOR,
  announce,
  isDismissKey,
  liveRegion,
  nextFocusIndex,
  resultAnnouncement,
  showDialog,
  starRowLabel,
  starsAnnouncement
} from "./dialogs";
import { buildPauseActions, guideAvailable } from "./gameShell";
import { registerLevelExtras, resetLevelExtras, type GuideBook } from "./level188Contract";

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const CSS = readFileSync(here("../styles.css"), "utf8");
/** 去掉注释的样式表:巡检「颜色有没有被改回浅色」时,注释里的旧值不该算数 */
const CSS_CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
const HTML = readFileSync(here("../../index.html"), "utf8");

/** 从 :root 里读一个 CSS 变量的字面值 */
function cssVar(name: string): string {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(CSS);
  expect(m, `styles.css 里找不到 --${name}`).not.toBeNull();
  return (m as RegExpExecArray)[1].trim();
}

/** 取某条规则的声明块(只匹配第一处) */
function ruleBody(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(^|[},])\\s*${esc}\\s*\\{([^}]*)\\}`, "m").exec(CSS);
  expect(m, `styles.css 里找不到规则 ${selector}`).not.toBeNull();
  return (m as RegExpExecArray)[2];
}

/** 取 @media (prefers-reduced-motion: reduce) 的所有块 */
function reducedMotionBlocks(): string {
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

// ===========================================================================
// 1. 对比度纯函数
// ===========================================================================

describe("对比度计算", () => {
  it("黑白是 21:1,同色是 1:1,而且和前后顺序无关", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#7a1f4c", "#7a1f4c")).toBeCloseTo(1, 10);
  });

  it("解析三位简写、带透明度的八位写法,以及大小写混写", () => {
    expect(parseHex("#FFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("abc")).toEqual({ r: 170, g: 187, b: 204 });
    expect(parseHex("#4A3B45ff")).toEqual({ r: 74, g: 59, b: 69 });
  });

  it("认不出的颜色写法直接报错,不会静默算出个假数字", () => {
    expect(() => parseHex("红色")).toThrow();
    expect(() => parseHex("#12345")).toThrow();
    expect(() => parseHex("")).toThrow();
  });

  it("相对亮度:纯黑 0、纯白 1,越浅越大", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 10);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
    expect(relativeLuminance("#5c4b56")).toBeLessThan(relativeLuminance("#ffd9ea"));
    expect(channelToLinear(0)).toBe(0);
    expect(channelToLinear(255)).toBeCloseTo(1, 10);
  });

  it("半透明色压在底色上先合成再算,不能拿原色硬算", () => {
    // 50% 白压在黑上就是中灰
    expect(blendOver("#ffffff", 0.5, "#000000")).toEqual({ r: 128, g: 128, b: 128 });
    expect(blendOver("#ff0000", 0, "#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(blendOver("#ff0000", 1, "#00ff00")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("渐变中段取色:t=0 取起点,t=1 取终点", () => {
    expect(mixColors("#000000", "#ffffff", 0)).toEqual({ r: 0, g: 0, b: 0 });
    expect(mixColors("#000000", "#ffffff", 1)).toEqual({ r: 255, g: 255, b: 255 });
    const mid = mixColors("#ff6b6b", "#ffffff", 0.62);
    expect(contrastRatio(PALETTE.inkSoft, mid)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("大字号判定按 WCAG:24px 常规、18.66px 粗体起算", () => {
    expect(isLargeText(24)).toBe(true);
    expect(isLargeText(23.9)).toBe(false);
    expect(isLargeText(19, true)).toBe(true);
    expect(isLargeText(18, true)).toBe(false);
    expect(requiredRatio(14)).toBe(AA_NORMAL);
    expect(requiredRatio(30, true)).toBe(AA_LARGE);
    expect(meetsAA("#767676", "#ffffff")).toBe(true);
    expect(meetsAA("#949494", "#ffffff")).toBe(false);
    expect(meetsAA("#949494", "#ffffff", true)).toBe(true);
    expect(meetsAA("#bbbbbb", "#ffffff", true)).toBe(false);
  });
});

// ===========================================================================
// 2. 全站关键色对
// ===========================================================================

describe("全站关键色对达标", () => {
  it.each(CONTRAST_CHECKS.map((c) => [c.where, c] as const))("%s", (_where, check) => {
    const need = requiredRatio(check.fontSizePx, check.bold);
    const got = ratio2(check.fg, check.bg);
    expect(
      got,
      `${check.where}:${check.fg} 压在 ${check.bg} 上只有 ${got}:1,要求 ${need}:1`
    ).toBeGreaterThanOrEqual(need);
  });

  it("正文与次要文字在白底、粉彩底上都稳过 4.5:1", () => {
    for (const bg of ["#ffffff", PALETTE.pinkSoft, "#eef6ff", "#fdfff2"]) {
      expect(ratio2(PALETTE.ink, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      expect(ratio2(PALETTE.inkSoft, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it("色板常量和 styles.css 里的变量取值一致(改一处必须同步另一处)", () => {
    expect(cssVar("ink")).toBe(PALETTE.ink);
    expect(cssVar("ink-soft")).toBe(PALETTE.inkSoft);
    expect(cssVar("pink-deep")).toBe(PALETTE.pinkDeep);
    expect(cssVar("pink-strong")).toBe(PALETTE.pinkStrong);
    expect(cssVar("pink-soft")).toBe(PALETTE.pinkSoft);
  });

  it("焦点描边颜色在白底和粉彩底上都看得清(≥3:1)", () => {
    const ring = cssVar("focus-ring");
    expect(ratio2(ring, "#ffffff")).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(ratio2(ring, PALETTE.pinkSoft)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("加深过的颜色不许被改回旧的浅色", () => {
    for (const stale of ["#6d5b66", "#5b4a55", "#c73a80", "#e2519b", "#96660a", "#8d85a3"]) {
      expect(CSS_CODE.toLowerCase(), `styles.css 里又出现了旧的浅色 ${stale}`).not.toContain(
        stale
      );
    }
  });
});

// ===========================================================================
// 3. styles.css 静态巡检
// ===========================================================================

describe("样式表的无障碍红线", () => {
  it("键盘焦点有描边,鼠标点击不留描边", () => {
    expect(ruleBody(":focus-visible")).toMatch(/outline:\s*3px solid var\(--focus-ring\)/);
    expect(ruleBody(":focus-visible")).toMatch(/outline-offset/);
    expect(ruleBody(":focus:not(:focus-visible)")).toMatch(/outline:\s*none/);
  });

  it("有只给读屏软件看的 .sr-only,且是「不占位但仍在无障碍树里」的写法", () => {
    const body = ruleBody(".sr-only");
    expect(body).toMatch(/position:\s*absolute/);
    expect(body).toMatch(/width:\s*1px/);
    expect(body).toMatch(/clip-path:\s*inset\(50%\)/);
    // display:none / visibility:hidden 会把内容从无障碍树里摘掉,读屏软件就听不到了
    expect(body).not.toMatch(/display:\s*none/);
    expect(body).not.toMatch(/visibility:\s*hidden/);
  });

  it("跳过导航平时藏起来,拿到焦点才露出来", () => {
    expect(ruleBody(".skip-link")).toMatch(/top:\s*-\d+px/);
    expect(CSS).toMatch(/\.skip-link:focus[^{]*\{[^}]*top:\s*0/);
  });

  it("触控热区清单里的每一类都 ≥44px", () => {
    for (const sel of [".btn", ".icon-btn", ".chip", ".tab", ".game-card", ".guide-close"]) {
      const re = new RegExp(`[^}]*\\${sel}[,\\s][^{]*\\{[^}]*min-height:\\s*(\\d+)px`, "m");
      const hit = re.exec(CSS);
      expect(hit, `${sel} 没有 min-height`).not.toBeNull();
      expect(Number((hit as RegExpExecArray)[1])).toBeGreaterThanOrEqual(44);
    }
  });

  it("选关地图的格子与按钮热区 ≥44px", () => {
    expect(ruleBody(".l99-wrap .l99-node")).toMatch(/min-width:\s*44px/);
    expect(ruleBody(".l99-wrap .l99-node")).toMatch(/min-height:\s*44px/);
    expect(CSS).toMatch(/\.l99-wrap \.l99-ov-btn\s*\{[^}]*min-height:\s*4[8-9]px/);
  });

  it("整页不许横向滚动,但竖着必须还能滚", () => {
    expect(CSS_CODE).toMatch(/(^|})\s*html\s*\{[^}]*overflow-x:\s*hidden/m);
    // body 是 height:100%,给它加 overflow-x 会让它自己裁剪内容、整页竖着滚不动
    const bodyRules = [...CSS_CODE.matchAll(/(?:^|})\s*body\s*\{([^}]*)\}/gm)].map((m) => m[1]);
    expect(bodyRules.length).toBeGreaterThan(0);
    for (const body of bodyRules) {
      expect(body).not.toMatch(/overflow(-x|-y)?:\s*(hidden|auto|scroll|clip)/);
    }
  });

  it("游戏舞台竖着能滚:内容比舞台高时手指划得动,不再整段裁掉(1.3 手机端修复)", () => {
    const stage = ruleBody(".game-stage");
    expect(stage).toMatch(/overflow-x:\s*hidden/);
    expect(stage).toMatch(/overflow-y:\s*auto/);
    // 只裁不滚的老写法(overflow: hidden)不许回潮
    expect(stage).not.toMatch(/overflow:\s*hidden/);
    // 游戏页底部让开 iPhone Home 条那类安全区,最后一排按钮不被系统手势条盖住
    expect(ruleBody(".game-screen")).toMatch(/padding-bottom:\s*calc\([^)]*safe-area-inset-bottom/);
    // 740px 上下的竖屏手机也有矮屏压缩档(原来只有 ≤560px 的横放档,竖屏手机整档漏掉)
    expect(CSS).toMatch(/@media \(max-height: 740px\)/);
  });

  it("四个目标断点都有对应的适配规则", () => {
    // 320(超窄)、375/420(手机)、768(平板)、矮屏横放
    expect(CSS).toMatch(/@media \(max-width: 340px\)/);
    expect(CSS).toMatch(/@media \(max-width: 380px\)/);
    expect(CSS).toMatch(/@media \(max-width: 420px\)/);
    expect(CSS).toMatch(/@media \(min-width: 700px\) and \(max-width: 1024px\)/);
    expect(CSS).toMatch(/@media \(max-height: 560px\)/);
  });

  it("prefers-reduced-motion 下位移、抖动、循环动画全部停掉", () => {
    const rm = reducedMotionBlocks();
    expect(rm).toMatch(/animation-iteration-count:\s*1\s*!important/);
    for (const sel of [
      ".decor-item",
      ".dialog--shake",
      ".game-card:hover",
      ".result-face",
      ".l99-wrap .l99-node-cur"
    ]) {
      expect(rm, `减弱动效里漏了 ${sel}`).toContain(sel);
    }
    expect(rm).toMatch(/transform:\s*none/);
  });

  it("停掉星星动画后必须补上终态,否则三颗星会集体隐身", () => {
    const rm = reducedMotionBlocks();
    const star = /\.star--on\s*\{([^}]*)\}/.exec(rm);
    expect(star, "减弱动效里没有 .star--on").not.toBeNull();
    expect((star as RegExpExecArray)[1]).toMatch(/opacity:\s*1/);
  });

  it("加载中的小花在减弱动效下彻底停转,不会变成高频闪烁", () => {
    const rm = reducedMotionBlocks();
    const flower = /\.game-loading-flower\s*\{([^}]*)\}/.exec(rm);
    expect(flower).not.toBeNull();
    expect((flower as RegExpExecArray)[1]).toMatch(/animation:\s*none/);
  });
});

// ===========================================================================
// 4. index.html
// ===========================================================================

describe("index.html 的语义与文案", () => {
  it("语言标成简体中文", () => {
    expect(HTML).toMatch(/<html lang="zh-CN">/);
  });

  it("meta description 说清楚了「是什么、有什么、不做什么」", () => {
    const m = /<meta\s+name="description"\s+content="([^"]+)"/s.exec(HTML);
    expect(m).not.toBeNull();
    const desc = (m as RegExpExecArray)[1].replace(/\s+/g, "");
    expect(desc.length).toBeGreaterThanOrEqual(40);
    expect(desc.length).toBeLessThanOrEqual(200);
    expect(desc).toContain("一朵一星");
    expect(desc).toContain("无广告");
    expect(desc).toMatch(/读屏|键盘/);
    expect(desc).toContain("1.3");
    expect(desc).toContain("76");
    expect(desc).not.toMatch(/1\.1|1\.2|55款|55 款/);
  });

  it("窗口标题是 1.3 · 76 款,不再写旧版本号", () => {
    expect(HTML).toMatch(/<title>一朵一星 1\.3 · 76 款原创小游戏合集<\/title>/);
  });

  it("有独立的 aria-live 播报区,而不是整个 #app 都在播报", () => {
    expect(HTML).toMatch(/id="a11y-live"[^>]*aria-live="polite"/);
    expect(HTML).toMatch(/id="a11y-live"[^>]*role="status"/);
    const app = /<div id="app"[^>]*>/.exec(HTML);
    expect(app).not.toBeNull();
    expect((app as RegExpExecArray)[0]).not.toContain("aria-live");
  });

  it("第一下 Tab 能跳到主要内容,落点自己可以接收焦点", () => {
    expect(HTML).toMatch(/class="skip-link" href="#app"/);
    expect(/<div id="app"[^>]*>/.exec(HTML)?.[0]).toContain('tabindex="-1"');
  });

  it("不出现任何商业商标或官方角色名", () => {
    const banned = [
      "马里奥",
      "超级玛丽",
      "皮卡丘",
      "宝可梦",
      "愤怒的小鸟",
      "迪士尼",
      "米老鼠",
      "奥特曼",
      "喜羊羊",
      "灰太狼",
      "小猪佩奇",
      "海绵宝宝",
      "冰雪奇缘",
      "汪汪队",
      "光头强",
      "Nintendo",
      "Disney",
      "Tetris",
      "Pokemon"
    ];
    const mine = [HTML, CSS, readFileSync(here("./gameShell.ts"), "utf8"), readFileSync(here("./dialogs.ts"), "utf8")].join(
      "\n"
    );
    for (const word of banned) {
      expect(mine.toLowerCase(), `文案里出现了 ${word}`).not.toContain(word.toLowerCase());
    }
  });
});

// ===========================================================================
// 5. 暂停面板
// ===========================================================================

const BOOK: GuideBook = {
  gameId: "demo",
  title: "示范游戏",
  general: ["先看清楚再动手。"],
  entries: [{ from: 1, to: 10, title: "第一章", tips: ["慢一点更稳。"] }]
};

describe("统一暂停面板", () => {
  afterEach(() => resetLevelExtras());

  it("有攻略时是「继续 / 重玩 / 攻略 / 音效 / 回首页」五颗,顺序固定", () => {
    const keys = buildPauseActions({ guideAvailable: true, soundOn: true }).map((a) => a.key);
    expect(keys).toEqual(["resume", "replay", "guide", "sound", "home"]);
  });

  it("没有攻略时攻略按钮整颗不出现,而不是灰着让孩子白点", () => {
    const actions = buildPauseActions({ guideAvailable: false, soundOn: true });
    expect(actions.map((a) => a.key)).toEqual(["resume", "replay", "sound", "home"]);
    expect(actions.some((a) => a.label.includes("攻略"))).toBe(false);
  });

  it("音效按钮是开关型:文案、aria-pressed、朗读名字一起跟着状态走", () => {
    const on = buildPauseActions({ guideAvailable: true, soundOn: true }).find(
      (a) => a.key === "sound"
    );
    const off = buildPauseActions({ guideAvailable: true, soundOn: false }).find(
      (a) => a.key === "sound"
    );
    expect(on?.pressed).toBe(true);
    expect(on?.keepOpen).toBe(true);
    expect(on?.ariaLabel).toBe("关闭背景音乐");
    expect(off?.pressed).toBe(false);
    expect(off?.ariaLabel).toBe("打开背景音乐");
    expect(on?.label).not.toBe(off?.label);
  });

  it("只有「继续玩」是主按钮,其余都是次要按钮", () => {
    const actions = buildPauseActions({ guideAvailable: true, soundOn: false });
    expect(actions.filter((a) => a.kind === "primary").map((a) => a.key)).toEqual(["resume"]);
  });

  it("契约没注册 mountGuide 时,攻略入口一律不出现", () => {
    resetLevelExtras();
    expect(guideAvailable(BOOK)).toBe(false);
    expect(guideAvailable(BOOK, true)).toBe(false);
  });

  it("注册了 mountGuide 之后,自带攻略数据或地图里已有攻略按钮都算能用", () => {
    registerLevelExtras({ mountGuide: () => () => undefined });
    expect(guideAvailable(BOOK)).toBe(true);
    // 188 关框架会拿章节信息拼一份兜底攻略并挂出按钮,这时也该给入口
    expect(guideAvailable(null, true)).toBe(true);
    // 既没数据也没按钮:点开是一片空白,不如不放
    expect(guideAvailable(null)).toBe(false);
  });
});

// ===========================================================================
// 6. 播报文案
// ===========================================================================

describe("读屏播报文案", () => {
  it("星星余额说成一句人话", () => {
    expect(starsAnnouncement(0)).toBe("现在有 0 颗星星");
    expect(starsAnnouncement(12)).toBe("现在有 12 颗星星");
    expect(starsAnnouncement(-3)).toBe("现在有 0 颗星星");
    expect(starsAnnouncement(Number.NaN)).toBe("现在有 0 颗星星");
  });

  it("胜负播报带上星数和鼓励语", () => {
    expect(resultAnnouncement(true, 3, "你真厉害!")).toBe("过关啦,拿到 3 颗星星,你真厉害!");
    expect(resultAnnouncement(true)).toBe("过关啦,拿到 0 颗星星");
    expect(resultAnnouncement(false, undefined, "再来一次")).toBe("这一局没过关,再来一次");
  });

  it("一排 ⭐☆☆ 给读屏软件的是一句话,不是三个符号", () => {
    expect(starRowLabel(1)).toBe("拿到 1 颗星星,一共 3 颗");
    expect(starRowLabel(5)).toBe("拿到 3 颗星星,一共 3 颗");
    expect(starRowLabel(-1)).toBe("拿到 0 颗星星,一共 3 颗");
  });
});

// ===========================================================================
// 7. 弹窗键盘可达(极简 DOM 桩)
// ===========================================================================

interface FakeEvent {
  key?: string;
  shiftKey?: boolean;
  target?: unknown;
  defaultPrevented: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
}

type Handler = (e: FakeEvent) => void;

function makeEvent(target: unknown, extra: Partial<FakeEvent> = {}): FakeEvent {
  const e: FakeEvent = {
    target,
    defaultPrevented: false,
    preventDefault() {
      e.defaultPrevented = true;
    },
    stopPropagation() {
      /* 桩里不做冒泡 */
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
  id = "";
  disabled = false;
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  focusCount = 0;
  readonly attrs = new Map<string, string>();
  readonly listeners = new Map<string, Handler[]>();
  ownerDocument: FakeDoc;
  readonly classList = {
    add: (c: string): void => {
      if (!this.className.split(/\s+/).includes(c)) this.className = `${this.className} ${c}`.trim();
    }
  };

  constructor(tagName: string, doc: FakeDoc) {
    this.tagName = tagName.toUpperCase();
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

  focus(): void {
    this.focusCount++;
    this.ownerDocument.activeElement = this;
  }

  fire(type: string, extra: Partial<FakeEvent> = {}): void {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn(makeEvent(this, extra));
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

  /** 只认测试真正用到的那几种选择器 */
  querySelectorAll(selector: string): FakeEl[] {
    if (selector === FOCUSABLE_SELECTOR) {
      return this.descendants().filter(
        (el) =>
          (["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) && !el.disabled) ||
          (el.tagName === "A" && el.attrs.has("href")) ||
          (el.attrs.get("tabindex") ?? "-1") !== "-1"
      );
    }
    const tags = selector.split(",").map((s) => s.trim().toUpperCase());
    return this.descendants().filter((el) => tags.includes(el.tagName));
  }

  querySelector(selector: string): FakeEl | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class FakeDoc {
  readonly body: FakeEl;
  activeElement: FakeEl | null = null;
  readonly listeners = new Map<string, Handler[]>();
  private readonly byId = new Map<string, FakeEl>();

  constructor() {
    this.body = new FakeEl("body", this);
  }

  createElement(tag: string): FakeEl {
    return new FakeEl(tag, this);
  }

  getElementById(id: string): FakeEl | null {
    const found = this.body.descendants().find((el) => el.id === id);
    if (found) return found;
    return this.byId.get(id) ?? null;
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

function openTestDialog(
  doc: FakeDoc,
  opts: { escapable?: boolean; dismissible?: boolean; onDismiss?: () => void } = {}
): { handle: { close: () => void; el: FakeEl }; buttons: FakeEl[]; picked: string[] } {
  const content = doc.createElement("div");
  const h = doc.createElement("h2");
  h.textContent = "先歇一会儿";
  content.appendChild(h);
  const picked: string[] = [];
  const handle = showDialog({
    content: content as unknown as HTMLElement,
    escapable: opts.escapable,
    dismissible: opts.dismissible,
    onDismiss: opts.onDismiss,
    buttons: [
      { label: "继续玩", onClick: () => picked.push("resume") },
      { label: "重玩", kind: "ghost", onClick: () => picked.push("replay") },
      { label: "回首页", kind: "ghost", onClick: () => picked.push("home") }
    ]
  }) as unknown as { close: () => void; el: FakeEl };
  return { handle, buttons: handle.el.querySelectorAll(FOCUSABLE_SELECTOR), picked };
}

describe("弹窗的键盘可达", () => {
  let doc: FakeDoc;

  beforeEach(() => {
    doc = new FakeDoc();
    // 冷静期靠 performance.now 判定;让每次读表都往前走一大步,点击稳稳落在冷静期之后
    let clock = 1_000_000;
    vi.spyOn(performance, "now").mockImplementation(() => (clock += 5_000));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Tab 循环的落点计算(纯函数)", () => {
    expect(nextFocusIndex(3, 0)).toBe(1);
    expect(nextFocusIndex(3, 2)).toBe(0);
    expect(nextFocusIndex(3, 0, true)).toBe(2);
    expect(nextFocusIndex(3, -1)).toBe(0);
    expect(nextFocusIndex(3, -1, true)).toBe(2);
    expect(nextFocusIndex(0, 0)).toBe(-1);
  });

  it("Esc 的两种写法都认(老浏览器上叫 Esc)", () => {
    expect(isDismissKey("Escape")).toBe(true);
    expect(isDismissKey("Esc")).toBe(true);
    expect(isDismissKey("Enter")).toBe(false);
    expect(isDismissKey(undefined)).toBe(false);
  });

  it("弹出来就是 role=dialog + aria-modal,名字取自里面的标题", () => {
    const { handle } = openTestDialog(doc);
    expect(handle.el.getAttribute("role")).toBe("dialog");
    expect(handle.el.getAttribute("aria-modal")).toBe("true");
    const labelledBy = handle.el.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(doc.getElementById(labelledBy as string)?.textContent).toBe("先歇一会儿");
  });

  it("打开时焦点直接落到第一颗按钮,键盘用户不用先摸一圈", () => {
    const { buttons } = openTestDialog(doc);
    expect(buttons).toHaveLength(3);
    expect(doc.activeElement).toBe(buttons[0]);
  });

  it("Tab 在弹窗里转圈,转不出去", () => {
    const { buttons } = openTestDialog(doc);
    doc.press("Tab");
    expect(doc.activeElement).toBe(buttons[1]);
    doc.press("Tab");
    expect(doc.activeElement).toBe(buttons[2]);
    // 最后一颗再 Tab 回到第一颗,而不是跑到弹窗后面的页面上
    const e = doc.press("Tab");
    expect(doc.activeElement).toBe(buttons[0]);
    expect(e.defaultPrevented).toBe(true);
  });

  it("Shift+Tab 反着转,同样出不去", () => {
    const { buttons } = openTestDialog(doc);
    doc.press("Tab", { shiftKey: true });
    expect(doc.activeElement).toBe(buttons[2]);
    doc.press("Tab", { shiftKey: true });
    expect(doc.activeElement).toBe(buttons[1]);
  });

  it("Esc 关掉弹窗,焦点回到打开它的那个按钮", () => {
    const trigger = doc.createElement("button");
    doc.body.appendChild(trigger);
    trigger.focus();
    expect(doc.activeElement).toBe(trigger);

    let dismissed = 0;
    openTestDialog(doc, { onDismiss: () => dismissed++ });
    expect(doc.activeElement).not.toBe(trigger);

    const e = doc.press("Escape");
    expect(e.defaultPrevented).toBe(true);
    expect(dismissed).toBe(1);
    expect(doc.activeElement).toBe(trigger);
    // 关掉之后监听也摘干净,不留全局按键残留
    expect(doc.keydownCount()).toBe(0);
  });

  it("标明不可 Esc 关闭的弹窗,按 Esc 不动它", () => {
    let dismissed = 0;
    openTestDialog(doc, { escapable: false, onDismiss: () => dismissed++ });
    const e = doc.press("Escape");
    expect(e.defaultPrevented).toBe(false);
    expect(dismissed).toBe(0);
    expect(doc.keydownCount()).toBe(1);
  });

  it("点按钮也会关掉弹窗并把焦点还回去", () => {
    const trigger = doc.createElement("button");
    doc.body.appendChild(trigger);
    trigger.focus();
    const { buttons, picked } = openTestDialog(doc);
    buttons[1].fire("click");
    expect(picked).toEqual(["replay"]);
    expect(doc.activeElement).toBe(trigger);
    expect(doc.keydownCount()).toBe(0);
  });

  it("开关型按钮点了不关面板,aria-pressed 有初值", () => {
    const content = doc.createElement("div");
    let toggled = 0;
    const handle = showDialog({
      content: content as unknown as HTMLElement,
      label: "暂停",
      buttons: [
        { label: "🎵 音乐:开", pressed: true, keepOpen: true, onClick: () => toggled++ },
        { label: "回首页", onClick: () => undefined }
      ]
    }) as unknown as { el: FakeEl };
    const btns = handle.el.querySelectorAll(FOCUSABLE_SELECTOR);
    expect(btns[0].getAttribute("aria-pressed")).toBe("true");
    btns[0].fire("click");
    expect(toggled).toBe(1);
    // 没关:全局按键监听还在
    expect(doc.keydownCount()).toBe(1);
    expect(handle.el.getAttribute("aria-label")).toBe("暂停");
  });
});

describe("aria-live 播报区", () => {
  it("没有播报区时会自己补一个,并带齐 role/aria-live", () => {
    const doc = new FakeDoc();
    const region = liveRegion(doc as unknown as Document) as unknown as FakeEl;
    expect(region.id).toBe("a11y-live");
    expect(region.className).toBe("sr-only");
    expect(region.getAttribute("role")).toBe("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    // 第二次拿的是同一个,不会越堆越多
    expect(liveRegion(doc as unknown as Document)).toBe(region as unknown as HTMLElement);
  });

  it("连着播报同一句时补一个不可见空格,读屏软件才会再念一遍", () => {
    const doc = new FakeDoc();
    announce("过关啦", doc as unknown as Document);
    const region = liveRegion(doc as unknown as Document) as unknown as FakeEl;
    expect(region.textContent).toBe("过关啦");
    announce("过关啦", doc as unknown as Document);
    expect(region.textContent).toBe("过关啦\u00a0");
    announce("  ", doc as unknown as Document);
    expect(region.textContent).toBe("过关啦\u00a0");
  });
});
