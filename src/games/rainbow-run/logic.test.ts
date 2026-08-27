import { describe, expect, it } from "vitest";
import {
  BOSSES,
  BossId,
  CLASSIC_LEVEL_COUNT,
  CLASSIC_THEME_COUNT,
  CRATE_SCORE,
  FORKS,
  HANDMADE_PER_THEME,
  LEVELS,
  LEVELS_PER_THEME,
  MAX_HEARTS,
  NEW_PATTERNS,
  NEW_THEMES,
  ObstacleKind,
  PATTERNS,
  PERFECT_RUN_BOSS_DAMAGE,
  PERFECT_STREAK_GOAL,
  PERFECT_WINDOW,
  PatternRow,
  RAIL_SECONDS,
  RAIL_SPEED_MULT,
  REVIVE_COST,
  ROLLER_SPEED_MULT,
  RunStats,
  THEME_ORDER,
  THEME_SIZES,
  THEME_STYLE,
  TOTAL_LEVELS,
  Theme,
  ZAPPER_OFF,
  ZAPPER_ON,
  bossDefeated,
  bossHitsOf,
  clampLane,
  clearSpeechLine,
  completesPerfectRun,
  detectSwipe,
  forkRows,
  forkSideForLane,
  isLevelUnlocked,
  isPerfectJump,
  isThemeUnlocked,
  levelIndicesOfTheme,
  missionDone,
  missionLabel,
  missionProgress,
  nextPerfectStreak,
  parseProgress,
  patternIsSurvivable,
  patternsForKinds,
  patternsForLevel,
  pickFork,
  railSpeedMult,
  retrySpeechLine,
  rowIsSurvivable,
  serializeProgress,
  smashesCrate,
  starsForLevel,
  themeCleared,
  themeIndexOfLevel,
  themeOffset,
  themeOfLevel,
  themeSize,
  themeStars,
  totalStars,
  wouldHit,
  zapperActive,
} from "./logic";
import guide from "./guide";
import { simulateLevel } from "./sim";
import type { Rng } from "../__tests__/campaignSim";
import {
  assertAllWin,
  formatReport,
  makeRng,
  runCampaign,
  runMustLose,
} from "../__tests__/campaignSim";

/** 1.0 就有的九章 99 关,1.1 之后必须一字不动。 */
const CLASSIC = LEVELS.slice(0, CLASSIC_LEVEL_COUNT);
/** 1.1 追加的第 100–188 关。 */
const FRESH = LEVELS.slice(CLASSIC_LEVEL_COUNT);
const NEW_THEME_ORDER: Theme[] = ["neon", "ropeway", "stardust"];

/** FNV-1a:把一整段文本压成 8 位十六进制,用作回归指纹。 */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

describe("rainbow-run 操作", () => {
  it("滑动方向判定与最短距离", () => {
    expect(detectSwipe(50, 5)).toBe("right");
    expect(detectSwipe(-50, 5)).toBe("left");
    expect(detectSwipe(5, -50)).toBe("up");
    expect(detectSwipe(5, 50)).toBe("down");
    expect(detectSwipe(5, 5)).toBeNull();
  });

  it("障碍与动作:跳过栏和坑,趴过杆,软糖云怪滚球电门只能躲", () => {
    expect(wouldHit("hurdle", "jump")).toBe(false);
    expect(wouldHit("hurdle", "run")).toBe(true);
    expect(wouldHit("pit", "jump")).toBe(false);
    expect(wouldHit("pit", "slide")).toBe(true);
    expect(wouldHit("bar", "slide")).toBe(false);
    expect(wouldHit("bar", "jump")).toBe(true);
    expect(wouldHit("rock", "jump")).toBe(true);
    expect(wouldHit("cloudy", "slide")).toBe(true);
    expect(wouldHit("roller", "jump")).toBe(true);
    expect(wouldHit("zapper", "slide")).toBe(true);
  });

  it("车道夹在 0..2", () => {
    expect(clampLane(-1)).toBe(0);
    expect(clampLane(3)).toBe(2);
    expect(clampLane(1)).toBe(1);
  });

  it("电光门按周期通电,滚滚球比路面快", () => {
    expect(ZAPPER_ON).toBeGreaterThan(0);
    expect(ZAPPER_OFF).toBeGreaterThan(0);
    expect(zapperActive(0, 0)).toBe(true);
    expect(zapperActive(ZAPPER_ON + 0.1, 0)).toBe(false);
    expect(zapperActive(ZAPPER_ON + ZAPPER_OFF + 0.05, 0)).toBe(true);
    expect(zapperActive(0, ZAPPER_ON + 0.1)).toBe(false);
    expect(ROLLER_SPEED_MULT).toBeGreaterThan(1);
  });
});

