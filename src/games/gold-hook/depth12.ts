/**
 * 金矿钩钩 · 1.2 纵深层（纯函数，不碰 DOM，不引入任何依赖）。
 *
 * 1.1 已经有摆钩 / 回收公式 / 关内商店 / 188 关 / 无尽矿井，
 * 1.2 在**不推翻这些**的前提下补五件事：
 *  1. **钩索手感**：下钩加速度、抓到时的 60–90 毫秒顿感、空钩快速回收，全写成常量；
 *  2. **矿洞纵深**：近岩壁 / 中矿层 / 远洞穴三层视差，只做位移与明暗，**不做真透视**
 *     （钩子角度是这个玩法唯一要瞄的东西，透视会让孩子瞄不准）；
 *  3. **道具重做**：炸药 / 力量水 / 幸运石各自一个纯函数，价钱随章节往上走；
 *  4. **两种新矿**：抓住会打滑的「泥泥矿」（可以用炸药固定），和要连抓两次的「双层晶」；
 *  5. **无尽加深**：越深照明圈越小（有下限，不许小到看不清字），每 5 层给一次三选一补给。
 */
import {
  DIG_BOTTOM,
  DIG_TOP,
  EMPTY_RETRACT,
  MAX_BOMBS,
  MAX_LUCK,
  MAX_STRENGTH,
  SHOP,
  retractSpeed,
  type ShopKind,
  type Wallet,
} from "./logic";

/* ---------------- 一、钩索手感 ---------------- */

/** 下钩不是一放就到顶速：0 加速到全速要这么多秒 */
export const EXTEND_RAMP = 0.18;
/** 抓到东西那一下的顿感（秒）。低于 60ms 感觉不到，高于 90ms 就像卡了 */
export const GRAB_HITCH_MIN = 0.06;
export const GRAB_HITCH_MAX = 0.09;
/** 越重的东西顿得越久，但夹在上面两个数之间 */
export function grabHitch(weight: number): number {
  const w = Math.max(0, Number.isFinite(weight) ? weight : 0);
  const t = Math.min(1, w / 24);
  return GRAB_HITCH_MIN + (GRAB_HITCH_MAX - GRAB_HITCH_MIN) * t;
}

/** 下钩到第 t 秒时的速度占全速的多少（0–1） */
export function extendRamp(t: number): number {
  if (!(t > 0)) return 0;
  return Math.min(1, t / EXTEND_RAMP);
}

/** 空钩回收：不受重量影响，永远是最快的那一档 */
export function emptyRetractSpeed(): number {
  return EMPTY_RETRACT;
}

/** 抓着东西比空钩慢——这条是整个玩法的取舍来源，写成断言防回归 */
export function haulIsSlowerThanEmpty(weight: number, strength = 0): boolean {
  return weight <= 0 || retractSpeed(weight, strength) < emptyRetractSpeed();
}

/**
 * 绳子中段垂下来多少像素。
 *
 * 空钩绷直，钩着东西才垂；越重垂得越多，但收敛到 `ROPE_SAG_MAX`，
 * 再重也不会垂到把下面的矿石挡住。这是「拉得沉」这件事唯一的视觉出口 ——
 * 速度慢是要盯着秒表才看得出来的，绳子弯了是一眼就看得出来的。
 */
export const ROPE_SAG_MAX = 10;
/** 垂度的换算单位：重量等于它时垂到最大值的一半 */
export const ROPE_SAG_UNIT = 14;

export function ropeSag(weight: number): number {
  const w = Math.max(0, Number.isFinite(weight) ? weight : 0);
  if (w <= 0) return 0;
  return (ROPE_SAG_MAX * w) / (w + ROPE_SAG_UNIT);
}

/* ---------------- 二、矿洞纵深（三层视差） ---------------- */

export type ParallaxLayer = "wall" | "seam" | "cavern";

export interface ParallaxSpec {
  layer: ParallaxLayer;
  label: string;
  /** 视差系数：1 = 跟着钩子走，0 = 完全不动 */
  factor: number;
  /** 明暗：1 = 原色，越小越暗（远的更暗） */
  shade: number;
}

/** 近 → 远。近的跟手，远的几乎不动，做出「洞很深」的错觉 */
export const PARALLAX: readonly ParallaxSpec[] = [
  { layer: "wall", label: "近岩壁", factor: 0.55, shade: 1 },
  { layer: "seam", label: "中矿层", factor: 0.28, shade: 0.82 },
  { layer: "cavern", label: "远洞穴", factor: 0.1, shade: 0.6 },
];

