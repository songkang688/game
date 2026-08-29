/**
 * 窗口4 · 档B · 第 1 轮验收 —— 地鼠嘭嘭(mole-pop)。
 *
 * 剧本:首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 关 →
 * 无尽地鼠夜市玩到结算 → 360px 窄屏 → 硬约束自查。
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
import { TOTAL_LEVELS, totalSize } from "../level99";
import { CHAPTERS, LEVELS, endlessWave, type MoleLevel } from "./levels";
import { loseLine, roundStars, winLine, type RoundResult } from "./logic";
import { meta } from "./meta";
import {
  MOLE_SPECS,
  TimerBag,
  buildChart,
  bunnyPenalty,
  chartMaxPoints,
  comboMultiplier,
  hitPoints,
  judgeHit,
  maxConcurrentOf,
  nightMarketChart,
  nightMarketLine,
  type ChartNote,
} from "./rhythm";

const SOURCES = readGameSources("mole-pop");
const INDEX = SOURCES.find((s) => s.name === "index.ts")!;
const CSS = inlineCss(INDEX);

type Skill = "perfect" | "idle" | "bunnyMasher";

interface RoundReport extends RoundResult {
  maxPoints: number;
}

/**
 * 按 index.ts 的记分口径把一整关跑完:
 * - `perfect`:每只能打的都在冒头那一瞬间打中(judgeHit → perfect);
 * - `idle`:一只都不打;
 * - `bunnyMasher`:见谁打谁,连花花兔也打(扣分 + 计一次失误)。
 */
function playRound(cfg: MoleLevel, chart: readonly ChartNote[], skill: Skill): RoundReport {
  let score = 0;
  let mistakes = 0;
  let streak = 0;
  let bestCombo = 0;
  for (const note of chart) {
    const spec = MOLE_SPECS[note.kind];
    if (!spec.hittable) {
      if (skill === "bunnyMasher") {
        score = bunnyPenalty(score);
        mistakes++;
        streak = 0;
      }
      continue;
    }
    if (skill === "idle") {
      streak = 0;
      continue;
    }
    const judge = judgeHit(0, note.upMs);
    expect(judge).toBe("perfect");
    score += hitPoints(judge, spec.base);
    streak++;
    bestCombo = Math.max(bestCombo, streak);
  }
  const won = score >= cfg.target;
  return {
    won,
    score,
    mistakes,
    timeLeft: won ? Math.max(1, Math.round(cfg.duration * 0.25)) : 0,
    bestCombo,
    maxPoints: chartMaxPoints(chart),
  };
}

/** 与 index.ts 第 443 行同一口径的关卡谱面 */
function chartOf(level: number): ChartNote[] {
  return buildChart(LEVELS[level], level * 7919 + 1, level);
}

