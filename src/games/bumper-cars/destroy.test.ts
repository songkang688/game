/**
 * `destroy()` 必须归零。
 *
 * 本款在 `window` 上挂了 keydown / keyup / blur / pointerup / resize 五样,
 * 主循环是一条 rAF,摇杆和冲撞键还各自挂着 pointer 监听。
 * 玩家从对战退回选关、从选关退出游戏,这些东西一样都不许留下 ——
 * 留一个 keydown 在上面,下一款游戏里按 W 就会莫名其妙地有人踩油门。
 *
 * 跑在 node 环境(没有 jsdom,也不许为此引依赖),DOM 桩在 `domStub.ts` 里。
 */
import { afterEach, describe, expect, it } from "vitest";
import { countNodes, findButton, install, type Harness } from "./domStub";

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

describe("碰碰车 · 1.2 destroy 归零", () => {
  it("刚挂载就 destroy:window 监听、rAF、节点都回到挂载前", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    expect(countNodes(h.root)).toBeGreaterThan(1);

    game.destroy();
    expect(h.windowListeners()).toBe(before);
    expect(h.pendingFrames()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("进双人对战开打、再 destroy:主循环那条 rAF 和五个 window 监听全摘掉", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    const vs = findButton(h.root, "双人对战");
    expect(vs, "模式条上没有双人对战").not.toBeNull();
    vs?.fire("click");

    // 对局一挂上就排了主循环那一帧,跑几帧让车真的动起来
    expect(h.pendingFrames()).toBeGreaterThan(0);
    h.flush(8);
    expect(h.windowListeners()).toBeGreaterThan(before);

    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
  });

  it("退出后再按 W / 再放一帧都没人接", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    findButton(h.root, "人机对战")?.fire("click");
    h.flush(6);
    game.destroy();

    expect(h.windowListeners()).toBe(0);
    // 没人接的按键不该抛错,也不该把 rAF 排回来
    h.key("keydown", "KeyW");
    h.key("keyup", "KeyW");
    h.fireWindow("blur");
    h.fireWindow("resize");
    h.flush(4);
    expect(h.pendingFrames()).toBe(0);
  });

  it("双人 / 人机 / 无尽来回进出三轮,监听不会越挂越多", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    const base = h.windowListeners();
    let peak = 0;
    for (const label of ["双人对战", "人机对战", "无尽车海", "双人对战", "人机对战", "无尽车海"]) {
      findButton(h.root, label)?.fire("click");
      h.flush(5);
      peak = Math.max(peak, h.windowListeners());
      findButton(h.root, "回选关")?.fire("click");
      h.flush(2);
      // 每一轮退回来都要回到基线,不能一轮比一轮多
      expect(h.windowListeners(), `退出「${label}」后 window 上还留着监听`).toBe(base);
    }
    expect(peak).toBeGreaterThan(base);

    game.destroy();
    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });
});

/**
 * 竞态:孩子不会「一次点一下再等着」,他们会连点、会在动画中途退出。
 * 这几条把最容易出事的几种抢按跑一遍,要的是「不炸、不叠加、不留东西」。
 */
describe("碰碰车 · 1.2 抢按与竞态", () => {
  it("destroy 调两次不炸,第二次是空操作", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);
    findButton(h.root, "无尽车海")?.fire("click");
    h.flush(5);

    game.destroy();
    expect(() => game.destroy()).not.toThrow();
    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("同一拍里把三个模式键全按一遍,只会开一个模式", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);
    const base = h.windowListeners();

    // 连点:双人 → 人机 → 无尽,中间一帧都不给
    findButton(h.root, "双人对战")?.fire("click");
    findButton(h.root, "人机对战")?.fire("click");
    findButton(h.root, "无尽车海")?.fire("click");
    h.flush(5);

    // 开一个模式挂一套监听。要是三个都开了,这里就会是三倍
    const oneMode = h.windowListeners() - base;
    expect(oneMode).toBeGreaterThan(0);
    findButton(h.root, "回选关")?.fire("click");
    h.flush(2);
    expect(h.windowListeners(), "抢按之后有模式没被关掉").toBe(base);

    game.destroy();
    expect(h.windowListeners()).toBe(0);
  });

  it("同一拍里把返回键连按三下,不会把上层也拆掉", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);
    const base = h.windowListeners();

    findButton(h.root, "人机对战")?.fire("click");
    h.flush(4);
    const back = findButton(h.root, "回选关");
    expect(back).not.toBeNull();
    back?.fire("click");
    back?.fire("click");
    back?.fire("click");
    h.flush(3);

    expect(h.windowListeners()).toBe(base);
    // 上层还在:模式条还能再开一次
    findButton(h.root, "无尽车海")?.fire("click");
    h.flush(3);
    expect(h.windowListeners()).toBeGreaterThan(base);

    game.destroy();
    expect(h.windowListeners()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("对局跑到一半直接 destroy(不先退模式),照样清干净", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);

    findButton(h.root, "双人对战")?.fire("click");
    // 一边按着方向键一边退出:按键状态不该把监听留下
    h.key("keydown", "KeyW");
    h.key("keydown", "ArrowUp");
    h.flush(15);
    game.destroy();

    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });
});
