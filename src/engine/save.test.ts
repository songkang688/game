import { describe, expect, it } from "vitest";
import { SAVE_KEY, SaveStore, type StorageLike } from "./save";

function memStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    keys: () => [...map.keys()]
  };
}

describe("SaveStore 星星存档", () => {
  it("初始余额为 0", () => {
    const store = new SaveStore(memStorage());
    expect(store.getStars()).toBe(0);
  });

  it("addStars 可以加星并返回最新余额", () => {
    const store = new SaveStore(memStorage());
    expect(store.addStars(3)).toBe(3);
    expect(store.addStars(2)).toBe(5);
    expect(store.getStars()).toBe(5);
  });

  it("addStars 可以扣星,但余额不会低于 0", () => {
    const store = new SaveStore(memStorage());
    store.addStars(4);
    expect(store.addStars(-3)).toBe(1);
    expect(store.addStars(-100)).toBe(0);
    expect(store.getStars()).toBe(0);
  });

  it("addStars 遇到非法数字时不改变余额", () => {
    const store = new SaveStore(memStorage());
    store.addStars(7);
    expect(store.addStars(Number.NaN)).toBe(7);
    expect(store.addStars(Number.POSITIVE_INFINITY)).toBe(7);
  });

  it("存档会持久化:同一 storage 再建实例能读回余额", () => {
    const storage = memStorage();
    const a = new SaveStore(storage);
    a.addStars(9);
    const b = new SaveStore(storage);
    expect(b.getStars()).toBe(9);
  });

  it("存档损坏(非法 JSON)时回退到默认值而不是崩溃", () => {
    const storage = memStorage();
    storage.setItem(SAVE_KEY, "{{{ 不是 JSON");
    const store = new SaveStore(storage);
    expect(store.getStars()).toBe(0);
    expect(store.isSoundOn()).toBe(true);
  });

  it("存档里的负数星星会被清洗为 0", () => {
    const storage = memStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ stars: -42, soundOn: true, games: {} }));
    const store = new SaveStore(storage);
    expect(store.getStars()).toBe(0);
  });

  it("recordWin 保留历史最好星级", () => {
    const store = new SaveStore(memStorage());
    store.recordWin("demo", 2);
    expect(store.getGameProgress("demo").bestStars).toBe(2);
    store.recordWin("demo", 1);
    expect(store.getGameProgress("demo").bestStars).toBe(2);
    store.recordWin("demo", 3);
    expect(store.getGameProgress("demo").bestStars).toBe(3);
  });

  it("recordPlay 累计游玩次数", () => {
    const store = new SaveStore(memStorage());
    store.recordPlay("demo");
    store.recordPlay("demo");
    expect(store.getGameProgress("demo").plays).toBe(2);
  });

  it("resetAll 清空全部进度", () => {
    const storage = memStorage();
    const store = new SaveStore(storage);
    store.addStars(10);
    store.recordWin("demo", 3);
    store.resetAll();
    expect(store.getStars()).toBe(0);
    expect(store.getGameProgress("demo").bestStars).toBe(0);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it("resetAll 连同 99 关 / 旧前缀经典包 / 最近玩过一起清空,不动别家应用的 key", () => {
    const storage = memStorage();
    const store = new SaveStore(storage);
    store.addStars(10);
    storage.setItem("yiduo-yixing.l99.rainbow-run", "[3,3,3]");
    storage.setItem("yiduo.gomoku.campaign.v2", JSON.stringify({ stars: [3, 2] }));
    storage.setItem("yiduo-yixing.recent.v1", JSON.stringify(["gomoku"]));
    storage.setItem("other-app.data", "keep-me");
    store.resetAll();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(storage.getItem("yiduo-yixing.l99.rainbow-run")).toBeNull();
    expect(storage.getItem("yiduo.gomoku.campaign.v2")).toBeNull();
    expect(storage.getItem("yiduo-yixing.recent.v1")).toBeNull();
    expect(storage.getItem("other-app.data")).toBe("keep-me");
  });

  it("onChange 订阅会在存档变化时触发,退订后不再触发", () => {
    const store = new SaveStore(memStorage());
    let calls = 0;
    const off = store.onChange(() => {
      calls += 1;
    });
    store.addStars(1);
    expect(calls).toBe(1);
    off();
    store.addStars(1);
    expect(calls).toBe(1);
  });

  it("背景音乐开关默认为关,设置后可持久化", () => {
    const storage = memStorage();
    const a = new SaveStore(storage);
    expect(a.isBgmOn()).toBe(false);
    a.setBgmOn(true);
    const b = new SaveStore(storage);
    expect(b.isBgmOn()).toBe(true);
  });
});

