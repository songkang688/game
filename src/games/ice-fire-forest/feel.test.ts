/**
 * 冰冰火火森林 · 手感常量与帧率无关位移的用例。
 *
 * 1.1 的四个手感数字是裸写在 `index.ts` 里的,一条用例都没有 ——
 * 改坏了只能靠手玩才发现。这一份把它们全钉死。
 */
import { describe, expect, it } from "vitest";
import {
  FEEL,
  bufferAlive,
  bufferPress,
  bufferTake,
  coyoteOpen,
  emptyBuffer,
  glideSpeed,
  hopDurationMs,
  hopHeightPx,
  hopOffsetPx,
  hopProgress,
  makeGlide,
  nextBumpAt,
  nextStepAt,
  prefersReducedMotion,
  simulateGlide,
  snapAxis,
  stepGlide,
  stepReady,
  withinSnap,
} from "./feel";

describe("手感常量", () => {
  it("土狼时间 90ms、跳跃缓冲 120ms —— 规格里写死的两个数", () => {
    expect(FEEL.COYOTE_MS).toBe(90);
    expect(FEEL.JUMP_BUFFER_MS).toBe(120);
  });

  it("重力、起跳初速、走格间隔都在能玩的范围里", () => {
    expect(FEEL.GRAVITY).toBeGreaterThan(500);
    expect(FEEL.GRAVITY).toBeLessThan(6000);
    expect(FEEL.JUMP_VELOCITY).toBeGreaterThan(200);
    expect(FEEL.JUMP_VELOCITY).toBeLessThan(1500);
    // 走一格 145ms:再快小孩来不及看清脚下,再慢一关走下来会不耐烦
    expect(FEEL.STEP_MS).toBeGreaterThanOrEqual(110);
    expect(FEEL.STEP_MS).toBeLessThanOrEqual(200);
  });

  it("边缘吸附是「不到四分之一格」,不会把人吸到隔壁格去", () => {
    expect(FEEL.EDGE_SNAP_CELLS).toBeGreaterThan(0);
    expect(FEEL.EDGE_SNAP_CELLS).toBeLessThan(0.5);
  });

  it("撞墙硬直比走一格长,但不到半秒", () => {
    expect(FEEL.BUMP_MS).toBeGreaterThan(FEEL.STEP_MS);
    expect(FEEL.BUMP_MS).toBeLessThan(500);
  });

  it("定步长切得比一帧还细,单帧上限拦得住切后台那一下", () => {
    expect(FEEL.FIXED_STEP_MS).toBeLessThan(1000 / 60);
    expect(FEEL.MAX_FRAME_MS).toBeGreaterThanOrEqual(60);
    expect(FEEL.MAX_FRAME_MS).toBeLessThanOrEqual(200);
  });
});

describe("顶举的抛物线", () => {
  it("飞行时长是 2v/g,最高点是 v²/2g", () => {
    expect(hopDurationMs()).toBeCloseTo((2 * FEEL.JUMP_VELOCITY * 1000) / FEEL.GRAVITY, 6);
    expect(hopHeightPx()).toBeCloseTo((FEEL.JUMP_VELOCITY * FEEL.JUMP_VELOCITY) / (2 * FEEL.GRAVITY), 6);
  });

  it("起飞与落地都贴着地,中间正好抬到最高点", () => {
    const total = hopDurationMs();
    expect(hopOffsetPx(0)).toBe(0);
    expect(hopOffsetPx(total)).toBe(0);
    expect(hopOffsetPx(total / 2)).toBeCloseTo(hopHeightPx(), 6);
    // 对称:前后各四分之一处一样高
    expect(hopOffsetPx(total * 0.25)).toBeCloseTo(hopOffsetPx(total * 0.75), 6);
  });

  it("超出区间不会算出负数高度", () => {
    expect(hopOffsetPx(-10)).toBe(0);
    expect(hopOffsetPx(hopDurationMs() + 10)).toBe(0);
    expect(hopProgress(50, 100)).toBeCloseTo(0.5, 6);
    expect(hopProgress(500, 100)).toBe(1);
    expect(hopProgress(10, 0)).toBe(1);
  });
});

describe("土狼时间", () => {
  it("同伴刚从托举点走开,90ms 之内这一步还算数", () => {
    expect(coyoteOpen(1000, 1000)).toBe(true);
    expect(coyoteOpen(1000 + FEEL.COYOTE_MS, 1000)).toBe(true);
    expect(coyoteOpen(1000 + FEEL.COYOTE_MS + 1, 1000)).toBe(false);
  });

  it("同伴压根没站上去过就没有宽限", () => {
    expect(coyoteOpen(1000, -1)).toBe(false);
  });
});

