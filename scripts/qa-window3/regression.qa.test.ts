/**
 * 窗口 3 · 第 3 轮 ·「修后回归」的摆烂重扫。
 *
 * B1 / B2 / B3 / S5 四条阻断的代码都已落地(c93adbb / 37a0f63 + 6dbe7fd / e0dfd13 / 65c44d7),
 * 这一份在修后的 HEAD 上把第 3 轮那套摆烂扫描原样再跑一遍,回答三件事:
 *
 *  1. 每一款「玩家一个键都不按」还能过多少关(修前:180 / 110 / 72 / 31);
 *  2. 残量落在哪几关、哪张场地——B3 修复员自己宣称还剩 19 关,得点名;
 *  3. 结算文案还会不会把「对手自己掉下去」夸成玩家的战绩。
 *
 * 与 `idle.qa.test.ts` / `round3.qa.test.ts` 的关系:
 * 那两份是修前取证用的,落盘路径分别是 `window3-round3-idle.json` 与
 * `window3-round3-rootcause.json`,里面存的是**修前**的基线数字,不能被覆盖。
 * 所以修后回归单独一份、单独落盘到 `window3-round3-regression-idle.json`,
 * 建局方式则与那两份逐字对齐(同一套 seed / 档位 / 打法 / 力气 / 命数),
 * 保证「修前 72 关」与「修后 N 关」这两个数字是同一把尺子量出来的。
 *
 * 跑法:npx vitest run --config scripts/qa-window3/vitest.config.ts regression
 */
