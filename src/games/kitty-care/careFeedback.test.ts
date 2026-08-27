/**
 * 萌猫小屋 · 「孩子到底看得见什么」的回归（窗口5 第1轮 学习优化员）。
 *
 * 对应测试员档C 的三条：
 *
 * - **W5C-K03（一般）**：看病做岔那句针对性的话被同一 tick 的通用提示盖掉，屏幕上只剩通用提示。
 * - **W5C-K04（一般）**：洗澡的「无指针兜底」步进 2 又夹住末格，覆盖率封顶 53%，走这条路洗不完。
 * - **W5C-K05（建议）**：通关拿到收藏后模式条上的相册计数不刷新。
 *
 * 动物福利红线一并在这里守：这三条改的都是**反馈**，不许因此多出任何失败出口
 * 或伤害词。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Arena, type TaskSpec } from "./arena";
import { AlbumStore, ALBUM_TOTAL, claimDrop } from "./album";
import { buildCureRound } from "./levels";
import {
  WASH_TARGET,
  buildWash,
  cureHint,
  cureMessage,
  curePick,
  cureStart,
  nextWashCell,
  scrub,
  washCellCenter,
  washCoverage
} from "./tasks";
import { Life, type TimerHost } from "./runtime";
import {
  fakeWallet,
  findAll,
  findOne,
  installDom,
  memoryStorage,
  type InstalledDom,
  type StubEl
} from "./domStub";

/** 假时钟：不让真的 setTimeout 混进来 */
class TinyClock {
  private seq = 1;
  readonly timers = new Map<number, () => void>();
  readonly loops = new Map<number, () => void>();
  readonly frames = new Map<number, (t: number) => void>();

  setTimeout(fn: () => void): ReturnType<typeof setTimeout> {
    const id = this.seq++;
    this.timers.set(id, fn);
    return id as unknown as ReturnType<typeof setTimeout>;
  }

  clearTimeout(id: ReturnType<typeof setTimeout>): void {
    this.timers.delete(id as unknown as number);
  }

  setInterval(fn: () => void): ReturnType<typeof setTimeout> {
    const id = this.seq++;
    this.loops.set(id, fn);
    return id as unknown as ReturnType<typeof setTimeout>;
  }

  clearInterval(id: ReturnType<typeof setTimeout>): void {
    this.loops.delete(id as unknown as number);
  }

  requestAnimationFrame(fn: (t: number) => void): number {
    const id = this.seq++;
    this.frames.set(id, fn);
    return id;
  }

  cancelAnimationFrame(id: number): void {
    this.frames.delete(id);
  }

  runTimers(): void {
    const list = [...this.timers.values()];
    this.timers.clear();
    for (const fn of list) fn();
  }
}

const SPEC: TaskSpec = {
  task: "cure",
  target: 0,
  seed: 5,
  options: 4,
  playTaps: 3,
  notes: 3,
  cureSteps: 2,
  styleSlots: 3
};