describe("rainbow-run 99 关九大世界", () => {
  it("正好 99 关 = 9 章 × 11 关", () => {
    expect(CLASSIC.length).toBe(99);
    expect(CLASSIC_THEME_COUNT).toBe(9);
    expect(LEVELS_PER_THEME).toBe(11);
    expect(CLASSIC_THEME_COUNT * LEVELS_PER_THEME).toBe(99);
    for (let ci = 0; ci < CLASSIC_THEME_COUNT; ci++) expect(themeSize(ci)).toBe(LEVELS_PER_THEME);
  });

  it("章内关卡世界一致,顺序与 THEME_ORDER 对应", () => {
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      for (const li of levelIndicesOfTheme(ci)) {
        expect(LEVELS[li].world).toBe(THEME_ORDER[ci]);
        expect(themeOfLevel(li)).toBe(THEME_ORDER[ci]);
      }
    }
  });

  it("每章至少 8 关手写(非生成)且布局互不相同", () => {
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      const chapter = levelIndicesOfTheme(ci).map((i) => LEVELS[i]);
      const hand = chapter.filter((l) => !l.gen);
      expect(hand.length).toBeGreaterThanOrEqual(HANDMADE_PER_THEME);
      // 布局签名 = 障碍组合 + 任务;整章都互不相同
      const sigs = new Set(
        chapter.map(
          (l) => `${[...l.obstacleKinds].sort().join(",")}|${l.mission.type}:${l.mission.n}`,
        ),
      );
      expect(sigs.size).toBe(chapter.length);
    }
  });

  it("生成关卡的障碍组合不重复同一模板(全局唯一)", () => {
    const gens = LEVELS.filter((l) => l.gen);
    expect(gens.length).toBe(CLASSIC_THEME_COUNT * (LEVELS_PER_THEME - HANDMADE_PER_THEME));
    const sigs = new Set(gens.map((l) => `${l.world}|${[...l.obstacleKinds].sort().join(",")}`));
    expect(sigs.size).toBe(gens.length);
  });

  it("99 关每关都有全局唯一的机制标记", () => {
    const feats = new Set(LEVELS.map((l) => l.feature));
    expect(feats.size).toBe(TOTAL_LEVELS);
    for (const l of LEVELS) expect(l.feature.length).toBeGreaterThan(0);
  });

  it("九个世界配色两两不同,障碍组合(palette)两两不同", () => {
    const n = THEME_ORDER.length;
    const tops = new Set(THEME_ORDER.map((t) => THEME_STYLE[t].skyTop));
    expect(tops.size).toBe(n);
    const lane0 = new Set(THEME_ORDER.map((t) => THEME_STYLE[t].lanes[0]));
    expect(lane0.size).toBe(n);
    const palettes = new Set(
      THEME_ORDER.map((t) => [...THEME_STYLE[t].palette].sort().join(",")),
    );
    expect(palettes.size).toBe(n);
    for (const t of THEME_ORDER) {
      expect(THEME_STYLE[t].name).toBeTruthy();
      expect(THEME_STYLE[t].skyTop).toMatch(/^#/);
    }
  });

  it("关卡障碍不越出所在世界的 palette,战役覆盖全部 7 种障碍", () => {
    for (const l of LEVELS) {
      const allowed = new Set(THEME_STYLE[l.world].palette);
      for (const k of l.obstacleKinds) expect(allowed.has(k)).toBe(true);
    }
    const classicKinds = new Set(CLASSIC.flatMap((l) => l.obstacleKinds));
    expect(classicKinds.size).toBe(7);
    // 1.1 补上第 8 种:彩纸箱
    const all = new Set(LEVELS.flatMap((l) => l.obstacleKinds));
    expect(all.size).toBe(8);
  });

  it("速度和长度随世界递增,最终关最长", () => {
    for (const l of LEVELS) {
      expect(l.len).toBeGreaterThan(800);
      expect(l.speed).toBeGreaterThan(150);
    }
    const w0max = Math.max(...levelIndicesOfTheme(0).map((i) => LEVELS[i].speed));
    const w8min = Math.min(...levelIndicesOfTheme(8).map((i) => LEVELS[i].speed));
    expect(w8min).toBeGreaterThan(w0max);
    // 99 关是老战役里最长的一关,188 关是整个战役最长的一关
    expect(CLASSIC[98].len).toBe(Math.max(...CLASSIC.map((l) => l.len)));
    expect(LEVELS[TOTAL_LEVELS - 1].len).toBe(Math.max(...LEVELS.map((l) => l.len)));
  });

  it("每个世界都有 noHit 挑战和道具关", () => {
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      const chapter = levelIndicesOfTheme(ci).map((i) => LEVELS[i]);
      expect(chapter.some((l) => l.mission.type === "noHit")).toBe(true);
      expect(chapter.some((l) => l.powerups.length > 0)).toBe(true);
    }
  });

  it("每关的任务都能用花样池达成(有对应障碍/奖励)", () => {
    for (const l of LEVELS) {
      const pool = patternsForLevel(l);
      expect(pool.length, l.name).toBeGreaterThan(0);
      for (const pat of pool) expect(patternIsSurvivable(pat)).toBe(true);
    }
  });

  it("坏关修复回归:任务数不超过花样池供给的安全线", () => {
    // 与 index.ts 保持一致:每 250 距离刷一行,640 高屏幕上最后 ~604 距离刷的行到不了玩家
    const ROW_GAP = 250;
    const TRAVEL = 604;
    for (const l of LEVELS) {
      // noHit 没有数量目标;大王关的血量由模拟器实跑验证,不走供给公式
      if (l.mission.type === "noHit" || l.mission.type === "boss") continue;
      const pool = patternsForLevel(l);
      let coins = 0;
      let stars = 0;
      let obs = 0;
      let crates = 0;
      let beats = 0;
      let rows = 0;
      for (const pat of pool) {
        for (const row of pat) {
          coins += row.coins.length;
          stars += row.stars.length;
          obs += row.obstacles.length;
          crates += row.obstacles.filter((o) => o.kind === "crate").length;
          if (row.beat) beats++;
          rows++;
        }
      }
      const reach = (l.len - TRAVEL) / ROW_GAP;
      const perRow =
        l.mission.type === "coins"
          ? coins / rows
          : l.mission.type === "stars"
            ? stars / rows
            : l.mission.type === "dodge"
              ? obs / rows
              : l.mission.type === "smash"
                ? crates / rows
                : // perfect:一组要三次连续完美跳,所以节奏行还要再除以 3
                  beats / rows / PERFECT_STREAK_GOAL;
      const supply = reach * perRow;
      // 收集类(要跑对车道)至少 1.6 倍供给,躲避类(路过就算)至少 1.4 倍
      const slack = l.mission.type === "dodge" ? 1.4 : 1.6;
      expect(supply, `${l.name} 任务 ${l.mission.type} ${l.mission.n}`).toBeGreaterThanOrEqual(l.mission.n * slack);
    }
  });

  it("坏关修复回归:关卡时长适合一年级(12~22 秒)", () => {
    for (const l of LEVELS) {
      const dur = l.len / l.speed;
      expect(dur, l.name).toBeGreaterThanOrEqual(12);
      expect(dur, l.name).toBeLessThanOrEqual(22);
    }
  });
});