import { describe, it, expect, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";

const report: Record<string, unknown> = {};

afterAll(() => {
  mkdirSync("docs/qa/_evidence", { recursive: true });
  writeFileSync(
    "docs/qa/_evidence/window3-round3-regression-idle.json",
    JSON.stringify({ takenAt: new Date().toISOString(), ...report }, null, 2)
  );
});

/** 第 3 轮修前的基线,写死在这里当对照 */
const BEFORE = {
  skySquad: 180,
  princePrincess: 110,
  duoVsStar: 72,
  bumperCars: 31,
  /** 修前 bumper-cars 摆烂能过的 31 关(1 基),取自 window3-round3-idle.json */
  bumperCarsLevels: [
    1, 4, 11, 12, 19, 21, 24, 26, 27, 30, 31, 35, 37, 38, 39, 52, 56, 58, 60, 62, 84, 98, 120, 144,
    146, 148, 153, 169, 171, 173, 176,
  ],
  /** 修前 duo-vs-star 摆烂能过的 72 关(1 基) */
  duoVsStarLevels: [
    1, 2, 4, 6, 9, 10, 12, 14, 15, 18, 28, 31, 39, 40, 41, 42, 44, 47, 48, 50, 51, 53, 54, 70, 71,
    80, 100, 104, 106, 112, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147,
    148, 149, 150, 151, 152, 153, 154, 155, 157, 158, 159, 160, 161, 162, 163, 164, 166, 167, 168,
    170, 171, 173, 177, 178, 180, 182, 183, 186,
  ],
};

// ---------------------------------------------------------------------------
// B1 · sky-squad
// ---------------------------------------------------------------------------

describe("B1 回归 · sky-squad 放跑判罚", () => {
  /** 走真机那条路径(domStub + createSortie),玩家一个键都不按 */
  const idleSortie = async (level: number) => {
    const { install } = await import("../../src/games/sky-squad/domStub");
    const { buildSortie, isBossLevel } = await import("../../src/games/sky-squad/levels");
    const { sortieCleared, starsForSortie, sortieMessage, escapeLimit } = await import(
      "../../src/games/sky-squad/logic"
    );
    const mod = await import("../../src/games/sky-squad/index");
    const h = install();
    const def = buildSortie(level);
    let out: { cleared: boolean; downed: number; total: number; escaped: number; bossDown: boolean } | null = null;
    let touched = 0;
    let bombs = 0;
    const sortie = mod.createSortie({
      host: h.root as unknown as HTMLElement,
      players: 1,
      tint: "#EAF2FF",
      hint: def.hint,
      waves: def.waves,
      boss: def.boss,
      pickups: def.pickups,
      sfx: () => {},
      onFinish: (pilots: Array<{ touched: number; bombsUsed: number }>, r: typeof out) => {
        out = r;
        touched = pilots[0].touched;
        bombs = pilots[0].bombsUsed;
      },
    } as never);
    for (let f = 0; f < 6000 && out === null; f++) h.flush(1);
    sortie.destroy();
    h.restore();
    if (!out) return null;
    const r = out as unknown as { cleared: boolean; downed: number; total: number; escaped: number; bossDown: boolean };
    const stat = { downed: r.downed, total: r.total, touched, bombs, escaped: r.escaped, bossDown: r.bossDown };
    return {
      level: level + 1,
      boss: isBossLevel(level),
      cleared: r.cleared && sortieCleared(stat, isBossLevel(level)),
      downed: r.downed,
      escaped: r.escaped,
      total: r.total,
      escapeLimit: escapeLimit(r.total),
      stars: starsForSortie(stat),
      line: sortieMessage(stat),
    };
  };

  it("点名的第 1 / 60 / 133 / 188 关:摆烂各自是什么下场", async () => {
    const rows = [];
    for (const level of [1, 60, 133, 188]) rows.push(await idleSortie(level - 1));
    report.skySquadNamed = rows;
    for (const r of rows) {
      console.log(
        `sky-squad 第 ${String(r?.level).padStart(3)} 关 → ${r?.cleared ? "过关" : "没过"} · ` +
          `打下 ${r?.downed}/${r?.total} · 放跑 ${r?.escaped}(容错 ${r?.escapeLimit}) · ${r?.stars} 星 | ${r?.line}`
      );
    }
    // 修前:第 1 关 11 秒三星过、第 60 关 8 秒三星过
    expect(rows.find((r) => r?.level === 1)?.cleared).toBe(false);
    expect(rows.find((r) => r?.level === 60)?.cleared).toBe(false);
  }, 120000);

  it("放跑的敌机真的记上了:escaped 不再恒为 0", async () => {
    const rows = (report.skySquadNamed ?? []) as Array<{ escaped: number } | null>;
    const anyEscaped = rows.some((r) => (r?.escaped ?? 0) > 0);
    report.skySquadEscapedRecorded = anyEscaped;
    expect(anyEscaped, "escaped 全是 0,判罚链路可能又断了").toBe(true);
  });

  it("全 188 关摆烂重扫:autoWin 计数", async () => {
    const autoWin: number[] = [];
    const rows: Array<{ level: number; escaped: number; downed: number; total: number }> = [];
    for (let i = 0; i < 188; i++) {
      const r = await idleSortie(i);
      if (!r) continue;
      rows.push({ level: r.level, escaped: r.escaped, downed: r.downed, total: r.total });
      if (r.cleared) autoWin.push(r.level);
    }
    const escapedTotal = rows.reduce((a, r) => a + r.escaped, 0);
    report.skySquadRescan = {
      scanned: rows.length,
      before: BEFORE.skySquad,
      after: autoWin.length,
      autoWin,
      escapedTotal,
      levelsWithZeroEscaped: rows.filter((r) => r.escaped === 0).map((r) => r.level),
    };
    console.log(`\nsky-squad 修后摆烂重扫:${rows.length} 关中 ${autoWin.length} 关自动过关(修前 ${BEFORE.skySquad})`);
    expect(rows.length).toBe(188);
    expect(autoWin, `还能摆烂过的关:${autoWin.join(",")}`).toEqual([]);
  }, 600000);
});

// ---------------------------------------------------------------------------
// B2 · prince-princess
// ---------------------------------------------------------------------------

describe("B2 回归 · prince-princess 单人托管搭档", () => {
  /** 真机单人模型:world.active 那位吃真人输入(全空),另一位由 botInput 托管 */
  const idleSolo = async (level: number) => {
    const { buildLevel } = await import("../../src/games/prince-princess/levels");
    const logic = await import("../../src/games/prince-princess/logic");
    const DT = 1 / 60;
    const def = buildLevel(level);
    const w = logic.createWorld(def, 1);
    const startX = w.heroes.map((h) => h.x);
    let maxAdvance = 0;
    const cap = Math.ceil(((def.timeLimit > 0 ? def.timeLimit : 200) + 5) / DT);
    let steps = 0;
    while (w.status === "playing" && steps < cap) {
      const feed = w.heroes.map((_, k) => (k === w.active ? logic.emptyInput() : logic.botInput(w, k, DT)));
      logic.stepWorld(w, DT, feed);
      for (let k = 0; k < w.heroes.length; k++) {
        if (k === w.active) continue;
        maxAdvance = Math.max(maxAdvance, Math.abs(w.heroes[k].x - startX[k]));
      }
      steps++;
    }
    const r = logic.summarize(w);
    return {
      level: level + 1,
      status: w.status,
      seconds: Math.round(r.time),
      stars: w.status === "won" ? logic.starsForRun(def, r) : 0,
      kills: r.kills,
      enemyTotal: r.enemyTotal,
      gems: r.gems,
      gemGoal: def.gemGoal,
      /** 托管搭档离出发点最远探出多少像素:B2 第二层修的就是这个 */
      escortReach: Math.round(maxAdvance),
    };
  };

  it("点名的第 1 / 60 / 133 / 188 关:单人摆烂各自是什么下场", async () => {
    const rows = [];
    for (const level of [1, 60, 133, 188]) rows.push(await idleSolo(level - 1));
    report.princeNamed = rows;
    for (const r of rows) {
      console.log(
        `prince-princess 第 ${String(r.level).padStart(3)} 关 → ${r.status} · ${r.seconds} 秒 · ` +
          `清怪 ${r.kills}/${r.enemyTotal} · 宝石 ${r.gems}/${r.gemGoal} · 搭档探出 ${r.escortReach}px`
      );
    }
    // 修前:第 1 关 13 秒三星过、第 133 关 22 秒过
    expect(rows.find((r) => r.level === 1)?.status).not.toBe("won");
    expect(rows.find((r) => r.level === 133)?.status).not.toBe("won");
  }, 120000);

  it("全 188 关单人摆烂重扫:autoWin 计数 + 托管搭档还替玩家干了多少活", async () => {
    const autoWin: number[] = [];
    let lost = 0;
    let stall = 0;
    let kills = 0;
    let gems = 0;
    let clearedAll = 0;
    let gemGoalMet = 0;
    let maxReach = 0;
    for (let i = 0; i < 188; i++) {
      const r = await idleSolo(i);
      if (r.status === "won") autoWin.push(r.level);
      else if (r.status === "lost") lost++;
      else stall++;
      kills += r.kills;
      gems += r.gems;
      if (r.enemyTotal > 0 && r.kills >= r.enemyTotal) clearedAll++;
      if (r.gemGoal > 0 && r.gems >= r.gemGoal) gemGoalMet++;
      maxReach = Math.max(maxReach, r.escortReach);
    }
    report.princeRescan = {
      scanned: 188,
      before: BEFORE.princePrincess,
      after: autoWin.length,
      autoWin,
      lost,
      stall,
      escort: { kills, gems, clearedAllLevels: clearedAll, gemGoalMetLevels: gemGoalMet, maxReachPx: maxReach },
    };
    console.log(
      `\nprince-princess 修后单人摆烂:188 关中 ${autoWin.length} 关自动过关(修前 ${BEFORE.princePrincess}),` +
        `判负 ${lost}、僵持 ${stall};托管搭档全程 ${kills} 杀 / ${gems} 宝石 / 最远探出 ${maxReach}px`
    );
    expect(autoWin, `还能摆烂过的关:${autoWin.join(",")}`).toEqual([]);
  }, 600000);

  it("双人零输入(两位都是真人、都不动)仍然一关都过不去", async () => {
    const { buildLevel } = await import("../../src/games/prince-princess/levels");
    const logic = await import("../../src/games/prince-princess/logic");
    const DT = 1 / 60;
    const rows: Array<{ level: number; status: string }> = [];
    for (const level of [1, 60, 133, 188]) {
      const w = logic.createWorld(buildLevel(level - 1), 2);
      let steps = 0;
      while (w.status === "playing" && steps < 60 * 250) {
        logic.stepWorld(w, DT, w.heroes.map(() => logic.emptyInput()));
        steps++;
      }
      rows.push({ level, status: w.status });
    }
    report.princeDuoIdle = rows;
    console.log(`\nprince-princess 双人零输入:${rows.map((r) => `第${r.level}关=${r.status}`).join("、")}`);
    expect(rows.filter((r) => r.status === "won")).toEqual([]);
  }, 120000);
});

// ---------------------------------------------------------------------------
// B3 · duo-vs-star
// ---------------------------------------------------------------------------

describe("B3 回归 · duo-vs-star 对手自己掉台", () => {
  const idleMatch = async (level: number) => {
    const { createMatch, runMatch } = await import("../../src/games/duo-vs-star/battle");
    const { levelAt, rateLevel } = await import("../../src/games/duo-vs-star/levels");
    const lv = levelAt(level);
    // 与 idle.qa.test.ts / src 的 idle.test.ts 逐字同一套建局
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
    lv.foes.forEach((foe, fi: number) => {
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
    const m = runMatch(
      createMatch({
        stageId: lv.stageId,
        slots,
        stocks: lv.playerStocks,
        timeLimit: lv.timeLimit,
        itemEvery: lv.itemEvery,
        itemPool: lv.itemPool,
        seed: (level + 1) * 7919,
      } as never),
      (lv.timeLimit > 0 ? lv.timeLimit : 150) + 5
    );
    const me = m.actors[0];
    return {
      level: level + 1,
      stageId: lv.stageId,
      win: m.winnerTeam === 0,
      winnerTeam: m.winnerTeam,
      endReason: m.endReason,
      seconds: Math.round(m.t * 10) / 10,
      hits: me.hits,
      outs: me.outs,
      stars: m.winnerTeam === 0 ? rateLevel(me.outs, me.hits) : 0,
      allies: lv.allies.length,
      timeLimit: lv.timeLimit,
    };
  };

  it("点名的第 1 / 134 / 145 / 157 关:摆烂各自是什么下场", async () => {
    const rows = [];
    for (const level of [1, 134, 145, 157]) rows.push(await idleMatch(level - 1));
    report.duoNamed = rows;
    for (const r of rows) {
      console.log(
        `duo-vs-star 第 ${String(r.level).padStart(3)} 关 (${r.stageId}) → ${r.win ? "过关" : "没过"} · ` +
          `${r.seconds} 秒 · ${r.endReason} · 玩家命中 ${r.hits} 次 · ${r.stars} 星`
      );
    }
    // 摆烂时玩家一下都没出手,不管输赢都不该有命中,更不该有三星
    for (const r of rows) {
      expect(r.hits, `第 ${r.level} 关:玩家没按键却打中了人`).toBe(0);
      expect(r.stars, `第 ${r.level} 关摆烂还是三星`).toBeLessThan(3);
    }
  }, 120000);

  it("全 188 关摆烂重扫:残量落在哪几关、哪张场地", async () => {
    const { CHAPTERS, levelAt } = await import("../../src/games/duo-vs-star/levels");
    const rows = [];
    for (let i = 0; i < 188; i++) rows.push(await idleMatch(i));
    const autoWin = rows.filter((r) => r.win);
    const byStage = new Map<string, number[]>();
    for (const r of autoWin) byStage.set(r.stageId, [...(byStage.get(r.stageId) ?? []), r.level]);
    let base = 0;
    const chapters = CHAPTERS.map((ch) => {
      const stageId = levelAt(base).stageId;
      const hit = autoWin.filter((r) => r.level > base && r.level <= base + ch.size);
      const line = {
        chapter: ch.name,
        stageId,
        range: `${base + 1}-${base + ch.size}`,
        size: ch.size,
        autoWin: hit.length,
        levels: hit.map((r) => r.level),
      };
      base += ch.size;
      return line;
    });
    report.duoRescan = {
      scanned: 188,
      before: BEFORE.duoVsStar,
      after: autoWin.length,
      threeStar: autoWin.filter((r) => r.stars === 3).length,
      byKo: autoWin.filter((r) => r.endReason === "ko").length,
      byTime: autoWin.filter((r) => r.endReason === "time").length,
      withAlly: autoWin.filter((r) => r.allies > 0).length,
      remaining: autoWin.map((r) => ({
        level: r.level,
        stageId: r.stageId,
        endReason: r.endReason,
        seconds: r.seconds,
        stars: r.stars,
        allies: r.allies,
        timeLimit: r.timeLimit,
        // 这一关的「赢」是不是扫描器自己的 155 秒上限造出来的:
        // runMatch 排完 maxSeconds 就 endMatch(timeoutWinner(s), "time"),
        // 而不限时的关在真机上根本不会到点判胜负,只会一直打下去。
        capArtifact: r.endReason === "time" && r.timeLimit === 0,
      })),
      /** 真机上真的会发生的那一批:对手被 KO,或者本来就有限时 */
      genuine: autoWin.filter((r) => !(r.endReason === "time" && r.timeLimit === 0)).map((r) => r.level),
      /** 扫描器 155 秒上限造出来的:这些关不限时,真机不会判胜负 */
      capArtifacts: autoWin.filter((r) => r.endReason === "time" && r.timeLimit === 0).map((r) => r.level),
      noTimeLimitLevels: rows.filter((r) => r.timeLimit === 0).length,
      byChapter: chapters,
      /** 修前那 72 关里,现在还剩哪些 */
      stillFromOld72: autoWin.map((r) => r.level).filter((n) => BEFORE.duoVsStarLevels.includes(n)),
      /** 修前不在名单、修后反而能摆烂过的(理论上应为空) */
      newlyIdleWinnable: autoWin.map((r) => r.level).filter((n) => !BEFORE.duoVsStarLevels.includes(n)),
    };
    console.log(`\nduo-vs-star 修后摆烂重扫:188 关中 ${autoWin.length} 关自动过关(修前 ${BEFORE.duoVsStar})`);
    console.log(`   → 残量关号:${autoWin.map((r) => `${r.level}(${r.stageId},${r.endReason},限时${r.timeLimit})`).join("、")}`);
    console.log(
      `   → 其中 ${autoWin.filter((r) => r.endReason === "time" && r.timeLimit === 0).length} 关是扫描器 155 秒上限造出来的假胜` +
        `(这些关不限时,真机不会到点判);全 188 关里不限时的有 ${rows.filter((r) => r.timeLimit === 0).length} 关`
    );
    for (const c of chapters) {
      if (c.autoWin > 0) console.log(`   → ${c.chapter} ${c.stageId} 第${c.range}关 ${c.autoWin}/${c.size}`);
    }
    expect(rows.length).toBe(188);
    // 玩家零输入永远不该拿三星——这一条是硬底线,残量归零与否另说
    expect(autoWin.filter((r) => r.stars === 3).map((r) => r.level)).toEqual([]);
    expect(autoWin.filter((r) => r.hits > 0).map((r) => r.level)).toEqual([]);
  }, 600000);
});

// ---------------------------------------------------------------------------
// S5 · bumper-cars
// ---------------------------------------------------------------------------

describe("S5 回归 · bumper-cars AI 自己冲下悬崖 + 撞飞归因", () => {
  const idlePlay = async (level: number) => {
    const L = await import("../../src/games/bumper-cars/levels");
    const A = await import("../../src/games/bumper-cars/ai");
    const logic = await import("../../src/games/bumper-cars/logic");
    const TICK = 16;
    const lv = L.buildLevel(level);
    // 建局与 idle.qa.test.ts 逐字一致(car.ai 只是个标记,logic 里不读它)
    const cars = [
      logic.makeCar({
        id: 0, name: "鸭梨", emoji: "🌸", color: "#e8558f", team: 0,
        x: lv.spawn.x, y: lv.spawn.y, lives: lv.hearts, ai: true,
      }),
      ...lv.foes.map((foe, k) => {
        const spot = lv.foeSpawns[k] ?? lv.foeSpawns[0] ?? lv.spawn;
        return logic.makeCar({
          id: k + 1, name: foe.name, emoji: foe.emoji, color: foe.color, team: 1,
          x: spot.x, y: spot.y, lives: foe.lives, mass: foe.mass, r: foe.r, ai: true,
        });
      }),
    ];
    const w = logic.createWorld({
      field: lv.field, cars, pads: lv.pads, hazards: lv.hazards, spinners: lv.spinners,
      slicks: lv.slicks, limit: lv.seconds > 0 ? lv.seconds * 1000 : 0, keep: lv.keep, seed: lv.seed,
    });
    const skills = [3, ...lv.foes.map((f) => f.skill)];
    const credits: number[] = [];
    let tick = 0;
    let ms = 0;
    for (; ms < lv.seconds * 1000; ms += TICK) {
      if (logic.levelCleared(w) || logic.playerDown(w)) break;
      const hunters = A.huntersFor(w, lv.hunters, w.time);
      const intents = w.cars.map((_, k) =>
        k === 0 ? logic.IDLE : A.chooseCarAction(w, k, (skills[k] ?? 2) as never, tick + k * 7, hunters.has(k) ? "hunt" : "patrol")
      );
      tick++;
      w.events.length = 0;
      logic.stepWorld(w, TICK, intents);
      for (const e of w.events) if (e.kind === "out" && w.cars[e.who].team !== 0) credits.push(e.by);
    }
    const cleared = logic.levelCleared(w);
    const knocked = w.cars[0].score;
    const falls = w.cars[0].falls;
    const left = logic.secondsLeft(w);
    return {
      level: level + 1,
      cleared,
      down: logic.playerDown(w),
      seconds: Math.round(ms / 1000),
      knocked,
      falls,
      credits,
      /** 有没有把对手出局算到玩家(0 号)头上 */
      miscredited: credits.filter((by) => by === 0).length,
      stars: cleared ? logic.rateLevel(left, lv.seconds, falls, knocked) : 0,
      line: cleared ? logic.winLine(left, falls, knocked) : logic.loseLine(logic.playerDown(w) ? "fall" : "time"),
    };
  };

  it("第 1 关:摆烂不再白送,结算也不再把自杀算成「撞飞」", async () => {
    const r = await idlePlay(0);
    report.bumperLevel1 = r;
    console.log(
      `bumper-cars 第 1 关 → ${r.cleared ? "过关" : r.down ? "判负" : "时间到"} · ${r.seconds} 秒 · ` +
        `撞飞 ${r.knocked} · ${r.stars} 星 | ${r.line}`
    );
    expect(r.cleared, "第 1 关摆烂还是能过").toBe(false);
    expect(r.knocked, "玩家没动过却被记了撞飞").toBe(0);
    expect(r.miscredited, "有对手出局被算到玩家头上").toBe(0);
    expect(r.line).not.toMatch(/撞飞 \d+ 台/);
    expect(r.line).not.toContain("走位和刹车");
  }, 60000);

  it("全 188 关摆烂重扫 + 原 31 关逐关复验", async () => {
    const rows = [];
    for (let i = 0; i < 188; i++) rows.push(await idlePlay(i));
    const autoWin = rows.filter((r) => r.cleared);
    const miscredited = rows.filter((r) => r.miscredited > 0).map((r) => r.level);
    const praised = rows.filter((r) => r.cleared && /撞飞 \d+ 台/.test(r.line)).map((r) => r.level);
    const oldStill = BEFORE.bumperCarsLevels.filter((n) => rows[n - 1].cleared);
    report.bumperRescan = {
      scanned: 188,
      before: BEFORE.bumperCars,
      after: autoWin.length,
      autoWin: autoWin.map((r) => ({
        level: r.level, seconds: r.seconds, knocked: r.knocked, stars: r.stars, credits: r.credits, line: r.line,
      })),
      threeStar: autoWin.filter((r) => r.stars === 3).length,
      old31StillIdleWinnable: oldStill,
      levelsMiscreditingPlayer: miscredited,
      levelsStillPraisingKnockouts: praised,
    };
    console.log(`\nbumper-cars 修后摆烂重扫:188 关中 ${autoWin.length} 关自动过关(修前 ${BEFORE.bumperCars})`);
    if (autoWin.length) console.log(`   → 残量关号:${autoWin.map((r) => `${r.level}(${r.stars}星)`).join("、")}`);
    console.log(`   → 原 31 关里还剩:${oldStill.length ? oldStill.join(",") : "0 关"}`);
    expect(rows.length).toBe(188);
    expect(miscredited, `这些关把对手自己掉下去算成了玩家撞飞:${miscredited.join(",")}`).toEqual([]);
    expect(praised, `这些关摆烂过关还在夸「撞飞 N 台」:${praised.join(",")}`).toEqual([]);
    expect(autoWin.filter((r) => r.stars >= 2).map((r) => r.level)).toEqual([]);
  }, 600000);
});

// ---------------------------------------------------------------------------
// 常驻用例覆盖面:「玩家零输入不能通关」进 src 了吗
// ---------------------------------------------------------------------------

describe("常驻用例覆盖面", () => {
  it("本窗 17 款有战役的游戏,哪几款把「零输入不能通关」写进了 src 常驻用例", async () => {
    const { existsSync, readFileSync, readdirSync } = await import("node:fs");
    const CAMPAIGN_IDS = [
      "sky-squad", "prince-princess", "duo-vs-star", "bumper-cars", "candy-swing",
      "puff-bros", "bomb-buddies", "garden-guard", "sprout-defense", "monster-crisis",
      "gold-hook", "tank-battle", "sling-birds", "shoot-range", "snow-fight",
      "bowling-lane", "ice-fire-forest",
    ];
    // 只认**用例标题**,不认代码里的标识符:`IDLE_INPUT` / `idle()` 这类工具函数
    // 到处都是,按全文匹配的话 tank-battle、bomb-buddies、snow-fight 都会被算成
    // 「已覆盖」,而它们其实一条都没在问「玩家什么都不做会怎样」。
    const TITLE_RE = /^\s*(?:it|describe)\(\s*"([^"]*)"/gm;
    /** 标题里得同时出现「不动手」和「所以过不去」两半,才算真的在守这条线 */
    const IDLE_WORD = /摆烂|零输入|一个键都不按|什么都不做|一座塔都不种|不种植物|不种塔|静置/;
    // 光有前半句不算:bomb-buddies「被泡泡包着的时候什么都不做」说的是电脑被罩住的行为,
    // 跟「玩家不动手能不能过关」是两回事。
    const OUTCOME_WORD = /过不去|过不了|守不住|必输|拿不到|白送|算过关|通关|一关都/;
    const IDLE_TITLE_RE = { test: (t: string) => IDLE_WORD.test(t) && OUTCOME_WORD.test(t) };
    const covered: string[] = [];
    const missing: string[] = [];
    const detail: Record<string, string[]> = {};
    for (const id of CAMPAIGN_IDS) {
      const dir = `src/games/${id}`;
      if (!existsSync(dir)) continue;
      const hits: string[] = [];
      for (const f of readdirSync(dir).filter((n) => n.endsWith(".test.ts"))) {
        const src = readFileSync(`${dir}/${f}`, "utf8");
        for (const m of src.matchAll(TITLE_RE)) {
          if (IDLE_TITLE_RE.test(m[1])) hits.push(`${f} › ${m[1]}`);
        }
      }
      detail[id] = hits;
      (hits.length > 0 ? covered : missing).push(id);
    }
    report.idleTestCoverage = { scanned: CAMPAIGN_IDS.length, covered, missing, detail };
    console.log(`\n「零输入」常驻用例:已覆盖 ${covered.length} 款(${covered.join("、")})`);
    console.log(`   → 还没有的 ${missing.length} 款:${missing.join("、")}`);
    // 四条阻断的四款必须各有一张常驻网,不然下一次改动又会悄悄把口子放开
    for (const id of ["sky-squad", "prince-princess", "duo-vs-star", "bumper-cars"]) {
      expect(covered, `${id} 没有「零输入」常驻用例`).toContain(id);
    }
  });
});
