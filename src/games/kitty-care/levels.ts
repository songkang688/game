/**
 * 萌猫小屋 · 188 关关卡表。
 * 前 99 关是 1.0 的六个成长主题，生成参数一个字都没动；
 * 1.1 在末尾追加四个新主题（第 100–188 关）：
 *  ⑦双猫客厅=同时照顾两三只猫  ⑧心情小屋=心情值会涨会掉
 *  ⑨暖心诊所=按症状一步步看病  ⑩时装小舞台=按主题搭配并评分
 * 1.0 的六个主题章节、五种照顾任务组合（并非同一模板）：
 *  ①春日小奶猫=喂饭+逗猫  ②夏日玩水=洗澡登场  ③秋日野餐=打扮登场
 *  ④冬日暖炉=哄睡摇篮曲  ⑤生日派对=四任务连做  ⑥梦幻旅行=五任务终极照顾
 * 每关由确定性生成器排出任务清单，同一关每次进入一致。
 */
import { mulberry32, pick, shuffled, type Chapter } from "../level99";

/** 1.1 新增 "cure"（看病）与 "style"（搭配评分）两种任务 */
export type KittyTask = "feed" | "play" | "wash" | "sleep" | "dress" | "cure" | "style";

/** 1.0 的六个成长主题：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新主题从这里开始往后排） */
export const LEGACY_LEVELS = 99;

export interface KittyLevel {
  /** 本关要完成的任务清单（2..5 个） */
  tasks: KittyTask[];
  /** 逗猫要拍到玩具几次 */
  playTaps: number;
  /** 洗澡要擦掉几个泡泡 */
  washSpots: number;
  /** 喂饭 / 打扮的选项数 */
  options: number;
  /** 摇篮曲音符数 */
  notes: number;
  theme: number;
  /** 1.1 同屋要照顾的猫数（2..3），前 99 关不带 */
  cats?: number;
  /** 1.1 心情值起点，掉到 0 本关就要重来，前 99 关不带 */
  moodStart?: number;
  /** 1.1 心情值上限，前 99 关不带 */
  moodMax?: number;
  /** 1.1 看病要走几个步骤（2..4），前 99 关不带 */
  cureSteps?: number;
  /** 1.1 搭配要挑几件（2..4），前 99 关不带 */
  styleSlots?: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "春日小奶猫", emoji: "🌸", color: "#FFE3EC", desc: "喂团团吃饭、陪它玩毛线球！", size: 17 },
  { name: "夏日玩水", emoji: "🌊", color: "#D6F0FF", desc: "天热啦，给团团搓泡泡洗香香！", size: 17 },
  { name: "秋日野餐", emoji: "🍂", color: "#FFE9D0", desc: "挑对团团想要的打扮去野餐！", size: 17 },
  { name: "冬日暖炉", emoji: "❄️", color: "#E4EEFA", desc: "跟着音符弹摇篮曲，哄团团睡觉！", size: 16 },
  { name: "生日派对", emoji: "🎂", color: "#F3E0FA", desc: "派对日程满满，四个任务连着做！", size: 16 },
  { name: "梦幻旅行", emoji: "🌙", color: "#E3DFF5", desc: "带团团去旅行，五种照顾全用上！", size: 16 },
  // ↓ 1.1 追加：四个新主题，合计 89 关
  { name: "双猫客厅", emoji: "🐾", color: "#FFEFD9", desc: "团团带来了新室友，两三只猫要一起照顾！", size: 23 },
  { name: "心情小屋", emoji: "💗", color: "#FFE1EE", desc: "心情条会涨也会掉，掉光了今天就得重来。", size: 22 },
  { name: "暖心诊所", emoji: "🩺", color: "#DFF2EA", desc: "看清症状，按顺序把该做的护理一步步做完。", size: 22 },
  { name: "时装小舞台", emoji: "👗", color: "#EDE2FF", desc: "照着当天的主题搭一整套，搭得越准评分越高。", size: 22 }
];

