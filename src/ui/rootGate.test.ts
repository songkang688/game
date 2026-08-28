import { beforeEach, describe, expect, it } from "vitest";
import {
  ROOT_CONTACT_LINE,
  closeRoot,
  requestRootOpen,
  resetRootGate,
  rootDialogSpec,
  rootLockRemainMs,
  rootLockText,
  rootStatusText,
  setRootClock,
  submitRootPassword,
  useRealRootClock
} from "./rootGate";
import {
  ROOT_DEFAULT_PASSWORD,
  ROOT_LOCK_MS,
  ROOT_PERMANENT_EXPIRES_AT,
  ROOT_STORAGE_KEY,
  ROOT_TTL_MS,
  getRoot12Extras,
  isRootOpen,
  isRootPermanent,
  resetRoot12Extras,
  rootRemainMs,
  type RootStorageLike
} from "./root12Contract";

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

/** 假时钟:全套测试都不真等 120 秒 / 1 小时 */
let clock = 1_000_000;

beforeEach(() => {
  clock = 1_000_000;
  setRootClock(() => clock);
  resetRootGate();
});

describe("rootGate 弹窗内容清单", () => {
  it("那句联系方式逐字都在", () => {
    expect(ROOT_CONTACT_LINE).toBe("要打开请联系管理员 18438037080");
    expect(rootDialogSpec("要直达关卡", clock, memStorage()).phoneLine).toContain("18438037080");
  });

  it("输入框永远是密码框", () => {
    expect(rootDialogSpec("要直达关卡", clock, memStorage()).inputType).toBe("password");
  });

  it("门关着时只有「打开」「不打开」两颗按钮", () => {
    const spec = rootDialogSpec("要直达关卡", clock, memStorage());
    expect(spec.buttons.map((b) => b.key)).toEqual(["open", "cancel"]);
  });

  it("门开着时多一颗「关闭管理员权限」", () => {
    const st = memStorage();
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, st);
    const spec = rootDialogSpec("要直达关卡", clock, st);
    expect(spec.buttons.map((b) => b.key)).toContain("close");
    expect(spec.buttons.find((b) => b.key === "close")?.label).toBe("关闭管理员权限");
  });

  it("说明文字里带上调用方给的理由", () => {
    expect(rootDialogSpec("要直达第 188 关", clock, memStorage()).desc).toContain("要直达第 188 关");
  });

  it("孩子看得见的文案里不写吓人词,也不沾商标", () => {
    const spec = rootDialogSpec("要直达关卡", clock, memStorage());
    const text = [spec.title, spec.desc, spec.phoneLine, ...spec.buttons.map((b) => b.label)].join("|");
    expect(text.toLowerCase()).not.toContain("root");
    expect(text).not.toContain("高权限");
    expect(text).not.toMatch(/超级玛丽|拳皇|Tetris|愤怒的小鸟/);
  });
});

describe("rootGate 密码判定", () => {
  it("密码对就把门打开一小时", () => {
    const st = memStorage();
    const r = submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, st);
    expect(r.ok).toBe(true);
    expect(r.opened).toBe(true);
    expect(isRootOpen(clock, st)).toBe(true);
    expect(rootRemainMs(clock, st)).toBe(ROOT_TTL_MS);
  });

  it("密码不对就打不开,并提示还能试几次", () => {
    const st = memStorage();
    const r = submitRootPassword("kangkang1", clock, st);
    expect(r.ok).toBe(false);
    expect(isRootOpen(clock, st)).toBe(false);
    expect(r.tip).toContain("还可以再试 2 次");
  });

  it("大小写不同也算错", () => {
    const st = memStorage();
    expect(submitRootPassword("KangKang", clock, st).ok).toBe(false);
    expect(isRootOpen(clock, st)).toBe(false);
  });

  it("空密码算错,不会误开", () => {
    const st = memStorage();
    expect(submitRootPassword("", clock, st).ok).toBe(false);
    expect(isRootOpen(clock, st)).toBe(false);
  });

  it("localStorage 里搜不到 kangkang,落盘只有过期时间和 mode", () => {
    const st = memStorage();
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, st);
    expect(st.dump()).not.toContain("kangkang");
    expect(st.getItem(ROOT_STORAGE_KEY)).toBe(
      JSON.stringify({ expiresAt: clock + ROOT_TTL_MS, mode: "timed" })
    );
  });
});

