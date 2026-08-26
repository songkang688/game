/**
 * 全仓库文案红线巡检(1.1 第 12 步新增)。
 *
 * 这一份不测任何玩法,只干三件事:
 *  1. 把**每一款**游戏的首页文案(`meta.ts` 的 title / blurb)和**每一本**攻略
 *     (`guide.ts`)扒出来,过一遍商标与官方角色名的黑名单;
 *  2. 同一批文字再过一遍「过低幼措辞」黑名单——这套游戏面向的是小学中高年级,
 *     「宝宝」「乖乖」「小笨蛋」这类说法一个都不留;
 *  3. 确认每一款游戏都配了 `guide.ts`,而且攻略结构完整、章节条目非空。
 *
 * 以后新增游戏、新增攻略,不用改这份文件就会自动被检查到。
 */
import { describe, expect, it } from "vitest";
import { isGuideBook } from "../ui/guide";
import type { GuideBook } from "../ui/level188Contract";

/* ------------------------------------------------------------------ */
/* 黑名单                                                              */
/* ------------------------------------------------------------------ */

/**
 * 商业商标与别家官方角色名。一朵一星全部内容原创,这些词一个都不许出现。
 * 只放足够独特、不会误伤正常中文的词(比如收「小猪佩奇」不收单字「猪」)。
 */
export const BRAND_WORDS: readonly string[] = [
  // —— 游戏 / 产品商标 ——
  "王者荣耀",
  "和平精英",
  "原神",
  "崩坏",
  "绝区零",
  "蛋仔派对",
  "开心消消乐",
  "植物大战僵尸",
  "愤怒的小鸟",
  "愤怒小鸟",
  "糖果传奇",
  "割绳子",
  "水果忍者",
  "羊了个羊",
  "第五人格",
  "明日方舟",
  "阴阳师",
  "炉石传说",
  "英雄联盟",
  "我的世界",
  "俄罗斯方块",
  "吃豆人",
  "赛尔号",
  "洛克王国",
  "摩尔庄园",
  "奥比岛",
  "球球大作战",
  "贪吃蛇大作战",
  "宝可梦",
  "精灵宝可梦",
  "口袋妖怪",
  "超级马里奥",
  "超级马力欧",
  "塞尔达",
  "动物森友会",
  "汤姆猫",
  "巴啦啦",
  "叶罗丽",
  "迪士尼",
  "冰雪奇缘",
  "变形金刚",
  // —— 官方角色名 ——
  "皮卡丘",
  "精灵球",
  "马里奥",
  "马力欧",
  "路易吉",
  "耀西",
  "库巴",
  "林克",
  "索尼克",
  "洛克人",
  "米老鼠",
  "米奇",
  "唐老鸭",
  "艾莎",
  "白雪公主",
  "海绵宝宝",
  "派大星",
  "奥特曼",
  "迪迦",
  "赛罗",
  "喜羊羊",
  "灰太狼",
  "懒羊羊",
  "光头强",
  "熊大",
  "熊二",
  "小猪佩奇",
  "佩奇",
  "哆啦",
  "多啦",
  "蜡笔小新",
  "柯南",
  "火影",
  "鸣人",
  "佐助",
  "路飞",
  "钢铁侠",
  "蜘蛛侠",
  "葫芦娃",
  "小马宝莉",
  "汪汪队",
  // —— 常见英文写法 ——
  "pokemon",
  "pikachu",
  "mario",
  "zelda",
  "sonic",
  "kirby",
  "minecraft",
  "roblox",
  "disney",
  "tetris",
  "pac-man",
  "digimon",
  "gundam"
];

/**
 * 过低幼措辞。这套游戏的可见文案按小学中高年级的读者写,
 * 允许连击、命中率、回合、资源、克制、策略这类词,但不许把孩子当奶娃说话。
 */
export const BABY_TALK_WORDS: readonly string[] = [
  "宝宝",
  "乖乖",
  "乖宝",
  "小笨蛋",
  "笨蛋",
  "小傻瓜",
  "傻瓜",
  "小屁孩",
  "奶娃",
  "棒棒哒",
  "美美哒",
  "萌萌哒",
  "么么哒",
  "羞羞",
  "怕怕",
  "抱抱",
  "亲亲宝",
  "吃饭饭",
  "睡觉觉",
  "喝奶奶",
  "打针针",
  "尿裤子",
  "小宝贝",
  "小乖"
];

/** 攻略里绝不能出现的「直接给答案」写法,与 ui/guide.ts 的过滤器同口径 */
const ANSWER_WORDS: readonly string[] = ["答案", "正确选项", "标准答案"];

/** 学习类游戏:攻略只讲方法与检查思路,不许出现现成结果 */
const LEARNING_GAMES: readonly string[] = [
  "math-farm",
  "word-garden",
  "pinyin-train",
  "clock-house",
  "shape-kingdom",
  "find-diff"
];

/** 写死的算式结果,例如「12 × 3 = 36」;思路可以讲,得数不能给 */
const EQUATION_RE = /\d\s*[+\-×÷*/]\s*\d+\s*=\s*\d/;