/** 各章可用的任务池 */
const TASK_POOLS: KittyTask[][] = [
  ["feed", "play"],
  ["wash", "feed", "play"],
  ["feed", "dress", "play"],
  ["sleep", "dress", "feed"],
  ["dress", "play", "feed", "wash"],
  ["feed", "play", "wash", "sleep", "dress"]
];

function buildLevel(ci: number, t: number, rand: () => number): KittyLevel {
  const pool = TASK_POOLS[ci];
  const count = ci <= 1 ? 2 : ci <= 3 ? 3 : t < 8 ? 3 : 4;
  const tasks: KittyTask[] = [];
  // 章节首关固定从池子开头排（教学感），之后随机组合但保证不连续重复
  for (let i = 0; i < count; i++) {
    let task = t === 0 ? pool[i % pool.length] : pick(rand, pool);
    let guard = 0;
    while (tasks.length > 0 && task === tasks[tasks.length - 1] && guard++ < 10) {
      task = pick(rand, pool);
    }
    tasks.push(task);
  }
  return {
    tasks,
    playTaps: 3 + Math.floor(t / 4) + ci,
    washSpots: 3 + Math.floor(t / 5) + Math.floor(ci / 2),
    options: t < 8 ? 3 : 4,
    notes: Math.min(5, 3 + Math.floor(t / 7) + (ci >= 5 ? 1 : 0)),
    theme: ci
  };
}

// ---------------------------------------------------------------------------
// 1.1 新主题的关卡生成
// ---------------------------------------------------------------------------

/** 1.1 四个新章的任务池：每章都保证带上自己的招牌任务 */
const NEW_TASK_POOLS: KittyTask[][] = [
  ["feed", "play", "wash", "dress"],
  ["feed", "play", "wash", "sleep", "dress"],
  ["cure", "feed", "sleep", "wash"],
  ["style", "dress", "play", "feed"]
];

/** 每章必须出现的招牌任务（第 7、8 章靠机制区分，所以不强制某个任务） */
const SIGNATURE_TASK: Array<KittyTask | null> = [null, null, "cure", "style"];

/** 排一串不连续重复、且必定含招牌任务的清单 */
function pickTasks(pool: KittyTask[], count: number, must: KittyTask | null, rand: () => number): KittyTask[] {
  const tasks: KittyTask[] = [];
  for (let i = 0; i < count; i++) {
    let task = pick(rand, pool);
    let guard = 0;
    while (tasks.length > 0 && task === tasks[tasks.length - 1] && guard++ < 12) {
      task = pick(rand, pool);
    }
    tasks.push(task);
  }
  if (must && !tasks.includes(must)) tasks[Math.floor(rand() * tasks.length)] = must;
  return tasks;
}

function buildNewLevel(ni: number, t: number, rand: () => number): KittyLevel {
  const ci = LEGACY_CHAPTER_SIZES.length + ni;
  const count = ni === 0 ? (t < 10 ? 3 : 4) : ni === 1 ? (t < 8 ? 3 : 4) : t < 11 ? 3 : 4;
  const tasks = pickTasks(NEW_TASK_POOLS[ni], count, SIGNATURE_TASK[ni], rand);
  const base: KittyLevel = {
    tasks,
    playTaps: 4 + Math.floor(t / 5) + ni,
    washSpots: 4 + Math.floor(t / 6) + Math.floor(ni / 2),
    options: t < 6 ? 3 : t < 15 ? 4 : 5,
    notes: Math.min(6, 4 + Math.floor(t / 9)),
    theme: ci
  };
  switch (ni) {
    case 0:
      // 双猫客厅：两只猫轮流提要求，后半章第三只猫也搬进来
      return { ...base, cats: t < 12 ? 2 : 3 };
    case 1:
      // 心情小屋：心情条起点越来越低，容错一路收紧
      return { ...base, moodStart: Math.max(5, 9 - Math.floor(t / 4)), moodMax: 10, cats: t >= 14 ? 2 : undefined };
    case 2:
      // 暖心诊所：护理步骤从 2 步涨到 4 步
      return { ...base, cureSteps: Math.min(4, 2 + Math.floor(t / 8)), moodStart: t >= 12 ? 8 : undefined, moodMax: t >= 12 ? 10 : undefined };
    default:
      // 时装小舞台：搭配件数变多，末段把多猫与心情条一起请回来
      return {
        ...base,
        styleSlots: Math.min(4, 2 + Math.floor(t / 8)),
        cats: t >= 12 ? 2 : undefined,
        moodStart: t >= 17 ? 7 : undefined,
        moodMax: t >= 17 ? 10 : undefined
      };
  }
}

