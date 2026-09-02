import { beforeEach, describe, expect, it } from "vitest";
import {
  ROOT_ADMIN_PHONE,
  ROOT_DEFAULT_DURATION,
  ROOT_DEFAULT_PASSWORD,
  ROOT_DURATION_CHOICES,
  ROOT_LOCK_MS,
  ROOT_MAX_WRONG,
  ROOT_PERMANENT_EXPIRES_AT,
  ROOT_STORAGE_KEY,
  ROOT_TTL_MS,
  clampJumpTarget,
  clearRootSession,
  getRoot12Extras,
  isRootOpen,
  isRootPermanent,
  openRootSession,
  readRootSession,
  registerRoot12Extras,
  resetRoot12Extras,
  rootDurationOf,
  rootRemainMinutes,
  rootRemainMs,
  rootStatusLine,
  writeRootSession,
  type RootStorageLike
} from "./root12Contract";

/** 一份能查看内容的假存储:测试要确认「密码一个字都没落盘」 */
function memStorage(): RootStorageLike & { dump: () => string } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    dump: () => JSON.stringify(Array.from(map.entries()))
  };
}

/** 读写一律抛异常的存储:隐私模式 */
function hostileStorage(): RootStorageLike {
  return {
    getItem: () => {
      throw new Error("privacy mode");
    },
    setItem: () => {
      throw new Error("privacy mode");
    },
    removeItem: () => {
      throw new Error("privacy mode");
    }
  };
}

beforeEach(() => {
  resetRoot12Extras();
});

