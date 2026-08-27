// bubble-aim · 1.3 视觉升级单测(第九节 12 条规格逐条钉死):
// token / 薄膜阈值 / 瞄准点串与物理逐点一致 / 点径映射 / 炮管只读角度 /
// 换弹 150ms / 特殊泡三分支 / 石泡两态只读 / 色觉标记层级 / reduced / 时序表。
// 只断言视觉与「状态没被写」,不断言任何玩法数值。
import { describe, expect, it } from "vitest";
import { hexToRgb } from "../../art/kit/palette";
import { FILM_MIN_RADIUS, filmColor } from "../../art/kit/film";
import { STONE, STONE_CRACKED, parseLayout, simulateShot } from "./logic";
import { SHOOTER_X, SHOOTER_Y, aimVector, previewPath, swapLoader } from "./aim12";
import {
  AIM_DOT_SPACING,
  BA_COLORS,
  BA_LAYERS,
  BA_TIMINGS,
  aimDotRadius,
  aimDots,
  barrelAngle,
  bounceOffset,
  bounceStars,
  floatPopScale,
  fuseSparkPhase,
  isSquashy,
  paintBombCat,
  paintBubble,
  paintRainbowOrb,
  paintStoneRock,
  rainbowSpinAngle,
  stoneCracked,
  swapPositions,
  swapProgress,
  trailFrames,
  vineShadowAlpha,
  type PaintCtx,
} from "./visual";

/** 记录桩:把每一笔(含样式赋值与渐变色标)按顺序记下来 */
function recorder(): { ctx: PaintCtx; ops: string[] } {
  const ops: string[] = [];
  const gradient = (): CanvasGradient =>
    ({ addColorStop: (_o: number, c: string) => void ops.push(`stop=${c}`) }) as unknown as CanvasGradient;
  let fillStyle: PaintCtx["fillStyle"] = "";
  let strokeStyle: PaintCtx["strokeStyle"] = "";
  const ctx: PaintCtx = {
    globalAlpha: 1,
    lineWidth: 1,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v) {
      fillStyle = v;
      ops.push(typeof v === "string" ? `fillStyle=${v}` : "fillStyle=[grad]");
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(v) {
      strokeStyle = v;
      ops.push(typeof v === "string" ? `strokeStyle=${v}` : "strokeStyle=[grad]");
    },
    save: () => void ops.push("save"),
    restore: () => void ops.push("restore"),
    beginPath: () => void ops.push("beginPath"),
    closePath: () => void ops.push("closePath"),
    arc: (x, y, r) => void ops.push(`arc(${x.toFixed(1)},${y.toFixed(1)},${r.toFixed(1)})`),
    ellipse: (x, y) => void ops.push(`ellipse(${x.toFixed(1)},${y.toFixed(1)})`),
    moveTo: (x, y) => void ops.push(`moveTo(${x.toFixed(1)},${y.toFixed(1)})`),
    lineTo: (x, y) => void ops.push(`lineTo(${x.toFixed(1)},${y.toFixed(1)})`),
    fill: () => void ops.push("fill"),
    stroke: () => void ops.push("stroke"),
    fillRect: () => void ops.push("fillRect"),
    translate: (x, y) => void ops.push(`translate(${x.toFixed(1)},${y.toFixed(1)})`),
    rotate: (a) => void ops.push(`rotate(${a.toFixed(4)})`),
    createRadialGradient: () => gradient(),
    createLinearGradient: () => gradient(),
  };
  return { ctx, ops };
}

/** 点到线段的最短距离(钉「点串在物理折线上」用) */
function distToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}

function distToPath(p: { x: number; y: number }, path: ReadonlyArray<{ x: number; y: number }>): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, distToSegment(p, path[i - 1], path[i]));
  return best;
}

