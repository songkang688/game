/**
 * 红蓝赛跑 · 1.3 视觉皮肤模块(art.ts)的纯函数契约。
 * 全部 node 环境可跑:字符串输出直接断言,不碰 DOM。
 */
import { describe, expect, it } from "vitest";
import type { ObstacleType } from "./levels";
import {
  RBR_TOKENS_CSS,
  buntingSvg,
  checkerFlagSvg,
  crownSvg,
  finishArchSvg,
  laneLeftPct,
  obstacleSvg,
  standsSvg,
  startLightsHtml,
  whistleSvg
} from "./art";

const ALL_TYPES: ObstacleType[] = ["puddle", "hurdle", "hill", "star", "item"];

describe("红蓝赛跑 · 设计 token", () => {
  it("四·补一的八个色 token 一个不少,全部集中在 RBR_TOKENS_CSS", () => {
    for (const token of [
      "--rbr-track",
      "--rbr-track-far",
      "--rbr-lane-line",
      "--rbr-sky",
      "--rbr-stand",
      "--rbr-red",
      "--rbr-blue",
      "--rbr-puddle",
      "--rbr-gate"
    ]) {
      expect(RBR_TOKENS_CSS, `缺 token ${token}`).toContain(`${token}:`);
    }
  });

  it("动效时长也是 token:尘土 240ms / 滑倒 500ms / 拾取飞行 260ms", () => {
    expect(RBR_TOKENS_CSS).toContain("--rbr-dust-ms: 240ms");
    expect(RBR_TOKENS_CSS).toContain("--rbr-slip-ms: 500ms");
    expect(RBR_TOKENS_CSS).toContain("--rbr-fly-ms: 260ms");
  });

  it("色值与规格一致:跑道 #E8A87A、红 #E85D75、蓝 #4A7FD8、水洼 #A8D8F0、拱门 #F0C25A", () => {
    expect(RBR_TOKENS_CSS).toContain("--rbr-track: #E8A87A");
    expect(RBR_TOKENS_CSS).toContain("--rbr-red: #E85D75");
    expect(RBR_TOKENS_CSS).toContain("--rbr-blue: #4A7FD8");
    expect(RBR_TOKENS_CSS).toContain("--rbr-puddle: #A8D8F0");
    expect(RBR_TOKENS_CSS).toContain("--rbr-gate: #F0C25A");
    expect(RBR_TOKENS_CSS).toContain("--rbr-sky: #DFF2FF");
    expect(RBR_TOKENS_CSS).toContain("--rbr-stand: #D8CBEA");
  });
});

describe("红蓝赛跑 · 跑者位置映射(换肤前后必须一字不差)", () => {
  it("pos → left% 快照:0.92 系数、0..92 双夹,和 1.2 的 setPos 完全一致", () => {
    expect(laneLeftPct(0)).toBe(0);
    expect(laneLeftPct(25)).toBeCloseTo(23, 10);
    expect(laneLeftPct(50)).toBeCloseTo(46, 10);
    expect(laneLeftPct(100)).toBe(92);
    expect(laneLeftPct(120)).toBe(92);
    expect(laneLeftPct(-5)).toBe(0);
  });
});

describe("红蓝赛跑 · 障碍与道具自绘", () => {
  it("五种机关都出 <svg>,不再是 emoji 字符", () => {
    for (const type of ALL_TYPES) {
      const svg = obstacleSvg(type, `t${type}`);
      expect(svg.startsWith("<svg "), `${type} 不是 svg`).toBe(true);
      expect(svg).toContain(`data-ob="${type}"`);
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).not.toContain("NaN");
    }
  });

  it("水坑 = 椭圆水洼 + 反光高光 + 溅水两滴", () => {
    const svg = obstacleSvg("puddle", "p1");
    expect([...svg.matchAll(/<ellipse /g)].length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain('stroke="#FFFFFF"');
    // 溅起的两滴水
    expect([...svg.matchAll(/<path d="M\d+ \d+ q/g)].length).toBe(2);
  });

  it("栏架 = 双腿 + 条纹横杆(白条 ≥ 4 根)", () => {
    const svg = obstacleSvg("hurdle", "h1");
    expect([...svg.matchAll(/fill="#FFFFFF"/g)].length).toBeGreaterThanOrEqual(4);
    expect(svg).toContain("var(--rbr-gate");
  });

  it("星星 / 礼物箱走渐变 + 描边,渐变 id 吃 uid 隔离", () => {
    const star = obstacleSvg("star", "sA");
    const gift = obstacleSvg("item", "gA");
    expect(star).toContain("<linearGradient id=\"sA-star\"");
    expect(star).toContain("stroke=");
    expect(gift).toContain("<linearGradient id=\"gA-gift\"");
    expect(gift).toContain("stroke=");
    expect(obstacleSvg("star", "sB")).toContain("sB-star");
    // uid 里的非法字符要剥干净,不能写坏 id
    expect(obstacleSvg("star", 'x"><evil')).toContain('id="xevil-star"');
  });

  it("同类型同 uid 输出确定(可快照)", () => {
    expect(obstacleSvg("hill", "z")).toBe(obstacleSvg("hill", "z"));
  });
});

describe("红蓝赛跑 · 冲线仪式与场景件", () => {
  it("终点拱门:格纹横幅 + 双柱 + 可荡开的缎带两半", () => {
    const svg = finishArchSvg("a1");
    expect(svg.startsWith("<svg ")).toBe(true);
    // 格纹:两行黑白相间,黑格 ≥ 6 块
    expect([...svg.matchAll(/fill="#4A4458"/g)].length).toBeGreaterThanOrEqual(6);
    expect(svg).toContain('class="rbr-ribbon-l"');
    expect(svg).toContain('class="rbr-ribbon-r"');
    expect(svg).toContain('id="a1-post"');
  });

  it("自绘格纹旗:旗面带格纹与描边,有旗杆", () => {
    const svg = checkerFlagSvg("f1");
    expect(svg).toContain('data-art="checker-flag"');
    expect([...svg.matchAll(/fill="#4A4458"/g)].length).toBeGreaterThanOrEqual(5);
    expect(svg).toContain("clip-path=\"url(#f1-wave)\"");
  });

  it("看台剪影带一排小脑袋,彩旗串三色轮换,都能拉通全宽", () => {
    const stands = standsSvg();
    expect([...stands.matchAll(/<circle /g)].length).toBeGreaterThanOrEqual(12);
    expect(stands).toContain('preserveAspectRatio="none"');
    const bunting = buntingSvg();
    expect([...bunting.matchAll(/<path d="M\d+ 4 L/g)].length).toBeGreaterThanOrEqual(10);
    expect(bunting).toContain('preserveAspectRatio="none"');
  });

  it("起跑灯三盏:红红绿的三个灯位齐全", () => {
    const html = startLightsHtml();
    expect([...html.matchAll(/class="rbr-light /g)].length).toBe(3);
    expect(html).toContain("rbr-light-ready");
    expect(html).toContain("rbr-light-set");
    expect(html).toContain("rbr-light-go");
  });

  it("皇冠与哨子都是自绘 svg,不含脚本", () => {
    for (const svg of [crownSvg(), whistleSvg()]) {
      expect(svg.startsWith("<svg ")).toBe(true);
      expect(svg.toLowerCase()).not.toContain("<script");
      expect(svg).not.toContain("NaN");
    }
  });
});
