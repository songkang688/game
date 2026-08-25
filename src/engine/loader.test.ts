import { describe, expect, it, vi } from "vitest";
import { collectGames, loadGames } from "./loader";
import type { GameModule } from "./types";

function fakeModule(id: string, extra: Partial<GameModule["meta"]> = {}): unknown {
  return {
    meta: {
      id,
      title: `游戏${id}`,
      emoji: "🎈",
      category: "casual",
      color: "#ffd6e7",
      blurb: "测试用",
      ...extra
    },
    mount: () => ({ destroy: () => undefined })
  };
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
      expect(typeof g.mount).toBe("function");
    }
  });

  it("collectGames 处理空模块表", () => {
    expect(collectGames({})).toEqual([]);
  });

  it("能提取命名导出的 meta/mount", () => {
    const games = collectGames({ "../games/a/index.ts": fakeModule("a") });
    expect(games).toHaveLength(1);
    expect(games[0]?.meta.id).toBe("a");
    expect(typeof games[0]?.mount).toBe("function");
  });

  it("能提取 default 导出的游戏模块", () => {
    const games = collectGames({
      "../games/b/index.ts": { default: fakeModule("b") }
    });
    expect(games).toHaveLength(1);
    expect(games[0]?.meta.id).toBe("b");
  });

  it("游戏 id 必须唯一:重复 id 只保留第一个", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const games = collectGames({
      "../games/x/index.ts": fakeModule("same-id", { title: "第一个" }),
      "../games/y/index.ts": fakeModule("same-id", { title: "第二个" })
    });
    expect(games).toHaveLength(1);
    expect(games[0]?.meta.title).toBe("第一个");
    const ids = games.map((g) => g.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("缺 meta / 缺 mount / id 为空 的模块会被跳过而不是崩溃", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const games = collectGames({
      "../games/bad1/index.ts": {},
      "../games/bad2/index.ts": { meta: { id: "bad2" } },
      "../games/bad3/index.ts": fakeModule(""),
      "../games/bad4/index.ts": null,
      "../games/ok/index.ts": fakeModule("ok")
    });
    expect(games).toHaveLength(1);
    expect(games[0]?.meta.id).toBe("ok");
    warn.mockRestore();
  });

  it("非法分类回退为 casual,缺省字段有默认值", () => {
    const games = collectGames({
      "../games/c/index.ts": {
        meta: { id: "c", title: "小测试", category: "weird" },
        mount: () => ({ destroy: () => undefined })
      }
    });
    expect(games[0]?.meta.category).toBe("casual");
    expect(games[0]?.meta.emoji).toBe("🎮");
    expect(games[0]?.meta.color).toBeTruthy();
  });

  it("列表按分类顺序 + 标题排序,保证展示稳定", () => {
    const games = collectGames({
      "../games/1/index.ts": fakeModule("g1", { category: "edu", title: "A 学习游戏" }),
      "../games/2/index.ts": fakeModule("g2", { category: "action", title: "B 闯关游戏" }),
      "../games/3/index.ts": fakeModule("g3", { category: "action", title: "A 闯关游戏" })
    });
    expect(games.map((g) => g.meta.id)).toEqual(["g3", "g2", "g1"]);
  });
});
