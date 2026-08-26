// 推箱小仓鼠 · 1.2 辅助层单测:撤销栈、死局真值表、难度标注、下一步提示、无尽生成保护。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { initialState, isSolved, parsePuzzle, tryMove, type Move, type State } from "./logic";
import { solve } from "./solver";
import { TOTAL, buildEndless, getLevel } from "./levels";
import {
  DIFFICULTY_BANDS,
  HINTS_PER_LEVEL,
  UNDO_CAP,
  assistSummary,
  canUndo,
  canUseHint,
  curveIsSmooth,
  deadAgainstWall,
  deadSquare,
  deadlockReason,
  deadlockTip,
  difficultyBadge,
  difficultyOf,
  difficultyOfLevel,
  facingAngle,
  hintsLeft,
  makeEndlessRoom,
  moveDuration,
  newUndoStack,
  nextHintMove,
  plannedDifficulty,
  pushFrame,
  resetStack,
  roomIsPlayable,
  starsWithAssist,
  stuckReport,
  undoFrame,
  usableDirs,
} from "./assist";

/** 六个真·死局 */
const DEAD_BOARDS: Array<{ name: string; rows: string[] }> = [
  {
    name: "箱子顶在左上角",
    rows: ["#######", "#$    #", "#  @  #", "#    .#", "#######"],
  },
  {
    name: "箱子顶在右下角",
    rows: ["#######", "#  @  #", "#.    #", "#    $#", "#######"],
  },
  {
    name: "两个箱子和两面墙拼成 2×2",
    rows: ["#######", "##$   #", "##$ @ #", "#   ..#", "#######"],
  },
  {
    name: "四个箱子挤成一坨",
    rows: ["########", "#  $$  #", "#  $$@ #", "#....  #", "########"],
  },
  {
    name: "箱子贴着上墙的走廊里没有脚印",
    rows: ["#######", "#  $  #", "# @   #", "#....##", "#######"],
  },
  {
    name: "箱子被墙夹在凹角里",
    rows: ["#######", "#   ###", "# @ #$#", "#  ..##", "#######"],
  },
];

/** 六个还有救的局面 */
const ALIVE_BOARDS: Array<{ name: string; rows: string[] }> = [
  {
    name: "开局的空房",
    rows: ["#######", "#     #", "#  $  #", "# @ . #", "#######"],
  },
  {
    name: "箱子在角落但脚下就是脚印",
    rows: ["#######", "#*    #", "#  @  #", "#     #", "#######"],
  },
  {
    name: "箱子贴墙但这条线上有脚印",
    rows: ["#######", "# $ . #", "# @   #", "#     #", "#######"],
  },
  {
    name: "两个箱子并排但没有挤死",
    rows: ["########", "#      #", "# $ $  #", "# @    #", "# .. ###", "########"],
  },
  {
    name: "箱子挨着墙但可以往下推",
    rows: ["#######", "#@    #", "# $   #", "#  .  #", "#######"],
  },
  {
    name: "全部归位",
    rows: ["#######", "#  *  #", "# @   #", "#     #", "#######"],
  },
];

describe("box-hamster 1.2 · 撤销栈", () => {
  it("撤销一层层往回退,顺序不会乱", () => {
    const stack = newUndoStack();
    const a: State = { boxes: [1], hamsters: [2] };
    const b: State = { boxes: [3], hamsters: [4] };
    pushFrame(stack, a);
    pushFrame(stack, b);
    expect(canUndo(stack)).toBe(true);
    expect(undoFrame(stack)).toEqual(b);
    expect(undoFrame(stack)).toEqual(a);
    expect(undoFrame(stack)).toBeNull();
    expect(canUndo(stack)).toBe(false);
  });

  it("压进去的是副本,后面改了原状态也不会把历史带歪", () => {
    const stack = newUndoStack();
    const live: State = { boxes: [1], hamsters: [2] };
    pushFrame(stack, live);
    live.boxes[0] = 99;
    expect(undoFrame(stack)?.boxes).toEqual([1]);
  });

  it("超过内存上限就丢最早的那一帧,并记下丢了几帧", () => {
    const stack = newUndoStack(5);
    for (let i = 0; i < 9; i++) pushFrame(stack, { boxes: [i], hamsters: [0] });
    expect(stack.frames.length).toBe(5);
    expect(stack.dropped).toBe(4);
    expect(stack.frames[0].boxes).toEqual([4]);
  });

  it("默认上限是 400 帧,一关几百步都够退", () => {
    expect(UNDO_CAP).toBe(400);
    expect(newUndoStack().cap).toBe(400);
  });

  it("重来把栈和丢帧计数一起清空", () => {
    const stack = newUndoStack(3);
    for (let i = 0; i < 6; i++) pushFrame(stack, { boxes: [i], hamsters: [0] });
    resetStack(stack);
    expect(stack.frames).toHaveLength(0);
    expect(stack.dropped).toBe(0);
    expect(canUndo(stack)).toBe(false);
  });
});

