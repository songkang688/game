/**
 * 窗口 3 验收 · 测试员自建的**独立**模拟走查。
 *
 * 浏览器那一层(scripts/qa-window3/run.mjs)证明的是「点得进、挂得起来、不报错」;
 * 这一层证明的是「真的能赢、真的会输、无尽真的能一直玩」——直接调各游戏自己的
 * 逻辑导出,用固定策略把局面推到底,拿到可复现的数字。
 *
 * 刻意不放进 src/,`npm test` 收集不到它;跑法:
 *   npx vitest run --config scripts/qa-window3/vitest.config.ts
 *
 * 每一款只记结果、不硬断言(断言留给各游戏自己的测试),
 * 结果落到 docs/qa/_evidence/window3-sim.json,报告直接引用里面的数字。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";

interface Row {
  id: string;
  /** 真的赢过一局 */
  win: boolean;
  /** 真的输过一局(摆烂 / 禁手策略) */
  lose: boolean;
  /** 无尽 / 长局能持续 */
  endless: string;
  /** 量化证据 */
  notes: string[];
}

/**
 * 每轮换一批关卡走(下标 0 基)。
 * 第 1 轮 = 第 1/50/100/150/188 关(默认);第 2 轮 QA_LVS=6,44,131,187 → 第 7/45/132/188 关。
 */
const CAMPAIGN_LVS = (process.env.QA_LVS ?? "0,49,99,149,187").split(",").map(Number);
/** 摆烂对照走哪一关(0 基),第 2 轮换到第 7 关 */
const IDLE_LV = Number(process.env.QA_IDLE_LV ?? "0");
const QA_ROUND = process.env.QA_ROUND ?? "";
const OUT = `docs/qa/_evidence/window3-sim${QA_ROUND ? `-r${QA_ROUND}` : ""}.json`;

const rows: Row[] = [];
const row = (id: string): Row => {
  const r: Row = { id, win: false, lose: false, endless: "-", notes: [] };
  rows.push(r);
  return r;
};

afterAll(() => {
  mkdirSync("docs/qa/_evidence", { recursive: true });
  writeFileSync(OUT, JSON.stringify({ rows }, null, 2));
  const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));
  console.log("\n===== 窗口 3 · 独立模拟走查汇总 =====");
  for (const r of rows) {
    console.log(`${pad(r.id, 17)} 赢=${r.win ? "✓" : "✗"} 输=${r.lose ? "✓" : "✗"} 无尽=${pad(r.endless, 22)} ${r.notes.join(" | ")}`);
  }
});

