import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeCanvas, FakeEl, installCanvasDom, type DomHarness } from "../__tests__/canvasDom";
import { accessoryFor } from "./art";
import guide from "./guide";
import { endlessConfig, levelConfig, type SnakeLevel } from "./levels";
import { SKINS, SKIN_KEY } from "./skins";
import {
  ROYALE_CONSTS,
  SR_CSS,
  WAVE_BREAK_MS,
  afterWave,
  createRun,
  makeBots,
  meta,
  mount,
  type Owner,
  type RunResult
} from "./index";

// ---------------------------------------------------------------------------
// 同 `orb-arena`:这一款也是纯画布,以前没有 index.test.ts。
// 第 2 轮补 `../__tests__/canvasDom` 替身之后,destroy 的托管才验得动。
// ---------------------------------------------------------------------------

let dom: DomHarness;

function tinyLevel(over: Partial<SnakeLevel> = {}): SnakeLevel {
  return { ...levelConfig(0), mapR: 600, food: 5, bots: 1, timeSec: 0, shrink: 0, fog: false, ...over };
}

function run(over: Partial<Parameters<typeof createRun>[1]> = {}, owners?: Owner[]) {
  const stage = new FakeEl("div");
  const results: RunResult[] = [];
  const sounds: string[] = [];
  const handle = createRun(stage as unknown as HTMLElement, {
    cfg: tinyLevel(),
    owners: owners ?? [
      { id: "me", name: "朵朵", color: "#F5A9C8", human: "duo", skin: SKINS[0] },
      ...makeBots(1, "rookie")
    ],
    sfx: (n) => sounds.push(n),
    onDone: (r) => results.push(r),
    ...over
  });
  return { stage, handle, results, sounds };
}

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

describe("meta 与模块形状", () => {
  it("meta 原样再导出一遍,字段与规格对得上", () => {
    expect(meta.id).toBe("snake-royale");
    expect(meta.title).toBe("长蛇争霸");
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
  });

  it("攻略八段接得上,一关都不漏", () => {
    expect(guide.gameId).toBe("snake-royale");
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
  });

  it("淘汰动画不许瞬间消失", () => {
    expect(ROYALE_CONSTS.FADE_SEC).toBeGreaterThanOrEqual(0.25);
    expect(ROYALE_CONSTS.FADE_SEC).toBeLessThanOrEqual(0.4);
  });
});

