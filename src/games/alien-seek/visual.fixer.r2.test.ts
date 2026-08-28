/**
 * 找外星人 · 窗口 6 第 2 轮监督修复员(C 档)· B 档建议级清偿钉子。
 *
 * B 档第 1 轮登记(建议级):藏匿点内腔与 "?" 文本记号层次淡,掀开后内腔
 * 近乎平涂。本轮清偿:
 *  1) 八种藏身处的内腔统一 2 停径向渐变(中心 #3E3A66 → 边缘 -18%),
 *     不再按各自主色平涂(visual.ts 新增 cavityGrad,index.ts 逐 kind 接线);
 *  2) 点错问号云里的 fillText("?") 换 2.2px 描边白问号路径 + 薰衣草落影,
 *     文本字形一个不留。
 * 命中判定的圆心半径、spotUncover 的掀开进度一个数都没动。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AS_CAVITY_CORE, AS_CAVITY_EDGE, cavityGrad, mixHex } from "./visual";

describe("内腔 2 停径向渐变 · 规格", () => {
  it("中心色 #3E3A66,边缘 = 中心往黑压 18%", () => {
    expect(AS_CAVITY_CORE).toBe("#3E3A66");
    expect(AS_CAVITY_EDGE).toBe(mixHex("#3E3A66", "#000000", 0.18));
    expect(AS_CAVITY_EDGE).toBe("rgb(51,48,84)");
  });

  it("cavityGrad:同心径向、内圈小于外圈、两停 0→中心色 / 1→边缘色", () => {
    const calls: number[][] = [];
    const stops: Array<[number, string]> = [];
    const stub = {
      createRadialGradient(...args: number[]): CanvasGradient {
        calls.push(args);
        return { addColorStop: (o: number, c: string) => void stops.push([o, c]) } as unknown as CanvasGradient;
      },
    };
    cavityGrad(stub, 3, -12, 20);
    expect(calls.length).toBe(1);
    const [x0, y0, r0, x1, y1, r1] = calls[0];
    expect([x0, y0]).toEqual([3, -12]);
    expect([x1, y1]).toEqual([3, -12]);
    expect(r0).toBeLessThan(r1);
    expect(stops).toEqual([
      [0, AS_CAVITY_CORE],
      [1, AS_CAVITY_EDGE],
    ]);
  });
});

describe("index.ts 接线 · 八种藏身处逐 kind 走内腔渐变,问号换路径", () => {
  const SRC = readFileSync(join(__dirname, "index.ts"), "utf8");

  it("drawSpotShape 里 cavity(...) 每种藏身处各接一次(共 8 处)", () => {
    expect((SRC.match(/^\s*cavity\(/gm) ?? []).length).toBe(8);
    expect(SRC).toContain("c2d.fillStyle = cavityGrad(c2d, cx, cy, rad)");
  });

  it("内腔不再按主色平涂:shade(fill, 0.42) 的旧 deep 已退场", () => {
    expect(SRC).not.toContain("shade(fill, 0.42)");
  });

  it('问号云里 fillText("?") 清零,换 2.2px 白路径 + 落影双笔道', () => {
    expect(SRC).not.toContain('fillText("?"');
    expect(SRC).toContain('qStroke(0, -r * 0.06, "#ffffff", 2.2)');
    expect(SRC).toContain('"rgba(122,104,176,.8)", 3.4');
  });

  it("问号是路径件:钩(arc+quadraticCurveTo)与点(arc 实心)各就位", () => {
    const at = SRC.indexOf("const qStroke");
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, SRC.indexOf("};", at));
    expect(body).toContain("c2d.arc(dx, dy - r * 0.16, r * 0.14, Math.PI, Math.PI * 2.25)");
    expect(body).toContain("quadraticCurveTo");
    expect(body).toContain("c2d.arc(dx, dy + r * 0.16, r * 0.05, 0, Math.PI * 2)");
  });
});
