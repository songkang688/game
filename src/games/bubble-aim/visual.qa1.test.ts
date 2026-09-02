/**
 * 1.3 窗口 6 · A 档 · 第 1 轮视觉测试员 · 机器化扫描用例(bubble-aim)。
 * 只读断言;问题清单见 docs/qa/1.3-window6-round1-tester.md。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filmColor, paintFilm } from "../../art/kit/film";

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

describe("窗口6 r1 视觉扫描 · bubble-aim", () => {
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

  it("emoji 直出登记:非测试源码含 emoji 的行数只减不增(当前登记 42)", () => {
    const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    let n = 0;
    for (const [, src] of nonTestSources()) for (const l of src.split("\n")) if (re.test(l)) n++;
    expect(n).toBeLessThanOrEqual(42);
  });

  it("prefers-reduced-motion 有接线", () => {
    const all = nonTestSources().map(([, s]) => s).join("\n");
    expect(all).toMatch(/prefers-reduced-motion/);
  });

  it("泡泡本体是 3 停径向渐变 + 薄膜描边 + 底部月牙", () => {
    const vis = readFileSync(join(DIR, "visual.ts"), "utf8");
    expect(vis).toMatch(/createRadialGradient/);
    expect(vis).toMatch(/addColorStop\(0, "#FFFFFF"\)/);
    expect(vis).toMatch(/paintFilm/);
    expect(vis).toMatch(/paintBottomCrescent/);
  });

  it("薄膜描边是同色系色相偏移(不是随便糊一个白圈),小半径自动省略", () => {
    expect(filmColor("#8FCBFF")).not.toBe("#8FCBFF");
    const calls: string[] = [];
    const stub = {
      globalAlpha: 1,
      strokeStyle: "" as string,
      fillStyle: "" as string,
      lineWidth: 0,
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      beginPath: () => calls.push("beginPath"),
      arc: () => calls.push("arc"),
      stroke: () => calls.push("stroke"),
      fill: () => calls.push("fill")
    };
    expect(paintFilm(stub, 0, 0, 4, "#8FCBFF")).toBe(false);
    expect(paintFilm(stub, 0, 0, 20, "#8FCBFF")).toBe(true);
    expect(calls).toContain("stroke");
  });
});
