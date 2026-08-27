// 窗口 4 · QA 档C · 第 2 轮测试员:推箱小仓鼠。
//
// 第 2 轮剧本(样本全换):难度曲线 → 竞态(狂点方向键 / 撤销风暴 / 结算后重入)→
// 无尽持续 → 存档往返。
// 竞态那一段把 `index.ts` 的 `step / undo / reset / swapHamster` 一比一搬下来,
// 连 `finished` 这道闸和撤销栈的封顶都照抄。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, loadStars, mulberry32, saveStar, type StorageLike } from "../level99";
import { CHAPTERS, TOTAL, buildEndless, chapterIndexOf, getLevel, starsForMoves } from "./levels";
import {
  ALL_DIRS,
  initialState,
  isSolved,
  remainingBoxes,
  tryMove,
  type Dir,
  type State,
} from "./logic";
import { solve, verifySolution } from "./solver";
import {
  UNDO_CAP,
  canUndo,
  canUseHint,
  hintsLeft,
  newUndoStack,
  pushFrame,
  resetStack,
  starsWithAssist,
  undoFrame,
} from "./assist";

/* ------------------------------------------------------------------ */
/* 把 index.ts 的一局搬下来                                            */
/* ------------------------------------------------------------------ */

class Board {
  def = getLevel(0);
  state: State;
  stack = newUndoStack();
  moves = 0;
  undos = 0;
  hintsUsed = 0;
  active = 0;
  finished = false;
  /** 每一次输入的去向,用来看狂点有没有被重复吃掉 */
  log: string[] = [];

  constructor(level: number) {
    this.def = getLevel(level);
    this.state = initialState(this.def);
  }

  step(dir: Dir): void {
    if (this.finished) {
      this.log.push("blocked");
      return;
    }
    const out = tryMove(this.def, this.state, this.active, dir);
    if (!out) {
      this.log.push("bump");
      return;
    }
    pushFrame(this.stack, this.state);
    this.state = out.state;
    this.moves++;
    this.log.push(out.pushed ? "push" : "walk");
    if (isSolved(this.def, this.state)) this.finished = true;
  }

  undo(): void {
    if (this.finished || !canUndo(this.stack)) {
      this.log.push("no-undo");
      return;
    }
    const prev = undoFrame(this.stack);
    if (!prev) {
      this.log.push("no-undo");
      return;
    }
    this.state = prev;
    this.moves = Math.max(0, this.moves - 1);
    this.undos++;
    this.log.push("undo");
  }

  reset(): void {
    this.state = initialState(this.def);
    resetStack(this.stack);
    this.moves = 0;
    this.active = 0;
    this.finished = false;
    this.log.push("reset");
  }

  swap(): void {
    if (this.state.hamsters.length < 2) return;
    this.active = (this.active + 1) % this.state.hamsters.length;
    this.log.push("swap");
  }

  snapshot(): string {
    return JSON.stringify([this.state.boxes, this.state.hamsters, this.moves, this.active, this.finished]);
  }
}

/** 用求解器出解,再逐步回放,返回打完之后的这一局 */
function playToWin(level: number): Board {
  const b = new Board(level);
  const sol = solve({ ...b.def, boxes: b.state.boxes.slice(), hamsters: b.state.hamsters.slice() });
  expect(sol.moves, `第 ${level + 1} 关求解器出不了解`).not.toBeNull();
  for (const m of sol.moves ?? []) b.step(m.dir);
  return b;
}

/** 第 2 轮换的样本:和第 1 轮的 1 / 100 / 188 一关不重 */
const SAMPLE = [5, 19, 37, 58, 74, 96, 118, 141, 163, 175];

/* ------------------------------------------------------------------ */
/* 一、难度曲线                                                        */
/* ------------------------------------------------------------------ */

