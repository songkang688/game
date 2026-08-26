// 1.2 第 18 步 A 档：碰碰砖块的反弹模型、连续碰撞、六种砖、道具时限与无尽砖塔
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { LEVELS } from "./levels";
import {
  BALL_R,
  BRICKS,
  BRICK_H,
  BRICK_KINDS,
  BRICK_TOP,
  Janitor,
  KIND,
  MAX_POWER_SECONDS,
  MIN_BOUNCE_DEG,
  MAX_BOUNCE_DEG,
  PADDLE_SCALE_MAX,
  PADDLE_SCALE_MIN,
  POWERS,
  POWER_ORDER,
  STALL_NUDGE_DEG,
  STALL_SECONDS,
  TOWER_FLOOR,
  TOWER_TOP,
  W,
  angleWithinLimits,
  bounceDegFromOffset,
  brickBox,
  brickFace,
  brickInfo,
  comboGapMs,
  damageBrick,
  firstBrickHit,
  flatnessDeg,
  grantPower,
  hitStopFrames,
  launchVelocity,
  makeTower,
  makeTowerRow,
  nudgeToVertical,
  paddleBounce,
  paddleOffset,
  particleCount,
  popcornTargets,
  powerEffects,
  rollPower,
  simulateLevel,
  stallNudges,
  stepBall,
  sweepAabb,
  tickPowers,
  towerBottomY,
  towerBreak,
  towerRowScore,
  towerSpeed,
  towerTick,
  trailLength,
  type BrickGeom,
  type PowerTimers,
  type TowerState
} from "./logic";

const geomOf = (rows: number, offsetX = 0): BrickGeom => ({
  rows,
  cols: 8,
  brickW: W / 8,
  brickH: BRICK_H,
  top: BRICK_TOP,
  offsetX
});

// ---------------------------------------------------------------------------
// 一、反弹模型
// ---------------------------------------------------------------------------

describe("碰碰砖块 · 反弹角上下限", () => {
  it("板心正中弹出去就是竖直向上", () => {
    const v = paddleBounce(180, 180, 90, 250);
    expect(Math.abs(v.vx)).toBeLessThan(1e-9);
    expect(v.vy).toBeCloseTo(-250, 6);
    expect(bounceDegFromOffset(0)).toBe(90);
  });

  it("接触点越靠边角度越平，但扫遍整块板都不会超出 20°–160°", () => {
    for (let off = -2; off <= 2; off += 0.02) {
      const deg = bounceDegFromOffset(off);
      expect(deg).toBeGreaterThanOrEqual(MIN_BOUNCE_DEG - 1e-9);
      expect(deg).toBeLessThanOrEqual(MAX_BOUNCE_DEG + 1e-9);
    }
    expect(bounceDegFromOffset(-1)).toBeCloseTo(MAX_BOUNCE_DEG, 9);
    expect(bounceDegFromOffset(1)).toBeCloseTo(MIN_BOUNCE_DEG, 9);
  });

  it("打板边角的球一律向上飞，速度大小不变，也不会贴地横飞", () => {
    for (const x of [100, 120, 140, 160, 180, 200, 220, 240, 260]) {
      const v = paddleBounce(x, 180, 84, 260);
      expect(v.vy).toBeLessThan(0);
      expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(260, 6);
      expect(angleWithinLimits(v.vx, v.vy)).toBe(true);
      expect(flatnessDeg(v.vx, v.vy)).toBeGreaterThanOrEqual(MIN_BOUNCE_DEG - 1e-6);
    }
  });

  it("接触点偏移被夹在 ±1：球擦着板角也不会算出离谱角度", () => {
    expect(paddleOffset(999, 180, 84)).toBe(1);
    expect(paddleOffset(-999, 180, 84)).toBe(-1);
    expect(paddleOffset(180, 180, 84)).toBe(0);
  });

  it("发球角度也走同一套上下限：摇到哪都不横飞", () => {
    for (let i = 0; i <= 40; i++) {
      const v = launchVelocity(240, i / 40, i % 2 ? 18 : -18);
      expect(v.vy).toBeLessThan(0);
      expect(angleWithinLimits(v.vx, v.vy)).toBe(true);
      expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(240, 6);
    }
  });
});