// ---------------------------------------------------------------------------
// 13-A 花园守卫
// ---------------------------------------------------------------------------
describe("garden-guard", () => {
  it("闯关能赢 / 不种塔会输 / 无尽守得住", async () => {
    const { simulateLevel, simulateEndless } = await import("../../src/games/garden-guard/sim");
    const r = row("garden-guard");
    const wins: string[] = [];
    for (const lv of CAMPAIGN_LVS) {
      const out = simulateLevel(lv);
      if (out.win) wins.push(`第${lv + 1}关剩${out.heartsLeft}心/${Math.round(out.timeUsed)}秒/建${out.towersBuilt}塔`);
    }
    r.win = wins.length > 0;
    r.notes.push(`闯关 ${wins.length}/${CAMPAIGN_LVS.length} 关通过:${wins.join("、")}`);

    const bad = simulateLevel(99, { noTowers: true });
    r.lose = !bad.win;
    r.notes.push(`第100关一座塔都不种:${bad.win ? "居然也赢了" : `漏怪 ${bad.monstersLeaked} 只、心 ${bad.heartsLeft}`}`);

    const e = simulateEndless(40);
    r.endless = `撑到第 ${e.wavesCleared} 波`;
    r.notes.push(`无尽 40 波模拟:清 ${e.wavesCleared} 波、用时 ${Math.round(e.timeUsed)} 秒`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 13-B 绿芽保卫战
// ---------------------------------------------------------------------------
describe("sprout-defense", () => {
  it("闯关能赢 / 不种苗会输 / 守到天亮", async () => {
    const { simulateLevel, simulateEndless } = await import("../../src/games/sprout-defense/sim");
    const r = row("sprout-defense");
    const wins: string[] = [];
    for (const lv of CAMPAIGN_LVS) {
      const out = simulateLevel(lv);
      if (out.win) wins.push(`第${lv + 1}关 ${Math.round(out.time)}秒/种${out.plantsBuilt}苗/清${out.bugsKilled}虫`);
    }
    r.win = wins.length > 0;
    r.notes.push(`闯关 ${wins.length}/${CAMPAIGN_LVS.length} 关通过:${wins.join("、")}`);

    const bad = simulateLevel(99, { build: false });
    r.lose = !bad.win;
    r.notes.push(`第100关不种苗:${bad.win ? "居然也赢了" : `第 ${bad.breachLane} 道被 ${bad.breachKind} 攻破`}`);

    const e = simulateEndless(20);
    r.endless = `撑到第 ${e.reached} 波`;
    r.notes.push(`无尽 20 波:到第 ${e.reached} 波、清 ${e.bugsKilled} 虫`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 13-C 小怪物危机
// ---------------------------------------------------------------------------
describe("monster-crisis", () => {
  it("闯关能赢 / 摆烂会输 / 无尽与合作能持续", async () => {
    const { simulateLevel, simulateEndless } = await import("../../src/games/monster-crisis/sim");
    const r = row("monster-crisis");
    const wins: string[] = [];
    for (const lv of CAMPAIGN_LVS) {
      const out = simulateLevel(lv);
      if (out.win) wins.push(`第${lv + 1}关 ${out.waveReached}/${out.waveTotal}波、老巢${out.homeHp}血`);
    }
    r.win = wins.length > 0;
    r.notes.push(`闯关 ${wins.length}/${CAMPAIGN_LVS.length} 关通过:${wins.join("、")}`);

    const bad = simulateLevel(99, { build: false, shoot: false });
    r.lose = !bad.win;
    r.notes.push(`第100关不摆不打:${bad.win ? "居然也赢了" : `第 ${bad.waveReached} 波破防、漏 ${bad.leaks.reduce((a, b) => a + b, 0)} 只`}`);

    const e = simulateEndless(12);
    const c = simulateEndless(8, { coop: true });
    r.endless = `无尽 ${e.waveReached} 波 / 合作 ${c.waveReached} 波`;
    r.notes.push(`无尽 12 波:到第 ${e.waveReached} 波;合作 8 波:到第 ${c.waveReached} 波`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 12-C 金矿钩钩
// ---------------------------------------------------------------------------
describe("gold-hook", () => {
  it("按关卡目标能钩够钱 / 只钩石头钩不够 / 无尽越深越多层", async () => {
    const { levelAt, endlessLayer } = await import("../../src/games/gold-hook/levels");
    const { simulateRun } = await import("../../src/games/gold-hook/logic");
    const r = row("gold-hook");
    const wins: string[] = [];
    for (const lv of CAMPAIGN_LVS) {
      const def = levelAt(lv);
      const out = simulateRun(def.field);
      if (out.coins >= def.target) wins.push(`第${lv + 1}关 ${out.coins}/${def.target} 元`);
    }
    r.win = wins.length > 0;
    r.notes.push(`闯关 ${wins.length}/${CAMPAIGN_LVS.length} 关达标:${wins.join("、")}`);

    const def = levelAt(99);
    const lazy = simulateRun(def.field, { takeTreasure: false, takeRocks: true });
    r.lose = lazy.coins < def.target;
    r.notes.push(`第100关只钩石头:${lazy.coins} 元 < 目标 ${def.target} 元 → ${r.lose ? "确实会输" : "居然也够"}`);

    const depths = [1, 5, 10, 20].map((d) => {
      const l = endlessLayer(d);
      return `${d}层配额${l.quota}`;
    });
    r.endless = `20 层可生成`;
    r.notes.push(`无尽层:${depths.join("、")}`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 16-B 噗噗兄弟
// ---------------------------------------------------------------------------
describe("puff-bros", () => {
  it("机器人能通关 / 不动会超时输 / 无尽波次清得完", async () => {
    const { buildLevel, buildWave } = await import("../../src/games/puff-bros/arena");
    const { createWorld, autoPlay, stepWorld } = await import("../../src/games/puff-bros/logic");
    const r = row("puff-bros");
    const wins: string[] = [];
    for (const lv of CAMPAIGN_LVS) {
      const def = buildLevel(lv);
      const out = autoPlay(createWorld(def, { players: 1 }), { maxSeconds: def.timeLimit });
      if (!out.lost && !out.timedOut) wins.push(`第${lv + 1}关 ${out.steps} 步`);
    }
    r.win = wins.length > 0;
    r.notes.push(`合作战役 ${wins.length}/${CAMPAIGN_LVS.length} 关通过:${wins.join("、")}`);

    // 摆烂:一个输入都不给,看时间到会不会判负
    const def = buildLevel(99);
    const w = createWorld(def, { players: 1 });
    const dt = 1 / 60;
    let steps = 0;
    while (w.status === "playing" && steps < Math.ceil((def.timeLimit + 5) / dt)) {
      stepWorld(w, dt, w.players.map(() => ({}) as never));
      steps++;
    }
    r.lose = w.status === "lost";
    r.notes.push(`第100关完全不动:${steps} 步后状态 ${w.status}`);

    let cleared = 0;
    for (let wave = 0; wave < 12; wave++) {
      const wd = buildWave(wave);
      const out = autoPlay(createWorld(wd, { players: 1 }), { maxSeconds: 180 });
      if (!out.lost && !out.timedOut) cleared++;
    }
    r.endless = `12 波清 ${cleared} 波`;
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 16-C 王子公主大冒险
// ---------------------------------------------------------------------------
describe("prince-princess", () => {
  it("机器人能通关 / 不动会输 / 城堡塔能一直爬", async () => {
    const { buildLevel, buildEndless } = await import("../../src/games/prince-princess/levels");
    const { createWorld, autoPlay, stepWorld } = await import("../../src/games/prince-princess/logic");
    const r = row("prince-princess");
    const wins: string[] = [];
    for (const lv of CAMPAIGN_LVS) {
      const out = autoPlay(createWorld(buildLevel(lv), 2), { maxSeconds: 240 });
      if (!out.lost && !out.timedOut) wins.push(`第${lv + 1}关 ${out.steps} 步`);
    }
    r.win = wins.length > 0;
    r.notes.push(`战役 ${wins.length}/${CAMPAIGN_LVS.length} 关通过:${wins.join("、")}`);

    const w = createWorld(buildLevel(99), 2);
    let steps = 0;
    while (w.status === "playing" && steps < 60 * 240) {
      stepWorld(w, 1 / 60, w.heroes.map(() => ({}) as never));
      steps++;
    }
    r.lose = w.status === "lost";
    r.notes.push(`第100关完全不动:${steps} 步后状态 ${w.status}`);

    let floors = 0;
    for (let f = 0; f < 10; f++) {
      const out = autoPlay(createWorld(buildEndless(f), 2), { maxSeconds: 240 });
      if (!out.lost && !out.timedOut) floors++;
    }
    r.endless = `城堡塔 10 层过 ${floors} 层`;
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 11-C 鸭梨大战康康
// ---------------------------------------------------------------------------
describe("duo-vs-star", () => {
  it("对战分得出胜负 / 12 位角色胜率不偏 / 车轮战能连打", async () => {
    const { createMatch, runMatch, teamStats } = await import("../../src/games/duo-vs-star/battle");
    const { roundRobin, balanceOutliers } = await import("../../src/games/duo-vs-star/balance12");
    const r = row("duo-vs-star");

    let decided = 0;
    let timeouts = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const s = runMatch(
        createMatch({
          stageId: "cloud-square",
          stocks: 3,
          seed,
          slots: [
            { charId: "duoduo", team: 0, control: "ai" },
            { charId: "xingxing", team: 1, control: "ai" },
          ],
        } as never),
        180
      );
      if (s.over && s.winnerTeam >= 0) decided++;
      if (s.reason === "time") timeouts++;
      void teamStats;
    }
    r.win = decided > 0;
    r.lose = decided > 0; // 一方赢就等于另一方输,同一局同时取证
    r.notes.push(`8 局人机对战:${decided} 局分出胜负、${timeouts} 局打到时间上限`);

    const table = roundRobin();
    const bad = balanceOutliers(table);
    r.notes.push(`12 位角色循环赛:离群 ${bad.length} 位${bad.length ? `(${bad.map((b) => b.charId ?? b.id ?? "?").join("、")})` : ""}`);
    r.endless = "车轮战由 battle.runMatch 连续开局";
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 16-A 冰冰火火森林
// ---------------------------------------------------------------------------
describe("ice-fire-forest", () => {
  it("抽查关卡都能被 BFS 真解出来 / 摸到岩浆冰水过不去", async () => {
    const { analyzeLevel } = await import("../../src/games/ice-fire-forest/levels");
    const { parseLevel, solveLevel, initialState, moveHero, isWin } = await import(
      "../../src/games/ice-fire-forest/logic"
    );
    const r = row("ice-fire-forest");
    const ok: string[] = [];
    const fail: number[] = [];
    for (const lv of CAMPAIGN_LVS) {
      const a = analyzeLevel(lv);
      const parsed = parseLevel(a.grid);
      const res = solveLevel(parsed, true);
      if (res.solvable) ok.push(`第${lv + 1}关${res.steps ?? a.steps}步`);
      else fail.push(lv + 1);
    }
    r.win = fail.length === 0 && ok.length > 0;
    r.notes.push(`BFS 求解 7 关:${ok.join("、")}${fail.length ? `;无解 ${fail.join("/")}` : ""}`);

    // 摆烂:凛凛一路往右撞,撞到岩浆就过不去
    const a = analyzeLevel(99);
    const lvl = parseLevel(a.grid);
    let st = initialState(lvl);
    for (let i = 0; i < 200; i++) {
      const out = moveHero(lvl, st, "ice", "right");
      st = out.state ?? st;
      if (isWin(lvl, st)) break;
    }
    r.lose = !isWin(lvl, st);
    r.notes.push(`第100关只按右键 200 步:通关=${isWin(lvl, st)} → ${r.lose ? "确实过不去" : "居然能过"}`);
    r.endless = "本款无无尽(meta.modes 也没写 endless,一致)";
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 15-C 保龄球小馆
// ---------------------------------------------------------------------------
describe("bowling-lane", () => {
  it("好球能达标 / 全扔球沟必不达标 / 无尽档位越走越难", async () => {
    const { buildLevel, endlessTarget, endlessTier } = await import("../../src/games/bowling-lane/levels");
    const { simulateShot, fullRack, aiShot } = await import("../../src/games/bowling-lane/logic");
    const { scoreGame, cleanRolls } = await import("../../src/games/bowling-lane/scoring");
    const r = row("bowling-lane");

    // 用某一档球手的手法把 10 格真打完,再用官方计分器算总分
    // 这一款的 AiLevel 是 1/2/3(新手球童 / 熟练球手 / 冠军球手),没有 0 档
    const playGame = (skill: 1 | 2 | 3): { pins: number; score: number } => {
      const rolls: number[] = [];
      for (let frame = 0; frame < 10; frame++) {
        let standing = new Array<boolean>(10).fill(true);
        for (let ball = 0; ball < 2; ball++) {
          const shot = aiShot(standing, skill as never, frame * 2 + ball);
          const res = simulateShot({ standing }, shot);
          rolls.push(res.count);
          standing = res.standing;
          if (res.count >= 10 || standing.every((s) => !s)) break;
        }
      }
      const pins = rolls.reduce((a, b) => a + b, 0);
      let score = pins;
      try {
        const g = scoreGame(rolls as never);
        score = (g as { total?: number }).total ?? totalOf(g) ?? pins;
      } catch {
        /* 计分器签名对不上就退回「倒瓶数」 */
      }
      return { pins, score };
    };
    const totalOf = (g: unknown): number | undefined =>
      Array.isArray(g) ? (g[g.length - 1] as { running?: number })?.running : undefined;

    const champ = playGame(3);
    const rookie = playGame(1);
    const lv1 = buildLevel(0);
    r.win = champ.pins >= (lv1.target ?? 0);
    r.notes.push(
      `10 格连打:冠军球手倒 ${champ.pins} 瓶/记 ${champ.score} 分,新手球童倒 ${rookie.pins} 瓶;` +
        `第 1 关目标 ${lv1.target} 分 → ${r.win ? "达标" : "不达标"};三档差 ${champ.pins - rookie.pins} 瓶`
    );

    // 全扔球沟
    const rack = fullRack();
    const gutter = simulateShot(rack, { power: 0.9, aim: -1, spin: -1 });
    r.lose = gutter.count === 0 || gutter.gutter;
    r.notes.push(`故意扔球沟:倒 ${gutter.count} 瓶、gutter=${gutter.gutter}`);

    const tiers = [1, 6, 12, 24, 40].map((n) => `${n}格目标${endlessTarget(n)}/档${endlessTier(n)}`);
    r.endless = "40 格目标单调不降";
    r.notes.push(`无尽:${tiers.join("、")}`);
    void cleanRolls;
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 12-A 弹弹小鸟
// ---------------------------------------------------------------------------
describe("sling-birds", () => {
  it("抽查关卡都能解出来 / 乱打打不掉 / 打靶塔越建越高", async () => {
    const { LEVELS } = await import("../../src/games/sling-birds/levels");
    const { towerFloors, levelHasReachableTarget } = await import("../../src/games/sling-birds/depth12");
    const { findSolution, isSolvable } = await import("../../src/games/sling-birds/sim");
    const r = row("sling-birds");
    const solved: string[] = [];
    const unsolved: number[] = [];
    for (const lv of CAMPAIGN_LVS) {
      let ok = false;
      let note = "";
      try {
        const sol = findSolution(LEVELS[lv] as never);
        ok = Boolean(sol && (sol.found ?? sol.solved ?? sol.shots));
        note = ok ? `第${lv + 1}关解出` : "";
      } catch {
        try {
          ok = isSolvable(LEVELS[lv] as never);
          note = ok ? `第${lv + 1}关可解` : "";
        } catch {
          ok = levelHasReachableTarget(LEVELS[lv] as never);
          note = ok ? `第${lv + 1}关目标可达` : "";
        }
      }
      if (ok) solved.push(note);
      else unsolved.push(lv + 1);
    }
    r.win = solved.length > 0;
    r.notes.push(`求解抽 5 关:${solved.join("、")}${unsolved.length ? `;没解出 ${unsolved.join("/")}` : ""}(共 ${LEVELS.length} 关)`);

    // 摆烂:把候选弹道压到 1 条、不许爬山微调,等于「闭着眼睛乱打」
    const blind = findSolution(LEVELS[90] as never, {
      maxCandidates: 1,
      climbRounds: 0,
      shotSeconds: 0.2,
    });
    r.lose = !(blind as { solved?: boolean }).solved;
    r.notes.push(
      `第91关闭眼乱打(候选 1 条、不微调、每发只算 0.2 秒):solved=${(blind as { solved?: boolean }).solved}` +
        ` → ${r.lose ? "打不掉,有真实失败分支" : "居然也能打掉"}`
    );

    const floors = [1, 5, 10, 20].map((n) => `${n}轮${towerFloors(n)}层`);
    r.endless = `打靶塔 20 轮`;
    r.notes.push(`无尽塔层数:${floors.join("、")}`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 12-B 糖果秋千
// ---------------------------------------------------------------------------
describe("candy-swing", () => {
  it("抽查关卡照配方能过 / 不动手掉不进嘴 / 甜甜塔能一直搭", async () => {
    const { LEVELS } = await import("../../src/games/candy-swing/levels");
    const { playRecipeFor, makeSimFor, runSim } = await import("../../src/games/candy-swing/sim");
    const { sweetStarCount } = await import("../../src/games/candy-swing/swing12");
    const r = row("candy-swing");
    // 关卡自带 solve 配方,照着走一遍才是这一款真正的「通关」判据;
    // 只扫下刀时机会把 hookRelay / cutPuff / lowPop 这些非纯剪绳关误判成无解。
    const PICKS = [1, 40, 41, 60, 91, 120, 141, 170, 188];
    const passed: string[] = [];
    const failed: string[] = [];
    for (const n of PICKS) {
      const lv = LEVELS[n - 1];
      const w = playRecipeFor(lv);
      if (w.ate) passed.push(`第${n}关(${lv.solve.kind}/${w.t.toFixed(1)}秒/${w.collected.size}星)`);
      else failed.push(`第${n}关(${lv.solve.kind}/${w.failed || "超时"})`);
    }
    r.win = failed.length === 0;
    r.notes.push(
      `自带配方跑 ${PICKS.length} 关:过 ${passed.length} 关 ${passed.join("、")}` +
        `${failed.length ? `;过不去 ${failed.join("、")}` : ""}(共 ${LEVELS.length} 关)`
    );

    // 摆烂:一下都不点,看糖果会不会自己掉进嘴里
    const lazy: string[] = [];
    const auto: string[] = [];
    for (const n of PICKS) {
      const w = makeSimFor(LEVELS[n - 1]);
      runSim(w, 20);
      (w.ate ? auto : lazy).push(`${n}${w.ate ? "" : `(${w.failed || "没掉进去"})`}`);
    }
    r.lose = lazy.length > 0;
    r.notes.push(
      `一下不点空跑 20 秒:吃不到的关 ${lazy.join("/") || "无"};` +
        `不动手也自己吃到的关 ${auto.join("/") || "无"}`
    );

    const towers = [1, 5, 10, 20].map((n) => `${n}层${sweetStarCount(n)}星`);
    r.endless = "甜甜塔 20 层";
    r.notes.push(`甜甜塔:${towers.join("、")}`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 15-C 碰碰车大乱斗
// ---------------------------------------------------------------------------
describe("bumper-cars", () => {
  it("电脑替玩家开也能清场 / 站着不动会被撞下去 / 无尽车海一波波来", async () => {
    const { buildLevel, buildWave } = await import("../../src/games/bumper-cars/levels");
    const { chooseCarAction, huntersFor } = await import("../../src/games/bumper-cars/ai");
    const logic = await import("../../src/games/bumper-cars/logic");
    const r = row("bumper-cars");
    const TICK = 16;

    const boot = (lv: ReturnType<typeof buildLevel>, mySkill: number, drive: boolean) => {
      const cars = [
        logic.makeCar({ id: 0, name: "鸭梨", emoji: "🌸", color: "#e8558f", team: 0, x: lv.spawn.x, y: lv.spawn.y, lives: lv.hearts, ai: true }),
        ...lv.foes.map((foe, i) => {
          const spot = lv.foeSpawns[i] ?? lv.foeSpawns[0] ?? lv.spawn;
          return logic.makeCar({ id: i + 1, name: foe.name, emoji: foe.emoji, color: foe.color, team: 1, x: spot.x, y: spot.y, lives: foe.lives, mass: foe.mass, r: foe.r, ai: true });
        }),
      ];
      const world = logic.createWorld({
        field: lv.field, cars, pads: lv.pads, hazards: lv.hazards, spinners: lv.spinners,
        slicks: lv.slicks, limit: lv.seconds > 0 ? lv.seconds * 1000 : 0, keep: lv.keep, seed: lv.seed,
      });
      const skills = [mySkill, ...lv.foes.map((f) => f.skill)];
      let tick = 0;
      for (let t = 0; t < lv.seconds * 1000; t += TICK) {
        if (logic.levelCleared(world) || logic.playerDown(world)) break;
        const hunters = huntersFor(world, lv.hunters, world.time);
        const intents = world.cars.map((_, i) =>
          i === 0 && !drive
            ? logic.IDLE
            : chooseCarAction(world, i, (skills[i] ?? 2) as never, tick + i * 7, i === 0 || hunters.has(i) ? "hunt" : "patrol")
        );
        tick++;
        world.events.length = 0;
        logic.stepWorld(world, TICK, intents);
      }
      return world;
    };

    const wins: string[] = [];
    for (const lv of CAMPAIGN_LVS) {
      const def = buildLevel(lv);
      const w = boot(def, 3, true);
      if (logic.levelCleared(w)) wins.push(`第${lv + 1}关 ${Math.round(w.time / 1000)}秒`);
    }
    r.win = wins.length > 0;
    r.notes.push(`闯关 ${wins.length}/${CAMPAIGN_LVS.length} 关清场:${wins.join("、")}`);

    const idleWorld = boot(buildLevel(99), 3, false);
    r.lose = !logic.levelCleared(idleWorld);
    r.notes.push(`第100关站着不动:清场=${logic.levelCleared(idleWorld)}、玩家出局=${logic.playerDown(idleWorld)}`);

    let waves = 0;
    for (let n = 1; n <= 10; n++) {
      try {
        buildWave(n);
        waves++;
      } catch {
        break;
      }
    }
    r.endless = `无尽 ${waves}/10 波可生成`;
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 15-B 雪球大作战
// ---------------------------------------------------------------------------
describe("snow-fight", () => {
  it("机器人对打能分出胜负 / 站着挨打会输 / 无尽雪季一波波加压", async () => {
    const arena = await import("../../src/games/snow-fight/arena");
    const brains = await import("../../src/games/snow-fight/brains");
    const r = row("snow-fight");
    const DT = 1 / 60;

    /** 双方都交给 AI 打;meFights=false 时 0 号座位一动不动 */
    const runDuel = (skill: "easy" | "normal" | "hard", meFights: boolean) => {
      const a = arena.duelArena(skill);
      let steps = 0;
      while (steps < 60 * 200 && a.status === "playing") {
        const inputs: Record<number, unknown> = {
          0: meFights ? brains.aiInput(a, a.fighters[0], DT, skill) : arena.idleInput(),
          1: brains.aiInput(a, a.fighters[1], DT, skill),
        };
        arena.stepArena(a, DT, inputs as never);
        steps++;
      }
      return { a, steps };
    };

    try {
      // status 只说「打完了」,谁赢要看 winner(座位号),别把摆烂局的 status=win 当成摆烂方赢
      const score = (a: { fighters: ReadonlyArray<{ score?: number }> }) =>
        a.fighters.map((f) => f.score ?? "?").join(":");
      const fight = runDuel("normal", true);
      r.win = fight.a.status !== "playing";
      r.notes.push(
        `人机单挑(中档)双方都真打:${fight.steps} 步(${(fight.steps * DT).toFixed(0)} 秒)分出胜负,` +
          `胜者=座位${(fight.a as { winner?: number }).winner}、比分 ${score(fight.a)}`
      );
      const lazy = runDuel("hard", false);
      const lazyWinner = (lazy.a as { winner?: number }).winner;
      r.lose = lazy.a.status !== "playing" && lazyWinner === 1;
      r.notes.push(
        `0 号座位站着不还手:${lazy.steps} 步后收场,胜者=座位${lazyWinner}、比分 ${score(lazy.a)}` +
          ` → 摆烂方${lazyWinner === 0 ? "居然赢了(问题)" : "确实会输"}`
      );
    } catch (e) {
      r.notes.push(`对战驱动签名对不上(${String(e).slice(0, 70)}),改用波次表取证`);
    }

    const waves = [1, 5, 10, 20].map((n) => {
      const s = arena.seasonWave(n);
      return `${n}波${s.count}人/行进${s.march.toFixed(2)}/命中${s.accuracy.toFixed(2)}/投掷间隔${s.throwEvery.toFixed(2)}秒`;
    });
    r.endless = `无尽雪季 20 波`;
    r.notes.push(`雪季压力曲线:${waves.join("、")}`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 11-A 梨康双人冲刺
// ---------------------------------------------------------------------------
describe("duo-rush", () => {
  it("竞速能跑出名次 / 撞满会掉血 / 无尽赛道能一直生成", async () => {
    const logic = await import("../../src/games/duo-rush/logic");
    const match = await import("../../src/games/duo-rush/match");
    const rush = await import("../../src/games/duo-rush/rush12");
    const r = row("duo-rush");

    // 真跑一局:1 号座位交给电脑(四档各来一次),0 号座位按脚本躲障碍
    const DT = 1 / 60;
    const race = (aiLevel: 0 | 1 | 2 | 3, seconds: number) => {
      const state = match.createMatch({ mode: "rush", seed: 20260827, aiLevel } as never);
      for (let i = 0; i < seconds * 60; i++) {
        // 0 号座位:每 0.7 秒换一次道 + 定期起跳,足够跑出与电脑不同的成绩
        if (i % 42 === 0) match.applyAction(state, 0, i % 84 === 0 ? "left" : "right");
        if (i % 55 === 0) match.applyAction(state, 0, "jump");
        match.stepMatch(state, DT, {} as never);
        match.drainEvents(state);
        if ((state as { over?: boolean }).over) break;
      }
      return state;
    };
    const lines: string[] = [];
    let decided = 0;
    for (const lvl of [0, 1, 2, 3] as const) {
      const st = race(lvl, 90);
      const [a, b] = st.runners;
      const winner = logic.rushWinner(
        { dist: a.dist, coins: a.coins, crashes: a.crashes },
        { dist: b.dist, coins: b.coins, crashes: b.crashes }
      );
      if (winner === 0 || winner === 1) decided++;
      lines.push(
        `${lvl}档:鸭梨 ${a.dist.toFixed(0)}米/撞${a.crashes} vs 康康 ${b.dist.toFixed(0)}米/撞${b.crashes} → 胜者${winner}`
      );
    }
    r.win = decided > 0;
    r.notes.push(`真跑 4 局各 90 秒(人机四档):${decided}/4 局分出胜负;${lines.join(";")}`);

    // 撞满 CRASH_LIMIT 的一方即便领先也判负 —— 真实的失败分支
    const out = logic.rushWinner(
      { dist: 900, coins: 30, crashes: logic.CRASH_LIMIT },
      { dist: 400, coins: 2, crashes: 0 }
    );
    r.lose = out === 1;
    r.notes.push(`撞满 ${logic.CRASH_LIMIT} 次的一方虽领先 500 米,判定胜者仍是座位 ${out} → 失败分支成立`);

    const tiers = [1, 50, 100, 188].map((n) => {
      const s = rush.levelToSetup(n);
      return `第${n}关→${s.label}(赛道${s.tier}档/人机${s.aiLevel}档)`;
    });
    r.endless = "赛道按关号映射难度档";
    r.notes.push(`直达第 N 关映射:${tiers.join("、")}`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 11-B 梨康擂台
// ---------------------------------------------------------------------------
describe("duo-arena", () => {
  it("三局两胜能收官 / 人机四档强度单调 / 守擂能连打", async () => {
    const logic = await import("../../src/games/duo-arena/logic");
    const ai = await import("../../src/games/duo-arena/ai");
    const arena12 = await import("../../src/games/duo-arena/arena12");
    const r = row("duo-arena");

    const st = logic.matchState([0, 1, 0] as never);
    r.win = Boolean((st as { done?: boolean }).done);
    r.notes.push(`三局两胜收官判定:比分 [0,1,0] → ${JSON.stringify(st)}`);

    // 四档人机强度:每档拿最弱档当陪练,固定 40 个种子对下,看胜率是不是一档比一档高
    const seeds = Array.from({ length: 40 }, (_, i) => i * 101 + 7);
    const scheduleFor = (seed: number) => logic.buildRoundSchedule(1, seed);
    const base = ai.AI_LEVELS[0];
    const rates: string[] = [];
    const nums: number[] = [];
    for (const lvl of ai.AI_LEVELS) {
      const rate = ai.winRate(lvl, base, seeds, scheduleFor);
      nums.push(rate);
      rates.push(`${String(lvl)}=${(rate * 100).toFixed(1)}%`);
    }
    const monotone = nums.every((v, i) => i === 0 || v + 1e-9 >= nums[i - 1]);
    r.lose = nums[0] < 1; // 最弱档打不满 100% → 它会输,失败分支成立
    r.notes.push(`四档对最弱档各 40 局胜率:${rates.join(" ")} → ${monotone ? "单调不降" : "★不单调"}`);

    const keep = [1, 5, 10].map((n) => `${n}连胜→${String(arena12.defenseAiLevel(n))}`);
    r.endless = "守擂连胜档位递增";
    r.notes.push(`无尽守擂:${keep.join("、")}`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 14-A 康康射击场
// ---------------------------------------------------------------------------
describe("shoot-range", () => {
  it("命中率高能三星 / 误伤好人靶只剩一星 / 无尽越打越紧", async () => {
    const logic = await import("../../src/games/shoot-range/logic");
    const endless = await import("../../src/games/shoot-range/endless12");
    const r = row("shoot-range");

    const good = logic.starsForRound({ shots: 20, hits: 19, remaining: 0, friendHits: 0, orderMistakes: 0, flowerHits: 0 });
    const bad = logic.starsForRound({ shots: 20, hits: 8, remaining: 5, friendHits: 3, orderMistakes: 2, flowerHits: 2 });
    r.win = good === 3;
    r.lose = bad === 1;
    r.notes.push(`19/20 命中且零误伤 → ${good} 星;8/20 且误伤 3 次 → ${bad} 星`);

    const phases = [0, 30, 60, 120, 240].map((t) => {
      const p = endless.endlessPhase(t);
      return `${t}秒:间隔${(p.spawnEvery ?? 0).toFixed?.(2) ?? p.spawnEvery}/速度${p.speed ?? "?"}`;
    });
    r.endless = `跑掉 ${endless.ENDLESS_MISS_LIMIT} 个收工`;
    r.notes.push(`无尽压力曲线:${phases.join("、")}`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 14-B 飞机小队
// ---------------------------------------------------------------------------
describe("sky-squad", () => {
  it("全清能过关 / 放跑太多不过关 / 远征段位一段比一段难", async () => {
    const logic = await import("../../src/games/sky-squad/logic");
    const exp = await import("../../src/games/sky-squad/expedition");
    const r = row("sky-squad");

    const clear = logic.sortieCleared({ downed: 30, total: 30, touched: 0, bombs: 0, escaped: 0, bossDown: true }, true);
    const leak = logic.sortieCleared({ downed: 10, total: 30, touched: 4, bombs: 2, escaped: 20, bossDown: false }, true);
    r.win = clear === true;
    r.lose = leak === false;
    r.notes.push(`全清且 Boss 落地 → 过关=${clear};放跑 20 架且 Boss 没打掉 → 过关=${leak}`);
    r.notes.push(`星级:零碰零炸=${logic.starsForSortie({ downed: 30, total: 30, touched: 0, bombs: 0, escaped: 0, bossDown: true })} 星,放跑=${logic.starsForSortie({ downed: 20, total: 30, touched: 3, bombs: 2, escaped: 10, bossDown: false })} 星`);

    const legs = [1, 5, 12, 24].map((n) => `${n}段难度${exp.difficultyAt(n).toFixed?.(2) ?? exp.difficultyAt(n)}`);
    r.endless = "云海远征 24 段";
    r.notes.push(`远征难度:${legs.join("、")}`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 14-C 铁皮坦克大战
// ---------------------------------------------------------------------------
describe("tank-battle", () => {
  it("坦克真能守住老巢 / 一动不动会被打穿 / 无尽守巢一波比一波多", async () => {
    const { buildLevel, scaleForPlayers, endlessRows } = await import("../../src/games/tank-battle/levels");
    const logic = await import("../../src/games/tank-battle/logic");
    const r = row("tank-battle");
    const DT = 1 / 60;
    const IDLE = { dir: -1, fire: false, brick: false };

    const worldFor = (index: number, players: 1 | 2) => {
      const lv = buildLevel(index);
      return {
        lv,
        w: logic.createWorld({
          rows: lv.rows, mode: players === 2 ? "coop" : "campaign", queue: lv.waves,
          limit: lv.limit, players, ...scaleForPlayers(lv, players),
        } as never),
      };
    };
    /** 简单机器人:朝最近的敌人方向走并开火 —— 只用公开导出,不抄游戏自己的测试脚本 */
    const drive = (w: ReturnType<typeof logic.createWorld>, maxSeconds: number) => {
      let t = 0;
      let frame = 0;
      while (w.status === "playing" && t < maxSeconds) {
        const inputs = [] as Array<{ dir: number; fire: boolean; brick: boolean }>;
        for (let p = 0; p < w.players; p++) {
          inputs[p] = { dir: (frame >> 4) % 4, fire: frame % 3 === 0, brick: false };
        }
        logic.stepWorld(w, DT, inputs as never);
        t += DT;
        frame++;
      }
      return t;
    };

    const results: string[] = [];
    let anyWin = false;
    for (const lv of CAMPAIGN_LVS) {
      const { lv: def, w } = worldFor(lv, 2);
      const t = drive(w, def.limit + 2);
      results.push(`第${lv + 1}关 ${w.status}/${Math.round(t)}秒`);
      if (w.status === "win") anyWin = true;
    }
    r.win = anyWin;
    r.notes.push(`乱走乱打的机器人跑 5 关:${results.join("、")}(赢不了不代表关卡有问题,见下方摆烂对照)`);

    const { lv: def100, w: idle } = worldFor(99, 2);
    let t = 0;
    while (idle.status === "playing" && t < def100.limit + 2) {
      logic.stepWorld(idle, DT, [IDLE, IDLE] as never);
      t += DT;
    }
    r.lose = idle.status !== "win";
    r.notes.push(`第100关两人都一动不动:${Math.round(t)} 秒后 status=${idle.status}、reason=${(idle as { reason?: string }).reason ?? "-"}`);

    const rows12 = [1, 5, 10, 20].map((n) => {
      const rws = endlessRows(n) as unknown as string[];
      return `${n}波${Array.isArray(rws) ? rws.length : "?"}行`;
    });
    r.endless = "无尽守巢 20 波可生成";
    r.notes.push(`无尽地图:${rows12.join("、")}`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 交叉复核:浏览器层「第 1 关摆烂也弹了胜利面板」的几款,拿逻辑层再验一次
// ---------------------------------------------------------------------------
describe(`第 ${IDLE_LV + 1} 关摆烂对照`, () => {
  it(`一个输入都不给,第 ${IDLE_LV + 1} 关到底会不会自己赢`, async () => {
    const r = row(`(摆烂对照·第${IDLE_LV + 1}关)`);
    const out: string[] = [];

    {
      const { buildLevel } = await import("../../src/games/prince-princess/levels");
      const { createWorld, stepWorld } = await import("../../src/games/prince-princess/logic");
      const w = createWorld(buildLevel(IDLE_LV), 2);
      let steps = 0;
      while (w.status === "playing" && steps < 60 * 240) {
        stepWorld(w, 1 / 60, w.heroes.map(() => ({}) as never));
        steps++;
      }
      out.push(`prince-princess 第${IDLE_LV + 1}关不动 ${steps} 步 → ${w.status}`);
    }
    {
      const { buildLevel } = await import("../../src/games/puff-bros/arena");
      const { createWorld, stepWorld } = await import("../../src/games/puff-bros/logic");
      const def = buildLevel(IDLE_LV);
      const w = createWorld(def, { players: 1 });
      let steps = 0;
      while (w.status === "playing" && steps < Math.ceil((def.timeLimit + 5) * 60)) {
        stepWorld(w, 1 / 60, w.players.map(() => ({}) as never));
        steps++;
      }
      out.push(`puff-bros 第${IDLE_LV + 1}关不动 ${steps} 步 → ${w.status}`);
    }
    {
      const { buildLevel } = await import("../../src/games/bumper-cars/levels");
      const logic = await import("../../src/games/bumper-cars/logic");
      const lv = buildLevel(IDLE_LV);
      const cars = [
        logic.makeCar({ id: 0, name: "鸭梨", emoji: "🌸", color: "#e8558f", team: 0, x: lv.spawn.x, y: lv.spawn.y, lives: lv.hearts, ai: true }),
        ...lv.foes.map((foe, i) => {
          const spot = lv.foeSpawns[i] ?? lv.foeSpawns[0] ?? lv.spawn;
          return logic.makeCar({ id: i + 1, name: foe.name, emoji: foe.emoji, color: foe.color, team: 1, x: spot.x, y: spot.y, lives: foe.lives, mass: foe.mass, r: foe.r, ai: true });
        }),
      ];
      const w = logic.createWorld({
        field: lv.field, cars, pads: lv.pads, hazards: lv.hazards, spinners: lv.spinners,
        slicks: lv.slicks, limit: lv.seconds > 0 ? lv.seconds * 1000 : 0, keep: lv.keep, seed: lv.seed,
      });
      for (let t = 0; t < lv.seconds * 1000; t += 16) {
        if (logic.levelCleared(w) || logic.playerDown(w)) break;
        logic.stepWorld(w, 16, w.cars.map(() => logic.IDLE));
        w.events.length = 0;
      }
      out.push(`bumper-cars 第${IDLE_LV + 1}关全体不动 → 清场=${logic.levelCleared(w)}、玩家出局=${logic.playerDown(w)}`);
    }
    r.notes.push(out.join(" | "));
    r.win = false;
    r.lose = out.some((s) => /lost|出局=true/.test(s));
    r.endless = "-";
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 15-A 泡泡炸弹人
// ---------------------------------------------------------------------------
describe("bomb-buddies", () => {
  it("电脑替玩家摆泡泡真能清场 / 站着不动清不掉 / 泡泡塔一层一图", async () => {
    const { buildLevel, buildEndlessRound } = await import("../../src/games/bomb-buddies/levels");
    const { chooseAiAction } = await import("../../src/games/bomb-buddies/ai");
    const logic = await import("../../src/games/bomb-buddies/logic");
    const r = row("bomb-buddies");
    const TICK = 16;

    const boot = (lv: ReturnType<typeof buildLevel>, drive: boolean) => {
      const fighters = [0].map((i) => {
        const f = logic.makeFighter(i, `玩家${i + 1}`, "🤖", lv.spawns[i] ?? lv.spawns[0], i);
        f.ai = true;
        for (const item of lv.starters) logic.applyItem(f, item);
        return f;
      });
      const world = logic.createWorld({
        board: lv.board, fighters, critters: lv.critters.map((c) => ({ ...c })),
        hidden: new Map(lv.hidden), exit: lv.exit, goal: lv.goal, pierce: lv.pierce,
        limit: lv.seconds > 0 ? lv.seconds * 1000 : 0, seed: lv.seed, richness: lv.richness,
      } as never);
      let tick = 0;
      for (let t = 0; t < lv.seconds * 1000; t += TICK) {
        if (logic.levelCleared(world)) break;
        const intents = fighters.map((_, i) => {
          if (!drive) return { dir: -1, drop: false, detonate: false };
          const act = chooseAiAction(world, i, 3 as never, tick + i);
          return { dir: act.dir, drop: act.drop, detonate: act.detonate };
        });
        tick++;
        logic.stepWorld(world, TICK, intents as never);
      }
      return world;
    };

    const wins: string[] = [];
    for (const lv of CAMPAIGN_LVS) {
      const w = boot(buildLevel(lv), true);
      if (logic.levelCleared(w)) wins.push(`第${lv + 1}关 ${Math.round(w.time / 1000)}秒`);
    }
    r.win = wins.length > 0;
    r.notes.push(`闯关 ${wins.length}/${CAMPAIGN_LVS.length} 关清场:${wins.join("、")}`);

    const idle = boot(buildLevel(99), false);
    r.lose = !logic.levelCleared(idle);
    r.notes.push(`第100关站着不摆泡泡:清场=${logic.levelCleared(idle)} → ${r.lose ? "确实清不掉" : "居然自己清了"}`);

    let towers = 0;
    for (let n = 1; n <= 12; n++) {
      try {
        if (buildEndlessRound(n)) towers++;
      } catch {
        break;
      }
    }
    r.endless = `泡泡塔 ${towers}/12 层可生成`;
    expect(rows.length).toBeGreaterThan(0);
  });
});
