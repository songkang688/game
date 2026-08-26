import { describe, expect, it } from "vitest";
import { LEVELS, type TugLevel } from "./levels";
import {
  CASUAL_PLAY,
  CHANT_BURST,
  CHANT_OFFBEAT_FACTOR,
  CHANT_WINDOW_MS,
  SKILLED_PLAY,
  STAMINA_RESUME_RATIO,
  SUPPLY_BUFF,
  SUPPLY_DEBUFF,
  TIRED_PULL_FACTOR,
  WIN_AT,
  adaptiveAiRate,
  chantReady,
  endlessAiRate,
  endlessHasLight,
  endlessPullPower,
  isNewRecord,
  mechanicsOf,
  nextChant,
  onChant,
  simulateTug,
  staminaPullFactor,
  staminaResumeAt
} from "./logic";

function level(patch: Partial<TugLevel> = {}): TugLevel {
  return { aiRate: 10, pullPower: 3, star: false, redlight: false, rhythm: false, theme: 9, ...patch };
}

describe("红蓝拔河 · 号子连击", () => {
  it("拉的间隔落在号子容差里才算踩上", () => {
    expect(onChant(280, 280)).toBe(true);
    expect(onChant(280 - CHANT_WINDOW_MS, 280)).toBe(true);
    expect(onChant(280 + CHANT_WINDOW_MS + 1, 280)).toBe(false);
    expect(onChant(280, 0)).toBe(false);
  });

  it("踩上号子齐心值 +1，跟丢就清零", () => {
    const cfg = level({ chantMs: 280, chantMax: 8 });
    expect(nextChant(0, 280, cfg)).toBe(1);
    expect(nextChant(5, 280, cfg)).toBe(6);
    expect(nextChant(5, 60, cfg)).toBe(0);
    expect(nextChant(3, 280, level())).toBe(0);
  });

  it("齐心值攒满才触发猛拉，没有号子的关永远不触发", () => {
    const cfg = level({ chantMs: 280, chantMax: 8 });
    expect(chantReady(7, cfg)).toBe(false);
    expect(chantReady(8, cfg)).toBe(true);
    expect(chantReady(99, level())).toBe(false);
    expect(CHANT_BURST).toBeGreaterThan(10);
    expect(CHANT_OFFBEAT_FACTOR).toBeLessThan(1);
  });

  it("不跟号子就使不上劲：同一关会被拉回去", () => {
    const cfg = LEVELS[155];
    expect(simulateTug(cfg, SKILLED_PLAY).won).toBe(true);
    expect(simulateTug(cfg, { ...SKILLED_PLAY, keepChant: false }).won).toBe(false);
  });
});

describe("红蓝拔河 · 体力条", () => {
  it("体力见底力气减半，没启用体力条的关永远满力", () => {
    const cfg = level({ stamina: 22, staminaRegen: 5 });
    expect(staminaPullFactor(10, cfg)).toBe(1);
    expect(staminaPullFactor(0.5, cfg)).toBe(TIRED_PULL_FACTOR);
    expect(staminaPullFactor(0, level())).toBe(1);
  });

  it("松手换气要回到四成体力才缓得过来", () => {
    expect(staminaResumeAt(level({ stamina: 25 }))).toBeCloseTo(25 * STAMINA_RESUME_RATIO, 10);
    expect(staminaResumeAt(level())).toBe(0);
  });

  it("不换气就撑不到最后：沙丘章末尾会被反超", () => {
    const cfg = LEVELS[121];
    expect(simulateTug(cfg, SKILLED_PLAY).won).toBe(true);
    expect(simulateTug(cfg, { ...SKILLED_PLAY, pace: false }).won).toBe(false);
  });
});

