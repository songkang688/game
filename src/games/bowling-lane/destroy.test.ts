/**
 * `destroy()` 必须归零。
 *
 * 本款在 `window` 上挂了 keydown 与 resize,球道 canvas 上挂了 pointerdown,
 * 主循环是一条 rAF。玩家从对战退回选关、从选关退出游戏,这些东西一样都不许留下 ——
 * 留一个 keydown 在上面,下一款游戏里按 F 就会莫名其妙地停指针。
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

describe("保龄球 · 1.2 destroy 归零", () => {
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

  it("进双人对战投一球、再 destroy:rAF 与 keydown / resize 全摘掉", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    const vs = findButton(h.root, "双人对战");
    expect(vs, "模式条上没有双人对战").not.toBeNull();
    vs?.fire("click");

    expect(h.pendingFrames()).toBeGreaterThan(0);
    h.flush(8);
    expect(h.windowListeners()).toBeGreaterThan(before);
    // 三段式:力度、落点、旋转各停一下,球真的滚出去
    h.key("keydown", "KeyF");
    h.key("keydown", "KeyF");
    h.key("keydown", "KeyF");
    h.flush(20);

    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
  });

  it("退出后再按 F / 再放一帧都没人接", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    findButton(h.root, "人机对战")?.fire("click");
    h.flush(6);
    game.destroy();

    expect(h.windowListeners()).toBe(0);
    h.key("keydown", "KeyF");
    h.key("keydown", "Escape");
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
    for (const label of ["双人对战", "人机对战", "无尽格", "双人对战", "人机对战", "无尽格"]) {
      findButton(h.root, label)?.fire("click");
      h.flush(5);
      peak = Math.max(peak, h.windowListeners());
      findButton(h.root, "回选关")?.fire("click");
      h.flush(2);
      expect(h.windowListeners(), `退出「${label}」后 window 上还留着监听`).toBe(base);
    }
    expect(peak).toBeGreaterThan(base);

    game.destroy();
    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });
});
