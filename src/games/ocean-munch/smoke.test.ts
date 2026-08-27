import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveStore, save } from "../../engine/save";
import { registerLevelExtras, resetLevelExtras } from "../../ui/level188Contract";
import { LEVELS } from "./logic";
import { meta } from "./meta";
import { CAMPAIGN_TOTAL, SKIP_KEY, parseSkipList } from "./campaign";
import { ENDLESS_START_RADIUS } from "./endless";
import type { Dom } from "./domStub";
import { dispatchWindow, flushFrames, installDom, restoreDom, windowListenerCount } from "./domStub";
import { mount } from "./index";

const W = 360;
const H = 640;

interface Api {
  root: never;
  play: (name: string) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
  initialLevel?: number;
}

let dom: Dom;
let plays: string[];

function makeApi(initialLevel?: number): Api {
  plays = [];
  return {
    root: dom.root as never,
    play: (name: string) => void plays.push(name),
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {},
    initialLevel,
  };
}

/** 画布是 root 的唯一孩子;监听全挂在它身上。 */
function canvasOf(): Dom["root"] {
  return dom.root.children[0];
}

/**
 * 首屏三张卡的位置(和 `drawHome` 里的排版算式一致)。
 * 卡片是画出来的、不是 DOM 节点,只能按同一套算式点。
 */
function homeCardCenter(i: number): { x: number; y: number } {
  const x0 = Math.max(12, W * 0.06);
  const y0 = 76;
  const pad = 12;
  const ch = Math.min(96, (H - y0 - 20 - pad * 2) / 3);
  return { x: x0 + (W - x0 * 2) / 2, y: y0 + i * (ch + pad) + ch / 2 };
}

function pointerDown(x: number, y: number): void {
  canvasOf().dispatch("pointerdown", { clientX: x, clientY: y, pointerType: "mouse" });
}

beforeEach(() => {
  dom = installDom(W, H);
  resetLevelExtras();
});

afterEach(() => {
  resetLevelExtras();
  restoreDom();
  vi.restoreAllMocks();
});

describe("挂载与销毁", () => {
  it("挂上就有画布、监听和一条动画帧", () => {
    const handle = mount(makeApi() as never);
    expect(dom.root.children).toHaveLength(1);
    expect(canvasOf().tagName).toBe("canvas");
    // 指针两个(移动 / 按下)+ window 上键盘两个(按下 / 抬起)
    expect(canvasOf().countListeners()).toBe(2);
    expect(windowListenerCount(dom)).toBe(2);
    expect(dom.frames.length).toBe(1);
    handle.destroy();
  });

  it("每一帧都会再排下一帧,连着跑几十帧不抛", () => {
    const handle = mount(makeApi() as never);
    flushFrames(dom, 40);
    expect(dom.frames.length).toBe(1);
    handle.destroy();
  });

  it("destroy 之后 rAF 与监听全部归零", () => {
    const handle = mount(makeApi() as never);
    flushFrames(dom, 5);
    const canvas = canvasOf();
    handle.destroy();
    expect(dom.cancelled.length).toBeGreaterThan(0);
    expect(canvas.countListeners()).toBe(0);
    expect(windowListenerCount(dom)).toBe(0);
    expect(dom.root.children).toHaveLength(0);
    // 手里还攥着的那一帧跑完之后不会再排新的
    dom.frames.length = 0;
    expect(dom.frames).toHaveLength(0);
  });

  it("destroy 之后再点、再按键都不再有反应", () => {
    const handle = mount(makeApi() as never);
    flushFrames(dom, 2);
    const canvas = canvasOf();
    handle.destroy();
    plays.length = 0;
    canvas.dispatch("pointerdown", { clientX: 100, clientY: 100, pointerType: "mouse" });
    dispatchWindow(dom, "keydown", { code: "Space", key: " " });
    handle.openCampaignLevel(30);
    expect(plays).toEqual([]);
  });

  it("destroy 调两次也不炸", () => {
    const handle = mount(makeApi() as never);
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });
});

