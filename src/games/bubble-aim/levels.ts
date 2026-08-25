// 泡泡瞄准关卡:偶数行 9 格、奇数行 8 格(右移半格),'.' 为空。
// 颜色:R 草莓红 Y 柠檬黄 B 天空蓝 G 苹果绿 P 葡萄紫。
// 特殊:S 石泡(被直接命中两次才碎、不参与连消)、W 彩虹泡(百搭)。
// 障碍:clouds 云挡板(弹道反弹)、holes 黑洞(吞掉泡泡)、
// dropEvery/dropRows 每打 N 发顶部压下来一行新泡泡(队列用完为止)。
//
// 共 99 关、6 大主题世界:20 关手工设计 + 79 关由确定性生成器按主题配方生成
// (同一个种子永远生成同样的关卡,全部经贪心机器人实测可通关)。

import type { CloudDef, HoleDef } from "./logic";

export interface BubbleLevelDef {
  name: string;
  tip: string;
  layout: string[];
  /** 本关子弹数 */
  shots: number;
  clouds?: CloudDef[];
  holes?: HoleDef[];
  /** 每打出多少发,顶部就压下来一行(配 dropRows 用) */
  dropEvery?: number;
  /** 待下落的新行队列(用完就不再下落),长度按 8/9 交替 */
  dropRows?: string[];
}

export type MechKind = "stone" | "rainbow" | "cloud" | "hole" | "drop";

/** 一关里用到的机关种类 */
export function levelMechanisms(def: BubbleLevelDef): MechKind[] {
  const out: MechKind[] = [];
  const flat = def.layout.join("");
  if (flat.includes("S")) out.push("stone");
  if (flat.includes("W")) out.push("rainbow");
  if ((def.clouds?.length ?? 0) > 0) out.push("cloud");
  if ((def.holes?.length ?? 0) > 0) out.push("hole");
  if ((def.dropRows?.length ?? 0) > 0) out.push("drop");
  return out;
}

export const MECH_INFO: Record<MechKind, { icon: string; name: string }> = {
  stone: { icon: "🪨", name: "石泡" },
  rainbow: { icon: "🌈", name: "彩虹泡" },
  cloud: { icon: "☁️", name: "云挡板" },
  hole: { icon: "🕳️", name: "黑洞" },
  drop: { icon: "⬇️", name: "下落新行" },
};

/* ================= 主题世界 ================= */

export interface ThemeDef {
  name: string;
  icon: string;
  blurb: string;
  /** 游戏画面天空渐变 */
  skyTop: string;
  skyBottom: string;
  /** 选关地图主题框底色 / 文字色 */
  tint: string;
  ink: string;
  /** 夜空主题画星星 */
  dark?: boolean;
}

export const THEMES: ThemeDef[] = [
  { name: "糖果果园", icon: "🍬", blurb: "纯颜色热身,瞄得准就爆得多!", skyTop: "#FFF4E0", skyBottom: "#FFE9F2", tint: "#FFF1DE", ink: "#A46A2A" },
  { name: "石头城堡", icon: "🪨", blurb: "石泡要连打两下才碎,先找别的路!", skyTop: "#EEF1F6", skyBottom: "#E0E6EF", tint: "#E9EDF3", ink: "#4E5B75" },
  { name: "彩虹峡谷", icon: "🌈", blurb: "彩虹泡百搭,连出超长一串!", skyTop: "#F3ECFF", skyBottom: "#E2F6EC", tint: "#F0E8FC", ink: "#7B4FA8" },
  { name: "白云天空", icon: "☁️", blurb: "云挡板会弹开泡泡,学会借墙反弹!", skyTop: "#E4F3FF", skyBottom: "#FBFEFF", tint: "#E2F1FD", ink: "#2A6099" },
  { name: "黑洞星河", icon: "🕳️", blurb: "黑洞会吞泡泡,瞄准线躲着走!", skyTop: "#2C2A55", skyBottom: "#4A3E78", tint: "#DDDAF2", ink: "#4A3E78", dark: true },
  { name: "风暴嘉年华", icon: "🌀", blurb: "新行不断压下来,五种机关大混战!", skyTop: "#DFF3F0", skyBottom: "#FFE9D6", tint: "#DFF2EE", ink: "#1F7A6B" },
];

/** 每个主题的关卡数(共 99) */
export const THEME_SIZES = [17, 17, 17, 16, 16, 16];

