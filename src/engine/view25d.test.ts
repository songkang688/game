import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOV,
  DEFAULT_HORIZON,
  MAX_SCALE,
  MIN_SCALE,
  defaultCamera,
  focalLength,
  fogAlpha,
  groundGridDepths,
  horizonY,
  installView25dCss,
  project,
  respectReducedMotion,
  roadQuad,
  sanitizeCamera,
  scaleAtDepth
} from "./view25d";

const W = 400;
const H = 300;

describe("相机与缩放", () => {
  it("缺省相机就是透视,地平线在三成高的地方", () => {
    const cam = defaultCamera();
    expect(cam.kind).toBe("perspective");
    expect(cam.horizon).toBe(DEFAULT_HORIZON);
    expect(cam.fov).toBe(DEFAULT_FOV);
  });

  it("可以要一台平面相机", () => {
    expect(defaultCamera("flat").kind).toBe("flat");
  });

  it("z 越大缩放越小", () => {
    const cam = defaultCamera();
    const near = scaleAtDepth(cam, 0);
    const mid = scaleAtDepth(cam, 10);
    const far = scaleAtDepth(cam, 100);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
    expect(far).toBeGreaterThanOrEqual(MIN_SCALE);
  });

  it("z = 0 时缩放正好是 1", () => {
    expect(scaleAtDepth(defaultCamera(), 0)).toBeCloseTo(1, 6);
  });

  it("贴到镜头跟前也不会炸开,被 MAX_SCALE 夹住", () => {
    const cam = defaultCamera();
    expect(scaleAtDepth(cam, -5.999)).toBeLessThanOrEqual(MAX_SCALE);
    expect(Number.isFinite(scaleAtDepth(cam, -5.999))).toBe(true);
  });

  it("相机后面的点缩放按最小值处理,不会除零", () => {
    expect(scaleAtDepth(defaultCamera(), -100)).toBe(MIN_SCALE);
  });

  it("flat 模式缩放恒为 1", () => {
    const cam = defaultCamera("flat");
    expect(scaleAtDepth(cam, 0)).toBe(1);
    expect(scaleAtDepth(cam, 999)).toBe(1);
  });

  it("脏相机参数会被收拾干净", () => {
    const dirty = sanitizeCamera({
      kind: "perspective",
      fov: Number.NaN,
      horizon: 9,
      cameraY: Number.NaN,
      cameraZ: -3
    });
    expect(Number.isFinite(dirty.fov)).toBe(true);
    expect(dirty.horizon).toBeLessThanOrEqual(1);
    expect(dirty.cameraZ).toBeGreaterThan(0);
  });

  it("极端视场角不会算出 NaN", () => {
    for (const fov of [0, 180, 360, -10, Number.NaN]) {
      const cam = { ...defaultCamera(), fov };
      expect(Number.isFinite(focalLength(cam))).toBe(true);
      expect(Number.isFinite(project(cam, 1, 0, 5, W, H).x)).toBe(true);
    }
  });
});

