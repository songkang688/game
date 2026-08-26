/**
 * 红蓝拔河 · 1.2 无头对局模拟器。
 *
 * 1.1 的 `simulateTug` 是「点一下加固定量」的老模型,前 99 关的可通关性用例还靠它,
 * 一行都没动;这里是 1.2 连续力量模型的那一套 —— 红蓝两侧各跑一个 `Controller`,
 * 共用同一串加油点,红灯、反拉、读招全按实机的规则算,同一个 seed 结果逐帧一致。
 *
 * 有了它,「狂按不是最优」「AI 四档强度单调」「188 关抽样可达标」这些话
 * 才是能被用例钉住的事实,而不是感觉。
 */
import { LEVELS, type TugLevel } from "./levels";
import { adaptiveAiRate, endlessAiRate } from "./logic";
import { TUG12, type Tuning } from "./tuning";
import {
  beatHitIndex,
  buildBeats,
  comebackStep,
  createComeback,
  createSide,
  lightGreenAt,
  nextBeatFrom,
  sideConfig,
  stepSide,
  type SideConfig,
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
  type AiTier,
  type Controller,
} from "./ai";

/** 1.1 的 `pullPower`(一次点击拉多少)折成 1.2 的「满力每秒拉多少」 */
export const PLAYER_POWER_SCALE = 8;
/** 1.1 的 `aiRate`(每秒匀速拉多少)折成 1.2 的「满力每秒拉多少」 */
export const AI_POWER_SCALE = 1.12;

export interface DuelSideSetup {
  /** 满力时每秒拉多少 */
  power: number;
  control: Controller;
  stamina?: Partial<SideConfig>;
}

export interface DuelOptions {
  red: DuelSideSetup;
  blue: DuelSideSetup;
  seed?: number;
  /** 打满这么多秒还没分出胜负就算平局 */
  seconds?: number;
  /** 反拉「拼一把」开关,默认开 */
  comeback?: boolean;
  /** 有没有加油点,默认有 */
  beats?: boolean;
  /** 加油点间隔的缩放:小于 1 表示更密 */
  beatGapScale?: number;
  /** 有没有红绿灯裁判 */
  redlight?: boolean;
  /** 读招强度:蓝方落后时拉得更凶(对应 1.1 的 `aiAdapt`) */
  aiAdapt?: number;
  /** 步长,默认 1/120 秒 */
  dt?: number;
  tune?: Tuning;
}

export interface DuelResult {
  winner: "red" | "blue" | "none";
  /** 分出胜负用了多少秒;没分出来就是打满的时长 */
  seconds: number;
  rope: number;
  redBeats: number;
  blueBeats: number;
  redComebacks: number;
  blueComebacks: number;
  /** 双方累计拉力(不含加油点),用来量化「谁的力气没白费」 */
  redOutput: number;
  blueOutput: number;
}

interface Runner {
  side: SideState;
  cfg: SideConfig;
  control: Controller;
  power: number;
  beatFrom: number;
  beats: number;
  comeback: ReturnType<typeof createComeback>;
  comebacks: number;
  output: number;
}

function makeRunner(setup: DuelSideSetup, tune: Tuning): Runner {
  const cfg = sideConfig(setup.stamina, tune);
  return {
    side: createSide(cfg),
    cfg,
    control: setup.control,
    power: setup.power,
    beatFrom: 0,
    beats: 0,
    comeback: createComeback(),
    comebacks: 0,
    output: 0,
  };
}

