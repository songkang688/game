/**
 * `destroy()` 必须归零 —— 这一份是**真挂游戏**跑出来的,不是查源码文本。
 *
 * `upgrade12.test.ts` 第十节原来那两条「destroy」用例,查的是 `index.ts` 的
 * **源码字符串**:把 `destroy() {` 之后那一段切出来,再 `includes("removeEventListener(...)")`。
 * 那种查法能挡住「整行被删掉」,但挡不住这几件更常见的事:
 *  - `destroy` 体里写着那行字,可实际执行路径提前 `return` 了;
 *  - 摘的那个函数引用跟挂上去的不是同一个(匿名箭头函数一挂一摘就漏);
 *  - 别处又新挂了一条线,而 `destroy` 里没跟着加 —— 源码查法只认它列出来的那几条,
 *    新漏的那条它根本不知道要找。
 *
 * 所以这里补一份运行时的:真挂一次游戏,数 window 上的线、rAF、定时器和节点。
 * 那两条源码用例**一条没动**,留着当第一道粗筛。
 *
 * 本款挂出去的东西:画布上的 `pointerdown` / `pointermove`,
 * window 上的 `pointerup` / `pointercancel`,一条 rAF 主循环,
 * 拖拽时的 `setPointerCapture`,以及全通关那一下的一条 `window.setTimeout`
 * (那条带 `if (destroyed) return` 守卫,不会在拆掉之后弹窗)。
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

/** 从地图页进第一关:章节盒子里的第一颗关卡按钮 */
function openFirstLevel(h: Harness): void {
  const chapters = findOne(h.root, "cs-chapters");
  let btn: ReturnType<typeof findOne> = null;
  const walkFor = (el: NonNullable<typeof chapters>): void => {
    for (const c of el.children) {
      if (!btn && c.tagName === "button") btn = c;
      else if (!btn) walkFor(c);
    }
  };
  if (chapters) walkFor(chapters);
  // 找不到关卡按钮就当场红,别让后面几条用例在「其实没进关」的状态下空跑绿
  expect(btn, "章节里没有可点的关卡按钮").not.toBeNull();
  btn!.fire("click");
  h.flush(3);
  expect(findOne(h.root, "cs-game")?.classes.has("cs-hidden"), "点了关卡却没进游戏页").toBe(false);
}

/** 按住画布拖一段再抬手,走一遍完整的指针序列 */
function dragOnce(h: Harness): void {
  const canvas = findOne(h.root, "cs-canvas");
  canvas?.fire("pointerdown", { pointerId: 1, clientX: 100, clientY: 200 });
  canvas?.fire("pointermove", { pointerId: 1, clientX: 140, clientY: 230 });
  h.fireWindow("pointerup", { pointerId: 1, clientX: 140, clientY: 230 });
  h.flush(4);
}

describe("糖果秋千 · 1.2 destroy 归零", () => {
  it("模板真的解析出来了:地图、两颗模式键、画布都在", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);

    expect(findOne(h.root, "cs-map"), "没铺出关卡地图").not.toBeNull();
    expect(findOne(h.root, "cs-canvas"), "没铺出画布").not.toBeNull();
    expect(findOne(h.root, "cds-mode-campaign"), "没铺出闯关模式键").not.toBeNull();
    expect(findOne(h.root, "cds-mode-endless"), "没铺出无尽模式键").not.toBeNull();
    expect(findOne(h.root, "cs-chapters")?.children.length, "章节没铺出来").toBeGreaterThan(0);

    game.destroy();
  });

  // 1.3 UX 走查:平板横屏地图页放宽靠 cs-view-map 这个类,进关必须摘掉,
  // 不然 3:4 的画布会被拉到 720px 宽、竖着装不下
  it("地图页带 cs-view-map,进关摘掉,回选关再挂回来", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);

    // 桩里 className 直赋值不进 classes 集合,所以从 cs-map 往上摸到 wrap、断言字符串
    const wrap = findOne(h.root, "cs-map")?.parent;
    expect(wrap, "cs-map 外面该套着 wrap").not.toBeNull();
    expect(wrap!.className, "地图页该带宽屏放宽类").toContain("cs-view-map");
    openFirstLevel(h);
    expect(wrap!.className, "进关后放宽类没摘掉").not.toContain("cs-view-map");
    findOne(h.root, "cs-back")?.fire("click");
    h.flush(2);
    expect(wrap!.className, "回选关后放宽类没挂回来").toContain("cs-view-map");

    game.destroy();
  });

  it("刚挂载就 destroy:rAF、window 监听、节点全部归零", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    expect(h.windowListeners(), "挂载之后 window 上该多出 pointerup / pointercancel").toBeGreaterThan(before);
    expect(h.pendingFrames(), "主循环没转起来").toBeGreaterThan(0);

    game.destroy();
    expect(h.pendingFrames(), "rAF 没取消").toBe(0);
    expect(h.windowListeners(), "window 监听没摘干净").toBe(before);
    expect(h.liveObservers(), "还有观察者没断").toBe(0);
    expect(countNodes(h.root), "宿主里还留着节点").toBe(1);
  });

  it("进关卡割两下绳子再 destroy:一样归零", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    openFirstLevel(h);
    h.flush(20);
    dragOnce(h);
    dragOnce(h);
    h.flush(20);

    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
  });

  it("按着不松手就 destroy:指针还捕获着也不留监听", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    openFirstLevel(h);
    h.flush(10);
    const canvas = findOne(h.root, "cs-canvas");
    canvas?.fire("pointerdown", { pointerId: 7, clientX: 100, clientY: 200 });
    canvas?.fire("pointermove", { pointerId: 7, clientX: 130, clientY: 240 });
    h.flush(6);

    game.destroy();
    expect(h.windowListeners(), "拖拽中 destroy 之后监听没摘干净").toBe(before);
    expect(h.pendingFrames()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("destroy 之后再拖、再抬手、再跑帧,都不许有东西醒过来", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    openFirstLevel(h);
    h.flush(10);
    game.destroy();

    h.fireWindow("pointerup", { pointerId: 1 });
    h.fireWindow("pointercancel", { pointerId: 1 });
    h.flush(10);
    h.runTimers();

    expect(h.pendingFrames(), "destroy 之后又排上了 rAF").toBe(0);
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
    expect(h.pendingFrames()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("闯关 / 无尽两颗模式键连点再 destroy:不会每点一次就多挂一套线", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    for (let i = 0; i < 3; i++) {
      findOne(h.root, "cds-mode-endless")?.fire("click");
      h.flush(4);
      findOne(h.root, "cds-mode-campaign")?.fire("click");
      h.flush(4);
    }
    const afterLoops = h.windowListeners();

    game.destroy();
    expect(h.windowListeners(), "连点模式键之后有监听没摘掉").toBe(before);
    expect(afterLoops, "每点一次模式键就多挂一套 window 监听").toBeLessThanOrEqual(before + 6);
    expect(h.pendingFrames()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });
});
