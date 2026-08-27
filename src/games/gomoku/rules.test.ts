import { describe, expect, it } from "vitest";
import { setCell } from "./ai";
import {
  CLAIM_WINDOW_MS,
  claimResult,
  claimSecondsLeft,
  forbiddenKind,
  judgeMove,
  openClaim,
  parseDiagram,
  pressClaim,
  shapesAt,
  strongestShape,
  tickClaim,
} from "./rules";

/** 把一张棋谱里唯一的 ✱ 点拿出来问：黑棋下这里是什么棋型？ */
function shapeOf(text: string, who: 1 | 2 = 1): ReturnType<typeof strongestShape> {
  const { board, marks } = parseDiagram(text);
  expect(marks).toHaveLength(1);
  return strongestShape(board, marks[0][0], marks[0][1], who);
}

function countsOf(text: string, who: 1 | 2 = 1): ReturnType<typeof shapesAt> {
  const { board, marks } = parseDiagram(text);
  return shapesAt(board, marks[0][0], marks[0][1], who);
}

describe("棋谱解析", () => {
  it("认得黑子白子空点与待验证点，行列不齐时补成正方盘", () => {
    const { board, marks } = parseDiagram(`
      . ● ○ .
      . ✱ . .
    `);
    expect(board.size).toBe(4);
    expect(board.cells[0 * 4 + 1]).toBe(1);
    expect(board.cells[0 * 4 + 2]).toBe(2);
    expect(marks).toEqual([[1, 1]]);
  });

  it("看不懂的字符要报错，免得棋谱写错了还当成空点", () => {
    expect(() => parseDiagram("● ▲")).toThrow();
  });
});

describe("棋型图谱 · 活四（4 张谱）", () => {
  it("横着的活四：两头都空", () => {
    expect(
      shapeOf(`
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . ● ● ✱ ● . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
      `)
    ).toBe("liveFour");
  });

  it("竖着的活四", () => {
    expect(
      shapeOf(`
        . . . . . . . . .
        . . . . ● . . . .
        . . . . ● . . . .
        . . . . ✱ . . . .
        . . . . ● . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
      `)
    ).toBe("liveFour");
  });

  it("斜着的活四", () => {
    expect(
      shapeOf(`
        . . . . . . . . .
        . ● . . . . . . .
        . . ● . . . . . .
        . . . ✱ . . . . .
        . . . . ● . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
      `)
    ).toBe("liveFour");
  });

  it("反斜的活四，同时数得出只有一个方向成形", () => {
    const c = countsOf(`
      . . . . . . . . .
      . . . . . ● . . .
      . . . . ● . . . .
      . . . ✱ . . . . .
      . . ● . . . . . .
      . . . . . . . . .
      . . . . . . . . .
      . . . . . . . . .
      . . . . . . . . .
    `);
    expect(c.liveFour).toBe(1);
    expect(c.five).toBe(0);
  });
});

describe("棋型图谱 · 冲四（4 张谱）", () => {
  it("一头被白棋堵死的四", () => {
    expect(
      shapeOf(`
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        ○ ● ● ✱ ● . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
      `)
    ).toBe("rushFour");
  });

  it("跳着补的四：中间留了个洞", () => {
    expect(
      shapeOf(`
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        ○ ● ● ● . ✱ . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
      `)
    ).toBe("rushFour");
  });

  it("顶着棋盘边的四也只是冲四", () => {
    expect(
      shapeOf(`
        ● ● ✱ ● . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
      `)
    ).toBe("rushFour");
  });

  it("竖着的冲四：上头还空着，下头被白子挡住", () => {
    const c = countsOf(`
      . . . . . . . . .
      . . . . . . . . .
      . . . . . . . . .
      . . ● . . . . . .
      . . ● . . . . . .
      . . ● . . . . . .
      . . ✱ . . . . . .
      . . ○ . . . . . .
      . . . . . . . . .
    `);
    expect(c.rushFour).toBe(1);
    expect(c.liveFour).toBe(0);
  });
});

