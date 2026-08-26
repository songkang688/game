import { describe, expect, it } from "vitest";
import {
  COYOTE_TIME,
  INPUT_BUFFER,
  feelConsume,
  feelPress,
  feelTick,
  feelWantsJump,
  hasBufferedJump,
  hasCoyote,
  initJumpFeel,
  inputForKey,
  inputForSwipe,
  isLaneInput,
  laneStep,
} from "./controls";
import { detectSwipe } from "./logic";

describe("彩虹跑跑 · 操作三件套", () => {
  it("跳跃认四种按法:↑、W、空格,还有老浏览器的 Spacebar", () => {
    for (const key of ["ArrowUp", "w", "W", " ", "Spacebar"]) {
      expect(inputForKey(key), key).toBe("jump");
    }
  });

  it("左右换道认方向键和 A D,大小写都行", () => {
    for (const key of ["ArrowLeft", "a", "A"]) expect(inputForKey(key), key).toBe("left");
    for (const key of ["ArrowRight", "d", "D"]) expect(inputForKey(key), key).toBe("right");
  });

  it("下滑滚翻认 ↓ 和 S", () => {
    for (const key of ["ArrowDown", "s", "S"]) expect(inputForKey(key), key).toBe("roll");
  });

  it("不管的键返回 null,好让页面照常处理(Tab 还能翻页)", () => {
    for (const key of ["Tab", "Enter", "Escape", "q", "1", ""]) {
      expect(inputForKey(key), key).toBeNull();
    }
  });

  it("四个滑动方向和四种操作一一对上", () => {
    expect(inputForSwipe("up")).toBe("jump");
    expect(inputForSwipe("down")).toBe("roll");
    expect(inputForSwipe("left")).toBe("left");
    expect(inputForSwipe("right")).toBe("right");
  });

  it("手指真的滑一下:短滑不算,上滑起跳、下滑滚翻、左右换道", () => {
    expect(detectSwipe(3, -4)).toBeNull();
    expect(inputForSwipe(detectSwipe(0, -40)!)).toBe("jump");
    expect(inputForSwipe(detectSwipe(0, 40)!)).toBe("roll");
    expect(inputForSwipe(detectSwipe(-40, 0)!)).toBe("left");
    expect(inputForSwipe(detectSwipe(40, 0)!)).toBe("right");
  });

  it("只有换道才动车道号,跳和滚翻不挪位置", () => {
    expect(isLaneInput("left")).toBe(true);
    expect(isLaneInput("right")).toBe(true);
    expect(isLaneInput("jump")).toBe(false);
    expect(isLaneInput("roll")).toBe(false);
    expect(laneStep("left")).toBe(-1);
    expect(laneStep("right")).toBe(1);
    expect(laneStep("jump")).toBe(0);
    expect(laneStep("roll")).toBe(0);
  });
});

describe("彩虹跑跑 · 土狼时间", () => {
  it("土狼时间是 90 毫秒这一档,不是随手写的一个大数", () => {
    expect(COYOTE_TIME).toBeCloseTo(0.09, 6);
    expect(COYOTE_TIME).toBeGreaterThan(0.05);
    expect(COYOTE_TIME).toBeLessThan(0.15);
  });

  it("刚离开地面的 90 毫秒之内还跳得起来,超过就跳不动了", () => {
    let feel = initJumpFeel();
    expect(hasCoyote(feel, true)).toBe(true);
    feel = feelTick(feel, 0.05, false);
    expect(hasCoyote(feel, false)).toBe(true);
    feel = feelTick(feel, 0.04, false); // 刚好 90ms
    expect(feel.airTime).toBeCloseTo(COYOTE_TIME, 6);
    expect(hasCoyote(feel, false)).toBe(true);
    feel = feelTick(feel, 0.02, false); // 110ms,过了
    expect(hasCoyote(feel, false)).toBe(false);
  });

  it("重新踩到地上,离地计时立刻清零,土狼时间又满上", () => {
    let feel = initJumpFeel();
    for (let i = 0; i < 10; i++) feel = feelTick(feel, 0.05, false);
    expect(hasCoyote(feel, false)).toBe(false);
    feel = feelTick(feel, 0.05, true);
    expect(feel.airTime).toBe(0);
    expect(hasCoyote(feel, false)).toBe(true);
  });

  it("踏空之后靠土狼时间补上的那一跳,真的跳得出来", () => {
    let feel = initJumpFeel();
    feel = feelTick(feel, 0.06, false); // 已经踏空 60ms
    feel = feelPress(feel); // 这时候才按
    expect(feelWantsJump(feel, false)).toBe(true);
  });
});

