/**
 * 花园守卫 · 1.2 防守深度层（纯函数，不碰 DOM，不引入任何依赖）。
 *
 * 1.1 已经有 7 种塔、24 种怪（含 13 只 BOSS）、188 关波次表和逐帧模拟器（`sim.ts`），
 * 1.2 补的是**「让孩子看懂并且能提前准备」**这一层，以及一个能一直打下去的无尽：
 *  1. **克制关系表**：哪种塔专治哪种怪写成数据，攻略直接读它，不再靠玩家自己猜；
 *  2. **无支配塔**：把「某一种塔在所有关都最优」变成可执行的断言——
 *     每种塔都要有它打不动的怪，也要有只有它打得动的怪；
 *  3. **波次预览**：下一波由哪些怪组成提前算好（图标 + 数量），并支持提前召唤换奖励；
 *  4. **速度控制**：1× / 2× 用同一套固定步长，**2× 只是多跑几个子步**，结果与 1× 一致；
 *  5. **无尽「守到底」**：波次无限递增、固定 seed 可复现，撑到第几波记成绩。
 *
 * 本款是**格子布塔的经典塔防**；同一步的 `sprout-defense` 是阵列植物、
 * `monster-crisis` 是角色主动战斗，三者互不共用文件，规格也不互抄。
 *
 * ---- 两版 13-A 的合流说明 ----
 * 同一步有两份独立实现落到了这条分支上,职责这样分:
 *  - 运行时(`index.ts`)接的是另一份:`towers12.ts`(克制表 + 支援塔)、
 *    `wave12.ts`(预览 / 提前召唤 / 定步长)、`endless.ts`(守到底)、
 *    `hud12.ts`(360px 布局)、`fx12.ts`(弹开 + 星星 / 花瓣飞走)。
 *    它多做了支援塔、四类原型 BOSS,并且「无支配塔」是拿 `sim.ts` 逐帧跑出来的,
 *    比这里的查表判据强,所以按那一份接线。
 *  - 本文件保留为**纯分析层**:威胁标签、查表版无支配塔判据、seed 版无尽拼关
 *    都还在跑自己的用例,是另一条独立的守门线——两套判据同时说「没有支配塔」,
 *    比只有一套可信。用例只增不减,所以不删。
 * 这里的 `ENDLESS_PATHS` 每 4 波换场景没有接进运行时:守到底是**一局不重开**,
 * 中途换路会让已经种下的塔正好站在新路上,只能连塔一起清掉,那就不叫「守到底」了。
 */
import {
  MONSTER_INFO,
  THEME_ORDER,
  THEME_STYLE,
  TOWER_INFO,
  TOWER_KINDS,
  towerCanHitAir,
  type LevelDef,
  type MonsterKind,
  type TowerKind,
  type WaveEntry,
} from "./logic";

/* ---------------- 一、克制关系表 ---------------- */

/** 一种怪身上「难对付」的那个点 */
export type ThreatTag = "armor" | "swift" | "air" | "split" | "sneak" | "heal" | "swarm";

export const THREAT_LABEL: Record<ThreatTag, string> = {
  armor: "硬壳",
  swift: "跑得快",
  air: "会飞",
  split: "会分身",
  sneak: "会隐身",
  heal: "会回元气",
  swarm: "数量多",
};

/** 这只怪有哪些难对付的点（直接从 1.1 的怪物表推，不另存一份会跑偏的副本） */
export function threatsOf(kind: MonsterKind): ThreatTag[] {
  const m = MONSTER_INFO[kind];
  const out: ThreatTag[] = [];
  if (m.armor >= 4) out.push("armor");
  if (m.speed >= 1 || m.dashes) out.push("swift");
  if (m.flies) out.push("air");
  if (m.splits || m.summons) out.push("split");
  if (m.sneaks) out.push("sneak");
  if (m.heals) out.push("heal");
  if (!m.boss && m.hp <= 3) out.push("swarm");
  return out;
}

