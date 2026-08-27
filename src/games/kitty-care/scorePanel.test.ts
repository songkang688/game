/**
 * 萌猫小屋 · 点击回调里重排版的那几条也得钳（窗口5 第2轮 档C · W5R2-C-01 阻断）。
 *
 * 第 2 轮测试员在时装小舞台（167–188 关）的 `👗 搭配` 任务上量到：挑完三件衣服之后
 * 翻出来的评分面板（规则行 + 每件一行 + 合计行，共 5 行）把交卷钮 `✨ 就这套上台`
 * 顶出屏幕，**四档视口 `elementFromPoint` 全部取不到**，`.ktc-wrap` 是
 * `overflow:visible / max-height:none`、一个可滚祖先都没有，真手指上滑 3 次
 * `scrollTop` 一格没动 —— 这一关通不了。
 *
 * 根因不在「内容天生太高」：同一个搭配任务在第 182 关四档全绿，差别只是那一关
 * 钳上了。`fitIntoStage()` 的钳制原先**只挂在 `renderTask()` 上**，而评分面板是在
 * 点击回调里长出来的（`drawScore()`），从头到尾没有再 `relayout()` 一次。
 * 看病的 `draw()`、搭配挑衣服的 `drawSlot()` 走的是同一条没人钳的路。
 *
 * 这里守两层：
 *  ① 源码结构 —— 三条点击回调重画路径都必须调 `this.refit()`，评分面板那条还要
 *    `this.refit(true)`（钳完把交卷钮送进视野，光「有得滚」孩子不会知道要滑）；
 *  ② 真行为 —— 拿一个能被量的假 `fit` 接进舞台，走完整个搭配流程，
 *    数 `relayout()` 到底调了几次、`scrollTop` 有没有真被写。
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Arena, type TaskSpec } from "./arena";
import { Life, type TimerHost } from "./runtime";
import { findAll, findOne, installDom, type InstalledDom, type StubEl } from "./domStub";

const SRC = readFileSync(new URL("./arena.ts", import.meta.url), "utf8");

/** 抠出一段源码（从 `from` 到 `to` 之间），找不到就让用例自己报错 */
function slice(from: string, to: string): string {
  const a = SRC.indexOf(from);
  expect(a, `源码里找不到 ${from}`).toBeGreaterThanOrEqual(0);
  const b = SRC.indexOf(to, a);
  expect(b, `源码里找不到 ${to}`).toBeGreaterThan(a);
  return SRC.slice(a, b);
}

/** 假时钟：一条真的 timer / rAF 都不许溜进来 */
class TinyClock {
  private seq = 1;
  readonly timers = new Map<number, () => void>();

  setTimeout(fn: () => void): ReturnType<typeof setTimeout> {
    const id = this.seq++;
    this.timers.set(id, fn);
    return id as unknown as ReturnType<typeof setTimeout>;
  }

  clearTimeout(id: ReturnType<typeof setTimeout>): void {
    this.timers.delete(id as unknown as number);
  }

  setInterval(): ReturnType<typeof setTimeout> {
    return this.seq++ as unknown as ReturnType<typeof setTimeout>;
  }

  clearInterval(): void {
    /* 本用例用不上 */
  }

  requestAnimationFrame(): number {
    return this.seq++;
  }

  cancelAnimationFrame(): void {
    /* 本用例用不上 */
  }
}

const SPEC = (task: TaskSpec["task"]): TaskSpec => ({
  task,
  target: 0,
  seed: 11,
  options: 3,
  playTaps: 3,
  notes: 3,
  cureSteps: 2,
  styleSlots: 3
});

describe("萌猫小屋 · 评分面板一撑高就得重新钳（W5R2-C-01 · 源码结构）", () => {
  it("refit() 就是「钳一次」的唯一入口，还能顺手把出口送进视野", () => {
    const fn = slice("private refit(", "private paintTask(");
    expect(fn, "钳的动作还是走 fitIntoStage 那一份").toContain("this.fit?.relayout()");
    expect(fn, "送进视野只许用最朴素的 scrollTop 赋值").toContain("root.scrollTop = root.scrollHeight");
    expect(fn, "scrollIntoView 连 overflow:hidden 都推得动，量出来的是假绿").not.toContain("scrollIntoView");
    expect(fn, "没得滚的时候别乱写 scrollTop").toContain("root.scrollHeight - root.clientHeight > 1");
  });

  it("renderTask() 这条老路仍然钳", () => {
    expect(slice("private renderTask(", "/**")).toContain("this.refit()");
  });

  it("搭配：挑衣服那一屏与评分面板都钳，评分面板还要把交卷钮送到眼前", () => {
    const drawSlot = slice("const drawSlot = (): void => {", "const drawScore = (): void => {");
    expect(drawSlot, "每一件的候选数不一样多，这一排的行数会变").toContain("this.refit()");

    const drawScore = slice("const drawScore = (): void => {", "drawSlot();\n  }");
    expect(drawScore, "评分面板是这条阻断的现场，必须钳").toContain("this.refit(true)");
    // 钳必须发生在把 tools 挂上去之后，不然量到的还是没长高的那一版
    expect(drawScore.indexOf("this.refit(true)")).toBeGreaterThan(drawScore.indexOf('el("div", "ktc-tools")'));
  });

  it("看病每按一步换一屏，同样得钳", () => {
    const draw = slice("const draw = (note?: string, miss = false): void => {", "    draw();");
    expect(draw).toContain("this.refit()");
  });
});

