/**
 * 窗口 4 · 外壳暂停面板真的把游戏停住了吗（行为用例）。
 *
 * 背景：`src/ui/gameShell.ts` 顶栏有一颗 ⏸，Esc 没被游戏接住时弹的也是同一张
 * 「先歇一会儿」。弹之前它会调 `mounted.pause()`、关掉时调 `mounted.resume()`：
 *
 * ```ts
 * function tellGame(method: "pause" | "resume"): void {
 *   const fn = (mounted as unknown as Record<string, unknown> | null)?.[method];
 *   if (typeof fn !== "function") return;   // ← 游戏不接就什么都不做
 *   ...
 * }
 * ```
 *
 * 窗口 4 这十五款原本一款都没接，面板只是画在最前面，后面照跑：倒计时继续走、
 * 球继续掉、毛毛虫继续撞墙。孩子看着「暂停」两个字把这一关输掉。
 *
 * 这一份不看源码字面，只看行为：拿假时钟把时间往前拨，验「冻住时一步不走、
 * 化冻后欠多少补多少」。各款的接法不一样（总管 / paused 开关 / frozen 闸），
 * 所以逐款各验一遍。
 */
import { afterEach, describe, expect, it } from "vitest";

import { fakeClock } from "./fakeClock";

import { Janitor as BrickJanitor, freezeAll as brickFreeze, thawAll as brickThaw } from "../games/brick-break/logic";
import {
  Janitor as BalloonJanitor,
  freezeAll as balloonFreeze,
  liveJanitors as balloonLive,
  thawAll as balloonThaw,
} from "../games/balloon-pop/logic";
import { Janitor as CatchJanitor, freezeAll as catchFreeze, thawAll as catchThaw } from "../games/fruit-catch/logic";
import { Janitor as LlkJanitor, freezeAll as llkFreeze, thawAll as llkThaw } from "../games/lianliankan/logic";
import { BubbleBag, freezeAll as bubbleFreeze, thawAll as bubbleThaw } from "../games/bubble-pop/collapse";
import { TimerBag, freezeAll as moleFreeze, thawAll as moleThaw } from "../games/mole-pop/rhythm";
import { Cleanup, freezeAll as braveFreeze, liveCleanups, thawAll as braveThaw } from "../games/brave-path/cleanup";

let stopClock: (() => void) | null = null;

afterEach(() => {
  stopClock?.();
  stopClock = null;
});

function clock(): ReturnType<typeof fakeClock> {
  const c = fakeClock();
  stopClock = () => c.restore();
  return c;
}

describe("窗口 4 · 碰碰砖块：冻住时球不飞，化冻接着飞", () => {
  it("冻住之后拨多久，掉命的那一记都不响；化冻后还欠原来那么久", () => {
    const c = clock();
    const jan = new BrickJanitor(c);
    let lost = 0;
    jan.after(1000, () => lost++);

    c.advance(400);
    expect(lost, "才 400ms，还没到").toBe(0);

    brickFreeze();
    c.advance(5000);
    expect(lost, "冻住期间拨了 5 秒，一记都不该响").toBe(0);

    brickThaw();
    c.advance(500);
    expect(lost, "还欠 600ms，只拨了 500ms").toBe(0);
    c.advance(200);
    expect(lost, "补齐 600ms 才响").toBe(1);

    jan.destroy();
  });

  it("冻住时排队的那一帧不丢：化冻后循环自己接着转", () => {
    const c = clock();
    const jan = new BrickJanitor(c);
    let ticks = 0;
    const loop = (): void => {
      ticks++;
      jan.frame(loop);
    };
    jan.frame(loop);

    c.runFrames();
    expect(ticks).toBe(1);

    brickFreeze();
    c.runFrames();
    expect(ticks, "冻住之后帧被取消，画面不动").toBe(1);

    brickThaw();
    c.runFrames();
    expect(ticks, "化冻之后循环自己接上了").toBe(2);
    c.runFrames();
    expect(ticks, "接上就是真的接上，不是只补一帧").toBe(3);

    jan.destroy();
  });

  it("冻住状态下 destroy 一样清得干净，不会留着「等化冻」的活", () => {
    const c = clock();
    const jan = new BrickJanitor(c);
    jan.after(1000, () => {});
    jan.frame(() => {});
    brickFreeze();
    jan.destroy();
    expect(jan.pending(), "destroy 之后必须一件不剩").toBe(0);

    brickThaw();
    c.advance(10_000);
    c.runFrames();
    expect(jan.pending(), "死掉的总管化冻也不该复活").toBe(0);
  });
});

describe("窗口 4 · 气球砰砰：冻住时气球不飘、倒计时不走", () => {
  it("心跳按拍停下，化冻之后原样接上", () => {
    const c = clock();
    const jan = new BalloonJanitor(c);
    let beats = 0;
    jan.every(1000, () => beats++);

    c.advance(2500);
    expect(beats).toBe(2);

    balloonFreeze();
    c.advance(9000);
    expect(beats, "冻住时心跳一拍都不跳").toBe(2);

    balloonThaw();
    c.advance(2000);
    expect(beats, "化冻之后照常一秒一拍").toBe(4);

    jan.destroy();
  });

  it("名册跟着生死走：建了就在册，destroy 就除名", () => {
    const c = clock();
    const before = balloonLive();
    const a = new BalloonJanitor(c);
    const b = new BalloonJanitor(c);
    expect(balloonLive()).toBe(before + 2);
    a.destroy();
    b.destroy();
    expect(balloonLive(), "两个都收摊，名册必须回到原样").toBe(before);
  });
});

