/**
 * 花色接龙 · 分级红线与平台契约巡检(规格第十五、十六节)。
 *
 * 这一份不测玩法,只做四件事:
 *  1. 把整个游戏目录的源码连注释一起扫一遍,不许蹭任何商标 ——
 *     这一款尤其危险:市面上有一款很有名的商业色彩纸牌,它的品牌名与官方喊牌口号一个字都不许出现,
 *     连函数名里的缩写也不行。为了不让被禁的词自己出现在这份文件里,黑名单是用字符码拼出来的;
 *  2. 确认喊牌一律写成「就一张」;
 *  3. 无赌博:没有筹码、没有现金、没有下注;失败文案只鼓励;
 *  4. 平台契约:meta 纯数据、index 顶部 re-export、音效白名单、destroy 收干净。
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { TIER_NAMES } from "./ai";
import { COLOR_NAMES, KIND_NAMES } from "./deck";
import guide from "./guide";
import { CHAPTERS, loseLine } from "./levels";
import { meta } from "./meta";

const dir = fileURLToPath(new URL(".", import.meta.url));
const sourceFiles = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

/** 被禁的词一个都不写成字面量,全部用字符码拼,免得这份文件自己踩线 */
const code = (...cs: number[]): string => String.fromCharCode(...cs);

/**
 * 商标黑名单。前半段是通用的,最后四条是这一款的正主:
 * 那款商业色彩纸牌的三字母品牌名、它的中文译名、以及它的官方喊牌口号写法。
 */
const BRAND_WORDS = [
  "王者荣耀",
  "植物大战僵尸",
  "愤怒的小鸟",
  "开心消消乐",
  "羊了个羊",
  "炉石传说",
  "三国杀",
  "斗地主",
  "大富翁",
  "宝可梦",
  "皮卡丘",
  "奥特曼",
  "喜羊羊",
  "蛋仔派对",
  "我的世界",
  "minecraft",
  "tetris",
  "mattel",
  "hasbro",
  // 这一款的正主:品牌名(三个字母 / 中文译名)与它的官方喊牌口号
  code(117, 110, 111),
  code(0x4f18, 0x8bfa),
  code(117, 110, 111, 33),
  code(0x559c, 0x4e50, 0x724c),
];

/** 赌博红线:分数只是星星分 */
const GAMBLE_WORDS = ["筹码", "现金", "赌", "下注", "押注", "彩金", "充值"];

function checkClean(where: string, text: string): void {
  const low = text.toLowerCase();
  for (const bad of BRAND_WORDS) {
    expect(low.includes(bad.toLowerCase()) ? `${where} 里出现了商标` : "干净").toBe("干净");
  }
  for (const bad of GAMBLE_WORDS) {
    expect(text.includes(bad) ? `${where} 里出现了「${bad}」` : "干净").toBe("干净");
  }
}

describe("花色接龙 · 卡片与名字", () => {
  it("meta 按规格落地,一个字都没跑偏", () => {
    expect(meta.id).toBe("hue-hand");
    expect(meta.title).toBe("花色接龙");
    expect(meta.emoji).toBe("🌈");
    expect(meta.category).toBe("party");
    expect(meta.color).toBe("#FFD4E8");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(meta.platform).toBe("both");
    expect(meta.blurb).toContain("就一张");
    checkClean("meta.title", meta.title);
    checkClean("meta.blurb", meta.blurb);
  });

  it("颜色名、牌型名、AI 档位名都干净", () => {
    for (const name of Object.values(COLOR_NAMES)) checkClean(`颜色 ${name}`, name);
    for (const name of Object.values(KIND_NAMES)) checkClean(`牌型 ${name}`, name);
    for (const name of Object.values(TIER_NAMES)) checkClean(`档位 ${name}`, name);
    expect(Object.values(COLOR_NAMES)).toEqual(["粉色", "黄色", "绿色", "蓝色"]);
  });

  it("喊牌一律写成「就一张」,函数名也不带任何缩写", () => {
    const src = readFileSync(`${dir}rules.ts`, "utf8");
    expect(src).toContain("oneCardPenalty");
    expect(readFileSync(`${dir}index.ts`, "utf8")).toContain("就一张");
    for (const f of sourceFiles) {
      const text = readFileSync(dir + f, "utf8");
      const shouts = text.match(/喊[^\s,。「」]{0,4}/g) ?? [];
      for (const s of shouts) checkClean(`${f} 的喊牌写法 ${s}`, s);
    }
  });
});

