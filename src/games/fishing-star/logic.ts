// 钓鱼小达人 · 玩法内核(全是纯函数,一行 DOM 都不碰)。
//
// 一次完整的钓鱼被拆成四段,每一段都能单独喂数据测:
//  1. 抛竿蓄力:力度条来回摆,松手那一刻的力度决定钩子沉到多深(`chargePower` / `castDepth`);
//  2. 等咬钩:按水层与稀有度权重抽一条鱼(`pickFish`,随机源由调用方给,可复现);
//  3. 拉扯:张力条一边涨一边落,太紧断线、太松跑鱼、进度拉满收竿(`stepFight`);
//  4. 结算:算分、连击、图鉴(`catchScore` / `comboMultiplier` / `addToDex`)。
//
// 张力判定是整款游戏的手感所在,所以 `stepFight` 写成「给我上一帧状态和这一帧按没按住,
// 我还你下一帧状态」的形式:没有时间、没有随机、没有副作用,逐帧重放结果完全一致。

export const GAME_ID = "fishing-star";

/** 图鉴存档 key(1.1 的 id 列表版,1.2 起只用来迁移老存档) */
export const DEX_KEY = "yiduo-yixing.fishing-star.dex";

// ---------------------------------------------------------------------------
// 水层
// ---------------------------------------------------------------------------

export interface WaterLayer {
  name: string;
  emoji: string;
  /** 起始深度(米,含) */
  from: number;
  /** 结束深度(米,不含;最后一层用 MAX_DEPTH 兜底) */
  to: number;
  /** 这一层的水色(粉彩,从浅到深) */
  color: string;
  desc: string;
}

/** 钩子最深能沉到哪儿 */
export const MAX_DEPTH = 50;

export const LAYERS: WaterLayer[] = [
  { name: "晨光浅滩", emoji: "🌤️", from: 0, to: 8, color: "#cdeefb", desc: "阳光照得到的水面,小鱼多、脾气好" },
  { name: "水草丛", emoji: "🌿", from: 8, to: 18, color: "#a9dfe8", desc: "草叶间藏着爱躲的鱼,咬钩前会犹豫一下" },
  { name: "落霞湖心", emoji: "🌇", from: 18, to: 29, color: "#7fc4dc", desc: "水色开始变暗,鱼的力气明显大了一截" },
  { name: "幽蓝深潭", emoji: "🫧", from: 29, to: 40, color: "#4f9cc4", desc: "冷水层,挣扎又快又猛,手要稳" },
  { name: "星光海沟", emoji: "✨", from: 40, to: MAX_DEPTH, color: "#2f6f9e", desc: "最深的一层,住着传说里的大家伙" },
];

/** 某个深度属于第几层(0 基;超界自动夹到两端) */
export function layerAt(depth: number): number {
  if (!Number.isFinite(depth)) return 0;
  for (let i = 0; i < LAYERS.length; i++) {
    if (depth < LAYERS[i].to) return i;
  }
  return LAYERS.length - 1;
}

/** 深度的中文说明,HUD 与图鉴共用 */
export function depthLabel(depth: number): string {
  const d = clamp(depth, 0, MAX_DEPTH);
  return `${d.toFixed(1)} 米 · ${LAYERS[layerAt(d)].name}`;
}

/** 一层水的中心深度(关卡提示与图鉴用) */
export function layerCenter(layer: number): number {
  const l = LAYERS[clampInt(layer, 0, LAYERS.length - 1)];
  return Math.round(((l.from + l.to) / 2) * 10) / 10;
}

// ---------------------------------------------------------------------------
// 抛竿蓄力
// ---------------------------------------------------------------------------

/** 力度条来回摆一个来回要多久 */
export const CHARGE_CYCLE_MS = 1500;

/**
 * 按住多久对应多大力度:0 → 1 → 0 的三角波,来回摆,松手那一刻定格。
 * 三角波比正弦好读:力度条是匀速走的,孩子能预判什么时候松手。
 */
export function chargePower(heldMs: number, cycleMs: number = CHARGE_CYCLE_MS): number {
  if (!Number.isFinite(heldMs) || heldMs <= 0) return 0;
  const cycle = cycleMs > 0 ? cycleMs : CHARGE_CYCLE_MS;
  const phase = (heldMs % cycle) / cycle;
  return phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
}

/** 力度 → 深度(米),保留一位小数 */
export function castDepth(power: number, maxDepth: number = MAX_DEPTH): number {
  return Math.round(clamp(power, 0, 1) * maxDepth * 10) / 10;
}

/** 钩子沉到指定深度要多久(毫秒),深水多等一会儿 */
export function sinkMs(depth: number): number {
  return Math.round(280 + clamp(depth, 0, MAX_DEPTH) * 42);
}

/** 咬钩前的等待(毫秒);随机源由调用方给,便于复现 */
export function biteDelayMs(rand: () => number, depth: number): number {
  const base = 480 + clamp(depth, 0, MAX_DEPTH) * 9;
  return Math.round(base + rand() * 900);
}

