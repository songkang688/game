import { describe, expect, it } from "vitest";
import type { GameMeta, GameModule } from "../engine/types";
import { GAME_MODES } from "../engine/types";
import {
  FAV_KEY,
  FAV_MAX,
  MODE_CHIPS,
  emptyStateText,
  favoriteGames,
  filterGames,
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
});
