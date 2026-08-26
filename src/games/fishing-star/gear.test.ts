/**
 * 钓鱼小达人 · 装备单测。
 *
 * 重点全在「封顶」两个字上:等级怎么越界、存档怎么被改,
 * 加成都必须被夹回上限,`assertGearCaps` 一定报 true。
 * 顺带守住红线:装备只花星星,价目表里不许出现第二种货币。
 */
import { describe, expect, it, vi } from "vitest";
import {
  GEAR,
  GEAR_CAPS,
  GEAR_KEY,
  GEAR_KINDS,
  MAX_GEAR_LEVEL,
  assertGearCaps,
  baseBonus,
  canUpgrade,
  emptyGear,
  fullKitCost,
  gearBonus,
  gearStepName,
  gearSummary,
  nextCost,
  normalizeGear,
  parseGear,
  serializeGear,
  totalSpent,
  upgrade,
  type GearSet,
} from "./gear";
import { GAME_ID, RED_AT, SNAP_AT } from "./logic";

const MAXED: GearSet = { line: MAX_GEAR_LEVEL, bait: MAX_GEAR_LEVEL, float: MAX_GEAR_LEVEL };

describe("装备表", () => {
  it("三件套,每件四级(含出厂那一级),0 级不要星星", () => {
    expect(GEAR_KINDS).toEqual(["line", "bait", "float"]);
    for (const kind of GEAR_KINDS) {
      const spec = GEAR[kind];
      expect(spec.kind).toBe(kind);
      expect(spec.steps.length).toBe(MAX_GEAR_LEVEL + 1);
      expect(spec.steps[0].cost).toBe(0);
      expect(spec.name.length).toBeGreaterThan(0);
      expect(spec.what.length).toBeGreaterThan(8);
      for (const step of spec.steps) expect(step.note.length).toBeGreaterThan(3);
    }
  });

  it("价钱一级比一级贵,而且全套凑得出来", () => {
    for (const kind of GEAR_KINDS) {
      const costs = GEAR[kind].steps.map((s) => s.cost);
      for (let i = 2; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    }
    expect(fullKitCost()).toBe(totalSpent(MAXED));
    expect(fullKitCost()).toBeGreaterThan(0);
    expect(fullKitCost()).toBeLessThanOrEqual(200);
  });

  it("价目表里只有星星,没有第二种货币,也没有内购字眼", () => {
    const words = ["金币", "钻石", "元宝", "充值", "购买", "内购", "人民币", "元"];
    const text = GEAR_KINDS.map((k) => `${GEAR[k].name}${GEAR[k].what}${GEAR[k].steps.map((s) => s.name + s.note).join("")}`).join("");
    for (const w of words) expect(text.includes(w), `装备文案里出现了「${w}」`).toBe(false);
  });

  it("存档 key 挂在本应用前缀下", () => {
    expect(GEAR_KEY.startsWith("yiduo-yixing.")).toBe(true);
    expect(GEAR_KEY).toContain(GAME_ID);
  });
});

describe("装备存档", () => {
  it("坏数据一律当出厂配置", () => {
    for (const raw of [null, undefined, "", "不是 JSON", "[1,2,3]", "5"]) {
      expect(parseGear(raw), String(raw)).toEqual(emptyGear());
    }
  });

  it("越界等级会被夹回 0..3,小数四舍五入", () => {
    expect(normalizeGear({ line: 99, bait: -4, float: 2.4 })).toEqual({ line: 3, bait: 0, float: 2 });
    expect(normalizeGear({ line: Number.NaN, bait: "3", float: null })).toEqual(emptyGear());
    expect(parseGear('{"line":9,"bait":9,"float":9}')).toEqual(MAXED);
  });

  it("序列化往返", () => {
    const g: GearSet = { line: 1, bait: 3, float: 2 };
    expect(parseGear(serializeGear(g))).toEqual(g);
    expect(parseGear(serializeGear({ line: 42, bait: -1, float: 0 }))).toEqual({ line: 3, bait: 0, float: 0 });
  });
});

describe("升级(只花星星)", () => {
  it("星星不够就升不动,升得动才扣星星", () => {
    const g = emptyGear();
    const cost = nextCost(g, "bait") as number;
    expect(cost).toBeGreaterThan(0);
    expect(canUpgrade(g, "bait", cost - 1)).toBe(false);
    expect(upgrade(g, "bait", cost - 1)).toEqual({ gear: g, spent: 0 });
    const done = upgrade(g, "bait", cost);
    expect(done.spent).toBe(cost);
    expect(done.gear.bait).toBe(1);
    expect(done.gear.line).toBe(0);
  });

  it("满级以后没有下一级,也不会再扣星星", () => {
    expect(nextCost(MAXED, "line")).toBeNull();
    expect(canUpgrade(MAXED, "line", 9999)).toBe(false);
    expect(upgrade(MAXED, "line", 9999)).toEqual({ gear: MAXED, spent: 0 });
  });

  it("升级是纯函数,不改传进去的那一套", () => {
    const g = emptyGear();
    upgrade(g, "float", 9999);
    expect(g).toEqual(emptyGear());
  });

  it("一级一级升到满,花掉的星星正好是全套价", () => {
    let gear = emptyGear();
    let spent = 0;
    for (const kind of GEAR_KINDS) {
      for (let i = 0; i < MAX_GEAR_LEVEL; i++) {
        const out = upgrade(gear, kind, 9999);
        gear = out.gear;
        spent += out.spent;
      }
    }
    expect(gear).toEqual(MAXED);
    expect(spent).toBe(fullKitCost());
  });

  it("装备栏的小字把三件当前等级都写出来了", () => {
    const text = gearSummary({ line: 1, bait: 0, float: 3 });
    expect(text).toContain(gearStepName({ line: 1, bait: 0, float: 3 }, "line"));
    expect(text).toContain(GEAR.float.steps[3].name);
    expect(gearSummary(emptyGear()).length).toBeGreaterThan(4);
  });
});

describe("加成封顶", () => {
  it("出厂状态就是没有加成", () => {
    expect(gearBonus(emptyGear())).toEqual(baseBonus());
    expect(gearBonus(emptyGear()).snapAt).toBe(SNAP_AT);
    expect(gearBonus(emptyGear()).warnAt).toBe(RED_AT);
  });

  it("每升一级都更强,但满级正好卡在上限上", () => {
    const levels = [0, 1, 2, 3].map((lv) => gearBonus({ line: lv, bait: lv, float: lv }));
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].snapAt).toBeGreaterThan(levels[i - 1].snapAt);
      expect(levels[i].luck).toBeGreaterThan(levels[i - 1].luck);
      expect(levels[i].warnAt).toBeLessThan(levels[i - 1].warnAt + 1e-9);
      expect(levels[i].reactionMs).toBeGreaterThan(levels[i - 1].reactionMs);
    }
    const top = levels[3];
    expect(top.snapAt).toBeCloseTo(SNAP_AT + GEAR_CAPS.lineSnap, 6);
    expect(top.luck).toBeCloseTo(GEAR_CAPS.baitLuck, 6);
    expect(top.reactionMs).toBe(GEAR_CAPS.floatMs);
    expect(top.warnAt).toBeCloseTo(RED_AT + GEAR_CAPS.lineSnap - GEAR_CAPS.floatWarn, 6);
  });

  it("等级被人改成 999 也越不过上限", () => {
    const crazy = gearBonus({ line: 999, bait: 999, float: 999 } as GearSet);
    expect(crazy).toEqual(gearBonus(MAXED));
    expect(assertGearCaps(crazy)).toBe(true);
  });

  it("assertGearCaps 对所有合法组合都点头", () => {
    for (let line = 0; line <= MAX_GEAR_LEVEL; line++) {
      for (let bait = 0; bait <= MAX_GEAR_LEVEL; bait++) {
        for (let float = 0; float <= MAX_GEAR_LEVEL; float++) {
          expect(assertGearCaps(gearBonus({ line, bait, float })), `${line}/${bait}/${float}`).toBe(true);
        }
      }
    }
  });

  it("真给它一份越界的加成,断言会喊出来但不抛异常", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(assertGearCaps({ snapAt: 2, luck: 0, warnAt: RED_AT, reactionMs: 0 })).toBe(false);
    expect(assertGearCaps({ snapAt: SNAP_AT, luck: 9, warnAt: RED_AT, reactionMs: 0 })).toBe(false);
    expect(assertGearCaps({ snapAt: SNAP_AT, luck: 0, warnAt: 0, reactionMs: 0 })).toBe(false);
    expect(assertGearCaps({ snapAt: SNAP_AT, luck: 0, warnAt: RED_AT, reactionMs: 9999 })).toBe(false);
    expect(assertGearCaps({ snapAt: SNAP_AT, luck: -1, warnAt: RED_AT, reactionMs: -5 })).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("预警永远比红区更早、比舒服区更晚,不会提前到没法玩", () => {
    for (let float = 0; float <= MAX_GEAR_LEVEL; float++) {
      const b = gearBonus({ line: 0, bait: 0, float });
      expect(b.warnAt).toBeLessThanOrEqual(RED_AT);
      expect(b.warnAt).toBeGreaterThan(0.6);
      expect(b.snapAt).toBeGreaterThan(b.warnAt);
    }
  });
});