describe("rainbow-run 花样与活路", () => {
  it("所有内置花样都有活路", () => {
    for (const pat of PATTERNS) {
      expect(patternIsSurvivable(pat)).toBe(true);
    }
  });

  it("三条道全是只能躲的障碍就没活路", () => {
    expect(
      rowIsSurvivable({
        obstacles: [
          { lane: 0, kind: "rock" },
          { lane: 1, kind: "roller" },
          { lane: 2, kind: "zapper" },
        ],
        stars: [],
        coins: [],
      }),
    ).toBe(false);
    expect(
      rowIsSurvivable({
        obstacles: [
          { lane: 0, kind: "rock" },
          { lane: 1, kind: "hurdle" },
          { lane: 2, kind: "rock" },
        ],
        stars: [],
        coins: [],
      }),
    ).toBe(true);
  });

  it("patternsForKinds 只保留可用障碍的花样", () => {
    const only = patternsForKinds(["rock"]);
    for (const pat of only) {
      for (const row of pat) {
        for (const o of row.obstacles) expect(o.kind).toBe("rock" as ObstacleKind);
      }
    }
    const withZapper = patternsForKinds(["rock", "hurdle", "bar", "zapper"]);
    expect(withZapper.length).toBeGreaterThan(patternsForKinds(["rock"]).length);
  });
});

describe("rainbow-run 任务", () => {
  it("四种任务的进度与完成判定", () => {
    const stats = { coins: 12, stars: 2, dodged: 30, heartsLost: 0 };
    expect(missionProgress({ type: "coins", n: 10 }, stats)).toBe(10);
    expect(missionDone({ type: "coins", n: 10 }, stats)).toBe(true);
    expect(missionDone({ type: "stars", n: 3 }, stats)).toBe(false);
    expect(missionDone({ type: "dodge", n: 30 }, stats)).toBe(true);
    expect(missionDone({ type: "noHit", n: 1 }, stats)).toBe(true);
    expect(missionDone({ type: "noHit", n: 1 }, { ...stats, heartsLost: 1 })).toBe(false);
  });

  it("任务文案齐全", () => {
    expect(missionLabel({ type: "coins", n: 10 })).toContain("10");
    expect(missionLabel({ type: "stars", n: 3 })).toContain("3");
    expect(missionLabel({ type: "dodge", n: 5 })).toContain("5");
    expect(missionLabel({ type: "noHit", n: 1 }).length).toBeGreaterThan(0);
  });
});

describe("rainbow-run 星级与进度", () => {
  it("任务+无伤 3 星;其一 2 星;仅通关 1 星", () => {
    expect(starsForLevel(true, 0)).toBe(3);
    expect(starsForLevel(true, 1)).toBe(2);
    expect(starsForLevel(false, 0)).toBe(2);
    expect(starsForLevel(false, 2)).toBe(1);
    expect(MAX_HEARTS).toBe(3);
    expect(REVIVE_COST).toBeGreaterThan(0);
  });

  it("进度序列化往返一致,坏档当新档", () => {
    const stars = new Array(LEVELS.length).fill(0);
    stars[0] = 3;
    const restored = parseProgress(serializeProgress(stars), LEVELS.length);
    expect(restored[0]).toBe(3);
    expect(restored[1]).toBe(0);
    expect(parseProgress(null, 3)).toEqual([0, 0, 0]);
    expect(parseProgress("bad", 3)).toEqual([0, 0, 0]);
    expect(parseProgress(JSON.stringify([9, -2]), 2)).toEqual([3, 0]);
  });

  it("第一关默认解锁,通过才解锁下一关", () => {
    const stars = new Array(LEVELS.length).fill(0);
    expect(isLevelUnlocked(stars, 0)).toBe(true);
    expect(isLevelUnlocked(stars, 1)).toBe(false);
    stars[0] = 2;
    expect(isLevelUnlocked(stars, 1)).toBe(true);
    expect(totalStars(stars)).toBe(2);
  });

  it("章节解锁:通关上一章终点关才开下一个世界", () => {
    const stars = new Array(LEVELS.length).fill(0);
    expect(isThemeUnlocked(stars, 0)).toBe(true);
    expect(isThemeUnlocked(stars, 1)).toBe(false);
    for (let i = 0; i < LEVELS_PER_THEME; i++) stars[i] = 3;
    expect(isThemeUnlocked(stars, 1)).toBe(true);
    expect(isThemeUnlocked(stars, 2)).toBe(false);
    expect(themeStars(stars, 0)).toBe(LEVELS_PER_THEME * 3);
    expect(themeCleared(stars, 0)).toBe(LEVELS_PER_THEME);
    expect(themeCleared(stars, 1)).toBe(0);
  });
});

describe("结算面板朗读文案", () => {
  it("过关朗读按任务完成与否给不同鼓励", () => {
    expect(clearSpeechLine("彩虹起点", 3, true)).toBe("彩虹起点跑完啦!小任务完成,得到 3 颗星,真棒!");
    expect(clearSpeechLine("彩虹起点", 2, false)).toBe("彩虹起点跑完啦!得到 2 颗星,下次试试完成小任务!");
  });

  it("失败朗读:战役安抚,无尽报里程,破纪录大声夸", () => {
    expect(retrySpeechLine(false, 0, false)).toBe("摔了一跤,晕乎乎。没关系,就从这一关重新出发!");
    expect(retrySpeechLine(true, 320, false)).toBe("这次跑了 320 米!休息一下,再来挑战纪录!");
    expect(retrySpeechLine(true, 500, true)).toBe("这次跑了 500 米,新纪录!太厉害啦!");
  });
});

