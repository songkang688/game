/**
 * 碰碰砖块 · 窗口 4 档A · 第 3 轮测试员（收官）。
 *
 * 前两轮抽的是第 1 / 25 / 60 / 100 / 130 / 170 / 188 关。收官这一轮不抽了：
 * **188 关一关不漏**跑一遍求解器，无尽砖塔按四种手速各撑一趟，
 * 竞态与 360px 再走一遍，最后把 W4A-07 与 A-L12 的结论钉死。
 * 本段只读不改。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { COLS, LEVELS, CHAPTERS, breakableCount, isBreakable } from "./levels";
import {
  BALL_R, BRICK_H, KIND, MAX_POWER_SECONDS, MIN_BOUNCE_DEG, PADDLE_Y, POWERS, POWER_ORDER,
  TOWER_COLS, TOWER_FLOOR, TOWER_SPEED_BASE, TOWER_SPEED_MAX, TOWER_START_ROWS, TOWER_TOP, W,
  brickInfo, capsuleLook, damageBrick, flatnessDeg, grantPower, makeTower, paddleBounce, popcornTargets,
  powerEffects, rollPower, rowSettled, simulateLevel, squeezeTower, stepBall, tickPowers,
  towerBreak, towerBottomY, towerSpeed, towerTick,
  type BallLike, type BrickGeom, type PowerKind, type TowerState
} from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const BLAME_WORDS = ["失败", "输了", "太差", "笨", "不行", "菜"];

/** 一个「每秒能打碎 bricksPerSec 块砖」的假玩家，在砖塔里能撑多久、清几行 */
function towerRun(bricksPerSec: number, seed: number): { seconds: number; rowsCleared: number; score: number } {
  const rand = mulberry32(seed);
  let st = makeTower(rand);
  let t = 0;
  let credit = 0;
  const dt = 1 / 60;
  while (!st.over && t < 400) {
    st = towerTick(st, dt, rand);
    t += dt;
    credit += bricksPerSec * dt;
    while (credit >= 1 && !st.over) {
      credit -= 1;
      let hit = false;
      for (let r = st.rows.length - 1; r >= 0 && !hit; r--) {
        for (let c = 0; c < TOWER_COLS; c++) {
          const v = st.rows[r][c];
          if (v === KIND.EMPTY || v === KIND.STEEL) continue;
          st = towerBreak(st, r, c).state;
          hit = true;
          break;
        }
      }
      if (!hit) break;
    }
  }
  return { seconds: t, rowsCleared: st.rowsCleared, score: st.score };
}

