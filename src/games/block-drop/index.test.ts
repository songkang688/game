import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeEl, installCanvasDom, type DomHarness } from "../__tests__/canvasDom";
import guide from "./guide";
import { DROP_CONSTS, acceptsRepeat, meta, mount } from "./index";

// ---------------------------------------------------------------------------
// 这一款是纯画布游戏,以前没有 index.test.ts:node 环境里 `getContext("2d")`
// 拿不到东西,一 mount 就炸。`../__tests__/canvasDom` 那套替身补齐之后才写得出来。
// 第 2 轮 learner 把「替身铺到 block-drop」这条落地在这里。
// ---------------------------------------------------------------------------

let dom: DomHarness;

function fakeApi(root: FakeEl) {
  const sounds: string[] = [];
  return {
    api: {
      root: root as unknown as HTMLElement,
      play: (n: string) => sounds.push(n),
      addStars: () => 0,
      getStars: () => 0,
      onWin: () => undefined,
      onLose: () => undefined
    },
    sounds
  };
}

describe("方块叠叠乐 · meta 与模块形状", () => {
  it("meta 原样再导出一遍", () => {
    expect(meta.id).toBe("block-drop");
    expect(meta.title).toBe("方块叠叠乐");
    expect(meta.modes).toContain("campaign");
  });

  it("攻略八段接得上,一关都不漏", () => {
    expect(guide.entries).toHaveLength(8);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries.at(-1)?.to).toBe(188);
    for (let i = 1; i < guide.entries.length; i++) {
      expect(guide.entries[i].from).toBe(guide.entries[i - 1].to + 1);
    }
  });

  it("钉住的常量还在", () => {
    expect(DROP_CONSTS.COLS).toBe(10);
    expect(DROP_CONSTS.VISIBLE_ROWS).toBeGreaterThan(0);
  });
});

describe("方块叠叠乐 · 整款游戏挂载", () => {
  beforeEach(() => {
    dom = installCanvasDom();
  });
  afterEach(() => dom.restore());

  it("模式入口 + 188 关选关地图都挂得出来,退出后监听归零", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const before = dom.globalListenerCount();
    const handle = mount(api);
    expect(root.byClass("l99-map")).toHaveLength(1);
    expect(root.byClass("bd-modebar").length).toBeGreaterThan(0);
    handle.destroy();
    expect(root.children).toHaveLength(0);
    expect(dom.globalListenerCount()).toBe(before);
  });

  it("销毁两次也不出事", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 第 2 轮 learner:按住不放时系统的按键连发
// ---------------------------------------------------------------------------

describe("方块叠叠乐 · 按住不放的时候", () => {
  it("挪左挪右、软降该跟着连发", () => {
    for (const k of ["a", "d", "s", "A", "D", "S", "ArrowLeft", "ArrowRight", "ArrowDown"]) {
      expect(acceptsRepeat(k)).toBe(true);
    }
  });

  it("硬降、旋转、暂存是一下算一下,连发一律不认", () => {
    for (const k of ["w", "W", "f", "g", "l", "k", "Shift", "Enter", "ArrowUp", " "]) {
      expect(acceptsRepeat(k)).toBe(false);
    }
  });

  it("硬降键在连发名单外 —— 手指多停半秒不会白倒掉一串方块", () => {
    // 真机取证：一次真按 ＋ 19 下连发，分数从 0 跳到 258、下一块队列走掉 4 个
    expect(acceptsRepeat("w")).toBe(false);
    expect(acceptsRepeat("ArrowUp")).toBe(false);
  });
});