describe("萌猫小屋 · 看病做岔的那句话必须留在屏幕上（W5C-K03）", () => {
  let dom: InstalledDom;
  let clock: TinyClock;
  let life: Life;
  let host: StubEl;

  beforeEach(() => {
    dom = installDom();
    clock = new TinyClock();
    life = new Life(clock as unknown as TimerHost);
    host = dom.doc.createElement("div");
  });

  afterEach(() => {
    life.destroy();
    dom.restore();
  });

  function makeArena(): Arena {
    return new Arena(host as unknown as HTMLElement, {
      life,
      sfx: () => {},
      catCount: 1,
      moodStart: 0,
      moodMax: 0,
      theme: 6,
      reduceMotion: true
    });
  }

  /** 护理台上现在摆着的那几件工具 */
  function tools(): StubEl[] {
    return findAll(host, "ktc-btn");
  }

  it("顺序反了：屏幕上留下的是「先看一看再动手」，不是那句谁都一样的通用提示", () => {
    const arena = makeArena();
    arena.startTask(SPEC, () => {});
    const round = buildCureRound(SPEC.seed, SPEC.cureSteps, Math.min(SPEC.options + 1, 6));
    const state = cureStart(round);
    const generic = cureHint(state);
    expect(generic.length).toBeGreaterThan(0);
    expect(findOne(host, "ktc-msg")!.textContent, "还没动手时给的就是通用提示").toBe(generic);

    const answer = round.steps[0].answer.name;
    const wrong = round.steps[0].options.find((t) => t.name !== answer && t.kind !== round.steps[0].answer.kind);
    expect(wrong, "这一步得有一个类别不同的选项才测得出来").toBeTruthy();
    const targeted = curePick(state, wrong!.name).note;
    expect(targeted).not.toBe(generic);

    tools().find((b) => b.getAttribute("aria-label") === wrong!.name)!.fire("click");

    const shown = findOne(host, "ktc-msg")!.textContent;
    expect(shown, "针对性的指导被通用提示盖掉了").toBe(targeted);
    expect(arena.mistakes).toBe(1);
    // 做岔了照样能接着做，护理台还在
    expect(tools().length).toBeGreaterThan(0);
  });

  it("做对一步：既报「第 N 步做好了」，也把下一步该做哪一类接在后面", () => {
    const arena = makeArena();
    arena.startTask(SPEC, () => {});
    const round = buildCureRound(SPEC.seed, SPEC.cureSteps, Math.min(SPEC.options + 1, 6));
    const first = curePick(cureStart(round), round.steps[0].answer.name);
    expect(first.done).toBe(false);

    tools().find((b) => b.getAttribute("aria-label") === round.steps[0].answer.name)!.fire("click");

    const shown = findOne(host, "ktc-msg")!.textContent;
    expect(shown).toContain(first.note);
    expect(shown).toContain(cureHint(first.state));
    expect(arena.mistakes).toBe(0);
  });

  it("退一步：屏幕上留的是「退回第 N 步」，不是被通用提示顶掉", () => {
    makeArena().startTask(SPEC, () => {});
    const round = buildCureRound(SPEC.seed, SPEC.cureSteps, Math.min(SPEC.options + 1, 6));
    tools().find((b) => b.getAttribute("aria-label") === round.steps[0].answer.name)!.fire("click");
    findOne(host, "ktc-mini")!.fire("click");
    expect(findOne(host, "ktc-msg")!.textContent).toContain("退回第 1 步");
  });

  it("cureMessage 的三条口径：做岔只留针对性的，做对就接上提示，没话说就给提示", () => {
    expect(cureMessage("先看一看再动手～", "挑一样「看一看」。", true)).toBe("先看一看再动手～");
    expect(cureMessage("第 1 步做好了～", "挑一件温柔的日常照顾。", false)).toBe("第 1 步做好了～挑一件温柔的日常照顾。");
    expect(cureMessage(undefined, "挑一样「看一看」。")).toBe("挑一样「看一看」。");
    expect(cureMessage("", "挑一样「看一看」。")).toBe("挑一样「看一看」。");
    expect(cureMessage("护理做完啦！", "")).toBe("护理做完啦！");
    expect(cureMessage("  ", "  ")).toBe("");
  });
});

