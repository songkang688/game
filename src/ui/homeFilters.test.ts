import { describe, expect, it } from "vitest";
import type { GameMeta, GameModule } from "../engine/types";
import { GAME_MODES, GAME_PLATFORMS } from "../engine/types";
import {
  FAV_KEY,
  FAV_MAX,
  MODE_CHIPS,
  PLATFORM_CHIPS,
  matchesPlatformChip,
  emptyStateText,
  favoriteGames,
  filterGames,
  heroSubtitle,
  windowTitle,
  isFav,
  isFiltering,
  levelTotalOf,
  loadFavIds,
  matchesModeChip,
  matchesSearch,
  matchesTab,
  normalizeQuery,
  pinyinInitials,
  progressBadgeText,
  saveFavIds,
  searchKeys,
  toggleFavIds
} from "./homeFilters";

function game(meta: Partial<GameMeta> & Pick<GameMeta, "id" | "title">): GameModule {
  return {
    meta: {
      emoji: "🎮",
      category: "casual",
      color: "#fff",
      blurb: "",
      ...meta
    },
    load: () => Promise.resolve(() => ({ destroy: () => {} }))
  };
}

/** 一个够用的假存档,能模拟「写不进去」的隐私模式 */
function memStorage(initial?: string, readonly = false) {
  const box: { value: string | null } = { value: initial ?? null };
  return {
    box,
    getItem: (): string | null => box.value,
    setItem: (_k: string, v: string): void => {
      if (readonly) throw new Error("QuotaExceeded");
      box.value = v;
    }
  };
}

const CAMPAIGN = game({ id: "campaign-only", title: "接住小水果", modes: ["campaign"], levels: 188 });
const VERSUS = game({ id: "versus-only", title: "朵朵星星象棋", category: "party", modes: ["versus", "twoPlayer"] });
const ENDLESS = game({ id: "endless-one", title: "彩虹跑跑", category: "action", modes: ["campaign", "endless"], levels: 99 });
const COOP = game({ id: "coop-one", title: "便便超人", category: "action", modes: ["campaign", "endless", "coop"], levels: 188 });
const BARE = game({ id: "bare-one", title: "连连看" });
const ALL_GAMES = [CAMPAIGN, VERSUS, ENDLESS, COOP, BARE];

describe("玩法芯片筛选", () => {
  it("「全部」芯片谁都不挡,连没填 modes 的老游戏也留下", () => {
    for (const g of ALL_GAMES) expect(matchesModeChip(g.meta, "all")).toBe(true);
  });

  it("闯关芯片只留 modes 里有 campaign 的", () => {
    expect(matchesModeChip(CAMPAIGN.meta, "campaign")).toBe(true);
    expect(matchesModeChip(VERSUS.meta, "campaign")).toBe(false);
  });

  it("对战芯片只留 versus,双人合作不算对战", () => {
    expect(matchesModeChip(VERSUS.meta, "versus")).toBe(true);
    expect(matchesModeChip(COOP.meta, "versus")).toBe(false);
  });

  it("无尽芯片认 endless", () => {
    expect(matchesModeChip(ENDLESS.meta, "endless")).toBe(true);
    expect(matchesModeChip(CAMPAIGN.meta, "endless")).toBe(false);
  });

  it("双人芯片把同屏双人和双人合作都收进来", () => {
    expect(matchesModeChip(VERSUS.meta, "duo")).toBe(true);
    expect(matchesModeChip(COOP.meta, "duo")).toBe(true);
    expect(matchesModeChip(ENDLESS.meta, "duo")).toBe(false);
  });

  it("没填 modes 的游戏被任何具体芯片过滤掉,但不会报错", () => {
    expect(matchesModeChip(BARE.meta, "campaign")).toBe(false);
    expect(matchesModeChip({ modes: [] }, "duo")).toBe(false);
  });

  it("芯片清单是全部 / 闯关 / 对战 / 无尽 / 双人五个,顺序固定", () => {
    expect(MODE_CHIPS.map((c) => c.key)).toEqual(["all", "campaign", "versus", "endless", "duo"]);
  });
});

