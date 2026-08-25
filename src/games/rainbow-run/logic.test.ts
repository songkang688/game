import { describe, expect, it } from "vitest";
import { clampLane, detectSwipe, starsForHearts, wouldHit } from "./logic";

describe("rainbow-run 滑动手势", () => {
  it("按主要方向判断", () => {
    expect(detectSwipe(60, 5)).toBe("right");
    expect(detectSwipe(-60, 5)).toBe("left");
    expect(detectSwipe(5, -60)).toBe("up");
    expect(detectSwipe(5, 60)).toBe("down");
  });

  it("太短的滑动不算", () => {
    expect(detectSwipe(5, 5)).toBeNull();
    expect(detectSwipe(0, 0)).toBeNull();
    expect(detectSwipe(23, 0, 24)).toBeNull();
    expect(detectSwipe(24, 0, 24)).toBe("right");
  });
});

describe("rainbow-run 碰撞规则", () => {
  it("跳过小栅栏,趴过彩虹杆,大软糖必须换道", () => {
    expect(wouldHit("hurdle", "jump")).toBe(false);
    expect(wouldHit("hurdle", "run")).toBe(true);
    expect(wouldHit("hurdle", "slide")).toBe(true);
    expect(wouldHit("bar", "slide")).toBe(false);
    expect(wouldHit("bar", "jump")).toBe(true);
    expect(wouldHit("rock", "jump")).toBe(true);
    expect(wouldHit("rock", "slide")).toBe(true);
    expect(wouldHit("rock", "run")).toBe(true);
  });
});

describe("rainbow-run 车道与星星", () => {
  it("车道只有 0/1/2", () => {
    expect(clampLane(-1)).toBe(0);
    expect(clampLane(0)).toBe(0);
    expect(clampLane(2)).toBe(2);
    expect(clampLane(3)).toBe(2);
  });

  it("剩的心越多星星越多", () => {
    expect(starsForHearts(3)).toBe(3);
    expect(starsForHearts(2)).toBe(2);
    expect(starsForHearts(1)).toBe(1);
  });
});