describe("窄屏字号红线", () => {
  function ruleOf(css: string, selector: string): string {
    const at = css.indexOf(`${selector}{`);
    if (at < 0) return "";
    return css.slice(at + selector.length + 1, css.indexOf("}", at));
  }

  it("状态行是正文,基准与 360px 段都 ≥ 16px", () => {
    expect(ruleOf(SR_CSS, ".sr-msg")).toContain("font-size:16px");
    const narrow = SR_CSS.slice(SR_CSS.indexOf("@media (max-width:360px)"));
    expect(ruleOf(narrow, ".sr-msg")).not.toContain("font-size");
  });

  it("不引用任何图片、字体或外部地址", () => {
    expect(SR_CSS).not.toMatch(/url\(/);
    expect(SR_CSS).not.toMatch(/https?:/);
  });
});

describe("一局真的跑起来", () => {
  beforeEach(() => {
    dom = installCanvasDom();
  });
  afterEach(() => dom.restore());

  it("挂出画布与 HUD,推一帧就真的画了东西", () => {
    const { stage, handle } = run();
    const canvas = stage.byClass("sr-canvas")[0] as FakeCanvas;
    expect(canvas).toBeInstanceOf(FakeCanvas);
    expect(canvas.ctx.painted).toBe(0);
    dom.tick(2);
    expect(canvas.ctx.painted).toBeGreaterThan(0);
    expect(stage.byClass("sr-len")[0].textContent).toContain("长度");
    handle.destroy();
  });

  it("双人同屏给两块画面,两套键位各管各的", () => {
    const { stage, handle } = run({ split: true }, [
      { id: "me", name: "朵朵", color: "#F5A9C8", human: "duo", skin: SKINS[0] },
      { id: "star", name: "星星", color: "#A9C8F5", human: "star", skin: SKINS[3] }
    ]);
    expect(stage.byClass("sr-canvas")).toHaveLength(2);
    expect(dom.pressKey("d")).toBe(true);
    expect(dom.pressKey("ArrowLeft")).toBe(true);
    dom.tick(3);
    handle.destroy();
  });

  it("Esc 自己拦下来,不让游戏壳再弹一层暂停", () => {
    const { stage, handle } = run();
    expect(dom.pressKey("Escape")).toBe(true);
    expect(stage.byClass("sr-msg")[0].textContent).toContain("暂停");
    expect(dom.pressKey("Escape")).toBe(true);
    expect(stage.byClass("sr-msg")[0].textContent).toContain("继续");
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
    const canvas = stage.byClass("sr-canvas")[0];
    expect(canvas.listeners.get("pointerdown")?.size).toBe(1);
    expect(canvas.listeners.get("pointermove")?.size).toBe(1);
    handle.destroy();
    expect(canvas.listeners.get("pointerdown")?.size ?? 0).toBe(0);
    expect(canvas.listeners.get("pointermove")?.size ?? 0).toBe(0);
  });

  it("结算那 340ms 里退出去,待触发的定时器一个都不许剩下", () => {
    // 只假造 setTimeout:rAF 归替身自己管,别让 sinon 把帧循环也接管了
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
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

  it("不退出的话结算照旧在 340ms 后送出来", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { results, handle } = run({ cfg: tinyLevel({ timeSec: 0.02 }) });
      dom.tick(3, 20);
      vi.advanceTimersByTime(400);
      expect(results).toHaveLength(1);
      handle.destroy();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("销毁两次也不出事,销毁后再推帧不会又画起来", () => {
    const { stage, handle } = run();
    const canvas = stage.byClass("sr-canvas")[0] as FakeCanvas;
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

  it("三个模式入口 + 皮肤条 + 188 关选关地图都挂得出来,退出后监听归零", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const before = dom.globalListenerCount();
    const handle = mount(api);
    expect(root.byClass("sr-open").map((b) => b.textContent)).toEqual(["🤝 原野混战", "♾️ 缩圈无尽", "👫 双人同屏"]);
    expect(root.byClass("sr-skin").length).toBe(SKINS.length);
    expect(root.byClass("l99-map")).toHaveLength(1);
    handle.destroy();
    expect(root.children).toHaveLength(0);
    expect(dom.globalListenerCount()).toBe(before);
  });

  // 1.3 UX 走查:手机上开局画面停在顶部模式条那里,像没反应。
  // 模式条是 display:flex,浏览器自带的 [hidden]{display:none} 会被它顶掉,
  // CSS 里必须自己补一条,不然 hidden 属性设了也白设
  it("模式条的 [hidden] 在 CSS 里自己压回 display:none", () => {
    expect(SR_CSS).toContain(".sr-modebar[hidden]{display:none;}");
  });

  it("进关先收模式条与皮肤架,回选关再放出来", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    const bar = root.byClass("sr-modebar")[0];
    // 皮肤条被收起的是它外面那层宿主 div,不是 .sr-skins 本身
    const skinHost = root.byClass("sr-skins")[0].parent!;
    expect(bar.hidden).not.toBe(true);
    root.byClass("l99-node")[0].fire("click");
    expect(bar.hidden).toBe(true);
    expect(skinHost.hidden).toBe(true);
    root.byClass("l99-back")[0].fire("click");
    expect(bar.hidden).toBe(false);
    expect(skinHost.hidden).toBe(false);
    handle.destroy();
  });

  it("换皮肤只写自家那一个 key,不碰平台存档", () => {
    const root = new FakeEl("div");
    const { api } = fakeApi(root);
    const handle = mount(api);
    const first = root.byClass("sr-skin").find((b) => !b.disabled);
    first?.fire("click");
    expect([...dom.storage.keys()]).toEqual([SKIN_KEY]);
    handle.destroy();
  });

  it("无尽模式的波次配置一直在加码", () => {
    expect(endlessConfig(5).bots).toBeGreaterThanOrEqual(endlessConfig(1).bots);
  });
});

// ---------------------------------------------------------------------------
// 第 2 轮 learner:无尽两波之间的过场
// ---------------------------------------------------------------------------

describe("无尽一波打完之后", () => {
  it("赢了就报一句「第 N 波达成」,并把下一波号算好", () => {
    const step = afterWave(true, 4, 233.7, 400);
    expect(step.kind).toBe("next");
    expect(step.nextWave).toBe(5);
    expect(step.title).toBe("🎉 第 4 波达成！");
    expect(step.sub).toContain("234");
    expect(step.sub).toContain("第 5 波");
  });

  it("没赢就收场,波次归 1,最长纪录照写", () => {
    const step = afterWave(false, 6, 311.2, 987);
    expect(step.kind).toBe("over");
    expect(step.nextWave).toBe(1);
    expect(step.sub).toContain("第 6 波");
    expect(step.sub).toContain("311");
    expect(step.sub).toContain("987");
  });

  it("收场那句只鼓励,不打击", () => {
    const step = afterWave(false, 2, 80, 80);
    expect(step.title).not.toMatch(/输|失败|死|笨/);
    expect(step.sub).toContain("下一次");
  });

  it("坏数据进来也算得出来,不会冒出 NaN", () => {
    const step = afterWave(true, Number.NaN, Number.NaN, Number.POSITIVE_INFINITY);
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
// 1.3 视觉契约(整帧):drawPane 不再是「圆和线」两种图元
// ---------------------------------------------------------------------------

describe("1.3 视觉契约:整帧绘制", () => {
  beforeEach(() => {
    dom = installCanvasDom();
  });
  afterEach(() => dom.restore());

  /** ops 里找一段连续 lineTo 的最大长度:只有五角星这种多顶点路径才拉得长 */
  function longestLineToRun(ops: { op: string }[]): number {
    let cur = 0;
    let best = 0;
    for (const o of ops) {
      if (o.op === "lineTo") {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 0;
      }
    }
    return best;
  }

  it("一帧的绘制调用数远超旧阈值,画面密度上来了", () => {
    const { stage, handle } = run({ cfg: tinyLevel({ food: 240 }) });
    const canvas = stage.byClass("sr-canvas")[0] as FakeCanvas;
    dom.tick(2);
    expect(canvas.ctx.painted).toBeGreaterThan(40);
    handle.destroy();
  });

  it("星光豆带渐变与五角星路径,不再是单次 arc+fill", () => {
    const { stage, handle } = run({ cfg: tinyLevel({ food: 240 }) });
    const canvas = stage.byClass("sr-canvas")[0] as FakeCanvas;
    dom.tick(2);
    const ops = canvas.ctx.ops;
    expect(ops.some((o) => o.op === "createRadialGradient")).toBe(true);
    expect(longestLineToRun(ops)).toBeGreaterThanOrEqual(9);
    handle.destroy();
  });

  it("P1 与 P2 的头饰走不同分支(形状+颜色双通道)", () => {
    expect(accessoryFor("duo")).toBe("bow");
    expect(accessoryFor("star")).toBe("cap");
    expect(accessoryFor(undefined)).toBeNull();
  });

  it("soft(prefers-reduced-motion)关掉罗盘扫描线等动效分支", () => {
    const owners: Owner[] = [{ id: "me", name: "朵朵", color: "#F5A9C8", human: "duo", skin: SKINS[0] }];
    const g = globalThis as { matchMedia?: (q: string) => { matches: boolean } };
    const saved = g.matchMedia;
    g.matchMedia = () => ({ matches: true });
    let softRotates = 0;
    try {
      const softRun = run({ cfg: tinyLevel({ fog: true }) }, owners);
      dom.tick(2);
      const ops = (softRun.stage.byClass("sr-canvas")[0] as FakeCanvas).ctx.ops;
      softRotates = ops.filter((o) => o.op === "rotate").length;
      softRun.handle.destroy();
    } finally {
      if (saved === undefined) delete g.matchMedia;
      else g.matchMedia = saved;
    }
    const fullRun = run({ cfg: tinyLevel({ fog: true }) }, owners);
    dom.tick(2);
    const fullOps = (fullRun.stage.byClass("sr-canvas")[0] as FakeCanvas).ctx.ops;
    const fullRotates = fullOps.filter((o) => o.op === "rotate").length;
    fullRun.handle.destroy();
    // 每帧:蛇头椭圆 1 次 rotate;非 soft 再加罗盘扫描线的 rotate
    expect(softRotates).toBeGreaterThan(0);
    expect(fullRotates).toBeGreaterThan(softRotates);
  });

  it("死亡蛇走 X 眼分支且 fade 淡出仍生效:fade 期间还在画,fade 完才消失", () => {
    // 两条人类蛇相向直行,必然头对头一起退场
    const owners: Owner[] = [
      { id: "me", name: "朵朵", color: "#F5A9C8", human: "duo", skin: SKINS[0] },
      { id: "star", name: "星星", color: "#A9C8F5", human: "star", skin: SKINS[3] }
    ];
    const { stage, handle, sounds } = run({ cfg: tinyLevel({ food: 0 }) }, owners);
    const canvas = stage.byClass("sr-canvas")[0] as FakeCanvas;
    // 头对头相撞前最多推 4 秒(50ms 一帧)
    for (let i = 0; i < 80 && !sounds.includes("oops"); i++) dom.tick(1, 50);
    expect(sounds).toContain("oops");
    // fade 期间(FADE_SEC=0.34s):两颗带 X 眼的头仍然在画 → 每帧 2 次 rotate
    canvas.ctx.ops.length = 0;
    dom.tick(1, 50);
    const fadingRotates = canvas.ctx.ops.filter((o) => o.op === "rotate").length;
    expect(fadingRotates).toBe(2);
    // fade 走完之后蛇消失,但原野照画
    dom.tick(10, 50);
    canvas.ctx.ops.length = 0;
    dom.tick(1, 50);
    expect(canvas.ctx.ops.filter((o) => o.op === "rotate").length).toBe(0);
    expect(canvas.ctx.painted).toBeGreaterThan(0);
    handle.destroy();
  });

  it("结算结果带上长度曲线采样,给奖杯页画曲线", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { results, handle } = run({ cfg: tinyLevel({ timeSec: 0.02 }) });
      dom.tick(3, 20);
      vi.advanceTimersByTime(400);
      expect(results).toHaveLength(1);
      expect(Array.isArray(results[0].curve)).toBe(true);
      expect(results[0].curve.length).toBeGreaterThanOrEqual(1);
      expect(results[0].curve[results[0].curve.length - 1]).toBeGreaterThan(0);
      handle.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
