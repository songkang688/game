/**
 * 王子公主大冒险 ·「单人托管的搭档只是帮手,不是代打」常驻用例。
 *
 * 第 3 轮阻断 B2 有两层:城门只认真人手上那位(见 `idle.test.ts`),
 * 以及这里守的第二层 —— 搭档跑的不能再是和真人一模一样的全功能 AI。
 * 原先它自己清怪、自己捡宝、自己一路冲到城门口:就算门口不认它,
 * 孩子把手放开,一关的活也全让小伙伴干完了。
 *
 * 这里守三件事:
 * 1. 搭档不越过真人往城门那头开路(`ESCORT_LEASH`);
 * 2. 真人零输入时搭档清不完场、也凑不满宝石 —— 想要星星就得自己动手;
 * 3. 托管没被一刀砍掉:真人身边的怪搭档照打,真人认真玩时 188 关照样通关。
 */
import { describe, expect, it } from "vitest";

import { allLevels, type EnemyKind, type LevelDef } from "./levels";
import { autoPlay, botInput, createWorld, emptyInput, stepWorld, type World } from "./logic";

const LEVELS = allLevels();
const DT = 1 / 60;

/** 照 index.ts 单人模式原样跑:真人那位一个键都不按,另一位由搭档托管 */
function idleSolo(def: LevelDef, seconds = 200): World {
  const w = createWorld(def, 1);
  const cap = Math.ceil(seconds / DT);
  for (let step = 0; step < cap && w.status === "playing"; step++) {
    stepWorld(w, DT, w.heroes.map((_, i) => (i === w.active ? emptyInput() : botInput(w, i, DT))));
  }
  return w;
}

function bareLevel(over: Partial<LevelDef> = {}): LevelDef {
  return {
    kind: "campaign",
    index: 0,
    chapterIndex: 0,
    name: "测试场",
    feature: "测试",
    hint: "测试",
    len: 1600,
    goalX: 1470,
    gaps: [],
    platforms: [],
    enemies: [],
    spikes: [],
    gems: [],
    boss: null,
    slippery: false,
    requiredRatio: 0,
    parSeconds: 40,
    gemGoal: 0,
    timeLimit: 0,
    hearts: 6,
    goalNeedsAll: false,
    ...over,
  };
}

function groundEnemy(kind: EnemyKind, x: number) {
  return { kind, x, minX: x, maxX: x, speed: 0, y: 0 };
}

/** 原先摆烂能三星的那 110 关里抽一批:头几章密一点(重灾区),后面各章各取几关 */
const ONCE_AUTO_WON = [0, 1, 2, 3, 4, 8, 13, 20, 26, 33, 40, 47, 60, 73, 86, 99, 133, 160];

describe("prince-princess · 搭档不替真人开路", () => {
  it("真人站着不动,搭档最多探出一小段就回来,离城门差得远", () => {
    const def = LEVELS[0];
    const w = createWorld(def, 1);
    let maxAhead = -Infinity;
    let maxX = -Infinity;
    for (let step = 0; step < 60 * 60 && w.status === "playing"; step++) {
      stepWorld(w, DT, w.heroes.map((_, i) => (i === w.active ? emptyInput() : botInput(w, i, DT))));
      const partner = w.heroes[1 - w.active];
      maxAhead = Math.max(maxAhead, partner.x - w.heroes[w.active].x);
      maxX = Math.max(maxX, partner.x);
    }
    expect(maxAhead).toBeLessThan(400);
    expect(maxX).toBeLessThan(def.goalX - 200);
  });

  it("真人零输入:搭档清不完场,也凑不满宝石 —— 星星得自己挣", () => {
    const carried = ONCE_AUTO_WON.filter((lv) => {
      const w = idleSolo(LEVELS[lv]);
      return w.kills >= w.enemyTotal || w.gemsTaken >= LEVELS[lv].gemGoal;
    }).map((lv) => `#${lv + 1} ${LEVELS[lv].name}`);
    expect(carried).toEqual([]);
  }, 60000);
});

describe("prince-princess · 托管没被砍掉", () => {
  it("真人身边的怪,搭档照打不误", () => {
    const w = idleSolo(bareLevel({ enemies: [groundEnemy("slime", 240)], requiredRatio: 1 }), 20);
    expect(w.kills).toBe(1);
    expect(w.playerKills).toBe(0);
  });

  it("落在真人身后的漏网之鱼,搭档也回头收拾", () => {
    const def = bareLevel({ enemies: [groundEnemy("slime", 40)], requiredRatio: 1 });
    const w = createWorld(def, 1);
    w.heroes[0].x = 900;
    w.heroes[1].x = 940;
    const full = w.enemies[0].hp;
    for (let step = 0; step < 30 / DT && w.status === "playing"; step++) {
      stepWorld(w, DT, w.heroes.map((_, i) => (i === w.active ? emptyInput() : botInput(w, i, DT))));
    }
    // 绳子只拴住往城门那头的方向:身后的怪不在托管范围之外,搭档会掉头去打
    expect(w.heroes[1].x).toBeLessThan(400);
    expect(w.enemies[0].hp).toBeLessThan(full);
  });

  it("真人认真玩的话,单人模式 188 关一关不落全打得通", () => {
    const failed = LEVELS.filter((def) => !autoPlay(createWorld(def, 1), { maxSeconds: 300 }).win).map(
      (def) => `#${def.index + 1} ${def.name}`,
    );
    expect(failed).toEqual([]);
  }, 60000);
});
