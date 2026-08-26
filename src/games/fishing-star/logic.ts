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

/** 图鉴存档 key:和 l99 星级存档、平台钱包互不影响 */
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

/** 张力到这里线就断了 */
export const SNAP_AT = 1;
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

export interface FightParams {
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
export function fightParams(fish: Fish, hardness = 0): FightParams {
  const h = clamp(hardness, 0, 1);
  const pull = round3(fish.pull * (0.85 + h * 0.45));
  return {
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
  status: FightStatus;
}

export function newFight(tension: number = START_TENSION): FightState {
  return {
    tension: clamp(tension, 0, 1),
    progress: 0,
    slackMs: 0,
    elapsedMs: 0,
    perfectMs: 0,
    status: "fighting",
  };
}

/**
 * 鱼的挣扎波形:0..1 的正弦,平均 0.5。
 * 用累计时长算,不看真实时钟,所以同一串输入重放出来一模一样。
 */
export function struggle(elapsedMs: number, surgeMs: number): number {
  const cycle = surgeMs > 0 ? surgeMs : 800;
  const t = (Number.isFinite(elapsedMs) ? elapsedMs : 0) / cycle;
  return 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
}

/** 一帧最多按多少毫秒结算:切后台回来时不会一下子把线崩断 */
export const MAX_STEP_MS = 120;

/**
 * 拉扯的一帧:上一帧状态 + 这一帧有没有按住收线 → 下一帧状态。
 *
 * 判定顺序是「先断线、再跑鱼、最后收竿」:
 * 张力冲到 1 的那一帧哪怕进度也满了,也算断线,免得出现「崩着线也能赢」的侥幸。
 */
export function stepFight(state: FightState, p: FightParams, reeling: boolean, dtMs: number): FightState {
  if (state.status !== "fighting") return state;
  const ms = clamp(Number.isFinite(dtMs) ? dtMs : 0, 0, MAX_STEP_MS);
  const dt = ms / 1000;
  const surge = struggle(state.elapsedMs, p.surgeMs);

  const tension = clamp(state.tension + (reeling ? p.reel : -p.ease) * dt + p.pull * surge * dt, 0, 1.4);
  const zone = tensionZone(tension);
  const progress = clamp(
    state.progress + (reeling ? p.gain * zoneGain(zone) : -p.slip) * dt,
    0,
    1
  );
  const slackMs = zone === "slack" ? state.slackMs + ms : 0;
  const perfectMs = zone === "good" ? state.perfectMs + ms : state.perfectMs;
  const elapsedMs = state.elapsedMs + ms;

  let status: FightStatus = "fighting";
  if (tension >= SNAP_AT) status = "snapped";
  else if (slackMs >= p.escapeMs) status = "escaped";
  else if (progress >= 1) status = "landed";

  return { tension, progress, slackMs, elapsedMs, perfectMs, status };
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
