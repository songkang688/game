/**
 * 勇者小路 —— 188 关战役数据（纯函数 + 纯数据，不碰 DOM）。
 *
 * 八个主题章节，每章最后一关都有一位章节 Boss。每一关是一条小路：
 * 路上有小怪、宝箱、小店、休息点，中间还会分出岔路让你二选一。
 *
 * 所有关卡内容都由关号确定性生成，同一关每次进去布局都一样，方便记路也方便测试。
 */
import {
  type Element,
  type FighterSpec,
  type Fighter,
  makeFighter,
  mulberry32
} from "./combat";

export interface Chapter {
  name: string;
  emoji: string;
  color: string;
  desc: string;
  size: number;
}

/** 八个主题章节，关卡数之和恒等于 188 */
export const CHAPTERS: Chapter[] = [
  {
    name: "花瓣小径",
    emoji: "🌸",
    color: "#ffe3ef",
    desc: "第一章：学会看属性克制，草系小家伙最怕火苗。",
    size: 20
  },
  {
    name: "蘑菇林道",
    emoji: "🍄",
    color: "#e9f6dc",
    desc: "第二章：林子里开始出现会张护盾的家伙，记得带破盾招。",
    size: 22
  },
  {
    name: "水晶溪谷",
    emoji: "💧",
    color: "#ddf0ff",
    desc: "第三章：水边的对手速度飞快，先手权很重要。",
    size: 22
  },
  {
    name: "暖炉火山",
    emoji: "🔥",
    color: "#ffe1d3",
    desc: "第四章：火系的地盘，草系装备在这里会吃亏，换套再来。",
    size: 24
  },
  {
    name: "霜糖雪原",
    emoji: "❄️",
    color: "#e7f3ff",
    desc: "第五章：雪原上的对手很耐打，靠技能冷却排出连招才划算。",
    size: 24
  },
  {
    name: "云海天梯",
    emoji: "☁️",
    color: "#eef0ff",
    desc: "第六章：光系高手扎堆，暗系招式在这里格外好用。",
    size: 24
  },
  {
    name: "月影回廊",
    emoji: "🌙",
    color: "#e8e2f8",
    desc: "第七章：暗系回廊，Boss 的读条大招一次攒得比一次久，防御要按准。",
    size: 26
  },
  {
    name: "星辉之巅",
    emoji: "✨",
    color: "#fff3cf",
    desc: "第八章：五系混战的终点，弱点、护盾、大招全都要应付。",
    size: 26
  }
];

/** 各章节主属性（决定小怪的常见属性） */
export const CHAPTER_ELEMENTS: Element[][] = [
  ["grass", "grass", "water"],
  ["grass", "dark", "grass"],
  ["water", "water", "light"],
  ["fire", "fire", "dark"],
  ["water", "light", "water"],
  ["light", "light", "grass"],
  ["dark", "dark", "fire"],
  ["light", "dark", "fire", "water", "grass"]
];

/** 各章节小怪名字（全部原创，长得可爱、不吓人） */
const FOE_NAMES: string[][] = [
  ["蹦蹦草团", "绒绒花苞", "滚滚露珠"],
  ["圆帽小菌", "影子藤蔓", "跳跳孢子"],
  ["泡泡水母", "溪石小蟹", "亮闪水滴"],
  ["火星小炉", "咕噜岩块", "煤煤影团"],
  ["霜糖兔", "雪羽小鸟", "冰晶铃铛"],
  ["云朵羊", "光丝纸鸢", "藤蔓天梯"],
  ["月纱蝶", "影子提灯", "暖炉小灵"],
  ["星尘小鹿", "夜织蛛丝", "熔纹小蜥", "潮汐小螺", "苔绒小兽"]
];

const FOE_EMOJI: string[][] = [
  ["🌱", "🌼", "💦"],
  ["🍄", "🌿", "🍃"],
  ["🫧", "🦀", "💧"],
  ["🔥", "🪨", "🌑"],
  ["🐰", "🕊️", "🔔"],
  ["🐑", "🪁", "🌿"],
  ["🦋", "🏮", "🕯️"],
  ["🦌", "🕸️", "🦎", "🐚", "🧸"]
];

/** 每章 Boss（原创角色，全部是可爱形象，不流血不受伤，输了就是转圈圈让路） */
export interface BossInfo {
  name: string;
  emoji: string;
  element: Element;
  weakness: Element;
  chargeName: string;
  /** 一句话讲清楚这位 Boss 的机制，给孩子看的 */
  tip: string;
}

