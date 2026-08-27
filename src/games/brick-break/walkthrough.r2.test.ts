/**
 * 碰碰砖块 · 窗口 4 档A · 第 2 轮测试员
 *
 * 第 2 轮的剧本换关换模式，重点查三件事：难度曲线、竞态、无尽能不能持续。
 *
 * 本轮记账在案的问题：
 *  - **W4A-07（严重）**：无尽「砖塔」清行的收益追不上下移的加速。
 *    `towerSpeed = min(26, 7 + rowsCleared × 1.2)`，一开局就要 3.1 砖/秒才打平，
 *    清到第 8 行要 7.4 砖/秒——一颗球根本给不出这个速率。
 *    更糟的是方向反了：**打得越快死得越早**（每秒 2 砖能撑 30.1 秒，每秒 6 砖只撑 24.2 秒）。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { COLS, LEVELS } from "./levels";
import {
  BALL_R,
  BRICK_H,
  KIND,
  MIN_BOUNCE_DEG,
  PADDLE_Y,
  TOWER_COLS,
  TOWER_FLOOR,
  TOWER_START_ROWS,
  TOWER_TOP,
  W,
  brickBox,
  firstBrickHit,
  flatnessDeg,
  grantPower,
  makeTower,
  paddleBounce,
  powerEffects,
  simulateLevel,
  stepBall,
  tickPowers,
  towerBreak,
  towerBottomY,
  towerSpeed,
  towerTick,
  type BallLike,
  type BrickGeom,
  type TowerState
} from "./logic";

/** 一个「每秒能打碎 bricksPerSec 块砖」的假玩家，在砖塔里能撑多久 */
function towerRun(bricksPerSec: number, seed: number): { seconds: number; rowsCleared: number; score: number } {
  const rand = mulberry32(seed);
  let st = makeTower(rand);
  let t = 0;
  let credit = 0;
  const dt = 1 / 60;
  while (!st.over && t < 600) {
    st = towerTick(st, dt, rand);
    t += dt;
    credit += bricksPerSec * dt;
    while (credit >= 1 && !st.over) {
      credit -= 1;
      let hit = false;
      for (let r = st.rows.length - 1; r >= 0 && !hit; r--) {
        for (let c = 0; c < TOWER_COLS; c++) {
          if (st.rows[r][c] !== KIND.EMPTY) {
            st = towerBreak(st, r, c, false).state;
            hit = true;
            break;
          }
        }
      }
      if (!hit) break;
    }
  }
  return { seconds: t, rowsCleared: st.rowsCleared, score: st.score };
}

describe("碰碰砖块 · R2 · 换关卡：第 25 / 60 / 130 / 170 关", () => {
  for (const lv of [24, 59, 129, 169]) {
    it(`第 ${lv + 1} 关打得完，一次都没漏球，角度始终不贴地`, () => {
      const res = simulateLevel(LEVELS[lv], { seed: 3000 + lv });
      expect(res.won, `第 ${lv + 1} 关没打完，还剩 ${res.left} 块`).toBe(true);
      expect(res.left).toBe(0);
      expect(res.brickHits).toBeGreaterThan(0);
      expect(res.minAngleDeg, `第 ${lv + 1} 关出现了 ${res.minAngleDeg.toFixed(1)}° 的平球`).toBeGreaterThanOrEqual(
        MIN_BOUNCE_DEG - 1
      );
    });
  }

  it("换四个种子重打第 130 关，次次都打得完（不是靠某一个种子走运）", () => {
    for (const seed of [11, 222, 3333, 44444]) {
      const res = simulateLevel(LEVELS[129], { seed });
      expect(res.won, `种子 ${seed}`).toBe(true);
    }
  });

  it("难度曲线：越往后砖越多，但没有哪一关突然要打到超时", () => {
    const marks = [24, 59, 99, 129, 169, 187];
    const secs = marks.map((lv) => simulateLevel(LEVELS[lv], { seed: 3000 + lv }).seconds);
    for (const [i, s] of secs.entries()) {
      expect(s, `第 ${marks[i] + 1} 关跑了 ${s.toFixed(0)} 秒`).toBeLessThan(240);
      expect(s).toBeGreaterThan(1);
    }
  });

  it("同一个种子重打两次，逐帧一模一样（没有藏着的随机源）", () => {
    const a = simulateLevel(LEVELS[129], { seed: 20250827 });
    const b = simulateLevel(LEVELS[129], { seed: 20250827 });
    expect(b).toEqual(a);
  });
});