/* ================= 1.1 新增 ================= */

describe("rainbow-run 1.1 · 188 关十二大世界", () => {
  it("章节关数和 === 188,新三章补上 89 关", () => {
    expect(THEME_SIZES.reduce((s, n) => s + n, 0)).toBe(188);
    expect(TOTAL_LEVELS).toBe(188);
    expect(LEVELS.length).toBe(188);
    expect(THEME_ORDER.length).toBe(12);
    expect(THEME_SIZES.length).toBe(THEME_ORDER.length);
    expect(THEME_SIZES.slice(9)).toEqual([30, 30, 29]);
    expect(FRESH.length).toBe(89);
    expect(CLASSIC_LEVEL_COUNT + FRESH.length).toBe(TOTAL_LEVELS);
  });

  it("前 99 关一字不动:整段关卡表的指纹与 1.0 一致", () => {
    const text = CLASSIC.map((l) =>
      [
        l.name,
        l.world,
        l.len,
        l.speed,
        l.obstacleKinds.join("/"),
        l.powerups.join("/"),
        l.mission.type,
        l.mission.n,
        l.feature,
        l.gen ? "gen" : "hand",
        l.hint,
      ].join("|"),
    ).join("\n");
    // 指纹变了就说明动到了老关卡,1.1 只允许在末尾追加
    expect(fnv1a(text)).toBe("533a8234");
    expect(CLASSIC[0].name).toBe("青草热身跑");
    expect(CLASSIC[98].name).toBe("彩虹终点站");
    expect(CLASSIC[98].mission).toEqual({ type: "coins", n: 15 });
  });

  it("前 99 关不带任何 1.1 新字段,也用不到彩纸箱和新任务", () => {
    for (const l of CLASSIC) {
      expect(l.rails, l.name).toBeUndefined();
      expect(l.rhythm, l.name).toBeUndefined();
      expect(l.fork, l.name).toBeUndefined();
      expect(l.boss, l.name).toBeUndefined();
      expect(l.obstacleKinds.includes("crate"), l.name).toBe(false);
      expect(["coins", "stars", "dodge", "noHit"]).toContain(l.mission.type);
      expect(NEW_THEMES.has(l.world)).toBe(false);
    }
  });

  it("新章节只排在末尾:第 100 关起才是新世界", () => {
    expect(themeIndexOfLevel(CLASSIC_LEVEL_COUNT - 1)).toBe(8);
    expect(themeIndexOfLevel(CLASSIC_LEVEL_COUNT)).toBe(9);
    expect(themeOfLevel(CLASSIC_LEVEL_COUNT)).toBe("neon");
    expect(themeOfLevel(129)).toBe("ropeway");
    expect(themeOfLevel(159)).toBe("stardust");
    expect(themeOfLevel(TOTAL_LEVELS - 1)).toBe("stardust");
    for (const l of FRESH) expect(NEW_THEMES.has(l.world)).toBe(true);
    expect([...NEW_THEMES].sort()).toEqual([...NEW_THEME_ORDER].sort());
  });

  it("变长章节的下标换算自洽:offset + size 正好接上下一章", () => {
    let off = 0;
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      expect(themeOffset(ci)).toBe(off);
      expect(themeSize(ci)).toBe(THEME_SIZES[ci]);
      const idxs = levelIndicesOfTheme(ci);
      expect(idxs.length).toBe(THEME_SIZES[ci]);
      expect(idxs[0]).toBe(off);
      expect(idxs[idxs.length - 1]).toBe(off + THEME_SIZES[ci] - 1);
      off += THEME_SIZES[ci];
    }
    expect(off).toBe(TOTAL_LEVELS);
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      const ci = themeIndexOfLevel(i);
      expect(i).toBeGreaterThanOrEqual(themeOffset(ci));
      expect(i).toBeLessThan(themeOffset(ci) + themeSize(ci));
    }
  });

  it("新三章全部手写,名字与机制标记全局唯一", () => {
    for (const l of FRESH) expect(l.gen).toBeUndefined();
    expect(new Set(LEVELS.map((l) => l.name)).size).toBe(TOTAL_LEVELS);
    expect(new Set(LEVELS.map((l) => l.feature)).size).toBe(TOTAL_LEVELS);
    for (const l of FRESH) {
      expect(l.hint.length).toBeGreaterThan(8);
      expect(l.powerups.length).toBeGreaterThan(0);
    }
  });

  it("新三章接着星夜世界继续加速,时长仍在小学生扛得住的区间", () => {
    // 每章都从比上一章更快的起跑速度开始,章内再往上爬
    for (let ci = 1; ci < THEME_ORDER.length; ci++) {
      const prev = levelIndicesOfTheme(ci - 1).map((i) => LEVELS[i].speed);
      const cur = levelIndicesOfTheme(ci).map((i) => LEVELS[i].speed);
      const label = THEME_STYLE[THEME_ORDER[ci]].name;
      expect(Math.min(...cur), label).toBeGreaterThan(Math.min(...prev));
      expect(Math.max(...cur), label).toBeGreaterThan(Math.max(...prev));
    }
    for (const l of FRESH) {
      const dur = l.len / l.speed;
      expect(dur, l.name).toBeGreaterThanOrEqual(12);
      expect(dur, l.name).toBeLessThanOrEqual(22);
    }
  });

  it("新三章解锁链:打通上一章终点关才开下一章", () => {
    const stars = new Array(TOTAL_LEVELS).fill(0);
    expect(isThemeUnlocked(stars, 9)).toBe(false);
    for (let i = 0; i < CLASSIC_LEVEL_COUNT; i++) stars[i] = 3;
    expect(isThemeUnlocked(stars, 9)).toBe(true);
    expect(isThemeUnlocked(stars, 10)).toBe(false);
    for (let i = CLASSIC_LEVEL_COUNT; i < themeOffset(10); i++) stars[i] = 2;
    expect(isThemeUnlocked(stars, 10)).toBe(true);
    expect(isThemeUnlocked(stars, 11)).toBe(false);
    expect(themeStars(stars, 9)).toBe(themeSize(9) * 2);
    expect(themeCleared(stars, 9)).toBe(themeSize(9));
    expect(themeCleared(stars, 11)).toBe(0);
  });

  it("新章节的攻略条目盖住第 100–188 关", () => {
    const covered = new Set<number>();
    for (const g of guide.entries) {
      for (let i = g.from; i <= g.to; i++) covered.add(i);
    }
    for (let lv = 1; lv <= TOTAL_LEVELS; lv++) expect(covered.has(lv), `第 ${lv} 关`).toBe(true);
    // 新三章各自有一条攻略,而且真的讲了新机制
    const fresh = guide.entries.filter((g) => g.from > CLASSIC_LEVEL_COUNT);
    expect(fresh.length).toBe(3);
    const words = fresh.flatMap((g) => g.tips).join("");
    for (const key of ["彩纸箱", "滑轨", "完美跳", "岔路", "大王"]) {
      expect(words, key).toContain(key);
    }
  });
});

