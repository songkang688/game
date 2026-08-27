/**
 * 1.3 窗口 6 · C 档 · 第 1 轮监督修复员 · W6R1-01 / W6R1-02 修复钉子(adventure-king)。
 * - W6R1-02:文物 emoji fillText 退休 → 三种原创纹石(日菱/月六边/星圆珠),
 *   ≥3 停渐变 + 左上高光 + 墨描边;底圆从 0 停平涂改为三停径向渐变;
 * - W6R1-01:古堡模式主角 🌸 / 箱子 📦 → 参数化 SVG(朵朵花株 + 2.5D 木箱)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_GEM_COLORS,
  ARTIFACT_GEM_INK,
  artifactKindOf,
  castleBoxSvg,
  castleHeroSvg,
  drawArtifactGem,
  drawArtifactSprite,
  type AkBrush,
} from "./visual";

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

/** 记账画笔:记下 fillText 的内容、渐变停数与几何调用序,画不出像素但咬得住规格 */
function brush(): AkBrush & { texts: string[]; colors: unknown[]; stops: number; paths: string[] } {
  const rec = {
    texts: [] as string[],
    colors: [] as unknown[],
    stops: 0,
    paths: [] as string[],
    fillStyle: undefined as unknown,
    strokeStyle: undefined as unknown,
    lineWidth: 0,
    lineCap: undefined as unknown,
    globalAlpha: 1,
    font: "",
    textAlign: undefined as unknown,
    textBaseline: undefined as unknown,
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    beginPath() {},
    closePath() {
      rec.paths.push("close");
    },
    moveTo() {
      rec.paths.push("move");
    },
    lineTo() {
      rec.paths.push("line");
    },
    quadraticCurveTo() {},
    arc() {
      rec.paths.push("arc");
    },
    ellipse() {},
    roundRect() {},
    rect() {},
    fill() {
      rec.colors.push(rec.fillStyle);
    },
    stroke() {
      rec.colors.push(rec.strokeStyle);
    },
    fillRect() {},
    fillText(t: string) {
      rec.texts.push(t);
    },
    createLinearGradient() {
      rec.colors.push("gradient");
      return {
        addColorStop() {
          rec.stops++;
        },
      };
    },
    createRadialGradient() {
      rec.colors.push("radial");
      return {
        addColorStop() {
          rec.stops++;
        },
      };
    },
  };
  return rec as unknown as AkBrush & typeof rec;
}

describe("窗口6 r1 fixer · W6R1-02 文物纹石化", () => {
  it("drawArtifactSprite 不再 fillText 任何字符(emoji 退休)", () => {
    const b = brush();
    drawArtifactSprite(b, 100, 80, 0.6, 0, 0.3, 200);
    expect(b.texts).toEqual([]);
  });

  it("底圆是径向渐变(不再 0 停平涂),宝石本体有线性渐变,合计 ≥5 停", () => {
    const b = brush();
    drawArtifactSprite(b, 100, 80, 0.6, 1, 0.3, null);
    expect(b.colors).toContain("radial");
    expect(b.colors).toContain("gradient");
    expect(b.stops).toBeGreaterThanOrEqual(5);
  });

  it("三种纹石主色两两不同,emoji 兼容映射 🔶/🔷/🔮 → 0/1/2", () => {
    expect(new Set(ARTIFACT_GEM_COLORS).size).toBe(3);
    expect(artifactKindOf("🔶")).toBe(0);
    expect(artifactKindOf("🔷")).toBe(1);
    expect(artifactKindOf("🔮")).toBe(2);
    expect(artifactKindOf(2)).toBe(2);
    expect(artifactKindOf("?")).toBe(0);
  });

  it("纹石有墨描边与白高光(左上光源约定)", () => {
    const b = brush();
    drawArtifactGem(b, 50, 50, 13, 0);
    expect(b.colors).toContain(ARTIFACT_GEM_INK);
    expect(b.colors.some((c) => typeof c === "string" && c.startsWith("rgba(255,255,255"))).toBe(true);
  });

  it("三种纹石剪影可分:三条几何调用序两两不同(菱形折线/六边折线/圆弧)", () => {
    const sigs = [0, 1, 2].map((k) => {
      const b = brush();
      drawArtifactGem(b, 50, 50, 13, k);
      return b.paths.join(",");
    });
    expect(new Set(sigs).size).toBe(3);
    // 星圆珠的轮廓走 arc,日菱形的轮廓走折线
    expect(sigs[2]).toContain("arc");
    expect(sigs[0].startsWith("move,line")).toBe(true);
  });

  it("index.ts 的场上文物与门上清单都不再传 emoji(走 art.kind / drawArtifactGem)", () => {
    const idx = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    expect(idx).not.toContain("ARTIFACT_EMOJI[art.kind]");
    expect(idx).not.toContain("fillText(ARTIFACT_EMOJI");
    expect(idx).toContain("drawArtifactGem(");
  });
});

describe("窗口6 r1 fixer · W6R1-01 古堡主角/箱子参数化", () => {
  it("主角是五瓣花株 SVG:花瓣描边 1.5px + 金花心 + 笑脸 + 落影,无 emoji", () => {
    const svg = castleHeroSvg();
    expect(svg).toContain("<svg");
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).toMatch(/<ellipse[^>]*cy="57"/);
    expect(EMOJI_RE.test(svg)).toBe(false);
    expect((svg.match(/<circle/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it("箱子是 2.5D 木箱 SVG:顶面受光 + X 加固条 + 墨描边 + 落影,无 emoji", () => {
    const svg = castleBoxSvg();
    expect(svg).toContain("<svg");
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).toMatch(/<ellipse[^>]*cy="57"/);
    expect(EMOJI_RE.test(svg)).toBe(false);
    // 顶面 + 侧影两层明暗(2.5D 双面)
    expect(svg).toMatch(/opacity="\.55"/);
  });

  it("主角与箱子剪影可分(SVG 串不同),index.ts 里 🌸/📦 直出退休", () => {
    expect(castleHeroSvg()).not.toBe(castleBoxSvg());
    const idx = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    expect(idx).not.toContain('"🌸"');
    expect(idx).not.toContain('"📦"');
    expect(idx).toMatch(/\.advk-cell svg\{width:88%/);
  });
});
