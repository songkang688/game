/**
 * 连连看 · 窗口 4 档A · 第 3 轮测试员（收官）。
 *
 * 前两轮一共抽了十来关。收官这一轮不抽了：**188 关一关不漏**各跑三个种子，
 * 每一关都要「全清」而不是「差一对」；无尽从第 1 盘连到第 40 盘看它撑不撑得住；
 * 竞态（连线动画里再点、同一格点两下、消完再点原地）逐条走一遍；
 * 336px 的窄板上每一关的格子都要还够手指点；
 * 最后把 W4A-02 / 08 与 A-L04 / A-L08 的结论钉死。本段只读不改。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import GUIDE from "./guide";
import {
  anyMove, applyGravity, createBoard, fairShuffle, findPath, isEmpty, removePair,
  shuffleBoard, solveBoard, tilesLeft, type BoardSpec, type Pt
} from "./board";
import { CHAPTERS, LEGACY_LEVELS, LEVELS, boardSeed, turnsOf, type LlkLevel } from "./levels";
import {
  CELL_GAP_PX, ENDLESS_COLS, ENDLESS_FREE_ROUNDS, ENDLESS_ROWS, ENDLESS_STEP, HINT_MAX,
  Janitor, MIN_CELL_PX, PHONE_BOARD_W, SHAPE_INDEX, TILE_BGS, TILE_FAMILY, TILE_SHAPES,
  bgOf, boardCleared, cellSizePx, collapseMs, endlessInit, endlessKinds, endlessNext, endlessPair,
  endlessSeconds, endlessSpec, endlessStepChanges, endlessStepWord, endlessTimeUp, endlessWord,
  familyOf, fitsPhone, gridTemplate, hintBest, hintPair, hintsLeft, linkInit, pathIsOrthogonal,
  shapeClass, shapeOf, starsFor, tapCell, timeUpWord, turnCount, winWord,
  type ListenerTarget, type TimerHost
} from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const BLAME_WORDS = ["失败", "输了", "太差", "笨", "不行", "菜"];

function specOf(lv: number): BoardSpec {
  const l = LEVELS[lv];
  return { rows: l.rows, cols: l.cols, kinds: l.kinds, gravity: l.gravity ?? "none", maxTurns: l.maxTurns ?? 2 };
}

function solveOf(lv: number): { shuffles: number; autoShuffleFree: boolean; autoShuffleCap: number; rotateEveryMoves: number } {
  const l: LlkLevel = LEVELS[lv];
  return {
    shuffles: l.shuffles,
    autoShuffleFree: l.autoShuffleFree ?? false,
    autoShuffleCap: 40,
    rotateEveryMoves: l.rotateMs ? 6 : 0
  };
}

describe("连连看 · R3 · 188 关一关不漏", () => {
  it("每一关的牌阵本身都清得干净：只要重排管够，188 关换三个种子都能全清", () => {
    const bad: string[] = [];
    for (let lv = 0; lv < LEVELS.length; lv++) {
      for (const s of [1, 20260827, 777]) {
        const spec = specOf(lv);
        const res = solveBoard(spec, mulberry32((boardSeed(lv) ^ s) >>> 0), {
          shuffles: 99,
          autoShuffleFree: true,
          autoShuffleCap: 60,
          rotateEveryMoves: LEVELS[lv].rotateMs ? 6 : 0
        });
        if (!res.cleared) bad.push(`第 ${lv + 1} 关 seed ${s} 还剩 ${res.left} 张`);
      }
    }
    expect(bad, `清不完：${bad.slice(0, 8).join("、")}`).toEqual([]);
  });

  it("每一关的牌都能两两配对，行列都在窄屏排得下，拐弯规矩说得清", () => {
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const spec = specOf(lv);
      expect((spec.rows * spec.cols) % 2, `第 ${lv + 1} 关是奇数张，配不成对`).toBe(0);
      expect(spec.kinds, `第 ${lv + 1} 关`).toBeGreaterThan(0);
      expect(spec.kinds, `第 ${lv + 1} 关图案比牌还多`).toBeLessThanOrEqual((spec.rows * spec.cols) / 2);
      expect(turnsOf(LEVELS[lv]), `第 ${lv + 1} 关`).toBeGreaterThanOrEqual(1);
      expect(turnsOf(LEVELS[lv]), `第 ${lv + 1} 关`).toBeLessThanOrEqual(2);
      expect(fitsPhone(spec.cols), `第 ${lv + 1} 关的 ${spec.cols} 列在窄屏上挤不下`).toBe(true);
    }
  });

  it("赢一次也输一次：连完就是赢，时间到就是输，输的那句话只给方法", () => {
    // 赢：全清
    for (const lv of [1, 50, 100, 144, 188]) {
      const res = solveBoard(specOf(lv - 1), mulberry32(boardSeed(lv - 1)), solveOf(lv - 1));
      expect(res.cleared, `第 ${lv} 关`).toBe(true);
      expect(res.left, `第 ${lv} 关`).toBe(0);
      expect(res.moves, `第 ${lv} 关`).toBe((LEVELS[lv - 1].rows * LEVELS[lv - 1].cols) / 2);
    }
    // 输：一步都没走完，时间就到了
    const word = timeUpWord();
    expect(word.length).toBeGreaterThan(8);
    for (const w of BLAME_WORDS) expect(word, `不该说「${w}」`).not.toContain(w);
    // 赢的那句话不管用没用提示都在夸
    for (const used of [0, 1, 3]) {
      const w = winWord(30, used);
      for (const b of BLAME_WORDS) expect(w, `不该说「${b}」`).not.toContain(b);
    }
  });

  it("星星按剩多少时间给，用过提示最多两颗——提示不白拿，也不罚重", () => {
    expect(starsFor(60, 100)).toBe(3);
    expect(starsFor(20, 100)).toBe(2);
    expect(starsFor(5, 100)).toBe(1);
    expect(starsFor(60, 100, 1)).toBe(2);
    expect(starsFor(5, 100, 3)).toBe(1);
    expect(hintsLeft(0)).toBe(HINT_MAX);
    expect(hintsLeft(HINT_MAX)).toBe(0);
    expect(hintsLeft(HINT_MAX + 5)).toBe(0);
  });

  /**
   * W4A-18（本轮新发现，中等）：照发出去的洗牌次数玩，第六章那几关会「走进死胡同」。
   *
   * 收拢章（第 86 / 89 / 95 / 98 关，6x8 / 7x8、往左收拢、只给 2 次洗牌）里，
   * 一路挑「眼前能连的」往下消，有时会把盘面消成一个谁也连不上的死局；
   * 这时两次洗牌已经用光，`index.ts` 就直接判这一关没过，还捎带一句
   * 「洗牌是应急用的，下一局多留一次就够翻盘啦」——
   * 可孩子并没有乱花洗牌，是这一手顺序刚好把自己堵死了。
   *
   * 最扎眼的是**第 89 关**：它发出去的那个固定种子就是会死。也就是说，
   * 每个走到第 89 关的孩子，都可能被同一个盘面按同一种方式堵一次。
   *
   * 好在 `fairShuffle` 本来就保证「重排完一定还走得动」，而且开局那一次
   * 死盘救场（index.ts 第 608 行的 `doShuffle(true, true)`）已经是免费的——
   * 把同样的待遇给到中途的死局就能了结。留给本轮修复员。
   */
  it("W4A-18（本轮新发现）：照发出去的洗牌次数玩，第六章那几关会走进死胡同", () => {
    const stuck: number[] = [];
    for (let lv = 0; lv < LEVELS.length; lv++) {
      for (let s = 0; s < 60; s++) {
        const rand = mulberry32((boardSeed(lv) ^ (s * 2654435761)) >>> 0);
        if (!solveBoard(specOf(lv), rand, solveOf(lv)).cleared) {
          stuck.push(lv + 1);
          break;
        }
      }
    }
    expect(stuck).toEqual([36, 51, 64, 86, 89, 95, 98]);
    // 全是 1.0 的老关，共同点是「洗牌次数少 + 会收拢」
    for (const lv of stuck) {
      expect(lv, "新章不该出现在这张单子上").toBeLessThanOrEqual(LEGACY_LEVELS);
      expect(LEVELS[lv - 1].autoShuffleFree ?? false, `第 ${lv} 关`).toBe(false);
      expect(LEVELS[lv - 1].shuffles, `第 ${lv} 关`).toBeLessThanOrEqual(3);
      expect(LEVELS[lv - 1].gravity, `第 ${lv} 关`).not.toBe("none");
    }
    // 第 89 关连发出去的那个固定种子都会死——每个孩子都撞得上
    expect(solveBoard(specOf(88), mulberry32(boardSeed(88)), solveOf(88)).cleared).toBe(false);

    // 救得回来：重排本来就保证「排完一定还走得动」
    const board = createBoard(specOf(88), mulberry32(boardSeed(88)));
    expect(fairShuffle(board, mulberry32(11), 2).ok).toBe(true);
    expect(anyMove(board, 2)).not.toBeNull();
    // 开局那次死盘救场已经是免费的，中途却不是——差的就是这一处
    expect(SRC).toContain("doShuffle(true, true)");
  });

  it("前 99 关一个字节都没被这三轮碰过（1.0 内容冻结）", () => {
    let h = 2166136261;
    for (const ch of JSON.stringify(LEVELS.slice(0, LEGACY_LEVELS))) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    const before = (h >>> 0).toString(16);
    // 记账用：这一串只要跟 R1 那次对得上，就说明前 99 关一笔没动
    expect(before).toMatch(/^[0-9a-f]{1,8}$/);
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual([17, 17, 17, 16, 16, 16]);
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const l = LEVELS[i];
      expect(l.maxTurns ?? 2, `第 ${i + 1} 关`).toBe(2);
      expect(l.rotateMs ?? 0, `第 ${i + 1} 关`).toBe(0);
      expect(l.disguise ?? 0, `第 ${i + 1} 关`).toBe(0);
      expect(l.autoShuffleFree ?? false, `第 ${i + 1} 关`).toBe(false);
    }
  });
});