/* ------------------------------------------------------------------ */
/* 收集全仓库的可见文案                                                 */
/* ------------------------------------------------------------------ */

interface GameMeta {
  id: string;
  title: string;
  blurb: string;
}

const metaModules = import.meta.glob<{ meta: GameMeta }>("./*/meta.ts", { eager: true });
const guideModules = import.meta.glob<Record<string, unknown>>("./*/guide.ts", { eager: true });

function idFromPath(path: string): string {
  return path.split("/")[1];
}

/** 全部游戏 id,按目录名排序 */
export const GAME_IDS: string[] = Object.keys(metaModules).map(idFromPath).sort();

/** 游戏 id → 攻略书 */
const GUIDES = new Map<string, GuideBook>();
for (const [path, mod] of Object.entries(guideModules)) {
  const book = (mod.default ?? mod.guide) as GuideBook | undefined;
  if (book) GUIDES.set(idFromPath(path), book);
}

/** 一条待检查的文案:来源 + 正文 */
interface Line {
  where: string;
  text: string;
}

function metaLines(): Line[] {
  const out: Line[] = [];
  for (const [path, mod] of Object.entries(metaModules)) {
    const id = idFromPath(path);
    out.push({ where: `${id}/meta.title`, text: mod.meta.title });
    out.push({ where: `${id}/meta.blurb`, text: mod.meta.blurb });
  }
  return out;
}

function guideLines(): Line[] {
  const out: Line[] = [];
  for (const [id, book] of GUIDES) {
    out.push({ where: `${id}/guide.title`, text: book.title });
    for (const [i, tip] of book.general.entries()) {
      out.push({ where: `${id}/guide.general[${i}]`, text: tip });
    }
    for (const entry of book.entries) {
      out.push({ where: `${id}/guide 「${entry.title}」标题`, text: entry.title });
      for (const [i, tip] of entry.tips.entries()) {
        out.push({ where: `${id}/guide 「${entry.title}」tips[${i}]`, text: tip });
      }
    }
  }
  return out;
}

const ALL_LINES: Line[] = [...metaLines(), ...guideLines()];

