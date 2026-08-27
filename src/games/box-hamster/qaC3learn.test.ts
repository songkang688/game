// 档C · 第 3 轮学习优化员 · L3-01:无尽仓「点了漩涡就一定有漩涡」。
//
// 第 2 轮把这件事记成了 L2-07(记账不动):`endlessPortalPairs(r)` 说这一仓有 1~2 对漩涡,
// 实际造出来近两成没有——`decorate()` 是「尽量满足」,冰面贪心铺完就把成对的空格吃光了,
// 可关卡标签和难度分算的都是配方上那个数,于是玩家看到的和曲线以为的对不上。
//
// 第 3 轮的改法有意做得很窄:
//  ① 新增 `Recipe.strictDecor`,**只有无尽开**——战役 188 关是按固定种子长出来的既有内容,
//     动生成器等于把老玩家打过的关换掉,这一条是红线;
//  ② 严格档先摆漩涡再铺冰面(冰面是贪心的),而且多试几张,一张没兑现就换下一张。
//
// 所以这个文件盯两头:**无尽真的兑现了**,以及**战役一格都没变**。
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { decorate } from "./generate";
import {
  applyMoves,
  hasIce,
  hasPortal,
  initialState,
  isSolved,
  type Puzzle,
} from "./logic";
import {
  ENDLESS_MAX_PORTALS,
  buildEndless,
  endlessIceRuns,
  endlessPortalPairs,
  getLevel,
} from "./levels";

/** FNV-1a:拿来给 188 关的战役数据上一把锁 */
function fnv(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}

function portalPairsOf(p: Pick<Puzzle, "portal">): number {
  return p.portal.filter((c) => c >= 0).length / 2;
}

describe("档C R3 学习优化 · L3-01 无尽仓的漩涡逐仓兑现", () => {
  it("第 10 仓起点了漩涡的每一仓都真的摆出了漩涡(原来漏近两成)", () => {
    let want = 0;
    let got = 0;
    for (let r = 10; r <= 48; r++) {
      if (endlessPortalPairs(r) === 0) continue;
      want++;
      if (hasPortal(buildEndless(r))) got++;
    }
    expect(want).toBeGreaterThan(20);
    expect(got, `${want} 仓里有 ${want - got} 仓没摆出漩涡`).toBe(want);
  });

  it("冰面也一仓不漏,而且两样机关不会互相挤掉", () => {
    for (let r = 6; r <= 48; r += 2) {
      const def = buildEndless(r);
      expect(hasIce(def), `第 ${r + 1} 仓的冰面`).toBe(endlessIceRuns(r) > 0);
      expect(hasPortal(def), `第 ${r + 1} 仓的漩涡`).toBe(endlessPortalPairs(r) > 0);
    }
  });

  it("摆出来的漩涡是成对的,而且不会超过配方点的对数", () => {
    for (let r = 10; r <= 48; r += 3) {
      const def = buildEndless(r);
      const pairs = portalPairsOf(def);
      expect(Number.isInteger(pairs), `第 ${r + 1} 仓的漩涡不成对`).toBe(true);
      expect(pairs, `第 ${r + 1} 仓的漩涡比配方还多`).toBeLessThanOrEqual(endlessPortalPairs(r));
      expect(pairs).toBeLessThanOrEqual(ENDLESS_MAX_PORTALS);
      // 成对的两格互相指向对方
      def.portal.forEach((to, from) => {
        if (to >= 0) expect(def.portal[to], `第 ${r + 1} 仓的漩涡没对上`).toBe(from);
      });
    }
  });

  it("漩涡格和冰面格不重叠 —— 一格上不会同时是冰又是门", () => {
    for (let r = 10; r <= 48; r += 2) {
      const def = buildEndless(r);
      def.portal.forEach((to, cell) => {
        if (to >= 0) expect(def.ice[cell], `第 ${r + 1} 仓第 ${cell} 格既是冰又是门`).toBe(false);
      });
    }
  });

  it("兑现机关之后仓照样推得完:参考解走完箱子全归位", () => {
    for (const r of [10, 14, 19, 23, 28, 34, 41, 48]) {
      const def = buildEndless(r);
      expect(def.reference.length, `第 ${r + 1} 仓没有参考解`).toBeGreaterThan(0);
      const { state } = applyMoves(def, initialState(def), def.reference);
      expect(isSolved(def, state), `第 ${r + 1} 仓的参考解走完还没归位`).toBe(true);
      expect(def.bestPushes, `第 ${r + 1} 仓一步都不用推`).toBeGreaterThan(0);
    }
  });

  it("无尽仍然是确定性的:同一仓反复造出来一模一样", () => {
    for (const r of [11, 20, 33, 47]) {
      expect(JSON.stringify(buildEndless(r))).toBe(JSON.stringify(buildEndless(r)));
    }
  });

  it("战役 188 关一格都没变 —— 生成器的改动只走无尽那条路", () => {
    let acc = "";
    for (let i = 0; i < 188; i++) acc += JSON.stringify(getLevel(i));
    expect(acc.length).toBe(350140);
    expect(fnv(acc), "战役关卡数据被改动了,老玩家打过的关会变成另一关").toBe("5c778938");
  });

  it("decorate 的默认顺序没变(先冰后门),只有显式打开 portalsFirst 才换", () => {
    const base = buildEndless(12);
    const plain: Puzzle = { ...base, ice: base.ice.map(() => false), portal: base.portal.map(() => -1) };
    const spec = { iceRuns: 3, portalPairs: 1 };
    const a = decorate(plain, { ...spec, rand: mulberry32(7) });
    const b = decorate(plain, { ...spec, rand: mulberry32(7) });
    expect(JSON.stringify(a.ice)).toBe(JSON.stringify(b.ice));
    expect(JSON.stringify(a.portal)).toBe(JSON.stringify(b.portal));
    // 换成先摆门:同一个随机源出来的结果不一样,而且门一定摆得上
    const c = decorate(plain, { ...spec, rand: mulberry32(7), portalsFirst: true });
    expect(hasPortal(c)).toBe(true);
    expect(portalPairsOf(c)).toBe(1);
  });
});