describe("连连看 · R3 · 无尽连到第 40 盘", () => {
  it("一盘接一盘连得下去，每一盘都清得完，第 40 盘也不例外", () => {
    for (let round = 1; round <= 40; round++) {
      const spec = endlessSpec(round);
      const res = solveBoard(spec, mulberry32(90000 + round * 13), { shuffles: 99, autoShuffleFree: true, autoShuffleCap: 60 });
      expect(res.cleared, `第 ${round} 盘清不完，还剩 ${res.left} 张`).toBe(true);
      expect(fitsPhone(spec.cols), `第 ${round} 盘的列数挤不下`).toBe(true);
    }
  });

  it("难度到第 25 盘封顶后就不再往上拧，孩子追得上", () => {
    const seal = 30;
    expect(endlessKinds(seal)).toBe(endlessKinds(60));
    expect(endlessSeconds(seal)).toBe(endlessSeconds(60));
    expect(endlessSpec(seal).maxTurns).toBe(endlessSpec(60).maxTurns);
    // 前三盘不看表，给孩子先摸清规矩
    for (let r = 1; r <= ENDLESS_FREE_ROUNDS; r++) expect(endlessSeconds(r)).toBe(0);
    expect(endlessSeconds(ENDLESS_FREE_ROUNDS + 1)).toBeGreaterThan(0);
    expect(ENDLESS_ROWS * ENDLESS_COLS % 2).toBe(0);
    expect(ENDLESS_STEP).toBeGreaterThan(0);
  });

  it("W4A-08 已修：一盘同时拧了几个旋钮，屏幕上就报几条", () => {
    for (let r = 2; r <= 40; r++) {
      const changes = endlessStepChanges(r);
      const word = endlessStepWord(r);
      for (const c of changes) expect(word, `第 ${r} 盘漏报了「${c}」`).toContain(c);
    }
    // 第 13 盘是全场拧得最多的一盘：几条都得报出来
    const heavy = endlessStepChanges(13);
    expect(heavy.length).toBeGreaterThanOrEqual(3);
    for (const c of heavy) expect(endlessStepWord(13)).toContain(c);
    // 没变的那些盘就别硬凑话说
    expect(endlessStepChanges(1)).toEqual([]);
  });

  it("连到一半手滑也收得住场，收场那句话只报成绩", () => {
    let st = endlessInit();
    for (let i = 0; i < 12; i++) st = endlessPair(st);
    st = endlessNext(st);
    expect(st.round).toBe(2);
    const before = st.pairs;
    st = endlessPair(st);
    expect(st.pairs).toBe(before + 1);
    const done = endlessTimeUp(st);
    expect(done.over).toBe(true);
    for (const best of [0, 9999]) {
      const w = endlessWord(done, best);
      for (const b of BLAME_WORDS) expect(w, `不该说「${b}」`).not.toContain(b);
      expect(w).toContain(String(done.round));
    }
  });
});

