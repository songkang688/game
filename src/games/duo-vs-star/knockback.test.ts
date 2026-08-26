import { describe, expect, it } from "vitest";
import {
  ANGLE_BY_KIND,
  BUMP_MAX,
  BUMP_PER_POWER,
  MAX_LAUNCH,
  SHIELD_COST_PER_POWER,
  SHIELD_MAX,
  addBump,
  bumpLabel,
  bumpNeededToKnockOut,
  bumpTier,
  clamp,
  clampBump,
  clampShield,
  coolBump,
  distanceToBlast,
  isOutOfBounds,
  launchAngleDeg,
  launchDir,
  launchSpeed,
  launchVector,
  normalizeAngle,
  outOfBoundsSide,
  resolveHit,
  shieldAbsorb,
  simulateLaunch,
  stepFlight,
  willKnockOut,
  type Bounds,
} from "./knockback";

const BOUNDS: Bounds = { left: -150, right: 1110, top: -260, bottom: 720 };

describe("小工具", () => {
  it("clamp 把值夹在区间里", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(30, 0, 10)).toBe(10);
  });

  it("clamp 遇到 NaN 退回下限，不把脏数据传下去", () => {
    expect(clamp(Number.NaN, 2, 9)).toBe(2);
    expect(clamp(Number.POSITIVE_INFINITY, 2, 9)).toBe(9);
  });

  it("clampBump / clampShield 各自守住自己的上下限", () => {
    expect(clampBump(-40)).toBe(0);
    expect(clampBump(9999)).toBe(BUMP_MAX);
    expect(clampShield(-1)).toBe(0);
    expect(clampShield(1e6)).toBe(SHIELD_MAX);
  });

  it("normalizeAngle 归一到 (-180, 180]", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(190)).toBeCloseTo(-170, 6);
    expect(normalizeAngle(-190)).toBeCloseTo(170, 6);
    expect(normalizeAngle(540)).toBeCloseTo(180, 6);
  });
});

describe("护盾泡泡抵消", () => {
  it("没护盾时力度原样打到身上", () => {
    const r = shieldAbsorb(0, 12);
    expect(r.blocked).toBe(0);
    expect(r.through).toBe(12);
    expect(r.popped).toBe(false);
  });

  it("护盾够厚就全挡下来，只掉耐久", () => {
    const r = shieldAbsorb(SHIELD_MAX, 10);
    expect(r.through).toBe(0);
    expect(r.blocked).toBe(10);
    expect(r.shieldLeft).toBeCloseTo(SHIELD_MAX - 10 * SHIELD_COST_PER_POWER, 6);
    expect(r.popped).toBe(false);
  });

  it("护盾不够就只挡一部分，泡泡破掉且耐久归零", () => {
    const r = shieldAbsorb(13, 20);
    expect(r.popped).toBe(true);
    expect(r.shieldLeft).toBe(0);
    expect(r.blocked).toBeCloseTo(13 / SHIELD_COST_PER_POWER, 6);
    expect(r.blocked + r.through).toBeCloseTo(20, 6);
  });

  it("挡下的力度永远不会超过这一下本身，也不会出现负耐久", () => {
    for (const shield of [0, 1, 37, 99, 100]) {
      for (const power of [0, 3, 11, 40]) {
        const r = shieldAbsorb(shield, power);
        expect(r.blocked).toBeGreaterThanOrEqual(0);
        expect(r.through).toBeGreaterThanOrEqual(0);
        expect(r.blocked).toBeLessThanOrEqual(power + 1e-9);
        expect(r.shieldLeft).toBeGreaterThanOrEqual(0);
        expect(r.shieldLeft).toBeLessThanOrEqual(SHIELD_MAX);
      }
    }
  });

  it("力度是 0 或负数时护盾一点都不掉", () => {
    expect(shieldAbsorb(50, 0).shieldLeft).toBe(50);
    expect(shieldAbsorb(50, -8).shieldLeft).toBe(50);
    expect(shieldAbsorb(50, -8).through).toBe(0);
  });
});

