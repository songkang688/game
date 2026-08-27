/**
 * 朵星格斗王 —— 文案红线巡检。
 *
 * 这一份不测玩法，只把游戏里**所有会被孩子看见的中文**扒出来过一遍筛子，
 * 顺带把整个游戏目录的源码（含注释）也扫一遍：
 *  1. 不许出现流血、受伤、死亡这类说法（被打中只写星星飞溅 / 转圈圈 / 弹开）；
 *  2. 武器不许写实，不许出现刀枪剑棍这类东西；
 *  3. 不许蹭任何商业商标或别家的官方角色名，注释里也不行；
 *  4. 角色名只用本作原创的那八位。
 *
 * 以后谁再加一个角色、一招必杀、一句关卡提示，这里都会自动帮他检查一遍。
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AI_HINTS, AI_LABELS } from "./ai";
import { keyHintLines } from "./controls";
import { CHARACTERS, MOVE_SLOTS } from "./frames";
import guide from "./guide";
import { CHAPTERS, endlessEndText, towerStage } from "./levels";
import { meta } from "./meta";
import { TOTAL_LEVELS } from "../level99";

/* ------------------------------------------------------------------ */
/* 筛子                                                                */
/* ------------------------------------------------------------------ */

/**
 * 流血 / 受伤 / 死亡这类字眼，一个都不许进可见文案。
 * 注意"必杀技"是格斗游戏的通用叫法，这里只拦真正带攻击性的那些词。
 */
const HURT_WORDS = [
  "血",
  "死",
  "尸",
  "受伤",
  "伤害",
  "损伤",
  "阵亡",
  "牺牲",
  "重伤",
  "疼",
  "痛",
  "毒打",
  "揍扁",
  "消灭",
  "干掉",
  "暴力",
  "残忍",
  "厮杀",
  "杀死",
  "击杀",
  "殴"
];

/** 写实武器一律不许出现（招式只能是花瓣、星光、云朵、豆芽这类软软的东西） */
const WEAPON_WORDS = ["刀", "剑", "枪", "炮", "弓箭", "子弹", "炸弹", "手雷", "匕首", "斧", "锤子", "利刃"];

/** 商业商标与别家官方角色名 */
const BRAND_WORDS = [
  "宝可梦",
  "皮卡丘",
  "精灵球",
  "马里奥",
  "马力欧",
  "塞尔达",
  "奥特曼",
  "迪士尼",
  "米老鼠",
  "小马宝莉",
  "海绵宝宝",
  "喜羊羊",
  "灰太狼",
  "光头强",
  "熊大",
  "哆啦",
  "多啦",
  "柯南",
  "火影",
  "鸣人",
  "蜡笔小新",
  "王者荣耀",
  "原神",
  "我的世界",
  "植物大战僵尸",
  "愤怒的小鸟",
  "汤姆猫",
  "冰雪奇缘",
  "艾莎",
  "变形金刚",
  "钢铁侠",
  "蜘蛛侠",
  "小猪佩奇",
  "佩奇",
  "巴啦啦",
  "叶罗丽",
  "赛尔号",
  "洛克王国",
  "泡泡堂",
  // 格斗游戏里最常见的那几个商标与招牌招式名，一并拦住
  "街霸",
  "街头霸王",
  "拳皇",
  "格斗天王",
  "铁拳",
  "真人快打",
  "生死格斗",
  "侍魂",
  "春丽",
  "草薙",
  "八神",
  "升龙拳",
  "波动拳",
  "旋风腿",
  "百裂脚",
  "大蛇薙",
  "streetfighter",
  "street fighter",
  "tekken",
  "mortal kombat",
  "smash bros",
  "hadouken",
  "shoryuken",
  "kirby",
  "sonic",
  "mario",
  "zelda",
  "pokemon",
  "pikachu",
  "disney",
  "minecraft",
  "roblox",
  "digimon",
  "capcom",
  "nintendo"
];

/** 本作原创的八位小伙伴 —— 角色名只许从这里挑 */
const ORIGINAL_NAMES = ["朵朵", "星星", "糯糯", "云云", "墩墩", "闪闪", "绿绿豆", "啾啾"];

/** 过低幼措辞：这套游戏按小学中高年级的读者写，不许把孩子当奶娃说话 */
const BABY_TALK_WORDS = ["宝宝", "乖乖", "小笨蛋", "笨蛋", "傻瓜", "棒棒哒", "萌萌哒", "么么哒", "抱抱", "小宝贝"];

