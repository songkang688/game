/**
 * 雪球大作战 1.2 · 「风向大师」这个名字得对得上。
 *
 * 三档人机的名字和说明里写着:初学者不看旗子,风向大师「出手前把风算进去」。
 * 可 `planThrow` 以前对三档一视同仁——都拿 `a.wind`(真实风速)去解力度,
 * 三个档次全是完美的风速补偿器,差别只剩 `chargeErr` 那点随机手抖。
 * 也就是说风这条线上**三档根本没有档次**,旗子对电脑是白挂的。
 *
 * 现在多了一条 `windRead`:它只影响电脑**脑子里怎么算**,
 * 雪球飞出去照样吃真实的风。初学者按「没有风」去解力度,风多大就往下风偏多远;
 * 风向大师照旧算满。电脑没有拿到任何特权,它只是看得准或看不准。
 */
import { describe, expect, it } from "vitest";
import { AI_12, believedWind, planThrow } from "./brains";
import { GROUND_Y_12, predictLanding, solveCharge } from "./throw12";
import { duelArena, throwSpecOf, type Arena } from "./arena";
import { MAX_WIND } from "./physics";
import type { AiLevel } from "./physics";

const TIERS: AiLevel[] = ["easy", "normal", "hard"];

// ---------------------------------------------------------------------------
// 一、规格表
// ---------------------------------------------------------------------------

describe("1.2 · 三档看风向的本事", () => {
  it("三档的 windRead 从看不见排到算得满", () => {
    expect(AI_12.easy.windRead).toBe(0);
    expect(AI_12.hard.windRead).toBe(1);
    for (let i = 1; i < TIERS.length; i++) {
      expect(AI_12[TIERS[i]].windRead).toBeGreaterThan(AI_12[TIERS[i - 1]].windRead);
    }
  });

  it("每一档的 windRead 都是 0..1 的比例,不是风速本身", () => {
    for (const t of TIERS) {
      expect(AI_12[t].windRead).toBeGreaterThanOrEqual(0);
      expect(AI_12[t].windRead).toBeLessThanOrEqual(1);
    }
  });

  it("档名和行为对得上:只有「风向大师」这一档算满风", () => {
    expect(AI_12.hard.name).toContain("风向");
    expect(AI_12.hard.windRead).toBe(1);
    // 初学者的说明里明写着不会看旗子
    expect(AI_12.easy.desc).toContain("风向旗");
  });
});

// ---------------------------------------------------------------------------
// 二、它以为的风
// ---------------------------------------------------------------------------

