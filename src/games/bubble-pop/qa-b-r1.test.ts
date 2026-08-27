/**
 * 窗口4 · 档B · 第 1 轮验收 —— 泡泡噗噗(bubble-pop)。
 *
 * 剧本:首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 关 →
 * 无尽泡泡海玩到结算 → 360px 窄屏 → 硬约束自查。
 * 只增用例,不改既有用例。
 */
import { describe, expect, it } from "vitest";
import {
  globalListenerBalance,
  inlineCss,
  mountFunctionsReturnDestroy,
  narrowBreakpoints,
  overflowingRules,
  rafBalanced,
  readGameSources,
  respectsReducedMotion,
  saveKeysIn,
  scanAudioMisuse,
  scanExternalDeps,
  scanRatingWords,
  scanTrademarks,
} from "../adventure-king/qaAudit";
import { loadGames } from "../../engine/loader";
import { TOTAL_LEVELS, mulberry32, totalSize } from "../level99";
import {
  SEA_ROWS,
  blowShuffle,
  chainBlast,
  isChain,
  planCollapse,
  pushUpRow,
  seaColors,
  seaLine,
  seaPushMs,
} from "./collapse";
import { BOARD_COLS, CHAPTERS, LEVELS, type BubbleLevel } from "./levels";
import {
  CHAIN,
  CHAMELEON_BASE,
  FROZEN_OFFSET,
  HIDDEN_OFFSET,
  RAINBOW,
  STONE,
  BOLT,
  colorOf,
  countLeftOn,
  cycleChameleons,
  groupAt,
  hasMovesOn,
  isFrozen,
  isHidden,
  revealHidden,
} from "./logic";
import { meta } from "./meta";
import { greedyPlay, popCells } from "./qaSolver";

const SOURCES = readGameSources("bubble-pop");
const INDEX = SOURCES.find((s) => s.name === "index.ts")!;
const CSS = inlineCss(INDEX);
const COLS = BOARD_COLS;