describe("档B R1 · 地鼠嘭嘭 · 首页进入", () => {
  it("首页收得到这一款,卡片信息完整", () => {
    const card = loadGames().find((g) => g.meta.id === "mole-pop");
    expect(card, "首页 loadGames() 里找不到 mole-pop").toBeTruthy();
    expect(card!.meta.title).toBe("地鼠嘭嘭");
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
    expect(INDEX.text).toContain("function mountEndless");
    expect(INDEX.text).toContain("mountLevelGame");
  });

  it("meta.platform 写的是手游,实现也确实是全点触(没有键盘玩法)", () => {
    expect(meta.platform).toBe("mobile");
    expect(INDEX.text).not.toMatch(/addEventListener\(\s*["']keydown["']/);
  });

  it("从首页点进来能拿到 mount(动态 chunk 可加载)", async () => {
    const mod = await import("./index");
    expect(typeof mod.mount).toBe("function");
    expect(mod.meta.id).toBe("mole-pop");
  });
});

describe("档B R1 · 地鼠嘭嘭 · 赢一次 + 输一次", () => {
  it("赢:第 1 关每只都在冒头那一瞬间打中,分数过线并拿 3 星", () => {
    const cfg = LEVELS[0];
    const r = playRound(cfg, chartOf(0), "perfect");
    expect(r.won).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(cfg.target);
    expect(roundStars(r, cfg.duration)).toBe(3);
    expect(winLine(cfg, r)).toContain(String(cfg.target));
  });

  it("输:一只都不打就到时间,分数 0,结算只鼓励", () => {
    const cfg = LEVELS[0];
    const r = playRound(cfg, chartOf(0), "idle");
    expect(r.won).toBe(false);
    expect(r.score).toBe(0);
    const line = loseLine(cfg, r);
    expect(line).toMatch(/再来一局/);
    expect(line).not.toMatch(/失败|你输了|太差|笨/);
  });

  it("输:见谁打谁会把花花兔也拍下去,扣分且计失误,但分数不会变负", () => {
    // 第 5 章「小兔保护区」花花兔占比最高
    const level = 70;
    const cfg = LEVELS[level];
    const r = playRound(cfg, chartOf(level), "bunnyMasher");
    expect(r.mistakes).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(roundStars(r, cfg.duration)).toBeLessThanOrEqual(2);
  });

  it("失误 3 次以上的鼓励语点名花花兔 / 算式,不指责小朋友", () => {
    const cfg = LEVELS[70];
    const line = loseLine(cfg, { won: false, score: 3, mistakes: 3, timeLeft: 0, bestCombo: 1 });
    expect(line).toMatch(/命中率立刻就上去了/);
    expect(line).not.toMatch(/失败|错太多|笨/);
  });
});

describe("档B R1 · 地鼠嘭嘭 · 战役第 1 / 100 / 188 关", () => {
  for (const level of [1, 100, 188]) {
    it(`第 ${level} 关谱面打得完:满分口径高于过关线,并发不超上限`, () => {
      const idx = level - 1;
      const cfg = LEVELS[idx];
      const chart = chartOf(idx);
      expect(chart.length).toBeGreaterThan(0);
      const r = playRound(cfg, chart, "perfect");
      expect(r.maxPoints, `第 ${level} 关谱面总分 ${r.maxPoints} 撑不起目标 ${cfg.target}`).toBeGreaterThanOrEqual(
        cfg.target,
      );
      expect(r.won).toBe(true);
      expect(maxConcurrentOf(chart)).toBeLessThanOrEqual(cfg.maxConcurrent);
    });
  }

  it("难度曲线:每一章内部目标分只增不减,章与章之间允许换机制时回落", () => {
    let from = 0;
    for (const ch of CHAPTERS) {
      const seg = LEVELS.slice(from, from + ch.size);
      expect(seg[seg.length - 1].target, `${ch.name} 章内目标分没有走高`).toBeGreaterThan(seg[0].target);
      from += ch.size;
    }
    // 第 100 关是「算术地洞」的第 1 关,新机制上手所以目标分回到 8,这是设计上的重开一章;
    // 但压轴的第 188 关必须比它难。
    expect(LEVELS[99].target).toBe(8);
    expect(LEVELS[187].target).toBeGreaterThan(LEVELS[99].target);
  });

  it("同一关重开谱面完全一样(确定性,便于回归)", () => {
    expect(chartOf(187)).toEqual(chartOf(187));
  });
});

describe("档B R1 · 地鼠嘭嘭 · 无尽地鼠夜市玩到结算", () => {
  it("连守 12 摊都能打:每一波谱面都排得出来、都打得动", () => {
    for (let wave = 1; wave <= 12; wave++) {
      const cfg = endlessWave(wave);
      const chart = nightMarketChart(cfg, wave, wave * 31 + 7);
      expect(chart.length, `第 ${wave} 摊谱面是空的`).toBeGreaterThan(0);
      expect(chartMaxPoints(chart)).toBeGreaterThan(0);
    }
  });

  it("越逛越热闹:第 12 摊的谱面音符数明显多于第 1 摊", () => {
    const first = nightMarketChart(endlessWave(1), 1, 99).length;
    const late = nightMarketChart(endlessWave(12), 12, 99).length;
    expect(late).toBeGreaterThan(first);
  });

  it("收摊结算:破纪录与没破纪录都是鼓励,没有名次羞辱", () => {
    expect(nightMarketLine(0, 0)).toMatch(/热热身|才刚开张/);
    expect(nightMarketLine(9, 3)).toContain("新纪录");
    const behind = nightMarketLine(3, 9);
    expect(behind).toContain("3 摊");
    expect(behind).not.toMatch(/失败|太差|笨/);
  });

  it("连击倍率有封顶,后段不会一发入魂", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(3)).toBe(2);
    expect(comboMultiplier(999)).toBe(4);
  });
});

describe("档B R1 · 地鼠嘭嘭 · 360px 窄屏", () => {
  it("内联样式里没有会在 360px 撑破容器的固定宽度", () => {
    expect(overflowingRules(CSS)).toEqual([]);
  });

  it("有窄屏断点,也照顾了 prefers-reduced-motion", () => {
    expect(narrowBreakpoints(CSS).length).toBeGreaterThan(0);
    expect(respectsReducedMotion(CSS)).toBe(true);
  });

  it("3×3 地洞棋盘用等分列,不写死像素", () => {
    expect(CSS).toMatch(/\.mp-board\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/);
  });

  it("C-5 矮屏与平板横屏按余高钳棋盘宽", () => {
    expect(CSS).toContain("max-width: min(100%, calc(100dvh - 240px))");
    expect(CSS).toContain("@media (min-width: 700px) and (max-height: 840px)");
    expect(CSS).toContain("max-width: min(100%, calc(100dvh - 320px))");
  });
});

describe("档B R1 · 地鼠嘭嘭 · 硬约束自查", () => {
  it("商标黑名单 0 命中", () => {
    expect(scanTrademarks(SOURCES)).toEqual([]);
  });

  it("分级红线:没有伤亡描写", () => {
    expect(scanRatingWords(SOURCES)).toEqual([]);
  });

  it("不引入 three.js / CDN / Socket / 联网", () => {
    expect(scanExternalDeps(SOURCES)).toEqual([]);
  });

  it("音效只走 api.play(...)", () => {
    expect(scanAudioMisuse(SOURCES)).toEqual([]);
    expect(INDEX.text).toMatch(/api\.play\(/);
  });

  it("角色全是本作原创,没有借来的名字", () => {
    const names = Object.values(MOLE_SPECS).map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).not.toMatch(/[A-Za-z]/);
  });

  it("存档 key 只走平台通用的 l99 / save,自己不另开 key", () => {
    expect(saveKeysIn(SOURCES)).toEqual([]);
    expect(INDEX.text).toMatch(/save\.getGameProgress\(/);
  });

  it("destroy 巡检:全局监听加了都摘、rAF 有取消、每个 mountXxx 都还 destroy", () => {
    const balance = globalListenerBalance(INDEX);
    expect(balance.leaked, `这些全局监听没摘:${balance.leaked.join("/")}`).toEqual([]);
    expect(rafBalanced(INDEX)).toBe(true);
    expect(mountFunctionsReturnDestroy(INDEX)).toEqual([]);
  });

  it("TimerBag:一关里排的定时器,收摊时一个不剩", () => {
    let nextId = 1;
    const live = new Set<number>();
    const bag = new TimerBag({
      setTimeout: () => {
        const id = nextId++;
        live.add(id);
        return id;
      },
      clearTimeout: (id) => void live.delete(id),
      setInterval: () => {
        const id = nextId++;
        live.add(id);
        return id;
      },
      clearInterval: (id) => void live.delete(id),
    });
    for (let i = 0; i < 20; i++) bag.after(() => undefined, 100 + i);
    bag.every(() => undefined, 1000);
    expect(bag.size).toBe(21);
    expect(live.size).toBe(21);
    bag.clearAll();
    expect(bag.size).toBe(0);
    expect(live.size).toBe(0);
  });
});
