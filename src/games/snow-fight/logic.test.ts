/**
 * 雪球大作战 · 规则层单测。
 *
 * 这一份管的是「按下去会发生什么」:键位有没有抢占、蓄力条怎么走、
 * 一发雪球打到不同东西各是什么结果、回合怎么轮、评分和文案对不对。
 * 有一条是专门盯着不许写坏的:砸中人只是变一会儿雪人,不掉血、不出局。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  ANGLE_MAX,
  ANGLE_MIN,
  BALL_R,
  CHARGE_CYCLE,
  GUARD_X,
  KEY_MAP,
  PAUSE_KEY,
  SNOW_WALL_HP,
  aiTurn,
  buildWall,
  chargeAt,
  createMatch,
  current,
  endTurn,
  endlessMarch,
  endlessTargets,
  endlessWaveSize,
  flyShot,
  keyConflicts,
  liveTargets,
  loseLine,
  missHint,
  rateLevel,
  stepAngle,
  takeShot,
  winLine,
  type MatchSpec,
} from "./logic";
import { solvePower } from "./physics";

/** 一个最省事的靶场:一个人、一个不会动的雪灯笼 */
function range(over: Partial<MatchSpec> = {}) {
  return createMatch({
    mode: "campaign",
    windPlan: [0],
    targets: [{ x: 30, y: 2, r: 1.2 }],
    throwers: [{ seat: 0, x: 6, dir: 1, balls: 8, walls: 2 }],
    ...over,
  });
}

/** 解一发一定打中 (x, y) 的力度 */
function aim(fromX: number, angle: number, targetX: number, targetY: number, wind = 0): number {
  const power = solvePower({ x: fromX, y: 1.2, angle, dir: 1, wind }, targetX, targetY);
  expect(power).not.toBeNull();
  return power as number;
}

describe("雪球大作战 · 键位", () => {
  it("鸭梨 WASD + F/G,康康 方向键 + L/K,两个人互不抢占", () => {
    expect(keyConflicts()).toEqual([]);
    expect(KEY_MAP.KeyW.player).toBe(0);
    expect(KEY_MAP.KeyF).toEqual({ player: 0, action: "throw" });
    expect(KEY_MAP.KeyG).toEqual({ player: 0, action: "wall" });
    expect(KEY_MAP.ArrowUp.player).toBe(1);
    expect(KEY_MAP.KeyL).toEqual({ player: 1, action: "throw" });
    expect(KEY_MAP.KeyK).toEqual({ player: 1, action: "wall" });
    expect(PAUSE_KEY).toBe("Escape");
  });

  it("两个人各自的六个键都齐,而且没有一个键被两个人共用", () => {
    for (const player of [0, 1] as const) {
      const mine = Object.values(KEY_MAP).filter((b) => b.player === player);
      expect(mine).toHaveLength(6);
      expect(new Set(mine.map((b) => b.action)).size).toBe(6);
    }
    expect(Object.keys(KEY_MAP)).not.toContain(PAUSE_KEY);
  });
});

describe("雪球大作战 · 蓄力条与仰角", () => {
  it("蓄力条来回跑:半个周期到顶,一个周期回到底", () => {
    expect(chargeAt(0)).toBe(0);
    expect(chargeAt(CHARGE_CYCLE / 2)).toBeCloseTo(100, 6);
    expect(chargeAt(CHARGE_CYCLE)).toBeCloseTo(0, 6);
    expect(chargeAt(CHARGE_CYCLE * 1.5)).toBeCloseTo(100, 6);
  });

  it("蓄力条永远在 0..100 之间,坏数据也不例外", () => {
    for (let t = 0; t < 6; t += 0.07) {
      expect(chargeAt(t)).toBeGreaterThanOrEqual(0);
      expect(chargeAt(t)).toBeLessThanOrEqual(100);
    }
    expect(chargeAt(-2)).toBe(0);
    expect(chargeAt(Number.NaN)).toBe(0);
  });

  it("仰角上下调都会被夹在合法范围里", () => {
    expect(stepAngle(45, 3)).toBe(48);
    expect(stepAngle(ANGLE_MAX, 10)).toBe(ANGLE_MAX);
    expect(stepAngle(ANGLE_MIN, -10)).toBe(ANGLE_MIN);
  });
});

