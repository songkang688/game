// 寻找外星朋友 · 1.2 手感层单测:点击容错、摆放校验、缩放换算、望远镜提示。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { SCENE_H, SCENE_W, endlessSeconds, versusLine, versusWinner, type Spot } from "./logic";
import { LEVELS, buildEndlessRound, buildVersusRound, layoutSpots } from "./levels";
import { levelIsBeatable } from "./sim";
import {
  DEFAULT_VIEW,
  EMPTY_CLICK_PENALTY,
  HINTS_PER_LEVEL,
  HIT_TOLERANCE_PX,
  MAX_ZOOM,
  MIN_TARGET_PX,
  MIN_ZOOM,
  PHONE_WIDTH,
  PLAY_AREA,
  canUseHint,
  checklistItems,
  checklistLabel,
  circleRectArea,
  clampView,
  clampZoom,
  emptyClickTip,
  hintText,
  hintsLeft,
  layoutIsValid,
  layoutIssues,
  panView,
  pickNearestSpot,
  pinchZoom,
  sceneToScreen,
  screenDiameter,
  screenToScene,
  starsAfterHints,
  telescopeRegion,
  telescopeView,
  toleranceInScene,
  viewScale,
  visibleFraction,
  zoomAt,
  type Viewport,
} from "./seek12";

function spot(x: number, y: number, r = 40): Spot {
  return { x, y, r, kind: "木箱", color: "蓝", big: false };
}

/** 手机上一屏:360 宽,场景比例 1000×640 */
const PHONE: Viewport = { left: 0, top: 0, width: 360, height: 360 * (SCENE_H / SCENE_W) };

describe("alien-seek 1.2 · 点击容错", () => {
  it("点在圆里当然算命中", () => {
    const spots = [spot(200, 200)];
    expect(pickNearestSpot(spots, 210, 205, 0)).toBe(0);
  });

  it("圆外 44px 以内的点击也算命中", () => {
    const spots = [spot(200, 200, 40)];
    expect(pickNearestSpot(spots, 200 + 40 + 30, 200, HIT_TOLERANCE_PX)).toBe(0);
    expect(pickNearestSpot(spots, 200 + 40 + 43, 200, HIT_TOLERANCE_PX)).toBe(0);
  });

  it("超出容错范围就不算命中", () => {
    const spots = [spot(200, 200, 40)];
    expect(pickNearestSpot(spots, 200 + 40 + 46, 200, HIT_TOLERANCE_PX)).toBe(-1);
  });

  it("两个目标都在容错圈里时取圆心最近的那个", () => {
    const spots = [spot(200, 200, 30), spot(260, 200, 30)];
    expect(pickNearestSpot(spots, 245, 200, HIT_TOLERANCE_PX)).toBe(1);
    expect(pickNearestSpot(spots, 215, 200, HIT_TOLERANCE_PX)).toBe(0);
  });

  it("距离一模一样时永远取下标小的那个,同一次点击不会给两种答案", () => {
    const spots = [spot(200, 200, 30), spot(300, 200, 30)];
    expect(pickNearestSpot(spots, 250, 200, HIT_TOLERANCE_PX)).toBe(0);
  });

  it("容错半径按画面倍率换算成场景单位:画得越小放得越宽", () => {
    expect(toleranceInScene(1)).toBeCloseTo(HIT_TOLERANCE_PX, 6);
    expect(toleranceInScene(0.36)).toBeCloseTo(HIT_TOLERANCE_PX / 0.36, 6);
    expect(toleranceInScene(0)).toBeCloseTo(HIT_TOLERANCE_PX, 6);
  });

  it("点空 3 次给一句温和提示,前两次不打扰,而且一颗星都不扣", () => {
    expect(emptyClickTip(1)).toBeNull();
    expect(emptyClickTip(2)).toBeNull();
    expect(emptyClickTip(3)).toBeTruthy();
    expect(emptyClickTip(4)).toBeNull();
    expect(emptyClickTip(6)).toBeTruthy();
    expect(emptyClickTip(6)).not.toBe(emptyClickTip(3));
    expect(EMPTY_CLICK_PENALTY).toBe(0);
  });

  it("提示是鼓励口吻,不批评小朋友", () => {
    for (const n of [3, 6, 9, 12]) {
      const tip = emptyClickTip(n) ?? "";
      expect(tip.length).toBeGreaterThan(0);
      expect(/笨|不行|错|差劲/.test(tip)).toBe(false);
    }
  });
});

