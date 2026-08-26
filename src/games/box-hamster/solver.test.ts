import { describe, expect, it } from "vitest";
import { cellAt, initialState, isSolved, parsePuzzle, tryMove, type Puzzle } from "./logic";
import { components, portalsCrossComponents, solutionFootprint, solve, verifySolution } from "./solver";

/** 解一关并顺手确认解法真的能走通 */
function solveAndVerify(p: Puzzle, cap = 200_000): ReturnType<typeof solve> {
  const res = solve(p, { nodeCap: cap });
  if (res.solved) expect(verifySolution(p, res.moves)).toBe(true);
  return res;
}

describe("连通块", () => {
  it("一间屋是一块", () => {
    const p = parsePuzzle(["#####", "#@ .#", "#####"]);
    expect(components(p).count).toBe(1);
  });

  it("中间一堵墙劈成两块", () => {
    const p = parsePuzzle(["#######", "#@ # .#", "#  # $#", "#######"]);
    const { id, count } = components(p);
    expect(count).toBe(2);
    expect(id[cellAt(p, 1, 1)]).not.toBe(id[cellAt(p, 5, 1)]);
  });

  it("传送门跨块时会被认出来", () => {
    const p = parsePuzzle(["#######", "#@a#a.#", "#  # $#", "#######"]);
    const { id } = components(p);
    expect(portalsCrossComponents(p, id)).toBe(true);
  });

  it("传送门在同一块里就不算跨块", () => {
    const p = parsePuzzle(["#######", "#@a a.#", "#  # $#", "#######"]);
    const { id } = components(p);
    expect(portalsCrossComponents(p, id)).toBe(false);
  });
});

describe("纯推箱(宏搜索)", () => {
  it("一步就能推完的关", () => {
    const p = parsePuzzle(["#####", "#@$.#", "#####"]);
    const res = solveAndVerify(p);
    expect(res.solved).toBe(true);
    expect(res.pushes).toBe(1);
    expect(res.moves).toHaveLength(1);
    expect(res.method).toBe("macro");
  });

  it("要先绕到箱子另一边的关", () => {
    const p = parsePuzzle([
      "#######",
      "#  @  #",
      "# .$  #",
      "#     #",
      "#######",
    ]);
    const res = solveAndVerify(p);
    expect(res.solved).toBe(true);
    expect(res.pushes).toBeGreaterThanOrEqual(1);
    // 仓鼠在箱子上方,想往左推必须先绕到箱子右边去
    expect(res.moves.length).toBeGreaterThan(1);
  });

  it("多个箱子的关也解得出来", () => {
    const p = parsePuzzle([
      "########",
      "#  .   #",
      "# $$@  #",
      "#  .   #",
      "########",
    ]);
    const res = solveAndVerify(p);
    expect(res.solved).toBe(true);
    expect(res.pushes).toBeGreaterThanOrEqual(2);
  });

  it("箱子一开始就卡死在墙角的关判为无解", () => {
    const p = parsePuzzle([
      "#####",
      "#$ .#",
      "# @ #",
      "#####",
    ]);
    const res = solve(p, { nodeCap: 40_000 });
    expect(res.solved).toBe(false);
    expect(res.capped).toBe(false);
  });

  it("仓鼠被墙圈住够不着箱子的关判为无解", () => {
    const p = parsePuzzle([
      "#######",
      "#@#$ .#",
      "#######",
    ]);
    const res = solve(p, { nodeCap: 40_000 });
    expect(res.solved).toBe(false);
  });

  it("已经摆好的关直接返回零步解", () => {
    const p = parsePuzzle(["#####", "#@* #", "#####"]);
    const res = solve(p);
    expect(res.solved).toBe(true);
    expect(res.moves).toHaveLength(0);
  });
});

