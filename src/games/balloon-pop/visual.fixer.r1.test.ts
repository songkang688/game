/**
 * 窗口 6 · 第 1 轮视觉监督修复员(C 档)· balloon-pop W6R1-12 修后钉住测试。
 *
 * 修复:特殊球身份从「emoji 小图标贴渐变球」换成 12px 白底 + 1.2px 主色描边
 * 的几何 SVG 徽记(护盾=盾形、双子=双圆相扣、礼物=礼盒缎带、连锁=三连小圆、
 * 乌云=三弧云朵、彩虹=三色拱弧),挂点沿用 LABEL_TOP_PCT=55 躲开主高光。
 * 热区 / aria-label / dataset 一个字不动(visualSmoke 既有用例守着)。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { shade } from "../../art/kit/palette";
import {
  BALLOON_COLORS,
  KIND_BADGE_FILL,
  KIND_BADGE_PX,
  KIND_BADGE_STROKE,
  KIND_KEYS,
  balloonKey,
  kindBadgeSvg,
} from "./visual";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("balloon-pop 特殊球徽记 SVG 化(W6R1-12)", () => {
  it("六种机关球都有几何徽记:白底 + 1.2px 主色压暗 30% 描边,不含任何 emoji", () => {
    for (const kind of ["iron", "twin", "gift", "chain", "cloud", "rainbow"] as const) {
      const svg = kindBadgeSvg(kind, 0);
      expect(svg, kind).toContain(`class="blp-kbadge"`);
      expect(svg, kind).toContain(KIND_BADGE_FILL);
      expect(svg, kind).toContain(`stroke-width="${KIND_BADGE_STROKE}"`);
      expect(svg, kind).toContain(shade(balloonKey(kind, 0), -30));
      expect(EMOJI_RE.test(svg), `${kind} 徽记里混进了 emoji`).toBe(false);
      expect(svg).toContain(`aria-hidden="true"`);
    }
  });

  it("普通五色球不加徽记(身份=颜色,不加噪)", () => {
    expect(kindBadgeSvg("normal", 2)).toBe("");
  });

  it("远景 0.72 缩放仍在 8px 最小可见线上;更小就整件省略", () => {
    expect(KIND_BADGE_PX).toBe(12);
    expect(kindBadgeSvg("iron", 0, 0.72)).toContain(`width="${Math.round(12 * 0.72)}"`);
    expect(kindBadgeSvg("iron", 0, 0.5)).toBe("");
  });

  it("徽记描边跟随所在球主色:铁壳按五色、机关球按代表色", () => {
    expect(kindBadgeSvg("iron", 3)).toContain(shade(BALLOON_COLORS[3].key, -30));
    expect(kindBadgeSvg("gift", 0)).toContain(shade(KIND_KEYS.gift as string, -30));
  });

  it("paintBalloon 不再往球面贴 KINDS 的 emoji;徽记挂点与衬牌同为 LABEL_TOP_PCT", () => {
    expect(SRC).not.toContain("label = KINDS[b.kind].emoji");
    expect(SRC).not.toContain("KINDS.twin.emoji");
    expect(SRC).not.toContain("KINDS.iron.emoji");
    expect(SRC).toContain("badge = kindBadgeSvg(b.kind, b.color, scale)");
    expect(SRC).toMatch(/\.blp-kbadge \{[^}]*top: \$\{LABEL_TOP_PCT\}%/);
  });

  it("连锁球徽记是三连小圆(火药棒造型退场,分级红线顺检)", () => {
    const svg = kindBadgeSvg("chain", 0);
    expect((svg.match(/<circle/g) ?? []).length).toBe(3);
  });
});
