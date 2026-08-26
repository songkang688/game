// 绿芽保卫战 1.2 —— 阵列防守的新规则(纯函数,不碰 DOM)。
//
// 这一层放三样 1.1 没有的东西:
//  1. 绿芽体系:四类分工 + 一苗一档的造价/冷却/射速,附带「谁也不能通吃」的能力矩阵;
//  2. 敌人四类机制的预警时间表 —— 带盾 / 跳跃 / 挖地 / 飞行,一只都不许突然袭击;
//  3. 无尽「守到天亮」的波次曲线,以及资源节奏、手机版面、铲子误触保护这些小规则。
//
// 运行时(index.ts)与无头模拟器(sim.ts)都从这里取规则,保证「看到的」和「算出来的」是一套。

import {
  BELT_EVERY,
  BUG_INFO,
  BugKind,
  BugSpawn,
  LANES,
  LEVELS,
  PLANT_COLS,
  PLANT_INFO,
  PlantKind,
  ProjKind,
  SCENE_STYLE,
  SHOOT_CD_BY_KIND,
  SPARKLE_DEW_EVERY,
  WaveEntry,
  bugHp,
  buildLevelSchedule,
  passiveDewInterval,
  plantsUnlockedAt,
} from "./logic";

/* ================= 一、绿芽体系 ================= */

/** 四类分工 + 一类辅助(荷叶垫/望望草自己不打人,但少了它们有些道过不去)。 */
export type PlantRole = "produce" | "direct" | "splash" | "block" | "support";

export const ROLE_LABEL: Record<PlantRole, string> = {
  produce: "产资源",
  direct: "直射",
  splash: "溅射",
  block: "阻挡",
  support: "辅助",
};

/** 规格要求齐备的四类(辅助不算在内)。 */
export const MAIN_ROLES: PlantRole[] = ["produce", "direct", "splash", "block"];

export interface PlantSpec {
  role: PlantRole;
  /** 露珠造价(和 PLANT_INFO.cost 是同一个数,放这里是为了一张表看全) */
  dew: number;
  /** 阳光造价:1.2 新苗才吃阳光,老苗全是 0,所以前 99 关一点不受影响 */
  sun: number;
  /** 种下之后这张卡要歇多少秒 */
  cooldown: number;
  /** 会开枪的苗的射击间隔 */
  shootCd?: number;
  /** 打不打得到天上的 */
  air: boolean;
  /** 跟同类的区别在哪儿(攻略对照表直接用这句) */
  note: string;
}

export const PLANT_SPEC: Record<PlantKind, PlantSpec> = {
  sparkle: {
    role: "produce", dew: 1, sun: 0, cooldown: 0.4, air: false,
    note: "最便宜的经济苗,每 4.5 秒攒 1 滴露珠,越早种回本越多",
  },
  moon: {
    role: "produce", dew: 2, sun: 0, cooldown: 0.4, air: false,
    note: "月光时段 3 秒 1 滴,比闪光芽勤快,但白天完全不干活",
  },
  sunbud: {
    role: "produce", dew: 3, sun: 0, cooldown: 2, air: false,
    note: "唯一会开☀️阳光的苗,5 秒 1 点,天黑了慢一大截",
  },
  bubble: {
    role: "direct", dew: 2, sun: 0, cooldown: 0.5, shootCd: SHOOT_CD_BY_KIND.bubble, air: false,
    note: "最便宜的枪,只打地上的;人手一排靠它铺底",
  },
  star: {
    role: "direct", dew: 3, sun: 0, cooldown: 0.8, shootCd: SHOOT_CD_BY_KIND.star, air: true,
    note: "打得到天上的,而且卡片歇得最短、能连着补种,代价是没有减速",
  },
  ice: {
    role: "direct", dew: 3, sun: 0, cooldown: 1.4, shootCd: SHOOT_CD_BY_KIND.ice, air: true,
    note: "命中就冻住,对付狂飙的和重甲的最划算,代价是卡片要歇好一会儿",
  },
  puff: {
    role: "splash", dew: 2, sun: 2, cooldown: 2.5, shootCd: SHOOT_CD_BY_KIND.puff, air: false,
    note: "花粉团命中会溅到前后一小片,一串小虫排队时最赚",
  },
  boom: {
    role: "splash", dew: 4, sun: 0, cooldown: 1.5, air: false,
    note: "一次性的大范围爆发,专门用来拆挤成一坨的重甲队",
  },
  nut: {
    role: "block", dew: 2, sun: 0, cooldown: 0.6, air: false,
    note: "最厚的墙,便宜耐啃,但会跳的和挖地的都能绕过去",
  },
  netpad: {
    role: "block", dew: 2, sun: 1, cooldown: 2, air: false,
    note: "会跳的跳不过、挖地的钻不过,厚度不如果果墩,吃 1 点阳光",
  },
  lily: {
    role: "support", dew: 1, sun: 0, cooldown: 0.3, air: false,
    note: "水道专用底座,铺上去才能在水上种别的",
  },
  scout: {
    role: "support", dew: 2, sun: 0, cooldown: 0.6, air: false,
    note: "照亮整条道,藏土里的地地虫现形,挖地的出土点也提前看得见",
  },
};