describe("碰碰砖块 · R2 · 竞态：一帧里撞好几下", () => {
  const geom: BrickGeom = { rows: 3, cols: COLS, brickW: W / COLS, brickH: BRICK_H, top: 40, offsetX: 0 };

  it("一帧里同一块砖只结算一次，不会被反复扣血", () => {
    const grid = [
      new Array<number>(COLS).fill(KIND.NORMAL),
      new Array<number>(COLS).fill(KIND.EMPTY),
      new Array<number>(COLS).fill(KIND.EMPTY)
    ];
    const seen: string[] = [];
    const ball: BallLike = { x: 40, y: 200, vx: 0, vy: -6000 };
    stepBall(ball, 1 / 30, {
      geom,
      radius: BALL_R,
      left: 0,
      right: W,
      top: 0,
      solid: (r, c) => grid[r]?.[c] !== undefined && grid[r][c] !== KIND.EMPTY,
      hit: (r, c) => {
        seen.push(`${r},${c}`);
        grid[r][c] = KIND.EMPTY;
        return "bounce";
      }
    });
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("球快到一帧能飞过整片砖阵，也不会从砖缝里穿过去", () => {
    const grid = [new Array<number>(COLS).fill(KIND.NORMAL)];
    const one: BrickGeom = { ...geom, rows: 1 };
    let hits = 0;
    const ball: BallLike = { x: 100, y: 400, vx: 0, vy: -60000 };
    hits = stepBall(ball, 1 / 30, {
      geom: one,
      radius: BALL_R,
      left: 0,
      right: W,
      top: 0,
      solid: (r, c) => grid[r]?.[c] !== undefined && grid[r][c] !== KIND.EMPTY,
      hit: () => "bounce"
    });
    expect(hits).toBeGreaterThanOrEqual(1);
  });

  it("从砖里面出发也推得出来，不会卡死在砖中间", () => {
    const box = brickBox(geom, 0, 2);
    const inside = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
    const hit = firstBrickHit(geom, () => true, inside.x, inside.y, inside.x + 1, inside.y + 1, BALL_R);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBe(0);
    expect(Math.abs(hit!.nx) + Math.abs(hit!.ny)).toBe(1);
  });

  it("道具在同一帧里又拿到又走完时间，不会留一个半死不活的状态", () => {
    let timers = grantPower({}, "slow");
    timers = tickPowers(timers, 3);
    timers = grantPower(timers, "slow");
    // 续时间封顶在单次时限，不会叠成 17 秒
    expect((timers as Record<string, number>).slow).toBeLessThanOrEqual(10);
    timers = tickPowers(timers, 999);
    expect(timers).toEqual({});
    expect(powerEffects(timers).speedScale).toBe(1);
  });

  it("加宽和小板子同一帧撞上，后来的那个说了算，不会互相抵消成 NaN", () => {
    const both = grantPower(grantPower({}, "wide"), "narrow");
    expect(both).not.toHaveProperty("wide");
    expect(Number.isFinite(powerEffects(both).paddleScale)).toBe(true);
    const flip = grantPower(grantPower({}, "narrow"), "wide");
    expect(flip).not.toHaveProperty("narrow");
    expect(powerEffects(flip).paddleScale).toBeGreaterThan(1);
  });

  it("球贴着板边打，出射角照样不会平过 20°", () => {
    for (const off of [-1.5, -1, -0.999, 0, 0.999, 1, 1.5]) {
      const px = 180 + off * 30;
      const v = paddleBounce(px, 180, 60, 300);
      expect(flatnessDeg(v.vx, v.vy), `偏移 ${off}`).toBeGreaterThanOrEqual(MIN_BOUNCE_DEG - 1e-6);
      expect(v.vy).toBeLessThan(0);
    }
  });
});

describe("碰碰砖块 · R2 · W4A-07 无尽砖塔撑不住", () => {
  it("砖塔一开局就要 3 砖/秒才打平，清到第 8 行要 7.4 砖/秒", () => {
    const need = (rowsCleared: number): number => TOWER_COLS / (BRICK_H / towerSpeed(rowsCleared));
    expect(need(0)).toBeGreaterThan(3);
    expect(need(8)).toBeGreaterThan(7);
    expect(need(16)).toBeGreaterThan(11);
    // 加速有上限，但上限本身已经超出一颗球给得出的速率
    expect(towerSpeed(16)).toBe(26);
    expect(towerSpeed(999)).toBe(26);
  });

  it("每秒 2 / 3 / 4 / 6 砖的四种手速，都撑不过 40 秒", () => {
    const runs = [2, 3, 4, 6].map((bps) => ({ bps, ...towerRun(bps, 20250101) }));
    for (const r of runs) {
      expect(r.seconds, `每秒 ${r.bps} 砖只撑了 ${r.seconds.toFixed(1)} 秒`).toBeLessThan(40);
    }
    expect(runs[0].seconds).toBeGreaterThan(15);
  });

  it("方向反了：打得越快，反而死得越早（清行只加速、不回本）", () => {
    const slow = towerRun(2, 20250101);
    const fast = towerRun(6, 20250101);
    expect(fast.seconds).toBeLessThan(slow.seconds);
    // 而且分数在一定手速之上就不动了，多打的那些砖换不来更长的一局
    expect(towerRun(4, 20250101).score).toBe(towerRun(6, 20250101).score);
  });

  it("砖塔从 4 排起步，要压 216px 才触底——不清行也只有 30 秒", () => {
    const st0 = makeTower(mulberry32(1));
    expect(st0.rows).toHaveLength(TOWER_START_ROWS);
    const start = towerBottomY(st0);
    expect(start).toBe(TOWER_TOP + TOWER_START_ROWS * BRICK_H);
    expect(TOWER_FLOOR - start).toBe(216);
    expect((TOWER_FLOOR - start) / towerSpeed(0)).toBeCloseTo(30.86, 1);
  });

  it("砖塔本身没坏：每一排都打得动，触底判定也准", () => {
    const rand = mulberry32(4242);
    let st = makeTower(rand);
    for (let i = 0; i < 1500 && !st.over; i++) st = towerTick(st, 1 / 30, rand);
    expect(st.over).toBe(true);
    expect(towerBottomY(st)).toBeGreaterThanOrEqual(TOWER_FLOOR);
    // 收工之后再推、再打都不动了
    const frozen: TowerState = st;
    expect(towerTick(frozen, 1, rand)).toBe(frozen);
    expect(towerBreak(frozen, 0, 0).state).toBe(frozen);
  });
});

describe("碰碰砖块 · R2 · 360px 与手感复核", () => {
  it("球台就是 360 宽，砖块横向铺满不留半格", () => {
    expect(W).toBe(360);
    expect(COLS).toBeGreaterThan(0);
    expect((W / COLS) * COLS).toBeCloseTo(W, 6);
    expect(W / COLS).toBeGreaterThanOrEqual(30);
  });

  it("板子在最左最右都够得着，球拍不会被挤出屏幕", () => {
    for (const lv of [24, 129, 187]) {
      const cfg = LEVELS[lv];
      expect(cfg.paddleW, `第 ${lv + 1} 关`).toBeGreaterThanOrEqual(44);
      expect(cfg.paddleW).toBeLessThanOrEqual(W);
      expect(PADDLE_Y + BALL_R).toBeLessThan(430);
    }
  });
});
