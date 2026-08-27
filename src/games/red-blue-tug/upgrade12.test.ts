/**
 * 红蓝拔河 · 1.2 升级用例。
 *
 * 1.1 的两份用例(`logic.test.ts` / `levels.test.ts`)一条都没删,这里只往上加:
 * 力量模型(体力 / 脱力 / 抓绳 / 蓄力 / 帧率无关)、加油点判定与双方对称、
 * 反拉窗口的触发与封顶、三种打法的产出对比、AI 四档强度、无尽连胜、
 * 188 关抽样可达标,以及 360px 排版、两套键位、`destroy` 归零。
 */
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { LABEL_FONT_MIN, SIDE_BTN_MIN, SIDE_GAP_MIN, TUG12, ropeSag, ropeShake } from "./tuning";
import {
  beatHitIndex,
  beatTrack,
  buildBeats,
  comebackStep,
  createComeback,
  createSide,
  gripFactor,
  isCharged,
  lightGreenAt,
  nextBeatFrom,
  powerFactor,
  sideConfig,
  staminaRatio,
  stepSide,
  withinBeatWindow,
  type SideState,
} from "./force";
import {
  AI_TIERS,
  aiController,
  aiTierForLevel,
  endlessTier,
  holdController,
  mashController,
  rhythmController,
  tierIndex,
  tierOf,
  type Controller,
} from "./ai";
import {
  AI_POWER_SCALE,
  PLAYER_POWER_SCALE,
  endlessSetup,
  endlessStreak,
  levelSetup,
  measureOutput,
  simulateDuel,
  simulateEndlessRound,
  simulateLevel,
  tierLadder,
} from "./duel";
import {
  RED_KEYS,
  boundKeys,
  createDisposer,
  keySideOf,
  parseLevelParam,
  resolveInitialLevel,
  sideButtonsOverlap,
  sideLayout,
} from "./runtime";

const CFG = sideConfig();

/** 按住 / 松开一段时间,返回最后的状态与这段时间的总产出 */
function drive(
  side: SideState,
  press: boolean,
  seconds: number,
  dt = 1 / 120
): { side: SideState; impulse: number } {
  let cur = side;
  let impulse = 0;
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    const step = stepSide(cur, press, dt, CFG);
    cur = step.side;
    impulse += step.factor * dt;
  }
  return { side: cur, impulse };
}

