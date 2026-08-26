/**
 * 朵朵大战星星 · 1.2 平衡层（纯函数，不碰 DOM）。
 *
 * 1.1 把这一款做厚了（角色 / 击退 / 道具 / 场地 / 战役全都在），
 * 所以 1.2 的任务是**平衡与打磨，不是再加系统**——新系统只会把已经好用的部分拖垮。
 *
 * 本文件交付五件事：
 *  1. 一个只用既有数值跑的**循环赛模型**，把「角色 vs 角色」的胜率矩阵算出来，
 *     并把「任何角色总胜率必须落在 40%–60%」变成可执行的断言；
 *  2. **击退曲线分档表** —— 把 `knockback.ts` 的公式画成「击退值 → 弹飞距离」的档位，
 *     并给低元气时一个 0.4 秒的**挣扎窗口**，避免「一击必出界」；
 *  3. **道具刷新镜像对称**（左右成对出现），强道具改成**需要蓄力才生效**；
 *  4. **合作关的配合点** —— 一个人操作到底过不去，必须两个人各做一件事；
 *  5. **战役后段的行为化难度** —— 后段关卡不靠堆数值，改成会绕后 / 会抢道具 / 会等你出招。
 */
import { ITEMS, itemById } from "./items";
import {
  BUMP_MAX,
  MAX_LAUNCH,
  WEIGHT_REF,
  clampBump,
  launchSpeed,
} from "./knockback";
import { ROSTER, type Fighter } from "./roster";

/* ---------------- 一、循环赛与胜率矩阵 ---------------- */

