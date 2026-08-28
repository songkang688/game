/**
 * 飞行棋乐园 · 1.3 视觉资产契约（对照 docs/plan-1.3-step4-C-flight-chess.md 第七节
 * 与 docs/plan-1.3-visual-bible.md 第九节：素材契约测试只升不降）。
 *
 * 资产全是纯函数返回 SVG 字符串，这里直接对字符串结构逐条钉住：
 * 四色飞机互不相同、姿态有别、尾翼形状差（色弱双通道）、
 * 立体骰点数与暗面、机库 / 塔台 / 降落伞 / 朝向查表。
 */
import { describe, expect, it } from "vitest";
import { KIT_PALETTE } from "../../art/kit";
import { BASE, COLORS, COLOR_INFO, GOAL, type Color } from "./board";
import {
  DIE_PIPS,
  FIN_NAMES,
  PARK_DEG,
  cloudSVG,
  contrailSVG,
  dieSVG,
  grassSVG,
  hangarSVG,
  headingDeg,
  parachuteSVG,
  planeSVG,
  rankStripHTML,
  seatProgressHTML,
  stackMarkSVG,
  towerSVG
} from "./art";

describe("planeSVG · 四色 Q 版小飞机", () => {
  it("四色输出非空、互不相同、都含 <svg", () => {
    const outs = COLORS.map((c) => planeSVG(c, "fly"));
    for (const svg of outs) {
      expect(svg.length).toBeGreaterThan(100);
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
    }
    expect(new Set(outs).size).toBe(4);
  });

  it("三种姿态互不相同:park 有停机轮、land 有花环、fly 有竖桨", () => {
    for (const c of COLORS) {
      const fly = planeSVG(c, "fly");
      const park = planeSVG(c, "park");
      const land = planeSVG(c, "land");
      expect(new Set([fly, park, land]).size).toBe(3);
      expect(park).toContain('scale(.85)');
      expect(land).toContain("fc-wreath");
      expect(fly).not.toContain("fc-wreath");
      expect(fly).toContain("fc-prop");
    }
  });

  it("尾翼四款形状类名互不相同(色弱下形状+颜色双通道)", () => {
    const fins = COLORS.map((c) => `fc-fin-${FIN_NAMES[c]}`);
    expect(new Set(fins).size).toBe(4);
    for (const c of COLORS) expect(planeSVG(c, "fly")).toContain(fins[c]);
  });

  it("机身用该色 ink 系、座舱盖有白高光,螺旋桨组可被 CSS 提转速", () => {
    for (const c of COLORS) {
      const svg = planeSVG(c, "fly");
      // 机身描边从 ink 推暗阶,ink 本身至少出现在推导链上(翼尖/描边任一)
      expect(svg).toContain(`fill="${COLOR_INFO[c].ink}"`);
      expect(svg).toContain(KIT_PALETTE.cloud);
      expect(svg).toContain('class="fc-prop"');
    }
  });
});

