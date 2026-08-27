/**
 * 1.3 窗口 1 · 第 1 轮视觉验收 · 测试员新增的机器化扫描用例。
 *
 * 对照 `docs/plan-1.3-visual-bible.md` 负面清单,把六大专项里能机器化的部分
 * 固化成源码级契约,防止后续窗口回归:
 *  ① canvas `fillText(` 不许 emoji 直出(主体必须是矢量绘制);
 *  ② 九款一律 import 共享素材包 `src/art/kit`(不许自己再造调色数学);
 *  ③ 九款源码必须保留 prefers-reduced-motion 降级路径;
 *  ④ 禁 three.js(九款 + 基建 + package.json 三头都卡);
 *  ⑤ 360px 硬门槛:DOM/canvas 字号声明一律 ≥ 14px;
 *  ⑥ 商标黑名单在孩子可见文案与注释里 0 命中。
 *
 * 只读源码、不改绘制实现;报告见 docs/qa/1.3-window1-round1-tester.md。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

/** 窗口 1 的九款 */
const GAMES = [
  "orb-arena",
  "snake-royale",
  "block-drop",
  "combo-clash",
  "mahjong-bloom",
  "star-estate",
  "hero-cards",
  "weiqi-garden",
  "flight-chess"
] as const;

/** 窗口 1 的三份基建 */
const INFRA_DIRS = ["src/art/kit", "src/art/runner"] as const;

/** 读一个游戏目录下全部非测试 .ts 源码(路径 → 内容) */
function gameSources(game: string): Array<{ file: string; text: string }> {
  const dir = join(ROOT, "src", "games", game);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => ({ file: `${game}/${f}`, text: readFileSync(join(dir, f), "utf8") }));
}

function infraSources(): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  for (const d of INFRA_DIRS) {
    const dir = join(ROOT, d);
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".ts") && !f.endsWith(".test.ts")) {
        out.push({ file: `${d}/${f}`, text: readFileSync(join(dir, f), "utf8") });
      }
    }
  }
  out.push({ file: "src/ui/motion.ts", text: readFileSync(join(ROOT, "src", "ui", "motion.ts"), "utf8") });
  return out;
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;

describe("窗口1 · ① canvas fillText 无 emoji 直出(主体必须矢量化)", () => {
  it.each([...GAMES])("%s:含 fillText( 的源码行不携带 emoji 字面量", (game) => {
    for (const { file, text } of gameSources(game)) {
      for (const line of text.split("\n")) {
        if (line.includes("fillText(")) {
          expect(EMOJI_RE.test(line), `${file} 的 fillText 行疑似 emoji 直出:${line.trim().slice(0, 80)}`).toBe(false);
        }
      }
    }
  });

  it("kit / runner / motion 基建同样无 emoji 直出", () => {
    for (const { file, text } of infraSources()) {
      for (const line of text.split("\n")) {
        if (line.includes("fillText(")) {
          expect(EMOJI_RE.test(line), `${file}:${line.trim().slice(0, 80)}`).toBe(false);
        }
      }
    }
  });
});

describe("窗口1 · ② 共享素材包契约:九款一律 import art/kit", () => {
  it.each([...GAMES])("%s:至少一份非测试源码 import ../../art/kit", (game) => {
    const hit = gameSources(game).some(({ text }) => /from\s+["']\.\.\/\.\.\/art\/kit["']/.test(text));
    expect(hit, `${game} 没有 import 共享素材包`).toBe(true);
  });

  it.each([...GAMES])("%s:不自造第二份 shade/tint 调色数学", (game) => {
    for (const { file, text } of gameSources(game)) {
      expect(
        /function\s+(shade|tint|mixToward)\s*\(/.test(text),
        `${file} 里自己实现了调色函数,应从 art/kit import`
      ).toBe(false);
    }
  });
});

describe("窗口1 · ③ prefers-reduced-motion 降级路径存在", () => {
  it.each([...GAMES])("%s:源码保留 reduced-motion 引用", (game) => {
    const hit = gameSources(game).some(({ text }) => /reduced|prefers-reduced-motion/i.test(text));
    expect(hit, `${game} 没有 reduced-motion 降级引用`).toBe(true);
  });
});

describe("窗口1 · ④ 禁 three.js(离线 PWA 零外部运行时)", () => {
  it("package.json 无 three 系依赖", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(all.filter((d) => /^three($|[-@/])|^@types\/three/.test(d))).toEqual([]);
  });

  it.each([...GAMES])("%s:不 import three", (game) => {
    for (const { file, text } of gameSources(game)) {
      expect(/from\s+["']three["'/]/.test(text), `${file} import 了 three`).toBe(false);
    }
  });

  it("kit / runner / motion 基建不 import three", () => {
    for (const { file, text } of infraSources()) {
      expect(/from\s+["']three["'/]/.test(text), `${file} import 了 three`).toBe(false);
    }
  });
});

describe("窗口1 · ⑤ 360px 硬门槛:字号声明一律 ≥ 14px", () => {
  const FONT_SIZE_RE = /font-size:\s*([\d.]+)px/g;
  const FONT_SHORT_RE = /font:\s*[^;"`}]*?([\d.]+)px/g;

  it.each([...GAMES])("%s:DOM font-size 与 canvas font 全部 ≥ 14px", (game) => {
    for (const { file, text } of gameSources(game)) {
      for (const re of [FONT_SIZE_RE, FONT_SHORT_RE]) {
        re.lastIndex = 0;
        for (const m of text.matchAll(re)) {
          const px = parseFloat(m[1]);
          expect(px, `${file} 出现 ${px}px 字号(<14px):${m[0]}`).toBeGreaterThanOrEqual(14);
        }
      }
    }
  });
});

describe("窗口1 · ⑥ 商标黑名单 0 命中(含注释,孩子可见文案)", () => {
  const BRAND_WORDS = [
    "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟",
    "拳皇", "街霸", "超级玛丽", "马里奥", "割绳子", "俄罗斯方块", "tetris",
    "贪吃蛇大作战", "球球大作战", "我的世界", "minecraft", "三国杀", "大富翁",
    "斗地主", "pac-man", "pacman", "吃豆人", "宝可梦", "皮卡丘", "奥特曼",
    "喜羊羊", "蛋仔", "原神", "王者荣耀", "任天堂", "迪士尼", "nintendo",
    "disney", "mario", "pokemon", "4399"
  ] as const;

  it.each([...GAMES])("%s:非测试源码 0 命中", (game) => {
    for (const { file, text } of gameSources(game)) {
      const low = text.toLowerCase();
      for (const w of BRAND_WORDS) {
        expect(low.includes(w.toLowerCase()), `${file} 命中黑名单「${w}」`).toBe(false);
      }
    }
  });

  it("kit / runner / motion 基建 0 命中", () => {
    for (const { file, text } of infraSources()) {
      const low = text.toLowerCase();
      for (const w of BRAND_WORDS) {
        expect(low.includes(w.toLowerCase()), `${file} 命中黑名单「${w}」`).toBe(false);
      }
    }
  });
});
