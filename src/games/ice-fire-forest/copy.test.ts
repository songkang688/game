/**
 * 冰冰火火森林 · 文案红线巡检。
 *
 * 这一份不测玩法,只把这个目录里**所有会被孩子看见的中文**(连注释一起)过一遍筛子:
 *  1. 一个商业商标 / 别家官方角色名都不许出现 —— 注释里也不许;
 *  2. 不许出现流血、受伤、骂人一类的说法;
 *  3. 角色只用本作原创的名字;
 *  4. 面向约小学六年级,不要低幼叠词与「宝宝」这种称呼。
 *
 * 以后谁再往章节表、攻略、提示语里加一句话,这里都会自动帮他检查一遍。
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BARRIER_HINTS, CHAPTERS, GUIDE } from "./levels";
import { HERO_NAMES, HERO_SHORT, LEGEND, loseLine, waitingLine, winLine } from "./logic";
import { meta } from "./meta";

const HERE = dirname(fileURLToPath(import.meta.url));

/** 目录里的实现文件(测试文件不算,测试里为了写用例会提到一些被禁的词) */
function sourceFiles(): Array<{ name: string; text: string }> {
  return readdirSync(HERE)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((name) => ({ name, text: readFileSync(join(HERE, name), "utf8") }));
}

/** 商业商标与别家官方角色名:一个都不许进代码与文案 */
const TRADEMARKS = [
  "森林冰火人",
  "冰火人",
  "屁王兄弟",
  "愤怒的小鸟",
  "植物大战僵尸",
  "水果忍者",
  "地铁跑酷",
  "超级玛丽",
  "马里奥",
  "割绳子",
  "我的世界",
  "塞尔达",
  "宝可梦",
  "皮卡丘",
  "索尼克",
  "吃豆人",
  "俄罗斯方块",
  "拳皇",
  "Mario",
  "Sonic",
  "Minecraft",
  "Zelda",
  "Pokemon",
  "Tetris",
  "Pac-Man",
];

/** 流血受伤与骂人的说法 */
const HARSH = [
  "流血",
  "受伤",
  "打死",
  "杀死",
  "恶心",
  "笨",
  "蠢",
  "傻",
  "废物",
  "没用",
  "失败者",
  "讨厌鬼",
];

/** 低幼到肉麻的称呼 */
const BABY_TALK = ["宝宝", "乖乖", "小笨蛋", "小可怜"];

/** 全部会被孩子看见的中文串 */
function visibleStrings(): string[] {
  const out: string[] = [meta.title, meta.blurb, GUIDE.title, ...GUIDE.general];
  for (const ch of CHAPTERS) out.push(ch.name, ch.desc);
  for (const text of Object.values(BARRIER_HINTS)) out.push(text);
  for (const e of GUIDE.entries) out.push(e.title, ...e.tips);
  for (const e of LEGEND) out.push(e.name);
  out.push(HERO_NAMES.ice, HERO_NAMES.fire, HERO_SHORT.ice, HERO_SHORT.fire);
  out.push(loseLine("time"), loseLine("hearts"));
  out.push(waitingLine(true, false), waitingLine(false, true), waitingLine(true, true));
  const run = { gems: 2, totalGems: 3, seconds: 40, steps: 60, hearts: 3 };
  out.push(winLine(run, 1), winLine(run, 2), winLine({ ...run, gems: 3 }, 3));
  return out;
}

describe("商标红线", () => {
  it("整个目录(含注释)一个商标都没有", () => {
    for (const file of sourceFiles()) {
      for (const word of TRADEMARKS) {
        expect(file.text.includes(word), `${file.name} 里出现了「${word}」`).toBe(false);
      }
    }
  });

  it("实现文件里也没有流血受伤和骂人的说法", () => {
    for (const file of sourceFiles()) {
      for (const word of HARSH) {
        expect(file.text.includes(word), `${file.name} 里出现了「${word}」`).toBe(false);
      }
    }
  });

  // 1.1 第 12 步:攻略统一走 src/games/<id>/guide.ts 的懒加载约定,这里多了一层转发文件。
  // 1.2 第 16 步:手感、合作机关、检查点、摄像机、单人切换各自独立成文件,
  // 另加一份只给用例用的 DOM 桩(不带 .test. 后缀,所以也会被这条扫到)。
  it("目录里真的有该有的实现文件", () => {
    const names = sourceFiles().map((f) => f.name).sort();
    expect(names).toEqual([
      "camera.ts",
      "checkpoint.ts",
      "coop.ts",
      "domStub.ts",
      "feel.ts",
      "guide.ts",
      "index.ts",
      "levels.ts",
      "logic.ts",
      "meta.ts",
      "solo.ts",
    ]);
  });
});

describe("可见文案", () => {
  const strings = visibleStrings();

  it("没有低幼称呼,也没有骂人的词", () => {
    for (const text of strings) {
      for (const word of [...HARSH, ...BABY_TALK]) {
        expect(text.includes(word), `「${text}」里出现了「${word}」`).toBe(false);
      }
    }
  });

  it("每一句都不是空的,而且都带中文", () => {
    for (const text of strings) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(/[\u4e00-\u9fa5]/.test(text), `「${text}」没有中文`).toBe(true);
    }
  });

  it("只用得上汉字、常见标点、数字与几个按键名", () => {
    const allowed = /^[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef0-9A-Za-z·,。!?、;:「」()《》…—\-\s/+*#~^%\\<>.]+$/u;
    for (const text of strings) {
      const stripped = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}]/gu, "");
      expect(allowed.test(stripped), `「${text}」出现了奇怪的字符`).toBe(true);
    }
  });

  it("角色只用本作原创的名字", () => {
    expect(HERO_NAMES.ice).toBe("冰灵·凛凛");
    expect(HERO_NAMES.fire).toBe("火灵·焰焰");
    const joined = strings.join("");
    for (const name of ["凛凛", "焰焰"]) expect(joined).toContain(name);
  });

  it("meta 的标题短、介绍长度合适,而且说清了三个模式问题里的「能闯关吗」", () => {
    expect(meta.title.length).toBeLessThanOrEqual(8);
    expect(meta.blurb.length).toBeGreaterThanOrEqual(20);
    expect(meta.blurb.length).toBeLessThanOrEqual(60);
    expect(meta.blurb).toContain("188");
    expect(meta.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("攻略里把两套键位和 Tab 换人都写清楚了", () => {
    const joined = [...GUIDE.general, ...GUIDE.entries.flatMap((e) => e.tips)].join("");
    expect(joined).toContain("Tab");
    expect(joined).toContain("W A S D");
    expect(joined).toContain("方向键");
  });

  it("章节介绍长短适中,读起来不像给小小孩看的", () => {
    for (const ch of CHAPTERS) {
      expect(ch.desc.length).toBeGreaterThanOrEqual(15);
      expect(ch.desc.length).toBeLessThanOrEqual(60);
    }
  });
});
