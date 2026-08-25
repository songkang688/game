// 涂色小屋：99 关 · 六大村镇章节关卡生成（指令涂色 / 调色锅 / 数字涂色 / 记忆涂色）
import { chapterOf, indexInChapter, mulberry32, pick, shuffled, type Chapter } from "../level99";

export const CHAPTERS: Chapter[] = [
  { name: "温馨小屋村", emoji: "🏠", color: "#ffe8cc", desc: "按小指令给小屋涂颜色", size: 17 },
  { name: "快乐农场镇", emoji: "🚜", color: "#d3f9d8", desc: "颜色更多，指令更长", size: 17 },
  { name: "海底调色湾", emoji: "🐠", color: "#d0f0fd", desc: "要用调色锅调出新颜色", size: 17 },
  { name: "夜空数字园", emoji: "🌙", color: "#e5dbff", desc: "看数字涂颜色", size: 16 },
  { name: "彩虹深色坡", emoji: "🌈", color: "#fff3bf", desc: "深红金黄深蓝也要调", size: 16 },
  { name: "星光记忆城", emoji: "🚀", color: "#ffdeeb", desc: "先记住样子，再凭记忆涂", size: 16 },
];

export interface Region {
  id: string;
  name: string;
  svg: string;
  /** 数字标签摆放位置（viewBox 坐标） */
  lx: number;
  ly: number;
}

export interface Picture {
  name: string;
  emoji: string;
  regions: Region[];
}

