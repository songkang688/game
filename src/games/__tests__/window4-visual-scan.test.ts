/**
 * 窗口 4 · 1.3 第 1 轮视觉验收 · 测试员沉淀的机器化扫描（六大专项的静态部分）。
 *
 * 覆盖本窗 9 款：duo-rush / duo-arena / duo-vs-star / sling-birds / candy-swing /
 * gold-hook / garden-guard / sprout-defense / monster-crisis。
 * 报告见 docs/qa/1.3-window4-round1-tester.md。
 *
 * 三组断言：
 *  1. 专项⑥ 商标黑名单：9 款非测试源码 0 命中（英文按全词匹配，避免
 *     chimeLevelsAt / frozenUntil 这类标识符误报）；
 *  2. 专项① canvas emoji 直出：fillText 行内 emoji——8 款为 0；
 *     garden-guard 现状 6 处钉住防恶化（【W4R1-01 · 一般 · 待修】修复后把 6 改 0）；
 *  3. 专项② 收集物体积：各款「金币 / 星星 / 收集物」绘制函数必须带 ≥2 停渐变
 *     （gold-hook 的 drawOre 现状无渐变、靠高光+描边+落影撑体积，
 *      【W4R1-05 · 一般 · 待修】单独钉现状）。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const GAMES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

const WINDOW4_GAMES = [
  "duo-rush",
  "duo-arena",
  "duo-vs-star",
  "sling-birds",
  "candy-swing",
  "gold-hook",
  "garden-guard",
  "sprout-defense",
  "monster-crisis",
] as const;

/** 某款游戏目录下全部非测试 .ts 源文件（文件名 → 源码） */
function gameSources(id: string): Array<{ file: string; src: string }> {
  const dir = join(GAMES_DIR, id);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => ({ file: `${id}/${f}`, src: readFileSync(join(dir, f), "utf8") }));
}

/* ------------------------------------------------------------------ */
/* 专项⑥ 商标黑名单                                                    */
/* ------------------------------------------------------------------ */

/** 中文商标词直接 includes 匹配 */
const TRADEMARK_CN = [
  "4399",
  "任天堂",
  "迪士尼",
  "马里奥",
  "玛丽奥",
  "超级玛丽",
  "路易吉",
  "皮卡丘",
  "宝可梦",
  "凯蒂猫",
  "托马斯",
  "炸弹人",
  "愤怒的小鸟",
  "植物大战僵尸",
  "水果忍者",
  "地铁跑酷",
  "森林冰火人",
  "拳皇",
  "街霸",
  "割绳子",
  "俄罗斯方块",
  "我的世界",
  "吃豆人",
  "奥特曼",
  "喜羊羊",
  "蛋仔",
  "原神",
  "王者荣耀",
  "米老鼠",
  "唐老鸭",
  "星之卡比",
  "艾莎",
  "冰雪奇缘",
];

/** 英文商标词全词匹配（\b 边界，避开 chimeLevelsAt 里的 "elsa" 这类标识符碎片） */
const TRADEMARK_EN = [
  "nintendo",
  "disney",
  "mario",
  "luigi",
  "pikachu",
  "pokemon",
  "bomberman",
  "tetris",
  "minecraft",
  "ultraman",
  "genshin",
  "mickey",
  "kirby",
  "elsa",
  "angry birds",
  "hello kitty",
  "pac-man",
  "pacman",
];

describe("窗口4 · 专项⑥ 商标黑名单（9 款源码 0 命中）", () => {
  for (const id of WINDOW4_GAMES) {
    it(`${id} 无任何商标词`, () => {
      for (const { file, src } of gameSources(id)) {
        for (const word of TRADEMARK_CN) {
          expect(src.includes(word), `${file} 出现中文商标词「${word}」`).toBe(false);
        }
        for (const word of TRADEMARK_EN) {
          const re = new RegExp(`\\b${word.replace(/[-\s]/g, "[-\\s]?")}\\b`, "i");
          expect(re.test(src), `${file} 出现英文商标词「${word}」`).toBe(false);
        }
      }
    });
  }
});

/* ------------------------------------------------------------------ */
/* 专项① canvas emoji 直出（fillText 行内 emoji）                       */
/* ------------------------------------------------------------------ */

const EMOJI_RANGE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{2764}]/u;

/** 数「fillText 且同一行带 emoji」的非注释行 */
function fillTextEmojiLines(id: string): string[] {
  const out: string[] = [];
  for (const { file, src } of gameSources(id)) {
    src.split("\n").forEach((line, i) => {
      if (!line.includes("fillText")) return;
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (EMOJI_RANGE.test(line)) out.push(`${file}:${i + 1}`);
    });
  }
  return out;
}

describe("窗口4 · 专项① canvas fillText emoji 直出", () => {
  // garden-guard 原有 6 处字面量已被本轮 fixer（cd187a9）清零，9 款一起守 0
  for (const id of WINDOW4_GAMES) {
    it(`${id} canvas 文本 0 emoji`, () => {
      expect(fillTextEmojiLines(id)).toEqual([]);
    });
  }

  it("garden-guard hud12 段串 emoji 残余现状 4 行钉住【W4R1-01 残余 · 一般 · 待修：换手绘后应为 0】", () => {
    // 现状：hud12.ts 的 hudSegments 仍拼 🌸 花瓣币与 💗/🤍 爱心、tip 文案带 🌸，
    // 经 index.ts drawHud 的 fillText 每帧上画布（变量拼接，抓不进上面的同行扫描）。
    const src = readFileSync(join(GAMES_DIR, "garden-guard", "hud12.ts"), "utf8");
    const lines = src
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && EMOJI_RANGE.test(l));
    expect(lines).toHaveLength(4);
  });
});

