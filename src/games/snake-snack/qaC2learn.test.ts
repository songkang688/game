// 档C · 第 2 轮学习优化员 · L2-03:贪吃毛毛虫的「休闲无尽」不再第 16 座就冻住。
//
// 经典无尽还能靠 endlessTickMs 按累计口数一直加速,休闲档速度是恒定的;
// endlessGarden 的 k 又在第 16 座封顶,于是休闲档从第 16 座起纯粹是换风景。
// 改法:目标口数加第二段(每 4 座多一口,18 口封顶),第一段一口都不动。
import { describe, expect, it } from "vitest";
import {
  ENDLESS_GARDENS,
  ENDLESS_MAX_TARGET,
  ENDLESS_PEAK_GARDEN,
  ENDLESS_RAMP_GARDENS,
  GRID,
  endlessDifficulty,
  endlessGarden,
  endlessTarget,
} from "./levels";
import { FLOOR_MS, endlessTickMs } from "./snake12";
import { cellKey, freeCells, reachableCells, spawnA, type SnakeLevel } from "./logic";

/** 从毛毛虫出生的格子出发,能走到的非墙格子 */
function reachFromSpawn(lv: SnakeLevel): Set<number> {
  const head = spawnA()[0];
  return reachableCells(lv, cellKey(head[0], head[1]), true);
}

describe("档C R2 学习优化 · L2-03 休闲无尽的曲线延到第 36 座", () => {
  it("难度分 1~200 座一路不降", () => {
    for (let g = 2; g <= 200; g++) {
      expect(
        endlessDifficulty(g),
        `第 ${g} 座的难度分比第 ${g - 1} 座还低`
      ).toBeGreaterThanOrEqual(endlessDifficulty(g - 1));
    }
  });

  it("第 16 座不再是终点:第 16 / 24 / 32 / 36 座的难度分严格往上走", () => {
    const marks = [ENDLESS_RAMP_GARDENS, 24, 32, 36];
    for (let i = 1; i < marks.length; i++) {
      expect(
        endlessDifficulty(marks[i]),
        `第 ${marks[i]} 座和第 ${marks[i - 1]} 座一样难`
      ).toBeGreaterThan(endlessDifficulty(marks[i - 1]));
    }
  });

  it("第 36 座到顶,再往后是同一个分数", () => {
    const peak = endlessDifficulty(ENDLESS_PEAK_GARDEN);
    for (const g of [ENDLESS_PEAK_GARDEN, 40, 99, 400]) {
      expect(endlessDifficulty(g), `第 ${g} 座`).toBe(peak);
    }
    expect(endlessTarget(999)).toBe(ENDLESS_MAX_TARGET);
  });

  it("前 16 座的目标口数一口都没动", () => {
    for (let g = 1; g <= ENDLESS_RAMP_GARDENS; g++) {
      expect(endlessTarget(g), `第 ${g} 座`).toBe(6 + Math.floor(Math.min(g - 1, 15) / 2));
    }
    expect(endlessTarget(16)).toBe(13);
  });

  it("目标口数只增不减,封顶 18 口", () => {
    for (let g = 2; g <= 200; g++) {
      expect(endlessTarget(g)).toBeGreaterThanOrEqual(endlessTarget(g - 1));
      expect(endlessTarget(g)).toBeLessThanOrEqual(ENDLESS_MAX_TARGET);
    }
  });

  it("休闲档速度恒定这件事没变——难度全靠目标口数在涨", () => {
    for (let g = 16; g <= 40; g += 4) {
      const base = endlessGarden(g).tickMs;
      // 休闲档:吃多少口都是开局那个速度
      expect(endlessTickMs("calm", base, 0)).toBe(base);
      expect(endlessTickMs("calm", base, 500)).toBe(base);
      // 经典档:照旧越吃越快,但不会掉到地板以下
      expect(endlessTickMs("classic", base, 500)).toBe(FLOOR_MS);
    }
  });

  it("目标口数涨上去之后,园子里的空格还够吃这么多口", () => {
    for (let g = 1; g <= 60; g++) {
      const cfg = endlessGarden(g);
      const free = freeCells(cfg).length;
      // 吃满目标之后身子最长 3 + target 节,得留出富余
      expect(free, `第 ${g} 座只剩 ${free} 个空格,却要吃 ${cfg.target} 口`).toBeGreaterThan(
        cfg.target + 3 + 10
      );
    }
  });

  it("延段之后每一座照旧全园连通、墙不压在出生点", () => {
    for (let g = 16; g <= 60; g += 2) {
      const cfg = endlessGarden(g);
      expect(reachFromSpawn(cfg).size, `第 ${g} 座有走不到的角落`).toBe(freeCells(cfg).length);
      expect(cfg.walls.length).toBeLessThan(GRID * GRID * 0.3);
      const walls = new Set(cfg.walls.map(([x, y]) => cellKey(x, y)));
      expect(walls.size).toBe(cfg.walls.length);
    }
  });

  it("五种机制照旧五座一轮,延段没把风景搞乱", () => {
    const kindOf = (cfg: ReturnType<typeof endlessGarden>): string =>
      cfg.twin ? "twin" : cfg.portals ? "portal" : cfg.movers ? "mover" : cfg.gate ? "gate" : "plain";
    for (let g = 1; g <= 60; g++) {
      expect(kindOf(endlessGarden(g)), `第 ${g} 座`).toBe(kindOf(endlessGarden(((g - 1) % 5) + 1)));
      expect(endlessGarden(g).target, `第 ${g} 座`).toBe(endlessTarget(g));
    }
    expect(ENDLESS_GARDENS).toHaveLength(5);
  });

  it("座号越界不会算出负数口数", () => {
    for (const g of [-9, 0, 0.4, 1]) {
      expect(endlessTarget(g)).toBe(6);
      expect(endlessDifficulty(g)).toBe(endlessDifficulty(1));
    }
  });
});