/** 钩子放到 len 长时，第几层背景该往上挪多少像素 */
export function parallaxOffset(layer: ParallaxLayer, hookLen: number): number {
  const spec = PARALLAX.find((p) => p.layer === layer);
  if (!spec) return 0;
  const reach = Math.max(1, DIG_BOTTOM - DIG_TOP);
  const t = Math.max(0, Math.min(1, hookLen / reach));
  return t * spec.factor * 42;
}

/** 三层的顺序必须是「越远越暗、越远越不动」，否则纵深会反过来 */
export function parallaxOrderedByDepth(): boolean {
  for (let i = 1; i < PARALLAX.length; i++) {
    if (PARALLAX[i].factor >= PARALLAX[i - 1].factor) return false;
    if (PARALLAX[i].shade > PARALLAX[i - 1].shade) return false;
  }
  return true;
}

/* ---------------- 三、道具重做 ---------------- */

/** 价钱随章节往上走：第 1 章原价，越往后越贵（每章 +12%，封顶 2 倍） */
export const PRICE_CHAPTER_STEP = 0.12;
export const PRICE_CHAPTER_CAP = 2;

export function chapterPriceMult(chapter: number): number {
  const c = Math.max(0, Math.floor(chapter));
  return Math.min(PRICE_CHAPTER_CAP, 1 + PRICE_CHAPTER_STEP * c);
}

/** 已经有 owned 件、正在第 chapter 章时，再买一件多少钱 */
export function priceAt(kind: ShopKind, owned: number, chapter: number): number {
  const e = SHOP[kind];
  const raw = e.base + e.step * Math.max(0, Math.round(owned));
  return Math.round(raw * chapterPriceMult(chapter));
}

/** 炸药：把钩住的东西「砰」一下变成彩纸，空钩飞快收回 */
export interface BombResult {
  wallet: Wallet;
  /** 炸掉了就不带东西回来 */
  dropped: boolean;
  /** 炸完之后的回收速度 */
  retract: number;
}

export function useBombOn(wallet: Wallet, weight: number): BombResult {
  if (wallet.bombs <= 0) {
    return { wallet, dropped: false, retract: retractSpeed(weight, wallet.strength) };
  }
  return {
    wallet: { ...wallet, bombs: wallet.bombs - 1 },
    dropped: true,
    retract: emptyRetractSpeed(),
  };
}

/** 力量水：本关回收整体加速，档数越高越快，但有上限 */
export function powerRetract(weight: number, strength: number): number {
  return retractSpeed(weight, Math.max(0, Math.min(MAX_STRENGTH, Math.round(strength))));
}

/** 幸运石：提高稀有矿的刷新权重（不改价钱，那是 haulValue 的事） */
export const LUCK_RARE_STEP = 0.22;

export function rareWeightMult(luck: number): number {
  return 1 + LUCK_RARE_STEP * Math.max(0, Math.min(MAX_LUCK, Math.round(luck)));
}

/** 三件道具都买满要多少钱（用来断言「不买也能过」的目标金额不会被定得太离谱） */
export function fullKitCost(chapter: number): number {
  let total = 0;
  for (let i = 0; i < MAX_BOMBS; i++) total += priceAt("bomb", i, chapter);
  for (let i = 0; i < MAX_STRENGTH; i++) total += priceAt("power", i, chapter);
  for (let i = 0; i < MAX_LUCK; i++) total += priceAt("luck", i, chapter);
  return total;
}

/* ---------------- 四、两种新矿 ---------------- */

export type NewOreKind = "muddy" | "twinCrystal";

export interface NewOreSpec {
  kind: NewOreKind;
  label: string;
  emoji: string;
  value: number;
  weight: number;
  radius: number;
  hint: string;
}

export const NEW_ORES: Record<NewOreKind, NewOreSpec> = {
  muddy: {
    kind: "muddy",
    label: "泥泥矿",
    emoji: "🟤",
    value: 120,
    weight: 12,
    radius: 13,
    hint: "外面裹着一层泥，拉上来的路上可能会打滑掉回去，用炸药先固定住就稳了",
  },
  twinCrystal: {
    kind: "twinCrystal",
    label: "双层晶",
    emoji: "🔷",
    /** 连钩两次加起来的全价。`ORES.twinCrystal.value` 填的是**单次**价，两处不要搞混 */
    value: 300,
    weight: 9,
    radius: 14,
    hint: "外壳先钩一次会裂开，里面的晶芯要再钩一次才拿得走",
  },
};

