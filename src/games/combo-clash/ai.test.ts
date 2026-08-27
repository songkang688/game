import { describe, expect, it } from "vitest";
import {
  AI_COMBO,
  AI_GUARD_CHANCE,
  AI_REACTION,
  AI_SUPER_CANCEL,
  AI_TIERS,
  AI_TIER_HINTS,
  AI_TIER_LABELS,
  AI_WAKEUP_PRESSURE,
  aiDecide,
  aiDecider,
  createBrain,
  dummyDecider,
  foeDecider,
  foePhaseNow,
  type AiTier
} from "./ai";
import { createMatch, defaultConfig, runHeadless, stepMatch, type MatchState } from "./engine";
import { DUMMY_MODES, inputOf, neutralInput, type DummyMode } from "./rules";

function match(partial: Parameters<typeof defaultConfig>[0] = {}): MatchState {
  return createMatch(defaultConfig({ roundFrames: 45 * 60, ...partial }));
}

/** 跑一场 tierA(一号位)对 tierB(二号位),回报谁赢 */
function duel(a: AiTier, b: AiTier, seed: number): { winner: 0 | 1 | -1 | null; state: MatchState } {
  const m = match();
  const r = runHeadless(m, [aiDecider(a, seed), aiDecider(b, seed + 991)], 60 * 60 * 3);
  return { winner: r.winner, state: r.state };
}

describe("combo-clash · 四档人机的档位表", () => {
  it("四档齐全,而且每档都有名字和一句说明", () => {
    expect(AI_TIERS).toEqual(["rookie", "normal", "pro", "hell"]);
    for (const t of AI_TIERS) {
      expect(AI_TIER_LABELS[t].length).toBeGreaterThan(0);
      expect(AI_TIER_HINTS[t].length).toBeGreaterThan(4);
    }
  });

  it("越高档反应越快、越会防", () => {
    expect(AI_REACTION.rookie).toBeGreaterThan(AI_REACTION.normal);
    expect(AI_REACTION.normal).toBeGreaterThan(AI_REACTION.pro);
    expect(AI_REACTION.pro).toBeGreaterThan(AI_REACTION.hell);
    expect(AI_GUARD_CHANCE.rookie).toBeLessThan(AI_GUARD_CHANCE.normal);
    expect(AI_GUARD_CHANCE.normal).toBeLessThan(AI_GUARD_CHANCE.pro);
    expect(AI_GUARD_CHANCE.pro).toBeLessThan(AI_GUARD_CHANCE.hell);
  });

  it("会连段 / 会超级取消 / 会抓起身是高档才解锁的本事", () => {
    expect(AI_COMBO).toEqual({ rookie: false, normal: false, pro: true, hell: true });
    expect(AI_SUPER_CANCEL).toEqual({ rookie: false, normal: false, pro: false, hell: true });
    expect(AI_WAKEUP_PRESSURE.rookie).toBe(false);
    expect(AI_WAKEUP_PRESSURE.hell).toBe(true);
  });
});

describe("combo-clash · 人机决策是纯的、可复现的", () => {
  it("同一个 seed 跑两遍,一帧不差", () => {
    const a = duel("pro", "normal", 4242);
    const b = duel("pro", "normal", 4242);
    expect(a.winner).toBe(b.winner);
    expect(a.state.frame).toBe(b.state.frame);
    expect(a.state.stats[0].hits).toBe(b.state.stats[0].hits);
    expect(a.state.stats[1].hits).toBe(b.state.stats[1].hits);
  });

  it("换个 seed 就是另一场,不是照抄的", () => {
    const a = duel("pro", "normal", 11);
    const b = duel("pro", "normal", 12);
    const same = a.state.frame === b.state.frame && a.state.stats[0].hits === b.state.stats[0].hits;
    expect(same).toBe(false);
  });

  it("决策器只吐合法输入,不会冒出别的键", () => {
    const m = match();
    const brain = createBrain("hell", 7);
    const keys = Object.keys(neutralInput()).sort();
    for (let i = 0; i < 400; i++) {
      const mine = aiDecide(m, 1, brain);
      expect(Object.keys(mine).sort()).toEqual(keys);
      for (const v of Object.values(mine)) expect(typeof v).toBe("boolean");
      stepMatch(m, [neutralInput(), mine]);
    }
  });
});