describe("box-hamster 1.2 · 死局真值表", () => {
  it("六个死局全部判得出来", () => {
    for (const c of DEAD_BOARDS) {
      const p = parsePuzzle(c.rows);
      const reason = deadlockReason(p, initialState(p));
      expect(reason, `${c.name} 应该被判死局`).not.toBeNull();
    }
  });

  it("六个还有救的局面一个都不许冤枉", () => {
    for (const c of ALIVE_BOARDS) {
      const p = parsePuzzle(c.rows);
      expect(deadlockReason(p, initialState(p)), `${c.name} 不该被判死局`).toBeNull();
    }
  });

  it("2×2 挤成一坨判得准,箱子都在脚印上就不算", () => {
    const bad = parsePuzzle(["######", "# $$ #", "# $$ #", "#@...#", "#.####", "######"]);
    expect(deadSquare(bad, initialState(bad))).toBe(true);
    const good = parsePuzzle(["######", "# ** #", "# ** #", "#@   #", "######"]);
    expect(deadSquare(good, initialState(good))).toBe(false);
  });

  it("贴墙走廊规则只管纯推箱关,冰面和传送门交给求解器", () => {
    const plain = parsePuzzle(["#######", "#  $  #", "# @   #", "#....##", "#######"]);
    expect(deadAgainstWall(plain, initialState(plain))).toBe(true);
    const icy = parsePuzzle(["#######", "# ~$  #", "# @   #", "#....##", "#######"]);
    expect(deadAgainstWall(icy, initialState(icy))).toBe(false);
  });

  it("死局提示是温和的建议,不说「你输了」这种话", () => {
    for (const reason of ["corner", "square", "wall", "solver"] as const) {
      const tip = deadlockTip(reason);
      expect(tip).toContain("撤销");
      expect(/输|死|完蛋|笨/.test(tip)).toBe(false);
    }
  });

  it("规则看不出来的死局交给求解器兜底", () => {
    // 箱子四周都空、不贴墙不挤堆,但脚印被墙隔在另一间屋:三条规则都看不出来,求解器一算就知道没戏
    const p = parsePuzzle(["#########", "#       #", "#  @$   #", "#       #", "#########", "#  .    #", "#########"]);
    const report = stuckReport(p, initialState(p), { nodeCap: 20_000 });
    expect(report.stuck).toBe(true);
    expect(report.reason).toBe("solver");
    expect(report.tip).toContain("撤销");
  });

  it("求解器撞上节点上限时一律当「还有救」,不吓唬小朋友", () => {
    const def = getLevel(150);
    const report = stuckReport(def, initialState(def), { nodeCap: 1 });
    expect(report.stuck).toBe(false);
    expect(report.capped).toBe(true);
  });

  it("188 关的开局没有一关会被死局规则误伤", () => {
    for (let lv = 0; lv < TOTAL; lv += 7) {
      const def = getLevel(lv);
      expect(deadlockReason(def, initialState(def)), `第 ${lv + 1} 关开局被误判死局`).toBeNull();
    }
  });
});

