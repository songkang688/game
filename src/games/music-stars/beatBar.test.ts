/**
 * 音乐小星星 · 节奏条的拍块以拍点为中心（1.2 窗口5 · 第 2 轮 · 档B 学习优化员）。
 *
 * 测试员 W5-B-07.2 / W5-L-21（建议）：游戏对孩子的原话是「看着黄线走到方块的那一刻
 * 再敲」，可画法把拍块的**左沿**压在拍点上，于是「方块中心对上黄线」的那一刻，
 * 音频时钟其实已经晚了 8px（短音）/ 15px（长音）——按 150px/秒 换算是 53ms / 100ms。
 * 短音还在 perfect（<60ms）里，**长音直接从 perfect 掉到 good**：不会判 miss，
 * 但稳定吃掉一档评分，而且吃的正好是照着提示语做的孩子。
 *
 * **这一条只改画法。** `timing.ts` 的 `judgeTap()` 一个字都没动——它本来就是对的，
 * 改判定反而会把已经练熟的孩子打乱。所以这一份除了量对齐，还专门钉一条
 * 「timing.ts 的三档阈值与判定函数没被顺手动过」。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { installDom, findAll, findOne, type StubEl } from "./domStub";
import { GOOD_MS, OK_MS, PERFECT_MS, judgeHit, judgeTap } from "./timing";
import {
  JUDGE_LINE_W,
  TICK_W_LONG,
  TICK_W_SHORT,
  createBeatBar,
  tickCenterOffsetPx,
  tickLeftPx,
  tickWidthPx,
} from "./ui";

const WIDTH = 360;
const PX_PER_SEC = 150;

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

/** 把 `translateX(123px)` 里的数字抠出来 */
function translateX(el: StubEl): number {
  const hit = /translateX\((-?\d+(?:\.\d+)?)px\)/.exec(el.style.transform ?? "");
  if (!hit) throw new Error(`轨道上没有 translateX：${el.style.transform}`);
  return Number(hit[1]);
}

const px = (v: string | undefined): number => Number(String(v).replace("px", ""));

/**
 * 把节奏条挂起来跑：`at()` 把音频时钟拨到某一秒并推一帧，
 * 回一份「这一刻每个拍块在屏幕上的左沿 / 中心」。
 */
function mountBar(beats: number[], longs: boolean[]) {
  const dom = installDom();
  const g = globalThis as unknown as {
    requestAnimationFrame: (cb: (t: number) => void) => number;
    cancelAnimationFrame: (id: number) => void;
  };
  // 桩自带的 raf 不会真的回调；这里换成一条手动泵，免得帧回调自己无限递归
  let queued: Array<(t: number) => void> = [];
  g.requestAnimationFrame = (cb) => queued.push(cb);
  g.cancelAnimationFrame = () => {
    queued = [];
  };

  let clock = 0;
  const bar = createBeatBar({
    beats,
    longs,
    now: () => clock,
    width: WIDTH,
    pxPerSec: PX_PER_SEC,
  });
  bar.start();

  const el = bar.el as unknown as StubEl;
  const track = findOne(el, "mst-bar-track");
  const line = findOne(el, "mst-bar-line");
  if (!track || !line) throw new Error("节奏条没铺出轨道或判定线");

  restore = () => {
    bar.destroy();
    dom.restore();
  };

  return {
    el,
    track,
    /** 判定线的中心 x（`left` 是左沿，宽 JUDGE_LINE_W） */
    lineCenter: px(line.style.left) + JUDGE_LINE_W / 2,
    at(seconds: number) {
      clock = seconds;
      const q = queued;
      queued = [];
      for (const cb of q) cb(0);
      const shift = translateX(track);
      return findAll(track, "mst-bar-tick").map((tick) => {
        const w = px(tick.style.width);
        const left = shift + px(tick.style.left);
        return { left, width: w, center: left + w / 2 };
      });
    },
  };
}