/** 一种塔专治哪几个点 */
export const TOWER_COUNTERS: Record<TowerKind, ThreatTag[]> = {
  bubble: ["swarm", "air"],
  needle: ["swarm", "swift", "air"],
  dew: ["swift"],
  sunny: [],
  boom: ["split", "swarm"],
  frost: ["swift", "air"],
  mist: ["armor", "sneak", "heal"],
  // 铃兰铃是支援位:自己一发不打,克制点当然是空的——
  // 它的价值写在 towers12.ts 的 COUNTER_TABLE 里(给邻居加攻速加射程),
  // 和阳光花一样不参与「谁克谁」这张表。
  chime: [],
};

/** 这一塔对这一怪算不算「对症」（返回命中的克制点，空数组表示不对症） */
export function countersFor(tower: TowerKind, monster: MonsterKind): ThreatTag[] {
  const threats = threatsOf(monster);
  return TOWER_COUNTERS[tower].filter((t) => threats.includes(t));
}

/** 这一塔打不打得动这一怪：飞怪只有对空塔能打，硬壳怪只有毒雾能无视 */
export function canHandle(tower: TowerKind, monster: MonsterKind): boolean {
  const spec = TOWER_INFO[tower];
  const m = MONSTER_INFO[monster];
  if (spec.dmg <= 0 && !spec.poison) return false;
  if (m.flies && !towerCanHitAir(tower)) return false;
  if (m.armor >= spec.dmg && !spec.poison) return false;
  return true;
}

/**
 * 有没有「在所有场合都最优」的支配塔。
 *
 * 判据有两条，**都要满足才算没有支配塔**：
 *  1. 每一种能打的塔，都至少有一种怪它打不动（不存在通吃的塔）；
 *  2. 每一种能打的塔，都至少有一种怪只有它这一档打得对症（每种塔都有存在的理由）。
 */
export function dominantTower(): TowerKind | null {
  const kinds = Object.keys(MONSTER_INFO) as MonsterKind[];
  for (const tower of TOWER_KINDS) {
    if (TOWER_INFO[tower].dmg <= 0 && !TOWER_INFO[tower].poison) continue;
    const handlesAll = kinds.every((m) => canHandle(tower, m));
    if (handlesAll) return tower;
  }
  return null;
}

/** 每一种攻击塔都有它独一份的用处（有一类怪只有它对症） */
export function towersWithUniqueNiche(): TowerKind[] {
  const kinds = Object.keys(MONSTER_INFO) as MonsterKind[];
  const out: TowerKind[] = [];
  for (const tower of TOWER_KINDS) {
    const unique = kinds.some((m) => {
      if (countersFor(tower, m).length === 0) return false;
      return TOWER_KINDS.every((other) => other === tower || countersFor(other, m).length === 0);
    });
    if (unique) out.push(tower);
  }
  return out;
}

/* ---------------- 二、波次预览与提前召唤 ---------------- */

export interface PreviewItem {
  kind: MonsterKind;
  name: string;
  count: number;
  threats: ThreatTag[];
  boss: boolean;
}

/** 下一波由什么组成：同种怪合并计数，BOSS 排在最前面让孩子一眼看见 */
export function wavePreview(wave: ReadonlyArray<WaveEntry>): PreviewItem[] {
  const merged = new Map<MonsterKind, number>();
  for (const e of wave) merged.set(e.kind, (merged.get(e.kind) ?? 0) + e.count);
  const items: PreviewItem[] = [];
  for (const [kind, count] of merged) {
    items.push({
      kind,
      name: MONSTER_INFO[kind].name,
      count,
      threats: threatsOf(kind),
      boss: MONSTER_INFO[kind].boss,
    });
  }
  items.sort((a, b) => Number(b.boss) - Number(a.boss) || b.count - a.count);
  return items;
}