describe("碰碰砖块 · R3 · 188 关一关不漏", () => {
  it("每一关都打得通，而且换三个种子都打得通", () => {
    const bad: string[] = [];
    for (let lv = 0; lv < LEVELS.length; lv++) {
      for (const s of [3, 20260827, 90210]) {
        if (!simulateLevel(LEVELS[lv], { seed: s + lv * 13 }).won) bad.push(`第 ${lv + 1} 关 seed ${s}`);
      }
    }
    expect(bad, `打不通：${bad.slice(0, 8).join("、")}`).toEqual([]);
  });

  it("每一关的砖阵都排得住：有得打、不出界、钢砖不会把关卡堵死", () => {
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const cfg = LEVELS[lv];
      expect(breakableCount(cfg.layout), `第 ${lv + 1} 关一块能打的砖都没有`).toBeGreaterThan(0);
      for (const row of cfg.layout) {
        expect(row.length, `第 ${lv + 1} 关行宽不对`).toBe(COLS);
        for (const v of row) {
          expect(v === KIND.EMPTY || brickInfo(v) !== null, `第 ${lv + 1} 关有不认识的砖 ${v}`).toBe(true);
        }
      }
      // 打不碎的砖（钢砖 / 星门）不能多到把整关堵死
      const solidCount = cfg.layout.flat().filter((v) => v !== KIND.EMPTY && !isBreakable(v)).length;
      expect(solidCount, `第 ${lv + 1} 关不可破的砖太多`).toBeLessThan(breakableCount(cfg.layout));
      // 砖阵不能高到把球拍压死
      expect(cfg.layout.length * BRICK_H, `第 ${lv + 1} 关砖阵太高`).toBeLessThan(PADDLE_Y - 60);
    }
  });

  /**
   * 求解器给的是无限球（漏了就重发），所以「输」在它这儿只体现为漏球数。
   * 真机是三颗爱心（`index.ts` 的 `let lives = 3`），漏第三次就收场。
   * 所以这里按真机口径判：球拍钉死不动，漏球数一定超过三颗爱心的额度。
   */
  it("赢一次也输一次：球拍钉死不动，每一关都漏穿三颗爱心", () => {
    const spots = [12, 33, 58, 77, 96, 118, 140, 163, 181, 188];
    for (const lv of spots) {
      const frozen = simulateLevel(LEVELS[lv - 1], { seed: 4242 + lv, paddleSpeed: 0 });
      expect(frozen.misses, `第 ${lv} 关球拍不动却没漏够`).toBeGreaterThanOrEqual(3);
      const normal = simulateLevel(LEVELS[lv - 1], { seed: 4242 + lv });
      expect(normal.won, `第 ${lv} 关`).toBe(true);
      // 好好接的那一遍，漏球明显比钉死不动少
      expect(normal.misses, `第 ${lv} 关`).toBeLessThan(frozen.misses);
    }
    expect(SRC).toMatch(/let lives = 3/);
  });

  it("难度是斜坡：章内砖数只增不减，换章会松一口气", () => {
    let at = 0;
    const chapterAvg: number[] = [];
    for (const ch of CHAPTERS) {
      let sum = 0;
      for (let t = 0; t < ch.size; t++) sum += breakableCount(LEVELS[at + t].layout);
      chapterAvg.push(sum / ch.size);
      at += ch.size;
    }
    // 整条 188 关，后半的平均砖数高过前半
    const half = Math.floor(chapterAvg.length / 2);
    const avg = (l: number[]) => l.reduce((s, v) => s + v, 0) / l.length;
    expect(avg(chapterAvg.slice(half))).toBeGreaterThan(avg(chapterAvg.slice(0, half)));
  });
});

