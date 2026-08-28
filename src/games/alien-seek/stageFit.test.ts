/**
 * 寻找外星朋友 · D-pad 两档被裁(三人组 r4 playbook C-6)。
 *
 * 实测:360×640 裁 229、D-pad 折叠线下;915×412 裁 608 / canvas 出屏 209,
 * 加减缩放与望远镜排也够不着。修法:syncSize 里量舞台可视余量
 * (stageClipBottom 减画布下方家当),超了就把 cssW 等比收窄——
 * 场景坐标 SCENE_W×SCENE_H 与点击换算(走 getBoundingClientRect)零改动。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const SYNC = SRC.slice(SRC.indexOf("function syncSize()"), SRC.indexOf("function settle("));

describe("寻找外星朋友 · 画布按可视余量收(C-6)", () => {
  it("syncSize 接了舞台余量口径,超高就等比收 cssW", () => {
    // r5:进关还要滚回顶(选关图自动滚到当前关会留残余滚动),多带一个 resetStageScroll
    expect(SRC).toContain(
      'import { MIN_CANVAS_DISPLAY_PX, rectBottom, resetStageScroll, stageClipBottom } from "../stageFit";'
    );
    expect(SYNC).toContain("stageClipBottom(wrap)");
    expect(SYNC).toContain("Math.floor(maxH / (SCENE_H / SCENE_W))");
  });

  it("显示宽定死并居中,收窄后不被 width:100% 拉变形", () => {
    expect(SYNC).toContain("canvas.style.width = `${cssW}px`;");
    expect(SRC).toMatch(/\.as-canvas\{[^}]*margin:0 auto/);
  });

  it("转屏重量、destroy 摘监听", () => {
    expect(SRC).toContain('window.addEventListener("resize", syncSize);');
    expect(SRC).toContain('window.removeEventListener("resize", syncSize);');
    expect(SRC).toContain("clearTimeout(sizeTimer);");
  });

  it("场景坐标没被顺手动:SCENE_W/SCENE_H 仍从 logic 导入", () => {
    expect(SRC).toMatch(/SCENE_H,\s*\n\s*SCENE_W,/);
  });
});
