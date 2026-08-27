/**
 * 豆豆迷宫 · 分级红线与文案巡检（规格第十四节）。
 *
 * 这一份不测玩法，只做三件事：
 *  1. 把孩子能看见的每一句中文过一遍筛子——不许有死亡描写，碰到小幽灵只是「绕晕」；
 *  2. 把整个游戏目录的源码连注释一起扫一遍，不许蹭任何商标；
 *     这一款尤其危险，格子迷宫吃豆是街机老题材，官方角色名和四只官方幽灵名一个都不许出现；
 *  3. 顺手把平台契约钉死：meta 纯数据、index 顶部 re-export、音效白名单、destroy 收干净。
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { GHOST_NAMES, TIER_LABELS } from "./ghosts";
import guide from "./guide";
import { CHAPTERS, TOTAL, planFor } from "./levels";
import { FRUITS } from "./logic";
import { meta } from "./meta";

const dir = fileURLToPath(new URL(".", import.meta.url));
const sourceFiles = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

/** 死亡与受伤描写：碰到小幽灵只是被绕晕，掉一颗小星命 */
const HURT_WORDS = ["死", "血", "尸", "阵亡", "牺牲", "受伤", "伤害", "消灭", "干掉", "杀", "吃掉", "残忍", "恐怖"];

/**
 * 商标与别家官方角色名。前半段是派发单点名的黑名单，
 * 后半段是这一款特有的雷区：黄色圆嘴街机角色和它那四只官方幽灵。
 * 注意不要写裸的 "pac"，CSS 里的 `white-space` 会被误伤。
 */
const BRAND_WORDS = [
  "愤怒的小鸟",
  "植物大战僵尸",
  "水果忍者",
  "地铁跑酷",
  "森林冰火人",
  "屁王兄弟",
  "拳皇",
  "街霸",
  "街头霸王",
  "超级玛丽",
  "马里奥",
  "马力欧",
  "割绳子",
  "俄罗斯方块",
  "tetris",
  "贪吃蛇大作战",
  "球球大作战",
  "我的世界",
  "minecraft",
  "三国杀",
  "大富翁",
  "斗地主",
  "宝可梦",
  "皮卡丘",
  "奥特曼",
  "喜羊羊",
  "蛋仔",
  "原神",
  "王者荣耀",
  // 这一款的正主：黄色圆嘴街机角色，中英文与它那四只官方幽灵一并拦住
  "pac-man",
  "pacman",
  "pac man",
  "puckman",
  "puck man",
  "吃豆人",
  "小蜜蜂",
  "blinky",
  "pinky",
  "clyde",
  "南梦宫",
  "namco",
  "nintendo",
  "sega",
];

/** 本作原创的角色：朵朵、星星，和四只迷途小幽灵 */
const ORIGINAL_NAMES = ["朵朵", "星星", "直直", "拐拐", "绕绕", "乱乱"];

function checkCopy(where: string, text: string): void {
  for (const bad of HURT_WORDS) {
    expect(text.includes(bad) ? `${where} 里出现了「${bad}」` : "干净").toBe("干净");
  }
  const low = text.toLowerCase();
  for (const bad of BRAND_WORDS) {
    expect(low.includes(bad.toLowerCase()) ? `${where} 里出现了「${bad}」` : "干净").toBe("干净");
  }
}

/* ------------------------------------------------------------------ */
/* 一、卡片与角色                                                      */
/* ------------------------------------------------------------------ */

