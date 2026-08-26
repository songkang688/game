/**
 * 钓鱼小达人 · 188 关关卡表单测。
 *
 * 除了常规的章节和、字段合法性,这里还用 `__tests__/campaignSim` 把 188 关
 * **整个跑一遍**:一个「抛竿抛得准、一收一放不乱按」的标准钓手,必须每一关都过得去;
 * 反过来,一直按住不放和一直不收线这两种摆烂手法必须输,证明失败分支是真的存在。
 */
import { describe, expect, it } from "vitest";
import { assertTotal, chapterOf, chapterRange } from "../level99";
import {
  assertAllWin,
  formatReport,
  runCampaign,
  runMustLose,
  type LevelOutcome,
  type Rng,
} from "../__tests__/campaignSim";
import {
  BAND_LUCK,
  CHAPTERS,
  bandCenter,
  bandOf,
  bandText,
  buildLevel,
  emptyLog,
  expectCatch,
  goalMet,
  goalRatio,
  goalText,
  goalValue,
  hardnessFor,
  levelRandom,
  loseLine,
  progressText,
  rateLevel,
  speciesNear,
  unitsFor,
  type CatchLog,
  type FishingLevel,
} from "./levels";
import {
  CHARGE_CYCLE_MS,
  MAX_DEPTH,
  autoReel,
  biteDelayMs,
  catchScore,
  fightParams,
  newFight,
  pickFish,
  sinkMs,
  stepFight,
} from "./logic";

const TOTAL = 188;
const ALL: FishingLevel[] = Array.from({ length: TOTAL }, (_, i) => buildLevel(i));

// ---------------------------------------------------------------------------
// 章节
// ---------------------------------------------------------------------------

describe("章节切分", () => {
  it("八个主题章节,大小之和正好 188", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(assertTotal(CHAPTERS, TOTAL)).toBe(true);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL);
  });

  it("每一章都有名字、图标、主色和一句介绍,而且互不重复", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThan(8);
      expect(ch.size).toBeGreaterThan(0);
    }
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(CHAPTERS.length);
  });

  it("章节区间首尾相接,最后一章收在第 188 关", () => {
    let prevTo = 0;
    for (let i = 0; i < CHAPTERS.length; i++) {
      const { from, to } = chapterRange(CHAPTERS, i);
      expect(from).toBe(prevTo + 1);
      expect(to).toBeGreaterThanOrEqual(from);
      prevTo = to;
    }
    expect(prevTo).toBe(TOTAL);
  });
});

// ---------------------------------------------------------------------------
// 关卡字段
// ---------------------------------------------------------------------------