/** 抛竿落点在不在这一关的鱼群带里 */
export function inBand(depth: number, band: { from: number; to: number }): boolean {
  return depth >= band.from && depth <= band.to;
}

/**
 * 落点离鱼群带的距离(米);落在带里是 0。
 * 越远,好鱼咬钩的概率越低(见 `pickFish` 的 luck)。
 */
export function bandMiss(depth: number, band: { from: number; to: number }): number {
  if (depth < band.from) return Math.round((band.from - depth) * 10) / 10;
  if (depth > band.to) return Math.round((depth - band.to) * 10) / 10;
  return 0;
}

// ---------------------------------------------------------------------------
// 抛竿落点:蓄力决定甩出去多远,风把它吹偏一点点
// ---------------------------------------------------------------------------
//
// 2D 侧视图里岸在左边、水面往右铺开:抛得越远,脚下的斜坡越深,鱼也越稀有。
// 「力度 → 距离 → 深度」这条链子是线性的,所以 `depthAtDistance(castDistance(p, 0))`
// 和老的 `castDepth(p)` 说的是同一件事,只是多了一个能看见的水平轴。

/** 最远能甩出去多少米 */
export const MAX_CAST_M = 30;

/** 风最多把落点吹偏多少(满风 ±12%,只够改变手感,不至于让人抛不准) */
export const WIND_SWAY = 0.12;

/** 抛到最远处时额外的运气加成:远处更容易碰上稀有鱼 */
export const FAR_LUCK = 0.5;

/** 抽一阵风:-1(顶头逆风)..+1(推着走的顺风),按 0.25 一档,方便画箭头也方便预判 */
export function rollWind(rand: () => number): number {
  const v = clamp(rand(), 0, 1) * 2 - 1;
  return Math.round(v * 4) / 4;
}

/** 风吹过以后的实际力度(0..1) */
export function applyWind(power: number, wind: number): number {
  const w = clamp(wind, -1, 1);
  return clamp(clamp(power, 0, 1) * (1 + WIND_SWAY * w), 0, 1);
}

/** 松手那一刻的力度 + 风 → 甩出去多少米 */
export function castDistance(power: number, wind = 0, maxM: number = MAX_CAST_M): number {
  const far = maxM > 0 ? maxM : MAX_CAST_M;
  return Math.round(applyWind(power, wind) * far * 10) / 10;
}

/** 落点离岸多远 → 那里的水有多深 */
export function depthAtDistance(dist: number, maxM: number = MAX_CAST_M): number {
  const far = maxM > 0 ? maxM : MAX_CAST_M;
  return Math.round((clamp(dist, 0, far) / far) * MAX_DEPTH * 10) / 10;
}

/** 想钓这个深度,得把钩子甩到离岸多远 */
export function distanceOfDepth(depth: number, maxM: number = MAX_CAST_M): number {
  const far = maxM > 0 ? maxM : MAX_CAST_M;
  return Math.round((clamp(depth, 0, MAX_DEPTH) / MAX_DEPTH) * far * 10) / 10;
}

/** 落点越远,稀有鱼越愿意来(0..FAR_LUCK) */
export function distanceLuck(dist: number, maxM: number = MAX_CAST_M): number {
  const far = maxM > 0 ? maxM : MAX_CAST_M;
  return Math.round((clamp(dist, 0, far) / far) * FAR_LUCK * 100) / 100;
}

/** 风向箭头(色觉友好:形状本身就说明了方向) */
export function windArrow(wind: number): string {
  const w = clamp(wind, -1, 1);
  if (Math.abs(w) < 0.13) return "•";
  return w > 0 ? (w >= 0.75 ? "⇉" : "→") : w <= -0.75 ? "⇇" : "←";
}

/** 风向的中文说法 */
export function windText(wind: number): string {
  const w = clamp(wind, -1, 1);
  if (Math.abs(w) < 0.13) return "几乎无风";
  const strength = Math.abs(w) >= 0.75 ? "稍强" : "轻";
  return w > 0 ? `${strength}顺风,抛得更远` : `${strength}逆风,抛得更近`;
}

// ---------------------------------------------------------------------------
// 鱼种图鉴(25 种,全部原创)
// ---------------------------------------------------------------------------

export interface Fish {
  id: string;
  name: string;
  emoji: string;
  /** 常驻水层(0..4) */
  layer: number;
  /** 稀有度 1(常见)..5(传说) */
  rarity: 1 | 2 | 3 | 4 | 5;
  /** 典型体重(千克) */
  weight: number;
  /** 基础分 */
  score: number;
  /** 挣扎强度:每秒往张力里加多少 */
  pull: number;
  /** 体力:越大越难拖上来 */
  stamina: number;
  note: string;
}

