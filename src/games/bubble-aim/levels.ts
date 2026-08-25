// 泡泡瞄准关卡：偶数行 9 格、奇数行 8 格（右移半格），'.' 为空。
// 颜色：R 草莓红 Y 柠檬黄 B 天空蓝 G 苹果绿 P 葡萄紫。
// 特殊：S 石泡（被直接命中两次才碎，不参与连消）、W 彩虹泡（百搭）。
// 障碍：clouds 云挡板（弹道反弹）、holes 黑洞（吞掉泡泡）、
// dropEvery/dropRows 每打 N 发顶部压下来一行新泡泡（队列用完为止）。

import type { CloudDef, HoleDef } from "./logic";

export interface BubbleLevelDef {
  name: string;
  tip: string;
  layout: string[];
  /** 本关子弹数 */
  shots: number;
  clouds?: CloudDef[];
  holes?: HoleDef[];
  /** 每打出多少发，顶部就压下来一行（配 dropRows 用） */
  dropEvery?: number;
  /** 待下落的新行队列（用完就不再下落），长度按 8/9 交替 */
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

export const LEVELS: BubbleLevelDef[] = [
  // ---------- 入门：纯颜色 ----------
  {
    name: "三色小塔",
    tip: "对准同色的泡泡发射，凑齐 3 个就爆！",
    layout: [
      "RRRGGGBBB",
      "RRRGGBBB",
      ".RRGGGBB.",
    ],
    shots: 16,
  },
  {
    name: "彩虹拱门",
    tip: "试试打拱门的柱子，上面的会一起掉下来！",
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
    tip: "一条一条消，看看哪条最好打！",
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
    tip: "从爱心的小尖尖开始往上消！",
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
  // ---------- 石泡登场 ----------
  {
    name: "石头城门",
    tip: "灰色石泡要连打两下才碎，先找别的路！",
    layout: [
      "YYYRRRYYY",
      ".SSSSSS.",
      "..GGGGG..",
    ],
    shots: 16,
  },
  // ---------- 彩虹泡登场 ----------
  {
    name: "彩虹桥",
    tip: "彩虹泡跟什么颜色都算一伙，能连出超长一串！",
    layout: [
      "RR.WWW.BB",
      "RRW..WBB",
      ".GGG.GGG.",
    ],
    shots: 14,
  },
  {
    name: "石虹迷阵",
    tip: "彩虹被石头夹住了，用黄色泡泡把它救出来！",
    layout: [
      "GG.SS.PP.",
      "GGSWWSPP",
      ".YYY.YYY.",
      "..Y....Y",
    ],
    shots: 18,
  },
  // ---------- 云挡板登场 ----------
  {
    name: "白云索道",
    tip: "云朵会把泡泡弹开，贴着墙打绕过去！",
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
    tip: "两朵云守着两边，中间的路要自己打开！",
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
  // ---------- 黑洞登场 ----------
  {
    name: "黑洞警报",
    tip: "小心中间的黑洞，泡泡飞进去就不见啦！",
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
    tip: "两个黑洞守着斜线，从中间和墙边走！",
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
  // ---------- 下落新行登场 ----------
  {
    name: "天降泡雨",
    tip: "每打 4 发，天上就压下来一排新泡泡，抓紧消！",
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
    tip: "石泡挡路还会掉新行，先把两边清干净！",
    layout: [
      "YYSPPSYY.",
      "YY.PP.YY",
    ],
    dropEvery: 5,
    dropRows: ["GGBBGGBB"],
    shots: 18,
  },
  // ---------- 组合关：三种以上机关 ----------
  {
    name: "彩虹黑洞",
    tip: "云朵封了墙角，黑洞守着中路，彩虹泡来帮忙！",
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
    tip: "石泡吊着果冻墙，黑洞和云朵都来捣乱！",
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
    tip: "云朵挡中路，新行一直压下来，手要快！",
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
    tip: "黑洞吞泡泡、石泡挡路、新行还往下压！",
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
    tip: "大星阵下面吊着石泡，黑洞守着必经之路！",
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
    tip: "石泡、彩虹、云朵、黑洞一起上，神射手就是你！",
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
    tip: "五种机关全到齐！打完这关就是泡泡大师！",
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
