/**
 * 共享美术套件 · badge.ts 单测（1.3 第 17 步 A 档）。
 *
 * 徽章是纯字符串模板，逐套断言：底色对阵营、色环对职业 / 怪物、
 * 图标可定位（data-icon）、描边与小影按规格、等级角标只给合法数字。
 */
import { describe, expect, it } from "vitest";
import {
  BADGE_BASE,
  BADGE_INK,
  BADGE_KINDS,
  BADGE_RING,
  BADGE_SHADOW,
  badge,
  type BadgeKind
} from "./badge";

const HERO_KINDS: BadgeKind[] = ["swordsman", "mage", "priest"];
const FOE_KINDS: BadgeKind[] = ["jelly", "mushroom", "rock"];

describe("art-kit · badge 六套规格徽章", () => {
  it.each([...HERO_KINDS, ...FOE_KINDS])("%s：底色按阵营、色环按套、图标可定位", (kind) => {
    const svg = badge(kind);
    const camp = HERO_KINDS.includes(kind) ? "hero" : "foe";
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(`fill="${BADGE_BASE[camp]}"`);
    expect(svg).toContain(`stroke="${BADGE_RING[kind]}"`);
    expect(svg).toContain(`data-icon="${kind}"`);
    expect(svg).toContain(`class="ak-badge ak-badge-${kind}"`);
  });

  it("全部套系：1.5px 描边 + 3px 色环 + 底部小影 + 82% 主体圆，一样不缺", () => {
    for (const kind of BADGE_KINDS) {
      const svg = badge(kind);
      expect(svg).toContain(`stroke="${BADGE_INK}" stroke-width="1.5"`);
      expect(svg).toContain('stroke-width="3"');
      expect(svg).toContain(`fill="${BADGE_SHADOW}"`);
      // 主体圆直径 52 / viewBox 64 ≈ 82%
      expect(svg).toContain('r="26"');
      expect(svg).toContain('viewBox="0 0 64 64"');
    }
  });

  it("阵营可以显式覆盖：给怪物皮也能套勇者暖白底", () => {
    expect(badge("jelly", { camp: "hero" })).toContain(`fill="${BADGE_BASE.hero}"`);
    expect(badge("swordsman", { camp: "foe" })).toContain(`fill="${BADGE_BASE.foe}"`);
  });

  it("等级角标：合法数字才画，怪物专用的小圆 + 数字", () => {
    const withLevel = badge("rock", { level: 7 });
    expect(withLevel).toContain('data-part="level"');
    expect(withLevel).toContain(">7</text>");
    expect(badge("rock")).not.toContain('data-part="level"');
    expect(badge("rock", { level: 0 })).not.toContain('data-part="level"');
    expect(badge("rock", { level: 120 })).not.toContain('data-part="level"');
    expect(badge("rock", { level: Number.NaN })).not.toContain('data-part="level"');
  });

  it("尺寸：默认吃满宿主容器，给 size 就钉成像素", () => {
    expect(badge("flower")).toContain('width="100%" height="100%"');
    expect(badge("flower", { size: 44 })).toContain('width="44" height="44"');
  });

  it("纯装饰输出：aria-hidden、focusable=false、不含脚本与外链", () => {
    for (const kind of BADGE_KINDS) {
      const svg = badge(kind);
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('focusable="false"');
      expect(svg).not.toContain("<script");
      expect(svg).not.toContain("http");
    }
  });
});