describe("档B R1 · 泡泡噗噗 · 首页进入", () => {
  it("首页收得到这一款,卡片信息完整", () => {
    const card = loadGames().find((g) => g.meta.id === "bubble-pop");
    expect(card, "首页 loadGames() 里找不到 bubble-pop").toBeTruthy();
    expect(card!.meta.title).toBe("泡泡噗噗");
    expect(card!.meta.category).toBe("casual");
    expect(card!.meta.blurb.length).toBeGreaterThan(10);
    expect(typeof card!.load).toBe("function");
  });

  it("meta.levels 与真实关卡表一致(188)", () => {
    expect(meta.levels).toBe(188);
    expect(LEVELS).toHaveLength(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
  });

  it("meta.modes 声明的玩法在实现里都真的有", () => {
    expect([...meta.modes]).toEqual(["campaign", "endless"]);
    expect(INDEX.text).toContain("function mountSea");
    expect(INDEX.text).toContain("mountLevelGame");
  });

  it("从首页点进来能拿到 mount(动态 chunk 可加载)", async () => {
    const mod = await import("./index");
    expect(typeof mod.mount).toBe("function");
    expect(mod.meta.id).toBe("bubble-pop");
  });
});

describe("档B R1 · 泡泡噗噗 · 赢一次 + 输一次", () => {
  it("赢:第 1 关贪心玩法能把剩余数压到过关线以内", () => {
    const cfg = LEVELS[0];
    const run = greedyPlay(cfg, 20260101);
    expect(run.won, `第 1 关剩了 ${run.left} 个,过关线是 ≤${cfg.maxLeft}`).toBe(true);
    expect(run.moves).toBeGreaterThan(0);
  });

  it("输:一步不点直接收工,剩余数远超过关线", () => {
    const cfg = LEVELS[0];
    const run = greedyPlay(cfg, 20260101, { lazy: true });
    expect(run.won).toBe(false);
    expect(run.left).toBe(cfg.rows * COLS);
    expect(run.moves).toBe(0);
  });

  it("输:步数关把步数耗光也会结算,结算语只鼓励", () => {
    const limited = LEVELS.findIndex((lv) => (lv.moveLimit ?? 0) > 0);
    expect(limited).toBeGreaterThan(0);
    const cfg = { ...LEVELS[limited], moveLimit: 1 };
    const run = greedyPlay(cfg, 777);
    expect(run.outOfMoves).toBe(true);
    expect(run.won).toBe(false);
    expect(INDEX.text).toContain("步数用完还剩");
    expect(INDEX.text).not.toMatch(/你输了|失败了|太笨/);
  });

  it("没得消的时候鸭梨吹一口气重排,最多三次,不扣分", () => {
    expect(INDEX.text).toContain("鸭梨吹一口气");
    expect(INDEX.text).toContain("不扣分");
    const grid = [
      [0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0],
    ];
    expect(hasMovesOn(grid, COLS, 2)).toBe(false);
    const shuffled = blowShuffle(grid, COLS, 2, mulberry32(9));
    expect(countLeftOn(shuffled)).toBe(countLeftOn(grid));
  });
});

describe("档B R1 · 泡泡噗噗 · 战役第 1 / 100 / 188 关", () => {
  for (const level of [1, 100, 188]) {
    it(`第 ${level} 关能真打通:20 个种子里至少过 17 个`, () => {
      const cfg = LEVELS[level - 1];
      const lefts = Array.from({ length: 20 }, (_, i) => greedyPlay(cfg, i * 97 + 11).left);
      const pass = lefts.filter((l) => l <= cfg.maxLeft).length;
      expect(
        pass,
        `第 ${level} 关(过关线 ≤${cfg.maxLeft})只过了 ${pass}/20,各局剩余数:${lefts.join(",")}`,
      ).toBeGreaterThanOrEqual(17);
    });
  }

  it("第 100 关起才有 1.1 / 1.2 的新机制,前 99 关一笔未动", () => {
    for (let i = 0; i < 99; i++) {
      const lv = LEVELS[i];
      expect(lv.flipGravity).toBeUndefined();
      expect(lv.chameleon).toBeUndefined();
      expect(lv.moveLimit).toBeUndefined();
      expect(lv.hidden).toBeUndefined();
      expect(lv.chain).toBeUndefined();
    }
    const late = LEVELS.slice(99);
    expect(late.some((lv) => lv.flipGravity)).toBe(true);
    expect(late.some((lv) => (lv.chain ?? 0) > 0)).toBe(true);
  });

  it("难度曲线:每一章内部盘面只增不减、过关线只紧不松", () => {
    let from = 0;
    for (const ch of CHAPTERS) {
      const seg = LEVELS.slice(from, from + ch.size);
      expect(seg[seg.length - 1].rows, `${ch.name} 盘面没变大`).toBeGreaterThanOrEqual(seg[0].rows);
      expect(seg[seg.length - 1].maxLeft, `${ch.name} 过关线没变紧`).toBeLessThanOrEqual(seg[0].maxLeft);
      from += ch.size;
    }
  });
});

describe("档B R1 · 泡泡噗噗 · 无尽泡泡海玩到结算", () => {
  it("推上来 40 次都不崩,节奏越推越快、颜色越来越多", () => {
    let grid: number[][] = Array.from({ length: SEA_ROWS }, () => Array.from({ length: COLS }, () => -1));
    const rand = mulberry32(4242);
    let overflowed = false;
    for (let push = 0; push < 40 && !overflowed; push++) {
      const res = pushUpRow(grid, COLS, seaColors(push), rand);
      grid = res.grid;
      overflowed = res.overflow;
    }
    expect(seaPushMs(0)).toBeGreaterThan(seaPushMs(20));
    expect(seaColors(30)).toBeGreaterThanOrEqual(seaColors(0));
    // 一直不消,总有一次会顶到顶——这就是无尽的结算条件
    expect(overflowed).toBe(true);
  });

  it("边推边消能一直玩下去:消得动就不会被顶穿", () => {
    let grid: number[][] = Array.from({ length: SEA_ROWS }, () => Array.from({ length: COLS }, () => -1));
    const rand = mulberry32(20260102);
    for (let push = 0; push < 30; push++) {
      const colors = seaColors(push);
      const res = pushUpRow(grid, COLS, colors, rand);
      grid = res.grid;
      expect(res.overflow, `第 ${push + 1} 次推上来就顶穿了`).toBe(false);
      // 每推一次就一直消到没得消,模拟正常玩家的手速
      for (let step = 0; step < 60; step++) {
        let best: Array<[number, number]> = [];
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c < COLS; c++) {
            if (grid[r][c] < 0) continue;
            const list = groupAt(grid, COLS, r, c, colors);
            if (list.length >= 2 && list.length > best.length) best = list;
          }
        }
        if (best.length === 0) break;
        popCells(grid, best);
        grid = planCollapse(grid, COLS, false, { reduced: true }).next;
      }
    }
  });

  it("无尽结算语只鼓励,破纪录会点名", () => {
    expect(seaLine(320, 100)).toContain("新纪录");
    expect(seaLine(0, 0)).not.toMatch(/失败|太差|笨/);
  });
});

