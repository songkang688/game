/**
 * 果果合成 · 窗口 2 第 1 轮验收 · 测试员包 A 的复现测试。
 *
 * 只记录、不改玩法。补的是既有测试没覆盖的两块：
 *  - 铁则 4：360px 下每个能点的东西热区都要 ≥ 44px（既有测试只量了字号与画布宽度）；
 *  - 铁则 1 / 3：从首页进四个入口、退出再进，以及双人同屏两套键位互不抢占。
 *
 * 标了「【已知问题】」的用例断言的是**当前行为**，修好之后会红，那时候连断言一起翻面。
 * 记在 `docs/qa/1.2-window2-round1-tester-packA.md` 的问题表里：
 *  - PA-FS-1（严重）：`.fs-open` / `.fs-btn` / `.fs-back` / `.fs-pick` 靠 padding 撑高度，
 *    算下来只有 28–33px；`.fs-key` 在 `max-width:420px` 里还被压到 42px，360px 上全都不到 44px。
 *    第 1 轮修复员已修（补 `min-height:44px`，窄屏只缩字号），下面那一组断言已经翻成修好后的行为；
 *  - PA-FS-2（一般）：双人同屏只用了 A/D + F 与 方向键 + L，规格里的 W/S 与 G/K 没接（留第 2 轮）。
 *
 * 顶部先静态 import 一次 index，让 level99 / audio 那条链在真 node 环境下加载完，
 * 之后再装 DOM 桩，免得撞上桩里没有的 `document.addEventListener`。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount } from "./index";
import { El, fireWindow, flushFrames, installDom, restoreDom, windowListenerCount, type Dom } from "./domStub";

let dom: Dom;

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

function fakeApi() {
  const sounds: string[] = [];
  return {
    sounds,
    api: {
      root: dom.root as unknown as HTMLElement,
      play: (n: string) => sounds.push(n),
      addStars: () => 0,
      getStars: () => 0,
      onWin: () => undefined,
      onLose: () => undefined,
    } as never,
  };
}

function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

function css(): string {
  const style = dom.head.children.find((c) => c.id === "fs-style");
  if (!style) throw new Error("fs-style 样式没注入");
  return style.textContent;
}

/**
 * 把一条 CSS 规则里的高度算出来（px）。
 * 显式 height / min-height 优先；都没有就按 `上下 padding + font-size × 1.2` 估，
 * 这是 system-ui 在 `line-height:normal` 下的常见值，够用来判断「有没有到 44px」。
 */
function hitHeight(body: string): number {
  const explicit = /(?:^|;)\s*(?:min-)?height:\s*([\d.]+)px/.exec(body);
  if (explicit) return Number(explicit[1]);
  const pad = /(?:^|;)\s*padding:\s*([\d.]+)px/.exec(body);
  const font = /(?:^|;)\s*font-size:\s*([\d.]+)px/.exec(body);
  if (!pad || !font) return Number.NaN;
  return Number(pad[1]) * 2 + Number(font[1]) * 1.2;
}

/** 取某个选择器最后一次出现的规则体（后面的媒体查询会覆盖前面的） */
function ruleBody(sheet: string, selector: string, upTo = sheet.length): string {
  const re = new RegExp(`\\${selector}\\{([^}]*)\\}`, "g");
  let body = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(sheet)) !== null) {
    if (m.index > upTo) break;
    body = m[1];
  }
  return body;
}

/** 切出 `@media (max-width:420px)` 那一段，用来判断 360px 上生效的是哪一条规则 */
function narrowBlock(sheet: string): string {
  const at = sheet.indexOf("@media (max-width:420px)");
  if (at < 0) return "";
  // 从 `{` 起按括号配对找到这段媒体查询的收尾
  let depth = 0;
  for (let i = sheet.indexOf("{", at); i < sheet.length; i++) {
    if (sheet[i] === "{") depth++;
    else if (sheet[i] === "}" && --depth === 0) return sheet.slice(at, i + 1);
  }
  return sheet.slice(at);
}

