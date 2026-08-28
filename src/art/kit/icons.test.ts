/**
 * 共享美术套件 · SVG 图标组单测(1.3 第 21 步 A 档)。
 *
 * 盯四件事:图标数量与两两互异、四道工序(渐变 / 1.5px 描边 / 高光)逐项在场、
 * 渐变 id 稳定且同款共享、路径数据全是合法的矢量指令(没有位图、没有字体字符)。
 */
import { describe, expect, it } from "vitest";
import { shade } from "./fruit";
import {
  ICON_GLINT_ALPHA,
  ICON_STROKE_PX,
  ICONS,
  MASK_ICON,
  iconById,
  iconSvg,
  starburstPath
} from "./icons";

const HEX_RE = /^#[0-9A-F]{6}$/i;
/** BMP 之外的 emoji 与变体选择符:图标是纯矢量,不许混进任何表情字符 */
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2753}]/u;
/** path 的 d 只许出现矢量指令与数字 */
const PATH_RE = /^[MLCQAZ0-9 ,.\-]+$/i;

describe("图标组 · 数量与互异", () => {
  it("原创图标 ≥ 12 种,id 与中文名都不重样", () => {
    expect(ICONS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ICONS.map((i) => i.id)).size).toBe(ICONS.length);
    expect(new Set(ICONS.map((i) => i.name)).size).toBe(ICONS.length);
    for (const icon of ICONS) {
      expect(icon.id).toMatch(/^[a-z]+$/);
      expect(icon.name.length).toBeGreaterThan(0);
    }
  });

  it("任何两枚图标的剪影路径都不一样(全矩阵过一遍)", () => {
    for (let i = 0; i < ICONS.length; i++) {
      for (let j = i + 1; j < ICONS.length; j++) {
        expect(ICONS[i].d, `${ICONS[i].id} 与 ${ICONS[j].id} 撞了剪影`).not.toBe(ICONS[j].d);
      }
    }
  });

  it("抽三对核对整张 SVG 也互不相同(步骤文档点名的抽查)", () => {
    const pick = (id: string) => iconSvg(iconById(id));
    expect(pick("flower")).not.toBe(pick("star"));
    expect(pick("umbrella")).not.toBe(pick("bell"));
    expect(pick("fish")).not.toBe(pick("leaf"));
  });

  it("面具图标单独放,不在牌面图标组里,而且有两个眼位", () => {
    expect(ICONS.some((i) => i.id === MASK_ICON.id)).toBe(false);
    const svg = iconSvg(MASK_ICON);
    expect((svg.match(/<ellipse/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("图标组 · 四道工序逐项在场", () => {
  it("每枚都有双色渐变 + 1.5px 描边 + 左上高光,颜色全是合法 #rrggbb", () => {
    expect(ICON_STROKE_PX).toBe(1.5);
    for (const icon of [...ICONS, MASK_ICON]) {
      expect(icon.light, icon.id).toMatch(HEX_RE);
      expect(icon.dark, icon.id).toMatch(HEX_RE);
      expect(icon.light, `${icon.id} 渐变两端不该同色`).not.toBe(icon.dark);
      const svg = iconSvg(icon);
      expect(svg.startsWith("<svg"), icon.id).toBe(true);
      expect(svg, icon.id).toContain(`viewBox="0 0 100 100"`);
      expect(svg, icon.id).toContain("<linearGradient");
      expect(svg, icon.id).toContain(`stop-color="${icon.light}"`);
      expect(svg, icon.id).toContain(`stop-color="${icon.dark}"`);
      expect(svg, icon.id).toContain(`stroke-width="1.5"`);
      expect(svg, icon.id).toContain(`rgba(255,255,255,${ICON_GLINT_ALPHA})`);
      // 描边是 dark 加深 35%,不是随手拿 dark 凑数
      expect(svg, icon.id).toContain(`stroke="${shade(icon.dark, -0.35)}"`);
    }
  });

  it("剪影 d 全是矢量指令,没有 emoji、没有字体字符、没有位图", () => {
    for (const icon of [...ICONS, MASK_ICON]) {
      expect(PATH_RE.test(icon.d), `${icon.id} 的 d 里有非矢量内容`).toBe(true);
      expect(icon.d.startsWith("M"), icon.id).toBe(true);
      expect(icon.d.trim().endsWith("Z"), icon.id).toBe(true);
      const svg = iconSvg(icon);
      expect(EMOJI_RE.test(svg), `${icon.id} 的 SVG 里混进了表情字符`).toBe(false);
      expect(svg, icon.id).not.toContain("data:image");
      expect(svg, icon.id).not.toContain("<image");
      expect(svg, icon.id).not.toContain("<text");
    }
  });

  it("渐变 id 按图标 id 稳定生成;带 uid 时各用各的,互不打架", () => {
    const a = iconSvg(iconById("flower"));
    expect(a).toContain(`id="kitg-flower"`);
    expect(a).toContain(`fill="url(#kitg-flower)"`);
    // 同款两次拼出的字符串一字不差(可以放心做缓存)
    expect(iconSvg(iconById("flower"))).toBe(a);
    const b = iconSvg(iconById("flower"), { uid: "x1" });
    expect(b).toContain(`id="kitg-flower-x1"`);
    expect(b).toContain(`fill="url(#kitg-flower-x1)"`);
  });

  it("iconById 找不到也不返回 undefined;cls 能加到 <svg> 上", () => {
    expect(iconById("绝对没有这枚").id).toBe(ICONS[0].id);
    expect(iconSvg(iconById("star"), { cls: "llk-face" })).toContain(`class="kit-icon llk-face"`);
  });
});

describe("图标组 · 星屑路径", () => {
  it("四角星路径随半径等比缩放,全是 Q 曲线", () => {
    const small = starburstPath(4);
    const big = starburstPath(8);
    expect(small).not.toBe(big);
    expect(small).toContain("Q");
    expect(small.startsWith("M0 -4")).toBe(true);
    expect(big.startsWith("M0 -8")).toBe(true);
    expect(PATH_RE.test(small)).toBe(true);
  });
});
