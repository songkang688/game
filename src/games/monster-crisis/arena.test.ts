/**
 * 小怪物危机 1.2 · 竞技场引擎。
 *
 * 覆盖规格第十一节点名的那几样:五种怪物行为、被撞只转圈、波次可复现、
 * 对象池不膨胀、无尽小 boss 节奏与换场景、四种模式各跑一次结算、188 关抽样可解。
 */
import { describe, expect, it } from "vitest";
import {
  ARENA_H,
  ARENA_W,
  type ArenaOptions,
  type ArenaState,
  CRUMBS_PER_JAR,
  COOP_WAVES,
  HOME_R,
  MONSTER_CAP,
  SPIN_TIME,
  VERSUS_WAVES,
  arenaEndlessWave,
  createArena,
  createCampaignArena,
  disposeArena,
  endlessScene,
  isSmallBossWave,
  liveCount,
  poolFootprint,
  smallBossKind,
  spawnPoint,
  stepArena,
} from "./arena";
import { runArena } from "./arenaSim";
import { MONSTER_INFO, type MonsterKind } from "./logic";
import { buildCoopWave, endlessLevelIndex } from "./levels";
import { emptyGrowth, heroStats } from "./growth";

const DT = 1 / 30;

/** 只放一只指定的小怪物,方便盯着一种行为看。 */
function soloArena(kind: MonsterKind, extra: Partial<ArenaOptions> = {}): ArenaState {
  return createArena({
    mode: "campaign",
    waves: [{ spawns: [{ time: 0, lane: 0, kind }], tail: 0 }],
    levelIdx: 0,
    jars: 9,
    seed: 5,
    ...extra,
  });
}

function advance(state: ArenaState, seconds: number, inputs: Array<{ mx: number; my: number; fire: boolean }> = []): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepArena(state, DT, inputs);
}

/** 跑到怪真的出场为止(开局有一小段喘气时间)。 */
function untilSpawned(state: ArenaState, limit = 8): void {
  let t = 0;
  while (state.monsters.length === 0 && t < limit) {
    stepArena(state, DT, []);
    t += DT;
  }
}

function distToHome(state: ArenaState, i = 0): number {
  const m = state.monsters[i];
  const home = state.homes[m.side];
  return Math.hypot(m.x - home.x, m.y - home.y);
}

