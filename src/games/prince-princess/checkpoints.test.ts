/**
 * 检查点与小云朵的用例。
 *
 * 盯死三件事:每一关都至少有两面旗、旗子都插在站得稳的干净地上、
 * 摔下去被托回来之后**捡到的宝石和打倒的怪一个都不少**。
 */
import { describe, expect, it } from "vitest";

import {
  FLAG_SPACING,
  MAX_CHECKPOINTS,
  MIN_CHECKPOINTS,
  carryOver,
  checkpointLabel,
  checkpointsFor,
  cloudLine,
  respawnX,
  updateReached,
} from "./checkpoints";
import { GOAL_INSET, START_PAD, allLevels, buildEndless, buildLevel, groundSolidAt } from "./levels";
import { createWorld, drainEvents, emptyInput, stepWorld } from "./logic";

const LEVELS = allLevels();

describe("检查点 · 摆在哪儿", () => {
  it("188 关每一关都至少两面旗,而且从左到右排好", () => {
    for (const def of LEVELS) {
      const flags = checkpointsFor(def);
      expect(flags.length, `#${def.index + 1}`).toBeGreaterThanOrEqual(MIN_CHECKPOINTS);
      expect(flags.length).toBeLessThanOrEqual(MAX_CHECKPOINTS);
      for (let i = 1; i < flags.length; i++) expect(flags[i]).toBeGreaterThan(flags[i - 1]);
    }
  });

  it("旗子都插在实地上、在起跑区和城门之间,而且不踩尖刺", () => {
    for (const def of LEVELS) {
      for (const x of checkpointsFor(def)) {
        expect(groundSolidAt(def, x), `#${def.index + 1} @${x}`).toBe(true);
        expect(x).toBeGreaterThan(START_PAD - 1);
        expect(x).toBeLessThan(def.goalX);
        expect(def.spikes.some((s) => x > s.x - 20 && x < s.x + s.w + 20), `#${def.index + 1}`).toBe(false);
      }
    }
  });

  it("路越长旗越多,但摔一次最多退回一段距离", () => {
    const long = LEVELS.reduce((a, b) => (a.len > b.len ? a : b));
    const flags = checkpointsFor(long);
    expect(flags.length).toBeGreaterThan(MIN_CHECKPOINTS);
    const span = long.goalX - GOAL_INSET * 0.4 - START_PAD;
    for (let i = 1; i < flags.length; i++) {
      expect(flags[i] - flags[i - 1]).toBeLessThan(FLAG_SPACING * 2.2);
    }
    expect(span / flags.length).toBeLessThan(FLAG_SPACING * 2);
  });

  it("无尽城堡塔的每一层也至少两面旗", () => {
    for (let r = 0; r < 12; r++) {
      const flags = checkpointsFor(buildEndless(r));
      expect(flags.length, `第 ${r + 1} 层`).toBeGreaterThanOrEqual(MIN_CHECKPOINTS);
    }
  });
});

describe("检查点 · 点亮与托回", () => {
  const flags = [300, 700, 1100];

  it("两个人都走过才点亮,只往前记不往回退", () => {
    expect(updateReached(flags, -1, [310, 120])).toBe(-1);
    expect(updateReached(flags, -1, [310, 305])).toBe(0);
    expect(updateReached(flags, 0, [1200, 1150])).toBe(2);
    // 往回走不会把点亮的旗吹灭
    expect(updateReached(flags, 2, [100, 100])).toBe(2);
  });

  it("托回的位置取「保底那面旗」和「自己刚走过那面旗」里靠前的一个", () => {
    const def = buildLevel(0);
    expect(respawnX(def, flags, -1, 0)).toBeLessThan(120);
    expect(respawnX(def, flags, 0, 0)).toBe(300);
    // 一个人冲到 1150 摔下去:从他自己走过的第三面旗接着来,不退回搭档那儿
    expect(respawnX(def, flags, 0, 1150)).toBe(1100);
    expect(respawnX(def, [], -1, 900)).toBeLessThan(120);
  });

  it("HUD 小旗与云朵台词都在,而且没有一个死伤字眼", () => {
    expect(checkpointLabel(flags, -1)).toBe("🚩 0/3");
    expect(checkpointLabel(flags, 1)).toBe("🚩 2/3");
    expect(checkpointLabel([], 0)).toBe("🚩 —");
    for (const line of [cloudLine("公主", -1), cloudLine("王子", 1)]) {
      expect(line).toContain("小云朵");
      for (const bad of ["死", "输", "失败", "摔坏"]) expect(line).not.toContain(bad);
    }
  });

  it("carryOver 把宝石、清怪数、开了的门原样端过去", () => {
    expect(carryOver({ gemsTaken: 4, kills: 7 }, true)).toEqual({ gems: 4, kills: 7, doorOpened: true });
  });
});

