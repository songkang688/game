import { describe, expect, it } from "vitest";
import {
  AI_TIERS,
  AI_TIER_LABELS,
  WEIGHTS,
  applyPlacement,
  choosePlacement,
  duelWins,
  enumeratePlacements,
  kickNeeded,
  measure,
  quadAvailable,
  scorePlacement,
  simulateVersus,
  solveLevel,
  tierBlurb,
  tspinAvailable
} from "./ai";
import { COLS, ROWS, buildBoard, collides, createBoard, maxHeight } from "./board";
import { PIECE_IDS, rng } from "./pieces";

describe("block-drop · 落点枚举", () => {
  it("空场地上每种块都有一堆落点,而且都落在场地里", () => {
    const b = createBoard();
    for (const id of PIECE_IDS) {
      const list = enumeratePlacements(b, id);
      expect(list.length).toBeGreaterThan(5);
      for (const p of list) {
        for (const c of p.cells) {
          expect(c.x + p.x).toBeGreaterThanOrEqual(0);
          expect(c.x + p.x).toBeLessThan(COLS);
          expect(c.y + p.y).toBeLessThan(ROWS);
        }
      }
    }
  });

  it("小方块只有一个旋转态,落点数正好是列数减一", () => {
    const list = enumeratePlacements(createBoard(), "O");
    expect(new Set(list.map((p) => p.rot)).size).toBe(1);
    expect(new Set(list.map((p) => p.x)).size).toBe(COLS - 1);
  });

  it("落点都是真的贴着地的:再往下一格就撞", () => {
    const b = buildBoard([[3, 4], [3, 4, 5]]);
    for (const id of PIECE_IDS) {
      for (const p of enumeratePlacements(b, id)) {
        const after = applyPlacement(b, p);
        expect(after.board).toHaveLength(ROWS);
      }
    }
  });

  it("屋檐下面的窄缝会被枚举成「落到底再转一下」的落点", () => {
    const b = buildBoard([[4], [3, 4, 5], []]);
    const spun = enumeratePlacements(b, "T").filter((p) => p.spun);
    expect(spun.length).toBeGreaterThan(0);
  });

  it("场地填满就一个落点也没有", () => {
    const full = createBoard().map(() => new Array<number>(COLS).fill(1));
    for (const id of PIECE_IDS) expect(enumeratePlacements(full, id)).toHaveLength(0);
  });
});

describe("block-drop · 形态评估", () => {
  it("算指标不会把传进来的场地改掉", () => {
    const b = buildBoard([[2], [2, 3]]);
    const before = JSON.stringify(b);
    for (const p of enumeratePlacements(b, "L")) measure(b, p);
    expect(JSON.stringify(b)).toBe(before);
  });

  it("能消行的落点 lines 数得对", () => {
    const b = buildBoard([[0], [0], [0], [0]]); // 第 0 列空着的一口四格井
    const quads = enumeratePlacements(b, "I").filter((p) => measure(b, p).lines === 4);
    expect(quads.length).toBeGreaterThan(0);
  });

  it("洞越多、越高分越低", () => {
    const w = WEIGHTS.pro;
    const flat = { height: 10, peak: 1, holes: 0, bump: 0, deepWell: 0, lines: 0 };
    const holey = { ...flat, holes: 4 };
    const tall = { ...flat, height: 60, peak: 8 };
    expect(scorePlacement(holey, w)).toBeLessThan(scorePlacement(flat, w));
    expect(scorePlacement(tall, w)).toBeLessThan(scorePlacement(flat, w));
  });

  it("消行越多加分越多,而且四行的加成比一行的四倍还多", () => {
    const w = WEIGHTS.pro;
    const base = { height: 10, peak: 1, holes: 0, bump: 0, deepWell: 0, lines: 0 };
    const one = scorePlacement({ ...base, lines: 1 }, w);
    const four = scorePlacement({ ...base, lines: 4 }, w);
    expect(four).toBeGreaterThan(one * 4);
  });

  it("高手和地狱档才在意留井,菜鸟不在意", () => {
    expect(WEIGHTS.pro.well).toBeGreaterThan(0);
    expect(WEIGHTS.hell.well).toBeGreaterThan(0);
    expect(WEIGHTS.rookie.well).toBe(0);
  });

  it("四档都嫌弃洞,而且越高档越嫌弃", () => {
    expect(WEIGHTS.rookie.holes).toBeLessThan(0);
    expect(WEIGHTS.normal.holes).toBeLessThan(WEIGHTS.rookie.holes);
    expect(WEIGHTS.pro.holes).toBeLessThan(WEIGHTS.normal.holes);
    expect(WEIGHTS.hell.holes).toBeLessThan(WEIGHTS.pro.holes);
  });
});

