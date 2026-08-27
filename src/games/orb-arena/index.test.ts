import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeCanvas, FakeEl, installCanvasDom, type DomHarness } from "../__tests__/canvasDom";
import guide from "./guide";
import { endlessConfig, levelConfig, type OrbLevel } from "./levels";
import { ARENA_CONSTS, OA_CSS, createRun, meta, mount, type Owner, type RunResult } from "./index";

// ---------------------------------------------------------------------------
// 这一款是纯画布游戏,以前没有 index.test.ts:node 环境里 `getContext("2d")` 拿不到东西,
// 一 mount 就炸。第 2 轮补上 `../__tests__/canvasDom` 这套替身之后才写得出下面这些用例。
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

function tinyLevel(over: Partial<OrbLevel> = {}): OrbLevel {
  return {
    ...levelConfig(0),
    mapW: 800,
    mapH: 800,
    pellets: 6,
    viruses: 0,
    bots: 1,
    targetMass: 1e9,
    timeSec: 0,
    shrink: 0,
    ally: false,
    fog: false,
    ...over
  };
}

function run(over: Partial<Parameters<typeof createRun>[1]> = {}, owners?: Owner[]) {
  const stage = new FakeEl("div");
  const results: RunResult[] = [];
  const sounds: string[] = [];
  const handle = createRun(stage as unknown as HTMLElement, {
    cfg: tinyLevel(),
    owners: owners ?? [
      { id: "me", name: "朵朵", color: "#F5A9C8", human: "duo" },
      { id: "bot0", name: "糯糯", color: "#B8D8F6", tier: "rookie" }
    ],
    sfx: (n) => sounds.push(n),
    onDone: (r) => results.push(r),
    ...over
  });
  return { stage, handle, results, sounds };
}

describe("meta 与模块形状", () => {
  it("meta 原样再导出一遍,字段与规格对得上", () => {
    expect(meta.id).toBe("orb-arena");
    expect(meta.title).toBe("圆圆大作战");
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
  });

  it("攻略八段接得上,一关都不漏", () => {
    expect(guide.gameId).toBe("orb-arena");
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
  });

  it("钉住的常量还在", () => {
    expect(ARENA_CONSTS.MAX_CELLS).toBeGreaterThan(1);
    expect(ARENA_CONSTS.MIN_MASS).toBeGreaterThan(0);
    expect(ARENA_CONSTS.EAT_RATIO).toBeGreaterThan(1);
  });
});

