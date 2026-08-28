/**
 * N-63：showMap(true) 聚焦当前关时，模式条不能被 .game-stage 卷出舞台顶。
 * 四处 showMap(true) 保持；N-39 scrollIntoView 保持。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { nodeCurFullyVisible } from "./level99";

const SRC = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

describe("N-63 l99 模式条不跟地图抢 game-stage 卷轴", () => {
  it("四处 showMap(true) 仍在（含初次进图）", () => {
    expect([...SRC.matchAll(/showMap\(true\)/g)].length).toBeGreaterThanOrEqual(6);
    expect(SRC).toMatch(/showMap\(true\);\s*\n\s*return \{/);
    expect(SRC).toMatch(/viewChapter = ci;\s*showMap\(\);/);
  });

  it("舞台挂 game-stage--l99，内部 l99-view 滚；聚焦后外层 scrollTop 拉回 0", () => {
    expect(SRC).toContain("game-stage--l99");
    expect(SRC).toContain("l99-host");
    expect(SRC).toContain("pinL99Host()");
    expect(SRC).toContain("unpinL99Host()");
    expect(SRC).toContain('cur.scrollIntoView?.({ block: "center" })');
    expect(SRC).toContain("stageEl.scrollTop = 0");
  });

  it("hop-pads 当前关尺子仍按整格在 412 内", () => {
    expect(nodeCurFullyVisible({ top: 201, bottom: 277 }, 412)).toBe(true);
    expect(nodeCurFullyVisible({ top: -174, bottom: -98 }, 412)).toBe(false);
  });
});
