/**
 * `destroy()` 必须归零 —— 这一份验的是**接线**,不是账本。
 *
 * 本款把 window 上的监听、`setTimeout`、帧循环全记在 `lifecycle.ts` 的账本上,
 * `destroy` 时一句 `life.dispose()` 一起归零。`lifecycle.test.ts` 已经把那个
 * 账本本身验透了(拿假宿主喂它,挂上去多少、拆下来多少)。
 *
 * 但那验的是账本,不是 `index.ts`。「每一样都记上了账」这件事从来没人验过 ——
 * 只要哪天有人在 `index.ts` 里直接写一句 `window.addEventListener`,
 * 绕开 `life.listen`,账本再干净也拦不住,而且四个既有用例一个都不会红。
 *
 * 所以这一份真挂一次游戏,数 window 上的线:
 *  - 键位是 `window.keydown` / `keyup`,版面是 `window.resize`;
 *  - 回合间歇、幕布、结算延时都是 `window.setTimeout`;
 *  - 主循环是一条 rAF。
 * 退出擂台、退出游戏,这些一样都不许留下 —— 留一条回合计时在上面,
 * 下一款游戏里会突然冒出「第 2 回合」的音效。
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

/** 开擂:点「开擂 ▶」,再把开场幕布那几下走完 */
function startBout(h: Harness): void {
  findOne(h.root, "dua-start")?.fire("click");
  for (let i = 0; i < 4; i++) {
    h.runTimers();
    h.flush(2);
  }
}

describe("朵星擂台 · 1.2 destroy 归零", () => {
  it("模板真的解析出来了:开擂键、两块场地画布、两组触屏按键都在", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);

    expect(findOne(h.root, "dua-start"), "没铺出开擂键").not.toBeNull();
    expect(findOne(h.root, "dua-court-x"), "星星那块场地没铺出来").not.toBeNull();
    expect(findOne(h.root, "dua-court-d"), "朵朵那块场地没铺出来").not.toBeNull();
    expect(findOne(h.root, "dua-pad-x"), "星星那半屏没有触屏按键").not.toBeNull();
    expect(findOne(h.root, "dua-pad-d"), "朵朵那半屏没有触屏按键").not.toBeNull();

    game.destroy();
  });

  it("刚挂载就 destroy:rAF、window 监听、节点全部归零", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    expect(h.windowListeners(), "挂载之后 window 上该多出键位与版面监听").toBeGreaterThan(before);

    game.destroy();
    expect(h.pendingFrames(), "rAF 没取消").toBe(0);
    expect(h.pendingTimers(), "还留着 setTimeout").toBe(0);
    expect(h.windowListeners(), "window 监听没摘干净").toBe(before);
    expect(h.liveObservers(), "ResizeObserver 没 disconnect").toBe(0);
    expect(countNodes(h.root), "宿主里还留着节点").toBe(1);
  });

  it("开擂打一会儿再 destroy:回合间歇那几条 setTimeout 都清掉", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    startBout(h);
    h.flush(40);
    // 打起来之后主循环在跑
    expect(h.pendingFrames(), "开擂之后主循环没转起来").toBeGreaterThan(0);

    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
  });

  it("destroy 之后再敲键、再跑帧、再走定时器,都不许有东西醒过来", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    startBout(h);
    h.flush(20);
    game.destroy();

    // 这几下都不该抛,也不该把任何东西重新排上队
    h.key("keydown", "KeyA");
    h.key("keyup", "KeyA");
    h.key("keydown", "ArrowLeft");
    h.fireWindow("resize");
    h.flush(10);
    h.runTimers();

    expect(h.pendingFrames(), "destroy 之后又排上了 rAF").toBe(0);
    expect(h.pendingTimers(), "destroy 之后又排上了 setTimeout").toBe(0);
    expect(countNodes(h.root), "destroy 之后又往宿主里塞了节点").toBe(1);
  });

  it("退出擂台回到设置页,再 destroy:一样归零", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    startBout(h);
    h.flush(20);
    // 「🔧 退出擂台」回设置页
    findOne(h.root, "dua-back")?.fire("click");
    h.runTimers();
    h.flush(4);
    expect(findOne(h.root, "dua-start"), "退出之后没回到设置页").not.toBeNull();

    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
  });

  it("重复 destroy 不出错,也不会把 window 监听摘成负数", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    startBout(h);
    h.flush(10);

    game.destroy();
    game.destroy();
    game.destroy();

    expect(h.windowListeners()).toBe(before);
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("连点三种玩法再连点开擂,抢按也不会漏掉一条线", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    // 双人 / 单人 / 无尽守擂来回点,每种都点两下
    for (let round = 0; round < 2; round++) {
      for (const mode of ["duo", "solo", "keep"]) {
        const btn = h.root.querySelectorAll("button").find((b) => b.getAttribute("data-mode") === mode);
        btn?.fire("click");
      }
    }
    h.flush(2);
    // 连着点开擂:第二下之后不该再多挂一套循环
    findOne(h.root, "dua-start")?.fire("click");
    findOne(h.root, "dua-start")?.fire("click");
    findOne(h.root, "dua-start")?.fire("click");
    for (let i = 0; i < 4; i++) {
      h.runTimers();
      h.flush(2);
    }

    game.destroy();
    expect(h.windowListeners(), "连点之后有监听没摘掉").toBe(before);
    expect(h.pendingFrames(), "连点之后多挂了一条主循环").toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("暂停幕布开着的时候 destroy:幕布上那两颗按钮也一起带走", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    startBout(h);
    h.flush(10);
    findOne(h.root, "dua-pause")?.fire("click");
    h.flush(2);

    game.destroy();
    expect(h.windowListeners()).toBe(before);
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("按着键不放就 destroy:键没抬起来也不留监听", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    startBout(h);
    // 两个人各按住一个方向不松手
    h.key("keydown", "KeyA");
    h.key("keydown", "ArrowRight");
    h.flush(12);

    game.destroy();
    expect(h.windowListeners(), "按着键 destroy 之后监听没摘干净").toBe(before);
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });
});
