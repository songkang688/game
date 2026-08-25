import { describe, expect, it, vi } from "vitest";
import { collectGames, loadGames, type LazyImport } from "./loader";
import type { GameMeta } from "./types";

function fakeMeta(id: string, extra: Partial<GameMeta> = {}): unknown {
  return {
    meta: {
      id,
      title: `游戏${id}`,
      emoji: "🎈",
      category: "casual",
      color: "#ffd6e7",
      blurb: "测试用",
      ...extra
    }
  };
}

function fakeImpl(): LazyImport {
  return () =>
    Promise.resolve({
      mount: () => ({ destroy: () => undefined })
    });
}

/** 快速搭一张 metaModules + implLoaders 表:key 是游戏目录名 */
function tables(
  entries: Record<string, unknown>
): [Record<string, unknown>, Record<string, LazyImport>] {
  const metaModules: Record<string, unknown> = {};
  const implLoaders: Record<string, LazyImport> = {};
  for (const [dir, raw] of Object.entries(entries)) {
    metaModules[`../games/${dir}/meta.ts`] = raw;
    implLoaders[`../games/${dir}/index.ts`] = fakeImpl();
  }
  return [metaModules, implLoaders];
}

describe("游戏加载器", () => {
  it("合并后的游戏会被自动发现,id 唯一且不崩溃", () => {
    expect(() => loadGames()).not.toThrow();
    const games = loadGames();
    expect(games.length).toBeGreaterThanOrEqual(20);
    const ids = games.map((g) => g.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of games) {
      expect(g.meta.title.length).toBeGreaterThan(0);
      expect(typeof g.load).toBe("function");
    }
  });

  it("collectGames 处理空模块表", () => {
    expect(collectGames({}, {})).toEqual([]);
  });

  it("能提取命名导出的 meta,并配上懒加载器", () => {
    const games = collectGames(...tables({ a: fakeMeta("a") }));
    expect(games).toHaveLength(1);
    expect(games[0]?.meta.id).toBe("a");
    expect(typeof games[0]?.load).toBe("function");
  });

  it("能提取 default 导出的 meta 模块", () => {
    const games = collectGames(...tables({ b: { default: fakeMeta("b") } }));
    expect(games).toHaveLength(1);
    expect(games[0]?.meta.id).toBe("b");
  });

  it("load() 动态加载实现模块并返回 mount(支持命名导出)", async () => {
    const [metaModules, implLoaders] = tables({ a: fakeMeta("a") });
    const games = collectGames(metaModules, implLoaders);
    const mount = await games[0]!.load();
    expect(typeof mount).toBe("function");
    const handle = mount({} as never);
    expect(typeof handle.destroy).toBe("function");
  });

  it("load() 支持 default 导出的实现模块", async () => {
    const [metaModules] = tables({ a: fakeMeta("a") });
    const implLoaders: Record<string, LazyImport> = {
      "../games/a/index.ts": () =>
        Promise.resolve({
          default: { meta: {}, mount: () => ({ destroy: () => undefined }) }
        })
    };
    const games = collectGames(metaModules, implLoaders);
    const mount = await games[0]!.load();
    expect(typeof mount).toBe("function");
  });

  it("load() 在实现模块缺少 mount 时 reject,不静默失败", async () => {
    const [metaModules] = tables({ a: fakeMeta("a") });
    const implLoaders: Record<string, LazyImport> = {
      "../games/a/index.ts": () => Promise.resolve({ meta: {} })
    };
    const games = collectGames(metaModules, implLoaders);
    await expect(games[0]!.load()).rejects.toThrow(/mount/);
  });

  it("meta.ts 存在但同目录没有 index.ts 懒加载器时跳过并警告", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const games = collectGames(
      {
        "../games/ghost/meta.ts": fakeMeta("ghost"),
        "../games/ok/meta.ts": fakeMeta("ok")
      },
      { "../games/ok/index.ts": fakeImpl() }
    );
    expect(games).toHaveLength(1);
    expect(games[0]?.meta.id).toBe("ok");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("游戏 id 必须唯一:重复 id 只保留第一个", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const games = collectGames(
      ...tables({
        x: fakeMeta("same-id", { title: "第一个" }),
        y: fakeMeta("same-id", { title: "第二个" })
      })
    );
    expect(games).toHaveLength(1);
    expect(games[0]?.meta.title).toBe("第一个");
    const ids = games.map((g) => g.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("缺 meta / id 为空 / 模块为 null 的会被跳过而不是崩溃", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const games = collectGames(
      ...tables({
        bad1: {},
        bad2: { meta: { id: "bad2" } },
        bad3: fakeMeta(""),
        bad4: null,
        ok: fakeMeta("ok")
      })
    );
    expect(games).toHaveLength(1);
    expect(games[0]?.meta.id).toBe("ok");
    warn.mockRestore();
  });

  it("非法分类回退为 casual,缺省字段有默认值", () => {
    const games = collectGames(
      ...tables({
        c: { meta: { id: "c", title: "小测试", category: "weird" } }
      })
    );
    expect(games[0]?.meta.category).toBe("casual");
    expect(games[0]?.meta.emoji).toBe("🎮");
    expect(games[0]?.meta.color).toBeTruthy();
  });

  it("列表按分类顺序 + 标题排序,保证展示稳定", () => {
    const games = collectGames(
      ...tables({
        1: fakeMeta("g1", { category: "edu", title: "A 学习游戏" }),
        2: fakeMeta("g2", { category: "action", title: "B 闯关游戏" }),
        3: fakeMeta("g3", { category: "action", title: "A 闯关游戏" })
      })
    );
    expect(games.map((g) => g.meta.id)).toEqual(["g3", "g2", "g1"]);
  });
});

// ---------------------------------------------------------------------------
// meta.ts 抽取一致性:保证按需拆包后,首页 meta 与游戏实现导出的 meta 完全一致
// ---------------------------------------------------------------------------

const realMetaModules = import.meta.glob("../games/*/meta.ts", { eager: true }) as Record<
  string,
  { meta?: unknown }
>;
const realImplModules = import.meta.glob("../games/*/index.ts", { eager: true }) as Record<
  string,
  { meta?: unknown; mount?: unknown }
>;

describe("meta.ts 抽取一致性", () => {
  it("每个游戏目录都是 meta.ts + index.ts 一一配对", () => {
    const metaPaths = Object.keys(realMetaModules).sort();
    const implPaths = Object.keys(realImplModules).sort();
    expect(metaPaths.length).toBeGreaterThanOrEqual(20);
    expect(metaPaths.map((p) => p.replace(/meta\.ts$/, "index.ts"))).toEqual(implPaths);
  });

  it("每款游戏 index.ts 导出的 meta 与 meta.ts 内容完全一致", () => {
    for (const [metaPath, metaMod] of Object.entries(realMetaModules)) {
      const implPath = metaPath.replace(/meta\.ts$/, "index.ts");
      const implMod = realImplModules[implPath];
      expect(implMod?.meta, `index.ts 应 re-export meta: ${implPath}`).toEqual(metaMod.meta);
    }
  });

  it("meta.ts 是纯数据模块:字段全为字符串,可 JSON 序列化", () => {
    for (const [metaPath, metaMod] of Object.entries(realMetaModules)) {
      const meta = metaMod.meta as Record<string, unknown>;
      expect(meta && typeof meta === "object", metaPath).toBe(true);
      for (const [key, value] of Object.entries(meta)) {
        expect(typeof value, `${metaPath} 的 ${key} 应是字符串`).toBe("string");
      }
      expect(JSON.parse(JSON.stringify(meta))).toEqual(meta);
    }
  });

  it("每款游戏实现模块都导出 mount 函数", () => {
    for (const [implPath, implMod] of Object.entries(realImplModules)) {
      expect(typeof implMod.mount, implPath).toBe("function");
    }
  });
});