describe("1. 配色板:token 与四·补一规格表一致且色值合法", () => {
  it("八个 token 一个不差;十六进制全部可解析;落影是规格的 rgba", () => {
    expect(BA_COLORS).toEqual({
      baBgTop: "#F3EAFB",
      baBgBottom: "#E3F0FA",
      baVine: "#9FD98B",
      baLamp: "#FFE2B8",
      baWood: "#C89B6C",
      baStone: "#B9AFA4",
      baCat: "#5A5468",
      baShadow: "rgba(93,84,110,.16)",
    });
    for (const [k, v] of Object.entries(BA_COLORS)) {
      if (k === "baShadow") continue;
      const [r, g, b] = hexToRgb(v);
      for (const ch of [r, g, b]) expect(ch).toBeGreaterThanOrEqual(0);
    }
    // baFilm 是「同色系 +hue 12°」的派生规则,不是静态色:kit/film 的 filmColor 兑现它
    expect(filmColor("#f26d93")).not.toBe("#f26d93");
  });

  it("图层序从底到顶齐全,瞄准点串(功能件)压在飞行泡上、炮台下", () => {
    expect(BA_LAYERS.background).toBeLessThan(BA_LAYERS.vineLamp);
    expect(BA_LAYERS.vineLamp).toBeLessThan(BA_LAYERS.gridBubbles);
    expect(BA_LAYERS.gridBubbles).toBeLessThan(BA_LAYERS.fallTrail);
    expect(BA_LAYERS.fallTrail).toBeLessThan(BA_LAYERS.flight);
    expect(BA_LAYERS.flight).toBeLessThan(BA_LAYERS.aimDots);
    expect(BA_LAYERS.aimDots).toBeLessThan(BA_LAYERS.shooter);
    expect(BA_LAYERS.shooter).toBeLessThan(BA_LAYERS.sparkFx);
    expect(BA_LAYERS.sparkFx).toBeLessThan(BA_LAYERS.hud);
  });
});

describe("2. 薄膜描边阈值:≥6px 出现、<6px 省略", () => {
  it("paintBubble 半径 19 时带薄膜色描边;半径 5.9 时一笔薄膜都没有", () => {
    const big = recorder();
    paintBubble(big.ctx, 50, 50, 19, "#FFA7BD", "#F26D93", "R");
    expect(big.ops).toContain(`strokeStyle=${filmColor("#F26D93")}`);
    const small = recorder();
    paintBubble(small.ctx, 50, 50, FILM_MIN_RADIUS - 0.1, "#FFA7BD", "#F26D93", "R");
    expect(small.ops.some((o) => o === `strokeStyle=${filmColor("#F26D93")}`)).toBe(false);
  });
});

describe("3+4. 瞄准点串:坐标钉死在既有物理输出上,点径 4→2px 递减", () => {
  const grid = parseLayout(["RRGGBBYYR", "GGBBRRYY"]);
  // 斜着往左上打:必定撞左墙反弹,预览折线带反射点
  const result = simulateShot(grid, SHOOTER_X, SHOOTER_Y, -0.8, -0.6);
  const shown = previewPath(result.path);

  it("每个点都躺在 simulateShot→previewPath 的折线上,首点就是发射点本身", () => {
    const dots = aimDots(shown);
    expect(dots.length).toBeGreaterThan(3);
    for (const d of dots) expect(distToPath(d, shown)).toBeLessThan(1e-9);
    expect(dots[0].x).toBe(shown[0].x);
    expect(dots[0].y).toBe(shown[0].y);
    expect(AIM_DOT_SPACING).toBe(16);
  });

  it("反弹点星花 = 物理反射点原样(逐点深比较),不自己算一个坐标", () => {
    expect(shown.length).toBeGreaterThan(2);
    expect(bounceStars(shown)).toEqual(shown.slice(1, shown.length - 1).map((p) => ({ x: p.x, y: p.y })));
  });

  it("点径映射:t=0 → 4px,t=1 → 2px,单调递减且不低于 2px 下限", () => {
    expect(aimDotRadius(0)).toBe(BA_TIMINGS.aimDotMaxR);
    expect(aimDotRadius(1)).toBe(BA_TIMINGS.aimDotMinR);
    expect(BA_TIMINGS.aimDotMaxR).toBe(4);
    expect(BA_TIMINGS.aimDotMinR).toBe(2);
    let prev = Infinity;
    for (let t = 0; t <= 1.5; t += 0.1) {
      const r = aimDotRadius(t);
      expect(r).toBeLessThanOrEqual(prev);
      expect(r).toBeGreaterThanOrEqual(2);
      prev = r;
    }
  });
});

