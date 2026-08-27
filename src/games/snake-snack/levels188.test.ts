// 1.1：贪吃毛毛虫 99 → 188 的新花园、新机制与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, totalSize, TOTAL_LEVELS } from "../level99";
import {
  CHAPTERS,
  ENDLESS_MAX_TARGET,
  endlessGarden,
  endlessGardenName,
  endlessLine,
  GRID,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  LEVELS,
  type SnakeLevel,
} from "./levels";
import {
  cellKey,
  freeCells,
  gateOpenFor,
  gateSet,
  loseLine,
  mirrorDir,
  moverAt,
  moverCells,
  moverPathCells,
  openingLine,
  portalMap,
  reachableCells,
  snackKind,
  spawnA,
  spawnB,
  starsFor,
  wallSet,
  winLine,
} from "./logic";

/** 前 99 关的「指纹」：任何一处生成参数被改动都会对不上 */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const NEW_LEVELS = Array.from({ length: TOTAL_LEVELS - LEGACY_LEVELS }, (_, i) => LEGACY_LEVELS + i);
/** 四座新花园的关号区间（0 基，左闭右开） */
const TWIN = [99, 122] as const;
const PORTAL = [122, 144] as const;
const MOVER = [144, 166] as const;
const GATE = [166, 188] as const;
const MID = Math.floor(GRID / 2);

/** 从毛毛虫出生的格子出发，能走到的非墙格子数 */
function reachFromSpawn(lv: SnakeLevel, gateOpen = true): Set<number> {
  const head = spawnA()[0];
  return reachableCells(lv, cellKey(head[0], head[1]), gateOpen);
}

describe("贪吃毛毛虫 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "青青草原", "树篱花园", "石柱庭院", "回字迷宫", "十字花坛", "星光夜园",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("前 99 关每关墙体与速度一笔未改（生成指纹回归）", () => {
    expect(fnv(JSON.stringify(LEVELS.slice(0, 99)))).toBe("dac35a05");
  });

  it("前 99 关一律没有任何 1.1 新机制字段", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.twin).toBeUndefined();
      expect(lv.portals).toBeUndefined();
      expect(lv.movers).toBeUndefined();
      expect(lv.gate).toBeUndefined();
      expect(lv.gateMax).toBeUndefined();
      expect(lv.trimEvery).toBeUndefined();
    }
  });
});

