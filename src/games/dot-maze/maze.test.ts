import { describe, expect, it } from "vitest";
import {
  TURN_BUFFER_MS,
  buildMaze,
  bufferedTurn,
  canTurn,
  cellIndex,
  dotsLeft,
  emptyBuffer,
  floodFill,
  isEnclosed,
  isJunction,
  openDirs,
  parseMaze,
  reachableDots,
  renderMaze,
  stepCell,
  wrapTunnel,
  type Maze,
} from "./maze";

const SMALL = [
  "#########",
  "#...#...#",
  "#.#...#.#",
  "-...#...-",
  "#.#...#.#",
  "#...#..o#",
  "#########",
];

function small(): Maze {
  return parseMaze(SMALL);
}

describe("豆豆迷宫 · 地图解析", () => {
  it("字符网格能解析出墙、豆、能量豆与隧道行", () => {
    const m = small();
    expect(m.w).toBe(9);
    expect(m.h).toBe(7);
    expect(m.wall[cellIndex(m, 0, 0)]).toBe(true);
    expect(m.wall[cellIndex(m, 1, 1)]).toBe(false);
    expect(m.dot[cellIndex(m, 1, 1)]).toBe(true);
    expect(m.power[cellIndex(m, 7, 5)]).toBe(true);
    expect(m.tunnelRows).toEqual([3]);
  });

  it("renderMaze 能把地图画回等价的字符网格", () => {
    const m = small();
    const rows = renderMaze(m);
    expect(rows.length).toBe(SMALL.length);
    expect(rows[0]).toBe("#########");
    expect(rows[3][0]).toBe("-");
    expect(rows[3][8]).toBe("-");
  });
});

describe("豆豆迷宫 · 墙与转向", () => {
  it("墙挡住去路时不能转向", () => {
    const m = small();
    // (1,1) 上方是边框墙
    expect(canTurn(m, { x: 1, y: 1 }, "up")).toBe(false);
    expect(canTurn(m, { x: 1, y: 1 }, "right")).toBe(true);
  });

  it("走一格永远落在通路格上，绝不穿墙", () => {
    const m = small();
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        if (m.wall[cellIndex(m, x, y)]) continue;
        for (const d of openDirs(m, { x, y })) {
          const next = stepCell(m, { x, y }, d);
          expect(m.wall[cellIndex(m, next.x, next.y)]).toBe(false);
        }
      }
    }
  });

  it("直走廊不是交叉口，拐角与三岔口才是", () => {
    const m = parseMaze([
      "#####",
      "#...#",
      "###.#",
      "#####",
    ]);
    // (2,1) 左右都通，是直走廊
    expect(isJunction(m, { x: 2, y: 1 })).toBe(false);
    // (3,1) 左边通、下边通，是拐角
    expect(isJunction(m, { x: 3, y: 1 })).toBe(true);
  });
});

describe("豆豆迷宫 · 输入缓冲", () => {
  it("提前按下的转向在缓冲窗口内到达路口依然生效", () => {
    const m = small();
    const buf = { dir: "down" as const, at: 1000 };
    expect(bufferedTurn(m, { x: 1, y: 1 }, buf, 1000 + TURN_BUFFER_MS - 1)).toBe("down");
  });

  it("超过缓冲窗口就作废", () => {
    const m = small();
    const buf = { dir: "down" as const, at: 1000 };
    expect(bufferedTurn(m, { x: 1, y: 1 }, buf, 1000 + TURN_BUFFER_MS + 1)).toBeNull();
  });

  it("缓冲方向撞墙时不生效，也不会把人塞进墙里", () => {
    const m = small();
    const buf = { dir: "up" as const, at: 500 };
    expect(bufferedTurn(m, { x: 1, y: 1 }, buf, 520)).toBeNull();
    expect(bufferedTurn(m, { x: 1, y: 1 }, emptyBuffer(), 520)).toBeNull();
  });
});

describe("豆豆迷宫 · 隧道", () => {
  it("隧道行左右相通", () => {
    const m = small();
    expect(wrapTunnel(m, -1, 3)).toEqual({ x: 8, y: 3 });
    expect(wrapTunnel(m, 9, 3)).toEqual({ x: 0, y: 3 });
  });

  it("非隧道行不环绕，越界坐标被夹回地图内", () => {
    const m = small();
    expect(wrapTunnel(m, -1, 1)).toEqual({ x: 0, y: 1 });
    expect(canTurn(m, { x: 1, y: 1 }, "left")).toBe(false);
  });

  it("从隧道口往外走会从另一侧出来", () => {
    const m = small();
    expect(stepCell(m, { x: 0, y: 3 }, "left")).toEqual({ x: 8, y: 3 });
  });
});

describe("豆豆迷宫 · 可达性与封闭性", () => {
  it("手写小图里所有豆子都能吃到", () => {
    const m = small();
    expect(reachableDots(m)).toBe(dotsLeft(m));
  });

  it("洪水填充覆盖到所有通路格", () => {
    const m = small();
    const seen = floodFill(m, m.spawn);
    for (let i = 0; i < m.wall.length; i++) {
      if (!m.wall[i]) expect(seen[i]).toBe(true);
    }
  });

  it("生成器产出的地图边框封闭（只有隧道口是开的）", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const m = buildMaze(seed * 13, { w: 17, h: 13, density: 0.18, tunnels: 2, powerPellets: 4 });
      expect(isEnclosed(m), `seed ${seed} 的边框漏了`).toBe(true);
    }
  });

  it("生成器产出的地图一定可以清空", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const m = buildMaze(seed * 101, { w: 19, h: 15, density: 0.25, tunnels: 1, powerPellets: 4 });
      expect(reachableDots(m), `seed ${seed} 有吃不到的豆子`).toBe(dotsLeft(m));
      expect(dotsLeft(m)).toBeGreaterThan(20);
    }
  });

  it("同一个 seed 生成的地图完全一致", () => {
    const a = buildMaze(777, { w: 17, h: 13, density: 0.2, tunnels: 2, powerPellets: 4 });
    const b = buildMaze(777, { w: 17, h: 13, density: 0.2, tunnels: 2, powerPellets: 4 });
    expect(renderMaze(a)).toEqual(renderMaze(b));
  });

  it("能量豆数量按参数落地，且不与普通豆重叠", () => {
    const m = buildMaze(4242, { w: 19, h: 13, density: 0.15, tunnels: 1, powerPellets: 4 });
    let power = 0;
    for (let i = 0; i < m.power.length; i++) {
      if (m.power[i]) {
        power++;
        expect(m.dot[i]).toBe(false);
      }
    }
    expect(power).toBe(4);
  });
});