describe("窗口 4 · 接住小水果：冻住时水果停在半空", () => {
  it("落地判定按剩余毫秒记账，暂停多久就欠多久", () => {
    const c = clock();
    const jan = new CatchJanitor(c);
    let dropped = 0;
    jan.after(800, () => dropped++);

    c.advance(300);
    catchFreeze();
    c.advance(60_000);
    expect(dropped, "冻了整整一分钟也不该掉").toBe(0);

    catchThaw();
    c.advance(499);
    expect(dropped, "还差 1ms").toBe(0);
    c.advance(1);
    expect(dropped).toBe(1);

    jan.destroy();
  });
});

describe("窗口 4 · 连连看：冻住时倒计时不掉秒", () => {
  it("一秒一跳的倒计时停住，化冻之后接着跳", () => {
    const c = clock();
    const jan = new LlkJanitor(c);
    let left = 60;
    jan.every(1000, () => left--);

    c.advance(3000);
    expect(left).toBe(57);

    llkFreeze();
    c.advance(30_000);
    expect(left, "面板开着的 30 秒不该算在孩子头上").toBe(57);

    llkThaw();
    c.advance(3000);
    expect(left).toBe(54);

    jan.destroy();
  });
});

describe("窗口 4 · 泡泡乐园：冻住时不涨潮，塌陷动画也停在半路", () => {
  it("涨潮的延时按剩余毫秒收起", () => {
    const c = clock();
    const bag = new BubbleBag({
      setTimeout: (fn, ms) => c.setTimeout(fn, ms),
      clearTimeout: (id) => c.clearTimeout(id),
      cancelRaf: (id) => c.cancelAnimationFrame(id),
      requestRaf: (fn) => c.requestAnimationFrame(fn),
    });
    let tides = 0;
    bag.after(() => tides++, 2000);

    c.advance(1500);
    bubbleFreeze();
    c.advance(20_000);
    expect(tides, "冻住时一次潮都不涨").toBe(0);

    bubbleThaw();
    c.advance(500);
    expect(tides, "只欠 500ms，补上就涨").toBe(1);

    bag.close();
  });

  it("停在半路的那一帧记住了回调，化冻之后盘面不会永远卡住", () => {
    const c = clock();
    const bag = new BubbleBag({
      setTimeout: (fn, ms) => c.setTimeout(fn, ms),
      clearTimeout: (id) => c.clearTimeout(id),
      cancelRaf: (id) => c.cancelAnimationFrame(id),
      requestRaf: (fn) => c.requestAnimationFrame(fn),
    });
    let frames = 0;
    const step = (): void => {
      frames++;
    };
    bag.onRaf(c.requestAnimationFrame(step), step);

    bubbleFreeze();
    c.runFrames();
    expect(frames, "冻住之后这一帧被取消了").toBe(0);

    bubbleThaw();
    c.runFrames();
    expect(frames, "化冻把它重新排上，塌陷动画接着播").toBe(1);

    bag.close();
  });
});

describe("窗口 4 · 地鼠嘭嘭：冻住时地鼠不缩头、整场倒计时不走", () => {
  it("冒头与缩头都按剩余毫秒收起", () => {
    const c = clock();
    const bag = new TimerBag(c);
    let hidden = 0;
    bag.after(() => hidden++, 900);

    c.advance(600);
    moleFreeze();
    c.advance(10_000);
    expect(hidden, "面板开着地鼠就该老实待着").toBe(0);

    moleThaw();
    c.advance(300);
    expect(hidden).toBe(1);

    bag.clearAll();
  });

  it("整场心跳一并停住", () => {
    const c = clock();
    const bag = new TimerBag(c);
    let seconds = 0;
    bag.every(() => seconds++, 1000);

    c.advance(2000);
    moleFreeze();
    c.advance(8000);
    expect(seconds).toBe(2);
    moleThaw();
    c.advance(1000);
    expect(seconds).toBe(3);

    bag.clearAll();
  });
});

describe("窗口 4 · 勇者小路：冻住时回合不推进", () => {
  it("定时器、心跳、帧三样一起停，化冻一起接上", () => {
    const c = clock();
    const cleanup = new Cleanup(c);
    let late = 0;
    let beats = 0;
    let frames = 0;
    cleanup.after(700, () => late++);
    cleanup.every(500, () => beats++);
    const loop = (): void => {
      frames++;
      cleanup.frame(loop);
    };
    cleanup.frame(loop);

    c.advance(400);
    c.runFrames();
    expect([late, beats, frames]).toEqual([0, 0, 1]);

    braveFreeze();
    c.advance(30_000);
    c.runFrames();
    expect([late, beats, frames], "冻住之后三样都不动").toEqual([0, 0, 1]);

    braveThaw();
    c.runFrames();
    expect(frames, "帧循环接上了").toBe(2);
    c.advance(300);
    expect(late, "定时器只欠 300ms").toBe(1);
    c.advance(200);
    expect(beats, "心跳也回来了").toBe(1);

    cleanup.destroy();
  });

  it("名册跟着生死走", () => {
    const c = clock();
    const before = liveCleanups();
    const one = new Cleanup(c);
    expect(liveCleanups()).toBe(before + 1);
    one.destroy();
    expect(liveCleanups()).toBe(before);
  });
});

describe("窗口 4 · 反复按暂停不会越按越乱", () => {
  it("连按两次冻、连按两次化冻，账还是只欠一次", () => {
    const c = clock();
    const jan = new CatchJanitor(c);
    let fired = 0;
    jan.after(1000, () => fired++);

    c.advance(200);
    catchFreeze();
    catchFreeze();
    c.advance(5000);
    catchThaw();
    catchThaw();
    c.advance(799);
    expect(fired, "还差 1ms").toBe(0);
    c.advance(1);
    expect(fired, "只该响一次，不是补两次").toBe(1);
    c.advance(5000);
    expect(fired).toBe(1);

    jan.destroy();
  });
});