/** 六幅线稿，每章一幅 */
export const PICTURES: Picture[] = [
  {
    name: "温馨小屋",
    emoji: "🏠",
    regions: [
      { id: "grass", name: "草地", svg: `<rect x="0" y="230" width="400" height="70" rx="6"/>`, lx: 40, ly: 268 },
      { id: "wall", name: "墙壁", svg: `<rect x="70" y="130" width="150" height="100"/>`, lx: 100, ly: 210 },
      { id: "roof", name: "屋顶", svg: `<polygon points="60,132 230,132 145,60"/>`, lx: 145, ly: 112 },
      { id: "door", name: "小门", svg: `<rect x="125" y="168" width="42" height="62" rx="6"/>`, lx: 146, ly: 202 },
      { id: "window", name: "窗户", svg: `<circle cx="100" cy="160" r="17"/>`, lx: 100, ly: 165 },
      { id: "sun", name: "太阳", svg: `<circle cx="330" cy="60" r="30"/>`, lx: 330, ly: 66 },
      { id: "crown", name: "树冠", svg: `<circle cx="310" cy="165" r="42"/>`, lx: 310, ly: 172 },
      { id: "trunk", name: "树干", svg: `<rect x="298" y="196" width="24" height="42" rx="5"/>`, lx: 310, ly: 222 },
    ],
  },
  {
    name: "快乐农场",
    emoji: "🚜",
    regions: [
      { id: "field", name: "田野", svg: `<rect x="0" y="225" width="400" height="75" rx="6"/>`, lx: 40, ly: 268 },
      { id: "barn", name: "谷仓", svg: `<rect x="60" y="122" width="120" height="103"/>`, lx: 85, ly: 205 },
      { id: "barnroof", name: "仓顶", svg: `<polygon points="48,124 192,124 120,58"/>`, lx: 120, ly: 108 },
      { id: "barndoor", name: "仓门", svg: `<rect x="98" y="160" width="44" height="65" rx="8"/>`, lx: 120, ly: 196 },
      { id: "sun2", name: "太阳", svg: `<circle cx="342" cy="55" r="28"/>`, lx: 342, ly: 61 },
      { id: "cloud", name: "云朵", svg: `<ellipse cx="245" cy="70" rx="42" ry="20"/>`, lx: 245, ly: 76 },
      { id: "pond", name: "池塘", svg: `<ellipse cx="300" cy="255" rx="62" ry="24"/>`, lx: 300, ly: 261 },
      { id: "flower", name: "花朵", svg: `<circle cx="42" cy="196" r="17"/>`, lx: 42, ly: 201 },
    ],
  },
  {
    name: "海底世界",
    emoji: "🐠",
    regions: [
      { id: "fishbody", name: "鱼身", svg: `<ellipse cx="150" cy="145" rx="56" ry="36"/>`, lx: 150, ly: 151 },
      { id: "fishtail", name: "鱼尾", svg: `<polygon points="205,145 252,113 252,177"/>`, lx: 236, ly: 150 },
      { id: "starfish", name: "海星", svg: `<polygon points="60,212 68,233 91,233 73,247 80,270 60,256 40,270 47,247 29,233 52,233"/>`, lx: 60, ly: 245 },
      { id: "seaweed", name: "水草", svg: `<rect x="322" y="178" width="18" height="92" rx="9"/>`, lx: 331, ly: 228 },
      { id: "bubble1", name: "小泡泡", svg: `<circle cx="262" cy="78" r="17"/>`, lx: 262, ly: 83 },
      { id: "bubble2", name: "大泡泡", svg: `<circle cx="60" cy="70" r="24"/>`, lx: 60, ly: 76 },
      { id: "shell", name: "贝壳", svg: `<path d="M120,262 a30,30 0 0 1 60,0 z"/>`, lx: 150, ly: 254 },
      { id: "crab", name: "小螃蟹", svg: `<ellipse cx="332" cy="118" rx="30" ry="20"/>`, lx: 332, ly: 124 },
    ],
  },
  {
    name: "夜空公园",
    emoji: "🌙",
    regions: [
      { id: "ground", name: "草坪", svg: `<rect x="0" y="258" width="400" height="42" rx="6"/>`, lx: 40, ly: 284 },
      { id: "moon", name: "月亮", svg: `<circle cx="320" cy="60" r="28"/>`, lx: 320, ly: 66 },
      { id: "bigstar", name: "大星星", svg: `<polygon points="90,38 98,58 118,60 103,73 107,93 90,82 73,93 77,73 62,60 82,58"/>`, lx: 90, ly: 70 },
      { id: "cloud2", name: "夜云", svg: `<ellipse cx="190" cy="52" rx="38" ry="16"/>`, lx: 190, ly: 58 },
      { id: "tent", name: "帐篷", svg: `<polygon points="66,232 134,232 100,158"/>`, lx: 100, ly: 214 },
      { id: "tentdoor", name: "帐篷门", svg: `<polygon points="90,232 110,232 100,200"/>`, lx: 100, ly: 227 },
      { id: "crown2", name: "树冠", svg: `<circle cx="270" cy="160" r="40"/>`, lx: 270, ly: 166 },
      { id: "trunk2", name: "树干", svg: `<rect x="262" y="196" width="16" height="42" rx="5"/>`, lx: 270, ly: 222 },
      { id: "fire", name: "篝火", svg: `<polygon points="168,246 192,246 188,220 180,206 172,220"/>`, lx: 180, ly: 238 },
    ],
  },
  {
    name: "彩虹山坡",
    emoji: "🌈",
    regions: [
      { id: "band1", name: "彩虹外圈", svg: `<path d="M30,215 A170,170 0 0 1 370,215 L320,215 A120,120 0 0 0 80,215 Z"/>`, lx: 200, ly: 62 },
      { id: "band2", name: "彩虹中圈", svg: `<path d="M80,215 A120,120 0 0 1 320,215 L270,215 A70,70 0 0 0 130,215 Z"/>`, lx: 200, ly: 112 },
      { id: "band3", name: "彩虹内圈", svg: `<path d="M130,215 A70,70 0 0 1 270,215 L220,215 A20,20 0 0 0 180,215 Z"/>`, lx: 200, ly: 162 },
      { id: "hill", name: "山坡", svg: `<ellipse cx="200" cy="292" rx="230" ry="76"/>`, lx: 90, ly: 276 },
      { id: "sun3", name: "太阳", svg: `<circle cx="52" cy="56" r="26"/>`, lx: 52, ly: 62 },
      { id: "cloud3", name: "云朵", svg: `<ellipse cx="336" cy="64" rx="34" ry="15"/>`, lx: 336, ly: 70 },
      { id: "flower2", name: "小花", svg: `<circle cx="120" cy="252" r="14"/>`, lx: 120, ly: 257 },
      { id: "flower3", name: "小草花", svg: `<circle cx="292" cy="258" r="14"/>`, lx: 292, ly: 263 },
    ],
  },
  {
    name: "星光火箭城",
    emoji: "🚀",
    regions: [
      { id: "city", name: "地面", svg: `<rect x="0" y="272" width="400" height="28" rx="6"/>`, lx: 30, ly: 290 },
      { id: "body", name: "火箭身", svg: `<rect x="180" y="82" width="40" height="92" rx="16"/>`, lx: 200, ly: 150 },
      { id: "head", name: "火箭头", svg: `<polygon points="180,92 220,92 200,44"/>`, lx: 200, ly: 84 },
      { id: "porthole", name: "舷窗", svg: `<circle cx="200" cy="118" r="11"/>`, lx: 200, ly: 122 },
      { id: "flame", name: "火焰", svg: `<polygon points="186,174 214,174 200,210"/>`, lx: 200, ly: 186 },
      { id: "planet", name: "小星球", svg: `<circle cx="86" cy="86" r="30"/>`, lx: 86, ly: 92 },
      { id: "ring", name: "星球环", svg: `<ellipse cx="86" cy="96" rx="48" ry="10"/>`, lx: 132, ly: 100 },
      { id: "star2", name: "星星", svg: `<polygon points="322,52 329,70 348,72 334,84 338,102 322,92 306,102 310,84 296,72 315,70"/>`, lx: 322, ly: 82 },
      { id: "tower1", name: "小楼", svg: `<rect x="56" y="206" width="58" height="66" rx="6"/>`, lx: 85, ly: 244 },
      { id: "tower2", name: "高楼", svg: `<rect x="286" y="188" width="62" height="84" rx="6"/>`, lx: 317, ly: 234 },
    ],
  },
];

export interface Paint {
  name: string;
  value: string;
}

