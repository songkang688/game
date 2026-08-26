/**
 * 豆豆迷宫 · 前端接线回归。
 *
 * 规格第十三节点名要测「`destroy` 干净」，第七节要求四种模式都能玩。
 * 测试环境是 node，所以用自带的 `domStub.ts`：它把 window 监听、rAF、DOM 节点都数得出来，
 * 「拆干净了」这句话才有断言撑着。
 */
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
import { GHOST_NAMES } from "./ghosts";
import { configFor } from "./levels";
import { PAD_HIT_PX } from "./layout";
import { meta } from "./meta";

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

/** 找到写着这段字的那个按钮（`find` 是先序，直接用会捞到最外层的容器） */
function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

function key(k: string): void {
  fireWindow(dom, "keydown", { key: k });
}

beforeEach(() => {
  dom = installDom(420);
});

afterEach(() => {
  restoreDom();
});

/* ------------------------------------------------------------------ */
/* 一、模块契约                                                        */
/* ------------------------------------------------------------------ */

describe("index 契约", () => {
  it("顶部 re-export 了 meta，并导出 mount", async () => {
    const mod = await import("./index");
    expect(mod.meta).toBe(meta);
    expect(typeof mod.mount).toBe("function");
  });

  it("四种模式都写在 meta 里，手游端游都能玩", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    expect(meta.platform).toBe("both");
    expect(meta.levels).toBe(188);
  });
});