/** 循环赛用的确定性随机数（和玩法里的种子互不干扰）。 */
export function makeBalanceRng(seed: number): () => number {
  let a = (seed || 1) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 每对角色打多少局才算数（规格要求 ≥ 20）。 */
export const ROUND_ROBIN_GAMES = 20;
/** 一局最多推演多少回合，极端参数下也能保证收敛 */
export const DUEL_MAX_TURNS = 400;
/** 击退值涨到这个比例就算被弹出界 */
export const OUT_BUMP_RATIO = 0.9;

/**
 * 一局对决的抽象推演。刻意只用 `roster.ts` 已有的四个数值，
 * 这样「改了角色数值 → 胜率跟着变」是真的，不是我另写一套假模型。
 *
 * 每个回合：
 *  - 谁的 `speed` 高，谁更容易抢到这一下（出手权按速度加权掷骰）；
 *  - 抢到手也不一定打得中：**对方跑得越快越容易闪开**（`EVADE_WEIGHT`），
 *    这一条是轻角色的活路，没有它「又沉又有力」就成了支配解；
 *  - 命中给对方涨击退值，涨多少取决于自己的 `power` 与对方的 `weight`；
 *  - `jump` 与 `airJumps` 折算成「被弹飞之后能救回来」的概率，救回来就把击退值压回去一点。
 *
 * 轻快角色打得多、躲得多、飘得回来，但一挨拍就吃亏；
 * 沉重角色一下顶两下、站得稳，可是抢不到手也躲不掉——这就是平衡的来源。
 */
/** 闪避权重：对方速度在命中判定里占多大分量 */
export const EVADE_WEIGHT = 1;

export function duel(a: Fighter, b: Fighter, seed: number): 0 | 1 {
  const rng = makeBalanceRng(seed);
  let bumpA = 0;
  let bumpB = 0;
  const recovery = (f: Fighter): number => Math.min(0.5, (f.jump - 0.8) * 0.5 + f.airJumps * 0.09);
  for (let turn = 0; turn < DUEL_MAX_TURNS; turn++) {
    const share = a.speed / (a.speed + b.speed);
    const attackerIsA = rng() < share;
    const atk = attackerIsA ? a : b;
    const def = attackerIsA ? b : a;
    // 抢到出手权也可能被躲开：对方跑得越快越难打中
    const hitChance = atk.speed / (atk.speed + def.speed * EVADE_WEIGHT);
    if (rng() >= hitChance) continue;
    // 命中量：力度越大涨得越多，体重越沉涨得越少
    const gain = atk.power * (WEIGHT_REF / def.weight) * (6 + rng() * 6);
    if (attackerIsA) bumpB = clampBump(bumpB + gain);
    else bumpA = clampBump(bumpA + gain);
    const defBump = attackerIsA ? bumpB : bumpA;
    if (defBump >= BUMP_MAX * OUT_BUMP_RATIO) {
      // 会跳的角色有机会自己飘回来，把击退值压回去一截
      if (rng() < recovery(def)) {
        const back = BUMP_MAX * 0.28;
        if (attackerIsA) bumpB = Math.max(0, bumpB - back);
        else bumpA = Math.max(0, bumpA - back);
        continue;
      }
      return attackerIsA ? 0 : 1;
    }
  }
  // 打满还没分出来就比谁的击退值低
  return bumpA <= bumpB ? 0 : 1;
}

export interface BalanceRow {
  id: string;
  name: string;
  /** 对每个对手的胜局数（key 是对手 id） */
  wins: Record<string, number>;
  /** 总胜率 0..1 */
  rate: number;
}

/**
 * 跑一遍全体循环赛（每对 `games` 局，先后手各一半，消掉先手偏差）。
 * 返回每个角色的胜率行；`rate` 是总胜率。
 */
export function roundRobin(seed: number = 20240612, games: number = ROUND_ROBIN_GAMES): BalanceRow[] {
  const rows = new Map<string, BalanceRow>();
  for (const f of ROSTER) rows.set(f.id, { id: f.id, name: f.name, wins: {}, rate: 0 });
  const played = new Map<string, number>();
  for (const f of ROSTER) played.set(f.id, 0);
  for (let i = 0; i < ROSTER.length; i++) {
    for (let j = i + 1; j < ROSTER.length; j++) {
      const a = ROSTER[i];
      const b = ROSTER[j];
      let winA = 0;
      for (let g = 0; g < games; g++) {
        const s = seed + i * 7919 + j * 104729 + g * 31;
        // 一半局面对调先后手，避免「谁写在前面谁占便宜」
        const swapped = g % 2 === 1;
        const r = swapped ? duel(b, a, s) : duel(a, b, s);
        const aWon = swapped ? r === 1 : r === 0;
        if (aWon) winA++;
      }
      rows.get(a.id)!.wins[b.id] = winA;
      rows.get(b.id)!.wins[a.id] = games - winA;
      played.set(a.id, played.get(a.id)! + games);
      played.set(b.id, played.get(b.id)! + games);
    }
  }
  const out: BalanceRow[] = [];
  for (const f of ROSTER) {
    const row = rows.get(f.id)!;
    const total = Object.values(row.wins).reduce((s, n) => s + n, 0);
    row.rate = played.get(f.id)! > 0 ? total / played.get(f.id)! : 0;
    out.push(row);
  }
  return out;
}

/** 平衡红线：任何角色的总胜率都要落在这个区间里。 */
export const BALANCE_MIN = 0.4;
export const BALANCE_MAX = 0.6;

/** 哪些角色超出了 40%–60%（空数组表示平衡）。 */
export function balanceOutliers(rows: BalanceRow[]): BalanceRow[] {
  return rows.filter((r) => r.rate < BALANCE_MIN || r.rate > BALANCE_MAX);
}

/* ---------------- 二、击退曲线与挣扎窗口 ---------------- */

export interface KnockbackTier {
  /** 这一档的击退值下限 */
  from: number;
  /** 这一档的击退值上限 */
  to: number;
  label: string;
  /** 这一档标准力度下的弹飞初速 */
  launch: number;
}

/**
 * 分档表用的标准力度（一记普通轻击）。
 * 刻意取小值：这样最后一档在最轻的角色身上也**还没顶到 `MAX_LAUNCH`**，
 * 分档表才能真实反映曲线形状，而不是一片被削平的天花板。
 */
export const TIER_SAMPLE_POWER = 4;

/**
 * 「击退值 → 弹飞距离」分档表：给攻略与 HUD 用，也让「封顶」这件事可测。
 * 五档均分 0..BUMP_MAX，最后一档的初速就是封顶值。
 */
export function knockbackTable(weight: number = WEIGHT_REF): KnockbackTier[] {
  const labels = ["稳当", "有点晕", "站不住", "要飞了", "一碰就飞"];
  const step = BUMP_MAX / labels.length;
  return labels.map((label, i) => {
    const to = Math.round(step * (i + 1));
    return {
      from: Math.round(step * i),
      to,
      label,
      launch: launchSpeed(to, TIER_SAMPLE_POWER, weight),
    };
  });
}

/** 挣扎窗口：元气很低时给这么久的「自己动一下还能救回来」的时间。 */
export const STRUGGLE_WINDOW_SECONDS = 0.4;
/** 击退值超过这个比例才给挣扎窗口（不然每次挨拍都要抖一下，太吵） */
export const STRUGGLE_BUMP_RATIO = 0.72;

/** 这一下之后该不该给挣扎窗口。 */
export function struggleWindow(bump: number): number {
  return clampBump(bump) >= BUMP_MAX * STRUGGLE_BUMP_RATIO ? STRUGGLE_WINDOW_SECONDS : 0;
}

/**
 * 挣扎能把弹飞初速压掉多少：按住方向键连点，最多压掉 30%。
 * `taps` 是挣扎窗口里点了几下，`0` 表示没挣扎。
 */
export const STRUGGLE_MAX_REDUCTION = 0.3;
export const STRUGGLE_TAPS_FOR_MAX = 6;

export function struggleReduce(launch: number, taps: number): number {
  const n = Math.max(0, Math.min(STRUGGLE_TAPS_FOR_MAX, Math.floor(taps)));
  const cut = (n / STRUGGLE_TAPS_FOR_MAX) * STRUGGLE_MAX_REDUCTION;
  return Math.max(0, launch * (1 - cut));
}

/**
 * 「一击必出界」检查：满击退值 + 最沉的一记重击，配上最轻的角色，
 * 弹飞初速仍然不许超过封顶值。封顶在 `knockback.ts` 里，这里只把它变成断言入口。
 */
export function worstCaseLaunch(): number {
  const lightest = ROSTER.reduce((m, f) => (f.weight < m.weight ? f : m), ROSTER[0]);
  const strongest = ROSTER.reduce((m, f) => (f.power > m.power ? f : m), ROSTER[0]);
  return launchSpeed(BUMP_MAX, TIER_SAMPLE_POWER * strongest.power * 2, lightest.weight);
}

/* ---------------- 三、道具刷新对称与蓄力 ---------------- */

export interface SpawnPoint {
  x: number;
  y: number;
}

/**
 * 刷新点镜像对称：把一组「左半场」的点镜像成左右成对的完整表。
 * 场地宽度默认 960（`stages.ts` 的 `WORLD_W`），镜像轴就是场地中线。
 */
export function mirrorSpawns(left: readonly SpawnPoint[], worldWidth: number = 960): SpawnPoint[] {
  const out: SpawnPoint[] = [];
  for (const p of left) {
    out.push({ x: p.x, y: p.y });
    out.push({ x: worldWidth - p.x, y: p.y });
  }
  return out;
}

/** 一组刷新点是不是左右镜像对称（允许 1 单位的浮点误差）。 */
export function spawnsAreMirrored(points: readonly SpawnPoint[], worldWidth: number = 960): boolean {
  if (points.length % 2 !== 0) return false;
  const remaining = points.slice();
  while (remaining.length > 0) {
    const p = remaining.pop()!;
    const idx = remaining.findIndex(
      (q) => Math.abs(q.x - (worldWidth - p.x)) <= 1 && Math.abs(q.y - p.y) <= 1,
    );
    if (idx < 0) return false;
    remaining.splice(idx, 1);
  }
  return true;
}

/**
 * 强道具：拿到手不会立刻生效，要按住蓄力这么久才启动。
 * 这样对手看得见「他在蓄力」，来得及躲或者打断，不会被一个道具直接终结对局。
 */
export const CHARGE_SECONDS: Record<string, number> = {
  hammer: 0.8,
  magnet: 0.6,
  springshoe: 0.5,
};

/** 这件道具要蓄力多久（普通道具是 0，立刻生效）。 */
export function chargeSeconds(itemId: string): number {
  return CHARGE_SECONDS[itemId] ?? 0;
}

/** 这件道具算不算「强道具」（需要蓄力的都算）。 */
export function isStrongItem(itemId: string): boolean {
  return chargeSeconds(itemId) > 0;
}

/** 强道具全都要能在道具表里找到，不能配错 id。 */
export function strongItemsExist(): boolean {
  return Object.keys(CHARGE_SECONDS).every((id) => itemById(id) !== null);
}

/** 蓄力被打断（挨了一下）就退回未生效，道具不消耗。 */
export interface ChargeState {
  itemId: string;
  remain: number;
  ready: boolean;
}

export function startCharge(itemId: string): ChargeState {
  const sec = chargeSeconds(itemId);
  return { itemId, remain: sec, ready: sec <= 0 };
}

export function tickCharge(state: ChargeState, dt: number): ChargeState {
  if (state.ready) return { ...state };
  const remain = Math.max(0, state.remain - Math.max(0, dt));
  return { ...state, remain, ready: remain <= 0 };
}

export function interruptCharge(state: ChargeState): ChargeState {
  if (state.ready) return { ...state };
  return { itemId: state.itemId, remain: chargeSeconds(state.itemId), ready: false };
}

/* ---------------- 四、合作关的配合点 ---------------- */

/** 一关合作关需要两个人各做一件什么事。 */
export type CoopRole = "lift" | "catch" | "hold" | "carry";

export interface CoopStage {
  id: string;
  title: string;
  /** 教哪一种配合 */
  roles: [CoopRole, CoopRole];
  hint: string;
}

/**
 * 三关专门教配合：顶举、接应、按住机关。
 * 每关都要**两个角色各占一个角色位**，一个人分身乏术，所以单人一定过不去。
 */
export const COOP_STAGES: readonly CoopStage[] = [
  {
    id: "coop-lift",
    title: "顶一顶，够得到",
    roles: ["lift", "carry"],
    hint: "一位蹲下当垫脚，另一位踩上去够高处的星星。",
  },
  {
    id: "coop-catch",
    title: "抛过去，接得住",
    roles: ["lift", "catch"],
    hint: "一位把糖果轻轻抛过缺口，另一位在对面接住。",
  },
  {
    id: "coop-hold",
    title: "按住门，走得过",
    roles: ["hold", "carry"],
    hint: "一位站在按钮上把门撑开，另一位赶紧通过。",
  },
];

/**
 * 这一关能不能过：需要的两个角色位必须由**两个不同的玩家**同时占住。
 * 一个人不管怎么操作都只能占一个位置 → 单人必定返回 false，这就是「真配合」。
 */
export function coopStageSolved(
  stage: CoopStage,
  assignments: ReadonlyArray<{ player: number; role: CoopRole }>,
): boolean {
  const [r1, r2] = stage.roles;
  const p1 = assignments.find((a) => a.role === r1);
  const p2 = assignments.find((a) => a.role === r2);
  if (!p1 || !p2) return false;
  return p1.player !== p2.player;
}

/* ---------------- 五、战役后段：行为化难度 ---------------- */

/** 后段对手的额外行为（不是加数值）。 */
export interface FoeBehavior {
  /** 会绕到你背后再出手 */
  flank: boolean;
  /** 会去抢道具而不是只顾着打 */
  itemGreed: boolean;
  /** 会等你出招收招的空档再进来 */
  punish: boolean;
  /** 边缘会守着不让你回场（但一定留出可以回来的缝） */
  edgeGuard: boolean;
  hint: string;
}

/** 边缘守门必须留出的缝（世界单位）——留了这条，后段就不会变成「回不了场」。 */
export const EDGE_GUARD_GAP = 90;

/**
 * 第 N 关的对手行为。**数值一律不动**，靠开关行为做难度：
 * 1–47 关只会正面打；48–94 会绕后；95–141 再加抢道具；142–188 再加等你出招与边缘守门。
 */
export function foeBehavior(level: number): FoeBehavior {
  const n = Number.isFinite(level) ? Math.max(1, Math.min(188, Math.floor(level))) : 1;
  const flank = n >= 48;
  const itemGreed = n >= 95;
  const punish = n >= 142;
  const edgeGuard = n >= 142;
  const parts: string[] = [];
  if (flank) parts.push("会绕到你背后");
  if (itemGreed) parts.push("会先去抢道具");
  if (punish) parts.push("会等你收招那一下");
  if (edgeGuard) parts.push("会守着边缘，但一定留一条回场的缝");
  return {
    flank,
    itemGreed,
    punish,
    edgeGuard,
    hint: parts.length > 0 ? parts.join("，") : "正面打，不耍花招",
  };
}

/** 后段行为只增不减：关数越大，开着的行为越多。 */
export function behaviorCount(level: number): number {
  const b = foeBehavior(level);
  return [b.flank, b.itemGreed, b.punish, b.edgeGuard].filter(Boolean).length;
}

/* ---------------- 六、无尽成绩与旧 key 迁移 ---------------- */

/** 1.0 时代可能留下的旧纪录 key（读一次就够，不清零）。 */
export const LEGACY_ENDLESS_KEYS = [
  "yiduo-yixing.duo-vs-star.endless.best",
  "yiduo.duo-vs-star.endless",
];

/** 从旧 key 里读出一个可用的纪录，读不出就返回 0。 */
export function readLegacyBest(read: (key: string) => string | null): number {
  let best = 0;
  for (const key of LEGACY_ENDLESS_KEYS) {
    const raw = read(key);
    if (typeof raw !== "string") continue;
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > best) best = n;
  }
  return best;
}

/** 道具表里每一件都得有名字、说明与合法的出现权重（配置巡检）。 */
export function itemTableIsSane(): boolean {
  return ITEMS.every(
    (it) => it.id.length > 0 && it.name.length > 0 && it.tip.length > 0 && it.weight > 0,
  );
}

/** 弹飞初速的绝对上限（给测试与 HUD 引用，避免两处各写一个数）。 */
export const LAUNCH_CEILING = MAX_LAUNCH;
