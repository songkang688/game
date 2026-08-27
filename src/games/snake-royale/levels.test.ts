import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, totalSize } from "../level99";
import { meta } from "./meta";
import guide from "./guide";
import {
  CHAPTERS,
  ENDLESS_MAX_FOOD,
  ENDLESS_MAX_SHRINK,
  chapterIndexOf,
  endlessConfig,
  goalLine,
  goalTarget,
  levelConfig,
  levelWon,
  starsFor
} from "./levels";
import {
  BOT_COLORS,
  SKINS,
  SKIN_KEY,
  isUnlocked,
  nextSkinHint,
  nodeColor,
  parseSkinChoice,
  serializeSkinChoice,
  skinById,
  unlockedSkins
} from "./skins";

/** 面向孩子的产品红线:这些词一个都不许出现 */
const BRANDS = [
  "愤怒的小鸟",
  "植物大战僵尸",
  "水果忍者",
  "地铁跑酷",
  "森林冰火人",
  "屁王兄弟",
  "拳皇",
  "街霸",
  "超级玛丽",
  "马里奥",
  "割绳子",
  "俄罗斯方块",
  "Tetris",
  "贪吃蛇大作战",
  "球球大作战",
  "我的世界",
  "Minecraft",
  "三国杀",
  "大富翁",
  "斗地主",
  "Pac-Man",
  "吃豆人",
  "宝可梦",
  "皮卡丘",
  "奥特曼",
  "喜羊羊",
  "蛋仔",
  "原神",
  "王者荣耀"
];

const SOURCES = ["meta.ts", "index.ts", "body.ts", "logic.ts", "ai.ts", "levels.ts", "skins.ts", "guide.ts"].map(
  (f) => ({ f, text: readFileSync(new URL(`./${f}`, import.meta.url), "utf8") })
);

describe("snake-royale · meta", () => {
  it("id / 标题 / 分类都按规格填", () => {
    expect(meta.id).toBe("snake-royale");
    expect(meta.title).toBe("长蛇争霸");
    expect(meta.emoji).toBe("🐍");
    expect(meta.category).toBe("action");
    expect(meta.color).toBe("#D8F5D0");
    expect(meta.levels).toBe(TOTAL_LEVELS);
  });

  it("四种模式都声明了,手游端游都能玩", () => {
    expect([...meta.modes]).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    expect(meta.platform).toBe("both");
  });

  it("meta 是纯数据,不 import 任何玩法", () => {
    const src = SOURCES.find((s) => s.f === "meta.ts")!.text;
    expect(src).not.toMatch(/^import .*from "\.\/(index|logic|ai|levels|body|skins)"/m);
  });

  it("一句话简介说清和格子贪吃蛇的区别:开阔场、越长越长", () => {
    expect(meta.blurb).toContain("长");
    expect(meta.blurb.length).toBeLessThan(60);
  });
});

describe("snake-royale · 188 关章节", () => {
  it("八章加起来正好 188", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
  });

  it("章节数与关数按规格切分", () => {
    expect(CHAPTERS).toHaveLength(8);
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
  });

  it("每一章都有名字、图标和给孩子看的说明", () => {
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.desc.length).toBeGreaterThan(8);
      expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("关号能对到正确的章", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(23)).toBe(0);
    expect(chapterIndexOf(24)).toBe(1);
    expect(chapterIndexOf(187)).toBe(7);
    expect(chapterIndexOf(9999)).toBe(7);
  });
});

