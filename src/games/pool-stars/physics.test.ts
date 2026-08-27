// 梨康台球 · 自写 2D 圆碰撞物理的回归测试。
// 这里管三件事:击打给的速度对不对、碰撞与库边的物理量守不守规矩、
// 以及最关键的那条底线——高速球绝对不许穿过库边或者穿过另一颗球。
import { describe, expect, it } from "vitest";
import {
  BALL_KEEP,
  CUSHION_KEEP,
  MAX_SPEED,
  MIN_SPEED,
  POCKETS,
  SPIN_KICK,
  TABLE,
  angleTo,
  bounceCushion,
  clamp,
  collideBalls,
  ghostPoint,
  makeBall,
  mirrorPoint,
  pathClear,
  pocketed,
  simulateShot,
  speedOf,
  spotFree,
  stepWorld,
  strike,
  substepCount,
} from "./physics";

describe("击打", () => {
  it("按角度和力度给母球速度", () => {
    const cue = strike(makeBall(0, "cue", 50, 50), 0, 1);
    expect(cue.vx).toBeCloseTo(MAX_SPEED, 6);
    expect(cue.vy).toBeCloseTo(0, 6);
    const up = strike(makeBall(0, "cue", 50, 50), -Math.PI / 2, 1);
    expect(up.vy).toBeCloseTo(-MAX_SPEED, 6);
  });

  it("力度会被夹在 0..1，最小档也推得动", () => {
    const weak = strike(makeBall(0, "cue", 50, 50), 0, -3);
    expect(speedOf(weak)).toBeCloseTo(MIN_SPEED, 6);
    const strong = strike(makeBall(0, "cue", 50, 50), 0, 9);
    expect(speedOf(strong)).toBeCloseTo(MAX_SPEED, 6);
  });

  it("力度越大初速度越大", () => {
    const a = speedOf(strike(makeBall(0, "cue", 50, 50), 0, 0.3));
    const b = speedOf(strike(makeBall(0, "cue", 50, 50), 0, 0.9));
    expect(b).toBeGreaterThan(a);
  });
});

describe("圆碰撞", () => {
  it("动量守恒（等质量，只沿法线交换冲量）", () => {
    const a = { ...makeBall(0, "cue", 50, 50), vx: 180, vy: 40 };
    const b = { ...makeBall(1, "warm", 50 + TABLE.r * 1.6, 50 + TABLE.r * 0.9), vx: -20, vy: 15 };
    const px = a.vx + b.vx;
    const py = a.vy + b.vy;
    const [na, nb] = collideBalls(a, b);
    expect(na.vx + nb.vx).toBeCloseTo(px, 9);
    expect(na.vy + nb.vy).toBeCloseTo(py, 9);
  });

  it("正碰几乎把速度整个交出去（恢复系数 BALL_KEEP）", () => {
    const a = { ...makeBall(0, "cue", 50, 50), vx: 100, vy: 0 };
    const b = { ...makeBall(1, "warm", 50 + 2 * TABLE.r, 50), vx: 0, vy: 0 };
    const [na, nb] = collideBalls(a, b);
    expect(nb.vx).toBeCloseTo((100 * (1 + BALL_KEEP)) / 2, 6);
    expect(na.vx).toBeLessThan(10);
    expect(na.vx).toBeGreaterThanOrEqual(0);
  });

  it("能量只减不增", () => {
    const a = { ...makeBall(0, "cue", 50, 50), vx: 120, vy: 60 };
    const b = { ...makeBall(1, "warm", 50 + TABLE.r * 1.5, 51), vx: 0, vy: 0 };
    const before = a.vx ** 2 + a.vy ** 2 + b.vx ** 2 + b.vy ** 2;
    const [na, nb] = collideBalls(a, b);
    const after = na.vx ** 2 + na.vy ** 2 + nb.vx ** 2 + nb.vy ** 2;
    expect(after).toBeLessThanOrEqual(before + 1e-9);
  });

  it("正在分开的两颗球不再给冲量，但会把重叠推开", () => {
    const a = { ...makeBall(0, "cue", 50, 50), vx: -50, vy: 0 };
    const b = { ...makeBall(1, "warm", 50 + TABLE.r, 50), vx: 50, vy: 0 };
    const [na, nb] = collideBalls(a, b);
    expect(na.vx).toBe(-50);
    expect(nb.vx).toBe(50);
    expect(nb.x - na.x).toBeCloseTo(2 * TABLE.r, 6);
  });
});