describe("分类页签筛选", () => {
  it("「全部」页签留下所有分类", () => {
    expect(ALL_GAMES.every((g) => matchesTab(g.meta, "all"))).toBe(true);
  });

  it("具体分类只留同分类的游戏", () => {
    expect(matchesTab(VERSUS.meta, "party")).toBe(true);
    expect(matchesTab(VERSUS.meta, "casual")).toBe(false);
  });
});

describe("拼音首字母", () => {
  it("常见标题都能转成首字母串", () => {
    expect(pinyinInitials("贪吃毛毛虫")).toBe("tcmmc");
    expect(pinyinInitials("红蓝拔河")).toBe("hlbh");
    expect(pinyinInitials("绿芽保卫战")).toBe("lybwz");
    expect(pinyinInitials("勇者小路")).toBe("yzxl");
  });

  it("英文数字原样保留并转小写,标点空格丢掉", () => {
    expect(pinyinInitials("Duo 99 · 星星")).toBe("duo99xx");
  });

  it("表里没有的字直接跳过,不会抛错也不会串位", () => {
    expect(pinyinInitials("龘朵龘星")).toBe("dx");
    expect(pinyinInitials("")).toBe("");
  });

  it("searchKeys 除首字母外还带上去掉连字符的 id", () => {
    expect(searchKeys({ id: "red-blue-tug", title: "红蓝拔河" })).toContain("redbluetug");
  });

  it("多音字游戏有额外的候选首字母串", () => {
    expect(searchKeys({ id: "music-stars", title: "音乐星星" })).toContain("yyxx");
  });
});

// ---------------------------------------------------------------------------
// 1.2 窗口 1 新增的 12 款:字表是手工维护的,新标题不补进来就一个字都搜不到。
// 下面那个「和已上架 meta 的约定」里已经逐款钉过首字母串了,这里补的是搜索行为:
// 串长对不对、前缀 / 中段 / 大写能不能命中、十二款会不会互相撞车、多音字有没有候选。
// ---------------------------------------------------------------------------

