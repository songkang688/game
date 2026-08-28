/**
 * W8R2-01 · 闯关「点点」贴纸化的钉子（窗口 8 第 2 轮监督修复员）。
 *
 * A 档报告：闯关模式核心操作对象 `.rbt-dot` 是裸 emoji 直出——10 章 SKINS 的
 * mine/trap（🔵🔴⭐🌑⚡🌩️💙❤️👑💣💠🟥🔷🟪🟦🟫🌟）+ 道具点 ❄️🧲。
 * 修法：渲染层贴纸化（dotFace），emoji 收 sr-only 保读屏，判定与热区零改动。
 * 这里钉五件事：
 *   1. 覆盖率：index.ts 源码里 SKINS / POWER_SKIN 的每一个 emoji 都有贴纸（从源码
 *      现抓，谁往皮肤表里加新 emoji 而不配贴纸，这条直接红）；
 *   2. dotFace：sr-only 原字符一字不差 + aria-hidden 贴纸 SVG + 可见层 0 裸 emoji；
 *   3. 兜底：查不到贴纸保持原样直出，绝不空屏；
 *   4. 接线防拆：makeDot 走 dotFace，不再有 `el.textContent = skin` 的老路；
 *   5. 纪律：DOT_ART_CSS 只有自己的类，绝不碰 .rbt-dot 的宽高热区，也不带动画
 *      （静态贴纸，reduced-motion 无需分支）。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasSticker } from "../../art/kit/stickers";
import { DOT_ART_CSS, dotFace } from "./dotArt";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const PICTO = /\p{Extended_Pictographic}/u;

/** 极简元素桩：只造 dotFace 用到的那几样（append / innerHTML / sr 结构） */
class TinyEl {
  textContent = "";
  innerHTML = "";
  className = "";
  readonly children: TinyEl[] = [];
  readonly attrs = new Map<string, string>();
  readonly ownerDocument = {
    createElement: (tag: string): TinyEl => new TinyEl(tag),
  };

  constructor(readonly tagName: string) {}

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, String(value));
  }

  append(...nodes: TinyEl[]): void {
    this.children.push(...nodes);
  }
}

const asEl = (el: TinyEl): HTMLElement => el as unknown as HTMLElement;

/** 从 index.ts 源码里现抓皮肤表的全部 emoji（SKINS 10 章 + POWER_SKIN 两道具） */
function skinGlyphsFromSource(): string[] {
  const start = SRC.indexOf("const SKINS");
  const end = SRC.indexOf("const CSS");
  const block = SRC.slice(start, end);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const seg = new Intl.Segmenter("zh", { granularity: "grapheme" });
  const out = new Set<string>();
  for (const { segment } of seg.segment(block)) {
    if (PICTO.test(segment)) out.add(segment);
  }
  return [...out];
}

describe("W8R2-01 · 皮肤表覆盖率（从源码现抓）", () => {
  it("SKINS 10 章 mine/trap + POWER_SKIN 道具点，一张贴纸都不缺", () => {
    const glyphs = skinGlyphsFromSource();
    // 10 章 × 2 + 道具 2，去重后至少 15 种（⭐🌟❄️⚡❤️ 与既有图集共用）
    expect(glyphs.length).toBeGreaterThanOrEqual(15);
    expect(glyphs.filter((g) => !hasSticker(g))).toEqual([]);
  });
});

describe("W8R2-01 · dotFace 渲染层换装", () => {
  it("有贴纸：sr-only 原字符一字不差 + aria-hidden 贴纸 SVG，可见层 0 裸 emoji", () => {
    const el = new TinyEl("button");
    expect(dotFace(asEl(el), "🔵")).toBe(true);
    expect(el.textContent).toBe("");
    expect(el.children).toHaveLength(2);
    const [sr, face] = el.children;
    expect(sr.className).toBe("rbt-dot-srglyph");
    expect(sr.textContent).toBe("🔵");
    expect(face.className).toBe("rbt-dot-face");
    expect(face.attrs.get("aria-hidden")).toBe("true");
    expect(face.innerHTML).toContain("<svg ");
    expect(face.innerHTML).toContain('data-sticker="蓝圆点"');
    // 可见层（贴纸 SVG）里一个 emoji 字符都不许有
    expect(PICTO.test(face.innerHTML)).toBe(false);
  });

  it("全部 20 个皮肤字符（含 VS16 变体）逐个换装成功", () => {
    for (const g of skinGlyphsFromSource()) {
      const el = new TinyEl("button");
      expect(dotFace(asEl(el), g), g).toBe(true);
      expect(el.children[0].textContent, g).toBe(g);
      expect(el.children[1].innerHTML, g).toContain("<svg ");
    }
  });

  it("查不到贴纸：保持原样直出，绝不空屏", () => {
    const el = new TinyEl("button");
    expect(dotFace(asEl(el), "🤷")).toBe(false);
    expect(el.textContent).toBe("🤷");
    expect(el.children).toHaveLength(0);
  });
});

describe("W8R2-01 · 接线与纪律", () => {
  it("makeDot 走 dotFace，老的 el.textContent = 皮肤字符 直出路径已拆", () => {
    expect(SRC).toContain("dotFace(");
    expect(SRC).not.toMatch(/el\.textContent\s*=\s*\n?\s*kind === "freeze"/);
  });

  it("DOT_ART_CSS 不碰 .rbt-dot 热区：无宽高声明、无动画（静态贴纸）", () => {
    expect(DOT_ART_CSS).not.toMatch(/\.rbt-dot\s*\{/);
    expect(DOT_ART_CSS).not.toContain("@keyframes");
    expect(DOT_ART_CSS).not.toContain("animation");
    // 贴纸层永远不吃点击：热区还是按钮自己的 62/56px
    expect(DOT_ART_CSS).toContain("pointer-events: none");
  });

  it(".rbt-dot 62px / 窄屏 56px 热区原样（修后状态钉死）", () => {
    expect(SRC).toContain(".rbt-dot { position: absolute; width: 62px; height: 62px;");
    expect(SRC).toContain(".rbt-dot { width: 56px; height: 56px;");
  });
});
