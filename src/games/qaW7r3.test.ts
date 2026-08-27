/**
 * 窗口 7 · 第 3 轮(终验)视觉验收守门用例(A 档测试员,只增不减)。
 *
 * 四组终验级断言,与 qaW7r1* / qaW7r1Fix* / qaW7r2* / qaW7r2Fix* 不重复:
 *  1. 守门资产存活性:前两轮沉淀的 25 个机器化扫描用例文件一个不许少、
 *     一条不许 skip——终验口径「被删或被跳过按阻断处理」由本组用例自动执行;
 *  2. 九款画布字号聚合终态:canvas font 字面量 <14px 全窗清零(R1 A-10~A-13 +
 *     R2 N-2/N-5 修复面的九款聚合防回退);表达式低封顶(Math.min(≤13,…))
 *     全窗只允许已登记的 1 处(fruit-slice 章节卡 blurb,1.2 遗留),新增即红;
 *  3. 商标红线源码级:九款绘制源码 + kit 全量过品牌词黑名单
 *     (copyW7r1 只查新增文案句子,这里查全部源码,扫描面不同);
 *  4. 体积感底线:九款每款绘制源码至少保有 2 处渐变调用
 *     (专项①「无平涂火柴人」的粗粒度机器化防线,精细断言在各款 r1/r2 用例)。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GAMES = [
  "fruit-catch",
  "fruit-slice",
  "snake-snack",
  "lianliankan",
  "puzzle-tiles",
  "memory-cards",
  "landlord-cards",
  "fishing-star",
  "poop-hero",
] as const;

const GAMES_DIR = fileURLToPath(new URL(".", import.meta.url));
const KIT_DIR = fileURLToPath(new URL("../art/kit", import.meta.url));

/** 一个目录下全部非测试 .ts 源码(本窗游戏目录都是平铺,不需要递归) */
function gameSources(game: string): Array<{ file: string; src: string }> {
  const dir = join(GAMES_DIR, game);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => ({ file: `${game}/${f}`, src: readFileSync(join(dir, f), "utf8") }));
}

describe("W7R3 终验 · 守门资产存活性(被删/被 skip 按阻断,先在这里红)", () => {
  const guardFiles = [
    ...GAMES.map((g) => join(GAMES_DIR, g, "qaW7r1.test.ts")),
    ...GAMES.filter((g) => g !== "memory-cards").map((g) => join(GAMES_DIR, g, "qaW7r1Fix.test.ts")),
    join(GAMES_DIR, "qaW7r2.test.ts"),
    join(GAMES_DIR, "qaW7r2Fix.test.ts"),
    ...["landlord-cards", "fruit-slice", "poop-hero"].map((g) => join(GAMES_DIR, g, "qaW7r2Fix.test.ts")),
    join(GAMES_DIR, "copyW7r1.test.ts"),
    join(GAMES_DIR, "copyW7r2.test.ts"),
    join(KIT_DIR, "pattern.test.ts"),
  ];

  it("前两轮 25 个机器化守门文件一个不少", () => {
    expect(guardFiles.length).toBe(25);
    for (const f of guardFiles) expect(existsSync(f), `守门文件丢失: ${f}`).toBe(true);
  });

  it("守门文件里没有 .skip / .only / .todo", () => {
    for (const f of guardFiles) {
      const src = readFileSync(f, "utf8");
      expect(/\.(skip|only|todo)\s*\(/.test(src), `守门用例被跳过: ${f}`).toBe(false);
    }
  });
});

describe("W7R3 终验 · 九款画布字号聚合终态(360px 功能小字 ≥14px)", () => {
  it("canvas font 字面量 <14px 九款清零", () => {
    for (const game of GAMES) {
      for (const { file, src } of gameSources(game)) {
        const hits = src.match(/font\s*=\s*[`"'][^`"'\n]*?\b(?:[4-9]|1[0-3])(?:\.\d+)?px/g) ?? [];
        expect(hits, `${file} 画布字面量小字: ${hits.join(" | ")}`).toEqual([]);
      }
    }
  });

  it("表达式低封顶 Math.min(≤13,…) 全窗只有已登记的 fruit-slice 章节卡 1 处", () => {
    const hits: string[] = [];
    for (const game of GAMES) {
      for (const { file, src } of gameSources(game)) {
        for (const m of src.matchAll(/font\s*=\s*[`"'][^`"'\n]*?Math\.min\(\s*(?:[1-9]|1[0-3])\b[^`"'\n]*/g)) {
          hits.push(`${file}: ${m[0]}`);
        }
      }
    }
    // 1.2 遗留登记项(R2 C 档遗留清单 b),清掉后把这条断言改成 0
    expect(hits.length, hits.join(" | ")).toBe(1);
    expect(hits[0]).toContain("fruit-slice/index.ts");
  });
});

describe("W7R3 终验 · 商标红线源码级扫描(专项⑥,扫全部源码非仅新增文案)", () => {
  const BRAND_WORDS = [
    "mario", "luigi", "pikachu", "pokemon", "pokémon", "mickey", "disney",
    "doraemon", "hello kitty", "hellokitty", "sanrio", "tetris", "angry bird",
    "fruit ninja", "subway surf", "temple run",
    "马里奥", "皮卡丘", "宝可梦", "米老鼠", "迪士尼", "哆啦a梦", "凯蒂猫",
    "俄罗斯方块", "愤怒的小鸟", "植物大战僵尸", "水果忍者", "捕鱼达人",
    "欢乐斗地主", "开心消消乐", "天天爱消除", "贪吃蛇大作战", "神庙逃亡", "地铁跑酷",
  ];

  it("九款绘制源码 + kit 全量 0 命中", () => {
    const kitSources = readdirSync(KIT_DIR)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f) => ({ file: `kit/${f}`, src: readFileSync(join(KIT_DIR, f), "utf8") }));
    const all = [...GAMES.flatMap((g) => gameSources(g)), ...kitSources];
    for (const { file, src } of all) {
      const low = src.toLowerCase();
      for (const w of BRAND_WORDS) {
        expect(low.includes(w), `${file} 命中品牌词「${w}」`).toBe(false);
      }
    }
  });
});

describe("W7R3 终验 · 体积感底线(专项① 粗粒度:每款至少 2 处渐变)", () => {
  it("九款绘制源码渐变调用计数逐款 ≥2", () => {
    const RE = /createLinearGradient|createRadialGradient|linear-gradient|linearGradient|radialGradient/g;
    for (const game of GAMES) {
      let n = 0;
      for (const { src } of gameSources(game)) n += (src.match(RE) ?? []).length;
      expect(n, `${game} 渐变调用只剩 ${n} 处`).toBeGreaterThanOrEqual(2);
    }
  });
});
