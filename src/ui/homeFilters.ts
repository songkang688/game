/**
 * 首页的筛选 / 搜索 / 收藏 —— 全是纯函数,一行 DOM 都不碰,方便单测。
 *
 * home.ts 只负责把结果画出来;要改「怎么筛、怎么搜、怎么排」都在这个文件里改。
 * 存档约定:收藏单独一个 key `yiduo-yixing.fav.v1`,与 save.ts、l99 进度互不影响。
 */
import type { GameCategory, GameMeta, GameMode, GameModule, GamePlatform } from "../engine/types";
import { DEFAULT_LEVEL_TOTAL, GAME_PLATFORMS } from "../engine/types";

/** 分类页签:全部 + 五个分类 */
export type Tab = "all" | GameCategory;

/** 玩法筛选芯片:与分类页签叠加使用 */
export type ModeChip = "all" | "campaign" | "versus" | "endless" | "duo";

/** 玩法芯片的展示顺序与文案(home.ts 直接照着渲染) */
export const MODE_CHIPS: { key: ModeChip; emoji: string; label: string }[] = [
  { key: "all", emoji: "🌈", label: "全部" },
  { key: "campaign", emoji: "🚩", label: "闯关" },
  { key: "versus", emoji: "🤝", label: "对战" },
  { key: "endless", emoji: "♾️", label: "无尽" },
  { key: "duo", emoji: "👫", label: "双人" }
];

/** 一个芯片认哪几种 modes:「双人」把同屏双人和双人合作都算上 */
const CHIP_MODES: Record<Exclude<ModeChip, "all">, GameMode[]> = {
  campaign: ["campaign"],
  versus: ["versus"],
  endless: ["endless"],
  duo: ["twoPlayer", "coop"]
};

/** 平台筛选芯片(1.2 新增):与分类页签、玩法芯片、搜索四条件叠加 */
export type PlatformChip = "all" | "mobile" | "desktop";

/** 平台芯片的展示顺序与文案(home.ts 直接照着渲染) */
export const PLATFORM_CHIPS: { key: PlatformChip; emoji: string; label: string }[] = [
  { key: "all", emoji: "🌈", label: "全部" },
  { key: "mobile", emoji: "📱", label: "手游" },
  { key: "desktop", emoji: "💻", label: "端游" }
];

/**
 * 这款游戏是否命中某个平台芯片。
 * 没填 platform、填了 `"both"`、或者填了看不懂的脏值,一律当「两边都顺手」,手游端游都命中。
 */
export function matchesPlatformChip(
  meta: Pick<GameMeta, "platform">,
  chip: PlatformChip
): boolean {
  if (chip === "all") return true;
  const raw = meta.platform;
  const platform: GamePlatform =
    typeof raw === "string" && (GAME_PLATFORMS as string[]).includes(raw)
      ? (raw as GamePlatform)
      : "both";
  if (platform === "both") return true;
  return platform === chip;
}

/** 收藏存档 key(1.1 新增,只存一个 id 数组) */
export const FAV_KEY = "yiduo-yixing.fav.v1";

/** 收藏上限:再喜欢也别把首页塞爆 */
export const FAV_MAX = 24;

// ---------------------------------------------------------------------------
// 玩法筛选
// ---------------------------------------------------------------------------

/** 这款游戏是否命中某个玩法芯片;没填 modes 的游戏只能被「全部」选中 */
export function matchesModeChip(meta: Pick<GameMeta, "modes">, chip: ModeChip): boolean {
  if (chip === "all") return true;
  const modes = meta.modes;
  if (!modes || modes.length === 0) return false;
  return CHIP_MODES[chip].some((m) => modes.includes(m));
}

/** 这款游戏是否属于某个分类页签 */
export function matchesTab(meta: Pick<GameMeta, "category">, tab: Tab): boolean {
  return tab === "all" || meta.category === tab;
}

// ---------------------------------------------------------------------------
// 拼音首字母(只覆盖已上架游戏标题里出现过的字,新游戏请顺手补进来)
// ---------------------------------------------------------------------------

