/**
 * bowling-lane · 1.3 窗口 5 第 3 轮(终验)监督修复员 · C-2 配套用例。
 *
 * C-2 = B 档 R2 一致性点名排名 3(R2-b 登记交本轮):馆内暗底 #3b3556 是
 * 全窗唯一大面积低明度色,「灰紫夜场」不是「粉彩夜场」。裁决选方案 A ——
 * 暗底提暖一档:整屏提亮 6%(白覆盖层,与 shade("#3b3556",+6) 逐通道相等)
 * 再叠 4% 粉紫 tint;两道覆盖层压在暗底之后、邻道剪影之前(不进跟球缩放),
 * 主道 / 灯箱 / 邻道剪影 / 立柱一个数不动 —— 亮度预算仍只留给球道与灯箱。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hexToRgb, shade } from "../../art/kit/palette";
import { BL_HALL_LIFT_ALPHA, BL_HALL_TINT, BL_HALL_TINT_ALPHA } from "./visual13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");

/** 源色上按 alpha 盖一层覆盖色(canvas source-over 的通道数学) */
function over(base: [number, number, number], top: [number, number, number], a: number): [number, number, number] {
  return [0, 1, 2].map((i) => base[i] + (top[i] - base[i]) * a) as [number, number, number];
}

/** 相对亮度(粗算,0..1):够用来钉「提暖是一档不是一整级」 */
function lum([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

const BASE = hexToRgb("#3b3556");
const LIFTED = over(BASE, [255, 255, 255], BL_HALL_LIFT_ALPHA);
const FINAL = over(LIFTED, hexToRgb(BL_HALL_TINT), BL_HALL_TINT_ALPHA);

describe("bowling-lane · C-2 粉彩夜场(方案 A · 暗底提暖一档)", () => {
  it("档位对表:提亮 6% + 粉紫 4%,合计 ≤ 0.12 的克制档(不抢球道与灯箱的亮度预算)", () => {
    expect(BL_HALL_LIFT_ALPHA).toBe(0.06);
    expect(BL_HALL_TINT_ALPHA).toBe(0.04);
    expect(BL_HALL_LIFT_ALPHA + BL_HALL_TINT_ALPHA).toBeLessThanOrEqual(0.12);
  });

  it("白覆盖层 6% 与 B 档规格 shade(#3b3556, +6) 逐通道相等(覆盖层实现只是为保图层锚点)", () => {
    const spec = hexToRgb(shade("#3b3556", 6));
    for (let i = 0; i < 3; i++) {
      expect(Math.round(LIFTED[i])).toBe(spec[i]);
    }
  });

  it("tint 是粉紫家族(红蓝双高于绿),叠完后暗底比原色更暖(r/b 比升高)且仍是暗场", () => {
    const [tr, tg, tb] = hexToRgb(BL_HALL_TINT);
    expect(tr).toBeGreaterThan(tg);
    expect(tb).toBeGreaterThan(tg);
    // 暖一档:红蓝比从灰紫往粉紫挪
    expect(FINAL[0] / FINAL[2]).toBeGreaterThan(BASE[0] / BASE[2]);
    // 只提一档:亮度涨幅在 0.08 以内,暗场馆主题不丢
    expect(lum(FINAL)).toBeGreaterThan(lum(BASE));
    expect(lum(FINAL) - lum(BASE)).toBeLessThanOrEqual(0.08);
    // 依旧比主道木色暗得多(亮度预算留给球道)
    expect(lum(FINAL)).toBeLessThan(lum(hexToRgb("#F7E6C8")) * 0.5);
  });

  it("index.ts 调用序:两道提暖覆盖层压在 #3b3556 暗底之后、邻道剪影之前(不进跟球缩放)", () => {
    const src = read("index.ts");
    const base = src.indexOf('g.fillStyle = "#3b3556"');
    const lift = src.indexOf("BL_HALL_LIFT_ALPHA", base);
    const tint = src.indexOf("BL_HALL_TINT,", base);
    const neighbor = src.indexOf("drawNeighborLanes(g, view)", base);
    const follow = src.indexOf("// 「跟球」运镜", base);
    expect(base).toBeGreaterThan(-1);
    expect(lift).toBeGreaterThan(base);
    expect(tint).toBeGreaterThan(lift);
    expect(neighbor).toBeGreaterThan(tint);
    expect(follow).toBeGreaterThan(neighbor);
  });
});
