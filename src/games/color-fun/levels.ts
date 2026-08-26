// 涂色小屋：188 关 · 十大村镇章节关卡生成
// 前 99 关是 1.0 的六大村镇（指令 / 调色锅 / 数字 / 记忆），一个字都没动；
// 1.1 在末尾追加四个村镇（第 100–188 关）：明暗渐变、配色规则、图例大画布、限色挑战。
import { chapterOf, indexInChapter, mulberry32, pick, shuffled, type Chapter } from "../level99";

/** 1.0 的六大村镇：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新村镇从这里开始往后排） */
export const LEGACY_LEVELS = 99;

export const CHAPTERS: Chapter[] = [
  { name: "温馨小屋村", emoji: "🏠", color: "#ffe8cc", desc: "按小指令给小屋涂颜色", size: 17 },
  { name: "快乐农场镇", emoji: "🚜", color: "#d3f9d8", desc: "颜色更多，指令更长", size: 17 },
  { name: "海底调色湾", emoji: "🐠", color: "#d0f0fd", desc: "要用调色锅调出新颜色", size: 17 },
  { name: "夜空数字园", emoji: "🌙", color: "#e5dbff", desc: "看数字涂颜色", size: 16 },
  { name: "彩虹深色坡", emoji: "🌈", color: "#fff3bf", desc: "深红金黄深蓝也要调", size: 16 },
  { name: "星光记忆城", emoji: "🚀", color: "#ffdeeb", desc: "先记住样子，再凭记忆涂", size: 16 },
  // ↓ 1.1 追加：四个高年级村镇，合计 89 关
  { name: "晨昏渐变谷", emoji: "🌄", color: "#ffe3e3", desc: "同一种颜色分深浅，从最浅的开始涂", size: 22 },
  { name: "互补配色坊", emoji: "🎯", color: "#e6fcf5", desc: "只告诉你规则，颜色自己推出来", size: 22 },
  { name: "图例大画布", emoji: "🗺️", color: "#f8f0fc", desc: "大画布加符号图例，一格都不能错", size: 23 },
  { name: "限色挑战场", emoji: "🎨", color: "#edf2ff", desc: "只给三原色，调色次数还有限", size: 22 },
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
  // ↓ 1.1 追加：四张新线稿（渐变 / 配色 / 大画布 / 限色）
  {
    name: "晨昏山谷",
    emoji: "🌄",
    regions: [
      { id: "sky", name: "天空", svg: `<rect x="0" y="0" width="400" height="96" rx="6"/>`, lx: 46, ly: 52 },
      { id: "farhill", name: "远山", svg: `<polygon points="0,150 110,72 226,150"/>`, lx: 170, ly: 130 },
      { id: "nearhill", name: "近山", svg: `<polygon points="150,168 268,84 396,168"/>`, lx: 270, ly: 150 },
      { id: "lake", name: "湖面", svg: `<rect x="0" y="196" width="400" height="60" rx="8"/>`, lx: 60, ly: 232 },
      { id: "shore", name: "湖岸", svg: `<rect x="0" y="256" width="400" height="44" rx="8"/>`, lx: 60, ly: 284 },
      { id: "crownv", name: "树冠", svg: `<circle cx="330" cy="212" r="34"/>`, lx: 330, ly: 218 },
      { id: "trunkv", name: "树干", svg: `<rect x="322" y="240" width="16" height="34" rx="4"/>`, lx: 330, ly: 264 },
      { id: "hut", name: "小屋", svg: `<rect x="58" y="150" width="66" height="46" rx="5"/>`, lx: 91, ly: 180 },
      { id: "hutroof", name: "屋顶", svg: `<polygon points="48,152 134,152 91,116"/>`, lx: 91, ly: 142 },
    ],
  },
  {
    name: "配色小镇",
    emoji: "🏘️",
    regions: [
      { id: "csky", name: "天空", svg: `<rect x="0" y="0" width="400" height="120" rx="6"/>`, lx: 44, ly: 62 },
      { id: "cgrass", name: "草地", svg: `<rect x="0" y="240" width="400" height="60" rx="6"/>`, lx: 44, ly: 276 },
      { id: "roofa", name: "左屋顶", svg: `<polygon points="34,152 166,152 100,92"/>`, lx: 100, ly: 138 },
      { id: "walla", name: "左墙", svg: `<rect x="46" y="152" width="108" height="88"/>`, lx: 78, ly: 208 },
      { id: "roofb", name: "右屋顶", svg: `<polygon points="230,166 372,166 301,106"/>`, lx: 301, ly: 152 },
      { id: "wallb", name: "右墙", svg: `<rect x="242" y="166" width="118" height="74"/>`, lx: 274, ly: 214 },
      { id: "cdoor", name: "小门", svg: `<rect x="84" y="190" width="34" height="50" rx="6"/>`, lx: 101, ly: 220 },
      { id: "cwin", name: "窗户", svg: `<rect x="284" y="188" width="34" height="30" rx="5"/>`, lx: 301, ly: 209 },
      { id: "ctree", name: "树冠", svg: `<circle cx="196" cy="212" r="30"/>`, lx: 196, ly: 218 },
      { id: "cflower", name: "花丛", svg: `<ellipse cx="44" cy="256" rx="30" ry="15"/>`, lx: 44, ly: 262 },
    ],
  },
  {
    name: "花海大画布",
    emoji: "🖼️",
    regions: [
      { id: "bsky", name: "上层天空", svg: `<rect x="0" y="0" width="400" height="60" rx="4"/>`, lx: 40, ly: 36 },
      { id: "bsun", name: "太阳", svg: `<circle cx="336" cy="52" r="26"/>`, lx: 336, ly: 58 },
      { id: "bcloud", name: "云朵", svg: `<ellipse cx="120" cy="52" rx="46" ry="20"/>`, lx: 120, ly: 58 },
      { id: "bhill", name: "山丘", svg: `<polygon points="0,150 96,74 200,150"/>`, lx: 96, ly: 134 },
      { id: "bhill2", name: "小丘", svg: `<polygon points="184,150 276,90 372,150"/>`, lx: 278, ly: 136 },
      { id: "bfield", name: "田野", svg: `<rect x="0" y="150" width="400" height="52" rx="4"/>`, lx: 40, ly: 182 },
      { id: "bpath", name: "小路", svg: `<polygon points="170,202 230,202 268,300 132,300"/>`, lx: 200, ly: 262 },
      { id: "bleft", name: "左花田", svg: `<rect x="0" y="202" width="132" height="98" rx="4"/>`, lx: 60, ly: 258 },
      { id: "bright", name: "右花田", svg: `<rect x="268" y="202" width="132" height="98" rx="4"/>`, lx: 336, ly: 258 },
      { id: "bflower1", name: "大花", svg: `<circle cx="58" cy="230" r="18"/>`, lx: 58, ly: 236 },
      { id: "bflower2", name: "小花", svg: `<circle cx="340" cy="238" r="16"/>`, lx: 340, ly: 244 },
      { id: "btree", name: "树冠", svg: `<circle cx="236" cy="126" r="26"/>`, lx: 236, ly: 132 },
      { id: "btrunk", name: "树干", svg: `<rect x="229" y="148" width="14" height="30" rx="4"/>`, lx: 236, ly: 170 },
    ],
  },
  {
    name: "彩虹热气球",
    emoji: "🎈",
    regions: [
      { id: "hsky", name: "天空", svg: `<rect x="0" y="0" width="400" height="300" rx="6"/>`, lx: 40, ly: 288 },
      { id: "hleft", name: "气球左瓣", svg: `<path d="M200,40 A78,78 0 0 0 122,118 Q122,168 200,208 Z"/>`, lx: 152, ly: 122 },
      { id: "hmid", name: "气球中瓣", svg: `<path d="M200,40 Q166,120 200,208 Q234,120 200,40 Z"/>`, lx: 200, ly: 116 },
      { id: "hright", name: "气球右瓣", svg: `<path d="M200,40 A78,78 0 0 1 278,118 Q278,168 200,208 Z"/>`, lx: 248, ly: 122 },
      { id: "hbasket", name: "吊篮", svg: `<rect x="176" y="244" width="48" height="34" rx="6"/>`, lx: 200, ly: 268 },
      { id: "hrope", name: "吊绳", svg: `<rect x="196" y="208" width="8" height="36" rx="3"/>`, lx: 200, ly: 232 },
      { id: "hcloud", name: "云朵", svg: `<ellipse cx="64" cy="86" rx="44" ry="20"/>`, lx: 64, ly: 92 },
      { id: "hbird", name: "小鸟", svg: `<ellipse cx="330" cy="212" rx="26" ry="16"/>`, lx: 330, ly: 218 },
      { id: "hflag", name: "小旗", svg: `<polygon points="224,246 262,254 224,262"/>`, lx: 238, ly: 254 },
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

/** 1.1 追加：同一种颜色的深浅阶梯用色（只在新村镇出现） */
export const SHADE_PAINTS: Paint[] = [
  { name: "浅粉", value: "#ffdeeb" },
  { name: "深粉", value: "#e64980" },
  { name: "浅蓝", value: "#d0ebff" },
  { name: "浅绿", value: "#d3f9d8" },
  { name: "深绿", value: "#2f9e44" },
  { name: "浅黄", value: "#fff3bf" },
  { name: "浅紫", value: "#e5dbff" },
  { name: "深紫", value: "#7048e8" },
  { name: "浅橙", value: "#ffd8a8" },
  { name: "深橙", value: "#e8590c" },
  { name: "浅红", value: "#ffc9c9" },
];

export const ALL_PAINTS: Record<string, string> = Object.fromEntries(
  [...DIRECT_PAINTS, ...MIXABLE_PAINTS, ...SHADE_PAINTS].map((p) => [p.name, p.value])
);

/** 1.1 追加：明暗阶梯，每一组都是同一种颜色由浅到深 */
export const SHADE_LADDERS: string[][] = [
  ["浅粉", "粉色", "深粉"],
  ["浅蓝", "蓝色", "深蓝"],
  ["浅绿", "绿色", "深绿"],
  ["浅黄", "黄色", "金黄"],
  ["浅紫", "紫色", "深紫"],
  ["浅橙", "橙色", "深橙"],
  ["浅红", "红色", "深红"],
];

/** 1.1 追加：互补色（色环上正对面的那个） */
export const COMPLEMENT: Record<string, string> = {
  红色: "绿色",
  绿色: "红色",
  蓝色: "橙色",
  橙色: "蓝色",
  黄色: "紫色",
  紫色: "黄色",
};

/** 1.1 追加：邻近色（彩虹上紧挨着的下一格） */
export const ANALOGOUS_NEXT: Record<string, string> = {
  红色: "橙色",
  橙色: "黄色",
  黄色: "绿色",
  绿色: "蓝色",
  蓝色: "紫色",
  紫色: "红色",
};

/** 1.1 追加：图例用的符号（大画布上贴在每一块上） */
export const LEGEND_SYMBOLS = ["●", "■", "▲", "★", "◆", "♥"];

/** 配色规则读给孩子听的说法（不报颜色，只说关系） */
export function ruleText(kind: "complement" | "analogous", refName: string): string {
  return kind === "complement" ? `${refName}的互补色` : `彩虹上紧挨着${refName}的下一格`;
}

export type ColorMode =
  | "guide"
  | "mix"
  | "number"
  | "memory"
  // ↓ 1.1 追加的玩法
  | "shade"
  | "rule"
  | "legend"
  | "limited";

export interface ColorTask {
  region: string;
  color: string;
}

/** 1.1 追加：配色规则（不直接报颜色，只给参照区域和关系） */
export interface ColorRule {
  region: string;
  /** 参照的那一块（开局就已经涂好） */
  refRegion: string;
  kind: "complement" | "analogous";
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
  /** shade 模式：必须按 tasks 的顺序从浅到深涂 */
  order?: boolean;
  /** rule 模式：开局就涂好的参照区域 */
  given?: ColorTask[];
  /** rule 模式：每一块的推色规则，与 tasks 同区域一一对应 */
  rules?: ColorRule[];
  /** legend 模式：符号 → 颜色的图例 */
  legend?: { symbol: string; color: string }[];
  /** limited 模式：调色锅最多能开几次 */
  budget?: number;
}

const BASIC = ["红色", "黄色", "蓝色", "粉色", "棕色"];
const CHEERFUL = ["红色", "黄色", "蓝色", "粉色", "棕色", "橙色", "绿色", "紫色"];
const MIX_EASY = ["橙色", "绿色", "紫色"];
// 深色排前面，保证彩虹深色坡从第一关就要调深色
const MIX_DEEP = ["深红", "金黄", "深蓝", "橙色", "绿色", "紫色"];

export function buildLevel(level: number): ColorLevel {
  const ci0 = chapterOf(CHAPTERS, level);
  // 1.1 新村镇走自己的生成器；前 99 关下面这段与 1.0 逐字相同
  if (ci0 >= LEGACY_CHAPTER_SIZES.length) return buildAdvancedLevel(level, ci0);
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

// ---------------------------------------------------------------------------
// 1.1 追加：第 100–188 关的四种新玩法
//   shade   明暗渐变——同色系分深浅，还要按由浅到深的顺序涂
//   rule    配色规则——只给「某块的互补色 / 邻近色」，颜色得自己推
//   legend  图例大画布——13 块的大图，靠符号图例对应颜色
//   limited 限色挑战——调色盘只剩三原色，连开锅次数都有预算
// ---------------------------------------------------------------------------

function takeDistinct<T>(rand: () => number, pool: readonly T[], n: number, exclude: readonly T[]): T[] {
  const out: T[] = [];
  if (n <= 0) return out;
  for (const x of shuffled(pool, rand)) {
    if (exclude.includes(x) || out.includes(x)) continue;
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

function buildAdvancedLevel(level: number, ci: number): ColorLevel {
  const rand = mulberry32(13900 + level * 7919);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  const picture = PICTURES[ci];
  const regions = picture.regions.map((r) => r.id);

  if (ci === 6) {
    // 晨昏渐变谷：两组明暗阶梯，从最浅的一路涂到最深的
    const ladders = takeDistinct(rand, SHADE_LADDERS, 2, []);
    const spots = shuffled(regions, rand);
    const tasks: ColorTask[] = [];
    // 前段两组共 5 块，后段两组各三级共 6 块
    const secondSteps = t > 0.35 ? 3 : 2;
    const colors = [...ladders[0], ...ladders[1].slice(0, secondSteps)];
    colors.forEach((color, i) => {
      if (spots[i]) tasks.push({ region: spots[i], color });
    });
    // 由浅到深：先第一组，再第二组，组内顺序就是阶梯顺序
    const palette = shuffled(
      [
        ...new Set([
          ...tasks.map((k) => k.color),
          ...takeDistinct(rand, SHADE_LADDERS.flat(), 1 + Math.floor(t * 2), tasks.map((k) => k.color)),
        ]),
      ],
      rand
    );
    return {
      pic: ci, mode: "shade", tasks, palette, needMix: [],
      maxWrong: t > 0.6 ? 3 : 4, previewMs: 0, order: true,
    };
  }

  if (ci === 7) {
    // 互补配色坊：先摆两三块参照色，其余全靠色环规则推出来
    const wheel = Object.keys(COMPLEMENT);
    const spots = shuffled(regions, rand);
    const refCount = 2 + (t > 0.5 ? 1 : 0);
    const given: ColorTask[] = [];
    const refColors = takeDistinct(rand, wheel, refCount, []);
    refColors.forEach((color, i) => given.push({ region: spots[i], color }));

    const taskCount = Math.min(spots.length - given.length, 4 + Math.floor(t * 2));
    const tasks: ColorTask[] = [];
    const rules: ColorRule[] = [];
    for (let i = 0; i < taskCount; i++) {
      const region = spots[given.length + i];
      const ref = given[i % given.length];
      const kind: ColorRule["kind"] = t > 0.4 && i % 2 === 1 ? "analogous" : "complement";
      const color = kind === "complement" ? COMPLEMENT[ref.color] : ANALOGOUS_NEXT[ref.color];
      tasks.push({ region, color });
      rules.push({ region, refRegion: ref.region, kind });
    }
    const wanted = [...new Set(tasks.map((k) => k.color))];
    const palette = shuffled(
      [...wanted, ...takeDistinct(rand, wheel, 1 + Math.floor(t * 2), wanted)],
      rand
    );
    return {
      pic: ci, mode: "rule", tasks: shuffled(tasks, rand), palette, needMix: [],
      maxWrong: t > 0.6 ? 3 : 4, previewMs: 0, given, rules,
    };
  }

  if (ci === 8) {
    // 图例大画布：13 块的大图，符号对颜色，一格都不能认错
    const colorCount = 4 + Math.floor(t * 2);
    const colors = takeDistinct(rand, [...DIRECT_PAINTS.map((p) => p.name), "深绿", "深粉"], colorCount, []);
    const legend = colors.map((color, i) => ({ symbol: LEGEND_SYMBOLS[i % LEGEND_SYMBOLS.length], color }));
    const taskCount = Math.min(regions.length, 8 + Math.floor(t * 4));
    const spots = shuffled(regions, rand).slice(0, taskCount);
    const tasks = spots.map((region, i) => ({ region, color: colors[i % colors.length] }));
    const palette = shuffled(colors, rand);
    return {
      pic: ci, mode: "legend", tasks: shuffled(tasks, rand), palette, needMix: [],
      maxWrong: t > 0.6 ? 3 : 4, previewMs: 0, legend,
    };
  }

  // 限色挑战场：调色盘只剩红黄蓝，其余全靠调，开锅次数还有预算
  const mixables = ["橙色", "绿色", "紫色", "深红", "金黄", "深蓝"];
  const mixCount = 2 + Math.floor(t * 2);
  const needMix = takeDistinct(rand, mixables, mixCount, []);
  const spots = shuffled(regions, rand);
  const taskCount = Math.min(spots.length, needMix.length + 2 + Math.floor(t * 2));
  const tasks: ColorTask[] = [];
  for (let i = 0; i < taskCount; i++) {
    const color = i < needMix.length ? needMix[i] : ["红色", "黄色", "蓝色"][i % 3];
    tasks.push({ region: spots[i], color });
  }
  return {
    pic: ci,
    mode: "limited",
    tasks: shuffled(tasks, rand),
    palette: ["红色", "黄色", "蓝色"],
    needMix,
    maxWrong: t > 0.6 ? 3 : 4,
    previewMs: 0,
    budget: needMix.length + (t > 0.5 ? 1 : 2),
  };
}

export const LEVELS: ColorLevel[] = Array.from({ length: 188 }, (_, i) => buildLevel(i));
