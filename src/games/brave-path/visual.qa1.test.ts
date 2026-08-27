/**
 * 1.3 窗口 6 · A 档 · 第 1 轮视觉测试员 · 机器化扫描用例(brave-path)。
 * 只读断言:商标 / 红线 / emoji 直出登记 / reduced 接线 / 2.5D 厚度 / 徽章接线。
 * 发现的问题不在这里修——问题清单见 docs/qa/1.3-window6-round1-tester.md。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { badge } from "../../art/kit/badge";
import { mazeCellView } from "./visual";

const DIR = __dirname;

function nonTestSources(): Array<[string, string]> {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => [f, readFileSync(join(DIR, f), "utf8")]);
}

// 去掉行注释与块注释,只扫真正会出现在产品里的文案与代码
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const TRADEMARKS = [/4399/i, /任天堂/, /nintendo/i, /迪士尼/, /disney/i, /马里奥/, /mario/i, /皮卡丘/, /pikachu/i, /宝可梦/, /pokemon/i, /hello\s*kitty/i, /托马斯/, /bomberman/i, /炸弹人/, /米老鼠/, /mickey/i, /奥特曼/, /ultraman/i, /索尼克/, /sonic/i, /塞尔达/, /zelda/i, /kirby/i, /tetris/i];
const REDLINES = [/流血/, /鲜血/, /血液/, /杀死/, /尸体/, /广告位/, /内购/, /充值/];

describe("窗口6 r1 视觉扫描 · brave-path", () => {
  it("商标黑名单 0 命中(非测试源码,含注释)", () => {
    for (const [f, src] of nonTestSources()) {
      for (const re of TRADEMARKS) expect(src, `${f} 命中 ${re}`).not.toMatch(re);
    }
  });

  it("分级红线词 0 命中(剥离注释后)", () => {
    for (const [f, src] of nonTestSources()) {
      const code = stripComments(src);
      for (const re of REDLINES) expect(code, `${f} 命中 ${re}`).not.toMatch(re);
    }
  });

  it("emoji 直出登记:非测试源码含 emoji 的行数只减不增(当前登记 171)", () => {
    const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    let n = 0;
    for (const [, src] of nonTestSources()) for (const l of src.split("\n")) if (re.test(l)) n++;
    expect(n).toBeLessThanOrEqual(171);
  });

  it("prefers-reduced-motion 有接线", () => {
    const all = nonTestSources().map(([, s]) => s).join("\n");
    expect(all).toMatch(/prefers-reduced-motion/);
  });

  it("迷宫格保留 2.5D 底边厚度(inset 0 -4px)与迷雾层", () => {
    const idx = readFileSync(join(DIR, "index.ts"), "utf8");
    expect(idx).toMatch(/\.bvp-mz\{[^}]*inset 0 -4px 0/);
    expect(idx).toMatch(/\.bvp-mz-wall\{[^}]*inset 0 -4px 0/);
    expect(idx).toMatch(/bvp-mz-fog/);
  });

  it("迷宫勇者/影子是徽章 SVG 而不是 emoji", () => {
    const me = mazeCellView({ wall: false, seen: true, been: false, nearMe: false, isMe: true, isGhost: false, item: "" });
    const ghost = mazeCellView({ wall: false, seen: true, been: false, nearMe: false, isMe: false, isGhost: true, item: "" });
    expect(me.html).toContain("<svg");
    expect(ghost.html).toContain("<svg");
    expect(me.html).not.toBe(ghost.html);
  });

  it("徽章底座有落影 + 1.5px 描边 + 3px 色环(kit 扫描)", () => {
    const svg = badge("flower", { camp: "hero" });
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).toContain('stroke-width="3"');
    expect(svg).toMatch(/<ellipse[^>]*cy="58"/);
  });
});
