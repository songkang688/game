/**
 * 雪球大作战 · 抛物线与风偏单测。
 *
 * 这一份只测数学,不测玩法:轨迹形状、飞行时间、落点、风把落点吹偏多少、
 * 反解力度,以及三档 AI 在「会不会算风」上的真实差距。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  AI_PROFILES,
  FIELD_W,
  GRAVITY,
  GROUND_Y,
  MAX_SPEED,
  MAX_WIND,
  MIN_SPEED,
  aiAim,
  clamp,
  flightTime,
  landingX,
  missBy,
  peakHeight,
  positionAt,
  solvePower,
  speedToPower,
  throwSpeed,
  trajectory,
  velocity,
  windBarLength,
  windDrift,
  windLabel,
  windLevel,
  type AiLevel,
  type ThrowSpec,
} from "./physics";

function shot(over: Partial<ThrowSpec> = {}): ThrowSpec {
  return { x: 5, y: 2, angle: 45, power: 60, dir: 1, wind: 0, ...over };
}

describe("蓄力条", () => {
  it("蓄力越满出手越快,两头正好是上下限", () => {
    expect(throwSpeed(0)).toBeCloseTo(MIN_SPEED, 6);
    expect(throwSpeed(100)).toBeCloseTo(MAX_SPEED, 6);
    expect(throwSpeed(50)).toBeGreaterThan(throwSpeed(20));
  });

  it("超出范围会被夹回来,坏数据也不会算出 NaN", () => {
    expect(throwSpeed(-30)).toBe(MIN_SPEED);
    expect(throwSpeed(999)).toBe(MAX_SPEED);
    expect(Number.isFinite(throwSpeed(Number.NaN))).toBe(true);
    expect(clamp(Number.NaN, 1, 9)).toBe(1);
  });

  it("速度换回蓄力读数是同一件事的两面", () => {
    for (const p of [0, 17, 43, 88, 100]) {
      expect(speedToPower(throwSpeed(p))).toBeCloseTo(p, 6);
    }
  });
});

describe("出手速度的分解", () => {
  it("角度越大越往上飞,越小越往前飞", () => {
    const flat = velocity(shot({ angle: 15 }));
    const high = velocity(shot({ angle: 75 }));
    expect(flat.x).toBeGreaterThan(high.x);
    expect(high.y).toBeGreaterThan(flat.y);
  });

  it("面朝左的时候水平速度是负的", () => {
    expect(velocity(shot({ dir: -1 })).x).toBeLessThan(0);
    expect(velocity(shot({ dir: -1 })).y).toBeGreaterThan(0);
  });

  it("速度大小和角度无关,只由蓄力决定", () => {
    for (const angle of [10, 30, 45, 60, 80]) {
      const v = velocity(shot({ angle }));
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(throwSpeed(60), 6);
    }
  });
});

describe("抛物线本身", () => {
  it("轨迹是先升后降的抛物线", () => {
    const s = shot();
    const a = positionAt(s, 0.2).y;
    const b = positionAt(s, 0.6).y;
    const c = positionAt(s, 2.4).y;
    expect(b).toBeGreaterThan(a);
    expect(c).toBeLessThan(b);
  });

  it("t = 0 时就在出手点", () => {
    const s = shot();
    expect(positionAt(s, 0)).toEqual({ x: s.x, y: s.y });
  });

  it("最高点的高度和公式对得上", () => {
    const s = shot({ angle: 90 });
    const v = velocity(s);
    expect(peakHeight(s)).toBeCloseTo(s.y + (v.y * v.y) / (2 * GRAVITY), 6);
  });

  it("落地那一刻高度正好是地面", () => {
    const s = shot();
    const t = flightTime(s);
    expect(positionAt(s, t).y).toBeCloseTo(GROUND_Y, 6);
  });

  it("站得越高飞得越久", () => {
    expect(flightTime(shot({ y: 8 }))).toBeGreaterThan(flightTime(shot({ y: 2 })));
  });

  it("采样出来的轨迹从出手点开始、以落地点结束", () => {
    const s = shot();
    const pts = trajectory(s);
    expect(pts.length).toBeGreaterThan(5);
    expect(pts[0].x).toBeCloseTo(s.x, 6);
    expect(pts[pts.length - 1].y).toBeCloseTo(GROUND_Y, 6);
    expect(pts[pts.length - 1].x).toBeCloseTo(landingX(s), 6);
  });
});

describe("落点", () => {
  it("同一个角度,力度越大落得越远", () => {
    const near = landingX(shot({ power: 40 }));
    const far = landingX(shot({ power: 90 }));
    expect(far).toBeGreaterThan(near);
  });

  it("45 度附近最远(平地上的老规矩)", () => {
    const at45 = landingX(shot({ y: 0, angle: 45 }));
    expect(at45).toBeGreaterThan(landingX(shot({ y: 0, angle: 20 })));
    expect(at45).toBeGreaterThan(landingX(shot({ y: 0, angle: 70 })));
  });

  it("差多少是按面朝方向算的:没到是负数,过头是正数", () => {
    const s = shot({ power: 70 });
    const land = landingX(s);
    expect(missBy(s, land - 5)).toBeCloseTo(5, 6);
    expect(missBy(s, land + 5)).toBeCloseTo(-5, 6);
    const left = shot({ x: 55, dir: -1, power: 70 });
    expect(missBy(left, landingX(left) + 5)).toBeCloseTo(5, 6);
  });
});

describe("风偏", () => {
  it("顺风飞得更远,逆风飞得更近", () => {
    const still = landingX(shot({ wind: 0 }));
    const tail = landingX(shot({ wind: 2 }));
    const head = landingX(shot({ wind: -2 }));
    expect(tail).toBeGreaterThan(still);
    expect(head).toBeLessThan(still);
  });

  it("风不改变飞行时间,只推着横着走", () => {
    expect(flightTime(shot({ wind: 3 }))).toBeCloseTo(flightTime(shot({ wind: 0 })), 6);
    expect(positionAt(shot({ wind: 3 }), 0.7).y).toBeCloseTo(positionAt(shot({ wind: 0 }), 0.7).y, 6);
  });

  it("偏出去的距离正好是落点之差", () => {
    const s = shot({ wind: 2.5 });
    expect(windDrift(s)).toBeCloseTo(landingX(s) - landingX({ ...s, wind: 0 }), 6);
  });

  it("飞得越久偏得越多:高抛比平抛更怕风", () => {
    const highArc = windDrift(shot({ angle: 70, wind: 2 }));
    const flatArc = windDrift(shot({ angle: 25, wind: 2 }));
    expect(Math.abs(highArc)).toBeGreaterThan(Math.abs(flatArc));
  });

  it("风偏随时间是平方长的:时间翻倍,偏移大约变四倍", () => {
    const weak = shot({ power: 40, wind: 2 });
    const strong = shot({ power: 100, wind: 2 });
    const ratioT = flightTime(strong) / flightTime(weak);
    const ratioD = windDrift(strong) / windDrift(weak);
    expect(ratioD).toBeCloseTo(ratioT * ratioT, 4);
  });

  it("无风就一点都不偏", () => {
    expect(windDrift(shot({ wind: 0 }))).toBe(0);
  });
});

describe("风标文案", () => {
  it("按风力分四档", () => {
    expect(windLevel(0)).toBe(0);
    expect(windLevel(0.8)).toBe(1);
    expect(windLevel(1.6)).toBe(2);
    expect(windLevel(2.8)).toBe(3);
    expect(windLevel(-2.8)).toBe(3);
  });

  it("箭头方向跟着风走,无风就不画箭头", () => {
    expect(windLabel(0)).toBe("无风");
    expect(windLabel(2)).toContain("→");
    expect(windLabel(-2)).toContain("←");
    expect(windLabel(2.9)).toContain("大风");
  });

  it("箭头长度是 0 到 1 之间的比例", () => {
    expect(windBarLength(0)).toBe(0);
    expect(windBarLength(MAX_WIND)).toBe(1);
    expect(windBarLength(99)).toBe(1);
  });
});

describe("反解力度", () => {
  it("解出来的力度扔出去就落在目标上", () => {
    for (const targetX of [18, 27, 39, 50]) {
      for (const wind of [-2, 0, 1.5]) {
        const base = { x: 5, y: 2, angle: 45, dir: 1 as const, wind };
        const power = solvePower(base, targetX);
        expect(power, `目标 ${targetX} 风 ${wind}`).not.toBeNull();
        expect(landingX({ ...base, power: power! })).toBeCloseTo(targetX, 2);
      }
    }
  });

  it("面朝左也一样解得出来", () => {
    const base = { x: 55, y: 2, angle: 50, dir: -1 as const, wind: 1 };
    const power = solvePower(base, 20);
    expect(power).not.toBeNull();
    expect(landingX({ ...base, power: power! })).toBeCloseTo(20, 2);
  });

  it("够不着就老实说够不着", () => {
    const base = { x: 5, y: 2, angle: 45, dir: 1 as const, wind: 0 };
    expect(solvePower(base, 500)).toBeNull();
  });

  it("场地这么宽,45 度满力扔得到对面", () => {
    const base = { x: 5, y: 2, angle: 45, dir: 1 as const, wind: 0 };
    expect(landingX({ ...base, power: 100 })).toBeGreaterThan(FIELD_W - 8);
  });
});

describe("三档 AI", () => {
  /** 让某一档 AI 在有风的场上打 200 发,统计平均差多远 */
  function meanMiss(level: AiLevel, wind: number): number {
    const rand = mulberry32(2026);
    const from = { x: 5, y: 2, dir: 1 as const };
    let total = 0;
    const shots = 200;
    for (let i = 0; i < shots; i++) {
      const targetX = 30 + (i % 17);
      const aim = aiAim(level, from, targetX, wind, rand);
      total += Math.abs(landingX({ ...from, ...aim, wind }) - targetX);
    }
    return total / shots;
  }

  it("三档的性格写清楚了:只有高档会看风", () => {
    expect(AI_PROFILES.easy.readsWind).toBe(false);
    expect(AI_PROFILES.normal.readsWind).toBe(false);
    expect(AI_PROFILES.hard.readsWind).toBe(true);
    expect(AI_PROFILES.easy.jitter).toBeGreaterThan(AI_PROFILES.normal.jitter);
    expect(AI_PROFILES.normal.jitter).toBeGreaterThan(AI_PROFILES.hard.jitter);
    for (const p of Object.values(AI_PROFILES)) {
      expect(p.name.length).toBeGreaterThan(1);
      expect(p.desc.length).toBeGreaterThan(6);
    }
  });

  it("没风的时候,越高档打得越准", () => {
    const easy = meanMiss("easy", 0);
    const normal = meanMiss("normal", 0);
    const hard = meanMiss("hard", 0);
    expect(normal).toBeLessThan(easy);
    expect(hard).toBeLessThan(normal);
  });

  it("一起风,中低档立刻被吹偏,高档几乎不受影响", () => {
    const normalStill = meanMiss("normal", 0);
    const normalWindy = meanMiss("normal", 2.5);
    const hardWindy = meanMiss("hard", 2.5);
    expect(normalWindy).toBeGreaterThan(normalStill + 1);
    expect(hardWindy).toBeLessThan(normalWindy / 3);
    expect(hardWindy).toBeLessThan(1.5);
  });

  it("同一颗种子,AI 每次的选择都一样", () => {
    const from = { x: 5, y: 2, dir: 1 as const };
    const a = aiAim("hard", from, 33, 1.2, mulberry32(5));
    const b = aiAim("hard", from, 33, 1.2, mulberry32(5));
    expect(a).toEqual(b);
  });

  it("AI 的力度和角度永远在合法范围里", () => {
    const rand = mulberry32(9);
    const from = { x: 5, y: 2, dir: 1 as const };
    for (let i = 0; i < 100; i++) {
      const aim = aiAim("easy", from, 12 + (i % 40), (i % 7) - 3, rand);
      expect(aim.power).toBeGreaterThanOrEqual(5);
      expect(aim.power).toBeLessThanOrEqual(100);
      expect(aim.angle).toBeGreaterThanOrEqual(15);
      expect(aim.angle).toBeLessThanOrEqual(75);
    }
  });

  it("够不着的目标也不会让 AI 卡住", () => {
    const aim = aiAim("hard", { x: 5, y: 2, dir: 1 }, 999, 0, mulberry32(1));
    expect(Number.isFinite(aim.power)).toBe(true);
    expect(aim.power).toBeGreaterThan(0);
  });
});
