/**
 * 音符下落 · 分级红线与平台契约巡检(规格第十五、十六节)。
 *
 * 这一份不测玩法,只做四件事:
 *  1. 把整个游戏目录的源码连注释一起扫一遍,不许蹭任何商标 ——
 *     这一款尤其危险:市面上有好几款很有名的商业下落式节奏游戏,它们的名字一个字都不许出现。
 *     为了不让被禁的词自己出现在这份文件里,黑名单是用字符码拼出来的;
 *  2. 确认所有音高都是现场合成的:没有 mp3 / wav / ogg,也没有任何外链资源;
 *  3. 失败只鼓励:miss 只说「这个音符溜走啦」;
 *  4. 平台契约:meta 纯数据、index 顶部 re-export、音效白名单、destroy 关掉 AudioContext。
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { TIER_NAMES } from "./ai";
import guide from "./guide";
import { MISS_LINE } from "./judge";
import { CHAPTERS, loseLine } from "./levels";
import { meta } from "./meta";

const dir = fileURLToPath(new URL(".", import.meta.url));
const sourceFiles = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

/** 被禁的词一个都不写成字面量,全部用字符码拼,免得这份文件自己踩线 */
const code = (...cs: number[]): string => String.fromCharCode(...cs);

/**
 * 商标黑名单。前半段是通用的,后半段是这一款的正主:
 * 几款商业下落式 / 音乐节奏游戏的中文名与英文名。
 */
const BRAND_WORDS = [
  "王者荣耀",
  "开心消消乐",
  "羊了个羊",
  "植物大战僵尸",
  "蛋仔派对",
  "我的世界",
  "宝可梦",
  "皮卡丘",
  "奥特曼",
  "喜羊羊",
  "minecraft",
  "tetris",
  // 这一款的正主:商业下落式 / 音乐节奏游戏的名字
  code(0x94a2, 0x7434, 0x5757), // 钢琴块
  code(0x522b, 0x8e29, 0x767d, 0x5757), // 别踩白块
  code(0x8282, 0x594f, 0x5927, 0x5e08), // 节奏大师
  code(0x52b2, 0x821e, 0x56e2), // 劲舞团
  code(0x592a, 0x9f13, 0x8fbe, 0x4eba), // 太鼓达人
  code(112, 105, 97, 110, 111, 32, 116, 105, 108, 101, 115), // piano tiles
  code(103, 117, 105, 116, 97, 114, 32, 104, 101, 114, 111), // guitar hero
  code(98, 101, 97, 116, 32, 115, 97, 98, 101, 114), // beat saber
  code(111, 115, 117, 33), // osu!
  code(100, 101, 101, 109, 111), // deemo
  code(99, 121, 116, 117, 115), // cytus
];

/** 有版权的曲子:一律不许出现曲名,旋律全部自合成 */
const SONG_WORDS = [
  code(0x5c0f, 0x82f9, 0x679c), // 小苹果
  code(0x8ba9, 0x6211, 0x4eec, 0x8361, 0x8d77, 0x53cc, 0x6868), // 让我们荡起双桨
  code(102, 114, 101, 101, 32, 108, 111, 111, 112, 115), // free loops
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  "new Audio(",
];

function checkClean(where: string, text: string): void {
  const low = text.toLowerCase();
  for (const bad of BRAND_WORDS) {
    expect(low.includes(bad.toLowerCase()) ? `${where} 里出现了商标` : "干净").toBe("干净");
  }
  for (const bad of SONG_WORDS) {
    expect(low.includes(bad.toLowerCase()) ? `${where} 里出现了有版权的曲子或外部音频` : "干净").toBe("干净");
  }
}

