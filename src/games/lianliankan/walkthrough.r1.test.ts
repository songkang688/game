/**
 * 连连看 · 窗口4 档A 第 1 轮测试员走查（不改玩法，只记录与断言）
 *
 * 剧本：首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 关 →
 * 无尽「连到底」玩到结算 → 360px 窄屏。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGames } from "../../engine/loader";
import { mulberry32 } from "../level99";
import {
  anyMove,
  applyGravity,
  createBoard,
  findPath,
  removePair,
  solveBoard,
  tilesLeft,
  type BoardSpec
} from "./board";
import { LEVELS, boardSeed, turnsOf } from "./levels";
import {
  CELL_GAP_PX,
  ENDLESS_FREE_ROUNDS,
  HINT_MAX,
  LINK_HOLD_MS,
  MIN_CELL_PX,
  PHONE_BOARD_W,
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
  fitsPhone,
  gridTemplate,
  hintPair,
  hintsLeft,
  linkHoldMs,
  linkInit,
  pathIsOrthogonal,
  starsFor,
  tapCell,
  timeUpWord,
  turnCount,
  winWord
} from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

function specOf(level: number): BoardSpec {
  const l = LEVELS[level];
  return { rows: l.rows, cols: l.cols, kinds: l.kinds, gravity: l.gravity, maxTurns: turnsOf(l) };
}

describe("连连看 · R1 · 从首页进入", () => {
  it("首页列得出这一款，动态加载能真的拿到 mount", async () => {
    const entry = loadGames().find((g) => g.meta.id === "lianliankan");
    expect(entry, "首页 loadGames() 里找不到 lianliankan").toBeTruthy();
    expect(entry!.meta.title).toBe("连连看");
    expect(entry!.meta.levels).toBe(LEVELS.length);
    expect(typeof (await entry!.load())).toBe("function");
  });

  it("meta.modes 声明的闯关 / 无尽在 index.ts 里都有真入口", () => {
    const entry = loadGames().find((g) => g.meta.id === "lianliankan");
    expect(entry!.meta.modes).toEqual(["campaign", "endless"]);
    expect(SRC).toContain("mountLevelGame(");
    expect(SRC).toContain("function mountEndless(");
    expect(SRC).toContain("recordEndlessBest(");
  });
});

describe("连连看 · R1 · 赢一次 + 输一次", () => {
  it("赢一次：第 1 关一路连到空盘，收场词只夸不挑刺", () => {
    const res = solveBoard(specOf(0), mulberry32(boardSeed(0)), { shuffles: LEVELS[0].shuffles });
    expect(res.cleared).toBe(true);
    expect(res.left).toBe(0);
    expect(res.moves).toBeGreaterThan(0);
    const w = winWord(42, 0);
    expect(w).toContain("42 秒");
    for (const bad of ["笨", "差", "太慢", "不行"]) expect(w).not.toContain(bad);
  });

  it("输一次：时间到就收工，说法只给方法不批评", () => {
    const w = timeUpWord();
    expect(w).toContain("时间到");
    expect(w).toMatch(/边角/);
    for (const bad of ["笨", "差", "输了", "不行", "失败"]) expect(w).not.toContain(bad);
  });

  it("用过提示照样夸，只是封顶两星", () => {
    expect(starsFor(100, 100, 0)).toBe(3);
    expect(starsFor(100, 100, 1)).toBe(2);
    expect(starsFor(10, 100, 1)).toBe(1);
    const w = winWord(30, 2);
    expect(w).toContain("2 次提示");
    for (const bad of ["笨", "差", "不行"]) expect(w).not.toContain(bad);
  });

  it("消除必须经过「画折线」这一相位，不许点两下直接不见", () => {
    const b = createBoard({ rows: 2, cols: 2, kinds: 1, gravity: "none", maxTurns: 2 }, mulberry32(1));
    const first = tapCell(b, linkInit(), 1, 1);
    expect(first.kind).toBe("select");
    const second = tapCell(b, first.state, 1, 2);
    expect(second.kind).toBe("link");
    expect(second.state.phase).toBe("linking");
    expect(second.path).toBeTruthy();
    expect(pathIsOrthogonal(second.path!)).toBe(true);
    expect(turnCount(second.path!)).toBeLessThanOrEqual(2);
    // 折线撑在屏幕上的时间落在规格的 180–260ms
    expect(linkHoldMs(false)).toBe(LINK_HOLD_MS);
    expect(LINK_HOLD_MS).toBeGreaterThanOrEqual(180);
    expect(LINK_HOLD_MS).toBeLessThanOrEqual(260);
    // 动画相位里再点都不理，防连点竞态
    expect(tapCell(b, second.state, 2, 1).kind).toBe("ignore");
  });
});

describe("连连看 · R1 · 战役第 1 / 100 / 188 关", () => {
  for (const lv of [0, 99, 187]) {
    it(`第 ${lv + 1} 关：自动玩家能把整块棋盘连干净`, () => {
      const l = LEVELS[lv];
      const res = solveBoard(specOf(lv), mulberry32(boardSeed(lv)), {
        shuffles: l.shuffles,
        autoShuffleFree: l.autoShuffleFree,
        rotateEveryMoves: l.rotateMs ? 4 : 0
      });
      expect(res.cleared, `第 ${lv + 1} 关还剩 ${res.left} 块`).toBe(true);
      expect((l.rows * l.cols) % 2).toBe(0);
      expect(l.kinds * 2).toBeLessThanOrEqual(l.rows * l.cols);
    });
  }

  it("每关都有 3 次真求解提示，用完就没了", () => {
    expect(HINT_MAX).toBe(3);
    expect(hintsLeft(0)).toBe(3);
    expect(hintsLeft(3)).toBe(0);
    expect(hintsLeft(9)).toBe(0);
    for (const lv of [0, 99, 187]) {
      const l = LEVELS[lv];
      const b = createBoard(specOf(lv), mulberry32(boardSeed(lv)));
      const pair = hintPair(b, turnsOf(l));
      expect(pair, `第 ${lv + 1} 关开局就提示不出东西`).not.toBeNull();
      // 提示给的一定是真连得上的一对
      expect(findPath(b, pair![0], pair![1], turnsOf(l))).not.toBeNull();
    }
  });

  it("第 188 关是四方重力场的最后一关：只准拐一次弯，收拢照样有得连", () => {
    const l = LEVELS[187];
    expect(turnsOf(l)).toBe(1);
    expect(l.autoShuffleFree).toBe(true);
    const b = createBoard(specOf(187), mulberry32(boardSeed(187)));
    const pair = anyMove(b, 1);
    expect(pair).not.toBeNull();
    removePair(b, pair![0], pair![1]);
    const moves = applyGravity(b, l.gravity);
    expect(Array.isArray(moves)).toBe(true);
    expect(tilesLeft(b)).toBe(l.rows * l.cols - 2);
  });
});

describe("连连看 · R1 · 无尽「连到底」玩到结算", () => {
  it("清完一盘自动补新盘，40 盘连下来一次都没卡死", () => {
    let st = endlessInit();
    const rand = mulberry32(7);
    for (let round = 1; round <= 40; round++) {
      const res = solveBoard(endlessSpec(round), rand, { shuffles: 0, autoShuffleFree: true, autoShuffleCap: 300 });
      expect(res.cleared, `第 ${round} 盘卡住了，还剩 ${res.left} 块`).toBe(true);
      for (let i = 0; i < res.moves; i++) st = endlessPair(st);
      st = endlessNext(st);
    }
    expect(st.round).toBe(41);
    expect(st.pairs).toBeGreaterThan(500);
    expect(st.over).toBe(false);
  });

  it("时间到就收工（真结算），收场词只夸不挑刺", () => {
    let st = endlessPair(endlessPair(endlessInit()));
    st = endlessTimeUp(st);
    expect(st.over).toBe(true);
    // 收工之后再连也不动
    expect(endlessPair(st)).toEqual(st);
    expect(endlessNext(st)).toEqual(st);
    for (const best of [0, 999]) {
      const w = endlessWord(st, best);
      for (const bad of ["笨", "差", "输了", "不行"]) expect(w).not.toContain(bad);
    }
  });

  it("前 3 盘不限时热身，之后越来越紧但有下限", () => {
    for (let r = 1; r <= ENDLESS_FREE_ROUNDS; r++) expect(endlessSeconds(r)).toBe(0);
    expect(endlessSeconds(ENDLESS_FREE_ROUNDS + 1)).toBeGreaterThan(0);
    expect(endlessSeconds(1000)).toBe(45);
  });

  it("每一档变难都有一句人话说清楚变在哪", () => {
    expect(endlessStepWord(1)).toContain("热热身");
    const words = Array.from({ length: 20 }, (_, i) => endlessStepWord(i + 1));
    for (const w of words) expect(w.length).toBeGreaterThan(0);
    // 图案封顶 14 种，拐弯数从第 13 盘起收到 1
    expect(endlessKinds(1000)).toBe(14);
    expect(endlessSpec(13).maxTurns).toBe(1);
    expect(endlessSpec(12).maxTurns).toBe(2);
  });

  it("四种收拢方向在无尽里都轮得到", () => {
    const seen = new Set(Array.from({ length: 20 }, (_, i) => endlessSpec(i + 1).gravity));
    expect(seen.has("none")).toBe(true);
    expect(seen.has("down")).toBe(true);
    expect(seen.has("left")).toBe(true);
    expect(seen.has("center")).toBe(true);
  });

  it("空盘判定准确：连完最后一对就该补新盘", () => {
    const b = createBoard({ rows: 2, cols: 2, kinds: 1, gravity: "none", maxTurns: 2 }, mulberry32(1));
    expect(boardCleared(b)).toBe(false);
    while (tilesLeft(b) > 0) {
      const pair = anyMove(b, 2);
      expect(pair).not.toBeNull();
      removePair(b, pair![0], pair![1]);
    }
    expect(boardCleared(b)).toBe(true);
  });
});

describe("连连看 · R1 · 360px 窄屏", () => {
  it("188 关每一关都塞得进 360px，而且每格不小于 32px", () => {
    const narrow: string[] = [];
    LEVELS.forEach((l, i) => {
      if (!fitsPhone(l.cols)) narrow.push(`第 ${i + 1} 关 ${l.cols} 列只有 ${cellSizePx(l.cols).toFixed(1)}px`);
    });
    expect(narrow).toEqual([]);
    expect(MIN_CELL_PX).toBe(32);
    expect(PHONE_BOARD_W).toBeLessThanOrEqual(360);
  });

  it("最宽的 8 列关也够 32px（这是最紧的一档）", () => {
    const widest = Math.max(...LEVELS.map((l) => l.cols));
    expect(widest).toBe(8);
    expect(cellSizePx(widest)).toBeGreaterThanOrEqual(MIN_CELL_PX);
    expect(cellSizePx(widest) * widest + CELL_GAP_PX * (widest + 1)).toBeLessThanOrEqual(PHONE_BOARD_W);
  });

  it("棋盘两头的空边只占窄窄一截，不吃真格子的宽度", () => {
    expect(gridTemplate(8)).toBe("0.45fr repeat(8, 1fr) 0.45fr");
  });

  it("按钮热区不小于 44px", () => {
    const hits = (SRC.match(/min-height:\s*44px/g) ?? []).length;
    expect(hits).toBeGreaterThanOrEqual(1);
  });
});

describe("连连看 · R1 · 动效与减弱动效", () => {
  it("关掉动效时状态机还是那套，只是折线只闪一帧、收拢不滑", () => {
    expect(linkHoldMs(true)).toBeLessThan(linkHoldMs(false));
    expect(clearMs(true)).toBeLessThan(clearMs(false));
    expect(collapseMs(6, true)).toBe(0);
    expect(collapseMs(6, false)).toBeGreaterThan(0);
  });

  it("收拢时长每格 60–80ms，且有封顶", () => {
    expect(collapseMs(1)).toBeGreaterThanOrEqual(60);
    expect(collapseMs(1)).toBeLessThanOrEqual(80);
    expect(collapseMs(1000)).toBe(collapseMs(2000));
  });
});

describe("连连看 · R1 · 分级红线", () => {
  it("音效只走平台的 api.play，没有自己造 AudioContext", () => {
    expect(SRC).not.toContain("AudioContext");
    expect(SRC).not.toContain("new Audio");
  });

  it("没有引入 three.js / CDN / Socket，也没有联网请求", () => {
    for (const bad of ["three", "socket", "fetch(", "XMLHttpRequest", "http://", "https://"]) {
      expect(SRC.toLowerCase()).not.toContain(bad.toLowerCase());
    }
  });
});