describe("红蓝拔河 1.2 · 力量模型", () => {
  it("体力按住就掉、松开就回,而且掉多少回多少都对得上", () => {
    const start = createSide(CFG);
    expect(start.stamina).toBe(TUG12.STAMINA_MAX);
    const pulled = drive(start, true, 2).side;
    expect(pulled.stamina).toBeCloseTo(TUG12.STAMINA_MAX - TUG12.DRAIN_PER_SEC * 2, 5);
    const rested = drive(pulled, false, 1).side;
    expect(rested.stamina).toBeCloseTo(pulled.stamina + TUG12.REGEN_PER_SEC * 1, 5);
    // 回不过上限
    expect(drive(rested, false, 30).side.stamina).toBe(TUG12.STAMINA_MAX);
  });

  it("力量随体力往下掉:满力段是 1,见底前掉到五成", () => {
    expect(powerFactor(TUG12.STAMINA_MAX, false)).toBe(1);
    expect(powerFactor(TUG12.STRONG_AT, false)).toBe(1);
    expect(powerFactor(TUG12.STRONG_AT / 2, false)).toBeCloseTo(0.75, 6);
    expect(powerFactor(0, false)).toBeCloseTo(TUG12.LOW_FACTOR, 6);
    expect(powerFactor(50, false)).toBeGreaterThan(powerFactor(20, false));
  });

  it("连续猛按见底后力量骤降,而且必须松手缓回三成才恢复", () => {
    const exhausted = drive(createSide(CFG), true, 6).side;
    expect(exhausted.stamina).toBe(0);
    expect(exhausted.winded).toBe(true);
    expect(powerFactor(exhausted.stamina, exhausted.winded)).toBe(TUG12.EXHAUST_FACTOR);
    expect(TUG12.EXHAUST_FACTOR).toBeLessThan(TUG12.LOW_FACTOR);

    // 硬撑着不放手,永远缓不过来
    const stillDown = drive(exhausted, true, 4).side;
    expect(stillDown.winded).toBe(true);

    // 松手一小会儿还不够,缓过 WINDED_CLEAR 才算数
    const halfRest = drive(exhausted, false, (TUG12.WINDED_CLEAR / TUG12.REGEN_PER_SEC) * 0.5).side;
    expect(halfRest.winded).toBe(true);
    const fullRest = drive(exhausted, false, TUG12.WINDED_CLEAR / TUG12.REGEN_PER_SEC + 0.05).side;
    expect(fullRest.winded).toBe(false);
  });

  it("手要抓稳了才使得上劲:刚按下只有五成,抓满斜坡才是满力", () => {
    expect(gripFactor(0)).toBe(TUG12.GRIP_MIN);
    expect(gripFactor(TUG12.GRIP_RAMP_MS / 2)).toBeCloseTo((1 + TUG12.GRIP_MIN) / 2, 6);
    expect(gripFactor(TUG12.GRIP_RAMP_MS)).toBe(1);
    expect(gripFactor(9999)).toBe(1);
    expect(gripFactor(Number.NaN)).toBe(TUG12.GRIP_MIN);
  });

  it("松手蓄够力再按下去有一次爆发,蓄不够就没有", () => {
    expect(isCharged(TUG12.CHARGE_MS)).toBe(true);
    expect(isCharged(TUG12.CHARGE_MS - 1)).toBe(false);

    const rested = drive(createSide(CFG), false, 1).side;
    const charged = drive(rested, true, 0.45).impulse;
    // 只歇了 0.1 秒就再按下去:没有爆发
    const notCharged = drive(drive(rested, true, 0.4).side, false, 0.1).side;
    const flat = drive(notCharged, true, 0.45).impulse;
    expect(charged).toBeGreaterThan(flat);
  });

  it("同一段操作,30fps 与 120fps 推出来的产出差不到 2%", () => {
    const script = (t: number): boolean => (t % 1.6) < 0.9;
    const run = (dt: number): number => {
      let side = createSide(CFG);
      let sum = 0;
      for (let t = 0; t < 20; t += dt) {
        const step = stepSide(side, script(t), dt, CFG);
        side = step.side;
        sum += step.factor * dt;
      }
      return sum;
    };
    const slow = run(1 / 30);
    const fast = run(1 / 120);
    expect(Math.abs(slow - fast) / fast).toBeLessThan(0.02);
  });

  it("体力条的显示比例夹在 0..1,没有体力上限的关也不会算炸", () => {
    const side = createSide(CFG);
    expect(staminaRatio(side, CFG)).toBe(1);
    expect(staminaRatio({ ...side, stamina: -5 }, CFG)).toBe(0);
    expect(staminaRatio(side, { ...CFG, staminaMax: 0 })).toBe(1);
  });
});

