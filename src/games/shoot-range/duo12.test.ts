/**
 * 1.2 双人同屏的单测(规格第四节第四行)。
 * 两套准星两种颜色、分数互不串、触屏按左右半屏分人、比一比与一起打各有各的判定。
 */
import { describe, expect, it } from "vitest";
import {
  ARENA_SECONDS,
  COOP_SECONDS,
  DUO_INK,
  DUO_NAME,
  arenaResult,
  assignSide,
  coopGoal,
  coopResult,
  makeDuoSide,
  scoreColumn,
  type DuoSide,
} from "./duo12";

const side = (index: 0 | 1, over: Partial<DuoSide> = {}): DuoSide => ({ ...makeDuoSide(index), ...over });

describe("shoot-range 1.2 双人同屏 · 两套准星", () => {
  it("鸭梨和康康各一个名字、一种颜色,颜色不一样才分得清谁是谁", () => {
    expect(DUO_NAME[0]).toBe("鸭梨");
    expect(DUO_NAME[1]).toBe("康康");
    expect(DUO_INK[0]).not.toBe(DUO_INK[1]);
    for (const ink of DUO_INK) expect(ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(makeDuoSide(0).name).toBe("鸭梨");
    expect(makeDuoSide(1).score).toBe(0);
  });

  it("触屏按落点分人:左半边归鸭梨、右半边归康康;单人时都归自己", () => {
    expect(assignSide(10, 360, 2)).toBe(0);
    expect(assignSide(179, 360, 2)).toBe(0);
    expect(assignSide(181, 360, 2)).toBe(1);
    expect(assignSide(350, 360, 2)).toBe(1);
    // 单人局怎么点都是 0 号,免得点右半边就没反应
    expect(assignSide(350, 360, 1)).toBe(0);
    expect(assignSide(10, 0, 2)).toBe(0);
  });

  it("分数列各报各的,一个人的成绩不会串到另一个人头上", () => {
    const a = side(0, { score: 120, hits: 8, shots: 10 });
    const b = side(1, { score: 40, hits: 3, shots: 12 });
    const lineA = scoreColumn(a);
    const lineB = scoreColumn(b);
    expect(lineA).toContain("鸭梨");
    expect(lineA).toContain("120");
    expect(lineA).toContain("80%");
    expect(lineB).toContain("康康");
    expect(lineB).toContain("40");
    expect(lineB).not.toContain("120");
    expect(lineA).not.toContain("康康");
  });
});

describe("shoot-range 1.2 双人同屏 · 比一比", () => {
  it("同屏抢靶先比分数,分数一样才比命中率,再一样是平手", () => {
    expect(ARENA_SECONDS).toBe(60);
    const rich = side(0, { score: 200, hits: 10, shots: 20 });
    const poor = side(1, { score: 100, hits: 10, shots: 10 });
    expect(arenaResult(rich, poor).winner).toBe(0);
    expect(arenaResult(poor, rich).winner).toBe(1);
    // 分数打平:命中率高的那个赢
    const tidy = side(0, { score: 150, hits: 9, shots: 10 });
    const messy = side(1, { score: 150, hits: 9, shots: 18 });
    const res = arenaResult(tidy, messy);
    expect(res.winner).toBe(0);
    expect(res.line).toContain("鸭梨");
    // 分数命中率全一样才是平手
    const even = arenaResult(side(0, { score: 90, hits: 6, shots: 10 }), side(1, { score: 90, hits: 6, shots: 10 }));
    expect(even.winner).toBe(-1);
    expect(even.line).toContain("平手");
  });

  it("分数打平时,碰过不许打的靶那边吃亏", () => {
    const clean = side(0, { score: 120, hits: 8, shots: 10 });
    const sloppy = side(1, { score: 120, hits: 8, shots: 10, flowerHits: 2 });
    expect(arenaResult(clean, sloppy).winner).toBe(0);
    expect(arenaResult(sloppy, clean).winner).toBe(1);
  });

  it("结算话里两个人的分都报出来,而且不说谁「输了」", () => {
    const line = arenaResult(side(0, { score: 210, hits: 12, shots: 14 }), side(1, { score: 180, hits: 10, shots: 14 })).line;
    expect(line).toContain("210");
    expect(line).toContain("180");
    for (const bad of ["输", "笨", "差劲"]) expect(line).not.toContain(bad);
  });
});

describe("shoot-range 1.2 双人同屏 · 一起打", () => {
  it("目标分一档一档往上走,合起来够到就双赢", () => {
    expect(COOP_SECONDS).toBe(75);
    expect(coopGoal(1)).toBe(300);
    expect(coopGoal(2)).toBeGreaterThan(coopGoal(1));
    expect(coopGoal(0)).toBe(coopGoal(1));
    const win = coopResult(side(0, { score: 180, hits: 12, shots: 15 }), side(1, { score: 140, hits: 10, shots: 15 }), 1);
    expect(win.win).toBe(true);
    expect(win.total).toBe(320);
    expect(win.line).toContain("达成");
  });

  it("没够到目标只说还差多少,一个人也不点名批评", () => {
    const miss = coopResult(side(0, { score: 100, hits: 8, shots: 15 }), side(1, { score: 60, hits: 5, shots: 15 }), 1);
    expect(miss.win).toBe(false);
    expect(miss.total).toBe(160);
    expect(miss.line).toContain("140");
    for (const bad of ["输", "笨", "怪"]) expect(miss.line).not.toContain(bad);
  });
});
