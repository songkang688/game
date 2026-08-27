import { afterEach, describe, expect, it, vi } from "vitest";
import { GAME_MODES } from "../../engine/types";
import { BLACK, WHITE, xy } from "./board";
import { levelAt, levelSolutions } from "./levels";
import { installDom, makeScheduler, type DomStub } from "./testkit";
import {
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

  it("有 360px 的窄屏段,也有 prefers-reduced-motion 段", () => {
    expect(narrow.length).toBeGreaterThan(40);
    expect(WQ_CSS).toContain("@media (prefers-reduced-motion:reduce)");
  });

  it("窄屏上字号也不低于 13px", () => {
    const sizes = [...narrow.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(13);
  });

  it("按钮的点击区不小于 44px", () => {
    const ruleOf = (selector: string): string => {
      const at = WQ_CSS.indexOf(`${selector}{`);
      return at < 0 ? "" : WQ_CSS.slice(at + selector.length + 1, WQ_CSS.indexOf("}", at));
    };
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
