import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal } from "../level99";
import { CHARACTER_IDS, MOVE_SLOTS } from "./frames";
import { AI_TIERS, aiDecider, foeDecider } from "./ai";
import { NARROW_STAGE_WIDTH, STAGE_WIDTH, createMatch, runHeadless } from "./engine";
import type { SideStats } from "./engine";
import {
  CANCEL_SLOTS,
  CHAPTERS,
  LIGHT_ONLY_SLOTS,
  MECHANIC_LABELS,
  chapterIndexOf,
  chapterStartOf,
  endlessConfig,
  endlessMatchConfig,
  goalLine,
  levelConfig,
  levelWon,
  matchConfigFor,
  mechanicDone,
  starsFor,
  trainingMatchConfig,
  versusMatchConfig,
  type LevelResult
} from "./levels";

function blankStats(): SideStats {
  return {
    hits: 0,
    blocked: 0,
    cancels: 0,
    superCancels: 0,
    supersUsed: 0,
    throws: 0,
    guardCrushes: 0,
    landCancels: 0,
    jumpInCombos: 0,
    cornerHits: 0,
    lowHits: 0,
    lightHits: 0,
    maxCombo: 0,
    clashes: 0,
    vigorTaken: 0
  };
}

function result(partial: Partial<LevelResult> = {}): LevelResult {
  return {
    won: true,
    stats: blankStats(),
    vigorLeft: 120,
    vigorMax: 120,
    roundsWon: 1,
    ...partial
  };
}

describe("combo-clash · 八章 188 关", () => {
  it("章节大小之和正好 188", () => {
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS)).toBe(true);
    expect(CHAPTERS.reduce((n, c) => n + c.size, 0)).toBe(188);
  });

  it("八章都有名字、表情、颜色和一句介绍", () => {
    expect(CHAPTERS).toHaveLength(8);
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.desc.length).toBeGreaterThan(6);
      expect(c.size).toBeGreaterThan(0);
    }
  });

  it("关号能换算回章节,首尾对得上", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(TOTAL_LEVELS - 1)).toBe(7);
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const start = chapterStartOf(ci);
      expect(chapterIndexOf(start)).toBe(ci);
      expect(chapterIndexOf(start + CHAPTERS[ci].size - 1)).toBe(ci);
    }
  });

  it("越界关号会夹回合法范围,不会炸", () => {
    expect(levelConfig(-5).level).toBe(0);
    expect(levelConfig(9999).level).toBe(TOTAL_LEVELS - 1);
    expect(levelConfig(Number.NaN).level).toBe(0);
  });
});

