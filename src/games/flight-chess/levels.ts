/**
 * 飞行棋乐园 · 188 关战役（8 章）。
 *
 * 每一关 = 固定初始局面 + 固定骰序 + 一个目标 + 掷骰次数上限。
 * 目标不是拍脑袋定的:先用一条**参考走法**把这一关实打实跑一遍，
 * 跑出多少就要多少，所以每一关天生可解，`solveLevel` 把这条走法回放到达成目标。
 */
import {
  assertTotal,
  chapterOf,
  indexInChapter,
  mulberry32,
  rateBelow,
  type Chapter
} from "../level99";
import {
  AIRLINE_FROM,
  ARM,
  BASE,
  GOAL,
  PLANES_PER_COLOR,
  RING_LEN,
  type Color
} from "./board";
import { CLASSIC_RULES, IMPROVED_RULES, extraRoll, roll, type Rules } from "./dice";
import {
  applyMove,
  createState,
  currentColor,
  homeCount,
  legalMoves,
  place,
  progressOf,
  type FlightState,
  type Landing,
  type Move
} from "./rules";
import { playTurn, previewMove, scoreMove, type AiTier } from "./ai";

export const CHAPTERS: Chapter[] = [
  { name: "起飞跑道", emoji: "🛫", color: "#D6F0FF", desc: "只有掷到 6 才能从基地起飞，起飞之后还能再掷一次。", size: 24 },
  { name: "跳格子", emoji: "🟦", color: "#DCEBFF", desc: "停在自己颜色的格子上，就能再往前跳 4 格。", size: 24 },
  { name: "航线飞", emoji: "〰️", color: "#E2E6FF", desc: "本色航线格连着一条虚线，踩上去就径直飞到对面。", size: 24 },
  { name: "撞机演练", emoji: "💫", color: "#FFE6F1", desc: "落点上有对方一架，就把它送回基地重新出发。", size: 24 },
  { name: "叠机堡垒", emoji: "🏰", color: "#E3F7E8", desc: "两架叠在一起谁也撞不动，还能把敌机挡得原路退回去。", size: 22 },
  { name: "通道折返", emoji: "🎯", color: "#FFF0D8", desc: "终点必须正好走到，多出来的步数要在通道里折返。", size: 22 },
  { name: "改进规则", emoji: "🔧", color: "#EDE6FF", desc: "5 和 6 都能起飞，但连着掷出三个 6 这一手就作废。", size: 24 },
  { name: "四人决赛", emoji: "🏆", color: "#FFE2DC", desc: "四个人同场，对手是地狱档，全部机制一起上。", size: 24 }
];

export function chapterCheck(): boolean {
  return assertTotal(CHAPTERS, 188, "flight-chess");
}

/** 关卡目标的种类 */
export type GoalKind = "takeoff" | "jump" | "fly" | "capture" | "stack" | "finish" | "progress" | "race";

export const GOAL_LABELS: Record<GoalKind, string> = {
  takeoff: "起飞",
  jump: "跳格",
  fly: "航线飞",
  capture: "撞回敌机",
  stack: "叠机堡垒",
  finish: "飞机到终点",
  progress: "总行程",
  race: "到终点的飞机"
};

export interface LevelConfig {
  /** 0 起的关号 */
  level: number;
  chapter: number;
  seed: number;
  rules: Rules;
  /** 棋盘上出现的颜色，第一个是玩家 */
  seats: Color[];
  player: Color;
  /** 各色初始行程（长度 4） */
  setup: number[][];
  /** 固定骰序 */
  dice: number[];
  goal: { kind: GoalKind; need: number };
  /** 四人决赛才有的回合上限 */
  rounds: number;
  /** 对手档位 */
  tiers: Record<number, AiTier>;
  /** 是不是四人同场（其余章节只有玩家一个人走） */
  multi: boolean;
  /** 参考走法用了几次掷骰（评星基准） */
  refRolls: number;
}

/** 某一色在某个目标上的成绩 */
export function achievementOf(s: FlightState, kind: GoalKind, color: Color): number {
  const t = s.tally[color];
  switch (kind) {
    case "takeoff":
      return t.takeOff;
    case "jump":
      return t.jump;
    case "fly":
      return t.fly;
    case "capture":
      return t.capture;
    case "stack":
      return t.stack;
    case "finish":
      return t.finish;
    case "race":
      return homeCount(s, color);
    default:
      return progressOf(s, color);
  }
}