describe("rainbow-run 1.1 · 四种新机制", () => {
  it("彩纸箱:平跑会撞,下滑铲碎,起跳越过", () => {
    expect(wouldHit("crate", "run")).toBe(true);
    expect(wouldHit("crate", "slide")).toBe(false);
    expect(wouldHit("crate", "jump")).toBe(false);
    expect(smashesCrate("crate", "slide")).toBe(true);
    // 跳过去只是躲开,不算铲碎
    expect(smashesCrate("crate", "jump")).toBe(false);
    expect(smashesCrate("crate", "run")).toBe(false);
    expect(smashesCrate("hurdle", "slide")).toBe(false);
    expect(CRATE_SCORE).toBeGreaterThan(0);
  });

  it("加速滑轨:踩上去才提速,时间到自动恢复", () => {
    expect(RAIL_SPEED_MULT).toBeGreaterThan(1);
    expect(RAIL_SPEED_MULT).toBeLessThan(1.6);
    expect(RAIL_SECONDS).toBeGreaterThan(1);
    expect(railSpeedMult(0)).toBe(1);
    expect(railSpeedMult(-1)).toBe(1);
    expect(railSpeedMult(RAIL_SECONDS)).toBe(RAIL_SPEED_MULT);
    expect(railSpeedMult(0.01)).toBe(RAIL_SPEED_MULT);
  });

  it("完美跳:贴着障碍起跳才算,连满三次凑一组", () => {
    expect(PERFECT_STREAK_GOAL).toBe(3);
    expect(isPerfectJump(0)).toBe(true);
    expect(isPerfectJump(PERFECT_WINDOW)).toBe(true);
    expect(isPerfectJump(PERFECT_WINDOW + 0.01)).toBe(false);
    expect(isPerfectJump(-0.01)).toBe(false);
    expect(nextPerfectStreak(0, true)).toBe(1);
    expect(nextPerfectStreak(1, true)).toBe(2);
    // 第三次凑满一组,计数回到 0 重新数
    expect(nextPerfectStreak(2, true)).toBe(0);
    expect(nextPerfectStreak(2, false)).toBe(0);
    expect(completesPerfectRun(0, true)).toBe(false);
    expect(completesPerfectRun(1, true)).toBe(false);
    expect(completesPerfectRun(2, true)).toBe(true);
    expect(completesPerfectRun(2, false)).toBe(false);
  });

  it("随机分岔:右道拐右其余拐左,抽签越界也安全", () => {
    expect(forkSideForLane(0)).toBe("left");
    expect(forkSideForLane(1)).toBe("left");
    expect(forkSideForLane(2)).toBe("right");
    expect(FORKS.length).toBeGreaterThanOrEqual(3);
    expect(pickFork(0)).toBe(FORKS[0]);
    expect(pickFork(0.999999)).toBe(FORKS[FORKS.length - 1]);
    // 随机源哪怕给了越界的数,也不能抽出 undefined
    expect(pickFork(-5)).toBe(FORKS[0]);
    expect(pickFork(5)).toBe(FORKS[FORKS.length - 1]);
    for (const gate of FORKS) {
      expect(gate.name).toBeTruthy();
      expect(gate.left.length).toBeGreaterThan(0);
      expect(gate.right.length).toBeGreaterThan(0);
      expect(patternIsSurvivable(gate.left)).toBe(true);
      expect(patternIsSurvivable(gate.right)).toBe(true);
      expect(forkRows(gate, 2)).toBe(gate.right);
      expect(forkRows(gate, 1)).toBe(gate.left);
      expect(forkRows(gate, 0)).toBe(gate.left);
    }
  });

  it("新花样都有活路:节奏行三条道同款可跳障碍,滑轨那条道不放障碍", () => {
    expect(NEW_PATTERNS.length).toBeGreaterThanOrEqual(10);
    const rows: PatternRow[] = [...NEW_PATTERNS, ...FORKS.flatMap((g) => [g.left, g.right])].flat();
    let beatRows = 0;
    let railRows = 0;
    for (const row of rows) {
      expect(rowIsSurvivable(row)).toBe(true);
      if (row.beat) {
        beatRows++;
        expect(row.obstacles.length).toBe(3);
        const kinds = new Set(row.obstacles.map((o) => o.kind));
        expect(kinds.size).toBe(1);
        // 节奏段必须是「跳过去」才有解的障碍,不然连不出三连
        for (const o of row.obstacles) expect(wouldHit(o.kind, "jump")).toBe(false);
      }
      for (const lane of row.rails ?? []) {
        railRows++;
        expect(row.obstacles.some((o) => o.lane === lane)).toBe(false);
      }
    }
    expect(beatRows).toBeGreaterThanOrEqual(PERFECT_STREAK_GOAL);
    expect(railRows).toBeGreaterThanOrEqual(3);
  });

  it("新花样池只接给新三章,经典九章的花样池一行不变", () => {
    for (const l of CLASSIC) {
      expect(patternsForLevel(l), l.name).toEqual(patternsForKinds(l.obstacleKinds));
    }
    const hasCrate = (pat: PatternRow[]): boolean =>
      pat.some((r) => r.obstacles.some((o) => o.kind === "crate"));
    const crateOnly = patternsForLevel({ world: "neon", obstacleKinds: ["crate"] });
    expect(crateOnly.some(hasCrate)).toBe(true);
    // 同样一组障碍,老世界抽不到任何带彩纸箱的花样
    expect(patternsForKinds(["crate"]).some(hasCrate)).toBe(false);
    expect(patternsForLevel({ world: "grass", obstacleKinds: ["crate"] })).toEqual(
      patternsForKinds(["crate"]),
    );
  });

  it("没开滑轨/节奏段的关卡不会抽到对应花样,开了才有", () => {
    const hasRails = (pat: PatternRow[]): boolean => pat.some((r) => (r.rails?.length ?? 0) > 0);
    const hasBeat = (pat: PatternRow[]): boolean => pat.some((r) => r.beat === true);
    for (const l of LEVELS) {
      const pool = patternsForLevel(l);
      if (!l.rails) expect(pool.some(hasRails), l.name).toBe(false);
      if (!l.rhythm) expect(pool.some(hasBeat), l.name).toBe(false);
    }
    const kinds: ObstacleKind[] = ["hurdle", "pit", "crate"];
    expect(patternsForLevel({ world: "stardust", obstacleKinds: kinds, rails: true }).some(hasRails)).toBe(true);
    const calm = patternsForLevel({ world: "stardust", obstacleKinds: kinds, rhythm: 1 });
    const busy = patternsForLevel({ world: "stardust", obstacleKinds: kinds, rhythm: 4 });
    expect(calm.some(hasBeat)).toBe(true);
    // rhythm 越大,节奏花样在池子里占比越高
    expect(busy.filter(hasBeat).length).toBeGreaterThan(calm.filter(hasBeat).length);
  });

  it("三种新机制在新三章里都铺开了,每章都吃得到", () => {
    for (let ci = 9; ci < THEME_ORDER.length; ci++) {
      const chapter = levelIndicesOfTheme(ci).map((i) => LEVELS[i]);
      expect(chapter.filter((l) => l.rails).length, "滑轨").toBeGreaterThanOrEqual(3);
      expect(chapter.filter((l) => l.rhythm).length, "节奏段").toBeGreaterThanOrEqual(3);
      expect(chapter.filter((l) => l.fork).length, "岔路").toBeGreaterThanOrEqual(3);
      expect(chapter.filter((l) => l.obstacleKinds.includes("crate")).length, "彩纸箱").toBeGreaterThanOrEqual(10);
      expect(chapter.filter((l) => l.boss).length, "大王").toBe(1);
    }
  });
});

