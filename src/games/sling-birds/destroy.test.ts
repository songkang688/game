/**
 * `destroy()` 必须归零。
 *
 * 接手第 3 轮时本款**一条真挂游戏的用例都没有**。仓库里名字带 `destroy` 的那几条
 * (`world.test.ts` / `endless.test.ts` 里的 `w.destroyed`)说的是「这一发打碎了几块砖」,
 * 跟生命周期的 `destroy()` 一点关系都没有 —— 也就是说本款的清理路径此前是**零覆盖**。
 *
 * 而它挂出去的东西并不少:
 *  - window 上五个监听:`pointermove` / `pointerup` / `pointercancel` / `keydown` / `resize`;
 *  - 一个 `ResizeObserver` 盯画布尺寸;
 *  - 一条 `window.setTimeout`(打完一座塔之后隔一会儿摆下一座);
 *  - 一条 rAF 主循环;
 *  - 画布上的 `pointerdown`,拖拽时还会 `setPointerCapture`。
 *
 * 漏掉其中任何一条,离开本款之后在别的游戏里拖一下屏幕,弹弓都会跟着响。
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
    onWin: () => {},
    onLose: () => {},
  } as never);
}

/** 从地图页进第一关:点关卡格子第一个 */
function openFirstLevel(h: Harness): void {
  const grid = findOne(h.root, "slb-grid");
  // 找不到格子就当场红,别让后面几条用例在「其实没进关」的状态下空跑绿
  expect(grid?.children.length, "关卡格子没铺出来").toBeGreaterThan(0);
  grid!.children[0].fire("click");
  h.flush(3);
  expect(findOne(h.root, "slb-play")?.style.display, "点了关卡却没进游戏页").not.toBe("none");
}

describe("弹弹小鸟 · 1.2 destroy 归零", () => {
  it("模板真的解析出来了:地图、无尽入口、画布都在", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);

    expect(findOne(h.root, "slb-map"), "没铺出关卡地图").not.toBeNull();
    expect(findOne(h.root, "slb-endless"), "没铺出无尽入口").not.toBeNull();
    expect(findOne(h.root, "slb-canvas"), "没铺出弹弓画布").not.toBeNull();
    expect(findOne(h.root, "slb-grid")?.children.length, "关卡格子没铺出来").toBeGreaterThan(0);

    game.destroy();
  });

  it("刚挂载就 destroy:观察者、rAF、window 监听、节点全部归零", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    expect(h.liveObservers(), "画布尺寸没人盯着").toBe(1);
    expect(h.windowListeners(), "挂载之后 window 上该多出那五个监听").toBeGreaterThan(before);
    expect(h.pendingFrames(), "主循环没转起来").toBeGreaterThan(0);

    game.destroy();
    expect(h.liveObservers(), "ResizeObserver 没 disconnect").toBe(0);
    expect(h.pendingFrames(), "rAF 没取消").toBe(0);
    expect(h.pendingTimers(), "还留着 setTimeout").toBe(0);
    expect(h.windowListeners(), "window 监听没摘干净").toBe(before);
    expect(countNodes(h.root), "宿主里还留着节点").toBe(1);
  });

  it("进关卡打一会儿再 destroy:一样归零", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    openFirstLevel(h);
    h.flush(30);

    game.destroy();
    expect(h.liveObservers()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
  });

  it("无尽打靶塔玩一会儿再 destroy:摆下一座塔的那条延时也清掉", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    findOne(h.root, "slb-endless")?.fire("click");
    h.flush(30);
    h.runTimers();
    h.flush(10);

    game.destroy();
    expect(h.pendingTimers(), "摆下一座塔的延时没清掉").toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(h.liveObservers()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("拖着弹弓不松手就 destroy:指针还捕获着也不留监听", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    openFirstLevel(h);
    h.flush(10);
    // 按住画布往后拉,不抬手
    const canvas = findOne(h.root, "slb-canvas");
    canvas?.fire("pointerdown", { pointerId: 1, clientX: 120, clientY: 300 });
    h.fireWindow("pointermove", { pointerId: 1, clientX: 90, clientY: 320 });
    h.fireWindow("pointermove", { pointerId: 1, clientX: 70, clientY: 340 });
    h.flush(6);

    game.destroy();
    expect(h.windowListeners(), "拖拽中 destroy 之后监听没摘干净").toBe(before);
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("destroy 之后再拖、再敲键、再改窗口大小,都不许有东西醒过来", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    openFirstLevel(h);
    h.flush(10);
    game.destroy();

    // 这几下都不该抛,也不该把任何东西重新排上队
    h.fireWindow("pointermove", { pointerId: 1, clientX: 80, clientY: 300 });
    h.fireWindow("pointerup", { pointerId: 1 });
    h.fireWindow("pointercancel", { pointerId: 1 });
    h.key("keydown", "Space");
    h.fireWindow("resize");
    h.flush(10);
    h.runTimers();

    expect(h.pendingFrames(), "destroy 之后又排上了 rAF").toBe(0);
    expect(h.pendingTimers(), "destroy 之后又排上了 setTimeout").toBe(0);
    expect(countNodes(h.root), "destroy 之后又往宿主里塞了节点").toBe(1);
  });

  it("重复 destroy 不出错,也不会把 window 监听摘成负数", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    openFirstLevel(h);
    h.flush(10);

    game.destroy();
    game.destroy();
    game.destroy();

    expect(h.windowListeners()).toBe(before);
    expect(h.liveObservers()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("在关卡与地图之间来回切再 destroy:不会每进一次就多挂一套线", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    for (let i = 0; i < 3; i++) {
      openFirstLevel(h);
      h.flush(6);
      findOne(h.root, "slb-back")?.fire("click");
      h.flush(4);
    }
    // 来回三趟之后,window 上的线不该按趟数翻倍
    const afterLoops = h.windowListeners();

    game.destroy();
    expect(h.windowListeners(), "来回切之后有监听没摘掉").toBe(before);
    expect(afterLoops, "每进一次关卡就多挂一套 window 监听").toBeLessThanOrEqual(before + 8);
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });
});