/** 参考走法在打分器之上加一份「本章主题」的偏好 */
function themeBonus(kind: GoalKind, move: Move, res: Landing): number {
  if (!res.legal) return 0;
  switch (kind) {
    case "takeoff":
      return move.kind === "takeOff" ? 900 : 0;
    case "jump":
      return res.jumped ? 700 : 0;
    case "fly":
      return res.flew ? 900 : res.jumped ? 200 : 0;
    case "capture":
      return res.selfBack ? -900 : res.captured.length * 900;
    case "stack":
      return 0;
    case "finish":
      return res.arrived ? 900 : 0;
    default:
      return 0;
  }
}

function refPick(kind: GoalKind, tier: AiTier): (s: FlightState, dice: number) => Move | null {
  return (s, dice) => {
    const moves = legalMoves(s, dice);
    if (moves.length === 0) return null;
    let best: Move | null = null;
    let bestScore = -Infinity;
    for (const m of moves) {
      const res = previewMove(s, m, dice);
      const base = scoreMove(s, m, dice, tier).score;
      const value = base + themeBonus(kind, m, res);
      if (value > bestScore) {
        bestScore = value;
        best = m;
      }
    }
    return best ?? moves[0];
  };
}

export interface RefStep {
  dice: number;
  /** 走的是哪一架（null 表示这一手过或被连三 6 作废） */
  planeIdx: number | null;
  kind: Move["kind"] | null;
  cancelled: boolean;
}

export interface LevelRun {
  state: FlightState;
  steps: RefStep[];
  /** 用掉几次掷骰 */
  rolls: number;
  /** 参考走法最终达成了多少 */
  achieved: number;
  /** 第几次掷骰之后第一次达到 need（need = achieved 时就是参考步数） */
  reachedAt: number;
  win: boolean;
}

function buildState(cfg: LevelConfig): FlightState {
  const s = createState(cfg.seats, cfg.rules);
  for (let c = 0; c < 4; c++) place(s, c as Color, cfg.setup[c] ?? []);
  return s;
}

/**
 * 跑一条参考走法。`need` 给 Infinity 就是「能拿多少拿多少」，
 * 给具体数字就是「拿到就收手」，用来算参考步数。
 */
export function runLine(cfg: LevelConfig, need = Infinity): LevelRun {
  const s = buildState(cfg);
  const pick = refPick(cfg.goal.kind, cfg.tiers[cfg.player] ?? "pro");
  const steps: RefStep[] = [];
  let rolls = 0;
  let reachedAt = -1;
  const note = (): void => {
    if (reachedAt < 0 && achievementOf(s, cfg.goal.kind, cfg.player) >= need) reachedAt = rolls;
  };
  note();

  if (cfg.multi) {
    let cursor = 0;
    const nextDice = (): number => cfg.dice[Math.min(cursor++, cfg.dice.length - 1)];
    while (s.round < cfg.rounds && cursor < cfg.dice.length && reachedAt < 0) {
      const color = currentColor(s);
      const logs = playTurn(s, {
        nextDice,
        tier: cfg.tiers[color] ?? "normal",
        pick: color === cfg.player ? pick : undefined
      });
      for (const log of logs) {
        steps.push({
          dice: log.dice,
          planeIdx: log.move ? log.move.plane.idx : null,
          kind: log.move ? log.move.kind : null,
          cancelled: log.cancelled
        });
      }
      rolls = cursor;
      note();
    }
  } else {
    for (const d of cfg.dice) {
      if (reachedAt >= 0) break;
      rolls++;
      const streak = extraRoll(d, s.streak, s.rules);
      if (streak.cancel) {
        s.streak = 0;
        steps.push({ dice: d, planeIdx: null, kind: null, cancelled: true });
        note();
        continue;
      }
      const move = pick(s, d);
      if (move) {
        applyMove(s, move, d);
        steps.push({ dice: d, planeIdx: move.plane.idx, kind: move.kind, cancelled: false });
      } else {
        steps.push({ dice: d, planeIdx: null, kind: null, cancelled: false });
      }
      s.streak = streak.streak;
      note();
    }
  }

  const achieved = achievementOf(s, cfg.goal.kind, cfg.player);
  return { state: s, steps, rolls, achieved, reachedAt, win: reachedAt >= 0 };
}