/** 关卡下标 → 主题序号 */
export function themeOfLevel(index: number): number {
  let acc = 0;
  for (let t = 0; t < THEME_SIZES.length; t++) {
    acc += THEME_SIZES[t];
    if (index < acc) return t;
  }
  return THEME_SIZES.length - 1;
}

/** 主题 t 的第一关下标 */
export function themeStart(t: number): number {
  let acc = 0;
  for (let i = 0; i < t; i++) acc += THEME_SIZES[i];
  return acc;
}

/* ================= 确定性生成器 ================= */

/** mulberry32:同一个种子永远生成同样的关卡 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rowLen0(r: number): number {
  return r % 2 === 0 ? 9 : 8;
}

interface GenOpts {
  name: string;
  tip: string;
  seed: number;
  /** 泡泡颜色候选 */
  palette: string[];
  /** 行数 */
  rows: number;
  /** 石泡"整段"个数 */
  stoneRuns?: number;
  /** 彩虹泡个数 */
  rainbows?: number;
  /** 云挡板布局:0 无 / 1 居中一朵 / 2 两侧各一朵 / 3 偏侧一朵 */
  cloudKind?: 0 | 1 | 2 | 3;
  /** 黑洞布局:0 无 / 1 居中 / 2 两侧 / 3 偏侧 */
  holeKind?: 0 | 1 | 2 | 3;
  /** 下落新行数(0 无) */
  dropRows?: number;
  /** 额外子弹(调难度用) */
  bonusShots?: number;
}

interface Run {
  r: number;
  start: number;
  len: number;
}

