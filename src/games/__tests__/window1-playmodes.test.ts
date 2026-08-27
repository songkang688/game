import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { availableModes, compatFromMeta, describeModes, modeEntryKeys, type ModeEntry } from "../../engine";

/**
 * 窗口 1 十二款要真的走 `engine/playModes` 的口径(第 1 轮测试员 W1-03)。
 *
 * 第 1 轮的原话是「`playModes.ts` 出货代码 0 引用」:五个纯函数写好了、23 个单测全绿,
 * 可十二款的模式入口条各自硬写一个 `["versus","endless","duo"]` 数组。
 * 硬写的后果不是「不好看」,是**两边会各说各话** —— 首页玩法芯片读的是 `meta.modes`,
 * 谁改了 meta 而忘了改数组,就会出现「芯片说有无尽,进去找不着入口」,反过来也一样。
 *
 * 所以这里钉三件事:
 *  1. 十二款都从 `../../engine` import 这套口径,不许绕开去 import 具体文件;
 *  2. 入口条是从 `meta.modes` 推出来的,不是硬写的字面量数组;
 *  3. 推出来的入口集合与 `availableModes(meta)` 对得上 —— 少一个多一个都算漂移。
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

type GameId = (typeof GAMES)[number];

const SRC = new Map<GameId, string>(
  GAMES.map((id) => [id, readFileSync(new URL(`../${id}/index.ts`, import.meta.url), "utf8")])
);

/**
 * 每款的模式入口 key 对应哪一类。
 * `combo-clash` 的训练场不归 `meta.modes` 管(它不是一种对局模式,是练手场),
 * 所以不写 `kind` —— 契约允许这一种「永远显示」的入口,但要在这里报备。
 */
const ENTRY_MAP: Record<GameId, ModeEntry[]> = {
  "orb-arena": [
    { key: "versus", kind: "versus", versusKind: "ai" },
    { key: "endless", kind: "endless" },
    { key: "duo", kind: "versus", versusKind: "hotseat" }
  ],
  "snake-royale": [
    { key: "versus", kind: "versus", versusKind: "ai" },
    { key: "endless", kind: "endless" },
    { key: "duo", kind: "versus", versusKind: "hotseat" }
  ],
  "block-drop": [
    { key: "versus", kind: "versus", versusKind: "ai" },
    { key: "endless", kind: "endless" },
    { key: "duo", kind: "versus", versusKind: "hotseat" }
  ],
  "combo-clash": [
    { key: "versus", kind: "versus", versusKind: "ai" },
    { key: "endless", kind: "endless" },
    { key: "duo", kind: "versus", versusKind: "hotseat" },
    { key: "train" }
  ],
  "mahjong-bloom": [
    { key: "versus", kind: "versus", versusKind: "ai" },
    { key: "endless", kind: "endless" },
    { key: "duo", kind: "versus", versusKind: "hotseat" }
  ],
  "star-estate": [
    { key: "versus", kind: "versus", versusKind: "ai" },
    { key: "endless", kind: "endless" },
    { key: "duo", kind: "versus", versusKind: "hotseat" }
  ],
  "hero-cards": [
    { key: "versus", kind: "versus", versusKind: "ai" },
    { key: "endless", kind: "endless" }
  ],
  "weiqi-garden": [
    { key: "versus", kind: "versus", versusKind: "ai" },
    { key: "endless", kind: "endless" },
    { key: "duo", kind: "versus", versusKind: "hotseat" }
  ],
  "flight-chess": [
    { key: "versus", kind: "versus", versusKind: "ai" },
    { key: "endless", kind: "endless" },
    { key: "duo", kind: "versus", versusKind: "hotseat" }
  ],
  "merge-2048": [
    { key: "versus", kind: "versus", versusKind: "ai" },
    { key: "endless", kind: "endless" },
    { key: "duo", kind: "versus", versusKind: "hotseat" }
  ],
  "mine-garden": [
    { key: "versus", kind: "versus", versusKind: "ai" },
    { key: "endless", kind: "endless" },
    { key: "duo", kind: "versus", versusKind: "hotseat" }
  ],
  "sudoku-petal": [
    { key: "versus", kind: "versus", versusKind: "ai" },
    { key: "endless", kind: "endless" },
    { key: "duo", kind: "versus", versusKind: "hotseat" }
  ]
};

async function metaOf(id: GameId) {
  const mod = (await import(`../${id}/meta.ts`)) as { meta: { modes?: readonly string[]; levels: number } };
  return mod.meta;
}

async function modeKeysOf(id: GameId): Promise<string[]> {
  const mod = (await import(`../${id}/index.ts`)) as Record<string, unknown>;
  const keys = mod.MODE_KEYS;
  expect(Array.isArray(keys), `${id} 没导出 MODE_KEYS`).toBe(true);
  return keys as string[];
}

