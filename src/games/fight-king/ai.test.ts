/**
 * 朵星格斗王 —— 人机对手的回归测试。
 *
 * 三档的差别必须是"看得见的行为差别"，不是偷偷加数值：
 * 反应延迟、格挡概率、反击概率，三样都在这里量一遍。
 */
import { describe, expect, it } from "vitest";
import {
  AI_GUARD_CHANCE,
  AI_HINTS,
  AI_LABELS,
  AI_PUNISH_CHANCE,
  AI_REACTION,
  aiInput,
  antiAirSlot,
  createBrain,
  foeIsPunishable,
  foePhaseNow,
  resetBrain,
  type AiLevel
} from "./ai";
import { createMatch, neutralInput, stepMatch, type MatchState } from "./engine";
import { CHARACTERS } from "./frames";

const N = neutralInput();
const LEVELS: AiLevel[] = [0, 1, 2];

function nearMatch(a = "duoduo", b = "xingxing"): MatchState {
  const s = createMatch(a, b, { config: { timeLimit: 60 * 90 } });
  s.fighters[0].x = 400;
  s.fighters[1].x = 460;
  return s;
}

/** 中距离摆位：够得着但没贴身，专门用来量"看到起手会不会举手挡" */
function midMatch(): MatchState {
  const s = createMatch("duoduo", "xingxing", { config: { timeLimit: 60 * 90 } });
  s.fighters[0].x = 400;
  s.fighters[1].x = 546;
  return s;
}

/** 把 0 号位摆成"正在起手"的样子 */
function foeStartsUp(s: MatchState): void {
  s.fighters[0].phase = "attack";
  s.fighters[0].slot = "5H";
  s.fighters[0].frame = 1;
  s.fighters[0].hitDone = false;
}

describe("三档的基本参数", () => {
  it("三档都有名字和一句说明", () => {
    for (const lv of LEVELS) {
      expect(AI_LABELS[lv].length).toBeGreaterThan(0);
      expect(AI_HINTS[lv].length).toBeGreaterThan(6);
    }
    expect(new Set(LEVELS.map((l) => AI_LABELS[l])).size).toBe(3);
  });

  it("档位越高反应越快、越会防、越会反击", () => {
    expect(AI_REACTION[0]).toBeGreaterThan(AI_REACTION[1]);
    expect(AI_REACTION[1]).toBeGreaterThan(AI_REACTION[2]);
    expect(AI_GUARD_CHANCE[0]).toBeLessThan(AI_GUARD_CHANCE[1]);
    expect(AI_GUARD_CHANCE[1]).toBeLessThan(AI_GUARD_CHANCE[2]);
    expect(AI_PUNISH_CHANCE[0]).toBe(0);
    expect(AI_PUNISH_CHANCE[2]).toBeGreaterThan(AI_PUNISH_CHANCE[1]);
  });

  it("再高的档也不是全知全能：格挡概率不到 100%，还留着反应延迟", () => {
    expect(AI_GUARD_CHANCE[2]).toBeLessThan(1);
    expect(AI_REACTION[2]).toBeGreaterThan(0);
  });
});

describe("输入合法性", () => {
  it("AI 给出的永远是六个布尔值，字段一个不多一个不少", () => {
    for (const lv of LEVELS) {
      const s = nearMatch();
      const brain = createBrain(lv, 5 + lv);
      for (let i = 0; i < 400; i++) {
        const input = aiInput(brain, s, 1);
        expect(Object.keys(input).sort()).toEqual(["down", "heavy", "left", "light", "right", "up"]);
        for (const v of Object.values(input)) expect(typeof v).toBe("boolean");
        stepMatch(s, [N, input]);
      }
    }
  });

  it("AI 从来不会同时按左和右", () => {
    for (const lv of LEVELS) {
      const s = nearMatch();
      const brain = createBrain(lv, 31 + lv * 3);
      for (let i = 0; i < 800; i++) {
        const input = aiInput(brain, s, 1);
        expect(input.left && input.right).toBe(false);
        stepMatch(s, [N, input]);
      }
    }
  });

  it("同一个种子跑两遍，结果一模一样（确定性）", () => {
    function record(): string {
      const s = nearMatch();
      const brain = createBrain(2, 4242);
      const out: string[] = [];
      for (let i = 0; i < 300; i++) {
        const input = aiInput(brain, s, 1);
        out.push(`${+input.left}${+input.right}${+input.up}${+input.down}${+input.light}${+input.heavy}`);
        stepMatch(s, [N, input]);
      }
      return out.join("");
    }
    expect(record()).toBe(record());
  });
});

describe("反应延迟", () => {
  it("档位越高，同样时间里重新做的决定越多", () => {
    function decisions(lv: AiLevel): number {
      const s = nearMatch();
      const brain = createBrain(lv, 777);
      let changes = 0;
      let prev = "";
      for (let i = 0; i < 600; i++) {
        const input = aiInput(brain, s, 1);
        const key = JSON.stringify(input);
        if (key !== prev) changes++;
        prev = key;
        stepMatch(s, [N, input]);
      }
      return changes;
    }
    const easy = decisions(0);
    const hard = decisions(2);
    expect(hard).toBeGreaterThan(easy);
  });
});

