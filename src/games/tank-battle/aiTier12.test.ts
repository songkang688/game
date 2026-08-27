/**
 * 1.2 本窗验收 · 第 1 轮学习优化员落地之三:三档脾气在**闯关**里真的生效。
 *
 * `ai12.ts` 的 `TIER_SPECS` 一直写着三档的 `fireRange`(5 / 9 / 10 格),
 * 可闯关那一侧的 `enemyIntent` 与 `stepEnemies` 都写死了 `lineOfFire(w, t, 9)` ——
 * 这一列数据只在**对战陪练**里被读过,闯关里从来没生效:
 *  - 「乱转」档隔着 9 格就点射(规格是 5 格,远了八成),第一章就在远距离招呼人;
 *  - 「绕后卡位」档反而被砍到 9 格,比规格的 10 格还短。
 *
 * 这一批用例盯住「看多远」真的按档位走了,并且把「重想间隔为什么不按档位走」
 * 这条实测结论也钉下来 —— 那不是漏改,是关卡配平守不住(见 `ENEMY_RETHINK` 的注释)。
 */
import { describe, expect, it } from "vitest";

import { TIER_SPECS, type AiTier } from "./ai12";
import {
  ENEMY_RETHINK,
  TANK_HALF,
  aliveEnemies,
  createWorld,
  enemyFireRange,
  enemyIntent,
  lineOfFire,
  stepWorld,
  type Tank,
  type World,
} from "./logic";

/** 一条又长又空的走廊:好把「隔多远开火」量出来 */
const LANE = [
  "e...........e",
  ".............",
  "1...........2",
  ".............",
  "......B......",
];

const TIERS: AiTier[] = ["wander", "chase", "flank"];

/** 造一个不会自己结束的演习场,里面只有一辆敌人车 */
function lane(): World {
  const w = createWorld({
    rows: LANE,
    mode: "campaign",
    players: 1,
    limit: 600,
    queue: [{ kind: "swift", spawn: 0 }],
    spawnGap: 9999,
  });
  w.spawnTimer = 0;
  // 推一帧把那辆车放出来
  stepWorld(w, 1 / 60, [{ dir: -1, fire: false, brick: false }]);
  w.spawnTimer = 9999;
  return w;
}

/** 把敌人摆到玩家正东边 gap 格远的地方,炮口朝西对着人 */
function faceOff(w: World, gap: number, tier: AiTier): Tank {
  const me = w.tanks.find((t) => t.side === "player")!;
  me.x = 0.5;
  me.y = 2.5;
  me.dir = 1;
  const foe = aliveEnemies(w)[0];
  foe.x = me.x + gap;
  foe.y = 2.5;
  // 3 = 朝左
  foe.dir = 3;
  foe.tier = tier;
  foe.goal = "player";
  foe.cool = 0;
  foe.windup = 0;
  return foe;
}

