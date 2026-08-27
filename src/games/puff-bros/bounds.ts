/**
 * 噗噗兄弟 · 出界两段式(纯函数)。
 *
 * 1.1 的场地四面封死:左右有墙、头顶有天花板、脚下永远是一整条地板,
 * 掉下来只是落回地面,既没有惩罚也没有戏。1.2 的对战场和上升气流里有真的坑,
 * 掉下去要有说法 —— 但直接判出局对一年级小朋友太狠了,所以分两段:
 *
 *  1. **打转**(`tumble`):掉出底线的那一刻先在空中打着转往下飘,
 *     这段时间里还能左右挪、还能噗一口自救,飘回底线以上就当没事发生;
 *  2. **出局**(`out`):打转的时间用完了还没回来,才真的出局。
 *
 * 打转时重力被压到 TUMBLE_GRAVITY_SCALE,横向控制反而更跟手 —— 这段时间
 * 是给孩子留的「还有救」的窗口,不是走过场。
 */

/** 打转能撑多久(秒) */
export const TUMBLE_TIME = 1.25;
/** 打转时重力打几折:飘得慢一点,救得回来 */
export const TUMBLE_GRAVITY_SCALE = 0.42;
/** 打转时横向速度的上限(比走路快一点,给自救留余地) */
export const TUMBLE_MOVE = 230;
/** 打转时身体旋转的角速度(弧度/秒),渲染层用 */
export const TUMBLE_SPIN = 7;
/** 打转再往下掉这么多就直接出局,免得一直往下掉个没完 */
export const TUMBLE_DEPTH = 150;

export type BoundsPhase = "in" | "tumble" | "out";

export interface BoundsState {
  phase: BoundsPhase;
  /** 打转还剩多久 */
  tumbleT: number;
  /** 打转累计的旋转角(渲染层用) */
  spin: number;
  /** 掉进哪条坑线以下开始打转的(自救判定拿它当门槛) */
  line: number;
}

export function newBounds(): BoundsState {
  return { phase: "in", tumbleT: 0, spin: 0, line: 0 };
}

export interface Pit {
  x0: number;
  x1: number;
}

/** x 落在哪条坑里(没落在坑里返回 null) */
export function pitAt(pits: readonly Pit[], x: number): Pit | null {
  for (const p of pits) {
    if (x >= p.x0 && x <= p.x1) return p;
  }
  return null;
}

/** 两条坑之间(或坑与墙之间)站得住的地面,x 落在上面吗 */
export function onSolidGround(pits: readonly Pit[], x: number): boolean {
  return pitAt(pits, x) === null;
}

/**
 * 走一步会不会踩空:机器人靠这条绕开坑。
 * `ahead` 是它下一步会挪到的 x。
 */
export function wouldStepIntoPit(pits: readonly Pit[], ahead: number): boolean {
  return pits.length > 0 && pitAt(pits, ahead) !== null;
}

/** 掉出底线的那一刻:进打转 */
export function beginTumble(b: BoundsState, line: number): void {
  if (b.phase !== "in") return;
  b.phase = "tumble";
  b.tumbleT = TUMBLE_TIME;
  b.spin = 0;
  b.line = line;
}

/** 自救成功:飘回底线以上,一切照旧 */
export function recover(b: BoundsState): void {
  b.phase = "in";
  b.tumbleT = 0;
  b.spin = 0;
}

/**
 * 打转推进一子步。
 * 返回 true 表示这一下彻底出局了(时间用完,或者已经掉得太深)。
 */
export function stepTumble(b: BoundsState, dt: number, y: number): boolean {
  if (b.phase !== "tumble") return false;
  b.tumbleT = Math.max(0, b.tumbleT - dt);
  b.spin += TUMBLE_SPIN * dt;
  if (b.tumbleT > 0 && y - b.line < TUMBLE_DEPTH) return false;
  b.phase = "out";
  return true;
}

/** 出局结算完、人重新上场:状态归位 */
export function resetBounds(b: BoundsState): void {
  b.phase = "in";
  b.tumbleT = 0;
  b.spin = 0;
  b.line = 0;
}

/** 打转剩余比例 0..1,渲染层拿它画一圈越来越急的提示环 */
export function tumbleProgress(b: BoundsState): number {
  if (b.phase !== "tumble") return 0;
  return Math.min(1, Math.max(0, b.tumbleT / TUMBLE_TIME));
}

/** 打转时这一子步的重力 */
export function tumbleGravity(gravity: number): number {
  return gravity * TUMBLE_GRAVITY_SCALE;
}
