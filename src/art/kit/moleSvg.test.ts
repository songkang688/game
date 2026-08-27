/**
 * 共享美术套件 · moleSvg.ts 单测(1.3 第 18 步 B 档)。
 *
 * 地鼠是纯字符串模板,逐项断言:四种装备 spec 的装备层含 / 不含、
 * 被敲态(压扁 0.8 + 吐舌 + 星星圈 3 颗)、哈欠态(瞌睡泡)、
 * 皮毛可换色、花花兔剪影可分、独立装备层 SVG 可单拿。
 */
import { describe, expect, it } from "vitest";
import {
  BONK_SQUASH,
  BONK_STAR_COUNT,
  MOLE_FUR,
  MOLE_FUR_GOLD,
  MOLE_INK,
  bunnySvg,
  moleDarken,
  moleGearSvg,
  moleLighten,
  moleSvg,
  type MoleGear,
} from "./moleSvg";

const GEARS: Array<[MoleGear, string]> = [
  ["none", ""],
  ["shield", "gear-shield"],
  ["hat", "gear-hat"],
  ["board", "gear-board"],
];

describe("art-kit · moleSvg 参数化地鼠", () => {
  it.each(GEARS)("spec=%s:只带自己的装备层,不带别家的", (gear, marker) => {
    const svg = moleSvg({ gear, boardText: "3+4" });
    for (const [, other] of GEARS) {
      if (other === "") continue;
      if (other === marker) expect(svg).toContain(`data-part="${other}"`);
      else expect(svg).not.toContain(`data-part="${other}"`);
    }
  });

  it("主体三件套常驻:皮毛渐变主体 + 面部(大门牙) + 圆爪扒洞沿", () => {
    const svg = moleSvg();
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).toContain('data-part="body"');
    expect(svg).toContain('data-part="face"');
    expect(svg).toContain('data-part="teeth"');
    expect(svg).toContain('data-part="paws"');
    expect(svg).toContain("linearGradient");
  });

  it("被敲态:压扁 0.8 倍 + 吐舌笑 + 星星圈 3 颗,喜感不痛苦", () => {
    const svg = moleSvg({ pose: "bonked" });
    expect(svg).toContain(`scale(1 ${BONK_SQUASH})`);
    expect(svg).toContain('data-part="tongue"');
    expect(svg).toContain('data-part="stars"');
    expect((svg.match(/<polygon/g) ?? []).length).toBe(BONK_STAR_COUNT);
    // 分级红线:星星圈是喜感表达,画面里不出现痛苦元素(× 眼、泪滴)
    expect(svg).not.toContain("data-part=\"tears\"");
  });

  it("哈欠态(没被敲到缩回):闭眼张嘴 + 一滴瞌睡泡", () => {
    const svg = moleSvg({ pose: "yawn" });
    expect(svg).toContain('data-part="yawn"');
    expect(svg).toContain('data-part="sleep-bubble"');
    expect(svg).not.toContain('data-part="stars"');
  });

  it("皮毛可参数化:金地鼠换金色渐变,默认用地鼠棕", () => {
    expect(moleSvg({ fur: MOLE_FUR_GOLD })).toContain(MOLE_FUR_GOLD);
    expect(moleSvg()).toContain(MOLE_FUR);
  });

  it("瞌睡鼠 / 闪光鼠有各自的剪影标记", () => {
    expect(moleSvg({ sleepy: true })).toContain('data-part="drowse"');
    expect(moleSvg({ sparkle: true })).toContain('data-part="sparkle"');
    expect(moleSvg()).not.toContain('data-part="drowse"');
  });

  it("独立装备层 SVG:三件装备都能单拿,黑板带手写算式文本", () => {
    expect(moleGearSvg("shield")).toContain('data-part="gear-shield"');
    expect(moleGearSvg("hat")).toContain('data-part="gear-hat"');
    const board = moleGearSvg("board", "6-2");
    expect(board).toContain('data-part="gear-board"');
    expect(board).toContain(">6-2</text>");
    expect(board).toContain("cursive");
  });

  it("花花兔:长耳朵 + 郁金香,和地鼠 data-part 完全不同", () => {
    const svg = bunnySvg();
    expect(svg).toContain('data-part="bunny"');
    expect(svg).toContain('data-part="tulip"');
    expect(svg).not.toContain('data-part="teeth"');
  });

  it("装饰性输出:aria-hidden + 100% 吃满宿主,颜色工具单调可逆序", () => {
    expect(moleSvg()).toContain('aria-hidden="true"');
    expect(moleSvg()).toContain('width="100%"');
    expect(moleSvg({ size: 48 })).toContain('width="48"');
    expect(moleLighten("#000000", 1)).toBe("rgb(255,255,255)");
    expect(moleDarken("#ffffff", 1)).toBe("rgb(0,0,0)");
    expect(MOLE_INK).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