describe("雪球大作战 · 一发雪球会碰到什么", () => {
  it("打中雪灯笼,它就化成一摊雪", () => {
    const match = range();
    const before = match.throwers[0].balls;
    const out = takeShot(match, 45, aim(6, 45, 30, 2));
    expect(out?.shot.hit).toBe("lantern");
    expect(match.targets[0].melted).toBe(true);
    expect(match.melted).toBe(1);
    expect(match.throwers[0].balls).toBe(before - 1);
    expect(match.status).toBe("win");
  });

  it("扔太近就落在地上,会告诉你还差多少", () => {
    const match = range();
    const out = takeShot(match, 45, 20);
    expect(out?.shot.hit).toBe("ground");
    expect(out?.line).toContain("没到");
    expect(match.targets[0].melted).toBe(false);
  });

  it("落点在目标另一边就提醒收力", () => {
    const shot = { points: [], hit: "ground" as const, id: -1, x: 40, y: 0 };
    const target = range().targets[0];
    expect(missHint(shot, target, 1)).toContain("过头");
    expect(missHint({ ...shot, x: 20 }, target, 1)).toContain("没到");
    expect(missHint({ ...shot, x: 30.8 }, target, 1)).toContain("一点点");
    expect(missHint(shot, undefined, 1).length).toBeGreaterThan(4);
  });

  it("飞出场地外面就是出界,不会一直算下去", () => {
    const match = createMatch({
      mode: "campaign",
      windPlan: [0],
      targets: [{ x: 30, y: 40 }],
      throwers: [{ seat: 0, x: 6, dir: 1, balls: 5, walls: 0 }],
    });
    const out = flyShot(match, { x: 6, y: 1.2, angle: 12, power: 100, dir: 1, wind: 3 });
    expect(["out", "ground"]).toContain(out.hit);
    expect(out.points.length).toBeGreaterThan(3);
  });

  it("雪球有大小:擦着靶子边也算中", () => {
    const match = range();
    const edge = match.targets[0].r + BALL_R - 0.05;
    const out = flyShot(match, {
      x: 6,
      y: 1.2,
      angle: 45,
      power: aim(6, 45, 30, 2 + edge),
      dir: 1,
      wind: 0,
    });
    expect(out.hit).toBe("lantern");
  });
});

describe("雪球大作战 · 雪墙", () => {
  it("堆一堵雪墙要花掉一回合,墙数会减少", () => {
    const match = range();
    const walls = match.throwers[0].walls;
    expect(buildWall(match)).toBe(true);
    expect(match.throwers[0].walls).toBe(walls - 1);
    expect(match.covers.filter((c) => c.kind === "snow")).toHaveLength(1);
    expect(match.covers[0].hp).toBe(SNOW_WALL_HP);
    expect(match.shots).toBe(1);
  });

  it("在同一个地方再堆一次,是把墙加高加厚而不是多出一堵", () => {
    const match = range();
    buildWall(match);
    const h = match.covers[0].h;
    buildWall(match);
    expect(match.covers).toHaveLength(1);
    expect(match.covers[0].h).toBeGreaterThan(h);
    expect(match.covers[0].hp).toBeGreaterThan(SNOW_WALL_HP);
  });

  it("墙用完了就堆不了,也不会白白吃掉一回合", () => {
    const match = range({ throwers: [{ seat: 0, x: 6, dir: 1, balls: 8, walls: 0 }] });
    expect(buildWall(match)).toBe(false);
    expect(match.shots).toBe(0);
  });
});

describe("雪球大作战 · 胜负与回合", () => {
  it("靶子全化掉就过关", () => {
    const match = range({ targets: [{ x: 30, y: 2 }, { x: 38, y: 2 }] });
    takeShot(match, 45, aim(6, 45, 30, 2));
    expect(match.status).toBe("playing");
    takeShot(match, 45, aim(6, 45, 38, 2));
    expect(match.status).toBe("win");
    expect(match.reason).toContain("化成雪");
  });

  it("雪球用完还有靶子就这一关重来,提示只讲下次怎么打", () => {
    const match = range({ throwers: [{ seat: 0, x: 6, dir: 1, balls: 2, walls: 0 }] });
    takeShot(match, 45, 12);
    takeShot(match, 45, 12);
    expect(match.status).toBe("lose");
    const line = loseLine(match.reason, liveTargets(match).length);
    expect(line).toContain("试投");
    expect(line).not.toMatch(/输|死|血|伤|笨/);
  });

  it("雪怪走到雪堡跟前也算这一轮结束,而且只是被推倒灯笼", () => {
    const match = range({
      targets: [{ x: 20, y: 2, kind: "monster", march: 4 }],
      throwers: [{ seat: 0, x: 6, dir: 1, balls: 20, walls: 0 }],
    });
    for (let i = 0; i < 10 && match.status === "playing"; i++) takeShot(match, 85, 5);
    expect(match.status).toBe("lose");
    expect(match.reason).toContain("雪怪");
    expect(match.targets[0].x).toBeLessThanOrEqual(GUARD_X + match.targets[0].r);
    expect(loseLine(match.reason, 1)).toContain("雪墙");
  });

  it("轮流出手;砸中对手只是让他歇一回合,不掉任何东西", () => {
    const match = createMatch({
      mode: "versus",
      windPlan: [0],
      targets: [
        { x: 3, y: 2.4, owner: 0 },
        { x: 50, y: 2.4, owner: 1 },
      ],
      throwers: [
        { seat: 0, x: 10, dir: 1, balls: -1, walls: 1 },
        { seat: 1, x: 40, dir: -1, balls: -1, walls: 1 },
      ],
    });
    expect(current(match).seat).toBe(0);
    takeShot(match, 45, 10);
    expect(current(match).seat).toBe(1);
    takeShot(match, 45, 10);
    expect(current(match).seat).toBe(0);
    const out = takeShot(match, 40, aim(10, 40, 40, 0.4));
    expect(out?.shot.hit).toBe("player");
    expect(match.throwers[1].bumps).toBe(1);
    expect(match.throwers[1].balls).toBe(-1);
    expect(out?.line).toContain("雪人");
    expect(out?.line).not.toMatch(/输|死|血|伤|疼|淘汰/);
    expect(current(match).seat).toBe(0);
  });

  it("无限雪球的模式不会因为「雪球用完」结束", () => {
    const match = createMatch({
      mode: "endless",
      windPlan: [0],
      targets: [{ x: 30, y: 2, kind: "monster", march: 0.2 }],
      throwers: [{ seat: 0, x: 6, dir: 1, balls: -1, walls: 0 }],
    });
    for (let i = 0; i < 20; i++) endTurn(match);
    expect(match.throwers[0].balls).toBe(-1);
    expect(match.status).toBe("playing");
  });
});