/* ------------------------------------------------------------------ */
/* 关卡生成                                                            */
/* ------------------------------------------------------------------ */

/** 造一串骰序，指定位置塞死点数（保证这一关一定有机会） */
function diceWith(seed: number, len: number, forced: Array<[number, number]>): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(roll(seed, i));
  for (const [i, v] of forced) {
    if (i >= 0 && i < len) out[i] = v;
  }
  return out;
}

/** 环线格号 → 某一色的行程值 */
function progressAtRing(color: Color, ring: number): number {
  return ((ring - ARM * color) % RING_LEN + RING_LEN) % RING_LEN;
}

/** 某一色行程 p 对应的环线格号 */
function ringOf(color: Color, p: number): number {
  return (ARM * color + p) % RING_LEN;
}

const EMPTY_ROW = (): number[] => new Array<number>(PLANES_PER_COLOR).fill(BASE);

interface Draft {
  rules: Rules;
  seats: Color[];
  setup: number[][];
  dice: number[];
  kind: GoalKind;
  rounds: number;
  tiers: Record<number, AiTier>;
  multi: boolean;
}

function tierForLevel(level: number): AiTier {
  if (level < 47) return "rookie";
  if (level < 94) return "normal";
  if (level < 141) return "pro";
  return "hell";
}

