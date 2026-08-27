/**
 * 连连看 · 窗口 4 档A · 第 2 轮测试员
 *
 * 换关换盘，重点查难度曲线、竞态、无尽能不能持续。
 *
 * 本轮记账在案的问题：
 *  - **W4A-08（次要偏中）**：无尽第 13 盘一次把四个难度旋钮全拧了
 *    （图案 9→10、拐弯 2→1、收拢 left→center、限时 72→66 秒），
 *    而屏幕上的 `endlessStepWord` 只报得出其中一条。
 *    连带后果：从第 13 盘起棋盘每盘要自动重排 4–7 次，
 *    第 16 盘（48 秒）实测要重排 6 次——孩子刚看熟的盘面被打散六回。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { anyMove, applyGravity, createBoard, findPath, removePair, solveBoard, tilesLeft } from "./board";
import { LEVELS } from "./levels";
import {
  ENDLESS_FREE_ROUNDS,
  MIN_CELL_PX,
  PHONE_BOARD_W,
  cellSizePx,
  collapseMs,
  endlessInit,
  endlessKinds,
  endlessNext,
  endlessPair,
  endlessSeconds,
  endlessSpec,
  endlessStepWord,
  endlessTimeUp,
  fitsPhone,
  hintBest,
  linkInit,
  tapCell,
  type LinkState
} from "./logic";

function specOf(lv: number) {
  const l = LEVELS[lv];
  return { rows: l.rows, cols: l.cols, kinds: l.kinds, gravity: l.gravity ?? "none", maxTurns: l.maxTurns ?? 2 };
}

/** 第 round 盘相对上一盘拧了几个旋钮 */
function knobsTurned(round: number): string[] {
  if (round <= 1) return [];
  const a = endlessSpec(round - 1);
  const b = endlessSpec(round);
  const out: string[] = [];
  if (b.kinds !== a.kinds) out.push("图案种类");
  if (b.maxTurns !== a.maxTurns) out.push("拐弯上限");
  if (b.gravity !== a.gravity) out.push("收拢方向");
  if (endlessSeconds(round) !== endlessSeconds(round - 1)) out.push("限时");
  return out;
}

describe("连连看 · R2 · 换关卡：第 40 / 88 / 143 / 176 关", () => {
  for (const lv of [39, 87, 142, 175]) {
    it(`第 ${lv + 1} 关：自动玩家从头连到清盘`, () => {
      const res = solveBoard(specOf(lv), mulberry32(4000 + lv), {
        shuffles: 3,
        autoShuffleFree: true,
        autoShuffleCap: 200
      });
      expect(res.cleared, `第 ${lv + 1} 关没清完，还剩 ${res.left} 格`).toBe(true);
      expect(res.moves).toBe((LEVELS[lv].rows * LEVELS[lv].cols) / 2);
    });
  }

  it("换四个种子重开第 143 关，次次清得完", () => {
    for (const seed of [5, 55, 555, 5555]) {
      const res = solveBoard(specOf(142), mulberry32(seed), { shuffles: 3, autoShuffleFree: true, autoShuffleCap: 200 });
      expect(res.cleared, `种子 ${seed}`).toBe(true);
    }
  });

  it("难度曲线：188 关里 126 关一次都不用重排，最多的一关也只要 6 次", () => {
    let worst = 0;
    let heavy = 0;
    let free = 0;
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const res = solveBoard(specOf(lv), mulberry32(7000 + lv), {
        shuffles: 3,
        autoShuffleFree: true,
        autoShuffleCap: 200
      });
      expect(res.cleared, `第 ${lv + 1} 关`).toBe(true);
      worst = Math.max(worst, res.shufflesUsed);
      if (res.shufflesUsed === 0) free++;
      if (res.shufflesUsed >= 5) heavy++;
    }
    expect(worst).toBeLessThanOrEqual(8);
    expect(free).toBeGreaterThanOrEqual(100);
    expect(heavy, "重排 5 次以上的关不该多").toBeLessThanOrEqual(8);
  });
});

