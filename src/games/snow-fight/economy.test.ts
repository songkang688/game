/**
 * 雪球经济的用例。
 *
 * 这一层要守住三件事:手里攥不下第四颗、蹲下 0.6 秒才有一颗(站起来就白搓)、
 * 同一个坑挖久了会秃。少了任何一件,「躲—搓—投」就退化成「一直扔」。
 */
import { describe, expect, it } from "vitest";
import {
  DEPTH_PER_BALL,
  HAND_MAX,
  SCOOP_TIME,
  SNOWFALL_RATE,
  SPLASH_DEPTH,
  THIN_RATE,
  THIN_SNOW,
  ballsLeftAt,
  depthAt,
  interrupt,
  makeField,
  makeHands,
  patchIndex,
  richestSpot,
  scoopRate,
  scoopTick,
  snowfallTick,
  spendBall,
  splashSnow,
  type Hands,
  type SnowField,
} from "./economy";

/** 蹲着搓 `seconds` 秒,返回搓完之后的手和地 */
function scoopFor(hands: Hands, field: SnowField, x: number, seconds: number, dt = 1 / 120): {
  hands: Hands;
  field: SnowField;
  made: number;
} {
  let h = hands;
  let f = field;
  let made = 0;
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    const out = scoopTick(h, f, x, dt);
    h = out.hands;
    f = out.field;
    if (out.made) made += 1;
  }
  return { hands: h, field: f, made };
}

describe("手里最多三颗", () => {
  it("`makeHands` 自己就夹在 0..3", () => {
    expect(makeHands(9).balls).toBe(HAND_MAX);
    expect(makeHands(-4).balls).toBe(0);
    expect(makeHands(2).balls).toBe(2);
  });

  it("攥满三颗就搓不动了,进度也不会偷偷攒着", () => {
    const field = makeField(60, 1);
    const out = scoopTick(makeHands(HAND_MAX), field, 10, 0.4);
    expect(out.made).toBe(false);
    expect(out.blocked).toBe("full");
    expect(out.hands.progress).toBe(0);
    // 手满了也不该白挖一层雪
    expect(depthAt(out.field, 10)).toBe(depthAt(field, 10));
  });

  it("扔一颗少一颗;空着手扔不出去(返回 null,让上层去提示「先蹲下搓一颗」)", () => {
    expect(spendBall(makeHands(2))?.balls).toBe(1);
    expect(spendBall(makeHands(0))).toBeNull();
  });
});

describe("蹲下搓 0.6 秒一颗", () => {
  it("满雪的地方正好 0.6 秒出一颗,0.59 秒还差一点点", () => {
    const field = makeField(60, 1);
    expect(scoopFor(makeHands(0), field, 10, SCOOP_TIME - 0.02).made).toBe(0);
    const done = scoopFor(makeHands(0), field, SCOOP_TIME + 0.01 > 0 ? 10 : 10, SCOOP_TIME + 0.01);
    expect(done.made).toBe(1);
    expect(done.hands.balls).toBe(1);
  });

  it("搓一半站起来就白搓了:进度清零,下次从头来", () => {
    const field = makeField(60, 1);
    const half = scoopFor(makeHands(0), field, 10, SCOOP_TIME * 0.7);
    expect(half.hands.progress).toBeGreaterThan(0);
    expect(half.hands.balls).toBe(0);
    const after = interrupt(half.hands);
    expect(after.progress).toBe(0);
    expect(after.balls).toBe(0);
    // 已经是 0 的话原样返回,不白造一个新对象
    expect(interrupt(after)).toBe(after);
  });

  it("每搓出一颗,脚下就薄一层", () => {
    const field = makeField(60, 1);
    const out = scoopFor(makeHands(0), field, 10, SCOOP_TIME * 2 + 0.05);
    expect(out.made).toBe(2);
    expect(depthAt(out.field, 10)).toBeCloseTo(1 - DEPTH_PER_BALL * 2, 6);
  });
});

describe("地面积雪会被挖秃", () => {
  it("薄雪搓起来慢一半,挖光了干脆搓不出来", () => {
    expect(scoopRate(1)).toBe(1);
    expect(scoopRate(THIN_SNOW - 0.01)).toBe(THIN_RATE);
    expect(scoopRate(0)).toBe(0);
    const bare = scoopTick(makeHands(0), makeField(60, 0), 10, 1);
    expect(bare.made).toBe(false);
    expect(bare.blocked).toBe("bare");
  });

  it("同一个坑一直挖会挖秃:满雪的一格最多挖出五颗,再蹲也没用", () => {
    const field = makeField(60, 1);
    expect(ballsLeftAt(field, 10)).toBe(Math.floor(1 / DEPTH_PER_BALL));
    let f = field;
    let made = 0;
    // 每搓出一颗就当扔出去了,手永远不满;蹲到天荒地老也只能挖出这么多
    for (let i = 0; i < 200; i++) {
      const out = scoopFor({ balls: 0, progress: 0 }, f, 10, SCOOP_TIME / THIN_RATE + 0.05);
      f = out.field;
      made += out.made;
    }
    expect(made).toBe(Math.floor(1 / DEPTH_PER_BALL));
    expect(ballsLeftAt(f, 10)).toBe(0);
  });

  it("雪季一直在下,被挖秃的阵地慢慢又能用了;雪球落地也会溅回一点", () => {
    const bare = makeField(60, 0);
    const after = snowfallTick(bare, 10);
    expect(depthAt(after, 10)).toBeCloseTo(SNOWFALL_RATE * 10, 6);
    expect(depthAt(snowfallTick(makeField(60, 1), 10), 10)).toBe(1);
    expect(depthAt(splashSnow(bare, 10), 10)).toBeCloseTo(SPLASH_DEPTH, 6);
  });

  it("`richestSpot` 指向附近雪最厚的一格,而且不会为了一丁点厚度横穿整个场地", () => {
    const field = makeField(60, 0.2);
    field.depth[3] = 1;
    const near = richestSpot(field, 10, 12);
    expect(patchIndex(field, near)).toBe(3);
    // 厚雪在 30 格开外时,范围外的那一格不算数
    const far = makeField(60, 0.2);
    far.depth[18] = 1;
    expect(Math.abs(richestSpot(far, 3, 8) - 3)).toBeLessThanOrEqual(8);
  });

  it("站在场地两头也不会读到 undefined:下标夹在有效范围里", () => {
    const field = makeField(60, 0.5);
    expect(patchIndex(field, -999)).toBe(0);
    expect(patchIndex(field, 9999)).toBe(field.depth.length - 1);
    expect(depthAt(field, -999)).toBe(0.5);
    expect(depthAt(field, 9999)).toBe(0.5);
  });
});
