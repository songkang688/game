import { describe, expect, it } from "vitest";
import {
  LINES_PER_LEVEL,
  LOCK_DELAY,
  MAX_LEVEL,
  MAX_LOCK_RESETS,
  cancelGarbage,
  detectTSpin,
  garbageFor,
  gravity,
  holdSwap,
  isB2BMove,
  levelOf,
  lockReset,
  lockStep,
  overLine,
  scoreFor,
  tCorners
} from "./score";
import { ROWS, buildBoard, createBoard } from "./board";

describe("block-drop · 重力与等级", () => {
  it("等级越高掉得越快,而且是严格单调", () => {
    for (let lv = 1; lv <= MAX_LEVEL; lv++) {
      expect(gravity(lv)).toBeLessThan(gravity(lv - 1));
    }
  });

  it("0 级一秒一格,顶级也不会快到 0", () => {
    expect(gravity(0)).toBe(1000);
    expect(gravity(MAX_LEVEL)).toBeGreaterThan(0);
  });

  it("等级超出范围会夹住,乱数据当 0 级", () => {
    expect(gravity(99)).toBe(gravity(MAX_LEVEL));
    expect(gravity(-5)).toBe(gravity(0));
    expect(gravity(Number.NaN)).toBe(gravity(0));
  });

  it("每消十行升一级,封顶不再涨", () => {
    expect(LINES_PER_LEVEL).toBe(10);
    expect(levelOf(0)).toBe(0);
    expect(levelOf(9)).toBe(0);
    expect(levelOf(10)).toBe(1);
    expect(levelOf(35)).toBe(3);
    expect(levelOf(10, 4)).toBe(5);
    expect(levelOf(9999)).toBe(MAX_LEVEL);
  });
});

describe("block-drop · 锁定延迟", () => {
  it("悬空的时候计时清零", () => {
    expect(lockStep({ timer: 300, resets: 2 }, 16, false)).toEqual({ timer: 0, resets: 2, locked: false });
  });

  it("贴着地累计,累计满就锁", () => {
    let s = { timer: 0, resets: 0 };
    let step = lockStep(s, 200, true);
    expect(step.locked).toBe(false);
    s = { timer: step.timer, resets: step.resets };
    step = lockStep(s, 200, true);
    expect(step.locked).toBe(false);
    s = { timer: step.timer, resets: step.resets };
    step = lockStep(s, 200, true);
    expect(step.timer).toBeGreaterThanOrEqual(LOCK_DELAY);
    expect(step.locked).toBe(true);
  });

  it("一帧就超时也会锁", () => {
    expect(lockStep({ timer: 0, resets: 0 }, LOCK_DELAY, true).locked).toBe(true);
  });

  it("挪一下重置计时,重置次数加一", () => {
    expect(lockReset({ timer: 400, resets: 0 })).toEqual({ timer: 0, resets: 1 });
    expect(lockReset({ timer: 400, resets: 7 })).toEqual({ timer: 0, resets: 8 });
  });

  it("重置最多 15 次,用完就不再给,拖不下去", () => {
    let s = { timer: 0, resets: 0 };
    for (let i = 0; i < 40; i++) {
      s = lockReset({ timer: 490, resets: s.resets });
    }
    expect(s.resets).toBe(MAX_LOCK_RESETS);
    expect(s.timer).toBe(490);
    expect(lockStep(s, 20, true).locked).toBe(true);
  });

  it("乱的 dt 不会把计时搞坏", () => {
    expect(lockStep({ timer: 0, resets: 0 }, Number.NaN, true).timer).toBe(0);
    expect(lockStep({ timer: 0, resets: 0 }, -100, true).timer).toBe(0);
  });
});

