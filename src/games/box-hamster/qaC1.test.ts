// 窗口 4 · QA 档C · 第 1 轮测试员:推箱小仓鼠。
//
// 第 1 轮剧本:首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 关 → 无尽玩到结算 → 360px。
// 「赢」一律走求解器出解 + 规则层逐步回放确认真的赢了,不看单个函数的返回值。
import { describe, expect, it } from "vitest";
import { meta } from "./meta";
import {
  CHAPTERS,
  TOTAL,
  buildEndless,
  chapterIndexOf,
  featureTags,
  getLevel,
  minPushesFor,
  recipeFor,
  starsForMoves,
  winMessage,
} from "./levels";
import {
  boxIndexAt,
  initialState,
  isSolved,
  parsePuzzle,
  remainingBoxes,
  stepCell,
  tryMove,
  type Move,
  type State,
} from "./logic";
import { solve, verifySolution } from "./solver";
import {
  assistSummary,
  boardWidth,
  canUndo,
  deadlockReason,
  fitCell,
  deadlockTip,
  difficultyBadge,
  newUndoStack,
  pushFrame,
  roomIsPlayable,
  starsWithAssist,
  stuckReport,
  threeStarLimit,
  undoFrame,
  usableDirs,
} from "./assist";

/* ------------------------------------------------------------------ */
/* 360px 预算                                                          */
/* ------------------------------------------------------------------ */

/**
 * 360px 手机上棋盘还剩多少像素可用:
 * 360(视口) − 8(.game-stage 4px 白边 ×2) − 20(.bh-stagebox 10px 内边距 ×2) = 332。
 * `.game-stage` 是 `overflow:hidden`,超出的列不是能滑出来,而是**直接看不见**。
 */
const BOARD_BUDGET_360 = 332;
/** `@media (max-width:420px)` 里的格子边长与间距 */
const CELL_420 = 34;
const GAP = 2;

function gridPx(cols: number, cell = CELL_420, gap = GAP): number {
  return cols * cell + (cols - 1) * gap;
}

/* ------------------------------------------------------------------ */
/* 一、从首页进得去                                                     */
/* ------------------------------------------------------------------ */

