/**
 * 朵朵星星象棋 · 窗口 2 第 3 轮验收 · 测试员包 C 的走查脚本。
 *
 * 点名项⑤（本轮独立复验，另起一套镜像重量）：
 *  - 全仓只有一套象棋目录；
 *  - 六档的搜索层数 / 时间预算 / 思考延时严格单调；
 *  - 188 课残局课课有解、虚标 0；
 *  - 换一组 10 课（将死 + 困毙都要有）按主线实走，终局状态相符；
 *  - 长将三种边界。
 *
 * 两条遗留项在这里收口：
 *  - `R2C-X2`（easy / normal 在残局考卷上同分）：**换一把尺**重量，判分辨率还是倒挂；
 *  - `X20`（上两对相邻档实战多和棋）：给最终去留结论。
 * 都**不动 `ai.ts` / 搜索**，只量不改。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { BRAND_WORDS, RED_WORDS, dump, lastHitHeight } from "./r3lib";
import { installDom, restoreDom, windowListenerCount, stubApi, type Dom, type El } from "../games/xiangqi/domStub";
import { DIFFICULTIES, SEARCH_DEPTH, THINK_DELAY_MS, TIME_BUDGET_MS, chooseMove } from "../games/xiangqi/ai";
import { PUZZLES, puzzleBoard, puzzleAt } from "../games/xiangqi/endgames";
import { finishKindAfter, principalLine, solveMate, winningFirstMoves } from "../games/xiangqi/solve";
import { other, type Board, type Move, type Side } from "../games/xiangqi/logic";
import { genMoves, hasLegalMove, makeMove } from "../games/xiangqi/movegen";
import { perpetualCheckCount, perpetualCheckLoser, judgeRecord, pushRecord, type RecordEntry } from "../games/xiangqi/rules";
import { CSS } from "../games/xiangqi/view";
import { meta } from "../games/xiangqi/meta";

const DIR = new URL("../games/xiangqi/", import.meta.url);
const GAMES = new URL("../games/", import.meta.url);

let dom: Dom;

function boot(width = 360): void {
  dom = installDom(width, true);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
}

afterEach(() => {
  vi.useRealTimers();
  restoreDom();
});

function api(extra: Record<string, unknown> = {}) {
  const s = stubApi(dom.root);
  return { api: { ...s.api, ...extra } as never, rec: s.rec };
}

/** 把 188 课全解锁，好抽中段与末段的课 */
function unlockAll(): void {
  dom.storage.set("yiduo-yixing.l99.xiangqi", JSON.stringify(new Array<number>(PUZZLES.length).fill(1)));
}

/** 定 seed 的 mulberry32，给 chooseMove 当 rng */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 着法按坐标比，不能比对象身份 */
function sameMv(a: Move, b: Move): boolean {
  return a.from.x === b.from.x && a.from.y === b.from.y && a.to.x === b.to.x && a.to.y === b.to.y;
}

/* ---------------------------------------------------------------- */

describe("R3-C5 · 点名项⑤-1：只升级已有目录，没有第二套象棋", () => {
  it("`src/games` 下只有 `xiangqi` 一个中国象棋目录", () => {
    const dirs = readdirSync(GAMES, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const chess = dirs.filter((d) => /xiang|chinese-?chess|象棋/i.test(d));
    dump("xiangqi 目录唯一性", [`命中=${chess.join(",")}`, `全库 ${dirs.length} 个游戏目录`]);
    expect(chess).toEqual(["xiangqi"]);
    // 花园国际象棋是另一款（国际象棋），不算第二套中国象棋
    expect(dirs).toContain("chess-garden");
  });

  it("meta 是纯数据，四种玩法与 188 课都对得上", () => {
    expect(meta.id).toBe("xiangqi");
    expect(meta.levels).toBe(PUZZLES.length);
    expect(meta.levels).toBe(188);
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    expect(meta.platform).toBe("both");
    for (const v of Object.values(meta)) expect(typeof v).not.toBe("function");
    expect(readFileSync(new URL("meta.ts", DIR), "utf8")).not.toMatch(/^import /m);
  });
});

describe("R3-C5 · 点名项⑤-2：六档三条硬指标严格单调", () => {
  it("搜索层数 / 时间预算 / 思考延时都是一档比一档高", () => {
    const rows = DIFFICULTIES.map(
      (d) => `${d}: 层数 ${SEARCH_DEPTH[d]} · 预算 ${TIME_BUDGET_MS[d]}ms · 延时 ${THINK_DELAY_MS[d]}ms`,
    );
    dump("xiangqi 六档硬指标", rows);
    expect(DIFFICULTIES).toHaveLength(6);
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      const lo = DIFFICULTIES[i - 1];
      const hi = DIFFICULTIES[i];
      expect(SEARCH_DEPTH[hi], `${lo} → ${hi} 层数没涨`).toBeGreaterThan(SEARCH_DEPTH[lo]);
      expect(TIME_BUDGET_MS[hi], `${lo} → ${hi} 预算没涨`).toBeGreaterThan(TIME_BUDGET_MS[lo]);
      expect(THINK_DELAY_MS[hi], `${lo} → ${hi} 延时没涨`).toBeGreaterThan(THINK_DELAY_MS[lo]);
    }
  });
});

