/**
 * `destroy()` 必须归零。
 *
 * 这一款在 `window` 上挂了 resize 与 keydown、开了主循环 rAF、
 * 版面还额外排了一帧 rAF，无尽模式的结算跳数又是一条独立的 rAF。
 * 玩家从矿洞退回首页、再从首页退出游戏，这些东西一样都不许留下 ——
 * 留一个 keydown 在上面，下一款游戏里按空格就会莫名其妙地放绳。
 *
 * 跑在 node 环境（没有 jsdom，也不许为此引依赖），DOM 桩在 `domStub.ts` 里，
 * 和 `platform12.test.ts` 共用同一份。
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
  const played: string[] = [];
  return mod.mount({
    root: h.root as unknown as HTMLElement,
    play: (n: string) => void played.push(n),
  } as never);
}

describe("1.2 destroy 归零", () => {
  it("首页进无尽、开挖、再 destroy：rAF、window 监听与节点全部清干净", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    const endless = findButton(h.root, "无尽矿井");
    expect(endless).not.toBeNull();
    endless?.fire("click");

    const dig = findButton(h.root, "开挖");
    expect(dig).not.toBeNull();
    dig?.fire("click");

    // 主循环那一帧和版面那一帧都排上了，跑几帧让游戏真的动起来
    expect(h.pendingFrames()).toBeGreaterThan(0);
    h.flush(6);
    expect(h.windowListeners()).toBeGreaterThan(before);
    expect(countNodes(h.root)).toBeGreaterThan(1);

    game.destroy();

    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
  });

  it("退出后再按空格不会有人接（keydown 真的摘掉了）", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    findButton(h.root, "无尽矿井")?.fire("click");
    findButton(h.root, "开挖")?.fire("click");
    h.flush(3);
    game.destroy();

    expect(h.windowListeners()).toBe(0);
    // 再跑几帧也不该冒出新的 rAF
    h.flush(3);
    expect(h.pendingFrames()).toBe(0);
  });

  it("反复进出无尽模式不会把监听越挂越多", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    let peak = 0;
    for (let i = 0; i < 3; i++) {
      findButton(h.root, "无尽矿井")?.fire("click");
      findButton(h.root, "开挖")?.fire("click");
      h.flush(4);
      peak = Math.max(peak, h.windowListeners());
      findButton(h.root, "换模式")?.fire("click");
      h.flush(2);
    }
    // 每一轮的峰值都一样，说明退出时摘干净了
    expect(peak).toBeLessThanOrEqual(2);
    game.destroy();
    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
  });
});
