/**
 * 窗口 3 · 第 2 轮 · 「摆烂扫描」。
 *
 * 第 1 轮只在第 1 关试了一次摆烂,而且 bumper-cars 那次把对手也一起冻住了,
 * 结论下错了。这里改成真实模型:**只有玩家不动,对手照常由 AI 驱动**,
 * 并且把关号铺开扫,回答「有多少关是一下都不按也能过的」。
 *
 * 跑法:npx vitest run --config scripts/qa-window3/vitest.config.ts idle
 */
import { describe, it, expect, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";

interface Scan {
  id: string;
  scanned: number;
  autoWin: number[];
  lost: number;
  stall: number;
  note: string;
}
const scans: Scan[] = [];

afterAll(() => {
  mkdirSync("docs/qa/_evidence", { recursive: true });
  const round = process.env.QA_ROUND ?? "2";
  writeFileSync(`docs/qa/_evidence/window3-round${round}-idle.json`, JSON.stringify({ scans }, null, 2));
  console.log("\n===== 摆烂扫描(只有玩家不动,对手照常动) =====");
  for (const s of scans) {
    const pctStr = ((s.autoWin.length / s.scanned) * 100).toFixed(1);
    console.log(
      `${s.id.padEnd(17)} 扫 ${String(s.scanned).padStart(3)} 关 · 摆烂也过关 ${String(s.autoWin.length).padStart(2)} 关(${pctStr}%) · 正常判负 ${s.lost} · 僵持 ${s.stall}`
    );
    if (s.autoWin.length) console.log(`   → 关号:${s.autoWin.join(",")}`);
    if (s.note) console.log(`   → ${s.note}`);
  }
});

/** 全库 188 关,0 基下标 */
const ALL = Array.from({ length: 188 }, (_, i) => i);
/** 抽样:每 12 关一档,再补上末关 */
const SAMPLE = [...Array.from({ length: 16 }, (_, i) => i * 12), 187];

describe("摆烂扫描", () => {
  it("bumper-cars · 全 188 关", async () => {
    const L = await import("../../src/games/bumper-cars/levels");
    const A = await import("../../src/games/bumper-cars/ai");
    const logic = await import("../../src/games/bumper-cars/logic");
    const TICK = 16;
    const s: Scan = { id: "bumper-cars", scanned: 0, autoWin: [], lost: 0, stall: 0, note: "" };
    const secs: number[] = [];
    for (const i of ALL) {
      const lv = L.buildLevel(i);
      const cars = [
        logic.makeCar({ id: 0, name: "朵朵", emoji: "🌸", color: "#e8558f", team: 0, x: lv.spawn.x, y: lv.spawn.y, lives: lv.hearts, ai: true }),
        ...lv.foes.map((foe, k) => {
          const spot = lv.foeSpawns[k] ?? lv.foeSpawns[0] ?? lv.spawn;
          return logic.makeCar({ id: k + 1, name: foe.name, emoji: foe.emoji, color: foe.color, team: 1, x: spot.x, y: spot.y, lives: foe.lives, mass: foe.mass, r: foe.r, ai: true });
        }),
      ];
      const w = logic.createWorld({
        field: lv.field, cars, pads: lv.pads, hazards: lv.hazards, spinners: lv.spinners,
        slicks: lv.slicks, limit: lv.seconds > 0 ? lv.seconds * 1000 : 0, keep: lv.keep, seed: lv.seed,
      });
      const skills = [3, ...lv.foes.map((f) => f.skill)];
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
      }
      s.scanned++;
      if (logic.levelCleared(w)) {
        s.autoWin.push(i + 1);
        secs.push(Math.round(ms / 1000));
      } else if (logic.playerDown(w)) s.lost++;
      else s.stall++;
    }
    s.note = secs.length
      ? `这些关平均 ${Math.round(secs.reduce((a, b) => a + b, 0) / secs.length)} 秒就结束(最快 ${Math.min(...secs)} 秒),是对手自己冲下悬崖`
      : "";
    scans.push(s);
    expect(s.scanned).toBe(188);
  });

  it("prince-princess · 抽 17 关", async () => {
    const { buildLevel } = await import("../../src/games/prince-princess/levels");
    const { createWorld, stepWorld } = await import("../../src/games/prince-princess/logic");
    const s: Scan = { id: "prince-princess", scanned: 0, autoWin: [], lost: 0, stall: 0, note: "" };
    for (const i of SAMPLE) {
      const w = createWorld(buildLevel(i), 2);
      let steps = 0;
      while (w.status === "playing" && steps < 60 * 300) {
        stepWorld(w, 1 / 60, w.heroes.map(() => ({}) as never));
        steps++;
      }
      s.scanned++;
      if (w.status === "won") s.autoWin.push(i + 1);
      else if (w.status === "lost") s.lost++;
      else s.stall++;
    }
    scans.push(s);
    expect(s.scanned).toBeGreaterThan(0);
  });

  it("puff-bros · 抽 17 关", async () => {
    const { buildLevel } = await import("../../src/games/puff-bros/arena");
    const { createWorld, stepWorld } = await import("../../src/games/puff-bros/logic");
    const s: Scan = { id: "puff-bros", scanned: 0, autoWin: [], lost: 0, stall: 0, note: "" };
    for (const i of SAMPLE) {
      const def = buildLevel(i);
      const w = createWorld(def, { players: 1 });
      let steps = 0;
      while (w.status === "playing" && steps < Math.ceil((def.timeLimit + 10) * 60)) {
        stepWorld(w, 1 / 60, w.players.map(() => ({}) as never));
        steps++;
      }
      s.scanned++;
      if (w.status === "won") s.autoWin.push(i + 1);
      else if (w.status === "lost") s.lost++;
      else s.stall++;
    }
    scans.push(s);
    expect(s.scanned).toBeGreaterThan(0);
  });

  it("bomb-buddies · 抽 17 关", async () => {
    const { buildLevel } = await import("../../src/games/bomb-buddies/levels");
    const logic = await import("../../src/games/bomb-buddies/logic");
    const { chooseAiAction } = await import("../../src/games/bomb-buddies/ai");
    const s: Scan = { id: "bomb-buddies", scanned: 0, autoWin: [], lost: 0, stall: 0, note: "" };
    const TICK = 16;
    for (const i of SAMPLE) {
      const lv = buildLevel(i, 1);
      const fighters = [0].map((k) => {
        const f = logic.makeFighter(k, `玩家${k + 1}`, "🤖", lv.spawns[k] ?? lv.spawns[0], k);
        f.ai = true;
        for (const item of lv.starters) logic.applyItem(f, item);
        return f;
      });
      const w = logic.createWorld({
        board: lv.board, fighters, critters: lv.critters.map((c) => ({ ...c })),
        hidden: new Map(lv.hidden), exit: lv.exit, goal: lv.goal, pierce: lv.pierce,
        limit: lv.seconds > 0 ? lv.seconds * 1000 : 0, seed: lv.seed, richness: lv.richness,
      } as never);
      for (let t = 0; t < lv.seconds * 1000; t += TICK) {
        if (logic.levelCleared(w)) break;
        logic.stepWorld(w, TICK, fighters.map(() => ({ dir: -1, drop: false, detonate: false })) as never);
      }
      s.scanned++;
      if (logic.levelCleared(w)) s.autoWin.push(i + 1);
      else s.lost++;
    }
    void chooseAiAction;
    scans.push(s);
    expect(s.scanned).toBeGreaterThan(0);
  });

  it("garden-guard · 抽 17 关(一座塔都不种)", async () => {
    const { simulateLevel } = await import("../../src/games/garden-guard/sim");
    const s: Scan = { id: "garden-guard", scanned: 0, autoWin: [], lost: 0, stall: 0, note: "" };
    for (const i of SAMPLE) {
      const out = simulateLevel(i, { noTowers: true });
      s.scanned++;
      if (out.win) s.autoWin.push(i + 1);
      else s.lost++;
    }
    scans.push(s);
    expect(s.scanned).toBeGreaterThan(0);
  });

  it("sprout-defense · 抽 17 关(一株苗都不种)", async () => {
    const { simulateLevel } = await import("../../src/games/sprout-defense/sim");
    const s: Scan = { id: "sprout-defense", scanned: 0, autoWin: [], lost: 0, stall: 0, note: "" };
    for (const i of SAMPLE) {
      const out = simulateLevel(i, { build: false });
      s.scanned++;
      if (out.win) s.autoWin.push(i + 1);
      else s.lost++;
    }
    scans.push(s);
    expect(s.scanned).toBeGreaterThan(0);
  });

  it("monster-crisis · 抽 17 关(不摆不打)", async () => {
    const { simulateLevel } = await import("../../src/games/monster-crisis/sim");
    const s: Scan = { id: "monster-crisis", scanned: 0, autoWin: [], lost: 0, stall: 0, note: "" };
    for (const i of SAMPLE) {
      const out = simulateLevel(i, { build: false, shoot: false });
      s.scanned++;
      if (out.win) s.autoWin.push(i + 1);
      else s.lost++;
    }
    scans.push(s);
    expect(s.scanned).toBeGreaterThan(0);
  });

  it("gold-hook · 抽 17 关(只钩石头,不钩金子)", async () => {
    const { levelAt } = await import("../../src/games/gold-hook/levels");
    const { simulateRun } = await import("../../src/games/gold-hook/logic");
    const s: Scan = { id: "gold-hook", scanned: 0, autoWin: [], lost: 0, stall: 0, note: "" };
    for (const i of SAMPLE) {
      const def = levelAt(i);
      const out = simulateRun(def.field, { takeTreasure: false, takeRocks: true });
      s.scanned++;
      if (out.coins >= def.target) s.autoWin.push(i + 1);
      else s.lost++;
    }
    s.note = "这一款没有「完全不动」的模拟口子,用「只钩石头」当摆烂近似";
    scans.push(s);
    expect(s.scanned).toBeGreaterThan(0);
  });

  it("tank-battle · 抽 17 关(两个人都一动不动)", async () => {
    const { buildLevel, scaleForPlayers } = await import("../../src/games/tank-battle/levels");
    const logic = await import("../../src/games/tank-battle/logic");
    const s: Scan = { id: "tank-battle", scanned: 0, autoWin: [], lost: 0, stall: 0, note: "" };
    const IDLE = { dir: -1, fire: false, brick: false };
    for (const i of SAMPLE) {
      const lv = buildLevel(i);
      const w = logic.createWorld({
        rows: lv.rows, mode: "campaign", queue: lv.waves,
        limit: lv.limit, players: 1, ...scaleForPlayers(lv, 1),
      } as never);
      const DT = 1 / 60;
      let t = 0;
      while (w.status === "playing" && t < lv.limit + 5) {
        logic.stepWorld(w, DT, [IDLE] as never);
        t += DT;
      }
      s.scanned++;
      if (w.status === "win") s.autoWin.push(i + 1);
      else if (w.status === "lose") s.lost++;
      else s.stall++;
    }
    scans.push(s);
    expect(s.scanned).toBeGreaterThan(0);
  });

  it("duo-vs-star · 全 188 关(玩家一个键都不按,对手照常打)", async () => {
    const { createMatch, runMatch } = await import("../../src/games/duo-vs-star/battle");
    const { levelAt, CHAPTERS } = await import("../../src/games/duo-vs-star/levels");
    const s: Scan = { id: "duo-vs-star", scanned: 0, autoWin: [], lost: 0, stall: 0, note: "" };
    const byTimeout: number[] = [];
    for (let i = 0; i < 188; i++) {
      // 完全照 index.ts playLevel 的配法搭局:关号 0 基、seed 同式、对手带档位/打法/力气/命数
      const lv = levelAt(i);
      const slots: unknown[] = [{ charId: "duoduo", team: 0, control: "p1", stocks: lv.playerStocks }];
      for (const ally of lv.allies) {
        slots.push({
          charId: ally.charId, team: 0, control: "ai",
          aiTier: ally.tier, stocks: ally.stocks ?? lv.playerStocks,
        });
      }
      lv.foes.forEach((foe, fi: number) => {
        slots.push({
          charId: foe.charId, team: lv.allies.length > 0 ? 1 : 1 + fi, control: "ai",
          aiTier: foe.tier, aiStyle: foe.style, powerBonus: foe.powerBonus, stocks: foe.stocks,
        });
      });
      // p1 槽位全程不喂输入 = 一个键都不按
      const m = runMatch(
        createMatch({
          stageId: lv.stageId, slots, stocks: lv.playerStocks, timeLimit: lv.timeLimit,
          itemEvery: lv.itemEvery, itemPool: lv.itemPool, seed: (i + 1) * 7919,
        } as never),
        (lv.timeLimit > 0 ? lv.timeLimit : 150) + 5
      );
      s.scanned++;
      if (m.winnerTeam === 0) {
        s.autoWin.push(i + 1);
        if (m.endReason === "time") byTimeout.push(i + 1);
      } else if (m.winnerTeam === null) s.stall++;
      else s.lost++;
    }
    if (s.autoWin.length > 0) {
      let base = 0;
      const perChapter = CHAPTERS.map((ch) => {
        const hit = s.autoWin.filter((n) => n > base && n <= base + ch.size).length;
        const line = `${levelAt(base).stageId} 第${base + 1}-${base + ch.size}关 ${hit}/${ch.size}`;
        base += ch.size;
        return line;
      }).join("、");
      s.note =
        `靠时间到判赢 ${byTimeout.length} 关、靠对手自己掉下去 ${s.autoWin.length - byTimeout.length} 关;` +
        `按章节分布:${perChapter}`;
    }
    scans.push(s);
    expect(s.scanned).toBeGreaterThan(0);
  });

  it("candy-swing · 全 188 关(不点任何一下,空跑 20 秒)", async () => {
    const { LEVELS } = await import("../../src/games/candy-swing/levels");
    const { makeSimFor, runSim } = await import("../../src/games/candy-swing/sim");
    const s: Scan = { id: "candy-swing", scanned: 0, autoWin: [], lost: 0, stall: 0, note: "" };
    for (let i = 0; i < LEVELS.length; i++) {
      const w = makeSimFor(LEVELS[i]);
      runSim(w, 20);
      s.scanned++;
      if (w.ate) s.autoWin.push(i + 1);
      else if (w.failed) s.lost++;
      else s.stall++;
    }
    // solve.kind = "wait" 的关本来就是「等场上机关自己动」,不点也过属于设计;
    // 其余 kind(cut / cutPuff / hookRelay / lowPop / search)都要求玩家动手,不点也过就对不上设计意图。
    const byKind = new Map<string, number[]>();
    for (const n of s.autoWin) {
      const k = String((LEVELS[n - 1] as { solve: { kind: string } }).solve.kind);
      byKind.set(k, [...(byKind.get(k) ?? []), n]);
    }
    const design = byKind.get("wait") ?? [];
    const offSpec = s.autoWin.filter((n) => !design.includes(n));
    s.note =
      `按 solve.kind 拆:${[...byKind].map(([k, v]) => `${k}=${v.length}关(${v.join("/")})`).join("、")};` +
      `其中 wait 是设计如此 ${design.length} 关,剩下 ${offSpec.length} 关要玩家动手却不动也过`;
    scans.push(s);
    expect(s.scanned).toBe(188);
  });
});
