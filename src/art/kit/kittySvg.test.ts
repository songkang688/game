import { describe, expect, it } from "vitest";
import {
  CALICO_PATCH,
  KITTY_COLORS,
  KITTY_FURS,
  KITTY_JUMP_PX,
  KITTY_PINK,
  KITTY_SHADOW_RX,
  KITTY_STATES,
  kitty,
  type KittyFur,
  type KittyState
} from "./kittySvg";

describe("art-kit · 参数化三态小猫", () => {
  it("输出是完整 svg，不含脚本、不含 NaN，三态九张全画得出来", () => {
    for (const st of KITTY_STATES) {
      for (const fu of KITTY_FURS) {
        const svg = kitty(st, fu, 120);
        expect(svg.startsWith("<svg ")).toBe(true);
        expect(svg.endsWith("</svg>")).toBe(true);
        expect(svg).toContain('aria-hidden="true"');
        expect(svg.toLowerCase()).not.toContain("<script");
        expect(svg).not.toContain("NaN");
        expect(svg).toContain(`data-state="${st}"`);
        expect(svg).toContain(`data-fur="${fu}"`);
      }
    }
  });

  it("纯函数：同参数输出逐字节一致（三花斑位固定两套，绝不闪变）", () => {
    for (const v of [0, 1]) {
      const a = kitty("caring", "calico", 116, { variant: v });
      const b = kitty("caring", "calico", 116, { variant: v });
      expect(a).toBe(b);
    }
    // 两套斑位彼此不同，越界的 variant 取模落回既有两套
    const v0 = kitty("caring", "calico", 116, { variant: 0 });
    const v1 = kitty("caring", "calico", 116, { variant: 1 });
    expect(v0).not.toBe(v1);
    expect(kitty("caring", "calico", 116, { variant: 2 })).toBe(v0);
    expect(kitty("caring", "calico", 116, { variant: -1 })).toBe(v1);
    expect(kitty("caring", "calico", 116, { variant: Number.NaN })).toBe(v0);
  });

  it("三种毛色的花纹层两两不同：橘背纹三条、灰尾环两圈、三花两块斑", () => {
    const orange = kitty("caring", "orange", 120);
    const gray = kitty("caring", "gray", 120);
    const calico = kitty("caring", "calico", 120);
    // 橘：背上三条弧（stroke-width 5 的那组）
    expect([...orange.matchAll(/M(?:46 68|58 65|70 68) q/g)].length).toBe(3);
    expect(gray).not.toContain("M58 65");
    // 灰：尾环两圈
    expect([...gray.matchAll(/M(?:100 82|97 68) q/g)].length).toBe(2);
    expect(orange).not.toContain("M100 82");
    // 三花：一块暖斑 + 一块深斑
    expect(calico).toContain(CALICO_PATCH.warm);
    expect(calico).toContain(CALICO_PATCH.dark);
    expect(orange).not.toContain(CALICO_PATCH.dark);
    expect(gray).not.toContain(CALICO_PATCH.dark);
    const bodies = new Set([orange, gray, calico]);
    expect(bodies.size).toBe(3);
  });

  it("三态节点互斥：旋涡只在 sick、摆尾类只在 caring、爱心只在 cured", () => {
    const byState = (st: KittyState): string => kitty(st, "orange", 120, { prefix: "ktc" });
    const sick = byState("sick");
    const caring = byState("caring");
    const cured = byState("cured");
    expect(sick).toContain("ktc-kitty-swirl");
    expect(caring).not.toContain("ktc-kitty-swirl");
    expect(cured).not.toContain("ktc-kitty-swirl");
    expect(caring).toContain("ktc-kitty-sway");
    expect(sick).not.toContain("ktc-kitty-sway");
    expect(cured).not.toContain("ktc-kitty-sway");
    expect(cured).toContain("ktc-kitty-heart");
    expect(sick).not.toContain("ktc-kitty-heart");
    expect(caring).not.toContain("ktc-kitty-heart");
  });

  it("sick 耳朵耷拉 25° 眼睑半闭；caring 眼睛全开带双高光", () => {
    const sick = kitty("sick", "gray", 120);
    expect(sick).toContain('rotate(-25 46 30)');
    expect(sick).toContain('rotate(25 74 30)');
    expect(sick).toContain("M44 45 q5.5 4.5 11 0");
    const caring = kitty("caring", "gray", 120);
    expect(caring).not.toContain("rotate(-25");
    expect(caring).toContain('cx="49.5" cy="44" r="5.2"');
    expect([...caring.matchAll(/fill="#ffffff"/g)].length).toBe(4);
  });

  it("cured 跳起 6px、四爪抬高、弯月眼，投影缩小 20%", () => {
    const cured = kitty("cured", "orange", 120);
    expect(cured).toContain(`translate(0 ${-KITTY_JUMP_PX})`);
    expect(cured).toContain('cy="104"');
    expect(cured).toContain("q5.5 -6.5 11 0");
    expect(cured).toContain(`rx="${KITTY_SHADOW_RX * 0.8}"`);
    const sick = kitty("sick", "orange", 120);
    expect(sick).toContain("translate(0 0)");
    expect(sick).toContain(`rx="${KITTY_SHADOW_RX}"`);
    expect(sick).toContain('cy="108"');
  });

  it("统一 2px 深毛色描边 + 每侧三根 1px 短须 + 内耳粉与鼻头粉", () => {
    const svg = kitty("caring", "orange", 120);
    expect([...svg.matchAll(/stroke-width="2"/g)].length).toBeGreaterThanOrEqual(5);
    expect(svg).toContain('stroke-width="1"');
    const whiskers = svg.slice(svg.indexOf("-kitty-whiskers"));
    expect([...whiskers.slice(0, whiskers.indexOf("</g>")).matchAll(/<path /g)].length).toBe(6);
    expect(svg).toContain(KITTY_PINK.ear);
    expect(svg).toContain(KITTY_PINK.nose);
  });

  it("毛色 token 与规格 4.1 一致，且三种 coat 互不相同", () => {
    expect(KITTY_COLORS.orange).toEqual({ coat: "#f4a259", deep: "#d1813a" });
    expect(KITTY_COLORS.gray).toEqual({ coat: "#b8bdc9", deep: "#8d94a5" });
    expect(KITTY_COLORS.calico.coat).toBe("#fff8f0");
    const coats = new Set(Object.values(KITTY_COLORS).map((c) => c.coat));
    expect(coats.size).toBe(3);
    for (const fu of KITTY_FURS) {
      expect(kitty("sick", fu, 120)).toContain(KITTY_COLORS[fu].coat);
    }
  });

  it("尺寸参数落在宽高上；乱传尺寸与认不得的态一律安静兜底", () => {
    expect(kitty("sick", "orange", 96)).toContain('width="96" height="96"');
    expect(kitty("sick", "orange", Number.NaN)).toContain('width="120"');
    expect(kitty("sick", "orange", -5)).toContain('width="120"');
    expect(kitty("sick", "orange", 9999)).toContain('width="480"');
    expect(kitty("wet" as KittyState, "orange", 120)).toContain('data-state="sick"');
    expect(kitty("sick", "dots" as KittyFur, 120)).toContain('data-fur="orange"');
  });

  it("prefix 换成调用方自己的样式前缀，非法字符剥掉，渐变 id 跟着走", () => {
    const svg = kitty("caring", "gray", 120, { prefix: "ktc" });
    expect(svg).toContain('class="ktc-kitty-svg"');
    expect(svg).toContain("ktcKittyCoat-gray-caring");
    expect(svg).not.toContain("kit-kitty");
    const weird = kitty("caring", "gray", 120, { prefix: 'x"><bad' });
    expect(weird).toContain('class="xbad-kitty-svg"');
    expect(kitty("caring", "gray", 120, { prefix: "" })).toContain('class="kit-kitty-svg"');
  });

  it("换态只换该换的：同毛色下 sick 与 caring 的身体轮廓路径一致", () => {
    const paths = (s: string): string[] =>
      [...s.matchAll(/<ellipse cx="60" cy="88" [^>]+>/g)].map((m) => m[0].replace(/url\(#[^)]+\)/g, "url(#@)"));
    expect(paths(kitty("sick", "orange", 120))).toEqual(paths(kitty("caring", "orange", 120)));
  });
});