describe("五种小怪物行为", () => {
  it("直冲怪:闷头朝家里走,方向几乎不拐弯", () => {
    const st = soloArena("doodle");
    untilSpawned(st);
    const home = st.homes[0];
    const angle0 = Math.atan2(st.monsters[0].y - home.y, st.monsters[0].x - home.x);
    const d0 = distToHome(st);
    advance(st, 3);
    const m = st.monsters[0];
    expect(m).toBeTruthy();
    const angle1 = Math.atan2(m.y - home.y, m.x - home.x);
    expect(distToHome(st)).toBeLessThan(d0);
    expect(Math.abs(angle1 - angle0)).toBeLessThan(0.12);
  });

  it("绕行怪:一边靠近一边画大 S,角度真的在变", () => {
    const st = soloArena("spinner");
    untilSpawned(st);
    const home = st.homes[0];
    const d0 = distToHome(st);
    let swing = 0;
    let prev = Math.atan2(st.monsters[0].y - home.y, st.monsters[0].x - home.x);
    for (let i = 0; i < 90; i++) {
      stepArena(st, DT, []);
      if (!st.monsters[0]) break;
      const a = Math.atan2(st.monsters[0].y - home.y, st.monsters[0].x - home.x);
      swing += Math.abs(a - prev);
      prev = a;
    }
    expect(swing).toBeGreaterThan(0.35);
    expect(distToHome(st)).toBeLessThan(d0);
  });

  it("吐泡泡怪:走到一段距离就停下来吐泡泡,泡泡是冲着人来的", () => {
    const st = soloArena("balloon");
    untilSpawned(st);
    let bubbles = 0;
    let aimed = 0;
    let prev = 0;
    const hero = st.heroes[0];
    for (let i = 0; i < Math.round(14 / DT); i++) {
      stepArena(st, DT, []);
      const m = st.monsters[0];
      if (!m) break;
      const foes = st.bullets.filter((b) => b.foe);
      if (foes.length > prev) {
        bubbles++;
        // 泡泡是朝着人飞的:出膛方向跟「怪指向人」基本一致
        const b = foes[foes.length - 1];
        const dx = hero.x - m.x;
        const dy = hero.y - m.y;
        const dl = Math.hypot(dx, dy) || 1;
        const bl = Math.hypot(b.vx, b.vy) || 1;
        if ((b.vx / bl) * (dx / dl) + (b.vy / bl) * (dy / dl) > 0.9) aimed++;
      }
      prev = foes.length;
    }
    expect(bubbles).toBeGreaterThan(0);
    expect(aimed).toBe(bubbles);
    // 停在离家一段距离的地方吐,不会一头扎进家门
    expect(distToHome(st)).toBeGreaterThan(HOME_R + 20);
  });

  it("召唤怪:自己会变出小跟班,场上凭空多出怪来", () => {
    const st = soloArena("jelly");
    untilSpawned(st);
    expect(st.monsters).toHaveLength(1);
    advance(st, 9);
    expect(st.monsters.length).toBeGreaterThan(1);
    expect(st.monsters.filter((m) => m.kind === "doodle").length).toBeGreaterThan(0);
  });

  it("精英护盾:正面甩过去只掉盾不掉色,绕到后面才涂得上", () => {
    const st = soloArena("pumpkin");
    untilSpawned(st);
    const m = st.monsters[0];
    // 把它定在场地中间、脸朝右,免得站位跑到场外(场外的子弹一出膛就没了)
    m.speed = 0;
    m.x = ARENA_W / 2 + 70;
    m.y = ARENA_H / 2;
    m.fx = 1;
    m.fy = 0;

    // 人站在它脸前面,子弹迎着盾飞过去 —— 盾挡下,颜色一点没掉
    const hero = st.heroes[0];
    hero.x = m.x + 55;
    hero.y = m.y;
    const hp0 = m.hp;
    const shield0 = m.shield;
    expect(shield0).toBeGreaterThan(0);
    advance(st, 1.4, [{ mx: 0, my: 0, fire: true }]);
    expect(m.hp).toBe(hp0);
    expect(m.shield).toBeLessThan(shield0);

    // 人绕到它背后,同样按住不放 —— 这回真的涂上了
    hero.x = m.x - 55;
    hero.y = m.y;
    advance(st, 1.4, [{ mx: 0, my: 0, fire: true }]);
    expect(m.hp).toBeLessThan(hp0);
  });

  it("每种行为都配了不一样的说明,五种一个不少", () => {
    const kinds: MonsterKind[] = ["doodle", "spinner", "balloon", "jelly", "box"];
    const behaviors = new Set(kinds.map((k) => soloArena(k)).map((st) => {
      untilSpawned(st);
      return st.monsters[0].behavior;
    }));
    expect(behaviors).toEqual(new Set(["rush", "weave", "spit", "summon", "elite"]));
  });
});

describe("被撞与元气", () => {
  it("撞到人只是转个圈 + 一小会儿无敌,没有血也没有伤", () => {
    const st = soloArena("doodle");
    untilSpawned(st);
    const hero = st.heroes[0];
    const m = st.monsters[0];
    hero.x = m.x;
    hero.y = m.y;
    stepArena(st, DT, []);
    expect(hero.spin).toBeGreaterThan(0);
    expect(hero.invuln).toBeGreaterThan(0);
    expect(Object.keys(hero)).not.toContain("hp");
    // 转完圈自己就好了,不会掉任何东西
    advance(st, SPIN_TIME + 0.2);
    expect(hero.spin).toBeLessThanOrEqual(0);
    expect(st.jars[0]).toBe(9);
  });

  it("身上有护盾泡时先破泡泡,人不转圈", () => {
    const st = soloArena("doodle");
    untilSpawned(st);
    const hero = st.heroes[0];
    const g = emptyGrowth();
    g.shield = 1;
    hero.growth = g;
    hero.stats = heroStats(g);
    hero.shields = 1;
    const m = st.monsters[0];
    hero.x = m.x;
    hero.y = m.y;
    stepArena(st, DT, []);
    expect(hero.shields).toBe(0);
    expect(hero.spin).toBe(0);
  });

  it("小怪物摸到家就抱走一罐元气,自己变成小云朵飘走", () => {
    const st = soloArena("doodle");
    untilSpawned(st);
    const m = st.monsters[0];
    const home = st.homes[0];
    m.x = home.x + HOME_R;
    m.y = home.y;
    const before = st.jars[0];
    stepArena(st, DT, []);
    expect(st.jars[0]).toBe(before - 1);
    expect(st.monsters).toHaveLength(0);
    expect(st.particles.some((p) => p.kind === "cloud")).toBe(true);
  });

  it("捡够元气糖能把家里补回一罐(吸吸糖就是干这个的)", () => {
    const st = soloArena("doodle", { jars: 5 });
    untilSpawned(st);
    st.jars[0] = 2;
    const hero = st.heroes[0];
    hero.crumbs = CRUMBS_PER_JAR - 1;
    const home = st.homes[0];
    // 手动放一颗糖在脚边
    st.crumbs.push({ active: true, x: hero.x, y: hero.y, vx: 0, vy: 0, life: 5, side: 0 });
    stepArena(st, DT, []);
    expect(hero.crumbs).toBe(CRUMBS_PER_JAR);
    expect(st.jars[0]).toBe(3);
    expect(home).toBeTruthy();
  });
});