export const PLANT_ORDER: PlantKind[] = [
  "sparkle", "moon", "sunbud", "bubble", "star", "ice", "puff", "boom", "nut", "netpad", "lily", "scout",
];

export function plantsWithRole(role: PlantRole): PlantKind[] {
  return PLANT_ORDER.filter((k) => PLANT_SPEC[k].role === role);
}

export function plantSunCost(kind: PlantKind): number {
  return PLANT_SPEC[kind].sun;
}

/** 露珠 + 阳光都够才种得下。 */
export function canAffordPlant(dew: number, sun: number, kind: PlantKind): boolean {
  return dew >= PLANT_INFO[kind].cost && sun >= PLANT_SPEC[kind].sun;
}

/** 种不下的时候要告诉小朋友为什么 —— 冷却 / 资源不足 / 这一格不能种。 */
export type PlantBlockReason = "cooldown" | "dew" | "sun" | "cell" | null;

export function plantBlockReason(
  kind: PlantKind,
  dew: number,
  sun: number,
  cooldownLeft: number,
  cellOk: boolean,
): PlantBlockReason {
  if (cooldownLeft > 0) return "cooldown";
  if (dew < PLANT_INFO[kind].cost) return "dew";
  if (sun < PLANT_SPEC[kind].sun) return "sun";
  if (!cellOk) return "cell";
  return null;
}

export const BLOCK_REASON_TEXT: Record<Exclude<PlantBlockReason, null>, string> = {
  cooldown: "这株还在歇气,等冷却圈转满",
  dew: "露珠不够啦,先种产露珠的苗",
  sun: "阳光不够啦,先种一株暖暖花",
  cell: "这一格种不了,换个空格子",
};

/* ---- 「没有万能苗」的能力矩阵 ---- */

export interface PlantAxes {
  /** 总造价(阳光按 2 滴露珠折算);越小越好,所以比较时取负 */
  cost: number;
  /** 持续输出(每秒伤害) */
  dps: number;
  /** 一次性爆发 */
  burst: number;
  /** 打得到天上的 */
  air: number;
  /** 溅射 */
  splash: number;
  /** 挡路的厚度 */
  hp: number;
  /** 每秒产的露珠 */
  dew: number;
  /** 每秒产的阳光 */
  sun: number;
  /** 减速控制 */
  control: number;
  /** 拦得住跳跃与挖地 */
  stopsJump: number;
  /** 照出藏起来的虫 */
  reveal: number;
  /** 能铺在水上 */
  water: number;
  /** 卡片歇完的快慢(1/冷却);越大越能连着补种 */
  ready: number;
}

const SUN_TO_DEW = 2;

export function plantAxes(kind: PlantKind): PlantAxes {
  const spec = PLANT_SPEC[kind];
  const shootDps = spec.shootCd ? 1 / spec.shootCd : 0;
  return {
    cost: spec.dew + spec.sun * SUN_TO_DEW,
    dps: kind === "puff" ? (1 + PUFF_SPLASH_HITS) / (spec.shootCd ?? 1) : shootDps,
    burst: kind === "boom" ? 10 : 0,
    air: spec.air ? 1 : 0,
    splash: spec.role === "splash" ? 1 : 0,
    hp: spec.role === "block" ? PLANT_INFO[kind].hp : 0,
    dew: kind === "sparkle" ? 1 / SPARKLE_DEW_EVERY : kind === "moon" ? 1 / 3 : 0,
    sun: kind === "sunbud" ? 1 / SUN_EVERY : 0,
    control: kind === "ice" ? 1 : 0,
    stopsJump: kind === "netpad" ? 1 : 0,
    reveal: kind === "scout" ? 1 : 0,
    water: kind === "lily" ? 1 : 0,
    ready: 1 / spec.cooldown,
  };
}