describe("rainbow-run 1.1 · 章节大王", () => {
  it("三位大王血量递增,各自坐镇一章的最后一关", () => {
    const ids: BossId[] = ["conductor", "windLord", "stardustLord"];
    expect(Object.keys(BOSSES).sort()).toEqual([...ids].sort());
    for (let i = 1; i < ids.length; i++) {
      expect(BOSSES[ids[i]].hp).toBeGreaterThan(BOSSES[ids[i - 1]].hp);
    }
    for (const id of ids) {
      expect(BOSSES[id].name.length).toBeGreaterThan(1);
      expect(BOSSES[id].emoji.length).toBeGreaterThan(0);
      expect(BOSSES[id].blurb.length).toBeGreaterThan(8);
    }
    const bossLevels = LEVELS.filter((l) => l.boss);
    expect(bossLevels.length).toBe(3);
    for (let ci = 9; ci < THEME_ORDER.length; ci++) {
      const last = LEVELS[themeOffset(ci) + themeSize(ci) - 1];
      expect(last.boss, THEME_STYLE[THEME_ORDER[ci]].name).toBeTruthy();
    }
    expect(LEVELS[128].boss).toBe("conductor");
    expect(LEVELS[158].boss).toBe("windLord");
    expect(LEVELS[187].boss).toBe("stardustLord");
  });

  it("大王血量结算:铲一箱掉 1 下,三连完美跳掉 2 下", () => {
    expect(PERFECT_RUN_BOSS_DAMAGE).toBe(2);
    const none: RunStats = { coins: 0, stars: 0, dodged: 0, heartsLost: 0 };
    expect(bossHitsOf(none)).toBe(0);
    expect(bossHitsOf({ ...none, smashed: 5 })).toBe(5);
    expect(bossHitsOf({ ...none, perfectRuns: 3 })).toBe(6);
    expect(bossHitsOf({ ...none, smashed: 4, perfectRuns: 2 })).toBe(8);
    const conductor = BOSSES.conductor;
    expect(bossDefeated(conductor, { ...none, smashed: conductor.hp - 1 })).toBe(false);
    expect(bossDefeated(conductor, { ...none, smashed: conductor.hp })).toBe(true);
    expect(bossDefeated(conductor, { ...none, perfectRuns: 4 })).toBe(true);
  });

  it("大王关的任务目标就是把血打满,而且有两条路可以打", () => {
    for (const l of LEVELS.filter((l) => l.boss)) {
      const boss = BOSSES[l.boss as BossId];
      expect(l.mission.type).toBe("boss");
      expect(l.mission.n).toBe(boss.hp);
      // 铲箱和三连完美跳两条伤害来源都要给得出来
      expect(l.obstacleKinds).toContain("crate");
      expect(l.rhythm).toBeGreaterThanOrEqual(2);
      expect(l.hint.length).toBeGreaterThan(10);
    }
  });
});