describe("连连看 · R2 · 竞态：动画没放完就乱点", () => {
  function board() {
    const b = createBoard({ rows: 4, cols: 4, kinds: 4, gravity: "none", maxTurns: 2 }, mulberry32(9));
    return b;
  }

  it("连线动画（linking）里点任何格子都不理", () => {
    const b = board();
    const st: LinkState = { phase: "linking", first: [1, 1], path: [[1, 1], [1, 2]] };
    for (let r = 1; r <= 4; r++) {
      for (let c = 1; c <= 4; c++) {
        const out = tapCell(b, st, r, c);
        expect(out.kind, `(${r},${c})`).toBe("ignore");
        expect(out.state).toBe(st);
      }
    }
  });

  it("收拢动画（collapsing）里点任何格子也都不理", () => {
    const b = board();
    const st: LinkState = { phase: "collapsing", first: null, path: null };
    for (let r = 1; r <= 4; r++) {
      const out = tapCell(b, st, r, 1);
      expect(out.kind).toBe("ignore");
      expect(out.state).toBe(st);
    }
  });

  it("连着点同一格：第二下是取消选中，不会自己跟自己连", () => {
    const b = board();
    const first = tapCell(b, linkInit(), 1, 1);
    expect(first.kind).toBe("select");
    const second = tapCell(b, first.state, 1, 1);
    expect(second.kind).toBe("deselect");
    expect(second.state.first).toBeNull();
    expect(second.state.phase).toBe("idle");
  });

  it("点到已经被消掉的空格一律不理，不会留下一个指向空气的选中", () => {
    const b = board();
    const pair = anyMove(b, 2)!;
    removePair(b, pair[0], pair[1]);
    const out = tapCell(b, linkInit(), pair[0][0], pair[0][1]);
    expect(out.kind).toBe("ignore");
    expect(out.state.first).toBeNull();
  });

  it("消一对之后立刻再点，收拢已经把坐标搬走了——提示读的是搬完之后的盘", () => {
    const b = createBoard({ rows: 4, cols: 4, kinds: 4, gravity: "down", maxTurns: 2 }, mulberry32(21));
    const pair = anyMove(b, 2)!;
    removePair(b, pair[0], pair[1]);
    const moves = applyGravity(b, "down");
    for (const m of moves) {
      expect(b.grid[m.to[0]][m.to[1]]).toBeGreaterThanOrEqual(0);
    }
    const pick = hintBest(b, 2);
    if (pick) expect(findPath(b, pick.pair[0], pick.pair[1], 2)).not.toBeNull();
  });

  it("收拢动画时长有上限，大盘子不会滑到天荒地老", () => {
    expect(collapseMs(1)).toBeGreaterThan(0);
    expect(collapseMs(100)).toBeLessThanOrEqual(420);
    expect(collapseMs(100, true)).toBe(0);
    expect(collapseMs(-5)).toBe(0);
  });
});

describe("连连看 · R2 · W4A-08 无尽第 13 盘四个旋钮一起拧", () => {
  it("第 13 盘一次改了四样，而屏幕上只报得出一样", () => {
    const knobs = knobsTurned(13);
    expect(knobs).toEqual(["图案种类", "拐弯上限", "收拢方向", "限时"]);
    const word = endlessStepWord(13);
    expect(word).toContain("拐一次弯");
    // 另外三样一个字都没提
    expect(word).not.toContain("图案");
    expect(word).not.toContain("收拢");
    expect(word).not.toContain("秒");
  });

  it("同一盘拧三个以上旋钮的一共三盘：第 7 / 10 / 13，而每盘只报得出一条", () => {
    const heavy: number[] = [];
    for (let r = 2; r <= 60; r++) if (knobsTurned(r).length >= 3) heavy.push(r);
    expect(heavy).toEqual([7, 10, 13]);
    for (const r of heavy) {
      const word = endlessStepWord(r);
      // 一句话只能讲一件事，另外两三件孩子只能自己撞出来
      const mentions = ["图案", "收拢", "拐一次弯", "秒"].filter((k) => word.includes(k));
      expect(mentions.length, `第 ${r} 盘的提示语「${word}」`).toBeLessThanOrEqual(1);
      expect(knobsTurned(r).length).toBeGreaterThan(mentions.length);
    }
  });

  it("从第 13 盘起棋盘频繁走死，要靠自动重排救场", () => {
    const before: number[] = [];
    const after: number[] = [];
    for (let r = 7; r <= 12; r++) {
      before.push(solveBoard(endlessSpec(r), mulberry32(r * 1000 + 1), {
        shuffles: 3, autoShuffleFree: true, autoShuffleCap: 200
      }).shufflesUsed);
    }
    for (let r = 13; r <= 20; r++) {
      after.push(solveBoard(endlessSpec(r), mulberry32(r * 1000 + 1), {
        shuffles: 3, autoShuffleFree: true, autoShuffleCap: 200
      }).shufflesUsed);
    }
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(avg(after)).toBeGreaterThan(avg(before));
    expect(Math.max(...after)).toBeGreaterThanOrEqual(3);
  });

  it("走死也不会把孩子卡住：每一盘最终都清得完", () => {
    for (const r of [5, 13, 16, 20, 30]) {
      const res = solveBoard(endlessSpec(r), mulberry32(r * 977), {
        shuffles: 3, autoShuffleFree: true, autoShuffleCap: 200
      });
      expect(res.cleared, `第 ${r} 盘`).toBe(true);
      expect(res.moves).toBe(18);
    }
  });
});

