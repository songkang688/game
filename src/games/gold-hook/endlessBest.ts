/**
 * 无尽矿井的最好成绩。
 *
 * 1.1 记的是「这一趟带回多少金币」，1.2 按规格改成记「下潜到第几层」。
 * 两套数不是一个量级 —— 一趟八百金币和下潜到第八层都写在同一个
 * `endlessBest` 上，migrate 之前的玩家一进来就会看到「历史最深 800 层」。
 *
 * 所以这里开一个**本款自己的新 key**（只增，不改也不删平台那个）：
 *  - `depth`：1.2 起的层深纪录，界面上显示的是它；
 *  - `coins`：从 1.1 的平台 `endlessBest` 读一次搬过来的金币纪录，接着往上刷。
 *
 * 平台那个 `endlessBest` 仍然按规格写 `save.recordEndlessBest("gold-hook", depth)`，
 * 只是不再拿它当显示口径。
 */
import { SAVE_PREFIX } from "../../engine/save";

/** 1.2 新增的 key，老 key 一个都不动 */
export const ENDLESS_KEY = `${SAVE_PREFIX}gold-hook.endless.v12`;

export interface EndlessBest {
  /** 下潜到过的最深层数 */
  depth: number;
  /** 一趟带回过的最多金币（1.1 的口径，迁移过来接着刷） */
  coins: number;
}

function clean(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/**
 * 把存下来的那串 JSON 解出来；解不出来（第一次玩、或者被别的东西写坏了）
 * 就拿 1.1 平台上的金币纪录兜底 —— 这就是「旧 key 读一次迁移」。
 */
export function migrateEndlessBest(stored: string | null, legacyCoins: number): EndlessBest {
  if (stored) {
    try {
      const v = JSON.parse(stored) as Partial<EndlessBest>;
      if (v && typeof v === "object") {
        return { depth: clean(v.depth), coins: Math.max(clean(v.coins), clean(legacyCoins)) };
      }
    } catch {
      // 存坏了就当没存过，往下走迁移分支
    }
  }
  return { depth: 0, coins: clean(legacyCoins) };
}

/** 一趟跑完之后的新纪录（两项各取大的，都不会掉下来） */
export function mergeEndlessBest(prev: EndlessBest, depth: number, coins: number): EndlessBest {
  return {
    depth: Math.max(clean(prev.depth), clean(depth)),
    coins: Math.max(clean(prev.coins), clean(coins)),
  };
}

/** 有纪录才值得往界面上写一句 */
export function bestLine(best: EndlessBest): string {
  if (best.depth <= 0 && best.coins <= 0) return "";
  if (best.depth <= 0) return `历史最多带回 ${best.coins} 金币。`;
  return `历史最深第 ${best.depth} 层，最多带回 ${best.coins} 金币。`;
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(ENDLESS_KEY);
  } catch {
    // 隐私模式等读不到就当新档
    return null;
  }
}

export function loadEndlessBest(legacyCoins: number): EndlessBest {
  return migrateEndlessBest(readRaw(), legacyCoins);
}

export function saveEndlessBest(next: EndlessBest): void {
  try {
    localStorage.setItem(ENDLESS_KEY, JSON.stringify(next));
  } catch {
    // 存不了也不影响这一趟游玩
  }
}