describe("rainbow-run 1.1 · 新任务类型", () => {
  it("铲箱/完美跳/大王三种任务的进度与完成判定", () => {
    const stats: RunStats = {
      coins: 0,
      stars: 0,
      dodged: 0,
      heartsLost: 0,
      smashed: 7,
      perfectRuns: 2,
      bossHits: 11,
    };
    expect(missionProgress({ type: "smash", n: 6 }, stats)).toBe(6);
    expect(missionDone({ type: "smash", n: 6 }, stats)).toBe(true);
    expect(missionDone({ type: "smash", n: 8 }, stats)).toBe(false);
    expect(missionProgress({ type: "perfect", n: 4 }, stats)).toBe(2);
    expect(missionDone({ type: "perfect", n: 2 }, stats)).toBe(true);
    expect(missionDone({ type: "boss", n: 11 }, stats)).toBe(true);
    expect(missionDone({ type: "boss", n: 12 }, stats)).toBe(false);
    // 老存档没有这几个字段,当 0 处理而不是崩掉
    const old: RunStats = { coins: 3, stars: 1, dodged: 9, heartsLost: 0 };
    expect(missionProgress({ type: "smash", n: 3 }, old)).toBe(0);
    expect(missionProgress({ type: "perfect", n: 3 }, old)).toBe(0);
    expect(missionProgress({ type: "boss", n: 3 }, old)).toBe(0);
  });

  it("新任务文案齐全,数字念得出来", () => {
    expect(missionLabel({ type: "smash", n: 6 })).toContain("6");
    expect(missionLabel({ type: "smash", n: 6 })).toContain("彩纸箱");
    expect(missionLabel({ type: "perfect", n: 3 })).toContain("3");
    expect(missionLabel({ type: "perfect", n: 3 })).toContain("完美跳");
    expect(missionLabel({ type: "boss", n: 8 })).toContain("8");
    expect(missionLabel({ type: "boss", n: 8 })).toContain("大王");
    for (const l of LEVELS) expect(missionLabel(l.mission).length).toBeGreaterThan(3);
  });

  it("全部文案面向小学生:没有商标、没有原作角色名、不夹生词", () => {
    const banned = [
      "地铁跑酷", "神庙逃亡", "天天酷跑", "极限竞速", "跑酷大师",
      "subway", "surfers", "temple", "run3d", "sonic", "mario",
      "马里奥", "索尼克", "皮卡丘", "宝可梦", "奥特曼", "迪士尼",
      "米老鼠", "小猪佩奇", "喜羊羊", "熊出没", "汤姆猫",
    ];
    const texts: string[] = [];
    for (const l of LEVELS) texts.push(l.name, l.feature, l.hint, missionLabel(l.mission));
    for (const t of THEME_ORDER) texts.push(THEME_STYLE[t].name, THEME_STYLE[t].blurb);
    for (const id of Object.keys(BOSSES) as BossId[]) texts.push(BOSSES[id].name, BOSSES[id].blurb);
    for (const gate of FORKS) texts.push(gate.name);
    texts.push(guide.title, ...guide.general);
    for (const g of guide.entries) texts.push(g.title, ...g.tips);
    for (const text of texts) {
      const low = text.toLowerCase();
      for (const bad of banned) expect(low.includes(bad), `${text} 里出现了 ${bad}`).toBe(false);
      // 文案只用中文、数字和中文标点,不夹带任何外文品牌词
      expect(text, text).not.toMatch(/[A-Za-z]/);
    }
  });
});

/* ---- 共享战役模拟工具(src/games/__tests__/campaignSim.ts)在彩虹跑跑上的首次接线 ---- */

const CAMPAIGN = {
  game: "彩虹跑跑",
  total: TOTAL_LEVELS,
  label: (i: number) => LEVELS[i].name,
  play: (i: number, rng: Rng) => simulateLevel(i, { rng }),
};
const BOSS_IDXS = LEVELS.map((l, i) => (l.boss ? i : -1)).filter((i) => i >= 0);
const SEEDS = [1, 2, 3];