/** 花粉团除了命中那一下,还能溅到旁边一只(折算成 1 点持续输出)。 */
const PUFF_SPLASH_HITS = 1;

/**
 * a 是不是「全面压过」b:更便宜(或一样便宜)、而且每一项能力都不落下风,
 * 至少有一项更强。只要出现这种关系,弱的那株就再也没人种了。
 */
export function dominates(a: PlantKind, b: PlantKind): boolean {
  if (a === b) return false;
  const A = plantAxes(a);
  const B = plantAxes(b);
  if (A.cost > B.cost) return false;
  let better = A.cost < B.cost;
  for (const key of Object.keys(A) as Array<keyof PlantAxes>) {
    if (key === "cost") continue;
    if (A[key] < B[key]) return false;
    if (A[key] > B[key]) better = true;
  }
  return better;
}

/** 全表扫一遍,列出所有「支配关系」;空数组 = 没有万能苗。 */
export function dominancePairs(): Array<[PlantKind, PlantKind]> {
  const out: Array<[PlantKind, PlantKind]> = [];
  for (const a of PLANT_ORDER) {
    for (const b of PLANT_ORDER) {
      if (dominates(a, b)) out.push([a, b]);
    }
  }
  return out;
}

/* ================= 二、阳光经济 ================= */

/** 暖暖花开阳光的间隔(秒)。 */
export const SUN_EVERY = 5;
/** 刚种下的暖暖花「见面礼」:1.5 秒就开出第一点阳光,不用干等一整轮。 */
export const SUN_FIRST = 1.5;
/** 天黑了阳光开得慢多少。 */
export const SUN_NIGHT_SLOW = 1.6;

export function sunInterval(dark: boolean): number {
  return SUN_EVERY * (dark ? SUN_NIGHT_SLOW : 1);
}

/* ================= 三、敌人四类机制与预警 ================= */

/** 规格点名的四类:带盾 / 跳跃 / 挖地 / 飞行;hide 是 1.1 留下的「藏土里」。 */
export type BugTrait = "shield" | "jump" | "dig" | "fly" | "hide";

export const REQUIRED_TRAITS: BugTrait[] = ["shield", "jump", "dig", "fly"];

export const TRAIT_INFO: Record<BugTrait, { label: string; icon: string; counter: string }> = {
  shield: { label: "带盾", icon: "🛡", counter: "先把盾打碎才掉血,溅射和爆爆果拆盾最快" },
  jump: { label: "会跳", icon: "🦘", counter: "会跳过第一排阻挡,弹弹网能把它按下来" },
  dig: { label: "挖地", icon: "🕳", counter: "绕到前排后面出土,出土点会先冒土花,弹弹网让它钻不过去" },
  fly: { label: "会飞", icon: "🪽", counter: "只有星星芽和冰冰花打得到" },
  hide: { label: "藏土里", icon: "❓", counter: "望望草照亮整条道才打得到" },
};

export function bugTraits(kind: BugKind): BugTrait[] {
  const info = BUG_INFO[kind];
  const out: BugTrait[] = [];
  if (info.armor > 0) out.push("shield");
  if (info.jumps) out.push("jump");
  if (info.digs) out.push("dig");
  if (info.flying) out.push("fly");
  if (info.underground) out.push("hide");
  return out;
}

/** 预警提前多少秒亮出来(规格:不许突然袭击)。 */
export const WARN_LEAD = 3;

export interface SpawnWarning {
  /** 预警亮起的时刻 */
  time: number;
  /** 对应那只虫出场的时刻 */
  spawnTime: number;
  lane: number;
  kind: BugKind;
  trait: BugTrait;
  text: string;
}

/**
 * 把出虫时间表翻成预警时间表:每条道、每种机制,出场前 WARN_LEAD 秒亮一次角标。
 * 同一条道同一种机制连着来的时候只亮一次,免得屏幕上全是角标。
 */