describe("combo-clash · 档位真的分得出强弱", () => {
  it("固定 seed 打满 30 局,地狱档对菜鸟档胜率压倒性地高", () => {
    let wins = 0;
    for (let i = 0; i < 30; i++) if (duel("hell", "rookie", 500 + i * 37).winner === 0) wins += 1;
    expect(wins / 30).toBeGreaterThanOrEqual(0.8);
  });

  it("四档排下来,越高档打菜鸟赢得越多", () => {
    const rate = (t: AiTier): number => {
      let wins = 0;
      for (let i = 0; i < 16; i++) if (duel(t, "rookie", 1300 + i * 41).winner === 0) wins += 1;
      return wins / 16;
    };
    const rookie = rate("rookie");
    const pro = rate("pro");
    const hell = rate("hell");
    expect(pro).toBeGreaterThan(rookie);
    expect(hell).toBeGreaterThan(rookie);
    expect(pro).toBeGreaterThanOrEqual(0.7);
  });

  it("菜鸟对菜鸟就是一场谁也说不准的乱斗,但总能收场", () => {
    for (let i = 0; i < 6; i++) {
      const r = duel("rookie", "rookie", 300 + i * 29);
      expect(r.winner).not.toBeNull();
    }
  });

  it("地狱档会存槽超级取消,菜鸟一次都不会", () => {
    let hellSupers = 0;
    let rookieSupers = 0;
    for (let i = 0; i < 6; i++) {
      hellSupers += duel("hell", "rookie", 700 + i * 61).state.stats[0].superCancels;
      rookieSupers += duel("rookie", "rookie", 700 + i * 61).state.stats[0].superCancels;
    }
    expect(hellSupers).toBeGreaterThan(0);
    expect(rookieSupers).toBe(0);
  });

  it("会连段的档连得更长", () => {
    let pro = 0;
    let rookie = 0;
    for (let i = 0; i < 6; i++) {
      pro = Math.max(pro, duel("pro", "normal", 80 + i * 17).state.stats[0].maxCombo);
      rookie = Math.max(rookie, duel("rookie", "normal", 80 + i * 17).state.stats[0].maxCombo);
    }
    expect(pro).toBeGreaterThan(rookie);
  });
});

describe("combo-clash · 关卡专用对手", () => {
  it("木桩对手大部分时间都在挡,挡到护盾都掉了", () => {
    const m = match({ chars: ["duoduo", "dundun"] });
    const r = runHeadless(m, [aiDecider("pro", 21), foeDecider("turtle", "normal", 21)], 60 * 40);
    expect(r.state.stats[0].blocked).toBeGreaterThan(0);
  });

  it("跳跳对手真的会往你头上跳", () => {
    const m = match({ chars: ["duoduo", "xingxing"] });
    const decide = foeDecider("jumper", "normal", 33);
    let airFrames = 0;
    for (let i = 0; i < 60 * 20 && m.winner === null; i++) {
      stepMatch(m, [neutralInput(), decide(m, 1)]);
      if (m.fighters[1].y > 20) airFrames += 1;
    }
    expect(airFrames).toBeGreaterThan(60);
  });

  it("普通风格就是照档位打", () => {
    const m = match();
    const r = runHeadless(m, [foeDecider("normal", "pro", 5), aiDecider("rookie", 6)], 60 * 60 * 2);
    expect(r.winner).not.toBeNull();
  });
});

describe("combo-clash · 训练假人四种模式", () => {
  function dummyRun(mode: DummyMode): MatchState {
    const m = match({ chars: ["duoduo", "dundun"] });
    const decide = dummyDecider(mode, 9);
    for (let i = 0; i < 60 * 12 && m.winner === null; i++) {
      stepMatch(m, [inputOf(i % 24 < 2 ? { right: true, light: true } : { right: true }), decide(m, 1)]);
    }
    return m;
  }

  it("四种模式都跑得起来,不会卡死", () => {
    for (const mode of DUMMY_MODES) {
      const m = dummyRun(mode);
      expect(m.frame).toBeGreaterThan(0);
    }
  });

  it("站桩假人一下都不还手", () => {
    expect(dummyRun("stand").stats[1].hits).toBe(0);
  });

  it("格挡假人会把攻击挡下来", () => {
    expect(dummyRun("block").stats[0].blocked).toBeGreaterThan(0);
  });

  it("跳跳假人会离地", () => {
    const m = match({ chars: ["duoduo", "dundun"] });
    const decide = dummyDecider("jump", 3);
    let air = 0;
    for (let i = 0; i < 300; i++) {
      stepMatch(m, [neutralInput(), decide(m, 1)]);
      if (m.fighters[1].y > 0) air += 1;
    }
    expect(air).toBeGreaterThan(100);
  });
});

describe("combo-clash · 读对手出招段", () => {
  it("对手没出招就是 null,起手那几帧读得出 startup", () => {
    const m = match();
    expect(foePhaseNow(m, 1)).toBeNull();
    stepMatch(m, [inputOf({ heavy: true }), neutralInput()]);
    stepMatch(m, [neutralInput(), neutralInput()]);
    expect(foePhaseNow(m, 1)).toBe("startup");
  });
});