describe("库边", () => {
  it("左库反弹后球留在台面里，速度反向", () => {
    const b = { ...makeBall(0, "cue", TABLE.r - 3, 50), vx: -100, vy: 0 };
    const out = bounceCushion(b);
    expect(out.hit).toBe(true);
    expect(out.ball.x).toBeGreaterThanOrEqual(TABLE.r);
    expect(out.ball.vx).toBeGreaterThan(0);
  });

  it("入射角 = 反射角（两个分量同比例衰减）", () => {
    const b = { ...makeBall(0, "cue", TABLE.r - 1, 50), vx: -60, vy: 45 };
    const out = bounceCushion(b);
    expect(Math.abs(out.ball.vy / out.ball.vx)).toBeCloseTo(Math.abs(45 / 60), 6);
    expect(speedOf(out.ball)).toBeCloseTo(Math.hypot(60, 45) * CUSHION_KEEP, 6);
  });

  it("台面中间的球不会触发库边", () => {
    const b = { ...makeBall(0, "cue", 100, 50), vx: 30, vy: 30 };
    expect(bounceCushion(b).hit).toBe(false);
  });
});

describe("入袋", () => {
  it("角袋与中袋都能吸进去，台面中间不会", () => {
    expect(pocketed({ x: 1, y: 1 })).toBe(0);
    expect(pocketed({ x: 100, y: 2 })).toBe(1);
    expect(pocketed({ x: 199, y: 99 })).toBe(5);
    expect(pocketed({ x: 100, y: 50 })).toBe(-1);
  });

  it("推演里进袋的球会被标记并停住", () => {
    const balls = [
      { ...makeBall(0, "cue", 60, 50), vx: 0, vy: 0 },
      { ...makeBall(1, "warm", 20, 20), vx: -160, vy: -160 },
    ];
    const res = simulateShot({ balls });
    const target = res.balls.find((b) => b.id === 1)!;
    expect(target.potted).toBe(true);
    expect(target.pocket).toBe(0);
    expect(res.potted.map((p) => p.id)).toContain(1);
  });
});

describe("高速球不穿库边", () => {
  it("子步数量随速度增长，单步位移永远小于半个球半径", () => {
    expect(substepCount(10, 1 / 120)).toBe(1);
    const n = substepCount(20000, 1 / 120);
    expect(n).toBeGreaterThan(100);
    expect((20000 / 120 / n)).toBeLessThan(TABLE.r * 0.5 + 1e-9);
  });

  it("每秒两万单位的球整段推演都留在台面里", () => {
    let balls = [{ ...makeBall(0, "cue", 100, 50), vx: 19000, vy: 7000 }];
    for (let i = 0; i < 400; i++) {
      const out = stepWorld(balls, 1 / 120);
      balls = out.balls;
      for (const b of balls) {
        if (b.potted) continue;
        expect(b.x).toBeGreaterThanOrEqual(TABLE.r - 1e-6);
        expect(b.x).toBeLessThanOrEqual(TABLE.w - TABLE.r + 1e-6);
        expect(b.y).toBeGreaterThanOrEqual(TABLE.r - 1e-6);
        expect(b.y).toBeLessThanOrEqual(TABLE.h - TABLE.r + 1e-6);
      }
      if (!out.moving) break;
    }
  });

  it("高速球也不会从另一颗球身上穿过去", () => {
    const balls = [
      { ...makeBall(0, "cue", 20, 50), vx: 6000, vy: 0 },
      { ...makeBall(1, "warm", 120, 50), vx: 0, vy: 0 },
    ];
    const res = simulateShot({ balls }, { maxSeconds: 6 });
    expect(res.firstHit).toBe("warm");
  });
});