describe("萌猫小屋 · 洗澡的无指针兜底要真的搓得完（W5C-K04）", () => {
  let dom: InstalledDom;
  let clock: TinyClock;
  let life: Life;
  let host: StubEl;

  beforeEach(() => {
    dom = installDom();
    clock = new TinyClock();
    life = new Life(clock as unknown as TimerHost);
    host = dom.doc.createElement("div");
  });

  afterEach(() => {
    life.destroy();
    dom.restore();
  });

  it("没有指针坐标时，一下一下点也能把覆盖率推过 90%", () => {
    const arena = new Arena(host as unknown as HTMLElement, {
      life,
      sfx: () => {},
      catCount: 1,
      moodStart: 0,
      moodMax: 0,
      theme: 6,
      reduceMotion: true
    });
    let done = 0;
    // 测试桩的 getBoundingClientRect 宽高都是 0，走的正好是「拿不到指针坐标」那条兜底
    arena.startTask({ ...SPEC, task: "wash", washCols: 6, washRows: 5 }, () => {
      done++;
    });
    const pad = findOne(host, "ktc-wash")!;
    const fill = findOne(host, "ktc-coverfill")!;

    let last = 0;
    for (let i = 0; i < 40 && last < WASH_TARGET * 100; i++) {
      pad.fire("click");
      const now = Number.parseInt(fill.style.width ?? "0", 10) || 0;
      expect(now, `第 ${i + 1} 下之后覆盖率退了`).toBeGreaterThanOrEqual(last);
      last = now;
    }
    expect(last, "点了 40 下还是搓不到九成").toBeGreaterThanOrEqual(WASH_TARGET * 100);
    clock.runTimers();
    expect(done, "覆盖率够了却没判完成").toBe(1);
    expect(arena.mistakes, "兜底路径不许算做岔").toBe(0);
  });

  it("nextWashCell 只挑还没搓过的那一格，绕一圈都搓完就收手", () => {
    const empty = buildWash(6, 5);
    expect(nextWashCell(empty)).toBe(0);
    expect(nextWashCell(empty, 7)).toBe(7);
    // 越界的起点绕回来，不会算出负数或 undefined
    expect(nextWashCell(empty, 30)).toBe(0);
    expect(nextWashCell(empty, -1)).toBe(29);
    expect(nextWashCell({ cols: 0, rows: 0, cells: [], done: false }), "一格都没有时别去猜").toBe(-1);

    // 一格一格挑着搓：每一下都真的有进展，最后一定收敛
    let state = buildWash(6, 5);
    let from = 0;
    const touched = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const idx = nextWashCell(state, from);
      if (idx < 0) break;
      expect(state.cells[idx], "挑中了一个已经搓过的格子").toBe(false);
      touched.add(idx);
      from = idx + 1;
      const c = washCellCenter(state, idx);
      state = scrub(state, c.x, c.y).state;
      if (state.done) break;
    }
    expect(washCoverage(state)).toBeGreaterThanOrEqual(WASH_TARGET);
    expect(touched.size).toBeGreaterThan(0);
  });

  it("全搓完之后再问一次就是 −1（不会一直重复搓最后那一格）", () => {
    const full = buildWash(3, 3);
    full.cells.fill(true);
    expect(nextWashCell(full)).toBe(-1);
    expect(nextWashCell(full, 5)).toBe(-1);
  });
});

describe("萌猫小屋 · 通关掉了收藏就得让计数当场跟上（W5C-K05）", () => {
  it("claimDrop 掉到东西就喊一声，收齐了就不喊", () => {
    const store = new AlbumStore(fakeWallet(0), memoryStorage());
    let refreshed = 0;
    const line = claimDrop(store, 0, () => {
      refreshed++;
    });
    expect(refreshed, "拿到收藏却没通知模式条").toBe(1);
    expect(line).toContain(`1/${ALBUM_TOTAL}`);
    expect(store.count()).toBe(1);

    // 一路收齐
    for (let lv = 1; lv < ALBUM_TOTAL; lv++) claimDrop(store, lv, () => refreshed++);
    expect(refreshed).toBe(ALBUM_TOTAL);
    expect(store.count()).toBe(ALBUM_TOTAL);

    const after = claimDrop(store, 99, () => {
      refreshed++;
    });
    expect(refreshed, "已经收齐了还在瞎喊").toBe(ALBUM_TOTAL);
    expect(after).toBe("小屋相册已经收集齐啦！");
  });

  it("不给回调也不会炸（闯关以外的地方照旧能用）", () => {
    const store = new AlbumStore(fakeWallet(0), memoryStorage());
    expect(() => claimDrop(store, 3)).not.toThrow();
    expect(store.count()).toBe(1);
  });
});
