import { describe, expect, it } from "vitest";
import {
  COLORS,
  COLOR_HEX,
  KINDS,
  NEIGHBOR_N,
  SCENE_H,
  SCENE_W,
  ZONES,
  clueHolds,
  clueText,
  deduceStars,
  dist,
  endlessLine,
  endlessSeconds,
  endlessSpotCount,
  endlessTargetCount,
  findStars,
  formatClock,
  hitSpot,
  isTop,
  missPenalty,
  nearestSpots,
  solveDeduction,
  spotName,
  toSceneXY,
  versusLine,
  versusWinner,
  zoneOf,
  type Clue,
  type Spot,
} from "./logic";

function spot(x: number, y: number, extra: Partial<Spot> = {}): Spot {
  return { x, y, r: 46, kind: "树洞", color: "粉", big: false, ...extra };
}

describe("寻找外星朋友 · 场景常量", () => {
  it("场景是横着的一张图,颜色和种类都够用", () => {
    expect(SCENE_W).toBeGreaterThan(SCENE_H);
    expect(COLORS.length).toBeGreaterThanOrEqual(6);
    expect(KINDS.length).toBeGreaterThanOrEqual(8);
    expect(ZONES).toEqual(["左", "中", "右"]);
  });

  it("每种颜色都有一个粉彩色号", () => {
    for (const c of COLORS) expect(COLOR_HEX[c]).toMatch(/^#[0-9a-f]{6}$/i);
    expect(new Set(Object.values(COLOR_HEX)).size).toBe(COLORS.length);
  });
});

describe("寻找外星朋友 · 位置工具", () => {
  it("zoneOf 把场景横着切成三片", () => {
    expect(zoneOf(0)).toBe("左");
    expect(zoneOf(SCENE_W / 3 - 1)).toBe("左");
    expect(zoneOf(SCENE_W / 3)).toBe("中");
    expect(zoneOf(SCENE_W / 2)).toBe("中");
    expect(zoneOf((SCENE_W * 2) / 3)).toBe("右");
    expect(zoneOf(SCENE_W)).toBe("右");
  });

  it("isTop 以画面中线为界", () => {
    expect(isTop(0)).toBe(true);
    expect(isTop(SCENE_H / 2 - 1)).toBe(true);
    expect(isTop(SCENE_H / 2)).toBe(false);
    expect(isTop(SCENE_H)).toBe(false);
  });

  it("dist 就是普通的两点距离", () => {
    expect(dist(0, 0, 3, 4)).toBe(5);
    expect(dist(10, 10, 10, 10)).toBe(0);
  });

  it("spotName 是「颜色 + 种类」,读起来像句人话", () => {
    expect(spotName(spot(0, 0, { color: "蓝", kind: "木箱" }))).toBe("蓝色的木箱");
  });

  it("nearestSpots 按距离排,不把自己算进去", () => {
    const spots = [spot(0, 0), spot(10, 0), spot(100, 0), spot(30, 0)];
    expect(nearestSpots(spots, 0, 2)).toEqual([1, 3]);
    expect(nearestSpots(spots, 0, 2)).not.toContain(0);
    expect(nearestSpots(spots, 0, 99).length).toBe(3);
    expect(nearestSpots(spots, 0, 0)).toEqual([]);
  });

  it("距离一样时按下标先后排,结果稳定", () => {
    const spots = [spot(50, 0), spot(0, 0), spot(100, 0)];
    expect(nearestSpots(spots, 0, 2)).toEqual([1, 2]);
  });
});

describe("寻找外星朋友 · 线索判定", () => {
  const spots: Spot[] = [
    spot(100, 100, { color: "粉", kind: "树洞", big: false }),
    spot(500, 500, { color: "蓝", kind: "木箱", big: true, r: 62 }),
    spot(900, 100, { color: "黄", kind: "花丛", big: false }),
    spot(520, 120, { color: "绿", kind: "水缸", big: true, r: 62 }),
  ];

  it("颜色线索:是 / 不是", () => {
    expect(clueHolds({ kind: "isColor", color: "粉" }, spots, 0)).toBe(true);
    expect(clueHolds({ kind: "isColor", color: "蓝" }, spots, 0)).toBe(false);
    expect(clueHolds({ kind: "notColor", color: "蓝" }, spots, 0)).toBe(true);
    expect(clueHolds({ kind: "notColor", color: "粉" }, spots, 0)).toBe(false);
  });

  it("种类线索:是 / 不是", () => {
    expect(clueHolds({ kind: "isKind", spot: "木箱" }, spots, 1)).toBe(true);
    expect(clueHolds({ kind: "notKind", spot: "木箱" }, spots, 1)).toBe(false);
    expect(clueHolds({ kind: "notKind", spot: "树洞" }, spots, 1)).toBe(true);
  });

  it("区域线索:左中右", () => {
    expect(clueHolds({ kind: "zone", zone: "左" }, spots, 0)).toBe(true);
    expect(clueHolds({ kind: "zone", zone: "右" }, spots, 2)).toBe(true);
    expect(clueHolds({ kind: "notZone", zone: "左" }, spots, 2)).toBe(true);
    expect(clueHolds({ kind: "notZone", zone: "右" }, spots, 2)).toBe(false);
  });

  it("上下与大小线索", () => {
    expect(clueHolds({ kind: "row", top: true }, spots, 0)).toBe(true);
    expect(clueHolds({ kind: "row", top: true }, spots, 1)).toBe(false);
    expect(clueHolds({ kind: "size", big: true }, spots, 1)).toBe(true);
    expect(clueHolds({ kind: "size", big: false }, spots, 1)).toBe(false);
  });

  it("左右比较线索,不会拿参照物跟自己比", () => {
    expect(clueHolds({ kind: "leftOf", ref: 2 }, spots, 0)).toBe(true);
    expect(clueHolds({ kind: "leftOf", ref: 2 }, spots, 2)).toBe(false);
    expect(clueHolds({ kind: "rightOf", ref: 0 }, spots, 2)).toBe(true);
    expect(clueHolds({ kind: "rightOf", ref: 0 }, spots, 0)).toBe(false);
  });

  it("挨着谁的线索只认最近的两个", () => {
    expect(NEIGHBOR_N).toBe(2);
    expect(clueHolds({ kind: "neighbor", ref: 3 }, spots, 1)).toBe(true);
    expect(clueHolds({ kind: "neighbor", ref: 3 }, spots, 3)).toBe(false);
  });

  it("参照物不存在时线索一律不成立,不会崩", () => {
    expect(clueHolds({ kind: "leftOf", ref: 99 }, spots, 0)).toBe(false);
    expect(clueHolds({ kind: "rightOf", ref: 99 }, spots, 0)).toBe(false);
    expect(clueHolds({ kind: "isColor", color: "粉" }, spots, 99)).toBe(false);
  });

  it("solveDeduction 列出所有同时满足的点", () => {
    expect(solveDeduction(spots, [])).toEqual([0, 1, 2, 3]);
    expect(solveDeduction(spots, [{ kind: "row", top: true }])).toEqual([0, 2, 3]);
    const two: Clue[] = [
      { kind: "row", top: true },
      { kind: "size", big: true },
    ];
    expect(solveDeduction(spots, two)).toEqual([3]);
  });

  it("每种线索都能翻译成一句完整的中文", () => {
    const all: Clue[] = [
      { kind: "isColor", color: "粉" },
      { kind: "notColor", color: "蓝" },
      { kind: "isKind", spot: "树洞" },
      { kind: "notKind", spot: "木箱" },
      { kind: "zone", zone: "左" },
      { kind: "zone", zone: "中" },
      { kind: "notZone", zone: "右" },
      { kind: "notZone", zone: "中" },
      { kind: "row", top: true },
      { kind: "row", top: false },
      { kind: "size", big: true },
      { kind: "size", big: false },
      { kind: "leftOf", ref: 1 },
      { kind: "rightOf", ref: 1 },
      { kind: "neighbor", ref: 1 },
    ];
    for (const c of all) {
      const text = clueText(c, spots);
      expect(text.endsWith("。")).toBe(true);
      expect(text.includes("undefined")).toBe(false);
      expect(text.length).toBeGreaterThan(5);
    }
    expect(clueText({ kind: "leftOf", ref: 1 }, spots)).toContain("蓝色的木箱");
  });
});

describe("寻找外星朋友 · 点击判定", () => {
  const spots = [spot(100, 100), spot(300, 100, { r: 62 })];

  it("点在圈里算命中,点在外面不算", () => {
    expect(hitSpot(spots, 100, 100)).toBe(0);
    expect(hitSpot(spots, 100 + 45, 100)).toBe(0);
    expect(hitSpot(spots, 100 + 60, 100)).toBe(-1);
    expect(hitSpot(spots, 300, 100)).toBe(1);
    expect(hitSpot(spots, 0, 0)).toBe(-1);
  });

  it("两个圈重叠时取圆心更近的那个", () => {
    const pair = [spot(100, 100, { r: 80 }), spot(140, 100, { r: 80 })];
    expect(hitSpot(pair, 135, 100)).toBe(1);
    expect(hitSpot(pair, 105, 100)).toBe(0);
  });

  it("toSceneXY 把屏幕坐标换算回场景坐标", () => {
    const rect = { left: 0, top: 0, width: SCENE_W, height: SCENE_H };
    expect(toSceneXY(0, 0, rect)).toEqual({ x: 0, y: 0 });
    expect(toSceneXY(500, 320, rect)).toEqual({ x: 500, y: 320 });
  });

  it("画布被等比缩小、上下留白时也换算得准", () => {
    const rect = { left: 10, top: 20, width: SCENE_W / 2, height: SCENE_H };
    // 宽度只有一半 → scale=0.5,高度多出来的部分平分成上下留白
    const pad = (SCENE_H - SCENE_H * 0.5) / 2;
    const p = toSceneXY(10 + 250, 20 + pad + 160, rect);
    expect(Math.round(p.x)).toBe(500);
    expect(Math.round(p.y)).toBe(320);
  });
});

describe("寻找外星朋友 · 计分与计时", () => {
  it("找物关:又快又准才给三星", () => {
    expect(findStars(30, 40, 0)).toBe(3);
    expect(findStars(30, 40, 1)).toBe(2);
    expect(findStars(12, 40, 0)).toBe(2);
    expect(findStars(12, 40, 3)).toBe(1);
    expect(findStars(0, 40, 0)).toBe(1);
  });

  it("推理关:一次选对三星,错一次两星", () => {
    expect(deduceStars(0, 20)).toBe(3);
    expect(deduceStars(1, 20)).toBe(2);
    expect(deduceStars(2, 20)).toBe(1);
    expect(deduceStars(0, 0)).toBe(2);
  });

  it("点错的时间惩罚随章节变重,但有上限", () => {
    expect(missPenalty(0)).toBe(2);
    expect(missPenalty(7)).toBe(5);
    expect(missPenalty(99)).toBe(6);
    for (let ci = 0; ci < 20; ci++) expect(missPenalty(ci)).toBeLessThanOrEqual(6);
  });

  it("formatClock 写成分:秒", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(7)).toBe("0:07");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(-3)).toBe("0:00");
    expect(formatClock(6.2)).toBe("0:07");
  });
});