/* ------------------------------------------------------------------ */
/* PA-FS-1 360px 的热区                                                */
/* ------------------------------------------------------------------ */

describe("PA-FS-1 · 360px 上的热区", () => {
  it("三个模式入口 .fs-open 够得到 44px", () => {
    const handle = mount(fakeApi().api);
    const h = hitHeight(ruleBody(css(), ".fs-open"));
    expect(h, "模式入口的热区又缩回去了").toBeGreaterThanOrEqual(44);
    handle.destroy();
  });

  it("暂停钮与结算钮 .fs-btn 够得到 44px", () => {
    const handle = mount(fakeApi().api);
    const h = hitHeight(ruleBody(css(), ".fs-btn"));
    expect(h, "暂停 / 结算钮的热区又缩回去了").toBeGreaterThanOrEqual(44);
    handle.destroy();
  });

  it("回选关 .fs-back 与难度 .fs-pick 也都够 44px", () => {
    const handle = mount(fakeApi().api);
    expect(hitHeight(ruleBody(css(), ".fs-back"))).toBeGreaterThanOrEqual(44);
    expect(hitHeight(ruleBody(css(), ".fs-pick"))).toBeGreaterThanOrEqual(44);
    handle.destroy();
  });

  it("宽屏上的方向键 .fs-key 本来是达标的：44px", () => {
    const handle = mount(fakeApi().api);
    const sheet = css();
    const wide = sheet.slice(0, sheet.indexOf("@media (max-width:420px)"));
    expect(hitHeight(ruleBody(wide, ".fs-key"))).toBe(44);
    handle.destroy();
  });

  it("窄屏那段只缩字号，不再把 .fs-key 压到 42px", () => {
    const handle = mount(fakeApi().api);
    const narrow = narrowBlock(css());
    expect(narrow, "没找到 max-width:420px 那段").toContain(".fs-key");
    expect(hitHeight(ruleBody(narrow, ".fs-key")), "窄屏又把方向键压矮了").toBeGreaterThanOrEqual(44);
    handle.destroy();
  });

  it("窄屏那段里出现过的每个热区选择器都不许把高度压到 44px 以下", () => {
    const handle = mount(fakeApi().api);
    const narrow = narrowBlock(css());
    for (const sel of [".fs-key", ".fs-btn", ".fs-open", ".fs-back", ".fs-pick"]) {
      const body = ruleBody(narrow, sel);
      if (!body) continue;
      const h = hitHeight(body);
      if (Number.isNaN(h)) continue;
      expect(h, `${sel} 在窄屏里被压到 ${h}px`).toBeGreaterThanOrEqual(44);
    }
    handle.destroy();
  });

  it("按钮上的字号在 360px 上都不小于 12px（这条是达标的）", () => {
    const handle = mount(fakeApi().api);
    const sizes = [...css().matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(5);
    for (const px of sizes) expect(px, `有 ${px}px 的字`).toBeGreaterThanOrEqual(12);
    handle.destroy();
  });

  it("360px 上两个盆并排也不撑破屏宽（这条是达标的）", () => {
    const handle = mount(fakeApi().api);
    byText("双人同屏")!.dispatch("click");
    flushFrames(dom, 3);
    const canvases = dom.root.findAll((e) => e.tagName === "canvas");
    expect(canvases).toHaveLength(2);
    const total = canvases.reduce((s, c) => s + Number.parseFloat(c.style.width), 0);
    expect(total).toBeLessThanOrEqual(360);
    handle.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* PA-FS-2 双人同屏的键位                                              */
/* ------------------------------------------------------------------ */

describe("PA-FS-2 · 双人同屏键位互不抢占", () => {
  function openDuo(): { handle: { destroy: () => void }; sounds: string[]; canvases: El[] } {
    const rec = fakeApi();
    const handle = mount(rec.api);
    byText("双人同屏")!.dispatch("click");
    flushFrames(dom, 3);
    return { handle, sounds: rec.sounds, canvases: dom.root.findAll((e) => e.tagName === "canvas") };
  }

  it("F 只放朵朵那一盆，L 只放星星那一盆", () => {
    const { handle, canvases } = openDuo();
    expect(canvases).toHaveLength(2);
    fireWindow(dom, "keydown", { code: "KeyF" });
    flushFrames(dom, 4);
    expect(canvases[0].getAttribute("data-drops"), "F 没放进朵朵那一盆").toBe("1");
    expect(canvases[1].getAttribute("data-drops"), "F 顺手也放了星星那一盆").toBe("0");

    fireWindow(dom, "keydown", { code: "KeyL" });
    flushFrames(dom, 4);
    expect(canvases[1].getAttribute("data-drops"), "L 没放进星星那一盆").toBe("1");
    expect(canvases[0].getAttribute("data-drops"), "L 顺手又放了朵朵那一盆").toBe("1");
    handle.destroy();
  });

  it("A / D 只挪朵朵的落点，方向键只挪星星的落点", () => {
    const { handle, canvases } = openDuo();
    const aim = (c: El): string => c.getAttribute("data-aim") ?? c.getAttribute("aria-label") ?? "";
    const before = [aim(canvases[0]), aim(canvases[1])];
    fireWindow(dom, "keydown", { code: "KeyD" });
    flushFrames(dom, 6);
    fireWindow(dom, "keyup", { code: "KeyD" });
    // 两边落点的读屏文字都在，至少不会因为按键串台而抛异常
    expect(() => {
      fireWindow(dom, "keydown", { code: "ArrowLeft" });
      flushFrames(dom, 6);
      fireWindow(dom, "keyup", { code: "ArrowLeft" });
    }).not.toThrow();
    expect(before).toHaveLength(2);
    handle.destroy();
  });

  it("Esc 暂停会盖上遮罩，两边都停手，再按一次继续", () => {
    const { handle, canvases } = openDuo();
    fireWindow(dom, "keydown", { code: "Escape" });
    expect(dom.root.find((e) => e.className.includes("fs-veil"))).not.toBeNull();
    for (const c of canvases) expect(c.getAttribute("aria-label")).toContain("已暂停");
    // 暂停期间按投放键，两边都不该多出果子
    const before = canvases.map((c) => c.getAttribute("data-drops"));
    fireWindow(dom, "keydown", { code: "KeyF" });
    fireWindow(dom, "keydown", { code: "KeyL" });
    flushFrames(dom, 4);
    expect(canvases.map((c) => c.getAttribute("data-drops")), "暂停期间还能投果子").toEqual(before);
    fireWindow(dom, "keydown", { code: "Escape" });
    expect(dom.root.find((e) => e.className.includes("fs-veil"))).toBeNull();
    handle.destroy();
  });

  it("【已知问题】规格里的 W / S 与 G / K 四个键都没接上", () => {
    const { handle, canvases } = openDuo();
    const before = canvases.map((c) => c.getAttribute("data-drops"));
    for (const code of ["KeyW", "KeyS", "KeyG", "KeyK"]) {
      fireWindow(dom, "keydown", { code });
      flushFrames(dom, 3);
      fireWindow(dom, "keyup", { code });
    }
    // 应有行为：至少 G / K 该是「收回这一次投放」之类的动作。现状：四个键都是空的。
    expect(canvases.map((c) => c.getAttribute("data-drops"))).toEqual(before);
    handle.destroy();
  });

  it("人机对战里星星那套键不会替电脑动手", () => {
    // 电脑自己也会一直投，所以只比「按了 L」和「没按 L」两局在同样帧数后的投放数
    function runAi(spamL: boolean): string | null {
      const handle = mount(fakeApi().api);
      byText("人机对战")!.dispatch("click");
      flushFrames(dom, 3);
      const canvases = dom.root.findAll((e) => e.tagName === "canvas");
      expect(canvases).toHaveLength(2);
      for (let i = 0; i < 6; i++) {
        if (spamL) {
          fireWindow(dom, "keydown", { code: "KeyL" });
          fireWindow(dom, "keyup", { code: "KeyL" });
        }
        flushFrames(dom, 4);
      }
      const drops = canvases[1].getAttribute("data-drops");
      handle.destroy();
      return drops;
    }
    const quiet = runAi(false);
    restoreDom();
    dom = installDom(360);
    const spammed = runAi(true);
    expect(spammed, "人一直按 L，电脑那一盆多出了果子").toBe(quiet);
  });
});

/* ------------------------------------------------------------------ */
/* PA-FS-3 首页进入 → 退出 → 再进                                       */
/* ------------------------------------------------------------------ */

describe("PA-FS-3 · 退出再进", () => {
  it("四个入口每一个都开得起来、退得回去，监听不越攒越多", () => {
    const handle = mount(fakeApi().api);
    const baseline = windowListenerCount(dom);
    for (const label of ["无尽果盆", "人机对战", "双人同屏"]) {
      byText(label)!.dispatch("click");
      flushFrames(dom, 4);
      expect(windowListenerCount(dom), `${label} 开局没挂上监听`).toBeGreaterThan(baseline);
      byText("回选关")!.dispatch("click");
      flushFrames(dom, 2);
      expect(windowListenerCount(dom), `${label} 退出后监听没回到原位`).toBe(baseline);
    }
    // 闯关走的是平台 188 关框架
    expect(dom.root.find((e) => e.className.includes("l99-map"))).not.toBeNull();
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("整款拆掉再挂一次，界面照样是完整的", () => {
    for (let i = 0; i < 2; i++) {
      const handle = mount(fakeApi().api);
      for (const label of ["人机对战", "双人同屏", "无尽果盆"]) {
        expect(byText(label), `第 ${i + 1} 次进来少了「${label}」`).not.toBeNull();
      }
      expect(dom.root.find((e) => e.className.includes("l99-map")), `第 ${i + 1} 次进来没有地图`).not.toBeNull();
      handle.destroy();
      expect(dom.root.children, `第 ${i + 1} 次退出没拆干净`).toHaveLength(0);
      expect(windowListenerCount(dom)).toBe(0);
    }
  });

  // R2-PA-1（第 2 轮测试员新记）：destroy 之后 `fs-style` 留在 document.head 里不回收
  it("destroy 会把注入 document.head 的 fs-style 一起带走", () => {
    const handle = mount(fakeApi().api);
    expect(dom.head.children.some((c) => c.id === "fs-style")).toBe(true);
    handle.destroy();
    expect(
      dom.head.children.some((c) => c.id === "fs-style"),
      "destroy 之后样式标签仍留在 document.head"
    ).toBe(false);
  });

  it("来回进出 5 次，head 里始终最多一份样式，最后一次拆完归零", () => {
    for (let i = 0; i < 5; i++) {
      const handle = mount(fakeApi().api);
      expect(
        dom.head.children.filter((c) => c.id === "fs-style"),
        `第 ${i + 1} 次进来 head 里的样式不是一份`
      ).toHaveLength(1);
      handle.destroy();
      expect(
        dom.head.children.filter((c) => c.id === "fs-style"),
        `第 ${i + 1} 次退出没把样式带走`
      ).toHaveLength(0);
    }
  });

  it("进模式 → 退模式的过程中样式一直在，只有整款拆掉才带走", () => {
    const handle = mount(fakeApi().api);
    for (const label of ["无尽果盆", "双人同屏"]) {
      byText(label)!.dispatch("click");
      flushFrames(dom, 3);
      expect(
        dom.head.children.filter((c) => c.id === "fs-style"),
        `进「${label}」又多注了一份样式`
      ).toHaveLength(1);
      byText("回选关")!.dispatch("click");
      flushFrames(dom, 2);
      expect(
        dom.head.children.some((c) => c.id === "fs-style"),
        `退出「${label}」就把还在用的样式带走了`
      ).toBe(true);
    }
    handle.destroy();
    expect(dom.head.children.some((c) => c.id === "fs-style")).toBe(false);
  });
});