export const LEVELS: KittyLevel[] = (() => {
  const out: KittyLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) {
      if (ci < LEGACY_CHAPTER_SIZES.length) {
        out.push(buildLevel(ci, t, mulberry32(ci * 777 + t * 17 + 5)));
      } else {
        out.push(buildNewLevel(ci - LEGACY_CHAPTER_SIZES.length, t, mulberry32(ci * 777 + t * 17 + 5)));
      }
    }
  });
  return out;
})();

// ---------------------------------------------------------------------------
// 1.1 机制一：多只猫同时照顾
// ---------------------------------------------------------------------------

/** 同屋小猫的名字与毛色（原创角色，不借用任何现成形象） */
export const CAT_CREW = [
  { name: "团团", coat: "#f7b357", line: "#e08a2e", ear: "#ffc9d4", belly: "#fff3dd", paw: "#f9c477" },
  { name: "糯糯", coat: "#e6ddf2", line: "#b3a3d2", ear: "#f4d3e6", belly: "#fffaff", paw: "#d9cdeb" },
  { name: "煤球", coat: "#9b95b3", line: "#736b90", ear: "#cfc7e2", belly: "#f0edf7", paw: "#b7b0cb" }
] as const;

/** 第 i 个任务交给第几只猫（轮流来，谁也不会被冷落） */
export function catForTask(taskIndex: number, cats: number): number {
  const n = Math.max(1, Math.min(CAT_CREW.length, Math.floor(cats)));
  return ((taskIndex % n) + n) % n;
}

// ---------------------------------------------------------------------------
// 1.1 机制二：心情值系统
// ---------------------------------------------------------------------------

/** 心情事件：做完一件事 +1，做错一次 -2，安抚一次 +2（都夹在 0..max 之间） */
export type MoodEvent = "done" | "miss" | "soothe";

export function moodAfter(mood: number, event: MoodEvent, max: number): number {
  const delta = event === "done" ? 1 : event === "soothe" ? 2 : -2;
  return Math.max(0, Math.min(max, mood + delta));
}

/** 心情条上的表情：越满越开心，从不出现责备的脸 */
export function moodFace(mood: number, max: number): string {
  const r = max > 0 ? mood / max : 0;
  if (r >= 0.8) return "😻";
  if (r >= 0.55) return "😺";
  if (r >= 0.3) return "😿";
  return "🙀";
}

/** 起点 start、一次不错的完美通关，心情条永远不会掉到 0（可解性用） */
export function moodSurvivesPerfectRun(start: number, tasks: number, max: number): boolean {
  let mood = start;
  for (let i = 0; i < tasks; i++) mood = moodAfter(mood, "done", max);
  return mood > 0;
}

