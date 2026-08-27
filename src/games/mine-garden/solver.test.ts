import { describe, expect, it } from "vitest";
import { boardFromMines, hintMap, indexOf, placeMines, safeZone } from "./board";
import {
  KNOWN_MINE,
  KNOWN_OPEN,
  buildConstraints,
  deduce,
  deduceSearch,
  deduceSimple,
  generateNoGuess,
  isLogicallySolvable,
  solveLogically
} from "./solver";

function minesFromRows(rows: string[]): { w: number; h: number; mine: Uint8Array } {
  const h = rows.length;
  const w = rows[0].length;
  const mine = new Uint8Array(w * h);
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) if (row[x] === "*") mine[indexOf(w, x, y)] = 1;
  });
  return { w, h, mine };
}

function countMines(mine: Uint8Array): number {
  let n = 0;
  for (const v of mine) n += v ? 1 : 0;
  return n;
}

/** 只用便宜的三级规则把一局跑完，用来对照完整枚举到底强多少 */
function solveSimpleOnly(w: number, h: number, mine: Uint8Array, first: number): number {
  const hint = hintMap(w, h, mine);
  const known = new Uint8Array(w * h);
  const table = boardFromMines(w, h, mine);
  const open = (start: number): void => {
    if (known[start] !== 0 || mine[start]) return;
    const queue = [start];
    known[start] = KNOWN_OPEN;
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      if (hint[cur] !== 0) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = (cur % w) + dx;
          const ny = Math.floor(cur / w) + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nb = ny * w + nx;
          if (known[nb] !== 0 || mine[nb]) continue;
          known[nb] = KNOWN_OPEN;
          if (hint[nb] === 0) queue.push(nb);
        }
      }
    }
  };
  open(first);
  for (;;) {
    const step = deduceSimple(w, h, hint, known, table.mines);
    if (step.safe.length === 0 && step.mines.length === 0) break;
    for (const c of step.mines) if (known[c] === 0) known[c] = KNOWN_MINE;
    for (const c of step.safe) open(c);
  }
  let opened = 0;
  for (let i = 0; i < known.length; i++) if (known[i] === KNOWN_OPEN) opened++;
  return opened;
}

describe("mine-garden · 约束抽取", () => {
  it("每个已翻开的数字格抽出一条「这几格里有几颗」的约束", () => {
    const { w, h, mine } = minesFromRows(["*..", "...", "..."]);
    const hint = hintMap(w, h, mine);
    const known = new Uint8Array(9);
    known[indexOf(3, 1, 1)] = KNOWN_OPEN;
    const cons = buildConstraints(w, h, hint, known);
    expect(cons).toHaveLength(1);
    expect(cons[0].need).toBe(1);
    expect(cons[0].cells).toHaveLength(8);
  });

  it("已经确认是刺种的邻格会从需求里扣掉，也不再出现在候选里", () => {
    const { w, h, mine } = minesFromRows(["*..", "...", "..."]);
    const hint = hintMap(w, h, mine);
    const known = new Uint8Array(9);
    known[indexOf(3, 1, 1)] = KNOWN_OPEN;
    known[indexOf(3, 0, 0)] = KNOWN_MINE;
    const cons = buildConstraints(w, h, hint, known);
    expect(cons[0].need).toBe(0);
    expect(cons[0].cells).toHaveLength(7);
    expect(cons[0].cells).not.toContain(indexOf(3, 0, 0));
  });
});

