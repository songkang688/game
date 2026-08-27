import { afterEach, describe, expect, it, vi } from "vitest";
import { GAME_MODES } from "../../engine/types";
import { hexToRgb } from "../../art/kit";
import { BLACK, WHITE, xy } from "./board";
import { levelAt, levelSolutions } from "./levels";
import {
  CURSOR_COLOR,
  PETAL_LIFE,
  PETAL_POOL_MAX,
  WQ_WOOD,
  drawCursorBox,
  drawDeadCross,
  drawKoFlower,
  drawLeafMark,
  drawSproutHint,
  harvestCount,
  harvestFlowersSVG,
  makePetalPool,
  resetStoneSprites,
  scoreBarParts,
  stoneSprite,
  trophySVG,
  washAlpha,
  type PetalPool
} from "./art";
import { FakeCtx2D, installDom, makeScheduler, type DomStub, type FakeCanvasEl } from "./testkit";
import {
  DUO_HINT,
  MODE_LABELS,
  WQ_CONSTS,
  WQ_CSS,
  boardMetrics,
  captureLine,
  captureStepMs,
  endlessLine,
  endlessTier,
  hitPoint,
  keyAction,
  levelSeconds,
  matchSay,
  meta,
  minHitSize,
  mount,
  mountPuzzle,
  puzzleSay,
  reducedMotion,
  saySentence
} from "./index";

let dom: DomStub | null = null;

afterEach(() => {
  dom?.restore();
  dom = null;
});

/** 记下这一行被写了几次:live 区看的是「写了几句」,不是「最后一句是什么」 */
function spyWrites(el: { textContent: string }): string[] {
  const writes: string[] = [];
  let value = el.textContent;
  Object.defineProperty(el, "textContent", {
    configurable: true,
    get: () => value,
    set: (v: string) => {
      value = v;
      writes.push(v);
    }
  });
  return writes;
}

function fakeApi(root: unknown): Parameters<typeof mount>[0] {
  return {
    root: root as HTMLElement,
    play: () => undefined,
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => undefined,
    onLose: () => undefined
  };
}

describe("weiqi-garden · meta 是纯数据卡片", () => {
  it("按规格逐字落地", () => {
    expect(meta.id).toBe("weiqi-garden");
    expect(meta.title).toBe("围子花园");
    expect(meta.emoji).toBe("⚫");
    expect(meta.category).toBe("party");
    expect(meta.color).toBe("#E8E4D8");
    expect(meta.blurb).toBe("先从九路花园下起。围空、打劫、数目或点目,慢慢走进十三路和十九路。");
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
  });

  it("四种模式都是壳认识的模式名", () => {
    expect([...meta.modes]).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    for (const m of meta.modes) expect(GAME_MODES as readonly string[]).toContain(m);
  });

  it("三个额外模式的入口都在", () => {
    expect(Object.keys(MODE_LABELS)).toEqual(["versus", "endless", "duo"]);
    expect(MODE_LABELS.duo).toContain("双人");
  });
});

describe("weiqi-garden · 360px 下的交叉点热区", () => {
  it("九路在 360px 宽的手机上完整入屏,热区 ≥ 28px", () => {
    const m = boardMetrics(9, 340);
    expect(m.cell).toBeGreaterThanOrEqual(28);
    expect(m.extent).toBeLessThanOrEqual(360);
    expect(minHitSize(9)).toBe(28);
  });

  it("十三路 / 十九路热区 ≥ 22px,画布放不下就交给外层滚动", () => {
    expect(minHitSize(13)).toBe(22);
    expect(minHitSize(19)).toBe(22);
    expect(boardMetrics(13, 340).cell).toBeGreaterThanOrEqual(22);
    expect(boardMetrics(19, 340).cell).toBeGreaterThanOrEqual(22);
    // 十九路在窄屏上一定超出可视宽度,所以必须能拖着看
    expect(boardMetrics(19, 340).extent).toBeGreaterThan(340);
  });

  it("放大之后格子更大,热区只会变宽不会变窄", () => {
    const one = boardMetrics(19, 340, 1);
    const two = boardMetrics(19, 340, 2);
    expect(two.cell).toBeGreaterThan(one.cell);
    expect(two.extent).toBeGreaterThan(one.extent);
    expect(boardMetrics(9, 0).cell).toBeGreaterThanOrEqual(28);
  });

  it("点在交叉点上认得出来,点在格子正中间不算数", () => {
    const m = boardMetrics(9, 340);
    for (const [x, y] of [
      [0, 0],
      [4, 4],
      [8, 8],
      [2, 7]
    ]) {
      expect(hitPoint(9, m, m.pad + x * m.cell, m.pad + y * m.cell)).toBe(y * 9 + x);
    }
    expect(hitPoint(9, m, m.pad + 0.5 * m.cell, m.pad + 0.5 * m.cell)).toBeNull();
    expect(hitPoint(9, m, -50, -50)).toBeNull();
    expect(hitPoint(9, m, m.pad + 20 * m.cell, m.pad)).toBeNull();
  });
});

