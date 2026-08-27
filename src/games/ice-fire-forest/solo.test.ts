/**
 * 冰冰火火森林 · 单人模式的用例。
 *
 * 这一组守的是本款 1.2 最要紧的一条:**家里只有一个孩子也玩得下去**。
 * 关键是「换人 + 另一位留在原地」,而不是塞一个会自己乱走的 AI 队友。
 */
import { describe, expect, it } from "vitest";
import {
  SWITCH_CODE,
  TOUCH_HIT_PX,
  initialSolo,
  isControlled,
  isStandingBy,
  isSwitchCode,
  padLabel,
  routeHero,
  soloAnnounce,
  switchButtonAria,
  switchButtonLabel,
  switchHero,
  toggleSolo,
} from "./solo";
import { KEY_MAP, type Hero } from "./logic";

describe("单人模式 · 开关", () => {
  it("默认是双人,两套键位各管各的", () => {
    const s = initialSolo();
    expect(s.solo).toBe(false);
    expect(routeHero(s, "ice")).toBe("ice");
    expect(routeHero(s, "fire")).toBe("fire");
  });

  it("来回切两次回到原样", () => {
    const s = initialSolo();
    expect(toggleSolo(toggleSolo(s))).toEqual(s);
  });

  it("切成单人之后,两套键位都开当前这一位 —— 不用记该按哪一套", () => {
    const s = toggleSolo(initialSolo());
    expect(s.solo).toBe(true);
    for (const bind of Object.values(KEY_MAP)) {
      expect(routeHero(s, bind.hero)).toBe(s.active);
    }
  });

  it("双人模式下按换人键不生效 —— 那时候两个人都归玩家管", () => {
    const s = initialSolo();
    expect(switchHero(s)).toEqual(s);
  });
});

describe("单人模式 · 换人", () => {
  it("Tab 换人,凛凛与焰焰来回倒", () => {
    expect(isSwitchCode(SWITCH_CODE)).toBe(true);
    expect(isSwitchCode("KeyW")).toBe(false);
    let s = toggleSolo(initialSolo());
    expect(s.active).toBe("ice");
    s = switchHero(s);
    expect(s.active).toBe("fire");
    s = switchHero(s);
    expect(s.active).toBe("ice");
  });

  it("换人不会顺手把单人模式关掉", () => {
    let s = toggleSolo(initialSolo());
    for (let i = 0; i < 5; i++) s = switchHero(s);
    expect(s.solo).toBe(true);
  });

  it("换完人,方向键立刻指向新的这一位", () => {
    const before = toggleSolo(initialSolo());
    const after = switchHero(before);
    expect(routeHero(before, "fire")).toBe("ice");
    expect(routeHero(after, "ice")).toBe("fire");
  });

  it("换人是纯函数,原来那份状态一个字段都没被改", () => {
    const s = toggleSolo(initialSolo());
    const snapshot = { ...s };
    switchHero(s);
    toggleSolo(s);
    expect(s).toEqual(snapshot);
  });
});

describe("单人模式 · 另一位留在原地", () => {
  it("同一时刻只有一位归玩家管,另一位在待命", () => {
    let s = toggleSolo(initialSolo());
    for (let i = 0; i < 4; i++) {
      const controlled = (["ice", "fire"] as Hero[]).filter((h) => isControlled(s, h));
      const standby = (["ice", "fire"] as Hero[]).filter((h) => isStandingBy(s, h));
      expect(controlled).toEqual([s.active]);
      expect(standby.length).toBe(1);
      expect(standby[0]).not.toBe(s.active);
      s = switchHero(s);
    }
  });

  it("双人模式下两个人都归玩家管,谁都不待命", () => {
    const s = initialSolo();
    for (const hero of ["ice", "fire"] as Hero[]) {
      expect(isControlled(s, hero)).toBe(true);
      expect(isStandingBy(s, hero)).toBe(false);
    }
  });

  it("待命的那一位在虚拟键盘上标出来,孩子一眼看得见谁在等", () => {
    const s = toggleSolo(initialSolo());
    expect(padLabel(s, "ice")).toBe("凛凛");
    expect(padLabel(s, "fire")).toContain("待命");
    expect(padLabel(initialSolo(), "fire")).toBe("焰焰");
  });
});

describe("单人模式 · 按钮与读屏", () => {
  it("触屏热区不小于 44 像素", () => {
    expect(TOUCH_HIT_PX).toBeGreaterThanOrEqual(44);
  });

  it("按钮上的字随状态变,而且一直说得清下一步会发生什么", () => {
    const off = initialSolo();
    const on = toggleSolo(off);
    expect(switchButtonLabel(off)).toContain("一个人玩");
    expect(switchButtonLabel(on)).toContain("换焰焰");
    expect(switchButtonLabel(switchHero(on))).toContain("换凛凛");
  });

  it("读屏说明里点明了「另一位在原地待命」", () => {
    const on = toggleSolo(initialSolo());
    expect(switchButtonAria(on)).toContain("原地待命");
    expect(switchButtonAria(switchHero(on))).toContain("原地待命");
    expect(switchButtonAria(initialSolo())).toContain("Tab");
  });

  it("播报的那句话既说清了控制谁,也没有一个吓人的字", () => {
    for (const s of [initialSolo(), toggleSolo(initialSolo()), switchHero(toggleSolo(initialSolo()))]) {
      const line = soloAnnounce(s);
      expect(line.length).toBeGreaterThan(8);
      for (const bad of ["死", "血", "输", "笨"]) expect(line.includes(bad)).toBe(false);
    }
    expect(soloAnnounce(toggleSolo(initialSolo()))).toContain("在原地等你");
  });
});
