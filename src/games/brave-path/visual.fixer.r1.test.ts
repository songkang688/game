/**
 * 1.3 窗口 6 · C 档 · 第 1 轮监督修复员 · W6R1-03 修复钉子(brave-path)。
 * 迷宫拾取物(钥匙/门/锁/终点)从 emoji 直出换成与勇者/影子同族的徽章式 SVG,
 * 这里把「不再含 emoji、同族规格(落影 + 1.5px 描边 + 左上高光)」钉死,防回退。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mazeCellView, mazeItemSvg, type MazeCellState } from "./visual";

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const ITEMS = ["key", "door", "lock", "exit"] as const;

function cell(item: MazeCellState["item"]): MazeCellState {
  return { wall: false, been: false, seen: true, isMe: false, isGhost: false, nearMe: false, item };
}

describe("窗口6 r1 fixer · W6R1-03 迷宫拾取物徽章化", () => {
  it("四种拾取物都是 SVG,不再有任何 emoji 直出", () => {
    for (const item of ITEMS) {
      const html = mazeCellView(cell(item)).html;
      expect(html, item).toContain("<svg");
      expect(html, item).toContain(`bvp-it-${item}`);
      expect(EMOJI_RE.test(html), `${item} 仍含 emoji`).toBe(false);
    }
  });

  it("拾取物 SVG 两两不同(剪影可分)", () => {
    expect(new Set(ITEMS.map((i) => mazeItemSvg(i))).size).toBe(ITEMS.length);
  });

  it("同族规格:底部落影椭圆 + 1.5px 描边 + 左上高光(白色高光弧)", () => {
    for (const item of ITEMS) {
      const svg = mazeItemSvg(item);
      expect(svg, item).toMatch(/<ellipse[^>]*cy="56"/);
      expect(svg, item).toContain('stroke-width="1.5"');
      expect(svg, item).toMatch(/rgba\(255,255,255,\.\d+\)/);
    }
  });

  it("视觉 ts 源码里不再有 🔑🚪🔒🏁 字面量;格子 CSS 给 SVG 定了尺寸", () => {
    const vis = readFileSync(fileURLToPath(new URL("./visual.ts", import.meta.url)), "utf8");
    for (const g of ["🔑", "🚪", "🔒", "🏁"]) expect(vis).not.toContain(g);
    const idx = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    expect(idx).toMatch(/\.bvp-mz-it svg\{width:100%;height:100%/);
  });

  it("迷雾剪影通道保留:.bvp-mz-fog 下拾取物走 brightness(0) 滤镜", () => {
    const idx = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    expect(idx).toMatch(/\.bvp-mz-fog \.bvp-mz-it\{filter:brightness\(0\)/);
  });
});