export const BOSSES: BossInfo[] = [
  {
    name: "卷卷藤王",
    emoji: "🌿",
    element: "grass",
    weakness: "fire",
    chargeName: "缠缠藤网",
    tip: "怕火。看到它举起藤蔓就是在读条，下个回合一定要防御。"
  },
  {
    name: "圆滚菌伞长",
    emoji: "🍄",
    element: "grass",
    weakness: "fire",
    chargeName: "孢子大喷",
    tip: "会定期张护盾。护盾没破之前，普通招式几乎都被弹开，带一招破盾的。"
  },
  {
    name: "泡泡水晶兽",
    emoji: "🫧",
    element: "water",
    weakness: "grass",
    chargeName: "浪花大卷",
    tip: "速度很快，多半抢先手。草系打它最管用，读条时记得防御。"
  },
  {
    name: "咕噜熔岩团",
    emoji: "🌋",
    element: "fire",
    weakness: "water",
    chargeName: "岩浆喷泉",
    tip: "又厚又硬。水系克它，护盾要用破盾招敲，大招前一定防御。"
  },
  {
    name: "霜糖雪貂",
    emoji: "❄️",
    element: "water",
    weakness: "grass",
    chargeName: "霜糖暴风",
    tip: "护盾张得勤，读条也快。破盾招和防御要交替着来。"
  },
  {
    name: "云海风鸢",
    emoji: "🪁",
    element: "light",
    weakness: "dark",
    chargeName: "长风一掠",
    tip: "光系高手，暗系招式打它加成很高。它读条的回合别硬扛。"
  },
  {
    name: "月影纱猫",
    emoji: "🐈‍⬛",
    element: "dark",
    weakness: "light",
    chargeName: "月纱缠绕",
    tip: "光系打它最管用。大招攒得很久，防御按准就没事。"
  },
  {
    name: "星辉巨像",
    emoji: "🗿",
    element: "light",
    weakness: "dark",
    chargeName: "星辉落下",
    tip: "护盾厚、大招重、还有弱点系。破盾、打弱点、按时防御，三件事都要做到。"
  }
];

// ---------------------------------------------------------------------------
// 章节工具
// ---------------------------------------------------------------------------

export const TOTAL_LEVELS = 188;

export function totalChapterSize(chapters: Chapter[] = CHAPTERS): number {
  return chapters.reduce((s, c) => s + c.size, 0);
}

export function chapterStart(ci: number, chapters: Chapter[] = CHAPTERS): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += chapters[i].size;
  return acc;
}

export function chapterOfLevel(level: number, chapters: Chapter[] = CHAPTERS): number {
  let acc = 0;
  for (let i = 0; i < chapters.length; i++) {
    acc += chapters[i].size;
    if (level < acc) return i;
  }
  return chapters.length - 1;
}

/** 这一关是不是某一章的最后一关（也就是 Boss 关） */
export function isBossLevel(level: number, chapters: Chapter[] = CHAPTERS): boolean {
  const ci = chapterOfLevel(level, chapters);
  return level === chapterStart(ci, chapters) + chapters[ci].size - 1;
}

/** 全部 Boss 关的关号（0 基），恰好每章一个 */
export function bossLevels(chapters: Chapter[] = CHAPTERS): number[] {
  return chapters.map((_, ci) => chapterStart(ci, chapters) + chapters[ci].size - 1);
}

// ---------------------------------------------------------------------------
// 难度基线：先算出「这一关应该有多强的勇者」，再按比例摆对手
// ---------------------------------------------------------------------------

export interface StatLine {
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
}

/** 第 level 关（0 基）设计时假定的勇者水平，配装到位大概就是这个数 */
export function expectedHero(level: number): StatLine {
  const t = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(level)));
  return {
    maxHp: Math.round(80 + t * 4),
    atk: Math.round(14 + t * 0.85),
    def: Math.round(5 + t * 0.42),
    spd: Math.round(11 + t * 0.1)
  };
}

export type FoeTier = "normal" | "elite" | "boss";

const TIER_MUL: Record<FoeTier, { hp: number; atk: number; def: number; spd: number }> = {
  normal: { hp: 0.42, atk: 0.68, def: 0.35, spd: 0.82 },
  elite: { hp: 0.62, atk: 0.76, def: 0.46, spd: 0.9 },
  boss: { hp: 2.4, atk: 0.76, def: 0.55, spd: 0.95 }
};