function genLevel(o: GenOpts): BubbleLevelDef {
  const rng = makeRng(o.seed);
  const rows: string[][] = [];
  const runs: Run[] = [];

  // 每行一个连续区间,区间相对上一行最多平移 1 格,保证全部连到顶不悬空
  let a = Math.floor(rng() * 2);
  let b = rowLen0(0) - 1 - Math.floor(rng() * 2);
  for (let r = 0; r < o.rows; r++) {
    const L = rowLen0(r);
    if (r > 0) {
      a = Math.max(0, Math.min(a + (rng() < 0.45 ? 1 : 0), L - 5));
      b = Math.min(L - 1, Math.max(b - (rng() < 0.45 ? 1 : 0), a + 4));
    }
    const row = new Array<string>(L).fill(".");
    // 区间内按 2-3 连的同色小段涂色(段尾不留孤单泡)
    let c = a;
    let prevColor = "";
    while (c <= b) {
      let len = 2 + (rng() < 0.4 ? 1 : 0);
      const remain = b - c + 1;
      if (len > remain) len = remain;
      if (remain - len === 1) len = remain;
      let color = o.palette[Math.floor(rng() * o.palette.length)];
      if (color === prevColor && o.palette.length > 1) {
        color = o.palette[(o.palette.indexOf(color) + 1) % o.palette.length];
      }
      for (let k = 0; k < len; k++) row[c + k] = color;
      runs.push({ r, start: c, len });
      prevColor = color;
      c += len;
    }
    rows.push(row);
  }

  // 石泡:把整段小段换成石头(避免造出孤单色泡)
  const stoneRuns = o.stoneRuns ?? 0;
  const candidates = runs.filter((run) => run.len <= 3);
  for (let i = 0; i < stoneRuns && candidates.length > 0; i++) {
    const idx = Math.floor(rng() * candidates.length);
    const run = candidates.splice(idx, 1)[0];
    for (let k = 0; k < run.len; k++) rows[run.r][run.start + k] = "S";
  }

  // 彩虹泡:替换若干彩色泡(彩虹百搭,不会造成死单泡)
  let rainbows = o.rainbows ?? 0;
  let guard = 0;
  while (rainbows > 0 && guard++ < 60) {
    const r = Math.floor(rng() * o.rows);
    const cc = Math.floor(rng() * rowLen0(r));
    const ch = rows[r][cc];
    if (ch !== "." && ch !== "S" && ch !== "W") {
      rows[r][cc] = "W";
      rainbows--;
    }
  }

  const layout = rows.map((row) => row.join(""));
  const flat = layout.join("");
  const clearable = [...flat].filter((ch) => ch !== "." && ch !== "S").length;
  const stones = [...flat].filter((ch) => ch === "S").length;

  // 云挡板(全部满足:不压泡泡、不糊墙边和发射台)
  let clouds: CloudDef[] | undefined;
  if (o.cloudKind === 1) {
    clouds = [{ x: 130 + Math.floor(rng() * 30), y: 292 + Math.floor(rng() * 30), w: 90 + Math.floor(rng() * 20), h: 22 }];
  } else if (o.cloudKind === 2) {
    const y = 300 + Math.floor(rng() * 30);
    clouds = [
      { x: 44 + Math.floor(rng() * 10), y, w: 64 + Math.floor(rng() * 12), h: 22 },
      { x: 242 + Math.floor(rng() * 8), y, w: 60 + Math.floor(rng() * 10), h: 22 },
    ];
  } else if (o.cloudKind === 3) {
    const left = rng() < 0.5;
    const w = 80 + Math.floor(rng() * 20);
    clouds = [{ x: left ? 50 + Math.floor(rng() * 16) : 300 - w - Math.floor(rng() * 16), y: 288 + Math.floor(rng() * 40), w, h: 22 }];
  }

  // 黑洞(离初始泡泡和发射台都足够远)
  let holes: HoleDef[] | undefined;
  if (o.holeKind === 1) {
    holes = [{ x: 165 + Math.floor(rng() * 30), y: 268 + Math.floor(rng() * 40) }];
  } else if (o.holeKind === 2) {
    const y = 272 + Math.floor(rng() * 30);
    holes = [
      { x: 78 + Math.floor(rng() * 20), y },
      { x: 262 + Math.floor(rng() * 20), y },
    ];
  } else if (o.holeKind === 3) {
    const left = rng() < 0.5;
    holes = [{ x: left ? 66 + Math.floor(rng() * 24) : 270 + Math.floor(rng() * 24), y: 266 + Math.floor(rng() * 46) }];
  }

  // 下落新行:成对同色,长度按 8/9 交替(与 descend 的奇偶翻转匹配)
  let dropRows: string[] | undefined;
  let dropEvery: number | undefined;
  let dropCells = 0;
  if ((o.dropRows ?? 0) > 0) {
    dropRows = [];
    for (let k = 0; k < (o.dropRows ?? 0); k++) {
      const L = k % 2 === 0 ? 8 : 9;
      let s = "";
      while (s.length < L) {
        const color = o.palette[Math.floor(rng() * o.palette.length)];
        const len = Math.min(2 + (rng() < 0.4 ? 1 : 0), L - s.length);
        s += color.repeat(len === 1 ? 1 : len);
        if (len === 1) s = s.slice(0, -1) + s.slice(-2, -1); // 末尾孤单时复制前一个颜色
      }
      dropRows.push(s.slice(0, L));
      dropCells += L;
    }
    dropEvery = 4 + Math.floor(rng() * 3);
  }

  const shots =
    Math.round(clearable * 0.55 + dropCells * 0.55) +
    stones * 2 +
    (holes?.length ?? 0) * 2 +
    (clouds?.length ?? 0) +
    (o.bonusShots ?? 0) +
    4;

  const def: BubbleLevelDef = {
    name: o.name,
    tip: o.tip,
    layout,
    shots: Math.max(14, shots),
  };
  if (clouds) def.clouds = clouds;
  if (holes) def.holes = holes;
  if (dropRows && dropRows.length > 0) {
    def.dropRows = dropRows;
    def.dropEvery = dropEvery;
  }
  return def;
}

/* ================= 手工关卡(20 关) ================= */

const H_INTRO: BubbleLevelDef[] = [
  {
    name: "三色小塔",
    tip: "对准同色的泡泡发射,凑齐 3 个就爆!",
    layout: [
      "RRRGGGBBB",
      "RRRGGBBB",
      ".RRGGGBB.",
    ],
    shots: 16,
  },
  {
    name: "彩虹拱门",
    tip: "试试打拱门的柱子,上面的会一起掉下来!",
    layout: [
      "BBBBBBBBB",
      "BYYYYYYB",
      "BYRRRRRYB",
      "BY.RR.YB",
      "BY.....YB",
    ],
    shots: 24,
  },
  {
    name: "蜂窝彩条",
    tip: "一条一条消,看看哪条最好打!",
    layout: [
      "RYBGRYBGG",
      "RYBGRYBG",
      "RYBGRYBGG",
      "RYBGRYBG",
    ],
    shots: 24,
  },
  {
    name: "甜心爱心",
    tip: "从爱心的小尖尖开始往上消!",
    layout: [
      ".RR...RR.",
      "RPPRRPPR",
      "RPPYYYPPR",
      ".RPYYPR.",
      "..RPPPR..",
      "...RR...",
      "....R....",
    ],
    shots: 26,
  },
];

