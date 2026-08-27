/**
 * 康康射击场 1.2 · 无尽「打不完的靶场」。
 *
 * 1.1 的无尽是一波一波：清完当前波才放下一波，卡住就只能干等倒计时。
 * 1.2 改成**连续投放**——靶子按一条随时间收紧的间隔曲线一个个冒出来，
 * 每个靶自己带 ttl，没打中就自己走掉；走掉 `ENDLESS_MISS_LIMIT` 个就收工。
 * 所以它真的「打不完」，只会越来越挤、越来越快。
 *
 * 曲线全是时间的纯函数，投放表由固定种子推出来 —— 同一秒永远是同一批靶，
 * 用例可以直接把整场跑一遍来验密度是不是单调上升。
 */
import { mulberry32, randInt } from "../level99";
import { accuracy, makeTarget, tideScore, tideWave, type Target, type TargetKind } from "./logic";
import { FAR_ROW_Y, RAINBOW_TTL, SHIELD_HP } from "./targets12";

// ---------------------------------------------------------------------------
// 场地与常量
// ---------------------------------------------------------------------------

/** 投放表的种子：换了它整条靶场就换一套，用例里也就不再可复现 */
export const ENDLESS_SEED = 0x51a7;

/** 开场每隔几秒放一个靶 */
export const SPAWN_EVERY_START = 1.5;
/** 挤到最凶时的投放间隔 */
export const SPAWN_EVERY_MIN = 0.42;
/** 投放间隔每秒收紧多少 */
export const SPAWN_TIGHTEN_PER_S = 1 / 95;

/** 开场靶速倍率 */
export const SPEED_START = 1;
/** 靶速倍率上限 */
export const SPEED_MAX = 2.8;
/** 靶速每秒涨多少 */
export const SPEED_RISE_PER_S = 1 / 60;

/** 开场场上最多同时几个靶 */
export const ALIVE_START = 4;
/** 场上同时存在的靶数上限 */
export const ALIVE_MAX = 12;
/** 每几秒多允许一个靶 */
export const ALIVE_EVERY_S = 24;

/** 开场每个靶在场上待几秒 */
export const TTL_START = 7;
/** 后期每个靶最少也待几秒（再短就成了「必须秒反应」的不公平靶） */
export const TTL_MIN = 3.2;
/** ttl 每秒缩多少 */
export const TTL_SHRINK_PER_S = 1 / 40;

/** 漏掉几个必打靶就收工 */
export const ENDLESS_MISS_LIMIT = 5;

/** 每几秒算一波（沿用 1.1 的 `tideWave` 解锁表，只是不再"清完才续"） */
export const WAVE_SECONDS = 18;

/** 三类 1.2 新靶各自从第几秒开始混进来 */
export const UNLOCK_RAINBOW_S = 15;
export const UNLOCK_SPLIT_S = 25;
export const UNLOCK_FLOWER_S = 35;
export const UNLOCK_SHIELD_S = 50;

/** 花朵靶 / 好人靶这类「不许打」的靶最多占几成 */
export const FORBIDDEN_CAP = 0.26;

// ---------------------------------------------------------------------------
// 曲线
// ---------------------------------------------------------------------------

/** 现在算第几波（1 基） */
export function waveAt(elapsed: number): number {
  return 1 + Math.floor(Math.max(0, elapsed) / WAVE_SECONDS);
}

export interface EndlessPhase {
  /** 这一刻的投放间隔（秒） */
  spawnEvery: number;
  /** 靶速倍率 */
  speedMul: number;
  /** 场上同时最多几个 */
  maxAlive: number;
  /** 新靶在场上待几秒 */
  ttl: number;
  /** 这一刻可能出现的靶种 */
  kinds: TargetKind[];
  /** 不许打的靶占的比例 */
  forbiddenChance: number;
  wave: number;
}

/** 某一刻的靶场强度。四条曲线都是单调的，而且都有封顶。 */
export function endlessPhase(elapsed: number): EndlessPhase {
  const t = Math.max(0, elapsed);
  const wave = waveAt(t);
  const kinds: TargetKind[] = [...tideWave(wave).kinds];
  if (t >= UNLOCK_RAINBOW_S) kinds.push("rainbow");
  if (t >= UNLOCK_SPLIT_S) kinds.push("split");
  if (t >= UNLOCK_SHIELD_S) kinds.push("shield");
  return {
    spawnEvery: Math.max(SPAWN_EVERY_MIN, SPAWN_EVERY_START - t * SPAWN_TIGHTEN_PER_S),
    speedMul: Math.min(SPEED_MAX, SPEED_START + t * SPEED_RISE_PER_S),
    maxAlive: Math.min(ALIVE_MAX, ALIVE_START + Math.floor(t / ALIVE_EVERY_S)),
    ttl: Math.max(TTL_MIN, TTL_START - t * TTL_SHRINK_PER_S),
    kinds,
    forbiddenChance: t < UNLOCK_FLOWER_S ? 0 : Math.min(FORBIDDEN_CAP, (t - UNLOCK_FLOWER_S) / 260),
    wave,
  };
}

/** 每分钟放几个靶（密度曲线，用例直接拿它比大小） */
export function spawnsPerMinute(elapsed: number): number {
  return 60 / endlessPhase(elapsed).spawnEvery;
}

// ---------------------------------------------------------------------------
// 投放表
// ---------------------------------------------------------------------------

/** 投放时刻表算过就存着：递推出来的东西没必要每次从头再推一遍 */
const spawnTimes: number[] = [];

