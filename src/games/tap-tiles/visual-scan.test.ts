/**
 * 音符下落 · 1.3 窗口3 第 1 轮视觉验收 · 测试员机器扫描（静态源码断言）。
 *
 * 沉淀给第 2、3 轮复跑的三条底线：
 *  1. 核心资产模块 art.ts 里 fillText 不许直出 emoji（宪法负面清单①：裸 emoji 当核心资产）；
 *  2. art.ts 保有渐变调用（收集物「体积三阶」的最低哨兵，防止有人把渐变退化回平涂）；
 *  3. 本目录全部正式源码（含注释）不含商标黑名单词（宪法第八节，孩子可见文案与注释同责）。
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (f: string): string => fileURLToPath(new URL(f, import.meta.url));
const read = (f: string): string => readFileSync(here(f), "utf8");

/** BMP 符号区 + 代理对兜住补充平面的全部 emoji */
const EMOJI_RE = /[\u2600-\u27bf\u2b00-\u2bff]|[\ud83c-\ud83e][\udc00-\udfff]/;

const MARKS = [
  "马里奥", "超级玛丽", "地铁跑酷", "皮卡丘", "宝可梦", "任天堂", "迪士尼", "奥特曼",
  "喜羊羊", "蛋仔", "原神", "王者荣耀", "拳皇", "街霸", "俄罗斯方块", "Tetris",
  "Minecraft", "凯蒂猫", "Hello Kitty", "Bomberman", "Candy Crush", "开心消消乐", "Cytus",
];

const srcFiles = (): string[] =>
  readdirSync(here(".")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

describe("1.3 视觉机器扫描（窗口3 · round1 tester）", () => {
  it("art.ts 的 fillText 行不直出 emoji", () => {
    const bad = read("./art.ts")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => !l.startsWith("*") && !l.startsWith("//"))
      .filter((l) => l.includes("fillText(") && EMOJI_RE.test(l));
    expect(bad).toEqual([]);
  });

  it("art.ts 保有渐变（收集物体积哨兵）", () => {
    expect(/createLinearGradient|createRadialGradient|linearGradient|radialGradient/.test(read("./art.ts"))).toBe(true);
  });

  it("正式源码零商标黑名单词（含注释）", () => {
    for (const f of srcFiles()) {
      const src = read(`./${f}`);
      for (const m of MARKS) expect(src.includes(m), `${f} 含「${m}」`).toBe(false);
    }
  });
});