describe("红蓝拔河 · 补给争夺与读招电脑", () => {
  it("抢到补给自己变强，被抢走就轮到对手变强", () => {
    expect(SUPPLY_BUFF).toBeGreaterThan(1);
    expect(SUPPLY_DEBUFF).toBeGreaterThan(1);
    const cfg = LEVELS[130];
    const grabbed = simulateTug(cfg, SKILLED_PLAY);
    expect(grabbed.supplies).toBeGreaterThan(0);
    expect(simulateTug(cfg, { ...SKILLED_PLAY, grab: false }).won).toBe(false);
  });

  it("绳子越靠你这边它拉得越凶，被它拉过中线反而会收力", () => {
    const cfg = level({ aiRate: 12, aiAdapt: 0.3 });
    expect(adaptiveAiRate(cfg, 0)).toBeCloseTo(12, 10);
    expect(adaptiveAiRate(cfg, 80)).toBeGreaterThan(12);
    expect(adaptiveAiRate(cfg, -80)).toBeLessThan(12);
    expect(adaptiveAiRate(level({ aiRate: 9 }), 90)).toBe(9);
  });

  it("胜负线就是 ±100，读招也不会让它拉力归零", () => {
    expect(WIN_AT).toBe(100);
    expect(adaptiveAiRate(level({ aiRate: 12, aiAdapt: 1 }), -100)).toBeGreaterThan(0);
  });
});

describe("红蓝拔河 · 机制清单", () => {
  it("按关卡配置列出本关启用的新玩法", () => {
    expect(mechanicsOf(level())).toEqual([]);
    expect(mechanicsOf(level({ stamina: 20 }))).toEqual(["体力条"]);
    expect(mechanicsOf(level({ stamina: 20, supply: true, chantMs: 280, aiAdapt: 0.2 }))).toEqual([
      "体力条",
      "补给争夺",
      "号子连击",
      "读招电脑"
    ]);
  });
});

describe("红蓝拔河 · 无尽绳王连胜", () => {
  it("对手一局比一局有劲，但有封顶", () => {
    expect(endlessAiRate(0)).toBeCloseTo(6.5, 10);
    expect(endlessAiRate(5)).toBeGreaterThan(endlessAiRate(0));
    expect(endlessAiRate(9999)).toBe(19);
    expect(endlessAiRate(Number.NaN)).toBeCloseTo(6.5, 10);
  });

  it("自己的力气也会涨一点，但追不上对手的涨幅", () => {
    expect(endlessPullPower(0)).toBeCloseTo(2.8, 10);
    expect(endlessPullPower(6)).toBeGreaterThan(endlessPullPower(0));
    expect(endlessPullPower(9999)).toBe(3.6);
    expect(endlessAiRate(9999) / endlessPullPower(9999)).toBeGreaterThan(endlessAiRate(0) / endlessPullPower(0));
  });

  it("第 4 局起隔局加红绿灯裁判", () => {
    expect(endlessHasLight(0)).toBe(false);
    expect(endlessHasLight(2)).toBe(false);
    expect(endlessHasLight(3)).toBe(true);
    expect(endlessHasLight(4)).toBe(false);
    expect(endlessHasLight(5)).toBe(true);
  });

  it("无尽模式一定会在某一局输掉，不会无限连胜", () => {
    let round = 0;
    while (round < 60) {
      const cfg = level({
        aiRate: endlessAiRate(round),
        pullPower: endlessPullPower(round),
        star: round >= 2,
        redlight: endlessHasLight(round),
        theme: 9
      });
      if (!simulateTug(cfg, SKILLED_PLAY).won) break;
      round++;
    }
    expect(round).toBeGreaterThan(2);
    expect(round).toBeLessThan(60);
  });

  it("破纪录判定：0 连胜不算", () => {
    expect(isNewRecord(6, 5)).toBe(true);
    expect(isNewRecord(5, 5)).toBe(false);
    expect(isNewRecord(0, 0)).toBe(false);
  });
});

describe("红蓝拔河 · 无头对局模拟器本身可信", () => {
  it("同一关跑两次结果完全一样（确定性）", () => {
    expect(simulateTug(LEVELS[175], SKILLED_PLAY)).toEqual(simulateTug(LEVELS[175], SKILLED_PLAY));
  });

  it("红灯硬拉真的会倒退：不看灯就拔不赢带灯的关", () => {
    const cfg = LEVELS[166];
    expect(cfg.redlight).toBe(true);
    expect(simulateTug(cfg, SKILLED_PLAY).won).toBe(true);
    expect(simulateTug(cfg, { ...SKILLED_PLAY, watchLight: false }).won).toBe(false);
  });

  it("手速慢到离谱就一定输", () => {
    const r = simulateTug(LEVELS[187], { ...CASUAL_PLAY, tapsPerSec: 1 });
    expect(r.won).toBe(false);
    expect(r.pos).toBeLessThanOrEqual(-WIN_AT);
  });
});
