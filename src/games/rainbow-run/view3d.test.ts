import { describe, expect, it } from "vitest";
import {
  CAM_DEPTH_RATIO,
  FPS_DOWNGRADE,
  FPS_UPGRADE,
  HORIZON_RATIO,
  MAX_DT,
  MAX_SCALE,
  PARALLAX_LAYERS,
  QUALITY_TIERS,
  SPAWN_TRACK_Y,
  clampDt,
  depthOf,
  edgeOffset,
  fogAlpha,
  groundGridDepths,
  laneOffset,
  makeCamera,
  mixHex,
  nextQualityTier,
  parallaxShift,
  particleCount,
  projectFlatX,
  projectTrack,
  scaleAtDepth,
  screenYAtDepth,
  smoothFps,
  smoothing,
  withAlpha,
} from "./view3d";

/** 两个验收尺寸:窄屏手机与横屏平板 */
const PHONE = makeCamera(375, 667);
const TABLET = makeCamera(1280, 800);

describe("彩虹跑跑 2.5D · 透视投影单调性", () => {
  it("深度一路往远走,缩放严格越来越小,一次回头都没有", () => {
    for (const cam of [PHONE, TABLET]) {
      let prev = scaleAtDepth(cam, 0);
      for (let d = 4; d <= cam.camDepth * 12; d += 4) {
        const s = scaleAtDepth(cam, d);
        expect(s, `深度 ${d} 的缩放没有继续变小`).toBeLessThanOrEqual(prev);
        prev = s;
      }
      // 全程严格小于玩家脚下那一档,而且一直是正数
      expect(prev).toBeLessThan(scaleAtDepth(cam, 0));
      expect(prev).toBeGreaterThan(0);
    }
  });

  it("深度一路往远走,屏幕 y 严格往地平线爬,永远不会翻过去", () => {
    for (const cam of [PHONE, TABLET]) {
      let prev = screenYAtDepth(cam, 0);
      expect(prev).toBeCloseTo(cam.playerY, 6);
      for (let d = 4; d <= cam.camDepth * 12; d += 4) {
        const y = screenYAtDepth(cam, d);
        expect(y, `深度 ${d} 的屏幕 y 反而往下走了`).toBeLessThanOrEqual(prev);
        expect(y).toBeGreaterThan(cam.horizonY);
        prev = y;
      }
    }
  });

  it("同一条车道:越远的东西画得越高越靠中间,顺序一次都不乱", () => {
    for (const cam of [PHONE, TABLET]) {
      for (const lane of [0, 1, 2]) {
        let prev = projectTrack(cam, cam.playerY, lane);
        // trackY 越小离得越远
        for (let ty = cam.playerY - 20; ty >= SPAWN_TRACK_Y; ty -= 20) {
          const cur = projectTrack(cam, ty, lane);
          expect(cur.y).toBeLessThanOrEqual(prev.y);
          expect(cur.scale).toBeLessThanOrEqual(prev.scale);
          // 边道越远越贴近画面中线,中间道一直在中线上
          const dNow = Math.abs(cur.x - cam.w / 2);
          const dPrev = Math.abs(prev.x - cam.w / 2);
          expect(dNow).toBeLessThanOrEqual(dPrev + 1e-9);
          prev = cur;
        }
      }
    }
  });

  it("两个东西谁在前谁在后,投影之后画面上的高低顺序不会颠倒", () => {
    const cam = PHONE;
    for (let a = SPAWN_TRACK_Y; a < cam.playerY; a += 37) {
      const b = a + 31;
      // b 比 a 近 → b 一定画得更低、更大
      expect(screenYAtDepth(cam, depthOf(cam, b))).toBeGreaterThanOrEqual(
        screenYAtDepth(cam, depthOf(cam, a)),
      );
      expect(scaleAtDepth(cam, depthOf(cam, b))).toBeGreaterThanOrEqual(
        scaleAtDepth(cam, depthOf(cam, a)),
      );
    }
  });

  it("三条道之间的横向间距随深度严格收窄,远处收敛到同一个消失点", () => {
    for (const cam of [PHONE, TABLET]) {
      let prev = Infinity;
      for (let d = 0; d <= cam.camDepth * 12; d += 8) {
        const s = scaleAtDepth(cam, d);
        const gap = Math.abs(
          projectFlatX(cam, cam.w / 2 + laneOffset(cam.w, 2), s) -
            projectFlatX(cam, cam.w / 2 + laneOffset(cam.w, 0), s),
        );
        expect(gap).toBeLessThanOrEqual(prev + 1e-9);
        prev = gap;
      }
      // 远到看不见的地方,三条道已经挤成很窄的一条
      expect(prev).toBeLessThan(cam.w * 0.2);
    }
  });

  it("雾随深度单调变浓,近处一点雾都没有", () => {
    const cam = TABLET;
    let prev = 0;
    for (let d = 0; d <= cam.camDepth * 12; d += 8) {
      const a = fogAlpha(scaleAtDepth(cam, d));
      expect(a).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      prev = a;
    }
    expect(fogAlpha(scaleAtDepth(cam, 0))).toBe(0);
    expect(prev).toBeGreaterThan(0);
  });
});