describe("萌猫小屋 · 搭配任务走一遍，钳与滚都真发生了（W5R2-C-01 · 真行为）", () => {
  let dom: InstalledDom;
  let life: Life;
  let host: StubEl;

  beforeEach(() => {
    dom = installDom();
    life = new Life(new TinyClock() as unknown as TimerHost);
    host = dom.doc.createElement("div");
  });

  afterEach(() => {
    life.destroy();
    dom.restore();
  });

  /** 接一个能被数的假钳子，并把小屋装成「装不下、有得滚」的样子 */
  function wire(arena: Arena): { calls: () => number; scrollTop: () => number } {
    const inner = arena as unknown as {
      fit: { relayout: () => void; dispose: () => void } | null;
      root: Record<string, unknown>;
    };
    let calls = 0;
    inner.fit = {
      relayout: () => {
        calls++;
      },
      dispose: () => {}
    };
    inner.root.scrollHeight = 900;
    inner.root.clientHeight = 300;
    inner.root.scrollTop = 0;
    return { calls: () => calls, scrollTop: () => Number(inner.root.scrollTop) };
  }

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

  it("挑完三件之后交卷钮在场，而且钳过、滚过", () => {
    const arena = makeArena();
    const probe = wire(arena);
    arena.startTask(SPEC("style"), () => {});

    const play = findOne(host, "ktc-play") as StubEl;
    expect(probe.calls(), "startTask 先走 renderTask 钳一次，drawSlot 摆完再钳一次").toBe(2);

    // 三个槽位各挑一件
    for (let slot = 0; slot < 3; slot++) {
      const options = findAll(play, "ktc-btn");
      expect(options.length, `第 ${slot + 1} 件没有候选`).toBeGreaterThan(0);
      options[0].fire("click");
    }

    const go = findAll(play, "ktc-mini").find((b) => b.textContent.includes("就这套上台"));
    expect(go, "评分面板没翻出来").toBeTruthy();
    expect(findOne(play, "ktc-score"), "评分面板本体不在").toBeTruthy();
    // 2 次 startTask（renderTask + 首屏 drawSlot）+ 3 次重画（两次挑衣服 + 一次评分面板）
    expect(probe.calls(), "点击回调里重画那几次一次都不许漏").toBe(5);
    expect(probe.scrollTop(), "钳完还得把交卷钮送进视野").toBe(900);
  });

  it("挑到一半退回来也不会漏钳：每挑一件都重排一次", () => {
    const arena = makeArena();
    const probe = wire(arena);
    arena.startTask(SPEC("style"), () => {});
    const play = findOne(host, "ktc-play") as StubEl;

    findAll(play, "ktc-btn")[0].fire("click");
    expect(probe.calls()).toBe(3);
    findAll(play, "ktc-btn")[0].fire("click");
    expect(probe.calls()).toBe(4);
    // 还没到评分面板，就不该乱滚
    expect(probe.scrollTop()).toBe(0);
  });

  it("「🔁 再搭一次」回到挑衣服那一屏，也得重新钳", () => {
    const arena = makeArena();
    const probe = wire(arena);
    arena.startTask(SPEC("style"), () => {});
    const play = findOne(host, "ktc-play") as StubEl;
    for (let slot = 0; slot < 3; slot++) findAll(play, "ktc-btn")[0].fire("click");

    const before = probe.calls();
    const again = findAll(play, "ktc-mini").find((b) => b.textContent.includes("再搭一次"));
    expect(again, "「再搭一次」不在").toBeTruthy();
    again?.fire("click");
    expect(probe.calls(), "回到挑衣服那一屏是另一种高度，还得钳").toBe(before + 1);
  });

  it("动物福利：这一条改动没往屏幕上添任何伤害词，也没添失败出口", () => {
    const arena = makeArena();
    wire(arena);
    arena.startTask(SPEC("style"), () => {});
    const play = findOne(host, "ktc-play") as StubEl;
    for (let slot = 0; slot < 3; slot++) findAll(play, "ktc-btn")[0].fire("click");
    const text = host.textContent;
    for (const bad of ["打针", "喂药", "伤口", "手术", "流血", "去世", "安乐死", "遗弃", "照顾失败", "失败"]) {
      expect(text, `屏幕上冒出了「${bad}」`).not.toContain(bad);
    }
  });
});
