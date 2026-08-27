/**
 * 碰碰砖块 · 窗口 4 档A · 第 2 轮学习优化员：A-L12。
 *
 * 掉下来的胶囊里混着一个「别接」的小板子。原来它和好道具只差一点点粉
 * （`#FFFFFF` 对 `#FFE1E9`），两个都是实心圆、都印一个表情。
 * 色弱的孩子分不出这点色差；四岁还不识字的孩子更是只能靠颜色猜。
 * 改成「好的实心、别接的空心圈」之后，形状本身就把话说清楚了。
 */
import { describe, expect, it } from "vitest";
import { POWERS, POWER_ORDER, capsuleLook, rollPower, grantPower, tickPowers, powerEffects, PADDLE_SCALE_MIN, MAX_POWER_SECONDS } from "./logic";

describe("碰碰砖块 · A-L12 · 胶囊靠形状说话", () => {
  it("好道具是实心的，别接的那个是空心圈", () => {
    for (const kind of POWER_ORDER) {
      const look = capsuleLook(kind);
      expect(look.hollow, `${POWERS[kind].name}`).toBe(!POWERS[kind].good);
      expect(look.emoji).toBe(POWERS[kind].emoji);
    }
  });

  it("六种道具里恰好一个是「别接」的，也就是只有一个空心圈", () => {
    const hollow = POWER_ORDER.filter((k) => capsuleLook(k).hollow);
    expect(hollow).toEqual(["narrow"]);
  });

  it("不靠颜色也分得开：把两种填色都当成同一个灰，形状仍然不一样", () => {
    const good = capsuleLook("wide");
    const bad = capsuleLook("narrow");
    // 颜色确实很接近——这正是原来的问题
    expect(good.fill).not.toBe(bad.fill);
    // 但就算完全无视颜色，hollow 这一位也把两者分开了
    expect(good.hollow).not.toBe(bad.hollow);
  });

  it("每种胶囊都印着自己的表情，形状之外还有第二重线索", () => {
    const emojis = POWER_ORDER.map((k) => capsuleLook(k).emoji);
    expect(new Set(emojis).size).toBe(POWER_ORDER.length);
    for (const e of emojis) expect(e.length).toBeGreaterThan(0);
  });

  it("摇出来的每一种都画得出样子，不会摇出个没长相的道具", () => {
    for (let i = 0; i < 200; i++) {
      const kind = rollPower(i / 200);
      expect(POWER_ORDER).toContain(kind);
      expect(capsuleLook(kind).emoji.length).toBeGreaterThan(0);
    }
  });

  it("接到「别接」的那个也只是小板子 5 秒，而且宽板会把它顶掉——惩罚有上限", () => {
    let t = grantPower({}, "narrow");
    expect(t.narrow).toBe(POWERS.narrow.seconds);
    expect(powerEffects(t).paddleScale).toBeGreaterThanOrEqual(PADDLE_SCALE_MIN);
    // 连吃两个也不会叠成十秒
    t = grantPower(t, "narrow");
    expect(t.narrow).toBeLessThanOrEqual(POWERS.narrow.seconds);
    expect(t.narrow).toBeLessThanOrEqual(MAX_POWER_SECONDS);
    // 接一个宽板立刻解除
    t = grantPower(t, "wide");
    expect(t.narrow).toBeUndefined();
    // 时间走完自己就没了
    expect(tickPowers({ narrow: 0.1 }, 0.2).narrow).toBeUndefined();
  });
});
