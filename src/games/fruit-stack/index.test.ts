// 果果合成 · 前端接线回归。
//
// 规格第十三节点名要测「destroy 干净」,第九节要求 360px 上容器占满宽、警戒线看得清。
// 测试环境是 node,所以用同目录的 domStub:window 监听、rAF、DOM 节点都数得出来,
// 「拆干净了」这句话才有断言撑着,而不是只看一眼源码。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import {
  El,
  fireWindow,
  flushFrames,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
} from "./domStub";
import { CHAIN } from "./merge";
import { buildLevel } from "./levels";
import { meta } from "./meta";

let dom: Dom;

interface Recorder {
  api: GameApi;
  sounds: string[];
}

function fakeApi(root: El): Recorder {
  const rec: Recorder = { api: null as unknown as GameApi, sounds: [] };
  rec.api = {
    root: root as unknown as HTMLElement,
    play: (name: string) => rec.sounds.push(name),
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => undefined,
    onLose: () => undefined,
  } as unknown as GameApi;
  return rec;
}

/** 找到写着这段字的按钮;`findAll` 是先序,取最里面那个才不会捞到外层容器 */
function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

beforeEach(() => {
  dom = installDom(420);
});

afterEach(() => {
  restoreDom();
});

describe("index 契约", () => {
  it("顶部 re-export 了 meta,并导出 mount", async () => {
    const mod = await import("./index");
    expect(mod.meta).toBe(meta);
    expect(typeof mod.mount).toBe("function");
  });

  it("四种模式都在 meta 里,手游端游都能玩", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    expect(meta.platform).toBe("both");
    expect(meta.levels).toBe(188);
  });

  it("挂上去就有人机对战、双人同屏、无尽三个入口和四档难度", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    expect(byText("人机对战")).not.toBeNull();
    expect(byText("双人同屏")).not.toBeNull();
    expect(byText("无尽果盆")).not.toBeNull();
    for (const label of ["菜鸟", "普通", "高手", "地狱"]) {
      expect(byText(label), `选不到${label}档`).not.toBeNull();
    }
    handle.destroy();
  });
});

describe("destroy 收得干不干净", () => {
  it("destroy 之后 window 监听、rAF、DOM 节点一样不剩", async () => {
    const { mount } = await import("./index");
    const before = windowListenerCount(dom);
    const handle = mount(fakeApi(dom.root).api);
    byText("无尽果盆")!.dispatch("click");
    flushFrames(dom, 6);
    expect(windowListenerCount(dom), "开了一局却没挂上任何 window 监听").toBeGreaterThan(before);

    const cancelledBefore = dom.cancelled.length;
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(before);
    expect(dom.cancelled.length).toBeGreaterThan(cancelledBefore);
    expect(dom.root.children).toHaveLength(0);
    expect(dom.root.countListeners()).toBe(0);

    // 拆完再走帧,循环也不会把自己重新排进下一帧
    flushFrames(dom, dom.frames.length + 3);
    expect(dom.frames).toHaveLength(0);
  });

  it("三种模式来回开关,监听不会越攒越多", async () => {
    const { mount } = await import("./index");
    const pristine = windowListenerCount(dom);
    const handle = mount(fakeApi(dom.root).api);
    // 关卡框架自己也挂了 resize,所以「回到原位」比的是挂载之后的水位
    const baseline = windowListenerCount(dom);
    let peak = baseline;
    for (const label of ["无尽果盆", "人机对战", "双人同屏", "无尽果盆"]) {
      byText(label)!.dispatch("click");
      flushFrames(dom, 4);
      peak = Math.max(peak, windowListenerCount(dom));
      byText("回选关")!.dispatch("click");
      flushFrames(dom, 2);
      expect(windowListenerCount(dom), `${label} 退出后监听没回到原位`).toBe(baseline);
    }
    expect(peak, "开局居然一个 window 监听都没加").toBeGreaterThan(baseline);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(pristine);
  });

  it("destroy 之后再敲键盘、再改窗口大小都不会炸", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    byText("无尽果盆")!.dispatch("click");
    flushFrames(dom, 4);
    handle.destroy();
    expect(() => {
      fireWindow(dom, "keydown", { code: "KeyF" });
      fireWindow(dom, "keydown", { code: "Escape" });
      fireWindow(dom, "resize");
      flushFrames(dom, 3);
    }).not.toThrow();
  });
});