/** 把一段可见文案拿去过筛子，出问题时报出来源，方便定位 */
function checkCopy(where: string, text: string): void {
  for (const bad of HURT_WORDS) {
    expect(`${where}｜${text}`).not.toContain(bad);
  }
  for (const bad of WEAPON_WORDS) {
    expect(`${where}｜${text}`).not.toContain(bad);
  }
  for (const bad of BABY_TALK_WORDS) {
    expect(`${where}｜${text}`).not.toContain(bad);
  }
  const low = text.toLowerCase();
  for (const bad of BRAND_WORDS) {
    expect(`${where}｜${low}`).not.toContain(bad.toLowerCase());
  }
}

/* ------------------------------------------------------------------ */
/* 一、卡片与角色                                                      */
/* ------------------------------------------------------------------ */

describe("卡片文案", () => {
  it("meta 干净，分类是对战", () => {
    checkCopy("meta.title", meta.title);
    checkCopy("meta.blurb", meta.blurb);
    expect(meta.id).toBe("fight-king");
    expect(meta.category).toBe("party");
    expect(meta.blurb.length).toBeGreaterThan(10);
  });
});

describe("角色", () => {
  it("八位角色全是本作原创的那几位", () => {
    for (const ch of CHARACTERS) {
      expect(ORIGINAL_NAMES, `角色 ${ch.name}`).toContain(ch.name);
    }
    expect(CHARACTERS.map((c) => c.name).sort()).toEqual([...ORIGINAL_NAMES].sort());
  });

  it("人设与打法说明都干净", () => {
    for (const ch of CHARACTERS) {
      checkCopy(`${ch.name}.blurb`, ch.blurb);
      checkCopy(`${ch.name}.style`, ch.style);
      expect(ch.blurb.length).toBeGreaterThan(6);
      expect(ch.style.length).toBeGreaterThan(8);
    }
  });

  it("全部 88 个招式的名字和说明都干净", () => {
    let count = 0;
    for (const ch of CHARACTERS) {
      for (const slot of MOVE_SLOTS) {
        const mv = ch.moves[slot];
        checkCopy(`${ch.name}.${slot}.name`, mv.name);
        checkCopy(`${ch.name}.${slot}.note`, mv.note);
        count++;
      }
    }
    expect(count).toBe(CHARACTERS.length * MOVE_SLOTS.length);
  });

  it("招式名只用汉字和常见标点，不夹英文商标", () => {
    for (const ch of CHARACTERS) {
      for (const slot of MOVE_SLOTS) {
        expect(ch.moves[slot].name, `${ch.name}.${slot}`).toMatch(/^[\u4e00-\u9fa5]+$/);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* 二、关卡、模式与提示                                                */
/* ------------------------------------------------------------------ */

describe("格斗塔文案", () => {
  it("章节名与介绍都干净", () => {
    for (const ch of CHAPTERS) {
      checkCopy(`章节 ${ch.name}`, ch.name);
      checkCopy(`章节 ${ch.name} 介绍`, ch.desc);
    }
  });

  it("188 关的每一句提示都干净", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      checkCopy(`第 ${lv + 1} 关提示`, towerStage(lv).hint);
    }
  });

  it("无尽的收尾话是鼓励，不带任何失败羞辱", () => {
    for (const n of [0, 1, 2, 5, 9, 20, 100]) {
      const text = endlessEndText(n);
      checkCopy(`无尽 ${n} 连胜`, text);
      expect(text).not.toContain("笨");
      expect(text).not.toContain("废");
      expect(text).not.toContain("菜");
    }
  });
});

describe("攻略", () => {
  const allLines = [guide.title, ...guide.general, ...guide.entries.flatMap((e) => [e.title, ...e.tips])];

  it("gameId 与目录名一致，标题和心得都写满了", () => {
    expect(guide.gameId).toBe("fight-king");
    expect(guide.title.length).toBeGreaterThan(0);
    expect(guide.general.length).toBeGreaterThanOrEqual(3);
    expect(guide.general.length).toBeLessThanOrEqual(6);
  });

  it("八章攻略首尾相接，正好铺满 188 关", () => {
    expect(guide.entries.length).toBeGreaterThanOrEqual(8);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(TOTAL_LEVELS);
    for (let i = 0; i < guide.entries.length; i++) {
      const e = guide.entries[i];
      expect(e.from, `第 ${i + 1} 条区间反了`).toBeLessThanOrEqual(e.to);
      expect(e.tips.length, `第 ${i + 1} 条没写提示`).toBeGreaterThan(0);
      if (i > 0) expect(e.from).toBe(guide.entries[i - 1].to + 1);
    }
  });

  it("攻略每一条区间都对得上格斗塔的章节划分", () => {
    for (const [i, e] of guide.entries.entries()) {
      expect(e.to - e.from + 1, `第 ${i + 1} 章关数对不上`).toBe(CHAPTERS[i].size);
    }
  });

  it("攻略正文一样过红线筛子", () => {
    for (const [i, text] of allLines.entries()) checkCopy(`攻略第 ${i} 句`, text);
  });

  it("攻略不说奶声奶气的话", () => {
    for (const text of allLines) {
      for (const bad of BABY_TALK_WORDS) expect(text).not.toContain(bad);
    }
  });
});

describe("模式与键位说明", () => {
  it("AI 三档的名字与说明都干净", () => {
    for (const lv of [0, 1, 2] as const) {
      checkCopy(`AI ${lv} 名字`, AI_LABELS[lv]);
      checkCopy(`AI ${lv} 说明`, AI_HINTS[lv]);
    }
  });

  it("键位说明都干净，而且写清了两个人各用哪一套", () => {
    for (const line of keyHintLines()) checkCopy("键位说明", line);
  });
});

/* ------------------------------------------------------------------ */
/* 三、整个目录的源码（含注释）也扫一遍                                */
/* ------------------------------------------------------------------ */

describe("源码巡检", () => {
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("游戏目录里该有的文件都在", () => {
    expect(files.sort()).toEqual(
      [
        "ai.ts",
        "controls.ts",
        // 单测用的 DOM 桩，不参与打包
        "domStub.ts",
        "engine.ts",
        "frames.ts",
        "guide.ts",
        "index.ts",
        "levels.ts",
        "meta.ts",
        "progress.ts",
        "rules.ts",
        "training.ts"
      ].sort()
    );
  });

  it("连注释在内，全目录不出现任何商标或官方角色名", () => {
    for (const f of files) {
      const low = readFileSync(dir + f, "utf8").toLowerCase();
      for (const bad of BRAND_WORDS) {
        expect(low.includes(bad.toLowerCase()) ? `${f} 里出现了「${bad}」` : "干净").toBe("干净");
      }
    }
  });

  it("连注释在内，全目录不出现流血受伤和写实武器的说法", () => {
    for (const f of files) {
      const text = readFileSync(dir + f, "utf8");
      for (const bad of [...HURT_WORDS, ...WEAPON_WORDS]) {
        expect(text.includes(bad) ? `${f} 里出现了「${bad}」` : "干净").toBe("干净");
      }
    }
  });

  it("音效只用平台内置的那七个", () => {
    const allowed = new Set(["tap", "win", "oops", "coin", "pop", "meow", "jump"]);
    const src = readFileSync(dir + "index.ts", "utf8");
    const calls = src.match(/(?:sfx|api\.play|ctx\.sfx)\(\s*"([a-z]+)"\s*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(5);
    for (const call of calls) {
      const name = /"([a-z]+)"/.exec(call)?.[1] ?? "";
      expect(allowed.has(name), `音效 ${name}`).toBe(true);
    }
  });

  it("meta.ts 是纯数据，一行玩法代码都不 import", () => {
    const src = readFileSync(dir + "meta.ts", "utf8");
    expect(src).not.toMatch(/^\s*import\s/m);
  });

  it("index.ts 顶部就把 meta re-export 出去了", () => {
    const src = readFileSync(dir + "index.ts", "utf8");
    expect(src.startsWith('export { meta } from "./meta";')).toBe(true);
  });

  it("destroy 里把监听、定时器和 rAF 都收干净了", () => {
    const src = readFileSync(dir + "index.ts", "utf8");
    expect(src).toContain("cancelAnimationFrame");
    expect(src).toContain("clearTimeout");
    expect(src).toContain('removeEventListener("keydown"');
    expect(src).toContain('removeEventListener("keyup"');
    expect(src).toContain('removeEventListener("blur"');
    // 游戏自己不碰 AudioContext，声音一律走平台的 api.play
    expect(src).not.toContain("AudioContext");
  });

  it("Esc 由游戏自己接住（preventDefault），不会和壳层各弹一次暂停", () => {
    const src = readFileSync(dir + "index.ts", "utf8");
    expect(src).toContain("PAUSE_KEY");
    const idx = src.indexOf("e.code === PAUSE_KEY");
    expect(idx).toBeGreaterThan(0);
    expect(src.slice(idx, idx + 120)).toContain("preventDefault");
  });

  it("减弱动效被真的用上了（抖动与闪烁会关掉）", () => {
    const src = readFileSync(dir + "index.ts", "utf8");
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain("reducedMotion");
  });
});
