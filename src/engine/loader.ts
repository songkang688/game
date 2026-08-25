/**
 * 游戏加载器:用 import.meta.glob 自动收集 src/games/<id>/index.ts。
 * 其他子代理只要把游戏目录合并进来,首页就会自动出现,无需改壳代码。
 */
import type { GameCategory, GameMeta, GameModule } from "./types";
import { CATEGORY_ORDER } from "./types";

const VALID_CATEGORIES = new Set<string>(CATEGORY_ORDER);

function extractModule(raw: unknown): GameModule | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  // 支持 `export default { meta, mount }` 或 `export const meta / mount`
  const candidate =
    typeof record.default === "object" && record.default !== null
      ? (record.default as Record<string, unknown>)
      : record;

  const meta = candidate.meta;
  const mount = candidate.mount;
  if (typeof meta !== "object" || meta === null) return null;
  if (typeof mount !== "function") return null;

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

  return {
    meta: normalized,
    mount: mount as GameModule["mount"]
  };
}

/**
 * 把 glob 收集到的模块表整理成游戏列表:
 * - 跳过缺少 meta/mount 的无效模块(控制台警告)
 * - 保证 id 唯一,重复 id 只保留第一个(控制台警告)
 * - 没有任何游戏时返回空数组,绝不抛错
 * - 按分类顺序 + 标题排序,保证展示稳定
 */
export function collectGames(modules: Record<string, unknown>): GameModule[] {
  const games: GameModule[] = [];
  const seen = new Set<string>();

  for (const [path, raw] of Object.entries(modules)) {
    const game = extractModule(raw);
    if (!game) {
      console.warn(`[一朵一星] 忽略无效游戏模块(缺少 meta 或 mount): ${path}`);
      continue;
    }
    if (seen.has(game.meta.id)) {
      console.warn(`[一朵一星] 游戏 id 重复,已忽略后来者: "${game.meta.id}" (${path})`);
      continue;
    }
    seen.add(game.meta.id);
    games.push(game);
  }

  games.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.meta.category);
    const cb = CATEGORY_ORDER.indexOf(b.meta.category);
    if (ca !== cb) return ca - cb;
    return a.meta.title.localeCompare(b.meta.title, "zh-Hans-CN");
  });
  return games;
}

/** 收集全部已合并进仓库的游戏(构建时静态确定) */
export function loadGames(): GameModule[] {
  const modules = import.meta.glob("../games/*/index.ts", { eager: true });
  return collectGames(modules as Record<string, unknown>);
}