describe("weiqi-garden · 键位", () => {
  it("方向键和 WASD 都能挪光标", () => {
    expect(keyAction("ArrowUp")).toBe("up");
    expect(keyAction("w")).toBe("up");
    expect(keyAction("ArrowDown")).toBe("down");
    expect(keyAction("s")).toBe("down");
    expect(keyAction("ArrowLeft")).toBe("left");
    expect(keyAction("a")).toBe("left");
    expect(keyAction("ArrowRight")).toBe("right");
    expect(keyAction("d")).toBe("right");
  });

  it("F 确认落子、G 停一手、Esc 暂停;星星那套 L / K 也认", () => {
    expect(keyAction("f")).toBe("confirm");
    expect(keyAction("F")).toBe("confirm");
    expect(keyAction("l")).toBe("confirm");
    expect(keyAction("g")).toBe("pass");
    expect(keyAction("k")).toBe("pass");
    expect(keyAction("Escape")).toBe("pause");
  });

  it("双人开局说明把两套键位分开写清楚,不会让星星去按朵朵的键", () => {
    for (const k of ["WASD", "F 落子", "G 停一手", "方向键", "L 落子", "K 停一手"]) {
      expect(DUO_HINT).toContain(k);
    }
    // 「F 确认,G 停一手」这种只写一套的说法不许再出现
    expect(DUO_HINT).not.toMatch(/点交叉点。F/);
  });

  it("没绑的键一律不认", () => {
    for (const k of ["z", "1", " ", "Tab", "Shift"]) expect(keyAction(k)).toBeNull();
  });
});

describe("weiqi-garden · 提子动效与文案", () => {
  it("提子一颗颗提走,每颗隔 80ms;省电模式缩到最短但顺序还在", () => {
    expect(captureStepMs(false)).toBe(80);
    expect(captureStepMs(true)).toBeGreaterThan(0);
    expect(captureStepMs(true)).toBeLessThan(captureStepMs(false));
    expect(WQ_CONSTS.captureStep).toBe(80);
  });

  it("提子的说法是请回篮子,没有打打杀杀", () => {
    expect(captureLine(3, WHITE)).toContain("篮子");
    expect(captureLine(3, WHITE)).toContain("星星");
    expect(captureLine(1, BLACK)).toContain("朵朵");
    expect(captureLine(0, BLACK)).toBe("");
    expect(captureLine(2, WHITE)).not.toMatch(/杀|死|血/);
  });

  it("没有 matchMedia 也不会炸", () => {
    expect(typeof reducedMotion()).toBe("boolean");
  });
});

describe("weiqi-garden · 无尽与闯关配置", () => {
  it("连胜越多对手越强,一路升到地狱档", () => {
    expect(endlessTier(0)).toBe("rookie");
    expect(endlessTier(1)).toBe("normal");
    expect(endlessTier(3)).toBe("expert");
    expect(endlessTier(6)).toBe("master");
    expect(endlessTier(99)).toBe("master");
  });

  it("无尽那行小字带着连胜数与历史最好成绩", () => {
    const line = endlessLine(2, 5);
    expect(line).toContain("连胜 2 场");
    expect(line).toContain("最好成绩 5 场");
    expect(endlessLine(7, 3)).toContain("最好成绩 7 场");
  });

  it("每关的时间上限够宽松,大棋盘给得更多", () => {
    expect(levelSeconds(levelAt(0))).toBeGreaterThanOrEqual(120);
    expect(levelSeconds(levelAt(180))).toBeGreaterThanOrEqual(150);
  });
});