describe("188 关的字段", () => {
  it("每一关的关号与章节都对得上", () => {
    ALL.forEach((lv, i) => {
      expect(lv.index).toBe(i);
      expect(lv.chapter).toBe(chapterOf(CHAPTERS, i));
    });
  });

  it("鱼群带永远在水里,而且至少 3 米宽(抛竿够得着)", () => {
    for (const lv of ALL) {
      expect(lv.band.from, `第 ${lv.index + 1} 关`).toBeGreaterThanOrEqual(0);
      expect(lv.band.to, `第 ${lv.index + 1} 关`).toBeLessThanOrEqual(MAX_DEPTH);
      expect(lv.band.to - lv.band.from, `第 ${lv.index + 1} 关的鱼群带太窄`).toBeGreaterThanOrEqual(2.9);
      expect(bandCenter(lv.band)).toBeGreaterThanOrEqual(lv.band.from);
      expect(bandCenter(lv.band)).toBeLessThanOrEqual(lv.band.to);
    }
  });

  it("限时、竿数、目标值都是正的,竿数留了失手的余量", () => {
    for (const lv of ALL) {
      expect(lv.seconds, `第 ${lv.index + 1} 关`).toBeGreaterThan(30);
      expect(lv.casts, `第 ${lv.index + 1} 关`).toBeGreaterThanOrEqual(6);
      expect(lv.need, `第 ${lv.index + 1} 关`).toBeGreaterThan(0);
      expect(lv.hardness).toBeGreaterThanOrEqual(0);
      expect(lv.hardness).toBeLessThanOrEqual(1);
      expect(lv.hint.length).toBeGreaterThan(8);
      if (lv.goal === "count") expect(lv.casts).toBeGreaterThan(lv.need);
    }
  });

  it("越往后越难:每一章开头的难度都比上一章高", () => {
    const heads = CHAPTERS.map((_, ci) => buildLevel(chapterRange(CHAPTERS, ci).from - 1).hardness);
    for (let i = 1; i < heads.length; i++) {
      expect(heads[i], `第 ${i + 1} 章应该更难`).toBeGreaterThan(heads[i - 1]);
    }
    expect(hardnessFor(0, 0)).toBe(0);
    expect(hardnessFor(7, 1)).toBe(1);
  });

  it("水层一章比一章深", () => {
    const centers = CHAPTERS.map((_, ci) => bandCenter(buildLevel(chapterRange(CHAPTERS, ci).from - 1).band));
    for (let i = 1; i < centers.length; i++) {
      expect(centers[i], `第 ${i + 1} 章应该更深`).toBeGreaterThan(centers[i - 1]);
    }
  });

  it("四种目标都用上了,而且第一章不出现最难的重量目标", () => {
    const kinds = new Set(ALL.map((lv) => lv.goal));
    expect(kinds).toEqual(new Set(["count", "score", "variety", "weight"]));
    expect(ALL.slice(0, 24).some((lv) => lv.goal === "weight")).toBe(false);
    expect(ALL[0].goal).toBe("count");
  });

  it("生成是确定的,同一关算两次一模一样", () => {
    expect(buildLevel(88)).toEqual(buildLevel(88));
    expect(buildLevel(187)).toEqual(buildLevel(187));
  });

  it("越界的关号会被夹回 0..187", () => {
    expect(buildLevel(-9).index).toBe(0);
    expect(buildLevel(999).index).toBe(187);
    expect(buildLevel(12.4).index).toBe(12);
  });

  it("鱼群带随关号往深处走、往窄里收", () => {
    const head = bandOf(3, 0);
    const tail = bandOf(3, 1);
    expect(tail.from).toBeGreaterThan(head.from);
    expect(tail.to - tail.from).toBeLessThan(head.to - head.from);
    expect(bandOf(99, 0.5).to).toBeLessThanOrEqual(MAX_DEPTH);
  });

  it("一关要钓的量随章节与关号增长", () => {
    expect(unitsFor(0, 0)).toBeLessThan(unitsFor(7, 1));
    expect(unitsFor(0, 0)).toBeGreaterThanOrEqual(3);
    expect(unitsFor(7, 1)).toBeLessThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// 目标与结算
// ---------------------------------------------------------------------------

function logOf(partial: Partial<CatchLog>): CatchLog {
  return { ...emptyLog(), ...partial };
}

describe("目标与文案", () => {
  it("每种目标的说明里都带着要达成的数字", () => {
    for (const lv of ALL) {
      const text = goalText(lv);
      expect(text.length).toBeGreaterThan(4);
      expect(text).toContain(String(lv.need));
      expect(progressText(lv, emptyLog()).length).toBeGreaterThan(3);
    }
  });

  it("鱼群带提示写清了米数与水层名", () => {
    const lv = buildLevel(0);
    expect(bandText(lv)).toContain(String(lv.band.from));
    expect(bandText(lv)).toContain("晨光浅滩");
    expect(bandText(buildLevel(187))).toContain("星光海沟");
  });

  it("条数目标数条数", () => {
    const lv = ALL.find((l) => l.goal === "count") as FishingLevel;
    expect(goalValue(lv, logOf({ count: 2 }))).toBe(2);
    expect(goalMet(lv, logOf({ count: lv.need - 1 }))).toBe(false);
    expect(goalMet(lv, logOf({ count: lv.need }))).toBe(true);
    expect(goalRatio(lv, logOf({ count: 0 }))).toBe(0);
    expect(goalRatio(lv, logOf({ count: lv.need * 3 }))).toBe(1);
  });

  it("分数目标数分数", () => {
    const lv = ALL.find((l) => l.goal === "score") as FishingLevel;
    expect(goalValue(lv, logOf({ score: 30 }))).toBe(30);
    expect(goalMet(lv, logOf({ score: lv.need }))).toBe(true);
    expect(progressText(lv, logOf({ score: 5 }))).toContain("分");
  });

  it("重量目标按一位小数比,不会被浮点尾巴卡住", () => {
    const lv = ALL.find((l) => l.goal === "weight") as FishingLevel;
    expect(goalMet(lv, logOf({ weight: lv.need - 0.0001 }))).toBe(true);
    expect(goalMet(lv, logOf({ weight: lv.need - 0.2 }))).toBe(false);
    expect(progressText(lv, logOf({ weight: 1.234 }))).toContain("1.2");
  });

  it("种类目标数不重复的鱼种", () => {
    const lv = ALL.find((l) => l.goal === "variety") as FishingLevel;
    expect(goalValue(lv, logOf({ species: ["a", "a", "b"] }))).toBe(2);
    expect(goalMet(lv, logOf({ species: [] }))).toBe(false);
    expect(lv.need).toBeGreaterThanOrEqual(2);
    // 目标种类数不能超过这一带真的能碰上的鱼种数
    expect(lv.need).toBeLessThanOrEqual(speciesNear(bandCenter(lv.band)));
  });

  it("评星:又快又稳三星,压着线过关一星", () => {
    const lv = buildLevel(30);
    expect(rateLevel(lv, { secondsLeft: lv.seconds, lost: 0, castsLeft: 3 })).toBe(3);
    expect(rateLevel(lv, { secondsLeft: Math.round(lv.seconds * 0.5), lost: 1, castsLeft: 1 })).toBe(2);
    expect(rateLevel(lv, { secondsLeft: Math.round(lv.seconds * 0.25), lost: 4, castsLeft: 0 })).toBe(2);
    expect(rateLevel(lv, { secondsLeft: 1, lost: 4, castsLeft: 0 })).toBe(1);
    expect(rateLevel(lv, { secondsLeft: 0, lost: 0, castsLeft: 0 })).toBe(2);
  });

  it("没过关的两句话都不批评孩子", () => {
    expect(loseLine("time")).toContain("时间");
    expect(loseLine("casts")).toContain("竿");
    for (const line of [loseLine("time"), loseLine("casts")]) {
      expect(line).not.toContain("笨");
      expect(line).not.toContain("失败");
    }
  });

  it("越深的水期望分数和期望重量都更高", () => {
    const shallow = expectCatch(4);
    const deep = expectCatch(45);
    expect(deep.score).toBeGreaterThan(shallow.score);
    expect(deep.weight).toBeGreaterThan(shallow.weight);
    expect(shallow.score).toBeGreaterThan(0);
  });

  it("关卡随机源可复现,换个盐就换一串", () => {
    const lv = buildLevel(5);
    expect(levelRandom(lv)()).toBe(levelRandom(lv)());
    expect(levelRandom(lv, 1)()).not.toBe(levelRandom(lv, 2)());
  });
});

// ---------------------------------------------------------------------------
// 全 188 关可通关性模拟
// ---------------------------------------------------------------------------

/** 蓄力到指定深度要按住多久(力度条是 0→1→0 的三角波,取上升段) */
function chargeMs(depth: number): number {
  return (depth / MAX_DEPTH) * (CHARGE_CYCLE_MS / 2);
}

type Style = "good" | "hold" | "idle";

/** 一条鱼的拉扯:good = 一收一放;hold = 一直按住;idle = 一直不收 */
function fightOnce(params: ReturnType<typeof fightParams>, style: Style): { landed: boolean; ms: number } {
  let st = newFight();
  let reeling = true;
  let guard = 0;
  while (st.status === "fighting" && guard < 3000) {
    reeling = style === "good" ? autoReel(st, 0.34, 0.6, reeling) : style === "hold";
    st = stepFight(st, params, reeling, 16);
    guard++;
  }
  return { landed: st.status === "landed", ms: st.elapsedMs };
}

interface FishOutcome extends LevelOutcome {
  got: number;
  casts: number;
}

/**
 * 用固定手法把一关跑完:
 * 抛竿永远瞄鱼群带中心,拉扯按 style 的手法,计分不算连击也不算完美收竿(留足余量)。
 */
function simulate(idx: number, rand: Rng, style: Style): FishOutcome {
  const lv = buildLevel(idx);
  const depth = bandCenter(lv.band);
  let remainMs = lv.seconds * 1000;
  let casts = lv.casts;
  let log = emptyLog();

  while (casts > 0 && remainMs > 0) {
    casts -= 1;
    // 瞄准 + 蓄力 + 下沉 + 等咬钩;瞄准给 260 毫秒的反应时间
    remainMs -= 260 + chargeMs(depth) + sinkMs(depth) + biteDelayMs(rand, depth);
    if (remainMs <= 0) break;
    const fish = pickFish(depth, rand, BAND_LUCK);
    const out = fightOnce(fightParams(fish, lv.hardness), style);
    remainMs -= out.ms;
    if (out.landed) {
      log = {
        count: log.count + 1,
        score: log.score + catchScore(fish, { inBand: true }),
        weight: log.weight + fish.weight,
        species: log.species.includes(fish.id) ? log.species : [...log.species, fish.id],
      };
      if (goalMet(lv, log)) {
        return { win: true, got: goalValue(lv, log), casts: lv.casts - casts };
      }
    }
    // 结算完这一条才判时间:和真实玩法一致,手上的鱼不会被时间掐掉
    remainMs -= 420;
  }

  return {
    win: false,
    got: goalValue(lv, log),
    casts: lv.casts - casts,
    note: `${goalText(lv)},只完成 ${goalValue(lv, log)}(用了 ${lv.casts - casts} 竿,剩 ${Math.round(remainMs / 1000)} 秒)`,
  };
}

function spec(style: Style) {
  return {
    game: `钓鱼小达人(${style === "good" ? "标准手法" : style === "hold" ? "一直按住" : "一直不收线"})`,
    total: TOTAL,
    label: (i: number) => `${CHAPTERS[buildLevel(i).chapter].name} · ${goalText(buildLevel(i))}`,
    play: (i: number, rng: Rng) => simulate(i, rng, style),
  };
}

describe("全 188 关可通关性", () => {
  it("标准手法把 188 关从头打到尾,一关都不卡", () => {
    const report = runCampaign(spec("good"), { seeds: [1, 2, 3, 4, 5], mode: "every" });
    expect(report.ran).toBe(TOTAL);
    expect(report.failures, formatReport(report)).toEqual([]);
    expect(assertAllWin(report)).toBe(true);
  });

  it("最后一章的大鱼关也留得下足够的时间余量", () => {
    const report = runCampaign(spec("good"), { from: 165, seeds: [4, 5, 6, 7], mode: "every" });
    expect(report.passed).toBe(report.ran);
    expect(report.ran).toBe(TOTAL - 165);
  });

  it("一直按住不放会断线,几关抽查下来一关都赢不了", () => {
    const report = runMustLose(spec("hold"), [0, 40, 90, 140, 187], [1, 2]);
    expect(report.failures, formatReport(report)).toEqual([]);
  });

  it("一直不收线会跑鱼,同样一关都赢不了", () => {
    const report = runMustLose(spec("idle"), [0, 40, 90, 140, 187], [1, 2]);
    expect(report.failures, formatReport(report)).toEqual([]);
  });
});