describe("红蓝拔河 1.2 · 狂按不是最优", () => {
  const seconds = 40;
  const power = 20;
  const hold = measureOutput({ control: holdController(), seconds, power, seed: 4 });
  const mash = measureOutput({ control: mashController(8), seconds, power, seed: 4 });
  const fast = measureOutput({ control: mashController(15), seconds, power, seed: 4 });
  const rhythm = measureOutput({ control: rhythmController(), seconds, power, seed: 4 });

  it("有节奏发力的产出比狂按和一直按住都高得多", () => {
    expect(rhythm.perSecond).toBeGreaterThan(hold.perSecond * 1.3);
    expect(rhythm.perSecond).toBeGreaterThan(mash.perSecond * 1.5);
    expect(rhythm.perSecond).toBeGreaterThan(fast.perSecond * 1.5);
  });

  it("一直按住的人有大半局在脱力,狂按的人抓不稳绳子", () => {
    expect(hold.windedRatio).toBeGreaterThan(0.7);
    expect(rhythm.windedRatio).toBe(0);
    // 狂按体力不掉,产出照样上不去 —— 亏在抓绳斜坡上
    expect(mash.windedRatio).toBe(0);
    expect(mash.perSecond).toBeLessThan(rhythm.perSecond);
  });

  it("只有会松手蓄力的人才踩得到加油点", () => {
    expect(rhythm.beats).toBeGreaterThan(0);
    expect(mash.beats).toBe(0);
    expect(hold.beats).toBe(0);
  });

  it("扫一遍发力 / 换气时长,最优解是「歇半秒左右、拉一秒上下」", () => {
    let best = { pull: 0, rest: 0, rate: 0 };
    for (const pull of [300, 500, 700, 900, 1200, 1600, 2400]) {
      for (const rest of [150, 300, 560, 800, 1200]) {
        const r = measureOutput({
          control: rhythmController({ pullMs: pull, restMs: rest, beats: false }),
          seconds: 40,
          power,
          seed: 4,
        });
        if (r.perSecond > best.rate) best = { pull, rest, rate: r.perSecond };
      }
    }
    expect(best.pull).toBeGreaterThanOrEqual(500);
    expect(best.pull).toBeLessThanOrEqual(1200);
    expect(best.rest).toBeGreaterThanOrEqual(TUG12.CHARGE_MS - 240);
    expect(best.rate).toBeGreaterThan(hold.perSecond);
  });

  it("正面对拉:同样的力气,有节奏的一方稳赢狂按和一直按住的一方", () => {
    const vsMash = simulateDuel({
      red: { power: 20, control: rhythmController() },
      blue: { power: 20, control: mashController(8) },
      seed: 9,
    });
    const vsHold = simulateDuel({
      red: { power: 20, control: rhythmController() },
      blue: { power: 20, control: holdController() },
      seed: 9,
    });
    expect(vsMash.winner).toBe("red");
    expect(vsHold.winner).toBe("red");
    expect(vsMash.seconds).toBeLessThan(40);
  });
});

describe("红蓝拔河 1.2 · 加油点", () => {
  it("判定窗口就是前后各 120 毫秒", () => {
    expect(TUG12.BEAT_WINDOW_MS).toBe(120);
    expect(withinBeatWindow(4000, 4000)).toBe(true);
    expect(withinBeatWindow(4000, 4000 - 120)).toBe(true);
    expect(withinBeatWindow(4000, 4000 + 120)).toBe(true);
    expect(withinBeatWindow(4000, 4000 + 121)).toBe(false);
    expect(withinBeatWindow(4000, Number.NaN)).toBe(false);
  });

  it("踩点必须是松手蓄力之后的发力,连点蹭不到,而且一颗只能领一次", () => {
    const beats = [4000, 7000];
    expect(beatHitIndex(beats, 4050, 400, 0)).toBe(0);
    expect(beatHitIndex(beats, 4050, TUG12.BEAT_MIN_REST_MS - 1, 0)).toBe(-1);
    expect(beatHitIndex(beats, 4300, 400, 0)).toBe(-1);
    // 第 0 颗领过了,再按一次只能等下一颗
    expect(beatHitIndex(beats, 4050, 400, 1)).toBe(-1);
    expect(beatHitIndex(beats, 7000, 400, 1)).toBe(1);
  });

  it("加油点时刻表是确定的,而且红蓝共用同一串(双方完全对称)", () => {
    const a = buildBeats(42, 30_000);
    const b = buildBeats(42, 30_000);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(6);
    for (let i = 1; i < a.length; i++) {
      const gap = a[i] - a[i - 1];
      expect(gap).toBeGreaterThanOrEqual(TUG12.BEAT_GAP_MIN_MS - 1);
      expect(gap).toBeLessThanOrEqual(TUG12.BEAT_GAP_MAX_MS + 1);
    }
    // 号子章更密
    expect(buildBeats(42, 30_000, 0.62).length).toBeGreaterThan(a.length);
    expect(nextBeatFrom(a, a[0] - 1)).toBe(0);
    expect(nextBeatFrom(a, a[a.length - 1] + 1)).toBe(-1);
  });

  it("两边打法一模一样时,一整局的加油点也是对半分,谁都占不到便宜", () => {
    const r = simulateDuel({
      red: { power: 20, control: rhythmController() },
      blue: { power: 20, control: rhythmController() },
      seed: 77,
      seconds: 45,
    });
    expect(r.winner).toBe("none");
    expect(r.redBeats).toBe(r.blueBeats);
    expect(Math.abs(r.rope)).toBeLessThan(1);
  });

  it("加油点在绳子上是走过来的,正过中线那一刻位置是 0", () => {
    expect(beatTrack(5000, 5000)).toBeCloseTo(0, 6);
    expect(beatTrack(5000, 5000 - TUG12.BEAT_TRAVEL_MS)).toBeCloseTo(-1, 6);
    expect(beatTrack(5000, 5000 + TUG12.BEAT_TRAVEL_MS)).toBeCloseTo(1, 6);
    expect(beatTrack(5000, 99_999)).toBe(1);
  });
});