/**
 * 汉字 → 拼音首字母。逐字核对过,不是算法猜的。
 * 查不到的字返回空串,搜索时直接跳过它(标题原文匹配仍然有效),永远不报错。
 */
const PINYIN_INITIALS: Record<string, string> = {
  不: "b", 乐: "l", 五: "w", 人: "r", 住: "z", 便: "b", 保: "b", 冒: "m",
  农: "n", 冲: "c", 准: "z", 切: "q", 刺: "c", 勇: "y", 千: "q", 卫: "w",
  友: "y", 双: "s", 台: "t", 吃: "c", 同: "t", 嘭: "p", 噗: "p", 园: "y",
  国: "g", 图: "t", 地: "d", 场: "c", 块: "k", 外: "w", 大: "d", 子: "z",
  字: "z", 守: "s", 寻: "x", 小: "x", 屋: "w", 底: "d", 弹: "d", 形: "x",
  彩: "c", 忆: "y", 战: "z", 手: "s", 找: "z", 拔: "b", 拼: "p", 接: "j",
  擂: "l", 数: "s", 时: "s", 星: "x", 朋: "p", 朵: "d", 果: "g", 棋: "q",
  毛: "m", 气: "q", 水: "s", 河: "h", 泡: "p", 海: "h", 涂: "t", 消: "x",
  火: "h", 点: "d", 状: "z", 猫: "m", 王: "w", 球: "q", 看: "k", 瞄: "m",
  砖: "z", 砰: "p", 碰: "p", 秋: "q", 算: "s", 糖: "t", 红: "h", 绿: "l",
  翻: "f", 者: "z", 胃: "w", 色: "s", 花: "h", 芽: "y", 萌: "m", 蓝: "l",
  虫: "c", 虹: "h", 记: "j", 识: "s", 象: "x", 贪: "t", 赛: "s", 超: "c",
  跑: "p", 路: "l", 车: "c", 连: "l", 钟: "z", 险: "x", 音: "y", 鸟: "n",
  鼠: "s",
  // 1.2 窗口 1 的 12 款新游戏用到的字。多音字按各自标题里的念法收:
  // 长蛇 cháng、飞行 xíng —— 换个词念法可能就不同,别照抄去别处。
  产: "c", 争: "z", 令: "l", 作: "z", 决: "j",
  叠: "d", 合: "h", 围: "w", 圆: "y", 开: "k", 对: "d", 将: "j",
  成: "c", 扫: "s", 招: "z", 方: "f", 杰: "j", 独: "d", 田: "t",
  英: "y", 蛇: "s", 行: "x", 长: "c", 雷: "l", 霸: "b", 飞: "f",
  麻: "m",
  // 1.1 就在架、但当年漏掉的字:这 16 个标题一直只能靠 id 或原文搜。
  // 一起补上,拼音搜索才对全库都算数。
  乱: "l", 仓: "c", 兄: "x", 公: "g", 冰: "b", 击: "j", 危: "w",
  弟: "d", 怪: "g", 推: "t", 抢: "q", 斗: "d", 机: "j", 林: "l",
  格: "g", 森: "s", 物: "w", 皮: "p", 矿: "k", 箱: "x", 达: "d",
  金: "j", 钓: "d", 钩: "g", 铁: "t", 队: "d", 雪: "x", 主: "z",
  炸: "z", 坦: "t", 克: "k", 射: "s", 鱼: "y", 馆: "g", 龄: "l"
};

/**
 * 多音字的另一种念法:按游戏 id 补一条候选首字母串。
 * 例如「音乐星星」的乐念 yuè,主表按「乐 = lè」出的是 yl xx。
 */
const INITIALS_ALIASES: Record<string, string[]> = {
  "music-stars": ["yyxx"],
  "sling-birds": ["ttxn"],
  // 「长蛇争霸」的长念 cháng,但小朋友多半会照「zhǎng」去打 z
  "snake-royale": ["zszb"],
  // 「飞行棋」的行念 xíng,照「háng」打 h 的也认
  "flight-chess": ["fhqly"]
};