describe("combo-clash · 每一关的配置都立得住", () => {
  const all = Array.from({ length: TOTAL_LEVELS }, (_, i) => levelConfig(i));

  it("188 关全都配得出来,而且对手不是自己", () => {
    expect(all).toHaveLength(188);
    for (const cfg of all) {
      expect(CHARACTER_IDS).toContain(cfg.foeChar);
      expect(cfg.foeChar).not.toBe(cfg.playerChar);
      expect(AI_TIERS).toContain(cfg.tier);
      expect(cfg.seed).toBeGreaterThan(0);
      expect(cfg.roundSeconds).toBeGreaterThan(20);
      expect(cfg.foeVigor).toBeGreaterThan(0.4);
      expect(cfg.foeVigor).toBeLessThanOrEqual(1.5);
    }
  });

  it("每一关的 seed 都不一样,不会两关跑出同一场", () => {
    expect(new Set(all.map((c) => c.seed)).size).toBe(TOTAL_LEVELS);
  });

  it("难度整体往上走:最后一章比第一章硬", () => {
    const first = all[0];
    const last = all[TOTAL_LEVELS - 1];
    expect(first.tier).toBe("rookie");
    expect(last.tier === "pro" || last.tier === "hell").toBe(true);
    expect(last.foeVigor).toBeGreaterThan(first.foeVigor);
    expect(last.roundsToWin).toBe(2);
  });

  it("第一章只开轻击那几个槽,第二章再开重击", () => {
    const ch1 = all.filter((c) => c.chapter === 0);
    for (const cfg of ch1) expect(cfg.allowedSlots).toEqual(LIGHT_ONLY_SLOTS);
    const ch2 = all.filter((c) => c.chapter === 1);
    for (const cfg of ch2) expect(cfg.allowedSlots).toEqual(CANCEL_SLOTS);
    // 后面几章不再限制
    for (const cfg of all.filter((c) => c.chapter >= 2)) expect(cfg.allowedSlots).toBeNull();
  });

  it("限用的槽全是真槽位", () => {
    for (const slot of [...LIGHT_ONLY_SLOTS, ...CANCEL_SLOTS]) expect(MOVE_SLOTS).toContain(slot);
  });

  it("破防章配木桩、跳入章配跳跳、贴边章把场地收窄", () => {
    for (const cfg of all) {
      if (cfg.mechanic === "guardCrush") expect(cfg.foeStyle).toBe("turtle");
      else if (cfg.mechanic === "jumpIn") expect(cfg.foeStyle).toBe("jumper");
      else expect(cfg.foeStyle).toBe("normal");
      expect(cfg.stageWidth).toBe(cfg.mechanic === "corner" ? NARROW_STAGE_WIDTH : STAGE_WIDTH);
    }
  });

  it("超必章开局就送槽,不然教不了超级取消", () => {
    for (const cfg of all.filter((c) => c.mechanic === "superCancel")) expect(cfg.startMeter).toBeGreaterThanOrEqual(50);
  });

  it("八章各教一手,标题都写得出来", () => {
    const seen = new Set(all.map((c) => c.mechanic));
    expect(seen.size).toBe(8);
    for (const mech of seen) expect(MECHANIC_LABELS[mech].length).toBeGreaterThan(1);
  });

  it("每一关都有一句话目标,360 宽也不会长到离谱", () => {
    for (const cfg of all) {
      const line = goalLine(cfg);
      expect(line.length).toBeGreaterThan(8);
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });

  it("配置能翻成能开打的对局配置", () => {
    for (const cfg of [all[0], all[60], all[120], all[187]]) {
      const mc = matchConfigFor(cfg);
      expect(mc.chars).toEqual([cfg.playerChar, cfg.foeChar]);
      expect(mc.roundFrames).toBe(cfg.roundSeconds * 60);
      const m = createMatch(mc);
      // 折算过之后,「七成元气」在任何配对下都真是玩家的七成
      const ratio = m.fighters[1].vigorMax / m.fighters[0].vigorMax;
      expect(Math.abs(ratio - cfg.foeVigor)).toBeLessThan(0.02);
    }
  });
});

describe("combo-clash · 过关与三颗星", () => {
  it("打赢才算过关", () => {
    const cfg = levelConfig(0);
    expect(levelWon(cfg, result({ won: true }))).toBe(true);
    expect(levelWon(cfg, result({ won: false }))).toBe(false);
  });

  it("输了保底一颗星,只鼓励不打击", () => {
    expect(starsFor(levelConfig(0), result({ won: false, vigorLeft: 0 }))).toBe(1);
  });

  it("赢了但元气快见底、也没打出这一章那一手,就是一颗星", () => {
    expect(starsFor(levelConfig(0), result({ vigorLeft: 10 }))).toBe(1);
  });

  it("元气留一半以上加一颗", () => {
    expect(starsFor(levelConfig(0), result({ vigorLeft: 90 }))).toBe(2);
  });

  it("元气够多又把这一章的那一手打出来才三颗", () => {
    const cfg = levelConfig(0);
    const stats = blankStats();
    stats.lightHits = 3;
    expect(starsFor(cfg, result({ vigorLeft: 90, stats }))).toBe(3);
    expect(starsFor(cfg, result({ vigorLeft: 10, stats }))).toBe(2);
  });

  it("八章各自认各自那一手", () => {
    const cases: Array<[number, Partial<SideStats>]> = [
      [chapterStartOf(0), { lightHits: 3 }],
      [chapterStartOf(1), { cancels: 1 }],
      [chapterStartOf(2), { jumpInCombos: 1 }],
      [chapterStartOf(3), { guardCrushes: 1 }],
      [chapterStartOf(4), { superCancels: 1 }],
      [chapterStartOf(5), { cornerHits: 3 }],
      [chapterStartOf(6), { throws: 1 }],
      [chapterStartOf(7), { maxCombo: 3 }]
    ];
    for (const [lv, patch] of cases) {
      const cfg = levelConfig(lv);
      expect(mechanicDone(cfg, blankStats()), `第 ${lv} 关空统计不该算达成`).toBe(false);
      expect(mechanicDone(cfg, { ...blankStats(), ...patch }), `第 ${lv} 关`).toBe(true);
    }
  });

  it("破防章三条路都认:破防、投技、或者两下下段", () => {
    const cfg = levelConfig(chapterStartOf(3));
    expect(mechanicDone(cfg, { ...blankStats(), throws: 1 })).toBe(true);
    expect(mechanicDone(cfg, { ...blankStats(), lowHits: 2 })).toBe(true);
  });
});

/**
 * 188 关的可玩性用无头模拟兜底。
 *
 * 「参照玩家」就是地狱档人机在打。它和关卡里的对手跑的是同一套决策,
 * 所以后面几章碰上同为地狱档的对手时本来就该是五五开 ——
 * 要求一把过是不讲理的。真正要守住的是两件事:
 *  · 每一关都**赢得下来**,没有靠数值堆成死局的关;
 *  · 前面几章教学关几乎一把过,越往后才越需要重来几次。
 */
describe("combo-clash · 188 关都打得通", () => {
  /** 换个 seed 就是换一次重来:同一关的对手不变,玩家这边打法不同 */
  function attempt(level: number, nth: number): boolean {
    const cfg = levelConfig(level);
    const m = createMatch(matchConfigFor(cfg));
    const r = runHeadless(
      m,
      [aiDecider("hell", cfg.seed + nth * 7919), foeDecider(cfg.foeStyle, cfg.tier, cfg.seed + 17)],
      cfg.roundSeconds * 60 * 6
    );
    return r.winner === 0;
  }

  /** 这一关要重来几次才过得去(1 = 一把过) */
  function triesNeeded(level: number, cap = 12): number {
    for (let i = 0; i < cap; i++) if (attempt(level, i)) return i + 1;
    return cap + 1;
  }

  const tries = Array.from({ length: TOTAL_LEVELS }, (_, lv) => triesNeeded(lv));

  it("188 关一关不落,全都打得赢,没有过不去的死关", () => {
    const stuck = tries.map((n, lv) => ({ n, lv })).filter((x) => x.n > 12);
    expect(stuck.map((x) => `第 ${x.lv + 1} 关`).join("、")).toBe("");
  });

  it("最难的一关也不至于要磨十几遍", () => {
    expect(Math.max(...tries)).toBeLessThanOrEqual(10);
  });

  it("教学五章几乎一把过,别在教东西的时候卡住小朋友", () => {
    const teach = tries.slice(0, chapterStartOf(5));
    const oneShot = teach.filter((n) => n === 1).length;
    expect(oneShot / teach.length).toBeGreaterThanOrEqual(0.9);
  });

  it("第一章一把过 100%,第一次上手不能被劝退", () => {
    expect(tries.slice(0, CHAPTERS[0].size).every((n) => n === 1)).toBe(true);
  });

  it("整体八成以上一把过,但后面几章确实更硬", () => {
    const oneShot = tries.filter((n) => n === 1).length;
    expect(oneShot / TOTAL_LEVELS).toBeGreaterThanOrEqual(0.8);
    const early = tries.slice(0, chapterStartOf(5)).filter((n) => n === 1).length / chapterStartOf(5);
    const late = tries.slice(chapterStartOf(5)).filter((n) => n === 1).length / (TOTAL_LEVELS - chapterStartOf(5));
    expect(late).toBeLessThan(early);
  });

  it("每一关都会收场,不会跑满帧数上限还没个结果", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const lv = chapterStartOf(ci);
      const cfg = levelConfig(lv);
      const m = createMatch(matchConfigFor(cfg));
      const cap = cfg.roundSeconds * 60 * 6;
      const r = runHeadless(m, [aiDecider("normal", 1), foeDecider(cfg.foeStyle, cfg.tier, cfg.seed)], cap);
      expect(r.winner, `第 ${ci + 1} 章开头那一关`).not.toBeNull();
      expect(r.frames).toBeLessThan(cap);
    }
  });
});

