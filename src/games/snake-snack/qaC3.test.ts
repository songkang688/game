// 档C · 第 3 轮测试员 · snake-snack:188 关一关不漏地爬一遍。
//
// 前两轮打的是样本。第 3 轮改成全量:每一关都要「墙合法 + 全园连通 + 出生位干净 +
// 吃得满目标 + 速度不失控 + 文案干净」,两种模式都走到结算,存档往返连坏档一起验。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, loadStars, saveStar, type StorageLike } from "../level99";
import { meta } from "./meta";
import {
  CHAPTERS,
  ENDLESS_GARDENS,
  GRID,
  LEGACY_LEVELS,
  LEVELS,
  endlessGarden,
  endlessGardenName,
  endlessLine,
  type SnakeLevel,
} from "./levels";
import {
  cellKey,
  freeCells,
  gateOpenFor,
  loseLine,
  moverPathCells,
  openingLine,
  portalMap,
  reachableCells,
  spawnA,
  spawnB,
  starsFor,
  wallSet,
  winLine,
} from "./logic";
import { FLOOR_MS, boardFullLine, knotLine, runSummary, speedCurveFor } from "./snake12";

function reachFromSpawn(lv: SnakeLevel): Set<number> {
  const head = spawnA()[0];
  return reachableCells(lv, cellKey(head[0], head[1]), true);
}