describe("检查点 · 放进真实世界", () => {
  /** 造一关:一条平地,中间挖个坑,坑前有旗、有宝石、有怪 */
  const def = () => {
    const base = buildLevel(0);
    return {
      ...base,
      len: 2400,
      goalX: 2270,
      gaps: [{ x0: 1500, x1: 1580 }],
      spikes: [],
      platforms: [],
      enemies: [{ kind: "slime" as const, x: 900, minX: 900, maxX: 900, speed: 0, y: 0 }],
      gems: [{ x: 620, y: -46, ground: true }],
      requiredRatio: 0,
      timeLimit: 0,
      teach: false,
      noRisk: false,
    };
  };

  it("摔下去被小云朵托回最近点亮的旗,宝石和战果一颗都不少", () => {
    const w = createWorld(def(), 2);
    const flags = w.flags;
    expect(flags.length).toBeGreaterThanOrEqual(2);

    // 先把两个人挪到第一面旗后面,顺手捡颗宝石、记一笔战果
    for (const h of w.heroes) h.x = flags[0] + 30;
    w.gems[0].taken = true;
    w.gemsTaken = 1;
    w.kills = 1;
    stepWorld(w, 1 / 60, [emptyInput(), emptyInput()]);
    expect(w.reached).toBeGreaterThanOrEqual(0);

    // 让王子掉进坑里
    const prince = w.heroes[0];
    prince.x = 1540;
    prince.y = 0;
    prince.onGround = false;
    drainEvents(w);
    for (let i = 0; i < 240; i++) stepWorld(w, 1 / 60, [emptyInput(), emptyInput()]);

    const kinds = drainEvents(w).map((e) => e.kind);
    expect(kinds).toContain("cloud");
    expect(prince.y).toBeLessThanOrEqual(0);
    // 落点就是他自己刚走过的那面旗(坑在 1500,取坑前最近的一面)
    const behind = flags.filter((x) => x <= 1540);
    expect(prince.x).toBeCloseTo(behind[behind.length - 1], 0);
    expect(prince.x).toBeGreaterThanOrEqual(flags[w.reached]);
    // 道具与战果照旧
    expect(w.gemsTaken).toBe(1);
    expect(w.kills).toBe(1);
    expect(w.hearts).toBe(5);
    expect(w.status).toBe("playing");
  });

  it("还没走到第一面旗就摔下去,回起跑区,一样保留战果", () => {
    const early = { ...def(), gaps: [{ x0: 330, x1: 400 }] };
    const w = createWorld(early, 2);
    expect(w.flags[0]).toBeGreaterThan(400);
    w.gemsTaken = 2;
    const prince = w.heroes[0];
    prince.x = 365;
    prince.y = 0;
    prince.onGround = false;
    for (let i = 0; i < 240; i++) stepWorld(w, 1 / 60, [emptyInput(), emptyInput()]);
    expect(prince.x).toBeLessThan(200);
    expect(w.gemsTaken).toBe(2);
    expect(w.status).toBe("playing");
  });

  it("点亮一面旗会发一条 flag 事件,好让界面点个亮", () => {
    const w = createWorld(def(), 2);
    drainEvents(w);
    for (const h of w.heroes) h.x = w.flags[0] + 20;
    stepWorld(w, 1 / 60, [emptyInput(), emptyInput()]);
    expect(drainEvents(w).map((e) => e.kind)).toContain("flag");
  });
});