describe("音符下落 · 卡片与名字", () => {
  it("meta 按规格落地,一个字都没跑偏", () => {
    expect(meta.id).toBe("tap-tiles");
    expect(meta.title).toBe("音符下落");
    expect(meta.emoji).toBe("🎹");
    expect(meta.category).toBe("casual");
    expect(meta.color).toBe("#E8D9FF");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(meta.platform).toBe("both");
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    expect(meta.blurb).toBe("音符块落下来就点,空白格千万别碰。连击越高越好听,四条轨都是你的琴键。");
    checkClean("meta.title", meta.title);
    checkClean("meta.blurb", meta.blurb);
  });

  it("八章的名字和介绍都干净,关数加起来是 188", () => {
    expect(CHAPTERS).toHaveLength(8);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL_LEVELS);
    for (const ch of CHAPTERS) {
      checkClean(`章节 ${ch.name}`, ch.name);
      checkClean(`章节 ${ch.name} 介绍`, ch.desc);
    }
  });

  it("AI 档位名干净", () => {
    for (const name of Object.values(TIER_NAMES)) checkClean(`档位 ${name}`, name);
  });
});

describe("音符下落 · 攻略", () => {
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

  it("攻略正文过红线筛子,而且把判定窗口和键位讲清楚了", () => {
    const lines = [guide.title, ...guide.general, ...guide.entries.flatMap((e) => [e.title, ...e.tips])];
    expect(lines.length).toBeGreaterThan(20);
    for (const [i, text] of lines.entries()) checkClean(`攻略第 ${i + 1} 句`, text);
    const all = guide.general.join("");
    expect(all).toContain("45");
    expect(all).toContain("100");
    expect(all).toContain("D F J K");
  });
});

describe("音符下落 · 源码巡检", () => {
  it("游戏目录里该有的文件都在", () => {
    expect(sourceFiles.sort()).toEqual(
      [
        "ai.ts",
        "art.ts",
        "audio.ts",
        "chart.ts",
        "domStub.ts",
        "guide.ts",
        "index.ts",
        "judge.ts",
        "levels.ts",
        "meta.ts",
        "run.ts",
      ].sort()
    );
  });

  it("连注释在内,全目录不蹭商标、不碰有版权的曲子、不引外部音频文件", () => {
    for (const f of sourceFiles) checkClean(f, readFileSync(dir + f, "utf8"));
  });

  it("失败文案只鼓励:miss 就那一句,一个难听的字都没有", () => {
    expect(MISS_LINE).toBe("这个音符溜走啦");
    expect(loseLine("miss")).toContain("再试一遍");
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

  it("平台音效只用内置的那七个", () => {
    const allowed = new Set(["tap", "win", "oops", "coin", "pop", "meow", "jump"]);
    const src = readFileSync(`${dir}index.ts`, "utf8");
    const calls = src.match(/(?:sfx|api\.play|ctx\.sfx|opts\.sfx)\(\s*"([a-z]+)"\s*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(3);
    for (const call of calls) {
      const name = /"([a-z]+)"/.exec(call)?.[1] ?? "";
      expect(allowed.has(name), `音效 ${name}`).toBe(true);
    }
  });

  it("音高全是振荡器现场合成的,AudioContext 只在 audio.ts 里建", () => {
    const audio = readFileSync(`${dir}audio.ts`, "utf8");
    expect(audio).toContain("createOscillator");
    expect(audio).toContain("createGain");
    expect(audio).toContain("close()");
    for (const f of sourceFiles) {
      if (f === "audio.ts" || f === "domStub.ts") continue;
      expect(readFileSync(dir + f, "utf8").includes("AudioContext") ? `${f} 自己建了音频上下文` : "干净").toBe(
        "干净"
      );
    }
  });

  it("destroy 里把监听、rAF 和音频上下文都收干净了", () => {
    const src = readFileSync(`${dir}index.ts`, "utf8");
    expect(src).toContain('removeEventListener("keydown"');
    expect(src).toContain('removeEventListener("keyup"');
    expect(src).toContain('removeEventListener("resize"');
    expect(src).toContain("cancelAnimationFrame");
    expect(src).toContain("tones.close()");
  });

  it("动效照顾了 prefers-reduced-motion,粒子会变少", () => {
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
