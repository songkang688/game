/**
 * 鸭梨大战康康 ·「玩家一个键都不按」常驻用例。
 *
 * 第 3 轮测试员报的阻断 B3:全 188 关里 72 关玩家零输入也赢,其中 63 关是
 * 对手自己掉下台。按场地拆开看高度集中在星光升降台(19/19)与夜空跳台(16/19),
 * 而滑滑冰湖 0/19 —— 不是 AI 档位的问题,是这两张台子的可站范围跟小电脑的
 * 走位逻辑对不上。
 *
 * 第 3 轮收尾还剩 7 关(28 / 104 / 123 / 140 / 144 / 148 / 161),两类病:
 *  · 星光升降台的 1v1(140 / 144 / 148)—— 对手照旧自己掉下台;
 *  · 组队赛(28 / 104 / 123 / 161)—— 队友包场,第 28 关玩家已经被撞出局 3 次,
 *    队伍还是判赢、星星照发、下一关照解锁。
 *
 * 这里守七件事:
 * 1. 小电脑不会一开局就自己掉下去(第 1 / 134 / 157 关开局 3 秒内零出场);
 * 2. **照闯关模式的原样(设了主角)跑,全 188 关零输入一关都过不了**;
 * 3. 无论如何,玩家零输入拿不到三星 —— 星星要玩家自己撞出去才算数;
 * 4. 撇开主角这条规则、只看底层对局,「对手自己送」的水位也要压住:
 *    尤其不许再出现「打到分出胜负、玩家白捡一个 ko 真胜」;
 * 5. 反过来也要守:会打的玩家照样过得去,别为了堵摆烂把关卡堵死;
 * 6. 时间到判胜负比的是「上场机会还剩几成」,不是「还剩几条」——
 *    战役关给玩家 3 条命、对手 1 条,照条数比的话摆烂也稳赢;
 * 7. 主角这条规则只管战役关,双人同乐那种没有主角的局判法一点不变。
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

/**
 * 照 index.ts playLevel 原样搭一局:同一套 seed、档位、打法、力气、命数。
 * `lead` 就是闯关模式那条「0 号槽是主角」的设定;
 * 传 false 可以把它摘掉,用来单看底层对局判成什么样。
 */
function idleMatch(level0: number, withLead = true, seed = (level0 + 1) * 7919): MatchState {
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
    seed,
    ...(withLead ? { lead: 0 } : {}),
  } as never);
}

/** 不限时的关在浏览器里是不会自己结束的,这里给一个跟 QA 驱动一致的上限 */
const NO_LIMIT_CAP = 155;

function idleRun(level0: number, withLead = true): MatchState {
  const lv = levelAt(level0);
  const cap = lv.timeLimit > 0 ? lv.timeLimit + 5 : NO_LIMIT_CAP;
  return runMatch(idleMatch(level0, withLead), cap);
}

