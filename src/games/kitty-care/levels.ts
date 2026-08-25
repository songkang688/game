/**
 * 萌猫小屋 · 99 关关卡表。
 * 六个成长主题章节，五种照顾任务组合（并非同一模板）：
 *  ①春日小奶猫=喂饭+逗猫  ②夏日玩水=洗澡登场  ③秋日野餐=打扮登场
 *  ④冬日暖炉=哄睡摇篮曲  ⑤生日派对=四任务连做  ⑥梦幻旅行=五任务终极照顾
 * 每关由确定性生成器排出任务清单，同一关每次进入一致。
 */
import { mulberry32, pick, type Chapter } from "../level99";

export type KittyTask = "feed" | "play" | "wash" | "sleep" | "dress";

export interface KittyLevel {
  /** 本关要完成的任务清单（2..4 个） */
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
}

export const CHAPTERS: Chapter[] = [
  { name: "春日小奶猫", emoji: "🌸", color: "#FFE3EC", desc: "喂团团吃饭、陪它玩毛线球！", size: 17 },
  { name: "夏日玩水", emoji: "🌊", color: "#D6F0FF", desc: "天热啦，给团团搓泡泡洗香香！", size: 17 },
  { name: "秋日野餐", emoji: "🍂", color: "#FFE9D0", desc: "挑对团团想要的打扮去野餐！", size: 17 },
  { name: "冬日暖炉", emoji: "❄️", color: "#E4EEFA", desc: "跟着音符弹摇篮曲，哄团团睡觉！", size: 16 },
  { name: "生日派对", emoji: "🎂", color: "#F3E0FA", desc: "派对日程满满，四个任务连着做！", size: 16 },
  { name: "梦幻旅行", emoji: "🌙", color: "#E3DFF5", desc: "带团团去旅行，五种照顾全用上！", size: 16 }
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

export const LEVELS: KittyLevel[] = (() => {
  const out: KittyLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) {
      out.push(buildLevel(ci, t, mulberry32(ci * 777 + t * 17 + 5)));
    }
  });
  return out;
})();