describe("窗口 1 的 12 款新游戏也能用拼音搜", () => {
  const WINDOW1: { id: string; title: string; initials: string }[] = [
    { id: "orb-arena", title: "圆圆大作战", initials: "yydzz" },
    { id: "snake-royale", title: "长蛇争霸", initials: "cszb" },
    { id: "block-drop", title: "方块叠叠乐", initials: "fkddl" },
    { id: "combo-clash", title: "连招对决", initials: "lzdj" },
    { id: "mahjong-bloom", title: "花开麻将", initials: "hkmj" },
    { id: "star-estate", title: "朵星地产", initials: "dxdc" },
    { id: "hero-cards", title: "英杰令", initials: "yjl" },
    { id: "weiqi-garden", title: "围子花园", initials: "wzhy" },
    { id: "flight-chess", title: "飞行棋乐园", initials: "fxqly" },
    { id: "merge-2048", title: "星星合成", initials: "xxhc" },
    { id: "mine-garden", title: "扫雷花园", initials: "slhy" },
    { id: "sudoku-petal", title: "数独花田", initials: "sdht" }
  ];

  it("每一款的首字母串都逐字对得上,没有一个字被字表漏掉", () => {
    for (const g of WINDOW1) {
      expect(pinyinInitials(g.title), g.id).toBe(g.initials);
      // 一个汉字出一个字母:串长必须等于标题里的汉字数
      expect(g.initials.length, g.id).toBe([...g.title].length);
    }
  });

  it("整串、前缀、中间一段都能搜到", () => {
    for (const g of WINDOW1) {
      expect(matchesSearch(g, g.initials), g.id).toBe(true);
      expect(matchesSearch(g, g.initials.slice(0, 2)), g.id).toBe(true);
      expect(matchesSearch(g, g.initials.slice(1)), g.id).toBe(true);
      expect(matchesSearch(g, g.initials.toUpperCase()), g.id).toBe(true);
    }
  });

  it("十二款的首字母串互不相同,搜出来不会一片全中", () => {
    expect(new Set(WINDOW1.map((g) => g.initials)).size).toBe(WINDOW1.length);
  });

  it("多音字给了第二种念法的候选串", () => {
    // 长:cháng / zhǎng
    expect(searchKeys({ id: "snake-royale", title: "长蛇争霸" })).toContain("zszb");
    expect(matchesSearch({ id: "snake-royale", title: "长蛇争霸" }, "zszb")).toBe(true);
    // 行:xíng / háng
    expect(searchKeys({ id: "flight-chess", title: "飞行棋乐园" })).toContain("fhqly");
    expect(matchesSearch({ id: "flight-chess", title: "飞行棋乐园" }, "fhqly")).toBe(true);
  });

  it("新补的字没有把老标题搜歪", () => {
    expect(pinyinInitials("贪吃毛毛虫")).toBe("tcmmc");
    expect(pinyinInitials("五子棋")).toBe("wzq");
    expect(pinyinInitials("连连看")).toBe("llk");
    expect(pinyinInitials("红蓝拔河")).toBe("hlbh");
    expect(pinyinInitials("绿芽保卫战")).toBe("lybwz");
  });

  // 补 12 款时顺手核了一遍全库,发现 1.1 还有 16 个标题一直缺字 ——
  // 「金矿钩钩」四个字一个都没进表,「保龄球小馆」缺龄和馆。
  // 这些字一并补进来,顺带把它们钉住,免得下次改字表又被搞回去。
  // bomb-buddies 在 1.3 窗口 5 更名「泡泡布阵」(原名内嵌商标风险词),此处跟着现行标题走。
  const OLD_TITLES_FIXED: { title: string; initials: string }[] = [
    { title: "泡泡布阵", initials: "ppbz" },
    { title: "保龄球小馆", initials: "blqxg" },
    { title: "推箱小仓鼠", initials: "txxcs" },
    { title: "碰碰车大乱斗", initials: "ppcdld" },
    { title: "朵星格斗王", initials: "dxgdw" },
    { title: "钓鱼小达人", initials: "dyxdr" },
    { title: "金矿钩钩", initials: "jkgg" },
    { title: "冰冰火火森林", initials: "bbhhsl" },
    { title: "朵朵抢地主", initials: "ddqdz" },
    { title: "小怪物危机", initials: "xgwwj" },
    { title: "王子公主大冒险", initials: "wzgzdmx" },
    { title: "噗噗兄弟", initials: "ppxd" },
    { title: "星星射击场", initials: "xxsjc" },
    { title: "飞机小队", initials: "fjxd" },
    { title: "雪球大作战", initials: "xqdzz" },
    { title: "铁皮坦克大战", initials: "tptkdz" }
  ];

  it("1.1 老标题里缺的字也补齐了,全库都能用拼音搜", () => {
    for (const g of OLD_TITLES_FIXED) {
      expect(pinyinInitials(g.title), g.title).toBe(g.initials);
      expect(g.initials.length, g.title).toBe([...g.title].length);
    }
  });

  it("顺手把老标题里缺的字也补齐了,飞机小队与雪球大作战不再掉字", () => {
    // 原来这两条钉的是「补了飞、还缺机队雪」的半截状态(fjxd 写成 f、xqdzz 写成 qdzz)。
    // 字补齐之后就该是完整串了。
    expect(pinyinInitials("飞机小队")).toBe("fjxd");
    expect(pinyinInitials("雪球大作战")).toBe("xqdzz");
  });
});

describe("搜索匹配", () => {
  it("空搜索词等于没搜,所有游戏都留着", () => {
    expect(matchesSearch(CAMPAIGN.meta, "")).toBe(true);
    expect(matchesSearch(CAMPAIGN.meta, "   ")).toBe(true);
  });

  it("标题里连着的一段汉字能搜到", () => {
    expect(matchesSearch(CAMPAIGN.meta, "水果")).toBe(true);
    expect(matchesSearch(CAMPAIGN.meta, "地鼠")).toBe(false);
  });

  it("拼音首字母能搜到,大小写和中间空格都不影响", () => {
    expect(matchesSearch(BARE.meta, "llk")).toBe(true);
    expect(matchesSearch(BARE.meta, "L L K")).toBe(true);
  });

  it("首字母前缀和中间一段都算模糊命中", () => {
    expect(matchesSearch({ id: "x", title: "贪吃毛毛虫" }, "tc")).toBe(true);
    expect(matchesSearch({ id: "x", title: "贪吃毛毛虫" }, "mmc")).toBe(true);
  });

  it("用英文 id 也能搜到,方便家长照着目录名找", () => {
    expect(matchesSearch({ id: "lianliankan", title: "连连看" }, "lianlian")).toBe(true);
  });

  it("normalizeQuery 会去掉首尾空白与中间空格并转小写", () => {
    expect(normalizeQuery("  Duo  Rush ")).toBe("duorush");
  });
});