describe("投影", () => {
  it("很远的点落在地平线附近", () => {
    const cam = defaultCamera();
    const far = project(cam, 0, 0, 5000, W, H);
    expect(far.y).toBeGreaterThan(horizonY(cam, H) - 1);
    expect(far.y).toBeLessThan(horizonY(cam, H) + 12);
  });

  it("z = 0 的地面点落在画面底边", () => {
    const p = project(defaultCamera(), 0, 0, 0, W, H);
    expect(p.y).toBeCloseTo(H, 6);
    expect(p.x).toBeCloseTo(W / 2, 6);
  });

  it("同一个横向偏移,越远看着越靠中间", () => {
    const cam = defaultCamera();
    const near = project(cam, 100, 0, 0, W, H);
    const far = project(cam, 100, 0, 60, W, H);
    expect(Math.abs(far.x - W / 2)).toBeLessThan(Math.abs(near.x - W / 2));
  });

  it("相机后面的点 visible 是 false", () => {
    expect(project(defaultCamera(), 0, 0, -50, W, H).visible).toBe(false);
  });

  it("flat 模式变成正交投影,缩放恒为 1", () => {
    const cam = defaultCamera("flat");
    const a = project(cam, 10, 0, 0, W, H);
    const b = project(cam, 10, 0, 900, W, H);
    expect(a.scale).toBe(1);
    expect(b.scale).toBe(1);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
  });

  it("prefers-reduced-motion 时降级成 flat", () => {
    const cam = defaultCamera();
    expect(respectReducedMotion(cam, true).kind).toBe("flat");
    expect(respectReducedMotion(cam, false).kind).toBe("perspective");
  });

  it("视口宽高为 0 时不抛,也不返回 NaN", () => {
    expect(() => project(defaultCamera(), 1, 1, 1, 0, 0)).not.toThrow();
    const p = project(defaultCamera(), 1, 1, 1, 0, 0);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  it("传 NaN 进来也给有限数值", () => {
    const p = project(defaultCamera(), Number.NaN, Number.NaN, Number.NaN, W, H);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    expect(Number.isFinite(p.scale)).toBe(true);
  });
});

describe("路面梯形", () => {
  it("返回四个点,而且远端比近端窄", () => {
    const quad = roadQuad(defaultCamera(), 0, 40, 3, W, H);
    expect(quad).not.toBeNull();
    expect(quad!.length).toBe(4);
    const nearWidth = Math.abs(quad![1][0] - quad![0][0]);
    const farWidth = Math.abs(quad![2][0] - quad![3][0]);
    expect(farWidth).toBeLessThan(nearWidth);
  });

  it("整段都在相机后面时返回 null", () => {
    expect(roadQuad(defaultCamera(), -100, -50, 3, W, H)).toBeNull();
  });

  it("z0 / z1 写反了也照样画得出来", () => {
    const a = roadQuad(defaultCamera(), 40, 0, 3, W, H);
    const b = roadQuad(defaultCamera(), 0, 40, 3, W, H);
    expect(a).toEqual(b);
  });

  it("远端的 y 比近端小(更靠上)", () => {
    const quad = roadQuad(defaultCamera(), 0, 40, 3, W, H)!;
    expect(quad[3][1]).toBeLessThan(quad[0][1]);
  });
});

describe("雾化与地面网格", () => {
  it("越远雾越浓,近处不上雾", () => {
    expect(fogAlpha(1)).toBe(0);
    expect(fogAlpha(0.5)).toBeGreaterThan(0);
    expect(fogAlpha(0.1)).toBeGreaterThan(fogAlpha(0.5));
  });

  it("雾被 maxAlpha 夹住", () => {
    expect(fogAlpha(0, 0.4)).toBeLessThanOrEqual(0.4);
    expect(fogAlpha(0, 2)).toBeLessThanOrEqual(1);
    expect(fogAlpha(Number.NaN)).toBeGreaterThanOrEqual(0);
  });

  it("网格深度递增且不超过 maxDepth", () => {
    const depths = groundGridDepths(3, 10, 100);
    expect(depths.length).toBeGreaterThan(0);
    for (let i = 1; i < depths.length; i++) expect(depths[i]).toBeGreaterThan(depths[i - 1]);
    expect(Math.max(...depths)).toBeLessThanOrEqual(100);
  });

  it("滚动量为负也能算出正的深度序列", () => {
    const depths = groundGridDepths(-7, 10, 50);
    expect(depths[0]).toBeGreaterThanOrEqual(0);
    expect(depths.every((d) => Number.isFinite(d))).toBe(true);
  });

  it("间距或最远距离不合法时给空数组,不死循环", () => {
    expect(groundGridDepths(0, 0, 100)).toEqual([]);
    expect(groundGridDepths(0, 10, 0)).toEqual([]);
    expect(groundGridDepths(0, Number.NaN, 100)).toEqual([]);
  });

  it("极密的网格也有条数上限", () => {
    expect(groundGridDepths(0, 0.0001, 1000).length).toBeLessThanOrEqual(512);
  });

  it("没有浏览器环境时注入 CSS 不抛异常", () => {
    expect(() => installView25dCss()).not.toThrow();
  });
});