export const FISH: Fish[] = [
  // —— 晨光浅滩 ——
  { id: "yueya-ji", name: "月牙鲫", emoji: "🐟", layer: 0, rarity: 1, weight: 0.3, score: 6, pull: 0.30, stamina: 1.0, note: "尾巴上有一道月牙形的白纹,水一亮就成群冒头。" },
  { id: "tangshuang-li", name: "糖霜鲤", emoji: "🐠", layer: 0, rarity: 1, weight: 0.5, score: 8, pull: 0.34, stamina: 1.1, note: "鳞片边缘泛着白,像撒了一层糖霜,性子最温和。" },
  { id: "paopao-pangpi", name: "泡泡鳑鲏", emoji: "🫧", layer: 0, rarity: 2, weight: 0.2, score: 12, pull: 0.38, stamina: 1.0, note: "游的时候一路吐小泡泡,顺着泡泡就能找到它。" },
  { id: "lingdang-huhu", name: "铃铛虎鱼", emoji: "🔔", layer: 0, rarity: 2, weight: 0.7, score: 14, pull: 0.44, stamina: 1.2, note: "咬钩前会先撞一下钩子,像有人摇了摇铃铛。" },
  { id: "caizhi-tiao", name: "彩纸鲦", emoji: "🎏", layer: 0, rarity: 3, weight: 0.4, score: 20, pull: 0.48, stamina: 1.2, note: "身上一条条彩色竖纹,转身的时候像风里的彩纸。" },
  // —— 水草丛 ——
  { id: "caoye-bo", name: "草叶青鲌", emoji: "🌿", layer: 1, rarity: 1, weight: 0.9, score: 10, pull: 0.42, stamina: 1.2, note: "整条鱼是草叶的颜色,不动的时候真的会看不见。" },
  { id: "huaban-dou", name: "花瓣斗鱼", emoji: "🌸", layer: 1, rarity: 2, weight: 0.4, score: 16, pull: 0.46, stamina: 1.3, note: "鱼鳍张开像一朵花,爱在水草缝里绕圈子。" },
  { id: "mianhua-nian", name: "棉花糖鲶", emoji: "🍬", layer: 1, rarity: 2, weight: 1.6, score: 18, pull: 0.52, stamina: 1.5, note: "胡须又软又长,拖上来之前会先赖在水底装石头。" },
  { id: "luwei-zhen", name: "芦苇针鱼", emoji: "🪶", layer: 1, rarity: 3, weight: 0.6, score: 24, pull: 0.58, stamina: 1.3, note: "细得像一根芦苇杆,冲刺起来是全湖最快的。" },
  { id: "feicui-qi", name: "翡翠圆鳍", emoji: "💚", layer: 1, rarity: 4, weight: 2.2, score: 34, pull: 0.62, stamina: 1.7, note: "圆滚滚一团翠绿色,雨后的清晨才肯露面。" },
  // —— 落霞湖心 ——
  { id: "luoxia-lin", name: "落霞金鳞", emoji: "🌇", layer: 2, rarity: 2, weight: 1.8, score: 20, pull: 0.56, stamina: 1.4, note: "傍晚的时候鳞片会把霞光整片反上来。" },
  { id: "tongjing-chang", name: "铜镜鲳", emoji: "🥉", layer: 2, rarity: 2, weight: 2.4, score: 22, pull: 0.60, stamina: 1.6, note: "身体扁平得像一面小铜镜,横过来拽线特别沉。" },
  { id: "yunwen-zun", name: "云纹鳟", emoji: "☁️", layer: 2, rarity: 3, weight: 2.8, score: 28, pull: 0.64, stamina: 1.6, note: "背上一团团云一样的花纹,每一条都长得不一样。" },
  { id: "tiqin-li", name: "提琴尾鲤", emoji: "🎻", layer: 2, rarity: 4, weight: 3.4, score: 38, pull: 0.68, stamina: 1.8, note: "尾巴的轮廓像一把小提琴,摆尾的力气大得吓人。" },
  { id: "hupo-lu", name: "琥珀鲈", emoji: "🟠", layer: 2, rarity: 4, weight: 3.0, score: 40, pull: 0.72, stamina: 1.8, note: "通体透着琥珀色,阳光斜照时能看见里面的骨影。" },
  // —— 幽蓝深潭 ——
  { id: "youlan-deng", name: "幽蓝灯笼鱼", emoji: "🏮", layer: 3, rarity: 3, weight: 1.4, score: 30, pull: 0.66, stamina: 1.6, note: "额前挂着一盏小灯,深水里一闪一闪地引路。" },
  { id: "moyu-man", name: "墨玉鳗", emoji: "🖤", layer: 3, rarity: 3, weight: 3.6, score: 34, pull: 0.74, stamina: 1.9, note: "黑得发亮,拖上来的时候会绕着线打好几个结。" },
  { id: "yinshuang-dai", name: "银霜带鱼", emoji: "🥈", layer: 3, rarity: 4, weight: 4.2, score: 44, pull: 0.78, stamina: 2.0, note: "一条长长的银带子,甩起来能把水面拍出白花。" },
  { id: "shuijing-zhang", name: "水晶章鱼", emoji: "🐙", layer: 3, rarity: 4, weight: 3.8, score: 46, pull: 0.70, stamina: 2.1, note: "半透明的身体,八条腕会轮流吸住石头往回拽。" },
  { id: "mengpao-shuimu", name: "梦泡水母", emoji: "🪼", layer: 3, rarity: 5, weight: 2.6, score: 58, pull: 0.60, stamina: 2.2, note: "浮起来慢吞吞的,可一受惊就整片沉下去,机会只有一次。" },
  // —— 星光海沟 ——
  { id: "xingsha-yao", name: "星砂鳐", emoji: "⭐", layer: 4, rarity: 3, weight: 5.0, score: 36, pull: 0.76, stamina: 2.0, note: "背上洒满亮点,滑翔一样贴着沟底走。" },
  { id: "jiguang-qi", name: "极光旗鱼", emoji: "🌌", layer: 4, rarity: 4, weight: 6.5, score: 50, pull: 0.86, stamina: 2.1, note: "背鳍展开是一整条极光,冲刺一次能拖走十几米线。" },
  { id: "tiejia-xia", name: "铁甲龙虾", emoji: "🦞", layer: 4, rarity: 4, weight: 4.6, score: 48, pull: 0.82, stamina: 2.2, note: "壳硬得像铁,不冲刺,只是死死地往石缝里缩。" },
  { id: "yueguang-jing", name: "月光鲸鲨", emoji: "🌙", layer: 4, rarity: 5, weight: 9.0, score: 66, pull: 0.92, stamina: 2.4, note: "满月的夜里才上浮一次,力气大到要两个人扶着竿。" },
  { id: "caihong-wang", name: "彩虹深海王", emoji: "🌈", layer: 4, rarity: 5, weight: 8.2, score: 72, pull: 0.95, stamina: 2.4, note: "传说里的那一条,身上七种颜色会随着水流慢慢换。" },
];

