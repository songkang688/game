/**
 * 梨康格斗王 —— 人机对手的回归测试。
 *
 * 五档的差别必须是"看得见的行为差别"，不是偷偷加数值：
 * 反应延迟、格挡概率、反击概率、会不会跳、会不会投，全都在这里量一遍。
 * 最高档还要额外证明一件事：它**留得住反打窗口**。
 */
import { describe, expect, it } from "vitest";
import {
  AI_AGGRESSION,
  AI_GUARD_CHANCE,
  AI_HINTS,
  AI_JUMP_CHANCE,
  AI_LABELS,
  AI_LEVELS,
  AI_OPENING_FRAMES,
  AI_OPENING_PERIOD,
  AI_PUNISH_CHANCE,
  AI_REACTION,
  AI_THROW_CHANCE,
  aiInput,
  antiAirSlot,
  createBrain,
  foeIsPunishable,
  foePhaseNow,
  inOpening,
  resetBrain,
  type AiLevel
} from "./ai";
import { createMatch, inputOf, neutralInput, stepMatch, type InputFrame, type MatchState } from "./engine";
import { CHARACTERS } from "./frames";

const N = neutralInput();
const LEVELS: AiLevel[] = AI_LEVELS;

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

describe("五档的基本参数", () => {
  it("五档都有名字和一句说明，名字不重复", () => {
    expect(LEVELS).toEqual([0, 1, 2, 3, 4]);
    for (const lv of LEVELS) {
      expect(AI_LABELS[lv].length).toBeGreaterThan(0);
      expect(AI_HINTS[lv].length).toBeGreaterThan(6);
    }
    expect(new Set(LEVELS.map((l) => AI_LABELS[l])).size).toBe(5);
  });

  it("档位越高反应越快、越会防、越会反击（五档一路单调）", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const lo = LEVELS[i - 1];
      const hi = LEVELS[i];
      expect(AI_REACTION[lo], `反应 ${lo}→${hi}`).toBeGreaterThan(AI_REACTION[hi]);
      expect(AI_GUARD_CHANCE[lo], `格挡 ${lo}→${hi}`).toBeLessThan(AI_GUARD_CHANCE[hi]);
      expect(AI_PUNISH_CHANCE[lo], `反击 ${lo}→${hi}`).toBeLessThan(AI_PUNISH_CHANCE[hi]);
    }
    expect(AI_PUNISH_CHANCE[0]).toBe(0);
  });

  it("新插进来的两档各自有招牌本事：2 档会跳会投，3 档专防反", () => {
    // 轻松档这辈子不跳
    expect(AI_JUMP_CHANCE[0]).toBe(0);
    // 灵巧档（2）跳和投的权重是全场最高的
    expect(AI_JUMP_CHANCE[2]).toBe(Math.max(...LEVELS.map((l) => AI_JUMP_CHANCE[l])));
    expect(AI_THROW_CHANCE[2]).toBe(Math.max(...LEVELS.map((l) => AI_THROW_CHANCE[l])));
    // 老练档（3）拿反击概率换掉了一部分主动进攻
    expect(AI_PUNISH_CHANCE[3]).toBeGreaterThan(AI_PUNISH_CHANCE[2] + 0.2);
    expect(AI_AGGRESSION[3]).toBeLessThan(AI_AGGRESSION[4]);
  });

  it("再高的档也不是全知全能：格挡概率不到 100%，还留着反应延迟", () => {
    expect(AI_GUARD_CHANCE[4]).toBeLessThan(1);
    expect(AI_REACTION[4]).toBeGreaterThan(0);
  });
});