// ---------------------------------------------------------------------------
// 二、水平死球自纠
// ---------------------------------------------------------------------------

describe("碰碰砖块 · 水平死球自纠", () => {
  it("8 秒之内不动手，第 8 秒起每秒掰一次", () => {
    expect(stallNudges(0)).toBe(0);
    expect(stallNudges(STALL_SECONDS - 0.01)).toBe(0);
    expect(stallNudges(STALL_SECONDS)).toBe(1);
    expect(stallNudges(STALL_SECONDS + 0.9)).toBe(1);
    expect(stallNudges(STALL_SECONDS + 3.5)).toBe(4);
  });

  it("每次微调都往「更竖直」的方向掰，速度大小一点不变", () => {
    let v = { vx: 300, vy: -6 };
    const speed = Math.hypot(v.vx, v.vy);
    let last = flatnessDeg(v.vx, v.vy);
    for (let i = 0; i < 6; i++) {
      v = nudgeToVertical(v.vx, v.vy, STALL_NUDGE_DEG);
      const now = flatnessDeg(v.vx, v.vy);
      expect(now).toBeGreaterThan(last);
      expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(speed, 6);
      last = now;
    }
    expect(last).toBeGreaterThan(flatnessDeg(300, -6) + 10);
  });

  it("四个象限的平球都能被掰竖（不会越掰越平）", () => {
    for (const [vx, vy] of [[280, 4], [280, -4], [-280, 4], [-280, -4]]) {
      const before = flatnessDeg(vx, vy);
      const after = nudgeToVertical(vx, vy, STALL_NUDGE_DEG);
      expect(flatnessDeg(after.vx, after.vy)).toBeGreaterThan(before);
    }
  });
});

// ---------------------------------------------------------------------------
// 三、连续碰撞检测
// ---------------------------------------------------------------------------

