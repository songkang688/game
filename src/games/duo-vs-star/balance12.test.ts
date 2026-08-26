import { describe, expect, it } from "vitest";
import {
  BALANCE_MAX,
  BALANCE_MIN,
  COOP_STAGES,
  EDGE_GUARD_GAP,
  LAUNCH_CEILING,
  LEGACY_ENDLESS_KEYS,
  ROUND_ROBIN_GAMES,
  STRUGGLE_MAX_REDUCTION,
  STRUGGLE_TAPS_FOR_MAX,
  STRUGGLE_WINDOW_SECONDS,
  TIER_SAMPLE_POWER,
  balanceOutliers,
  behaviorCount,
  chargeSeconds,
  coopStageSolved,
  duel,
  foeBehavior,
  interruptCharge,
  isStrongItem,
  itemTableIsSane,
  knockbackTable,
  mirrorSpawns,
  readLegacyBest,
  roundRobin,
  spawnsAreMirrored,
  startCharge,
  strongItemsExist,
  struggleReduce,
  struggleWindow,
  tickCharge,
  worstCaseLaunch,
} from "./balance12";
import { BUMP_MAX, launchSpeed } from "./knockback";
import { ROSTER, fighterById } from "./roster";

/* ---------------- 平衡矩阵 ---------------- */

describe("1.2 角色平衡：循环赛胜率矩阵", () => {
  const rows = roundRobin();

  it("每对角色都真的打满了 20 局，先后手各一半", () => {
    expect(ROUND_ROBIN_GAMES).toBeGreaterThanOrEqual(20);
    for (const row of rows) {
      const opponents = Object.keys(row.wins);
      expect(opponents).toHaveLength(ROSTER.length - 1);
      for (const id of opponents) {
        expect(row.wins[id]).toBeGreaterThanOrEqual(0);
        expect(row.wins[id]).toBeLessThanOrEqual(ROUND_ROBIN_GAMES);
      }
    }
  });

  it("没有任何角色的总胜率超出 40%–60%", () => {
    const bad = balanceOutliers(rows).map((r) => `${r.name}=${r.rate.toFixed(3)}`);
    expect(bad).toEqual([]);
    for (const row of rows) {
      expect(row.rate).toBeGreaterThanOrEqual(BALANCE_MIN);
      expect(row.rate).toBeLessThanOrEqual(BALANCE_MAX);
    }
  });

  it("胜率矩阵左右自洽：A 赢 B 的局数 + B 赢 A 的局数 = 总局数", () => {
    for (const row of rows) {
      for (const [oppId, wins] of Object.entries(row.wins)) {
        const opp = rows.find((r) => r.id === oppId)!;
        expect(wins + opp.wins[row.id]).toBe(ROUND_ROBIN_GAMES);
      }
    }
  });

  it("同一个 seed 的循环赛完全可复现", () => {
    expect(roundRobin(777, 10)).toEqual(roundRobin(777, 10));
  });

  it("同一位角色照镜子打自己，胜率必然是一半", () => {
    const duoduo = fighterById("duoduo");
    let wins = 0;
    for (let g = 0; g < 200; g++) wins += duel(duoduo, duoduo, 4000 + g) === 0 ? 1 : 0;
    expect(wins / 200).toBeGreaterThan(0.4);
    expect(wins / 200).toBeLessThan(0.6);
  });

  it("轻角色躲得多、沉角色顶得住，两条活路都存在", () => {
    const lightest = ROSTER.reduce((m, f) => (f.weight < m.weight ? f : m), ROSTER[0]);
    const heaviest = ROSTER.reduce((m, f) => (f.weight > m.weight ? f : m), ROSTER[0]);
    expect(lightest.speed).toBeGreaterThan(heaviest.speed);
    expect(heaviest.power).toBeGreaterThan(lightest.power);
    const light = rows.find((r) => r.id === lightest.id)!;
    const heavy = rows.find((r) => r.id === heaviest.id)!;
    expect(Math.abs(light.rate - heavy.rate)).toBeLessThan(0.2);
  });
});