/** 预览里该提醒「这一波要准备什么」 */
export function previewAdvice(items: readonly PreviewItem[]): string {
  const tags = new Set<ThreatTag>();
  for (const it of items) for (const t of it.threats) tags.add(t);
  if (tags.has("air")) return "这一波有会飞的，得有打得到天上的塔";
  if (tags.has("armor")) return "这一波硬壳厚，毒雾塔能绕过硬壳";
  if (tags.has("heal")) return "这一波有会回元气的，先把它清掉再打别的";
  if (tags.has("split")) return "这一波会分身，花火塔的溅射最划算";
  if (tags.has("sneak")) return "这一波会隐身，毒雾罩着比点名打稳";
  if (tags.has("swift")) return "这一波跑得快，露珠或者冰晶先拖住";
  return "普通的一波，稳稳站桩就好";
}

/** 提前召唤下一波：每提前 1 秒奖励 1 片花瓣，最多 12 片 */
export const EARLY_CALL_PER_SEC = 1;
export const EARLY_CALL_MAX = 12;

export function earlyCallBonus(secondsEarly: number): number {
  if (!(secondsEarly > 0)) return 0;
  return Math.min(EARLY_CALL_MAX, Math.floor(secondsEarly * EARLY_CALL_PER_SEC));
}

/* ---------------- 三、速度控制 ---------------- */

/** 可选的播放倍速 */
export const SPEED_STEPS: readonly number[] = [1, 2];
/** 逻辑固定步长：不管几倍速，物理都按这个步长走 */
export const FIXED_STEP = 1 / 60;
/** 一帧最多补几个子步，免得切回前台时一次性追一大把 */
export const MAX_SUBSTEPS = 8;

export interface StepPlan {
  /** 这一帧要跑几个固定子步 */
  steps: number;
  /** 没跑完的余量，留到下一帧 */
  rest: number;
}

/**
 * 把「这一帧过了多少真实时间 × 倍速」摊成整数个固定子步。
 * 2× 只是**同样的子步跑两倍数量**，所以 2× 的结果和 1× 跑两倍时间完全一致。
 */
export function planSteps(carry: number, frameDt: number, speed: number): StepPlan {
  const want = carry + Math.max(0, frameDt) * Math.max(0, speed);
  const steps = Math.min(MAX_SUBSTEPS, Math.floor(want / FIXED_STEP));
  return { steps, rest: want - steps * FIXED_STEP };
}

/** 点一下倍速按钮换到下一档 */
export function nextSpeed(speed: number): number {
  const i = SPEED_STEPS.indexOf(speed);
  return SPEED_STEPS[(i < 0 ? 0 : i + 1) % SPEED_STEPS.length];
}

export function speedLabel(speed: number): string {
  return speed >= 2 ? "⏩ 2 倍速" : "▶️ 正常速";
}

/* ---------------- 四、无尽「守到底」 ---------------- */

export function makeGuardRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

/** 第几波开始出现某一类怪：一类一类地教，不一上来就全上 */
export const ENDLESS_UNLOCK: ReadonlyArray<{ from: number; kind: MonsterKind }> = [
  { from: 1, kind: "softy" },
  { from: 2, kind: "fasty" },
  { from: 3, kind: "tanky" },
  { from: 5, kind: "dashy" },
  { from: 7, kind: "flappy" },
  { from: 9, kind: "shieldy" },
  { from: 11, kind: "splity" },
  { from: 13, kind: "sneaky" },
  { from: 15, kind: "healy" },
  { from: 18, kind: "glidey" },
];

/** 每 10 波来一只 BOSS，按波数轮换 */
export const ENDLESS_BOSS_EVERY = 10;
const ENDLESS_BOSSES: readonly MonsterKind[] = ["boss1", "boss3", "boss6", "boss9", "boss12"];

export function endlessBossAt(wave: number): MonsterKind | null {
  const n = Math.round(wave);
  if (n <= 0 || n % ENDLESS_BOSS_EVERY !== 0) return null;
  return ENDLESS_BOSSES[(n / ENDLESS_BOSS_EVERY - 1) % ENDLESS_BOSSES.length];
}

export function endlessPool(wave: number): MonsterKind[] {
  const n = Math.max(1, Math.round(wave));
  return ENDLESS_UNLOCK.filter((u) => n >= u.from).map((u) => u.kind);
}

