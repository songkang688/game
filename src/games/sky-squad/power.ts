/**
 * 飞机小队 —— 1.2 火力成长(纯逻辑,零 DOM)。
 *
 * 1.1 的火力只有一根 `power: 1..3` 的杆子。1.2 拆成**四条互不打架的成长线**:
 *
 *   散射 spread —— 一次多打几发,横着铺开;
 *   追踪 homing —— 弹会自己拐一点弯去找最近的敌机(拐得很慢,看得懂);
 *   穿透 pierce —— 打中不消失,继续往后穿;
 *   僚机 wing   —— 左右各跟一架小飞机替你打直线。
 *
 * 每条线都有上限,吃满了再吃只会换成小星星。被碰到**掉一级**(而不是清零、
 * 更不是直接结束),掉的是「最近吃到的那一级」——孩子不会一次损失全部积累。
 *
 * 分级约定:这里的一切都是纸飞机和棉花糖弹,没有任何写实武器口径。
 */

/** 四条成长线 */
export type PowerTrack = "spread" | "homing" | "pierce" | "wing";

export const POWER_TRACKS: PowerTrack[] = ["spread", "homing", "pierce", "wing"];

export interface TrackInfo {
  name: string;
  emoji: string;
  /** 这条线最高几级 */
  cap: number;
  desc: string;
}

export const TRACK_INFO: Record<PowerTrack, TrackInfo> = {
  spread: { name: "散射", emoji: "🌟", cap: 3, desc: "一次多打几发,横着铺开一片。" },
  homing: { name: "追踪", emoji: "🎈", cap: 2, desc: "弹会慢慢拐个弯去找最近的小飞机。" },
  pierce: { name: "穿透", emoji: "💠", cap: 2, desc: "打中了也不停,继续往后面穿过去。" },
  wing: { name: "僚机", emoji: "🛩️", cap: 2, desc: "左右各跟一架小僚机,替你打直线。" },
};

/** 四条线的当前等级 */
export type PowerLevels = Record<PowerTrack, number>;

export function emptyPower(): PowerLevels {
  return { spread: 0, homing: 0, pierce: 0, wing: 0 };
}

/** 火力总档位:HUD 上那个「Lv」,四条线之和 */
export function powerLevel(levels: PowerLevels): number {
  return POWER_TRACKS.reduce((n, t) => n + Math.max(0, Math.min(TRACK_INFO[t].cap, levels[t])), 0);
}

/** 全部吃满是几级(HUD 的分母) */
export const POWER_MAX = POWER_TRACKS.reduce((n, t) => n + TRACK_INFO[t].cap, 0);

export interface UpgradeResult {
  levels: PowerLevels;
  /** 真的升上去了吗(吃满了就是 false) */
  upgraded: boolean;
  /** 给玩家看的一句话 */
  line: string;
}

/** 吃到一个升级(纯函数;到顶不再涨) */
export function upgrade(levels: PowerLevels, track: PowerTrack): UpgradeResult {
  const info = TRACK_INFO[track];
  const now = Math.max(0, Math.min(info.cap, levels[track]));
  if (now >= info.cap) {
    return { levels: { ...levels, [track]: info.cap }, upgraded: false, line: `${info.emoji} ${info.name}已经满级啦!` };
  }
  return {
    levels: { ...levels, [track]: now + 1 },
    upgraded: true,
    line: `${info.emoji} ${info.name} Lv${now + 1}!`,
  };
}

/**
 * 被碰到掉一级:优先掉等级最高的那条线,同级时按 `POWER_TRACKS` 的顺序。
 * 已经全是 0 了就什么都不掉 —— 掉到底也不会「失去资格」,
 * 这一趟照样飞得下去(结束与否由备用小飞机决定,不由火力决定)。
 */
export function dropOneLevel(levels: PowerLevels): { levels: PowerLevels; track: PowerTrack | null } {
  let pick: PowerTrack | null = null;
  let best = 0;
  for (const t of POWER_TRACKS) {
    const v = Math.max(0, Math.min(TRACK_INFO[t].cap, levels[t]));
    if (v > best) {
      best = v;
      pick = t;
    }
  }
  if (!pick) return { levels: { ...levels }, track: null };
  return { levels: { ...levels, [pick]: best - 1 }, track: pick };
}

// ---------------------------------------------------------------------------
// 成长线怎么变成子弹
// ---------------------------------------------------------------------------

/** 我方弹的形状:和敌弹那一套形状完全不重叠(不能只靠颜色分阵营) */
export type MyShotShape = "arrow" | "ring" | "beam";

