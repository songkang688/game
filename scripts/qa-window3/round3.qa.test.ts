/**
 * 窗口 3 · 第 3 轮 · 两条根因取证。
 *
 * 1. `sky-squad` B1（第 2 轮定的阻断）本轮再量一次:`escaped` 到底是不是恒为空,
 *    以及「摆烂即过关」影响到 188 关里的多少关。
 * 2. `prince-princess` 第 1 关零操作也能过关 —— 这一条第 2 轮的摆烂扫描没扫出来,
 *    因为那次用的是 `createWorld(def, 2)`(两位英雄都当真人、都不喂输入)。
 *    真机是**单人模式**:没被操作的那位由 `botInput` 托管,所以「玩家不动」
 *    并不等于「场上没人动」。这里按真机模型重扫。
 *
 * 跑法:npx vitest run --config scripts/qa-window3/vitest.config.ts round3
 */
import { describe, it, expect, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";

const report: Record<string, unknown> = {};

afterAll(() => {
  mkdirSync("docs/qa/_evidence", { recursive: true });
  writeFileSync("docs/qa/_evidence/window3-round3-rootcause.json", JSON.stringify(report, null, 2));
});

describe("B1 · sky-squad 放跑判罚", () => {
  it("`escaped` 筛子与上一行的 hp 清零互斥,恒为空", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/games/sky-squad/index.ts", "utf8");
    // 先清零、后按 hp > 0 筛同一批飞机 —— 两行都还在,顺序也没换
    const zeroAt = src.indexOf("if (f.y > SKY_H + 60) f.hp = 0;");
    const filterAt = src.indexOf('const escaped = foes.filter((f) => f.hp > 0 && f.y > SKY_H + 60);');
    expect(zeroAt).toBeGreaterThan(0);
    expect(filterAt).toBeGreaterThan(zeroAt);
    report.b1SourceStillBroken = { zeroAt, filterAt };
  });

  it("按同一套规则复演 stepFoes:飞出下边界的敌机一架都不进 escapedTotal", async () => {
    const SKY_H = 720;
    // 复演 stepFoes 里那两行的相对顺序(不 import 玩法代码,只按源码顺序推一遍)
    let escapedTotal = 0;
    let foes = [
      { y: SKY_H + 10, hp: 3 },
      { y: SKY_H + 200, hp: 3 },
      { y: 100, hp: 3 },
    ];
    for (const f of foes) {
      f.y += 120;
      if (f.y > SKY_H + 60) f.hp = 0;
    }
    const escaped = foes.filter((f) => f.hp > 0 && f.y > SKY_H + 60);
    escapedTotal += escaped.length;
    foes = foes.filter((f) => f.hp > 0);
    expect(escaped.length).toBe(0);
    expect(escapedTotal).toBe(0);
    report.b1Replay = { escapedCaught: escaped.length, escapedTotal, foesLeft: foes.length };
  });

  it("`escaped = 0` 灌进判定链:非 Boss 关必过,而且直上三星", async () => {
    const { sortieCleared, starsForSortie, escapeLimit } = await import("../../src/games/sky-squad/logic");
    // 全放跑(downed = 0)但 escapedTotal 卡在 0 —— 这就是真机里发生的事
    const asShipped = { downed: 0, total: 12, touched: 0, bombs: 0, escaped: 0, bossDown: false };
    expect(sortieCleared(asShipped, false)).toBe(true);
    expect(starsForSortie(asShipped)).toBe(3);
    // 同一局若 escapedTotal 记对了(12 架全放跑)应当是判负
    const asDesigned = { ...asShipped, escaped: 12 };
    expect(sortieCleared(asDesigned, false)).toBe(false);
    expect(escapeLimit(12)).toBe(3);
    report.b1Chain = { shippedCleared: true, shippedStars: 3, designedCleared: false, escapeLimit12: 3 };
  });

  it("影响面:188 关里有多少关不是 Boss 关", async () => {
    const { isBossLevel, buildSortie } = await import("../../src/games/sky-squad/levels");
    const boss: number[] = [];
    const normal: number[] = [];
    for (let i = 0; i < 188; i++) (isBossLevel(i) ? boss : normal).push(i + 1);
    expect(boss.length + normal.length).toBe(188);
    // 非 Boss 关的沙场编制:这些飞机全放跑也照样判过关
    const sample = [0, 59, 132].map((i) => ({ level: i + 1, foes: buildSortie(i).waves.reduce((a, w) => a + w.count, 0) }));
    report.b1Scope = { bossLevels: boss.length, exposedLevels: normal.length, bossList: boss, sample };
    expect(normal.length).toBeGreaterThan(150);
  });
});