describe("block-drop · 小凸转身判定", () => {
  it("四个角就是三格方框的四个顶点", () => {
    expect(tCorners(3, 5)).toEqual([
      { x: 3, y: 5 },
      { x: 5, y: 5 },
      { x: 3, y: 7 },
      { x: 5, y: 7 }
    ]);
  });

  it("不是靠转进去的一律不算", () => {
    const b = createBoard().map(() => new Array<number>(10).fill(1));
    expect(detectTSpin(b, "T", 2, 3, ROWS - 3, false)).toBe("none");
  });

  it("别的块再怎么转也不算小凸转身", () => {
    const b = createBoard().map(() => new Array<number>(10).fill(1));
    for (const id of ["I", "O", "S", "Z", "J", "L"] as const) {
      expect(detectTSpin(b, id, 1, 3, ROWS - 3, true)).toBe("none");
    }
  });

  it("四个角只占两个 → 不算", () => {
    const b = createBoard();
    b[ROWS - 1][3] = 1;
    b[ROWS - 1][5] = 1;
    expect(detectTSpin(b, "T", 2, 3, ROWS - 3, true)).toBe("none");
  });

  it("屋檐下面塞进去,前面两个角都被占 → 完整转身", () => {
    // T 朝下(rot=2),前角是下面那两个
    const b = createBoard();
    b[ROWS - 1][3] = 1;
    b[ROWS - 1][5] = 1;
    b[ROWS - 3][3] = 1;
    expect(detectTSpin(b, "T", 2, 3, ROWS - 3, true)).toBe("full");
  });

  it("前面只占一个角 → 算 mini", () => {
    const b = createBoard();
    b[ROWS - 1][3] = 1;
    b[ROWS - 3][3] = 1;
    b[ROWS - 3][5] = 1;
    expect(detectTSpin(b, "T", 2, 3, ROWS - 3, true)).toBe("mini");
  });

  it("踢到最后一组偏移也按完整转身算", () => {
    const b = createBoard();
    b[ROWS - 1][3] = 1;
    b[ROWS - 3][3] = 1;
    b[ROWS - 3][5] = 1;
    expect(detectTSpin(b, "T", 2, 3, ROWS - 3, true, 4)).toBe("full");
  });

  it("墙外和地板都算被占住的角", () => {
    const b = buildBoard([[3]]);
    // 贴着左墙:左边两个角在墙外,右下那个角踩在砖上,凑够三个
    expect(detectTSpin(b, "T", 3, -1, ROWS - 3, true)).toBe("full");
    // 方框底边压在地板下面:下面两个角当作被占
    const empty = createBoard();
    empty[ROWS - 1][4] = 1;
    empty[ROWS - 1][6] = 1;
    expect(detectTSpin(empty, "T", 2, 4, ROWS - 1, true)).toBe("full");
  });
});

describe("block-drop · 计分", () => {
  it("一到四行的基础分,等级越高分越多", () => {
    const at = (lines: number, level: number) =>
      scoreFor({ lines, tspin: "none", level, backToBack: false, combo: 0 }).points;
    expect(at(1, 0)).toBe(100);
    expect(at(2, 0)).toBe(300);
    expect(at(3, 0)).toBe(500);
    expect(at(4, 0)).toBe(800);
    expect(at(1, 4)).toBe(500);
    expect(at(4, 1)).toBeGreaterThan(at(4, 0));
  });

  it("小凸转身比同样行数的普通消行分高", () => {
    const plain = scoreFor({ lines: 1, tspin: "none", level: 0, backToBack: false, combo: 0 });
    const spin = scoreFor({ lines: 1, tspin: "full", level: 0, backToBack: false, combo: 0 });
    const mini = scoreFor({ lines: 1, tspin: "mini", level: 0, backToBack: false, combo: 0 });
    expect(spin.points).toBeGreaterThan(plain.points);
    expect(spin.points).toBeGreaterThan(mini.points);
    expect(spin.label).toContain("小凸转身");
  });

  it("满四行和转身消能续上连续消,普通一行断掉", () => {
    expect(isB2BMove(4, "none")).toBe(true);
    expect(isB2BMove(1, "full")).toBe(true);
    expect(isB2BMove(1, "mini")).toBe(true);
    expect(isB2BMove(1, "none")).toBe(false);
    expect(isB2BMove(3, "none")).toBe(false);
    expect(scoreFor({ lines: 1, tspin: "none", level: 0, backToBack: true, combo: 0 }).backToBack).toBe(false);
    expect(scoreFor({ lines: 4, tspin: "none", level: 0, backToBack: false, combo: 0 }).backToBack).toBe(true);
  });

  it("连着两次满四行有 1.5 倍加成", () => {
    const first = scoreFor({ lines: 4, tspin: "none", level: 0, backToBack: false, combo: 0 });
    const again = scoreFor({ lines: 4, tspin: "none", level: 0, backToBack: true, combo: 0 });
    expect(again.points).toBe(Math.round(first.points * 1.5));
    expect(again.label).toContain("连续");
  });

  it("没消行的时候连续消状态原样留着", () => {
    const r = scoreFor({ lines: 0, tspin: "none", level: 3, backToBack: true, combo: 5 });
    expect(r.backToBack).toBe(true);
    expect(r.combo).toBe(0);
  });

  it("连击越长加分越多,断了归零", () => {
    const c1 = scoreFor({ lines: 1, tspin: "none", level: 0, backToBack: false, combo: 0 });
    const c2 = scoreFor({ lines: 1, tspin: "none", level: 0, backToBack: false, combo: 1 });
    const c3 = scoreFor({ lines: 1, tspin: "none", level: 0, backToBack: false, combo: 2 });
    expect(c1.combo).toBe(1);
    expect(c2.combo).toBe(2);
    expect(c2.points).toBeGreaterThan(c1.points);
    expect(c3.points).toBeGreaterThan(c2.points);
    expect(c2.label).toContain("连击");
    expect(scoreFor({ lines: 0, tspin: "none", level: 0, backToBack: false, combo: 9 }).combo).toBe(0);
  });

  it("软降一格一分,硬降一格两分", () => {
    const r = scoreFor({ lines: 0, tspin: "none", level: 0, backToBack: false, combo: 0, softDrop: 5, hardDrop: 7 });
    expect(r.points).toBe(5 + 14);
  });

  it("行数越界会夹住,不会算出负分", () => {
    expect(scoreFor({ lines: 9, tspin: "none", level: 0, backToBack: false, combo: 0 }).points).toBe(800);
    expect(scoreFor({ lines: -3, tspin: "none", level: -2, backToBack: false, combo: -9 }).points).toBe(0);
  });
});