describe("box-hamster 1.2 · 下一步提示与三星", () => {
  it("提示给的就是求解器那条解的第一步", () => {
    const def = getLevel(3);
    const hint = nextHintMove(def, initialState(def));
    const truth = solve(def, { nodeCap: 60_000 });
    expect(truth.solved).toBe(true);
    expect(hint.move).toEqual(truth.moves[0]);
    expect(hint.remaining).toBe(truth.moves.length);
    expect(hint.text).toContain("走一格");
  });

  it("提示给的那一步真的走得动", () => {
    const def = getLevel(11);
    const state = initialState(def);
    const hint = nextHintMove(def, state);
    expect(hint.move).not.toBeNull();
    const out = tryMove(def, state, (hint.move as Move).who, (hint.move as Move).dir);
    expect(out).not.toBeNull();
  });

  it("已经通关的局面不会再给提示", () => {
    const p = parsePuzzle(["#######", "#  *  #", "# @   #", "#######"]);
    expect(isSolved(p, initialState(p))).toBe(true);
    expect(nextHintMove(p, initialState(p)).move).toBeNull();
  });

  it("每关只给一次提示", () => {
    expect(HINTS_PER_LEVEL).toBe(1);
    expect(hintsLeft(0)).toBe(1);
    expect(canUseHint(0)).toBe(true);
    expect(canUseHint(1)).toBe(false);
    expect(hintsLeft(3)).toBe(0);
  });

  it("看过提示就封顶两星,撤销一颗星都不扣", () => {
    const def = { bestMoves: 20, parMoves: 29, twoStarMoves: 52 };
    expect(starsWithAssist(def, 25, 0)).toBe(3);
    expect(starsWithAssist(def, 25, 1)).toBe(2);
    expect(starsWithAssist(def, 40, 0)).toBe(2);
    expect(starsWithAssist(def, 90, 0)).toBe(1);
    expect(starsWithAssist(def, 90, 1)).toBe(1);
  });

  it("结算里如实写清撤销与提示,而且只鼓励", () => {
    expect(assistSummary(0, 0)).toContain("没撤销");
    expect(assistSummary(4, 0)).toContain("4");
    expect(assistSummary(4, 0)).toContain("不扣星");
    expect(assistSummary(0, 1)).toContain("提示");
    expect(/笨|不行|真差/.test(assistSummary(9, 1))).toBe(false);
  });
});

describe("box-hamster 1.2 · 难度标注", () => {
  it("分档边界按最短推箱次数来", () => {
    expect(difficultyOf(0).stars).toBe(1);
    expect(difficultyOf(5).stars).toBe(1);
    expect(difficultyOf(6).stars).toBe(2);
    expect(difficultyOf(10).stars).toBe(3);
    expect(difficultyOf(15).stars).toBe(4);
    expect(difficultyOf(30).stars).toBe(5);
    expect(DIFFICULTY_BANDS).toHaveLength(5);
  });

  it("标注和 solver 算出来的最短解步数一致(抽样 30 关,含 100 / 145 / 188)", () => {
    const sample = [1, 100, 145, 188];
    for (let n = 6; sample.length < 30; n += 7) sample.push(Math.min(TOTAL, n));
    for (const n of sample) {
      const def = getLevel(n - 1);
      const res = solve(def, { nodeCap: 200_000 });
      expect(res.solved, `第 ${n} 关解不出来`).toBe(true);
      expect(def.bestPushes, `第 ${n} 关标注的推箱次数对不上`).toBe(res.pushes);
      expect(difficultyOfLevel(def).stars).toBe(difficultyOf(res.pushes).stars);
    }
    expect(sample.length).toBeGreaterThanOrEqual(30);
  });

  it("设计上的难度曲线一档一档升,不跳崖", () => {
    const curve = Array.from({ length: TOTAL }, (_, i) => plannedDifficulty(i));
    expect(curve[0]).toBe(1);
    expect(curve[TOTAL - 1]).toBe(5);
    expect(curveIsSmooth(curve)).toBe(true);
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
  });

  it("跳崖的曲线会被 curveIsSmooth 抓出来", () => {
    expect(curveIsSmooth([1, 1, 2, 3, 3])).toBe(true);
    expect(curveIsSmooth([1, 1, 4])).toBe(false);
  });

  it("难度小标签是五颗星的形状,读得懂", () => {
    const badge = difficultyBadge({ bestPushes: 12 });
    expect(badge.startsWith("★★★☆☆")).toBe(true);
    expect(badge).toContain("动脑");
  });

  it("后半程的平均难度不低于前半程", () => {
    const head: number[] = [];
    const tail: number[] = [];
    for (let lv = 0; lv < 40; lv += 8) head.push(difficultyOfLevel(getLevel(lv)).stars);
    for (let lv = TOTAL - 40; lv < TOTAL; lv += 8) tail.push(difficultyOfLevel(getLevel(lv)).stars);
    const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(tail)).toBeGreaterThanOrEqual(avg(head));
  });
});