/**
 * 取一段文字的拼音首字母串:汉字查表,英文数字原样保留(小写),其余丢掉。
 * 例:「贪吃毛毛虫」→ "tcmmc"。
 */
export function pinyinInitials(text: string): string {
  let out = "";
  for (const ch of text) {
    const mapped = PINYIN_INITIALS[ch];
    if (mapped) {
      out += mapped;
      continue;
    }
    if (/[a-zA-Z0-9]/.test(ch)) out += ch.toLowerCase();
  }
  return out;
}

/** 一款游戏可以被搜到的全部「字母串」:标题首字母 + 多音字候选 + id */
export function searchKeys(meta: Pick<GameMeta, "id" | "title">): string[] {
  const keys = [pinyinInitials(meta.title), meta.id.toLowerCase().replace(/-/g, "")];
  for (const alias of INITIALS_ALIASES[meta.id] ?? []) keys.push(alias);
  return keys.filter((k) => k !== "");
}

/** 把用户输入收拾干净:去首尾空白、去中间空格、转小写 */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, "").toLowerCase();
}

/**
 * 搜索匹配:标题原文包含,或拼音首字母串 / id 包含。
 * 空搜索词一律算命中(等于没在搜)。
 */
export function matchesSearch(meta: Pick<GameMeta, "id" | "title">, query: string): boolean {
  const q = normalizeQuery(query);
  if (q === "") return true;
  if (meta.title.toLowerCase().includes(q)) return true;
  return searchKeys(meta).some((key) => key.includes(q));
}

// ---------------------------------------------------------------------------
// 收藏
// ---------------------------------------------------------------------------

