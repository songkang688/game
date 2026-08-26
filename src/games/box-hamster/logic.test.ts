import { describe, expect, it } from "vitest";
import {
  ALL_DIRS,
  cellAt,
  emptyBoard,
  hasDeadBox,
  hasIce,
  hasPortal,
  initialState,
  isDeadCorner,
  isPlainRules,
  isSolved,
  land,
  parsePuzzle,
  pathTo,
  reachable,
  remainingBoxes,
  stateKey,
  stepCell,
  toAscii,
  tryMove,
  type Dir,
  type Puzzle,
  type State,
} from "./logic";

/** 依次走一串方向,断言每一步都走得动 */
function walk(p: Puzzle, dirs: Dir[], who = 0): State {
  let state = initialState(p);
  dirs.forEach((dir, i) => {
    const out = tryMove(p, state, who, dir);
    expect(out, `第 ${i + 1} 步(往${dir})应该走得动`).not.toBeNull();
    state = out!.state;
  });
  return state;
}

const UP: Dir = 0;
const RIGHT: Dir = 1;
const DOWN: Dir = 2;
const LEFT: Dir = 3;

describe("棋盘与字符画", () => {
  it("空棋盘四周是墙、中间是空地", () => {
    const b = emptyBoard(5, 4);
    expect(b.wall[cellAt(b, 0, 0)]).toBe(true);
    expect(b.wall[cellAt(b, 4, 3)]).toBe(true);
    expect(b.wall[cellAt(b, 2, 1)]).toBe(false);
    expect(isPlainRules(b)).toBe(true);
  });

  it("字符画读得出墙、脚印、箱子、仓鼠", () => {
    const p = parsePuzzle([
      "#####",
      "#@$.#",
      "#####",
    ]);
    expect(p.w).toBe(5);
    expect(p.h).toBe(3);
    expect(p.hamsters).toEqual([cellAt(p, 1, 1)]);
    expect(p.boxes).toEqual([cellAt(p, 2, 1)]);
    expect(p.target[cellAt(p, 3, 1)]).toBe(true);
    expect(remainingBoxes(p, initialState(p))).toBe(1);
  });

  it("字符画读得出两只仓鼠、冰面和成对的传送门", () => {
    const p = parsePuzzle([
      "#######",
      "#@$.~a#",
      "#&$.#a#",
      "#######",
    ]);
    expect(p.hamsters).toHaveLength(2);
    expect(hasIce(p)).toBe(true);
    expect(hasPortal(p)).toBe(true);
    expect(isPlainRules(p)).toBe(false);
    const a = cellAt(p, 5, 1);
    const b = cellAt(p, 5, 2);
    expect(p.portal[a]).toBe(b);
    expect(p.portal[b]).toBe(a);
  });

  it("行长度不齐时右边自动补墙", () => {
    const p = parsePuzzle(["####", "#@", "####"]);
    expect(p.w).toBe(4);
    expect(p.wall[cellAt(p, 2, 1)]).toBe(true);
    expect(p.wall[cellAt(p, 3, 1)]).toBe(true);
  });

  it("画回字符画能还原局面", () => {
    const p = parsePuzzle(["#####", "#@$.#", "#####"]);
    expect(toAscii(p, initialState(p))).toBe("#####\n#@$.#\n#####");
  });

  it("越界的一步返回 -1", () => {
    const b = emptyBoard(4, 4);
    expect(stepCell(b, 0, UP)).toBe(-1);
    expect(stepCell(b, cellAt(b, 3, 3), RIGHT)).toBe(-1);
    expect(stepCell(b, cellAt(b, 1, 1), RIGHT)).toBe(cellAt(b, 2, 1));
  });
});