const H_STONE: BubbleLevelDef[] = [
  {
    name: "石头城门",
    tip: "灰色石泡要连打两下才碎,先找别的路!",
    layout: [
      "YYYRRRYYY",
      ".SSSSSS.",
      "..GGGGG..",
    ],
    shots: 16,
  },
];

const H_RAINBOW: BubbleLevelDef[] = [
  {
    name: "彩虹桥",
    tip: "彩虹泡跟什么颜色都算一伙,能连出超长一串!",
    layout: [
      "RR.WWW.BB",
      "RRW..WBB",
      ".GGG.GGG.",
    ],
    shots: 14,
  },
  {
    name: "石虹迷阵",
    tip: "彩虹被石头夹住了,用黄色泡泡把它救出来!",
    layout: [
      "GG.SS.PP.",
      "GGSWWSPP",
      ".YYY.YYY.",
      "..Y....Y",
    ],
    shots: 18,
  },
];

const H_CLOUD: BubbleLevelDef[] = [
  {
    name: "白云索道",
    tip: "云朵会把泡泡弹开,贴着墙打绕过去!",
    layout: [
      "PPPYYYPPP",
      "PPYYYYPP",
      "..RRRRR..",
    ],
    clouds: [{ x: 130, y: 296, w: 100, h: 24 }],
    shots: 20,
  },
  {
    name: "云中石垒",
    tip: "两朵云守着两边,中间的路要自己打开!",
    layout: [
      "BBB.Y.BBB",
      "YYYSSYYY",
      "GGG..GGG.",
    ],
    clouds: [
      { x: 42, y: 310, w: 70, h: 22 },
      { x: 248, y: 310, w: 70, h: 22 },
    ],
    shots: 20,
  },
];

const H_HOLE: BubbleLevelDef[] = [
  {
    name: "黑洞警报",
    tip: "小心中间的黑洞,泡泡飞进去就不见啦!",
    layout: [
      "RRRR.YYYY",
      "RRR..YYY",
      "BBB..BBB.",
    ],
    holes: [{ x: 180, y: 250 }],
    shots: 18,
  },
  {
    name: "洞旁碎石",
    tip: "两个黑洞守着斜线,从中间和墙边走!",
    layout: [
      "GGYYWYYGG",
      "GGSYYSGG",
      ".PPP.PPP.",
    ],
    holes: [
      { x: 90, y: 280 },
      { x: 270, y: 280 },
    ],
    shots: 20,
  },
];

const H_STORM_EARLY: BubbleLevelDef[] = [
  {
    name: "天降泡雨",
    tip: "每打 4 发,天上就压下来一排新泡泡,抓紧消!",
    layout: [
      "BBGGBBGGB",
      "BGGBBGGB",
    ],
    dropEvery: 4,
    dropRows: ["RRYYBBGG", "GGBBYYRRR"],
    shots: 22,
  },
  {
    name: "石雨纷飞",
    tip: "石泡挡路还会掉新行,先把两边清干净!",
    layout: [
      "YYSPPSYY.",
      "YY.PP.YY",
    ],
    dropEvery: 5,
    dropRows: ["GGBBGGBB"],
    shots: 18,
  },
];