describe("棋型图谱 · 活三（4 张谱）", () => {
  it("紧挨着的三，两头都空", () => {
    expect(
      shapeOf(`
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . ● ● ✱ . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
      `)
    ).toBe("liveThree");
  });

  it("中间空一格的跳三", () => {
    expect(
      shapeOf(`
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . ● ✱ ● . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
      `)
    ).toBe("liveThree");
  });

  it("竖着的活三", () => {
    expect(
      shapeOf(`
        . . . . . . . . .
        . . . . . . . . .
        . . . ● . . . . .
        . . . ● . . . . .
        . . . ✱ . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
      `)
    ).toBe("liveThree");
  });

  it("斜着的活三，四个方向里只有一条成形", () => {
    const c = countsOf(`
      . . . . . . . . .
      . . ● . . . . . .
      . . . ● . . . . .
      . . . . ✱ . . . .
      . . . . . . . . .
      . . . . . . . . .
      . . . . . . . . .
      . . . . . . . . .
      . . . . . . . . .
    `);
    expect(c.liveThree).toBe(1);
    expect(c.rushFour).toBe(0);
  });
});

describe("棋型图谱 · 眠三（4 张谱）", () => {
  it("一头被白棋堵住的三", () => {
    expect(
      shapeOf(`
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . ○ ● ● ✱ . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
      `)
    ).toBe("sleepThree");
  });

  it("贴着棋盘边、又被堵一头的三", () => {
    expect(
      shapeOf(`
        ● ● ✱ . . ○ . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
      `)
    ).toBe("sleepThree");
  });

  it("竖着被堵一头的三", () => {
    expect(
      shapeOf(`
        . . . ○ . . . . .
        . . . ● . . . . .
        . . . ● . . . . .
        . . . ✱ . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
        . . . . . . . . .
      `)
    ).toBe("sleepThree");
  });

  it("斜着被堵一头的三", () => {
    const c = countsOf(`
      ○ . . . . . . . .
      . ● . . . . . . .
      . . ● . . . . . .
      . . . ✱ . . . . .
      . . . . . . . . .
      . . . . . . . . .
      . . . . . . ○ . .
      . . . . . . . . .
      . . . . . . . . .
    `);
    expect(c.sleepThree).toBe(1);
    expect(c.liveThree).toBe(0);
  });
});