describe("走路与推箱", () => {
  it("撞墙走不动", () => {
    const p = parsePuzzle(["###", "#@#", "###"]);
    for (const dir of ALL_DIRS) expect(tryMove(p, initialState(p), 0, dir)).toBeNull();
  });

  it("把箱子推到脚印上就算赢", () => {
    const p = parsePuzzle(["#####", "#@$.#", "#####"]);
    const state = walk(p, [RIGHT]);
    expect(state.boxes[0]).toBe(cellAt(p, 3, 1));
    expect(state.hamsters[0]).toBe(cellAt(p, 2, 1));
    expect(isSolved(p, state)).toBe(true);
  });

  it("箱子后面是墙就推不动", () => {
    const p = parsePuzzle(["####", "#@$#", "####"]);
    expect(tryMove(p, initialState(p), 0, RIGHT)).toBeNull();
  });

  it("两个箱子叠在一条线上推不动", () => {
    const p = parsePuzzle(["######", "#@$$ #", "######"]);
    expect(tryMove(p, initialState(p), 0, RIGHT)).toBeNull();
  });

  it("箱子挡住仓鼠,仓鼠挡不住仓鼠", () => {
    const p = parsePuzzle(["#####", "#@&.#", "#####"]);
    // 小仓鼠站在右边,大仓鼠照样走得过去
    const out = tryMove(p, initialState(p), 0, RIGHT);
    expect(out).not.toBeNull();
    expect(out!.pushed).toBe(false);
    expect(out!.to).toBe(cellAt(p, 2, 1));
  });

  it("推箱子时前面站着另一只仓鼠,箱子就推不动", () => {
    const p = parsePuzzle(["######", "#@$& #", "######"]);
    expect(tryMove(p, initialState(p), 0, RIGHT)).toBeNull();
  });

  it("走一步不会改动原来的状态", () => {
    const p = parsePuzzle(["#####", "#@$.#", "#####"]);
    const before = initialState(p);
    const snapshot = stateKey(before);
    tryMove(p, before, 0, RIGHT);
    expect(stateKey(before)).toBe(snapshot);
  });

  it("状态指纹跟箱子的排列顺序无关", () => {
    const a: State = { boxes: [7, 3], hamsters: [1] };
    const b: State = { boxes: [3, 7], hamsters: [1] };
    expect(stateKey(a)).toBe(stateKey(b));
  });
});

describe("冰面", () => {
  it("自由走上冰面会一路滑到非冰格", () => {
    const p = parsePuzzle(["########", "#@~~~  #", "########"]);
    const out = tryMove(p, initialState(p), 0, RIGHT);
    expect(out).not.toBeNull();
    // 1→2 起步,2/3/4 都是冰,滑到第一块非冰的 5 停下
    expect(out!.to).toBe(cellAt(p, 5, 1));
    expect(out!.path.length).toBeGreaterThan(1);
  });

  it("滑到墙前面就停下", () => {
    const p = parsePuzzle(["#####", "#@~~#", "#####"]);
    const out = tryMove(p, initialState(p), 0, RIGHT);
    expect(out!.to).toBe(cellAt(p, 3, 1));
  });

  it("被推上冰面的箱子会滑,滑到脚印上就停", () => {
    const p = parsePuzzle(["########", "#@$~~.~#", "########"]);
    const out = tryMove(p, initialState(p), 0, RIGHT);
    expect(out).not.toBeNull();
    expect(out!.pushed).toBe(true);
    expect(out!.boxTo).toBe(cellAt(p, 5, 1));
    expect(isSolved(p, out!.state)).toBe(true);
  });

  it("推箱子的仓鼠自己不打滑,稳稳停在箱子后面", () => {
    const p = parsePuzzle(["########", "#@$~~.~#", "########"]);
    const out = tryMove(p, initialState(p), 0, RIGHT);
    expect(out!.to).toBe(cellAt(p, 2, 1));
  });

  it("箱子会一路滑到撞上东西为止", () => {
    const p = parsePuzzle(["########", "#@$~~~ #", "########"]);
    const out = tryMove(p, initialState(p), 0, RIGHT);
    // 2→3 起步进冰,3/4/5 是冰,滑到第一块非冰的 6 停下
    expect(out!.boxTo).toBe(cellAt(p, 6, 1));
  });
});

