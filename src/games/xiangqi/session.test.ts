import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "./ai";
import {
  DRAW_FULL_PIECES,
  DRAW_PLIES,
  DRAW_PLIES_SPARSE,
  DRAW_SPARSE_PIECES,
  ENDLESS_REASON,
  MIN_HIT_PX,
  TIER_LEVEL_BOUNDS,
  agreeAsk,
  aiAgreesDraw,
  confirmDefault,
  difficultyForLevel,
  drawPlyGate,
  drawRefusalLine,
  emptyPick,
  hitRadius,
  initialLevelOf,
  newAsk,
  newStreak,
  pickPoint,
  pointAt,
  streakPuzzle,
  streakStep,
  streakSummary,
  tapPoint,
  undoSteps,
  type PickState,
  type TapEnv,
} from "./session";
import { GEOM } from "./view";
import { TOTAL_LEVELS } from "../level99";

const AT = (x: number, y: number) => ({ x, y });

/** 默认环境：轮到我、确认落子开着、点的是空地 */
function env(over: Partial<TapEnv> = {}): TapEnv {
  return { confirm: true, myTurn: true, mine: false, legalTarget: false, ...over };
}

describe("确认落子默认开不开", () => {
  it("触摸屏一律开着（象棋子大，手机一碰就毁一盘）", () => {
    expect(confirmDefault({ coarsePointer: true })).toBe(true);
    expect(confirmDefault({ maxTouchPoints: 5 })).toBe(true);
    expect(confirmDefault({ coarsePointer: true, maxTouchPoints: 0 })).toBe(true);
  });

  it("鼠标点得准，默认关", () => {
    expect(confirmDefault({ coarsePointer: false, maxTouchPoints: 0 })).toBe(false);
  });

  it("什么都探测不到时按手机处理，宁可多点一下", () => {
    expect(confirmDefault({})).toBe(true);
  });
});

describe("点棋盘的状态机", () => {
  it("不是自己的回合，点哪儿都没反应", () => {
    const r = tapPoint(emptyPick(), AT(4, 9), env({ myTurn: false, mine: true }));
    expect(r.kind).toBe("ignore");
    expect(r.move).toBeNull();
  });

  it("点自己的子＝选中，再点同一个子＝取消", () => {
    const sel = tapPoint(emptyPick(), AT(4, 9), env({ mine: true }));
    expect(sel.kind).toBe("select");
    expect(sel.state.from).toEqual(AT(4, 9));
    const off = tapPoint(sel.state, AT(4, 9), env({ mine: true }));
    expect(off.kind).toBe("clear");
    expect(off.state.from).toBeNull();
  });

  it("点自己的另一个子＝换子，预览跟着清掉", () => {
    const first: PickState = { from: AT(4, 9), pending: AT(4, 8) };
    const r = tapPoint(first, AT(0, 9), env({ mine: true }));
    expect(r.kind).toBe("reselect");
    expect(r.state.from).toEqual(AT(0, 9));
    expect(r.state.pending).toBeNull();
  });

  it("确认开着：第一次点落点只出预览，第二次点同一处才落子", () => {
    const picked: PickState = { from: AT(4, 9), pending: null };
    const prev = tapPoint(picked, AT(4, 8), env({ legalTarget: true }));
    expect(prev.kind).toBe("preview");
    expect(prev.state.pending).toEqual(AT(4, 8));
    expect(prev.move).toBeNull();

    const go = tapPoint(prev.state, AT(4, 8), env({ legalTarget: true }));
    expect(go.kind).toBe("commit");
    expect(go.move).toEqual({ from: AT(4, 9), to: AT(4, 8) });
    // 落完子选择清空，不会连着走第二步
    expect(go.state.from).toBeNull();
    expect(go.state.pending).toBeNull();
  });

  it("预览着的时候点另一个合法落点＝换预览，不落子", () => {
    const s: PickState = { from: AT(4, 9), pending: AT(4, 8) };
    const r = tapPoint(s, AT(3, 9), env({ legalTarget: true }));
    expect(r.kind).toBe("movePreview");
    expect(r.state.pending).toEqual(AT(3, 9));
    expect(r.move).toBeNull();
  });

  it("确认关掉：点一次就走", () => {
    const s: PickState = { from: AT(4, 9), pending: null };
    const r = tapPoint(s, AT(4, 8), env({ confirm: false, legalTarget: true }));
    expect(r.kind).toBe("commit");
    expect(r.move).toEqual({ from: AT(4, 9), to: AT(4, 8) });
  });

  it("选中之后点去不了的地方＝要给一句解释，选中的子还留着", () => {
    const s: PickState = { from: AT(4, 9), pending: AT(4, 8) };
    const r = tapPoint(s, AT(0, 0), env());
    expect(r.kind).toBe("illegal");
    expect(r.state.from).toEqual(AT(4, 9));
    expect(r.state.pending).toBeNull();
  });

  it("什么都没选的时候点空地，安安静静什么都不做", () => {
    const r = tapPoint(emptyPick(), AT(0, 0), env());
    expect(r.kind).toBe("clear");
    expect(r.move).toBeNull();
  });

  it("整局走下来：选子 → 预览 → 确认，一步只会 commit 一次", () => {
    let s = emptyPick();
    const kinds: string[] = [];
    for (const [at, e] of [
      [AT(7, 7), env({ mine: true })],
      [AT(4, 7), env({ legalTarget: true })],
      [AT(4, 7), env({ legalTarget: true })],
    ] as Array<[{ x: number; y: number }, TapEnv]>) {
      const r = tapPoint(s, at, e);
      kinds.push(r.kind);
      s = r.state;
    }
    expect(kinds).toEqual(["select", "preview", "commit"]);
  });
});