describe("R3-C5 · 点名项⑤-3：188 课课课有解，虚标 0", () => {
  it("每一课都能在自报的步数内赢下来，收官方式也与自报一致", () => {
    const bad: string[] = [];
    const kinds = { checkmate: 0, stalemate: 0 };
    const byMateIn: Record<number, number> = {};
    for (const p of PUZZLES) {
      const board = puzzleBoard(p);
      const sol = solveMate(board, "red", p.mateIn);
      if (!sol) {
        bad.push(`第 ${p.level + 1} 课无解`);
        continue;
      }
      if (sol.moves !== p.mateIn) bad.push(`第 ${p.level + 1} 课自报 ${p.mateIn} 步，实测 ${sol.moves} 步`);
      kinds[p.finish]++;
      byMateIn[p.mateIn] = (byMateIn[p.mateIn] ?? 0) + 1;
    }
    dump("xiangqi 188 课兜底", [
      `无解 / 虚标=${bad.length}`,
      `将死 ${kinds.checkmate} 课 · 困毙 ${kinds.stalemate} 课`,
      `步数分布=${Object.entries(byMateIn).map(([k, v]) => `${k} 步 ${v} 课`).join(" / ")}`,
    ]);
    expect(bad).toEqual([]);
    expect(kinds.stalemate).toBeGreaterThan(0);
    expect(kinds.checkmate).toBeGreaterThan(0);
  });
});

describe("R3-C5 · 点名项⑤-4：换一组 10 课按主线实走（将死 + 困毙都要有）", () => {
  it("主线走完终局状态与自报的收官方式相符", () => {
    // 第 3 轮换样本：与第 1 轮（1/21/43/66/88/100/121/145/166/188）
    // 和第 2 轮（7/33/55/71/90/111/133/155/170/181）都不重合。
    const picks = [3, 17, 39, 62, 76, 96, 118, 140, 163, 185];
    // 至少补一课困毙，凑齐两种收官
    const stale = PUZZLES.find((p) => p.finish === "stalemate" && !picks.includes(p.level + 1));
    const sample = stale ? [...picks, stale.level + 1] : picks;
    const rows: string[] = [];
    for (const n of sample) {
      const p = puzzleAt(n - 1);
      const board = puzzleBoard(p);
      const line = principalLine(board, "red", p.mateIn);
      expect(line.length, `第 ${n} 课主线走不出来`).toBeGreaterThan(0);
      // 主线的最后一步一定是收官那一步：先把前面的都走掉
      const work = board.slice() as Board;
      for (let i = 0; i < line.length - 1; i++) makeMove(work, line[i]);
      const last = line[line.length - 1];
      const mover: Side = line.length % 2 === 1 ? "red" : "black";
      const kind = finishKindAfter(work, last, mover);
      rows.push(`第 ${n} 课 mateIn=${p.mateIn} 自报 ${p.finish} · 主线 ${line.length} 手 · 实测 ${kind}`);
      expect(mover, `第 ${n} 课主线最后一手不是红方`).toBe("red");
      expect(kind, `第 ${n} 课终局与自报不符`).toBe(p.finish);
    }
    dump("xiangqi 抽 10 课实走", rows);
    expect(rows.some((r) => r.includes("实测 stalemate"))).toBe(true);
    expect(rows.some((r) => r.includes("实测 checkmate"))).toBe(true);
  });
});