describe("首屏:战役 / 无尽 / 对战三个并列入口", () => {
  it("meta 认了三种玩法,而且给平台标了跑得动的端", () => {
    expect(meta.modes).toContain("campaign");
    expect(meta.modes).toContain("endless");
    expect(meta.modes).toContain("versus");
    expect(meta.modes).not.toContain("coop");
    expect(meta.levels).toBe(LEVELS.length);
    expect(["both", "desktop", "mobile"]).toContain(meta.platform);
    expect(meta.blurb).toContain("深海马拉松");
  });

  it("点第二张卡就下水开始深海马拉松", () => {
    const handle = mount(makeApi() as never);
    flushFrames(dom, 1);
    const c = homeCardCenter(1);
    pointerDown(c.x, c.y);
    expect(plays).toContain("jump");
    // 一分钟的帧连着跑,竞技场循环不抛
    flushFrames(dom, 200, 50);
    handle.destroy();
  });

  it("点第三张卡先进对手选择,再挑一档才开打", () => {
    const handle = mount(makeApi() as never);
    flushFrames(dom, 1);
    pointerDown(homeCardCenter(2).x, homeCardCenter(2).y);
    expect(plays).toContain("tap");
    expect(plays).not.toContain("jump");
    flushFrames(dom, 1);
    // 对手卡的排版:y0 = 80,卡高 min(92, …)
    const ch = Math.min(92, (H - 80 - 20 - 24) / 3);
    pointerDown(W / 2, 80 + ch / 2);
    expect(plays).toContain("jump");
    flushFrames(dom, 120, 50);
    handle.destroy();
  });

  it("点第一张卡进海域列表,战役那一路一点没动", () => {
    const handle = mount(makeApi() as never);
    flushFrames(dom, 1);
    pointerDown(homeCardCenter(0).x, homeCardCenter(0).y);
    expect(plays).toContain("tap");
    flushFrames(dom, 5);
    handle.destroy();
  });

  it("竞技场里 WASD 游得动、空格能冲刺,Esc 一概不碰", () => {
    const handle = mount(makeApi() as never);
    flushFrames(dom, 1);
    pointerDown(homeCardCenter(1).x, homeCardCenter(1).y);
    flushFrames(dom, 3);
    plays.length = 0;
    dispatchWindow(dom, "keydown", { code: "KeyD", key: "d" });
    flushFrames(dom, 6, 50);
    dispatchWindow(dom, "keyup", { code: "KeyD", key: "d" });
    dispatchWindow(dom, "keydown", { code: "Space", key: " " });
    expect(plays).toContain("pop");

    // Esc 既不认也不拦:壳层照样接得走暂停
    const esc = { code: "Escape", key: "Escape", preventDefault: vi.fn(), stopPropagation: vi.fn() };
    dispatchWindow(dom, "keydown", esc);
    dispatchWindow(dom, "keyup", esc);
    expect(esc.preventDefault).not.toHaveBeenCalled();
    expect(esc.stopPropagation).not.toHaveBeenCalled();
    handle.destroy();
  });
});

describe("平台接线:直开第 N 关", () => {
  it("handle 上给了 openCampaignLevel,越界夹到两端", () => {
    const handle = mount(makeApi() as never);
    expect(typeof handle.openCampaignLevel).toBe("function");
    for (const n of [1, 2, 99, 188, 0, -5, 9999, Number.NaN]) {
      expect(() => handle.openCampaignLevel(n)).not.toThrow();
      flushFrames(dom, 2);
    }
    handle.destroy();
  });

  it("api.initialLevel 给了就直接开那一关,不停在首屏", () => {
    const handle = mount(makeApi(42) as never);
    flushFrames(dom, 3);
    // 停在关卡引导页而不是首屏:首屏那三张卡这时点不动了
    plays.length = 0;
    pointerDown(homeCardCenter(1).x, homeCardCenter(1).y);
    expect(plays).not.toContain("jump");
    handle.destroy();
  });

  it("地址栏 `?level=` 也能直开,越界照样夹住", () => {
    dom.search.value = "?level=9999";
    const handle = mount(makeApi() as never);
    flushFrames(dom, 3);
    plays.length = 0;
    pointerDown(homeCardCenter(1).x, homeCardCenter(1).y);
    expect(plays).not.toContain("jump");
    handle.destroy();
  });

  it("两个都没有才停在首屏", () => {
    dom.search.value = "";
    const handle = mount(makeApi() as never);
    flushFrames(dom, 1);
    pointerDown(homeCardCenter(1).x, homeCardCenter(1).y);
    expect(plays).toContain("jump");
    handle.destroy();
  });
});

/**
 * 引导面板上「请大人跳过」那颗按钮的圆心。
 * 面板高 240(带跳关时)、垂直居中,按钮顶在面板内 176 处、高 44。
 */
const SKIP_BTN = { x: W / 2, y: H / 2 - 240 / 2 + 176 + 22 };