export interface FavStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 读收藏列表(最新收藏的在前);读不到、坏档、隐私模式一律返回空数组 */
export function loadFavIds(storage: FavStorage | undefined): string[] {
  try {
    const raw = storage?.getItem(FAV_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids: string[] = [];
    for (const v of parsed) {
      if (typeof v === "string" && v !== "" && !ids.includes(v)) ids.push(v);
    }
    return ids.slice(0, FAV_MAX);
  } catch {
    return [];
  }
}

/** 写收藏列表;存不进去(隐私模式等)就静静算了,不影响玩游戏 */
export function saveFavIds(ids: string[], storage: FavStorage | undefined): void {
  try {
    storage?.setItem(FAV_KEY, JSON.stringify(ids.slice(0, FAV_MAX)));
  } catch {
    // 存不下就存不下,收藏只是锦上添花
  }
}

/** 收没收藏 */
export function isFav(id: string, favIds: readonly string[]): boolean {
  return favIds.includes(id);
}

/** 切换收藏,返回新列表(新收的排最前,超上限丢最旧的);不改传进来的数组 */
export function toggleFavIds(id: string, favIds: readonly string[]): string[] {
  if (favIds.includes(id)) return favIds.filter((x) => x !== id);
  return [id, ...favIds].slice(0, FAV_MAX);
}

/** 按收藏顺序取出对应的游戏(找不到的 id 自动跳过,不会留空位) */
export function favoriteGames(games: readonly GameModule[], favIds: readonly string[]): GameModule[] {
  const out: GameModule[] = [];
  for (const id of favIds) {
    const hit = games.find((g) => g.meta.id === id);
    if (hit) out.push(hit);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 组合筛选
// ---------------------------------------------------------------------------

export interface HomeFilter {
  tab: Tab;
  mode: ModeChip;
  /** 1.2 新增:手游 / 端游 */
  platform: PlatformChip;
  query: string;
}

/** 分类 + 玩法 + 平台 + 搜索四个条件叠加(缺省都当「全部」) */
export function filterGames(
  games: readonly GameModule[],
  filter: Partial<HomeFilter> = {}
): GameModule[] {
  const tab = filter.tab ?? "all";
  const mode = filter.mode ?? "all";
  const platform = filter.platform ?? "all";
  const query = filter.query ?? "";
  return games.filter(
    (g) =>
      matchesTab(g.meta, tab) &&
      matchesModeChip(g.meta, mode) &&
      matchesPlatformChip(g.meta, platform) &&
      matchesSearch(g.meta, query)
  );
}

/** 有没有在筛/在搜(决定首页是分类分节展示还是一整片结果) */
export function isFiltering(filter: Partial<HomeFilter> = {}): boolean {
  return (
    (filter.mode ?? "all") !== "all" ||
    (filter.platform ?? "all") !== "all" ||
    normalizeQuery(filter.query ?? "") !== ""
  );
}

// ---------------------------------------------------------------------------
// 进度徽章
// ---------------------------------------------------------------------------

/**
 * 首页欢迎气泡的第二行。
 *
 * 以前这句把「55 款」写死在模板里,1.2 一路加新款以后就对不上了 ——
 * 首页明明列着 67 张卡,气泡还在说 55。改成跟着真实收录数走,
 * 以后再加多少款都不用回来改文案。
 */
export function heroSubtitle(gameCount: number, maxLevels: number): string {
  const n = Number.isFinite(gameCount) ? Math.max(0, Math.floor(gameCount)) : 0;
  const lv = Number.isFinite(maxLevels) ? Math.max(0, Math.floor(maxLevels)) : 0;
  const head = n > 0 ? `${n} 款原创小游戏` : "原创小游戏合集";
  const levels = lv > 0 ? `,闯关最长 ${lv} 关` : "";
  return `${head}${levels}。上面可以筛选、搜索、收藏 🌈`;
}

/**
 * Electron / 浏览器窗口标题。首页气泡已经按真实收录数拼款数,
 * 标题栏如果还写死「1.1 · 55 款」,安装包打开就会和里面的 76 款对不上。
 */
export function windowTitle(gameCount: number): string {
  const n = Number.isFinite(gameCount) ? Math.max(0, Math.floor(gameCount)) : 0;
  const games = n > 0 ? `${n} 款原创小游戏合集` : "原创小游戏合集";
  return `一朵一星 1.2 · ${games}`;
}

/** 这款游戏的闯关总数:meta 没填就按通用框架的 188 关算 */
export function levelTotalOf(meta: Pick<GameMeta, "levels">): number {
  const n = meta.levels;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return DEFAULT_LEVEL_TOTAL;
  return Math.round(n);
}

/**
 * 进度徽章文案:`🚩 3/188`。
 * 没有进度(cleared <= 0 或读不到存档)返回 null,由调用方决定不显示。
 * 存档意外超过总关数时按总关数封顶,免得出现 200/188。
 */
export function progressBadgeText(
  cleared: number | null,
  meta: Pick<GameMeta, "levels">
): string | null {
  if (cleared === null || !Number.isFinite(cleared) || cleared <= 0) return null;
  const total = levelTotalOf(meta);
  return `🚩 ${Math.min(Math.round(cleared), total)}/${total}`;
}

/** 空态文案:按「在搜 / 在筛玩法 / 只切了分类」给不同的鼓励话 */
export function emptyStateText(filter: Partial<HomeFilter> = {}): string {
  if (normalizeQuery(filter.query ?? "") !== "") return "没找到这个名字的游戏,换个词试试吧!";
  const mode = filter.mode ?? "all";
  const platform = filter.platform ?? "all";
  if (mode !== "all" && platform !== "all") {
    const modeLabel = MODE_CHIPS.find((c) => c.key === mode)?.label ?? "这种";
    const platformLabel = PLATFORM_CHIPS.find((c) => c.key === platform)?.label ?? "这类设备";
    return `${platformLabel}里还没有${modeLabel}玩法的游戏,换个筛选试试吧!`;
  }
  if (mode !== "all") {
    const label = MODE_CHIPS.find((c) => c.key === mode)?.label ?? "这种";
    return `这里还没有${label}玩法的游戏,换个筛选看看吧!`;
  }
  if (platform !== "all") {
    const label = PLATFORM_CHIPS.find((c) => c.key === platform)?.label ?? "这类设备";
    return `${label}这边还没有合适的游戏,换个筛选试试吧!`;
  }
  if ((filter.tab ?? "all") !== "all") return "这个分类还没有游戏,去别的分类看看吧!";
  return "小游戏正在路上,很快就到啦!";
}
