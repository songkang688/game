/**
 * 共享美术套件 · frame.ts 单测（1.3 视觉升级 · 窗口8 C 档）。
 *
 * 画框 / 挂牌 / 麻绳 / 放大镜都是纯字符串输出，这里钉四件事：
 * ① token 都是合法颜色且深浅关系对；② CSS 前缀被清洗、装饰层不挡点击；
 * ③ SVG 的结构参数（别针个数、描边宽、贝塞尔下垂）；④ 无位图、无外链、输出确定。
 */
import { describe, expect, it } from "vitest";

import { parseHex } from "./palette";
import {
  FRAME_BORDER_PX,
  FRAME_TOKENS,
  MATTE_PX,
  magnifierSVG,
  plaqueCss,
  ropeSVG,
  woodFrameCss,
} from "./frame";

const luma = (hex: string): number => {
  const rgb = parseHex(hex)!;
  return rgb[0] + rgb[1] + rgb[2];
};

describe("art-kit · frame 木色 token", () => {
  it("四个木色 token 全是合法 hex，且互不相同", () => {
    const values = Object.values(FRAME_TOKENS);
    expect(new Set(values).size).toBe(values.length);
    for (const v of values) expect(parseHex(v), `${v} 不是合法颜色`).not.toBeNull();
  });

  it("深浅关系对：框角描边比框面深，内衬白边最亮", () => {
    expect(luma(FRAME_TOKENS.frameWoodDark)).toBeLessThan(luma(FRAME_TOKENS.frameWood));
    expect(luma(FRAME_TOKENS.matteWhite)).toBeGreaterThan(luma(FRAME_TOKENS.frameWood));
    expect(luma(FRAME_TOKENS.matteWhite)).toBeGreaterThan(luma(FRAME_TOKENS.deskWood));
  });

  it("框宽 8px、内衬 4px 的口径与规格一致，CSS 里真用上了", () => {
    expect(FRAME_BORDER_PX).toBe(8);
    expect(MATTE_PX).toBe(4);
    const css = woodFrameCss("fdf");
    expect(css).toContain(`border:${FRAME_BORDER_PX}px solid transparent`);
    expect(css).toContain(`inset 0 0 0 ${MATTE_PX}px ${FRAME_TOKENS.matteWhite}`);
  });
});

describe("art-kit · 画框与挂牌 CSS", () => {
  it("画框类挂在调用方自己的前缀下，两色木纹与白内衬都在", () => {
    const css = woodFrameCss("fdf");
    expect(css).toContain(".fdf-framed{");
    expect(css).toContain(FRAME_TOKENS.frameWood);
    expect(css).toContain(FRAME_TOKENS.frameWoodDark);
    expect(css).toContain("repeating-linear-gradient(45deg");
  });

  it("前缀会被清洗：注入怪字符不会写坏选择器，空前缀落回 kit", () => {
    expect(woodFrameCss("fdf{evil")).toContain(".fdfevil-framed{");
    expect(woodFrameCss("")).toContain(".kit-framed{");
    expect(plaqueCss("x!y")).toContain(".xy-plaque{");
  });

  it("45° 斜接角线画在 ::before 装饰层上，四个角各一条，且不挡点击", () => {
    const css = woodFrameCss("fdf");
    const before = css.slice(css.indexOf(".fdf-framed::before{"));
    expect(before).toContain("pointer-events:none");
    expect(before.match(/no-repeat/g) ?? []).toHaveLength(4);
    for (const angle of ["135deg", "225deg", "45deg", "315deg"]) expect(before).toContain(`linear-gradient(${angle}`);
  });

  it("画框只加相框皮肤：不写 padding / margin / width，不碰被装裱内容的盒模型", () => {
    const css = woodFrameCss("fdf");
    expect(css).not.toMatch(/[;{]padding:/);
    expect(css).not.toMatch(/[;{]margin:/);
    expect(css).not.toMatch(/[;{]width:/);
  });

  it("挂牌是圆角牌 + 两个钉点，钉点用 radial-gradient 画、不加子节点", () => {
    const css = plaqueCss("fdf");
    expect(css).toContain(".fdf-plaque{");
    expect(css.match(/radial-gradient\(circle at/g) ?? []).toHaveLength(2);
    expect(css).toContain(`border:2px solid ${FRAME_TOKENS.frameWoodDark}`);
  });
});

describe("art-kit · 麻绳中缝 SVG", () => {
  const base = { w: 200, h: 18, rope: "#b08d57", pin: "#c98d54" };

  it("默认两个小别针，个数可调且夹在 0–4", () => {
    expect(ropeSVG(base).match(/kit-rope-pin/g) ?? []).toHaveLength(2);
    expect(ropeSVG({ ...base, pins: 3 }).match(/kit-rope-pin/g) ?? []).toHaveLength(3);
    expect(ropeSVG({ ...base, pins: 99 }).match(/kit-rope-pin/g) ?? []).toHaveLength(4);
    expect(ropeSVG({ ...base, pins: -2 })).not.toContain("kit-rope-pin");
    expect(ropeSVG({ ...base, pins: 0 })).not.toContain("kit-rope-pin");
  });

  it("绳子真的往下垂：贝塞尔控制点的 y 比两端低", () => {
    const svg = ropeSVG(base);
    const m = /M1 ([\d.]+) Q [\d.]+ ([\d.]+)/.exec(svg)!;
    expect(Number(m[2])).toBeGreaterThan(Number(m[1]));
    expect(svg).toContain("stroke-dasharray");
  });

  it("画布最小 24×8，喂再小的数也不会画出负坐标", () => {
    const svg = ropeSVG({ ...base, w: 2, h: 1 });
    expect(svg).toContain('viewBox="0 0 24 8"');
    expect(svg).not.toContain('="-');
  });
});

describe("art-kit · 放大镜 SVG", () => {
  const mag = magnifierSVG({ rim: "#96622f", handle: "#c98d54", className: "fdf-mag-ic" });

  it("镜框描边 3、斜柄圆头描边 6、镜片高光弧两条——规格逐条落地", () => {
    expect(mag).toContain('stroke="#96622f" stroke-width="3"');
    expect(mag).toContain('stroke-width="6" stroke-linecap="round"');
    expect(mag.match(/<path /g) ?? []).toHaveLength(2);
  });

  it("附加 class 拼在 kit-mag 后面，镜片默认半透明能透出底下的画面", () => {
    expect(mag).toContain('class="kit-mag fdf-mag-ic"');
    expect(mag).toContain("rgba(255,255,255,.34)");
    expect(magnifierSVG({ rim: "#000", handle: "#111" })).toContain('class="kit-mag"');
  });

  it("红线：全部输出无位图、无外链、无 img 标签，且同参调用两次逐字一致", () => {
    const rope = { w: 200, h: 18, rope: "#b08d57", pin: "#c98d54" };
    const all = [woodFrameCss("fdf"), plaqueCss("fdf"), ropeSVG(rope), mag].join("\n");
    expect(all).not.toMatch(/\.(png|jpg|jpeg|gif|webp|mp3|wav)/i);
    expect(all).not.toMatch(/https?:/);
    expect(all).not.toMatch(/<img\b/i);
    expect(ropeSVG(rope)).toBe(ropeSVG({ ...rope }));
    expect(woodFrameCss("fdf")).toBe(woodFrameCss("fdf"));
  });
});