export function buildWarnings(schedule: ReadonlyArray<BugSpawn>): SpawnWarning[] {
  const out: SpawnWarning[] = [];
  const lastShown = new Map<string, number>();
  for (const spawn of schedule) {
    for (const trait of bugTraits(spawn.kind)) {
      const key = `${spawn.lane}|${trait}`;
      const at = Math.max(0, spawn.time - WARN_LEAD);
      const prev = lastShown.get(key);
      if (prev !== undefined && spawn.time - prev < WARN_LEAD * 2) continue;
      lastShown.set(key, spawn.time);
      out.push({
        time: at,
        spawnTime: spawn.time,
        lane: spawn.lane,
        kind: spawn.kind,
        trait,
        text: `${TRAIT_INFO[trait].icon} ${BUG_INFO[spawn.kind].name}要来了:${TRAIT_INFO[trait].label}`,
      });
    }
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

/** 某一刻正亮着的预警。 */
export function activeWarnings(
  warnings: ReadonlyArray<SpawnWarning>,
  t: number,
): SpawnWarning[] {
  return warnings.filter((wn) => t >= wn.time && t < wn.spawnTime);
}

/** 每一只带机制的虫都提前亮过警告吗?(测试用:返回没预警到的那些) */
export function unwarnedSpawns(schedule: ReadonlyArray<BugSpawn>): BugSpawn[] {
  const warnings = buildWarnings(schedule);
  return schedule.filter((spawn) => {
    const traits = bugTraits(spawn.kind);
    if (traits.length === 0) return false;
    return !traits.every((trait) =>
      warnings.some(
        (wn) =>
          wn.lane === spawn.lane &&
          wn.trait === trait &&
          wn.time <= spawn.time - WARN_LEAD + 1e-9 &&
          wn.spawnTime <= spawn.time,
      ),
    );
  });
}

/* ================= 四、资源节奏 ================= */

/** 每秒被动攒多少露珠。 */
export function passiveDewPerSecond(sceneDewInterval: number): number {
  return 1 / sceneDewInterval;
}

/**
 * 开局多久才种得下第一株(秒)。
 * 解谜关手里就有苗,传送关等第一张卡,普通关看开局露珠够不够最便宜那一株。
 */
export function secondsToFirstPlant(levelIdx: number): number {
  const def = LEVELS[levelIdx];
  if (def.special?.kind === "puzzle") return 0;
  if (def.special?.kind === "conveyor") return def.special.beltEvery ?? BELT_EVERY;
  const unlocked = plantsUnlockedAt(levelIdx, LEVELS);
  const cheapest = Math.min(...unlocked.map((k) => PLANT_INFO[k].cost));
  if (def.startDew >= cheapest) return 0;
  return (cheapest - def.startDew) * passiveDewInterval(def.scene);
}

/** 规格:开局 20 秒内必须能种下第一株。 */
export const FIRST_PLANT_DEADLINE = 20;

/* ================= 五、无尽「守到天亮」 ================= */

/** 撑到第几波天就亮了(之后是加场,继续无限)。 */
export const ENDLESS_DAWN_WAVE = 20;

export interface EndlessWaveSpec {
  wave: number;
  entries: WaveEntry[];
  /** 这一波虫的额外血量 */
  hpBonus: number;
  /** 天色:0 = 深夜,1 = 日出 */
  dawn: number;
  boss: boolean;
}

/** 第 n 波能出场的虫:越往后种类越全,机制一样一样加进来。 */
export function endlessPool(n: number): BugKind[] {
  const pool: BugKind[] = ["walker"];
  if (n >= 2) pool.push("speedy");
  if (n >= 3) pool.push("flyer");
  if (n >= 4) pool.push("armor");
  if (n >= 5) pool.push("digger");
  if (n >= 7) pool.push("tunneler");
  if (n >= 9) pool.push("moth");
  if (n >= 11) pool.push("bucket");
  if (n >= 13) pool.push("mama");
  if (n >= 15) pool.push("racer");
  return pool;
}

export function endlessDawn(n: number): number {
  return Math.min(1, Math.max(0, (n - 1) / (ENDLESS_DAWN_WAVE - 1)));
}

/** 无尽第 n 波(1 起)。虫数逐波变多,血量三波一涨,每 6 波压一个大块头。 */
export function endlessWave(n: number): EndlessWaveSpec {
  const pool = endlessPool(n);
  const total = 4 + Math.floor(n * 1.3);
  const boss = n % 6 === 0;
  const entries: WaveEntry[] = [];
  // 从最新解锁的那几种往回发,保证新机制一露面就唱主角
  const used = Math.min(pool.length, 2 + Math.floor(n / 4));
  const kinds = pool.slice(-used);
  for (let i = 0; i < kinds.length; i++) {
    const count = Math.floor(total / kinds.length) + (i < total % kinds.length ? 1 : 0);
    if (count <= 0) continue;
    entries.push({ kind: kinds[i], count, gap: Math.max(0.7, 1.6 - n * 0.03) });
  }
  if (boss) entries.push({ kind: n >= 24 ? "queen" : "bossbug", count: 1, gap: 1 });
  return { wave: n, entries, hpBonus: Math.floor(n / 3), dawn: endlessDawn(n), boss };
}

/** 一波的总压力(血 + 甲),用来验证难度是递增的。 */
export function endlessThreat(n: number): number {
  const spec = endlessWave(n);
  let s = 0;
  for (const e of spec.entries) {
    s += e.count * (BUG_INFO[e.kind].hp + spec.hpBonus + BUG_INFO[e.kind].armor);
  }
  return s;
}

/** 无尽波次的总虫数。 */
export function endlessBugCount(n: number): number {
  return endlessWave(n).entries.reduce((s, e) => s + e.count, 0);
}

/** 天色文案:守到天亮是这一模式的主线。 */
export function endlessSkyLine(n: number): string {
  const d = endlessDawn(n);
  if (n > ENDLESS_DAWN_WAVE) return "天已经大亮啦,这些是加场!";
  if (d >= 1) return "东边亮起来了,天亮啦!";
  if (d >= 0.66) return "天边泛起鱼肚白……再顶一会儿";
  if (d >= 0.33) return "后半夜了,虫虫越来越多";
  return "夜还很长,先把经济铺起来";
}

/** 无尽出虫时间表:把前 n 波摊平成一条时间轴。 */
export function buildEndlessSchedule(waves: number): BugSpawn[] {
  const out: BugSpawn[] = [];
  let clock = 6;
  for (let n = 1; n <= waves; n++) {
    const spec = endlessWave(n);
    let i = 0;
    let waveEnd = clock;
    for (const entry of spec.entries) {
      for (let k = 0; k < entry.count; k++) {
        const t = clock + k * entry.gap;
        out.push({ time: t, lane: (i * 3 + n * 2) % LANES, kind: entry.kind, wave: n - 1 });
        waveEnd = Math.max(waveEnd, t);
        i++;
      }
      clock += 1.1;
    }
    clock = waveEnd + Math.max(4, 9 - n * 0.15);
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

/* ================= 六、手机版面 ================= */

/** 苗卡片最小宽度(规格:≥44px 热区)。 */
export const CARD_MIN_W = 48;
/** 卡片条高度。 */
export const CARD_H = 56;
/** 顶部资源/波次文字最小字号。 */
export const HUD_FONT_MIN = 14;
/** 每条通道最矮 40px。 */
export const LANE_MIN_H = 40;

export interface StripLayout {
  cardW: number;
  gap: number;
  contentW: number;
  maxScroll: number;
  scroll: number;
}

/**
 * 卡片条:一行横滑。卡片宽度固定不小于 CARD_MIN_W,放不下就靠横向滚动,
 * 绝不把 12 张卡压成 26px 的小豆子。
 */
export function cardStripLayout(viewW: number, count: number, scroll: number): StripLayout {
  const gap = 6;
  const pad = 6;
  const roomy = Math.floor((viewW - pad * 2 - gap * (count - 1)) / Math.max(1, count));
  const cardW = Math.max(CARD_MIN_W, Math.min(96, roomy));
  const contentW = pad * 2 + count * cardW + (count - 1) * gap;
  const maxScroll = Math.max(0, contentW - viewW);
  return { cardW, gap, contentW, maxScroll, scroll: Math.min(Math.max(0, scroll), maxScroll) };
}

export interface FieldMetrics {
  /** 一格的宽 */
  cw: number;
  /** 一条道的高 */
  ch: number;
  ox: number;
  oy: number;
  /** 通道总高超过可视区,需要纵向滚动 */
  scrollable: boolean;
  viewH: number;
}

/**
 * 战场版面:格子的宽和高分开算。
 * 1.1 里 `cell` 宽高共用,360px 竖屏上一条道只有 37.5px;
 * 1.2 把高度保底在 LANE_MIN_H,撑不下就让通道区纵向滚动(判定跟着偏移走,不受影响)。
 */
export function fieldMetrics(
  viewW: number,
  viewH: number,
  topH: number,
  homeCells = 1.2,
): FieldMetrics {
  const cw = viewW / (PLANT_COLS + homeCells + 0.4);
  const avail = Math.max(LANE_MIN_H, viewH - topH);
  const ch = Math.max(LANE_MIN_H, Math.min(cw * 1.25, avail / LANES));
  const totalH = ch * LANES;
  const ox = (viewW - cw * (PLANT_COLS + homeCells)) / 2 + cw * homeCells;
  const oy = topH + Math.max(0, (avail - totalH) / 2);
  return { cw, ch, ox, oy, scrollable: totalH > avail + 0.5, viewH: Math.min(totalH, avail) };
}

/* ================= 七、铲子误触保护 ================= */

/** 点第一下只是「举起铲子」,这么多秒内点第二下才真铲。 */
export const SHOVEL_CONFIRM_WINDOW = 2.5;

export interface ShovelPending {
  key: string;
  at: number;
}

export type ShovelAction = "arm" | "dig";

/** 铲子两段式:同一格在窗口内点第二下才铲掉,别的格子只重新举铲。 */
export function shovelStep(
  pending: ShovelPending | null,
  key: string,
  now: number,
): { action: ShovelAction; pending: ShovelPending | null } {
  if (pending && pending.key === key && now - pending.at <= SHOVEL_CONFIRM_WINDOW) {
    return { action: "dig", pending: null };
  }
  return { action: "arm", pending: { key, at: now } };
}

/* ================= 八、攻略对照表 ================= */

/** 一行「苗名 · 类 · 造价 · 冷却 · 差别」,攻略与图鉴共用。 */
export function plantTableLine(kind: PlantKind): string {
  const spec = PLANT_SPEC[kind];
  const price = spec.sun > 0 ? `💧${spec.dew}+☀️${spec.sun}` : `💧${spec.dew}`;
  return `${PLANT_INFO[kind].name}(${ROLE_LABEL[spec.role]}·${price}·冷却${spec.cooldown}s):${spec.note}`;
}

export function plantTable(): string[] {
  return PLANT_ORDER.map(plantTableLine);
}

/* ================= 九、给测试与调参用的小工具 ================= */

/** 一关的总压力(血 + 甲),给资源曲线体检用。 */
export function levelThreat(levelIdx: number): number {
  let s = 0;
  for (const wave of LEVELS[levelIdx].waves) {
    for (const e of wave) s += e.count * (bugHp(e.kind, levelIdx) + BUG_INFO[e.kind].armor);
  }
  return s;
}

/** 这一关会不会出某一类机制的虫。 */
export function levelHasTrait(levelIdx: number, trait: BugTrait): boolean {
  return LEVELS[levelIdx].waves.some((wave) =>
    wave.some((e) => bugTraits(e.kind).includes(trait)),
  );
}

/** 特殊关清单(测试与关卡地图图标都用它)。 */
export function specialLevels(kind: "puzzle" | "conveyor" | "blitz"): number[] {
  const out: number[] = [];
  for (let i = 0; i < LEVELS.length; i++) {
    if (LEVELS[i].special?.kind === kind) out.push(i);
  }
  return out;
}

/** 出虫时间表里第一只虫的时刻(布置时间够不够看它)。 */
export function firstSpawnTime(levelIdx: number): number {
  const sched = buildLevelSchedule(levelIdx);
  return sched.length > 0 ? sched[0].time : Infinity;
}

/** 场景亮不亮(暖暖花在暗场景开得慢)。 */
export function sceneIsDark(levelIdx: number): boolean {
  return SCENE_STYLE[LEVELS[levelIdx].scene].dark;
}

/** 子弹种类 → 射速,运行时与模拟器都走这条。 */
export function projCooldown(proj: ProjKind): number {
  return SHOOT_CD_BY_KIND[proj];
}