/** 跑一整场拔河。红方绳子往正方向拉,蓝方往负方向拉,先到 ±100 的一方赢。 */
export function simulateDuel(opts: DuelOptions): DuelResult {
  const tune = opts.tune ?? TUG12;
  const dt = opts.dt && opts.dt > 0 ? opts.dt : tune.MAX_SUBSTEP;
  const maxSeconds = opts.seconds ?? 90;
  const useComeback = opts.comeback !== false;
  const beats =
    opts.beats === false ? [] : buildBeats(opts.seed ?? 1, maxSeconds * 1000, opts.beatGapScale ?? 1, tune);

  const red = makeRunner(opts.red, tune);
  const blue = makeRunner(opts.blue, tune);
  let rope = 0;
  let t = 0;
  let winner: DuelResult["winner"] = "none";

  while (t < maxSeconds) {
    const nowMs = t * 1000;
    const green = opts.redlight ? lightGreenAt(nowMs, tune) : true;
    const nextBeat = nextBeatFrom(beats, nowMs);

    const pressRed = red.control({ nowMs, side: red.side, cfg: red.cfg, rope, green, beats, nextBeat });
    const pressBlue = blue.control({ nowMs, side: blue.side, cfg: blue.cfg, rope: -rope, green, beats, nextBeat });

    const stepRed = stepSide(red.side, pressRed, dt, red.cfg, tune);
    const stepBlue = stepSide(blue.side, pressBlue, dt, blue.cfg, tune);
    red.side = stepRed.side;
    blue.side = stepBlue.side;

    const cbRed = comebackStep(red.comeback, rope, 1, nowMs, useComeback, tune);
    const cbBlue = comebackStep(blue.comeback, rope, -1, nowMs, useComeback, tune);
    red.comeback = cbRed.state;
    blue.comeback = cbBlue.state;
    if (cbRed.opened) red.comebacks++;
    if (cbBlue.opened) blue.comebacks++;

    let bluePower = blue.power;
    if (opts.aiAdapt) {
      bluePower = adaptiveAiRate({ aiRate: blue.power, aiAdapt: opts.aiAdapt } as TugLevel, rope);
    }

    let delta = 0;
    if (!green && pressRed) {
      // 红灯硬拉:一分力都使不上,还往回滑
      delta -= tune.SLIP_PER_SEC * dt;
    } else {
      const f = stepRed.factor * red.power * (1 + cbRed.gain);
      red.output += f * dt;
      delta += f * dt;
    }
    if (!green && pressBlue) {
      delta += tune.SLIP_PER_SEC * dt;
    } else {
      const f = stepBlue.factor * bluePower * (1 + cbBlue.gain);
      blue.output += f * dt;
      delta -= f * dt;
    }

    if (green && stepRed.pressEdge) {
      const hit = beatHitIndex(beats, nowMs, stepRed.edgeRestMs, red.beatFrom, tune);
      if (hit >= 0) {
        red.beatFrom = hit + 1;
        red.beats++;
        delta += tune.BEAT_IMPULSE;
      }
    }
    if (green && stepBlue.pressEdge) {
      const hit = beatHitIndex(beats, nowMs, stepBlue.edgeRestMs, blue.beatFrom, tune);
      if (hit >= 0) {
        blue.beatFrom = hit + 1;
        blue.beats++;
        delta -= tune.BEAT_IMPULSE;
      }
    }

    rope = Math.max(-tune.ROPE_WIN, Math.min(tune.ROPE_WIN, rope + delta));
    t += dt;
    if (rope >= tune.ROPE_WIN) {
      winner = "red";
      break;
    }
    if (rope <= -tune.ROPE_WIN) {
      winner = "blue";
      break;
    }
  }

  return {
    winner,
    seconds: Math.round(t * 1000) / 1000,
    rope,
    redBeats: red.beats,
    blueBeats: blue.beats,
    redComebacks: red.comebacks,
    blueComebacks: blue.comebacks,
    redOutput: red.output,
    blueOutput: blue.output,
  };
}

// ---------------------------------------------------------------------------
// 单人产出:同一段时间里,一种打法能把绳子拉多远(没有对手,也不判胜负)
// ---------------------------------------------------------------------------

export interface OutputOptions {
  control: Controller;
  seconds?: number;
  power?: number;
  seed?: number;
  beats?: boolean;
  stamina?: Partial<SideConfig>;
  dt?: number;
  tune?: Tuning;
}

export interface OutputResult {
  /** 这段时间一共拉回来多少(含加油点) */
  distance: number;
  /** 平均每秒拉多少 */
  perSecond: number;
  /** 踩中几个加油点 */
  beats: number;
  /** 有多少比例的时间是脱力状态 */
  windedRatio: number;
}

/** 量一种打法的产出:用例靠它证明「有节奏发力 > 狂按 > 一直按住」 */
export function measureOutput(opt: OutputOptions): OutputResult {
  const tune = opt.tune ?? TUG12;
  const dt = opt.dt && opt.dt > 0 ? opt.dt : tune.MAX_SUBSTEP;
  const seconds = opt.seconds ?? 30;
  const power = opt.power ?? 20;
  const cfg = sideConfig(opt.stamina, tune);
  const beats = opt.beats === false ? [] : buildBeats(opt.seed ?? 1, seconds * 1000, 1, tune);

  let side = createSide(cfg);
  let distance = 0;
  let hits = 0;
  let beatFrom = 0;
  let windedSteps = 0;
  let steps = 0;

  for (let t = 0; t < seconds; t += dt) {
    const nowMs = t * 1000;
    const press = opt.control({
      nowMs,
      side,
      cfg,
      rope: 0,
      green: true,
      beats,
      nextBeat: nextBeatFrom(beats, nowMs),
    });
    const step = stepSide(side, press, dt, cfg, tune);
    side = step.side;
    distance += step.factor * power * dt;
    if (step.pressEdge) {
      const hit = beatHitIndex(beats, nowMs, step.edgeRestMs, beatFrom, tune);
      if (hit >= 0) {
        beatFrom = hit + 1;
        hits++;
        distance += tune.BEAT_IMPULSE;
      }
    }
    if (side.winded) windedSteps++;
    steps++;
  }

  return {
    distance,
    perSecond: distance / seconds,
    beats: hits,
    windedRatio: steps ? windedSteps / steps : 0,
  };
}

// ---------------------------------------------------------------------------
// 188 关:老关卡数据 → 新力量模型
// ---------------------------------------------------------------------------