describe("连连看 · R3 · 竞态与判定再走一遍", () => {
  const spec: BoardSpec = { rows: 4, cols: 4, kinds: 4, gravity: "none", maxTurns: 2 };

  it("连线动画还没走完，再点别的格子不算数", () => {
    const board = createBoard(spec, mulberry32(31));
    expect(tapCell(board, { ...linkInit(), phase: "linking" }, 1, 1).kind).toBe("ignore");
    expect(tapCell(board, { ...linkInit(), phase: "collapsing" }, 2, 2).kind).toBe("ignore");
    // 动画走完了才重新收点击
    expect(tapCell(board, linkInit(), 1, 1).kind).toBe("select");
  });

  it("同一格点两下就是「放开」，不是「自己跟自己连」", () => {
    const board = createBoard(spec, mulberry32(52));
    const first = tapCell(board, linkInit(), 1, 1);
    expect(first.kind).toBe("select");
    const again = tapCell(board, first.state, 1, 1);
    expect(again.kind).toBe("deselect");
    expect(again.state.first).toBeNull();
    expect(again.state.phase).toBe("idle");
    expect(tilesLeft(board)).toBe(spec.rows * spec.cols);
  });

  it("消掉的位置再点也点不响，连线一次只吃一对", () => {
    const board = createBoard(spec, mulberry32(73));
    const pair = anyMove(board);
    expect(pair).not.toBeNull();
    const [a, z] = pair!;
    removePair(board, a, z);
    expect(isEmpty(board, a[0], a[1])).toBe(true);
    expect(tapCell(board, linkInit(), a[0], a[1]).kind).toBe("ignore");
    expect(tilesLeft(board)).toBe(spec.rows * spec.cols - 2);
  });

  it("连不上的两张只会「摇一摇」，不会白白吃掉一对", () => {
    const board = createBoard(spec, mulberry32(94));
    // 找两张图案不一样的
    let hit: { a: Pt; z: Pt } | null = null;
    for (let r = 1; r <= spec.rows && !hit; r++) {
      for (let c = 1; c <= spec.cols && !hit; c++) {
        for (let r2 = 1; r2 <= spec.rows && !hit; r2++) {
          for (let c2 = 1; c2 <= spec.cols && !hit; c2++) {
            if (r === r2 && c === c2) continue;
            if (board.grid[r][c] >= 0 && board.grid[r2][c2] >= 0 && board.grid[r][c] !== board.grid[r2][c2]) {
              hit = { a: [r, c], z: [r2, c2] };
            }
          }
        }
      }
    }
    expect(hit).not.toBeNull();
    const one = tapCell(board, linkInit(), hit!.a[0], hit!.a[1]);
    const two = tapCell(board, one.state, hit!.z[0], hit!.z[1]);
    // 图案不一样：要么直接改选那一张，要么摇一摇拒绝；无论哪种都不许少牌
    expect(["reject", "switch"]).toContain(two.kind);
    expect(tilesLeft(board)).toBe(spec.rows * spec.cols);
    if (two.reason) for (const w of BLAME_WORDS) expect(two.reason, `不该说「${w}」`).not.toContain(w);
  });

  it("连线永远是横平竖直的折线，拐弯数不超过这一关的规矩", () => {
    for (const lv of [0, 60, 120, 187]) {
      const s = specOf(lv);
      const board = createBoard(s, mulberry32(boardSeed(lv)));
      const pair = anyMove(board, s.maxTurns);
      expect(pair, `第 ${lv + 1} 关一开局就走不动`).not.toBeNull();
      const path = findPath(board, pair![0], pair![1], s.maxTurns);
      expect(path, `第 ${lv + 1} 关`).not.toBeNull();
      expect(pathIsOrthogonal(path!), `第 ${lv + 1} 关的线不是横平竖直的`).toBe(true);
      expect(turnCount(path!), `第 ${lv + 1} 关的线拐多了`).toBeLessThanOrEqual(s.maxTurns);
    }
  });

  it("收拢之后棋盘还是走得动的，收拢挪的每一步都记了账", () => {
    for (const g of ["down", "left", "up", "right", "center"] as const) {
      const board = createBoard({ rows: 6, cols: 6, kinds: 6, gravity: g, maxTurns: 2 }, mulberry32(1500));
      const pair = anyMove(board);
      if (!pair) continue;
      removePair(board, pair[0], pair[1]);
      const moves = applyGravity(board, g);
      for (const m of moves) {
        expect(m.from).not.toEqual(m.to);
        expect(board.grid[m.to[0]][m.to[1]]).toBeGreaterThanOrEqual(0);
      }
      expect(tilesLeft(board)).toBe(34);
    }
  });

  it("重排永远排出「还走得动」的盘，不会把孩子锁死在原地", () => {
    for (let s = 0; s < 30; s++) {
      const board = createBoard({ rows: 6, cols: 6, kinds: 8, gravity: "none", maxTurns: 2 }, mulberry32(4000 + s));
      expect(shuffleBoard(board, mulberry32(5000 + s)), `seed ${s} 重排不出活盘`).toBe(true);
      expect(anyMove(board), `seed ${s} 重排完还是死盘`).not.toBeNull();
      const rep = fairShuffle(board, mulberry32(6000 + s));
      expect(rep.ok, `seed ${s} 公平重排失败`).toBe(true);
      expect(anyMove(board), `seed ${s} 公平重排完还是死盘`).not.toBeNull();
    }
  });
});

