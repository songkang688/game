import { describe, expect, it } from "vitest";
import {
  FLAG,
  GUESS,
  HIDDEN,
  OPEN,
  autoFlagRest,
  boardFromMines,
  canChord,
  chord,
  cloneBoard,
  createBoard,
  flagCount,
  flagsLeft,
  floodOpen,
  fogVisible,
  hintMap,
  indexOf,
  lost,
  maxMines,
  moveCursor,
  neighborTable,
  openedCount,
  placeMines,
  progress,
  replantMines,
  revealOrder,
  safeLeft,
  safeZone,
  toggleFlag,
  won,
  wrongFlags,
  xOf,
  yOf,
  type Board
} from "./board";

/** 用一张文本图摆盘面：`*` 是刺种，其余都是空地 */
function fromRows(rows: string[]): Board {
  const h = rows.length;
  const w = rows[0].length;
  const mine = new Uint8Array(w * h);
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) if (row[x] === "*") mine[indexOf(w, x, y)] = 1;
  });
  return boardFromMines(w, h, mine);
}

function countMines(mine: Uint8Array): number {
  let n = 0;
  for (const v of mine) n += v ? 1 : 0;
  return n;
}

describe("mine-garden · 邻格表与坐标", () => {
  it("角上 3 个邻居、边上 5 个、中间 8 个", () => {
    const t = neighborTable(9, 9);
    expect(t[indexOf(9, 0, 0)]).toHaveLength(3);
    expect(t[indexOf(9, 4, 0)]).toHaveLength(5);
    expect(t[indexOf(9, 4, 4)]).toHaveLength(8);
    expect(t[indexOf(9, 8, 8)]).toHaveLength(3);
  });

  it("同一个尺寸的邻格表只算一次（缓存命中同一个对象）", () => {
    expect(neighborTable(7, 5)).toBe(neighborTable(7, 5));
    expect(neighborTable(7, 5)).not.toBe(neighborTable(5, 7));
  });

  it("下标和行列换算对得上", () => {
    const i = indexOf(12, 5, 3);
    expect(xOf(12, i)).toBe(5);
    expect(yOf(12, i)).toBe(3);
  });

  it("光标撞到边就停住，不绕回另一头", () => {
    expect(moveCursor(5, 5, 0, "left")).toBe(0);
    expect(moveCursor(5, 5, 0, "up")).toBe(0);
    expect(moveCursor(5, 5, 0, "right")).toBe(1);
    expect(moveCursor(5, 5, 0, "down")).toBe(5);
    expect(moveCursor(5, 5, 24, "right")).toBe(24);
    expect(moveCursor(5, 5, 24, "down")).toBe(24);
  });
});

describe("mine-garden · 布种：首点及 8 邻格必安全", () => {
  it("多个 seed、多个首点，安全区里一颗刺种都没有", () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const first of [0, 4, 40, 44, 80]) {
        const mine = placeMines(9, 9, 10, first, seed);
        for (const i of safeZone(9, 9, first)) {
          expect(mine[i], `seed=${seed} first=${first} 第 ${i} 格不该有刺种`).toBe(0);
        }
      }
    }
  });

  it("刺种总数永远等于要的那个数", () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(countMines(placeMines(9, 9, 10, 40, seed))).toBe(10);
      expect(countMines(placeMines(16, 16, 40, 100, seed))).toBe(40);
      expect(countMines(placeMines(30, 16, 99, 200, seed))).toBe(99);
    }
  });

  it("同一个 seed 布出同一张图，换 seed 就换图", () => {
    const a = placeMines(9, 9, 10, 40, 7);
    const b = placeMines(9, 9, 10, 40, 7);
    const c = placeMines(9, 9, 10, 40, 8);
    expect([...a]).toEqual([...b]);
    expect([...a]).not.toEqual([...c]);
  });

  it("要的颗数超过安全区之外的空位时会自动收着放，不会死循环", () => {
    const mine = placeMines(5, 5, 100, 12, 3);
    expect(countMines(mine)).toBe(maxMines(5, 5, 12));
    expect(countMines(mine)).toBe(25 - 9);
  });

  it("首点传 -1 表示不留安全区（假人与测试用）", () => {
    expect(countMines(placeMines(5, 5, 24, -1, 5))).toBe(24);
  });
});

