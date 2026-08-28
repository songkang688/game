/**
 * 窗口 8 · 1.3 视觉升级 · 第 3 轮（终验）沉淀的机器化扫描（测试员新增）。
 *
 * 范围锁死本窗 12 款。四条终验防线，全部是前两轮没有的新口径：
 *  ① 专项①补口径：第 1 轮钉了 `fillText(` 直出，这里补钉 canvas `.arc(` 直画——
 *     裸 arc 圆 + 单色 fill 正是「草稿圆火柴人」的老底子路径，终验实测 12 款用量为 0，钉死不许回头；
 *  ② 贴纸图集水位只增不减：终验时 stickers 图集注册 143 张，后续补第 4–10 章 50 张
 *     只能往上走，谁删贴纸直接红；
 *  ③ find-diff 已亮灯的前 3 章（水果 / 萌宠 / 海底）27 个图案贴纸全配齐——
 *     整关门控 `sceneStickersReady` 靠池子配齐才开闸，删任何一张 = 整章熄灯回退 emoji，按退化处理；
 *  ④ 防线的防线：第 1 / 2 轮机器化扫描文件必须在位且不许被 skip——
 *     终验规格明文「被删或被跳过（skip）的用例按阻断处理」，把这条规矩本身也变成用例。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STICKER_EMOJIS, hasSticker } from "../../art/kit/stickers";
import { THEME_POOLS } from "../find-diff/levels";

const HERE = dirname(fileURLToPath(import.meta.url));
const GAMES_DIR = join(HERE, "..");

const WINDOW8_IDS = [
  "red-blue-race",
  "red-blue-tap",
  "red-blue-tug",
  "clock-house",
  "math-farm",
  "pinyin-train",
  "word-garden",
  "shape-kingdom",
  "find-diff",
  "color-fun",
  "music-stars",
  "kitty-care"
] as const;

/** 某款游戏的全部「实现」源码（排除 *.test.ts，与第 1 轮扫描同一工序） */
function implSources(id: string): Array<{ file: string; text: string }> {
  const dir = join(GAMES_DIR, id);
  const out: Array<{ file: string; text: string }> = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (!statSync(p).isFile()) continue;
    if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
    out.push({ file: `${id}/${f}`, text: readFileSync(p, "utf8") });
  }
  return out;
}

describe("窗口 8 · 第 3 轮终验 · 专项① canvas 裸圆补口径", () => {
  it("12 款实现代码没有一处 canvas `.arc(` 直画（草稿圆的老底子路径）", () => {
    const hits: string[] = [];
    for (const id of WINDOW8_IDS) {
      for (const { file, text } of implSources(id)) {
        if (text.includes(".arc(")) hits.push(file);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("窗口 8 · 第 3 轮终验 · 贴纸图集水位", () => {
  it("stickers 图集注册数 ≥ 143（终验水位），补章只许加不许删", () => {
    expect(STICKER_EMOJIS.length).toBeGreaterThanOrEqual(143);
  });

  it("find-diff 已亮灯的前 3 章 27 个图案贴纸全配齐，不许熄灯回退", () => {
    const litChapters = THEME_POOLS.slice(0, 3);
    const missing: string[] = [];
    litChapters.forEach((pool, i) => {
      expect(pool.length).toBe(9);
      for (const emoji of pool) {
        if (!hasSticker(emoji)) missing.push(`章${i + 1} ${emoji}`);
      }
    });
    expect(missing).toEqual([]);
  });
});

describe("窗口 8 · 第 3 轮终验 · 防线的防线", () => {
  it("第 1 / 2 轮机器化扫描文件在位、没被 skip", () => {
    for (const name of ["window8-round1-visual-scan.test.ts", "window8-round2-visual-scan.test.ts"]) {
      const p = join(HERE, name);
      expect(existsSync(p), `${name} 必须在位`).toBe(true);
      const text = readFileSync(p, "utf8");
      expect(text).not.toMatch(/\b(?:it|describe|test)\.(?:skip|todo|only)\(/);
      expect(text).not.toMatch(/\bx(?:it|describe|test)\(/);
    }
  });
});
