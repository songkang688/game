import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SAVE_KEY, SAVE_PREFIX } from "../../engine/save";
import { ROOT_STORAGE_KEY } from "../../ui/root12Contract";
import { SKIN_KEY } from "../snake-royale/skins";

/**
 * 窗口 1 十二款的存档 key 清单(第 2 轮补,对应测试员的 W1-08)。
 *
 * 硬约束原话是「只增不改」,列出来的公共 key 是
 * `save.v1` / `l99.<id>` / `l99skip.<id>` / `collection.v1` / `fav.v1` / `recent.v1`,
 * 1.2 新增 `root.v1`。`snake-royale` 的皮肤选择又新开了一个
 * `yiduo-yixing.snake-royale.skin.v1` —— 它确实是**新增**、不动老 key,
 * 读写也都包了 try(坏档退回默认皮肤),风险很低;
 * 但清单里没有它,清缓存 / 导出存档的时候就容易漏掉。
 *
 * 这个文件把清单写成机器读得懂的样子:
 *  - 十二款里允许直接碰 `localStorage` 的只有登记在案的这一处;
 *  - 新增的 key 必须带 `yiduo-yixing.` 前缀(这样才会被 `save.ts` 的导出/清空扫到),
 *    必须带自己的游戏 id(不和别款撞名),而且不许是任何一个公共 key。
 */

const GAMES = [
  "orb-arena",
  "snake-royale",
  "block-drop",
  "combo-clash",
  "mahjong-bloom",
  "star-estate",
  "hero-cards",
  "weiqi-garden",
  "flight-chess",
  "merge-2048",
  "mine-garden",
  "sudoku-petal"
] as const;

/** 平台公共 key(1.1 起就有的 + 1.2 新增的 root),窗口 1 一个都不许改 */
const SHARED_KEYS = [
  "yiduo-yixing.save.v1",
  "yiduo-yixing.collection.v1",
  "yiduo-yixing.fav.v1",
  "yiduo-yixing.recent.v1",
  ROOT_STORAGE_KEY
] as const;

/** 带 `<id>` 的公共 key 模板 */
const SHARED_KEY_TEMPLATES = ["yiduo-yixing.l99.", "yiduo-yixing.l99skip."] as const;

/**
 * 窗口 1 这一批**自己新开**的存档 key。往这里加东西之前先问一句:
 * 能不能走 `save.ts` / `level99.ts` 的现成通道?真要新开,写清是哪一款、存什么。
 */
const WINDOW1_PRIVATE_KEYS: { game: (typeof GAMES)[number]; key: string; what: string }[] = [
  { game: "snake-royale", key: SKIN_KEY, what: "玩家选中的蛇皮肤 id(坏档退回默认皮肤)" }
];

const SRC = new Map<string, string>(
  GAMES.flatMap((id) =>
    ["index.ts", "skins.ts", "logic.ts", "levels.ts", "board.ts", "ai.ts"].flatMap((f) => {
      try {
        return [[`${id}/${f}`, readFileSync(new URL(`../${id}/${f}`, import.meta.url), "utf8")] as [string, string]];
      } catch {
        return [];
      }
    })
  )
);

describe("十二款的存档 key 清单", () => {
  it("公共 key 一个字都没被改", () => {
    expect(SAVE_KEY).toBe("yiduo-yixing.save.v1");
    expect(SAVE_PREFIX).toBe("yiduo-yixing.");
    expect(ROOT_STORAGE_KEY).toBe("yiduo-yixing.root.v1");
  });

  it("十二款里直接碰 localStorage 的地方,全部登记在案", () => {
    const touched: string[] = [];
    for (const [file, src] of SRC) {
      if (/\b(?:localStorage|sessionStorage)\b/.test(src)) touched.push(file.split("/")[0]);
    }
    const registered = [...new Set(WINDOW1_PRIVATE_KEYS.map((k) => k.game))].sort();
    expect([...new Set(touched)].sort()).toEqual(registered);
  });

  it("新开的每一个 key 都带平台前缀、带自己的游戏 id,而且不是公共 key", () => {
    for (const { game, key } of WINDOW1_PRIVATE_KEYS) {
      expect(key.startsWith(SAVE_PREFIX), `${key} 不带 ${SAVE_PREFIX} 前缀,导出/清空会漏掉它`).toBe(true);
      expect(key, `${key} 里没有 ${game},容易和别款撞名`).toContain(game);
      expect(SHARED_KEYS as readonly string[]).not.toContain(key);
      for (const tpl of SHARED_KEY_TEMPLATES) expect(key.startsWith(tpl)).toBe(false);
      // 带版本后缀,以后要换格式还能再开一版
      expect(key).toMatch(/\.v\d+$/);
    }
  });

  it("新开的 key 两两不撞名", () => {
    const keys = WINDOW1_PRIVATE_KEYS.map((k) => k.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("snake-royale 的皮肤 key 逐字钉住,换名字就是改老 key", () => {
    expect(SKIN_KEY).toBe("yiduo-yixing.snake-royale.skin.v1");
    const entry = WINDOW1_PRIVATE_KEYS.find((k) => k.key === SKIN_KEY);
    expect(entry?.game).toBe("snake-royale");
    expect(entry?.what).toBeTruthy();
  });

  it("十二款里没有谁偷偷写别人的 key", () => {
    const bad: string[] = [];
    for (const [file, src] of SRC) {
      const id = file.split("/")[0];
      for (const m of src.matchAll(/["'`](yiduo-yixing\.[\w.$-]+)["'`]/g)) {
        const key = m[1];
        if ((SHARED_KEYS as readonly string[]).includes(key)) continue;
        if (SHARED_KEY_TEMPLATES.some((t) => key.startsWith(t))) continue;
        if (WINDOW1_PRIVATE_KEYS.some((k) => k.key === key && k.game === id)) continue;
        bad.push(`${file} 写了没登记的 ${key}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