describe("悔棋 / 求和要不要两边同意", () => {
  it("双人同屏：发起的时候还没同意，对方点头才算数", () => {
    const a = newAsk("undo", "red", true);
    expect(a.agreed).toBe(false);
    expect(agreeAsk(a, "black").agreed).toBe(true);
  });

  it("自己点自己的同意不算数", () => {
    const a = newAsk("draw", "red", true);
    expect(agreeAsk(a, "red").agreed).toBe(false);
  });

  it("人机对局不用问：对手是电脑，直接算同意", () => {
    expect(newAsk("undo", "red", false).agreed).toBe(true);
  });

  it("悔棋退几步：双人退一步，人机退两步（把电脑那一手也退回来）", () => {
    expect(undoSteps(true, 5)).toBe(1);
    expect(undoSteps(false, 5)).toBe(2);
    // 只走了一步就悔棋，退一步就到头
    expect(undoSteps(false, 1)).toBe(1);
    expect(undoSteps(true, 0)).toBe(0);
    expect(undoSteps(false, 0)).toBe(0);
  });

  it("电脑要子力咬得住、又下得够久才肯和棋", () => {
    expect(aiAgreesDraw(0, 60)).toBe(true);
    expect(aiAgreesDraw(-40, 40)).toBe(true);
    // 局面还占着上风，不和
    expect(aiAgreesDraw(600, 60)).toBe(false);
    // 刚开局就求和，不理
    expect(aiAgreesDraw(0, 8)).toBe(false);
  });
});

describe("求和门槛按盘面稀疏度放宽", () => {
  it("满盘还是 40 手，老口径一个数没动", () => {
    expect(drawPlyGate(32)).toBe(DRAW_PLIES);
    expect(drawPlyGate()).toBe(DRAW_PLIES);
    expect(drawPlyGate(DRAW_FULL_PIECES)).toBe(DRAW_PLIES);
    expect(aiAgreesDraw(0, 39, 32)).toBe(false);
    expect(aiAgreesDraw(0, 40, 32)).toBe(true);
  });

  it("残棋不必凑满 40 手：只剩十个子时 16 手就谈得动", () => {
    expect(drawPlyGate(DRAW_SPARSE_PIECES)).toBe(DRAW_PLIES_SPARSE);
    expect(drawPlyGate(4)).toBe(DRAW_PLIES_SPARSE);
    expect(aiAgreesDraw(0, 16, 6)).toBe(true);
    expect(aiAgreesDraw(0, 15, 6)).toBe(false);
    // 老门槛下这一局是谈不动的
    expect(aiAgreesDraw(0, 16)).toBe(false);
  });

  it("门槛随子数单调不降，中间没有台阶跳回去", () => {
    for (let n = 1; n < 40; n++) {
      expect(drawPlyGate(n)).toBeGreaterThanOrEqual(drawPlyGate(n - 1));
      expect(drawPlyGate(n)).toBeGreaterThanOrEqual(DRAW_PLIES_SPARSE);
      expect(drawPlyGate(n)).toBeLessThanOrEqual(DRAW_PLIES);
    }
  });

  it("子力差太大，多稀疏的残棋也不肯和", () => {
    expect(aiAgreesDraw(600, 99, 4)).toBe(false);
    expect(drawRefusalLine(600, 99, 4)).toContain("子力差");
  });

  it("坏数字不会把门槛算糊：NaN 一律按满盘、按不同意处理", () => {
    expect(drawPlyGate(Number.NaN)).toBe(DRAW_PLIES);
    expect(aiAgreesDraw(Number.NaN, 99, 4)).toBe(false);
    expect(aiAgreesDraw(0, Number.NaN, 4)).toBe(false);
    expect(drawRefusalLine(0, Number.NaN, 4)).not.toContain("NaN");
  });

  it("不肯和的时候说清楚差在哪儿，还差几手也报得出来", () => {
    const tooEarly = drawRefusalLine(0, 30, 32);
    expect(tooEarly).toContain("再下 10 手");
    expect(tooEarly).not.toContain("子力差");
    // 差一手也说「再下 1 手」，不会说 0 手
    expect(drawRefusalLine(0, 39, 32)).toContain("再下 1 手");
  });

  it("同意的时候不再多说一句拒绝的话", () => {
    expect(drawRefusalLine(0, 40, 32)).toBe("");
    expect(drawRefusalLine(0, 16, 6)).toBe("");
  });
});