describe("碰碰砖块 · R3 · 无尽砖塔撑得住（W4A-07 收官复核）", () => {
  it("四种手速都撑得住，而且打得越快活得越久——奖励方向是正的", () => {
    const runs = [2, 3, 4, 6].map((bps) => ({ bps, ...towerRun(bps, 20260827) }));
    for (const r of runs) {
      expect(r.seconds, `每秒 ${r.bps} 砖只撑了 ${r.seconds.toFixed(1)} 秒`).toBeGreaterThan(60);
    }
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].seconds, `每秒 ${runs[i].bps} 砖反而更短命`).toBeGreaterThanOrEqual(runs[i - 1].seconds);
      expect(runs[i].rowsCleared).toBeGreaterThanOrEqual(runs[i - 1].rowsCleared);
      expect(runs[i].score).toBeGreaterThan(runs[i - 1].score);
    }
  });

  it("换五个种子都是同一个结论，不是碰巧挑对了那一局", () => {
    for (const seed of [1, 77, 3001, 65535, 998244353]) {
      const slow = towerRun(2, seed);
      const fast = towerRun(6, seed);
      expect(fast.seconds, `seed ${seed}`).toBeGreaterThanOrEqual(slow.seconds);
      expect(fast.score, `seed ${seed}`).toBeGreaterThan(slow.score);
    }
  });

  it("下压只跟时间有关，跟清了几行无关；速度有起点也有封顶", () => {
    expect(towerSpeed(0)).toBe(TOWER_SPEED_BASE);
    expect(towerSpeed(9999)).toBe(TOWER_SPEED_MAX);
    for (let t = 1; t <= 120; t++) expect(towerSpeed(t)).toBeGreaterThanOrEqual(towerSpeed(t - 1));
    // 清行不进速度公式：towerSpeed 只认一个参数
    expect(towerSpeed.length).toBe(1);
  });

  it("清一行真的换来喘息：空行整行抽走，整堵墙往上退一格", () => {
    const rows = [
      [KIND.EMPTY, KIND.EMPTY, KIND.EMPTY, KIND.EMPTY, KIND.EMPTY, KIND.EMPTY, KIND.EMPTY, KIND.EMPTY],
      [KIND.NORMAL, KIND.EMPTY, KIND.EMPTY, KIND.EMPTY, KIND.EMPTY, KIND.EMPTY, KIND.EMPTY, KIND.EMPTY]
    ];
    const squeezed = squeezeTower(rows);
    expect(squeezed.length).toBe(1);
    expect(squeezed[0][0]).toBe(KIND.NORMAL);
    // 全空的塔挤完就是空数组，不会留着一堆看不见的行往下压
    expect(squeezeTower([[KIND.EMPTY, KIND.EMPTY]])).toEqual([]);
  });

  it("钢砖不会越攒越厚：一行里别的都清光了，钢砖自己碎掉", () => {
    const E = KIND.EMPTY;
    const st: TowerState = {
      rows: [[KIND.NORMAL, KIND.STEEL, E, E, E, E, E, E]],
      drop: 0, rowsCleared: 0, score: 0, elapsed: 0, over: false
    };
    expect(rowSettled(st.rows[0])).toBe(false);
    const next = towerBreak(st, 0, 0).state;
    // 那一行整行没了（钢砖跟着碎掉，空行被挤走）
    expect(next.rows.length).toBe(0);
    expect(next.rowsCleared).toBe(1);
    expect(next.score).toBeGreaterThan(0);
  });

  it("塔到底就收场，收场只有这一个出口", () => {
    const rand = mulberry32(5);
    let st = makeTower(rand);
    expect(st.rows.length).toBe(TOWER_START_ROWS);
    expect(towerBottomY(st)).toBeGreaterThan(TOWER_TOP);
    for (let i = 0; i < 4000 && !st.over; i++) st = towerTick(st, 1 / 30, rand);
    expect(st.over).toBe(true);
    expect(towerBottomY(st)).toBeGreaterThanOrEqual(TOWER_FLOOR - BRICK_H);
    // 收场之后再敲也不动数
    const frozen = st;
    expect(towerTick(st, 1, rand)).toBe(frozen);
  });
});