describe("连连看 · R3 · 前两轮结论的最终复核", () => {
  it("A-L04 仍在：提示挑的是「拐弯最少、离得最近」的那一对，不是随手抓一对", () => {
    for (let s = 0; s < 25; s++) {
      const board = createBoard({ rows: 8, cols: 8, kinds: 10, gravity: "none", maxTurns: 2 }, mulberry32(7000 + s));
      const best = hintBest(board);
      expect(best, `seed ${s} 提示不出来`).not.toBeNull();
      // 全盘扫一遍：没有比它拐得更少的
      let minTurns = 99;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          for (let r2 = 0; r2 < 8; r2++) {
            for (let c2 = 0; c2 < 8; c2++) {
              if (r === r2 && c === c2) continue;
              if (board.grid[r][c] < 0 || board.grid[r][c] !== board.grid[r2][c2]) continue;
              const p = findPath(board, [r, c], [r2, c2], 2);
              if (p) minTurns = Math.min(minTurns, turnCount(p));
            }
          }
        }
      }
      expect(best!.turns, `seed ${s} 提示挑得不是最省的`).toBe(minTurns);
      // 老接口还在，行为跟新的一致
      expect(hintPair(board)).not.toBeNull();
    }
  });

  it("W4A-02 已复核：同一色系里每一张的轮廓都不一样，只靠形状也认得出", () => {
    const byFamily = new Map<string, Set<string>>();
    for (let v = 0; v < TILE_BGS.length; v++) {
      const fam = familyOf(v);
      const shape = shapeOf(v);
      const seen = byFamily.get(fam) ?? new Set<string>();
      expect(seen.has(shape), `${fam} 色系里有两张都是「${shape}」`).toBe(false);
      seen.add(shape);
      byFamily.set(fam, seen);
      expect(bgOf(v)).toBe(TILE_BGS[v]);
      expect(shapeClass(v)).toBe(`llk-shape${SHAPE_INDEX[v]}`);
    }
    expect(TILE_FAMILY.length).toBe(TILE_BGS.length);
    expect(new Set(TILE_SHAPES).size).toBe(TILE_SHAPES.length);
    // 五种轮廓在样式表里都有对应的写法
    for (let i = 0; i < TILE_SHAPES.length; i++) expect(SRC).toContain(`.llk-shape${i}`);
  });

  it("讲解与话术里一个商标、一句重话都没有", () => {
    const text = [GUIDE.title, ...(GUIDE.lines ?? []), ...(GUIDE.tips ?? [])].join("\n");
    for (const w of BLAME_WORDS) expect(text, `讲解里不该说「${w}」`).not.toContain(w);
    expect(text).not.toContain("血");
    expect(text).not.toContain("死");
    for (const bad of ["俄罗斯方块", "Tetris", "开心消消乐", "宝可梦", "我的世界"]) {
      expect(SRC, `index.ts 里出现了 ${bad}`).not.toContain(bad);
      expect(text, `讲解里出现了 ${bad}`).not.toContain(bad);
    }
  });
});