/**
 * Boss 的耐打程度还要按章节再抬一档：越往后的 Boss 越经打，
 * 不然一套克制连招三个回合就打完，读条和护盾根本来不及出场。
 */
function bossHpScale(level: number): number {
  return 1 + chapterOfLevel(level) * 0.03;
}

/** 第 level 关某档对手的基础数值 */
export function foeStats(level: number, tier: FoeTier): StatLine {
  const base = expectedHero(level);
  const m = TIER_MUL[tier];
  const hpScale = tier === "boss" ? bossHpScale(level) : 1;
  return {
    maxHp: Math.max(12, Math.round(base.maxHp * m.hp * hpScale)),
    atk: Math.max(4, Math.round(base.atk * m.atk)),
    def: Math.max(0, Math.round(base.def * m.def)),
    spd: Math.max(3, Math.round(base.spd * m.spd))
  };
}

/** 小怪会用的技能（越往后越会用招） */
function foeSkillsFor(level: number, tier: FoeTier, element: Element): Array<{ id: string; rank: number }> {
  const pool: Record<Element, string[]> = {
    fire: ["emberDance", "crackHammer"],
    water: ["dewSplash", "tideCall"],
    grass: ["gustStep", "petalSlash"],
    light: ["starPoke", "chimeBreak"],
    dark: ["moonVeil", "duskFang"]
  };
  const rank = Math.max(1, Math.min(5, 1 + Math.floor(level / 45)));
  if (tier === "boss") return pool[element].map((id) => ({ id, rank }));
  if (tier === "elite" || level >= 24) return [{ id: pool[element][0], rank }];
  return [];
}

/** 造一个普通 / 精英小怪的配置 */
export function makeFoeSpec(level: number, tier: FoeTier, seed: number): FighterSpec {
  const ci = chapterOfLevel(level);
  const rng = mulberry32(seed >>> 0);
  const names = FOE_NAMES[ci];
  const emojis = FOE_EMOJI[ci];
  const idx = Math.floor(rng() * names.length) % names.length;
  const elements = CHAPTER_ELEMENTS[ci];
  const element = elements[Math.floor(rng() * elements.length) % elements.length];
  const s = foeStats(level, tier);
  const prefix = tier === "elite" ? "强壮的" : "";
  return {
    name: `${prefix}${names[idx]}`,
    emoji: emojis[idx],
    element,
    maxHp: s.maxHp,
    atk: s.atk,
    def: s.def,
    spd: s.spd,
    crit: tier === "elite" ? 0.1 : 0.06,
    skills: foeSkillsFor(level, tier, element),
    weakness: null,
    isBoss: false
  };
}

/** 造一位章节 Boss（带弱点系 + 读条大招 + 定期护盾） */
export function makeBossSpec(level: number): FighterSpec {
  const ci = chapterOfLevel(level);
  const info = BOSSES[ci];
  const s = foeStats(level, "boss");
  // 越往后的章节，机制越密：读条更勤、护盾更厚
  // 第一章的 Boss 只教「读条要防御」这一件事，从第二章起才开始张护盾
  const chargeEvery = ci <= 1 ? 4 : 3;
  const shieldEvery = ci === 0 ? 0 : ci <= 3 ? 4 : 3;
  const shieldAmount = ci === 0 ? 0 : Math.round(s.maxHp * (0.1 + ci * 0.006));
  return {
    name: info.name,
    emoji: info.emoji,
    element: info.element,
    maxHp: s.maxHp,
    atk: s.atk,
    def: s.def,
    spd: s.spd,
    crit: 0.08,
    skills: foeSkillsFor(level, "boss", info.element),
    weakness: info.weakness,
    isBoss: true,
    boss: {
      chargeEvery,
      chargePower: 1.9 + ci * 0.06,
      chargeName: info.chargeName,
      shieldEvery,
      shieldAmount
    }
  };
}

export function buildFoe(spec: FighterSpec): Fighter {
  return makeFighter(spec);
}

// ---------------------------------------------------------------------------
// 一条小路：小怪 / 宝箱 / 小店 / 休息点 / 岔路
// ---------------------------------------------------------------------------

export type NodeKind = "foe" | "elite" | "chest" | "shop" | "rest" | "boss";