describe("彩虹跑跑 2.5D · 透视投影", () => {
  it("相机的地平线在上三成,玩家线在下方,相机距离按两者之差算", () => {
    for (const [w, h] of [
      [375, 667],
      [1280, 800],
    ]) {
      const cam = makeCamera(w, h);
      expect(cam.horizonY).toBeCloseTo(h * HORIZON_RATIO, 6);
      expect(cam.playerY).toBeCloseTo(h * 0.78, 6);
      expect(cam.playerY).toBeGreaterThan(cam.horizonY);
      expect(cam.camDepth).toBeCloseTo((cam.playerY - cam.horizonY) * CAM_DEPTH_RATIO, 6);
      expect(cam.camDepth).toBeGreaterThan(0);
    }
  });

  it("玩家脚下深度为 0、缩放为 1,投影回来正好落在玩家线上", () => {
    for (const cam of [PHONE, TABLET]) {
      expect(depthOf(cam, cam.playerY)).toBe(0);
      expect(scaleAtDepth(cam, 0)).toBeCloseTo(1, 10);
      expect(screenYAtDepth(cam, 0)).toBeCloseTo(cam.playerY, 10);
      const p = projectTrack(cam, cam.playerY, 1);
      expect(p.scale).toBeCloseTo(1, 10);
      expect(p.y).toBeCloseTo(cam.playerY, 10);
      expect(p.x).toBeCloseTo(cam.w / 2, 10);
    }
  });

  it("越远越小、越靠近地平线,而且永远不会翻到地平线上面去", () => {
    for (const cam of [PHONE, TABLET]) {
      let lastScale = Infinity;
      let lastY = Infinity;
      for (const depth of [0, 100, 250, 600, 1200, 4000, 20000]) {
        const s = scaleAtDepth(cam, depth);
        const y = screenYAtDepth(cam, depth);
        expect(s).toBeLessThan(lastScale);
        expect(y).toBeLessThan(lastY);
        expect(y).toBeGreaterThan(cam.horizonY);
        lastScale = s;
        lastY = y;
      }
    }
  });

  it("身后的东西会放大往画面下方涌,但放大倍率封了顶不会炸开", () => {
    const cam = PHONE;
    const behind = scaleAtDepth(cam, -100);
    expect(behind).toBeGreaterThan(1);
    expect(screenYAtDepth(cam, -100)).toBeGreaterThan(cam.playerY);
    // 深度贴到 -camDepth 时公式会除零,这里必须被 MAX_SCALE 兜住
    expect(scaleAtDepth(cam, -cam.camDepth)).toBe(MAX_SCALE);
    expect(scaleAtDepth(cam, -cam.camDepth * 2)).toBe(MAX_SCALE);
    expect(Number.isFinite(scaleAtDepth(cam, -cam.camDepth))).toBe(true);
  });

  it("三条车道向消失点收敛:远处三道之间的横向间距比近处小", () => {
    const cam = PHONE;
    const nearL = projectTrack(cam, cam.playerY, 0);
    const nearR = projectTrack(cam, cam.playerY, 2);
    const farL = projectTrack(cam, cam.playerY - 1200, 0);
    const farR = projectTrack(cam, cam.playerY - 1200, 2);
    expect(farR.x - farL.x).toBeGreaterThan(0);
    expect(farR.x - farL.x).toBeLessThan((nearR.x - nearL.x) * 0.5);
    // 中间那条道无论多远都在画面正中
    expect(projectTrack(cam, cam.playerY - 3000, 1).x).toBeCloseTo(cam.w / 2, 6);
  });

  it("车道中心与车道分隔线的偏移对得上:第 j 条线夹在第 j-1、j 道中间", () => {
    const w = 375;
    expect(laneOffset(w, 1)).toBeCloseTo(0, 10);
    expect(laneOffset(w, 0)).toBeCloseTo(-laneOffset(w, 2), 10);
    for (let lane = 0; lane < 3; lane++) {
      const left = edgeOffset(w, lane);
      const right = edgeOffset(w, lane + 1);
      expect(laneOffset(w, lane)).toBeCloseTo((left + right) / 2, 6);
      expect(right).toBeGreaterThan(left);
    }
  });

  it("磁铁把糖果拉离车道中心时,投影仍然按同一个缩放收进去", () => {
    const cam = PHONE;
    const scale = scaleAtDepth(cam, 500);
    expect(projectFlatX(cam, cam.w / 2, scale)).toBeCloseTo(cam.w / 2, 10);
    const off = projectFlatX(cam, cam.w / 2 + 100, scale);
    expect(off - cam.w / 2).toBeCloseTo(100 * scale, 6);
  });

  it("障碍从 SPAWN_TRACK_Y 冒出来时已经缩得很小,贴在地平线附近", () => {
    for (const cam of [PHONE, TABLET]) {
      const p = projectTrack(cam, SPAWN_TRACK_Y, 1);
      expect(p.scale).toBeLessThan(0.45);
      expect(p.y).toBeGreaterThan(cam.horizonY);
      expect(p.y).toBeLessThan(cam.horizonY + (cam.playerY - cam.horizonY) * 0.5);
    }
  });
});