describe("mine-garden · 数字图", () => {
  it("每格的数字就是周围 8 格的刺种数", () => {
    const b = fromRows([".*.", "...", "..*"]);
    expect(b.hint[indexOf(3, 0, 0)]).toBe(1);
    expect(b.hint[indexOf(3, 1, 1)]).toBe(2);
    expect(b.hint[indexOf(3, 0, 2)]).toBe(0);
    expect(b.hint[indexOf(3, 2, 1)]).toBe(2);
  });

  it("刺种格自己也照样按周围算，`mines` 统计得对", () => {
    const b = fromRows(["**", "**"]);
    expect(b.mines).toBe(4);
    for (let i = 0; i < 4; i++) expect(b.hint[i]).toBe(3);
  });

  it("hintMap 和 boardFromMines 算出来的是一回事", () => {
    const mine = placeMines(9, 9, 12, 40, 21);
    expect([...hintMap(9, 9, mine)]).toEqual([...boardFromMines(9, 9, mine).hint]);
  });

  it("重新埋种之后数字图跟着重算", () => {
    const b = createBoard(4, 4);
    expect(b.mines).toBe(0);
    const mine = new Uint8Array(16);
    mine[0] = 1;
    replantMines(b, mine);
    expect(b.mines).toBe(1);
    expect(b.hint[indexOf(4, 1, 1)]).toBe(1);
  });
});

describe("mine-garden · 洪水展开", () => {
  it("翻到 0 会把整片连通空区连同边界数字一起翻开", () => {
    const b = fromRows([".....", ".....", "..*..", ".....", "....."]);
    const r = floodOpen(b, indexOf(5, 0, 0));
    expect(r.hit).toBe(false);
    // 24 格非刺种全开：刺种周围的数字格就是这一片的边界
    expect(r.opened).toHaveLength(24);
    expect(openedCount(b)).toBe(24);
  });

  it("展开停在数字格上，数字格后面的东西不动", () => {
    const b = fromRows(["...*.", "...*.", "...*.", "...*.", "...*."]);
    floodOpen(b, indexOf(5, 0, 0));
    expect(b.state[indexOf(5, 2, 0)]).toBe(OPEN);
    expect(b.state[indexOf(5, 4, 0)]).toBe(HIDDEN);
  });

  it("插了旗的格子挡住展开，也挡住直接点", () => {
    const b = fromRows([".....", ".....", "..*..", ".....", "....."]);
    toggleFlag(b, indexOf(5, 0, 1));
    const r = floodOpen(b, indexOf(5, 0, 1));
    expect(r.opened).toHaveLength(0);
    floodOpen(b, indexOf(5, 0, 0));
    expect(b.state[indexOf(5, 0, 1)]).toBe(FLAG);
  });

  it("翻到刺种就是踩中，只翻开那一格", () => {
    const b = fromRows([".*.", "...", "..."]);
    const r = floodOpen(b, indexOf(3, 1, 0));
    expect(r.hit).toBe(true);
    expect(r.hitAt).toBe(indexOf(3, 1, 0));
    expect(lost(b)).toBe(true);
  });

  it("翻同一格两次不会重复计数", () => {
    const b = fromRows([".*.", "...", "..."]);
    const first = floodOpen(b, indexOf(3, 0, 0));
    const again = floodOpen(b, indexOf(3, 0, 0));
    expect(first.opened.length).toBeGreaterThan(0);
    expect(again.opened).toHaveLength(0);
  });
});

