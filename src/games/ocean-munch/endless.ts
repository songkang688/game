// 海底大胃王 · 无尽「深海马拉松」(1.2 第 10 步新增)
//
// 一直往下潜,越潜越挤,能潜多深算多深。这里全是纯函数与纯数据:
// 成长曲线、层数生成、鱼群抽样、邻域网格、失败判定,外加一个不碰 DOM 的
// 无头模拟器——「这条曲线到底能不能玩」只有让它自己跑一局才说得准。
//
// 三条不许碰的线:
//  1. 战役那 188 关的参数一个都不动。无尽复用的是**机制**(洋流函数、毒藻缩水、
//     图鉴归类),不是 `LEVELS` 关卡表——按关卡索引取的参数喂不进按层数走的曲线;
//  2. 邻域网格只活在模块内部,不挂 `window`,也不和别的游戏共享全局;
//  3. 随机一律走 `makeRng(seed)`。同一个种子必须跑出同一局,不然失败清单没法复现。

import { START_RADIUS } from "./logic";

/* ------------------------------------------------------------------ */
/* 随机源                                                              */
/* ------------------------------------------------------------------ */

/** 随机源:传 `Math.random` 或者定种子发生器都行。 */
export type Rng = () => number;

/** mulberry32:实现短、分布够用、换种子就换一整局。 */
export function makeRng(seed: number): Rng {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* 成长曲线                                                            */
/* ------------------------------------------------------------------ */

/**
 * 无尽开局就比战役壮实一圈。失败线是「被啃到 ≤ 起始体型 `START_RADIUS`」,
 * 所以开局必须留出余量——不然第一口就被咬中直接结束,那不叫无尽。
 * 22 ÷ 14 差不多是三口的缓冲(0.84³ ≈ 0.59)。
 */
export const ENDLESS_START_RADIUS = 22;

/** 无尽里再怎么吃也长不过这个数:再大就看不清「谁比谁大」了。 */
export const MAX_RADIUS = 86;
/** 第一层每吃一口的成长系数。 */
export const GROWTH_K0 = 3.2;
/** 层数每深一层,成长系数按这个比例摊薄。 */
export const GROWTH_DECAY = 0.38;
/** 摊薄到底也还剩这么多,不然深层吃一百口都不长。 */
export const GROWTH_K_MIN = 0.7;

/** 第 tier 层每吃一口的成长系数:层数越深越小,防止两分钟撑破屏幕。 */
export function growthK(tier: number): number {
  const t = Math.max(1, Math.floor(tier));
  return Math.max(GROWTH_K_MIN, GROWTH_K0 / (1 + GROWTH_DECAY * (t - 1)));
}

/**
 * 吃掉一只半径 preyR 的猎物之后的新半径:`r' = r + k(tier) * (preyR / r)`。
 *
 * 质量守恒式的写法:同样一口,身子越大长得越少;层数越深每口越不值钱。
 * 单调(吃只会变大)且有上限(永远不超过 `MAX_RADIUS`)。
 */
export function growEndless(r: number, preyR: number, tier: number): number {
  const cur = Number.isFinite(r) && r > 0 ? r : START_RADIUS;
  const prey = Number.isFinite(preyR) && preyR > 0 ? preyR : 0;
  return Math.min(MAX_RADIUS, cur + growthK(tier) * (prey / cur));
}

/** 只能吃**明显更小**的:对方半径 ≤ 自己 × 0.85。擦边秒杀手感脏,不留。 */
export const SWALLOW_RATIO = 0.85;

export function canSwallow(playerR: number, preyR: number): boolean {
  return preyR <= playerR * SWALLOW_RATIO;
}

/** 对方明显更大才咬得动你;差不多大就只是撞一下。 */
export const PREDATOR_RATIO = 1.12;

export function isPredator(playerR: number, otherR: number): boolean {
  return otherR >= playerR * PREDATOR_RATIO;
}

/** 被更大的咬到会掉一块质量(掉的是泡泡和彩纸,不是别的)。 */
export const BITE_KEEP = 0.84;

/** 掉完这一块之后剩多大。掉到起始体型以下就该回岸上歇着了。 */
export function biteLoss(r: number): number {
  return Math.max(0, r * BITE_KEEP);
}

/* ------------------------------------------------------------------ */
/* 速度与冲刺                                                          */
/* ------------------------------------------------------------------ */

/** 起始体型时的游速(像素/秒)。 */
export const BASE_SPEED = 250;
/** 越大越慢的斜率。 */
export const SPEED_DECAY = 0.016;
/** 冲刺倍率。 */
export const DASH_MULT = 1.8;
/** 一次冲刺持续多久(秒)。 */
export const DASH_TIME = 0.45;
/** 冲刺冷却(秒)。 */
export const DASH_CD = 2.4;

/** `v = v0 / (1 + a * (r - r0))`:越大越慢,但永远慢不到不能动。 */
export function endlessSpeed(r: number): number {
  const over = Math.max(0, (Number.isFinite(r) ? r : START_RADIUS) - START_RADIUS);
  return BASE_SPEED / (1 + SPEED_DECAY * over);
}

/** 冲刺中的游速。 */
export function dashSpeed(r: number): number {
  return endlessSpeed(r) * DASH_MULT;
}

/** 冷却走完了才冲得动。 */
export function dashReady(cooldown: number): boolean {
  return cooldown <= 0;
}

/* ------------------------------------------------------------------ */
/* 层数:每 400 米或每 45 秒进一层                                      */
/* ------------------------------------------------------------------ */

/** 潜够这么多米进一层。 */
export const TIER_DEPTH = 400;
/** 或者熬够这么多秒也进一层(两条都算,快的那条说了算)。 */
export const TIER_SECONDS = 45;
/** 一共这么多层,到底了就一直是最深那层。 */
export const TIER_MAX = 9;

export interface EndlessTier {
  /** 第几层(1 起) */
  level: number;
  name: string;
  blurb: string;
  /** 远景色:层数越深越暗 */
  top: string;
  bottom: string;
  accent: string;
  /** 出大鱼的概率加成 */
  bigFishBias: number;
  /** 毒藻鱼在鱼群里的占比 */
  toxinRate: number;
  /** 精英鱼的占比(吃到能破体型上限 10 秒) */
  eliteRate: number;
  /** 洋流推力(像素/秒),0 表示这一层没有洋流 */
  driftSpeed: number;
  /** 本层的体型上限;第 5 层起水压真的会把你压回来 */
  sizeCap: number;
  /** 同屏最多几条鱼 */
  crowd: number;
  /** 这一层开始才见得到的图鉴鱼种 */
  dexUnlock?: string;
  /** 漆黑水层:只看得清身边一圈 */
  dark?: boolean;
}

/**
 * 九层水:浅海 → 压渊。远景色一层比一层深,洋流、毒藻、精英鱼一层比一层多,
 * 体型上限一层比一层高——但涨得越来越慢,第 5 层起还得跟水压抢。
 */
export const ENDLESS_TIERS: readonly EndlessTier[] = [
  {
    level: 1, name: "阳光浅滩", blurb: "水面亮堂堂,小鱼扎着堆",
    top: "#cdefff", bottom: "#8fd0f0", accent: "#2a6a9a",
    bigFishBias: 0.04, toxinRate: 0, eliteRate: 0.02, driftSpeed: 0,
    sizeCap: 26, crowd: 16,
  },
  {
    level: 2, name: "珊瑚坡", blurb: "坡上珊瑚一丛丛,鱼开始挑食了",
    top: "#bfe6ff", bottom: "#79bde4", accent: "#2a6a9a",
    bigFishBias: 0.07, toxinRate: 0.05, eliteRate: 0.03, driftSpeed: 24,
    sizeCap: 34, crowd: 18,
  },
  {
    level: 3, name: "海藻带", blurb: "藻叶挡视线,提灯鱼从这层开始出没",
    top: "#a9daf7", bottom: "#62a8d8", accent: "#1f6a8a",
    bigFishBias: 0.1, toxinRate: 0.09, eliteRate: 0.04, driftSpeed: 34,
    sizeCap: 42, crowd: 20, dexUnlock: "lantern",
  },
  {
    level: 4, name: "断崖水道", blurb: "水道又窄又急,洋流推着所有人走",
    top: "#8fc7ee", bottom: "#4d90c6", accent: "#1f6a8a",
    bigFishBias: 0.13, toxinRate: 0.12, eliteRate: 0.05, driftSpeed: 46,
    sizeCap: 50, crowd: 22,
  },
  {
    level: 5, name: "压力层", blurb: "水压上来了!体型超过上限就会慢慢缩",
    top: "#77b0e0", bottom: "#3d76b0", accent: "#28508e",
    bigFishBias: 0.15, toxinRate: 0.15, eliteRate: 0.07, driftSpeed: 54,
    sizeCap: 57, crowd: 24,
  },
  {
    level: 6, name: "荧光雾区", blurb: "满眼荧光,好看的多半是毒藻鱼",
    top: "#5f96cc", bottom: "#2f5c96", accent: "#28508e",
    bigFishBias: 0.17, toxinRate: 0.19, eliteRate: 0.08, driftSpeed: 60,
    sizeCap: 63, crowd: 26, dexUnlock: "ribbon",
  },
  {
    level: 7, name: "暗流深槽", blurb: "暗流一阵一阵,大鱼贴着槽壁巡逻",
    top: "#4b7cb4", bottom: "#254a7e", accent: "#8fb6ff",
    bigFishBias: 0.19, toxinRate: 0.22, eliteRate: 0.09, driftSpeed: 68,
    sizeCap: 68, crowd: 28,
  },
  {
    level: 8, name: "无光深渊", blurb: "伸手不见鳍,只看得清身边一圈",
    top: "#37588a", bottom: "#182f56", accent: "#9a8ae8",
    bigFishBias: 0.2, toxinRate: 0.24, eliteRate: 0.1, driftSpeed: 74,
    sizeCap: 72, crowd: 30, dark: true,
  },
  {
    level: 9, name: "万丈压渊", blurb: "最深的一层,水压把谁都摁得死死的",
    top: "#293f68", bottom: "#0f1c36", accent: "#b0c4ff",
    bigFishBias: 0.2, toxinRate: 0.26, eliteRate: 0.12, driftSpeed: 80,
    sizeCap: 76, crowd: 32, dark: true,
  },
];

/** 潜到 depth 米、游了 elapsed 秒时在第几层。两条件取快的那条。 */
export function tierAt(depth: number, elapsed: number): number {
  const byDepth = Math.floor(Math.max(0, depth) / TIER_DEPTH);
  const byTime = Math.floor(Math.max(0, elapsed) / TIER_SECONDS);
  return Math.max(1, Math.min(TIER_MAX, 1 + Math.max(byDepth, byTime)));
}

/** 第 tier 层的参数;越界夹到两端。 */
export function tierSpec(tier: number): EndlessTier {
  const i = Math.max(1, Math.min(TIER_MAX, Math.floor(tier))) - 1;
  return ENDLESS_TIERS[i];
}

/**
 * 战役关号 → 无尽起始层。第 1 关从阳光浅滩起步,第 188 关直接落到万丈压渊,
 * 中间每 21 关左右换一层(`1 + floor((n - 1) * 9 / 188)`,越界先夹到 1..188):
 *
 * | 关号 | 1–21 | 22–42 | 43–63 | 64–84 | 85–105 | 106–126 | 127–147 | 148–168 | 169–188 |
 * | 层   | 1    | 2     | 3     | 4     | 5      | 6       | 7       | 8       | 9       |
 *
 * 这张表 `endless.test.ts` 里逐个换层点都对过一遍,改公式必然红。
 */
export function startTierForLevel(level: number): number {
  const n = Math.round(Number(level));
  if (!Number.isFinite(n)) return 1;
  const clamped = Math.max(1, Math.min(188, n));
  return Math.max(1, Math.min(TIER_MAX, 1 + Math.floor(((clamped - 1) * TIER_MAX) / 188)));
}

/** 从第 tier 层开局时,深度从这儿算起(这样层数和深度对得上)。 */
export function depthForTier(tier: number): number {
  return Math.max(0, Math.min(TIER_MAX, Math.floor(tier)) - 1) * TIER_DEPTH;
}

/* ------------------------------------------------------------------ */
/* 深渊压力与精英鱼                                                    */
/* ------------------------------------------------------------------ */

/** 第 5 层起有水压。 */
export const PRESSURE_FROM_TIER = 5;
/** 超过上限之后每秒掉多少半径。 */
export const PRESSURE_DRAIN = 1.8;
/** 吃到精英鱼能破上限多少秒。 */
export const ELITE_BREAK = 10;
/** 破上限期间能多长这么多。 */
export const ELITE_SLACK = 12;

export function hasPressure(tier: number): boolean {
  return tier >= PRESSURE_FROM_TIER;
}

/** 这一刻的体型上限:破上限期间多给一截。 */
export function radiusCapAt(tier: number, eliteLeft = 0): number {
  return tierSpec(tier).sizeCap + (eliteLeft > 0 ? ELITE_SLACK : 0);
}

/**
 * 水压这一帧把你压回去多少。只在第 5 层起、而且真的超了上限时才掉,
 * 一帧最多掉到上限为止——不会把人一路压到起始体型,那样太吓人。
 */
export function pressureDrain(r: number, tier: number, dt: number, eliteLeft = 0): number {
  if (!hasPressure(tier)) return r;
  const cap = radiusCapAt(tier, eliteLeft);
  if (r <= cap) return r;
  return Math.max(cap, r - PRESSURE_DRAIN * Math.max(0, dt));
}

/**
 * 这一刻水压对你是什么状态:
 * `none` 还没到有水压的层 / `safe` 在上限之内 / `squeezed` 超了,正在被压小。
 */
export type PressureState = "none" | "safe" | "squeezed";

export function pressureState(r: number, tier: number, eliteLeft = 0): PressureState {
  if (!hasPressure(tier)) return "none";
  const size = Number.isFinite(r) ? r : 0;
  return size > radiusCapAt(tier, eliteLeft) ? "squeezed" : "safe";
}

/**
 * HUD 上那一行水压提示。
 *
 * 以前这一行只有两种写法:吃到精英鱼是「顶住水压 N 秒」,其余一律「水压上限 M」——
 * **不管你现在是安全的还是正在被 `pressureDrain` 一点点压小,印的都是同一句话**。
 * 孩子看到的现象是「我明明一直在吃,鱼却越来越小」,屏幕上没有一个字解释为什么。
 *
 * 这里只改这一行字怎么写:`PRESSURE_DRAIN`、`sizeCap`、`ELITE_BREAK` 一个数都没动。
 * `none` 档返回空串,调用方照常什么都不显示。
 */
export function pressureLine(r: number, tier: number, eliteLeft = 0): string {
  const state = pressureState(r, tier, eliteLeft);
  if (state === "none") return "";
  const cap = Math.round(radiusCapAt(tier, eliteLeft));
  if (eliteLeft > 0) {
    const secs = Math.ceil(eliteLeft);
    return state === "squeezed"
      ? `💫 顶住水压 ${secs} 秒(上限 ${cap})· 时间一到就会被压回去,快再找一条精英鱼`
      : `💫 顶住水压 ${secs} 秒(上限 ${cap})`;
  }
  return state === "squeezed"
    ? `🕳 超过水压上限 ${cap} 啦,正在被慢慢压小 —— 吃一条精英鱼就能顶住`
    : `🕳 水压上限 ${cap}`;
}

/* ------------------------------------------------------------------ */
/* 鱼群抽样                                                            */
/* ------------------------------------------------------------------ */

export type EndlessFishKind = "minnow" | "stripey" | "bigblue" | "toxin" | "elite";

export interface EndlessFish {
  kind: EndlessFishKind;
  /** 半径 */
  r: number;
  /** 游速倍率(小鱼更灵活) */
  speedMul: number;
  /** 记进图鉴的条目 id */
  dexId: string;
  /** 这条鱼比玩家大(画的时候要带锯齿背鳍和斜纹,不能只靠颜色) */
  danger: boolean;
}

/**
 * 抽一条鱼:大多数比你小一圈,层数越深大鱼、毒藻鱼、精英鱼越多。
 * 同一个 rng 序列必须抽出同一串鱼——层生成可复现全靠这一条。
 */
export function spawnEndlessFish(tier: number, playerR: number, rng: Rng): EndlessFish {
  const spec = tierSpec(tier);
  const base = Math.max(START_RADIUS, playerR);
  const roll = rng();
  const size = rng();

  if (roll < spec.toxinRate) {
    // 毒藻鱼:个头永远吃得下,咬下去却会缩水。靠荧光圈和 ☠ 认,不靠颜色
    return {
      kind: "toxin",
      r: Math.max(8, base * (0.4 + size * 0.25)),
      speedMul: 1.05,
      dexId: "toxin",
      danger: false,
    };
  }
  if (roll < spec.toxinRate + spec.eliteRate) {
    // 精英鱼:比你大一点点,吃得下但要冲刺才追得上,吃到就破上限 10 秒
    return {
      kind: "elite",
      r: Math.min(MAX_RADIUS, base * (0.68 + size * 0.14)),
      speedMul: 1.35,
      dexId: "elite",
      danger: false,
    };
  }

  const smallShare = Math.max(0.42, 0.7 - spec.bigFishBias);
  if (roll < smallShare) {
    // 毒藻鱼和精英鱼占掉的是 roll 区间的前一段,小鱼真正的区间是 [lo, smallShare)。
    // 归一化必须按这一段的宽度来:拿整个 smallShare 当分母的话,层数越深(lo 越大)
    // t 的上界压得越低,第 7 层起就再也长不出中号的条纹鱼,深层只剩最小的一档。
    const lo = spec.toxinRate + spec.eliteRate;
    const t = (roll - lo) / Math.max(1e-6, smallShare - lo);
    const r = Math.max(7, base * (0.3 + 0.44 * Math.min(1, Math.max(0, t))));
    const stripey = r >= base * 0.5;
    return {
      kind: stripey ? "stripey" : "minnow",
      r,
      speedMul: stripey ? 1.08 : 1.2,
      dexId: stripey ? (spec.dexUnlock === "lantern" && size > 0.6 ? "lantern" : "stripey") : "minnow",
      danger: false,
    };
  }

  const t = (roll - smallShare) / Math.max(1e-6, 1 - smallShare);
  const r = Math.min(MAX_RADIUS + 8, base * (1.16 + 0.62 * t));
  return {
    kind: "bigblue",
    r,
    speedMul: 0.92,
    dexId: spec.dexUnlock === "ribbon" && size > 0.65 ? "ribbon" : "bigblue",
    danger: true,
  };
}

/* ------------------------------------------------------------------ */
/* 吞咽手感:拉伸 + 半径插值                                            */
/* ------------------------------------------------------------------ */

/** 吞咽拉伸一共这么久(毫秒)。 */
export const SWALLOW_MS = 180;

export interface Stretch {
  /** 朝着猎物方向拉长多少倍 */
  along: number;
  /** 垂直方向压扁多少倍 */
  across: number;
}

/**
 * 吞咽的椭圆拉伸:前三分之一拉长,后面缓缓回正,`SWALLOW_MS` 之后完全复原。
 * `reduced` 为真(用户关掉了系统动效)时一路都是 1——只留音效与半径插值。
 */
export function swallowStretch(elapsedMs: number, reduced = false): Stretch {
  if (reduced) return { along: 1, across: 1 };
  const t = Math.max(0, Math.min(1, elapsedMs / SWALLOW_MS));
  if (t >= 1) return { along: 1, across: 1 };
  // 0 → 1 → 0 的一个小驼峰,峰值落在三分之一处
  const bump = t < 1 / 3 ? t * 3 : 1 - (t - 1 / 3) * 1.5;
  const k = Math.max(0, bump);
  return { along: 1 + 0.26 * k, across: 1 - 0.16 * k };
}

/**
 * 画面上的半径追着逻辑半径走,禁止一帧跳变。
 * `tau` 是时间常数:越小追得越紧,0.09 秒大约三四帧追平。
 */
export function easeRadius(shown: number, target: number, dt: number, tau = 0.09): number {
  if (!Number.isFinite(shown)) return target;
  const k = Math.min(1, Math.max(0, dt) / Math.max(1e-3, tau));
  return shown + (target - shown) * k;
}

/* ------------------------------------------------------------------ */
/* 失败判定与文案                                                      */
/* ------------------------------------------------------------------ */

/** 这么久没有进食就该回岸上歇着了(秒)。 */
export const STARVE_SECONDS = 90;
/** 还剩这么点时间没吃到东西时,画面上开始提醒。 */
export const STARVE_WARN = 20;

export function isStarved(sinceLastEat: number): boolean {
  return sinceLastEat >= STARVE_SECONDS;
}

/** 还有多少秒就饿到游不动了(已经饿倒就是 0)。 */
export function starveLeft(sinceLastEat: number): number {
  const t = Number.isFinite(sinceLastEat) ? Math.max(0, sinceLastEat) : 0;
  return Math.max(0, STARVE_SECONDS - t);
}

/**
 * 饥饿预警分三档:`none` 不提醒 / `soft` 最后 20 秒开始提醒 /
 * `hard` 最后 8 秒催得紧一点。`STARVE_WARN` 这条线以前只有常量没人用,这里把它接出来。
 */
export type StarveWarn = "none" | "soft" | "hard";

/** 催得紧的那一档从还剩这么多秒起。 */
export const STARVE_HURRY = 8;

export function starveWarnLevel(sinceLastEat: number): StarveWarn {
  const left = starveLeft(sinceLastEat);
  if (left > STARVE_WARN) return "none";
  return left <= STARVE_HURRY ? "hard" : "soft";
}

/**
 * 预警文案:只提醒去吃东西,不吓唬人（分级红线同失败文案，无血伤死字眼）。
 * `none` 档返回空串,调用方照常什么都不显示。
 */
export function starveWarnLine(sinceLastEat: number): string {
  const level = starveWarnLevel(sinceLastEat);
  if (level === "none") return "";
  const left = Math.ceil(starveLeft(sinceLastEat));
  return level === "hard"
    ? `快去吃两口!还有 ${left} 秒就游不动啦`
    : `肚子开始咕咕叫了,${left} 秒内找条小鱼吃掉吧`;
}

/** 被啃到起始体型(或更小)就结束这一趟。 */
export function isNibbledOut(r: number): boolean {
  return r <= START_RADIUS;
}

export type EndlessFail = "nibbled" | "starved";

/** 这一帧该不该结束这一趟;没结束就返回 null。 */
export function endlessFailAt(r: number, sinceLastEat: number): EndlessFail | null {
  if (isNibbledOut(r)) return "nibbled";
  if (isStarved(sinceLastEat)) return "starved";
  return null;
}

export interface EndlessCopy {
  title: string;
  /** 朗读用的整句 */
  line: string;
  /** 面板上分两行显示,360 宽也放得下 */
  lines: [string, string];
}

/**
 * 失败文案只鼓励不批评:先夸这一趟潜了多深,再给一条下次用得上的办法。
 * 分级红线:无血无伤无死亡描写,被吃就是「晕乎乎回岸上休息」。
 */
export function endlessFailCopy(kind: EndlessFail, depth: number): EndlessCopy {
  const m = Math.max(0, Math.floor(depth));
  const head = `这一趟潜到 ${m} 米!`;
  const tail =
    kind === "starved"
      ? "太久没吃东西会游不动哦,看见小鱼群就先去吃两口再往下潜。"
      : "被大鱼碰一下会掉一块,晕乎乎回岸上休息一会儿就好,下次先躲开再找小鱼吃。";
  return {
    title: kind === "starved" ? "肚子饿得游不动啦" : "晕乎乎回岸上休息",
    line: head + tail,
    lines: [head, tail],
  };
}

/* ------------------------------------------------------------------ */
/* 邻域网格:鱼一多也不能掉帧                                          */
/* ------------------------------------------------------------------ */

export interface GridItem {
  x: number;
  y: number;
}

/**
 * 单元格哈希。IO 类那套「网格 / 四叉树邻域查询」的结构,只学结构:
 * 不联网、不加依赖、不挂 `window`,一个实例只服务一局。
 *
 * 用法:每帧 `clear()` → 逐个 `insert()` → `near(x, y, radius)` 只拿邻近格子里的东西。
 */
export class SpatialGrid<T extends GridItem> {
  private cells = new Map<number, T[]>();

  constructor(public readonly cell: number = 96) {}

  private key(cx: number, cy: number): number {
    // 坐标可能是负的,先偏到正数再打包成一个整数 key
    return (cx + 512) * 4096 + (cy + 512);
  }

  clear(): void {
    this.cells.clear();
  }

  insert(item: T): void {
    const cx = Math.floor(item.x / this.cell);
    const cy = Math.floor(item.y / this.cell);
    const k = this.key(cx, cy);
    const bucket = this.cells.get(k);
    if (bucket) bucket.push(item);
    else this.cells.set(k, [item]);
  }

  /** 以 (x, y) 为心、radius 为半径的方形邻域里落着的东西(可能略多,不会漏)。 */
  near(x: number, y: number, radius: number): T[] {
    const out: T[] = [];
    const r = Math.max(0, radius);
    const x0 = Math.floor((x - r) / this.cell);
    const x1 = Math.floor((x + r) / this.cell);
    const y0 = Math.floor((y - r) / this.cell);
    const y1 = Math.floor((y + r) / this.cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  }

  /** 现在装着几个东西(测试用)。 */
  get size(): number {
    let n = 0;
    for (const bucket of this.cells.values()) n += bucket.length;
    return n;
  }
}

/* ------------------------------------------------------------------ */
/* 深度                                                                */
/* ------------------------------------------------------------------ */

/** 一直往下潜的基础速度(米/秒);400 米差不多正好 45 秒,和时间那条线对得上。 */
export const DEPTH_PER_SEC = 8.6;
/** 冲刺时下潜快多少。 */
export const DEPTH_DASH_MULT = 1.6;
/** 每吃一口额外往下钻多少米(吃得越勤潜得越快)。 */
export const DEPTH_PER_BITE = 6;

export function depthGain(dt: number, dashing: boolean): number {
  return DEPTH_PER_SEC * Math.max(0, dt) * (dashing ? DEPTH_DASH_MULT : 1);
}

/* ------------------------------------------------------------------ */
/* 无头模拟器:这条曲线到底能不能玩                                    */
/* ------------------------------------------------------------------ */

/**
 * 三种打法:
 *  · `greedy` —— 会躲会吃的正常打法,用来验「一局活得过 60 秒」;
 *  · `timid`  —— 只躲不吃,用来验「90 秒不进食真的会饿到游不动」;
 *  · `reckless` —— 见谁咬谁,用来验「被啃到起始体型真的会结束」。
 */
export type SimPolicy = "greedy" | "timid" | "reckless";

export interface SimOptions {
  seed: number;
  /** 最多模拟这么多秒 */
  seconds?: number;
  dt?: number;
  startTier?: number;
  policy?: SimPolicy;
  width?: number;
  height?: number;
}

export interface SimResult {
  /** 活了多少秒 */
  alive: number;
  depth: number;
  tier: number;
  radius: number;
  eaten: number;
  /** 被咬掉块的次数 */
  bitten: number;
  /** 这一趟见过的图鉴条目 */
  dex: string[];
  fail: EndlessFail | null;
}

interface SimFish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fish: EndlessFish;
}

/**
 * 一局无尽跑到底(纯数值,不碰 DOM)。
 * 模型只保留会影响曲线的那几件事:抽鱼、追鱼、躲大鱼、冲刺、水压、两种失败。
 * 它不是真游戏,但用的是真曲线——曲线崩了这里第一个红。
 */
export function simulateEndless(opts: SimOptions): SimResult {
  const rng = makeRng(opts.seed);
  const dt = opts.dt ?? 1 / 30;
  const limit = opts.seconds ?? 90;
  const w = opts.width ?? 640;
  const h = opts.height ?? 480;
  const policy: SimPolicy = opts.policy ?? "greedy";

  let r = ENDLESS_START_RADIUS;
  let px = w / 2;
  let py = h / 2;
  let depth = depthForTier(opts.startTier ?? 1);
  let elapsed = 0;
  let sinceEat = 0;
  let dashCd = 0;
  let dashLeft = 0;
  let eliteLeft = 0;
  let invincible = 0;
  let eaten = 0;
  let bitten = 0;
  let spawnTimer = 0;
  const dex = new Set<string>();
  const fishes: SimFish[] = [];

  const tierNow = (): number => tierAt(depth, elapsed);

  while (elapsed < limit) {
    const tier = tierNow();
    const spec = tierSpec(tier);

    // 抽鱼:同屏不超过本层的鱼群上限
    spawnTimer -= dt;
    if (spawnTimer <= 0 && fishes.length < spec.crowd) {
      spawnTimer = 0.35;
      const f = spawnEndlessFish(tier, r, rng);
      const fromLeft = rng() < 0.5;
      fishes.push({
        x: fromLeft ? -f.r : w + f.r,
        y: 30 + rng() * Math.max(30, h - 60),
        vx: (fromLeft ? 1 : -1) * 60 * f.speedMul,
        vy: (rng() - 0.5) * 24,
        fish: f,
      });
    }

    // 挑目标:greedy 找最近的能吃的,reckless 专挑最大的
    let target: SimFish | null = null;
    let threat: SimFish | null = null;
    let bestScore = Infinity;
    let biggest = -Infinity;
    for (const f of fishes) {
      const d = Math.hypot(f.x - px, f.y - py);
      if (isPredator(r, f.fish.r)) {
        if (d < 130 && (!threat || d < Math.hypot(threat.x - px, threat.y - py))) threat = f;
        if (policy === "reckless" && f.fish.r > biggest) {
          biggest = f.fish.r;
          target = f;
        }
        continue;
      }
      if (policy !== "greedy") continue;
      if (f.fish.kind === "toxin") continue;
      if (!canSwallow(r, f.fish.r)) continue;
      if (d < bestScore) {
        bestScore = d;
        target = f;
      }
    }

    // 走位:先躲,再追。追得远就点一下冲刺
    dashCd = Math.max(0, dashCd - dt);
    dashLeft = Math.max(0, dashLeft - dt);
    let aimX = 0;
    let aimY = 0;
    if (threat && policy !== "reckless") {
      // 先保命:躲开身边最近的那条大鱼,这一帧不管吃
      aimX = px - threat.x;
      aimY = py - threat.y;
    } else if (target) {
      aimX = target.x - px;
      aimY = target.y - py;
      if (bestScore > 150 && dashReady(dashCd)) {
        dashLeft = DASH_TIME;
        dashCd = DASH_CD;
      }
    }
    const aimLen = Math.hypot(aimX, aimY);
    const dashing = dashLeft > 0;
    if (aimLen > 1) {
      const v = (dashing ? dashSpeed(r) : endlessSpeed(r)) * dt;
      px = Math.max(r, Math.min(w - r, px + (aimX / aimLen) * v));
      py = Math.max(r, Math.min(h - r, py + (aimY / aimLen) * v));
    }

    // 鱼群移动 + 出界回收
    for (let i = fishes.length - 1; i >= 0; i--) {
      const f = fishes[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y < 10 || f.y > h - 10) f.vy = -f.vy;
      if (f.x < -f.fish.r - 60 || f.x > w + f.fish.r + 60) fishes.splice(i, 1);
    }

    // 碰撞:吃掉 / 被咬掉一块
    invincible = Math.max(0, invincible - dt);
    for (let i = fishes.length - 1; i >= 0; i--) {
      const f = fishes[i];
      if (Math.hypot(f.x - px, f.y - py) > (r + f.fish.r) * 0.78) continue;
      if (policy !== "timid" && canSwallow(r, f.fish.r) && f.fish.kind !== "toxin") {
        fishes.splice(i, 1);
        r = growEndless(r, f.fish.r, tier);
        depth += DEPTH_PER_BITE;
        eaten++;
        sinceEat = 0;
        dex.add(f.fish.dexId);
        if (f.fish.kind === "elite") eliteLeft = ELITE_BREAK;
        continue;
      }
      if (isPredator(r, f.fish.r)) {
        if (invincible > 0) continue;
        r = biteLoss(r);
        invincible = 1.4;
        bitten++;
      }
    }

    eliteLeft = Math.max(0, eliteLeft - dt);
    r = pressureDrain(r, tier, dt, eliteLeft);
    depth += depthGain(dt, dashing);
    elapsed += dt;
    sinceEat += dt;

    const fail = endlessFailAt(r, sinceEat);
    if (fail) {
      return {
        alive: elapsed,
        depth,
        tier: tierNow(),
        radius: r,
        eaten,
        bitten,
        dex: [...dex],
        fail,
      };
    }
  }

  return {
    alive: elapsed,
    depth,
    tier: tierNow(),
    radius: r,
    eaten,
    bitten,
    dex: [...dex],
    fail: null,
  };
}