describe("花色接龙 · 章节与攻略", () => {
  it("八章的名字和介绍都干净,关数加起来是 188", () => {
    expect(CHAPTERS).toHaveLength(8);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL_LEVELS);
    for (const ch of CHAPTERS) {
      checkClean(`章节 ${ch.name}`, ch.name);
      checkClean(`章节 ${ch.name} 介绍`, ch.desc);
    }
  });

  it("攻略八条首尾相接,正好铺满 188 关", () => {
    expect(guide.gameId).toBe(meta.id);
    expect(guide.entries).toHaveLength(CHAPTERS.length);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(TOTAL_LEVELS);
    for (const [i, e] of guide.entries.entries()) {
      expect(e.to - e.from + 1, `第 ${i + 1} 章关数对不上`).toBe(CHAPTERS[i].size);
      if (i > 0) expect(e.from).toBe(guide.entries[i - 1].to + 1);
    }
  });

  it("攻略正文过红线筛子,而且把双人同屏的遮挡方案写清楚了", () => {
    const lines = [guide.title, ...guide.general, ...guide.entries.flatMap((e) => [e.title, ...e.tips])];
    expect(lines.length).toBeGreaterThan(20);
    for (const [i, text] of lines.entries()) checkClean(`攻略第 ${i + 1} 句`, text);
    expect(guide.general.join("")).toContain("盖");
    expect(guide.general.join("")).toContain("准备好了");
  });
});

describe("花色接龙 · 源码巡检", () => {
  it("游戏目录里该有的文件都在", () => {
    expect(sourceFiles.sort()).toEqual(
      ["ai.ts", "deck.ts", "domStub.ts", "guide.ts", "index.ts", "levels.ts", "meta.ts", "rules.ts", "score.ts", "sim.ts"].sort()
    );
  });

  it("连注释在内,全目录不出现商标,也不出现任何赌博字眼", () => {
    for (const f of sourceFiles) {
      checkClean(f, readFileSync(dir + f, "utf8"));
    }
  });

  it("失败文案只鼓励,一句难听话都没有", () => {
    expect(loseLine(1)).toBe("差一张就出完啦,下一局先攒个万能牌。");
    for (const f of sourceFiles) {
      const text = readFileSync(dir + f, "utf8");
      for (const bad of ["笨", "废物", "太差", "活该", "真菜"]) {
        expect(text.includes(bad) ? `${f} 里出现了「${bad}」` : "干净").toBe("干净");
      }
    }
  });

  it("meta.ts 是纯数据,一行玩法代码都不 import", () => {
    const src = readFileSync(`${dir}meta.ts`, "utf8");
    expect(src).not.toMatch(/^\s*import\s/m);
    for (const v of Object.values(meta)) expect(typeof v).not.toBe("function");
  });

  it("index.ts 顶部就把 meta re-export 出去了", () => {
    const src = readFileSync(`${dir}index.ts`, "utf8");
    expect(src.slice(0, 80)).toContain("export { meta }");
  });

  it("音效只用平台内置的那七个,游戏自己不碰 AudioContext", () => {
    const allowed = new Set(["tap", "win", "oops", "coin", "pop", "meow", "jump"]);
    const src = readFileSync(`${dir}index.ts`, "utf8");
    const calls = src.match(/(?:sfx|api\.play|ctx\.sfx|opts\.sfx)\(\s*"([a-z]+)"\s*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(5);
    for (const call of calls) {
      const name = /"([a-z]+)"/.exec(call)?.[1] ?? "";
      expect(allowed.has(name), `音效 ${name}`).toBe(true);
    }
    for (const f of sourceFiles) {
      expect(readFileSync(dir + f, "utf8").includes("AudioContext") ? `${f} 建了音频上下文` : "干净").toBe("干净");
    }
  });

  it("destroy 里把监听和定时器都收干净了", () => {
    const src = readFileSync(`${dir}index.ts`, "utf8");
    expect(src).toContain('removeEventListener("keydown"');
    expect(src).toContain('removeEventListener("resize"');
    expect(src).toContain("clearTimers()");
  });

  it("动效照顾了 prefers-reduced-motion", () => {
    const src = readFileSync(`${dir}index.ts`, "utf8");
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain("reduceMotion");
  });

  it("离线:没有联网、没有账号、没有外链资源", () => {
    for (const f of sourceFiles) {
      const src = readFileSync(dir + f, "utf8");
      for (const bad of ["fetch(", "XMLHttpRequest", "WebSocket", "https://", "http://", "localStorage"]) {
        expect(src.includes(bad) ? `${f} 里出现了「${bad}」` : "干净").toBe("干净");
      }
    }
  });
});
