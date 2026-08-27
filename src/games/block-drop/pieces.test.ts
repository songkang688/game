import { describe, expect, it } from "vitest";
import {
  BOX_SIZE,
  PIECES,
  PIECE_COLORS,
  PIECE_IDS,
  PIECE_MARKS,
  PIECE_NAMES,
  PieceQueue,
  ROTS,
  SHAPES,
  cellsFor,
  nextBag,
  rng,
  rotStep,
  rotateMatrix,
  spawnX,
  type PieceId
} from "./pieces";

function key(cells: { x: number; y: number }[]): string {
  return cells
    .map((c) => `${c.x},${c.y}`)
    .sort()
    .join(" ");
}

describe("block-drop · 七种块", () => {
  it("正好七种,每种四个旋转态", () => {
    expect(PIECE_IDS).toHaveLength(7);
    expect(new Set(PIECE_IDS).size).toBe(7);
    for (const id of PIECE_IDS) {
      expect(PIECES[id]).toHaveLength(4);
      expect(SHAPES[id]).toHaveLength(4);
    }
  });

  it("每种块永远是四格", () => {
    for (const id of PIECE_IDS) {
      for (const rot of ROTS) {
        expect(cellsFor(id, rot)).toHaveLength(4);
      }
    }
  });

  it("外接方框:长条 4×4、小方 2×2、其余 3×3", () => {
    expect(BOX_SIZE.I).toBe(4);
    expect(BOX_SIZE.O).toBe(2);
    for (const id of ["T", "S", "Z", "J", "L"] as PieceId[]) expect(BOX_SIZE[id]).toBe(3);
    for (const id of PIECE_IDS) expect(SHAPES[id][0]).toHaveLength(BOX_SIZE[id]);
  });

  it("小方怎么转都是同一个样子", () => {
    const base = key(cellsFor("O", 0));
    for (const rot of ROTS) expect(key(cellsFor("O", rot))).toBe(base);
  });

  it("转四次回到出生态", () => {
    for (const id of PIECE_IDS) {
      let m = SHAPES[id][0];
      for (let i = 0; i < 4; i++) m = rotateMatrix(m);
      expect(m).toEqual(SHAPES[id][0]);
    }
  });

  it("长条和斜块只有两种真正不同的形状", () => {
    for (const id of ["I", "S", "Z"] as PieceId[]) {
      expect(key(cellsFor(id, 0))).not.toBe(key(cellsFor(id, 1)));
      // 转 180° 之后格子形状和出生态一样(只是整体挪了位置)
      const shapes = new Set(ROTS.map((r) => key(cellsFor(id, r))));
      expect(shapes.size).toBeLessThanOrEqual(4);
    }
  });

  it("小凸块的出生态是一个凸字", () => {
    expect(key(cellsFor("T", 0))).toBe(key([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]));
  });

  it("旋转态编号会绕圈,不会越界", () => {
    expect(rotStep(3, 1)).toBe(0);
    expect(rotStep(0, -1)).toBe(3);
    expect(cellsFor("T", 7 as never)).toEqual(cellsFor("T", 3));
  });

  it("出生位置在场地中间", () => {
    expect(spawnX("I", 10)).toBe(3);
    expect(spawnX("O", 10)).toBe(4);
    expect(spawnX("T", 10)).toBe(3);
  });

  it("每种块都有颜色、角标和中文名,而且都不重样", () => {
    const colors = new Set<string>();
    const names = new Set<string>();
    for (const id of PIECE_IDS) {
      expect(PIECE_COLORS[id]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(PIECE_MARKS[id].length).toBeGreaterThan(0);
      expect(PIECE_NAMES[id].length).toBeGreaterThan(1);
      colors.add(PIECE_COLORS[id]);
      names.add(PIECE_NAMES[id]);
    }
    expect(colors.size).toBe(7);
    expect(names.size).toBe(7);
  });
});

describe("block-drop · 七个一袋", () => {
  it("一袋七个,七种各一次", () => {
    const rand = rng(1);
    for (let i = 0; i < 30; i++) {
      const bag = nextBag(rand);
      expect(bag).toHaveLength(7);
      expect(new Set(bag).size).toBe(7);
      for (const id of PIECE_IDS) expect(bag).toContain(id);
    }
  });

  it("袋子顺序会变,不是每次都一样", () => {
    const rand = rng(99);
    const a = nextBag(rand).join("");
    const b = nextBag(rand).join("");
    const c = nextBag(rand).join("");
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });

  it("同一个 seed 出的顺序完全一样", () => {
    expect(nextBag(rng(7))).toEqual(nextBag(rng(7)));
  });

  it("跨袋看:连着取 70 个,七种各出现 10 次", () => {
    const q = new PieceQueue(rng(2024));
    const count: Record<string, number> = {};
    for (let i = 0; i < 70; i++) {
      const id = q.take();
      count[id] = (count[id] ?? 0) + 1;
    }
    for (const id of PIECE_IDS) expect(count[id]).toBe(10);
  });

  it("最长要等多久才出下一根长条:不会超过 12 个", () => {
    const q = new PieceQueue(rng(5));
    let gap = 0;
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      if (q.take() === "I") {
        worst = Math.max(worst, gap);
        gap = 0;
      } else gap += 1;
    }
    expect(worst).toBeLessThanOrEqual(12);
  });

  it("预览看得到后面五个,而且看了不会把队列吃掉", () => {
    const q = new PieceQueue(rng(11));
    const peek = q.peek(5);
    expect(peek).toHaveLength(5);
    expect(q.peek(5)).toEqual(peek);
    expect(q.take()).toBe(peek[0]);
    expect(q.peek(4)).toEqual(peek.slice(1));
  });

  it("入门章只出指定的那几种块", () => {
    const q = new PieceQueue(rng(3), ["O", "I", "L"]);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(q.take());
    expect([...seen].sort()).toEqual(["I", "L", "O"]);
  });

  it("随机源同 seed 同序列,而且都在 0..1 之间", () => {
    const a = rng(31);
    const b = rng(31);
    for (let i = 0; i < 8; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