describe("rootGate 时长选择", () => {
  it("不选时长就是默认 1 小时", () => {
    const st = memStorage();
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, st);
    expect(rootRemainMs(clock, st)).toBe(ROOT_TTL_MS);
    expect(isRootPermanent(clock, st)).toBe(false);
  });

  it("选 30 分钟:密码对就开 30 分钟,到点自动关", () => {
    const st = memStorage();
    const r = submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, st, "30m");
    expect(r.ok).toBe(true);
    expect(rootRemainMs(clock, st)).toBe(30 * 60 * 1000);
    expect(isRootOpen(clock + 29 * 60_000, st)).toBe(true);
    expect(isRootOpen(clock + 31 * 60_000, st)).toBe(false);
  });

  it("选永久:十年后还开着,存档里是远未来时间戳 + permanent 标记", () => {
    const st = memStorage();
    const r = submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, st, "forever");
    expect(r.ok).toBe(true);
    expect(isRootPermanent(clock, st)).toBe(true);
    expect(isRootOpen(clock + 10 * 365 * 24 * 60 * 60_000, st)).toBe(true);
    expect(st.getItem(ROOT_STORAGE_KEY)).toBe(
      JSON.stringify({ expiresAt: ROOT_PERMANENT_EXPIRES_AT, mode: "permanent" })
    );
  });

  it("选永久时落盘的内容里也搜不到密码", () => {
    const st = memStorage();
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, st, "forever");
    expect(st.dump()).not.toContain("kangkang");
    expect(st.dump()).not.toContain(ROOT_DEFAULT_PASSWORD);
  });

  it("永久开着也能被「关闭管理员权限」立刻关掉", () => {
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, null, "forever");
    expect(isRootOpen(clock, null)).toBe(true);
    closeRoot();
    expect(isRootOpen(clock, null)).toBe(false);
    expect(isRootPermanent(clock, null)).toBe(false);
  });

  it("密码不对时选什么时长都开不了", () => {
    const st = memStorage();
    const r = submitRootPassword("kangkang1", clock, st, "forever");
    expect(r.ok).toBe(false);
    expect(isRootOpen(clock, st)).toBe(false);
  });

  it("不认识的时长 key 退回默认 1 小时,不抛异常", () => {
    const st = memStorage();
    expect(() => submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, st, "永远")).not.toThrow();
    expect(rootRemainMs(clock, st)).toBe(ROOT_TTL_MS);
  });

  it("弹窗清单里有四个时长选项,默认选中 1 小时,最后一项是永久", () => {
    const spec = rootDialogSpec("要直达关卡", clock, memStorage());
    expect(spec.durations.map((d) => d.key)).toEqual(["30m", "1h", "4h", "forever"]);
    expect(spec.durations.find((d) => d.selected)?.key).toBe("1h");
    expect(spec.durations[spec.durations.length - 1].label).toBe("永久");
    expect(spec.durationLabel).toBe("开多久");
  });

  it("时长选项文案里不写 root,也不写高权限", () => {
    const spec = rootDialogSpec("要直达关卡", clock, memStorage());
    const text = spec.durations.map((d) => d.label).join("|");
    expect(text.toLowerCase()).not.toContain("root");
    expect(text).not.toContain("高权限");
  });
});

describe("rootGate 防暴力锁定", () => {
  it("连错 3 次锁 120 秒", () => {
    const st = memStorage();
    submitRootPassword("a", clock, st);
    submitRootPassword("b", clock, st);
    const third = submitRootPassword("c", clock, st);
    expect(third.locked).toBe(true);
    expect(third.lockRemainMs).toBe(ROOT_LOCK_MS);
    expect(rootLockRemainMs(clock)).toBe(120000);
  });

  it("锁定期间输入框与「打开」都禁用,并显示倒计时", () => {
    const st = memStorage();
    submitRootPassword("a", clock, st);
    submitRootPassword("b", clock, st);
    submitRootPassword("c", clock, st);
    clock += 30_000;
    const spec = rootDialogSpec("要直达关卡", clock, st);
    expect(spec.inputDisabled).toBe(true);
    expect(spec.tip).toContain("90 秒");
  });

  it("锁定期间连正确密码也不放行", () => {
    const st = memStorage();
    submitRootPassword("a", clock, st);
    submitRootPassword("b", clock, st);
    submitRootPassword("c", clock, st);
    const r = submitRootPassword(ROOT_DEFAULT_PASSWORD, clock + 1000, st);
    expect(r.ok).toBe(false);
    expect(r.locked).toBe(true);
    expect(isRootOpen(clock + 1000, st)).toBe(false);
  });

  it("120 秒一过就能再试,而且错误计数是清零的", () => {
    const st = memStorage();
    submitRootPassword("a", clock, st);
    submitRootPassword("b", clock, st);
    submitRootPassword("c", clock, st);
    clock += ROOT_LOCK_MS + 1;
    expect(rootLockRemainMs(clock)).toBe(0);
    expect(rootDialogSpec("要直达关卡", clock, st).inputDisabled).toBe(false);
    const again = submitRootPassword("d", clock, st);
    expect(again.locked).toBe(false);
    expect(again.tip).toContain("还可以再试 2 次");
  });

  it("中途输对一次会把错误计数清干净", () => {
    const st = memStorage();
    submitRootPassword("a", clock, st);
    submitRootPassword("b", clock, st);
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, st);
    const wrong = submitRootPassword("c", clock, st);
    expect(wrong.locked).toBe(false);
    expect(wrong.tip).toContain("还可以再试 2 次");
  });

  it("倒计时文案不足一秒也报 1 秒,不会报 0", () => {
    expect(rootLockText(120000)).toContain("120 秒");
    expect(rootLockText(1)).toContain("1 秒");
    expect(rootLockText(0)).toContain("1 秒");
  });
});