const H_STORM_FINAL: BubbleLevelDef[] = [
  {
    name: "彩虹黑洞",
    tip: "云朵封了墙角,黑洞守着中路,彩虹泡来帮忙!",
    layout: [
      "PP.GWG.PP",
      "PPG..GPP",
      ".BBB.BBB.",
    ],
    holes: [{ x: 180, y: 300 }],
    clouds: [
      { x: 42, y: 330, w: 60, h: 20 },
      { x: 258, y: 330, w: 60, h: 20 },
    ],
    shots: 20,
  },
  {
    name: "石洞云城",
    tip: "石泡吊着果冻墙,黑洞和云朵都来捣乱!",
    layout: [
      "BBBWWBBB.",
      "SGGGGGGS",
      "..RRRRR..",
    ],
    holes: [{ x: 60, y: 260 }],
    clouds: [{ x: 210, y: 320, w: 90, h: 22 }],
    shots: 22,
  },
  {
    name: "泡泡风暴",
    tip: "云朵挡中路,新行一直压下来,手要快!",
    layout: [
      "RRBBWBBRR",
      "RBB..BBR",
      "R.......R",
    ],
    clouds: [{ x: 145, y: 335, w: 70, h: 20 }],
    dropEvery: 4,
    dropRows: ["GGPPGGPP", "PPGGPPGGG"],
    shots: 26,
  },
  {
    name: "黑洞雨夜",
    tip: "黑洞吞泡泡、石泡挡路、新行还往下压!",
    layout: [
      "GGGSSGGG.",
      "YYY..YYY",
    ],
    holes: [{ x: 180, y: 280 }],
    dropEvery: 5,
    dropRows: ["BBRRBBRR"],
    shots: 20,
  },
  {
    name: "星阵黑洞",
    tip: "大星阵下面吊着石泡,黑洞守着必经之路!",
    layout: [
      "PPBBYBBPP",
      "PPBYYBPP",
      "GGRRYRRGG",
      "GGRRYRGG",
      "..GGRGG..",
      "...GG...",
      "....S....",
    ],
    holes: [{ x: 180, y: 310 }],
    shots: 30,
  },
  {
    name: "全能试炼",
    tip: "石泡、彩虹、云朵、黑洞一起上,神射手就是你!",
    layout: [
      "RRWSSWRR.",
      "BBB..BBB",
      ".GG...GG.",
    ],
    holes: [
      { x: 60, y: 270 },
      { x: 300, y: 270 },
    ],
    clouds: [{ x: 135, y: 330, w: 90, h: 20 }],
    shots: 22,
  },
  {
    name: "终极嘉年华",
    tip: "五种机关全到齐!打完这关就是泡泡大师!",
    layout: [
      "YYWBBWYY.",
      "GGSBBSGG",
      ".PP...PP.",
    ],
    holes: [{ x: 80, y: 290 }],
    clouds: [{ x: 150, y: 340, w: 60, h: 18 }],
    dropEvery: 6,
    dropRows: ["RRBBYYGG"],
    shots: 26,
  },
];

/* ================= 按主题拼装 99 关 ================= */

const g = genLevel;
const TIP0 = "同色凑 3 个就爆,打断「腰」上面全掉!";
const TIP1 = "石泡连打两下才碎,先消旁边的彩泡!";
const TIP2 = "彩虹泡跟谁都是一伙,留给最长的一串!";
const TIP3 = "云朵会反弹,试试贴墙斜着打!";
const TIP4 = "黑洞会吞泡泡,看好虚线再撒手!";
const TIP5 = "新行会压下来,别让泡泡越过警戒线!";

/** 主题 0 · 糖果果园:纯颜色 17 关 */
const T0: BubbleLevelDef[] = [
  ...H_INTRO,
  g({ name: "果园晨光", tip: TIP0, seed: 9001, palette: ["R", "Y", "G"], rows: 3 }),
  g({ name: "糖霜小路", tip: TIP0, seed: 9002, palette: ["B", "P", "Y"], rows: 3 }),
  g({ name: "蜜桃篱笆", tip: TIP0, seed: 9003, palette: ["R", "P", "G"], rows: 4 }),
  g({ name: "莓果拼盘", tip: TIP0, seed: 9004, palette: ["R", "B", "Y"], rows: 4 }),
  g({ name: "柠檬梯田", tip: TIP0, seed: 9005, palette: ["Y", "G", "B"], rows: 4 }),
  g({ name: "苹果山丘", tip: TIP0, seed: 9006, palette: ["G", "R", "Y"], rows: 4 }),
  g({ name: "葡萄凉棚", tip: TIP0, seed: 9007, palette: ["P", "G", "B"], rows: 4 }),
  g({ name: "橙子秋千", tip: TIP0, seed: 9008, palette: ["Y", "R", "P"], rows: 5 }),
  g({ name: "樱桃阶梯", tip: TIP0, seed: 9009, palette: ["R", "B", "G", "Y"], rows: 4 }),
  g({ name: "蜜糖瀑布", tip: TIP0, seed: 9010, palette: ["Y", "B", "P"], rows: 5 }),
  g({ name: "果冻云朵", tip: TIP0, seed: 9011, palette: ["B", "G", "R", "P"], rows: 5 }),
  g({ name: "棒棒糖林", tip: TIP0, seed: 9012, palette: ["P", "R", "Y", "G"], rows: 5 }),
  g({ name: "丰收派对", tip: "果园毕业考!五种颜色一起上!", seed: 9013, palette: ["R", "Y", "B", "G", "P"], rows: 5, bonusShots: 2 }),
];