/** 可以直接拿的颜色 */
export const DIRECT_PAINTS: Paint[] = [
  { name: "红色", value: "#ff6b6b" },
  { name: "黄色", value: "#ffe066" },
  { name: "蓝色", value: "#74c0fc" },
  { name: "粉色", value: "#faa2c1" },
  { name: "棕色", value: "#c08552" },
  { name: "橙色", value: "#ffa94d" },
  { name: "绿色", value: "#8ce99a" },
  { name: "紫色", value: "#b197fc" },
];

/** 只有调色锅能调出来的颜色（含直接色里的橙绿紫，调色章节不直接给） */
export const MIXABLE_PAINTS: Paint[] = [
  { name: "橙色", value: "#ffa94d" },
  { name: "绿色", value: "#8ce99a" },
  { name: "紫色", value: "#b197fc" },
  { name: "深红", value: "#e03131" },
  { name: "金黄", value: "#fab005" },
  { name: "深蓝", value: "#4263eb" },
];

/** 调色配方（key 为按名称排序的两种原色） */
export const MIX_TABLE: Record<string, string> = {
  "红色+黄色": "橙色",
  "蓝色+黄色": "绿色",
  "红色+蓝色": "紫色",
  "红色+红色": "深红",
  "黄色+黄色": "金黄",
  "蓝色+蓝色": "深蓝",
};

export const ALL_PAINTS: Record<string, string> = Object.fromEntries(
  [...DIRECT_PAINTS, ...MIXABLE_PAINTS].map((p) => [p.name, p.value])
);

export type ColorMode = "guide" | "mix" | "number" | "memory";

export interface ColorTask {
  region: string;
  color: string;
}

export interface ColorLevel {
  pic: number;
  mode: ColorMode;
  tasks: ColorTask[];
  /** 调色盘直接给的颜色（含干扰色） */
  palette: string[];
  /** 需要用调色锅调出的颜色 */
  needMix: string[];
  maxWrong: number;
  /** memory 模式的预览时长（毫秒） */
  previewMs: number;
}

const BASIC = ["红色", "黄色", "蓝色", "粉色", "棕色"];
const CHEERFUL = ["红色", "黄色", "蓝色", "粉色", "棕色", "橙色", "绿色", "紫色"];
const MIX_EASY = ["橙色", "绿色", "紫色"];
// 深色排前面，保证彩虹深色坡从第一关就要调深色
const MIX_DEEP = ["深红", "金黄", "深蓝", "橙色", "绿色", "紫色"];

export function buildLevel(level: number): ColorLevel {
  const rand = mulberry32(11800 + level * 7919);
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  const picture = PICTURES[ci];
  const maxTasks = picture.regions.length;

  const mode: ColorMode = ci === 2 || ci === 4 ? "mix" : ci === 3 ? "number" : ci === 5 ? "memory" : "guide";
  const taskCount = Math.min(maxTasks, 4 + Math.floor(t * 4) + (ci >= 2 ? 1 : 0));
  const regions = shuffled(picture.regions, rand).slice(0, taskCount);

  // 每个目标区域配一种颜色
  const directPool = ci === 0 ? BASIC : CHEERFUL;
  const mixPool = ci === 4 ? MIX_DEEP : MIX_EASY;
  const mixCount = mode === "mix" ? Math.min(taskCount - 1, 1 + Math.floor(t * 2)) : 0;

  const tasks: ColorTask[] = [];
  const usedMix: string[] = [];
  for (let i = 0; i < regions.length; i++) {
    if (i < mixCount) {
      const c = mixPool[i % mixPool.length];
      tasks.push({ region: regions[i].id, color: c });
      if (!usedMix.includes(c)) usedMix.push(c);
    } else {
      const pool = mode === "mix" ? BASIC : directPool;
      tasks.push({ region: regions[i].id, color: pick(rand, pool) });
    }
  }

  // 调色盘：直接色 = 非调色任务用到的颜色 + 干扰色
  const direct = [...new Set(tasks.filter((k) => !usedMix.includes(k.color)).map((k) => k.color))];
  const distractorCount = mode === "number" ? (t > 0.5 ? 1 : 0) : 1 + Math.floor(t * 2);
  // 调色章节的干扰色只从基础色里挑，免得调色盘里直接出现"该调出来"的颜色
  const distractorPool = mode === "mix" ? BASIC : directPool;
  const distractors = shuffled(
    distractorPool.filter((c) => !direct.includes(c) && !usedMix.includes(c)),
    rand
  ).slice(0, distractorCount);
  const palette = shuffled([...direct, ...distractors], rand);

  const maxWrong = ci <= 1 ? 5 : ci === 5 ? (t > 0.5 ? 3 : 4) : 4;
  const previewMs = mode === "memory" ? Math.max(2400, 4200 - Math.floor(t * 1800)) : 0;

  return { pic: ci, mode, tasks: shuffled(tasks, rand), palette, needMix: usedMix, maxWrong, previewMs };
}

export const LEVELS: ColorLevel[] = Array.from({ length: 99 }, (_, i) => buildLevel(i));
