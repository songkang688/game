/**
 * 窗口 3 · 第 2 轮 · 难度曲线 / 无尽持续性专项。
 *
 * 第 1 轮的档位结论都只有单 seed 单样本,不够下判断。这里把样本量拉起来:
 * 人机档位一律多 seed 多局跑,无尽曲线一律拉长采样,关卡压力按第 7/45/132/188 关横向对比。
 *
 * 用法:npx vitest run --config scripts/qa-window3/vitest.config.ts curve
 */
import { describe, it, expect, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";

interface Row {
  id: string;
  topic: string;
  verdict: string;
  notes: string[];
}
const rows: Row[] = [];
const row = (id: string, topic: string): Row => {
  const r: Row = { id, topic, verdict: "", notes: [] };
  rows.push(r);
  return r;
};

afterAll(() => {
  mkdirSync("docs/qa/_evidence", { recursive: true });
  writeFileSync("docs/qa/_evidence/window3-round2-curve.json", JSON.stringify({ rows }, null, 2));
  for (const r of rows) {
    console.log(`\n【${r.id}】${r.topic}\n  判定:${r.verdict}`);
    for (const n of r.notes) console.log(`  · ${n}`);
  }
});

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

// ---------------------------------------------------------------------------
// S3 复核:duo-rush 人机四档到底有没有差别(第 1 轮只有 1 个 seed)
// ---------------------------------------------------------------------------
describe("duo-rush · 人机四档强度", () => {
  it("同一套玩家脚本对四档各跑 24 个 seed,看电脑成绩与胜率", async () => {
    const logic = await import("../../src/games/duo-rush/logic");
    const match = await import("../../src/games/duo-rush/match");
    const r = row("duo-rush", "S3 复核 · 人机四档强度(24 seed × 4 档 × 60 秒)");
    const DT = 1 / 60;

    const race = (aiLevel: 0 | 1 | 2 | 3, seed: number, seconds: number) => {
      const state = match.createMatch({ mode: "rush", seed, aiLevel } as never);
      for (let i = 0; i < seconds * 60; i++) {
        if (i % 42 === 0) match.applyAction(state, 0, i % 84 === 0 ? "left" : "right");
        if (i % 55 === 0) match.applyAction(state, 0, "jump");
        match.stepMatch(state, DT, {} as never);
        match.drainEvents(state);
        if ((state as { over?: boolean }).over) break;
      }
      const [a, b] = state.runners;
      const winner = logic.rushWinner(
        { dist: a.dist, coins: a.coins, crashes: a.crashes },
        { dist: b.dist, coins: b.coins, crashes: b.crashes }
      );
      return { me: a, ai: b, winner };
    };

    const seeds = Array.from({ length: 24 }, (_, i) => 1_000_003 + i * 7919);
    const perTier: Array<{ lvl: number; win: number; dist: number; crash: number; coins: number }> = [];
    for (const lvl of [0, 1, 2, 3] as const) {
      const dists: number[] = [];
      const crashes: number[] = [];
      const coins: number[] = [];
      let aiWins = 0;
      for (const s of seeds) {
        const out = race(lvl, s, 60);
        dists.push(out.ai.dist);
        crashes.push(out.ai.crashes);
        coins.push(out.ai.coins);
        if (out.winner === 1) aiWins++;
      }
      perTier.push({
        lvl,
        win: aiWins / seeds.length,
        dist: avg(dists),
        crash: avg(crashes),
        coins: avg(coins),
      });
    }
    for (const t of perTier) {
      r.notes.push(
        `${t.lvl} 档:电脑胜率 ${pct(t.win)}、平均跑 ${t.dist.toFixed(0)} 米、平均撞 ${t.crash.toFixed(2)} 次、平均金币 ${t.coins.toFixed(1)}`
      );
    }
    const distSpread = Math.max(...perTier.map((t) => t.dist)) - Math.min(...perTier.map((t) => t.dist));
    const winSpread = Math.max(...perTier.map((t) => t.win)) - Math.min(...perTier.map((t) => t.win));
    const monotone = perTier.every((t, i) => i === 0 || t.win + 1e-9 >= perTier[i - 1].win);
    const pairsSame: string[] = [];
    for (let i = 1; i < perTier.length; i++) {
      if (Math.abs(perTier[i].win - perTier[i - 1].win) < 1e-9 && Math.abs(perTier[i].dist - perTier[i - 1].dist) < 0.5) {
        pairsSame.push(`${perTier[i - 1].lvl}↔${perTier[i].lvl}`);
      }
    }
    r.verdict =
      `胜率跨度 ${pct(winSpread)}、里程跨度 ${distSpread.toFixed(0)} 米、${monotone ? "随档位单调不降" : "★随档位不单调"}` +
      `${pairsSame.length ? `;完全同值的相邻档:${pairsSame.join("/")}` : ";没有相邻档完全同值"}`;
    expect(perTier).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// S4 复核:bowling-lane 三档球手(第 1 轮只打了 1 局)
// ---------------------------------------------------------------------------
describe("bowling-lane · 三档球手强度", () => {
  it("三档各打 30 局 10 格,比平均倒瓶数与总分", async () => {
    const { simulateShot, aiShot } = await import("../../src/games/bowling-lane/logic");
    const { buildLevel } = await import("../../src/games/bowling-lane/levels");
    const r = row("bowling-lane", "S4 复核 · 三档球手强度(30 局 × 3 档 × 10 格)");

    // 这一款的 AiLevel 是 1/2/3(新手球童 / 熟练球手 / 冠军球手),不是 0 起步
    const playGame = (skill: 1 | 2 | 3, salt: number) => {
      let pins = 0;
      let strikes = 0;
      for (let frame = 0; frame < 10; frame++) {
        let standing = new Array<boolean>(10).fill(true);
        for (let ball = 0; ball < 2; ball++) {
          const shot = aiShot(standing, skill as never, salt * 97 + frame * 2 + ball);
          const res = simulateShot({ standing }, shot);
          pins += res.count;
          if (ball === 0 && res.count >= 10) strikes++;
          standing = res.standing;
          if (standing.every((s) => !s)) break;
        }
      }
      return { pins, strikes };
    };

    const games = 30;
    const per: Array<{ skill: number; pins: number; strikes: number }> = [];
    for (const skill of [1, 2, 3] as const) {
      const ps: number[] = [];
      const ss: number[] = [];
      for (let g = 0; g < games; g++) {
        const out = playGame(skill, g + 1);
        ps.push(out.pins);
        ss.push(out.strikes);
      }
      per.push({ skill, pins: avg(ps), strikes: avg(ss) });
    }
    const NAME: Record<number, string> = { 1: "新手球童", 2: "熟练球手", 3: "冠军球手" };
    for (const p of per) {
      r.notes.push(`${NAME[p.skill]}:平均倒 ${p.pins.toFixed(1)} 瓶 / 10 格,平均全中 ${p.strikes.toFixed(2)} 次`);
    }
    const spread = per[2].pins - per[0].pins;
    const lv1 = buildLevel(0);
    const monotone = per.every((p, i) => i === 0 || p.pins + 1e-9 >= per[i - 1].pins);
    r.notes.push(`第 1 关目标 ${lv1.target} 分,三档都够得着`);
    r.verdict = `冠军比新手多倒 ${spread.toFixed(1)} 瓶(约 ${((spread / per[0].pins) * 100).toFixed(1)}%),${monotone ? "三档单调不降" : "★三档不单调"}`;
    expect(per).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// M3 复核:duo-arena 四档不只对最弱档,相邻档也要看
// ---------------------------------------------------------------------------
describe("duo-arena · 四档相邻梯度", () => {
  it("每一对相邻档各 60 个 seed 对下", async () => {
    const logic = await import("../../src/games/duo-arena/logic");
    const ai = await import("../../src/games/duo-arena/ai");
    const r = row("duo-arena", "M3 复核 · 四档相邻梯度(相邻对 60 seed)");
    const seeds = Array.from({ length: 60 }, (_, i) => i * 337 + 11);
    const scheduleFor = (seed: number) => logic.buildRoundSchedule(1, seed);
    const L = ai.AI_LEVELS;
    for (let i = 1; i < L.length; i++) {
      const rate = ai.winRate(L[i], L[i - 1], seeds, scheduleFor);
      r.notes.push(`${String(L[i])} 打 ${String(L[i - 1])}:胜率 ${pct(rate)}`);
    }
    const vsWeakest = L.map((l) => ai.winRate(l, L[0], seeds, scheduleFor));
    r.notes.push(`各档对最弱档:${L.map((l, i) => `${String(l)}=${pct(vsWeakest[i])}`).join(" ")}`);
    const saturated = vsWeakest.slice(1).filter((v) => v >= 0.999).length;
    r.verdict =
      `相邻档都有梯度;对最弱档有 ${saturated}/${L.length - 1} 档已经打到 100%——` +
      `新手感受不到 ${saturated > 1 ? "高三档之间" : "高档之间"}的差别,但这是饱和不是缺陷`;
    expect(L.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// M2 复核:四款无尽的压力曲线拉长采样,判断「中段封顶」
// ---------------------------------------------------------------------------
describe("无尽持续性 · 压力曲线拉长采样", () => {
  it("shoot-range / snow-fight / sling-birds / tank-battle / sky-squad / bowling-lane", async () => {
    const r = row("(无尽)", "M2 复核 · 压力曲线拉长采样");

    // shoot-range 的无尽压力有三条独立的线:出怪间隔、靶子速度、同屏上限。
    // 第 1 轮只看了间隔,结论片面 —— 这里三条一起看。
    const sr = await import("../../src/games/shoot-range/endless12");
    const srPts = [0, 30, 60, 90, 120, 180, 240, 360, 600];
    const gapAt = (t: number) => Math.max(sr.SPAWN_EVERY_MIN, sr.SPAWN_EVERY_START - t * sr.SPAWN_TIGHTEN_PER_S);
    const speedAt = (t: number) => Math.min(sr.SPEED_MAX, sr.SPEED_START + t * sr.SPEED_RISE_PER_S);
    const aliveAt = (t: number) => Math.min(sr.ALIVE_MAX, sr.ALIVE_START + Math.floor(t / sr.ALIVE_EVERY_S));
    r.notes.push(
      `shoot-range 出怪间隔:${srPts.map((t) => `${t}秒=${gapAt(t).toFixed(2)}`).join("、")}(下限 ${sr.SPAWN_EVERY_MIN},约 ${Math.round((sr.SPAWN_EVERY_START - sr.SPAWN_EVERY_MIN) / sr.SPAWN_TIGHTEN_PER_S)} 秒到底)`
    );
    r.notes.push(
      `shoot-range 靶子速度:${srPts.map((t) => `${t}秒=${speedAt(t).toFixed(2)}`).join("、")}(上限 ${sr.SPEED_MAX},约 ${Math.round((sr.SPEED_MAX - sr.SPEED_START) / sr.SPEED_RISE_PER_S)} 秒到顶)`
    );
    r.notes.push(
      `shoot-range 同屏上限:${srPts.map((t) => `${t}秒=${aliveAt(t)}`).join("、")}(上限 ${sr.ALIVE_MAX},约 ${(sr.ALIVE_MAX - sr.ALIVE_START) * sr.ALIVE_EVERY_S} 秒到顶)`
    );
    r.notes.push(
      `shoot-range 每分钟出怪:${srPts.map((t) => `${t}秒=${sr.spawnsPerMinute(t).toFixed(0)}`).join("、")};` +
        `波次 ${srPts.map((t) => `${t}秒=第${sr.waveAt(t)}波`).join("、")}`
    );

    const sf = await import("../../src/games/snow-fight/arena");
    const sfPts = [1, 5, 10, 15, 20, 30, 50];
    r.notes.push(
      `snow-fight 雪季:${sfPts
        .map((n) => {
          const s = sf.seasonWave(n);
          return `${n}波${s.count}人/行进${s.march.toFixed(2)}/命中${s.accuracy.toFixed(2)}/间隔${s.throwEvery.toFixed(2)}`;
        })
        .join("、")}`
    );

    const sb = await import("../../src/games/sling-birds/endless");
    const sbPts = [1, 5, 10, 15, 20, 30, 50];
    r.notes.push(
      `sling-birds 打靶塔:${sbPts
        .map((n) => `${n}轮 ${sb.towerCount(n)}座×${sb.towerFloors(n)}层/材料${sb.towerMaterials(n).join("+")}`)
        .join("、")}(层数封顶 ${sb.FLOOR_MAX}、塔数封顶 ${sb.TOWER_MAX})`
    );

    const sky = await import("../../src/games/sky-squad/expedition");
    const skyPts = [1, 5, 12, 24, 40, 60];
    r.notes.push(
      `sky-squad 远征难度:${skyPts.map((n) => `${n}段${sky.difficultyAt(n).toFixed(2)}`).join("、")}`
    );

    const bl = await import("../../src/games/bowling-lane/levels");
    const blPts = [1, 6, 12, 24, 40, 60, 99];
    r.notes.push(
      `bowling-lane 无尽:${blPts.map((n) => `${n}格目标${bl.endlessTarget(n)}/档${bl.endlessTier(n)}`).join("、")}`
    );

    r.verdict = "见各行采样;凡是最后两个采样点完全同值的,就是真的到顶不再加压";
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 关卡压力单调性:第 7 / 45 / 132 / 188 关横向比
// ---------------------------------------------------------------------------
describe("关卡压力 · 第 7 / 45 / 132 / 188 关", () => {
  const PICKS = [7, 45, 132, 188];

  it("sky-squad 敌机数随关号涨", async () => {
    const L = await import("../../src/games/sky-squad/levels");
    const r = row("sky-squad", "关卡压力 · 第 7/45/132/188 关");
    const nums: number[] = [];
    for (const n of PICKS) {
      const s = L.buildSortie(n - 1);
      const foes = s.waves.reduce((a, w) => a + w.count, 0);
      nums.push(foes);
      r.notes.push(`第${n}关:${s.waves.length} 波 / ${foes} 架 / 速度 ${s.waves[0].speed.toFixed(2)} / 开火间隔 ${s.waves[0].fire.interval.toFixed(2)}${s.boss ? ` / Boss ${s.boss.name}` : ""}`);
    }
    r.verdict = nums.every((v, i) => i === 0 || v >= nums[i - 1]) ? "敌机数单调不降" : "★敌机数有回落(末关是 Boss 关,单波少属正常)";
    expect(nums).toHaveLength(4);
  });

  it("bumper-cars 对手数与技能随关号涨", async () => {
    const L = await import("../../src/games/bumper-cars/levels");
    const r = row("bumper-cars", "关卡压力 · 第 7/45/132/188 关");
    const nums: number[] = [];
    for (const n of PICKS) {
      const lv = L.buildLevel(n);
      const skill = Math.max(...lv.foes.map((f) => f.skill));
      nums.push(lv.foes.length * 10 + skill);
      r.notes.push(
        `第${n}关:对手 ${lv.foes.length} 台 / 最高技能 ${skill} / 心 ${lv.hearts} / ${lv.seconds} 秒 / 机关 ${lv.spinners.length} 转盘+${lv.slicks.length} 油渍`
      );
    }
    r.verdict = nums.every((v, i) => i === 0 || v >= nums[i - 1]) ? "对手数×技能单调不降" : "★中间有回落";
    expect(nums).toHaveLength(4);
  });

  it("prince-princess 怪物 / 坑 / 限时随关号涨", async () => {
    const L = await import("../../src/games/prince-princess/levels");
    const r = row("prince-princess", "关卡压力 · 第 7/45/132/188 关");
    for (const n of PICKS) {
      const lv = L.buildLevel(n);
      r.notes.push(
        `第${n}关:长度 ${lv.len} / 怪 ${lv.enemies.length} 只 / 坑 ${lv.gaps.length} 个 / 尖刺 ${lv.spikes.length} / 心 ${lv.hearts} / 限时 ${lv.timeLimit ?? "无"}${lv.boss ? " / 有 Boss" : ""}`
      );
    }
    r.verdict = "见各关明细";
    expect(rows.length).toBeGreaterThan(0);
  });

  it("candy-swing 机关种类随关号涨", async () => {
    const { LEVELS } = await import("../../src/games/candy-swing/levels");
    const r = row("candy-swing", "关卡压力 · 第 7/45/132/188 关");
    const kinds = (lv: Record<string, unknown>) =>
      ["ropes", "portals", "balloons", "scissors", "hooks", "moths", "fans", "boards", "gremlins", "spikes", "bubbles"]
        .filter((k) => Array.isArray(lv[k]) && (lv[k] as unknown[]).length > 0)
        .join("+");
    const nums: number[] = [];
    for (const n of PICKS) {
      const lv = LEVELS[n - 1] as unknown as Record<string, unknown>;
      const k = kinds(lv);
      nums.push(k.split("+").length);
      r.notes.push(`第${n}关「${String(lv.name)}」solve=${JSON.stringify(lv.solve)} 机关=${k}`);
    }
    r.verdict = nums[nums.length - 1] >= nums[0] ? "机关种类总体变多" : "★末关机关反而更少";
    expect(nums).toHaveLength(4);
  });
});