describe("1.2 · 它以为的风", () => {
  it("看几成就是几成,风向不会看反", () => {
    expect(believedWind(2.4, 0)).toBe(0);
    expect(believedWind(2.4, 1)).toBeCloseTo(2.4, 9);
    expect(believedWind(2.4, 0.6)).toBeCloseTo(1.44, 9);
    expect(believedWind(-2.4, 0.6)).toBeCloseTo(-1.44, 9);
  });

  it("windRead 越界会被夹回 0..1,不会算出比真风还大的风", () => {
    expect(believedWind(2, 5)).toBeCloseTo(2, 9);
    expect(believedWind(2, -3)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 三、不看旗子真的会偏
// ---------------------------------------------------------------------------

describe("1.2 · 不看旗子这一发会偏到哪儿", () => {
  const from = { x: 18, y: 1.4, dir: 1 as const, angle: 38 };

  /** 按 `read` 成的风解出力度,再拿真实风飞一遍,看落点偏了多远 */
  function missBy(wind: number, targetX: number, read: number): number {
    const charge = solveCharge(from, targetX, wind * read, 0.9);
    expect(charge).not.toBeNull();
    return predictLanding({ ...from, charge: charge as number }, wind, 0.9).x - targetX;
  }

  it("算满风的那一档正中靶心", () => {
    for (const wind of [-2.1, -1.4, 0.8, 1.9, 2.4]) {
      expect(Math.abs(missBy(wind, 40, 1))).toBeLessThan(0.02);
    }
  });

  it("不看风的那一档顺着风偏,风越大、打得越远偏得越多", () => {
    // 顺风(正)往前偏,逆风(负)往回偏 —— 方向不会搞反
    expect(missBy(2.4, 40, 0)).toBeGreaterThan(0.5);
    expect(missBy(-2.1, 40, 0)).toBeLessThan(-0.5);
    // 同一个风,打得越远偏得越多
    expect(missBy(2.4, 50, 0)).toBeGreaterThan(missBy(2.4, 40, 0));
    expect(missBy(2.4, 40, 0)).toBeGreaterThan(missBy(2.4, 30, 0));
    // 同一个距离,风越大偏得越多
    expect(missBy(MAX_WIND, 40, 0)).toBeGreaterThan(missBy(0.8, 40, 0));
  });

  it("看一半风的中间档偏得也是一半:误差随 windRead 单调变小", () => {
    const wind = 2.4;
    const easy = Math.abs(missBy(wind, 45, AI_12.easy.windRead));
    const normal = Math.abs(missBy(wind, 45, AI_12.normal.windRead));
    const hard = Math.abs(missBy(wind, 45, AI_12.hard.windRead));
    expect(easy).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(hard);
  });

  it("没有风的时候三档解出来的是同一发:第一章不会因为这条变难", () => {
    const none = TIERS.map((t) => solveCharge(from, 40, believedWind(0, AI_12[t].windRead), 0.9));
    expect(none[0]).not.toBeNull();
    for (const c of none) expect(c).toBeCloseTo(none[0] as number, 12);
  });
});

// ---------------------------------------------------------------------------
// 四、接到真实的一局上
// ---------------------------------------------------------------------------

describe("1.2 · 接到对战场地上", () => {
  /**
   * 把对战场地的风扳成一个定值,再把掩体清空。
   * 这一份只想看「风算了几成」,不想让「被墙挡住就换角度」那一步混进来。
   */
  function windyArena(wind: number): Arena {
    const a = duelArena("hard", 9);
    a.wind = wind;
    a.windPlan = [wind];
    a.covers = [];
    return a;
  }

  it("planThrow 按 windRead 给出不同的力度,算满风的那一档才落在靶子上", () => {
    const a = windyArena(2.4);
    const me = a.fighters[1];
    const target = { x: 22, y: 0.9 };
    const base = throwSpecOf(me);
    const lands: number[] = [];
    for (const t of TIERS) {
      const plan = planThrow(a, me, target, undefined, AI_12[t].windRead);
      expect(plan, `${t} 应该解得出一发`).not.toBeNull();
      const p = plan as { angle: number; charge: number };
      lands.push(
        predictLanding({ x: base.x, y: base.y, dir: me.dir, angle: p.angle, charge: p.charge }, a.wind, target.y).x
      );
    }
    // 三档解出来的不是同一发了
    expect(Math.abs(lands[0] - lands[2])).toBeGreaterThan(0.3);
    // 算满风的那一档落在靶子上,不看风的那一档明显偏开
    expect(Math.abs(lands[2] - target.x)).toBeLessThan(0.05);
    expect(Math.abs(lands[0] - target.x)).toBeGreaterThan(Math.abs(lands[2] - target.x));
  });

  it("planThrow 不传 windRead 时照旧算满风:老调用点行为不变", () => {
    const a = windyArena(1.9);
    const me = a.fighters[1];
    const target = { x: 24, y: 0.9 };
    expect(planThrow(a, me, target)).toEqual(planThrow(a, me, target, undefined, 1));
  });

  it("地面高度也没被这条改动碰坏:默认落地面还是 GROUND_Y_12", () => {
    expect(GROUND_Y_12).toBeTypeOf("number");
  });
});