describe("贪吃毛毛虫 · 1.1 新花园", () => {
  it("总关数 188，末尾追加了 4 座全新花园共 89 关", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual(["双子藤园", "星门花园", "巡逻小刺猬", "窄门大考"]);
  });

  it("新花园文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
  });

  it("四座新花园的机制各不相同：双身位 / 星门 / 小刺猬 / 窄门", () => {
    for (let lv = TWIN[0]; lv < TWIN[1]; lv++) expect(LEVELS[lv].twin).toBe(true);
    for (let lv = PORTAL[0]; lv < PORTAL[1]; lv++) {
      expect(LEVELS[lv].portals?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
    for (let lv = MOVER[0]; lv < MOVER[1]; lv++) {
      expect(LEVELS[lv].movers?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
    for (let lv = GATE[0]; lv < GATE[1]; lv++) {
      expect(LEVELS[lv].gate?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(LEVELS[lv].gateMax ?? 0).toBeGreaterThanOrEqual(6);
      expect(LEVELS[lv].trimEvery ?? 0).toBeGreaterThanOrEqual(3);
    }
    // 机制互不越界
    for (const lv of NEW_LEVELS) {
      const ci = chapterOf(CHAPTERS, lv);
      if (ci !== 6) expect(LEVELS[lv].twin).toBeUndefined();
      if (ci !== 7) expect(LEVELS[lv].portals).toBeUndefined();
      if (ci !== 8) expect(LEVELS[lv].movers).toBeUndefined();
      if (ci !== 9) expect(LEVELS[lv].gate).toBeUndefined();
    }
  });

  it("第 100–188 关逐关墙体合法：不出界、不堵两条毛毛虫的出生行、不占满棋盘", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      const seen = new Set<number>();
      for (const [x, y] of cfg.walls) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(GRID);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(GRID);
        expect(y === MID && x >= 1 && x <= 7).toBe(false);
        // 墙格不重复
        expect(seen.has(cellKey(x, y))).toBe(false);
        seen.add(cellKey(x, y));
      }
      expect(cfg.walls.length).toBeLessThan(GRID * GRID * 0.3);
      expect(cfg.target).toBeGreaterThanOrEqual(5);
      expect(cfg.tickMs).toBeGreaterThanOrEqual(170);
      // 双身位的第二条毛毛虫出生位置也必须是空的
      if (cfg.twin) {
        for (const [x, y] of spawnB()) expect(seen.has(cellKey(x, y))).toBe(false);
      }
    }
  });

  it("第 100–188 关逐关可通关：窄门开着时全园连通，空地足够放下目标口数", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      const free = freeCells(cfg);
      const reach = reachFromSpawn(cfg, true);
      expect(reach.size).toBe(free.length);
      // 空地至少要能同时放下吃饱后的身子和点心
      expect(free.length).toBeGreaterThan(cfg.target + 10);
    }
  });

  it("星门花园：星门成对、不压在墙上，关着窄门也不影响它当捷径", () => {
    for (let lv = PORTAL[0]; lv < PORTAL[1]; lv++) {
      const cfg = LEVELS[lv];
      const walls = wallSet(cfg);
      const map = portalMap(cfg);
      expect(map.size).toBe((cfg.portals?.length ?? 0) * 2);
      map.forEach((to, from) => {
        expect(walls.has(from)).toBe(false);
        expect(walls.has(to)).toBe(false);
        expect(map.get(to)).toBe(from);
      });
      // 竖墙立起来之后，右半边只能靠星门到达
      if (cfg.walls.some(([x]) => x === 9)) {
        const noPortal: SnakeLevel = { ...cfg, portals: undefined };
        expect(reachFromSpawn(noPortal).size).toBeLessThan(freeCells(cfg).length);
      }
    }
  });

  it("巡逻小刺猬：巡逻路线不出界、不压墙，来回走得回原点", () => {
    for (let lv = MOVER[0]; lv < MOVER[1]; lv++) {
      const cfg = LEVELS[lv];
      const walls = wallSet(cfg);
      const path = moverPathCells(cfg);
      path.forEach((k) => {
        const x = k % GRID;
        const y = Math.floor(k / GRID);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(GRID);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(GRID);
        expect(walls.has(k)).toBe(false);
      });
      // 出生那一段绝不站小刺猬
      for (const [x, y] of spawnA()) expect(path.has(cellKey(x, y))).toBe(false);
      for (const m of cfg.movers ?? []) {
        expect(moverAt(m, 0)).toEqual([m[0], m[1]]);
        expect(moverAt(m, 2 * m[4])).toEqual([m[0], m[1]]);
        expect(moverAt(m, m[4])).toEqual([m[0] + m[2] * m[4], m[1] + m[3] * m[4]]);
      }
    }
  });

  it("窄门大考：窄门是唯一的通道，关上时两半就断开，剪刀果一定救得回来", () => {
    for (let lv = GATE[0]; lv < GATE[1]; lv++) {
      const cfg = LEVELS[lv];
      const openAll = reachFromSpawn(cfg, true);
      const shut = reachFromSpawn(cfg, false);
      expect(shut.size).toBeLessThan(openAll.size);
      // 门格不能同时又是墙
      const walls = wallSet(cfg);
      gateSet(cfg).forEach((k) => expect(walls.has(k)).toBe(false));
      // 身子超过上限时下一口必定是剪刀果，永远不会卡死
      expect(gateOpenFor(cfg, cfg.gateMax! + 1)).toBe(false);
      expect(snackKind(cfg, 1, cfg.gateMax! + 1)).toBe("trim");
      expect(gateOpenFor(cfg, cfg.gateMax!)).toBe(true);
    }
  });

  it("新花园内部难度递进：目标更多、爬得更快", () => {
    for (const [from, to] of [TWIN, PORTAL, MOVER, GATE]) {
      expect(LEVELS[from].target).toBeLessThan(LEVELS[to - 1].target);
      expect(LEVELS[to - 1].tickMs).toBeLessThan(LEVELS[from].tickMs);
    }
    expect(LEVELS[MOVER[0]].movers!.length).toBeLessThan(LEVELS[MOVER[1] - 1].movers!.length);
    expect(LEVELS[GATE[0]].gateMax!).toBeGreaterThanOrEqual(LEVELS[GATE[1] - 1].gateMax!);
  });
});

describe("贪吃毛毛虫 · 双身位与镜像", () => {
  it("两条毛毛虫出生在不同的行，左右按键真的反着走", () => {
    const a = spawnA();
    const b = spawnB();
    expect(a[0][1]).not.toBe(b[0][1]);
    expect(a).toHaveLength(3);
    expect(b).toHaveLength(3);
    expect(mirrorDir([1, 0])).toEqual([-1, 0]);
    expect(mirrorDir([-1, 0])).toEqual([1, 0]);
    // 上下不翻面，所以两条虫的行距永远不变，绝不会迎头对撞
    expect(mirrorDir([0, 1])).toEqual([0, 1]);
    expect(mirrorDir([0, -1])).toEqual([0, -1]);
  });

  it("双子藤园的墙左右对称，两条出生段都是空的", () => {
    for (let lv = TWIN[0]; lv < TWIN[1]; lv++) {
      const cfg = LEVELS[lv];
      const walls = wallSet(cfg);
      for (const [x, y] of cfg.walls) {
        expect(walls.has(cellKey(GRID - 1 - x, y))).toBe(true);
      }
      for (const [x, y] of [...spawnA(), ...spawnB()]) expect(walls.has(cellKey(x, y))).toBe(false);
    }
  });
});