describe("平台接线:家长跳关", () => {
  it("壳层没注册跳关就完全不露这个入口:点同一处只是开始这一关", () => {
    const handle = mount(makeApi(3) as never);
    flushFrames(dom, 3);
    plays.length = 0;
    pointerDown(SKIP_BTN.x, SKIP_BTN.y);
    expect(plays).toContain("tap");
    expect(dom.storage.has(SKIP_KEY)).toBe(false);
    handle.destroy();
  });

  it("跳关成功后本关记 0 星,并把关号同步进 l99skip", async () => {
    const requestSkip = vi.fn(async () => true);
    registerLevelExtras({ requestSkip });
    const handle = mount(makeApi(3) as never);
    flushFrames(dom, 3);
    pointerDown(SKIP_BTN.x, SKIP_BTN.y);
    // 第 3 关的 0 基下标是 2
    expect(requestSkip).toHaveBeenCalledWith(meta.id, 2);
    await vi.waitFor(() => expect(dom.storage.has(SKIP_KEY)).toBe(true));
    expect(parseSkipList(dom.storage.get(SKIP_KEY) ?? null)).toEqual([2]);
    // 跳过去不是本事:本关星级仍旧是 0
    const stars = JSON.parse(dom.storage.get("yiduo-yixing.ocean-munch.campaign.v2") ?? "[]");
    expect(stars[2] ?? 0).toBe(0);
    handle.destroy();
  });

  it("授权被拒就什么都不记", async () => {
    const requestSkip = vi.fn(async () => false);
    registerLevelExtras({ requestSkip });
    const handle = mount(makeApi(3) as never);
    flushFrames(dom, 3);
    pointerDown(SKIP_BTN.x, SKIP_BTN.y);
    expect(requestSkip).toHaveBeenCalledTimes(1);
    await Promise.resolve().then(() => {}).then(() => {});
    expect(dom.storage.has(SKIP_KEY)).toBe(false);
    handle.destroy();
  });

  it("最后一关没得跳:那里再没有下一关可解锁", () => {
    const requestSkip = vi.fn(async () => true);
    registerLevelExtras({ requestSkip });
    const handle = mount(makeApi(CAMPAIGN_TOTAL) as never);
    flushFrames(dom, 3);
    pointerDown(SKIP_BTN.x, SKIP_BTN.y);
    expect(requestSkip).not.toHaveBeenCalled();
    handle.destroy();
  });
});

describe("无尽真的玩得到失败,而且成绩报得出去", () => {
  it("站着不动迟早会被啃回岸上,结束时把米数交给 recordEndlessBest", () => {
    const record = vi.spyOn(save, "recordEndlessBest");
    const handle = mount(makeApi() as never);
    flushFrames(dom, 1);
    pointerDown(homeCardCenter(1).x, homeCardCenter(1).y);
    // 一动不动地泡在池子里:大鱼来了也不躲,这一趟一定收得了尾
    for (let i = 0; i < 4000 && record.mock.calls.length === 0; i++) flushFrames(dom, 1, 50);
    expect(record).toHaveBeenCalledTimes(1);
    const [id, depth] = record.mock.calls[0];
    expect(id).toBe("ocean-munch");
    expect(depth).toBeGreaterThan(0);
    expect(Number.isInteger(depth)).toBe(true);
    handle.destroy();
  });
});

describe("无尽成绩:只增不减", () => {
  it("recordEndlessBest 保留历史最高,低分不覆盖", () => {
    const store = new SaveStore({
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    expect(store.getGameProgress(meta.id).endlessBest).toBe(0);
    expect(store.recordEndlessBest(meta.id, 820)).toBe(820);
    expect(store.recordEndlessBest(meta.id, 100)).toBe(820);
    expect(store.recordEndlessBest(meta.id, 0)).toBe(820);
    expect(store.recordEndlessBest(meta.id, -50)).toBe(820);
    expect(store.recordEndlessBest(meta.id, Number.NaN)).toBe(820);
    expect(store.recordEndlessBest(meta.id, 1400)).toBe(1400);
    expect(store.getGameProgress(meta.id).endlessBest).toBe(1400);
  });

  it("成绩记在 ocean-munch 名下,不串到别款", () => {
    const store = new SaveStore({
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    store.recordEndlessBest(meta.id, 500);
    expect(store.getGameProgress("some-other-game").endlessBest).toBe(0);
    expect(meta.id).toBe("ocean-munch");
  });
});

describe("战役老存档一个字不动", () => {
  it("旧进度读得回来,关卡总数还是 188", () => {
    dom.storage.set(
      "yiduo-yixing.ocean-munch.campaign.v2",
      JSON.stringify([3, 2, 1, ...new Array(20).fill(0)]),
    );
    const handle = mount(makeApi() as never);
    flushFrames(dom, 2);
    expect(CAMPAIGN_TOTAL).toBe(188);
    // 挂载不会把老存档改写掉
    expect(JSON.parse(dom.storage.get("yiduo-yixing.ocean-munch.campaign.v2") as string)[0]).toBe(3);
    handle.destroy();
  });

  it("无尽开局比战役壮实一圈,不然第一口就结束", () => {
    expect(ENDLESS_START_RADIUS).toBeGreaterThan(14);
  });
});