function memStore(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

/* ------------------------------------------------------------------ */
/* 一、188 关全量                                                       */
/* ------------------------------------------------------------------ */

describe("档C R3 · snake-snack · 188 关一关不漏", () => {
  it("关数、章节切分都对得上", () => {
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    expect(TOTAL_LEVELS).toBe(188);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL_LEVELS);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("每一关的墙都合法:在格子里、不压出生位、总量不堵路", () => {
    // 镜像出生位只有双身位的关才用得上,单身位的关允许在那儿摆墙
    LEVELS.forEach((lv, i) => {
      const spawn = new Set(
        [...spawnA(), ...(lv.twin ? spawnB() : [])].map(([x, y]) => cellKey(x, y))
      );
      for (const [x, y] of lv.walls) {
        expect(x, `第 ${i + 1} 关有墙出了格子`).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(GRID);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(GRID);
        expect(spawn.has(cellKey(x, y)), `第 ${i + 1} 关的墙压在出生位上`).toBe(false);
      }
      expect(lv.walls.length, `第 ${i + 1} 关墙太多,爬不开`).toBeLessThan(GRID * GRID * 0.3);
    });
  });

  /**
   * 【C3-01 结论:维持现状，钉住不许扩散】
   *
   * 1.0 的六章生成墙的时候没过 `dedupe()`（回字的四角、十字的中心、镜像的中轴都会撞车），
   * 同一格被写进 `walls` 两遍：**25 关、88 个重复格，全在第 99 关以内**。
   * 玩起来看不出来——碰撞判定走 `wallSet()`（Set），画墙也是同一格画两遍、像素一致。
   * 本轮修复员实测补 `dedupe()` 会当场打红 `levels188.test.ts` 里那把
   * 「前 99 关一笔未改」的 FNV 指纹锁，所以维持现状（理由见第 3 轮修复员报告）。
   *
   * 这条断言的作用因此变成两件事：**钉住范围别扩散**（1.1/1.2 的 89 关必须一格都不重），
   * 以及**钉住它确实只是重复**（去重后墙的集合不变）。
   */
  it("重复墙格锁死在 1.0 老章的 25 关里,新章一格都不许重(C3-01 回归闸)", () => {
    const dirty: Array<[number, number]> = [];
    LEVELS.forEach((lv, i) => {
      const seen = new Set<number>();
      let dup = 0;
      for (const [x, y] of lv.walls) {
        const k = cellKey(x, y);
        if (seen.has(k)) dup++;
        else seen.add(k);
      }
      if (dup > 0) dirty.push([i + 1, dup]);
    });
    expect(dirty).toHaveLength(25);
    expect(dirty.reduce((s, d) => s + d[1], 0)).toBe(88);
    for (const [lvNo] of dirty) {
      expect(lvNo, `第 ${lvNo} 关重复,超出了 1.0 老章的范围`).toBeLessThanOrEqual(LEGACY_LEVELS);
    }
    // 1.1 / 1.2 追加的 89 关走的是过了 dedupe 的那条路,一格都不许重
    for (let i = LEGACY_LEVELS; i < LEVELS.length; i++) {
      const lv = LEVELS[i];
      expect(wallSet(lv).size, `第 ${i + 1} 关有重复的墙格`).toBe(lv.walls.length);
    }
    // 重复只是「多写了一遍」:去重之后墙的集合一格不多一格不少
    LEVELS.forEach((lv, i) => {
      expect(wallSet(lv).size, `第 ${i + 1} 关去重之后墙反而变多了`).toBeLessThanOrEqual(
        lv.walls.length
      );
      expect(wallSet(lv).size, `第 ${i + 1} 关去重之后一堵墙都不剩`).toBe(
        new Set(lv.walls.map(([x, y]) => cellKey(x, y))).size
      );
    });
  });

  it("每一关都全园连通:出生位出发走得到每一个空格", () => {
    LEVELS.forEach((lv, i) => {
      expect(reachFromSpawn(lv).size, `第 ${i + 1} 关有走不到的角落`).toBe(freeCells(lv).length);
    });
  });

  it("每一关的空格都够吃完目标:身子铺满之前一定吃得到最后一口", () => {
    LEVELS.forEach((lv, i) => {
      const free = freeCells(lv).length;
      const longest = spawnA().length + lv.target;
      expect(free, `第 ${i + 1} 关只剩 ${free} 个空格却要吃 ${lv.target} 口`).toBeGreaterThan(longest + 6);
      expect(lv.target, `第 ${i + 1} 关一口都不用吃`).toBeGreaterThan(0);
    });
  });

  it("每一关的速度都不失控:初速有下限,加速也压不穿地板", () => {
    LEVELS.forEach((lv, i) => {
      const c = speedCurveFor(lv);
      expect(c.startMs, `第 ${i + 1} 关一开局就快过地板`).toBeGreaterThanOrEqual(FLOOR_MS);
      expect(c.minMs, `第 ${i + 1} 关的最快速度穿了地板`).toBeGreaterThanOrEqual(FLOOR_MS);
      expect(c.minMs).toBeLessThanOrEqual(c.startMs);
      expect(c.stepMs).toBeGreaterThan(0);
      expect(c.every).toBeGreaterThan(0);
    });
  });

  it("机关都自洽:星门成对、小刺猬走在格子里、窄门给得出上限、石头不压墙", () => {
    LEVELS.forEach((lv, i) => {
      const walls = wallSet(lv);
      const pm = portalMap(lv);
      for (const [k, v] of pm) {
        expect(pm.get(v), `第 ${i + 1} 关的星门没成对`).toBe(k);
        expect(walls.has(k), `第 ${i + 1} 关的星门压在墙上`).toBe(false);
      }
      for (const k of moverPathCells(lv)) {
        expect(k, `第 ${i + 1} 关的小刺猬走出了格子`).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThan(GRID * GRID);
        expect(walls.has(k), `第 ${i + 1} 关的小刺猬撞进墙里`).toBe(false);
      }
      if (lv.gate) {
        expect(lv.gateMax, `第 ${i + 1} 关有窄门却没写 gateMax`).toBeGreaterThan(0);
        expect(gateOpenFor(lv, 1), `第 ${i + 1} 关短身子也挤不过窄门`).toBe(true);
      }
      for (const [x, y] of lv.stones ?? []) {
        expect(walls.has(cellKey(x, y)), `第 ${i + 1} 关的小石头压在墙上`).toBe(false);
      }
      if (lv.ring) {
        expect(lv.ringDoor?.length, `第 ${i + 1} 关有绕圈却没有门`).toBeGreaterThan(0);
      }
    });
  });

  it("双身位的关左右镜像都摆得开:镜像出生位也不在墙上", () => {
    const twins = LEVELS.filter((lv) => lv.twin);
    expect(twins.length, "一关双身位都没有?").toBeGreaterThan(0);
    for (const lv of twins) {
      const walls = wallSet(lv);
      for (const [x, y] of spawnB()) expect(walls.has(cellKey(x, y))).toBe(false);
    }
  });

  it("每一关的开场白和结算语都干净,而且失败只鼓励", () => {
    const harsh = ["你输了", "笨", "蠢", "血", "死亡", "干掉", "杀", "失败"];
    LEVELS.forEach((lv, i) => {
      const lines = [openingLine(lv), winLine(lv, lv.target, 3), winLine(lv, lv.target, 0)];
      for (const line of lines) {
        expect(line.length, `第 ${i + 1} 关有空文案`).toBeGreaterThan(0);
        for (const w of harsh) expect(line.includes(w), `第 ${i + 1} 关的文案里有「${w}」`).toBe(false);
      }
    });
    for (const r of ["fence", "wall", "self", "twin", "mover", "stone"] as const) {
      const line = knotLine(r);
      expect(line, `${r} 的结算语没说「结」`).toContain("结");
      for (const w of harsh) expect(line.includes(w), `${r} 的结算语里有「${w}」`).toBe(false);
    }
    for (const r of ["fence", "wall", "self", "twin", "mover"] as const) {
      for (const w of harsh) expect(loseLine(r).includes(w)).toBe(false);
    }
    expect(boardFullLine()).toContain("厉害");
  });

  it("星级评定给得出三档,而且满分一定是 3 星", () => {
    expect(starsFor(2)).toBe(3);
    expect(starsFor(1)).toBe(2);
    expect(starsFor(0)).toBe(1);
    for (const g of [-3, 0, 1, 2, 9]) {
      const s = starsFor(g);
      expect([1, 2, 3]).toContain(s);
    }
  });

  it("这一趟的总结不会写出负数", () => {
    for (const [eaten, sec] of [[0, 0], [1, 0.4], [30, 125], [-3, -9]]) {
      const line = runSummary(eaten, sec);
      expect(line).not.toContain("-");
      expect(line.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 二、两种模式                                                         */
/* ------------------------------------------------------------------ */

describe("档C R3 · snake-snack · 两种模式一个不漏", () => {
  it("meta 只声明战役和无尽,而且两个都有真实入口", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless"]);
    expect(LEVELS[0].target).toBeGreaterThan(0);
    expect(endlessGarden(1).target).toBeGreaterThan(0);
  });

  it("无尽:连开 60 座每座都摆得开、全园连通、吃得完", () => {
    const kinds = new Set<string>();
    for (let g = 1; g <= 60; g++) {
      const cfg = endlessGarden(g);
      kinds.add(cfg.twin ? "twin" : cfg.portals ? "portal" : cfg.movers ? "mover" : cfg.gate ? "gate" : "plain");
      expect(reachFromSpawn(cfg).size, `第 ${g} 座有走不到的角落`).toBe(freeCells(cfg).length);
      expect(freeCells(cfg).length, `第 ${g} 座空格不够吃 ${cfg.target} 口`).toBeGreaterThan(
        spawnA().length + cfg.target + 6
      );
      expect(cfg.tickMs).toBeGreaterThanOrEqual(FLOOR_MS);
      expect(ENDLESS_GARDENS).toContain(endlessGardenName(g));
    }
    expect(kinds).toEqual(new Set(["plain", "twin", "portal", "mover", "gate"]));
  });

  it("无尽结算只鼓励,而且认新纪录", () => {
    expect(endlessLine(99, 5)).toContain("新纪录");
    for (const [eaten, best] of [[0, 0], [3, 90], [90, 3]]) {
      const line = endlessLine(eaten, best);
      for (const w of ["输", "笨", "菜", "失败"]) expect(line).not.toContain(w);
    }
  });

  it("五座园名都是中文,循环不乱", () => {
    expect(ENDLESS_GARDENS).toHaveLength(5);
    for (let g = 1; g <= 40; g++) {
      expect(endlessGardenName(g)).toBe(ENDLESS_GARDENS[(g - 1) % 5]);
      expect(endlessGardenName(g)).not.toMatch(/[A-Za-z]/);
    }
    expect(endlessGardenName(0)).toBe(ENDLESS_GARDENS[0]);
    expect(endlessGardenName(-9)).toBe(ENDLESS_GARDENS[0]);
  });
});

/* ------------------------------------------------------------------ */
/* 三、存档往返                                                         */
/* ------------------------------------------------------------------ */

describe("档C R3 · snake-snack · 存档往返", () => {
  it("188 关逐关存进去读出来,一颗星都不丢", () => {
    const store = memStore();
    for (let i = 0; i < TOTAL_LEVELS; i++) saveStar(meta.id, i, (((i % 3) + 1) as 1 | 2 | 3), store);
    const back = loadStars(meta.id, store);
    for (let i = 0; i < TOTAL_LEVELS; i++) expect(back[i], `第 ${i + 1} 关的星丢了`).toBe((i % 3) + 1);
  });

  it("星只增不减,坏档也读得回来", () => {
    const store = memStore();
    saveStar(meta.id, 3, 3, store);
    saveStar(meta.id, 3, 1, store);
    expect(loadStars(meta.id, store)[3]).toBe(3);
    for (const junk of ["", "]", "0", '{"stars":{"a":1}}']) {
      const bad = memStore();
      bad.setItem(`yiduo.game.${meta.id}`, junk);
      const arr = loadStars(meta.id, bad);
      expect(arr).toHaveLength(TOTAL_LEVELS);
      for (const v of arr) expect(v >= 0 && v <= 3).toBe(true);
    }
  });
});