describe("彩虹跑跑 · 输入缓冲", () => {
  it("输入缓冲是 120 毫秒这一档", () => {
    expect(INPUT_BUFFER).toBeCloseTo(0.12, 6);
    expect(INPUT_BUFFER).toBeGreaterThan(COYOTE_TIME);
    expect(INPUT_BUFFER).toBeLessThan(0.2);
  });

  it("落地前 120 毫秒内按下的跳会被记住,一落地就补上", () => {
    let feel = initJumpFeel();
    feel = feelTick(feel, 0.2, false); // 还在空中,已经超过土狼时间
    feel = feelPress(feel); // 提前按
    expect(feelWantsJump(feel, false)).toBe(false); // 空中不给跳
    feel = feelTick(feel, 0.1, false); // 又飞了 100ms,缓冲还新鲜
    expect(hasBufferedJump(feel)).toBe(true);
    feel = feelTick(feel, 0.01, true); // 落地
    expect(feelWantsJump(feel, true)).toBe(true);
  });

  it("按得太早(超过 120 毫秒)就不算了,不会莫名其妙自己跳一下", () => {
    let feel = feelPress(initJumpFeel());
    feel = feelTick(feel, 0.13, false);
    expect(hasBufferedJump(feel)).toBe(false);
    expect(feelWantsJump(feel, true)).toBe(false);
  });

  it("刚好卡在 120 毫秒还算数,边界是包含的", () => {
    let feel = feelPress(initJumpFeel());
    feel = feelTick(feel, 0.06, true);
    feel = feelTick(feel, 0.06, true);
    expect(feel.sincePress).toBeCloseTo(INPUT_BUFFER, 6);
    expect(hasBufferedJump(feel)).toBe(true);
  });

  it("跳出去就把缓冲用掉,一次按键只跳一下", () => {
    let feel = feelPress(initJumpFeel());
    expect(feelWantsJump(feel, true)).toBe(true);
    feel = feelConsume(feel);
    expect(feel.sincePress).toBe(Infinity);
    expect(hasBufferedJump(feel)).toBe(false);
    expect(feelWantsJump(feel, true)).toBe(false);
    // 用掉之后再走多久都不会自己冒出来
    feel = feelTick(feel, 5, true);
    expect(feel.sincePress).toBe(Infinity);
  });

  it("没按过跳的时候,站在地上也不会自己跳", () => {
    const feel = initJumpFeel();
    expect(feel.sincePress).toBe(Infinity);
    expect(feelWantsJump(feel, true)).toBe(false);
  });

  it("推进用的是真实时间,dt 不合法就当没走(60fps 与 30fps 判定一致)", () => {
    const base = feelPress(initJumpFeel());
    expect(feelTick(base, 0, false).sincePress).toBe(0);
    expect(feelTick(base, -1, false).sincePress).toBe(0);
    // 同样是 120ms,分 2 帧走和分 8 帧走的结论一样
    let coarse = base;
    for (let i = 0; i < 2; i++) coarse = feelTick(coarse, 0.06, false);
    let fine = base;
    for (let i = 0; i < 8; i++) fine = feelTick(fine, 0.015, false);
    expect(hasBufferedJump(coarse)).toBe(hasBufferedJump(fine));
    expect(coarse.airTime).toBeCloseTo(fine.airTime, 10);
  });
});