describe("alien-seek 1.2 · 摆放校验", () => {
  it("圆整个装在矩形里时交面积就是整个圆", () => {
    expect(circleRectArea(100, 100, 20, { left: 0, top: 0, right: 200, bottom: 200 })).toBeCloseTo(
      Math.PI * 400,
      4
    );
  });

  it("矩形切掉一半时交面积正好是半个圆", () => {
    expect(circleRectArea(100, 100, 20, { left: 100, top: 0, right: 200, bottom: 200 })).toBeCloseTo(
      (Math.PI * 400) / 2,
      4
    );
  });

  it("圆完全在矩形外时交面积是 0", () => {
    expect(circleRectArea(500, 500, 20, { left: 0, top: 0, right: 100, bottom: 100 })).toBe(0);
  });

  it("可见比例:压在顶栏下的藏身点会被判不合格", () => {
    const good = spot(500, 320, 40);
    const buried = spot(500, 10, 40);
    expect(visibleFraction(good)).toBeCloseTo(1, 6);
    expect(visibleFraction(buried)).toBeLessThan(0.7);
    expect(layoutIssues([buried]).some((s) => s.includes("挡住"))).toBe(true);
  });

  it("两个挨太近的藏身点会被点名", () => {
    const a = spot(300, 300, 40);
    const b = spot(340, 300, 40);
    expect(layoutIsValid([a, b])).toBe(false);
    expect(layoutIssues([a, b]).some((s) => s.includes("挨得太近"))).toBe(true);
  });

  it("随机 1000 张布局全部通过摆放校验", () => {
    let checked = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const rand = mulberry32(seed * 7919);
      const count = 4 + (seed % 13);
      const spots = layoutSpots(rand, count);
      const issues = layoutIssues(spots);
      expect(issues, `种子 ${seed} 的布局有毛病: ${issues.join(" / ")}`).toEqual([]);
      checked++;
    }
    expect(checked).toBe(1000);
  });

  it("188 关正式关卡的布局也全部通过校验", () => {
    for (const lv of LEVELS) {
      expect(layoutIssues(lv.spots), `第 ${lv.index + 1} 关布局不合格`).toEqual([]);
    }
  });

  it("无尽轮与对战场的布局同样合格", () => {
    for (let r = 1; r <= 30; r++) {
      expect(layoutIssues(buildEndlessRound(r).spots)).toEqual([]);
      expect(layoutIssues(buildVersusRound(r).spots)).toEqual([]);
    }
  });

  it("360px 手机上目标直径不小于 24px,难度不靠画小", () => {
    for (const lv of LEVELS) {
      for (const s of lv.spots) {
        expect(screenDiameter(s, PHONE_WIDTH)).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      }
    }
  });

  it("可玩区把顶栏和时间条都让开了", () => {
    expect(PLAY_AREA.top).toBeGreaterThan(0);
    expect(PLAY_AREA.bottom).toBeLessThan(SCENE_H);
    expect(PLAY_AREA.right).toBeLessThanOrEqual(SCENE_W);
  });
});

