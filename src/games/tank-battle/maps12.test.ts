/**
 * 对战对称地图与冰原老巢的用例(1.2 新增)。
 *
 * 「对称」是这三张对战图的硬约束:翻过去必须和原图一模一样,
 * 朵朵的出生点和星星的互换。谁都占不到地形便宜,这一条要写成断言,
 * 不然改图的人一手滑就把左边多塞了一块钢板。
 */
import { describe, expect, it } from "vitest";
import {
  ARENAS,
  FROST_NEST,
  FROST_NEST_MAP,
  arenaById,
  isSymmetric,
  mirrorX,
  mirrorY,
  rotate180,
  swapSides,
} from "./maps12";
import { createWorld, parseMap, reachable, tileAt } from "./logic";
import { TILE_CHARS } from "./terrain12";

function countChar(rows: readonly string[], ch: string): number {
  let n = 0;
  for (const row of rows) for (const c of row) if (c === ch) n += 1;
  return n;
}

describe("翻图工具", () => {
  it("翻图时朵朵和星星互换,别的字符原样不动", () => {
    expect(swapSides("1")).toBe("2");
    expect(swapSides("2")).toBe("1");
    for (const ch of [...TILE_CHARS, "e"]) expect(swapSides(ch)).toBe(ch);
  });

  it("左右翻 / 上下翻 / 转 180° 各翻各的,翻两次回到原图", () => {
    const rows = ["1.#", "S~*", "..2"];
    expect(mirrorX(rows)).toEqual(["#.2", "*~S", "1.."]);
    expect(mirrorY(rows)).toEqual(["..1", "S~*", "2.#"]);
    expect(rotate180(rows)).toEqual(["1..", "*~S", "#.2"]);
    expect(mirrorX(mirrorX(rows))).toEqual([...rows]);
    expect(rotate180(rotate180(rows))).toEqual([...rows]);
  });

  it("isSymmetric 抓得住不对称:左边多一块砖就报假", () => {
    expect(isSymmetric(["1...2"], "mirror-x")).toBe(true);
    expect(isSymmetric(["1#..2"], "mirror-x")).toBe(false);
  });
});

describe("三张对战场", () => {
  it("每一张都按自己声明的那种对称严格对称", () => {
    for (const arena of ARENAS) {
      expect(isSymmetric(arena.rows, arena.symmetry), `${arena.name} 不对称`).toBe(true);
    }
  });

  it("三张图三种对称,id 也不重样", () => {
    expect(ARENAS).toHaveLength(3);
    expect(new Set(ARENAS.map((a) => a.symmetry)).size).toBe(3);
    expect(new Set(ARENAS.map((a) => a.id)).size).toBe(3);
    expect(arenaById("pinwheel").name).toBe("转盘广场");
    expect(arenaById("没有这张图").id).toBe(ARENAS[0].id);
  });

  it("每行一样长,而且两位玩家各有且只有一个出生点", () => {
    for (const arena of ARENAS) {
      const w = arena.rows[0].length;
      for (const row of arena.rows) expect(row.length, `${arena.name} 行宽不齐`).toBe(w);
      expect(countChar(arena.rows, "1"), `${arena.name} 朵朵出生点`).toBe(1);
      expect(countChar(arena.rows, "2"), `${arena.name} 星星出生点`).toBe(1);
      // 对战场不放老巢:这是纯粹的互相追,不用守家
      expect(countChar(arena.rows, "B")).toBe(0);
    }
  });

  it("地形五件套每张图都用上了,不是一片空地", () => {
    for (const arena of ARENAS) {
      for (const ch of ["#", "S", "~", "*", "i"]) {
        expect(countChar(arena.rows, ch), `${arena.name} 缺 ${ch}`).toBeGreaterThan(0);
      }
    }
  });

  it("两个人走得到对方那边:没有谁被砖墙彻底封死", () => {
    for (const arena of ARENAS) {
      const map = parseMap(arena.rows);
      const [a, b] = map.playerSpawns;
      expect(a, `${arena.name} 缺出生点`).toBeTruthy();
      expect(b, `${arena.name} 缺出生点`).toBeTruthy();
      expect(reachable(map, a, b), `${arena.name} 两边走不通`).toBe(true);
    }
  });

  it("对战地图能直接拿来开一局,两台车都站在自己的出生点上", () => {
    for (const arena of ARENAS) {
      const w = createWorld({ rows: [...arena.rows], mode: "versus", players: 2, target: 3 });
      expect(w.tanks).toHaveLength(2);
      const [duo, xing] = w.tanks;
      expect(tileAt(w.map, Math.floor(duo.x), Math.floor(duo.y))).toBe(".");
      expect(tileAt(w.map, Math.floor(xing.x), Math.floor(xing.y))).toBe(".");
      expect(duo.player).toBe(0);
      expect(xing.player).toBe(1);
    }
  });

  it("每张图都写了给孩子看的名字和一句话玩法,而且不带打仗的词", () => {
    for (const arena of ARENAS) {
      expect(arena.name.length).toBeGreaterThan(1);
      expect(arena.emoji.length).toBeGreaterThan(0);
      expect(arena.desc.length).toBeGreaterThan(6);
      expect(`${arena.name}${arena.desc}`).not.toMatch(/爆炸|死|血|伤|杀/);
    }
  });
});

describe("冰原老巢(无尽场)", () => {
  it("老巢在底边、三个铁皮车出生点在顶边、两位玩家一左一右", () => {
    const map = parseMap(FROST_NEST);
    expect(map.base).toBeTruthy();
    expect(map.base?.cy).toBe(map.h - 1);
    expect(map.enemySpawns).toHaveLength(3);
    for (const s of map.enemySpawns) expect(s.cy).toBe(0);
    expect(map.playerSpawns).toHaveLength(2);
    expect(map.playerSpawns[0].cx).toBeLessThan(map.base?.cx ?? 0);
    expect(map.playerSpawns[1].cx).toBeGreaterThan(map.base?.cx ?? 0);
  });

  it("确实是「冰原」:横着铺了不止一条冰带", () => {
    const iceRows = FROST_NEST.filter((row) => row.includes("i"));
    expect(iceRows.length).toBeGreaterThanOrEqual(3);
    expect(countChar(FROST_NEST, "i")).toBeGreaterThanOrEqual(12);
  });

  it("铁皮车从出生点冲得到老巢,老巢外面还围着一圈护墙", () => {
    const map = parseMap(FROST_NEST);
    const base = map.base;
    expect(base).toBeTruthy();
    if (!base) return;
    for (const spawn of map.enemySpawns) {
      expect(reachable(map, spawn, { cx: base.cx, cy: base.cy - 3 })).toBe(true);
    }
    expect(tileAt(map, base.cx, base.cy - 1)).toBe("#");
    expect(tileAt(map, base.cx - 1, base.cy)).toBe("#");
    expect(tileAt(map, base.cx + 1, base.cy)).toBe("#");
  });

  it("挂在无尽入口上的那张卡片信息齐全", () => {
    expect(FROST_NEST_MAP.id).toBe("frost");
    expect(FROST_NEST_MAP.rows).toBe(FROST_NEST);
    expect(FROST_NEST_MAP.desc.length).toBeGreaterThan(6);
  });
});