export interface ShotPlan {
  /** 一次打几发 */
  count: number;
  /** 每发的横向偏移与角度偏移 */
  lanes: Array<{ dx: number; angle: number }>;
  /** 会不会拐弯找敌机(0 = 直线) */
  homing: number;
  /** 能穿几个目标(1 = 打中就消失) */
  pierce: number;
  /** 带几架僚机 */
  wingmen: number;
  shape: MyShotShape;
  /** 两次射击的间隔(秒) */
  cooldown: number;
}

/**
 * 四条线合起来算出「这一发长什么样」(纯函数)。
 * 散射决定发数与铺开角度,追踪决定拐弯速度,穿透决定能穿几个,僚机决定跟几架。
 */
export function shotPlan(levels: PowerLevels): ShotPlan {
  const spread = Math.max(0, Math.min(TRACK_INFO.spread.cap, levels.spread));
  const homing = Math.max(0, Math.min(TRACK_INFO.homing.cap, levels.homing));
  const pierce = Math.max(0, Math.min(TRACK_INFO.pierce.cap, levels.pierce));
  const wing = Math.max(0, Math.min(TRACK_INFO.wing.cap, levels.wing));

  const count = 1 + spread;
  const lanes: Array<{ dx: number; angle: number }> = [];
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0 : i / (count - 1) - 0.5;
    lanes.push({ dx: f * 15 * (count - 1), angle: f * 0.16 * (count - 1) });
  }
  return {
    count,
    lanes,
    // 追踪拐得很慢:每秒最多摆 1.6 弧度,看得清它在找谁
    homing: homing * 0.8,
    pierce: 1 + pierce,
    wingmen: wing,
    shape: pierce > 0 ? "beam" : homing > 0 ? "ring" : "arrow",
    cooldown: Math.max(0.1, 0.2 - spread * 0.012 - pierce * 0.02),
  };
}

/**
 * 单位时间的期望输出(平衡用:任何一条线单吃都不该碾压另外三条)。
 * 追踪的价值不在弹多,而在**不落空**,所以它算成命中率的加成。
 */
export function planDps(levels: PowerLevels): number {
  const plan = shotPlan(levels);
  const perShot = plan.count * plan.pierce + plan.wingmen;
  const accuracy = 1 + plan.homing * 0.9;
  return Math.round(((perShot * accuracy) / plan.cooldown) * 10) / 10;
}

/**
 * 追踪弹的转向:朝目标每帧最多拐 `rate * dt` 弧度,拐不过去就直着飞。
 * 故意做得很钝 —— 会自己找路的弹如果太灵,弹幕就没有「读」的价值了。
 */
export function steer(vx: number, vy: number, tx: number, ty: number, x: number, y: number, rate: number, dt: number): { vx: number; vy: number } {
  if (rate <= 0) return { vx, vy };
  const speed = Math.hypot(vx, vy) || 1;
  const want = Math.atan2(ty - y, tx - x);
  const now = Math.atan2(vy, vx);
  let diff = want - now;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  const next = now + step;
  return { vx: Math.cos(next) * speed, vy: Math.sin(next) * speed };
}

// ---------------------------------------------------------------------------
// 双人合作:两机靠近就合流
// ---------------------------------------------------------------------------

/** 两架飞机靠到这么近,火力就合并 */
export const LINK_DIST = 130;

export interface LinkResult {
  linked: boolean;
  /** 合流后那一发的宽度(逻辑单位);没合流是 0 */
  width: number;
  /** 合流后那一发的伤害 */
  damage: number;
  /** 合流点(两机中点) */
  x: number;
  y: number;
}

/**
 * 合作模式的**配合价值**:两个人把飞机靠到一起,两条火力会拧成一道
 * 又宽又厚的「彩虹合流波」——比各打各的强得多,但要求两人同步走位。
 * 这是纯函数,合流与否只看两机距离与各自的火力等级。
 */
export function coopLink(
  a: { x: number; y: number; levels: PowerLevels },
  b: { x: number; y: number; levels: PowerLevels },
  dist = LINK_DIST
): LinkResult {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  if (d > dist) return { linked: false, width: 0, damage: 0, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const sum = powerLevel(a.levels) + powerLevel(b.levels);
  // 靠得越近,合流波越粗;火力越高,越厚
  const tight = 1 - d / dist;
  return {
    linked: true,
    width: Math.round(56 + tight * 48 + sum * 4),
    damage: 2 + Math.floor(sum / 3),
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}