export interface PathNode {
  kind: NodeKind;
  /** 走到这一步时给孩子看的一句话 */
  label: string;
  emoji: string;
  /** foe / elite / boss 节点的对手配置 */
  foe?: FighterSpec;
  /** chest 节点给的金币 */
  coins?: number;
  /** chest 节点可能附带的道具 id */
  itemId?: string;
  /** shop 节点在卖的道具 id */
  stock?: string[];
  /** rest 节点恢复最大星芒的比例 */
  healRatio?: number;
}

export interface LevelPlan {
  /** 0 基关号 */
  level: number;
  chapterIndex: number;
  boss: boolean;
  /** 每一步 1–2 个选项，2 个就是岔路，二选一 */
  steps: PathNode[][];
  /** 这一关的目标说明 */
  goalText: string;
  reward: { coins: number; exp: number };
}

const CHEST_ITEMS = ["berry", "berry", "honey", "bell", "pepper", "hammer"];

function chestNode(level: number, rng: () => number): PathNode {
  const coins = Math.round((14 + level * 0.9) * (0.8 + rng() * 0.6));
  const withItem = rng() < 0.55;
  const itemId = withItem ? CHEST_ITEMS[Math.floor(rng() * CHEST_ITEMS.length) % CHEST_ITEMS.length] : undefined;
  return {
    kind: "chest",
    label: "路边的小宝箱",
    emoji: "🎁",
    coins,
    itemId
  };
}

function shopNode(level: number, rng: () => number): PathNode {
  const all = ["berry", "honey", "bell", "pepper", "hammer"];
  const n = 2 + Math.floor(rng() * 2);
  const stock: string[] = [];
  let cursor = Math.floor(rng() * all.length);
  while (stock.length < n) {
    const id = all[cursor % all.length];
    if (!stock.includes(id)) stock.push(id);
    cursor += 1;
  }
  return { kind: "shop", label: "糯糯的小摊", emoji: "🏪", stock };
}

function restNode(): PathNode {
  return { kind: "rest", label: "长满青苔的歇脚石", emoji: "🪵", healRatio: 0.3 };
}

/** Boss 门口的整装点：坐下来把星芒补满，谁都是满状态迎战首领 */
function bossRestNode(): PathNode {
  return { kind: "rest", label: "首领门前的整装石", emoji: "🪵", healRatio: 1 };
}

function foeNode(level: number, tier: "normal" | "elite", seed: number): PathNode {
  const spec = makeFoeSpec(level, tier, seed);
  return {
    kind: tier === "elite" ? "elite" : "foe",
    label: tier === "elite" ? `${spec.name}挡住了路` : `${spec.name}蹦了出来`,
    emoji: spec.emoji,
    foe: spec
  };
}

/** 这一关走几步（Boss 关多一步，留出补给的空间） */
export function stepCount(level: number): number {
  if (isBossLevel(level)) return 4;
  return 3 + (level % 3 === 2 ? 1 : 0);
}

/**
 * 一关里星芒是接着用的，中间不会自动回满。所以「连着两只精英」这种路
 * 对达标勇者来说是接不上的——第一只就要啃掉一半星芒。
 *
 * 这里补一道保险：两只精英之间必须隔着一处**人人都要经过**的歇脚石。
 * 优先把中间那步的宝箱/小摊换成歇脚石（路的长度不变，还多个补给点）；
 * 实在腾不出位置，就把后面那只精英降成普通小怪。
 */
function easeElitePileup(steps: PathNode[][], level: number): void {
  const isFight = (o: PathNode): boolean => o.kind === "foe" || o.kind === "elite" || o.kind === "boss";
  const hasRest = (): boolean => steps.some((opts) => opts.some((o) => o.kind === "rest"));

  /** 上一只精英之后，有没有一处人人必经的歇脚石 */
  let breathedAt = -1;
  let lastEliteAt = -1;

  for (let i = 0; i < steps.length; i++) {
    const opts = steps[i];
    if (opts.length > 0 && opts.every((o) => o.kind === "rest")) {
      breathedAt = i;
      continue;
    }
    if (!opts.some((o) => o.kind === "elite")) continue;

    if (lastEliteAt < 0 || breathedAt > lastEliteAt) {
      lastEliteAt = i;
      continue;
    }

    // 找上一只精英和这一只之间，一处没有架打的步骤，改成歇脚石
    let converted = -1;
    if (!hasRest()) {
      for (let j = lastEliteAt + 1; j < i; j++) {
        if (steps[j].some(isFight)) continue;
        steps[j] = [restNode()];
        converted = j;
        break;
      }
    }
    if (converted >= 0) {
      breathedAt = converted;
      lastEliteAt = i;
      continue;
    }
    for (let k = 0; k < opts.length; k++) {
      if (opts[k].kind === "elite") opts[k] = foeNode(level, "normal", (level + 1) * 7919 + i * 131 + k * 17 + 3);
    }
  }
}