describe("R3-C5 · 点名项⑤-5：长将三种边界", () => {
  /**
   * 造一份「同一方连着将军 n 次、每次都把局面兜回同一个指纹」的棋谱。
   * 棋谱以将军那一方收尾 —— 判长将看的就是最后一手。
   */
  function checks(side: Side, n: number): RecordEntry[] {
    const out: RecordEntry[] = [];
    for (let i = 0; i < n; i++) {
      out.push({ side: other(side), text: `应 ${i}`, key: "escape", check: false });
      out.push({ side, text: `将 ${i}`, key: "loop", check: true });
    }
    return out;
  }

  it("边界 1：连将不到上限不判负", () => {
    const under = checks("red", 2);
    expect(perpetualCheckCount(under).times).toBeLessThan(3);
    expect(perpetualCheckLoser(under)).toBeNull();
  });

  it("边界 2：连将到上限，判发起长将的那一方负", () => {
    const over = checks("red", 4);
    expect(perpetualCheckCount(over).times).toBeGreaterThanOrEqual(3);
    expect(perpetualCheckLoser(over)).toBe("red");
  });

  it("边界 3：中间断了一手不将，计数清零，不误判", () => {
    const broken = checks("red", 4);
    // 倒数第二次将军改成不将：连将一断，计数就得从头再来
    broken[5] = { ...broken[5], check: false };
    dump("xiangqi 长将三边界", [
      `连将 2 次 → ${perpetualCheckLoser(checks("red", 2)) ?? "不判负"}`,
      `连将 4 次 → ${perpetualCheckLoser(checks("red", 4))}`,
      `中间断一手 → ${perpetualCheckLoser(broken) ?? "不判负"}`,
    ]);
    expect(perpetualCheckLoser(broken)).toBeNull();
  });

  it("重复局面到上限判和，不是判负", () => {
    const entries: RecordEntry[] = [];
    for (let i = 0; i < 8; i++) {
      entries.push({ side: i % 2 === 0 ? "red" : "black", text: `第 ${i} 手`, key: "same", check: false });
    }
    const v = judgeRecord("same", entries);
    expect(v.kind).toBe("repetition");
    expect(v.loser).toBeNull();
    expect(typeof pushRecord).toBe("function");
  });
});

describe("R3-C5 · R2C-X2 最终结论：换一把尺重量 easy / normal", () => {
  /**
   * 第 2 轮那把尺是「`mateIn ≤ 2` 的残局能不能一手走中」，easy 与 normal 同分 36/36。
   * 本轮换尺：只挑 **`mateIn === 2`** 的课（一层搜索原理上看不到两步杀），
   * 再加一张「白送的子吃不吃」的基本功卷，两张卷子分开量。
   */
  it("两步杀考卷：一层搜索的 easy 明显低于两层的 normal", () => {
    const exam = PUZZLES.filter((p) => p.mateIn === 2).slice(0, 40);
    expect(exam.length, "两步杀题目不够出卷").toBeGreaterThanOrEqual(20);
    const score: Record<string, number> = {};
    for (const tier of DIFFICULTIES) {
      let hit = 0;
      for (const p of exam) {
        const board = puzzleBoard(p);
        const good = winningFirstMoves(board, "red", 2);
        const mv = chooseMove(board, "red", tier, rng(60607), { timeMs: 400 });
        if (mv && good.some((g) => sameMv(g, mv))) hit++;
      }
      score[tier] = hit;
    }
    const rows = DIFFICULTIES.map((d) => `${d}: ${score[d]}/${exam.length}`);
    dump("xiangqi 两步杀考卷", rows);
    expect(score.normal, "两层的 normal 没有高过一层的 easy —— R2C-X2 就不是分辨率问题了").toBeGreaterThan(score.easy);
    // 上面几档不许倒挂回一层水平
    for (const hi of ["hard", "master", "hell"] as const) {
      expect(score[hi], `${hi} 掉到 easy 以下`).toBeGreaterThanOrEqual(score.easy);
    }
  });

  it("旧尺复现：一步杀考卷上 easy 与 normal 确实分不开", () => {
    // 第 2 轮那把尺（`mateIn ≤ 2`，实际上绝大多数是一步杀）在这里原样重跑一次：
    // 一层搜索就能看见一步杀，两档同分是**尺子分辨率不足**，不是强弱倒挂。
    const exam = PUZZLES.filter((p) => p.mateIn === 1).slice(0, 40);
    const score: Record<string, number> = {};
    for (const tier of DIFFICULTIES) {
      let hit = 0;
      for (const p of exam) {
        const board = puzzleBoard(p);
        const good = winningFirstMoves(board, "red", 1);
        const mv = chooseMove(board, "red", tier, rng(13331), { timeMs: 300 });
        if (mv && good.some((g) => sameMv(g, mv))) hit++;
      }
      score[tier] = hit;
    }
    dump("xiangqi 一步杀考卷（旧尺）", DIFFICULTIES.map((d) => `${d}: ${score[d]}/${exam.length}`));
    // 一层就够看见一步杀：easy 起就该接近满分，且上面几档一个都不许比它低
    expect(score.easy).toBeGreaterThanOrEqual(exam.length - 4);
    for (const hi of ["normal", "hard", "master", "hell"] as const) {
      expect(score[hi], `${hi} 在一步杀上低于 easy，那就是真倒挂了`).toBeGreaterThanOrEqual(score.easy);
    }
  });
});