describe("SaveStore 进度导出与导入", () => {
  /** 造一份「玩了一阵子」的存档:钱包 + 99 关框架 + 动作游戏战役 + 最近玩过 */
  function seedProgress(storage: ReturnType<typeof memStorage>): {
    store: SaveStore;
    l99: number[];
  } {
    const store = new SaveStore(storage);
    store.addStars(42);
    store.recordWin("rainbow-run", 3);
    store.recordPlay("fruit-slice");
    // 99 关框架:前 88 关已拿 3 星
    const l99 = Array.from({ length: 99 }, (_, i) => (i < 88 ? 3 : 0));
    storage.setItem("yiduo-yixing.l99.rainbow-run", JSON.stringify(l99));
    storage.setItem(
      "yiduo-yixing.fruit-slice.campaign.v2",
      JSON.stringify({ level: 66, stars: 120 })
    );
    storage.setItem("yiduo-yixing.recent.v1", JSON.stringify(["rainbow-run", "fruit-slice"]));
    return { store, l99 };
  }

  it("导出文本带版本头,是一段可直接粘贴的单行文本", () => {
    const storage = memStorage();
    const { store } = seedProgress(storage);
    const text = store.exportAll();
    expect(text.startsWith("YDYX1.")).toBe(true);
    expect(text).not.toMatch(/\s/);
  });

  it("导出→清空全部→导入后,钱包星星与 99 关进度完整恢复", () => {
    const storage = memStorage();
    const { store, l99 } = seedProgress(storage);
    const text = store.exportAll();

    // 清空全部进度(家长面板的清空 + 手动清掉框架/游戏自己的 key)
    store.resetAll();
    storage.map.clear();
    expect(store.getStars()).toBe(0);
    expect(store.getGameProgress("rainbow-run").bestStars).toBe(0);
    expect(storage.getItem("yiduo-yixing.l99.rainbow-run")).toBeNull();

    const result = store.importAll(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBeGreaterThanOrEqual(4);

    // 钱包恢复
    expect(store.getStars()).toBe(42);
    expect(store.getGameProgress("rainbow-run").bestStars).toBe(3);
    expect(store.getGameProgress("fruit-slice").plays).toBe(1);
    // 99 关进度逐关恢复
    expect(JSON.parse(storage.getItem("yiduo-yixing.l99.rainbow-run") as string)).toEqual(l99);
    // 动作游戏战役与最近玩过也原样回来
    expect(storage.getItem("yiduo-yixing.fruit-slice.campaign.v2")).toBe(
      JSON.stringify({ level: 66, stars: 120 })
    );
    expect(storage.getItem("yiduo-yixing.recent.v1")).toBe(
      JSON.stringify(["rainbow-run", "fruit-slice"])
    );
  });

  it("导入会通知订阅方刷新(星星余额展示能跟着变)", () => {
    const storage = memStorage();
    const { store } = seedProgress(storage);
    const text = store.exportAll();
    store.resetAll();
    let calls = 0;
    store.onChange(() => {
      calls += 1;
    });
    const result = store.importAll(text);
    expect(result.ok).toBe(true);
    expect(calls).toBe(1);
  });

  it("乱文本导入被拒绝并给中文提示,现有存档不受影响", () => {
    const storage = memStorage();
    const store = new SaveStore(storage);
    store.addStars(5);
    for (const bad of ["", "   ", "这不是备份", "YDYX1.不是Base64!!!"]) {
      const result = store.importAll(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/[\u4e00-\u9fa5]/);
    }
    expect(store.getStars()).toBe(5);
  });

  it("校验和不匹配(内容被改动)的备份被拒绝", () => {
    const storage = memStorage();
    const { store } = seedProgress(storage);
    const text = store.exportAll();
    // 解开备份,偷偷把星星改成 9999,但不更新校验和
    const payload = JSON.parse(Buffer.from(text.slice("YDYX1.".length), "base64").toString("utf8")) as {
      v: number;
      sum: string;
      entries: Record<string, string>;
    };
    payload.entries[SAVE_KEY] = JSON.stringify({ stars: 9999, soundOn: true, games: {} });
    const forged = "YDYX1." + Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
    const result = store.importAll(forged);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("校验");
    expect(store.getStars()).toBe(42);
  });

  it("备份里混入非本应用前缀的 key 会被整体拒绝", () => {
    const storage = memStorage();
    const store = new SaveStore(storage);
    const entries = { "evil-key": "x" };
    const payload = JSON.stringify({ v: 1, sum: "00000000", entries });
    const forged = "YDYX1." + Buffer.from(payload, "utf8").toString("base64");
    const result = store.importAll(forged);
    expect(result.ok).toBe(false);
    expect(storage.getItem("evil-key")).toBeNull();
  });

  it("旧前缀经典包(五子棋等)的进度也会进备份,导入后完整恢复", () => {
    const storage = memStorage();
    const store = new SaveStore(storage);
    store.addStars(3);
    const gomoku = JSON.stringify({ stars: [3, 2, 1] });
    storage.setItem("yiduo.gomoku.campaign.v2", gomoku);
    storage.setItem("yiduo.candy-swing.campaign.v2", JSON.stringify({ stars: [3] }));
    const text = store.exportAll();

    store.resetAll();
    expect(storage.getItem("yiduo.gomoku.campaign.v2")).toBeNull();

    const result = store.importAll(text);
    expect(result.ok).toBe(true);
    expect(store.getStars()).toBe(3);
    expect(storage.getItem("yiduo.gomoku.campaign.v2")).toBe(gomoku);
    expect(storage.getItem("yiduo.candy-swing.campaign.v2")).toBe(JSON.stringify({ stars: [3] }));
  });

  it("隐私模式探测残留的 probe key 不会混进备份", () => {
    const storage = memStorage();
    const store = new SaveStore(storage);
    store.addStars(1);
    storage.setItem("yiduo-yixing.l99.probe", "1");
    const text = store.exportAll();
    const payload = JSON.parse(
      Buffer.from(text.slice("YDYX1.".length), "base64").toString("utf8")
    ) as { entries: Record<string, string> };
    expect(Object.keys(payload.entries)).not.toContain("yiduo-yixing.l99.probe");
    expect(Object.keys(payload.entries)).toContain(SAVE_KEY);
  });

  it("导入中途写入失败会整体回滚,不留半套存档", () => {
    // 先在一台「好设备」上导出一份备份
    const source = memStorage();
    const src = new SaveStore(source);
    src.addStars(7);
    source.setItem("yiduo-yixing.l99.demo", "[3,3]");
    const text = src.exportAll();

    // 目标设备:第 2 次写入开始必定失败(模拟存储写满)
    const inner = memStorage();
    inner.setItem(SAVE_KEY, JSON.stringify({ stars: 1, soundOn: true, games: {} }));
    let writes = 0;
    const flaky: StorageLike = {
      getItem: (key) => inner.getItem(key),
      removeItem: (key) => inner.removeItem(key),
      keys: () => [...inner.map.keys()],
      setItem: (key, value) => {
        writes += 1;
        if (writes >= 2) throw new Error("模拟存储写满");
        inner.setItem(key, value);
      }
    };
    const store = new SaveStore(flaky);
    const result = store.importAll(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("保持不变");
    // 现有钱包完好,导入到一半的 l99 也被回滚掉了
    expect(store.getStars()).toBe(1);
    expect(inner.getItem("yiduo-yixing.l99.demo")).toBeNull();
  });
});
