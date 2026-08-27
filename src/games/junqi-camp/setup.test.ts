// 军旗对决 · 布阵单测：三条硬规矩一条都不能松，随机布阵怎么摇都得合法。
import { describe, expect, it } from "vitest";
import { BACK_TWO_ROWS, FRONT_ROW, HQ, idx, inCamp, rowOf } from "./board";
import {
  CAMP_START_EMPTY,
  emptyKinds,
  kindsOf,
  newGame,
  placeableCount,
  randomSetup,
  validateSetup,
  type SetupSkill,
} from "./setup";
import { ARMY, ARMY_SIZE, KINDS, type Kind } from "./rules";

function legalDuo(): (Kind | null)[] {
  return randomSetup("duo", 20260826, 1);
}

describe("军旗对决 · 布局合法性", () => {
  it("随机布阵摇一百次都合法", () => {
    for (let i = 0; i < 100; i++) {
      const skill = (i % 3) as SetupSkill;
      const side = i % 2 === 0 ? "duo" : "star";
      const cells = randomSetup(side, 1000 + i * 7, skill);
      const check = validateSetup({ side, cells });
      expect(check.errors.join("；"), `第 ${i} 次布阵`).toBe("");
      expect(check.ok).toBe(true);
    }
  });

  it("25 枚棋子正好摆满非行营格，行营开局是空的", () => {
    expect(CAMP_START_EMPTY).toBe(true);
    expect(placeableCount("duo")).toBe(25);
    const cells = legalDuo();
    expect(cells.filter(Boolean)).toHaveLength(ARMY_SIZE);
    for (let p = 0; p < cells.length; p++) {
      if (inCamp(p)) expect(cells[p]).toBeNull();
    }
  });

  it("每种棋子的枚数都对得上", () => {
    const cells = legalDuo();
    for (const k of KINDS) {
      expect(cells.filter((x) => x === k), k).toHaveLength(ARMY[k]);
    }
  });

  it("军旗不在大本营就不合法", () => {
    const cells = legalDuo();
    const flag = cells.indexOf("junqi");
    const spare = cells.findIndex((k, p) => k === "lianzhang" && !HQ.duo.includes(p));
    cells[flag] = cells[spare];
    cells[spare] = "junqi";
    const check = validateSetup({ side: "duo", cells });
    expect(check.ok).toBe(false);
    expect(check.errors.join("")).toContain("军旗必须坐在大本营");
  });

  it("地雷摆到最后两行以外就不合法", () => {
    const cells = legalDuo();
    const mine = cells.indexOf("dilei");
    const front = cells.findIndex((k, p) => k !== null && rowOf(p) === FRONT_ROW.duo);
    cells[mine] = cells[front];
    cells[front] = "dilei";
    const check = validateSetup({ side: "duo", cells });
    expect(check.ok).toBe(false);
    expect(check.errors.join("")).toContain("地雷只能摆在自己最后两行");
  });

  it("炸弹摆在第一行就不合法", () => {
    const cells = legalDuo();
    const bomb = cells.indexOf("zhadan");
    const front = cells.findIndex((k, p) => k !== null && rowOf(p) === FRONT_ROW.duo);
    cells[bomb] = cells[front];
    cells[front] = "zhadan";
    const check = validateSetup({ side: "duo", cells });
    expect(check.ok).toBe(false);
    expect(check.errors.join("")).toContain("炸弹不能摆在第一行");
  });

  it("行营里塞了子也不合法", () => {
    const cells = legalDuo();
    const some = cells.findIndex((k, p) => k === "lianzhang" && !inCamp(p));
    cells[some] = null;
    cells[idx(9, 1)] = "lianzhang";
    const check = validateSetup({ side: "duo", cells });
    expect(check.ok).toBe(false);
    expect(check.errors.join("")).toContain("行营里开局不能放子");
  });

  it("少一枚子、摆到对面半边都会被拦下", () => {
    const short = emptyKinds();
    expect(validateSetup({ side: "duo", cells: short }).ok).toBe(false);
    const cells = legalDuo();
    const some = cells.findIndex((k) => k === "paizhang");
    cells[some] = null;
    cells[idx(1, 2)] = "paizhang";
    const check = validateSetup({ side: "duo", cells });
    expect(check.ok).toBe(false);
    expect(check.errors.join("")).toContain("只能在自己这半边摆子");
  });

  it("讲究的布阵会在军旗前面压一枚地雷", () => {
    const cells = randomSetup("star", 4242, 2);
    const flag = cells.indexOf("junqi");
    const guard = idx(1, flag % 5);
    expect(cells[guard]).toBe("dilei");
    expect(BACK_TWO_ROWS.star).toContain(rowOf(guard));
  });

  it("开一盘新棋，两边各 25 枚、朵朵先走、两份布阵都合法", () => {
    const s = newGame(9527);
    expect(s.turn).toBe("duo");
    expect(s.cells.filter((c) => c?.side === "duo")).toHaveLength(25);
    expect(s.cells.filter((c) => c?.side === "star")).toHaveLength(25);
    expect(validateSetup({ side: "duo", cells: kindsOf(s.cells, "duo") }).ok).toBe(true);
    expect(validateSetup({ side: "star", cells: kindsOf(s.cells, "star") }).ok).toBe(true);
    const ids = s.cells.filter(Boolean).map((c) => c!.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