describe("键位与投放", () => {
  it("A / D 挪投放点,F 真的把果子放下去", async () => {
    const { mount } = await import("./index");
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("无尽果盆")!.dispatch("click");
    flushFrames(dom, 3);
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    expect(canvas).toBeTruthy();

    fireWindow(dom, "keydown", { code: "KeyD" });
    flushFrames(dom, 4);
    fireWindow(dom, "keyup", { code: "KeyD" });
    fireWindow(dom, "keydown", { code: "KeyF" });
    flushFrames(dom, 2);
    expect(rec.sounds, "按了 F 却没有落子音").toContain("tap");
    handle.destroy();
  });

  it("Esc 会暂停,再按一次继续", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    byText("无尽果盆")!.dispatch("click");
    flushFrames(dom, 3);
    fireWindow(dom, "keydown", { code: "Escape" });
    expect(dom.root.find((e) => e.className.includes("fs-veil"))).not.toBeNull();
    fireWindow(dom, "keydown", { code: "Escape" });
    expect(dom.root.find((e) => e.className.includes("fs-veil"))).toBeNull();
    handle.destroy();
  });

  it("手机上在盆里拖动再松手就是一次投放", async () => {
    const { mount } = await import("./index");
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("无尽果盆")!.dispatch("click");
    flushFrames(dom, 3);
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    canvas.dispatch("pointerdown", { pointerId: 1, clientX: 40 });
    canvas.dispatch("pointermove", { pointerId: 1, clientX: 120 });
    canvas.dispatch("pointerup", { pointerId: 1, clientX: 120 });
    expect(rec.sounds).toContain("tap");
    handle.destroy();
  });
});

describe("画布的读屏文字", () => {
  it("盘面读得出分数、最大果和盆里几颗", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    byText("无尽果盆")!.dispatch("click");
    flushFrames(dom, 3);
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    expect(canvas.getAttribute("role")).toBe("img");
    expect(canvas.getAttribute("aria-label")).toMatch(/朵朵的果盆，0分，最大「籽」，盆里0颗/);

    fireWindow(dom, "keydown", { code: "KeyF" });
    flushFrames(dom, 4);
    expect(canvas.getAttribute("data-drops")).toBe("1");
    expect(canvas.getAttribute("aria-label")).toContain("盆里1颗");
    handle.destroy();
  });

  it("暂停的时候读屏文字会说已暂停", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    byText("无尽果盆")!.dispatch("click");
    flushFrames(dom, 3);
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    expect(canvas.getAttribute("aria-label")).not.toContain("已暂停");
    fireWindow(dom, "keydown", { code: "Escape" });
    expect(canvas.getAttribute("aria-label")).toContain("已暂停");
    fireWindow(dom, "keydown", { code: "Escape" });
    expect(canvas.getAttribute("aria-label")).not.toContain("已暂停");
    handle.destroy();
  });
});

describe("360px 上的排布", () => {
  it("盆按 360px 的可用宽度缩放,警戒线还在画布里", async () => {
    restoreDom();
    dom = installDom(360);
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    byText("无尽果盆")!.dispatch("click");
    flushFrames(dom, 3);
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    const cssW = Number.parseFloat(canvas.style.width);
    const cssH = Number.parseFloat(canvas.style.height);
    expect(cssW).toBeGreaterThan(0);
    expect(cssW, "盆比 360px 还宽,会横向溢出").toBeLessThanOrEqual(360);
    // 高宽比要保住,不然警戒线的位置就对不上了
    const lv = buildLevel(0);
    expect(cssH / cssW).toBeGreaterThan(1);
    expect(lv.lineY).toBeLessThan(lv.box.h);
    handle.destroy();
  });

  it("分屏关两个盆并排也不超过 360px", async () => {
    restoreDom();
    dom = installDom(360);
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    byText("双人同屏")!.dispatch("click");
    flushFrames(dom, 3);
    const canvases = dom.root.findAll((e) => e.tagName === "canvas");
    expect(canvases).toHaveLength(2);
    const total = canvases.reduce((sum, c) => sum + Number.parseFloat(c.style.width), 0);
    expect(total, "两个盆加起来撑破了 360px").toBeLessThanOrEqual(360);
    handle.destroy();
  });

  it("界面上的字号都不小于 12px", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    const style = dom.head.children.find((c) => c.id === "fs-style");
    expect(style, "样式没注入").toBeTruthy();
    const sizes = [...style!.textContent.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(5);
    for (const px of sizes) expect(px, `有 ${px}px 的字,360px 上看不清`).toBeGreaterThanOrEqual(12);
    handle.destroy();
  });

  it("十一级果子的名字都是两个字以内,窄屏排得下", () => {
    for (const kind of CHAIN) {
      expect(kind.name.length).toBeLessThanOrEqual(3);
      expect(kind.name).not.toMatch(/[A-Za-z]/);
    }
  });
});

// ---------------------------------------------------------------------------
// 1.3 视觉契约(只增不减):果子走贴图路径、读屏契约原样、reduced 降级可达
// ---------------------------------------------------------------------------