describe("mine-garden · 双键和弦", () => {
  /** 两颗刺种在上排两角，中间那格数字是 2 */
  const rows = ["*.*", "...", "..."];
  const mid = indexOf(3, 1, 1);

  it("旗插对了：一次翻开周围一圈，安全", () => {
    const b = fromRows(rows);
    floodOpen(b, mid);
    expect(b.hint[mid]).toBe(2);
    toggleFlag(b, indexOf(3, 0, 0));
    toggleFlag(b, indexOf(3, 2, 0));
    expect(canChord(b, mid)).toBe(true);
    const r = chord(b, mid);
    expect(r.hit).toBe(false);
    expect(r.opened).toHaveLength(6);
    expect(won(b)).toBe(true);
  });

  it("旗插错地方：和弦会真的踩到刺种", () => {
    const b = fromRows(rows);
    floodOpen(b, mid);
    // 两面旗都插在空地上，数字看着「够了」，其实一颗都没标对
    toggleFlag(b, indexOf(3, 0, 1));
    toggleFlag(b, indexOf(3, 2, 1));
    expect(canChord(b, mid)).toBe(true);
    const r = chord(b, mid);
    expect(r.hit).toBe(true);
    expect(b.mine[r.hitAt]).toBe(1);
    expect(lost(b)).toBe(true);
  });

  it("旗数不够就按不动，数字 0 的格子也按不动", () => {
    const b = fromRows(rows);
    floodOpen(b, mid);
    expect(canChord(b, mid)).toBe(false);
    expect(chord(b, mid).opened).toHaveLength(0);
    toggleFlag(b, indexOf(3, 0, 0));
    expect(canChord(b, mid)).toBe(false);
    const zero = indexOf(3, 1, 2);
    floodOpen(b, zero);
    expect(b.hint[zero]).toBe(0);
    expect(canChord(b, zero)).toBe(false);
  });

  it("周围已经没有未开格时不再提示和弦，还没翻开的数字格也不算", () => {
    const b = fromRows(rows);
    expect(canChord(b, mid)).toBe(false);
    floodOpen(b, mid);
    toggleFlag(b, indexOf(3, 0, 0));
    toggleFlag(b, indexOf(3, 2, 0));
    chord(b, mid);
    expect(canChord(b, mid)).toBe(false);
  });
});

describe("mine-garden · 插旗", () => {
  it("隐藏 → 旗 → 空，已翻开的格子不理会", () => {
    const b = fromRows(["*..", "...", "..."]);
    expect(toggleFlag(b, 4)).toBe("flag");
    expect(b.state[4]).toBe(FLAG);
    expect(toggleFlag(b, 4)).toBe("clear");
    expect(b.state[4]).toBe(HIDDEN);
    floodOpen(b, 8);
    expect(toggleFlag(b, 8)).toBe("none");
  });

  it("开了问号档就是 隐藏 → 旗 → 问号 → 隐藏", () => {
    const b = fromRows(["*..", "...", "..."]);
    expect(toggleFlag(b, 4, { useGuess: true })).toBe("flag");
    expect(toggleFlag(b, 4, { useGuess: true })).toBe("guess");
    expect(b.state[4]).toBe(GUESS);
    expect(toggleFlag(b, 4, { useGuess: true })).toBe("clear");
    expect(b.state[4]).toBe(HIDDEN);
  });

  it("限旗关插满之后再插会被挡下来，收一面就又能插", () => {
    const b = fromRows(["*.*", "...", "..."]);
    expect(toggleFlag(b, 3, { limit: 2 })).toBe("flag");
    expect(toggleFlag(b, 4, { limit: 2 })).toBe("flag");
    expect(toggleFlag(b, 5, { limit: 2 })).toBe("blocked");
    expect(flagCount(b)).toBe(2);
    expect(toggleFlag(b, 3, { limit: 2 })).toBe("clear");
    expect(toggleFlag(b, 5, { limit: 2 })).toBe("flag");
  });

  it("剩余小旗数 = 刺种数 − 已插旗数，插多了会变负数", () => {
    const b = fromRows(["*..", "...", "..."]);
    expect(flagsLeft(b)).toBe(1);
    toggleFlag(b, 4);
    expect(flagsLeft(b)).toBe(0);
    toggleFlag(b, 5);
    expect(flagsLeft(b)).toBe(-1);
  });
});

