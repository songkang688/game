/**
 * 泡泡瞄准 · 窗口 6 第 2 轮监督修复员(C 档)· 画布 HUD 字符清偿钉子。
 *
 * 第 1 轮登记「canvas HUD 文案含 ⚠️/♾️/⭐ 字符(非主体)」,本轮清偿:
 * 三枚字符换成与 starPath 同族的单色矢量(paintWarnTriangle / paintInfinity /
 * paintStarRow),颜色由调用方给(跟随 HUD 呼吸透明度)。钉住:
 *  1) 三个 paint 函数按规格作画(三角 2px 描边 + 感叹号;双圆环横 8;
 *     金星实心/灰星空心分档);
 *  2) index.ts 的画布 fillText 里 ⚠️/♾️/⭐/☆ 清零(DOM 文案与 aria 不在此列);
 *  3) 文案本体一字不动(「快到警戒线啦!」「无尽墙」仍在)。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { paintInfinity, paintStarRow, paintWarnTriangle, type PaintCtx } from "./visual";

/** 记录桩(与 visual.test.ts 同款,精简版) */
function recorder(): { ctx: PaintCtx; ops: string[] } {
  const ops: string[] = [];
  const gradient = (): CanvasGradient =>
    ({ addColorStop: () => void 0 }) as unknown as CanvasGradient;
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

describe("HUD 单色矢量件 · 本体规格", () => {
  it("警戒三角:闭合三角描边 + 感叹号(竖条 fillRect + 圆点),颜色跟调用方", () => {
    const { ctx, ops } = recorder();
    paintWarnTriangle(ctx, 100, 50, 12, "rgba(255, 70, 100, 0.8)");
    expect(ops).toContain("strokeStyle=rgba(255, 70, 100, 0.8)");
    expect(ops).toContain("closePath");
    expect(ops).toContain("stroke");
    expect(ops).toContain("fillRect");
    expect(ops.filter((o) => o.startsWith("arc")).length).toBe(1);
    // 三角三个顶点:1 moveTo + 2 lineTo
    expect(ops.filter((o) => o.startsWith("moveTo")).length).toBe(1);
    expect(ops.filter((o) => o.startsWith("lineTo")).length).toBe(2);
  });

  it("横 8 字:两枚圆环、圆心左右对称、单色描边", () => {
    const { ctx, ops } = recorder();
    paintInfinity(ctx, 100, 50, 24, "#3E7CB8");
    const arcs = ops.filter((o) => o.startsWith("arc"));
    expect(arcs.length).toBe(2);
    const xs = arcs.map((a) => Number(a.slice(4).split(",")[0]));
    expect((xs[0] + xs[1]) / 2).toBeCloseTo(100, 1);
    expect(ops.filter((o) => o === "stroke").length).toBe(2);
  });

  it("结算星排:2/3 星 = 前两颗金星实心 + 第三颗空心描边", () => {
    const { ctx, ops } = recorder();
    paintStarRow(ctx, 180, 240, 11, 2);
    expect(ops.filter((o) => o === "fill").length).toBe(2);
    expect(ops.filter((o) => o === "stroke").length).toBe(3);
    expect(ops).toContain("fillStyle=#F5B301");
    expect(ops).toContain("strokeStyle=#B9C6D4");
    // 每颗五角星 10 个顶点:1 moveTo + 9 lineTo,共 3 颗
    expect(ops.filter((o) => o.startsWith("moveTo")).length).toBe(3);
    expect(ops.filter((o) => o.startsWith("lineTo")).length).toBe(27);
  });

  it("0/3 星全空心、3/3 星全实心", () => {
    const a = recorder();
    paintStarRow(a.ctx, 0, 0, 10, 0);
    expect(a.ops.filter((o) => o === "fill").length).toBe(0);
    const b = recorder();
    paintStarRow(b.ctx, 0, 0, 10, 3);
    expect(b.ops.filter((o) => o === "fill").length).toBe(3);
  });
});

describe("HUD 字符清偿 · index.ts 接线", () => {
  const SRC = readFileSync(join(__dirname, "index.ts"), "utf8");

  it("画布 fillText 里 ⚠️/♾️/⭐/☆ 清零", () => {
    const fillTexts = SRC.match(/fillText\([^)]*\)/g) ?? [];
    for (const call of fillTexts) {
      expect(/[⚠♾⭐☆]/u.test(call), call).toBe(false);
    }
  });

  it("三处换用矢量件,文案本体一字不动", () => {
    expect(SRC).toContain("paintWarnTriangle(ctx, W / 2 - 50, dy + 12, 12, warnColor)");
    expect(SRC).toContain('ctx.fillText("快到警戒线啦!", W / 2 + 7, dy + 16)');
    expect(SRC).toContain("paintInfinity(ctx, W / 2 - 34, 205, 24");
    expect(SRC).toContain('ctx.fillText("无尽墙", W / 2 + 13, 212)');
    expect(SRC).toContain("paintStarRow(ctx, W / 2, 240, 11, wonStars)");
  });

  it("DOM 侧文案(按钮/地图小结)不在登记范围,保持原样", () => {
    expect(SRC).toContain("♾️ 无尽墙");
  });
});