describe("收藏读写", () => {
  it("空存档读出来是空数组", () => {
    expect(loadFavIds(memStorage())).toEqual([]);
  });

  it("能读回写进去的收藏,顺序不变", () => {
    const s = memStorage();
    saveFavIds(["a", "b"], s);
    expect(JSON.parse(s.box.value ?? "null")).toEqual(["a", "b"]);
    expect(loadFavIds(s)).toEqual(["a", "b"]);
  });

  it("坏档 / 非数组 / 非字符串项都被温柔忽略", () => {
    expect(loadFavIds(memStorage("{不是JSON"))).toEqual([]);
    expect(loadFavIds(memStorage('{"a":1}'))).toEqual([]);
    expect(loadFavIds(memStorage('["a",7,null,"a","b"]'))).toEqual(["a", "b"]);
  });

  it("存不进去(隐私模式)也不抛错", () => {
    expect(() => saveFavIds(["a"], memStorage(undefined, true))).not.toThrow();
    expect(() => saveFavIds(["a"], undefined)).not.toThrow();
    expect(loadFavIds(undefined)).toEqual([]);
  });

  it("收藏 key 是 yiduo-yixing.fav.v1,不碰任何老存档", () => {
    expect(FAV_KEY).toBe("yiduo-yixing.fav.v1");
    expect(FAV_KEY.startsWith("yiduo-yixing.l99")).toBe(false);
  });

  it("toggle 收了再点就取消,原数组不被改动", () => {
    const before = ["a", "b"];
    expect(toggleFavIds("c", before)).toEqual(["c", "a", "b"]);
    expect(toggleFavIds("a", before)).toEqual(["b"]);
    expect(before).toEqual(["a", "b"]);
  });

  it("收藏超过上限时丢掉最旧的一个", () => {
    const full = Array.from({ length: FAV_MAX }, (_, i) => `g${i}`);
    const next = toggleFavIds("new", full);
    expect(next).toHaveLength(FAV_MAX);
    expect(next[0]).toBe("new");
    expect(next).not.toContain(`g${FAV_MAX - 1}`);
  });

  it("isFav 就是查列表里有没有", () => {
    expect(isFav("a", ["a", "b"])).toBe(true);
    expect(isFav("z", ["a", "b"])).toBe(false);
  });

  it("favoriteGames 按收藏顺序取卡片,卸载掉的游戏 id 自动跳过", () => {
    const picked = favoriteGames(ALL_GAMES, ["coop-one", "早就删掉的游戏", "versus-only"]);
    expect(picked.map((g) => g.meta.id)).toEqual(["coop-one", "versus-only"]);
  });
});

describe("三个条件叠加", () => {
  it("什么都不填就是原样返回", () => {
    expect(filterGames(ALL_GAMES)).toHaveLength(ALL_GAMES.length);
  });

  it("分类和玩法能叠加", () => {
    const got = filterGames(ALL_GAMES, { tab: "action", mode: "endless" });
    expect(got.map((g) => g.meta.id)).toEqual(["endless-one", "coop-one"]);
  });

  it("玩法和搜索能叠加", () => {
    const got = filterGames(ALL_GAMES, { mode: "duo", query: "xq" });
    expect(got.map((g) => g.meta.id)).toEqual(["versus-only"]);
  });

  it("筛不出东西时返回空数组而不是报错", () => {
    expect(filterGames(ALL_GAMES, { tab: "edu", mode: "endless" })).toEqual([]);
  });

  it("isFiltering 只在筛玩法或搜索时为真,单切分类不算", () => {
    expect(isFiltering()).toBe(false);
    expect(isFiltering({ tab: "edu" })).toBe(false);
    expect(isFiltering({ mode: "duo" })).toBe(true);
    expect(isFiltering({ query: " 星星 " })).toBe(true);
    expect(isFiltering({ query: "   " })).toBe(false);
  });
});

