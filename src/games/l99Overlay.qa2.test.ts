/**
 * QA #2(ux99 wave1):l99 胜负弹层矮横屏适配。
 * 915×412 实测:.l99-wrap 钳到 276px 后,弹层内容(头像 104 + 星 34 + 标题 + 副标 + 按钮 48)
 * 竖向 ~330px,flex 居中溢出把「下一关/再玩一次/回地图」全部挤出视口,且居中态滚不到顶。
 * 修法:overflow-y:auto + justify-content:safe center 兜底,矮横屏内容收一档;
 * z-index 抬到 30,盖过游戏钉底的 fixed 工具条(麻将手牌 z 20),仍低于壳层 .overlay(50)。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./level99.ts", import.meta.url), "utf8");

function block(css: string, selector: string, from = 0): string {
  const at = css.indexOf(selector, from);
  expect(at, `找不到 ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf("}", at));
}

describe("QA2 · l99 胜负弹层矮横屏", () => {
  it("弹层可滚 + safe center 兜底,老浏览器回落普通 center", () => {
    const ov = block(src, ".l99-overlay{");
    expect(ov).toContain("overflow-y:auto");
    expect(ov).toContain("justify-content:center");
    expect(ov).toContain("justify-content:safe center");
  });

  it("弹层 z-index 盖过游戏钉底 fixed 条(≥30),仍低于壳层 overlay(50)", () => {
    const ov = block(src, ".l99-overlay{");
    const z = Number(/z-index:(\d+)/.exec(ov)?.[1]);
    expect(z).toBeGreaterThanOrEqual(30);
    expect(z).toBeLessThan(50);
  });

  it("矮横屏媒体块把头像/星星/标题收一档,让按钮进 276px 钳高盒", () => {
    const at = src.indexOf("@media (max-height:500px)");
    expect(at).toBeGreaterThanOrEqual(0);
    const shortBlock = src.slice(at, src.indexOf("@media (prefers-reduced-motion", at));
    expect(shortBlock).toContain(".l99-ov-buddy{width:64px;height:64px;}");
    expect(shortBlock).toContain(".l99-ov-title{font-size:19px;}");
  });
});
