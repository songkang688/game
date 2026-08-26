import { describe, expect, it } from "vitest";
import {
  MODE_KINDS,
  MODE_KIND_LABELS,
  VERSUS_KIND_LABELS,
  assertModeMenu,
  availableModes,
  compatFromMeta,
  describeModes,
  modeButtonLabel,
  pickInitialMode,
  type ModeKind
} from "./playModes";
import type { GameMode } from "./types";

function compat(modes?: readonly GameMode[]) {
  return compatFromMeta({ modes, levels: 188 });
}

describe("从 meta.modes 推导模式口径", () => {
  it("含 campaign 就能闯关", () => {
    const c = compat(["campaign"]);
    expect(c.campaign).toBe(true);
    expect(c.versus).toBe(false);
    expect(c.endless).toBe(false);
  });

  it("只有 versus 时只认对战", () => {
    const c = compat(["versus"]);
    expect(c.versus).toBe(true);
    expect(c.campaign).toBe(false);
    expect(c.versusKinds).toEqual(["ai"]);
  });

  it("只有 endless 时只认无尽", () => {
    const c = compat(["endless"]);
    expect(c.endless).toBe(true);
    expect(c.versus).toBe(false);
  });

  it("含 twoPlayer 但不含 versus 也算能对战(同屏双人)", () => {
    const c = compat(["twoPlayer"]);
    expect(c.versus).toBe(true);
    expect(c.versusKinds).toEqual(["hotseat"]);
  });

  it("含 coop 也算能对战,细分是一起打", () => {
    const c = compat(["coop"]);
    expect(c.versus).toBe(true);
    expect(c.versusKinds).toEqual(["coop"]);
  });

  it("三种对战细分能同时存在,顺序固定", () => {
    const c = compat(["versus", "twoPlayer", "coop"]);
    expect(c.versusKinds).toEqual(["ai", "hotseat", "coop"]);
  });

  it("modes 没填时三者都是 false,并说明升级步要补", () => {
    const c = compat(undefined);
    expect([c.campaign, c.versus, c.endless]).toEqual([false, false, false]);
    expect(c.reason?.campaign).toContain("meta.modes");
  });

  it("modes 是空数组时同样三者都 false", () => {
    const c = compat([]);
    expect(availableModes(c)).toEqual([]);
    expect(c.reason?.endless).toContain("meta.modes");
  });

  it("做得到的模式不会被写进 reason", () => {
    const c = compat(["campaign", "endless"]);
    expect(c.reason?.campaign).toBeUndefined();
    expect(c.reason?.versus).toBeTruthy();
    expect(c.reason?.endless).toBeUndefined();
  });

  it("三大类齐了就没有 reason", () => {
    const c = compat(["campaign", "versus", "endless"]);
    expect(c.reason).toBeUndefined();
  });
});

describe("菜单请求校验", () => {
  it("请求支持的模式返回 true", () => {
    expect(assertModeMenu(compat(["campaign"]), "campaign")).toBe(true);
  });

  it("请求不支持的模式返回 false,不抛异常", () => {
    const c = compat(["campaign"]);
    expect(() => assertModeMenu(c, "endless")).not.toThrow();
    expect(assertModeMenu(c, "endless")).toBe(false);
  });

  it("请求一个根本不存在的模式名也只是 false", () => {
    const c = compat(["campaign"]);
    expect(assertModeMenu(c, "creative" as ModeKind)).toBe(false);
  });
});

describe("开局进哪个模式", () => {
  it("want 合法就听 want 的", () => {
    expect(pickInitialMode(compat(["campaign", "endless"]), "endless")).toBe("endless");
  });

  it("want 不合法时按 闯关 > 对战 > 无尽 取第一个能用的", () => {
    expect(pickInitialMode(compat(["versus", "endless"]), "campaign")).toBe("versus");
    expect(pickInitialMode(compat(["endless"]), "versus")).toBe("endless");
  });

  it("不给 want 时也按同样顺序", () => {
    expect(pickInitialMode(compat(["campaign", "versus", "endless"]))).toBe("campaign");
    expect(pickInitialMode(compat(["versus", "endless"]))).toBe("versus");
  });

  it("一个模式都没有时兜底给闯关,而且不抛", () => {
    expect(() => pickInitialMode(compat([]))).not.toThrow();
    expect(pickInitialMode(compat([]))).toBe("campaign");
  });
});

describe("中文说明与文案", () => {
  it("三大类的顺序与中文名钉死", () => {
    expect(MODE_KINDS).toEqual(["campaign", "versus", "endless"]);
    expect(MODE_KIND_LABELS.campaign).toBe("闯关");
    expect(MODE_KIND_LABELS.versus).toBe("对战");
    expect(MODE_KIND_LABELS.endless).toBe("无尽");
    expect(Object.keys(VERSUS_KIND_LABELS)).toEqual(["ai", "hotseat", "coop"]);
  });

  it("能闯关又能双人时说得清楚", () => {
    const line = describeModes(compat(["campaign", "twoPlayer"]));
    expect(line).toContain("可以闯关");
    expect(line).toContain("两个人");
    expect(line).toContain("没有无尽");
  });

  it("什么模式都没登记时也给一句人话", () => {
    expect(describeModes(compat([]))).toContain("还没登记");
  });

  it("三样齐全时不会画蛇添足地说「没有」", () => {
    const line = describeModes(compat(["campaign", "versus", "endless"]));
    expect(line).not.toContain("没有");
    expect(line).toContain("无尽");
  });

  it("说明文案不低幼、不沾商标", () => {
    const lines = [
      describeModes(compat(["campaign"])),
      describeModes(compat(["versus", "twoPlayer"])),
      describeModes(compat(["endless"])),
      describeModes(compat([]))
    ].join("|");
    expect(lines).not.toMatch(/宝宝|乖乖|小笨蛋/);
    expect(lines).not.toMatch(/Tetris|拳皇|超级玛丽|愤怒的小鸟|吃豆人/i);
  });

  it("模式按钮文案带表情与中文名", () => {
    expect(modeButtonLabel("campaign")).toBe("🚩 闯关");
    expect(modeButtonLabel("versus")).toBe("🤝 对战");
    expect(modeButtonLabel("endless")).toBe("♾️ 无尽");
  });
});