/** 按章节主题拼出一关的初始条件 */
function draftLevel(level: number, ci: number, idx: number, seed: number): Draft {
  const rand = mulberry32(seed);
  const setup = [EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()];
  const player: Color = 0;
  let seats: Color[] = [0];
  let rules = CLASSIC_RULES;
  let dice: number[] = [];
  let kind: GoalKind = "progress";
  let rounds = 0;
  let multi = false;
  const tiers: Record<number, AiTier> = { 0: "pro" };

  const step = 1 + Math.floor(rand() * 6);

  switch (ci) {
    case 0: {
      // 起飞跑道:基地里排队等 6，骰序里塞几个 6
      const len = 12 - Math.min(4, Math.floor(idx / 6));
      const sixes = 1 + Math.floor(idx / 8);
      const forced: Array<[number, number]> = [];
      for (let k = 0; k <= sixes; k++) forced.push([1 + k * 3 + (k % 2), 6]);
      dice = diceWith(seed, len, forced);
      kind = "takeoff";
      break;
    }
    case 1: {
      // 跳格子:把飞机摆在「再走 step 步正好踩上本色格」的地方
      const target = 4 * (1 + Math.floor(rand() * 8));
      const from = Math.max(0, target - step);
      setup[0][0] = from;
      setup[0][1] = Math.max(0, from - 4 - Math.floor(rand() * 3));
      dice = diceWith(seed, 9 + (idx % 4), [[0, Math.max(1, target - from)]]);
      kind = "jump";
      break;
    }
    case 2: {
      // 航线飞:要么直接踩航线格，要么先跳一格再接上航线
      const viaJump = idx % 2 === 0;
      const target = viaJump ? AIRLINE_FROM - 4 : AIRLINE_FROM;
      const from = Math.max(0, target - step);
      setup[0][0] = from;
      setup[0][1] = Math.max(0, from - 5 - Math.floor(rand() * 4));
      dice = diceWith(seed, 9 + (idx % 4), [[0, Math.max(1, target - from)]]);
      kind = "fly";
      break;
    }
    case 3: {
      // 撞机演练:对手的飞机停在「正好一步够得着」的格子上
      const foe: Color = (1 + Math.floor(rand() * 3)) as Color;
      seats = [0, foe];
      const from = 2 + Math.floor(rand() * 20);
      setup[0][0] = from;
      setup[0][1] = Math.max(0, from - 6 - Math.floor(rand() * 4));
      const hitRing = ringOf(player, from + step);
      setup[foe][0] = progressAtRing(foe, hitRing);
      const second = ringOf(player, Math.min(RING_LEN - 2, from + step + 5));
      setup[foe][1] = progressAtRing(foe, second);
      dice = diceWith(seed, 10 + (idx % 4), [[0, step]]);
      kind = "capture";
      tiers[foe] = tierForLevel(level);
      break;
    }
    case 4: {
      // 叠机堡垒:两架凑到一格，路上还有一座敌方堡垒挡道
      const foe: Color = (1 + Math.floor(rand() * 3)) as Color;
      seats = [0, foe];
      const anchor = 6 + Math.floor(rand() * 16);
      setup[0][0] = anchor;
      setup[0][1] = Math.max(0, anchor - step);
      setup[0][2] = Math.max(0, anchor - step - 7);
      const wallRing = ringOf(player, Math.min(RING_LEN - 3, anchor + 4 + Math.floor(rand() * 4)));
      setup[foe][0] = progressAtRing(foe, wallRing);
      setup[foe][1] = progressAtRing(foe, wallRing);
      dice = diceWith(seed, 10 + (idx % 4), [[0, Math.max(1, anchor - setup[0][1])]]);
      kind = "stack";
      tiers[foe] = tierForLevel(level);
      break;
    }
    case 5: {
      // 通道折返:终点就在眼前，步数要卡得正好
      const d1 = 1 + Math.floor(rand() * 6);
      setup[0][0] = GOAL - d1;
      setup[0][1] = GOAL - Math.min(6, d1 + 1 + Math.floor(rand() * 3));
      setup[0][2] = RING_LEN - 2 - Math.floor(rand() * 6);
      dice = diceWith(seed, 9 + (idx % 4), [[0, d1]]);
      kind = "finish";
      break;
    }
    case 6: {
      // 改进规则:5 和 6 都能起飞，但骰序里埋了连着三个 6 的陷阱
      rules = IMPROVED_RULES;
      const len = 12 - Math.min(3, Math.floor(idx / 8));
      const trap = 3 + (idx % 4);
      dice = diceWith(seed, len, [
        [0, 5],
        [2, 6],
        [trap, 6],
        [trap + 1, 6],
        [trap + 2, 6]
      ]);
      setup[0][0] = BASE;
      kind = idx % 3 === 2 ? "progress" : "takeoff";
      break;
    }
    default: {
      // 四人决赛:四色同场，对手全是高档 AI
      seats = [0, 1, 2, 3];
      multi = true;
      rounds = 18 + (idx % 7) * 2;
      dice = diceWith(seed, 900, []);
      kind = "race";
      const foeTier: AiTier = idx < 8 ? "pro" : "hell";
      tiers[1] = foeTier;
      tiers[2] = foeTier;
      tiers[3] = foeTier;
      // 开局送每人一架上路，免得前几个回合全在等 6
      for (const c of seats) {
        setup[c][0] = 3 + Math.floor(rand() * 10) + c * 2;
      }
      setup[0][1] = 1 + Math.floor(rand() * 6);
      break;
    }
  }

  return { rules, seats, setup, dice, kind, rounds, tiers, multi };
}

function toConfig(level: number, ci: number, d: Draft, seed: number): LevelConfig {
  return {
    level,
    chapter: ci,
    seed,
    rules: d.rules,
    seats: d.seats,
    player: 0,
    setup: d.setup,
    dice: d.dice,
    goal: { kind: d.kind, need: 1 },
    rounds: d.rounds,
    tiers: d.tiers,
    multi: d.multi,
    refRolls: d.dice.length
  };
}

const CACHE = new Map<number, LevelConfig>();

/**
 * 第 level 关（0 起）的完整配置。
 * 目标由参考走法实跑出来再回填，所以每一关都保证有解。
 */