describe("贪吃毛毛虫 · 无尽花园", () => {
  it("每一座花园都能玩：墙合法、全园连通、四种机制轮着上", () => {
    const seen = new Set<string>();
    for (let garden = 1; garden <= 40; garden++) {
      const cfg = endlessGarden(garden);
      seen.add(cfg.twin ? "twin" : cfg.portals ? "portal" : cfg.movers ? "mover" : cfg.gate ? "gate" : "plain");
      expect(cfg.tickMs).toBeGreaterThanOrEqual(180);
      expect(cfg.target).toBeGreaterThanOrEqual(6);
      expect(cfg.target).toBeLessThanOrEqual(ENDLESS_MAX_TARGET);
      expect(cfg.walls.length).toBeLessThan(GRID * GRID * 0.3);
      for (const [x, y] of cfg.walls) {
        expect(y === MID && x >= 1 && x <= 7).toBe(false);
      }
      expect(reachFromSpawn(cfg, true).size).toBe(freeCells(cfg).length);
    }
    expect(seen).toEqual(new Set(["plain", "twin", "portal", "mover", "gate"]));
  });

  it("座数越靠后越快，但第 16 座之后停在封顶", () => {
    expect(endlessGarden(1).tickMs).toBeGreaterThan(endlessGarden(6).tickMs);
    expect(endlessGarden(16).tickMs).toBe(endlessGarden(41).tickMs);
    expect(endlessGarden(0)).toEqual(endlessGarden(1));
    expect(endlessGardenName(1)).toBe("露水园");
    expect(endlessGardenName(6)).toBe("露水园");
    for (let g = 1; g <= 30; g++) expect(endlessGardenName(g)).not.toMatch(/[A-Za-z]/);
  });

  it("收工文案只鼓励不批评", () => {
    expect(endlessLine(30, 12)).toContain("新纪录");
    expect(endlessLine(5, 40)).toContain("最好成绩");
    expect(endlessLine(0, 0)).toContain("慢慢转弯");
    for (const line of [endlessLine(0, 0), endlessLine(5, 40), endlessLine(30, 12)]) {
      expect(line).not.toMatch(/[A-Za-z]/);
      expect(line).not.toMatch(/笨|太差|没用|不行/);
    }
  });
});

describe("贪吃毛毛虫 · 点心与文案", () => {
  it("剪刀果按节奏出现，身子太长时立刻补一个", () => {
    const gateLv = LEVELS[GATE[0]];
    expect(snackKind(gateLv, 4, 5)).toBe("trim");
    expect(snackKind(gateLv, 1, 5)).toBe("normal");
    expect(snackKind(gateLv, 2, 5)).toBe("star");
    expect(snackKind(gateLv, 0, 99)).toBe("trim");
    // 没有窄门的花园永远不会掉剪刀果
    expect(snackKind(LEVELS[0], 4, 30)).toBe("normal");
    expect(snackKind(LEVELS[0], 2, 4)).toBe("star");
  });

  it("小刺猬每两拍挪一格，位置永远落在巡逻线上", () => {
    const cfg = LEVELS[MOVER[0]];
    for (let step = 0; step < 20; step++) {
      const cells = moverCells(cfg, step);
      expect(cells.size).toBeGreaterThanOrEqual(1);
      cells.forEach((k) => expect(moverPathCells(cfg).has(k)).toBe(true));
    }
  });

  it("星星果拿得多星就多", () => {
    expect(starsFor(0)).toBe(1);
    expect(starsFor(1)).toBe(2);
    expect(starsFor(2)).toBe(3);
    expect(starsFor(5)).toBe(3);
  });

  it("开局说明与胜负文案按机制分流，失败话术不批评小朋友", () => {
    expect(openingLine(LEVELS[TWIN[0]])).toContain("镜像");
    expect(openingLine(LEVELS[PORTAL[0]])).toContain("星门");
    expect(openingLine(LEVELS[MOVER[0]])).toContain("小刺猬");
    expect(openingLine(LEVELS[GATE[0]])).toContain("窄门");
    expect(openingLine(LEVELS[0])).toContain("星星果");
    expect(winLine(LEVELS[TWIN[0]], 8, 1)).toContain("配合");
    expect(winLine(LEVELS[PORTAL[0]], 8, 1)).toContain("星门");
    expect(winLine(LEVELS[MOVER[0]], 8, 1)).toContain("小刺猬");
    expect(winLine(LEVELS[GATE[0]], 8, 1)).toContain("窄门");
    for (const reason of ["fence", "wall", "self", "twin", "mover"] as const) {
      const line = loseLine(reason);
      expect(line.length).toBeGreaterThan(6);
      expect(line).not.toMatch(/[A-Za-z]/);
      expect(line).not.toMatch(/笨|太差|没用|不行/);
    }
    for (const lv of NEW_LEVELS) expect(openingLine(LEVELS[lv])).not.toMatch(/[A-Za-z]/);
  });
});
