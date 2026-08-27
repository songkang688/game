/**
 * 窗口4 · 档B · 第 1 轮验收 —— 水果切切乐(fruit-slice)。
 *
 * 剧本:首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 回合 →
 * 禅宗 / 街机无尽 / 水果暴风三种模式各玩到结算 → 360px 窄屏 → 硬约束自查。
 * 只增用例,不改既有用例。
 */
import { describe, expect, it } from "vitest";
import {
  globalListenerBalance,
  mountFunctionsReturnDestroy,
  rafBalanced,
  readGameSources,
  saveKeysIn,
  scanAudioMisuse,
  scanExternalDeps,
  scanRatingWords,
  scanTrademarks,
} from "../adventure-king/qaAudit";
import { loadGames } from "../../engine/loader";
import {
  APEX_BOTTOM,
  APEX_TOP,
  BladeBag,
  STORM_MISS_LIMIT,
  STORM_MISTAKE_LIMIT,
  arcReachable,
  safeLaunch,
  stormLine,
  stormOver,
  STORM_COUNT_MAX,
  stormPace,
  stormStars,
  stormWave,
} from "./blade";
import {
  BEST_KEY,
  HEARTS_PER_ROUND,
  KING_INFO,
  PROGRESS_KEY,
  ROUNDS,
  TOTAL_ROUNDS,
  arcadePace,
  arcadeStars,
  endSpeechLine,
  gravityFor,
  kingDown,
  retrySpeechLine,
  roundIsCleared,
  starsForRound,
  themeSize,
  themeStart,
  zenStars,
  type RoundDef,
} from "./logic";
import { meta } from "./meta";

const SOURCES = readGameSources("fruit-slice");
const INDEX = SOURCES.find((s) => s.name === "index.ts")!;

/** index.ts 里两次抛射之间的固定间隔(第 604 行的 launchTimer) */
const VOLLEY_SEC = 1.4;

/**
 * 一个回合最多能凑到多少分(不含连刀 / 果王加成)。
 * 用「时长 ÷ 抛射间隔 × 每波最少几颗」算,这是最保守的下界:
 * 连这个下界都撑不起 target,那这一关就是设计上的死局。
 */
function floorScore(r: RoundDef): number {
  const volleys = Math.floor(r.time / VOLLEY_SEC);
  return volleys * r.volleyMin;
}

describe("档B R1 · 水果切切乐 · 首页进入", () => {
  it("首页收得到这一款,卡片信息完整", () => {
    const card = loadGames().find((g) => g.meta.id === "fruit-slice");
    expect(card, "首页 loadGames() 里找不到 fruit-slice").toBeTruthy();
    expect(card!.meta.title).toBe("水果切切乐");
    expect(card!.meta.category).toBe("action");
    expect(card!.meta.blurb.length).toBeGreaterThan(10);
    expect(typeof card!.load).toBe("function");
  });

  it("meta.levels 与真实回合表一致(188)", () => {
    expect(meta.levels).toBe(188);
    expect(TOTAL_ROUNDS).toBe(188);
    expect(ROUNDS).toHaveLength(188);
  });

  it("meta.modes 声明的玩法在实现里都真的有:战役 + 禅宗 / 街机 / 暴风三种无尽", () => {
    expect([...meta.modes]).toEqual(["campaign", "endless"]);
    expect(INDEX.text).toMatch(/"zen"/);
    expect(INDEX.text).toMatch(/"arcade"/);
    expect(INDEX.text).toMatch(/"storm"/);
  });

  it("从首页点进来能拿到 mount(动态 chunk 可加载)", async () => {
    const mod = await import("./index");
    expect(typeof mod.mount).toBe("function");
    expect(mod.meta.id).toBe("fruit-slice");
  });

  it("十二个果园的回合数加起来正好 188,章节起点连续不断档", () => {
    let sum = 0;
    for (let ci = 0; ci < 12; ci++) {
      expect(themeStart(ci)).toBe(sum);
      sum += themeSize(ci);
    }
    expect(sum).toBe(TOTAL_ROUNDS);
  });
});