describe("彩虹跑跑 2.5D · 地面网格与雾", () => {
  it("网格线等距铺开,全部落在 (0, maxDepth] 里,而且由近到远排好", () => {
    const lines = groundGridDepths(0, 150, 1200);
    expect(lines.length).toBeGreaterThan(4);
    for (const d of lines) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(1200);
    }
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i] - lines[i - 1]).toBeCloseTo(150, 6);
    }
  });

  it("跑起来网格线朝观察者涌,跑满一格之后回到原位(不会突然跳一下)", () => {
    const a = groundGridDepths(0, 150, 900);
    const mid = groundGridDepths(60, 150, 900);
    const wrapped = groundGridDepths(150, 150, 900);
    expect(mid[0]).toBeLessThan(a[0]);
    expect(wrapped[0]).toBeCloseTo(a[0], 6);
    // 负的 scroll(倒着算)也不会算出负深度
    for (const d of groundGridDepths(-37, 150, 900)) expect(d).toBeGreaterThan(0);
  });

  it("间距或视距为 0 时不画线,也不会死循环", () => {
    expect(groundGridDepths(10, 0, 900)).toEqual([]);
    expect(groundGridDepths(10, 150, 0)).toEqual([]);
    expect(groundGridDepths(10, -150, 900)).toEqual([]);
  });

  it("雾从中景开始起效,越远越浓,近处一点雾都没有", () => {
    expect(fogAlpha(1)).toBe(0);
    expect(fogAlpha(0.8)).toBe(0);
    expect(fogAlpha(0.55)).toBe(0);
    const mid = fogAlpha(0.3);
    const far = fogAlpha(0.1);
    expect(mid).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(mid);
    expect(far).toBeLessThanOrEqual(0.82);
    expect(fogAlpha(0)).toBeCloseTo(0.82, 6);
  });

  it("三层远景视差层由远到近,速度依次变快、透明度依次变高", () => {
    expect(PARALLAX_LAYERS.length).toBe(3);
    for (let i = 1; i < PARALLAX_LAYERS.length; i++) {
      expect(PARALLAX_LAYERS[i].factor).toBeGreaterThan(PARALLAX_LAYERS[i - 1].factor);
      expect(PARALLAX_LAYERS[i].alpha).toBeGreaterThan(PARALLAX_LAYERS[i - 1].alpha);
      expect(PARALLAX_LAYERS[i].height).toBeLessThan(PARALLAX_LAYERS[i - 1].height);
    }
  });

  it("视差层的横移永远落在一个循环单元里,平铺时不会露缝", () => {
    for (const scroll of [0, 137, 4021, -580]) {
      for (const layer of PARALLAX_LAYERS) {
        const span = layer.span * 375;
        const shift = parallaxShift(scroll, layer.factor, span);
        expect(shift).toBeGreaterThanOrEqual(0);
        expect(shift).toBeLessThan(span);
      }
    }
    expect(parallaxShift(100, 0.1, 0)).toBe(0);
  });
});