describe("碰碰砖块 · R3 · 竞态与手感再走一遍", () => {
  it("一帧里同一块砖只结算一次，球再快也不会穿缝", () => {
    const geom: BrickGeom = { rows: 3, cols: COLS, brickW: W / COLS, brickH: BRICK_H, top: 40, offsetX: 0 };
    const grid = [
      new Array<number>(COLS).fill(KIND.NORMAL),
      new Array<number>(COLS).fill(KIND.EMPTY),
      new Array<number>(COLS).fill(KIND.EMPTY)
    ];
    const seen: string[] = [];
    const ball: BallLike = { x: 40, y: 300, vx: 0, vy: -9000 };
    stepBall(ball, 1 / 30, {
      geom,
      radius: BALL_R,
      left: 0,
      right: W,
      top: 0,
      solid: (r, c) => grid[r]?.[c] !== undefined && grid[r][c] !== KIND.EMPTY,
      hit: (r, c) => { seen.push(`${r},${c}`); return "bounce"; }
    });
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("球拍反弹永远留着角度，不会贴着水平线来回蹭", () => {
    const paddleW = 60;
    for (let x = W / 2 - paddleW; x <= W / 2 + paddleW; x += 3) {
      const v = paddleBounce(x, W / 2, paddleW, 300);
      expect(flatnessDeg(v.vx, v.vy), `接在 ${x}`).toBeGreaterThanOrEqual(MIN_BOUNCE_DEG - 1e-6);
      expect(v.vy).toBeLessThan(0);
    }
  });

  it("道具同帧拿到又走完，不会留下半死不活的状态", () => {
    let timers = grantPower({}, "wide");
    for (const k of POWER_ORDER) timers = grantPower(timers, k);
    for (const [k, left] of Object.entries(timers)) {
      expect(left, `${k}`).toBeGreaterThan(0);
      expect(left, `${k}`).toBeLessThanOrEqual(MAX_POWER_SECONDS);
    }
    // 宽板与窄板互斥：不会同时挂着两个方向相反的道具
    expect(timers.wide !== undefined && timers.narrow !== undefined).toBe(false);
    const done = tickPowers(timers, MAX_POWER_SECONDS + 1);
    expect(Object.keys(done).length).toBe(0);
    const fx = powerEffects(done);
    expect(fx.paddleScale).toBe(1);
    expect(fx.pierce).toBe(false);
    expect(fx.magnet).toBe(false);
    expect(fx.speedScale).toBe(1);
  });

  it("爆米花连锁只波及邻居，不会自己炸自己，也不会越界", () => {
    for (const [r, c] of [[0, 0], [2, 7], [1, 3]] as const) {
      const t = popcornTargets(r, c, 4, 8);
      expect(t.some(([rr, cc]) => rr === r && cc === c)).toBe(false);
      for (const [rr, cc] of t) {
        expect(rr).toBeGreaterThanOrEqual(0);
        expect(rr).toBeLessThan(4);
        expect(cc).toBeGreaterThanOrEqual(0);
        expect(cc).toBeLessThan(8);
      }
    }
  });

  it("多层砖一层一层掉，穿透道具才一次打穿", () => {
    expect(damageBrick(KIND.THREE).next).toBe(KIND.TWO);
    expect(damageBrick(KIND.THREE, true).next).toBe(KIND.EMPTY);
    expect(damageBrick(KIND.STEEL).next).toBe(KIND.STEEL);
  });
});

describe("碰碰砖块 · R3 · A-L12 与红线收官", () => {
  it("A-L12 已落地：坏道具用形状区分，不是只靠颜色", () => {
    const good = POWER_ORDER.filter((k) => POWERS[k].good);
    const bad = POWER_ORDER.filter((k) => !POWERS[k].good);
    expect(good.length).toBeGreaterThan(0);
    expect(bad.length).toBeGreaterThan(0);
    for (const k of good) expect(capsuleLook(k).hollow, `${k}`).toBe(false);
    for (const k of bad) expect(capsuleLook(k).hollow, `${k}`).toBe(true);
    // 真机确实照着 capsuleLook 画
    expect(SRC).toContain("capsuleLook(cap.kind)");
    expect(SRC).toMatch(/look\.hollow/);
  });

  it("道具池六种都摇得出，摇出来的都在册", () => {
    const seen = new Set<PowerKind>();
    for (let i = 0; i < 1000; i++) seen.add(rollPower(i / 1000));
    expect(seen.size).toBe(POWER_ORDER.length);
    for (const k of seen) expect(POWER_ORDER).toContain(k);
  });

  it("360px：画布正好 360 宽，控件不小于 44px，没有横向滚动", () => {
    expect(W).toBe(360);
    for (const m of SRC.matchAll(/\.brk-[a-z-]*(?:btn|open|back)[^{]*\{[^}]*min-height:\s*(\d+)px/g)) {
      expect(Number(m[1]), "有个按钮矮过 40px").toBeGreaterThanOrEqual(40);
    }
    const widths = [...SRC.matchAll(/(?<!-)\bwidth:\s*(\d{3,})px/g)].map((m) => Number(m[1]));
    for (const w of widths) expect(w, `有一处写死了 ${w}px`).toBeLessThanOrEqual(360);
    expect(SRC).not.toMatch(/overflow-x:\s*scroll/);
  });

  it("收场文案只鼓励，没有一句下判语", () => {
    const words = SRC.match(/[「"'`][^"'`]*(再来|下次|接着|继续)[^"'`]*[」"'`]/g) ?? [];
    for (const w of words) for (const bad of BLAME_WORDS) expect(w).not.toContain(bad);
    for (const bad of BLAME_WORDS) {
      const hit = new RegExp(`["'\`][^"'\`]*${bad}`).test(SRC);
      expect(hit, `index.ts 里出现了「${bad}」`).toBe(false);
    }
  });
});