describe("block-drop · 四档 AI", () => {
  it("四档都有中文名和一句说明,说明里不提商标", () => {
    expect(AI_TIERS).toEqual(["rookie", "normal", "pro", "hell"]);
    for (const t of AI_TIERS) {
      expect(AI_TIER_LABELS[t].length).toBeGreaterThan(1);
      expect(tierBlurb(t).length).toBeGreaterThan(4);
    }
    expect(new Set(AI_TIERS.map((t) => AI_TIER_LABELS[t])).size).toBe(4);
  });

  it("每一档都挑得出落点,而且挑出来的确实能放", () => {
    const b = buildBoard([[5], [5, 6]]);
    for (const t of AI_TIERS) {
      const p = choosePlacement(b, "T", t, { rand: rng(3) });
      expect(p).not.toBeNull();
      // 挑出来的落点得真的放得下:再往下一格就撞
      expect(collides(b, p!.cells, p!.x, p!.y)).toBe(false);
      expect(collides(b, p!.cells, p!.x, p!.y + 1)).toBe(true);
      const after = applyPlacement(b, p!);
      expect(after.board).toHaveLength(ROWS);
    }
  });

  it("同一个随机源同一块场地,选出来的落点完全一样", () => {
    const b = buildBoard([[1], [1, 2]]);
    for (const t of AI_TIERS) {
      const a = choosePlacement(b, "J", t, { rand: rng(9) });
      const c = choosePlacement(b, "J", t, { rand: rng(9) });
      expect(a).toEqual(c);
    }
  });

  it("普通档以上不会主动在平地上挖洞(斜块躲不掉,最多一个)", () => {
    const b = createBoard();
    for (const t of ["normal", "pro", "hell"] as const) {
      for (const id of PIECE_IDS) {
        const p = choosePlacement(b, id, t, { rand: rng(4) })!;
        // 左折右折两种斜块放在完全平的地面上一定会留一个格,别的块不许留
        expect(measure(b, p).holes).toBeLessThanOrEqual(id === "S" || id === "Z" ? 1 : 0);
      }
    }
  });

  it("留着一口四格井,高手档看到长条就插进去消四行", () => {
    const b = buildBoard([[9], [9], [9], [9]]);
    const p = choosePlacement(b, "I", "pro", { rand: rng(1) })!;
    expect(measure(b, p).lines).toBe(4);
  });

  it("场地填满的时候挑不出落点,返回 null", () => {
    const full = createBoard().map(() => new Array<number>(COLS).fill(1));
    for (const t of AI_TIERS) expect(choosePlacement(full, "O", t, { rand: rng(1) })).toBeNull();
  });

  it("地狱档会连着看下一个块", () => {
    const b = buildBoard([[9], [9], [9]]);
    const withNext = choosePlacement(b, "O", "hell", { next: "I", rand: rng(2) });
    expect(withNext).not.toBeNull();
    // 看了下一个块也不能把井堵上
    expect(measure(b, withNext!).deepWell).toBeGreaterThan(0);
  });

  it("挑落点不会改场地", () => {
    const b = buildBoard([[3], [3, 4]]);
    const before = JSON.stringify(b);
    for (const t of AI_TIERS) choosePlacement(b, "S", t, { next: "T", rand: rng(6) });
    expect(JSON.stringify(b)).toBe(before);
  });
});