/* ------------------------------------------------------------------ */
/* 专项② 收集物体积（≥2 停渐变 + 高光 + 描边/落影）                     */
/* ------------------------------------------------------------------ */

/** 抠出 art.ts 里某个顶层导出函数的源码体（到下一个顶层 export 为止） */
function artFnBody(id: string, fnName: string): string {
  const src = readFileSync(join(GAMES_DIR, id, "art.ts"), "utf8");
  const start = src.indexOf(`export function ${fnName}(`);
  expect(start, `${id}/art.ts 里找不到 export function ${fnName}`).toBeGreaterThanOrEqual(0);
  const next = src.indexOf("\nexport ", start + 1);
  return src.slice(start, next < 0 ? undefined : next);
}

/** 渐变停靠点数：addColorStop 出现次数 */
function colorStops(body: string): number {
  return (body.match(/addColorStop\(/g) ?? []).length;
}

describe("窗口4 · 专项② 收集物体积契约", () => {
  const GRADIENT_COLLECTIBLES: Array<[string, string]> = [
    ["duo-rush", "drawCoinFrame"],
    ["duo-arena", "drawKitCoin"],
    ["duo-vs-star", "drawGoldStar"],
    ["candy-swing", "drawGoldStar"],
    ["garden-guard", "drawGoldStar"],
    ["sprout-defense", "drawClearStar"],
  ];
  for (const [id, fn] of GRADIENT_COLLECTIBLES) {
    it(`${id} 的 ${fn} 带 ≥2 停渐变 + 描边`, () => {
      const body = artFnBody(id, fn);
      expect(/create(Linear|Radial)Gradient\(/.test(body), `${fn} 无渐变`).toBe(true);
      expect(colorStops(body), `${fn} 渐变停靠点不足 2`).toBeGreaterThanOrEqual(2);
      expect(/stroke\(\)/.test(body), `${fn} 无描边`).toBe(true);
    });
  }

  it("sling-birds 小鸟身体带径向渐变 + 描边 + 高光（收集物为星级，主角即卖相担当）", () => {
    const body = artFnBody("sling-birds", "drawBirdArt");
    expect(/createRadialGradient\(/.test(body)).toBe(true);
    expect(colorStops(body)).toBeGreaterThanOrEqual(2);
    expect(/rgba\(255,\s*255,\s*255/.test(body), "无白高光").toBe(true);
  });

  it("monster-crisis 元气糖 drawCrumb 带渐变或高光其一 + 主体渐变函数 bodyGrad 存在", () => {
    const crumb = artFnBody("monster-crisis", "drawCrumb");
    const grad = artFnBody("monster-crisis", "bodyGrad");
    expect(/create(Linear|Radial)Gradient\(/.test(crumb + grad)).toBe(true);
    expect(colorStops(grad)).toBeGreaterThanOrEqual(2);
  });

  it("gold-hook drawOre：≥2 停渐变 + 高光 + 描边 + 落影四重体积线索【W4R1-05 已修，断言已收紧】", () => {
    const body = artFnBody("gold-hook", "drawOre");
    // 三重既有体积线索一个不能少（skin.lit 高光 / lineWidth+stroke 描边 / 落影椭圆）
    expect(/skin\.lit/.test(body), "高光没了").toBe(true);
    expect(/stroke\(\)/.test(body), "描边没了").toBe(true);
    expect(/ellipse\([^)]*r \* 0\.92, r \* 0\.86/.test(body) || /影子/.test(body), "落影没了").toBe(true);
    // r2 修复：体表 2 停线性渐变(lit→fill)，与 drawKitCoin 金币标准对齐
    expect(/create(Linear|Radial)Gradient\(/.test(body)).toBe(true);
    expect(colorStops(body), "渐变停靠点不足 2").toBeGreaterThanOrEqual(2);
  });
});

/* ------------------------------------------------------------------ */
/* 专项③ 双人剪影通道（静态源码契约，16px 灰度量化见报告）               */
/* ------------------------------------------------------------------ */

describe("窗口4 · 专项③ 双人形状通道源码契约", () => {
  it("duo-rush 双主角剪影三通道：P1 花苞+裙摆 / P2 星呆毛+披风", () => {
    const body = artFnBody("duo-rush", "drawRunnerSprite");
    expect(/who === 0/.test(body) && /who === 1/.test(body), "缺 P1/P2 分支").toBe(true);
    expect(/starPath\(/.test(body), "P2 星呆毛没了").toBe(true);
  });

  it("monster-crisis 双英雄帽徽形状通道：flower vs star", () => {
    const src = readFileSync(join(GAMES_DIR, "monster-crisis", "art.ts"), "utf8");
    expect(/badge:\s*"flower"/.test(src)).toBe(true);
    expect(/badge:\s*"star"/.test(src)).toBe(true);
  });

  it("duo-arena 双主角是两种形状（drawDuoFlower / drawFacetStar 均存在且互不相同）", () => {
    const flower = artFnBody("duo-arena", "drawDuoFlower");
    const star = artFnBody("duo-arena", "drawFacetStar");
    expect(flower).not.toBe(star);
    expect(/ellipse\(/.test(flower), "花瓣椭圆没了").toBe(true);
    expect(/Math\.PI \* i\) \/ 5/.test(star), "五角星切面没了").toBe(true);
  });
});
