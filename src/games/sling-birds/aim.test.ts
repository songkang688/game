/**
 * 1.2 第 12 步 A 档新增:弹道预测点与触屏拖动锚点偏移。
 */
import { describe, expect, it } from "vitest";
import {
  FINGER_GAP,
  MIN_DRAG,
  PREVIEW_DOTS_MAX,
  PREVIEW_DOTS_MIN,
  PREVIEW_PRECISE_RATIO,
  RELEASE_STRETCH_TIME,
  bandTension,
  dragFromPointer,
  fingerDistance,
  grabOffset,
  previewDotCount,
  previewDotStyle,
  previewDots,
  releaseStretch
} from "./aim";
import { MAX_DRAG, SLING_X, SLING_Y, launchVelocity, simulateTrajectory } from "./physics";

describe("sling-birds 1.2 弹道预测点(8–12 个衰减小点)", () => {
  it("点数永远落在 8–12 之间:轻轻一拉 8 个,拉满 12 个", () => {
    expect(previewDotCount(MIN_DRAG)).toBe(PREVIEW_DOTS_MIN);
    expect(previewDotCount(MAX_DRAG)).toBe(PREVIEW_DOTS_MAX);
    for (let d = 0; d <= MAX_DRAG + 20; d += 1.5) {
      const n = previewDotCount(d);
      expect(n).toBeGreaterThanOrEqual(PREVIEW_DOTS_MIN);
      expect(n).toBeLessThanOrEqual(PREVIEW_DOTS_MAX);
    }
  });

  it("前 60% 是精确点,后 40% 淡出", () => {
    const n = 10;
    const styles = Array.from({ length: n }, (_, i) => previewDotStyle(i, n));
    const precise = styles.filter((s) => s.precise).length;
    expect(precise).toBe(Math.round(n * PREVIEW_PRECISE_RATIO));
    expect(styles[0].precise).toBe(true);
    expect(styles[n - 1].precise).toBe(false);
  });

  it("透明度与半径一路衰减,最后一个点几乎看不见(不是完整落点圈)", () => {
    const dots = previewDots(SLING_X, SLING_Y, 320, -260, 1, [], 12);
    expect(dots.length).toBe(12);
    for (let i = 1; i < dots.length; i++) {
      expect(dots[i].alpha).toBeLessThan(dots[i - 1].alpha);
      expect(dots[i].radius).toBeLessThanOrEqual(dots[i - 1].radius);
    }
    expect(dots[dots.length - 1].alpha).toBeLessThan(0.25);
    expect(dots[dots.length - 1].radius).toBeLessThan(2);
  });

  it("精确段的位置与实弹积分逐点吻合(预览即实弹)", () => {
    const truth = simulateTrajectory(SLING_X, SLING_Y, 300, -240, 0.75, [], 12, 0.07);
    const dots = previewDots(SLING_X, SLING_Y, 300, -240, 0.75, [], 12);
    dots.forEach((d, i) => {
      expect(d.x).toBeCloseTo(truth[i].x, 9);
      expect(d.y).toBeCloseTo(truth[i].y, 9);
    });
  });

  it("点数请求超出范围会被夹回 8–12", () => {
    expect(previewDots(SLING_X, SLING_Y, 300, -200, 1, [], 40).length).toBe(PREVIEW_DOTS_MAX);
    expect(previewDots(SLING_X, SLING_Y, 300, -200, 1, [], 2).length).toBe(PREVIEW_DOTS_MIN);
  });
});