describe("红蓝拔河 1.2 · 反拉「拼一把」", () => {
  const edge = TUG12.COMEBACK_AT * TUG12.ROPE_WIN;

  it("只有被拉到 80% 位置的落后方才开窗口", () => {
    const fresh = createComeback();
    expect(comebackStep(fresh, -edge + 1, 1, 0, true).gain).toBe(0);
    const opened = comebackStep(fresh, -edge, 1, 0, true);
    expect(opened.opened).toBe(true);
    expect(opened.gain).toBe(TUG12.COMEBACK_GAIN);
    // 领先的一方在同样的位置什么都拿不到
    expect(comebackStep(fresh, -edge, -1, 0, true).gain).toBe(0);
    expect(comebackStep(fresh, edge, -1, 0, true).gain).toBe(TUG12.COMEBACK_GAIN);
  });

  it("窗口就是 2 秒,加成封顶 15%,过了点就没了", () => {
    expect(TUG12.COMEBACK_MS).toBe(2000);
    expect(TUG12.COMEBACK_GAIN).toBeCloseTo(0.15, 6);
    let st = createComeback();
    st = comebackStep(st, -100, 1, 0, true).state;
    expect(comebackStep(st, -100, 1, 1999, true).gain).toBe(TUG12.COMEBACK_GAIN);
    const after = comebackStep(st, -100, 1, 2000, true);
    // 冷却没到,虽然还在极端位置也不会续上
    expect(after.gain).toBe(0);
    expect(after.opened).toBe(false);
  });

  it("冷却过了才允许再开一次,不会一直挂着", () => {
    let st = createComeback();
    st = comebackStep(st, -100, 1, 0, true).state;
    const cool = TUG12.COMEBACK_MS + TUG12.COMEBACK_COOLDOWN_MS;
    expect(comebackStep(st, -100, 1, cool - 1, true).opened).toBe(false);
    const again = comebackStep(st, -100, 1, cool, true);
    expect(again.opened).toBe(true);
    expect(again.gain).toBe(TUG12.COMEBACK_GAIN);
  });

  it("开关关掉就一点加成都没有(默认是开的)", () => {
    const st = createComeback();
    expect(comebackStep(st, -100, 1, 0, false).gain).toBe(0);
    expect(comebackStep(st, -100, 1, 0, false).opened).toBe(false);
    const off = simulateDuel({
      red: { power: 20, control: rhythmController() },
      blue: { power: 26, control: rhythmController() },
      seed: 5,
      comeback: false,
    });
    expect(off.redComebacks).toBe(0);
    const on = simulateDuel({
      red: { power: 20, control: rhythmController() },
      blue: { power: 26, control: rhythmController() },
      seed: 5,
      comeback: true,
    });
    expect(on.redComebacks).toBeGreaterThan(0);
  });
});

