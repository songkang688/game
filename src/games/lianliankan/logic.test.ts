// 1.2 第 21 步 A 档：连线状态机 / 洗牌公平 / 四种收拢 / 提示经济 / 无尽连到底
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  SHUFFLE_TRIES,
  anyMove,
  applyGravity,
  constructSolvable,
  createBoard,
  fairShuffle,
  findPath,
  removePair,
  tilesLeft,
  type BoardSpec,
  type BoardState,
  type Pt
} from "./board";
import { LEVELS, boardSeed, turnsOf, type Gravity } from "./levels";
import {
  CLEAR_MS,
  COLLAPSE_MAX_MS,
  COLLAPSE_STEP_MS,
  ENDLESS_FREE_ROUNDS,
  HINT_MAX,
  Janitor,
  LINK_HOLD_MS,
  MIN_CELL_PX,
  SHAKE_MS,
  SHAPE_INDEX,
  TILE_FAMILY,
  beginCollapse,
  boardCleared,
  cellSizePx,
  clearMs,
  collapseMs,
  endlessInit,
  endlessKinds,
  endlessNext,
  endlessPair,
  endlessSeconds,
  endlessSpec,
  endlessStepWord,
  endlessTimeUp,
  endlessWord,
  familyOf,
  fitsPhone,
  gridTemplate,
  hintPair,
  hintsLeft,
  linkHoldMs,
  linkInit,
  pathIsOrthogonal,
  settle,
  shapeOf,
  starsFor,
  tapCell,
  timeUpWord,
  turnCount,
  winWord,
  type LinkState,
  type TimerHost
} from "./logic";

/** 搭一个只有指定格子有人的空盘，方便手摆局面 */
function blank(rows: number, cols: number): BoardState {
  const b = createBoard({ rows, cols, kinds: 1, gravity: "none", maxTurns: 2 }, mulberry32(1));
  for (let r = 0; r < b.R; r++) for (let c = 0; c < b.C; c++) b.grid[r][c] = -1;
  return b;
}

function specOf(level: number): BoardSpec {
  const cfg = LEVELS[level];
  return { rows: cfg.rows, cols: cfg.cols, kinds: cfg.kinds, gravity: cfg.gravity, maxTurns: turnsOf(cfg) };
}

// ---------------------------------------------------------------------------
// 一、连线状态机：禁止「点两下直接不见」
// ---------------------------------------------------------------------------