/* ---------------- 击退曲线与挣扎窗口 ---------------- */

describe("1.2 击退曲线与挣扎窗口", () => {
  it("分档表五档，击退值区间首尾相接、覆盖到封顶", () => {
    const tiers = knockbackTable();
    expect(tiers).toHaveLength(5);
    expect(tiers[0].from).toBe(0);
    expect(tiers[tiers.length - 1].to).toBe(BUMP_MAX);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].from).toBe(tiers[i - 1].to);
    }
  });

  it("击退值越高飞得越远，但最后一档不超过封顶", () => {
    const tiers = knockbackTable();
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].launch).toBeGreaterThan(tiers[i - 1].launch);
    }
    expect(tiers[tiers.length - 1].launch).toBeLessThanOrEqual(LAUNCH_CEILING);
  });

  it("体重越沉，同一档飞得越近", () => {
    const light = knockbackTable(72);
    const heavy = knockbackTable(132);
    for (let i = 0; i < light.length; i++) {
      expect(heavy[i].launch).toBeLessThan(light[i].launch);
    }
  });

  it("最坏情况也不会一击飞出天外（初速有硬顶）", () => {
    expect(worstCaseLaunch()).toBeLessThanOrEqual(LAUNCH_CEILING);
    expect(launchSpeed(BUMP_MAX, TIER_SAMPLE_POWER * 10, 60)).toBeLessThanOrEqual(LAUNCH_CEILING);
  });

  it("只有元气很低时才给挣扎窗口", () => {
    expect(struggleWindow(0)).toBe(0);
    expect(struggleWindow(BUMP_MAX * 0.5)).toBe(0);
    expect(struggleWindow(BUMP_MAX)).toBe(STRUGGLE_WINDOW_SECONDS);
    expect(STRUGGLE_WINDOW_SECONDS).toBeCloseTo(0.4);
  });

  it("挣扎最多压掉 30%，不挣扎就一点也不压", () => {
    expect(struggleReduce(1000, 0)).toBe(1000);
    expect(struggleReduce(1000, STRUGGLE_TAPS_FOR_MAX)).toBeCloseTo(1000 * (1 - STRUGGLE_MAX_REDUCTION));
    expect(struggleReduce(1000, 999)).toBeCloseTo(1000 * (1 - STRUGGLE_MAX_REDUCTION));
  });

  it("挣扎次数越多压得越狠（单调）", () => {
    let prev = Infinity;
    for (let taps = 0; taps <= STRUGGLE_TAPS_FOR_MAX; taps++) {
      const v = struggleReduce(1000, taps);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });
});

/* ---------------- 道具公平 ---------------- */

describe("1.2 道具刷新对称与蓄力", () => {
  it("镜像出来的刷新点左右成对", () => {
    const pts = mirrorSpawns([
      { x: 180, y: 200 },
      { x: 320, y: 380 },
    ]);
    expect(pts).toHaveLength(4);
    expect(spawnsAreMirrored(pts)).toBe(true);
  });

  it("偏心的刷新点会被判为不对称", () => {
    expect(spawnsAreMirrored([{ x: 180, y: 200 }, { x: 400, y: 200 }])).toBe(false);
    expect(spawnsAreMirrored([{ x: 180, y: 200 }])).toBe(false);
  });

  it("正中线上的点自己和自己配对", () => {
    expect(spawnsAreMirrored(mirrorSpawns([{ x: 480, y: 100 }]))).toBe(true);
  });

  it("强道具都要蓄力，普通道具立刻生效", () => {
    expect(strongItemsExist()).toBe(true);
    expect(isStrongItem("hammer")).toBe(true);
    expect(chargeSeconds("hammer")).toBeGreaterThan(0);
    expect(isStrongItem("shield")).toBe(false);
    expect(chargeSeconds("shield")).toBe(0);
  });

  it("蓄力满了才生效，中途被打断就要重来", () => {
    let st = startCharge("hammer");
    expect(st.ready).toBe(false);
    st = tickCharge(st, chargeSeconds("hammer") / 2);
    expect(st.ready).toBe(false);
    const broken = interruptCharge(st);
    expect(broken.remain).toBeCloseTo(chargeSeconds("hammer"));
    expect(broken.ready).toBe(false);
    st = tickCharge(st, 999);
    expect(st.ready).toBe(true);
    expect(interruptCharge(st).ready).toBe(true);
  });

  it("不需要蓄力的道具拿到就是就绪", () => {
    expect(startCharge("shield").ready).toBe(true);
  });

  it("道具表本身没有配错（名字 / 说明 / 权重都在）", () => {
    expect(itemTableIsSane()).toBe(true);
  });
});