/** 同一段里还夹着一场架时，这只精英少带一成的星芒上限与气势 */
export const CLIMAX_EASE = 0.9;

/** 夹着两场以上时松得多一点——那是一条真正的车轮路 */
export const DEEP_EASE = 0.85;

/**
 * 一段路里除了这只精英还有别的架要打——这只精英松一成。
 *
 * 精英的数值是照「满状态迎战、打完就歇」配的（首领关索性在门口摆整装石，
 * 就是这个道理）。可普通关没有整装石，同一段歇脚石之间往往还塞着别的架，
 * 那些消耗全要算在这只精英头上——不管它排在前面还是后面。
 *
 * 第 2 轮先只管了「收尾那只」（第 135 / 138 / 139 / 153 / 155 关卡在那儿）。
 * 第 3 轮把尺子从 6 个种子加长到 40 个之后，露出了另一种形状：
 * 精英排在半路，后面还接着一两场小怪，中间没有歇脚石——
 * 第 121 关是「小怪 → 精英 → 小怪」，第 124 / 140 / 185 关是「精英 → 小怪 → 小怪」。
 * 这类关的通关率停在 93%~98%，见 W4A-17。
 *
 * 两种形状其实是同一件事：**这只精英不是单独打的**。所以判据统一成
 * 「同一段歇脚石之间还有没有别的架」，前后都算，松的幅度还是那一成。
 * 单独打的精英（一路全是宝箱，或者刚在歇脚石上坐过、打完又是歇脚石）不松——
 * 那种情况本来就是照满状态配的。
 */
function easeWornElite(steps: PathNode[][]): void {
  const isRest = (opts: PathNode[]): boolean => opts.length > 0 && opts.every((o) => o.kind === "rest");
  const isFight = (opts: PathNode[]): boolean =>
    opts.some((o) => o.kind === "foe" || o.kind === "elite" || o.kind === "boss");

  const last = steps.length - 1;
  for (let i = 0; i <= last; i++) {
    if (!steps[i].some((o) => o.kind === "elite")) continue;

    // 这一段（上一处歇脚石之后到下一处歇脚石之前）里，除了它还有几场架
    let others = 0;
    for (let j = i - 1; j >= 0 && !isRest(steps[j]); j--) if (isFight(steps[j])) others++;
    for (let j = i + 1; j <= last && !isRest(steps[j]); j++) if (isFight(steps[j])) others++;
    if (others < 1) continue;
    const ease = others >= 2 ? DEEP_EASE : CLIMAX_EASE;

    for (let k = 0; k < steps[i].length; k++) {
      const n = steps[i][k];
      if (n.kind !== "elite" || !n.foe) continue;
      steps[i][k] = {
        ...n,
        foe: {
          ...n.foe,
          maxHp: Math.round(n.foe.maxHp * ease),
          atk: Math.round(n.foe.atk * ease)
        }
      };
    }
  }
}

/**
 * 整关一处歇脚都没有、却要连打三场以上——在岔路上摆一块歇脚石。
 *
 * 第 140 / 177 关就是这个形状：三四场架一路打到底，中间没有任何补给。
 * 三组各 100 个种子的走查里，第 140 关是唯一一关在三组里全都掉到 95% 以下的
 * （92%~95%），它的路是「精英 → 小怪 → 小怪」，而且小怪的气势（90）
 * 比松过一档的精英（85）还高——一路硬扛没有任何回气的机会。
 *
 * 这里不再往下削数值（削到最后精英就不是精英了），而是**给一个选择**：
 * 把岔路里的一条支线换成歇脚石。要打的那一条一场没少，孩子可以硬闯拿全程，
 * 也可以先坐下来回口气。「什么时候该歇」本来就是这一关最该学会的事。
 *
 * 歇脚石摆在岔路的最后一条，前面那条仍旧是架——所以「一路硬闯」这条最难的
 * 走法还在，走查量的仍是下限。整关只补这一块，跟「一关最多一个休息点」不冲突。
 */
