/**
 * 1.3 窗口 6 · A 档 · 第 1 轮视觉测试员 · kit 横向光照一致性扫描。
 * 约定:光源左上 45°、高光在左上象限、描边 1.5–2px(细节件可细)。
 */
import { describe, expect, it } from "vitest";
import { badge } from "./badge";
import { SKIN_HIGHLIGHT_AT, SKIN_REFLECT_AT } from "./balloonSkin";
import { BUBBLE_HIGHLIGHT_X, BUBBLE_HIGHLIGHT_Y } from "./bubbleSkin";
import { CANDY_LIT_BAND_K, CANDY_OUTLINE_PX } from "./candyBrick";
import { FILM_HUE_DEG, FILM_MIN_RADIUS } from "./film";
import { hamsterSvg } from "./hamsterSvg";
import { moleSvg } from "./moleSvg";
import { BH_HAMSTER_STYLES } from "../../games/box-hamster/visual";

describe("窗口6 r1 · kit 光照一致性", () => {
  it("气球皮肤主高光在左上象限,弱反光在右下象限", () => {
    expect(SKIN_HIGHLIGHT_AT.x).toBeLessThan(50);
    expect(SKIN_HIGHLIGHT_AT.y).toBeLessThan(50);
    expect(SKIN_REFLECT_AT.x).toBeGreaterThan(50);
    expect(SKIN_REFLECT_AT.y).toBeGreaterThan(50);
  });

  it("泡泡皮肤主高光同在左上象限(三款泡泡类同族)", () => {
    expect(parseFloat(BUBBLE_HIGHLIGHT_X)).toBeLessThan(50);
    expect(parseFloat(BUBBLE_HIGHLIGHT_Y)).toBeLessThan(50);
  });

  it("糖砖亮带在顶部(左上光),外描边 1.5–2px", () => {
    expect(CANDY_LIT_BAND_K).toBeGreaterThan(0);
    expect(CANDY_LIT_BAND_K).toBeLessThan(0.5);
    expect(CANDY_OUTLINE_PX).toBeGreaterThanOrEqual(1.5);
    expect(CANDY_OUTLINE_PX).toBeLessThanOrEqual(2);
  });

  it("薄膜:同色系偏 12°,小于 6px 不画(小屏省一笔)", () => {
    expect(FILM_HUE_DEG).toBe(12);
    expect(FILM_MIN_RADIUS).toBe(6);
  });

  it("徽章主体描边 1.5px + 底部落影", () => {
    const svg = badge("flower", { camp: "hero" });
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).toMatch(/<ellipse[^>]*cy="58"/);
  });

  it("地鼠 / 仓鼠皮毛渐变是纵向三停(顶亮底暗,同一光源方向)", () => {
    const mole = moleSvg({});
    expect(mole).toMatch(/<linearGradient[^>]*x1="0" y1="0" x2="0" y2="1"/);
    expect((mole.match(/<stop /g) ?? []).length).toBeGreaterThanOrEqual(3);
    const ham = hamsterSvg({ style: BH_HAMSTER_STYLES[0], facing: 2, pose: "idle" });
    expect(ham).toMatch(/<linearGradient[^>]*x1="0" y1="0" x2="0" y2="1"/);
  });
});
