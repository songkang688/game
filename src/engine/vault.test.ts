import { describe, expect, it, beforeEach } from "vitest";
import { save, SAVE_KEY, type StorageLike } from "./save";
import {
  backupToVault,
  isLocalProgressEmpty,
  readEnvelope,
  restoreFromVault,
  setVaultForTest,
  startAutoBackup,
  wrapEnvelope,
  type VaultAdapter
} from "./vault";

function memStorage(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    map,
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    keys: () => [...map.keys()]
  };
}

/** 一个记账用的假保险箱:记下写了几次、最后写了什么 */
function fakeVault(initial: string | null = null): VaultAdapter & { file: string | null; writes: number } {
  const v = {
    kind: "fsaccess" as const,
    location: "测试文件夹",
    file: initial,
    writes: 0,
    ready: () => Promise.resolve(true),
    connect: () => Promise.resolve(true),
    read: () => Promise.resolve(v.file),
    write: (text: string) => {
      v.file = text;
      v.writes += 1;
      return Promise.resolve(true);
    },
    forget: () => Promise.resolve()
  };
  return v;
}

beforeEach(() => {
  setVaultForTest(null);
  save.resetAll();
});

describe("存档信封", () => {
  it("套上时间戳再解开,里面还是原来那段备份文本", () => {
    const payload = save.exportAll();
    const envelope = readEnvelope(wrapEnvelope(payload, new Date("2026-01-02T03:04:05Z")));
    expect(envelope?.payload).toBe(payload);
    expect(envelope?.savedAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("直接把手动导出的裸 YDYX1 文本丢进文件夹也认", () => {
    const payload = save.exportAll();
    expect(readEnvelope(payload)?.payload).toBe(payload);
  });

  it("不是本应用的文件一律不认,免得拿别的 json 去覆盖进度", () => {
    expect(readEnvelope(null)).toBeNull();
    expect(readEnvelope("")).toBeNull();
    expect(readEnvelope("随便一段字")).toBeNull();
    expect(readEnvelope('{"app":"别的应用","v":1,"payload":"YDYX1.xx"}')).toBeNull();
    expect(readEnvelope('{"app":"yiduo-yixing","v":1,"payload":"这不是备份"}')).toBeNull();
  });
});

describe("本地进度是不是一片空白", () => {
  it("刚装好:什么都没有,算空", () => {
    expect(isLocalProgressEmpty(memStorage())).toBe(true);
  });

  it("有钱包但零星零场次(清空过),仍算空", () => {
    const s = memStorage({ [SAVE_KEY]: JSON.stringify({ stars: 0, soundOn: true, bgmOn: false, games: {} }) });
    expect(isLocalProgressEmpty(s)).toBe(true);
  });

  it("玩过一关(有 l99 星级)就不算空", () => {
    expect(isLocalProgressEmpty(memStorage({ "yiduo-yixing.l99.gomoku": "[3]" }))).toBe(false);
  });

  it("攒了星星也不算空", () => {
    const s = memStorage({ [SAVE_KEY]: JSON.stringify({ stars: 12, games: {} }) });
    expect(isLocalProgressEmpty(s)).toBe(false);
  });

  it("隐私模式探测留下的 probe key 不算进度", () => {
    expect(isLocalProgressEmpty(memStorage({ "yiduo-yixing.l99.probe": "1" }))).toBe(true);
  });
});

describe("开机自检恢复", () => {
  it("本地空白时把保险箱里的进度接回来", () => {
    save.addStars(30);
    const backup = wrapEnvelope(save.exportAll());
    save.resetAll();
    expect(save.getStars()).toBe(0);

    setVaultForTest(fakeVault(backup));
    return restoreFromVault(false, memStorage()).then((r) => {
      expect(r.ok).toBe(true);
      expect(save.getStars()).toBe(30);
    });
  });

  it("本地已经有进度就绝不自动覆盖", () => {
    save.addStars(100);
    const backup = wrapEnvelope(save.exportAll());
    save.resetAll();
    save.addStars(7);

    setVaultForTest(fakeVault(backup));
    return restoreFromVault(false, memStorage({ "yiduo-yixing.l99.gomoku": "[1]" })).then((r) => {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("local-not-empty");
      expect(save.getStars()).toBe(7);
    });
  });

  it("家长按下「从备份恢复」时,本地有进度也照恢复", () => {
    save.addStars(50);
    const backup = wrapEnvelope(save.exportAll());
    save.resetAll();
    save.addStars(1);

    setVaultForTest(fakeVault(backup));
    return restoreFromVault(true).then((r) => {
      expect(r.ok).toBe(true);
      expect(save.getStars()).toBe(50);
    });
  });

  it("文件夹里还没有备份文件时,安静地什么都不做", () => {
    setVaultForTest(fakeVault(null));
    return restoreFromVault(true).then((r) => {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("no-file");
    });
  });

  it("这台设备没有保险箱时不报错,只说没开", () => {
    setVaultForTest(null);
    return restoreFromVault(true).then((r) => {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("no-vault");
    });
  });
});

describe("自动备份", () => {
  it("写出去的文件解开就是当前进度", () => {
    const vault = fakeVault();
    setVaultForTest(vault);
    save.addStars(9);
    return backupToVault().then((ok) => {
      expect(ok).toBe(true);
      expect(readEnvelope(vault.file)?.payload).toBe(save.exportAll());
    });
  });

  it("进度没变就不重复写文件,变了才写", () => {
    const vault = fakeVault();
    setVaultForTest(vault);
    const handle = startAutoBackup({ schedule: () => () => undefined, addPageHooks: () => () => undefined });
    return handle
      .flush()
      .then(() => {
        // 开机那次已经写过一遍
        const first = vault.writes;
        expect(first).toBeGreaterThanOrEqual(1);
        return handle.flush().then(() => expect(vault.writes).toBe(first));
      })
      .then(() => {
        const before = vault.writes;
        save.addStars(3);
        return handle.flush().then(() => {
          expect(vault.writes).toBe(before + 1);
          expect(readEnvelope(vault.file)?.payload).toBe(save.exportAll());
          handle.stop();
        });
      });
  });

  it("停掉之后不再写", () => {
    const vault = fakeVault();
    setVaultForTest(vault);
    const handle = startAutoBackup({ schedule: () => () => undefined, addPageHooks: () => () => undefined });
    return handle.flush().then(() => {
      handle.stop();
      const after = vault.writes;
      save.addStars(5);
      return handle.flush().then(() => expect(vault.writes).toBe(after));
    });
  });
});
