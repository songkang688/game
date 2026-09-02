import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeCanvas, FakeEl, installCanvasDom, type DomHarness } from "../__tests__/canvasDom";
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

// ---------------------------------------------------------------------------
// 1.3 第 2 步 C · 视觉升级的集成契约:真实挂载 → 进一局 → 看画布上发生了什么。
// 替身环境没有 drawImage,主画布会走直绘分支,渐变调用直接落在主上下文上。
// ---------------------------------------------------------------------------

describe("方块叠叠乐 · 1.3 视觉升级(整局集成)", () => {
  beforeEach(() => {
    dom = installCanvasDom();
  });
  afterEach(() => dom.restore());

  /** 挂载 → 点「马拉松 / 竞速」→ 选马拉松,开出一张单人桌 */
  function intoMarathon(root: FakeEl): void {
    const modeBtn = root.byClass("bd-open").find((b) => b.textContent.includes("马拉松"));
    expect(modeBtn).toBeTruthy();
    modeBtn?.fire("click");
    const pick = root.byClass("bd-open").find((b) => b.textContent.includes("🏃"));
    expect(pick).toBeTruthy();
    pick?.fire("click");
  }

  it("一帧 draw() 非空,且格子走过渐变分支(不再是单色矩形)", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    intoMarathon(root);
    dom.tick(2);
    const main = root.byClass("bd-canvas")[0] as FakeCanvas;
    expect(main).toBeTruthy();
    expect(main.ctx.painted).toBeGreaterThan(0);
    expect(main.ctx.ops.some((o) => o.op === "createLinearGradient")).toBe(true);
    handle.destroy();
  });

  it("暂存 / 下一个是画出来的迷你画布,不再是字母串", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    intoMarathon(root);
    dom.tick(2);
    const holdCv = root.byClass("bd-hold-cv")[0] as FakeCanvas;
    const nextCv = root.byClass("bd-next-cv")[0] as FakeCanvas;
    expect(holdCv).toBeTruthy();
    expect(nextCv).toBeTruthy();
    // 非空白:虚位框 / 真形状的迷你块都算画了东西
    expect(holdCv.ctx.painted).toBeGreaterThan(0);
    expect(nextCv.ctx.painted).toBeGreaterThan(0);
    // 老版的「下一个 I O T」字母串不复存在
    const minis = root.byClass("bd-mini");
    expect(minis.some((m) => /下一个 [IOTSZJL]/.test(m.textContent))).toBe(false);
    handle.destroy();
  });

  it("井壁与网格画在主画布上:画布比 10 列井宽出两面井壁", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    intoMarathon(root);
    dom.tick(1);
    const main = root.byClass("bd-canvas")[0] as FakeCanvas;
    // cellPx 26 → 井 260,再加左右各 6px 井壁
    expect(main.width).toBe(10 * 26 + 12);
    expect(main.height).toBe(20 * 26 + 8);
    handle.destroy();
  });

  it("对战席位卡:P1 粉 / P2 蓝名牌都挂出来", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    const versusBtn = root.byClass("bd-open").find((b) => b.textContent.includes("对战"));
    expect(versusBtn).toBeTruthy();
    versusBtn?.fire("click");
    const rookie = root.byClass("bd-open").find((b) => b.textContent.includes("菜鸟"));
    expect(rookie).toBeTruthy();
    rookie?.fire("click");
    dom.tick(2);
    expect(root.byClass("bd-name-p1")).toHaveLength(1);
    expect(root.byClass("bd-name-p2")).toHaveLength(1);
    // 两块场地画布都真的在画
    const canvases = root.byClass("bd-canvas") as FakeCanvas[];
    expect(canvases).toHaveLength(2);
    for (const cv of canvases) expect(cv.ctx.painted).toBeGreaterThan(0);
    handle.destroy();
  });

  it("退出模式后画布与监听一并撤干净(视觉层不漏东西)", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const before = dom.globalListenerCount();
    const handle = mount(api);
    intoMarathon(root);
    dom.tick(2);
    handle.destroy();
    expect(root.children).toHaveLength(0);
    expect(dom.globalListenerCount()).toBe(before);
  });
});