describe("进度徽章", () => {
  it("meta 填了关数就用它当分母", () => {
    expect(levelTotalOf({ levels: 99 })).toBe(99);
    expect(progressBadgeText(7, { levels: 99 })).toBe("🚩 7/99");
  });

  it("meta 没填关数按 188 算", () => {
    expect(levelTotalOf({})).toBe(188);
    expect(progressBadgeText(3, {})).toBe("🚩 3/188");
  });

  it("关数写成 0 / 负数 / NaN 一律退回 188,不会出现除零或 NaN 徽章", () => {
    expect(levelTotalOf({ levels: 0 })).toBe(188);
    expect(levelTotalOf({ levels: -5 })).toBe(188);
    expect(levelTotalOf({ levels: Number.NaN })).toBe(188);
  });

  it("没有进度就不显示徽章", () => {
    expect(progressBadgeText(null, { levels: 99 })).toBeNull();
    expect(progressBadgeText(0, { levels: 99 })).toBeNull();
    expect(progressBadgeText(-1, { levels: 99 })).toBeNull();
  });

  it("老存档的关数超过总数时按总数封顶", () => {
    expect(progressBadgeText(200, { levels: 99 })).toBe("🚩 99/99");
  });
});

describe("空态文案", () => {
  it("一款游戏都没有时是「正在路上」", () => {
    expect(emptyStateText()).toContain("正在路上");
  });

  it("搜不到时提示换个词", () => {
    expect(emptyStateText({ query: "章鱼烧" })).toContain("换个词");
  });

  it("筛玩法筛空了会把玩法名字说出来", () => {
    expect(emptyStateText({ mode: "duo" })).toContain("双人");
  });

  it("只切了分类且是空的,提示去别的分类", () => {
    expect(emptyStateText({ tab: "create" })).toContain("别的分类");
  });
});