/**
 * 泥泥矿的打滑速率（每秒）。
 *
 * 走**指数**模型：拉了 t 秒还没滑掉的概率是 `e^(-rate*t)`。选它的理由是
 * 「每一帧独立掷一次」这件事在数学上就等价于指数分布 —— 逐帧实现
 * (`muddySlips`) 和给关卡设计估算用的闭式公式 (`muddySlipChance`) 因此是
 * 同一条曲线，不会出现「测试算出来四成、真玩起来六成」的两套数。
 *
 * 速率定在 0.08：从矿洞最深处拉一颗泥泥矿要五秒出头，滑掉的概率约三成 ——
 * 「多半拉得上来，偶尔栽一跤」。再高就变成「泥泥矿基本别碰」，
 * 那这颗矿就白设计了；而且它是有解的，钩着的时候按一下炸药就永远不滑。
 */
export const MUDDY_SLIP_PER_SEC = 0.08;
/**
 * 刚钩上来的这一小段不判滑。
 *
 * 没有它的话会出现「钩到的瞬间就掉了」，小朋友根本来不及理解发生了什么，
 * 只会觉得是游戏在耍赖。给半秒，让「抓住了」先成立，再谈会不会滑。
 */
export const MUDDY_SLIP_GRACE = 0.5;

/** 一小段可复现随机 */
export function makeHookRng(seed: number): () => number {
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

/**
 * 泥泥矿这一帧滑不滑手。
 *
 * 炸药固定过就永远不滑；刚钩上来的 `MUDDY_SLIP_GRACE` 秒内也不滑。
 * `heldFor` 是已经拉了多久（秒），不传就当早过了宽限期。
 */
export function muddySlips(rand: () => number, dt: number, pinned: boolean, heldFor = Infinity): boolean {
  if (pinned) return false;
  if (heldFor < MUDDY_SLIP_GRACE) return false;
  const step = Math.max(0, dt);
  if (step <= 0) return false;
  return rand() < 1 - Math.exp(-MUDDY_SLIP_PER_SEC * step);
}

/** 拉 seconds 秒里滑掉的概率（给关卡设计与测试估算用，和逐帧实现是同一条曲线） */
export function muddySlipChance(seconds: number, pinned = false): number {
  if (pinned) return 0;
  const t = Math.max(0, seconds - MUDDY_SLIP_GRACE);
  return 1 - Math.exp(-MUDDY_SLIP_PER_SEC * t);
}

export interface TwinState {
  /** 还剩几层壳：2 = 完整，1 = 壳裂开露出晶芯，0 = 已经到手 */
  layers: number;
}

export function createTwin(): TwinState {
  return { layers: 2 };
}

/** 钩中一次：先剥壳，第二次才真拿走 */
export function twinGrab(state: TwinState): { state: TwinState; taken: boolean } {
  const layers = Math.max(0, state.layers - 1);
  return { state: { layers }, taken: layers === 0 };
}

/**
 * 双层晶已经到手多少钱。
 *
 * 剥壳和取芯**对半分**，不能白剥一趟。这个比例不是随便定的：`index.ts` 每钩中一次
 * 就按 `ORES.twinCrystal.value` 发一次钱，钩两次正好是 `NEW_ORES.twinCrystal.value`
 * 的全价，所以这里必须跟着是二分之一，否则同一颗矿会有两套价目表。
 */
export const TWIN_SHELL_SHARE = 0.5;

export function twinValue(state: TwinState): number {
  const full = NEW_ORES.twinCrystal.value;
  if (state.layers <= 0) return full;
  if (state.layers === 1) return Math.round(full * TWIN_SHELL_SHARE);
  return 0;
}

/* ---------------- 五、无尽矿井：照明圈与补给点 ---------------- */

/** 第 1 层的照明半径（px） */
export const LIGHT_BASE = 260;
/** 每深一层收多少 */
export const LIGHT_STEP = 7;
/**
 * 照明半径下限。**这个数是硬约束**：再深也要看得清顶部那行「目标金额 / 剩余时间」，
 * 不然就成了「靠记忆玩」而不是「靠眼睛玩」。
 */
export const LIGHT_MIN = 150;

/**
 * 照明圈最外圈的黑度。**再深也不许压成全黑** ——
 * 矿洞画面里除了钩子还有矿石要认，看不见就只剩瞎钩了。
 */
export const LIGHT_MAX_DIM = 0.55;
/**
 * 照明圈从这条线往下画。上面那一条是地面、绞盘台和朵朵星星，
 * 也是钩子悬挂点所在的那一带 —— 压暗了连绳子从哪儿出来都看不清。
 */
export const LIGHT_BAND_TOP = 96;

export function lightRadius(depth: number): number {
  const n = Math.max(1, Math.round(depth));
  return Math.max(LIGHT_MIN, LIGHT_BASE - LIGHT_STEP * (n - 1));
}

/** 到第几层照明圈就收到下限了（再深也不会更暗，深度曲线是「先收后平」） */
export function lightFloorDepth(): number {
  return Math.ceil((LIGHT_BASE - LIGHT_MIN) / LIGHT_STEP) + 1;
}

/** 每几层给一次补给 */
export const SUPPLY_EVERY = 5;

export function isSupplyDepth(depth: number): boolean {
  const n = Math.round(depth);
  return n > 0 && n % SUPPLY_EVERY === 0;
}

export interface SupplyOption {
  kind: ShopKind | "coins";
  label: string;
  emoji: string;
  amount: number;
  hint: string;
}

const SUPPLY_POOL: readonly SupplyOption[] = [
  { kind: "bomb", label: "两包炸药", emoji: "💥", amount: 2, hint: "钩到不值钱的大石头就炸掉，空钩飞快收回" },
  { kind: "power", label: "一瓶力量水", emoji: "💪", amount: 1, hint: "这一趟往下回收都快三成" },
  { kind: "luck", label: "一块幸运石", emoji: "🍀", amount: 1, hint: "好矿刷得更勤，价钱也更好看" },
  { kind: "coins", label: "一小袋金币", emoji: "🪙", amount: 120, hint: "直接进钱包，想买什么自己挑" },
  { kind: "coins", label: "一大袋金币", emoji: "💰", amount: 240, hint: "深层才有的大袋子" },
];

/** 到补给点时的三选一（固定 seed 可复现，同一层永远是同样三个） */
export function supplyChoices(depth: number, seed: number): SupplyOption[] {
  const rng = makeHookRng((seed >>> 0) + Math.round(depth) * 2654435761);
  const pool = SUPPLY_POOL.filter((o) => !(o.amount === 240 && depth < SUPPLY_EVERY * 3));
  const picked: SupplyOption[] = [];
  const rest = [...pool];
  while (picked.length < 3 && rest.length > 0) {
    picked.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
  }
  return picked;
}

/** 领了补给之后的钱包 */
export function applySupply(wallet: Wallet, option: SupplyOption): Wallet {
  if (option.kind === "coins") return { ...wallet, coins: wallet.coins + option.amount };
  if (option.kind === "bomb") return { ...wallet, bombs: Math.min(MAX_BOMBS, wallet.bombs + option.amount) };
  if (option.kind === "power") {
    return { ...wallet, strength: Math.min(MAX_STRENGTH, wallet.strength + option.amount) };
  }
  return { ...wallet, luck: Math.min(MAX_LUCK, wallet.luck + option.amount) };
}

/* ---------------- 六、结算跳数与版面下限 ---------------- */

/**
 * 结算时金额跳数动画的时长（毫秒）。规格给的上限是 800，这里取 640 ——
 * 跳数是「看自己赚了多少」的爽点，不是过场，拖满 800 反而像卡住了。
 */
export const TALLY_MS = 640;

/**
 * 跳数动画走到第 `ms` 毫秒时该显示的数。
 *
 * 缓出曲线：一上来跳得飞快，收尾慢下来停在终值。整段走完一定**精确**等于 total，
 * 不会因为浮点误差差个一两块钱 —— 结算数字对不上是最伤信任的。
 */
export function tallyValue(total: number, ms: number, duration = TALLY_MS): number {
  const end = Math.round(total);
  const d = Math.max(1, duration);
  if (!(ms > 0)) return 0;
  if (ms >= d) return end;
  const p = ms / d;
  return Math.round(end * (1 - (1 - p) * (1 - p)));
}

/** 顶部那行「金币 / 目标 / 剩余时间」的最小字号（px）：360px 上也不许再小 */
export const HUD_MIN_FONT = 14;
/** 底部一行「放绳 + 道具栏」的最小热区（px）：小手也要点得中 */
export const TOUCH_MIN = 44;