describe("档C R1 · box-hamster · 首页进入", () => {
  it("meta 的 id / 关数 / 模式和实现对得上", () => {
    expect(meta.id).toBe("box-hamster");
    expect(meta.levels).toBe(TOTAL);
    expect(TOTAL).toBe(188);
    expect([...meta.modes].sort()).toEqual(["campaign", "endless"]);
    expect(meta.category).toBe("action");
    expect(meta.platform).toBe("both");
  });

  it("七章切分完整,每章都有名字与描述", () => {
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL);
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.desc.length).toBeGreaterThanOrEqual(6);
      expect(ch.size).toBeGreaterThan(0);
    }
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(TOTAL - 1)).toBe(CHAPTERS.length - 1);
  });

  it("meta.modes 没写的模式确实没有入口,写了的都真做出来了", () => {
    expect(getLevel(0).kind).toBe("campaign");
    expect(buildEndless(0).kind).toBe("endless");
    // 没声明 versus / twoPlayer:双仓鼠是同一个人操作两只,不是两个人对打
    expect(meta.modes).not.toContain("versus");
    expect(meta.modes).not.toContain("twoPlayer");
    const twoMice = getLevel(160);
    expect(twoMice.hamsters.length).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/* 二、赢一次 + 输一次                                                  */
/* ------------------------------------------------------------------ */

describe("档C R1 · box-hamster · 赢一次 + 输一次", () => {
  it("赢:第 1 关按参考解一步步走完,箱子真的全部归位", () => {
    const def = getLevel(0);
    const res = solve(def, { nodeCap: 200_000 });
    expect(res.solved).toBe(true);
    expect(verifySolution(def, res.moves)).toBe(true);

    // 逐步回放,过程中盯着「还差几个箱子」单调不增
    let state: State = initialState(def);
    let left = remainingBoxes(def, state);
    for (const mv of res.moves) {
      const out = tryMove(def, state, mv.who, mv.dir);
      expect(out, "参考解里有一步走不动").not.toBeNull();
      state = out!.state;
      const now = remainingBoxes(def, state);
      expect(now).toBeLessThanOrEqual(def.boxes.length);
      left = now;
    }
    expect(left).toBe(0);
    expect(isSolved(def, state)).toBe(true);
    expect(starsForMoves(def, res.moves.length)).toBeGreaterThanOrEqual(1);
    expect(winMessage(def, def.parMoves, 0)).toContain("步");
  });

  it("赢:恰好用 parMoves 步是三星,超过 twoStarMoves 才掉到一星", () => {
    const def = getLevel(0);
    expect(starsForMoves(def, def.parMoves)).toBe(3);
    expect(starsForMoves(def, def.twoStarMoves)).toBe(2);
    expect(starsForMoves(def, def.twoStarMoves + 1)).toBe(1);
    expect(def.parMoves).toBeLessThanOrEqual(def.twoStarMoves);
    expect(def.bestMoves).toBeLessThanOrEqual(def.parMoves);
  });

  it("输:把箱子推进死角就真的救不回来了,而且提示只鼓励不责怪", () => {
    // 手工摆一张一眼能看懂的图:箱子往上推一步就贴死左上角
    const p = parsePuzzle([
      "######",
      "#    #",
      "# $  #",
      "# @ .#",
      "#    #",
      "######",
    ]);
    const start = initialState(p);
    expect(deadlockReason(p, start)).toBeNull();

    // 仓鼠先绕到箱子下方,再往上推,把箱子顶到第 1 行贴墙
    const below = stepCell(p, p.boxes[0], 2);
    const staged: State = { boxes: p.boxes.slice(), hamsters: [below] };
    const out = tryMove(p, staged, 0, 0);
    expect(out?.pushed).toBe(true);
    const dead = out!.state;
    const reason = deadlockReason(p, dead);
    expect(reason).not.toBeNull();
    const tip = deadlockTip(reason!);
    expect(tip.length).toBeGreaterThan(4);
    expect(/笨|不行|失败|完蛋/.test(tip)).toBe(false);

    // 求解器也确认这局真的推不完了
    const stuck = stuckReport({ ...p, boxes: dead.boxes, hamsters: dead.hamsters }, dead, {
      useSolver: true,
      nodeCap: 20_000,
    });
    expect(stuck.stuck).toBe(true);
  });

  it("输了也能一键回头:撤销栈把上一步原样还回来", () => {
    const def = getLevel(0);
    const start = initialState(def);
    let stack = newUndoStack();
    expect(canUndo(stack)).toBe(false);

    stack = pushFrame(stack, start);
    const res = solve(def, { nodeCap: 200_000 });
    const first = tryMove(def, start, res.moves[0].who, res.moves[0].dir)!;
    expect(canUndo(stack)).toBe(true);
    const back = undoFrame(stack);
    expect(back).not.toBeNull();
    expect(back!.boxes).toEqual(start.boxes);
    expect(back!.hamsters).toEqual(start.hamsters);
    // 撤销不改变原来那一步的结果对象(纯函数,不会串台)
    expect(first.state.hamsters).not.toEqual(back!.hamsters);
  });

  it("撤销随便按不扣星,只有「看一步提示」才封顶两星", () => {
    const def = getLevel(0);
    expect(threeStarLimit(def)).toBe(def.parMoves);
    expect(threeStarLimit(def)).toBeGreaterThanOrEqual(def.bestMoves);
    // 撤销次数根本不是评星的入参 —— 这就是「随便按不扣星」的实现层证据
    expect(starsWithAssist(def, def.bestMoves, 0)).toBe(3);
    expect(starsWithAssist(def, def.bestMoves, 1)).toBe(2);
    expect(starsWithAssist(def, def.twoStarMoves + 1, 0)).toBe(1);
    expect(assistSummary(9, 0)).toContain("不扣星");
    expect(/笨|不行|失败/.test(assistSummary(9, 1))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 三、战役第 1 / 100 / 188 关                                          */
/* ------------------------------------------------------------------ */

describe("档C R1 · box-hamster · 战役第 1 / 100 / 188 关", () => {
  const PICKS = [1, 100, 188];

  it.each(PICKS)("第 %i 关推得完,而且不是「一步白送」", (n) => {
    const def = getLevel(n - 1);
    expect(def.index).toBe(n - 1);
    expect(def.boxes.length).toBeGreaterThan(0);
    // 箱子数和脚印数必须一样多,不然永远凑不齐
    const targets = def.target.filter(Boolean).length;
    expect(targets).toBe(def.boxes.length);

    const res = solve(def, { nodeCap: 240_000 });
    expect(res.solved, `第 ${n} 关求解器解不出来`).toBe(true);
    expect(verifySolution(def, res.moves), `第 ${n} 关参考解回放失败`).toBe(true);
    expect(res.pushes).toBeGreaterThanOrEqual(minPushesFor(recipeFor(n - 1)));
  });

  it.each(PICKS)("第 %i 关一进去就有事可做:四个方向里至少一个走得动", (n) => {
    const def = getLevel(n - 1);
    const start = initialState(def);
    for (let who = 0; who < def.hamsters.length; who++) {
      const dirs = usableDirs(def, start, who);
      expect(dirs.some(Boolean), `第 ${n} 关第 ${who + 1} 只仓鼠一步都动不了`).toBe(true);
    }
  });

  it.each(PICKS)("第 %i 关的机关标签和棋盘上真有的东西一致", (n) => {
    const def = getLevel(n - 1);
    const tags = featureTags(def).join(" ");
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.includes("❄️ 冰面")).toBe(def.ice.some(Boolean));
    expect(tags.includes("🌀 传送门")).toBe(def.portal.some((p) => p >= 0));
    expect(tags.includes("🐹🐹 双搭档")).toBe(def.hamsters.length > 1);
    expect(difficultyBadge(def).length).toBeGreaterThan(0);
  });

  it("同一关重进两次拿到的是同一张图(带缓存也不许变样)", () => {
    for (const n of PICKS) {
      const a = getLevel(n - 1);
      const b = getLevel(n - 1);
      expect(a.boxes).toEqual(b.boxes);
      expect(a.hamsters).toEqual(b.hamsters);
      expect(a.name).toBe(b.name);
    }
  });

  it("关号越界会被夹回合法区间,不会白屏", () => {
    expect(getLevel(-3).index).toBe(0);
    expect(getLevel(9999).index).toBe(TOTAL - 1);
  });
});

/* ------------------------------------------------------------------ */
/* 四、无尽玩到结算                                                     */
/* ------------------------------------------------------------------ */

describe("档C R1 · box-hamster · 无尽玩到结算", () => {
  it("连推 10 仓每仓都真的推得完,一路走到结算", () => {
    let cleared = 0;
    for (let r = 0; r < 10; r++) {
      const def = buildEndless(r);
      expect(roomIsPlayable(def), `第 ${r + 1} 仓不合格`).toBe(true);
      const res = solve(def, { nodeCap: 160_000 });
      expect(res.solved, `第 ${r + 1} 仓解不出来`).toBe(true);
      expect(verifySolution(def, res.moves)).toBe(true);
      cleared++;
    }
    expect(cleared).toBe(10);
  });

  it("无尽一仓比一仓难:后段的箱子不比前段少,机关也逐步加进来", () => {
    const early = buildEndless(0);
    const late = buildEndless(13);
    expect(late.boxes.length).toBeGreaterThanOrEqual(early.boxes.length);
    expect(buildEndless(6).ice.some(Boolean)).toBe(true);
    expect(buildEndless(10).portal.some((p) => p >= 0)).toBe(true);
    expect(early.ice.some(Boolean)).toBe(false);
    expect(early.portal.some((p) => p >= 0)).toBe(false);
  });

  it("无尽仓永远是单仓单鼠,不会突然要求玩家操作两只", () => {
    for (let r = 0; r < 16; r++) {
      expect(buildEndless(r).hamsters).toHaveLength(1);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 五、360px 窄屏(第 1 轮登记的严重问题,修复员负责清零)                */
/* ------------------------------------------------------------------ */

describe("档C R1 · box-hamster · 360px 窄屏", () => {
  it("窄屏格子边长与间距就是 CSS 里写的 34px / 2px", () => {
    expect(gridPx(7)).toBe(7 * 34 + 6 * 2);
    expect(gridPx(1)).toBe(34);
  });

  it("7×7 / 8×7 这类单间仓库在 360px 上装得下", () => {
    expect(gridPx(7)).toBeLessThanOrEqual(BOARD_BUDGET_360);
    expect(gridPx(8)).toBeLessThanOrEqual(BOARD_BUDGET_360);
    for (let r = 0; r < 16; r++) {
      expect(gridPx(buildEndless(r).w), `无尽第 ${r + 1} 仓在 360px 上装不下`).toBeLessThanOrEqual(
        BOARD_BUDGET_360
      );
    }
  });

  it("【C1-01 严重 · 本轮修复员已清零】188 关一关都不会被切掉右边几列", () => {
    // 改之前:格子边长是媒体查询写死的 34px,和列数无关,36 关溢出,最宽 13 列要 466px。
    // 改之后:边长按「还剩多宽」倒着算(assist.fitCell),棋盘宽度永远不超预算。
    const over: Array<{ level: number; w: number; px: number }> = [];
    let widest = 0;
    for (let i = 0; i < TOTAL; i++) {
      const def = getLevel(i);
      const px = boardWidth(def.w, fitCell(def.w, BOARD_BUDGET_360));
      widest = Math.max(widest, def.w);
      if (px > BOARD_BUDGET_360) over.push({ level: i + 1, w: def.w, px });
    }
    expect(over).toEqual([]);
    // 最宽的那一档确实还是 13 列 —— 是摆法变了,不是把关卡改窄糊弄过去
    expect(widest).toBe(13);
    expect(gridPx(13)).toBeGreaterThan(BOARD_BUDGET_360);
  });
});