describe("豆豆迷宫 · 卡片文案", () => {
  it("meta 按规格落地，一个字都没跑偏", () => {
    expect(meta.id).toBe("dot-maze");
    expect(meta.title).toBe("豆豆迷宫");
    expect(meta.emoji).toBe("🟡");
    expect(meta.category).toBe("action");
    expect(meta.color).toBe("#FFF5B8");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(meta.platform).toBe("both");
    checkCopy("meta.title", meta.title);
    checkCopy("meta.blurb", meta.blurb);
  });

  it("PA-DM-2：豆子就叫豆子，「小星」这个词只留给命数", () => {
    // 卡片、攻略、界面三处必须是同一套叫法：地上捡的是「豆 / 能量豆」，
    // 「⭐ 小星命」是掉了会结算的命数,两者不许混着说。
    const onScreen: Array<[string, string]> = [
      ["meta.blurb", meta.blurb],
      ["guide.title", guide.title],
      ...guide.general.map((t, i) => [`guide.general[${i}]`, t] as [string, string]),
      ...guide.entries.flatMap((e) => [
        [`guide「${e.title}」标题`, e.title] as [string, string],
        ...e.tips.map((t, i) => [`guide「${e.title}」tips[${i}]`, t] as [string, string]),
      ]),
    ];
    expect(onScreen.length).toBeGreaterThan(20);
    for (const [where, text] of onScreen) {
      const hit = /小星(?!命)/.exec(text);
      expect(hit ? `${where} 用「小星」称呼了命数以外的东西：${text}` : "干净").toBe("干净");
    }
    expect(meta.blurb, "卡片上得说清楚要吃的是豆子").toContain("豆子");
  });

  it("四只小幽灵用的是本作原创名，不是任何官方名", () => {
    for (const name of Object.values(GHOST_NAMES)) {
      expect(ORIGINAL_NAMES, `小幽灵 ${name}`).toContain(name);
      checkCopy(`小幽灵 ${name}`, name);
    }
    expect(Object.values(GHOST_NAMES)).toEqual(["直直", "拐拐", "绕绕", "乱乱"]);
  });

  it("三种奖励果子是原创名字，加分递增", () => {
    expect(FRUITS.map((f) => f.name)).toEqual(["星果", "糖梨", "蜜柑"]);
    for (const f of FRUITS) checkCopy(`果子 ${f.name}`, f.name);
    for (let i = 1; i < FRUITS.length; i++) expect(FRUITS[i].score).toBeGreaterThan(FRUITS[i - 1].score);
  });

  it("四个难度档的名字都干净", () => {
    for (const label of Object.values(TIER_LABELS)) checkCopy(`难度档 ${label}`, label);
  });
});

/* ------------------------------------------------------------------ */
/* 二、章节与攻略                                                      */
/* ------------------------------------------------------------------ */

describe("豆豆迷宫 · 章节与攻略", () => {
  it("八章的名字和介绍都干净，关数加起来是 188", () => {
    expect(CHAPTERS).toHaveLength(8);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL);
    for (const ch of CHAPTERS) {
      checkCopy(`章节 ${ch.name}`, ch.name);
      checkCopy(`章节 ${ch.name} 介绍`, ch.desc);
    }
  });

  it("攻略八章首尾相接，正好铺满 188 关", () => {
    expect(guide.gameId).toBe(meta.id);
    expect(guide.entries).toHaveLength(CHAPTERS.length);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(TOTAL);
    for (const [i, e] of guide.entries.entries()) {
      expect(e.from, `第 ${i + 1} 条区间反了`).toBeLessThanOrEqual(e.to);
      expect(e.to - e.from + 1, `第 ${i + 1} 章关数对不上`).toBe(CHAPTERS[i].size);
      expect(e.tips.length, `第 ${i + 1} 条没写心得`).toBeGreaterThan(0);
      if (i > 0) expect(e.from).toBe(guide.entries[i - 1].to + 1);
    }
  });

  it("攻略正文一样过红线筛子", () => {
    const lines = [guide.title, ...guide.general, ...guide.entries.flatMap((e) => [e.title, ...e.tips])];
    expect(lines.length).toBeGreaterThan(20);
    for (const [i, text] of lines.entries()) checkCopy(`攻略第 ${i + 1} 句`, text);
  });

  it("掉命文案是鼓励，不是批评", () => {
    const src = readFileSync(dir + "logic.ts", "utf8");
    expect(src).toContain("被绕晕啦，深呼吸再来一次。");
    expect(src).toContain("今天玩到这里");
    for (const bad of ["笨", "废", "菜鸟玩家", "输了活该", "太差"]) {
      expect(src.includes(bad) ? `掉命文案里出现了「${bad}」` : "干净").toBe("干净");
    }
  });
});

/* ------------------------------------------------------------------ */
/* 三、整个目录的源码（含注释）也扫一遍                                */
/* ------------------------------------------------------------------ */

