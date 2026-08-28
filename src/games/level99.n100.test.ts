/**
 * N-100：tab 折行款进场,当前关 scrollIntoView 居中把「开始冒险 ▶」头行与
 * 🎯/📖/⏭️ 工具行卷出 915×412 视口(r18 六款 + r19 扩面 11 款,共 17 款)。
 * 修法只动 level99.ts 一处:矮横屏头行/工具行 sticky 钉 .l99-view 顶,
 * 进场滚距由 entryAnchorTop 钳到工具行下沿(只减不增)。
 * N-63 的 scrollIntoView({block:"center"}) 与四处 showMap(true) 一个不动。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { entryAnchorTop } from "./level99";

const SRC = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

function shortBlock(): string {
  const at = SRC.indexOf("@media (max-height:500px)");
  expect(at, "L99_CSS 应有 max-height:500px 档").toBeGreaterThanOrEqual(0);
  const next = SRC.indexOf("@media", at + 1);
  return SRC.slice(at, next > 0 ? next : undefined);
}

describe("N-100 level99 进场锚定", () => {
  it("矮横屏头行/工具行 sticky 钉在 .l99-view 顶(初见永远在屏)", () => {
    const block = shortBlock();
    expect(block).toMatch(/\.l99-map>\.l99-head\{position:sticky;top:0/);
    expect(block).toMatch(/\.l99-map>\.l99-tools\{position:sticky;top:50px/);
    // margin 换 padding,流内高度不变,390/1024(高>500px)走不进这档
    expect(block).toMatch(/\.l99-map>\.l99-head\{[^}]*padding-bottom:6px/);
    expect(block).toMatch(/\.l99-map>\.l99-tools\{[^}]*padding-bottom:8px/);
  });

  it("entryAnchorTop:当前关贴工具行下沿,只出非负滚距", () => {
    // word-garden 实测:节点内容顶 329、钉住两行 102 → 锚定 219(< 居中的 230)
    expect(entryAnchorTop(329, 102)).toBe(219);
    // 节点本来就在钉住两行下面:给 0,调用方 min() 后一个像素都不滚
    expect(entryAnchorTop(60, 102)).toBe(0);
    expect(entryAnchorTop(0, 0)).toBe(0);
    // 量不出来(单测桩 NaN)绝不抛,回 0 保持原样
    expect(entryAnchorTop(Number.NaN, 100)).toBe(0);
    expect(entryAnchorTop(100, Number.NaN)).toBe(0);
  });

  it("滚距只减不增:min(居中, 锚定),且只在 ≤500px 且真滚了才动", () => {
    expect(SRC).toContain("view.scrollTop = Math.min(view.scrollTop, entryAnchorTop(nodeContentTop, pinnedH))");
    expect(SRC).toMatch(/vh > 0 && vh <= 500/);
    expect(SRC).toMatch(/view\.scrollTop === "number" && view\.scrollTop > 0/);
  });

  it("N-63/N-39 契约不回退:居中滚动与 showMap(true) 原样", () => {
    expect(SRC).toContain('cur.scrollIntoView?.({ block: "center" })');
    expect([...SRC.matchAll(/showMap\(true\)/g)].length).toBeGreaterThanOrEqual(6);
    expect(SRC).toContain("stageEl.scrollTop = 0");
  });
});
