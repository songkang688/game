/**
 * 萌猫小屋 · 躲纸箱出来之后护理进度不许清零
 * （1.2 窗口5 · 第 3 轮 · 档C，**W5-L-36，一般**）。
 *
 * 这一条第 1、2 轮既没证实也没证伪，第 3 轮测试员在真机上触发到了（C6，390×844 / 360×720）：
 *
 * | 第几下 | 心情条 | 护理进度 |
 * | --- | --- | --- |
 * | 1 | 80% | `1.🐾 看看小爪子 → 2.❓ 动手照顾 → 3.· · ·`（第 1 步已做对，绿了） |
 * | 5 | **0%** | 猫钻进纸箱，计划行 `hidden` |
 * | 安抚 3 次后 | 50% | **`1.❓ 先看一看 → 2.· · · → 3.· · ·`——刚做对的那一步凭空没了** |
 *
 * 根因测试员也定位好了：`renderCure()` 每被叫一次就新建一份渲染闭包，
 * 进度是那份闭包里的 `let state`——**重画一次就等于从第 1 步重开**。
 * 走到重画的路不止「躲纸箱出来」一条：多猫关里点一下目标猫
 * （`select()` → `renderTask()`）同样会清零，那一条前三轮谁都没记。
 *
 * 修法：把进度提到关卡实例上，认准是**同一件事**（同一个 `spec`）就接着上次走；
 * `startTask()` 换一件新事才从头来。
 *
 * 动物福利红线一并守在这儿：这一条改的是进度记账，
 * 不许因此多出任何失败出口（`ctx.lose` / `onLose`）或伤害词。
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Arena, type TaskSpec } from "./arena";
import { buildCureRound } from "./levels";
import { Life, type TimerHost } from "./runtime";
import { findAll, findOne, installDom, type InstalledDom, type StubEl } from "./domStub";

const ARENA_SRC = readFileSync(new URL("./arena.ts", import.meta.url), "utf8");

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
}

const SPEC: TaskSpec = {
  task: "cure",
  target: 0,
  seed: 5,
  options: 4,
  playTaps: 3,
  notes: 3,
  cureSteps: 3,
  styleSlots: 3
};

describe("护理进度熬得过一次重画（W5-L-36）", () => {
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

  const makeArena = (catCount = 1, moodMax = 0): Arena =>
    new Arena(host as unknown as HTMLElement, {
      life,
      sfx: () => {},
      catCount,
      moodStart: moodMax,
      moodMax,
      theme: 6,
      reduceMotion: true
    });

  const plan = (): string => findOne(host, "ktc-plan")!.textContent;
  const tools = (): StubEl[] => findAll(host, "ktc-btn");
  const round = buildCureRound(SPEC.seed, SPEC.cureSteps, Math.min(SPEC.options + 1, 6));

  /** 做对第 N 步（0 基） */
  const doStep = (i: number): void => {
    const name = round.steps[i].answer.name;
    const btn = tools().find((b) => b.getAttribute("aria-label") === name);
    expect(btn, `第 ${i + 1} 步的正确工具「${name}」不在护理台上`).toBeTruthy();
    btn!.fire("click");
  };

  it("做对一步之后重画（点一下猫）——第 1 步仍旧是绿的，不许退回「先看一看」", () => {
    const arena = makeArena();
    arena.startTask(SPEC, () => {});
    expect(plan()).toContain("1.❓");

    doStep(0);
    const afterStep = plan();
    expect(afterStep, "第 1 步做完，计划行该把做过的那件事写出来").toContain(round.steps[0].answer.name);

    // 重画的那条路：点一下目标猫（躲纸箱出来走的是同一个 renderTask()）
    arena.select(0);
    expect(plan(), "重画一次就退回第 1 步了——刚做对的那一步凭空没了").toBe(afterStep);
    expect(plan()).toContain(round.steps[0].answer.name);
  });

  it("做对两步之后重画：两步都还在", () => {
    const arena = makeArena();
    arena.startTask(SPEC, () => {});
    doStep(0);
    doStep(1);
    const before = plan();
    arena.select(0);
    expect(plan()).toBe(before);
    expect(plan()).toContain(round.steps[0].answer.name);
    expect(plan()).toContain(round.steps[1].answer.name);
  });

  it("护理台上摆的也得是「下一步」的工具，不是又回到第 1 步那一批", () => {
    const arena = makeArena();
    arena.startTask(SPEC, () => {});
    doStep(0);
    arena.select(0);
    const names = tools().map((b) => b.getAttribute("aria-label"));
    expect(names, "重画之后摆回了第 1 步的工具，孩子只能把同一步再做一遍").toContain(
      round.steps[1].answer.name,
    );
  });

  it("「↩ 退一步」照旧退得动，而且退完的位置也熬得过重画", () => {
    const arena = makeArena();
    arena.startTask(SPEC, () => {});
    doStep(0);
    doStep(1);
    findOne(host, "ktc-mini")!.fire("click");
    const backed = plan();
    arena.select(0);
    expect(plan()).toBe(backed);
  });

  it("换一件新事就从头来，绝不把上一件事的进度带过来", () => {
    const arena = makeArena();
    arena.startTask(SPEC, () => {});
    doStep(0);
    expect(plan()).toContain(round.steps[0].answer.name);

    arena.startTask({ ...SPEC, seed: 9 }, () => {});
    expect(plan(), "新的一件事该从第 1 步开始").toContain("1.❓");
  });

  it("同一件事重开（`startTask` 又拿同一个 spec 叫了一次）也从头来", () => {
    const arena = makeArena();
    arena.startTask(SPEC, () => {});
    doStep(0);
    arena.startTask(SPEC, () => {});
    expect(plan()).toContain("1.❓");
  });
});

describe("动物福利红线：这一修一格没踩", () => {
  it("`arena.ts` 里仍旧零 `ctx.lose` / 零 `onLose`", () => {
    expect(ARENA_SRC).not.toMatch(/\.lose\s*\(/);
    expect(ARENA_SRC).not.toMatch(/onLose\s*\(/);
  });

  it("进度只从一个入口写，写漏一处就又回到「重画即清零」", () => {
    const body = ARENA_SRC.slice(ARENA_SRC.indexOf("private renderCure("), ARENA_SRC.indexOf("// -- ⑦ 搭配"));
    expect(body).toContain("const keep = (next: CureState)");
    // curePick / cureBack 两条路都得走 keep()，不许再出现裸的 `state = res.state`
    expect(body).not.toMatch(/\n\s+state = res\.state;/);
    expect((body.match(/keep\(res\.state\)/g) ?? []).length).toBe(2);
  });

  it("换一件事必须清空，否则下一件事会顶着上一件的步数开局", () => {
    const body = ARENA_SRC.slice(ARENA_SRC.indexOf("startTask(spec: TaskSpec"), ARENA_SRC.indexOf("private stopLoops"));
    expect(body).toContain("this.cure = null");
  });
});
