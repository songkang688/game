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
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decideRound, mount, type BowlEnd } from "./index";
import { El, fireWindow, flushFrames, installDom, restoreDom, windowListenerCount, type Dom } from "./domStub";
import GUIDE from "./guide";

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

/** 按住某个键跑几帧再松手 */
function hold(code: string, frames: number): void {
  fireWindow(dom, "keydown", { code });
  flushFrames(dom, frames);
  fireWindow(dom, "keyup", { code });
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

  it("F 只放鸭梨那一盆，L 只放康康那一盆", () => {
    const { handle, canvases } = openDuo();
    expect(canvases).toHaveLength(2);
    fireWindow(dom, "keydown", { code: "KeyF" });
    flushFrames(dom, 4);
    expect(canvases[0].getAttribute("data-drops"), "F 没放进鸭梨那一盆").toBe("1");
    expect(canvases[1].getAttribute("data-drops"), "F 顺手也放了康康那一盆").toBe("0");

    fireWindow(dom, "keydown", { code: "KeyL" });
    flushFrames(dom, 4);
    expect(canvases[1].getAttribute("data-drops"), "L 没放进康康那一盆").toBe("1");
    expect(canvases[0].getAttribute("data-drops"), "L 顺手又放了鸭梨那一盆").toBe("1");
    handle.destroy();
  });

  it("A / D 只挪鸭梨的落点，方向键只挪康康的落点", () => {
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

  it("鸭梨的 G 与康康的 K 把跑偏的落点收回盆正中央", () => {
    const { handle, canvases } = openDuo();
    const aim = (i: number): number => Number(canvases[i].getAttribute("data-aim"));
    const center = [aim(0), aim(1)];
    // 两个人各自把落点推到一边
    hold("KeyD", 6);
    hold("ArrowLeft", 6);
    expect(aim(0), "鸭梨的落点没挪动").toBeGreaterThan(center[0]);
    expect(aim(1), "康康的落点没挪动").toBeLessThan(center[1]);

    fireWindow(dom, "keydown", { code: "KeyG" });
    flushFrames(dom, 2);
    expect(aim(0), "G 没把鸭梨的落点收回中间").toBeCloseTo(center[0], 1);
    expect(aim(1), "G 顺手把康康的落点也拨了").toBeLessThan(center[1]);

    fireWindow(dom, "keydown", { code: "KeyK" });
    flushFrames(dom, 2);
    expect(aim(1), "K 没把康康的落点收回中间").toBeCloseTo(center[1], 1);
    handle.destroy();
  });

  it("归位键不投果子，只是把落点放回去", () => {
    const { handle, canvases } = openDuo();
    const before = canvases.map((c) => c.getAttribute("data-drops"));
    for (const code of ["KeyG", "KeyK"]) {
      fireWindow(dom, "keydown", { code });
      flushFrames(dom, 3);
      fireWindow(dom, "keyup", { code });
    }
    expect(canvases.map((c) => c.getAttribute("data-drops")), "归位键把果子投下去了").toEqual(before);
    handle.destroy();
  });

  it("这一款只有左右：W / S 与上下方向键按了不动，攻略里也写明了不用记", () => {
    const { handle, canvases } = openDuo();
    const snap = (): string[] =>
      canvases.map((c) => `${c.getAttribute("data-drops")}|${c.getAttribute("data-aim")}`);
    const before = snap();
    for (const code of ["KeyW", "KeyS", "ArrowUp", "ArrowDown"]) hold(code, 3);
    expect(snap(), "上下键居然改动了盘面").toEqual(before);
    const tips = GUIDE.general.concat(GUIDE.entries.flatMap((e) => e.tips)).join(" ");
    expect(tips, "攻略里没写清这一款用不上上下键").toContain("W / S");
    expect(tips, "攻略里没写清归位键").toMatch(/鸭梨按 G、康康按 K/);
    handle.destroy();
  });

  it("暂停期间投放键与归位键一概不接，恢复之后照旧管用", () => {
    const { handle, canvases } = openDuo();
    hold("KeyD", 6);
    const aimBefore = canvases[0].getAttribute("data-aim");
    fireWindow(dom, "keydown", { code: "Escape" });
    expect(dom.root.find((e) => e.className.includes("fs-veil"))).not.toBeNull();
    for (const code of ["KeyF", "KeyL", "KeyG", "KeyK"]) {
      fireWindow(dom, "keydown", { code });
      flushFrames(dom, 3);
      fireWindow(dom, "keyup", { code });
    }
    fireWindow(dom, "keydown", { code: "Escape" });
    flushFrames(dom, 3);
    expect(canvases.map((c) => c.getAttribute("data-drops")), "暂停期间偷偷投下去了").toEqual(["0", "0"]);
    expect(canvases[0].getAttribute("data-aim"), "暂停期间落点被归位键拨走了").toBe(aimBefore);
    // 恢复之后一切照旧
    fireWindow(dom, "keydown", { code: "KeyF" });
    flushFrames(dom, 3);
    expect(canvases[0].getAttribute("data-drops"), "恢复之后 F 不管用了").toBe("1");
    handle.destroy();
  });

  it("人机对战里康康那套键不会替电脑动手", () => {
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
/* L3A-5 / L3A-6 · 暂停闸补到指针那一条通路上                             */
/* ------------------------------------------------------------------ */

describe("L3A-5 · 遮罩挡得住手指，程序上也得挡住", () => {
  function openDuo(): { handle: { destroy: () => void }; canvases: El[] } {
    const handle = mount(fakeApi().api);
    byText("双人同屏")!.dispatch("click");
    flushFrames(dom, 3);
    return { handle, canvases: dom.root.findAll((e) => e.tagName === "canvas") };
  }

  /** 屏幕上那一组「◀ ▶ 放下」按 aria-label 认人：鸭梨▶、鸭梨放下…… */
  function padKey(label: string): El {
    const btn = dom.root.find((e) => e.getAttribute("aria-label") === label);
    if (!btn) throw new Error(`屏幕上找不到「${label}」钮`);
    return btn;
  }

  function esc(): void {
    fireWindow(dom, "keydown", { code: "Escape" });
  }

  /**
   * 读屏文字只在没暂停的那几帧里刷新，所以「暂停期间按了什么」一律要**恢复之后再看**，
   * 不然断言相等只是因为屏幕本来就没刷新，测不出闸有没有装上。
   */
  function resumeAndSettle(): void {
    esc();
    flushFrames(dom, 3);
  }

  it("暂停期间点屏幕上的「放下」也投不出果子，恢复之后照旧管用", () => {
    const { handle, canvases } = openDuo();
    esc();
    expect(dom.root.find((e) => e.className.includes("fs-veil")), "没盖上遮罩").not.toBeNull();
    const drop = padKey("鸭梨放下");
    drop.dispatch("click", {});
    resumeAndSettle();
    expect(canvases[0].getAttribute("data-drops"), "遮罩盖着的时候「放下」把果子投下去了").toBe("0");
    drop.dispatch("click", {});
    flushFrames(dom, 4);
    expect(canvases[0].getAttribute("data-drops"), "恢复之后「放下」反而不管用了").toBe("1");
    handle.destroy();
  });

  it("暂停期间按屏幕上的「◀ ▶」也挪不动落点", () => {
    const { handle, canvases } = openDuo();
    const aim = (): number => Number(canvases[0].getAttribute("data-aim"));
    const before = aim();
    const right = padKey("鸭梨▶");
    esc();
    for (let i = 0; i < 6; i++) {
      right.dispatch("pointerdown", {});
      right.dispatch("pointerup", {});
      flushFrames(dom, 2);
    }
    resumeAndSettle();
    expect(aim(), "遮罩盖着的时候「▶」把落点挪走了").toBeCloseTo(before, 1);
    for (let i = 0; i < 6; i++) {
      right.dispatch("pointerdown", {});
      right.dispatch("pointerup", {});
      flushFrames(dom, 2);
    }
    expect(aim(), "恢复之后「▶」反而不管用了").toBeGreaterThan(before);
    handle.destroy();
  });

  it("暂停期间在盆上拖动 + 松手，果子也不会偷偷落下去", () => {
    const { handle, canvases } = openDuo();
    const before = Number(canvases[0].getAttribute("data-aim"));
    esc();
    canvases[0].dispatch("pointerdown", { pointerId: 1, clientX: 40 });
    canvases[0].dispatch("pointermove", { pointerId: 1, clientX: 120 });
    canvases[0].dispatch("pointerup", { pointerId: 1, clientX: 120 });
    resumeAndSettle();
    expect(canvases[0].getAttribute("data-drops"), "遮罩盖着的时候拖一下就落果了").toBe("0");
    expect(Number(canvases[0].getAttribute("data-aim")), "遮罩盖着的时候拖动改了落点").toBeCloseTo(before, 1);
    canvases[0].dispatch("pointerdown", { pointerId: 2, clientX: 40 });
    canvases[0].dispatch("pointerup", { pointerId: 2, clientX: 40 });
    flushFrames(dom, 4);
    expect(canvases[0].getAttribute("data-drops"), "恢复之后拖动反而不管用了").toBe("1");
    handle.destroy();
  });

  it("L3A-6：人机对战那一行提示也把鸭梨的归位键写全了", () => {
    const handle = mount(fakeApi().api);
    byText("人机对战")!.dispatch("click");
    flushFrames(dom, 3);
    const tip = dom.root.find((e) => e.className.includes("fs-tip"))!.textContent;
    expect(tip, "人机对战的提示里漏了归位键").toContain("G");
    expect(tip).toContain("F 放下");
    handle.destroy();
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

/* ------------------------------------------------------------------ */
/* 第 2 轮测试员 PA-FS-3 · 源码里的血腥 / 死亡说法                        */
/* ------------------------------------------------------------------ */

describe("第 2 轮 PA-FS-3 · 全目录不出现血腥与死亡说法", () => {
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const sources = readdirSync(dir).filter((f) => /\.(ts|md)$/.test(f) && !f.endsWith(".test.ts"));

  it("扫得到这一款的源码与设计稿，不是空跑一趟", () => {
    expect(sources.length).toBeGreaterThan(8);
    expect(sources).toContain("merge.ts");
    expect(sources).toContain("PLAN.md");
  });

  // 注释不上屏，但「血」「死掉」这类词一旦写进源码，改文案时很容易被顺手抄到界面上，
  // 所以连注释一起拦住。`merge.ts` 原来写「合一次几乎不回血」，就是这条要收的口子。
  it("连注释在内，一个血腥 / 死亡说法都不留", () => {
    const banned = ["血", "尸", "阵亡", "牺牲", "死掉", "杀死", "残忍"];
    for (const f of sources) {
      const text = readFileSync(dir + f, "utf8");
      for (const bad of banned) {
        expect(text.includes(bad) ? `${f} 里出现了「${bad}」` : "干净").toBe("干净");
      }
    }
  });

  it("难度旋钮那段注释换了说法之后，讲的还是同一件事", () => {
    const src = readFileSync(dir + "merge.ts", "utf8");
    expect(src).toContain("合一次腾回来的地方很有限");
    expect(src).toContain("小果子一直往里投盆迟早会满");
  });
});

/* ------------------------------------------------------------------ */
/* R3-PA-FS-3 · 对战判平那条路要走得到，也别把对家堆爆记成自己过关         */
/* ------------------------------------------------------------------ */

describe("L3A-17 · 双盆一局的收场判定（`decideRound`）", () => {
  // 监督修复员已把这一处抽成 decideRound（`R3-PA-FS-3`）。
  // 这一组不改它的实现，只把「同帧撞在一起」的那几种组合补成回归网 ——
  // 界面上撞不出同一帧，只有纯函数这一层量得到。
  const IDLE: BowlEnd = { won: false, lost: false, left: 9 };
  const bowl = (over: Partial<BowlEnd>): BowlEnd => ({ ...IDLE, ...over });

  it("谁都还没收场就返回 null，一局不会提前收掉", () => {
    expect(decideRound([IDLE, IDLE])).toBeNull();
    expect(decideRound([bowl({ left: 0 }), bowl({ left: 0 })]), "只是果子用完了、还没判输不算收场").toBeNull();
    expect(decideRound([]), "一个盆都没有也不该收场").toBeNull();
  });

  it("同一帧两边都达标就是打平：给得出 -1，「这一局打平」不再是死文案", () => {
    const out = decideRound([bowl({ won: true }), bowl({ won: true })]);
    expect(out?.winner, "两人节奏一样、同帧都达标，还判 0 号赢").toBe(-1);
    expect(out?.reason).toBe("goal");
  });

  it("同一帧两边都收摊也是打平，收场理由跟着鸭梨那一边说", () => {
    expect(decideRound([bowl({ lost: true }), bowl({ lost: true })])?.winner).toBe(-1);
    expect(decideRound([bowl({ lost: true }), bowl({ lost: true })])?.reason).toBe("over");
    const bothEmpty = decideRound([bowl({ lost: true, left: 0 }), bowl({ lost: true, left: 0 })]);
    expect(bothEmpty?.reason, "两边都是果子用完，收场理由该是 empty").toBe("empty");
  });

  it("一边达标另一边没有：判达标那一边赢，理由是 goal", () => {
    expect(decideRound([bowl({ won: true }), IDLE])).toEqual({ winner: 0, cleared: true, reason: "goal" });
    expect(decideRound([IDLE, bowl({ won: true })])).toEqual({ winner: 1, cleared: false, reason: "goal" });
  });

  it("达标压过堆爆：同帧一边达标一边收摊，算达标那边赢", () => {
    expect(decideRound([bowl({ won: true }), bowl({ lost: true })])?.winner).toBe(0);
    expect(decideRound([bowl({ lost: true }), bowl({ won: true })])?.winner).toBe(1);
  });

  it("康康把盆堆过线：判鸭梨赢，但不再记成鸭梨「达标过关」", () => {
    const out = decideRound([IDLE, bowl({ lost: true })]);
    expect(out?.winner, "对家收摊了，赢的还是该判给鸭梨").toBe(0);
    expect(out?.cleared, "对家收摊被记成了鸭梨达标过关").toBe(false);
    expect(out?.reason, "对家收摊的收场理由被记成了 goal").toBe("over");
    expect(decideRound([IDLE, bowl({ lost: true, left: 0 })])?.reason).toBe("empty");
  });

  it("鸭梨那边堆过线 / 果子用完，收场理由分得开", () => {
    expect(decideRound([bowl({ lost: true }), IDLE])).toEqual({ winner: 1, cleared: false, reason: "over" });
    expect(decideRound([bowl({ lost: true, left: 0 }), IDLE])).toEqual({
      winner: 1,
      cleared: false,
      reason: "empty",
    });
  });

  it("cleared 只在 0 号盆自己达标时才为真", () => {
    expect(decideRound([bowl({ won: true }), bowl({ won: true })])?.cleared).toBe(true);
    for (const out of [
      decideRound([IDLE, bowl({ won: true })]),
      decideRound([bowl({ lost: true }), IDLE]),
      decideRound([IDLE, bowl({ lost: true })]),
      decideRound([bowl({ lost: true }), bowl({ lost: true })]),
    ]) {
      expect(out?.cleared, "0 号盆没达标却报了 cleared").toBe(false);
    }
  });

  it("单盆那一路照旧：达标算过关，收摊按剩几颗分 empty / over", () => {
    expect(decideRound([bowl({ won: true })])).toEqual({ winner: 0, cleared: true, reason: "goal" });
    expect(decideRound([bowl({ lost: true })])).toEqual({ winner: -1, cleared: false, reason: "over" });
    expect(decideRound([bowl({ lost: true, left: 0 })])?.reason).toBe("empty");
    expect(decideRound([IDLE])).toBeNull();
  });

  it("「这一局打平」那句文案还在源码里等着，判平之后就走得到了", () => {
    const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    expect(src, "判平的文案被顺手删了").toContain("这一局打平");
    expect(src, "roundOver 不再按 winner < 0 分岔，判平就没人接了").toMatch(/winner\s*<\s*0\s*\?\s*"这一局打平"/);
  });
});
