/**
 * 梨康擂台 · 赛制层。
 *
 * 把「一局怎么打」和「一场怎么算」彻底分开:回合里只管抢元气,赛制层管比分、赛点、
 * 让分、守擂连胜,以及 `?level=N` 落到哪一档人机、哪一张场地。
 * 全是纯函数,`match.test.ts` 直接对着断言,不用起 DOM。
 */
import { MAX_ROUNDS, ROUNDS_TO_WIN, matchState } from "./logic";
import { AI_LEVELS, type AiLevel } from "./ai";
import { STAGE_COUNT, type Stage, stageAt } from "./stages";

export type Seat = 0 | 1;

/** 一个回合的结果:0 = 鸭梨(1P)拿下,1 = 康康(2P)拿下,-1 = 平 */
export type RoundResult = 0 | 1 | -1;

/** 三种模式:双人同屏 / 单人挑战人机 / 无尽守擂 */
export type ArenaMode = "duo" | "solo" | "keep";

export interface MatchProgress {
  results: RoundResult[];
  /** [鸭梨, 康康] 各拿下几个回合 */
  wins: [number, number];
  done: boolean;
  winner: Seat | null;
  /** 下一个回合是不是决胜回合 */
  sudden: boolean;
  /** 已经打完几个回合 */
  played: number;
}

export function createMatch(): MatchProgress {
  return { results: [], wins: [0, 0], done: false, winner: null, sudden: false, played: 0 };
}

/** 记一个回合的结果,返回新的赛制状态(不改原对象) */
export function pushRound(progress: MatchProgress, result: RoundResult): MatchProgress {
  const results = [...progress.results, result];
  let w0 = 0;
  let w1 = 0;
  for (const r of results) {
    if (r === 0) w0++;
    else if (r === 1) w1++;
  }
  const st = matchState(results);
  return {
    results,
    wins: [w0, w1],
    done: st.done,
    winner: st.done ? st.winner : null,
    sudden: st.done ? false : st.sudden,
    played: results.length,
  };
}

/** 谁站在赛点上(再赢一个回合就赢下整场) */
export function matchPoints(progress: MatchProgress): { p1: boolean; p2: boolean } {
  if (progress.done) return { p1: false, p2: false };
  const [w0, w1] = progress.wins;
  const lastChance = progress.played >= MAX_ROUNDS - 1;
  // 最后一个正式回合(以及之后的决胜回合)里,只要不落后,赢下这一回合就能拿下整场
  return {
    p1: w0 >= ROUNDS_TO_WIN - 1 || (lastChance && w0 >= w1),
    p2: w1 >= ROUNDS_TO_WIN - 1 || (lastChance && w1 >= w0),
  };
}

/** 下一个回合是不是赛点局(任意一方站在赛点上,或者已经打到决胜回合) */
export function isMatchPointRound(progress: MatchProgress): boolean {
  if (progress.done) return false;
  if (progress.sudden) return true;
  const mp = matchPoints(progress);
  return mp.p1 || mp.p2;
}

/** 比分文字,例如「1 : 0」 */
export function scoreLine(progress: MatchProgress): string {
  return `${progress.wins[0]} : ${progress.wins[1]}`;
}

/* ---------------- 让分开关 ---------------- */

/** 让分封顶 8%,再落后也不会更多 —— 这是「温和助推」,不是替小朋友打 */
export const MAX_HANDICAP = 0.08;

/**
 * 落后方这一回合能拿到多少助推。
 * 默认关(`enabled = false` 时恒为 0);落后 1 个回合给 5%,落后 2 个及以上给 8%,永不超过 8%。
 */
export function handicapRate(enabled: boolean, myWins: number, oppWins: number): number {
  if (!enabled) return 0;
  const behind = Math.floor(oppWins) - Math.floor(myWins);
  if (behind <= 0) return 0;
  return behind === 1 ? 0.05 : MAX_HANDICAP;
}

/** 把助推乘到某个数值上(目标存活时长、移动速度都用它) */
export function applyHandicap(value: number, rate: number): number {
  return value * (1 + Math.min(MAX_HANDICAP, Math.max(0, rate)));
}

/** HUD 上那行让分状态 */
export function handicapLabel(enabled: boolean): string {
  return enabled ? "让分:开(落后方最多 +8%)" : "让分:关";
}

/* ---------------- 无尽守擂 ---------------- */

export interface KeepSetup {
  /** 第几场(1 起) */
  bout: number;
  ai: AiLevel;
  stage: Stage;
  stageIndex: number;
}

/**
 * 守擂第 n 场对上谁、在哪打:前四场一场换一档,第五场起一直是地狱档,
 * 场地每一场都换,越守越花。
 */
export function keepSetup(bout: number): KeepSetup {
  const n = Math.max(1, Math.floor(bout));
  const ai = AI_LEVELS[Math.min(AI_LEVELS.length - 1, n - 1)];
  const stageIndex = (n - 1) % STAGE_COUNT;
  return { bout: n, ai, stage: stageAt(stageIndex), stageIndex };
}

/** 守住了就 +1,输了就到此为止;返回这一次守擂最终的连胜数 */
export function keepStreak(streak: number, held: boolean): number {
  return held ? Math.max(0, Math.floor(streak)) + 1 : Math.max(0, Math.floor(streak));
}

/* ---------------- ?level=N 映射 ---------------- */

export interface LevelSetup {
  level: number;
  ai: AiLevel;
  stage: Stage;
  stageIndex: number;
  label: string;
}

/**
 * 擂台没有 188 关战役(纯对战硬凑 188 关就是注水),但平台的 `?level=N` 直达仍然要接住。
 * 映射规则:**档位走四个一循环,场地每四关换一张**,
 * 也就是 1→菜鸟·云台广场、2→普通·云台广场、3→高手·云台广场、4→地狱·云台广场、
 * 5→菜鸟·花田小岛……如此循环,任何正整数都落得到一个组合。
 */
export function levelToSetup(level: number): LevelSetup {
  const n = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  const idx = n - 1;
  const ai = AI_LEVELS[idx % AI_LEVELS.length];
  const stageIndex = Math.floor(idx / AI_LEVELS.length) % STAGE_COUNT;
  const stage = stageAt(stageIndex);
  return { level: n, ai, stage, stageIndex, label: `第 ${n} 号擂台 · ${stage.name}` };
}

/** 从 `?level=7` 这样的查询串里读关号;读不出来返回 null(不猜、不报错) */
export function parseLevelParam(search: string): number | null {
  const m = /[?&]level=(\d{1,4})\b/.exec(search ?? "");
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(9999, n);
}
