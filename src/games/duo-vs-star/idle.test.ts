/**
 * 朵朵大战星星 ·「玩家一个键都不按」常驻用例。
 *
 * 第 3 轮测试员报的阻断 B3:全 188 关里 72 关玩家零输入也赢,其中 63 关是
 * 对手自己掉下台。按场地拆开看高度集中在星光升降台(19/19)与夜空跳台(16/19),
 * 而滑滑冰湖 0/19 —— 不是 AI 档位的问题,是这两张台子的可站范围跟小电脑的
 * 走位逻辑对不上。
 *
 * 这里守四件事:
 * 1. 小电脑不会一开局就自己掉下去(第 1 / 134 / 157 关开局 3 秒内零出场);
 * 2. 摆烂过关的关数守在明显低于修复前的水位(72 → 个位数);
 * 3. 无论如何,玩家零输入拿不到三星 —— 星星要玩家自己撞出去才算数;
 * 4. 时间到判胜负比的是「上场机会还剩几成」,不是「还剩几条」——
 *    战役关给玩家 3 条命、对手 1 条,照条数比的话摆烂也稳赢。
 */
import { describe, expect, it } from "vitest";
import {
  createMatch,
  runMatch,
  safeZone,
  standSpan,
  stepMatch,
  timeoutWinner,
  type MatchState,
} from "./battle";
import { levelAt, rateLevel } from "./levels";
import { stageById } from "./stages";

/** 照 index.ts playLevel 原样搭一局:同一套 seed、档位、打法、力气、命数 */
function idleMatch(level0: number): MatchState {
  const lv = levelAt(level0);
  const slots: unknown[] = [{ charId: "duoduo", team: 0, control: "p1", stocks: lv.playerStocks }];
  for (const ally of lv.allies) {
    slots.push({
      charId: ally.charId,
      team: 0,
      control: "ai",
      aiTier: ally.tier,
      stocks: ally.stocks ?? lv.playerStocks,
    });
  }
  lv.foes.forEach((foe, fi) => {
    slots.push({
      charId: foe.charId,
      team: lv.allies.length > 0 ? 1 : 1 + fi,
      control: "ai",
      aiTier: foe.tier,
      aiStyle: foe.style,
      powerBonus: foe.powerBonus,
      stocks: foe.stocks,
    });
  });
  return createMatch({
    stageId: lv.stageId,
    slots,
    stocks: lv.playerStocks,
    timeLimit: lv.timeLimit,
    itemEvery: lv.itemEvery,
    itemPool: lv.itemPool,
    seed: (level0 + 1) * 7919,
  } as never);
}

describe("duo-vs-star · 摆烂扫描(B3 回归)", () => {
  it("跳台图上「站得住的范围」认的是所有台子,不是最大那一块", () => {
    // 星光升降台 / 夜空跳台的主平台只有两百来像素,出生点却在两侧台子上。
    // 只看主平台的话,小电脑一出生就以为自己掉出场了。
    for (const id of ["star-lift", "night-hops"]) {
      const stage = stageById(id);
      const zone = safeZone(stage);
      const span = standSpan(stage);
      expect(span.min, `${id} 的可站范围应该比主平台宽`).toBeLessThan(zone.min);
      expect(span.max).toBeGreaterThan(zone.max);
      for (const spawn of stage.spawns) {
        expect(spawn.x, `${id} 的出生点 ${spawn.x} 该落在可站范围里`).toBeGreaterThan(span.min);
        expect(spawn.x).toBeLessThan(span.max);
      }
    }
  });

  it("开局 3 秒内对手不会自己掉下台(第 1 / 134 / 157 关)", () => {
    // 修复前:第 157 关开局 1.4 秒对手就自己掉下去,玩家还没看清画面就三星过关
    for (const level of [1, 134, 157]) {
      const m = idleMatch(level - 1);
      for (let f = 0; f < 3 * 60 && !m.over; f++) {
        stepMatch(m, 1 / 60, {});
        const ko = m.events.find((e) => e.kind === "ko");
        expect(ko, `第 ${level} 关开局 ${(f / 60).toFixed(1)} 秒就有人出场了`).toBeUndefined();
      }
    }
  });

  it("点名的第 1 / 134 / 157 关:摆烂都不再白拿三星", () => {
    for (const level of [1, 134, 157]) {
      const lv = levelAt(level - 1);
      const m = runMatch(idleMatch(level - 1), (lv.timeLimit > 0 ? lv.timeLimit : 150) + 5);
      const me = m.actors[0];
      expect(me.hits, `第 ${level} 关:玩家没按键却打中了人`).toBe(0);
      if (m.winnerTeam === 0) {
        expect(rateLevel(me.outs, me.hits), `第 ${level} 关摆烂还是三星`).toBeLessThan(3);
      }
    }
  }, 30000);

  it("全 188 关摆烂:玩家一颗三星都拿不到", () => {
    const threeStar: number[] = [];
    const autoWin: number[] = [];
    for (let i = 0; i < 188; i++) {
      const lv = levelAt(i);
      const m = runMatch(idleMatch(i), (lv.timeLimit > 0 ? lv.timeLimit : 150) + 5);
      if (m.winnerTeam !== 0) continue;
      autoWin.push(i + 1);
      const me = m.actors[0];
      expect(me.hits, `第 ${i + 1} 关:玩家没按键却打中了人`).toBe(0);
      if (rateLevel(me.outs, me.hits) === 3) threeStar.push(i + 1);
    }
    expect(threeStar, `摆烂还能拿三星的:${threeStar.join("、")}`).toEqual([]);
    // 修复前是 72 关(其中 63 关靠对手自己掉下台)。现在剩下的都是「场上不止一个对手、
    // 它们自己打成一团」的混战关,玩家躺着捡漏也只有一星。守一条明显更低的水位线,
    // 免得日后哪次改动又把小电脑改成会自杀的。
    expect(autoWin.length, `摆烂过关 ${autoWin.length} 关:${autoWin.join("、")}`).toBeLessThanOrEqual(10);
  }, 60000);

  it("时间到比的是「剩几成上场机会」,不是「剩几条」", () => {
    // 战役关给玩家 3 条命、对手只给 1 条。照条数比,玩家一个键不按也是 3:1 稳赢。
    const m = idleMatch(0);
    const me = m.actors[0];
    const foe = m.actors[1];
    me.stocks -= 1;
    me.outs += 1;
    expect(timeoutWinner(m), "掉了一条命的玩家不该赢过一条没掉的对手").toBe(foe.team);
  });
});