/** 第 n 波总共来几只（缓慢上涨，不做指数爆炸） */
export function endlessCount(wave: number): number {
  const n = Math.max(1, Math.round(wave));
  return Math.min(30, 4 + Math.floor((n - 1) * 0.8));
}

/** 第 n 波的编成（固定 seed 可复现） */
export function endlessWave(wave: number, seed = 733): WaveEntry[] {
  const n = Math.max(1, Math.round(wave));
  const boss = endlessBossAt(n);
  const out: WaveEntry[] = [];
  if (boss) out.push({ kind: boss, count: 1, gap: 1 });
  const pool = endlessPool(n);
  const rng = makeGuardRng((seed >>> 0) + n * 2654435761);
  let left = endlessCount(n);
  while (left > 0) {
    const kind = pool[Math.floor(rng() * pool.length)];
    const take = Math.min(left, 1 + Math.floor(rng() * 4));
    out.push({ kind, count: take, gap: +(0.85 - Math.min(0.5, n * 0.01)).toFixed(2) });
    left -= take;
  }
  return out;
}

/** 撑到第 n 波之前，玩家一共能拿到多少启动花瓣（越往后每波给得越多） */
export function endlessPetalGrant(wave: number): number {
  const n = Math.max(1, Math.round(wave));
  return 4 + Math.floor(n / 3);
}

export function bestWave(prev: number, next: number): number {
  return Math.max(prev, next);
}

/**
 * 无尽用的三条路线。
 *
 * 故意只用三条**都很长、都有拐弯**的路：无尽是「守到底」，
 * 塔一旦种下就要用很多波，路太短会变成「第一波种哪儿定生死」。
 * 三条轮换是为了让孩子每隔几波重新想一次布阵，而不是背一套摆法用到底。
 */
export const ENDLESS_PATHS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[0, 2], [6, 2], [6, 4], [1, 4], [1, 5], [8, 5]],
  [[0, 0], [7, 0], [7, 3], [2, 3], [2, 5], [8, 5]],
  [[0, 5], [7, 5], [7, 2], [3, 2], [3, 0], [8, 0]],
];

/** 每几波换一次路线与主题皮肤 */
export const ENDLESS_SCENE_EVERY = 4;

export function endlessPathIndex(wave: number): number {
  const n = Math.max(1, Math.round(wave));
  return Math.floor((n - 1) / ENDLESS_SCENE_EVERY) % ENDLESS_PATHS.length;
}

/**
 * 把第 n 波拼成一份「只有一波的关卡」，直接喂给战役那套画面与操作。
 *
 * 这样无尽不需要另写一套渲染，塔、路径、天气全走既有代码；
 * 无尽与战役的差别只有两点：波次是算出来的，而且打完不结算、直接接下一波。
 */
export function buildEndlessLevel(wave: number, seed = 733): LevelDef {
  const n = Math.max(1, Math.round(wave));
  const theme = THEME_ORDER[Math.floor((n - 1) / ENDLESS_SCENE_EVERY) % THEME_ORDER.length];
  return {
    name: `守到底 · 第 ${n} 波`,
    theme,
    paths: [ENDLESS_PATHS[endlessPathIndex(n)]],
    waves: [endlessWave(n, seed)],
    startPetals: endlessPetalGrant(n),
    feature: `无尽第${n}波`,
    gen: true,
    hint: `${THEME_STYLE[theme].name}的第 ${n} 波,守住就还有下一波`,
  };
}

/** 无尽结算话术：只鼓励，不说输 */
export function endlessLine(wave: number, best: number): string {
  const n = Math.max(0, Math.round(wave));
  if (n <= 1) return "第一波就被踩了几脚，先把露珠塔放在拐弯处，那儿最好拦。";
  if (n >= best) return `一口气守到第 ${n} 波，这是你目前最好的一次！`;
  return `守到第 ${n} 波，离最好成绩第 ${best} 波只差一点点，再来一局准能过。`;
}
