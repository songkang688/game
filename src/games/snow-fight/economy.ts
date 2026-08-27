/**
 * 雪球大作战 1.2 · 雪球经济与地面积雪(纯函数)。
 *
 * 1.1 的雪球是「关卡发的」或者干脆无限;1.2 改成自己搓:
 *
 *  - 手里最多攥 3 颗,攥满了就搓不动了——逼你把球扔出去,而不是囤着;
 *  - 蹲下搓 0.6 秒得一颗,中途站起来或者被砸中,这 0.6 秒就白搓了;
 *  - 脚下的雪是有限的:搓一颗挖掉一层,同一个坑挖久了越搓越慢,
 *    最后只能换地方——这就是「阵地选择」:视野好的位置往往先被自己挖秃。
 *
 * 雪球落地会溅回一点点雪,所以战况激烈的地方反而慢慢有雪可用,
 * 加上雪季一直在下(`snowfallTick`),没有哪块地会永远是荒地。
 */

/** 手里最多攥几颗 */
export const HAND_MAX = 3;
/** 搓一颗要蹲多久(秒) */
export const SCOOP_TIME = 0.6;
/** 搓一颗挖掉多厚的雪 */
export const DEPTH_PER_BALL = 0.2;
/** 低于这个厚度就算「薄雪」,搓起来慢一半 */
export const THIN_SNOW = 0.25;
/** 薄雪的搓球速度倍率 */
export const THIN_RATE = 0.5;
/** 雪季一直在下:每秒补回来的厚度 */
export const SNOWFALL_RATE = 0.02;
/** 一发雪球砸在地上溅回来的厚度 */
export const SPLASH_DEPTH = 0.05;
/** 一格积雪有多宽(世界单位) */
export const PATCH_W = 3;

export interface SnowField {
  /** 第 0 格的左边缘 */
  x0: number;
  /** 每格多宽 */
  patchW: number;
  /** 每格的厚度 0..1 */
  depth: number[];
}

/** 铺一片雪地 */
export function makeField(width: number, depth = 1, x0 = 0, patchW = PATCH_W): SnowField {
  const n = Math.max(1, Math.ceil(width / patchW));
  return { x0, patchW, depth: new Array<number>(n).fill(Math.max(0, Math.min(1, depth))) };
}

/** x 落在第几格(超出两头就夹到端点那一格) */
export function patchIndex(field: SnowField, x: number): number {
  const i = Math.floor((x - field.x0) / field.patchW);
  return Math.max(0, Math.min(field.depth.length - 1, i));
}

/** 这个位置脚下还有多厚的雪 */
export function depthAt(field: SnowField, x: number): number {
  return field.depth[patchIndex(field, x)] ?? 0;
}

/** 这么厚的雪,搓球速度是正常的几倍(挖光了就是 0) */
export function scoopRate(depth: number): number {
  if (depth <= 0.02) return 0;
  return depth < THIN_SNOW ? THIN_RATE : 1;
}

/** 手上的雪球与正在搓的那一颗 */
export interface Hands {
  /** 攥着几颗 */
  balls: number;
  /** 正在搓的那一颗搓了多少(0..SCOOP_TIME) */
  progress: number;
}

export function makeHands(balls = 1): Hands {
  return { balls: Math.max(0, Math.min(HAND_MAX, Math.round(balls))), progress: 0 };
}

export interface ScoopResult {
  hands: Hands;
  field: SnowField;
  /** 这一小步有没有搓出一颗新的 */
  made: boolean;
  /** 没搓成的原因,给 HUD 提示用 */
  blocked: "" | "full" | "bare";
}

/**
 * 蹲着搓一小步。
 * 手满了或者脚下没雪都搓不出来,而且**不会**攒进度——站起来就得从头搓。
 */
export function scoopTick(hands: Hands, field: SnowField, x: number, dt: number): ScoopResult {
  if (hands.balls >= HAND_MAX) {
    return { hands: { balls: hands.balls, progress: 0 }, field, made: false, blocked: "full" };
  }
  const i = patchIndex(field, x);
  const rate = scoopRate(field.depth[i] ?? 0);
  if (rate <= 0) {
    return { hands: { balls: hands.balls, progress: 0 }, field, made: false, blocked: "bare" };
  }
  const progress = hands.progress + dt * rate;
  if (progress < SCOOP_TIME) {
    return { hands: { balls: hands.balls, progress }, field, made: false, blocked: "" };
  }
  const depth = field.depth.slice();
  depth[i] = Math.max(0, (depth[i] ?? 0) - DEPTH_PER_BALL);
  return {
    hands: { balls: hands.balls + 1, progress: 0 },
    field: { ...field, depth },
    made: true,
    blocked: "",
  };
}

/** 被打断(站起来了 / 变成雪人了):正在搓的那一颗散掉 */
export function interrupt(hands: Hands): Hands {
  return hands.progress === 0 ? hands : { balls: hands.balls, progress: 0 };
}

/** 扔掉一颗;手上没有就返回 null(调用方据此提示「先蹲下搓一颗」) */
export function spendBall(hands: Hands): Hands | null {
  if (hands.balls <= 0) return null;
  return { balls: hands.balls - 1, progress: hands.progress };
}

/** 雪季一直在下:每一小步给全场补一点点厚度 */
export function snowfallTick(field: SnowField, dt: number, rate = SNOWFALL_RATE): SnowField {
  if (dt <= 0 || rate <= 0) return field;
  return { ...field, depth: field.depth.map((d) => Math.min(1, d + rate * dt)) };
}

/** 一发雪球砸在这儿,溅回来一点雪 */
export function splashSnow(field: SnowField, x: number, amount = SPLASH_DEPTH): SnowField {
  const i = patchIndex(field, x);
  const depth = field.depth.slice();
  depth[i] = Math.min(1, (depth[i] ?? 0) + amount);
  return { ...field, depth };
}

/** 站在这儿还能搓出几颗(给 AI 挑阵地、给 HUD 画雪量条用) */
export function ballsLeftAt(field: SnowField, x: number): number {
  return Math.floor(depthAt(field, x) / DEPTH_PER_BALL);
}

/**
 * 从 fromX 出发,方圆 range 内哪一格雪最厚(AI 换阵地用)。
 * 同厚度时选离得近的,免得 AI 为了 0.01 的厚度横穿整个场地。
 */
export function richestSpot(field: SnowField, fromX: number, range = 12): number {
  let bestX = fromX;
  let best = -1;
  for (let i = 0; i < field.depth.length; i++) {
    const cx = field.x0 + (i + 0.5) * field.patchW;
    if (Math.abs(cx - fromX) > range) continue;
    const score = (field.depth[i] ?? 0) - Math.abs(cx - fromX) * 0.012;
    if (score > best) {
      best = score;
      bestX = cx;
    }
  }
  return bestX;
}