describe("weiqi-garden · 样式红线", () => {
  const narrow = (() => {
    const at = WQ_CSS.indexOf("@media (max-width:360px)");
    return at < 0 ? "" : WQ_CSS.slice(at, WQ_CSS.indexOf("\n}", at));
  })();

  /** 取某条选择器的声明块(整份 CSS 里第一处) */
  const ruleOf = (selector: string): string => {
    const at = WQ_CSS.indexOf(`${selector}{`);
    return at < 0 ? "" : WQ_CSS.slice(at + selector.length + 1, WQ_CSS.indexOf("}", at));
  };

  it("有 360px 的窄屏段,也有 prefers-reduced-motion 段", () => {
    expect(narrow.length).toBeGreaterThan(40);
    expect(WQ_CSS).toContain("@media (prefers-reduced-motion:reduce)");
  });

  // 第 1 轮 W1-R1-02:窄屏块原本把正文压到 13px。现在正文一律交给 `--mt-body`(16px)兜底,
  // 窄屏只准压内边距;按钮那一档才允许落到 `--mt-control`(14px)。
  it("窄屏块里只剩按钮档的字号,正文一个都不许再压", () => {
    // 窄屏块里只准剩按钮那一档:写死也好、走变量也好,都不能低于 14px,且只能落在按钮身上
    for (const m of narrow.matchAll(/([.#][\w-]+)[^{}]*\{[^{}]*font-size:\s*([^;}]+)/g)) {
      expect(/-btn|-open|-back|-tool/.test(m[1]), `${m[1]} 不是按钮却在窄屏块里定了字号`).toBe(true);
      const px = /^(\d+)px$/.exec(m[2].trim());
      if (px) expect(Number(px[1]), `${m[1]}`).toBeGreaterThanOrEqual(14);
    }
  });

  it("正文靠 --mt-body 兜底", () => {
    for (const sel of [".wq-msg", ".wq-note", ".wq-rows", ".wq-chip", ".wq-lenstip", ".wq-label"]) {
      // 写死 16px 或走 var(--mt-body,16px) 都算,要的是结果不是写法
      const rule = ruleOf(sel);
      const px = /font-size:\s*(\d+)px/.exec(rule);
      const ok = rule.includes("--mt-body") || (px !== null && Number(px[1]) >= 16);
      expect(ok, `${sel} 的正文没到 16px:${rule.slice(0, 60)}`).toBe(true);
    }
  });

  it("按钮的点击区不小于 44px", () => {
    for (const sel of [".wq-btn", ".wq-open"]) {
      const m = /min-height:(\d+)px/.exec(ruleOf(sel));
      expect(m).not.toBeNull();
      expect(Number(m?.[1])).toBeGreaterThanOrEqual(44);
    }
  });

  it("样式里不写死 three.js / 外链字体这类东西", () => {
    expect(WQ_CSS).not.toContain("http");
    expect(WQ_CSS).not.toContain("@import");
  });
});

describe("weiqi-garden · 挂载与 destroy", () => {
  it("mount 是个函数,加载模块本身不碰 DOM", () => {
    expect(typeof mount).toBe("function");
    expect(typeof WQ_CONSTS.solutionsOf).toBe("function");
  });

  it("挂上去能画出选关地图,destroy 之后监听器一个不剩", () => {
    dom = installDom();
    const before = dom.globalCount();
    const handle = mount(fakeApi(dom.root));
    expect(dom.root.children.length).toBe(1);
    expect(dom.globalCount()).toBeGreaterThan(before);
    handle.destroy();
    expect(dom.globalCount()).toBe(before);
    expect(dom.root.children.length).toBe(0);
  });

  it("闯关里下出正确的那一手就过关,而且是三星", () => {
    dom = installDom();
    const sched = makeScheduler();
    const win = vi.fn();
    const lose = vi.fn();
    const level = levelAt(0);
    const answer = levelSolutions(level)[0];
    const handle = mountPuzzle(dom.root as unknown as HTMLElement, {
      level,
      sfx: () => undefined,
      win,
      lose,
      schedule: sched.schedule,
      unschedule: sched.unschedule,
      timed: false
    });
    // 光标从天元出发,用方向键挪到答案那个交叉点,再按 F 确认
    const from = xy(9, 4 * 9 + 4);
    const to = xy(9, answer);
    for (let i = 0; i < Math.abs(to.x - from.x); i++) dom.press(to.x > from.x ? "ArrowRight" : "ArrowLeft");
    for (let i = 0; i < Math.abs(to.y - from.y); i++) dom.press(to.y > from.y ? "ArrowDown" : "ArrowUp");
    dom.press("f");
    sched.flush();
    expect(lose).not.toHaveBeenCalled();
    expect(win).toHaveBeenCalledTimes(1);
    expect(win.mock.calls[0][0]).toBe(3);
    handle.destroy?.();
  });

  it("手数用完就温柔地收场,不批评人", () => {
    dom = installDom();
    const sched = makeScheduler();
    const win = vi.fn();
    const lose = vi.fn();
    const level = levelAt(0);
    const answer = levelSolutions(level)[0];
    const handle = mountPuzzle(dom.root as unknown as HTMLElement, {
      level,
      sfx: () => undefined,
      win,
      lose,
      schedule: sched.schedule,
      unschedule: sched.unschedule,
      timed: false
    });
    // 一直停一手,把手数耗光
    for (let i = 0; i < level.moveBudget; i++) dom.press("g");
    sched.flush();
    expect(win).not.toHaveBeenCalled();
    expect(lose).toHaveBeenCalledTimes(1);
    const text = String(lose.mock.calls[0][0] ?? "");
    expect(text).not.toMatch(/笨|差劲|不行|输了/);
    expect(answer).toBeGreaterThanOrEqual(0);
    handle.destroy?.();
  });

  it("闯关 destroy 之后监听器与待办定时器都清干净", () => {
    dom = installDom();
    const sched = makeScheduler();
    const before = dom.globalCount();
    const handle = mountPuzzle(dom.root as unknown as HTMLElement, {
      level: levelAt(0),
      sfx: () => undefined,
      win: () => undefined,
      lose: () => undefined,
      schedule: sched.schedule,
      unschedule: sched.unschedule,
      timed: false
    });
    expect(dom.globalCount()).toBeGreaterThan(before);
    handle.destroy?.();
    expect(dom.globalCount()).toBe(before);
    expect(sched.pending()).toBe(0);
    expect(dom.root.children.length).toBe(0);
  });

  it("暂停键按下去会切成继续,再按回去", () => {
    dom = installDom();
    const sched = makeScheduler();
    const handle = mountPuzzle(dom.root as unknown as HTMLElement, {
      level: levelAt(0),
      sfx: () => undefined,
      win: () => undefined,
      lose: () => undefined,
      schedule: sched.schedule,
      unschedule: sched.unschedule,
      timed: false
    });
    const pauseBtn = dom.root.all().find((el) => el.textContent.includes("暂停"));
    expect(pauseBtn).toBeDefined();
    dom.press("Escape");
    expect(pauseBtn?.textContent).toContain("继续");
    dom.press("Escape");
    expect(pauseBtn?.textContent).toContain("暂停");
    handle.destroy?.();
  });
});

describe("weiqi-garden · 读屏听得见盘面在变", () => {
  it("saySentence 只留有字的那几段,提示接在后面", () => {
    expect(saySentence(["第 3 手", "轮到朵朵（黑）"])).toBe("第 3 手,轮到朵朵（黑）。");
    expect(saySentence(["第 3 手", "  "], "成劫啦!")).toBe("第 3 手。成劫啦!");
    expect(saySentence([], "停了一手。")).toBe("停了一手。");
    expect(saySentence([], "   ")).toBe("");
  });

  it("对局那一句把手数、该谁下、两边提子都说全", () => {
    const line = matchSay(7, BLACK, { black: 2, white: 5 });
    expect(line).toContain("第 7 手");
    expect(line).toContain("轮到朵朵");
    expect(line).toContain("朵朵提了 2 颗");
    expect(line).toContain("星星提了 5 颗");
  });

  it("数一数阶段改播标死了几颗,不再报手数", () => {
    const line = matchSay(7, WHITE, { black: 0, white: 0 }, { counting: true, dead: 4 });
    expect(line).toContain("数一数");
    expect(line).toContain("已标死 4 颗");
    expect(line).not.toContain("第 7 手");
  });

  it("闯关那一句关心的是还剩几手", () => {
    expect(puzzleSay("battle", 2, 5, 0)).toBe("第 2 手,还剩 3 手。");
    expect(puzzleSay("markDead", 0, 5, 3, "点一下就能标上")).toBe("已标 3 颗。点一下就能标上");
    expect(puzzleSay("battle", 9, 5, 0)).toContain("还剩 0 手");
  });

  it("看不见的那一行靠 1px 收起来,不是 display:none", () => {
    expect(WQ_CSS).toContain(".wq-say{");
    const rule = WQ_CSS.slice(WQ_CSS.indexOf(".wq-say{"), WQ_CSS.indexOf("}", WQ_CSS.indexOf(".wq-say{")));
    expect(rule).toContain("width:1px");
    expect(rule).not.toContain("display:none");
  });

  it("闯关盘上真有这一行,提示行也是 status", () => {
    dom = installDom();
    const sched = makeScheduler();
    const handle = mountPuzzle(dom.root as unknown as HTMLElement, {
      level: levelAt(0),
      sfx: () => undefined,
      win: () => undefined,
      lose: () => undefined,
      schedule: sched.schedule,
      unschedule: sched.unschedule,
      timed: false
    });
    const say = dom.root.byClass("wq-say")[0];
    expect(say).toBeDefined();
    expect(say.getAttribute("role")).toBe("status");
    expect(say.getAttribute("aria-live")).toBe("polite");
    expect(say.getAttribute("aria-atomic")).toBe("true");
    const msg = dom.root.byClass("wq-msg")[0];
    expect(msg.getAttribute("role")).toBe("status");
    expect(msg.getAttribute("aria-live")).toBe("polite");
    handle.destroy?.();
  });

  it("停一手之后读屏那一行跟着变,而且不重复念同一句", () => {
    dom = installDom();
    const sched = makeScheduler();
    const level = levelAt(0);
    const handle = mountPuzzle(dom.root as unknown as HTMLElement, {
      level,
      sfx: () => undefined,
      win: () => undefined,
      lose: () => undefined,
      schedule: sched.schedule,
      unschedule: sched.unschedule,
      timed: false
    });
    const say = dom.root.byClass("wq-say")[0];
    const first = say.textContent;
    expect(first).toContain("第 0 手");
    dom.press("g");
    sched.flush();
    expect(say.textContent).toContain("第 1 手");
    expect(say.textContent).toContain("停了一手");
    dom.press("Escape");
    expect(say.textContent).toContain("先歇一会儿");
    handle.destroy?.();
  });

  it("倒计时每秒重画一次界面,读屏那一句不跟着重复念", () => {
    dom = installDom();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      const sched = makeScheduler();
      const handle = mountPuzzle(dom.root as unknown as HTMLElement, {
        level: levelAt(0),
        sfx: () => undefined,
        win: () => undefined,
        lose: () => undefined,
        schedule: sched.schedule,
        unschedule: sched.unschedule
      });
      const say = dom.root.byClass("wq-say")[0];
      const writes = spyWrites(say);
      const time = dom.root.byClass("wq-chip").find((c) => c.textContent.includes("秒"));
      expect(time).toBeDefined();
      vi.advanceTimersByTime(3000);
      // 秒数在走(界面确实重画了),但盘面没变,live 区一个字都不该重写
      expect(time?.textContent).toContain("117");
      expect(writes).toEqual([]);
      handle.destroy?.();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// 1.3 视觉契约:木盘 / 玉石子 sprite / 花瓣提子 / 标记形状通道 / 点击回归
// ---------------------------------------------------------------------------

/** 挂一局第 1 关(提子题),画布带记账 ctx */
function mountFirstLevel(stub: DomStub): {
  handle: ReturnType<typeof mountPuzzle>;
  sched: ReturnType<typeof makeScheduler>;
  canvas: FakeCanvasEl;
  pressAnswer: () => void;
} {
  const sched = makeScheduler();
  const level = levelAt(0);
  const handle = mountPuzzle(stub.root as unknown as HTMLElement, {
    level,
    sfx: () => undefined,
    win: () => undefined,
    lose: () => undefined,
    schedule: sched.schedule,
    unschedule: sched.unschedule,
    timed: false
  });
  const canvas = stub.root.byClass("wq-canvas")[0] as unknown as FakeCanvasEl;
  const answer = levelSolutions(level)[0];
  const pressAnswer = (): void => {
    const from = xy(9, 4 * 9 + 4);
    const to = xy(9, answer);
    for (let i = 0; i < Math.abs(to.x - from.x); i++) stub.press(to.x > from.x ? "ArrowRight" : "ArrowLeft");
    for (let i = 0; i < Math.abs(to.y - from.y); i++) stub.press(to.y > from.y ? "ArrowDown" : "ArrowUp");
    stub.press("f");
    sched.flush();
  };
  return { handle, sched, canvas, pressAnswer };
}

describe("weiqi-garden · 1.3 视觉契约:木盘与棋子", () => {
  it("一帧 draw() 的绘制调用非空,木盘走渐变 + 木纹而不是平涂", () => {
    resetStoneSprites();
    dom = installDom({ canvas: true });
    const { handle, canvas } = mountFirstLevel(dom);
    expect(canvas).toBeDefined();
    const ctx = canvas.ctx2d;
    expect(ctx.ops.length).toBeGreaterThan(0);
    expect(ctx.painted).toBeGreaterThan(0);
    // 木色线性渐变(左上亮右下暗)真的建了,而且两端色就是规格里的木色
    expect(ctx.count("createLinearGradient")).toBeGreaterThan(0);
    const stops = ctx.ops.filter((o) => o.op === "addColorStop").map((o) => o.args[1]);
    expect(stops).toContain(WQ_WOOD.top);
    expect(stops).toContain(WQ_WOOD.bottom);
    // 木纹曲线(quadraticCurveTo)也画了
    expect(ctx.count("quadraticCurveTo")).toBeGreaterThan(0);
    handle.destroy?.();
  });

  it("棋子不是纯色圆:满盘走 sprite 的 drawImage,离屏 sprite 上是径向渐变", () => {
    resetStoneSprites();
    dom = installDom({ canvas: true });
    const { handle, canvas } = mountFirstLevel(dom);
    // 第 1 关开局就有黑白子,主画布必须走 drawImage(19 路满盘 361 子的路径)
    expect(canvas.ctx2d.count("drawImage")).toBeGreaterThan(0);
    // 离屏 sprite 上真的画了径向渐变 + 高光,不是一笔 arc + fill
    const sprite = stoneSprite("black", 12, 1) as unknown as FakeCanvasEl;
    expect(sprite).not.toBeNull();
    expect(sprite.ctx2d.count("createRadialGradient")).toBeGreaterThan(0);
    expect(sprite.ctx2d.painted).toBeGreaterThan(1);
    handle.destroy?.();
  });

  it("黑白子 sprite 不相同,同尺寸缓存复用、变尺寸重建", () => {
    resetStoneSprites();
    dom = installDom({ canvas: true });
    const black = stoneSprite("black", 12, 1) as unknown as FakeCanvasEl;
    const white = stoneSprite("white", 12, 1) as unknown as FakeCanvasEl;
    expect(black).not.toBeNull();
    expect(white).not.toBeNull();
    expect(black).not.toBe(white);
    // 渐变端点各是各的色
    const stopsOf = (c: FakeCanvasEl): unknown[] => c.ctx2d.ops.filter((o) => o.op === "addColorStop").map((o) => o.args[1]);
    expect(stopsOf(black)).toContain("#5a554c");
    expect(stopsOf(white)).toContain("#ffffff");
    // 白子还多了蛤碁石弧纹与描边,笔数天然更多(除颜色外自带明暗差)
    expect(white.ctx2d.count("stroke")).toBeGreaterThan(black.ctx2d.count("stroke"));
    // 缓存契约:同尺寸复用同一张,变尺寸重建
    expect(stoneSprite("black", 12, 1)).toBe(black);
    expect(stoneSprite("black", 16, 1)).not.toBe(black);
    expect(stoneSprite("black", -1, 1)).toBeNull();
  });
});

describe("weiqi-garden · 1.3 视觉契约:提子花瓣", () => {
  it("提子触发花瓣粒子,0.35s 播完后对象池全部回收", () => {
    resetStoneSprites();
    dom = installDom({ canvas: true });
    const { handle, canvas, pressAnswer } = mountFirstLevel(dom);
    const pool = (canvas as unknown as { wqFx?: PetalPool }).wqFx;
    expect(pool).toBeDefined();
    expect(pool?.active()).toBe(0);
    pressAnswer();
    // 第 1 关是提子题:正解那一手必然提掉至少一颗白子 → 至少一朵花瓣
    expect(pool?.active()).toBeGreaterThan(0);
    // 花瓣是白子化的白瓣
    expect(pool?.petals.some((p) => p.active && p.kind === "white")).toBe(true);
    // 播完(寿命 0.35s,单帧限幅 0.25s → 两帧步完)全部归还池子
    pool?.step(PETAL_LIFE / 2 + 0.01);
    pool?.step(PETAL_LIFE / 2 + 0.01);
    expect(pool?.active()).toBe(0);
    expect(pool?.idle()).toBe(true);
    handle.destroy?.();
  });

  it("reducedMotion 下提子直接消失,一朵花瓣都不喷", () => {
    const g = globalThis as { matchMedia?: (q: string) => { matches: boolean } };
    const prev = g.matchMedia;
    g.matchMedia = () => ({ matches: true });
    try {
      resetStoneSprites();
      dom = installDom({ canvas: true });
      const { handle, canvas, pressAnswer } = mountFirstLevel(dom);
      const pool = (canvas as unknown as { wqFx?: PetalPool }).wqFx;
      pressAnswer();
      expect(pool?.active()).toBe(0);
      expect(pool?.idle()).toBe(true);
      handle.destroy?.();
    } finally {
      if (prev === undefined) delete g.matchMedia;
      else g.matchMedia = prev;
    }
  });

  it("花瓣池封顶 16 个槽位,回收之后能再借", () => {
    expect(PETAL_POOL_MAX).toBe(16);
    const pool = makePetalPool();
    for (let i = 0; i < 24; i++) pool.spawn(10 + i, 20, i % 2 === 0 ? "black" : "white");
    expect(pool.active()).toBe(PETAL_POOL_MAX);
    // reduced 一朵都不喷
    const calm = makePetalPool();
    expect(calm.spawn(5, 5, "black", { reduced: true })).toBe(false);
    expect(calm.active()).toBe(0);
    // 播完回收,槽位可以再借(单帧限幅 0.25s,多推两帧)
    pool.step(PETAL_LIFE / 2 + 0.01);
    pool.step(PETAL_LIFE / 2 + 0.01);
    expect(pool.idle()).toBe(true);
    expect(pool.spawn(1, 1, "black")).toBe(true);
    expect(pool.active()).toBe(1);
    // 非法输入不炸也不借
    expect(pool.spawn(Number.NaN, 0, "white")).toBe(false);
    pool.step(Number.NaN);
    expect(pool.active()).toBe(1);
    // 画一帧真的有落笔
    const ctx = new FakeCtx2D();
    pool.draw(ctx as never);
    expect(ctx.painted).toBeGreaterThan(0);
  });
});

describe("weiqi-garden · 1.3 视觉契约:标记形状通道与光标对比度", () => {
  it("发芽提示 / 枫叶最后一手 / 劫点小红花 / 死子叉纹:都有落笔且笔迹互不相同", () => {
    const draws: Array<[string, (ctx: FakeCtx2D) => void]> = [
      ["sprout", (c) => drawSproutHint(c as never, 50, 50, 12)],
      ["leaf", (c) => drawLeafMark(c as never, 50, 50, 12)],
      ["ko", (c) => drawKoFlower(c as never, 50, 50, 12)],
      ["cross", (c) => drawDeadCross(c as never, 50, 50, 12, "black")]
    ];
    const traces = new Map<string, string>();
    for (const [name, fn] of draws) {
      const ctx = new FakeCtx2D();
      fn(ctx);
      expect(ctx.painted, `${name} 没落笔`).toBeGreaterThan(0);
      traces.set(name, JSON.stringify(ctx.ops));
    }
    const values = [...traces.values()];
    expect(new Set(values).size).toBe(values.length);
    // 死子叉纹黑白两用:黑子白叉、白子墨叉(明度通道)
    const onWhite = new FakeCtx2D();
    drawDeadCross(onWhite as never, 50, 50, 12, "white");
    expect(JSON.stringify(onWhite.ops)).not.toBe(traces.get("cross"));
    // 极端输入不抛
    drawSproutHint(new FakeCtx2D() as never, Number.NaN, 0, 12);
    drawLeafMark(new FakeCtx2D() as never, 0, 0, -1);
  });

  it("键盘光标是圆角方框(不再是圆),颜色对木盘两端的对比度 ≥ 3:1", () => {
    const ctx = new FakeCtx2D();
    drawCursorBox(ctx as never, 50, 50, 14);
    expect(ctx.count("quadraticCurveTo")).toBeGreaterThanOrEqual(4);
    expect(ctx.count("arc")).toBe(0);
    expect(ctx.count("stroke")).toBeGreaterThan(0);

    const lum = (hex: string): number => {
      const rgb = hexToRgb(hex);
      expect(rgb, `${hex} 不是合法色`).not.toBeNull();
      const lin = (v: number): number => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      const { r, g, b } = rgb as { r: number; g: number; b: number };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const contrast = (a: string, b: string): number => {
      const la = lum(a);
      const lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    expect(contrast(CURSOR_COLOR, WQ_WOOD.top)).toBeGreaterThanOrEqual(3);
    expect(contrast(CURSOR_COLOR, WQ_WOOD.bottom)).toBeGreaterThanOrEqual(3);
  });

  it("数目铺色 washAlpha:波纹单调、t=1 全铺满、近处先亮、非法输入回 0", () => {
    expect(washAlpha(3, 10, 1)).toBe(1);
    expect(washAlpha(3, 10, 0)).toBe(0);
    // 同一点上,进度越走透明度只升不降
    let prev = 0;
    for (let t = 0; t <= 1.001; t += 0.1) {
      const a = washAlpha(5, 10, t);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
    // 同一时刻,离盘心近的点先被波前扫到
    expect(washAlpha(1, 10, 0.35)).toBeGreaterThanOrEqual(washAlpha(9, 10, 0.35));
    expect(washAlpha(Number.NaN, 10, 0.5)).toBe(0);
    expect(washAlpha(1, 10, Number.NaN)).toBe(0);
  });
});

describe("weiqi-garden · 1.3 视觉契约:结算可视化", () => {
  it("花园收成 ≤ 20 朵,目数差取整,和棋 0 朵", () => {
    expect(harvestCount(35.5)).toBe(20);
    expect(harvestCount(3.75)).toBe(4);
    expect(harvestCount(-6.5)).toBe(7);
    expect(harvestCount(0)).toBe(0);
    expect(harvestCount(Number.NaN)).toBe(0);
    const svg = harvestFlowersSVG(50, "black");
    expect(svg).toContain("<svg");
    // 花芯一朵一颗,封顶 20
    expect(svg.split('r="1.7"').length - 1).toBe(20);
    expect(harvestFlowersSVG(0, "white")).toBe("");
    // 黑紫瓣、白白瓣:两色收成不一样
    expect(harvestFlowersSVG(3, "black")).not.toBe(harvestFlowersSVG(3, "white"));
  });

  it("奖杯是矢量 SVG,双色条两边加起来正好 100%", () => {
    const svg = trophySVG();
    expect(svg).toContain("<svg");
    expect(svg).toContain("polygon");
    expect(svg).not.toContain("http");
    expect(scoreBarParts(0, 0)).toEqual({ black: 50, white: 50 });
    const parts = scoreBarParts(43, 38);
    expect(parts.black + parts.white).toBe(100);
    expect(parts.black).toBeGreaterThan(parts.white);
    expect(scoreBarParts(Number.NaN, 10)).toEqual({ black: 0, white: 100 });
  });
});

describe("weiqi-garden · 1.3 视觉契约:点击换算回归", () => {
  /** 1.2 基线的 hitPoint 公式,逐字照抄,谁改了换算立刻红 */
  function hitPointBaseline(
    size: number,
    m: ReturnType<typeof boardMetrics>,
    x: number,
    y: number
  ): number | null {
    const gx = Math.round((x - m.pad) / m.cell);
    const gy = Math.round((y - m.pad) / m.cell);
    if (gx < 0 || gy < 0 || gx >= size || gy >= size) return null;
    const dx = x - (m.pad + gx * m.cell);
    const dy = y - (m.pad + gy * m.cell);
    if (Math.hypot(dx, dy) > m.cell * 0.62) return null;
    return gy * size + gx;
  }

  it("hitPoint 与改版前完全一致:9 / 13 / 19 路(含 zoom)全域扫描", () => {
    for (const [size, width, zoom] of [
      [9, 340, 1],
      [13, 340, 1],
      [19, 340, 2]
    ] as const) {
      const m = boardMetrics(size, width, zoom);
      for (let x = -10; x <= m.extent + 10; x += 7) {
        for (let y = -10; y <= m.extent + 10; y += 7) {
          expect(hitPoint(size, m, x, y), `size=${size} (${x},${y})`).toBe(hitPointBaseline(size, m, x, y));
        }
      }
    }
  });

  it("boardMetrics 的坐标换算一个数都没动", () => {
    const m = boardMetrics(9, 340);
    const fit = 340 / 10;
    const cell = Math.max(28, fit);
    expect(m.cell).toBe(cell);
    expect(m.pad).toBe(cell * 0.7);
    expect(m.extent).toBe(Math.round(cell * 0.7 * 2 + cell * 8));
    expect(m.stone).toBe(cell * 0.46);
  });
});