describe("档B R1 · 水果切切乐 · 赢一次 + 输一次", () => {
  it("赢:第 1 回合一颗不漏能超过目标分,不掉心就是 3 星", () => {
    const r = ROUNDS[0];
    expect(floorScore(r), `第 1 回合最少也能切到 ${floorScore(r)} 分,目标 ${r.target}`).toBeGreaterThanOrEqual(
      r.target,
    );
    expect(starsForRound(0)).toBe(3);
    expect(roundIsCleared(r.target, r.target, false, false)).toBe(true);
  });

  it("输:一刀不挥就 0 分,达不到目标,不算过关", () => {
    const r = ROUNDS[0];
    expect(roundIsCleared(0, r.target, false, false)).toBe(false);
  });

  it("输:三颗心掉光就收摊,掉心越多星越少但至少给 1 星", () => {
    expect(HEARTS_PER_ROUND).toBe(3);
    expect(starsForRound(1)).toBe(2);
    expect(starsForRound(2)).toBe(1);
    expect(starsForRound(9)).toBe(1);
  });

  it("果王回合:分数够了但果王没倒,依然不算过关", () => {
    const kingRound = ROUNDS.findIndex((r) => r.king);
    expect(kingRound).toBeGreaterThan(0);
    const r = ROUNDS[kingRound];
    const spec = KING_INFO[r.king!];
    expect(roundIsCleared(r.target + 50, r.target, true, false)).toBe(false);
    expect(roundIsCleared(r.target, r.target, true, true)).toBe(true);
    expect(kingDown(spec, spec.hp)).toBe(true);
    expect(kingDown(spec, spec.hp - 1)).toBe(false);
  });

  it("失败文案只鼓励,不说重话", () => {
    const retry = retrySpeechLine();
    expect(retry.length).toBeGreaterThan(0);
    expect(retry).not.toMatch(/失败|你输了|太差|笨/);
    for (const line of [endSpeechLine(true, 0, false), endSpeechLine(false, 0, false)]) {
      expect(line).not.toMatch(/失败|你输了|太差|笨/);
    }
  });
});

describe("档B R1 · 水果切切乐 · 战役第 1 / 100 / 188 回合", () => {
  for (const round of [1, 100, 188]) {
    it(`第 ${round} 回合不是死局:最保守的抛射量也撑得起目标分`, () => {
      const r = ROUNDS[round - 1];
      expect(r.target).toBeGreaterThan(0);
      expect(r.time).toBeGreaterThan(0);
      expect(r.volleyMin).toBeGreaterThan(0);
      expect(r.volleyMax).toBeGreaterThanOrEqual(r.volleyMin);
      expect(
        floorScore(r),
        `第 ${round} 回合「${r.name}」保守分 ${floorScore(r)} < 目标 ${r.target}`,
      ).toBeGreaterThanOrEqual(r.target);
    });
  }

  it("第 1 / 100 / 188 回合的目标分一路走高,难度不回头", () => {
    const targets = [0, 99, 187].map((i) => ROUNDS[i].target);
    expect(targets[1]).toBeGreaterThan(targets[0]);
    expect(targets[2]).toBeGreaterThan(targets[1]);
  });

  it("第 188 回合是压轴:炸弹更凶、同屏更多,而且带果王", () => {
    const first = ROUNDS[0];
    const last = ROUNDS[187];
    expect(last.bombChance).toBeGreaterThan(first.bombChance);
    expect(last.maxOnScreen).toBeGreaterThanOrEqual(first.maxOnScreen);
    expect(last.king).toBeTruthy();
  });

  it("每个回合的 feature 标记全库唯一(188 个回合没有复制粘贴)", () => {
    const features = ROUNDS.map((r) => r.feature);
    expect(new Set(features).size).toBe(features.length);
  });
});

describe("档B R1 · 水果切切乐 · 三种无尽玩法各玩到结算", () => {
  it("禅宗:60 秒到点结算,分档给星,0 分也只是 0 星不是惩罚", () => {
    expect(zenStars(0)).toBe(0);
    const ladder = [0, 20, 60, 120, 240].map(zenStars);
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]).toBeGreaterThanOrEqual(ladder[i - 1]);
    expect(zenStars(9999)).toBe(3);
  });

  it("街机:分数越高抛得越密、炸弹越多,但都有封顶", () => {
    const paces = [0, 30, 90, 200, 900].map(arcadePace);
    for (let i = 1; i < paces.length; i++) {
      expect(paces[i].interval).toBeLessThanOrEqual(paces[i - 1].interval);
      expect(paces[i].bombChance).toBeGreaterThanOrEqual(paces[i - 1].bombChance);
    }
    expect(paces[paces.length - 1].interval).toBeGreaterThan(0);
    expect(paces[paces.length - 1].bombChance).toBeLessThanOrEqual(1);
    expect(arcadeStars(0)).toBe(0);
    expect(arcadeStars(9999)).toBe(3);
  });

  it("水果暴风:一波比一波密,漏 3 颗或切错 3 次就收摊", () => {
    const paces = Array.from({ length: 40 }, (_, i) => stormPace(i));
    for (let i = 1; i < paces.length; i++) {
      expect(paces[i].count).toBeGreaterThanOrEqual(paces[i - 1].count);
      expect(paces[i].interval).toBeLessThanOrEqual(paces[i - 1].interval);
    }
    expect(paces[39].count).toBeLessThanOrEqual(STORM_COUNT_MAX);
    expect(paces[39].interval).toBeGreaterThanOrEqual(0.55);
    expect(stormOver(0, 0)).toBe(false);
    expect(stormOver(STORM_MISS_LIMIT, 0)).toBe(true);
    expect(stormOver(0, STORM_MISTAKE_LIMIT)).toBe(true);
  });

  it("水果暴风:从第 1 波一路打到收摊,新目标随波次解锁", () => {
    let missed = 0;
    let mistakes = 0;
    let score = 0;
    let wave = 0;
    const seen = new Set<string>();
    while (!stormOver(missed, mistakes) && wave < 200) {
      const w = stormWave(wave, 20260827);
      for (const e of w.extras) seen.add(e);
      // 玩家切中大部分,偶尔漏一颗
      score += w.count * 2;
      if (wave % 17 === 16) missed++;
      if (wave % 23 === 22) mistakes++;
      wave++;
    }
    expect(stormOver(missed, mistakes)).toBe(true);
    expect(wave).toBeGreaterThan(10);
    expect(score).toBeGreaterThan(0);
    expect([...seen].sort()).toEqual(["double", "flower", "twin"]);
    expect(stormStars(score)).toBe(3);
  });

  it("暴风收摊语只鼓励,破纪录会点名", () => {
    expect(stormLine(0, 0)).not.toMatch(/失败|太差|笨/);
    expect(stormLine(200, 100)).toContain("新纪录");
    expect(stormLine(50, 200)).toContain("50 分");
  });
});