describe("红蓝拔河 1.2 · AI 四档", () => {
  it("四档只差体力管理与节奏点命中率,命中率是单调往上的", () => {
    expect(AI_TIERS).toHaveLength(4);
    for (let i = 1; i < AI_TIERS.length; i++) {
      expect(AI_TIERS[i].beatRate).toBeGreaterThan(AI_TIERS[i - 1].beatRate);
      expect(AI_TIERS[i].jitterMs).toBeLessThan(AI_TIERS[i - 1].jitterMs);
    }
    expect(new Set(AI_TIERS.map((t) => t.key)).size).toBe(4);
    expect(tierOf("king").key).toBe("king");
    expect(tierIndex("sharp")).toBe(2);
  });

  it("固定 seed 下四档的产出严格递增(档位差可量化)", () => {
    const ladder = tierLadder(3, 45);
    expect(ladder.map((r) => r.key)).toEqual(["easy", "steady", "sharp", "king"]);
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i].perSecond).toBeGreaterThan(ladder[i - 1].perSecond);
    }
    // 头尾差距要看得出来:绳王比小苗强出一大截
    expect(ladder[3].perSecond).toBeGreaterThan(ladder[0].perSecond * 1.7);
  });

  it("同样力气对拉时,档位越高玩家赢得越吃力,最高档反过来赢玩家", () => {
    // 净拉速:赢了是正的(越快越大),输了是负的,把四档排成一条单调下降的线
    const edges = AI_TIERS.map((tier) => {
      const r = simulateDuel({
        red: { power: 20, control: rhythmController() },
        blue: { power: 20, control: aiController(tier, 31) },
        seed: 202,
        seconds: 80,
      });
      return (r.winner === "red" ? 1 : -1) * (TUG12.ROPE_WIN / r.seconds);
    });
    for (let i = 1; i < edges.length; i++) {
      expect(edges[i]).toBeLessThan(edges[i - 1]);
    }
    expect(edges[0]).toBeGreaterThan(0);
    expect(edges[3]).toBeLessThan(0);
  });

  it("同一个 seed 跑两次,逐帧结果完全一样", () => {
    const once = simulateDuel({
      red: { power: 22, control: rhythmController() },
      blue: { power: 20, control: aiController(AI_TIERS[2], 8) },
      seed: 123,
    });
    const twice = simulateDuel({
      red: { power: 22, control: rhythmController() },
      blue: { power: 20, control: aiController(AI_TIERS[2], 8) },
      seed: 123,
    });
    expect(once).toEqual(twice);
  });

  it("188 关按章节配档位,无尽按连胜升档", () => {
    expect(aiTierForLevel(0).key).toBe("easy");
    expect(aiTierForLevel(50).key).toBe("easy");
    expect(aiTierForLevel(51).key).toBe("steady");
    expect(aiTierForLevel(98).key).toBe("steady");
    expect(aiTierForLevel(99).key).toBe("sharp");
    expect(aiTierForLevel(187).key).toBe("king");
    expect(endlessTier(0).key).toBe("easy");
    expect(endlessTier(3).key).toBe("steady");
    expect(endlessTier(5).key).toBe("sharp");
    expect(endlessTier(9).key).toBe("king");
  });

  it("红灯时谁都不许拉:小电脑的大脑在红灯下一定回答不按", () => {
    const brain: Controller = aiController(AI_TIERS[3], 1);
    const side = createSide(CFG);
    expect(brain({ nowMs: 1000, side, cfg: CFG, rope: 0, green: false, beats: [], nextBeat: -1 })).toBe(false);
    expect(lightGreenAt(0)).toBe(true);
    expect(lightGreenAt(TUG12.LIGHT_GREEN_MS + 10)).toBe(false);
    expect(lightGreenAt(TUG12.LIGHT_GREEN_MS + TUG12.LIGHT_RED_MS + 10)).toBe(true);
  });
});