describe("档B R1 · 泡泡噗噗 · 360px 窄屏", () => {
  it("内联样式里没有会在 360px 撑破容器的固定宽度", () => {
    expect(overflowingRules(CSS)).toEqual([]);
  });

  it("有窄屏断点,也照顾了 prefers-reduced-motion", () => {
    expect(narrowBreakpoints(CSS).length).toBeGreaterThan(0);
    expect(respectsReducedMotion(CSS)).toBe(true);
  });

  it("8 列盘面用等分列,窄屏靠 gap 收紧而不是横向滚动", () => {
    expect(COLS).toBe(8);
    expect(CSS).toMatch(/\.bp-board \{[^}]*grid-template-columns: repeat\(\$\{COLS\}, 1fr\)/);
    expect(CSS).toContain("@media (max-width: 380px)");
    expect(CSS).toContain(".bp-board { gap: 5px; }");
  });

  it("单颗泡泡的最小宽度在 360px 上排得下 8 列", () => {
    const m = /\.bp-cell \{[^}]*min-width: (\d+)px/.exec(CSS);
    expect(m, "找不到 .bp-cell 的 min-width").not.toBeNull();
    const cell = Number(m![1]);
    // 8 颗 + 7 道 5px 的间隙,必须塞进 360px
    expect(cell * 8 + 5 * 7).toBeLessThanOrEqual(360);
  });
});

describe("档B R1 · 泡泡噗噗 · 硬约束自查", () => {
  it("商标黑名单 0 命中", () => {
    expect(scanTrademarks(SOURCES)).toEqual([]);
  });

  it("分级红线:没有伤亡描写", () => {
    expect(scanRatingWords(SOURCES)).toEqual([]);
  });

  it("不引入 three.js / CDN / Socket / 联网", () => {
    expect(scanExternalDeps(SOURCES)).toEqual([]);
  });

  it("音效只走 api.play(...) / ctx.sfx(...)", () => {
    expect(scanAudioMisuse(SOURCES)).toEqual([]);
    expect(INDEX.text).toMatch(/api\.play\(|ctx\.sfx\(/);
  });

  it("存档 key 只走平台通用的 l99 / save,自己不另开 key", () => {
    expect(saveKeysIn(SOURCES)).toEqual([]);
    expect(INDEX.text).toMatch(/save\.getGameProgress\(/);
  });

  it("destroy 巡检:全局监听加了都摘、rAF 有取消、每个 mountXxx 都还 destroy", () => {
    const balance = globalListenerBalance(INDEX);
    expect(balance.leaked, `这些全局监听没摘:${balance.leaked.join("/")}`).toEqual([]);
    expect(rafBalanced(INDEX, SOURCES)).toBe(true);
    expect(mountFunctionsReturnDestroy(INDEX)).toEqual([]);
  });

  it("塌陷动画只有一条路径:终态永远从 plan.next 整片换上", () => {
    expect(INDEX.text).toContain("copyInto(host.grid, plan.next)");
    const grid = [
      [0, 0, 1],
      [1, 1, 1],
    ];
    const plan = planCollapse(grid, 3, false, { reduced: true });
    expect(countLeftOn(plan.next)).toBe(countLeftOn(grid));
  });
});