export interface LevelSetup {
  /** 玩家满力每秒拉多少 */
  playerPower: number;
  /** 小电脑满力每秒拉多少 */
  aiPower: number;
  tier: AiTier;
  /** 玩家这一关的体力参数 */
  stamina: Partial<SideConfig>;
  /** 加油点间隔缩放:有加油星 / 有号子的关更密 */
  beatGapScale: number;
  redlight: boolean;
  /** 要不要左右手交替 */
  offhand: boolean;
  aiAdapt: number;
}

/**
 * 把 1.1 的一条关卡数据读成 1.2 的对局参数。
 * **关卡数据本身一个字没改**,只是换了一种读法:
 * `pullPower` 是自己的力气,`aiRate` 是对手的力气,`stamina` 决定这一关多吃体力。
 */
export function levelSetup(index: number, cfg: TugLevel = LEVELS[index]): LevelSetup {
  const tier = aiTierForLevel(index);
  const dense = cfg.chantMs ? 0.62 : cfg.star ? 0.82 : 1;
  return {
    playerPower: cfg.pullPower * PLAYER_POWER_SCALE,
    aiPower: cfg.aiRate * AI_POWER_SCALE,
    tier,
    stamina: cfg.stamina
      ? { staminaMax: TUG12.STAMINA_MAX, regen: TUG12.REGEN_PER_SEC * (0.6 + (cfg.staminaRegen ?? 5) * 0.06) }
      : {},
    beatGapScale: dense,
    redlight: !!cfg.redlight,
    offhand: !!cfg.rhythm,
    // 读招在连续模型里比 1.1 更黏人(它每一帧都在加力),所以只取一半,免得末章拖成拉锯战
    aiAdapt: (cfg.aiAdapt ?? 0) * 0.5,
  };
}

export type PlayStyle = "rhythm" | "mash" | "hold";

export function styleController(style: PlayStyle, setup?: { redlight?: boolean }): Controller {
  if (style === "hold") return holdController();
  if (style === "mash") return mashController(8);
  return rhythmController({ watchLight: setup?.redlight !== false });
}

/** 用某一种打法去打第 index 关(0 基) */
export function simulateLevel(index: number, style: PlayStyle = "rhythm", seed = 11): DuelResult {
  const setup = levelSetup(index);
  return simulateDuel({
    red: {
      power: setup.playerPower * (setup.offhand ? 0.92 : 1),
      control: styleController(style, { redlight: setup.redlight }),
      stamina: setup.stamina,
    },
    blue: { power: setup.aiPower, control: aiController(setup.tier, seed + index) },
    seed: seed + index,
    seconds: 75,
    beatGapScale: setup.beatGapScale,
    redlight: setup.redlight,
    aiAdapt: setup.aiAdapt,
  });
}

// ---------------------------------------------------------------------------
// 无尽「拉不完的绳」
// ---------------------------------------------------------------------------

export interface EndlessSetup {
  tier: AiTier;
  aiPower: number;
  playerPower: number;
  beatGapScale: number;
  redlight: boolean;
}

/** 第 streak 局(0 基)的对手:档位与力气都随连胜往上走,力气有封顶 */
export function endlessSetup(streak: number): EndlessSetup {
  const s = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  const tier = endlessTier(s);
  return {
    tier,
    aiPower: endlessAiRate(s) * AI_POWER_SCALE,
    playerPower: 3.1 * PLAYER_POWER_SCALE,
    beatGapScale: s >= 4 ? 0.8 : 1,
    redlight: s >= 3 && s % 2 === 1,
  };
}

/** 无尽模式跑一局 */
export function simulateEndlessRound(streak: number, style: PlayStyle = "rhythm", seed = 5): DuelResult {
  const setup = endlessSetup(streak);
  return simulateDuel({
    red: { power: setup.playerPower, control: styleController(style, { redlight: setup.redlight }) },
    blue: { power: setup.aiPower, control: aiController(setup.tier, seed + streak) },
    seed: seed + streak,
    seconds: 75,
    beatGapScale: setup.beatGapScale,
    redlight: setup.redlight,
  });
}

/** 一直用同一种打法能连胜几局(用例断言它既不是 0 也不是无限) */
export function endlessStreak(style: PlayStyle = "rhythm", seed = 5, cap = 40): number {
  let s = 0;
  while (s < cap) {
    if (simulateEndlessRound(s, style, seed).winner !== "red") break;
    s++;
  }
  return s;
}

/** 四档小电脑两两对拉的结果,给用例做「档位差可量化」的证据 */
export function tierLadder(seed = 3, seconds = 60): Array<{ key: string; perSecond: number }> {
  return AI_TIERS.map((tier) => {
    const out = measureOutput({
      control: aiController(tier, seed),
      seconds,
      power: 20,
      seed,
    });
    return { key: tier.key, perSecond: Math.round(out.perSecond * 1000) / 1000 };
  });
}