describe("5. 炮管角度:只读既有瞄准角,前后相等", () => {
  it("barrelAngle 就是 atan2(既有方向向量),读冻结对象不写回", () => {
    for (const deg of [8, 45, 90, 135, 172]) {
      const v = aimVector(deg);
      const aim = Object.freeze({ dx: v.dx, dy: v.dy });
      const before = { ...aim };
      expect(barrelAngle(aim)).toBeCloseTo(Math.atan2(v.dy, v.dx), 12);
      // 前后相等:读完向量一个分量都没变
      expect(aim.dx).toBe(before.dx);
      expect(aim.dy).toBe(before.dy);
      // 纯函数:再算一遍还是同一个角
      expect(barrelAngle(aim)).toBe(barrelAngle(aim));
    }
    expect(barrelAngle({ dx: 0, dy: -1 })).toBeCloseTo(-Math.PI / 2, 12);
  });
});

describe("6. 换弹:视觉过场 150ms,逻辑交换时机不变", () => {
  it("swapMs=150;easeInOut 两端 0/1 中点 0.5;reduced 瞬时到位", () => {
    expect(BA_TIMINGS.swapMs).toBe(150);
    expect(swapProgress(0, false)).toBe(0);
    expect(swapProgress(150, false)).toBe(1);
    expect(swapProgress(75, false)).toBeCloseTo(0.5, 12);
    expect(swapProgress(0, true)).toBe(1);
  });

  it("逻辑交换仍是瞬时的 swapLoader(1.2 原样);过场两端位置正确", () => {
    expect(swapLoader({ current: "R", next: "B" })).toEqual({ current: "B", next: "R" });
    const pos0 = swapPositions(0, 180, 444, 314, 446);
    expect(pos0.cur).toEqual({ x: 314, y: 446 });
    expect(pos0.nxt).toEqual({ x: 180, y: 444 });
    const pos1 = swapPositions(1, 180, 444, 314, 446);
    expect(pos1.cur).toEqual({ x: 180, y: 444 });
    expect(pos1.nxt).toEqual({ x: 314, y: 446 });
  });
});

describe("7+8. 特殊泡三分支与石泡两态", () => {
  it("黑猫/棱面/彩虹环三个 painter 可调用且笔迹互不相同", () => {
    const cat = recorder();
    paintBombCat(cat.ctx, 50, 50, 19, 0);
    const stone = recorder();
    paintStoneRock(stone.ctx, 50, 50, 19, false);
    const rainbow = recorder();
    paintRainbowOrb(rainbow.ctx, 50, 50, 19, 0);
    for (const r of [cat, stone, rainbow]) expect(r.ops.length).toBeGreaterThan(5);
    expect(cat.ops.join("|")).not.toBe(stone.ops.join("|"));
    expect(stone.ops.join("|")).not.toBe(rainbow.ops.join("|"));
    expect(cat.ops.join("|")).not.toBe(rainbow.ops.join("|"));
    // 各自的剪影签名:黑猫有猫主色,石泡无;彩虹环有七段彩弧
    expect(cat.ops.some((o) => o.includes(BA_COLORS.baCat))).toBe(true);
    expect(stone.ops.some((o) => o.includes(BA_COLORS.baCat))).toBe(false);
    expect(rainbow.ops.filter((o) => o.startsWith("strokeStyle=#")).length).toBeGreaterThanOrEqual(7);
  });

  it("石泡裂纹两态读既有 cracked 状态:裂态多出加宽裂纹笔,网格一个字不被写", () => {
    expect(stoneCracked(STONE_CRACKED)).toBe(true);
    expect(stoneCracked(STONE)).toBe(false);
    const g = parseLayout(["S.T......"]);
    const before = JSON.stringify(g.rows);
    const plain = recorder();
    paintStoneRock(plain.ctx, 50, 50, 19, stoneCracked(g.rows[0][0]));
    const crack = recorder();
    paintStoneRock(crack.ctx, 50, 50, 19, stoneCracked(g.rows[0][2]));
    expect(crack.ops.filter((o) => o === "stroke").length).toBeGreaterThan(
      plain.ops.filter((o) => o === "stroke").length
    );
    expect(JSON.stringify(g.rows)).toBe(before);
  });
});