describe("档B R1 · 水果切切乐 · 360px 窄屏", () => {
  it("画布铺满容器,不写死像素宽高", () => {
    expect(INDEX.text).toContain('canvas.style.width = "100%"');
    expect(INDEX.text).toContain('canvas.style.height = "100%"');
    expect(INDEX.text).toContain("root.clientWidth");
  });

  it("360×640 上抛出来的每一条抛物线都够得着(200 次采样)", () => {
    const w = 360;
    const h = 640;
    const g = gravityFor(h);
    for (let i = 0; i < 200; i++) {
      const rx = (i * 37) % 100 / 100;
      const rvx = (i * 53) % 100 / 100;
      const rvy = (i * 71) % 100 / 100;
      const arc = safeLaunch(w, h, rx, rvx, rvy, g);
      expect(arcReachable(arc, w, h, g), `第 ${i} 次抛射在 360px 上够不着`).toBe(true);
    }
  });

  it("360×640 上顶点高度落在孩子够得着的带子里", () => {
    const w = 360;
    const h = 640;
    const g = gravityFor(h);
    const arc = safeLaunch(w, h, 0.5, 0.5, 0.5, g);
    const apexY = arc.y - (arc.vy * arc.vy) / (2 * g);
    expect(apexY).toBeGreaterThanOrEqual(h * APEX_TOP - 1);
    expect(apexY).toBeLessThanOrEqual(h * APEX_BOTTOM + 1);
  });

  it("选关地图在 360×640 上排得下:节点不出界、也不叠在一起", () => {
    // 与 index.ts 第 2303–2318 行同一套排版公式
    const w = 360;
    const h = 640;
    for (let ci = 0; ci < 12; ci++) {
      const size = themeSize(ci);
      const cols = size > 16 ? 5 : 4;
      const rows = Math.ceil(size / cols);
      const mx0 = w * 0.12;
      const mx1 = w * 0.88;
      const my0 = 96;
      const my1 = h - 62;
      const nr = Math.max(13, Math.min(28, (mx1 - mx0) / cols / 2.4, (my1 - my0) / rows / 2.6));
      const stepX = (mx1 - mx0) / (cols - 1);
      expect(mx0 - nr, `第 ${ci + 1} 章的节点左边出界了`).toBeGreaterThanOrEqual(0);
      expect(mx1 + nr, `第 ${ci + 1} 章的节点右边出界了`).toBeLessThanOrEqual(w);
      expect(stepX, `第 ${ci + 1} 章的节点横向叠在一起了`).toBeGreaterThan(nr);
      const stepY = rows > 1 ? (my1 - my0) / (rows - 1) : my1 - my0;
      expect(stepY, `第 ${ci + 1} 章的节点纵向叠在一起了`).toBeGreaterThan(nr);
    }
  });
});

describe("档B R1 · 水果切切乐 · 硬约束自查", () => {
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

  it("存档 key 冻结:只有战役进度与最好成绩两把", () => {
    expect(saveKeysIn(SOURCES)).toEqual([
      "yiduo-yixing.fruit-slice.best.v1",
      "yiduo-yixing.fruit-slice.campaign.v2",
    ]);
    expect(PROGRESS_KEY).toBe("yiduo-yixing.fruit-slice.campaign.v2");
    expect(BEST_KEY).toBe("yiduo-yixing.fruit-slice.best.v1");
  });

  it("destroy 巡检:全局监听加了都摘、rAF 有取消、每个 mountXxx 都还 destroy", () => {
    const balance = globalListenerBalance(INDEX);
    expect(balance.leaked, `这些全局监听没摘:${balance.leaked.join("/")}`).toEqual([]);
    expect(rafBalanced(INDEX)).toBe(true);
    expect(mountFunctionsReturnDestroy(INDEX)).toEqual([]);
  });

  it("BladeBag:进→玩→退跑 5 遍,袋子每次都归零", () => {
    const bag = new BladeBag();
    for (let round = 0; round < 5; round++) {
      let live = 0;
      for (let i = 0; i < 12; i++) {
        live++;
        bag.add(() => live--);
      }
      expect(bag.size).toBe(12);
      bag.clear();
      expect(bag.size).toBe(0);
      expect(live).toBe(0);
    }
  });
});