describe("残局连胜", () => {
  it("为什么不做真·无尽：说得出理由", () => {
    expect(ENDLESS_REASON).toContain("象棋");
    expect(ENDLESS_REASON.length).toBeGreaterThan(20);
  });

  it("解对一课加一，最高连胜跟着涨", () => {
    let s = newStreak(0);
    s = streakStep(s, true);
    s = streakStep(s, true);
    s = streakStep(s, true);
    expect(s.wins).toBe(3);
    expect(s.best).toBe(3);
    expect(s.over).toBe(false);
  });

  it("错一次这一轮就结束，之后再喂也不涨", () => {
    let s = streakStep(streakStep(newStreak(0), true), false);
    expect(s.over).toBe(true);
    expect(s.wins).toBe(1);
    s = streakStep(s, true);
    expect(s.wins).toBe(1);
  });

  it("没打破纪录时最高连胜保持原样", () => {
    let s = newStreak(9);
    s = streakStep(s, true);
    expect(s.wins).toBe(1);
    expect(s.best).toBe(9);
  });

  it("历史最高是脏数据也不会崩", () => {
    expect(newStreak(Number.NaN).best).toBe(0);
    expect(newStreak(-4).best).toBe(0);
    expect(newStreak(3.6).best).toBe(4);
  });

  it("连胜抽题：都落在 0..187 之间，越连越靠后", () => {
    const seen: number[] = [];
    for (let i = 0; i < 60; i++) {
      const n = streakPuzzle(i, TOTAL_LEVELS);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(TOTAL_LEVELS);
      seen.push(n);
    }
    // 前十课的平均课号明显低于第五十课往后的
    const head = seen.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const tail = seen.slice(45, 55).reduce((a, b) => a + b, 0) / 10;
    expect(head).toBeLessThan(tail);
  });

  it("连胜抽题同样的输入永远给同样的题", () => {
    expect(streakPuzzle(7, TOTAL_LEVELS)).toBe(streakPuzzle(7, TOTAL_LEVELS));
    expect(streakPuzzle(Number.NaN, TOTAL_LEVELS)).toBe(streakPuzzle(0, TOTAL_LEVELS));
  });

  it("收尾话术：破纪录、没破纪录、一课没解都各有一句", () => {
    expect(streakSummary({ wins: 0, best: 5, over: true }, 5)).toContain("第一课");
    expect(streakSummary({ wins: 7, best: 7, over: true }, 5)).toContain("刷新纪录");
    expect(streakSummary({ wins: 3, best: 9, over: true }, 9)).toContain("还差 6 课");
  });
});

describe("level 映射到 AI 档", () => {
  it("六档均分 188 关，档位顺序不乱", () => {
    expect(TIER_LEVEL_BOUNDS.length).toBe(6);
    expect(TIER_LEVEL_BOUNDS[TIER_LEVEL_BOUNDS.length - 1]).toBe(TOTAL_LEVELS);
    const seen = DIFFICULTIES.map((_, i) => difficultyForLevel(i === 0 ? 0 : TIER_LEVEL_BOUNDS[i - 1]));
    expect(seen).toEqual([...DIFFICULTIES]);
  });

  it("分界线两侧刚好换档", () => {
    expect(difficultyForLevel(0)).toBe("novice");
    expect(difficultyForLevel(30)).toBe("novice");
    expect(difficultyForLevel(31)).toBe("easy");
    expect(difficultyForLevel(61)).toBe("easy");
    expect(difficultyForLevel(62)).toBe("normal");
    expect(difficultyForLevel(92)).toBe("normal");
    expect(difficultyForLevel(93)).toBe("hard");
    expect(difficultyForLevel(124)).toBe("hard");
    expect(difficultyForLevel(125)).toBe("master");
    expect(difficultyForLevel(155)).toBe("master");
    expect(difficultyForLevel(156)).toBe("hell");
    expect(difficultyForLevel(187)).toBe("hell");
  });

  it("越界与脏数据都 clamp 到首尾档", () => {
    expect(difficultyForLevel(-1)).toBe("novice");
    expect(difficultyForLevel(-999)).toBe("novice");
    expect(difficultyForLevel(9999)).toBe("hell");
    expect(difficultyForLevel(Number.NaN)).toBe("novice");
  });

  it("难度只升不降：从 0 走到 187 档位单调不回头", () => {
    let at = 0;
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const i = DIFFICULTIES.indexOf(difficultyForLevel(lv));
      expect(i).toBeGreaterThanOrEqual(at);
      at = i;
    }
    expect(at).toBe(5);
  });
});