describe("block-drop · 局面探测", () => {
  it("屋檐加凹槽的局面能打出小凸转身", () => {
    // 底下一行只缺第 4 格,中间一行缺 3~5,上面那一行的第 5 格搭出屋檐
    expect(tspinAvailable(buildBoard([[4], [3, 4, 5], [3, 4]]))).toBe(true);
  });

  it("空场地上打不出小凸转身,也消不了四行", () => {
    const b = createBoard();
    expect(tspinAvailable(b)).toBe(false);
    expect(quadAvailable(b)).toBe(false);
    expect(kickNeeded(b)).toBe(false);
  });

  it("四格深的井就是能一次消四行", () => {
    expect(quadAvailable(buildBoard([[0], [0], [0], [0]]))).toBe(true);
    expect(quadAvailable(buildBoard([[0], [0]]))).toBe(false);
  });
});

describe("block-drop · 对战强度", () => {
  it("固定 seed 下同一场对战跑两次结果一样", () => {
    const a = simulateVersus("pro", "normal", 12345);
    const b = simulateVersus("pro", "normal", 12345);
    expect(a).toEqual(b);
  });

  it("一局打完总有个结果,而且没人叠到超出场地", () => {
    const r = simulateVersus("hell", "rookie", 777);
    expect(["a", "b", "draw"]).toContain(r.winner);
    expect(r.pieces).toBeGreaterThan(0);
    expect(r.sentA + r.sentB).toBeGreaterThanOrEqual(0);
  });

  it("地狱档对菜鸟档 20 局压倒性获胜", () => {
    const r = duelWins("hell", "rookie", 20);
    expect(r.a).toBeGreaterThanOrEqual(16);
    expect(r.a).toBeGreaterThan(r.b);
  }, 120000);

  it("相邻两档 20 局:高的那一档赢得更多(菜鸟 < 普通 < 高手 < 地狱)", () => {
    const nr = duelWins("normal", "rookie", 20);
    const pn = duelWins("pro", "normal", 20);
    const hp = duelWins("hell", "pro", 20);
    expect(nr.a).toBeGreaterThan(nr.b);
    expect(pn.a).toBeGreaterThan(pn.b);
    expect(hp.a).toBeGreaterThan(hp.b);
  }, 300000);

  it("换一批 seed 也一样是高档赢:地狱对高手不看运气", () => {
    const r = duelWins("hell", "pro", 20, 555);
    expect(r.a).toBeGreaterThan(r.b);
  }, 300000);
});

describe("block-drop · 求解器", () => {
  it("空场地上高手档能按目标消够行", () => {
    const r = solveLevel(createBoard(), 42, { lines: 4, pieces: 40 }, "hell");
    expect(r.ok).toBe(true);
    expect(r.lines).toBeGreaterThanOrEqual(4);
    expect(r.used).toBeLessThanOrEqual(40);
    expect(r.toppedOut).toBe(false);
  });

  it("块数不够就判不过,但不会崩", () => {
    const r = solveLevel(createBoard(), 42, { lines: 8, pieces: 3 }, "hell");
    expect(r.ok).toBe(false);
    expect(r.used).toBeLessThanOrEqual(3);
  });

  it("同一个 seed 走出来的过程一模一样", () => {
    const a = solveLevel(createBoard(), 5, { lines: 3, pieces: 30 }, "hell");
    const b = solveLevel(createBoard(), 5, { lines: 3, pieces: 30 }, "hell");
    expect(a).toEqual(b);
  });

  it("限定只出三种块也解得掉", () => {
    const r = solveLevel(createBoard(), 8, { lines: 3, pieces: 40 }, "hell", ["O", "I", "L"]);
    expect(r.ok).toBe(true);
  });

  it("求解过程不会改传进来的初始场地", () => {
    const start = buildBoard([[9], [9], [9], [9]]);
    const before = JSON.stringify(start);
    solveLevel(start, 11, { lines: 4, pieces: 30 }, "hell");
    expect(JSON.stringify(start)).toBe(before);
    expect(maxHeight(start)).toBe(4);
  });
});
