/**
 * 花色接龙 · 前端接线回归。
 *
 * 规格第十六节要「四种模式可玩」「destroy 干净」「360px 手牌可滑、按钮 ≥44px」,
 * 测试环境是 node,所以用自带的 `domStub.ts`:window 监听、定时器、DOM 节点都数得出来。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import {
  El,
  advance,
  fireWindow,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
} from "./domStub";
import { cardWidthFor, meta, mount } from "./index";

let dom: Dom;

interface Recorder {
  api: GameApi;
  sounds: string[];
  wins: number;
  loses: number;
}

function fakeApi(root: El): Recorder {
  const rec: Recorder = { api: null as unknown as GameApi, sounds: [], wins: 0, loses: 0 };
  rec.api = {
    root: root as unknown as HTMLElement,
    play: (name: string) => rec.sounds.push(name),
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => {
      rec.wins += 1;
    },
    onLose: () => {
      rec.loses += 1;
    },
  } as unknown as GameApi;
  return rec;
}

/** 找到写着这段字的那个按钮(find 是先序,直接用会捞到外层容器) */
function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

function handCards(): El[] {
  const hand = dom.root.querySelector(".hh-hand");
  return hand ? hand.children.filter((c) => c.className.includes("hh-card")) : [];
}

function styleText(): string {
  const style = dom.root.find((e) => e.tagName === "style");
  return style?.textContent ?? "";
}

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

describe("模块契约", () => {
  it("meta 按规格落地,四种模式都声明了", () => {
    expect(meta.id).toBe("hue-hand");
    expect(meta.title).toBe("花色接龙");
    expect(meta.emoji).toBe("🌈");
    expect(meta.category).toBe("party");
    expect(meta.levels).toBe(188);
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
  });

  it("挂上去就有三个模式入口和一张选关地图", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    expect(byText("无尽连胜")).toBeTruthy();
    expect(byText("对战")).toBeTruthy();
    expect(byText("双人同屏")).toBeTruthy();
    expect(dom.root.querySelector(".l99-map")).toBeTruthy();
    handle.destroy();
  });
});

describe("对战牌桌", () => {
  it("开一桌:色条写清现在是什么颜色,手牌摊开,牌宽不低于 48px", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();

    const bar = dom.root.querySelector(".hh-colorbar");
    expect(bar?.textContent).toContain("现在是");
    expect(bar?.textContent).toMatch(/粉色|黄色|绿色|蓝色/);
    const cards = handCards();
    expect(cards.length).toBe(7);
    expect(Number.parseFloat(String(cards[0].style.width))).toBeGreaterThanOrEqual(48);
    expect(cardWidthFor(360)).toBeGreaterThanOrEqual(48);
    expect(dom.root.querySelector(".hh-deck")).toBeTruthy();
    handle.destroy();
  });

  it("点一张接不上的牌只会被温柔挡回来,牌还在手上", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();

    const dim = handCards().find((c) => c.className.includes("hh-card-dim"));
    if (dim) {
      dim.click();
      const say = dom.root.querySelector(".hh-say");
      expect(say?.className).toContain("hh-say-oops");
      expect(handCards().length).toBe(7);
      expect(rec.sounds).toContain("oops");
    }
    handle.destroy();
  });

  it("按 G 能摸牌,摸完手牌真的多了一张(或者换下一家)", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();
    const before = handCards().length;
    fireWindow(dom, "keydown", { key: "g" });
    const after = handCards().length;
    expect(after).toBeGreaterThanOrEqual(before);
    expect(rec.sounds).toContain("pop");
    handle.destroy();
  });

  it("Esc 能暂停,再按一次接着玩", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();
    fireWindow(dom, "keydown", { key: "Escape" });
    expect(dom.root.querySelector(".hh-cover")?.textContent).toContain("歇一会儿");
    fireWindow(dom, "keydown", { key: "Escape" });
    expect(dom.root.querySelector(".hh-cover")).toBeNull();
    handle.destroy();
  });
});