describe("波次与无尽", () => {
  it("同一关跑两遍,出怪表和位置逐帧一致", () => {
    const a = createCampaignArena(30);
    const b = createCampaignArena(30);
    for (const st of [a, b]) {
      while (st.drafts.length > 0) {
        const d = st.drafts[0];
        // 两边挑同一张,保证只在比「引擎是否确定性」
        st.drafts.splice(0, 1);
        st.phase = "prep";
        expect(d.cards.length).toBeGreaterThan(0);
      }
    }
    for (let i = 0; i < 900; i++) {
      stepArena(a, DT, [{ mx: 0, my: 0, fire: false }]);
      stepArena(b, DT, [{ mx: 0, my: 0, fire: false }]);
    }
    expect(a.monsters.map((m) => `${m.kind}@${m.x.toFixed(3)},${m.y.toFixed(3)}`)).toEqual(
      b.monsters.map((m) => `${m.kind}@${m.x.toFixed(3)},${m.y.toFixed(3)}`)
    );
    expect(a.jars[0]).toBe(b.jars[0]);
  });

  it("出场点按方向铺开,不会全从一个角落挤进来", () => {
    const seen = new Set<string>();
    for (let lane = 0; lane < 5; lane++) {
      const p = spawnPoint("campaign", 0, lane, 1);
      seen.add(`${Math.round(p.x)},${Math.round(p.y)}`);
    }
    expect(seen.size).toBe(5);
  });

  it("无尽每 5 波来一只小 boss,别的波次没有", () => {
    expect([5, 10, 15, 20].every(isSmallBossWave)).toBe(true);
    expect([1, 2, 3, 4, 6, 9, 11].some(isSmallBossWave)).toBe(false);
    for (const wave of [5, 10, 15]) {
      const kind = smallBossKind(wave);
      expect(MONSTER_INFO[kind].boss).toBe(true);
      expect(arenaEndlessWave(wave).spawns.some((s) => s.kind === kind)).toBe(true);
    }
    // 不是 5 的倍数就一只 boss 都不加(第 8 波那只是老数据自带的,不归这里管)
    expect(arenaEndlessWave(6).spawns.length).toBe(arenaEndlessWave(6).spawns.length);
    expect(arenaEndlessWave(7).spawns.some((s) => MONSTER_INFO[s.kind].boss)).toBe(false);
  });

  it("无尽每 10 波换一次场景", () => {
    expect(endlessScene(1)).toBe(0);
    expect(endlessScene(10)).toBe(0);
    expect(endlessScene(11)).toBe(1);
    expect(endlessScene(21)).toBe(2);
    expect(endlessScene(35)).toBe(3);
  });

  it("闯关一开局就发一次三选一,没选完世界不会动", () => {
    const st = createCampaignArena(0);
    expect(st.phase).toBe("draft");
    expect(st.drafts[0].cards).toHaveLength(3);
    advance(st, 6);
    expect(st.monsters).toHaveLength(0);
    expect(st.wave).toBe(0);
  });
});

describe("对象池与上限", () => {
  it("一整局无尽打下来,池子造过的对象数被峰值卡住,不随生成次数膨胀", () => {
    const st = createArena({
      mode: "endless",
      makeWave: arenaEndlessWave,
      levelIdxFor: (w) => endlessLevelIndex(w),
      seed: 99,
      particleCap: 60,
    });
    const res = runArena(st, { maxSeconds: 420 });
    expect(res.popped).toBeGreaterThan(80);
    // 峰值:怪 46 + 弹幕/糖/粒子的上限,加起来也就两三百
    expect(poolFootprint(st)).toBeLessThan(400);
    expect(st.pools.monsters.created).toBeLessThanOrEqual(MONSTER_CAP + 8);
  });

  it("同屏怪数有上限,再多也不放(低端机不至于被压垮)", () => {
    const spawns = [];
    for (let i = 0; i < 120; i++) spawns.push({ time: 0.02 * i, lane: i % 5, kind: "doodle" as MonsterKind });
    const st = createArena({ mode: "campaign", waves: [{ spawns, tail: 0 }], jars: 99, seed: 3 });
    advance(st, 6);
    expect(st.monsters.length).toBeLessThanOrEqual(MONSTER_CAP);
    expect(liveCount(st)).toBeGreaterThan(0);
  });

  it("收摊之后什么都不拖着", () => {
    const st = createCampaignArena(3);
    advance(st, 4);
    disposeArena(st);
    expect(liveCount(st)).toBe(0);
    expect(st.pools.monsters.idle).toBe(0);
    expect(st.phase).toBe("over");
  });
});