describe("击退值累积", () => {
  it("挨一下按力度往上涨", () => {
    expect(addBump(0, 10)).toBeCloseTo(10 * BUMP_PER_POWER, 6);
    expect(addBump(50, 10)).toBeCloseTo(50 + 10 * BUMP_PER_POWER, 6);
  });

  it("连续挨拍是累积的，一下比一下高", () => {
    let bump = 0;
    const seen: number[] = [];
    for (let i = 0; i < 8; i++) {
      bump = addBump(bump, 8);
      seen.push(bump);
    }
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThan(seen[i - 1]);
    }
  });

  it("涨到上限就封顶，不会无限膨胀", () => {
    let bump = 0;
    for (let i = 0; i < 200; i++) bump = addBump(bump, 20);
    expect(bump).toBe(BUMP_MAX);
  });

  it("力度 0 / 负数不涨击退值", () => {
    expect(addBump(30, 0)).toBe(30);
    expect(addBump(30, -5)).toBe(30);
  });

  it("站着喘气会把击退值慢慢降回去，最低到 0", () => {
    expect(coolBump(100, 1, 10)).toBeCloseTo(90, 6);
    expect(coolBump(5, 1, 10)).toBe(0);
    expect(coolBump(0, 5, 10)).toBe(0);
  });

  it("击退值分档与提示语随数值单调变化", () => {
    expect(bumpTier(0)).toBe(0);
    expect(bumpTier(120)).toBe(1);
    expect(bumpTier(280)).toBe(2);
    expect(bumpLabel(0)).toBe("站得稳");
    expect(bumpLabel(300)).toBe("站不住啦");
  });
});