describe("snake-royale · 关卡配置", () => {
  it("同一关每次进来都一样", () => {
    expect(levelConfig(99)).toEqual(levelConfig(99));
  });

  it("关号越界会被夹回合法范围", () => {
    expect(levelConfig(-5).level).toBe(0);
    expect(levelConfig(9999).level).toBe(TOTAL_LEVELS - 1);
    expect(levelConfig(Number.NaN).level).toBe(0);
  });

  it("场地、对手和目标一路变难", () => {
    const first = levelConfig(0);
    const mid = levelConfig(99);
    const last = levelConfig(187);
    expect(mid.mapR).toBeGreaterThan(first.mapR);
    expect(last.mapR).toBeGreaterThan(mid.mapR);
    expect(last.bots).toBeGreaterThan(first.bots);
    expect(last.food).toBeGreaterThan(first.food);
  });

  it("第 1 关最友好:菜鸟对手、不缩圈、不起雾", () => {
    const c = levelConfig(0);
    expect(c.botTier).toBe("rookie");
    expect(c.shrink).toBe(0);
    expect(c.fog).toBe(false);
    expect(c.bots).toBeGreaterThanOrEqual(1);
  });

  it("第 100 / 145 / 188 关都能真的开局", () => {
    for (const lv of [99, 144, 187]) {
      const c = levelConfig(lv);
      expect(c.bots).toBeGreaterThanOrEqual(1);
      expect(c.bots).toBeLessThanOrEqual(9);
      expect(c.food).toBeGreaterThan(0);
      expect(c.mapR).toBeGreaterThan(300);
      expect(goalLine(c).length).toBeGreaterThan(4);
    }
  });

  it("缩圈只在缩圈原野和长蛇杯出现", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const ci = chapterIndexOf(lv);
      const c = levelConfig(lv);
      if (ci === 5 || ci === 7) expect(c.shrink).toBeGreaterThan(0);
      else expect(c.shrink).toBe(0);
    }
  });

  it("夜色迷雾之后才起雾", () => {
    expect(levelConfig(0).fog).toBe(false);
    expect(levelConfig(145).fog).toBe(true);
    expect(levelConfig(187).fog).toBe(true);
  });

  it("拦头课和绕圈成环才要求拦下别人,而且后者要求更多", () => {
    expect(levelConfig(50).goal).toBe("intercept");
    expect(levelConfig(50).targetStops).toBeGreaterThanOrEqual(1);
    expect(levelConfig(110).goal).toBe("intercept");
    expect(levelConfig(110).targetStops).toBeGreaterThanOrEqual(2);
    expect(levelConfig(0).targetStops).toBe(0);
  });

  it("最后一章才上地狱对手", () => {
    expect(levelConfig(0).botTier).toBe("rookie");
    expect(levelConfig(187).botTier).toBe("hell");
    expect(levelConfig(100).botTier).not.toBe("hell");
  });

  it("无尽一波比一波密,对手一波比一波强", () => {
    const w1 = endlessConfig(1);
    const w9 = endlessConfig(9);
    expect(w9.food).toBeGreaterThan(w1.food);
    expect(w9.bots).toBeGreaterThanOrEqual(w1.bots);
    expect(w9.shrink).toBeGreaterThan(w1.shrink);
    expect(w9.botTier).toBe("hell");
    expect(endlessConfig(-3).food).toBe(endlessConfig(1).food);
  });

  // -------------------------------------------------------------------------
  // 第 2 轮 W1-R2-01:无尽的三个旋钮里只有 bots 封了顶
  // -------------------------------------------------------------------------

  it("收圈速度有上限,再往后走也不会一眨眼收到底", () => {
    for (const w of [1, 15, 20, 50, 100, 5000, 1e6]) {
      expect(endlessConfig(w).shrink, `第 ${w} 波`).toBeLessThanOrEqual(ENDLESS_MAX_SHRINK);
    }
    // 起圈 mapR*0.96 = 1440,收到 180 就不再收:收圈窗口不许短过 50 秒
    const span = 1500 * 0.96 - 180;
    for (const w of [20, 100, 5000]) {
      expect(span / endlessConfig(w).shrink, `第 ${w} 波的收圈窗口`).toBeGreaterThan(50);
    }
  });

  it("食物数有上限,不会为了「更难」把每帧要遍历的数组撑爆", () => {
    for (const w of [1, 20, 100, 500, 5000, 1e6]) {
      expect(endlessConfig(w).food, `第 ${w} 波`).toBeLessThanOrEqual(ENDLESS_MAX_FOOD);
    }
    expect(endlessConfig(1e6).food).toBe(ENDLESS_MAX_FOOD);
  });

  it("封顶只在后面才生效:孩子玩得到的前十四波一个数字都没变", () => {
    for (let w = 1; w <= 14; w++) {
      expect(endlessConfig(w).shrink, `第 ${w} 波收圈`).toBeCloseTo(3 + w * 1.3, 6);
      expect(endlessConfig(w).food, `第 ${w} 波食物`).toBe(170 + w * 8);
    }
  });

  it("难度照旧一波一波在涨,只是涨在「要长多长」上", () => {
    for (const w of [20, 50, 100]) {
      expect(endlessConfig(w + 1).targetLen).toBeGreaterThan(endlessConfig(w).targetLen);
    }
  });
});

