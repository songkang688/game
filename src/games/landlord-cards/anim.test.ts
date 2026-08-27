import { describe, expect, it } from "vitest";
import {
  FLY_MAX_MS,
  FLY_MIN_MS,
  FLY_MS,
  FLY_REDUCED_MS,
  FLY_SPIN_DEG,
  REARRANGE_MS,
  easeOutCubic,
  flyDuration,
  flyFrame,
  flyProgress,
  inSpec,
  startFly,
  stepFly,
} from "./anim";

const FROM = { x: 20, y: 300 };
const TO = { x: 180, y: 40 };

/** 一路推到落地,顺便记下中途有没有真的在动 */
function runToLanding(reduced: boolean, dt = 16): { frames: number; mid: { x: number; y: number } } {
  let st = startFly(reduced);
  let frames = 0;
  let mid = { x: FROM.x, y: FROM.y };
  while (st.phase === "flying") {
    st = stepFly(st, dt);
    frames++;
    if (flyProgress(st) >= 0.4 && flyProgress(st) <= 0.6) {
      const f = flyFrame(FROM, TO, 12, st);
      mid = { x: f.x, y: f.y };
    }
    if (frames > 200) break;
  }
  return { frames, mid };
}

describe("飞牌时长", () => {
  it("正常飞牌落在 180–240ms 的规格区间里", () => {
    expect(FLY_MS).toBeGreaterThanOrEqual(FLY_MIN_MS);
    expect(FLY_MS).toBeLessThanOrEqual(FLY_MAX_MS);
    expect(inSpec(FLY_MS)).toBe(true);
    expect(inSpec(120)).toBe(false);
    expect(inSpec(400)).toBe(false);
  });

  it("减弱动效时换成更短的淡入,但绝不是 0(还是有过程,不瞬变)", () => {
    expect(flyDuration(false)).toBe(FLY_MS);
    expect(flyDuration(true)).toBe(FLY_REDUCED_MS);
    expect(FLY_REDUCED_MS).toBeGreaterThan(0);
    expect(FLY_REDUCED_MS).toBeLessThan(FLY_MIN_MS);
  });

  it("手牌重排也有滑动时长,不是瞬间跳位", () => {
    expect(REARRANGE_MS).toBeGreaterThan(60);
    expect(REARRANGE_MS).toBeLessThan(400);
  });
});

describe("飞牌状态机", () => {
  it("从 flying 出发,飞满时长才落地", () => {
    let st = startFly(false);
    expect(st.phase).toBe("flying");
    st = stepFly(st, FLY_MS - 1);
    expect(st.phase).toBe("flying");
    st = stepFly(st, 1);
    expect(st.phase).toBe("landed");
  });

  it("落地之后再推也不会越界,进度封在 1", () => {
    let st = startFly(false);
    st = stepFly(st, 9999);
    expect(st.elapsed).toBe(FLY_MS);
    expect(flyProgress(st)).toBe(1);
    const again = stepFly(st, 100);
    expect(again).toBe(st);
  });

  it("减弱动效走的是同一个状态机,只是时长短一些", () => {
    const normal = runToLanding(false);
    const reduced = runToLanding(true);
    expect(normal.frames).toBeGreaterThan(reduced.frames);
    expect(reduced.frames).toBeGreaterThan(0);
  });

  it("负的时间差不会把牌倒着推回去", () => {
    let st = startFly(false);
    st = stepFly(st, 50);
    const back = stepFly(st, -100);
    expect(back.elapsed).toBe(st.elapsed);
  });
});

describe("飞牌每一帧", () => {
  it("起飞在手牌位置,落点在出牌区,中途真的在半路上", () => {
    const st0 = startFly(false);
    const f0 = flyFrame(FROM, TO, 12, st0);
    expect(f0.x).toBeCloseTo(FROM.x, 5);
    const landed = stepFly(st0, FLY_MS);
    const f1 = flyFrame(FROM, TO, 12, landed);
    expect(f1.x).toBeCloseTo(TO.x, 5);
    expect(f1.y).toBeCloseTo(TO.y, 5);
    const mid = runToLanding(false).mid;
    expect(mid.x).toBeGreaterThan(FROM.x);
    expect(mid.x).toBeLessThan(TO.x);
  });

  it("飞的时候歪着,落桌时转正,而且不会歪过头", () => {
    const st = startFly(false);
    const f0 = flyFrame(FROM, TO, 40, st);
    expect(Math.abs(f0.rot)).toBeLessThanOrEqual(FLY_SPIN_DEG);
    expect(Math.abs(f0.rot)).toBeGreaterThan(0);
    const f1 = flyFrame(FROM, TO, 40, stepFly(st, FLY_MS));
    expect(f1.rot).toBeCloseTo(0, 5);
  });

  it("减弱动效不位移只淡入,落地时完全不透明", () => {
    const st = startFly(true);
    const f0 = flyFrame(FROM, TO, 12, st);
    expect(f0.x).toBe(TO.x);
    expect(f0.opacity).toBe(0);
    const f1 = flyFrame(FROM, TO, 12, stepFly(st, FLY_REDUCED_MS));
    expect(f1.opacity).toBe(1);
    expect(f1.rot).toBe(0);
  });

  it("先快后慢的缓动:头尾夹在 0 和 1,中间已经走过一半以上", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    expect(easeOutCubic(-2)).toBe(0);
    expect(easeOutCubic(9)).toBe(1);
  });
});