describe("直开第 N 课", () => {
  it("认 api.initialLevel：课号是 1 基的，返回 0 基下标", () => {
    expect(initialLevelOf(1)).toBe(0);
    expect(initialLevelOf(12)).toBe(11);
    expect(initialLevelOf(188)).toBe(187);
  });

  it("认地址栏 ?level=N", () => {
    expect(initialLevelOf(undefined, "?level=30")).toBe(29);
    expect(initialLevelOf(undefined, "?from=home&level=7")).toBe(6);
  });

  it("认 hash 里的 level=N 和 #/xiangqi/N", () => {
    expect(initialLevelOf(undefined, "", "#level=5")).toBe(4);
    expect(initialLevelOf(undefined, "", "#/xiangqi/9")).toBe(8);
  });

  it("字符串形式的 initialLevel 也认", () => {
    expect(initialLevelOf("42")).toBe(41);
    expect(initialLevelOf(" 42 ")).toBe(41);
  });

  it("越界往两头 clamp，绝不越出 0..187", () => {
    expect(initialLevelOf(0)).toBe(0);
    expect(initialLevelOf(-30)).toBe(0);
    expect(initialLevelOf(9999)).toBe(TOTAL_LEVELS - 1);
    expect(initialLevelOf(undefined, "?level=99999")).toBe(TOTAL_LEVELS - 1);
  });

  it("什么都没给就返回 -1，照常回选课地图", () => {
    expect(initialLevelOf(undefined)).toBe(-1);
    expect(initialLevelOf(null, "", "")).toBe(-1);
    expect(initialLevelOf("abc")).toBe(-1);
    expect(initialLevelOf(undefined, "?stage=3")).toBe(-1);
    expect(initialLevelOf(Number.NaN)).toBe(-1);
  });

  it("api.initialLevel 优先于地址栏", () => {
    expect(initialLevelOf(5, "?level=100")).toBe(4);
  });
});

describe("交叉点热区", () => {
  it("交叉点坐标：左上角那个点就在 margin 上", () => {
    expect(pointAt(GEOM, 0, 0)).toEqual({ cx: GEOM.margin, cy: GEOM.margin });
    expect(pointAt(GEOM, 8, 9)).toEqual({
      cx: GEOM.margin + 8 * GEOM.cell,
      cy: GEOM.margin + 9 * GEOM.cell,
    });
  });

  it("点正中间当然命中", () => {
    const p = pointAt(GEOM, 4, 5);
    expect(pickPoint(GEOM, p.cx, p.cy, 22)).toEqual({ x: 4, y: 5 });
  });

  it("离得太远就不算，别替玩家瞎猜", () => {
    const p = pointAt(GEOM, 4, 5);
    expect(pickPoint(GEOM, p.cx + 30, p.cy + 30, 10)).toBeNull();
  });

  it("点到棋盘外面返回 null", () => {
    expect(pickPoint(GEOM, -50, -50, 30)).toBeNull();
    expect(pickPoint(GEOM, GEOM.width + 60, GEOM.height + 60, 30)).toBeNull();
  });

  it("360px 的手机上，热区折算回 CSS 像素也有 44px", () => {
    const cssWidth = 336; // 360 屏减掉两边留白
    const r = hitRadius(GEOM, cssWidth);
    const cssRadius = (r / GEOM.width) * cssWidth;
    expect(cssRadius * 2).toBeGreaterThanOrEqual(MIN_HIT_PX);
  });

  it("屏幕再宽热区也不小于半格，窄屏才往上撑", () => {
    expect(hitRadius(GEOM, 1200)).toBeGreaterThanOrEqual(GEOM.cell * 0.5);
    expect(hitRadius(GEOM, 300)).toBeGreaterThan(hitRadius(GEOM, 1200));
  });

  it("热区撑大之后，相邻交叉点还是分得开", () => {
    const r = hitRadius(GEOM, 336);
    const a = pointAt(GEOM, 3, 5);
    // 落在 3 号点和 4 号点正中间偏 3 号那一侧，仍旧判给 3 号
    expect(pickPoint(GEOM, a.cx + GEOM.cell * 0.4, a.cy, r)).toEqual({ x: 3, y: 5 });
    expect(pickPoint(GEOM, a.cx + GEOM.cell * 0.6, a.cy, r)).toEqual({ x: 4, y: 5 });
  });
});
