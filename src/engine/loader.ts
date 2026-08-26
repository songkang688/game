/**
 * 游戏加载器:双 glob 按需拆包。
 * - eager 收集 src/games/<id>/meta.ts(纯数据),首页渲染卡片,进主包;
 * - 懒收集 src/games/<id>/index.ts,进入游戏时才动态加载该游戏的实现 chunk。
 * 其他子代理只要把游戏目录(meta.ts + index.ts)合并进来,首页就会自动出现,
 * 无需改壳代码。
 */
import type { GameCategory, GameMeta, GameMode, GameModule, GameMount } from "./types";
import { CATEGORY_ORDER, GAME_MODES } from "./types";

const VALID_CATEGORIES = new Set<string>(CATEGORY_ORDER);
const VALID_MODES = new Set<string>(GAME_MODES);

/** 归一化 meta.modes:只留认识的模式、去重、顺序按 GAME_MODES;没有合法项就当没填 */
function normalizeModes(raw: unknown): GameMode[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const kept = GAME_MODES.filter((m) => raw.some((v) => v === m && VALID_MODES.has(String(v))));
  return kept.length > 0 ? kept : undefined;
}

/** 归一化正整数字段(关数、年龄):非正整数一律当没填 */
function normalizePositiveInt(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  const n = Math.round(raw);
  return n > 0 ? n : undefined;
}

/** 懒 glob 的取值形状:() => import("../games/<id>/index.ts") */
export type LazyImport = () => Promise<unknown>;

/** 兼容 `export const meta` 与 `export default { meta }` 两种模块形状 */
function moduleBody(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  return typeof record.default === "object" && record.default !== null
    ? (record.default as Record<string, unknown>)
    : record;
}

/** 从 meta 模块提取并归一化 meta;不合法返回 null */
function extractMeta(raw: unknown): GameMeta | null {
  const body = moduleBody(raw);
  if (!body) return null;

  const meta = body.meta;
  if (typeof meta !== "object" || meta === null) return null;

  const m = meta as Record<string, unknown>;
  if (typeof m.id !== "string" || m.id.trim() === "") return null;
  if (typeof m.title !== "string" || m.title.trim() === "") return null;

  const category: GameCategory = VALID_CATEGORIES.has(String(m.category))
    ? (m.category as GameCategory)
    : "casual";

  const normalized: GameMeta = {
    id: m.id.trim(),
    title: m.title.trim(),
    emoji: typeof m.emoji === "string" && m.emoji !== "" ? m.emoji : "🎮",
    category,
    color: typeof m.color === "string" && m.color !== "" ? m.color : "#ffd6e7",
    blurb: typeof m.blurb === "string" ? m.blurb : ""
  };

  // 1.1 新增的可选字段:填了才带上,老 meta 不填照样能上首页
  const modes = normalizeModes(m.modes);
  if (modes) normalized.modes = modes;
  const levels = normalizePositiveInt(m.levels);
  if (levels !== undefined) normalized.levels = levels;
  const ageHint = normalizePositiveInt(m.ageHint);
  if (ageHint !== undefined) normalized.ageHint = ageHint;

  return normalized;
}

/** 从实现模块(index.ts)提取 mount;不合法返回 null */
function extractMount(raw: unknown): GameMount | null {
  const body = moduleBody(raw);
  if (!body) return null;
  return typeof body.mount === "function" ? (body.mount as GameMount) : null;
}

/**
 * 把两张 glob 表整理成游戏列表:
 * - meta 不合法、或找不到同目录 index.ts 的懒加载器 → 跳过(控制台警告)
 * - 保证 id 唯一,重复 id 只保留第一个(控制台警告)
 * - 没有任何游戏时返回空数组,绝不抛错
 * - 按分类顺序 + 标题排序,保证展示稳定
 * - load() 动态加载实现 chunk 并返回 mount;模块缺 mount 时 reject
 */
export function collectGames(
  metaModules: Record<string, unknown>,
  implLoaders: Record<string, LazyImport>
): GameModule[] {
  const games: GameModule[] = [];
  const seen = new Set<string>();

  for (const [path, raw] of Object.entries(metaModules)) {
    const meta = extractMeta(raw);
    if (!meta) {
      console.warn(`[一朵一星] 忽略无效游戏模块(缺少合法 meta): ${path}`);
      continue;
    }
    const implPath = path.replace(/meta\.ts$/, "index.ts");
    const lazyImport = implLoaders[implPath];
    if (typeof lazyImport !== "function") {
      console.warn(`[一朵一星] 忽略无实现的游戏(缺少 ${implPath}): ${path}`);
      continue;
    }
    if (seen.has(meta.id)) {
      console.warn(`[一朵一星] 游戏 id 重复,已忽略后来者: "${meta.id}" (${path})`);
      continue;
    }
    seen.add(meta.id);
    games.push({
      meta,
      load: () =>
        lazyImport().then((mod) => {
          const mount = extractMount(mod);
          if (!mount) {
            throw new Error(`游戏 "${meta.id}" 的实现缺少 mount: ${implPath}`);
          }
          return mount;
        })
    });
  }

  games.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.meta.category);
    const cb = CATEGORY_ORDER.indexOf(b.meta.category);
    if (ca !== cb) return ca - cb;
    return a.meta.title.localeCompare(b.meta.title, "zh-Hans-CN");
  });
  return games;
}

/** 收集全部已合并进仓库的游戏(meta 构建时静态确定,实现 chunk 按需加载) */
export function loadGames(): GameModule[] {
  const metaModules = import.meta.glob("../games/*/meta.ts", { eager: true });
  const implLoaders = import.meta.glob("../games/*/index.ts");
  return collectGames(
    metaModules as Record<string, unknown>,
    implLoaders as Record<string, LazyImport>
  );
}