describe("雪球大作战 · 电脑对手", () => {
  function duel(level: "easy" | "normal" | "hard") {
    return createMatch({
      mode: "ai",
      windPlan: [1.6],
      targets: [
        { x: 4, y: 2.4, owner: 0 },
        { x: 52, y: 2.4, owner: 1 },
      ],
      throwers: [
        { seat: 0, x: 12, dir: 1, balls: -1, walls: 0 },
        { seat: 1, x: 44, dir: -1, balls: -1, walls: 0, ai: level },
      ],
    });
  }

  it("轮到电脑它就会自己出手,而且认准对面的灯笼", () => {
    const match = duel("hard");
    takeShot(match, 45, 10);
    expect(current(match).ai).toBe("hard");
    const out = aiTurn(match, mulberry32(7));
    expect(out).not.toBeNull();
    expect(match.shots).toBe(2);
  });

  it("会算风的高档打得比不会算风的低档准", () => {
    let easyMiss = 0;
    let hardMiss = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const [level, add] of [["easy", 0] as const, ["hard", 1] as const]) {
        const match = duel(level);
        takeShot(match, 45, 10);
        const out = aiTurn(match, mulberry32(seed));
        const miss = Math.abs((out?.shot.x ?? 0) - 4);
        if (add === 0) easyMiss += miss;
        else hardMiss += miss;
      }
    }
    expect(hardMiss).toBeLessThan(easyMiss);
  });

  it("没有电脑的座位调 aiTurn 什么也不做", () => {
    const match = duel("easy");
    expect(current(match).ai).toBeNull();
    expect(aiTurn(match, mulberry32(1))).toBeNull();
  });
});

describe("雪球大作战 · 评分与无尽波次", () => {
  it("雪球省得越多星星越多", () => {
    expect(rateLevel(10, 10)).toBe(3);
    expect(rateLevel(4, 10)).toBe(3);
    expect(rateLevel(2, 10)).toBe(2);
    expect(rateLevel(0, 10)).toBe(1);
    expect(rateLevel(3, 0)).toBe(1);
  });

  it("过关的话只夸不损,失败的话只给下一次的办法", () => {
    for (const stars of [1, 2, 3] as const) {
      const line = winLine(stars, 5, 12);
      expect(line).toContain("12");
      expect(line).not.toMatch(/输|死|血|伤|笨/);
    }
    expect(loseLine("雪球用完了", 2)).toContain("试投");
  });

  it("无尽一波比一波多、一波比一波快,但都有上限", () => {
    expect(endlessWaveSize(1)).toBeLessThan(endlessWaveSize(9));
    expect(endlessWaveSize(99)).toBeLessThanOrEqual(7);
    expect(endlessMarch(1)).toBeLessThan(endlessMarch(9));
    expect(endlessMarch(99)).toBeLessThanOrEqual(2.4);
  });

  it("同一波的雪怪站位是确定的,而且都在雪堡外面", () => {
    const a = endlessTargets(5, mulberry32(3));
    const b = endlessTargets(5, mulberry32(3));
    expect(a).toEqual(b);
    expect(a).toHaveLength(endlessWaveSize(5));
    for (const t of a) {
      expect(t.kind).toBe("monster");
      expect(t.x).toBeGreaterThan(GUARD_X + 8);
    }
  });
});
