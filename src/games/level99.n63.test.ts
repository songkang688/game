/**
 * N-63(trio-r8)· 矮横屏 l99 地图钳高的守门。
 *
 * 病根:游戏侧模式条(bowling「双人对战/人机/无尽格」这类)排在 l99 地图上方、
 * 同在一个滚动盒里;`showMap(true)` 聚焦当前关时 `scrollIntoView({block:"center"})`
 * 把每层可滚祖先都对中——r14 实测 915×412 bowling 舞台 scrollTop 252、
 * `.bl-open` 三钮 top −174 整排出顶。四处 showMap(true) 一个没动(N-39 主修保持)。
 * 修法:矮横屏把 `.l99-map` 钳到可视余量内自己滚,聚焦改在图内手动居中,
 * 外层滚动盒不动——模式条稳在顶,当前关也仍在屏。
 * 浏览器复证 915×412:bowling 舞台 scrollTop 0、「⚔️ 双人对战」top 200 不滚可点,
 * 当前关节点在屏;hop-pads `.l99-node-cur` 仍在屏;390×844 / 1024×768 不钳、原样。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAP_CLAMP_MIN_PX, mapClampPx } from "./level99";

const SRC = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

describe("level99 · 矮横屏地图钳高(N-63)", () => {
  it("mapClampPx:正常余量取整,扣掉呼吸位", () => {
    // 裁切线 400、图顶 78、默认 8px 呼吸位 → 314
    expect(mapClampPx(400, 78)).toBe(314);
    expect(mapClampPx(400, 78, 0)).toBe(322);
  });

  it("量不到 / 余量矮过下限一律 null=不钳,照旧走 scrollIntoView 老路", () => {
    expect(mapClampPx(Number.POSITIVE_INFINITY, 78)).toBeNull();
    expect(mapClampPx(Number.NaN, 78)).toBeNull();
    expect(mapClampPx(400, Number.NaN)).toBeNull();
    expect(mapClampPx(0, 0)).toBeNull();
    // 恰好差 1px 就不钳:钳成一条缝不如让整页滚
    expect(mapClampPx(MAP_CLAMP_MIN_PX + 7, 0)).toBeNull();
    expect(mapClampPx(MAP_CLAMP_MIN_PX + 8, 0)).toBe(MAP_CLAMP_MIN_PX);
  });

  it("接线:只在矮横屏钳;钳上时图内手动居中,不钳时仍走 block:center", () => {
    expect(SRC).toContain('win?.matchMedia?.("(max-height:500px)").matches');
    expect(SRC).toContain("mapClampPx(mapClipBottomPx(map), map.getBoundingClientRect().top)");
    expect(SRC).toContain('map.classList.add("l99-map-clamp");');
    // 钳态:在图自己的滚动盒里居中
    expect(SRC).toContain("map.scrollTop += Math.round(nr.top + nr.height / 2 - (mr.top + mr.height / 2));");
    // 非钳态老路一字不动(N-39 主修 & r10 守门都认这行)
    expect(SRC).toContain('cur.scrollIntoView?.({ block: "center" })');
  });

  it("showMap(true) 四处保持(N-39 勿回滚)", () => {
    const times = SRC.match(/showMap\(true\)/g) ?? [];
    expect(times.length).toBeGreaterThanOrEqual(4);
  });
});