/* ---------------- 合作关 ---------------- */

describe("1.2 合作关：一个人过不去", () => {
  it("三关配合关都配齐了两个角色位与说明", () => {
    expect(COOP_STAGES).toHaveLength(3);
    for (const st of COOP_STAGES) {
      expect(st.roles[0]).not.toBe(st.roles[1]);
      expect(st.hint.length).toBeGreaterThan(0);
    }
  });

  it("两个玩家各占一个角色位就能过", () => {
    for (const st of COOP_STAGES) {
      expect(
        coopStageSolved(st, [
          { player: 0, role: st.roles[0] },
          { player: 1, role: st.roles[1] },
        ]),
      ).toBe(true);
    }
  });

  it("同一个人分身乏术：一个人占两个位也不算过", () => {
    for (const st of COOP_STAGES) {
      expect(
        coopStageSolved(st, [
          { player: 0, role: st.roles[0] },
          { player: 0, role: st.roles[1] },
        ]),
      ).toBe(false);
    }
  });

  it("只占一个角色位也过不去", () => {
    for (const st of COOP_STAGES) {
      expect(coopStageSolved(st, [{ player: 0, role: st.roles[0] }])).toBe(false);
    }
  });
});

/* ---------------- 战役后段行为化 ---------------- */

describe("1.2 战役后段：靠行为不靠数值", () => {
  it("前段只会正面打，后段一层层加行为", () => {
    expect(behaviorCount(1)).toBe(0);
    expect(foeBehavior(1).flank).toBe(false);
    expect(foeBehavior(60).flank).toBe(true);
    expect(foeBehavior(100).itemGreed).toBe(true);
    expect(foeBehavior(188).punish).toBe(true);
    expect(foeBehavior(188).edgeGuard).toBe(true);
  });

  it("行为数量随关数单调不减", () => {
    let prev = -1;
    for (let n = 1; n <= 188; n += 7) {
      const c = behaviorCount(n);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });

  it("越界与非法关数 clamp 回合法范围", () => {
    expect(behaviorCount(0)).toBe(behaviorCount(1));
    expect(behaviorCount(9999)).toBe(behaviorCount(188));
    expect(behaviorCount(Number.NaN)).toBe(behaviorCount(1));
  });

  it("边缘守门一定留出回场的缝，不做「回不了场」", () => {
    expect(EDGE_GUARD_GAP).toBeGreaterThan(0);
    expect(foeBehavior(188).hint).toContain("回场");
  });

  it("每一档行为都有给孩子看的说明", () => {
    for (const n of [1, 60, 100, 188]) {
      expect(foeBehavior(n).hint.length).toBeGreaterThan(0);
    }
  });
});

/* ---------------- 旧 key 迁移 ---------------- */

describe("1.2 旧纪录读一次迁移", () => {
  it("能从旧 key 里读出最高的一份", () => {
    const store: Record<string, string> = {
      [LEGACY_ENDLESS_KEYS[0]]: "12",
      [LEGACY_ENDLESS_KEYS[1]]: "27",
    };
    expect(readLegacyBest((k) => store[k] ?? null)).toBe(27);
  });

  it("旧 key 不存在或是坏数据时返回 0，不会把纪录清零", () => {
    expect(readLegacyBest(() => null)).toBe(0);
    expect(readLegacyBest(() => "不是数字")).toBe(0);
  });
});