/** 主题 1 · 石头城堡:石泡 17 关 */
const T1: BubbleLevelDef[] = [
  ...H_STONE,
  g({ name: "石门初现", tip: TIP1, seed: 9101, palette: ["R", "Y", "B"], rows: 3, stoneRuns: 1 }),
  g({ name: "碎石小巷", tip: TIP1, seed: 9102, palette: ["G", "P", "Y"], rows: 3, stoneRuns: 1 }),
  g({ name: "双石岗哨", tip: TIP1, seed: 9103, palette: ["B", "R", "G"], rows: 4, stoneRuns: 2 }),
  g({ name: "石桥残段", tip: TIP1, seed: 9104, palette: ["Y", "P", "B"], rows: 4, stoneRuns: 2 }),
  g({ name: "灰岩回廊", tip: TIP1, seed: 9105, palette: ["R", "G", "P"], rows: 4, stoneRuns: 2 }),
  g({ name: "石缝花园", tip: TIP1, seed: 9106, palette: ["G", "Y", "R"], rows: 4, stoneRuns: 2 }),
  g({ name: "滚石坡道", tip: TIP1, seed: 9107, palette: ["B", "P", "R"], rows: 4, stoneRuns: 3 }),
  g({ name: "石塔平台", tip: TIP1, seed: 9108, palette: ["Y", "B", "G"], rows: 5, stoneRuns: 2 }),
  g({ name: "岩壁蜂巢", tip: TIP1, seed: 9109, palette: ["P", "R", "Y"], rows: 5, stoneRuns: 3 }),
  g({ name: "三石连关", tip: TIP1, seed: 9110, palette: ["R", "B", "G"], rows: 5, stoneRuns: 3 }),
  g({ name: "石城壁垒", tip: TIP1, seed: 9111, palette: ["G", "P", "B"], rows: 5, stoneRuns: 3 }),
  g({ name: "顽石迷宫", tip: TIP1, seed: 9112, palette: ["Y", "R", "P"], rows: 5, stoneRuns: 3 }),
  g({ name: "巨石阵眼", tip: TIP1, seed: 9113, palette: ["B", "G", "Y"], rows: 5, stoneRuns: 4 }),
  g({ name: "石匠考验", tip: TIP1, seed: 9114, palette: ["R", "P", "G"], rows: 5, stoneRuns: 4 }),
  g({ name: "城垛风云", tip: TIP1, seed: 9115, palette: ["P", "Y", "B"], rows: 5, stoneRuns: 4, bonusShots: 2 }),
  g({ name: "石王宝座", tip: "石头城堡毕业考!石泡最多的一关!", seed: 9116, palette: ["R", "Y", "B", "G"], rows: 5, stoneRuns: 5, bonusShots: 2 }),
];