describe("mine-garden · 三级便宜规则", () => {
  it("平凡规则：数字扣完已知刺种剩 0 就全安全", () => {
    const { w, h, mine } = minesFromRows(["*..", "...", "..."]);
    const hint = hintMap(w, h, mine);
    const known = new Uint8Array(9);
    known[indexOf(3, 1, 1)] = KNOWN_OPEN;
    known[indexOf(3, 0, 0)] = KNOWN_MINE;
    const d = deduceSimple(w, h, hint, known, 1);
    expect(d.safe).toHaveLength(7);
    expect(d.mines).toHaveLength(0);
  });

  it("平凡规则：未知格数正好等于数字就全是刺种", () => {
    const { w, h, mine } = minesFromRows(["**", "*."]);
    const hint = hintMap(w, h, mine);
    const known = new Uint8Array(4);
    known[indexOf(2, 1, 1)] = KNOWN_OPEN;
    const d = deduceSimple(w, h, hint, known, 3);
    expect(d.mines.sort()).toEqual([0, 1, 2]);
  });

  it("子集规则：A ⊆ B 时差集能直接下结论", () => {
    // 上排三格里只有一颗刺种，左边两格的「1」把它锁在左半边
    const { w, h, mine } = minesFromRows(["*...", "....", "...."]);
    const hint = hintMap(w, h, mine);
    const known = new Uint8Array(12);
    known[indexOf(4, 0, 1)] = KNOWN_OPEN;
    known[indexOf(4, 1, 1)] = KNOWN_OPEN;
    const d = deduceSimple(w, h, hint, known, 1);
    // (0,1) 只看得见 (0,0)(1,0)，(1,1) 还多看见 (2,0)，差出来的 (2,0) 必然安全
    expect(d.safe).toContain(indexOf(4, 2, 0));
  });

  it("全局剩余数规则：刺种全找齐了，剩下的一律安全", () => {
    const { w, h, mine } = minesFromRows(["*..", "...", "..."]);
    const hint = hintMap(w, h, mine);
    const known = new Uint8Array(9);
    known[indexOf(3, 0, 0)] = KNOWN_MINE;
    const d = deduceSimple(w, h, hint, known, 1);
    expect(d.safe).toHaveLength(8);
  });

  it("全局剩余数规则：未知格数正好等于剩下的刺种数，那就全是刺种", () => {
    const { w, h, mine } = minesFromRows(["**", "**"]);
    const hint = hintMap(w, h, mine);
    const known = new Uint8Array(4);
    const d = deduceSimple(w, h, hint, known, 4);
    expect(d.mines).toHaveLength(4);
  });
});

describe("mine-garden · 完整枚举（约束求解器）", () => {
  it("枚举 + 全局剩余数：一颗刺种被锁在前沿里，远处那一片就全安全", () => {
    const { w, h, mine } = minesFromRows(["*.....", "......", "......"]);
    const hint = hintMap(w, h, mine);
    const known = new Uint8Array(w * h);
    known[indexOf(w, 1, 1)] = KNOWN_OPEN;
    // 便宜规则在这儿一格都推不出来
    const cheap = deduceSimple(w, h, hint, known, 1);
    expect(cheap.safe).toHaveLength(0);
    expect(cheap.mines).toHaveLength(0);
    // 枚举知道「唯一那颗刺种一定在这 8 格里」，于是前沿够不着的那 9 格全安全
    const deep = deduceSearch(w, h, hint, known, 1);
    expect(deep.usedSearch).toBe(true);
    expect(deep.safe).toHaveLength(9);
    for (const c of deep.safe) expect(mine[c]).toBe(0);
  });

  it("deduce 先便宜后贵：能用平凡规则解决就不启动枚举", () => {
    const { w, h, mine } = minesFromRows(["*..", "...", "..."]);
    const hint = hintMap(w, h, mine);
    const known = new Uint8Array(9);
    known[indexOf(3, 1, 1)] = KNOWN_OPEN;
    known[indexOf(3, 0, 0)] = KNOWN_MINE;
    expect(deduce(w, h, hint, known, 1).usedSearch).toBe(false);
  });

  it("推理是可靠的：说安全的一定不是刺种，说是刺种的一定是刺种", () => {
    let checked = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const w = 12;
      const h = 10;
      const first = indexOf(w, 5, 5);
      const mine = placeMines(w, h, 22, first, seed);
      const hint = hintMap(w, h, mine);
      const known = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) if (!mine[i] && (i * 7 + seed) % 3 === 0) known[i] = KNOWN_OPEN;
      const d = deduce(w, h, hint, known, 22);
      for (const c of d.safe) {
        checked++;
        expect(mine[c], `seed=${seed} 第 ${c} 格被判安全，其实埋着刺种`).toBe(0);
      }
      for (const c of d.mines) {
        checked++;
        expect(mine[c], `seed=${seed} 第 ${c} 格被判刺种，其实是空地`).toBe(1);
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it("完整枚举确实比三级规则更能往下推", () => {
    let better = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const first = indexOf(9, 4, 4);
      const mine = placeMines(9, 9, 14, first, seed);
      const full = solveLogically(9, 9, mine, first).opened;
      const cheap = solveSimpleOnly(9, 9, mine, first);
      expect(full).toBeGreaterThanOrEqual(cheap);
      if (full > cheap) better++;
    }
    expect(better, "40 张图里总该有几张是靠枚举才推下去的").toBeGreaterThan(0);
  });
});

describe("mine-garden · 整局推演", () => {
  it("能推到底的图就报 solved，卡住的图老老实实说卡住", () => {
    // 一颗刺种被两个「1」夹在两格之间，谁也说不清是哪一格 —— 这就是要蒙的图
    const { w, h, mine } = minesFromRows(["*.", "..", "..", ".."]);
    const first = indexOf(2, 0, 3);
    const res = solveLogically(w, h, mine, first);
    expect(res.solved).toBe(false);
    expect(res.opened).toBe(6);
    expect(res.safeTotal).toBe(7);
    expect(res.stuck.sort()).toEqual([indexOf(2, 0, 0), indexOf(2, 1, 0)]);
    expect(isLogicallySolvable({ w, h, mine }, first)).toBe(false);
  });

  it("求解器一次都不会去翻刺种（翻不动就是翻不动）", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const first = indexOf(9, 4, 4);
      const mine = placeMines(9, 9, 10, first, seed);
      const res = solveLogically(9, 9, mine, first);
      expect(res.opened).toBeLessThanOrEqual(res.safeTotal);
      if (res.solved) expect(res.opened).toBe(res.safeTotal);
    }
  });

  it("空地一片的图一下就推完了", () => {
    const mine = new Uint8Array(9 * 9);
    const res = solveLogically(9, 9, mine, 0);
    expect(res.solved).toBe(true);
    expect(res.opened).toBe(81);
    expect(res.usedSearch).toBe(false);
  });
});