describe("box-hamster 1.2 · 无尽仓库的生成保护", () => {
  it("正常情况下第一次就造出一张能推完的仓", () => {
    const res = makeEndlessRoom({ round: 4 });
    expect(res.tries).toBe(1);
    expect(res.fellBack).toBe(false);
    expect(roomIsPlayable(res.def)).toBe(true);
    expect(res.round).toBe(4);
  });

  it("生成超时就退档重来,绝不会一直卡着", () => {
    let clock = 0;
    const res = makeEndlessRoom({
      round: 12,
      budgetMs: 50,
      now: () => (clock += 100),
      make: (r) => ({ ...buildEndless(0), index: r }) as ReturnType<typeof buildEndless>,
      verify: () => true,
      maxTries: 3,
    });
    expect(res.tries).toBeGreaterThan(1);
    expect(res.fellBack).toBe(true);
    expect(res.round).toBeLessThan(12);
  });

  it("验不过的一张会被换掉", () => {
    const rounds: number[] = [];
    const res = makeEndlessRoom({
      round: 8,
      now: () => 0,
      make: (r) => {
        rounds.push(r);
        return { ...buildEndless(0), index: r } as ReturnType<typeof buildEndless>;
      },
      verify: (def) => def.index <= 2,
      maxTries: 4,
    });
    expect(rounds.length).toBeGreaterThan(1);
    expect(res.def.index).toBeLessThanOrEqual(2);
    expect(roomIsPlayable(res.def)).toBe(true);
  });

  it("怎么都验不过时兜底交出第 0 仓,而且它一定能推完", () => {
    const res = makeEndlessRoom({
      round: 6,
      now: () => 0,
      make: (r) => ({ ...buildEndless(0), index: r }) as ReturnType<typeof buildEndless>,
      verify: (def) => def.index === 0,
      maxTries: 2,
    });
    expect(res.fellBack).toBe(true);
    expect(roomIsPlayable(res.def)).toBe(true);
  });
});

describe("box-hamster 1.2 · 手感与清理", () => {
  it("推箱比走路慢一点,关了动效就压到一帧", () => {
    expect(moveDuration("walk", false)).toBe(120);
    expect(moveDuration("push", false)).toBe(160);
    expect(moveDuration("push", false)).toBeGreaterThan(moveDuration("walk", false));
    expect(moveDuration("push", false, true)).toBe(80);
    expect(moveDuration("push", true)).toBe(16);
  });

  it("仓鼠四个朝向各转 90 度,不会瞬转", () => {
    expect(facingAngle(0)).toBe(0);
    expect(facingAngle(1)).toBe(90);
    expect(facingAngle(2)).toBe(180);
    expect(facingAngle(3)).toBe(270);
  });

  it("撞墙的方向键会被标成走不动", () => {
    const p = parsePuzzle(["#####", "#@  #", "#   #", "#..$#", "#####"]);
    const dirs = usableDirs(p, initialState(p), 0);
    expect(dirs[0]).toBe(false);
    expect(dirs[3]).toBe(false);
    expect(dirs[1]).toBe(true);
    expect(dirs[2]).toBe(true);
  });

  it("destroy 里把监听和定时器都收干净了", () => {
    const src = readFileSync("src/games/box-hamster/index.ts", "utf8");
    expect(src).toContain('removeEventListener("keydown"');
    expect(src).toContain("clearTimeout");
  });
});