/**
 * 第 `index` 个靶（0 基）在第几秒冒出来。
 * 用「上一发的时刻 + 那一刻的间隔 ± 一点抖动」递推，所以时刻表也是单调可复现的。
 */
export function spawnTimeAt(index: number): number {
  const n = Math.max(0, Math.floor(index));
  if (spawnTimes.length === 0) spawnTimes.push(0.6);
  while (spawnTimes.length <= n) {
    const i = spawnTimes.length - 1;
    const prev = spawnTimes[i];
    const rand = mulberry32(ENDLESS_SEED + i * 7919);
    spawnTimes.push(Math.round((prev + endlessPhase(prev).spawnEvery * (0.82 + rand() * 0.36)) * 1000) / 1000);
  }
  return spawnTimes[n];
}

/** `until` 秒之前一共放了几个靶（也就是"到这一刻为止的投放数"） */
export function spawnCountBefore(until: number): number {
  let n = 0;
  while (n <= 4000 && spawnTimeAt(n) <= until) n++;
  return n;
}

/**
 * 第 `index` 个靶长什么样。时间只影响强度，不影响"第几个靶是什么"的随机流，
 * 所以同一场无尽重放一遍完全一样。
 */
export function endlessTarget(index: number, phase: EndlessPhase): Target {
  const rand = mulberry32(ENDLESS_SEED + index * 2654435761);
  const forbidden = rand() < phase.forbiddenChance;
  const kind: TargetKind = forbidden
    ? rand() < 0.5
      ? "flower"
      : "friend"
    : phase.kinds[randInt(rand, 0, phase.kinds.length - 1)];

  // 远近两排：远排小、分高，出现概率略低
  const far = rand() < 0.42;
  const y = far ? 110 + rand() * (FAR_ROW_Y - 140) : FAR_ROW_Y + 40 + rand() * 150;
  const x = 110 + rand() * 780;
  const baseR = kind === "bull" ? 44 : kind === "balloon" ? 32 : kind === "shield" ? 40 : kind === "rainbow" ? 34 : 38;
  const r = Math.max(18, Math.round(baseR * (far ? 0.78 : 1) * (1 - Math.min(0.18, phase.wave * 0.012))));
  const dir = rand() < 0.5 ? -1 : 1;
  const drift = kind === "balloon" ? 0 : dir * 46 * phase.speedMul;
  const rise = kind === "balloon" ? -40 * phase.speedMul : 0;

  return makeTarget(index, kind, Math.round(x), Math.round(y), r, {
    vx: drift,
    vy: rise,
    phase: rand() * 6,
    far,
    ttl: kind === "rainbow" ? Math.min(RAINBOW_TTL, phase.ttl) : phase.ttl,
    ...(kind === "shield" ? { hp: SHIELD_HP } : {}),
    ...(kind === "split" ? { gen: 0 } : {}),
  });
}

/** 一整场的投放表（给用例把整场跑一遍用；运行时是边跑边取） */
export function endlessSchedule(untilS: number): Array<{ at: number; target: Target }> {
  const out: Array<{ at: number; target: Target }> = [];
  for (let i = 0; i < 4000; i++) {
    const at = spawnTimeAt(i);
    if (at > untilS) break;
    out.push({ at, target: endlessTarget(i, endlessPhase(at)) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 成绩
// ---------------------------------------------------------------------------

export interface EndlessStat {
  /** 打倒了几个靶 */
  cleared: number;
  /** 场上累计得分（含花朵靶 / 好人靶的扣分） */
  points: number;
  /** 撑了几秒 */
  elapsed: number;
  hits: number;
  shots: number;
  bestCombo: number;
  /** 漏掉几个 */
  missed: number;
}

/**
 * 无尽成绩 = 撑得久（沿用 1.1 的 `tideScore`：清靶数 × 波数 × 命中率加成）
 *          + 打得准（场上真分数打四折）
 *          + 连得长（最高连击 × 5）。
 * 三项都是单调的，不会出现"多打一个靶反而掉分"。
 */
export function endlessScore(s: EndlessStat): number {
  const acc = accuracy(s.hits, s.shots);
  const stamina = tideScore(s.cleared, waveAt(s.elapsed), acc);
  const skill = Math.round(Math.max(0, s.points) * 0.4);
  const streak = Math.max(0, Math.floor(s.bestCombo)) * 5;
  return Math.max(0, stamina + skill + streak);
}

/** 收工文案：只讲这一局做到了什么，不讲"你输了" */
export function endlessLine(s: EndlessStat, score: number, best: number): string {
  const acc = Math.round(accuracy(s.hits, s.shots) * 100);
  const head = `撑了 ${Math.round(s.elapsed)} 秒,打倒 ${s.cleared} 个靶,命中率 ${acc}%。`;
  const tail = score >= best ? `${score} 分,是新的最好成绩!` : `本次 ${score} 分,最好成绩 ${best} 分,再来一轮准能超。`;
  return `${head}${tail}`;
}

/** 靶子跑掉时的提示（漏一个提醒一次，语气要轻） */
export function missLine(missed: number): string {
  const left = Math.max(0, ENDLESS_MISS_LIMIT - missed);
  if (left <= 0) return "靶子都跑光啦,这一轮到这儿,成绩记下了。";
  if (left === 1) return `跑掉一个,还能再放走 ${left} 个,稳住!`;
  return `跑掉一个,还能再放走 ${left} 个。`;
}
