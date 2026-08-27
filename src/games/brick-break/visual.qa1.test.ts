/**
 * 1.3 窗口 6 · A 档 · 第 1 轮视觉测试员 · 机器化扫描用例(brick-break)。
 * 只读断言;问题清单见 docs/qa/1.3-window6-round1-tester.md。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CANDY_OUTLINE_PX, candyColors } from "../../art/kit/candyBrick";

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

describe("窗口6 r1 视觉扫描 · brick-break", () => {
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

  it("emoji 直出登记:非测试源码含 emoji 的行数只减不增(当前登记 35)", () => {
    const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    let n = 0;
    for (const [, src] of nonTestSources()) for (const l of src.split("\n")) if (re.test(l)) n++;
    expect(n).toBeLessThanOrEqual(35);
  });

  it("prefers-reduced-motion 有接线", () => {
    const all = nonTestSources().map(([, s]) => s).join("\n");
    expect(all).toMatch(/prefers-reduced-motion/);
  });

  it("砖走 candyBrick 果冻三层:亮带/主体/暗边三停色阶两两不同,描边 1.5px", () => {
    const c = candyColors("#FF9EC8");
    expect(new Set([c.lit, c.body, c.dark]).size).toBe(3);
    expect(CANDY_OUTLINE_PX).toBeGreaterThanOrEqual(1.5);
    expect(CANDY_OUTLINE_PX).toBeLessThanOrEqual(2);
  });

  it("球与挡板有 ≥3 停渐变(白高光 → 亮 → 暗)", () => {
    const idx = readFileSync(join(DIR, "index.ts"), "utf8");
    expect(idx).toMatch(/createRadialGradient/);
    expect(idx).toMatch(/addColorStop\(0, "#FFFFFF"\)/);
    expect(idx).toMatch(/createLinearGradient\(0, py/);
  });
});