describe("alien-seek 1.2 · 缩放与拖动", () => {
  it("倍率夹在 0.8 到 2.5 之间", () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
    expect(clampZoom(1.6)).toBeCloseTo(1.6, 6);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("场景坐标和屏幕坐标互为反函数", () => {
    const view = clampView({ zoom: 1.8, cx: 400, cy: 300 }, PHONE);
    const screen = sceneToScreen(420, 260, PHONE, view);
    const back = screenToScene(screen.x, screen.y, PHONE, view);
    expect(back.x).toBeCloseTo(420, 6);
    expect(back.y).toBeCloseTo(260, 6);
  });

  it("放大之后点击仍然按世界坐标判定,点到的是同一个藏身点", () => {
    const spots = [spot(300, 300, 40), spot(700, 400, 40)];
    const view = clampView({ zoom: 2.5, cx: 700, cy: 400 }, PHONE);
    const screen = sceneToScreen(705, 402, PHONE, view);
    const scene = screenToScene(screen.x, screen.y, PHONE, view);
    const tol = toleranceInScene(viewScale(PHONE, view.zoom));
    expect(pickNearestSpot(spots, scene.x, scene.y, tol)).toBe(1);
  });

  it("放大后屏幕上的 44px 容错换算回场景会变小,不会误点隔壁", () => {
    const near = toleranceInScene(viewScale(PHONE, 2.5));
    const far = toleranceInScene(viewScale(PHONE, 0.8));
    expect(near).toBeLessThan(far);
  });

  it("以锚点缩放时,锚点在屏幕上原地不动", () => {
    const view = clampView({ ...DEFAULT_VIEW, zoom: 1 }, PHONE);
    const before = sceneToScreen(300, 200, PHONE, view);
    const zoomed = zoomAt(view, 2, 300, 200, PHONE);
    const after = sceneToScreen(300, 200, PHONE, zoomed);
    expect(zoomed.zoom).toBeCloseTo(2, 6);
    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
  });

  it("拖到边上会被拉住,不会把场景外的空白拖进画面正中", () => {
    const view = clampView({ zoom: 2, cx: 500, cy: 320 }, PHONE);
    const dragged = panView(view, 5000, 5000, PHONE);
    const s = viewScale(PHONE, dragged.zoom);
    expect(dragged.cx).toBeLessThanOrEqual(SCENE_W - PHONE.width / 2 / s + 1e-6);
    expect(dragged.cy).toBeLessThanOrEqual(SCENE_H - PHONE.height / 2 / s + 1e-6);
  });

  it("缩到 1 倍以下时镜头回到场景正中", () => {
    const view = clampView({ zoom: 0.8, cx: 10, cy: 10 }, PHONE);
    expect(view.cx).toBeCloseTo(SCENE_W / 2, 6);
    expect(view.cy).toBeCloseTo(SCENE_H / 2, 6);
  });

  it("双指缩放按两指间距的比例算,而且照样夹在合法区间", () => {
    expect(pinchZoom(1, 100, 200)).toBeCloseTo(2, 6);
    expect(pinchZoom(1, 100, 50)).toBe(MIN_ZOOM);
    expect(pinchZoom(2, 100, 1000)).toBe(MAX_ZOOM);
    expect(pinchZoom(1.5, 0, 100)).toBeCloseTo(1.5, 6);
  });
});

describe("alien-seek 1.2 · 望远镜提示", () => {
  it("场景切成 3×2,目标在哪一片就返回哪一片", () => {
    expect(telescopeRegion(100, 100).col).toBe(0);
    expect(telescopeRegion(500, 100).col).toBe(1);
    expect(telescopeRegion(900, 500).col).toBe(2);
    expect(telescopeRegion(900, 500).row).toBe(1);
    expect(telescopeRegion(999, 639).label).toContain("右边");
  });

  it("望远镜只缩范围,提示语里不点名目标本体", () => {
    const region = telescopeRegion(700, 500);
    const text = hintText(region);
    expect(text).toContain(region.label);
    expect(text).not.toContain("木箱");
    expect(text).not.toContain("蓝色");
  });

  it("望远镜镜头能把目标那一片框进画面,倍率不越界", () => {
    const region = telescopeRegion(820, 520);
    const view = telescopeView(region, PHONE);
    expect(view.zoom).toBeGreaterThan(1);
    expect(view.zoom).toBeLessThanOrEqual(MAX_ZOOM);
    const screen = sceneToScreen(820, 520, PHONE, view);
    expect(screen.x).toBeGreaterThanOrEqual(0);
    expect(screen.x).toBeLessThanOrEqual(PHONE.width);
    expect(screen.y).toBeGreaterThanOrEqual(0);
    expect(screen.y).toBeLessThanOrEqual(PHONE.height);
  });

  it("每关只有 2 次望远镜", () => {
    expect(HINTS_PER_LEVEL).toBe(2);
    expect(hintsLeft(0)).toBe(2);
    expect(canUseHint(1)).toBe(true);
    expect(hintsLeft(2)).toBe(0);
    expect(canUseHint(2)).toBe(false);
    expect(hintsLeft(5)).toBe(0);
  });

  it("用过望远镜就封顶两星,没用过照给三星", () => {
    expect(starsAfterHints(3, 0)).toBe(3);
    expect(starsAfterHints(3, 1)).toBe(2);
    expect(starsAfterHints(2, 2)).toBe(2);
    expect(starsAfterHints(1, 2)).toBe(1);
  });
});

describe("alien-seek 1.2 · 清单栏与模式", () => {
  it("清单栏按目标出条目,找到过的打勾", () => {
    const targets = [
      { spot: 2, role: "alien" as const, name: "糯糯" },
      { spot: 5, role: "clue" as const, name: "小铃铛" },
    ];
    const items = checklistItems(targets, new Map([[2, 0]]));
    expect(items).toHaveLength(2);
    expect(items[0].found).toBe(true);
    expect(items[1].found).toBe(false);
    expect(checklistLabel(items[0])).toContain("已找到");
    expect(checklistLabel(items[1])).toContain("还没找到");
  });

  it("双人抢答的比分不会串台", () => {
    expect(versusWinner(4, 2)).toBe("鸭梨");
    expect(versusWinner(1, 3)).toBe("康康");
    expect(versusWinner(2, 2)).toBe("平局");
    expect(versusLine(4, 2)).toContain("鸭梨");
    expect(versusLine(2, 2)).toContain("平手");
  });

  it("无尽限时越来越短但有下限,不会掉到 0", () => {
    let prev = Infinity;
    for (let r = 1; r <= 40; r++) {
      const s = endlessSeconds(r);
      expect(s).toBeGreaterThanOrEqual(14);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });

  it("188 关抽样(含 1 / 100 / 145 / 188)按最慢玩法都来得及", () => {
    for (const n of [1, 40, 100, 145, 188]) {
      expect(levelIsBeatable(LEVELS[n - 1]), `第 ${n} 关限时不够`).toBe(true);
    }
  });

  it("destroy 里把 rAF 和三类监听都收干净了", () => {
    const src = readFileSync("src/games/alien-seek/index.ts", "utf8");
    expect(src).toContain("cancelAnimationFrame");
    expect(src).toContain('removeEventListener("keydown"');
    expect(src).toContain('removeEventListener("keyup"');
    expect(src).toContain('removeEventListener("pointerdown"');
    expect(src).toContain('removeEventListener("pointermove"');
    expect(src).toContain('removeEventListener("pointerup"');
  });
});