describe("豆豆迷宫 · 源码巡检", () => {
  it("游戏目录里该有的文件都在", () => {
    expect(sourceFiles.sort()).toEqual(
      ["domStub.ts", "ghosts.ts", "guide.ts", "index.ts", "layout.ts", "levels.ts", "logic.ts", "maze.ts", "meta.ts"].sort()
    );
  });

  it("连注释在内，全目录不出现任何商标或官方角色名", () => {
    for (const f of sourceFiles) {
      const low = readFileSync(dir + f, "utf8").toLowerCase();
      for (const bad of BRAND_WORDS) {
        expect(low.includes(bad.toLowerCase()) ? `${f} 里出现了「${bad}」` : "干净").toBe("干净");
      }
    }
  });

  it("连注释在内，全目录不出现死亡与受伤的说法", () => {
    for (const f of sourceFiles) {
      const text = readFileSync(dir + f, "utf8");
      for (const bad of HURT_WORDS) {
        expect(text.includes(bad) ? `${f} 里出现了「${bad}」` : "干净").toBe("干净");
      }
    }
  });

  it("meta.ts 是纯数据，一行玩法代码都不 import", () => {
    const src = readFileSync(dir + "meta.ts", "utf8");
    expect(src).not.toMatch(/^\s*import\s/m);
    for (const v of Object.values(meta)) expect(typeof v).not.toBe("function");
  });

  it("index.ts 顶部就把 meta re-export 出去了", () => {
    const src = readFileSync(dir + "index.ts", "utf8");
    expect(src.slice(0, 80)).toContain('export { meta }');
  });

  it("音效只用平台内置的那七个，游戏自己不碰 AudioContext", () => {
    const allowed = new Set(["tap", "win", "oops", "coin", "pop", "meow", "jump"]);
    const src = readFileSync(dir + "index.ts", "utf8");
    const calls = src.match(/(?:sfx|api\.play|ctx\.sfx)\(\s*"([a-z]+)"\s*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(5);
    for (const call of calls) {
      const name = /"([a-z]+)"/.exec(call)?.[1] ?? "";
      expect(allowed.has(name), `音效 ${name}`).toBe(true);
    }
    for (const f of sourceFiles) {
      const text = readFileSync(dir + f, "utf8");
      expect(text.includes("AudioContext") ? `${f} 里自己建了音频上下文` : "干净").toBe("干净");
    }
  });

  it("destroy 里把 rAF 和监听都收干净了", () => {
    const src = readFileSync(dir + "index.ts", "utf8");
    expect(src).toContain("cancelAnimationFrame");
    expect(src).toContain('removeEventListener("keydown"');
    expect(src).toContain('removeEventListener("touchstart"');
    expect(src).toContain('removeEventListener("touchend"');
  });

  it("减弱动效被真的用上了：闪烁会关掉，预警改成描边", () => {
    const src = readFileSync(dir + "index.ts", "utf8");
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain("reducedMotion");
  });

  it("没有联网、没有账号、没有外链资源", () => {
    for (const f of sourceFiles) {
      const src = readFileSync(dir + f, "utf8");
      for (const bad of ["fetch(", "XMLHttpRequest", "WebSocket", "https://", "http://", "localStorage"]) {
        expect(src.includes(bad) ? `${f} 里出现了「${bad}」` : "干净").toBe("干净");
      }
    }
  });

  it("HUD 的分数与命数字号不小于 13px", () => {
    const src = readFileSync(dir + "index.ts", "utf8");
    for (const [, size] of src.matchAll(/\.dmz-chip\{[^}]*font-size:(\d+)px/g)) {
      expect(Number(size)).toBeGreaterThanOrEqual(13);
    }
    const chipRules = [...src.matchAll(/\.dmz-chip\{[^}]*\}/g)];
    expect(chipRules.length).toBeGreaterThan(0);
  });

  it("188 关的每一关都排得出配置，档位名也都在册", () => {
    for (let lv = 0; lv < TOTAL; lv++) {
      const plan = planFor(lv);
      expect(TIER_LABELS[plan.tier], `第 ${lv + 1} 关档位不认识`).toBeTruthy();
      expect(plan.ghostCount).toBeGreaterThanOrEqual(0);
      expect(plan.ghostCount).toBeLessThanOrEqual(4);
      expect(plan.lives).toBeGreaterThan(0);
    }
  });
});