describe("snake-royale · 胜负与评星", () => {
  it("先去休息就不算赢", () => {
    const cfg = levelConfig(0);
    expect(levelWon(cfg, { alive: false, length: 9999, rank: 1, stops: 9 })).toBe(false);
  });

  it("长度关看长度", () => {
    const cfg = levelConfig(0);
    expect(levelWon(cfg, { alive: true, length: cfg.targetLen, rank: 5, stops: 0 })).toBe(true);
    expect(levelWon(cfg, { alive: true, length: cfg.targetLen - 1, rank: 1, stops: 0 })).toBe(false);
  });

  it("名次关看名次", () => {
    const cfg = levelConfig(150);
    expect(cfg.goal).toBe("rank");
    expect(levelWon(cfg, { alive: true, length: 1, rank: cfg.targetRank, stops: 0 })).toBe(true);
    expect(levelWon(cfg, { alive: true, length: 9999, rank: cfg.targetRank + 1, stops: 0 })).toBe(false);
    expect(levelWon(cfg, { alive: true, length: 9999, rank: 0, stops: 0 })).toBe(false);
  });

  it("拦头关看拦下几条", () => {
    const cfg = levelConfig(50);
    expect(levelWon(cfg, { alive: true, length: 1, rank: 9, stops: cfg.targetStops })).toBe(true);
    expect(levelWon(cfg, { alive: true, length: 9999, rank: 1, stops: cfg.targetStops - 1 })).toBe(false);
    expect(goalTarget(cfg)).toBe(cfg.targetStops);
  });

  it("没达标只给一星,超得多又快才三星", () => {
    expect(starsFor(50, 100, 10, 60)).toBe(1);
    expect(starsFor(200, 100, 5, 60)).toBe(3);
    expect(starsFor(112, 100, 55, 60)).toBe(2);
    expect(starsFor(100, 100, 59, 60)).toBe(1);
  });

  it("目标一句话说清,还会提醒缩圈和迷雾", () => {
    expect(goalLine(levelConfig(0))).toContain("长到");
    expect(goalLine(levelConfig(125))).toContain("安全区在收");
    expect(goalLine(levelConfig(150))).toContain("视野变窄");
  });
});