/** 第 3 轮收尾时点名的残量关:前四关是这一轮必须堵死的 */
const NAMED = [28, 140, 144, 148, 104, 123, 161];

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

  it("点名的第 1 / 134 / 157 关:摆烂只会判负", () => {
    for (const level of [1, 134, 157]) {
      const m = idleRun(level - 1);
      const me = m.actors[0];
      expect(me.hits, `第 ${level} 关:玩家没按键却打中了人`).toBe(0);
      expect(m.winnerTeam, `第 ${level} 关摆烂居然过关了`).not.toBe(0);
    }
  }, 30000);

  it("第 3 轮点名的残量关(28 / 140 / 144 / 148 / 104 / 123 / 161)摆烂一关都过不了", () => {
    for (const level of NAMED) {
      const m = idleRun(level - 1);
      const me = m.actors[0];
      expect(
        m.winnerTeam,
        `第 ${level} 关摆烂还是过了(${m.endReason} @ ${m.t.toFixed(1)}s,玩家 outs=${me.outs} hits=${me.hits})`
      ).not.toBe(0);
    }
  }, 30000);

  it("全 188 关摆烂:一关都不判过,更别说三星", () => {
    const won: number[] = [];
    const starred: number[] = [];
    for (let i = 0; i < 188; i++) {
      const m = idleRun(i);
      const me = m.actors[0];
      expect(me.hits, `第 ${i + 1} 关:玩家没按键却打中了人`).toBe(0);
      if (m.winnerTeam !== 0) continue;
      won.push(i + 1);
      // 照 index.ts 结算那一行原样算星,别在测试里另写一套评级
      if (rateLevel(me.outs, me.hits) >= 3) starred.push(i + 1);
    }
    expect(won, `摆烂还能过的关:${won.join("、")}`).toEqual([]);
    expect(starred, `摆烂还能拿三星的关:${starred.join("、")}`).toEqual([]);
  }, 90000);

  it("摘掉主角规则只看底层对局:对手不该再自己把胜负送出去", () => {
    // 这一条是给「小电脑会不会自己掉下台」留的体温计。上面那条零输入用例
    // 有主角规则兜底,哪怕小电脑改回会自杀也照样绿,所以底层得单独量一次。
    //
    // 判胜按三种口径分开记,不能混着看:
    //  · 送胜   —— 打到分出胜负,而且队伍 0 一次都没把人撞出去过。玩家零输入,
    //              那就只能是对手自己走下台的,这是 B3 最刺眼的一种,守死;
    //  · 队友胜 —— 组队赛里队友真把对面两位请出场了。底层这么判没错,
    //              是主角规则在上面把它拦下来的;
    //  · 上限胜 —— 不限时的关跑满 155 秒硬判。浏览器里这种局根本不会结算,
    //              是驱动脚本给的人为终点,所以跟真胜分开算。
    const gift: number[] = [];
    const allyWin: number[] = [];
    const capWin: number[] = [];
    let selfFalls = 0;
    for (let i = 0; i < 188; i++) {
      const lv = levelAt(i);
      const m = idleMatch(i, false);
      const cap = lv.timeLimit > 0 ? lv.timeLimit + 5 : NO_LIMIT_CAP;
      for (let f = 0; f < Math.ceil(cap * 60) && !m.over; f++) {
        stepMatch(m, 1 / 60, {});
        // by < 0 = 没人碰他,自己走下去的
        for (const e of m.events) {
          if (e.kind === "ko" && e.by < 0 && m.actors[e.actor].team !== 0) selfFalls++;
        }
      }
      runMatch(m, 0);
      if (m.winnerTeam !== 0) continue;
      const allyKos = m.actors.filter((a) => a.team === 0).reduce((n, a) => n + a.kos, 0);
      if (m.endReason !== "ko") capWin.push(i + 1);
      else if (allyKos > 0) allyWin.push(i + 1);
      else gift.push(i + 1);
    }
    expect(gift, `对手自己送出胜负的关:${gift.join("、")}`).toEqual([]);
    // 队友包场是组队赛的固有形态,只该出现在有队友的关上
    for (const level of allyWin) {
      expect(levelAt(level - 1).allies.length, `第 ${level} 关没有队友,却是队友打赢的?`).toBeGreaterThan(0);
    }
    // 不限时的关跑满上限,对手在两分半里自己掉一次就够翻盘,一时压不到零,
    // 守一条比原来(autoWin <= 10)紧一截的水位线。
    expect(
      capWin.length,
      `跑满 ${NO_LIMIT_CAP} 秒上限才判给玩家的关 ${capWin.length} 个:${capWin.join("、")}`
    ).toBeLessThanOrEqual(4);
    // 全 188 关加起来,对手「自己走下台」的总次数。修前同口径是 28 次。
    expect(selfFalls, `对手自掉 ${selfFalls} 次`).toBeLessThanOrEqual(20);
  }, 90000);

  it("会打的玩家照样过得去:主角规则砍掉的只有「零输入」和「已出局」两种胜", () => {
    // 上面那些用例只证明了「摆烂过不了」。这一条守另一头:别为了堵摆烂
    // 把关卡也一并堵死。0 号槽换成高手档小电脑代打(levels.test.ts 里
    // 「高手档玩家」用的也是这个替身),再认定他确实上过手。
    for (const level of [1, 28, 104]) {
      const lv = levelAt(level - 1);
      let wins = 0;
      const runs = 8;
      for (let i = 0; i < runs; i++) {
        const m = idleMatch(level - 1, true, 1000 + i * 7919);
        m.actors[0].slot.control = "ai";
        m.actors[0].slot.aiTier = "hard";
        m.actors[0].acted = true;
        runMatch(m, lv.timeLimit > 0 ? lv.timeLimit + 5 : NO_LIMIT_CAP);
        if (m.winnerTeam === 0) wins++;
      }
      expect(wins, `第 ${level} 关会打也只赢了 ${wins}/${runs} 局,难度被堵崩了`).toBeGreaterThanOrEqual(6);
    }
  }, 30000);

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
