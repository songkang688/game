/**
 * 萌猫小屋 · 照顾马拉松的秒表回归（窗口5 第1轮 学习优化员）。
 *
 * 盯死测试员在 `docs/qa/1.2-window5-round1-tester.md` 档C 记的两条：
 *
 * - **W5C-K01（严重）**：每开一轮都挂一个新秒表、旧的又没人停，
 *   第 N 轮就有 N 个在减同一个 `left`，倒计时快 N 倍（实测第 6 轮约 8 秒／秒）。
 * - **W5C-K02（一般）**：超时那一下把哨兵值直接画到徽章上，闪出「⏳ Infinity 秒」。
 *
 * 这里用一台攥得住 timer 的假时钟真的把马拉松跑起来，逐轮量倒计时：
 * **每拍只许掉 1 秒**，而且屏幕上任何时候都不许出现 Infinity / NaN。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mountEndless } from "./index";
import { ENDLESS_SKIP_BADGE, endlessClockText, endlessRound } from "./endless";
import { Life, type TimerHost } from "./runtime";
import { findOne, installDom, type InstalledDom, type StubEl } from "./domStub";
import type { GameApi } from "../level99";

/** 假时钟：秒表一个都跑不掉，测得出「同一时刻究竟有几个在走」 */
class TestClock {
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

  /** 所有秒表各走一拍（真实世界里 1 秒） */
  tick(): void {
    for (const fn of [...this.loops.values()]) fn();
  }

  /** 把到期的延时跑一遍 */
  runTimers(): void {
    const list = [...this.timers.values()];
    this.timers.clear();
    for (const fn of list) fn();
  }
}

function fakeApi(root: StubEl): GameApi {
  return {
    root: root as unknown as HTMLElement,
    play: () => {},
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {}
  };
}

/** 徽章上那句倒计时（`setBadges` 的第一格） */
function clockBadge(host: StubEl): string {
  return findOne(host, "ktc-clock")?.textContent ?? "";
}

/** 「⏳ 33 秒」→ 33；不是秒数就返回 null */
function badgeSeconds(host: StubEl): number | null {
  const hit = /(-?\d+)\s*秒/.exec(clockBadge(host));
  return hit ? Number(hit[1]) : null;
}