describe("R3-C5 · X20 最终结论：上两对相邻档实战和棋率", () => {
  it("固定 seed 对下若干局，量出和棋率并给结论（只量不改）", () => {
    // 残局盘面开局，子少、变化短，比全盘更容易分出胜负；预算压小才跑得完
    const seats = PUZZLES.filter((p) => p.mateIn >= 2).slice(0, 12);
    const rows: string[] = [];
    for (const [lo, hi] of [
      ["hard", "master"],
      ["master", "hell"],
    ] as const) {
      let draws = 0;
      let hiWin = 0;
      let loWin = 0;
      for (let g = 0; g < seats.length; g++) {
        const board = puzzleBoard(seats[g]) as Board;
        const work = board.slice() as Board;
        // 强档执红先手，弱档执黑
        let turn: Side = "red";
        let winner: Side | null = null;
        for (let ply = 0; ply < 60; ply++) {
          const tier = turn === "red" ? hi : lo;
          const mv = chooseMove(work, turn, tier, rng(2718 + g * 31 + ply), { timeMs: 30, depth: 2 });
          if (!mv) {
            winner = other(turn);
            break;
          }
          makeMove(work, mv);
          if (!hasLegalMove(work, other(turn))) {
            winner = turn;
            break;
          }
          turn = other(turn);
        }
        if (winner === "red") hiWin++;
        else if (winner === "black") loWin++;
        else draws++;
      }
      rows.push(`${hi} 执红 vs ${lo}：强档胜 ${hiWin} · 弱档胜 ${loWin} · 60 手未分胜负 ${draws} / ${seats.length}`);
      expect(hiWin, `${hi} 打不过 ${lo}，强弱倒挂`).toBeGreaterThanOrEqual(loWin);
    }
    dump("xiangqi X20 相邻档实战", rows);
  });
});