describe("禁手：三三 / 四四 / 长连 / 五连优先", () => {
  const cross = `
    . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . .
    . . . . . . . ● . . . . . . .
    . . . . . . . ● . . . . . . .
    . . . . . ● ● ✱ . . . . . . .
    . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . .
  `;

  it("三三禁手：一手同时造出两个活三", () => {
    const { board, marks } = parseDiagram(cross);
    const [x, y] = marks[0];
    expect(forbiddenKind(board, x, y)).toBe("doubleThree");
    const v = judgeMove(board, x, y, 1, { forbidden: true });
    expect(v.claimable).toBe(true);
    expect(v.instantLoss).toBe(false);
    expect(v.text).toContain("三三");
  });

  it("白棋做同样的形不算禁手", () => {
    const { board, marks } = parseDiagram(cross);
    const [x, y] = marks[0];
    expect(forbiddenKind(board, x, y, 2)).toBe("none");
    expect(judgeMove(board, x, y, 2, { forbidden: true }).kind).toBe("none");
  });

  it("四四禁手：一手同时造出两个四", () => {
    const { board, marks } = parseDiagram(`
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . ○ . . ● . . . . . . .
      . . . . . . . ● . . . . . . .
      . . . . . . . ● . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . ● ● ● ✱ . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
    `);
    const [x, y] = marks[0];
    expect(forbiddenKind(board, x, y)).toBe("doubleFour");
    const v = judgeMove(board, x, y, 1, { forbidden: true });
    expect(v.claimable).toBe(true);
    expect(v.win).toBe(false);
  });

  it("长连禁手：黑棋连成六颗，当场判负，不用谁来指", () => {
    const { board, marks } = parseDiagram(`
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . ● ● ● ✱ ● ● . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
    `);
    const [x, y] = marks[0];
    expect(forbiddenKind(board, x, y)).toBe("overline");
    const v = judgeMove(board, x, y, 1, { forbidden: true });
    expect(v.instantLoss).toBe(true);
    expect(v.claimable).toBe(false);
    expect(v.win).toBe(false);
    // 无禁·自由规则下，长连照样算赢
    expect(judgeMove(board, x, y, 1, { forbidden: false }).win).toBe(true);
  });

  it("白棋长连仍然算胜", () => {
    const { board, marks } = parseDiagram(`
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . ○ ○ ○ ✱ ○ ○ . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
    `);
    const [x, y] = marks[0];
    expect(judgeMove(board, x, y, 2, { forbidden: true }).win).toBe(true);
  });

  it("五连优先：黑棋这一手既成五又是四四，判黑棋赢", () => {
    const { board, marks } = parseDiagram(`
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . ● . . . . . . .
      . . . . . . . ● . . . . . . .
      . . . . . . . ● . . . . . . .
      . . . . . . . . . . . . . . .
      . . . ● ● ● ● ✱ . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
      . . . . . . . . . . . . . . .
    `);
    const [x, y] = marks[0];
    // 横着正好五连，竖着还多一个四 —— 五连优先，不算禁手
    expect(forbiddenKind(board, x, y)).toBe("none");
    const v = judgeMove(board, x, y, 1, { forbidden: true });
    expect(v.win).toBe(true);
    expect(v.kind).toBe("none");
  });

  it("禁手规则关掉时，三三只是普通一手", () => {
    const { board, marks } = parseDiagram(cross);
    const [x, y] = marks[0];
    const v = judgeMove(board, x, y, 1, { forbidden: false });
    expect(v.kind).toBe("none");
    expect(v.claimable).toBe(false);
  });

  it("判定过程不留痕迹：棋盘还是原样", () => {
    const { board, marks } = parseDiagram(cross);
    const [x, y] = marks[0];
    judgeMove(board, x, y, 1, { forbidden: true });
    expect(board.cells[y * board.size + x]).toBe(0);
    setCell(board, x, y, 1);
    expect(board.cells[y * board.size + x]).toBe(1);
  });
});

describe("白方「指出禁手」的 8 秒窗口", () => {
  it("8 秒之内按下去有效，白棋赢", () => {
    let s = openClaim("doubleThree", 7, 7, 1000);
    expect(s.deadline - s.openedAt).toBe(CLAIM_WINDOW_MS);
    expect(claimSecondsLeft(s, 1000)).toBe(8);
    expect(claimSecondsLeft(s, 5500)).toBe(4);
    s = tickClaim(s, 5500);
    expect(s.status).toBe("pending");
    s = pressClaim(s, 5500);
    expect(s.status).toBe("claimed");
    expect(claimResult(s).winner).toBe(2);
    expect(claimResult(s).text).toContain("三三");
  });

  it("超过 8 秒就作废，视为白棋放弃", () => {
    let s = openClaim("doubleFour", 3, 4, 0);
    s = tickClaim(s, CLAIM_WINDOW_MS);
    expect(s.status).toBe("expired");
    expect(claimSecondsLeft(s, CLAIM_WINDOW_MS)).toBe(0);
    s = pressClaim(s, CLAIM_WINDOW_MS + 10);
    expect(s.status).toBe("expired");
    expect(claimResult(s).winner).toBe(0);
  });

  it("过点之后再按也没用，而且已判的窗口不会被改回去", () => {
    let s = openClaim("doubleThree", 1, 1, 0);
    s = pressClaim(s, CLAIM_WINDOW_MS + 1);
    expect(s.status).toBe("expired");
    const claimed = pressClaim(openClaim("doubleThree", 1, 1, 0), 10);
    expect(pressClaim(claimed, 20).status).toBe("claimed");
    expect(tickClaim(claimed, 99_999).status).toBe("claimed");
  });
});