/** id → 鱼,查不到返回 undefined */
export function fishById(id: string): Fish | undefined {
  return FISH.find((f) => f.id === id);
}

/** 某一层的全部鱼(图鉴分页用) */
export function fishOfLayer(layer: number): Fish[] {
  return FISH.filter((f) => f.layer === layer);
}

/** 稀有度的星串,例如 3 → "★★★☆☆" */
export function rarityStars(rarity: number): string {
  const n = clampInt(rarity, 1, 5);
  return "★".repeat(n) + "☆".repeat(5 - n);
}

// ---------------------------------------------------------------------------
// 四档稀有度
// ---------------------------------------------------------------------------
//
// 鱼身上的 rarity 是 1..5 的连续数值(抽签概率按它算,关卡表也依赖它,不能动);
// 摆到图鉴上给孩子看的是四个档位。两者的对应关系只写在这一张表里。

export type RarityTierKey = "common" | "uncommon" | "rare" | "legend";

export interface RarityTier {
  key: RarityTierKey;
  name: string;
  /** 形状标记:色觉友好,不靠颜色也分得出档位 */
  mark: string;
  color: string;
  /** 归进这一档的 rarity 值 */
  rarities: number[];
  desc: string;
}

export const RARITY_TIERS: RarityTier[] = [
  { key: "common", name: "常见", mark: "●", color: "#78a6c0", rarities: [1, 2], desc: "随便抛几竿就能遇上。" },
  { key: "uncommon", name: "少见", mark: "◆", color: "#5faa82", rarities: [3], desc: "落点对了才肯来。" },
  { key: "rare", name: "稀有", mark: "▲", color: "#7d84d6", rarities: [4], desc: "要抛得远,还得配好饵。" },
  { key: "legend", name: "传说", mark: "★", color: "#e0912a", rarities: [5], desc: "深水、夜色,再加一点点运气。" },
];

/** rarity → 四档里的第几档(0..3) */
export function tierIndexOf(rarity: number): number {
  const r = clampInt(rarity, 1, 5);
  for (let i = 0; i < RARITY_TIERS.length; i++) {
    if (RARITY_TIERS[i].rarities.includes(r)) return i;
  }
  return RARITY_TIERS.length - 1;
}

export function tierOf(rarity: number): RarityTier {
  return RARITY_TIERS[tierIndexOf(rarity)];
}

/** 图鉴卡片上的档位标签,例如「▲ 稀有」 */
export function tierLabel(rarity: number): string {
  const t = tierOf(rarity);
  return `${t.mark} ${t.name}`;
}

/** 某一档里的全部鱼(图鉴筛选用) */
export function fishOfTier(tier: number): Fish[] {
  const i = clampInt(tier, 0, RARITY_TIERS.length - 1);
  return FISH.filter((f) => tierIndexOf(f.rarity) === i);
}

// ---------------------------------------------------------------------------
// 体长:图鉴要记「你钓到过的最大的一条」
// ---------------------------------------------------------------------------

/** 同一种鱼的体长上下浮动幅度 */
export const SIZE_SPREAD = 0.22;