describe("彩虹跑跑 2.5D · 帧率自适应", () => {
  it("三档画质越往后越省:视差层数、粒子倍率、网格密度一路降下来", () => {
    expect(QUALITY_TIERS.length).toBe(3);
    for (let i = 1; i < QUALITY_TIERS.length; i++) {
      expect(QUALITY_TIERS[i].parallax).toBeLessThan(QUALITY_TIERS[i - 1].parallax);
      expect(QUALITY_TIERS[i].particles).toBeLessThan(QUALITY_TIERS[i - 1].particles);
      expect(QUALITY_TIERS[i].gridSpacing).toBeGreaterThan(QUALITY_TIERS[i - 1].gridSpacing);
    }
    expect(QUALITY_TIERS[0].parallax).toBe(PARALLAX_LAYERS.length);
  });

  it("帧率是平滑出来的:偶尔卡一帧不会把画质立刻砍掉", () => {
    let fps = 60;
    fps = smoothFps(fps, 0.25); // 卡了一帧
    expect(fps).toBeGreaterThan(55);
    expect(nextQualityTier(0, fps)).toBe(0);
    // 一直 15fps 才会真的掉下来
    for (let i = 0; i < 120; i++) fps = smoothFps(fps, 1 / 15);
    expect(fps).toBeLessThan(FPS_DOWNGRADE);
    expect(smoothFps(60, 0)).toBe(60);
    expect(smoothFps(60, -1)).toBe(60);
  });

  it("低端机掉帧就降档,帧率回来才升档,而且两个阈值之间留了迟滞", () => {
    expect(FPS_UPGRADE).toBeGreaterThan(FPS_DOWNGRADE);
    expect(nextQualityTier(0, 30)).toBe(1);
    expect(nextQualityTier(1, 30)).toBe(2);
    expect(nextQualityTier(2, 30)).toBe(2); // 最省的一档,不会再往下掉
    expect(nextQualityTier(2, 60)).toBe(1);
    expect(nextQualityTier(0, 60)).toBe(0);
    // 50fps 落在两个阈值中间:既不降也不升
    expect(nextQualityTier(1, 50)).toBe(1);
  });

  it("降档之后粒子会变少,但至少留一颗,反馈不会整个消失", () => {
    expect(particleCount(8, 0)).toBe(8);
    expect(particleCount(8, 1)).toBeLessThan(8);
    expect(particleCount(8, 2)).toBeLessThan(particleCount(8, 1));
    expect(particleCount(1, 2)).toBeGreaterThanOrEqual(1);
    expect(particleCount(8, 99)).toBeGreaterThanOrEqual(1);
  });
});

describe("彩虹跑跑 2.5D · delta time 手感一致", () => {
  it("单帧时长封顶,切后台回来不会瞬移一大截", () => {
    expect(clampDt(16.7)).toBeCloseTo(0.0167, 5);
    expect(clampDt(5000)).toBe(MAX_DT);
    expect(clampDt(0)).toBe(0);
    expect(clampDt(Number.NaN)).toBe(0);
  });

  it("60fps 走两帧和 30fps 走一帧落到同一个位置(不按帧步进)", () => {
    const rate = 10;
    const dt30 = 1 / 30;
    const once = smoothing(dt30, rate);
    const twice = 1 - (1 - smoothing(dt30 / 2, rate)) * (1 - smoothing(dt30 / 2, rate));
    expect(twice).toBeCloseTo(once, 12);

    // 拿真正的换道插值走一遍:两种帧率跑同样的时间,落点几乎一样
    const run = (dt: number, steps: number): number => {
      let v = 0;
      for (let i = 0; i < steps; i++) v += (1 - v) * smoothing(dt, rate);
      return v;
    };
    expect(run(1 / 60, 60)).toBeCloseTo(run(1 / 30, 30), 10);
  });

  it("dt 或速率不合法时不动,免得算出 NaN 把画面弄没", () => {
    expect(smoothing(0, 10)).toBe(0);
    expect(smoothing(-1, 10)).toBe(0);
    expect(smoothing(0.1, 0)).toBe(0);
    expect(smoothing(0.1, 10)).toBeGreaterThan(0);
    expect(smoothing(0.1, 10)).toBeLessThan(1);
  });
});

describe("彩虹跑跑 2.5D · 配色小工具", () => {
  it("两色混合两端取原色,中间取中间值", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    // 超出 0..1 会被夹住,不会算出越界颜色
    expect(mixHex("#000000", "#ffffff", 5)).toBe("#ffffff");
    expect(mixHex("#000000", "#ffffff", -5)).toBe("#000000");
  });

  it("三位缩写色和带透明度的写法都认得", () => {
    expect(mixHex("#fff", "#fff", 0.3)).toBe("#ffffff");
    expect(withAlpha("#ff0000", 0.5)).toBe("rgba(255,0,0,0.5)");
    expect(withAlpha("#00ff00", 5)).toBe("rgba(0,255,0,1)");
    expect(withAlpha("#0000ff", -1)).toBe("rgba(0,0,255,0)");
  });
});
