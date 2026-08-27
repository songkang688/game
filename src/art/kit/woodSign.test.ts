/**
 * 共享美术套件 · 木牌单测（窗口8 A 档）。
 * 纯字符串断言：牌面 / 钉点 / 文字三层齐全，几何居中，配色全部落进属性。
 */
import { describe, expect, it } from "vitest";
import { NAIL_RATIO, woodSignSVG, type WoodSignOpts } from "./woodSign";

const BASE: WoodSignOpts = {
  cx: 50,
  cy: 30,
  w: 10,
  h: 12,
  text: "12",
  fontSize: 7,
  fill: "#f0d7b2",
  edge: "#a06b3a",
  nail: "#7a4f26",
  ink: "#5c4a7d",
};

describe("art/kit · 木牌 woodSign", () => {
  it("三层齐全：圆角牌面 → 钉点 → 文字，顺序从底到顶", () => {
    const svg = woodSignSVG(BASE);
    const rect = svg.indexOf("<rect");
    const nail = svg.indexOf("<circle");
    const text = svg.indexOf("<text");
    expect(rect).toBeGreaterThan(-1);
    expect(nail).toBeGreaterThan(rect);
    expect(text).toBeGreaterThan(nail);
  });

  it("牌面以 (cx, cy) 居中，文字锚点也在中轴上", () => {
    const svg = woodSignSVG(BASE);
    expect(svg).toContain('x="45.00" y="24.00" width="10.00" height="12.00"');
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toContain('<text x="50.00"');
  });

  it("钉点钉在牌顶：圆心高于牌面中心，半径按 NAIL_RATIO 走", () => {
    const svg = woodSignSVG(BASE);
    const m = svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
    expect(m).not.toBeNull();
    expect(Number(m![2])).toBeLessThan(BASE.cy);
    expect(Number(m![3])).toBeCloseTo(Math.max(0.5, BASE.w * NAIL_RATIO), 2);
  });

  it("四个颜色各归各位：牌底 / 描边 / 钉点 / 文字互不串", () => {
    const svg = woodSignSVG(BASE);
    expect(svg).toContain('fill="#f0d7b2" stroke="#a06b3a"');
    expect(svg).toContain('fill="#7a4f26"');
    expect(svg).toContain('fill="#5c4a7d">12</text>');
  });

  it("圆角与描边有默认值，也吃显式覆盖", () => {
    expect(woodSignSVG(BASE)).toContain(`rx="${(Math.min(BASE.w, BASE.h) * 0.22).toFixed(2)}"`);
    const custom = woodSignSVG({ ...BASE, rx: 3, strokeWidth: 1.5 });
    expect(custom).toContain('rx="3.00"');
    expect(custom).toContain('stroke-width="1.50"');
  });

  it("className 拼在 kit-woodsign 后面，不传就只有基类", () => {
    expect(woodSignSVG(BASE)).toContain('class="kit-woodsign"');
    expect(woodSignSVG({ ...BASE, className: "clk-num clk-num-main" })).toContain(
      'class="kit-woodsign clk-num clk-num-main"'
    );
  });

  it("小到 0.5 的极小牌也画得出：钉点半径不塌成 0", () => {
    const tiny = woodSignSVG({ ...BASE, w: 0.5, h: 0.5, fontSize: 0.3 });
    const m = tiny.match(/<circle[^>]*r="([\d.]+)"/);
    expect(Number(m![1])).toBeGreaterThanOrEqual(0.5);
  });
});