describe("节奏条 · 拍块以拍点为中心（W5-B-07.2 / W5-L-21）", () => {
  it("纯几何：左沿往回退半个身位", () => {
    expect(tickLeftPx(0, PX_PER_SEC, TICK_W_SHORT)).toBe(-TICK_W_SHORT / 2);
    expect(tickLeftPx(2, PX_PER_SEC, TICK_W_LONG)).toBe(2 * PX_PER_SEC - TICK_W_LONG / 2);
    expect(tickWidthPx(false)).toBe(TICK_W_SHORT);
    expect(tickWidthPx(true)).toBe(TICK_W_LONG);
  });

  it("守门尺：长短两种拍块，中心与判定线的偏差都是 0", () => {
    expect(tickCenterOffsetPx(WIDTH, TICK_W_SHORT)).toBe(0);
    expect(tickCenterOffsetPx(WIDTH, TICK_W_LONG)).toBe(0);
  });

  it("真的挂起来跑：该敲的那一刻，每个拍块的中心正压在判定线上", () => {
    const beats = [0, 0.5, 1.25, 2];
    const longs = [false, true, false, true];
    const bar = mountBar(beats, longs);
    for (let i = 0; i < beats.length; i += 1) {
      const ticks = bar.at(beats[i]);
      // 左沿与轨道位移各自 `Math.round` 一次，各能差半像素，合起来 1px 是取整的天花板；
      // 改前那种左沿压拍点的画法是 8px（短音）/ 15px（长音），差着一个数量级
      expect(Math.abs(ticks[i].center - bar.lineCenter), `第 ${i + 1} 拍没压在线上`).toBeLessThanOrEqual(1);
    }
  });

  it("长音块也是宽在中心两侧摊开，不是往右伸出去", () => {
    const bar = mountBar([0, 1], [false, true]);
    const ticks = bar.at(1);
    const long = ticks[1];
    expect(long.width).toBe(TICK_W_LONG);
    expect(Math.abs(bar.lineCenter - long.left - TICK_W_LONG / 2)).toBeLessThanOrEqual(0.5);
    // 左右两边各有一半，不是「线在左沿、身子全在右边」
    expect(long.left).toBeLessThan(bar.lineCenter);
    expect(long.left + long.width).toBeGreaterThan(bar.lineCenter);
  });

  it("改前那种画法（左沿压拍点）会晚多少：长音正好跨过 perfect 的门槛", () => {
    const lateMs = (w: number) => (w / 2 / PX_PER_SEC) * 1000;
    // 孩子照着「方块中心对上黄线」敲，等于晚了半个身位
    expect(Math.round(lateMs(TICK_W_SHORT))).toBe(53);
    expect(Math.round(lateMs(TICK_W_LONG))).toBe(100);
    expect(judgeHit(lateMs(TICK_W_SHORT))).toBe("perfect");
    expect(judgeHit(lateMs(TICK_W_LONG)), "长音正好跨过 perfect 的门槛").toBe("good");
    // 改后是 0 偏差，两种都稳在 perfect
    expect(judgeHit(0)).toBe("perfect");
    expect(judgeTap([0, 0.5], 0).grade).toBe("perfect");
  });

  it("拍块之间的间距还是拍点之间的间距（只挪了半个身位，没改速度）", () => {
    const bar = mountBar([0, 0.5, 1], [false, false, true]);
    const ticks = bar.at(0);
    expect(ticks[1].center - ticks[0].center).toBeCloseTo(0.5 * PX_PER_SEC, 5);
    expect(ticks[2].center - ticks[1].center).toBeCloseTo(0.5 * PX_PER_SEC, 5);
  });
});

describe("节奏条 · 判定一个字都没动（W5-B-07.2 的边界）", () => {
  const timingSource = readFileSync(
    `${fileURLToPath(new URL(".", import.meta.url))}timing.ts`,
    "utf8"
  );

  it("三档阈值还是原来那三个数", () => {
    expect(PERFECT_MS).toBe(60);
    expect(GOOD_MS).toBe(120);
    expect(OK_MS).toBe(200);
  });

  it("judgeTap 的分档行为不变（正负两侧对称）", () => {
    for (const sign of [1, -1]) {
      expect(judgeTap([1], 1 + sign * 0.03).grade).toBe("perfect");
      expect(judgeTap([1], 1 + sign * 0.09).grade).toBe("good");
      expect(judgeTap([1], 1 + sign * 0.16).grade).toBe("ok");
      expect(judgeTap([1], 1 + sign * 0.4).grade).toBe("miss");
    }
  });

  it("timing.ts 里没有混进任何画法用的像素常量", () => {
    for (const banned of ["pxPerSec", "TICK_W", "JUDGE_LINE_W", "style", "px`"]) {
      expect(timingSource, `timing.ts 里出现了 ${banned}，判定和画法又缠在一起了`).not.toContain(
        banned
      );
    }
  });
});