describe("传送门", () => {
  it("走到漩涡上会被送到配对的那个", () => {
    const p = parsePuzzle(["######", "#@ a #", "#    #", "#  a #", "######"]);
    const state = walk(p, [RIGHT, RIGHT]);
    expect(state.hamsters[0]).toBe(cellAt(p, 3, 3));
  });

  it("箱子被推进漩涡也会被送走,而且只送一次", () => {
    const p = parsePuzzle(["######", "#@$a #", "#    #", "#  a #", "######"]);
    const out = tryMove(p, initialState(p), 0, RIGHT);
    expect(out!.boxTo).toBe(cellAt(p, 3, 3));
    expect(out!.state.boxes[0]).toBe(cellAt(p, 3, 3));
  });

  it("对面那格被占着就不传送,东西停在漩涡上", () => {
    const p = parsePuzzle(["######", "#@ a #", "#    #", "#  $ #", "######"]);
    // 先把箱子推到配对漩涡的落点上
    const blocked: State = { boxes: [cellAt(p, 3, 3)], hamsters: [cellAt(p, 1, 1)] };
    const first = tryMove(p, blocked, 0, RIGHT);
    const second = tryMove(p, first!.state, 0, RIGHT);
    expect(second!.to).toBe(cellAt(p, 3, 1));
    expect(second!.teleported).toBe(false);
  });
});

describe("死角判定", () => {
  it("墙角里的箱子算死局", () => {
    const p = parsePuzzle(["#####", "#$  #", "# @ #", "#####"]);
    expect(isDeadCorner(p, cellAt(p, 1, 1))).toBe(true);
    expect(hasDeadBox(p, initialState(p))).toBe(true);
  });

  it("墙角里的箱子如果正好压着脚印就不算死局", () => {
    const p = parsePuzzle(["#####", "#*  #", "# @ #", "#####"]);
    expect(isDeadCorner(p, cellAt(p, 1, 1))).toBe(false);
    expect(hasDeadBox(p, initialState(p))).toBe(false);
  });

  it("只贴一面墙不算死局", () => {
    const p = parsePuzzle(["#####", "# $ #", "# @ #", "#####"]);
    expect(isDeadCorner(p, cellAt(p, 2, 1))).toBe(false);
  });
});

describe("可达范围", () => {
  it("箱子会把房间隔成两半", () => {
    const p = parsePuzzle(["######", "#@$ .#", "######"]);
    const reach = reachable(p, initialState(p), cellAt(p, 1, 1));
    expect(reach.seen[cellAt(p, 3, 1)]).toBe(false);
    expect(reach.seen[cellAt(p, 1, 1)]).toBe(true);
  });

  it("回溯出来的路线一步步走得通", () => {
    const p = parsePuzzle(["#######", "#@    #", "# ### #", "#    .#", "#######"]);
    const from = cellAt(p, 1, 1);
    const to = cellAt(p, 4, 3);
    const reach = reachable(p, initialState(p), from);
    const dirs = pathTo(reach, from, to);
    expect(dirs).not.toBeNull();
    const state = walk(p, dirs!);
    expect(state.hamsters[0]).toBe(to);
  });

  it("走不到的地方回溯返回 null", () => {
    const p = parsePuzzle(["#####", "#@#.#", "#####"]);
    const from = cellAt(p, 1, 1);
    const reach = reachable(p, initialState(p), from);
    expect(pathTo(reach, from, cellAt(p, 3, 1))).toBeNull();
  });
});

describe("land 直接调用", () => {
  it("目标格被 blocked 挡住时返回 null", () => {
    const b = emptyBoard(5, 3);
    const start = cellAt(b, 1, 1);
    expect(land(b, start, RIGHT, (c) => c === cellAt(b, 2, 1), false)).toBeNull();
  });

  it("正常一步的路径只有落点一格", () => {
    const b = emptyBoard(5, 3);
    const spot = land(b, cellAt(b, 1, 1), RIGHT, () => false, false);
    expect(spot!.path).toEqual([cellAt(b, 2, 1)]);
    expect(spot!.slid).toBe(false);
    expect(spot!.teleported).toBe(false);
  });

  it("往上下走同样受墙约束", () => {
    const p = parsePuzzle(["#####", "#@  #", "#   #", "#####"]);
    expect(tryMove(p, initialState(p), 0, UP)).toBeNull();
    expect(tryMove(p, initialState(p), 0, DOWN)).not.toBeNull();
    expect(tryMove(p, initialState(p), 0, LEFT)).toBeNull();
  });
});