describe("mine-garden · 胜负判定", () => {
  it("胜利只看「非刺种格全翻开」，一面旗都不插也能赢", () => {
    const b = fromRows(["*..", "...", "..."]);
    for (let i = 1; i < 9; i++) floodOpen(b, i);
    expect(flagCount(b)).toBe(0);
    expect(won(b)).toBe(true);
    expect(lost(b)).toBe(false);
  });

  it("旗插错地方照样能赢（旗不参与判定）", () => {
    const b = fromRows(["*..", "...", "..."]);
    toggleFlag(b, 8);
    for (let i = 1; i < 8; i++) floodOpen(b, i);
    expect(won(b)).toBe(false);
    toggleFlag(b, 8);
    floodOpen(b, 8);
    expect(won(b)).toBe(true);
    expect(wrongFlags(b)).toEqual([]);
  });

  it("翻到一颗刺种就是输，进度与剩余格数跟着变", () => {
    const b = fromRows(["*..", "...", "..."]);
    expect(safeLeft(b)).toBe(8);
    expect(progress(b)).toBe(0);
    floodOpen(b, 8);
    expect(progress(b)).toBeGreaterThan(0);
    floodOpen(b, 0);
    expect(lost(b)).toBe(true);
  });

  it("赢了之后自动把剩下的刺种补上小旗（只是收尾好看）", () => {
    const b = fromRows(["*.*", "...", "..."]);
    for (let i = 0; i < 9; i++) if (!b.mine[i]) floodOpen(b, i);
    expect(won(b)).toBe(true);
    expect(autoFlagRest(b)).toHaveLength(2);
    expect(flagCount(b)).toBe(2);
  });

  it("输了之后剩下的刺种按「离踩中那一格由近到远」排队开花", () => {
    const b = fromRows(["*...*", ".....", "..*..", ".....", "*...*"]);
    const hitAt = indexOf(5, 2, 2);
    const order = revealOrder(b, hitAt);
    expect(order).toHaveLength(4);
    const dist = order.map((i) => Math.hypot(xOf(5, i) - 2, yOf(5, i) - 2));
    for (let i = 1; i < dist.length; i++) expect(dist[i]).toBeGreaterThanOrEqual(dist[i - 1]);
  });

  it("插错地方的小旗能被复盘出来", () => {
    const b = fromRows(["*..", "...", "..."]);
    toggleFlag(b, 4);
    toggleFlag(b, 0);
    expect(wrongFlags(b)).toEqual([4]);
  });
});

describe("mine-garden · 迷雾只挡显示", () => {
  it("光标周围 3×3 看得见，别处看不见", () => {
    expect(fogVisible(9, 9, indexOf(9, 4, 4), indexOf(9, 4, 4))).toBe(true);
    expect(fogVisible(9, 9, indexOf(9, 4, 4), indexOf(9, 5, 5))).toBe(true);
    expect(fogVisible(9, 9, indexOf(9, 4, 4), indexOf(9, 6, 4))).toBe(false);
    expect(fogVisible(9, 9, -1, indexOf(9, 0, 0))).toBe(true);
  });

  it("看不见的格子照样能翻开、照样算赢——雾一点都不影响判定", () => {
    const b = fromRows(["*..", "...", "..."]);
    const cursor = 0;
    const far = 8;
    expect(fogVisible(3, 3, cursor, far)).toBe(false);
    for (let i = 1; i < 9; i++) floodOpen(b, i);
    expect(won(b)).toBe(true);
  });
});

describe("mine-garden · 复制盘面", () => {
  it("cloneBoard 是深拷贝，改副本不影响原图", () => {
    const b = fromRows(["*..", "...", "..."]);
    const c = cloneBoard(b);
    floodOpen(c, 8);
    expect(openedCount(b)).toBe(0);
    expect(openedCount(c)).toBeGreaterThan(0);
    expect(c.mines).toBe(b.mines);
  });
});
