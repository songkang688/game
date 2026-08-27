/**
 * 红蓝赛跑 · 1.2 公平性(纯函数,不碰 DOM)。
 *
 * 两个人并排比赛,输赢必须来自节奏和判断,不能来自「谁那条道更好走」。
 * 这里管三件半事:
 *
 *  1. **镜像赛道**:两条道的机关种类、位置、长度完全一致,`lanesMirrored` 是可以写进测试的断言;
 *  2. **起跑随机延迟**:口令不在固定时刻响,记秒表抢跑没用;
 *  3. **抢跑回退**:抢跑只回退 0.5 秒(累计封顶),**永远不判负**——
 *     `falseStartVerdict().disqualified` 恒为 `false`,这条写死在测试里,免得以后有人顺手改成判负;
 *  4. (半件)**让分开关**:大人带小孩时给落后方一点点助推,封顶 8%,默认关。
 */
import { TRACK_LEN, type Obstacle, type ObstacleType } from "./levels";

// ---------------------------------------------------------------------------
// 1. 镜像赛道
// ---------------------------------------------------------------------------

/** 复制一条赛道的机关表(深拷贝,免得两条道共用同一批对象、擦掉一个另一边跟着没) */
export function cloneLane(obstacles: readonly Obstacle[]): Obstacle[] {
  return obstacles.map((ob) => ({ type: ob.type, pos: ob.pos, len: ob.len }));
}

/** 两条道用同一张机关表,各拿一份自己的副本 */
export function buildMirroredLanes(obstacles: readonly Obstacle[]): { red: Obstacle[]; blue: Obstacle[] } {
  return { red: cloneLane(obstacles), blue: cloneLane(obstacles) };
}

/** 两条道是不是完全镜像:数量、顺序、种类、位置、长度全都得对上 */
export function lanesMirrored(red: readonly Obstacle[], blue: readonly Obstacle[]): boolean {
  if (red.length !== blue.length) return false;
  for (let i = 0; i < red.length; i++) {
    const a = red[i];
    const b = blue[i];
    if (a.type !== b.type || a.pos !== b.pos || a.len !== b.len) return false;
  }
  return true;
}

/**
 * 双人对战的赛道:在 [18, 84] 之间排 n 个至少相隔 11 的机关,两条道共用同一张表。
 * `rand` 传确定性随机数发生器,同一个 seed 排出来的赛道每次都一样。
 */
export function buildDuelTrack(rand: () => number, count: number): { red: Obstacle[]; blue: Obstacle[] } {
  const kinds: ObstacleType[] = ["hurdle", "puddle", "star", "hurdle", "item", "puddle"];
  const positions: number[] = [];
  let guard = 0;
  while (positions.length < Math.max(0, Math.floor(count)) && guard++ < 400) {
    const p = 18 + Math.floor(rand() * 67);
    if (positions.every((q) => Math.abs(q - p) >= 11)) positions.push(p);
  }
  positions.sort((a, b) => a - b);
  const table: Obstacle[] = positions.map((pos, i) => ({ type: kinds[i % kinds.length], pos, len: 4 }));
  return buildMirroredLanes(table);
}

// ---------------------------------------------------------------------------
// 2. 起跑口令的随机延迟
// ---------------------------------------------------------------------------

/** 「预备」之后最少等多久才喊「跑」 */
export const START_DELAY_MIN_MS = 700;
/** 「预备」之后最多等多久 */
export const START_DELAY_MAX_MS = 2100;

/** 这一局的起跑延迟(毫秒):落在 [MIN, MAX] 之间,脏随机数也不会跑飞 */
export function startDelayMs(rand: () => number): number {
  const r = rand();
  const t = Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : 0.5;
  return Math.round(START_DELAY_MIN_MS + t * (START_DELAY_MAX_MS - START_DELAY_MIN_MS));
}

// ---------------------------------------------------------------------------
// 3. 抢跑:回退 0.5 秒,不判负
// ---------------------------------------------------------------------------

/** 抢跑一次回退多久 */
export const FALSE_START_SETBACK_MS = 500;
/** 反复抢跑的回退上限:再抢也就这么多,不会把一局堵死 */
export const FALSE_START_MAX_SETBACK_MS = 1500;

export interface FalseStartVerdict {
  /** 这一局累计要回退多久 */
  setbackMs: number;
  /** 永远是 false:抢跑不判负,只回退 */
  disqualified: false;
  /** 给玩家看的一句话,只说怎么做,不说谁不行 */
  message: string;
}

/** 抢跑 count 次之后的回退时长(毫秒) */
export function falseStartSetbackMs(count: number): number {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return Math.min(FALSE_START_MAX_SETBACK_MS, n * FALSE_START_SETBACK_MS);
}

/** 抢跑判定:回退多久 + 一句提示。第二个字段恒为 false,抢跑不判负 */
export function falseStartVerdict(count: number): FalseStartVerdict {
  const setbackMs = falseStartSetbackMs(count);
  return {
    setbackMs,
    disqualified: false,
    message: setbackMs > 0 ? `抢跑啦,等 ${(setbackMs / 1000).toFixed(1)} 秒再冲,不算输` : "听到「跑」再出发"
  };
}

// ---------------------------------------------------------------------------
// 4. 让分开关
// ---------------------------------------------------------------------------

/** 让分给落后方的最大助推:8%,写死封顶 */
export const HANDICAP_MAX = 0.08;
/** 让分默认关(大人自己去开) */
export const HANDICAP_DEFAULT_ON = false;
/** 差距拉到全程的这个比例,助推就到顶 */
export const HANDICAP_FULL_GAP_RATIO = 0.25;

/**
 * 让分助推倍率:开关关着、或自己领先时都是 1(领先方不会被拖慢),
 * 落后越多助推越接近上限,最多 `1 + HANDICAP_MAX`。
 */
export function handicapBoost(
  on: boolean,
  myPos: number,
  rivalPos: number,
  trackLen: number = TRACK_LEN
): number {
  if (!on) return 1;
  const me = Number.isFinite(myPos) ? myPos : 0;
  const rival = Number.isFinite(rivalPos) ? rivalPos : 0;
  const len = Number.isFinite(trackLen) && trackLen > 0 ? trackLen : TRACK_LEN;
  const behind = rival - me;
  if (behind <= 0) return 1;
  const ratio = Math.min(1, behind / (len * HANDICAP_FULL_GAP_RATIO));
  return 1 + HANDICAP_MAX * ratio;
}

/** HUD 上那颗芯片的文字 */
export function handicapLabel(on: boolean): string {
  return on ? `🤝 让分 开 · 落后方最多快 ${Math.round(HANDICAP_MAX * 100)}%` : "🤝 让分 关 · 点一下开";
}

// ---------------------------------------------------------------------------
// 领先 / 落后提示:落后方只给方法,不给难听话
// ---------------------------------------------------------------------------

/** 两人差距对应的一句提示(gap 为正表示自己领先) */
export function leadHint(gap: number): string {
  const g = Number.isFinite(gap) ? gap : 0;
  if (g >= 12) return "领先一大截,节奏别乱";
  if (g >= 3) return "小幅领先,稳住交替";
  if (g > -3) return "咬得很紧,谁稳谁赢";
  if (g > -12) return "落后一点点,交替按稳就能追";
  return "还有一大段跑道,把节奏踩稳慢慢追";
}
