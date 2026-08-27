/**
 * 星星台球 · 1.3 第 3 轮终验契约（A 档测试员沉淀）。
 *
 * 终验三道闸，全部按「本款目录全部非测试源码」口径扫描（较 r2 的单文件契约加严）：
 *  1. 精 2D——透视 / 假 3D / three.js 关键字零出现（B 档 r2 提出的一票否决线，扩到全目录）；
 *  2. 商标黑名单零命中（专项⑥终扫的机器化沉淀）；
 *  3. 字号红线——源码里全部 font-size 像素声明 ≥14px（r1 5-4 与 r2-3 修复后的
 *     「永不回降」总闸；`.ps-tip` 的运行时内联来源 fontPx≥14 另由 round2-fix 契约看守；
 *     共用件 l99-star 与 styles.css 辅助标注豁免口径不在本款目录内）。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = dirname(fileURLToPath(import.meta.url));
const FILES = readdirSync(DIR)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
  .map((f) => ({ name: f, src: readFileSync(join(DIR, f), "utf8") }));

const PERSPECTIVE_KEYWORDS = ["perspective", "rotate3d", "matrix3d", "translateZ", 'from "three"', "three.js"];

const BRAND_BLACKLIST = [
  "4399", "任天堂", "nintendo", "迪士尼", "disney", "马里奥", "mario", "皮卡丘", "pikachu",
  "宝可梦", "pokemon", "米老鼠", "mickey", "吃豆人", "pac-man", "pacman", "blinky", "pinky",
  "inky", "clyde", "tetris", "俄罗斯方块", "乐高", "lego", "hello kitty", "凯蒂猫",
  "奥特曼", "ultraman", "喜羊羊", "熊出没", "小猪佩奇", "peppa", "托马斯", "thomas",
  "battle city", "supercell",
];

describe("pool-stars · 第 3 轮终验契约", () => {
  it("精 2D:全目录非测试源码零透视关键字", () => {
    expect(FILES.length).toBeGreaterThan(0);
    for (const { name, src } of FILES) {
      for (const kw of PERSPECTIVE_KEYWORDS) {
        expect(src.includes(kw), `${name} 混进了 ${kw}`).toBe(false);
      }
    }
  });

  it("商标黑名单:全目录非测试源码零命中", () => {
    for (const { name, src } of FILES) {
      const low = src.toLowerCase();
      for (const word of BRAND_BLACKLIST) {
        expect(low.includes(word), `${name} 命中黑名单 ${word}`).toBe(false);
      }
    }
  });

  it("字号红线:源码 font-size 像素声明全部 ≥14px(HUD 提级永不回降)", () => {
    for (const { name, src } of FILES) {
      for (const m of src.matchAll(/font-size:\s*([0-9.]+)px/g)) {
        expect(parseFloat(m[1]), `${name} 存在 <14px 声明:${m[0]}`).toBeGreaterThanOrEqual(14);
      }
    }
  });
});