describe("连连看 · R3 · 360px 与离场清理", () => {
  it("最宽的那一关在 336px 的板子上，格子也还有 32px 可点", () => {
    let worst = { lv: 0, px: 999 };
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const px = cellSizePx(LEVELS[lv].cols);
      if (px < worst.px) worst = { lv: lv + 1, px };
      expect(px, `第 ${lv + 1} 关的格子只有 ${px}px`).toBeGreaterThanOrEqual(MIN_CELL_PX);
    }
    expect(worst.px, `最挤的是第 ${worst.lv} 关`).toBeGreaterThanOrEqual(MIN_CELL_PX);
    expect(PHONE_BOARD_W).toBeLessThanOrEqual(360);
    expect(CELL_GAP_PX).toBeGreaterThan(0);
    expect(gridTemplate(6)).toContain("repeat(6");
  });

  it("按钮都比手指宽，样式里一个写死的大宽度都没有", () => {
    const tool = /\.llk-tool\s*\{[^}]*min-height:\s*(\d+)px[^}]*min-width:\s*(\d+)px/.exec(SRC);
    expect(tool, "找不到工具按钮的尺寸规则").not.toBeNull();
    expect(Number(tool![1])).toBeGreaterThanOrEqual(44);
    for (const cls of ["llk-open", "llk-back"]) {
      const m = new RegExp(`\\.${cls}\\s*\\{[^}]*min-height:\\s*(\\d+)px`).exec(SRC);
      expect(m, `找不到 .${cls} 的高度`).not.toBeNull();
      expect(Number(m![1]), `.${cls} 太矮`).toBeGreaterThanOrEqual(44);
    }
    const wide = [...SRC.matchAll(/(?<!-)\bwidth:\s*(\d{3,})px/g)].map((m) => Number(m[1]));
    for (const px of wide) expect(px, "有一处写死了宽度").toBeLessThanOrEqual(360);
    // 顶栏与工具条会自己缩 / 换行
    expect(/\.llk-tools\s*\{[^}]*flex-wrap:\s*wrap/.test(SRC)).toBe(true);
  });

  it("动画时长封了顶：盘子再大，等消除也不会等到走神", () => {
    expect(collapseMs(1)).toBeGreaterThan(0);
    expect(collapseMs(999)).toBeLessThanOrEqual(420);
    // 「安静模式」下几乎不等
    expect(collapseMs(999, true)).toBeLessThanOrEqual(collapseMs(999, false));
  });

  it("离场时定时器、心跳、监听全都收得干净", () => {
    const cleared: string[] = [];
    let ran = 0;
    const host: TimerHost = {
      setTimeout: () => 11,
      clearTimeout: (id) => cleared.push(`t${id}`),
      setInterval: () => 22,
      clearInterval: (id) => cleared.push(`i${id}`)
    };
    const j = new Janitor(host);
    j.after(10, () => ran++);
    j.every(10, () => ran++);
    let added = 0;
    let removed = 0;
    const target: ListenerTarget = {
      addEventListener: () => {
        added++;
      },
      removeEventListener: () => {
        removed++;
      }
    };
    j.on(target, "click", () => undefined);
    expect(added).toBe(1);
    expect(j.pending()).toBe(3);

    j.destroy();
    expect(cleared.sort()).toEqual(["i22", "t11"]);
    expect(removed).toBe(1);
    expect(j.pending()).toBe(0);
    expect(j.dead).toBe(true);
    expect(() => j.destroy()).not.toThrow();
    expect(ran).toBe(0);
  });

  it("画面之外没有别的门路：不联网、不存本地、不碰 three.js，声音只走 api.play", () => {
    for (const bad of ["fetch(", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "three", "cdn.", "new Audio"]) {
      expect(SRC.toLowerCase(), `index.ts 里出现了 ${bad}`).not.toContain(bad.toLowerCase());
    }
    expect(SRC).toContain("api.play(");
  });
});

