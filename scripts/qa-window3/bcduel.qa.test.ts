/**
 * bumper-cars · 四档强度横向战绩表(调参读数,不是产品测试)。
 *
 * 起因:S5 收尾复查的时候顺手量了一下四档单挑,读出「4 档直接对上 3 档只有 9/20」,
 * 差点当成「最强的一档打不过中间档」的阻断报上去。加大样本才发现是**噪声**——
 * 这一局是混沌的,抖动盐差一个数,同一张图能打出完全不同的过程,
 * 20 场的读数能在 45% 到 75% 之间乱跳。
 *
 * 所以这份工具做两件事:
 *  1. 出一张两百场、两个座位对半的战绩表,回答「四档到底分不分得开」;
 *  2. `BC_ABLATE=1` 时把 4 档的开关一个一个关掉,回答「它强在什么地方」。
 *
 * 跑法:npx vitest run --config scripts/qa-window3/vitest.config.ts bcduel
 *      BC_ABLATE=1 BC_SALTS=10 npx vitest ...(拆件,慢一些)
 */
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";

const TICK = 16;

describe("bumper-cars 档位战绩", () => {
  it("四档两两对打", async () => {
    const { buildArena } = await import("../../src/games/bumper-cars/levels");
    const { chooseCarAction, AI_LEVELS, TRAITS } = await import("../../src/games/bumper-cars/ai");
    const { makeCar, createWorld, stepWorld, lastTeamStanding } = await import("../../src/games/bumper-cars/logic");

    const duel = (round: number, a: number, b: number, salt: number): number => {
      const arena = buildArena(round);
      const cars = [
        makeCar({ id: 0, name: "朵朵", emoji: "🌸", color: "#e8558f", team: 0, x: arena.spawns[0].x, y: arena.spawns[0].y, lives: 1, ai: true }),
        makeCar({ id: 1, name: "星星", emoji: "⭐", color: "#3f7fd6", team: 1, x: arena.spawns[1].x, y: arena.spawns[1].y, lives: 1, ai: true }),
      ];
      const world = createWorld({
        field: arena.field, cars, pads: arena.pads, hazards: arena.hazards, spinners: arena.spinners,
        slicks: arena.slicks, limit: arena.seconds * 1000, keep: arena.keep, seed: arena.seed,
      });
      const skills = [a, b];
      for (let tick = 0; tick < (arena.seconds * 1000) / TICK; tick++) {
        if (lastTeamStanding(world) >= 0) break;
        const intents = world.cars.map((_, i) => chooseCarAction(world, i, skills[i] as never, tick + i * 7 + salt));
        world.events.length = 0;
        stepWorld(world, TICK, intents);
      }
      return lastTeamStanding(world);
    };

    const saltCount = Number(process.env.BC_SALTS ?? 20);
    const salts = Array.from({ length: saltCount }, (_, i) => i * 7);
    const total = 10 * salts.length;

    /** 只坐 0 号位:座位是不对称的,这个数里混着出生点优势 */
    const seatWins = (a: number, b: number) => {
      let n = 0;
      for (let round = 1; round <= 10; round++) for (const s of salts) if (duel(round, a, b, s) === 0) n++;
      return n;
    };
    /** 两个座位各坐一遍:这才是纯档位强度 */
    const edge = (strong: number, weak: number) => {
      let wins = 0;
      for (let round = 1; round <= 10; round++)
        for (const s of salts) {
          if (duel(round, strong, weak, s) === 0) wins++;
          if (duel(round, weak, strong, s) === 1) wins++;
        }
      return wins / (total * 2);
    };

    const table: Record<string, Record<string, number>> = {};
    console.log(`\n===== 只坐 0 号位,每格 ${total} 场,数的是「行」赢了几场 =====`);
    for (const a of AI_LEVELS) {
      table[a] = {};
      for (const b of AI_LEVELS) if (a !== b) table[a][b] = seatWins(a, b);
      console.log(`   ${a} 档 vs 1/2/3/4:  ${AI_LEVELS.map((b) => (a === b ? " ·" : String(table[a][b]).padStart(3))).join("  ")}`);
    }

    const pairs: Array<[number, number]> = [
      [2, 1],
      [3, 2],
      [4, 3],
      [3, 1],
      [4, 2],
      [4, 1],
    ];
    const edges: Record<string, number> = {};
    console.log(`\n===== 两个座位各坐一遍,每对 ${total * 2} 场 =====`);
    for (const [s, w] of pairs) {
      edges[`${s}>${w}`] = edge(s, w);
      console.log(`   ${s} 档打 ${w} 档:${(edges[`${s}>${w}`] * 100).toFixed(1)}%`);
    }

    const ablation: Record<string, { over3: number; over2: number }> = {};
    if (process.env.BC_ABLATE) {
      const base = { ...TRAITS[4] };
      console.log("\n===== 四档拆件:每次只关掉一个开关 =====");
      const read = (tag: string) => {
        ablation[tag] = { over3: seatWins(4, 3), over2: seatWins(4, 2) };
        console.log(`   ${tag.padEnd(14)} 4 打 3 ${ablation[tag].over3} · 4 打 2 ${ablation[tag].over2}`);
      };
      read("原样");
      for (const key of ["chargeUp", "corner", "flank", "dodge"] as const) {
        Object.assign(TRAITS[4], base, { [key]: false });
        read(`关掉 ${key}`);
      }
      Object.assign(TRAITS[4], base);
    }

    mkdirSync("docs/qa/_evidence", { recursive: true });
    writeFileSync(
      "docs/qa/_evidence/window3-round3-bumper-duel.json",
      JSON.stringify({ takenAt: new Date().toISOString(), gamesPerCell: total, seatTable: table, edges, ablation }, null, 2)
    );
    expect(total).toBeGreaterThanOrEqual(40);
  }, 900000);
});