describe("红蓝拔河 1.2 · 188 关接上新模型", () => {
  it("老关卡数据只是换了一种读法,一个字都没被改写", () => {
    const before = JSON.stringify(LEVELS[0]);
    const setup = levelSetup(0);
    expect(JSON.stringify(LEVELS[0])).toBe(before);
    expect(setup.playerPower).toBeCloseTo(LEVELS[0].pullPower * PLAYER_POWER_SCALE, 6);
    expect(setup.aiPower).toBeCloseTo(LEVELS[0].aiRate * AI_POWER_SCALE, 6);
    expect(setup.tier.key).toBe("easy");
    expect(levelSetup(150).beatGapScale).toBeLessThan(1);
    expect(levelSetup(98).redlight).toBe(true);
    expect(levelSetup(98).offhand).toBe(true);
  });

  it("188 关逐关可达标:会蓄力、会换气、会踩加油点就都拉得赢", () => {
    const lost: number[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      if (simulateLevel(i, "rhythm").winner !== "red") lost.push(i + 1);
    }
    expect(lost).toEqual([]);
  });

  it("一局的长度是孩子扛得住的:十秒上下到最多四十秒", () => {
    let min = Infinity;
    let max = 0;
    for (let i = 0; i < LEVELS.length; i++) {
      const s = simulateLevel(i, "rhythm").seconds;
      min = Math.min(min, s);
      max = Math.max(max, s);
    }
    expect(min).toBeGreaterThan(6);
    expect(max).toBeLessThan(42);
  });

  it("第 100 关之后狂按与一直按住一关都拿不下来", () => {
    const mashWon: number[] = [];
    const holdWon: number[] = [];
    for (let i = 99; i < LEVELS.length; i++) {
      if (simulateLevel(i, "mash").winner === "red") mashWon.push(i + 1);
      if (simulateLevel(i, "hold").winner === "red") holdWon.push(i + 1);
    }
    expect(mashWon).toEqual([]);
    expect(holdWon).toEqual([]);
  });

  it("越往后越难:后段章节对手的力气明显比开局大", () => {
    expect(levelSetup(187).aiPower).toBeGreaterThan(levelSetup(0).aiPower * 2);
    expect(levelSetup(143).aiPower).toBeGreaterThan(levelSetup(60).aiPower);
  });
});

describe("红蓝拔河 1.2 · 无尽「拉不完的绳」", () => {
  it("对手随连胜变强:档位往上走,力气也往上走但有封顶", () => {
    expect(endlessSetup(0).tier.key).toBe("easy");
    expect(endlessSetup(8).tier.key).toBe("king");
    expect(endlessSetup(5).aiPower).toBeGreaterThan(endlessSetup(0).aiPower);
    expect(endlessSetup(999).aiPower).toBeCloseTo(endlessSetup(500).aiPower, 6);
    expect(endlessSetup(Number.NaN).tier.key).toBe("easy");
  });

  it("连胜一定会在某一局断掉,而且认真打能比狂按扛久得多", () => {
    const good = endlessStreak("rhythm", 5);
    const bad = endlessStreak("mash", 5);
    expect(good).toBeGreaterThan(3);
    expect(good).toBeLessThan(40);
    expect(good).toBeGreaterThan(bad);
  });

  it("头几局是给热身用的,认真打一定拿得下", () => {
    for (let s = 0; s < 3; s++) {
      expect(simulateEndlessRound(s, "rhythm").winner).toBe("red");
    }
  });
});

