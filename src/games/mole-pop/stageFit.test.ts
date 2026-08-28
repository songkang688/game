/**
 * 地鼠嘭嘭 · 横屏地鼠洞不可达(三人组 r4 playbook C-5)。
 *
 * 实测:915×412 裁 550px,九洞有 6 个在折叠线下——限时打击类不能边玩边滚。
 * 修法(配方 B 之 3):洞是 aspect-ratio:1 方格 + 等 gap,盘面宽=盘面高,
 * 量出舞台可视余量后钳 .mp-board 的 max-width 即钳高;
 * 44px 热区红线兜底(3×44+2×12=156px);命中判定与谱面零改动。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const FIT = SRC.slice(SRC.indexOf("function fitBoard()"), SRC.indexOf("fitBoard();"));

describe("地鼠嘭嘭 · 盘面按可视余量收(C-5)", () => {
  it("fitBoard 走舞台余量口径,钳的是盘面宽", () => {
    expect(SRC).toContain('import { rectBottom, stageClipBottom } from "../stageFit";');
    expect(FIT).toContain("stageClipBottom(wrap)");
    expect(FIT).toContain("boardEl.style.maxWidth");
  });

  it("44px 热区红线兜底:钳到底也不小于 3 洞 + 两道 gap", () => {
    expect(FIT).toContain("const minSide = 3 * 44 + 2 * 12;");
    expect(FIT).toContain("Math.max(minSide, Math.floor(room))");
  });

  it("洞格几何没动:aspect-ratio:1 + min 56px 原样,盘面收窄后居中", () => {
    expect(SRC).toMatch(/\.mp-hole \{[^}]*aspect-ratio: 1/);
    expect(SRC).toMatch(/\.mp-board \{[^}]*margin-left: auto; margin-right: auto/);
  });

  it("resize 重量、destroy 摘监听,补量计时走 bag 不裸 setTimeout", () => {
    expect(SRC).toContain('window.addEventListener("resize", fitBoard);');
    expect(SRC).toContain('window.removeEventListener("resize", fitBoard);');
    expect(SRC).toContain("bag.after(fitBoard, 0);");
  });
});