describe("窄屏字号红线", () => {
  function ruleOf(css: string, selector: string): string {
    const at = css.indexOf(`${selector}{`);
    if (at < 0) return "";
    return css.slice(at + selector.length + 1, css.indexOf("}", at));
  }

  it("状态行是正文,基准与 360px 段都 ≥ 16px", () => {
    expect(ruleOf(OA_CSS, ".oa-msg")).toContain("font-size:16px");
    const at = OA_CSS.indexOf("@media (max-width:360px)");
    const narrow = OA_CSS.slice(at);
    expect(ruleOf(narrow, ".oa-msg")).not.toContain("font-size");
  });

  it("不引用任何图片、字体或外部地址", () => {
    expect(OA_CSS).not.toMatch(/url\(/);
    expect(OA_CSS).not.toMatch(/https?:/);
  });
});

describe("一局真的跑起来", () => {
  beforeEach(() => {
    dom = installCanvasDom();
  });
  afterEach(() => dom.restore());

  it("挂出画布与 HUD,推一帧就真的画了东西", () => {
    const { stage, handle } = run();
    const canvas = stage.byClass("oa-canvas")[0] as FakeCanvas;
    expect(canvas).toBeInstanceOf(FakeCanvas);
    expect(canvas.ctx.painted).toBe(0);
    dom.tick(2);
    expect(canvas.ctx.painted).toBeGreaterThan(0);
    expect(stage.byClass("oa-mass")[0].textContent).toContain("质量");
    handle.destroy();
  });

  it("双人同屏给两块画面,两套键位各管各的", () => {
    const { stage, handle } = run({}, [
      { id: "me", name: "朵朵", color: "#F5A9C8", human: "duo" },
      { id: "star", name: "星星", color: "#A9C8F5", human: "star" }
    ]);
    expect(stage.byClass("oa-canvas")).toHaveLength(2);
    expect(dom.pressKey("d")).toBe(true);
    expect(dom.pressKey("ArrowLeft")).toBe(true);
    dom.tick(3);
    handle.destroy();
  });

  it("Esc 自己拦下来,不让游戏壳再弹一层暂停", () => {
    const { stage, handle } = run();
    expect(dom.pressKey("Escape")).toBe(true);
    expect(stage.byClass("oa-msg")[0].textContent).toContain("暂停");
    expect(dom.pressKey("Escape")).toBe(true);
    expect(stage.byClass("oa-msg")[0].textContent).toContain("继续");
    handle.destroy();
  });
});

// ---------------------------------------------------------------------------
// 复现 learner 第 5 条:结算的 setTimeout 与画布指针监听都不在 destroy 的托管里
// ---------------------------------------------------------------------------

describe("destroy 之后不留东西", () => {
  beforeEach(() => {
    dom = installCanvasDom();
  });
  afterEach(() => dom.restore());

  it("键盘监听与排队中的 rAF 都归零", () => {
    const before = dom.globalListenerCount();
    const { stage, handle } = run();
    expect(dom.globalListenerCount("keydown")).toBe(1);
    dom.tick(2);
    expect(dom.frames.size).toBeGreaterThan(0);
    handle.destroy();
    expect(dom.globalListenerCount()).toBe(before);
    expect(dom.frames.size).toBe(0);
    expect(stage.children).toHaveLength(0);
  });

  it("画布上的 pointerdown / pointermove 监听也一起撤掉", () => {
    const { stage, handle } = run();
    const canvas = stage.byClass("oa-canvas")[0];
    expect(canvas.listeners.get("pointerdown")?.size).toBe(1);
    expect(canvas.listeners.get("pointermove")?.size).toBe(1);
    handle.destroy();
    expect(canvas.listeners.get("pointerdown")?.size ?? 0).toBe(0);
    expect(canvas.listeners.get("pointermove")?.size ?? 0).toBe(0);
  });

  it("结算那 320ms 里退出去,待触发的定时器一个都不许剩下", () => {
    // 只假造 setTimeout:rAF 归替身自己管,别让 sinon 把帧循环也接管了
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      // 限时 0.02 秒:推两帧就到点,finish 会排一个 320ms 的回调
      const { results, handle } = run({ cfg: tinyLevel({ timeSec: 0.02 }) });
      dom.tick(3, 20);
      expect(vi.getTimerCount()).toBe(1);
      handle.destroy();
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(1000);
      expect(results).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("不退出的话结算照旧在 320ms 后送出来", () => {
    // 只假造 setTimeout:rAF 归替身自己管,别让 sinon 把帧循环也接管了
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { results, handle } = run({ cfg: tinyLevel({ timeSec: 0.02 }) });
      dom.tick(3, 20);
      vi.advanceTimersByTime(400);
      expect(results).toHaveLength(1);
      expect(results[0].reason).toBe("time");
      handle.destroy();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("销毁两次也不出事,销毁后再推帧不会又画起来", () => {
    const { stage, handle } = run();
    const canvas = stage.byClass("oa-canvas")[0] as FakeCanvas;
    dom.tick(1);
    const painted = canvas.ctx.painted;
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
    dom.tick(5);
    expect(canvas.ctx.painted).toBe(painted);
  });
});

describe("整款游戏挂载", () => {
  beforeEach(() => {
    dom = installCanvasDom();
  });
  afterEach(() => dom.restore());

  it("三个模式入口 + 188 关选关地图都挂得出来,退出后监听归零", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const before = dom.globalListenerCount();
    const handle = mount(api);
    expect(root.byClass("oa-open").map((b) => b.textContent)).toEqual(["🤝 圆圆混战", "♾️ 缩圈无尽", "👫 双人同屏"]);
    expect(root.byClass("l99-map")).toHaveLength(1);
    handle.destroy();
    expect(root.children).toHaveLength(0);
    expect(dom.globalListenerCount()).toBe(before);
  });

  it("无尽模式的波次配置一直在加码", () => {
    expect(endlessConfig(5).targetMass).toBeGreaterThan(endlessConfig(1).targetMass);
  });
});