describe("rootGate 关闭与过期", () => {
  it("手动关闭立刻失效", () => {
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, null);
    expect(isRootOpen(clock, null)).toBe(true);
    closeRoot();
    expect(isRootOpen(clock, null)).toBe(false);
  });

  it("一小时后自动关闭,存档记录也被清掉", () => {
    const st = memStorage();
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, st);
    clock += ROOT_TTL_MS;
    expect(isRootOpen(clock, st)).toBe(false);
    expect(st.getItem(ROOT_STORAGE_KEY)).toBeNull();
  });

  it("59 分钟时还开着,61 分钟时已经关了", () => {
    const st = memStorage();
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, st);
    expect(isRootOpen(clock + 59 * 60_000, st)).toBe(true);
    expect(isRootOpen(clock + 61 * 60_000, st)).toBe(false);
  });

  it("状态文案:关着时一句话,开着时报剩余分钟", () => {
    expect(rootStatusText(clock)).toBe("管理员权限已关闭");
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, null);
    clock += 17 * 60_000;
    expect(rootStatusText(clock)).toBe("管理员权限已开,还剩 43 分钟");
  });

  it("状态文案:永久开着时说「永久开启」,不再报还剩几分钟", () => {
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, null, "forever");
    clock += 300 * 24 * 60 * 60_000;
    const text = rootStatusText(clock);
    expect(text).toBe("管理员权限已永久开启");
    expect(text).not.toContain("还剩");
    expect(text).not.toContain("分钟");
  });

  it("状态文案里不写 root,也不写高权限", () => {
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, null);
    const text = rootStatusText(clock);
    expect(text.toLowerCase()).not.toContain("root");
    expect(text).not.toContain("高权限");
  });

  it("resetRootGate 会把会话和锁定一起清掉", () => {
    submitRootPassword("a", clock, null);
    submitRootPassword("b", clock, null);
    submitRootPassword("c", clock, null);
    expect(rootLockRemainMs(clock)).toBeGreaterThan(0);
    resetRootGate();
    expect(rootLockRemainMs(clock)).toBe(0);
    expect(isRootOpen(clock, null)).toBe(false);
  });
});

describe("rootGate 与契约的接线", () => {
  it("模块加载时就把实现注册进契约", () => {
    expect(typeof getRoot12Extras().requestRootOpen).toBe("function");
    expect(typeof getRoot12Extras().closeRoot).toBe("function");
  });

  it("注册被清掉后再引 rootGate 也不会重复副作用", () => {
    resetRoot12Extras();
    expect(getRoot12Extras()).toEqual({});
  });

  it("没有浏览器环境时 requestRootOpen 不抛异常,按当前状态直接回答", async () => {
    resetRootGate();
    await expect(requestRootOpen("要直达关卡")).resolves.toBe(false);
    submitRootPassword(ROOT_DEFAULT_PASSWORD, clock, null);
    await expect(requestRootOpen("要直达关卡")).resolves.toBe(true);
  });

  it("换回真时钟后状态判断仍旧正常", () => {
    useRealRootClock();
    resetRootGate();
    expect(rootStatusText()).toBe("管理员权限已关闭");
    setRootClock(() => clock);
  });
});
