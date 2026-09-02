/**
 * 1.3 窗口 6 · A 档 · 第 1 轮视觉测试员 · 机器化扫描用例(box-hamster)。
 * 只读断言;问题清单见 docs/qa/1.3-window6-round1-tester.md。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BH_HAMSTER_STYLES, bhHamsterSvg, boxSvg, giftSvg } from "./visual";

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

describe("窗口6 r1 视觉扫描 · box-hamster", () => {
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

  it("emoji 直出登记:非测试源码含 emoji 的行数只减不增(当前登记 32)", () => {
    const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    let n = 0;
    for (const [, src] of nonTestSources()) for (const l of src.split("\n")) if (re.test(l)) n++;
    expect(n).toBeLessThanOrEqual(32);
  });

  it("prefers-reduced-motion 有接线", () => {
    const all = nonTestSources().map(([, s]) => s).join("\n");
    expect(all).toMatch(/prefers-reduced-motion/);
  });

  it("两只仓鼠 SVG 两两不同:耳形 + 皮毛双通道", () => {
    expect(BH_HAMSTER_STYLES.length).toBeGreaterThanOrEqual(2);
    expect(BH_HAMSTER_STYLES[0].ear).not.toBe(BH_HAMSTER_STYLES[1].ear);
    expect(BH_HAMSTER_STYLES[0].fur).not.toBe(BH_HAMSTER_STYLES[1].fur);
    const a = bhHamsterSvg(0, 2, "idle");
    const b = bhHamsterSvg(1, 2, "idle");
    expect(a).toContain("<linearGradient");
    expect(a).not.toBe(b);
  });

  it("木箱 / 礼物盒是 2.5D 双面画法(顶亮侧暗),不是平涂方块", () => {
    const box = boxSvg();
    const gift = giftSvg(false);
    expect(box).toContain("<svg");
    expect(gift).toContain("<svg");
    expect(box).not.toBe(gift);
    const vis = readFileSync(join(DIR, "visual.ts"), "utf8");
    expect(vis).toMatch(/SIDE_SHADE\s*=\s*-22/);
  });
});