describe("rainbow-run 战役可通关性模拟", () => {
  it("共享模拟框架:同一个种子跑出同一串数,报告读得懂", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const c = makeRng(43);
    const seqA = [a(), a(), a()];
    expect(seqA).toEqual([b(), b(), b()]);
    expect(seqA).not.toEqual([c(), c(), c()]);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    const report = runCampaign(CAMPAIGN, { only: [0, 1], seeds: [1] });
    expect(report.ran).toBe(2);
    expect(report.plays).toBe(2);
    expect(formatReport(report)).toContain("彩虹跑跑");
    expect(assertAllWin(report)).toBe(true);
  });

  it("第 100–188 关:每个种子都能跑到终点", () => {
    const report = runCampaign(CAMPAIGN, {
      from: CLASSIC_LEVEL_COUNT,
      seeds: SEEDS,
      mode: "every",
    });
    expect(report.ran).toBe(89);
    expect(report.plays).toBe(89 * SEEDS.length);
    expect(report.failures, formatReport(report)).toEqual([]);
    expect(report.passed).toBe(89);
  });

  it("前 99 关回归:老关卡在同一套模拟器下照样通关", () => {
    const report = runCampaign(CAMPAIGN, { to: CLASSIC_LEVEL_COUNT, seeds: SEEDS, mode: "every" });
    expect(report.ran).toBe(CLASSIC_LEVEL_COUNT);
    expect(report.failures, formatReport(report)).toEqual([]);
  });

  it("每一关的小任务都至少在一个种子下做得到(能拿三星)", () => {
    const missionSpec = {
      ...CAMPAIGN,
      play: (i: number, rng: Rng) => {
        const r = simulateLevel(i, { rng });
        return { win: r.win && r.missionOk, note: `${r.note},任务 ${r.missionOk ? "达成" : "没达成"}` };
      },
    };
    const report = runCampaign(missionSpec, { seeds: SEEDS, mode: "any" });
    expect(report.ran).toBe(TOTAL_LEVELS);
    expect(report.failures, formatReport(report)).toEqual([]);
  });

  it("手动冒烟的三关(第 100、145、188)都能实打实分出胜负", () => {
    for (const level of [100, 145, 188]) {
      const idx = level - 1;
      const win = simulateLevel(idx, { seed: level });
      expect(win.win, `第 ${level} 关 ${win.note}`).toBe(true);
      expect(win.reason).toBe("finish");
      expect(win.stars).toBeGreaterThanOrEqual(1);
      expect(win.rows).toBeGreaterThan(8);
      expect(win.seconds).toBeGreaterThan(10);
      // 同一关摆烂就是会输,不是躺着也能过
      const lose = simulateLevel(idx, { seed: level, policy: "idle" });
      expect(lose.win, `第 ${level} 关摆烂居然赢了`).toBe(false);
      expect(lose.stars).toBe(0);
      expect(lose.heartsLeft).toBe(0);
    }
  });

  it("三个大王关:认真打能赢,只顾保命就会被大王跑掉", () => {
    expect(BOSS_IDXS).toEqual([128, 158, 187]);
    const win = runCampaign(CAMPAIGN, { only: BOSS_IDXS, seeds: SEEDS, mode: "every" });
    expect(win.failures, formatReport(win)).toEqual([]);
    for (const idx of BOSS_IDXS) {
      const r = simulateLevel(idx, { seed: idx + 1 });
      expect(r.bossHits, LEVELS[idx].name).toBeGreaterThanOrEqual(r.bossHp);
      expect(r.missionOk).toBe(true);
    }
    // 只保命:活着跑到终点,但一下都没打中,判输且说明是「大王跑了」
    const survive = {
      ...CAMPAIGN,
      play: (i: number, rng: Rng) => simulateLevel(i, { rng, policy: "survive" as const }),
    };
    const mustLose = runMustLose(survive, BOSS_IDXS, SEEDS);
    expect(mustLose.failures, formatReport(mustLose)).toEqual([]);
    for (const idx of BOSS_IDXS) {
      const r = simulateLevel(idx, { seed: idx + 1, policy: "survive" });
      expect(r.win).toBe(false);
      expect(r.reason, LEVELS[idx].name).toBe("boss");
      expect(r.bossHits).toBeLessThan(r.bossHp);
      expect(r.note).toContain("大王");
    }
  });
});

/* ------------------------------------------------------------------ */
/* R2C-R2 上屏文案的红线词                                             */
/* ------------------------------------------------------------------ */

describe("R2C-R2 · 上屏文案的红线词", () => {
  /** 所有会被玩家读到的字：188 关的关名 / 特色 / 提示，加上攻略里的每一句 */
  function visibleCopy(): string[] {
    const out: string[] = [];
    for (const lv of LEVELS) out.push(lv.name, lv.feature, lv.hint);
    out.push(guide.title, ...guide.general);
    for (const e of guide.entries) out.push(e.title, ...e.tips);
    return out;
  }

  it("「血」一个字都不上屏 —— 大王那两条改成卸护甲的口径", () => {
    expect(visibleCopy().filter((s) => s.includes("血"))).toEqual([]);
    const boss = guide.entries.flatMap((e) => e.tips).filter((t) => t.includes("护甲"));
    expect(boss.length).toBeGreaterThan(0);
    expect(boss.join("")).toContain("铲碎彩纸箱卸一层");
  });

  it("「广告」一个字都不上屏 —— 第 9 章那一关改成霓虹招牌的布景名", () => {
    expect(visibleCopy().filter((s) => s.includes("广告"))).toEqual([]);
    const lv = LEVELS.find((l) => l.name === "霓虹招牌走廊");
    expect(lv, "第 9 章第 12 关不见了").toBeTruthy();
    expect(lv?.hint).toContain("霓虹招牌一块接一块");
  });

  it("换名字没有动到这一关的玩法：还是那两种障碍、还是收 5 颗星", () => {
    const lv = LEVELS.find((l) => l.name === "霓虹招牌走廊");
    expect(lv?.obstacleKinds).toEqual(["bar", "rock"]);
    expect(lv?.mission).toEqual({ type: "stars", n: 5 });
  });

  it("188 个关名依旧两两不重样", () => {
    expect(new Set(LEVELS.map((l) => l.name)).size).toBe(LEVELS.length);
  });

  it("死亡 / 内购 / 抽卡这些词也一并扫过，命中 0", () => {
    const banned = ["死", "杀", "尸", "内购", "抽卡", "充值", "广告位", "氪"];
    const hits = visibleCopy().filter((s) => banned.some((b) => s.includes(b)));
    expect(hits).toEqual([]);
  });
});