describe("mine-garden · 无猜生成", () => {
  const CASES: Array<[string, number, number, number]> = [
    ["初级 9×9 / 10", 9, 9, 10],
    ["中级 16×16 / 40", 16, 16, 40],
    ["高级 30×16 / 99", 30, 16, 99]
  ];

  for (const [label, w, h, n] of CASES) {
    it(`${label}：50 个 seed 全部生成出「能一路推到底」的图`, () => {
      const first = indexOf(w, Math.floor(w / 2), Math.floor(h / 2));
      let ok = 0;
      for (let seed = 1; seed <= 50; seed++) {
        const res = generateNoGuess(w, h, n, first, seed);
        expect(res.noGuess, `${label} seed=${seed} 没能生成无猜图`).toBe(true);
        expect(isLogicallySolvable({ w, h, mine: res.mine }, first)).toBe(true);
        ok++;
      }
      expect(ok).toBe(50);
    });
  }

  it("修补与重洗都不改刺种总数", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const first = indexOf(16, 8, 8);
      const res = generateNoGuess(16, 16, 40, first, seed);
      expect(countMines(res.mine)).toBe(40);
    }
  });

  it("生成出来的图，首点及 8 邻格永远干净", () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const first of [0, indexOf(9, 8, 0), indexOf(9, 4, 4), indexOf(9, 8, 8)]) {
        const res = generateNoGuess(9, 9, 10, first, seed);
        for (const i of safeZone(9, 9, first)) expect(res.mine[i]).toBe(0);
      }
    }
  });

  it("同一个 seed 生成同一张图（关卡每次打开都长一样）", () => {
    const a = generateNoGuess(9, 9, 12, 40, 33);
    const b = generateNoGuess(9, 9, 12, 40, 33);
    expect([...a.mine]).toEqual([...b.mine]);
    expect(a.repairs).toBe(b.repairs);
  });

  it("不要无猜时立刻返回，一次修补都不做", () => {
    const res = generateNoGuess(9, 9, 10, 40, 5, { noGuess: false });
    expect(res.attempts).toBe(0);
    expect(res.repairs).toBe(0);
    expect(countMines(res.mine)).toBe(10);
  });

  it("预算烧完也一定会返回一张能玩的图（绝不卡住界面）", () => {
    // 把预算掐到几乎为零：拿不到无猜也要老老实实降级返回
    const res = generateNoGuess(16, 16, 60, 136, 9, {
      attempts: 1,
      repairs: 0,
      solve: { maxComponent: 2, nodeBudget: 1, totalBudget: 1 }
    });
    expect(countMines(res.mine)).toBe(60);
    expect(res.repairs).toBe(0);
    expect(typeof res.noGuess).toBe("boolean");
  });

  it("高密度也扛得住：园丁杯那种 30×16 / 110 一样能生成无猜图", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const res = generateNoGuess(30, 16, 110, indexOf(30, 15, 8), seed);
      expect(res.noGuess).toBe(true);
      expect(countMines(res.mine)).toBe(110);
    }
  });
});
