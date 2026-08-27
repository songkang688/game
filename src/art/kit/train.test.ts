import { describe, expect, it } from "vitest";
import {
  TRAIN_COLORS,
  carriage,
  kindColor,
  loco,
  railway,
  sleeperXs,
  steamPuff,
  ticketZigzag,
  tonedCharIndex,
} from "./train";

/** 把 SVG 标记里的标签全部剥掉，剩下的就是 textContent */
function textOf(svg: string): string {
  return svg.replace(/<[^>]*>/g, "");
}

describe("art-kit · 小火车部件", () => {
  it("车头输出是完整 svg，不含脚本、不含 NaN", () => {
    const svg = loco();
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg.toLowerCase()).not.toContain("<script");
    expect(svg).not.toContain("NaN");
  });

  it("车头部件齐全：锅炉 / 烟囱 / 排障器 / 大圆灯 / 驾驶室方窗 / 双轮以上 / 挂钩", () => {
    const svg = loco();
    expect(svg).toContain("kit-train-boiler");
    expect(svg).toContain("kit-train-chimney");
    expect(svg).toContain("kit-train-cowcatcher");
    expect(svg).toContain("kit-train-lamp");
    expect(svg).toContain("kit-train-cab");
    expect(svg).toContain("kit-train-window");
    expect([...svg.matchAll(/kit-train-wheel/g)].length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain("kit-train-hook");
    // 锅炉主色与描边阴影都落在标记里
    expect(svg).toContain(TRAIN_COLORS.locoRed);
    expect(svg).toContain(TRAIN_COLORS.locoRedDark);
  });

  it("禁抄托马斯：车头无人脸浮雕节点，笑眼只是两条弯线", () => {
    const svg = loco();
    expect(svg).toContain('data-face="none"');
    expect(svg).not.toMatch(/class="[^"]*face/);
    expect(svg).not.toMatch(/faceplate|nose|mouth|cheek/i);
    // 笑眼弯线是 stroke path，不是实心浮雕
    const eyes = [...svg.matchAll(/class="kit-train-eye"/g)];
    expect(eyes.length).toBe(2);
    for (const m of svg.matchAll(/<path[^>]*kit-train-eye[^>]*>/g)) {
      expect(m[0]).toContain('fill="none"');
    }
  });

  it("车厢部件齐全：奶油车身 / 类别色顶边条 / 双轮 / 挂钩", () => {
    const svg = carriage("mā", "final");
    expect(svg).toContain("kit-train-body");
    expect(svg).toContain(TRAIN_COLORS.carriageCream);
    expect(svg).toContain("kit-train-band");
    expect(svg).toContain(TRAIN_COLORS.finalTeal);
    expect([...svg.matchAll(/kit-train-wheel/g)].length).toBe(2);
    expect(svg).toContain("kit-train-hook");
    expect(svg).not.toContain("NaN");
  });

  it("车厢侧面文字逐字符原样输出（ā á ǎ à 正字法钉死），戴调号的字母用 toneRed 加粗", () => {
    for (const syll of ["mā", "má", "mǎ", "mà", "xióng", "ǖ"]) {
      const svg = carriage(syll, "final");
      expect(textOf(svg)).toBe(syll);
      const toned = svg.match(/<tspan fill="([^"]+)" font-weight="900" class="kit-train-tonechar">([^<]+)<\/tspan>/);
      expect(toned).not.toBeNull();
      expect(toned![1]).toBe(TRAIN_COLORS.toneRed);
      expect(Array.from(syll)[tonedCharIndex(syll)]).toBe(toned![2]);
    }
    // 轻声（没调号）就不标红，字符照样原样
    const plain = carriage("de", "plain");
    expect(textOf(plain)).toBe("de");
    expect(plain).not.toContain("kit-train-tonechar");
  });

  it("声调符号不因样式裁切：svg 与 text 都是 overflow visible", () => {
    const svg = carriage("ǎ", "tone");
    expect(svg).toMatch(/<svg [^>]*overflow="visible"/);
    expect(svg).toMatch(/<text [^>]*overflow="visible"/);
  });

  it("三色助记：声母橙 / 韵母青 / 整体认读紫 / 声调红，四色互不相同", () => {
    expect(kindColor("initial")).toBe(TRAIN_COLORS.initialOrange);
    expect(kindColor("final")).toBe(TRAIN_COLORS.finalTeal);
    expect(kindColor("whole")).toBe(TRAIN_COLORS.wholePurple);
    expect(kindColor("tone")).toBe(TRAIN_COLORS.toneRed);
    const four = new Set([kindColor("initial"), kindColor("final"), kindColor("whole"), kindColor("tone")]);
    expect(four.size).toBe(4);
    expect(carriage("b", "initial")).toContain(TRAIN_COLORS.initialOrange);
    expect(carriage("zhi", "whole")).toContain(TRAIN_COLORS.wholePurple);
  });

  it("枕木间距 0.85 等比递减（前三格数值断言，2.5D 纵深钉死）", () => {
    const xs = sleeperXs(5, 6, 40, 0.85);
    const g1 = xs[1] - xs[0];
    const g2 = xs[2] - xs[1];
    const g3 = xs[3] - xs[2];
    expect(g1).toBeCloseTo(40, 5);
    expect(g2 / g1).toBeCloseTo(0.85, 5);
    expect(g3 / g2).toBeCloseTo(0.85, 5);
    // 透视轨道真的用上了这一串：双线 + 枕木一根不少
    const rail = railway({ width: 320, height: 90 });
    expect([...rail.matchAll(/kit-rail-line/g)].length).toBe(2);
    expect([...rail.matchAll(/kit-rail-sleeper/g)].length).toBeGreaterThanOrEqual(5);
    expect(rail).toContain(TRAIN_COLORS.railGray);
    expect(rail).toContain(TRAIN_COLORS.sleeperBrown);
    expect(rail).not.toContain("NaN");
  });

  it("白烟三档大小圆 r=4/6/8", () => {
    const puff = steamPuff();
    expect(puff).toContain('r="4"');
    expect(puff).toContain('r="6"');
    expect(puff).toContain('r="8"');
    expect(puff).toContain(TRAIN_COLORS.steamWhite);
  });

  it("车票锯齿 clip-path 是合法 polygon，左右两边都有锯齿", () => {
    const clip = ticketZigzag(7);
    expect(clip.startsWith("polygon(")).toBe(true);
    expect(clip.endsWith(")")).toBe(true);
    // 7 齿 ×2 边 ×3 点 + 顶底 3 点 = 45 个坐标点
    expect(clip.split(",").length).toBe(45);
    expect(clip).toContain("100% ");
    expect(clip).toContain("0% ");
  });

  it("文字转义与 id 隔离：注入字符被转义，双实例同页不撞 id", () => {
    const evil = carriage('a"<b>', "plain");
    expect(evil).not.toContain("<b>");
    expect(evil).toContain("&lt;");
    expect(evil).toContain("&gt;");
    const a = carriage("mā", "final", 96, "carA");
    const b = carriage("mā", "final", 96, "carB");
    expect(a).toContain('id="carA-band"');
    expect(b).toContain('id="carB-band"');
    expect(a).not.toContain("carB");
    expect(loco(120, 'x"><bad')).toContain('id="xbad-boiler"');
  });

  it("尺寸参数化：宽高按比例走，乱传尺寸回退默认不画坏", () => {
    expect(loco(240)).toContain('width="240.0"');
    expect(loco(240)).toContain('height="168.0"');
    expect(carriage("mā", "final", 48)).toContain('width="48.0"');
    expect(loco(Number.NaN)).toBe(loco(120));
    expect(() => carriage("mā", "final", -5)).not.toThrow();
  });
});