describe("萌猫小屋 · 照顾马拉松的秒表（W5C-K01 / W5C-K02）", () => {
  let dom: InstalledDom;
  let clock: TestClock;
  let host: StubEl;
  let handle: { destroy: () => void } | null;

  beforeEach(() => {
    dom = installDom();
    clock = new TestClock();
    host = dom.doc.createElement("div");
    handle = null;
  });

  afterEach(() => {
    handle?.destroy();
    dom.restore();
  });

  function start(): void {
    handle = mountEndless(host, fakeApi(host), () => {}, clock as unknown as TimerHost);
  }

  /** 让当前这一轮超时，然后把下一轮开起来 */
  function timeoutRound(): void {
    for (let i = 0; i < 400; i++) {
      if (badgeSeconds(host) === null) break;
      clock.tick();
    }
    clock.runTimers();
  }

  it("开局第 1 轮：只有一个秒表在走，每拍正好掉 1 秒", () => {
    start();
    expect(badgeSeconds(host)).toBe(endlessRound(1).timeSec);
    for (let i = 1; i <= 5; i++) {
      clock.tick();
      expect(badgeSeconds(host), `第 ${i} 拍`).toBe(endlessRound(1).timeSec - i);
    }
  });

  it("连开 8 轮，每一轮都还是 1 秒／秒——旧秒表没有一个活着叠加", () => {
    start();
    for (let round = 1; round <= 8; round++) {
      const want = endlessRound(round).timeSec;
      expect(badgeSeconds(host), `第 ${round} 轮开局秒数`).toBe(want);
      clock.tick();
      expect(badgeSeconds(host), `第 ${round} 轮走一拍只该掉 1 秒`).toBe(want - 1);
      clock.tick();
      expect(badgeSeconds(host), `第 ${round} 轮走两拍只该掉 2 秒`).toBe(want - 2);
      timeoutRound();
    }
  });

  it("秒表数量不随轮次涨：任何时候至多一个倒计时 + 一个拍子灯", () => {
    start();
    for (let round = 1; round <= 9; round++) {
      expect(clock.loops.size, `第 ${round} 轮开局挂了太多循环`).toBeLessThanOrEqual(2);
      clock.tick();
      expect(clock.loops.size, `第 ${round} 轮走一拍之后挂了太多循环`).toBeLessThanOrEqual(2);
      timeoutRound();
    }
  });

  it("超时那一下不许把哨兵值画给孩子看，也不许继续往下减", () => {
    start();
    const seen: string[] = [];
    for (let i = 0; i < 400; i++) {
      seen.push(clockBadge(host));
      if (badgeSeconds(host) === null) break;
      clock.tick();
    }
    expect(seen.length).toBeGreaterThan(3);
    for (const text of seen) {
      expect(text, "倒计时徽章上出现了哨兵值").not.toMatch(/Infinity|NaN|undefined/);
    }
    expect(clockBadge(host)).toBe(ENDLESS_SKIP_BADGE);
    // 秒表已经停了：再走几拍屏幕也不会往负数跑
    clock.tick();
    clock.tick();
    expect(clockBadge(host)).toBe(ENDLESS_SKIP_BADGE);
  });

  it("退出马拉松：秒表、延时、动画帧一个都不剩", () => {
    start();
    clock.tick();
    expect(clock.loops.size).toBeGreaterThan(0);
    handle?.destroy();
    handle = null;
    expect(clock.loops.size).toBe(0);
    expect(clock.timers.size).toBe(0);
    expect(clock.frames.size).toBe(0);
  });
});

describe("萌猫小屋 · 倒计时徽章的文案（W5C-K02 的纯函数那一半）", () => {
  it("有限的正秒数照原样画，哨兵值一律换成「这一轮先跳过」", () => {
    expect(endlessClockText(34)).toBe("⏳ 34 秒");
    expect(endlessClockText(1)).toBe("⏳ 1 秒");
    expect(endlessClockText(9.7)).toBe("⏳ 9 秒");
    for (const bad of [0, -1, -99, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
      expect(endlessClockText(bad), `${bad} 不该画出来`).toBe(ENDLESS_SKIP_BADGE);
    }
    expect(ENDLESS_SKIP_BADGE).not.toMatch(/输|失败|来不及/);
  });
});

describe("萌猫小屋 · Life.every 交得出一个能单独停掉的把手", () => {
  it("stop 之后这一个不再响，别的循环照跑，重复 stop 也不出事", () => {
    const clock = new TestClock();
    const life = new Life(clock as unknown as TimerHost);
    let a = 0;
    let b = 0;
    const loopA = life.every(() => a++, 100);
    const loopB = life.every(() => b++, 100);
    expect(loopA.live).toBe(true);
    expect(clock.loops.size).toBe(2);

    clock.tick();
    expect([a, b]).toEqual([1, 1]);

    loopA.stop();
    expect(loopA.live).toBe(false);
    expect(loopB.live).toBe(true);
    expect(clock.loops.size).toBe(1);
    clock.tick();
    expect([a, b], "停掉的那个还在响").toEqual([1, 2]);

    loopA.stop();
    expect(clock.loops.size).toBe(1);

    life.destroy();
    expect(loopB.live).toBe(false);
    expect(clock.loops.size).toBe(0);
    // destroy 之后再登记，交回来的把手也是个死的，调用方不用判空
    const after = life.every(() => a++, 100);
    expect(after.live).toBe(false);
    after.stop();
    expect(clock.loops.size).toBe(0);
  });
});