/** 主题 2 · 彩虹峡谷:彩虹泡 17 关 */
const T2: BubbleLevelDef[] = [
  ...H_RAINBOW,
  g({ name: "初见彩虹", tip: TIP2, seed: 9201, palette: ["G", "P", "B"], rows: 3, rainbows: 1 }),
  g({ name: "虹光小溪", tip: TIP2, seed: 9202, palette: ["R", "Y", "B"], rows: 3, rainbows: 2 }),
  g({ name: "双彩虹桥", tip: TIP2, seed: 9203, palette: ["Y", "G", "P"], rows: 4, rainbows: 2 }),
  g({ name: "彩带飘飘", tip: TIP2, seed: 9204, palette: ["B", "R", "G"], rows: 4, rainbows: 2 }),
  g({ name: "虹谷阶梯", tip: TIP2, seed: 9205, palette: ["P", "Y", "R"], rows: 4, rainbows: 3 }),
  g({ name: "七彩蜂窝", tip: TIP2, seed: 9206, palette: ["R", "Y", "B", "G"], rows: 4, rainbows: 3 }),
  g({ name: "彩虹背带", tip: TIP2, seed: 9207, palette: ["G", "B", "P"], rows: 5, rainbows: 3 }),
  g({ name: "虹石相间", tip: "彩虹帮忙,石头捣乱,先救彩虹!", seed: 9208, palette: ["Y", "R", "G"], rows: 4, rainbows: 2, stoneRuns: 1 }),
  g({ name: "彩光隧道", tip: TIP2, seed: 9209, palette: ["B", "P", "Y"], rows: 5, rainbows: 3 }),
  g({ name: "虹尾宝藏", tip: TIP2, seed: 9210, palette: ["R", "G", "B"], rows: 5, rainbows: 4 }),
  g({ name: "双虹戏石", tip: "两道彩虹夹着石泡,好好利用!", seed: 9211, palette: ["P", "G", "Y"], rows: 5, rainbows: 3, stoneRuns: 2 }),
  g({ name: "彩虹旋梯", tip: TIP2, seed: 9212, palette: ["Y", "B", "R"], rows: 5, rainbows: 4 }),
  g({ name: "虹谷风铃", tip: TIP2, seed: 9213, palette: ["G", "R", "P"], rows: 5, rainbows: 4, stoneRuns: 1 }),
  g({ name: "幻彩迷阵", tip: TIP2, seed: 9214, palette: ["B", "Y", "G", "P"], rows: 5, rainbows: 4, stoneRuns: 2 }),
  g({ name: "彩虹之心", tip: "彩虹峡谷毕业考!彩虹和石头齐上阵!", seed: 9215, palette: ["R", "P", "B", "G"], rows: 5, rainbows: 5, stoneRuns: 2, bonusShots: 2 }),
];

/** 主题 3 · 白云天空:云挡板 16 关 */
const T3: BubbleLevelDef[] = [
  ...H_CLOUD,
  g({ name: "初上云端", tip: TIP3, seed: 9301, palette: ["R", "G", "Y"], rows: 3, cloudKind: 3 }),
  g({ name: "白云台阶", tip: TIP3, seed: 9302, palette: ["B", "Y", "P"], rows: 3, cloudKind: 1 }),
  g({ name: "云朵门廊", tip: TIP3, seed: 9303, palette: ["G", "R", "B"], rows: 4, cloudKind: 3 }),
  g({ name: "双云守门", tip: TIP3, seed: 9304, palette: ["Y", "P", "G"], rows: 4, cloudKind: 2 }),
  g({ name: "云中走廊", tip: TIP3, seed: 9305, palette: ["R", "B", "P"], rows: 4, cloudKind: 1 }),
  g({ name: "云隙飞泡", tip: TIP3, seed: 9306, palette: ["G", "Y", "B"], rows: 4, cloudKind: 2 }),
  g({ name: "云端石礁", tip: "云朵加石泡,借墙走弧线!", seed: 9307, palette: ["P", "R", "Y"], rows: 4, cloudKind: 3, stoneRuns: 1 }),
  g({ name: "飘云虹影", tip: "云里藏着彩虹,弹过去接住它!", seed: 9308, palette: ["B", "G", "R"], rows: 4, cloudKind: 1, rainbows: 2 }),
  g({ name: "云海列车", tip: TIP3, seed: 9309, palette: ["Y", "R", "G"], rows: 5, cloudKind: 3 }),
  g({ name: "云堡夹道", tip: TIP3, seed: 9310, palette: ["P", "B", "Y"], rows: 5, cloudKind: 2 }),
  g({ name: "乱云飞渡", tip: TIP3, seed: 9311, palette: ["R", "G", "P"], rows: 5, cloudKind: 1, stoneRuns: 1 }),
  g({ name: "云中石虹", tip: "云、石、彩虹一起上!", seed: 9312, palette: ["G", "B", "Y"], rows: 5, cloudKind: 3, stoneRuns: 1, rainbows: 2 }),
  g({ name: "云顶天宫", tip: TIP3, seed: 9313, palette: ["B", "R", "Y", "G"], rows: 5, cloudKind: 2, rainbows: 2 }),
  g({ name: "风起云涌", tip: "白云天空毕业考!双云守阵!", seed: 9314, palette: ["Y", "P", "R", "B"], rows: 5, cloudKind: 2, stoneRuns: 2, bonusShots: 2 }),
];