describe("弹飞初速", () => {
  it("击退值越高飞得越快", () => {
    const low = launchSpeed(0, 10, 100);
    const mid = launchSpeed(120, 10, 100);
    const high = launchSpeed(300, 10, 100);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  it("同样的击退值，体重越沉飞得越近", () => {
    const light = launchSpeed(150, 12, 72);
    const heavy = launchSpeed(150, 12, 132);
    expect(light).toBeGreaterThan(heavy);
  });

  it("力度越大飞得越远", () => {
    expect(launchSpeed(100, 18, 100)).toBeGreaterThan(launchSpeed(100, 8, 100));
  });

  it("力度为 0 就完全不动", () => {
    expect(launchSpeed(300, 0, 100)).toBe(0);
  });

  it("初速有上限，再离谱的输入也不会飞出天际", () => {
    expect(launchSpeed(BUMP_MAX, 999, 30)).toBeLessThanOrEqual(MAX_LAUNCH);
    expect(launchSpeed(BUMP_MAX, 999, 30)).toBe(MAX_LAUNCH);
  });

  it("体重超出常识范围会被夹住，不会除以 0", () => {
    expect(Number.isFinite(launchSpeed(100, 10, 0))).toBe(true);
    expect(Number.isFinite(launchSpeed(100, 10, -50))).toBe(true);
  });
});

describe("弹飞方向与角度", () => {
  it("被打的人往「背着对方」的方向飞", () => {
    expect(launchDir(300, 400)).toBe(1);
    expect(launchDir(500, 400)).toBe(-1);
  });

  it("完全重叠时用兜底方向（默认往右）", () => {
    expect(launchDir(400, 400)).toBe(1);
    expect(launchDir(400, 400, -1)).toBe(-1);
  });

  it("朝右打是原角度，朝左打是镜像角度", () => {
    expect(launchAngleDeg("light", 1)).toBeCloseTo(ANGLE_BY_KIND.light, 6);
    expect(launchAngleDeg("light", -1)).toBeCloseTo(180 - ANGLE_BY_KIND.light, 6);
  });

  it("上挑往天上飞、下砸往地上飞", () => {
    const up = launchVector(100, launchAngleDeg("up", 1));
    const down = launchVector(100, launchAngleDeg("down", 1));
    expect(up.vy).toBeLessThan(0);
    expect(down.vy).toBeGreaterThan(0);
  });

  it("左右镜像后横向分量相反、竖直分量一致", () => {
    const right = launchVector(200, launchAngleDeg("heavy", 1));
    const left = launchVector(200, launchAngleDeg("heavy", -1));
    expect(right.vx).toBeCloseTo(-left.vx, 6);
    expect(right.vy).toBeCloseTo(left.vy, 6);
  });

  it("速度分量的长度就是初速本身", () => {
    const v = launchVector(345, 37);
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(345, 6);
  });

  it("机关弹起是笔直朝上的", () => {
    const v = launchVector(300, launchAngleDeg("bounce", 1));
    expect(v.vx).toBeCloseTo(0, 6);
    expect(v.vy).toBeCloseTo(-300, 6);
  });
});

describe("一次命中的完整结算", () => {
  const base = {
    bump: 0,
    shield: 0,
    weight: 100,
    power: 10,
    kind: "light" as const,
    attackerX: 400,
    targetX: 460,
  };

  it("护盾扛住时人一动不动，只掉护盾", () => {
    const r = resolveHit({ ...base, shield: SHIELD_MAX });
    expect(r.fullyBlocked).toBe(true);
    expect(r.vx).toBe(0);
    expect(r.vy).toBe(0);
    expect(r.bump).toBe(0);
    expect(r.shield.shieldLeft).toBeLessThan(SHIELD_MAX);
  });

  it("护盾只挡一半时，剩下的力度照样让人飞出去", () => {
    const full = resolveHit(base);
    const half = resolveHit({ ...base, shield: 12 });
    expect(half.fullyBlocked).toBe(false);
    expect(half.shield.popped).toBe(true);
    expect(half.bump).toBeLessThan(full.bump);
    expect(Math.hypot(half.vx, half.vy)).toBeLessThan(Math.hypot(full.vx, full.vy));
  });

  it("击退值高的人挨同一下会飞得更远", () => {
    const calm = resolveHit(base);
    const wobbly = resolveHit({ ...base, bump: 240 });
    expect(Math.hypot(wobbly.vx, wobbly.vy)).toBeGreaterThan(Math.hypot(calm.vx, calm.vy));
  });

  it("从左边打就往右飞，从右边打就往左飞", () => {
    expect(resolveHit({ ...base, attackerX: 400, targetX: 460 }).vx).toBeGreaterThan(0);
    expect(resolveHit({ ...base, attackerX: 460, targetX: 400 }).vx).toBeLessThan(0);
  });

  it("轻击结算出来的击退值就是 addBump 的结果", () => {
    const r = resolveHit({ ...base, bump: 30 });
    expect(r.bump).toBeCloseTo(addBump(30, 10), 6);
  });
});

describe("飞行积分", () => {
  it("重力把人往下拽", () => {
    const m = stepFlight({ x: 0, y: 0, vx: 0, vy: 0 }, 0.5);
    expect(m.vy).toBeGreaterThan(0);
    expect(m.y).toBeGreaterThan(0);
  });

  it("横向阻力让速度衰减，但方向不变", () => {
    const m = stepFlight({ x: 0, y: 0, vx: 600, vy: 0 }, 0.5);
    expect(m.vx).toBeGreaterThan(0);
    expect(m.vx).toBeLessThan(600);
  });

  it("下落速度有上限，不会一帧穿过整张图", () => {
    let m = { x: 0, y: 0, vx: 0, vy: 0 };
    for (let i = 0; i < 200; i++) m = stepFlight(m, 1 / 60, { maxFall: 400 });
    expect(m.vy).toBeLessThanOrEqual(400 + 1e-6);
  });

  it("风把人往一边吹", () => {
    const windy = stepFlight({ x: 0, y: 0, vx: 0, vy: 0 }, 0.5, { wind: 200 });
    const calm = stepFlight({ x: 0, y: 0, vx: 0, vy: 0 }, 0.5, { wind: 0 });
    expect(windy.x).toBeGreaterThan(calm.x);
  });

  it("dt 为 0 或负数时原地不动", () => {
    const m = stepFlight({ x: 5, y: 6, vx: 7, vy: 8 }, 0);
    expect(m).toEqual({ x: 5, y: 6, vx: 7, vy: 8 });
    expect(stepFlight({ x: 5, y: 6, vx: 7, vy: 8 }, -1).x).toBe(5);
  });

  it("不会改动传进来的对象", () => {
    const src = { x: 1, y: 2, vx: 3, vy: 4 };
    stepFlight(src, 0.2);
    expect(src).toEqual({ x: 1, y: 2, vx: 3, vy: 4 });
  });
});

describe("场地边界判定", () => {
  it("场地正中间不算出界", () => {
    expect(isOutOfBounds(480, 300, BOUNDS)).toBe(false);
    expect(outOfBoundsSide(480, 300, BOUNDS)).toBeNull();
  });

  it("四条弹飞线各自认得出来", () => {
    expect(outOfBoundsSide(-200, 300, BOUNDS)).toBe("left");
    expect(outOfBoundsSide(1200, 300, BOUNDS)).toBe("right");
    expect(outOfBoundsSide(480, -300, BOUNDS)).toBe("top");
    expect(outOfBoundsSide(480, 800, BOUNDS)).toBe("bottom");
  });

  it("正好压在线上还不算出界", () => {
    expect(isOutOfBounds(BOUNDS.left, 300, BOUNDS)).toBe(false);
    expect(isOutOfBounds(BOUNDS.right, 300, BOUNDS)).toBe(false);
    expect(isOutOfBounds(480, BOUNDS.bottom, BOUNDS)).toBe(false);
  });

  it("坐标坏掉时按「掉下去」处理，绝不当作还在场上", () => {
    expect(outOfBoundsSide(Number.NaN, 300, BOUNDS)).toBe("bottom");
    expect(isOutOfBounds(480, Number.NaN, BOUNDS)).toBe(true);
  });

  it("离弹飞线的距离在中间最大、出界后为 0", () => {
    expect(distanceToBlast(480, 230, BOUNDS)).toBeGreaterThan(0);
    expect(distanceToBlast(1200, 300, BOUNDS)).toBe(0);
    expect(distanceToBlast(1105, 300, BOUNDS)).toBeLessThan(distanceToBlast(480, 300, BOUNDS));
  });
});

describe("弹飞模拟", () => {
  /** 云朵广场主平台：落回这块地板就算平安回场 */
  const GROUND = { y: 400, min: 190, max: 770 };

  it("轻轻推一下会稳稳落回平台，不算出界", () => {
    const r = simulateLaunch({ x: 480, y: 380, vx: 120, vy: -60 }, BOUNDS, { ground: GROUND });
    expect(r.out).toBe(false);
    expect(r.landed).toBe(true);
    expect(r.side).toBeNull();
  });

  it("没有地板接着时，迟早会掉到底线之外", () => {
    const r = simulateLaunch({ x: 480, y: 380, vx: 120, vy: -60 }, BOUNDS);
    expect(r.out).toBe(true);
    expect(r.side).toBe("bottom");
    expect(r.landed).toBe(false);
  });

  it("横向飞得够快就会从侧面出界", () => {
    const r = simulateLaunch({ x: 900, y: 200, vx: 1500, vy: -300 }, BOUNDS, { ground: GROUND });
    expect(r.out).toBe(true);
    expect(r.side).toBe("right");
  });

  it("笔直朝上飞得够快会从顶上出界", () => {
    const r = simulateLaunch({ x: 480, y: 300, vx: 0, vy: -1600 }, BOUNDS, { ground: GROUND });
    expect(r.out).toBe(true);
    expect(r.side).toBe("top");
  });

  it("步数上限内没出界就如实报告没出界", () => {
    const r = simulateLaunch({ x: 480, y: 300, vx: 0, vy: 0 }, BOUNDS, { gravity: 0, maxSteps: 30 });
    expect(r.out).toBe(false);
    expect(r.landed).toBe(false);
    expect(r.side).toBeNull();
    expect(r.steps).toBe(30);
    expect(r.minMargin).toBeGreaterThan(0);
  });

  it("击退值低时打不出去，攒够了就能把人送出场外", () => {
    const shot = {
      shield: 0,
      weight: 100,
      power: 16,
      kind: "heavy" as const,
      attackerX: 420,
      targetX: 480,
      targetY: 300,
    };
    expect(willKnockOut({ ...shot, bump: 0 }, BOUNDS, { ground: GROUND })).toBe(false);
    expect(willKnockOut({ ...shot, bump: 300 }, BOUNDS, { ground: GROUND })).toBe(true);
  });

  it("护盾扛住的那一下永远撞不出去", () => {
    expect(
      willKnockOut(
        {
          bump: 300,
          shield: SHIELD_MAX,
          weight: 100,
          power: 6,
          kind: "heavy",
          attackerX: 500,
          targetX: 560,
          targetY: 300,
        },
        BOUNDS,
        { ground: GROUND }
      )
    ).toBe(false);
  });

  it("同样一下轻击，站平台中间接得住，站在边上就被送出去了", () => {
    const shot = {
      bump: 0,
      shield: 0,
      weight: 100,
      power: 8,
      kind: "light" as const,
      targetY: 380,
    };
    const middle = willKnockOut({ ...shot, attackerX: 420, targetX: 480 }, BOUNDS, { ground: GROUND });
    const edge = willKnockOut({ ...shot, attackerX: 700, targetX: 760 }, BOUNDS, { ground: GROUND });
    expect(middle).toBe(false);
    expect(edge).toBe(true);
  });

  it("bumpNeededToKnockOut 找得到刚好能撞出去的击退值", () => {
    const shot = {
      weight: 100,
      power: 16,
      kind: "heavy" as const,
      attackerX: 420,
      targetX: 480,
      targetY: 300,
    };
    const need = bumpNeededToKnockOut(shot, BOUNDS, { ground: GROUND });
    expect(need).not.toBeNull();
    const n = need as number;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(BUMP_MAX);
    expect(willKnockOut({ ...shot, bump: n + 1, shield: 0 }, BOUNDS, { ground: GROUND })).toBe(true);
    expect(willKnockOut({ ...shot, bump: n - 1, shield: 0 }, BOUNDS, { ground: GROUND })).toBe(false);
  });

  it("体重越沉，需要攒的击退值越高", () => {
    const shot = {
      power: 14,
      kind: "heavy" as const,
      attackerX: 420,
      targetX: 480,
      targetY: 300,
    };
    const lightNeed = bumpNeededToKnockOut({ ...shot, weight: 72 }, BOUNDS, { ground: GROUND });
    const heavyNeed = bumpNeededToKnockOut({ ...shot, weight: 132 }, BOUNDS, { ground: GROUND });
    expect(lightNeed).not.toBeNull();
    expect(heavyNeed).not.toBeNull();
    expect(heavyNeed as number).toBeGreaterThan(lightNeed as number);
  });

  it("弹飞线特别远时可能怎么打都出不去，这时如实返回 null", () => {
    const far: Bounds = { left: -99999, right: 99999, top: -99999, bottom: 99999 };
    const need = bumpNeededToKnockOut(
      { weight: 300, power: 1, kind: "light", attackerX: 0, targetX: 10, targetY: 0 },
      far,
      { gravity: 0 }
    );
    expect(need).toBeNull();
  });
});
