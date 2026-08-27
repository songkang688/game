/**
 * 1.2 第 12 步 A 档补做的无尽「打靶塔」:生成与计分。
 */
import { describe, expect, it } from "vitest";
import {
  ENDLESS_BIRDS,
  FLOOR_MAX,
  FLOOR_MIN,
  SCORE_BEAN,
  SCORE_BLOCK,
  TOWER_MAX,
  TOWER_MIN,
  endlessBirdKinds,
  endlessLine,
  roundScore,
  towerCount,
  towerFloors,
  towerMaterials,
  towerRound
} from "./endless";
import { GROUND_Y, WORLD_W } from "./physics";

describe("sling-birds 1.2 无尽打靶塔 · 生成", () => {
  it("同一轮生成的塔永远一模一样(确定性)", () => {
    for (const r of [1, 5, 12, 40]) {
      expect(towerRound(r)).toEqual(towerRound(r));
    }
    expect(towerRound(3)).not.toEqual(towerRound(4));
  });

  it("塔越来越高:层数单调不减,并且封顶", () => {
    let last = 0;
    for (let r = 1; r <= 60; r++) {
      const f = towerFloors(r);
      expect(f).toBeGreaterThanOrEqual(last);
      expect(f).toBeGreaterThanOrEqual(FLOOR_MIN);
      expect(f).toBeLessThanOrEqual(FLOOR_MAX);
      last = f;
    }
    expect(towerFloors(1)).toBe(FLOOR_MIN);
    expect(towerFloors(99)).toBe(FLOOR_MAX);
  });

  it("塔越来越多:座数单调不减,2 → 4 座", () => {
    let last = 0;
    for (let r = 1; r <= 40; r++) {
      const n = towerCount(r);
      expect(n).toBeGreaterThanOrEqual(last);
      expect(n).toBeGreaterThanOrEqual(TOWER_MIN);
      expect(n).toBeLessThanOrEqual(TOWER_MAX);
      last = n;
    }
  });

  it("材质越往后越硬:第 1 轮只有木头,后面陆续加冰、石、岩壳", () => {
    expect(towerMaterials(1)).toEqual(["wood"]);
    expect(towerMaterials(2)).toContain("ice");
    expect(towerMaterials(4)).toContain("stone");
    expect(towerMaterials(7)).toContain("shell");
  });

  it("每轮弹数固定,种类按轮次轮换", () => {
    for (let r = 1; r <= 12; r++) {
      expect(towerRound(r).birds.length).toBe(ENDLESS_BIRDS);
    }
    expect(endlessBirdKinds(1)).not.toEqual(endlessBirdKinds(2));
    expect(endlessBirdKinds(1)).toEqual(endlessBirdKinds(6));
  });

  it("塔一定站在地上、不越界,豆子站在塔顶", () => {
    for (let r = 1; r <= 30; r++) {
      const round = towerRound(r);
      expect(round.beans.length).toBe(towerCount(r));
      for (const b of round.blocks) {
        expect(b.x, `r${r}`).toBeGreaterThan(120);
        expect(b.x + b.w, `r${r}`).toBeLessThanOrEqual(WORLD_W);
        expect(b.y, `r${r}`).toBeGreaterThan(0);
        expect(b.y + b.h, `r${r}`).toBeLessThanOrEqual(GROUND_Y);
      }
      for (const bean of round.beans) {
        expect(bean.y, `r${r}`).toBeGreaterThan(0);
        expect(bean.y, `r${r}`).toBeLessThan(GROUND_Y);
      }
    }
  });

  it("章节配色轮换,轮次非法也能兜住", () => {
    expect(towerRound(1).chapter).toBe(0);
    expect(towerRound(10).chapter).toBe(0);
    expect(towerRound(0).round).toBe(1);
    expect(towerRound(-5).round).toBe(1);
  });
});

describe("sling-birds 1.2 无尽打靶塔 · 计分", () => {
  const base = { round: 3, destroyed: 0, popped: 0, birdsLeft: 0, cleared: false };

  it("塔倒得越多分越高", () => {
    expect(roundScore({ ...base, destroyed: 5 })).toBeGreaterThan(roundScore({ ...base, destroyed: 2 }));
    expect(roundScore({ ...base, destroyed: 3 })).toBe(3 * SCORE_BLOCK);
  });

  it("弹走豆子比拆方块更值钱", () => {
    expect(SCORE_BEAN).toBeGreaterThan(SCORE_BLOCK);
    expect(roundScore({ ...base, popped: 1 })).toBe(SCORE_BEAN);
  });

  it("清台有奖励,省下的小鸟也算分", () => {
    const cleared = roundScore({ ...base, destroyed: 4, popped: 2, birdsLeft: 1, cleared: true });
    const failed = roundScore({ ...base, destroyed: 4, popped: 2, birdsLeft: 1, cleared: false });
    expect(cleared).toBeGreaterThan(failed);
  });

  it("越后面的塔清台奖励越高", () => {
    const early = roundScore({ ...base, round: 1, cleared: true });
    const late = roundScore({ ...base, round: 9, cleared: true });
    expect(late).toBeGreaterThan(early);
  });

  it("分数不会因为负数输入变成负的", () => {
    expect(roundScore({ round: 1, destroyed: -5, popped: -2, birdsLeft: -3, cleared: false })).toBe(0);
  });

  it("结算文案只鼓励、不说输,破纪录会特别讲一句", () => {
    const best = endlessLine(6, 320, 320, true);
    const normal = endlessLine(6, 200, 320, false);
    expect(best).toContain("新纪录");
    expect(normal).toContain("再来一次");
    for (const line of [best, normal]) {
      expect(line).not.toContain("输");
      expect(line).not.toContain("失败");
      expect(line).not.toContain("死");
    }
  });
});