describe("combo-clash · 无尽 / 对战 / 双人 / 训练", () => {
  it("无尽连胜越高对手越强、元气越厚", () => {
    expect(endlessConfig(0).tier).toBe("rookie");
    expect(endlessConfig(3).tier).toBe("normal");
    expect(endlessConfig(6).tier).toBe("pro");
    expect(endlessConfig(12).tier).toBe("hell");
    expect(endlessConfig(12).foeVigor).toBeGreaterThan(endlessConfig(0).foeVigor);
  });

  it("无尽的对手不会撞上自己选的人", () => {
    for (let n = 0; n < 30; n++) {
      for (const me of CHARACTER_IDS) expect(endlessConfig(n, me).foeChar).not.toBe(me);
    }
  });

  it("无尽越往后送的槽越多,但封顶 50", () => {
    const first = endlessMatchConfig(endlessConfig(0), "duoduo");
    const later = endlessMatchConfig(endlessConfig(20), "duoduo");
    expect(first.startMeter[0]).toBe(0);
    expect(later.startMeter[0]).toBe(50);
  });

  it("对战是三局两胜,双方元气一样厚", () => {
    const mc = versusMatchConfig("duoduo", "xingxing");
    expect(mc.roundsToWin).toBe(2);
    expect(mc.vigorScale).toEqual([1, 1]);
    const m = createMatch(mc);
    expect(m.fighters[0].vigorMax).toBeGreaterThan(0);
  });

  it("训练模式槽给满、时间几乎不会到", () => {
    const mc = trainingMatchConfig("duoduo", "dundun");
    expect(mc.startMeter[0]).toBe(100);
    expect(mc.roundFrames).toBeGreaterThan(60 * 60 * 60);
    expect(createMatch(mc).fighters[0].meter).toBe(100);
  });

  it("无尽任意连胜段都开得起来,也打得完", () => {
    for (const streak of [0, 4, 8, 15]) {
      const cfg = endlessConfig(streak);
      const m = createMatch(endlessMatchConfig(cfg, "duoduo"));
      const r = runHeadless(m, [aiDecider("hell", 5 + streak), aiDecider(cfg.tier, 99 + streak)], 60 * 60 * 4);
      expect(r.winner).not.toBeNull();
    }
  });
});