describe("双人同屏的遮挡", () => {
  it("换人时先把手牌盖起来,按「我准备好了」才摊牌", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")?.click();
    expect(handCards().length).toBe(7);

    // 朵朵先走一手:能出就出,出不了就摸一张过掉
    const playable = handCards().find((c) => !c.className.includes("hh-card-dim"));
    if (playable) playable.click();
    else {
      fireWindow(dom, "keydown", { key: "g" });
      byText("先不出")?.click();
    }
    // 万能牌会先弹色环,随手挑一个颜色
    if (dom.root.querySelector(".hh-wheel")) {
      const swatch = dom.root.querySelector(".hh-swatch");
      swatch?.click();
    }

    const cover = dom.root.querySelector(".hh-cover");
    expect(cover?.textContent).toContain("轮到");
    expect(dom.root.querySelector(".hh-hidden")?.textContent).toContain("收起来");
    byText("我准备好了")?.click();
    expect(dom.root.querySelector(".hh-cover")).toBeNull();
    expect(handCards().length).toBeGreaterThan(0);
    handle.destroy();
  });
});

describe("无尽与闯关入口", () => {
  it("无尽连胜点进去就能开局", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("无尽连胜")?.click();
    expect(dom.root.querySelector(".hh-chip")?.textContent).toContain("连胜");
    expect(handCards().length).toBeGreaterThan(0);
    byText("回选关")?.click();
    expect(dom.root.querySelector(".l99-map")).toBeTruthy();
    handle.destroy();
  });

  it("从地图点第 1 关能开出一桌牌", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("开始冒险")?.click();
    expect(dom.root.querySelector(".hh-colorbar")?.textContent).toContain("现在是");
    expect(handCards().length).toBeGreaterThan(0);
    handle.destroy();
  });
});

describe("窄屏与按钮尺寸", () => {
  it("360px 下手牌是横向可滑的一条,牌不小于 48px", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();
    const css = styleText();
    expect(css).toContain(".hh-hand{display:flex;gap:6px;overflow-x:auto");
    expect(cardWidthFor(320)).toBeGreaterThanOrEqual(48);
    expect(cardWidthFor(360)).toBeGreaterThanOrEqual(48);
    expect(cardWidthFor(768)).toBeGreaterThanOrEqual(48);
    handle.destroy();
  });

  it("「就一张」钮固定右下角,按钮与字号都够大", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    const css = styleText();
    expect(css).toContain(".hh-one{position:absolute;right:10px;bottom:10px");
    expect(css).toMatch(/\.hh-one\{[^}]*min-height:44px/);
    expect(css).toMatch(/\.hh-btn\{[^}]*min-height:44px/);
    // 字号一律 ≥13px
    for (const m of css.matchAll(/font-size:(\d+)px/g)) {
      expect(Number(m[1]), `字号 ${m[1]}px 太小了`).toBeGreaterThanOrEqual(13);
    }
    handle.destroy();
  });

  it("动效照顾 prefers-reduced-motion", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    expect(styleText()).toContain("@media (prefers-reduced-motion:reduce)");
    handle.destroy();
  });
});

describe("destroy 收得干净", () => {
  it("玩过一桌之后 destroy:监听、定时器、DOM 全清", () => {
    const rec = fakeApi(dom.root);
    const before = windowListenerCount(dom);
    const handle = mount(rec.api);
    byText("对战")?.click();
    byText("开打")?.click();
    fireWindow(dom, "keydown", { key: "g" });
    advance(dom, 900);
    expect(windowListenerCount(dom)).toBeGreaterThan(before);

    handle.destroy();
    expect(windowListenerCount(dom)).toBe(before);
    expect(dom.timers.size).toBe(0);
    expect(dom.root.children.length).toBe(0);
    expect(dom.root.countListeners()).toBe(0);
  });

  it("destroy 之后再走时钟,不会再有人偷偷改 DOM", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")?.click();
    handle.destroy();
    advance(dom, 5000);
    expect(dom.root.children.length).toBe(0);
    expect(dom.timers.size).toBe(0);
  });
});