/** 起点 start 时最多能扛几次失误（掉到 0 才算撑不住） */
export function moodMistakeBudget(start: number, max: number): number {
  let mood = start;
  let n = 0;
  while (mood > 0) {
    mood = moodAfter(mood, "miss", max);
    if (mood <= 0) break;
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// 1.1 机制三：生病与看病
// ---------------------------------------------------------------------------

export interface CureTool {
  emoji: string;
  name: string;
}

/** 诊所里的护理用品（也当作错误选项的干扰项） */
export const CURE_TOOLS: CureTool[] = [
  { emoji: "🌡️", name: "体温计" },
  { emoji: "💧", name: "温水" },
  { emoji: "💊", name: "小药丸" },
  { emoji: "🧣", name: "小毯子" },
  { emoji: "🧴", name: "药水" },
  { emoji: "🩹", name: "创可贴" },
  { emoji: "🧻", name: "纸巾" },
  { emoji: "🩺", name: "听诊器" }
];

export interface Symptom {
  name: string;
  emoji: string;
  /** 正确的护理顺序（按名字引用 CURE_TOOLS） */
  order: string[];
}

/** 五种小毛病，各有各的护理顺序（顺序不同，才不是同一个模板） */
export const SYMPTOMS: Symptom[] = [
  { name: "有点发烧", emoji: "🥵", order: ["体温计", "温水", "小药丸", "小毯子"] },
  { name: "一直打喷嚏", emoji: "🤧", order: ["纸巾", "温水", "小毯子", "小药丸"] },
  { name: "爪子擦破皮", emoji: "🐾", order: ["药水", "创可贴", "温水", "小毯子"] },
  { name: "肚子不舒服", emoji: "😿", order: ["听诊器", "温水", "小药丸", "小毯子"] },
  { name: "咳嗽个不停", emoji: "😷", order: ["听诊器", "温水", "纸巾", "小药丸"] }
];

export interface CureStep {
  /** 这一步该用的护理用品 */
  answer: CureTool;
  /** 摆在孩子面前的选项（含且只含一个正确答案） */
  options: CureTool[];
}

export interface CureRound {
  symptom: Symptom;
  steps: CureStep[];
}

/** 排一次看病流程：症状固定顺序，每步的选项随机打乱但答案唯一 */
export function buildCureRound(seed: number, stepCount: number, optionCount: number): CureRound {
  const rand = mulberry32(seed);
  const symptom = SYMPTOMS[Math.floor(rand() * SYMPTOMS.length)];
  const steps = Math.max(1, Math.min(symptom.order.length, Math.floor(stepCount)));
  const opts = Math.max(2, Math.min(CURE_TOOLS.length, Math.floor(optionCount)));
  const byName = (name: string): CureTool => CURE_TOOLS.find((tool) => tool.name === name) ?? CURE_TOOLS[0];
  return {
    symptom,
    steps: symptom.order.slice(0, steps).map((name, i) => {
      const answer = byName(name);
      const others = shuffled(
        CURE_TOOLS.filter((tool) => tool.name !== name),
        mulberry32(seed * 31 + i * 7 + 3)
      ).slice(0, opts - 1);
      return { answer, options: shuffled([answer, ...others], mulberry32(seed * 53 + i * 11 + 1)) };
    })
  };
}

// ---------------------------------------------------------------------------
// 1.1 机制四：装扮搭配评分
// ---------------------------------------------------------------------------

/** 五个搭配主题（当天要去哪儿，就照着搭） */
export const STYLE_THEMES = ["夏日海边", "冬日雪天", "生日派对", "森林野餐", "星空晚会"] as const;
export type StyleTheme = (typeof STYLE_THEMES)[number];

export interface StyleItem {
  emoji: string;
  name: string;
  /** 属于哪个主题；null 表示怎么搭都不出错的百搭款 */
  theme: StyleTheme | null;
}

/** 四个搭配部位，各有五件主题款 + 一件百搭款 */
export const STYLE_WARDROBE: Array<{ slot: string; items: StyleItem[] }> = [
  {
    slot: "帽子",
    items: [
      { emoji: "👒", name: "遮阳帽", theme: "夏日海边" },
      { emoji: "🧶", name: "毛线帽", theme: "冬日雪天" },
      { emoji: "🎩", name: "小礼帽", theme: "生日派对" },
      { emoji: "🧢", name: "鸭舌帽", theme: "森林野餐" },
      { emoji: "👑", name: "小皇冠", theme: "星空晚会" },
      { emoji: "🎀", name: "蝴蝶结", theme: null }
    ]
  },
  {
    slot: "围脖",
    items: [
      { emoji: "🐚", name: "贝壳项链", theme: "夏日海边" },
      { emoji: "🧣", name: "厚围巾", theme: "冬日雪天" },
      { emoji: "🎉", name: "彩带领结", theme: "生日派对" },
      { emoji: "🍀", name: "三叶草挂坠", theme: "森林野餐" },
      { emoji: "⭐", name: "星星项链", theme: "星空晚会" },
      { emoji: "🔔", name: "小铃铛", theme: null }
    ]
  },
  {
    slot: "小包",
    items: [
      { emoji: "🧺", name: "沙滩篮", theme: "夏日海边" },
      { emoji: "🎒", name: "绒面背包", theme: "冬日雪天" },
      { emoji: "🎁", name: "礼物袋", theme: "生日派对" },
      { emoji: "🍄", name: "蘑菇小包", theme: "森林野餐" },
      { emoji: "🌙", name: "月亮小包", theme: "星空晚会" },
      { emoji: "👜", name: "小手袋", theme: null }
    ]
  },
  {
    slot: "鞋子",
    items: [
      { emoji: "🩴", name: "沙滩拖鞋", theme: "夏日海边" },
      { emoji: "🥾", name: "雪地靴", theme: "冬日雪天" },
      { emoji: "👞", name: "亮皮鞋", theme: "生日派对" },
      { emoji: "👟", name: "运动鞋", theme: "森林野餐" },
      { emoji: "🥿", name: "星光软鞋", theme: "星空晚会" },
      { emoji: "🧦", name: "厚棉袜", theme: null }
    ]
  }
];

export interface StyleSlot {
  slot: string;
  options: StyleItem[];
}

export interface StyleRound {
  theme: StyleTheme;
  slots: StyleSlot[];
  /** 全部选中最搭的那件时的满分 */
  maxScore: number;
}

/** 一件搭配的得分：最搭 2 分，百搭 1 分，不搭 0 分 */
export function styleItemScore(item: StyleItem, theme: StyleTheme): number {
  if (item.theme === theme) return 2;
  if (item.theme === null) return 1;
  return 0;
}

/** 一整套搭配的总分 */
export function styleScore(picks: StyleItem[], theme: StyleTheme): number {
  return picks.reduce((s, item) => s + styleItemScore(item, theme), 0);
}

/** 评分档位：满分「超搭」，过半「好看」，其余「有点乱」（都不批评人） */
export function styleGrade(score: number, maxScore: number): { label: string; stars: 1 | 2 | 3 } {
  if (maxScore <= 0) return { label: "好看", stars: 2 };
  const r = score / maxScore;
  if (r >= 1) return { label: "超搭", stars: 3 };
  if (r >= 0.6) return { label: "好看", stars: 2 };
  return { label: "有点乱", stars: 1 };
}

/**
 * 排一次搭配任务：抽一个主题、抽 slots 个部位，
 * 每个部位的选项里保证「恰好一件最搭 + 恰好一件百搭 + 若干不搭」。
 */
export function buildStyleRound(seed: number, slotCount: number, optionCount: number): StyleRound {
  const rand = mulberry32(seed);
  const theme = STYLE_THEMES[Math.floor(rand() * STYLE_THEMES.length)];
  const n = Math.max(1, Math.min(STYLE_WARDROBE.length, Math.floor(slotCount)));
  const opts = Math.max(2, Math.min(6, Math.floor(optionCount)));
  const chosen = shuffled(STYLE_WARDROBE, mulberry32(seed * 13 + 7)).slice(0, n);
  return {
    theme,
    maxScore: n * 2,
    slots: chosen.map((entry, i) => {
      const best = entry.items.find((item) => item.theme === theme) ?? entry.items[0];
      const neutral = entry.items.find((item) => item.theme === null) ?? entry.items[entry.items.length - 1];
      const rest = shuffled(
        entry.items.filter((item) => item !== best && item !== neutral),
        mulberry32(seed * 29 + i * 5 + 2)
      ).slice(0, Math.max(0, opts - 2));
      return {
        slot: entry.slot,
        options: shuffled([best, neutral, ...rest], mulberry32(seed * 41 + i * 3 + 9))
      };
    })
  };
}

/** 本关看病 / 搭配用的随机种子（同一关每次进入完全一致） */
export function roundSeed(level: number, taskIndex: number): number {
  return level * 131 + taskIndex * 17 + 23;
}