describe("寻找外星朋友 · 双人对战与无尽", () => {
  it("对战按找到的个数判胜负", () => {
    expect(versusWinner(3, 1)).toBe("朵朵");
    expect(versusWinner(1, 3)).toBe("星星");
    expect(versusWinner(2, 2)).toBe("平局");
  });

  it("对战播报里带着比分,而且只出现本作角色名", () => {
    expect(versusLine(3, 1)).toContain("朵朵");
    expect(versusLine(3, 1)).toContain("3 比 1");
    expect(versusLine(1, 4)).toContain("星星");
    expect(versusLine(2, 2)).toContain("平手");
  });

  it("无尽越往后时间越短、点越多、目标越多,而且都有上下限", () => {
    expect(endlessSeconds(1)).toBeGreaterThan(endlessSeconds(10));
    expect(endlessSeconds(999)).toBeGreaterThanOrEqual(14);
    expect(endlessSpotCount(1)).toBeLessThan(endlessSpotCount(10));
    expect(endlessSpotCount(999)).toBeLessThanOrEqual(16);
    expect(endlessTargetCount(1)).toBeLessThanOrEqual(endlessTargetCount(20));
    expect(endlessTargetCount(999)).toBeLessThanOrEqual(8);
  });

  it("无尽播报会认新纪录", () => {
    expect(endlessLine(9, 5)).toContain("新纪录");
    expect(endlessLine(3, 8)).toContain("第 8 轮");
  });
});