describe("root 契约常量", () => {
  it("有效期就是一小时", () => {
    expect(ROOT_TTL_MS).toBe(3600000);
    expect(ROOT_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("联系方式与默认密码逐字对得上", () => {
    expect(ROOT_ADMIN_PHONE).toBe("18438037080");
    expect(ROOT_DEFAULT_PASSWORD).toBe("kangkang");
  });

  it("存档 key 与 1.1 的既有 key 不撞车", () => {
    expect(ROOT_STORAGE_KEY).toBe("yiduo-yixing.root.v1");
    expect(ROOT_STORAGE_KEY).not.toBe("yiduo-yixing.save.v1");
  });

  it("防暴力参数是连错 3 次锁 120 秒", () => {
    expect(ROOT_MAX_WRONG).toBe(3);
    expect(ROOT_LOCK_MS).toBe(120000);
  });

  it("时长选项:默认 1 小时,能选更短、更长,最后一项是永久", () => {
    expect(ROOT_DEFAULT_DURATION).toBe("1h");
    const keys = ROOT_DURATION_CHOICES.map((c) => c.key);
    expect(keys).toEqual(["30m", "1h", "4h", "forever"]);
    expect(rootDurationOf("1h").ms).toBe(ROOT_TTL_MS);
    expect(rootDurationOf("30m").ms).toBe(30 * 60 * 1000);
    expect(rootDurationOf("forever").ms).toBeNull();
    expect(rootDurationOf("forever").label).toBe("永久");
  });

  it("不认识的时长 key 一律退回默认 1 小时,不抛异常", () => {
    expect(rootDurationOf("100y").ms).toBe(ROOT_TTL_MS);
    expect(rootDurationOf(null).ms).toBe(ROOT_TTL_MS);
    expect(rootDurationOf(undefined).ms).toBe(ROOT_TTL_MS);
  });

  it("永久用的远未来时间戳确实远(过了 2900 年),而且是有限数", () => {
    expect(Number.isFinite(ROOT_PERMANENT_EXPIRES_AT)).toBe(true);
    expect(ROOT_PERMANENT_EXPIRES_AT).toBeGreaterThan(Date.UTC(2900, 0, 1));
  });
});

describe("root 会话读写", () => {
  it("刚写进去的会话在有效期内算开着", () => {
    const st = memStorage();
    writeRootSession(1000 + ROOT_TTL_MS, st);
    expect(isRootOpen(1000, st)).toBe(true);
    expect(readRootSession(1000, st)?.expiresAt).toBe(1000 + ROOT_TTL_MS);
  });

  it("到点那一刻就算关闭,而且把存档记录清掉", () => {
    const st = memStorage();
    writeRootSession(1000 + ROOT_TTL_MS, st);
    expect(isRootOpen(1000 + ROOT_TTL_MS, st)).toBe(false);
    expect(st.getItem(ROOT_STORAGE_KEY)).toBeNull();
  });

  it("假时钟推进一小时后控件该消失(isRootOpen 转 false)", () => {
    const st = memStorage();
    let clock = 5_000_000;
    writeRootSession(clock + ROOT_TTL_MS, st);
    expect(isRootOpen(clock, st)).toBe(true);
    clock += ROOT_TTL_MS + 1;
    expect(isRootOpen(clock, st)).toBe(false);
  });

  it("坏 JSON 一律当没开,不抛异常", () => {
    const st = memStorage();
    st.setItem(ROOT_STORAGE_KEY, "{不是 json");
    expect(() => isRootOpen(1000, st)).not.toThrow();
    expect(isRootOpen(1000, st)).toBe(false);
  });

  it("expiresAt 不是数字就当没开", () => {
    const st = memStorage();
    st.setItem(ROOT_STORAGE_KEY, JSON.stringify({ expiresAt: "以后" }));
    expect(isRootOpen(1000, st)).toBe(false);
  });

  it("NaN / Infinity 这种脏数据也当没开", () => {
    const st = memStorage();
    st.setItem(ROOT_STORAGE_KEY, JSON.stringify({ expiresAt: null }));
    expect(isRootOpen(1000, st)).toBe(false);
    st.setItem(ROOT_STORAGE_KEY, '{"expiresAt":1e999}');
    // 1e999 解析成 Infinity:永不过期不合规矩,当没开
    expect(isRootOpen(1000, st)).toBe(false);
  });

  it("隐私模式(没有可用的 localStorage)降级到内存,仍旧一小时过期", () => {
    // 传 null 表示「一个能用的存储都没有」,契约会退到内存会话
    expect(() => writeRootSession(1000 + ROOT_TTL_MS, null)).not.toThrow();
    expect(isRootOpen(1000, null)).toBe(true);
    expect(isRootOpen(1000 + ROOT_TTL_MS, null)).toBe(false);
  });

  it("存储读写一路抛异常也不会把游戏搞崩", () => {
    const st = hostileStorage();
    expect(() => writeRootSession(1000 + ROOT_TTL_MS, st)).not.toThrow();
    expect(() => isRootOpen(1000, st)).not.toThrow();
    expect(() => clearRootSession(st)).not.toThrow();
    expect(isRootOpen(1000, st)).toBe(false);
  });

  it("clearRootSession 之后立刻算关闭", () => {
    const st = memStorage();
    writeRootSession(1000 + ROOT_TTL_MS, st);
    clearRootSession(st);
    expect(isRootOpen(1000, st)).toBe(false);
    expect(st.getItem(ROOT_STORAGE_KEY)).toBeNull();
  });

  it("落盘的内容里搜不到密码,只有过期时间和 mode", () => {
    const st = memStorage();
    writeRootSession(1000 + ROOT_TTL_MS, st);
    expect(st.dump()).not.toContain(ROOT_DEFAULT_PASSWORD);
    expect(st.getItem(ROOT_STORAGE_KEY)).toBe(
      JSON.stringify({ expiresAt: 1000 + ROOT_TTL_MS, mode: "timed" })
    );
  });

  it("1.2 的老存档(没有 mode 字段)照样能读,按限时处理", () => {
    const st = memStorage();
    st.setItem(ROOT_STORAGE_KEY, JSON.stringify({ expiresAt: 1000 + ROOT_TTL_MS }));
    expect(isRootOpen(1000, st)).toBe(true);
    expect(isRootPermanent(1000, st)).toBe(false);
    expect(isRootOpen(1000 + ROOT_TTL_MS, st)).toBe(false);
  });

  it("mode 是脏值时按限时处理,不误判成永久", () => {
    const st = memStorage();
    st.setItem(ROOT_STORAGE_KEY, JSON.stringify({ expiresAt: 1000 + ROOT_TTL_MS, mode: "有时候" }));
    expect(isRootOpen(1000, st)).toBe(true);
    expect(isRootPermanent(1000, st)).toBe(false);
    expect(isRootOpen(1000 + ROOT_TTL_MS + 1, st)).toBe(false);
  });

  it("rootRemainMs 随时间单调递减,关掉后是 0", () => {
    const st = memStorage();
    writeRootSession(1000 + ROOT_TTL_MS, st);
    const a = rootRemainMs(1000, st);
    const b = rootRemainMs(1000 + 60_000, st);
    expect(a).toBe(ROOT_TTL_MS);
    expect(b).toBeLessThan(a);
    clearRootSession(st);
    expect(rootRemainMs(1000, st)).toBe(0);
  });
});

describe("openRootSession:按时长开门", () => {
  const now = 10_000_000;

  it("默认(不传时长)就是 1 小时", () => {
    const st = memStorage();
    openRootSession(now, undefined, st);
    expect(isRootOpen(now, st)).toBe(true);
    expect(rootRemainMs(now, st)).toBe(ROOT_TTL_MS);
    expect(isRootOpen(now + ROOT_TTL_MS, st)).toBe(false);
  });

  it("选 30 分钟就 30 分钟到点关", () => {
    const st = memStorage();
    openRootSession(now, "30m", st);
    expect(rootRemainMs(now, st)).toBe(30 * 60 * 1000);
    expect(isRootOpen(now + 29 * 60_000, st)).toBe(true);
    expect(isRootOpen(now + 31 * 60_000, st)).toBe(false);
  });

  it("选 4 小时就 4 小时到点关", () => {
    const st = memStorage();
    openRootSession(now, "4h", st);
    expect(isRootOpen(now + 3 * 60 * 60_000, st)).toBe(true);
    expect(isRootOpen(now + 4 * 60 * 60_000, st)).toBe(false);
  });

  it("选永久:一年后、十年后都还开着,mode 是 permanent", () => {
    const st = memStorage();
    const session = openRootSession(now, "forever", st);
    expect(session.mode).toBe("permanent");
    expect(session.expiresAt).toBe(ROOT_PERMANENT_EXPIRES_AT);
    expect(isRootPermanent(now, st)).toBe(true);
    expect(isRootOpen(now + 365 * 24 * 60 * 60_000, st)).toBe(true);
    expect(isRootOpen(now + 10 * 365 * 24 * 60 * 60_000, st)).toBe(true);
  });

  it("永久也能手动关,关掉后立刻失效、存档记录清掉", () => {
    const st = memStorage();
    openRootSession(now, "forever", st);
    clearRootSession(st);
    expect(isRootOpen(now, st)).toBe(false);
    expect(isRootPermanent(now, st)).toBe(false);
    expect(st.getItem(ROOT_STORAGE_KEY)).toBeNull();
  });

  it("永久落盘的也只有过期时间和 mode,没有密码", () => {
    const st = memStorage();
    openRootSession(now, "forever", st);
    expect(st.dump()).not.toContain(ROOT_DEFAULT_PASSWORD);
    expect(st.getItem(ROOT_STORAGE_KEY)).toBe(
      JSON.stringify({ expiresAt: ROOT_PERMANENT_EXPIRES_AT, mode: "permanent" })
    );
  });

  it("限时会话不是永久:isRootPermanent 返回 false", () => {
    const st = memStorage();
    openRootSession(now, "1h", st);
    expect(isRootOpen(now, st)).toBe(true);
    expect(isRootPermanent(now, st)).toBe(false);
  });

  it("隐私模式(storage 为 null)选永久也能开,靠内存会话", () => {
    openRootSession(now, "forever", null);
    expect(isRootOpen(now + 365 * 24 * 60 * 60_000, null)).toBe(true);
    expect(isRootPermanent(now, null)).toBe(true);
    clearRootSession(null);
    expect(isRootOpen(now, null)).toBe(false);
  });
});

describe("rootStatusLine:统一状态文案", () => {
  const now = 20_000_000;

  it("关着时一句话", () => {
    const st = memStorage();
    expect(rootStatusLine(now, st)).toBe("管理员权限已关闭");
  });

  it("限时开着时报剩余分钟", () => {
    const st = memStorage();
    openRootSession(now, "1h", st);
    expect(rootStatusLine(now + 17 * 60_000, st)).toBe("管理员权限已开,还剩 43 分钟");
  });

  it("永久开着时说「永久开启」,绝不再报还剩几分钟", () => {
    const st = memStorage();
    openRootSession(now, "forever", st);
    const text = rootStatusLine(now, st);
    expect(text).toBe("管理员权限已永久开启");
    expect(text).not.toContain("还剩");
    expect(text).not.toContain("分钟");
  });

  it("过期后自动回到「已关闭」", () => {
    const st = memStorage();
    openRootSession(now, "30m", st);
    expect(rootStatusLine(now + 31 * 60_000, st)).toBe("管理员权限已关闭");
  });

  it("状态文案里不写 root、不写高权限", () => {
    const st = memStorage();
    openRootSession(now, "forever", st);
    const text = rootStatusLine(now, st);
    expect(text.toLowerCase()).not.toContain("root");
    expect(text).not.toContain("高权限");
  });
});

describe("root extras 注册表", () => {
  it("没注册时拿到空对象,调用方自己降级也不会崩", () => {
    expect(getRoot12Extras()).toEqual({});
    expect(getRoot12Extras().requestRootOpen).toBeUndefined();
  });

  it("注册后能取回实现,而且是合并不是替换", () => {
    const open = async (): Promise<boolean> => true;
    registerRoot12Extras({ requestRootOpen: open });
    registerRoot12Extras({ closeRoot: () => undefined });
    expect(getRoot12Extras().requestRootOpen).toBe(open);
    expect(typeof getRoot12Extras().closeRoot).toBe("function");
  });
});

describe("直达第 N 关的输入夹取", () => {
  it("正常数字原样返回", () => {
    expect(clampJumpTarget("100", 188)).toBe(100);
    expect(clampJumpTarget(" 188 ", 188)).toBe(188);
  });

  it("越界一律夹到 1..total", () => {
    expect(clampJumpTarget("0", 188)).toBe(1);
    expect(clampJumpTarget("-5", 188)).toBe(1);
    expect(clampJumpTarget("189", 188)).toBe(188);
    expect(clampJumpTarget("1e9", 188)).toBe(188);
  });

  it("空串与非数字返回 null,不抛异常", () => {
    expect(clampJumpTarget("", 188)).toBeNull();
    expect(clampJumpTarget("   ", 188)).toBeNull();
    expect(clampJumpTarget("abc", 188)).toBeNull();
    expect(() => clampJumpTarget("abc", 188)).not.toThrow();
  });

  it("小数四舍五入,total 脏值也不炸", () => {
    expect(clampJumpTarget("12.4", 188)).toBe(12);
    expect(clampJumpTarget("12.6", 188)).toBe(13);
    expect(clampJumpTarget("5", Number.NaN)).toBe(1);
  });

  it("剩余分钟数:不足一分钟按 1 分钟报,没开是 0", () => {
    expect(rootRemainMinutes(0)).toBe(0);
    expect(rootRemainMinutes(-10)).toBe(0);
    expect(rootRemainMinutes(1)).toBe(1);
    expect(rootRemainMinutes(ROOT_TTL_MS)).toBe(60);
    expect(rootRemainMinutes(43 * 60_000)).toBe(43);
  });
});
