/**
 * `destroy()` 必须归零。
 *
 * 本款版面盯的是 `ResizeObserver`(没有它才退回 `window.resize`),
 * 输入在 `window.keydown` 和画布的四个 pointer 事件上,
 * 倒计时与结算延时是两条 `window.setTimeout`,主循环是一条 rAF。
 * 从赛道退回首页、再从首页退出游戏,这些东西一样都不许留下 ——
 * 留一条倒计时在上面,下一款游戏里会突然冒出「3、2、1」的音效。
 *
 * 跑在 node 环境(没有 jsdom,也不许为此引依赖),DOM 桩在 `domStub.ts` 里。
 */
import { afterEach, describe, expect, it } from "vitest";
import { countNodes, findOne, install, type Harness } from "./domStub";

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

async function mountGame(h: Harness): Promise<{ destroy: () => void }> {
  const mod = await import("./index");
  return mod.mount({
    root: h.root as unknown as HTMLElement,
    play: () => {},
    addStars: () => {},
  } as never);
}

/** 开跑:点「准备好,开跑」,再把倒计时那三下走完 */
function startRace(h: Harness): void {
  findOne(h.root, "dr-start")?.fire("click");
  for (let i = 0; i < 4; i++) {
    h.runTimers();
    h.flush(2);
  }
}

describe("朵星双人冲刺 · 1.2 destroy 归零", () => {
  it("模板真的解析出来了:开跑键、画布、两组触屏按键都在", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);

    expect(findOne(h.root, "dr-start"), "没铺出开跑键").not.toBeNull();
    expect(findOne(h.root, "dr-canvas"), "没铺出赛道画布").not.toBeNull();
    expect(findOne(h.root, "dur-pad-0"), "朵朵那半屏没有触屏按键").not.toBeNull();
    expect(findOne(h.root, "dur-pad-1"), "星星那半屏没有触屏按键").not.toBeNull();

    game.destroy();
  });

  it("刚挂载就 destroy:观察者、rAF、window 监听、节点全部归零", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    // 版面靠 ResizeObserver 盯着,挂载时就该有一个活着的
    expect(h.liveObservers()).toBe(1);
    expect(h.pendingFrames()).toBeGreaterThan(0);

    game.destroy();
    expect(h.liveObservers(), "ResizeObserver 没 disconnect").toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
  });

  it("开跑跑一会儿再 destroy:倒计时 / 结算两条 setTimeout 都清掉", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    startRace(h);
    h.flush(30);
    expect(h.pendingFrames()).toBeGreaterThan(0);

    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers(), "还有倒计时 / 结算延时排在队里").toBe(0);
    expect(h.liveObservers()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("退出后再按键、再放一帧、再跑一遍 timer 都没人接", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    startRace(h);
    h.flush(10);
    game.destroy();

    expect(h.windowListeners()).toBe(0);
    h.key("keydown", "w", "KeyW");
    h.key("keyup", "w", "KeyW");
    h.fireWindow("resize");
    h.runTimers();
    h.flush(5);
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
  });

  it("开跑、换玩法、再开跑来回三轮,监听与观察者都不叠加", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    const base = h.windowListeners();
    for (let i = 0; i < 3; i++) {
      startRace(h);
      h.flush(12);
      expect(h.liveObservers(), `第 ${i + 1} 轮多出来一个观察者`).toBe(1);
      findOne(h.root, "dr-back")?.fire("click");
      h.flush(2);
      expect(h.windowListeners(), `第 ${i + 1} 轮换玩法后 window 上多了监听`).toBe(base);
    }

    game.destroy();
    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(h.liveObservers()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });
});

/**
 * 竞态:本款的开跑链上有一条倒计时 setTimeout 和一条结算 setTimeout,
 * 「倒计时还没走完就按了换玩法」「结算还没弹就退出」是最容易漏东西的两处。
 */
describe("朵星双人冲刺 · 1.2 抢按与竞态", () => {
  it("destroy 调两次不炸,第二次是空操作", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);
    startRace(h);
    h.flush(8);

    game.destroy();
    expect(() => game.destroy()).not.toThrow();
    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(h.liveObservers()).toBe(0);
  });

  it("倒计时还在数就按换玩法:那条 setTimeout 必须当场清掉", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);

    findOne(h.root, "dr-start")?.fire("click");
    // 只走一拍倒计时,后面还排着
    h.runTimers();
    h.flush(1);
    expect(h.pendingTimers(), "倒计时没排上").toBeGreaterThan(0);

    findOne(h.root, "dr-back")?.fire("click");
    h.flush(2);
    expect(h.pendingTimers(), "换玩法之后倒计时还排在队里").toBe(0);

    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.liveObservers()).toBe(0);
  });

  it("开跑键连按三下,倒计时不会叠成三条", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);

    const start = findOne(h.root, "dr-start");
    expect(start).not.toBeNull();
    start?.fire("click");
    start?.fire("click");
    start?.fire("click");
    h.flush(1);
    expect(h.pendingTimers(), "连按三下排了不止一条倒计时").toBeLessThanOrEqual(1);

    game.destroy();
    expect(h.pendingTimers()).toBe(0);
  });

  it("按着方向键直接 destroy,监听与观察者都不留", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);
    startRace(h);
    h.key("keydown", "w", "KeyW");
    h.key("keydown", "ArrowUp", "ArrowUp");
    h.flush(12);
    game.destroy();

    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(h.liveObservers()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });
});
