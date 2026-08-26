/**
 * `destroy()` 必须归零(规格第九节最后一条)。
 *
 * 这一款在 `window` 上挂了 keydown / keyup / resize,开了主循环那条 rAF,
 * 摇杆与技能钮上还有一串 pointer 监听。玩家从竞技场退回选关地图、
 * 再从首页退出游戏,这些东西一样都不许留下 —— 留一个 keydown 在上面,
 * 下一款游戏里按 W 就会莫名其妙地有人走位。
 *
 * 跑在 node 环境(没有 jsdom,也不许为此引依赖),DOM 桩在 `domStub.ts` 里,
 * 和 `platform12.test.ts` 共用同一份。
 */
import { afterEach, describe, expect, it } from "vitest";
import { countNodes, findButton, findOne, install, type Harness } from "./domStub";

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

async function mountGame(
  h: Harness,
  initialLevel?: number,
  play: (n: string) => void = () => {},
): Promise<{ destroy: () => void }> {
  const mod = await import("./index");
  return mod.mount({
    root: h.root as unknown as HTMLElement,
    play,
    addStars: (n: number) => n,
    ...(initialLevel === undefined ? {} : { initialLevel }),
  } as never);
}

describe("1.2 destroy 归零", () => {
  it("直达一关打几帧再 destroy:rAF、window 监听与节点全部清干净", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h, 6);
    expect(findOne(h.root, "mcr-canvas")).not.toBeNull();
    h.flush(8);

    expect(h.pendingFrames()).toBeGreaterThan(0);
    expect(h.windowListeners()).toBeGreaterThan(before);
    expect(countNodes(h.root)).toBeGreaterThan(1);

    game.destroy();

    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
  });

  it("退出后再按 W / F 不会有人接(keydown、keyup 真的摘掉了)", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h, 2);
    h.flush(4);
    game.destroy();

    expect(h.windowListeners()).toBe(0);
    // 摘干净了就没人接这几下,再跑几帧也不该冒出新的 rAF
    h.key("keydown", "w");
    h.key("keydown", "f");
    h.flush(3);
    expect(h.pendingFrames()).toBe(0);
  });

  it("反复进出无尽 / 合作 / 对战不会把监听越挂越多", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    let peak = 0;
    for (const label of ["无尽守家", "双人合作", "各守一半", "无尽守家"]) {
      findButton(h.root, label)?.fire("click");
      h.flush(5);
      peak = Math.max(peak, h.windowListeners());
      findButton(h.root, "回选关")?.fire("click");
      h.flush(2);
    }
    // 每一轮的峰值都一样(keydown / keyup / resize 三个),说明退出时摘干净了
    expect(peak).toBe(3);
    game.destroy();
    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
  });

  it("destroy 之后竞技场的对象池也放手了,不会攥着上一局的怪不放", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h, 30);
    h.flush(40);
    game.destroy();
    // 节点收干净 = 画布、摇杆、技能钮、覆盖层一个不剩
    expect(countNodes(h.root)).toBe(1);
    expect(findOne(h.root, "mcr-canvas")).toBeNull();
    expect(findOne(h.root, "mcr-stick")).toBeNull();
  });

  it("退出后不再响一声:音效全走 api.play,destroy 之后这条线彻底哑掉", async () => {
    const h = install();
    harness = h;
    const heard: string[] = [];
    const game = await mountGame(h, 8, (n) => heard.push(n));
    // 开局那张成长卡先挑掉,再按住技能钮甩一阵
    h.flush(1);
    for (let i = 0; i < 4 && findOne(h.root, "mcr-card"); i++) {
      findOne(h.root, "mcr-card")?.fire("click");
      h.flush(1);
    }
    findOne(h.root, "mcr-fire")?.fire("pointerdown");
    h.flush(200, 48);
    // 打了一小会儿,出手 / 命中 / 清怪总得响过
    expect(heard.length).toBeGreaterThan(0);

    game.destroy();
    heard.length = 0;
    h.flush(60, 48);
    h.key("keydown", "f");
    h.flush(20, 48);
    expect(heard).toEqual([]);
  });
});