describe("和已上架 meta 的约定", () => {
  const metaModules = import.meta.glob("../games/*/meta.ts", { eager: true }) as Record<
    string,
    { meta?: Partial<GameMeta> }
  >;
  const shipped = Object.entries(metaModules)
    .map(([path, mod]) => ({ path, meta: mod.meta }))
    .filter((x): x is { path: string; meta: Partial<GameMeta> } => Boolean(x.meta));

  it("能收集到已上架的游戏 meta", () => {
    expect(shipped.length).toBeGreaterThan(0);
  });

  it("填了的 modes 全是认识的模式名,且不重复", () => {
    for (const { path, meta } of shipped) {
      if (!meta.modes) continue;
      for (const m of meta.modes) expect(GAME_MODES, path).toContain(m);
      expect(new Set(meta.modes).size, path).toBe(meta.modes.length);
    }
  });

  it("填了的 levels 全是正整数", () => {
    for (const { path, meta } of shipped) {
      if (meta.levels === undefined) continue;
      expect(Number.isInteger(meta.levels), path).toBe(true);
      expect(meta.levels, path).toBeGreaterThan(0);
    }
  });

  it("没有闯关的游戏不会偷偷填关数", () => {
    for (const { path, meta } of shipped) {
      if (meta.modes && !meta.modes.includes("campaign")) {
        expect(meta.levels, path).toBeUndefined();
      }
    }
  });

  // 只钉住这一批 1.1 时已在架的标题:新窗口加的新游戏不会因为字表没更新而把测试搞红,
  // 但这些老标题一旦搜不到就说明字表被误改了。
  const KNOWN_INITIALS: Record<string, string> = {
    "adventure-king": "mxxw",
    gomoku: "wzq",
    lianliankan: "llk",
    "poop-hero": "bbcr",
    "red-blue-tug": "hlbh",
    "sprout-defense": "lybwz",
    xiangqi: "ddxxxq"
  };

  it("1.1 已在架游戏的标题拼音首字母没有跑偏", () => {
    for (const { meta } of shipped) {
      const expected = meta.id ? KNOWN_INITIALS[meta.id] : undefined;
      if (!expected || !meta.title) continue;
      expect(pinyinInitials(meta.title), meta.id).toBe(expected);
    }
  });

  // 1.2 窗口 1 这 12 款上架时字表没跟着补,结果整批都搜不出来:
  //「长蛇争霸」「英杰令」的首字母串直接是空串,只能靠 id 搜。
  // 这里把 12 款逐字钉住,以后再加新字漏了也会红。
  const WINDOW1_INITIALS: Record<string, string> = {
    "orb-arena": "yydzz",
    "snake-royale": "cszb",
    "block-drop": "fkddl",
    "combo-clash": "lzdj",
    "mahjong-bloom": "hkmj",
    "star-estate": "dxdc",
    "hero-cards": "yjl",
    "weiqi-garden": "wzhy",
    "flight-chess": "fxqly",
    "merge-2048": "xxhc",
    "mine-garden": "slhy",
    "sudoku-petal": "sdht"
  };

  it("1.2 窗口 1 的 12 款标题全都能拼出首字母", () => {
    const seen: string[] = [];
    for (const { meta } of shipped) {
      const expected = meta.id ? WINDOW1_INITIALS[meta.id] : undefined;
      if (!expected || !meta.title) continue;
      seen.push(meta.id as string);
      expect(pinyinInitials(meta.title), meta.id).toBe(expected);
    }
    expect(seen.sort()).toEqual(Object.keys(WINDOW1_INITIALS).sort());
  });

  it("1.2 窗口 1 的 12 款都能用拼音首字母搜到", () => {
    for (const { meta } of shipped) {
      const expected = meta.id ? WINDOW1_INITIALS[meta.id] : undefined;
      if (!expected || !meta.title) continue;
      expect(
        matchesSearch({ id: meta.id as string, title: meta.title }, expected),
        meta.id
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 1.2 新增：手游 / 端游筛选
// ---------------------------------------------------------------------------

describe("平台筛选芯片", () => {
  it("三颗芯片就是全部 / 手游 / 端游，顺序固定", () => {
    expect(PLATFORM_CHIPS.map((c) => c.key)).toEqual(["all", "mobile", "desktop"]);
    expect(PLATFORM_CHIPS.map((c) => c.label)).toEqual(["全部", "手游", "端游"]);
  });

  it("芯片文案不写系统名与商店名", () => {
    const text = PLATFORM_CHIPS.map((c) => c.label).join("");
    expect(text).not.toMatch(/iOS|安卓|Android|应用商店|App Store/i);
  });

  it("不填 platform 的老游戏三种筛选都能找到", () => {
    const meta = { platform: undefined };
    expect(matchesPlatformChip(meta, "all")).toBe(true);
    expect(matchesPlatformChip(meta, "mobile")).toBe(true);
    expect(matchesPlatformChip(meta, "desktop")).toBe(true);
  });

  it("填 both 的游戏两边都命中", () => {
    expect(matchesPlatformChip({ platform: "both" }, "mobile")).toBe(true);
    expect(matchesPlatformChip({ platform: "both" }, "desktop")).toBe(true);
  });

  it("mobile 的游戏会被端游筛掉", () => {
    expect(matchesPlatformChip({ platform: "mobile" }, "mobile")).toBe(true);
    expect(matchesPlatformChip({ platform: "mobile" }, "desktop")).toBe(false);
    expect(matchesPlatformChip({ platform: "mobile" }, "all")).toBe(true);
  });

  it("desktop 的游戏会被手游筛掉", () => {
    expect(matchesPlatformChip({ platform: "desktop" }, "desktop")).toBe(true);
    expect(matchesPlatformChip({ platform: "desktop" }, "mobile")).toBe(false);
  });

  it("脏值当 both，不抛异常", () => {
    const dirty = { platform: "switch" } as unknown as Pick<GameMeta, "platform">;
    expect(() => matchesPlatformChip(dirty, "mobile")).not.toThrow();
    expect(matchesPlatformChip(dirty, "mobile")).toBe(true);
    expect(matchesPlatformChip(dirty, "desktop")).toBe(true);
  });

  it("GAME_PLATFORMS 三个取值齐全且不重复", () => {
    expect(GAME_PLATFORMS).toEqual(["mobile", "desktop", "both"]);
    expect(new Set(GAME_PLATFORMS).size).toBe(3);
  });
});

describe("四条件叠加筛选", () => {
  const pool: GameModule[] = [
    game({ id: "tap-only", title: "点点乐", platform: "mobile", modes: ["endless"], category: "casual" }),
    game({ id: "keys-only", title: "双人对战", platform: "desktop", modes: ["versus", "twoPlayer"], category: "party" }),
    game({ id: "anywhere", title: "五子棋", modes: ["campaign", "versus"], category: "party" })
  ];

  it("端游筛选选不到只适合手指的那款", () => {
    const ids = filterGames(pool, { platform: "desktop" }).map((g) => g.meta.id);
    expect(ids).not.toContain("tap-only");
    expect(ids).toContain("keys-only");
    expect(ids).toContain("anywhere");
  });

  it("手游筛选选不到只适合键盘的那款", () => {
    const ids = filterGames(pool, { platform: "mobile" }).map((g) => g.meta.id);
    expect(ids).toEqual(["tap-only", "anywhere"]);
  });

  it("分类 × 玩法 × 平台 × 搜索四条件一起叠", () => {
    const ids = filterGames(pool, {
      tab: "party",
      mode: "versus",
      platform: "desktop",
      query: "zzz"
    }).map((g) => g.meta.id);
    expect(ids).toEqual([]);
    const hit = filterGames(pool, { tab: "party", mode: "versus", platform: "desktop" }).map(
      (g) => g.meta.id
    );
    expect(hit).toEqual(["keys-only", "anywhere"]);
  });

  it("只切平台芯片也算「在筛」", () => {
    expect(isFiltering({ platform: "mobile" })).toBe(true);
    expect(isFiltering({ platform: "all" })).toBe(false);
    expect(isFiltering({})).toBe(false);
  });

  it("平台维度的空态文案是「换个筛选」的口气", () => {
    expect(emptyStateText({ platform: "mobile" })).toContain("手游");
    expect(emptyStateText({ platform: "desktop" })).toContain("端游");
    expect(emptyStateText({ platform: "mobile", mode: "campaign" })).toContain("闯关");
    expect(emptyStateText({ platform: "mobile" })).not.toMatch(/宝宝|乖乖/);
  });

  it("1.1 已有的三条筛选行为一个字都没变", () => {
    expect(matchesTab({ category: "party" }, "party")).toBe(true);
    expect(matchesModeChip({ modes: ["coop"] }, "duo")).toBe(true);
    expect(matchesSearch({ id: "gomoku", title: "五子棋" }, "wzq")).toBe(true);
    expect(filterGames(pool, {}).length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 第 1 轮学习优化：设备芯片得真的筛得动
//
// 第 1 轮走查发现「全部 / 手游 / 端游」三颗芯片点下去都是同一批 67 张卡 ——
// 筛选函数是对的，是没有一款 meta 敢不填 `both`。本窗口这 12 款按各自真实的
// 操作方式把 `platform` 填准了，这一组用例守住它，别哪天又被批量刷回 `both`。
// ---------------------------------------------------------------------------

const WINDOW1_METAS = import.meta.glob<{ meta: GameMeta }>(
  [
    "../games/orb-arena/meta.ts",
    "../games/snake-royale/meta.ts",
    "../games/block-drop/meta.ts",
    "../games/combo-clash/meta.ts",
    "../games/mahjong-bloom/meta.ts",
    "../games/star-estate/meta.ts",
    "../games/hero-cards/meta.ts",
    "../games/weiqi-garden/meta.ts",
    "../games/flight-chess/meta.ts",
    "../games/merge-2048/meta.ts",
    "../games/mine-garden/meta.ts",
    "../games/sudoku-petal/meta.ts"
  ],
  { eager: true }
);

describe("窗口 1 那 12 款的 platform 填得准不准", () => {
  const metas = Object.values(WINDOW1_METAS).map((m) => m.meta);

  it("12 款全都在，而且都显式填了 platform", () => {
    expect(metas).toHaveLength(12);
    for (const m of metas) expect(GAME_PLATFORMS).toContain(m.platform);
  });

  it("滑动合并、点格子、点牌这些用手指最顺的，标成手游", () => {
    const mobile = metas.filter((m) => m.platform === "mobile").map((m) => m.id).sort();
    expect(mobile).toEqual(
      ["flight-chess", "hero-cards", "mahjong-bloom", "merge-2048", "mine-garden", "star-estate", "sudoku-petal"].sort()
    );
  });

  it("同屏双人格斗要两套键位，标成端游", () => {
    expect(metas.find((m) => m.id === "combo-clash")?.platform).toBe("desktop");
  });

  it("手指和键盘都顺手的仍旧是 both", () => {
    const both = metas.filter((m) => m.platform === "both").map((m) => m.id).sort();
    expect(both).toEqual(["block-drop", "orb-arena", "snake-royale", "weiqi-garden"]);
  });

  it("三颗芯片筛出来的数量真的不一样了（不再是 12/12/12）", () => {
    const pool = metas.map((meta) => ({ meta }) as unknown as GameModule);
    const all = filterGames(pool, { platform: "all" }).length;
    const mobile = filterGames(pool, { platform: "mobile" }).length;
    const desktop = filterGames(pool, { platform: "desktop" }).length;
    expect(all).toBe(12);
    expect(mobile).toBe(11); // 7 款 mobile + 4 款 both
    expect(desktop).toBe(5); // 1 款 desktop + 4 款 both
    expect(new Set([all, mobile, desktop]).size).toBeGreaterThan(1);
  });

  it("标成端游的那一款，在手游芯片下就查不到了", () => {
    const pool = metas.map((meta) => ({ meta }) as unknown as GameModule);
    const ids = filterGames(pool, { platform: "mobile" }).map((g) => g.meta.id);
    expect(ids).not.toContain("combo-clash");
    expect(filterGames(pool, { platform: "desktop" }).map((g) => g.meta.id)).toContain("combo-clash");
  });
});

describe("首页气泡的数量跟着实际收录走", () => {
  it("有几款就说几款,不再写死 55", () => {
    expect(heroSubtitle(67, 188)).toContain("67 款原创小游戏");
    expect(heroSubtitle(67, 188)).not.toContain("55");
    expect(heroSubtitle(120, 188)).toContain("120 款");
  });

  it("窗口标题也跟着款数走,不再写死 1.1 · 55 款", () => {
    expect(windowTitle(76)).toBe("一朵一星 1.3 · 76 款原创小游戏合集");
    expect(windowTitle(76)).not.toMatch(/1\.1|1\.2/);
    expect(windowTitle(0)).toBe("一朵一星 1.3 · 原创小游戏合集");
  });

  it("闯关关数也跟着最长的那一款走", () => {
    expect(heroSubtitle(67, 188)).toContain("闯关最长 188 关");
    expect(heroSubtitle(67, 99)).toContain("闯关最长 99 关");
  });

  it("一款都没有 / 数字是脏的时候不许说出「0 款」这种话", () => {
    expect(heroSubtitle(0, 0)).toBe("原创小游戏合集。上面可以筛选、搜索、收藏 🌈");
    expect(heroSubtitle(Number.NaN, Number.POSITIVE_INFINITY)).toBe(
      "原创小游戏合集。上面可以筛选、搜索、收藏 🌈"
    );
    expect(heroSubtitle(-3, -1)).not.toContain("-");
  });

  it("还是原来那句招呼的口气,没有低幼词", () => {
    const t = heroSubtitle(67, 188);
    expect(t).toContain("上面可以筛选、搜索、收藏");
    expect(t).not.toMatch(/宝宝|乖乖|小朋友们快来/);
  });
});