/** 一种鱼的标准体长(厘米):按体重开三次方,大鱼长但不会长得离谱 */
export function baseLengthCm(fish: Fish): number {
  return Math.round((14 + 26 * Math.cbrt(Math.max(0.01, fish.weight))) * 10) / 10;
}

/** roll(0..1)→ 这一条的体长(厘米);0 是同种里最小的,1 是最大的 */
export function rollLengthCm(fish: Fish, roll: number): number {
  const t = clamp(roll, 0, 1);
  return Math.round(baseLengthCm(fish) * (1 - SIZE_SPREAD + 2 * SIZE_SPREAD * t) * 10) / 10;
}

/** 体长 → 这一条的体重(千克):长一成,重量涨三次方 */
export function weightForLength(fish: Fish, cm: number): number {
  const base = baseLengthCm(fish);
  if (base <= 0) return fish.weight;
  const ratio = clamp(cm, 1, base * 3) / base;
  // 再小的一条也是一条鱼,不许出现「0 千克」
  return Math.max(0.01, Math.round(fish.weight * ratio * ratio * ratio * 100) / 100);
}

/** 体长的中文写法 */
export function formatLength(cm: number): string {
  if (!Number.isFinite(cm) || cm <= 0) return "—";
  return `${(Math.round(cm * 10) / 10).toFixed(1)} 厘米`;
}

/** 体重的中文写法:不到一千克说克 */
export function formatWeight(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return "0 克";
  if (kg < 1) return `${Math.round(kg * 1000)} 克`;
  return `${kg.toFixed(1)} 千克`;
}

/** 毫秒 → mm:ss */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// ---------------------------------------------------------------------------
// 谁咬钩:按水层贴合度 × 稀有度权重抽签
// ---------------------------------------------------------------------------

/** 稀有度越高越难碰上;luck>0 时罕见鱼的机会一起抬高 */
export function rarityChance(rarity: number, luck = 0): number {
  const base = [1, 1, 0.6, 0.32, 0.15, 0.06][clampInt(rarity, 1, 5)];
  return base * (1 + clamp(luck, -0.9, 3) * (rarity - 1) * 0.35);
}

/** 钩子停在 depth 时,这条鱼有多想咬钩(相对权重,>=0) */
export function fishWeightAt(fish: Fish, depth: number, luck = 0): number {
  const gap = Math.abs(fish.layer - layerAt(depth));
  const affinity = gap === 0 ? 1 : gap === 1 ? 0.22 : gap === 2 ? 0.03 : 0.004;
  return affinity * rarityChance(fish.rarity, luck);
}

/**
 * 抽一条咬钩的鱼。权重和恒大于 0(最差也有 0.004 的贴合度),所以永远抽得到,
 * 不会出现「空军一整关」。rand 由调用方给,同一串随机数抽出同一条鱼。
 */
