/**
 * 萌猫小屋 · 矮舞台上也得够得着（窗口5 第1轮 档C 监督修复员）。
 *
 * 真机复审在 360×720 / 360×640 / 320×640 三档上都打不通第 1 关，挖到两条：
 *
 * - **W5-F-15 饭碗看不见也点不着**：`.ktc-bowl` 是 `position:absolute;bottom:4px`，
 *   贴的是整个 `.ktc-wrap` 的底；那儿正排着 `.ktc-tray` 和 `.ktc-msg`，两个都写着
 *   `z-index:3`，碗自己没有 z-index。截图里一个碗都看不见，
 *   `elementFromPoint(碗心)` 拿回来的是 `.ktc-drag` / `.ktc-msg`。
 *   舞台越矮压得越死：320×640 上拿起食物、提示行折成两行之后就彻底点不中。
 * - **W5-F-16 小屋比舞台高**：`.ktc-wrap{min-height:460px}` 加一只 296px 高的猫，
 *   撑到 488px；而 `.game-stage` 是 `overflow:hidden` 且定高的，360×640 上只露 304px。
 *   饭碗、托盘、提示行整片落在裁切线以下，`elementFromPoint` 一律 null。
 *
 * 这里守两层：CSS 里那几条不许再掉，`fitIntoStage()` 的「先收猫、收不下才滚」这个
 * 顺序不许倒过来（滚动容器一出现，拖食物的手指一动就连带滚屏，比小一点的猫难用得多）。
 */
import { describe, expect, it } from "vitest";

import { KTC_CSS } from "./styles";
import { CAT_FIT_STEPS, fitIntoStage, visibleRoomPx } from "./runtime";

/** 从 CSS 文本里抠出某个选择器的声明块（只找第一处） */
function ruleOf(selector: string): string {
  const at = KTC_CSS.indexOf(`\n${selector}{`);
  expect(at, `CSS 里没有 ${selector} 这条规则`).toBeGreaterThanOrEqual(0);
  const from = KTC_CSS.indexOf("{", at) + 1;
  const to = KTC_CSS.indexOf("}", from);
  return KTC_CSS.slice(from, to).replace(/\s+/g, "");
}

// ---------------------------------------------------------------------------
// 一个够 fitIntoStage 量的假元素：认得 style / classList / 祖先链 / scrollHeight
// ---------------------------------------------------------------------------

interface FakeStyle {
  maxHeight: string;
  overflowY: string;
  minHeight: string;
  setProperty(name: string, value: string): void;
  removeProperty(name: string): void;
}

/**
 * 假小屋。高度 = 除猫以外的固定开销 + 当前那一档猫的高度；
 * 没写过 `--ktc-cat-h` 就按最大那只算（真机上就是 296px 的原始猫）。
 */
function fakeWrap(opts: { top: number; clipBottom: number | null; chrome: number; bigCat: number }) {
  const vars = new Map<string, string>();
  const classes = new Set<string>();
  const listeners = new Map<string, Array<() => void>>();
  const style: FakeStyle = {
    maxHeight: "",
    overflowY: "",
    minHeight: "",
    setProperty(name, value) {
      vars.set(name, value);
    },
    removeProperty(name) {
      vars.delete(name);
    }
  };
  const view = {
    getComputedStyle: () => ({ overflowY: "hidden" }),
    addEventListener(type: string, fn: () => void) {
      const list = listeners.get(type) ?? [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn));
    }
  };
  const parent =
    opts.clipBottom === null
      ? null
      : { parentElement: null, getBoundingClientRect: () => ({ bottom: opts.clipBottom }) };
  const el = {
    vars,
    classList: {
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
      contains: (c: string) => classes.has(c)
    },
    style,
    ownerDocument: { defaultView: view },
    parentElement: parent,
    getBoundingClientRect: () => ({ top: opts.top }),
    get scrollHeight(): number {
      const cat = vars.get("--ktc-cat-h");
      const catPx = cat ? Number(cat.replace("px", "")) : opts.bigCat;
      return opts.chrome + catPx;
    },
    resizeListeners: () => (listeners.get("resize") ?? []).length
  };
  return el;
}

const fitIt = (el: unknown) => fitIntoStage(el as unknown as HTMLElement);

describe("萌猫小屋 · 饭碗看得见也点得着（W5-F-15）", () => {
  it("饭碗回到正常流里，不再贴 .ktc-wrap 的底跟托盘、提示行抢地方", () => {
    const rule = ruleOf(".ktc-bowl");
    expect(rule, "还贴着舞台底就会被 .ktc-tray / .ktc-msg 盖住").toContain("position:relative");
    expect(rule, ".ktc-target 的 bottom 得让开").toContain("bottom:auto");
    expect(rule, ".ktc-target 的 left:50% 得让开，不然会整块跑到右半边").toContain("left:auto");
    expect(rule, "居中靠 margin auto，不再靠 translateX").toContain("margin:2pxauto6px");
  });

  it("碗和托盘同住 .ktc-play，这一层得跟别的交互层一个规格", () => {
    const rule = ruleOf(".ktc-play");
    expect(rule).toContain("position:relative");
    expect(rule).toContain("z-index:3");
  });

  it("热区还是 ≥48px，回到正常流不许把碗缩小", () => {
    const rule = ruleOf(".ktc-target");
    expect(rule).toContain("width:64px");
    expect(rule).toContain("height:64px");
  });
});