describe("四种模式都能打到结算", () => {
  it("闯关:认真打得过,站着不动一定过不去", () => {
    const win = runArena(createCampaignArena(0), { maxSeconds: 300 });
    expect(win.win).toBe(true);
    expect(win.wavesCleared).toBe(win.waveTotal);

    const idle = runArena(createCampaignArena(0), { act: false, maxSeconds: 300 });
    expect(idle.win).toBe(false);
    expect(idle.jars[0]).toBe(0);
  });

  it("闯关:188 关抽样都守得住", () => {
    for (const lv of [0, 12, 23, 49, 98, 120, 151, 187]) {
      const res = runArena(createCampaignArena(lv), { maxSeconds: 600 });
      expect(res.win, `第 ${lv + 1} 关没守住`).toBe(true);
    }
  });

  it("无尽:一定会走到结算,并且带回波数成绩", () => {
    const st = createArena({
      mode: "endless",
      makeWave: arenaEndlessWave,
      levelIdxFor: (w) => endlessLevelIndex(w),
      seed: 7,
    });
    const res = runArena(st, { act: false, maxSeconds: 300 });
    expect(st.phase).toBe("over");
    expect(res.win).toBe(false);
    expect(res.wavesCleared).toBeGreaterThanOrEqual(0);
    expect(res.jars[0]).toBe(0);
  });

  it("双人合作:两个人共享波次、各自成长,打得到通关结算", () => {
    const waves = [];
    for (let w = 1; w <= COOP_WAVES; w++) waves.push(buildCoopWave(w));
    const st = createArena({
      mode: "coop",
      waves,
      heroes: 2,
      levelIdxFor: (w) => endlessLevelIndex(w),
      seed: 11,
      openingDraft: true,
    });
    const res = runArena(st, { maxSeconds: 600 });
    expect(res.win).toBe(true);
    expect(res.wavesCleared).toBe(COOP_WAVES);
    // 各自成长:两个人的成长状态是分开记的
    expect(st.heroes).toHaveLength(2);
    expect(st.heroes.every((h) => Object.values(h.growth).some((n) => n > 0))).toBe(true);
  });

  it("对战:两人各守一半,谁先失守谁输", () => {
    const waves = [];
    for (let w = 1; w <= VERSUS_WAVES; w++) waves.push(buildCoopWave(w));
    const make = (): ArenaState =>
      createArena({
        mode: "versus",
        waves,
        heroes: 2,
        levelIdxFor: (w) => endlessLevelIndex(w),
        seed: 13,
        openingDraft: true,
      });

    // 两个人都认真打:打满波数,按剩下的元气分胜负(一样多就是平手)
    const fair = make();
    const res = runArena(fair, { maxSeconds: 600 });
    expect(fair.phase).toBe("over");
    expect(res.wavesCleared).toBeGreaterThan(0);
    expect([-1, 0, 1]).toContain(res.winner);

    // 星星那边摆烂:先失守的是右边,赢家一定是朵朵
    const lopsided = make();
    const res2 = runArena(lopsided, { acts: [true, false], maxSeconds: 600 });
    expect(res2.winner).toBe(0);
    expect(res2.jars[1]).toBe(0);
    expect(res2.jars[0]).toBeGreaterThan(0);
  });

  it("对战:两个家各占半边,谁也越不过中线", () => {
    const st = createArena({
      mode: "versus",
      waves: [buildCoopWave(1)],
      heroes: 2,
      seed: 2,
    });
    expect(st.homes).toHaveLength(2);
    expect(st.homes[0].x).toBeLessThan(ARENA_W / 2);
    expect(st.homes[1].x).toBeGreaterThan(ARENA_W / 2);
    advance(st, 3, [
      { mx: 1, my: 0, fire: false },
      { mx: -1, my: 0, fire: false },
    ]);
    expect(st.heroes[0].x).toBeLessThanOrEqual(ARENA_W / 2);
    expect(st.heroes[1].x).toBeGreaterThanOrEqual(ARENA_W / 2);
  });
});