export function pickFish(depth: number, rand: () => number, luck = 0, pool: Fish[] = FISH): Fish {
  const weights = pool.map((f) => fishWeightAt(f, depth, luck));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return pool[0];
  let roll = clamp(rand(), 0, 0.999999) * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// ---------------------------------------------------------------------------
// 张力拉扯(核心判定,纯函数)
// ---------------------------------------------------------------------------

/** 张力到这里线当场就断(硬顶,任何装备都救不回来) */
export const SNAP_AT = 1;
/** 进红区:到这里开始倒计时,不是立刻断 */
export const RED_AT = 0.82;
/** 在红区连续待满这么久,线才断(1.2 秒的预警窗口) */
export const RED_SNAP_MS = 1200;
/** 进入「太紧了」的警戒区 */
export const TIGHT_AT = 0.68;
/** 低于这里算「太松了」,一直松着鱼就跑了 */
export const GOOD_AT = 0.28;
/** 咬钩那一刻线已经绷起来了,从舒服的区间开局 */
export const START_TENSION = 0.35;

export type TensionZone = "slack" | "good" | "tight" | "snap";

/** 张力落在哪个区间(纯查表,给 UI 上色也给判定用) */
export function tensionZone(tension: number): TensionZone {
  if (!Number.isFinite(tension)) return "slack";
  if (tension >= SNAP_AT) return "snap";
  if (tension >= TIGHT_AT) return "tight";
  if (tension >= GOOD_AT) return "good";
  return "slack";
}

/** 各区间收线的效率:卡在舒服区收得最快,绷太紧反而慢,松了几乎收不动 */
export function zoneGain(zone: TensionZone): number {
  if (zone === "good") return 1.25;
  if (zone === "tight") return 1.05;
  if (zone === "slack") return 0.5;
  return 0;
}

/** 区间的中文提示,HUD 直接显示 */
export function zoneText(zone: TensionZone): string {
  if (zone === "tight") return "太紧了!快松手";
  if (zone === "slack") return "太松了,收一点线";
  if (zone === "snap") return "线断了";
  return "手感正好,继续收";
}

// ---------------------------------------------------------------------------
// 张力条的三段配色(绿 / 黄 / 红)
// ---------------------------------------------------------------------------
//
// `tensionZone` 是判定用的四分区,分界点写死;
// 下面这一套是给眼睛看的三段,红段的起点会被鱼线装备顶上去,所以要能传参。

export type TensionBand = "slack" | "green" | "yellow" | "red";

export function tensionBand(tension: number, redAt: number = RED_AT): TensionBand {
  if (!Number.isFinite(tension)) return "slack";
  const red = clamp(redAt, GOOD_AT + 0.05, 1.4);
  if (tension >= red) return "red";
  if (tension >= TIGHT_AT) return "yellow";
  if (tension >= GOOD_AT) return "green";
  return "slack";
}

/** 每一段的形状标记:色弱的孩子不靠颜色也能读懂张力条 */
export function bandMark(band: TensionBand): string {
  if (band === "red") return "▲▲▲";
  if (band === "yellow") return "◆◆";
  if (band === "green") return "●";
  return "○";
}

/** 每一段的一句话 */
export function bandTip(band: TensionBand): string {
  if (band === "red") return "红区!数一下就要断线,松手!";
  if (band === "yellow") return "有点紧了,准备松手";
  if (band === "slack") return "太松了,收一点线";
  return "手感正好,继续收";
}

export interface FightParams {
  /** 鱼这一场用的挣扎节奏 */
  pattern: StrugglePattern;
  /** 张力硬顶:到这里当帧断线(鱼线装备可以往上顶一点点) */
  snapAt: number;
  /** 红区起点 */
  redAt: number;
  /** 在红区连续待满多久断线 */
  redSnapMs: number;
  /** 鱼挣扎每秒往张力里加多少(会被 struggle 波形调制) */
  pull: number;
  /** 按住收线每秒涨多少张力 */
  reel: number;
  /** 松手每秒落多少张力 */
  ease: number;
  /** 按住收线每秒推进多少进度(还要乘区间效率) */
  gain: number;
  /** 松手时每秒退多少进度 */
  slip: number;
  /** 挣扎的一个来回多少毫秒 */
  surgeMs: number;
  /** 连续「太松」多久鱼就跑了 */
  escapeMs: number;
}

/** 太松持续多久跑鱼(基准值,难度高时会缩短) */
export const ESCAPE_MS = 2000;

/**
 * 由鱼种与关卡难度算出这一场拉扯的参数。
 * hardness 是 0..1 的关卡难度,只影响鱼的力气与容错,不改玩家的收线速度。
 */
export function fightParams(fish: Fish, hardness = 0, snapAt: number = SNAP_AT): FightParams {
  const h = clamp(hardness, 0, 1);
  const pull = round3(fish.pull * (0.85 + h * 0.45));
  const hardTop = clamp(snapAt, SNAP_AT, SNAP_AT + 0.2);
  return {
    pattern: patternOf(fish),
    snapAt: hardTop,
    // 鱼线越好,红区也跟着往上让一点点,预警窗口的长度不变
    redAt: round3(RED_AT + (hardTop - SNAP_AT)),
    redSnapMs: RED_SNAP_MS,
    pull,
    reel: 0.62,
    // 松手一定要比鱼的挣扎更有力,否则一放手张力还在涨,那就成死局了
    ease: round3(0.85 + pull * 1.2),
    gain: round3(0.95 / fish.stamina),
    slip: round3(0.05 + h * 0.05),
    surgeMs: Math.round(920 - fish.rarity * 70),
    escapeMs: Math.round(ESCAPE_MS - h * 400),
  };
}

export type FightStatus = "fighting" | "landed" | "snapped" | "escaped";

export interface FightState {
  /** 0..1.4,>=1 断线 */
  tension: number;
  /** 0..1,拉满收竿 */
  progress: number;
  /** 连续处在「太松」区间多久了 */
  slackMs: number;
  /** 这一场拉了多久 */
  elapsedMs: number;
  /** 停在舒服区的累计时长,用来评「完美收竿」 */
  perfectMs: number;
  /** 连续待在红区多久了(满 redSnapMs 就断线) */
  redMs: number;
  status: FightStatus;
}

export function newFight(tension: number = START_TENSION): FightState {
  return {
    tension: clamp(tension, 0, 1),
    progress: 0,
    slackMs: 0,
    elapsedMs: 0,
    perfectMs: 0,
    redMs: 0,
    status: "fighting",
  };
}

// ---------------------------------------------------------------------------
// 三种挣扎节奏
// ---------------------------------------------------------------------------
//
// 每种节奏在一个周期里的平均值都恰好是 0.5(波形关于半周期反对称),
// 所以换节奏只改手感、不改这条鱼整体有多难拉。
// 节奏由鱼的 id 与稀有度定死:同一种鱼永远是同一个节奏,认得出来就打得过。

export type StrugglePattern = "steady" | "burst" | "dig";

export const STRUGGLE_PATTERNS: StrugglePattern[] = ["steady", "burst", "dig"];

export interface PatternInfo {
  key: StrugglePattern;
  name: string;
  mark: string;
  /** 怎么认出它、怎么打 */
  tell: string;
}

export const PATTERN_INFO: Record<StrugglePattern, PatternInfo> = {
  steady: { key: "steady", name: "稳潮", mark: "〜", tell: "一涨一落像呼吸,跟着这个拍子一收一放最省力。" },
  burst: { key: "burst", name: "猛冲", mark: "⚡", tell: "安静两拍猛冲一下,冲的那一下先松手,冲完再收。" },
  dig: { key: "dig", name: "赖底", mark: "⛰", tell: "半程死沉半程放松,沉的时候别硬收,松的时候使劲收。" },
};

/** 稀有度决定这条鱼可能用哪几种节奏,具体哪一种由 id 定死 */
const PATTERN_BY_RARITY: Record<number, StrugglePattern[]> = {
  1: ["steady"],
  2: ["steady", "burst"],
  3: ["burst", "dig"],
  4: ["dig", "burst"],
  5: ["burst", "dig", "steady"],
};

/** id 的稳定哈希(FNV-1a):不用随机数,重装游戏也不会变 */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 这条鱼的挣扎节奏 */
export function patternOf(fish: Fish): StrugglePattern {
  const list = PATTERN_BY_RARITY[clampInt(fish.rarity, 1, 5)] ?? ["steady"];
  return list[hashId(fish.id) % list.length];
}

/**
 * 鱼的挣扎波形:0..1,平均 0.5。
 * 用累计时长算,不看真实时钟,所以同一串输入重放出来一模一样。
 */
export function struggle(elapsedMs: number, surgeMs: number): number {
  const cycle = surgeMs > 0 ? surgeMs : 800;
  const t = (Number.isFinite(elapsedMs) ? elapsedMs : 0) / cycle;
  return 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
}

/** 按节奏取挣扎波形;`steady` 就是老的正弦 */
export function struggleAt(pattern: StrugglePattern, elapsedMs: number, surgeMs: number): number {
  const cycle = surgeMs > 0 ? surgeMs : 800;
  const s = Math.sin(((Number.isFinite(elapsedMs) ? elapsedMs : 0) / cycle) * Math.PI * 2);
  if (pattern === "burst") return 0.5 + 0.5 * s * s * s;
  if (pattern === "dig") return 0.5 + 0.5 * (Math.tanh(2.4 * s) / Math.tanh(2.4));
  return 0.5 + 0.5 * s;
}

/** 一帧最多按多少毫秒结算:切后台回来时不会一下子把线崩断 */
export const MAX_STEP_MS = 120;

/**
 * 拉扯的一帧:上一帧状态 + 这一帧有没有按住收线 → 下一帧状态。
 *
 * 判定顺序是「先断线、再跑鱼、最后收竿」:
 * 张力冲到硬顶的那一帧哪怕进度也满了,也算断线,免得出现「崩着线也能赢」的侥幸。
 *
 * 断线有两条路:冲到 `snapAt` 当帧就断(手滑到底了),
 * 或者在红区(`redAt` 以上)连续赖满 `redSnapMs`(默认 1.2 秒)——
 * 后面这一条才是常态,红区一亮还有一秒多可以救回来。
 */
export function stepFight(state: FightState, p: FightParams, reeling: boolean, dtMs: number): FightState {
  if (state.status !== "fighting") return state;
  const ms = clamp(Number.isFinite(dtMs) ? dtMs : 0, 0, MAX_STEP_MS);
  const dt = ms / 1000;
  const surge = struggleAt(p.pattern ?? "steady", state.elapsedMs, p.surgeMs);
  const snapAt = Number.isFinite(p.snapAt) ? p.snapAt : SNAP_AT;
  const redAt = Number.isFinite(p.redAt) ? p.redAt : RED_AT;
  const redSnapMs = Number.isFinite(p.redSnapMs) ? p.redSnapMs : RED_SNAP_MS;

  const tension = clamp(state.tension + (reeling ? p.reel : -p.ease) * dt + p.pull * surge * dt, 0, 1.4);
  const zone = tensionZone(tension);
  const progress = clamp(
    state.progress + (reeling ? p.gain * zoneGain(zone) : -p.slip) * dt,
    0,
    1
  );
  const slackMs = zone === "slack" ? state.slackMs + ms : 0;
  const perfectMs = zone === "good" ? state.perfectMs + ms : state.perfectMs;
  const redMs = tension >= redAt ? (state.redMs ?? 0) + ms : 0;
  const elapsedMs = state.elapsedMs + ms;

  let status: FightStatus = "fighting";
  if (tension >= snapAt || redMs >= redSnapMs) status = "snapped";
  else if (slackMs >= p.escapeMs) status = "escaped";
  else if (progress >= 1) status = "landed";

  return { tension, progress, slackMs, elapsedMs, perfectMs, redMs, status };
}

/** 红区还能撑多久(毫秒);没进红区就是满格 */
export function redLeftMs(state: FightState, p: FightParams): number {
  const total = Number.isFinite(p.redSnapMs) ? p.redSnapMs : RED_SNAP_MS;
  return Math.max(0, total - (state.redMs ?? 0));
}

/** 红区倒计时已经走了多少(0..1),给预警震动条用 */
export function redRatio(state: FightState, p: FightParams): number {
  const total = Number.isFinite(p.redSnapMs) && p.redSnapMs > 0 ? p.redSnapMs : RED_SNAP_MS;
  return clamp((state.redMs ?? 0) / total, 0, 1);
}

/** 这一场是不是「完美收竿」:六成以上的时间都稳在舒服区 */
export function isPerfectCatch(state: FightState): boolean {
  if (state.status !== "landed" || state.elapsedMs <= 0) return false;
  return state.perfectMs / state.elapsedMs >= 0.6;
}

/** 失败原因的中文说法(温柔版,不批评) */
export function fightLine(status: FightStatus): string {
  if (status === "snapped") return "线绷得太紧啦,断了。下次到红区就松一下手。";
  if (status === "escaped") return "线松太久,它甩钩跑掉了。别怕收线,别停太久。";
  if (status === "landed") return "收竿成功!";
  return "还在拉扯中……";
}

/**
 * 给 AI / 单测用的自动拉扯策略:张力高于 high 就松手,低于 low 就收线。
 * 也是「合格玩家」的标准手法,关卡可通关性测试就靠它。
 */
export function autoReel(state: FightState, low = 0.34, high = 0.6, wasReeling = true): boolean {
  if (state.tension >= high) return false;
  if (state.tension <= low) return true;
  return wasReeling;
}

// ---------------------------------------------------------------------------
// 计分与连击
// ---------------------------------------------------------------------------

/** 连击倍率:连着不失手最多加到两倍 */
export function comboMultiplier(combo: number): number {
  const n = clampInt(combo, 0, 99);
  return 1 + Math.min(n, 5) * 0.2;
}

export interface ScoreOpts {
  /** 之前已经连着钓上几条 */
  combo?: number;
  /** 完美收竿 */
  perfect?: boolean;
  /** 落点在鱼群带里 */
  inBand?: boolean;
}

/** 一条鱼到手值多少分 */
export function catchScore(fish: Fish, opts: ScoreOpts = {}): number {
  const combo = comboMultiplier(opts.combo ?? 0);
  const perfect = opts.perfect ? 1.5 : 1;
  const band = opts.inBand ? 1.2 : 1;
  return Math.max(1, Math.round(fish.score * combo * perfect * band));
}

/** 无尽模式一局多久 */
export const ENDLESS_MS = 90_000;

/** 无尽模式剩余时间 */
export function endlessLeft(elapsedMs: number, totalMs: number = ENDLESS_MS): number {
  return Math.max(0, totalMs - Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0));
}