describe("会防会反击", () => {
  it("看到对手起手，高手档按后退键的次数远多于轻松档", () => {
    function guardRate(lv: AiLevel): number {
      let guarded = 0;
      const tries = 200;
      for (let seed = 1; seed <= tries; seed++) {
        const s = midMatch();
        foeStartsUp(s);
        const brain = createBrain(lv, seed * 17 + 3);
        // 2 号位面朝左，"后退"就是按右
        if (aiInput(brain, s, 1).right) guarded++;
      }
      return guarded / tries;
    }
    const easy = guardRate(0);
    const hard = guardRate(2);
    expect(hard).toBeGreaterThan(easy + 0.3);
    expect(hard).toBeGreaterThan(0.6);
  });

  it("能看出对手处在起手 / 命中 / 收招的哪一段", () => {
    const s = nearMatch();
    expect(foePhaseNow(s.fighters[0])).toBeNull();
    foeStartsUp(s);
    expect(foePhaseNow(s.fighters[0])).toBe("startup");
    s.fighters[0].frame = s.fighters[0].frame + 20;
    expect(foePhaseNow(s.fighters[0])).toBe("recovery");
  });

  it("对手收招露空档时认得出来这是能反击的", () => {
    const s = nearMatch();
    s.fighters[0].phase = "attack";
    s.fighters[0].slot = "2H"; // 扫堂腿收招大，是能确反的
    s.fighters[0].frame = 30;
    expect(foeIsPunishable(s.fighters[0])).toBe(true);
    s.fighters[0].slot = "5L"; // 轻击挡下来很安全
    s.fighters[0].frame = 12;
    expect(foeIsPunishable(s.fighters[0])).toBe(false);
  });

  it("八个人里七位有对空必杀，只有最慢的墩墩没有（它靠重击对空）", () => {
    const withAntiAir: string[] = [];
    for (const ch of CHARACTERS) {
      const s = createMatch(ch.id, "duoduo");
      const slot = antiAirSlot(s.fighters[0]);
      if (slot === null) continue;
      expect(ch.moves[slot as "s2"].launch, ch.id).toBeGreaterThan(0);
      expect(ch.moves[slot as "s2"].airOnly, ch.id).toBeFalsy();
      withAntiAir.push(ch.id);
    }
    expect(withAntiAir).toHaveLength(7);
    expect(withAntiAir).not.toContain("dundun");
  });

  it("没有对空必杀的角色，AI 也不会因此卡住", () => {
    const s = nearMatch("duoduo", "dundun");
    expect(antiAirSlot(s.fighters[1])).toBeNull();
    const brain = createBrain(2, 55);
    for (let i = 0; i < 400; i++) {
      const input = aiInput(brain, s, 1);
      expect(typeof input.heavy).toBe("boolean");
      stepMatch(s, [i % 30 === 0 ? { ...N, up: true } : N, input]);
    }
    expect(s.fighters[0].vigor).toBeLessThanOrEqual(s.fighters[0].maxVigor);
  });
});

describe("三档真的有强弱差别", () => {
  it("高手档打轻松档，赢的场次明显更多", () => {
    let hardWins = 0;
    let easyWins = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const s = createMatch("duoduo", "duoduo", { config: { timeLimit: 60 * 70 } });
      const easy = createBrain(0, seed * 13);
      const hard = createBrain(2, seed * 29);
      let frames = 0;
      while (!s.over && frames < 60 * 80) {
        stepMatch(s, [aiInput(easy, s, 0), aiInput(hard, s, 1)]);
        frames++;
      }
      if (s.winner === 1) hardWins++;
      else if (s.winner === 0) easyWins++;
    }
    expect(hardWins).toBeGreaterThan(easyWins);
  });

  it("轻松档也不是完全不动，它照样会走会打", () => {
    const s = nearMatch();
    const brain = createBrain(0, 8);
    let attacks = 0;
    for (let i = 0; i < 1200; i++) {
      const input = aiInput(brain, s, 1);
      if (input.light || input.heavy) attacks++;
      stepMatch(s, [N, input]);
    }
    expect(attacks).toBeGreaterThan(0);
    expect(s.fighters[0].vigor).toBeLessThan(s.fighters[0].maxVigor);
  });
});

describe("每回合重置", () => {
  it("重置之后不再照着上一回合的旧主意做", () => {
    const s = nearMatch();
    const brain = createBrain(0, 3);
    aiInput(brain, s, 1);
    expect(brain.holdLeft).toBeGreaterThan(0);
    resetBrain(brain);
    expect(brain.holdLeft).toBe(0);
    expect(brain.supersUsed).toBe(0);
    expect(brain.hold).toEqual(neutralInput());
  });
});
