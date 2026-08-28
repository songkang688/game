/**
 * 翻翻暗棋 · 1.3 第 1 轮视觉验收（窗口 2 · 测试员）补充契约。
 *
 *  ① 专项②：翻开棋面 = 象牙 ≥ 2 停渐变 + 厚度阴影椭圆 + 阵营环描边 + 汉字双钩，四层俱全；
 *  ② 专项③：红蓝双方 7 兵种字形集互不相同（帅≠将、俥≠車……），颜色之外有字形通道；
 *  ③ 战力点数直读 RANK：帅 7 点 → 兵 1 点，一格不错；
 *  ④ 记牌迷你棋 dim 态必须加删除线并转灰（不是只换个透明度）。
 */
import { describe, expect, it } from "vitest";
import { FACTION, miniPieceSVG, pieceFaceSVG } from "./art";
import { KINDS, RANK, RED_LABEL, BLUE_LABEL } from "./board";

describe("专项②:棋面四层体积", () => {
  it("每一枚翻开的棋面都有 ≥2 停渐变、厚度椭圆、阵营环与汉字描边", () => {
    for (const color of ["red", "blue"] as const) {
      for (const kind of KINDS) {
        const svg = pieceFaceSVG(color, kind);
        expect((svg.match(/<stop /g) ?? []).length, `${color}/${kind} 渐变停数`).toBeGreaterThanOrEqual(2);
        expect(svg, `${color}/${kind} 缺厚度椭圆`).toContain('fill="#b09468"');
        expect(svg, `${color}/${kind} 缺阵营环`).toContain(`stroke="${FACTION[color].ring}"`);
        expect(svg, `${color}/${kind} 缺汉字双钩`).toContain('paint-order="stroke"');
      }
    }
  });
});

describe("专项③:双方字形通道", () => {
  it("红蓝 7 兵种的汉字两两错开,14 个字全场无重复", () => {
    const all = [...KINDS.map((k) => RED_LABEL[k]), ...KINDS.map((k) => BLUE_LABEL[k])];
    expect(new Set(all).size, "14 个字必须 14 张面孔").toBe(14);
    for (const k of KINDS) expect(RED_LABEL[k], `${k} 红蓝同字`).not.toBe(BLUE_LABEL[k]);
  });
});

describe("战力点数直读 RANK", () => {
  it("每枚棋面的 dcp 点数 = RANK[kind]", () => {
    for (const kind of KINDS) {
      const svg = pieceFaceSVG("red", kind);
      const dots = (svg.match(/class="dcp"/g) ?? []).length;
      expect(dots, `${kind} 点数`).toBe(RANK[kind]);
    }
  });

  it("只有炮有「隔山打」虚线弧", () => {
    for (const kind of KINDS) {
      const has = pieceFaceSVG("blue", kind).includes('class="dcarc"');
      expect(has, kind).toBe(kind === "cannon");
    }
  });
});

describe("记牌迷你棋 dim 双通道", () => {
  it("dim 态加删除线(dcx)且不再用阵营环色;normal 态没有删除线", () => {
    for (const kind of KINDS) {
      const dim = miniPieceSVG("red", kind, true);
      const normal = miniPieceSVG("red", kind, false);
      expect(dim).toContain('class="dcx"');
      expect(dim.includes(FACTION.red.ring)).toBe(false);
      expect(normal).not.toContain('class="dcx"');
      expect(normal).toContain(FACTION.red.ring);
    }
  });
});