describe("prince-princess · 单人模式下「玩家一个键都不按」", () => {
  it("全 188 关按真机模型重扫(玩家不动,搭档由 botInput 托管)", async () => {
    const { buildLevel } = await import("../../src/games/prince-princess/levels");
    const logic = await import("../../src/games/prince-princess/logic");
    const DT = 1 / 60;
    const autoWin: { level: number; seconds: number; stars: number; kills: number; enemyTotal: number; gems: number; gemGoal: number }[] = [];
    let lost = 0;
    let stall = 0;
    for (let i = 0; i < 188; i++) {
      const def = buildLevel(i);
      // index.ts 单人:opts.players = 1,world.active 那位吃真人输入,另一位走 botInput
      const w = logic.createWorld(def, 2);
      const active = 0;
      const cap = Math.ceil(((def.timeLimit > 0 ? def.timeLimit : 200) + 5) / DT);
      let steps = 0;
      while (w.status === "playing" && steps < cap) {
        const feed = w.heroes.map((_, k) => (k === active ? logic.emptyInput() : logic.botInput(w, k, DT)));
        logic.stepWorld(w, DT, feed);
        steps++;
      }
      if (w.status === "won") {
        const r = logic.summarize(w);
        autoWin.push({
          level: i + 1,
          seconds: Math.round(r.time),
          stars: logic.starsForRun(def, r),
          kills: r.kills,
          enemyTotal: r.enemyTotal,
          gems: r.gems,
          gemGoal: def.gemGoal,
        });
      } else if (w.status === "lost") lost++;
      else stall++;
    }
    const threeStar = autoWin.filter((a) => a.stars === 3);
    report.princeIdleSolo = {
      scanned: 188,
      autoWin: autoWin.length,
      threeStar: threeStar.length,
      lost,
      stall,
      levels: autoWin,
    };
    console.log(
      `\nprince-princess 单人摆烂:188 关中 ${autoWin.length} 关自动过关(其中 ${threeStar.length} 关三星),判负 ${lost},僵持 ${stall}`
    );
    if (autoWin.length) console.log(`   → 关号:${autoWin.map((a) => a.level).join(",")}`);
    expect(autoWin.length + lost + stall).toBe(188);
  });

  it("第 1 关的关卡定义:门槛在哪儿", async () => {
    const { buildLevel } = await import("../../src/games/prince-princess/levels");
    const d = buildLevel(0);
    report.princeLevel1 = {
      name: d.name,
      teach: d.teach,
      noRisk: d.noRisk,
      requiredRatio: d.requiredRatio,
      enemies: d.enemies.length,
      goalNeedsAll: d.goalNeedsAll,
      gems: d.gems.length,
      gemGoal: d.gemGoal,
      parSeconds: d.parSeconds,
      timeLimit: d.timeLimit,
      len: d.len,
      goalX: d.goalX,
    };
    console.log(`\nprince-princess 第 1 关:${JSON.stringify(report.princeLevel1)}`);
    expect(d.index).toBe(0);
  });

  it("双人模式(两位都是真人、都不动)才是第 2 轮扫的那个模型 —— 结论不同", async () => {
    const { buildLevel } = await import("../../src/games/prince-princess/levels");
    const logic = await import("../../src/games/prince-princess/logic");
    const DT = 1 / 60;
    let won = 0;
    for (const i of [0, 59, 132, 187]) {
      const w = logic.createWorld(buildLevel(i), 2);
      let steps = 0;
      while (w.status === "playing" && steps < 60 * 250) {
        logic.stepWorld(w, DT, w.heroes.map(() => logic.emptyInput()));
        steps++;
      }
      if (w.status === "won") won++;
    }
    report.princeIdleDuo = { scanned: 4, won };
    expect(won).toBe(0);
  });
});