describe("sling-birds 1.2 触屏拉弓:拖动锚点偏移", () => {
  it("按在手指禁区以外:小鸟原地不动,不会瞬移到手指底下", () => {
    for (const [px, py] of [
      [40, 300],
      [180, 260],
      [300, 200],
      [SLING_X, SLING_Y + FINGER_GAP + 1]
    ]) {
      const off = grabOffset(px, py);
      const d = dragFromPointer(px, py, off);
      expect(Math.hypot(d.dx, d.dy)).toBeCloseTo(0, 6);
    }
  });

  it("按进弹弓的手指禁区:锚点被推到禁区边上,手指与小鸟隔着一个指尖", () => {
    const off = grabOffset(SLING_X + 4, SLING_Y + 6);
    expect(Math.hypot(off.ox, off.oy)).toBeCloseTo(FINGER_GAP, 6);
    const d = dragFromPointer(SLING_X + 4, SLING_Y + 6, off);
    expect(fingerDistance(SLING_X + 4, SLING_Y + 6, d.dx, d.dy)).toBeCloseTo(FINGER_GAP, 6);
    // 推开之后小鸟还在弹弓拉得到的范围内
    expect(Math.hypot(d.dx, d.dy)).toBeLessThanOrEqual(MAX_DRAG + 1e-6);
  });

  it("正正好按在弹弓中心:小鸟往左下(拉弓方向)让开,手指落在右上", () => {
    const off = grabOffset(SLING_X, SLING_Y);
    const d = dragFromPointer(SLING_X, SLING_Y, off);
    expect(d.dx).toBeLessThan(0);
    expect(d.dy).toBeGreaterThan(0);
    expect(fingerDistance(SLING_X, SLING_Y, d.dx, d.dy)).toBeCloseTo(FINGER_GAP, 6);
  });

  it("拖到哪里手指都不会压住小鸟:全网格扫一遍(含拖过头、拖回弹弓),间距始终 ≥ FINGER_GAP", () => {
    for (let dx = -140; dx <= 320; dx += 15) {
      for (let dy = -100; dy <= 140; dy += 15) {
        const downX = SLING_X + dx;
        const downY = SLING_Y + dy;
        const off = grabOffset(downX, downY);
        for (let mx = -220; mx <= 220; mx += 55) {
          for (let my = -160; my <= 160; my += 55) {
            const px = downX + mx;
            const py = downY + my;
            const d = dragFromPointer(px, py, off);
            expect(Math.hypot(d.dx, d.dy)).toBeLessThanOrEqual(MAX_DRAG + 1e-6);
            expect(fingerDistance(px, py, d.dx, d.dy)).toBeGreaterThanOrEqual(FINGER_GAP - 1e-6);
          }
        }
      }
    }
  });

  it("手指一路拖回弹弓上(极端情况):小鸟始终留在弹弓拉得到的范围内", () => {
    const off = grabOffset(240, 300);
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const px = 240 + (SLING_X - 240) * t;
      const py = 300 + (SLING_Y - 300) * t;
      const d = dragFromPointer(px, py, off);
      expect(Math.hypot(d.dx, d.dy)).toBeLessThanOrEqual(MAX_DRAG + 1e-6);
    }
  });

  it("相对拖动:手指挪多少,小鸟就挪多少(没超上限时)", () => {
    const off = grabOffset(200, 280);
    const d = dragFromPointer(200 - 30, 280 + 20, off);
    expect(d.dx).toBeCloseTo(-30, 6);
    expect(d.dy).toBeCloseTo(20, 6);
  });

  it("拉过头会被夹在 MAX_DRAG 上,方向不变", () => {
    const off = grabOffset(200, 280);
    const d = dragFromPointer(200 - 400, 280 + 300, off);
    expect(Math.hypot(d.dx, d.dy)).toBeCloseTo(MAX_DRAG, 6);
    expect(d.dx).toBeLessThan(0);
    expect(d.dy).toBeGreaterThan(0);
  });

  it("往左下拉 → 往右上飞(拉弓方向与发射方向相反)", () => {
    const off = grabOffset(240, 300);
    const d = dragFromPointer(240 - 40, 300 + 30, off);
    const v = launchVelocity(d.dx, d.dy);
    expect(v.vx).toBeGreaterThan(0);
    expect(v.vy).toBeLessThan(0);
  });
});

describe("sling-birds 1.2 皮筋张力与松手镜头", () => {
  it("张力 0..1,拉满是 1", () => {
    expect(bandTension(0)).toBe(0);
    expect(bandTension(MAX_DRAG)).toBe(1);
    expect(bandTension(MAX_DRAG * 3)).toBe(1);
    expect(bandTension(MAX_DRAG / 2)).toBeCloseTo(0.5, 6);
  });

  it("松手拉伸从大到小,时间到就回到 1", () => {
    const a = releaseStretch(0);
    const b = releaseStretch(RELEASE_STRETCH_TIME / 2);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(1);
    expect(releaseStretch(RELEASE_STRETCH_TIME)).toBe(1);
    expect(releaseStretch(99)).toBe(1);
  });

  it("reduced-motion(scale=0)完全不拉伸", () => {
    expect(releaseStretch(0, 1, 0)).toBe(1);
    expect(releaseStretch(0.1, 1, 0)).toBe(1);
  });
});