describe("snake-royale · 皮肤", () => {
  it("至少 8 套原创皮肤,按星数解锁", () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(8);
    expect(SKINS[0].needStars).toBe(0);
    for (let i = 1; i < SKINS.length; i++) {
      expect(SKINS[i].needStars).toBeGreaterThan(SKINS[i - 1].needStars);
    }
  });

  it("每套都有名字、说明和至少一个颜色", () => {
    const ids = new Set<string>();
    for (const s of SKINS) {
      expect(s.name.length).toBeGreaterThan(1);
      expect(s.desc.length).toBeGreaterThan(6);
      expect(s.colors.length).toBeGreaterThan(0);
      for (const c of s.colors) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
    }
  });

  it("星数不够就解锁不了", () => {
    expect(unlockedSkins(0)).toHaveLength(1);
    expect(isUnlocked(SKINS[1].id, 0)).toBe(false);
    expect(isUnlocked(SKINS[1].id, SKINS[1].needStars)).toBe(true);
    expect(unlockedSkins(99999).length).toBe(SKINS.length);
  });

  it("没解锁或者找不到的皮肤一律退回第一套", () => {
    expect(skinById("nope", 99999).id).toBe(SKINS[0].id);
    expect(skinById(SKINS[5].id, 0).id).toBe(SKINS[0].id);
    expect(skinById(SKINS[5].id, 99999).id).toBe(SKINS[5].id);
    expect(skinById(null).id).toBe(SKINS[0].id);
  });

  it("花纹按节点编号取色,不会越界", () => {
    for (const s of SKINS) {
      for (const i of [0, 1, 3, 7, 40, 219]) {
        expect(s.colors).toContain(nodeColor(s, i));
      }
      expect(s.colors).toContain(nodeColor(s, Number.NaN));
    }
  });

  it("皮肤存在本游戏自己的 key 里,不动平台那几个 key", () => {
    expect(SKIN_KEY).toBe("yiduo-yixing.snake-royale.skin.v1");
    expect(SKIN_KEY).not.toContain("save.v1");
    expect(SKIN_KEY).not.toContain("fav.v1");
    expect(serializeSkinChoice(SKINS[2])).toBe(SKINS[2].id);
    expect(parseSkinChoice(SKINS[2].id, 99999).id).toBe(SKINS[2].id);
    expect(parseSkinChoice(null, 99999).id).toBe(SKINS[0].id);
    expect(parseSkinChoice("{坏数据}", 99999).id).toBe(SKINS[0].id);
  });

  it("下一套皮肤的提示会告诉还差几颗星", () => {
    expect(nextSkinHint(0)).toContain("再拿");
    expect(nextSkinHint(99999)).toContain("都解锁");
  });

  it("AI 配色够分给九个对手", () => {
    expect(BOT_COLORS.length).toBeGreaterThanOrEqual(9);
    for (const c of BOT_COLORS) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe("snake-royale · 攻略手册", () => {
  it("挂在本款上,八章一章不落", () => {
    expect(guide.gameId).toBe("snake-royale");
    expect(guide.entries).toHaveLength(8);
    expect(guide.general.length).toBeGreaterThanOrEqual(4);
  });

  it("每一章的区间连起来正好盖满 188 关", () => {
    let expectFrom = 1;
    for (const e of guide.entries) {
      expect(e.from).toBe(expectFrom);
      expect(e.to).toBeGreaterThanOrEqual(e.from);
      expect(e.tips.length).toBeGreaterThanOrEqual(3);
      expectFrom = e.to + 1;
    }
    expect(expectFrom - 1).toBe(188);
  });

  it("把「自己的身体安全」这条核心规则写进了总纲", () => {
    expect(guide.general.join("")).toContain("自己的身体");
  });
});

describe("snake-royale · 产品红线", () => {
  it("全部源码扫不出任何商标", () => {
    for (const { f, text } of SOURCES) {
      for (const brand of BRANDS) {
        expect(`${f}:${text.includes(brand)}`).toBe(`${f}:false`);
      }
    }
  });

  it("攻略和章节说明里也不出现商标", () => {
    const text = JSON.stringify(guide) + JSON.stringify(CHAPTERS) + JSON.stringify(SKINS);
    for (const brand of BRANDS) expect(text).not.toContain(brand);
  });

  it("不写死亡和流血,淘汰只说「打了个盹 / 先去休息」", () => {
    const text = JSON.stringify(guide) + JSON.stringify(CHAPTERS);
    for (const bad of ["死", "血", "尸", "杀"]) expect(text).not.toContain(bad);
    expect(guide.general.join("") + guide.entries.map((e) => e.tips.join("")).join("")).toContain("休息");
  });

  it("离线可玩:不引 three.js、不连网、不开 socket", () => {
    for (const { f, text } of SOURCES) {
      expect(`${f}:${/three|Socket|WebSocket|fetch\(|XMLHttpRequest/.test(text)}`).toBe(`${f}:false`);
    }
  });

  it("音效只走 api.play,不自己造 AudioContext", () => {
    const index = SOURCES.find((s) => s.f === "index.ts")!.text;
    expect(index).not.toContain("new AudioContext");
    expect(index).not.toContain("new Audio(");
  });

  it("index.ts 顶部就把 meta 透出来", () => {
    const index = SOURCES.find((s) => s.f === "index.ts")!.text;
    expect(index.slice(0, 200)).toContain('export { meta }');
    expect(index).toContain("export function mount(");
  });

  it("destroy 会把监听、rAF 和按住的键都清干净", () => {
    const index = SOURCES.find((s) => s.f === "index.ts")!.text;
    const adds = (index.match(/window\.addEventListener/g) ?? []).length;
    const removes = (index.match(/window\.removeEventListener/g) ?? []).length;
    expect(removes).toBe(adds);
    expect(index).toContain("cancelAnimationFrame(raf)");
    expect(index).toContain("boostHeld.clear()");
    expect(index).toContain("brakeHeld.clear()");
  });

  it("双人键位齐全:鸭梨 WASD+F/G,康康 方向键 +L/K,Esc 暂停", () => {
    const index = SOURCES.find((s) => s.f === "index.ts")!.text;
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", '"Escape"', '=== "f"', '=== "g"', '=== "l"', '=== "k"']) {
      expect(index).toContain(key);
    }
  });

  it("手机有触屏等价:拖拽跟手 + 加速与急停大钮", () => {
    const index = SOURCES.find((s) => s.f === "index.ts")!.text;
    expect(index).toContain("pointerdown");
    expect(index).toContain("pointermove");
    expect(index).toContain("💨 加速");
    expect(index).toContain("🛑 急停");
    expect(index).toContain("min-height:46px");
  });

  it("360px 窄屏有专门的字号和布局兜底", () => {
    const index = SOURCES.find((s) => s.f === "index.ts")!.text;
    expect(index).toContain("@media (max-width:360px)");
    expect(index).toContain("overflow-wrap:anywhere");
  });

  it("尊重 prefers-reduced-motion", () => {
    const index = SOURCES.find((s) => s.f === "index.ts")!.text;
    expect(index).toContain("prefers-reduced-motion");
  });
});
