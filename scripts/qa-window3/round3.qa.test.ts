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
  it("源码里那句「先清零」已经撤掉:`escaped` 筛子拿得到飞出下边界的敌机", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/games/sky-squad/index.ts", "utf8");
    const zeroAt = src.indexOf("if (f.y > SKY_H + 60) f.hp = 0;");
    const filterAt = src.indexOf("const escaped = foes.filter((f) => f.hp > 0 && f.y > SKY_H + 60);");
    // 清零那一行没了,筛子还在
    expect(zeroAt).toBe(-1);
    expect(filterAt).toBeGreaterThan(0);
    report.b1SourceFixed = { zeroAt, filterAt };
  });

  it("走真实路径:摆烂一局,飞出下边界的敌机全进 escapedTotal", async () => {
    const { install } = await import("../../src/games/sky-squad/domStub");
    const { buildSortie } = await import("../../src/games/sky-squad/levels");
    const mod = await import("../../src/games/sky-squad/index");
    const h = install();
    const def = buildSortie(0);
    let out: { downed: number; total: number; escaped: number } | null = null;
    const sortie = mod.createSortie({
      host: h.root as unknown as HTMLElement,
      players: 1, tint: "#EAF2FF", hint: def.hint, waves: def.waves, boss: def.boss,
      pickups: def.pickups, sfx: () => {},
      onFinish: (_pilots: unknown, r: { downed: number; total: number; escaped: number }) => { out = r; },
    } as never);
    for (let f = 0; f < 4000 && out === null; f++) h.flush(1);
    sortie.destroy();
    h.restore();
    expect(out).not.toBeNull();
    const res = out as unknown as { downed: number; total: number; escaped: number };
    expect(res.escaped).toBeGreaterThan(0);
    expect(res.downed + res.escaped).toBe(res.total);
    report.b1Replay = res;
  });

  it("判定链:放跑超过容错就判没完成,三星更拿不到", async () => {
    const { sortieCleared, starsForSortie, escapeLimit } = await import("../../src/games/sky-squad/logic");
    const allEscaped = { downed: 0, total: 12, touched: 0, bombs: 0, escaped: 12, bossDown: false };
    expect(sortieCleared(allEscaped, false)).toBe(false);
    expect(starsForSortie(allEscaped)).toBeLessThan(3);
    expect(escapeLimit(12)).toBe(3);
    // 编制小的关也不再靠「至少给 2 架」的兜底白拿:3 架的关只容 1 架
    expect(escapeLimit(3)).toBe(1);
    expect(sortieCleared({ downed: 1, total: 3, touched: 0, bombs: 0, escaped: 2, bossDown: false }, false)).toBe(false);
    report.b1Chain = { escapeLimit12: 3, escapeLimit3: 1 };
  });

  it("全 188 关摆烂重扫:一关都过不去", async () => {
    const { install } = await import("../../src/games/sky-squad/domStub");
    const { buildSortie, isBossLevel } = await import("../../src/games/sky-squad/levels");
    const { sortieCleared } = await import("../../src/games/sky-squad/logic");
    const mod = await import("../../src/games/sky-squad/index");
    const autoWin: number[] = [];
    for (let i = 0; i < 188; i++) {
      const h = install();
      const def = buildSortie(i);
      let out: { cleared: boolean; downed: number; total: number; escaped: number; bossDown: boolean } | null = null;
      let touched = 0;
      let bombs = 0;
      const sortie = mod.createSortie({
        host: h.root as unknown as HTMLElement,
        players: 1, tint: "#EAF2FF", hint: def.hint, waves: def.waves, boss: def.boss,
        pickups: def.pickups, sfx: () => {},
        onFinish: (pilots: Array<{ touched: number; bombsUsed: number }>, r: typeof out) => {
          out = r;
          touched = pilots[0].touched;
          bombs = pilots[0].bombsUsed;
        },
      } as never);
      for (let f = 0; f < 6000 && out === null; f++) h.flush(1);
      sortie.destroy();
      h.restore();
      if (!out) continue;
      const r = out as unknown as { cleared: boolean; downed: number; total: number; escaped: number; bossDown: boolean };
      const stat = { downed: r.downed, total: r.total, touched, bombs, escaped: r.escaped, bossDown: r.bossDown };
      if (r.cleared && sortieCleared(stat, isBossLevel(i))) autoWin.push(i + 1);
    }
    report.b1IdleRescan = { scanned: 188, autoWin: autoWin.length, levels: autoWin };
    console.log(`\nsky-squad 摆烂重扫:188 关中 ${autoWin.length} 关自动过关`);
    expect(autoWin).toEqual([]);
  }, 120000);

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
      // index.ts 单人:`createWorld(opts.def, 1)`,world.active 那位吃真人输入,另一位走 botInput。
      // 第 3 轮取证时这里传的是 2,漏掉了 world 自己知不知道「现在是一个人在玩」——
      // 修 B2 用的正是这条信息(城门只认真人手上那位),所以按真机改回 1。
      const w = logic.createWorld(def, 1);
      const cap = Math.ceil(((def.timeLimit > 0 ? def.timeLimit : 200) + 5) / DT);
      let steps = 0;
      while (w.status === "playing" && steps < cap) {
        const feed = w.heroes.map((_, k) => (k === w.active ? logic.emptyInput() : logic.botInput(w, k, DT)));
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
    // 修 B2 之前:110 关自动过关、94 关三星。现在城门只认真人手上那位,应当归零。
    expect(autoWin.map((a) => a.level)).toEqual([]);
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

describe("duo-vs-star · 摆烂 72 关的根因", () => {
  it("拆开看:哪些是靠 AI 队友赢的,哪些是玩家孤身也赢", async () => {
    const { levelAt } = await import("../../src/games/duo-vs-star/levels");
    const idle = JSON.parse(
      (await import("node:fs")).readFileSync("docs/qa/_evidence/window3-round3-idle.json", "utf8")
    ) as { scans: { id: string; autoWin: number[] }[] };
    const win = idle.scans.find((s) => s.id === "duo-vs-star")?.autoWin ?? [];
    const withAlly: number[] = [];
    const solo: number[] = [];
    for (const n of win) (levelAt(n - 1).allies.length > 0 ? withAlly : solo).push(n);
    // 全 188 关里带队友的有多少关,做个分母
    let allyLevels = 0;
    for (let i = 0; i < 188; i++) if (levelAt(i).allies.length > 0) allyLevels++;
    report.duoVsStarIdle = {
      autoWin: win.length,
      byAlly: withAlly.length,
      bySolo: solo.length,
      soloLevels: solo,
      allyLevelsInCampaign: allyLevels,
    };
    console.log(
      `\nduo-vs-star 摆烂 ${win.length} 关:带 AI 队友的 ${withAlly.length} 关、玩家孤身一人也赢的 ${solo.length} 关` +
        `(全战役带队友的共 ${allyLevels} 关)`
    );
    if (solo.length) console.log(`   → 孤身也赢的关号:${solo.join(",")}`);
    expect(win.length).toBeGreaterThan(0);
  });
});