describe("9. 色觉标记:换肤后仍渲染,层级不低于泡泡本体", () => {
  it("paintBubble 里标记是最后一笔:排在本体渐变 fill 之后,后面没有任何盖它的面", () => {
    const { ctx, ops } = recorder();
    paintBubble(ctx, 50, 50, 19, "#A6D9FA", "#5BA7E0", "B");
    const bodyFill = ops.indexOf("fill");
    const markStyle = ops.lastIndexOf("strokeStyle=rgba(255,255,255,0.7)");
    expect(bodyFill).toBeGreaterThanOrEqual(0);
    expect(markStyle).toBeGreaterThan(bodyFill);
    // 标记(B=空心圆环 stroke)之后不再有任何 fill/ellipse 把它盖掉
    const after = ops.slice(markStyle);
    expect(after).toContain("stroke");
    expect(after.filter((o) => o === "fill" || o.startsWith("ellipse")).length).toBe(0);
    // 图层常量口径一致:colorMark 与泡泡本体同层
    expect(BA_LAYERS.colorMark).toBe(BA_LAYERS.gridBubbles);
  });

  it("挤压高光只认软泡泡:彩色/彩虹算,石泡与空格不算", () => {
    expect(isSquashy("R")).toBe(true);
    expect(isSquashy("W")).toBe(true);
    expect(isSquashy(STONE)).toBe(false);
    expect(isSquashy(STONE_CRACKED)).toBe(false);
    expect(isSquashy(null)).toBe(false);
  });
});

describe("10. reduced:弹跳/旋转/星火/拖尾全为 0,瞄准点串保留", () => {
  it("四个动效在 reduced 下全归零;非 reduced 下确实在动", () => {
    for (const t of [0, 175, 350, 525, 1234]) {
      expect(bounceOffset(t, true)).toBe(0);
      expect(rainbowSpinAngle(t, true)).toBe(0);
      expect(fuseSparkPhase(t, true)).toBe(0);
    }
    expect(trailFrames(true)).toBe(0);
    expect(trailFrames(false)).toBe(BA_TIMINGS.trailFrames);
    expect(Math.abs(bounceOffset(175, false))).toBeCloseTo(BA_TIMINGS.idleBounceAmpPx, 6);
    expect(rainbowSpinAngle(1200, false)).toBeCloseTo(Math.PI, 6);
    expect(fuseSparkPhase(200, false)).toBeCloseTo(0.5, 6);
  });

  it("瞄准点串是功能件:API 根本不收 reduced 参数,点串照样有", () => {
    const g = parseLayout(["RRGGBBYYR"]);
    const shown = previewPath(simulateShot(g, SHOOTER_X, SHOOTER_Y, 0, -1).path);
    expect(aimDots(shown).length).toBeGreaterThan(0);
    expect(aimDots.length).toBeLessThanOrEqual(2); // (path, spacing?) 两个形参,没有 reduced 位
  });
});

describe("11. 时序表与氛围换算", () => {
  it("四·补三时序表毫秒数逐项钉死", () => {
    expect(BA_TIMINGS.idleBounceMs).toBe(700);
    expect(BA_TIMINGS.idleBounceAmpPx).toBe(2);
    expect(BA_TIMINGS.fuseMs).toBe(400);
    expect(BA_TIMINGS.rainbowSpinMs).toBe(2400);
    expect(BA_TIMINGS.trailFrames).toBe(3);
  });

  it("藤影随压顶加深且封顶;飘分弹入从 0.6 起步到 1 收口", () => {
    expect(vineShadowAlpha(0)).toBeCloseTo(0.16, 6);
    expect(vineShadowAlpha(2)).toBeCloseTo(0.26, 6);
    expect(vineShadowAlpha(99)).toBe(0.4);
    expect(floatPopScale(1)).toBeCloseTo(0.6, 6);
    expect(floatPopScale(0.5)).toBe(1);
    expect(floatPopScale(0)).toBe(1);
  });
});