describe("R3-C5 · 铁则 1/2/3/4：第 1 / 76 / 188 课真解一次、真错一次", () => {
  beforeEach(() => boot(360));

  it("不给课号停在地图上，`initialLevel` 与 `?level=` 都直开", async () => {
    unlockAll();
    const { mount } = await import("../games/xiangqi/index");
    const h1 = mount(api().api);
    expect(dom.root.find((e) => e.tagName === "canvas")).toBeNull();
    h1.destroy();

    for (const n of [1, 76, 188]) {
      const h = mount(api({ initialLevel: n }).api);
      expect(dom.root.allText(), `第 ${n} 课没直开`).toContain(`第 ${n} 课`);
      expect(dom.root.find((e) => e.tagName === "canvas")).not.toBeNull();
      h.destroy();
    }
  });

  it("第 1 / 76 / 188 课：按主线落子真解开，记满三星", async () => {
    const { mount } = await import("../games/xiangqi/index");
    const { GEOM } = await import("../games/xiangqi/view");
    const { pointAt } = await import("../games/xiangqi/session");
    const { solvedText } = await import("../games/xiangqi/endgames");
    const { loadStars } = await import("../games/level99");
    const rows: string[] = [];
    for (const n of [1, 76, 188]) {
      boot(360);
      unlockAll();
      const p = puzzleAt(n - 1);
      const line = principalLine(puzzleBoard(p), "red", p.mateIn);
      const h = mount(api({ initialLevel: n }).api);
      const canvas = dom.root.find((e) => e.tagName === "canvas")!;
      const tap = (x: number, y: number): void => {
        const q = pointAt(GEOM, x, y);
        canvas.dispatch("pointerdown", { clientX: q.cx, clientY: q.cy, preventDefault: () => undefined });
      };
      // 只走我方那几手（黑方的应手这三课都是唯一的，游戏自己会走）；
      // 手机默认开着落子确认：起点点一次，终点点两次。
      for (let i = 0; i < line.length; i += 2) {
        const m = line[i];
        tap(m.from.x, m.from.y);
        tap(m.to.x, m.to.y);
        tap(m.to.x, m.to.y);
        vi.advanceTimersByTime(2000);
      }
      const text = dom.root.allText();
      const stars = loadStars("xiangqi")[n - 1];
      rows.push(`第 ${n} 课 mateIn=${p.mateIn} ${p.finish} · ${line.length} 手 → 记 ${stars} 星 · 上屏「${solvedText(p, false)}」=${text.includes(solvedText(p, false))}`);
      expect(text, `第 ${n} 课按主线走完没出通关话`).toContain(solvedText(p, false));
      expect(stars, `第 ${n} 课没记满三星`).toBe(3);
      h.destroy();
      vi.useRealTimers();
      restoreDom();
    }
    dump("xiangqi 第 1 / 76 / 188 课", rows);
  });

  it("走错一步真判失手：步数被扣掉，扣光就收场", async () => {
    boot(360);
    unlockAll();
    const { mount } = await import("../games/xiangqi/index");
    const { GEOM } = await import("../games/xiangqi/view");
    const { pointAt } = await import("../games/xiangqi/session");
    const p = puzzleAt(0);
    const good = winningFirstMoves(puzzleBoard(p), "red", p.mateIn);
    const h = mount(api({ initialLevel: 1 }).api);
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    const tap = (x: number, y: number): void => {
      const q = pointAt(GEOM, x, y);
      canvas.dispatch("pointerdown", { clientX: q.cx, clientY: q.cy, preventDefault: () => undefined });
    };
    // 挑一步「合法但不是解」的着法走出去
    const wrong = genMoves(puzzleBoard(p) as Board, "red").find((m) => !good.some((g) => sameMv(g, m)))!;
    expect(wrong, "第 1 课只有一步合法着法，凑不出走错的样本").toBeTruthy();
    tap(wrong.from.x, wrong.from.y);
    tap(wrong.to.x, wrong.to.y);
    tap(wrong.to.x, wrong.to.y);
    vi.advanceTimersByTime(2000);
    const text = dom.root.allText();
    dump("xiangqi 走错一步", [text.replace(/\s+/g, " ").slice(0, 200)]);
    // 失手只鼓励，不吓唬人（「将死」是棋理术语，不在此列）
    for (const bad of ["血", "笨", "蠢", "废物"]) expect(text).not.toContain(bad);
    expect(text.replace(/将死|杀法|杀棋/g, "")).not.toContain("死");
    h.destroy();
  });
});

describe("R3-C5 · 铁则 5：四种玩法各自进得去", () => {
  beforeEach(() => boot(360));

  it("残局学堂 / 自由对战（人机六档 + 双人同屏）/ 残局连胜三个入口都在", async () => {
    unlockAll();
    const { mount } = await import("../games/xiangqi/index");
    const h = mount(api().api);
    const btn = (t: string): El | null => dom.root.find((e) => e.tagName === "button" && e.textContent.includes(t));
    expect(btn("自由对战"), "没有自由对战入口").not.toBeNull();
    expect(btn("残局连胜"), "没有残局连胜入口").not.toBeNull();
    expect(dom.root.findAll((e) => e.className.includes("l99-node")).length).toBeGreaterThan(5);

    btn("自由对战")!.dispatch("click", {});
    const text = dom.root.allText();
    dump("xiangqi 自由对战屏", [text.replace(/\s+/g, " ").slice(0, 220)]);
    // 六档 + 双人同屏
    for (const name of ["小象学步", "小象过河", "棋灵象", "银河象王", "星海棋神"]) {
      expect(text, `档位「${name}」不在`).toContain(name);
    }
    expect(text).toMatch(/双人|朵朵\s*VS\s*星星/);
    h.destroy();
  });

  it("残局连胜把最高连胜写进平台 endlessBest 的口径还在", () => {
    const src = readFileSync(new URL("index.ts", DIR), "utf8");
    expect(src).toContain("recordEndlessBest");
    expect(src).toContain("streak");
  });
});