describe("dieSVG · 伪 3D 三面体骰", () => {
  it("1..6 的 data-pips 与圆点数量一致", () => {
    for (let n = 1; n <= 6; n++) {
      const svg = dieSVG(n);
      expect(svg).toContain(`data-pips="${n}"`);
      expect(svg.split('class="fc-die-pip"').length - 1).toBe(n);
      expect(DIE_PIPS[n]).toHaveLength(n);
    }
  });

  it("越界点数 clamp 到 1–6,绝不给 undefined", () => {
    expect(dieSVG(0)).toContain('data-pips="1"');
    expect(dieSVG(9)).toContain('data-pips="6"');
    expect(dieSVG(Number.NaN)).toContain('data-pips="1"');
    expect(dieSVG(3.4)).toContain('data-pips="3"');
  });

  it("有顶面与侧面两阶明暗(体积),gold 态换金描边", () => {
    const plain = dieSVG(4);
    // 顶面亮、侧面暗:两个 polygon 的 fill 不同
    const fills = [...plain.matchAll(/<polygon[^>]*fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    expect(fills).toHaveLength(2);
    expect(fills[0]).not.toBe(fills[1]);
    expect(plain).not.toContain(KIT_PALETTE.starGold);
    expect(dieSVG(4, true)).toContain(`stroke="${KIT_PALETTE.starGold}"`);
  });
});

describe("机库 / 塔台 / 云朵 / 降落伞 / 尾迹 / 徽章", () => {
  it("hangarSVG 四色互不相同,有机库门弧线与 4 个停机位圆", () => {
    const outs = COLORS.map((c) => hangarSVG(c));
    expect(new Set(outs).size).toBe(4);
    for (const svg of outs) {
      expect(svg).toContain("fc-hangar-door");
      expect(svg.split('stroke-dasharray="3 2.4"').length - 1).toBe(4);
    }
  });

  it("towerSVG 四色风车跑道汇聚 + 金星塔台", () => {
    const svg = towerSVG();
    for (const c of COLORS) expect(svg).toContain(COLOR_INFO[c].soft);
    expect(svg).toContain(KIT_PALETTE.starGold);
    expect(svg).toContain("fc-tower");
  });

  it("cloudSVG 是三团白云不是一个白圈", () => {
    const g = cloudSVG();
    expect(g.split(`fill="${KIT_PALETTE.cloud}"`).length - 1).toBeGreaterThanOrEqual(3);
    expect(g).toContain("fc-cloud");
  });

  it("parachuteSVG 伞衣跟随座位色、有伞绳,是降落伞不是爆炸", () => {
    const outs = COLORS.map((c) => parachuteSVG(c));
    expect(new Set(outs).size).toBe(4);
    for (const c of COLORS) {
      expect(outs[c]).toContain(COLOR_INFO[c].soft);
      expect(outs[c]).toContain(`stroke="${COLOR_INFO[c].ink}"`);
    }
  });

  it("contrailSVG 两条白色拉烟线", () => {
    const svg = contrailSVG();
    expect(svg.split(`stroke="${KIT_PALETTE.cloud}"`).length - 1).toBe(2);
  });

  it("stackMarkSVG 是 ×2 徽章,描边用座位 ink", () => {
    for (const c of COLORS) {
      const svg = stackMarkSVG(c);
      expect(svg).toContain("×2");
      expect(svg).toContain(`stroke="${COLOR_INFO[c].ink}"`);
    }
  });
});

describe("headingDeg · 机头朝向八方向查表", () => {
  it("基地停机时四个角各自面向棋盘中心", () => {
    for (const c of COLORS) expect(headingDeg(c, BASE)).toBe(PARK_DEG[c]);
    expect(new Set(PARK_DEG).size).toBe(4);
  });

  it("直线段照行进方向转:朵朵起飞格向东是 90°,内折角吸到 45°", () => {
    expect(headingDeg(0, 0)).toBe(90);
    // RING_XY[5]=(5,6) → RING_XY[6]=(6,5):右上对角
    expect(headingDeg(0, 5)).toBe(45);
  });

  it("终点沿通道方向、全程都是 45° 的倍数", () => {
    expect(headingDeg(0, GOAL)).toBe(90);
    expect(headingDeg(1, GOAL)).toBe(180);
    expect(headingDeg(2, GOAL)).toBe(270);
    expect(headingDeg(3, GOAL)).toBe(0);
    for (const c of COLORS) {
      for (let p = 0; p <= GOAL; p++) {
        const deg = headingDeg(c as Color, p);
        expect(deg % 45, `color ${c} p ${p}`).toBe(0);
        expect(deg).toBeGreaterThanOrEqual(0);
        expect(deg).toBeLessThan(360);
      }
    }
  });
});

describe("座位进度与名次条", () => {
  it("seatProgressHTML 永远 4 个机位,点亮数 clamp 到 0–4", () => {
    const two = seatProgressHTML(2, 0);
    expect(two.split('<i class="fc-slot').length - 1).toBe(4);
    expect(two.split("fc-slot-on").length - 1).toBe(2);
    expect(two).toContain('aria-label="到家 2/4"');
    expect(seatProgressHTML(9, 1).split("fc-slot-on").length - 1).toBe(4);
    expect(seatProgressHTML(-1, 2)).not.toContain("fc-slot-on");
  });

  it("rankStripHTML 按名次摆四色飞机头像,第一名戴星", () => {
    const html = rankStripHTML([2, 0, 3, 1]);
    expect(html.split("<svg").length - 1).toBeGreaterThanOrEqual(5);
    expect(html.indexOf(COLOR_INFO[2].name)).toBeLessThan(html.indexOf(COLOR_INFO[0].name));
    expect(html.split("fc-rank-star").length - 1).toBe(1);
    expect(html).toContain("fc-plane-land");
  });
});

describe("grassSVG · 盘面装饰草地簇(1.3 r1 P3)", () => {
  it("三个叠圆土丘 + 两根短草,双色阶从底色派生", () => {
    const g = grassSVG(COLOR_INFO[0].soft);
    expect(g).toContain('class="fc-grass"');
    expect(g.split("<circle").length - 1).toBe(3);
    expect(g.split("<path").length - 1).toBe(1); // 两根草并进一条 path
    expect(g).toContain('stroke-width="1.2"');
    const colors = new Set([...g.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/g)].map((m) => m[1]));
    expect(colors.size).toBeGreaterThanOrEqual(2); // 土丘 + 草叶两阶
  });

  it("四色底各派生一簇,输出互异且全是静态图形(无动画标签)", () => {
    const outs = COLORS.map((c) => grassSVG(COLOR_INFO[c].soft));
    expect(new Set(outs).size).toBe(4);
    for (const g of outs) {
      expect(g).not.toContain("<animate");
      expect(g).not.toContain("animation");
    }
  });
});