describe("变蓝过渡", () => {
  it("两端各给原色和昏昏蓝，中间是插值", async () => {
    const { mixColor } = await import("./index");
    expect(mixColor("#FF9AB0", "#7FA9FF", 0)).toBe("#ff9ab0");
    expect(mixColor("#FF9AB0", "#7FA9FF", 1)).toBe("#7fa9ff");
    expect(mixColor("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });

  it("越界的比例会被夹回 0–1，不会算出非法颜色", async () => {
    const { mixColor } = await import("./index");
    expect(mixColor("#000000", "#FFFFFF", -3)).toBe("#000000");
    expect(mixColor("#000000", "#FFFFFF", 9)).toBe("#ffffff");
    expect(mixColor("#123456", "#654321", 0.37)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

/* ------------------------------------------------------------------ */
/* 二、菜单与四种模式                                                  */
/* ------------------------------------------------------------------ */

describe("模式菜单", () => {
  it("挂上去有四个模式入口，四只小幽灵的名字都写在介绍里", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    const modes = dom.root.findAll((e) => e.tagName === "button" && e.className.includes("dmz-mode"));
    expect(modes.map((b) => b.textContent)).toHaveLength(4);
    expect(modes.some((b) => b.textContent.includes("闯关 188"))).toBe(true);
    expect(modes.some((b) => b.textContent.includes("无尽"))).toBe(true);
    expect(modes.some((b) => b.textContent.includes("抢豆对战"))).toBe(true);
    expect(modes.some((b) => b.textContent.includes("双人追逃"))).toBe(true);
    const blurb = dom.root.find((e) => e.className.includes("dmz-sub"))!.textContent;
    for (const name of Object.values(GHOST_NAMES)) {
      expect(blurb, `介绍里没提到${name}`).toContain(name);
    }
    handle.destroy();
  });

  it("destroy 之后 window 监听、rAF、DOM 节点一样不剩", async () => {
    const { mount } = await import("./index");
    const before = windowListenerCount(dom);
    const handle = mount(fakeApi(dom.root).api);
    byText("无尽迷宫")!.dispatch("click");
    flushFrames(dom, 5);
    expect(windowListenerCount(dom)).toBeGreaterThan(before);
    const framesBefore = dom.cancelled.length;
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(before);
    expect(dom.cancelled.length).toBeGreaterThan(framesBefore);
    expect(dom.root.children).toHaveLength(0);
    // destroy 之后再走帧也不会又把自己排进下一帧
    const left = dom.frames.length;
    flushFrames(dom, left + 2);
    expect(dom.frames).toHaveLength(0);
  });

  it("四种模式来回切，监听不会越攒越多", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    const baseline = windowListenerCount(dom);
    for (const label of ["无尽迷宫", "抢豆对战", "双人追逃", "无尽迷宫"]) {
      byText(label)!.dispatch("click");
      flushFrames(dom, 4);
      expect(windowListenerCount(dom)).toBe(baseline + 1);
      byText("换个玩法")!.dispatch("click");
      expect(windowListenerCount(dom)).toBe(baseline);
    }
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(baseline - 0);
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("闯关走的是平台的 188 关框架", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    byText("闯关 188")!.dispatch("click");
    expect(dom.root.find((e) => e.className.includes("l99-map"))).not.toBeNull();
    handle.destroy();
    expect(dom.root.children).toHaveLength(0);
    expect(windowListenerCount(dom)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 三、一局迷宫的输入与拆卸                                            */
/* ------------------------------------------------------------------ */

describe("迷宫舞台", () => {
  it("HUD、画布和虚拟方向键都挂出来了，热区够手指点", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: configFor(0),
      starRole: "none",
      label: "测试",
      onEnd: () => undefined,
    });
    expect(dom.root.querySelector(".dmz-canvas")).not.toBeNull();
    expect(dom.root.querySelector(".dmz-score")).not.toBeNull();
    const pad = dom.root.querySelectorAll(".dmz-key[data-dir]");
    expect(pad.map((b) => b.dataset.dir).sort()).toEqual(["down", "left", "right", "up"]);
    expect(PAD_HIT_PX).toBeGreaterThanOrEqual(44);
    handle.destroy();
  });

  it("画布带读屏文字与列数，暂停也会写进去", async () => {
    const { mountStage } = await import("./index");
    const cfg = { ...configFor(0), ghostCount: 0 };
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg,
      starRole: "none",
      label: "测试",
      onEnd: () => undefined,
    });
    const canvas = dom.root.querySelector(".dmz-canvas")!;
    expect(canvas.getAttribute("data-cols")).toBe(String(cfg.maze.w));
    expect(canvas.getAttribute("role")).toBe("img");
    expect(canvas.getAttribute("aria-label")).toMatch(/朵朵\d+分，小星命\d+，剩\d+颗豆$/);
    key("Escape");
    flushFrames(dom, 1, 60);
    expect(canvas.getAttribute("aria-label")).toContain("已暂停");
    handle.destroy();
  });

  it("画布分辨率按屏宽算，窄屏上格子不会小于 14px", async () => {
    restoreDom();
    dom = installDom(360);
    const { mountStage } = await import("./index");
    const cfg = configFor(187);
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg,
      starRole: "none",
      label: "测试",
      onEnd: () => undefined,
    });
    const canvas = dom.root.querySelector(".dmz-canvas")!;
    expect(canvas.width / cfg.maze.w).toBeGreaterThanOrEqual(14);
    expect(canvas.style.maxWidth).toMatch(/^\d+px$/);
    handle.destroy();
  });

  it("WASD 归朵朵，走一段之后豆子真的少了，也响了吃豆的音", async () => {
    const { mountStage } = await import("./index");
    const sounds: string[] = [];
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: { ...configFor(0), ghostCount: 0 },
      starRole: "none",
      label: "测试",
      play: (n) => sounds.push(n),
      onEnd: () => undefined,
    });
    const left = () => dom.root.querySelector(".dmz-left")!.textContent;
    const before = left();
    for (let i = 0; i < 12; i++) {
      key(i % 2 === 0 ? "d" : "w");
      flushFrames(dom, 6, 60);
    }
    expect(left()).not.toBe(before);
    expect(sounds).toContain("coin");
    handle.destroy();
  });

  it("Esc 暂停会停下推进，再按一次继续", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: { ...configFor(0), ghostCount: 0 },
      starRole: "none",
      label: "测试",
      onEnd: () => undefined,
    });
    const note = () => dom.root.querySelector(".dmz-note")!.textContent;
    const left = () => dom.root.querySelector(".dmz-left")!.textContent;
    key("d");
    flushFrames(dom, 4, 60);
    key("Escape");
    flushFrames(dom, 1, 60);
    expect(note()).toContain("已暂停");
    const frozen = left();
    flushFrames(dom, 10, 60);
    expect(left()).toBe(frozen);
    key("Escape");
    flushFrames(dom, 8, 60);
    expect(left()).not.toBe(frozen);
    handle.destroy();
  });

  it("虚拟方向键和滑动都能给朵朵转向", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: { ...configFor(0), ghostCount: 0 },
      starRole: "none",
      label: "测试",
      onEnd: () => undefined,
    });
    const canvas = dom.root.querySelector(".dmz-canvas")!;
    const left = () => dom.root.querySelector(".dmz-left")!.textContent;
    const before = left();
    dom.root.querySelectorAll(".dmz-key[data-dir]").find((b) => b.dataset.dir === "up")!.dispatch("click");
    flushFrames(dom, 6, 60);
    canvas.dispatch("touchstart", { touches: [{ clientX: 10, clientY: 10 }] });
    canvas.dispatch("touchend", { changedTouches: [{ clientX: 80, clientY: 14 }] });
    flushFrames(dom, 6, 60);
    expect(left()).not.toBe(before);
    handle.destroy();
  });

  it("抢豆对战里方向键归星星，两个人各吃各的", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: { ...configFor(60), ghostCount: 0 },
      starRole: "eater",
      label: "抢豆",
      onEnd: () => undefined,
    });
    const score = () => dom.root.querySelector(".dmz-score")!.textContent;
    expect(score()).toContain("星星");
    for (let i = 0; i < 12; i++) {
      key(i % 2 === 0 ? "ArrowLeft" : "ArrowDown");
      key(i % 2 === 0 ? "d" : "s");
      flushFrames(dom, 6, 60);
    }
    const [, duo, star] = /朵朵 (\d+) · 星星 (\d+)/.exec(score()) ?? [];
    expect(Number(duo)).toBeGreaterThan(0);
    expect(Number(star)).toBeGreaterThan(0);
    handle.destroy();
  });

  it("双人追逃里方向键接到操纵小幽灵那条线上，不是当成朵朵的转向", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: { ...configFor(150), ghostCount: 4 },
      starRole: "ghost",
      label: "追逃",
      onEnd: () => undefined,
    });
    // 只按方向键也不会崩：它走的是操纵小幽灵那条线（方向真的生效在 logic.test.ts 里精确断言）
    for (let i = 0; i < 8; i++) {
      key("ArrowRight");
      flushFrames(dom, 3, 60);
    }
    expect(dom.root.querySelector(".dmz-canvas")).not.toBeNull();
    handle.destroy();
    expect(dom.root.children).toHaveLength(0);
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("同一局反复挂载再拆掉，window 上不会留下任何监听", async () => {
    const { mountStage } = await import("./index");
    for (let i = 0; i < 3; i++) {
      const handle = mountStage(dom.root as unknown as HTMLElement, {
        cfg: { ...configFor(30), ghostCount: 2 },
        starRole: "none",
        label: "测试",
        onEnd: () => undefined,
      });
      flushFrames(dom, 5, 60);
      handle.destroy();
      expect(windowListenerCount(dom)).toBe(0);
      expect(dom.root.children).toHaveLength(0);
    }
  });
});
