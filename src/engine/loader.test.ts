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

  it("1.1 新增的 modes / levels / ageHint 会原样带到首页", () => {
    const [metas, impls] = tables({
      a: fakeMeta("a", { modes: ["campaign", "endless"], levels: 99, ageHint: 6 })
    });
    const meta = collectGames(metas, impls)[0]?.meta;
    expect(meta?.modes).toEqual(["campaign", "endless"]);
    expect(meta?.levels).toBe(99);
    expect(meta?.ageHint).toBe(6);
  });

  it("modes 里不认识的模式名被剔除,顺序按 GAME_MODES 归一", () => {
    const [metas, impls] = tables({
      a: fakeMeta("a", { modes: ["endless", "解谜", "campaign"] as unknown as GameMeta["modes"] })
    });
    expect(collectGames(metas, impls)[0]?.meta.modes).toEqual(["campaign", "endless"]);
  });

  it("modes 不是数组、或者一个合法项都没有,就当没填", () => {
    const [metas, impls] = tables({
      a: fakeMeta("a", { modes: "campaign" as unknown as GameMeta["modes"] }),
      b: fakeMeta("b", { modes: ["瞎写的"] as unknown as GameMeta["modes"] })
    });
    const games = collectGames(metas, impls);
    expect(games[0]?.meta.modes).toBeUndefined();
    expect(games[1]?.meta.modes).toBeUndefined();
  });

  it("levels / ageHint 是 0、负数、NaN 或非数字时一律当没填", () => {
    const [metas, impls] = tables({
      a: fakeMeta("a", { levels: 0, ageHint: -3 }),
      b: fakeMeta("b", { levels: Number.NaN, ageHint: "六岁" as unknown as number })
    });
    const games = collectGames(metas, impls);
    for (const g of games) {
      expect(g.meta.levels).toBeUndefined();
      expect(g.meta.ageHint).toBeUndefined();
    }
  });

  it("没填新字段的老 meta 不会凭空多出这几个键", () => {
    const [metas, impls] = tables({ a: fakeMeta("a") });
    const meta = collectGames(metas, impls)[0]?.meta as Record<string, unknown>;
    expect(Object.keys(meta).sort()).toEqual(
      ["blurb", "category", "color", "emoji", "id", "title"].sort()
    );
  });

  // -------------------------------------------------------------------------
  // 1.2 新增的 platform。
  //
  // 第 1 轮走查发现首页三颗设备芯片怎么点都是同一批卡：`types.ts` 加了字段、
  // `homeFilters.ts` 会筛，可这里的白名单归一化从没把 platform 抄过去，
  // 首页拿到的 meta 根本没有这个键。补上,并用用例钉死。
  // -------------------------------------------------------------------------
  it("platform 会原样带到首页(三个取值都要能过来)", () => {
    const [metas, impls] = tables({
      a: fakeMeta("a", { platform: "mobile" }),
      b: fakeMeta("b", { platform: "desktop" }),
      c: fakeMeta("c", { platform: "both" })
    });
    const games = collectGames(metas, impls);
    expect(games.map((g) => g.meta.platform)).toEqual(["mobile", "desktop", "both"]);
  });

  it("platform 是脏值就当没填(下游按 both 处理,不会让游戏消失)", () => {
    const [metas, impls] = tables({
      a: fakeMeta("a", { platform: "ios" as unknown as GameMeta["platform"] }),
      b: fakeMeta("b", { platform: 3 as unknown as GameMeta["platform"] })
    });
    for (const g of collectGames(metas, impls)) expect(g.meta.platform).toBeUndefined();
  });

  it("没填 platform 的老 meta 不会凭空多出这个键", () => {
    const [metas, impls] = tables({ a: fakeMeta("a") });
    const meta = collectGames(metas, impls)[0]?.meta as Record<string, unknown>;
    expect("platform" in meta).toBe(false);
  });

  it("仓库里真实的 meta.ts,platform 一路带到首页没被吃掉", () => {
    // collectGames 的第二张表要的是「懒加载函数」,这里把 eager 收来的实现包一层
    const lazy = Object.fromEntries(
      Object.entries(realImplModules).map(([path, mod]) => [path, () => Promise.resolve(mod)])
    );
    const games = collectGames(realMetaModules, lazy);
    const byId = new Map(games.map((g) => [g.meta.id, g.meta.platform]));
    expect(byId.get("merge-2048")).toBe("mobile");
    expect(byId.get("combo-clash")).toBe("desktop");
    expect(byId.get("orb-arena")).toBe("both");
    // 至少要有两种不同的取值,不然首页那排芯片就是摆设
    expect(new Set([...byId.values()]).size).toBeGreaterThan(1);
  });

  it("meta.ts 是纯数据模块:只有字符串 / 数字 / 字符串数组,可 JSON 序列化", () => {
    for (const [metaPath, metaMod] of Object.entries(realMetaModules)) {
      const meta = metaMod.meta as Record<string, unknown>;
      expect(meta && typeof meta === "object", metaPath).toBe(true);
      for (const [key, value] of Object.entries(meta)) {
        const where = `${metaPath} 的 ${key}`;
        if (Array.isArray(value)) {
          // 1.1 起 modes 是字符串数组,其余仍旧是标量
          expect(value.every((v) => typeof v === "string"), `${where} 应是字符串数组`).toBe(true);
          continue;
        }
        expect(["string", "number"], where).toContain(typeof value);
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