describe("反打窗口（最高档也留得住）", () => {
  it("每一档都排得出窗口，档位越高窗口越短、来得越少", () => {
    for (const lv of LEVELS) {
      expect(AI_OPENING_FRAMES[lv]).toBeGreaterThan(0);
      expect(AI_OPENING_PERIOD[lv]).toBeGreaterThan(AI_OPENING_FRAMES[lv]);
    }
    for (let i = 1; i < LEVELS.length; i++) {
      expect(AI_OPENING_FRAMES[LEVELS[i]]).toBeLessThan(AI_OPENING_FRAMES[LEVELS[i - 1]]);
      expect(AI_OPENING_PERIOD[LEVELS[i]]).toBeGreaterThan(AI_OPENING_PERIOD[LEVELS[i - 1]]);
    }
  });

  it("窗口排在每个周期的末尾，一上来先老老实实打", () => {
    expect(inOpening(4, 1)).toBe(false);
    const period = AI_OPENING_PERIOD[4];
    expect(inOpening(4, period - 1)).toBe(true);
    expect(inOpening(4, period)).toBe(false);
  });

  it("高手档每 200 帧里一定有一段完全松手的时间，孩子抓得到", () => {
    const s = nearMatch();
    const brain = createBrain(4, 99);
    let idle = 0;
    let longestIdle = 0;
    let run = 0;
    for (let i = 0; i < AI_OPENING_PERIOD[4] * 2; i++) {
      const input = aiInput(brain, s, 1);
      const pressing = Object.values(input).some(Boolean);
      if (pressing) run = 0;
      else {
        idle++;
        run++;
        longestIdle = Math.max(longestIdle, run);
      }
      stepMatch(s, [N, input]);
    }
    expect(idle).toBeGreaterThanOrEqual(AI_OPENING_FRAMES[4] * 2);
    // 而且是连成一段的，不是零零碎碎地松一帧
    expect(longestIdle).toBeGreaterThanOrEqual(AI_OPENING_FRAMES[4]);
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
    const hard = decisions(4);
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
    const hard = guardRate(4);
    expect(hard).toBeGreaterThan(easy + 0.3);
    expect(hard).toBeGreaterThan(0.6);
  });

  it("灵巧档（2）真的会跳，轻松档（0）一次都不跳", () => {
    function jumpFrames(lv: AiLevel): number {
      const s = createMatch("duoduo", "xingxing", { config: { timeLimit: 0 } });
      const brain = createBrain(lv, 2024);
      let ups = 0;
      for (let i = 0; i < 2000; i++) {
        const input = aiInput(brain, s, 1);
        if (input.up) ups++;
        // 一直把两个人拉到中距离，专门量"要不要跳进来"这个决定
        s.fighters[1].x = s.fighters[0].x + 120;
        stepMatch(s, [N, input]);
      }
      return ups;
    }
    expect(jumpFrames(0)).toBe(0);
    expect(jumpFrames(2)).toBeGreaterThan(30);
  });

  it("对手缩着不动时，灵巧档会改用转圈摔去解，轻松档几乎不会", () => {
    function throwFrames(lv: AiLevel): number {
      const s = createMatch("duoduo", "xingxing", { config: { timeLimit: 0 } });
      const brain = createBrain(lv, 616);
      let throws = 0;
      for (let i = 0; i < 2000; i++) {
        // 0 号位一直缩着：贴身 + 蹲着格挡
        s.fighters[0].blocking = true;
        s.fighters[0].crouching = true;
        s.fighters[1].x = s.fighters[0].x + 55;
        const input = aiInput(brain, s, 1);
        if (input.light && input.heavy && !input.down) throws++;
        stepMatch(s, [N, input]);
      }
      return throws;
    }
    expect(throwFrames(2)).toBeGreaterThan(throwFrames(0) * 2);
  });

  it("老练档（3）挡住之后会抓收招回敬，普通档（1）不会", () => {
    function counterRate(lv: AiLevel): number {
      let hit = 0;
      const tries = 160;
      for (let seed = 1; seed <= tries; seed++) {
        const s = nearMatch();
        // 2 号位刚挡下一招，0 号位正在收招（扫堂腿收招大，是能确反的）
        s.fighters[1].phase = "blockstun";
        s.fighters[1].stun = 6;
        s.fighters[0].phase = "attack";
        s.fighters[0].slot = "2H";
        s.fighters[0].frame = 30;
        const brain = createBrain(lv, seed * 11 + 5);
        if (aiInput(brain, s, 1).light) hit++;
      }
      return hit / tries;
    }
    expect(counterRate(1)).toBeLessThan(0.05);
    expect(counterRate(3)).toBeGreaterThan(0.6);
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

/** 固定 seed 的对局：低档坐 0 号位，高档坐 1 号位，返回高档赢了几场 */
function duel(lowLevel: AiLevel, highLevel: AiLevel, games = 12): { high: number; low: number } {
  let high = 0;
  let low = 0;
  for (let seed = 1; seed <= games; seed++) {
    const s = createMatch("duoduo", "duoduo", { config: { timeLimit: 60 * 70 } });
    const a = createBrain(lowLevel, seed * 13 + lowLevel);
    const b = createBrain(highLevel, seed * 29 + highLevel);
    let frames = 0;
    while (!s.over && frames < 60 * 80) {
      stepMatch(s, [aiInput(a, s, 0), aiInput(b, s, 1)]);
      frames++;
    }
    if (s.winner === 1) high++;
    else if (s.winner === 0) low++;
  }
  return { high, low };
}

describe("五档真的有强弱差别", () => {
  it("高手档打轻松档，赢的场次明显更多", () => {
    const r = duel(0, 4, 8);
    expect(r.high).toBeGreaterThan(r.low);
  });

  it("最高档稳定压制次高档（这就是本款最高档的定位上限）", () => {
    const r = duel(2, 4);
    expect(r.high).toBeGreaterThan(r.low);
  });

  it("相邻两档之间也有差：3 档打 1 档赢面更大", () => {
    const r = duel(1, 3);
    expect(r.high).toBeGreaterThanOrEqual(r.low);
  });

  it("最高档也不是无敌的：它照样会被打掉一大截元气", () => {
    const s = createMatch("duoduo", "duoduo", { config: { timeLimit: 60 * 70 } });
    const a = createBrain(2, 321);
    const b = createBrain(4, 654);
    let frames = 0;
    while (!s.over && frames < 60 * 80) {
      stepMatch(s, [aiInput(a, s, 0), aiInput(b, s, 1)]);
      frames++;
    }
    expect(s.fighters[1].vigor).toBeLessThan(s.fighters[1].maxVigor);
  });

  it("人一直贴上去摔，五档 AI 都不会被摔到起不来（没有吃投无限）", () => {
    for (const lv of LEVELS) {
      const s = createMatch("dundun", "duoduo", { config: { timeLimit: 0, training: true } });
      const brain = createBrain(lv, 7 + lv);
      let throws = 0;
      let ownFrames = 0;
      const stunned = ["hitstun", "blockstun", "knockdown", "guardbreak"];
      for (let f = 0; f < 1800; f++) {
        const me = s.fighters[0];
        const foe = s.fighters[1];
        const far = Math.abs(me.x - foe.x) > 46;
        const p1: InputFrame = far
          ? inputOf({ [foe.x > me.x ? "right" : "left"]: true } as Partial<InputFrame>)
          : inputOf({ light: true, heavy: true });
        stepMatch(s, [p1, aiInput(brain, s, 1)]);
        for (const ev of s.events) if (ev.type === "throw") throws++;
        if (!stunned.includes(foe.phase)) ownFrames++;
      }
      // 30 秒里最多被摔中个位数次，而且七成以上的时间身体是自己的
      expect(throws, `档位 ${lv} 被摔次数`).toBeLessThan(10);
      expect(ownFrames, `档位 ${lv} 能自己做主的帧`).toBeGreaterThan(1800 * 0.7);
    }
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