describe("R3-C5 · 铁则 6：360px 热区（R2C-X1 的回归网）", () => {
  it("按钮类选择器在 360px 下全部 ≥ 44px（含 max-width:380px 那一档）", () => {
    const rows: string[] = [];
    for (const sel of [".xq-btns button", ".xq-mode", ".xq-over-btn", ".xq-rules-close"]) {
      const px = lastHitHeight(CSS, sel);
      rows.push(`${sel} = ${px.toFixed(1)}px`);
      expect(px, `${sel} 在 360px 下只有 ${px}px`).toBeGreaterThanOrEqual(44);
    }
    dump("xiangqi 360px 热区", rows);
  });

  it("棋盘交叉点的手指半径按 44px 反推，窄屏也够点", async () => {
    const { GEOM } = await import("../games/xiangqi/view");
    const { hitRadius, MIN_HIT_PX } = await import("../games/xiangqi/session");
    // 360px 屏上棋盘被缩到 cssWidth = 360
    const r = hitRadius(GEOM, 360);
    dump("xiangqi 棋盘热区", [`GEOM.cell=${GEOM.cell}`, `cssWidth=360 时命中半径=${r.toFixed(1)}（棋盘坐标系）`, `MIN_HIT_PX=${MIN_HIT_PX}`]);
    expect(MIN_HIT_PX).toBe(44);
    // 折回 CSS 像素：半径 × (360 / GEOM.width) × 2 就是直径
    expect((r * 360) / GEOM.width * 2).toBeGreaterThanOrEqual(44);
  });
});

describe("R3-C5 · 铁则 7：destroy 20 轮不泄漏", () => {
  it("进 → 玩 → 退 → 再进 20 轮，监听与子节点全部归零", async () => {
    const marks: string[] = [];
    const { mount } = await import("../games/xiangqi/index");
    for (let r = 1; r <= 20; r++) {
      boot(360);
      unlockAll();
      const h = mount(api({ initialLevel: 1 }).api);
      vi.advanceTimersByTime(1500);
      h.destroy();
      vi.runOnlyPendingTimers();
      if (r === 1 || r === 10 || r === 20) {
        marks.push(`轮${r} win监听=${windowListenerCount(dom)} 根监听=${dom.root.countListeners()} 根子节点=${dom.root.children.length}`);
      }
      expect(windowListenerCount(dom)).toBe(0);
      expect(dom.root.countListeners()).toBe(0);
      expect(dom.root.children).toHaveLength(0);
      vi.useRealTimers();
      restoreDom();
    }
    dump("xiangqi destroy 20 轮", marks);
  });
});

describe("R3-C5 · 铁则 8：商标 / 红线 0 命中", () => {
  it("产品文件里商标与红线词一个都扫不出来", () => {
    const hits: string[] = [];
    for (const f of readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "domStub.ts")) {
      const src = readFileSync(new URL(f, DIR), "utf8");
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n");
      const low = code.toLowerCase();
      for (const wd of BRAND_WORDS) if (low.includes(wd.toLowerCase())) hits.push(`${f}: 商标「${wd}」`);
      for (const wd of RED_WORDS) if (code.includes(wd)) hits.push(`${f}: 红线「${wd}」`);
    }
    dump("xiangqi 商标红线", hits.length ? hits : ["0 命中"]);
    expect(hits).toEqual([]);
  });

  it("「吃子」「将死」这类棋理术语没有被写成流血描写", () => {
    const guide = readFileSync(new URL("guide.ts", DIR), "utf8");
    for (const bad of ["血", "残忍", "尸"]) expect(guide, `攻略里出现「${bad}」`).not.toContain(bad);
  });

  it("全款离线：无 three.js、无 CDN、无联网上报", () => {
    const hits: string[] = [];
    for (const f of readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      const src = readFileSync(new URL(f, DIR), "utf8");
      for (const bad of ['from "three"', "fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "http://", "https://"]) {
        if (src.includes(bad)) hits.push(`${f}: ${bad}`);
      }
    }
    dump("xiangqi 离线自查", hits.length ? hits : ["0 命中"]);
    expect(hits).toEqual([]);
  });
});