describe("档C R2 · box-hamster · 难度曲线", () => {
  it("一章比一章要多推几步:三星步数上限逐章往上", () => {
    const perCh = CHAPTERS.map((_, ci) => {
      const rows: number[] = [];
      for (let i = 0; i < TOTAL; i++) {
        if (chapterIndexOf(i) === ci) rows.push(getLevel(i).bestMoves);
      }
      return rows.reduce((a, b) => a + b, 0) / Math.max(1, rows.length);
    });
    expect(perCh[0]).toBeLessThan(perCh[perCh.length - 1]);
    // 允许小起伏,但不许某一章突然比前一章轻松一半
    for (let i = 1; i < perCh.length; i++) {
      expect(perCh[i], `第 ${i + 1} 章比上一章轻松一半`).toBeGreaterThan(perCh[i - 1] * 0.5);
    }
  });

  it("换一批样本关:第 6 / 20 / 38 …… 共 10 关都解得开,而且解真的能走通", () => {
    for (const i of SAMPLE) {
      const def = getLevel(i);
      const sol = solve({ ...def, boxes: def.boxes.slice(), hamsters: def.hamsters.slice() });
      expect(sol.moves, `第 ${i + 1} 关无解`).not.toBeNull();
      expect(verifySolution(def, sol.moves ?? []), `第 ${i + 1} 关的解走不通`).toBe(true);
    }
  });

  it("官方标的 bestMoves 不比求解器的最优解更省 —— 三星门槛不是空头支票", () => {
    for (const i of SAMPLE) {
      const def = getLevel(i);
      const sol = solve({ ...def, boxes: def.boxes.slice(), hamsters: def.hamsters.slice() });
      const best = (sol.moves ?? []).length;
      expect(def.bestMoves, `第 ${i + 1} 关标了 ${def.bestMoves} 步,最优解要 ${best} 步`).toBeGreaterThanOrEqual(
        best
      );
    }
  });

  it("评星门槛一路单调:步数越多星越少,而且用了提示最多两星", () => {
    for (const i of SAMPLE) {
      const def = getLevel(i);
      let prev: number = 4;
      for (let m = def.bestMoves; m <= def.bestMoves * 3 + 20; m += 3) {
        const s = starsForMoves(def, m);
        expect(s, `第 ${i + 1} 关走 ${m} 步反而更多星`).toBeLessThanOrEqual(prev);
        prev = s;
      }
      expect(starsWithAssist(def, def.bestMoves, 1)).toBeLessThanOrEqual(2);
      expect(starsWithAssist(def, def.bestMoves, 0)).toBe(3);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 二、竞态                                                            */
/* ------------------------------------------------------------------ */

describe("档C R2 · box-hamster · 竞态", () => {
  it("对着墙狂按方向键 200 下:步数一步不涨,局面一格不动", () => {
    const b = new Board(SAMPLE[0]);
    const before = b.snapshot();
    let bumps = 0;
    for (let k = 0; k < 200; k++) {
      for (const dir of ALL_DIRS) {
        if (tryMove(b.def, b.state, b.active, dir)) continue;
        b.step(dir);
        bumps++;
      }
    }
    expect(bumps).toBeGreaterThan(0);
    expect(b.moves).toBe(0);
    expect(b.snapshot()).toBe(before);
    expect(b.log.every((x) => x === "bump")).toBe(true);
  });

  it("走一步撤一步,来回 300 次,局面一定回到原点", () => {
    const b = new Board(SAMPLE[3]);
    const start = b.snapshot();
    const dir = ALL_DIRS.find((d) => tryMove(b.def, b.state, 0, d));
    expect(dir).toBeDefined();
    if (!dir) return;
    for (let k = 0; k < 300; k++) {
      b.step(dir);
      b.undo();
      expect(b.snapshot(), `第 ${k + 1} 个来回之后局面漂了`).toBe(start);
    }
    expect(b.moves).toBe(0);
    expect(b.undos).toBe(300);
  });

  it("撤销风暴:空栈狂点撤销 500 下,不会撤出负步数,也不会崩", () => {
    const b = new Board(SAMPLE[1]);
    for (let k = 0; k < 500; k++) b.undo();
    expect(b.moves).toBe(0);
    expect(b.undos).toBe(0);
    expect(b.log.every((x) => x === "no-undo")).toBe(true);
    expect(remainingBoxes(b.def, b.state)).toBe(remainingBoxes(b.def, initialState(b.def)));
  });

  it("撤销栈有封顶,连走几千步也不会把内存吃光", () => {
    const stack = newUndoStack();
    const def = getLevel(SAMPLE[2]);
    const st = initialState(def);
    for (let k = 0; k < UNDO_CAP * 3; k++) pushFrame(stack, st);
    expect(stack.frames.length).toBeLessThanOrEqual(UNDO_CAP);
    // 封顶之后还撤得动,只是撤不回最开头
    let n = 0;
    while (canUndo(stack)) {
      undoFrame(stack);
      n++;
      if (n > UNDO_CAP * 4) break;
    }
    expect(n).toBeLessThanOrEqual(UNDO_CAP);
  });

  it("赢了之后再怎么按方向键、按撤销,局面都不动了", () => {
    const b = playToWin(SAMPLE[4]);
    expect(b.finished).toBe(true);
    expect(isSolved(b.def, b.state)).toBe(true);
    const after = b.snapshot();
    for (let k = 0; k < 100; k++) {
      for (const dir of ALL_DIRS) b.step(dir);
      b.undo();
    }
    expect(b.snapshot()).toBe(after);
    expect(b.log.filter((x) => x === "blocked").length).toBeGreaterThan(0);
  });

  it("走到一半点重来:步数、撤销栈、当前仓鼠全部归零,不留半套状态", () => {
    const b = new Board(SAMPLE[6]);
    const start = b.snapshot();
    const sol = solve({ ...b.def, boxes: b.state.boxes.slice(), hamsters: b.state.hamsters.slice() });
    for (const m of (sol.moves ?? []).slice(0, 6)) b.step(m.dir);
    expect(b.moves).toBeGreaterThan(0);
    b.reset();
    expect(b.snapshot()).toBe(start);
    expect(canUndo(b.stack)).toBe(false);
    expect(b.moves).toBe(0);
    expect(b.active).toBe(0);
  });

  it("双鼠关狂按换人 999 下:只在两只之间转,不会转出第三只", () => {
    const twin = SAMPLE.map(getLevel).find((d) => d.hamsters.length >= 2) ?? getLevel(140);
    const b = new Board(twin.index ?? 140);
    if (b.state.hamsters.length < 2) return;
    const seen = new Set<number>();
    for (let k = 0; k < 999; k++) {
      b.swap();
      seen.add(b.active);
      expect(b.active).toBeLessThan(b.state.hamsters.length);
    }
    expect(seen.size).toBe(b.state.hamsters.length);
  });

  it("提示每关只给一次,狂点提示按钮也只扣一次星", () => {
    const def = getLevel(SAMPLE[7]);
    expect(canUseHint(0)).toBe(true);
    expect(hintsLeft(0)).toBe(1);
    for (let used = 1; used <= 20; used++) {
      expect(canUseHint(used), `已经用了 ${used} 次还能再点`).toBe(false);
      expect(hintsLeft(used)).toBe(0);
      expect(starsWithAssist(def, def.bestMoves, used)).toBeLessThanOrEqual(2);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 三、无尽持续                                                        */
/* ------------------------------------------------------------------ */

describe("档C R2 · box-hamster · 无尽连打 60 仓", () => {
  it("每一仓都生得出、解得开,而且解真的能走通", () => {
    for (let r = 0; r < 60; r++) {
      const def = buildEndless(r);
      expect(def.hamsters, `第 ${r + 1} 仓不是单鼠`).toHaveLength(1);
      expect(def.boxes.length, `第 ${r + 1} 仓一个箱子都没有`).toBeGreaterThan(0);
      expect(def.boxes.length, `第 ${r + 1} 仓箱子和洞对不上`).toBe(
        def.target.filter(Boolean).length
      );
      const sol = solve({ ...def, boxes: def.boxes.slice(), hamsters: def.hamsters.slice() });
      expect(sol.moves, `第 ${r + 1} 仓无解`).not.toBeNull();
      expect(verifySolution(def, sol.moves ?? []), `第 ${r + 1} 仓的解走不通`).toBe(true);
    }
  });

  it("连打 60 仓,难度只涨不掉头(箱子数不减、棋盘不缩)", () => {
    let boxes = 0;
    let area = 0;
    for (let r = 0; r < 60; r++) {
      const def = buildEndless(r);
      expect(def.boxes.length, `第 ${r + 1} 仓的箱子比前面少了`).toBeGreaterThanOrEqual(boxes);
      expect(def.w * def.h, `第 ${r + 1} 仓的仓库缩水了`).toBeGreaterThanOrEqual(area);
      boxes = def.boxes.length;
      area = def.w * def.h;
    }
  });

  it("连打 60 仓,窄屏预算一仓都不超", () => {
    for (let r = 0; r < 60; r++) {
      expect(buildEndless(r).w, `第 ${r + 1} 仓太宽`).toBeLessThanOrEqual(13);
    }
  });

  it("同一仓号生两次,长得一模一样 —— 无尽是可复现的", () => {
    for (const r of [0, 7, 23, 44, 59]) {
      expect(JSON.stringify(buildEndless(r))).toBe(JSON.stringify(buildEndless(r)));
    }
  });
});

/* ------------------------------------------------------------------ */
/* 四、存档往返                                                        */
/* ------------------------------------------------------------------ */

function memStore(): StorageLike & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    keys: () => [...map.keys()],
    dump: () => Object.fromEntries(map),
  };
}

describe("档C R2 · box-hamster · 存档往返", () => {
  const ID = "box-hamster";

  it("打完一关存星,关掉再开还在", () => {
    const st = memStore();
    const b = playToWin(SAMPLE[0]);
    const stars = starsWithAssist(b.def, b.moves, b.hintsUsed);
    saveStar(ID, SAMPLE[0], stars as 1 | 2 | 3, st);
    const reopened = memStore();
    for (const [k, v] of Object.entries(st.dump())) reopened.setItem(k, v);
    expect(loadStars(ID, reopened)[SAMPLE[0]]).toBe(stars);
  });

  it("同一关反复打,只留最好那一次", () => {
    const st = memStore();
    saveStar(ID, 74, 2, st);
    saveStar(ID, 74, 3, st);
    saveStar(ID, 74, 1, st);
    expect(loadStars(ID, st)[74]).toBe(3);
  });

  it("188 关全写满,读回来一关不差", () => {
    const st = memStore();
    const rand = mulberry32(777);
    const want = Array.from({ length: TOTAL_LEVELS }, () => (1 + Math.floor(rand() * 3)) as 1 | 2 | 3);
    want.forEach((s, i) => saveStar(ID, i, s, st));
    expect(loadStars(ID, st)).toEqual(want);
  });

  it("存档写坏了也只是从头再来,不会把整个游戏拖崩", () => {
    const st = memStore();
    saveStar(ID, 3, 3, st);
    const key = `yiduo-yixing.l99.${ID}`;
    for (const junk of ["", "}{", "undefined", "[999,-5,3]", '{"stars":"x"}']) {
      st.setItem(key, junk);
      const back = loadStars(ID, st);
      expect(back).toHaveLength(TOTAL_LEVELS);
      expect(back.every((v) => Number.isInteger(v) && v >= 0 && v <= 3), `${junk} 之后星数越界`).toBe(true);
    }
  });

  it("存档 key 还是老那一个,一个字都没改", () => {
    const st = memStore();
    saveStar(ID, 0, 1, st);
    expect(st.keys!()).toEqual([`yiduo-yixing.l99.${ID}`]);
  });
});