describe("一杆推演", () => {
  it("摩擦让所有球最后都停下来", () => {
    const balls = [{ ...makeBall(0, "cue", 30, 50), vx: 300, vy: 120 }];
    const res = simulateShot({ balls });
    for (const b of res.balls) {
      if (!b.potted) expect(speedOf(b)).toBe(0);
    }
  });

  it("力气越大跑得越远（按走过的总路程算，库边来回也算数）", () => {
    const run = (power: number): number => {
      let balls = [strike(makeBall(0, "cue", 20, 50), 0, power)];
      let path = 0;
      for (let i = 0; i < 2000; i++) {
        const prev = balls[0];
        const out = stepWorld(balls, 1 / 120);
        balls = out.balls;
        if (!balls[0].potted) path += Math.hypot(balls[0].x - prev.x, balls[0].y - prev.y);
        if (!out.moving) break;
      }
      return path;
    };
    expect(run(0.85)).toBeGreaterThan(run(0.25));
  });

  it("记得下母球第一颗碰到的是哪一组", () => {
    const balls = [
      strike(makeBall(0, "cue", 40, 50), 0, 0.6),
      makeBall(1, "cool", 120, 50),
      makeBall(2, "warm", 160, 50),
    ];
    const res = simulateShot({ balls });
    expect(res.firstHit).toBe("cool");
    expect(res.firstHitId).toBe(1);
  });

  it("空杆时 firstHit 是 null", () => {
    const res = simulateShot({ balls: [strike(makeBall(0, "cue", 100, 50), Math.PI / 2, 0.2)] });
    expect(res.firstHit).toBeNull();
  });

  it("母球越过中线会被记下来（开球判定要用）", () => {
    const near = simulateShot({ balls: [strike(makeBall(0, "cue", 44, 50), 0, 0.06)] });
    expect(near.cueCrossedCenter).toBe(false);
    const far = simulateShot({ balls: [strike(makeBall(0, "cue", 44, 50), 0, 0.9)] });
    expect(far.cueCrossedCenter).toBe(true);
  });

  it("先吃库再碰球会被记成「先碰库」", () => {
    const balls = [
      strike(makeBall(0, "cue", 60, 60), Math.PI / 2, 0.6),
      makeBall(1, "warm", 60, 30),
    ];
    const res = simulateShot({ balls });
    expect(res.cushionBeforeContact).toBe(true);
    expect(res.firstHit).toBe("warm");
  });

  it("上旋让母球碰撞之后继续往前跟", () => {
    const make = (spin: number) => {
      const cue = { ...strike(makeBall(0, "cue", 40, 50), 0, 0.5), spin };
      return simulateShot({ balls: [cue, makeBall(1, "warm", 90, 50)] });
    };
    const plain = make(0).balls[0];
    const follow = make(1).balls[0];
    expect(SPIN_KICK).toBeGreaterThan(0);
    expect(follow.x).toBeGreaterThan(plain.x);
  });
});

describe("几何小工具", () => {
  it("假想球点在目标球的正后方，距离两个球半径", () => {
    const g = ghostPoint({ x: 100, y: 50 }, { x: 100, y: 0 });
    expect(g.x).toBeCloseTo(100, 6);
    expect(g.y).toBeCloseTo(50 + 2 * TABLE.r, 6);
  });

  it("镜像点关于库边对称", () => {
    const m = mirrorPoint({ x: 60, y: 30 }, "top");
    expect(m.y).toBeCloseTo(2 * TABLE.r - 30, 6);
    expect(m.x).toBe(60);
  });

  it("挡路的球会让 pathClear 返回 false", () => {
    const block = [makeBall(9, "cool", 100, 50)];
    expect(pathClear({ x: 40, y: 50 }, { x: 160, y: 50 }, block)).toBe(false);
    expect(pathClear({ x: 40, y: 20 }, { x: 160, y: 20 }, block)).toBe(true);
  });

  it("袋口和别的球身上都放不下自由球", () => {
    const balls = [makeBall(1, "warm", 100, 50)];
    expect(spotFree({ x: 100, y: 50 }, balls)).toBe(false);
    expect(spotFree(POCKETS[0], balls)).toBe(false);
    expect(spotFree({ x: 60, y: 30 }, balls)).toBe(true);
  });

  it("angleTo 和 clamp 都按预期工作", () => {
    expect(angleTo({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0, 9);
    expect(angleTo({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2, 9);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
  });
});