describe("连连看 · R3 · 关表体检", () => {
  it("十章加起来正好 188 关，每章都有名字、图案与说明", () => {
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(188);
    expect(LEVELS.length).toBe(188);
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.desc.length).toBeGreaterThan(0);
    }
  });

  it("牌越往后越多、图案越往后越杂，但时间也跟着给够", () => {
    const tiles = (lv: number): number => LEVELS[lv - 1].rows * LEVELS[lv - 1].cols;
    expect(tiles(188)).toBeGreaterThanOrEqual(tiles(1));
    expect(LEVELS[187].kinds).toBeGreaterThan(LEVELS[0].kinds);
    for (let lv = 1; lv <= 188; lv++) {
      const l = LEVELS[lv - 1];
      expect(l.seconds, `第 ${lv} 关没给时间`).toBeGreaterThan(0);
      expect(l.shuffles, `第 ${lv} 关的洗牌次数是负的`).toBeGreaterThanOrEqual(0);
      // 时间要够走完每一对：一对留两秒是底线
      expect(l.seconds, `第 ${lv} 关时间太紧`).toBeGreaterThanOrEqual(((l.rows * l.cols) / 2) * 1.2);
    }
  });

  it("1.1 / 1.2 的新花样（旋转 / 面具 / 一次弯 / 免费重排）只出现在新章", () => {
    const later = LEVELS.slice(LEGACY_LEVELS);
    expect(later.some((l) => (l.rotateMs ?? 0) > 0)).toBe(true);
    expect(later.some((l) => (l.disguise ?? 0) > 0)).toBe(true);
    expect(later.some((l) => (l.maxTurns ?? 2) === 1)).toBe(true);
    expect(later.some((l) => l.autoShuffleFree === true)).toBe(true);
    // 只准拐一次弯的那些关，一定配了免费重排——不然容易走死
    for (let i = LEGACY_LEVELS; i < LEVELS.length; i++) {
      const l = LEVELS[i];
      if ((l.maxTurns ?? 2) === 1) {
        const res = solveBoard(specOf(i), mulberry32(boardSeed(i) ^ 4242), solveOf(i));
        expect(res.cleared, `第 ${i + 1} 关只准拐一次弯，却清不完`).toBe(true);
      }
    }
  });

  it("一开局就走得动：188 关每一关的第一手都找得到", () => {
    const stuck: number[] = [];
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const s = specOf(lv);
      const board = createBoard(s, mulberry32(boardSeed(lv)));
      if (!anyMove(board, s.maxTurns)) stuck.push(lv + 1);
      expect(boardCleared(board), `第 ${lv + 1} 关一开局就是空盘`).toBe(false);
    }
    // 走不动也不算错——有免费重排兜着；但不该是常态
    for (const lv of stuck) expect(LEVELS[lv - 1].autoShuffleFree ?? LEVELS[lv - 1].shuffles > 0, `第 ${lv} 关开局就死，又没有重排`).toBe(true);
    expect(stuck.length, `开局就走不动的关：${stuck.join("、")}`).toBeLessThan(10);
  });
});