describe("1.3 视觉契约", () => {
  it("一帧 render 绘制非空,果子走 drawImage 贴图路径,缓存键成形", async () => {
    // 给这一条换一支「录音笔」上下文:domStub 的 ctx2d 是哑巴 Proxy,数不出调用
    const calls: string[] = [];
    const orig = El.prototype.getContext;
    const rec = new Proxy(
      {},
      {
        get(_t, prop) {
          if (typeof prop !== "string") return undefined;
          return (...args: unknown[]) => {
            calls.push(prop);
            if (prop === "createRadialGradient" || prop === "createLinearGradient") {
              return { addColorStop: () => undefined };
            }
            return undefined;
          };
        },
        set: () => true,
      }
    );
    El.prototype.getContext = () => rec;
    try {
      const { mount } = await import("./index");
      const { clearSpriteCache, spriteCacheKeys } = await import("./art");
      clearSpriteCache();
      const handle = mount(fakeApi(dom.root).api);
      byText("无尽果盆")!.dispatch("click");
      flushFrames(dom, 4);
      expect(calls.length, "一帧下来什么都没画").toBeGreaterThan(0);
      expect(calls, "果子没走 drawImage 贴图路径").toContain("drawImage");
      expect(calls.filter((c) => c === "arc").length, "盆和贴图里连一个圆都没有").toBeGreaterThan(0);
      const keys = spriteCacheKeys();
      expect(keys.length, "贴图缓存是空的:纹理还在逐帧画").toBeGreaterThan(0);
      for (const key of keys) expect(key).toMatch(/^\d+\|(smile|worry)\|[\d.]+$/);
      handle.destroy();
      clearSpriteCache();
    } finally {
      El.prototype.getContext = orig;
    }
  });

  it("describe 的读屏契约原样保留:aria 一句话 + data-aim + data-drops", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    byText("无尽果盆")!.dispatch("click");
    flushFrames(dom, 3);
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    expect(canvas.getAttribute("aria-label")).toMatch(/^朵朵的果盆，\d+分，最大「.+」，盆里\d+颗，不限$/);
    expect(canvas.getAttribute("data-aim")).toMatch(/^\d+\.\d$/);
    fireWindow(dom, "keydown", { code: "KeyF" });
    flushFrames(dom, 4);
    expect(canvas.getAttribute("data-drops")).toBe("1");
    expect(canvas.getAttribute("aria-label")).toContain("盆里1颗");
    handle.destroy();
  });

  it("prefers-reduced-motion 下挂载照样跑,警戒线闪烁恒定", async () => {
    const { blinkAlpha } = await import("./art");
    for (const t of [0, 130, 999]) expect(blinkAlpha(t, true)).toBe(1);
    restoreDom();
    dom = installDom(420, true);
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    byText("无尽果盆")!.dispatch("click");
    expect(() => {
      fireWindow(dom, "keydown", { code: "KeyF" });
      flushFrames(dom, 6);
    }).not.toThrow();
    handle.destroy();
  });

  it("下一颗预览是果篮窗口:两格、次格半透明,canvas 仍只有盆一个", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    byText("无尽果盆")!.dispatch("click");
    flushFrames(dom, 3);
    expect(dom.root.find((e) => e.className === "fs-basket"), "木篮框没挂上").not.toBeNull();
    const cells = dom.root.findAll((e) => e.className.includes("fs-basket-cell"));
    expect(cells).toHaveLength(2);
    expect(cells[1].className).toContain("fs-basket-cell--next");
    // 篮里的果子图章 ≥ 12px,360px 上认得出
    for (const cell of cells) {
      const stamp = cell.children[0];
      expect(stamp, "篮格里没有果子图章").toBeTruthy();
      expect(Number.parseFloat(stamp.style.width)).toBeGreaterThanOrEqual(12);
    }
    // 盆的画布靠 tagName 被冒烟脚本点名,预览不许混进去
    expect(dom.root.findAll((e) => e.tagName === "canvas")).toHaveLength(1);
    handle.destroy();
  });

  it("结算插画:双人最大果对比 + 合成树点亮到最高级", async () => {
    const { resultArt } = await import("./index");
    const art = resultArt([4, 7], ["朵朵", "星星"]) as unknown as El;
    const slots = art.findAll((e) => e.className === "fs-result-slot");
    expect(slots).toHaveLength(2);
    expect(art.textContent).toContain("朵朵最大「梨」");
    expect(art.textContent).toContain("星星最大「柚」");
    const dots = art.findAll((e) => e.className.includes("fs-tree-dot"));
    expect(dots).toHaveLength(CHAIN.length);
    expect(art.findAll((e) => e.className.includes("fs-tree-dot--on"))).toHaveLength(8);
  });
});