describe("W1-03 · 十二款真的 import 了 playModes 口径", () => {
  it.each(GAMES)("%s 从 ../../engine 拿 compatFromMeta / modeEntryKeys / describeModes", (id) => {
    const src = SRC.get(id)!;
    const imports = [...src.matchAll(/import\s+\{([^}]*)\}\s+from\s+"\.\.\/\.\.\/engine"/g)]
      .map((m) => m[1])
      .join(",");
    expect(imports, `${id} 没有从 ../../engine 导入任何东西`).not.toBe("");
    for (const fn of ["compatFromMeta", "modeEntryKeys", "describeModes"]) {
      expect(imports, `${id} 没从统一出口拿 ${fn}`).toContain(fn);
    }
  });

  it.each(GAMES)("%s 不绕开统一出口去直连 engine/playModes", (id) => {
    expect(SRC.get(id)!, `${id} 直连了 playModes 文件,约定是走 ../../engine`).not.toMatch(
      /from\s+"\.\.\/\.\.\/engine\/playModes"/
    );
  });

  it.each(GAMES)("%s 的入口条不再是硬写的字面量数组", (id) => {
    const src = SRC.get(id)!;
    // 第 1 轮十二款都长这样:(["versus", "endless", "duo"] as ExtraMode[]).forEach(...)
    expect(src, `${id} 还在硬写模式入口数组`).not.toMatch(/\[\s*"versus",\s*"endless"[^\]]*\]\s*as\s+ExtraMode\[\]/);
    expect(src, `${id} 还在拿 Object.keys(MODE_LABELS) 当入口条`).not.toMatch(
      /Object\.keys\(MODE_LABELS\)\s*as\s+ExtraMode\[\]/
    );
  });
});

describe("W1-03 · 入口条与 meta.modes 对得上", () => {
  it.each(GAMES)("%s 导出的 MODE_KEYS 正是按 meta 推出来的那几个", async (id) => {
    const meta = await metaOf(id);
    const compat = compatFromMeta(meta as Parameters<typeof compatFromMeta>[0]);
    expect(await modeKeysOf(id)).toEqual(modeEntryKeys(compat, ENTRY_MAP[id]));
  });

  it.each(GAMES)("%s meta 说有的模式,入口条上一个都不能少", async (id) => {
    const meta = await metaOf(id);
    const compat = compatFromMeta(meta as Parameters<typeof compatFromMeta>[0]);
    const keys = new Set(await modeKeysOf(id));
    // 闯关那一类是选关地图本身,不占入口条上的按钮
    for (const kind of availableModes(compat).filter((k) => k !== "campaign")) {
      const want = ENTRY_MAP[id].filter((e) => e.kind === kind);
      expect(want.length, `${id} 的 ENTRY_MAP 漏登记了 ${kind}`).toBeGreaterThan(0);
      for (const entry of want) {
        expect(keys.has(entry.key), `${id} meta 声明了 ${kind},入口条上却没有 ${entry.key}`).toBe(true);
      }
    }
  });

  it.each(GAMES)("%s 入口条上不许出现 meta 没声明的模式", async (id) => {
    const meta = await metaOf(id);
    const compat = compatFromMeta(meta as Parameters<typeof compatFromMeta>[0]);
    const kinds = new Set(availableModes(compat));
    for (const key of await modeKeysOf(id)) {
      const entry = ENTRY_MAP[id].find((e) => e.key === key);
      expect(entry, `${id} 的 ENTRY_MAP 漏登记了入口 ${key}`).toBeDefined();
      if (!entry!.kind) continue;
      expect(kinds.has(entry!.kind), `${id} 的 ${key} 入口 meta 里没声明 ${entry!.kind}`).toBe(true);
    }
  });
});

describe("W1-03 · 模式菜单说的话走共享口径", () => {
  it.each(GAMES)("%s 把 describeModes 的那句话挂到入口条上", async (id) => {
    const src = SRC.get(id)!;
    expect(src, `${id} import 了 describeModes 却没调用`).toMatch(/describeModes\(/);
    const meta = await metaOf(id);
    const line = describeModes(compatFromMeta(meta as Parameters<typeof compatFromMeta>[0]));
    // 十二款都是「能闯关 + 有对战 + 有无尽」,共享口径应当把三样都说到
    expect(line).toContain("可以闯关");
    expect(line).not.toContain("还没登记玩法模式");
  });

  it("十二款的模式说明用的是同一套措辞,不是各写各的", async () => {
    const lines = new Set<string>();
    for (const id of GAMES) {
      const meta = await metaOf(id);
      lines.add(describeModes(compatFromMeta(meta as Parameters<typeof compatFromMeta>[0])));
    }
    // 只有 hero-cards 少一个 twoPlayer,所以应当正好两种说法
    expect(lines.size).toBe(2);
  });
});