describe("block-drop · 暂存", () => {
  it("第一次存:块进暂存格,手上换成空(要从队列再取一个)", () => {
    const r = holdSwap("T", null, false);
    expect(r).toEqual({ held: "T", next: null, locked: true, ok: true });
  });

  it("暂存格里有东西就直接换出来", () => {
    const r = holdSwap("L", "I", false);
    expect(r.held).toBe("L");
    expect(r.next).toBe("I");
    expect(r.ok).toBe(true);
  });

  it("同一颗块只能存一次,再按不生效", () => {
    const first = holdSwap("S", "O", false);
    const again = holdSwap(first.next as never, first.held, first.locked);
    expect(again.ok).toBe(false);
    expect(again.held).toBe("S");
    expect(again.next).toBe("O");
  });

  it("换来换去两颗块不会凭空多出来", () => {
    let cur = "J" as const;
    let held: "J" | "Z" | null = "Z";
    const a = holdSwap(cur, held, false);
    held = a.held;
    const back = holdSwap(a.next as never, held, false);
    expect(back.held).toBe("Z");
    expect(back.next).toBe("J");
    void cur;
  });
});

describe("block-drop · 垃圾行", () => {
  it("消两行发一条,三行两条,四行四条;一行不发", () => {
    expect(garbageFor(1)).toBe(0);
    expect(garbageFor(2)).toBe(1);
    expect(garbageFor(3)).toBe(2);
    expect(garbageFor(4)).toBe(4);
  });

  it("转身消和连续消都会多发", () => {
    expect(garbageFor(2, "full")).toBeGreaterThan(garbageFor(2, "none"));
    expect(garbageFor(4, "none", true)).toBe(garbageFor(4, "none") + 1);
    expect(garbageFor(1, "none", true)).toBe(0);
  });

  it("抵消:发出去的先顶掉待落的", () => {
    expect(cancelGarbage(3, 5)).toEqual({ incoming: 0, outgoing: 2 });
    expect(cancelGarbage(5, 3)).toEqual({ incoming: 2, outgoing: 0 });
    expect(cancelGarbage(4, 4)).toEqual({ incoming: 0, outgoing: 0 });
  });

  it("抵消不会算出负数,乱数据也接得住", () => {
    expect(cancelGarbage(-3, 2)).toEqual({ incoming: 0, outgoing: 2 });
    expect(cancelGarbage(Number.NaN, Number.NaN)).toEqual({ incoming: 0, outgoing: 0 });
  });

  it("结束语只鼓励,不说输", () => {
    const line = overLine(12, 3400);
    expect(line).toContain("12");
    expect(line).toContain("3400");
    expect(line).toMatch(/再来|下一局/);
    expect(line).not.toMatch(/输|失败|死/);
  });
});