function offerBreather(steps: PathNode[][]): void {
  const isFight = (o: PathNode): boolean => o.kind === "foe" || o.kind === "elite" || o.kind === "boss";
  if (steps.some((opts) => opts.some((o) => o.kind === "rest"))) return;
  if (steps.filter((opts) => opts.some(isFight)).length < 3) return;

  for (let i = 1; i < steps.length - 1; i++) {
    const opts = steps[i];
    if (opts.length < 2) continue;
    // 从后往前找一条普通小怪的支线换掉，且换完至少还留着一条要打的
    for (let k = opts.length - 1; k >= 1; k--) {
      if (opts[k].kind !== "foe") continue;
      if (!opts.some((o, j) => j !== k && isFight(o))) continue;
      opts[k] = restNode();
      return;
    }
  }
}

/**
 * 生成第 level 关（0 基）的完整小路。同一关号永远得到同一条路。
 */
export function buildLevel(level: number): LevelPlan {
  const lv = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(level)));
  const ci = chapterOfLevel(lv);
  const boss = isBossLevel(lv);
  const rng = mulberry32((lv + 1) * 2654435761);
  const steps: PathNode[][] = [];
  const n = stepCount(lv);
  let shopUsed = false;
  let restUsed = false;

  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    if (last && boss) {
      const spec = makeBossSpec(lv);
      steps.push([{ kind: "boss", label: `${spec.name}守在小路尽头`, emoji: spec.emoji, foe: spec }]);
      break;
    }
    // 岔路：中间的步骤有一半机会分成两条
    const fork = i > 0 && !last && rng() < 0.62;
    const options: PathNode[] = [];
    const optionCount = fork ? 2 : 1;
    for (let k = 0; k < optionCount; k++) {
      const roll = rng();
      const seed = (lv + 1) * 7919 + i * 131 + k * 17;
      if (!last && !shopUsed && roll < 0.14 && i >= 1) {
        shopUsed = true;
        options.push(shopNode(lv, rng));
      } else if (!last && !restUsed && roll < 0.26 && i >= 1) {
        restUsed = true;
        options.push(restNode());
      } else if (roll < 0.44) {
        options.push(chestNode(lv, rng));
      } else if (roll < 0.58 && lv >= 6) {
        options.push(foeNode(lv, "elite", seed));
      } else {
        options.push(foeNode(lv, "normal", seed));
      }
    }
    // 至少要有一步能打到人，纯拿宝箱的关卡就没意思了
    steps.push(options);
  }

  if (!boss && !steps.some((opts) => opts.some((o) => o.kind === "foe" || o.kind === "elite"))) {
    steps[steps.length - 1] = [foeNode(lv, "normal", (lv + 1) * 104729)];
  }
  if (!boss) {
    const lastOpts = steps[steps.length - 1];
    if (!lastOpts.some((o) => o.kind === "foe" || o.kind === "elite")) {
      lastOpts[0] = foeNode(lv, "elite", (lv + 1) * 15485863);
    }
  }
  easeElitePileup(steps, lv);
  if (!boss) {
    easeWornElite(steps);
    offerBreather(steps);
  }

  // Boss 关：门口固定摆一块整装石。首领的数值本来就是照「满状态迎战」配的，
  // 不能让前面几步的消耗把这场硬仗变成硬撑。
  if (boss && steps.length >= 2) {
    const gate = steps.length - 2;
    for (let i = 0; i < steps.length; i++) {
      if (i === gate) continue;
      steps[i] = steps[i].map((o) => (o.kind === "rest" ? chestNode(lv, mulberry32((lv + 1) * 22801 + i)) : o));
    }
    steps[gate] = [bossRestNode()];
  }

  return {
    level: lv,
    chapterIndex: ci,
    boss,
    steps,
    goalText: boss
      ? `走到小路尽头，稳住阵脚战胜${BOSSES[ci].name}。`
      : "沿着小路一直往前走，遇到什么就应付什么，走到头就过关。",
    reward: {
      coins: Math.round((boss ? 60 : 22) + lv * (boss ? 2.4 : 1.1)),
      exp: Math.round((boss ? 60 : 22) + lv * 1.2)
    }
  };
}

/** 关卡评星：走完全程剩下的星芒越多，星星越多 */
export function rateByHp(ratio: number): 1 | 2 | 3 {
  if (!Number.isFinite(ratio)) return 1;
  if (ratio >= 0.7) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}

/** 章节小抄：进关前给一句「这一章该注意什么」 */
export function chapterHint(ci: number): string {
  const c = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, ci))];
  return `${c.emoji} ${c.name} —— ${c.desc}`;
}