/** 无尽模式的称号,只夸不损 */
export function endlessRank(score: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(score) ? score : 0));
  if (s >= 600) return "海沟传说";
  if (s >= 400) return "深水好手";
  if (s >= 250) return "老练钓手";
  if (s >= 120) return "熟练钓手";
  if (s >= 40) return "入门钓手";
  return "初次下竿";
}

// ---------------------------------------------------------------------------
// 图鉴存档
// ---------------------------------------------------------------------------

/** 把任意来源的图鉴存档整理成「认识的鱼 id,按图鉴顺序排好」 */
export function parseDex(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const known = new Set(FISH.map((f) => f.id));
  const seen = new Set<string>();
  for (const v of parsed as unknown[]) {
    if (typeof v === "string" && known.has(v)) seen.add(v);
  }
  return FISH.filter((f) => seen.has(f.id)).map((f) => f.id);
}

export function serializeDex(ids: readonly string[]): string {
  return JSON.stringify(parseDex(JSON.stringify(ids)));
}

/** 收录一条鱼(幂等),返回排好序的新数组 */
export function addToDex(ids: readonly string[], id: string): string[] {
  return parseDex(JSON.stringify([...ids, id]));
}

export interface DexProgress {
  found: number;
  total: number;
  /** 0..100 的整数 */
  percent: number;
}

export function dexProgress(ids: readonly string[]): DexProgress {
  const found = parseDex(JSON.stringify(ids)).length;
  const total = FISH.length;
  return { found, total, percent: Math.round((found / total) * 100) };
}

// ---------------------------------------------------------------------------
// 杂项
// ---------------------------------------------------------------------------

/** Esc 暂停(和其它几款保持一致) */
export function isPauseKey(code: string): boolean {
  return code === "Escape";
}

/** 空格 / 回车 = 抛竿与收线的键盘等价键 */
export function isActionKey(code: string): boolean {
  return code === "Space" || code === "Enter" || code === "NumpadEnter";
}

export function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return v < min ? min : v > max ? max : v;
}

function clampInt(v: number, min: number, max: number): number {
  return Math.round(clamp(v, min, max));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
