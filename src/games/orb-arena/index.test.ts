import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeCanvas, FakeEl, installCanvasDom, type DomHarness } from "../__tests__/canvasDom";
import guide from "./guide";
import { endlessConfig, levelConfig, type OrbLevel } from "./levels";
import {
  ARENA_CONSTS,
  OA_CSS,
  WAVE_BREAK_MS,
  acceptsRepeat,
  afterWave,
  createRun,
  meta,
  mount,
  type Owner,
  type RunResult
} from "./index";

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
// 第 2 轮 learner:按住不放时系统的按键连发
// ---------------------------------------------------------------------------

describe("按住不放的时候", () => {
  beforeEach(() => {
    dom = installCanvasDom();
  });
  afterEach(() => dom.restore());

  it("方向键该跟着连发,分裂 / 吐球是一下算一下", () => {
    for (const k of ["w", "a", "s", "d", "W", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
      expect(acceptsRepeat(k)).toBe(true);
    }
    for (const k of ["f", "g", "F", "l", "k", "Escape", "Enter", " "]) {
      expect(acceptsRepeat(k)).toBe(false);
    }
  });

  it("按住吐球键,只吐第一下那一颗", () => {
    const { handle, sounds } = run();
    // 第一下是真按,后面九下是系统连发
    dom.pressKey("g");
    for (let i = 0; i < 9; i++) dom.pressKey("g", { repeat: true });
    // 起始质量 30,吐一颗掉 6 到 24;不拦连发的话第二下会接着吐到 18
    expect(sounds.filter((s) => s === "tap")).toHaveLength(1);
    handle.destroy();
  });

  it("连发的分裂键当场吃掉,不留给后面的分支", () => {
    const { handle } = run();
    // 真按一下:分裂键这条路不 preventDefault,交给页面
    expect(dom.pressKey("f")).toBe(false);
    // 连发的那些被拦下来
    expect(dom.pressKey("f", { repeat: true })).toBe(true);
    handle.destroy();
  });

  it("方向键连发照旧生效,松手才停", () => {
    const { handle } = run();
    expect(dom.pressKey("d")).toBe(true);
    expect(dom.pressKey("d", { repeat: true })).toBe(true);
    dom.releaseKey("d");
    dom.tick(2);
    handle.destroy();
  });
});

// ---------------------------------------------------------------------------
// 第 2 轮 learner:无尽两波之间的过场
// ---------------------------------------------------------------------------

describe("无尽一波打完之后", () => {
  it("赢了就报一句「第 N 波达成」,并把下一波号算好", () => {
    const step = afterWave(true, 3, 812.4, 900);
    expect(step.kind).toBe("next");
    expect(step.nextWave).toBe(4);
    expect(step.title).toBe("🎉 第 3 波达成！");
    expect(step.sub).toContain("812");
    expect(step.sub).toContain("第 4 波");
  });

  it("没赢就收场,波次归 1,纪录照写", () => {
    const step = afterWave(false, 7, 1234.6, 1500);
    expect(step.kind).toBe("over");
    expect(step.nextWave).toBe(1);
    expect(step.sub).toContain("1235");
    expect(step.sub).toContain("1500");
  });

  it("收场那句只鼓励,不打击", () => {
    const step = afterWave(false, 2, 100, 100);
    expect(step.title).not.toMatch(/输|失败|死|笨/);
    expect(step.sub).toContain("下一次");
  });

  it("坏数据进来也算得出来,不会冒出 NaN", () => {
    const step = afterWave(true, Number.NaN, Number.POSITIVE_INFINITY, Number.NaN);
    expect(step.nextWave).toBe(2);
    expect(step.title).not.toContain("NaN");
    expect(step.sub).not.toContain("NaN");
  });

  it("过场停顿是看得清但不磨叽的一段", () => {
    expect(WAVE_BREAK_MS).toBeGreaterThanOrEqual(800);
    expect(WAVE_BREAK_MS).toBeLessThanOrEqual(2500);
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
      // 画布钳高件挂载时排了一条 0ms 的补量,先冲掉,剩下的才是结算那一条
      vi.advanceTimersByTime(0);
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

  // 1.3 UX 走查:手机上开局画面停在顶部模式条那里,像没反应。
  // 模式条是 display:flex,浏览器自带的 [hidden]{display:none} 会被它顶掉,
  // CSS 里必须自己补一条,不然 hidden 属性设了也白设
  it("模式条的 [hidden] 在 CSS 里自己压回 display:none", () => {
    expect(OA_CSS).toContain(".oa-modebar[hidden]{display:none;}");
  });

  it("进关先收模式条,回选关再放出来", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    const bar = root.byClass("oa-modebar")[0];
    expect(bar.hidden).not.toBe(true);
    root.byClass("l99-node")[0].fire("click");
    expect(bar.hidden).toBe(true);
    root.byClass("l99-back")[0].fire("click");
    expect(bar.hidden).toBe(false);
    handle.destroy();
  });

  it("无尽模式的波次配置一直在加码", () => {
    expect(endlessConfig(5).targetMass).toBeGreaterThan(endlessConfig(1).targetMass);
  });
});

// ---------------------------------------------------------------------------
// 1.3 视觉契约(整帧级):drawPane 一帧画满、彩豆非纯色圆、排行榜头像、soft 降级。
// 资产级契约(果冻球/星光糖/刺球/光环逐个函数)在 art.test.ts。
// ---------------------------------------------------------------------------

describe("1.3 视觉契约:一帧画面", () => {
  beforeEach(() => {
    dom = installCanvasDom();
  });
  afterEach(() => {
    dom.restore();
    vi.restoreAllMocks();
  });

  it("绘制非空:推两帧后 fill/stroke 落笔数远超旧版阈值", () => {
    const { stage, handle } = run();
    dom.tick(2);
    const canvas = stage.byClass("oa-canvas")[0] as FakeCanvas;
    const inked = canvas.ctx.ops.filter((o) => o.op === "fill" || o.op === "stroke").length;
    expect(inked).toBeGreaterThan(60);
    handle.destroy();
  });

  it("彩豆不是纯色圆:食物与主体走径向渐变(createRadialGradient 被调用)", () => {
    // 把随机源钉在 0.6:6 颗彩豆全落在 (480,480),稳稳出现在玩家镜头里
    vi.spyOn(Math, "random").mockReturnValue(0.6);
    const { stage, handle } = run();
    dom.tick(2);
    const canvas = stage.byClass("oa-canvas")[0] as FakeCanvas;
    const grads = canvas.ctx.ops.filter((o) => o.op === "createRadialGradient").length;
    // 背景圆斑 7 + 彩豆 6 + 玩家果冻球 1,两帧起码 12 次
    expect(grads).toBeGreaterThanOrEqual(12);
    handle.destroy();
  });

  it("排行榜换头像小圆:每行一个 22px 果冻球画布,真的画了东西", () => {
    const { stage, handle } = run();
    dom.tick(2);
    const avas = stage.byClass("oa-ava") as FakeCanvas[];
    expect(avas).toHaveLength(2);
    for (const a of avas) expect(a.ctx.painted).toBeGreaterThan(0);
    expect(stage.byClass("oa-rname")[0].textContent).toContain("1.");
    handle.destroy();
  });

  it("soft(减弱动效)下整条管线照样出画面,不炸不空", () => {
    const g = globalThis as Record<string, unknown>;
    g.matchMedia = () => ({ matches: true });
    try {
      const { stage, handle } = run({ cfg: { ...tinyLevel(), viruses: 2, shrink: 4 } });
      dom.tick(2);
      const canvas = stage.byClass("oa-canvas")[0] as FakeCanvas;
      expect(canvas.ctx.painted).toBeGreaterThan(0);
      handle.destroy();
    } finally {
      delete g.matchMedia;
    }
  });
});