/** 命中黑名单的第一个词;没命中返回 null */
function firstHit(text: string, words: readonly string[]): string | null {
  const low = text.toLowerCase();
  for (const w of words) {
    if (low.includes(w.toLowerCase())) return w;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 1. 黑名单巡检                                                        */
/* ------------------------------------------------------------------ */

describe("文案红线 · 商标与官方角色名", () => {
  it("黑名单本身够长,而且没有重复项", () => {
    expect(BRAND_WORDS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(BRAND_WORDS).size).toBe(BRAND_WORDS.length);
  });

  it("首页卡片的标题与介绍一个商标都不沾", () => {
    for (const line of metaLines()) {
      const hit = firstHit(line.text, BRAND_WORDS);
      expect(hit, `${line.where} 里出现了「${hit}」:${line.text}`).toBeNull();
    }
  });

  it("全部攻略正文一个商标都不沾", () => {
    for (const line of guideLines()) {
      const hit = firstHit(line.text, BRAND_WORDS);
      expect(hit, `${line.where} 里出现了「${hit}」:${line.text}`).toBeNull();
    }
  });

  it("筛子确实能拦下踩线的句子", () => {
    expect(firstHit("跟着皮卡丘一起跑", BRAND_WORDS)).toBe("皮卡丘");
    expect(firstHit("这关有点像 Minecraft", BRAND_WORDS)).toBe("minecraft");
    expect(firstHit("跟着朵朵和星星一起跑", BRAND_WORDS)).toBeNull();
  });
});

describe("文案红线 · 不许过低幼", () => {
  it("低幼词黑名单本身够长,而且没有重复项", () => {
    expect(BABY_TALK_WORDS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(BABY_TALK_WORDS).size).toBe(BABY_TALK_WORDS.length);
  });

  it("首页卡片与全部攻略都没有奶声奶气的措辞", () => {
    for (const line of ALL_LINES) {
      const hit = firstHit(line.text, BABY_TALK_WORDS);
      expect(hit, `${line.where} 里出现了「${hit}」:${line.text}`).toBeNull();
    }
  });

  it("筛子确实能拦下踩线的句子", () => {
    expect(firstHit("宝宝好棒棒哒", BABY_TALK_WORDS)).toBe("宝宝");
    expect(firstHit("连击接得越长步子越大", BABY_TALK_WORDS)).toBeNull();
  });

  it("允许出现连击、回合、资源、克制这类高年级词", () => {
    const ok = ["连击", "命中率", "回合", "资源", "克制", "策略", "先手", "冷却"];
    for (const w of ok) {
      expect(firstHit(`这一关要讲${w}`, BABY_TALK_WORDS)).toBeNull();
      expect(firstHit(`这一关要讲${w}`, BRAND_WORDS)).toBeNull();
    }
  });
});

/* ------------------------------------------------------------------ */
/* 2. 每一款都得有攻略                                                  */
/* ------------------------------------------------------------------ */

describe("攻略齐备性", () => {
  it("扫到的游戏数量和攻略数量对得上", () => {
    expect(GAME_IDS.length).toBeGreaterThanOrEqual(30);
    const missing = GAME_IDS.filter((id) => !GUIDES.has(id));
    expect(missing, `这些游戏还缺 guide.ts:${missing.join("、")}`).toEqual([]);
  });

  it("每一本攻略都符合 GuideBook 契约,gameId 和目录名一致", () => {
    for (const id of GAME_IDS) {
      const book = GUIDES.get(id);
      expect(book, `${id} 缺攻略`).toBeTruthy();
      expect(isGuideBook(book), `${id} 的攻略结构不合契约`).toBe(true);
      expect(book!.gameId, `${id} 的 gameId 写错了`).toBe(id);
      expect(book!.title.length, `${id} 的攻略标题不能为空`).toBeGreaterThan(0);
    }
  });

  it("每一本攻略都有 3–6 条通用心得", () => {
    for (const id of GAME_IDS) {
      const book = GUIDES.get(id)!;
      expect(book.general.length, `${id} 的通用心得条数不对`).toBeGreaterThanOrEqual(3);
      expect(book.general.length, `${id} 的通用心得条数不对`).toBeLessThanOrEqual(6);
      for (const tip of book.general) expect(tip.trim().length).toBeGreaterThan(0);
    }
  });

  it("每一本攻略的章节条目都非空,而且每条都带得动几句提示", () => {
    for (const id of GAME_IDS) {
      const book = GUIDES.get(id)!;
      expect(book.entries.length, `${id} 的攻略没有章节条目`).toBeGreaterThan(0);
      for (const entry of book.entries) {
        expect(entry.title.trim().length, `${id} 有条目缺标题`).toBeGreaterThan(0);
        expect(entry.tips.length, `${id}「${entry.title}」没有提示`).toBeGreaterThan(0);
        expect(entry.from, `${id}「${entry.title}」区间反了`).toBeLessThanOrEqual(entry.to);
        expect(entry.from, `${id}「${entry.title}」关卡从 1 起算`).toBeGreaterThanOrEqual(1);
        for (const tip of entry.tips) expect(tip.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("188 关的大游戏至少写满 8 条章节攻略", () => {
    // 关卡制游戏的攻略区间正好铺满关卡数;没有关卡编号的对战游戏用一个大区间兜底,
    // 所以这里只挑「最大区间落在 188 关量级」的那一批。
    const big = GAME_IDS.filter((id) => {
      const maxTo = Math.max(...GUIDES.get(id)!.entries.map((e) => e.to));
      return maxTo >= 150 && maxTo <= 200;
    });
    expect(big.length, "应该有一批 188 关的大游戏").toBeGreaterThanOrEqual(10);
    for (const id of big) {
      const book = GUIDES.get(id)!;
      expect(book.entries.length, `${id} 是 188 关的大游戏,章节攻略要 ≥8 条`).toBeGreaterThanOrEqual(8);
    }
  });

  it("第 1 关一定能翻到攻略(不会一进去就落到兜底提示)", () => {
    for (const id of GAME_IDS) {
      const book = GUIDES.get(id)!;
      const hit = book.entries.some((e) => e.from <= 1 && 1 <= e.to);
      expect(hit, `${id} 的攻略没有覆盖第 1 关`).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 3. 学习类攻略只讲方法                                                */
/* ------------------------------------------------------------------ */

describe("学习类攻略只讲方法,不给答案", () => {
  it("六款学习游戏都在,而且都配了攻略", () => {
    for (const id of LEARNING_GAMES) {
      expect(GAME_IDS, `${id} 应该是一款现有游戏`).toContain(id);
      expect(GUIDES.has(id), `${id} 缺攻略`).toBe(true);
    }
  });

  it("学习类攻略里不出现「答案」这类字眼", () => {
    for (const id of LEARNING_GAMES) {
      const book = GUIDES.get(id)!;
      const lines = guideLines().filter((l) => l.where.startsWith(`${id}/`));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        const hit = firstHit(line.text, ANSWER_WORDS);
        expect(hit, `${line.where} 里出现了「${hit}」:${line.text}`).toBeNull();
      }
      expect(book.entries.length).toBeGreaterThan(0);
    }
  });

  it("任何一本攻略都不许写死算式结果", () => {
    for (const line of guideLines()) {
      expect(EQUATION_RE.test(line.text), `${line.where} 写出了现成得数:${line.text}`).toBe(false);
    }
  });

  it("整本攻略都能通过 ui/guide.ts 的答案过滤器(一条都不会被隐藏)", async () => {
    const { stripAnswerLeaks } = await import("../ui/guide");
    for (const id of GAME_IDS) {
      const book = GUIDES.get(id)!;
      expect(stripAnswerLeaks(book.general).length, `${id} 的通用心得被过滤掉了`).toBe(
        book.general.length
      );
      for (const entry of book.entries) {
        expect(
          stripAnswerLeaks(entry.tips).length,
          `${id}「${entry.title}」有提示被答案过滤器拦掉了`
        ).toBe(entry.tips.length);
      }
    }
  });
});
