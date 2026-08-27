/**
 * 1.2 投掷物理的用例。
 *
 * 这一层是整款的地基:落点圈敢画、AI 敢算、用例敢断言,全靠「同样的输入永远同样的结果」。
 * 所以这里既验物理是不是讲道理(蓄力越久越远、有阻力比没阻力近、顺风更远),
 * 也验那个**承诺**:真实落点一定落在落点圈里。
 */
import { describe, expect, it } from "vitest";
import {
  AIR_DRAG,
  ANGLE_MAX_12,
  ANGLE_MIN_12,
  CHARGE_MAX,
  GRAVITY_12,
  LAND_R_MIN,
  SPEED_MAX,
  SPEED_MIN,
  STEP_12,
  aimAt12,
  applySpread,
  chargeCurve,
  chargeRatio,
  chargeSpeed,
  clamp12,
  flight,
  landingCircle,
  launch,
  predictLanding,
  releaseSpread,
  solveCharge,
  stepBall,
  windWord,
  type Throw12,
} from "./throw12";

const from = { x: 6, y: 1.5, dir: 1 as const };

function spec(over: Partial<Throw12> = {}): Throw12 {
  return { x: 6, y: 1.5, angle: 45, dir: 1, charge: 0.6, ...over };
}

describe("蓄力曲线", () => {
  it("按住 0 到 1.2 秒映射成 0..1,按过头也只算满档", () => {
    expect(chargeRatio(0)).toBe(0);
    expect(chargeRatio(CHARGE_MAX / 2)).toBeCloseTo(0.5, 6);
    expect(chargeRatio(CHARGE_MAX)).toBe(1);
    expect(chargeRatio(99)).toBe(1);
    expect(chargeRatio(-3)).toBe(0);
  });

  it("曲线严格单调、两头对得上,而且是「先慢后快」——前半段的涨幅小于后半段", () => {
    expect(chargeCurve(0)).toBe(0);
    expect(chargeCurve(1)).toBeCloseTo(1, 6);
    let prev = -1;
    for (let r = 0; r <= 1.0001; r += 0.05) {
      const v = chargeCurve(r);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
    const firstHalf = chargeCurve(0.5) - chargeCurve(0);
    const secondHalf = chargeCurve(1) - chargeCurve(0.5);
    expect(secondHalf).toBeGreaterThan(firstHalf);
  });

  it("出手速度从 SPEED_MIN 一路涨到 SPEED_MAX,一按住就有速度(轻投也扔得出去)", () => {
    expect(chargeSpeed(0)).toBeCloseTo(SPEED_MIN, 6);
    expect(chargeSpeed(CHARGE_MAX)).toBeCloseTo(SPEED_MAX, 6);
    expect(chargeSpeed(0.3)).toBeGreaterThan(SPEED_MIN);
    expect(chargeSpeed(0.3)).toBeLessThan(chargeSpeed(0.9));
  });

  it("按得越久落得越远(无风时严格单调),这是小朋友能建立的第一条因果", () => {
    let prev = -Infinity;
    for (let c = 0; c <= CHARGE_MAX + 1e-9; c += 0.1) {
      const x = predictLanding(spec({ charge: c, angle: 42 })).x;
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
  });
});

describe("定步长积分", () => {
  it("同样的出手、同样的风,飞一百次也是同一条轨迹", () => {
    const a = flight(spec({ charge: 0.8 }), { wind: 1.4 });
    const b = flight(spec({ charge: 0.8 }), { wind: 1.4 });
    expect(a.x).toBe(b.x);
    expect(a.t).toBe(b.t);
    expect(a.points.length).toBe(b.points.length);
  });

  it("空气阻力真的在拖后腿:同一发关掉阻力会飞得更远", () => {
    // 手写一遍「没有阻力」的同一套积分,拿来当对照组
    const noDrag = (s: Throw12): number => {
      let b = launch(s);
      let x = b.x;
      let y = b.y;
      for (let i = 0; i < 4000; i++) {
        const vy = b.vy - GRAVITY_12 * STEP_12;
        const next = { vx: b.vx, vy, x: x + b.vx * STEP_12, y: y + vy * STEP_12 };
        if (next.y <= 0 && next.vy < 0) return next.x;
        b = next;
        x = next.x;
        y = next.y;
      }
      return x;
    };
    const s = spec({ charge: 1.2, angle: 40 });
    expect(AIR_DRAG).toBeGreaterThan(0);
    expect(predictLanding(s).x).toBeLessThan(noDrag(s));
  });

  it("横向被空气拽着追风速:顺风落得更远,逆风落得更近", () => {
    const s = spec({ charge: 1 });
    const calm = predictLanding(s, 0).x;
    expect(predictLanding(s, 2.5).x).toBeGreaterThan(calm + 0.5);
    expect(predictLanding(s, -2.5).x).toBeLessThan(calm - 0.5);
  });

  it("半隐式欧拉不会凭空长出能量:一直往上抛,速度只会被重力吃掉", () => {
    let b = { x: 0, y: 0, vx: 0, vy: 20 };
    let prev = b.vy;
    for (let i = 0; i < 50; i++) {
      b = stepBall(b, STEP_12, 0);
      expect(b.vy).toBeLessThan(prev);
      prev = b.vy;
    }
  });

  it("出手角被夹在 8..82 度之间,乱传也不会飞出常识", () => {
    const low = launch(spec({ angle: -40 }));
    const high = launch(spec({ angle: 200 }));
    const min = launch(spec({ angle: ANGLE_MIN_12 }));
    const max = launch(spec({ angle: ANGLE_MAX_12 }));
    expect(low.vy).toBeCloseTo(min.vy, 6);
    expect(high.vy).toBeCloseTo(max.vy, 6);
  });

  it("`predictLanding` 和 `flight` 说的是同一件事", () => {
    const s = spec({ charge: 0.9, angle: 55 });
    const f = flight(s, { wind: -1.1 });
    const p = predictLanding(s, -1.1);
    expect(p.x).toBeCloseTo(f.x, 6);
    expect(p.t).toBeCloseTo(f.t, 6);
  });
});

describe("落点圈", () => {
  it("圈是一句能兑现的承诺:抖到任何一个极端,真实落点都还在圈里", () => {
    for (const charge of [0, 0.25, 0.6, 0.95, 1.2]) {
      for (const angle of [15, 30, 45, 62, 78]) {
        for (const wind of [-3, -1, 0, 1.6, 3]) {
          const s = spec({ charge, angle });
          const ring = landingCircle(s, wind);
          for (const u of [-1, -0.5, 0, 0.4, 1]) {
            const real = predictLanding(applySpread(s, u), wind).x;
            expect(Math.abs(real - ring.x)).toBeLessThanOrEqual(ring.r + 1e-6);
          }
        }
      }
    }
  });

  it("飞得越远,圈越大也越模糊——「越远越模糊」是算出来的,不是画上去的", () => {
    const near = landingCircle(spec({ charge: 0.15, angle: 40 }));
    const far = landingCircle(spec({ charge: 1.2, angle: 40 }));
    expect(far.t).toBeGreaterThan(near.t);
    expect(far.r).toBeGreaterThan(near.r);
    expect(far.blur).toBeGreaterThan(near.blur);
    expect(near.r).toBeGreaterThanOrEqual(LAND_R_MIN);
    expect(far.blur).toBeLessThanOrEqual(1);
  });

  it("用力过猛就没那么准:满蓄力的出手抖动明显大于轻投", () => {
    expect(releaseSpread(spec({ charge: 1.2 }))).toBeGreaterThan(releaseSpread(spec({ charge: 0 })) * 1.5);
    // 不抖的那一发就是圆心本身
    const s = spec({ charge: 0.7 });
    expect(applySpread(s, 0).angle).toBeCloseTo(s.angle, 6);
  });
});

describe("解力度与挑角度", () => {
  it("解出来的力度真的能打中(误差不到半格)", () => {
    for (const targetX of [14, 22, 31, 40]) {
      for (const wind of [-2, 0, 2]) {
        const charge = solveCharge({ ...from, angle: 46 }, targetX, wind);
        expect(charge).not.toBeNull();
        const land = predictLanding({ ...from, angle: 46, charge: charge as number }, wind).x;
        expect(Math.abs(land - targetX)).toBeLessThan(0.5);
      }
    }
  });

  it("够不着就老老实实返回 null,不会硬凑一个假答案", () => {
    expect(solveCharge({ ...from, angle: 46 }, 500, 0)).toBeNull();
  });

  it("目标比出手点高也能解:出手第一帧在目标线以下,不该被判成「已经落地」", () => {
    const aim = aimAt12(from, { x: 30, y: 6.3 }, 0);
    expect(aim).not.toBeNull();
    const land = predictLanding({ ...from, angle: aim!.angle, charge: aim!.charge }, 0, 6.3).x;
    expect(Math.abs(land - 30)).toBeLessThan(0.6);
  });

  it("clamp12 顺手兜住 NaN,坏数据不会一路传进画面", () => {
    expect(clamp12(Number.NaN, 3, 9)).toBe(3);
    expect(clamp12(99, 3, 9)).toBe(9);
    expect(clamp12(-99, 3, 9)).toBe(3);
  });
});

describe("风标文案", () => {
  it("按风力分四档,方向用箭头,不出现看不懂的数字", () => {
    expect(windWord(0)).toBe("无风");
    expect(windWord(0.8)).toContain("→");
    expect(windWord(-0.8)).toContain("←");
    expect(windWord(2.6)).toContain("大风");
    expect(windWord(1.5)).toContain("有点风");
  });
});