describe("闯关敌人 · 开火距离按脾气档走", () => {
  it("三档的开火距离就是 TIER_SPECS 里那三个数,而且严格从近到远", () => {
    expect(enemyFireRange("wander")).toBe(TIER_SPECS.wander.fireRange);
    expect(enemyFireRange("chase")).toBe(TIER_SPECS.chase.fireRange);
    expect(enemyFireRange("flank")).toBe(TIER_SPECS.flank.fireRange);
    expect(enemyFireRange("wander")).toBeLessThan(enemyFireRange("chase"));
    expect(enemyFireRange("chase")).toBeLessThan(enemyFireRange("flank"));
  });

  it("乱转档比写死的老数字近得多,绕后档比它远——这就是这次改动的全部意义", () => {
    const OLD_HARDCODED = 9;
    expect(enemyFireRange("wander")).toBeLessThan(OLD_HARDCODED * 0.7);
    expect(enemyFireRange("flank")).toBeGreaterThan(OLD_HARDCODED);
  });

  it("凑到跟前谁都开火:4 格的时候三档都会来一发", () => {
    for (const tier of TIERS) {
      const w = lane();
      const foe = faceOff(w, 4, tier);
      expect(lineOfFire(w, foe, enemyFireRange(tier)).kind, tier).toBe("player");
      expect(enemyIntent(w, foe).fire, tier).toBe(true);
    }
  });

  it("隔着 7 格:乱转档还看不见人,追人与绕后档已经开火了", () => {
    const w1 = lane();
    const wander = faceOff(w1, 7, "wander");
    expect(lineOfFire(w1, wander, enemyFireRange("wander")).kind).not.toBe("player");
    expect(enemyIntent(w1, wander).fire).toBe(false);

    for (const tier of ["chase", "flank"] as AiTier[]) {
      const w = lane();
      const foe = faceOff(w, 7, tier);
      expect(enemyIntent(w, foe).fire, tier).toBe(true);
    }
  });

  it("最远那一档单独够得着:10.2 格上只有绕后卡位档开火", () => {
    // 射线是从车头量起的,两辆车各占半格:10.2 格的间距折成射程约 9.35 格,
    // 正好卡在追人档(9)与绕后档(10)之间
    const wChase = lane();
    const chase = faceOff(wChase, 10.2, "chase");
    expect(lineOfFire(wChase, chase, enemyFireRange("chase")).kind).not.toBe("player");
    expect(enemyIntent(wChase, chase).fire).toBe(false);

    const wFlank = lane();
    const flank = faceOff(wFlank, 10.2, "flank");
    expect(lineOfFire(wFlank, flank, enemyFireRange("flank")).kind).toBe("player");
    expect(enemyIntent(wFlank, flank).fire).toBe(true);
  });

  it("射线量出来的距离和格距对得上(两辆车各占半格)", () => {
    const w = lane();
    const foe = faceOff(w, 6, "flank");
    const ray = lineOfFire(w, foe, enemyFireRange("flank"));
    expect(ray.kind).toBe("player");
    expect(ray.dist).toBeGreaterThan(6 - 2 * TANK_HALF - 0.5);
    expect(ray.dist).toBeLessThan(6);
  });
});

describe("闯关敌人 · 真的推世界跑一段", () => {
  it("7 格开外的乱转档一炮不放,同一个场面换成绕后档立刻开火", () => {
    const idle = { dir: -1 as const, fire: false, brick: false };

    const wanderWorld = lane();
    const wanderFoe = faceOff(wanderWorld, 7, "wander");
    wanderFoe.aiTimer = 0;
    let wanderShots = 0;
    for (let i = 0; i < 30; i++) {
      // 每一帧把它按在原地朝西,只看它开不开火
      wanderFoe.x = 7.5;
      wanderFoe.y = 2.5;
      wanderFoe.dir = 3;
      stepWorld(wanderWorld, 1 / 60, [idle]);
      wanderShots += wanderWorld.bullets.filter((b) => b.side === "enemy").length;
    }
    expect(wanderShots).toBe(0);

    const flankWorld = lane();
    const flankFoe = faceOff(flankWorld, 7, "flank");
    flankFoe.aiTimer = 0;
    let flankShots = 0;
    for (let i = 0; i < 30; i++) {
      flankFoe.x = 7.5;
      flankFoe.y = 2.5;
      flankFoe.dir = 3;
      stepWorld(flankWorld, 1 / 60, [idle]);
      flankShots += flankWorld.bullets.filter((b) => b.side === "enemy").length;
    }
    expect(flankShots).toBeGreaterThan(0);
  });
});

describe("闯关敌人 · 重想间隔为什么不按档位走", () => {
  /**
   * 这一条是**实测结论的留痕**,不是漏改。
   * 把 `t.aiTimer` 换成 `TIER_SPECS.think` 之后,188 关的可通过性守不住:
   * 第 51 / 90 / 98 关无头机器人都打不过去;给绕后档压 0.3 秒下限、
   * 给乱转档封到 0.4 秒之后第 164 关照样守不住。
   * 也就是说这套关卡是围着 0.3 秒这个**整体节奏**配出来的,要动得连波次一起重配。
   */
  it("闯关的重想间隔是一个统一常数,不是三档各走各的", () => {
    expect(ENEMY_RETHINK).toBe(0.3);
    // 它确实落在三档 think 的区间里,不是随手写的一个数
    const thinks = TIERS.map((t) => TIER_SPECS[t].think);
    expect(ENEMY_RETHINK).toBeGreaterThanOrEqual(Math.min(...thinks));
    expect(ENEMY_RETHINK).toBeLessThanOrEqual(Math.max(...thinks));
  });

  it("三档的 think 仍然是从慢到快排好的(对战陪练那一侧照旧按它走)", () => {
    expect(TIER_SPECS.wander.think).toBeGreaterThan(TIER_SPECS.chase.think);
    expect(TIER_SPECS.chase.think).toBeGreaterThan(TIER_SPECS.flank.think);
  });
});