/** 主题 4 · 黑洞星河:黑洞 16 关 */
const T4: BubbleLevelDef[] = [
  ...H_HOLE,
  g({ name: "星河初探", tip: TIP4, seed: 9401, palette: ["B", "P", "Y"], rows: 3, holeKind: 3 }),
  g({ name: "黑洞哨站", tip: TIP4, seed: 9402, palette: ["R", "G", "B"], rows: 3, holeKind: 1 }),
  g({ name: "引力陷阱", tip: TIP4, seed: 9403, palette: ["Y", "P", "G"], rows: 4, holeKind: 1 }),
  g({ name: "双洞峡谷", tip: TIP4, seed: 9404, palette: ["B", "R", "Y"], rows: 4, holeKind: 2 }),
  g({ name: "星尘走廊", tip: TIP4, seed: 9405, palette: ["P", "G", "R"], rows: 4, holeKind: 3 }),
  g({ name: "洞旁石阵", tip: "黑洞守中路,石泡堵旁路!", seed: 9406, palette: ["G", "B", "Y"], rows: 4, holeKind: 1, stoneRuns: 1 }),
  g({ name: "暗河渡口", tip: TIP4, seed: 9407, palette: ["R", "P", "B"], rows: 4, holeKind: 2 }),
  g({ name: "星云漩涡", tip: TIP4, seed: 9408, palette: ["Y", "G", "P"], rows: 5, holeKind: 3 }),
  g({ name: "黑洞虹光", tip: "彩虹能救急,黑洞要绕开!", seed: 9409, palette: ["B", "Y", "R"], rows: 5, holeKind: 1, rainbows: 2 }),
  g({ name: "引力迷宫", tip: TIP4, seed: 9410, palette: ["P", "R", "G"], rows: 5, holeKind: 2, stoneRuns: 1 }),
  g({ name: "双洞石城", tip: TIP4, seed: 9411, palette: ["G", "Y", "B"], rows: 5, holeKind: 2, stoneRuns: 2 }),
  g({ name: "星河风暴", tip: TIP4, seed: 9412, palette: ["R", "B", "P"], rows: 5, holeKind: 3, rainbows: 2 }),
  g({ name: "洞穿云影", tip: "黑洞加云朵,弹道要拐两个弯!", seed: 9413, palette: ["Y", "R", "G"], rows: 4, holeKind: 3, cloudKind: 3 }),
  g({ name: "黑洞之眼", tip: "黑洞星河毕业考!双洞夹击!", seed: 9414, palette: ["B", "G", "P", "Y"], rows: 5, holeKind: 2, rainbows: 2, stoneRuns: 1, bonusShots: 2 }),
];

/** 主题 5 · 风暴嘉年华:下落新行 + 组合 16 关 */
const T5: BubbleLevelDef[] = [
  ...H_STORM_EARLY,
  g({ name: "风暴前夜", tip: TIP5, seed: 9501, palette: ["R", "G", "B"], rows: 2, dropRows: 1 }),
  g({ name: "骤雨压城", tip: TIP5, seed: 9502, palette: ["Y", "P", "B"], rows: 2, dropRows: 2 }),
  g({ name: "雷雨石阵", tip: "石泡挡路,新行还压下来!", seed: 9503, palette: ["G", "R", "Y"], rows: 3, dropRows: 1, stoneRuns: 1 }),
  g({ name: "风卷彩虹", tip: "抓住彩虹,赶在暴雨前清场!", seed: 9504, palette: ["B", "G", "P"], rows: 3, dropRows: 1, rainbows: 2 }),
  g({ name: "洞里风暴", tip: "黑洞加暴雨,神射手也要小心!", seed: 9505, palette: ["R", "Y", "G"], rows: 2, dropRows: 1, holeKind: 3 }),
  g({ name: "云顶骤雨", tip: "云朵反弹,新行压顶,双重考验!", seed: 9506, palette: ["P", "B", "Y"], rows: 2, dropRows: 1, cloudKind: 3 }),
  g({ name: "嘉年华序曲", tip: "毕业考热身:石虹雨齐来!", seed: 9507, palette: ["G", "R", "B"], rows: 3, dropRows: 2, stoneRuns: 1, rainbows: 2, bonusShots: 2 }),
  ...H_STORM_FINAL,
];

export const LEVELS: BubbleLevelDef[] = [...T0, ...T1, ...T2, ...T3, ...T4, ...T5];
