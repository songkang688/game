/**
 * 1.3 窗口 6 · A 档 · 第 1 轮视觉测试员 · 机器化扫描用例(balloon-pop)。
 * 只读断言;问题清单见 docs/qa/1.3-window6-round1-tester.md。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { balloonSkinLayers } from "../../art/kit/balloonSkin";
import { colorSkin, stringSvg } from "./visual";

const DIR = __dirname;

function nonTestSources(): Array<[string, string]> {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => [f, readFileSync(join(DIR, f), "utf8")]);
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const TRADEMARKS = [/4399/i, /任天堂/, /nintendo/i, /迪士尼/, /disney/i, /马里奥/, /mario\b/i, /皮卡丘/, /pikachu/i, /宝可梦/, /pokemon/i, /hello\s*kitty/i, /托马斯/, /bomberman/i, /米老鼠/, /mickey/i, /奥特曼/, /索尼克/, /sonic/i, /塞尔达/, /zelda/i, /kirby/i, /tetris/i];
const REDLINES = [/流血/, /鲜血/, /血液/, /杀死/, /尸体/, /广告位/, /内购/, /充值/];

describe("窗口6 r1 视觉扫描 · balloon-pop", () => {
  it("商标黑名单 0 命中", () => {
    for (const [f, src] of nonTestSources()) {
      for (const re of TRADEMARKS) expect(src, `${f} 命中 ${re}`).not.toMatch(re);
    }
  });

  it("分级红线词 0 命中(剥离注释)", () => {
    for (const [f, src] of nonTestSources()) {
      const code = stripComments(src);
      for (const re of REDLINES) expect(code, `${f} 命中 ${re}`).not.toMatch(re);
    }
  });

  it("emoji 直出登记:非测试源码含 emoji 的行数只减不增(当前登记 60)", () => {
    const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    let n = 0;
    for (const [, src] of nonTestSources()) for (const l of src.split("\n")) if (re.test(l)) n++;
    expect(n).toBeLessThanOrEqual(60);
  });

  it("prefers-reduced-motion 有接线", () => {
    const all = nonTestSources().map(([, s]) => s).join("\n");
    expect(all).toMatch(/prefers-reduced-motion/);
    expect(all).toMatch(/matchMedia/);
  });

  it("气球不是平涂圆:三层皮肤 = 左上主高光 + 右下弱反光 + 主体明暗", () => {
    const layers = balloonSkinLayers("#FF9EC8");
    expect(layers.length).toBe(3);
    expect(layers[0]).toContain("rgba(255,255,255,.85)");
    expect(layers[0]).toMatch(/circle at 28% 22%/);
    expect(layers[2]).toMatch(/radial-gradient/);
    // 每个色号的皮肤都是三层叠加
    expect(colorSkin(0).split("radial-gradient").length - 1).toBe(3);
  });

  it("气球结 + 贝塞尔气球线在(不是光秃秃一个圆)", () => {
    expect(stringSvg(0)).toContain("<svg");
    const idx = readFileSync(join(DIR, "index.ts"), "utf8");
    expect(idx).toMatch(/blp-knot/);
  });
});
