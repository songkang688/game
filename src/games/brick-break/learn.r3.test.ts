/**
 * 碰碰砖块 · 窗口 4 档A · 第 3 轮学习优化员（A-L13）。
 *
 * 无尽砖塔的下压速度在第 2 轮改成了「只跟在场时间有关」（W4A-07），
 * 数值上「打得快就能多玩一会儿」成立了，可屏幕上一点都看不出来。
 * 这一轮把它变成看得见的钟：顶栏多一格节奏牌，报下一排还有几秒、
 * 现在压到了哪一档。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BRICK_H, TOWER_SPEED_BASE, TOWER_SPEED_MAX, TOWER_SPEED_RAMP,
  makeTower, towerNextRowIn, towerPacePct, towerPaceWord, towerSpeed, towerTick,
  type TowerState
} from "./logic";
import { mulberry32 } from "../level99";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

function tower(elapsed = 0, drop = 0): TowerState {
  return { ...makeTower(mulberry32(7)), elapsed, drop };
}

describe("碰碰砖块 · A-L13 · 砖塔的节奏看得见", () => {
  it("倒数就是「还差多少距离 ÷ 当前速度」，不是拍脑袋的估计", () => {
    for (const [elapsed, drop] of [[0, 0], [30, 4], [120, 11], [400, 0]] as const) {
      const st = tower(elapsed, drop);
      expect(towerNextRowIn(st)).toBeCloseTo((BRICK_H - drop) / towerSpeed(elapsed), 6);
    }
  });

  it("刚推完一排时倒数最长，快推下一排时倒数归零", () => {
    const st = tower(0, 0);
    expect(towerNextRowIn(st)).toBeCloseTo(BRICK_H / TOWER_SPEED_BASE, 6);
    expect(towerNextRowIn(tower(0, BRICK_H))).toBe(0);
    // 中途读数一定夹在这两头之间
    expect(towerNextRowIn(tower(0, BRICK_H / 2))).toBeLessThan(towerNextRowIn(st));
    expect(towerNextRowIn(tower(0, BRICK_H / 2))).toBeGreaterThan(0);
  });

  it("玩得越久倒数越短，但短到封顶速度那一档就不再短了", () => {
    let last = Infinity;
    for (const t of [0, 20, 60, 100, 133]) {
      const now = towerNextRowIn(tower(t, 0));
      expect(now, `第 ${t} 秒`).toBeLessThan(last);
      last = now;
    }
    // 封顶之后再玩多久都是同一个读数
    const capAt = (TOWER_SPEED_MAX - TOWER_SPEED_BASE) / TOWER_SPEED_RAMP;
    expect(towerNextRowIn(tower(capAt + 10, 0))).toBeCloseTo(towerNextRowIn(tower(capAt + 900, 0)), 6);
  });

  it("节奏成数从 0 走到 1，开场是 0，封顶是 1，中间不跳档", () => {
    expect(towerPacePct(tower(0))).toBe(0);
    const capAt = (TOWER_SPEED_MAX - TOWER_SPEED_BASE) / TOWER_SPEED_RAMP;
    expect(towerPacePct(tower(capAt))).toBeCloseTo(1, 6);
    expect(towerPacePct(tower(capAt * 5))).toBe(1);
    let last = -1;
    for (let t = 0; t <= 200; t += 5) {
      const p = towerPacePct(tower(t));
      expect(p, `第 ${t} 秒`).toBeGreaterThanOrEqual(last);
      expect(p).toBeLessThanOrEqual(1);
      last = p;
    }
  });

  it("牌面上的话分三档，读得出「慢 / 中 / 快」，也读得出还剩几秒", () => {
    expect(towerPaceWord(tower(0, 0))).toContain("慢速");
    expect(towerPaceWord(tower(70, 0))).toContain("中速");
    expect(towerPaceWord(tower(200, 0))).toContain("快速");
    // 秒数带一位小数，读得出在走
    expect(towerPaceWord(tower(0, 0))).toMatch(/\d\.\ds$/);
    expect(towerPaceWord(tower(0, BRICK_H))).toContain("0.0s");
    // 只描述节奏，不催也不吓
    for (const w of ["快点", "危险", "来不及", "输了", "失败"]) {
      for (const t of [0, 70, 200]) expect(towerPaceWord(tower(t, 0)), `不该说「${w}」`).not.toContain(w);
    }
  });

  it("真跑一趟：倒数会一路走到 0，然后跟着新推的一排回到高位", () => {
    const rand = mulberry32(2024);
    let st = makeTower(rand);
    const before = st.rows.length;
    let sawZeroish = false;
    let grew = false;
    for (let i = 0; i < 200 && !st.over; i++) {
      const left = towerNextRowIn(st);
      if (left < 0.06) sawZeroish = true;
      const rows0 = st.rows.length;
      st = towerTick(st, 1 / 30, rand);
      if (st.rows.length > rows0) {
        grew = true;
        // 刚推完一排，倒数应当回到接近满格
        expect(towerNextRowIn(st)).toBeGreaterThan(BRICK_H / TOWER_SPEED_MAX * 0.8);
      }
    }
    expect(sawZeroish).toBe(true);
    expect(grew).toBe(true);
    expect(st.rows.length).toBeGreaterThanOrEqual(before);
  });

  it("顶栏真的挂上了这块牌，而且到「快」那一档会换个底色", () => {
    expect(SRC).toContain("brk-pace");
    expect(SRC).toContain("towerPaceWord");
    expect(SRC).toContain("brk-pace-hot");
    // 底色之外还有「快」字兜着，不是只靠颜色说话
    expect(towerPaceWord(tower(200, 0))).toContain("快");
    // 倒数是节流刷的，不是逐帧改 DOM
    expect(SRC).toContain("paceT");
  });
});