describe("冰面与传送门(A*)", () => {
  it("冰面关走 A* 并且解得出来", () => {
    const p = parsePuzzle([
      "########",
      "#@$~~.~#",
      "########",
    ]);
    const res = solveAndVerify(p);
    expect(res.solved).toBe(true);
    expect(res.method).toBe("astar");
  });

  it("要靠冰面把箱子送过去的关", () => {
    const p = parsePuzzle([
      "#########",
      "#@$~~~~.#",
      "#########",
    ]);
    const res = solveAndVerify(p);
    expect(res.solved).toBe(true);
    expect(res.pushes).toBeGreaterThanOrEqual(1);
  });

  it("传送门关解得出来", () => {
    const p = parsePuzzle([
      "#######",
      "#@$a  #",
      "#     #",
      "#  a .#",
      "#######",
    ]);
    const res = solveAndVerify(p);
    expect(res.solved).toBe(true);
    expect(res.method).toBe("astar");
  });

  it("节点上限太小的时候老实报 capped,不谎报有解", () => {
    const p = parsePuzzle([
      "##########",
      "#~~~~~~~~#",
      "#~$ .$ .~#",
      "#~ @    ~#",
      "#~$ .$ .~#",
      "#~~~~~~~~#",
      "##########",
    ]);
    const res = solve(p, { nodeCap: 30 });
    if (!res.solved) expect(res.capped).toBe(true);
  });
});

describe("拆块求解", () => {
  it("两间互不相通的屋子各解各的,拼起来照样赢", () => {
    const p = parsePuzzle([
      "##########",
      "#@$. #&$.#",
      "#    #   #",
      "##########",
    ]);
    const res = solveAndVerify(p);
    expect(res.solved).toBe(true);
    expect(res.method).toBe("split");
    // 两只仓鼠都得动
    expect(res.moves.some((m) => m.who === 0)).toBe(true);
    expect(res.moves.some((m) => m.who === 1)).toBe(true);
  });

  it("有一间屋没有仓鼠就解不了", () => {
    const p = parsePuzzle([
      "##########",
      "#@$. # $.#",
      "#    #   #",
      "##########",
    ]);
    expect(solve(p, { nodeCap: 40_000 }).solved).toBe(false);
  });

  it("箱子数和脚印数对不上的屋子直接判无解", () => {
    const p = parsePuzzle([
      "##########",
      "#@$$ #&  #",
      "#  . #  .#",
      "##########",
    ]);
    expect(solve(p, { nodeCap: 40_000 }).solved).toBe(false);
  });
});

describe("解法回放与足迹", () => {
  it("verifySolution 认得出走不通的假解", () => {
    const p = parsePuzzle(["#####", "#@$.#", "#####"]);
    expect(verifySolution(p, [{ who: 0, dir: 3 }])).toBe(false);
    expect(verifySolution(p, [])).toBe(false);
    expect(verifySolution(p, [{ who: 0, dir: 1 }])).toBe(true);
  });

  it("足迹覆盖解法一路踩过的每一格", () => {
    const p = parsePuzzle([
      "#######",
      "#@    #",
      "# $ . #",
      "#######",
    ]);
    const res = solveAndVerify(p);
    const foot = solutionFootprint(p, res.moves);
    // 起点、箱子起点、脚印一定都在里面
    expect(foot.has(cellAt(p, 1, 1))).toBe(true);
    expect(foot.has(cellAt(p, 2, 2))).toBe(true);
    expect(foot.has(cellAt(p, 4, 2))).toBe(true);

    // 沿着解法走一遍,每一步落到的格子都该在足迹里
    let state = initialState(p);
    for (const mv of res.moves) {
      const out = tryMove(p, state, mv.who, mv.dir);
      expect(out).not.toBeNull();
      expect(foot.has(out!.to)).toBe(true);
      state = out!.state;
    }
    expect(isSolved(p, state)).toBe(true);
  });

  it("没有箱子的关是白给的零步解", () => {
    const p = parsePuzzle(["#####", "#@  #", "#####"]);
    const res = solve(p);
    expect(res.solved).toBe(true);
    expect(res.method).toBe("trivial");
  });
});
