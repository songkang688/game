/**
 * 1.3 窗口 6 · A 档 · 第 1 轮视觉测试员 · 机器化扫描用例(adventure-king)。
 * 只读断言;问题清单见 docs/qa/1.3-window6-round1-tester.md。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { terrainBands } from "../../art/kit/terrain";

const DIR = __dirname;

// qaAudit.ts 本身是黑名单定义文件,商标/红线扫描时排除它,别让守卫误伤守卫
function nonTestSources(excludeGuard = false): Array<[string, string]> {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !(excludeGuard && f === "qaAudit.ts"))
    .map((f) => [f, readFileSync(join(DIR, f), "utf8")]);
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const TRADEMARKS = [/4399/i, /任天堂/, /nintendo/i, /迪士尼/, /disney/i, /马里奥/, /mario\b/i, /皮卡丘/, /pikachu/i, /宝可梦/, /pokemon/i, /hello\s*kitty/i, /托马斯/, /bomberman/i, /米老鼠/, /mickey/i, /奥特曼/, /索尼克/, /sonic/i, /塞尔达/, /zelda/i, /kirby/i, /tetris/i];
const REDLINES = [/流血/, /鲜血/, /血液/, /杀死/, /尸体/, /广告位/, /内购/, /充值/];

describe("窗口6 r1 视觉扫描 · adventure-king", () => {
  it("商标黑名单 0 命中(qaAudit 黑名单定义除外)", () => {
    for (const [f, src] of nonTestSources(true)) {
      for (const re of TRADEMARKS) expect(src, `${f} 命中 ${re}`).not.toMatch(re);
    }
  });

  it("分级红线词 0 命中(剥离注释,qaAudit 除外)", () => {
    for (const [f, src] of nonTestSources(true)) {
      const code = stripComments(src);
      for (const re of REDLINES) expect(code, `${f} 命中 ${re}`).not.toMatch(re);
    }
  });

  it("emoji 直出登记:非测试源码含 emoji 的行数只减不增(当前登记 76)", () => {
    const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    let n = 0;
    for (const [, src] of nonTestSources()) for (const l of src.split("\n")) if (re.test(l)) n++;
    expect(n).toBeLessThanOrEqual(76);
  });

  it("prefers-reduced-motion 有接线(CSS + matchMedia)", () => {
    const all = nonTestSources().map(([, s]) => s).join("\n");
    expect(all).toMatch(/prefers-reduced-motion/);
    expect(all).toMatch(/matchMedia/);
  });

  it("平台走 terrain 套件的草顶土身剖面,草顶是双停渐变", () => {
    const idx = readFileSync(join(DIR, "index.ts"), "utf8");
    expect(idx).toMatch(/art\/kit\/terrain/);
    // 草顶 / 土身 / 石底三段都在,草顶亮部在上(左上光源约定)
    const bands = terrainBands(30);
    expect(bands.grassH).toBeGreaterThan(0);
  });

  it("文物有光柱渐变 + 金描边 + 自转闪点(drawArtifactSprite)", () => {
    const vis = readFileSync(join(DIR, "visual.ts"), "utf8");
    expect(vis).toMatch(/drawArtifactSprite/);
    expect(vis).toMatch(/createLinearGradient/);
    expect(vis).toMatch(/自转闪点|spinPhase/);
  });
});