describe("萌猫小屋 · 小屋收进舞台看得见的那一段（W5-F-16）", () => {
  it("visibleRoomPx：取最近那条裁切线；一条都没有就是无限", () => {
    expect(visibleRoomPx(100, [500, 420, 640])).toBe(320);
    expect(visibleRoomPx(100, [])).toBe(Number.POSITIVE_INFINITY);
    // 顶边已经在裁切线以下了，算出来是负的（调用方据此放弃）
    expect(visibleRoomPx(700, [640])).toBe(-60);
  });

  it("猫的档位从大到小、一档都不重复，最小那档也还看得清", () => {
    expect(CAT_FIT_STEPS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(CAT_FIT_STEPS).size).toBe(CAT_FIT_STEPS.length);
    for (let i = 1; i < CAT_FIT_STEPS.length; i++) expect(CAT_FIT_STEPS[i]).toBeLessThan(CAT_FIT_STEPS[i - 1]);
    expect(CAT_FIT_STEPS[CAT_FIT_STEPS.length - 1]).toBeGreaterThanOrEqual(88);
  });

  it("装得下就一个字都不写——高屏上不许凭空多出一个滚动容器", () => {
    // 390×844：小屋顶边 326，裁切线 830，够 504；内容 488
    const el = fakeWrap({ top: 326, clipBottom: 830, chrome: 192, bigCat: 296 });
    fitIt(el);
    expect(el.classList.contains("ktc-fit")).toBe(false);
    expect(el.style.overflowY).toBe("");
    expect(el.style.maxHeight).toBe("");
    expect(el.style.minHeight).toBe("");
    expect(el.vars.has("--ktc-cat-h")).toBe(false);
  });

  it("装不下先收猫，收到装得下就停手，不加滚动条", () => {
    // 360×640：小屋顶边 322，裁切线 626，只够 304；内容 488
    const el = fakeWrap({ top: 322, clipBottom: 626, chrome: 192, bigCat: 296 });
    fitIt(el);
    expect(el.classList.contains("ktc-fit"), "该收猫的时候没挂 ktc-fit").toBe(true);
    expect(el.style.overflowY, "猫收得下就不该出滚动条").toBe("");
    expect(el.style.maxHeight).toBe("");
    // min-height:460px 会盖过一切，收之前必须先让开
    expect(el.style.minHeight).toBe("0");
    const cat = Number((el.vars.get("--ktc-cat-h") ?? "").replace("px", ""));
    expect(CAT_FIT_STEPS as readonly number[]).toContain(cat);
    expect(192 + cat, "收完还是装不下").toBeLessThanOrEqual(304 + 1);
    // 只退到刚够的那一档，不许一步退到最小
    const prev = CAT_FIT_STEPS[CAT_FIT_STEPS.indexOf(cat as (typeof CAT_FIT_STEPS)[number]) - 1];
    if (prev !== undefined) expect(192 + prev).toBeGreaterThan(304 + 1);
  });

  it("猫收到最小还是装不下，才让小屋自己滚", () => {
    // 搓澡区 240px 打底的多猫关：除猫以外就吃掉 300px
    const el = fakeWrap({ top: 322, clipBottom: 560, chrome: 300, bigCat: 296 });
    fitIt(el);
    expect(el.classList.contains("ktc-fit")).toBe(true);
    expect(el.style.overflowY, "兜底的滚动没兜住").toBe("auto");
    expect(el.style.maxHeight).toBe("238px");
    expect(el.style.minHeight).toBe("0");
  });

  it("重新量一次要先还原，不然越量越小", () => {
    const el = fakeWrap({ top: 322, clipBottom: 626, chrome: 192, bigCat: 296 });
    const fit = fitIt(el);
    const first = el.vars.get("--ktc-cat-h");
    fit.relayout();
    fit.relayout();
    expect(el.vars.get("--ktc-cat-h"), "反复量出来的档位应当一样").toBe(first);
  });

  it("没有裁切祖先就什么都不做（相册页那种能自己滚的地方）", () => {
    const el = fakeWrap({ top: 0, clipBottom: null, chrome: 192, bigCat: 296 });
    fitIt(el);
    expect(el.classList.contains("ktc-fit")).toBe(false);
    expect(el.style.overflowY).toBe("");
  });

  it("dispose 之后 resize 监听归零，写过的内联样式也还回去", () => {
    const el = fakeWrap({ top: 322, clipBottom: 626, chrome: 192, bigCat: 296 });
    const fit = fitIt(el);
    expect(el.resizeListeners()).toBe(1);
    fit.dispose();
    expect(el.resizeListeners(), "destroy 之后还挂着 resize 监听").toBe(0);
    expect(el.vars.has("--ktc-cat-h")).toBe(false);
    expect(el.style.minHeight).toBe("");
    expect(el.style.overflowY).toBe("");
  });

  it("收猫那条规则写在 .ktc-hasfield 后面——同权重时它得说了算", () => {
    const fit = KTC_CSS.indexOf(".ktc-wrap.ktc-fit .ktc-cat-svg{");
    const hasfield = KTC_CSS.indexOf(".ktc-wrap.ktc-hasfield .ktc-cat-svg{");
    expect(hasfield).toBeGreaterThanOrEqual(0);
    expect(fit, "收猫的规则排在 .ktc-hasfield 前面就会被它盖掉").toBeGreaterThan(hasfield);
    const rule = ruleOf(".ktc-wrap.ktc-fit .ktc-cat-svg");
    expect(rule).toContain("height:var(--ktc-cat-h)");
    expect(rule, "只改高度不改宽度会把猫压扁").toContain("width:auto");
  });
});