describe("跳跃缓冲", () => {
  it("提前 120ms 内按下的方向,到点会被兑现", () => {
    const buf = bufferPress(emptyBuffer(), "right", 500);
    expect(bufferAlive(buf, 500 + FEEL.JUMP_BUFFER_MS)).toBe(true);
    const taken = bufferTake(buf, 560);
    expect(taken.action).toBe("right");
    expect(taken.next.action).toBeNull();
  });

  it("超过 120ms 就当没按过,不会隔半天突然自己走一步", () => {
    const buf = bufferPress(emptyBuffer(), "up", 500);
    expect(bufferAlive(buf, 500 + FEEL.JUMP_BUFFER_MS + 1)).toBe(false);
    expect(bufferTake(buf, 700).action).toBeNull();
  });

  it("后按的方向盖掉先按的", () => {
    let buf = bufferPress(emptyBuffer(), "up", 500);
    buf = bufferPress(buf, "left", 540);
    expect(bufferTake(buf, 560).action).toBe("left");
  });

  it("空缓冲取不出东西", () => {
    expect(bufferAlive(emptyBuffer(), 0)).toBe(false);
    expect(bufferTake(emptyBuffer(), 0).action).toBeNull();
  });
});

describe("边缘吸附", () => {
  it("差得够近就直接贴上去,差得远就原样不动", () => {
    expect(snapAxis(3.9, 4)).toBe(4);
    expect(snapAxis(3.5, 4)).toBe(3.5);
    expect(withinSnap(2, 3, 2.1, 3)).toBe(true);
    expect(withinSnap(2, 3, 2.6, 3)).toBe(false);
  });
});

describe("帧率无关的位移", () => {
  const W = 40;
  // 从 (0,0) 一路往右滑到第 20 格:一秒钟走不完,所以两种帧率比的是「同一段路走了多远」
  const QUEUE = [20];

  it("30fps 与 60fps 走同样的时间,位移差不到 2%", () => {
    const slow = simulateGlide({ x: 0, y: 0 }, QUEUE, W, 1000, 1000 / 30);
    const fast = simulateGlide({ x: 0, y: 0 }, QUEUE, W, 1000, 1000 / 60);
    const diff = Math.abs(slow.travelled - fast.travelled) / fast.travelled;
    expect(diff).toBeLessThan(0.02);
    expect(fast.travelled).toBeGreaterThan(1);
  });

  it("帧长再零碎(29fps / 144fps)也一样对得上", () => {
    const a = simulateGlide({ x: 0, y: 0 }, QUEUE, W, 1500, 1000 / 29);
    const b = simulateGlide({ x: 0, y: 0 }, QUEUE, W, 1500, 1000 / 144);
    const diff = Math.abs(a.travelled - b.travelled) / b.travelled;
    expect(diff).toBeLessThan(0.02);
  });

  it("走的距离本身也对得上「速度 × 时间」", () => {
    const out = simulateGlide({ x: 0, y: 0 }, QUEUE, W, 1000, 1000 / 60);
    const expected = glideSpeed(1) * 1;
    expect(Math.abs(out.travelled - expected) / expected).toBeLessThan(0.02);
  });

  it("单帧最多认 100ms:切后台回来不会一口气冲出去", () => {
    const g = makeGlide(0, 0);
    g.queue.push(20);
    stepGlide(g, 5000, W);
    const jumped = g.x;
    const g2 = makeGlide(0, 0);
    g2.queue.push(20);
    stepGlide(g2, FEEL.MAX_FRAME_MS, W);
    expect(jumped).toBeCloseTo(g2.x, 9);
  });

  it("排得越长滑得越快(传送带一送就是好几格,不能拖成慢动作)", () => {
    expect(glideSpeed(4)).toBeCloseTo(glideSpeed(1) * 4, 9);
    expect(glideSpeed(0)).toBeCloseTo(glideSpeed(1), 9);
  });

  it("到站就吸附到整格,不留亚像素残差", () => {
    const g = makeGlide(0, 0);
    g.queue.push(1);
    for (let i = 0; i < 40; i++) stepGlide(g, 16, W);
    expect(g.x).toBe(1);
    expect(g.y).toBe(0);
    expect(g.queue.length).toBe(0);
  });

  it("队列空着的时候推进也不会把人挪走", () => {
    const g = makeGlide(3, 2);
    stepGlide(g, 100, W);
    expect(g.x).toBe(3);
    expect(g.y).toBe(2);
  });
});

describe("走格节奏", () => {
  it("走成一格之后要等一个 STEP_MS,撞墙要等更久", () => {
    expect(stepReady(100, 100)).toBe(true);
    expect(stepReady(99, 100)).toBe(false);
    expect(nextStepAt(100)).toBe(100 + FEEL.STEP_MS);
    expect(nextBumpAt(100)).toBe(100 + FEEL.BUMP_MS);
    expect(nextBumpAt(0)).toBeGreaterThan(nextStepAt(0));
  });
});

describe("减少动态效果", () => {
  it("拿不到 matchMedia 的环境(比如单测)默认不当成勾上了", () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it("系统说勾上了就返回 true", () => {
    const g = globalThis as { matchMedia?: unknown };
    const saved = g.matchMedia;
    g.matchMedia = (q: string) => ({ matches: q.includes("reduce") });
    expect(prefersReducedMotion()).toBe(true);
    g.matchMedia = saved;
  });
});