describe("连连看 · 连线状态机", () => {
  function twoTiles(): BoardState {
    const b = blank(3, 3);
    b.grid[1][1] = 0;
    b.grid[1][3] = 0;
    return b;
  }

  it("消除必须走「选中 → 画线 → 缩掉 → 收拢 → 待命」，中间少一相位都不行", () => {
    const b = twoTiles();
    let st: LinkState = linkInit();
    expect(st.phase).toBe("idle");
    const first = tapCell(b, st, 1, 1);
    expect(first.kind).toBe("select");
    st = first.state;
    expect(st.phase).toBe("picked");
    const second = tapCell(b, st, 1, 3);
    expect(second.kind).toBe("link");
    st = second.state;
    // 关键：这里还没有消失，先停在 linking 把折线画出来
    expect(st.phase).toBe("linking");
    expect(st.path).not.toBeNull();
    expect(b.grid[1][1]).toBe(0);
    st = beginCollapse();
    expect(st.phase).toBe("collapsing");
    st = settle();
    expect(st).toEqual(linkInit());
  });

  it("折线撑 180–260ms，关掉动效也照走同一套状态机，只是折线只闪一帧", () => {
    expect(LINK_HOLD_MS).toBeGreaterThanOrEqual(180);
    expect(LINK_HOLD_MS).toBeLessThanOrEqual(260);
    expect(linkHoldMs(false)).toBe(LINK_HOLD_MS);
    expect(linkHoldMs(true)).toBeLessThanOrEqual(20);
    expect(linkHoldMs(true)).toBeGreaterThan(0);
    expect(clearMs(false)).toBe(CLEAR_MS);
    expect(clearMs(true)).toBe(1);
  });

  it("画线 / 收拢的时候点谁都不理，等动画放完再说", () => {
    const b = twoTiles();
    const busy: LinkState = { phase: "linking", first: [1, 1], path: [[1, 1], [1, 3]] };
    expect(tapCell(b, busy, 1, 3).kind).toBe("ignore");
    expect(tapCell(b, { phase: "collapsing", first: null, path: null }, 1, 1).kind).toBe("ignore");
  });

  it("连错只抖 120ms 并把选中挪到新的一块，什么都不扣", () => {
    const b = blank(3, 5);
    b.grid[1][1] = 0;
    b.grid[1][5] = 0;
    for (let c = 2; c <= 4; c++) b.grid[1][c] = 1;
    for (let c = 1; c <= 5; c++) b.grid[2][c] = 2;
    for (let c = 1; c <= 5; c++) b.grid[3][c] = 3;
    const picked = tapCell(b, linkInit(), 1, 1).state;
    const bad = tapCell(b, picked, 1, 5, { maxTurns: 1 });
    expect(bad.kind).toBe("reject");
    expect(bad.state.phase).toBe("picked");
    expect(bad.state.first).toEqual([1, 5]);
    expect(bad.reason).toContain("拐一次");
    expect(bad.reason).not.toMatch(/笨|错了|不行你/);
    expect(SHAKE_MS).toBe(120);
  });

  it("点同一块取消选中，点不同图案就换选中，都不算失误", () => {
    const b = twoTiles();
    b.grid[2][2] = 1;
    const picked = tapCell(b, linkInit(), 1, 1).state;
    expect(tapCell(b, picked, 1, 1).kind).toBe("deselect");
    const sw = tapCell(b, picked, 2, 2);
    expect(sw.kind).toBe("switch");
    expect(sw.state.first).toEqual([2, 2]);
    expect(tapCell(b, linkInit(), 2, 3).kind).toBe("ignore");
  });

  it("戴面具的第一下只翻面，不参与配对", () => {
    const b = twoTiles();
    const out = tapCell(b, linkInit(), 1, 1, { hidden: true });
    expect(out.kind).toBe("reveal");
    expect(out.state.first).toEqual([1, 1]);
  });

  it("折线拐点算得准，而且每一段都横平竖直", () => {
    const b = twoTiles();
    const straight = findPath(b, [1, 1], [1, 3], 2) as Pt[];
    expect(turnCount(straight)).toBe(0);
    expect(pathIsOrthogonal(straight)).toBe(true);
    // 中间堵一个，就得绕外圈那一层空边，正好两个拐点
    b.grid[1][2] = 1;
    const around = findPath(b, [1, 1], [1, 3], 2) as Pt[];
    expect(around).not.toBeNull();
    expect(turnCount(around)).toBe(2);
    expect(pathIsOrthogonal(around)).toBe(true);
    expect(around[0]).toEqual([1, 1]);
    expect(around[around.length - 1]).toEqual([1, 3]);
    // 只准拐一次的时候就该老老实实说连不上
    expect(findPath(b, [1, 1], [1, 3], 1)).toBeNull();
  });

  it("经典的「绕最外圈」也算数：一整行堵死也能从棋盘外面那圈绕过去", () => {
    // 第 1 行被塞满，[1,1] 与 [1,4] 只剩「上去 → 横穿第 0 行 → 下来」这一条路
    const b = createBoard({ rows: 4, cols: 4, kinds: 8, gravity: "none", maxTurns: 2 }, mulberry32(2));
    b.grid[1][1] = 0;
    b.grid[1][4] = 0;
    b.grid[1][2] = 1;
    b.grid[1][3] = 1;
    const path = findPath(b, [1, 1], [1, 4], 2) as Pt[];
    expect(path).not.toBeNull();
    expect(turnCount(path)).toBe(2);
    expect(pathIsOrthogonal(path)).toBe(true);
    // 拐点必须落在棋盘外面那圈空边上
    expect(path[1][0]).toBe(0);
    expect(path[2][0]).toBe(0);
    for (let i = 1; i < path.length - 1; i++) expect(b.grid[path[i][0]][path[i][1]]).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// 二、洗牌公平
// ---------------------------------------------------------------------------

describe("连连看 · 洗牌公平", () => {
  it("洗完一定还有得连，图案一个不多一个不少", () => {
    for (let seed = 0; seed < 30; seed++) {
      const b = createBoard({ rows: 6, cols: 6, kinds: 9, gravity: "none", maxTurns: 1 }, mulberry32(seed));
      const before = tilesLeft(b);
      const count = new Map<number, number>();
      for (let r = 0; r < b.R; r++) for (let c = 0; c < b.C; c++) if (b.grid[r][c] >= 0) count.set(b.grid[r][c], (count.get(b.grid[r][c]) ?? 0) + 1);
      const rep = fairShuffle(b, mulberry32(seed + 500), 1);
      expect(rep.ok).toBe(true);
      expect(rep.tries).toBeGreaterThanOrEqual(1);
      expect(rep.tries).toBeLessThanOrEqual(SHUFFLE_TRIES);
      expect(tilesLeft(b)).toBe(before);
      expect(anyMove(b, 1)).not.toBeNull();
      const after = new Map<number, number>();
      for (let r = 0; r < b.R; r++) for (let c = 0; c < b.C; c++) if (b.grid[r][c] >= 0) after.set(b.grid[r][c], (after.get(b.grid[r][c]) ?? 0) + 1);
      expect([...after.entries()].sort()).toEqual([...count.entries()].sort());
    }
  });

  it("洗牌上限是 50 次，超了就改用构造式重排（不靠运气）", () => {
    expect(SHUFFLE_TRIES).toBe(50);
    const b = createBoard({ rows: 6, cols: 6, kinds: 9, gravity: "none", maxTurns: 2 }, mulberry32(9));
    // tries=0 逼它一次随机都不洗，直接走构造式那条路
    const rep = fairShuffle(b, mulberry32(3), 2, 0);
    expect(rep.constructed).toBe(true);
    expect(rep.ok).toBe(true);
    expect(anyMove(b, 2)).not.toBeNull();
  });

  it("构造式重排：连「只准直连」的苛刻盘面也能摆出至少一对", () => {
    for (let seed = 0; seed < 15; seed++) {
      const b = createBoard({ rows: 6, cols: 6, kinds: 9, gravity: "none", maxTurns: 0 }, mulberry32(seed));
      expect(constructSolvable(b, mulberry32(seed + 3), 0)).toBe(true);
      expect(anyMove(b, 0)).not.toBeNull();
      expect(tilesLeft(b)).toBe(36);
    }
  });

  it("空盘洗牌也不炸，直接算通过", () => {
    const b = blank(4, 4);
    const rep = fairShuffle(b, mulberry32(1), 2);
    expect(rep).toEqual({ ok: true, tries: 0, constructed: false });
    expect(boardCleared(b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 三、四种收拢
// ---------------------------------------------------------------------------

describe("连连看 · 四种收拢", () => {
  function rowBoard(): BoardState {
    // 一行 6 格，只留第 2、4、6 列
    const b = blank(1, 6);
    b.grid[1][2] = 7;
    b.grid[1][4] = 8;
    b.grid[1][6] = 9;
    return b;
  }

  it("不动：一个都不搬", () => {
    const b = rowBoard();
    expect(applyGravity(b, "none")).toEqual([]);
    expect(b.grid[1].slice(1, 7)).toEqual([-1, 7, -1, 8, -1, 9]);
  });

  it("向左：全部挤到最左边，顺序不变", () => {
    const b = rowBoard();
    const moves = applyGravity(b, "left");
    expect(b.grid[1].slice(1, 7)).toEqual([7, 8, 9, -1, -1, -1]);
    expect(moves.map((m) => [m.from[1], m.to[1]])).toEqual([[2, 1], [4, 2], [6, 3]]);
  });

  it("向中间：挤成一段摆在正中央（多的一格靠左）", () => {
    const b = rowBoard();
    applyGravity(b, "center");
    expect(b.grid[1].slice(1, 7)).toEqual([-1, 7, 8, 9, -1, -1]);
    const four = blank(1, 6);
    four.grid[1][1] = 1;
    four.grid[1][3] = 2;
    four.grid[1][5] = 3;
    four.grid[1][6] = 4;
    applyGravity(four, "center");
    expect(four.grid[1].slice(1, 7)).toEqual([-1, 1, 2, 3, 4, -1]);
  });

  it("向下：整列沉底，搬家清单能拿去做滑动动画", () => {
    const b = blank(4, 1);
    b.grid[1][1] = 5;
    b.grid[3][1] = 6;
    const moves = applyGravity(b, "down");
    // 上下顺序不会被打乱：本来在上面的 5 还是压在 6 上面
    expect([b.grid[1][1], b.grid[2][1], b.grid[3][1], b.grid[4][1]]).toEqual([-1, -1, 5, 6]);
    expect(moves).toEqual([
      { from: [3, 1], to: [4, 1] },
      { from: [1, 1], to: [3, 1] }
    ]);
  });

  it("四种收拢都不会凭空多出或弄丢图案", () => {
    for (const dir of ["none", "down", "center", "left"] as Gravity[]) {
      const b = createBoard({ rows: 4, cols: 6, kinds: 6, gravity: dir, maxTurns: 2 }, mulberry32(11));
      removePair(b, [2, 2], [3, 5]);
      const before = tilesLeft(b);
      applyGravity(b, dir);
      expect(tilesLeft(b)).toBe(before);
    }
  });

  it("每挪一格 60–80ms，挪得再远也有封顶；关掉动效就是 0", () => {
    expect(COLLAPSE_STEP_MS).toBeGreaterThanOrEqual(60);
    expect(COLLAPSE_STEP_MS).toBeLessThanOrEqual(80);
    expect(collapseMs(0)).toBe(0);
    expect(collapseMs(3)).toBe(COLLAPSE_STEP_MS * 3);
    expect(collapseMs(99)).toBe(COLLAPSE_MAX_MS);
    expect(collapseMs(3, true)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 四、提示经济
// ---------------------------------------------------------------------------

describe("连连看 · 提示经济", () => {
  it("提示走的是真求解：给出来的一对必须真能连上", () => {
    for (let seed = 0; seed < 20; seed++) {
      const b = createBoard({ rows: 6, cols: 6, kinds: 9, gravity: "none", maxTurns: 2 }, mulberry32(seed));
      const pair = hintPair(b, 2);
      expect(pair).not.toBeNull();
      const [a, z] = pair as [Pt, Pt];
      expect(b.grid[a[0]][a[1]]).toBe(b.grid[z[0]][z[1]]);
      expect(findPath(b, a, z, 2)).not.toBeNull();
    }
  });

  it("死局时提示诚实地说「没有」，不会瞎高亮", () => {
    const b = blank(3, 3);
    b.grid[1][1] = 0;
    b.grid[3][3] = 1;
    expect(hintPair(b, 2)).toBeNull();
  });

  it("每关 3 次提示，用完就没了", () => {
    expect(HINT_MAX).toBe(3);
    expect(hintsLeft(0)).toBe(3);
    expect(hintsLeft(3)).toBe(0);
    expect(hintsLeft(9)).toBe(0);
  });

  it("用过提示就封顶两星，一次没用才拿得到三星", () => {
    expect(starsFor(100, 100, 0)).toBe(3);
    expect(starsFor(100, 100, 1)).toBe(2);
    expect(starsFor(20, 100, 0)).toBe(2);
    expect(starsFor(20, 100, 2)).toBe(2);
    expect(starsFor(5, 100, 0)).toBe(1);
    expect(starsFor(5, 100, 3)).toBe(1);
    expect(starsFor(1, 0, 0)).toBe(3);
  });

  it("收场词只鼓励：用了提示也照样夸，时间到只给方法", () => {
    expect(winWord(30, 0)).toContain("一次提示都没用");
    expect(winWord(30, 2)).toContain("2 次提示");
    for (const w of [winWord(30, 0), winWord(30, 2), timeUpWord()]) {
      expect(w).not.toMatch(/笨|差劲|失败|不行/);
    }
  });
});

// ---------------------------------------------------------------------------
// 五、色觉友好与 360px
// ---------------------------------------------------------------------------

describe("连连看 · 看得清、点得着", () => {
  it("同一色系里的图案，形状一定各不相同", () => {
    for (let i = 0; i < TILE_FAMILY.length; i++) {
      for (let j = i + 1; j < TILE_FAMILY.length; j++) {
        if (familyOf(i) !== familyOf(j)) continue;
        expect(shapeOf(i), `第 ${i} 号与第 ${j} 号同是「${familyOf(i)}」却撞了形状`).not.toBe(shapeOf(j));
      }
    }
    expect(new Set(SHAPE_INDEX).size).toBeGreaterThanOrEqual(2);
    expect(shapeOf(-1)).toBe(shapeOf(TILE_FAMILY.length - 1));
  });

  it("188 关每一关在 360px 上都塞得下，且每格不小于 32px", () => {
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const cols = LEVELS[lv].cols;
      expect(fitsPhone(cols), `第 ${lv + 1} 关 ${cols} 列在 360px 上格子太小`).toBe(true);
      expect(cellSizePx(cols)).toBeGreaterThanOrEqual(MIN_CELL_PX);
    }
    // 空边只占 0.45 格，所以模板是「窄 - 真格子 - 窄」
    expect(gridTemplate(6)).toBe("0.45fr repeat(6, 1fr) 0.45fr");
  });
});

// ---------------------------------------------------------------------------
// 六、无尽「连到底」
// ---------------------------------------------------------------------------

describe("连连看 · 无尽连到底", () => {
  it("每 3 盘加一档难度：图案 +1，到点了还会开始计时", () => {
    expect(endlessKinds(1)).toBe(6);
    expect(endlessKinds(3)).toBe(6);
    expect(endlessKinds(4)).toBe(7);
    expect(endlessKinds(999)).toBe(14);
    expect(endlessSeconds(ENDLESS_FREE_ROUNDS)).toBe(0);
    expect(endlessSeconds(ENDLESS_FREE_ROUNDS + 1)).toBeGreaterThan(0);
    expect(endlessSeconds(999)).toBe(45);
    // 越往后越花，但盘子始终是手机装得下的 6×6
    expect(endlessSpec(1).gravity).toBe("none");
    expect(endlessSpec(20).maxTurns).toBe(1);
    for (const r of [1, 5, 12, 40]) {
      expect(endlessSpec(r).rows).toBe(6);
      expect(fitsPhone(endlessSpec(r).cols)).toBe(true);
    }
  });

  it("清完一盘自动补新盘，对数只累加不清零", () => {
    let st = endlessInit();
    expect(st).toEqual({ round: 1, pairs: 0, roundPairs: 0, over: false });
    for (let i = 0; i < 18; i++) st = endlessPair(st);
    expect(st.pairs).toBe(18);
    expect(st.roundPairs).toBe(18);
    st = endlessNext(st);
    expect(st.round).toBe(2);
    expect(st.pairs).toBe(18);
    expect(st.roundPairs).toBe(0);
    st = endlessPair(st);
    expect(st.pairs).toBe(19);
    // 收工之后再怎么点都不再变
    st = endlessTimeUp(st);
    expect(st.over).toBe(true);
    expect(endlessPair(st)).toBe(st);
    expect(endlessNext(st)).toBe(st);
    expect(endlessTimeUp(st)).toBe(st);
  });

  it("每盘开头那句人话说得出难度变在哪，收场词只鼓励", () => {
    expect(endlessStepWord(1)).toContain("热热身");
    expect(endlessStepWord(4)).toMatch(/图案|秒/);
    expect(endlessStepWord(13)).toContain("拐一次");
    const st = { round: 5, pairs: 60, roundPairs: 2, over: true };
    expect(endlessWord(st, 10)).toContain("新纪录");
    expect(endlessWord(st, 900)).not.toMatch(/笨|差劲|失败/);
  });

  it("无尽前几盘真的连得完：自动玩家把 6 盘挨个清干净", () => {
    for (let round = 1; round <= 6; round++) {
      const spec = endlessSpec(round);
      const b = createBoard(spec, mulberry32(round * 977));
      let guard = 0;
      while (!boardCleared(b) && guard < 400) {
        guard++;
        const pair = anyMove(b, spec.maxTurns);
        if (!pair) {
          expect(fairShuffle(b, mulberry32(round * 31 + guard), spec.maxTurns).ok).toBe(true);
          continue;
        }
        removePair(b, pair[0], pair[1]);
        applyGravity(b, spec.gravity);
      }
      expect(boardCleared(b), `第 ${round} 盘没连完`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 七、188 抽样：新的「向中间」收拢没有把任何一关变成死局
// ---------------------------------------------------------------------------

describe("连连看 · 1.2 收拢改动后的抽样回归", () => {
  it("伪装迷影阁后半段的「向中间」关卡，自动玩家照样全清", () => {
    const centers = LEVELS.map((lv, i) => [lv, i] as const).filter(([lv]) => lv.gravity === "center");
    expect(centers.length).toBeGreaterThan(0);
    for (const [cfg, lv] of centers) {
      const spec = specOf(lv);
      const b = createBoard(spec, mulberry32(boardSeed(lv)));
      let guard = 0;
      while (!boardCleared(b) && guard < 600) {
        guard++;
        const pair = anyMove(b, spec.maxTurns);
        if (!pair) {
          expect(fairShuffle(b, mulberry32(boardSeed(lv) + guard), spec.maxTurns).ok).toBe(true);
          continue;
        }
        removePair(b, pair[0], pair[1]);
        applyGravity(b, cfg.gravity);
      }
      expect(boardCleared(b), `第 ${lv + 1} 关没连完`).toBe(true);
    }
  }, 30000);
});

// ---------------------------------------------------------------------------
// 八、destroy 归零
// ---------------------------------------------------------------------------

describe("连连看 · 资源看管", () => {
  function fakeHost(): TimerHost {
    let id = 1;
    const state = { timers: 0, tickers: 0 };
    return {
      setTimeout() {
        state.timers++;
        return id++;
      },
      clearTimeout() {
        state.timers--;
      },
      setInterval() {
        state.tickers++;
        return id++;
      },
      clearInterval() {
        state.tickers--;
      }
    };
  }

  it("倒计时 / 面具轮换 / 点击监听在 destroy 之后一件不剩", () => {
    const jan = new Janitor(fakeHost());
    const target = {
      list: [] as string[],
      addEventListener(t: string) {
        this.list.push(t);
      },
      removeEventListener(t: string) {
        this.list.splice(this.list.indexOf(t), 1);
      }
    };
    jan.after(200, () => undefined);
    jan.every(1000, () => undefined);
    jan.every(8000, () => undefined);
    jan.on(target, "click", () => undefined);
    jan.on(target, "keydown", () => undefined);
    expect(jan.pending()).toBe(5);
    expect(target.list).toHaveLength(2);
    jan.destroy();
    expect(jan.pending()).toBe(0);
    expect(target.list).toHaveLength(0);
    expect(jan.dead).toBe(true);
  });

  it("destroy 之后排队的回调不再跑，某个拆监听报错也不影响别的", () => {
    let fired = 0;
    let queued: (() => void) | null = null;
    let ticked = 0;
    let tick: (() => void) | null = null;
    const host: TimerHost = {
      setTimeout(fn) {
        queued = fn;
        return 1;
      },
      clearTimeout() {
        /* 故意不真的取消，模拟「已经排进队列」的回调 */
      },
      setInterval(fn) {
        tick = fn;
        return 2;
      },
      clearInterval() {
        /* 同上 */
      }
    };
    const jan = new Janitor(host);
    jan.after(0, () => fired++);
    jan.every(10, () => ticked++);
    let cleaned = 0;
    jan.own(() => {
      cleaned++;
      throw new Error("拆监听时出了点小状况");
    });
    jan.own(() => cleaned++);
    jan.destroy();
    (queued as unknown as () => void)?.();
    (tick as unknown as () => void)?.();
    expect(fired).toBe(0);
    expect(ticked).toBe(0);
    expect(cleaned).toBe(2);
    expect(jan.pending()).toBe(0);
  });
});