describe("连连看 · R2 · 无尽能一直连下去", () => {
  it("难度爬到第 25 盘就封顶，之后一直是同一档——不会越来越离谱", () => {
    expect(endlessKinds(25)).toBe(14);
    expect(endlessKinds(999)).toBe(14);
    expect(endlessSeconds(17)).toBe(45);
    expect(endlessSeconds(999)).toBe(45);
    for (let r = 26; r <= 60; r++) expect(knobsTurned(r), `第 ${r} 盘`).toEqual([]);
  });

  it("前 3 盘不限时，第 4 盘才开始看表", () => {
    for (let r = 1; r <= ENDLESS_FREE_ROUNDS; r++) expect(endlessSeconds(r)).toBe(0);
    expect(endlessSeconds(ENDLESS_FREE_ROUNDS + 1)).toBeGreaterThan(0);
    expect(endlessStepWord(ENDLESS_FREE_ROUNDS + 1)).toContain("秒");
  });

  it("一路连 40 盘：对数一直在涨，盘号一直在涨，中途不会自己收工", () => {
    let st = endlessInit();
    for (let r = 1; r <= 40; r++) {
      for (let p = 0; p < 18; p++) st = endlessPair(st);
      expect(st.roundPairs).toBe(18);
      expect(st.over).toBe(false);
      st = endlessNext(st);
      expect(st.roundPairs).toBe(0);
    }
    expect(st.round).toBe(41);
    expect(st.pairs).toBe(40 * 18);
  });

  it("时间到才收工，收工之后再连也不加分了", () => {
    let st = endlessInit();
    st = endlessPair(st);
    st = endlessTimeUp(st);
    expect(st.over).toBe(true);
    expect(endlessPair(st)).toBe(st);
    expect(endlessNext(st)).toBe(st);
  });

  it("无尽盘是 6×6，360px 上一格 ≥ 32px", () => {
    const spec = endlessSpec(20);
    expect(spec.rows).toBe(6);
    expect(spec.cols).toBe(6);
    expect(fitsPhone(spec.cols)).toBe(true);
    expect(cellSizePx(spec.cols, PHONE_BOARD_W)).toBeGreaterThanOrEqual(MIN_CELL_PX);
  });
});

describe("连连看 · R2 · 360px 复核（换最宽的那几关）", () => {
  it("188 关里最宽的盘也塞得进 360px，每格都 ≥ 32px", () => {
    const widest = Math.max(...LEVELS.map((l) => l.cols));
    expect(fitsPhone(widest), `最宽 ${widest} 列塞不下`).toBe(true);
    for (const l of LEVELS) {
      expect(cellSizePx(l.cols), `${l.cols} 列`).toBeGreaterThanOrEqual(MIN_CELL_PX);
    }
  });

  it("最宽的那几关照样清得完（宽盘不等于死盘）", () => {
    const widest = Math.max(...LEVELS.map((l) => l.cols));
    const idx = LEVELS.map((l, i) => ({ l, i })).filter(({ l }) => l.cols === widest).slice(0, 4);
    for (const { i } of idx) {
      const res = solveBoard(specOf(i), mulberry32(8000 + i), { shuffles: 3, autoShuffleFree: true, autoShuffleCap: 200 });
      expect(res.cleared, `第 ${i + 1} 关`).toBe(true);
      expect(tilesLeft).toBeTypeOf("function");
    }
  });
});
