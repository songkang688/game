import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SoundName } from "../../engine/types";
import { FakeCtx2D, FakeEl } from "../../games/__tests__/canvasDom";
import {
  FEEL_POP_FLAT_MS,
  FEEL_POP_MS,
  FEEL_TIERS,
  HIT_STOP_SLOW,
  HitStop,
  SHAKE_MAX_PX,
  SHAKE_MAX_ROT,
  Trauma,
  applyCameraShake,
  ease,
  feedback,
  popElement,
  squashStretch,
  stepFeel,
  type FeelIO,
  type FeelTier
} from "./feel";
import * as kit from "./index";

const TIERS: FeelTier[] = ["small", "medium", "large"];
const NUMERIC_KEYS = ["trauma", "hitStopMs", "slow", "particles", "flashMs", "pop"] as const;
const SOUNDS: SoundName[] = ["tap", "win", "oops", "coin", "pop", "meow", "jump"];

function traumaAt(v: number): Trauma {
  const tr = new Trauma();
  tr.add(v);
  return tr;
}

/** 记下每个回调被调了几次、带什么参数 */
function spyIO(reduced: boolean, extra: Partial<FeelIO> = {}) {
  const calls = { play: [] as SoundName[], burst: [] as number[], flash: [] as number[], pop: [] as number[] };
  const io: FeelIO = {
    reduced,
    trauma: new Trauma(),
    hitStop: new HitStop(),
    play: (s) => calls.play.push(s),
    burst: (n) => calls.burst.push(n),
    flash: (ms) => calls.flash.push(ms),
    pop: (a) => calls.pop.push(a),
    ...extra
  };
  return { io, calls };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
describe("FEEL_TIERS 三档预设", () => {
  it("每个数值都满足 small ≤ medium ≤ large", () => {
    for (const k of NUMERIC_KEYS) {
      expect(FEEL_TIERS.small[k], `small.${k}`).toBeLessThanOrEqual(FEEL_TIERS.medium[k]);
      expect(FEEL_TIERS.medium[k], `medium.${k}`).toBeLessThanOrEqual(FEEL_TIERS.large[k]);
    }
  });

  it("small 无顿帧、medium 必有顿帧、large 顿得更久", () => {
    expect(FEEL_TIERS.small.hitStopMs).toBe(0);
    expect(FEEL_TIERS.medium.hitStopMs).toBeGreaterThan(0);
    expect(FEEL_TIERS.large.hitStopMs).toBeGreaterThan(FEEL_TIERS.medium.hitStopMs);
  });

  it("数值落在规格量级里：trauma / 顿帧 / slow / 粒子 / 白闪 / pop", () => {
    const { small, medium, large } = FEEL_TIERS;
    expect(small.trauma).toBeGreaterThanOrEqual(0.1);
    expect(small.trauma).toBeLessThanOrEqual(0.2);
    expect(medium.trauma).toBeGreaterThanOrEqual(0.3);
    expect(medium.trauma).toBeLessThanOrEqual(0.5);
    expect(large.trauma).toBeGreaterThanOrEqual(0.7);
    expect(large.trauma).toBeLessThanOrEqual(1);
    expect(medium.hitStopMs).toBe(50);
    expect(large.hitStopMs).toBe(110);
    expect([small.particles, medium.particles, large.particles]).toEqual([4, 10, 28]);
    expect([small.flashMs, medium.flashMs, large.flashMs]).toEqual([0, 0, 60]);
    for (const t of TIERS) {
      expect(FEEL_TIERS[t].slow).toBeGreaterThanOrEqual(0.05);
      expect(FEEL_TIERS[t].slow).toBeLessThanOrEqual(0.15);
      expect(FEEL_TIERS[t].pop).toBeGreaterThanOrEqual(0.15);
      expect(FEEL_TIERS[t].pop).toBeLessThanOrEqual(0.35);
    }
  });

  it("建议音效都是平台内置音名", () => {
    for (const t of TIERS) {
      const s = FEEL_TIERS[t].sound;
      expect(s).toBeDefined();
      expect(SOUNDS).toContain(s);
    }
  });

  it("预设冻结：哪款游戏都改不动全仓共用的数值", () => {
    expect(Object.isFrozen(FEEL_TIERS)).toBe(true);
    for (const t of TIERS) expect(Object.isFrozen(FEEL_TIERS[t])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("Trauma 震屏量", () => {
  it("初值 0；add 累加不重置，钳到 1", () => {
    const tr = new Trauma();
    expect(tr.value).toBe(0);
    tr.add(0.4);
    tr.add(0.4);
    expect(tr.value).toBeCloseTo(0.8, 10);
    tr.add(0.5);
    expect(tr.value).toBe(1);
    tr.add(0.3);
    expect(tr.value).toBe(1);
  });

  it("add 的脏值忽略，负值也只降到 0", () => {
    const tr = traumaAt(0.3);
    tr.add(Number.NaN);
    tr.add(Number.POSITIVE_INFINITY);
    expect(tr.value).toBeCloseTo(0.3, 10);
    tr.add(-5);
    expect(tr.value).toBe(0);
  });

  it("step 按真实秒数线性衰减（缺省 1.2/秒，可配）", () => {
    const tr = traumaAt(1);
    tr.step(0.5);
    expect(tr.value).toBeCloseTo(0.4, 10);
    const slow = new Trauma({ decayPerSec: 0.5 });
    slow.add(1);
    slow.step(1);
    expect(slow.value).toBeCloseTo(0.5, 10);
    const bad = new Trauma({ decayPerSec: -3 });
    bad.add(1);
    bad.step(0.5);
    expect(bad.value).toBeCloseTo(0.4, 10);
  });

  it("step 的负值 / NaN 不动", () => {
    const tr = traumaAt(0.6);
    tr.step(-1);
    tr.step(Number.NaN);
    expect(tr.value).toBeCloseTo(0.6, 10);
  });

  it("衰减到 0 后 offset 全 0", () => {
    const tr = traumaAt(1);
    for (let i = 0; i < 120; i++) tr.step(1 / 60);
    expect(tr.value).toBe(0);
    for (const t of [0, 0.13, 1.7, 42]) expect(tr.offset(t)).toEqual({ dx: 0, dy: 0, rot: 0 });
  });

  it("位移随 value² 增长：0.5 的位移 < 1.0 位移的 1/3（≈1/4）", () => {
    const half = traumaAt(0.5);
    const full = traumaAt(1);
    let sumHalf = 0;
    let sumFull = 0;
    for (let i = 0; i < 40; i++) {
      const t = i * 0.037;
      const a = half.offset(t);
      const b = full.offset(t);
      sumHalf += Math.abs(a.dx) + Math.abs(a.dy) + Math.abs(a.rot);
      sumFull += Math.abs(b.dx) + Math.abs(b.dy) + Math.abs(b.rot);
      if (Math.abs(b.dx) > 1e-6) expect(Math.abs(a.dx)).toBeLessThan(Math.abs(b.dx) / 3);
    }
    expect(sumFull).toBeGreaterThan(0);
    expect(sumHalf / sumFull).toBeCloseTo(0.25, 6);
  });

  it("确定性：同一 t 两次结果相同，全程不碰 Math.random", () => {
    const rnd = vi.spyOn(Math, "random");
    const tr = traumaAt(0.9);
    for (const t of [0, 0.25, 0.5, 3.3]) expect(tr.offset(t)).toEqual(tr.offset(t));
    expect(rnd).not.toHaveBeenCalled();
  });

  it("真的在抖：不同 t 的位移不同，且不超过 maxPx / maxRot", () => {
    const tr = traumaAt(1);
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const o = tr.offset(i * 0.05);
      seen.add(o.dx.toFixed(4));
      expect(Math.abs(o.dx)).toBeLessThanOrEqual(SHAKE_MAX_PX.x + 1e-9);
      expect(Math.abs(o.dy)).toBeLessThanOrEqual(SHAKE_MAX_PX.y + 1e-9);
      expect(Math.abs(o.rot)).toBeLessThanOrEqual(SHAKE_MAX_ROT + 1e-9);
      const c = tr.offset(i * 0.05, { x: 3, y: 2 }, 0.01);
      expect(Math.abs(c.dx)).toBeLessThanOrEqual(3 + 1e-9);
      expect(Math.abs(c.dy)).toBeLessThanOrEqual(2 + 1e-9);
      expect(Math.abs(c.rot)).toBeLessThanOrEqual(0.01 + 1e-9);
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it("reset 立刻归零", () => {
    const tr = traumaAt(0.7);
    tr.reset();
    expect(tr.value).toBe(0);
    expect(tr.offset(1)).toEqual({ dx: 0, dy: 0, rot: 0 });
  });
});

// ---------------------------------------------------------------------------
describe("HitStop 顿帧", () => {
  it("trigger(100)：step(50) 返回 slow，step(60) 后返回 1", () => {
    const hs = new HitStop();
    expect(hs.active).toBe(false);
    hs.trigger(100);
    expect(hs.active).toBe(true);
    expect(hs.step(50)).toBe(HIT_STOP_SLOW);
    expect(hs.step(60)).toBe(1);
    expect(hs.active).toBe(false);
    expect(hs.step(16)).toBe(1);
  });

  it("两次 trigger 重叠时以后者的结束时刻为准（更短的也覆盖）", () => {
    const hs = new HitStop();
    hs.trigger(100);
    hs.step(30);
    hs.trigger(40);
    expect(hs.step(30)).toBe(HIT_STOP_SLOW);
    expect(hs.step(15)).toBe(1);
  });

  it("后来的更长 trigger 会延后还原，旧的还原时刻不会把它截断", () => {
    const hs = new HitStop();
    hs.trigger(50, 0.1);
    hs.step(40);
    hs.trigger(100, 0.08);
    expect(hs.step(20)).toBe(0.08);
    expect(hs.step(70)).toBe(0.08);
    expect(hs.step(20)).toBe(1);
  });

  it("用真实时间推进：timeScale 0.05 时照样按真实毫秒结束", () => {
    const hs = new HitStop();
    hs.trigger(100, 0.05);
    let frames = 0;
    while (hs.active && frames < 100) {
      hs.step(16);
      frames++;
    }
    expect(frames).toBe(7);
  });

  it("slow 钳到 [0,1]；时长 0 / 负 / NaN 不激活，也不打断正在进行的顿帧", () => {
    const hs = new HitStop();
    hs.trigger(0);
    hs.trigger(-20);
    hs.trigger(Number.NaN);
    expect(hs.active).toBe(false);
    hs.trigger(80, 3);
    expect(hs.step(1)).toBe(1);
    hs.trigger(80, -1);
    expect(hs.step(1)).toBe(0);
    hs.trigger(0);
    expect(hs.active).toBe(true);
    hs.reset();
    expect(hs.active).toBe(false);
  });

  it("step 的脏 dt 不推进", () => {
    const hs = new HitStop();
    hs.trigger(30, 0.1);
    expect(hs.step(Number.NaN)).toBe(0.1);
    expect(hs.step(-50)).toBe(0.1);
    expect(hs.active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("feedback 一个事件一次反馈", () => {
  it("large 全通道各出一次：音 + 抖 + 停 + 粒子 + 白闪 + 弹", () => {
    const { io, calls } = spyIO(false);
    feedback("large", io);
    expect(calls.play).toEqual(["win"]);
    expect(io.trauma?.value).toBeCloseTo(0.8, 10);
    expect(io.hitStop?.active).toBe(true);
    expect(io.hitStop?.step(1)).toBe(FEEL_TIERS.large.slow);
    expect(calls.burst).toEqual([28]);
    expect(calls.flash).toEqual([60]);
    expect(calls.pop).toEqual([0.35]);
  });

  it("large + reduced：trauma 不变、不顿帧、不白闪、粒子折半、音效照播", () => {
    const { io, calls } = spyIO(true);
    feedback("large", io);
    expect(io.trauma?.value).toBe(0);
    expect(io.hitStop?.active).toBe(false);
    expect(calls.flash).toEqual([]);
    expect(calls.burst).toEqual([14]);
    expect(calls.play).toEqual(["win"]);
    expect(calls.pop).toEqual([0]);
  });

  it("三档 reduced 一律：无位移、无顿帧、无白闪、粒子 = 一半（向下取整）", () => {
    for (const t of TIERS) {
      const { io, calls } = spyIO(true);
      feedback(t, io);
      expect(io.trauma?.value, t).toBe(0);
      expect(io.hitStop?.active, t).toBe(false);
      expect(calls.flash, t).toEqual([]);
      expect(calls.burst, t).toEqual([Math.floor(FEEL_TIERS[t].particles / 2)]);
      expect(calls.play, t).toHaveLength(1);
    }
  });

  it("small：只有轻抖、少量粒子与轻点音，不顿帧不白闪", () => {
    const { io, calls } = spyIO(false);
    feedback("small", io);
    expect(io.trauma?.value).toBeCloseTo(0.15, 10);
    expect(io.hitStop?.active).toBe(false);
    expect(calls.burst).toEqual([4]);
    expect(calls.flash).toEqual([]);
    expect(calls.play).toEqual(["tap"]);
  });

  it("medium：顿 50ms（真实时间）后还原", () => {
    const { io } = spyIO(false);
    feedback("medium", io);
    expect(io.hitStop?.step(49)).toBe(FEEL_TIERS.medium.slow);
    expect(io.hitStop?.step(2)).toBe(1);
  });

  it("io.sound 覆盖建议音；null 表示这次不出声", () => {
    const a = spyIO(false, { sound: "coin" });
    feedback("small", a.io);
    expect(a.calls.play).toEqual(["coin"]);
    const b = spyIO(true, { sound: null });
    feedback("large", b.io);
    expect(b.calls.play).toEqual([]);
  });

  it("可选通道全缺也不抛；未知档按 small 处理", () => {
    expect(() => feedback("large", { reduced: false })).not.toThrow();
    expect(() => feedback("medium", { reduced: true })).not.toThrow();
    const { io, calls } = spyIO(false);
    feedback("huge" as FeelTier, io);
    expect(calls.burst).toEqual([FEEL_TIERS.small.particles]);
  });

  it("同一 trauma 上连续两个事件叠加而不重置", () => {
    const tr = new Trauma();
    feedback("medium", { reduced: false, trauma: tr });
    feedback("medium", { reduced: false, trauma: tr });
    expect(tr.value).toBeCloseTo(0.8, 10);
  });
});

// ---------------------------------------------------------------------------
describe("applyCameraShake 只动相机", () => {
  const asCtx = (c: FakeCtx2D) => c as unknown as CanvasRenderingContext2D;

  it("reduced 时 ops 为空", () => {
    const ctx = new FakeCtx2D();
    applyCameraShake(asCtx(ctx), traumaAt(1), 0.3, { reduced: true });
    expect(ctx.ops).toEqual([]);
  });

  it("trauma = 0 时 ops 为空", () => {
    const ctx = new FakeCtx2D();
    applyCameraShake(asCtx(ctx), new Trauma(), 0.3);
    expect(ctx.ops).toEqual([]);
  });

  it("非 reduced 且 trauma>0：含 translate 与 rotate，传入对象一个不改", () => {
    const ctx = new FakeCtx2D();
    const tr = traumaAt(0.9);
    const opts = { reduced: false, maxPx: { x: 12, y: 9 }, maxRot: 0.05, center: { x: 160, y: 90 } };
    const snapshot = JSON.parse(JSON.stringify(opts));
    applyCameraShake(asCtx(ctx), tr, 0.41, opts);
    const names = ctx.ops.map((o) => o.op);
    expect(names).toContain("translate");
    expect(names).toContain("rotate");
    expect(names.every((n) => n === "translate" || n === "rotate")).toBe(true);
    expect(opts).toEqual(snapshot);
    expect(tr.value).toBeCloseTo(0.9, 10);
  });

  it("围绕中心转：先移到中心 + 偏移、转、再移回", () => {
    const ctx = new FakeCtx2D();
    const tr = traumaAt(1);
    const maxPx = { x: 12, y: 9 };
    applyCameraShake(asCtx(ctx), tr, 0.41, { maxPx, maxRot: 0.05, center: { x: 160, y: 90 } });
    const o = tr.offset(0.41, maxPx, 0.05);
    expect(ctx.ops.map((x) => x.op)).toEqual(["translate", "rotate", "translate"]);
    expect(ctx.ops[0].args[0]).toBeCloseTo(160 + o.dx, 10);
    expect(ctx.ops[0].args[1]).toBeCloseTo(90 + o.dy, 10);
    expect(ctx.ops[1].args[0]).toBeCloseTo(o.rot, 10);
    expect(ctx.ops[2].args).toEqual([-160, -90]);
  });

  it("不传 center 时取画布中心，并换算进已缩放的用户空间", () => {
    const ctx = new FakeCtx2D() as FakeCtx2D & { canvas: unknown; getTransform: () => unknown };
    ctx.canvas = { width: 800, height: 400 };
    ctx.getTransform = () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 });
    const tr = traumaAt(1);
    applyCameraShake(asCtx(ctx), tr, 0.2);
    expect(ctx.ops[ctx.ops.length - 1]).toEqual({ op: "translate", args: [-200, -100] });
  });

  it("不调 save / restore / setTransform（调用方负责）", () => {
    const ctx = new FakeCtx2D();
    applyCameraShake(asCtx(ctx), traumaAt(1), 1.1, { center: { x: 10, y: 10 } });
    const names = ctx.ops.map((o) => o.op);
    expect(names).not.toContain("save");
    expect(names).not.toContain("restore");
    expect(names).not.toContain("setTransform");
  });
});

// ---------------------------------------------------------------------------
describe("squashStretch 体积守恒的弹", () => {
  it("phase 0：横拉竖压，sx·sy ≈ 1", () => {
    const s = squashStretch(0, 0.3);
    expect(s.sx).toBeGreaterThan(1);
    expect(s.sy).toBeLessThan(1);
    expect(s.sx).toBeCloseTo(1.3, 10);
    expect(s.sx * s.sy).toBeCloseTo(1, 10);
  });

  it("phase 1 回到 1:1", () => {
    expect(squashStretch(1)).toEqual({ sx: 1, sy: 1 });
    expect(squashStretch(1, 0.35)).toEqual({ sx: 1, sy: 1 });
  });

  it("中段存在 >1 的过冲（竖向反拉），全程体积守恒", () => {
    let overshoot = false;
    for (let i = 0; i <= 100; i++) {
      const s = squashStretch(i / 100, 0.25);
      expect(s.sx * s.sy).toBeCloseTo(1, 10);
      if (s.sy > 1.01 && s.sx < 1) overshoot = true;
    }
    expect(overshoot).toBe(true);
  });

  it("幅度越大形变越大；幅度 0 / 脏 phase 都回 1:1", () => {
    expect(squashStretch(0, 0.35).sx).toBeGreaterThan(squashStretch(0, 0.15).sx);
    expect(squashStretch(0.3, 0)).toEqual({ sx: 1, sy: 1 });
    expect(squashStretch(Number.NaN, 0.3)).toEqual({ sx: 1, sy: 1 });
    expect(squashStretch(-2, 0.2).sx).toBeCloseTo(1.2, 10);
  });
});

// ---------------------------------------------------------------------------
describe("ease 缓动表", () => {
  const all = {
    outQuad: (t: number) => ease.outQuad(t),
    outCubic: (t: number) => ease.outCubic(t),
    inOutQuad: (t: number) => ease.inOutQuad(t),
    outBack: (t: number) => ease.outBack(t),
    outElastic: (t: number) => ease.outElastic(t)
  };

  it("每条曲线在 0 和 1 处精确取 0 和 1", () => {
    for (const [name, f] of Object.entries(all)) {
      expect(f(0), name).toBe(0);
      expect(f(1), name).toBe(1);
    }
  });

  it("outBack 中段冲过 1（弹），s 越大冲得越远", () => {
    const peak = (s?: number) => Math.max(...Array.from({ length: 99 }, (_, i) => ease.outBack((i + 1) / 100, s)));
    expect(peak()).toBeGreaterThan(1);
    expect(peak(3)).toBeGreaterThan(peak());
  });

  it("outElastic 冲过 1；outQuad / outCubic / inOutQuad 单调不越界", () => {
    expect(Math.max(...Array.from({ length: 99 }, (_, i) => ease.outElastic((i + 1) / 100)))).toBeGreaterThan(1);
    for (const f of [ease.outQuad, ease.outCubic, ease.inOutQuad]) {
      let prev = 0;
      for (let i = 1; i <= 100; i++) {
        const v = f(i / 100);
        expect(v).toBeGreaterThanOrEqual(prev);
        expect(v).toBeLessThanOrEqual(1);
        prev = v;
      }
    }
    expect(ease.inOutQuad(0.5)).toBeCloseTo(0.5, 10);
  });

  it("越界夹住，NaN 当终点", () => {
    expect(ease.outCubic(-1)).toBe(0);
    expect(ease.outCubic(2)).toBe(1);
    expect(ease.outBack(Number.NaN)).toBe(1);
    expect(ease.outElastic(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe("popElement DOM 弹一下", () => {
  const asEl = (e: FakeEl) => e as unknown as HTMLElement;

  it("加 .feel-pop，animationend 后摘掉", () => {
    const el = new FakeEl("button");
    el.className = "btn";
    popElement(asEl(el), false);
    expect(el.classList.contains("feel-pop")).toBe(true);
    el.fire("animationend");
    expect(el.classList.contains("feel-pop")).toBe(false);
    expect(el.className).toBe("btn");
    expect(el.listenerCount("animationend")).toBe(0);
  });

  it("reduced：不加 .feel-pop，只亮一次 .feel-pop-flat，到点摘掉", () => {
    vi.useFakeTimers();
    const el = new FakeEl("span");
    popElement(asEl(el), true);
    expect(el.classList.contains("feel-pop")).toBe(false);
    expect(el.classList.contains("feel-pop-flat")).toBe(true);
    vi.advanceTimersByTime(FEEL_POP_FLAT_MS - 1);
    expect(el.classList.contains("feel-pop-flat")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(el.classList.contains("feel-pop-flat")).toBe(false);
    expect(el.listenerCount("animationend")).toBe(0);
  });

  it("子元素冒上来的 animationend、别的动画名都不误摘", () => {
    const el = new FakeEl("button");
    const child = new FakeEl("i");
    el.appendChild(child);
    popElement(asEl(el), false);
    el.fire("animationend", { target: child });
    el.fire("animationend", { animationName: "press-pop" });
    expect(el.classList.contains("feel-pop")).toBe(true);
    el.fire("animationend", { animationName: "feel-pop" });
    expect(el.classList.contains("feel-pop")).toBe(false);
  });

  it("animationend 没来（被隐藏 / 动画被关）时兜底定时摘类", () => {
    vi.useFakeTimers();
    const el = new FakeEl("div");
    popElement(asEl(el), false);
    vi.advanceTimersByTime(FEEL_POP_MS);
    expect(el.classList.contains("feel-pop")).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(el.classList.contains("feel-pop")).toBe(false);
    expect(el.listenerCount("animationend")).toBe(0);
  });

  it("连点不叠监听；reduced 与非 reduced 来回切不残留对方的类", () => {
    vi.useFakeTimers();
    const el = new FakeEl("button");
    for (let i = 0; i < 5; i++) popElement(asEl(el), false);
    expect(el.listenerCount("animationend")).toBe(1);
    popElement(asEl(el), true);
    expect(el.classList.contains("feel-pop")).toBe(false);
    expect(el.listenerCount("animationend")).toBe(0);
    popElement(asEl(el), false);
    expect(el.classList.contains("feel-pop-flat")).toBe(false);
    vi.runAllTimers();
    expect(el.className).toBe("");
  });

  it("只有动画还在播时才强制回流重播；首次弹与 reduced 不读布局", () => {
    vi.useFakeTimers();
    const el = new FakeEl("button");
    let reads = 0;
    Object.defineProperty(el, "offsetWidth", {
      get: () => {
        reads++;
        return 44;
      }
    });
    popElement(asEl(el), false);
    expect(reads).toBe(0);
    popElement(asEl(el), false);
    expect(reads).toBe(1);
    el.fire("animationend");
    popElement(asEl(el), false);
    expect(reads).toBe(1);
    popElement(asEl(el), true);
    popElement(asEl(el), true);
    expect(reads).toBe(1);
  });

  it("空元素 / 没有 classList 的东西直接忽略", () => {
    expect(() => popElement(null as unknown as HTMLElement, false)).not.toThrow();
    expect(() => popElement({} as HTMLElement, true)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
describe("stepFeel 游戏循环", () => {
  it("返回的游戏 dt = realDt × timeScale", () => {
    const hitStop = new HitStop();
    hitStop.trigger(100, 0.1);
    expect(stepFeel(16, { hitStop })).toBeCloseTo(1.6, 10);
    expect(stepFeel(16, { hitStop })).toBeCloseTo(1.6, 10);
    hitStop.reset();
    expect(stepFeel(16, { hitStop })).toBe(16);
  });

  it("trauma 按真实时间衰减，顿帧期间照样衰减", () => {
    const trauma = traumaAt(1);
    const hitStop = new HitStop();
    hitStop.trigger(500, 0.05);
    stepFeel(250, { trauma, hitStop });
    expect(trauma.value).toBeCloseTo(0.7, 10);
  });

  it("没有部件时原样返回；脏 dt 当 0", () => {
    expect(stepFeel(16, {})).toBe(16);
    expect(stepFeel(Number.NaN, {})).toBe(0);
    expect(stepFeel(-5, { trauma: traumaAt(1) })).toBe(0);
  });

  it("一整段顿帧：游戏时间总量 ≈ 顿帧期 × slow + 其余正常", () => {
    const hitStop = new HitStop();
    feedback("large", { reduced: false, hitStop });
    let game = 0;
    for (let i = 0; i < 20; i++) game += stepFeel(10, { hitStop });
    const frozen = (FEEL_TIERS.large.hitStopMs / 10 - 1) * 10;
    expect(game).toBeCloseTo(frozen * FEEL_TIERS.large.slow + (200 - frozen), 6);
  });
});

// ---------------------------------------------------------------------------
describe("汇总导出与 CSS 对账", () => {
  it("kit/index 能直接拿到手感套件", () => {
    expect(typeof kit.feedback).toBe("function");
    expect(typeof kit.applyCameraShake).toBe("function");
    expect(typeof kit.squashStretch).toBe("function");
    expect(typeof kit.popElement).toBe("function");
    expect(typeof kit.stepFeel).toBe("function");
    expect(typeof kit.Trauma).toBe("function");
    expect(typeof kit.HitStop).toBe("function");
    expect(kit.FEEL_TIERS).toBe(FEEL_TIERS);
    expect(kit.ease).toBe(ease);
  });

  it("styles.css 有 .feel-pop / .feel-pop-flat、时长与常量对账、走 scale 属性、带 reduced 降级", () => {
    const css = readFileSync(fileURLToPath(new URL("../../styles.css", import.meta.url)), "utf8");
    const at = css.indexOf(".feel-pop {");
    expect(at).toBeGreaterThan(0);
    const tail = css.slice(at);
    expect(tail).toMatch(new RegExp(`\\.feel-pop\\s*\\{[^}]*animation:\\s*feel-pop\\s+${FEEL_POP_MS}ms`));
    expect(tail).toMatch(/\.feel-pop-flat\s*\{[^}]*filter:/);
    const kf = /@keyframes feel-pop\s*\{([\s\S]*?)\n\}/.exec(tail);
    expect(kf).not.toBeNull();
    expect((kf as RegExpExecArray)[1]).toMatch(/scale:/);
    expect((kf as RegExpExecArray)[1]).not.toMatch(/transform|perspective|translateZ|rotate3d|matrix3d/);
    expect(tail).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.feel-pop\s*\{[^}]*animation:\s*none/);
  });

  it("feel.ts 是纯模块：不碰 Math.random、不查全局 DOM、不挂 rAF", () => {
    const src = readFileSync(fileURLToPath(new URL("./feel.ts", import.meta.url)), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const banned of ["Math.random", "document.", "window.", "matchMedia", "requestAnimationFrame", "localStorage"]) {
      expect(src, banned).not.toContain(banned);
    }
    expect(src).not.toMatch(/^import (?!type )/m);
  });

  it("CSS 关键帧每一档 sx·sy ≈ 1（与 squashStretch 同一体积守恒口径）", () => {
    const css = readFileSync(fileURLToPath(new URL("../../styles.css", import.meta.url)), "utf8");
    const kf = /@keyframes feel-pop\s*\{([\s\S]*?)\n\}/.exec(css);
    const pairs = [...((kf as RegExpExecArray)[1].matchAll(/scale:\s*([\d.]+)\s+([\d.]+);/g))];
    expect(pairs.length).toBeGreaterThanOrEqual(3);
    for (const m of pairs) expect(Number(m[1]) * Number(m[2])).toBeCloseTo(1, 1);
    expect(Number(pairs[0][1])).toBeGreaterThan(1);
    expect(Number(pairs[0][2])).toBeLessThan(1);
  });
});