describe("红蓝拔河 1.2 · 手机排版与两套键位", () => {
  it("360px 上两侧按钮各自 ≥72px,中间留得下隔离带,字号 ≥14px", () => {
    const m = sideLayout(360);
    expect(m.width).toBeGreaterThanOrEqual(SIDE_BTN_MIN);
    expect(m.height).toBeGreaterThanOrEqual(SIDE_BTN_MIN);
    expect(m.gap).toBeGreaterThanOrEqual(SIDE_GAP_MIN);
    expect(m.fontSize).toBeGreaterThanOrEqual(LABEL_FONT_MIN);
    expect(m.totalWidth).toBeLessThanOrEqual(360);
    expect(sideButtonsOverlap(m)).toBe(false);
  });

  it("再窄的屏(320px)也不会把按钮压到手指按不准", () => {
    for (const w of [280, 320, 360, 414, 768, 0, Number.NaN]) {
      const m = sideLayout(w);
      expect(m.width).toBeGreaterThanOrEqual(SIDE_BTN_MIN);
      expect(m.gap).toBeGreaterThanOrEqual(SIDE_GAP_MIN);
      expect(sideButtonsOverlap(m)).toBe(false);
    }
  });

  it("两套键位各归各队,单人时空格算自己的、对手的键不接管", () => {
    expect(keySideOf("KeyF", true)).toBe("red");
    expect(keySideOf("KeyJ", true)).toBe("blue");
    expect(keySideOf("KeyJ", false)).toBeNull();
    expect(keySideOf("Space", false)).toBe("red");
    expect(keySideOf("Space", true)).toBeNull();
    expect(keySideOf("KeyQ", true)).toBeNull();
    expect(boundKeys(true).length).toBeGreaterThanOrEqual(4);
    expect(boundKeys(false)).toContain("Space");
    expect(boundKeys(false)).not.toContain("KeyJ");
    expect(RED_KEYS.length).toBeGreaterThan(0);
  });

  it("destroy 之后 rAF、定时器、两套键位监听一个都不剩", () => {
    const rafs: number[] = [];
    const timers: number[] = [];
    const bound: string[] = [];
    const target = {
      addEventListener(type: string) {
        bound.push(type);
      },
      removeEventListener(type: string) {
        bound.splice(bound.indexOf(type), 1);
      },
    };
    const gone = createDisposer({
      cancelRaf: (id) => rafs.push(id),
      clearTimer: (id) => timers.push(id),
    });
    gone.raf(1);
    gone.raf(2);
    gone.timer(11);
    gone.timer(12);
    gone.listen(target, "keydown", () => {});
    gone.listen(target, "keyup", () => {});
    expect(gone.size).toBe(5);
    expect(bound).toEqual(["keydown", "keyup"]);

    gone.dispose();
    expect(gone.disposed).toBe(true);
    expect(gone.size).toBe(0);
    expect(rafs).toEqual([2]);
    expect(timers.sort()).toEqual([11, 12]);
    expect(bound).toEqual([]);

    // 再 destroy 一次什么都不做,之后也挂不上新的东西
    gone.dispose();
    gone.listen(target, "keydown", () => {});
    expect(bound).toEqual([]);
    expect(gone.size).toBe(0);
  });

  it("直开第 N 关:越界 clamp,没解锁就退回当前能玩的最远那一关", () => {
    expect(resolveInitialLevel(12, 187)).toBe(11);
    expect(resolveInitialLevel("12", 187)).toBe(11);
    expect(resolveInitialLevel(999, 187)).toBe(187);
    expect(resolveInitialLevel(0, 187)).toBe(0);
    expect(resolveInitialLevel(50, 9)).toBe(9);
    expect(resolveInitialLevel(undefined, 9)).toBeNull();
    expect(parseLevelParam("?level=7&x=1")).toBe(7);
    expect(parseLevelParam("?nope=1")).toBeNull();
    expect(parseLevelParam("")).toBeNull();
  });

  it("prefers-reduced-motion 时绳子不抖,只靠形变表达力度", () => {
    expect(ropeShake(1.2, true)).toBe(0);
    expect(ropeShake(1.2, false)).toBeGreaterThan(0);
    expect(ropeShake(0.4, false)).toBeLessThan(ropeShake(1.2, false));
    // 力气越大绳子绷得越直
    expect(ropeSag(1.4)).toBe(0);
    expect(ropeSag(0)).toBeGreaterThan(ropeSag(1));
  });
});