export function levelConfig(level: number): LevelConfig {
  const key = Math.max(0, Math.min(187, Math.floor(level)));
  const hit = CACHE.get(key);
  if (hit) return hit;

  const ci = chapterOf(CHAPTERS, key);
  const idx = indexInChapter(CHAPTERS, key);
  let fallback: LevelConfig | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    const seed = 90210 + key * 613 + attempt * 7717;
    const cfg = toConfig(key, ci, draftLevel(key, ci, idx, seed), seed);
    const probe = runLine(cfg, Infinity);
    if (probe.achieved >= 1) {
      cfg.goal.need = probe.achieved;
      const solved = runLine(cfg, cfg.goal.need);
      cfg.refRolls = solved.reachedAt >= 0 ? solved.reachedAt : probe.rolls;
      CACHE.set(key, cfg);
      return cfg;
    }
    if (!fallback) {
      // 主题目标一次都没达成:退回「总行程」，这个永远拿得到
      const alt = toConfig(key, ci, draftLevel(key, ci, idx, seed), seed);
      alt.goal = { kind: "progress", need: 1 };
      const line = runLine(alt, Infinity);
      alt.goal.need = Math.max(1, line.achieved);
      const solved = runLine(alt, alt.goal.need);
      alt.refRolls = solved.reachedAt >= 0 ? solved.reachedAt : line.rolls;
      fallback = alt;
    }
  }

  const out = fallback ?? toConfig(key, ci, draftLevel(key, ci, idx, 90210 + key * 613), 90210 + key * 613);
  CACHE.set(key, out);
  return out;
}

/** 把参考走法回放一遍，用来证明这一关可解 */
export function solveLevel(level: number): LevelRun {
  const cfg = levelConfig(level);
  return runLine(cfg, cfg.goal.need);
}

/** 关卡目标的一句中文 */
export function goalLine(cfg: LevelConfig): string {
  const label = GOAL_LABELS[cfg.goal.kind];
  const budget = cfg.multi ? `${cfg.rounds} 个回合内` : `${cfg.dice.length} 次掷骰内`;
  if (cfg.goal.kind === "progress") return `${budget}把总行程推到 ${cfg.goal.need} 格以上`;
  return `${budget}完成 ${cfg.goal.need} 次${label}`;
}

/** 本关开着哪些规则 */
export function rulesLine(cfg: LevelConfig): string {
  const bits = [cfg.rules.takeOff.length > 1 ? "5 或 6 都能起飞" : "只有 6 能起飞"];
  if (cfg.rules.punishThreeSixes) bits.push("连着三个 6 这一手作废");
  if (cfg.rules.allowJump) bits.push("本色格跳 4 格");
  if (cfg.rules.allowAirline) bits.push("航线飞 12 格");
  if (cfg.rules.allowStackBlock) bits.push("叠子挡路");
  return bits.join(" · ");
}

/** 评星:参考走法用几次掷骰达成，就照它算 */
export function starsFor(cfg: LevelConfig, rollsUsed: number): 1 | 2 | 3 {
  const ref = Math.max(1, cfg.refRolls);
  return rateBelow(rollsUsed, ref, ref + 3);
}

/* ------------------------------------------------------------------ */
/* 对战 / 无尽                                                          */
/* ------------------------------------------------------------------ */

export interface MatchSetup {
  seats: Color[];
  tiers: Record<number, AiTier>;
  rules: Rules;
  label: string;
}

/** 对战 4 人:缺人用 AI 补 */
export function versusConfig(tier: AiTier): MatchSetup {
  return {
    seats: [0, 1, 2, 3],
    tiers: { 0: "pro", 1: tier, 2: tier, 3: tier },
    rules: CLASSIC_RULES,
    label: `四人同场 · 对手 ${tier}`
  };
}

/** 双人:朵朵一色、星星一色，另两色 AI */
export function duoConfig(): MatchSetup {
  return {
    seats: [0, 1, 2, 3],
    tiers: { 2: "normal", 3: "normal" },
    rules: CLASSIC_RULES,
    label: "朵朵与星星各执一色，小花小鸟由电脑补位"
  };
}

/** 无尽:连胜越多，对手越强、规则越全 */
export function endlessConfig(streak: number): MatchSetup & { tier: AiTier } {
  const tier: AiTier = streak >= 6 ? "hell" : streak >= 3 ? "pro" : streak >= 1 ? "normal" : "rookie";
  return {
    seats: [0, 1, 2, 3],
    tiers: { 0: "pro", 1: tier, 2: tier, 3: tier },
    rules: streak >= 4 ? IMPROVED_RULES : CLASSIC_RULES,
    tier,
    label: `连胜 ${streak} 场 · 对手 ${tier}`
  };
}