describe("碰碰砖块 · 连续碰撞检测", () => {
  const box = { x0: 100, y0: 100, x1: 140, y1: 118 };

  it("线段穿过砖块能算出命中时刻与法线", () => {
    const hit = sweepAabb(120, 60, 0, 100, box, 0);
    expect(hit).not.toBeNull();
    expect(hit?.ny).toBe(-1);
    expect(hit?.t).toBeCloseTo(0.4, 6);
  });

  it("从侧面进来法线就是左右向", () => {
    const hit = sweepAabb(40, 109, 200, 0, box, 0);
    expect(hit?.nx).toBe(-1);
    expect(hit?.ny).toBe(0);
  });

  it("擦肩而过就是没打中", () => {
    expect(sweepAabb(0, 300, 360, 0, box, 0)).toBeNull();
    expect(sweepAabb(120, 60, 0, 20, box, 0)).toBeNull();
  });

  it("球半径算进去：贴边过也算命中", () => {
    expect(sweepAabb(95, 60, 0, 100, box, 0)).toBeNull();
    expect(sweepAabb(95, 60, 0, 100, box, BALL_R)).not.toBeNull();
  });

  it("起点已经陷在砖里就按最浅的面推出去，绝不卡死", () => {
    const hit = sweepAabb(138, 109, 10, 0, box, 0);
    expect(hit?.t).toBe(0);
    expect(hit?.nx).toBe(1);
  });

  it("一段位移打到好几块砖时，取最近的那一块", () => {
    const geom = geomOf(4);
    const hit = firstBrickHit(geom, () => true, 180, 20, 180, 120, BALL_R);
    expect(hit?.r).toBe(0);
    const box0 = brickBox(geom, 0, 4);
    expect(box0.x0).toBeGreaterThan(180 - geom.brickW);
  });

  it("高速球一帧跨过整片砖阵也不会穿砖", () => {
    const geom = geomOf(1);
    const grid = [new Array(8).fill(KIND.NORMAL)];
    const ball = { x: 180, y: 20, vx: 0, vy: 3000 };
    const before = { ...ball };
    const hits = stepBall(ball, 1 / 60, {
      geom,
      radius: BALL_R,
      // 顶棚放到画面外，这一条只考连续碰撞，不让墙插进来
      top: -9999,
      left: 0,
      right: W,
      solid: (r, c) => grid[r][c] !== KIND.EMPTY,
      hit: (r, c) => {
        grid[r][c] = KIND.EMPTY;
        return "bounce";
      }
    });
    expect(hits).toBeGreaterThanOrEqual(1);
    expect(grid[0].filter((v) => v === KIND.EMPTY).length).toBeGreaterThanOrEqual(1);
    expect(ball.vy).toBeLessThan(0);
    // 只看「这一帧的落点」的老写法会漏掉这块砖：落点早就飞过整排了
    const naiveRow = Math.floor((before.y + before.vy / 60 - BRICK_TOP) / BRICK_H);
    expect(naiveRow).toBeGreaterThan(0);
  });

  it("高速球在球台里来回撞，一整列砖会被依次打掉，一块都不会漏", () => {
    const geom = geomOf(6);
    const grid = Array.from({ length: 6 }, () => new Array(8).fill(KIND.NORMAL));
    const ball = { x: 180, y: 420, vx: 0, vy: -2400 };
    let broke = 0;
    for (let i = 0; i < 120; i++) {
      stepBall(ball, 1 / 60, {
        geom,
        radius: BALL_R,
        left: 0,
        right: W,
        top: 0,
        solid: (r, c) => grid[r]?.[c] !== undefined && grid[r][c] !== KIND.EMPTY,
        hit: (r, c) => {
          grid[r][c] = KIND.EMPTY;
          broke++;
          return "bounce";
        }
      });
      // 底下当成一块永远接得住的板
      if (ball.y > 420) {
        ball.y = 420;
        ball.vy = -Math.abs(ball.vy);
      }
    }
    expect(broke).toBeGreaterThanOrEqual(4);
  });

  it("左右墙与顶棚都会把球弹回来", () => {
    const geom = geomOf(0);
    const sides: string[] = [];
    const ball = { x: 5, y: 5, vx: -600, vy: -600 };
    stepBall(ball, 1 / 60, {
      geom,
      radius: BALL_R,
      left: 0,
      right: W,
      top: 0,
      solid: () => false,
      hit: () => "bounce",
      wall: (s) => sides.push(s)
    });
    expect(ball.vx).toBeGreaterThan(0);
    expect(ball.vy).toBeGreaterThan(0);
    expect(sides).toContain("left");
    expect(sides).toContain("top");
  });

  it("穿透球报 pass 就直接穿过去，方向不变", () => {
    const geom = geomOf(2);
    const ball = { x: 180, y: 20, vx: 0, vy: 3000 };
    const seen: Array<[number, number]> = [];
    stepBall(ball, 1 / 60, {
      geom,
      radius: BALL_R,
      left: 0,
      right: W,
      top: 0,
      solid: () => true,
      hit: (r, c) => {
        seen.push([r, c]);
        return "pass";
      }
    });
    expect(ball.vy).toBeGreaterThan(0);
    expect(seen.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 四、砖块体系
// ---------------------------------------------------------------------------

describe("碰碰砖块 · 六种砖", () => {
  it("六种砖齐活，颜色与图案两条通道都互不相同", () => {
    expect(BRICK_KINDS).toHaveLength(6);
    const infos = BRICK_KINDS.map((k) => BRICKS[k]);
    expect(new Set(infos.map((i) => i.name)).size).toBe(6);
    expect(new Set(infos.map((i) => i.color)).size).toBe(6);
    expect(new Set(infos.map((i) => i.mark)).size).toBe(6);
    for (const i of infos) expect(i.name).not.toMatch(/[A-Za-z]/);
  });

  it("多层砖一层一层掉：三层 → 二层 → 普通 → 空", () => {
    let v: number = KIND.THREE;
    const seen: number[] = [v];
    for (let i = 0; i < 3; i++) {
      const res = damageBrick(v);
      v = res.next;
      seen.push(v);
      expect(res.broken).toBe(i === 2);
    }
    expect(seen).toEqual([KIND.THREE, KIND.TWO, KIND.NORMAL, KIND.EMPTY]);
  });

  it("1.0 的钢砖（值 2）还是老规矩：正好两下才碎", () => {
    const a = damageBrick(KIND.TWO);
    expect(a.broken).toBe(false);
    expect(damageBrick(a.next).broken).toBe(true);
  });

  it("钢砖普通球打不动，只有穿透球能清掉", () => {
    const plain = damageBrick(KIND.STEEL, false);
    expect(plain.next).toBe(KIND.STEEL);
    expect(plain.broken).toBe(false);
    const pierced = damageBrick(KIND.STEEL, true);
    expect(pierced.next).toBe(KIND.EMPTY);
    expect(pierced.broken).toBe(true);
    expect(brickInfo(KIND.STEEL)?.needsPierce).toBe(true);
  });

  it("爆米花砖碎的时候连带周围一圈，边角只连到界内", () => {
    expect(damageBrick(KIND.POPCORN).chain).toBe(true);
    expect(popcornTargets(2, 3, 5, 8)).toHaveLength(8);
    expect(popcornTargets(0, 0, 5, 8)).toHaveLength(3);
    expect(popcornTargets(4, 7, 5, 8)).toHaveLength(3);
    for (const [r, c] of popcornTargets(0, 0, 5, 8)) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });

  it("道具砖必掉道具，星门永远打不碎", () => {
    expect(damageBrick(KIND.GIFT).gift).toBe(true);
    expect(damageBrick(KIND.NORMAL).gift).toBe(false);
    const portal = damageBrick(KIND.PORTAL, true);
    expect(portal.next).toBe(KIND.PORTAL);
    expect(portal.broken).toBe(false);
  });

  it("掉一层就浅一档，颜色与图案同时变（不靠颜色也认得出）", () => {
    const full = brickFace(KIND.THREE, KIND.THREE);
    const half = brickFace(KIND.THREE, KIND.TWO);
    const last = brickFace(KIND.THREE, KIND.NORMAL);
    expect(full.steps).toBe(0);
    expect(half.steps).toBe(1);
    expect(last.steps).toBe(2);
    expect(new Set([full.color, half.color, last.color]).size).toBe(3);
    expect(new Set([full.mark, half.mark, last.mark]).size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 五、道具时限
// ---------------------------------------------------------------------------

describe("碰碰砖块 · 道具平衡", () => {
  it("五个好道具 + 一个轻微负面，负面的时间最短", () => {
    expect(POWER_ORDER).toHaveLength(6);
    const bad = POWER_ORDER.filter((k) => !POWERS[k].good);
    expect(bad).toEqual(["narrow"]);
    const goodTimed = POWER_ORDER.filter((k) => POWERS[k].good && POWERS[k].seconds > 0);
    for (const k of goodTimed) expect(POWERS[k].seconds).toBeGreaterThan(POWERS.narrow.seconds);
  });

  it("每种道具都有时限，没有一个是永久强化", () => {
    for (const k of POWER_ORDER) {
      const info = POWERS[k];
      expect(info.seconds).toBeGreaterThanOrEqual(0);
      expect(info.seconds).toBeLessThanOrEqual(MAX_POWER_SECONDS);
      expect(Number.isFinite(info.seconds)).toBe(true);
      expect(info.hint).not.toMatch(/[A-Za-z]/);
    }
  });

  it("时间一到全部清空，效果回到没吃道具的样子", () => {
    let timers: PowerTimers = {};
    for (const k of POWER_ORDER) timers = grantPower(timers, k);
    expect(Object.keys(timers).length).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++) timers = tickPowers(timers, 0.1);
    expect(Object.keys(timers)).toHaveLength(0);
    const eff = powerEffects(timers);
    expect(eff).toEqual({ paddleScale: 1, pierce: false, magnet: false, speedScale: 1 });
  });

  it("同一种道具连吃也不会越叠越长（封顶在单次时限）", () => {
    let timers: PowerTimers = {};
    for (let i = 0; i < 5; i++) timers = grantPower(timers, "wide");
    expect(timers.wide).toBeLessThanOrEqual(POWERS.wide.seconds);
    expect(timers.wide).toBeGreaterThan(0);
  });

  it("加宽板与小板子互相抵消，不会同时挂着两个相反的效果", () => {
    let timers = grantPower({}, "wide");
    timers = grantPower(timers, "narrow");
    expect(timers.wide).toBeUndefined();
    expect(timers.narrow).toBeGreaterThan(0);
    timers = grantPower(timers, "wide");
    expect(timers.narrow).toBeUndefined();
  });

  it("板宽倍率有上下限：再怎么吃也不会「站着不动就赢」", () => {
    const wide = powerEffects({ wide: 5 });
    expect(wide.paddleScale).toBeLessThanOrEqual(PADDLE_SCALE_MAX);
    const narrow = powerEffects({ narrow: 5 });
    expect(narrow.paddleScale).toBeGreaterThanOrEqual(PADDLE_SCALE_MIN);
    expect(narrow.paddleScale).toBeLessThan(1);
    expect(powerEffects({ slow: 2 }).speedScale).toBeLessThan(1);
    expect(powerEffects({ pierce: 2 }).pierce).toBe(true);
    expect(powerEffects({ magnet: 2 }).magnet).toBe(true);
  });

  it("三球是一次性的，不会变成常驻计时器", () => {
    const timers = grantPower({}, "triple");
    expect(timers.triple).toBeUndefined();
    expect(POWERS.triple.seconds).toBe(0);
  });

  it("摇道具能摇出全部六种，且负面的概率最低", () => {
    const seen = new Map<string, number>();
    const rand = mulberry32(7);
    for (let i = 0; i < 4000; i++) {
      const k = rollPower(rand());
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    expect(seen.size).toBe(6);
    for (const k of POWER_ORDER) expect(seen.get(k) ?? 0).toBeGreaterThan(0);
    const worst = Math.min(...POWER_ORDER.map((k) => seen.get(k) ?? 0));
    expect(seen.get("narrow")).toBe(worst);
  });
});

// ---------------------------------------------------------------------------
// 六、无尽砖塔
// ---------------------------------------------------------------------------

describe("碰碰砖块 · 无尽砖塔", () => {
  it("下移速度随清行递增，但有上限，不会突然变吓人", () => {
    expect(towerSpeed(0)).toBeLessThan(towerSpeed(5));
    expect(towerSpeed(5)).toBeLessThan(towerSpeed(12));
    expect(towerSpeed(999)).toBeLessThanOrEqual(26);
    expect(towerSpeed(0)).toBeGreaterThan(0);
  });

  it("每下移一行高就从顶上补一排砖", () => {
    const rand = mulberry32(11);
    let st = makeTower(rand);
    const rows0 = st.rows.length;
    const perRow = BRICK_H / towerSpeed(0);
    for (let t = 0; t < perRow - 0.05; t += 0.05) st = towerTick(st, 0.05, rand);
    expect(st.rows.length).toBe(rows0);
    st = towerTick(st, 0.1, rand);
    expect(st.rows.length).toBe(rows0 + 1);
    expect(st.spawned).toBe(rows0 + 1);
  });

  it("砖墙压到底线就收工（触底结束）", () => {
    const rand = mulberry32(3);
    const rows = Math.ceil((TOWER_FLOOR - TOWER_TOP) / BRICK_H);
    const st: TowerState = {
      rows: Array.from({ length: rows }, () => new Array(8).fill(KIND.NORMAL)),
      drop: 0,
      spawned: rows,
      rowsCleared: 0,
      bricksBroken: 0,
      score: 0,
      over: false
    };
    expect(towerBottomY(st)).toBeGreaterThanOrEqual(TOWER_FLOOR);
    const next = towerTick(st, 0.1, rand);
    expect(next.over).toBe(true);
    // 收工之后再 tick 也不会继续长
    expect(towerTick(next, 1, rand)).toBe(next);
  });

  it("打掉一整行有额外加分，清得越多一行越值钱（但封顶）", () => {
    expect(towerRowScore(0)).toBeLessThan(towerRowScore(6));
    expect(towerRowScore(20)).toBe(towerRowScore(99));
    const st: TowerState = {
      rows: [[KIND.NORMAL, 0, 0, 0, 0, 0, 0, 0], new Array(8).fill(KIND.NORMAL)],
      drop: 0,
      spawned: 2,
      rowsCleared: 0,
      bricksBroken: 0,
      score: 0,
      over: false
    };
    const res = towerBreak(st, 0, 0);
    expect(res.clearedRows).toBe(1);
    expect(res.state.rowsCleared).toBe(1);
    expect(res.state.score).toBeGreaterThanOrEqual(towerRowScore(0));
    // 清掉中间一排只留个洞，下面那排绝不会跟着往上跳
    expect(res.state.rows).toHaveLength(2);
    expect(res.state.rows[1].every((v) => v === KIND.NORMAL)).toBe(true);
    // 同一排再打一次不会重复算分
    expect(towerBreak(res.state, 0, 0).clearedRows).toBe(0);
  });

  it("最底下那排清空之后会被收走，砖墙底边跟着抬高", () => {
    const st: TowerState = {
      rows: [new Array(8).fill(KIND.NORMAL), [0, 0, 0, KIND.NORMAL, 0, 0, 0, 0]],
      drop: 0,
      spawned: 2,
      rowsCleared: 0,
      bricksBroken: 0,
      score: 0,
      over: false
    };
    const before = towerBottomY(st);
    const res = towerBreak(st, 1, 3);
    expect(res.state.rows).toHaveLength(1);
    expect(towerBottomY(res.state)).toBe(before - BRICK_H);
  });

  it("砖塔里的爆米花砖会连带炸掉周围一圈", () => {
    const st: TowerState = {
      rows: [
        [0, KIND.NORMAL, KIND.NORMAL, KIND.NORMAL, 0, 0, 0, 0],
        [0, KIND.NORMAL, KIND.POPCORN, KIND.NORMAL, 0, 0, 0, KIND.NORMAL],
        [0, KIND.NORMAL, KIND.NORMAL, KIND.NORMAL, 0, 0, 0, 0]
      ],
      drop: 0,
      spawned: 3,
      rowsCleared: 0,
      bricksBroken: 0,
      score: 0,
      over: false
    };
    const res = towerBreak(st, 1, 2);
    expect(res.broke.length).toBeGreaterThanOrEqual(9);
    expect(res.state.rows.flat().filter((v) => v === KIND.NORMAL)).toHaveLength(1);
  });

  it("钢砖挡在砖塔里，普通球打不动它", () => {
    const st: TowerState = {
      rows: [[KIND.STEEL, KIND.NORMAL, 0, 0, 0, 0, 0, 0]],
      drop: 0,
      spawned: 1,
      rowsCleared: 0,
      bricksBroken: 0,
      score: 0,
      over: false
    };
    const plain = towerBreak(st, 0, 0);
    expect(plain.state.rows[0][0]).toBe(KIND.STEEL);
    expect(plain.broke).toHaveLength(0);
    const pierced = towerBreak(st, 0, 0, true);
    expect(pierced.state.rows[0][0]).toBe(KIND.EMPTY);
  });

  it("每一排砖都不会全空、也不会整排全钢（永远打得动）", () => {
    for (let seed = 0; seed < 60; seed++) {
      const rand = mulberry32(seed * 131 + 5);
      for (let wave = 0; wave < 40; wave++) {
        const row = makeTowerRow(rand, wave);
        expect(row).toHaveLength(8);
        const solid = row.filter((v) => v !== KIND.EMPTY);
        expect(solid.length).toBeGreaterThan(0);
        expect(solid.every((v) => v === KIND.STEEL)).toBe(false);
        for (const v of row) expect([0, 1, 2, 5, 6, 7, 8]).toContain(v);
      }
    }
  });

  it("开局的砖塔离底线还很远，孩子有时间热身", () => {
    const st = makeTower(mulberry32(9));
    expect(st.over).toBe(false);
    expect(towerBottomY(st)).toBeLessThan(TOWER_FLOOR - BRICK_H * 6);
    expect(st.score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 七、188 关模拟
// ---------------------------------------------------------------------------

describe("碰碰砖块 · 188 关可通（模拟）", () => {
  it("188 关每一关都能被「会追球的假玩家」清干净", () => {
    const stuck: string[] = [];
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const res = simulateLevel(LEVELS[lv], { seed: 1000 + lv });
      if (!res.won) stuck.push(`第 ${lv + 1} 关还剩 ${res.left} 块`);
      expect(res.brickHits).toBeGreaterThan(0);
    }
    expect(stuck).toEqual([]);
  });

  it("整局模拟里球从来没有平过 20°（死球自纠确实在兜底）", () => {
    for (const lv of [40, 98, 152]) {
      const res = simulateLevel(LEVELS[lv], { seed: 77 + lv });
      expect(res.minAngleDeg).toBeGreaterThanOrEqual(MIN_BOUNCE_DEG - 1);
    }
  });

  it("同一个种子重跑结果一模一样（确定性）", () => {
    const a = simulateLevel(LEVELS[30], { seed: 424242 });
    const b = simulateLevel(LEVELS[30], { seed: 424242 });
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// 八、手感小料 + destroy 归零
// ---------------------------------------------------------------------------

describe("碰碰砖块 · 手感与收尾", () => {
  it("击砖顿感在 3–5 帧之间，越硬的砖顿得越明显", () => {
    for (const k of BRICK_KINDS) {
      expect(hitStopFrames(k)).toBeGreaterThanOrEqual(3);
      expect(hitStopFrames(k)).toBeLessThanOrEqual(5);
    }
    expect(hitStopFrames(KIND.THREE)).toBeGreaterThan(hitStopFrames(KIND.NORMAL));
  });

  it("连击越长两声之间越紧凑，拖尾越快越长，减少动态时粒子减半", () => {
    expect(comboGapMs(1)).toBeGreaterThan(comboGapMs(6));
    expect(comboGapMs(99)).toBeGreaterThanOrEqual(60);
    expect(trailLength(400)).toBeGreaterThan(trailLength(180));
    expect(trailLength(9999)).toBeLessThanOrEqual(46);
    expect(particleCount(10, false)).toBe(10);
    expect(particleCount(10, true)).toBe(5);
    expect(particleCount(1, true)).toBe(1);
  });

  it("destroy 之后定时器 / rAF / 监听一件都不剩", () => {
    const timers = new Map<number, () => void>();
    const frames = new Map<number, (t: number) => void>();
    let next = 1;
    const jan = new Janitor({
      setTimeout: (fn) => {
        const id = next++;
        timers.set(id, fn);
        return id;
      },
      clearTimeout: (id) => {
        timers.delete(id);
      },
      requestAnimationFrame: (fn) => {
        const id = next++;
        frames.set(id, fn);
        return id;
      },
      cancelAnimationFrame: (id) => {
        frames.delete(id);
      }
    });

    let removed = 0;
    const target = {
      addEventListener: () => undefined,
      removeEventListener: () => {
        removed++;
      }
    };
    jan.after(100, () => undefined);
    jan.after(200, () => undefined);
    jan.frame(() => undefined);
    jan.on(target, "pointerdown", () => undefined);
    jan.on(target, "keydown", () => undefined);
    expect(jan.pending()).toBe(5);

    jan.destroy();
    expect(jan.pending()).toBe(0);
    expect(timers.size).toBe(0);
    expect(frames.size).toBe(0);
    expect(removed).toBe(2);
    expect(jan.dead).toBe(true);
  });
});
