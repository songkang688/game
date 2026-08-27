/**
 * 王子公主大冒险 ·「玩家一个键都不按」常驻用例。
 *
 * 第 3 轮测试员报的阻断 B2:单人模式(玩家 + AI 搭档)188 关里 110 关玩家
 * 零输入也能过关,其中 94 关三星 —— 第 1 关 13 秒三星,怪和宝石全是搭档清的。
 * 根因是 `checkGoal` 只数「城门口站了几个人」:`goalNeedsAll` 为假的关卡,
 * 托管搭档一个人走到门口就判赢,真人在出生点站着也算过。
 *
 * 这里守四件事:
 * 1. 单人模式下城门只认真人手上那位,搭档先到得等着;
 * 2. 全 188 关单人摆烂一关都过不去;
 * 3. 战果分得清是谁挣的,结算文案不把搭档的功劳安到真人头上;
 * 4. 玩家真动起来照样打得通、拿得到三星 —— 别把关卡改成过不去的。
 *
 * 走的是真实路径:`createWorld(def, 1)` + 「active 那位喂空输入、另一位喂
 * `botInput`」,跟 `index.ts` 里 `frame()` 的喂法一模一样。
 */
import { describe, expect, it } from "vitest";
import type { LevelDef } from "./levels";
import { buildLevel } from "./levels";
import {
  autoPlay,
  botInput,
  createWorld,
  emptyInput,
  starsForRun,
  stepWorld,
  summarize,
  swapActive,
  winMessage,
  type World,
} from "./logic";

const DT = 1 / 60;

function capOf(def: LevelDef): number {
  return Math.ceil(((def.timeLimit > 0 ? def.timeLimit : 200) + 5) / DT);
}

/** 照 index.ts 单人模式原样跑一关:active 那位一个键都不按,另一位由搭档托管 */
function idleSolo(def: LevelDef): World {
  const w = createWorld(def, 1);
  const cap = capOf(def);
  for (let step = 0; step < cap && w.status === "playing"; step++) {
    stepWorld(w, DT, w.heroes.map((_, i) => (i === w.active ? emptyInput() : botInput(w, i, DT))));
  }
  return w;
}

describe("prince-princess · 单人摆烂扫描(B2 回归)", () => {
  it("第 1 关摆烂:搭档跑到城门也不算过关", () => {
    const w = idleSolo(buildLevel(0));
    expect(w.status).not.toBe("won");
    // 不是因为搭档没干活 —— 是因为城门只认真人手上那位
    expect(w.kills + w.gemsTaken).toBeGreaterThan(0);
    expect(w.playerHits).toBe(0);
  });

  it("全 188 关单人摆烂:一关都过不去", () => {
    const won: number[] = [];
    for (let i = 0; i < 188; i++) {
      if (idleSolo(buildLevel(i)).status === "won") won.push(i + 1);
    }
    expect(won, `摆烂过关的:${won.join("、")}`).toEqual([]);
  }, 60000);

  it("两个人玩(两位真人都不动)照旧过不去", () => {
    for (const i of [0, 59, 132, 187]) {
      const def = buildLevel(i);
      const w = createWorld(def, 2);
      for (let step = 0; step < capOf(def) && w.status === "playing"; step++) {
        stepWorld(w, DT, w.heroes.map(() => emptyInput()));
      }
      expect(w.status, `#${i + 1}`).not.toBe("won");
    }
  }, 30000);
});

describe("prince-princess · 战果记在谁头上", () => {
  it("单人模式:搭档打的怪、捡的宝石不算真人那一份", () => {
    const w = idleSolo(buildLevel(0));
    expect(w.kills + w.gemsTaken).toBeGreaterThan(0);
    expect(w.playerKills).toBe(0);
    expect(w.playerGems).toBe(0);
  });

  it("两个人玩:两位都是真人,战果全算真人的", () => {
    const def = buildLevel(0);
    const w = createWorld(def, 2);
    for (let step = 0; step < capOf(def) && w.status === "playing"; step++) {
      stepWorld(w, DT, w.heroes.map((_, i) => botInput(w, i, DT)));
    }
    expect(w.kills).toBeGreaterThan(0);
    expect(w.playerKills).toBe(w.kills);
    expect(w.playerGems).toBe(w.gemsTaken);
  }, 20000);

  it("换人以后,战果跟着真人手上那位走", () => {
    const def = buildLevel(0);
    const w = createWorld(def, 1);
    expect(swapActive(w)).toBe(1);
    for (let step = 0; step < capOf(def) && w.status === "playing"; step++) {
      stepWorld(w, DT, w.heroes.map((_, i) => (i === w.active ? emptyInput() : botInput(w, i, DT))));
    }
    // 现在托管的是 0 号:他打的怪不该记到真人头上
    expect(w.heroes[0].kills).toBeGreaterThan(0);
    expect(w.playerKills).toBe(0);
  }, 20000);

  it("一下都没打中的话,「路上的怪一只不剩」不算你的星", () => {
    const def = buildLevel(0);
    const base = {
      win: true,
      kills: Math.max(1, def.enemies.length),
      enemyTotal: Math.max(1, def.enemies.length),
      killPct: 100,
      gems: def.gemGoal,
      time: 1,
      hearts: def.hearts,
      bossDown: false,
    };
    expect(starsForRun(def, { ...base, solo: true, playerHits: 0, playerKills: 0, playerGems: 0 })).toBeLessThan(3);
    expect(starsForRun(def, { ...base, solo: true, playerHits: 3, playerKills: 1, playerGems: 1 })).toBe(3);
    // 两个人玩不受这条约束
    expect(starsForRun(def, { ...base, solo: false })).toBe(3);
  });

  it("结算文案不把搭档的战果说成你的", () => {
    const def = buildLevel(0);
    const msg = winMessage(def, {
      win: true,
      kills: Math.max(1, def.enemies.length),
      enemyTotal: Math.max(1, def.enemies.length),
      killPct: 100,
      gems: def.gemGoal + 1,
      time: 1,
      hearts: def.hearts,
      bossDown: false,
      solo: true,
      playerHits: 0,
      playerKills: 0,
      playerGems: 0,
    });
    expect(msg).toContain("搭档");
    expect(msg).not.toContain("失败");
  });
});

describe("prince-princess · 玩家动起来还是打得通", () => {
  it("机器人替真人操作时,单人模式抽样 16 关照样过", () => {
    const sample = [0, 5, 13, 27, 40, 55, 68, 81, 93, 108, 120, 133, 147, 160, 174, 187];
    for (const lv of sample) {
      const def = buildLevel(lv);
      const r = autoPlay(createWorld(def, 1), { maxSeconds: 300 });
      expect(r.win, `#${lv + 1} ${def.name}`).toBe(true);
    }
  }, 60000);

  it("单人模式认真打,第 1 关拿得到三星", () => {
    const def = buildLevel(0);
    const w = createWorld(def, 1);
    const r = autoPlay(w, { maxSeconds: 200 });
    expect(r.win).toBe(true);
    expect(summarize(w).playerHits).toBeGreaterThan(0);
    expect(starsForRun(def, r)).toBe(3);
  });
});
