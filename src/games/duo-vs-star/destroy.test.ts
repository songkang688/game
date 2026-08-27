/**
 * `destroy()` 必须归零。
 *
 * 本款在 `window` 上挂了 keydown / keyup / blur / resize 四样,
 * 主循环是一条 rAF,倒计时和结算延时排在 `window.setTimeout` 里(自己收在 `timers` 集合中)。
 * 玩家从对局退回菜单、从菜单退出游戏,这些东西一样都不许留下 ——
 * 留一个 keydown 在上面,下一款游戏里按 F 就会莫名其妙地挥一下。
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

describe("朵朵大战星星 · 1.2 destroy 归零", () => {
  it("停在菜单就 destroy:window 监听、rAF、节点都回到挂载前", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    expect(findButton(h.root, "双人对战"), "菜单上没有双人对战").not.toBeNull();

    game.destroy();
    expect(h.windowListeners()).toBe(before);
    expect(h.pendingFrames()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });

  it("开一局人机混战再 destroy:rAF、四个 window 监听、排着的 setTimeout 全清掉", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    findButton(h.root, "人机混战")?.fire("click");
    const go = findButton(h.root, "开打") ?? findButton(h.root, "开始");
    expect(go, "人机混战里没有开打按钮").not.toBeNull();
    go?.fire("click");

    expect(h.pendingFrames()).toBeGreaterThan(0);
    h.flush(10);
    expect(h.windowListeners()).toBeGreaterThan(before);

    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
  });

  it("退出后再按键 / 再放一帧都没人接", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    findButton(h.root, "人机混战")?.fire("click");
    (findButton(h.root, "开打") ?? findButton(h.root, "开始"))?.fire("click");
    h.flush(6);
    game.destroy();

    expect(h.windowListeners()).toBe(0);
    h.key("keydown", "KeyF");
    h.key("keyup", "KeyF");
    h.fireWindow("blur");
    h.fireWindow("resize");
    h.flush(4);
    expect(h.pendingFrames()).toBe(0);
  });

  it("反复进出对局,window 监听不会越挂越多", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    const base = h.windowListeners();
    let peak = 0;
    for (let i = 0; i < 3; i++) {
      findButton(h.root, "人机混战")?.fire("click");
      (findButton(h.root, "开打") ?? findButton(h.root, "开始"))?.fire("click");
      h.flush(6);
      peak = Math.max(peak, h.windowListeners());
      // 对局顶栏的「◀ 返回」回上一层,拆的是同一套监听
      const back = findButton(h.root, "◀ 返回");
      expect(back, "对局顶栏上没有返回键").not.toBeNull();
      back?.fire("click");
      h.flush(2);
      expect(h.windowListeners(), `第 ${i + 1} 次退出对局后 window 上还留着监听`).toBe(base);
    }
    expect(peak).toBeGreaterThan(base);

    game.destroy();
    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(countNodes(h.root)).toBe(1);
  });
});
